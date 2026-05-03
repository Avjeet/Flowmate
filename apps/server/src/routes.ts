import {
  createSession,
  readSession,
  writeSession,
  listSessions,
  transitionPhase,
  setApprovalGate,
  clearApprovalGate,
  setActiveSession,
  clearActiveSession,
  getActiveSession,
  readConfig,
  writeConfig,
  ensureDirs,
} from "@flowmate/shared";
import { broadcast } from "./ws";
import { GitLabClient, JiraClient, GitHubClient } from "@flowmate/mcp-client";
import type { Phase, ApprovalGate } from "@flowmate/shared";

// In-memory store for pending comments (selected by user in UI for fixing)
const pendingComments = new Map<string, unknown[]>();

// Pending session create request (set by hook when ExitPlanMode fires, cleared by UI)
let pendingSessionRequest: { name: string; prompt: string; cwd: string; agentType: string } | null = null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function notFound() {
  return json({ error: "not found" }, 404);
}

function handleDetectGit(cwd: string): Response {
  const remoteProc = Bun.spawnSync(["git", "-C", cwd, "remote", "get-url", "origin"], { stderr: "pipe" });
  if (remoteProc.exitCode !== 0) return json({ error: "No git remote found in that directory" }, 404);
  const remote = remoteProc.stdout.toString().trim();

  const branchProc = Bun.spawnSync(["git", "-C", cwd, "branch", "--show-current"], { stderr: "pipe" });
  const branch = branchProc.exitCode === 0 ? branchProc.stdout.toString().trim() : "";

  let provider: "github" | "gitlab" | "unknown" = "unknown";
  let repo = "";
  const httpsMatch = remote.match(/https?:\/\/(github\.com|gitlab\.com)\/([^/]+\/[^/.]+)/);
  const sshMatch = remote.match(/git@(github\.com|gitlab\.com):([^/]+\/[^.]+)/);
  const m = httpsMatch ?? sshMatch;
  if (m) {
    provider = m[1] === "github.com" ? "github" : "gitlab";
    repo = m[2].replace(/\.git$/, "");
  }

  return json({ remote, repo, branch, provider });
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  ensureDirs();

  // GET /api/sessions
  if (method === "GET" && path === "/api/sessions") {
    return json(listSessions());
  }

  // GET /api/sessions/active
  if (method === "GET" && path === "/api/sessions/active") {
    const session = getActiveSession();
    return session ? json(session) : json(null);
  }

  // POST /api/sessions
  if (method === "POST" && path === "/api/sessions") {
    const body = await req.json();
    const session = createSession({
      id: crypto.randomUUID(),
      name: body.name ?? "Untitled Session",
      agentType: body.agentType ?? "unknown",
      jiraTicket: body.jiraTicket,
      gitlabRepo: body.gitlabRepo,
      gitlabMR: body.gitlabMR,
      cwd: body.cwd,
    });
    setActiveSession(session.meta.id);
    broadcast({ type: "session_update", sessionId: session.meta.id, payload: session });
    return json(session, 201);
  }

  // ── Pending session request — must be before /:id catch-all ───────────────

  if (path === "/api/sessions/pending-create") {
    if (method === "GET") return json(pendingSessionRequest ?? null);
    if (method === "DELETE") {
      pendingSessionRequest = null;
      broadcast({ type: "pending_session_dismissed" });
      return json({ ok: true });
    }
    if (method === "POST") {
      const body = await req.json();
      pendingSessionRequest = {
        name: body.name ?? "Untitled Task",
        prompt: body.prompt ?? "",
        cwd: body.cwd ?? "",
        agentType: body.agentType ?? "unknown",
      };
      broadcast({ type: "pending_session", payload: pendingSessionRequest });
      return json({ ok: true });
    }
  }

  // GET /api/sessions/:id
  // GET /api/detect-git?path=...  (standalone — no session required)
  if (method === "GET" && path === "/api/detect-git") {
    const dir = url.searchParams.get("path");
    if (!dir) return json({ error: "path query param required" }, 400);
    return handleDetectGit(dir);
  }

  // GET /api/sessions/:id/detect-git
  const detectGitMatch = path.match(/^\/api\/sessions\/([^/]+)\/detect-git$/);
  if (detectGitMatch && method === "GET") {
    const id = detectGitMatch[1];
    const session = readSession(id);
    if (!session?.meta.cwd) return json({ error: "No working directory on session" }, 400);
    return handleDetectGit(session.meta.cwd);
  }

  const sessionMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    const id = sessionMatch[1];

    if (method === "GET") {
      const session = readSession(id);
      return session ? json(session) : notFound();
    }

    // PATCH /api/sessions/:id  — update meta fields (repo, PR links, ticket, etc.)
    if (method === "PATCH") {
      const session = readSession(id);
      if (!session) return notFound();
      const body = await req.json();
      const allowed = ["gitlabRepo","gitlabMR","gitlabMRUrl","githubRepo","githubPR","githubPRUrl","jiraTicket","jiraProjectKey","jiraTicketUrl"];
      for (const key of allowed) {
        if (key in body) (session.meta as any)[key] = body[key];
      }
      session.meta.updatedAt = new Date().toISOString();
      writeSession(session);
      broadcast({ type: "session_update", sessionId: id, payload: session });
      return json(session);
    }
  }

  // POST /api/sessions/:id/event
  const eventMatch = path.match(/^\/api\/sessions\/([^/]+)\/event$/);
  if (eventMatch && method === "POST") {
    const id = eventMatch[1];
    const body = await req.json();
    const phase = body.phase as Phase;
    const session = transitionPhase(id, phase, body.event ?? phase, body.data);
    if (!session) return notFound();
    broadcast({ type: "session_update", sessionId: id, payload: session });
    broadcast({ type: "event", sessionId: id, payload: { phase, event: body.event } });
    return json(session);
  }

  // POST /api/sessions/:id/gate
  const gateMatch = path.match(/^\/api\/sessions\/([^/]+)\/gate$/);
  if (gateMatch && method === "POST") {
    const id = gateMatch[1];
    const body = await req.json();
    const session = setApprovalGate(id, body.gate as ApprovalGate, body.data);
    if (!session) return notFound();
    broadcast({ type: "approval_required", sessionId: id, payload: { gate: body.gate, data: body.data } });
    broadcast({ type: "session_update", sessionId: id, payload: session });
    return json(session);
  }

  // POST /api/sessions/:id/approve
  const approveMatch = path.match(/^\/api\/sessions\/([^/]+)\/approve$/);
  if (approveMatch && method === "POST") {
    const id = approveMatch[1];
    let session = clearApprovalGate(id);
    if (!session) return notFound();
    // If approving the plan gate, advance to BUILDING so the hook knows
    if (session.state.phase === "PLANNING") {
      session = transitionPhase(id, "BUILDING", "plan_approved") ?? session;
    }
    broadcast({ type: "approval_cleared", sessionId: id, payload: session });
    broadcast({ type: "session_update", sessionId: id, payload: session });
    return json(session);
  }

  // POST /api/sessions/:id/end
  const endMatch = path.match(/^\/api\/sessions\/([^/]+)\/end$/);
  if (endMatch && method === "POST") {
    const id = endMatch[1];
    const session = transitionPhase(id, "DONE", "session_ended");
    if (!session) return notFound();
    clearActiveSession();
    broadcast({ type: "session_update", sessionId: id, payload: session });
    return json(session);
  }

  // GET /api/config
  if (method === "GET" && path === "/api/config") {
    return json(readConfig());
  }

  // POST /api/config
  if (method === "POST" && path === "/api/config") {
    const body = await req.json();
    writeConfig(body);
    return json({ ok: true });
  }

  // ── Cold start ─────────────────────────────────────────────────────────────

  // POST /api/sessions/cold-start/confirm  { name, prompt, jiraProjectKey?, agentType, cwd? }
  if (method === "POST" && path === "/api/sessions/cold-start/confirm") {
    const body = await req.json();
    const config = readConfig();

    let jiraTicket: string | undefined;
    let jiraTicketUrl: string | undefined;

    if (body.jiraProjectKey && config.integrations?.jira) {
      try {
        const client = new JiraClient(config.integrations.jira);
        const story = await client.createStory(
          body.jiraProjectKey,
          body.name,
          body.prompt
        );
        jiraTicket = story.key;
        jiraTicketUrl = story.url;
      } catch (e: any) {
        // Non-fatal — session still created without JIRA link
        console.error("[FlowMate] JIRA story creation failed:", e.message);
      }
    }

    const session = createSession({
      id: crypto.randomUUID(),
      name: body.name ?? "Untitled Session",
      agentType: body.agentType ?? "unknown",
      jiraTicket,
      jiraProjectKey: body.jiraProjectKey,
      jiraTicketUrl,
      cwd: body.cwd,
    });
    setActiveSession(session.meta.id);
    pendingSessionRequest = null; // clear the pending banner
    broadcast({ type: "pending_session_dismissed" });
    broadcast({ type: "session_update", sessionId: session.meta.id, payload: session });
    return json(session, 201);
  }

  // ── Commit endpoint ─────────────────────────────────────────────────────────

  // POST /api/sessions/:id/commit  { mrUrl?, prUrl? }
  const commitMatch = path.match(/^\/api\/sessions\/([^/]+)\/commit$/);
  if (commitMatch && method === "POST") {
    const id = commitMatch[1];
    const body = await req.json();

    const updated = transitionPhase(id, "REVIEWING", "commit_pushed", {
      mrUrl: body.mrUrl,
      prUrl: body.prUrl,
    });
    if (!updated) return notFound();
    if (body.mrUrl) updated.meta.gitlabMRUrl = body.mrUrl;
    if (body.prUrl) updated.meta.githubPRUrl = body.prUrl;
    writeSession(updated);

    broadcast({ type: "session_update", sessionId: id, payload: updated });
    return json(updated);
  }

  // ── GitLab integration ──────────────────────────────────────────────────────

  // GET /api/gitlab/mr?sessionId=...
  if (method === "GET" && path === "/api/gitlab/mr") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const session = readSession(sessionId);
    if (!session?.meta.gitlabRepo || !session?.meta.gitlabMR)
      return json({ error: "No GitLab MR linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.gitlab)
      return json({ error: "GitLab not configured" }, 400);
    try {
      const client = new GitLabClient(config.integrations.gitlab);
      const mr = await client.getMR(session.meta.gitlabRepo, session.meta.gitlabMR);
      return json(mr);
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // GET /api/gitlab/comments?sessionId=...
  if (method === "GET" && path === "/api/gitlab/comments") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const session = readSession(sessionId);
    if (!session?.meta.gitlabRepo || !session?.meta.gitlabMR)
      return json({ error: "No GitLab MR linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.gitlab)
      return json({ error: "GitLab not configured" }, 400);
    try {
      const client = new GitLabClient(config.integrations.gitlab);
      const comments = await client.getMRDiffComments(
        session.meta.gitlabRepo,
        session.meta.gitlabMR
      );
      return json(comments);
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // POST /api/sessions/:id/pending-comments  (UI selects comments to fix)
  const pendingCommentsMatch = path.match(/^\/api\/sessions\/([^/]+)\/pending-comments$/);
  if (pendingCommentsMatch) {
    const id = pendingCommentsMatch[1];
    if (method === "POST") {
      const body = await req.json();
      pendingComments.set(id, body.comments ?? []);
      broadcast({ type: "event", sessionId: id, payload: { event: "comments_queued_for_fix", count: (body.comments ?? []).length } });
      return json({ ok: true });
    }
    if (method === "GET") {
      return json(pendingComments.get(id) ?? []);
    }
  }

  // ── JIRA integration ────────────────────────────────────────────────────────

  // GET /api/jira/ticket?sessionId=...
  if (method === "GET" && path === "/api/jira/ticket") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const session = readSession(sessionId);
    if (!session?.meta.jiraTicket)
      return json({ error: "No JIRA ticket linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.jira)
      return json({ error: "JIRA not configured" }, 400);
    try {
      const client = new JiraClient(config.integrations.jira);
      const ticket = await client.getTicket(session.meta.jiraTicket);
      return json(ticket);
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // GET /api/jira/transitions?sessionId=...
  if (method === "GET" && path === "/api/jira/transitions") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const session = readSession(sessionId);
    if (!session?.meta.jiraTicket)
      return json({ error: "No JIRA ticket linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.jira)
      return json({ error: "JIRA not configured" }, 400);
    try {
      const client = new JiraClient(config.integrations.jira);
      const transitions = await client.getTransitions(session.meta.jiraTicket);
      return json(transitions);
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // POST /api/jira/transition  { sessionId, transitionId }
  if (method === "POST" && path === "/api/jira/transition") {
    const body = await req.json();
    const session = readSession(body.sessionId);
    if (!session?.meta.jiraTicket)
      return json({ error: "No JIRA ticket linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.jira)
      return json({ error: "JIRA not configured" }, 400);
    try {
      const client = new JiraClient(config.integrations.jira);
      await client.doTransition(session.meta.jiraTicket, body.transitionId);
      broadcast({ type: "event", sessionId: body.sessionId, payload: { event: "jira_transition", transitionId: body.transitionId } });
      return json({ ok: true });
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // ── GitHub integration ──────────────────────────────────────────────────────

  // GET /api/github/pr?sessionId=...
  if (method === "GET" && path === "/api/github/pr") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const session = readSession(sessionId);
    if (!session?.meta.githubRepo || !session?.meta.githubPR)
      return json({ error: "No GitHub PR linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.github)
      return json({ error: "GitHub not configured" }, 400);
    try {
      const client = new GitHubClient(config.integrations.github);
      return json(await client.getPR(session.meta.githubRepo, session.meta.githubPR));
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // GET /api/github/comments?sessionId=...
  if (method === "GET" && path === "/api/github/comments") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const session = readSession(sessionId);
    if (!session?.meta.githubRepo || !session?.meta.githubPR)
      return json({ error: "No GitHub PR linked to this session" }, 400);
    const config = readConfig();
    if (!config.integrations?.github)
      return json({ error: "GitHub not configured" }, 400);
    try {
      const client = new GitHubClient(config.integrations.github);
      return json(await client.getPRComments(session.meta.githubRepo, session.meta.githubPR));
    } catch (e: any) {
      return json({ error: e.message }, 502);
    }
  }

  // ── Test connections ────────────────────────────────────────────────────────

  // POST /api/test/gitlab  { host, token }
  if (method === "POST" && path === "/api/test/gitlab") {
    const { host, token } = await req.json();
    if (!host || !token) return json({ error: "host and token required" }, 400);
    try {
      const res = await globalThis.fetch(`https://${host}/api/v4/user`, {
        headers: { "PRIVATE-TOKEN": token },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return json({ ok: true, username: data.username });
    } catch (e: any) {
      return json({ ok: false, error: e.message }, 200);
    }
  }

  // POST /api/test/jira  { host, email, token }
  if (method === "POST" && path === "/api/test/jira") {
    const { host, email, token } = await req.json();
    if (!host || !email || !token) return json({ error: "host, email and token required" }, 400);
    try {
      const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
      const res = await globalThis.fetch(`https://${host}/rest/api/3/myself`, {
        headers: { Authorization: auth, Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return json({ ok: true, displayName: data.displayName });
    } catch (e: any) {
      return json({ ok: false, error: e.message }, 200);
    }
  }

  // POST /api/test/github  { token }
  if (method === "POST" && path === "/api/test/github") {
    const { token } = await req.json();
    if (!token) return json({ error: "token required" }, 400);
    try {
      const client = new GitHubClient({ token });
      const { login } = await client.testConnection();
      return json({ ok: true, login });
    } catch (e: any) {
      return json({ ok: false, error: e.message }, 200);
    }
  }

  return notFound();
}

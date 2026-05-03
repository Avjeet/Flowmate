import { useState, useCallback } from "react";
import type { Session } from "@flowmate/shared";
import { BASE } from "../api";

interface PR {
  number: number;
  title: string;
  state: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  draft: boolean;
}

interface Comment {
  id: number;
  author: string;
  body: string;
  file?: string;
  line?: number;
  resolved: boolean;
}

interface Props {
  session: Session;
}

export function GitHubPanel({ session }: Props) {
  const [pr, setPr] = useState<PR | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const hasGitHub = !!session.meta.githubPR && !!session.meta.githubRepo;

  // If no PR number yet but we have a URL, show just the link
  const prUrl = session.meta.githubPRUrl;

  async function fetchAll() {
    setLoading(true);
    setError(null);
    setQueued(false);
    try {
      const [prRes, commentsRes] = await Promise.all([
        fetch(`${BASE}/github/pr?sessionId=${session.meta.id}`),
        fetch(`${BASE}/github/comments?sessionId=${session.meta.id}`),
      ]);
      if (!prRes.ok) {
        const e = await prRes.json();
        setError(e.error ?? "Failed to fetch PR");
        return;
      }
      setPr(await prRes.json());
      setComments(commentsRes.ok ? await commentsRes.json() : []);
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function queueFix() {
    const toFix = comments.filter((c) => selected.has(c.id));
    const res = await fetch(`${BASE}/sessions/${session.meta.id}/pending-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: toFix }),
    });
    if (res.ok) {
      setQueued(true);
      setSelected(new Set());
    }
  }

  if (!hasGitHub && !prUrl) {
    return <LinkRepoForm sessionId={session.meta.id} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GitHub</span>
          {session.meta.githubPR && (
            <span className="text-xs text-gray-400">PR #{session.meta.githubPR}</span>
          )}
        </div>
        {hasGitHub && (
          <button
            onClick={fetchAll}
            disabled={loading}
            className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs transition-colors"
          >
            {loading ? "Fetching…" : "Fetch Comments"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {error && (
          <div className="px-3 py-2 bg-red-950/40 border border-red-700 rounded text-xs text-red-400">{error}</div>
        )}

        {/* PR URL if we only have the link */}
        {prUrl && !pr && (
          <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center justify-between">
            <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:underline truncate">
              {prUrl}
            </a>
            <a href={prUrl} target="_blank" rel="noopener noreferrer"
              className="ml-3 px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs shrink-0 transition-colors">
              Open ↗
            </a>
          </div>
        )}

        {/* PR info */}
        {pr && (
          <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                pr.draft ? "bg-gray-700 text-gray-400"
                  : pr.state === "open" ? "bg-green-900 text-green-300"
                  : pr.state === "merged" ? "bg-purple-900 text-purple-300"
                  : "bg-gray-700 text-gray-300"
              }`}>
                {pr.draft ? "draft" : pr.state}
              </span>
              <a href={pr.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-300 hover:underline truncate">
                {pr.title}
              </a>
            </div>
            <p className="text-xs text-gray-500">
              {pr.sourceBranch} → {pr.targetBranch} · by @{pr.author}
            </p>
          </div>
        )}

        {/* Comments */}
        {comments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {comments.length} comment{comments.length !== 1 ? "s" : ""}
                {selected.size > 0 && ` · ${selected.size} selected`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(comments.filter((c) => !c.resolved).map((c) => c.id)))}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Select all open
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={queueFix}
                    className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-semibold transition-colors"
                  >
                    Fix Selected ({selected.size})
                  </button>
                )}
              </div>
            </div>

            {comments.map((c) => (
              <div
                key={c.id}
                onClick={() => !c.resolved && toggle(c.id)}
                className={`p-3 rounded-lg border transition-colors ${
                  c.resolved
                    ? "border-gray-800 bg-gray-900/30 opacity-50 cursor-default"
                    : selected.has(c.id)
                    ? "border-blue-600 bg-blue-950/30 cursor-pointer"
                    : "border-gray-700 bg-gray-800/30 hover:border-gray-600 cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!c.resolved && (
                    <div className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded border ${
                      selected.has(c.id) ? "bg-blue-600 border-blue-600" : "border-gray-600"
                    }`} />
                  )}
                  {c.resolved && (
                    <div className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded bg-green-800 border border-green-700 flex items-center justify-center">
                      <span className="text-green-400 text-xs">✓</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-300">@{c.author}</span>
                      {c.file && <span className="text-xs text-gray-500 truncate">{c.file}{c.line ? `:${c.line}` : ""}</span>}
                      {c.resolved && <span className="text-xs text-green-600">resolved</span>}
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{c.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {queued && (
          <div className="px-3 py-2 bg-blue-950/40 border border-blue-700 rounded text-xs text-blue-300">
            ✓ Comments queued. Run <code className="bg-gray-800 px-1 rounded">/flowmate-fetch-comments</code> in your agent.
          </div>
        )}

        {!loading && !error && comments.length === 0 && pr && (
          <p className="text-gray-600 text-xs text-center py-4">No comments on this PR.</p>
        )}
      </div>
    </div>
  );
}

// ── Link Repo Form ─────────────────────────────────────────────────────────────

function LinkRepoForm({ sessionId }: { sessionId: string }) {
  const [repo, setRepo] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = useCallback(async () => {
    const repoTrimmed = repo.trim();
    const pr = parseInt(prNumber.trim(), 10);
    if (!repoTrimmed || !repoTrimmed.includes("/")) {
      setError("Repo must be in owner/repo format");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { githubRepo: repoTrimmed };
      if (!isNaN(pr)) {
        body.githubPR = pr;
        body.githubPRUrl = `https://github.com/${repoTrimmed}/pull/${pr}`;
      }
      const r = await fetch(`${BASE}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to update session");
      // Reload page to reflect linked session
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }, [repo, prNumber, sessionId]);

  return (
    <div className="flex flex-col h-full items-center justify-center px-8 py-6">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <p className="text-sm font-semibold text-white mb-1">Link GitHub Repo</p>
          <p className="text-xs text-gray-500">Connect a repo and PR to this session to fetch review comments.</p>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Repository</label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/repo"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">PR Number <span className="text-gray-600">(optional)</span></label>
            <input
              value={prNumber}
              onChange={(e) => setPrNumber(e.target.value)}
              placeholder="42"
              type="number"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          onClick={handleLink}
          disabled={saving || !repo.trim()}
          className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs font-semibold transition-colors"
        >
          {saving ? "Linking…" : "Link Repo"}
        </button>
      </div>
    </div>
  );
}

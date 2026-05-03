import { useState, useEffect, useCallback } from "react";
import type { Session } from "@flowmate/shared";
import { BASE } from "../api";

interface DetectResult {
  repo: string;
  branch: string;
  provider: "github" | "gitlab" | "unknown";
  remote: string;
}

interface Props {
  session: Session;
  onLinked: () => void;
}

export function GitDetectBanner({ session, onLinked }: Props) {
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [linking, setLinking] = useState(false);

  // Already has a repo linked — nothing to do
  const alreadyLinked = session.meta.githubRepo || session.meta.gitlabRepo;

  useEffect(() => {
    if (alreadyLinked || dismissed || !session.meta.cwd) return;

    fetch(`${BASE}/sessions/${session.meta.id}/detect-git`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.repo && data.provider !== "unknown") setDetected(data);
      })
      .catch(() => {});
  }, [session.meta.id, session.meta.cwd, alreadyLinked, dismissed]);

  if (alreadyLinked || dismissed) return null;

  // No cwd on session — show a small path prompt so user can still trigger detection
  if (!session.meta.cwd && !detected) {
    return <NoCwdPrompt sessionId={session.meta.id} onLinked={onLinked} />;
  }

  if (!detected) return null;

  const isGitHub = detected.provider === "github";
  const accentColor = isGitHub ? "border-gray-600 bg-gray-800/50" : "border-orange-800 bg-orange-950/30";
  const labelColor = isGitHub ? "text-gray-300" : "text-orange-300";
  const providerLabel = isGitHub ? "GitHub" : "GitLab";

  async function handleConnect() {
    setLinking(true);
    const body = isGitHub
      ? { githubRepo: detected!.repo }
      : { gitlabRepo: detected!.repo };

    await fetch(`${BASE}/sessions/${session.meta.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLinking(false);
    onLinked();
  }

  return (
    <div className={`mx-4 mt-2 px-4 py-2.5 rounded-lg border flex items-center justify-between gap-4 ${accentColor}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-xs font-medium shrink-0 ${labelColor}`}>{providerLabel} detected</span>
        <span className="text-gray-500 text-xs">·</span>
        <code className="text-xs text-white truncate">{detected.repo}</code>
        {detected.branch && (
          <>
            <span className="text-gray-600 text-xs shrink-0">on</span>
            <code className={`text-xs shrink-0 px-1.5 py-0.5 rounded ${isGitHub ? "bg-gray-700 text-gray-300" : "bg-orange-900/50 text-orange-300"}`}>
              {detected.branch}
            </code>
          </>
        )}
        <span className="text-gray-600 text-xs shrink-0">— connect to this task?</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleConnect}
          disabled={linking}
          className={`px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-40 ${
            isGitHub
              ? "bg-gray-600 hover:bg-gray-500 text-white"
              : "bg-orange-700 hover:bg-orange-600 text-white"
          }`}
        >
          {linking ? "Connecting…" : "Connect"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-3 py-1 bg-transparent hover:bg-gray-700 rounded text-xs text-gray-500 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Shown when session has no cwd (created from dashboard) ────────────────────

function NoCwdPrompt({ sessionId, onLinked }: { sessionId: string; onLinked: () => void }) {
  const [path, setPath] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const detect = useCallback(async () => {
    if (!path.trim()) return;
    setDetecting(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}/detect-git?path=${encodeURIComponent(path.trim())}`);
      const data = await r.json();
      if (!r.ok || data.provider === "unknown" || !data.repo) {
        setResult({ ok: false, msg: data.error ?? "No GitHub/GitLab remote found" });
        return;
      }
      // Link the repo to the session
      const body = data.provider === "github"
        ? { githubRepo: data.repo, cwd: path.trim() }
        : { gitlabRepo: data.repo, cwd: path.trim() };
      await fetch(`${BASE}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onLinked();
    } catch {
      setResult({ ok: false, msg: "Could not reach server" });
    } finally {
      setDetecting(false);
    }
  }, [path, sessionId, onLinked]);

  if (dismissed) return null;

  return (
    <div className="mx-4 mt-2 px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800/40 flex items-center gap-3">
      <span className="text-xs text-gray-400 shrink-0">Link git repo:</span>
      <input
        value={path}
        onChange={(e) => { setPath(e.target.value); setResult(null); }}
        onKeyDown={(e) => e.key === "Enter" && detect()}
        placeholder="/path/to/your/project"
        className="flex-1 bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
      />
      <button
        onClick={detect}
        disabled={!path.trim() || detecting}
        className="px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded text-xs font-semibold transition-colors shrink-0"
      >
        {detecting ? "…" : "Detect"}
      </button>
      {result && (
        <span className={`text-xs shrink-0 ${result.ok ? "text-green-400" : "text-red-400"}`}>
          {result.msg}
        </span>
      )}
      <button onClick={() => setDismissed(true)} className="text-gray-600 hover:text-gray-400 text-xs shrink-0">✕</button>
    </div>
  );
}

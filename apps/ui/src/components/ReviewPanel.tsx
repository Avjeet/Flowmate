import { useState } from "react";
import type { Session } from "@flowmate/shared";
import { BASE } from "../api";

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
  onDone: () => void;
}

export function ReviewPanel({ session, onDone }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const mrUrl = session.meta.gitlabMRUrl ?? session.meta.githubPRUrl;
  const hasMR = !!mrUrl;

  async function fetchComments() {
    setLoading(true);
    setError(null);
    setQueued(0);
    try {
      const r = await fetch(`${BASE}/gitlab/comments?sessionId=${session.meta.id}`);
      if (!r.ok) {
        const e = await r.json();
        setError(e.error ?? "Failed to fetch comments");
        return;
      }
      setComments(await r.json());
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
    await fetch(`${BASE}/sessions/${session.meta.id}/pending-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: toFix }),
    });
    setQueued(toFix.length);
    setSelected(new Set());
  }

  async function markDone() {
    setMarking(true);
    await fetch(`${BASE}/sessions/${session.meta.id}/end`, { method: "POST" });
    onDone();
    setMarking(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Code Review</span>
        <button
          onClick={markDone}
          disabled={marking}
          className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded text-xs font-semibold transition-colors"
        >
          {marking ? "Closing…" : "✓ Mark as Done"}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* MR/PR link */}
        {hasMR ? (
          <div className="p-3 bg-orange-950/30 border border-orange-800 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Merge / Pull Request</p>
              <a
                href={mrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-orange-300 hover:underline"
              >
                {mrUrl}
              </a>
            </div>
            <a
              href={mrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 rounded text-xs transition-colors shrink-0"
            >
              Open ↗
            </a>
          </div>
        ) : (
          <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-xs text-gray-500">
            No MR/PR link yet. Run <code className="bg-gray-700 px-1 rounded">/flowmate-commit-push</code> to commit and create one.
          </div>
        )}

        {/* Comments section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400">PR Comments</p>
            <button
              onClick={fetchComments}
              disabled={loading || !session.meta.gitlabRepo}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <span className="w-2 h-2 rounded-full border border-gray-400 border-t-transparent animate-spin" />
                  Fetching…
                </>
              ) : (
                "Fetch PR Comments"
              )}
            </button>
          </div>

          {!session.meta.gitlabRepo && (
            <p className="text-xs text-gray-600">No GitLab repo linked — comments unavailable.</p>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-950/40 border border-red-700 rounded text-xs text-red-400">{error}</div>
          )}

          {comments.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {comments.filter((c) => !c.resolved).length} open · {comments.filter((c) => c.resolved).length} resolved
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
                    <div className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center ${
                      c.resolved ? "bg-green-800 border-green-700" : selected.has(c.id) ? "bg-blue-600 border-blue-600" : "border-gray-600"
                    }`}>
                      {(c.resolved || selected.has(c.id)) && (
                        <span className="text-xs leading-none">✓</span>
                      )}
                    </div>
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
            </>
          )}

          {queued > 0 && (
            <div className="px-3 py-2 bg-blue-950/40 border border-blue-700 rounded text-xs text-blue-300">
              ✓ {queued} comment{queued !== 1 ? "s" : ""} queued. Run{" "}
              <code className="bg-gray-800 px-1 rounded">/flowmate-fetch-comments</code> in your agent to apply fixes.
            </div>
          )}

          {!loading && !error && comments.length === 0 && session.meta.gitlabRepo && (
            <p className="text-gray-600 text-xs text-center py-4">
              Click "Fetch PR Comments" to load comments from GitLab.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

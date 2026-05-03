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

interface MR {
  id: number;
  title: string;
  state: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
}

interface Props {
  session: Session;
}

export function GitLabPanel({ session }: Props) {
  const [mr, setMr] = useState<MR | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const hasGitlab = !!session.meta.gitlabMR && !!session.meta.gitlabRepo;

  async function fetchAll() {
    setLoading(true);
    setError(null);
    setQueued(false);
    try {
      const [mrRes, commentsRes] = await Promise.all([
        fetch(`${BASE}/gitlab/mr?sessionId=${session.meta.id}`),
        fetch(`${BASE}/gitlab/comments?sessionId=${session.meta.id}`),
      ]);
      if (!mrRes.ok) {
        const e = await mrRes.json();
        setError(e.error ?? "Failed to fetch MR");
        return;
      }
      setMr(await mrRes.json());
      setComments(commentsRes.ok ? await commentsRes.json() : []);
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  function toggleComment(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function fixSelected() {
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

  if (!hasGitlab) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500 text-xs">No GitLab MR linked to this session.</p>
        <p className="text-gray-600 text-xs mt-1">Link one when creating a session.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GitLab</span>
          {session.meta.gitlabMR && (
            <span className="text-xs text-orange-400">MR !{session.meta.gitlabMR}</span>
          )}
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-2.5 py-1 bg-orange-700 hover:bg-orange-600 disabled:opacity-40 rounded text-xs transition-colors"
        >
          {loading ? "Fetching…" : "Fetch Comments"}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {error && (
          <div className="px-3 py-2 bg-red-950/40 border border-red-700 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        {/* MR info */}
        {mr && (
          <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  mr.state === "opened"
                    ? "bg-green-900 text-green-300"
                    : mr.state === "merged"
                    ? "bg-purple-900 text-purple-300"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {mr.state}
              </span>
              <a
                href={mr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-300 hover:underline truncate"
              >
                {mr.title}
              </a>
            </div>
            <p className="text-xs text-gray-500">
              {mr.sourceBranch} → {mr.targetBranch} · by {mr.author}
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
                    onClick={fixSelected}
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
                onClick={() => !c.resolved && toggleComment(c.id)}
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  c.resolved
                    ? "border-gray-800 bg-gray-900/30 opacity-50 cursor-default"
                    : selected.has(c.id)
                    ? "border-blue-600 bg-blue-950/30"
                    : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!c.resolved && (
                    <div
                      className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded border ${
                        selected.has(c.id)
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-600"
                      }`}
                    />
                  )}
                  {c.resolved && (
                    <div className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded bg-green-800 border border-green-700 flex items-center justify-center">
                      <span className="text-green-400 text-xs">✓</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-300">@{c.author}</span>
                      {c.file && (
                        <span className="text-xs text-gray-500 truncate">
                          {c.file}{c.line ? `:${c.line}` : ""}
                        </span>
                      )}
                      {c.resolved && (
                        <span className="text-xs text-green-600">resolved</span>
                      )}
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
            ✓ Comments queued for fixing. Run <code className="bg-gray-800 px-1 rounded">/flowmate-fix-comments</code> in your agent.
          </div>
        )}

        {!loading && !error && comments.length === 0 && mr && (
          <p className="text-gray-600 text-xs text-center py-4">No comments found on this MR.</p>
        )}
      </div>
    </div>
  );
}

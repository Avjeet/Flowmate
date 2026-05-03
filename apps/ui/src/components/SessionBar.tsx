import { useState } from "react";
import type { Session } from "@flowmate/shared";
import { approve, endSession } from "../api";

interface Props {
  session: Session | null;
  onUpdate: () => void;
  onNewSession: () => void;
  onOpenConnectors: () => void;
}

export function SessionBar({ session, onUpdate, onNewSession, onOpenConnectors }: Props) {
  const [showCommitHint, setShowCommitHint] = useState(false);
  const elapsed = session ? formatElapsed(new Date(session.meta.createdAt)) : null;
  const phase = session?.state.phase;

  async function handleApprove() {
    if (!session) return;
    await approve(session.meta.id);
    onUpdate();
  }

  async function handleEnd() {
    if (!session) return;
    await endSession(session.meta.id);
    onUpdate();
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        {/* Left: session info */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-blue-400 font-bold tracking-wider text-base shrink-0">FlowMate</span>
          {session ? (
            <>
              <span className="text-gray-500">/</span>
              <span className="text-white font-semibold truncate">{session.meta.name}</span>

              {session.meta.jiraTicket && (
                <a
                  href={session.meta.jiraTicketUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 bg-blue-900/50 border border-blue-700 rounded text-blue-300 text-xs hover:bg-blue-900 transition-colors shrink-0"
                >
                  {session.meta.jiraTicket}
                </a>
              )}

              {session.meta.gitlabMRUrl && (
                <a
                  href={session.meta.gitlabMRUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 bg-orange-900/50 border border-orange-700 rounded text-orange-300 text-xs hover:bg-orange-900 transition-colors shrink-0"
                >
                  MR #{session.meta.gitlabMR || "↗"}
                </a>
              )}
              {session.meta.githubPRUrl && (
                <a
                  href={session.meta.githubPRUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-gray-300 text-xs hover:bg-gray-600 transition-colors shrink-0"
                >
                  PR ↗
                </a>
              )}

              <span className="text-gray-600 text-xs shrink-0">{elapsed}</span>
            </>
          ) : (
            <span className="text-gray-500 text-xs">No active session</span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Approval gate button */}
          {session?.state.waitingFor && (
            <button
              onClick={handleApprove}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-semibold transition-colors animate-pulse"
            >
              Approve
            </button>
          )}

          {/* Commit & Push — only in BUILDING */}
          {phase === "BUILDING" && (
            <button
              onClick={() => setShowCommitHint(true)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold transition-colors"
            >
              Commit & Push
            </button>
          )}

          {session && phase !== "DONE" && (
            <button
              onClick={handleEnd}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              End Session
            </button>
          )}

          <button
            onClick={onNewSession}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-semibold transition-colors"
          >
            + New
          </button>

          {/* Connectors / settings */}
          <button
            onClick={onOpenConnectors}
            title="Connectors"
            className="p-1.5 text-gray-500 hover:text-gray-300 rounded transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Commit hint modal */}
      {showCommitHint && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-white font-semibold">Commit & Push</h2>
            <p className="text-gray-400 text-xs leading-relaxed">
              Run the following skill in your agent terminal to summarize changes, commit, push, and create an MR/PR:
            </p>
            <pre className="bg-gray-800 rounded-lg p-3 text-sm text-indigo-300 select-all">
              /flowmate-commit-push
            </pre>
            <p className="text-gray-500 text-xs">
              The dashboard will automatically move to <strong className="text-orange-400">Review</strong> state and store the MR/PR link once the skill completes.
            </p>
            <button
              onClick={() => setShowCommitHint(false)}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function formatElapsed(since: Date): string {
  const ms = Date.now() - since.getTime();
  const min = Math.floor(ms / 60000);
  const hr = Math.floor(min / 60);
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return "just started";
}

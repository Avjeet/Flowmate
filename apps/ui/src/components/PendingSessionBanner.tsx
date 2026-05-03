/**
 * Shown when the agent has finished planning and the hook is asking
 * whether to create a FlowMate session for this work.
 */

const BASE = `http://localhost:${import.meta.env.VITE_SERVER_PORT ?? 7842}/api`;

interface PendingRequest {
  name: string;
  prompt: string;
  cwd: string;
  agentType: string;
}

interface Props {
  pending: PendingRequest;
  onDecision: () => void; // called after yes or no
}

export function PendingSessionBanner({ pending, onDecision }: Props) {
  async function handleYes() {
    await fetch(`${BASE}/sessions/cold-start/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: pending.name,
        prompt: pending.prompt,
        cwd: pending.cwd,
        agentType: pending.agentType,
      }),
    });
    onDecision();
  }

  async function handleNo() {
    await fetch(`${BASE}/sessions/pending-create`, { method: "DELETE" });
    onDecision();
  }

  return (
    <div className="mx-4 my-3 p-4 rounded-lg border bg-indigo-950/40 border-indigo-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="font-semibold text-sm text-indigo-300">
              Track this as a session?
            </span>
          </div>
          <p className="text-gray-400 text-xs mb-2">
            Agent finished planning. Create a FlowMate session to track this work?
          </p>
          <p className="text-xs text-indigo-300 font-medium truncate" title={pending.name}>
            "{pending.name}"
          </p>
          {pending.cwd && (
            <p className="text-xs text-gray-600 truncate mt-0.5" title={pending.cwd}>
              {pending.cwd.split("/").slice(-2).join("/")}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleYes}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-semibold text-xs transition-colors text-white"
          >
            Yes, track it
          </button>
          <button
            onClick={handleNo}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors text-gray-300"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

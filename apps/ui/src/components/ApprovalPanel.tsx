import type { Session, ApprovalGate } from "@flowmate/shared";
import { approve } from "../api";

const GATE_INFO: Record<ApprovalGate, { title: string; description: string; color: string }> = {
  plan_approval: {
    title: "Plan Ready for Review",
    description: "The agent has finished planning and is waiting for your approval before building.",
    color: "yellow",
  },
  code_review: {
    title: "Code Review Complete",
    description: "Senior review findings are ready. Approve to continue or reject to request changes.",
    color: "orange",
  },
};

interface Props {
  session: Session;
  onApproved: () => void;
}

export function ApprovalPanel({ session, onApproved }: Props) {
  const gate = session.state.waitingFor;
  if (!gate) return null;

  const info = GATE_INFO[gate];
  const isYellow = info.color === "yellow";

  async function handleApprove() {
    await approve(session.meta.id);
    onApproved();
  }

  return (
    <div
      className={`mx-4 my-3 p-4 rounded-lg border ${
        isYellow
          ? "bg-yellow-950/40 border-yellow-600"
          : "bg-orange-950/40 border-orange-600"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                isYellow ? "bg-yellow-400" : "bg-orange-400"
              }`}
            />
            <span
              className={`font-semibold text-sm ${
                isYellow ? "text-yellow-300" : "text-orange-300"
              }`}
            >
              {info.title}
            </span>
          </div>
          <p className="text-gray-400 text-xs">{info.description}</p>
          {session.state.approvalData && (
            <pre className="mt-2 text-xs text-gray-300 bg-gray-900 rounded p-2 max-h-40 overflow-auto">
              {JSON.stringify(session.state.approvalData, null, 2)}
            </pre>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleApprove}
            className={`px-4 py-2 rounded font-semibold text-xs transition-colors ${
              isYellow
                ? "bg-yellow-600 hover:bg-yellow-500 text-black"
                : "bg-orange-600 hover:bg-orange-500 text-white"
            }`}
          >
            Approve
          </button>
          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

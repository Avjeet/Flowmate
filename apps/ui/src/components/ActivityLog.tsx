import type { HistoryEntry } from "@flowmate/shared";

const PHASE_BADGE: Record<string, string> = {
  IDLE: "bg-gray-700 text-gray-300",
  PLANNING: "bg-yellow-900 text-yellow-300",
  BUILDING: "bg-blue-900 text-blue-300",
  REVIEWING: "bg-orange-900 text-orange-300",
  FIX_COMMENTS: "bg-red-900 text-red-300",
  DONE: "bg-green-900 text-green-300",
};

interface Props {
  history: HistoryEntry[];
}

export function ActivityLog({ history }: Props) {
  const reversed = [...history].reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Activity Log
      </div>
      <div className="flex-1 overflow-auto px-4 py-2 space-y-2">
        {reversed.length === 0 && (
          <p className="text-gray-600 text-xs">No activity yet.</p>
        )}
        {reversed.map((entry, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-gray-600 text-xs shrink-0 pt-0.5">
              {new Date(entry.ts).toLocaleTimeString()}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                PHASE_BADGE[entry.phase] ?? "bg-gray-700 text-gray-300"
              }`}
            >
              {entry.phase}
            </span>
            <span className="text-gray-300 text-xs">{entry.event}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

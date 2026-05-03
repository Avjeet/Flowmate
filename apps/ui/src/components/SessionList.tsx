import type { Session, Phase } from "@flowmate/shared";

const PHASE_DOT: Record<Phase, string> = {
  IDLE: "bg-gray-500",
  PLANNING: "bg-yellow-400",
  BUILDING: "bg-blue-400",
  COMMITTING: "bg-indigo-400",
  REVIEWING: "bg-orange-400",
  FIX_COMMENTS: "bg-red-400",
  DONE: "bg-green-400",
};

interface Props {
  sessions: Session[];
  activeId?: string;
  onSelect: (session: Session) => void;
}

function groupByProject(sessions: Session[]): Record<string, Session[]> {
  const groups: Record<string, Session[]> = {};
  for (const s of sessions) {
    // Group key: gitlabRepo, or cwd basename, or "Other"
    let key = s.meta.gitlabRepo ?? "";
    if (!key && s.meta.cwd) {
      key = s.meta.cwd.split("/").filter(Boolean).pop() ?? "";
    }
    key = key || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return groups;
}

export function SessionList({ sessions, activeId, onSelect }: Props) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.meta.updatedAt).getTime() - new Date(a.meta.updatedAt).getTime()
  );
  const groups = groupByProject(sorted);
  const groupKeys = Object.keys(groups).sort((a, b) =>
    a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)
  );

  return (
    <div className="flex flex-col h-full border-r border-gray-800">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</span>
        <span className="text-xs text-gray-600">{sessions.length}</span>
      </div>

      <div className="flex-1 overflow-auto">
        {sessions.length === 0 && (
          <p className="text-gray-600 text-xs px-3 py-4">No sessions yet.</p>
        )}

        {groupKeys.map((project) => (
          <div key={project}>
            {/* Project group header */}
            {groupKeys.length > 1 && (
              <div className="px-3 py-1.5 bg-gray-900/80 border-b border-gray-800/50 sticky top-0">
                <span className="text-xs text-gray-600 truncate">{project}</span>
              </div>
            )}

            {groups[project].map((s) => (
              <div
                key={s.meta.id}
                onClick={() => onSelect(s)}
                className={`px-3 py-2.5 border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                  s.meta.id === activeId ? "bg-gray-800" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${PHASE_DOT[s.state.phase]}`} />
                  <span className="text-xs text-white truncate">{s.meta.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 pl-4">
                  {s.meta.jiraTicket && (
                    <span className="text-xs text-blue-500">{s.meta.jiraTicket}</span>
                  )}
                  <span className="text-xs text-gray-600 ml-auto">
                    {relativeTime(new Date(s.meta.updatedAt))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "now";
}

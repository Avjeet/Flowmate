import type { Phase } from "@flowmate/shared";

const PHASES: Phase[] = ["IDLE", "PLANNING", "BUILDING", "COMMITTING", "REVIEWING", "DONE"];

const PHASE_LABELS: Record<Phase, string> = {
  IDLE: "Idle",
  PLANNING: "Planning",
  BUILDING: "Building",
  COMMITTING: "Committing",
  REVIEWING: "Review",
  FIX_COMMENTS: "Fixing",
  DONE: "Done",
};

const PHASE_COLORS: Record<Phase, string> = {
  IDLE: "bg-gray-600",
  PLANNING: "bg-yellow-500",
  BUILDING: "bg-blue-500",
  COMMITTING: "bg-indigo-500",
  REVIEWING: "bg-orange-500",
  FIX_COMMENTS: "bg-red-500",
  DONE: "bg-green-500",
};

interface Props {
  currentPhase: Phase;
}

export function PhaseTimeline({ currentPhase }: Props) {
  const displayPhase = currentPhase === "FIX_COMMENTS" ? "REVIEWING" : currentPhase;
  const currentIdx = PHASES.indexOf(displayPhase);

  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-gray-900 border-b border-gray-800">
      {PHASES.map((phase, i) => {
        const isActive = phase === displayPhase;
        const isPast = i < currentIdx;

        return (
          <div key={phase} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full transition-all ${
                  isActive
                    ? `${PHASE_COLORS[currentPhase]} ring-2 ring-white/30 scale-125`
                    : isPast
                    ? "bg-green-700"
                    : "bg-gray-700"
                }`}
              />
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive ? "text-white font-semibold" : isPast ? "text-green-600" : "text-gray-600"
                }`}
              >
                {PHASE_LABELS[phase]}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`h-px w-8 mb-4 ${isPast ? "bg-green-700" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}

      {currentPhase === "FIX_COMMENTS" && (
        <div className="ml-4 flex items-center gap-2 px-3 py-1 bg-red-900/40 border border-red-700 rounded-full">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400">Fixing PR Comments</span>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@flowmate/shared";
import { getActiveSession, getSessions } from "./api";
import { useWebSocket } from "./useWebSocket";
import { SessionBar } from "./components/SessionBar";
import { PhaseTimeline } from "./components/PhaseTimeline";
import { ApprovalPanel } from "./components/ApprovalPanel";
import { ActivityLog } from "./components/ActivityLog";
import { SessionList } from "./components/SessionList";
import { NewSessionModal } from "./components/NewSessionModal";
import { GitLabPanel } from "./components/GitLabPanel";
import { GitHubPanel } from "./components/GitHubPanel";
import { JiraPanel } from "./components/JiraPanel";
import { ReviewPanel } from "./components/ReviewPanel";
import { PendingSessionBanner } from "./components/PendingSessionBanner";
import { ConnectorsModal } from "./components/ConnectorsModal";
import { GitDetectBanner } from "./components/GitDetectBanner";

type MainTab = "log" | "gitlab" | "github" | "jira" | "review";

export default function App() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [viewingSession, setViewingSession] = useState<Session | null>(null); // session in focus (may differ from active)
  const [showNewModal, setShowNewModal] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<MainTab>("log");
  const [pendingSession, setPendingSession] = useState<any>(null);

  const refresh = useCallback(async () => {
    const [active, all] = await Promise.all([getActiveSession(), getSessions()]);
    setActiveSession(active);
    setAllSessions(all);
    // Keep viewing session in sync if it's the active one
    setViewingSession((prev) => {
      if (!prev || prev.meta.id === active?.meta.id) return active;
      // Refresh the viewing session from the updated list
      return all.find((s: Session) => s.meta.id === prev.meta.id) ?? active;
    });
  }, []);

  const checkPending = useCallback(async () => {
    try {
      const r = await fetch(`http://localhost:${import.meta.env.VITE_SERVER_PORT ?? 7842}/api/sessions/pending-create`);
      const data = await r.json();
      setPendingSession(data);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    checkPending();
  }, [refresh, checkPending]);

  // Auto-switch to review tab when phase enters REVIEWING
  useEffect(() => {
    if (viewingSession?.state.phase === "REVIEWING" || viewingSession?.state.phase === "FIX_COMMENTS") {
      setTab("review");
    }
  }, [viewingSession?.state.phase]);

  useWebSocket((msg: any) => {
    if (msg.type === "connected") {
      setConnected(true);
      refresh();
      checkPending();
      return;
    }
    if (msg.type === "pending_session") {
      setPendingSession(msg.payload);
      return;
    }
    if (msg.type === "pending_session_dismissed") {
      setPendingSession(null);
      return;
    }
    if (["session_update", "approval_required", "approval_cleared", "event"].includes(msg.type)) {
      refresh();
    }
  });

  const displayed = viewingSession ?? activeSession;
  const isReviewing = displayed?.state.phase === "REVIEWING" || displayed?.state.phase === "FIX_COMMENTS";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <SessionBar
        session={activeSession}
        onUpdate={refresh}
        onNewSession={() => setShowNewModal(true)}
        onOpenConnectors={() => setShowConnectors(true)}
      />

      {/* Connection indicator */}
      <div className="absolute top-2.5 right-36 flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-red-500 animate-pulse"}`} />
        <span className="text-xs text-gray-600">{connected ? "live" : "connecting…"}</span>
      </div>

      {/* Phase timeline */}
      {displayed && <PhaseTimeline currentPhase={displayed.state.phase} />}

      {/* Approval panel */}
      {activeSession?.state.waitingFor && (
        <ApprovalPanel session={activeSession} onApproved={refresh} />
      )}

      {/* Git repo auto-detection */}
      {activeSession && !pendingSession && (
        <GitDetectBanner session={activeSession} onLinked={refresh} />
      )}

      {/* Pending session creation request */}
      {pendingSession && (
        <PendingSessionBanner
          pending={pendingSession}
          onDecision={() => { setPendingSession(null); refresh(); }}
        />
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: global sessions list */}
        <div className="w-44 shrink-0">
          <SessionList
            sessions={allSessions}
            activeId={displayed?.meta.id}
            onSelect={(s) => {
              setViewingSession(s);
              // Auto-select right tab based on phase
              if (s.state.phase === "REVIEWING" || s.state.phase === "FIX_COMMENTS") {
                setTab("review");
              } else {
                setTab("log");
              }
            }}
          />
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {displayed ? (
            <>
              {/* Tab bar */}
              <div className="flex border-b border-gray-800 bg-gray-900/50">
                {(["log", ...(isReviewing ? ["review"] : []), "gitlab", "github", "jira"] as MainTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      tab === t
                        ? "text-white border-blue-500"
                        : "text-gray-500 border-transparent hover:text-gray-300"
                    }`}
                  >
                    {t === "log" && "Activity Log"}
                    {t === "review" && (
                      <span className="flex items-center gap-1.5">
                        Review
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      </span>
                    )}
                    {t === "gitlab" && (
                      <span className="flex items-center gap-1.5">
                        GitLab
                        {displayed.meta.gitlabMR && (
                          <span className="px-1.5 py-0.5 bg-orange-900/50 text-orange-400 rounded text-xs">
                            !{displayed.meta.gitlabMR}
                          </span>
                        )}
                      </span>
                    )}
                    {t === "github" && (
                      <span className="flex items-center gap-1.5">
                        GitHub
                        {displayed.meta.githubPR && (
                          <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">
                            #{displayed.meta.githubPR}
                          </span>
                        )}
                      </span>
                    )}
                    {t === "jira" && (
                      <span className="flex items-center gap-1.5">
                        Jira
                        {displayed.meta.jiraTicket && (
                          <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-400 rounded text-xs">
                            {displayed.meta.jiraTicket}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {tab === "log" && <ActivityLog history={displayed.history} />}
                {tab === "review" && <ReviewPanel session={displayed} onDone={refresh} />}
                {tab === "gitlab" && <GitLabPanel session={displayed} />}
                {tab === "github" && <GitHubPanel session={displayed} />}
                {tab === "jira" && <JiraPanel session={displayed} />}
              </div>
            </>
          ) : (
            <EmptyState onNew={() => setShowNewModal(true)} />
          )}
        </div>
      </div>

      {showNewModal && (
        <NewSessionModal
          onCreated={() => { setShowNewModal(false); refresh(); }}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {showConnectors && (
        <ConnectorsModal onClose={() => setShowConnectors(false)} />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="text-4xl">⚡</div>
      <div>
        <p className="text-white font-semibold mb-1">No active session</p>
        <p className="text-gray-500 text-xs max-w-xs">
          Start a session to track your dev workflow — or start a Claude Code / OpenCode session and FlowMate will detect it automatically.
        </p>
      </div>
      <button
        onClick={onNew}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold transition-colors"
      >
        + Start Session
      </button>
    </div>
  );
}

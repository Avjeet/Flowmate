export type Phase =
  | "IDLE"
  | "PLANNING"
  | "BUILDING"
  | "COMMITTING"
  | "REVIEWING"
  | "FIX_COMMENTS"
  | "DONE";

export type ApprovalGate = "plan_approval" | "code_review";

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // JIRA
  jiraTicket?: string;         // e.g. "PROJ-42"
  jiraProjectKey?: string;     // e.g. "PROJ"
  jiraTicketUrl?: string;      // full URL to JIRA story
  // GitLab / GitHub
  gitlabRepo?: string;         // e.g. "org/repo"
  gitlabMR?: string;           // MR IID, populated at session creation
  gitlabMRUrl?: string;        // full URL, populated after commit+push
  githubRepo?: string;         // e.g. "owner/repo"
  githubPR?: number;           // PR number, populated after commit+push
  githubPRUrl?: string;        // full URL, populated after commit+push
  // Agent
  agentType: "claude" | "opencode" | "unknown";
  // Working directory at session start
  cwd?: string;
}

export interface SessionState {
  phase: Phase;
  waitingFor?: ApprovalGate;
  approvalData?: Record<string, unknown>;
  lastEventAt: string;
}

export interface HistoryEntry {
  ts: string;
  phase: Phase;
  event: string;
  data?: Record<string, unknown>;
}

export interface Session {
  meta: SessionMeta;
  state: SessionState;
  history: HistoryEntry[];
}

export interface IntegrationConfig {
  gitlab?: {
    host: string;
    token: string;
  };
  jira?: {
    host: string;
    token: string;
    email: string;
  };
  github?: {
    token: string;
  };
}

export interface FlowMateConfig {
  port: number;
  integrations: IntegrationConfig;
}

export interface WsMessage {
  type: "session_update" | "event" | "approval_required" | "approval_cleared";
  sessionId: string;
  payload: unknown;
}

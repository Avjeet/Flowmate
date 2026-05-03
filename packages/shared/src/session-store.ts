import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import type { Session, SessionMeta, SessionState, HistoryEntry, Phase } from "./types";

const FLOWMATE_DIR = join(process.env.HOME ?? "~", ".flowmate");
const SESSIONS_DIR = join(FLOWMATE_DIR, "sessions");

export function ensureDirs() {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

export function sessionDir(id: string) {
  return join(SESSIONS_DIR, id);
}

export function readSession(id: string): Session | null {
  const dir = sessionDir(id);
  if (!existsSync(dir)) return null;

  const meta: SessionMeta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  const state: SessionState = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  const history: HistoryEntry[] = existsSync(join(dir, "history.json"))
    ? JSON.parse(readFileSync(join(dir, "history.json"), "utf8"))
    : [];

  return { meta, state, history };
}

export function writeSession(session: Session) {
  const dir = sessionDir(session.meta.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "meta.json"), JSON.stringify(session.meta, null, 2));
  writeFileSync(join(dir, "state.json"), JSON.stringify(session.state, null, 2));
  writeFileSync(join(dir, "history.json"), JSON.stringify(session.history, null, 2));
}

export function createSession(meta: Omit<SessionMeta, "createdAt" | "updatedAt">): Session {
  const now = new Date().toISOString();
  const session: Session = {
    meta: { ...meta, createdAt: now, updatedAt: now },
    state: { phase: "IDLE", lastEventAt: now },
    history: [{ ts: now, phase: "IDLE", event: "session_created" }],
  };
  writeSession(session);
  return session;
}

export function transitionPhase(id: string, phase: Phase, event: string, data?: Record<string, unknown>): Session | null {
  const session = readSession(id);
  if (!session) return null;

  const now = new Date().toISOString();
  session.state.phase = phase;
  session.state.lastEventAt = now;
  session.meta.updatedAt = now;
  if (phase !== "PLANNING" && phase !== "REVIEWING") {
    delete session.state.waitingFor;
    delete session.state.approvalData;
  }
  session.history.push({ ts: now, phase, event, data });
  writeSession(session);
  return session;
}

export function setApprovalGate(id: string, gate: Session["state"]["waitingFor"], data?: Record<string, unknown>): Session | null {
  const session = readSession(id);
  if (!session) return null;

  const now = new Date().toISOString();
  session.state.waitingFor = gate;
  session.state.approvalData = data;
  session.meta.updatedAt = now;
  writeSession(session);
  return session;
}

export function clearApprovalGate(id: string): Session | null {
  const session = readSession(id);
  if (!session) return null;

  delete session.state.waitingFor;
  delete session.state.approvalData;
  session.meta.updatedAt = new Date().toISOString();
  writeSession(session);
  return session;
}

export function listSessions(): Session[] {
  ensureDirs();
  const dirs = readdirSync(SESSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  return dirs
    .map((id: string) => readSession(id))
    .filter(Boolean) as Session[];
}

export function getActiveSession(): Session | null {
  const activePath = join(SESSIONS_DIR, "active");
  if (!existsSync(activePath)) return null;
  const id = readFileSync(activePath, "utf8").trim();
  return readSession(id);
}

export function setActiveSession(id: string) {
  const activePath = join(SESSIONS_DIR, "active");
  writeFileSync(activePath, id);
}

export function clearActiveSession() {
  const activePath = join(SESSIONS_DIR, "active");
  if (existsSync(activePath)) {
    unlinkSync(activePath);
  }
}

export function readConfig() {
  const configPath = join(FLOWMATE_DIR, "config.json");
  if (!existsSync(configPath)) {
    return { port: 7842, integrations: {} };
  }
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function writeConfig(config: object) {
  mkdirSync(FLOWMATE_DIR, { recursive: true });
  const configPath = join(FLOWMATE_DIR, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

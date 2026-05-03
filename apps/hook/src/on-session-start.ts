#!/usr/bin/env bun
/**
 * UserPromptSubmit hook — fires on every user message.
 *
 * Does NOT create a session. Only:
 *  1. Ensures the FlowMate server is running
 *  2. Saves the prompt to a pending file so on-pre-tool can use it
 *     when ExitPlanMode fires (that's when we actually create a session)
 */

import { writeFileSync, mkdirSync } from "node:fs";

const FLOWMATE_DIR = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
const SERVER_PORT = Number(process.env.FLOWMATE_PORT ?? 7842);
const UI_PORT = Number(process.env.FLOWMATE_UI_PORT ?? 7843);
const BASE = `http://localhost:${SERVER_PORT}/api`;
const LOG_DIR = `${process.env.HOME}/.flowmate/logs`;
const PENDING_PROMPT_FILE = `${process.env.HOME}/.flowmate/pending-prompt.json`;

// ── parse hook input ───────────────────────────────────────────────────────────
let hookData: { prompt?: string; session_id?: string } = {};
try {
  const raw = await Bun.stdin.text();
  hookData = JSON.parse(raw);
} catch {}

const rawPrompt: string = hookData.prompt ?? "";
if (!rawPrompt.trim() || process.env.FLOWMATE_DISABLED === "1") {
  process.exit(0);
}

// ── ensure server is running ───────────────────────────────────────────────────
async function isServerRunning(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/sessions`, { signal: AbortSignal.timeout(1000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

if (!(await isServerRunning())) {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}
  Bun.spawn(
    [process.execPath, `${FLOWMATE_DIR}/apps/server/src/index.ts`],
    {
      stdout: Bun.file(`${LOG_DIR}/server.log`),
      stderr: Bun.file(`${LOG_DIR}/server.log`),
      detached: true,
    }
  );
  for (let i = 0; i < 8; i++) {
    await Bun.sleep(500);
    if (await isServerRunning()) break;
  }
}

// ── ensure UI is running ───────────────────────────────────────────────────────
const uiAlive = await fetch(`http://localhost:${UI_PORT}`, { signal: AbortSignal.timeout(500) }).catch(() => null);
if (!uiAlive) {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}
  Bun.spawn(
    [process.execPath, "run", "--cwd", `${FLOWMATE_DIR}/apps/ui`, "dev", "--port", String(UI_PORT)],
    {
      stdout: Bun.file(`${LOG_DIR}/ui.log`),
      stderr: Bun.file(`${LOG_DIR}/ui.log`),
      detached: true,
    }
  );
}

// ── save prompt for when ExitPlanMode fires ────────────────────────────────────
// Only save if there's no active session (don't overwrite an in-progress task)
let hasActiveSession = false;
try {
  const r = await fetch(`${BASE}/sessions/active`, { signal: AbortSignal.timeout(1000) });
  const s = await r.json();
  hasActiveSession = !!s?.meta?.id;
} catch {}

if (!hasActiveSession) {
  try {
    mkdirSync(`${process.env.HOME}/.flowmate`, { recursive: true });
    writeFileSync(PENDING_PROMPT_FILE, JSON.stringify({
      prompt: rawPrompt,
      cwd: process.cwd(),
      agentType: process.env.CLAUDE_CODE_ENTRYPOINT ? "claude" : process.env.OPENCODE_SESSION ? "opencode" : "unknown",
      savedAt: new Date().toISOString(),
    }));
  } catch {}
}

process.exit(0);

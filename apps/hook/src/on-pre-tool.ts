#!/usr/bin/env bun
/**
 * PreToolUse hook — fires before any tool call.
 *
 * ExitPlanMode: NEVER blocks — just posts a "Track this?" banner to the
 * dashboard so the user can optionally create a session. Plan mode always
 * exits normally so other hooks (plannotator, etc.) can run unimpeded.
 */

import { getActiveSession, apiPost } from "./client";
import { readFileSync, rmSync } from "node:fs";

const SERVER_PORT = Number(process.env.FLOWMATE_PORT ?? 7842);
const BASE = `http://localhost:${SERVER_PORT}/api`;
const PENDING_PROMPT_FILE = `${process.env.HOME}/.flowmate/pending-prompt.json`;

const input = await Bun.stdin.text();
let hookData: any = {};
try { hookData = JSON.parse(input); } catch {}

const toolName: string = hookData.tool_name ?? hookData.tool ?? "";

async function serverAlive(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/sessions/active`, { signal: AbortSignal.timeout(800) });
    return r.ok || r.status < 500;
  } catch {
    return false;
  }
}

if (!(await serverAlive())) process.exit(0);

// ── ExitPlanMode: notify dashboard, never block ────────────────────────────────
if (toolName === "ExitPlanMode") {
  const session = await getActiveSession();

  if (session?.meta?.id) {
    // Active session — update phase to BUILDING (plan is done, building begins)
    const phase = session.state.phase;
    if (phase === "PLANNING" || phase === "IDLE") {
      await apiPost(`/sessions/${session.meta.id}/event`, {
        phase: "BUILDING",
        event: "plan_completed",
      });
    }
    // Always allow through
    process.exit(0);
  }

  // No active session — post "Track this?" banner to dashboard (fire-and-forget)
  // Then immediately allow ExitPlanMode through so plannotator and other hooks run.
  let promptFileExists = false;
  try { readFileSync(PENDING_PROMPT_FILE); promptFileExists = true; } catch {}

  if (promptFileExists) {
    let name = "Untitled Task";
    let cwd = process.cwd();
    let agentType = "unknown";
    let prompt = "";

    try {
      const pending = JSON.parse(readFileSync(PENDING_PROMPT_FILE, "utf8"));
      prompt = pending.prompt ?? "";
      const first = prompt.split(/[.!?\n]/)[0].trim();
      name = (first.length > 6 ? first : prompt).slice(0, 80);
      cwd = pending.cwd ?? cwd;
      agentType = pending.agentType ?? agentType;
    } catch {}

    // Remove pending prompt file (consumed)
    try { rmSync(PENDING_PROMPT_FILE); } catch {}

    // Post banner — don't await, don't block
    apiPost(`/sessions/pending-create`, { name, prompt, cwd, agentType }).catch(() => {});
  }

  // Allow ExitPlanMode through unconditionally
  process.exit(0);
}

// ── Infer BUILDING from file writes (only if session exists and in IDLE) ──────
const writeTools = new Set(["Write", "Edit", "MultiEdit"]);
if (writeTools.has(toolName)) {
  const session = await getActiveSession();
  if (session?.state.phase === "IDLE" && !session?.state.waitingFor) {
    await apiPost(`/sessions/${session.meta.id}/event`, { phase: "BUILDING", event: "coding_started" });
  }
}

process.exit(0);

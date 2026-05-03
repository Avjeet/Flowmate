#!/usr/bin/env bun
/**
 * flowmate CLI
 *
 * Usage:
 *   flowmate new [task name]   — create a new session
 *   flowmate status            — show active session
 *   flowmate open              — open the dashboard
 *   flowmate done              — mark active session as done
 *   flowmate clear             — clear active session pointer
 */

import { spawnSync } from "child_process";

const SERVER_PORT = Number(process.env.FLOWMATE_PORT ?? 7842);
const UI_PORT = Number(process.env.FLOWMATE_UI_PORT ?? 7843);
const BASE = `http://localhost:${SERVER_PORT}/api`;
const FLOWMATE_DIR = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const LOG_DIR = `${process.env.HOME}/.flowmate/logs`;

const [, , command, ...rest] = process.argv;

async function isServerRunning() {
  try {
    const r = await fetch(`${BASE}/sessions`, { signal: AbortSignal.timeout(1000) });
    return r.status < 500;
  } catch { return false; }
}

async function ensureServer() {
  if (await isServerRunning()) return;
  console.log("Starting FlowMate server...");
  import("node:fs").then(fs => fs.mkdirSync(LOG_DIR, { recursive: true })).catch(() => {});
  Bun.spawn(
    [process.execPath, `${FLOWMATE_DIR}/apps/server/src/index.ts`],
    { stdout: Bun.file(`${LOG_DIR}/server.log`), stderr: Bun.file(`${LOG_DIR}/server.log`), detached: true }
  );
  for (let i = 0; i < 8; i++) {
    await Bun.sleep(500);
    if (await isServerRunning()) break;
  }
}

async function ensureUI() {
  const alive = await fetch(`http://localhost:${UI_PORT}`, { signal: AbortSignal.timeout(500) }).catch(() => null);
  if (!alive) {
    console.log("Starting FlowMate dashboard...");
    import("node:fs").then(fs => fs.mkdirSync(LOG_DIR, { recursive: true })).catch(() => {});
    Bun.spawn(
      [process.execPath, "run", "--cwd", `${FLOWMATE_DIR}/apps/ui`, "dev", "--port", String(UI_PORT)],
      { stdout: Bun.file(`${LOG_DIR}/ui.log`), stderr: Bun.file(`${LOG_DIR}/ui.log`), detached: true }
    );
    await Bun.sleep(2000);
  }
}

async function getActive() {
  try {
    const r = await fetch(`${BASE}/sessions/active`, { signal: AbortSignal.timeout(2000) });
    return await r.json();
  } catch { return null; }
}

// ── commands ───────────────────────────────────────────────────────────────────

if (!command || command === "help") {
  console.log(`
FlowMate — session tracker for AI coding agents

  flowmate new [task name]   Create a new session
  flowmate status            Show active session
  flowmate open              Open the dashboard
  flowmate done              Mark active session as done
  flowmate clear             Clear active session pointer
`);
  process.exit(0);
}

if (command === "open") {
  await ensureServer();
  await ensureUI();
  spawnSync("open", [`http://localhost:${UI_PORT}`]);
  console.log(`Dashboard: http://localhost:${UI_PORT}`);
  process.exit(0);
}

if (command === "status") {
  await ensureServer();
  const s = await getActive();
  if (!s?.meta?.id) {
    console.log("No active session.");
  } else {
    console.log(`Session:  ${s.meta.name}`);
    console.log(`Phase:    ${s.state.phase}`);
    console.log(`ID:       ${s.meta.id}`);
    if (s.meta.jiraTicket) console.log(`Jira:     ${s.meta.jiraTicket}`);
    if (s.meta.gitlabMRUrl) console.log(`MR:       ${s.meta.gitlabMRUrl}`);
  }
  process.exit(0);
}

if (command === "done") {
  await ensureServer();
  const s = await getActive();
  if (!s?.meta?.id) { console.log("No active session."); process.exit(1); }
  await fetch(`${BASE}/sessions/${s.meta.id}/end`, { method: "POST" });
  console.log(`✓ Session "${s.meta.name}" marked as done.`);
  process.exit(0);
}

if (command === "clear") {
  try {
    import("node:fs").then(fs => fs.rmSync(`${process.env.HOME}/.flowmate/sessions/active`, { force: true }));
  } catch {}
  console.log("Active session cleared.");
  process.exit(0);
}

if (command === "new") {
  await ensureServer();

  // Get task name from args or prompt
  let name = rest.join(" ").trim();
  if (!name) {
    process.stdout.write("Task name: ");
    const buf = Buffer.alloc(256);
    const n = require("fs").readSync(0, buf, 0, 256, null);
    name = buf.slice(0, n).toString().trim();
  }
  if (!name) { console.error("Task name required."); process.exit(1); }

  const r = await fetch(`${BASE}/sessions/cold-start/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      prompt: name,
      agentType: "unknown",
      cwd: process.cwd(),
    }),
    signal: AbortSignal.timeout(8000),
  });
  const session = await r.json();

  if (!session?.meta?.id) {
    console.error("Failed to create session.");
    process.exit(1);
  }

  // Set to PLANNING
  await fetch(`${BASE}/sessions/${session.meta.id}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: "PLANNING", event: "manual_start" }),
  });

  console.log(`✓ Session created: "${session.meta.name}"`);
  console.log(`  Phase:  PLANNING`);
  console.log(`  ID:     ${session.meta.id}`);

  await ensureUI();
  spawnSync("open", [`http://localhost:${UI_PORT}`]);
  console.log(`  Dashboard: http://localhost:${UI_PORT}`);
  process.exit(0);
}

console.error(`Unknown command: ${command}. Run 'flowmate help' for usage.`);
process.exit(1);

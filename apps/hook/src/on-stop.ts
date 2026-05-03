#!/usr/bin/env bun
/**
 * Stop hook — fires when the agent session ends.
 * Marks the FlowMate session as DONE.
 */
import { getActiveSession, apiPost } from "./client";

const session = await getActiveSession();
if (!session) process.exit(0);

const id: string = session.meta.id;

// Only auto-close if actively building/reviewing — not if still planning or idle
const activePhases = ["BUILDING", "COMMITTING", "REVIEWING", "FIX_COMMENTS"];
if (activePhases.includes(session.state.phase)) {
  await apiPost(`/sessions/${id}/end`, {});
  process.stderr.write("\x1b[36m[FlowMate] Session marked complete.\x1b[0m\n");
}

process.exit(0);

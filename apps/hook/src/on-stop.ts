#!/usr/bin/env bun
/**
 * Stop hook — fires when the agent finishes a response.
 *
 * We do NOT auto-mark sessions as DONE here because the Stop hook fires after
 * every single agent reply, not just when the user is truly finished with the
 * task. DONE must be triggered explicitly via:
 *   - "Mark as Done" / "End Session" buttons in the dashboard
 *   - `flowmate done` CLI
 */

process.exit(0);

#!/bin/bash
# FlowMate — start server + UI dashboard
# Usage: ./start.sh [--no-open]

set -e

FLOWMATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUN="${HOME}/.bun/bin/bun"
SERVER_PORT="${FLOWMATE_PORT:-7842}"
UI_PORT="${FLOWMATE_UI_PORT:-7843}"
LOG_DIR="${HOME}/.flowmate/logs"
SERVER_PID_FILE="${HOME}/.flowmate/server.pid"
UI_PID_FILE="${HOME}/.flowmate/ui.pid"

mkdir -p "$LOG_DIR"

# ── helpers ────────────────────────────────────────────────────────────────────
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

check_bun() {
  if [ ! -x "$BUN" ]; then
    red "Bun not found at $BUN"
    echo "Install it: curl -fsSL https://bun.sh/install | bash"
    exit 1
  fi
}

kill_if_running() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
    rm -f "$pid_file"
  fi
}

wait_for_port() {
  local port="$1" tries=0
  while ! curl -s -o /dev/null "http://localhost:${port}" 2>/dev/null; do
    sleep 0.5
    tries=$((tries + 1))
    if [ $tries -ge 20 ]; then return 1; fi
  done
}

# ── stop command ───────────────────────────────────────────────────────────────
if [ "$1" = "stop" ]; then
  yellow "Stopping FlowMate…"
  kill_if_running "$SERVER_PID_FILE"
  kill_if_running "$UI_PID_FILE"
  green "FlowMate stopped."
  exit 0
fi

# ── status command ─────────────────────────────────────────────────────────────
if [ "$1" = "status" ]; then
  if curl -s -o /dev/null http://localhost:${SERVER_PORT}/api/sessions 2>/dev/null; then
    green "FlowMate is running"
    echo "  Server  : http://localhost:${SERVER_PORT}"
    echo "  Dashboard: http://localhost:${UI_PORT}"
  else
    yellow "FlowMate is not running"
    echo "  Run: flowmate (or ./start.sh)"
  fi
  exit 0
fi

# ── start ──────────────────────────────────────────────────────────────────────
check_bun

# Stop any existing instances
kill_if_running "$SERVER_PID_FILE"
kill_if_running "$UI_PID_FILE"

echo ""
green "Starting FlowMate…"

# Start server
"$BUN" run "$FLOWMATE_DIR/apps/server/src/index.ts" \
  >> "$LOG_DIR/server.log" 2>&1 &
echo $! > "$SERVER_PID_FILE"

# Wait for server
printf "  Server   "
if wait_for_port $SERVER_PORT; then
  green "✓ http://localhost:${SERVER_PORT}"
else
  red "✗ Server failed to start (check $LOG_DIR/server.log)"
  exit 1
fi

# Start UI
FLOWMATE_PORT=$SERVER_PORT \
  "$BUN" run --cwd "$FLOWMATE_DIR/apps/ui" dev --port $UI_PORT \
  >> "$LOG_DIR/ui.log" 2>&1 &
echo $! > "$UI_PID_FILE"

printf "  Dashboard"
if wait_for_port $UI_PORT; then
  green "✓ http://localhost:${UI_PORT}"
else
  red "✗ UI failed to start (check $LOG_DIR/ui.log)"
fi

echo ""
echo "  Logs: $LOG_DIR"
echo "  Stop: flowmate stop   (or ./start.sh stop)"
echo ""

# Open browser unless --no-open
if [ "$1" != "--no-open" ]; then
  open "http://localhost:${UI_PORT}" 2>/dev/null || true
fi

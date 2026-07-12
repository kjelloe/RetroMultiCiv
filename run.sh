#!/usr/bin/env bash
# Start (or restart) the RetroMultiCiv Node server — static hosting + the
# phase-3 authoritative WebSocket game (server/index.js).
#   ./run.sh                serve on port 8123
#   ./run.sh 9000           serve on another port
#   ./run.sh 8123 --seed 42 --civs 4        extra args go to the server
#   ./run.sh 8123 --game saves/g42.json     resume a saved server game
set -euo pipefail
cd "$(dirname "$0")"

PORT="${1:-8123}"
[ $# -ge 1 ] && shift

# stop whichever previous server holds the port (old python static or node)
if pkill -f "http\.server $PORT" 2>/dev/null; then
  echo "stopped previous static server on port $PORT"
  sleep 0.5
fi
if pkill -f "node server/index\.js --port $PORT" 2>/dev/null; then
  echo "stopped previous game server on port $PORT"
  sleep 0.5
fi

nohup node server/index.js --port "$PORT" "$@" > /tmp/multiciv-server.log 2>&1 &
PID=$!
sleep 0.5
if ! kill -0 "$PID" 2>/dev/null; then
  echo "server failed to start — last log lines:" >&2
  tail -5 /tmp/multiciv-server.log >&2
  exit 1
fi

echo "RetroMultiCiv server running (pid $PID, log /tmp/multiciv-server.log)"
echo
echo "  play (local engine, hotseat OK):  http://localhost:$PORT/client/"
echo "  play THROUGH the server:          http://localhost:$PORT/client/?server=1"
echo "  diagnostics HUD: ?diag=1 · fixed world: ?seed=12345 · setup: bare URL"
echo "  soak telemetry:  http://localhost:$PORT/debugging/stats.html"

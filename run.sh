#!/usr/bin/env bash
# Start (or restart) the RetroMultiCiv Node server — static hosting + the
# phase-3 authoritative WebSocket game (server/index.js).
#   ./run.sh                serve on port 8123
#   ./run.sh 9000           serve on another port
#   ./run.sh 8123 --seed 42 --civs 4        extra args go to the server
#   ./run.sh 8123 --game saves/g42.json     resume a saved server game
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'HELP'
usage: ./run.sh [PORT] [server args...]

  PORT                first argument, default 8123

server args (passed to node server/index.js):
  --seed N            world seed (default: random)
  --civs N            civilizations 2..7 (default 2)
  --humans N          human seats (default 1; server games are 1 human
                      until phase 4 — hotseat plays LOCAL, without ?server=1)
  --size S            xsmall|small|medium|large|xlarge|huge (default medium)
  --game FILE         resume a server save (e.g. saves/g42.json)
  --reset-seats       with --game: drop seat-token bindings so joiners take
                      seats fresh (needed when resuming on a DIFFERENT port
                      or browser — tokens live in per-origin localStorage)
  --no-save           disable the autosave after each accepted command

examples:
  ./run.sh                          # port 8123, fresh random game
  ./run.sh 9000 --seed 42 --civs 4
  ./run.sh 8123 --game saves/g672813.json   # resume + keep autosaving there

after start:  play locally at /client/ · through the server at /client/?server=1
verify a server game:  node tools/replay.js saves/<gameId>.json
HELP
  exit 0
fi

# first arg is the port ONLY if numeric — `./run.sh --humans 2` must not
# swallow a flag as the port (a real user hit exactly that)
case "${1:-}" in
  ''|*[!0-9]*) PORT=8123 ;;
  *) PORT="$1"; shift ;;
esac

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
  echo "server failed to start:" >&2
  # the friendly reason is on a 'cannot start:' line; fall back to the tail
  grep "^cannot start:" /tmp/multiciv-server.log >&2 || tail -10 /tmp/multiciv-server.log >&2
  exit 1
fi

echo "RetroMultiCiv server running (pid $PID, log /tmp/multiciv-server.log)"
echo
echo "  play (local engine, hotseat OK):  http://localhost:$PORT/client/"
echo "  play THROUGH the server:          http://localhost:$PORT/client/?server=1"
echo "  diagnostics HUD: ?diag=1 · fixed world: ?seed=12345 · setup: bare URL"
echo "  soak telemetry:  http://localhost:$PORT/debugging/stats.html"

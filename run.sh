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
  --civs N            civilizations 2..14, capped by map size (default 2)
  --humans N          human seats (default 1; server games are 1 human
                      until phase 4 — hotseat plays LOCAL, without ?server=1)
  --size S            xsmall|small|medium|large|xlarge|huge (default medium)
  --game FILE         resume a server save (e.g. saves/g42.json)
  --reset-seats       with --game: drop seat-token bindings so joiners take
                      seats fresh (needed when resuming on a DIFFERENT port
                      or browser — tokens live in per-origin localStorage)
  --no-save           disable the autosave after each accepted command
  --host IP           bind address (default 0.0.0.0 = reachable on the LAN)

examples:
  ./run.sh                          # port 8123, fresh random game
  ./run.sh 9000 --seed 42 --civs 4
  ./run.sh 8123 --game saves/g672813.json   # resume + keep autosaving there

after start:  play locally at /client/ · through the server at /client/?server=1
verify a server game:  node tools/replay.js saves/<gameId>.json
HELP
  exit 0
fi

# prerequisites: node runs the server, ws is its one dependency
if ! command -v node >/dev/null 2>&1; then
  echo "node is required but not installed. Install it first:" >&2
  echo "  Ubuntu/Debian/WSL:  sudo apt-get update && sudo apt-get install -y nodejs npm" >&2
  echo "  any platform:       https://nodejs.org (pick the LTS)" >&2
  exit 1
fi
if [ ! -d node_modules/ws ]; then
  echo "dependencies missing (node_modules/ws) — from the repo root run:" >&2
  echo "  npm ci" >&2
  exit 1
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
# Liveness VERDICT, not a fixed-delay sample (B7): under load a broken server
# can be too slow to crash for a 0.5s check and a healthy one too slow to
# listen — poll until the process dies (failure), OUR pid listens on the port
# (success; a squatter on the port doesn't count), or the window runs out
# (report the uncertainty honestly, never kill a slow healthy server).
WINDOW="${MULTICIV_BOOT_WINDOW:-3}"
VERDICT=""
for _ in $(seq 1 $((WINDOW * 10))); do
  if ! kill -0 "$PID" 2>/dev/null; then VERDICT=dead; break; fi
  if ss -ltnp 2>/dev/null | grep -q "pid=$PID,"; then VERDICT=up; break; fi
  sleep 0.1
done
if [ -z "$VERDICT" ]; then
  echo "server (pid $PID) is alive but not listening after ${WINDOW}s — slow start, or check --host" >&2
  echo "  watch it:  tail -f /tmp/multiciv-server.log" >&2
fi
if [ "$VERDICT" = "dead" ]; then
  echo "server failed to start:" >&2
  # the reason sits ABOVE the stack trace: the friendly 'cannot start:' line
  # or node's module-resolution message — a bare tail showed a real user ten
  # stack frames and no module name
  grep -E -m 3 "^cannot start:|Cannot find (module|package)|^[A-Za-z]*Error" /tmp/multiciv-server.log >&2 \
    || tail -20 /tmp/multiciv-server.log >&2
  if grep -q "ERR_MODULE_NOT_FOUND" /tmp/multiciv-server.log; then
    echo "a file or package is missing — the clone may be stale or dependencies incomplete; from the repo root try:" >&2
    echo "  git pull && npm ci" >&2
  fi
  exit 1
fi

echo "RetroMultiCiv server running (pid $PID, log /tmp/multiciv-server.log)"
echo
echo "  play (local engine, hotseat OK):  http://localhost:$PORT/client/"
echo "  play THROUGH the server:          http://localhost:$PORT/client/?server=1"
echo "  diagnostics HUD: ?diag=1 · fixed world: ?seed=12345 · setup: bare URL"
echo "  soak telemetry:  http://localhost:$PORT/debugging/stats.html"
LANIP=$(hostname -I 2>/dev/null | awk '{print $1}')
if grep -qi microsoft /proc/version 2>/dev/null; then
  # WSL host: the Windows firewall (and under NAT, a portproxy) must let the
  # LAN in — print the exact commands so the host just pastes them.
  NETMODE=$(wslinfo --networking-mode 2>/dev/null || echo nat)
  if [ "$NETMODE" = "mirrored" ]; then
    [ -n "$LANIP" ] && echo "  LAN players:     http://$LANIP:$PORT/client/"
    echo
    echo "  WSL2 (mirrored networking) — once, in an ADMIN PowerShell on Windows:"
    echo "    netsh advfirewall firewall add rule name=\"RetroMultiCiv $PORT\" dir=in action=allow protocol=TCP localport=$PORT"
  else
    # NAT mode: $LANIP is WSL-internal — LAN players need the WINDOWS IP.
    WINIP=$(timeout 3 powershell.exe -NoProfile -Command \
      '(Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -ne $null}).IPv4Address.IPAddress' \
      2>/dev/null | tr -d '\r' | head -1 || true)
    echo "  LAN players:     http://${WINIP:-<windows-ip: ipconfig -> IPv4>}:$PORT/client/"
    echo
    echo "  WSL2 (NAT networking) — once, in an ADMIN PowerShell on Windows:"
    echo "    netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$PORT connectaddress=$LANIP connectport=$PORT"
    echo "    netsh advfirewall firewall add rule name=\"RetroMultiCiv $PORT\" dir=in action=allow protocol=TCP localport=$PORT"
    echo "  (the WSL address changes across reboots — if players stop reaching you"
    echo "   after a restart, refresh the proxy: delete then re-run ./run.sh for the"
    echo "   current add-line:"
    echo "    netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$PORT )"
  fi
else
  [ -n "$LANIP" ] && echo "  LAN players:     http://$LANIP:$PORT/client/"
fi

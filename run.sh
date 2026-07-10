#!/usr/bin/env bash
# Start (or restart) the RetroMultiCiv static server.
#   ./run.sh          serve on port 8123
#   ./run.sh 9000     serve on another port
set -euo pipefail
cd "$(dirname "$0")"

PORT="${1:-8123}"

if pkill -f "http\.server $PORT" 2>/dev/null; then
  echo "stopped previous server on port $PORT"
  sleep 0.5
fi

nohup python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
echo "RetroMultiCiv serving at http://localhost:$PORT/client/  (pid $!)"
echo "diagnostics: http://localhost:$PORT/client/?diag=1 · fixed world: ?seed=12345"

#!/usr/bin/env bash
# Free TCP ports by killing whatever LISTENS on them — the permission-safe
# way for agents to clean up stray dev servers (never pkill by pattern:
# pattern text self-matches the calling shell — a real 4x lesson).
#   debugging/killport.sh 8123 [9000 ...]
set -u
[ $# -eq 0 ] && { echo "usage: debugging/killport.sh PORT [PORT...]" >&2; exit 2; }
for PORT in "$@"; do
  PIDS=$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  if [ -z "$PIDS" ]; then
    echo "port $PORT: nothing listening"
    continue
  fi
  for PID in $PIDS; do
    CMD=$(ps -o comm= -p "$PID" 2>/dev/null || echo '?')
    kill "$PID" 2>/dev/null && echo "port $PORT: killed $CMD (pid $PID)" \
      || echo "port $PORT: could not kill pid $PID" >&2
  done
done

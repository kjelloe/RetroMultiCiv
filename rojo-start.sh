#!/usr/bin/env bash
# Start rojo serve for roblox/ from WSL — via the NATIVE Windows binary.
# A WSL rojo serve on /mnt/c is inotify-blind (9p) and silently serves a
# stale snapshot; the .exe through interop uses the real NTFS watcher.
set -uo pipefail
cd "$(dirname "$0")"

ROJO_EXE=/mnt/c/GIT/rojo/rojo.exe
PIDFILE=/tmp/rojo-serve.pid
LOGFILE=/tmp/rojo-serve.log
TASKLIST=/mnt/c/WINDOWS/system32/tasklist.exe

rojo_running() {
  "$TASKLIST" /FI "IMAGENAME eq rojo.exe" /NH 2>/dev/null | grep -q rojo.exe
}

if rojo_running; then
  echo "rojo.exe already running (Studio plugin: localhost:34872) — use ./rojo-stop.sh first to restart"
  exit 0
fi

[ -x "$ROJO_EXE" ] || { echo "missing $ROJO_EXE"; exit 1; }

nohup "$ROJO_EXE" serve roblox --port 34872 >"$LOGFILE" 2>&1 &
echo $! >"$PIDFILE"

for _ in $(seq 1 20); do
  grep -qi 'listening' "$LOGFILE" 2>/dev/null && break
  kill -0 "$(cat "$PIDFILE")" 2>/dev/null || break
  sleep 0.5
done

if grep -qi 'listening' "$LOGFILE" 2>/dev/null; then
  echo "rojo serving roblox/ on localhost:34872 (pid $(cat "$PIDFILE"), log $LOGFILE)"
else
  echo "rojo failed to start — $LOGFILE:"
  tail -5 "$LOGFILE" 2>/dev/null
  rm -f "$PIDFILE"
  exit 1
fi

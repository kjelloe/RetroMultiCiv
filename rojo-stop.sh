#!/usr/bin/env bash
# Stop the rojo serve started by rojo-start.sh (or any native rojo.exe).
set -uo pipefail

PIDFILE=/tmp/rojo-serve.pid
TASKLIST=/mnt/c/WINDOWS/system32/tasklist.exe
TASKKILL=/mnt/c/WINDOWS/system32/taskkill.exe

rojo_running() {
  "$TASKLIST" /FI "IMAGENAME eq rojo.exe" /NH 2>/dev/null | grep -q rojo.exe
}

if ! rojo_running; then
  echo "no rojo.exe running"
  rm -f "$PIDFILE"
  exit 0
fi

# killing the WSL interop stub takes the Windows process with it
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" 2>/dev/null
  sleep 1
fi
rm -f "$PIDFILE"

# fallback: serve was started outside this script (e.g. PowerShell)
if rojo_running; then
  "$TASKKILL" /IM rojo.exe /F >/dev/null 2>&1
  sleep 1
fi

if rojo_running; then
  echo "rojo.exe still running — stop it from the Windows side"
  exit 1
fi
echo "rojo stopped"

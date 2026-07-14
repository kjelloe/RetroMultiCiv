#!/usr/bin/env bash
# One-shot screenshot with self-managed serving — replaces the recurring
# scratchpad pattern (serve on a scratch port, screenshot.sh, kill by PID).
#   debugging/shoot.sh out.png "/client/?seed=12345&zoom=4"
#   debugging/shoot.sh out.png "/debugging/gallery.html"
#   debugging/shoot.sh out.png "/client/?server=1&spectate=1" --server "--seed 42 --civs 4"
#   debugging/shoot.sh out.png "/client/?e2e=1" --webgl1        # WebGL1 pass
# --server boots node server/index.js (extra args in the quoted string) so
# ?server=1 pages have a live ws; default is the static python server.
set -u
cd "$(dirname "$0")/.."
OUT=${1:?usage: shoot.sh out.png "/client/?params" [--server "args"] [--webgl1]}
URLPATH=${2:?missing url path}
shift 2
PORT=8969
SRVARGS=""
MODE=static
EXTRA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --server) MODE=node; SRVARGS=${2:-}; [ $# -gt 1 ] && shift ;;
    --webgl1) EXTRA="--disable-es3-gl-context" ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

bash debugging/killport.sh "$PORT" >/dev/null 2>&1
if [ "$MODE" = node ]; then
  # shellcheck disable=SC2086
  node server/index.js --port "$PORT" --no-save $SRVARGS >/tmp/multiciv-shoot.log 2>&1 &
  SRV=$!
  sleep 1.5
else
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  SRV=$!
  sleep 1
fi
if ! kill -0 "$SRV" 2>/dev/null; then
  echo "server failed to start (mode $MODE):" >&2
  [ "$MODE" = node ] && tail -5 /tmp/multiciv-shoot.log >&2
  exit 1
fi
bash debugging/screenshot.sh "$OUT" "http://localhost:$PORT$URLPATH" $EXTRA
RC=$?
kill "$SRV" 2>/dev/null
wait "$SRV" 2>/dev/null
exit $RC

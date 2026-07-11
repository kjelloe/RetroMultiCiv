#!/usr/bin/env bash
# Headless screenshot of the running game via the Playwright-cached Chromium
# (SwiftShader — works without a GPU). Serve the repo root first (./run.sh).
#
#   debugging/screenshot.sh [out.png] [url] [extra chrome flags...]
#
# Examples:
#   debugging/screenshot.sh /tmp/shot.png
#   debugging/screenshot.sh /tmp/city.png "http://127.0.0.1:8123/client/?seed=12345&e2e=1&e2eclose=1&zoom=6"
#   debugging/screenshot.sh /tmp/webgl1.png "" --disable-es3-gl-context   # WebGL1-only pass
set -euo pipefail

OUT="${1:-/tmp/multiciv.png}"
URL="${2:-}"
[ -n "$URL" ] || URL="http://127.0.0.1:8123/client/?seed=12345"
[ $# -ge 2 ] && shift 2 || shift $#

CHROME=$(ls ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | head -1)
if [ -z "$CHROME" ]; then
  echo "headless chromium not found under ~/.cache/ms-playwright" >&2
  exit 1
fi

exec "$CHROME" --no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader \
  --window-size=1280,800 --virtual-time-budget=6000 \
  "$@" --screenshot="$OUT" "$URL"

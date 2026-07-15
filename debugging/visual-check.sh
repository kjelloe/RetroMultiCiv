#!/usr/bin/env bash
# A48 visual-regression goldens: byte-compare the rest-pose renderer shots
# against committed golden PNGs. Runs nightly in CI after the chromium install.
#
#   debugging/visual-check.sh            # compare; exit 1 on any mismatch
#   debugging/visual-check.sh --record   # (re)generate the goldens
#
# CI-AUTHORITATIVE GOLDENS. SwiftShader rasterizes deterministically for a
# GIVEN chromium build, so the committed PNGs are recorded FROM a CI run's
# artifacts. A re-record after an INTENDED visual change = download the
# nightly's uploaded actual-*.png artifacts and commit them alongside the
# renderer change that caused them. LOCAL runs are INFORMATIONAL ONLY — a
# different local chromium/SwiftShader build may differ from CI legitimately;
# do NOT chase local-vs-CI pixel diffs. The committed goldens in this repo
# were bootstrapped locally; the first CI nightly re-records the authoritative
# set (it uploads its actual-*.png; commit those as the goldens).
#
# The frames are byte-stable by construction: rest pose (no sway/smoke), and
# reduce-animation freezes the water drift too (renderer/three/index.js),
# so ocean-bearing frames don't jitter.
set -u
cd "$(dirname "$0")/.."
GOLD=debugging/goldens
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

# name → URL (served from the repo root by debugging/shoot.sh)
declare -A SHOTS=(
  [gallery]="/debugging/gallery.html"
  [splash]="/client/?splashstill=1"
)

record="${1:-}"
fail=0
for name in "${!SHOTS[@]}"; do
  url="${SHOTS[$name]}"
  target="$OUT/$name.png"
  debugging/shoot.sh "$target" "$url" >/dev/null 2>&1
  if [ ! -s "$target" ]; then
    echo "✗ $name: screenshot failed (no output)"
    fail=1
    continue
  fi
  if [ "$record" = "--record" ]; then
    cp "$target" "$GOLD/$name.png"
    echo "● recorded $name → $GOLD/$name.png"
  elif [ ! -f "$GOLD/$name.png" ]; then
    echo "✗ $name: no golden — run: debugging/visual-check.sh --record"
    fail=1
  elif cmp -s "$target" "$GOLD/$name.png"; then
    echo "✓ $name: matches golden"
  else
    # keep the actual for the nightly to upload as the re-record candidate
    cp "$target" "$GOLD/actual-$name.png"
    a=$(stat -c%s "$target"); g=$(stat -c%s "$GOLD/$name.png")
    echo "✗ $name: DIFFERS from golden (actual ${a}B vs golden ${g}B) → $GOLD/actual-$name.png"
    fail=1
  fi
done

if [ "$record" = "--record" ]; then
  echo "goldens recorded — commit debugging/goldens/*.png"
  exit 0
fi
[ "$fail" -eq 0 ] && echo "visual-check: all frames match" || echo "visual-check: MISMATCH (see above; re-record from the CI artifact if the change was intended)"
exit "$fail"

#!/usr/bin/env bash
# B0 standing triage, mechanized: replay every recording in debugging/logs/
# (or the files you name) and print one verdict line each. Exit 1 if any
# file diverges — divergences then get the full replay output re-run by hand.
#   debugging/triage.sh                 # everything in debugging/logs/*.json
#   debugging/triage.sh saves/g7.json   # specific files
set -u
cd "$(dirname "$0")/.."
FILES=("$@")
if [ ${#FILES[@]} -eq 0 ]; then
  shopt -s nullglob
  FILES=(debugging/logs/*.json)
  shopt -u nullglob
fi
[ ${#FILES[@]} -eq 0 ] && { echo "nothing to triage in debugging/logs/"; exit 0; }
FAIL=0
for f in "${FILES[@]}"; do
  case "$f" in *Zone.Identifier*) continue ;; esac
  OUT=$(node tools/replay.js "$f" 2>&1)
  if echo "$OUT" | grep -q "^OK:"; then
    SUMMARY=$(echo "$OUT" | grep -E "replayed" | head -1)
    echo "PASS  $f  ·  ${SUMMARY:-replayed}"
  else
    REASON=$(echo "$OUT" | tail -2 | head -1)
    echo "FAIL  $f  ·  ${REASON}"
    FAIL=1
  fi
done
exit $FAIL

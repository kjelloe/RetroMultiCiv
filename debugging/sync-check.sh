#!/usr/bin/env bash
# Doc-drift detector for the recurring sync passes: compares the CURRENT
# suite test count against every file that pins one. Run with the count if
# you just ran the suite; without an argument it runs the suite itself.
#   debugging/sync-check.sh 188        # fast: trust a fresh run
#   debugging/sync-check.sh            # slow: runs the full suite first
set -u
cd "$(dirname "$0")/.."
if [ $# -ge 1 ]; then
  COUNT=$1
else
  COUNT=$(node --test test/ 2>&1 | grep -E "^# tests" | grep -oE "[0-9]+")
fi
[ -z "$COUNT" ] && { echo "could not determine test count" >&2; exit 2; }
echo "suite count: $COUNT"
DRIFT=0
check() { # file, grep-pattern producing the number
  local n
  n=$(grep -oE "$2" "$1" 2>/dev/null | grep -oE "[0-9]+" | head -1)
  if [ -z "$n" ]; then
    echo "  ?      $1 (no count found — pattern drift?)"; DRIFT=1
  elif [ "$n" = "$COUNT" ]; then
    echo "  ok     $1 ($n)"
  else
    echo "  STALE  $1 says $n"; DRIFT=1
  fi
}
check README.md            "[0-9]+ headless tests"
check plan-update.md       "[0-9]+ automated tests"
check agent-workitems.md   "currently [0-9]+ tests"
exit $DRIFT

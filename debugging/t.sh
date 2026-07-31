#!/usr/bin/env bash
# Quick test runner — the default way to run tests in this repo (keeps
# piped one-liners out of tool invocations).
#   debugging/t.sh                     # full suite: summary + failures
#   debugging/t.sh test/foo.test.js …  # specific files
#   debugging/t.sh -v test/foo.test.js # verbose: every ok/not ok line
set -uo pipefail
cd "$(dirname "$0")/.."

VERBOSE=0
[ "${1:-}" = "-v" ] && { VERBOSE=1; shift; }
TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(test/*.test.js)

# CONCURRENCY CAP (2026-07-31): node --test defaults to one worker per core, and
# the density-era suite has files that each build 400-turn worlds — 16 of those
# in parallel starved the headless-browser boots ("browser produced no DOM") while
# every one of those tests passes alone. Cap the FULL-suite run so the reds the
# suite reports are real; a targeted run (few files) keeps the default.
CONC=""
if [ ${#TARGETS[@]} -gt 8 ]; then
  CORES=$(nproc 2>/dev/null || echo 4)
  CAP=$(( CORES / 3 )); [ "$CAP" -lt 2 ] && CAP=2; [ "$CAP" -gt 6 ] && CAP=6
  CONC="--test-concurrency=$CAP"
fi
OUT=$(node --test $CONC --test-reporter=tap "${TARGETS[@]}" 2>&1)
STATUS=$?

if [ "$VERBOSE" = 1 ]; then
  echo "$OUT" | grep -E "^(ok|not ok)"
fi
# failures with their error blocks, then the tally
echo "$OUT" | awk '/^not ok/{p=1} p{print} /^  \.\.\.$/{p=0}' | head -40
echo "$OUT" | grep -E "^# (tests|pass|fail|skipped)"
exit $STATUS

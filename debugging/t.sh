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
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(test/)

OUT=$(node --test --test-reporter=tap "${TARGETS[@]}" 2>&1)
STATUS=$?

if [ "$VERBOSE" = 1 ]; then
  echo "$OUT" | grep -E "^(ok|not ok)"
fi
# failures with their error blocks, then the tally
echo "$OUT" | awk '/^not ok/{p=1} p{print} /^  \.\.\.$/{p=0}' | head -40
echo "$OUT" | grep -E "^# (tests|pass|fail|skipped)"
exit $STATUS

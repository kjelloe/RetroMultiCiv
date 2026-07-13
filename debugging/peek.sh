#!/usr/bin/env bash
# peek.sh — numbered code viewing for agents, replacing the hand-composed
# grep -n | head + sed -n "$(grep …)" pipes that trigger permission prompts.
#   debugging/peek.sh FILE PATTERN [PATTERN…]  # matches summary, then each
#                                              # match with ±CTX numbered lines
#   debugging/peek.sh -c 4 FILE PATTERN        # tighter context (default 10)
#   debugging/peek.sh FILE 120-160             # a numbered line range, no grep
# Patterns are ORed (extended regex). Output is capped so it stays readable.
set -u
CTX=10
if [ "${1:-}" = "-c" ]; then CTX=$2; shift 2; fi
[ $# -lt 2 ] && { echo "usage: debugging/peek.sh [-c N] FILE PATTERN[…] | FILE N-M" >&2; exit 2; }
FILE=$1; shift
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 2; }

# range mode: FILE 120-160
if [ $# -eq 1 ] && printf '%s' "$1" | grep -qE '^[0-9]+-[0-9]+$'; then
  FROM=${1%-*}; TO=${1#*-}
  sed -n "${FROM},${TO}p" "$FILE" | nl -ba -v "$FROM" -w 4 -s $'\t'
  exit 0
fi

PAT=$(printf '%s|' "$@"); PAT=${PAT%|}
HITS=$(grep -n -E "$PAT" "$FILE" | head -20)
if [ -z "$HITS" ]; then
  echo "no match for /$PAT/ in $FILE"
  exit 1
fi
echo "== matches in $FILE (first 20) =="
echo "$HITS"
echo "== context ±$CTX =="
grep -n -E -C "$CTX" "$PAT" "$FILE" | head -160

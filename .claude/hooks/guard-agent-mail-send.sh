#!/usr/bin/env bash
# PreToolUse/Bash guard: blocks the agent-mail junk/transcript/substitution
# anti-patterns WITHOUT breaking legitimate sends.
#
# This hook lives in the SHARED dev-PC clone, so it runs for the bugfixer/helper
# sessions too — it must NOT block a worker sending as ITSELF to OTHERS
# (`--as bugfixer --to coordinator`). Blocked patterns:
#   (a) --tag noop  (universal junk; no one legitimately uses it)
#   (b) a SELF-DIRECTED worker send: the same worker role in --as AND --to
#       (`--as hardening --to hardening`) — a real worker never mails itself.
#   (c) HEREDOC body into send (`send … - <<'EOF'`): streams the body through
#       the transcript; the ruling (CLAUDE.md 2026-07-17) is Write tool →
#       --body-file, two separate steps.
#   (d) echo/printf PIPED into send: same transcript leak, same ruling.
#       (`cat file | send -` stays allowed — content never enters the command.)
#   (e) backticks or `$` inside an INLINE body (--body/-m/--text/--message):
#       bash substitutes them — backticks EXECUTE mid-send, `$vars` silently
#       mutate the body (measured gotcha, memory agent-mail-backtick-gotcha).
#       Applies to `send` AND `queue add`. Dynamic/marked-up bodies go via
#       --body-file with the content already resolved.
#   (f) MULTI-LINE inline body: the ruling allows inline --body for a trivial
#       one-line ack ONLY; anything multi-line goes in a file.
# Inspect only the flag portion before --body for (a)/(b) (role names appear
# in body text); (c)-(f) inspect the command/body portions directly.
WORKERS='hardening|sim-runner|helper|bugfixer|roblox-helper|reviewer'
cmd=$(jq -r '.tool_input.command // ""')
head=$(printf '%s' "$cmd" | sed -E 's/[[:space:]](--body-file|--body|--text|--message|-m)([[:space:]=]).*//')
is_send=false; is_queue_add=false
printf '%s' "$head" | grep -q 'agent-mail.py send' && is_send=true
printf '%s' "$head" | grep -qE 'agent-mail.py[[:space:]]+queue[[:space:]]+add' && is_queue_add=true
{ $is_send || $is_queue_add; } || exit 0
block() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"BLOCKED: %s"}}' "$1"
  exit 0
}
if $is_send; then
  # (a) --tag noop
  printf '%s' "$head" | grep -qE -- '--tag[= ]+noop' && \
    block "agent-mail junk-send (--tag noop). Send ONE real message as your own role to a DIFFERENT recipient."
  # (b) self-directed worker send
  asrole=$(printf '%s' "$head" | grep -oiE "(--as|--from|--sender)[= ]+($WORKERS)" | grep -oiE "($WORKERS)\$" | head -1)
  if [ -n "$asrole" ]; then
    torecips=$(printf '%s' "$head" | grep -oiE '(--to)[= ]+[a-z,-]+' | sed -E 's/(--to)[= ]+//')
    printf '%s' "$torecips" | tr ',' '\n' | grep -qxi "$asrole" && \
      block "self-directed worker send (--as X --to X). Send as your own role to a DIFFERENT recipient."
  fi
  # (c) heredoc body
  printf '%s' "$cmd" | grep -q '<<' && \
    block "heredoc body into agent-mail send — streams the body through the transcript. Two steps: (1) Write the body to a file with the Write tool, (2) send --body-file PATH."
  # (d) echo/printf piped into send
  printf '%s' "$cmd" | grep -qE '(echo|printf)[^|]*\|[^|]*agent-mail\.py[[:space:]]+send' && \
    block "echo/printf piped into agent-mail send — the body rides the command line anyway. Write the body to a file with the Write tool, then send --body-file PATH."
fi
# (e)+(f) inline-body content checks — send AND queue add
bodyflag=$(printf '%s' "$cmd" | grep -oE -- '[[:space:]](--body|--text|--message|-m)[[:space:]=]' | head -1)
if [ -n "$bodyflag" ]; then
  body=$(printf '%s' "$cmd" | sed -E "s/.*[[:space:]](--body|--text|--message|-m)[[:space:]=]+//")
  printf '%s' "$body" | grep -q '[`$]' && \
    block "backtick or \$ inside an inline body — bash substitutes them (backticks EXECUTE, \$vars mutate the text). Resolve the content and use --body-file, or drop the special characters."
  case "$body" in *$'\n'*) \
    block "multi-line inline body — inline --body is for a trivial one-line ack only. Write the body to a file with the Write tool, then use --body-file PATH.";; esac
fi
exit 0

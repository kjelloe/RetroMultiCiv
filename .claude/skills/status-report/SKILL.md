---
name: status-report
description: The recurring 20-min agent status report — gather board/mail/queues/locks/git, lead with "Needs your input" (user vs designer-ally), one line per lane, no fabrication
---

# /status-report — the 20-minute lane report (ARCHITECT ONLY)

Standing user request (2026-07-20). Normally fired by the session cron; run
manually to produce one on demand. Re-create the cron in a fresh session:
every 20 min at off-minutes (e.g. `13,33,53 * * * *`).

## Gather (quietly, one Bash call)

```
python3 tools/agent-mail.py status            # presence board
python3 tools/agent-mail.py peek --as coordinator --headers | tail   # new mail
python3 tools/agent-mail.py queue list        # backlog depths
python3 tools/agent-mail.py locks             # lock count + holders
git log -1 --oneline                          # tip
```

## Report shape

1. **"Needs your input"** at the TOP: decisions/rulings/questions for the
   USER or the DESIGNER ALLY — say which of the two; for ally questions
   offer a ready-to-share phrasing. Nothing pending → the single line
   "Nothing needs your input."
2. **One line per lane** (helper / bugfixer / sim-runner / roblox-helper /
   hardening / reviewer): state (waiting / working / ⚠STALE / silent / blocked),
   what it is on, delta since the previous report. ONLY what the board/mail
   shows — never fabricate progress. A lane marked working, silent >15m and
   not tagged `long` → re-ping via coordinator mail before reporting it.
3. **One closing line**: in-flight milestone + queue depths + tip.

## Rules

- Build-log voice (reporting-style memory): facts and counts, no
  autonomous-actor framing, no fleet/military vocabulary.
- Nothing changed since last report → compress to 2–3 lines total.
- Anything needing an ARCHITECT ruling discovered during gathering: rule it
  in the same turn (that is coordination work, not user input), then report
  it as handled.

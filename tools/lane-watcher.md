# lane-watcher — install & usage

`tools/lane-watcher.py` is a zero-token wake daemon for the agent
lanes. It closes the one gap the mail/flag stack cannot: a Claude
Code session only executes while a turn is open, so a lane whose
turn chain has ended cannot poll, notice mail, or take queue items —
it just sits dark while work accumulates ("the session says there is
nothing to do"). The watcher is a plain Python process (no model, no
tokens) that polls the agent-mail hub and, when a lane's flag goes
UP, starts ONE headless `claude -p` turn in that lane's clone.
Idle costs nothing; tokens are spent exactly when work exists.

## How it decides

Every `--interval` seconds (default 180) it runs, per configured
lane, `python3 tools/agent-mail.py flag --as <lane> --raw` INSIDE
that lane's clone directory — so the poll proxies through whatever
`.agent-mail/remote` that clone already uses. The three-field answer
(`unread=N queue=N note=TS`) triggers a wake when any is non-zero,
subject to a per-lane cooldown (default 1800 s) so a lane that is
already awake and working is not stacked with duplicate turns. A
poll that fails (hub restarting, network blip, malformed reply) is
skipped silently — the watcher never crashes and never wakes on
noise. Wakes are at-least-once, like the mail layer: if work still
remains after the cooldown, it fires again.

The wake turn gets a mechanical, self-contained prompt: inbox →
ack what you act on → `queue take` → do the work per role doctrine →
post status → lower any note. The lane's own CLAUDE.md carries the
real doctrine; the prompt only points at the mailbox.

## Requirements

- Python 3 (stdlib only — no packages).
- The `claude` CLI on PATH for the user running the watcher (test:
  `claude -p "say ok"` from a shell — if that works, the watcher
  works).
- Each watched lane has a CLONE with `tools/agent-mail.py` present
  and `.agent-mail/remote` pointing at the hub (one line,
  `http://<dev-pc-ip>:8970`). The dev-PC clone that HOSTS the hub
  needs no remote file — it reads the store directly.

## Install (per machine, ~2 minutes)

1. Pull the repo in each lane clone (the watcher ships in
   `tools/`; any clone's copy can run it — it only needs the config).
2. Write the machine-local config — **never commit it** (paths are
   machine-specific):

   ```bash
   cat > ~/lanes.json <<'EOF'
   [
     {"lane": "reviewer",      "dir": "/mnt/c/GIT/multiciv-review"},
     {"lane": "sim-runner",    "dir": "/mnt/c/GIT/multiciv-sim"},
     {"lane": "roblox-helper", "dir": "/mnt/c/GIT/multiciv-roblox"}
   ]
   EOF
   ```

   Per-lane keys:
   | key | required | meaning |
   | --- | --- | --- |
   | `lane` | yes | the agent-mail role name |
   | `dir`  | yes | that lane's clone (poll + wake both run here) |
   | `cmd`  | no  | wake-command template; `{prompt}` is substituted. Default: `claude -p {prompt!r}`. Use this to add flags your headless runs need, e.g. `"claude --dangerously-skip-permissions -p {prompt!r}"` (only on machines where you accept that mode). |
   | `cooldown` | no | per-lane override of the wake cooldown, seconds |

3. Verify with a dry run (prints would-be wakes, launches nothing):

   ```bash
   python3 tools/lane-watcher.py --config ~/lanes.json --once --dry-run
   ```

   A lane with pending mail/queue prints a `WAKE <lane>: ...` line.
   Nothing pending → silence. A `poll` that cannot reach the hub is
   skipped — if EVERY lane is silent while you know work exists,
   check each clone's `.agent-mail/remote` first.

4. Run it for real, under whatever supervisor you prefer:

   ```bash
   # simplest: a tmux window
   tmux new -s lane-watcher 'python3 tools/lane-watcher.py --config ~/lanes.json'

   # or a systemd user service
   systemd-run --user --unit=lane-watcher \
     python3 /path/to/clone/tools/lane-watcher.py --config ~/lanes.json

   # or cron-style single sweeps (no daemon at all)
   */5 * * * * cd /path/to/clone && python3 tools/lane-watcher.py --config ~/lanes.json --once
   ```

## Flags

| flag | default | meaning |
| --- | --- | --- |
| `--config PATH` | required | the lanes.json |
| `--interval N` | 180 | seconds between poll rounds |
| `--cooldown N` | 1800 | min seconds between wakes per lane |
| `--dry-run` | off | print wakes, launch nothing |
| `--once` | off | one poll round then exit (cron mode) |

## Cost & behavior notes

- **Idle = zero tokens.** The poll is one HTTP call to the hub; no
  model is involved anywhere in the loop. (This is also why a local
  Ollama poller adds nothing — the decision is `unread>0`.)
- A wake spends one normal Claude turn; the cooldown (30 min
  default) bounds the worst case at ~2 turns/lane/hour, and only
  while work actually sits unclaimed. A woken lane that finishes and
  acks stops triggering.
- Wakes are fire-and-forget ACROSS clones — one lane's long turn
  never delays a wake in a different directory — but SERIALIZED
  within one directory: **two lanes sharing a clone** (sim-runner +
  roblox-helper on the gaming PC — intentional: sim-runner commits
  the roblox-helper's working-tree bytes) never get simultaneous
  turns in the same working tree. While one wake turn runs there,
  the other lane simply stays flagged and is woken on a later round
  after the first turn exits. List both lanes with the same `dir`;
  the watcher handles the rest. Order tip: list the WORKER
  (roblox-helper) before the COMMITTER (sim-runner) in lanes.json —
  round order gives the producer first crack at a fresh tree.
- The watcher COMPOSES with flag-wait, it does not replace it: a
  live session still uses `flag wait` inside its turns; the watcher
  only matters once the session has gone dark.
- The reaper (hub-side) still flags working-stale lanes to the
  coordinator — different failure (stalled-while-awake vs dark).

## Troubleshooting

| symptom | cause / fix |
| --- | --- |
| dry-run silent, but work exists | that clone's `.agent-mail/remote` is missing/wrong — the poll read an empty LOCAL store. Restore the hub URL. |
| `WAKE` printed but no session ran | the `cmd` template failed in that dir — run it by hand there; usually a PATH or permissions-flag issue with headless `claude -p`. |
| the same lane wakes repeatedly | it is not ACKING its mail (or not taking its queue item) — the at-least-once layer redelivers. Fix the lane's protocol, not the watcher. |
| the woken turn STALLS on a permission prompt ("need git pull approved", "Write perm denied") | headless turns cannot answer harness prompts. Pre-approve the lane's routine surface in that clone's `.claude/settings.json` allowlist (its own tree + git pull), or use a per-lane `cmd` with your accepted permissions flag. Observed live 2026-07-25: two consecutive roblox-helper wakes stalled (pull, then a new-file Write) until the human approved. |
| wakes feel too chatty | raise `--cooldown` (or per-lane `cooldown`). |
| hub restarts mid-poll | skipped silently by design; the next round retries. |

## Security note

The wake command runs with the invoking user's shell in the lane's
clone — treat `lanes.json` like a crontab (owner-writable only). The
watcher makes no network calls except the hub poll, and the hub
remains LAN-only trusted-posture (see specs/agent-mail-hub-upgrade.md
for the deferred token hardening).

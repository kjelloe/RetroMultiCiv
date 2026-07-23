#!/usr/bin/env python3
"""lane-watcher — zero-token wake daemon for turn-based agent lanes.

The gap it closes: a Claude Code session only executes while a turn is
open; once the turn chain ends, the lane cannot poll, notice mail, or
ask anything — flag-wait keeps a lane reachable only while its session
keeps re-running it. This watcher is the OTHER half: a plain process
(no model, no tokens) polls the agent-mail hub for each configured
lane, and when a lane's flag goes UP (unread mail / queued work / a
raised note) it starts ONE headless turn in that lane's clone via
`claude -p`. Idle costs nothing; tokens are spent exactly when work
exists.

Usage (one watcher per machine, e.g. under cron/systemd-user or tmux):

  python3 tools/lane-watcher.py --config lanes.json [--interval 180]
      [--cooldown 1800] [--dry-run] [--once]

lanes.json (per machine, NOT committed — paths are machine-local):
  [
    {"lane": "reviewer",   "dir": "/mnt/c/GIT/multiciv-review"},
    {"lane": "sim-runner", "dir": "/mnt/c/GIT/multiciv-sim",
     "cmd": "claude --dangerously-skip-permissions -p {prompt!r}"}
  ]

Per-lane keys: lane (role name), dir (the clone; its .agent-mail/remote
must point at the hub), cmd (optional wake-command template; {prompt}
is substituted; default plain `claude -p {prompt!r}`), cooldown
(optional per-lane override, seconds).

Behavior:
- Poll = `python3 tools/agent-mail.py flag --as <lane> --raw` run IN
  the lane dir (so the hub proxying uses that clone's remote file).
  Three-field wire format; any parse/connection failure = skip this
  round (never crash, never wake on noise).
- Wake fires when unread>0 OR queue>0 OR note!=0, subject to a
  per-lane cooldown (default 30 min) so a lane that is ALREADY awake
  and working is not stacked with duplicate turns. The woken turn is
  expected to ack/take/work and post status; if work remains next
  poll after the cooldown, it fires again — at-least-once, like the
  mail layer.
- The wake prompt is deliberately mechanical and self-contained (the
  session's CLAUDE.md carries the real doctrine).

No dependencies beyond the standard library.
"""
import argparse
import json
import subprocess
import sys
import time

WAKE_PROMPT = (
    "FLAG UP for role '{lane}' (lane-watcher wake). You are the {lane} lane. "
    "Do now, in order: (1) python3 tools/agent-mail.py inbox --as {lane} --headers "
    "then ack what you act on; (2) queue take --as {lane} if the flag showed queued "
    "work; (3) do the work per your role doctrine; (4) post status --as {lane}; "
    "(5) flag lower --as {lane} if a note was raised for you. If genuinely nothing "
    "is actionable, post a waiting status and end the turn."
)


def poll(lane, cwd):
    try:
        out = subprocess.run(
            [sys.executable, 'tools/agent-mail.py', 'flag', '--as', lane, '--raw'],
            cwd=cwd, capture_output=True, text=True, timeout=30)
        kv = dict(tok.split('=', 1) for tok in out.stdout.split())
        return int(kv['unread']), int(kv['queue']), int(kv['note'])
    except Exception:
        return None  # unreachable/malformed = no wake this round


def wake(entry, prompt, dry, procs):
    cmd = entry.get('cmd', 'claude -p {prompt!r}').format(prompt=prompt)
    print(f"[{time.strftime('%H:%M:%S')}] WAKE {entry['lane']}: {cmd[:80]}...")
    if dry:
        return
    # fire-and-forget ACROSS dirs (a long turn never blocks other lanes'
    # wakes) but SERIALIZED within one dir via the procs registry the
    # caller checks: two lanes sharing a clone (sim-runner commits the
    # roblox-helper's working-tree bytes by design) must never get
    # simultaneous turns in one working tree — a rebase under a
    # mid-edit tree is the mixed-tree failure class.
    procs[entry['dir']] = subprocess.Popen(
        cmd, shell=True, cwd=entry['dir'],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config', required=True, help='lanes.json path')
    ap.add_argument('--interval', type=int, default=180, help='poll seconds (default 180)')
    ap.add_argument('--cooldown', type=int, default=1800,
                    help='min seconds between wakes per lane (default 1800)')
    ap.add_argument('--dry-run', action='store_true', help='print wakes, launch nothing')
    ap.add_argument('--once', action='store_true', help='one poll round, then exit')
    a = ap.parse_args()
    lanes = json.load(open(a.config))
    last_wake = {}
    procs = {}  # dir -> the running wake process (one turn per working tree)
    print(f'lane-watcher: {len(lanes)} lane(s), poll {a.interval}s, cooldown {a.cooldown}s'
          + (' [DRY RUN]' if a.dry_run else ''))
    while True:
        now = time.time()
        for entry in lanes:
            lane = entry['lane']
            p = procs.get(entry['dir'])
            if p is not None and p.poll() is None:
                # a wake turn is still running in this working tree —
                # never start a second one there (shared-clone rule);
                # the lane stays flagged and is picked up next round
                continue
            c = poll(lane, entry['dir'])
            if c is None:
                continue
            unread, qn, note = c
            if not (unread or qn or note):
                continue
            cool = entry.get('cooldown', a.cooldown)
            if now - last_wake.get(lane, 0) < cool:
                continue
            last_wake[lane] = now
            wake(entry, WAKE_PROMPT.format(lane=lane), a.dry_run, procs)
        if a.once:
            return
        time.sleep(a.interval)


if __name__ == '__main__':
    main()

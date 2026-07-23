# agent-mail hub upgrade — what landed 2026-07-24, what migrates later

Source: an external specialist review of our coordination tool
(`/home/kjelloe/GIT/agent-mail/` on the dev PC — reference
implementation + docs; not part of this repo). The reviewer confirmed
flag-wait as the right reachability fix, then found three real
defects underneath it plus one security hole. All four were verified
against our code before adopting anything, and their reference
implementation turned out to be built directly on our file (our
guards and comments intact), which made the port surgical.

## Phase 0 — DONE 2026-07-24 (this repo, live)

Ported into `tools/agent-mail.py`, sandbox-tested (25-check scenario:
tag-filter retention, contiguous cursor, redelivery, lease expiry +
takeover, hub wire refusals), live hub restarted on the new code with
the store intact. Backups: `.agent-mail.bak-2026-07-23/` (store).

1. **At-least-once mail** (fixes two data-loss bugs). `inbox`
   DELIVERS (pending file, 15-min ack window) and prints the required
   `ack` command; `ack @hash|#id --as <role>` SETTLES; the cursor
   advances only over a contiguous run of settled ids. Consequences:
   a `--tag`-filtered read can no longer bury unmatched mail (the old
   cursor jumped past everything unread), and a lane that loses its
   turn after reading gets the mail back on its own — the old
   at-most-once leak looked exactly like "sessions stopped
   responding" and drove the human nudging. `inbox --ack` settles in
   one call where reading is acting. New store files:
   `pending-<role>`, `acked-<role>`.
2. **Locks are leases** (fixes the wedged-file failure). 45-min
   default TTL, `--ttl N` for longer ops, re-run `lock` to renew;
   `locks` shows time remaining; an EXPIRED lease is takeable (the
   takeover broadcasts, same visibility as `--force`).
3. **Hub reaper** (the missing watchdog). A 60-s thread in `serve`:
   frees expired leases (broadcasts each), and raises the
   coordinator's flag when a WORKING lane's status goes >25 min
   without movement — same working-and-not-`long` rule as the status
   board's ⚠STALE mark, so lanes legitimately parked in flag-wait
   never trigger it. This mechanizes the manual stale-lane re-ping.
4. **Hub wire allowlist** (closes the file-read hole). `/rpc` used to
   dispatch raw argv, which made `--body-file` open a path on the
   HUB's disk — an unauthenticated read of anything the hub user can
   see, published into the shared log. Now an explicit per-command
   flag allowlist (`RPC_SCHEMA`): unlisted flags never cross the
   wire, so `--body-file` is excluded by omission (the property that
   survives future CLI edits); lock/unlock paths must be
   repo-relative. Clients still resolve `--body-file` locally and
   proxy the CONTENT as `--body` — no behavior change for lanes.
   Checked the existing log before restart: no credentials present.
5. **Dormant per-lane auth** (code landed, OFF by default). If
   `.agent-mail/tokens` exists on the hub (`<token> = <lane>
   [admin]` lines), every request must carry a matching bearer token
   and `--as` is bound to the token's lane (`--force` needs admin).
   Clients send `.agent-mail/token` or `$AGENT_MAIL_TOKEN`
   automatically. Absent file = auth off = today's trusted-LAN
   posture, zero impact.

Wire-format invariant kept: `flag --raw` is EXACTLY three fields —
old clients unpack it positionally, and a fourth field would silently
kill their flag-wait. Ack debt shows in the human-readable line only.

### Lane rollout (riding the normal git pump)

Old clients against the new hub are compatible: remote lanes proxy
argv verbatim and the hub runs the new code, so the new semantics are
already live for everyone; `ack` works from old-file clones too (it
dispatches hub-side). Lanes only need to LEARN the protocol —
CLAUDE.md and `tools/agent-mail.md` now carry it (rules in tracked
docs, not in mail: mailed rules are 200 turns back by week's end).
Watch item for the first days: a lane accumulating unacked mail
(redelivery noise = the safety net working, but persistent debt means
its instructions need fixing, not the tool).

Rollout lesson (2026-07-24, helper #2367): the upgrade was edited into
the live shared file in place, and a lane executed a half-edited state
(`flag wait` ValueError in the minutes between the flag_counts change
and its callers' fix). Future edits to live shared tooling: stage in a
scratch copy, install with one atomic `cp`, then restart the hub.

## Phase 1 — LATER (each item its own decision; rough order)

1. **Territory ownership** (`tools/owners` manifest + `owner`/
   `territory` commands + the PreToolUse territory-guard hook from
   the reference repo). Deliberately NOT adopted now: our lanes are
   verb-shaped by doctrine (bugs have no fixed lane; engine edits go
   through the golden lock), so ownership is a coordination-doctrine
   change, not a patch. IF adopted: write our own manifest (the
   reference drafts guess our layout wrong), run `territory --check`
   for clashes/orphans, keep `shared/` + `data/*.json` deliberately
   unowned (interface ground = always a lease), and note the
   reference `lock` integration (owner check + auto-mail-the-owner)
   comes back in scope with it. Decide POST-v1.
2. **Enable per-lane tokens** (the dormant auth). Needs: generate
   tokens, place `.agent-mail/tokens` on the hub +
   `.agent-mail/token` per clone (all gitignored), restart hub.
   Breaks unupgraded clients only if they predate phase 0 (they
   would not send the header) — all clones must be on ≥ the phase-0
   file first. Buys: `--as` claims verified, per-machine revocation.
3. **Bind tightening.** The hub keeps `0.0.0.0` for now (WSL2
   portproxy forwards to the WSL address, and the public game server
   is the separate Hetzner VM — the hub is LAN-only exposure). When
   revisited: bind the WSL eth0 address explicitly, or move the
   machines onto Tailscale and bind that interface. The serve banner
   now warns about `0.0.0.0` on every start.
4. **Stop-hook enforcement** of "never end a turn idle" (turns the
   flag-wait convention into an invariant). Per-lane
   `.claude/settings` + `stop_hook_active` guard so sessions can
   still end; architect exempt (this lane SHOULD stop and wait for
   the user). Weigh subscription burn: a lane that cannot stop keeps
   consuming budget.
5. **Lane-topology review** (reference `roles-advice.md`): mostly-
   idle lanes (reviewer/hardening) as on-demand roles instead of
   standing sessions — real subscription savings, but the reviewer
   lane is load-bearing on the marker gate through v1. POST-v1, with
   plan-version2.
6. **Log rotation** for `messages.jsonl` (unread scans walk the whole
   file; ~2.4k messages and growing). Cheap, do whenever it shows up
   in hub latency.

## Rollback (phase 0)

`git revert` the tools/agent-mail.py commit (or checkout the prior
rev) + restart the hub. The old tool ignores `pending-*`/`acked-*`
entirely, so a rollback degrades to the old at-most-once behavior
rather than breaking; `.agent-mail.bak-2026-07-23/` restores the
store wholesale if ever needed. The one unsafe mix is a POST-phase-0
`tokens` file against pre-phase-0 clients — do not enable auth before
every clone is upgraded.

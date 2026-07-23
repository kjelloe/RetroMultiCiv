# agent-mail — mailbox + file locks for the agent fleet

`tools/agent-mail.py` is a tiny file-backed mailbox and lock registry
for the architect and any number of coder agents. Storage is
`.agent-mail/` at the repo root (gitignored): `messages.jsonl`
(append-only) + per-reader `cursor-`/`pending-`/`acked-` files +
`locks.json`.

## Delivery guarantees: inbox DELIVERS, ack SETTLES (STANDARD — 2026-07-24)

Mail is AT-LEAST-once since 2026-07-24. `inbox` no longer marks
messages read — it DELIVERS them (prints + starts a 15-minute ack
window) and names the required `ack` command. A delivered message you
never ack RETURNS to your inbox after 15 minutes, so a lost turn
(context compaction, crash, interrupt) can no longer swallow an
instruction — that was the old at-most-once leak that made lanes look
deaf until a human nudged them. The rules:

- **Ack what you have acted on**: `ack @hash [@hash …] --as <role>`
  (also accepts `#id`s). Ack when the instruction is DONE or safely
  captured in your own notes/queue — not merely glanced at.
- `inbox --ack` settles what it displays in one call — for reads where
  seeing genuinely IS acting (status catch-ups, fyi sweeps).
- A `--tag`-filtered `inbox` touches ONLY the displayed messages — the
  old tool advanced the cursor past everything unread (silent mail
  loss, the worst of the fixed bugs); now non-matching mail stays
  unread.
- Expect redelivery: seeing a message twice means you did not ack it —
  act or ack, never ignore. Design for idempotence.
- `flag`'s human-readable line reports unacked debt; the `--raw` wire
  form stays EXACTLY three fields (old clients parse it positionally).

## Polling discipline (STANDARD — 2026-07-18)

Mail is PULL, not push. An agent only "gets" a message when it runs
`peek`/`inbox`. Local dev-PC agents may be harness-woken on arrival;
**remote lanes (own clone / another machine) have NO wake trigger and
see mail only when they poll.** So every agent MUST poll:

- **At task start and task end** (the long-standing rule), AND
- **Every ≤5 minutes while active on a long task** — a build, a soak,
  a sweep. A ruling or a lock-collision warning that sits unread for
  20 minutes is a stall.
- **On wake / session resume**, before judging lane state.

Use `peek --as <role> --headers` to poll — it is NON-CONSUMING (does
not deliver), so polling repeatedly is free and safe; expand one with
`show @hash`; `inbox` delivers (then `ack` settles — see the delivery
section above). `who` prints per-role unread counts at a glance.

Multi-recipient routing: a message `--to a,b,c` is unread for EACH of
a, b, c independently (fixed 2026-07-18 — before that an exact-string
match meant `--to architect,sim-runner` was invisible to a lane
polling as just `sim-runner`; if you polled clean but the architect
insists a message was sent, that was the bug — re-poll after the
hub restart).

## Coordinator alias + escalation (STANDARD — 2026-07-19)

**`coordinator` is a role ALIAS for whoever holds coordination/arbitration
(currently `architect`).** Address rulings and blockers to `coordinator`, not a
hardcoded name — if the baton ever moves, one line in `.agent-mail/roles`
re-points it and no spec changes.

- **Blocked, or need a ruling? Mail `coordinator` (tag `blocked`) — do NOT go
  quiet.** Silence is not a status: a stuck lane that says nothing is
  indistinguishable from one making progress. Raise your hand.
- **Emit a one-line status on task PICKUP and on DONE.** That plus `who` +
  message timestamps is how staleness is spotted. No per-step heartbeats.
- The alias is read-time + additive: `send --to coordinator` reaches the
  canonical inbox; `--to architect` still works; the two share one cursor (no
  double-reads). `who` shows the map (`(alias) coordinator → architect`).
- The alias file `.agent-mail/roles` lives on the HUB clone only — remote lanes
  proxy every command to the hub, which resolves server-side. Re-point: local
  lanes instant, remote lanes on the next hub restart (like any code change).
  Format: `alias = canonical` per line, `#` comments. Design: `specs/coordinator-role-alias.md`.

## Status board — liveness without flooding the log (STANDARD — 2026-07-19)

Silence is ambiguous (working vs stalled vs offline). The **status board** removes
that ambiguity WITHOUT adding heartbeat messages: `agent-mail.py status --as <role>
"<state>"` overwrites a one-line per-role status (`.agent-mail/status-<role>`) — it
does NOT append to the message log. `agent-mail.py status` prints the whole board
(each lane's state + age; a `working` status older than ~15m and not marked `long`
gets a ⚠STALE hint).

**Every lane keeps its status line current.** Three states:
- `waiting` — idle, queue empty. This is a REQUEST to the coordinator for work, not a
  failure. An old `waiting` is fine; it means "still idle, still here."
- `working <X>` — actively on X.
- `working <X> (long ~Nm)` — set this BEFORE any operation that will block you silent
  for more than ~10 min (a soak, a re-record, a build). Then your silence is EXPECTED
  until the ETA — it is not a stall.

**When to update:** at task pickup, at done, on any state change, and before a long op.
Aim to keep it fresher than ~10 min while active. You do not mail these — you just
overwrite your status line. The coordinator reads the board each sweep and pings only
lanes that are `working`, stale (>15m), and NOT marked `long`. Blocked? still mail
`coordinator` (tag `blocked`) — the board shows liveness, mail carries the ask.

Honest limit: an idle session nobody is driving cannot post — but the board still
tells the coordinator *waiting* vs *long-op* vs *genuinely-stale*, which is the point.

## Work stacks — front-load routing, idle lanes self-serve (STANDARD — 2026-07-19)

A per-lane FIFO work queue so a lane never sits idle waiting for the coordinator to
hand-route the next task. The coordinator STOCKS each lane's stack; an idle lane PULLS
its next item itself.

- `agent-mail.py queue add --for <lane> --tag t --body-file f` — append a ready work
  item to a lane's stack (short items: `--body "…"`; substantive: `--body-file`, same
  as `send`). Coordinator-curated.
- `agent-mail.py queue take --as <lane>` — the lane pops its NEXT item (FIFO), prints
  it, removes it. The lane then acts on it and posts `status --as <lane> "working: …"`.
- `agent-mail.py queue list [--for <lane>]` — every lane's backlog depth + items (so the
  coordinator restocks proactively).
- `agent-mail.py queue drop --for <lane> --id N` — cancel/remove a queued item.

**Convention:** a `waiting` lane with a non-empty queue **takes its next item itself** —
no coordinator push needed; when its queue empties it goes `waiting` (the board signal to
restock). Still claim locks + do the pre-open ritual for a golden window before editing.

**Consistency:** a lane is a single stream, so its own stack **serializes by
construction** (the engine lane's queue is pulled one window at a time — exactly the
serialization we need). The coordinator's job stays CURATION: order each queue correctly
and never queue the SAME golden files to two lanes. Canonical (`--for coordinator` →
architect's queue). Files: `.agent-mail/queue-<lane>` on the hub.

## Mailbox flag — the 10-minute poll (STANDARD — 2026-07-21)

Like the raised flag on an American mailbox: one cheap command that answers
"is there anything for me?" in a single line, combining THREE signals —
unread mail, queued work-stack items, and a manually raised note.

```bash
python3 tools/agent-mail.py flag --as helper     # check — poll at least every 10 min
# → flag down (helper: no unread, queue empty)
# → FLAG UP (helper): 2 unread → `inbox …` · queue 3 → `queue take …` · note from architect 4m ago: …
python3 tools/agent-mail.py flag raise --for helper --as architect --why "spec X changed, re-read"
python3 tools/agent-mail.py flag lower --as helper   # after acting on the note
```

**Discipline: EVERY lane checks its flag at least every 10 minutes — in
every state, including `waiting`.** A waiting pattern is not an exemption;
it is the main case the flag exists for (the stale-idle incidents were all
"lane sat waiting while work existed"). Between test runs, during long
ops, on wake: `flag --as <you>` first. FLAG UP names the exact next
command to run.

- Mail and queue signals clear themselves when consumed (`inbox` +
  `ack` settle; `queue take` pops). Only the manual note needs an explicit
  `flag lower --as <you>` — lower it when ACTED ON, not when merely seen.
- `flag raise` covers "new work/update" signals with no new mail behind
  them: a spec file changed, a ruling landed, a parked lane should resume.
  Keep `--why` a one-line pointer (no backticks/`$` — the send guard
  checks it); anything substantive is a mail, with the flag as the nudge.
- Workers keep ONE outbound signal: `flag raise --for coordinator --as
  <role> --why "see status board"` when they need attention NOW (the send
  guard restricts mail-send; the flag is the doorbell, the status board
  carries the detail).
- The board (`status`) marks lanes with a raised note `· 🚩flag`;
  `inbox`/`peek` also print a pending note so it cannot be missed.
- This complements (does not replace) the ≤5-min `peek --headers` rule
  while ACTIVE on a task; the flag is the floor that holds even when idle.

## The idle-lane listening loop — `flag wait` (STANDARD — 2026-07-22)

**Why this exists (the root cause of the nudge problem):** an agent
session only executes while it has a live turn. A lane that ends its
turn "waiting" runs NOTHING afterward — the 10-minute poll promise
cannot be kept from an ended turn, which is why raised flags and
queued items sat unseen until a human nudged the session. The failure
was scheduling, not visibility: every signal was in the store; no code
was running to look.

`flag wait` closes the gap mechanically — a BLOCKING check that
returns the moment there is something NEW, else after `--timeout`
(default 540 s, sized under a 600 s shell-tool cap):

```bash
python3 tools/agent-mail.py flag wait --as helper          # blocks up to 9 min
# → FLAG UP (helper): 1 unread → `inbox …`                 (returned early: act on it)
# → flag down … — nothing new after 540s; run `flag wait` again to keep listening
```

**The ritual — never end a turn silent:** when you would otherwise go
idle (waiting, holding, blocked on another lane), do NOT end your
turn. Run `flag wait --as <you>` as your next action. When it returns
FLAG UP, act on what it names in the same turn. When it returns
"nothing new", run `flag wait` again. Repeat until there is work or
the human closes the session.

- Semantics: unread mail or a raised note return IMMEDIATELY; standing
  queue depth does NOT (a holding lane may have a stocked queue it
  cannot take mid-pipeline) — queue triggers only on an INCREASE while
  waiting. An idle-with-queue lane should `queue take`, not wait.
- Long ops: run sweeps/builds in the BACKGROUND and `flag wait` in the
  foreground — the lane stays reachable during its longest work.
- The loop runs client-side (one cheap poll per `--interval`, default
  15 s), so it is identical on hub-remote clones and never blocks a
  hub thread. Requires hub restart on upgrade (hubs run loaded code).
- This SUPERSEDES "check at least every 10 minutes" as the waiting
  mechanism: the 10-min floor remains the rule while ACTIVE between
  tool calls; `flag wait` is how a lane keeps the promise while idle.

## The first line IS the subject (STANDARD — 2026-07-20)

There is no `--subject` flag and there should not be one: `--headers` renders
**the message's first line, truncated to 100 chars**, as the subject
(`hdr()`, agent-mail.py). Since `--headers` is the DEFAULT read, that one line
is what every recipient sees first, and often all they read before deciding
whether to `show` the body. Write it deliberately.

**Write line 1 as a subject, not as the opening of a sentence.** It must stand
alone when severed from line 2 — a prose opener reads as a fragment once cut:

```
GOOD  XII.5 SPACE-DRIVE — FIRST WITNESS (branch b7d09db) vs #1706 baseline.
GOOD  #1870 OOM SLICE 2a DELIVERED — in-RAM log growth BOUNDED (turn-2623 root).
GOOD  LAND #1752 crash resilience → dev_night — DONE, GREEN. Clear to tag marker-0066.
BAD   Architect/coordinator is back online after another dev-PC reboot. Resuming
      ^ real header (#1905): written as prose, cut mid-sentence, says nothing
```

Rules of thumb:

- **≤100 chars**, or it is truncated with `...` — put the payload first.
- **Lead with the verdict**: DELIVERED / BLOCKED / DONE, GREEN / HELD, plus the
  item id. A lane triaging 20 headers is scanning for state, not narrative.
- **Carry the identifiers** a reader needs to act: item number, branch, hash,
  marker. `#1870`, `b7d09db`, `marker-0066`.
- **The `--tag` classifies; the subject reports.** `--tag done` says what kind
  of message it is; line 1 says what actually happened.
- With `--body-file` you cannot see the header you are producing at send time,
  so check line 1 before sending — or `peek --headers` afterwards to confirm it
  reads correctly.

## Everyday commands (local)

The body rules are MECHANICALLY ENFORCED on the dev PC
(`.claude/hooks/guard-agent-mail-send.sh`, PreToolUse): heredoc bodies,
echo/printf pipes into `send`, backticks/`$` or newlines inside an inline
`--body` (send AND `queue add`) are all denied with the fix in the message —
plus the older guards (`--tag noop`, self-directed worker sends). If the
hook blocks you, do what it says: Write the body to a file, then
`--body-file PATH`.

```bash
# mail — send prints a RECEIPT ONLY ("queued <tag> #<id> → <to>"), never the body
python3 tools/agent-mail.py send --from architect --to helper "A11 is a go"   # short prose OK inline
python3 tools/agent-mail.py send --from helper --to architect --tag done --body-file done.md   # multi-line: body in a FILE (keeps it out of the transcript)
echo "long body" | python3 tools/agent-mail.py send --from x --to y -   # or stdin (hub-safe since 2026-07-16)
python3 tools/agent-mail.py send --from helper --to all "broadcast"
python3 tools/agent-mail.py peek  --as helper --headers   # DEFAULT read: one line/msg (id/from→to/tag/FIRST LINE = the subject, ≤100 chars), does NOT mark
python3 tools/agent-mail.py inbox --as helper --headers    # DELIVERS (15m ack window; prints the ack line)
python3 tools/agent-mail.py ack @a1b2c3d4 @e5f6a7b8 --as helper   # SETTLE what you acted on (or #ids)
python3 tools/agent-mail.py inbox --as helper --ack        # deliver + settle in one (reading IS acting)
python3 tools/agent-mail.py show <hash-prefix>     # expand ONE message's full body by @hash (or #id-prefix)
python3 tools/agent-mail.py inbox --as architect --tag done   # filter by tag (touches ONLY displayed msgs)
python3 tools/agent-mail.py log [-n 20]            # recent traffic, all parties
python3 tools/agent-mail.py who                    # canonical roles + unread counts + alias map
python3 tools/agent-mail.py status --as helper "working: XII.2 future-tech (long ~20m)"  # overwrite YOUR status line
python3 tools/agent-mail.py status                 # print the presence board (each lane's state + age; ⚠STALE hint)
python3 tools/agent-mail.py queue add --for helper --tag xii2 --body-file item.md  # stock a lane's work stack
python3 tools/agent-mail.py queue take --as helper  # idle lane pops its next item (FIFO)
python3 tools/agent-mail.py queue list              # every lane's backlog depth + items
python3 tools/agent-mail.py flag --as helper        # the 10-min poll: unread + queue + raised note, one line
python3 tools/agent-mail.py flag wait --as helper   # BLOCKING poll — the idle-lane loop (returns on new signal or 540s)
python3 tools/agent-mail.py flag raise --for helper --as architect --why "spec X changed"
python3 tools/agent-mail.py flag lower --as helper  # after acting on the note

# file locks — LEASES since 2026-07-24 (45m default; expire on their own)
python3 tools/agent-mail.py lock client/main.js --as helper --why "A28 e2e"   # 45m lease
python3 tools/agent-mail.py lock client/main.js --as helper --why "A28 e2e" --ttl 90  # longer op
python3 tools/agent-mail.py lock client/main.js --as helper --why "A28 e2e"   # re-run = RENEW
python3 tools/agent-mail.py locks                  # who holds what, with time REMAINING / EXPIRED
python3 tools/agent-mail.py unlock client/main.js --as helper
python3 tools/agent-mail.py unlock client/main.js --as architect --force
```

Conventions:
- Roles are free-form (`architect`, `helper`, `bugfixer`,
  `roblox-helper`, `sim-runner`, …). `--to all` broadcasts.
- Tags: `done | question | fyi | claim | measure` make filtering easy.
- Every message has a global `@hash` (8 hex chars, content-derived,
  identical for every reader) — refer to messages by hash across
  inboxes and sessions.
- Check `locks` BEFORE editing any shared file; lock what you edit;
  unlock when your done-mail goes out. Only the holder (or the
  architect with `--force`, which logs a broadcast) may unlock.
  A LIVE lock held by someone else = mail them or the architect —
  never edit through it. Locks are LEASES (45 min default, `--ttl N`
  for longer ops): re-run `lock` to renew a long hold; an EXPIRED
  lease is free to take (the takeover broadcasts, same as `--force`),
  and the hub's reaper also frees expired leases on its own — so a
  crashed lane can no longer wedge a file until a human intervenes.
- Forgiving flags: the identity flag is `--from`/`--as`/`--role`/
  `--sender` interchangeably on every command that takes one; the
  send body may be positional OR `--body`/`--text`/`--message`/`-m`
  OR `--body-file PATH` OR stdin `-`; lock's `--why` also answers
  to `--reason`.
- **Output-style rule (user ruling 2026-07-17 — avoids transcript
  body-echo):** send prints a receipt only (`queued <tag> #<id> →
  <to>`) — the body lives in the mail file, never re-print it.
  **Write the body as a SEPARATE step with the file-write tool
  (not a heredoc, not echo/printf, not inline `--body`), THEN send
  `--body-file PATH` as its own command — two calls. A heredoc or
  inline body streams the whole body into the transcript and
  defeats `--body-file`.** A trivial one-line ack may inline
  `--body`; anything multi-line goes to a file first. Read inboxes
  with `--headers` by default (one line/msg); expand exactly one
  with `show #<id>`/`@<hash>` when you need the body. Never pipe an
  inbox dump and a body echo into one output. Keep detailed plans/
  specs in the body or spec files, referenced by ID/path in any
  stdout summary.

## Across the LAN (or any direct IP): the hub

One machine — normally the dev PC, the same box the architect runs
on — serves the SHARED store; every other clone proxies to it. Same
commands, same output, one mailbox and ONE lock registry across all
machines.

### 1. Start the hub (on the machine that owns `.agent-mail/`)

```bash
python3 tools/agent-mail.py serve --port 8970 --host 0.0.0.0
```

Run it in the background / a spare terminal; it is a tiny HTTP server
over the same files, so local commands on this machine keep working
unchanged alongside it.

**After ANY dev-PC reboot (measured 2026-07-20):** the hub process dies
with the machine and remote lanes report "hub down" — restart it with the
command above, then verify BOTH hops: `curl -s http://127.0.0.1:8970/`
(hub itself) and `curl -s http://<LAN-IP>:8970/` (the Windows portproxy
path). The portproxy's `connectaddress` must match the CURRENT
`wsl hostname -I` — WSL's NAT IP can change across reboots; if it did,
re-run the `netsh` add (delete the old rule first:
`netsh interface portproxy delete v4tov4 listenport=8970`).

**WSL note (dev PC):** WSL's network is NAT'd — to reach the hub from
another PC, forward the port and open the firewall once, in an ADMIN
PowerShell on the Windows side:

```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=8970 `
  connectaddress=$(wsl hostname -I).Trim() connectport=8970
netsh advfirewall firewall add rule name="RetroMultiCiv mail 8970" `
  dir=in action=allow protocol=TCP localport=8970
```

### 2. Point the other clones at it (one line, once per machine)

In the OTHER machine's repo clone:

```bash
echo http://192.168.1.112:8970 > .agent-mail/remote
```

That's it — every `agent-mail.py` command on that machine now proxies
transparently to the hub. Alternatively set the `AGENT_MAIL_URL`
environment variable to the same URL (useful for one-off commands or
CI-like contexts); the file takes effect for everyone in the clone,
the env var only for the shell that sets it.

To go back to a purely local mailbox: delete the `remote` file.

### 3. Gotchas, measured the hard way

- **IP drift**: DHCP moves the hub machine's address (this PC has
  been .116 and .112 in the same week). If the hub stops answering
  after a reboot: re-check `ipconfig` on the hub machine and update
  the one-line `remote` file on the others — or reserve the IP in
  the router / use the Windows hostname in the URL instead.
- **Hub restart required after editing agent-mail.py**: remote
  clients send raw argv; PARSING happens hub-side with the code the
  hub process loaded at startup. New flags/aliases don't exist for
  remote callers until the hub restarts (local callers pick them up
  immediately).
- **Absolute paths**: run commands as
  `python3 /path/to/repo/tools/agent-mail.py …` (or from the repo
  root) — a shell whose cwd wandered into a scratch clone will
  happily read that clone's EMPTY `.agent-mail/` and report "no
  unread" (this has actually happened).
- **Trusted-LAN posture**: no auth, same stance as the game server.
  Don't expose the hub port beyond the LAN; the mailbox carries
  work-coordination text, and locks are advisory-but-mandatory
  convention, not security.
- **Code still travels by git.** The hub carries mail and locks
  ONLY. The user pumps commits between machines; a claim mail can
  reference files the other machine won't see until the next push.

## Deployment topologies — which setup for which situation

Three ways to run a multi-agent team, in increasing order of reach. All
three use the SAME commands; only the store location and the hub differ.

### Topology A — multiple agents, ONE PC, ONE shared repo clone

The simplest and the dev-PC default (architect + helper + bugfixer as
separate Claude/terminal sessions in the same checkout).

- **Setup: none.** `.agent-mail/` lives in the clone; every session reads
  and writes the same files directly. No hub, no `remote` file.
- **What matters most here: LOCKS.** A shared working tree means two
  agents editing one file is immediate corruption (not merely a later
  merge conflict) — `lock <file> --as <role>` before touching any shared
  file is non-negotiable. Also: uncommitted work is visible to every
  session, so no agent runs destructive git ops (checkout/stash/reset)
  — one designated session (here: the architect) commits.
- Only ONE golden window can be open at a time (one tree = one test
  state); the lock registry is what enforces whose window it is.

### Topology B — multiple agents, one PC, SEPARATE clones

A lane that must not share a working tree (e.g. a robustness lane that
runs divergent builds, or a read-only reviewer) gets its own clone on
the same machine.

- **Setup:** run the hub in the PRIMARY clone (the one whose
  `.agent-mail/` is canonical): `python3 tools/agent-mail.py serve`.
  In each SECONDARY clone: `echo http://localhost:8970 > .agent-mail/remote`.
  Every command in the secondary clone now proxies to the primary store.
- Locks here protect against divergent EDITS (merge conflicts), not tree
  corruption — code moves between clones via git branches, mail/locks/
  status/queues/flags move via the hub instantly.
- Watch the **absolute-paths gotcha** above: a shell sitting in the wrong
  clone with no `remote` file reads that clone's empty store and reports
  "no unread".

### Topology C — multiple PCs, multiple agents, multiple clones per PC

The full current setup (dev PC: hub + shared-clone lanes; second PC:
sim-runner + reviewer + roblox-helper, each in their own clone).

- **Setup:** hub on the PC that owns the canonical store (see "Across
  the LAN" above, including the WSL portproxy/firewall steps). Every
  clone on every OTHER machine gets the one-line `remote` file with the
  hub's LAN URL. One mailbox, one lock registry, one status board, one
  set of queues and flags — LIVE across all machines.
- **Code still travels by git** — each machine needs a git operator
  (a human, or one designated agent with an explicit push/pull grant).
  A mail can reference a commit the other machine hasn't pulled yet;
  the receiving lane pulls before acting.
- Remote lanes have NO wake trigger — this topology is WHY the polling
  discipline and the 10-minute flag floor exist. A remote lane that
  doesn't poll is deaf.
- After editing agent-mail.py itself: restart the hub, or remote lanes
  keep the old command set.

## Coordinator setup — checklist

One session holds coordination (role `coordinator`, an alias — see
above). To stand a team up from scratch:

1. **Pick the canonical clone** (where `.agent-mail/` lives) and, for
   topologies B/C, start the hub there and distribute `remote` files.
2. **Point the alias:** `.agent-mail/roles` → `coordinator = architect`
   (or whichever role holds the baton).
3. **Name the lanes** (see naming rules below) and write each lane's
   role name into its onboarding prompt.
4. **Stock the queues** (`queue add --for <lane> …`) BEFORE waking the
   lanes — a lane that wakes to a stocked queue starts working; one that
   wakes to silence starts waiting.
5. **Post your own status** and start your review cadence: read the
   board (`status`), re-ping only working-and-stale lanes, keep queues
   from running dry, raise flags for no-mail updates.
6. **Separate-clone task mails NAME the expected git tip** (user
   directive 2026-07-22): every task routed to a lane on its own clone
   (sim-runner, roblox-helper, …) starts with "git pull origin
   <branch> first — expect tip <sha>". Remote lanes forget the pull;
   a measurement or re-bake on a stale tree looks green and is wrong.
   The lane reports a tip mismatch before running, never around it.

### Suggested coordinator prompt (template)

> You are the coordinator for <project> (mail role `coordinator`, alias
> for `<architect>`). Repo: <path>. Mail tool:
> `python3 tools/agent-mail.py` — read `tools/agent-mail.md` first.
> Cadence: every ~20 min read the status board (`status`), the queue
> depths (`queue list`), and your inbox (`peek --as coordinator
> --headers`); check your own flag every ≤10 min (`flag --as
> coordinator`). Your job is CURATION: keep every lane's queue stocked
> and correctly ordered, never queue the same contested files to two
> lanes, arbitrate lock collisions, answer `blocked` mail first. Workers
> cannot mail — their doorbell is your flag plus their status line, so
> a raised flag means "read the board now". Report state, not agency.

## Onboarding a NEW agent session

### Naming rules

- **One role name per lane, kebab-case, named for the FUNCTION** —
  `helper`, `bugfixer`, `reviewer`, `sim-runner` — not for the model or
  the machine. A second lane of the same function: `helper2`.
- **The name must stay stable across that lane's sessions**: cursors,
  status, queue, and flag files all key on it
  (`.agent-mail/cursor-<role>` etc.). A restarted session that picks a
  NEW name orphans its predecessor's unread cursor and queue.
- **Never run two concurrent sessions under one name** — they will
  consume each other's inbox (the cursor is shared) and take each
  other's queue items.
- The coordinator assigns names; a session never invents its own. If a
  session doesn't know its name, it asks (or reads its onboarding
  prompt) — it does NOT guess.

### The startup ritual (every new/resumed session, any topology)

```bash
python3 tools/agent-mail.py flag --as <role>       # anything for me?
python3 tools/agent-mail.py peek --as <role> --headers   # read subjects; `show @hash` to expand
python3 tools/agent-mail.py status --as <role> "working: <task>"  # or take from queue first
python3 tools/agent-mail.py queue take --as <role> # if idle — pull, don't wait
python3 tools/agent-mail.py flag wait --as <role>  # NOTHING to do? — listen, never end the turn silent
```

Separate-clone lanes (topologies B/C): `git pull` BEFORE judging any
lane state — mail may reference commits you don't have yet. Shared-clone
lanes (topology A): do NOT pull/checkout — the tree belongs to the
designated committer.

### Suggested new-agent prompt (template)

> You are `<role>` for <project>, one lane of a multi-agent team
> coordinated by mail. Repo clone: <path>. Your mailbox role name is
> `<role>` — use it as `--as <role>` on EVERY agent-mail command; never
> use another name. Read `tools/agent-mail.md` (the STANDARD sections)
> and CLAUDE.md before working. On start and every ≤10 min while active:
> `python3 tools/agent-mail.py flag --as <role>` — FLAG UP names your
> next command. When idle, `queue take --as <role>` — pull work, don't
> wait. When there is truly nothing to do (waiting/holding/blocked),
> NEVER end your turn: run `flag wait --as <role>` — it blocks until a
> signal arrives (or 9 min); act on FLAG UP, on "nothing new" run it
> again. Run long commands in the background so you can keep listening.
> Keep your status line current (`status --as <role> "…"`; mark long ops
> `(long ~Nm)`). Lock files before editing (`lock <file> --as <role>
> --why "…"`), unlock when your work lands. Blocked or need a ruling:
> raise the coordinator's flag and put the detail in your status line.
> [Topology B/C add: your clone talks to the hub via `.agent-mail/remote`
> — if commands fail with "hub unreachable", report it in your status,
> don't delete the file. `git pull` at session start.]
> [Topology A add: shared working tree — never git checkout/stash/reset;
> the architect commits.]

The templates are STARTING POINTS — a real onboarding prompt also
carries the lane's role spec (its files, its authority, its
verification duties; see `docs/10-roblox-agent.md`,
`docs/17-hardening-agent.md`, `docs/18-reviewer-agent.md` for worked
examples).

# agent-mail — mailbox + file locks for the agent fleet

`tools/agent-mail.py` is a tiny file-backed mailbox and lock registry
for the architect and any number of coder agents. Storage is
`.agent-mail/` at the repo root (gitignored): `messages.jsonl`
(append-only) + one unread-cursor file per reader + `locks.json`.

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
not advance your cursor), so polling repeatedly is free and safe;
expand one with `show @hash`; only `inbox` marks read. `who` prints
per-role unread counts at a glance.

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

## Everyday commands (local)

```bash
# mail — send prints a RECEIPT ONLY ("queued <tag> #<id> → <to>"), never the body
python3 tools/agent-mail.py send --from architect --to helper "A11 is a go"   # short prose OK inline
python3 tools/agent-mail.py send --from helper --to architect --tag done --body-file done.md   # multi-line: body in a FILE (keeps it out of the transcript)
echo "long body" | python3 tools/agent-mail.py send --from x --to y -   # or stdin (hub-safe since 2026-07-16)
python3 tools/agent-mail.py send --from helper --to all "broadcast"
python3 tools/agent-mail.py peek  --as helper --headers   # DEFAULT read: one line/msg (id/from→to/tag/first line), does NOT mark
python3 tools/agent-mail.py inbox --as helper --headers    # same, marks read
python3 tools/agent-mail.py show <hash-prefix>     # expand ONE message's full body by @hash (or #id-prefix)
python3 tools/agent-mail.py inbox --as architect --tag done   # filter by tag (add --headers)
python3 tools/agent-mail.py log [-n 20]            # recent traffic, all parties
python3 tools/agent-mail.py who                    # canonical roles + unread counts + alias map
python3 tools/agent-mail.py status --as helper "working: XII.2 future-tech (long ~20m)"  # overwrite YOUR status line
python3 tools/agent-mail.py status                 # print the presence board (each lane's state + age; ⚠STALE hint)
python3 tools/agent-mail.py queue add --for helper --tag xii2 --body-file item.md  # stock a lane's work stack
python3 tools/agent-mail.py queue take --as helper  # idle lane pops its next item (FIFO)
python3 tools/agent-mail.py queue list              # every lane's backlog depth + items

# file locks (the claim protocol, made mechanical)
python3 tools/agent-mail.py lock client/main.js --as helper --why "A28 e2e"
python3 tools/agent-mail.py locks                  # who holds what, with age
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
  A lock held by someone else = mail them or the architect — never
  edit through it. Stale locks (see the age column) get arbitrated,
  not ignored.
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

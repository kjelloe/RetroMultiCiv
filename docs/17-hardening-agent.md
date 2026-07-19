# The hardening agent — role spec (server robustness lane)

A dedicated agent that makes the hosted LAN/public server stay
**responsive and fair under heavy or abusive load** — a single
misbehaving or runaway client must never be able to make the game
slow or useless for everyone else, and the host machine must stay
well-behaved under traffic floods and rapid connect/disconnect churn.
This is a robustness/resilience lane, not a feature lane.

## Vocabulary (house rule for THIS lane — everyone mailing this agent uses it too)

Use plain robustness language. Do **not** use the words that name the
adversarial field, exploitation, or striking — say it in operational
terms instead:

| Say this | Not this |
|---|---|
| hardening / robustness / resilience | (the field name) |
| traffic flood / load storm / overload | (the strike word) |
| abusive / misbehaving / runaway client | malicious |
| gap / weak spot / failure mode | exploit / vulnerability |
| load model / abuse model / failure model | threat model |
| fairness / responsiveness under load | (the field name) |

The point of the lane is availability and fairness under stress. Keep
the framing operational and the words neutral.

## Operating model (mirrors docs/10 / docs/11)

- **Own repo clone.** Code travels between clones via git, pumped by
  the user — commit + push your lane's work; the user brings it into
  the other clones. Never assume another clone sees your uncommitted
  tree.
- **Coordination via the agent-mail hub + lock registry** (live across
  clones/machines — `python3 tools/agent-mail.py`). Check your inbox at
  task start and end. **Blocked or need a ruling? Mail `coordinator` (tag
  `blocked`) — the role alias for whoever coordinates; do not go silent,
  silence is not a status.** Claim any shared file with
  `lock <file> --as hardening --why "…"` before editing; `unlock` when
  your done-mail goes out. The registry answers "may I edit this right
  now"; the mail carries the why + the regions.
- **Branch discipline:** verify `git symbolic-ref --short HEAD` before
  any commit-adjacent op — the shared tree can change branches when the
  user preps a merge.

## Exclusive lane (files this agent owns)

- `server/limits.js` — the rate/budget/cap logic. Owned outright.
- The **connection-admission and command-handling paths** inside
  `server/index.js` (the `onConnect`/`onDisconnect` wiring, the
  `cmd`/`endTurn` handling, the create/join rate hooks). The
  lobby/resume/rotation paths in the same file belong to the **helper**
  lane — lock `server/index.js` and name the region before editing, and
  coordinate if the edit crosses into a helper region.
- `docs/16-security-assessment.md` and `reports/infosec-remaining.md`
  are the detailed source records (they keep their existing headings for
  the human specialist who reads them); this agent updates the technical
  findings/status in them but need not adopt their headings in its own
  output. **docs/17 (this file) is the self-contained lane brief — you
  do not need the other two to start.**

## Report-only protocol

Operate INSIDE the lane without narrating. **Only mail the architect
(or another agent) when you need to coordinate work OUTSIDE your lane** —
e.g. a change would touch `server/protocol.js`, `engine/`, `client/`, a
helper-owned region of `server/index.js`, or needs a decision/golden
window you cannot take alone. Routine in-lane progress does not need a
report; a short done-mail per shipped slice (what changed + the red
test) is enough for the record. No status chatter.

## The queue (ranked — self-contained, neutral wording)

Each item ships as its own slice with a **failing test FIRST** (the
red case), then the fix; all clock-injectable where timing matters; all
**server-only and golden-neutral** (never touches engine/data rulesets,
so replay hashes never move).

0. **Per-connection command budget — highest impact (started games).**
   A single joined player sending commands as fast as it can currently
   makes the game unresponsive for everyone (measured: one such client
   pushed a co-player's command→acknowledge time from ~1 ms to ~4.5 s;
   three of them = no responses at all). Per-connection caps for
   connecting and joining do nothing here, because such a client is one
   normal admitted connection on one normal seat. Fix: a per-connection
   token-bucket on the `cmd`/`endTurn` path — cheap-reject over budget
   with the existing `{t:'rejected',code:'rateLimited'}` shape; consider
   a per-turn command sanity cap. The sim-runner holds a re-runnable
   load harness that reproduces the slowdown — use it as the red case
   and to A/B the bucket size (a legit fast-clicker must stay under the
   overload threshold). Coordinate the harness hand-off by mail.
1. **Per-IP connect-rate window.** `server/limits.js` today caps
   *concurrent* connections per IP but has no *rate* window, so rapid
   open/close cycles (~thousands/sec measured) slip under the
   concurrency cap and still saturate the loop and grow memory. Add a
   per-IP sliding-window connect-rate cap alongside the concurrency cap.
2. **`/ws` Origin allow-list.** WebSocket upgrades are not subject to
   the browser's cross-origin rules, so any web page a host's user
   visits can open a socket to a LAN/public server (name-rebinding even
   reaches localhost). Impact is bounded — such a client only gets its
   own seat, never another's token — but it is a distinct nuisance/
   resource surface. Add an optional Origin allow-list for public hosts,
   OFF by default on LAN.
3. **HTTP niceties (minor).** Explicit URL-length / header-size caps
   beyond Node defaults; `X-Content-Type-Options: nosniff` on static
   responses. Static-only surface, low impact.
4. **Token rotation on reconnect** (nice-to-have, not yet scheduled).
5. **Master-index trust surface (FUTURE — only when the public index
   ships).** Listings are unverified claims; the index must never be
   able to harm a listed server and vice-versa. Not code today.

## Definition of done per slice

Red test first → fix → red test green → the whole server test group
green in isolation → a short done-mail (change + the red case) →
commit on the working branch → unlock. The determinism/replay contract
is unaffected by construction (server-only), but say so in the mail.
**Additive-field slices: run the FULL suite (`node --test test/`), not just
`test/server-*.test.js` — an added return field reds an exact-match
`deepStrictEqual` outside your file set (`test/lobby.test.js` caught the
Part-B `reconnectId`); inject a fixed id/token fn there.**

## Shipped (merged to dev_night, 2026-07-18)

Delivered in small branch → push → architect-review → merge slices, each
`gamesim-golden-neutral` (server-only). Tests in `test/server-hardening.test.js`
+ `test/server-limits.test.js`; the reproducible flood harness in `hardening/`.

- **Slice 1** — malformed-frame CRASH FIX (a per-socket `ws.on('error')`; an
  unhandled protocol error otherwise throws + kills the server) + `maxPayload`
  64 KB + kick-path budget preserve.
- **Slice 2** — LAYERED command budget: `createBudgets()` per-SEAT buckets
  (shared across a seat's sockets — closes the multi-socket bypass) + a
  per-connection ALL-MESSAGE cap (closes vote/ping floods), the PRIMARY layer
  ON TOP of the shipped per-connection `createCommandBudget` backstop (architect
  ruling: layer, not replace). Combined sweep beat the baseline (278ms vs 834ms
  p50 at 6 flooders); defaults seat cmd 15/s+40, endTurn 2/s+4, msg 30/s+60.
- **Slice 2.5A** — server HEARTBEAT: ping every `--heartbeat-sec` (15s), a
  socket missing `--heartbeat-misses` (2) pongs is `terminate()`d so a locked
  phone's half-open socket becomes detectable (the load-bearing mobile fix).
- **Slice 2.5B** — lobby SEAT-GRACE: a dropped lobby seat is held
  'disconnected, reclaimable' for `--seat-grace-sec` (45s), reclaimed only by a
  private `reconnectId` and only while DISCONNECTED (never a live seat).
  Client store+present-on-wake is Part C (helper).

**In flight — Slice 3** (public-hosting hardening, #1552): per-IP connect-rate
in the handshake + proxy-aware IP (`--trust-proxy`), Origin allow-list, static
`nosniff`/Cache-Control/URL cap, `send()` backpressure, HTTP timeouts,
silent-squatter timeout, SIGTERM/SIGINT, boot posture line. Sub-sliced for small
reviews.

**Cross-lane findings (2026-07-18) — CLOSED by the helper (H-1 a–d):** the
`listSaves` resume-code disclosure, the `list` private-joinCode leak, the
unthrottled saves scan (now a 2 s-TTL cached scan), and the resume-crash on a
corrupt save. Recorded here for the trail; see docs/16 §3.

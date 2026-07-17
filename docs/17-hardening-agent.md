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
  task start and end. Claim any shared file with
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

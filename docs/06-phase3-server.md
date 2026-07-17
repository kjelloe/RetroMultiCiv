# Phase 3 — Authoritative Node server: design

Status: **IMPLEMENTED** (slices 1–4, 2026-07-12; slice 5 = the human socket
playtest). The protocol here supersedes and expands `02-architecture.md` §6
(which stays as the summary). Roadmap acceptance: a full game playable through
the socket; killing and restarting the server resumes from the save; a
tampering client's hand-crafted commands are rejected server-side.

## 1. What moves where

The engine does not change at all. What changes hands is the SESSION:

```
today   browser: ui ── session.js (state owner, apply, endTurn+AI, diag) ── engine
phase 3 browser: ui ── session-remote.js (same surface, speaks ws) ─┐
        node:                          server/game.js (state owner, ─┴─ engine
                                       apply, endTurn+AI, diag, saves)
```

`client/session.js` was built as this seam on purpose: the ui modules only
touch `session.state`, `session.apply(cmd)`, `session.endTurn()`,
`session.onChange(cb)`, `session.ruleset`. A remote session implements the
same five things over a WebSocket. The ui directory should need close to
zero changes — the one real impact is async apply (§5).

## 2. Server composition (new `server/`, plain Node, `ws` only)

- `server/index.js` — boot: static file hosting via `node:http` (same
  files `python3 -m http.server` serves today), ws upgrade, wiring. CLI:
  `node server/index.js [--port 8123] [--game saves/<id>.json]`.
- `server/game.js` — the authoritative session: owns `state` + `ruleset`
  (+ `rulesOverrides` from game options), applies commands through
  `engine`, drives AI turns after a human ends theirs (the loop
  `session.endTurn` runs today), records the diagnostics log
  (same `retromulticiv-diagnostics` format — `tools/replay.js` must verify
  server games unchanged), and persists (§6).
- `server/protocol.js` — message parsing/validation and seat auth (§4);
  pure functions where possible so they unit-test without sockets.
- No framework, no middleware, no npm install beyond the already-vendored
  `ws`.

## 3. Protocol (expands 02-architecture §6)

JSON text frames. Every client→server message carries `gameId` (phase 3:
the server hosts one game, but the field exists so phase 4 lobbies don't
change the shape) and, after join, the seat `token`.

```
client → server
  { t:"join",  gameId, name, seat? , token? }   # token = reclaim a seat (reconnect)
  { t:"cmd",   gameId, token, commandId, cmd:{...} }  # cmd = plain engine command
  { t:"endTurn", gameId, token, commandId }     # sugar for cmd {type:endTurn}
  { t:"ping" }

server → client
  { t:"joined",  playerId, token, view, ruleset, rulesOverrides }
  { t:"view",    view }                          # full filtered view (resync/turn hand-back)
  { t:"events",  events:[...], view }            # phase 3 ships view WITH events (simple);
                                                 # event-only increments are a phase-4 optimization
  { t:"rejected", commandId, code, message }     # code = engine reason; message = REASON_TEXT
  { t:"applied",  commandId, events }            # positive ack for the awaiting apply()
  { t:"turn",    activePlayerId, turn }
  { t:"gameOver", winner, victory }
  { t:"pong" }
```

Phase-4+ additions (lobby docs/08, resume docs/07, replay A47, regency
A40, find-a-game A41/A51 — the live catalog; server/index.js routes,
server/protocol.js validates):

```
client → server
  { t:"create", name, options }        # options: civs, humans, size, difficulty,
                                       #   combat ("bestof3"?), age, maptype (A82a,
                                       #   validated vs rules.mapTypes), allowSpectators,
                                       #   chat, public       → { t:"created", gameId, joinCode }
  { t:"join", joinCode|gameId, name, seat?, spectator?, seatCode?, token? }
                                       # pre-start → { t:"joinedLobby", seat, lobby }
                                       # started   → { t:"joined", …, code, seatCode, gameId }
  { t:"joinListed", gameId, name, seat? }  # A41: browse join — SAME reservation path as a code
  { t:"list" } / { t:"listGames" } / { t:"listSaves" }   # listGames: public lobbies, 1/sec/conn
  { t:"start" } / { t:"setSlot"… } / { t:"setChat", on } / { t:"kick", seat } / { t:"chat", text }
  { t:"resume", file } / { t:"resumeByCode", code }      → { t:"resumed", gameId }
  { t:"skipTurn" }                     # host-only; { t:"proposeSkip" } + { t:"vote" } = the >2/3 path
  { t:"regent", stance|null }          # A40: the SERVER drives regent seats
  { t:"fullLog" }                      # A47: the whole recording, answered post-gameOver only

server → client (additions)
  { t:"code", code }                   # docs/07: the authoritative game code after every command
  { t:"lobby", lobby } / { t:"chat", … } / { t:"kicked" } / { t:"gameClosed", reason }
  { t:"saves", saves } / { t:"resumed", gameId } / { t:"started" }
```

CLI flags beyond the boot basics (the parser in server/index.js is the
truth): `--humans N`, `--reset-seats` (resume with seats cleared),
`--announce <master-url>` + `--public-name` + `--public-addr` (A51b,
docs/12 §6), plus the A50 rate/cap/lifecycle/rotation tuning flags
documented in docs/how-to-host.md.

Rules:
- **The server stamps `playerId`.** The engine command's `playerId` field
  is overwritten with the seat bound to the connection's token before
  `applyCommand` — a tampering client that hand-crafts
  `{playerId:"p2"...}` is not even rejected, it is corrected and then
  rejected by the engine (`notYourTurn`/`notYourUnit`). Test this exact
  case; it is the roadmap's acceptance bullet.
- `commandId` is client-generated (monotonic int per connection) and only
  echoed — the server keeps no command state per id.
- Views come from `engine/visibility.js` `filterView(state, seat)` — the
  leak contract in test/visibility.test.js is the security boundary.
  `rngState` never crosses the wire (already excluded by filterView).

## 4. Seats and tokens (phase-3 minimal, phase-4 ready)

On first join the server assigns the first free human seat and returns a
random `token` (from `node:crypto`, NOT the game RNG — this is the one
place non-deterministic randomness is correct; it never touches state).
Token → seat binding lives in server memory AND in the save envelope, so a
restarted server honors old tokens (reconnect = `join` with token).
Phase 3 plays one human + AIs; the seat model already supports more
humans, which is all phase 4's lobby needs.

## 5. Client: `session-remote.js` and the async seam

One new client module + a boot switch in main.js
(`?server=ws://host:port` or same-origin default when served BY the
server). The remote session:

- `state` = the latest server view (the panels/previews that read
  session.state keep working — a filtered view of your own empire carries
  everything the UI shows today; this formally ends the local-play
  shortcut of reading rival internals, which phase 3 was always meant to
  do).
- **Events ride the view push** (B5, 2026-07-14): every `{t:'view'}`
  carries `events` filtered per seat by `engine/visibility.js
  filterEvents` — the event-fog primitive (world news to all; own-only
  research; coordinate/party rule otherwise; omniscient spectators get
  everything; the Luau server reuses it verbatim in phase 5). Frame
  consumers must treat `msg.events` as OPTIONAL (older servers/saves
  replay without it). Side effect, deliberate: rival HUMANS' visible
  actions now reach other seats' turn logs as they happen — turn-log
  volume in LAN games grew accordingly.
- `apply(cmd)` returns a **Promise** resolving `{ok, reason?, events}`
  when `applied`/`rejected` arrives. The local session's `apply` gets the
  same Promise shape (resolved synchronously) so the ui has ONE contract.
  Call-site impact is small by design: `ctx.apply` in input.js is the
  funnel; the handful of direct `session.apply` users (panels, saves,
  setup flows) get `await`.
- `endTurn()` sends endTurn; the server runs the AI turns and pushes
  `events`+`view` (+`turn`); `onChange` fires exactly like today.
- Disconnect → banner + auto-retry join with the stored token.

Hotseat stays a LOCAL-session feature in phase 3 (two humans, one
keyboard, no server). Server games are 1 human + AI until phase 4.

## 6. Persistence & resume

Save envelope extends §7 of 02-architecture:

```json
{ "format": "retromulticiv-server-save", "version": 1,
  "gameId": "…", "seats": { "p1": "<token>" },
  "rulesOverrides": { }, "state": { … }, "diag": { … } }
```

Written atomically (tmp + rename) to `saves/<gameId>.json` (dir already
gitignored) after every accepted command batch — a turn-based game's write
rate is trivial. Boot with `--game <file>` resumes: state, seats, and the
diagnostics log continue seamlessly; `tools/replay.js` must verify a
recording that SPANS a server restart.

## 7. Testing plan

- `test/server-protocol.test.js` — unit: join/seat/token flows, playerId
  stamping, malformed frames (garbage JSON, unknown t, oversized), all
  pure via server/protocol.js.
- `test/server.test.js` — integration: boot on an ephemeral port, drive a
  real `ws` client: join → found city → endTurn (AI runs) → hash the view
  progression; kill server, reboot from save, token reconnect, assert the
  game continues with identical state hash. The tampering case: send a
  cmd with a forged playerId, assert rejection + no state change.
- Browser e2e: existing browser.test.js gains a served-by-server case
  (`node server/index.js` instead of the python server, `?e2e=1`) — the
  strongest proof that ui-over-socket works.
- The sim/goldens are untouched: the server calls the same engine; no
  golden re-records in this phase (a key review check for every slice).

## 8. Implementation slices (in order)

1. ✅ **[architect]** server/game.js + protocol.js with unit tests — the
   authoritative core, no sockets yet (pure function boundary).
   *(`test/server-protocol.test.js`.)*
2. ✅ **[architect]** server/index.js: ws + static hosting + integration test
   (boot/join/play/restart-resume). *(`test/server.test.js`.)*
3. ✅ **[helper]** client session-remote.js + main.js `?server=` boot switch +
   async-apply sweep of the ui call sites *(2026-07-12 — apply/endTurn are now
   Promise-based on BOTH sessions; input.js funnel/helpers/GoTo chain, panels
   3 fns, main e2e all `await`. Client-side shims for filterView omissions
   (own-player explored/wonders/cityOrder/nextCityId) pending a filterView
   extension + shim-removal follow-up).*
4. ✅ **[helper]** browser e2e served-by-server case + docs sync *(2026-07-12 —
   `dumpDomLive` CDP live-page waiter, since virtual-time `--dump-dom` races
   the ws join; this file, 02 §6, roadmap phase-3 checkboxes, CLAUDE.md run
   path, README + plan-update paragraphs).*
5. ⬜ **[human]** playtest through the socket, restart mid-game, judge
   latency; then phase-3 acceptance is closable *(open — see
   `human-workitems.md`).*

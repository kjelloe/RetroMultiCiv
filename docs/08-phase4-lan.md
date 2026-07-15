# Phase 4 — LAN multiplayer: design & implementation

Status: slices 1–3 IMPLEMENTED (A12/A13, 2026-07-13) — server lobby with
join codes + seating chart, client lobby UI + reload boot path, turn
flow with presence, host-skip and >2/3 vote, server-side spectators.
Spectator CLIENT mode IMPLEMENTED too (A17, 2026-07-13): `?spectate=1`
boot path, Spectate checkbox on join + Allow-spectators at create (the
CLI boot game defaults to allowed, `--no-spectators` reverts), read-only
guards, 👁 chip; wave-VI polish added cursor TOOLTIPS for spectators
(unit stats / city+garrison two-liner, A35) and per-player turn-log
filters incl. the 💾 save-code class (A33+A39). Wave-V hardening (2026-07-13, from the first real LAN
playtest): lobby games assign distinct seed-shuffled civilizations
(city rosters + faction visuals — `joined` replies carry a pid→civ
map), bare `/` and `/client` redirect to `/client/`, the hotseat
curtain is local-session-guarded (it used to flip a LAN client's
viewpoint to the rival after endTurn — the research-crash root cause),
and the setup screen splits "Start hotseat game" from "Host LAN game".
Wave V closed 6/6 (A27, 2026-07-13): the host's waiting room is a
control panel — per-slot AI↔Open toggles (no-kick, §6), per-slot civ
picks (each civ once, Random default), slot resize 2..7, map size +
starting age on the host form; joiners see edits live. Turn banners
carry ✕/🔕 (mute in ⚙, chime included — a real WebAudio chime exists
now), and a "⏳ <name> is moving · Ns" wait-line sits above End Turn
with a configurable slow-poke turn-log note.
**PHASE 4 ACCEPTED 2026-07-14**: real two-machine session (2 humans +
spectator + AI) survived the full stress script — network kill on the
host PC and a server-process kill with save-resume; the turn-53 server
save replays hash-exact (395 commands, 0xebaa99b1). Originally drafted 2026-07-12 — builds directly on the phase-3 primitives
(docs/06: seats, tokens, per-seat views, save/resume). Roadmap acceptance:
a full game between two machines surviving a mid-game disconnect.

## 1. What phase 3 already gives us

Seats/tokens were designed multi-human from day one; `gameId` is in every
message; views are per-seat; the server autosaves and resumes. Phase 4 is
therefore mostly LOBBY + LIFECYCLE, not protocol surgery.

## 2. Lobby model (server hosts ONE lobby + N games, in memory)

```
client → server   { t:"create", name, options:{civs, humans, size,
                    difficulty, combat, seed?} }
                  { t:"list" }                      # open games
                  { t:"join", gameId|joinCode, name, token?, seat? }
server → client   { t:"created", gameId, joinCode, ... = joined reply }
                  { t:"games", games:[{gameId, joinCode, turn, seats:
                    {taken, total}, started}] }
```

- **Join code**: 5 Crockford-base32 chars (`Q7F2M`) derived from gameId —
  what you shout across the room. The full gameId stays in URLs/saves.
- **Per-slot human/AI assignment** (the phase-2 deferral lands here): the
  creator's options name how many HUMAN seats; joiners fill them in join
  order; unfilled human seats at start-time can be flipped to AI by the
  creator ("start anyway"). Seat choice (`seat: "p3"`) allowed when free.
- The game starts (engine `createGame`) only at the creator's explicit
  `{t:"start"}` — until then the lobby holds options, not state. After
  start, `join` = phase-3 reconnect semantics, unchanged.

## 3. Turn flow across machines

Turn-based and human-sequential exactly like hotseat: the server's
`turn` broadcast tells everyone whose turn it is; clients not at turn get
a read-only view (the UI already gates commands on `activePlayer` — the
server rejects out-of-turn commands anyway, `notYourTurn`). A soft chime/
banner "Your turn" on the broadcast is the only new client UX.

## 4. Disconnect & resync

- Disconnect of a NOT-at-turn player: nothing stops; they reconnect with
  their token and get a fresh view (phase-3 mechanics as-is).
- Disconnect of the AT-TURN player: the game waits (turn-based, friends
  on a LAN — no timeout in v1; the lobby shows "waiting for <name>,
  disconnected"). An explicit host control "skip their turn" (server
  issues endTurn stamped with that seat) is the pressure valve — logged
  in the diagnostics like any command.
- Resync = full view resend on rejoin (docs/06 chose view-with-events
  over increments precisely so resync is trivial). The game verification
  code (docs/07, A11) rides the same rejoin reply, so a returning player
  auto-validates continuity.
- Host machine dies: the autosave + `--game` resume from phase 3 IS the
  recovery path; tokens persist in the envelope, everyone rejoins. This
  is the acceptance test, and it already passes at the single-human
  level in test/server.test.js.
- New-device / cleared-storage rejoin (A46): each seat carries a
  per-seat reclaim CODE (docs/07 alphabet, `seats`-parallel `seatCodes`
  map — never game state, never hashed). A `{t:'join', seatCode}`
  reclaims the seat WITHOUT the token, but ONLY while its connection is
  dead ('seatOccupied' otherwise — recovery, not displacement); the
  reclaim ROTATES the token so the old device's copy dies with the move
  (one seat = one live control path). Rate-limited 1/sec/conn against
  brute force; the code never rides views, listings, or spectator
  replies. RESUME-PATH NUANCE (A52, seat-code metadata scope): a `--game`
  CLI resume KEEPS seats + tokens + codes (they ride the save envelope,
  so a supervised host restart is seamless); the lobby "Resume a saved
  game" flow (A34) instead `resetSeats()`, so tokens AND codes die and
  joiners re-pick by name — deliberate, because machines change between
  sessions and the game code (shown in the picker) is the continuity
  proof there, not a stale per-seat secret.
- Resume from the host flow (A34, landed 2026-07-14): `{t:'listSaves'}`
  inventories saves/ basenames (envelope-parsed, code shown BEFORE
  loading), `{t:'resume', file}` loads via the existing `--game` path
  with seats ALWAYS reset (machines change; joiners re-pick by name).
  RULED: resume yields a STARTED registered game — joiners bind seats
  directly (phase-3 flow), no pre-game waiting room; the docs/07 code
  is visible at picker → resumed-ack → every joined reply. A
  room-wrapped resume variant stays an optional follow-up only if a
  playtest asks for it. Autosaves continue into the SAME file;
  re-resuming a live gameId joins it instead of clobbering.

## 5. Implementation slices (helper-friendly once design is final)

1. Server lobby: create/list/join-code/start + multi-game map keyed by
   gameId (game.js untouched — it already takes any setup); unit tests.
2. Client lobby UI: setup screen grows a "host / join" mode (join code
   field, seat picker, waiting room listing seats); reuses the remote
   session from A9 unchanged.
3. Turn-notification UX + at-turn-disconnect handling ("waiting for…"
   banner, host's skip control).
4. Two-machine acceptance run (human item): full game across machines,
   kill one client mid-turn, rejoin; kill the host, resume from save.

## 6. Decisions (user, 2026-07-12)

- **Spectators: YES, as a game option, host-controlled** (`allowSpectators`
  set at create; host can revoke). A spectator token maps to a view-only
  pseudo-seat; v1 spectators get the omniscient view (a player object
  without an `explored` array is already omniscient in `filterView`,
  minus `rngState`) — documented as trust-based: spectators can see
  everything, so admit people you'd let stand behind your chair.
- **Skip-turn: two paths.** The HOST may skip the disconnected at-turn
  player directly; alternatively ANY player may propose a skip, which
  passes at **more than 2/3** of eligible voters (connected human seats,
  excluding the at-turn player; spectators never vote). Messages:
  `{t:"proposeSkip"}` → broadcast `{t:"skipVote", votes, needed}` →
  each `{t:"vote", yes}` — on pass the server issues the endTurn stamped
  with the skipped seat, logged in the diagnostics like any command.
- **Lobby auth: join codes only** — no names/passwords in v1 (it's a LAN
  among friends; the join code is the invitation).
- **Slot kicks via setSlot: NO** (architect ruling @3b520ebc, A27
  2026-07-13) — "locked to AI" governs FUTURE joiners, never occupants;
  the host's `setSlot`/`setSlots` reject on reserved seats
  (`seatReserved`), and a shrink cannot remove a reserved tail seat.
  **SUPERSEDED IN PART by user decision 2026-07-14 (wave VI.15 →
  A37)**: kicking becomes a deliberate, EXPLICIT host action — a
  dedicated `{t:'kick'}` with notification to the kicked client, plus
  an optional per-game IP block — exactly the "future social feature"
  this ruling reserved. The silent setSlot flip keeps rejecting; lobby
  chat (host-togglable) and host-only IP-on-hover landed in the same
  item (A37, 2026-07-14). Mid-game kicks remain out of scope
  (AI-regency territory, §7).

## 7. AI regency — LANDED (A40 slice 2, 2026-07-15; stances = slice 1, pending the first post-port golden window)

A human player hands control to the AI while away and re-takes it on
return. Built exactly as designed, WITHOUT touching game state:
`state.players[pid].human` stays `true` — regency lives in a PARALLEL
map (`regents`, beside `seatCodes`; parallel maps are the house
pattern for seat metadata), envelope-persisted so regency survives
resume. The design's one real subtlety proved to be THE crux and
held: regent turns log as individual `cmd` entries (thought by the
REAL `engine/ai.js` pickCommand at play time) while AI chains stay
derived `round` entries — replay re-applies regent commands verbatim
and re-derives AI rounds, hash-exact by construction. The server's
`driveRegents` YIELDS between turns (a solo regent would otherwise
play to gameOver in one synchronous block — caught by its own first
test). UI: 🤖 button by End Turn, five-stance dialog (Balanced
preselected), grayed "Auto Turn" button state, instant take-back.
SLICE 1 LANDED (2026-07-15, the first post-port golden window):
the STANCES table lives in engine/ai.js AND luau/ai.luau —
balanced is arithmetically the identity (every golden stayed
green, no re-record), and the four flavored stances (defensive /
aggressive / science / growth) are live: a regent actually plays
its chosen stance. Toggle: explicit player button
(host-granted-for-disconnected remains a future option). The same
stance table is A59's substrate (AI leader personalities).

## 8. Scaling (A38 probe, 2026-07-14 — measured on the dev box, WSL2)

Method: `tools/probe-scale.js` (engine-only ms/turn + mapgen fit sweep,
seeded) and `debugging/probe-lan8.js` (8 live ws clients). Numbers are
machine-relative; compare shapes, not absolutes.

**Engine, 200 all-AI rounds, halves h1/h2 = early/late game (seed 20260714):**

| size   | civs | ms/turn h1→h2 | ms/ROUND h1→h2 | units at end |
|--------|------|---------------|----------------|--------------|
| large  | 4    | 17 → 21       | 68 → 84        | 65  |
| large  | 8    | 20 → 52       | 163 → 414      | 231 |
| large  | 12   | 30 → 69       | 357 → 832      | 240 |
| large  | 16   | 22 → 53       | 355 → 854      | 393 |
| xlarge | 4    | 30 → 84       | 120 → 338      | 145 |
| xlarge | 8    | 39 → 91       | 308 → 731      | 280 |
| xlarge | 12   | 48 → 138      | 578 → 1657     | 508 |
| xlarge | 16   | 45 → 121      | 722 → 1941     | 627 |

The human-perceived wait is ms/ROUND: ≤ ~0.9 s late-game at 12 civs on
large, ~1.7–1.9 s on xlarge — acceptable with the A30 chunked wait line
showing per-civ progress. Per-turn cost stays inside the pre-A38
baseline band (60–235 ms/turn).

**LAN, 8 live ws clients (seed 424242):** join ≤ 1 ms each; start →
all-8 `{joined}` 241 ms (large) / 299 ms (xlarge); one command's
applied+7-rival view fan-out 51 / 72 ms; a full 8-human round 326 /
486 ms. filterView-per-seat scales linearly and stays far from
perceptible.

**Mapgen fit, 40 seeds/cell, fit = min pairwise start distance ≥ 6**
(mapgen relaxes spacing 12→0 by 3s before failing, so the metric is the
achieved distance): xsmall seats 7 (93% — the pre-A38 status quo),
small 12 (98%; 14 drops seeds to distance 3–4), medium and larger seat
14 at 100%. Shipped as `data/rules.json maxCivsBySize =
{ xsmall: 7, small: 12, medium/large/xlarge/huge: 14 }`, enforced at
the setup screen (size-aware civs dropdown), lobby create
(`mapTooSmall` rejection), `setSlots` clamp, the `?civs=` URL clamp,
and server `--civs` startup validation.

16 as a shipped option stays out (needs the Civ 2/3/4 roster extension
+ ally visuals — a separate future item); the probe measured it via
test-only duplicated rosters to know the headroom exists.

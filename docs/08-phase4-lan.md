# Phase 4 — LAN multiplayer: design draft

Status: DRAFT (2026-07-12) — builds directly on the phase-3 primitives
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

## 7. Later option (noted, not phase 4): AI regency

A human player hands control to the AI while away and re-takes it on
return. The architecture makes this cheap and it must be built WITHOUT
touching game state: `state.players[pid].human` stays `true` (no hash
impact, no engine change) — regency is a SERVER seat property
(`seats[pid].regent = true`). While set, the server's round loop calls
`runAiTurn` for that seat instead of waiting for commands; clearing it
(the returning player's `{t:"resume"}`) hands control back at their next
turn. One real subtlety for the design to carry: the regent's AI
commands must be recorded as `cmd` entries in the diagnostics log —
replay's AI-drive only reconstructs commands for `human: false` players,
so a regency period replays from the log, not from re-derivation. Toggle
moments: explicit (player button), or host-granted for a disconnected
player as a gentler alternative to skip-turn.

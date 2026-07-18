# Mobile resilience — making phone multiplayer survive screen-lock (architect, 2026-07-18)

Problem, measured (L8 forensics #1333, story A CONFIRMED): an Android
phone that locks/backgrounds its tab leaves the WebSocket HALF-OPEN —
readyState stays OPEN, no close event fires. Neither the phone nor the
server notices the socket is dead. The lobby close handler
(server/index.js:619-627) releases the seat INSTANTLY when close does
eventually fire — which the OS delays until ~game-start — so the phone
is seatless exactly when the game begins. This is the "joined lobby,
chatted, nothing happened at start" field failure.

The renderer/perf question (does WebGL run at playable fps on the
device) is SEPARATE and is the T0 field measurement — user-runnable,
best answered by the current playtest (note: does the world render;
rough pan fps; first 2-3 broken things). This spec is the NETWORK
resilience only; single-player mobile is already portrait-laid-out +
touch-input'd (T1/T2 shipped).

## The three-part fix (each part is necessary; they compose)

### Part A — server heartbeat (hardening lane, docs/17 connection lifecycle)
ws-level ping every `heartbeatMs` (~15s); a socket that misses
`heartbeatMisses` (~2) pongs is `terminate()`d → the close handler
fires DETERMINISTICALLY instead of at the OS's whim. This is the ONLY
way a half-open socket becomes detectable. Already scoped in the
hardening plan (L9 / #1377); this spec asks it be its own early slice
(mobile-critical), landing right after the budget slice (same files).

### Part B — lobby seat-grace window (server lifecycle; coordinate helper↔hardening)
Do NOT release a lobby seat instantly on close. Hold it for
`seatGraceMs` (~45s) in a "disconnected, reclaimable" state: the seat
shows as such in the lobby broadcast, does not free up for a new
joiner. If the grace window expires without reclaim, release as today
(AI/open seat). At game START with a still-disconnected seat, the
existing regent/started-without-joined path takes over (unchanged) —
but the grace window means a phone that reconnects within 45s keeps
its seat. The heartbeat's terminate is the trigger.
**RECLAIM MECHANISM (ruled #1542, correcting a spec error):** MP5's
token is the STARTED-game seat token; a pre-start lobby reservation
is TOKENLESS (lobby.js "tokenless until start"), so there is nothing
to reclaim with — the spec's "same reconnect token (MP5)" was wrong.
Fix = OPTION 1: issue a lobby-reconnect id at joinedLobby (in the
reply, stored on the reservation); reclaim within the grace window
requires presenting it. NOT the weaker joinCode+seat+name/IP key
(spoofable on exactly the shared LAN this targets), NOT defer (the
brief-lock-keeps-seat case IS the user value). This adds one field to
the lobby join reply + reserveSeat — the HELPER's lobby flow, wider
than the "releaseSeat timing" first scoped. Hardening builds the
server mechanism on its branch; the architect reviews the lobby-reply
field for helper-compat before merge; the client SIDE (store the id,
present it on wake-reconnect) folds into Part C. Touches releaseSeat
timing (server/lobby.js) + the close handler (server/index.js:619).

### Part C — client auto-reconnect on wake (helper lane, client)
The L8 wake-probe (visibilitychange/pageshow) currently only NOTIFIES
on a dead socket. Extend it: on wake, if the socket is dead OR
suspect (no pong echo), tear it down and RE-ESTABLISH, re-presenting
the stored seat token. Within Part B's grace window the phone rejoins
its own seat silently; past it, fall back to the L8 truth screen.
Backoff on repeated failure; cap attempts. Pure client + the existing
reconnect protocol — no engine, golden-neutral.

## Sequencing

1. Hardening slice 2 (budget layering) — IN FLIGHT, finish first.
2. Part A+B as the next hardening/lifecycle slice (mobile-critical,
   ahead of the P1-P3 bulk) — heartbeat + seat-grace, one review.
3. Part C (helper) opens once A+B land (it reconnects TO the
   grace-held seat; building it first would reconnect into an
   already-released seat).

## Tests
- A: server-hardening — a socket that stops ponging is terminated
  within heartbeatMs×misses (fake clock); a live socket is never
  reaped.
- B: server-lobby — a lobby seat held (not released) for seatGraceMs
  after close; reclaimed by token within the window keeps the seat;
  expiry releases it.
- C: a playwright/CDP wake case — kill the socket, fire pageshow,
  assert reconnect + seat retained (the half-open shape can't be
  synthesized in the harness, so C's live proof stays a field check;
  the reconnect LOGIC is unit-testable).

## Provenance
Original engineering (no wiki/Civ mechanic — pure transport
resilience). Golden-neutral throughout: no engine, no state shape
change (the seat "disconnected-reclaimable" flag lives in the
registry, not game state).

# marker-0062 — late-game save loading in the client (the hosted-save papercuts)

A small, golden-neutral client delivery that closes the gap the late-game
robustness check (#1666) found: a user can now load their **hosted-game
save** in the browser client, the map is no longer blank after a
mid-session load, and a solo "continue my hosted game" no longer hands off
to a now-dead player. Driven red-first by the real turn-1617 g5khd
server-save from the user's playtest.

## Delta since marker-0061

marker-0061 (A59 leader personality) was the D3 data prerequisite. Between
it and here: the D3 AI-diplomacy spec was written + pre-open handed to the
bugfixer (docs-only commit ec9553b, not a marker), and the helper ran a
read-only late-game robustness check on the user's turn-1617 save that (a)
VALIDATED core late-game robustness — 609-unit AI round ~760ms, no perf
cliff, full spectator render 799ms / 0 errors — and (b) surfaced the three
save-loading papercuts this marker fixes.

## What shipped (all client/ui/saves.js, golden-neutral)

- **A — server saves are now client-loadable.** `loadStateObject` accepted
  only `format === 'retromulticiv-save'`; a hosted-game save is
  `retromulticiv-server-save`, so the whole envelope failed
  `stateLooksValid` → "✗ not a RetroMultiCiv save". Now it accepts the
  server format too, reading `obj.state`, and passes `obj.diag` to
  replaceState unchanged so the server envelope's full history seeds the
  replay theater. A user can drag-drop their hosted save into the client.
- **B — the camera recenters on load.** A mid-session load left the camera
  on the old (now off-map) position, so the main 3D view rendered blank
  until a unit was selected (the minimap was fine — reads as "broken" to
  the user). After replaceState the camera now `centerOn`s the loaded
  viewer's first city (else first unit) — the same recenter boot does.
  Applies to ALL loads (client + server saves), breaks none.
- **C — collapse non-self humans on a server-save LOCAL load.** A server
  save records every human seat (here p2, now dead); loaded locally it
  hotseat-hands-off to them. On an `isServerSave` load, self = the first
  ALIVE human (else first human) and every other human seat is set to AI,
  so a solo continue plays on against the AIs with no dead-player hand-off.
  Gated on the server-save format only — a client hotseat save is
  untouched.

## Tests

- **test-ui/late-load.spec.js (NEW)** — a Playwright case that drives the
  REAL g5khd turn-1617 save through the file input: (A) HUD reaches "turn
  1617", red-first against the format gate (pre-fix: "✗ not a RetroMultiCiv
  save", stuck at turn 1); (B) a load-recenter assert reading the
  `#minimap-rect` 2D canvas (getImageData works there, unlike the WebGL
  main view) — the viewport rectangle's vertical centroid lands in the
  map's top third where p1's cities sit (only the non-wrapping y axis is
  asserted; x wraps on the cylinder); (C) after end-turn, `#handoff-screen`
  stays hidden. Zero pageerror. 1/1.
- **Regressions:** node save-envelope + browser 21/21, smoke green. No
  other spec loads saves, so the new recenter-on-all-loads breaks nothing.

## Golden / test state

GOLDEN-NEUTRAL by construction: client load path only — no `engine/`,
`data/`, or `shared/statehash` touched, no ruleset checksum moves. The node
suite reads **609** (608 pass + the documented `server-hardening.test.js`
parallel-load flake, confirmed green 15/15 isolated — same SIGTERM/socket
contention class, not a regression).

## Breaking notes

None. Purely additive client load handling; existing client and server
saves load exactly as before, with the added recenter.

## Note (expected, not a bug)

The turn-1617 save predates recent ruleset changes, so loading shows the
drift `confirm()` and recomputes a fresh game code under the current
ruleset — the drift warning already tells the user it may diverge; loading
is their call.

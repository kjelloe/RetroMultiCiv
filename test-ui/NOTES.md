# test-ui notes (measured gotchas)

- **Seed 1's e2e city yields ZERO shields/turn** (yields 2/0/2 at Testopolis'
  site) — production there NEVER completes, so any completion-dependent spec
  hangs forever on it. Seed 2 yields 1 shield/turn (seed scan, C3
  2026-07-18). Use seed 2+ (and verify with a yields read) for specs that
  need production to finish.
- End-turn via keyboard 'e' passes through ignore-once 5s confirm gates
  (units-with-moves, city-needs-orders) — press in pairs/triples per round in
  driving loops.
- Synthetic PointerEvents carry no active pointer id: element handlers that
  call setPointerCapture must guard it (minimap does), and specs dispatching
  pointerdown should not rely on capture semantics.
- **PNG byte-compare of live client scenes is meaningless**: two shots of the
  SAME code differ (anim.js clock noise on the canvas — measured, T1
  2026-07-18). For layout claims assert computed styles / bounding rects;
  only gallery.html at rest pose is byte-comparable.
- **Lobby wake-reconnect (Part C): the half-open shape can't be synthesized in
  the harness** (mobile-resilience.md documents this — a field check). A phone
  that locks its screen leaves the socket readyState=OPEN with no close event;
  Playwright's `s.close()` produces a REAL close (readyState→CLOSING/CLOSED),
  which the OS-killed branch catches, not the suspect-OPEN branch. So
  lobby-reconnect.spec.js exercises the DETECTABLE drop (force-close → new
  socket + seat reclaimed); the suspect-OPEN-on-wake path is unit-tested via
  `wakeIsSuspect` in test/lobby-reconnect.test.js but has no live e2e. To wrap
  a page's sockets for a reconnect count, `addInitScript` a WebSocket proxy
  that copies the CONNECTING/OPEN/CLOSING/CLOSED statics onto the wrapper (the
  client reads `WebSocket.CLOSING`). Booking the lobby FULL (all human seats
  taken) makes reclaim distinguishable from a lucky re-reserve — a fresh
  reserve would hit gameFull.
- **A renderer/recipes change's gate set** (CP19 lesson, 2026-07-18): run
  `test/asset-recipes.test.js` + `test/render-spec.test.js` locally AND
  regenerate BOTH mirrors — `node tools/export-asset-recipes.js` (data/assets)
  and `node tools/render-spec.js` (specs/render-spec.json); a new prop kind
  also needs the hardcoded kinds list in asset-recipes.test.js. Then the
  gallery golden moves → the CI-actual re-record flow.

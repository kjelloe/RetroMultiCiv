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

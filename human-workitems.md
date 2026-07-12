# Human work items — RetroMultiCiv

Things only a human (Kjell or friends) can verify or decide. Check off with
a date; add playtest findings to the bottom section. Agent/coder tasks live
in `./agent-workitems.md`.

## Verify in real play

- [ ] **Playtest wave II spot-check** (all landed 2026-07-12): city view
  gives the left column the width; Temple shows a real effect line; N goes
  to the *nearest* unit; selecting a GoTo unit shows its route line with
  Re-route/✕ Cancel in the action bar; unit stat card sits above the
  action bar; ⌖ in turn-log lines flies the camera there; settler site
  rating says "unexplored territory" / "N tiles unexplored" under fog;
  founding inside 4 tiles of any city is rejected with a clear message;
  roads feel 3× (militia crosses 3 road tiles per turn).
- [ ] **Combat feel**: new games default to Best-of-three (setup dropdown
  "Combat calculations"). Does a 4:1 attack now *feel* right (~90% wins)?
  If you prefer authentic Civ 1 as the default instead, say so — one-line
  change.
- [ ] **Terrain mesh on real GPUs**: the continuous low-poly surface is
  headless-verified (WebGL2 + WebGL1), but judge the *look* in Firefox
  (WebGL2/D3D11) and the WebGL1-stuck Chrome: readability of tiles,
  mountain heights vs unit visibility, water contrast, fog dimming.
- [ ] **End Turn latency late-game**: expansion AI now reaches 10–24
  cities on some seeds; if End Turn stalls noticeably vs a big AI, report
  the turn number + a Shift+D diagnostics file.
- [ ] **Hotseat acceptance playtest** (still pending from phase 2): a real
  2-human+AI session scored against the 10-question checklist in
  `specs/gameplay-reference.md` and the 7 hotseat questions in
  `specs/plan-feedback.md` — plus the ally's new comprehension question
  (specs/plan-feedback-2.md): did happiness, government, tax allocation,
  and worker improvements feel understandable, or like hidden bookkeeping?
- [ ] **AI settlers in hotseat**: steal an AI's founding spot on purpose —
  its settler should now walk off to a secondary site instead of loitering.
- [ ] **AI military behavior** (batch 3, 2026-07-12): AI settlers should
  travel with escorts; threatened AI cities should hold two defenders;
  AI armies should no longer trek across the whole map at you — verify
  wars feel local and AI civs are harder to snowball over early.

- [ ] **Declare phase 3 accepted** — the three roadmap criteria are met in
  practice: you played 20 turns through the socket (replayed hash-exact
  from `saves/g672813.json`), restart-resume works (`--game`, and
  `--reset-seats` for cross-port), and tamper rejection is automated
  (server-protocol tests). If the socket game FELT right (latency, view
  updates), tick this — it gates the helper's phase-4 items (A12/A13).

## Decisions / ops only you can do

- [ ] **Push + first nightly run**: after committing, trigger
  `.github/workflows/nightly-soak.yml` once by hand (GitHub → Actions →
  nightly-soak → Run workflow) and confirm both soak legs pass on the
  runner and the telemetry artifact uploads. The 3 AM cron only activates
  once the file is on `main`.
- [ ] **Share `plan-update.md`** with the designer ally + friends (it has
  the terrain-upgrade and simulation-harness paragraphs, test count 124).
- [ ] **Tell the designer ally about the terrain adoption**: his spec
  (saved verbatim at `specs/terrain-mesh.md`) is implemented with three
  deviations documented in `docs/03-roadmap.md` A1.75 — flat-shading via
  explicit per-face normals (WebGL1 safety), Lambert instead of Standard
  material, and his grid-overlay idea (#7) deferred; the existing
  hover/selection/footprint markers cover interactions for now.
- [ ] **Explain the WebGL1 stance to the ally** (his plan-feedback-2 edit
  #1 assumed we target WebGL2-only): WebGL1 support is deliberate, not an
  oversight — one of our own test machines is stuck on ANGLE D3D9
  (WebGL1-only), which is exactly why three.js is pinned to r162, the
  last WebGL1-capable release. His other wording edits were adopted
  verbatim in plan-update.md; this one was adapted to keep the fact and
  state the reason.
- [ ] **Old recordings note**: diagnostics files recorded before
  2026-07-12 no longer replay (AI + rules changed); saves still load.
  Delete stale files in `debugging/logs/` at your leisure.

## Playtest findings inbox

(add bugs/refinements here or hand them over in chat as before — Shift+D
diagnostics files into `debugging/logs/` for anything that looks like an
engine issue)

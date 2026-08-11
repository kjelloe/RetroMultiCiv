# marker-0113 — the graphics-levels arc (G0–G5), complete

**Tag:** `marker-0113` at `c6bdb7b` · **merge-consistent — the user may merge
this.** Delta since marker-0112 (the v1.0 RC): the v1.0.0/v1.0.1 release
window (already merged by the user), then this arc: five commits,
`343851b → c6bdb7b`, all client-side, all golden-neutral — no engine, data
ruleset, or Luau twin changes anywhere in the arc.

## What this marker delivers

A three-tier **Graphics level** system (`specs/graphics-levels.md`), from a
human playtest report (2026-08-05): terrain should read as what it is, and
units deserved more than 300 triangles on capable hardware.

- **G0** (`343851b`): desert re-hued warm amber (vs near-identical plains
  khaki); the plains Horse special rebuilt as a 12-primitive standing horse.
  Both user-picked from 3 shot variants — the pattern every later slice
  followed.
- **G1+G2** (`ac6b0bd`): the `graphics` client option (auto/low/medium/high)
  — GPU-probe auto-detect (test-pinned string table), setup-screen picker,
  ⚙ Options select with resolved-tier note, live switching. Medium terrain:
  4× mesh density, per-terrain procedural detail textures
  (`terrain-detail.js`), denser ground scatter, real dune geometry. Style
  user-picked of 3 ("v2 balanced weave").
- **G3** (`5493530`): High terrain — 128 tris/tile, PCFSoft sun shadows in a
  camera-following shadow box, pixel ratio 3, warmer per-tier sun. High on a
  WebGL1 context degrades to Medium, verified byte-identical to a genuine
  Medium WebGL1 render. Look user-picked of 3 ("H2 warm afternoon").
- **G4+G5** (`2b0ae22`): `recipes-high.js` — all 21 silhouette bodies
  authored for the 29-unit roster in the user-picked "faithful upscale"
  direction (real anatomy and kit at the shipped footprints/palette);
  medium segment-boost across the roster; high city density ×1.3;
  `test-ui/graphics-levels.spec.js` (picker persistence, per-tier triangle
  budgets, live-switch rebuild) plus the `__gfxInfo` debug handle; README
  section.

## Compatibility guarantees, measured

- **Low is byte-identical to v1.0.1** — the same gallery frame compares
  `cmp`-equal before and after every landing in the arc, and
  `?vertexcheck=1` still reports true/true. Every player's current look is
  untouched unless they opt in.
- The option is client display state only: never in game state, never
  hashed, never on the wire. Mixed-tier LAN games are fine.
- Roblox is unaffected (`data/assets/asset-recipes.json` gained only the G0
  horse shapes; the re-mirror of the horse motif + desert palette is queued
  to the roblox-helper lane).

## Tooling finding (affects every future renderer verification)

`--disable-es3-gl-context` was removed from Chromium upstream and silently
no-ops — the WebGL1 verification lane had been proving nothing. Caught when
the G3 degrade shot compared equal to the full-shadow shot. Every reference
(shoot.sh, screenshot.sh, CLAUDE.md, docs/03) now uses `--disable-webgl2`,
and the new permanent `debugging/webgl-probe.js` asserts the flag actually
removes WebGL2 before anything trusts it.

## Test state

Full suite **1063: 1062 pass, 0 fail, 1 skip** (the wiki-dump integration
test, absent dump). Playwright: graphics-levels 3/3, smoke,
layout-contract, sentry, lobby-start-mobile all green. Counts synced
(1048 → 1063) in README/plan-update/agent-workitems.

## Open ends (not blocking the merge)

- Irrigation/road strip props can float slightly over High's denser relief
  — cosmetic polish, logged in the spec.
- Roblox re-mirror of the G0 horse/desert (roblox-helper queue #1).

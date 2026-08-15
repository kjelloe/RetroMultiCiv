---
name: art-variants
description: The 3-variant art review loop (standing user ruling 2026-08-05) — build three genuinely different candidates, shoot them identically framed, present for user selection before landing any unit/terrain look
---

# /art-variants — the 3-variant art selection loop

**Standing user ruling (2026-08-05): every art-bearing slice — unit looks,
terrain detail, lighting moods — presents 3 variants as screenshots for
user selection before landing.** Ran 5× in the graphics-levels arc (G0
desert, G0 horse, G2 texture style, G3 High look, G4 unit style); this is
the mechanized form.

## The loop

1. **Stage the scene.** `debugging/gallery.html` is the instrument:
   rows 20–22 = the terrain swatch (desert/plains/grassland bands), row 19 =
   specials, rows 3/5/6 = units, row 7 = city tiers. `?gfx=low|medium|high`
   renders any tier; `?cx=&cy=&zoom=` frames (zoom clamps at ~5 — the
   close-up floor). Add a permanent gallery region if none shows the asset.
2. **Make 3 GENUINELY different candidates** — different directions, not
   three strengths of one idea (G2's contrast-only variants were the weak
   round; G4's A/B/C directions were the strong one). Keep the deltas as
   small data edits: a palette line, a recipe body, a style const.
3. **Shoot identically framed**: sed/python-swap the candidate in →
   `debugging/shoot.sh debugging/<slice>-vN.png "/debugging/gallery.html?<same frame>"`
   → restore. Never leave a variant in the tree; the shipped state stays the
   current pick (or the provisional, flagged) until selection.
4. **Side-by-side page**: `debugging/<slice>-variants.html` (dark page,
   figure grid, one caption line each, mark any provisional). The PNGs stay
   untracked; the html is committed as the review record.
5. **Ask** via AskUserQuestion, recommendation first. Overnight windows:
   decide-document-flag — land the recommendation as PROVISIONAL, record it
   in the spec, ask on return.
6. **Land the pick + record it**: spec section gets "user-picked <date> of
   3", the module comment names the pick, memory updates if the arc is
   cross-session.

## Verification riders (renderer changes)

- Low byte-identity: `cmp` the same gallery frame pre/post + `?vertexcheck=1`.
- WebGL1 pass: `--webgl1` (= `--disable-webgl2`; the old
  `--disable-es3-gl-context` no-ops — `debugging/webgl-probe.js` proves the
  flag bites).
- Multiply-texture marks must DARKEN below the ~1.95x lighting clamp or
  they render invisible.
- **Props designed for a tier's LOOK must be GATED to it** — the faceted
  peak/snow cones floated over High's smooth summits (playtest find,
  2026-08-15); same class as the tier-split animal motifs.
- **A tier that changes scene STRUCTURE (mesh → group) must re-run every
  identity-test code path, picking included** — `castAt`'s `=== terrain.mesh`
  silently killed all terrain picks at medium from G2 until a playtest
  caught it (2026-08-15). Guard structure changes with an interaction test,
  not only renders.
- **Detail must face the CAMERA** (south/+z — it sits south looking
  north): center-facing facades AND north-rim wonder landmarks both
  shipped invisible before review shots caught them (bit twice,
  2026-08-14). Anchor detail on the south/east/west rim, and REVIEW FROM
  THE PLAY ANGLE, not the mind's eye.
- After renderer-table changes: `node tools/render-spec.js` + the
  asset/mock-state/render-spec test battery.
- **Baked/merged geometry shifts draw order → near-coplanar edge pixels
  move** (measured delta 20): never bake the byte-contracted LOW tier;
  gate merges to tiers without pixel pins.
- Triangle/call budgets: `debugging/measure-tris.mjs` — PLAIN boots only.
  A `?e2e=1` boot parks the scene in artificial probe states (0-unit
  swaps) and its numbers lie (measured 2026-08-13).
- **"Missing" props are usually OCCLUDED, not absent** (cost three shot
  rounds, 2026-08-15): city pop badges float over the tile BEHIND their
  city from the fixed camera, and tall medium/high houses hide the tile
  north of a city. Shoot review frames with `gallery.html?nolabels=1`
  (badges/pills off), MAGNIFY the exact pixels (PIL crop+resize) before
  concluding geometry is missing, and if still unsure prove the instances
  headlessly: import `createTileProps` in Node with a loader that aliases
  `three` to the vendored module and read the instance matrices.

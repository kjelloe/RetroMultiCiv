# marker-0115 — the graphics v2 ladder (H1–H5), complete

**Tag:** `marker-0115` at the report commit (last code commit `3078ec5`,
goldens at the commit after) · **merge-consistent — the user may merge
this** (supersedes marker-0114). All client-side, all golden-neutral for
the game simulation; the VISUAL goldens are re-recorded from CI actuals in
this marker.

## Delta since marker-0114

The v2 graphics ladder (`specs/graphics-levels.md` §4b), re-tiered from the
user's gallery review with the Transport World screenshot as High's
watermark. Six commits, one 6-hour window:

- **H1** — re-tier: Medium = the G3 terrain (SEGS 8, textures, ×1.7
  scatter, no shadows) + the 21 authored unit bodies + ×1.3 cities. The
  three neglected special ANIMALS got the horse treatment, all three picks
  user-confirmed live: deer standing-alert (forest + tundra), seal basking,
  fish side-profile.
- **H2** — High terrain goes smooth TW-style: one indexed mesh, vertex
  colors blended across tile boundaries (sharpened bilinear weights), sand
  painted on both banks of every shoreline, river/fog as per-vertex
  weights, `computeVertexNormals` relief. The TW tree kit (trunk + layered
  canopy, deciduous/conifer/autumn mix, lone meadow trees), roads as three
  conforming sub-segments with white centerline dashes, a double surf line.
- **H3** — model-grade cities: center-facing houses, gable ridge roofs with
  chimneys, industrial smokestacks / modern rooftop units, window insets
  and doors, rampart City Walls with capped towers.
- **H4** — model-grade units, COMPLETE: `recipes-model.js`, all 21
  silhouettes (consumed only at High with per-silhouette fallback) — from
  cheek-guard helms and faction-blazon shields to road-wheeled tanks,
  crow's-nest sail ships, twin-barrel battleships and a glazed-nose bomber.
- **H5** — budgets measured on the plain boot: low 9,600 tris / 24 calls →
  medium 130,152 / 39 → high 135,416 / 44 (xsmall); the 3M ceiling holds
  with ~22× headroom. `debugging/measure-tris.mjs` is the permanent
  instrument. README tier descriptions updated; the tier comparison sheet
  regenerated.

## Provisional picks awaiting the user (decide-document-flag)

- H2 terrain blend: **V2 balanced** (of 3) — `debugging/h2-variants.html`
- H2 forest character: **A mixed wood** (of 3) — same sheet
- H3 city house style: **A lived-in** (of 3) — `debugging/h3-variants.html`

Each swap is a one-line change + reshoot.

## Two measured traps, recorded in the spec

1. **Never budget against a `?e2e=1` boot** — the e2e probe flow parks the
   scene in artificial states (0-unit swaps mid-probe); triangle/call
   numbers read from it lie. The playwright budget test and the measure
   tool both boot plain now.
2. (From the H1 window) WebGL1-vs-WebGL2 frames are no longer
   byte-identical once sub-pixel-thin geometry is in frame — backend MSAA
   resolvers differ on thin edges. The contracts that hold: within-context
   determinism (vertexcheck) and the WebGL1 pass functioning.

## Verification

Low proven byte-identical after EVERY slice (same-frame `cmp` against the
running baseline). Battery (asset-recipes / mock-state / render-spec /
graphics-level / tracked-imports) green throughout; `graphics-levels.spec`
3/3 with the strict high>medium assertion restored in H2. Visual goldens
re-recorded from CI run 31651038026's actuals (the authoritative source);
the suite job passed in full under the corrected 35-minute budget.

## Open

- The three provisional picks above.
- Roblox re-mirror of G0/H1 motifs (roblox-helper queue).
- Real-hardware High acceptance (fps at 1440p on a discrete GPU) — user.

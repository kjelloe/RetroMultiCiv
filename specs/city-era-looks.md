# City look by ERA (+ size): design spec (architect, 2026-07-19)

> User feedback (Roblox run-F item 8): "the city model should start as a small
> cluster of huts and then gradually increase in size and number of parts/
> blocks/polygons … and change with size AND ages — different look in Ancient
> vs Industrial vs Space age." SHARED feature (browser + Roblox), GOLDEN-NEUTRAL
> (render-only; reads state, no engine/save/luau change). Browser = helper;
> Roblox = roblox-helper (matches this shared era-band definition — do NOT let
> the two platforms diverge on the concept).

Today the browser renders city SIZE via `CITY_TIERS` (assets.js:209 — house
count/height by minPop). The MISSING dimension is ERA: a city should also LOOK
different by age. This adds the era axis, composing with the existing size
tiers (a 2-D matrix: size × era).

## 1. The era band (derive, don't store)

- A city's era band = the OWNER's current tech era (the engine already has a
  tech-era model — ancient / classical(renaissance) / industrial / modern; map
  to a small fixed set of visual bands). Pure READ of state in the renderer;
  nothing new in game state (golden-neutral).
- Fixed visual bands (keep it small + legible at map zoom): **Ancient** (thatch
  huts) → **Classical/Medieval** (stone + tiled roofs) → **Industrial** (brick +
  smokestacks) → **Modern/Space** (concrete/glass + domes/spires). 4 bands is
  enough; the exact band→era mapping is a small table.
- Determinism/render-only: the band is derived at render time from the viewed
  state (fog-honest — a fogged rival city renders at its last-seen state like
  today). No RNG, no state write.

## 2. What changes per band (composes with size tiers)

Per band, vary the CITY_TIER house recipe's: roof shape (peaked thatch → tiled
→ flat industrial → domed), body material/colorRole (mud → stone → brick →
concrete/glass), and a signature prop (none → none → smokestack → spire/dome).
The SIZE tier still sets house COUNT + height; the ERA band sets the STYLE.
Capital/palace keeps its emphasis across bands.

## 3. Authoring the band styles

Like the glyphs: the helper builds the SYSTEM (a band→style table + the tier
renderer reading it) and drafts the OBVIOUS band looks (ancient thatch, modern
glass), then FLAGS the middling ones for a visual pass (the ally, or the user's
eye on a screenshot). Ship with the obvious bands first; refine. Zero external
assets — procedural (the recipes.js/assets.js idiom), like everything else.

## 4. Scope + verification

- GOLDEN-NEUTRAL: render-only. `test/mock-state.test.js` already asserts the
  TERRAIN table covers every terrain; add a coverage assertion that every era
  band has a style (mirroring that pattern) so a new band can't render blank.
- Screenshot the gallery (it shows city tiers — add an era row, or a size×era
  grid) at rest pose for the visual-golden check; WebGL1 pass.
- Do NOT touch engine/data/save/luau. The era band is a pure render derivation.

## 5. Roblox parity (item 8)

roblox-helper renders the SAME 4 era bands × size tiers using Roblox parts/
materials (the enhanced look is now the default per the run-F ruling). It reads
the same owner-era derivation. This spec is the shared contract so the two
platforms agree on the bands.

## 6. Provenance

`original` (RetroMultiCiv's procedural city-visual system) — Civ has always
shown cities growing/aging, but the specific band styling is our house style.
The user's run-F feedback drives it.

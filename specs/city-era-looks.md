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

## 5d. ALLY EDITORIAL VERDICT (2026-07-19) — AUTHORITATIVE (supersedes above where they differ)

Approved in principle. Refinements to build to:

**LOCK the era mapping — renderer-local band IDs (NOT engine-era names):**
| engine tech era | render band id | display label | (no tech → `ancient`) |
|---|---|---|---|
| `ancient` | `ancient` | Ancient |
| `renaissance` | `classicalMedieval` | Classical / Medieval |
| `industrial` | `industrial` | Industrial |
| `modern` | `modernSpace` | Modern / Space |
Do NOT call the `renaissance` band "Classical" in code — use the render-local
id + this one explicit mapping table. Band = the owner's MOST ADVANCED
researched tech era (render-time read; no tech → `ancient`).

**THE KEY RULE — silhouette/roofline, NOT recolor.** Today all tiers share one
"wood-and-roof" language; the era pass must change the **silhouette + roofline**
(and body/roof geometry family + signature prop), not just tint the same
buildings. Per band: Ancient = steep thatch wedges, uneven huts, mud/timber;
classicalMedieval = red-brown TILED peaked roofs + one square civic TOWER/keep
at upper tiers, stone/plaster; industrial = lower/flat roofs, brick rectilinear
factory massing + 1–3 SMOKESTACKS (do NOT animate smoke unless already
deterministic render-only); modernSpace = flat slabs + clean towers + a DOME or
SPIRE, concrete + cool glass/cyan accents.

**Composition split (firm):** `CITY_TIERS` stays authoritative for structure
COUNT, footprint spread, principal height, density, wall/palace emphasis. The
era table controls ONLY: body-geometry family, roof-geometry family,
material/color role, optional signature-prop recipe. Rule: **"population
increases mass and density; era changes architecture and skyline"** — a pop-1
modernSpace city is a small concrete cluster with a dome/antenna (not a
mini-Manhattan); a high-pop ancient city is a dense mud/thatch/stone-walled
settlement (not a brown-recolored skyline).

**Capitals evolve per band** (not one timeless palace): ancient raised hall/
longhouse → classicalMedieval stone keep/columned hall → industrial grand civic/
railway-admin block → modernSpace command spire/dome. Identify the capital by
ONE larger central landmark + the existing owner-color/emblem — not more
saturation/height.

**Color/readability guardrails:** owner color stays on the base/ring/banner/
flag/trim (team identity); era MATERIALS carry the architecture (tan/thatch,
stone/tile, brick/charcoal, concrete/glass). Do NOT turn walls/bodies fully
owner-color (erases era read at zoom). Industrial stacks dark, modern glass
cool/light across ALL civs, with enough team trim to read ownership. At map
zoom the player answers in order: (1) whose city? (2) how large? (3) what age?

**Gallery/verification:** add a 4-COLUMN era × tier GRID (one neutral owner +
one capital sample) — the faction row is not where architecture is judged.
Checks: every band has a style entry; every tier renders in every band;
distinguishable roofline/silhouette AT MAP ZOOM (not just close-up); capital
recognizable in all 4 bands; fogged cities render from last-seen (no owner-tech
leak); browser + Roblox use the SAME 4 band ids + the SAME engine-era mapping;
render-only (no hash/replay/command/save change).

**Ship order:** Ancient + Modern/Space FIRST (the endpoints), BUT the middle
bands must carry their distinguishing SILHOUETTES from the first functional
implementation (classicalMedieval = tiled peaked roofs + square tower/keep;
industrial = brick rectilinear + smokestack group) — NOT mere material swaps.
Materials/proportions can get a later polish pass; the silhouette cues cannot
be deferred. Provenance `original` (run-F driven). Full tier×era guidance
matrix relayed by the user 2026-07-19 (agent-chat / this spec's origin mail).

## 6. Provenance

`original` (RetroMultiCiv's procedural city-visual system) — Civ has always
shown cities growing/aging, but the specific band styling is our house style.
The user's run-F feedback drives it.

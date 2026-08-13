# Graphics levels — low / medium / high

_Opened 2026-08-05 from human playtest feedback: units and terrain need a
high-detail option — terrain should read as what it IS (desert grain, grass,
rock) and units should be crafted to distinct detail. Design rulings taken
the same evening (user):_

1. **Asset source for the high tier: procedural-plus.** A new high-detail
   recipe tier in the existing primitive-composition system — no vendored
   model packs, no GLTF loader, zero new dependencies.
2. **Setting UX: setup picker + auto-detect.** A visible Graphics-level
   selector on the setup screen and the LAN join/lobby flow, pre-filled by a
   GPU probe, remembered in localStorage, live-changeable in Options.
3. **High may require WebGL2** (shadow maps, uncapped pixel ratio) and
   degrades to Medium with an honest note where absent. Low and Medium stay
   WebGL1-safe forever.

---

## 1. What each tier is

_**SUPERSEDED 2026-08-13** — the table below is the ORIGINAL (G-era) ladder,
kept for the record; the SHIPPED ladder is §4b's v2 table (High = smooth
TW terrain + model-grade units; Medium = this table's High minus shadows)._

| | **Low** (= v1.0.1 today) | **Medium** | **High** |
|---|---|---|---|
| target hardware | old phones, WARP / software GL, ANGLE D3D9 | integrated GPU (Iris Xe class) | discrete GPU |
| GL floor | WebGL1 | WebGL1 (+`ANGLE_instanced_arrays`) | WebGL2, else degrade to Medium |
| terrain mesh | SEGS=2 → 8 tris/tile | SEGS=4 → 32 tris/tile; dune/ridge shaping gets real geometry | SEGS=8 → 128 tris/tile + micro-displacement |
| terrain identity | per-face palette + 64×64 mottle | per-terrain procedural detail textures (256×256 CanvasTextures: sand grain, grass blades, rock striation, ice crackle) + light instanced ground props | dense instanced scatter (grass tufts, stones, cacti, ice shards — thousands, distance-culled) + richer water |
| units / cities | current recipes (300–500 tris) | current recipes, smooth normals + doubled radial segments | HIGH recipe tier: distinct crafted silhouettes, 2–5k tris |
| lighting | ambient + 1 directional, no shadows | same as Low | real-time sun shadows (PCF), pixel ratio uncapped to 3 |
| pixel ratio cap | 2 | 2 | 3 |

Design intent for the ladder: **Low is untouched** — it is the shipped,
verified look and the byte-comparable screenshot baseline. Medium is "the
same art, denser and textured". High is "the scene as it always wanted to
look".

## 2. Invariants (non-negotiable)

- **Render-only, golden-neutral.** The level lives in localStorage next to
  `palette`/`renderer`, is never written to game state, never hashed, never
  sent over the wire. Two players in one LAN game may run different tiers.
- **The Low path stays byte-identical.** `buildTerrain` at level `low` must
  produce the same buffers as today — `gallery.html?vertexcheck=1`, the
  rest-pose screenshot contracts and the ally-accepted art all keep holding.
  Every level branch is additive.
- **`recipes.js` LOW tables are untouched.** High-detail bodies go in a new
  pure-data table (`recipes-high.js`, same primitive format, same
  colorRole slots) so `data/asset-recipes.json` and the Roblox composer are
  unaffected. The high table is exportable later if Roblox ever grows a
  high tier — the recipe format is the cross-platform artifact, as before.
- **Determinism of visuals:** all placement/variation through
  `visualRand(x, y, salt)` as today. Instanced scatter positions are pure
  functions of tile coordinates — two clients at the same tier render the
  same field.
- **WebGL1 safety:** Medium features must run on the `forceWebgl1` path and
  under SwiftShader (`debugging/screenshot.sh --webgl1`). High features
  feature-detect WebGL2 and degrade per-feature, with the Options panel
  reporting what is actually active (the `rendererSummary` pattern).
- **Engine untouched.** No engine window, no re-records, no twin work.

## 3. Architecture — where it hooks

- **`client/ui/options.js`**: `graphics: 'auto'` joins DEFAULTS
  (`auto | low | medium | high`). `auto` resolves through the probe at boot.
  Options panel: selector in the existing Graphics fieldset + a line naming
  the resolved tier and any degradations. Live-switch rebuilds the scene
  (terrain rebuild already exists for palette/fog changes).
- **`client/diagnostics.js`**: `suggestGraphicsLevel()` — heuristic over
  `WEBGL_DEBUG_RENDERER_INFO` GPU string, WebGL2 availability, and
  `devicePixelRatio`/`navigator.hardwareConcurrency`. SwiftShader/WARP/D3D9
  → low; Intel integrated → medium; NVIDIA/AMD/Apple discrete strings →
  high. Conservative on unknown: medium.
- **`client/ui/setup.js` + lobby/join flow**: a three-button Graphics level
  row, pre-selected from the probe, persisted on change. Cosmetic-only —
  does not touch game-creation params or the URL canonicalization list
  (A45: no new `?param` read after module eval).
- **`client/renderer/three/index.js`**: `createRenderer(container, opts)`
  gains `opts.graphics` (resolved tier). Owns the WebGL2 check, shadow-map
  enablement, pixel-ratio cap per tier.
- **`client/renderer/three/terrain.js`**: `SEGS` becomes per-level; detail
  textures and scatter live behind the level switch. `tileTop()` math
  already generalizes (`SEGS / 2` center vertex).
- **new `client/renderer/three/scatter.js`**: instanced ground props
  (InstancedMesh; one draw call per prop kind). Distance/fog-aware, honors
  the explored-dim rule (scatter inherits the tile's fog tint or is culled
  on dimmed tiles — decide by screenshot).
- **new `client/renderer/three/recipes-high.js`**: pure-data high recipe
  tables (units, city era styles). Composer takes a tier argument and picks
  the table; smooth-normal + segment-multiplier path for Medium.

## 4. Slices

**G0 — baseline legibility fixes (tier-independent, playtest 2026-08-05).**
Two reports that apply at EVERY tier and don't wait for the system:
- *Desert vs plains read as the same color.* They nearly are: plains
  `0xc2b46b` vs desert `0xd9c27e` — both desaturated tan. Ruling: desert
  goes distinctly more yellow (candidate palette ≈ `0xe6c95f/0xefd46e/
  0xdabd52` — saturated golden sand; plains keeps its dry-khaki). Verified
  by candidate screenshot, since this re-baselines the ally-accepted
  terrain art and every Low screenshot baseline.
- *The horses special must read as a horse.* Today it is a tilted ellipsoid
  + head sphere ("rearing profile") — two brown blobs at map scale. Rework
  the plains motif with the primitives that carry the silhouette: 4 thin
  legs, horizontal body, arched neck, head, tail — a standing horse in
  side profile (the antler lesson: one load-bearing feature; for a horse
  it's legs + neck). Same `SPECIAL_MOTIF` data idiom, screenshot-verified
  via gallery + world shot.
G0 ships before G1 and re-baselines the Low screenshots ONCE, so the
graphics-level slices inherit a stable baseline. ~half a session.

**G0 DONE 2026-08-05** — 3 variants each, user-selected: desert = v2 warm
amber (`0xeab84f/0xf2c460/0xdcaa40`); horse = v1 standing profile (barrel
body, 4 legs, arched neck, muzzle, ears, tail — five new generic quadruped
shapes in PROP_SHAPES, reusable by the Game/deer motif later).
render-spec.json + asset-recipes.json regenerated; gallery grew the rows
20–22 terrain swatch (the standing hue-review surface) and the variant
process is recorded in `debugging/g0-variants.html`. Verified: contract
tests + browser smoke green, gallery shot standard AND `--webgl1`
byte-identical, `?vertexcheck=1` true/true. FOLLOW-UP queued to
roblox-helper: re-mirror `TileProps.luau` SPECIAL_MOTIF (plains) + the
Luau terrain palette's desert row (that lane owns `roblox/`).

**Standing review rule (user ruling 2026-08-05): every art-bearing slice
(units, terrain detail) presents 3 variants as screenshots for user
selection before landing.** G0 was the first pass of that loop.

**G1 DONE 2026-08-05** — `graphics: 'auto'` option + ⚙ Graphics-level select
with resolved-tier note; pure `suggestGraphicsLevel(diag)` probe
(`test/graphics-level.test.js` pins the GPU-string table: software/WebGL1-only
→ low, recognized discrete/Apple-Silicon → high, else medium); setup-screen
picker row (same localStorage key, never a game param); boot resolve +
live-switch in main.js (`renderer.setGraphicsLevel` rebuilds the world —
tileTop anchors move with mesh density). Lobby entry point rides the setup
screen; post-join changes go through ⚙.

**G2 terrain Medium DONE 2026-08-05** — `LEVEL_SEGS {low:2, medium:4}` with
low proven byte-identical (gallery cmp + vertexcheck); per-terrain face
buckets each with a procedural detail texture (`terrain-detail.js`, painter
per terrain id, coverage-tested); denser scatter + pebbles + swamp reeds
behind the level gate; deeper medium dunes; medium `--webgl1` shot
byte-identical. **Measured lesson: multiply-textures must DARKEN below the
~1.95x lighting clamp or they render invisible** — first texture pass was
symmetric-around-white and showed nothing; all painters now mark 0.45–0.85
multipliers. Style variant user-picked from 3 (`debugging/g2-variants.html`): **v2
balanced weave** (contrast 1.0, density 1.0, scatterBoost 2) — the shipped
`DETAIL_STYLE`. High currently renders the medium terrain until G3.

**G1 — plumbing (no visual change).** Option + probe + setup/Options/lobby
UI + resolved-tier plumbing into `createRenderer`/`buildTerrain`/composer
(all levels still render the Low path). Ships alone; proves the switch and
the live-rebuild. ~1 session. Tests: probe unit test (GPU-string table),
options default; `npx playwright test test-ui/options.spec.js` + setup spec.

**G2 — terrain Medium.** SEGS=4, per-terrain detail textures, light
scatter. The tier the complaint is really about — desert/plains/grassland
must read at a glance. WebGL1 pass mandatory. Ally screenshot review
(gallery + world shots) before acceptance. ~1–2 sessions.

**G3 DONE 2026-08-12 (overnight window; look variant = decide-document-flag)**
— SEGS 8, PCFSoft sun shadows (2048 map, shadow box follows the camera
target, bias tuned, no acne), pixel ratio 3, scatter ×1.7, per-tier sun
(SUN_HIGH; SUN_BASE direction-preserved so low/medium shading is untouched —
low re-verified byte-identical). High on WebGL1 DEGRADES to medium,
verified byte-identical to a real medium WebGL1 render. **Look = H2 "warm afternoon"
(user-picked 2026-08-12 of 3 variants**, g3-high-h1/h2/h3.png; `0xffe9c4`,
sun 44° offset). **Found during verification: `--disable-es3-gl-context` was
removed upstream and silently no-ops — the WebGL1 lane had been proving
nothing. Replaced with `--disable-webgl2` everywhere; `debugging/
webgl-probe.js` (permanent) verifies the flags actually work.**

**G4 DONE 2026-08-12 (overnight; style direction = decide-document-flag)** —
medium: composer segment boost ×1.5 (mechanical, whole roster + smooth
curves). High: `recipes-high.js`, all 21 silhouette bodies authored
(covers the 29-unit roster; same footprints/palette, real anatomy and kit
— legs/arms/helmets, ox-drawn settler wagon, armored knight with
caparison, road-wheeled tank, four-engine bomber, two-masted sail ships,
turreted battleships, flattop carrier with parked aircraft). Cities at
high: house ring ×1.3. **Style = A "faithful upscale"
(user-picked 2026-08-12 of 3**; B "heroic" / C "chunky miniature" demos in
g4-style-a/b/c.png). Polish item RESOLVED
2026-08-12: off-center props (road segments, ties, field patches, scatter)
sample the mesh's own height grid (`terrain.surfaceAt`), and long strips
TILT to their endpoint heights (Euler XYZ: Z-pitch before Y-yaw) — roads
and channels lie ON the medium/high relief; low is untouched (byte-checked).

**G5 DONE 2026-08-12** — `test-ui/graphics-levels.spec.js` (picker
persistence + per-tier boot + triangle budget low<medium<high with a 3M
runaway ceiling + ⚙ live-switch rebuild), `renderInfo()`/`window.__gfxInfo`
debug handle, README graphics-levels section. The WebGL1 degrade path is
guarded by webgl-probe.js + the shoot.sh --webgl1 lane (SwiftShader is
WebGL2, so the spec can't exercise it).

**G3 — terrain High + lighting (original plan).** SEGS=8, dense scatter with distance
culling, shadows, pixel ratio 3, water detail. WebGL2 gate + degradation
notes. Perf measured on the reference workload before/after. ~1–2 sessions.

**G4 — units/cities Medium+High.** Medium = smooth normals + segment
doubling (mechanical). High = `recipes-high.js` authored unit-by-unit —
the long pole: 28 units + 4 city era styles + key props, iterated through
`gallery.html?gfx=high` screenshots with ally review batches (the specials-
icons process). Can land incrementally behind the tier switch (un-authored
units fall back to Medium). ~3–5 sessions spread across review round-trips.

**G5 — guards + docs.** Perf budget per tier (the G5 perf-budget pattern:
frame-time tripwire on the reference scene per level); gallery grid gains a
tier axis; test-ui spec for picker persistence + degradation card;
docs/03 + README graphics section; `plan-version1.html`/workitems sync.
~1 session.

Order: G1 → G2 → G3 → G4 → G5. G2 is the earliest shippable player-visible
win; G4 is parallelizable behind the switch once G1 lands.

## 4b. THE V2 LADDER — re-tiered after the gallery-tiers review (2026-08-13)

_The user reviewed `gallery-tiers-comparison.png` and re-set the goals: the
G3 high terrain is a MEDIUM, medium units/cities need real vertex budgets,
every special must read as ITS animal, and the High watermark is
**Transport World** (a friend's three.js Transport Tycoon —
`debugging/example-from-transport-world.png`). Four rulings, same day:_

1. **Shadows stay High-only.** Medium = dense terrain + textures + detailed
   units, shadow-free, integrated-GPU friendly.
2. **High terrain goes SMOOTH, TW-style.** Per-vertex normals, cross-tile
   color blending, sand coast rings, shoreline foam, terrain-conforming
   road ribbons. The faceted "tabletop" identity stays the Low/Medium look;
   High is "the world made real".
3. **High units/cities go model-grade.** Cities: multi-part houses (pitched
   roofs, chimneys, window insets, era-styled), landmarks for walls/wonders.
   Units: vehicle-grade — wheels with hubs, cabs, mantlets, rigging, limbs
   and kit. The ownership base disc stays at EVERY tier (gameplay-critical).
4. **Re-tier + animals ship first** as a patch; the High arc runs behind it
   in 3-variant batches.

**What the TW watermark actually consists of** (the analysis the rulings
answered): smooth relief with blended transitions (grass→rock, sand ring at
water), foam shoreline, model-grade houses (10–20 parts each), recognizable
vehicles, trees as trunk+layered-canopy models with species variety, roads
as curved conforming ribbons — and soft shadows tying it together.

### The v2 tier table

| | Low (unchanged, forever) | Medium (v2) | High (v2) |
|---|---|---|---|
| terrain | faceted SEGS 2 | faceted SEGS 8 + detail textures + scatter ×1.7 (= the G3 terrain) | SMOOTH: per-vertex normals, blended transitions, sand coasts, foam shoreline, road ribbons |
| units | shipped recipes | the 21 faithful-upscale bodies + seg boost (= G4 high) | model-grade TW bodies, authored per silhouette |
| cities | shipped tiers | ×1.3 density + seg boost | multi-part era-styled houses, landmark walls/wonders |
| specials | identifiable animals (H1 — every tier shares the motifs) | same, denser segments | same, high-segment |
| lighting | flat | flat (no shadows) | sun shadows, pixel ratio 3, WebGL2 gate |

### Slices

**H1 DONE 2026-08-13** — re-tier landed: medium terrain = LEVEL_SEGS 8 +
×1.7 scatter, medium units = the 21 authored bodies, medium cities ×1.3;
high's only delta until H2 is shadows (spec test asserts >= with a pointer
here). Animals user-picked of 3 each: **deer V1 standing-alert** (forest +
tundra in its colors — legs, raised neck, the antler V, white tail),
**seal V1 basking** (chest on fore-flippers, head up, tail flipper),
**fish V1 side-profile** (forked tail, dorsal fin, eye dot). All reuse the
G0 quadruped shapes — no new PROP_SHAPES, no asset-recipes change. Low
re-baselined once (G0 precedent). **Measured note: WebGL1-vs-WebGL2 LOW
frames are no longer byte-identical — thin sub-pixel geometry (antlers,
flippers) resolves differently between the backends' MSAA (max channel
delta 53 on ~7k edge pixels, confined to the specials row). Byte-parity
across GL backends was an observed nicety, never the contract; the
contracts that hold are vertexcheck determinism (true/true) and the
WebGL1 pass functioning.** Visual goldens re-record rides the next CI
dispatch. Variants: `debugging/h1-variants.html`.

**H1 — re-tier + the animals (the original plan).**
- Medium terrain := LEVEL_SEGS 8 + textures + ×1.7 scatter; High terrain
  temporarily equal (test note below). Medium units := HIGH_UNIT_RECIPES;
  medium cities := ×1.3. High keeps shadows as its only delta until H2.
- The Civ 1 special ANIMALS get the G0 horse treatment: **Game/deer**
  (forest + tundra — body on legs, lifted neck+head, the antler V),
  **Seal** (arctic — tapered body, raised head, fore-flippers, tail
  flipper), **Fish** (ocean — real tail fin, dorsal fin, eye dot). The
  quadruped shapes from G0 reuse; 3 variants each for user pick. Motifs are
  tier-shared, so LOW re-baselines ONCE more (G0 precedent) → visual
  goldens re-record rides this slice.
- `test-ui/graphics-levels.spec.js`: high-vs-medium triangle assertion
  becomes `>=` in H1 (they are equal until H2 gives High its own terrain),
  with a comment pointing here; restore `>` in H2.

**H2 DONE 2026-08-13 (overnight window; picks = decide-document-flag)** —
High renders the smooth TW style: ONE indexed mesh, per-vertex colors
blended across tile boundaries (sharpened bilinear weights —
`SMOOTH_STYLE.blendSharpness`), `computeVertexNormals` relief, SAND painted
at land/water boundary vertices (both banks — the TW beach), river/fog as
per-vertex weights (soft edges). TW tree kit at high: trunk + layered
canopy, 60/25/15 deciduous/conifer/autumn species mix + lone meadow trees
on open grassland; roads = 3 conforming sub-segments per connection + white
centerline dashes (rails keep ties); double surf line on coasts.
Picks USER-CONFIRMED 2026-08-13 (`debugging/h2-variants.html`):
blend V2 "balanced" (exponent 3) + forest A "mixed wood" — both were the
landed provisionals. Verified: LOW
byte-identical, medium self-consistent (H2 is entirely behind the high
gate), battery 22/22, graphics spec 3/3 with the strict `>` restored
(high owns trees/dashes/foam beyond medium). New PROP_SHAPES: treeTrunk /
treeCanopy / roadDash (asset-recipes regenerated — additive, Roblox
unaffected).

**H2 — High terrain, the TW look (the original plan).**
Smooth per-vertex normals (indexed geometry at high, computeVertexNormals);
color BLENDING at tile transitions (vertex colors sampled from neighbor
terrain at boundary vertices); sand ring where land meets water; animated
foam shoreline strip hugging the coast; road/rail as conforming ribbon
geometry (curve through neighbor connections, dashed centerline texture);
tree/forest props get trunk+layered-canopy models with per-tile species
variety. Perf measured on the reference workload; triangle ceiling re-set.

**H3 DONE 2026-08-13 (overnight; pick = decide-document-flag)** — the
High house kit: houses FACE the city center, gable ridge roofs (4-seg cone
scaled to a ridge) with chimneys on peaked eras, industrial keeps flat
roofs + per-house smokestacks, modern slabs carry rooftop units; window
insets (proud dark boxes) + doors, all deterministic off the house index;
City Walls becomes a REAL rampart — 10 segments + 5 capped towers.
Style A "lived-in" USER-CONFIRMED 2026-08-13 of 3
(`debugging/h3-variants.html`) — the landed provisional.
Verified: low byte-identical, battery green (render-spec regenerated —
the HIGH_GEO table is additive), era grid reads at high.

**H3 — High cities (the original plan).** House model kit:
wall box + pitched roof + chimney + window insets (dark material), era
variants (thatch/timber → brick+smokestacks → glass slabs); city walls as
a real rampart ring; the capital's palace as a landmark.

**H4 BATCH 1 DONE 2026-08-13 (overnight)** — `recipes-model.js`
(MODEL_UNIT_RECIPES), consumed only at high with per-silhouette fallback to
the medium body, so the tier lands batch by batch. Eight flagship bodies at
TW vehicle-grade: footSoldier (stance/belt/cheek-guard helm/butt spike/
shield boss), phalanx (faction-blazon shield + transverse crest + greaves),
mounted (mane/hooves/saddle blanket/raised sword), knight (caparison +
chanfron + visor slit + lance guard), tank (road wheels + skirts + mantlet
+ cupola + tow hooks), shipSail (plank lines/keel/castles/crow's nest/
rudder), shipPowered (deck/capped funnels/bridge windows/twin-barrel
turrets/lifeboats), aircraft (cowl/prop/spinner/canopy/gear). Verified:
low byte-identical, battery 22/22, graphics spec 3/3.

**H4 BATCH 2 DONE 2026-08-13 (same window) — H4 COMPLETE: all 21
silhouettes model-grade.** Sprung ox wagon (canopy hoops, driver, yoked
pair), spoked chariot wheels + basket, ringed cannon with elevation screw
+ ammo box, full torsion catapult (skein/winch/stone pile), envoy with
wax-sealed scroll, musketeer + rifleman with LEVELED weapons and both
arms, APC with wheel wells + headlights, glazed-nose four-engine bomber,
gantry-launched missile, submarine with deck line + prop guard, carrier
with angled deck stripe + radar bar, and a neutral obelisk fallback.
Same verification set green; low byte-identical throughout.

**H4 — High units (the original plan).** Vehicle-grade
bodies over the recipes-high skeletons: wheels with hubs and spokes, tank
treads with road wheels, cabs with window insets, ship hulls with planking
lines + rigging + cloth sails, aircraft with canopies and engine detail,
infantry with articulated limbs and kit. Authored in review batches
(ancient / gunpowder / industrial / naval / air).

**H5 DONE 2026-08-13** — per-tier budgets MEASURED on the plain xsmall
boot (`debugging/measure-tris.mjs`, permanent): low 9,600 tris / 24 calls
→ medium 130,152 / 39 → high 135,416 / 44; the 3M runaway ceiling holds
with ~22× headroom. `renderInfo()` gained a scene census (unit/city/prop
mesh counts). **Measurement trap, recorded: never budget against a
`?e2e=1` boot — the e2e probe flow parks the scene in artificial states
(0-unit swaps mid-probe) and the numbers lie; the spec + the measure tool
both boot PLAIN now.** Tier comparison sheet regenerated for the v2
ladder; README tier descriptions updated.

**H5 — guards + re-budget (the original plan).** Per-tier triangle budgets re-measured; the
runaway ceiling raised with the measurement recorded; gallery tier axis
re-shot; goldens re-recorded; README/docs updated.

## 5. Risks, named

- **Style seam.** High-detail units next to Low-ish props would look wrong;
  G4 therefore covers units AND the props/cities they stand beside.
- **Texture memory on mobile is not a High problem** — Medium's 11 × 256²
  canvases are ~3 MB GPU-side, fine for Iris Xe; still verified on a real
  phone via `?mlog=1`.
- **Instancing on old ANGLE:** already a non-risk in practice — `props.js`
  ships `InstancedMesh` at Low today, so the extension is proven on the
  WebGL1/SwiftShader path. The probe still checks it defensively; without
  it Medium drops scatter, keeps textures.
- **Shadow acne/peter-panning** on a displaced low-poly surface needs bias
  tuning — budget a screenshot iteration loop, not a single landing.
- **Live-switch leaks:** every level branch must dispose geometries/
  textures on rebuild — the existing `dispose()` discipline extends to
  scatter and detail textures.

## 6. Acceptance

- A playtester on the reported hardware says desert/plains/grass/tundra are
  identifiable at default zoom without the tile card. (The actual
  complaint, verified by the people who made it.)
- High: shadows + dense scatter at ≥50 fps on a discrete GPU at 1440p on a
  `large` map (measured, number recorded here).
- Low screenshots byte-stable vs the post-G0 baseline (G0 re-baselines
  once, deliberately); full suite green;
  affected test-ui specs green; WebGL1 lane green for Low/Medium.

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

**G3 — terrain High + lighting.** SEGS=8, dense scatter with distance
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

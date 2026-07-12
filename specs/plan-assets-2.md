# Designer ally — native-Three.js asset improvements, A1.6/A1.7 proposal (verbatim, 2026-07-12)

Yes—there is plenty you can do with **native Three.js geometry, materials, CanvasTexture, and procedural decoration** before needing Blender. Given the deliberate WebGL1/r162 support, I would favor techniques that are simple, explicit, and easy to test on both paths.

### Keep the visual hierarchy clear

For a strategy game, visual priority should be:

1. **Ownership and unit type**
2. **Cities, roads, resources, improvements**
3. **Terrain category and movement/defense implications**
4. **Decorative detail**

Avoid making terrain or units so detailed that they obscure game information.

## Improve tiles without external models

### 1. Terrain micro-geometry

The continuous terrain surface is the foundation. Add small, deterministic geometry overlays by terrain type:

| Terrain | Native Three.js decoration |
|---|---|
| Grassland | Low irregular grass clumps, tiny stones |
| Plains | Sparse scrub clusters, dry grass tufts |
| Desert | Low dune ridges, angular sandstone rocks |
| Forest | Tree clusters, logs, boulders |
| Jungle | Taller/darker clustered canopy shapes |
| Hills | Rock outcrops, sparse scrub |
| Mountains | Additional peak meshes, scree rocks, snow-cap overlay |
| Tundra | Pale rocks, sparse conifers |
| Swamp | Shallow dark-water patches, reeds |
| Ocean | Slightly offset low-poly wave facets, shoreline foam strips |

All of these can be built with primitives:

- `ConeGeometry` / `IcosahedronGeometry` for trees and rocks
- `DodecahedronGeometry` for faceted boulders
- `CylinderGeometry` for trunks, reeds, and small pillars
- `PlaneGeometry` for shallow water, dune bands, foam, and fields
- small custom `BufferGeometry` shapes for roads and river segments

Generate each from a **visual-only deterministic seed** based on:

```js
worldSeed + tile.x + tile.y + terrainType
```

This preserves the same decorative placement after reloads without storing it in saves or canonical state.

### 2. Terrain-specific material properties

Even with no image textures, terrain becomes more distinct if its materials react differently to light. For your compatibility target, `MeshLambertMaterial` and `MeshPhongMaterial` are sensible, reliable choices (Phong water: shininess ~35, slight transparency). You do not need advanced custom shaders yet.

### 3. Procedural CanvasTexture patterns

Generate tiny repeatable textures in JavaScript at startup—no Blender, no image files: grass flecks, dry speckles, dune streaks, rock mottle, water bands, snow speckling. Use a `CanvasTexture` from a seeded local RNG. Keep patterns low-contrast; they should enrich the surface, not turn the map into noise. WebGL1-compatible.

### 4. Better coastlines and water

- Keep water slightly below land.
- 1–2 lighter shallow-water layers along coastal tiles.
- Small translucent foam strips where land borders water.
- Subtle wave movement by shifting a texture offset—not by changing simulation state.
- Darker deep-water palette farther from land, if world data supports it.
- Do not hide tile boundaries completely; coastlines can be stylized and grid-readable.

### 5. Improve roads, irrigation, mines, and railroads

| Improvement | Native geometry approach |
|---|---|
| Road | Connected narrow `PlaneGeometry` strips following tile-edge links |
| Railroad | Dark road strip plus repeated small cross-ties |
| Irrigation | Green rectangular cultivated patches and thin blue channels |
| Mine | Dark entrance plane plus faceted rock pile and timber beams |
| Fortress | Tiny stone tower, palisade, or angular fortified ring |
| Farmland | Alternating subtle field-color strips |
| Forest clearing | Fewer/different props and a stump/log cluster |

Roads should visually connect only to neighboring road tiles.

## Improve units without Blender

### 1. Distinctive silhouettes (unit families table: settler wagon+banner, phalanx shield+spear, chariot wheels+chassis, ships hull+mast+sail, sub hull+tower, aircraft wing, tank tracks+turret). Improve by adding one or two identity-defining forms, not polygons.

### 2. Universal "unit token" layer

```text
Unit model
  ├─ neutral/dark body
  ├─ civilization-colored base ring or disc
  ├─ civilization-colored banner / shield / sail accent
  ├─ optional veteran marker
  └─ optional status icon: fortified, sentry, GoTo, damaged
```

The colored base remains the fastest way to read ownership.

### 3. Faction color as an accent, not the whole model

Body/armor/hull neutral; base disc, flag, shield-face in civilization color; weapons/wood neutral; health/status in UI colors. Example: `{ primary: 0xb83c3c, secondary: 0xf0d6a0, dark: 0x542020 }`.

## Civilization flags and symbols

A **flag plus faction color** is the best native solution. Define per-civ visuals in data: primaryColor, secondaryColor, bannerSymbol (sun/star/diamond/chevron/wave/tower/oak/mountain/hammer/wheel/rune...). Use **original names and symbols**, not copied designs.

First implementation: colored geometric pennants (pole cylinder + flag plane + emblem circle — code sketch given; DoubleSide, cheap, WebGL1-friendly). Higher quality: 64×64 CanvasTexture emblems (paint primary, draw secondary-symbol, `THREE.CanvasTexture`, sRGB) for cities/capitals/UI (setup screen, scoreboard, city view header).

## Tiny status markers, not more model complexity

| State | Visual treatment |
|---|---|
| Selected | Pulsing or bright outlined base ring |
| Fortified | Tiny shield icon / lowered spear |
| Veteran | Gold star or thin gold rim on base |
| Damaged | Small red health pip |
| GoTo | Small directional arrow or route line |
| Sentry | Eye/alert icon |
| Available to move | Slightly brighter base |
| Already moved | Reduced saturation / dimmer base |

These add more player value than 400-triangle warriors.

## Suggested next art pass

### Art A1.6 — procedural terrain and faction identity

1. Deterministic terrain prop clusters (trees, rocks, shrubs, dunes, snow rocks, shallow water).
2. Improved infrastructure models (connected roads, rail ties, fields/channels, mine entrances).
3. Stronger unit silhouettes (banner, shield, bow, wheel, sail, turret, wing).
4. Faction identity data (primary, secondary, emblem type).
5. Colored base discs/rings consistently.
6. Simple geometric flags on every city and key unit.
7. CanvasTexture emblem flags for capitals and UI.
8. State markers: selected, fortified, veteran, damaged, GoTo.

### Art A1.7 — polish after that

Flag bob/sway from render time only; unit movement interpolation; small city smoke; water texture scrolling; combat flashes with a "reduce animation" option. None of these should change simulation, command timing, save data, fog, or replay hashes.

The highest-return move is **a civilization visual-definition table plus consistent banners/base rings/shield accents**.

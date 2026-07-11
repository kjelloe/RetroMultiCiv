### When to add more detailed terrain

**Start now—but keep it lightweight and procedural.** You have enough core gameplay to benefit from visual readability improvements, and your existing asset-factory seam means terrain art can evolve without touching the simulation.

Do **not** pause hotseat work for a full Blender-art pass. Instead, run a small **Terrain Art A1.5** pass alongside Phase 2:

- Improve terrain readability at the normal play camera distance.
- Add randomized low-poly props and texture-free color variation.
- Preserve tile boundaries, yields, resources, ownership, and unit visibility.
- Keep all decoration frontend-only and derived deterministically from tile coordinates plus the world seed.

Then wait until after hotseat and the server boundary are stable before investing in hand-authored `.glb` terrain kits.

### The design target: readable first, detailed second

At strategy-map scale, players need to recognize tiles instantly.

| Tile type | First-read silhouette | Detail layer |
|---|---|---|
| Grassland | Flat green open space | A few grass tufts, rocks, subtle color variation |
| Plains | Dry/yellow open ground | Small scrub, dry grass, low rocks |
| Forest | Dense tree cluster | 3–8 low-poly trees, occasional fallen log |
| Hills | Raised angular terrain | Rocky outcrops, sparse trees |
| Mountains | Tall jagged landmark | Snow cap at high elevation, darker rock sides |
| Desert | Flat warm sand | Dunes, rocks, small scrub |
| Tundra | Pale open ground | Sparse conifers, icy rocks |
| Ocean | Blue low plane | Subtle waves, lighter coastline, occasional foam |
| River | Thin blue route | Riverbed and bank color difference |

A player should be able to identify terrain without hovering, even when zoomed out.

### Recommended terrain construction layers

Use a layered approach rather than making every tile a unique hand-made mesh:

```text
Tile visual
  ├─ Base tile geometry
  │   ├─ Terrain color
  │   ├─ Terrain height
  │   └─ Optional slight vertex variation
  │
  ├─ Feature geometry
  │   ├─ Forest trees
  │   ├─ Hills / mountain rocks
  │   ├─ Rivers
  │   └─ Coastline accents
  │
  ├─ Improvement geometry
  │   ├─ Road
  │   ├─ Irrigation
  │   ├─ Mine
  │   └─ Fortress later
  │
  ├─ Resource geometry
  │   ├─ Gold / gems
  │   ├─ Horses
  │   ├─ Grain / game
  │   └─ Strategic resources later
  │
  └─ Gameplay overlays
      ├─ Fog of war
      ├─ Ownership
      ├─ City workable radius
      ├─ Selected-tile highlight
      └─ Movement / combat previews
```

The important rule is:

> **Simulation state determines which visual layers exist; visual code determines only their appearance.**

### Build terrain detail deterministically

Decorative props must not be stored in the canonical game state. Generate them from:

- `world.seed`
- `tile.x`
- `tile.y`
- `tile.terrain`
- optional `tile.feature`

For example, a forest tile may always produce the same tree positions for the same seed.

```js
function getTileVisualSeed(worldSeed, x, y) {
  return `${worldSeed}:${x}:${y}`;
}
```

Use a local deterministic visual random generator to derive:

- Number of trees
- Tree type/shape
- Tree position within the tile
- Rotation
- Scale
- Rock placement
- Small base-color variation

This keeps the world consistent across refreshes and save/load, without inflating save files or affecting replay hashes.

### What to implement first

#### 1. Terrain palette variation

Add 3–5 color variants for every terrain type.

For example:

```js
const TERRAIN_COLORS = {
  grassland: [0x5b9d4b, 0x639f50, 0x70aa59, 0x4f9143],
  plains: [0xb8a35d, 0xc2ad68, 0xaa9552],
  desert: [0xd8bd78, 0xe2c984, 0xcdb16f],
  ocean: [0x2d6fa5, 0x337bb3, 0x276696]
};
```

This is a high-value, low-cost improvement. A perfectly uniform tile grid looks artificial; small variation makes it feel like a world.

Keep the colors close enough that the player can still identify terrain at a glance.

#### 2. Height and edge variation

Add small terrain height differences:

- Grassland/plains: nearly flat
- Hills: moderate elevation
- Mountains: high, angular peaks
- Ocean: slightly lower than land

Avoid noisy per-tile height changes that obscure movement or tile boundaries. The map should be terrain-like but still board-game legible.

For a square grid, apply heights mostly by terrain category, with a small deterministic offset:

```text
Ocean:       -0.10
Grassland:    0.00
Plains:       0.02
Forest:       0.04
Hills:        0.20 to 0.45
Mountains:    0.55 to 1.20
```

#### 3. Forests as prop clusters

Forests give the largest immediate visual payoff.

Use 3–8 simple conical or faceted trees per forest tile:

- Brown cylinder/trunk
- Dark green low-poly cone or icosahedron canopy
- Two or three tree shape variants
- Randomized scale/rotation from deterministic visual seed

Use `THREE.InstancedMesh` when possible. Forests can easily become the largest source of objects on the map.

#### 4. Hills and mountains as silhouettes

Do not make hills a flat tile with a brown color. Add visible angular forms.

- Hills: one or two squashed low-poly rock mounds.
- Mountains: 1–3 jagged peaks with dark rock and optional pale upper faces.
- Avoid placing dense decorative props that hide units.

These should be **static terrain visuals**, not interactive entities.

#### 5. Water and coastlines

Water is a major readability feature. A good early approach:

- Lower water level slightly below land.
- Use a `MeshStandardMaterial` or `MeshPhongMaterial` with low roughness.
- Animate a very subtle shader/vertex wave later.
- Add a lighter coastal strip or shallow-water tiles adjacent to land.
- Ensure ships and coastal cities remain clearly visible.

Avoid reflective photorealistic water. It will clash with the low-poly board-game style and adds little strategic value.

#### 6. Roads, mines, and irrigation

These are worth polishing early because they communicate player agency.

| Improvement | Suggested low-poly visual |
|---|---|
| Road | Narrow tan/dark path entering/exiting tile edges |
| Irrigation | Blue/turquoise channels or green cultivated field strips |
| Mine | Dark entrance, timber supports, rock pile |
| Railroad later | Dark track with regular ties |
| Fortress later | Small stone tower/palisade |
| Farmland later | Tidy field pattern / fence sections |

Roads require special care: generate connections based on neighboring improved tiles, so a road visually crosses a tile edge only if an adjacent tile contains a road.

### Avoid these common mistakes

- **Do not use individual mesh objects for all 4,000 tiles.** Use instancing/batched terrain meshes.
- **Do not use heavy textures first.** Low-poly geometry, material colors, and lighting will look cleaner and be easier to maintain.
- **Do not make tile props too tall or dense.** Units, city markers, resources, and tile overlays must remain visible.
- **Do not couple visual decoration to game state.** A tree mesh must never influence movement, visibility, yields, or combat.
- **Do not make fog transparent enough to reveal terrain resources or units.**
- **Do not introduce terrain visual randomness with `Math.random()`.** It will change when refreshing and complicate debugging.

### A good implementation sequence

```text
Terrain Art A1.5 — now, parallel with hotseat
  1. Terrain color variants
  2. Land/water elevation separation
  3. Low-poly tree clusters
  4. Angular hills and mountains
  5. Road/irrigation/mine meshes
  6. Improved fog and selection overlays

Terrain Art A2 — after server-authoritative state is stable
  1. Blender-made original terrain prop kit
  2. GLB loading and asset cache
  3. More polished city-era visuals
  4. Better rivers, coastlines, and resource props

Terrain Art A3 — after LAN multiplayer
  1. Animated water
  2. Flag movement
  3. City smoke / ambient effects
  4. Unit movement interpolation and combat effects
```

### Suggested technical interface

Keep terrain rendering behind a frontend-only factory, analogous to your unit/city asset factory:

```js
const TerrainVisualFactory = {
  createBaseTile(tile, worldSeed) {
    // Return or configure base terrain geometry/material.
  },

  createFeatureProps(tile, worldSeed) {
    // Trees, rocks, mountain peaks, etc.
  },

  createImprovementProps(tile) {
    // Roads, irrigation, mines.
  },

  createResourceProps(tile, worldSeed) {
    // Visible resource marker/prop.
  }
};
```

Then the renderer does something like:

```js
const tileView = TerrainVisualFactory.createBaseTile(tile, gameState.header.seed);

tileView.add(
  ...TerrainVisualFactory.createFeatureProps(tile, gameState.header.seed)
);

tileView.add(
  ...TerrainVisualFactory.createImprovementProps(tile)
);

tileView.add(
  ...TerrainVisualFactory.createResourceProps(tile, gameState.header.seed)
);
```

The eventual Roblox port does **not** need to recreate Three.js meshes. It only uses the same procedural visual seed rules and makes Roblox `Part`/`Model` equivalents.

### The practical answer

Your next art pass should be **procedural low-poly terrain detail now**, especially:

1. terrain color variants;
2. low-poly forests;
3. visibly raised hills and mountains;
4. lower, better-colored water;
5. visual roads, irrigation, and mines;
6. deterministic resource markers.

That will make the world feel dramatically more alive while preserving performance, readability, replay determinism, and your clean separation between game simulation and rendering.

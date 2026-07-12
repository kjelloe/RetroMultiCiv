# Terrain Mesh A2 — designer ally's technical spec (saved verbatim, 2026-07-12)

This is a technical implementation guide for the "coding ally." It focuses on transitioning from individual colored cubes to a **continuous, modern low-poly terrain system** using only native Three.js features (no external assets).

***

### 🗺️ Technical Spec: Native Low-Poly Terrain System

#### 1. The Strategy: "Single Surface, Variable Data"
Instead of rendering 4,000 separate `BoxGeometry` objects (80×50), we will generate a single, continuous `BufferGeometry` for the entire map. This is more performant and allows us to use **Vertex Coloring** and **Flat Shading** for that characteristic "low-poly faceted" look.

#### 2. The Geometry Setup
Use a subdivided plane. A single triangle per tile is too stiff; we want 2-4 segments per tile to allow for subtle undulations (hills, mountain peaks, dunes).

```javascript
// Example Config
const MAP_WIDTH = 80;
const MAP_HEIGHT = 50;
const TILE_SIZE = 1;
const SEGMENTS_PER_TILE = 2; // Allows for mid-tile height points

const geometry = new THREE.PlaneGeometry(
  MAP_WIDTH * TILE_SIZE,
  MAP_HEIGHT * TILE_SIZE,
  MAP_WIDTH * SEGMENTS_PER_TILE,
  MAP_HEIGHT * SEGMENTS_PER_TILE
);

geometry.rotateX(-Math.PI / 2); // Lay it flat on XZ plane
```

#### 3. Faceted Look (Flat Shading)
To get the "indie strategy" look where every triangle face catches light individually, we use `MeshStandardMaterial` with `flatShading`.

```javascript
const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,   // Ground colors driven by vertex data
  flatShading: true,    // The "low-poly" aesthetic
  roughness: 0.9,       // Keep it matte
  metalness: 0.0        // Strategy maps aren't metallic
});
```

#### 4. The Height Map logic
We must map simulation tile coordinates to geometry vertices. We want deterministic heights based on the `worldSeed`.

**Height rules for logic:**
*   **Water:** Constant `y = -0.15` (creates a "sunken" basin look).
*   **Land:** Base `y = 0.0`.
*   **Hills:** Ramps up to `y = 0.25` with jitter.
*   **Mountains:** High peaks up to `y = 0.8` to `1.2`.
*   **Desert:** Add a very small sine wave to the vertices to simulate sand dunes.

#### 5. Deterministic Vertex Coloring
To avoid the "checkerboard" look, every terrain type should have a **Palette** of 3–4 shades. We pick a shade for each vertex using a simple hash of the coordinates.

```javascript
const PALETTES = {
  grass: [0x5d974d, 0x6ca857, 0x4e8742],
  desert: [0xd8bd78, 0xe2c984, 0xcdb16f],
  tundra: [0xb8c1b1, 0x9da89a, 0xaeb7a8],
  mountain: [0x575751, 0x67655d, 0x494a46]
};

// Inside the vertex loop:
const terrain = getTileAt(x, z).type;
const palette = PALETTES[terrain];
const colorIndex = deterministicHash(x, z) % palette.length;
const finalColor = new THREE.Color(palette[colorIndex]);
// Apply to geometry.attributes.color
```

#### 6. Feature Layers (The "Dressing")
Geometry displacement handles the ground, but "Features" like **Forests** and **Resources** should remain separate objects managed by the existing `AssetFactory`.

*   **Forests:** Use the `AssetFactory` to place 3–5 tiny low-poly trees (cones) in a cluster on tiles with the `forest` flag.
*   **Roads:** Draw these as thin `PlaneGeometry` strips hovering `0.01` above the ground. Only render the segments that connect to adjacent road-tiles.
*   **Cities:** Still use the "house cluster" groups, but ensure they sit correctly on the terrain height.

#### 7. The Interaction Grid
Because the terrain is now a continuous mesh, we need a separate "Interaction Mesh" to show the grid and player actions.
*   Create a second, transparent `PlaneGeometry` at `y = 0.02`.
*   Use a low-opacity texture of a square grid.
*   When a Settler is selected, tint the specific vertices/tiles of this overlay to show the city-founding footprint.

#### 8. Fog of War
Instead of deleting meshes, we use the **Vertex Alpha** or a **Texture Mask**.
*   Black: Unexplored (completely opaque).
*   Semi-transparent grey: Explored but not in line-of-sight (shows terrain, hides units).
*   Transparent: Visible.

---

### Suggested Action Plan for Coding Ally:
1.  **Refactor `MapRenderer.js`**: Move away from `new Mesh()` inside a nested loop. Switch to one single `BufferGeometry`.
2.  **Vertex Height Pass**: Implement a function that sets vertex `y` positions based on the `gameMap` terrain data + a seed-based jitter.
3.  **Vertex Color Pass**: Implement the `PALETTES` lookup to get rid of the solid-green flat look.
4.  **Lighting Update**: Ensure there is one `DirectionalLight` (like a sun) acting on the map to create those faceted shadows on mountain/hill sides.
5.  **Alignment**: Ensure the `UnitManager` queries the terrain height at a specific `(x, z)` so that units don't clip through hills—they should stand on top of them.

**Goal:** After this update, the map should look like a hand-crafted low-poly tabletop landscape, despite being 100% generated from the simulation data.

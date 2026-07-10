### Best approach: staged low-poly assets

For this kind of map strategy game, the best approach is:

1. **Keep cones and blocks during mechanics development**
2. Replace them with **procedurally assembled low-poly Three.js models**
3. Later move important assets to **original `.glb` / glTF models** made in Blender
4. Use **instancing** for repeated terrain props, trees, resource icons, and possibly units

This keeps the proof of concept fast, performs well on a 64×64 map, and avoids blocking game development on art production.

Also: make original assets and visual language rather than reusing Civilization artwork, sprites, unit icons, town graphics, etc.

### Recommended visual direction

For the first real art pass, I would use a **readable tabletop / low-poly strategy style**:

- Terrain: flat tiles with slightly raised height variation
- Towns: clusters of tiny houses, walls, towers, farms
- Units: simplified “token” models with clear silhouettes
- Player ownership: colored banner, base ring, shield, or flag
- Selection: glowing ring or outlined tile
- Unit type: silhouette first; tiny model detail second

At the distance a Civilization-style map is played, recognition matters much more than polygon detail.

| Game object | Recommended visual representation |
|---|---|
| Settler | Covered wagon, tent, or person with pack/banner |
| Warrior | Small figure/token with spear |
| Archer | Figure/token with bow and quiver silhouette |
| Phalanx | Spear-and-shield formation |
| Horse unit | Horse silhouette with rider/banner |
| Ship | Simple stylized boat with sail |
| City | Small building cluster, scaled by population |
| Capital | City plus tall banner, wall, monument, or distinct roof |
| Enemy ownership | Different color flag/base/border, not just recolored whole mesh |

### Build the first assets directly in Three.js

For the earliest version, don’t open Blender yet unless you enjoy asset work. Create units and towns from primitives with `THREE.Group`.

That gives you:

- Zero asset-loading pipeline initially
- Immediate iteration
- Fully procedural coloring and flags
- Easy ownership variants
- Easy transition from placeholder to stylized assets

Example: a small, original “warrior token” built from primitive shapes.

```js
import * as THREE from "three";

export function createWarriorMesh(ownerColor) {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: ownerColor,
    roughness: 0.85
  });

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8b8b8,
    roughness: 0.55,
    metalness: 0.35
  });

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b3f1f,
    roughness: 0.9
  });

  // Colored base: ownership remains visible from map distance.
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.08, 12),
    bodyMaterial
  );
  base.position.y = 0.04;
  group.add(base);

  // Body.
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.48, 8),
    bodyMaterial
  );
  body.position.y = 0.32;
  group.add(body);

  // Head.
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd7a27d })
  );
  head.position.y = 0.64;
  group.add(head);

  // Spear shaft.
  const spear = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6),
    woodMaterial
  );
  spear.position.set(0.17, 0.55, 0);
  spear.rotation.z = -0.15;
  group.add(spear);

  // Spear tip.
  const spearTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 4),
    metalMaterial
  );
  spearTip.position.set(0.23, 1.03, 0);
  spearTip.rotation.z = -0.15;
  group.add(spearTip);

  group.userData.assetType = "warrior";

  return group;
}
```

Use it like:

```js
const warriorMesh = createWarriorMesh(0xc94545);
warriorMesh.position.set(worldX, 0, worldZ);
scene.add(warriorMesh);
```

### Procedural town / city assets

Cities should be `THREE.Group` objects too. Generate a small deterministic building layout based on:

- City population
- City ID
- Civilization color
- City buildings
- Whether it is a capital
- Era later

A population-one settlement can have 2–3 buildings. A larger city gets more buildings, a wall, perhaps a landmark, and more verticality.

```js
import * as THREE from "three";

export function createCityMesh(city) {
  const group = new THREE.Group();

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xc2ab82,
    roughness: 0.9
  });

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: city.ownerColor,
    roughness: 0.85
  });

  const houseMaterial = new THREE.MeshStandardMaterial({
    color: 0xe1d0ad,
    roughness: 0.95
  });

  const buildingCount = Math.min(2 + city.population, 12);

  for (let index = 0; index < buildingCount; index += 1) {
    const angle = (index / buildingCount) * Math.PI * 2;
    const distance = 0.18 + (index % 3) * 0.12;

    const house = new THREE.Group();

    const width = 0.16 + (index % 2) * 0.04;
    const height = 0.15 + (index % 4) * 0.04;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, width),
      houseMaterial
    );
    base.position.y = height / 2;
    house.add(base);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(width * 0.85, height * 0.7, 4),
      roofMaterial
    );
    roof.position.y = height + height * 0.35;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);

    house.position.set(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance
    );

    group.add(house);
  }

  // Capital / ownership banner.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.8, 6),
    wallMaterial
  );
  pole.position.y = 0.4;
  group.add(pole);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.16),
    new THREE.MeshStandardMaterial({
      color: city.ownerColor,
      side: THREE.DoubleSide
    })
  );
  flag.position.set(0.14, 0.72, 0);
  group.add(flag);

  if (city.hasWalls) {
    const wall = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.045, 6, 16),
      wallMaterial
    );
    wall.rotation.x = Math.PI / 2;
    wall.position.y = 0.06;
    group.add(wall);
  }

  group.userData.assetType = "city";
  group.userData.cityId = city.id;

  return group;
}
```

### Use a visual factory, not scattered mesh creation

Avoid creating models directly inside map, networking, or command logic. Put all visual construction in one frontend-only layer.

Suggested structure:

```text
client/
  src/
    rendering/
      AssetFactory.js
      UnitViewManager.js
      CityViewManager.js
      TerrainRenderer.js
      SelectionRenderer.js
      FogRenderer.js
    assets/
      models/
      textures/
```

Example `AssetFactory.js` API:

```js
export const AssetFactory = {
  createUnit(unit, civColor) {
    if (unit.type === "settler") {
      return createSettlerMesh(civColor);
    }

    if (unit.type === "warrior") {
      return createWarriorMesh(civColor);
    }

    if (unit.type === "archer") {
      return createArcherMesh(civColor);
    }

    return createUnknownUnitMesh(civColor);
  },

  createCity(city, civColor) {
    return createCityMesh({
      ...city,
      ownerColor: civColor
    });
  }
};
```

Your rendering update code then remains simple:

```js
function syncUnitView(unit) {
  let view = unitViews[unit.id];

  if (!view) {
    view = AssetFactory.createUnit(unit, getCivColor(unit.civId));
    unitViews[unit.id] = view;
    scene.add(view);
  }

  view.position.set(
    tileToWorldX(unit.x),
    getTileHeight(unit.x, unit.y),
    tileToWorldZ(unit.y)
  );
}
```

This maintains your core rule:

> The backend determines what exists; Three.js determines how it appears.

### When to use Blender and glTF/GLB

After the core gameplay loop is working, use **Blender → `.glb`** for the assets players see repeatedly and care about:

- Unit archetypes
- City building kits
- Wonders
- Trees and forests
- Resource deposits
- Ships
- Important landmarks

Use glTF/GLB because it is the standard Three.js-friendly delivery format. Three.js loads it using `GLTFLoader`.

Use **one small model per unit type**, then tint or decorate it based on ownership. Avoid exporting a separate asset file for every civilization/unit-color combination.

Example loading pattern:

```js
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

loader.load("/assets/models/warrior.glb", (gltf) => {
  const warriorTemplate = gltf.scene;

  const playerWarrior = warriorTemplate.clone(true);
  playerWarrior.position.set(3, 0, 6);

  scene.add(playerWarrior);
});
```

For ownership coloration, the cleanest approach is usually:

- Keep unit body mostly neutral.
- Add a separately colored flag/banner, shield face, base ring, or sash.
- Change only that material per civilization.

This preserves good-looking models and gives clear faction readability.

### Performance guidance for your game

For a 64×64 map, a simple approach is fine initially, but establish these rules early:

| Object type | Best rendering approach |
|---|---|
| Terrain tiles | `THREE.InstancedMesh` |
| Trees / forests | `THREE.InstancedMesh` or merged static geometry |
| Mountains / rocks | Instancing |
| Resource markers | Instancing |
| Units | Separate `THREE.Group` per active unit |
| Cities | Separate group per city |
| Unit flags | Part of unit group |
| Selection rings | Reusable meshes or instancing |
| Fog tiles | Instanced overlay / shader approach later |

Do **not** create 4,096 separate mesh objects for terrain tiles if you can avoid it. Terrain should be batched.

Separate meshes for perhaps 10–100 units and 2–30 cities are completely reasonable.

### Recommended asset roadmap

#### Phase 1 — Gameplay placeholder art

Keep your current primitives, but make them legible:

- Cone = military unit
- Wagon-like group = settler
- Cube cluster = city
- Tall colored banner = ownership
- Colored base ring = selected / owner
- Simple icon / label above the unit if necessary

#### Phase 2 — Procedural low-poly kit

Replace generic primitive forms with `THREE.Group` assets:

- Four land unit silhouettes
- One ship silhouette
- Settlement levels 1–4
- Basic walls
- Forest/tree props
- Resource prop markers

This is likely enough for a compelling local prototype.

#### Phase 3 — Hand-authored `.glb` models

Create or commission original low-poly models for:

- Ancient era unit set
- Medieval era unit set
- Industrial era unit set
- City kits by era
- Wonders / monuments
- Terrain feature sets

#### Phase 4 — Animation and polish

Only after gameplay is solid:

- Idle flag sway
- Unit walk/bob movement
- City smoke/firelight
- Combat lunge and hit effect
- Research completion effect
- Found-city construction animation

### Best immediate next step

Keep the cones and blocks, but wrap them in an `AssetFactory` now. Then replace each factory implementation incrementally.

Start with these four views:

1. `createSettlerMesh(ownerColor)`
2. `createWarriorMesh(ownerColor)`
3. `createCityMesh(city)`
4. `createSelectionRing()`

That delivers a much more game-like map quickly without delaying the actual Civilization-style mechanics.

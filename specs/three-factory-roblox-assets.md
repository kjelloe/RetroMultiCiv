# RetroMultiCiv — Roblox Asset Pipeline
## Extending the Three.js Asset Factory to produce Roblox-ready meshes

*For the local coding ally · 2026-07-16*

---

## What this document covers

The browser game's asset factory (`client/AssetFactory.js`) already produces
every visual in the gallery: 14 civilizations, all unit types (land, naval,
air), five city growth tiers, terrain props, faction discs, flags, veteran
stars, and fortify rings. This document describes how to extend that same
factory to export Roblox-ready mesh files — so the Roblox client can use
`MeshPart` assets that look identical to the browser version, rather than
rebuilding everything from scratch in Studio.

The approach has three parts:

1. **Add a headless export mode to the asset factory** — run it in Node.js
   without a browser, produce one glTF file per asset.
2. **Batch-convert glTF → FBX** using a small Blender Python script — fully
   automated, no manual Blender work.
3. **Import into Roblox Studio** and wire up a Luau `AssetFactory` that
   references the uploaded `MeshPart` IDs by name.

Faction coloring, base discs, flags, and markers stay as procedural Luau
Parts on top of the imported mesh — exactly as they do in Three.js — so
re-exporting is never needed just because a civilization's color changes.

---

## Current asset inventory (from the gallery)

Before writing any code, here is what the factory currently produces and
what needs to be exported.

### Land units
`settler`, `warrior`, `archer`, `legion`, `cavalry`, `catapult`, `chariot`,
`cannon`, `rifleman`, `cavalry_modern`, `tank`, `artillery`

### Naval units
`trireme`, `galleon`, `frigate`, `ironclad`, `destroyer`, `battleship`,
`submarine`, `transport`, `carrier`

### Air units
`fighter`, `bomber`

### City tiers (by population threshold)
`city_1`, `city_5`, `city_8`, `city_16`, `city_28`

### Terrain props
`tree_cluster`, `mountain`, `mine_entrance`, `irrigation_field`,
`road_segment`, `railroad_segment`, `fortress`, `bridge`

### Markers (procedural — do NOT export as mesh)
Base discs, faction flags, veteran stars, fortify rings, selection rings,
GoTo route arrows — these are always built from Luau Parts at runtime.

---

## Part 1 — Headless export mode in the asset factory

### 1.1 The problem: Three.js needs a DOM

`AssetFactory.js` currently runs in a browser. `THREE.WebGLRenderer` and
`THREE.GLTFExporter` both work in Node.js, but they need a canvas shim.
The cleanest solution is to keep the factory code unchanged and add a thin
headless wrapper that provides the shim.

Install the required packages once:

```bash
npm install --save-dev three canvas gl
```

- `three` — already in your project
- `canvas` — provides `HTMLCanvasElement` in Node.js
- `gl` — provides a headless WebGL context

### 1.2 Create the headless wrapper

Create `tools/headless-three.js`. This file patches the global environment
so Three.js and GLTFExporter believe they are running in a browser.

```javascript
// tools/headless-three.js
// Run BEFORE importing anything from Three.js in a Node.js script.

import { createCanvas } from 'canvas';
import gl from 'gl';

// Patch global so Three.js finds a canvas constructor
global.document = {
  createElement(tag) {
    if (tag === 'canvas') return createCanvas(1, 1);
    throw new Error('headless-three: unsupported createElement: ' + tag);
  },
  createElementNS(_ns, tag) {
    return this.createElement(tag);
  }
};

global.window = global;
global.HTMLCanvasElement = createCanvas(1, 1).constructor;

// Patch canvas to return a headless WebGL context
const _getContext = global.HTMLCanvasElement.prototype.getContext;
global.HTMLCanvasElement.prototype.getContext = function(type, attrs) {
  if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') {
    return gl(this.width || 1, this.height || 1, { preserveDrawingBuffer: true });
  }
  return _getContext ? _getContext.call(this, type, attrs) : null;
};
```

### 1.3 Create the export script

Create `tools/export-roblox-assets.js`. This script imports the real
`AssetFactory`, calls every builder function, and writes one glTF file per
asset into `roblox-assets/`.

```javascript
// tools/export-roblox-assets.js
// Usage: node --experimental-vm-modules tools/export-roblox-assets.js

import './headless-three.js';           // must be first
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { AssetFactory } from '../client/AssetFactory.js';
import fs from 'fs';
import path from 'path';

// ── Asset manifest ────────────────────────────────────────────────────────────
// Each entry: { category, name, builder }
// builder() must return a THREE.Object3D (Group or Mesh).
// Use 'neutral' as the owner color — Roblox will tint at runtime.

const NEUTRAL_COLOR = new THREE.Color(0x888888);

const ASSETS = [

  // Land units
  ...['settler','warrior','archer','legion','cavalry','catapult','chariot',
      'cannon','rifleman','cavalry_modern','tank','artillery'].map(name => ({
    category: 'units',
    name,
    builder: () => AssetFactory.createUnit(name, NEUTRAL_COLOR)
  })),

  // Naval units
  ...['trireme','galleon','frigate','ironclad','destroyer',
      'battleship','submarine','transport','carrier'].map(name => ({
    category: 'units',
    name,
    builder: () => AssetFactory.createUnit(name, NEUTRAL_COLOR)
  })),

  // Air units
  ...['fighter','bomber'].map(name => ({
    category: 'units',
    name,
    builder: () => AssetFactory.createUnit(name, NEUTRAL_COLOR)
  })),

  // City tiers
  ...[1, 5, 8, 16, 28].map(pop => ({
    category: 'cities',
    name: `city_${pop}`,
    builder: () => AssetFactory.createCity(pop, false, NEUTRAL_COLOR)
  })),

  // City tiers — walled variants
  ...[5, 8, 16, 28].map(pop => ({
    category: 'cities',
    name: `city_${pop}_walled`,
    builder: () => AssetFactory.createCity(pop, true, NEUTRAL_COLOR)
  })),

  // Terrain props
  { category: 'props', name: 'tree_cluster',
    builder: () => AssetFactory.createProp('tree_cluster') },
  { category: 'props', name: 'mountain',
    builder: () => AssetFactory.createProp('mountain') },
  { category: 'props', name: 'mine_entrance',
    builder: () => AssetFactory.createProp('mine_entrance') },
  { category: 'props', name: 'irrigation_field',
    builder: () => AssetFactory.createProp('irrigation_field') },
  { category: 'props', name: 'fortress',
    builder: () => AssetFactory.createProp('fortress') },
  { category: 'props', name: 'bridge',
    builder: () => AssetFactory.createProp('bridge') },
];

// ── Export loop ───────────────────────────────────────────────────────────────

const exporter = new GLTFExporter();

function exportToGLTF(object) {
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (gltf) => resolve(gltf),
      (err)  => reject(err),
      { binary: false, embedImages: false }
    );
  });
}

async function run() {
  let exported = 0;
  let failed   = 0;

  for (const asset of ASSETS) {
    const dir = path.join('roblox-assets', asset.category);
    fs.mkdirSync(dir, { recursive: true });

    const outPath = path.join(dir, asset.name + '.gltf');

    try {
      const object = asset.builder();
      const gltf   = await exportToGLTF(object);
      fs.writeFileSync(outPath, JSON.stringify(gltf, null, 2));
      console.log(`  ✓  ${asset.category}/${asset.name}`);
      exported++;
    } catch (err) {
      console.error(`  ✗  ${asset.category}/${asset.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${exported} exported, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

run();
```

### 1.4 Add an npm script

In `package.json`:

```json
{
  "scripts": {
    "export:roblox": "node --experimental-vm-modules tools/export-roblox-assets.js"
  }
}
```

Run it:

```bash
npm run export:roblox
```

Expected output:

```
  ✓  units/settler
  ✓  units/warrior
  ✓  units/archer
  ...
  ✓  cities/city_1
  ✓  cities/city_5_walled
  ...
  ✓  props/tree_cluster

Done: 42 exported, 0 failed.
```

The `roblox-assets/` folder now contains one `.gltf` per asset, all using
the same geometry as the browser game.

---

## Part 2 — Batch convert glTF → FBX with Blender

Roblox Studio's importer accepts `.obj` and `.fbx`. FBX preserves normals
and material names better than OBJ for low-poly faceted meshes. The
conversion is fully scriptable via Blender's Python API — no manual work.

### 2.1 Prerequisites

- Blender 3.6 or later installed (free, [blender.org](https://www.blender.org))
- Blender accessible on your PATH, or use the full path in the script

Verify:

```bash
blender --version
```

### 2.2 Create the Blender batch script

Create `tools/gltf_to_fbx.py`:

```python
# tools/gltf_to_fbx.py
# Run via: blender --background --python tools/gltf_to_fbx.py
#
# Converts every .gltf in roblox-assets/ to .fbx in roblox-assets-fbx/
# preserving the same category/name folder structure.

import bpy
import os
import sys

INPUT_ROOT  = os.path.abspath('roblox-assets')
OUTPUT_ROOT = os.path.abspath('roblox-assets-fbx')

def convert(gltf_path, fbx_path):
    # Clear the scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import glTF
    bpy.ops.import_scene.gltf(filepath=gltf_path)

    # Select all imported objects
    bpy.ops.object.select_all(action='SELECT')

    # Export FBX — settings tuned for Roblox import
    bpy.ops.export_scene.fbx(
        filepath        = fbx_path,
        use_selection   = True,
        global_scale    = 1.0,
        apply_unit_scale= True,
        apply_scale_options = 'FBX_SCALE_NONE',
        axis_forward    = '-Z',
        axis_up         = 'Y',
        mesh_smooth_type= 'FACE',   # preserve flat shading
        use_mesh_modifiers = True,
        add_leaf_bones  = False,
        bake_anim       = False,
    )

converted = 0
failed    = 0

for root, dirs, files in os.walk(INPUT_ROOT):
    for filename in files:
        if not filename.endswith('.gltf'):
            continue

        gltf_path = os.path.join(root, filename)
        rel_path  = os.path.relpath(gltf_path, INPUT_ROOT)
        fbx_path  = os.path.join(OUTPUT_ROOT, rel_path.replace('.gltf', '.fbx'))

        os.makedirs(os.path.dirname(fbx_path), exist_ok=True)

        try:
            convert(gltf_path, fbx_path)
            print(f'  ✓  {rel_path}')
            converted += 1
        except Exception as e:
            print(f'  ✗  {rel_path}: {e}', file=sys.stderr)
            failed += 1

print(f'\nDone: {converted} converted, {failed} failed.')
sys.exit(1 if failed > 0 else 0)
```

### 2.3 Add an npm script for the conversion

```json
{
  "scripts": {
    "export:roblox":  "node --experimental-vm-modules tools/export-roblox-assets.js",
    "convert:roblox": "blender --background --python tools/gltf_to_fbx.py",
    "build:roblox":   "npm run export:roblox && npm run convert:roblox"
  }
}
```

Run the full pipeline:

```bash
npm run build:roblox
```

Output: `roblox-assets-fbx/` with the same folder structure, ready for
Studio import.

---

## Part 3 — Import into Roblox Studio

### 3.1 Bulk import

1. Open Roblox Studio.
2. In the **Explorer**, create a folder: `ReplicatedStorage > Assets > Units`
   (and `Cities`, `Props`).
3. Select the folder, then drag all `.fbx` files from `roblox-assets-fbx/units/`
   onto it — Studio imports them as `MeshPart` objects automatically.
4. Repeat for `cities/` and `props/`.
5. For each imported `MeshPart`, note its **asset ID** from the Properties
   panel (`MeshId` field, format `rbxassetid://XXXXXXXXXX`).

### 3.2 Build the Roblox asset ID table

Create `src/roblox/AssetIds.lua`. Fill in the IDs after import:

```lua
-- src/roblox/AssetIds.lua
-- Generated after Studio import. Update IDs whenever meshes are re-exported.
-- Last export: 2026-07-16

return {

  units = {
    settler        = "rbxassetid://0000000001",
    warrior        = "rbxassetid://0000000002",
    archer         = "rbxassetid://0000000003",
    legion         = "rbxassetid://0000000004",
    cavalry        = "rbxassetid://0000000005",
    catapult       = "rbxassetid://0000000006",
    chariot        = "rbxassetid://0000000007",
    cannon         = "rbxassetid://0000000008",
    rifleman       = "rbxassetid://0000000009",
    cavalry_modern = "rbxassetid://0000000010",
    tank           = "rbxassetid://0000000011",
    artillery      = "rbxassetid://0000000012",
    trireme        = "rbxassetid://0000000013",
    galleon        = "rbxassetid://0000000014",
    frigate        = "rbxassetid://0000000015",
    ironclad       = "rbxassetid://0000000016",
    destroyer      = "rbxassetid://0000000017",
    battleship     = "rbxassetid://0000000018",
    submarine      = "rbxassetid://0000000019",
    transport      = "rbxassetid://0000000020",
    carrier        = "rbxassetid://0000000021",
    fighter        = "rbxassetid://0000000022",
    bomber         = "rbxassetid://0000000023",
  },

  cities = {
    city_1        = "rbxassetid://0000000030",
    city_5        = "rbxassetid://0000000031",
    city_5_walled = "rbxassetid://0000000032",
    city_8        = "rbxassetid://0000000033",
    city_8_walled = "rbxassetid://0000000034",
    city_16       = "rbxassetid://0000000035",
    city_16_walled= "rbxassetid://0000000036",
    city_28       = "rbxassetid://0000000037",
    city_28_walled= "rbxassetid://0000000038",
  },

  props = {
    tree_cluster    = "rbxassetid://0000000040",
    mountain        = "rbxassetid://0000000041",
    mine_entrance   = "rbxassetid://0000000042",
    irrigation_field= "rbxassetid://0000000043",
    fortress        = "rbxassetid://0000000044",
    bridge          = "rbxassetid://0000000045",
  },

}
```

---

## Part 4 — Luau AssetFactory

Create `src/roblox/AssetFactory.lua`. This mirrors the structure of the
JavaScript `AssetFactory` — same function names, same separation between
mesh geometry (imported) and faction identity (procedural Parts).

```lua
-- src/roblox/AssetFactory.lua
-- Mirrors client/AssetFactory.js.
-- Mesh geometry comes from imported MeshParts (AssetIds.lua).
-- Faction identity (disc, flag, markers) is built procedurally.

local AssetIds    = require(script.Parent.AssetIds)
local CivColors   = require(script.Parent.CivColors)   -- your existing table
local CivEmblems  = require(script.Parent.CivEmblems)  -- your existing table

local AssetFactory = {}

-- ── Internal helpers ──────────────────────────────────────────────────────────

local function newMeshPart(meshId, size, color, name)
  local part      = Instance.new("MeshPart")
  part.Name       = name or "Mesh"
  part.MeshId     = meshId
  part.Size       = size
  part.Color      = color
  part.Material   = Enum.Material.SmoothPlastic
  part.CastShadow = true
  part.Anchored   = true
  return part
end

-- Base disc — colored ring under every unit and city, same as browser
local function makeBasedisc(ownerCivKey, radius, thickness)
  local disc        = Instance.new("Part")
  disc.Name         = "BaseDisc"
  disc.Shape        = Enum.PartType.Cylinder
  disc.Size         = Vector3.new(thickness or 0.08, radius * 2, radius * 2)
  disc.Color        = CivColors[ownerCivKey] or Color3.fromRGB(136, 136, 136)
  disc.Material     = Enum.Material.SmoothPlastic
  disc.CastShadow   = false
  disc.Anchored     = true
  return disc
end

-- Faction flag — small billboard above units, same emblem system as browser
local function makeFlag(ownerCivKey, heightOffset)
  local flagPole    = Instance.new("Part")
  flagPole.Name     = "FlagPole"
  flagPole.Size     = Vector3.new(0.04, heightOffset or 0.6, 0.04)
  flagPole.Color    = Color3.fromRGB(200, 200, 200)
  flagPole.Material = Enum.Material.SmoothPlastic
  flagPole.Anchored = true

  local gui         = Instance.new("BillboardGui")
  gui.Name          = "FlagGui"
  gui.Size          = UDim2.new(0, 24, 0, 24)
  gui.StudsOffset   = Vector3.new(0, heightOffset or 0.6, 0)
  gui.AlwaysOnTop   = false

  local label       = Instance.new("TextLabel")
  label.Size        = UDim2.new(1, 0, 1, 0)
  label.Text        = CivEmblems[ownerCivKey] or "?"
  label.TextScaled  = true
  label.BackgroundColor3 = CivColors[ownerCivKey] or Color3.fromRGB(136,136,136)
  label.TextColor3  = Color3.fromRGB(255, 255, 255)
  label.Parent      = gui

  gui.Parent        = flagPole
  return flagPole
end

-- Veteran star marker
local function makeVeteranStar()
  local gui   = Instance.new("BillboardGui")
  gui.Name    = "VeteranStar"
  gui.Size    = UDim2.new(0, 16, 0, 16)
  gui.StudsOffset = Vector3.new(0.3, 0.5, 0)
  local label = Instance.new("TextLabel")
  label.Size  = UDim2.new(1, 0, 1, 0)
  label.Text  = "★"
  label.TextScaled = true
  label.BackgroundTransparency = 1
  label.TextColor3 = Color3.fromRGB(255, 220, 0)
  label.Parent = gui
  return gui
end

-- Fortify ring — sunken ring around a fortified unit
local function makeFortifyRing(radius)
  local ring      = Instance.new("Part")
  ring.Name       = "FortifyRing"
  ring.Shape      = Enum.PartType.Cylinder
  ring.Size       = Vector3.new(0.05, radius * 2, radius * 2)
  ring.Color      = Color3.fromRGB(80, 140, 80)
  ring.Material   = Enum.Material.Neon
  ring.Transparency = 0.4
  ring.CastShadow = false
  ring.Anchored   = true
  return ring
end

-- Weld all children to a root part so the model moves as one
local function weldToRoot(root, model)
  for _, child in ipairs(model:GetDescendants()) do
    if child:IsA("BasePart") and child ~= root then
      local weld          = Instance.new("WeldConstraint")
      weld.Part0          = root
      weld.Part1          = child
      weld.Parent         = root
    end
  end
end

-- ── Public API ────────────────────────────────────────────────────────────────

--[[
  AssetFactory.createUnit(unitType, ownerCivKey, options)

  unitType    : string  — matches a key in AssetIds.units
  ownerCivKey : string  — e.g. "Romans", "Aztecs"
  options     : table   — { veteran=bool, fortified=bool, position=Vector3 }

  Returns a Model containing:
    - MeshPart  (the imported Three.js geometry, tinted to civ color)
    - BaseDisc  (colored cylinder)
    - FlagPole  (with BillboardGui emblem)
    - VeteranStar (if veteran)
    - FortifyRing (if fortified)
]]
function AssetFactory.createUnit(unitType, ownerCivKey, options)
  options = options or {}

  local meshId = AssetIds.units[unitType]
  if not meshId then
    warn("AssetFactory.createUnit: unknown unit type: " .. tostring(unitType))
    meshId = AssetIds.units.warrior   -- fallback
  end

  local civColor = CivColors[ownerCivKey] or Color3.fromRGB(136, 136, 136)

  local model   = Instance.new("Model")
  model.Name    = unitType .. "_" .. ownerCivKey

  -- Main mesh
  local mesh    = newMeshPart(meshId, Vector3.new(1, 1, 1), civColor, "Body")
  mesh.Parent   = model
  model.PrimaryPart = mesh

  -- Base disc
  local disc    = makeBasedisc(ownerCivKey, 0.55, 0.08)
  disc.CFrame   = mesh.CFrame * CFrame.new(0, -0.5, 0)
  disc.Parent   = model

  -- Flag
  local flag    = makeFlag(ownerCivKey, 0.7)
  flag.CFrame   = mesh.CFrame * CFrame.new(0, 0.5, 0)
  flag.Parent   = model

  -- Optional markers
  if options.veteran then
    local star  = makeVeteranStar()
    star.Parent = mesh
  end

  if options.fortified then
    local ring  = makeFortifyRing(0.6)
    ring.CFrame = mesh.CFrame * CFrame.new(0, -0.48, 0)
    ring.Parent = model
  end

  -- Position
  if options.position then
    model:SetPrimaryPartCFrame(CFrame.new(options.position))
  end

  weldToRoot(mesh, model)
  return model
end

--[[
  AssetFactory.createCity(population, hasWalls, ownerCivKey, options)

  population  : number  — used to pick the correct city tier mesh
  hasWalls    : bool
  ownerCivKey : string
  options     : table   — { position=Vector3 }

  Returns a Model containing the city MeshPart + disc + flag.
]]
function AssetFactory.createCity(population, hasWalls, ownerCivKey, options)
  options = options or {}

  -- Pick the right tier
  local tier
  if     population >= 28 then tier = 28
  elseif population >= 16 then tier = 16
  elseif population >= 8  then tier = 8
  elseif population >= 5  then tier = 5
  else                          tier = 1
  end

  local key = "city_" .. tier .. (hasWalls and "_walled" or "")
  local meshId = AssetIds.cities[key] or AssetIds.cities["city_1"]

  local civColor = CivColors[ownerCivKey] or Color3.fromRGB(136, 136, 136)

  local model   = Instance.new("Model")
  model.Name    = "city_" .. ownerCivKey .. "_pop" .. population

  local mesh    = newMeshPart(meshId, Vector3.new(2, 1.5, 2), civColor, "CityBody")
  mesh.Parent   = model
  model.PrimaryPart = mesh

  local disc    = makeBasedisc(ownerCivKey, 1.1, 0.08)
  disc.CFrame   = mesh.CFrame * CFrame.new(0, -0.75, 0)
  disc.Parent   = model

  local flag    = makeFlag(ownerCivKey, 1.4)
  flag.CFrame   = mesh.CFrame * CFrame.new(0, 0.75, 0)
  flag.Parent   = model

  if options.position then
    model:SetPrimaryPartCFrame(CFrame.new(options.position))
  end

  weldToRoot(mesh, model)
  return model
end

--[[
  AssetFactory.createProp(propType, options)

  propType : string  — matches a key in AssetIds.props
  options  : table   — { position=Vector3, color=Color3 }

  Returns a single MeshPart (props have no faction identity).
]]
function AssetFactory.createProp(propType, options)
  options = options or {}

  local meshId = AssetIds.props[propType]
  if not meshId then
    warn("AssetFactory.createProp: unknown prop type: " .. tostring(propType))
    return nil
  end

  local color = options.color or Color3.fromRGB(160, 140, 120)
  local part  = newMeshPart(meshId, Vector3.new(1, 1, 1), color, propType)

  if options.position then
    part.CFrame = CFrame.new(options.position)
  end

  return part
end

return AssetFactory
```

---

## Part 5 — Keeping the two factories in sync

### The sync rule

> **The JavaScript `AssetFactory` is the source of truth for geometry.**
> The Luau `AssetFactory` is the source of truth for Roblox placement and identity.**
> They share the same function names and the same asset manifest.**

When you add a new unit type to the browser game:

1. Add the builder to `AssetFactory.js` (already your normal workflow).
2. Add the name to the `ASSETS` array in `tools/export-roblox-assets.js`.
3. Run `npm run build:roblox`.
4. Import the new `.fbx` into Studio, note the asset ID.
5. Add the ID to `AssetIds.lua`.
6. Add the same key to `AssetFactory.lua`'s unit list.

Steps 2–3 are the only new work. Steps 4–6 are a few minutes in Studio.

### Detecting drift

Add a test to your existing suite that compares the unit/city/prop keys
declared in `AssetIds.lua` against the keys in `ASSETS` in the export
script. If they differ, the test fails loudly.

A simple Node.js check:

```javascript
// tools/check-asset-sync.js
// Run as part of CI: node tools/check-asset-sync.js

import { ASSETS } from './export-roblox-assets.js';
import fs from 'fs';

const luaSource = fs.readFileSync('src/roblox/AssetIds.lua', 'utf8');

let allGood = true;

for (const asset of ASSETS) {
  if (!luaSource.includes(`${asset.name}`)) {
    console.error(`MISSING in AssetIds.lua: ${asset.category}/${asset.name}`);
    allGood = false;
  }
}

if (allGood) {
  console.log('Asset sync check: OK');
} else {
  process.exit(1);
}
```

Add to `package.json`:

```json
{
  "scripts": {
    "check:sync": "node tools/check-asset-sync.js"
  }
}
```

---

## Part 6 — Polygon budget and mesh guidelines

Roblox's mesh importer has a hard limit of **10,000 triangles per MeshPart**.
Your low-poly procedural style is well within this — typical counts:

| Asset | Approximate triangle count |
|---|---|
| Warrior / settler | 80–200 |
| Ship (trireme) | 150–300 |
| Tank | 200–400 |
| City tier 1 | 100–200 |
| City tier 28 | 400–800 |
| Tree cluster | 60–120 |
| Mountain prop | 40–80 |

**Do not export the terrain surface as a single mesh.** The continuous
low-poly terrain is too large. In Roblox, terrain is handled separately —
either via `Terrain:FillBlock()` per tile or via chunked `MeshPart` tiles
(one mesh per terrain type, instanced per tile). The tile-mesh approach
mirrors the browser's `THREE.InstancedMesh` pattern.

For terrain tiles, export one mesh per terrain type at unit tile size:

```javascript
// In export-roblox-assets.js, add:
...['grassland','desert','tundra','ocean','forest','hills','mountain_tile',
    'arctic'].map(name => ({
  category: 'terrain',
  name,
  builder: () => AssetFactory.createTerrainTile(name)
})),
```

---

## Part 7 — What stays procedural in Roblox (never exported)

These are always built from Luau Parts at runtime, exactly as they are built
from Three.js primitives in the browser. They do not need to be exported.

| Element | Roblox implementation |
|---|---|
| Base disc | `Part` with `PartType.Cylinder` |
| Faction flag | `Part` + `BillboardGui` with emblem text |
| Veteran star | `BillboardGui` with ★ `TextLabel` |
| Fortify ring | `Part` with `Material.Neon` |
| Selection ring | `Part` with `Material.Neon`, shown/hidden by client |
| GoTo route arrow | `Part` or `Beam` between waypoints |
| City population number | `BillboardGui` |
| Smoke effect (large cities) | `ParticleEmitter` |
| Battle flash | `PointLight` + brief `ParticleEmitter` |
| Overlay tints (territory/forces) | `SelectionBox` or `SurfaceGui` per tile |

This keeps the export pipeline small and fast — only geometry changes
require a re-export. All faction identity, status, and UI elements update
instantly in Luau without touching the mesh files.

---

## Quick reference — full pipeline

```
1.  Edit AssetFactory.js          (normal browser dev workflow)
         ↓
2.  npm run export:roblox         (Node.js → roblox-assets/*.gltf)
         ↓
3.  npm run convert:roblox        (Blender Python → roblox-assets-fbx/*.fbx)
         ↓
4.  Drag *.fbx into Roblox Studio (Studio → MeshPart, note asset IDs)
         ↓
5.  Update AssetIds.lua           (paste the rbxassetid:// values)
         ↓
6.  npm run check:sync            (CI confirms Lua and JS manifests match)
         ↓
7.  Luau AssetFactory.createUnit / createCity / createProp
    uses the MeshPart IDs + procedural disc/flag/markers
```

Steps 1 and 4–5 are the only manual steps. Steps 2, 3, and 6 are one
command each and can be added to CI.

---

## Appendix — Folder structure after setup

```
RetroMultiCiv/
├── client/
│   └── AssetFactory.js          ← source of truth for geometry
├── src/
│   └── roblox/
│       ├── AssetFactory.lua     ← mirrors JS factory, uses MeshPart IDs
│       ├── AssetIds.lua         ← rbxassetid:// table, updated after import
│       ├── CivColors.lua        ← existing
│       └── CivEmblems.lua       ← existing
├── tools/
│   ├── headless-three.js        ← Node.js DOM/WebGL shim
│   ├── export-roblox-assets.js  ← glTF export script
│   ├── gltf_to_fbx.py           ← Blender batch converter
│   └── check-asset-sync.js      ← CI drift detector
├── roblox-assets/               ← generated, gitignore or commit as needed
│   ├── units/*.gltf
│   ├── cities/*.gltf
│   ├── props/*.gltf
│   └── terrain/*.gltf
└── roblox-assets-fbx/           ← generated, gitignore recommended
    ├── units/*.fbx
    ├── cities/*.fbx
    ├── props/*.fbx
    └── terrain/*.fbx
```

Commit `roblox-assets/*.gltf` if you want the export to be reproducible
from the repo without running the Node.js step. Gitignore
`roblox-assets-fbx/` — it is always regenerated from the glTF files.

---

*End of document.*

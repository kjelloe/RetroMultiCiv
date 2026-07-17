# render-spec.json — the machine-readable render spec

`render-spec.json` is a **generated export** of the renderer's declarative
tables, for validating the rendering design in external tooling without
reading our code. The code is the single source of truth:

```
node tools/render-spec.js     # regenerates specs/render-spec.json
```

A suite drift guard (`test/render-spec.test.js`) regenerates and compares on
every run — the committed file cannot silently lag the code.

## Pointer map (section → living code)

| section | source |
|---|---|
| `terrain.tiles` (heights, jitter, palettes) | `client/renderer/three/terrain.js` `TERRAIN` |
| `terrain.waterLevel` | `client/renderer/three/props.js` `WATER_LEVEL` |
| `factions` (visuals, emblem list, light-color rim rule) | `data/civs.json` + `client/renderer/three/factions.js` |
| `models.geometries` / `neutralColors` / `unitSilhouette` / `cityTiers` | `client/renderer/three/assets.js` |
| `models.builders` (procedural silhouettes, described not faked) | `client/renderer/three/assets.js` builder functions |
| `props.colors` | `client/renderer/three/props.js` `PROP_COLOR` |
| `anim` (sway/glide/smoke/flash constants) | `client/renderer/three/anim.js` |

Anything marked `"procedural": true` is a loop/conditional recipe that
resists flat declarative capture — the description says what it builds, the
source says how. Colors are `#rrggbb` strings; dimensions are three.js
constructor arguments in world units (one tile = 1.0).

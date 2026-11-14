# Roblox-native look — UI dress, menu icons, sculpted terrain

Status: user direction 2026-11-14 (four rulings below). Owner: roblox-helper
lane (`roblox/` only). Presentation layer throughout — no engine, state,
command, or shared-recipe change; gamesim-golden-neutral.

## 1. Problem (user, 2026-11-14)

1. The menu buttons read like accounting software, not a Roblox game.
2. Only the tech tree has an icon (a tree emoji); every other menu is a text
   label.
3. The browser map got a complete graphics pass (graphics-levels v2); the
   Roblox map did not. Mountains in particular: one flat-topped block with a
   small cone on it.

## 2. Rulings (user, 2026-11-14)

| question | ruling |
|---|---|
| UI style | chunky game-style: thick rounded buttons, rounded display font, dark outline, gradient, icon + short label, press/hover feedback |
| icons | drawn in code (the EditableImage glyph renderer) — no uploads |
| terrain | sculpted parts per tile; tile blocks stay (no EditableMesh, no voxel Terrain) |
| order | UI buttons first, terrain second |

## 3. Analysis — what was there

- **Buttons**: ~40 `TextButton`s, each styled inline in its own script
  (`SourceSansBold`, flat dark `BackgroundColor3`, an 8 px `UICorner`). No
  shared style module; 13 scripts already use `UIStroke`/`UIGradient`
  one-off. Top row is absolutely positioned per script (Options −158,
  Encyclopedia −284, Ship −370, Strategic −458, TechTree −546).
- **Icons**: `EditableGlyph.luau` already rasterises a primitive vocabulary
  (disc/ring/arc/ell/bar/poly/dots) for the 68 tech glyphs, with a fallback
  when `EditableImage` is unavailable. Menu icons are the same problem with
  different data.
- **Terrain**: `ViewRenderer.renderTerrain` = one `Part` per tile, height
  from `TerrainPalette` (generated, gate-4 locked), per-look material.
  `TileProps.luau` (the `props.js` twin) adds a 5-wedge cone + snow cone on
  mountains and 1–2 rocks on hills. Seven other modules read a tile's top
  from the live Part, so block height is safe to change in one place.
- **Browser reference**: Low = faceted SEGS 2 with the same cone props
  (Roblox's current baseline); Medium = faceted SEGS 8 mesh that owns real
  summits, snow by vertex lerp, resource on a flank (H13c); High = smooth.

## 4. Design

### U — UI dress

- `UiTheme.luau`: `apply(button, opts)` decorates an EXISTING button — it
  never moves or resizes it, so each panel keeps its layout and its own
  enable/disable recolouring (the gradient multiplies whatever colour is
  set). 12 px corners, 2.5 px dark outline, top-lit gradient, FredokaOne
  with a 1.5 px text outline, outline flash on hover, gradient slide on
  press. Role palette: `menu` blue, `go` green, `science` amber, `space`
  purple, `danger` red, `neutral` slate. `apply` is pcall-wrapped: a dress
  failure warns once and leaves the button as built.
- `MenuIcons.luau`: pure data, 12 pictograms in the 0..100 box.
  `EditableGlyph.renderPrims` draws them white on transparent. With an icon
  the label shrinks-to-fit beside it (`TextScaled` + a max-size cap);
  `iconOnly` buttons drop their text. No `EditableImage` → the original
  text (or emoji) stays.

Phases: **U1** (built) top-row menus, action bar, End Turn. **U2** panel
chrome — close buttons (`danger`), panel title bars, primary/secondary
buttons inside CityPanel / Research / Government / Lobby. **U3** layout:
replace the absolute top row with one `UIListLayout` bar so buttons can
grow to a touch-friendly 44 px and never collide; phone breakpoints.
**U4** remaining icons (turn log, statistics, diplomacy, overlays, legend,
city list) + icons on action-bar verbs.

### T — terrain

- **T1** (built, ENHANCED look only): `TerrainSculpt.luau`, a pure planner
  feeding TileProps' existing `put` pipeline with existing shapes (the
  shared key set is untouched). Mountain = three summits on a ring around
  the tile centre (one tall, two shoulders; the centre stays clear so a
  unit or city on the tile is not buried), snow caps fitted to each cone's
  apex and radius, two foot boulders; the block under it drops to 0.6 of
  its height so the mass is carried by the summits, not a tower. Hills =
  2–3 low rounded mounds. Mountain resources move to a flank. A view with
  more than 150 mountain tiles gets the lite massif (two summits, one
  cap). Retro and brick looks keep the classic cone.
- **T2** slope skirts: wedge parts along each edge where a tile block
  stands above its neighbour, so height steps read as slopes, not walls.
  Needs a wedge primitive in the terrain renderer (not a shared recipe).
- **T3** coast: sand strip + foam where land meets ocean (the High-tier
  "sand coasts"), river banks.
- **T4** forest/jungle canopy density + two-part trees (the docs/13
  bigger-lift item), ground-cover colour variation per tile.

## 5. Assessment

| risk | note |
|---|---|
| Not seen in Studio | U1 and T1 were built with Studio unattended. Syntax is lune-compiled and the pure halves are lune-pinned; layout, colour and proportion are unverified until a Studio look. Tuning knobs are constants at the top of `UiTheme` / `TerrainSculpt`. |
| Label fit | Icon + label inside the old fixed widths relies on shrink-to-fit; the narrow ones (Encyclopedia 118 px, Ship 78 px) will render small until U3 gives the row a layout. |
| EditableImage | Never yet confirmed in Studio (the pending one-motif check). Failure mode is benign: text-only buttons. Two things found while building: (a) every `Draw*` call in `EditableGlyph` lacked the required 5th `combineType` argument, so nothing had ever rendered through it — fixed (`COMBINE`), arity pinned by gate 35; (b) creating an EditableImage needs the experience's "Allow Mesh / Image APIs" security setting (owner ID-verified) — to confirm in Game Settings; with it off the buttons stay text-only and the tech glyphs stay era badges. |
| Part count | Full massif ≤ 32 parts per mountain tile (was 10). ~8 % mountains on 40×25 = ~80 tiles = ~2.6 k parts; on 80×50 the lite path caps it near 6 k. To measure on a huge map on a phone before T2 adds more. |
| Look parity | The browser Medium/High surfaces are meshes; this is a part-built reading of the same idea, not a twin. No gate compares them, by design. |

## 6. Tests

`roblox/check.sh` gate 35 (`selftest/menu-icons.luau`: known kinds, in-box
coordinates, every used icon id present) and gate 36
(`selftest/terrain-sculpt.luau`: deterministic, centre clear, snow apex =
cone apex, existing shapes only, part budgets). Studio look: buttons at
1080p and on a phone emulator; a mountain range with a unit and a city on
mountain tiles; look toggle retro ↔ enhanced ↔ brick repaints props.

## 7. Open questions for the user

1. Button colours: one colour per ROLE (built) or one colour per MENU?
2. Hotkey hints in labels ("Research (T)") — keep on desktop, hide on touch?
3. Should retro/brick looks also get the massif, or stay classic (built)?
4. Phone layout priority for U3: bottom bar only, or a collapsible side dock?

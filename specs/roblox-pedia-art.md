# Roblox client: encyclopedia pictures and the wonder scene

2026-11-18. Lane: roblox-helper (`roblox/` only). User request: a picture
for every encyclopedia entry, and a short near-full-screen 3D scene when
the player completes a wonder. Everything here is gamesim-golden-neutral
(render only; no engine, state or RNG use). Roblox-only: the browser
encyclopedia has no pictures, and its wonder card (info-18) shows a tech
glyph.

## 1. Analysis

### 1.1 Entries and the art that exists

| category | entries | art today | where it lives |
|---|---|---|---|
| Units | 29 | a 3D model each, shown only on the map | `AssetFactory` + `AssetRecipes` (29 silhouettes) |
| Advances | 68 | a drawn glyph each, shown small | `GlyphData` + `EditableGlyph` |
| Terrain | 11 | the map tile itself | `ViewRenderer`, `TileProps`, `TerrainSculpt` |
| Buildings | 21 | none | - |
| Wonders | 22 | none (the browser draws 6 as city landmarks at its high tier) | - |
| Governments | 6 | none | - |
| Concepts | 29 | none; some menu pictograms fit | `MenuIcons` |
| total | 186 | 108 reusable, 78 to draw | |

To draw: 22 wonders, 21 buildings, 6 governments, 29 concepts.

### 1.2 What the platform allows

- **Uploaded images** (painted or generated outside the code): each is an
  asset upload with moderation, an id pasted into a table, and a file that
  cannot be reviewed or changed from this lane. Not chosen as the base.
- **Drawn in code, 2D**: `EditableImage` through the existing primitive
  vocabulary (disc, ring, arc, bar, poly, dots). Already carries 68 tech
  glyphs and the menu icons. No upload. One colour of ink per layer today.
- **Built in code, 3D**: Parts from recipe data, the way units are built.
  A `ViewportFrame` shows such a model inside a panel; the same model can
  stand in the world. No upload.

### 1.3 The wonder event

- `wonderBuilt { cityId, wonder }` is world news: every seat receives it.
  The owner is the city's owner, which the view carries.
- The client already reacts to it in three places (turn log, sound cue,
  build queue). No server change is needed.
- Precedents for the scene: the discovery splash (queueing, off while the
  regent holds the seat or the tour runs), and the replay theater (takes
  the camera through `ClientState.theaterActive`).

### 1.4 Constraints

- Only the user drives Studio. Art that can only be judged in Studio makes
  every drawing a round trip.
- Standing ruling: a new look is chosen from three variants shot in the
  same frame (art-variants).
- Rules go in a pure module with a lune selftest and a `check.sh` gate;
  the client script only draws.
- Ellipsoid shapes on terrain were rejected twice. Wonder and building
  models use blocks, wedges, cylinders and cones; a ball only where the
  subject is one (a dome, a globe).

## 2. Design

### 2.1 One artwork, several uses

A wonder is modelled once as data and shown three ways: the encyclopedia
picture, the completion scene, and (later, optional) a landmark on the
city's tile. A building is modelled once and shown in the encyclopedia and
on its city panel row. Nothing is drawn twice.

### 2.2 Art kinds

| kind | used for | source |
|---|---|---|
| `model` | units, wonders, buildings | recipe data -> Parts -> `ViewportFrame`, slow turn, drag to rotate |
| `plate` | advances, governments, concepts | primitive data -> `EditableImage`, on an era- or category-coloured card |
| `diorama` | terrain | a 3 x 3 patch of the real tile builder in a `ViewportFrame`; the special resource on the centre tile when the entry has one |

`PediaArt.luau` (pure) maps every (category, id) to `{ kind, ref }`.
Gate: every entry of every category in `data/*.json` and `PediaConcepts`
resolves to art that exists - the terrain-coverage pattern, so a new
ruleset entry without a picture fails `check.sh`.

### 2.3 Model data

`StructureModels.luau` (pure data), one entry per wonder and building:

```
pyramids = {
  ground = "sand",                      -- the base disc under the model
  parts = {                             -- in build order, bottom up
    { s = "pyramid", at = {0, 0, 0}, size = {8, 5, 8}, role = "sandstone" },
    ...
  },
  camera = { yaw = 35, pitch = 18, fit = 1.15 },
}
```

- Shapes: box, wedge, cylinder, cone, pyramid, ball, arch (two posts and a
  lintel). The builder is an extension of `AssetFactory`'s composer, not a
  second one.
- Colours by role (sandstone, marble, bronze, brick, timber, glass, water,
  foliage, steel, concrete, gold, lamp). A role table gives colour and
  material; no hex in the model data.
- Budget pinned by the gate: at most 80 parts per model, all inside a
  12 x 12 x 12 box, known shapes and roles only, build order bottom-up.
- Modern wonders that are not buildings (Darwin's Voyage, Magellan's
  Expedition, Women's Suffrage, Cure for Cancer, the United Nations, the
  Manhattan and Apollo programs, SETI) get an emblematic scene: a ship, a
  rocket on its pad, a dish, a ballot hall.

### 2.4 Seeing the art without Studio

`roblox/tools/model-preview.js`: exports `StructureModels` through lune to
JSON, draws each model with the repo's vendored three.js (read only) in the
same shapes and role colours, and writes a contact sheet PNG through the
existing headless screenshot script. The lane reads the PNG, so a model is
checked and corrected before the user sees it. The three-variant sheet for
the style choice comes from the same tool. Studio remains the final look.

### 2.5 Encyclopedia layout

- The detail pane gets a picture box above the text: 240 px high on a
  desktop width, the full pane width; on a narrow screen 150 px.
- Name and a one-line caption under the picture (cost and requirement for
  things that are built; era for an advance).
- One picture exists at a time; it is destroyed when another entry is
  picked (EditableImage and ViewportFrame memory stays flat).
- Layout numbers come from a pure function with a selftest across the
  panel widths, as the other panels do.

### 2.6 The wonder scene

Shown when the player's own city completes a wonder.

| beat | seconds | what happens |
|---|---|---|
| open | 0.0 - 0.6 | letterbox bars close in, map sound dips, fanfare starts |
| build | 0.6 - 4.0 | the model assembles in build order: each part rises into place with a short overshoot, dust puffs at the base |
| reveal | 4.0 - 7.5 | slow quarter orbit, light warms, sparkles on the top part |
| card | 7.5 - | name, "completed in <city>, <year>", the effect line; buttons Encyclopedia / Go to city / Continue |

- **Stage in the world, not a ViewportFrame.** The model is built on a
  small set far from the map (as the deck and the gallery are) and the
  camera goes there. This gives real light, shadow and particles; a
  ViewportFrame gives none of the three. The camera is handed over the way
  the replay theater does it and returned to where it was.
- **Skip:** any key, click or tap jumps to the card; a second one closes.
- **Rules (pure, `WonderScene.luau`):**
  - own wonder -> scene; a rival's wonder -> the turn-log line and sound
    it has today, plus a small card with the picture (no camera move);
  - several wonders in one turn play in order;
  - never while the regent holds the seat, while the tour runs, during
    fast-forward or the replay theater, or after game over; the wonder is
    then only logged;
  - an Options switch "Wonder scenes" (on by default); off -> the card
    only. "Reduce animation" (opt-08, planned) implies off.
- **Multiplayer:** local to the player; the game is not paused and other
  seats see nothing of it. The scene starts with the player's own turn, so
  it delays only their own first command.
- The end card is the browser's wonder-complete splash (info-18) with a
  model instead of a glyph, so that parity row goes to yes.

### 2.7 Checks

- Gate A (`pedia-art`): coverage of 2.2, model budget of 2.3, plate
  primitives inside the box and of known kinds.
- Gate B (`wonder-scene`): the rules of 2.6 over crafted event batches
  (own / rival / several / regent / tour / switch off), beat timings sum,
  every wonder id has a model and a caption.
- Tour: a stop per category that opens one entry and reports the picture
  kind and its drawn size; an action stop that completes a wonder with a
  logged debug command and reports the scene's beats and the camera
  restored.
- `after-run.js`: scenes played, skipped, and any picture that fell back.

## 3. Plan

Each step ends with gates green and a local commit.

| step | content | new art | needs the user |
|---|---|---|---|
| P0 | model format, builder, preview tool; the Pyramids in three styles on one sheet | 1 x 3 | pick a style |
| P1 | picture box in the encyclopedia with what exists: units (model), advances (plate), terrain (diorama); coverage gate listing the 78 without art | 0 | look once |
| P2 | wonder models in the picked style, four batches with a contact sheet each; encyclopedia shows them | 22 | look at each sheet |
| P3 | wonder scene: stage, beats, skip, card, rival card, Options switch, tour stops, gate B; info-18 to yes | 0 | one tour run |
| P4 | building models; city panel rows show them | 21 | look at the sheet |
| P5 | government emblems and concept plates (existing menu pictograms reused where they fit) | 35 | look at the sheet |
| P6 | optional: the wonder as a landmark on its city tile | 0 | ruling |

After P5 the coverage gate allows no missing entry.

P0 to P3 deliver both requests for wonders (the Pyramids example and the
scene). P4 and P5 complete "an image for every entry".

Place in `specs/roblox-parity-plan.md`: a separate track, independent of
R1-R8 except that the P3 tour stops use R1's action-stop mechanism. With R1
not built, P3 ships its own minimal stop and R1 absorbs it.

## 4. Decisions for the user

1. **Picture style.** Recommended: built and drawn in code as above (no
   uploads, reviewable, one model serves picture and scene). The
   alternative is painted illustrations as uploaded images: closer to a
   book plate, but each is an upload with moderation, they cannot be made
   or corrected from this lane, and the scene still needs the 3D models.
2. **Rival wonders.** Recommended: small card, no camera move. Alternative:
   the full scene for every wonder in the world (22 scenes per game instead
   of the player's own few).
3. **Scene length.** Recommended: about 8 seconds to the card, skippable,
   on by default.
4. **Buildings.** Recommended: 3D models like wonders (they also dress the
   city panel). Alternative: 2D plates, less work, encyclopedia only.
5. **P6 landmark on the map.** Not scheduled until asked for.

## 5. Risks

- A `ViewportFrame` shows no shadows and flat light; models must read by
  silhouette and colour blocks. The preview sheet is drawn the same flat
  way so the judgement carries over.
- The preview is three.js, the game is Roblox Parts: tapered cylinders and
  cones differ (`AssetFactory` documents the approximations). The first
  Studio look in P0 calibrates this before 22 models are drawn.
- `EditableImage` has a per-client memory budget; one picture at a time
  keeps the encyclopedia inside it. The fallback is the existing era badge,
  reported through `Diag.fail`.
- The scene takes the camera. A missed restore leaves the player off the
  map; the tour stop checks the restore and Esc always returns.

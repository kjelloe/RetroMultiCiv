# roblox/ — SPEC (R1–R5)

Owner: roblox-helper (docs/10 §2 — this tree is its exclusive lane).
Scope: what exists after R1–R5 and the contracts it must keep. The
role spec and lane rules live in `docs/10-roblox-agent.md`; the anchor
values in `docs/09-phase5-luau.md` §1.

## 1. Purpose

Map the repo into a Roblox place with Rojo so that (a) the bugfixer's
`luau/` port runs inside Studio unmodified, and (b) the Studio-facing
client/server code has a home. R1 delivers the mapping plus an anchor
gate proving the port behaves identically inside Roblox.

## 2. Project mapping (`default.project.json`)

| Repo path        | Place path                                             | Mode     |
|------------------|--------------------------------------------------------|----------|
| `../luau`        | `ReplicatedStorage.Shared`                             | optional |
| `data/generated` | `ReplicatedStorage.GameData`                           | required |
| `src/server`     | `ServerScriptService.RetroMultiCiv`                    | required |
| `src/client`     | `StarterPlayer.StarterPlayerScripts.RetroMultiCivClient` | optional |

`data/generated` is required because its files are COMMITTED (a clean
clone has them) — see §3a.

Contracts:

- **Optional paths** (Rojo ≥7.4 `{"optional": …}`) keep
  `rojo build roblox -o build.rbxlx` green from a clean clone even
  before `luau/` lands; when it lands, the same project file maps it
  with no edit. `src/client` flips to required once R2 populates it.
- `../luau` is **read-only**: mapped by reference, never copied,
  never edited from this lane.
- The build artifact (`build.rbxlx`) is throwaway — never committed.

## 3. Anchor gate (`src/server/VerifyAnchors.server.luau`)

Prints the phase-5 cross-language anchors on Play Solo and PASS/FAIL
per gate:

| Gate | Input | Expected |
|------|-------|----------|
| xorshift32 sequence | seed `123456789`, 4 draws | `2714967881, 2238813396, 1250077441, 3820100336` |
| statehash | `{b=2,a={1,"x",true}}` | `0x30db1e29` |
| gamecode codeHi | `fnv32(canonicalize(anchor), reversed)` | `0xa687b72d` |
| gameCode | same anchor state | `AD1X-Q5MR-DP7H9` |

Contracts:

- **Expected values are immutable.** They mirror `test/rng.test.js`,
  `test/gamecode.test.js`, `shared/statehash.js` and `docs/09` §1. A
  mismatch means the port is wrong — report it, never adjust the gate
  (docs/10 §4.3). `check.sh` gate 3 enforces non-drift mechanically.
- **Module discovery is by name, not path**: the gate finds the
  `rng`/`statehash`/`gamecode` ModuleScripts by recursive search under
  `ReplicatedStorage.Shared`, so the bugfixer owns the `luau/` tree
  shape. Expected module APIs are the JS exports 1:1
  (`seedRng`/`nextRng`, `hashState`/`canonicalize`,
  `gameCode`/`fnv32`).
- While any of the three modules is missing the gate prints
  `R1 gate PENDING` and exits cleanly — that output still counts as
  scaffold verification, not as R1 done.

## 3a. Data converter (`data/build.js`, R2+R4)

Per docs/10 §3, JS/JSON references cross into Roblox ONLY via this
converter — no number is ever hand-copied:

- `client/renderer/three/terrain.js` `TERRAIN` table →
  `data/generated/TerrainPalette.luau` (parsed textually — terrain.js
  imports three.js/`document`, so it can't be require()d in Node)
- `data/*.json` (8 ruleset files) → `data/generated/rulesets/*.luau`,
  each the RAW JSON inside a `[==[…]==]` long string — the ONE parse
  authority is `luau/json2lua.parse` at server boot, so the tables get
  the exact ARRAY_MT/NULL semantics the lune gates verified. Never
  `HttpService:JSONDecode` (drops empty-array identity).
- `shared/statehash.js` over the same files →
  `data/generated/RulesetHashes.luau` — the GameServer boot gate.

Contracts:

- Generated files are **committed** (rojo build must be green from a
  clean clone) and never hand-edited; regenerate with
  `node roblox/data/build.js`. `--check` diffs instead of writing —
  check.sh gate 4 fails on drift.
- Stored `x`/`y` stay **0-based** (docs/09 trap 1): only Luau-side
  table access adds `+1`, never the stored values or index arithmetic.
- (R2's `MockState.luau` bake is retired — the live view replaced it;
  the R2 static scene survives in git history.)

## 3b. RETIRED: static renderer (R2)

`RenderWorld.server.luau` built the static scene from the baked mock
state; R4's `ViewRenderer.client.luau` (§3e) is its live successor and
kept its visual contracts (position-hashed shades, TILE=4/HEIGHT=6/
BASIN=2 scale, owner discs, city skylines). File removed 2026-07-15.

## 3c. Camera + tile selection (`src/client/`, R3)

`Camera.client.luau` — Scriptable map camera. Control scheme (user
playtest decision 2026-07-14): WASD/arrows stay with the CHARACTER
(default controls untouched); hold-LMB drag orbits (yaw free, pitch
clamped -85°…-15°), hold-RMB drag pans (grab-the-map: terrain follows
the mouse, focus clamped to the map, speed scales with zoom), Q/E
lowers/raises the focus (clamped 0–100 studs), wheel zooms (15–220
studs). Starts over the western continent
(tile 5,4). **Input trap** (recorded in docs/09 §3, roblox/-client
scope): with default character controls enabled, mouse-button events
arrive at `UserInputService` handlers pre-sunk (`gameProcessedEvent`
true) or not at all — so all camera mouse input is POLLED per frame
(`IsMouseButtonPressed` + screen-position delta), which nothing can
sink. Symptom if regressed: buttons "do nothing" while wheel/keys
work. Q/E is ignored while a TextBox has focus (the JS client's
INPUT/TEXTAREA rule).
**Second input trap** (R4 playtest, docs/09 ledger): `InputObject`
positions are GUI-INSET space — feed them to `ScreenPointToRay`,
never `ViewportPointToRay`; the viewport variant is offset by the
topbar (~36 px), which at shallow camera angles walks a ground pick
most of a tile. Symptom: clicks select the tile "behind" the pointer,
worse the flatter the camera.
**Third trap** (R4): a server push at `PlayerAdded` races the client
script load — the client must open the conversation (`{t='join'}`),
the server only ever replies.
DEFERRED (user-requested): follow-avatar mode — the focus tracks the
character instead of staying free.

`Select.client.luau` — click-to-select resolving to **logical tiles**
(A28's rule): raycast the click, then
`tile = clamp(round((hitPos - normal*0.05) / TILE))` — the pick comes
from the hit POSITION, never the hit body, so units, city blocks, and
mountain flanks all resolve to the tile they stand on (the normal
nudge keeps tall-column side hits on their own tile; boundary math
click-verified R3, 30+ picks). LMB is shared with the camera: only a
press that ends within 5 px of where it started selects; farther is
an orbit drag. R3's fog gap is CLOSED by R4: everything Select prints
or acts on comes from the filtered view (§3e).

R4 additions: `F` toggles follow-avatar (the banked user request —
focus rides the character; free cam stays primary); the camera
auto-centers on the seat's first unit at the first view push.

## 3d. GameServer (`src/server/GameServer.server.luau`, R4)

The authoritative loop, single Studio instance (one human seat + AI).

- **Boot data gate**: the 8 baked rulesets parse through
  `json2lua.parse` and every table must hash to its
  `RulesetHashes.luau` pin (computed by `shared/statehash.js` at bake
  time) — the data-crossing contract, asserted before the first
  command. Prints `data gate: 8/8`.
- **Fixed acceptance setup** (deterministic; the Node side rebuilds
  the identical initial state from the printed `[R4INIT]` line):
  seed 42, 40×25 ("xsmall" per client/main.js MAP_SIZES), civs
  romans (human, p1) / babylonians / germans. Names/colors come from
  the parsed civs ruleset, never hand-copied.
- **Sequencing mirrors client/session.js exactly**: human commands via
  `engine.applyCommand`; an OK `endTurn` starts the AI round — one AI
  player per heartbeat (`task.wait()`, the A30 no-frozen-frames
  lesson), `runAiTurn` + `endTurn` each, view pushed after every AI so
  the client watches the round advance. Determinism unchanged: same
  commands, same order.
- **The visibility law (banked @77b4ae09)**: every push is
  `filterView(state, seat)`; events ride `filterEvents`. Raw state
  never leaves the server.
- **Protocol** (docs/06 shapes over one RemoteEvent `RMC`): client
  opens with `{t='join'}` (client-initiated — a PlayerAdded push would
  race the client script load); server replies `{t='joined',
  playerId, view, …}` or `{t='rejected', commandId, code}`; commands
  are `{t='cmd', commandId, cmd}` with `cmd.playerId` STAMPED
  server-side from the seat (UserId is the binding, no tokens);
  every accepted command yields a `{t='view', …}` push.
- **Acceptance instrumentation** (@c0ad3988): `[R4INIT]` (setup +
  initial hash), `[R4LOG] {json}` per log entry — session.js
  semantics: ok non-endTurn commands as `{t='cmd', …, hash}` with
  PER-COMMAND hashes, rejections with reasons, one `{t='round', …,
  hash}` per round (ok endTurns subsumed) — plus `[R4CODE] turn=N
  code=…` (the game verification code) per round.
  `statehash.canonicalize` is the JSON writer, so lines assemble
  directly into a `tools/replay.js` diagnostics file.

## 3e. Client session + view renderer (`src/client/`, R4)

- `ClientState.luau` (ModuleScript) — owns the RemoteEvent channel and
  the latest VIEW; sends `{t='join'}` at require time; exposes
  `send(cmd)` (commandId counter), `onView(cb)`, `myTurn()`,
  `ownUnitAt(x,y)`, the shared `TILE` constant, `selectedUnitId`,
  `followAvatar`. The view is all the client knows — the visibility
  law is structural.
- `ViewRenderer.client.luau` — renders `workspace.ClientWorld` from
  each view push. `unknown` tiles = the void palette (visible in every
  fogged screenshot); explored-but-not-visible tiles dim 55% toward
  black; units/cities exist only if the view carries them (rival city
  shells render from their filtered fields). Terrain parts mutate in
  place (keyed cache, no 1000-part churn per push); units/cities
  folders rebuild per push. City skylines scale slightly with pop.
- `Hud.client.luau` — status line (turn/year/active/GAME OVER) + End
  Turn button; the full action bar is R5.
- Actions (`Select.client.luau`): click own unit = select (cyan
  cursor); click adjacent tile with a selection = `moveUnit`
  (dir-based, wrapX-aware delta); `B` = `foundCity` with a selected
  settlers (name `Colony <n>`); `Return`/HUD button = `endTurn`.

## 3f. City panel + possession (`src/client/`, R5)

`CityPanel.client.luau` — opens on clicking an own city (Select routes
it; a garrisoned city takes two clicks — first selects the unit).
Shows name/pop/food/shields/gold and the current build with progress;
the catalog lists every unit/building/wonder from the baked rulesets
(parsed client-side with the same `json2lua` — display data only,
never local game logic): buildable rows send
`setProduction {item={kind,id}}`, locked rows are greyed with the
reason (needs <tech> / built / taken — the browser catalog rules).
`Buy` sends `buy`; rejections (notEnoughGold, alreadyComplete…) print
via the standard rejected path.

`Possess.client.luau` — the docs/13 Roblox-native exemplar: `P`
possesses the selected own unit (avatar pinned to its tile, anchored,
default controls disabled, camera follows), `N` jumps to the next own
unit with moves left (sorted ids, wraps), WASD/arrows step ONE tile
per press as `moveUnit` engine commands — every rule applies, the
avatar is a costume, the engine is the only mover. Keys are
MAP-ABSOLUTE (W=N always: camera-relative would make identical
recordings depend on camera state). `F`/`Esc` dismounts (`F` is
possession-aware in Camera; `Esc` is Roblox-menu-reserved, so `F` is
the reliable one). All keys respect chat focus
(`GetFocusedTextBox` guard). Dismount is automatic when the ridden
unit dies or leaves the view.

## 3g. Tier-1 core-loop parity (`src/client/`, R6)

The server half came first (architect item order): `GameServer`'s AI
round now COLLECTS events — the human endTurn's own, each AI player's
`runAiTurn` eventsOut (the `nil` that starved the browser turn log's
twin), and each AI endTurn's — and every progress push carries the
slice since the last push through `filterEvents` at push time (the
session.js incremental-notify semantics). Event collection never
touches state or RNG: hashes and the R4 acceptance bar are unchanged.
`ClientState` fans them out via `onEvents(cb)`.

- `TurnLog.client.luau` — collapsible bottom-left log (`L` toggles;
  the closed toggle counts unseen entries). Narrates the browser
  turnlog.js vocabulary (combat/captures/growth/completions/wonders/
  government/tech…) from the view + baked rulesets; win/loss/rival/
  world color classes; 150-row cap; an unknown event shape prints
  `[?] <type>` rather than killing the loop.
- `ActionBar.client.luau` — bottom-center bar (ScreenGui, not
  Billboards — the adopted docs/13 review): Found (B) / Fortify (G) /
  Wait (Space) / Disband (X) / Irr (I) / Mine (M) / Road (R) /
  Ride (P, narrates where the real key lives) / Research (T).
  I/M/R send `startWork {unitId, work}` on the stood-on tile,
  settlers-gated client-side, terrain/tech judged by the server.
  Buttons grey by context (selected own unit / settlers, your turn);
  actions are commands only; hotkeys G/Space/X/I/M/R live here,
  chat-guarded. Space also jumps the avatar — cosmetic, unanchored
  avatar only. GoTo/pathfind deferred (flagged @b3084114);
  click-move covers the step case.
- `ResearchPicker.client.luau` — `T` toggles; auto-opens once each
  time research is unset on your turn. Lists `availableTechs` (the
  one-ring-ahead rule) and shows `researchCost` + bulbs/turn via
  `playerIncome`, all REQUIRED from the read-only luau engine modules
  on view-shaped shims (the @b81f92dd ruling: presentational math may
  use engine modules; ACTING stays commands — `setResearch {tech}`).
  The income shim works because own cities arrive WHOLE and their
  radius is always explored; pcall-guarded, display-only.
  Below: tax/lux STEPPERS (±10, science is the remainder; sliders
  fight the camera drag) sending `setRates {tax,sci,lux}`; the gov
  cap shows when known, the server stays the judge. A29 snap-back is
  satisfied BY CONSTRUCTION: the display only ever reads the view
  (no optimistic write), so a rejection leaves server truth showing.
- `MoveHints.client.luau` — while an own unit with moves is selected,
  its eight neighbors get markers: green = legal step (known tile,
  domain match, no enemy — move-hints.js's A19 legality, never cost/
  ZOC math), red = enemy on an enterable tile (the attack ring).
  Markers are `CanQuery=false` so Select's raycast passes through;
  selection isn't evented, so a per-frame key compare drives refresh.

## 3h. Playtest-B UI sweep (`src/client/`, R7a)

The user's run2 feedback, triaged as R7a (8 corrections, one sweep;
numbers are Roblox-Playtest-B item numbers):

- (4) The action bar prechecks legality VIEW-SIDE (`can(action)`) —
  wrong-context buttons grey AND dead (the send is gated too); the
  server still judges the real rules (A29: display-only precheck).
  Settlers jobs also require a land tile under the unit.
- (1) The city panel HIDES catalog entries beyond one-tech lookahead
  (tech known or all its prereqs known); within the horizon they stay
  greyed with the reason. Accepted divergence from the browser's
  show-all-locked (docs/13 run2 block).
- (12)(15) `ClientState.nextOwnUnit` is the shared next-unit picker:
  input.js:255 semantics (skip fortified/working unless hand-picked),
  NEAREST-first by wrap-aware Chebyshev from the current unit.
  Possess's N and every auto-advance ride it.
- (9) Double-click an own unit while mounted → the mount rides to it
  (`ClientState.requestPossess`, the same path N takes).
- (5)(7) `Options.client.luau`: auto-next-unit and auto-end-turn,
  both DEFAULT ON (accepted divergence: browser opts in, Roblox opts
  out) with top-right toggles. Auto-end waits 1 s and revalidates
  (one per turn number — no runaway); with it off, a center hint
  points at Return/End Turn.
- (6) Research moved out of the unit bar to a top-center cluster
  (slots reserved for diplomacy/statistics).

## 3i. Playtest-B presentation (`src/client/`, R7b)

- (8) Per-unit BILLBOARD on every rendered unit: name + att/def
  (ruleset facts by type) + move pips from the view's own `moves`.
  Fog-respecting by construction — a unit is only in the view while
  visible. Rival labels tint red-ish.
- (10) Own settlers add a site line to their billboard: legality via
  the READ-ONLY `ai.goodCitySpot` on a view shim (fog-approximate
  like move hints — an unseen rival city can still reject the found);
  `ActionBar.can("found")` uses the same call, so Found greys on
  illegal spots. Stars on a legal spot are a PRESENTATIONAL heuristic
  (1 base; +1 strong center tile: grassland/plains/river; +1 when 3+
  neighbors are strong) — flagged for architect tuning, display-only.
- (11) Discovery SPLASH (tech name + unlocked units/buildings/wonders
  — ruleset facts, never wiki prose) for 5 s; the Research button
  BLINKS while research is unset on your turn (blink phase joins the
  ActionBar repaint key).
- (2) `VoidCover.client.luau`: invisible guard walls + catch floor
  (always on — avatars can't leave the map), plus BOTH art variants
  built procedurally (own art only, license discipline): "frame" =
  parchment apron + trim rails + corner medallions (boot default);
  "galaxy" = deep-black floor + deterministic LCG starfield
  (position-hashed, screenshot-stable — the R2 rule) + nebula
  spheres. `V` cycles frame → galaxy → none; the user picks by
  screenshot (the soundboard pattern).

## 3j. Tier-1 close-out (`src/client/` + GameServer, R7d)

- (1) `OddsPreview.client.luau` — hover an ADJACENT enemy tile with an
  attack-capable unit selected: a Billboard shows the browser preview
  string (client/ui/input.js:26 is the spec — word/pct thresholds,
  att/100 vs def/100, terrain/river/fortified/veteran/walls ×3/
  fortress ×2 parts). Math is READ-ONLY `combat.attackStrength/
  defenseStrength/bestDefender` on a view shim; walls come from the
  city SHELL's own exposure, so fog holds by the view. Parity proof:
  three crafted setups print byte-identical att/def/pct through
  engine/combat.js and luau/combat.luau. COORDINATE NOTE:
  `GetMouseLocation` is VIEWPORT space → `ViewportPointToRay` — the
  inverse pairing of trap 2 (InputObject = GUI-inset →
  `ScreenPointToRay`).
- (2) Game-code chip (docs/07 trust loop): GameServer sends
  `gamecode.gameCode(state)` with EVERY push (additive, Roblox-
  internal payload field); the Hud shows it in a read-only SELECTABLE
  TextBox (no clipboard API — trap 8).
- (3) `CityList.client.luau` (`C`): own cities with pop + production
  progress; tap → `ClientState.focusCamera` (new channel; Camera
  listens and breaks follow) + `openCity`.
- (4) `Statistics.client.luau` (`J`, the reserved top-center slot):
  THE FOG RULE is structural — rival rows are view-derived counts
  only (cities seen / units in sight), the own row adds the seat's
  filterView fields (gold, tech count, government, research).
- (5) Three-state End Turn (A29): grey off-turn / green READY when no
  movable unit remains (fortified/working are standing orders) /
  two-press CONFIRM when units still have moves (first press warns
  "N can move!", second within 3 s sends).

## 3k. AssetFactory from recipes (R8)

The A88 contract: unit/city/prop silhouettes are DATA
(`data/assets/asset-recipes.json` — note the ruled `data/assets/`
subdir; top-level `data/` stays the 8-file engine contract), and both
renderers compose the SAME primitives from it.

- Bake: `build.js` embeds the raw JSON as `GameData.AssetRecipes`;
  the pin rides `RulesetHashes.assetRecipes` as **fnv32 over the raw
  bytes** (recipes carry floats + prose, so statehash — a game-state
  hasher — can't gate them; JS reads latin1, Luau feeds the baked
  long string: byte-identical by construction, verified 12285661
  both sides).
- `AssetFactory.luau` (ModuleScript): box→Block, cyl→Cylinder
  (stood up; **no taper** — radius = mean of rTop/rBot, flagged),
  sphere→Ball, cone seg 4 → square pyramid from 4 CornerWedgeParts,
  cone seg N → `coneMode` "fan" (N wedge slabs, chord-width) or
  "stack" (3-disc ziggurat) — the USER'S judgment point;
  dodeca→squat Ball, torus→8-box ring (both flagged best-effort).
  Cones shift half-height in their OWN rotated frame (three centers
  ConeGeometry; a tilted spearhead's base moves along its axis).
  `primary`/`secondary` are injected at build time — the data never
  carries a faction hex. Chariot = mounted + chariotWheels (the
  assets.js rule). Ship SAILS stay procedural in the browser and are
  omitted here (flagged).
- `ViewRenderer` builds unit bodies via `AssetFactory.buildUnit`
  (placeholder blocks remain only as the pcall fallback); the owner
  disc / rampart / billboard stay procedural on top.
- `GalleryGrid.client.luau`: **K** toggles a floating grid (F9 is
  platform-reserved, Developer Console — found live at runC) — every
  unit recipe twice (fan | stack), the city house+roof, every
  propShape, labeled. The Studio screenshot of this grid vs
  `debugging/gallery.html` is the R8 acceptance; the user judges
  cone fidelity (mesh-upgrade explicitly held for silhouettes that
  disappoint).
- check.sh gate 5: `build.js --keys` — every units.json id resolves
  through `unitSilhouette` to a real recipe, both directions.

### 3l. R12 — Playtest-C batch (user's runC feedback, numbering kept)

- (2) `GovernmentPanel.client.luau` (NEW): opened by the ActionBar's
  top-center **Government** button; hosts the tax/lux/sci steppers
  (MOVED from the research picker) + the current-government line;
  government switching lands here later. Same stepper semantics
  (±10 into science, server judges caps).
- (3) unit billboards: SourceSansBold 22 (was Code 11), 2× and wider.
- (4) city billboards ALWAYS-ON: name + pop + production + ~turns
  left. Fog-honest by construction (view fields only); turns-left is
  presentational math via read-only `cities.cityYields` on a view
  shim, pcall'd — the line drops when the view can't support it.
- (5) live research status beside the Research button: current tech
  + turns remaining (researchCost + playerIncome shims, pcall'd).
- (6) Ride ↔ Dismount: the P key AND the action-bar button toggle
  with mount state (a nil possess-request is the dismount half).
- (7) Next while DISMOUNTED moves selection + camera only (N key and
  the auto-next option both); the avatar never teleports. Mounted
  Next still jumps the ride.
- (9) dev-only **DEBUG** button (Studio-gated via RunService:IsStudio,
  left edge) hosting the K-gallery toggle; the A92 debug menu rides
  this button later. Pyramid saga: the roof was BURIED (gallery
  perch pos 0.25 → 1.0; recipe pos = cone center, three convention)
  AND inside-out (CornerWedge apexes outward — fixed with +180 yaw
  in `pyramid()`, proven by the user's model-house-fail1.png).
- (10) opening lockout: default spawn = unexplored tile = fall
  through fog void onto the catch floor UNDER the map. Fix: every
  CharacterAdded (+ first-view boot case) places the avatar on an
  own unit's tile, settlers preferred (`Possess.client.luau`).
- Cone pick = FAN (user, final); stack stays gallery-side only.

## 4. Self-test (`check.sh`)

`roblox/check.sh` is the headless self-test (runnable on any machine
with rojo; the suite-hookup twin on the dev PC is requested via the
architect):

1. `rojo build roblox` to a temp file succeeds.
2. The built place contains the mapped instances (anchor gate, game
   server, GameData tree, all client scripts — the list lives in
   check.sh gate 2).
3. The anchor literals in `VerifyAnchors.server.luau` match the
   canonical goldens in `test/rng.test.js` and `test/gamecode.test.js`
   (drift check — read-only consumption of `test/`).
4. `node data/build.js --check` — generated Luau data still matches
   its JS/JSON sources (skips if node is absent).
5. `node data/build.js --keys` — recipe-key coverage (R8, §3k).
6. Reserved-keys gate: no client script binds a PLATFORM-RESERVED
   KeyCode. The reserved list (grows as collisions are found):
   `F9` (Developer Console — bit us live at runC), `F12` (record),
   `Escape` (Roblox menu, docs/13 standing list). Client keybinds
   must come from the free pool; the taken pool is every hotkey in
   README "Controls" (currently B G Space X I M R P N F T L C J V K
   + camera Q E WASD).

What check.sh cannot cover: Luau execution. The only executable proof
is Studio Play Solo output (docs/10 §4.2) — captured verbatim into the
done-note, screenshots read and described.

## 5. R4 acceptance (`acceptance/assemble.js`)

The live cross-language proof: a game PLAYED in Studio must replay
hash-exact through the Node engine.

1. Play N turns in Studio (found a city, move units, end turns). The
   server prints `[R4INIT]`/`[R4LOG]`/`[R4CODE]` lines throughout.
2. Copy the whole Output into `roblox/acceptance/<run>.txt` (raw copy
   fine — timestamps/context suffixes are stripped; the file is
   COMMITTED as the acceptance artifact).
3. `node roblox/acceptance/assemble.js roblox/acceptance/<run>.txt`:
   rebuilds the initial state JS-side from the printed setup (asserts
   createGame parity), replays every entry through the Node engine
   verifying each per-command and per-round hash, and recomputes the
   final game verification code against the last `[R4CODE]`.
   Exit 0 + `ALL HASHES MATCH` = accepted.

Harness self-test: a synthetic Node-generated output round-trips the
assembler (done 2026-07-15); the expected Studio initial hash for the
fixed setup is `0x0ca5d97c`. The game-code comparison point is the
state after the LAST ROUND entry — `[R4CODE]` prints per round, so
commands played after the final print (run2: one trailing move before
Stop) are hash-verified but must not skew the code check.

## 6. Status

- R1: **DONE 2026-07-14** — all four anchors printed PASS in Studio
  Play Solo with `luau/` mapped and unmodified (including gamecode's
  relative string require, which the Studio VM resolves); rojo build
  and check.sh green.
- R2: **DONE 2026-07-14** — scene verified in Play Solo
  (`[RenderWorld] R2 static scene: 24x16 tiles, 4 units, 2 cities`),
  two screenshots read and described. Ocean material is SmoothPlastic
  by finding: Glass washes out to grey on low graphics settings. Known
  cosmetic gap: the baked ocean navy reads slate-grey under Studio
  lighting vs the JS sea.
- R3: **DONE 2026-07-14** — §3c scheme verified hands-on in Play Solo
  (orbit/pan/lift/zoom/click-select + avatar movement), click test
  logged (body clicks resolve to tiles per A28) + boundary probe
  (30+ picks script-verified, adjacent mountain columns split
  correctly), R3.png/R3-orbit.png read.
- R4: **DONE 2026-07-15** — acceptance GREEN: 36 Studio-played turns
  (98 commands, 35 rounds) replayed hash-exact through the Node
  engine; createGame parity `0x0ca5d97c`; final game code
  `BA05-2M69-QYHRN` agrees (artifact: `acceptance/run1.txt`). Fogged
  R4.png read. Same-day playtest fixes: `ScreenPointToRay` (GUI-inset
  click offset), template Baseplate destroyed at boot (buried the
  ocean columns), `StreamingEnabled` pinned false (fog pop-in
  suspect — verify next run). Banked for R5+: city view/production
  picker, morph-into-unit avatar mode + N-next-unit (user request).
- R5: **CODE-COMPLETE 2026-07-15** — §3f city panel + possession
  landed; check.sh extended to 22 gates (ALL GREEN); `run1.txt`
  re-replays ALL HASHES MATCH on the current tree. Acceptance
  PENDING: the user's run2 playtest (production change + Buy +
  possessed moves + fog verdict), `acceptance/run2.txt` replayed via
  assemble.js, screenshots `R5-city.png`/`R5-possess.png` read.
- R6: **CODE-COMPLETE 2026-07-16** (claimed @814b833e, built
  overnight) — §3g: turn-log server half (AI-round event collection)
  + turn log, action bar, research picker + rate steppers, move
  hints; check.sh 26 gates. pathfind/GoTo deferred (flagged to the
  architect).
- R5+R6 played acceptance: **REPLAY BAR GREEN 2026-07-16** —
  `acceptance/runB.txt` (the user's naming scheme: run letters match
  Roblox-Playtest letters; run1 predates it): 88 turns / 579
  commands / 87 rounds played
  in Studio, ALL HASHES MATCH, game code `D5TC-ZFSV-WS8GG` agrees at
  turn 88; anchors ALL PASS, data gate 8/8, zero errors in ~90 min.
  Exercised: setProduction x28, buy x4, foundCity x4, fortify x49,
  wait, disband, startWork x6, setResearch x22, moveUnit x520,
  possession (ride + steps). The run surfaced the assembler's
  game-code comparison-point gap (fixed, §5). The run2 leftovers
  (setRates exercise, per-surface screenshots, fog verdict) fold
  into R7a's acceptance run per the architect.
- R7 (Playtest-B batch): claimed 2026-07-16 @d11b4054. R7a (§3h, the
  8-item UI sweep): **CODE-COMPLETE 2026-07-16**, check.sh 27 gates.
  R7b (§3i, billboards / site stars / discovery splash / void
  cover): **CODE-COMPLETE 2026-07-16**, check.sh 28 gates. R7c
  is design-first with the architect — not started by order;
  R7c-3 (worked-tile 3D proposal) drafted @e87d97d8, user look
  pending.
- R7d (§3j, Tier-1 close-out): **CODE-COMPLETE + ACCEPTED
  2026-07-16** (@d6294b0c) — odds preview
  (cross-engine spot-check byte-identical on three setups), game-code
  chip, city list, fog-structural statistics, three-state End Turn.
- runC ACCEPTANCE (2026-07-17, `acceptance/runC.txt`): 242 commands /
  68 rounds ALL HASHES MATCH, code `B6BM-YT9Y-8HY2C` agrees; setRates
  x4 closed the LAST unexercised command path; zero errors. R7a/b/d
  **ACCEPTED** (architect @af878fe2). VOID PICK = **FRAME** (already
  the boot default; galaxy goes to art round 2 — denser/deeper, own
  the sky). Fog verdict still open.
- R8 (§3k, AssetFactory): **CODE-COMPLETE 2026-07-16** (claimed
  @f35fc677) — recipes bake (fnv32 pin 12285661, MATCH verified via
  lune), composer with both cone variants, ViewRenderer bodies from
  data, gallery grid (K; F9 collided with the platform console),
  check.sh gate 5 (keys). CONE PICK = **FAN** (user, final).
  Pyramid fixed twice (buried perch + inside-out apexes, §3l);
  user's fresh grid screenshot pending.
- R12 (§3l, Playtest-C batch): **CODE-COMPLETE 2026-07-17** (claimed
  @bfdb09c0) — items (2)-(7),(9),(10) above; 37 gates. Studio
  verification pending (the user's next session).

## 7. Shared-tree workflow (dev_night)

The clone is SHARED with the sim-runner (the git operator — docs/12's
dev_night protocol). Ruling @f243859a: between a done-mail's
files-for-sweep manifest and the architect's push-confirm, the listed
files are FROZEN on the helper's side (whole-file staging would sweep
any later edit in silently); next-item work starts only in files
outside the pending manifest. Flag unavoidable mid-flight files in the
done-mail ("working tree also carries X, exclude"). Any push-payload
(protocol) change is flagged explicitly in the done-mail (@d6294b0c).

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
- **The visibility law (banked @77b4ae09; spectator exception ruled
  @d1ce4920)**: every push is `filterView(state, seat)`; events ride
  `filterEvents`. Raw state never leaves the server. EXCEPTION: an
  unseated SPECTATOR receives the OMNISCIENT `filterView` path (the
  twin's no-player-row branch — still `filterView` output, never raw
  state) iff the host's `spectators` setup toggle is ON; spectators
  can send nothing but the pad-toggle and `{t='stats'}` (commands
  reject as `notSeated`). This is the browser's host-controlled
  spectator contract ported faithfully.
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

### 3m. R9 — the lobby place (docs/13 Tier-3 slice 1, user design)

The place boots GAMELESS. `Deck.luau` (server module): observation
deck in the sky (platform + rim + neutral SpawnLocation + three
ProximityPrompt pads, phase-gated). `GameServer.server.luau` owns
the flow: START pad → host + 60s setup window (size/civs/humans
steppers, maxCivsBySize-capped) → 30s countdown → createGame; JOIN
pad claims seats 2..H; TAKE OVER pad (running) seats a late joiner
into a RANDOM vacant human seat. Vacant/ABSENT human seats are
REGENT-driven — the browser A40 twin exactly: state.human stays
true, `ai.pickCommand` loop, each command logged as an ordinary cmd
entry (no hash field), the endTurn covered by its round entry.
REPLAY-SHAPE PROVEN headlessly (seated + regent + engine-AI, 12
turns, replayDiagnostics EXACT) before Studio ever ran it.
Admins-only kick (CreatorId + ADMINS list). NO CHAT asserted at
boot. Spectator default: unseated clients get lobby messages ONLY —
no view, no fog leak, structurally. [R4INIT] gains `humans=N`;
assemble.js parses it (absent = 1, old runs stay valid).
`Lobby.client.luau` renders greeting/phases/seats/countdowns/setup
on its own RemoteEvent handler (own `lobbyHello` handshake).
V1 flags: joiner civ pick is auto-by-seat-order; greeting per-join.

### 3n. R10 — save/resume (Tier-3 slice 2, browser A98 twin)

`SaveStore.luau`: DataStore "rmc_saves", pcall-wrapped. Envelope =
`statehash.canonicalize({state, savedAt, humans})` KEYED BY THE GAME
CODE (docs/07 authorization-by-knowledge). Round-trip proven
identity (node canonicalize → luau parse → same hash; re-canonicalize
byte-identical). Resume runs the docs/07 TAMPER CHECK: gameCode of
the parsed state must equal the typed key. Host GET RESUME CODE
button (running) → selectable code box; resume-by-code TextBox in
the idle lobby. EPHEMERAL public servers: last seated human out →
120s grace (task.defer'd — PlayerRemoving still counts the leaver,
measured trap) → autosave + end to idle; private servers skip.
[R4RESUME] prints code/turn/humans/hash (resumed-run assembler
support = future work, flagged).

### 3o. R11 — click-only ride pad (R7c-13/14, user design)

`RidePad.client.luau`: while mounted, 8 BillboardGui click-targets
over the neighbor tiles (engine DIRS N..NW) send the same moveUnit
commands as WASD — the ONLY 8-dir ride input (KEY_DIR is 4-dir).
GUI clicks arrive gameProcessed so Select never double-fires.
AUTO-DETECT: no keyboard → pads on; left-edge PAD button toggles;
R16 wire: `options.ridePad` (auto/on/off) is the shared pref.

### 3p. R14 — GoTo + the pathfind twin (the last Tier-1 row)

`luau/pathfind.luau` = shared/pathfind.js twin (A65's done-note
assigns the port to this lane; client-consumer, NOT gated).
BYTE-PROVEN: five crafted cases node-vs-lune identical (rail detour
beats the straight line, fog/ocean null, self-target). Costs ×3
integer, linear extract-min + idx tie-break, CAP 8000.
`StepLegality.luau` = the ONE tile-entry verdict (A65 rule) —
MoveHints' green/red AND the planner's canEnter read it.
`GoToPlan.luau`: O arms target-pick on the selected unit (Select
hands the pick over while armed); plan re-plans EVERY step and
issues one ordinary moveUnit per view push (engine validates,
replays record plain moves — golden-safe by construction); purple
breadcrumbs 3s; arrival/route-lost cancel aloud.

### 3q. R13+R15+R16 wires — city panel completion (Tier-2 rows)

R13 (A97/A86 twin): built-buildings strip with per-row SELL — price
= cost × sellPriceRatio, two-step confirm (armed 3s), soldThisTurn
greys the strip, the Palace (effect.isPalace) never sells; command
sellBuilding {cityId, building}, server judges. R15: buildings and
wonders carry plain-language effects sublines via
`CatalogText.luau` — the TWIN of client/ui/catalog-text.js (A58a
extracted it for exactly this consumer); wonders without effects
show the prestige line. R16 wires: options.hideFuture hides the
one-tech-lookahead rows; options.ridePad row (auto/ON/off) cycles
in the options stack.

### 3r. R18 — replay theater (Tier-4 reach goal, A47+A87 twin)

`ReplayTheater.client.luau` + a GameServer history record (the same
entries [R4LOG] prints, kept as data + a deepClone'd initialState).
THE LAW GUARD: the server streams history ONLY post-gameOver (or to
admins) — a mid-game stream would be a fog wallhack. The client
re-derives in a SANDBOX (read-only luau engine, exact
replayDiagnostics semantics incl. hash checks), renders a MINI-STAGE
(row-run-merged tile tints + city blocks + unit dots at y=220 —
deliberately not the live renderer), cycles perspective omniscient →
per-civ (filterView on sandbox states = historically honest fog),
and shows A87 verdict strings (VERIFIED / MISMATCH at entry N).
Controls: |< -1 +1 >|, click-to-jump bar (no drag slider), view
cycle. Scrubs re-derive from turn 0 (v2: feed-anchor cache).

### 3s. Run-4 playability fixes (user live session 2026-07-17)

Root cause of "lobby broken + no map" (F1 witness in
roblox/debugging/): the server built the deck AFTER the seconds-long
data gate and destroyed the Baseplate at boot END — players spawned
on the Baseplate, it vanished under them, and pre-game there is no
other floor (VoidCover builds on the first view) — an endless fall.
Fixes, in boot order:
- deck + SpawnLocation + a PERMANENT touch-teleport catch floor
  (y=-20, bounces to the deck) build FIRST; Baseplate destroyed
  only after; pre-existing characters teleported to the deck.
- STRAY SpawnLocations (the place template carries one — Roblox
  picks among ALL spawns) are anchored + moved flush onto the deck
  floor plane at boot.
- a data-gate failure now plants a RED SIGN over the deck (silent
  server death read as an empty void scene).
- camera: follow-avatar is the JOIN DEFAULT and tracks height (the
  deck lives at y~141, above the old 0..100 focus clamp).
- ONE COMMON PLANE (user ruling): spawn plate, lobby pads, and the
  ACTION STRIP are flush tiles in the deck floor (+0.06 reveal).
- lobby pads are WALK-ON (touch triggers, 1.5s/player debounce;
  E-hold prompt = backup) and EVERY touch answers: act, or a toast
  explaining why the pad doesn't apply right now (join-with-no-host,
  takeover-with-no-game, start-mid-game, seats full, already
  seated/hosting — all covered).
- `ActionPads.client.luau` (NEW): binds the shared action-strip
  tiles; stepping on one fires the action for YOUR selected unit
  (dims per-client when not applicable; DISBAND deliberately
  excluded from walk-on).
OPEN (user pick pending): avatar flow at game start — deck-resident
(pads reachable, possession rides down) vs on-map (plate follows).

### 3t. Session-E + browser-parity catalog (2026-07-18)

A long live-playtest session (rounds 1-23) plus a full pass against
`specs/browser-feature-catalog.md` — the flat inventory of every
browser feature, whose parity column the roblox-helper OWNS (annotate
PRESENT/PARTIAL/MISSING/N-A-platform/DEFERRED, file twin/direction
requests by row id CP/SO/MP). Design invariant that recurs below:
world-public reads (score / standings / stats) are fog-safe by the
browser's own argument, so the SERVER computes them from full state
and broadcasts; everything a SEAT sees stays `filterView`-filtered.

Server (`GameServer.server.luau`) additions:
- **R22 idle + AI regency**: `awaySeats` (voluntary or idle-timeout
  hand-over) counts as absent so the existing regent machinery drives
  it; `away` protocol message + auto-reclaim on any real command; a
  host `maxIdleMin` knob; the Hud runs the idle→60s-countdown.
- **R23 rolling autosave**: every 10 turns after the round wrap,
  keyed by the docs/07 code; `{t=saved}` chip so a Studio stop loses
  ≤10 turns. Resume via the R10 lobby box.
- **R24 starting ages**: lobby age stepper → chunked create-time
  fast-forward (`luau/fastforward.luau` twin, gate 9) with honest
  abort; **R24b host-options parity** (difficulty/combat/seed) via
  `applyRuleOverrides` (merged rules copy + engine rebuild, save/
  resume-coherent with the marker-0045 rulesetHash pin).
- **CP16/MP8 spectate** (THE LAW exception, §3e, ruled @d1ce4920):
  SPECTATE pad + host toggle; spectators get the omniscient
  `filterView` (twin's nil-seat branch), send nothing but the toggle
  and `{t=stats}`.
- **SO7 endscreen / SO9 historian / SO8 stats / SO17 strategy**:
  server frames from full state — `{t=endscreen}` scoreBreakdown rows
  on gameOver, `{t=historian}` standings on ageChanged, a per-round
  score series pulled by `{t=stats}`, and a per-AI `strategicSnapshot`
  (`luau/strategic.luau` twin) pulled by `{t=strat}` (all pull-only or
  event-driven, never blanket-pushed; the last two gated to
  spectators/Studio-debug).
- **MP11 marathon**: `endYear=9999` override (lobby toggle).
- **R17 debug menu**: Studio games set `debug` at createGame; the
  thin-client `DebugMenu` issues ordinary `debug{action}` commands
  (`luau/debug.luau` twin); `debugUsed` rides the push envelope → a
  permanent Hud DEBUG chip (hash-watermark honesty).

Client modules (all read the view, act via ordinary commands, so
golden-safe by construction — the GoTo precedent):
- `BuildQueue` (CP8), `Ship.client` (SO11), `DiscoveryCard.client`
  (SO3), `EndScreen.client` / `Historian.client` (SO7/SO9),
  `AdviceCards.client` (SO5), `Minimap.client` (SO1, flat-Frame grid),
  `Tooltip` (SO2, hover/long-press), `Palette` (SO14, gate 10),
  `Legend.client`, `DebugMenu.client` (R17), `SettlerAuto.client`
  (CP20 automation), `Strategic.client` (SO17 🧠 overlay,
  spectator/Studio-gated) — plus ActionBar rows Cities/GoTo/Fort/
  Pillage/Trade(CP17)/Upgrade(CP18) and card toggles
  Zz(sentry)/Au(automate).
- Cross-cutting pattern reused: units that "sleep" out of N-cycling +
  `movableCount` + `allUnitsDone` — garrisons (R19), sentries and
  auto-settlers (CP20). Session-local sets on `ClientState` (no engine
  command); a manual order cancels automation via the `send` hook.

Run-F live playtest (2026-07-19) fixes:
- **#11 city names + specialties**: the `GameServer` playerDef now
  passes `civ = civId`. Without it `mapgen.js` took the no-civ branch,
  so cities fell to the `City c<n>` fallback AND every AI lost its civ
  specialty (startTech/startGold). One field restores real historical
  names and the specialty grants.
- **#6 debug on Studio resume**: `state.debugEnabled` is restored from
  the save, so a Studio resume dropped debug. Resume now re-enables it
  in Studio (same rule as create, R17).
- **#7 saves-off surface**: `SaveStore.available()`; the server sends
  `{t=saveUnavailable}` once when persistence is off (Studio API access)
  so the Hud saveChip warns instead of the code silently not resuming.
- **#1 left-stack exclusion**: `ClientState.panelOpened/onPanelOpen` —
  opening Legend / Debug / Turn log hides the other two.
- **#3 regency-countdown cancel**: `send()` already reset `lastActivity`
  on every command; added a `UserInputService.InputBegan` reset so any
  click/keypress (not just avatar movement) counts as activity.
- **#4 world-look default enhanced**; **#10** research-status line moved
  above the Research/Cities button row.
- **#5 tile improvements** (`ViewRenderer.renderImprovements`): roads/
  railroads as a strip, irrigation as a channel quad, mine as a cube,
  fortress as four ramparts — persistent-signature cache, `CanQuery=
  false`. Gate 13 keeps it in sync with the filterView twin.
- **#8 progressive city model**: pop-tier sets house count + height; the
  visual BAND sets the style, from the SHARED `shared/city-era.js`
  contract (bands ancient/classicalMedieval/industrial/modernSpace,
  `CITY_ERA_STYLES` body/roof/prop keys, `cityEraBand` per city on the
  owner's techs — fog-honest, rivals fall to ancient). Deterministic
  layout hash, no RNG. Gate 12 pins the bands against the contract.
- **#2 / SO12 fast-forward diorama** (`FastForward.client.luau`): the
  server streams `{t=ffProgress}` each fast-forward chunk (`ff.turn()`);
  the client shows an animated growing-skyline diorama + progress bar
  during the create-time AI fast-forward, cleared on the first view push.
- Pedia (#1726 §1): the ally's `movement` + `regency` concepts ported
  into `PediaConcepts.luau` (recordings already had the richer Roblox
  body) — 16 concepts, gate 14 keeps them in sync.
- Still open: **#9** per-unit/building pedia flavor blurbs (original
  prose, requested from the ally like tech-blurbs, #1755); the XII.6
  tech-tree tier (#1726 §2) is the next queued build.

Catalog state after this pass: **FULLY CLOSED** (SO17 landed
2026-07-18, marker via `luau/strategic.luau`; CP9 corrected — the
ViewRenderer `siteLine` already draws the fog-honest settler rating).
A status-field scan finds ZERO genuine MISSING rows — scoreboard
32 PRESENT / 11 PARTIAL-with-plan / 5 N-A-platform / 1 DEFERRED
(SO15 audio content, user-gated). Every browser feature has a Roblox
counterpart or a recorded reason. The standing process holds: the
architect adds a catalog row when the browser grows a feature; the
roblox-helper annotates and builds/requests-a-twin by row id.

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
   README "Controls" (currently B G Space X I M R O P N F T L C J V K
   + camera Q E WASD).
7. StepLegality pinned verdicts (`selftest/steplegality.luau`, lune):
   the one-source tile-entry module behind ride keys / click-move /
   GoTo / MoveHints — 17 wrap/domain/enemy/fog verdicts pinned so the
   four call sites can't drift. Self-skips without lune.
8. Billboard-input lint (`lint.js`, node): a TextButton/ImageButton
   parented into a BillboardGui must set `<bb>.Active = true` — the
   session-E "CLOSE does nothing" bug class (PlayerGui ancestry is
   necessary but not sufficient; Active is the sink).
9. Fast-forward twin parity (`selftest/fastforward-parity.{mjs,luau}`,
   node+lune): JS and Luau fast-forward the same seed+probe-age to a
   byte-identical state hash (`ff-parity 0x…`) — the golden-neutral
   proof the architect required for the `luau/fastforward.luau` grant.
10. Palette coverage (`selftest/palette-coverage.mjs`, node): the
   `Palette.luau` deuteranopia table maps EVERY `civs.json` color +
   `visual.primary` — a civ recolor / hex typo can't silently
   un-remap a civ in accessibility mode (browser `test/palette.test.js`
   twin, text-scan not execution).
11. Tech-blurbs parity (`selftest/tech-blurbs-parity.mjs`, node): the
   `DiscoveryCard.client.luau` `TECH_BLURBS` table is a 1:1 port of the
   browser `client/ui/tech-blurbs.js` (the one authoring source) — id-set
   + string equality so a new advance, reworded line, or paste typo on
   either side can't drift silently (text-scan not execution).
12. City-era parity (`selftest/city-era-parity.mjs`, node): the
   `ViewRenderer` progressive city model (run-F #8) uses the SHARED
   `shared/city-era.js` band contract — `BAND_STYLE` keys ==
   `CITY_ERA_BANDS` and `ERA_TO_BAND` covers every engine era in
   `data/techs.json` — so Roblox can't drift from or invent bands.
13. Improvement render coverage (`selftest/improvement-coverage.mjs`,
   node): every tile-improvement flag the `luau/visibility.luau` filter
   emits (`tile.<field> = true`, minus the river/special terrain features)
   is read by `ViewRenderer` (run-F #5), so a new improvement in the twin
   can't render invisibly.
14. Pedia-concepts parity (`selftest/pedia-concepts-parity.mjs`, node):
   the `PediaConcepts.luau` concept set is a port of the browser
   `client/ui/pedia-concepts.js` — id-set + body equality (bodies
   normalized for the em-dash→hyphen transliteration; the `recordings`
   body is a documented platform divergence), so a new concept or a
   reworded line can't drift.

What check.sh cannot cover: general Luau execution (only the pinned
lune gates 7 and 9 run Luau headlessly). The full executable proof is
Studio Play Solo output (docs/10 §4.2) — captured verbatim into the
done-note, screenshots read and described. Newer client logic modules
worth pinning if they grow risk: `SettlerAuto` findJob (view-based
scoring — engine-guarded today, so untested; extract-and-pin if the
policy gets tuned).

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
- NIGHT-2 (2026-07-17, all committed via the five-sweep burst
  9f81669/8bae773/4050c08/0c27d2a/6e63447, sim-runner #877):
  R9 lobby (§3m, replay-shape proven), R10 save/resume (§3n,
  round-trip proven), R11 ride pad (§3o), R14 GoTo + pathfind twin
  (§3p, byte-proven), R7c-3 worked-tile FULL BUILD (user un-gated;
  note-for-review in module header), R16 options completion,
  galaxy art round 2 (VoidCover owns Lighting in galaxy mode).
  All gamesim-golden-neutral. Studio verification rides the user's
  next session.
- R13+R15+R16-wires (§3q): **CODE-COMPLETE 2026-07-17** — sell
  strip, effects sublines (CatalogText twin), hideFuture + ridePad
  wires; 46 gates. Studio verification pending.

## 7. Shared-tree workflow (dev_night)

The clone is SHARED with the sim-runner (the git operator — docs/12's
dev_night protocol). Ruling @f243859a: between a done-mail's
files-for-sweep manifest and the architect's push-confirm, the listed
files are FROZEN on the helper's side (whole-file staging would sweep
any later edit in silently); next-item work starts only in files
outside the pending manifest. Flag unavoidable mid-flight files in the
done-mail ("working tree also carries X, exclude"). Any push-payload
(protocol) change is flagged explicitly in the done-mail (@d6294b0c).

# roblox/ — SPEC (R1–R4)

Owner: roblox-helper (docs/10 §2 — this tree is its exclusive lane).
Scope: what exists after R1–R4 and the contracts it must keep. The
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

## 4. Verification (`check.sh` + Studio)

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
fixed setup is `0x0ca5d97c`.

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

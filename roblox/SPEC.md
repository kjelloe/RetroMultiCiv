# roblox/ — scaffold SPEC (R1)

Owner: roblox-helper (docs/10 §2 — this tree is its exclusive lane).
Scope: what exists after R1 and the contracts it must keep. The role
spec and lane rules live in `docs/10-roblox-agent.md`; the anchor
values in `docs/09-phase5-luau.md` §1. This file documents the
scaffold itself.

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

## 3a. Data converter (`data/build.js`, R2)

Per docs/10 §3, JS/JSON references cross into Roblox ONLY via this
converter — no number is ever hand-copied:

- `client/mock-state.json` → `data/generated/MockState.luau`
- `client/renderer/three/terrain.js` `TERRAIN` table →
  `data/generated/TerrainPalette.luau` (parsed textually — terrain.js
  imports three.js/`document`, so it can't be require()d in Node)

Contracts:

- Generated files are **committed** (rojo build must be green from a
  clean clone) and never hand-edited; regenerate with
  `node roblox/data/build.js`. `--check` diffs instead of writing —
  check.sh gate 4 fails on drift.
- Stored `x`/`y` stay **0-based** (docs/09 trap 1): only Luau-side
  table access adds `+1`, never the stored values or index arithmetic.
- The two demo cities are an R2 bake (the source mock has none):
  first non-ocean unoccupied neighbor of each player's settlers, fixed
  scan order, deterministic.

## 3b. Static renderer (`src/server/RenderWorld.server.luau`, R2)

Builds `workspace.World.{Terrain,Units,Cities}` at Play start from the
generated data. Render-only contracts:

- No engine calls, no randomness — palette shade picks are
  position-hashed (`(x*7 + y*13) % #palette`), so the scene is
  identical every run (screenshot-stable, the JS renderer's REST-POSE
  discipline).
- Scale: `TILE = 4` studs/tile edge, `HEIGHT = 6` studs per 1.0 of
  TERRAIN base+peak/2, columns extend `BASIN = 2` studs down.
- Owner color comes from the baked player table; units get an
  owner-colored base disc, cities an owner-colored plaza disc under a
  fixed block skyline. Prints one `[RenderWorld]` summary line.

## 3c. Camera + tile selection (`src/client/`, R3)

`Camera.client.luau` — Scriptable map camera, the character never
drives the view: RMB-drag orbit (yaw free, pitch clamped -85°…-15°),
WASD/arrow pan in the camera's ground plane (clamped to the map,
speed scales with zoom), wheel zoom (15–220 studs). Starts over the
western continent (tile 5,4). Pan input is ignored while a TextBox has
focus (the JS client's INPUT/TEXTAREA rule, ported).

`Select.client.luau` — click-to-select resolving to **logical tiles**
(A28's rule): raycast the click, then
`tile = clamp(round((hitPos - normal*0.05) / TILE))` — the pick comes
from the hit POSITION, never the hit body, so units, city blocks, and
mountain flanks all resolve to the tile they stand on (the normal
nudge keeps tall-column side hits on their own tile). One reusable
neon cursor Part (`CanQuery = false` so it never swallows the next
click) plus a `[Select] tile (x,y) terrain — contents` Output line per
pick: that line is the click-test evidence.

Both scripts read the baked `GameData` modules; `TILE = 4` must match
RenderWorld's scale (single-constant duplication accepted until a
shared Scale module is warranted).

## 4. Verification (`check.sh` + Studio)

`roblox/check.sh` is the headless self-test (runnable on any machine
with rojo; the suite-hookup twin on the dev PC is requested via the
architect):

1. `rojo build roblox` to a temp file succeeds.
2. The built place contains the mapped instances (`VerifyAnchors`,
   `RetroMultiCiv` under ServerScriptService, `Shared`,
   `RetroMultiCivClient`, `GameData`, `RenderWorld`, `MockState`,
   `TerrainPalette`).
3. The anchor literals in `VerifyAnchors.server.luau` match the
   canonical goldens in `test/rng.test.js` and `test/gamecode.test.js`
   (drift check — read-only consumption of `test/`).
4. `node data/build.js --check` — generated Luau data still matches
   its JS/JSON sources (skips if node is absent).

What check.sh cannot cover: Luau execution. The only executable proof
is Studio Play Solo output (docs/10 §4.2) — captured verbatim into the
done-note, screenshots read and described.

## 5. Status

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
- R3: code complete (§3c; `src/client` flipped to a required path) —
  open until the Studio screenshot + described click test land in the
  done-note.

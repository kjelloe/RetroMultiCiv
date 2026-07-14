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

| Repo path      | Place path                                             | Mode     |
|----------------|--------------------------------------------------------|----------|
| `../luau`      | `ReplicatedStorage.Shared`                             | optional |
| `src/server`   | `ServerScriptService.RetroMultiCiv`                    | required |
| `src/client`   | `StarterPlayer.StarterPlayerScripts.RetroMultiCivClient` | optional |

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

## 4. Verification (`check.sh` + Studio)

`roblox/check.sh` is the headless self-test (runnable on any machine
with rojo; the suite-hookup twin on the dev PC is requested via the
architect):

1. `rojo build roblox` to a temp file succeeds.
2. The built place contains the mapped instances (`VerifyAnchors`,
   `RetroMultiCiv` under ServerScriptService, `Shared`,
   `RetroMultiCivClient`).
3. The anchor literals in `VerifyAnchors.server.luau` match the
   canonical goldens in `test/rng.test.js` and `test/gamecode.test.js`
   (drift check — read-only consumption of `test/`).

What check.sh cannot cover: Luau execution. The only executable proof
is Studio Play Solo output (docs/10 §4.2) — captured verbatim into the
done-note, screenshots read and described.

## 5. Status

- R1: **DONE 2026-07-14** — all four anchors printed PASS in Studio
  Play Solo with `luau/` mapped and unmodified (including gamecode's
  relative string require, which the Studio VM resolves); rojo build
  and check.sh green.
- R2 (static world render) and R3 (camera/selection) are specified in
  `agent-workitems.md`; nothing for them exists here yet.

# RetroMultiCiv — Roblox place (roblox-helper's lane, docs/10)

Contracts and structure: `SPEC.md`. Headless self-test: `./check.sh`
(build + mapping + anchor-drift gates — run it before any done-note).

Rojo project mapping this tree plus the bugfixer's `../luau` port (read-only,
optional until it lands) into a Roblox place:

- `../luau` → `ReplicatedStorage.Shared` (engine/shared ModuleScripts)
- `src/server` → `ServerScriptService.RetroMultiCiv`
- `src/client` → `StarterPlayer.StarterPlayerScripts.RetroMultiCivClient`

## Build (CI-equivalent check)

From the repo root:

    rojo build roblox -o build.rbxlx

Must succeed from a clean clone. `build.rbxlx` is a throwaway artifact —
don't commit it.

## Live-sync into Studio

1. From the repo root: `rojo serve roblox` (listens on port 34872).
   Under WSL this is reachable from Windows Studio at `localhost:34872`
   (WSL2 forwards localhost automatically).
2. In Studio: install the Rojo plugin (Plugins → Manage Plugins, or from
   https://rojo.space/docs — match the plugin to Rojo 7.x), open any
   place (or the built `build.rbxlx`), click the Rojo plugin button,
   connect to `localhost:34872`.
3. Press Play (Play Solo). `VerifyAnchors.server.luau` prints the R1
   anchor gate to Output:
   - xorshift32(123456789) sequence
   - `hashState({b=2,a={1,"x",true}})` → `0x30db1e29`
   - gamecode `codeHi` → `0xa687b72d`, `gameCode` → `AD1X-Q5MR-DP7H9`
   Until `luau/` lands on this clone it prints `R1 gate PENDING` instead.

Expected values live in docs/09 §1 and are immutable — a "close" twin is
a wrong twin; report mismatches to the architect, never edit the gate.

# RetroMultiCiv — Roblox place (roblox-helper's lane, docs/10)

Contracts and structure: `SPEC.md`. Headless self-test: `./check.sh`
(build + mapping + anchor-drift gates — run it before any done-note).

Rojo project mapping this tree plus the bugfixer's `../luau` port (read-only,
optional until it lands) into a Roblox place:

- `../luau` → `ReplicatedStorage.Shared` (engine/shared ModuleScripts)
- `data/generated` → `ReplicatedStorage.GameData` (committed output of
  `node roblox/data/build.js` — regenerate after mock-state/terrain
  changes, never hand-edit)
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
   **WSL gotcha:** a serve run from the WSL `rojo` binary with the
   repo on `/mnt/c` never sees file changes (9p has no inotify) — live
   sync silently goes stale (tell-tale: script line numbers in Output
   stop matching the files on disk). Run the NATIVE Windows binary
   instead — it watches NTFS directly, so WSL-side edits sync live.
   From PowerShell:

       C:\GIT\rojo\rojo.exe serve C:\GIT\RetroMultiCiv\roblox

   or equivalently from a WSL shell in the repo root (Windows-exe
   interop; same native watcher):

       /mnt/c/GIT/rojo/rojo.exe serve roblox

   (The WSL `rojo` stays for `rojo build`/check.sh, which don't watch.)
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
   `GameServer.server.luau` boots next: `data gate: 8/8` (baked
   rulesets hash-verified) then `[R4INIT] … initialHash=0x0ca5d97c`
   for the fixed acceptance setup.
4. Controls in Play: WASD/arrows move the avatar; hold LMB and drag
   to orbit, hold RMB and drag to pan (grab-the-map), Q/E moves the
   camera down/up, wheel zooms, F toggles follow-avatar; a plain LMB
   click (no drag) picks the logical tile (yellow cursor; clicking
   your own unit selects it — cyan cursor).
5. Playing: the place boots GAMELESS (R9) — you spawn on the
   observation deck in the sky. The START A NEW GAME pad makes you
   host (60s window: map size / civs / human seats, then START GAME
   → 30s countdown); JOIN GAME claims a seat while it counts; TAKE
   OVER AI CIV (during a game) seats you into a random vacant seat.
   Vacant seats play themselves (regent AI); admins can kick; chat
   is disabled by design. RESUME: the host's GET RESUME CODE button
   saves under the game code (DataStore); type a code into the idle
   lobby panel to resume it — public servers autosave and end 120s
   after the last human leaves. In a game:
   click your settlers, `B` founds a city; click an adjacent tile to
   move the selected unit; `Return` or the End Turn button ends your
   turn (the AI round advances visibly). Click an own city for the
   city panel (production picker + Buy). `P` TOGGLES ride/dismount on
   the selected unit (avatar rides it, WASD/arrows step it one tile
   per press — map-absolute, W=N), `N` jumps to the next unit with
   moves (mounted: jumps the ride; on foot: selection + camera only),
   `F` dismounts. R6 surfaces: the bottom action bar (Found `B`, Fortify
   `G`, Wait `Space`, Disband `X`, Irrigate `I`, Mine `M`, Road `R` —
   buttons grey AND go dead when the action doesn't apply), Research
   `T` in the top-center cluster, the turn log
   (`L` toggles, bottom left, counts unseen entries while closed),
   the research picker with tax/lux steppers (`T`; auto-opens when
   research is unset), and green/red move hints around the selected
   unit (legal steps / attacks). R7a flow: auto-next-unit and
   auto-end-turn are ON by default (top-right toggles); `N` and
   auto-advance pick the NEAREST idle unit and skip fortified/working
   ones; double-click one of your units while riding to jump the
   mount to it. R7b presentation: unit billboards (name, att/def,
   move pips; settlers add a 1-3 star site rating), a discovery
   splash + blinking Research button when a pick is due, and the
   void cover — `V` cycles the border art (ornate map frame /
   galaxy / none) so you can screenshot both and pick. R7d: hover an
   adjacent enemy with a unit selected for the combat odds billboard;
   `C` opens the city list (tap a row to fly there), `J` the
   statistics panel; the HUD shows the game verification code
   (selectable); End Turn goes green when everything moved and asks
   twice ("N can move!") if you end early. R8: unit models now build
   from the shared asset recipes (same silhouettes as the browser);
   `K` toggles the floating gallery grid — every recipe in BOTH cone
   variants (fan | stack) plus city and props — screenshot it for the
   cone-fidelity pick (in Studio the left-edge DEBUG button toggles
   it too). R12: the top-center cluster adds a Government button
   (rate steppers live in its panel now, not the research picker) and
   a live research-status line; unit billboards are big and bold;
   city billboards (name, pop, production, ~turns) are always on;
   the avatar spawns on your settler from turn 1. `O` arms GoTo on
   the selected unit (click a destination; it marches a real
   least-cost route, re-planning as fog lifts; purple breadcrumbs
   show the line). While riding, 8 click-pads around the mount move
   it (the only 8-direction ride input; auto-on without a keyboard,
   the PAD button or the options row toggles). The city panel now
   sells buildings (two-step confirm, one per city per turn, price =
   cost x ratio; the Palace never sells) and every building/wonder
   row explains its effect in plain language. The server prints
   `[R4INIT]`/`[R4LOG]`/`[R4CODE]` —
   copy the whole Output into `roblox/acceptance/<run>.txt` and
   verify with `node roblox/acceptance/assemble.js <that file>`
   (SPEC.md §5).

Expected values live in docs/09 §1 and are immutable — a "close" twin is
a wrong twin; report mismatches to the architect, never edit the gate.

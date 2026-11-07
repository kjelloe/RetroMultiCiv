# Luau / lune catch-up plan — 2026-10-30

For a lane with `lune` (the roblox-helper, the sim-runner, or a reviewer
clone) catching up from the last verified Luau state to `dev_night` tip.

## Where things stand

| | Commit | Date | State |
|---|---|---|---|
| Last twins gate green | `d32f12d` | 2026-08-05 | twins 11/11, scenarios 70/70, simulation 7/7 (production-switch window) |
| Last `roblox/` commit | `40d6cd2` | 2026-08-05 | screenshot + F2 label filing |
| Tip | `e612651` (+ this sync commit) | 2026-10-30 | twins gate NOT run: `lune` is absent on the dev PC |

Between `d32f12d` and tip, the only change to `engine/`, `luau/`,
`data/*.json` or `test/scenarios/` is ONE line in `e612651`:
`ageChanged: true` added to `WORLD_NEWS` in `engine/visibility.js` and
`luau/visibility.luau` (view-only: the world-age event now survives
`filterView` for every seat; state and hashes untouched). No golden re-record
is expected.

## Step 1 — verify the twins (sim-runner or any lune box)

```
git pull origin dev_night
lune --version
node --test test/luau-twins.test.js test/visibility.test.js
```

Expected: luau-twins 11/11 (no skips), visibility green including the
"ageChanged is world news" fixture. Then the full Luau goldens as
a detached job (long run; `debugging/job.sh run`):

```
debugging/job.sh run luau-golden -- lune run luau/sim-smoke.luau 400
debugging/job.sh run luau-natural -- lune run luau/sim-smoke.luau natural
```

Both must print the pinned GOLDEN_SOAK / GOLDEN_NATURAL hashes from
`test/simulation.test.js` unchanged. Any mismatch is a blocker: mail
`coordinator` (tag `blocked`) with the first divergent checkpoint.

**[done 2026-10-30, dev PC, lune 0.10.5 at marker-0133 `8c62aaa`]:**
luau-twins + visibility 29/29, no skips. `sim-smoke.luau 400`:
checkpoints 0xb176b92a / 0xee94526b / 0xc071aa36 / 0x7fee3918, behavior
0x18b4976c, all equal to the pins. `sim-smoke.luau natural`: 545 rounds,
winner p2, 0x0877dae9, behavior 0x42fb3338, all equal. P4 (bankruptcy)
followed on top of this and re-records; see its commit.

## Step 2 — roblox-helper queue (`workitems-roblox.md`)

Items 1–5 (queued 2026-08-08..11) are all still open; items 8 (the `buildingSold` turn-log line, P4) and 9 (re-bake the rulesets for P3's `nukeDoctrine`) were added after this plan:

1. G0 re-mirror — Horse rework + desert palette (TileProps)
2. H1 animal reworks — deer/seal/fish (pair with 1)
3. city-era twin — `roadStageFor` + `annotateCityEra` viewer param
4. Encyclopedia rename (five-minute swap)
5. TileProps road/rail sync to H13+H13b (pair with 3)

New since then (added to the same file as items 6–7):

6. **Server door validation (fe-R13/R2 twin) — P1.** `GameServer`
   copies every field of a client `cmd` into the engine call unchecked.
   Two holes the browser server closed in `e612651`:
   - a client can send `type = "claimSeat"` (a server-only command;
     browser list: `SERVER_ONLY_COMMANDS` in `server/protocol.js`);
   - any non-ASCII, control-char or over-long string (city name, etc.)
     enters game state, which `statehash` refuses — the browser server
     died on this (exit 70) before the fix.
   Port `shared/state-string.js` (`isStateString`, `onlyStateStrings`;
   the fold helper is client-side only) as a `shared/` twin, reject
   `claimSeat` and any cmd that fails `onlyStateStrings` with
   `badShape` before `engine.applyCommand`, and cap `cmd.name` at 24.
   Reference tests: `test/server-door-validation.test.js`.
7. **`ageChanged` now reaches Roblox clients.** The event (`{age,
   turn}`, the world's age, no player) was dropped by `filterView`
   for every seat until `e612651`. The Roblox server loads `../luau`
   directly, so it now arrives with no Roblox code change.
   `TurnLog.client.luau:336` already formats it as `[world]`; confirm in
   Studio that it shows once per age, and that any age interstitial
   keyed on it (browser: `client/ui/historian.js`, R12) is either wired
   or deliberately absent.

## Step 3 — optional UI-parity review (docs/13)

`e612651` fixed several browser UI defects. The Roblox client may share
some; check each against its Roblox counterpart and file only real
gaps as new items. Per-item detail: `specs/fastengine-requests.md`
"Client batch".

- envoy offer re-pops after Accept (`client/ui/diplomacy.js` `answer`)
- pedia terrain entries never opened / blank rows
- tech-tree Back must return to the research list
- end screen with no winner (`noVerdict`)
- capital tooltip lingering on non-capitals
- wonder mood effects listed in the city happiness breakdown
- tech-glyph `dots` motif (the browser now matches Roblox — no work)

## Not needed

- Protocol version / compression / wss / native downloads / save
  headers / `--saves-dir`: browser-server only, no Roblox equivalent.
- No data re-bake: `data/*.json` unchanged since `ae21749`.

## Status 2026-11-01

Step 1 done (2026-10-30). Step 2: Roblox items 1-6, 8, 9 landed headless
in `1666b33` (harnesses green, no Studio); item 7 and the visual checks
wait for the user's Studio session. A116 (2026-11-01) renamed the
Luau door function to `onlyStateValues` (twin of the JS command rule).
Step 3 done 2026-11-01 (Sonnet agent, verified here): one Roblox
fix — EndScreen headline falls back to "leading civilization" when no
winner is recorded (it printed "the nil"). The rest have no Roblox
counterpart or no defect: envoy offers (the Roblox diplomacy panel is
read-only; treaty actions are a later slice), pedia terrain (already
listed + opens from the pair), tech-tree Back (one Close button), capital
tooltip (none), wonder mood lines (CityPanel has no happiness breakdown —
adding one is new UI, a design call).

## Status 2026-11-02

A117 changed three Luau twins with their JS sides in one window:
`luau/combat.luau` (an interception sets the city's `sdiRevealed`;
scenario 066 re-pinned 0xc58e8967), `luau/ai.luau` (`nukeTarget` ranks
revealed-SDI cities last), `luau/visibility.luau` (`filterView` copies
`difficulty`). Twins gate 11/11 green after it. Roblox item 10 (city
happiness breakdown, user ruling) landed headless with
`roblox/selftest/city-mood-parity.mjs` as check.sh gate 32; it closes the
"wonder mood lines" note above. Studio look pending with item 7.

2026-11-07 (A118): `luau/visibility.luau` `filterView` also copies each
player's `civ` (twin of engine/visibility.js; lune-checked). Views are not
hashed. Roblox TurnLog diplomacy rows read `view.players[you].civ`, so
party rows now show detail instead of the world headline (Studio look).

## Close-out

Record completions in `workitems-roblox.md` as `[done: date — note +
sha]`. Twins result goes into the next marker report.

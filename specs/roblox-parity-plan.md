# Roblox client: parity and verification plan

Revision 2, 2026-11-16 (revision 1: 2026-11-15). Lane: roblox-helper
(`roblox/` only). Gap list: `roblox/PARITY.md` (generated, gate 51).
Everything here is gamesim-golden-neutral: client work over commands the
engine port already accepts.

## 1. State

- 205 browser features: 141 available, 24 partial, 25 missing, 15 n/a
  (revision 1 started at 115 / 37 / 39).
- 18 scenarios: 11 playable, 3 degraded, 4 blocked (started at 6 / 2 / 10).
- 65 gates. Four regent games replayed hash-exact. The latest, session
  2026-11-16 14:51Z: 546 turns, 0 errors, 0 diagnostics failures, tour 20
  of 20.
- Built under revision 1: step 0 (tour, `after-run.js`, top-row pins),
  1.0 (seven difficulty levels), 1 (city screen), 2 (empire overview),
  3 (unit orders), 8.1 (badge rules), discovery splash, `BarFit`.
  Details: section 7.

## 2. Review of revision 1

What held:
- One command after a run (`after-run.js`) and a tour that needs no
  clicking. Every session since has been read from the log.
- Rules in pure modules checked against the engine. Each of steps 1-3
  found a live defect that way before any Studio run: `playerIncome` on
  the raw view blanked the gold chip from mid-game; the Road button never
  sent `railroad`; every game ran as prince.

What did not hold:
1. **The tour opens surfaces and presses nothing.** Every full game was
   played by the regent. So no button added in steps 1-3 has been pressed
   in Studio by anyone: specialists, previous city, Disband confirm, Cancel
   route, Help Wonder, the tile labels, the chart chips. Their rules are
   checked headless; their wiring is held only by text pins in `check.sh`.
2. **"Done" required the user to have seen each stop.** No step met it, so
   "Not seen in Studio" grew with every step instead of shrinking.
3. **The order followed where time is spent, not what is blocked.** Three
   of the six blocked scenarios are blocked by one small item each (S04,
   S12, S18) and were queued behind larger work.
4. **Width was only ever tested at the window the user happened to have.**
   The bar overlap at 1,222 px was found by accident. The bar and the top
   row are now pinned across widths; panels are pinned for fit but not for
   overlap with each other.
5. **Parity rows the platform already answers still read "missing"**
   (skip vote), which keeps S17 blocked on paper.

## 3. Design changes

**A. Action stops in the tour (closes 1 and 2).** After the panel stops,
the tour drives the client the way a hand would and judges each result:
1. it stages the case with logged commands (`spawnUnit` takes a tile, so
   Settlers go on a swamp and on a roaded tile, a Caravan into a city set
   to build a wonder, a Diplomat beside a rival city);
2. it selects the unit or opens the panel, reads the button as drawn
   (text, enabled, present) and compares it with the rule module's answer
   for the same view - a mismatch is a wiring fault;
3. it presses through the same function the click calls, waits for the
   server's reply, and checks the effect in the next view (unit gone,
   specialist count changed, wonder shields up, route dots present);
4. it prints `[RMC-TOUR] act 07/24 disband-confirm PASS` or `FAIL <what>`.
The action list and the judging function are data in `TourPlan` and pinned
headless; the script only performs. Each surface exposes its controls
through one registration (`ClientState.registerControls(id, read, press)`),
so the tour never reaches into another script's instances.

**B. Two kinds of done (closes 2).**
- *Verified*: rule pinned headless, panel stop PASS, action stop PASS,
  parity row flipped, gates green. This is what a step needs.
- *Looked at*: the user's eye, once per milestone, not per step. A
  milestone is a tour run plus the shots in `PLAYTHROUGH-UI.md` section D.
"Not seen in Studio" is dropped as a per-item status; the plan carries one
list of what the last look covered.

**C. Order by blocked scenarios, cheapest first (closes 3).** See
section 4.

**D. Width without a phone (narrows 4).** A headless check places every
docked panel, the top row, the bottom bar and the corner buttons at 667,
844, 1,280 and 1,920 px and fails on any shared pixel. Run B (device
emulator) is then a look, not a hunt.

**E. Parity list review (closes 5).** Rows the platform answers go to n/a
with the user's ruling; a weighted score per scenario (share of steps
available) is printed beside the verdict, so a scenario with one small gap
no longer reads the same as one with nothing.

## 4. Order

Each step ends with gates green and a local commit. A step that adds a
control adds its action stop and its parity row in the same commit.

### R1: tour action stops
1.1 `registerControls` on the action bar, city panel, Cities list,
    Statistics; `TourPlan.ACTIONS` + `judge`, pinned headless.
1.2 Stops for what steps 1-3 built: tile labels (swamp, forest, roaded
    tile with Railroad), greyed-order reason, Disband first and second
    press, GoTo route and Cancel route, Help Wonder, + Tax / + Sci /
    Reset, previous / next city, Economy net equal to the gold chip, each
    chart chip.
1.3 `after-run.js` prints the action results next to the panel stops.
Result: the "pressed by nobody" list in `workitems-roblox.md` 20 is empty
after one tour run.

### R2: three blocked scenarios, one item each
2.1 Settler automation priority: Balanced / Food / Shield / Trade (uo-15,
    S04). `SettlerAuto` is client-side; twin of `client/ui/automate.js`,
    its choice rule in a pure module checked against the browser's table.
2.2 Encyclopedia search (info-04, S12).
2.3 Options: sound effects switch and volume (opt-11, opt-12, S18);
    minimap switch (opt-16) rides along.
Result: 4 blocked becomes 1 (S07).

### R3: diplomats (S07)
3.1 Six missions with a target pick; the gold cost shown before
    confirming. Rule module checked against `luau/diplomat-missions`.
    Action stops with the staged Diplomat.
Result: 4 blocked becomes 0 after R2 and R3 (S11 and S17 closed by the
rulings of 2026-11-16).

### R4: degraded scenarios
4.1 Cities row: specialists (ov-01, S10).
4.2 Build queue reorder (city-14, S03).
4.3 Replay theater: play / pause and speed (gf-24, S15).
4.4 DONE 2026-11-16: large / xlarge / huge maps offered (ruling 5).
Result: 3 degraded becomes 0.

### R5: phone
5.1 The width check of design D.
5.2 Run B in the device emulator; narrow layouts for what it shows.
5.3 Touch: long-press shows the card, tap picks; long-press GoTo (uo-21).

### R6: comfort
6.1 Wonder-complete card (info-18); civilization card at game start
    (info-19).
6.2 Production keys and build cycling (city-20, city-21); fly to the
    capital (map-06).
6.3 Event banner with a zoom button (hud-11); your-turn banner and its
    mute (opt-07).
6.4 Remaining options: slow GoTo, reduce animation (opt-04, opt-08).

### R7: housekeeping
7.1 Split the four scripts over 750 lines along their seams (`ActionBar`
    887, `CityPanel` 943, `Lobby` 863, `ViewRenderer` 851); `GameServer`
    (2,042) by the same rule.
7.2 Weighted scenario score in the parity report (design E).
7.3 A second list for Roblox-only features (ride a unit, start deck,
    gallery, tour).
7.4 Diplomacy and Options panels in the card style.

### R8: badges
8.3 DONE 2026-11-17 (gate 64): `BadgeTrack` (pure, per seated user),
    `BadgeAward` (`BadgeService:AwardBadge` once per user per badge, in its
    own thread, failures as `[RMC-DIAG]`, no call in Studio), `BadgeIds`
    (all 0). Earned keys print as `[RMC-BADGE]` and in `after-run.js`.
8.4 USER: create the 50 badges on the Creator Hub (names and texts:
    `BadgeRules.BADGES`) and paste the ids into `BadgeIds.luau`. Check the
    creation fee and the daily free allowance there first. Awards happen
    only in a published place.

## 5. Manual runs

| run | what the user does | when |
|---|---|---|
| A. Tour | Play, start the default game, found the capital, Debug > Run UI tour | after each of R1-R4 |
| C. Regent game | hand the seat to the AI, leave it to the end | with run A, same session |
| B. Phone | run A with the device emulator set to a phone | once, in R5 |
| D. Two players | Studio local server with 2 players, 5 minutes | once per milestone |
| Look | read the tour's stops by eye, save the section D shots | once per milestone |

After any run: `node roblox/tools/after-run.js`.

## 6. Rulings (user, 2026-11-16)

1. Diplomacy actions: build if the browser client has them. It has; BUILT
   the same day (gate 63, `DiplomacyView` + `Diplomacy.client`): accept /
   reject, offer peace, declare war, Propose (peace / tribute / tech swap),
   envoy card. S11 playable.
2. Skip vote: not applicable (mp-15 n/a). S17 playable.
3. Badges (ruled 2026-11-17): milestones count whoever played the turn;
   victory badges need the user to have ended at least half the turns;
   a game with a debug command used earns nothing; only the user in the
   winning seat wins. BUILT (R8.3). A resumed save counts from turn 1.
4. Statistics charts: same as the browser (rivals shown during play).
5. Large / xlarge / huge maps: offered with a latency label. BUILT (gf-34
   yes, S01 playable). No game on them has been run.

## 7. Built under revision 1

- **Step 0, harness.** `UiTour` + `TourPlan` (gate 52, 20 panel stops),
  `after-run.js` (gate 53), `TopRowPlan` (gate 54), gate 55 (no top-level
  local read above its declaration). Run A found that no Studio game was
  ever debug-enabled (`debug` passed inside `options`); fixed. The tour
  refuses to start while the regent holds the seat; discovery splashes are
  off while it runs.
- **Step 1.0, difficulty** (gate 58). Seven engine levels offered and
  passed to `createGame`; before, every game ran as prince. `[R4INIT]`
  and saves carry `levels=7`. Seen: godemperor and prince games, both
  replayed hash-exact.
- **Step 1, city screen** (gate 59, `CityView`). Specialists, previous /
  next city, food and growth line, capital mark (follows `capitalOf`),
  disorder in the subtitle, trade route list.
- **Step 2, empire overview** (gate 60, `EmpireView`). Economy tab with
  the net equal to `playerIncome` for every civ of a real 120-turn game;
  yields, gold, science and upkeep per Cities row; Score / Population /
  Cities / Techs chart chips. Income readers use the own-cities shim.
- **Step 3, unit orders** (gate 62, `UnitOrders`). Help Wonder, route
  dots and Cancel route, tile-following labels, reason cards on greyed
  orders, Disband confirm; settlers rules checked against
  `improvements.startWork` over 1,408 cases. The browser has no Rehome
  order.
- **`BarFit`** (gate 61): the bottom bar takes its own strip above the
  corner buttons when it can not fit between them.
- **Discovery splash** (gate 57). **Badge rules** (gate 56): 50 badges as
  data plus the earning function; nothing awarded yet.
- **Treaty actions** (gate 63) and the three big map sizes: section 6.
- **Camera**: F (follow-avatar) ignored while a walk key is held (gate 46
  pin).

Sessions: `workitems-roblox.md` 19z-19zg.

## 8. Not in this plan

- Encyclopedia pictures and the wonder scene: their own track,
  `specs/roblox-pedia-art.md` (2026-11-18, P0-P6). P3 uses R1's action
  stops.

- Hotseat, save files, join codes: the platform covers each (n/a rows).
- Any change under `luau/` or `engine/`. Two findings for those lanes are
  in `workitems-roblox.md` 20 (regent refusals, late turn time) and
  printed by `after-run.js` per run.
- In-client bug report (dbg-04), nuclear weapons switch (gf-38), replay
  event feed (gf-25), end-game moment (gf-18): not scheduled; they block
  no scenario.

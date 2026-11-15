# Roblox client: parity and verification plan (2026-11-15)

Lane: roblox-helper (`roblox/` only). Source of the gap list:
`roblox/PARITY.md` (generated, gate 51). All items are
gamesim-golden-neutral: client work over commands the engine port already
accepts (`diplomatMission`, `helpWonder`, `rehome`, `setWorkers` with
`taxmen` / `scientists`, `diplomacy`; `tech.playerIncome` /
`cityEconOutput` are exported).

## 1. State

- 205 browser features: 115 available, 37 partial, 39 missing, 14 n/a.
  Statuses are read from the sources, not from play.
- About 20 builds have not been seen in Studio (tech tree graph,
  civilization gallery, Cities / Government / Research / City / Statistics /
  Military / Legend / Turn log panels, host setup cards, slope corner
  fills, bare hills, catalog hover cards, top-row buttons).
- Three regent games replayed hash-exact, 0 errors.
- The cost that limits progress is manual Studio time, not build time.

## 2. Design: fewer manual runs

Three levels, cheapest first. A case goes to the lowest level that can
decide it.

**Level 1, headless (no Studio).** Rules and layout in pure modules with
lune pins, as now (`CatalogInfo`, `StatsView`, `MilitaryView`,
`TurnLogView`, `LegendData`, `TechTreeLayout`, `DockLayout`). Added by this
plan:
- top-row and panel plans pinned at four viewport widths (667, 844, 1280,
  1920), so a row that no longer fits fails before anyone opens Studio;
- every new feature's rule in a pure module first.

**Level 2, self-checking tour (one Play, no clicking).** A debug-only
client script, started from the Debug menu ("Run UI tour"):
1. stages the game with debug commands (they are ordinary logged commands,
   so the run still replays): reveal the map, grant gold, grant techs, add
   a caravan, a diplomat, a ship, a second city, raise a city to
   population 5;
2. walks a fixed list of stops; at each stop it opens one surface, waits
   for it to settle, runs the DiagAudit checks on it (off-screen, overlap,
   clipped text, text under 14 px, empty list, missing heading / close X),
   and for hover cards shows the card and checks it has text;
3. prints one line per stop: `[RMC-TOUR] 07/32 statistics PASS` or
   `FAIL <what>`, and a summary line;
4. shows a caption ("Tour 07/32 Statistics") and holds each stop 1.5 s, so
   one screen recording, or a glance, covers the look of every surface.

`node roblox/tools/after-run.js` (new) reads the Studio log and prints one
report: diagnostics, tour results, refused commands by reason, seconds per
turn, and the acceptance replay verdict. One command after every run.

**Level 3, eyes.** Only what a check cannot judge: does it look right.
The tour's captions make that a pass over ~30 stops instead of a hunt.

### Manual runs needed

| run | what the user does | covers |
|---|---|---|
| A. Tour, desktop | Play, start the default game, Debug > Run UI tour (about 3 min, hands off) | every panel, button, hover card, staged city / unit states |
| B. Tour, phone | the same with Studio's device emulator set to a phone | narrow layouts, touch sizes |
| C. Regent game | Play, start, hand the seat to the AI, leave | engine parity (replay), sounds, turn log, end screen, statistics over a full game |
| D. Two players | Studio local server with 2 players, 5 minutes | civilization pick contention, wait line, spectate |

A and C can be one session: run the tour, then hand over to the regent.
B and D are needed once per milestone, not per change.

## 3. Order

Each step ends with gates green and a local commit. A step that adds a
surface adds its tour stop and its parity row in the same commit.

### Step 0: the harness (before any feature)
0.1 `UiTour` script + Debug menu entry + `[RMC-TOUR]` lines; stops for
    every surface that exists today.
0.2 `roblox/tools/after-run.js`.
0.3 Viewport-width pins for the top row and the panel fit.
0.4 Run A + C once. Fix what they show. This clears the unseen backlog.

### Step 1: the city screen (scenario S03; most time is spent here)
1.1 Specialist buttons (entertainer to taxman / scientist) and reset.
1.2 Previous city next to "next city".
1.3 Growth line: food box, surplus, turns to grow; starving warning.
1.4 Capital mark on the title; trade routes as a list.
Tour: staged population-5 city; stops for each.

### Step 2: knowing your empire (S10; the user's statistics request)
2.1 Economy overview: income per city, building costs, net per turn equal
    to the gold chip (pinned headless against `playerIncome`).
2.2 Statistics: Population, Cities and Techs charts beside Score (the
    server already samples every turn; extend the sample).
2.3 Cities list columns: yields and upkeep.

### Step 3: orders that are missing (S05, S06, S04)
3.1 Help Wonder for a caravan in a city building a wonder.
3.2 GoTo route line on the map; Cancel route button.
3.3 Order labels that follow the tile: Clear / Drain, Plant, Railroad;
    the reason on a greyed order's hover card.
3.4 Disband asks once more.
3.5 Check whether the browser offers Rehome; if so add it.

### Step 4: phone (run B)
4.1 Narrow layouts for the panels the tour reports as cut.
4.2 Top row on a phone: icons only.
4.3 Touch: long-press shows the card, tap picks (replaces the 0.5 s
    pick-and-close).

### Step 5: finding things and comfort (S12, S18)
5.1 Encyclopedia search.
5.2 Options: sound effects switch and volume, minimap switch.
5.3 Settler automation priority.
5.4 Wonder-complete card; a card for your civilization at game start.

### Step 6: diplomats (S07)
6.1 Six missions with a target pick, gold cost shown before confirming.
Needs a staged diplomat beside a rival city in the tour.

### Step 7: housekeeping
7.1 Split the four scripts over 750 lines along their seams (`ActionBar`,
    `Lobby`, `CityPanel`, `ViewRenderer`).
7.2 Parity report: a weighted scenario score (share of steps available)
    beside the playable / blocked verdict.
7.3 A second list for Roblox-only features (ride a unit, start deck,
    gallery), so the report shows both directions.
7.4 Diplomacy and Options panels in the card style.

## 4. Omissions and how each is closed

| omission | closed by |
|---|---|
| ~20 builds never seen | step 0.4 |
| statuses read from code, not play | tour stops assert each "yes" surface opens and is not empty (0.1) |
| no phone test | 0.3 headless, then run B (step 4) |
| five-button top row on narrow screens | 0.3 pin, 4.2 |
| scenario verdict too coarse | 7.2 |
| parity list one-directional | 7.3 |
| Rehome unknown | 3.5 |
| large scripts | 7.1 |
| engine-lane findings (regent refusals 3,184 of 27,254; turn time to 3.5 s) only in the work-items file | `after-run.js` prints both per run (0.2); mailed when the hub is back |

## 5. Not in this plan

- Diplomacy actions (declare war, peace, deals, envoy popup): ruled
  post-1.0 in docs/13; needs a user ruling.
- Skip vote, hotseat, save files, join codes: the platform covers each.
- Any change under `luau/` or `engine/`.
- More restyling before step 0.4 has been run.

## 6. Done means

A step is done when: its rules are pinned headless, its tour stop reports
PASS in a run, its parity row is flipped with evidence, `check.sh` is
green, and the user has seen the stop once.

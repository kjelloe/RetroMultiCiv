# RetroMultiCiv — Game Specification

A standalone browser strategy game implementing the core mechanics of *Sid Meier's
Civilization* (1991). Scope for v1: the full core loop (map, cities, units, combat),
the complete Civ 1 technology tree, wonders, and a simplified government system.
Diplomacy, caravans/trade routes, and the spaceship endgame are specified as later
phases (see `03-roadmap.md`).

> **Data fidelity note:** Numeric tables in this document are Civ 1 defaults;
> they live in JSON data files (`data/`), not in code. `tools/wiki2data.js` has
> extracted the authoritative tables from the local wikiteam dump of the
> Civilization Fandom wiki into `data/wiki-extract/` (7/7 key pages: 28 units,
> 74 advance rows, 21 wonders, 21 buildings, terrain with yields). Extraction
> **confirmed** this spec's terrain yields/defense multipliers and unit roster.
> When authoring the final `data/*.json`, the wiki extraction wins over any
> table below. The mechanics/formulas are the contract; the numbers are tuning.

---

## 1. Game overview

- Turn-based 4X strategy on a 2D tile map.
- 2–7 civilizations (human and/or AI) plus barbarians.
- Game starts in 4000 BC. Each turn advances the calendar in shrinking steps
  (50 yrs/turn to 1000 BC, 25 to 1 AD, 20 to 1000 AD, 10 to 1500, 5 to 1850,
  then 2 — `data/rules.json` `yearSteps`). Default end year 2100 AD ≈ turn 396.
- **Victory conditions (v1):**
  1. **Conquest** — eliminate all rival civilizations.
  2. **Score** — highest civilization score at the end year (population, techs,
     wonders, happiness).
  3. *(Phase 6+)* Space race — first spaceship to reach Alpha Centauri.

## 2. Turn structure

Each game turn processes players in fixed order. A player's turn:

1. **Upkeep** — collect taxes, pay building maintenance and unit support, apply
   science, process city growth/starvation, complete production.
2. **Orders** — the player moves units, issues city orders (change production,
   buy, assign worked tiles), triggers combat by moving onto enemies.
3. **End turn** — hand off to the next player; after the last player, advance the
   calendar, run barbarian spawning and AI civs.

The whole simulation is deterministic: same initial seed + same command sequence
⇒ same state (this is a hard requirement, see `02-architecture.md`).

## 3. World map

- Rectangular tile grid, default **80 × 50** (Civ 1 size). Wraps east–west
  (cylinder); polar rows are impassable Arctic.
- Generated from a seed: continents/islands via noise or plate-blob growth,
  then climate bands assign terrain, then rivers and special resources.
- **Fog of war:** tiles are `unknown` → `explored` (terrain remembered, contents
  stale) → `visible` (within a friendly unit's/city's sight radius).
  What a rival city reveals on explored ground: its name, owner, size, and
  walls — never its production, food box, worked tiles, or mood. Rival
  units are seen only while inside your sight radius.

### 3.1 Terrain types

| Terrain   | Food | Shields | Trade | Move cost | Defense | Notes |
|-----------|------|---------|-------|-----------|---------|-------|
| Grassland | 2    | 0–1     | 0     | 1         | ×1.0    | Half of grassland tiles carry a "shield" bonus (deterministic pattern) |
| Plains    | 1    | 1       | 0     | 1         | ×1.0    | |
| Forest    | 1    | 2       | 0     | 2         | ×1.5    | Can be cleared to Plains |
| Hills     | 1    | 0       | 0     | 2         | ×2.0    | Mine: +3 shields (wiki-verified) |
| Mountains | 0    | 1       | 0     | 3         | ×3.0    | |
| Desert    | 0    | 1       | 0     | 1         | ×1.0    | Irrigable |
| Tundra    | 1    | 0       | 0     | 1         | ×1.0    | |
| Arctic    | 0    | 0       | 0     | 2         | ×1.0    | |
| Swamp     | 1    | 0       | 0     | 2         | ×1.5    | Can be drained |
| Jungle    | 1    | 0       | 0     | 2         | ×1.5    | Can be cleared |
| River     | 2    | 0       | 1     | 1         | ×1.5    | Stored as a `river` flag on the tile, not a terrain type: a Civ 1 "River" tile = Grassland + river flag (+1 trade, defense ×1.5). The flag model keeps Civ 1 behavior while allowing rivers over other terrain later |
| Ocean     | 1    | 0       | 2     | 1 (naval) | ×1.0    | Land units only aboard transports |

Special resources (one per terrain type, sparse deterministic placement) boost
yields on their tile, e.g. Oasis (Desert +3 food), Coal (Hills +2 shields),
Gems (Jungle +4 trade), Gold (Mountains +6 trade), Fish (Ocean +1 food),
Horses (Plains), Oil (Swamp), Game (Tundra), Seals (Arctic). Exact list/values
from the wiki into `data/terrain.json`.

### 3.2 Tile improvements (built by Settlers)

| Improvement | Effect | Requires |
|---|---|---|
| Road       | Move cost ⅓ along road; +1 trade on Grassland/Plains/Desert | — |
| Railroad   | Free movement along rail; +50% shields on tile | Railroad tech; road first |
| Irrigation | +1 food (Desert/Grassland/Hills/Plains/River) | Adjacent water/irrigation |
| Mine       | +shields (Hills +3, Mountains +1, Desert +1) | — |
| Fortress   | Units inside defend ×2 | Construction tech |
| Clear/Drain| Forest→Plains, Jungle/Swamp→Grassland | — |

## 4. Cities

### 4.1 Founding & working tiles

- A **Settlers** unit founds a city on a land tile (consumed).
- A city of population *P* works its center tile (always, for free) plus up to *P*
  additional tiles inside its **21-tile fat cross** (5×5 minus corners).
- Citizens not working tiles are **specialists**: Entertainer (+2 luxuries),
  Taxman (+2 gold), Scientist (+2 science) — Taxman/Scientist unlock at pop ≥ 5.

### 4.2 Growth

- Each citizen eats **2 food/turn**; the city's food surplus is
  `(worked-tile food) − 2 × P − settlerSupport`.
- Food box: the city stores surplus food; when stored food ≥ `10 × (P + 1)`
  the city grows to *P+1* and the box empties (Granary: box only half-empties).
- Food deficit: box drains; at 0 the population shrinks by 1 (starvation).
- Growth beyond pop 10 requires an Aqueduct.

### 4.3 Production

- Worked shields accumulate toward the current build item (unit, building, wonder).
- Changing production category (unit↔building) forfeits half the accumulated
  shields (Civ 1 rule; tuneable).
- **Buy:** remaining shields can be purchased with gold (cost ≈ 2 gold/shield,
  higher for wonders).
- Unit support: each city supports a number of its units for free (government
  dependent); each additional unit costs 1 shield/turn from the home city.
  Settlers additionally eat 1 food/turn (2 under later governments).

### 4.4 Happiness & disorder

Each citizen is happy, content, or unhappy. Base contentment depends on
difficulty and city size; luxuries (2 luxuries = 1 content→happy step),
Temples/Colosseums/Cathedrals, and wonders adjust it. Military units in city can
enforce content under despotic governments; units abroad cause unhappiness under
Republic/Democracy.

- **Civil disorder:** unhappy > happy ⇒ city produces nothing (no shields, taxes,
  science) until resolved.
- **We Love the King Day:** happy ≥ half and no unhappy ⇒ celebration bonus.

### 4.5 Trade, tax rates, corruption

- Trade arrows from worked tiles are split by the civilization-wide **tax rate
  sliders**: Taxes / Luxuries / Science (10% steps; government caps apply).
- **Corruption** removes a fraction of a city's trade proportional to distance
  from the Palace (capital); worst under Despotism, zero under Democracy;
  Courthouse halves it.

### 4.6 City buildings

From `data/buildings.json` (cost / maintenance / effect) — the Civ 1 set:

Palace (capital, no corruption locally), Barracks (veteran units), Granary,
Temple (+content), Marketplace (+50% tax/lux), Library (+50% science),
Courthouse, City Walls (defense ×3 vs land attack), Aqueduct, Bank (+50% on top
of Marketplace), Cathedral, University (+50% on top of Library), Colosseum,
Factory (+50% shields), Power Plant / Hydro Plant / Nuclear Plant (boost Factory),
Manufacturing Plant, Recycling Center, Mass Transit, SDI Defense.
*(Spaceship parts deferred to the space-race phase.)*

## 5. Units

### 5.1 Attributes

Every unit type: **Attack / Defense / Movement**, shield cost, prerequisite tech,
obsoleted-by tech, domain (land/sea/air), and flags (e.g. `ignoresWalls`,
`carriesUnits`, `invisible`).

### 5.2 Unit roster (Civ 1 — 28 types, values to verify)

| Unit | A/D/M | Cost | Tech | Notes |
|---|---|---|---|---|
| Settlers    | 0/1/1  | 40  | —              | Found city, build improvements |
| Militia     | 1/1/1  | 10  | —              | |
| Phalanx     | 1/2/1  | 20  | Bronze Working | |
| Legion      | 3/1/1  | 20  | Iron Working   | |
| Cavalry     | 2/1/2  | 20  | Horseback Riding | |
| Chariot     | 4/1/2  | 40  | The Wheel      | |
| Catapult    | 6/1/1  | 40  | Mathematics    | |
| Knights     | 4/2/2  | 40  | Chivalry       | |
| Musketeers  | 2/3/1  | 30  | Gunpowder      | |
| Cannon      | 8/1/1  | 40  | Metallurgy     | |
| Riflemen    | 3/5/1  | 30  | Conscription   | |
| Artillery   | 12/2/2 | 60  | Robotics       | |
| Armor       | 10/5/3 | 80  | Automobile     | |
| Mech. Inf.  | 6/6/3  | 50  | Labor Union    | |
| Diplomat    | 0/0/2  | 30  | Writing        | Phase 6 (espionage/diplomacy) |
| Caravan     | 0/1/1  | 50  | Trade          | Phase 6 (trade routes, wonder help) |
| Trireme     | 1/0/3  | 40  | Map Making     | Coastal; may sink in open sea |
| Sail        | 1/1/3  | 40  | Navigation     | Carries 3 |
| Frigate     | 2/2/4  | 40  | Magnetism      | Carries 4 |
| Ironclad    | 4/4/4  | 60  | Steam Engine   | |
| Cruiser     | 6/6/6  | 80  | Combustion     | |
| Battleship  | 18/12/4| 160 | Steel          | |
| Submarine   | 8/2/3  | 50  | Mass Production| Invisible until adjacent |
| Carrier     | 1/12/5 | 160 | Advanced Flight| Carries air units |
| Transport   | 0/1/4  | 50  | Industrialization | Carries 8 |
| Fighter     | 4/2/10 | 60  | Flight         | Must end turn in city/carrier |
| Bomber      | 12/1/8 | 120 | Advanced Flight| Two-turn range |
| Nuclear     | 99/0/16| 160 | Rocketry + Manhattan Project | Destroys stack + city pop |

### 5.3 Movement

- 8-directional movement on the grid; move points spent per terrain cost.
- Roads: ⅓ move point; Railroad: free (Civ 1) or capped (tuneable).
- **Zone of control:** moving directly between two tiles adjacent to an enemy
  unit is forbidden (classic Civ 1 ZOC).
- **Unit actions:** Move, Fortify (defense ×1.5), Sentry, GoTo (engine-side
  pathfinding), Wait/Skip, Pillage (destroy a tile improvement), Disband,
  and for Settlers: Found City / Build Road / Irrigate / Mine / Clear.

### 5.4 Combat (Civ 1 one-shot model)

No hit points in v1 — faithful to Civ 1:

```
attackStrength  = A × veteran(×1.5) 
defenseStrength = D × terrainDefense × fortified(×1.5) × fortress(×2)
                    × cityWalls(×3, land attacks only) × vsCavalryBonus…
p(attacker wins) = attackStrength / (attackStrength + defenseStrength)
```

One random roll (seeded PRNG) decides; the loser is destroyed. If the defender
loses on a non-city tile stacked with other units, the whole stack dies (Civ 1
rule — brutal, tuneable). Capturing a city (moving into an undefended /
just-cleared city) transfers it; pop −1; chance of gold plunder.
Surviving winners gain veteran status with probability 50%.

`rules.combatRounds` (default 1 = the authentic single roll above) can be 3:
best-of-three sub-rounds at the same per-roll odds — a setup-screen option
("Combat calculations") that softens upsets (80% → ~90%) without removing
them. It rides the difficulty-style ruleset-override mechanism, so replays
record it. A full hitpoints/firepower system is noted as a possible third
mode, not planned for v1.

**City defense — no inherent bonus (wiki-verified, B25):** a unit standing
in a city gets **no** defensive multiplier from the city itself. The only
city-side defence is **City Walls (×3 vs land attacks)**; without walls a
defender in a city fights at exactly its open-ground strength (base × terrain
× fortified × fortress). Units are **not** auto-fortified inside a city —
`Fortify` (×1.5) is a manual command that must be issued, and moving cancels
it. The city's sole extra protection without walls is the *stack* rule: in a
city (or Fortress) defenders die **one at a time**, and each defender lost
also costs the city one population point *unless* it has City Walls (Combat
(Civ 1) / City Walls (Civ 1) fandom pages). Scenario `026-fortify-defense`
pins that the fortify ×1.5 is load-bearing in both engines.

## 6. Technology

- Science "bulbs" accumulate from the science share of trade. Cost of the *n*-th
  tech grows linearly (`baseCost × techsDiscovered`, difficulty-scaled).
- One research target at a time; player picks from currently-available techs
  (all prerequisites known).
- **Full Civ 1 tree** in `data/techs.json`: 68 advances (verified against the
  wiki dump) including Future Technology. Each entry: `name`, `level`
  (tree depth), `prereqs` (0–2 tech ids). Unlocks are *inverted*: units,
  buildings, and wonders reference their required tech id in their own data
  files, so the tech entries stay lean and there is a single source of truth
  per item.

Advances (grouped by era, prerequisites in the data file — verify list against wiki):

- **Ancient:** Alphabet, Pottery, Ceremonial Burial, Bronze Working, Masonry,
  The Wheel, Horseback Riding, Iron Working, Writing, Code of Laws, Currency,
  Mysticism, Astronomy, Mathematics, Map Making, Construction, Monarchy, Trade,
  Literacy, Philosophy, Religion (Ceremonial Burial+Philosophy)
- **Medieval:** Feudalism, Chivalry, Bridge Building, Engineering, Seafaring→
  *(not in Civ 1 — exclude)*, Navigation, Astronomy→Theory of Gravity chain,
  University, Banking, Invention, Gunpowder, Physics, Magnetism, Medicine,
  Chemistry, Theology→ *(not in Civ 1 — exclude)*, Democracy
- **Industrial:** Metallurgy, Conscription, Theory of Gravity, Atomic Theory,
  Explosives, Steam Engine, Railroad, Industrialization, The Corporation,
  Refining, Electricity, Steel, Combustion, Automobile, Communism
- **Modern:** Electronics, Flight, Advanced Flight, Mass Production, Labor Union,
  Nuclear Fission, Nuclear Power, Rocketry, Computers, Recycling, Space Flight,
  Plastics, Superconductor, Robotics, Genetic Engineering, Fusion Power,
  Future Technology (repeatable)

## 7. Wonders (21, one instance each, world-wide race)

| Wonder | Tech | Effect (v1 implementation) |
|---|---|---|
| Pyramids | Masonry | Change government without Anarchy period |
| Hanging Gardens | Pottery | +1 happy citizen in every city |
| Colossus | Bronze Working | +1 trade on every trade-producing tile in its city |
| Lighthouse | Map Making | Triremes never sink in open sea |
| Great Library | Literacy | Receive any tech known by ≥2 other civs |
| Oracle | Mysticism | Doubles Temple happiness effect everywhere |
| Great Wall | Construction | City Walls effect in all your cities |
| Copernicus' Observatory | Astronomy | +50% science in its city |
| Magellan's Expedition | Navigation | +1 movement for all ships |
| Michelangelo's Chapel | Religion | Cathedral effect boost in all cities |
| Shakespeare's Theatre | Medicine | No unhappy citizens in its city |
| Isaac Newton's College | Theory of Gravity | Science boost in its city |
| J.S. Bach's Cathedral | Religion | −2 unhappy in every city (continent) |
| Darwin's Voyage | Railroad | Two free technologies immediately |
| Hoover Dam | Electronics | Hydro-plant effect in all cities on continent |
| Women's Suffrage | Industrialization | Reduces war-weariness unhappiness |
| Manhattan Project | Nuclear Fission | Enables Nuclear units (all civs) |
| Apollo Program | Space Flight | Enables spaceship parts (phase 6) |
| Cure for Cancer | Genetic Engineering | +1 happy citizen in every city |
| SETI Program | Computers | Major science boost |
| United Nations | The Corporation | Diplomacy effects (phase 6; score in v1) |

Some wonders become obsolete when a specific tech is discovered (data-driven,
verify against wiki).

## 8. Governments (simplified for v1)

Unlocked by tech; switching triggers 1–4 turns of **Anarchy** (unless Pyramids).

| Government | Tech | Corruption | Unit support | Tile penalty/bonus | Max sci/tax rate |
|---|---|---|---|---|---|
| Despotism | — | High | Free per city | −1 on tiles yielding ≥3 | 60% |
| Anarchy | (transition) | Severe | Free | as Despotism | 60% |
| Monarchy | Monarchy | Medium | 3 free/city | none | 70% |
| Communism | Communism | Flat (even) | 3 free/city | none | 80% |
| Republic | Code of Laws→Republic* | Low | Paid | +1 trade on trade tiles; war unhappiness | 80% |
| Democracy | Democracy | None | Paid | +1 trade; strong war unhappiness; senate forces peace (phase 6) | 100% |

*Civ 1 has "The Republic" as an advance — include it in the tech list (verify).

## 9. Barbarians & AI

- **Barbarians:** spawn from huts *(minor tribes: goody huts give gold, a tech, a
  unit, or barbarians)* and randomly on unowned land/sea; attack nearest city.
- **AI civs (v1 = simple heuristic AI, same command API as humans).**
  Baseline v0 ruleset (per designer input — deliberately dumb, ship it first):
  1. Settlers: on a good tile (food ≥ 2 in radius)? found city; else move toward
     nearest river/coast.
  2. Military: enemy city revealed? move toward it; else move toward nearest fog.
  3. City build: no defender → build defender (Militia/Phalanx); else → Settlers.
  4. Research: cheapest available tech.

  v1 upgrades on top: keep N defenders per city, data-driven build orders,
  research priority lists per AI "personality", attack weakest neighbor city.
- AI must issue only legal commands through the same engine API as players —
  this keeps it portable and testable.

## 10. Score

`score = citizens×2 + happyCitizens×1 + techs×5 + wonders×20 + futureTech×5 − pollution…`
(Pollution optional/off in v1; exact weights tuneable in `data/rules.json`.)

## 11. Implementation status vs this spec (kept honest as slices land)

The engine implements simplified first passes of some mechanics; each item
below is a known, deliberate deviation to be closed in a later slice:

- **Worked tiles**: auto-assigned greedily by default; manual per-tile
  assignment is implemented (`setWorkers`, city-view clicks) with growth
  auto-assigning the new citizen; specialists work (Entertainer implicit for
  idle citizens, Taxman/Scientist via `setWorkers` at pop ≥ 5). Still
  missing: tile contention between cities.
- **Happiness is in** (contentCitizens, luxuries worst-first, Temple chain,
  martial law, war unhappiness, disorder halting shields/taxes) with
  deviations: luxuries are computed from the city's *raw* trade even during
  disorder (so disorder can't lock itself in); martial-law and content
  numbers are flat per government table; **difficulty** (Trainer→God-Emperor
  in the setup screen) adjusts only the content-citizen threshold (6→2) as a
  ruleset override — recorded in diagnostics so replays stay faithful; unit
  cost/AI-bonus scaling waits for a later slice;
  Michelangelo's Chapel is approximated as +4 content everywhere and
  J.S. Bach's as +2 everywhere (Civ 1 limited Bach to one continent).
- **Governments are in** (`data/governments.json`: rate caps, despotism
  tile penalty, Republic/Democracy trade bonus + war unhappiness, unit
  upkeep in shields, corruption by capital distance with Courthouse relief,
  revolutions with flat `rules.revolutionTurns` of anarchy, Pyramids skip).
  Deviations: unpayable upkeep clamps shields at 0 instead of disbanding;
  units built before this slice have no home city and are support-free; the
  capital defaults to the oldest city when no Palace exists; the Democracy
  senate and Communism's spy bonuses wait for diplomacy.
- **ZOC is domain-blind, unit-only, exemption-free** (B14 verdict
  2026-07-15, wiki extract as authority): Civ 1's rule carries no land/sea
  exemption — any unit exerts ZOC on all eight neighbors, so land units DO
  bind adjacent sea movement. This matches `engine/movement.js
  inEnemyZoc`; closed no-change. Both former known-gaps are now SHIPPED
  (doc-sync 2026-07-17): enemy cities exert ZOC (inEnemyZoc scans rival
  cities, wrap-aware) and units.json `ignoresZoc` exempts Diplomat /
  Caravan / Nuclear (B18).
- **Improvement-terrain matching is the authentic Civ 1 TRANSFORM model**
  (B17 audit 2026-07-16, wiki terrain table as authority, verified
  cell-by-cell): `data/terrain.json` matches all eleven rows — irrigation
  bonuses on Desert/Grassland/Hills/Plains (+1 food), mines on
  Desert/Mountains (+1 shield) and Hills (+3), and the transforms:
  Forest→Plains (either work), mine plants Forest on Grassland/Plains/
  Jungle/Swamp, irrigate clears Jungle/Swamp to Grassland; nothing on
  Arctic/Tundra/Ocean. "Mines only on hills/mountains" is later-Civ
  memory — in Civ 1, mining grassland *plants a forest*, and the engine
  does exactly that. Transforms delete both work flags and the renderer
  draws markers from those flags, so a transform can never leave a stray
  mine/irrigation marker. Known river-flag deviations vs Civ 1's River
  terrain (inherent to the deliberate flag model, §3.1): a rivered tile
  can be mine-transformed into forest+river (Civ 1's River had no mine
  option), roads on rivered tiles get the base terrain's trade bonus
  (Civ 1's River road gave none), and Bridge Building does not yet gate
  road-building on river tiles (the tech exists unused by improvements).
- **Settlers don't eat food** yet (§4.3 says 1/turn).
- **Calendar follows a Civ-1-style variable curve** (`data/rules.json`
  `yearSteps`, landed 2026-07-13): 50 yrs/turn to 1000 BC, 25 to 1 AD,
  20 to 1000 AD, 10 to 1500, 5 to 1850, then 2 — the 2100 AD score end
  lands at turn ~396 (unit-tested landmarks in `test/year.test.js`).
  Rulesets without the table keep the old flat 20 (crafted test states
  stay stable).
- **Research overflow carries between advances** (Civ 1 discards it;
  tuneable choice, documented).
- **Future Tech is a one-time advance** for now (repeatable scoring later).
- **Pop floors at 1** on starvation (no city destruction).
- **Tile improvements**: road/irrigation/mine bonuses, terrain transforms
  (clear/drain/plant via the same orders), Fortress (Construction), and
  railroads (Railroad tech, road first, free rail movement, +50% shields)
  all work. Deviations: roads give 3× movement via TWO FREE road-to-road
  steps per base move point (transient integer counter `unit.roadSteps`,
  cleared each turn wrap — no thirds, Luau-portable; past the allowance a
  road step costs 1); rail movement is free with no per-turn cap (as
  Civ 1); build times are flat per improvement (`rules.json` `workTurns` —
  tuning values); irrigation's water source check uses the 8-neighborhood;
  city tiles do not count as roads.
- **The city square auto-develops** (wiki-verified Civ 1 rule): the center
  tile yields as if roaded & irrigated (irrigation skipped over a mine) —
  note despotism's tile penalty applies to it too, so the food gain often
  shows only after a revolution. Client mini-map/site-preview display of
  this is queued (A16).
- **Starting positions** keep at least 3 tiles from the polar map edges.
- **Arctic is an impassable ice wall** (user decision 2026-07-13 — a
  deliberate deviation from Civ 1's walkable poles): its terrain domain
  is `ice`, matching no unit domain, so movement, founding, and
  barbarian spawns all reject it. Cities adjacent to the ice can still
  work special tiles on it (seals).
- **City spacing**: founding is rejected within `rules.minCityDistance`
  (4) tiles of ANY existing city, any civ (Civ 1 was adjacency-only —
  playtest choice for less city-carpet).
- **Fortress ×2 is in** (walls take precedence; fortresses stop stack
  death). Goody huts and era-based barbarian units are deferred; barbarians
  spawn as militia from turn 16.
- **Building effects**: Granary, Aqueduct, Barracks, City Walls, Marketplace
  (tax+lux), Bank (tax+lux), Library, University, Temple (+Mysticism/Oracle
  doubling), Colosseum, Cathedral, Courthouse, and Palace (capital) work;
  the Factory power chain awaits its slice. Wonder effects: Colossus, Great
  Wall, Pyramids, Hanging Gardens, J.S. Bach, Michelangelo, Shakespeare,
  Cure for Cancer, Oracle so far.
- **Buy uses a flat price** — 2 gold per missing shield (wonders 4,
  `rules.json`) instead of Civ 1's tiered formula; purchases complete at the
  next turn wrap. Pillage destroys field works (irrigation/mine) before
  roads, one per action.
- **Negative treasury is clamped to 0** — Civ 1 sells buildings instead.
- **Score counts citizens/techs/wonders only** — happy-citizen points, Future
  Tech points, and the pollution penalty from §10's full formula await their
  systems. Elimination requires losing all units *and* cities (no capital rule).
- **The AI expands, develops, and defends itself** but has no diplomacy
  and only defensive-minded tactics: settlers are danger-aware (never
  stepping next to a known enemy; the corps splits into expanders and
  homeland improvers who road/irrigate worked tiles), military units
  escort unguarded field settlers, garrisons scale with threat (2 when an
  enemy is known within 8, 1 in peacetime), aggression is radius-limited,
  and a per-civ army cap redirects surplus shields to settler-pavers.
  Saturated cities build the cheapest missing building, then the cheapest
  available wonder. It uses no RNG so AI games replay deterministically.
  See `docs/04-phase1-enrichments.md` §7 for all three AI batches with
  measured results (median 4–5 cities/civ, tech median ~11 at turn 400).
- **Revolutions clamp rates immediately**: entering anarchy caps
  tax/science/luxuries at anarchy's 60 on the spot (a Monarchy running
  70% science drops to 60 for the interregnum) — found organically by
  the simulation invariant net.
- **Wave-VI engine pair (2026-07-14)**: the CAPITAL's city square
  carries +1 trade (`rules.capitalCenterTradeBonus`, applied after the
  government adjustment — every capital researches from turn one; a
  deliberate deviation, Civ 1 has no such bonus), and city spacing uses
  a 3-orthogonal / 2-diagonal metric (`minCityDistance` 3 +
  `minCityDiagonal` 2: legal iff Chebyshev ≥ 3 or both axes ≥ 2 —
  user-tuned from playtests, replacing the flat 4).
- **Starting ages (setup option, A20 2026-07-13)**: Ancient starts at
  4000 BC as always; Renaissance/Industrial/Modern/Space Age fast-forward
  an all-AI world to a year-anchored turn (190/256/305/325 on the A21
  calendar), then grant every civ the cumulative techs of the prior eras
  (Civ2-derived era buckets carried as `era` fields in `data/techs.json`;
  Space Age grants everything except Future Tech) and hand the chosen
  seats to the humans. Deterministic per seed; aborts openly if a chosen
  civ died during the fast-forward. Not a Civ 1 feature — a deliberate
  quality-of-life addition.

### World ages (A75, 2026-07-16 — not a Civ 1 feature, a QoL addition)

The world's CURRENT AGE is a live derived property: the highest of
the four tech eras reached (≥1 tech of that era or later) by ≥30%
of living civs (`rules.json worldAgeThreshold`). Era transitions
fire a world-news `ageChanged` event and the client's historian's
report (global standings interstitial). Space Age remains a
starting-scenario option only. Save-file rule (B16): a game's
`rulesOverrides` (difficulty) travels inside its save envelope and
applies on load with a visible notice — a save's rules ARE the
game's rules.

### Known missing Civ 1 systems (wave-VIII audit 2026-07-15; STATUS SWEEP 2026-07-16 evening)

Named honestly after the user's deep late-game playtest. The B13
era-scaling window (2026-07-16) SHIPPED a large slice of this list:
- **SHIPPED — Obsolescence** (B13/A63): units leave the catalog on
  their obsoletedBy tech; the AI era-scales its army; barracks are
  SOLD with gold credited at Gunpowder/Combustion (user ruling;
  wiki-says-vanish delta logged); wonder expiry was already data.
  STILL OPEN from the A63 family: field upgrades / Leonardo's
  Workshop effect (upgradeUnit, human-golden-safe slice).
- **SHIPPED — Barbarians era-scale** (A66, rode B13): tiered spawns
  keyed to the obsolescence trigger techs (rules.barbTiers).
- **SHIPPED — the AI fights** (B21): attacker build slot, attacker-
  tech beeline term, rush-buy under threat, scout share — the
  re-baseline's dormant-capability verdict answered; sweeps pending.
- **IN FLIGHT — Naval transport** (A69, claimed 2026-07-16 evening):
  transport:N on ships, aboard:<shipId>, implicit load/unload via
  move; sink-with-cargo. Unblocks A72.
- **Air movement does not exist** (A72): movement rejects any tile
  whose terrain domain ≠ the unit's — fighters/bombers/nuclear
  buildable and immobile. Designed; queued AFTER A69.
- **Buildings cannot be sold manually** (A86): the barracks
  auto-sell (B13) landed the removal+credit machinery; the manual
  one-per-city-per-turn command + city-view affordance remain
  (state-shape flag → own golden window).
- **Barbarian era-scaling SHIPPED** (A66 closed): barbarians.js barbTier()
  picks the spawn unit from rules.barbTiers by tech-threshold across
  living civs (see the barbTiers reference above); REBELS rename designed.
  (Doc-sync 2026-07-17 — this row previously contradicted the barbTiers
  reference 14 lines up.)
- **Special-unit behaviors unaudited** (A71): submarine
  invisibility, carrier capacity, catapult-vs-walls etc. — audit
  pending; Diplomat/Caravan remain out of scope (§12).

### Special-units audit (A71, architect vs the dump, 2026-07-16 — user rules the Decision column)

| Unit | Civ 1 behavior (wiki) | Ours | Recommendation |
|---|---|---|---|
| Submarine | invisible to land units (spotted only adjacent by sea/air); sight 2; cannot attack land | plain ship | MISSING — visibility model extension; with B13 family or own item |
| Carrier | carries 8 air units (incl. Nuclear); sight 2 | plain ship | A72 dependency (air) + A69 aboard machinery — already designed |
| Battleship / Cruiser | sight 2; **can bombard/attack units on coastal land squares** | SHIPPED — combat.js allows sea-domain attackers to strike land tiles (A72-era; attack-in-place, no disembark) | closed (doc-sync 2026-07-17, reviewer sweep) |
| Fighter | must return to city/Carrier EVERY turn; the ONLY unit that can attack air units | grounded (A72) | A72 covers fuel; add air-vs-air exclusivity to A72 |
| Bomber | 2 turns aloft; **ignores City Walls when attacking**; sight 2 | grounded (A72) | A72 + the walls-ignore flag (one combat multiplier guard) |
| Nuclear | one-shot air attack (A72 design verified) | immobile | A72, designed |
| Trireme | **lost at sea if not adjacent to land at turn end**; carries 2 | plain ship | charming + cheap: coastal-loss check joins A69 |
| Transport | carries 8; no away-unhappiness | plain ship | A69, designed |
| Diplomat | ignores ZOC ✅ (B18); no upkeep; no Rep/Dem away-unhappiness; ACTIONS: establish embassy / investigate city / steal tech (once per city) / industrial sabotage / bribe units | ZOC flag only | the action suite = docs/14 D6 (diplomacy era); upkeep/unhappiness flags cheap now |
| Caravan | ignores enemy units moving; no upkeep/unhappiness; **+50 shields to a domestic wonder**; establishes trade routes (top 3 kept); consumed on use | ZOC flag only | wonder-help is small + delightful (near-term candidate); trade routes = the Civ4-chains shelf neighbor, design with phase 6 economy |
| Catapult / Artillery | nothing special — stats only (no anti-wall behavior in Civ 1) | correct | CLOSED — the walls suspicion was another Civ2+ memory |
| Sight ranges | subs/carriers/battleships/cruisers/bombers see 2 | all units sight 1 (verify) | audit row: a per-unit sight field, visibility-model extension |

### Ratified deviations & divergences (user rulings 2026-07-17, provenance-labeled)

- **freeUnitsPerCity=3 under Monarchy/Communism is a deliberate Civ2
  borrow** — RATIFIED (Civ1 charges upkeep on every unit with no 3-free
  allowance; the wiki Government (Civ1) table is the authority). Kept for
  playability; labeled Civ2-shape per the mixing ruling.
- **Anarchy models a maxRate=60 clamp, not Civ1's no-tax/no-science** —
  KEPT as a playability divergence, documented here (engine
  government.js clamps during revolution; Civ1 collects nothing).
- **Settler food upkeep: SHIPPED marker-0046 at a flat 1 food per
  settler** (user chose the flat model over the wiki's
  1-under-Despotism/2-under-later split; original-shape
  simplification). Homed settlers eat 1 food/turn at the home city;
  deficit starves via the existing path (settler-spam self-cap);
  homeless settlers free (the shields deviation class);
  `settlerFoodUpkeep` knob, 0 = off. A progressive variant
  (first-N-free) is under measurement as a possible tune.
- **Barbarian gold ransom: ADOPTED**, bundled with A4 goody huts (same
  barbarian/rng surface), not its own window.
- **PARKED (game-v2): a richer Civ4-shape anarchy/revolution/civics
  system** — user flags explicit interest for later; recorded beside the
  other game-v2 items so it isn't lost.
- **ZOC city-capture exemption (B27, Civ2-provenance)**: entering ANY city
  square is zone-of-control-exempt — an undefended enemy city is capturable
  by moving into it even when both squares sit in an enemy ZOC. Civ 2 states
  it explicitly ("into or out of a city, including capturing an enemy city");
  the Civ 1 wiki is silent and C-evo declines, so the family splits — adopted
  by user ruling 2026-07-17 ("must be able to attack city if adjacent, even
  in ZOC"). Defended cities already resolved as an attack (pre-ZOC).

## 12. Out of scope for v1 (specified in roadmap phases)

Diplomacy & negotiations, Diplomat/Caravan gameplay, trade routes, pollution &
global warming, spaceship construction & space victory, difficulty-level
modifiers beyond a single global multiplier, palace/throne-room fluff, and
**random city disasters** (fire, plague, flood, pirates, earthquake — Civ 1 ties
building effects to these, e.g. Aqueduct prevents fire/plague, Barracks prevents
pirates; the building data in `data/wiki-extract/` records this for later).

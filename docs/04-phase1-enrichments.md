# Phase 1 enrichments — design for the remaining items

Phase 1's milestone is met; these are the deliberately-deferred Civ 1 systems
still open inside its steps (see `03-roadmap.md`). Already shipped:
improvements (roads/irrigation/mines), **buy**, **pillage**, **disband**,
wait/skip. This documents the rest so any of them can be picked up cold —
each entry: mechanics, state/data shape, commands/events, hash impact, tests.

Ground rules for all of them (from `02-architecture.md` §4): Lua-portable
engine subset, all numbers in `data/*.json`, new state fields must be
**optional** (absent in old states) so existing scenario hashes stay stable
unless the feature is exercised.

## Suggested implementation order

1. **Happiness pack** (specialists + luxuries + Temple chain) — biggest
   gameplay hole; everything below it references it
2. **Governments + corruption** (+ Palace/Courthouse) — depends on 1 for
   martial law / unit unhappiness
3. **Fortress + terrain transforms + railroads** (completes the Settler)
4. **GoTo** — pure movement QoL, independent
5. **Goody huts + era barbarians** — map spice, independent
6. **Future Tech repeat + building sale** — small closers
7. **Tile contention + AI improvements** — correctness + AI polish

---

## 1. Happiness pack (specialists, luxuries, disorder)

**Mechanics (Civ 1):** each citizen is happy, content, or unhappy. Base:
the first N citizens are content (N difficulty-dependent; we use one global
`rules.contentCitizens`, default 4 later citizens are born unhappy. Luxuries
(2 per citizen-face) make unhappy→content→happy. A city where unhappy >
happy falls into **disorder**: it produces no shields/trade (food still
collected) until fixed. Martial law (units in city, government-dependent)
suppresses unhappiness later.

- **Specialists:** citizens NOT working tiles become specialists instead of
  being idle: Entertainer (+2 luxuries), Taxman (+2 gold), Scientist
  (+2 bulbs); Taxman/Scientist require pop ≥ 5 (Civ 1). Today's "idle
  citizens" become Entertainers by default — strictly better, and removes
  the current dead-weight case.
- **Luxuries:** third slice of the trade split — `setRates` grows a `lux`
  component (tax + lux + sci = 100). Each 2 luxuries in a city upgrade one
  citizen one step.
- **Buildings:** Temple content +1 (+1 more with Mysticism), Colosseum +3,
  Cathedral +4 — as `effect: { contentBonus: N }` overlays in
  `tools/mapdata.js`. Wonders: Hanging Gardens (+1 content every city),
  Cure for Cancer (+1 happy every city), Shakespeare's Theatre (all unhappy
  content in its city), J.S. Bach (−2 unhappy every city).

**State:** `city.specialists = { entertainers: n, taxmen: n, scientists: n }`
(optional; derived default = all non-workers are entertainers).
`player.luxRate` (optional, default 0). `city.disorder = true` while in
revolt (computed at wrap, stored so the client can show it).

**Commands:** extend `setWorkers` (a worker removed from a tile chooses a
specialist type — add `specialists` field to the command); extend `setRates`
with `lux`.

**Events:** `cityDisorder { cityId }`, `cityOrderRestored { cityId }`.

**Hash impact:** none until a state carries the new optional fields, BUT
disorder changes processCities output for big cities — gate the whole
happiness computation on `rules.contentCitizens` being present in the
ruleset, and add it to `rules.json` in the same commit that re-records
affected scenario hashes (likely none: scenario cities are pop ≤ 3).

**Tests:** scenario with a pop-6 city tipping into disorder and bought back
with luxuries; unit tests for specialist yields and each building bonus.

## 2. Governments + corruption

**Mechanics (Civ 1, simplified):** Despotism (start) → Monarchy → Republic →
Democracy (+ Anarchy during revolution; Communism later if wanted).
Per-government table in `data/governments.json`:

| field | despotism | monarchy | republic | democracy |
|---|---|---|---|---|
| maxRate (tax/sci/lux cap) | 60 | 70 | 80 | 100 |
| unitUpkeepFree | all free | 3/city | 0 | 0 |
| upkeepShields | 0 | 1/unit | 1/unit | 1/unit |
| tradePenalty/bonus | −1 on tiles ≥3 | 0 | +1 trade tiles | +1 trade tiles |
| warUnhappiness | none | none | 1/unit abroad | 2/unit abroad |
| corruption | high | medium | low | none |

- **Corruption:** trade lost per city scaled by distance to the capital ×
  government factor. Needs a capital: **Palace** building (exists in data;
  effect `isPalace: true`; captured capital ⇒ rebuild). Courthouse halves
  corruption in its city.
- **Revolution:** `setGovernment` command → `player.government = 'anarchy'`
  + `player.revolutionTurns = N`; at wrap, when it hits 0 the target
  government takes effect. Anarchy: rates forced 50/50/0, corruption max.

**State:** `player.government` (optional, default 'despotism'),
`player.revolutionTurns`. **Command:** `setGovernment { government }` (tech
gated: Monarchy/The Republic/Democracy advances).

**Hash impact:** the despotism trade penalty changes existing yields —
that's a real balance change; land it behind the governments slice and
re-record scenarios in one commit.

**Tests:** scenario: revolution → anarchy turns → Republic; corruption by
distance; unit upkeep deducted.

## 3. Fortress, transforms, railroads (Settler completion)

- **Fortress:** `startWork` kind `fortress` (needs Construction), turns in
  `workTurns`. `tile.fortress = true`; defenders on it get ×2 in
  `defenseStrength` (stacks with terrain, not with city walls — city tiles
  can't have fortresses); Civ 1 rule: units in a fortress don't die as a
  stack (defender-only loss, like cities).
- **Transforms:** `startWork` kinds already sketched in the wiki data
  (cells with `→`): clear forest→plains, clear jungle→grassland, drain
  swamp→grassland, plant forest on grassland/plains (the wiki's grassland
  "mine"). Implementation: `terrain.transforms = { irrigate: 'plains', … }`
  parsed from those cells in `tools/mapdata.js`; on completion the tile's
  `t` changes and improvement flags reset. Beware: renderer prop rebuild
  and the city-view mini-map already read tiles generically, so no client
  change needed.
- **Railroads:** needs Railroad tech + existing road; `tile.railroad`;
  movement free along rails (cost 0 — but cap total per-turn rail distance
  to avoid infinite loops: Civ 1 was truly free, we cap at e.g. 12) and
  +50% shields on the tile (wiki: "+50% yields" — start with shields only).

**Hash impact:** none (all opt-in flags/commands).
**Tests:** scenario per transform; rail movement unit test.

## 4. GoTo

Client-side is not enough (AI wants it too, and phase-3 servers validate
moves only): keep it **client-side anyway**. Rationale: the engine's
command vocabulary stays "one tile per command" (perfect replay logs), and
GoTo is just an input convenience that issues one legal `moveUnit` per
click/turn along a path. A* over the known (explored) tiles with terrain
costs, stored per unit in the client session (`goto` map unitId→target),
advanced automatically at turn start. Zero engine/hash impact. The Luau
client can port the same helper.

**Tests:** none in the engine; an e2e probe that a queued path advances a
unit after End Turn.

## 5. Goody huts + era-based barbarians

- **Huts:** mapgen sprinkles `tile.hut = true` on ~1/40 land tiles (seeded
  — mapgen scenario 002 hash re-records once). Entering unit removes the
  hut and rolls (engine rng): 50 gold / free tech / free militia /
  barbarian ambush (spawn 2 around the tile). Event `hutEntered { result }`.
- **Era barbarians:** `barbarians.js` picks the spawn unit by the world's
  best known attack tech tier — table in `data/rules.json`
  (`barbarianUnits: [{ afterTech: '', unit: 'militia' }, { afterTech:
  'iron-working', unit: 'legion' }, …]`). Hash impact: only games where
  barbarians spawn (no locked scenario reaches turn 16).

## 6. Small closers

- **Future Tech repeat:** when `availableTechs` is empty and the player
  knows Fusion Power (its prereq chain end), keep offering `future-tech-N`:
  implement as `player.futureTech = count` (optional int) instead of fake
  tech ids; `researchCost` includes it; score +5 each (`rules.
  scorePerFutureTech`). No hash impact until earned.
- **Building sale:** `sellBuilding { cityId, buildingId }` → gold += cost/2
  (Civ 1: 1 gold per shield), building removed, one sale per city per turn
  (`city.soldThisTurn` flag cleared at wrap). Replace the negative-gold
  clamp: at wrap, if gold < 0, auto-sell the cheapest building (Civ 1
  behavior), THEN clamp. Re-records nothing (auto-sale only fires in
  bankrupt states, which no scenario has).

## 7. Correctness / AI polish

- **Tile contention:** two adjacent cities can both work the same tile
  today. Fix inside `workedTiles`/`candidateTiles`: a tile is taken if a
  HIGHER-priority city works it — priority = city founding order
  (`cityOrder` index), deterministic in any language. Manual assignments
  (`city.workers`) win over greedy neighbors; conflicting manual claims go
  to the older city. **This changes yields in dense empires** — audit
  scenarios (city spacing in crafted states is generous; likely no
  re-records) and playtest AI games.
- **AI improvements:** the v0 AI's settlers currently only found cities.
  Cheap heuristic that keeps rng-free determinism: a settler standing on a
  worked tile of an owned city with no improvement → irrigate (if legal)
  else road; otherwise proceed to found logic. Changes AI-vs-AI outcomes →
  the determinism test still passes (it compares two identical runs); the
  full-game smoke test may need its turn-count expectation refreshed.

## Remaining wonder effects (for reference)

Mapped to the systems above: Hanging Gardens/Cure for Cancer/Shakespeare/
J.S. Bach → happiness pack; Michelangelo (Cathedral everywhere), Oracle
(doubles Temples) → happiness pack; Pyramids (any government switch without
anarchy) → governments; Great Library (any tech two others know), Darwin's
Voyage (+2 free techs), Isaac Newton (science ×2 in city), Copernicus
(+50% science city) → tech slice add-ons; Lighthouse/Magellan (naval moves)
→ movement; Adam Smith (pays 1-gold maintenances), Women's Suffrage,
Hoover Dam, Manhattan Project, Apollo Program, United Nations → their
respective later systems (economy, war-happiness, factories, nukes,
spaceship, diplomacy).

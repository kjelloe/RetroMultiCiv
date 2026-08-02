# Barbarian ceiling + capture garrisons — the 2026-08-02 window

Two engine changes from one root-cause investigation, built together because
they were found together and share a re-record.

## How it was found

The v1.0 RC sweep (25 seeds, 400 turns, 7 civs, medium, no chaos) came back
**24/25**, seed 25 failing the sim-driver's >1000-unit invariant at turn 340.
The state at that point held 1004 units, of which **695 were barbarian-owned**
— 69% of everything on the map, against 309 for all five surviving civs
combined. Two civs were already dead.

The same tripwire had fired before and been recorded as a counting artifact
(see `specs/build-doctrine-plan.md`, corrected). This time it was root-caused.

## Root cause

`engine/cities.js processCities()` iterates `state.cityOrder` with **no owner
filter**, and `engine/combat.js captureCity()` set the captured city to produce
a defender. So a barbarian-held city kept its food box, kept growing, and kept
shipping units, indefinitely. Nothing capped barbarian unit count, and
barbarians pay no upkeep.

Reproduced on a crafted state rather than inferred: one size-3 grassland city
under barbarian ownership produced 6 militia in 80 turns and grew to size 5.
The seed-25 case is that mechanism running on two eliminated civs' *developed*
cities for 300 turns.

## Rulings (user, 2026-08-02)

1. **Barbarian cities keep producing basic units.** Militia and cavalry, and
   possibly leaders — "since they are nomads". They are not frozen and the city
   is not razed. The architect's first proposal (skip production entirely for
   barbarian-held cities) was NOT taken.
2. **Any other civ follows the regular building procedure** and garrisons a
   defensive unit at its own tech level.
3. **A ceiling replaces upkeep.** A real civ is bounded by unit upkeep;
   barbarians pay none, so they need an explicit cap. Set at **128**.
4. **At the cap, the hordes furthest from a civ city disband first.** An
   earlier draft (a flat 30-tile self-disband radius) was withdrawn by the user
   in favour of cap-triggered disbanding.

## What shipped

**`engine/combat.js captureCity()` + `luau/combat.luau`** — production on
capture now comes from `bestDefenderUnit(state.players[unit.owner], ruleset)`,
the same helper `createCityAt` has used since §46. The captor's techs decide:
militia → phalanx → musketeers → riflemen → mech-inf. Barbarians hold no techs,
so the helper returns militia for them **with no special case in the code** —
ruling 1 falls out of ruling 2 rather than sitting beside it as an exception.
`ruleset` is optional on this path and falls back to militia.

**`engine/barbarians.js enforceCap()` + `luau/barbarians.luau`** — called at the
end of `process()`, after acting, so hordes that died attacking this turn are
already gone. Reads `rules.barb.maxUnits`; **omit the knob and there is no cap**,
exactly the pre-ruling behaviour. Over the cap, every barbarian unit is ranked
by chebyshev distance to the nearest **non-barbarian** city (a barbarian city is
a camp, not something to raid, so it must not keep a horde alive), sorted
furthest-first with an id tie-break so both engines agree, and the excess is
deleted with a `barbariansDispersed` event each.

Edge case: no civ cities left at all. Every horde is then equally purposeless,
the ranking collapses to the id tie-break, and the cap still holds.

## Provenance

**RetroMultiCiv, not recreated Civ 1**, and labelled that way in both engine
and twin. The wiki documents only the barbarian LEADER disbanding itself once
clear of other civs' cities ("if it can reach an area far enough away from other
civilizations' cities, it can disband itself prior to capture"). Extending that
to ordinary hordes, and adding a numeric ceiling, is our own rule. The captured-
city half is different: "Barbarians do not function as a regular civilization"
is explicit in the source, so bounding their economy is a faithfulness repair.

## Verification

- `test/scenarios/068-capture-defender-era.json` — written FIRST and confirmed
  RED (`cities.c1.producing.id = "militia", expected "musketeers"`). Covers both
  halves: a gunpowder civ captures and gets musketeers, barbarians capture and
  get militia. Runs in BOTH engines; added to the twins gate PORTED list.
- `test/barbarians.test.js` +5 — under the cap nothing disbands; furthest-first
  ordering; a barbarian-held city does not count as a raid target; the cap holds
  with no civ cities; omitting the knob restores the old behaviour.
- Revert-proof: flipping the comparator to nearest-first turns two of those red.
- `test/luau-twins.test.js` 11/11 with the new scenario reproducing
  cross-language.
- Goldens re-recorded honestly (eighth consecutive natural 545/p2 hold).

## Still open

Whether the 128 ceiling is ever REACHED in a normal game is a measurement, not
an assumption — the closing sweep answers it. The user's position: if
self-limiting through the cap proves insufficient, revisit. Barbarian units also
still only hunt within `HUNT_RADIUS` 8 and idle otherwise, which is the likelier
reason hordes accumulate in the first place; making them seek at any range was
discussed and NOT built, because it changes AI aggression and needs its own
measurement.

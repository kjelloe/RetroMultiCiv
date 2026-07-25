# W4 — We Love the King Day (celebration) engine window

Audit #1 (Civ1 gap, PROMOTED to v1). Spec §4.4: a city with `happy ≥ half pop`
and `no unhappy` celebrates. The precondition already computes in
`engine/happiness.js`; W4 adds the flag + the effect.

## Effect — RULED Civ1-faithful (user 2026-07-25)

- **All governments:** while celebrating, corruption/waste is reduced toward 0.
- **Republic / Democracy:** while celebrating, an extra +1 trade on tiles ALREADY
  producing trade (on top of the standing gov `tradeBonus`).
- **NO rapture / population growth** (the Civ2 option was declined). No trade
  bonus under Despotism/Monarchy/Communism (Communism corruption is already 0).

## Hook points (JS + byte-shaped Luau twin each)

1. **Celebrate flag** — at turn wrap (beside `updateDisorder`, happiness.js:140,
   which already calls `cityMood` per city over one `resolveAllWorked` snapshot):
   set `city.celebrating = true` when `happy*2 >= pop && unhappy == 0`, else
   `delete city.celebrating`. MIRRORS `city.disorder`'s set-when-true/delete-when-
   false pattern → the hashed state is byte-identical for any city that never
   celebrates (so if the precondition is dormant at the sim seeds, the trajectory
   is unmoved — STAMP-only). No RNG. `cityMood` never reads `celebrating`, so no
   circular dependency (the flag reads the prior mood; the bonus applies to this
   turn's income only).
2. **Corruption** — `engine/government.js:31 corruptionFor(state, city, trade,
   ruleset)`: after the `gov.corruptionFactor === 0` early return, add
   `if (city.celebrating === true) return 0;`.
3. **Trade** — `engine/cities.js:200 govAdjustYields(y, gov)`: thread the
   celebrating flag (extend the signature / pass the city); when celebrating AND
   the gov carries a celebration trade bonus, `+celebrateTradeBonus` on tiles with
   `out.trade > 0`. Update callers of `govAdjustYields`.
4. **Ruleset knob** — `data/governments.json` gains `celebrateTradeBonus` (1 for
   Republic + Democracy, 0 for the rest). In the rulesetHash → createGame STAMP
   cascade (same as W1–W3): re-record GOLDEN_SOAK/NATURAL, scenario002,
   age-snapshots, luau-twins pins.

## Classification — measure-first

STAMP-only if the celebrate precondition is dormant at the sim seeds (baseline:
AI builds ~0 happiness buildings, so likely near-zero celebrating cities);
BEHAVIORAL if AI cities do celebrate. sim-runner probe queued (#1
investigate-w4-w6) counts celebrate-eligible city-turns — that number sets the
re-record. Fixture FIRST regardless: a scenario/fixture with a crafted
celebrating city asserting corruption→0 and the Rep/Dem trade bonus.

## Tests

- `test/government.test.js` or a new fixture: celebrating city → corruption 0;
  a non-celebrating control unchanged.
- A scenario (cross-language) capturing celebrate + the Rep/Dem trade bonus, so
  both engines run it in the twins gate.
- Coverage: a `cityCelebrating` / `cityCelebrationEnded` event is optional (mirror
  `cityDisorder`/`cityOrderRestored`) — if added, register in EVENT_TYPES +
  classifyEvent + soundForEvent. Decide during build.

## Delivered (2026-07-25, @b813bbc)

Built as designed, fixture-first (`test/wltkd.test.js` failed pre-implementation on
both hooks, then 2/2). All four hook points landed + Luau twins in one window;
events `cityCelebrating`/`cityCelebrationEnded` WERE added (catalog + classifyEvent
+ soundForEvent — owner-only, reusing the order/disorder cues). Cross-language
scenario `test/scenarios/067-wltkd.json` pins 0x56151fa5; Luau reproduces it exactly.

**Classification: BEHAVIORAL** (the measure-first question answered twice, in
agreement): the null-and-run moved BEHAVIOR_SOAK at checkpoints 200–400 (t100 held —
first soak celebration lands between t100 and t200) and BEHAVIOR_NATURAL; the
sim-runner probe (mail #2746) measured 8.745% of living-AI city-turns
celebrate-eligible, 25/25 seeds, peak 25 cities in one turn — despite ~0 happiness
buildings (small despotism/monarchy cities reach happy*2 >= pop via the content
allowance). NOT dormant, as the baseline-buildings hypothesis had suggested.

Golden delta: GOLDEN_SOAK 0x27e4b6af.. / GOLDEN_NATURAL rounds 545→365, winner
p2→p3 by CONQUEST (barbs hold 8/10 cities at the end — probed before pinning;
legitimate butterfly from mid-game celebration yields) / BEHAVIOR_SOAK 0xc5b392c9..
/ BEHAVIOR_NATURAL 0x404fe91f / scenario002 0x5475e4c4 (JS==Luau) / age-snapshots
CANONICAL_PIN 0x45f3dc72 / sim-smoke t100 0xb5e2f37b / ff-parity 0x2302c281 / A82a
maptype pins. Twins gate 11/11 under lune; subset 785/786 (B13-witness local
staleness only). Gates on b813bbc: sim-runner 25-seed distribution sweep vs
baseline #2746 + Gate B Luau 400/natural + B13 regen; reviewer engine-diff →
marker-0107.

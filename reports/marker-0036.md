# marker-0036 — N9-fix Window 1: production reorder mechanism (DORMANT)

- **Commit:** 3268263 (tag marker-0036)
- **Base:** marker-0035 (B23d revert + golden-neutral consolidation).
- **Type:** engine mechanism, DORMANT at default — goldens UNCHANGED.
- **Tests:** 452/452 at commit (450 + 2 N9 sweep tests); 454/454 after H1.
- **Status:** consistent, but INTERMEDIATE — this is Window 1 of a two-window
  fix. The mechanism is inert until Window 2 (marker-0038) activates it. Not a
  standalone shipping change; it exists to be swept.

## What this delivers

The root cause of the AI building zero buildings and zero wonders (measured
across every soak, all civs, 400 turns): in the production want-decision the
economy pick (`stanceBuilding ?? nextWonder`) is DEAD-LAST, behind the walls
slot, the attacker slot (`underArmy`), and the navy slot. Under constant threat
`underArmy` is ~always true (the army target is never met as units die), so the
branch never reaches economy.

The fix inserts a RESERVE slot between walls and the military slots, gated by a
new `aiEconReserve` knob:

```
canWall -> underReserve(econItem) -> underArmy(attacker) -> navyWant(navy) -> dead-last econItem -> settlers
underReserve = econItem != null && city.buildings.length < aiEconReserve
```

Min-defense (`wantDefenders`) + walls stay ABOVE the reserve — defense is never
abandoned. Empire-wide (not interior-only — the border cities are where
production was treadmilled), wonder-inclusive (a qualifying city can reach a
wonder).

## Dormant-capability proof (default 0)

- `buildings.length < 0` is never true → the reserve slot is inert → build order
  unchanged. Verified at RUNTIME, not just by inspection: `node --test
  test/simulation.test.js test/ai.test.js` = 29/29, the sim goldens reproduce
  (soak tail 0x73f85601, natural 0x71bf50f1).
- Goldens UNCHANGED: `simulation.test.js` + `luau-twins.test.js` not modified.
- JS==Luau confirmed via lune (sim-smoke 400 = same four hashes, natural
  0x71bf50f1). Witness byte-identical (0x6d58e1a9).

## Changeset (4 files)

engine/ai.js (reserve slot + `econItem` hoist), data/rules.json
(`aiEconReserve` = 0), luau/ai.luau (byte-shaped twin), test/ai.test.js (2 sweep
tests: reserve 1 builds a building before the 2nd attacker; a wonder-eligible
city reaches the wonder; reserve 0 = identity).

## Deferred (future refinement)

The wonder natural-builder pick (restrict an eligible wonder to the civ's
best-shields city so cities don't race the same wonder). v1 = all-eligible-cities
/ first-to-finish; the minor waste is accepted.

## Next

The sim-runner sweeps `aiEconReserve {0,2,3,4,5} × dg {30,40,50}` on this branch,
seeking the smallest reserve that lifts economy (bldgPct + wonders up) while
HOLDING elim in the 20-40 band at dg=30 (preserving the user's M11 pin). Window 2
(marker-0038) sets the default to the found value and re-records goldens once. A
dg re-pin is conditional on the sweep, not assumed.

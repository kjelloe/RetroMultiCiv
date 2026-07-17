# marker-0046 — settler food upkeep (user-ruled, flat 1 food/settler)

- **Commit:** b77e77d (tag marker-0046)
- **Base:** marker-0045 + golden-neutral commits (civ-themes spec+amendment,
  palette P1, ally cover note).
- **Type:** engine golden window; goldens re-recorded.
- **Tests:** 484/484 zero-skip; JS==Luau.
- **Status:** consistent (ships per the user ruling; the sim-runner's
  expansion-meta A/B informs any value tune only). The merge candidate.

## What this delivers

The user's authenticity ruling (2026-07-17, flat model chosen over the
wiki's per-government 1/2 split — labeled original-shape simplification):
each settler HOMED at a city eats `settlerFoodUpkeep` (1) food per turn at
the city food balance, mirroring the shield-upkeep pattern. Homeless
settlers (the initial createGame settler, old saves) are free — the same
documented deviation class as shields. A settler pushing food below zero
STARVES the home city through the existing path — **settler spam now
self-caps**: over-expansion starves the cities that fund it. Knob 0 =
identity (the A/B off-arm).

## Ruleset-pin ongoing cost (standing doctrine, first occurrence)

Adding the knob to data/rules.json changed rulesetHash (→ 0x805ab94a),
which re-shifted every createGame-derived golden BEYOND the sim goldens:
the A82a map-type anchors and the 002-mapgen contract re-recorded in the
same window. This is the marker-0045 pin WORKING AS DESIGNED — every
future ruleset-touching window budgets the A82a + 002 re-record.

## Goldens

soak 0xbf33e7f6/0xc19df64c/0x1302a905/0x2ba40eef, natural 0xfd86beb4,
002-contract 0xb5e114ff, A82a anchors (4 new), witness 0xdb44c0f4.

## Next in the stream

A79 blockade (sea units adjacent to a city cut its ocean-tile yields) —
the last small designed engine item before the N-queue's bigger slices;
feeds the naval-relevance arc.

# marker-0031 — M11 war-lethality pin

- **Commit:** 7391236 (tag marker-0031)
- **Base:** dev_night after the night-2 arc (markers 0025–0030, see
  `reports/night2-morning.md`) + the A67b/A67c art and A88b refactor.
- **Type:** engine ruleset change (rules-only) with a golden re-record.
- **Tests:** 440/440 zero-skip; golden gate (simulation + luau-twins +
  scout-allocation) 17/17 including the cross-language twins.

## What this delivers

The single user decision from the M11 tuning session: set the war-lethality
dial so some AI civs get eliminated (the target band was 20–40% by turn 400)
without a bloodbath.

- `data/rules.json`: `aiWarDoctrine["1"].defenderGatePct` 100 → 30, and
  `aiScoutQuotaByCities` {1,3,5} → {3,6,10}.
- No engine-code change — the percent-gate machinery already existed (added
  in B26b, marker-0030), so this is a pure config move.

## Why these values

Measurement (10 seeds/cell, 7-civ medium no-chaos): `defenderGatePct 100`
(the prior default) produced ~0% eliminations — too cautious. `defenderGatePct
0` (ungated) produced ~57% — a bloodbath. `30` lands eliminations at ~29%
(band centre) AND simultaneously the highest conquest AND the healthiest AI
economy — no trade-off between war and growth. A follow-up sanity run on the
shipped config confirmed elim ~29–36% median, conquest active every game.

The scout-quota raise ({3,6,10}) is a paired improvement: it moves first
contact between civs from ~turn 141 to ~turn 75 (the AI meets the player
sooner). Both shipped in one re-record.

## Golden re-record

- soak checkpoints: 100=0x021b89c6, 200=0x5eb2ad2e, 300=0x2cfa85b1,
  400=0x73f85601
- natural end: round 395, winner p2, 0x71bf50f1
- luau turn-100 anchor: 0x021b89c6 (JS == Luau confirmed)

## Breaking notes

- Golden re-record (any lane holding old goldens re-bases).
- Not new to this marker but still in effect from the night-2 arc: `npm ci`
  required after pulling (the `@playwright/test` dev dependency from A49).

## Notes

marker-0032 (a provisional opener-scout experiment) was committed on top of
this and then reverted after measurement (see marker-0033); the engine
returned byte-identical to this marker.

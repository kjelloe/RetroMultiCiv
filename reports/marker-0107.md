# marker-0107 — W4 We-Love-the-King-Day (BEHAVIORAL) + W5 relabel + client surface

**Tag:** `marker-0107` @ `8c50ceb` (2026-07-25 evening). **MERGE-CONSISTENT — the
user may merge this** (supersedes marker-0106 as the merge candidate).

Delta since marker-0106 (@6cad106): six commits — one engine golden window (W4),
one comment-only engine relabel (W5), the W4 client surface, the roblox data
re-bake, and two doc/sync commits.

## 1. W4 We-Love-the-King-Day — engine golden window @b813bbc

The fourth window of the v1 engine program (`specs/engine-program-v1.md`; design
`specs/w4-wltkd.md`; effect user-ruled Civ1-faithful, no rapture growth).

Mechanic: at the turn wrap (after disorder, before cities harvest) every city
gets one celebration verdict — `mood.happy * 2 >= pop && mood.unhappy === 0` sets
`city.celebrating` (set-when-true / delete-when-false, mirroring `disorder`;
hash-neutral for a city that never celebrates). While celebrating:
- `corruptionFor` returns 0 (all governments);
- Republic/Democracy add `celebrateTradeBonus` (+1) on tiles already producing
  trade (`govAdjustYields`, both call sites).
- New knob: `data/governments.json` `celebrateTradeBonus` (1 Rep/Dem, 0 others).
- New events `cityCelebrating` / `cityCelebrationEnded` — registered in
  EVENT_TYPES + classifyEvent + soundForEvent (the new-event lesson).
- JS + Luau twins in one window (government/happiness/cities/index twins,
  byte-shaped). Fixture-first: `test/wltkd.test.js` (failed pre-implementation,
  then 2/2). New cross-language scenario `test/scenarios/067-wltkd.json`.

### Classification: BEHAVIORAL — doubly verified, independently reproduced

- Null-and-run (#28 discriminator): BEHAVIOR_SOAK t100 **held** (0x7d88a531,
  byte-identical to D5/W1/W2/W3) while 200/300/400 **moved** — the first soak
  celebration lands between t100 and t200. BEHAVIOR_NATURAL moved.
- sim-runner probe (#2746): 8.745% of living-AI city-turns celebrate-eligible,
  25/25 seeds, peak 25 cities in one turn — despite ~0 happiness buildings
  (small despotism/monarchy cities qualify via the content allowance).
- Reviewer (#2753) reproduced the whole signature under lune: t100-held +
  200-400-moved is the anti-paste-back proof.

### The natural winner-flip is a deterministic butterfly

GOLDEN_NATURAL: rounds 545 → **365**, winner p2 → **p3 by conquest**
(0x79a28572). Probed before pinning: p1/p2/p4 eliminated, barbarians hold 8/10
cities, p3 survives. The reviewer reproduced rounds/winner/hash byte-identical
under lune — a dramatic trajectory change that reproduces bit-exact in BOTH
engines is a legitimate butterfly (mid-game celebrations → more trade → different
wars), not non-determinism. The 25-seed sweep (below) is the distribution check.

### Golden re-record (honest, full cascade)

`governments.json` is in the rulesetHash, so the createGame stamp also rippled:

| Pin | New value |
|---|---|
| GOLDEN_SOAK 100/200/300/400 | 0xb5e2f37b / 0xe98f7580 / 0x3c47ccbc / 0x27e4b6af |
| GOLDEN_NATURAL | rounds 365, winner p3, 0x79a28572 |
| BEHAVIOR_SOAK 100/200/300/400 | 0x7d88a531 (held) / 0x6b608208 / 0xbf8e7a9a / 0xc5b392c9 |
| BEHAVIOR_NATURAL | 0x404fe91f |
| scenario 067-wltkd (new) | 0x56151fa5 (JS==Luau) |
| scenario 002-mapgen | 0x5475e4c4 (JS==Luau) |
| age-snapshots CANONICAL_PIN | 0x45f3dc72 |
| luau sim-smoke t100 | 0xb5e2f37b |
| FF_PARITY | 0x2302c281 |
| A82a maptype pins | 70010874 / 0793c6a9 / 58b57b86 / 8a67565a |

## 2. Gates — both GREEN on b813bbc

- **Reviewer #2753**: clean-clone `--full` 959 tests / 956 pass / **0 fail** /
  3 known self-skips; Luau 400-turn = 0x27e4b6af == committed pin; engine-diff
  (no RNG in W4, flag latched before read — updateCelebration runs after
  updateDisorder, before processCities); twins byte-shaped; scope Civ1-faithful.
- **sim-runner #2755**: 25-seed canonical sweep on the new engine — **25/25
  clean**, every per-turn invariant held; no regression from the behavioral
  re-record. (--stats redirect blocked this session, so this is the invariant
  gate; W4 doesn't touch improvement doctrine, the #2746 floor table stands.)

## 3. Riders on top (all golden-neutral)

- **W5 re-home relabel** @a5b5808: `engine/movement.js` + luau twin comment —
  REHOME is Civ2-shape, not Civ 1 (civ-mixing ruling, provenance labeled).
  Comment-only. Engine program: **5 of 6 windows done — only W6 remains.**
- **WLTKD client surface** @8c50ceb (bugfixer): turnlog rows (🎉 onset row +
  flash, quiet end row), city-panel celebrate banner (disorder banner's
  counterpart), city-overview 🎉 marker. Fog-honest — verified against
  filterView's rival-shell allowlist (`celebrating` never leaves own view).
- **roblox GATE-4 re-bake** @87fd953 (roblox-helper + sim-runner push):
  governments 0x3f8bb6ca → 0xc0cdc126, check.sh 31 gates green.
- **Doc syncs** @08eb7e1 + @86ef436: plan docs, spec delivered-sections, test
  count 906 → 959.

## 4. Test state

Tip verified: scenarios 68/68 (067 included) + wltkd + event coverage + mock-state
= 86/0. Gates: clean-clone 959/956/0-fail (reviewer), twins 11/11 under lune
(local + reviewer), 25-seed sweep clean (sim-runner). Only local red anywhere: the
gitignored B13-witness recording (stale pre-re-record; self-skips in clean clones;
regen pending on the sim-runner clone).

## 5. Breaking notes

None for running games (the celebrate flag appears only at a wrap; saves without
it load unchanged). For anyone replaying OLD recordings against the new engine:
recordings that cross a wrap where a city celebrates will diverge — expected for
a behavioral window; `tools/replay.js` names the first divergent command.

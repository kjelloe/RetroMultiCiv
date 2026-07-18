# N9b — AI build priority + the builder wonder-drive: buildable spec (architect, 2026-07-18)

USER-RULED SHAPE (2026-07-18 AskUserQuestion): lever = HYBRID (global
payback-aware floor + stance multiplier); wonders = BUILDER
WONDER-DRIVE (dedicated, builder-stance civs only); guardrail = MILD
BAND SHIFT ALLOWED (elim median 15-40 at dg=30, widened from 20-40).

Measurement basis — three independent probes converge on build
priority as the binder (tech pace exonerated):
- #1385: Republic halves paybacks (marketplace ~40t at pop 6) yet
  bldgPct stays ~8-10%; the behavior never follows the lever.
- #1399/#1408: space unreachable at t400 but research ACCELERATES
  late-game — pace is not the constraint anywhere.
- #1465: Leonardo built 0/25 despite invention reached in 14/25
  seeds — 400-shield commitments never happen even when enabled.
Field confirmation: benchmark #1 (all-Monarchy 1775 AD, zero
buildings).

## Design principle: NO rules.json change

All knobs are AI BEHAVIOR (the A40/government-re-eval precedent):
constants live in the ai.js behavior tables (+ luau twin), NOT in
data/*.json. Consequence: NO rulesetHash ripple — this window's
golden move is PURELY BEHAVIORAL (soak/natural/turn-100 + witness
re-record; A82a/002 anchors and both data checksums UNCHANGED).
Constants ship provisional, sim-swept, then pinned in the two-phase
close (the stance-mix precedent: no provisional pin reaches the
committed timeline).

## 1. The building lever (all stances)

At the production-choice site, when a city would currently pick a
unit: score each BUILDABLE building by PAYBACK — estimated turns for
its yield effect to repay its shield cost.
**VALUATION SEAM (ruled #1549, correcting the spec — bugfixer
Finding-1): cityYields returns ONLY worked-tile food/shields/trade;
the building's actual value (marketplace taxBonus, library sciBonus,
bank/university) lives in the INLINE income math in tech.js
playerIncome.** So the payback denominator is NOT cityYields — it is:
EXTRACT `cityEconOutput(state, city, me, ruleset) -> gold+bulbs` (the
verbatim playerIncome inline math) into a helper, reuse it in
playerIncome (BYTE-NEUTRAL — output identical, proven, so the
refactor moves no golden) AND in the lever:
`payback = idiv(cost, max(1, econOut(cityWithBuilding) - econOut(city)))`.
This honors "no parallel formula" (option B's ai.js re-derivation
would BE the forbidden parallel formula — the C2/drift class).
Touches ai.js + tech.js + both luau twins; still behavioral-only (no
rulesetHash, no upkeep term — buildings are upkeep=0 per #1315).
Weighting: gold+bulbs 1:1, integer idiv, zero-delta buildings skipped. If the best
building's payback < PB_MAX (provisional 40), the city builds it
INSTEAD of the unit — gated by a garrison floor (never displace the
first defender; reuse the existing garrison-count seam) and an
enemyNear check (threatened cities keep building units).
STANCE MULTIPLIER on PB_MAX: builder ×1.5 (builds down to weaker
paybacks), balanced ×1.0, defensive/science/growth ×1.25, future
aggressive ×0.5 (provisional values, sim-swept). Deterministic
tie-break: lowest building cost, then catalog order.

**R1 PIN (reviewer #1521, REQUIRED — the shield-forfeit thrash):**
switching production CATEGORY forfeits HALF the accumulated shields
(cities.js), and the AI re-decides `want` every turn — command
idempotency (the existing re-emit guard) is NOT decision stickiness,
and that distinction is load-bearing: without stickiness, a frontier
city flip-flops unit↔building on enemyNear flutter or
payback-boundary flutter, burning half its box each swing and
completing buildings SLOWER than with no lever. Pin, for the lever
AND the wonder-drive alike: (1) once a city is building a
still-legal, progressing BUILDING, PREFER it — never re-decide to a
unit on payback flutter; (2) enemyNear is the ONLY legitimate
interrupt, and even it is gated on the garrison floor (a
fully-garrisoned city does not abandon a near-done building for a
surplus unit); (3) the wonder-drive's persist = keep the WONDER ID
already in progress — never re-pick "cheapest available" once
committed (a newly-unlocked cheaper wonder must not flip the drive).
Fixture: the 2-turn no-thrash case — a city mid-marketplace with an
enemy arriving adjacent keeps the marketplace while its garrison
floor is met.

**R2 (scope line):** the lever augments the UNIT-vs-YIELD-BUILDING
choice only. Non-yield buildings (granary, aqueduct, walls,
courthouse) have no payback and RETAIN their existing
stanceBuilding/nextBuilding route — the lever is not the only
building path.

**R3 (composition):** for defendFirst stances the existing
defBuild/econReserve machinery already builds economy — the new
lever DEFERS wherever defBuild fires (layer under, never
double-count). The measurable lift is therefore on BALANCED (and
future aggressive), and the sweep's targets read accordingly: the
builder ×1.5 multiplier matters mainly where defBuild doesn't reach.

## 2. The builder wonder-drive

BUILDER-stance civs only. Trigger at the same production-choice site
for the CAPITAL (fallback: highest-shield city): when (a) a wonder
is available to build, (b) no enemyNear, (c) city shields/turn >=
WONDER_MIN_SHIELDS (provisional 5), commit to the CHEAPEST available
wonder and PERSIST until complete (production persistence already
exists; do not thrash). One wonder in flight per civ at a time.
Non-builder civs keep their current opportunistic path (they may
still build wonders; they get no drive). This delivers "some civs
MUST build wonders" visibly — the user's archetype vision — and
gives Leonardo/A76 a real chance of appearing in long games.

## 3. Acceptance gate (sim-runner, on shipped code, vs the 0058 baseline)

**REFINED by the designer ally 2026-07-18 — the test is SELECTIVE +
PRODUCTIVE building, not "bldgPct went up." The provisional
8%→45% is a SIGNAL, NOT a target: 45% would be disastrous in a
threatened/expansion-heavy empire (production starved from defense/
settlers). Pick constants for "the RIGHT cities build the RIGHT
infrastructure at the RIGHT time." If two configs tie, prefer the
LOWER-bldgPct one (selectivity over volume).**

1. Building share RISES MATERIALLY from ~8% but stays SELECTIVE — NOT
   build-everything. (Report the DISTRIBUTION: are the builders the
   productive cities?)
2. CITY-ROLE DIFFERENTIATION: productive cities take wonders/key
   units; trade-rich cities take economic/science buildings; exposed
   cities keep defense priority.
3. FRONTIER SAFETY (hard guardrail): NO rise in undefended-city
   losses / emergency-garrison failures / barbarian collapses vs 0058.
4. PAYBACK LOGIC: low-yield or soon-to-be-lost cities do NOT sit on
   poor-return infra.
5. WONDER PARTICIPATION: a MINORITY of eligible civs pursue wonders;
   builder civs complete ≥1 wonder median seed; NO single civ
   monopolizes every game's wonders (report which civs).
6. WONDER CANCELLATION: a lost race ends PROMPTLY + cleanly, freeing
   the city for an alternative build.
7. ELIM median 15-40 at dg=30 (user-widened band; below 15 fails —
   the anti-pacification guardrail).
8. HUMAN-BENCHMARK NO-REGRESSION: city count, research pace, survival,
   challenge vs the matched replay baseline must not drop.
9. ENDGAME: in a marathon scenario, an AI that reaches the tech
   actually BEGINS the Apollo/wonder prerequisite chain (the ending-#4
   proof).
10. M2/M3/M4 floors move toward targets.
11. Two-phase close: constants pinned only after the sweep; ONE
    golden re-record.

## Tests

Fixture-first: a city with a <40t-payback building available picks
it over a unit (crafted state); the garrison floor holds (threatened
city still builds the defender); a builder capital commits to a
wonder and persists; a non-builder capital does not; scenario pin
(NNN-build-priority) cross-language for the chooser mechanics.
Goldens: behavioral re-record only (verify anchors/checksums
unchanged — no data edit).

## Provenance

Original, Civ1-consistent AI behavior (the wiki is silent on Civ1
build AI — the government-re-eval precedent label). No new state
fields; no new events (production choices are already visible via
existing events).

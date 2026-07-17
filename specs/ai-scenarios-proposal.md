# AI-quality scenarios + factors to simulate — proposal (sim-runner, 2026-07-17)

Ranked by impact × 1/cost, grounded in MEASURED behavior (not guessed).
User-requested. Feeds the next wave of the AI-quality program (docs/05 §12 +
docs/15). Method note (hard-won): match the yardstick to the goal — N4's
unit-count and N9's bldgPct-dilution both taught that the obvious metric can
be the wrong one.

## Tier 1 — highest impact, evidence in hand
1. **WONDER RACING** — the AI builds ZERO wonders, EVER (wonders=0 /
   wonderAct=0 across every soak, all civs, 400 turns). Bigger than N9; same
   dead-last-production-slot starvation. [H impact, L cost — the wonder%
   column already reads 0.]
2. **ECONOMY-AT-PEACE** — is the AI economy-competent at lower war intensity
   (dg 50/70/100), or does it never build economy even in peace? A
   defenderGatePct × bldgPct sweep. Directly answers whether the economy
   starvation (N9) is war-caused (the dg=30 cascade) or fundamental. [H, L]
3. **NAVAL back-half** — cross-water NEVER fires (aboard=0 always); archipelago/
   islands maps are unwinnable for the AI. Gated on N3-build-tune. [H, M]

## Tier 2
4. **DIFFICULTY-SCALING FAIRNESS** — is trainer..godemperor a genuinely smarter
   AI or just bonuses + chaos? difficulty × {elim, cities, pop, tech}. [H, M]
5. **HUMAN-BENCHMARK vs the user's Shift+D recordings** — replay + compare
   cities/tech/buildings-by-turn; quantifies WHERE the AI is sub-human (the
   standing "challenging, legible, fair vs the human line" target). [H, M]
6. **TECH-PATH DIVERSITY** — do all civs research the same path / beeline the
   same key techs? A tech-order histogram. [M, L]

## Tier 3
7. Multi-front war (1v3 survival). 8. Edge configs (all-pacifist / all-
   aggressive, tiny / huge maps). 9. Government transitions (do civs ever reach
   Republic/Democracy? if not it COMPOUNDS the economy gap — ties to N1). 10.
   Happiness/disorder management.

## Parked
11. Diplomacy readiness — phase 6, gated on A59 + D1.

## Sim-runner's pick for the next 3
Wonder-racing + economy-at-peace (near-free, likely the two biggest "AI feels
dumb" levers after N9), then difficulty-fairness (highest user-facing payoff).

## Architect note — RESOLVED by the economy-at-peace disambiguator (sim-runner #1025, 2026-07-17)
The question was: is the economy/exploration/wonder cluster caused by the
dg=30 war pin, or fundamental? ANSWER = **FUNDAMENTAL**. Measured across dg
{30,50,70,100}: bldgPct AND wonders are ZERO at every war level including full
peace (dg100, elim 0). Lowering war does NOT make the AI economy/wonder
competent — the build-priority dead-last slot never lets buildings/wonders run,
war or peace. And relaxing dg is WORSE: at peace exploration halves (15→7),
cities drop (3→1), pop drops — WAR is what drives the AI's expansion/scout
activity. CONCLUSIONS: (1) the **dg=30 pin is VINDICATED** — it's the
war-lethality lever, not the economy culprit; there is NO dg tradeoff to weigh.
(2) The fix is the **PRODUCTION ORDER directly** (N9-fix: reserve a slot for
buildings+wonders above the perpetual military slots, empire-wide +
wonder-inclusive). (3) DOWNSTREAM: a healthier AI wages more effective war, so
the M11 pin (calibrated for today's economy-starved AI) will over-elim once the
fix lands → a dg RE-PIN is needed then (a mini-M11, likely a lower dg for the
same 20-40 band). B23d (exploration) was reverted — its failure was the
war-cascade symptom; the economy/wonder root is what to fix, and it's
independent of dg.

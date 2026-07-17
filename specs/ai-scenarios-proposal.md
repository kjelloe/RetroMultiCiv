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

## Architect note (systemic tension, 2026-07-17)
B23d (exploration) and N9 (economy) BOTH fail via the dg=30 warfare cascade —
the M11 war pin that gives elim 27% also makes the map too dangerous to scout
AND starves economy. Scenario #2 (economy-at-peace) is the key test: if the AI
IS economy-competent at dg 70/100, the fixes should gate on war intensity (or
the dg=30 pin is too aggressive for a well-rounded AI — a user tradeoff). If
it's economy-incompetent even at peace, the build-priority fix (N9) is
fundamental regardless of war. Run #2 EARLY — it disambiguates the whole
exploration/economy cluster.

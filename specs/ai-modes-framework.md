# AI strategic-modes framework — designer-ally feedback (2026-07-17)

Verbatim-in-substance capture of the ally's AI-engine-simulation feedback,
reconciled against the current program state. This is the REFERENCE for the
AI-quality lanes: the sim-runner's instrumentation plan, the stance/mode
design arc, and the experiment sequencing. The ally holds design authority
on feel/direction; the architect sequences; measurements gate everything.

## Bottom line (ally, verbatim intent)

The goal is NOT "make all AI civilizations equally likely to win." It is:

> On an appropriate map, each leader pursues a visible, coherent plan;
> expands, defends, researches, builds, fights, and changes plans in ways a
> human can understand; and remains competitive against the project's
> recorded human benchmark without cheating.

If the simulator can show that, the final distribution of attackers,
defenders, science, buildings, and wonders EMERGES from the game state
rather than from a fragile global percentage.

Corollary hypothesis: a convincing opponent is not one with the "best"
ratios — it is one that visibly pursues a coherent plan, notices danger and
opportunity, and changes course before it is too late. Humans accept a
beatable, occasionally imperfect opponent; they do not accept one that
feels arbitrary, passive, omniscient, or mechanically confused.

## How this maps onto what exists (architect reconciliation)

- The ally's **strategic modes** are the evolution of the A40 STANCE table:
  today's stances are static per-seat knobs; the v1 stance-mix (sim-runner
  confirmed 2026-07-17: 2agg/2sci/3bal holds elim in-band at dg=30 AND
  completes wonders) is the STATIC first step. The modes framework is the
  DYNAMIC successor: a civ transitions Opening → Expansion → Development →
  Border-defense → … driven by game state, with leader weights choosing
  between valid modes.
- The ally's **threat-relative garrison formula** supersedes the flat
  `garrisonAlways2`/`wantDefenders` logic — it is the designed answer to
  the defender-treadmill root cause behind N9 (economy starvation) and the
  B23d exploration failure.
- The ally's **wonder policy** (one qualified city, completion estimate,
  abandonment) refines the v1 nextWonder + capital-concentration shape.
- The ally's **experiment waves 1–8** replace ad-hoc sweep sequencing; the
  ally's **scenario families** extend A82 map types into test worlds.
- The **human-benchmark gap** (same-seed AI vs recorded human Shift+D
  replays) is the primary target metric — already Tier-2 #5 in the
  sim-runner's proposal; the ally elevates it to primary.

## A. What to simulate over 400 turns

Stop treating the AI as one set of fixed production percentages; simulate a
policy that changes by game phase and state. Record not just who won but
how the game FELT and why it ended.

### 1. Game outcome metrics

| Metric | What to measure | Why |
|---|---|---|
| Victory type | Conquest, score, spaceship, timeout | A healthy set does not produce only one victory route |
| Winner distribution | Wins per leader, civ, stance, start position, map type | Finds leader/map/start bias |
| Victory turn | First elimination, decisive lead, launch, final victory | Too early = rush; too late = stagnant slog |
| Score spread | Leader/median and leader/lowest-living at t100/200/300/400 | Detects runaway empires early |
| Elimination rate | Civs eliminated by t100/200/300/400 | Too high = excessive lethality; too low = passive stalemate |
| Comebacks | Behind at t150/200, later wins or competitive | Can strategy/tech/war reverse a poor opening? |
| Human-benchmark gap | Same seed: AI progress vs recorded human baseline | PRIMARY target — AI-vs-AI balance alone can look convincing but play weak |

### 2. Empire health metrics (per civ, every 10–20 turns)

Expansion (cities founded, settlers produced/lost, site attempts — warning:
one-city stagnation OR unchecked spam) · Population (total, per-city, growth
stalls) · Economy (income, treasury, maintenance, rush-buy use, deficit
turns — warning: hoarding, bankruptcy loops, no emergency spending) ·
Research (tech count, rate, era, turns-since-advance — warning: monarchy
monoculture, tech ceiling) · Production (shields, idle, completed, obsolete
builds) · Happiness (disorder turns, entertainers, luxuries, martial law) ·
Infrastructure (libraries/temples/markets/walls/roads/irrigation) ·
Military readiness (attackers/defenders/veterans/upkeep/mobile reserve —
warning: defender bloat, no offense, unsupported conquest) · Territory
(explored, contacts, overseas reach) · Naval/air (built, water explored,
cargo crossings — a capability existing in code but dormant in games) ·
Wonders (attempts, completions, failed races, opportunity cost).

### 3. Decision-quality metrics

More valuable than final score — they identify WHICH policy was wrong.
Record per decision: city production choice (chosen item + alternatives +
city state + threat + empire need), research selection, settler decision
(site value, travel time, escort, danger), building decision (predicted vs
realized benefit after 20–50 turns), attack decision (odds, target value,
force ratio, supply distance), defensive decision (threat estimate,
garrison requirement, emergency rush-buy), wonder decision (commitment,
race state, finish estimate, cancellation), government decision.
Healthy pattern: choices change sensibly with circumstances; a leader has
personality but abandons a poor beeline when circumstances demand.

### 4. Scenario families (same instrumentation across all)

Pangaea/crowded (early contact, land war) · Continents (balanced then
overseas) · Terra (full naval colonization loop) · Archipelago/Islands
(naval AI essential, not cosmetic) · Highlands (chokepoints, terrain
defense, siege) · Lakes (CONTROL: verifies the AI does NOT overinvest in
naval) · Rich/poor starts (adaptation to uneven yields) · Isolated start
(science/growth without war pressure) · Border-pressure start (garrisons,
threat response, walls) · Later-era start (modernization, government
selection, obsolete replacement — `?age=` fast-forward already exists).

### 5. Minimal per-turn AI trace (debug/sim output, NEVER game state)

Every 10 turns, per AI, a compact deterministic strategic snapshot:

```
{ turn, civId, strategicMode, threatLevel, cityCount, sciencePerTurn,
  treasury, currentGovernment,
  unitCounts: { attackers, defenders, settlers, naval },
  productionBudget: { military, defense, settlers, infrastructure,
                      wonders, reserve },
  currentResearch, topGoal }
```

Lets the architect see whether an AI lost because its priorities were wrong
or because priorities were right but execution failed. Stays in diagnostics
(the soak --stats / telemetry channel), never authoritative state, never
hashed.

## B. Recommended strategic modes

Leader weights choose between valid modes; world state can override.

| Mode | Primary goal | Trigger |
|---|---|---|
| Opening | Secure capital, reveal nearby land, first expansion | t1–50 / few cities |
| Expansion | Claim viable land without losing the homeland | Good sites found; territory available |
| Development | Convert cities into research/production/income | Land claimed; threat low |
| Border defense | Prevent city loss, deter opportunists | Known enemy force / exposed frontier |
| Limited war | Capture ONE valuable city or remove a specific threat | Favorable odds, reachable target, clear objective |
| Total war | Eliminate or break a weakened rival | Enemy collapsing or existential war |
| Naval exploration | Find coasts, contacts, islands, routes | Separated land / coastal opportunity |
| Overseas expansion | Settle or seize another landmass | Viable target discovered |
| Modernization | Replace obsolete forces, unlock endgame | Successor techs / late era |
| Victory push | Convert advantage into a win condition | Lead established / victory path attainable |
| Recovery | Survive after a major setback | City loss, disorder, deficit, collapse |

Better than a static `militaryWeight`: Caesar and Lincoln can both enter
border-defense but make different choices once there.

### Phase priors (TEST STARTING PRIORS — sweep, never lock)

| Phase/state | Settlers/civ | Attack | Defend | Buildings | Sci/econ | Wonders |
|---|---:|---:|---:|---:|---:|---:|
| Opening, safe | 25–35 | 15–25 | 15–25 | 20–30 | 10–20 | 0 |
| Expansion, safe | 25–35 | 15–25 | 15–20 | 20–30 | 15–25 | 0–5 |
| Development, safe | 5–15 | 10–20 | 10–20 | 30–40 | 25–35 | 0–10 |
| Border pressure | 0–10 | 25–40 | 25–40 | 10–20 | 10–20 | 0 |
| Limited war | 0–10 | 40–55 | 15–25 | 10–20 | 10–20 | 0 |
| Total war | 0–5 | 35–55 | 25–40 | 5–15 | 5–15 | 0 |
| Modern peace | 5–15 | 15–25 | 10–20 | 20–30 | 25–35 | 0–10 |
| Wonder race | 0–10 | 10–20 | 10–20 | 15–25 | 15–25 | 10–25 in ONE city |

Percentages are EMPIRE production intent, not per-city uniformity. City
roles: frontier (defenders/walls/roads), high-production (attackers/siege/
wonders), high-trade (research/economy buildings), new settlements (food,
basic defender, then specialize), coastal (ships only when the map
justifies).

## Practical production rules ("floors and ceilings, not exact ratios")

- ≥1 capable defender in every non-safe city; a mobile reserve near active
  borders.
- No 3rd defender in a secure interior city while an unsettled high-value
  site exists.
- No wonder if completing it leaves a frontier city undefended.
- No new attacker if the army lacks siege/transport/roads/a target.
- No building unless the city recovers the investment within a horizon.
- No favorite tech while a survival-critical prerequisite is missing.
- No unescorted settler when local danger exceeds threshold.

**Threat-relative garrison** (the answer to defender bloat — NOT a lower
global weight):

```
required garrison = base city safety
                  + nearby known enemy attackers
                  + border exposure
                  + city strategic value
                  - nearby friendly mobile reserve
```

**Objective-based attack forces** (legible war): declare objective (capture
City X), needed composition (attackers/escorts/siege), required odds,
deadline (reassess in 15 turns), abort conditions (target reinforced, route
unsafe, homeland threatened). The player can SEE a border army gathering
and understand why war happened.

**Science as strategic investment**: reduce temporarily to avoid disband/
riots/city loss; save gold in peace if war likely (rush-buy defense);
prioritize enabling techs (Map Making, walls/siege prereqs, transport,
government paths) over distant favorites; restore after emergencies.

**Wonders opportunistic and leader-flavored**: ONE qualified city; adequate
production + acceptable completion estimate; empire safety/economy minima;
leader favorite = preference not obligation; ABANDON if an opponent
completes it or the payoff no longer justifies. Creates memorable races
without making every game a wonder contest.

## Experiment matrix (waves — start narrow, never sweep everything at once)

| Wave | Variable | Success measure |
|---|---|---|
| 1. Safety floors | Min garrison + mobile reserve | Fewer city losses AND fewer idle defenders; no city-count regression |
| 2. Expansion balance | Settler trigger, escort rule, site threshold | More viable cities without exposed losses / economic collapse |
| 3. Production specialization | City roles + building-return threshold | More research/production, fewer low-value buildings |
| 4. Offensive doctrine | Objective-based forces + attack threshold | Meaningful wars, fewer suicide attacks, fewer standoffs |
| 5. Research/government | Emergency override, govt reassessment | Era progression, varied governments, no collapse |
| 6. Wonder policy | Eligibility, abandonment, leader preference | Memorable races; low opportunity-cost damage |
| 7. Naval doctrine | Coast value, ship roles, transport/escort | Contact/settlement/invasion where the map justifies |
| 8. Full personality sweep | Leader weight deltas + adaptability | Distinct leaders; no stance consistently noncompetitive |

Every wave: multiple map types × multiple seeds × several stances × human
benchmark replays AND AI-only stress × regression vs the accepted baseline.

## Program sequencing (architect)

- **v1 (in flight, unchanged by this doc):** static stance-mix assignment
  (the confirmed 2agg/2builder/3bal shape at dg=30) + capital-concentrated
  wonder trigger. Ships first; it is wave-0 and the baseline for everything
  above.
- **v1.5 (instrumentation before behavior):** the §A metrics + the §5
  strategic snapshot in the soak/telemetry channel. Measurement capability
  FIRST so every later wave is scored consistently. Golden-neutral
  (diagnostics only).
- **v2+ (the waves):** modes + threat-garrison + objective war + wonder
  policy etc., one wave per golden window, each gated on its success
  measure and regression vs baseline. Wave order per the matrix.
- The four target endings (see the archetype/endings vision, 2026-07-17)
  are the acceptance frame for waves 4–8: pacifist points, early conquest,
  economic-builder late war, space-race climax.

# AI war-making — the doctrine and the design options

Status: SEEDED 2026-07-16 from the user's doctrine (his words are
the spine); the OPTIONS below are the agenda for the war design
session. Prerequisites: the baseline facts (docs/05 §12 — no
attacker ever built, armies 59–100% stationary, zero cross-water)
and A63's obsolescence so armies modernize.

## 1. The user's doctrine (design authority)

- **Group units into armies** — defensive + offensive together;
  maneuver so weak defenders are never exposed to flanks/attacks.
- **3:1 attacker-defender logic** as the regular engagement rule.
- **Economy scales ambition**: when production supports it, larger
  armies for a FULL-FRONT multi-city attack that overwhelms
  defenders.
- **Sieges**: besiege cities and PILLAGE surrounding improvements so
  the city falls into low production and disarray.
- **Blockade rule (engine change, own item A79)**: an enemy unit
  standing on a city's resource tile BLOCKS working that tile.
- **Era templates**: tactics shift with tech — e.g. a carrier group
  with 3:1 cruiser support; 3:1 cruiser-to-transport escort on
  contested routes (unescorted only when the route is safe).

## 2. Options for the session (the discussion agenda)

1. **What does 3:1 govern? RULED (user, 2026-07-16): BOTH** —
   compose toward it AND engage at it — "even if it is accidental."
   AND the ratios are HYPOTHESES, not constants: the ratio lives in
   rules.json and the SIM-RUNNER SWEEPS it (2:1, 3:1, 4:1, 5:1 for
   both the composition ratio and the engagement threshold,
   independently) — the M-columns decide which pair wins wars
   without tanking economies. Measurement picks the number; 3:1 is
   the opening bid. ADDENDUM (user, 2026-07-16): the COMBAT RULE
   (Civ 1 one-roll vs best-of-three) is a sweep axis too — upset
   variance differs, so the optimal (R,E) likely differs per rule,
   and the shipped constants may be a per-combat-rule table in
   rules.json rather than one global pair.
2. **Army abstraction**: (a) EMERGENT — units share a target and
   converge (no new state, pickCommand coordination via shared
   objectives derived per turn); (b) EXPLICIT ARMY GROUPS — a
   driver-level grouping (state-free, recomputed per turn) with
   roles (spearhead/escort/reserve); (c) STATE armies (persistent
   ids — heaviest, replay-visible). Recommendation: (b) — derived
   groups, deterministic from state, no shape change.
3. **Target selection**: nearest-weakest city vs leader-capping
   (the baseline says leaders go unpruned — M14 wants the AI to
   preferentially check the runaway) vs personality-driven
   (aggressive leaders raid strongest neighbors, growth leaders
   snipe undefended land). Likely: base score = value/defense/
   distance, personality-weighted, leader-bonus term.
4. **Siege mechanics**: pillage-adjacent-then-assault needs a
   PATIENCE model (how many turns of siege before the assault or
   walk-away?) and interacts with A79's blockade (surrounding a
   city starves its tiles — siege emerges from the blockade rule
   almost free).
5. **Retreat/regroup**: when the 3:1 read collapses mid-campaign —
   fall back to the nearest own city vs fortify in place. Cheap
   rule needed, else armies suicide (today's AI attacks at any
   odds when it attacks at all).
6. **Naval doctrine** (post-A69/A72): escort ratios per the user's
   templates; SAFE-ROUTE definition (no enemy naval sightings
   within N tiles for M turns — fog-honest, from the civ's own
   knowledge model, B13/A63's best-seen ledger).
7. **Telemetry signatures** (ship with the program): armies formed,
   mean army size, attacks at ≥3:1 vs below, sieges started/won,
   pillage counts, retreat events — all M-column extensions so the
   doctrine is measurable per stance. ALLY ROUND-6 MATRIX ADDITIONS
   (2026-07-16, adopted for the naval/air/walls/siege experiments):
   victory type + winner, game length, average city defense
   strength, walls built, unit losses BY CLASS, naval engagements,
   transport losses, aircraft sorties + results, science/production
   share, stance, combat mode, map size + water percentage. Goal
   framing (ally, kept verbatim): not "make every strategy equal"
   but "every major strategic path has conditions where it is
   coherent, visible to players, and counterable".

## 2b. FIRST SWEEP RESULTS (sim-runner lab, 2026-07-16 night — default topology, no-chaos, both combat rules)

- **E (engagement) is the entire lever; R (composition) as
  formulated is INERT above 2** — attrition keeps attacker counts
  below saturation, so "attackers per own defender" never binds.
  Reformulate R as ratio-to-KNOWN-ENEMY strength or an absolute
  army budget (proposal #3).
- **The user's 3:1 grades WELL: it is the kill-efficiency peak**
  (k/l: E2 0.61, E3 0.71, E4 0.50, E6 0.50).
- **But efficiency ≠ conquest**: the disciplined doctrine
  underperforms the shipped any-odds swarm on raw captures (5 vs 68
  per 10 games) while costing ~40% of population growth — it trades
  mass for a 2.3× better kill ratio and a tighter competitive
  spread (M14 6.8→3.0). Fewer, cleaner, mostly-losing skirmishes.
- **SIEGE IS THE MISSING GATE TO CONQUEST**: walled/fortified
  cities defeat even 3:1 stacks because the stack-sum gate
  mismatches Civ 1's one-shot PER-UNIT combat — each attacker rolls
  alone. Per-unit odds gating + pillage/wall-reduction are the real
  levers (the user's siege doctrine, vindicated by measurement).
- **Exploration blindness is fatal to fog-honest war**: with honest
  targeting, same-continent civs never find each other (the lab had
  to relax fog to measure anything). The explore weight is a
  war-prerequisite knob, not polish.
- **Eliminations are barbarian-driven**, not doctrine-driven —
  deadCivs is not a war metric on this topology.
- Lab identity proof: the control cell reproduces pristine baseline
  hashes byte-for-byte. Instruments (fog-relaxed targeting, greedy
  stepper) are lab-only; the shippable AI stays fog-honest.

## 2c. ROUND 2 RESULTS (same night)

- **Per-unit odds gating CONFIRMED as the correct gate — and its
  constant is COMBAT-RULE-KEYED** (the strongest per-rule signal of
  the job): best-of-three at per-unit E≈2 is net-positive (k/l 1.1,
  73% win rate); under ONE-ROLL no odds gate reaches net-positive —
  single-roll variance defeats every ratio, so one-roll aggression
  needs MASS (overwhelming numbers), not odds. The AI's war
  constants will be a per-combat-rule table (the user predicted
  this before the data existed).
- **Composition ratio is inert under BOTH formulations** (per-own-
  defender and per-known-enemy) — attrition saturates it; do not
  pin R as a tunable until conversion works.
- **Siege is unmeasurable because AI CITIES ARE NEVER WALLED**
  (0/36 at t300 — masonry sits off the beeline and the cheapest-
  building picker never reaches walls): the capture barrier is
  fortified units, not walls. AI DEFENSIVE BUILDING (walls priority)
  is a named gap feeding B13/M7.
- **Winning battles ≠ winning wars**: 73% win rates still produce
  rare captures. The next lever is CITY-ASSAULT COORDINATION
  (stack and focus one city) — round 3 tests it.

## 2d. ROUND 3 RESULTS — the campaign's answer (same night)

**COORDINATION CONVERTS WINS INTO CAPTURES, and the combat rule
picks the whole doctrine** (the user's per-rule prediction, proven
three ways in one night):
- **ONE-ROLL → MASS, NOT ODDS**: coordinated pile-in with NO odds
  filter = 34 captures/10 games (6.8× baseline), 7 eliminations —
  decisive conquest by volume (724 attacks at 42% each, 944 losses:
  a meat grinder — yet population ends HIGHER because captured
  cities replace the dead).
- **BEST-OF-THREE → ODDS-GATED SURGICAL MASS**: per-unit E=2 +
  coordination = 14 captures at 23 losses (58–60% win rate) —
  limited war, quality over quantity, 3 eliminations.
- **The mass threshold is SMALL**: S=3–5; over-massing (S=8) is
  strictly worse in both rules — assemble enough to cascade, never
  idle staging.
- Ranked next for the program (with the user, data in hand):
  topology (A82, the master variable), target selection under
  coordination (focus the M14 runaway?), retreat-on-failed-assault,
  defensive wall-building AI (so siege becomes live), multi-front
  waves (one-roll can afford 2 fronts; bo3 cannot).

## 3. Sequencing — ADOPTED (user, 2026-07-16 morning, data in hand)

Per-combat-rule doctrine table in rules.json (one-roll = mass
doctrine, no odds gate, coordinate S=3–5; best-of-three = per-unit
E≈2 odds-gated surgical mass), derived army groups (state-free),
nearest-city targeting first (leader-capping = a later sweep).
BUILD ORDER: the B13 era-scaling family FIRST (obsolescence +
attackers + explore-weight + walls-building — the two war
prerequisites the lab exposed) → the coordination doctrine window →
siege (live once walls exist). EXECUTED 2026-07-16: B13 landed,
then the re-baseline exposed the capabilities as DORMANT (docs/03),
so B21 (build-slot/beeline/rush-buy/scout-share) was inserted and
landed same day — attackers now exist at t200. COORDINATION waits
on the post-B21 sweeps; SIEGE waits on coordination + walls-in-play
(walls ship in B13g, sparse pending tuning). Topology (A82) joins the sweep
matrix when it lands; every slice lab-measured no-chaos, both
combat rules, per-stance signatures.

A63 obsolescence (armies must modernize first) → attacker
production + composition (the 3:1 build side) → engagement doctrine
(engagement odds + retreat) → sieges/blockade (with A79) → naval
templates (after A69/A72). Every slice: lab-measured under the
no-chaos baseline config (docs/05 §12 flag), signatures per stance,
goldens re-record per window.

## 4. The factor catalog (designer ally, 2026-07-16 — verbatim in specs/ingame-AI-factors.md; architect triage)

Ten factor groups for the simulation program. Triage against what
already exists — the catalog becomes the COMMISSIONING MENU for
sim-runner rounds after the era-scaling re-baseline:

- ALREADY IN FLIGHT: group 5 (walls = B13g with its within-8
  threat radius as the sweep constant; ZOC = B18 landed), group 6
  target-selection (the coordination-doctrine window's ranked
  question), group 7 naval (A69/A79/M13 + the user's escort
  doctrine §1), group 8 spaceship queueing (A76), obsolete-stack
  transition (B13a).
- NEW SWEEP AXES, ADOPTED (priority per the ally, gated on the
  knobs living in rules.json per the B13f pattern): (1) TECH PATH
  strategy — beeline vs broad-front, military/economy/science
  ordering; pairs with A59 leaders' favorite-beeline design, and
  the revolution-timing knob (group 4) interacts strongly with it
  (his research-path × government cross-experiment, adopted).
  (2) ECONOMIC coherence — dynamic tax slider, luxury-vs-temples,
  RUSH-BUY threshold (the baseline's "no buys ever" gap, now a
  sweepable policy), his tax × rush-buy × wonder-priority cross.
  (3) CITY PLACEMENT quality metrics — resource-coverage %,
  corruption-aware capital distance, coastal preference (feeds
  A82 island worlds), chokepoint founding.
- NEW METRICS (M-column candidates at the re-baseline): garrison
  ratio interior-vs-front, resource coverage by t50/100/200,
  disorder turns, river-crossing attack share.
- GROUP 10 + META, ADOPTED AS A STANDING PRINCIPLE: difficulty =
  which LEVERS feel fair, and the HUMAN BENCHMARK — the user's
  real playtest recordings (Shift+D diags already carry full
  metrics-derivable state) become a baseline row next to AI
  configs; the target is "challenging, legible, fair", not AI
  self-play win rate (docs/05 §12 note).
- His experiment structure (control/one-variable/fixed seeds)
  matches the lab process; cell size grows 10→25+ seeds as runs
  get cheaper post-window.

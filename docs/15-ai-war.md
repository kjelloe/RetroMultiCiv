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
   doctrine is measurable per stance.

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

## 3. Sequencing

A63 obsolescence (armies must modernize first) → attacker
production + composition (the 3:1 build side) → engagement doctrine
(engagement odds + retreat) → sieges/blockade (with A79) → naval
templates (after A69/A72). Every slice: lab-measured under the
no-chaos baseline config (docs/05 §12 flag), signatures per stance,
goldens re-record per window.

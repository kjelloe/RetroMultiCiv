# Build-doctrine engine window — slice plan (PROMOTED into v1, user 2026-07-25)

The XX §3 AI/regency city-role build doctrine, PROMOTED to a full v1 behavioral
engine window (user ruling, after the measure-first table). Architect executes
(bugfixer on mobile-session-3, helper stopped). Doctrine source: `refinement-xx.md`
§3 + §3a (user's concrete build order). Baseline: AI builds ~0 buildings/wonders,
tech caps ~30, 0 space launches, M3-pop 20<22 — all one lever.

## Discipline (every slice)
Full golden window: fixture-FIRST (replay fixture or scenario capturing the new
behavior BEFORE the engine change), `engine/*.js` + byte-shaped `luau/` twin changed
TOGETHER, honest sim-golden re-record (classified BEHAVIORAL/STAMP), reviewer
engine-diff gate + sim-runner 25-seed invariants/floors sweep before each marker.
One golden lock at a time. Ruleset numbers stay in `data/*.json` (new building-priority
knobs there, not hardcoded). Determinism via `engine/rng.js` only.

## Sequencing
Opens AFTER the investigateCity 8-file changeset commits (reviewer gate #2680) so the
tree is clean. Slices ordered highest-leverage-first so each lands measurable value:

- **Slice 1 — HAPPINESS + GROWTH buildings** (highest leverage; targets M3-pop + disorder).
  AI builds TEMPLE (happiness gate — before/after granary per §3a) + GRANARY (growth;
  high-food cities may defer to pop 4-5). Expected: M3-pop median back >= 22 (clears the
  advisory → re-add M3-pop to nightly --enforce-floors in the SAME commit), disorder down,
  avgPop up from ~3.1. Smallest, most decisive.
- **Slice 2 — SCIENCE + trade buildings** (research depth). LIBRARY (+ MARKETPLACE for
  gold) in trade-heavy cities. Expected: tech depth past ~30 cap; sets up eventual launches.
- **Slice 3 — CITY ROLES + military concentration.** Deterministic role tag
  (production/science/frontline/spawner/default) from city geography + empire context,
  driving the existing build-priority lever (extends the archetype/N9 machinery). One
  high-shield city = MILITARY (barracks, then units); core cities = DEFENCE-first (phalanx
  asap) → granary → settler.
- **Slice 4 — FRONTIER defence.** CITY WALLS in frontier-exposed cities only; defender
  coverage in core.
- **Slice 5 — WONDERS.** Extend wonderAppetite (archetype window) for GROWTH/HAPPINESS
  wonders; super-food city may take a happiness wonder to run many specialists.

## Notes
- Happiness COVERAGE isn't in `--stats` telemetry (no disorder field) — sim-runner may
  need a small telemetry add to measure slice-1 impact directly; buildings-built count is
  the proxy meanwhile. (Golden-neutral tooling change, not an engine change.)
- Each slice re-measures against the §3a ideal; the promote/bank was decided on the
  baseline table (buildings ~0), so slices report progress-to-ideal.
- v2 shelf (NOT this window): Civ4 draft-from-super-food-wonder-city.
- Pace: multi-slice, days of golden work; architect executes solo + gates per slice.
  Flag to user if the pace warrants reactivating a second engine lane.

## Slice-1 delivery log (2026-07-26)

- **1a @6fc9d6a** — doctrineBuilding landed (fixture-first 7/7, twins 11/11, honest
  behavioral re-record). Gate finding (sim-runner #2760): mechanism DORMANT in the
  canonical sweep — temple coverage 0.9%; root cause: the slot's threat gate, and
  `threatened` is chronic at 7-civ density. M3-pop 25 (PASS ≥22) but not attributable.
- **1b @00c3267** — threat gate dropped (walls-first still outranks; walled-under-threat
  fixture added). Reviewer #2766: CODE GREEN (pristine 967/964/0-fail, twin bit-exact,
  natural holds 545/p2); independent 3-seed canonical probe: coverage 2.0% → 6.2% —
  directionally correct, MODEST. Authoritative figure = the 25-seed sweep (pending).
- **Measurement lessons:** hashes moving ≠ mechanism firing (probe by direct count);
  probe in the CANONICAL config, not the golden-seed sim config (a 4-civ 56x35 seed
  showed 73% — cherry-picked by accident).
- **Open lever (reviewer advisory):** at ~6% coverage most cities stay on the
  defender/walls/army treadmill (garrison floor + walls precede the doctrine under
  chronic threat). If doctrine-DOMINANT development is the intent, the next lever is a
  garrison-floor carve-out or hoisting doctrine above walls — decide on the sweep
  numbers (slice-1c vs fold into slice-2).

## Peace-witness v2 + garrison-roam diagnosis (2026-07-26)

- Peace-witness v1 (2-civ head slice) FALSIFIED: a DUEL (threat 28.8%, 7/10 conquest,
  coverage 0.0%) — civ count does not control conflict; renamed the 2-civ duel witness.
- v2 (user design): personality-selected pair — chinese+germans (defensive stance,
  attackerPerCityPct 0) via the new sim-driver opts.roster + debugging/probe-peace.js
  (@f795a87, golden-neutral). 3-seed local: STILL 0 buildings, 2-10 cities, all seeds
  end in barb-driven elimination of one side.
- **DIAGNOSIS (the deeper W6 blocker): GARRISON ROAM.** Seed-1 sampling: the lone
  p1 city produces militia at every checkpoint while its garrison leaves (t180:
  0 units in city, 37 alive on map). defenders < wantDefenders chronically -> the
  ENTIRE garrisoned block (settlers + doctrine + econ) is unreachable. Explains both
  the peace-pair 0% coverage AND most of the canonical dormancy. The slice-1d lever
  is garrison RETENTION (unit-brain: fortified city garrison must stay), not another
  cascade reorder. Design pending the slice-1c sweep verdict.

### Slice-1d design ruling (user, 2026-07-26)

Retention is ROLE DISCIPLINE, not movement-freezing. Even a defensive civ in a
peaceful world MUST send scouts out — to find excellent food/shield/trade city
sites, learn which direction the other civs are, and spot barbarians to fend
off. Two legs:
1. **Garrison stickiness** — units in the city-defender role stay fortified in
   their city; escort/hunt/explore selection must not poach a standing garrison
   (or must backfill before leaving). Fixes the roam choke (the militia-forever
   loop).
2. **Scouting never zero** — marchRadiusPct gates marching-to-war, not site
   discovery: the defensive stance's scout share needs a real explore radius
   (today marchRadiusPct 0 × exploreMarchRadius 8 = 0, so its scouts stay
   home — the second reason the peace pair stalled at 2 cities). With sites
   discovered and the garrison stable, the §3a settler flow reaches the good
   sites and the doctrine builds behind it.

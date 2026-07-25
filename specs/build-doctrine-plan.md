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

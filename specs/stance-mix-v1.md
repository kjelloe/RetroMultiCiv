# Stance-mix v1 — heterogeneous AI civs (spec for the N9/Window-2 golden window)

Architect spec, 2026-07-17. Measurement basis: sim-runner #1110→#1123 (the
seeded-shuffle correction) → #1125 (FU1, the shipped shape). User intent
(2026-07-17): "some civs can build without wonders, but some civs must build
wonders … I want some civs to build wonders also in v1." Framework context:
specs/ai-modes-framework.md (this is wave-0, the static baseline the modes
evolve from).

## What ships (the FU1 shape — measured, dg=30 UNCHANGED)

1. **A new `defending-builder` AI stance** in the A40 STANCES table
   (engine/ai.js + luau/ai.luau byte-twin), matching the sim-runner's lab
   implementation (their lab patch is the reference; byte-faithful port):
   - survival first: `garrisonAlways2` + walls before economy;
   - then economy: the marker-0036 reserve scaffold fires in the NORMAL
     block after the full garrison (NOT the preempt-at-1 placement) with a
     high `aiEconReserve`, wonder-inclusive with the capital-concentration
     rule (wonders only in the civ's capital);
   - minimal offense: `attackerPerCityPct 0` family (the lab values).
2. **Seeded stance assignment at createGame** (engine/mapgen.js or setup
   seam; deterministic, engine-legal):
   - AI civs only (human seats keep the regency stance flow);
   - `nBuilders = aiBuilderPct == 0 ? 0 : max(1, idiv(nAI *
     rules.aiBuilderPct, 100))` with `aiBuilderPct = 35` (the measured
     30–40 window's center) in data/rules.json — the explicit 0-guard keeps
     pct=0 a TRUE identity (no floor-of-1 leak);
   - which civs draw defending-builder = a seeded shuffle through
     engine/rng.js (state-seeded, deterministic, replay-identical);
   - stored as `player.stance` (printable-ASCII string; statehash-legal)
     ONLY on the builder civs — balanced civs get NO field written. Absent
     field = balanced (back-compat: old saves/scenarios unchanged), AND it
     makes the identity check exact: at aiBuilderPct=0 no field is written,
     no rng draw is consumed (skip the shuffle entirely when nBuilders=0),
     so the state is BYTE-IDENTICAL to today and the old goldens REPRODUCE
     — a true dormant-capability proof, not just a same-policy-stream
     argument.
3. **runAiTurn reads `player.stance`** for AI civs (regent seats keep the
   existing explicit-stance path; explicit argument wins over the field).
4. **NO aggressive stance in the mix.** Balanced remains the majority
   policy — it IS today's identity war behavior, which is what keeps elim
   in-band without touching defenderGatePct. dg=30 UNCHANGED.

## Measured expectations (the acceptance gate, sim-runner re-runs on the
shipped code)

| civs | mix | elim median | wonders |
|---|---|---|---|
| 4 | 3bal/1db | ~37 (in band) | completes in ~1/8 games + in-progress |
| 7 | 4bal/3db | ~36 (in band) | same |
| 12 | 8bal/4db | over-band (~62) | crowding effect, pre-existing class |

Gate: identity first — `aiBuilderPct = 0` writes no stance field and
consumes no rng draw, so the OLD goldens must reproduce byte-exactly (the
dormant-capability proof; see the assignment rules above). Then the FU1
shape reproduces on the shipped code (elim in-band at 4/7 civs, builders
build, ≥1 wonder completes across the seed set). Then goldens re-record
ONCE at aiBuilderPct=35.

## Explicitly deferred (not in this window)

- The **aggressive archetype** — waits for spawn-aware assignment (FU2) or
  the survival mechanism (spawn-spacing mapgen / D1 diplomacy). Do not add
  it to the mix.
- The 12-civ over-band — crowding, not aggression; a map-size-aware mix is
  a later tune.
- Wonder-race abandonment, leader-flavored wonder preference, dynamic mode
  transitions — the ally framework's later waves.

## Why this is honest

Wonder completion is RARE (~1/8 games by t400; wonders cost 100+ turns and
t400 caps the run — longer games finish more). That is the measured truth
and matches Civ 1's feel (wonders are events, not routine). The claim v1
makes: some civs are builders, they build economy, survive, and sometimes
complete wonders; no civ's war behavior changed; the user's dg=30 pin is
untouched.

## Process

reviewer pre-design check (docs/18: Civ1-authenticity of the archetype —
Civ1 leader traits e.g. perfectionist/militaristic are the historical
precedent to verify against the wiki — + prior-art + license) → bugfixer
builds byte-faithful from the sim-runner's lab patch (Window 2 =
marker-0043; the marker-0036 scaffold + new stance + assignment + tests +
golden re-record, one window) → sim-runner acceptance gate on the shipped
code → architect commits/tags.

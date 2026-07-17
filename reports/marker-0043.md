# marker-0043 — stance-mix v1: heterogeneous AI (builder stance + seeded assignment)

- **Commit:** eef18b1 (tag marker-0043)
- **Base:** marker-0042 + golden-neutral commits (specs, docs/13, roblox manifests).
- **Type:** engine golden window (Window 2 of the N9 arc); goldens re-recorded.
- **Tests:** 468 reported at close (true count 465 after the phantom-entry fix
  in 175d4b0 — the dir form counted 3 helper files; no real test changed).
- **Status:** CONSISTENT — acceptance gate GREEN on all three axes (#1175).
  The merge candidate.

## What this delivers (the user's v1 ask)

"Some civs must build wonders" — measured, shipped, honest:

- **New `builder` AI stance** (display name "Perfectionist" — the authentic
  Civ 1 trait per the reviewer's wiki verdict #1153): garrisonAlways2,
  walls-first, zero attacker share, high economy reserve firing after the full
  garrison, capital-only wonders at pop 2+.
- **Seeded assignment at createGame** (post-findStarts): 35% of AI civs
  (`rules.aiBuilderPct`, min 1) draw the builder stance via an in-state
  Fisher-Yates; balanced civs get no field (absent = balanced, mirroring
  Civ 1's own trait-less leaders); humans excluded.
- **dg=30 pin UNTOUCHED** — no aggressive stance in the mix; balanced remains
  the majority policy (today's identity war behavior).

## Gate results (sim-runner, on the shipped code)

1. **Identity (pct=0):** no field written, no rng draw — the marker-0036
   goldens reproduce byte-exactly (dormant-capability proof).
2. **pct=35 goldens:** soak 0xc66276f2/0xef2c3e59/0xab28279a/0x550ee88e,
   natural 0x4725e078 — reproduce on an independent pull; JS==Luau.
3. **FU1 shape:** elim median 25 (4civ) / 29 (7civ) — in-band; builders build
   economy in 13/16 seeds (maxBldg to 40); **6 wonders completed** across the
   seed set + 3 in progress. Per-seed variance (spawn-geography sensitivity)
   is the known deferred item.

## Blast radius (all in-window, disclosed, JS==Luau)

The createGame stance field shifts every setup-derived hash: 002-mapgen
contract 0x7daaf12a→0x21646cf9; the four A82a map-type anchors; fastforward
fixture re-pinned seed 7→1; witness 0xb0f98c19.

## Process notes

- Reviewer pre-design check: PASS (Civ1-authentic via the leader-traits
  table; prior-art additive; license clean). Ran mid-window under the
  bounded-wait ruling; state key decoupled so naming folds in client-side.
- Hunk-3 (science/growth econReserve activation) deliberately omitted —
  v1-inactive and would break the growth stance test; re-add condition logged
  for the aggressive-economy variant.
- Measurement chain that produced this: #1110 (favorable-arrangement claim) →
  #1123 (seeded-shuffle retraction) → #1125 (FU1, the honest shape) →
  #1153 (authenticity) → #1175 (gate green). Two self-caught artifacts.

## Deferred

Aggressive archetype (needs spawn-aware placement FU2 [parked] or D1
diplomacy); per-civ wiki-backed leanings (Babylonians/India/Aztecs builder;
Egypt explicitly NOT); 12-civ crowding over-band; per-seed variance;
display naming in the client; v1.5 telemetry lands next (unblocked).

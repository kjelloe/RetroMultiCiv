# marker-0035 — B23d revert + golden-neutral consolidation (merge candidate)

- **Commit:** 3b5b2b1 (tag marker-0035)
- **Base:** marker-0033 engine goldens + all golden-neutral work committed since.
- **Type:** engine revert (restores marker-0033 goldens) + golden-neutral layers.
- **Tests:** 450/450 zero-skip; JS==Luau twin green; witness replays clean.
- **Status:** CONSISTENT — the current merge candidate (declared to the user).

## What this marker is

marker-0034 (B23d relaxed scout threat-veto) was FLAGGED-not-consistent — the
sim-runner's joint A/B (#1004, #1020) proved the exploration↔elim tradeoff is
irreducible at the dg=30 war pin: no aiScoutVetoRadius × guards cell holds
exploration AND keeps elim in the M11 band. marker-0034 is superseded.

marker-0035 = marker-0034 reverse-applied on the engine (aiScoutVetoRadius
gone, goldens restored to marker-0033: soak
0x021b89c6/0x5eb2ad2e/0x2cfa85b1/0x73f85601, natural 0x71bf50f1) while
PRESERVING all the golden-neutral work layered on top.

## Delta since marker-0033 (all golden-neutral)

- **A82a map types v1** — Launch/Advanced setup optgroups + `rules.mapTypes`
  block (continents 32/5, pangaea 36/1, archipelago 20/20, islands 14/24);
  `mapgen.createGame` resolves `options.mapType` before DEFAULTS. Naval maps
  gated per the user ruling (archipelago/islands ship but AI cross-water is the
  N-track work). No engine-golden exposure (setup-side + additive rules).
- **Art rounds** — the A67 visual-golden stream (separate lane).
- **Pedia editorial pass** — 14 concept entries folded into
  `client/ui/pedia-concepts.js` (11 revised + 3 new: cities/research/buildings),
  learning-path order, game-code entry corrected to the state-match check.
- **Resume-by-code collision fix** — `server/index.js` default game id
  namespaced `'default-g' + seed` (was a sequential counter that collided on
  resume); red-first test in `test/server.test.js` (asserts `gameId === 'itest'`
  on token reconnect). "resume passphrase" → "resume gamecode" rename.
- **A49-ext test-ui lane** — 3 playwright specs (resume-lobby, replay-theater,
  regency), lane 11/11. Dev-only, playwright-gated; `node --test test/` stays
  playwright-free.

## The B23d revert itself

Reverse-applied the marker-0034 commit diff across engine/ai.js, luau/ai.luau,
data/rules.json (aiScoutVetoRadius removed, A82a mapTypes block PRESERVED), and
the three test files. B23d code retained in scratchpad — it is dg-DEPENDENT, not
wrong (works at radius 2 IF the war level were lower); revisited after the AI
economy fix (N9) rebalances the war level.

## What's next (in flight, NOT in this marker)

marker-0036 = N9-fix production reorder (aiEconReserve knob, DEFAULT 0 =
identity — goldens UNCHANGED, dormant-capability). The sim-runner then sweeps
reserve × dg to find the smallest reserve that lifts economy (bldgPct + wonders)
while HOLDING elim in the M11 band at dg=30 (preserving the user's pin);
marker-0037 activates at the found value. dg re-pin is conditional on the sweep,
not assumed.

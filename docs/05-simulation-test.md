# Simulated playthrough test — design (no implementation yet)

A headless, UI-free regression net: four AI civilizations play full games
through the real engine while an invariant checker audits the state. It
simulates hundreds of turns of game mechanics in seconds — wide coverage of
interacting systems (growth, happiness, governments, combat, improvements,
barbarians) that manual playtesting reaches only slowly. UI and
human-interaction testing stay manual (and with the browser e2e).

Decisions locked with the user (2026-07-12): endYear is overridden so runs
reach turn 400 (plus one natural-end run); hash policy is **both**
double-run comparison and golden constants; suite budget ≈ 15 s with one
seed, more seeds behind a soak mode.

## 1. What it catches (and what it doesn't)

Catches: state corruption (null/float/non-ASCII creeping in), broken
references (units/cities pointing at missing owners or tiles), rule-breaking
values (negative gold, pop 0, over-assigned workers), wedged or throwing AI,
nondeterminism over long horizons, unintended behavior drift (goldens),
fog-projection leaks, and hard crashes anywhere in the turn pipeline.

Does NOT catch: UI wiring, human-command flows (hotseat, dialogs), balance
or "fun" problems, and AI *quality* (only AI legality/liveness). Soft
progress expectations are deliberately lenient to avoid flaky tests.

## 2. Architecture

```
test/sim-driver.js       # shared driver + invariant checker (CJS helper,
                         #   dynamic-imports the engine like other tests)
test/simulation.test.js  # suite mode: 1 seed, checkpoints, goldens
tools/soak.js            # CLI: many seeds / longer runs / reports
```

**Driver.** All-AI games can't use `session.endTurn` (it stops at humans),
so the driver owns the loop — the same shape as `tools/replay.js`'s round:

```js
// runSim({ seed, civs: 4, width, height, turns, rulesOverrides, onTurn })
for each turn until target:
  for each player in playerOrder (skipping dead):
    runAiTurn(engine, state, pid, ruleset, [])
    applyCommand(state, { type: 'endTurn', playerId: pid })
  onTurn(state, turn)   // invariants + checkpoint hooks
  if state.gameOver: break
```

Ruleset overrides use the difficulty mechanism: suite games run with
`{ endYear: 9999 }` so the score victory at 2100 AD (≈ turn 306) doesn't cut
the run short of 400.

**Two suite runs, one seed (fixed, e.g. 20260712):**

1. **Mechanics soak** — 4 AIs, 80×50, endYear override, to turn 400.
   Checkpoints at 100/200/300/400. Run TWICE; checkpoint hashes must match
   between runs (long-horizon determinism) and match the pinned goldens.
2. **Natural end** — same seed, no override: assert the game reaches
   `gameOver` by turn 320 with a valid winner and a stable final hash
   (golden). Proves victory conditions still fire.

## 3. Invariant catalog

**Cheap (every turn):** structural + numeric audit of the whole state —

- ids consistent: `units[k].id === k`, `cities[k].id === k`; `cityOrder`
  matches `cities` exactly, no duplicates; counters exceed max used id.
- ownership: every unit/city owner exists in `players`; `home` city, when
  set, exists or the field was cleared.
- geometry: all coordinates in bounds; land units on land, sea units at sea
  (transports don't exist yet — revisit); no two cities on one tile.
- numbers: gold/bulbs/shields/food ≥ 0; pop ≥ 1; moves ≥ 0; rates are
  multiples of 10 summing to 100 and within the government cap;
  `revolutionTurns` implies government anarchy; workers arrays ≤ pop with
  valid unique candidate indices; taxmen+scientists+workers ≤ pop.
- fog: explored arrays are width×height of 0/1.
- tripwires against runaway feedback loops: pop ≤ 40, total units ≤ 600,
  gold ≤ 100000 (generous — they exist to catch exponential bugs, not to
  tune balance).
- turn/year advance by exactly 1/20 per round.

**Deep (checkpoints only):**

- `hashState(state)` — throws on any Lua-unsafe value, doubles as the
  determinism/golden probe.
- fog-projection audit: `filterView(state, pid)` for every player, assert
  no rival internals (the visibility-test rules, applied to organic states).
- happiness coherence: each city's stored `disorder` equals `cityMood`
  recomputed at the wrap boundary.
- capital/corruption sanity: `capitalOf` resolves for every player with
  cities.
- a one-line human summary per checkpoint in the test output
  (`turn 200: 14 cities, 31 units, techs 9/6/11/8, scores …`) so soak logs
  are readable.

## 4. Hash policy (both, per decision)

- **Double-run**: catches nondeterminism with zero maintenance.
- **Goldens**: checkpoint hashes pinned in `simulation.test.js`; any engine
  change that shifts a long game fails loudly. Re-record process mirrors
  scenarios: set the golden table to `null`, run, copy the printed values —
  one table, five hashes (100/200/300/400 + natural end). Expect to
  re-record on every intentional balance/rules change; the double-run and
  invariants still guard the change itself.

## 5. Failure artifacts

On any invariant failure or crash, the driver writes TWO files before
failing the test (gitignored, e.g. `debugging/sim/`):

- `sim-<seed>-t<turn>.save.json` — save-format envelope: **drag-drop it
  into the browser** to inspect the broken world with the full UI.
- `sim-<seed>.diag.json` — diagnostics format (initial state + round log +
  hashes) so `tools/replay.js` can bisect where things went wrong.

The assertion message carries seed, turn, player, and the offending entity.

## 6. Soak mode (`tools/soak.js`)

`node tools/soak.js --seeds 25 --turns 400 --civs 4 [--size huge]`
— many seeds, invariants always on, goldens off (seeds vary), summary table
(seed, end turn, winner, checkpoint hashes, ms/turn). Env
`MULTICIV_SIM_SEEDS` lets CI nightlies widen the net without touching the
default suite. Failures produce the same artifacts.

## 7. Runtime budget

Early-phase measurement: a full 80×50 conquest game ran in ~250 ms; today's
engine does more per wrap (mood, corruption, upkeep). Estimate 4–10 s for
400 turns × 4 AIs including per-turn invariants; double-run ×2. If the
suite run exceeds ~15 s on the dev machine, first lever: cheap invariants
every 5 turns instead of every turn (checkpoints stay full).

## 8. Phase-5 payoff

The driver + checkpoint goldens are cross-engine anchors: the Luau port
runs the same seeds through the same loop and must hit the same five
hashes. This test is therefore the long-horizon complement to the scenario
suite in the port-verification story — worth building solidly now.

## 9. Implementation order (when green-lit)

1. `test/sim-driver.js` — runSim + invariant checker (pure functions,
   testable itself with a tiny crafted broken state).
2. `test/simulation.test.js` — suite mode with null goldens, measure
   runtime, record goldens, tune cadence to budget.
3. `tools/soak.js` — CLI wrapper + artifacts.
4. CLAUDE.md test-layers note + roadmap Phase 2.5 addendum.
5. First soak across ~25 seeds; triage whatever it finds (expect it to
   find something).

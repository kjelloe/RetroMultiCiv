# Simulated playthrough test — design & implementation notes

**Status: implemented** (test/sim-driver.js, test/simulation.test.js,
tools/soak.js). §7 and §10 record where reality amended the design.

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
// runSim({ seed, civs, width, height, turns, rulesOverrides, deepAt, ... })
for each round until target:
  while the game turn hasn't advanced:
    runAiTurn(engine, state, activePlayer, ruleset, [])   // skipped if dead
    applyCommand(state, { type: 'endTurn', playerId: activePlayer })
  invariants + checkpoint hooks
  if state.gameOver: break
```

Round semantics: round N plays game turn N, so a "turn 100 checkpoint" is
the state with `state.turn === 101`. Replay interop: the driver's artifact
uses `{ t: 'airound' }` log entries, and `tools/replay.js` replays them
with this same loop (regular `round` entries stop at the next *human*,
which an all-AI game never reaches).

Ruleset overrides use the difficulty mechanism: suite games run with
`{ endYear: 9999 }` so the score victory at 2100 AD (≈ turn 306) doesn't cut
the run short of 400.

**Two suite runs, one seed (20260712):**

1. **Mechanics soak** — 4 AIs, **56×35** (amended from 80×50 — see §7),
   endYear override, to turn 400. Checkpoints at 100/200/300/400. Run
   TWICE; checkpoint hashes must match between runs (long-horizon
   determinism) and match the pinned goldens.
2. **Natural end** — same seed, no override: assert the game reaches
   `gameOver` by turn 320 with a valid winner and a stable final hash
   (golden). Proves victory conditions still fire. (Measured: score
   victory at round 305, as predicted by endYear 2100 ≈ turn 306.)

## 3. Invariant catalog

**Cheap (every turn):** structural + numeric audit of the whole state —

- ids consistent: `units[k].id === k`, `cities[k].id === k`; `cityOrder`
  matches `cities` exactly, no duplicates; counters exceed max used id.
- ownership: every unit/city owner exists in `players`; `home` city, when
  set, exists or the field was cleared.
- geometry: all coordinates in bounds; land units on land, sea units at sea
  (transports don't exist yet — revisit); no two cities on one tile; no
  tile holds units of two different owners (moving onto an enemy is always
  an attack, so a mixed stack means a movement/combat bug).
- numbers: gold/bulbs/shields/food ≥ 0; pop ≥ 1; moves ≥ 0; rates are
  multiples of 10 summing to 100 and within the government cap;
  `revolutionTurns` implies government anarchy; workers arrays ≤ pop with
  valid unique candidate indices; taxmen+scientists+workers ≤ pop.
- fog: explored arrays are width×height of 0/1.
- tripwires against runaway feedback loops: pop ≤ 40, total units ≤ 1000
  (recalibrated from 600 when batch-4's AI made thriving empires bigger),
  gold ≤ 100000 (generous — they exist to catch exponential bugs, not to
  tune balance).
- turn/year advance by exactly 1/20 per round.

**Deep (checkpoints only):**

- `hashState(state)` — throws on any Lua-unsafe value, doubles as the
  determinism/golden probe.
- fog-projection audit: `filterView(state, pid)` for every player, assert
  no rival internals (the visibility-test rules, applied to organic states).
- happiness coherence (amended): `cityMood` recomputes cleanly on every
  organic city — components non-negative and summing to workers — and
  stored `disorder` flags are well-formed. Strict flag-equality can't be
  asserted post-wrap: `processCities` may change pop *after* the verdict,
  legitimately (the flag refreshes next wrap).
- capital/corruption sanity: `capitalOf` resolves for every player with
  cities.
- `playerIncome` computes sane integers (bulbs/maintenance ≥ 0) on every
  organic state. (Strict forecast==applied is not well-defined across the
  wrap: improvements finish and cities grow/build before income applies.)
- manual worker lists hold real candidate tiles (stronger than the cheap
  bounds check — growth appends candidates, capture clears the list).
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
  invariants still guard the change itself. NOTE (B10): committed scenario
  `final.hash` values may never be null — guards.test.js fails the suite on
  an unpasted re-record, so the null step is loudly temporary by design.
  **Re-record rider (2026-07-24, user-ruled build-step policy): every
  BEHAVIORAL re-record also re-runs `node tools/bake-age-snapshots.js`** —
  the gitignored `data/age-snapshots/` embed fast-forward states whose
  statehash pins break on any behavioral change (`age-snapshots.test.js`
  goes red and forces this visibly). Snapshots are a dev-side build
  artifact: never committed, never baked on the host (the deploy template
  bakes pre-rsync).

## 5. Failure artifacts

On any invariant failure or crash, the driver writes TWO files before
failing the test (gitignored, e.g. `debugging/sim/`):

- `sim-<seed>-t<turn>.save.json` — save-format envelope: **drag-drop it
  into the browser** to inspect the broken world with the full UI.
- `sim-<seed>.diag.json` — diagnostics format (initial state + round log +
  hashes) so `tools/replay.js` can bisect where things went wrong.

Both envelopes are SELF-DESCRIBING since B9 (2026-07-14): they embed
the failing turn and the invariant problem strings VERBATIM (`sim.
problems` in the diag; `simFailure {seed, reason, turn, problems}` in
the save) — an artifact in hand is the diagnosis in hand, even three
days later with no terminal transcript (the gap cost a 7-minute
re-simulation once; never again).

The assertion message carries seed, turn, player, and the offending entity.

## 6. Soak mode (`tools/soak.js`)

`node tools/soak.js --seeds 25 --turns 400 --civs 4 [--size small]`
— many seeds, invariants always on, goldens off (seeds vary). Env
`MULTICIV_SIM_SEEDS` lets CI widen the net without touching the default
suite. Failures produce the same artifacts. Flags (header has the full
list):

- `--jobs N` — parallel seed processes (default cores−1; ~12× on the dev
  machine: 25 God-Emperor seeds in ~70 s wall).
- `--stats file.jsonl` — one telemetry row per checkpoint plus a result
  row per seed (`snapshot()` in sim-driver: per-player government, cities,
  units, techs, gold, score). Append-only JSONL, parallel-safe — chart
  balance drift across engine versions. Drag one or more of these logs
  onto `debugging/stats.html` (static, dependency-free Canvas 2D — no
  build) for per-seed city/tech/score curves per civ and a summary table
  (eliminated %, stagnant %, government mix); `?file=<url>` deep-links a
  same-origin log. `node debugging/stats-summary.js <log>` prints the
  same numbers on the command line — it is the scorer for the AI-quality
  exit criteria (docs/03 division of labour).
- `--difficulty trainer..godemperor` — the client's contentCitizens table;
  godemperor (2) is the disorder/happiness stress configuration.
- `--natural` — standard endYear, and every seed must reach a victory by
  the turn limit or the seed FAILS (victory robustness across worlds).
- `--no-chaos` — disable the chaos layer (§11).

**Nightly** (`.github/workflows/nightly-soak.yml`, also runnable on
demand via workflow_dispatch): full test suite + 25-seed God-Emperor soak
+ 25-seed natural-victory soak, telemetry and failure artifacts uploaded
from `debugging/sim/`. The repo needs no npm install — the engine and
tests have zero dependencies, and the browser e2e self-skips on runners.

## 7. Runtime budget (measured — the design estimate was 100× off)

The ~250 ms early measurement didn't survive contact: a 400-turn 4-AI game
at 80×50 first clocked **129 s**. Profiling (`node --cpu-prof`) showed the
guessed lever — invariant cadence — was wrong (invariants: 0.4%). The real
costs:

- **`deepClone` 63% + GC 10%** — `applyCommand` clones the whole state per
  command and AIs issue hundreds of commands per turn; the per-player
  `explored` arrays alone are ~16k primitives per clone. Fix: a flat-
  primitive-array fast path in `deepClone` (`slice()`; Luau: `table.clone`)
  — 129 s → 69 s, hashes bit-identical.
- **`hashState` ~14%** — fix: rounds carry a hash only every `hashEvery`
  (default 10) rounds plus checkpoints/game end; `tools/replay.js` skips
  hashless entries, so artifacts stay bisectable at that granularity.
- **Map size is the remaining lever** — clone cost scales with state size,
  so the suite world is 56×35 (~9.5 s per 400-turn run) while soak mode
  defaults to the full 80×50 (~70 s per seed, fine for an explicit run).

Suite total: two soak runs + natural end + two small tests ≈ **31 s** for
the file — over the ~15 s wish, but `node --test` runs test files in
parallel, so the wall-clock impact on the whole suite is smaller.

## 7b. Visual-regression goldens (A48, nightly)

Alongside the numeric goldens above, `debugging/visual-check.sh` byte-
compares two rest-pose renderer shots — `debugging/gallery.html` (assets +
14-civ grid) and `/client/?splashstill=1` (the setup diorama frozen at
drift phase 0) — against committed PNGs in `debugging/goldens/`. Frames are
byte-stable by construction: rest pose (no sway/smoke), and reduce-animation
now freezes the water drift too (`renderer/three/index.js`), so
ocean-bearing frames don't jitter. `?splashstill=1` renders the diorama with
the camera at the sine-drift's t=0 position and animation off.

**CI-AUTHORITATIVE.** SwiftShader rasterizes deterministically for a GIVEN
chromium build, so the committed goldens are the ones a CI nightly produced.
A re-record after an INTENDED visual change = download the nightly's uploaded
`actual-*.png` artifacts (the `visual-goldens` artifact, uploaded on
mismatch) and commit them alongside the renderer change that caused the
diff. Local runs are informational only — a different local chromium may
differ from CI legitimately; do NOT chase local-vs-CI pixel diffs. (The
repo's initial goldens were bootstrapped locally; the first CI nightly
re-records the authoritative set.)

## 8. Phase-5 payoff

The driver + checkpoint goldens are cross-engine anchors: the Luau port
runs the same seeds through the same loop and must hit the same five
hashes. This test is therefore the long-horizon complement to the scenario
suite in the port-verification story — worth building solidly now.

## 9. Implementation order (all done)

1. ✅ `test/sim-driver.js` — runSim + invariant checker (checker unit-tested
   against a crafted broken state in simulation.test.js).
2. ✅ `test/simulation.test.js` — double-run + goldens + natural end.
3. ✅ `tools/soak.js` — CLI wrapper; artifacts land in `debugging/sim/`
   (gitignored).
4. ✅ CLAUDE.md test-layers note + roadmap Phase 2.5 addendum.
5. ✅ First soak across 25 seeds (see §10).

## 10. First findings (triaged during implementation)

The tripwires fired before the suite even landed — twice:

- **Settler spam**: the v0 AI's "defended city → build settlers forever"
  grew armies without bound once the land saturated (607 units by turn
  245). Triage in `engine/ai.js`: settlers are capped at
  `2 + cities/4`; saturated cities build the cheapest missing building,
  then the cheapest available wonder, before falling back to defenders.
- **Research starvation**: with the spam capped, three of four AIs still
  had **zero techs at turn 300** — their city tiles produced no trade (no
  rivers/specials, no roads), so no bulbs, no research, no buildings to
  build, militia fallback spam, tripwire again. Triage: idle settlers with
  no city spot now pave a road where they stand (the first slice of the
  docs/04 "AI use of improvements" enrichment). Research flows; 400-turn
  games complete with wars, buildings, and wonders.

Both were real "unintended behavior drift" catches on day one — exactly
the class of bug this test exists for. Note: AI changes alter AI-driven
rounds, so *old* diagnostics recordings (e.g. pre-change playtests) no
longer replay hash-for-hash; recordings are debug artifacts, not saves.

## 11. Chaos layer + AI governments (second wave)

The first soak proved states stay *legal* but exposed a coverage hole: the
AI never issued `setGovernment`/`setRates`/`buy`/`pillage`/`disband`/
`setWorkers`, so those pipelines ran in zero soaked turns. Two additions:

- **AI government slice** (`engine/ai.js`): the AI beelines the Monarchy
  prerequisite path (level-order research never reached level 3 in 400
  turns) and revolts to Monarchy once known — the stable government for a
  garrisoned AI (martial law, no war unhappiness). Revolutions, anarchy,
  `clampRates`, martial law, and per-government corruption now run in
  every sim.
- **Chaos layer** (`runSim({ chaos: true })`, suite mechanics run + soak
  default, `--no-chaos` to disable): ~1 command per 6 player-slots drawn
  from a SEPARATE seeded xorshift stream (never the game's `rngState`) —
  buy (double weight), pillage, disband, setRates combos, manual/auto
  workers, volatile-government revolts (Republic/Democracy), research
  switches. Legal-*shaped*, not legal: rejections exercise validation and
  replay identically. Every injected command is recorded per player-slot
  in the `airound` log entries (`chaos: [{playerId, cmd, ok}]`) and
  `tools/replay.js` re-applies them in place, so artifacts stay exact.
  The natural-end suite run stays chaos-free (pure victory path).

**Second-wave catches:**

- (chaos, within 100 turns of governments waking up) `captureCity`
  decremented pop without clearing manual `workers`/`taxmen`/`scientists`
  — a captured city could carry more assignments than citizens (wrong
  mood math: negative workers). Starvation had the same gap for
  specialists. Both fixed (capture reverts the city to automatic
  placement; starvation trims scientists, then taxmen) with unit tests in
  combat.test.js / cities.test.js. Pre-existing bugs reachable by human
  play — found by the sim in minutes.
- (15-seed chaos soak, seed 12) the stagnant-civ militia loop finally
  tripped the 600-unit wire at scale: a civ that stays tech-starved with
  several cities has nothing buildable, so the defender fallback spammed
  militia unboundedly. Fix: fallback garrisons cap at 3 per city; past
  that the city builds settlers — pavers whose roads create the trade
  that ends the tech drought (self-healing, 602 → 193 units on seed 12).
  The golden seed's hashes were unaffected: its civs never enter the
  drought, so the branch is purely a safety net there.

### Chaos backlog — commands it should learn next

IMPLEMENTED IN FULL as A2 (2026-07-13, goldens re-recorded once for the
batch). The original backlog list, kept for the rationale per command:

- **setProduction** — random kind/id switches: exercises category-switch
  shield halving, `wonderAlreadyBuilt`/`techRequired` rejections, and civ
  `cheapUnit`/`cheapBuilding` cost hooks mid-game.
- **moveUnit** — short random walks: chaos-initiated combat, ZOC
  rejections, and attacks the AI's own targeting would never pick (combat
  consumes engine RNG, so this reshuffles everything downstream — the
  biggest re-record).
- **foundCity** — settlers founding in odd spots: spacing/terrain
  validation and duplicate-name handling on organic states.
- **startWork variety** — irrigate/mine/fortress/railroad attempts (today
  only the AI's roads run): `noWater`, `techRequired`, transform paths.
- **setWorkers with taxmen/scientists** — the specialist arm (pop ≥ 5
  validation, entertainer/taxman/scientist mood arithmetic under stress);
  today chaos only assigns worker tiles or resets to auto.
- **setGovernment communism** — the one legal government chaos never
  attempts (fixed corruption distance is otherwise dormant in sims).
- **driver-level, not a command**: a mid-run save/load round-trip —
  JSON-serialize the state, reload, and the hash must be unchanged (the
  browser save path, exercised on organic late-game states).

### Findings from the A2 batch (third wave, 2026-07-13)

- **Chaos injection moved BEFORE the AI's turn** (was after). The
  rejection histogram proved the old order structurally starved
  `foundCity`/`moveUnit`: the AI had already spent every unit's moves,
  so chaos only ever saw leftovers. New semantics: a chaos command is a
  player command landing on fresh moves, and the AI plays around it.
  `tools/replay.js`'s airound loop changed to match (order-only) — sim
  artifacts recorded before 2026-07-13 no longer replay; client Shift+D
  recordings never carry airound entries and are unaffected.
- **Settler windows are ~1 turn wide** — fresh settlers sit inside
  their home city (`tooCloseToCity`) and the AI founds the moment one
  reaches a site. Chaos `foundCity` therefore scans for a real window
  and, when none exists, either walks the farthest settler outward or
  orders one built — it breeds its own future windows. A `roll(4)`
  sliver still targets non-settlers to keep the `notSettlers` rejection
  exercised.
- **`opts.chaosRate` knob** (driver): default 6 = suite behavior
  byte-identical; lower = chattier chaos for probes. Free stress lever
  if soak.js ever wants `--chaos-rate`.
- **Save/load hash round-trip** now runs live at every deep-audit
  checkpoint (the browser save path on organic late-game states).
- The chaos-off natural leg reproduced its golden bit-exact through the
  whole batch — direct proof the changes are chaos-scoped.

## 12. AI health metrics v2 (user-set targets, 2026-07-15 — the wave-VIII contract)

The original telemetry (cities, techs, stagnation, governments) missed
army composition, infrastructure, and wonders — a turn-325 world full
of phalanxes and zero rails soaked "healthy" for weeks. The user set
the v2 target list; each metric gets a soak/--stats column (A64) and
the targets below are HIS opening numbers to tune after the first
baseline run (sim-runner measures, we discuss, targets pin here).

| # | Metric | Definition (measurable) | Proposed target (t≈300, normal) |
|---|--------|------------------------|--------------------------------|
| M1 | Research | techs known (existing) | median ≥ 30; stagnation ≤ 5% |
| M2 | Cities founded | count (existing) | median ≥ 12 |
| M3 | Total population | Σ city pop per civ | median ≥ 45 |
| M4 | Improvement completeness | % of each city's WORKED tiles carrying their appropriate improvement (irrigation on food ground, mine on hills/mountains, road everywhere workable) | ≥ 70% |
| M5 | Network connectivity | % of same-continent city PAIRS connected by contiguous road (rail once Railroad known) — flood-fill along road/rail tiles | road 100% by t200; rail ≥ 80% of pairs by t300 |
| M6 | Military modernity | % of army that is current-best-available (per the A63 obsoletedBy chains); PLUS the reactive gap: best defender tier in each city vs best attacker tier observed among KNOWN enemies — modernize faster when a neighbor is aggressive with newer units | ≥ 60% modern; observed-enemy gap ≤ 1 tier |
| M7 | Building currency | distinct beneficial building types present per city, era-appropriate ("if they help": marketplace where trade flows, library where bulbs flow) | era-appropriate set in ≥ 70% of cities |
| M8 | Wonder ambition | AI civs ATTEMPT wonders with relevant bonuses; time-to-complete feasibility gate: only start if projected < 100 turns (prefer < 60) | ≥ 1 wonder attempt per surviving civ per era; completions > 0 |
| M9 | Exploration coverage | per civ: % of NON-polar land+coast tiles explored, over time — unexplored should shrink until only ice caps and hostile interiors plausibly remain (user addendum) | ≥ 85% of own continent by t150; ≥ 70% of the world by t300 |
| M10 | Gold circulation | treasury trajectory + rush-buy usage per era — empires SPEND; unbounded treasury growth is stagnation (seen: 1811g at +1/turn, turn 325) | buy commands > 0 per era per civ; treasury growth bounded (< ~50g/turn sustained) |
| M11 | Conflict health | attacks launched per era, cities captured, elimination-rate band — no-war worlds and runaway steamrolls are both unhealthy | 20–40% of civs eliminated by t300 (user-set); attacks > 0 every era |
| M12 | Idle assets | settlers idle > 10 turns; units unmoved > 15 turns outside cities/fortresses (seen: 3 unspent settlers, turn 325) | idle settlers ≈ 0; stuck units < 5% of army |
| M13 | Cross-ocean expansion | cross-water founding events; continents settled per civ (suspected: transports never used — single-civ terrarium continents) | ≥ 1 cross-water settlement per game among surviving civs by t250 |
| M14 | Competitive spread | score gap band between best and worst SURVIVING civ at checkpoints — too narrow = nothing differentiates, too wide = runaway | max/min score ratio in ~1.5–6× band at t300 |

**Stance-conditioned signatures (user addendum — activates with A59
leader personalities):** once stances drive AI seats, the M-columns
split per stance, and each personality has its own expected shape —
the conquest columns being the sharpest: **aggressive civs: cities
CONQUERED ≥ 2 by t300** (razed counts too once razing exists as a
choice; today capture is the event); **defensive civs: conquests ≈ 0
is CORRECT, not a failure** — their signature is unit survival +
zero cities lost; growth: most cities FOUNDED + highest M3 pop;
science: tech lead + M8 wonder completions. A stance whose signature
column is indistinguishable from balanced doesn't ship (the A59
quality bar, now with named columns).

**FIRST BASELINE (sim-runner, 2026-07-16 — 25 seeds × {normal, GE}
× {chaos, no-chaos}, 4 civs medium, 100/100 clean; telemetry proven
golden-safe by unchanged hashes). Verdicts vs the proposed targets:**
- PASSING: M12-idle-settlers (median 0–1), M14-normal (median 3.8×,
  16/25 in band).
- MISSES with a capability gap named: M8 wonder ambition (median
  attempts 0 per civ); **M10 — the AI NEVER rush-buys** (0 buys in
  all no-chaos games; chaos-on numbers measured the chaos stream);
  **M12-stuck — CATASTROPHIC: 59–100% of armies never move**
  (chaos flatters it by resetting the counter); **M13 — crossWater
  = 0 in ALL 100 games** (the terrarium is a measured fact); M9
  exploration far under target.
- DEFINITION FIXES before pinning: M9's denominator includes ocean
  (spec says land+coast) and lacks the own-continent-t150 column;
  M11's elimination band quantizes coarsely at 4 civs (0/25/50%) —
  the CANONICAL BASELINE CIV COUNT needs deciding (4 vs 7);
  checkpoint labels are t101/201/301/401 (pin targets in that
  convention).
- **THE BIG FLAG: GE no-chaos COLLAPSE** — cities median 1, techs 7,
  stuck 100% at t301: the chaos stream's churn has been quietly
  RESCUING the God-Emperor AI from disorder paralysis, so chaos-on
  soaks overstate AI health. ADOPTED: the AI-capability program
  baselines against the NO-CHAOS pair; chaos-on remains the
  regression-soak configuration.
Targets get pinned in the user's tuning session against these
distributions. CANONICAL MEASUREMENT CONFIG (user, 2026-07-16):
**7 civs, medium 80×50, NO-CHAOS**, checkpoint labels t101/201/301/
401 as measured; M9's denominator becomes non-polar land+coast
(A84). The re-baseline runs AFTER the era-scaling family lands — RAN
2026-07-16 evening (sim-runner #534): capabilities real-but-
dormant, attackers 0/50 games, buys 0/306, expl ~6%; M6/M11
targets DEFERRED to post-B21 (they'd measure militia noise). New
columns ADOPTED: garrison% (own-city-tile military share),
resourceCov% (worked special-resources within Chebyshev-2 —
healthy 85-94%, high-bar target ≥80%), disorderTurns (cumulative
city-turns; target caps the TAIL <500 by t400, not the median),
river-ADJACENCY% (DROPPED post-B21 — terrain noise even as
adjacency). **M-TARGETS PINNED (user session 2026-07-16 evening,
post-B21 numbers #558): M4 improvement% ≥75 · resourceCov% ≥80 ·
M10 buys >0 per civ · M10 treasury bounded (<~50g/turn sustained
climb) · M2 cities ≥8 · M3 pop ≥50 — all at t401, canonical 7-civ
no-chaos normal; enforcement = A93 (soak floor-check in the
nightly). KNOB DEFAULTS RULED: attackerPerCity 1, aiBuyThreshold
200, aiScoutSharePct 25, aiAttackerTechWeight 1 (sweep curves in
#558). HOLD until gaps close: M5 rails, M6 modernity, M11
conflict — gap 1 = attacker k/l ~0.28 (coordination window's
justification), gap 2 = exploration algorithm-bound ~7% (B23).
disorderTurns target = p90 < 800 by t400 (B22 in flight).**
**POST-B23 FLOOR RESULTS (2026-07-17 close batch): M9 18% WIN ·
M6 67.5 WIN (attackers modernize the mix) · buys/treasury MET ·
M2 8.0 MET-borderline · M3 pop 48 MARGINAL (war attrition) · M4
impr% 70.5 MARGINAL MISS (workers pulled to explore+war — watch)
· M11 elim% 57 FAR ABOVE the 20-40 band = the OVER-CONQUEST gap,
the pinning session's #1 item (docs/15 §2f).**
**POST-M11-PIN STATUS (2026-07-17 morning — the over-conquest gap
CLOSED): B26 gated defender sorties, B23c restored the guards>=2
expansion floor (its removal in B23b halved cities — caught same-
night by these very floors on their first enforcement + the marker
A/B), B26b re-shaped the doctrine gates to integer percents, and
the user PINNED `aiWarDoctrine["1"].defenderGatePct = 30` (M11
session): elim% now ~29 (band CENTRE) with conquest AT ITS PEAK
and the healthiest economy — a free win, sim-runner #795/#841.
Also landed: N3 naval probe (AI builds+scouts ships — first time;
naval loop measured, build-warship is the next weak lever #859/
#863), resourceCov telemetry (the §12 floor's PENDING now ACTIVE),
and the opener-scout exception was MEASURED + REJECTED (#849:
sole-guard scouting halves expansion — the guards>=2 floor is
load-bearing). Remaining M-gaps: exploration ~8% (STRUCTURAL — the
veto is too blunt; B23d relaxed-veto is the fix, not a knob),
defender bloat (N4 garrison cap in flight), N1 government
monoculture / N2 tech ceiling (the next systemic ceilings).**
**THE NO-OP CHECK (user standing order, 2026-07-16 night): before
declaring any strategy/knob INERT ("unchanged vs golden"), assert
the ACTIVITY DENOMINATOR is nonzero — 0 exploration steps, 0
conquest attempts, 0 boats IS the finding, not a null result. A
sweep that cannot move because nothing happens in the baseline
must be reported as a DORMANT-CAPABILITY verdict (with the zero
named), never as "knob has no effect". Retroactive examples: the
attackerPerCity byte-identical sweep (attackers=0), the
scoutShare dead-end (scouts pinned), the inert coastline-follow
(scouts never ranged).** From the
re-baseline on, a HUMAN BENCHMARK row (metrics extracted from the
user's real Shift+D recordings per difficulty) sits beside the AI
configs — the tuning target is "challenging, legible, fair" vs the
human line, not AI self-play win rate (ally, specs/ingame-AI-
factors.md) —
measuring the pre-fix AI twice buys nothing.

Two halves, strictly ordered: (1) A64 = the MEASUREMENT (telemetry
columns in sim-driver/soak --stats — golden-safe, ships first;
sim-runner then baselines current behavior across ≥25 seeds); (2)
the AI CAPABILITY program (B13 + A63 + batches 5+) improves toward
the targets under the batch-4 lab discipline — measured iterations,
only winners port, both engines together, goldens re-record per
window. M5 rails, M6 reactive modernization, M7 era buildings, and
M8 wonder targeting are NEW AI capabilities; M1–M4 largely need
tuning of existing behavior.

**NAVAL LOOP — the acceptance SEQUENCE (ally, 2026-07-17, after N3).**
N3 made a coastal AI build+scout ships; that is BUILD, not USE. Measure
the loop in ORDER, and do not optimize fleet composition / blockades /
naval warfare until the AI reliably completes the whole chain:
`discover coast → build ship → explore → discover target → build
transport → load units → cross water → land → support foothold`.
The ordered questions + metrics (each a SEPARATE measured claim):
(1) build ships when water matters? — ships by map type, coastal-city
ratio, first-ship turn; (2) explore useful unknown coast vs circle home?
— new fog tiles per ship-turn; (3) discover another landmass by sea? —
`crossWater` rate, first-overseas-contact turn; (4) land an army
deliberately? — transports built, loaded-cargo turns, successful
landings; (5) protect cargo? — transport/cargo losses, escort ratio;
(6) does overseas invasion create value? — overseas cities founded/
captured, survival after 20/50 turns. (N3b transport-loading doctrine
is gated behind step 4; the AI has no load/unload doctrine yet — the
current stepEntersSea guard keeps land units OFF ships until it does.)

**ACTIVITY-BASELINE OUTPUT FORMAT (ally formalization of the no-op
check, 2026-07-17).** For any mechanic under test, the sim output prints
these as SEPARATE lines so "capability exists" and "capability produces
strategic value" can never be conflated:
```
Capability available:       yes/no
Capability triggered:       <count>
First trigger turn:         <turn or never>
Strategic outcome produced: <count>
Outcome quality:            <metric by scenario>
```
"the AI can build ships" and "the AI uses sea power to discover/settle/
invade" are two rows, never one. Zero in the triggered/outcome lines IS
the finding (dormant capability), never a null result.

**A64 emitted `--stats` fields (landed 2026-07-15).** Each `t:"checkpoint"`
JSONL row carries per-player entries plus row-level cross-civ figures.
Per-player: `techs` (M1), `cities` (M2), `pop` (M3), `imprPct` (M4),
`netRoad`/`netRail` (M5 — % of same-continent city pairs connected; `null`
when the civ has <2 same-continent cities), `milPct` (M6 — PARTIAL: best-power
tier proxy, full obsoletedBy % reserved for A63), `bldgPct` (M7 — % of the
tech-available beneficial buildings the city has, averaged), `wonders` +
`wonderAct` + `wonderTry` (M8 completed / in-progress / distinct attempts),
`explPct` (M9 — explored non-ice %), `gold` + `buys` (M10), `attacks` +
`captures` (M11), `idleSet` + `stuckU` (M12), `continents` + `crossWater`
(M13). Row-level: `aliveCivs`/`deadCivs` (M11 elimination base) and
`scoreSpread` (M14 — best/worst surviving-civ score ratio, `null` pre-scores).
The cumulative columns (`buys`, `attacks`, `captures`, `wonderTry`,
`crossWater`, `idleSet`/`stuckU`) come from a DRIVER-OWNED accumulator that
reads the events the engine already emits and a driver-only unit-idle ledger —
never state, so goldens are untouched (measured: per-turn capture cost is
within run-to-run noise, <1%). Helpers unit-tested in `test/sim-telemetry.test.js`.

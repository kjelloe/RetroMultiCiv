# The AI measurement program — instruments, canonical configs, doctrine

One page for "how do we measure AI quality": every instrument, its
exact config, what it answers, and where results get banked. Written
2026-07-28 (consolidating what lived in build-doctrine-plan appendices,
mail bodies, and untracked debugging notes). The CODE is the truth if
constants drift.

## Doctrine (hard-won, in force)

1. **Hashes moving ≠ mechanism firing.** Probe coverage by DIRECT
   COUNT (buildings built, events fired) — never infer behavior from
   golden movement alone (the slice-1a dormancy lesson: all-green
   tests, 0.9% real coverage).
2. **Probe in the CANONICAL config** (below), never the golden-seed
   sim config — the 4-civ 56x35 golden seed once showed 73% where the
   canonical showed 6.2% (accidental cherry-pick).
3. **Small samples pick variants; the 25-seed sweep GATES.** 3-seed
   locals are for choosing between calibrations mid-window only.
4. **Routing:** the dev PC runs ONLY the pin-writing re-record
   (writes into test files pre-commit). Everything else — sweeps,
   probes, witnesses, comparisons — runs on the sim-runner box
   (Ryzen 5600X, --jobs 6), launched via `debugging/job.sh`
   (setsid-detached; survives session teardown; pre-approved there).
   Any run >~2 min on an agent box MUST go through job.sh.
5. **Measurements never block the 1.0 path** (user ruling) — they
   inform; gates are the sweeps + reviewer verdicts.

## The instruments

### 1. Canonical 25-seed sweep (the GATE)

    node tools/soak.js --seeds 25 --turns 400 --civs 7 --size medium \
      --no-chaos --jobs 6 --stats <out.jsonl>

Prince difficulty, 80x50. Answers: invariants clean? M-floors hold?
The authoritative figure for any behavioral window; the marker verdict
rides on it. Floors (nightly `--enforce-floors`, .github/workflows/
nightly-soak.yml): M2-cities ≥ 6, M3-pop ≥ 22, M4-impr ≥ 50,
M10-buys, M10-treasury, M-resourceCov. Post-W6 references: M2 17.5,
M3 62-64, M4 91.5.

### 2. Golden-seed sim + honest re-record (the PIN WRITER, dev PC)

seed 20260712, 4 civs, 56x35, chaos ON, 400t double-run (+ the
natural 550t run) — test/simulation.test.js via test/sim-driver.js.
NOT a measurement instrument (rule 2); it exists to pin determinism.

### 3. The #28 behavior-hash discriminator (STAMP vs BEHAVIORAL)

`node debugging/behavior-discriminator.js` — runs the golden soak +
natural and prints the full checkpoint hash AND the stamp-excluded
behaviorHash side by side (sim-driver records behaviorCheckpoints;
the behavior hash drops the createGame rulesetHash stamp).

Classification at re-record time, against the committed BEHAVIOR_*
pins in test/simulation.test.js:
- full moved + behavior UNCHANGED → **STAMP-ONLY** (a data/*.json
  knob rippled the createGame stamp; trajectory byte-identical;
  re-pin without a behavior review).
- full moved + behavior MOVED → **BEHAVIORAL** (real trajectory
  change; needs a witness/coverage probe + review).
- The t100-HELD signature (behavior t100 unchanged, 200-400 moved)
  additionally proves effects fire mid-game onward and doubles as an
  anti-paste-back check (a pasted pin can't reproduce a held prefix).

Why it exists: a knob addition moves EVERY pin via the rulesetHash
stamp, which is indistinguishable from a behavior change by full hash
alone — this killed a whole misattribution class (seaPathRadius,
holdPathPct analyses were the manual precursors). Design history:
the (untracked) debugging/behavior-hash-28-design.md proposal; this
section is its durable form.

### 4. Peace witness (low-threat development probe)

`node debugging/probe-peace.js` — the user-designed defensive pair
(chinese + germans, attackerPerCityPct 0, via sim-driver
opts.roster), 100x62, t400, 10 seeds. Answers: does the AI DEVELOP
when war pressure is off? (Chronic 7-civ threat masks development
failures.) Acceptance reference (slice-1d): seed 2 = 124 cities /
18% doctrine coverage / both civs alive at the calendar end.
Falsified predecessor: a bare 2-civ map is a DUEL, not peace — civ
count does not control conflict; personality selection does.

### 5. Concept histogram (coverage of everything)

`node debugging/probe-concepts.js <seeds> <turns> <civs>` — canonical
form `3 400 7`. Tallies every command + event over full AI games;
the UNUSED_EVENT_TYPES line is the definitive list of concepts the
AI never touches. Caveat: short horizons inflate the unused list
(buildingBuilt was "unused" at t100 and 1564 at t400) — canonical
scale only for conclusions. Reference round: build-doctrine-plan.md
"Measurement round 2026-07-27".

**READ IT AS A RATIO, NOT A LIST (W8, 2026-07-30).** The tally's real
power is COMMANDS ISSUED vs the EVENTS those commands emit. A doctrine
can issue a command every turn and have the engine REJECT every one:
W8 shipped with ~94 `diplomatMission` commands producing 2 accepted
steals (the once-per-city `alreadyStolen` rule) and 624
`establishTradeRoute` commands producing ZERO routes (the 10-tile
`minDomesticDistance` rule). Goldens moved, fixtures were green, the
twin was faithful — and half the doctrine was inert. So: for every new
AI behaviour, pair the command count with the event its ACCEPTANCE
emits, and treat a large gap as a defect. Note which events fire on
BOTH success and failure (`TECH_STOLEN` does) — those count acceptances
and are the sharper signal; success-only events (`CITY_SABOTAGED`)
cannot distinguish a rejected command from an unlucky roll.

**Corollary for fixtures:** a command-level fixture proves the AI CHOSE
something, never that the engine will TAKE it. Where a mechanic has
legality rules (distance, immunity, cost), the fixture must encode them
or it will pass on a command that is always refused in play.

### 6. Natural victory distribution

`--natural` multi-seed with `--turns 600` (games must be allowed to
REACH endYear ~545 — a 400-turn cap manufactures a fake 0-victory
finding; that artifact happened, #2823). Reference: 24/25 endYear
score victories, 1 elimination, balanced winners, 0 space.

### 7. Marathon / long-horizon

endYear pushed out (rulesOverrides endYear 9999 or --turns 1500+).
The sim-driver tripwires (MAX_UNITS 1000 / MAX_GOLD 100000) are
env-overridable for these runs ONLY: `SIM_MAX_UNITS=4000
SIM_MAX_GOLD=500000 …` (b9e01e3; defaults untouched, suites
unaffected). Feeds: nuke-doctrine v1.x trigger windows, the space
commit-gap question, tree-exhaustion pacing.

### 8. Space commit funnel (9-metric witness)

Rides `--stats` (tools/soak.js space rows, from shared/strategic
snapshots + exported ai.js predicates): spaceEligibleTurn /
commitTurn / abandon+reason / pathPct / gateTechTurn / component
start+done / launch / threat@commit / M-floor. Extract per-civ to
locate WHERE the funnel breaks. See xii5b-space-project.md addendum
2026-07-28.

### 9. Strategic telemetry rows (`--stats`)

Every soak can emit per-AI strategic + outcome rows (v1.5 schema;
shared/strategic.js snapshot = the same data the debug 🧠 overlay
shows). `node debugging/stats-summary.js <stats.jsonl>` prints the
exit-criteria numbers; debugging/stats.html charts them.

### 10. Disasters ON/OFF comparison (resolved)

25-seed canonical pair, identical floors both sides (M3 64) — the
ship default (ON) is measured floor-safe. Re-run only if the
disaster system itself changes.

## Where results bank

Window-scoped findings → the owning spec's delivery log (e.g.
build-doctrine-plan.md); cross-window findings → the closest standing
spec (space → xii5b addendum) + a memory pointer; verdict mails carry
the numbers, specs carry the conclusions. Never leave a conclusion
only in mail.

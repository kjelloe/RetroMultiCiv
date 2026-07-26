# marker-0108 — W6 slice-1 COMPLETE: the build-doctrine + garrison-discipline arc

**Tag:** `marker-0108` @ `6796e2e` (2026-07-26). **MERGE-CONSISTENT — the user may
merge this** (supersedes marker-0107).

The largest behavioral engine change since the naval arc: four slices, three
gate-caught course corrections, five honest golden re-records, and an AI that
now actually develops its civilization. Also aboard: the Roblox 1.0-parity
ruling + appendix, the roblox close-stack batch 1, and the M3-pop ratchet.

## The arc (slice by slice — each gate caught what the prior missed)

- **1a @6fc9d6a — the doctrine.** `doctrineBuilding` (§3a core loop: temple on
  disorder, granary before the settler loop, temple after), knobs in
  `rules.buildDoctrine`, fixture-first. All tests green — and the sim-runner's
  sweep caught it **DORMANT** (temple coverage 0.9%): the slot was gated off
  under threat, and threat is chronic at 7-civ density.
- **1b @00c3267 — the threat-gate drop.** Coverage 3× — and the sweep caught
  **M3-pop regressing 25 → 15.25**: granary-first crowded out settlers
  empire-wide (the §3a high-food escape never fired under despotism: the tile
  penalty caps surplus at 2, the knob demanded 3).
- **1c @2728152 — the defer calibration** (user-ruled): `granaryDeferPop 3` +
  `highFoodSurplus 2` — pop-1/2 settler factories keep settling, the median
  city builds its granary. Still **M3 FAIL 15.5**: the cascade was correct but
  mostly unreachable.
- **The diagnosis** (peace witness + reviewer #2775 corroboration): **GARRISON
  ROAM.** The escort branch and the march-at-enemy branch never checked
  `fortified`, so garrisons walked off; the brain's stay-home floor also
  disagreed with production's `wantDefenders` (garrisonAlways2). Cities rebuilt
  militia forever; settlers, doctrine, and economy all sat behind the
  never-satisfied floor.
- **1d @bec9658 — garrison role discipline** (user-ruled: garrison holds its
  post, scouts still range): a fortified unit in an own city departs only if
  the guard floor survives without it; floors aligned. The user's
  personality-selected **peace witness** (chinese+germans defensive pair via
  the new `opts.roster` + `debugging/probe-peace.js`) was the acceptance
  instrument.

## The numbers (why this marker matters)

| Metric (25-seed canonical) | Baseline | 1c | **1d (this marker)** |
|---|---|---|---|
| M3-pop median (floor 22) | 20 | 15.5 | **62** |
| M2-cities median (floor 6) | ~7 | 4.25 | **16** |
| M4-improvements % | ~57 | 56 | **91.5** |
| Temple/granary coverage | 0.0% | ~2% | **57.3%** (reviewer direct count; 7×) |
| City count (2-seed canonical) | — | 49 | **281** (5.7×) |

Invariants **25/25** (after the checker fix below). Peace-witness seed 2:
124 cities, 18% coverage, both civs alive to the calendar. Natural golden
restored to 545/p2.

## Gate verdicts

- **Reviewer #2787 (code)**: pristine clean-clone `--full` 0-fail incl. the
  Luau 400-turn golden; block scoping, twin namespacing sweep (14/14
  `combat.unitsAt`), paste-back consistency all verified. **#2788 (coverage)**:
  its own before/after direct count — 8.2% → 57.3%. CLEAN, 0 defects.
- **Sweep (architect fallback box, 23 clean + 2 re-verified)**: floors above.
  The gaming-PC sweep run continues as corroboration.
- **Twins gate 11/11** — and it earned its keep twice this arc: it caught a
  bare-`unitsAt` nil-call in the Luau twin pre-push (would have crashed the
  Roblox AI), and the Luau AI reproduces the new trajectories bit-exact.

## Two findings worth knowing

1. **The space race is live in the wild.** Sweeps now reach Apollo parts in
   ordinary games — which exposed a latent checker gap (`ss-part` was a legal
   production kind the invariant never learned; seeds 17+24 false-failed).
   Checker fixed to mirror `setProduction` legality; both seeds re-verified
   clean. First-ever organic space-race activity in the canonical config.
2. **Denser worlds cost runtime.** The golden soak double-run went ~3.5 → ~36
   minutes; sweep seeds run 2–9 s/turn. This is the doctrine working (more
   cities, more units), but every future golden window pays it. Lune smoke
   timeouts bumped 180→600 s; sim-test invocations documented as
   detached-run-only. A perf pass is a v1.x candidate, not a blocker.

## Also in this marker

- **M3-pop RE-RATCHETED** into nightly `--enforce-floors` (the 2026-07-25
  de-ratchet is closed) — the ratchet rides the same commit as its
  confirmation, per the rule.
- **The Roblox 1.0-parity ruling + appendix** (docs/13): functional parity
  closes for 1.0; D4–D6 client UI + all style/placement post-1.0; old
  ACCEPTED-DIVs stand. **Close-stack batch 1 already landed** @80b42b8
  (endscreen happy/future itemization + WLTKD narration ×3 surfaces; items
  3/4/6+5-core verified already present).
- Store logo committed (`roblox/images/logo-512.png`); thumbnails ruled
  Studio-captured; genre recommendation (Strategy, no subgenre) staged.
- Fixture modernizations: the ff abort fixture is deterministic-by-construction
  (seed-hunting retired); wonder-drive witness re-pinned (7/14 seeds fire);
  `test/garrison.test.js` new (3 cases, stash revert-proofed).
- `lessons-learned-1.md`/`.html` (agent collaboration + tooling patterns).

## Test state

Pristine clean-clone 0-fail (reviewer, incl. 400/natural Luau); local: doctrine
8/8, garrison 3/3, ai 52/0, priority 7/7, ff 7/7, scenarios 68/68, age 7/7,
twins 11/11; sim pins paste-verified green. The only local red all window was
the gitignored B13 witness — regen assigned to bugfixer (in progress).

## Breaking notes

None for saves. Old recordings crossing AI turns diverge on replay (expected
for a behavioral window). Nightly note: the M2 red predicted mid-window never
shipped — the window closed green with BOTH M2 and M3 enforced.

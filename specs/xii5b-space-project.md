# XII.5b — the space-race as a strategic PROJECT (ally design 2026-07-21)

**STATUS: GO (user ruling 2026-07-21) — FULL ally design in one window, sequenced AFTER §14 treasury and BEFORE §12 settler pathing.** Parts-rush (shelved #1901) unlocks inside this window; the 9-metric sweep is the witness contract. This is the follow-up to the calendar-545 probe
finding (xii5 spec §11 + marker-0070: leaders reach 38–47/68 techs but miss
the space PATH — selection, not pace). The ally's slice design
(`specs/ally-design-response-2026-07-21-space-ai.md`, provenance `original`)
is adopted as the spec skeleton; this file adds the engine mapping. It is
the fleshed-out form of "option (a) AI space-path prioritization".

## Shape (ally design, engine-mapped)

1. **Eligibility gate** (visible, rules-derived; extends the existing
   XII.5 `victoryDrive` gate in data/rules.json): industrial/modern era +
   research-leader-or-within-gap + secure core (no capital emergency /
   invasion / garrison deficit — reuses the docs/15 threat inputs) +
   turn-feasibility vs rules.endYear + not conquest-committed.
2. **Project scoring — COLLAPSED (Q2 ruled B, #2051):** the ally's numeric
   `spaceProjectScore` is NOT computed; the commit gate is a 4-predicate
   boolean (`spaceDriveOn(stance)` + `spaceCommitEligible` + snapshot mode in
   {building,expanding} + snapshot threat in {none,low}). Where each of the 7
   ally score terms lives: coreSafety / remainingTurnFeasibility / tech-lead-gap
   live in `spaceCommitEligible` (engine/ai.js); militaryEmergency is the
   snapshot `threat` read; scienceCapacity + productionCapacity are implied by
   the research-leader eligibility; opponentSpaceLead is omitted in v1 (multiple
   committed civs = a race, kept contestable by the Q4 pause). No
   `spaceCommitScoreThreshold` knob (dropped — the twins count-check house rule
   would flag a dormant data key). Rationale: the eligibility predicate already
   encodes coreSafety/turn-feasibility/tech-gap, so a numeric score with guessed
   weights duplicated it and invited sim-sweep churn; the ally itself flagged the
   score as secondary to the path-research core.
3. **The behavioral core**: a committed civ's research choice PREFERS
   techs on the space-flight prerequisite closure (the 46-tech path —
   `shared/beeline.js` already walks the DAG; the engine side gets its own
   pure path-walk in the Lua-portable subset, NOT a client import).
   Off-path techs allowed only when no path tech is researchable.
4. **Visible tradeoff / abandon**: commit is legible (science+core focus,
   path-only research, defense floor held); core-safety collapse PAUSES or
   ABANDONS (state-derived, deterministic) — the ally's contestability
   requirement.
5. **Measurement contract**: the ally's 9-metric table verbatim
   (spaceEligibleTurn / commit / abandon+reason / path-completion % /
   off-path count / component start+done / launch+victory / threat at
   commit+launch / M-floor regression). These extend the `--stats`
   strategic rows; sim-runner runs the sweep.
6. **Acceptance** (ally's framing, adopted): in appropriate peaceful long
   games ≥1 civ recognizes and pursues space; under pressure it can be
   delayed, deterred, or forced to abandon. NOT "every game launches".
   Plus: M-floors hold (no baseline regression), JS==Luau, two-phase close.

## Boundaries

- Engine lane, golden-affecting, behavioral — same two-phase close pattern
  as XII.5/D3. Queue position: after the current bugfixer pipeline
  (d3-server-surfacing → xiv-ai-behavior → air-truth → naval-truth →
  difficulty-authentic) unless the user promotes it.
- Composes with the parked treasury doctrine (xiv-ai-behavior §14): a
  space-committed civ with surplus gold rushing PARTS (never Apollo) is the
  shelved #1901 work's natural home — coordinate the two designs at their
  window.
- The solar-last part-order nit (#1916) folds in here (trivial ordering
  fix inside the same window).

## Calendar boundary (ally caution, our standing answer)

Adopted as a PERMANENT boundary with one honest clarification: our `year`
is engine STATE derived per-round from yearSteps (not a UI label), and
`rules.endYear` legitimately ends the game — that is the Civ 1 design and
it is deterministic and golden-safe. The ally's real rule holds as stated:
**nothing infers behavior from DISPLAYED dates** — UI maps state→label,
never label→logic; AI/victory/yields read state and rules only. Recorded
in specs/calendar-545.md as well.

## Status log (the measure-tune-measure record)

- Sweep 1 (#2113): PATHOLOGICAL — 0/25 launches, 100% abandon (every-turn
  peace check). → TUNE (abandon only warring/high) landed 3f2b6b5.
- Sweep 2: improved (commits reach 67-91% path) but 3/3 still abandoned on
  threat; seed-5 committed at threat NONE, died to a later spike. → LATCH
  (sustained-K hysteresis, spaceThreatPatience=6) landed 2349456.
- Sweep 3: 4 commits, 4/4 STILL abandoned on threat — decisive evidence:
  milAtCommit == milFloorMin in ALL four (zero military losses; the threat
  metric is chronic late-game proximity noise, not danger).
- USER FORK RULED (a) 2026-07-21 (#2138): DANGER-BASED abandon — concrete
  events only (mode warring / enemy adjacent to capital / city lost while
  committed); latch field+knob REMOVED entirely (the latch CODE was
  correct — the SIGNAL feeding it failed). Landed 706b19d; reviewer GREEN
  #2146; Gate-B GREEN #2150.
- Sweep 4 (the danger-abandon acceptance, #2159): floors ALL GREEN
  (M2 15 / M3 54.5 / M4 61 on the re-baselined floors); commits 24 of 25
  seeds (vs 3 in sweep 3); 5 civs complete the research path; 4 still
  committed at sweep end — abandon is no longer universal, and abandons
  now coincide with real military collapse (e.g. 225→126). BUT 0 launches:
  ssPartStartTurn=0 everywhere, and a failed-seed save shows wonders=={}
  at t519 — NO wonder is ever built, so the Apollo Program gate
  (spaceship.js apolloActive) never opens. The abandon slice meets its
  own criteria; the launch blocker is UPSTREAM: the AI never builds
  wonders (topGoal 'wonder' = 64/6375 stats rows; ai.js apolloReady
  exists but build selection never chooses a wonder). → NEW USER FORK:
  the wonder-building slice (options: committed-civ-builds-Apollo
  narrow fix / archetype some-civs-build-wonders v1 slice / both staged).
  Witness rider: soak.js abandonReason still prints pre-slice 'threat'
  vocabulary — concrete-reason derivation queued.
- WONDER FORK RULED staged-both (#2160, 2026-07-22): (1) APOLLO-NARROW
  landed 52754ca — the ACTUAL root cause of 0-launches was the build
  path gating Apollo on spaceDriveEligible (ALL part techs), so a
  committed civ holding only Apollo's tech never built it. Fix: a
  spaceCommitted civ with the Apollo tech + Apollo unbuilt builds
  apollo-program TOP in its capital; uncommitted byte-identical;
  gold-rush still forbidden for wonders. NEW positive cross-language
  witness luau/apollo-check.luau (0x5fac5db2); abandonReason rider
  shipped (concrete vocabulary). (2) Archetype wonder slice ("some
  civs MUST build wonders") = its own v1 item after manhattan-gate/
  naval-loop; architect drafts the spec. 5TH WITNESS = the acceptance
  measurement (25-seed, launches>0) — verdict appends here.
- ARC CONCLUSION (2026-07-22, witnesses 5+6 + the dig + the radius arc):
  BOTH acceptance sweeps 0-launch. The verification cascade: witness-5
  (0 launches, 15/18 abandons 'warring') → seed-21 dig (apollo WIRE
  exonerated — the civ never researched space-flight, hasApolloTech=0
  all game) → reviewer radius lead (wrong for seed-21, corrected on
  record #2190; RIGHT in general — both space BUILD guards still used
  the deleted radius-8 doctrine) → radius fix ad5da20 (cheb-1
  migration, marker-0084) → witness-6 STILL 0 launches. The pathPct
  instrument audited mathematically correct; gateTechTurn added to
  disambiguate gate-blocked from near-launch. VERDICT: every
  mechanical layer is now individually verified (commit / abandon /
  wire / guards / instrument); the sole remaining blocker is RESEARCH
  DEPTH vs GAME LENGTH — the #1912 conclusion, returned with all the
  machinery in place. FORK WITH THE USER: (a) measure-first — a
  witness sweep with the authentic per-difficulty AI research knobs
  (aiBulbInc, king/emperor rows) force-enabled in all-AI, answering
  whether real King+ games already launch; (b) bulb-cost tuning at
  prince; (c) peace-seeking committed civs. No further space work
  until ruled.
- MEASURE-FIRST RESULT + FINAL RULING (2026-07-22, #27 harness +
  user ruling "SPACE_FORK go with recommended (b)+(c) staged"): the
  King sweep (simulatedHumanSeat, 22/25 seeds) = 0 launches BUT King
  is space-CAPABLE — seed-13 committed t300, reached pathPct 100% +
  gateTech t400, then the 'warring' abandon dropped a COMPLETE space
  drive at t370; late commits (t480-510) lack ss-part runway. Research
  depth is EXONERATED; the endemic late-war is the blocker, twice
  (abandon + delay). RULED (b)+(c) staged:
  (b) WAR-HOLD slice (next engine window after presence-2): the
      'warring' abandon trigger becomes CONDITIONAL — a committed civ
      with pathPct >= rules.json victoryDrive.holdPathPct (start 80,
      sweepable) HOLDS the drive through ordinary war; the two hard
      triggers (enemy cheb-1 adjacent to capital, city lost while
      committed) stay UNCONDITIONAL. Civ1-authentic: the original AI
      beelined space while fighting. Golden-affecting: twins + full
      re-record + a seed-13-class witness (the civ that had 100% and
      was war-abandoned should now hold and launch).
  (c) the endemic-war/unit-bloat batch = queued bugfixer #30
      (xiv-ai-behavior), unchanged order — the upstream fix that
      gives late commits runway.
  ACCEPTANCE (7th witness): after (b) lands, re-run the #27 King
  sweep (same harness flags) — launches>0 expected; the sweep re-runs
  again after (c) for the runway effect.

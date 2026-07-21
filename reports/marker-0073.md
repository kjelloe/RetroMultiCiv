# marker-0073 — XII.5b: space as a strategic project (MERGE-CONSISTENT)

Tagged at `62b202b` (2026-07-21, user-away window). **MERGE-CONSISTENT —
supersedes 0072.** Completes the space-victory arc the ally designed: an
eligible AI now RECOGNIZES the space route, commits deliberately, researches
toward it, rushes parts with surplus gold, and backs off under pressure.

## The six parts (engine/ai.js + luau/ai.luau, JS==Luau byte-exact)

1. COMMIT ELIGIBILITY (`spaceCommitEligible`): own-era industrial+ (the
   civ's most-advanced tech era, city-era pattern) + research leader or
   within spaceCommitTechGap=3 + secure core (threat inputs) + turn-
   feasibility vs endYear + not conquest-committed.
2. COMMIT GATE (Q2-B): 4-predicate — drive-stance && eligible &&
   snapshot.mode in {building,expanding} && threat in {none,low}. The
   ally's 7-term numeric score is CONSCIOUSLY COLLAPSED (documented in
   specs/xii5b-space-project.md): its terms live in the predicate/threat
   check; opponentSpaceLead omitted v1 (multiple committed civs = a race;
   pause keeps it contestable). No dead knobs.
3. PATH-PREFERRING RESEARCH: `markTechPath('space-flight' + part techs)`
   restricts a committed civ's research pool to the space path,
   SUPERSEDING monarchy/attacker paths; the empty-onPath fallback is the
   escape (off-path only when nothing on-path is researchable).
4. CONTESTABILITY: core-unsafe → PAUSE (drop path-research + parts-rush,
   hold the defense floor, auto-resume); capital loss / era drop → hard
   ABANDON. State-derived.
5. PARTS-RUSH (#1901 finally lands): §14's surplus lever extends to kind
   'ss-part' for a COMMITTED civ only. Apollo and all wonders: never
   gold-rushed (#1899 — the reviewer's standing guardrail check).
   SOLAR-ORDER FIX (#1916): solar pulled ahead of beyond-minimum
   structurals — the pointless ~t1860 marathon bottleneck removed.
6. WITNESS (Q6-A, golden-neutral, `62b202b`): predicates exported
   witness-only; tools/soak.js --stats emits per-civ 'space' JSONL rows =
   the ally's 9 metrics (eligibleTurn/commitTurn/abandon+reason/pathPct/
   offPath/partStart+shipDone/launch+victory/threat@commit+launch/
   mil-floor). Verified byte-identical --stats finalhash pre/post.

## Found + fixed during the window

The ERA GATE was a silent NO-OP in both engines (`ruleset.ages` vs
`ruleset.rules.ages` — techEraRank always returned the fallback). Caught by
the new ancient-parts-rush control test during twinning; fixed both
engines; goldens re-recorded a second time inside the window.

## Gates

- Reviewer clean-clone + engine-diff (#2054): GREEN — 675/671, luau-400
  0x21762ecd, natural 545/p2 unchanged (space contestable, not yet a
  launch in the golden seed — as designed), ALL SIX declared checks pass.
- Gate-B: 0072-precedent FALLBACK (sim-runner session inert ~4h): author
  self-witnessed JS==Luau byte-exact (soak 100..400 + natural), M-floor
  ratchet floors GREEN, architect landing suites 47/47 + Q6 50/50 +
  full suite 679/679. A real Gate-B re-run on the tag is welcome when the
  session wakes.
- First witness population (natural run): p7 eligibleTurn=290 pathPct=70,
  commitTurn=0 — eligible but never peaceful enough to commit = the
  contestability design working; no false rows.

## Behavioral note for the next measurement

The 545t golden seed shows eligibility + path-preference but no LAUNCH —
consistent with the §11 finding that leaders need the right RESEARCH PATH
early enough. The 9-metric sweep across seeds (sim-runner, when awake) is
the designed instrument for the accept/tune conversation; the witness now
measures exactly what the ally asked.

## Test state
679/679 full suite at the tag (SIGTERM flake passes isolated). Tree clean.

## For agents
XII.5b locks released at the tag; §12 settler-pathing window (3/3) opens at
the bugfixer. Roblox manifests still parked on the sim-runner session.

# marker-0087 — the sail-era + the space drive holds through war (MERGE-CONSISTENT)

Tagged at `3a0744a` (2026-07-22 evening). **MERGE-CONSISTENT —
supersedes 0086. Current merge candidate** (19th consecutive,
0069–0087). Gates: presence-2 double-green (reviewer #2232 clean-clone
768/765 + sim-runner tag-grade judge PASS #2240); war-hold reviewer
green #2234 + its own behavioral witness; witness-7 ran as the staged
ruling specified.

## What changed (delta since 0086)

1. **Naval presence-2** (`3bc426a`, fork ruled #2230 option A): the
   sail-era. M4 navigation beeline — an island-saturated naval civ
   whose overseas opportunity needs open ocean beelines navigation,
   builds a sail, crosses, settles the wide-gap islands. needsOcean is
   fog-honest (known-site coastal-path test + unexplored-sea-frontier
   fallback for the bootstrap case). The M1 useless-carrier gate stops
   carrier builds with no real opportunity. Twin byte-faithful; minimal
   re-record (no knob: turn-100 anchor + archipelago witness
   unchanged; natural 431 rounds). **Judge sweep PASS** (#2240,
   pre-registered acceptance): overseas median holds, mean overseas
   settlement 1.64 → 3.32 (~2x); the pre-registered revert rule was
   not needed.
2. **Space war-hold, the ruled (b) slice** (`cd1f2c6`, ruling #2220):
   the 'warring' space-abandon is now conditional on
   `spacePathPct >= victoryDrive.holdPathPct` (80, sweepable); the two
   hard triggers stay unconditional. Direct witness: seed-13's civ —
   war-abandoned a COMPLETE drive at t370 in the #27 measurement — now
   holds it (abandon t0). **Witness-7** (#2246): war-hold works at
   sweep scale (9 seats hold through war); launches remain 0, which is
   the STAGED-RULING expectation — the production/research runway is
   the (c) half (xiv-ai-behavior, queued #30); witness-7 re-fires when
   it lands.
3. **Behavior-hash discriminator** (`3a0744a`, the user-flagged
   coverage item): behaviorHash (rulesetHash-excluded) twinned in both
   engines, recorded by sim-driver/sim-smoke, BEHAVIOR_SOAK/NATURAL
   pins beside the goldens, and a classifier that mechanically labels
   any future re-record STAMP-ONLY vs BEHAVIORAL. Kills the
   misattribution class the M3-floor analysis hit. Golden-neutral
   additive, 124/124.
4. **Roblox** (sim-runner commits `06448dd`, `380ab51`, `de8a977`):
   combined gate-4 re-bakes for difficulty + war-hold knobs + the
   gate-14 pedia mirror; **R6 slice-1** seat-registry (30 gates green)
   — with slices 2+3 verified in-tree, the R6 node is
   agent-complete. **Tier-3 certification re-audit: PASS** (#2222,
   verdict artifact `roblox/acceptance/tier3-cert.md`); a clean runH
   full autoplay to score-victory with zero errors (#2242). The
   Studded round-2 (user Studio session) is the only remaining
   axis-4 gate.
5. **Process/coordination**: the `flag wait` idle-lane listening loop
   (standard + CLAUDE.md; the root cause of nudge-dependence was idle
   turns executing nothing) + the #2235 hub concurrency race fixed
   (dispatch serialized, client parse-guard); measured RSS-per-game
   (#2228: ~245 MB fixed + ~1 MB heap/game — caps and CPU are the real
   ceiling, hosting docs corrected); A50 verified COMPLETE
   (reviewer #2225); the A7 window opened ruled-and-fact-checked
   (8-of-9, hoover same-continent, pyramids deferred to its own
   government slice #35).

## Test state

Full suite green at the tag in both engines (124/124 at the #28
landing; presence-2 768/765 clean-clone; war-hold 118). Known
parallel-load flakes unchanged. The A7 window (#29) is OPEN on top of
this tag — its re-record lands in the next marker.

## Next

Engine: A7 wonder effects (#29, mid-build) → pyramids-gov (#35) →
archetype wonders (#26, ally mapping) → xiv-ai-behavior (#30 = the (c)
half; witness-7 re-runs on its landing — the launch acceptance).
Client: helper resumes #26 capital-ui. User gates: redeploy from THIS
marker, the one-time box commands, the Studded round-2 session.

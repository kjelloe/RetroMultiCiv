# marker-0089 — Pyramids, the government wonder (MERGE-CONSISTENT)

Tagged at `13271d2` (2026-07-22 late night). **MERGE-CONSISTENT —
supersedes 0088. Current merge candidate** (21st consecutive,
0069–0089). Doubly gated: reviewer #2260 (clean-clone; the one suite
fail = the known SIGTERM parallel-load flake) + sim-runner Gate-B
#2259, which also independently confirmed the #28 discriminator's
STAMP-ONLY classification.

## What changed (delta since 0088)

One slice: **pyramids-gov (#35)** — Pyramids becomes the authentic
Civ1 GOVERNMENT wonder the A7 fact-check revealed (the proposed
production effect was Civ2-shape drift, rejected pre-pin):

- `revolutionAnarchyTurns: 1` — a revolution under an active Pyramids
  costs 1 turn of anarchy instead of the base 2.
- `unlockAnyGov: true` — any government selectable regardless of tech
  while Pyramids is active.
- The old hardcoded instant-switch branch (the drift) is REMOVED
  red-then-fix; both behaviors now read effect fields via a
  wonder-order-independent `pyramidsGov` helper, twinned byte-exact.
- Re-record: STAMP-ONLY (rulesetHash ripple; no golden-seed civ
  revolts under Pyramids) — classified by #28, confirmed independently
  by both gate lanes.

## Also banked this cycle (not part of the tag)

- The reviewer's **docs/15 fact-check** (#2261): the invade slice-B
  authority. Key reconciliation — the 3:1 is a LAUNCH heuristic only;
  Civ1 city assault resolves PER-UNIT (defenders one at a time, city
  loses 1 pop per defender killed unless Walls, open stack dies
  whole). The invade build must not model assault as one stack-sum
  roll.
- The **archetype impl-confirm ruling** (#2262): 4-tier wonderAppetite
  selector confirmed (LOW = shield threshold, not chance), Q3 witness
  thresholds pre-registered with the 25-seed before/after judge,
  affinity-flag fallback acknowledged (A59's 4 axes cannot express the
  ally's finer archetypes — to be relayed).
- The helper lane SELF-RESUMED under the flag-wait standard (capital-ui
  in build) — the first organic proof of the idle-loop doctrine.

## Next

Engine: archetype wonders (#26, in build — the A40 vision window) →
xiv-ai-behavior (#30, witness-7 re-fires) → invade B (fact-check
banked). Client: capital-ui, then the queue. User gates: redeploy
(0089 = the candidate), box commands, Studded round-2.

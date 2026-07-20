---
name: marker
description: Architect-only marker tagging flow — verify green, tag marker-NNNN, write the report, declare consistency, sync the living plan docs, notify lanes
---

# /marker — tag a dev_night save point (ARCHITECT ONLY)

Run when a landing is gate-green and ready to become `marker-NNNN`. Other
lanes never tag; sim-runner lands commits, the architect tags.

## Steps, in order

1. **Verify the tip**: `git log --oneline -5`, confirm the landing commits
   are on origin/dev_night (push first if local-only — dev_night push/pull
   is architect-granted 2026-07-20; dev/main stay user-only).
2. **Verify green**: run the delivered surface's suites via
   `debugging/t.sh <files>`; then check the FULL suite state. Known-red
   goldens from an OPEN golden window are allowed ONLY if the marker is
   declared not-merge-consistent (step 5).
3. **Number + tag**: `git tag -l 'marker-00*' | tail -3` for the next number;
   annotated tag on the exact landing commit:
   `git tag -a marker-NNNN <sha> -m "<one-line delta + consistency verdict>"`;
   `git push origin marker-NNNN`.
4. **Report**: write `reports/marker-NNNN.md` — delta since previous marker,
   each item what/why, golden re-records with new-hash summary, breaking
   notes, test state. Build-log voice (facts, no autonomous-actor framing).
5. **Declare consistency EXPLICITLY** in tag message + report + user note:
   either "merge-consistent — user may merge this" or "NOT merge-consistent
   (reason); latest consistent marker remains marker-NNNN". The user merges
   only the latest declared-consistent marker.
6. **Refresh the living plan docs** (user ruling 2026-07-20):
   `plan-version1.md` node statuses + last-updated line (verify an axis
   against the ENGINE before flipping it done); `plan-version2.md` only if
   something was deferred/promoted.
7. **Sync workitems**: human-workitems.md AND its HTML twin (same content,
   card markup); done-marks in agent-workitems.md if A/B items closed.
8. **Notify**: agent-mail to the involved lanes (subject = first line,
   verdict-first, ≤100 chars) + one short user-facing summary. Commit the
   report + doc syncs; run `debugging/sync-check.sh` if tests were added.

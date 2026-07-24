# marker-0099 — the corrected 0098 bundle (MERGE-CONSISTENT)

Tagged at `7d08d41` (2026-07-25). **MERGE-CONSISTENT — supersedes
0097 and 0098; current merge candidate** (0069–0099 line). This
declaration FOLLOWS the reviewer's marker-level clean-clone gate
(#2461, `--full` GREEN) per the augmentation adopted after 0098.

## What happened to 0098

0098 was tagged on component gates; the reviewer's clean-clone gate
then found ONE real client-test red (#2458, paired-proven vs 0097):
the play-lane sweep's `navigator.webdriver` AUTOMATION gate —
correct product behavior — suppressed the onboarding overlay inside
the very test that verifies onboarding (#141). The helper fixed it
same hour (test-only: the onboarding session masks webdriver over
CDP, presenting as a first-time human); independently verified by
the reviewer (#2460), re-gate green (#2461). 0098's merge
recommendation was withdrawn; 0099 carries the identical feature
set plus the fix. Process: "merge-consistent" now always waits for
the clean-clone gate (three-strikes class recorded, count 1).

## Content

Everything in reports/marker-0098.md (late-join feature-complete ·
join-share QR family · runI/runJ Studio-verified batch · play-lane
sweep to zero unexplained reds · view-contract/master-proxy/
lobby-drop merges · treaty shell · sec-reassess §7 · lane-watcher
live) + the #141 test fix.

## Test state

Reviewer clean-clone `--full` GREEN at `7d08d41`; browser 19/19;
engine/golden identical to 0097 (0xd4151d33 — golden-neutral bundle
confirmed twice).

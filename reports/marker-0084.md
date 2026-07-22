# marker-0084 — the space-pipeline repairs + manhattan gate (MERGE-CONSISTENT)

Tagged at `ad5da20` (2026-07-22 morning). **MERGE-CONSISTENT — supersedes
0083. This is the current merge candidate** (16th consecutive, 0069–0084).
Reviewer clean-clone GREEN with explicit TAG-GO (#2192): 746/743 zero-fail,
luau-400 `0xe4426771` reproduces the pin. Gate-B: reviewer's lune
reproduction stands as the documented fallback; a real sim-runner re-run
is invited on wake.

## What changed (delta since 0083)

1. **apollo-narrow** (`52754ca`, ruling #2160): a space-committed civ
   with the Apollo tech builds apollo-program top-priority in its
   capital (the original XII.5 F1/F2 findings finally wired); positive
   cross-language witness `luau/apollo-check.luau`; abandonReason
   witness rider (concrete vocabulary). Golden-neutral.
2. **manhattan-gate + no-nukes toggle** (`eafaf70`): nuclear units
   gate on the Manhattan Project (any civ) — the Civ1 rule; host
   toggle bans them outright; scenarios 056/057; rulesetHash
   re-record.
3. **radius-mismatch fix** (`ad5da20`, the #2186→#2190 arc): the two
   space BUILD guards migrate to concrete cheb-1 danger (the #2138
   doctrine, completed); the three defense consumers untouched
   (reviewer inventory #2188). Golden-neutral by itself. Boundary
   note: the general wonder-drive guard (ai.js:1683) deliberately
   stays radius-8 — general wonder economics, not space doctrine.
4. **M3-pop floor restored 27→28** (`76fa6ab`, #2181): 25-seed median
   47 — the provisional dip was 7-seed sampling, ratchet moved on
   evidence.
5. **Refinement XV** triaged (13 items, `specs/refinement-xv.md`) +
   count pins 747; hardening audit gap-fix merged (`f0e03b1`); roblox
   re-bake `fffaa9d`.

## The space-arc record (the night's through-line)

Witness 5 (0 launches) → seed-21 dig (apollo wire EXONERATED; the civ
never researched space-flight) → reviewer's radius lead (wrong for
seed-21 — corrected on record #2190 — but RIGHT in general: distant-war
capitals were build-frozen) → this fix. Witness 6 runs at the tag;
launch metrics are state-derived and trustworthy; the pathPct
instrument is under audit (#23) before further path-completion claims.
The remaining fork (research depth vs game length) is with the user —
measure-first option: a witness variant with the authentic
per-difficulty AI research knobs force-enabled.

## Test state

746/743 clean-clone zero-fail at the tag; author suites 751/752 (the
SIGTERM parallel flake, green isolated); twins gate 10/10; scenario
count 57.

# marker-0109 — W6 COMPLETE: slices 3+4+5 (city roles, war pair, frontier defence, wonder host)

DRAFT — tags on: sim-runner 25-seed sweep verdict (floors) + reviewer
pristine clean-clone (both in flight at write time). Numbers marked
[SWEEP] / [CLONE] fill in from those verdicts.

Delta since marker-0108 (@6796e2e): the W6 build-doctrine window ran to
completion — three behavioral slices landed in one day — plus the W7/W8
scope ruling, the measurement program's consolidation, the job.sh
detached-runner tool, and the SIGTERM boot-race fix.

## The engine work (one open golden window, three landings)

**Slice-3 @692ca7e — city roles + the v1 war pair.**
Deterministic city roles from geography + empire context (frontline /
production / science / spawner; slots scale with empire size), tiered
role build lists (barracks→factory→best plant; library→marketplace→
university→bank), the happiness ladder (temple→colosseum on persistent
disorder), spawner settler-cap headroom. PILLAGE-SIEGE (recalled-behavior,
v1x §5): besiegers holding at a city strip the siege ring instead of
idling. AIR DOCTRINE (v1x §4): bombers strike only besieged cities inside
the fuel leash of a base and fly straight home when aloft; fighters are
pure interception; AI nuclear units hold (v1.x). BEHAVIORAL + STAMP;
BEHAVIOR t100 HELD (effects fire midgame on).

**Slice-4 @d5007db — frontier defence.**
FRONTIER role: near a KNOWN rival city (fog-honest, frontierRadius 12)
but not yet threatened → proactive walls + science-list block.
garrisonNeed = ONE shared floor formula at all three slice-1d sites:
frontline always 2, garrisonAlways2 stances keep 2 on the frontier, the
INTERIOR relaxes to 1 (a surfaced contract change — ai.test re-authored
to the border-scoped contract). BEHAVIORAL from t100 + STAMP.

**Slice-5 @be01b87 — wonders appetite (closes W6).**
The §3a super-food specialist play: a one-city happiness wonder
(allContentInCity) hosts in the best SPAWNER city; everywhere-wonders
keep the high-shield drive city; the hoisted persist covers any host.
No new knobs → the first stamp-free W6 slice (002/maptype/ff-parity
HELD). Seed items 1+3 resolved measured-first.

Natural 545 / winner p2 held across ALL FOUR W6 re-records — no
macro-outcome shift the whole window.

## Coverage (probe-w6.js, 3 canonical seeds, direct count)

- Walls: border 273/364 (75.0%) vs interior 21/64 (32.8%) — §3
  "walls on the border" measurably dominant.
- Role buildings at scale: barracks 239, library 215, university 12,
  factory 3 across 428 cities (density: 130-150 cities/game).
- Air arms fire: 2 bombers alive at t400 (attrition implies more built).
- Wonders 33/3 games (pre-slice reference 25/3, +32%). Shakespeare 0/3
  at t400 — late tech; the fixture pins the mechanism, marathon-horizon
  runs will show it live.

## Gates

- Reviewer: slice-3 engine-diff PASS #2831 + pristine clean-clone GREEN
  #2832 (990/986/1 parallel flake, pair-proved); combined s3+s4 PASS
  #2836 (garrisonNeed 3-site alignment confirmed); combined W6 PASS
  #2839 (twin 1:1, stamp-free verified, no dropped guards).
  [CLONE] final pristine clean-clone at be01b87: ___
- Sim-runner: [SWEEP] 25-seed canonical floors at be01b87: M2 ___ /
  M3-pop ___ / M4 ___ ; peace witness: ___ ; invariants: ___
- Local at every landing: fixtures RED→GREEN, sim 7/7, twins 11/11,
  suites up to 176/176.

## Also in this span

- W7/W8 SCOPE RULING (user): program extends W6 → W7 map shapes → W8
  econ pair; nukes v1.x; GHCR at RC (+~1 week accepted).
- W7 pre-design PASSED (#2814-16) + specs/map-shapes-w7.md contract;
  discovery: the browser map-type picker is already data-driven
  (rules.mapTypes) — W7's browser client half is ~zero.
- specs/measurement-program.md (instruments consolidated, #28
  discriminator design promoted); slice-4/5 design seeds;
  specs/sound-design.md; xii5b commit-gap addendum; game-discovery.md.
- debugging/job.sh (setsid-detached runner; canary PASS on the
  sim-runner box; pre-approved there) + env-overridable sim tripwires
  (b9e01e3) — unblocked marathons + all long measurements.
- server SIGTERM boot-race fix merged (hardening lane, reviewer-gated).
- Measurements: natural distribution FINAL (24/25 endYear score
  victories, balanced winners, zero space); disasters-ON floor-safe;
  concept histogram at canonical scale (doctrine live, space commit-gap
  finding banked in xii5b).
- Process lesson recorded: density-era parallel load can false-red
  ENGINE tests — pair-prove by isolation on commit+parent (#2832);
  parallelism cap investigation queued to bugfixer.

## Breaking / compatibility

No protocol, save-format, or client changes. rules.json gained
cityRoles / airDoctrine / siegePillageRadius / buildDoctrine.
happinessLadder / cityRoles.frontierRadius (slices 3-4; slice-5 added
none). All knob-gated: absent knobs reproduce legacy behavior exactly
(reviewer-verified). Golden re-records: four honest BEHAVIORAL rounds
(two with stamp), each classified via the #28 discriminator.

## Consistency

[filled at tag time — declared merge-consistent or not, and the
supersession of marker-0108 as the merge candidate]

# marker-0109 — W6 COMPLETE: slices 3+4+5 (city roles, war pair, frontier defence, wonder host)

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
  Final pristine clean-clone at be01b87 (#2842): CODE GREEN —
  marker-gate.sh --full 1001 tests / 997 pass / 1 fail / 3 skipped; the
  lone RED is the recurring N3 parallel-load false-red (ai.test.js
  isolated 52/52 x2 on be01b87 — 2nd consecutive window, deterministic
  test, resource contention). Independent lune repro: GOLDEN cp100
  0x0aad4beb + cp400 0x97c3f1d2 == committed, natural 545/p2/0xf7d5a860
  (4th hold), BEHAVIOR moved => honest re-record, JS==Luau.
- Sim-runner (#2841, interim at be01b87): canonical-25 19/25 complete,
  AGGREGATE GREEN and baseline-comparable vs d5007db (cities median 27
  both, techs 42 v 47, elimination 17% v 16%, government mix stable);
  floors are a no-op on the 4-civ chaos profile at both SHAs. Invariants:
  seed19 t284 tripwire IDENTICAL at both SHAs (pre-existing, not W6);
  seeds 1 & 8 baseline tripwires GONE at be01b87 (trajectory shift).
  ONE NEW item — seed6 t363 "ironclad on land outside a city" —
  ROOT-CAUSED, see below. Remainder (6 seeds) + peace/combat witnesses
  were starved behind a duplicate job; re-queued (kill approved #2843).
- Local at every landing: fixtures RED→GREEN, sim 7/7, twins 11/11,
  suites up to 176/176.

## The one new sweep finding: seed 6 (root-caused, NOT W6)

The 25-seed sweep surfaced one failure mode that appears in no earlier
sweep log: seed 6, t363, "sea unit (ironclad) on land outside a city".
Root cause found here on the dev box and reproduced in a fixture that
does not depend on the seed at all:
`data/rules.json` `pollution.warmingTransforms` maps `ocean` → `swamp`,
so an A91b greenhouse event can turn an ocean square into land WITH A
SHIP STANDING ON IT. The mechanism predates W6 by the whole A91b
window; W6's denser, longer-lived worlds (more cities → more industry →
more pollution, and more ships) are what finally rolled the dice on an
occupied ocean tile. No W6 code is implicated.

Fix (own window, own gate — NOT part of this marker): after a warming
transform, a sea unit left on a non-sea square is lost with its cargo,
reusing `triremeLost` + `cargoLost` — the same shape as the open-sea
trireme loss (`naval.js`) and the vanishing coastal city (B27,
`cities.js`), so no new event type and no catalog/sound/turnlog work.
Fixture first: `test/pollution.test.js` "A91c warming: a ship caught by
ocean->swamp is lost with its cargo" — RED on the pre-fix engine (the
ironclad alive on swamp), GREEN after; JS + Luau twins in one window.
It lands after this tag, once its own reviewer diff and golden status
are settled.

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

**MERGE-CONSISTENT — the user may merge this.** It SUPERSEDES
marker-0108 as the merge candidate. Basis: the reviewer's pristine
clean-clone at be01b87 is green on everything W6 touches with the lone
RED characterized and isolation-proven, both engines reproduce every
committed pin, the re-records are honest by the #28 discriminator, and
the sweep's aggregates at be01b87 match the pre-slice baseline with the
floors safe.

Two open items, neither of which changes the verdict:
- The sweep's last 6 seeds and the peace/combat witnesses were starved
  behind a duplicate job on the measurement box and are re-queued. The
  19 completed seeds already agree with the baseline; if any remaining
  seed breaches a floor it will be reported as an amendment to this
  report, not silently.
- The seed-6 warming/stranding edge (above) is pre-existing, not a W6
  regression, and its fix lands in the next window with its own gate.

# v1.0 RC evidence digest — DRAFT SKELETON (pre-filled 2026-07-25)

The axis-by-axis digest specs/v1-release-checklist.md step 1 requires
at RC. Drafted during the away window at marker-0101 so the RC
declaration is fill-in-the-last-rows; every ✅ row below already
carries its evidence pointer. Rows marked ⏳ name exactly what
remains.

## The six axes

**1. Every Civ 1 system faithful — ⏳ (river resolution + one companion)**
Done through 0102: all unit/city/tech/government/happiness/combat/
naval/air/space/disaster/difficulty systems, wonders with real
effects (A7, dump-checked), Future Tech, era defaults, the full
smalls list, **A8 tile contention (@376ff03, #2508: scenario 063 +
tile-contention.test.js, sweep GREEN #2540)** and **coastal-build
(@95261a1, #2518: scenario 064 + coastal-build.test.js)**. Evidence:
reports/marker-0069…0102, the 64-scenario cross-language suite, sim
goldens. REMAINING: RIVER — landed post-0102 @8da9029, PENDING
mid-investigation (M3-pop floor, ruling #2553) · workturns/transforms
companion (fact-check #2465 banked).

**2. Diplomacy full D1–D6 — ⏳ (the spine tail)**
D1–D3 shipped + merged (0064); claimSeat + the treaty-UI shell +
witness-8 BEFORE-half pre-position D4. REMAINING: D3-surfacing +
11b city names · D4–D6 (spec ready; witness-8 AFTER + treaty rename
ride D4).

**3. AI at M-targets — ✅ CLOSED for v1 (bar REOPENED for v1.x)**
Floors ratcheted green (M2 8 · M3 34 · M4 61.5 vs floors 6/28/50);
archetype wonders judge-ACCEPTED (non-builder wonders 0→20); gov arc
(bloat 77.5→36); disorder playbook (−26%); the space fork USER-RULED
accept (contested ending; witness-7 + bulb-tune evidence). Evidence:
#2414 sweeps, reports/marker-0090/0094/0095, banked baselines.
v1.x NOTE: the user REOPENED the bar via the XX §3 city-role build
doctrine (@c6eb2bd; baseline @4530416: AI builds ~0 buildings all
eras, 0% happiness coverage) — a directed raise, not a v1 blocker.

**4. Roblox Tier 3 multiplayer — ⏳ (batch done; the publish session)**
Tier-3 CERTIFIED (29 gates; NOTE the cert artifact tier3-cert.md is
untracked on the gaming PC — cite commit evidence @bb9ea36/@07b3ea9
or mark it commit-pending) · R6 · instant age-starts ACTIVE ·
runI–runL batches landed Studio-verified (@bb9ea36) + Refinement XIX
closed 8/8 (@07b3ea9) · intro COMMITTED (staged scene @1e3e549 +
boot animation @d32f99a; v3/v4 naming + user round-2 tweaks
post-0102). REMAINING: midgame-join (#2543, in build) + the ONE
publish/acceptance Studio session (sound + saving + batch + intro,
user-gated) — ruled a v1.x point release, NOT a v1.0 gate.

**5. Public hosting + master index — ✅ CLOSED + LIVE**
Box live with TLS + hardened posture; master index public
(servers.multiciv.kjell.today) with announce/probe; late-join/pause/
eviction feature-complete; docs/16 §7 current (no RC-blocker).
Evidence: reports/marker-0086…0101, docs/16, how-to-host.

**6. Maps/sound/pedia/advisor/CI — ⏳ (one item)**
Advisor (15 triggers) · A58 pedia (0 gaps) · A49 flows 1–3 + flow-2
in the nightly · play lane at zero unexplained reds · sound synth
family + soundboard. **#34 Founder's Record COMPLETE inside 0102
(@68fac99, #2506: all four ending moments + Continue-gated
scaffold).** REMAINING: A49 flow-4 alone (the endscreen play-lane
spec — did NOT land with #34; no endgame spec in test-ui/ at 0102).

## RC preconditions (checklist §Preconditions)

- [ ] All six axes ✅ (above)
- [x] Latest marker MERGE-CONSISTENT with real gates (0102 @17b4fb8,
      reports/marker-0102.md "the user may merge this")
- [ ] Full clean-clone suite green BOTH PCs + lune twins at the RC
      marker (the reviewer's standing gate covers the gaming PC;
      dev-PC run at RC)
- [ ] One fresh 25-seed canonical soak banked at the RC marker
      (sim-runner, routine)

## At RC (the sequence, checklist §The release sequence)

GAME_VERSION → 1.0.0 in the RC window · this draft becomes
reports/v1-rc.md with the last rows flipped · README assembled around
the ally's three title-swappable blocks
(specs/ally-response-2026-07-24-naming-release.md) · then the user's
steps: main merge → v1.0.0 tag → redeploy from main → announce.

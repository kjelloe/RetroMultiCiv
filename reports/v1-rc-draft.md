# v1.0 RC evidence digest — DRAFT SKELETON (pre-filled 2026-07-25)

The axis-by-axis digest specs/v1-release-checklist.md step 1 requires
at RC. Drafted during the away window at marker-0101 so the RC
declaration is fill-in-the-last-rows; every ✅ row below already
carries its evidence pointer. Rows marked ⏳ name exactly what
remains.

## The six axes

**1. Every Civ 1 system faithful — ⏳ (4 engine windows out)**
Done through 0101: all unit/city/tech/government/happiness/combat/
naval/air/space/disaster/difficulty systems, wonders with real
effects (A7, dump-checked), Future Tech, era defaults, the full
smalls list. Evidence: reports/marker-0069…0101, the 63-scenario
cross-language suite, sim goldens. REMAINING: A8 tile contention
(threading, kit banked) · coastal-build · RIVER terrain
(specs/river-terrain.md) · workturns/transforms companion
(fact-check #2465 banked).

**2. Diplomacy full D1–D6 — ⏳ (the spine tail)**
D1–D3 shipped + merged (0064); claimSeat + the treaty-UI shell +
witness-8 BEFORE-half pre-position D4. REMAINING: D3-surfacing +
11b city names · D4–D6 (spec ready; witness-8 AFTER + treaty rename
ride D4).

**3. AI at M-targets — ✅ CLOSED**
Floors ratcheted green (M2 8 · M3 34 · M4 61.5 vs floors 6/28/50);
archetype wonders judge-ACCEPTED (non-builder wonders 0→20); gov arc
(bloat 77.5→36); disorder playbook (−26%); the space fork USER-RULED
accept (contested ending; witness-7 + bulb-tune evidence). Evidence:
#2414 sweeps, reports/marker-0090/0094/0095, banked baselines.

**4. Roblox Tier 3 multiplayer — ⏳ (batch done; the publish session)**
Tier-3 CERTIFIED (29 gates, tier3-cert.md) · R6 · instant age-starts
ACTIVE · runI/runJ/runK batches landed Studio-verified · intro
animation authored (Write-gated). REMAINING: the ONE
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
family + soundboard. REMAINING: #34 Founder's Record (fresh helper
session; A49 flow-4 bundled).

## RC preconditions (checklist §Preconditions)

- [ ] All six axes ✅ (above)
- [x] Latest marker MERGE-CONSISTENT with real gates (0101, the
      30-marker consistent line, clean-clone-gated declarations)
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

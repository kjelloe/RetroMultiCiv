# RetroMultiCiv — road to v1.0: remaining work, as a dependency tree

_LIVING DOCUMENT (user ruling 2026-07-20): kept current as markers land —
update the node statuses + "last updated" line with each marker report, and
re-verify against the engine (not the workitem files) when an axis flips to
done. Companion: `plan-version2.md` (the v2.0-or-later shelf).
Last updated: 2026-07-25 (night) — **marker-0107 TAGGED @8c50ceb =
MERGE-CONSISTENT** (supersedes 0106 as the merge candidate). **W4
We-Love-the-King-Day @b813bbc, BOTH GATES GREEN**: reviewer #2753
(clean-clone 959/956/0-fail; the behavioral signature t100-held +
200-400-moved reproduced under lune = anti-paste-back proof; the natural
winner-flip 365/p3 verified a DETERMINISTIC butterfly, byte-identical
JS==Luau) + sim-runner #2755 (25-seed sweep 25/25 clean, no invariant
regression). Civ1-faithful (user-ruled): celebrate flag at the wrap →
corruption 0 (all govs) + Rep/Dem +1 trade on trading tiles; no rapture.
Scenario 067 pin 0x56151fa5 JS==Luau. Riders: **W5 re-home relabel
@a5b5808** (comment-only, both twins) + **WLTKD client surface @8c50ceb**
(bugfixer: turnlog rows + celebrate banner + overview 🎉, fog-honest) +
roblox GATE-4 re-bake @87fd953. Engine program **5 of 6 windows done —
only W6 build-doctrine remains**. W6 baseline MEASURED (#2746):
improvement doctrine inert — 0 temples/656 cities, 0.61% any-building,
M3-pop 20<22 breach — slice-1 starts from empty. reports/marker-0107.md.
--- prior: **marker-0106 TAGGED @6cad106 =
MERGE-CONSISTENT** (supersedes 0105 as the merge candidate). Adds **W3
score happy-citizen term DONE @aa6197e** (scoreBreakdown +happy =
happyCitizens*scorePerHappy, spec §10; pollution deferred off-in-v1) +
golden-neutral roblox W3 re-bake @6cad106. STAMP-only (score not hashed,
AI doesn't read it → only endYear score-winner is a trajectory surface,
unchanged); reviewer GREEN #2741 (engine-diff + working-clone score/sim/
age + twins 11/11 under lune; pristine clean-clone + 400-turn Luau
deferred per user, high-confidence parity). Engine program now **3 of 6
windows done** (W4 We-Love-the-King-Day next). reports/marker-0106.md.
--- prior: marker-0105 @b05a934 covered the
first two engine-program windows: **W1 diplomacy DONE @9dfc975**
(bugfixer — discovered-sabotage + investigateCity, reviewer-gated #2724)
and **W2 building effects DONE @a7f9da7** (architect — Mfg. Plant +100%/
obsoletes-Factory + SDI nuke-intercept, reviewer-gated #2736 @df90536f).
Both STAMP-only: the reviewer EMPIRICALLY verified stamp-only via
independent lune repro (BEHAVIOR_SOAK/NATURAL byte-identical to D5/W1;
the AI-buildable Mfg. Plant risk checked + cleared), clean-clone --full
954/951/0-fail. Two golden-neutral batches ride on top: **roblox W2 data
re-bake @fcfc574** (sim-runner) + **mobile-session-3 client @b05a934**
(helper, interaction cluster + #11 + #15). New cross-language scenario
066-sdi-intercept (0x7d67d913 JS==Luau). Report: `reports/marker-0105.md`.
Remaining v1 ENGINE program (`specs/engine-program-v1.md`): **W3 score
term · W4 We-Love-the-King-Day · W5 re-home relabel · W6 build-doctrine**
(PROMOTED, 5 slices, architect, LAST — clears the M3-pop advisory).
Golden windows serialize to the architect (one lock; W3/W4/W6 all ripple
the shared createGame stamp — cannot parallelize in the shared dev-PC
tree). USER GATES: merge 0105, redeploy, roblox/** Write allowlist,
Studio session (closes axis 4), trademark. Prior context: marker-0104
@bbfa85c closed the D4–D6 diplomacy arc (axis 2); the ally accepted
0103 in full (specials + Founder's Record tone, final); the conquest
world-brighten renderer upgrade is banked as a non-blocking v1.x item.
Source of truth for the 1.0 definition: `docs/03-roadmap.md` § "The 1.0
definition" (user-ruled, maximal cut). Status legend: ✅ done · 🔨 in
flight right now · 📋 queued (owner known) · 🧩 designed, not started ·
🚪 user gate._

The single most important structural fact: **every engine/gamesim change
serializes through ONE golden window** (one lock-holder at a time, JS+Luau
twins re-recorded together). The left spine below is therefore a queue, not a
set of parallel tracks. Server, client-UI, and Roblox work run in parallel
because they are golden-neutral.

```mermaid
flowchart TD
  subgraph ENGINE["ENGINE golden lane (serialized — one window at a time)"]
    HIST["✅ markers 0069–0081: XII.5 core ·\ncalendar-545 · xiv-ai arc (§12/§13/§14) ·\n§40 pop-cost · §50 city-as-road · air-truth ·\nbarb sea raids · A91 nuclear family · disasters"]
    NAV2["✅ naval-truth (marker-0082):\nsub stealth · sight-2 · probabilistic\ntrireme · Lighthouse/Magellan +1"]
    DAB["✅ danger-based abandon (706b19d,\nboth gates green; 4th witness: commits\nsurvive, abandons concrete, floors hold)"]
    DIFF["✅ authentic difficulty (0083):\n7-level Civ1 ladder; M3 floor RESTORED 28\n(25-seed evidence #2181)"]
    B27["✅ B27 fixed (0083): disbandCity\nstranded docked ships (§40 interaction)"]
    APN["✅ space pipeline repairs (0084):\napollo-narrow · manhattan/no-nukes ·\nradius fix — witnesses 5+6 still 0-launch;\n🚪 RESEARCH-DEPTH fork with user"]
    ARCH["✅ archetype wonders (0090): stance-keyed\nappetite + ally 22-wonder map; judge ACCEPT\n(non-builder wonders 0->20, floors green)"]
    MAN["✅ manhattan-gate + no-nukes toggle\n(landed in the 0084 window; verified\nin engine/cities.js)"]
    NAVL["✅ naval arc COMPLETE (0085-0092):\npresence-1/2 judge PASS ~2x + invade-B +\nformal acceptance 25/25 archipelago seeds"]
    SMALL["✅ smalls CLOSED (0088-0097): A7 wonders ·\npyramids-gov · settler-refuse + rehome (0095) ·\ndisorder-lux playbook · §46 default-defender ·\nA6a future-tech (0097)"]
    XAB["✅ xiv-ai-behavior #30 (0091) + gov arc\n(0094, bloat halved) + workers>pop + COW\nmap-sharing (0096, ~38% perf byte-identical)"]
    CLM["✅ claimSeat command (0097):\nAI seat -> human via the stamped command\npath; fixture 061; unblocked late-join §3"]
    A8N["✅ A8 tile contention (0102, fork-b 376ff03):\nonce-per-turn resolution, AI evals keep the\npre-A8 model (ruling); perf 0.53×; sweep GREEN"]
    CST["✅ coastal-build (0102, 95261a1): sea units\nrequire a center-coastal city; cityIsCoastal\nshared helper; scenario 064"]
    RIV["✅ RIVER COMPLETE (0103 @fe39360): landed +\nfix-A + sweep clean; M3 floor re-pinned 22 by\nUSER RULING; ally ACCEPTED + edge-seam fix\nlanded same night (c1f0cea)"]
    D11["✅ 11b authentic city rosters (@5617bf9):\nall 14 civs -> dump-exact 16-name Civ1\nfounding order; honest behavioral+stamp\nre-record; twins 76/76"]
    D4S["✅ D4 diplomacy (@ceda2169e): tribute + tech\nexchange + human LAN treaty cmd + offer expiry;\ntreaty-UI parley->diplomacy rename; NOT TAGGED\n(overnight policy — batch-tags in the morning)"]
    D5S["✅ D5 reputation + senate (@fe023c0, 0104):\nreputation 0-4 band (recoverable, byte-identical\nwhen healed) · senate blocks Republic/Democracy\nwar-on-peace · UN/Great Wall peaceAcceptBonus;\nfixes the D4 event-catalog gap"]
    D6S["✅ D6 embassies + missions (@984f48c, 0104):\ndiplomat-missions.js + twin — embassy + steal-tech\n(roll) + sabotage (roll) + incite + bribe; filterView\nembassy intel view-only. GOLDEN-NEUTRAL. Scenario\n065 pin 0xea7216fc JS==Luau. ARC COMPLETE"]
    W1E["✅ W1 diplomacy (@9dfc975, 0105): discovered-\nsabotage (botch-amplified discovery + reputation) +\ninvestigateCity re-apply; 065 behavioral 0x8771d49a;\nSTAMP-only cascade; twins 11/11"]
    W2E["✅ W2 building effects (@a7f9da7, 0105): Mfg.\nPlant +100%/obsoletes-Factory + SDI nuke-intercept\n(rollRange<70); STAMP-only (reviewer lune-verified\nBEHAVIOR byte-identical); scenario 066 0x7d67d913"]
    W3E["✅ W3 score term (@aa6197e, 0106): scoreBreakdown\n+happy = happyCitizens*scorePerHappy (spec §10);\nSTAMP-only (reviewer GREEN #2741); pollution\ndeferred off-in-v1"]
    W4E["✅ W4 We-Love-the-King-Day (@b813bbc, 0107):\ncelebrate flag → corruption 0 + Rep/Dem +1 trade;\nBEHAVIORAL (natural 545→365 p3, deterministic\nbutterfly); both gates GREEN; + W5 relabel @a5b5808"]
    W6E["🧩 W6 build-doctrine (5 slices, LAST —\nclears M3-pop advisory)"]
    HIST --> NAV2 --> DAB --> DIFF --> B27 --> APN --> MAN --> NAVL
    NAVL --> ARCH --> SMALL --> XAB --> CLM --> A8N --> CST --> RIV --> D11 --> D4S --> D5S --> D6S
    D6S --> W1E --> W2E --> W3E --> W4E --> W6E
  end

  subgraph SERVER["SERVER lane (golden-neutral, parallel)"]
    A50R["✅ A50 COMPLETE (reviewer-verified #2225):\naudit-fixes f0e03b1; oom-slice2b 579ba2e +\nheartbeat b4b9dcd merged since 0083, gated #2165"]
    A51D["✅ A51 master index PUBLIC + LIVE\n(2026-07-23: cert expanded, servers. block\ninstalled, index answering — axis 5 CLOSED)"]
    LJS["✅ late-join+pause+eviction FEATURE-COMPLETE\n(user design 2026-07-24 -> merged @205bbfe\nsame day; --no-late-join documented)"]
    SEC2["✅ docs/16 §7 re-assessed (2026-07-24,\nnew-dep+1.0 trigger): NO RC-blocker;\ntakeover-cap residual -> v2 shelf"]
    VCT["✅ #19 view-contract test MERGED (012d04b)\n+ master-proxy + lobby-drop (reviewer green)"]
    JTG["✅ XVII §3 join-toggle merged @e00be57\n(host open/closed, AI-seat auto-fill,\nreconnect-reclaim verified)"]
    GOR["✅ gameover-reveal + reject-reasons (0102) +\nlobby-robustness + docs/16 §8 delta + the\nendscreen-winner view contract ALL MERGED (0103)\n— server lane queue EMPTY"]
    A50R --> A51D --> LJS --> SEC2 --> VCT --> JTG --> GOR
  end

  subgraph CLIENT["CLIENT/UI lane (golden-neutral)"]
    XIVD["✅ shipped: regency lifecycle · save/load\nbuttons · client-server redirect · endscreen\nfog-guard · bug-report · §24 tile-yield ·\n§27 tech-tree cards"]
    XIVQ["✅ the 30-item helper window CLOSED\n(XIV batches 2-5 + XV set + A58 + off-turn\nover-server + gov-picker; queue EMPTY)"]
    A58["✅ A58 pedia completion (2d4a8d1):\n0 catalog gaps + 3 concepts, reviewer\ncross-checked"]
    A49["✅ A49 ALL FIVE FLOWS specced (0103):\nflow-4 = test-ui/endscreen.spec.js, doubles\nas regression-guard 3"]
    LJC["✅ late-join client + reveal banner +\njoin-share QR + boot-fade + specials motifs\n+ d4-treaty-shell + play-lane sweep +\nrefinement-XVII (0101) + XIX 8/8 (0102)"]
    END["✅ #34 Founder's Record + founders-tone +\nsilhouettes + play-on-roblox + pedia-splash\n(Encyclopedia) ALL SHIPPED (0103); guards\nG1-G5 complete; helper queue: oasis-palm"]
    FG["✅ 'Find game' server browser\n(initGlobalTab: checksum-honest listing,\npick re-points the join flow)"]
    XIVD --> XIVQ --> A58 --> A49 --> END
    XIVQ --> FG
    FG --> LJC
  end

  subgraph ROBLOX["ROBLOX lane (second PC)"]
    T3["✅ Tier 3 CERTIFIED (re-audit PASS #2222:\n29 gates green, re-bake in-tree 06448dd;\nverdict artifact roblox/acceptance/tier3-cert.md)"]
    SNAP["✅ age-snapshot instant starts ACTIVE\n(matcher twin + loader + roster-shuffle\n8f0e982) · specials mirror 577086c"]
    STUD["✅ intro v1 USER-APPROVED frozen at v5b ·\nmidgame-join BUILT + landed 58f74e4 (claimSeat\nparity, toggle default on) · 🚪 Studio session:\nverify midgame-join + publish gate + set\nROBLOX_EXPERIENCE_URL after"]
    R6["✅ R6 agent-complete (slice-1 de8a977 +\nslices 2-3 in-tree; 30 gates green)"]
    STUD --> T3
    R6 --> T3
    SNAP --> STUD
  end

  subgraph AIQ["AI-QUALITY program (feeds the engine lane)"]
    MFL["✅ M-floors ratcheted green\n(M2≥6 · M3≥28 restored · M4≥50)"]
    W5["✅ FORK RULED (2026-07-24): ACCEPT for v1\n— space = authentically-contested ending;\nwitness-8 re-measure queued post-D4\n(sim-runner, durable)"]
    GOV["✅ gov arc (0094): beeline + democracy-\nif-safe + upgrade-in-city; bloat HALVED"]
    W5 --> MFL
    GOV --> MFL
  end

  A51D --> V1
  T3 --> V1
  W6E --> V1
  SMALL --> V1
  MFL --> V1
  A49 --> V1
  FG --> A51D
  APN -. "launch pipeline\nopens" .-> W5
  V1(("v1.0")):::goal

  classDef goal fill:#2f6f4f,color:#fff,stroke:#2f6f4f
  classDef done fill:#d9f2e0,color:#1c4a33,stroke:#7bc09a
  class HIST,NAV2,DAB,DIFF,B27,APN,ARCH,MAN,NAVL,SMALL,XAB,CLM,A8N,CST,RIV,D11,D4S,D5S,D6S,W1E,W2E,W3E done
  class A50R,A51D,LJS,SEC2,VCT,JTG,GOR done
  class XIVD,XIVQ,A58,A49,LJC,FG,END done
  class T3,SNAP,R6 done
  class MFL,W5,GOV done
```

## What "done" already covers (no v1 work left)

Naval systems + naval TRUTH rules, air movement + air-truth rules, goody
huts (A4), caravan wonder-help (A83) AND trade routes (A89), unit
obsolescence/upgrades (A63), building sell (A86), era-scaled barbarians
(A66) + barbarian SEA RAIDS with the sails telegraph, AI leaders (A59),
the full A91 nuclear family (pollution · warming · meltdown · detonation),
the 8 Civ1 disasters (authentic-ON + toggle), settler pop-cost (§40),
city-as-road (§50), space race content (A76) with the XII.5b project AI +
danger-based abandon, the 7-level authentic difficulty ladder (landing),
debug surface (A92), map types (A82a), sound, tech tree + glyphs,
diplomacy D1–D3, crash resilience + ws-timeout, /healthz + invite
throttle, public hosting on the test box with TLS + hardened posture, the
master-index CODE (announce protocol + probe + `badAddress` guard, tested).

## The six 1.0 axes, scored

| # | 1.0 axis (user ruling) | State | Remaining |
|---|---|---|---|
| 1 | Every Civ 1 system faithful | **RIVER COMPLETE (0103)** — all terrains in, floors re-baselined by ruling | workturns/transforms companion (banked) |
| 2 | Diplomacy FULL D1–D6 | **✅ COMPLETE** — D1–D3 ✅, 11b ✅, D4/D5/D6 all LANDED + TAGGED (marker-0104) | — (axis closed) |
| 3 | AI at M-targets | ✅ v1 targets met — bar REOPENED (XX §3); measurement DONE (buildings ~0: 5/87 civs built any; wonders ~0; tech cap ~30; 0 launches); M3-pop 20<22 advisory | **build-doctrine PROMOTED — full 5-slice window** (user ruled; W6 of the engine program); clears the M3 advisory on landing |
| 1b | Civ1 feature faithfulness (audit) | **✅ CLOSED (0107)** — W1 ✅ + W2 ✅ + W3 ✅ + W4 WLTKD ✅ (gates GREEN) + W5 relabel ✅ | — (axis closed) |
| 4 | Roblox Tier 3 multiplayer | CERTIFIED + intro v1 APPROVED (frozen v5b) + midgame-join landed | 🚪 the ONE Studio session (verify midgame-join + publish + URL const) |
| 5 | Public hosting + master index | ✅ COMPLETE + LIVE; lobby-robustness + docs/16 §8 merged | — (server lane queue empty) |
| 6 | Maps/sound/pedia/advisor/CI | advisor ✅, A58 ✅, Founder's Record + tone pass + silhouettes ALL ally-approved final, PEDIA_NAME=Encyclopedia ✅ | conquest renderer-brighten banked v1.x (non-blocking); guards G1–G5 + A49 5/5 all complete |

## Reading the tree — the three facts that matter

1. **The diplomacy arc is CLOSED; the engine lane is an ordered program,
   now 5 of 6 windows done — only W6 remains.** River, 11b, D4, D5, D6
   landed + tagged (marker-0104, axis 2 complete). The engine program
   (`specs/engine-program-v1.md`): **W1 ✅ + W2 ✅ (0105); W3 ✅ (0106);
   W4 WLTKD ✅ + W5 relabel ✅ (0107, both gates GREEN)**; remaining
   W6 build-doctrine (PROMOTED, 5 slices, architect).
   build-doctrine (W6)
   clears the M3-pop 20<22 advisory on landing. Golden windows SERIALIZE
   to the architect — W3/W4/W6 all ripple the shared createGame stamp, so
   they cannot parallelize in the one shared dev-PC tree (only the
   NON-golden portions — client halves, pedia/advisory text — can be
   offloaded to an idle lane).
2. **Lane consolidation, morning shape.** Helper stopped (clean park).
   Bugfixer REACTIVATED: runs mobile play-session-3 (11 items,
   golden-neutral client) then W1 diplomacy (user ruling: redirect to
   engine after mobile). Architect executes W2–W6. Gaming PC back:
   sim-runner (sweeps/measures + git operator), reviewer (gates PUSHED
   shas — commit+push before requesting review), roblox-helper (waiting
   on the user Studio session). Hardening parked (server lane empty).
3. **User gates remain:** merge marker-0106 (ready now, supersedes
   0105), the trademark search, the ONE Studio publish/acceptance
   session, and the standing roblox Write allowlist. The M3-pop floor
   policy is RULED (user 2026-07-25): leave the value at 22, de-ratchet
   to advisory (removed from the nightly --enforce-floors, @9e42842),
   tracked to the build-doctrine granary fix — re-ratchet when it lands.

_Not in v1 (user-ruled v2 shelf): dedicated mobile UI, Civ4-style culture,
novelty map shapes, checkpointed saves, Blender/glTF fidelity pass, the
Civ2-ruleset game option, cross-play bridge, negotiation layer, rename
program. The XIV mobile items above are UX fixes to the existing client,
not the v2 mobile UI._

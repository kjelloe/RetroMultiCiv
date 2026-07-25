# RetroMultiCiv — road to v1.0: remaining work, as a dependency tree

_LIVING DOCUMENT (user ruling 2026-07-20): kept current as markers land —
update the node statuses + "last updated" line with each marker report, and
re-verify against the engine (not the workitem files) when an axis flips to
done. Companion: `plan-version2.md` (the v2.0-or-later shelf).
Last updated: 2026-07-25 MORNING — **marker-0104 TAGGED @bbfa85c =
MERGE-CONSISTENT** (the D4–D6 diplomacy arc batch tag; supersedes 0103
as the merge candidate). Gaming PC is back: reviewer clean-clone --full
942/0 + engine-diff + independent twin repro GREEN, sim-runner Gate-B +
25/25-seed invariants GREEN, both cross-agree on every hash. The
overnight no-tag policy is DISCHARGED. One pre-existing river-world
floor breach documented (M3-pop 20<22, orthogonal to diplomacy, tracked
to the XX §3 build-doctrine window — see below). **LANE CONSOLIDATION
(user ruling): helper STOPPED** (its full stack shipped — 11b's
oasis-palm follow-up, guards, splash, all committed); **bugfixer runs
the FULL D4–D6 diplomacy arc as its true final item**, then stops
too. **The gaming PC (sim-runner/roblox-helper/reviewer) rests for
~7h starting now** — no independent gate or sweep available that
whole window. OVERNIGHT POLICY (user-confirmed): the architect keeps
committing every bugfixer slice by pathspec with full golden
discipline, but **tags NOTHING** until the gaming PC + reviewer
return — one batch tag in the morning. Novel judgment calls outside
the D4-D6 digest: decide, document, flag for morning confirm (same
bar as tonight's river floor call).
Since 0103 (@fe39360): **11b authentic city rosters LANDED**
(@5617bf9, full Civ1 founding-order replace, honest behavioral+stamp
re-record) — **D4 diplomacy LANDED** (@ceda2169e: tribute + tech
exchange + human LAN treaty command + offer expiry, engine+twin+AI+
client, honest re-record, twins 11/11; NOT TAGGED per the overnight
policy) — **D5 (reputation reshape + senate + UN wonder effect)
OPENING NOW**, D6 (embassies+missions) to follow as its own window.
Also tonight: the **ally accepted marker-0103 in full** (specials
silhouettes + Founder's Record tone doctrine both final, no further
iteration) with one river follow-up (pale tile-edge seams from a
lighting clamp, not geometry) fixed same night (@c1f0cea); the
conquest world-brighten renderer-level upgrade is banked as a
non-blocking v1.x item. **MORNING UPDATE:** the diplomacy arc CLOSED
+ TAGGED (marker-0104 @bbfa85c, merge-consistent). The remaining v1
ENGINE work is now an ordered program (`specs/engine-program-v1.md`),
grown by the Civ1 feature audit (`specs/civ1-feature-audit.md` — user
PROMOTED all 4 gaps): W1 diplomacy (investigateCity + discovered-
sabotage → bugfixer post-mobile) · W2 Mfg-Plant+SDI effects · W3
score happy-citizen term · W4 We-Love-the-King-Day · W5 re-home
relabel · W6 build-doctrine (PROMOTED full window, 5 slices,
architect). bugfixer also runs mobile play-session-3
(`specs/mobile-session-3.md`, 11 items) before W1. USER GATES: merge
0104, redeploy, roblox/** Write allowlist, Studio session, trademark.)
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
    HIST --> NAV2 --> DAB --> DIFF --> B27 --> APN --> MAN --> NAVL
    NAVL --> ARCH --> SMALL --> XAB --> CLM --> A8N --> CST --> RIV --> D11 --> D4S --> D5S --> D6S
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
  D6S --> V1
  SMALL --> V1
  MFL --> V1
  A49 --> V1
  FG --> A51D
  APN -. "launch pipeline\nopens" .-> W5
  V1(("v1.0")):::goal

  classDef goal fill:#2f6f4f,color:#fff,stroke:#2f6f4f
  classDef done fill:#d9f2e0,color:#1c4a33,stroke:#7bc09a
  class HIST,NAV2,DAB,DIFF,B27,APN,ARCH,MAN,NAVL,SMALL,XAB,CLM,A8N,CST,RIV,D11,D4S,D5S,D6S done
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
| 1b | Civ1 feature faithfulness (audit) | audit DONE — near-complete; 4 small gaps found + PROMOTED | **W2 Mfg-Plant+SDI · W3 score term · W4 We-Love-the-King-Day** (+ W5 re-home relabel); all v1 |
| 4 | Roblox Tier 3 multiplayer | CERTIFIED + intro v1 APPROVED (frozen v5b) + midgame-join landed | 🚪 the ONE Studio session (verify midgame-join + publish + URL const) |
| 5 | Public hosting + master index | ✅ COMPLETE + LIVE; lobby-robustness + docs/16 §8 merged | — (server lane queue empty) |
| 6 | Maps/sound/pedia/advisor/CI | advisor ✅, A58 ✅, Founder's Record + tone pass + silhouettes ALL ally-approved final, PEDIA_NAME=Encyclopedia ✅ | conquest renderer-brighten banked v1.x (non-blocking); guards G1–G5 + A49 5/5 all complete |

## Reading the tree — the three facts that matter

1. **The diplomacy arc is CLOSED; the engine lane is now an ordered
   program.** River, 11b, D4, D5, D6 all landed + tagged (marker-0104);
   axis 2 complete. Remaining v1 engine work = W1–W6
   (`specs/engine-program-v1.md`): W1 diplomacy (investigateCity +
   discovered-sabotage, → bugfixer post-mobile), W2 Mfg-Plant+SDI, W3
   score term, W4 We-Love-the-King-Day, W5 re-home relabel, W6
   build-doctrine (PROMOTED, 5 slices, architect). W2–W4 close the Civ1
   feature-audit gaps. build-doctrine (W6) clears the M3-pop 20<22
   advisory on landing. Golden windows serialize; W1 (065 scenario) and
   the architect's windows (sim goldens) run on different golden files.
2. **Lane consolidation, morning shape.** Helper stopped (clean park).
   Bugfixer REACTIVATED: runs mobile play-session-3 (11 items,
   golden-neutral client) then W1 diplomacy (user ruling: redirect to
   engine after mobile). Architect executes W2–W6. Gaming PC back:
   sim-runner (sweeps/measures + git operator), reviewer (gates PUSHED
   shas — commit+push before requesting review), roblox-helper (waiting
   on the user Studio session). Hardening parked (server lane empty).
3. **User gates remain:** merge marker-0104 (ready now, supersedes
   0103), the trademark search, the ONE Studio publish/acceptance
   session, and the standing roblox Write allowlist. The M3-pop floor
   policy is RULED (user 2026-07-25): leave the value at 22, de-ratchet
   to advisory (removed from the nightly --enforce-floors, @9e42842),
   tracked to the build-doctrine granary fix — re-ratchet when it lands.

_Not in v1 (user-ruled v2 shelf): dedicated mobile UI, Civ4-style culture,
novelty map shapes, checkpointed saves, Blender/glTF fidelity pass, the
Civ2-ruleset game option, cross-play bridge, negotiation layer, rename
program. The XIV mobile items above are UX fixes to the existing client,
not the v2 mobile UI._

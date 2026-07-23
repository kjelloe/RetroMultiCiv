# RetroMultiCiv — road to v1.0: remaining work, as a dependency tree

_LIVING DOCUMENT (user ruling 2026-07-20): kept current as markers land —
update the node statuses + "last updated" line with each marker report, and
re-verify against the engine (not the workitem files) when an axis flips to
done. Companion: `plan-version2.md` (the v2.0-or-later shelf).
Last updated: 2026-07-23 late night (marker-0091 TAGGED @03a8732 =
candidate, 23rd consecutive — #30 SUCCESS: unit tripwire GONE, hoards
bounded, freed upkeep -> research, and the archetype wonder bar
SELF-CLOSED 44%->64%. Also in 0091: the shared/version.js integrity
fix + tracked-imports guard (hardening catch — clean-clone server
boot was broken 5 markers, ~96 fails re-attributed) + XV fully closed
(server-save merge). THE ONE OPEN FORK (user): witness-7 = 0 launches
with everything else green — residual is RESEARCH DEPTH alone; accept
authentically-contested space vs bulb-tune; a 3-arm rulesOverrides
pre-measure runs on sim-runner so the ruling lands on data. Axis 5
CLOSED (index LIVE). Studded round-2 played (runI, full 2100AD game,
tiers 1-3 accepted; sound/saving = publish gate) -> 26-item batch
triaged + rulings delivered. Engine order: invade-B [WINDOW OPEN] ->
regent-stall HIGH bug #37 -> perf profile #15 [WIDENED: browser ff
3min-to-150AD @14civ + roblox industrial —
chunking + baker land client-side in parallel] -> gov-reeval -> XV-engine + smalls ->
D3-surfacing -> D4-D6.)
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
    NAVL["✅ naval A + presence-1 + presence-2\n(0085-0087, judge PASS ~2x) · 🔨 invade\nslice B WINDOW OPEN (ruled #2294; fact-check\nbanked; invadeRatioPct=300 stamp)"]
    SMALL["✅ A7 wonder effects (0088, 8-of-9\ndump-checked) + pyramids-gov (landed 13271d2)\n· 📋 remaining smalls: A6a future-tech · §45b\nrehome · §46 default-defender · A8 tile contention"]
    XAB["✅ xiv-ai-behavior #30 (0091, TWO iterations):\ntripwire GONE + hoards bounded + upkeep->research\n+ wonder bar self-closed 64%; witness-7 = 0\nlaunches -> the research-depth USER fork"]
    D3S["📋 D3 server-surfacing · 11b city names"]
    D46["📋 Diplomacy D4–D6 — SPEC READY\n(d456-diplomacy-impl.md; D6 carries diplomat\nmissions; parleyDemandPct data landed)"]
    HIST --> NAV2 --> DAB --> DIFF --> B27 --> APN --> MAN --> NAVL
    NAVL --> ARCH --> SMALL --> XAB --> D3S --> D46
  end

  subgraph SERVER["SERVER lane (golden-neutral, parallel)"]
    A50R["✅ A50 COMPLETE (reviewer-verified #2225):\naudit-fixes f0e03b1; oom-slice2b 579ba2e +\nheartbeat b4b9dcd merged since 0083, gated #2165"]
    SEC["✅ docs/16 re-assessed (§6, 2026-07-22:\nalias not new surface; safe-exposed)"]
    A51D["✅ A51 master index PUBLIC + LIVE\n(2026-07-23: cert expanded, servers. block\ninstalled, index answering — axis 5 CLOSED)"]
    A50R --> SEC --> A51D
  end

  subgraph CLIENT["CLIENT/UI lane (golden-neutral)"]
    XIVD["✅ shipped: regency lifecycle · save/load\nbuttons · client-server redirect · endscreen\nfog-guard · bug-report · §24 tile-yield ·\n§27 tech-tree cards"]
    XIVQ["✅ the 30-item helper window CLOSED\n(XIV batches 2-5 + XV set + A58 + off-turn\nover-server + gov-picker; queue EMPTY)"]
    A58["✅ A58 pedia completion (2d4a8d1):\n0 catalog gaps + 3 concepts, reviewer\ncross-checked"]
    A49["📋 A49 playwright five flows\n(scoped, FRESH helper session)"]
    END["📋 endgame moments (scoped,\nFRESH helper session)"]
    FG["✅ 'Find game' server browser\n(initGlobalTab: checksum-honest listing,\npick re-points the join flow)"]
    XIVD --> XIVQ --> A58 --> A49 --> END
    XIVQ --> FG
  end

  subgraph ROBLOX["ROBLOX lane (second PC)"]
    T3["✅ Tier 3 CERTIFIED (re-audit PASS #2222:\n29 gates green, re-bake in-tree 06448dd;\nverdict artifact roblox/acceptance/tier3-cert.md)"]
    STUD["🔨 Studded round-2 IN PROGRESS (2026-07-23):\nrunH/runI played; 26-item feedback batch\nTRIAGED (specs/roblox-runI-triage); first\ncrash fix landed live (11fd7d0)"]
    R6["✅ R6 agent-complete (slice-1 de8a977 +\nslices 2-3 in-tree; 30 gates green)"]
    STUD --> T3
    R6 --> T3
  end

  subgraph AIQ["AI-QUALITY program (feeds the engine lane)"]
    MFL["✅ M-floors ratcheted green\n(M2≥6 · M3≥28 restored · M4≥50)"]
    W5["🚪 witness-7 RAN: 0 launches, all else\ngreen — RESEARCH-DEPTH fork WITH USER\n(accept vs bulb-tune; 3-arm pre-measure\nrunning, rulesOverrides-only)"]
    GOV["📋 N1/N2 gov re-eval (queued #36;\nN2 may close inside #30)"]
    W5 --> MFL
    GOV --> MFL
  end

  A51D --> V1
  T3 --> V1
  D46 --> V1
  SMALL --> V1
  MFL --> V1
  A49 --> V1
  FG --> A51D
  APN -. "launch pipeline\nopens" .-> W5
  V1(("v1.0")):::goal

  classDef goal fill:#2f6f4f,color:#fff,stroke:#2f6f4f
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
| 1 | Every Civ 1 system faithful | ~98% (A7 ✅, pyramids-gov ✅, §7 client ✅) | A6a future-tech, A8 tile contention, §45b rehome, §46 default-defender, §7 engine-half (#21) |
| 2 | Diplomacy FULL D1–D6 | D1–D3 ✅, parley data landed, UN effect spec'd into D5 | **D4–D6** (human LAN treaties, senate, reputation) — spec ready, the engine-queue tail |
| 3 | AI at M-targets | archetype ✅ (bar self-closed 64%), #30 ✅ SUCCESS | **the research-depth fork (user, data incoming)**, invade B (in build), regent-stall #37, gov re-eval, §11 disorder |
| 4 | Roblox Tier 3 multiplayer | CERTIFIED + R6 + SO18; round-2 IN PROGRESS | **runI 26-item batch** (roblox-helper, blockers first) + sound/saving (test-publish gate) |
| 5 | Public hosting + master index | ✅ COMPLETE + LIVE (box step done 07-23) | — (server self-lists on next redeploy) |
| 6 | Maps/sound/pedia/advisor/CI | advisor ✅, A58 ✅ (0 gaps, cross-checked) | A49 playwright lane (scoped, needs a FRESH helper session), endgame-moments (same) |

## Reading the tree — the three facts that matter

1. **The engine spine is the critical path**: invade-B (window OPEN) →
   regent-stall #37 (HIGH — the runI hang, likely shared) →
   pollution-perf #15 (promoted — the Roblox industrial-age suspect;
   both platforms gain) → gov-reeval → §7-engine + §11-disorder (user's
   lux playbook) → smalls (A6a/A8/rehome/default-defender) →
   D3-surfacing → D4–D6. The whole AI-quality program is otherwise
   DONE: floors green, archetype accepted, #30 succeeded.
2. **One design fork + two user gates remain:** the research-depth
   fork (accept vs bulb-tune — data incoming from the 3-arm
   pre-measure), the redeploy (0091 = the candidate; the server
   self-lists in Find game on it), and finishing the Roblox round-2
   loop (the 26-item batch is agent-side; sound/saving await your
   test-publish). Plus the fresh helper session for the last two
   axis-6 items.
3. **No open designs remain agent-side.** D4–D6 spec ready; the runI
   batch fully ruled (#2304); speed-up machinery live: baseline
   banking (halves every judge), rulesOverrides pre-measurement (forks
   arrive with data), and the age-snapshot baker (Roblox fast starts).

_Not in v1 (user-ruled v2 shelf): dedicated mobile UI, Civ4-style culture,
novelty map shapes, checkpointed saves, Blender/glTF fidelity pass, the
Civ2-ruleset game option, cross-play bridge, negotiation layer, rename
program. The XIV mobile items above are UX fixes to the existing client,
not the v2 mobile UI._

# RetroMultiCiv — road to v1.0: remaining work, as a dependency tree

_LIVING DOCUMENT (user ruling 2026-07-20): kept current as markers land —
update the node statuses + "last updated" line with each marker report, and
re-verify against the engine (not the workitem files) when an axis flips to
done. Companion: `plan-version2.md` (the v2.0-or-later shelf).
Last updated: 2026-07-23 night (marker-0090 TAGGED @8ff258d =
candidate, 22nd consecutive — ARCHETYPE SHIPPED: non-builder wonders
0->20, judge 3/4 ACCEPT ruled; the helper 30-item window closed (A58 +
XV set + off-turn-over-server); #30 defender-drain valve in build ->
its sweep -> WITNESS-7 = the launch acceptance. Prior 0088 — A7 COMPLETE: 8-of-9 wonder effects live
+ dump-fact-checked, doubly gated in 40min, the #28 discriminator's
first classification confirmed by both gate lanes. Axis-1 remaining =
pyramids-gov #35 (in build) + A6a/A8/rehome/default-defender. Prior
0087: sail-era ~2x overseas + war-hold 9/9 (launches await (c)/#30,
witness-7 armed) + discriminator. Tier-3 CERTIFIED + R6
agent-complete: Studded round-2 = the only roblox gate. All four
release forks RULED: space = measure-first · scope = maximal ·
§7 = Civ2-refuse · DNS = servers.multiciv.kjell.today (record in; one
box step remains, user). SPACE ARC mechanically closed (witnesses 1–6 +
dig + radius migration all verified); sole blocker = RESEARCH DEPTH —
the #27 measure landed its verdict — King 0/22 launches but
space-CAPABLE (seed-13 100% closure, war-abandoned t370); USER RULED
(b)+(c) staged: war-hold slice + the endemic-war batch, 7th witness =
King re-sweep after each. Archetype design CLOSED: the ally's 22-wonder
mapping is the build spec. Engine order: presence-2 [M4, in flight] →
war-hold #35 → behavior-hash → A7 stragglers → archetype →
xiv-ai-behavior → bugs/smalls → D3-surfacing → D4–D6.)
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
    NAVL["✅ naval A (0085) + presence-1 (0086) +\npresence-2 sail-era (0087, judge PASS ~2x) ·\n📋 invade slice B (queued, docs/15 fact-check\nbanked with reviewer)"]
    SMALL["✅ A7 wonder effects (0088, 8-of-9\ndump-checked) + pyramids-gov (landed 13271d2)\n· 📋 remaining smalls: A6a future-tech · §45b\nrehome · §46 default-defender · A8 tile contention"]
    XAB["🔨 xiv-ai-behavior #30 (IN BUILD):\nobsolete-DEFENDER drain valve (the real bloat,\ndiscriminator-caught) + hoard->buildings;\nsweep -> witness-7 = launch acceptance"]
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

  subgraph CLIENT["CLIENT/UI lane (helper queue 23, golden-neutral)"]
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
    W5["📋 launches>0 acceptance (7th witness):\nwar-hold SHIPPED (0087, 9/9 hold); re-fires\non #30 landing (the (c) half)"]
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
| 3 | AI at M-targets | archetype ✅ ACCEPT (0090), #30 ✅ landed | **witness-7 verdict (running — the launch acceptance)**, invade B, gov re-eval #36, XV §11 disorder playbook |
| 4 | Roblox Tier 3 multiplayer | CERTIFIED + R6 + SO18; round-2 IN PROGRESS | **runI 26-item batch** (roblox-helper, blockers first) + sound/saving (test-publish gate) |
| 5 | Public hosting + master index | ✅ COMPLETE + LIVE (box step done 07-23) | — (server self-lists on next redeploy) |
| 6 | Maps/sound/pedia/advisor/CI | advisor ✅, A58 ✅ (0 gaps, cross-checked) | A49 playwright lane (scoped, needs a FRESH helper session), endgame-moments (same) |

## Reading the tree — the three facts that matter

1. **The engine spine is the critical path and its order is fully ruled**:
   measure-first harness (#27, in build) → presence-2 → invade B → A7
   stragglers → archetype → smalls → xiv-ai-behavior → D3-surfacing →
   D4–D6. The space arc is mechanically CLOSED (six witnesses + dig +
   radius migration); the King-portfolio verdict is the acceptance
   measurement and runs in PARALLEL on the gaming PC — it does not block
   the spine.
2. **Only two hard user gates remain besides marker merges/redeploys:**
   the one-time box nginx/cert step (axis 5) and the Roblox Studio
   round-2 review (axis 4). Everything else is agent-executable in
   order, and every lane's queue is stocked to v1.
3. **No open designs remain.** The archetype spec closed with the
   ally's 22-wonder mapping; D4–D6 spec is ready
   (d456-diplomacy-impl.md); client/server/roblox lanes are fully
   specced and queue-fed.

_Not in v1 (user-ruled v2 shelf): dedicated mobile UI, Civ4-style culture,
novelty map shapes, checkpointed saves, Blender/glTF fidelity pass, the
Civ2-ruleset game option, cross-play bridge, negotiation layer, rename
program. The XIV mobile items above are UX fixes to the existing client,
not the v2 mobile UI._

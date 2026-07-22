# RetroMultiCiv — road to v1.0: remaining work, as a dependency tree

_LIVING DOCUMENT (user ruling 2026-07-20): kept current as markers land —
update the node statuses + "last updated" line with each marker report, and
re-verify against the engine (not the workitem files) when an axis flips to
done. Companion: `plan-version2.md` (the v2.0-or-later shelf).
Last updated: 2026-07-22 afternoon sync (marker-0086 TAGGED @f836d4e =
candidate, 18 consecutive consistent — presence-1 ARMS the overseas loop,
advisor speaks the ally copy, master index PUBLIC with the baked
Find-game default + server-browser panel verified end-to-end. All four
release forks RULED: space = measure-first · scope = maximal ·
§7 = Civ2-refuse · DNS = servers.multiciv.kjell.today (record in; one
box step remains, user). SPACE ARC mechanically closed (witnesses 1–6 +
dig + radius migration all verified); sole blocker = RESEARCH DEPTH —
the measure-first harness (#27) is in build, the 3-arm
King/prince/long-horizon portfolio armed on sim-runner. Archetype design
CLOSED: the ally's 22-wonder mapping is the build spec. Engine order:
measure-first harness → presence-2 [M4] → invade B → A7 stragglers →
archetype → smalls → xiv-ai-behavior → D3-surfacing → D4–D6.)
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
    ARCH["📋 archetype wonder slice — 'some civs\nMUST build wonders' (design CLOSED: ally's\n22-wonder mapping = the build spec; queued #26)"]
    MAN["✅ manhattan-gate + no-nukes toggle\n(landed in the 0084 window; verified\nin engine/cities.js)"]
    NAVL["✅ naval slice A (0085) + presence-1\n(0086): overseas loop ARMED, archipelago\nwitness in gate → 📋 presence-2 → invade B"]
    SMALL["📋 tail smalls: A6a future-tech ·\nA7 wonder stragglers (before ARCH — the\nappetite reads effects) · §45b rehome ·\n§46 default-defender · A8 tile contention"]
    XAB["📋 xiv-ai-behavior batch\n(unit bloat >1000 ×3 seeds · gold hoard —\nevidence filed)"]
    D3S["📋 D3 server-surfacing · 11b city names"]
    D46["📋 Diplomacy D4–D6 — SPEC READY\n(d456-diplomacy-impl.md; D6 carries diplomat\nmissions; parleyDemandPct data landed)"]
    HIST --> NAV2 --> DAB --> DIFF --> B27 --> APN --> MAN --> NAVL
    NAVL --> ARCH --> SMALL --> XAB --> D3S --> D46
  end

  subgraph SERVER["SERVER lane (golden-neutral, parallel)"]
    A50R["🔨 A50 remainder: a50-healthz MERGED\n(healthz + invite throttle + limits, 1812acf);\noom-slice2b + heartbeat = reviewer gate queued"]
    SEC["✅ docs/16 re-assessed (§6, 2026-07-22:\nalias not new surface; safe-exposed)"]
    A51D["🚪 A51 master index PUBLIC:\nDNS ✅ · baked client default ✅ ·\nserver-browser panel ✅ · remaining =\nthe one-time box nginx/cert step (user)"]
    A50R --> SEC --> A51D
  end

  subgraph CLIENT["CLIENT/UI lane (helper queue 23, golden-neutral)"]
    XIVD["✅ shipped: regency lifecycle · save/load\nbuttons · client-server redirect · endscreen\nfog-guard · bug-report · §24 tile-yield ·\n§27 tech-tree cards"]
    XIVQ["📋 queue 22: build-queue UX (parked scoped) →\nmobile §6+§7 → auto-takeover → order queue →\nbatch-4/5 → XV set → envelope stamp → proof line.\nBatch-2 CLOSED + §41/§42 + ally copy LIVE ✅"]
    A58["📋 A58 pedia completion (queued #32)"]
    A49["📋 A49 playwright five flows (queued #33)"]
    END["📋 endgame moments (ally 'Final Record'\npackage; queued #34)"]
    FG["✅ 'Find game' server browser\n(initGlobalTab: checksum-honest listing,\npick re-points the join flow)"]
    XIVD --> XIVQ --> A58 --> A49 --> END
    XIVQ --> FG
  end

  subgraph ROBLOX["ROBLOX lane (second PC)"]
    T3["🔨 Tier 3 NEARLY COMPLETE (#2028):\ncertification re-audit next; re-bake reflex\nlive (difficulty rules.luau re-bake pending)"]
    STUD["🚪 Studded round-2 (user Studio review)"]
    R6["🧩 R6 seats/lobby (spec ready:\nper-platform + bridge-compatible seatCode)"]
    STUD --> T3
    R6 --> T3
  end

  subgraph AIQ["AI-QUALITY program (feeds the engine lane)"]
    MFL["✅ M-floors ratcheted green\n(M2≥6 · M3≥28 restored · M4≥50)"]
    W5["🔨 launches>0 acceptance: measure-first\nRULED — harness #27 in build; 3-arm\nKing/prince/long-horizon portfolio armed"]
    GOV["🧩 N1/N2 gov re-eval + late-tech\nmodernization (post-naval-loop)"]
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
| 1 | Every Civ 1 system faithful | ~94% (manhattan-gate ✅, B27 ✅) | A6a future-tech repeats, A7 wonder stragglers, A8 tile contention, §45b rehome, §46 default-defender |
| 2 | Diplomacy FULL D1–D6 | D1–D3 ✅, parley data landed | **D4–D6** (human LAN treaties, senate, reputation) — spec ready, after the engine queue drains |
| 3 | AI at M-targets | floors green, overseas loop ARMED | **King-portfolio verdict (launches — the space acceptance)**, presence-2 + invade B, archetype wonder slice, xiv-ai-behavior (bloat/hoard), gov re-eval |
| 4 | Roblox Tier 3 multiplayer | Tiers 0–3 effectively ✅ | certification re-audit; difficulty rules re-bake commit; Studded round-2 on user review; R6 build |
| 5 | Public hosting + master index | DNS ✅, baked default ✅, browser ✅ | **user one-time box nginx/cert step**, oom-slice2b + heartbeat merges |
| 6 | Maps/sound/pedia/advisor/CI | advisor ✅ with ally copy | A58 pedia completion (+4 flagged gaps), A49 playwright lane (queued #33) |

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

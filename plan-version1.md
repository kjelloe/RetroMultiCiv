# RetroMultiCiv — road to v1.0: remaining work, as a dependency tree

_LIVING DOCUMENT (user ruling 2026-07-20): kept current as markers land —
update the node statuses + "last updated" line with each marker report, and
re-verify against the engine (not the workitem files) when an axis flips to
done. Companion: `plan-version2.md` (the v2.0-or-later shelf).
Last updated: 2026-07-22 mid-morning (marker-0085 = candidate, 17
consecutive consistent. 0084: apollo-narrow + manhattan-gate/no-nukes +
radius-mismatch fix + M3 floor 28-restored + XV triage. 0085: naval
slice A — the settle-overseas core, dormant + 2-continent
fixture-proven, golden-neutral both engines. SPACE ARC: witnesses 5+6
both 0-launch; every mechanical layer individually verified
(commit/abandon/wire/guards/instrument); sole blocker = RESEARCH DEPTH
vs game length — fork WITH USER (measure-first: force-enabled
difficulty-asymmetry sweep). Engine order: naval presence-1 [M1+M2+M3,
ruled #2201] → presence-2 [M4 sail-era] → invade slice B → archetype
wonder slice [spec DRAFTED specs/archetype-wonders.md] → smalls →
disorder playbook → D4–D6.)
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
    ARCH["🧩 archetype wonder slice — 'some civs\nMUST build wonders' (A40 vision; spec =\narchitect's ONE open design; A59 feeds it)"]
    MAN["📋 manhattan-gate + no-nukes toggle\n(A91 remainder)"]
    NAVL["✅ naval slice A (0085): settle core\ndormant+fixture-proven → 📋 presence-1\n(ruled #2201) → presence-2 → invade B"]
    SMALL["📋 tail smalls: A6a future-tech ·\nA7 wonder stragglers · §45b rehome ·\n§46 default-defender · A8 tile contention"]
    XAB["📋 xiv-ai-behavior batch\n(unit bloat >1000 ×3 seeds · gold hoard —\nevidence filed)"]
    D3S["📋 D3 server-surfacing · 11b city names"]
    D46["📋 Diplomacy D4–D6 — SPEC READY\n(d456-diplomacy-impl.md; D6 carries diplomat\nmissions; parleyDemandPct data landed)"]
    HIST --> NAV2 --> DAB --> DIFF --> B27 --> APN --> ARCH
    ARCH --> MAN --> NAVL --> SMALL --> XAB --> D3S --> D46
  end

  subgraph SERVER["SERVER lane (golden-neutral, parallel)"]
    A50R["🔨 A50 remainder: a50-healthz MERGED\n(healthz + invite throttle + limits, 1812acf);\noom-slice2b + heartbeat = reviewer gate queued"]
    SEC["🚪 docs/16 re-assessment (architect;\nhardening self-audit delta rows ready #2143)"]
    A51D["🚪 A51 master index DEPLOYED\n(user schedules DNS; code live on test box)"]
    A50R --> SEC --> A51D
  end

  subgraph CLIENT["CLIENT/UI lane (helper queue 23, golden-neutral)"]
    XIVD["✅ shipped: regency lifecycle · save/load\nbuttons · client-server redirect · endscreen\nfog-guard · bug-report · §24 tile-yield ·\n§27 tech-tree cards"]
    XIVQ["📋 queue: §22 pedia-links (⅓ of hover left) →\ndiscovery overlay → input pacing → mobile slice →\nauto-takeover → order queue → advisor cards →\nbatch-2/3/4/5 UI → envelope stamp → proof line"]
    A58["📋 A58 pedia completion (queued #32)"]
    A49["📋 A49 playwright five flows (queued #33)"]
    END["📋 endgame moments (ally 'Final Record'\npackage; queued #34)"]
    FG["📋 'Find game' server browser"]
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
    W5["🚪 7th witness = launches>0\n(runs after the user's research-depth\nruling; 5+6 both failed on depth)"]
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
| 1 | Every Civ 1 system faithful | ~92% | **B27 regression fix**, manhattan-gate + no-nukes toggle, A6a future-tech repeats, A7 wonder stragglers, A8 tile contention, §45b rehome, §46 default-defender |
| 2 | Diplomacy FULL D1–D6 | D1–D3 ✅, parley data landed | **D4–D6** (human LAN treaties, senate, reputation) — spec ready, after the engine queue drains |
| 3 | AI at M-targets | floors ratcheted green | **apollo-narrow + 5th witness (launches)**, archetype wonder slice, naval-loop acceptance, xiv-ai-behavior (bloat/hoard), gov re-eval |
| 4 | Roblox Tier 3 multiplayer | Tiers 0–3 effectively ✅ | certification re-audit; difficulty rules re-bake; Studded round-2 on user review; R6 build |
| 5 | Public hosting + master index | box ✅, code ✅, A50 nearly ✅ | oom-slice2b + heartbeat merges, docs/16 re-assess, **user DNS gate**, "Find game" browser |
| 6 | Maps/sound/pedia/advisor/CI | partial | advisor hint cards (queued), A58 pedia completion (queued), A49 playwright lane (queued) |

## Reading the tree — the three facts that matter

1. **The engine spine is the critical path and its order is fully ruled**
   (#2160/#2164): land difficulty → B27 → apollo-narrow → archetype →
   manhattan-gate → naval-loop → smalls → D4–D6. The space arc's research
   question is CLOSED (eligibility reached in 24/25 seeds at 545t); the
   wonder-building blocker has a ruled two-stage fix; the 5th witness is
   the arc's acceptance measurement.
2. **Only one hard user gate remains besides marker merges/redeploys:**
   scheduling DNS for the master index (axis 5). The bulb-tuning gate
   dissolved (calendar-545 + XII.5b path-research closed it). Everything
   else is agent-executable in order.
3. **The one open design is the archetype wonder spec** (architect,
   before its window; A59 personality work feeds it, ally input invited).
   Client/server/roblox lanes are fully specced and queue-fed.

_Not in v1 (user-ruled v2 shelf): dedicated mobile UI, Civ4-style culture,
novelty map shapes, checkpointed saves, Blender/glTF fidelity pass, the
Civ2-ruleset game option, cross-play bridge, negotiation layer, rename
program. The XIV mobile items above are UX fixes to the existing client,
not the v2 mobile UI._

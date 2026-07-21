# Welcome back — the 7-hour window, in one page (2026-07-21)

## TL;DR

Five markers tagged, all MERGE-CONSISTENT: **0069 → 0073** (0074/§12 may
land as you read). The whole XII.5 arc closed: from "the AI never builds
Apollo" to a complete, measured, contestable **space-project AI** (XII.5b,
ally-designed, marker-0073). Your redeploy picks up everything.

## Redeploy (your step 1)

```
git pull   # dev/main as you prefer — dev_night is at the latest marker
./ssh-deploy.sh
```
Merge candidate: **the latest marker I've declared consistent at your
return** (0073 now; check `git tag -l 'marker-007*'` / the last 20-min
report — 0074 may supersede). Then the standing three live-box checks:
(1) `--public-addr` = bare `multiciv.kjell.today:443` (a scheme now FAILS
AT BOOT), (2) 2 GB-tier sizing (heap 768 / `MemoryMax=1200M` /
`--max-games 3`), (3) a `?server=1` game writes `saves/`. Optional:
`--bug-reports /opt/retromulticiv/bugreports` enables in-client reports.
NOTE: players will now land in 545-turn games with the new AI economy +
space behavior — worth a fresh playtest announcement to your friends.

## What landed (markers 0069–0073)

- **0069** XII.5 core fix + re-record (goldens green again).
- **0070** calendar-545: normal games are ~545 turns to 2100.
- **0071** §13 deficit ladder: no more AI/regent sitting at 0 gold in
  disorder (tax → taxmen → government, disorder-free cap).
- **0072** §14 treasury (surplus rush-buy, units only) + your Studio-run
  riders (peace-offer spam cooldown, ZoC-retry drop) + the helper's
  11-item XIV wave (food-truth/Teotihuacan fix, civ-shuffle bias fix,
  mobile save/load, front-page with ally copy, terrain-flatten…).
- **0073** XII.5b space-project AI (6 parts + the ally's 9-metric
  witness; era-gate silent no-op found+fixed; solar-order bottleneck
  gone; parts-rush landed with Apollo/wonders still never rushed).
- In build at writing: **§12** settler inlet-pathing + escort (root
  cause: greedy step chooser; BFS fix + accompany-escort; fixture-first).

Gate deviations, honest: 0072 + 0073 used the documented **Gate-B
fallback** (reviewer clean-clone + author byte-exact self-witness) because
the sim-runner session was inert — real Gate-B re-runs are invited on both
tags when it wakes.

## The wake list (sessions to poke)

1. **sim-runner** (gaming PC) — inert ~5h. Owed: Gate-B re-runs on
   0072/0073 tags, the XII.5b 9-metric sweep (the accept/tune instrument),
   the roblox v3 manifest commit (20 files parked), floors diagnosis.
2. **hardening** — inert ~8h; A50-remainder queue item untaken.
3. **helper** — session ended at a context boundary ~4h ago after an
   11-item run; hover-info (#11) is scoped and ready for a fresh session.
   Queue 18.

## Your parked items (unchanged)

Studio review (Studded style + Tier-B relations panel + now 5 more roblox
slices in manifest v3) · `runG.txt` save for the regent-replay · the §29
terrain desaturation check (helper flagged its delivery as the first
ally-review candidate — screenshot pair in its scratchpad).

## Design state

Every remaining v1 item has a spec or fact-pack. New specs this window:
XII.5b (built), R6 roblox seats (your rulings), D4–D6 diplomacy impl
(ally presentation + fact-packs assembled; 3 tiny pre-open questions
left). Roblox lane is parity-complete (hold-at-ready) after its
audit-then-build run — Tiers 0–3 done pending your review. plan-version1
is current at every node; plan-version2 gained the Civ2-ruleset option,
cross-play bridge, and negotiation-layer seeds.

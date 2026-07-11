# RetroMultiCiv — Development Roadmap

Five phases, matching the agreed development path. Each phase ends with something
playable/verifiable, and none requires reworking the previous one — that's what
the engine-as-pure-reducer architecture buys (see `02-architecture.md`).

## Phase 1 — Local single-player browser prototype

Everything runs in one browser tab; the engine is bundled with the client.
No server beyond `npx serve` / `python -m http.server` for static files.

**Build order (each step playable):**

0. ✅ **Mock state + renderer** *(done 2026-07-10)* — static `client/mock-state.json`
   (24×16 map, 4 units, generated from ASCII art) rendered by the three.js
   flat-box renderer with raycast picking, pan/zoom, and HUD. Proves the state
   shape and the view layer.
1. 🔶 **Data + engine skeleton** *(mostly done 2026-07-10)* — ✅ `data/terrain.json`
   + `data/units.json` generated from the wiki extraction via `tools/mapdata.js`
   (11 terrains + river modifier, 28 units, wiki-verified stats); ✅ engine
   skeleton: `createEngine(ruleset)`, `applyCommand` dispatcher with deep-clone
   purity, `moveUnit` (8-dir, terrain costs, partial-move rule, domains, wrapX),
   `endTurn` (player cycling, move refresh), xorshift32 RNG with golden
   sequence; ✅ scenario 001 passes with hash `0xd0b04010`. ⬜ remaining:
   `createGame` map generation (step 2), techs/buildings/wonders data files.
2. ✅ **Map generation** *(done 2026-07-10)* — `engine/mapgen.js`: seeded
   drunkard's-walk continents, latitude-band terrain, rivers, specials
   (Civ 1-style grassland shield checkerboard), arctic poles, spaced starting
   positions with Settlers. Deterministic (scenario 002 hash `0x7285b0f1`);
   client generates + renders real worlds (`?seed=` URL param).
3. 🔶 **Units + movement** — ✅ engine movement + client wiring (select unit,
   click-to-move with engine validation, End Turn button/hotkey, auto-pass for
   AI-less players); ✅ fog of war (`engine/visibility.js`: persistent explored
   arrays, computed sight — units r1, cities r2 — and `filterView`, the exact
   per-player view the phase-3 server will send; client renders unknown/dimmed
   tiles). ⬜ remaining: GoTo.
4. 🔶 **Cities** *(core done 2026-07-10)* — ✅ `engine/cities.js`: foundCity
   (settlers consumed, min-1-tile spacing), auto-assigned worked tiles from the
   21-tile fat cross, food box growth/starvation, shield production of units,
   setProduction; client: B founds a city, click city + keys 1/2/3 pick
   production, HUD city panel. Locked by scenario 003 (hash `0xa1c78141`).
   ✅ city screen UI (panel with yields, growth/production ETAs, clickable
   5×5 worked-tile map with manual assignment via `setWorkers`, production
   catalog); ⬜ remaining: buy, specialists, happiness, tile contention
   between cities. *(buildings/wonders production and the trade/tax split
   landed with step 6's slices below.)*
5. 🔶 **Combat + barbarians** *(core done 2026-07-10)* — ✅ `engine/combat.js`:
   Civ 1 one-shot combat in pure integer math (strengths as products, roll in
   [0, att+def)), terrain/river/fortify/veteran multipliers, strongest-defender
   rule, open-ground stack death vs city single-loss, 50% veteran promotion,
   attack-by-moving, shore bombardment (sea→land) while land→sea is illegal;
   ✅ zone of control; ✅ city capture with pop loss + capped plunder;
   ✅ `engine/barbarians.js` (turn-gated spawns, hunt nearest civilization,
   attack/capture). Locked by scenarios 004 (attacker path, `0xdc1336db`) and
   005 (defender path, `0x11a6a9e2`). ⬜ remaining: goody huts, era-based
   barbarian units, City Walls ×3 / Fortress ×2 (need the buildings slice).
6. 🔶 **Tech tree + wonders + governments** — ✅ `data/techs.json` (all 68
   Civ 1 advances with prerequisites, generated from the wiki dump — count and
   the seven root techs verified); ✅ `engine/tech.js`: research from city
   trade split by tax/science rates (`setRates`, 10% steps), Civ 1 global cost
   escalation (base × techs known+1), overflow carry, prereq-validated
   `setResearch`; ✅ production tech-gating (no more 4000 BC battleships);
   ✅ client: research HUD + T to cycle available techs (scenario 006);
   ✅ **buildings & wonders** *(2026-07-10)*: `data/buildings.json` (21) +
   `data/wonders.json` (21) with wiki-verified techs/costs/obsolescence and
   structured effects (never wiki prose); building/wonder production with
   Civ 1 category-switch shield forfeit; effects live: Granary halving,
   Aqueduct pop-10 gate, Barracks veterans, City Walls ×3 in combat,
   Marketplace/Bank/Library/University +50%, maintenance (gold clamped ≥0),
   Colossus city trade, Great Wall empire walls with Gunpowder obsolescence;
   wonder race uniqueness (first completion wins, `wonderLost` event);
   client: C cycles available buildings/wonders. Locked by scenario 007
   (`0x1057c8bc`). ⬜ remaining: governments, luxuries/happiness, corruption,
   remaining building/wonder effects (Temple, Factory chain, Palace,
   Great Library, Darwin's Voyage…), Future Tech repeatability, building sale
   instead of gold clamp.
7. ✅ **AI opponents + victory/score** *(done 2026-07-10)* — `engine/ai.js`:
   the designer's v0 Expansionist (research lowest level, defend-then-expand
   cities, settle good land, march on known enemies, explore fog) issuing only
   legal commands through `applyCommand`, honoring its own fog, and fully
   deterministic (AI-vs-AI same seed ⇒ identical hash — tested).
   `engine/score.js`: conquest + end-year score victory, eliminations gated on
   the `alive` flag so crafted test states are exempt; `gameOver` blocks all
   further commands. Client: AI plays its turns on End Turn, victory/defeat
   banner with scores, `?civs=2..7`. Verified: a full 80×50 AI game reaches
   conquest (turn 33, 244 ms).
8. ✅ **Save/load** *(done 2026-07-10)* — S/L keys snapshot the whole state to
   localStorage (the state is plain JSON — that was the architecture's
   promise); round-trip hash equality tested. ⬜ later: command-log saves,
   file export.
9. ✅ **Decision-support UI** *(done 2026-07-11, client-only)* — from the
   ally's gameplay-loop review (`specs/gameplay-reference.md`): combat odds
   preview on enemy hover (word + % + multiplier breakdown), settler site
   rating with on-map footprint overlay, production catalog with per-item
   ETAs / plain-language effects / tech-locked items showing their
   prerequisite, research panel unlock + leads-to sublines, tax/science
   slider, unit stat card in the HUD, End Turn goes green when every unit
   has moved, and the combat log grew into a full **turn log** (growth,
   completions, research, famine, wonder news, first-contact sightings).
   ⬜ remaining from that review: terrain improvements
   (irrigate/mine/road — an engine chunk, see below).
10. ✅ **Terrain improvements** *(done 2026-07-11)* — `engine/improvements.js`:
   `startWork` command (settlers only, consumes the turn, moving/fortifying
   abandons the job) + per-turn-wrap progress; bonuses parsed from the wiki
   terrain table into `data/terrain.json` (irrigation +1 food on
   desert/grassland/hills/plains with an 8-neighbor water-source check;
   mine desert +1 / hills +3 / mountains +1 shields, replaces irrigation
   and vice versa; road +1 trade on desert/grassland/plains, none on
   rivers); road-to-road movement costs 1 (v1 stand-in for Civ 1's ⅓);
   build times in `rules.json` `workTurns` (road 3 / irrigate 5 / mine 10 —
   tuning values, the wiki has no turn counts). Client: I/M/R keys, tile
   tints, turn-log entries, working settlers skipped by N/auto-select and
   the End Turn readiness check. Locked by scenario 008 (`0xbaf61c43`).
   ⬜ remaining: AI use, terrain transforms (clear/drain/plant), railroads,
   Fortress, pillage.

**Phase 1 milestone reached: a complete, winnable game against AI in the browser.**

**Acceptance:** a complete game vs 2 AI civs, start to victory, in the browser;
engine test suite green; a replayed command log reproduces the same final state hash.

> Note: the designer's roadmap stands up a small `ws` echo/command server as
> early as its step 3. That's compatible with this plan — because the engine is
> host-agnostic, the Node socket wrapper can be built at any point without
> rework. It's scheduled here in phase 3 to keep phase 1 dependency-free, but
> pulling it earlier costs nothing if the ally wants to develop against it.

## Phase 2 — Local multiplayer / hotseat

- Player-slot setup screen (human/AI per slot).
- Turn hand-off screen between human players ("Player 2 — press to start").
- Per-player fog: the view shown is `visibility.filterView(state, activePlayerId)`
  — the exact function the server uses later, so this phase proves it.

**Acceptance:** 2 humans + 1 AI hotseat game with no information leaks between
players — and a playtest scored against the 10-question checklist at the end
of `specs/gameplay-reference.md` (the designer ally's loop test).

## Phase 3 — Backend-authoritative simulation

Move the engine out of the page into Node — still one human player, but the
browser is now a thin client.

- `server/`: `node:http` static hosting + `ws` WebSocket; session owns the state.
- Client stops calling `applyCommand` directly; sends commands over the socket,
  receives events + filtered views (protocol in `02-architecture.md` §6).
- Server-side validation of every command (playerId ownership, legality).
- Saves move to server disk (`saves/*.json`).

**Acceptance:** Phase 1 game fully playable through the socket; killing and
restarting the server resumes from the save; a tampering client (hand-crafted
illegal commands) is rejected without state corruption.

## Phase 4 — Networked multiplayer (LAN)

- Lobby: named sessions, join by code, slot claiming, ready-up.
- Turn-based play across machines: active-player highlighting, end-turn
  notifications, reconnect (rejoin slot, receive full view resync).
- Simultaneous-turns option can wait; strict sequential turns first.
- Optional: spectator slots (receive omniscient or delayed view).

**Acceptance:** you + ally on two machines over LAN complete a game with at
least one mid-game disconnect/reconnect.

## Phase 5 — Roblox Luau port

- `tools/json2lua.js` generates the ruleset ModuleScripts.
- Port `engine/*.js` → Luau ModuleScripts 1:1 (the §4 portability rules make
  this mechanical). Port order: rng → movement → combat → cities → tech →
  visibility → index.
- **Cross-verify:** replay recorded browser command logs through the Luau engine
  (Lune or Roblox Studio) and diff per-turn state hashes against Node output.
- `GameServer.lua` replicates `session.js` behavior over RemoteEvents.
- Roblox client: tile map as parts/terrain chunks, unit models, click-to-move;
  consumes the same view/event shapes.

**Acceptance:** identical state hashes for a full replayed game; a playable
Roblox session with the ported engine.

## Art & assets track (parallel — from `specs/plan-assets.md`)

Runs alongside the gameplay phases, entirely behind the renderer interface
(`client/renderer/`) — no engine impact, no phase depends on it. Staged per
the designer ally's plan:

- **A0 — AssetFactory seam** *(cheap, do before A1)*: extract unit/city mesh
  construction from `renderer/three/index.js` into an asset-factory module
  (also relieves that file's size ceiling). Same primitives, one place to
  swap implementations incrementally.
- **A1 — Procedural low-poly kit** *(good timing: with phase 2/3, makes
  hotseat playtests legible)*: `THREE.Group` assets from primitives — 3–4
  land-unit silhouettes + one ship, settlement clusters scaling with
  population (walls ring when City Walls built), ownership as banner/base
  ring rather than whole-mesh recolor, forest/resource props (instanced),
  improvement markers replacing the tile tints. The ally judges this
  "enough for a compelling local prototype."
- **A2 — Hand-authored `.glb` models** *(post-A1, browser-only)*: Blender →
  GLTFLoader for unit sets, city kits, wonders. **Porting note:** primitive
  Groups map near-1:1 to Roblox Parts (the phase-5 client gets a parallel
  factory), but `.glb` does NOT — Roblox needs its own MeshPart pipeline.
  Keep all model construction inside the factory so the platforms can
  diverge there and nowhere else.
- **A3 — Animation & polish** *(only after gameplay is solid)*: flag sway,
  unit movement bob, combat lunge, found-city construction effect — via the
  renderer's existing `playEvents(events)` hook, which is still a no-op.

## Phase 6+ — Deferred Civ 1 features (post-port or interleaved)

In rough priority order:

1. Diplomat & Caravan units (espionage, trade routes, wonder-building help)
2. Diplomacy: contact, peace/war, tribute, AI personalities per leader
3. Pollution & global warming; Recycling/Mass Transit become meaningful
4. Spaceship construction + space-race victory (Apollo Program gate)
5. Difficulty levels (Chieftain→Emperor modifiers)
6. On-map city radius display (select a city → its fat cross via the
   renderer footprint overlay); formal culture borders much later
   (gameplay-reference Priority 2 §9)
7. Simultaneous turns / timer option for multiplayer
8. Globe view / water shaders and other renderer luxuries (see the art
   track above for the staged asset plan that replaced the old
   "renderer pass" item here)

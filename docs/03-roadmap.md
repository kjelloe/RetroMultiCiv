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
   ⬜ remaining: buildings/wonders in production, buy, specialists, happiness,
   trade/tax split, tile contention between cities, proper city screen UI.
5. **Combat + barbarians** — Civ 1 one-shot combat, ZOC, veterans, city capture.
6. **Tech tree + wonders + governments** — full Civ 1 tech data, research UI,
   wonder effects, government switching, tax sliders, happiness/disorder.
7. **AI opponents + victory/score** — heuristic AI issuing engine commands,
   conquest and score victory, end screen. *(Milestone: a full winnable game.)*
8. **Save/load** — snapshot + command log to localStorage / file download.

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

**Acceptance:** 2 humans + 1 AI hotseat game with no information leaks between players.

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

## Phase 6+ — Deferred Civ 1 features (post-port or interleaved)

In rough priority order:

1. Diplomat & Caravan units (espionage, trade routes, wonder-building help)
2. Diplomacy: contact, peace/war, tribute, AI personalities per leader
3. Pollution & global warming; Recycling/Mass Transit become meaningful
4. Spaceship construction + space-race victory (Apollo Program gate)
5. Difficulty levels (Chieftain→Emperor modifiers)
6. Higher-fidelity renderer pass (unit models, water, globe view) behind the renderer interface
7. Simultaneous turns / timer option for multiplayer

# MultiCiv — Development Roadmap

Five phases, matching the agreed development path. Each phase ends with something
playable/verifiable, and none requires reworking the previous one — that's what
the engine-as-pure-reducer architecture buys (see `02-architecture.md`).

## Phase 1 — Local single-player browser prototype

Everything runs in one browser tab; the engine is bundled with the client.
No server beyond `npx serve` / `python -m http.server` for static files.

**Build order (each step playable):**

1. **Data + engine skeleton** — ruleset JSON files (terrain, units first),
   `createGame(seed, ruleset)`, state shape, xorshift RNG, headless tests.
2. **Map generation + 2D renderer** — generate 80×50 world, render tiles with
   pan/zoom, tile picking. *(Milestone: look at generated worlds.)*
3. **Units + movement** — spawn starting Settlers, select/move, terrain costs,
   fog of war. *(Milestone: explore the map.)*
4. **Cities** — found city, worked tiles, food box growth, production queue,
   basic buildings; city screen UI. *(Milestone: grow a civilization.)*
5. **Combat + barbarians** — Civ 1 one-shot combat, ZOC, veterans, city capture.
6. **Tech tree + wonders + governments** — full Civ 1 tech data, research UI,
   wonder effects, government switching, tax sliders, happiness/disorder.
7. **AI opponents + victory/score** — heuristic AI issuing engine commands,
   conquest and score victory, end screen. *(Milestone: a full winnable game.)*
8. **Save/load** — snapshot + command log to localStorage / file download.

**Acceptance:** a complete game vs 2 AI civs, start to victory, in the browser;
engine test suite green; a replayed command log reproduces the same final state hash.

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
6. three.js renderer implementation behind the renderer interface
7. Simultaneous turns / timer option for multiplayer

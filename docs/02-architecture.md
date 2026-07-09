# MultiCiv — Architecture & Tech Stack

Design goal: **one simulation engine, many hosts.** The same game-logic code must
run (1) in the browser for the single-player/hotseat prototype, (2) in Node.js as
an authoritative server, and (3) eventually rewritten mechanically into Roblox
Luau. Everything below serves that goal.

## 1. The core idea: engine as a pure state machine

The engine is a **pure, synchronous, deterministic reducer** over plain data:

```
newState, events = applyCommand(state, command)
```

- `state` — one plain-JSON-serializable object: the entire game (map, cities,
  units, players, RNG seed/cursor). No class instances, no functions, no cycles.
- `command` — a plain object describing a player intent:
  `{ type: "moveUnit", playerId, unitId, dir }`,
  `{ type: "setProduction", cityId, item }`, `{ type: "endTurn", playerId }`, …
- `events` — plain objects describing what happened (for the UI/animation/log):
  `{ type: "combatResolved", attackerId, defenderId, winner, roll }`, …
- Illegal commands are rejected with a reason; they never mutate state.

Why this shape wins every phase:

| Phase | How the reducer is hosted |
|---|---|
| 1. Single-player browser | Engine bundled into the page; commands applied locally |
| 2. Hotseat | Same, two players share the keyboard; fog filtered per active player |
| 3. Backend-authoritative | Engine moves into Node; browser sends commands, receives events + filtered state |
| 4. LAN multiplayer | Same server, WebSocket per player |
| 5. Roblox | Engine rewritten to Luau ModuleScripts on the Roblox server; RemoteEvents carry the same commands/events |

Determinism requirement: **same seed + same command log ⇒ identical state.**
This gives free save games (persist seed + command log or state snapshot),
replays, desync detection, and cross-language verification of the Lua port
(run the same command log through JS and Luau, diff the states).

## 2. Repository layout

```
multiciv/
├── docs/                  # these documents
├── data/                  # rulesets as JSON — the single source of truth
│   ├── terrain.json       #   loaded by JS at runtime,
│   ├── units.json         #   converted to Lua tables by script for Roblox
│   ├── techs.json
│   ├── buildings.json
│   ├── wonders.json
│   ├── governments.json
│   └── rules.json         # global tuning (food box, combat, score weights)
├── engine/                # ★ THE PORTABLE CORE — strict subset of JS (see §4)
│   ├── index.js           # applyCommand, createGame(seed, options)
│   ├── rng.js             # own PRNG (xorshift32) — identical impl in JS & Lua
│   ├── mapgen.js
│   ├── movement.js        # move costs, ZOC, pathfinding (GoTo)
│   ├── combat.js
│   ├── cities.js          # growth, production, happiness, corruption
│   ├── tech.js
│   ├── units.js
│   ├── visibility.js      # fog of war, per-player state filtering
│   ├── ai.js              # heuristic AI (emits commands only)
│   └── score.js
├── shared/                # protocol: command & event shapes, validation
│   └── protocol.js
├── client/
│   ├── index.html
│   ├── main.js            # game shell: input → commands, events → renderer
│   ├── renderer/          # ★ RENDERER INTERFACE — 2D now, three.js later
│   │   ├── renderer.js    #   interface: init, drawMap, drawUnits, pick(x,y)…
│   │   ├── canvas2d/      #   v1 implementation (plain canvas or PixiJS)
│   │   └── three/         #   phase-later implementation
│   └── ui/                # HUD, city screen, tech dialog (plain DOM)
├── server/                # Node adapter (phase 3+) — NOT ported to Lua
│   ├── index.js           # node:http static hosting + ws game sessions
│   ├── session.js         # lobby, player slots, command routing
│   └── persistence.js     # save/load (JSON files)
├── tools/
│   ├── json2lua.js        # data/*.json → Roblox ModuleScript tables
│   └── replay.js          # run a command log headless, print state hash
└── test/                  # node:test — engine tests run headless
```

The **engine never imports** from `client/`, `server/`, or any Node built-in.
It receives the ruleset data as an argument (`createGame(seed, ruleset)`), so the
same files run in browser, Node, and (after rewrite) Roblox.

## 3. Tech stack

Chosen for minimal dependencies (per your preferences) with options noted.

| Layer | Choice | Rationale / alternatives |
|---|---|---|
| Engine | Plain JavaScript, CommonJS-style modules via a tiny UMD wrapper (works in browser `<script>` and Node `require`) | No build step needed for phase 1–2. Alternative: ESM + Vite if you want imports and hot reload — fine, but adds tooling |
| Client renderer v1 | **Plain Canvas 2D** with a sprite-sheet tile atlas | Zero deps, fully sufficient for an 80×50 tile map with pan/zoom. Alternative: **PixiJS** (WebGL, smoother at high zoom, still one dep) |
| Client renderer later | **three.js** behind the same renderer interface | Extruded 3D tiles / globe view; also previews the Roblox 3D feel |
| Client UI | Plain DOM + CSS for HUD/dialogs | No framework; the game screen is the canvas, dialogs are simple |
| Server (phase 3+) | Node.js: `node:http` for static files + **`ws`** for WebSockets | `ws` is the single runtime dependency. Alternative: Fastify + @fastify/websocket if you later want REST endpoints |
| Persistence | JSON files on disk (`saves/*.json`) | It's a LAN game; no database. State snapshot + command log |
| Testing | `node:test` (built-in) | Engine is pure ⇒ trivially testable headless |
| Roblox (phase 5) | Luau ModuleScripts (server) + Roblox client scripts; Rojo optional for filesystem-based development | See §5 |

### Renderer interface (the 2D→3D swap point)

```js
// client/renderer/renderer.js — every renderer implements this
createRenderer(container, ruleset) => {
  setViewState(view)   // filtered per-player state: tiles, units, cities, fog
  playEvents(events)   // animate combat, movement, city growth…
  screenToTile(x, y)   // picking
  centerOn(tileX, tileY)
  setZoom(z)
  destroy()
}
```

`main.js` talks only to this interface and to the engine/protocol. Swapping
canvas2d → three.js touches nothing outside `client/renderer/`.

## 4. Lua-portability rules for `engine/` (enforced by convention + lint)

The engine is written in a strict subset of JavaScript chosen so the eventual
Luau rewrite is mechanical, file-by-file, function-by-function:

1. **Plain tables only.** No `class`, no prototypes, no `this`. Factory
   functions returning plain objects; behavior lives in module functions:
   `cities.growth(state, cityId)`, not `city.grow()`.
2. **No JS-only collections.** No `Map`/`Set`/`WeakMap`. Use plain objects
   keyed by string ids (`state.units["u42"]`) and arrays. (Lua tables do both.)
3. **Centralized array indexing.** JS is 0-based, Lua 1-based. Avoid raw index
   arithmetic; use helpers (`tileAt(map, x, y)`, `neighbors(x, y)`) that hide
   the indexing, and iterate with `for..of`-style loops that translate to
   `ipairs`. Never store meaningful data at index 0.
4. **No async/promises/exceptions for flow control in the engine.** Everything
   synchronous; errors are returned values (`{ ok: false, reason }`).
5. **Own PRNG.** `rng.js` implements xorshift32 with explicit state in the game
   state. Same algorithm re-implemented in Luau ⇒ identical rolls. Never
   `Math.random()`.
6. **Integer math for game logic.** Use `(x / y) | 0` style integer division via
   a helper `idiv(x, y)` (→ `math.floor(x/y)` in Lua). No float accumulation in
   yields, combat, or science.
7. **No regex, no string-heavy logic, no `JSON` inside the engine.**
   (De)serialization happens in the host layer.
8. **No closures capturing mutable engine state across calls.** All state flows
   through the `state` argument. (Closures per se are fine in Lua, but stateless
   modules are what make the reducer testable and the port diff-able.)
9. **`===`/truthiness care:** treat `0` and `""` explicitly (`x === undefined`
   checks), since Lua's truthiness differs (only `nil`/`false` are falsy).
10. **One module = one Luau ModuleScript.** Keep `require`s acyclic.

`tools/json2lua.js` converts `data/*.json` into Luau table ModuleScripts so the
ruleset stays single-sourced.

## 5. Roblox port shape (phase 5 target)

```
ReplicatedStorage/
├── Ruleset/            # generated from data/*.json
└── Protocol/           # command/event shapes, shared validation
ServerScriptService/
├── Engine/             # ModuleScripts — 1:1 port of engine/*.js
└── GameServer.lua      # session loop; receives commands via RemoteEvent,
                        # applies them, broadcasts events + filtered views
StarterPlayerScripts/
└── GameClient.lua      # input → RemoteEvent commands; renders world
```

- The Node `server/session.js` and Roblox `GameServer.lua` play the same role:
  authenticate command → tag with playerId → `applyCommand` → broadcast.
  Keeping `session.js` thin makes the Roblox equivalent thin too.
- The browser renderer does not port; the Roblox client renders tiles as
  parts/terrain and units as models — but consumes the **same view state and
  events**, which is why those shapes live in `shared/protocol.js`.
- Port verification: run a recorded browser game's command log through the Luau
  engine (in Roblox Studio or Lune) and compare state hashes per turn.

## 6. Networking protocol (phase 3–4)

WebSocket, JSON messages:

```
client → server:  { t: "join", name }            → { t: "joined", playerId, view }
                  { t: "cmd", cmd: {...} }        # a protocol command
server → client:  { t: "state", view }            # full filtered view (resync)
                  { t: "events", events: [...] }  # incremental
                  { t: "error", reason }
                  { t: "turn", activePlayerId }
```

- Server is fully authoritative; clients are untrusted input devices.
- Per-player **view filtering** (fog of war) happens server-side in
  `engine/visibility.js` — the client never receives hidden tiles/units.
  This same function runs on the Roblox server later.
- Resync strategy: events normally; full view on join/reconnect/desync.

## 7. Save format

```json
{
  "version": 1,
  "rulesetHash": "…",
  "seed": 123456789,
  "options": { "mapSize": [80, 50], "players": [...] },
  "state": { …snapshot… },
  "commandLog": [ …every accepted command… ]
}
```

Snapshot is what you load; the command log is for replay/debug/port-verification.

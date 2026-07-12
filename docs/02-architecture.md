# RetroMultiCiv — Architecture & Tech Stack

Design goal: **one simulation engine, many hosts.** The same game-logic code must
run (1) in the browser for the single-player/hotseat prototype, (2) in Node.js as
an authoritative server, and (3) eventually rewritten mechanically into Roblox
Luau. Everything below serves that goal.

The designer ally's review distilled it into one "correctness pipeline",
which every phase rides end-to-end:

```text
Commands
  → deterministic simulation
  → canonical state
  → state hash / replay verification
  → per-player fog-filtered view
  → browser or Roblox rendering
```

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
│   ├── wiki-extract/      # raw tables extracted from the wiki dump (generated)
│   ├── terrain.json       #   final rulesets: loaded by JS at runtime,
│   ├── units.json         #   converted to Lua tables by script for Roblox
│   ├── techs.json
│   ├── buildings.json
│   ├── wonders.json
│   ├── governments.json
│   ├── civs.json          # 14 civilizations: city lists + one specialty each
│   └── rules.json         # global tuning (food box, combat, score weights)
├── engine/                # ★ THE PORTABLE CORE — strict subset of JS (see §4)
│   ├── index.js           # applyCommand, createGame(seed, options)
│   ├── rng.js             # own PRNG (xorshift32) — identical impl in JS & Lua
│   ├── mapgen.js
│   ├── movement.js        # move costs, ZOC, pathfinding (GoTo)
│   ├── combat.js
│   ├── cities.js          # growth, production, worked tiles, buy
│   ├── improvements.js    # settler work: roads/rails, irrigation, mines,
│   │                      #   fortresses, terrain transforms, pillage
│   ├── happiness.js       # citizen mood, luxuries, specialists, disorder
│   ├── government.js      # revolutions, rate caps, corruption, capitals
│   ├── tech.js
│   ├── units.js
│   ├── visibility.js      # fog of war, per-player state filtering
│   ├── barbarians.js      # turn-gated spawns + hunt behavior (wrap processing)
│   ├── ai.js              # heuristic AI (emits commands only)
│   └── score.js
├── shared/                # protocol: command & event shapes, validation
│   ├── protocol.js
│   └── statehash.js       # canonical serialization + FNV-1a hash (Lua-portable)
├── client/
│   ├── index.html
│   ├── mock-state.json    # step-0 static world (schema-checked by tests)
│   ├── vendor/            # three.module.min.js (pinned r162, no build step)
│   ├── main.js            # bootstrap: fetch ruleset, create session, wire UI
│   ├── session.js         # ★ owns state; apply/endTurn/AI-drive — the seam a
│   │                      #   socket-backed session replaces in phase 3
│   ├── diagnostics.js     # WebGL capability probe (+ ?diag=1 panel)
│   ├── ui/                # hud, panels (research/city/stack), input,
│   │                      #   saves (F5/F9 + files), turn log, setup
│   │                      #   screen, hotseat hand-off, options/help — DOM
│   └── renderer/          # ★ RENDERER INTERFACE — implementations swappable
│       ├── renderer.js    #   interface: setViewState, picks, markers…
│       └── three/         #   v1: low-poly flat boxes + raycast picking
│           └── assets.js  #   AssetFactory: all unit/city mesh construction
├── server/                # Node adapter (phase 3+) — NOT ported to Lua
│   ├── index.js           # node:http static hosting + ws game sessions
│   ├── session.js         # lobby, player slots, command routing
│   └── persistence.js     # save/load (JSON files)
├── tools/
│   ├── json2lua.js        # data/*.json → Roblox ModuleScript tables
│   ├── wiki2data.js       # local wiki XML dump → data/wiki-extract/ (raw tables)
│   ├── mapdata.js         # wiki-extract → final rulesets (terrain/units/techs…)
│   └── replay.js          # run a command log headless, print state hash
└── test/                  # node:test — everything runs headless
    ├── scenarios/         # ★ JSON scenario files — shared contract, see §8
    ├── scenario-runner.js # engine-agnostic runner (gets a Luau twin in phase 5)
    └── browser.test.js    # e2e smoke: real client in headless Chromium
                           # (software WebGL; self-skips if browser absent)
```

The **engine never imports** from `client/`, `server/`, or any Node built-in.
It receives the ruleset data as an argument (`createGame(seed, ruleset)`), so the
same files run in browser, Node, and (after rewrite) Roblox.

## 3. Tech stack

Chosen for minimal dependencies (per your preferences) with options noted.

| Layer | Choice | Rationale / alternatives |
|---|---|---|
| Engine | Plain JavaScript, CommonJS-style modules via a tiny UMD wrapper (works in browser `<script>` and Node `require`) | No build step needed for phase 1–2. Alternative: ESM + Vite if you want imports and hot reload — fine, but adds tooling |
| Client renderer v1 | **three.js**, low-poly: tiles as flat colored boxes (color/height by terrain), units & cities as simple meshes, raycast picking, orbit-lite camera (pan/zoom/slight tilt) | One dependency, vendored locally (`client/vendor/three.module.min.js` + import map — no bundler, no build step). **Pinned to r162**: last release with WebGL1 fallback — required for browsers stuck on ANGLE Direct3D9 (see CLAUDE.md). Previews the Roblox look |
| Client renderer later | Higher-fidelity three.js pass (unit models, water, day/night, globe?) or a canvas-2D fallback | Same renderer interface; optional |
| Client UI | Plain DOM + CSS for HUD/dialogs | No framework; the game screen is the canvas, dialogs are simple |
| Server (phase 3+) | Node.js: `node:http` for static files + **`ws`** for WebSockets | `ws` is the single runtime dependency. Alternative: Fastify + @fastify/websocket if you later want REST endpoints |
| Persistence | JSON files on disk (`saves/*.json`) | It's a LAN game; no database. State snapshot + command log |
| Testing | `node:test` (built-in) | Engine is pure ⇒ trivially testable headless |
| Roblox (phase 5) | Luau ModuleScripts (server) + Roblox client scripts; Rojo optional for filesystem-based development | See §5 |

### Renderer interface (the 2D→3D swap point)

```js
// client/renderer/renderer.js — every renderer implements this
createRenderer(container) => {
  setViewState(view)     // filtered per-player state: tiles, units, cities, fog
  playEvents(events)     // animate combat, movement, city growth… (still a no-op)
  onPick(cb)             // cb({ tile: {x, y}, unitId?, cityId? }) on click
  onDblPick(cb)          // same pick shape, double-click
  onHover(cb)            // cb(pick | null) on pointer move
  setHoverColor(hex)     // tint the hover marker (red = attack preview)
  setSelection(sel)      // { unitId?, tile? } | null — highlight marker
  setFootprint(tiles)    // [{x, y}] overlay (settler site preview) | null
  centerOn(tileX, tileY)
  setZoom(dist)
  destroy()
}
```

`main.js` talks only to this interface and to the engine/protocol. Swapping
canvas2d → three.js touches nothing outside `client/renderer/`.

> **Decided (2026-07-09):** the v1 renderer is **three.js with low-poly flat
> boxes and raycast picking**, per designer input. A canvas-2D fallback remains
> possible behind this interface but is not planned. The renderer stays "dumb":
> it maps view state to meshes and emits tile/unit picks — no rules knowledge.

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
   `Math.random()`, and **not** `seedrandom` (JS) paired with `Random.new(seed)`
   (Roblox) — those are different algorithms and will NOT produce the same
   sequence, silently breaking cross-language replay verification. One
   hand-rolled algorithm, two 20-line implementations, identical output.
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

### JS ↔ Luau quick reference (adapted from designer input, with corrections)

| Feature | Node.js / JavaScript | Roblox / Luau |
|---|---|---|
| Logic modules | CommonJS `module.exports` | `ModuleScript` + `require` |
| Game "loop" | none — turn-based reducer, commands drive everything | same; `RunService.Heartbeat` only for client animation, never game logic |
| Data sync | `WebSocket.send(JSON)` | `RemoteEvent:FireClient(table)` |
| Visuals | canvas sprites / `THREE.Mesh` | `Instance.new("Part")` / models |
| Map grid | array of plain objects | array of tables (mind 1-based indexing — see rule 3) |
| Randomness | own xorshift32 in `rng.js` | same xorshift32 in Luau — **not** `Random.new` (different sequence, breaks replay verification) |
| Save/load | JSON snapshot + command log | `HttpService:JSONEncode` / DataStore |

## 6. Networking protocol (phase 3–4)

The full phase-3 design — message catalog, seat tokens, playerId
stamping, persistence/resume, testing plan, implementation slices — lives
in `06-phase3-server.md`; this section stays as the summary.

WebSocket, JSON messages:

```
client → server:  { t: "join", name }            → { t: "joined", playerId, view }
                  { t: "cmd", commandId, cmd: {...} }   # envelope: id + engine command
server → client:  { t: "state", view }            # full filtered view (resync)
                  { t: "events", events: [...] }  # incremental
                  { t: "rejected", commandId, code, message }  # structured, never silent
                  { t: "turn", activePlayerId }
```

- Server is fully authoritative; clients are untrusted input devices that
  never resolve rules. Rejections carry the engine's reason `code` plus the
  human `message` (the client's `REASON_TEXT` map).
- Per-player **view filtering** (fog of war) happens server-side in
  `engine/visibility.js` — the client never receives hidden tiles/units,
  rival city internals (rival cities project to name/owner/size/walls
  only), or other players' treasury/research/rates. The leak contract is
  pinned by `test/visibility.test.js`, and this same function runs on the
  Roblox server later.
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
Implemented today: localStorage snapshots (S/L) and JSON save files with a
`{ format: "retromulticiv-save", savedAt, turn, state }` envelope
(Shift+S download, Shift+L / drag-and-drop to load). Command logs come with
the backend phase. Save files are plain state — they load directly into
headless Node tooling and the scenario runner for debugging.

## 8. Scenario test layer (cross-language)

Mechanics tests live at the command/event boundary as **plain JSON scenario
files** (`test/scenarios/*.json`): an initial state (or seed), a script of
commands with per-step expectations (`ok`, dotted-path state assertions), and
optional final assertions including a **golden state hash**. Because scenarios
contain no code, the same files test every backend:

- **Now:** `test/scenario-runner.js` (Node) runs them against `engine/*.js`
  via `node --test`. Scenarios written before the engine exists skip, not fail
  — they are TDD targets and the executable spec of command semantics.
- **Phase 5:** a mechanical Luau port of the runner (~80 lines) runs the
  *identical* JSON files against the Luau engine in Lune/Studio. Passing both
  runners with equal hashes proves the port.

The hash comes from `shared/statehash.js`: canonical serialization (sorted
keys, integers only, printable ASCII, **no null/floats** — JSON null becomes
`nil` in Lua and vanishes) + FNV-1a 32-bit using an overflow-safe `mul32`.
Golden parity anchor: `hashState({ b: 2, a: [1, "x", true] }) === "0x30db1e29"`
— the Luau implementation must reproduce it exactly.

Writing a new mechanics test = adding one JSON file. No runner changes.
Set `"final": { "hash": null }` to have the runner print the hash for recording.

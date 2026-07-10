# RetroMultiCiv

Browser 4X game recreating Sid Meier's Civilization (1991), built so the
simulation engine ports mechanically to Roblox Luau. Read `docs/` before
structural changes: `01-game-spec.md` (rules), `02-architecture.md`
(engine-as-reducer, stack), `03-roadmap.md` (phases).

## Hard rules

- **`engine/` stays in the Lua-portable JS subset** — see `docs/02-architecture.md` §4.
  Highlights: no `class`/`this`, no `Map`/`Set`, no async/exceptions in engine
  code, integer math via `idiv()`, index math only through helpers
  (`tileAt`, `neighbors`), state flows through the `state` argument.
- **Determinism is sacred:** all randomness through `engine/rng.js` (xorshift32,
  state in game state). Never `Math.random()`, never `seedrandom`, and the Luau
  port must reimplement the same algorithm — not `Random.new`.
- `engine/` imports nothing from `client/`, `server/`, or Node built-ins.
- Ruleset numbers live in `data/*.json`, never hardcoded in engine logic.
- **Game state holds only integers, printable-ASCII strings, booleans, arrays,
  plain objects.** No null, no floats (JSON null becomes nil in Lua and
  vanishes; floats drift). `shared/statehash.js` enforces this.
- No build step: plain JS, vendored `three.module.js` via import map.
- Minimal dependencies: `ws` (server) and vendored three.js are the whitelist;
  ask before adding anything else.

## Data source

Stat tables come from a local wikiteam XML dump of the Civilization Fandom wiki
at `../wikiteam/civ_articles_only/` (not part of this repo; complete).
`tools/wiki2data.js` has extracted the 7 key Civ 1 pages into
`data/wiki-extract/` — treat that as the authority over spec tables; yields are
countable `[food]/[shield]/[trade]` tokens (`parseYields`). Final `data/*.json`
rulesets are mapped from the extraction and reviewed by hand.

## Testing & running

`node --test test/` — headless, no deps (the dump integration test self-skips
if the dump is absent). Preview the client with `cd client && python3 -m
http.server 8123`.

**Mechanics tests are JSON scenarios** in `test/scenarios/` (format documented
in `test/scenario-runner.js` and docs/02-architecture.md §8) — add a JSON file,
not runner code. They run against the Node engine now and the Luau engine
later, so keep them code-free. Scenarios skip until `engine/index.js` exists.
Replaying a command log must reproduce the same final state hash
(`shared/statehash.js`; cross-language golden: `{b:2,a:[1,"x",true]}` →
`0x30db1e29`).
The terrain list in `test/mock-state.test.js` and the renderer's TERRAIN map
must stay in sync with `docs/01-game-spec.md` §3.1 (later: with `data/terrain.json`).

## Workflow

User handles all git commits and pushes. Build → test → stop and report.

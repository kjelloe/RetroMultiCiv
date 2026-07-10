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
- **three.js is pinned to r162 — do NOT upgrade to r163+.** r163 removed WebGL1
  support, and the user's own browser is stuck on ANGLE Direct3D9 (WebGL1
  only). r162 auto-falls back to WebGL1. Verify any renderer change with the
  headless screenshot loop below, including once with `--disable-es3-gl-context`
  (emulates the WebGL1-only environment).
- Minimal dependencies: `ws` (server) and vendored three.js are the whitelist;
  ask before adding anything else.

## Data source

Stat tables come from a local wikiteam XML dump of the Civilization Fandom wiki
at `../wikiteam/civ_articles_only/` (not part of this repo; complete).
`tools/wiki2data.js` extracts the key Civ 1 pages into `data/wiki-extract/`
(gitignored, regenerable — treat as the authority over spec tables; yields are
countable `[food]/[shield]/[trade]` tokens via `parseYields`).
`tools/mapdata.js` maps the extraction to the final committed rulesets.

**License boundary:** `data/wiki-extract/` contains CC BY-SA prose and must
never be committed. Committed `data/*.json` may carry names and numbers
(facts) but **never wiki sentences** — building/wonder effects are encoded as
structured fields (e.g. `{ "defenseMultiplier": 3 }`) authored in the
`BUILDING_OVERLAY`/`WONDER_OVERLAY` tables inside `tools/mapdata.js`; add new
effects there and regenerate, don't hand-edit the generated JSON.

Cross-references use slug ids: `units.json` `tech` fields hold tech ids from
`techs.json`; watch wiki naming drift when mapping (e.g. "The Wheel" vs
"Wheel", "(advance)" disambiguation suffixes, mid-word hyphenation).

## File size & module policy

Split by SEAM, not by line count — but as soft ceilings: engine modules ≤ ~300
lines (each becomes a Luau ModuleScript 1:1; small files = reviewable port),
client/tools ≤ ~450. If a file needs a full rewrite because targeted edits got
risky, that IS the signal to split it. One module = one subsystem; keep
`require`s acyclic. Planned (post-playtest): split client/main.js into
main (bootstrap) / session (state owner — the phase-3 socket seam) /
diagnostics / ui/{hud,panels,input,saves}.

## Testing & running

`node --test test/` — headless, no deps (the dump integration test self-skips
if the dump is absent). Play: `python3 -m http.server 8123` from the **repo
root**, open `http://localhost:8123/client/` (`?seed=N` fixed world,
`?mock=1` static state). `engine/` and `shared/` are ESM (per-dir
`package.json` type markers) so they load in both browser and Node; CJS test
files use dynamic `import()` for them. `tools/` stays CJS.

**Visual verification without a GPU:** a Playwright-cached headless Chromium
exists at `~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`.
Screenshot the running game with:
`chrome-headless-shell --no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader --window-size=1280,800 --virtual-time-budget=10000 --screenshot=out.png "http://127.0.0.1:8123/client/?seed=12345"`
(SwiftShader flags are required — WebGL has no GPU here and fails without them.)

**Test layers** (all via `node --test test/`): unit tests (rng, statehash,
cities, combat/barbarians, tech, ai, score, visibility, mapgen, wiki2data —
engine tests share `test/ruleset.js`), JSON scenarios (below), and
`browser.test.js` — an e2e smoke that boots the real client in the cached
headless Chromium and asserts the HUD reaches "turn 1" with a canvas and no
surfaced error (self-skips when the browser is absent).

**Mechanics tests are JSON scenarios** in `test/scenarios/` (format documented
in `test/scenario-runner.js` and docs/02-architecture.md §8) — add a JSON file,
not runner code. They run against the Node engine now and the Luau engine
later, so keep them code-free. Scenarios skip until `engine/index.js` exists.
Replaying a command log must reproduce the same final state hash
(`shared/statehash.js`; cross-language golden: `{b:2,a:[1,"x",true]}` →
`0x30db1e29`).

**Crafted test states:** omit `player.alive` unless the test is about victory —
only `alive: true` players can be eliminated / end the game, so states without
the flag are exempt from game-end checks (this keeps scenario hashes stable).
Include `buildings: []` on cities, `wonders: {}`, `cityOrder`, and the
`nextUnitId`/`nextCityId` counters; players need `bulbs`/`taxRate`/`sciRate`
to avoid lazy-default writes changing hashes mid-scenario.
The terrain list in `test/mock-state.test.js` and the renderer's TERRAIN map
must stay in sync with `docs/01-game-spec.md` §3.1 (later: with `data/terrain.json`).

## Workflow

User handles all git commits and pushes. Build → test → stop and report.

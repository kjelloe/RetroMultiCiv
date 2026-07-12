# RetroMultiCiv

Browser 4X game recreating Sid Meier's Civilization (1991), built so the
simulation engine ports mechanically to Roblox Luau. Read `docs/` before
structural changes: `01-game-spec.md` (rules), `02-architecture.md`
(engine-as-reducer, stack), `03-roadmap.md` (phases),
`04-phase1-enrichments.md` (designs for unimplemented Civ 1 systems —
follow these when picking one up), `06-phase3-server.md` (the
authoritative-server design — protocol, seats, persistence, slices).

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
`require`s acyclic. The client is split as: main (bootstrap) / session
(state owner + AI-drive — the phase-3 socket seam) / diagnostics /
ui/{hud,panels,input,saves,turnlog,setup,handoff,options}. UI reads session.state
and calls session.apply()/endTurn(); session.onChange drives refresh.
`ctx.HUMAN` is the CURRENT VIEWPOINT (mutable — hotseat hands it between
players via ctx.setHuman); never cache it in a module-level const. Keyboard
handlers must ignore events from INPUT/TEXTAREA targets (dialogs).

## Testing & running

`node --test test/` — headless, no deps (the dump integration test self-skips
if the dump is absent). Play: `python3 -m http.server 8123` from the **repo
root**, open `http://localhost:8123/client/` (bare URL = setup screen;
`?seed=N` fixed world skips it, `?civs=2..7`, `?humans=N` hotseat, `?civ=romans`,
`?size=xsmall..huge`, `?difficulty=trainer..godemperor`, `?debug=1` per-command hashes,
`?mock=1` static state). `engine/` and `shared/` are ESM (per-dir
`package.json` type markers) so they load in both browser and Node; CJS test
files use dynamic `import()` for them. `tools/` stays CJS.

**Visual verification without a GPU:** use `debugging/screenshot.sh [out.png]
[url] [extra chrome flags]` — it wraps the Playwright-cached headless Chromium
with the required SwiftShader flags (WebGL has no GPU here and fails without
them). WebGL1 pass: append `--disable-es3-gl-context`. Useful URL params:
`?zoom=6` close-up, `?e2e=1&e2eclose=1` scripted city + panels closed.
`debugging/gallery.html` shows every unit silhouette, city tier, and tile
prop through the real renderer — screenshot it after any assets.js or
terrain.js change (terrain.js = the continuous faceted surface; explicit
per-face normals, NOT flatShading, which needs a WebGL1 extension).
**Playtest diagnostics:** Shift+D in the client downloads a replayable
recording (initial state + every human command + per-round state hashes;
`?debug=1` hashes after every command). `node tools/replay.js <file>`
re-runs it through the engine and pinpoints any hash divergence — the
first tool to reach for when a playtest report says "something looked
wrong". Loading a save restarts the recording from the load point.

**Test layers** (all via `node --test test/`): unit tests (rng, statehash,
cities, improvements, happiness, government, combat/barbarians, tech, ai,
score, visibility, mapgen, wiki2data — engine tests share `test/ruleset.js`),
JSON scenarios (below),
`simulation.test.js` — headless all-AI playthroughs via `test/sim-driver.js`
(fixed seed, 400 turns run twice with chaos-command injection, invariants
every turn, golden checkpoint
hashes at 100/200/300/400 = phase-5 Luau anchors; ~45 s; design + golden
re-record process in `docs/05-simulation-test.md`; failure artifacts in
`debugging/sim/` are drag-droppable saves + `tools/replay.js`-bisectable
diags; wide net: `node tools/soak.js --seeds 25` — parallel via `--jobs`,
telemetry via `--stats`, stress via `--difficulty godemperor`, victory
check via `--natural`; nightly CI runs the last two,
`.github/workflows/nightly-soak.yml`), and
`browser.test.js` — an e2e smoke that boots the real client in the cached
headless Chromium (`?e2e=1` founds a city and fills the panels) and asserts
the HUD reaches "turn 1", the panels carry real content, and no error
surfaced (self-skips when the browser is absent).

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
The renderer's TERRAIN table lives in `client/renderer/three/terrain.js`
(heights + palettes); `test/mock-state.test.js` asserts it covers every
`data/terrain.json` id plus `unknown` — a new terrain needs an entry there
or it silently renders as grassland.

## Workflow

User handles all git commits and pushes. Build → test → stop and report.

Work splits across `agent-workitems.md` (implementation/doc tasks for a
local coder-helper agent — each item is self-contained with its own
verification steps and golden-re-record instructions; the main coder
curates the list) and `human-workitems.md` (verification and decisions
only the user/humans can make). Claim items in-file, mark them done,
never reorder someone else's.

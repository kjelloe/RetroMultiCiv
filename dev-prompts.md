# RetroMultiCiv — Development Prompt Log

The actual prompts used to build this project with Claude Code (model: Fable 5),
kept verbatim — typos and all — for research and for devs curious about
AI-assisted game development. Outcomes are summarized after each prompt; the
full results live in the repo history and `docs/`.

From this file's creation onward, every submitted prompt is appended
automatically to the **Raw prompt feed** section at the bottom by a
`UserPromptSubmit` hook (see `.claude/settings.json`). Curate before sharing.

---

## Session 1 — spec, foundations, step 0 (2026-07-09 → 2026-07-10)

### Prompt 1 — project kickoff

> Good evening! Now for a fun game project: As an expert game coder and developer with knowledge of Sid Meier Civilization games, nodejs, javascript, pyhon, LUA for Roblox. Could you help me set up a spec for a standalone browser game with i.e three.js or similar Ui for world map, and a nodejs or python backend, and organize it in a fashion so that the backend later can be ported to a Roblox LUA structure.
>
> Firstly I need a game specification for a core Civilization game, primarily the simple mechanics from the first installment wikI: https://civilization.fandom.com/wiki/Sid_Meier%27s_Civilization
>
> and then look at the technical stack options for a game for a local doing ally,. Clarifications?

**Clarifications answered:** development path = single-player browser →
hotseat → backend-authoritative → networked multiplayer → Roblox Lua port;
Node.js backend; start 2D but design for a 3D renderer swap; scope = core loop
+ full Civ 1 tech tree + wonders.

**Result:** `docs/01-game-spec.md`, `docs/02-architecture.md`
(engine-as-pure-reducer + Lua-portability rules), `docs/03-roadmap.md`, README.

### Prompt 2 — mid-work offer

> I can help fetch web resources if troublesome.

**Result:** the Civilization Fandom wiki was Cloudflare-blocked for the agent;
this offer later became the local wikiteam dump approach.

### Prompt 3 — designer review

> Thanks! Please review input from a designer ally on his perspective on the project and see if there are any input to bring in or adjust to: [full "Project Founders" spec — see `reference-design.md`]

**Result:** adopted rivers-as-tile-flag, explicit 2-food/citizen, pillage, a
concrete v0 AI ruleset, step-0 "render a mock state first"; pushed back on
seedrandom↔Random.new (breaks cross-language determinism), tick-loop thinking,
and Civ 2-style per-tech costs.

### Prompt 4 — decisions locked

> Thanks! Let's do flat boxes + raycast picking and let's call it RetroMultiCiv since it is multiplayer and multiple implementations in the end. Let's do map size 80x50 Anything else?

**Result:** name, renderer approach, and map size locked; three.js vendored
(no build step).

### Prompt 5 — doc sync while the wiki dump downloads

> Thanks. 1. I'm downloading the whole wikipedia articles only in ../wikiteam/civ_articles_only/ download is still ongoing. Before going into implementation, whilst we are waiting for the articles, Any update needed in SPEC, documentation, readme, MD files, skills and memories with the latest change?

**Result:** docs repointed at the local dump; `tools/wiki2data.js` planned;
project `CLAUDE.md` created (portability + determinism hard rules).

### Prompt 6 — wiki extraction + roadmap step 0

> Thanks. I will leave the download running. And once it completes, please go head and write wiki2data . Then assess and go ahead and roadmap step 0

**Result:** `tools/wiki2data.js` (streaming XML → JSON tables, 7/7 pages,
yields as countable tokens); extraction confirmed the spec's terrain/unit
numbers; step 0 built — three.js flat-box renderer + mock world at
`client/`, preview via `python3 -m http.server 8123`.

### Prompt 7 — doc sync + self-tests

> Thanks. Any update needed in SPEC, documentation, readme, MD files, skills and memories with the latest change? Any self  tests to add?

**Result:** docs refreshed; tests added — mock-state schema invariants,
client ESM syntax guard, real-dump integration test (self-skipping),
`parseYields` unit tests.

### Prompt 8 — cross-language test layer

> Thanks! Please add one liner to reference-design.md yes. Then suggest next steps. Also can we have a test layer between the front and the backend, so it is easy to add and maintain headless tests first for the nodejs backend, later for the roblox LUA backend

**Result:** JSON scenario layer (`test/scenarios/` + engine-agnostic runner) —
the same code-free scenario files will verify the Node engine now and the Luau
engine in phase 5; `shared/statehash.js` canonical hash with cross-language
golden anchor `{b:2,a:[1,"x",true]}` → `0x30db1e29`; found and fixed the
signed-XOR and 32-bit-multiply-overflow portability traps along the way.

### Prompt 9 — this log

> Brilliant! Can you write the prompts I have given you and future promots to a local file ./dev-prompts.md for research and sharing purposes with dev community which are interested in our project.

**Result:** this file + a `UserPromptSubmit` hook auto-appending future
prompts below.

### Prompt 10 — mid-work follow-up

> THen once that is done, please go ahe dwith roadmap step 1.

**Result:** roadmap step 1 — real `data/terrain.json` + `data/units.json`
generated from the wiki extraction, `engine/rng.js` (xorshift32), and the
first engine slice (`moveUnit`, `endTurn`) driven by scenario 001.

### Prompts 11–15 — phase 1 build-out + the WebGL bug hunt (2026-07-10, verbatim in raw feed below)

- **"Please continue with phase 1"** → map generation (`engine/mapgen.js`:
  seeded continents, latitude bands, rivers, specials) + client wired to the
  engine (real worlds, click-to-move, End Turn); `engine/` + `shared/` became
  ESM; scenario 002 locks mapgen determinism by hash.
- **"Please continue with next chunk"** → fog of war (`engine/visibility.js`
  with the server-grade `filterView`) and cities (`engine/cities.js`: found,
  fat-cross yields, food box growth, unit production); scenario 003; suite 36.
- **"quick manual UI test … shows no map"** → real-user bug report. Debugged
  with a cached headless Chromium: three.js threw "Error creating WebGL
  context" uncaught, killing the page. Added HUD error surfacing; screenshot
  proved the game renders (first visual verification of the project!).
- **"Still error … NVIDIA GeForce MX550 Direct3D9Ex … Should we add a playwright test?"**
  → root cause: browser stuck on ANGLE D3D9Ex = WebGL1 only, while three r163+
  requires WebGL2. Added `test/browser.test.js` (headless e2e smoke: own static
  server + DOM assertions) and a WebGL capability probe. Fixed favicon 404.
- **"Got: Uncaught Error: WebGL2 unavailable (webgl1)"** → fixed on the game's
  side: three.js downgraded and **pinned to r162** (last WebGL1-capable
  release); WebGL1 accepted as fallback; verified by headless screenshot with
  WebGL2 disabled (`--disable-es3-gl-context`). Lesson recorded in CLAUDE.md.

**Research note:** the bug-hunt exchange is a nice case study — a user pasting
raw console output twice was enough for the agent to reproduce, root-cause,
regression-test, and work around a hardware-specific rendering failure.

---

## Raw prompt feed (auto-appended by hook)

**2026-07-10 11:30**

> Please continue with phase 1, any add or update tests as applicable on the way

**2026-07-10 11:43**

> Please continue with next chunk

**2026-07-10 12:20**

> Before continuing, quick manual UI test at localhost:8123 shows no map, only the hud text display . Source code is: 
> <!DOCTYPE html>
> <html lang="en">
> <head>
>   <meta charset="utf-8">
>   <meta name="viewport" content="width=device-width, initial-scale=1">
>   <title>RetroMultiCiv</title>
>   <link rel="stylesheet" href="style.css">
>   <script type="importmap">
>     { "imports": { "three": "./vendor/three.module.min.js" } }
>   </script>
> </head>
> <body>
>   <div id="app"></div>
>   <div id="hud">
>     <div id="hud-title">RetroMultiCiv</div>
>     <div id="hud-status">generating world…</div>
>     <div id="hud-tile"></div>
>     <div id="hud-selection">click one of your units to select it</div>
>     <div id="hud-help">drag: pan · wheel: zoom · click unit/city: select · click neighbor tile: move · B: found city · 1/2/3: set production · E/Enter: end turn</div>
>     <button id="end-turn">End Turn</button>
>   </div>
>   <script type="module" src="main.js"></script>
> </body>
> </html>
> 

**2026-07-10 12:52**

> Still error: three.module.min.js:6 THREE.WebGLRenderer: A WebGL context could not be created. Reason:  Could not create a WebGL context, VENDOR = 0x10de, DEVICE = 0x1f9f, GL_VENDOR = Google Inc. (NVIDIA), GL_RENDERER = ANGLE (NVIDIA, NVIDIA GeForce MX550 Direct3D9Ex vs_3_0 ps_3_0, nvldumdx.dll -32.0.15.9608), GL_VERSION = 32.0.15.9608, Sandboxed = yes, Optimus = no, AMD switchable = no, Reset notification strategy = 0x8252, ErrorMessage = BindToCurrentSequence failed: .
> Rt @ three.module.min.js:6
> three.module.min.js:6 THREE.WebGLRenderer: Error creating WebGL context.
> ec @ three.module.min.js:6
> three.module.min.js:6 Uncaught Error: Error creating WebGL context.
>     at new ec (three.module.min.js:6:439722)
>     at createRenderer (index.js:28:20)
>     at main.js:62:14
> :8123/favicon.ico:1  Failed to load resource: the server responded with a status of 404 (File not found) Should we add a playwright test?

**2026-07-10 12:57**

> Got: Uncaught Error: WebGL2 unavailable (webgl1)
>     at main.js:84:9

**2026-07-10 14:01**

> Thanks! Can you update use-case specs, MDs, tests, documentation, skills and memories as applicable

**2026-07-10 14:11**

> Thanks. I moved to using Firefox. Also webgl ally suggests adding a clearer error message for browiser i.e Add a browser diagnostics screen
> For a local game, add a small diagnostic function before loading the Three.js scene:
> 
> js
> Copy
> function getGraphicsDiagnostics() {
>   const canvas = document.createElement("canvas");
> 
>   const webgl2 = canvas.getContext("webgl2");
>   const webgl1 =
>     canvas.getContext("webgl") ||
>     canvas.getContext("experimental-webgl");
> 
>   const gl = webgl2 || webgl1;
> 
>   if (!gl) {
>     return {
>       webgl2: false,
>       webgl1: false,
>       renderer: null,
>       vendor: null
>     };
>   }
> 
>   const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
> 
>   return {
>     webgl2: Boolean(webgl2),
>     webgl1: Boolean(webgl1),
>     renderer: debugInfo
>       ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
>       : "Unavailable",
>     vendor: debugInfo
>       ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
>       : "Unavailable"
>   };
> }
> 
> console.table(getGraphicsDiagnostics());
> This tells you whether a context can be created before Three.js starts. If it prints both values as false, Three.js is not the failure point.

**2026-07-10 14:15**

> Firefox loaded without error, only a new webgl panel and two warnings: WEBGL_debug_renderer_info is deprecated in Firefox and will be removed. Please use RENDERER. main.js:73:21
> console.table() main.js:100:9
> (index)    Values
> webgl2    true
> webgl1    true
> renderer    ANGLE (Intel, Intel(R) HD Graphics Direct3D11 vs_5_0 ps_5_0), or similar
> vendor    Google Inc. (Intel)
> WebGL warning: drawElementsInstanced: Drawing to a destination rect smaller than the viewport rect. (This warning will only be given once)
> 

**2026-07-10 14:19**

> Thanks! I'm connecting github repo now, so which License should I pick and any updates needed to README ?

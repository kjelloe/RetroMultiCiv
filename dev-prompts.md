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

---

## Raw prompt feed (auto-appended by hook)

**2026-07-10 11:30**

> Please continue with phase 1, any add or update tests as applicable on the way

# RetroMultiCiv — Development Roadmap

## Division of labour (agreed 2026-07-12)

Three parties work in parallel: the **main coder** (Claude — design,
architecture, engine/AI frontiers, curation and review), a **coder helper**
agent (implementation + documentation tasks from `agent-workitems.md`,
each item self-contained), and the **humans** (verification, decisions,
git, and everything physical — `human-workitems.md`). Per phase:

- **Phase 1 close-out**: helper burns down items A4–A8 (goody huts, era
  barbarians, Future Tech/building sale, remaining wonders, tile
  contention); main coder takes AI quality (stagnant-civ recovery —
  military survival + exploration); humans judge "does it feel like
  Civ 1". Exit: docs/04 empty, 25-seed soak with median cities ≥ 4 and
  <10% stagnant civs.
- **Phase 2 close-out**: humans run the pending acceptance playtest
  (10 questions + 7 hotseat questions in specs/); main coder fixes
  findings. Phase 2.5 is done and continuously enforced by the sim
  goldens.
- **Phase 3**: main coder writes the protocol/session design first (§6 of
  docs/02 + this file's phase-3 contracts); then the helper implements in
  slices (ws plumbing, validation, persistence, client socket adapter,
  server e2e); humans verify restart-resume and latency.
- **Phase 4**: main coder designs lobby/join/reconnect-resync (per-slot
  human/AI assignment lands here, as deferred); helper implements; humans
  run the two-machine LAN + mid-game-disconnect acceptance.
- **Phase 5**: main coder does the Luau mapping/harness pass; helper
  mechanically ports engine modules 1:1 (≤300 lines each, by design) plus
  the statehash/scenario-runner/sim-driver twins; humans own Roblox
  Studio, publishing, and in-Roblox playtests. Verification is already
  built: scenario hashes, sim checkpoint goldens, replay conformance.
- **Ordering**: 3 → 4 strictly; 5 can start once phase 3 stabilizes the
  engine's shape (engine changes after the port starts cost double). The
  art track never gates a phase; the nightly workflow quietly gates
  everything — it is what keeps three parties honest in one codebase.

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
1. ✅ **Data + engine skeleton** *(done 2026-07-10)* — `data/terrain.json`
   + `data/units.json` generated from the wiki extraction via `tools/mapdata.js`
   (11 terrains + river modifier, 28 units, wiki-verified stats); engine
   skeleton: `createEngine(ruleset)`, `applyCommand` dispatcher with deep-clone
   purity, `moveUnit` (8-dir, terrain costs, partial-move rule, domains, wrapX),
   `endTurn` (player cycling, move refresh), xorshift32 RNG with golden
   sequence. *(Its one-time "remaining" items — map generation and the
   techs/buildings/wonders data — landed as steps 2 and 6.)*
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
   tiles); ✅ wait/skip (Space) and disband *(2026-07-11)*; ✅ GoTo
   *(2026-07-12 — client-side by design per `04-phase1-enrichments.md` §4:
   G + click sends a unit traveling over multiple turns, greedy steps that
   never auto-attack, cancelled by manual steering or a blocked route)*.
   **Step complete.**
4. 🔶 **Cities** *(core done 2026-07-10)* — ✅ `engine/cities.js`: foundCity
   (settlers consumed, min-1-tile spacing), auto-assigned worked tiles from the
   21-tile fat cross, food box growth/starvation, shield production of units,
   setProduction; client: B founds a city, click city + keys 1/2/3 pick
   production, HUD city panel. Locked by scenario 003 (hash `0xa1c78141`).
   ✅ city screen UI (panel with yields, growth/production ETAs, clickable
   5×5 worked-tile map with manual assignment via `setWorkers`, production
   catalog); ✅ buy *(2026-07-11 — flat 2 gold per missing shield, wonders 4;
   scenario 009)*; ✅ **happiness pack** *(2026-07-11 — `engine/happiness.js`:
   content/unhappy citizens, luxuries worst-first, specialists
   (entertainer/taxman/scientist via `setWorkers`), Temple chain with
   Mysticism/Oracle doubling, martial law, war unhappiness, civil disorder
   halting shields and taxes; scenario 010)*. ⬜ remaining: tile contention
   between cities (designed in `04-phase1-enrichments.md`).
   *(buildings/wonders production and the trade/tax split landed with
   step 6's slices below.)*
5. 🔶 **Combat + barbarians** *(core done 2026-07-10)* — ✅ `engine/combat.js`:
   Civ 1 one-shot combat in pure integer math (strengths as products, roll in
   [0, att+def)), terrain/river/fortify/veteran multipliers, strongest-defender
   rule, open-ground stack death vs city single-loss, 50% veteran promotion,
   attack-by-moving, shore bombardment (sea→land) while land→sea is illegal;
   ✅ zone of control; ✅ city capture with pop loss + capped plunder;
   ✅ `engine/barbarians.js` (turn-gated spawns, hunt nearest civilization,
   attack/capture). Locked by scenarios 004 (attacker path, `0xdc1336db`) and
   005 (defender path, `0x11a6a9e2`). *(City Walls ×3 landed with step 6's
   buildings slice; Fortress ×2 + no-stack-death landed with step 10's
   fortress slice, 2026-07-11.)* ⬜ remaining: goody huts, era-based
   barbarian units.
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
   (`0x1057c8bc`). ✅ **governments + corruption** *(2026-07-11 —
   `engine/government.js` + `data/governments.json`: despotism→democracy
   with rate caps, tile penalty/trade bonus, unit upkeep in shields
   (`unit.home`), corruption by capital distance (Palace moves the capital,
   Courthouse halves), revolutions with anarchy (Pyramids skip), luxuries as
   the third rate; Temple/Colosseum/Cathedral/Courthouse/Palace effects +
   happiness wonders live; scenario 010)*. ✅ Factory power chain *(2026-07-12 —
   Factory +50% shields, doubled by Power/Hydro/Nuclear Plant)*.
   ⬜ remaining: Great Library/Darwin's Voyage/Newton/Copernicus/Lighthouse/
   Magellan/Adam Smith effects, Future Tech repeatability, building sale
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
10. ✅ **Civilizations & specialties** *(done 2026-07-11)* — `data/civs.json`:
   the full Civ 1 roster of 14 civilizations, each with a historic city
   list and ONE specialty built on four generic, portable engine hooks —
   `startTech` (Babylonians/Egyptians), `startGold` (Aztecs),
   `cheapUnit`/`cheapBuilding` (Romans' legions, Mongol cavalry, Greek
   libraries…, applied in production, buy, and the catalog UI), and
   `veteranUnit` (Zulu impi militia, German musketeers, Russian riflemen).
   `player.civ` is optional — crafted states and old saves are untouched.
   The setup screen picks your civilization (specialty blurb shown;
   `?civ=romans`); opponents are seed-shuffled from the roster, so a URL
   still reproduces the exact game. *(Specialties are our one deliberate
   post-Civ 1 flavor addition — Civ 1 civs differed only in name.)*
11. ✅ **Terrain improvements** *(done 2026-07-11)* — `engine/improvements.js`:
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
   ✅ pillage *(2026-07-11 — field works fall before roads/rails; scenario
   009)*; ✅ terrain transforms, Fortress, railroads *(2026-07-11 — the
   irrigate/mine orders clear/drain/plant per the wiki table; Fortress ×2
   at Construction; railroads on roads at the Railroad tech: free rail
   movement, +50% shields)*. 🔶 AI use of improvements: first slice done
   *(2026-07-12 — siteless settlers pave a road where they stand; saturated
   cities build buildings/wonders — see `04-phase1-enrichments.md` §7)*;
   ⬜ remaining: AI irrigation + fat-cross paving.

**Phase 1 milestone reached: a complete, winnable game against AI in the browser.**
The remaining ⬜ enrichments above are specified in
[`04-phase1-enrichments.md`](04-phase1-enrichments.md) with a suggested
implementation order — they interleave with the phases below.

**Acceptance:** a complete game vs 2 AI civs, start to victory, in the browser;
engine test suite green; a replayed command log reproduces the same final state hash.

> Note: the designer's roadmap stands up a small `ws` echo/command server as
> early as its step 3. That's compatible with this plan — because the engine is
> host-agnostic, the Node socket wrapper can be built at any point without
> rework. It's scheduled here in phase 3 to keep phase 1 dependency-free, but
> pulling it earlier costs nothing if the ally wants to develop against it.

## Phase 2 — Local hotseat and player-view projections

> **ACCEPTED 2026-07-14** — user verdict against the ten gameplay-loop
> questions (all good) + the seven hotseat questions (6/7; question 4,
> diplomacy legibility, is phase-6 scope — no diplomacy exists yet).
> Verdict appendix in `specs/phase2-assessment.md`. With phase 4's
> same-week acceptance, every phase gate through 4 is passed.

- ✅ **Setup screen** *(2026-07-11; extended 2026-07-12)* — a bare
  `/client/` URL opens it: your civilization (with specialty blurb),
  civilizations (2–7), human players (first N seats), map size
  (XSmall→Huge), difficulty (Trainer→God-Emperor — adjusts the
  content-citizen threshold as a RULESET override, recorded in diagnostics
  so replays stay faithful), optional seed; starts by reloading with URL
  params so the bootstrap stays one path.
- ✅ **Turn hand-off** *(2026-07-11)* — `ui/handoff.js`: a fully opaque
  cover drops the moment a human's turn ends with another human next; the
  incoming player's view renders *underneath* it, so neither player ever
  sees the other's map. Click or any key to begin.
- ✅ **Per-player viewpoint** — `ctx.HUMAN` is now the mutable viewpoint;
  every UI module reads it live. The map is always
  `visibility.filterView(state, viewpoint)` — the exact function the
  phase-3 server sends, so hotseat proves the anti-leak seam. The turn log,
  first-contact tracking, city-name rosters, and victory banner are all
  per-viewpoint; the session already stopped AI-driving at any human.
  Locked by a hotseat browser e2e (hand-off screen up, cover opaque,
  HUD already showing the incoming player's view beneath it).

- ✅ **View projection hardening** *(2026-07-11, from
  `specs/plan-feedback.md`)* — `filterView` now EXCLUDES (not conceals)
  rival internals: enemy cities on explored ground are projected to their
  outside only (name/owner/size/walls — production, food box, workers, and
  mood never enter the view); the own-player projection carries everything
  the owner's UI needs (rates, government, bulbs) and rivals none of it.
  Tested independently of rendering (`test/visibility.test.js`). Loading a
  save now restores the correct seat behind the hand-off cover.
  *(Deliberate simplification kept: humans occupy the FIRST N seats rather
  than arbitrary slots — per-slot assignment can come with the lobby in
  phase 4.)*

**Acceptance (pending playtest):** 2 humans + 1 AI hotseat game with no
information leaks between players — a playtest scored against the
10-question checklist at the end of `specs/gameplay-reference.md` plus the
seven hotseat questions in `specs/plan-feedback.md`.

## Phase 2.5 — Determinism contract and replay interoperability

The ally's suggested explicit deliverable (rather than an implicit phase-5
property). Status: **all five pieces exist** — this section is where they
are pinned down:

- ✅ Canonical serializer + hash algorithm: `shared/statehash.js` (sorted
  keys, FNV-1a 32-bit, integers/printable-ASCII/booleans only; golden
  anchor `{b:2,a:[1,"x",true]}` → `0x30db1e29`).
- ✅ Engine-owned PRNG with state in the canonical state: `engine/rng.js`
  (xorshift32; golden sequence for seed 123456789 in its tests). The Luau
  port reimplements this algorithm — never `Random.new`.
- ✅ Versioned replay format: the diagnostics recording
  (`format: 'retromulticiv-diagnostics', version: 1` — initial state +
  human command log + per-round hashes; Shift+D in the client).
- ✅ Replay conformance tool: `node tools/replay.js <file>` re-runs a
  recording through the engine and verifies every hash (the same harness
  phase 5 points at the Luau engine).
- ✅ Player-view projection tests: `test/visibility.test.js` asserts what a
  rival's view may and may not contain, independent of rendering.

Cross-engine test vectors beyond the anchors above: the ten hash-locked
JSON scenarios in `test/scenarios/`, and the long-horizon complement — the
simulated-playthrough goldens (`test/simulation.test.js`: a fixed-seed
4-AI game whose 100/200/300/400-turn checkpoint hashes the Luau engine
must reproduce; design in `docs/05-simulation-test.md`, wide-net soak via
`node tools/soak.js`).

## Phase 3 — Node.js authoritative game server

Move the engine out of the page into Node — still one human player, but the
browser is now a thin client.

> 🔶 **Implemented 2026-07-12** (design: [`06-phase3-server.md`](06-phase3-server.md)).
> Slices 1–4 landed; slice 5 (the human socket playtest) is the remaining item.

- ✅ `server/`: `node:http` static hosting + `ws` WebSocket; `server/game.js`
  owns the state and mirrors `session.js` (apply/endTurn/AI/diagnostics),
  `server/protocol.js` parses/routes frames, `server/index.js` boots both.
- ✅ Client stops calling `applyCommand` directly: `?server=1` selects
  `client/session-remote.js`, which sends commands over the socket and renders
  the filtered views the server pushes (protocol in `06-phase3-server.md` §3,
  summarised in `02-architecture.md` §6).
- ✅ **Explicit contracts** (`specs/plan-feedback.md`): the client sends
  command envelopes only (`{ commandId, gameId, token, cmd }`); the server
  authenticates the seat by token, **stamps the playerId** (a forged one is
  overwritten then engine-rejected), reduces the canonical state, persists,
  projects per-player views (`filterView` — leak-tested), and broadcasts.
  Rejections are structured (`{ t: 'rejected', commandId, code, message }`).
  The client never resolves rules authoritatively.
- ✅ Server-side validation of every command (token→seat auth, playerId
  stamping, engine legality).
- ✅ Saves move to server disk (atomic `saves/<gameId>.json`), resumed with
  `--game`; seats/tokens persist so a restarted server honours old tokens.

**Acceptance:** Phase 1 game fully playable through the socket; killing and
restarting the server resumes from the save; a tampering client is rejected
without state corruption. ✅ The restart-resume and tamper-rejection legs are
covered by `test/server.test.js` + the served-by-server `test/browser.test.js`
case; ⬜ the full human socket playtest (latency, mid-game restart) is the
open acceptance item (see `human-workitems.md`).

## Phase 4 — LAN multiplayer, reconnection, and resynchronization

> **ACCEPTED 2026-07-14** — real two-machine session (2 humans +
> spectator + AI) survived a host-PC network kill AND a server kill
> with save-resume; the session save replays hash-exact. All slices ✅:
> lobby + join codes + seating chart, client lobby UI + boot path,
> presence/host-skip/vote, spectators (server + client), host slot
> controls, and the wave-V hardening from the first real playtest.

> Design draft: [`08-phase4-lan.md`](08-phase4-lan.md) (builds on the phase-3
> seats/tokens/per-seat-views/save-resume primitives).

- Lobby: named sessions, join by code, slot claiming, ready-up.
- Turn-based play across machines: active-player highlighting, end-turn
  notifications, reconnect (rejoin slot, receive full view resync).
- Simultaneous-turns option can wait; strict sequential turns first.
- Optional: spectator slots (receive omniscient or delayed view).

**Acceptance:** you + ally on two machines over LAN complete a game with at
least one mid-game disconnect/reconnect.

## Phase 5 — Roblox integration (engine port COMPLETE 2026-07-14; wording per ally round-5 required correction)

> The deterministic Luau rules engine is complete and verified: all
> replay fixtures, seeded world generation, AI simulations, chaos
> scenarios, and recorded browser games reproduce the same canonical
> outcomes in both runtimes. The remaining work is Roblox
> INTEGRATION: authoritative session/server flow, client command UI
> and filtered views, seat identity/reconnect behavior, and an
> acceptance game played in Roblox whose recorded move log replays
> hash-exact through the browser engine (formally: the canonical
> state hash matches after EVERY command, and the final game
> verification code agrees).

> **UNDERWAY (2026-07-14)** — P5-1 landed same-day as the phase opened:
> `luau/{rng,statehash,gamecode}` passed ALL anchors on the first lune
> run, and the roblox-helper's R1 then printed the same four anchors
> inside Roblox Studio — **Node ≡ lune ≡ Studio VM proven**. The
> engine trap-audit (docs/09 §7) came back clean: pure transliteration
> ahead, no JS pre-fixes. P5-2 followed (json2lua + scenario-runner
> twin: ten-for-ten cross-language setup-state hashes), then P5-3
> (applyCommand dispatcher + movement/visibility twins: scenario 001
> green cross-language, 8/8 data-file checksums equal, and the
> divergence-report contract caught its FIRST real cross-language bug
> — JS lazy-default writes — within minutes of existing; docs/09 §3
> carries the P5-3 trap block). R2 rendered the first Parts world in
> Studio. B10 then pinned all ten scenario hashes (the cross-language
> contract, guard-enforced), and P5-4 through P5-7 ported the entire
> rulebook — combat, improvements, cities, tech, happiness,
> government (the Pyramids instant-switch = first wonder effect
> cross-language), mapgen, barbarians, score — **ALL TEN scenarios
> now run green cross-language against unchanged pins, and endTurn
> runs unguarded end to end** (the guarded-no-op era closed
> ten-for-ten). R3 (Studio camera + tile selection) accepted on a
> 30+-pick user-driven probe. The trap ledger grew the stable-sort
> rule and the scan-order-as-rng-contract lesson. **P5-8 TOOK THE
> SUMMIT same-day: the Luau AI thinks identically** — all four
> checkpoint goldens + the natural-end golden bit-exact under lune,
> five real recordings produce byte-identical replay verdicts from
> both engines (they even agree on HOW stale recordings diverge),
> dispatcher 14/14, zero notPorted anywhere. The docs/09 §4 engine
> column is CLOSED — P5-1 through P5-8 in two days, the rule modules
> in one — and CONFIRMED CROSS-MACHINE (2026-07-15: the sim-runner
> reproduced all four checkpoints + the natural golden bit-exact on
> independent hardware; the port is proven across three machines and
> two languages). Open: R4 only (GameServer over RemoteEvents —
> claimed; acceptance = a game PLAYED in Studio whose command log
> replays hash-exact through the Node engine).

> Mapping design: [`09-phase5-luau.md`](09-phase5-luau.md) — the trap list
> (stored 0-based index VALUES, `%` semantics, truthiness), leaf-first port
> order with anchor/scenario/golden gates, and the lune CI harness
> (approved 2026-07-12).

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

- ✅ **A0 — AssetFactory seam** *(done 2026-07-11)*:
  `client/renderer/three/assets.js` owns all unit/city mesh construction
  (shared geometries + per-color Lambert material caches — no per-mesh
  disposal needed); picking went recursive with a parent walk to the
  userData-carrying group.
- ✅ **A1 — Procedural low-poly kit** *(done 2026-07-11)*: six silhouette
  classes cover all 28 unit types — wagon (settlers/caravan/diplomat),
  foot-soldier token (militia→mech-inf), mounted (cavalry/knights/chariot),
  siege (catapult/cannon/artillery; armor gets a tank hull+turret), ships
  (sail / powered / submarine variants), aircraft. City house clusters
  scale with pop (owner-color roofs, banner, wall ring when City Walls is
  built). Ownership = colored base disc, not whole-mesh recolor.
  Improvement markers (irrigation strip / mine pyramid / road cross),
  forest+jungle trees, and special-resource dots are **InstancedMeshes**
  with per-instance fog dimming — they replaced the tile tints.
  `debugging/gallery.html` renders one of everything through the real
  renderer for review (`debugging/screenshot.sh` it). The ally judged this
  kit "enough for a compelling local prototype."
- ✅ **A1.5 — Procedural terrain detail** *(done 2026-07-11, from
  `specs/terrain-art.md` — parallel with phase 2, exactly as the ally
  recommended)*: deterministic per-tile shade variation (`visualRand(x, y,
  salt)` — never `Math.random`, nothing stored in state), 3–5 scattered
  varied trees per forest/jungle tile, rock mounds on hills, snow-capped
  angular peaks on mountains, sparse scrub on open ground, and **connected
  roads** — segments drawn toward each neighboring road/rail/city tile
  instead of a generic cross. All instanced, all fog-dimmed per instance.
- ✅ **A1.75 — Continuous low-poly terrain surface** *(done 2026-07-12, from
  `specs/terrain-mesh.md`)*: the instanced tile boxes are replaced by ONE
  displaced, non-indexed `BufferGeometry` (`client/renderer/three/terrain.js`)
  — per-face palette colors (3 shades per terrain) + explicit per-face
  normals give the faceted tabletop look WITHOUT `flatShading` (that flag
  needs the derivatives extension on WebGL1; explicit normals need nothing).
  Water sits in a sunken basin, coasts ramp, hills mound, mountains ridge
  under their peak props, deserts get sine dunes. `tileTop(x, y)` now reads
  the surface height at the tile-center vertex, so units/cities/props/
  markers all sit on the landscape. Picking raycasts the surface and rounds
  `hit.point` to tile coords. All displacement through `visualRand` —
  deterministic, nothing in state. Verified WebGL2 + WebGL1
  (`--disable-es3-gl-context`) + gallery + browser e2e.
- ✅ **A1.6a — Faction identity & status markers** *(done 2026-07-13, from
  `specs/plan-assets-2.md` + the ally-authored table in
  `specs/civ-visuals.md`)*: per-civ visual{primary, secondary, emblem} in
  data/civs.json, all 14 emblems as CanvasTextures
  (renderer/three/factions.js), pennants + capital emblem flags, unit
  token layer (move-state brightness, veteran rim, fortified chip, dark
  rims for light civs), gallery 14×5 acceptance grid. A1.6b (water/
  coastline/patterns) is queued as A15 with a mandatory assets.js split
  pre-step.
- ✅ **A1.6b — Water, coastlines, materials, infrastructure** *(done
  2026-07-13, specs/plan-assets-2.md §1/§3–§5)*: translucent Phong water
  plane over the sunken basins (depth grading free from the terrain
  ramps), instanced foam shore-outlines (grid-readability strengthened,
  per the ally's own caution), render-time-only wave drift, one shared
  low-contrast mottle texture (per-terrain atlas = ally-triggered
  follow-up), railroad ties / mine entrances / irrigation fields; plus
  the assets.js split (renderer/three/props.js) proven byte-identical.
  **Ally SIGN-OFF 2026-07-13 (A1.6a+b together)**, with his three-point
  gallery checklist run by the architect against fresh shots: ivory
  civ reads on tundra via the dark/gold rims (the tightest pair, by
  design); Emerald Oak vs grassland and Azure Wave vs ocean carry via
  disc saturation + rims + secondary-color pennants (blue-on-ocean is
  the weakest, within his "saturation or secondary accent" criterion);
  rails/irrigation crossing dunes stay legible, foam dashes crisp
  (`debugging/gallery-signoff-{grid,props}.png`).
- ✅ **A1.7 — Animation polish** *(done 2026-07-14 as A28, ally spec
  §"Art A1.7")*: flag/pennant sway on hinge sub-groups, 200ms unit
  movement glides (hitboxes stay logical — proven by a mid-flight
  click e2e), city smoke at pop ≥ 5, fog-filtered combat flash rings,
  and the ⚙ "reduce animation" accessibility option — all in the new
  `renderer/three/anim.js`, render-time-only, zero state, zero hash
  movement. The gallery boots at REST POSE by default (byte-stable
  asset comparison); `?anim=1`/`?flashdemo=1`/`?glidedemo=1` opt in.
  Feel constants (sway 0.18 rad, glide 200ms) await user tuning. The
  procedural art track is COMPLETE — A2 (.glb models) stays optional.
  **ALLY VISUAL SIGN-OFF 2026-07-14 (round 4): A1.7 approved as the
  BROWSER REFERENCE IMPLEMENTATION** — full acceptance checklist
  signed (terrain, palettes, coast, city tiers, unit families,
  ownership layering, light-faction protection, render-only motion,
  reduce-animation, the gallery as regression tool). Seven small
  non-blocker follow-ups queued as A44 + playtest checks; future
  silhouette-differentiation note recorded as an A1.8 candidate.
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

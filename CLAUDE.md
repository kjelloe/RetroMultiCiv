# RetroMultiCiv

Browser 4X game recreating Sid Meier's Civilization (1991), built so the
simulation engine ports mechanically to Roblox Luau. Read `docs/` before
structural changes: `01-game-spec.md` (rules), `02-architecture.md`
(engine-as-reducer, stack), `03-roadmap.md` (phases),
`04-phase1-enrichments.md` (designs for unimplemented Civ 1 systems —
follow these when picking one up), `06-phase3-server.md` (the
authoritative-server design — protocol, seats, persistence, slices),
`07-game-code.md` (save-tamper verification code), `08-phase4-lan.md`
(lobby, join codes, skip-vote, AI regency — decisions final),
`09-phase5-luau.md` (port mapping: the trap list, port order with
anchor/scenario/golden gates, harness plan), `10-roblox-agent.md` (the
SECOND-PC roblox-helper's role spec: owns `roblox/` exclusively,
consumes `luau/` read-only; mail + locks cross machines LIVE via the
agent-mail hub — `agent-mail.py serve` on the dev PC, a one-line
`.agent-mail/remote` URL file on the other clone — with tracked
in-file marks as the durable record and hub-down fallback; code
travels via git, pumped by the user), `11-sim-runner.md` (a fifth
agent's spawn-ready role spec: measurement executor, zero write
footprint — spawns when phase-5 parity gates need offloading),
`12-global-host.md` (public hosting, both roles: games run ON the
user's VM, plus a QuakeWorld-style master index where self-hosted
servers announce themselves; A51 gated on the user scheduling DNS),
`13-roblox-ui-parity.md` (the Roblox client roadmap: every browser
UI element's Roblox shape, in tiers), `14-phase6-diplomacy.md`
(phase-6 design: Civ 1-scope treaties, audiences, reputation +
senate, human treaties in LAN — slices D1–D6; A59 is the
prerequisite), `15-ai-war.md` (the AI war doctrine: user's 3:1-both
ruling with sim-swept ratios per combat rule, army options, siege/
blockade, era templates), `16-security-assessment.md` (the hosted
surface: posture per component, the ranked gap list feeding A50,
operator quick-card — re-assess at A50/master-index/new-dep/1.0),
`17-hardening-agent.md` (the server-robustness lane's role spec:
own clone, exclusive files [server/limits.js + the connect/cmd
paths in server/index.js], report-only-on-cross-lane, neutral
operational vocabulary — keeps the game team off the lane),
`18-reviewer-agent.md` (the READ-ONLY reviewer/checker/understudy:
own clone on the gaming PC — per-marker clean-clone gate +
engine-diff code review before merge, AND architect-understudy
PRE-DESIGN checks [wiki-authenticity fact-check vs the
../wikiteam dump if transferred + prior-art grep] before a
golden window opens; mails advisory verdicts, holds no design
authority, never commits/locks — the sim-runner stays git
operator).

## Hard rules

- **`engine/` stays in the Lua-portable JS subset** — see `docs/02-architecture.md` §4.
  Highlights: no `class`/`this`, no `Map`/`Set`, no async/exceptions in engine
  code, integer math via `idiv()`, index math only through helpers
  (`tileAt`, `neighbors`), state flows through the `state` argument.
- **Determinism is sacred:** all randomness through `engine/rng.js` (xorshift32,
  state in game state). Never `Math.random()`, never `seedrandom`, and the Luau
  port must reimplement the same algorithm — not `Random.new`.
- **The engine is a verified cross-language core (since 2026-07-14):**
  any change to engine semantics adds a replay fixture FIRST, then
  changes `engine/*.js` AND its `luau/` twin together in one golden
  window (ally round-5 rule; twin fidelity = byte-shaped, refactor JS
  first if ever).
- `engine/` imports nothing from `client/`, `server/`, or Node built-ins.
- Ruleset numbers live in `data/*.json`, never hardcoded in engine logic.
  **Top-level `data/*.json` = engine rulesets ONLY** (the twins gate
  count-checks them cross-language); generated non-engine artifacts
  live in `data/` subdirs (e.g. `data/assets/asset-recipes.json`).
- **Game state holds only integers, printable-ASCII strings, booleans, arrays,
  plain objects.** No null, no floats (JSON null becomes nil in Lua and
  vanishes; floats drift). `shared/statehash.js` enforces this.
- No build step: plain JS, vendored `three.module.js` via import map.
- **three.js is pinned to r162 — do NOT upgrade to r163+.** r163 removed WebGL1
  support, and the user's own browser is stuck on ANGLE Direct3D9 (WebGL1
  only). r162 auto-falls back to WebGL1. Verify any renderer change with the
  headless screenshot loop below, including once with `--disable-es3-gl-context`
  (emulates the WebGL1-only environment).
- Minimal dependencies: `ws` (server), vendored three.js, `lune`
  (dev-only, phase-5 Luau CI twins — user-approved 2026-07-12), and
  `@playwright/test` (dev-only, the nightly multi-client UI lane in
  `test-ui/` — user-approved 2026-07-14, arrives with A49; `node
  --test test/` stays playwright-free) are the whitelist; `Rojo` +
  its Studio plugin are approved on the ROBLOX PC only (user-approved
  2026-07-14, docs/10). Ask before adding anything else.

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
`BUILDING_OVERLAY`/`WONDER_OVERLAY`/`TECH_ERAS` tables inside
`tools/mapdata.js`; add new effects there and regenerate, don't hand-edit
the generated JSON.

Cross-references use slug ids: `units.json` `tech` fields hold tech ids from
`techs.json`; watch wiki naming drift when mapping (e.g. "The Wheel" vs
"Wheel", "(advance)" disambiguation suffixes, mid-word hyphenation).

## File size & module policy

Split by SEAM, not by line count — but as soft ceilings: engine modules ≤ ~300
lines (each becomes a Luau ModuleScript 1:1; small files = reviewable port),
client/tools ≤ ~450. If a file needs a full rewrite because targeted edits got
risky, that IS the signal to split it. One module = one subsystem; keep
`require`s acyclic. The client is split as: main (bootstrap) / session
(state owner + AI-drive — the phase-3 socket seam) / session-remote /
diagnostics /
ui/{hud,panels,input,saves,turnlog,turnlog-classes,setup,handoff,
options,lobby,move-hints,wait-status,advice,advice-gate,catalog-text,
endscreen,ff-overlay,historian,left-stack,overlays,pedia,pedia-concepts,
regency,regent-driver,replay,replay-events,sound,sound-map,stats,
stats-data,palette,mlog,dpad,discovery-card,tech-blurbs,ship,minimap,
build-queue,automate,debug-panel,strategic-overlay,diplomacy,rejoin,
tech-tree,tech-glyphs}. tech-tree = the 🌳 graphical tech-tree overlay +
client-side beeline (research goal in client state, issues normal
setResearch — golden-neutral; the DAG-walk is pure in shared/beeline.js);
tech-glyphs = procedural per-tech icons (era frame + motif, factions.js
idiom). The
renderer splits renderer/three/{index,assets,props,terrain,factions,
overlays,recipes,unit-chrome,anim
— anim.js is render-time-only motion: clock+position phases, never
engine RNG/state}. UI reads session.state
and calls session.apply()/endTurn(); session.onChange drives refresh.
`ctx.HUMAN` is the CURRENT VIEWPOINT (mutable — hotseat hands it between
players via ctx.setHuman); never cache it in a module-level const. Keyboard
handlers must ignore events from INPUT/TEXTAREA targets (dialogs).
main.js canonicalizes the URL after boot (history.replaceState drops
unknown params) — a ui module reading its own `?param` hook must capture
location.search at MODULE EVAL (imports run before main.js's body), never
lazily (A45 trap).

## Testing & running

`node --test test/` — headless (the dump integration test self-skips if
the dump is absent); `debugging/t.sh [-v] [files…]` is the preferred
invocation (summary + failure blocks, no inline pipes),
`debugging/killport.sh PORT…` frees stray dev servers (kills by PID from
`ss` — never pkill patterns, they self-match the calling shell),
`debugging/peek.sh [-c N] FILE PATTERN… | FILE N-M` prints numbered
matches-with-context or a line range (replaces grep|sed|head chains),
`debugging/shoot.sh out.png "/client/?params" [--server "args"]
[--webgl1]` serves + screenshots + cleans up in one call (static python
by default, `--server` boots the node server for `?server=1` pages),
`debugging/info.sh <save.json>` summarizes any save/recording (turn,
players, hash, game code — the first look before replaying; wraps
`debugging/save-info.js`), `node debugging/stats-summary.js <stats.jsonl>`
prints the AI-quality exit-criteria numbers from a soak --stats log
(stats.html charts the same rows), `node debugging/probe-lan8.js` drives
8 live ws clients for LAN-scaling timings (a probe, not a test),
`debugging/triage.sh [files…]` replays every recording in
debugging/logs/ with one verdict line each (B0's mechanized form), and
`debugging/sync-check.sh [count]` flags stale test counts in the pinned
docs, and `debugging/soundboard.html` (served only under the server's
`--debug`) plays every synth cue + tune with per-row comment boxes —
the PERMANENT audio-review tool (user ruling 2026-07-16); new
SOUND_IDS rows appear automatically, and `debugging/glyph-sheet.html`
renders the 68 procedural tech glyphs in a labeled grid (provisional
motifs flagged) — the review tool for the tech-glyphs system. Agents: use these scripts, not hand-composed pipe one-liners —
inline pipes trigger permission prompts for the user. Play (local engine): `python3 -m http.server 8123` from
the **repo root**, open `http://localhost:8123/client/` (bare URL = setup
screen; `?seed=N` fixed world skips it, `?civs=2..14` (size-capped via rules.maxCivsBySize), `?humans=N` hotseat,
`?civ=romans`, `?size=xsmall..huge`, `?difficulty=trainer..godemperor`,
`?age=ancient..space` starting age (AI fast-forward + era tech grant,
shared/fastforward.js), `?marathon=1` play-until-victory (rulesOverrides
endYear=9999, the natural-mode shape — also a setup + LAN-lobby
checkbox), `?debug=1` per-command hashes + the A92
debug-command family (state.debugEnabled at create; 🐞 panel; first
use sets the PERMANENT debugUsed hash taint — docs/07 §6; the 🧠
strategic-overlay panel is debug/spectator-only, reads
shared/strategic.js — the same snapshot the soak --stats rows use),
`?mock=1` static
state, `?mlog=1` on-screen boot/ws/error overlay for console-less
devices [phones], `?palette=<mode>` display-palette override). Play (phase-3
authoritative server): `node server/index.js [--port 8123] [--seed N]
[--civs N] [--size medium] [--game saves/<id>.json] [--no-save]
[--no-spectators] [--host IP]` hosts the client AND the game; open
`http://localhost:8123/client/?server=1` — the client joins over `/ws`
instead of running its own engine (hotseat stays local-only);
`&spectate=1` joins tokenless as a view-only omniscient spectator
(host-controlled). `./run.sh [PORT] [server args]` wraps the server
(prereq checks, restart, WSL port-forward/firewall guidance);
`run.ps1` is its native-Windows twin. `engine/` and `shared/` are ESM (per-dir `package.json` type
markers) so they load in both browser and Node; `server/` is ESM too; CJS test
files use dynamic `import()` for them. `tools/` stays CJS.

**Visual verification without a GPU:** use `debugging/screenshot.sh [out.png]
[url] [extra chrome flags]` — it wraps the Playwright-cached headless Chromium
with the required SwiftShader flags (WebGL has no GPU here and fails without
them). WebGL1 pass: append `--disable-es3-gl-context`. Useful URL params:
`?zoom=6` close-up, `?e2e=1&e2eclose=1` scripted city + panels closed.
`debugging/gallery.html` shows every unit silhouette, city tier, tile
prop, AND the 14-civ faction acceptance grid through the real renderer
(`?cx/cy/zoom` reposition it; boots at REST POSE so asset shots stay
byte-comparable — `?anim=1` opts into motion) — screenshot it after any
change under
renderer/three/ (terrain.js = the continuous faceted surface; explicit
per-face normals, NOT flatShading, which needs a WebGL1 extension).
**Playtest diagnostics:** Shift+D in the client downloads a replayable
recording (initial state + every human command + per-round state hashes;
`?debug=1` hashes after every command). `node tools/replay.js <file>`
re-runs it through the engine and pinpoints any hash divergence — the
first tool to reach for when a playtest report says "something looked
wrong". Loading a save restarts the recording from the load point.

**Test layers** (all via `node --test test/`): unit tests (rng, statehash,
cities, improvements, happiness, government, combat/barbarians, tech, ai,
score, visibility, mapgen, year, move-hints, wiki2data — engine tests share
`test/ruleset.js`),
JSON scenarios (below),
`simulation.test.js` — headless all-AI playthroughs via `test/sim-driver.js`
(fixed seed, 400 turns run twice with chaos-command injection, invariants
every turn, golden checkpoint
hashes at 100/200/300/400 = phase-5 Luau anchors; ~45 s; design + golden
re-record process in `docs/05-simulation-test.md`; failure artifacts in
`debugging/sim/` are drag-droppable saves + `tools/replay.js`-bisectable
diags, SELF-DESCRIBING since B9 (embedded verbatim invariant text); wide net: `node tools/soak.js --seeds 25` — parallel via `--jobs`, window via `--start`, chaos-off via `--no-chaos`, ratchet gates via `--enforce-floors id,…` (A93), v1.5 per-AI strategic + outcome telemetry rows ride `--stats`,
telemetry via `--stats`, stress via `--difficulty godemperor`, victory
check via `--natural`; nightly CI runs the last two,
`.github/workflows/nightly-soak.yml`), the **phase-3 server tests**
(`server-protocol.test.js` — pure frame parse/route/seat-auth/playerId-stamp;
`server.test.js` — a real `ws` client drives join → play → restart-from-autosave
→ token reconnect → tamper-reject; socket tests budget ~30s per awaited
message and dump the unmatched inbox on timeout — the parallel suite runs
them 6–10× slower than isolated, measured; `server-lan4.test.js` is the
template), and
`browser.test.js` — an e2e smoke that boots the real client in the cached
headless Chromium (`?e2e=1` founds a city and fills the panels; a
served-by-server case drives `?server=1` through the socket via a live-page
CDP poll — `dumpDomLive`, since virtual-time `--dump-dom` races the ws join)
and asserts the HUD reaches "turn 1", the panels carry real content, and no
error surfaced (self-skips when the browser is absent), and
`luau-twins.test.js` — the phase-5 cross-language gates (self-skip without
`lune`): the rng/statehash/gamecode anchors, every scenario setup AND
runs vs their pinned hashes, the eight data-file checksums, the golden-seed
turn-100 AI sim (`luau/sim-smoke.luau`; the full goldens run via
`luau/sim-smoke.luau 400` / `natural`), and replay VERDICT equality between
`tools/replay.js` and `luau/replay.luau` over whatever recordings exist.

**Mechanics tests are JSON scenarios** in `test/scenarios/` (format documented
in `test/scenario-runner.js` and docs/02-architecture.md §8) — add a JSON file,
not runner code. They run against BOTH engines (Node via the scenario suite,
Luau via `luau/scenario-runner.luau` in the twins gate), so keep them
code-free; the pinned `final.hash` is the cross-language contract and may
never be committed null (guards enforce the paste-back).
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
City visuals compose SIZE × ERA: `CITY_TIERS` (assets.js) owns count/
density/height by pop; `shared/city-era.js` (pure, Roblox-portable) owns the
ERA band — renderer-local ids `ancient`/`classicalMedieval`/`industrial`/
`modernSpace` derived from the owner's most-advanced tech era (no-tech →
ancient). It's RENDER-ONLY + fog-honest: `hud.js` annotates the ephemeral
view (never state/hash), so a rival city under fog defaults to ancient (the
viewer can't read a rival's techs). `test/city-era.test.js` asserts every
band has a style + assets.js maps every style key (the terrain-coverage
pattern). Roblox uses the SAME band ids + era map (docs/13, run-F item 8).

## Workflow

**Naming convention (user ruling 2026-07-17):** a change that does
not move the deterministic goldens is labelled **`gamesim-golden-neutral`**
(or plainly `golden-neutral`) in mail, commits, and marks — NEVER
`sim-golden`. Keep game-simulation language explicit (`gamesim` /
"game simulation") so it never reads as an ambiguous "sim"; the
server-robustness lane (docs/17) is a separate clone with its own
neutral operational vocabulary and does no game simulation. This
keeps the two domains' vocabularies from colliding.

**Status & reporting style (user ruling 2026-07-17) — mail, commits,
done-marks, summaries, log output:** report STATE, not agency — write
like a build log, not a mission briefing. (1) Report facts and counts;
never frame the system as an autonomous actor ("knows its orders", "runs
itself", "you can step away / it won't run dry / unattended" are all out).
(2) No fleet/military framing for the WORK SYSTEM: avoid "fleet", "swarm",
"orders", "deploy", "command", "monitor standing watch". Say "task queue",
"background worker", "N processes active", "review script", "test run".
(3) Keep game-domain military vocabulary (conquest, aggressive stance,
Legion…) inside LABELED DATA — tables, config, spec docs — not restated in
narrative summaries. (4) Prefer the one-line status form
`<area>: <N done>/<N total>, <blockers>, <next action>`. (5) Neutral verbs
for data ops: export / regenerate / re-record / sync — NOT "harvest",
"scrape", "sweep". Same information, mechanical voice.

**Agent-mail output (user ruling 2026-07-17):** `send` prints a
RECEIPT ONLY (`queued <tag> #<id> → <to>`) — never echo/re-print the
body; it lives in the mail file. **Never construct the body inline in
the send command — no heredoc (`<<'EOF'`), no echo/printf pipe, no
inline `--body` string for a substantive body; all of those stream the
body into the transcript and defeat `--body-file`.** Two SEPARATE
steps: (1) write the body to a file with the file-write TOOL (Write/
Edit), a standalone call; (2) a separate command `send … --body-file
PATH`. A trivial one-line ack may use inline `--body`; anything
multi-line goes in a file first. Read inboxes with `--headers` (one
line per message); expand exactly one with `show #<id>`/`@<hash>` when
you need the body. Never pipe an inbox/log dump and a body echo into
one output. Detailed plans/specs go in the body or spec files,
referenced by ID/path in any stdout summary.

User handles all git commits and pushes on dev/main. The dev_night
branch is the STANDING exception (user grant 2026-07-16, widened
same day; widened again 2026-07-18): the architect commits accepted
gate-green work there, AND the sim-runner pushes dev_night directly
from the gaming PC after its sweeps/rebases (dev_night only, never
dev/main; marker tags stay architect-only); the architect
coordinates the gaming-PC's git operator (sim-runner) by mail; the
architect TAGS save points as `marker-NNNN` (zero-padded, sequential
— marker-0001 = 5a93473) and the user merges ONLY the LATEST
marker the architect declares consistent (declare it explicitly
with every tag report) — no waiting on the user for small changes,
but BREAKING changes (protocol, save format, golden re-records,
anything a running game or another lane must react to) get an
explicit alert before the tag. Build → test → stop and report.
**Per-marker report (user ruling 2026-07-17):** when tagging
`marker-NNNN`, also write `reports/marker-NNNN.md` — a verbose,
human-readable explanation of what that marker delivered (the
commit/tag lines are terse; this is the detail). Cover: the delta
since the previous marker, each item with what changed and why, any
golden re-records with the new hashes, breaking notes, and the
test state. Reporting-style rules still apply (facts, no
autonomous-actor voice). marker-0025..0030 are covered collectively
in `reports/night2-morning.md`. **A marker report also refreshes the
LIVING plan docs (user ruling 2026-07-20): `plan-version1.md` (the
1.0 dependency tree — node statuses + last-updated line; verify an
axis against the ENGINE, not the workitem files, before flipping it
done) and, when something is deferred or promoted, `plan-version2.md`
(the loose v2 shelf; items leave it only by user ruling).**

Work splits across `agent-workitems.md` (A-items: features/docs for the
local **coder-helper**; B-items: bug triage/fixes for the local
**AI bugfixer** — each item self-contained with verification steps and
golden-re-record instructions; the **architect** curates both queues,
holds design authority, and reviews everything) and `human-workitems.md`
(verification and decisions only the user/humans can make). Bugs have no
fixed lane, so the bugfixer MUST claim the exact files by mail before
editing and the architect arbitrates collisions; only ONE agent holds the
golden lock at a time. File claims are MECHANICAL as well as by mail:
`agent-mail.py lock <file> --as <role> --why "…"` before editing any
shared file, `locks` to check holders (age shown — stale locks get
arbitrated, never edited through), `unlock` when your done-mail goes out;
only the holder or the architect (`--force`, which broadcasts) releases.
The mail claim still carries the WHY and the regions; the registry
answers "may I edit this RIGHT NOW". Claim items in-file, mark them done,
never reorder someone else's. Agent⇄architect coordination goes through
`python3 tools/agent-mail.py` (send/inbox/peek/log/show, global @hashes
per message, per-role unread
cursors — check your inbox at task start and end); usage incl. the
LAN hub, flag aliases, and the measured gotchas is documented in
`tools/agent-mail.md`. **A blocked lane, or one needing a ruling, mails
`coordinator` (tag `blocked`) — a read-time role alias for whoever holds
coordination (currently `architect`, re-pointed in `.agent-mail/roles`);
silence is never a status, so raise your hand rather than idle
(design: `specs/coordinator-role-alias.md`).** **Every lane also keeps a live
status line — `agent-mail.py status --as <role> "waiting | working X | working X
(long ~Nm)"` (overwrites a per-role file, never floods the log); update it at
pickup/done/state-change + before any op that blocks you silent >~10 min (mark it
`long`); the coordinator reads the board with `status` and pings only
working-and-stale (>15m, not `long`) lanes. Per-lane WORK STACKS front-load
routing — `queue add --for <lane>` (coordinator stocks), `queue take --as
<lane>` (an idle lane pops its next FIFO item itself + posts `working`),
`queue list` (backlog depths); a lane's single stream serializes its stack, so
the coordinator just curates order + never queues the same golden files to two
lanes.** `agent-chat.md` is
the long-form archive. The store is gitignored; the md is tracked.

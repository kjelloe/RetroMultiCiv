# Agent work items — RetroMultiCiv

Implementation and documentation tasks the **main coder** (Claude, design +
architecture) hands to a **local coder helper** agent. Human-verification
items live in `./human-workitems.md`.

## How to work an item

1. Read the repo `CLAUDE.md` FIRST and follow it exactly — the hard rules
   (engine stays in the Lua-portable JS subset, all randomness through
   `engine/rng.js`, state holds only integers/ASCII-strings/booleans/arrays/
   plain objects, ruleset numbers in `data/*.json`, three.js pinned r162,
   no new dependencies) override anything written here.
2. **Never run git commit/push/pull/checkout — the user handles all git.**
3. Definition of done, every item: `node --test test/` fully green
   (currently 124 tests), the item's own verification steps pass, related
   docs updated, then STOP AND REPORT — list files touched, tests added,
   anything unexpected.
4. Golden hashes: `test/simulation.test.js` pins checkpoint hashes of a
   fixed AI game. Any change to engine behavior, AI decisions, or
   `data/*.json` shifts them. Re-record ONLY when your item says so: set
   `GOLDEN_SOAK`/`GOLDEN_NATURAL` to `null`, run the file, paste the
   printed JSON back, run again green. Same process for scenario hashes
   (`test/scenarios/*.json`, set `"hash": null`).
5. Client changes need the headless visual loop: serve the repo root
   (`python3 -m http.server 8123`), then `debugging/screenshot.sh out.png
   "http://127.0.0.1:8123/client/?seed=12345&civ=romans&e2e=1"`, once more
   with `--disable-es3-gl-context` appended (WebGL1 pass), and
   `debugging/gallery.html` after any assets/terrain change. Read the
   screenshots — do not claim visuals work without looking.
6. Mark the item `[claimed: <who> <date>]` when starting, `[done: <date>]`
   with a one-line result when finished. Do not reorder other items.

---

## A1 — Standing sync pass: specs, MDs, tests, documentation, memories  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — 3 AI-batch doc drifts fixed (docs/01 §11 AI bullet, docs/03 step-11 AI-improvements status, README test count 112→124); all other areas checked, no drift; suite 124/124]

The recurring instruction "update use-case specs, MDs, tests, documentation,
skills and memories as applicable", made concrete. Run it after any feature
batch lands (and whenever the main coder queues it).

- **Where documentation lives**: `CLAUDE.md` (conventions — update the
  test-layers/tooling notes if they drifted); `docs/01-game-spec.md`
  (rules — §11 tracks implementation status and deviations);
  `docs/02-architecture.md` (engine/stack contracts);
  `docs/03-roadmap.md` (phases + art track — mark ✅ with a dated note);
  `docs/04-phase1-enrichments.md` (designs for unimplemented systems —
  mark landed slices DONE with measured results);
  `docs/05-simulation-test.md` (sim harness — has its own findings log);
  `README.md` (public-facing, keep the trademark disclaimer intact).
- **`specs/` is the designer ally's verbatim text — NEVER rewrite it**;
  adoption notes go in docs/ or as clearly-labeled appendices.
- **`plan-update.md`** (gitignored, ally/friends-facing): refresh the test
  count and add a short plain-language paragraph per new feature. No
  jargon, no file paths.
- **Tests**: every new engine rule needs a unit test; every new mechanic
  the sim can reach should keep invariants green (`node tools/soak.js
  --seeds 5 --size small` as a spot check). New client modules must be
  listed in `test/client-syntax.test.js` (this was forgotten once).
- **Memories**: the project memory file has a single writer (the
  architect). Always end your report with a "suggested memory notes"
  section — facts: what landed, hash impacts, gotchas — for the architect
  to fold in at review. Do not write the memory file directly even if you
  can see it.
- **Skills**: none exist in this repo today; skip unless one appears.
- Done when: every doc that mentions a changed behavior agrees with the
  code, the suite is green, and the report lists what was synced.

## A2 — Chaos layer: next command batch

Teach the sim's chaos layer (test/sim-driver.js `pickChaosCommand`) the
commands listed in `docs/05-simulation-test.md` §11 "Chaos backlog":
setProduction switches, moveUnit random walks, foundCity attempts,
startWork variety, setWorkers with taxmen/scientists, setGovernment
communism, and the driver-level save/load hash round-trip.

- All draws through the existing `roll()` (separate xorshift stream) —
  NEVER `Math.random`, never the game's `rngState`.
- Commands are legal-SHAPED; rejections are fine and must replay: they are
  recorded per player-slot in `airound` entries, and `tools/replay.js`
  re-applies them — extend nothing there unless a new entry field is
  needed.
- ONE golden re-record at the end (rule 4). Run the replay round-trip test
  and a 10-seed soak before recording.
- Done when: each new command type appears applied at least once in a
  60-turn chaos probe (count by `cmd.type` over `roundLog`), suite green.

## A3 — Telemetry chart page  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — debugging/stats.html: Canvas 2D, zero deps, drag-drop + file-picker + ?file= fetch; per-seed city/tech/score/units/gold curves per civ + summary (eliminated %, tunable stagnant %, government mix); verified headless on a real 4-seed/400-turn --stats log; docs/05 pointer offered to architect (docs/ is theirs this window)]

A static, dependency-free HTML page (e.g. `debugging/stats.html`) that
loads one or more soak `--stats` JSONL files via a file picker or
drag-drop and charts balance drift: per-seed city/tech/score curves per
civ across checkpoints, plus a summary table (eliminated %, stagnant %,
government mix). Canvas 2D — NO chart libraries (dependency whitelist).
Read `test/sim-driver.js` `snapshot()` for the row shape. Verify with
`debugging/screenshot.sh` against a generated JSONL. Client-only: no
hashes, no goldens.

## A9 — Phase-3 slice 3: client remote session (design: docs/06 §5)  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — client/session-remote.js (same 5-surface contract over ws); main.js ?server= boot switch; apply/endTurn now Promise-based on BOTH sessions + await sweep (input.js funnel/helpers/GoTo chain/endTurn, panels 3 fns, main e2e); served-by-server browser case (CDP live-page waiter — virtual-time races ws); full suite 135/135, both paths screenshot-verified. Client-side shims for filterView omissions (cityOrder/wonders/nextCityId/explored) — FLAGGED for architect. Golden-safe.]

Server core + socket layer exist and are tested (server/game.js,
server/protocol.js, server/index.js; test/server-protocol.test.js +
test/server.test.js show the full message flow). This item is the client
side: `client/session-remote.js` with the SAME five-surface contract as
client/session.js (state/apply/endTurn/onChange/ruleset), speaking the
docs/06 §3 protocol over a WebSocket. GOLDEN-SAFE: no engine changes.

- Boot switch in main.js: `?server=1` (same-origin `/ws`) selects the
  remote session; everything else (renderer, ui wiring) stays identical.
  Client fetches data/*.json as today and applies `rulesOverrides` from
  the `joined` message (the difficulty mechanism).
- `apply(cmd)` returns a Promise resolving `{ok, reason?, events}` on
  `applied`/`rejected` (match by commandId, monotonic counter). Give the
  LOCAL session the same Promise shape (resolve immediately) so the ui
  has one contract. Call sites to sweep to `await` (verified inventory:
  input.js ×3, panels.js ×9, main.js ×1 — plus `ctx.apply` consumers,
  which all flow through input.js's single funnel).
- `state` = latest server view; `view`/`events` pushes fire `onChange`.
  Token in localStorage (`retromulticiv-token-<gameId>`); on socket
  close, banner + retry join with the stored token (docs/06 §5).
- Hotseat/`?humans>1` stays LOCAL-session only — guard the boot switch.
- Verify: `node server/index.js --seed 12345`, then a screenshot of
  `?server=1&e2e=1` founding a city THROUGH the socket; add a
  served-by-server case to test/browser.test.js (self-skips without
  chromium, like the rest). Verify goldens did not move.

## A10 — Phase-3 slice 4: docs sync + server e2e polish (after A9)  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — docs/03 Phase-3 slices ✅ + Phase-4→docs/08 pointer; docs/06 status + §8 slice statuses; docs/02 server/ layout (game.js/protocol.js) + §5 ref fix; CLAUDE.md server run-path + server/browser test layers; README + plan-update 133/124→135 + server paragraphs; sweep clean (no stale server names). dumpDomLive left in place (works). Suite 135/135; golden-safe]

docs/03 phase-3 checkboxes with dates; docs/06 slice statuses; CLAUDE.md
"Testing & running" gains the `node server/index.js` path next to the
python one; README + plan-update paragraphs (plain language); an A1-style
sweep for any drift the server work left behind.

## A11 — Game verification code (design: docs/07-game-code.md — GREEN-LIT)

All three slices, in order; each is golden-safe. Run AFTER A9/A10.

1. `shared/gamecode.js` (ESM, Lua-portable subset like statehash.js):
   `gameCode(state)` → 13 Crockford-base32 chars grouped `XXXX-XXXX-XXXX2`.
   64 bits = `hi * 2^32 + lo` where `lo` = the existing
   `hashState`-style FNV-1a-32 over `canonicalize(state)`, and `hi` =
   FNV-1a-32 over the SAME canonical string iterated in REVERSE
   (last char to first) with the standard basis/prime — a genuinely
   different function of the input built from the same portable
   primitives (reuse `mul32`; do NOT invent new constants). Crockford
   alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, no checksum char,
   grouped 4-4-5. Pin GOLDEN VECTORS in a new test (the statehash
   golden `{b:2,a:[1,"x",true]}` object plus one crafted game state)
   — these become phase-5 cross-engine anchors; record them
   null→run→paste like scenario hashes.
2. Client hooks (docs/07 §3–4): persistent save dialog with the code
   (NOT the 5s banner) in ui/saves.js; load banner + localStorage
   auto-compare per gameId (`retromulticiv-code-<gameId>`, key exists
   only after first save/load); game-over line in hud; crash overlay
   in main.js shows code of last coherent state + quicksaves it;
   handoff screen carries "code as of last save". Screenshot-verify
   the save dialog and the load banner (e2e URL params as usual).
3. Server (grant: server/game.js + protocol.js are yours for this
   slice): code in the save envelope, in the `joined` reply, and a
   `{t:"code", turn, code}` broadcast wherever autosave fires; extend
   test/server-protocol.test.js + the integration test's restart case
   (code must be IDENTICAL before shutdown and after resume).

Done when: golden vectors pinned and green, tampered-state test (edit
gold in a crafted state → different code), suite green, screenshots read.

## A4 — Goody huts (design: docs/04)

Implement per the docs/04 design: hut tiles placed by mapgen (seeded),
entered by a unit → seeded outcome (gold / free tech / unit / barbarians).
Engine + data/rules.json numbers + unit tests + a JSON scenario locking
one outcome chain. Mapgen change = scenario 002 + sim goldens re-record
(rule 4). Renderer: a small hut prop in assets.js (then gallery
screenshot).

## A5 — Era-based barbarians (design: docs/04)

Barbarian spawn type upgrades with the game year/tech era instead of
always militia (docs/04 has the table). Keep the no-RNG-before-turn-16
guarantee (`test/combat.test.js` barbarian tests). Goldens re-record.

## A6 — Future Tech repeats + building sale (designs: docs/04)

Two small engine slices: Future Tech becomes repeatable (score per
repeat), and buildings can be sold for gold (one per city per turn,
Civ 1) — which also unblocks charging `maintenance` from
`data/buildings.json` (currently data-only; note in docs/01 §11 when
maintenance starts being charged, and expect the AI/sim balance to shift
— goldens re-record, watch a 10-seed soak for gold-starvation stagnation).

## A7 — Remaining wonder effects (mapping: docs/04 "Remaining wonder effects")

Great Library, Darwin's Voyage, Isaac Newton, Copernicus, Lighthouse,
Magellan, Adam Smith. Structured effect fields authored in
`tools/mapdata.js` overlays (regenerate `data/wonders.json` — never
hand-edit it), engine hooks in the system each maps to, `EFFECT_TEXT`
entries in `client/ui/panels.js`, unit tests each. Goldens re-record once.

## A8 — Tile contention (design: docs/04)

Two adjacent cities must not work the same tile: priority = cityOrder
index, manual assignments beat greedy neighbors, conflicting manual
claims go to the older city. Inside `workedTiles`/`candidateTiles`.
Audit scenario hashes (crafted cities are spaced; likely no re-records)
and run a 10-seed soak — this changes yields in dense AI empires, so sim
goldens WILL re-record.

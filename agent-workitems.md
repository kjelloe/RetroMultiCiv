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

## A1 — Standing sync pass: specs, MDs, tests, documentation, memories

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
- **Memories**: if you are a Claude Code session with the project memory
  directory, append the batch summary to `retromulticiv-project.md`
  (facts: what landed, hash impacts, gotchas). If you have no memory
  access, end your report with a "suggested memory notes" section instead.
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

## A3 — Telemetry chart page

A static, dependency-free HTML page (e.g. `debugging/stats.html`) that
loads one or more soak `--stats` JSONL files via a file picker or
drag-drop and charts balance drift: per-seed city/tech/score curves per
civ across checkpoints, plus a summary table (eliminated %, stagnant %,
government mix). Canvas 2D — NO chart libraries (dependency whitelist).
Read `test/sim-driver.js` `snapshot()` for the row shape. Verify with
`debugging/screenshot.sh` against a generated JSONL. Client-only: no
hashes, no goldens.

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

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

## B-queue — AI bugfixer

Bugs and regressions. Same rules as A-items PLUS: before editing, mail
the architect the exact file list you intend to touch (bugs have no
pre-fenced lane) and wait for an ack if any file overlaps an in-flight
A-item. Fix format: failing test FIRST where feasible, then the fix,
then the standing checks.

### B0 — Standing: diagnostics triage (recurring, claim per file)

When a new recording lands in `debugging/logs/`: `node tools/replay.js
<file>` FIRST. Hash-exact + 0 errors = report "verified clean" with the
stats. Divergence or captured errors = bisect (the replay report
pinpoints the first bad entry; `?debug=1` recordings hash per command),
write the failing test, mail the architect the diagnosis BEFORE fixing
anything in engine/ (engine bugs usually need a golden-lock decision).
Server-mode stubs are non-replayable — use `saves/<gameId>.json`.

### B1 — Regression test: GoTo must survive a hotseat hand-off  [claimed: bugfixer 2026-07-13] [done: 2026-07-13 — browser.test.js case 6 + main.js ?e2e=3 (real 'g'+pick-path GoTos for BOTH players over p1→p2→p1→p2); both fix hunks revert-proven to fail independently (missing autoSelectAfterTurn ⇒ p1 leg 2 lost; missing owner filter ⇒ p2's route cancelled by p1's turn-start — caught via the extra half-round, positions alone can't see it); suite 160/160]

The architect's wave-III fix (client/ui/input.js: owner-filtered
runAllGotos + autoSelectAfterTurn on the human→human hand-off path)
shipped WITHOUT a regression test — write the test that would have
caught the original bug: in a 2-human game, player 1 issues a GoTo
spanning multiple turns, hands off, player 2 hands back, and player 1's
unit MUST have advanced along the route (and player 2's units must NOT
have moved during player 1's turn). This is client-side logic, so it
needs the browser e2e harness (test/browser.test.js — an ?e2e= variant
like the existing hotseat case; read main.js's e2e blocks). FILE CLAIM
REQUIRED first: browser.test.js + main.js e2e hooks may overlap
coder-helper's in-flight A13 — mail your exact file list and wait for
my ack. Test-only, golden-safe. Done-when: the new case fails if the
input.js fix is reverted (prove it: revert locally, watch it fail,
restore), suite green.

### B2 — Harden the 4-client LAN test against parallel-suite load

The helper observed test/server-lan4.test.js fail ONCE under the full
parallel suite (passes alone and on reruns) — 4 ws clients + ephemeral
server under parallel-file CPU load; 8s expect() timeouts are the likely
squeeze. Diagnose properly (don't just raise numbers blind: reproduce
under load, e.g. run the suite with the sim file concurrently), then
harden — longer/adaptive timeouts, or node:test concurrency hints, or
both. The test is the user's pre-LAN gate, so it must be trustworthy:
zero flakes across 10 consecutive full-suite runs = done. Architect's
file, claim granted in advance.

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

## A11 — Game verification code (design: docs/07-game-code.md — GREEN-LIT)  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — all 3 slices. S1: shared/gamecode.js (reverse-iter FNV codeHi + integer-limb base32; golden AD1X-Q5MR-DP7H9, codeLo=statehash anchor; architect-verified in Python) + gamecode.test.js. S2: client hooks — persistent code toast on save (screenshot-verified), load localStorage compare, hud game-over line, main.js error-overlay autosave code, handoff last-save line, server-mode Shift+S/D→/saves fetch. S3: server code in envelope+joined+{t:'code'} broadcast, remote session captures serverCode. Suite 144/144; golden-safe. NOTE: docs/07 DESIGN→IMPLEMENTED flip is docs/ (architect lane) — flagged. A9 shims now dead (filterView landed) — cleanup pending. +gameId-in-joined 404 fix (user turn-150 playtest): joined carries gameId, remote session adopts+persists it for the /saves fetch + localStorage keys; server test resumes non-default gameId 'itest'.]

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

## A12 — Phase-4 slice 1: server lobby (design: docs/08 §2, §6 — after A11)  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — server/lobby.js registry (5-char Crockford join codes, create/list/resolve, connection-scoped seat reservation, chart-authoring start per @e82e7068: lobby authors setup.players so bindSeat first-free lands the chart, names from reservations, unfilled/dropped→AI, register() wraps the phase-3 boot game); protocol.js create/list/start + join seat; index.js multi-game dispatch + per-game fan-out + start orchestration + disconnect→releaseSeat, phase-3 default-game preserved; session-remote join sends gameId only when known (fixes bare ?server=1 vs multi-game resolveId). Tests: lobby.test.js (7) + server-lobby.test.js integration (create→join-by-code→seat-pick→start→play, unfilled→AI); all 17 phase-3 server tests still green. Suite 157/157; golden-safe. Spectators + skip-vote deferred to A13 per @e82e7068.]

Multi-game server layer above the UNTOUCHED game.js: create/list/join/
start messages, games map keyed by gameId, 5-char Crockford join codes
derived from gameId, per-slot human/AI seat assignment (joiners fill
human seats in join order, `seat:"pN"` picks a free one, creator's
`{t:"start"}` flips unfilled human seats to AI and builds the engine
game), spectator pseudo-seats when `allowSpectators` (omniscient view =
explored-less player, never vote). Extend protocol.js + index.js; unit +
integration tests mirroring the phase-3 ones. Golden-safe. GATE: phase-3
acceptance declared by the user (human-workitems).

## A13 — Phase-4 slice 2: client lobby UI + turn flow (after A12)  [claimed: coder-helper 2026-07-12] [done: 2026-07-12 — boot path per @704be920: ui/lobby.js host/join flows inside the setup box (own ws, waiting room renders pushed roster, join-by-code + seat pick), persists token+gameId into session-remote's keys, reloads ?server=1&game=<id>; setup.js Host/Join LAN buttons + ?e2ehost e2e; browser case proves host→start→reload→named seat ("Kjell" in HUD). Turn flow: your-turn banner (2+ humans), presence broadcasts + waiting-for-<name> banner, host skipTurn + proposeSkip/vote >2/3 (server machinery + #mp-status controls; turnBroadcasts extracted so route/skip can't drift); spectator pseudo-seats server-side (omniscient, tokenless, voteless). session-remote +setMetaHandler/sendMeta. Screenshots: setup buttons + waiting room read. Suite 159/159; golden-safe. FLAGGED: spectator CLIENT UI needs its own read-only pass (server ready).]

Setup screen grows host/join modes (join-code field, seat picker,
waiting room); reuses session-remote unchanged. "Your turn" banner on
the turn broadcast; at-turn-disconnect "waiting for <name>" banner; the
skip-turn controls (host button; propose→vote >2/3 of connected human
seats excluding the at-turn player, docs/08 §6). Screenshot-verified;
browser test for the lobby boot path. Golden-safe.

## A14 — Art A1.6a: faction identity + status markers (spec: specs/plan-assets-2.md)  [claimed: coder-helper 2026-07-12] [done: 2026-07-13 — data/civs.json `visual` per civ (ally values, architect slot map, compact style preserved); new renderer/three/factions.js (14 canvas emblems in build order, CanvasTexture sRGB + data-URL caches, isLightColor thr=150 → exactly Ivory+Arctic get dark rims per ally table); assets.js token layer (bright/dim disc by moves, gold vet rim, fortified shield chip, dark rims) + pennants (primary flag + secondary emblem dot) on foot/mounted/siege/ships + cities, capitals fly CanvasTexture emblem flags; index.js setFactions + status threading + palace capital detect; main.js pid→visual map (fallback player.color for mock/lobby); emblem chips in setup + city header; gallery rebuilt 14×14 with the 14-civ × 5-terrain acceptance grid + ?cx/cy/zoom params, ally shot at debugging/gallery-factions-a14.png. Screenshots read: acceptance grid, close-up (emblems/rims/chips legible), game WebGL2+WebGL1. Suite 159/159; state/hash untouched (client-only). NOTE: city-header chip screenshot blocked by code toast overlay (same draw path as verified textures).]

The ally's "highest-return move". Client-only, golden-safe, NO golden lock.
1. Civ visual table: extend data/civs.json with `visual: {primary,
   secondary, emblem}` per civ — VALUES ARE AUTHORED by the designer ally
   in specs/civ-visuals.md (his acceptance criteria at the bottom are
   THIS ITEM'S acceptance criteria, incl. the 14-civs-side-by-side
   gallery row on 5 terrains + colorblind checks + dark rims for light
   civs). Architect's slot->civ mapping (swappable data, not gospel):
   romans=Crimson Sun, english=Azure Wave, aztecs=Emerald Oak,
   chinese=Imperial Violet, babylonians=Amber Wheel, germans=Iron
   Mountain, americans=Teal Chevron, zulus=Umber Hammer, egyptians=Ivory
   Tower, french=Rose Diamond, greeks=Cobalt Crescent, indians=Olive
   Spiral, russians=Maroon Flame, mongols=Arctic Rune. Client-side only consumption; player.color in STATE stays
   untouched (hash-safe) — the visual table is looked up by player.civ,
   falling back to player.color for civ-less test states.
2. Pennant flags (pole+plane+emblem primitives, DoubleSide) on every city
   and on unit banners; CanvasTexture 64x64 emblem flags for capitals +
   the setup screen + city-view header (sRGBColorSpace, r162-safe).
3. Status markers on the unit token layer: veteran = thin gold base rim,
   fortified = small shield chip, moved-out = dimmer base disc,
   still-can-move = brighter. (Selected ring + GoTo route already exist.)
4. Keep the ally's visual hierarchy: ownership/type > infrastructure >
   terrain > decoration. Use visualRand(x,y,salt) for ALL placement
   jitter (our existing convention — NOT his worldSeed formula; ours is
   already save-stable and state-free).
Verify: gallery screenshot (it must show flags/markers per silhouette),
game screenshots WebGL2 + WebGL1 pass, browser e2e stays green.

## A15 — Art A1.6b: water, coastline, materials, terrain patterns (same spec)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — PRE-STEP: props seam split to renderer/three/props.js (assets 315/props 157, gallery BYTE-IDENTICAL post-move). Water: translucent Phong plane at WATER_LEVEL=-0.02 (depth-graded shallows for free over the ramped basin), foam strips per shore edge (instanced, fog-dimmed), band-texture drift in the render loop (RENDER TIME ONLY); ship-height bug found via screenshot read + fixed (naval units now ride the surface — discs were submerged/washed out). Mottle: ONE shared low-contrast world-planar CanvasTexture multiplied into terrain face colors (uv attr added) — DEVIATION: per-terrain pattern set simplified to shared mottle, flagged. Infrastructure: rail cross-ties, mine entrance+timber lintel, irrigation field patches. Grid readability kept (foam reinforces coasts). Exhibits debugging/gallery-water-a15.png; game WebGL2+WebGL1 read. Suite 162/162 (one lan4 flake under load — not mine, passes alone+rerun, flagged).]

PRE-STEP (from A14's size flag): assets.js sits at 466 lines, over the
~450 soft ceiling — split the tile-props seam FIRST (createTileProps +
PROP_GEO into renderer/three/props.js, mirroring the factions.js split)
before adding water/coastline geometry. Auto-discovered by the ESM
check; screenshot gallery after the move to prove nothing shifted.

1. Water pass: Phong water slightly transparent, shallow-band along
   coasts, foam strips at land borders, texture-offset wave drift driven
   by RENDER TIME ONLY (never simulation state).
2. Low-contrast CanvasTexture terrain patterns (grass flecks, dune
   streaks, rock mottle, snow speckle) from a local seeded generator.
3. Infrastructure upgrades: railroad cross-ties, mine entrance + timber,
   irrigation field patches + channel. Roads/rivers keep connecting to
   neighbors (already do).
4. Do NOT hide tile boundaries — grid-readability beats realism (ally's
   own caution).
Same verification loop as A14. A1.7 (sway/interpolation/smoke/combat
flashes + reduce-animation option) is NOTED for later — not queued.

## A17 — Spectator client mode (small; server side already tested)

A13's honest gap: a spectator join today would crash UI reads of
players[ctx.HUMAN]. Add a deliberate read-only client mode: join with
{spectator:true} from the lobby UI (visible only on allowSpectators
games), ctx.HUMAN stays a pseudo-viewer — hide the action bar/End Turn/
production interactions, show a "spectating" chip, render the omniscient
view the server already sends. Golden-safe, client-only. Verify by
screenshot with a live server.

## A16 — Playtest wave III client refinements (AFTER A13 — collision-fenced)  [claimed: coder-helper 2026-07-13]

From the user's hotseat acceptance playtest (2026-07-12). All client-only,
golden-safe. The GoTo-across-hand-offs bug and the engine items (city
square roaded+irrigated, starts ≥3 from edges) are ALREADY FIXED by the
architect — do not redo them.

1. Combat linger: after a combat resolves involving the viewer's unit,
   keep the camera at the battle site (center on it) and SUPPRESS
   autoNextUnit for that action — the player wants to see the outcome.
   A short highlight on the surviving/lost tile is a bonus.
2. City view: center the fat-cross mini-map horizontally in #city-left
   (it currently hugs the left edge). ALSO catch the display up to the
   new engine rule: the mini-map center tile and the settler site
   preview must show the city square as roaded+irrigated (workedTiles
   already returns the right yields — use its center entry instead of
   raw tileYields where applicable).
3. Hand-off centering, full version: remember lastMoved PER PLAYER
   (sel.lastMovedBy[pid] or similar) so an incoming hotseat player lands
   on THEIR last-moved unit; fall back to their capital (capitalOf), then
   any unit. (Architect's goto fix already lands on *a* unit — this is
   the polish.)
4. New key: center on capital. 'C' when NO city is selected (C with a
   city selected keeps cycling production); fall back note in the help
   panel + gettingstarted.
Verify: screenshots incl. a hotseat hand-off sequence; browser e2e green.

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

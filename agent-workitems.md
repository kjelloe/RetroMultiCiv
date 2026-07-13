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
   (currently 188 tests), the item's own verification steps pass, related
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

### B2 — Harden the 4-client LAN test against parallel-suite load  [claimed: bugfixer 2026-07-13] [done: 2026-07-13 — diagnosed under real load: no logic race; 6-10x contention multiplier measured (0.24s isolated vs 1.3-2.5s across 10 full-suite runs, 16 parallel files + chromium children), so the 8s expect budget was a tail-risk squeeze. Hardened: 30s budget + timeout errors now dump the unmatched inbox (future stalls self-diagnose). Acceptance: 10 consecutive full-suite runs pre-fix AND 10 post-fix, 20x zero flakes, 180/180]

The helper observed test/server-lan4.test.js fail ONCE under the full
parallel suite (passes alone and on reruns) — 4 ws clients + ephemeral
server under parallel-file CPU load; 8s expect() timeouts are the likely
squeeze. Diagnose properly (don't just raise numbers blind: reproduce
under load, e.g. run the suite with the sim file concurrently), then
harden — longer/adaptive timeouts, or node:test concurrency hints, or
both. The test is the user's pre-LAN gate, so it must be trustworthy:
zero flakes across 10 consecutive full-suite runs = done. Architect's
file, claim granted in advance.

### B3 — LAN research crash: rival playerId reaches tech.js researchCost (wave V bug 0)  [claimed: bugfixer 2026-07-13] [done: 2026-07-13 — root cause was neither triage suspect: all researchCost callers pass ctx.HUMAN, but input.js endTurn's HOTSEAT branch had no local-session guard, so a 2-human LAN turn-pass dropped the curtain on the wrong machine and setHuman(rival) flipped ctx.HUMAN — rival view entries carry no techs → tech.js:13. One guard (session.playerId === undefined = local only); engine untouched. Failing-first browser case 7 (?e2e=4, single browser + unbound p2 seat) red→green; local hotseat cases still green; suite 181/181]

User report (LAN game, 2 humans + 2 AI): clicking research selection →
`TypeError: state.players[playerId].techs is undefined (tech.js:13)`.
ARCHITECT TRIAGE DONE (2026-07-13): the recording
`debugging/logs/retromulticiv-g3.json` replays HASH-EXACT (engine
innocent — canonical state has `techs: []` on all four players);
`filterView` DOES whitelist the viewer's own techs
(engine/visibility.js:127); therefore some client path passes a
NON-VIEWER playerId (rival entries carry no techs in server-mode
views — correct secrecy). tech.js:13 is `researchCost`. Suspects:
any caller using `state.activePlayer` instead of `ctx.HUMAN` while a
rival is at turn, or turnlog narration computing costs for a rival's
techDiscovered event. Repro guidance: boot a 2-human lobby game (g3's
shape), open the research UI as the NOT-at-turn player. Failing test
first (browser e2e ?server=1 variant or a targeted unit test on the
offending module), then fix — likely a one-line playerId correction
or a guard. Golden-safe (views are never hashed). If the right fix
turns out to be defensive (`availableTechs`/`researchCost` returning
empty/0 for tech-less entries), mail me first — I'd rather fix the
CALLER and keep the engine strict.

### B4 — Sweep: inert `classList.add('hidden')` calls (from A26's bonus find)

The helper proved `.hidden` has NEVER been a global CSS rule in
style.css — only per-element rules (`.panel.hidden` etc.) exist, so any
`classList` use of 'hidden' on an element WITHOUT a matching scoped
rule silently does nothing (his A23 setup toggles were inert until a
`#setup-box .hidden` rule landed). Mechanical sweep: grep every
`'hidden'` classList/className site in client/, check each element has
a covering CSS rule, fix the gaps (scoped rules preferred over a
global one — a global `.hidden` could surprise three.js overlay
stacking; decide per case and note it). For each fix: screenshot
before/after (the before should show the element wrongly visible).
Also consider the durable guard: a client-syntax-style test that
extracts hidden-toggled ids from JS and asserts a matching CSS
selector exists — flag feasibility in the done-mail rather than
forcing it. Golden-safe.

### B5 — Turn log misses rival-vs-rival / AI combat in server games (wave VI bug)

User report (LAN, turn 41): Babylonians (AI) attacked a militia — no
turn-log entry on the human's machine. ARCHITECT PRE-TRIAGE: the save
`debugging/logs/retromulticiv-g3-turn53.json` replays HASH-EXACT
(engine + log integrity fine — this is a client/broadcast gap).
Suspect: in LOCAL games the session collects events from every AI
turn and turnlog narrates them; in SERVER games clients receive
turn/view broadcasts — check whether `turnBroadcasts`/the view push
carries the round's EVENTS at all, and if it does, whether the remote
session forwards them to turnlog. Combat "that touches the player"
must reach every human's log (visibility rule: only narrate what the
viewer could SEE — an attack on/by your units or inside your explored
map; don't leak fog). Failing test first (extend a server test:
AI-vs-AI combat near p1's units ⇒ p1's client receives the event;
or the lan4 pattern). If the fix needs the protocol to carry filtered
per-seat events, mail me the shape BEFORE implementing — protocol
changes are design-reviewed.

### B6 — Server-save banner ✕ does nothing (wave VI.8)

The "Saved turn N — game code …" banner's ✕ doesn't dismiss. Two
suspect classes, check both: (a) the B4 family — an inert `.hidden`
with no scoped CSS rule; (b) the banner is re-shown every autosave
broadcast (each accepted command autosaves — the ✕ works but the next
broadcast instantly re-shows it; if so the fix is show-once-per-turn
or per-SAVE-code-change, not per broadcast). Failing test or
screenshot-proof both directions. Coordinate with A33 (save code into
the turn log) — same broadcast, complementary fixes.

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

## A2 — Chaos layer: next command batch  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — all backlog kinds on the chaos stream (setProduction w/ always-legal basics pool, moveUnit walks, foundCity window-detection + settler-breeding + outward-walk shaping, startWork w/ transform bias, setGovernment communism, setWorkers taxmen/scientists) + driver save/load hash round-trip at checkpoints + opts.chaosRate probe knob (default 6 unchanged). INJECTION MOVED PRE-AI per @9ba56f30 (fresh moves; replay.js airound reordered, dated comment; client Shift+D recordings write NO airound entries — no-op confirmed; pre-2026-07-13 sim artifacts don't replay). Probe (60t, rate 2, 3 seeds): ALL new types applied incl. foundCity. Fresh 80-round artifact (47 chaos entries) replays hash-exact; 10-seed soak clean; goldens re-recorded: soak {100:0x811a85c1, 200:0x0f345b0d, 300:0x7721ce77, 400:0xcbff6f34}, natural UNCHANGED {305,p4,0xa159b643} (chaos-off run — proves the change is chaos-scoped). Suite 163/163. Lock retained for A21 per @337cac89.]

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

## A17 — Spectator client mode (small; server side already tested)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — ?spectate=1 boots a tokenless viewer (session-remote spectator opt: join {spectator:true}, no token persist/reclaim); lobby join form Spectate checkbox (+spectatorsOff/notStarted texts) + host form Allow-spectators checkbox; boot game allows spectators by default with --no-spectators CLI switch (register() gained the flag — docs/08 §6 host control); read-only guards: hud research bar "👁 spectating" + spectator gov line, endTurn early-return, toggleResearchPanel block, firstUnit guard, End Turn hidden, 👁 chip, camera opens on world center (own-nothing case caught by screenshot read). Live-server screenshot: full omniscient map, no fog, chip+HUD+bar correct. Suite 163/163.]

A13's honest gap: a spectator join today would crash UI reads of
players[ctx.HUMAN]. Add a deliberate read-only client mode: join with
{spectator:true} from the lobby UI (visible only on allowSpectators
games), ctx.HUMAN stays a pseudo-viewer — hide the action bar/End Turn/
production interactions, show a "spectating" chip, render the omniscient
view the server already sends. Golden-safe, client-only. Verify by
screenshot with a live server.

## A16 — Playtest wave III client refinements (AFTER A13 — collision-fenced)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — (1) combat linger: apply() centers on combatResolved x/y when the viewer's involved + one-shot autoNextUnit suppression; (2) mini-map centered (justify-content) + center tile now DISPLAYS worked[0].yields (roaded+irrigated rule — screenshot shows 2/1/1 on plains) + sitePreview center synthesizes road+irrigation(mine-kept) mirroring engine/cities.js; (3) sel.lastMoved → sel.lastMovedBy[pid], setHuman lands on THEIR unit → capitalOf → first unit (selectFirstUnit gained noCenter); (4) C with no city → fly to capital (capitalOf city object) + help-panel entry — NOTE: no 'gettingstarted' doc exists anywhere, help panel got the note. Screenshots read (city panel, hand-off cover); suite 163/163 incl. B1's GoTo-handoff case through the rewired landing. Combat linger + capital key are suite/logic-verified, not visually (static shots can't show them).]

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

## A21 — Civ-1-style variable year curve (user-approved 2026-07-13 — DO FIRST after A2, golden lock stays with you)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — rules.json yearSteps (exact item table); engine nextYear() pure helper (exported; flat-+20 fallback keeps table-less crafted rulesets stable) wired into endTurn; test/year.test.js pins ALL landmarks exactly in wrap-count terms (60→1000BC, 100→1AD, 150→1000, 200→1500, 270→1850, 395→2100) + fallback + runaway guard; sim-driver year invariant now checks against nextYear (not +20); natural leg bound 320→399; score.test crafted year 2090→2099; all 11 scenarios green unchanged (none pins a hash across a wrap). MEASURED GAME END: round 395 (winner p2) < 400 budget ✓. Goldens: soak {100:0x98c538fa, 200:0x7f0ad127, 300:0x92aefa7c, 400:0x9fde1a68}, natural {395, p2, 0x602ffea7}. docs/01 §1+§11 updated per item grant. 3-seed soak clean; suite 166/166. LOCK RELEASED.]

The engine's own declared TODO (`engine/index.js` endTurn: "placeholder
step; era-based steps come with data/rules.json"). Replace the flat
+20yr/turn with a bracket table in `data/rules.json` (hand-curated):

```json
"yearSteps": [
  { "until": -1000, "step": 50 },
  { "until": 0,     "step": 25 },
  { "until": 1000,  "step": 20 },
  { "until": 1500,  "step": 10 },
  { "until": 1850,  "step": 5  },
  { "until": 2100,  "step": 2  }
]
```

Semantics: on turn wrap, add the `step` of the FIRST bracket with
`state.year < until`; past the last bracket keep its step (runaway
guard). Integer math, plain array scan — Lua-portable. Landmark turns
this table produces (unit-test these exactly): turn 60 = 1000 BC,
turn 100 = 1 AD boundary (year 0), turn 150 = 1000 AD, turn 200 =
1500, turn 270 = 1850, and the 2100 AD score-end lands at turn ~395 —
DELIBERATELY under the sim harness's 400-round budget so the soak
`--natural` leg and the 400-checkpoint keep working; if you adjust the
brackets, keep game end < 400.

Consequences you own in this item: GOLDEN_SOAK/GOLDEN_NATURAL re-record
(you hold the lock — natural's turn/winner will move from {305, p4}),
plus any `test/scenarios/*.json` whose hash shifts (scenarios that end
turns see different years — rule 4 process). docs/01 gets the year
table. Done-mail: new goldens, the measured game-end turn, and a
15-word year-curve line for plan-update that I'll place.

Verify: landmark unit test; full suite green after re-records; one
sim smoke (`node tools/soak.js --seeds 3`) green.

## A18 — Production catalog: one-tech look-ahead (wave IV.1 — client-only, golden-safe)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — frontier filter in panels.js: locked items survive iff their tech ∈ availableTechs (the existing engine frontier helper — pure, reused as the item wanted); grey styling/"needs X"/byTechLevel kept. Fresh Roman start: locked shrinks to cavalry/chariot/phalanx + city-walls/granary/palace/temple + colossus/great-wall/hanging-gardens/pyramids; 56 deeper items hidden (armor/battleship/nuclear gone from 4000 BC). Screenshot read; suite 166/166.]

User request: the city production catalog currently greys out EVERY
tech-locked unit/building/wonder — tanks visible in 4000 BC. Filter the
locked lists (`client/ui/panels.js` ~line 431: `lockedUnits`,
`lockedBuildings`, `lockedWonders`) to the RESEARCH FRONTIER only:
a locked item stays visible iff its unlocking tech has ALL of its
prerequisites already in `me.techs` (i.e. the player could pick that
tech as their next research — this includes whatever they are
researching now). Everything deeper is hidden entirely; as each tech
lands, the frontier advances and the next ring appears. Items with
`tech: ""` are always visible (unchanged). Keep the grey styling,
"requires X" label, and `byTechLevel` sort for the survivors.

Put the frontier predicate in a small pure helper (it only needs
`me.techs` + `ruleset.techs`) so the next-tech UI can reuse it.
Verify: browser e2e green; screenshot a fresh-start city panel (should
show only ancient-adjacent locked items — READ it) and note in the
done-mail which items disappeared for a seed-12345 Roman start.

## A19 — Movement affordance arrow on hover (wave IV.3 — client-only, golden-safe)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — client/ui/move-hints.js (37 lines): pure canStepTo/stepDir (adjacent + moves>0 + terrain.domain===unit.domain per engine/movement.js + no enemy = red ring unchanged; wrapX handled); test/move-hints.test.js 4 cases (land→ocean, ship→land, zero moves/non-adjacent/enemy/off-map, x-wrap). Renderer setHoverArrow(dir|null): cone on the hover ring, YXZ yaw table, hides with the ring. input.js onHover wires it. ?hoverdemo=1&hoverdx/dy deterministic screenshot hook in main.js. Shots READ: E-neighbor arrow points into the tile; own-tile hover correctly arrowless; WebGL1 identical. Suite 170/170.]

User request: with a unit selected that has moves left, hovering an
ADJACENT tile the unit could enter should show a small arrow (the
"click will move here" affordance). Today the hover marker is a ring
that turns red for attacks (`input.js` ~555, `renderer.setHoverColor`).

v1 scope: adjacent tiles only (GoTo already covers long routes with its
planned-route drawing). Show the arrow when: a unit is selected AND
`unit.moves > 0` AND the hovered tile is one of `neighbors()` AND the
terrain domain admits the unit (land/sea/ice rules — use the ruleset
tables, do NOT invent cost math) AND it's not an enemy-occupied tile
(that stays the red attack ring, unchanged). Renderer: add a small
direction arrow to the hover marker (rotate toward the step direction;
`renderer/three/index.js` owns the hoverMarker — new
`setHoverArrow(dir|null)` alongside `setHoverColor`). Keep the
legality predicate in a pure helper module so Node can unit-test it
(state+ruleset in, boolean out — cover land unit vs ocean, ship vs
land, ice wall, zero moves, enemy tile cases).

Verify: pure-helper unit test in Node; for the visual, dispatch a
synthetic mousemove in the e2e page (CDP or page script) and screenshot
— if that turns out flaky, a `?hoverdemo=1`-style debug param that
forces the marker to a fixed adjacent tile is an acceptable stand-in.
READ the screenshot: arrow visible, pointing from unit to tile.

## A20 — Starting-age setup via AI fast-forward (wave IV.2 — design below, golden-safe)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — TECH_ERAS overlay in mapdata (user's attested table @5f97c2b5, exactly-once + unknown-name guards, "RailRoad"/"Future Tech" quirks handled) → techs.json regenerated (+68 era lines ONLY); rules.json ages block (turns = PROPOSED year anchors) + space "except": ["future-tech"] (data-driven); shared/fastforward.js: createFastForward stepper (browser chunking) + fastForwardTo + applyAgeGrant (sorted union, researching ''/bulbs 0, identical per civ); main.js ?age boot w/ chunked progress + abort-names-the-civ UX; setup dropdown from rules.json + &age param; server: lobby create validates age, start() runs ff (all-AI world → grant → chart humans flipped), game.js opts.initialState. Tests: 6 (era guard 22/15/14/17, double-run hash determinism, grant union/reset, space-except 67, abort seed-42, ancient no-op). Verified: Renaissance browser boot READ (turn 190 · 1390 AD · Monarchy · cities/roads/garrisons/285g); server create+age → joined turn 190/22 techs/researching "". Suite 176/176; goldens untouched (unread optional keys). Wave IV complete.]

User request: the setup screen asks for a starting age (Ancient → Space
age). Any age past Ancient means: create the world, let ALL civs play
as AI up to that age's suggested turn, then the humans take over their
chosen civs and play on from there. No engine changes — this reuses the
public engine API the way `test/sim-driver.js` and session AI-drive do.

Design (architect, 2026-07-13, rev 2 after measurement — questions by
mail before deviating):

MEASURED FACT that shapes this design (6 seeds × full AI games,
2026-07-13): the game ends by score at turn ~305 (flat +20yr/turn
placeholder reaches endYear 2100), and AI civs research only 9–15 of
68 techs by then — they NEVER leave the Ancient era. So a later-age
start CANNOT come from simulation alone; it is fast-forward (for the
world: cities, borders, improvements) PLUS a deterministic TECH GRANT
(for the era: every civ receives the cumulative techs of all prior
ages at takeover — the Civ-series convention for late starts).

- **Era buckets on techs**: the user supplied a Civ2-derived era
  mapping covering all 68 advances exactly once (architect holds the
  table — ancient 22 / renaissance 15 (Religion stands in for
  Theology) / industrial 14 / modern 17; ask by mail and I'll paste
  it). techs.json is GENERATED, so the buckets go in a `TECH_OVERLAY`
  era field in `tools/mapdata.js` → regenerate — never hand-edit the
  JSON. New optional field = no engine reads = golden-safe; confirm
  with the suite.
- **Ages table** in `data/rules.json` (hand-curated — mapdata does not
  own it): `"ages": [{ "id", "name", "turn", "grantEras": [...] }]`.
  Five entries, turns anchored to historical years via A21's approved
  curve (A21 lands FIRST; user-tunable in data): Ancient 0 (no grant,
  today's behavior), Renaissance 190 (≈1400 AD, grant ancient),
  Industrial 256 (≈1780, +renaissance), Modern 305 (≈1920,
  +industrial), Space Age 325 (≈1960, grant everything except Future
  Tech — "only the space race remains"; NOTE the spaceship system
  itself is phase 6+, so a Space Age start plays for score/conquest
  until then — the user knows). Game ends ≈turn 395, so even a Space
  Age start leaves ~70 turns.
- **Mechanism**: build the setup's player list with the SAME civs/names
  but `human: false` on every seat → `createGame` → drive full AI
  rounds (`runAiTurn` + endTurn, exactly the session loop) until
  `state.turn` reaches the age's turn → apply the tech grant to EVERY
  player (pure function in the shared helper: techs = union of
  `grantEras` buckets, `researching` reset to '' — the player picks —
  `bulbs` 0; identical grant for all civs, fairness) → flip
  `human: true` on the seats the setup chose → hand the state to the
  normal boot path AS THE INITIAL STATE (identical to the load-a-save
  path, so the diagnostics recording starts at the takeover point and
  `tools/replay.js` needs nothing new). Deterministic: same seed + age
  ⇒ same world and same grant, always.
- **Ordering**: A21 (year curve, LANDED 2026-07-13) came first — the
  age turns above assume its brackets. If A21's table gets tuned,
  re-derive these turns from the year anchors (1400/1780/1920/1960 AD),
  not the other way around. NOTE (A21's off-by-one flag): the age
  `turn` field means STATE.TURN at takeover (a turn-1 start makes
  state.turn = wraps + 1), so year anchors are ~1 turn approximate —
  by design, don't chase exactness.
- **Placement**: the fast-forward loop goes in `shared/` (ESM, runs in
  browser and Node; importing engine from shared is fine — engine
  itself imports nothing back). Client setup screen gains the Starting
  age dropdown (default Ancient = today's behavior, zero fast-forward);
  show progress ("simulating history… turn N/T", chunked via
  setTimeout so the tab stays alive). Server: plumb the option through
  create so LAN lobbies inherit it (Node runs the same loop at create;
  flag by mail if that plumbing balloons and we'll split it out).
- **Edge cases, decided**: if a to-be-human civ is eliminated (or the
  game ends) during the fast-forward, ABORT with a friendly message
  naming the dead civ and suggesting another seed/age/civ — never
  silently re-roll seeds (determinism UX). Difficulty applies during
  the fast-forward like any AI game. `?age=<id>` URL param joins the
  existing setup params.

Golden-safety: no engine/ or data edits beyond the NEW ages block
(new optional rules key = no hash movement — goldens don't read it),
so no re-record and no lock needed — but confirm the full suite agrees.
Verify: unit test on the fast-forward helper (seeded, fixed turn target,
assert turn + a stable statehash twice = deterministic; assert every
player's techs equal the grant union and researching is ''); browser
screenshot of a Renaissance-or-later start (cities/roads visible at
boot — READ it); one `?server=1` create with an age option.

## A22 — Server URL routing: / and /client → /client/ (wave V.1+2, tiny)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — 302s for / and /client (exact) → /client/ with query preserved; asserted in server.test.js static case (Location headers, ?server=1&game=g7 round-trips). Suite spot: server tests 2/2.]

`http://<host>:8123` 404s and `/client` (no trailing slash) serves the
client HTML with broken relative paths (assets resolve against `/`).
In server/index.js's static handler: `/` → 302 to `/client/`;
`/client` (exact, no slash) → 302 to `/client/` (preserve the query
string — join links carry params). Add both cases to the server tests
(a plain http GET asserting the Location header). Golden-safe.

## A23 — Setup screen: hotseat is a checkbox, not a label (wave V.3)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — label "(hotseat)" dropped; humans>1 reveals "Enable hotseat game" (default OFF) + a mode hint; checked → button "Start hotseat game" (today's ?humans=N flow); unchecked+multi → button "Host LAN game" and Start ROUTES to startHostFlow (extra humans = lobby seats). ?humans=N URLs unchanged (saved links stay hotseat). ?setupdemo=lan|hotseat screenshot hook; both states shot + READ. Cosmetic note: primary Host button duplicates the secondary in LAN state. Suite 180/180 via debugging/t.sh.]

"Human players (hotseat)" misleads LAN hosts — humans ≠ hotseat now.
In client/ui/setup.js: drop "(hotseat)" from the label; when humans >
1, reveal a checkbox "Enable hotseat game" (default OFF); when
checked, the Start button text becomes "Start hotseat game". Semantics:
hotseat checked = today's local multi-human flow (?humans=N); NOT
checked with humans > 1 = the LAN hosting flow (the extra humans are
seats to fill in the lobby). Keep URL-param behavior compatible
(?humans=N alone still means hotseat for saved links — document in the
item done-mail if you deviate). Screenshot both states. Golden-safe.

## A24 — Lobby games must assign civilizations (wave V.5 — the "New city 1" fix)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — lobby.start() assigns DISTINCT seed-shuffled civs (main.js's exact LCG — a seed reproduces the lineup), colors from the civ, AI seats take civ names, humans keep theirs; joined replies (route + lobby-start + spectator) carry a pid→civ map (protocol.js playerCivs — cleaner filterView home FLAGGED); session-remote exposes it; main.js wires cityNamesByPlayer + factionsByPid in server mode. ws test asserts distinct civs/civ colors/AI civ names; spectator screenshot of a started lobby game shows faction discs (Imperial Violet + Emerald Oak, not palette colors). Suite 180/180.]

PROVEN by the user's g3 save: `lobby.start()` (server/lobby.js:135)
authors players WITHOUT a `civ` field → no civilization city names
("New city 1"), no faction visuals, generic colors — every LAN game.
Fix in start(): assign each slot a DISTINCT civ from data/civs.json —
seed-shuffled like client/main.js's local roster (deterministic from
the game seed; the chart is authored once so downstream determinism
holds either way), and take each player's `color` from the civ's
`color` field (matching local games; factionsByPid then lights up
pennants/emblems too — verify a lobby game shows them). Slot-picked
civs come later with A27 — this item is the RANDOM default. Verify:
extend a lobby/server test to assert distinct civ ids + civ-roster
city names appear after start; browser screenshot of a lobby game
showing a real city name + faction colors. Golden-safe.

## A25 — Turn banners: dismiss + suppress (wave V.6)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — hud.turnBanner: ✕ dismiss + 🔕 mute (pointerdown+stopPropagation, the no-moves-hint pattern; buttons survive because centerBanner.show's textContent reset clears them each show); mute = Options "muteTurnBanner" checkbox, persisted with the other prefs; NEW soft two-note WebAudio chime (osc 660→880Hz, try/catch for pre-gesture autoplay) obeying the same mute; lobby initMultiplayerFlow calls turnBanner. ?bannerdemo=1 hook (interval-refired — 5s transient expired under virtual-time before the first shot caught it). V.6 REGRESSION NET: new browser case on the B3 topology — rival at turn ⇒ "⏳ Player 2 is moving · Ns" wait-line present AND no 🔔 banner on the waiting machine. Screenshots read (banner+controls; Options entry in panel). Suite 187/187.]

The 🔔 "Player N — take your turn" banners can't be dismissed. Add an
✕ on the banner (dismiss this one) and a mute icon (suppress future
your-turn banners for this session; persist per-origin in
localStorage next to the other client prefs; re-enable via ⚙ Options,
where the setting also lives as a checkbox). The audio chime obeys the
same suppress. Screenshot banner-with-controls + the Options entry.
Golden-safe.

## A26 — Waiting-for-player status + slow-poke log note (wave V.7)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — client/ui/wait-status.js pure tracker (reset per turn change, note fires ONCE per player-turn, threshold live-changeable, 0=off) + 5 unit tests; hud #wait-line above End Turn (1s tick + immediate on refresh; server-mode only via session.gameId; hidden on own turn/game over); Options "Slow player note, seconds" (default 30); turnlog gained the ACKed additive note() export (reuses add — same list/cap). Screenshot READ: "⏳ Player 1 is moving · 5s" via spectator topology. BONUS FIX found by screenshot read: .hidden was per-element CSS, never global — my A23 setup rows + the residue Host-button toggle silently didn't hide; scoped #setup-box .hidden rule added, all three setup states re-shot correct (residue follow-up folded ✓). Suite 186/186.]

In server games, above End Turn show a calm one-liner: "⏳ <name> is
moving · 12s" — name = state.players[state.activePlayer].name, timer
starts when a turn/view message hands the turn to someone else and
resets on every turn change. When the wait crosses a threshold
(default 30s, configurable in ⚙ Options as "slow player note,
seconds"), add ONE turn-log entry "Waited 47s for Player 2" (per
player-turn, not per second; client-side only — the log is local
narration, nothing enters game state). Verify: unit-test the timer
formatting/threshold logic as a pure helper; screenshot the line in a
2-human lobby game. Golden-safe.

## A27 — Lobby seat management: host controls (wave V.4 — DESIGN INCLUDED)  [claimed: coder-helper 2026-07-13] [done: 2026-07-13 — registry setSlot (mode open↔ai NO-KICK per @3b520ebc: reserved seats reject 'seatReserved'; civ picks allowed anywhere, '' = Random, civTaken/noSuchCiv validated) + setSlots resize 2..7 (grow=Open slots, shrink rejects past reserved tails); start() honors picks — shuffle fills only Randoms (pool excludes picked); roster carries mode+civ; protocol setSlot/setSlots shapes + host-only routing (notCreator) + live broadcastLobby. Client: host waiting room = interactive rows (mode toggle on unreserved only, per-slot civ dropdowns with each-civ-once filtering, − N + resize) + host form gained size/age selects (item d); joiners see edits live read-only; friendly seatReserved/civTaken texts; ?e2ejoin=CODE hook. Integration test: auth reject, empty-patch badShape, KICK BLOCKED + occupant joins started game on her seat (ruling requirement), dupe-civ reject, resize both ways, start honors AI-flip + Romans pick with distinct civs. Screenshots read: host view (controls) + joiner view (live 'p3 · AI · Romans'). Suite 188/188. NOTE for docs/08 §6 sync: no-kick is POLICY. Wave V complete.]

Host-side lobby power before start: (a) per-slot toggle AI ↔ Open
(open = joinable by humans; AI = locked to AI even if someone joins
late); (b) add/remove slots within 2..7 civs while waiting; (c)
per-slot civ dropdown (each civ once, plus Random — Random resolves
via A24's seed-shuffle at start); (d) expose map size + starting age
on the host form itself (they exist in options already — surface
them, so hosting doesn't require the setup-screen detour). Joiners
see the slot list update live (the lobby already broadcasts roster
changes — extend the message with slot mode + civ pick). Protocol:
new host-only `{t:'setSlot', seat, mode|civ}` and `{t:'setSlots',
civs}` messages — host-auth = the connection that created the lobby
(the reservation already knows), reject from others (add protocol
tests). PER-SLOT DIFFICULTY: NOT in this item — the engine reads one
global rules.contentCitizens; a per-player override
(player.contentCitizens ?? rules) is an ENGINE change (golden lock,
happiness.js) — parked in docs/04 as a phase-6 candidate; the item
only leaves room in the slot UI layout for a future difficulty cell.
Verify: protocol tests for setSlot auth/validation; a lan4-style
integration case where the host flips a slot to AI + picks a civ and
the started game honors both; screenshots of host vs joiner lobby
views. Golden-safe.

## A28 — Art A1.7: animation polish (ally spec §"Art A1.7", golden-safe, pulled forward 2026-07-13)  [claimed: coder-helper 2026-07-14]

The ally's final procedural-art stage, from `specs/plan-assets-2.md`
(verbatim line: flag bob/sway from render time only; unit movement
interpolation; small city smoke; water texture scrolling [already done
in A15]; combat flashes with a "reduce animation" option — none may
change simulation, command timing, save data, fog, or replay hashes).

HARD RULE, same as A15's wave drift: ALL motion is render-time only —
derive phases from clock + position (like the water drift), never from
engine RNG or state; nothing new enters game state. Slices:
1. Flag/pennant sway — subtle vertex or rotation bob on the capital
   flags + unit pennants.
2. Movement interpolation — units GLIDE between tiles (~150–250ms
   render-layer tween). The renderer owns display positions; the
   simulation position updates instantly as today, and CLICK HITBOXES/
   selection must track the LOGICAL tile, not the tween — test that a
   click mid-glide selects correctly (e2e can click immediately after
   a move command). GoTo multi-step should chain tweens without drift.
3. City smoke — tiny particle/billboard wisps on larger cities,
   deterministic placement (visualRand pattern), animated by clock.
4. Combat flash — a brief render-only flash at combatResolved x/y
   (pairs with A16's camera linger; event-driven, no state).
5. **"Reduce animation" option** in ⚙ (single checkbox disables sway/
   smoke/flashes AND makes movement instant — accessibility; persist
   with the other prefs).
Verify: browser e2e green (incl. the mid-glide click case); WebGL1
pass; screenshots for static evidence + honest notes on what only
eyeballs can judge (motion); gallery must stay byte-stable for
untouched assets — flag any regeneration. Suite + goldens untouched
(render-only — the suite proves it).

## A29 — Wave VI quick wins: HUD civ, GoTo flush, End-Turn states, two UI fixes (VI.1/4/6/10/12)

Five small client-only items, one claim:
1. **HUD civ (VI.1)**: the status line shows the viewer's CIVILIZATION
   (e.g. "… · Romans (Kjell) · Monarchy") — player.civ via ruleset/
   playerCivs; falls back to the name alone when civ is absent (mock).
2. **GoTo flush before the idle warning (VI.4)**: when End Turn finds
   units with pending GoTo orders AND moves, run runAllGotos for the
   viewer FIRST, then re-evaluate the idle-units warning — players
   shouldn't be nagged about units that had standing orders.
3. **End-Turn button states (VI.6)**: server/hotseat games — GREYED
   (disabled look + no-op) when it's not your turn; when your turn
   ARRIVES, a brief yellow pulse (CSS animation, 2–3 blinks) then
   normal. Respects reduce-animation (A28) if it lands first — no
   pulse, just the state change.
4. **Rate-slider snapback (VI.10)**: when the engine caps tax/sci
   rates ("your government caps rates"), reset the slider POSITION to
   the actual rate after rejection — the thumb currently stays where
   the user dragged it while the numbers stay correct.
5. **Site assessment near cities (VI.12)**: when the hovered/selected
   settler tile is within minCityDistance of any KNOWN city, skip the
   site rating entirely — show plain tile properties only (the rating
   is noise where founding is illegal anyway).
Verify: e2e green; screenshots for 1/3/4; a hotseat/server manual
check note for 3. All golden-safe.

## A30 — AI-turn waiting indicator + chunked AI rounds (VI.3, medium)

The A26 wait-line should also show "⏳ Americans (AI) is moving · Ns"
during AI turns. SERVER games: the line already keys off activePlayer
— verify it renders for AI seats and add "(AI)" when player.human is
false. LOCAL/hotseat games: the AI round currently runs as ONE
synchronous JS batch (UI can't repaint mid-round), so: chunk the
session's AI loop — one AI player per macrotask (setTimeout 0 /
queueMicrotask + rAF between players) so the HUD updates between AI
players. DETERMINISM UNCHANGED: same commands, same order, only
yielding to the event loop between players; the diagnostics recording
must be byte-identical for the same inputs (assert: run a seeded
hotseat e2e, compare the round hash to the unchunked value). Big AI
empires late-game = this is also the End-Turn-latency perceived-
responsiveness fix. Golden-safe (no engine changes).

## A33 — Save code into the turn log (VI.7)

When the server's autosave broadcast delivers a game code at a turn
wrap, add ONE turn-log line per turn for every player (incl.
spectators): "💾 saved · code FWN6-X6PQ-3X5TD". Use turnlog.note()
(A26's export). Dedupe: only when the code CHANGES (it changes every
round — fine, one line per round wrap; if the log gets noisy make it
every N rounds via an Options value, default every round). Coordinate
with B6 (same broadcast). Golden-safe.

## A34 — Host resumes server saves from the lobby (VI.9, medium — design included)

Today resuming needs the CLI (`./run.sh 8123 --game saves/x.json`).
Add: the Host flow offers "Resume a saved game" — server endpoint
(GET /saves-list or a lobby ws message {t:'listSaves'}) returns the
host machine's saves/ inventory: gameId, turn, year, player names/
civs, saved-at mtime, game code. Host picks one → server loads it via
the EXISTING --game path (registry.register + reset-seats semantics:
tokens live in per-origin localStorage and machines change, so
resumed lobby games always reset seats and joiners re-pick by name —
exactly the --reset-seats teaching flow, now automatic). Joiners see
the usual waiting room; the game code shows in the lobby so players
can verify it matches their notes BEFORE playing (the docs/07 trust
loop, now visible). SECURITY note: list only `saves/*.json` basenames
server-side, never client-supplied paths (the existing --game
validation applies). Tests: listSaves shape; resume-from-lobby e2e
(ws): create → play → save exists → new lobby resumes it → codes
match. Golden-safe.

## A35 — Spectator hover info (VI.13)

Spectators (omniscient) get hover tooltips: units — civ, type,
attack/defense/moves, veteran; cities — civ, name, population.
Reuse the hover pick + the unit stat-card formatting; render as a
small tooltip near the cursor or reuse the hud note line (pick
whichever reads better in the shot — show me both if unsure).
Players' hover behavior unchanged (fog rules already limit them).
Verify: spectator screenshot with a tooltip visible over a rival
unit AND a city. Golden-safe.

## A36 — City names on the map + growth tiers (VI.14, renderer — medium)

1. **Name labels**: every KNOWN city shows its name on the map
   (CanvasTexture sprite under the pop badge, faction-tinted border or
   plain — try both, screenshot). Fog rules: named only when explored
   (the visible-cities view already gates this). Label scale must stay
   readable at default zoom and not swim under WebGL1.
2. **Growth tiers**: the house-cluster model currently has ~3 tiers
   (1/5/12). Civ 1 pops reach ~40+ — extend to 5 tiers (thresholds
   from data-driven breakpoints in the renderer table, e.g.
   1/4/8/16/28+) with visibly denser/taller clusters; walls still
   render at any tier. Gallery row 7 gains the new tiers — gallery
   screenshot is the acceptance evidence, plus mock-state coverage so
   `test/mock-state.test.js` sees any missing tier mapping.
Golden-safe (renderer only).

## A37 — Lobby chat + host moderation: kick / kick-and-block (VI.15 — design included)

SUPERSEDES the A27 no-kick ruling (@3b520ebc) BY USER DECISION
(2026-07-14): kicking is now a deliberate, explicit host action — NOT
the silent setSlot flip, which keeps rejecting (`seatReserved`).

1. **Lobby chat** (pre-game only, v1): a panel below the game
   configuration. Host checkbox "Enable lobby chat" (create option +
   live toggle, default ON). Messages: `{t:'chat', text}` → broadcast
   `{t:'chat', seat, name, text}` to the lobby. HARD RULES: text
   length-capped server-side (200 chars), rate-limited (1/sec/conn),
   escaped through the client's esc() path before innerHTML (XSS —
   add the payload e2e case), NEVER stored in game state (chat is
   transient lobby traffic; determinism untouched).
2. **Roster with identity**: the host's slot rows show each joiner's
   name; the connection's remote IP appears on HOVER — HOST ONLY
   (never broadcast IPs to other joiners or spectators).
3. **Kick**: host-only `{t:'kick', seat}` → the kicked client gets
   `{t:'kicked'}` (friendly full-screen "the host removed you from
   the lobby" + back-to-setup), the reservation frees, roster
   broadcasts. Works in the LOBBY only (v1) — kicking a seated player
   MID-GAME stays out of scope (that's the AI-regency design's
   territory, docs/08 §7).
4. **Kick-and-block (this game)**: same + the connection's IP joins
   the lobby entry's blocklist; joins from a blocked IP get
   `{t:'rejected', code:'blocked'}` ("the host has blocked you from
   this game"). Block list dies with the lobby entry — per-game, not
   persistent.
Protocol tests: non-host kick/chat-toggle rejected (notCreator), kick
frees the seat + notifies, blocked rejoin bounces, chat cap/rate/
escape. UI screenshots: chat panel host + joiner views, kick
confirmation, blocked-join message. Golden-safe (nothing enters game
state).

## ARCHITECT — Wave VI engine batch (VI.2 capital trade + VI.5 city spacing; golden window)

Mine, under the batch-4 lock window (one extra re-record):
- **VI.2**: the CAPITAL's city-square gains +1 trade (rules.json
  `capitalCenterTradeBonus: 1`, applied in cities.js workedTiles
  center for the capitalOf city) — every starting city yields ≥1 bulb.
- **VI.5**: city spacing metric becomes 3-orthogonal/2-diagonal:
  legal iff Chebyshev ≥ 3 OR (|dx| ≥ 2 AND |dy| ≥ 2). rules.json
  minCityDistance 3 + minCityDiagonal 2; update the combat.test
  spacing cases + scenario hashes as needed; AI founding uses the same
  predicate (candidate scoring already consults it).
Both re-recorded together with batch 4's goldens.

## PARKED/DESIGN — Off-turn pre-work (VI.11, architect design first)

Let players adjust rates/research/production/workers while a rival
moves — "pre-work" applied to their own empire out of turn. This
touches the engine's turn discipline (most commands reject
notYourTurn) and the protocol. Design direction: allow an explicit
WHITELIST of self-scoped commands (setRates, setResearch,
setProduction, setWorkers) out of turn — the server serializes them
into the command log as usual so replay determinism holds by
construction; the engine check loosens from "activePlayer only" to
"activePlayer OR whitelisted self-scoped". Needs: docs/02 §commands
note, engine change (golden lock), scenario for an out-of-turn
setProduction, and UI unlocking (panels currently assume own-turn).
NOT QUEUED until the design is written and the lock frees — architect.

## PARKED — Global "find a game" + internet hosting (user note 2026-07-13, NOT QUEUED)

The vision: a public server (first a local PC behind the DNS name
`retromulticiv.kjell.today`, later a Hetzner VM per the user's proven
recipe — stored verbatim in `ops/hosting-recipe.md`, gitignored) where
players browse a **global game listing** and join without a shouted
code. Design facts for when this opens:

- **The code is closer than it looks.** The server already binds
  0.0.0.0, validates every command (authoritative), autosaves, and
  handles reconnects; the client already speaks `wss://` when the page
  is https (main.js wsUrl derives from location.protocol). A first
  internet game needs ZERO code: DNS name → router port-forward →
  existing join codes.
- **Find-a-game v1** = the single server lists its own open lobbies:
  the lobby registry already tracks status/seats — add a
  `{t:'listGames'}` reply (name, open seats, size, age, spectators
  allowed; NEVER join codes) + a browse panel in the client lobby UI,
  "join" = the existing joinCode flow with the code delivered by the
  server on click. Host opts IN to public listing at create (private
  by default — a checkbox next to Allow-spectators). Small item.
- **Find-a-game v2** (much later) = a directory where MULTIPLE hosts
  register — needs a hosted registry service, host heartbeats, NAT
  reality (most home hosts unreachable) — do not start this until v1
  demand exists.
- **Recipe deltas for our stack** (vs the VoteText recipe): nginx
  needs the WebSocket upgrade block for `/ws` (`proxy_set_header
  Upgrade $http_upgrade; proxy_set_header Connection "upgrade";
  proxy_read_timeout` long — turn-based games idle for minutes); no
  SQLite/no init-db (saves are JSON files — the backup cron targets
  `saves/`); no Express (plain node http — static + ws already one
  process, port via `--port`); systemd ExecStart = `node
  server/index.js --port 3000 --host 127.0.0.1` (loopback behind
  nginx — the --host flag exists).
- **Public-internet hardening before flipping DNS on** (own item when
  queued): per-IP rate limit on join/create, cap concurrent games +
  connections, lobby idle expiry, and a look at ws payload limits
  (64KB cap exists). Join-code space (32^5 ≈ 33M) is fine for v1.

Ordering: after the two-machine LAN acceptance; v1 listing pairs
naturally with A27's lobby work.

## PARKED — Big-lobby scaling probe: 8/12/16 players (user note 2026-07-13, NOT QUEUED)

Before phase-4 grows past friends-on-a-LAN: simulate 8, 12, and 16
players and measure performance and latency. Facts for whoever designs
it: the 7-player cap is a soft clamp in exactly three places
(client/main.js:141 `Math.min(7, …)`, the lobby seat dropdown p1..p7,
test/sim-driver.js SIM_ROSTER) — data/civs.json already carries 14
identities, so 8–14 players is a clamp-raise + roster extension.
DECIDED (user 2026-07-13): beyond the original 14, draw new
civilizations from **Civ 2/3/4** rosters and adapt each one's
perk/speciality to our `specialty` schema (`{type: cheapUnit|
cheapBuilding|…, unit/building, pct, blurb}` — invent new structured
types only where an adapted perk truly needs one, and keep them
engine-read like the existing hooks). The local wiki dump covers the
whole Civilization Fandom wiki, so names/leaders/city lists/perk facts
extract the licensed way (facts and numbers via tools/wiki2data.js +
mapdata overlays — never prose). Each new civ ALSO needs a visual{}
identity (primary/secondary/emblem) — the 14-civ table is the designer
ally's work and his acceptance criteria apply, so batch the new
identities through him. What to measure: headless soak ms/turn vs
player count (today ~60–235 ms/turn at 4 civs on medium/GE), server
per-command cost (filterView runs once per CONNECTED seat per
broadcast — it scales players × map tiles), ws fan-out latency with 8+
live sockets (extend test/server-lan4.test.js's pattern), and
end-of-round AI time (16 AI turns back-to-back between human turns).
Also needs a bigger-maps sanity pass (16 starts ≥3 from poles and ≥4
apart may not FIT below `large`). Golden-impact: none for the probe
itself if measured on scratch configs; raising the shipped cap touches
setup/lobby only. Queue it when the two-machine acceptance is done.

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

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
   (currently 379 tests), the item's own verification steps pass, related
   docs updated, then STOP AND REPORT — list files touched, tests added,
   anything unexpected.
4. Golden hashes: `test/simulation.test.js` pins checkpoint hashes of a
   fixed AI game. Any change to engine behavior, AI decisions, or
   `data/*.json` shifts them. Re-record ONLY when your item says so: set
   `GOLDEN_SOAK`/`GOLDEN_NATURAL` to `null`, run the file, paste the
   printed JSON back, run again green. Same process for scenario hashes
   (`test/scenarios/*.json`, set `"hash": null`). The paste-back is
   ENFORCED (B10): guards.test.js fails on any committed null hash, so a
   re-record stays loudly red until the printed values are pasted.
5. Client changes need the headless visual loop: serve the repo root
   (`python3 -m http.server 8123`), then `debugging/screenshot.sh out.png
   "http://127.0.0.1:8123/client/?seed=12345&civ=romans&e2e=1"`, once more
   with `--disable-es3-gl-context` appended (WebGL1 pass), and
   `debugging/gallery.html` after any assets/terrain change. Read the
   screenshots — do not claim visuals work without looking.
6. Mark the item `[claimed: <who> <date>]` when starting, `[done: <date>]`
   with a one-line result when finished. Do not reorder other items.
7. **File locks** (added 2026-07-14 after a real collision):
   `python3 tools/agent-mail.py lock <file> --as <role> --why "item"`
   BEFORE editing any file another agent might touch (all of client/,
   server/, shared/, test/browser.test.js at minimum); check `locks`
   first — a held lock means mail the holder or the architect, never
   edit through it; `unlock` everything you hold as part of your
   done-mail step. Mail claims still carry the why/regions; the
   registry is the instant may-I-edit answer.

---

## B-queue — AI bugfixer

Bugs and regressions. Same rules as A-items PLUS: before editing, mail
the architect the exact file list you intend to touch (bugs have no
pre-fenced lane) and wait for an ack if any file overlaps an in-flight
A-item. Fix format: failing test FIRST where feasible, then the fix,
then the standing checks.

### P5-1 — Phase 5 opens: Luau twins of rng + statehash + gamecode under lune (assigned: bugfixer)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — ALL THREE GATES on first run: rng 2714967881,2238813396,1250077441,3820100336 · statehash 0x30db1e29 (canon byte-identical) · codeHi 0xa687b72d + AD1X-Q5MR-DP7H9. luau/{rng,statehash,gamecode,anchors}.luau + test/luau-twins.test.js (self-skips sans lune). NOTE: npm "lune" is a moon-phase lib — official binary v0.10.5 used instead (~/.local/bin). Trap-list addition: empty-array-vs-object needs the ARRAY_MT marker convention. Suite 210/210]

The port's first slice per docs/09's order, needing NO Studio and no
user setup — `lune` is dev-only and already on the dependency
whitelist (user-approved 2026-07-12): `npm install --save-dev lune`
(or the platform binary if the npm wrapper misbehaves — note which).
Deliverables:
1. `luau/rng.luau` — xorshift32, same algorithm as engine/rng.js
   (NEVER Random.new). GATE: the golden sequence from the rng tests
   (seed 123456789) reproduced exactly.
2. `luau/statehash.luau` — canonical serialize + FNV-1a 32 with the
   same integer semantics (docs/09 trap list: JS mul32 vs Luau number
   handling — the bit32 library is the tool). GATE: the anchor
   {b:2,a:[1,"x",true]} -> 0x30db1e29.
3. `luau/gamecode.luau` — codeLo/codeHi + Crockford grouping. GATES:
   codeHi anchor 0xa687b72d, gameCode AD1X-Q5MR-DP7H9.
4. `test/luau-twins.test.js` — a Node test that self-skips without
   lune, else runs `lune run` on a small Luau harness printing the
   three gate values and asserts them (the CI twin pattern docs/09
   describes; nightly picks it up once lune installs there — flag the
   workflow edit separately, do NOT edit .github/ without a claim).
Read docs/09's trap list FIRST (0-based index VALUES stored in state,
JS % vs Lua %, truthiness). Anchors are non-negotiable: a twin that
needs a "close enough" is a wrong twin. Golden-safe (nothing touches
the JS engine). Done-mail: the three gate values as printed by Luau,
plus any trap-list additions you discover — docs/09 wants them.

### P5-2 — json2lua + the scenario-runner twin (assigned: bugfixer; docs/09 §4 step 4)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — GATE MET first run: all ten scenario setups + a messy crafted save hash IDENTICALLY in Node and Luau (diff of both tables: zero differences). luau/json2lua.luau (pure-Luau JSON parser, arrays ARRAY_MT-marked at the token where []-vs-{} is knowable, NULL sentinel for scenario expects, assertState enforces the contract), luau/scenario-runner.luau (buildSetup/hashSetup; script execution lands with P5-3 engines), luau/scenario-hashes.luau (lune harness), luau-twins gate test. 002 (seed setup) hashes the raw setup object both sides until mapgen ports. Suite 221/221]

The harness before more engine — two deliverables, one compound gate:

1. **`luau/json2lua.luau`**: parse our JSON (scenario files, saves,
   states) into Luau tables honoring the shipped conventions —
   EMPTY ARRAYS carry `statehash.ARRAY_MT` (your own trap-list entry:
   buildings/cityOrder/techs are everywhere; a marker missed = a hash
   silently wrong), integers stay integers, and reject/flag anything
   the state contract forbids (floats, null) rather than coercing.
   Pure Luau, no lune-specific APIs in the module itself (Studio will
   consume it too — R-lane reads it later).
2. **`luau/scenario-runner.luau`**: the test/scenario-runner.js twin —
   loads a scenario JSON, builds the setup state, and (once engine
   modules exist, P5-3+) applies the script commands and checks
   expectations + the final hash. For THIS slice it runs the part that
   is checkable today: setup-state construction + canonical hashing.
3. **THE GATE (new cross-language anchor set)**: for ALL TEN
   `test/scenarios/*.json`, `hashState(json2lua(scenario.setup.state))`
   in Luau must equal the hash Node computes for the same setup —
   extend `test/luau-twins.test.js` to compute both sides and assert
   equality per scenario (self-skip without lune, as before). Also
   hash ONE real server save's state (the committed test fixture or a
   crafted mini-save) — scenario states are tidy; a real save is the
   mess that finds bugs.

This slice makes every later engine-module port instantly checkable
(P5-3's per-batch scenario gates run through this runner). Trap list
first, as always; report any new traps for docs/09. Golden-safe
(nothing touches JS). Done-mail: the ten per-scenario hash pairs
printed from BOTH languages.

### P5-3 — First rule-module batch + the dispatcher (assigned: bugfixer; docs/09 §4 step 4-amended + step 5 start)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — ALL THREE GATES: (1) shakedown — dispatcher-only 001 failed IN-CONTRACT (fixture/cmd#/turn/actor/payload/hash/rng/canon all present); (2) 001 GREEN cross-language vs the LIVE JS engine, 0x06636df6 both, canonical states byte-identical; (3) 8/8 data checksums equal. luau/{index,movement,visibility,combat-stub}.luau; hooks are GUARDED no-ops (error loudly when a state could make the JS hook act — the harness immediately caught JS processResearch lazy-writing bulbs:0, first real engine divergence, fixed by porting the defaults). Unported scenarios fail in-contract per the PORTED-list test. New traps: "until" is a Lua keyword (yearSteps needs brackets); lazy-default hook writes. Suite 224/224]

Three deliverables, gates per the amended order:
1. **Minimal `luau/index.luau`**: the applyCommand DISPATCHER shell —
   command table lookup, unknown-command rejection, the deep-clone
   purity contract (port deepClone with the ARRAY_MT discipline), and
   endTurn's shell (turn/year advance via a ported nextYear, player
   cycling, moves refresh) with per-module process hooks that no-op
   until their modules land. GATE: scenario 001-move-unit still FAILS
   (movement not ported) but FAILS CORRECTLY — the runner executes
   the script and reports the divergence in the docs/09 first-
   divergence format (this is the contract's shakedown).
2. **Batch 1 rule modules**: `movement` + `visibility` (the ally's
   vertical-slice order: movement/fog/projection early). GATE:
   scenario 001 green cross-language (same final hash both engines).
3. **Static-data checksums** (the amended step-4 gate): every
   data/*.json canonical-hashed identically in both languages —
   extend luau-twins.test.js with the eight data files.
Failure output SHAPED for the first-divergence contract from the
first red run — fixture, command index, turn/actor, payload, both
hashes, first differing canonical path, RNG before/after. Trap-list
first; docs/09 §7 says transliteration suffices — prove it again.
Golden-safe (JS untouched).

### P5-4 — Batch 2 rule modules: combat + improvements (assigned: bugfixer; docs/09 §4 step 5)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — combat.luau (full, stub deleted; rng call order preserved) + improvements.luau (guard deleted, hook wired) + partial cities.luau (hasBuilding/wonderActive for walls). GATES: 008 GREEN vs pin 0x7183a0ea; 004/005 combat STEPS all pass cross-language (both rng branches, promotions, stack deaths) but their PINS require the cities harvest at the wrap (JS writes city.food — measured) so full-green moves to P5-5 with a PARTIAL column asserting the exact guard point (earlier failure = combat regression); 009 needs buy/setProduction, stays P5-5 (checked). Runner fix: dotted-path 0-BASED array indices now +1-translated (new trap). Suite 227/227]

The pinned-contract era begins: every gate in this and later batches
asserts Luau == the PINNED scenario hash (B10), transitivity with the
JS suite replacing live-JS comparison.
1. **`luau/combat.luau` for real** — replace the P5-3 stub (delete its
   `notPorted:combat` rejection AND the guarded no-op combat hook;
   porting a module = deleting its guard). resolveAttack with the rng
   call sequence EXACTLY as JS (order of rolls is part of the
   contract), veteran/terrain/fortify/walls multipliers, stack death,
   zone-of-control interactions with movement where combat owns them.
   GATE: scenarios 004-combat AND 005-combat-defender-wins green vs
   pins — 005 matters doubly: defender-wins exercises the OTHER rng
   branch.
2. **`luau/improvements.luau`** — roads/rails/irrigation/mines/
   fortress build + pillage effects, terrain transforms if the module
   owns them. GATE: scenario 008-improvements green vs pin; also
   009's pillage step if 009 turns out to need only
   combat+improvements+already-ported modules — check, don't assume;
   if 009 needs cities (buy/disband), it stays in the P5-5 column.
3. Update the PORTED-scenarios list; everything unported must still
   fail in-contract (the P5-3 two-column gate discipline).
Trap watch for THIS batch: combat is the first module where rng CALL
COUNT is behavioral — a stray extra roll diverges everything after;
the divergence report's rngBefore/rngAfter fields are your bisect
tool. Golden-safe (JS untouched). Suite + luau-twins green, mail with
per-scenario hashes.

### P5-5 — Batch 3 rule modules: cities + tech (assigned: bugfixer; docs/09 §4 step 5)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — ALL GATES FIRST RUN: 003 0x866fe652 · 006 0x13d7ad54 · 007 0xc5663e66 · 009 0x419f157e green vs pins; 004/005 PARTIAL RETIRED, green vs pins unchanged (0xa5bc9369/0x077f7a14 — the pins encoded the harvest); 001/008 pins unmoved; 010 in-contract at exactly command 6 (setGovernment, new PARTIAL); 002 awaits mapgen. Scope finding honored: happiness.luau FULL + government.luau PARTIAL rode in (the wrap chain forces cityMood) — P5-6 shrinks to government proper. New trap: JS sort STABILITY (candidateTiles ties) needs an explicit fat-cross-order tie-break in table.sort. Guards deleted: updateDisorder/processCities/processResearch. Suite 229/229]

The big one — cities is the engine's largest module. Pinned-contract
discipline throughout.
1. **`luau/cities.luau` for real** — replace the P5-4 partial (keep
   hasBuilding/wonderActive, delete the non-final flag): found/
   captureCity interplay (combat already calls captureCity — verify
   the seam), workedTiles + govAdjustYields + the capital trade bonus,
   growth/starvation, production + buy + setProduction + disband,
   setWorkers + auto-assign, candidateTiles, capitalOf, citySpacingOk.
   Delete the cities guard; the harvest wrap goes live.
2. **`luau/tech.luau`** — researchCost/discovery/era, bulbs
   accumulation from trade, setResearch; delete the tech hook's
   guarded no-op AND its ported lazy-defaults comment (the real
   module owns the defaults now — watch that the hash stays put:
   001's pin must NOT move).
3. **GATES**: 003-found-city, 006-research, 007-buildings,
   009-buy-pillage-disband all GREEN vs pins; 004/005 PARTIAL columns
   RETIRED — they flip to PORTED and must go green vs their pins
   unchanged (the pins encoded the harvest all along). 010 stays
   unported (happiness+government = P5-6) and must still fail
   in-contract.
4. rng call-order discipline continues where cities rolls (if any —
   audit; growth/production are deterministic, barbarians are not
   in this module).
Golden-safe (JS untouched). Suite + twins green, mail per-scenario
hashes and which guards were deleted.

### P5-6 — Batch 4: government proper (assigned: bugfixer; docs/09 §4 step 5, re-scoped by P5-5 dependency pull)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — 010 GREEN vs pin 0xf9f9a086 first run; PARTIAL column empty (mechanism kept); NINE of ten cross-language, 002 = mapgen only. government.luau completed (setGovernment incl. the Pyramids instant-switch transcribed from the JS inline check, clampRates, processRevolutions — no RNG, no sorts, tie audit trivially clean); guards deleted: processRevolutions + the setGovernment rejection. REMAINING GUARDS for P5-7 scope: processBarbarians (turn>=16, RNG-consuming) + checkGameEnd (alive flags); unported modules: barbarians, score, mapgen, ai + the runner seed-setup path. Suite 229/229]

Small batch by design — P5-5 already pulled happiness (full) and
government's pure helpers in as wrap-chain dependencies.
1. **`luau/government.luau` completed** (delete its non-final flag):
   setGovernment + clampRates (delete the dispatcher rejection),
   processRevolutions (delete its guard — anarchy countdown; if any
   rng rides the revolution completion, preserve call order), and the
   Pyramids instant-switch — the first WONDER EFFECT to go
   cross-language (wonderActive is already ported; verify the seam).
2. **GATE: 010-happiness-government flips PORTED** — green vs pin
   0xf9f9a086; its PARTIAL column (exact-index 6) retires. NINE of
   ten green; 002 remains the mapgen gate (P5-7 territory).
3. Sort-tie audit per the new docs/09 P5-5 trap: grep government.js
   (and anything it drags) for `.sort(` — prove comparators total or
   add the explicit tie-break.
4. Remaining guards after this batch: barbarians (turn>=16),
   checkGameEnd (alive flags) — name them in the done-mail so P5-7's
   scope is unambiguous.
Golden-safe (JS untouched). Suite + twins green, per-scenario hashes
in the done-mail.

### P5-7 — Batch 5: mapgen + barbarians + score — ALL TEN green, endTurn unguarded (assigned: bugfixer; docs/09 §4 steps 5-tail + 6-start)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — ALL TEN scenarios green cross-language, every gate FIRST RUN incl. 002 vs pin 0x7daaf12a (the full drunkard-walk mapgen reproduces bit-exactly); luau/{mapgen,barbarians,score}.luau + engine.createGame + the runner seed-setup path; BOTH remaining guards deleted — endTurn runs UNGUARDED end to end, the guarded-no-op era closes; sort audit clean. Suite: my gates green; the single red is the helper·s LOCKED in-flight A45 overlay test (their lane, second-lander re-run). PARTIAL mechanism parked empty]

The last rule batch before the AI. Per P5-6's guard inventory the
remaining endTurn guards are exactly two; this batch deletes both.
1. **`luau/mapgen.luau`** — the full deterministic generator
   (continents, rivers, specials, start positions; every rng call in
   JS order — the heaviest RNG consumer so far, and the docs/09
   mapgen gate is the point: same seed → same world canonical hash
   BEFORE any turn). Sort-tie audit: grep .sort( regardless of how
   much rides rng. GATE: 002-mapgen-determinism green vs pin
   0x7daaf12a — ALL TEN scenarios then run green cross-language; the
   scenario-runner's seed-setup path goes live.
2. **`luau/barbarians.luau`** — processBarbarians (turn>=16 guard
   DELETED; spawn rolls + movement, rng call-order discipline).
3. **`luau/score.luau`** — scoring + checkGameEnd (alive-flags guard
   DELETED; the crafted-state exemption — no alive flag = exempt from
   game-end checks — must transliterate exactly).
4. **endTurn runs UNGUARDED end to end** — state in the done-mail
   that ZERO guards remain reachable; the guarded-no-op era closes.
   PARTIAL mechanism stays parked for future use.
Golden-safe (JS untouched). Suite + twins green, all ten hashes in
the done-mail.

### P5-8 — The summit: ai + full index → sim-twin goldens + replay conformance (assigned: bugfixer; docs/09 §4 step 6)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — THE SUMMIT: Gate A turn-100 0x560088f5 FIRST RUN; all four soak checkpoints + finalHash 0x8cd74434 bit-exact locally under lune (400 rounds, 139-347 ms/turn); natural 395/p2/0x6d3aaf65 exact (after fixing MY harness bug: natural is chaos-OFF — correction mailed to sim-runner before their run); Gate B measure job mailed (@0d53a2d6+@abb205b5, cross-machine report pending); Gate C: FIVE files verdict-IDENTICAL byte-for-byte with tools/replay.js incl. agreeing on HOW stale recordings diverge. luau/{ai,sim-driver,sim-smoke,replay}.luau; dispatcher audit: 14/14 commands routed, zero flags; durable gates in luau-twins (turn-100 smoke + replay verdict equality). Suite: my lane green (twins 5/5); 2 reds are the helper·s LOCKED A46 seat tests. docs/09 §4 engine column CLOSES]

The port's final validation tier. The AI ports LAST as designed —
and here it must THINK identically, not just replay: the sim goldens
are all-AI games, and the engine's determinism makes identical
thought possible. This is where iteration-order and sort-tie traps
bite hardest — every Object.keys walk in ai.js rides sortIds or is
order-insensitive (the §7 audit says so); prove it again in Luau.
1. **`luau/ai.luau`** — pickCommand and every subsystem (founding
   site scoring, settler split + escorts, garrisons, threat response,
   research/rates policy, the batch-4 happinessCommand with its
   hypothetical-mood revert guard). Sort-tie audit MANDATORY.
2. **`luau/index.luau` completed** — audit the dispatcher table
   against JS applyCommand for any command not yet routed; delete the
   last non-final flags.
3. **GATE A (local smoke, you)**: the sim-driver twin under lune —
   golden seed, chaos ON (the chaos stream is deterministic, part of
   the contract) — reproduces the TURN-100 checkpoint golden
   0x560088f5. Measure lune ms/turn while there; it sizes gate B.
4. **GATE B (sim-runner measure job, mail tagged 'measure')**: the
   full run on the Roblox PC — all four checkpoint goldens
   (100/200/300/400) + the natural-end golden (turn 395) bit-exact
   under lune. docs/11 anticipated exactly this job.
5. **GATE C (replay conformance)**: tools/replay.js verdicts
   cross-language — the recordings in debugging/logs/ (and the
   user's turn-53 server save) through the Luau engine; every one
   matches its JS final hash, misses report in-contract.
Golden-safe (JS untouched). This closes docs/09 §4's engine column;
after it, phase-5's remaining work is R4+ (GameServer/client) and
docs/09 §6's slice list gets its DONE marks.

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

### B4 — Sweep: inert `classList.add('hidden')` calls (from A26's bonus find)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — static cross-referencer over all 43 client hidden-toggle sites: 3 inert beyond B6's #code-toast (#wait-line + #mp-status = live LAN bugs, the waiting/skip-vote lines never dismissed + empty pills from boot; #handoff-code = stale save-code linger). +3 scoped CSS rules; DURABLE GUARD implemented in guards.test.js (resolves ids via getElementById/created-id/querySelector + .panel class coverage incl. JS-created panels; unresolved receivers skipped by design) — red on exactly the 3 ids pre-fix, zero false positives. Screenshots: clean server boot + functional waiting state. Family tally: 4 sites. Suite 196/196]

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

### B5 — Turn log misses rival-vs-rival / AI combat in server games (wave VI bug)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — shape @9edac2e9: engine/visibility.js filterEvents (Lua-portable; world news incl. playerDefeated, own-only tech, coord-or-named-party rule, spectator omniscient passthrough); per-seat filtered events ride every view push (index.js fanout + doSkip), actor ack belt-and-braces filtered (protocol.js), session-remote notifies view.events. 5 unit cases + server-events.test.js integration (crafted 3-human strip: victim hears rival combat, fogged seat does not) — revert-proven red with self-diagnosing inbox dump. Suite 194/194]

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

### B6 — Server-save banner ✕ does nothing (wave VI.8)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — suspect (b) cleared (no autosave re-show loop; all showCode callers are user actions); pure B4 family: #code-toast had no scoped .hidden rule, so the ✕ styled nothing AND the empty pill rendered from creation. +1 CSS rule; failing-first via computed-style probe in ?e2e=1 (class-only checks lie); screenshot-verified dismissed. B4 tally: 1 site swept]

The "Saved turn N — game code …" banner's ✕ doesn't dismiss. Two
suspect classes, check both: (a) the B4 family — an inert `.hidden`
with no scoped CSS rule; (b) the banner is re-shown every autosave
broadcast (each accepted command autosaves — the ✕ works but the next
broadcast instantly re-shows it; if so the fix is show-once-per-turn
or per-SAVE-code-change, not per broadcast). Failing test or
screenshot-proof both directions. Coordinate with A33 (save code into
the turn log) — same broadcast, complementary fixes.

### B10 — Re-pin all ten scenario final hashes + the null guard (assigned: bugfixer, ruling @2e3c2166)  [claimed: bugfixer 2026-07-14] [done: 2026-07-14 — order per the amended ruling: (1) convention sweep first — 5 scenarios (001/003/004/005/008) gained bulbs/taxRate/sciRate on players (defaults 0/50/50); (2) all ten final hashes pinned in one deterministic pass (001 0x06636df6 = exactly what the Luau engine already produced — the sweep validated the P5-3 fix); (3) guards.test.js null-hash regex guard (a forgotten paste-back is now loudly red); (4) docs/05 + header rule 4 notes; (5) luau-twins PORTED gate flipped from live-JS to the PINNED contract. Suite 226/226]

All ten test/scenarios/*.json carry `"final":{"hash": null}` committed
(gate silently OFF since the f8b5938-era re-record missed the
paste-back). Not a golden window — pasting values only ADDS passing
assertions. Steps, in order:
1. Convention sweep FIRST: bring crafted scenario states up to the
   CLAUDE.md house rules (001 lacks `bulbs`/`taxRate`/`sciRate` on
   players — P5-3 found the lazy-default drift the convention exists
   to prevent; sweep all ten). This changes the hashes, so it precedes
   the pin.
2. One run printing all ten final hashes → paste → rerun asserting green.
3. Guard test: every committed test/scenarios/*.json final.hash must
   match `/^0x[0-9a-f]{8}$/` — makes a forgotten paste-back loudly red.
4. One-line notes: docs/05 re-record paragraph + header rule 4 above.
5. The Luau twin gate then compares against the PINNED values (the pin
   is the cross-language contract), not a live JS run.

### B11 — Regency plays units but not the EMPIRE (wave VII bug 0; assigned: bugfixer — NOTE the golden window is open for A40-s1, coordinate with the helper if your fix touches ai.js: it probably must, so likely lands INSIDE the same window)  [claimed: bugfixer 2026-07-15 — pre-triage correction measured (@8d3e6af0): engine half is a NO-BUG (research was busy all 15 turns, zero settlers to startWork; the regent DID run the shared pickCommand policy — setProduction×3, setWorkers×4). Real bugs are client-side: the armed regent stalls after ONE turn (kicking-flag swallows the re-kick) and any manual command re-kicks a full sweep + auto-end. No engine files touched → no golden exposure.] [done: bugfixer 2026-07-15 — (a) engine NO-BUG, pinned: test/ai.test.js "B11: a human seat (regency) gets the identical empire policy stream" proves the seat flag never changes pickCommand's command stream and that idle research + improver startWork fire. (b) ROOT CAUSE of the stall: regency.js drive()'s kicking flag was still true when endTurn's final notify fired, so the re-kick was swallowed — the armed regent played ONE turn then stalled, and any manual command's onChange then swept the seat + auto-ended ("when I moved them" — recording confirms every regent turn 249-263 starts with a manual-looking cmd, turn 263 with 16 rejected u16 moves). FIX: client/ui/regent-driver.js (DOM-free, extracted) owns a while-armed loop w/ macrotask yield; take-back honored at every turn boundary; regency.js delegates. test/regent-driver.test.js: red-first (stalled at turn 2) → self-continue to turn 5 + take-back stops + manual poke never auto-ends. (c) narration: session.regentTurn emits a synthetic {type:'regentTurn', playerId, applied, byType, research, production} (stateReplaced precedent — never logged/hashed; verified absent from exportDiagnostics; filterEvents passes it to its own seat only, zero engine change). turnlog.js renders "🤖 regent played your turn: N moves · research → X · production → Y…"; LOG_CLASSES gains a 🤖 regent filter checkbox. Server-regency narration = follow-up candidate (server/game.js playRegentSeat has no summary — LAN seats won't see the 🤖 line; local path was the reported bug). Suite 258/258, docs count-synced.]
[B11b follow-up done: bugfixer 2026-07-16 — server/game.js playRegentSeat now appends the SAME synthetic {type:'regentTurn',playerId,applied,byType,research,production} event onto its returned events array (the local session.js twin), so LAN regent seats get the 🤖 turn-log line too. Rides driveRegents' fanout; filterEvents delivers it to the regent's OWN seat only (playerId party), withheld from others. GOLDEN-SAFE: the event goes to the client-push events, NEVER to `log` or state — the A40 test's existing replay-hash-exact assertion still passes, proving the recording is untouched. test/server.test.js A40 regency test extended: asserts a view carries the regentTurn event for p1 (red-first before the push). Suite 295/295.]

ARCHITECT PRE-TRIAGE (recording
`debugging/logs/retromulticiv-diag-turn264.json` replays HASH-EXACT —
2120 commands + 74 rounds, engine + log integrity fine):
- The regent DID move units: turns 249–263 carry 18–34 p1 cmd
  entries each (the user's "didn't move" is a VISIBILITY complaint —
  see (c)).
- THE REAL GAP: across 15 regency turns — ZERO setResearch, only 3
  setProduction, ZERO startWork (no roads/irrigation/mines). Suspect:
  the engine AI's empire policy (research choice, production choice,
  improvement orders) lives behind `human: false` branches (the
  processing/runAiTurn layer), which regent seats never reach —
  regency keeps human:true BY DESIGN. pickCommand covers unit
  actions; the policy layer silently skips the seat. FIX SHAPE: the
  regent driver must apply the same empire policy the AI gets —
  factor the policy out of the !human branch into a callable the
  regent path uses (engine change → fixture first, both languages,
  golden analysis: policy factoring must be a NO-OP for pure-AI
  seats or goldens move — if they move, STOP per window rules).
- (b) TAKE-BACK LEAVES AUTO-END-TURN ARMED (user: "when I moved
  them, it turned into a kind of auto-end-turn") — the local
  session's regentTurn re-kick apparently survives the take-back;
  find the flag/rekick path, failing test first.
- (c) VISIBILITY: regent turns should be WATCHABLE — turn log
  narration at minimum ("🤖 moved Legion…" or a per-turn summary);
  the user could not tell the regent acted at all.
Verification: a local game, enable regent 3+ turns → research
progresses, production changes, improvements started, log narrates;
take back → full manual control, no auto-end. Suite + goldens green.

### B13 — Late-era AI stagnation: phalanx spam, zero rails, sparse improvements (wave VIII bug 0; assigned: bugfixer, AFTER B11 — same ai.js territory, window discipline)
[done: bugfixer 2026-07-16 — ERA-SCALING WINDOW (claim @011b9ab7, done @900ea9a4), all 5 slices cross-language, ONE re-record, suite 314/314, luau-twins green. (a) obsolescence-consume: units leave the catalog on obsoletedBy (cities.js unitObsolete + setProduction reject); defender era-scales via bestDefenderUnit (phalanx->musketeers->riflemen->mech-inf); barracks SOLD for gold on gunpowder/combustion (tech.js sellObsoletedBuildings + buildingSold event + 💰 turn-log; rules.sellPriceRatio=1). (b) improver road->rail (bestImprovementJob canRail, rules.railroadTech). (d) improver MINE path (mineBetter: shield terrain over irrigation). (e) attackers: bestAttackerUnit (attack>defense) + countAttackers + STANCES attackerPerCity/attackerBase. (f) explore-weight: rules.exploreMarchRadius=8 base + STANCES marchRadiusPct + marchRadiusOf (sweepable, identity). (g) walls-when-threatened: threatened city (enemy within rules.threatRadius=8) + masonry builds city-walls first. GOLDEN LEDGER (JS==luau every value): soak 100=0x88490ab4(held) 200=0x2706d521 300=0x90ce8f2f 400=0x2e1d6f37; natural r395/p2/0xb5f2895d. Golden-neutral where no gunpowder (obsolescence + barbs). Tests: ai.test.js (5 pins), obsolescence.test.js, barbarians.test.js, scenarios 015/016. FLAGGED numbers for sim-runner re-baseline tuning in the done-mail. Fresh post-B13 witness: follow-up.]

ARCHITECT PRE-TRIAGE (recording replays exact — 0 commands, the ff
result IS the initial state; numbers from it):
- turn 325, ALL 67 techs granted, yet: p2 (AI) = 53 phalanx + 13
  militia (cheapest-defender choice never scales with era); map has
  47 roads, ZERO rails ever, 14 irrigation+mines TOTAL. Soak
  telemetry never measured army mix or rails — this was invisible
  until the user toured a late world.
- p1 (user's seat) 2 cities vs p2's 7: NOT a takeover special-case
  (fastforward.js:93 flips human AFTER the run — both seats got the
  full AI). Asymmetry = map luck OR systematic; the sim-runner
  ff-telemetry job (commissioned, also A59's prerequisite) answers
  across seeds.
Sub-items: (a) AI unit choice must scale with era — NOTE: A63's
obsolescence (units unbuildable once successor available) cures
this structurally, prefer that over a parallel heuristic; (b)
improver logic never upgrades roads→rails (Railroad tech known,
rails never built) — extend the improve policy; (c) improvement
density generally low late-game — measure first (soak army-mix/
rails/improvement telemetry columns), then tune; (d) NEW from the
ff-telemetry baseline (sim-runner, 30 worlds): the AI NEVER builds
a mine — irrigation and roads happen, mines zero across every
world; the improve slice has no mine path at all; (e) NO ATTACKER
IS EVER BUILT — 30 worlds contain only phalanx/militia/settlers;
armies are 100% defensive, so nobody ever prunes a runaway leader.
MEASURED READ (sim-runner, adopted): the 2-vs-7 asymmetry is
LEADER COMPOUNDING, not weak-seat bad luck (median leader 12+
cities at t190; the tail's idle settlers grow 6→21 with land
saturation) — capping the leader via real conflict (attackers +
obsolescence + era-scaling) IS the fairness fix; a
boost-the-weakest handover tweak would still hand humans a
hopeless t305 world 9 times in 10. CONSUMER TRAP for the ledger:
state can contain units/cities owned by NON-ROSTER owners (barb
cities, wandering-settler civs) — per-owner consumers must guard
(the probe crashed twice on exactly this). ALL golden-affecting →
window discipline, and (a) should land WITH A63's data.
WAR-PREREQUISITE ADDITIONS (user adopted the doctrine 2026-07-16 —
docs/15 §2b-2d + §3): the family gains (f) EXPLORATION WEIGHT — the
lab proved same-continent civs never find each other, so fog-honest
war is impossible without it (sweep-tuned constant); (g) DEFENSIVE
BUILDING priority — the AI has never built a wall (0/36 at t300);
walls-when-threatened joins the build policy. THE FULL FAMILY = ONE
WINDOW: obsolescence-consume + attackers + era-scaling + explore +
walls (+ A66 barb tiers). The COORDINATION DOCTRINE window
(per-combat-rule table, derived army groups) follows it.

### B18 — ZOC fidelity pair from B14's wiki read (engine legality; one window, both engines, scenario pins)

Two Civ 1 divergences found while closing B14 (wiki authority,
same page):
1. **Enemy CITIES exert ZOC** — our inEnemyZoc scans units only; an
   undefended enemy city currently projects nothing. Civ 1: it does.
2. **Diplomat / Caravan / Nuclear IGNORE ZOC** (diplomat's wiki
   attribute is literally "Ignores adjacent enemy units") — no
   exemption path exists in movement.js. Fix shape: a units.json
   boolean (`ignoresZoc`) + one guard in inEnemyZoc/moveUnit — the
   flag also serves A71's diplomat activation and A72's nuclear
   family (design once).
One golden window for the pair (movement legality changes AI paths),
both engines one claim, scenario 013-zoc pins both behaviors
(city-ZOC blocks; diplomat walks through). Queue: with the
B13/A63 window family, or standalone when the bugfixer frees.

[done: bugfixer 2026-07-16 — landed standalone (claim @af772f20).
BOTH engines, one claim: engine/movement.js inEnemyZoc now scans
enemy CITIES too (Object.keys(state.cities), order-independent
boolean, symmetric with the unit scan — no cityOrder dependency),
and moveUnit skips the ZOC check when the moving unit's type has
ignoresZoc; luau/movement.luau byte-shaped twin. FLAG: authored via
a new UNIT_OVERLAY in tools/mapdata.js (mirrors BUILDING/WONDER
overlays) → ignoresZoc:true on diplomat/caravan/nuclear, units.json
regenerated (clean +3-boolean diff, verified vs a no-op regen).
scenario 013-zoc.json pins BOTH behaviors, final.hash 0xcb7e13e6,
in PORTED — Luau reproduces it + its setup hash; data checksums
self-recompute with the new units.json (both sides). GOLDEN
OUTCOME: the sim goldens did NOT move — the AI marches onto enemy
cities to capture (never laterally between two city-adjacent tiles)
and builds no ignoresZoc units, so no re-record; turn-100 twin held.
test/zoc.test.js: direct engine block/pass + the three-unit flag
coverage incl. nuclear (air unit, can't be shown in a land scenario).
Red-first: scenario step 0 + zoc test failed pre-change; revert-proof
both hunks (city-scan and ignoresZoc guard) independently red. Full
suite 295/295, twins gate green under lune. The ignoresZoc flag now
also serves A71 (diplomat) and A72 (nuclear) per the item.]

### B19 — River fidelity trio from B17's wiki audit (engine legality; one window when picked up)

Three Civ 1 deviations recorded during B17's cell-by-cell terrain
audit (wiki authority):
1. **Bridge Building gates nothing** — Civ 1 required it for roads
   on river tiles; ours builds river roads tech-free. THE most
   user-visible of the trio.
2. Rivered tiles can transform into forest+river hybrids (Civ 1's
   River terrain had no mine/transform option).
3. Rivered roads currently get base-terrain trade (Civ 1's River
   road gave none).
All movement/economy legality = one golden window, both engines,
scenario pins. Queue: bugfixer's discretion alongside B18/B13.

[done: bugfixer 2026-07-16 — SCOPE CORRECTED on wiki re-verification
(audited my own B17 note before building on it): sub-item 3 (river
roads give no trade) was ALREADY CORRECT since the original
improvement commit — cities.js:29 has the `tile.river !== true` guard;
my B17 note #3 was imprecise, nothing to do. The two REAL items, both
wiki-CONFIRMED and landed (both engines, one claim): (1) Bridge
Building gates river roads — River(Civ1)/Bridge Building(Civ1) pages
both state roads over rivers need the advance; startWork('road') on a
river tile now requires rules.json bridgeTech='bridge-building'. (2)
rivers cannot be mined — Mine(Civ1) lists ONLY desert/hills/mountain;
startWork('mine') on a river tile now rejects (was wrongly allowed via
the grassland mine->forest transform). engine/improvements.js + luau
twin, one guard block each. scenario 014-river pins both + controls
(off-river road tech-free, hills minable), final.hash 0x17147783, in
PORTED — Luau reproduces it + setup; data checksums self-recompute with
the new rules.json (bridgeTech). GOLDEN OUTCOME: sim did NOT move
(6/6) — the golden AI doesn't build river roads pre-bridge and never
mines (B13(d)), so no re-record; turn-100 twin held. test/improvements
.test.js: road-WITH-bridge succeeds (the case the fixed-tech scenario
can't show), mine-on-river rejects, and rivers STAY IRRIGABLE (control
— B19 didn't break irrigation). Red-first (scenario steps 0+2, 2 unit
tests); revert-proof the guard block. Full suite 315/315, twins green.
ADJACENT FINDING flagged to architect (NOT reopened): Mine(Civ1) lists
only desert/hills/mountain as minable, in tension with B17's accepted
'mine-plants-forest transform is Civ 1' — summary page may omit
transforms; left for architect ruling, out of B19 scope.]

### B16 — Turn-371 save: history diverges from BOTH engine versions at turn 328 (wave VIII follow-on; bugfixer — B0 machinery, high interest)

The user's `debugging/logs/retromulticiv-turn371.json` carries the
A47 diag envelope (initialState turn 325, 721 entries). ARCHITECT
PRE-TRIAGE: extraction + replay works (entries 1–51 = turns
325–327 MATCH), then round→turn-328 diverges — computed 0x9a470f60
vs recorded 0x089ce1bd — and stays divergent. CRITICAL FACT: the
pre-stances engine (fdbfe3a) computes BYTE-IDENTICAL hashes to
HEAD, so both repo builds agree with each other and disagree with
the recording: NOT an identity violation, NOT an engine regression.
Hypotheses, in order: (a) the user's browser served a STALE-CACHED
module mix mid-session (a reload across one of today's pulls
re-fetched some modules but cached others — a mixed-engine client
records an unreproducible trajectory); (b) a mid-session
build-boundary reload with real engine differences (harder to
square with 325–327 matching TODAY'S engine); (c) something in the
A47 seeding path corrupts recorded round hashes after N turns
(check the seeding code path — this recording came through a LOAD).
Bisect with the first-divergence discipline: canonical-diff entry
52's recorded vs computed state if the recorded canon exists;
inspect what round 328 DID differently (which AI decision forked).
If (a), the FIX is operational: cache-busting headers from the
python/server static paths (or a build-stamp check in the client
that warns 'your modules are mixed'). USER QUESTION PENDING: did
he reload the tab / pull mid-game around turn 328?

[done: bugfixer 2026-07-16 — ROOT CAUSE: none of (a)/(b)/(c). THE
RECORDING IS PERFECT — the game ran on TRAINER difficulty and the A47
diag block inside Shift+S saves dropped rulesOverrides, so every
extraction replayed under DEFAULT rules. Proof: with contentCitizens 6
all 721 entries replay clean, 675 cmds + 46 rounds -> turn 371, final
hash 0xd83254b8 == the save's own state hash; the pre-triage's computed
0x9a470f60 reproduces bit-for-bit under contentCitizens 4 (default) —
the 325-327 "match window" is just where no city crossed the content
threshold. Nothing was wrong with the user's session; the pending user
question is withdrawn. FIX: (1) saves.js buildSaveEnvelope (factored,
DOM-free, red-first) embeds diag.rulesOverrides ({} = default-recorded;
absence = pre-B16); (2) tools/replay.js normalizeReplayInput accepts
local save envelopes natively — hashState(save.state) is the recorded
final truth, pre-B16 envelopes get a one-line phantom-divergence
warning (triage.sh now handles save files without hand extraction);
(3) test/save-envelope.test.js: envelope pin + native-replay pin + the
finding itself pinned on the REAL turn-371 file (self-skips if absent):
under contentCitizens 6 it must replay with zero problems — if that
ever reds, the engine actually regressed against this game's history.
FLAGGED for architect ruling (not fixed): loadStateObject ignores the
save's difficulty — cross-difficulty loads silently change rules AND
make the composed A47 recording unreplayable by construction. Suite
277/277.]
[follow-up done: bugfixer 2026-07-16 — APPLY-ON-LOAD landed per the
ruling (@1220b527/@e849e7f4, no dialog): saves.js applyLoadedRules
(exported, DOM-free, red-first) rebuilds the live rules IN PLACE as
base + the save's recorded overrides (same object — the engine closure
picks it up), updates ctx.rulesOverrides so the next envelope stamps
the loaded truth, and hud-notes '⚖ rules from save: Trainer difficulty'
(named via a local difficulty map; {} = silent reset to base; pre-B16
saves without the field stay untouched — unknowable). main.js passes
ctx.baseRules. Covered in test/save-envelope.test.js incl. the
compose-through-Shift+S case.]

### B14 — ZOC across domains: land units should not zone-control sea (wave VIII.18; bugfixer — wiki first)

Check Civ 1's actual rule in the wiki extract: does land ZOC bind
adjacent SEA movement? The user believes not (barring special
units). If our engine diverges from Civ 1: engine fix = movement
legality change = golden window + both engines + a scenario pin.
If Civ 1 agrees with our current behavior: document in docs/01 §11
and close with no change.

[done: bugfixer 2026-07-15 — CLOSED NO-CHANGE, wiki as authority: the
Civ1 ZOC statement (Zone of control page, civ1 overview) carries NO
land/sea exemption — only Diplomats, Caravans, and nuclear weapons
ignore ZOC (and Civ2's page shows the contrast: THAT game exempts
non-ground units explicitly, Civ1's does not). So land units binding
adjacent sea movement matches Civ 1; the user's expectation is a
Civ2-era memory. Documented in docs/01 §11. TWO NEW DIVERGENCES
surfaced from the same source, mailed for queueing (not B14's scope,
both are engine legality changes = golden window): (1) enemy CITIES
should exert ZOC — inEnemyZoc checks units only; (2) diplomat/caravan/
nuclear should IGNORE ZOC — all three exist in data/units.json, engine
has no exemption path. No code change, no test-count change.]

### B15 — Save-code banner has no dismiss and never leaves (wave VIII.19; bugfixer — B6 regression check FIRST)

"Saved turn 371 — game code … Every player should note it" persisted
through turn 379 with NO ✕. B6 fixed exactly this family (#code-toast
scoped .hidden) — first check whether this is a REGRESSION of B6's
case (does its test still pass? does the live path differ from the
tested one?) or a SECOND banner path (LAN autosave notice?) that
never got the ✕/auto-dismiss. Failing test first; the B4 sweep
pattern applies if it's another inert-hidden site.

[done: bugfixer 2026-07-15 — TRIAGE: NOT a B6 regression (e2e toast guard
green, #code-toast.hidden scoped, live path = tested path: the turn-371
envelope proves local Shift+S announceSave, whose showCode always injects
the ✕) and no second banner path (showCode's 3 call sites all carry it).
VERDICT: the ✕ existed but was a subtle gray 1px button, and persistence
is docs/07 BY DESIGN — the user couldn't find the dismiss. FIX (intent
kept): the whole toast is now a click-to-dismiss target (cursor:pointer +
title), Escape dismisses (INPUT-guard honored), ✕ restyled bold "✕
dismiss". PROOF: ?e2e=1 probe extended (body-click hides; re-shown toast's
✕ hides — both computed-display, not class); browser.test.js asserts both;
revert-proof run: red without the click-anywhere hunk, green with it.
Suite green (assertion-level additions, no new test count).]

### B12 — East-west wrap: can units actually traverse the seam? (wave VII item 3; assigned: bugfixer, triage first — USER CONFIRMED VIII.11: traversal WORKS east-west, but the move-hint ARROW never shows across the seam (black tile, no arrow) — so the engine wraps and the CLIENT adjacency/hint math doesn't; the |dx|<=1-without-wrap suspicion is now the primary target, and A65's wrap-seam pathfind test gives the fixed reference behavior)  [done: bugfixer 2026-07-15 — TRIAGE VERDICT, measured: the |dx|<=1-without-wrap suspicion is FALSE — move-hints stepDir/canStepTo wrap correctly BOTH directions incl. diagonals (probed live + pinned in test/move-hints.test.js "B12: seam steps show the arrow both directions"). ROOT CAUSE of the missing arrow: the terrain mesh spans exactly x 0..width-1 (terrain.js gw=width*SEGS, plane at (width-1)/2) and the camera pans freely past the edge — beyond the seam there is NO GEOMETRY, castAt's raycast MISSES (index.js:281 returns null), so no pick ever reaches the affordance; the user's "black tile" is the void background. The fix is seam RENDERING (edge-ghost columns with modulo pick-mapping, or fly-across) — exactly the "later polish call for the user" the item already names; escalated, not implemented. Suite 259/259.]

The map wraps east-west (mapgen, rendering, neighbors()). The user
believes units cannot walk OFF the east edge onto the west edge.
TRIAGE ORDER: (1) engine — a movement unit test crossing x=width-1 →
x=0 (neighbors() almost certainly wraps; prove it); (2) if engine is
fine, the CLIENT: the adjacency/move-hint/GoTo checks may compare
x±1 WITHOUT wrap (the classic |dx|<=1 test fails at the seam), and
the renderer seam has no duplicated columns so a wrap move may look
like a teleport (acceptable v1 — a fly-across or edge-ghost columns
is a later polish call for the user). Fix where the truth says;
scenario or unit test pinning the seam crossing either way.

## R-queue — roblox-helper (second PC; spec = docs/10-roblox-agent.md)

Cross-machine coordination: code travels via GIT (the user pumps
commits both ways); mail + file locks work LIVE across machines through
the agent-mail LAN hub (docs/10 §4 — `.agent-mail/remote` on the
second PC). The lane fence in docs/10 §2 is absolute. Items below are
self-contained; claims/dones in-file like everyone else's.

### R1 — Rojo scaffold + the three anchors printed inside Studio  [claimed: roblox-helper 2026-07-14] [done: 2026-07-14 — all four anchors PASS in Studio Play Solo (xorshift seq 2714967881/2238813396/1250077441/3820100336, hashState 0x30db1e29, codeHi 0xa687b72d, gameCode AD1X-Q5MR-DP7H9); rojo build green from clean tree; roblox/check.sh (build+mapping+anchor-drift) ALL GREEN; luau/ ran UNMODIFIED in the Studio VM incl. gamecode's relative string require; scaffold contracts in roblox/SPEC.md]

Per docs/10 §3+§5: roblox/default.project.json (maps ../luau into
ReplicatedStorage), src/server/VerifyAnchors.server.luau requiring the
bugfixer's rng/statehash/gamecode modules and printing the gate values
(docs/09 §1: xorshift sequence, 0x30db1e29, 0xa687b72d,
AD1X-Q5MR-DP7H9), roblox/README.md (rojo serve + plugin connect).
Done = `rojo build roblox -o build.rbxlx` green from a clean tree +
the Studio output pasted verbatim in the done-note. If luau/ hasn't
reached your clone, scaffold with a placeholder and say so.

### R2 — Static world render (Parts)  [claimed: roblox-helper 2026-07-14] [done: 2026-07-14 — converter roblox/data/build.js (mock-state.json + terrain.js TERRAIN → committed MockState/TerrainPalette.luau, --check wired as check.sh gate 4) + RenderWorld.server.luau (terrain columns w/ 3-shade position-hash, unit discs+bodies, city plaza+skyline; 2 demo cities baked). Studio: '[RenderWorld] R2 static scene: 24x16 tiles, 4 units, 2 cities', anchors still ALL PASS. Screenshots READ: top-down (both arctic edge rows, 2 continents, ocean-as-Glass finding → fixed to SmoothPlastic) + close angled (3-shade grass mottle, tan plains, city block cluster, settlers wagon on blue owner disc). check.sh 14 gates GREEN. Finding: ocean palette reads slate-grey under Studio lighting vs JS sea — parity pass only if wanted]

Render a baked state (client/mock-state.json as read-only reference):
terrain as colored Parts (renderer/three/terrain.js TERRAIN table =
palette/height reference), units as Part groups with owner-colored
base discs, cities as clustered blocks. Screenshot, READ, describe in
the done-note. No engine calls yet — a static scene.

### R3 — Camera + logical-tile selection  [claimed: roblox-helper 2026-07-14] [done: 2026-07-14 — Camera.client.luau (Scriptable; LMB-drag orbit POLLED per frame since mouse events arrive pre-sunk by default controls, RMB-drag grab-the-map pan clamped to map, Q/E focus lift, wheel zoom; WASD stays with the avatar per user playtest) + Select.client.luau (pick = hit POSITION rounded to tile w/ normal nudge, never the hit body — A28; 5px click-vs-drag threshold; neon cursor CanQuery=false). Click test verbatim: settlers body-click → 'tile (5,4) grassland — unit u1 (settlers, p1)', city block → 'tile (6,4) grassland — city DemoCity p1 (p1)', flanks resolve to own tile; controls verified hands-on by user. R3.png READ (cursor on tile, both continents). check.sh 16 gates GREEN. Visibility finding mailed @77b4ae09 (banked below). DEFERRED user request: follow-avatar camera mode. Tooling: rojo serve must run NATIVELY on Windows (C:\GIT\rojo\rojo.exe) — a WSL serve on /mnt/c is inotify-blind and goes silently stale]

Orbit/pan camera; click-to-select resolving to TILES (logical
hitboxes, never visual bodies — A28's mid-glide lesson). Selection
highlight Part. Screenshot + a described click test.

### R4 — GameServer: the live engine loop over RemoteEvents (assigned: roblox-helper 2026-07-14 — the engine column is CLOSED, P5-8 accepted)  [claimed: roblox-helper 2026-07-15] [done: 2026-07-15 — ACCEPTANCE GREEN: user played 36 turns in Studio (98 commands, 35 rounds, incl. a lost combat); assemble.js replayed EVERY per-command + per-round hash exact through the Node engine, createGame parity (initialHash 0x0ca5d97c both sides), final gameCode BA05-2M69-QYHRN agrees — the phase-5 live cross-language proof. Boot data gate 8/8 (json2lua-parsed rulesets vs statehash pins). Chunked AI round (task.wait/AI), filterView/filterEvents only, join handshake client-initiated, playerId server-stamped. Fogged R4.png READ (void + dim ring + HUD). Log committed roblox/acceptance/run1.txt. Playtest fixes landed same-day: ScreenPointToRay (ViewportPointToRay + UIS coords = GUI-inset offset, the '60% across the tile' click bug), template Baseplate destroyed at boot (buried ocean columns), StreamingEnabled pinned false (fog pop-in suspect). Banked for R5+: city view/production picker, morph-into-unit avatar mode + N-next-unit (user request)]

The port's engine is done (all ten pins, five goldens, five replay
verdicts agree Node ≡ lune; anchors ≡ Studio). R4 makes it a GAME:
`GameServer.server.luau` owns the authoritative loop; clients see
only filtered views. Single Studio instance is the R4 scope (one
human seat + AI opponents); multiplayer seats/regency are R5+.

1. **Server loop**: engine.createGame from the committed rulesets
   (json2lua output) with a fixed seed for the acceptance run;
   applyCommand/endTurn exactly as session.js sequences them —
   including the chunked AI rounds pattern (one AI player per
   heartbeat step, the A30 lesson transplanted: no frozen frames).
2. **The visibility law (banked @77b4ae09)**: every state push to a
   client is `filterView(state, seat)`; events ride
   `filterEvents`. The client render/selection consume the VIEW,
   never raw state — RenderWorld rebuilds from view pushes (explored
   tiles only; unknown = void, exactly the JS client rule). Selection
   output prints view contents only.
3. **RemoteEvents protocol**: mirror the ws shapes (docs/06) —
   {t:'view'}, {t:'cmd'}, rejections with reasons — so the protocol
   knowledge transfers; Roblox identity (UserId) IS the seat binding,
   no tokens needed in-Studio.
4. **Input → commands**: R3's selection picks the unit/tile; a
   minimal action surface for R4 = move (click destination), found
   city, end turn. The full action bar is R5.
5. **Follow-avatar camera toggle** (banked user request): map-cam
   focus optionally tracks the character; free cam stays primary.
6. **ACCEPTANCE — the live cross-language proof, FORMALIZED per ally
   round-5**: play a complete game (or N substantial turns) in
   Studio; the server prints the command log + per-COMMAND hashes to
   Output; replay the log through BOTH engines (tools/replay.js and
   luau/replay.luau) — the canonical state hash must match after
   EVERY command i (H_browser(S_i) == H_Luau(S_i) for all i), and
   the final game verification code must agree. A Studio-PLAYED game
   replaying exact in JS is the phase-5 promise made flesh. Also:
   anchors re-printed same run; check.sh gates green; screenshots
   READ (fogged world from the seat's view — the void must be
   visible in the shot).
Lane: roblox/ exclusive as ever; luau/ consumed read-only.

### R5 — Playable-depth pass: city view, unit possession, fog verification (assigned: roblox-helper 2026-07-15)  [claimed: roblox-helper 2026-07-15]

R4's acceptance is PASSED (run1.txt: all 98 command hashes match,
game code agrees, pre-registered boot hash hit). R5 makes the Studio
game worth playing longer, per the user's own playtest asks:
1. **City view + production picker** (his first friction: waiting on
   default builds): click own city → panel with population, yields,
   current build + the production list (from the FILTERED view's
   city data; the browser catalog rules apply — buildable shown,
   tech-locked greyed). setProduction + buy as RemoteEvent commands
   through the same dispatcher path.
2. **Morph-into-unit avatar mode** (his idea, the most Roblox-native
   of the phase): "possess" a selected unit — avatar rides it, WASD
   steps it one tile per press (engine move commands, ALL rules
   apply — no free movement), N jumps to next unit, Esc/F releases
   to free cam (R4's follow-avatar machinery reused).
3. **StreamingEnabled fog verification** (R4's open suspect, pinned
   false in project.json): a fresh run must show NO fog
   glitch-in/out; report the verdict either way.
4. **R5+ SCOPING ONLY, no build**: one paragraph each in the
   done-mail on (a) multiplayer seats (UserId→seat exists; what 2+
   players in one server still needs) and (b) persistence (DataStore
   vs the envelope pattern). These become R6 with the architect.
Acceptance: a second recorded run (run2.txt) INCLUDING production
changes + possessed-unit moves, replayed hash-exact both engines
(the R4 bar is the standing bar now); screenshots READ (city panel,
possession cam); check.sh green; anchors re-printed.

Also still banked: nothing — both R3-era notes are folded into R4
above.

### R6 — Tier-1 parity: the core-loop actions (cut from docs/13 amended Tier 1; assigned: roblox-helper — run2 acceptance for R5 stays pending in parallel) [claimed: roblox-helper 2026-07-16 @239ff322; code-complete @b3084114]

The browser's core-loop UI reaches Studio, per the review-round
ground rules (ScreenGui actions / Billboard info; every hotkey
chat-focus-guarded; view-only + commands-only):
1. **Action bar**: fixed bottom ScreenGui — the selected unit's
   applicable actions with hotkeys (fortify, skip, irrigate/mine/
   road, disband; GoTo enters a target-pick mode via Select's
   machinery, Esc cancels).
2. **Research picker**: current tech + bulbs/turn + the pick-next
   list (one-ring-ahead rule), setResearch through the dispatcher.
3. **Tax/science steppers** (+/- per the review ruling; A29
   snap-back on rejection).
4. **Turn log, server half FIRST**: GameServer collects per-round
   events (replace the eventsOut=nil), filterEvents per seat, push
   with views; then the client scroll-frame renders the feed
   (major classes; the B5 fog rules verbatim).
5. **Move hints**: reachable-tile tint for the selected unit
   (fog-approximate by construction — documented, not a bug).
ACCEPTANCE: R4 bar — a recorded run exercising every new command
path replays hash-exact both engines; screenshots read per surface.
pathfind.luau (the A65 port, subset-ready) may land here if GoTo
wants it — your call, flag it.

### R7 — Roblox-Playtest-B batch (user's run2 feedback, 2026-07-16; assigned: roblox-helper) [claimed: roblox-helper 2026-07-16 @d11b4054 — R7a first, R7c design-first untouched]

The user's 16 items from the 88-turn Studio session, triaged by the
architect. Numbers below are the user's (Roblox-Playtest-B N).
View/UI-only unless flagged — nothing here touches engine state.

**R7a — small UI corrections (do first, one sweep):**
- (4) Action bar: actions unavailable to the selected/mounted unit
  render grayed + disabled (view-side legality precheck; server
  still judges — A29 pattern, display-only).
- (1) Production picker: HIDE entries not buildable with current
  OR next-reachable tech (one-tech lookahead filter). Browser shows
  locked-with-reasons instead — divergence ACCEPTED for Roblox
  (screen space); noted in docs/13.
- (15) Next-unit skips FORTIFIED units (browser parity —
  client/ui/input.js:255 semantics: skip fortified/working unless
  explicitly selected).
- (12) Next-unit ordering: NEAREST-first from the unit the call
  was made from (client-side pick order, camera stops jumping).
- (9) Double-click a friendly unit while mounted → mount rides to
  it (same path as N-next movement).
- (5) "Auto next unit" option, DEFAULT ON for new users (advance
  on unit exhausted; option to disable).
- (7) Auto end-turn DEFAULT ON when all units moved + a center-
  screen hint when manual end-turn is still required (browser has
  the option; Roblox flips the default — noted in docs/13).
- (6) Research button OUT of the unit action bar → top-center
  cluster (reserves slots for diplomacy + statistics later).
**R7b — unit/world presentation:**
- (8) Per-unit billboard label: unit name + att/def + movement
  left as short bars at the model base (fog-respecting: rivals
  show only what the view carries).
- (10) Found-city: grayed when too close per rules (view precheck)
  + site rating as a 1–3 star label on the settler model (the
  Tier-1 site-preview row, now with the user's shape).
- (11) Research-complete notification: splash with the discovery
  (name, effects from view data — never wiki prose) + blinking
  Research button until the next pick is made.
- (2) VOID COVER: baseplate + backdrop outside the map so avatars
  never fall into the void (physical guard = invisible walls or
  kill-plane respawn). ART DIRECTION = the soundboard pattern:
  build BOTH cheap variants — (i) Dutch-Golden-Age ornate map-
  border frame, (ii) galaxy skybox (stars/nebulae, earth-map-in-
  space) — screenshot both, the user picks by eye. Own-art/
  procedural only (license discipline — no imported textures
  without clearance).
**R7c — design-first (architect + user before build):**
- (3) City-view worked-tile mode: 3D in-world city-limits +
  worked-tile indication, per-tile resources as hover objects or
  decals; allocate workers by tapping tiles (the docs/13 Tier-2
  worked-tile row, promoted with the user's 3D direction).
- (13)(14) Left-side on-screen button cluster (follow-avatar etc.
  + ride-mode movement pad) — click-only friendliness, NO keyboard
  assumed; (14) explicitly design-later per the user.
- (17) Debug/dev menu (LOCAL DEV ONLY): give gold to any civ,
  spawn unit at location. NOT view-side — state mutation must be
  ENGINE COMMANDS (debug-gated command family, recorded in
  replays so verification survives; server --debug analog).
  ARCHITECT designs the command surface first (new A-item when
  scheduled); the Roblox menu is the thin client of it.
ACCEPTANCE: R4 bar for anything command-adjacent; screenshots per
surface; run3 folds R7a+R7b. setRates exercise + fog verdict +
per-surface screenshot READ (the run2 leftovers) close with it.

**R7d — browser-parity fill (user ask 2026-07-16: "more of what
the browser already has, before I playtest"; view-data-only, no
design session needed, no new commands):**
- COMBAT ODDS PREVIEW (closes the last active Tier-1 row): long-
  press/hover an attackable target → Billboard with odds + the
  multiplier breakdown, browser string as the spec
  (client/ui/input.js:26 shape: "⚔ Favorable 67% — Legion 300 vs
  Militia 150 (mountains +200%, fortified +50%)"). Same math as
  the browser preview — read-only vs the view, server still
  judges the actual attack.
- GAME CODE HUD CHIP (docs/07 trust loop — must stay visible):
  code shown on the HUD, selectable TextBox for copying.
- CITY LIST / PAGING (Tier-2): panel with arrows, tap a row →
  camera to city + open its panel.
- STATISTICS PANEL (the reserved top-center slot): the browser's
  view-statistics content in table form — per-civ score
  components, cities/pop/techs; charts stay browser-only for now.
- END-TURN THREE-STATE polish (A29 grey/pulse/confirm — the
  "partially in R4's Hud" row): finish to browser parity.
Acceptance: screenshots per surface; odds preview numbers spot-
checked against the browser for 2–3 identical setups; runC covers
it with R7a/R7b.

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

## A28 — Art A1.7: animation polish (ally spec §"Art A1.7", golden-safe, pulled forward 2026-07-13)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — new renderer/three/anim.js layer, all phases clock+position (A15 pattern, zero engine RNG/state): pennant+capital flags on sway hinges (rest pose byte-identical — land-only gallery shots byte-stable across runs; full-view 3-byte drift attributed to pre-existing A15 water); 200ms glides keyed by unitId (rebind across rebuilds, chain drift-free, wrap-seam snaps like setPath); deterministic city smoke pop≥5 (visualRand, placement biased OUTWARD of the pop-badge overdraw — found via screenshot read); combat flash ring on viewer-involved combatResolved via session.onChange events (fog-safe, pairs with A16 linger); ⚙ reduceAnimation option + ctx.options.watch() live hook. Picking logical-tile-native by construction; PROVEN by new ?e2e=5 + browser case: deselect → step → mid-glide click (animBusy:true) re-selects the settler naming the DESTINATION coords. Gallery gained rest-pose default + ?anim/?flashdemo/?glidedemo hooks. WebGL1 pass clean. Suite 199/199 post-golden-close. Motion smoothness itself = eyeball check for the user.]

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

## A29 — Wave VI quick wins: HUD civ, GoTo flush, End-Turn states, two UI fixes (VI.1/4/6/10/12)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — (1) status line "Romans (Kjell)": player.civ + session.playerCivs fallback, name-alone for mock, civ-named local seats collapse the parens; lobby-boot test assertion evolved to the new format. (2) endTurn flushes viewer runAllGotos first + idle warning excludes routed units (blocked routes stop nagging). (3) updateTurnButton: disabled+no-op off-turn, 3-blink arrival pulse, respects reduceAnimation; A40 "Auto Turn" marker ON the function + CSS. (4) slider snapback on rejected setRates — PROVEN by new ?e2e=6 (drag to 100 under despotism cap → thumb === real rate). (5) sitePreview shows plain tile text inside KNOWN cities' spacing zones via engine citySpacingOk (VI.5 metric), explored-only = fog-safe. Screenshots: local HUD civ line read; spectators render no End-Turn button (A17) so greyed/pulse visuals = manual LAN check note. Suite 200/200.]

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

## A30 — AI-turn waiting indicator + chunked AI rounds (VI.3, medium)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — session.endTurn yields one macrotask per AI player with per-player event DELTAS; DETERMINISM PINNED by test/session.test.js: chunked round vs unchunked twin — same hash, deepStrictEqual event stream, byte-identical {t:'round'} recording. New contracts (tested): apply/endTurn reject 'roundInFlight' mid-round (recording order protected); loads announce via synthetic stateReplaced event (empty notify = repaint — the old convention would wipe turn-log contacts every repaint; also fixed session-remote's code-refresh notify([]) silently re-baselining on every save). Wait line: local shows only while AI moves (curtain owns human hand-offs), "(AI)" tag both modes. Visible proof: ?e2e=7 MutationObserver catches "(AI) is moving" DURING endTurn + hides after. Suite 204/204.]

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

## A33 — Save code into the turn log (VI.7)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — session-remote {t:'code'} emits synthetic {type:'saveCode'} ONLY on change (stateReplaced convention); turnlog narrates "💾 saved · code …" once per wrap, spectators included, classed 'saves' for A39's filters. No cadence knob (one/wrap read fine; 5-line follow-up if noisy). Suite 210/210.]

When the server's autosave broadcast delivers a game code at a turn
wrap, add ONE turn-log line per turn for every player (incl.
spectators): "💾 saved · code FWN6-X6PQ-3X5TD". Use turnlog.note()
(A26's export). Dedupe: only when the code CHANGES (it changes every
round — fine, one line per round wrap; if the log gets noisy make it
every N rounds via an Options value, default every round). Coordinate
with B6 (same broadcast). Golden-safe.

## A39 — Turn-log filters (user request 2026-07-14, relayed via bugfixer @5d452697)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — PURE mapping module turnlog-classes.js (unit-tested headless): ownership splits combat/cities vs 👀 rival, world absolute, saveCode → saves; filter row ON the log panel (⚙ filters → checkboxes, 🌍 world always-on with inline note), persisted 'logFilters'; DISPLAY-time filtering via lg-<class> entries + hide-<class> container CSS — retained history reappears on re-check. Load-bearing addition: turnlog now gates ALL narration through engine filterEvents (B5's per-seat filter) — enables rival narration (battles/foundings/conquests in view, both modes) AND closes the local-omniscient-events fog gap. Shots read: all-on + cities-off (entry absent). Suite 210/210.]

B5 made LAN turn logs chattier by design (rival visible actions now
narrate live) — give each player a filter. A small filter row on the
turn-log panel itself (a ⚙/funnel toggle revealing checkboxes — NOT
buried in the Options panel; the log is where you notice the noise),
persisted per-origin with the other prefs. Classes, mapped at
NARRATION time in turnlog.js (filter the display, never the data —
toggling a class back on reveals the suppressed history from the
retained entries, within the existing 60-entry cap): ⚔ combat ·
🏛 cities (founded/grew/production/captured) · 🔬 research ·
👀 rival actions (the B5 live narration) · 🌍 world news
(wonders/defeats — consider leaving this one always-on, it's rare
and load-bearing) · 💾 saves (A33's code lines). Defaults: all ON.
Spectators get the same filters (they see the most traffic).
Verify: unit-test the event→class mapping as a pure helper; screenshot
the filter row open with one class off and its entries absent; e2e
green. Golden-safe, client-only. Pairs with A33 — do them together.

## A34 — Host resumes server saves from the lobby (VI.9, medium — design included)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — {t:'listSaves'} scans saves/ basenames only (foreign files skipped), newest-first w/ turn/year/players/CODE/loaded; {t:'resume',file} double-locked (parser basename shape + server-side saves/-scoped resolution), loads via the EXISTING --game path + ALWAYS resetSeats (joiners re-pick by name — the teaching flow automatic) + registry.register; autosaves continue into the same file; live re-resume = no clobber. Host form gains the picker; resumed → auto-join by gameId → shared joined boot. INTERPRETATION FLAGGED: register machinery = started game, direct seat-bind (no waiting room) — docs/07 code visible at picker/resumed/joined, ws-asserted end-to-end; room-wrapped variant offered as follow-up. Shot-read finds: user's real saves listed (live proof) + pre-docs/07 codeless save rendered "code undefined" → fixed. Also fixed: architect's ?lobbydemo null-guard find (setup.js). ws test: inventory shape, traversal reject, code chain, join-by-name, no-clobber. Suite 226/226.]

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

## A35 — Spectator hover info (VI.13)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — cursor tooltip chosen over the hud line (spectators scan wide; info at the point of attention); #spectator-tip fixed near pointer, input.js tracks coords itself (no renderer-contract change), ctx.SPECTATOR-gated so player hover untouched. Unit line = stat-card format w/ civ-first names; SHOT-READ FIND: garrison mesh-hits swallowed the city tooltip → two-line form, city leads + garrison follows. Evidence: crafted turn-61 server save (new batch-4 AI world) + ?spechover=unit|city hook; both shots read. Suite 216/216.]

Spectators (omniscient) get hover tooltips: units — civ, type,
attack/defense/moves, veteran; cities — civ, name, population.
Reuse the hover pick + the unit stat-card formatting; render as a
small tooltip near the cursor or reuse the hud note line (pick
whichever reads better in the shot — show me both if unsure).
Players' hover behavior unchanged (fog rules already limit them).
Verify: spectator screenshot with a tooltip visible over a rival
unit AND a city. Golden-safe.

## A36 — City names on the map + growth tiers (VI.14, renderer — medium)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — CITY_TIERS five breakpoints {1/4/8/16/28 → 3..15 houses ×1.0..1.7}, cityTierFor exported, walls at every tier; mock-state.test source-parses the table (ascending, dense+tall monotone, pop-1 anchored). Gallery row 7 = the five tiers (INTENDED regen; faction capitals redistribute 5→3 houses at tier 1). Names: tinted-border pill SHIPPED over plain (14-civ grid comparison), fog-safe via view shells; two shot-read finds fixed — badge overlap (pill → +0.62) and default-zoom illegibility (pills rescale with cam.dist 0.8–2.2, "Testopolis" legible at dist 18). WebGL1 pixel-equivalent. Suite 217/217.]

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

## A37 — Lobby chat + host moderation: kick / kick-and-block (VI.15 — design included)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — chat: 200-cap in parseMessage, 1/sec/conn in router, client inserts via textContent (NO innerHTML path at all), XSS proven in-suite (real-server round-trip, payload renders inert); create checkbox + live toggle ('chatOff'). Kick: host-only lobby-only {t:'kick',seat,block?}, self-kick rejected, kicked gets friendly screen + severed membership, seat frees; block = per-game IP list, rejoin bounces 'blocked'. IP-on-hover: host's roster copy alone carries IPs (dual broadcastLobby payloads). UI: explicit ⛔ → [kick][+block][✕] confirm; silent setSlot flip STILL rejects occupants. ws integration case (cap/rate/toggle/auth/self-kick/free/notify/block) + XSS browser case. Shots: live host chat room; kick-confirm/joiner/blocked via ?lobbydemo crafted-roster hook (live two-client shot dies under virtual time — known family; behavior socket-tested). Bonus: join seat-picker p1–p7 → p1–p14 (A38 miss). docs/08 §6 supersession line → architect sync. Suite 224/224.]

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

## A40 — AI regency: "let the AI take over for me" with 5 stances (user request 2026-07-14 — design included, TWO SLICES)  [slice 2 done: coder-helper 2026-07-15 — regency plumbing, golden-safe (sim 6/6 unchanged, no ai.js touch). Regent HUMAN turns log INDIVIDUAL cmd entries (playRegentSeat via real pickCommand), AI chains stay round entries → replay re-applies vs re-derives = hash-exact (PROVEN local + server unattended-play tests). LOCAL session.js setRegent/regentTurn re-kicked per turn (instant take-back); SERVER game.js regents parallel map (never state, envelope-persisted) + index.js driveRegents YIELDS between turns (solo-to-gameOver block was a real caught bug) + presence regents tag + seat-owner-only {t:'regent'}. UI regency.js: 🤖 left of End Turn, 5-stance dialog, grayed "Auto Turn" = the A29 marker's one branch; A45 replaceState param trap hit again → module-eval capture. Shots read: dialog + Auto Turn. SLICE 1 (stances) still needs the both-sides golden window (ai.js+ai.luau twin per ruling). Suite 236/236.]

The docs/08 §7 future feature, now specced by the user: a 🤖 button
LEFT of End Turn opens a dialog — hand your seat to the AI with a
stance: **Defensive / Aggressive / Science / Growth / Balanced**
(default Balanced). While the regent plays, End Turn is grayed and
reads "Auto Turn"; clicking the 🤖 (or the grayed button) takes
control back. Defaults CONFIRMED by user (2026-07-14): the regent ENDS
TURNS automatically; in LAN games regency PERSISTS across disconnect
(close the laptop, the AI plays on — the waiting-for-player flow skips
regent seats); available in solo, hotseat, and LAN alike;
seat-owner-only toggle in LAN.

**Slice 1 [done: coder-helper 2026-07-15 — STANCES table in engine/ai.js AND luau/ai.luau (twin); pickCommand/runAiTurn gain optional stance; BALANCED IS THE IDENTITY (knobs = historical literals → every substitution arithmetically unchanged). Knobs: marchRadius (defensive 0 / aggressive 14), garrisonAlways2 (defensive), armyCap (aggressive 6/8), settler ratio (growth 3/1), buildPriority (defensive walls / science library / growth granary), improveFirst (growth irrigate-first), sciRates (science-only new setRates branch, gated so balanced never reaches it). Regent stance wired through session.playSeatLogged + game.playRegentSeat. GOLDENS HELD: sim 6/6, luau twins turn-100 checkpoint 0x560088f5, natural, scenarios, full 245/245 — the identity is proven by every golden staying green. Unit tests: identity (balanced/undefined/unknown byte-identical) + 4 stance behaviors. Window kept OPEN for bugfixer B11 policy factoring per architect one-window preference.]**
**Slice 1 (original spec) — engine stances (GOLDEN-SENSITIVE, architect reviews the
identity proof):** `pickCommand`/`runAiTurn` gain an optional `stance`
parameter. HARD REQUIREMENT: `balanced` (and the omitted default)
must be BIT-IDENTICAL to today's behavior — the unchanged sim goldens
ARE the proof; run them before and after. Biases live in one visible
STANCES table at the top of ai.js (AI constants precedent — behavior
knobs, not ruleset facts): defensive (threat garrison 2 always,
aggression radius 0, walls-priority in saturated builds), aggressive
(army cap raised, aggression radius widened, attack bias), science
(rates prefer sci when disorder-free, library/university priority),
growth (higher settler ratio, granary priority, irrigation-first
improvers). Unit tests per stance on crafted states + the identity
assertion.

**Slice 2 — regency plumbing (golden-safe):** LOCAL: session drives
the seat via runAiTurn(stance) on its turn; commands record as
ordinary cmd diag entries (replay needs NOTHING new — docs/08 §7's
principle). SERVER: `{t:'regent', stance|null}` seat-owner-only;
`seats[pid].regent = stance` (server-side seat property, NOT game
state — state.human stays true, hashes untouched); the server drives
regent seats' turns with the engine AI, logging commands normally;
presence/wait-line shows "🤖 <name> (auto)"; rival/spectator views
unchanged. UI: the dialog (5 stances, Balanced preselected), the
grayed "Auto Turn" state (pairs with A29's button-state work), 🤖
placement left of End Turn. Tests: server test — a regent seat plays
a full turn unattended, its commands land in the save's diag, replay
hash-exact; reclaim mid-game returns control cleanly; e2e screenshot
of the dialog + Auto Turn state.

Slice order: 2 can ship with stance=balanced only (regency without
flavors) if 1 waits on the golden window — flag if you take that path.

## A42 — Setup/splash screen refresh: honest copy + a first-visit flourish (user, 2026-07-14)  [slice 1 done: coder-helper 2026-07-14 — tagline replaced with the three-ways-to-play copy; civ count DATA-DRIVEN via max(rules.maxCivsBySize) rendered into #setup-maxciv-line ("Up to 14 civilizations." today, self-updating); splash screenshot read; browser suite green. Slice 2 done: coder-helper 2026-07-14 — bootstrap seam AVOIDED: setup owns a lazy renderer instance w/ crafted 14×10 coast view (walled harbor city Roma + legion/settlers/trireme/rival cavalry, zero new assets); A28/A15 animate themselves + 9s sine camera drift; radial vignette keeps the card readable. Gate BEFORE the import: seen-flag/reduceAnimation/demo-params/navigator.webdriver all skip — suite untouched by construction, return visits literally zero-cost; ?splash=1/0 force-override; WebGL-fail → plain screen automatic. Shot-read reframe: city moved from behind-the-card to the left band. Shots: first/return/WebGL1 read. Suite 229/229.]

**Slice 1 — the copy (fold into your NEXT stop, it's minutes):** the
tagline "One engine, one world, 4000 BC. Humans play first, in seat
order — pass the keyboard when your turn ends." predates LAN,
spectators, starting ages, and AI options. New copy must be TRUE and
DATA-DRIVEN where it counts: player count from
rules.maxCivsBySize (today "up to 14 civilizations" on medium+ — it
updates itself when the 16-civ roster lands; never hardcode), and
mention the three ways to play (solo vs AI · hotseat · LAN with a
join code) + starting ages. Keep it to 2–3 short lines — it's a
splash, not a manual. Architect's suggested shape, wordsmith freely:
"One deterministic engine, one world, 4000 BC — or any age you pick.
Play solo against the AI, pass the keyboard in hotseat, or host a
LAN game friends join with a 5-letter code. Up to N civilizations."

**Slice 2 — first-visit flourish:** an animated low-poly vignette
BEHIND the setup card on first visit (per-origin localStorage flag;
static forever after; skip entirely under ⚙ reduce-animation and
?e2e/?setupdemo). Reuse what exists — the renderer + assets ARE the
splash art: a small baked diorama (a coast tile cluster, a city, a
couple of units) with slow camera drift and the A28 sway/water
already animating. Budget: no new assets, no load-time regression on
return visits (lazy-init only on the first-visit path), WebGL1 pass
mandatory, and the setup card stays readable on top (dim/vignette the
scene). Screenshots: first-visit + return-visit + WebGL1. If the
diorama fights the bootstrap order (renderer currently boots after
setup), flag the seam in a question note BEFORE restructuring main.js
— a static gradient + the copy is an acceptable v1 fallback.

Queue position: slice 1 immediately (any stop); slice 2 after A41,
before A40.

## PARKED/DESIGN — Civ2-style combat option: unit health + healing (user note 2026-07-14)

A THIRD combat style alongside authentic-one-roll and best-of-three:
per-unit hitpoints (Civ 2 model) — combat deals damage instead of
instant death, damaged units fight/move at reduced strength, and units
HEAL over time: slowly in the field, faster in cities and inside
fortifications (note: fortification-based healing doesn't exist in the
current engine either — it arrives WITH this option, not before).
Scope notes when picked up: engine change under golden lock (unit
state gains hp — a state-shape change, so scenario hashes and goldens
re-record); ruleset numbers in data/rules.json (hp per unit era or
flat, heal rates by location class); combat-style stays a setup-screen
choice so classic one-roll remains the default; sim soak must verify
AI still wins wars under the hp model. NOT QUEUED — design first,
architect.

EXTENDED INTO A "CIV 2 RULES MODE" UMBRELLA (user note 2026-07-16):
alongside hp/healing, the mode adds —
- **Ranged BOMBARD** for siege weapons and modern ships: artillery,
  a new TREBUCHET unit (not in Civ 1's roster — this mode may add
  units), battleships/cruisers shelling adjacent-or-ranged tiles
  without entering combat themselves. Needs: a bombard command
  (attack without move-in; damage under the hp model — bombard only
  makes sense WITH hitpoints, so it's strictly part of this mode),
  range data per unit, AI usage policy.
- **Civ 2 ZOC**: only ground units exert zones of control, sea/air
  exempt (B14 established our Civ 1 ZOC is domain-blind and
  CORRECT for the default rules; this mode flips the rule as data —
  `rules.json zocDomains` or similar — never a code fork).
Everything stays ONE ruleset toggle at setup ("Civ 1 authentic" vs
"Civ 2 rules"), differences data-driven wherever possible, and the
whole mode is a golden-window family with its own scenario pins
when designed. NOT QUEUED — v2 shelf, design-first, architect.

## PARKED/DESIGN — Civ4-style strategic resource chains (user note 2026-07-14)

A more advanced resource model for consideration: strategic resources
(iron, horses, oil, …) distributed on the map at mapgen; some units
and/or buildings REQUIRE access to a resource to be built. Access =
the resource tile carries its appropriate improvement (mine on iron,
pasture-analog, well) AND the tile is CONNECTED to the building city
via road/railroad/sea connectivity (harbor-to-harbor counts). Scope
notes when picked up: this is a big system — mapgen distribution
(deterministic, rng.js), a connectivity graph over improvements
(engine, Lua-portable, likely flood-fill per player per turn or on
demand), unit/building `requires` fields in data/*.json, UI surfacing
(catalog lock reasons: "needs Iron — none connected"), and AI
awareness (settle toward/road to resources). Interacts with the
pillage rules (cutting a road severs the chain — strategy!). NOT
QUEUED — design first, architect; candidate for a phase-6+ headline
feature alongside diplomacy.

## A59 — AI leader personalities (wave VII items 4+5 — DESIGNED 2026-07-15 with the user; all four decisions his)

**[BUILD-READY (user confirm 2026-07-16 evening): ship as designed — named leaders, ONE stance each shown openly, plausible favorites, randomize option; queue AFTER the sim-runner's post-B21 knob sweeps so stance tuning lands on measured baselines. B21's stance-percent passthrough machinery is exactly the shape leader personalities consume.]**

**[AXES MODEL ADOPTED (user ruling 2026-07-17, ally doc specs/leader-attributes.md):** each leader carries a normalized FOUR-AXIS personality — aggression/science/growth/defense as INTEGER PERCENTAGES summing to 100 (the ally's 0.75 floats adapted: state bans floats) — the stance label becomes PRESENTATION derived from the largest axis. Favorites = BOUNDED SCORE MODIFIERS, never overrides (ally table: fav-unit +20% when useful, fav-wonder +25% while available and ZEROED once another civ completes it or the city is threatened; beeline tech +35% research score; garrison-short cities restrict fav-unit to defenders; naval-needed maps override land preferences). WONDER ASSIGNMENTS per the ally's corrected table (Caesar Sun Tzu's, Hammurabi Great Library, Frederick+Qin Great Wall RACE by design, Ramesses Pyramids, Lincoln Newton's, Alexander Colossus, Gandhi Michelangelo's, Catherine Women's Suffrage late-only, Napoleon Bach's, Montezuma Oracle, Elizabeth Magellan's, Shaka+Genghis NONE — conquest captures wonders); Caesar/Catherine preferredBuilding colosseum (a BUILDING, the ally's ID correction, like University→its prereq tech). All ids verified against our slugs at build. Dialogue: ALL FIVE SETS DELIVERED (science/growth/balanced in specs/leader-attributes.md; aggressive/defensive + voice profiles + line-type constraints + validation checklist in specs/leader-config-final.md).]**

**[FINAL TABLE (user+designer editorial pass 2026-07-17, specs/leader-config-final.md — THE build data, percentages included):** Caesar 75/10/10/5 legion+colosseum(BUILDING — slug reconciliation: Colosseum is not a Civ1 wonder, encodes as preferredBuilding, wonder blank; same for Catherine) iron-working+conscription · Hammurabi 5/80/10/5 catapult+great-library writing+code-of-laws · Frederick 20/20/15/45 musketeers+great-wall masonry+gunpowder · Ramesses 5/10/75/10 settlers+pyramids pottery+bronze-working · Lincoln 30/25/25/20 riflemen+isaac-newton-s-college democracy+industrialization · Alexander 80/5/10/5 cavalry+colossus bronze-working+horseback-riding · Gandhi 5/20/30/45 musketeers+michelangelo-s-chapel ceremonial-burial+mysticism · Catherine 10/15/60/15 knights+colosseum(building) bronze-working+monarchy · Shaka 100/0/0/0 militia(the Warrior reconciliation)+NO-wonder iron-working+horseback-riding · Napoleon 65/10/15/10 knights+j-s-bach-s-cathedral chivalry+conscription · Montezuma 40/15/30/15 chariot+pyramids bronze-working+mysticism · Qin 10/70/10/10 catapult+great-wall writing+invention · Elizabeth 15/65/10/10 frigate+copernicus-observatory navigation+magnetism · Genghis 90/0/5/5 knights+NO-wonder horseback-riding+iron-working. INTENTIONAL WONDER RACES: great-wall (Frederick/Qin), pyramids (Ramesses/Montezuma). All slugs verified against data/ 2026-07-17 (sun-tzu absent = Civ2, moot). A59 IS NOW FULLY SPECIFIED — data + axes + favorites + all dialogue; build slot next after the B23-close measurements.]**

Every AI civilization gets a NAMED LEADER with ONE STANCE from the
A40 table — fixed per civ so opponents build reputations across
games, with a setup option to randomize.

1. **Data** (`data/civs.json`, hand-maintained — no generator, per
   A44): each civ gains `leader: { name, stance }`. DRAFT table
   (Civ 1's historical roster; stances historically flavored —
   every NAME and stance is the user's editorial call, swap freely,
   they are facts not code):
   (stance names = A40's EXACT table: balanced / aggressive /
   defensive / science / growth)
   Romans/Caesar aggressive · Babylonians/Hammurabi science ·
   Germans/Frederick defensive · Egyptians/Ramesses growth ·
   Americans/Lincoln balanced · Greeks/Alexander aggressive ·
   Indians/Gandhi defensive · Russians/Catherine growth ·
   Zulus/Shaka aggressive · French/Napoleon aggressive ·
   Aztecs/Montezuma balanced · Chinese/Qin Shi Huang science ·
   English/Elizabeth science · Mongols/Genghis Khan aggressive.
   (Draft leans aggressive-heavy like Civ 1 did; the balance sweep
   in (5) is where the mix gets tuned by measurement.)
   STANCE CONTENT is A40-s1's table (behavior knobs at the top of
   ai.js, not ruleset facts): defensive = threat-garrison 2 always,
   aggression radius 0, walls priority; aggressive = army cap
   raised, aggression radius widened, attack bias; science = rates
   prefer sci when disorder-free, library/university priority;
   growth = higher settler ratio, granary priority, irrigation-first
   improvers. NOTE (user question 2026-07-15): "growth" deliberately
   blends WIDE (settlers → more cities) and TALL (granary/irrigation
   → bigger cities) in v1 — one coherent knob family; the wide-vs-
   tall split arrives with the axis WEIGHTS in the later-depth pass,
   not as a sixth stance. Stances are BIASES on existing scoring,
   never forced actions — an aggressive leader on a peaceful island
   degrades gracefully toward balanced behavior (nothing to attack =
   the bias has nothing to bite). Stance × difficulty compounding
   (esp. aggressive at God-Emperor) is an explicit telemetry check.
2. **State + determinism**: `players[pid].stance` is set at
   createGame — from the civ's leader by default, or a seed-derived
   permutation when the setup's "Randomize personalities" checkbox
   is on. The stance LIVES IN STATE (a printable string), so replays
   and the Luau twin derive behavior identically with zero side
   channels. STATE-SHAPE CHANGE ⇒ new games only, but sim goldens
   re-record (AI seats gain stances) — this is GOLDEN WINDOW #3
   territory: full re-record, soak re-baseline, natural-end golden,
   both engines in one claim (ai.js + ai.luau + createGame +
   json2lua data pins).
3. **One stance resolution everywhere** (the A40 symmetry): regent
   override > players[pid].stance > 'balanced'. AI seats read their
   state stance; a human seat's stance is dormant until a regent
   uses it (the regent dialog PRESELECTS the civ's leader stance —
   your empire acts in character when you step away).
4. **Visibility (all shown, user decision)**: first-contact turn-log
   line ("You meet Caesar of the Romans — aggressive"); leader name +
   stance on score-line hover; the setup screen shows your own civ's
   leader; A58's encyclopedia gets leader entries. Spectators see
   all.
5. **Quality bar (batch-4 discipline — measure, don't vibe)**: each
   stance must show a MEASURABLE behavioral signature in soak
   telemetry — now with NAMED columns per docs/05 §12's
   stance-conditioned block (user 2026-07-15): aggressive → cities
   CONQUERED ≥ 2 by t300 (+ attacks); defensive → conquests ≈ 0 IS
   the signature, unit survival + zero cities lost; growth → most
   founded + highest total pop; science → tech lead + wonder
   completions. AND no stance may tank the health metrics (GE
   stagnation stays ≤ batch-4 levels, natural games still produce
   winners). Lab-copy iteration up to the user's 10-iteration
   mandate; only winners port.
6. **Sequencing (hard prerequisites)**: A40-s1 window CLOSES first
   (stance machinery proven balanced-identical) → B11 lands (empire
   policy factoring — stances modulate that same policy layer) →
   the ff-outlier check runs (sim-runner measure job: fast-forward
   telemetry per seat at handover — cities/improvements/army mix —
   answering whether the 1-city/29-militia Renaissance seat was a
   seed outlier, a takeover-seat special case, or a militia-spam
   policy loop; the fix for THAT precedes personalities so stances
   tune a healthy baseline, not a bug).
Roblox side: personality data crosses in civs.json (already one of
the eight checksummed files); ai.luau twin in the same claim.

LATER-DEPTH NOTE (user, 2026-07-15 — design the v1 data shape so
these slot in WITHOUT migration): personality strategy gains
complexity in a later pass — (a) PERCENTAGE WEIGHTS PER AXIS
(e.g. Caesar: aggression 70 / expansion 40 / science 20 — the
single stance becomes the dominant axis of a weight vector; keep
`leader.stance` as the v1 field and let a future `leader.weights`
object coexist, stance derivable as its argmax); (b) FAVORITE
BEELINE TECHNOLOGIES per leader (e.g. Hammurabi beelines Writing→
Literacy, Genghis beelines Horseback Riding→Wheel) — a
`leader.beelines: [techIds]` list the research policy prefers while
available; (c) PREFERRED UNITS / BUILDINGS / WONDERS (user follow-up
same day): `leader.favorites: { units: [ids], buildings: [ids],
wonders: [ids] }` — the production policy weights favorites upward
when buildable (never exclusively — a favorite is a thumb on the
scale, not a script, or leaders become exploitable). Wonder
favorites are the flavor jackpot: leaders RACE their signature
wonders (Ramesses wants the Pyramids, Elizabeth wants Magna Carta),
and losing "their" wonder to you should sting in the log. All
favorites fields are data/civs.json + policy consumers, all
golden-affecting when activated, all measured under the same
signature-telemetry bar (a favorite that doesn't appear in build
statistics doesn't ship; a leader whose favorites tank their
military health gets retuned).

DRAFT FAVORITES TABLE (architect, from Civ 1 lore + the existing
civ specialties; user does the editorial pass at activation. SPARSE
IS FINE — not every leader needs every category; an empty slot
means "no thumb on that scale". Wonder RIVALRIES are deliberate
drama — two leaders wanting the same wonder race for it):
- Caesar: beeline Iron Working; units Legion (the discount
  specialty), Catapult; buildings Aqueduct, Colosseum.
- Hammurabi: beeline Writing→Code of Laws (the man WROTE the code);
  buildings Library, Courthouse; wonder Hanging Gardens (home turf).
- Frederick: beeline Feudalism; units Musketeers; buildings City
  Walls, Barracks; wonder Great Wall (rivalry with Qin).
- Ramesses: beeline Pottery→Monarchy; units Chariot; buildings
  Granary, Temple; wonder PYRAMIDS (rivalry with Montezuma).
- Lincoln: beeline the Democracy line; buildings Marketplace, Bank;
  wonder Women's Suffrage.
- Alexander: beeline Bronze Working→Mathematics; units Phalanx,
  Catapult; wonders Colossus, Oracle.
- Gandhi: beeline Ceremonial Burial→Mysticism; buildings Temple,
  Cathedral; wonder United Nations.
- Catherine: beeline Bridge Building; units Cavalry; buildings
  Granary; wonder Hoover Dam.
- Shaka: units Militia (the veteran specialty), Phalanx; beeline
  Iron Working; no wonder favorite — armies are his monuments.
- Napoleon: beeline Gunpowder→Metallurgy; units Musketeers, Cannon;
  wonder slot open (nothing rang true).
- Montezuma: beeline Ceremonial Burial; units Chariot; wonder
  Pyramids (the Ramesses rivalry).
- Qin Shi Huang: beeline Writing→Literacy; buildings Library,
  Granary; wonder GREAT WALL (obviously; Frederick contests).
- Elizabeth: beeline Navigation→Magnetism; units Sail, Frigate;
  wonders Shakespeare's Theatre, Magellan's Expedition.
- Genghis Khan: beeline Horseback Riding→Chivalry; units Knights,
  Cavalry; no build favorites — his favorite building is yours,
  captured.
(All ids resolve against data/{techs,units,buildings,wonders}.json
at activation — watch the slug-id naming drift the data source
section warns about; "Magna Carta" mentioned above is NOT a Civ 1
wonder, Elizabeth's real slots are as drafted here.)

## PARKED/GAME-V2 — Mobile-friendly UI/UX (user note 2026-07-14)

A phone-usable client view so people can join LAN/internet games on
the go — pairs naturally with AI regency (A40): check in from a
phone, make the key decisions, let the regent handle the rest. Scope
when picked up: touch controls (tap-select, pinch zoom; the
hover-dependent UI — combat odds, move hints — needs tap
alternatives), responsive HUD/panels (left stack and city view don't
fit portrait), performance on mobile GPUs (scene is light; verify the
WebGL1 story on mobile browsers). Same client codebase preferred
(CSS + input-mode switches), not a fork. NOT QUEUED — v2 shelf.

## PARKED/GAME-V2 — Civ4-style culture areas (user note 2026-07-14, VERY later)

Real culture/border mechanics as ENGINE state (cities exert cultural
pressure, borders grow over time, tiles flip ownership) — explicitly
a game-v2 potential, NOT current scope. Until then, "territory" exists
only as A45's view-side fat-cross tint derivation. If ever picked up:
state-shape change (tile ownership map), golden re-record, ruleset
tables for culture output/thresholds, AI awareness — pairs naturally
with the Civ4 resource-chains parked item (borders define whose
resource it is). No design work now; this note is the whole item.

## A54 — Off-turn pre-work: the self-scoped command whitelist (VI.11 — DESIGNED 2026-07-15, user GO; queue after A47)

Let players adjust their OWN empire while rivals move: rates,
research pick, city production, worked tiles. Full design:

1. **The whitelist** (engine constant, exported): `setRates`,
   `setResearch`, `setProduction`, `setWorkers` — all self-scoped
   (touch only the issuing player's state), zero rng, no reads of
   the active player's in-progress turn. Everything else keeps
   `notYourTurn`.
2. **Engine change** (fixture-FIRST per the verified-core rule):
   the turn check in applyCommand loosens to "activePlayer OR
   (whitelisted AND cmd.playerId === issuer)". NEW scenario
   011-offturn-prework (its own pin) exercises an out-of-turn
   setProduction + setRates between two other players' turns.
   GOLDEN-SAFE ANALYSIS (verified reasoning, assert in review):
   existing goldens/recordings contain no out-of-turn commands
   (they were impossible), and rejections are never logged — so no
   existing pin moves; this is ADDITIVE semantics. Still a
   both-sides change: engine/index.js AND luau/index.luau in ONE
   claim, scenario 011 green cross-language, per the CLAUDE.md
   verified-core rule. (No golden re-record expected; the window
   formality is the paired-twin claim itself.)
3. **Server**: routing already serializes arrival order into the
   log — replay determinism by construction. The whitelist check
   lives in the ENGINE (single source); protocol.js only loses its
   own-turn pre-filter for these four types.
4. **Local session (the subtle half)**: apply() during a chunked AI
   round currently rejects 'roundInFlight' (A30). Whitelisted
   commands QUEUE and flush at the next chunk boundary (macrotask
   seam) — the engine applies them BETWEEN AI turns, the recording
   captures actual application order, replay stays exact. UI shows
   the pending tick ("queued") only in the rare in-flight window.
5. **UI unlock**: rate slider, research picker, city production +
   workers become active off-turn (they currently disable);
   rejection paths unchanged (caps still snap back, A29). Hotseat
   UNCHANGED: off-turn there means the other human's screen — the
   whitelist applies to LAN seats and the local human during AI
   rounds only.
6. Tests: scenario 011 (pinned, cross-language), a ws case (p2 sets
   production during p1's turn; p1's turn outcome unaffected; log
   order preserved), an unchunked-twin session case for the queue
   flush (the A30 pattern), UI enablement browser probe.
Golden-safe per analysis in (2) — but treated as the first
verified-core engine change: fixture first, both languages, one
claim. Queue after A47 (helper), with the luau half coordinated
exactly like A40-s1's window.

## A41 — Find-a-game v1: the public lobby listing (DESIGNED 2026-07-14 per user go — queue after A34)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — listGames auth-free + 1/sec/conn rate limit, public===true only (create checkbox, default OFF), hostName/seats/size/age/spectators/status — code+IP absence ASSERTED; full lobbies drop, started+spectators stay spectate-only. joinListed gates notPublic then delegates to handleJoin VERBATIM (same reservation path by construction; seat-pick identity tested). Browse panel above the code field w/ empty state; shot READ against a live public lobby. Hardening note filed: pre-existing join-by-gameId (needed by resume) → pre-DNS item decides. Suite 227/227.]

The single server lists its OWN open lobbies so players browse and
join without a shouted code. Design (architect):

- **Server**: `{t:'listGames'}` (no auth — it's the browse screen)
  returns entries for every lobby with `options.public === true`:
  `{name, hostName, openSeats, totalSeats, size, age, spectators,
  status}` — NEVER the join code, NEVER seated players' IPs. Hosts opt
  IN at create: a "List publicly" checkbox next to Allow-spectators
  (create option `public: true`; default OFF — private-by-default is
  the LAN posture and the internet posture both). `{t:'joinListed',
  gameIndexOrId, name, seat?}` performs the join — the server resolves
  it to the SAME reservation path as joinCode internally (the code
  stays the host's secret; listed joining is capability-by-listing).
  Started games and full lobbies drop off the list (or show
  status-only if spectators are allowed — spectate-join from the list
  included). Rate-limit listGames per connection (1/sec) — it's the
  one message a bored crawler would hammer.
- **Client**: the setup screen's "Join LAN game" panel gains a
  "Browse open games" section above the code field — list with
  name/seats/size/age, click → seat-pick → the normal waiting room.
  Empty state: "no public games — ask your host for a code".
- **Tests**: protocol shape + public-flag filtering (private lobbies
  NEVER appear), join-from-list lands on the reservation path
  (protocol test asserts same seat semantics as joinCode), rate-limit
  case, e2e screenshot of the browse panel with one listed game.
- **Scope fence**: this is LISTING, not the internet-hardening item —
  the per-IP join/create limits, connection caps, and lobby expiry
  from the hosting note become their own pre-DNS item; A41 ships for
  the LAN/trusted-DNS context first. v2 (multi-host directory) stays
  parked.

Golden-safe (lobby/protocol/client only). Pairs naturally after A34
(saves-resume lives in the same host panel) and with A37's lobby
moderation in place (public listing without kick would be premature —
A37 lands first by queue order).

## A43 — Machine-readable render spec for the designer ally (user request 2026-07-14)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — tools/render-spec.js source-slices the browser-ESM tables (brace-matched literals, evaluated standalone) → specs/render-spec.json v1 (12.5KB, no timestamps = byte-stable): terrain.tiles+waterLevel+SEGS, 14 factions + emblem names + isLightColor threshold PARSED not restated, 18 GEO primitives, 11 neutrals, 7 type-classes, CITY_TIERS, prop colors, A28 anim constants. Nine builders + prop placement honestly {procedural:true}+description (flat lists would carry wrong dimensions). One refactor: anim.js inline sway numbers → named constants, byte-neutrality PROVEN (gallery rest-pose cmp identical). Drift guard regenerate-and-compare + shape test; specs/render-spec.md pointer map. Suite 220/220.]

The ally wants to validate the rendering DESIGN through his own
system, not just by looking at screenshots: the declarative specs +
pointers to the code. The right shape is a GENERATED EXPORT — the
code stays the single source of truth, a tool emits the declarative
tables as versioned JSON, and a drift guard keeps them honest:

1. **`tools/render-spec.js`** exports `specs/render-spec.json`
   (committed — it is OUR data, MIT-clean) containing:
   - the TERRAIN table from `renderer/three/terrain.js` verbatim:
     per-terrain heights + the three palette shades (+ water level,
     foam and mottle constants);
   - the faction table: `data/civs.json` visual{} joined with the
     emblem NAMES and the isLightColor threshold + dark-rim rule
     (factions.js constants);
   - model recipes from assets.js/props.js: per unit type / city
     tier / prop, the primitive list (shape, dimensions, offset,
     color source) — mechanical extraction; if a recipe resists
     declarative capture, list it as `{ "procedural": true }` with a
     one-line description rather than faking it;
   - anim constants (sway rad, glide ms, smoke params) from anim.js;
   - a `schema` header (version + field meanings) so his system can
     parse it without reading our code.
2. **Drift guard** in the suite: regenerate in a temp dir, compare to
   the committed file, fail with "run tools/render-spec.js" when the
   renderer tables change — the sync-check pattern, mechanical.
3. **`specs/render-spec.md`** (SHORT): what the JSON is, how it is
   generated, the pointer map to the living code
   (renderer/three/*.js paths per section) — the repo is public, so
   code references are just paths.

Golden-safe (tool + generated JSON + guard; no renderer changes —
EXCEPT: if extraction demands small refactors like naming an inline
constant, keep them byte-neutral and prove it with a gallery
rest-pose screenshot compare). Slot after A36 — same renderer
knowledge, warm cache.

## A44 — Ally sign-off follow-ups bundle (round 4, non-blockers; after A42)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — (1) coverage guard: all 28 unit types map to real silhouettes (armor/submarine ARE special-cased — ally worry disproven), failure names unmapped types; (2) shared-vertex invariant: no-conflicting-writes = code-shape comment (heights per-vertex pure BEFORE faces; colors per-face), determinism = mechanical ?vertexcheck=1 twice-built byte-compare browser case; (3) color vs visual.primary semantics documented in the render-spec schema (civs.json has NO generator — honest deviation; rename = future migration note); (4) gallery 16-wide margin columns — edge pills (Romans/Mongols) uncropped, intended regen. Mid-flight CI red closed (derived files now regenerate in-burst). Suite 229/229.]

Four small items from the visual sign-off, one claim:
1. **Renderer-coverage guard**: a suite test asserting EVERY
   data/units.json type maps to exactly one silhouette class,
   specialized builder, or EXPLICITLY listed fallback in assets.js —
   failure names the unmapped types ("Missing visual mapping: tank").
   His specific worry: tank/submarine may ride a generic fallback —
   the guard reveals it; if they do, give them real silhouettes (his
   sketches: low tracked hull + turret distinct from artillery; low
   dark narrow hull + conning tower). Gallery re-shot if models change.
2. **Shared-vertex rule, documented + checked**: terrain.js gains the
   invariant comment ("every shared vertex receives ONE deterministic
   height + palette decision; adjacent tiles never write conflicting
   values") and, if cheap, a test that builds a small mesh twice and
   asserts identical vertex buffers (determinism half) — the
   no-conflicting-writes half can be a code-shape argument in the
   comment if a mechanical check is disproportionate; say which.
3. **Faction color-field docs**: render-spec schema (and a comment in
   civs.json's generator) documenting `color` = gameplay/seat display
   color vs `visual.primary/secondary` = client-only art palette.
   (Renaming color→seatColor is NOT in scope — data migration touches
   saves; note it as a possible future migration instead.)
4. **Gallery label padding**: left/right edge labels crop/crowd —
   pad the grid or two-line the long names; gallery-only, re-shot.
Also NOTED (not in this bundle): his water-streaks-vs-rails check and
late-game badge prominence are PLAYTEST items (human list); adjacent-
tier silhouette differentiation is recorded as an A1.8 candidate in
docs/03. Golden-safe throughout.

## A45 — Map overlays panel: semi-transparent data layers + left-panel reorder (user request 2026-07-14)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — renderer/three/overlays.js (anim.js-shaped, per-tile quads, water-surface tint, per-layer lift) + ui/overlays.js (registry {id,label,computeTiles}, panel, options persistence; BOTH LAWS: filterView-gated derivations = fog can never tint, ctx.HUMAN read live in recompute). Territory fat-cross w/ Chebyshev-then-lowest-id ties; Units green-own/red-rival. Left stack Controls/Overlays/Turn-log, anchor PINNED by browser rect probe. TWO CATCHES: main.js history.replaceState canonicalizes the URL post-boot dropping unknown params → module-eval capture (documented trap); FAT_CROSS entries are {dx,dy} objects — probe try/catch surfaced the destructure crash. 3 shots read (overview/close/spectator-omniscient). Suite 230/230.]

Civ4-style toggleable overlays drawn over EXPLORED tiles only —
pure view layer: no engine change, no state, no goldens; overlay
choice is per-viewer UI state (never in game state, never in
recordings).

1. **New left panel "Map overlays"** (`client/ui/overlays.js`), a
   sibling of Turn log/Controls. REORDER the left stack top→bottom:
   **Controls, Map overlays, Turn log** (Turn log takes the lower-left
   anchor). Same collapsible pattern; remember open/closed + active
   overlays in the options store like other UI prefs.
2. **Renderer side** (`client/renderer/three/overlays.js`, render-only
   module like anim.js — never engine RNG/state): one semi-transparent
   tinted quad per affected tile, floating just above the terrain
   surface (same y-offset trick as the city-footprint overlay;
   depth-test friendly, no z-fighting). Rebuild on session.onChange +
   overlay toggle; tiles outside `explored` NEVER get a tint (fog is
   the law; in server games the filtered view already enforces data,
   but don't paint unknown tiles even when mock/local state has data).
3. **Overlay 1 — Territory**: which empire an area belongs to.
   Derivation (view-side, documented in the module): every explored
   tile within each city's workable footprint (the classic 21-tile
   fat cross) tints in that city's owner faction color at low alpha;
   ties → nearest city (Chebyshev), then lowest city id
   (deterministic, but it's render-only so this is for visual
   stability not hashes). Unclaimed explored land = no tint.
4. **Overlay 2 — Units**: tiles with VISIBLE units tint red (any
   enemy of the current viewpoint) / green (own); both present on
   one tile (can't stack with enemies, but adjacency reads matter)
   is simply per-tile by occupant owner. `ctx.HUMAN` is the CURRENT
   VIEWPOINT — read it live (hotseat hands it over), never cache.
5. **Extensible registry**: overlays declared as
   {id, label, computeTiles(state, viewpoint) -> [{idx, color,
   alpha}]} so later Civ4-style layers (resources, yields, culture)
   are one entry each. Multiple overlays may stack (alpha blend);
   keyboard: reuse nothing that collides with existing bindings —
   check input.js's map first, and ignore INPUT/TEXTAREA targets as
   always.
6. **Tests + evidence**: new modules listed in client-syntax.test.js
   (the forgotten-once rule); an e2e hook (?overlay=territory,units)
   for screenshots; browser case asserts the panel exists, toggling
   adds/removes overlay meshes (scene-graph count probe), and the
   turnlog panel anchors lower-left after the reorder. Screenshots
   READ both zoom levels (overview + close), spectator included
   (omniscient = whole map tints — that's correct, not a bug).
Queue: after A41 (A42-diorama and A44 may reorder around it at the
helper's discretion — smallest-diff-first applies). Golden-safe.

## A46 — Per-seat reclaim code + reconnect e2e coverage (user decisions 2026-07-14)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — "XXXX-YYYY" docs/07-alphabet codes from server crypto (seatCodeFn injectable), parallel seatCodes map persisted in the save ENVELOPE (never state/hash; old saves = no codes); join.seatCode parser-validated; reclaim ROTATES the token (old device dies with the move), token reconnects re-show the code, resetSeats clears codes. Liveness gate in index.js ('seatOccupied' while live — recovery never displacement) + 1/sec/conn rate limit; code never in views/listings/spectator (asserted). E2E GAP CLOSED: ?e2e=8 dumpDomLive severs the socket → 1/s retry reclaims + HUD recovers (the A30 stateReplaced marker = the observable). Join-screen seat-code input + toast line; toast SHOT lost to virtual-time ws family (delivery machine-asserted ×2; A49 Playwright owns the visual). Protocol unit tests evolved. Suite 234/234.]

Today a seat survives disconnects via the localStorage token (same
browser only: session-remote auto-retries 1/s with the stored token;
the server-side reclaim loop is proven in server.test.js incl.
restart-from-autosave). This item adds the NEW-DEVICE / cleared-
storage path, per three user decisions:

1. **Per-seat reclaim code** (decision: per-seat code, not passphrase,
   not host-approval): at seat bind the server generates a short
   per-seat code (reuse the gamecode alphabet/format machinery —
   docs/07 — but per seat, e.g. 2 groups not 3; store a hash or the
   code in the seat entry, NEVER in view pushes or listings). Shown
   to that player ONLY: in the lobby room and in the game HUD next to
   the game code ("your seat code — for rejoining from another
   device"). {t:'join'} gains an optional seatCode field: valid
   game + name/seat + seatCode reclaims the seat WITHOUT the token.
2. **Reclaim window** (decision: only while disconnected): a seat
   whose connection is LIVE rejects code-reclaim ('seatOccupied') —
   the code is recovery, never a displacement tool. (Deliberate
   device-switch = close the old tab first; note this in the HUD
   tooltip.)
3. **Security posture**: the seat code never appears in listGames,
   roster broadcasts, or spectator views — same discipline as A41's
   code/IP absence assertions, test it the same way. Rate-limit
   reclaim attempts (reuse the 1/sec pattern) so codes can't be
   brute-forced in-lobby.
4. **Reconnect e2e coverage** (the gap the user asked about): a
   browser case that kills the live socket mid-game (CDP or server-
   side close) and asserts the 1/s retry loop reclaims the seat and
   the HUD recovers — the session-remote path that today only manual
   LAN tests exercise. Use the live-page CDP poll pattern
   (dumpDomLive), not virtual-time --dump-dom (known ws race).
5. Tests: ws cases for reclaim-while-disconnected (green),
   reclaim-while-live (rejected), wrong code (rejected + rate limit),
   code absent from every broadcast shape.
Server + client/lobby + session-remote + tests. Golden-safe. Queue:
after A45 (tail: A44 → A42-diorama → A45 → A46).

## A47 — Post-game replay theater (user request 2026-07-14)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — "⏵ Watch the replay" on gameOver → sandbox engine (createEngine/deepClone, never touches the session) re-applies the recording, rendered omnisciently (filterView 'spectator' path). Tempo 1-50/s = rAF apply-throttle batching turns/frame, anims off during playback; pause/resume, major-events feed (turn+year, click=fly-to), close restores. VERIFIER-WITH-A-FACE: end compares hashState(replayed)===finalHash → "✅ replay verified" (e2e=9 asserts match + feed filled; shot read). Sources: server {t:'fullLog'} gated gameOver ('notOver' pre — ws-tested both sides), local session recording + AMENDED save diag envelope (Shift+S writes {diag}, replaceState(next,recording) seeds recorder → replay spans game's whole life, composes; blockless saves fall back). Pure replay-events.js extractor unit-tested (7 headline classes). Suite 241/241.]

After gameOver: "⏵ Watch the replay" — the whole game re-run from
turn 0 as a GLOBAL spectator. Everything rides machinery we already
trust: the in-memory recording (initial state + every command, the
Shift+D payload) re-applied through the real engine, rendered
omnisciently. Zero engine changes; the replay engine instance is a
sandbox (never touches the finished session's state).

1. **View**: all tiles revealed + zoomed-out boot framing (reuse the
   spectator omniscient path — players['spectator']===undefined reads
   — and the world-center boot camera). Normal camera controls stay
   live during playback; pause/resume button.
2. **Tempo**: 1–50 turns/second slider. Implementation note: above
   ~5 t/s do NOT render every turn — apply commands in batches per
   animation frame and render the latest state (the engine applies
   commands far faster than the renderer draws; 50 t/s is an apply
   throttle, not a render promise). Animations auto-off during
   high-tempo playback (render-time only, so this is free).
3. **Major-events log**: a running feed built from engine events as
   rounds apply, UNFILTERED (global spectator sees all), but limited
   to the MAJOR classes: city founded, tech discovered, city
   captured/lost, wonder built, war declared/first contact if the
   events exist, civilization eliminated, game end. Reuse
   turnlog-classes for icons/wording; prefix entries with turn+year.
   Clicking a log entry = camera fly-to (coords ride most events).
4. **Sources**: (a) server games — new `{t:'fullLog'}` request
   answered ONLY when state.gameOver === true (after game end
   everything is public; before it, rejected — no fog leak). Server
   saves ALREADY carry full history across sessions (diag.initialState
   + diag.log, appended-to on resume — server/game.js) so this path
   spans save/resume chains for free. (b) local games — the session
   recording is in memory from turn 0; AMENDED per user 2026-07-14:
   local saves gain the same optional `diag: {initialState, log}`
   block in the save ENVELOPE (never game state — hashes untouched),
   and loading a save that carries it SEEDS the session recording
   instead of restarting it, so the replay spans every session of
   the game's life. Chained save→load→save composes (the block
   carries forward, commands keep appending). Saves WITHOUT the
   block (older files) fall back to replay-from-load-point, and the
   theater says so honestly. Bonus worth a test: a full-history save
   is fully re-derivable — replaying diag.log from diag.initialState
   must reproduce the saved state hash (a stronger tamper check than
   the game code alone; assert it in the browser case).
   Both paths feed the same theater.
5. **Tests**: unit-level = major-event extraction from a crafted
   event stream; browser case = ?e2e drives a short game to gameOver
   (or crafted gameOver state + recording), opens the theater,
   asserts the log fills and the final replayed hash equals the
   recording's final hash (the theater IS a replay-verifier with a
   face — assert it). ws case: fullLog rejected pre-gameOver, served
   post.
Golden-safe. Queue: after A46. The tempo ceiling and the major-event
class list are the user's; extending either later is one constant /
one class-list entry.

## A48 — Nightly visual-regression goldens (user tier-2 GO 2026-07-14)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — ?splashstill=1 drift-phase-0 variant + reduce-animation now freezes water drift (renderer index.js — the A15 ocean jitter that broke byte-stability); ?splashstill & gallery.html each byte-IDENTICAL across runs now. debugging/visual-check.sh (cmp vs debugging/goldens/*.png, --record, writes actual-* on mismatch) + nightly step (after suite, uploads visual-goldens artifact on fail). CI-AUTHORITATIVE documented (script header + docs/05 §7b): committed goldens = local bootstrap, first CI nightly re-records authoritative set from its artifact; local-vs-CI diffs not chased. .gitignore tracks goldens, ignores actual-*. Golden-safe (no sim/ai touch), ran during B11 window. Suite 245/245.]

Byte-compare screenshots against committed golden PNGs, nightly.
SwiftShader rasterizes deterministically for a GIVEN chromium build —
so the goldens are CI-AUTHORITATIVE: record them FROM a CI run's
artifacts (a re-record = download the artifact, commit the PNGs);
local comparisons are informational only (a different chromium/
SwiftShader build may differ legitimately — do NOT chase local-vs-CI
pixel diffs, docs the caveat in the script header).
1. Shots (rest pose, the byte-comparable discipline the gallery
   already lives by): `debugging/gallery.html` (assets + 14-civ grid)
   and `/client/?splash=1` (the diorama at its boot frame — needs a
   `?splashstill=1` variant or drift-phase-0 guarantee; add it).
2. `debugging/visual-check.sh`: shoot both, `cmp` against
   `debugging/goldens/*.png`, exit nonzero with the diff summary;
   `--record` regenerates.
3. Nightly suite job: run after the chromium install step; on
   mismatch upload actual+golden as artifacts.
4. Re-record process documented in the script + docs/05-style note:
   intended visual changes re-record via CI artifact, PR carries the
   new PNGs alongside the renderer change that caused them.
Golden-safe (renderer untouched; adds script + workflow step + PNGs).
Queue: after A47.

## A49 — Playwright multi-client UI lane, nightly-only (user tier-3 GO 2026-07-14 — dev-dep approved)

`@playwright/test` enters devDependencies (whitelist updated:
CLAUDE.md + the guards.test.js dep test — allow `@playwright/*` +
`playwright` dev-only). The lane exists for what raw CDP repeatedly
lost: MULTI-CLIENT live-socket flows under event-driven waits.
1. New `test-ui/` directory (NOT under test/ — `node --test test/`
   stays playwright-free and fast; the lane runs via
   `npx playwright test`, nightly job step + on-demand locally).
2. First specs, each a real two-context flow against one live server:
   (a) host+joiner lobby chat both ways + host toggle + kick/block
   (the shot that "defeated me twice" becomes an assertion);
   (b) live reconnect: kill the joiner's socket, assert the 1/s
   retry reclaims the seat (complements A46's browser case);
   (c) spectator: joins tokenless, sees the whole map, controls
   nothing.
3. Config: chromium-headless-shell + SwiftShader flags (same as
   shoot.sh), trace+screenshot on first retry, 2 workers max (ws
   contention is measured and real — see B2).
4. Nightly workflow: a third step in the suite job (or its own job if
   runtime demands); failures upload traces as artifacts.
5. Keep the existing browser.test.js cases where they are — this
   lane ADDS multi-client coverage, it does not migrate singles.
Queue: after A48. If the lane proves itself, candidates for later
specs: resume-from-lobby two-client, replay theater (A47), regency
handoff (A40), AND the deferred single-client DOM truthy-path shots
that logic-mirror covered for now: A90 Help-Wonder button (caravan in
a domestic wonder-building city) + A97 city-view Sell button (a built
non-palace building, armed→confirm→sold-disabled) — architect #589.

## A52 — Ally round-5 follow-ups (specs/plan-feedback-5.md; queue after A40-slice-2)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — (1) overlay label "Territory"→"City influence" (id stays; working-area not borders, comment records the caution; DOM-confirmed); (2) seat-code acceptance: a=cited existing A46 seatOccupied case, b=fog-shaped reclaim (unknown tiles, no rngState), c=spectator+code stays omniscient tokenless (spectate path ignores code), d=post-rotation old token → badToken (single control path), e=both resume paths (--game keeps codes / lobby resetSeats kills them) + docs/08 §4 nuance documented; (3) chat [HH:MM] timestamps (client render only, XSS-inert; future-chat-prominence note carried to VI.11). Shots read: chat + City-influence tint. Suite 237/237.]

Small bundle, one claim:
1. **Overlay label rename**: player-facing "Territory" → **"City
   influence"** (his caution: a working-area derivation must not
   visually imply a legal border/ownership model the game doesn't
   have; "Borders" stays reserved for a possible future ownership
   system). The registry id may stay `territory` — the LABEL is the
   fix. Standing invariant recorded here: EVERY future overlay keeps
   the never-tint-unexplored rule.
2. **Seat-code acceptance cases** (his five, triaged):
   a. valid code vs OCCUPIED seat rejected — COVERED already; cite
      the existing case in the done-mail.
   b. reconnect delivers the correct fog-filtered view IMMEDIATELY —
      ADD: assert the joined/view push after a code reclaim is
      filterView-shaped for that seat (not omniscient, not stale).
   c. spectator holding a player's seat code gets NOTHING extra
      unless genuinely reclaiming the now-empty seat — ADD the
      explicit case.
   d. no duplicate identity / two live control paths for one seat —
      ADD: after reclaim's token rotation, assert the OLD
      connection's commands reject AND only one connection receives
      that seat's views.
   e. restart preserves only appropriate seat-code metadata — ADD
      tests for BOTH resume paths and DOCUMENT the nuance in docs/08
      §4: `--game` CLI resume keeps seats+tokens+codes (envelope);
      lobby resume (A34) resets seats so codes die with them (by
      design — machines change, joiners re-pick by name).
3. **Lobby chat timestamps** (sender names exist; add times). NOTE
   ONLY, no code: the future in-game chat design must keep the
   waiting/status line more prominent than chatter — carry this into
   the phase-6/VI.11 design when written.
Golden-safe. Suite + screenshots as usual.

## A53 — Setup-screen polish: two-column form (user request 2026-07-15; SMALL — slot right after A40-s2)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — #setup-box label = grid(1fr max-content), text right-aligned vs control column; shared 210px control width (checkboxes exempt), justify-self start = clean right edge; fixed min-height on specialty/age/civs hints = no jump on civ/age switch; combat "(fewer upsets)" → title tooltip (both options). Panel centered, buttons unchanged, splash diorama layering intact (verified ?splash=1). Shots read plain + splash. Pure presentation, suite 236/236.]

The user's spec:
1. **Two columns**: labels/text left, controls (dropdowns/inputs)
   right — a CSS grid (`max-content 1fr` or similar), labels
   right-aligned against the control column so rows scan cleanly.
   Panel stays center-aligned at its current width; the splash
   diorama behind it is loved — change nothing about that layering.
2. **Remove the "(fewer upsets)" parenthetical** from the combat
   dropdown option — keep the meaning as a title tooltip so the
   information survives ("best-of-three: fewer heartbreaking
   upsets").
3. **Buttons unchanged**: Start game / Host LAN game / Join LAN game
   keep their current arrangement.
Architect additions (small, same claim):
4. **Consistent control widths** — dropdowns and the seed field share
   one width so the right column reads as a column, not a ragged
   edge.
5. **Fixed-height hint slots** — the "a random civilization awaits" /
   age-hint lines reserve their height even when empty, so switching
   civ/age never makes the panel jump.
Evidence: before/after screenshots (plain AND ?splash=1 — the panel
must stay readable over the diorama), bare-URL browser case still
green, no layout shift on civ/age change. Golden-safe, pure
presentation.

## A57 — Left-stack panels: no overlap + modal-exclusive (wave VII item 1; small, next helper slot after the window)

When "Turn log" or "Map overlays" expands, the neighboring buttons
must MOVE UP/DOWN so nothing overlaps (the stack reflows; expanded
content pushes, never covers). And the three left panels become
MUTUALLY EXCLUSIVE (user spec): opening any one (Controls, Map
overlays, Turn log) collapses whichever other was open — one
expanded panel at a time. Keep the lower-left Turn-log anchor (the
A45 pinned rect-order still holds with everything collapsed).
Browser case: open each in sequence, assert single-open + no
bounding-box overlaps. Golden-safe.

## A58 — Complete the in-game encyclopedia (wave VII item 2; "later" per user — queue after A48/A49)

Every unit, building, wonder, government, terrain, and CONCEPT
(happiness, corruption, zones of control, veterancy, the game code…)
gets an in-game reference entry. Inventory first: what exists today
(catalog effect lines, tooltips) vs a real browsable pedia panel.
Data-driven from data/*.json wherever stats are concerned (never
hand-duplicate numbers — render them from the rulesets); concept
prose is ORIGINAL text (the license boundary applies: never wiki
sentences). Cross-links (unit → its tech → its era). Also becomes
the source for docs/13 Tier-2 Roblox help surfaces later.

## A56 — Fast-forward animation: DECIDED (a) year counter (user 2026-07-15); (b) world-builds-itself = OPTIONAL LATER  [claimed: coder-helper 2026-07-15] [done(a): 2026-07-15 — client/ui/ff-overlay.js: a center-screen interstitial over the age fast-forward. Big year counter sweeping 4000 BC→start year (from fwd.state.year), era name fading through (eraNameForTurn walks rules.json ages, highest turn≤now), progress "turn i/N" — driven by the REAL sim from the same main.js slices that advance it, removed the instant history hands off (never delays). Honors reduceAnimation → a single plain progress line (no counter, no fades). Pure helpers (eraNameForTurn/formatYear) Node-tested (test/ff-overlay.test.js, 3 cases); overlay screenshot-verified both modes via a throwaway harness; the real age=modern boot reaches turn 305 clean. Golden-safe (client DOM+CSS only). Suite 254/254. (b) world-builds-itself stays OPTIONAL LATER per the item.]

Starting in any age past Ancient leaves a 10–20s silent gap while
the AI simulates history. The user wants a fitting center-screen
animation — WHAT it is gets discussed later; candidates for that
discussion:
BUILD (a): a center-screen YEAR COUNTER sweeping 4000 BC → the
start year, era names fading through ("Bronze Age… Classical…"),
driven by the REAL simulated turn (the ff is chunked — live
progress exists); shows turn i of N; honors reduceAnimation
(falls back to a plain progress line); never delays the hand-off.
OPTIONAL LATER (user-noted): (b) the deluxe cut — the actual world
BUILDING ITSELF, checkpoint states rendered as history passes via
the A47 theater machinery. Queue (a) at the helper tail.

## A60 — AI cities get real names (A55.1 ACTIVATED + root-caused 2026-07-15; assigned: helper — WINDOW: opens when the B11 window closes, this one is a REAL re-record)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — new cityName(state,cmd,ruleset,cityId,idNum) in engine/cities.js + luau/cities.luau (both engines, one claim, byte-shaped twin): cmd.name wins ('' falsy as before); else for a civ'd player walk ruleset.civs[civ].cities for the first name unused by ANY current city (used-map over cityOrder), then a 'New <name>' cycle, then '<CivName> Outpost <idNum>'; player with no civ keeps the old 'City <cityId>' fallback so crafted/no-civ scenario hashes hold. Verified live: romans found Rome/Ostia/Antium/Cumae/Pompeii/Ravenna/Neapolis/Verona → New Rome/New Ostia/… ; no-civ → 'City c0'. REAL RE-RECORD: sim goldens 100:0x88490ab4 200:0x65d4c523 300:0xd43e98cf 400:0x56b7fbd3, natural rounds395/p2/0x56a3c878 (double-run deterministic); luau turn-100 twin re-pinned 0x560088f5→0x88490ab4, GREEN cross-language under lune (Luau reproduces the new hash). Scenario 003 did NOT move (founds no nameless civ cities). 5-seed soak clean. Item pt4 (extend 8→16 name lists) DEFERRED — data-source-governed, and 8 names already name every civ's first cities for the README shot. Files: engine/cities.js, luau/cities.luau, test/simulation.test.js, test/luau-twins.test.js.]

ROOT CAUSE (architect): engine/cities.js:269 `cmd.name || 'City ' +
cityId` is the ONLY naming; the AI's foundCity command carries no
name (ai.js:542) — every AI city in EVERY game has always been
"City cN"; human cities differ only because the CLIENT prompt sends
a name. Fix in the ENGINE so every caller benefits (AI rounds,
regent turns, fast-forward, Roblox):
1. foundCity, when cmd.name is absent: walk
   `ruleset.civs[player.civ].cities`, take the first name not used
   by ANY current city (global uniqueness — two Romes read as a
   bug; iterate via cityOrder, never Object.keys); list exhausted →
   "New <list[k]>" cycling; exhausted again → "<CivName> Outpost N"
   with N derived from nextCityId (deterministic, never a bare id).
   Player without a civ (crafted states) → old fallback stands, so
   crafted-scenario hashes without civs are untouched.
2. BOTH ENGINES one claim (cities.luau twin; the uniqueness-walk
   order is part of the contract).
3. GOLDEN IMPACT — REAL RE-RECORD (the first since the port):
   every sim golden contains AI-founded cities, so all five sim
   goldens + the natural golden move; scenario 003 re-pins if it
   founds nameless. Full discipline: re-record BOTH engines, paste,
   twins green vs the new pins, 5-seed soak spot-check.
4. While in there: consider extending the 8-name civ lists toward
   Civ 1's ~16 (data facts, cheap) — fewer "New Rome"s.
USER-BLOCKING: the v0.5 README screenshot waits on this. Sequence:
B11 window closes → A60's window opens (same day intended).

## A67 — Art pass: tank + APC + the refined-models list (wave VIII.7 — ally loop)

Tanks and mech. inf render as generic figures in PLAY (the user saw
them; reconcile with A44's coverage-guard verdict — the guard proves
a MAPPING exists, not that the mapping is worthy). Deliverables: a
real tracked TANK silhouette and an APC for mech inf, then a review
table of every unit whose current model is a generic figure vs one
"closer to the unit it represents" — the user wants the list grown.
Gallery re-shot; A48 visual goldens re-recorded (the process exists
now); the ally gets the before/after per the acceptance loop.

## A68 — Wave VIII UI bundle (items 8, 9, 10, 13, 16, 17-verify)

1. (VIII.8) Unit status line must FLOW UP when the action bar wraps
   to 2+ rows (settlers) — currently hidden behind the top row.
2. (VIII.9) HUD tile readout gains the tile's IMPROVEMENTS (road/
   rail/irrigation/mine/fortress); settler action bar GRAYS OUT
   inapplicable improvements (already-exists, wrong terrain) instead
   of letting the click bounce with an error.
3. (VIII.10) Own-city map labels: current production + turns left
   below the name pill.
4. (VIII.13) Civil disorder is LOUD: red city outline + a revolt
   icon on the map; inside the city view a red/dark-orange banner
   "CIVIL DISORDER — no production".
5. (VIII.16) Hovering a visible enemy unit shows unit type + civ.
6. (VIII.17-verify) SHIP GoTo: A65's findPath is domain-aware via
   injected canEnter, so sea routing over land should already be
   fixed — ADD the ship unit test (route around a peninsula through
   water; enter own coastal city) and confirm; if the greedy
   FALLBACK still walks ships toward land, fix the fallback's
   domain check. (The user played pre-A65 — likely already cured.)
All golden-safe client work. Screenshots read per item.

## A69 — Naval transport: ships carry land units (wave VIII.14 — MISSING Civ 1 mechanic, engine design)  [claimed: bugfixer 2026-07-16 @#550, cross-lane arbitrated @becf5e05] [done: 2026-07-16 — transport:N via UNIT_OVERLAY (trireme 2/sail 3/frigate 4/transport 8, user-confirm pending), aboard:<shipId> OMIT-SAFE (golden-safe), implicit load/unload via moveUnit, cargo moves with ship + drowns with it (cargoLost), NO AMPHIBIOUS ASSAULT (wiki silent + no Civ1 Marine — pinned, user-confirm pending); scenarios 019=0x713c1a30 + 020=0xd2b9aedb both engines; 7 new tests incl. revert-proof; SIM-GOLDEN-NEUTRAL verified; suite 337/337. A72 UNBLOCKED.]

Ships with transport capacity load/unload land units; if the ship
dies, its cargo dies with it. Design sketch (wiki verifies all
numbers at build — the user's Frigate 2 / Transport 8 are opening
values; Civ 1's real table incl. Trireme/Sail/Galleon rules):
- Data: `transport: N` on ship units (units.json via overlay).
- State: land units aboard get `aboard: <shipUnitId>` (string —
  state-shape change); aboard units don't act, don't exert ZOC,
  move WITH the ship, are hidden from combat except via the ship.
- Commands: implicit load (move land unit onto the ship's tile /
  ship at coast), unload (move from ship to adjacent land) — Civ 1
  semantics, wiki-checked; sleep-aboard default.
- Combat: ship sunk ⇒ every aboard unit destroyed (events narrate).
- GOLDEN-AFFECTING + state shape: full window, both engines,
  scenario fixtures FIRST (load/sail/unload; sink-with-cargo).
- Unlocks M13 (cross-ocean expansion) for the AI later — AI usage
  is its own batch after the mechanic exists for humans.

## A70 — Auto-improve for human settlers (wave VIII.15)

An "Auto" order on a settler: the CLIENT drives it each turn with
the engine AI's own improve policy (the regent pattern — the
policy picks, the client issues ordinary commands, replays record
them; golden-safe by construction). Cancel on attack/manual order.
UI: Auto badge + the order in the action bar. Depends on B11's
policy factoring (the callable it creates is exactly what this
consumes) — queue after B11 lands.

## A75 — World ages: the definition, the change event, and the historian's report (user design session 2026-07-15)  [claimed: coder-helper 2026-07-16] [done: 2026-07-16 — worldAge(state,ruleset) in engine/index.js + luau/index.luau (both engines, one claim per parity policy): highest of the FOUR TECH ERAS (ancient/renaissance/industrial/modern — Space Age is NOT a worldAge) reached by ≥ rules.json worldAgeThreshold(=30)% of ALIVE civs, "reached era i"=knows≥1 tech with eraIdx≥i (cumulative-upward). ageChanged emitted STATELESSLY: worldAge sampled before/after the endTurn wrap-processing, pushed on advance — transient event, never state, so GOLDEN-SAFE (sim 6/6 vs A60 pins, luau twins green incl. data checksums, event verified firing →renaissance at turn 211 in a real all-AI game). Fires at exactly THREE transitions (→renaissance/industrial/modern). CLIENT: client/ui/historian.js interstitial (age headline + world-public standings ranked by the REAL score.js components — score/cities/techs/pop, dead civs grayed; dismissable Esc/Enter/click, screenshot-verified); ageChanged→'world' class (turnlog-classes.js), a 🌍 turn-log line (turnlog.js), and rides the replay feed (replay-events.js). Tests: test/world-age.test.js (5: floor/threshold/cumulative-upward/dead-exclusion/space-ceiling), replay-events + turnlog-classes extended. Full suite 277/277. Files: engine/index.js, luau/index.luau, data/rules.json, client/ui/{historian.js(new),turnlog.js,turnlog-classes.js,replay-events.js}, client/main.js, client/style.css, test/{world-age(new),replay-events,turnlog-classes}.test.js.]

RULING (architect @d4c3e49b): worldAge ranges over the FOUR TECH ERAS ONLY — the Space Age stays a STARTING-scenario option (turn-keyed, no tech era of its own) and is NOT a worldAge, so the historian's report fires at exactly THREE transitions (→renaissance, →industrial, →modern).

THE DEFINITION (user's proposal, adopted — one mechanism family
with A66's barbarians): the world's CURRENT AGE is derived —
`worldAge(state, ruleset)` = the highest age whose TRIGGER TECHS
are known by ≥ 30% of alive civs (threshold shares
rules.json `barbTierThreshold`'s pattern; trigger techs per age
come from the existing TECH_ERAS mapping in techs.json — ages were
previously only STARTING options keyed by turn; this makes them a
live world property). Derived from state = no state change,
deterministic, Luau-free.
THE EVENT: when worldAge advances at a turn wrap, an `ageChanged`
event (transient, not hashed — golden-safe) fires world-news to
every seat (B5 filter class: world news).
THE HISTORIAN'S REPORT (user: "global statistics every change of
age"): the client shows an interstitial on ageChanged — "The world
enters the Industrial Age" + a compact global standings snapshot
(per-civ score/cities/techs/pop ranking AT THAT MOMENT, rendered
from the same engine components as A73's end screen; fog-safe:
scores are public like the score line today). Dismissable, logged
in the turn log, replay theater shows them at the right moments
for free (events ride the feed).

## A73-STATS — the statistics page content (designed with the user 2026-07-15)  [claimed: coder-helper 2026-07-16] [done: 2026-07-16 — opened from the end screen's "View statistics". client/ui/stats-data.js: PURE collectStats(rec, deps) — a render-free sandbox replay (same stepEntry contract as A47 + tools/replay.js, engine deps injected) collecting per-turn per-civ score/cities/pop/techs + battles won-lost (combatResolved), the wonders timeline (wonderBuilt), age markers (A75 ageChanged), and each civ's death turn (playerDefeated); DOM-free, 3 unit tests (aligned series / monotonic techs / deterministic). client/ui/stats.js: pure-SVG (no libs) time-series line charts (score/pop/cities/techs) with civ-coloured lines truncated at death, dashed AGE MARKER verticals labelled by age, a battles table + wonders timeline. Screenshot-verified (4 charts w/ Renaissance+Industrial markers, Greeks line truncates at its death, axes, legend; data cross-checked in node). Point 5 (M-column snapshot) DEFERRED per the item — needs A64 telemetry client-side. Golden-safe (reads recording + emitted events; no engine change). Wired: endscreen View-statistics → ctx.stats.open (coming-soon note remains the fallback), main.js initStats. Browser boot e2e 10/10, full suite 283/283. Files: client/ui/{stats-data(new),stats(new),endscreen}.js, client/main.js, client/style.css, test/stats-data.test.js(new).]

The end screen's "View statistics" opens:
1. **Time-series charts per civ** — score, cities, population,
   techs OVER THE GAME: derived by a fast sandbox replay of the
   recording collecting a snapshot per round (the A47 theater
   machinery at max apply-throttle, render-free — measured cost is
   seconds). Lines colored by civ, dead civs end at their death
   turn.
2. **Battles**: won/lost per civ (from combat events in the log).
3. **Wonders timeline**: who built what, when.
4. **Age markers**: A75's ageChanged moments as vertical lines on
   the charts (the historian's reports, revisitable).
5. The final M-column snapshot (cities founded, improvements,
   exploration %) once A64's telemetry helpers exist client-side.
Golden-safe throughout (reads recording + events).

## A74 — Replay theater polish (wave VIII.23-24; small, helper)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — (1) label "tempo"→"Replay speed"; (2) ⏮ Start button re-seeds the sandbox from turn 0 via a shared restart() (re-invoke of the existing initialState rebuild — resets state/idx/acc/feed/verified verdict; the ⏵-at-end path now routes through it too); (3) theater is now a flex column so #replay-feed is flex:1/min-height:0 full-height-minus-bar instead of the old top:52/bottom:16 absolute box. Golden-safe (client DOM+CSS only, no engine/renderer change). Screenshot read (e2e=9&e2eopen=1): label, ⏮ button, and full-height feed all render; feed shows real majors + "replay verified". Suite 251/251.]

1. Rename "tempo" → **"Replay speed"** (label only).
2. **⏮ back-to-start** button (re-seeds the sandbox from turn 0 —
   the machinery already rebuilds from initialState, this is a
   re-invoke, not new plumbing).
3. The theater's event feed (left side) uses the FULL vertical
   height minus the Play + Replay-speed controls — currently it
   under-uses the column.
Golden-safe, screenshots read.

## A73 — End-game scoreboard: who won, WHY, and by how much (user request 2026-07-15, after the Mongols surprise)  [claimed: coder-helper 2026-07-16] [done: 2026-07-16 — client/ui/endscreen.js: full-screen END SCREEN on gameOver. (1) HEADLINE names the victory REASON in plain words from the gameOver event's victory field ('Score victory — the year 1850 AD arrived, and the Romans had built the greatest civilization' / 'Conquest — the X stand alone'), VICTORY/DEFEAT/spectator verdict by viewpoint. (2) STANDINGS ranked by score with the COMPONENT BREAKDOWN as a stacked bar (population/techs/wonders, green/blue/gold) from engine scoreBreakdown() — NEW in engine/score.js + luau/score.luau, score()=breakdown.total so HASH-NEUTRAL (sim 6/6 vs A60 pins, luau twins green, verified). Winner row highlighted+👑, dead civs grayed with their FALL TURN (client-side deathTurn ledger from playerDefeated events, never state), plus city/tech/wonder counts. (3) BUTTONS: Watch the replay (ctx.replay.open), View statistics (A73-STATS landing = 'coming soon' note), New game (→ setup), Load (reuses saves.js Shift+L). (4) world-public scores → spectators/LAN see the same board; fires on the gameOver event AND on loading an already-over game. Screenshot-verified (score arithmetic matches scoreBreakdown: Romans 21pop×2+20×5+2×20=182). Golden-safe (render + pre-existing event payload; the score refactor is hash-neutral). Tests: scoreBreakdown component/sum test in score.test.js. Full suite 279/279. Files: engine/score.js, luau/score.luau, client/ui/endscreen.js(new), client/main.js, client/style.css, test/score.test.js. UNBLOCKS A73-STATS (the standings + scoreBreakdown are its base).]

The game ends and the winner banner explains nothing — the user
lost to a score victory at 2100 AD and rightly asked "how?!". A
full-screen END SCREEN on gameOver:
1. **The headline: the victory REASON in plain words** — "Score
   victory: the year 2100 arrived and the Mongols had the greatest
   civilization" / "Conquest: only the Romans remain" / defeat
   variants. The reason comes from the gameOver event (checkGameEnd
   knows it; carry it in the event payload if it doesn't already).
2. **The standings table**: every civ (dead ones grayed with their
   end turn), final SCORE with the BREAKDOWN by component exactly as
   engine/score.js computes it (population/cities/techs/wonders —
   render the real components from the engine's arithmetic, never a
   parallel formula), plus the M-column flavor stats we already
   track (cities founded, techs, wonders built).
3. **Buttons**: ⏵ Watch the replay (A47's theater — the natural
   pairing), **View statistics** (VIII.24: a stats page — CONTENT
   TBD with the user; candidates: score/cities/techs per civ over
   time charted from the recording's per-round data, battles
   won/lost, wonders timeline — design discussion pending),
   **Go to lobby** (VIII.25, LAN games: the server opens a FRESH
   lobby pre-seated with the same connected players — same host,
   names carried, civ picks reset to Random unless re-picked;
   disconnected players get open seats; anyone may leave via the
   existing flow; the rematch lobby is a NEW gameId/registry entry,
   the finished game stays resumable/replayable), New game (local),
   Load.
4. Spectators + LAN: everyone sees the same scoreboard (scores are
   world-public at gameOver; fullLog is already gameOver-gated).
5. Roblox: docs/13 Tier-4 gains the same screen (view-derived).
Golden-safe (render + event payload; if checkGameEnd's event gains
a reason field that IS an engine change — fixture-first, both
engines, but hash-neutral if events aren't hashed — verify: events
are transient, not state → truly golden-safe).

## A72 — AIR MOVEMENT + fuel: the whole air force is grounded (wave VIII.22 root-caused — a missing subsystem)

ROOT CAUSE (architect): movement.js:66 rejects any tile whose
terrain domain ≠ the unit's domain — and no terrain is domain
'air', so fighters, bombers, AND the nuclear missile cannot move AT
ALL (the user found it via the nuke; data says moves 16, the engine
says no). Design (Civ 1 rules, wiki verifies specifics):
1. Air units enter ANY tile (fly over land + sea); combat per Civ 1
   air rules (attack ground targets; interception later?).
2. FUEL: air units must END the game-turn in a city or on a carrier
   (or airbase if ever added) — Civ 1: fighter = 1 turn aloft,
   bomber = 2 (wiki authoritative); out of fuel elsewhere → crashes,
   destroyed with a turn-log line. State: a fuel/aloft counter on
   air units when airborne (state-shape change).
3. Nuclear = one-shot air (Civ 1): moves city-to-city, attacks once
   and is consumed; crash rules apply.
4. Carrier capacity = the A69 transport machinery with domain air —
   design the aboard mechanism ONCE for both (A69 first, this
   consumes it).
GOLDEN-AFFECTING + state shape: fixtures first, both engines, full
window. Sequenced after A69's aboard machinery lands.

### B17 — Improvement-terrain matching: audit vs the wiki (wave VIII.21; likely working-as-Civ1, verify)

The engine already runs Civ 1's TRANSFORM model (improvements.js:
irrigate/mine on terrains with no bonus TRANSFORM the terrain —
mine-on-grassland plants forest, per data/terrain.json). The user
expects hard matching (mines only on hills/mountains/desert…) —
AUDIT: (1) terrain.json's irrigate/mine/transform table cell-by-cell
vs the wiki extract; (2) the on-map MARKER rendering (does a
transform ever leave a stray mine marker on the wrong terrain?);
(3) whatever the truth is, A68's settler gray-out reads THIS table
so UI and engine agree. Outcome: fixes if the table drifts from
Civ 1, or a docs/01 §11 note that transforms ARE the Civ 1 behavior
(+ tell the user which).

[done: bugfixer 2026-07-16 — WORKING-AS-CIV1, verified cell-by-cell:
data/terrain.json matches the wiki terrain table on all ELEVEN rows
(irrigation +1 food on desert/grassland/hills/plains; mine +1sh
desert/mountains, +3sh hills; transforms forest→plains both works,
mine plants forest on grassland/plains/jungle/swamp, irrigate clears
jungle/swamp→grassland; nothing on arctic/tundra/ocean). The user's
'mines only on hills/mountains/desert' expectation is later-Civ
memory — Civ 1 mine-on-grassland PLANTS FOREST and our engine does
exactly that. (2) markers clean BY CONSTRUCTION: processWork's
transform path deletes both tile flags and props.js draws markers
from those flags — no stray-marker path exists. (3) docs/01 §11
verdict note added (tells the user which). THREE river-flag
deviations recorded there + mailed as queue candidates (all inherent
to the deliberate §3.1 flag model): rivered tiles can mine-transform
into forest+river hybrids Civ 1 never had (River had no mine option);
rivered roads get the base terrain's trade bonus (Civ 1 River road
gave none); bridge-building tech exists but gates nothing (Civ 1
required it for roads on River squares). No code change. Suite
283/283 (with the apply-on-load follow-up in the same run).]

## A71 — Special-units audit (wave VIII.20 — architect + wiki first)

Walk EVERY non-plain unit through the wiki extract and rule:
correct / missing behavior / add-remove bonus. Known suspects:
catapult-vs-walls interactions, battleship's role, nuclear missile
(Civ 1 nukes!), submarine (invisibility rules!), carrier (air
capacity), diplomat + caravan (do they exist AT ALL in our 28?),
fighter/bomber fuel rules. Output: a table in docs/01 §11 (have /
missing / decision per unit) that becomes the next engine-feature
queue. Architect audits; items cut from the verdicts.

## A66 — Barbarians era-scale, then become REBELS (wave VIII.6 — design; rides the A63/B13 window family)
[TIER-1 done: bugfixer 2026-07-16 in the B13 window (@011b9ab7) — barbTier(state,ruleset) in engine/barbarians.js + luau twin: spawn unit = highest rules.barbTiers entry whose trigger tech is known by >= rules.barbTierThreshold(30)% of ALIVE non-barb civs (reuses obsolescence triggers: militia/musketeers@gunpowder/riflemen@conscription/mech-inf@labor-union). Non-roster-owner safe. test/barbarians.test.js (3). Golden-neutral in the 400-turn sim (no civ reaches gunpowder). The "become REBELS" behavior (barbs from disorder/collapse) is NOT in this tier — that is a later slice; this closes only the era-scaling spawn.]

Barbarians must not stay militia-forever in a musket world:
1. **Tier function** (engine, derived — no new state):
   `barbTier(state, ruleset)` = the highest military era such that
   ≥ 30% of ALIVE civs know its trigger tech — the SAME trigger
   techs as A63's barracks obsolescence (Gunpowder, Combustion):
   one vocabulary, one data table. The 30% threshold is a ruleset
   number (data/rules.json `barbTierThreshold` — the user's opening
   number, tunable).
2. **Spawn table per tier** (data/rules.json): tier 0 militia
   (+legion mix?), tier 1 musketeers, tier 2 riflemen, tier 3+
   mech-inf/armor mix — exact mixes authored at build time,
   wiki-informed where Civ 1 has an answer.
3. **THE RENAME (user flavor ruling)**: past the riflemen tier,
   barbarians present as **REBELS** — a display-name derivation
   from barbTier (client, turn log, Roblox), NO state change (seat
   id stays `barb`; the name derives deterministically from state,
   fog-safe).
4. GOLDEN-AFFECTING (spawn rolls change) — rides the same window
   family as A63 slices 1–2 / B13 (shared trigger-tech data, one
   re-record); telemetry check: barb/rebel kill pressure stays a
   THREAT band, never the strongest army on the map.

## A64 — Soak telemetry v2: the nine AI-health columns (docs/05 §12; golden-safe, ships BEFORE any AI capability work)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — all FOURTEEN columns M3–M14 in one pass (architect ruling @2d95d58e: accumulator side-channel, all-14). test/sim-driver.js snapshot() enriched with pure-state columns (M3 pop, M4 imprPct over workedTiles, M5 netRoad/netRail via road-network components + continent flood-fill, M6 milPct best-tier proxy [full obsoletedBy % reserved for A63], M7 bldgPct tech-available beneficial coverage, M8 wonders/wonderAct, M9 explPct non-ice, M13 continents, M14 scoreSpread + alive/deadCivs) + a DRIVER-OWNED accumulator (never state) for the cumulative half: capture the events the engine already emits (replaced the throwaway [] passed to runAiTurn; read endTurn/chaos res.events) → M8 wonderTry (deduped), M10 buys, M11 attacks/captures, M13 crossWater; a driver-only unit-idle ledger → M12 idleSet/stuckU. Threaded through runSim (makeTelemetry + once-labelled continents) and onCheckpoint(...,tel,contLabels); tools/soak.js --stats passes them into the JSONL. GOLDEN-SAFE: simulation.test.js 6/6 green vs the A60 pins (event capture is behavior-neutral — eventsOut is write-only). PERF: 400-turn seed TEL-ON 34.2s vs TEL-OFF 35.3s — within noise, <1% (well under the 5% budget). 9 unit tests (test/sim-telemetry.test.js: continents incl. diagonal-bridge + wrap, road connectivity, exploration, event accumulator, idle ledger). Field map documented in docs/05 §12. Full suite 268/268. Files: test/sim-driver.js, tools/soak.js, test/sim-telemetry.test.js (new), docs/05-simulation-test.md. Sim-runner's ≥25-seed baseline can run.]

The measurement half of the user's metric contract (docs/05 §12
table M1–M9): tools/soak.js --stats + the sim-driver stats surface
gain columns for M3 total pop, M4 improvement-completeness % (per
city's WORKED tiles carrying their appropriate improvement), M5
road/rail same-continent city-pair connectivity (flood-fill along
road/rail tiles), M6 army-modernity (best-tier distribution now;
the % vs obsoletedBy chains arrives with A63's data; the
observed-enemy tier gap needs the A63/B13 knowledge model — column
reserved), M7 era-appropriate building coverage, M8 wonder
attempts/completions per civ, M9 exploration coverage % (non-polar
tiles per civ over checkpoints), PLUS the M10–M14 additions
(user-approved 2026-07-15): M10 gold circulation (treasury
trajectory + buy usage), M11 conflict health (attacks/captures/
elimination band 20–40% by t300 — user-set), M12 idle assets
(settlers idle >10t, units stuck >15t), M13 cross-ocean expansion
(cross-water foundings, continents per civ), M14 competitive
spread (surviving-civ score ratio band). Fourteen columns, one
pass. Pure telemetry — reads states,
changes NO behavior, goldens untouched. Then the sim-runner
baselines ≥25 seeds × {normal, godemperor} on medium so the user's
targets get real numbers to tune against; docs/05 §12 pins the
tuned targets after that discussion.

## A65 — Cost-aware GoTo: real pathfinding over roads and rails (wave VIII item 5 — activates docs/04's open pathfinding note)  [claimed: coder-helper 2026-07-15] [done: 2026-07-15 — shared/pathfind.js findPath: PURE Dijkstra, lua-portable subset (plain-object dist/prev/visited, array open list + idx tie-break, CAP 8000); cost ×3 integer (rail 0 / road 1 / terrain.move×3) so roads+rails preferred by cost not special-case. Legality INJECTED (canEnter) — extracted tileEnterable from move-hints so affordance + planner share ONE source; fog-honest (explored only, replans per step). input.js: gotoStep/gotoPreviewPath use findPath, greedy fallback for fog/enemy targets. 5 unit tests (road detour, rail corridor, fog+unexplored-target block, wrap seam→B12, ocean domain); e2e=3 proves client integration. pathfind.luau = roblox-helper Tier-1 (subset ready, not gated). Golden-safe (client-consumer). Suite 251/251.]

GoTo currently uses the greedy stepper (deliberately NOT a
pathfinder — the ally's round-2 wording stands in docs/04). The
user now wants routing that USES the network: a real least-cost
path over movement costs — terrain moveCost from data, road = 1/3,
rail = free (Civ 1 rules), so roads/rails are preferred exactly as
much as they're cheaper, never by special-case.
1. **Where it lives**: `shared/pathfind.js` — PURE function
   (state, ruleset, unit, target) → [steps], written in the
   Lua-portable subset. Reasons: the Roblox client wants it next
   (docs/13 Tier 1 GoTo), and the AI may adopt it later (THAT
   adoption = golden window; until then this is golden-safe by
   construction — the pathfinder only chooses which ordinary move
   commands the CLIENT issues, and replays record the moves
   themselves).
2. **Fog honesty**: route only through EXPLORED tiles; unexplored =
   untraversable for planning (the route replans as fog lifts —
   GoTo already re-evaluates per turn). Never read unseen state.
3. **Algorithm**: Dijkstra (or A* with admissible terrain-min
   heuristic) over the wrapped grid; ZOC and impassables respected
   via the same movement-legality helper the engine uses — reuse,
   don't re-implement legality.
4. Client: GoTo planned-route rendering unchanged in look, now
   showing the cost-aware path; move-hints unaffected.
5. Tests: unit tests on crafted maps (road detour beats short rough
   path; rail corridor wins; fog blocks; wrap seam routes east-west
   — ties into B12); client case: a GoTo across a road network
   follows the road.
Golden-safe (client-consumer only). Queue: helper tail after A62.

## A62 [done: coder-helper 2026-07-15 — diorama always-on: dropped the first-visit SEEN_KEY gate from splashWanted; remaining skips (reduceAnimation, webdriver, demo/e2e params, ?splash=0) stand; ?splash=1/?splashstill=1 still force. No test to update (A42 screenshot-verified; webdriver skip keeps browser cases unaffected). Suite 246/246.] — Diorama on every visit (wave VIII item 1 — NOT a regression; tiny, helper)

The user misses the splash diorama: it vanished BY DESIGN (A42 was
first-visit-only via a localStorage flag; he is now a return
visitor). RULING: he loves it, so flip to ALWAYS-ON — the skips
that remain are reduceAnimation, e2e/webdriver paths, and ?splash=0.
One-line default change + the A42 test's flag case updates. The
zero-cost-return-visit property is retired deliberately.

## A63 — Obsolescence & upgrades bundle (wave VIII items 2–4 — DESIGN; golden-affecting parts staged)
[items 1+2 CONSUME done: bugfixer 2026-07-16 in the B13 window (@011b9ab7), on the helper's authored data (13 unit obsoletedBy chains + barracks.obsoletedByTechs). Item 1 (units obsolete): setProduction rejects + AI skips obsolete units cross-language (see B13 done-mark). Item 2 (auto-sell obsolete buildings): tech.js sellObsoletedBuildings removes barracks + credits full cost (rules.sellPriceRatio=1) + buildingSold event, on gunpowder/combustion, cross-language. NOT done here: item 3 (field upgrades for gold, upgradeUnit command) — human-only golden-safe slice, separate; and wonder-expiry / other buildings' obsolescence beyond barracks (data table can extend — the machinery is generic over obsoletedByTechs). A86 (manual sell) reuses the sell helper; the soldThisTurn flag was deliberately NOT added (A86's state shape).]

**[A63 DATA-HALF: recon done (helper @a1ffc956), RULED by architect @4cfe6d31 — extraction queued as a fresh focused pass, pacing granted; B13's window waits on quality not the clock.]** Findings: the wikiteam dump is MULTI-GAME (Civ1-7) — Civ1 must be isolated by "(Civ1)" tags; the item's proposed chains were partly Civ2. RULINGS: (a) UNITS — author the WIKI-AUTHENTIC per-successor Civ1 chains ("[Successor] renders X,Y,Z obsolete", stated in the successor's article; e.g. Riflemen[def5/cost30/Conscription] obsoletes Cavalry/Legion/Musketeer), DISCARD the item's proposed militia→musketeers→riflemen where it diverges. (b) BUILDINGS — tech-triggered auto-sell MOVED OUT to the Civ2-rules-mode shelf (not Civ1-authentic); A63's Civ1 default keeps only wiki-supported obsolescence. (c) GREAT WALL obsoletes-barracks — model as a WONDER EFFECT (obsoletesBuilding field), the one authentic Civ1 building obsolescence. (d) WONDER expiry — already extracted (wonders.json obsoleteBy, 11/21 from the "Made obsolete by" column); verify completeness. PLAN: per-Civ1-article extraction of successor→obsoletes, naming-drift to slugs, obsoletedBy overlays in tools/mapdata.js, regenerate, goldens byte-identical + data-checksum parity (engine-unconsumed until B13 = golden-neutral), paste the table for the user's editorial pass.

**[A63 RE-RULING (architect, 2026-07-16, from helper @457's fuller dig + user Playtest-IX):** rulings (b) and (c) above are CORRECTED. (b-rev) Barracks obsolescence IS Civ1-authentic — the buildings table and the Barracks (Civ1) article both say "Obsoleted by Gunpowder AND Combustion". AUTHOR NOW: `barracks.obsoletedByTechs = ["gunpowder","combustion"]` via BUILDING_OVERLAY + regenerate (engine-unconsumed = golden-neutral). MECHANIC (consumed at B13): the user rules from playtest memory that barracks were **SOLD (gold credited), not vanished** — the wiki article says vanish-and-rebuild, delta logged, USER AUTHORITY WINS: on discovering each listed tech, every existing barracks is removed and its sell price credited, turn-log line per city. The sell path is SHARED with A86 (manual sell). The Civ2-rules-mode shelf keeps only the broader Civ2 auto-sell-any-obsolete-building flavor. (c-rev) Great Wall obsoletes-barracks WITHDRAWN — helper's misread, his correction accepted; Gunpowder independently expires the Great Wall (existing wonder-expiry entry), obsoletes militia/phalanx (unit table), and obsoletes barracks (b-rev). No obsoletesBuilding wonder field.]**

**[A63 UNIT HALF + WONDER HALF DONE 2026-07-16 (helper @65b5040d) — building half pending re-ruling]** SOURCE: each Civ1 unit INFOBOX has a structured `|obsolete = <Tech>` field (columnar, not prose-only as recon feared) — cross-checked vs the tech articles. Authored 13 obsoletedBy in UNIT_OVERLAY + regenerated units.json (zero naming drift; diff = only the added fields; other 4 data files byte-identical). TABLE: phalanx/militia→gunpowder, musketeers/cavalry/legion→conscription, catapult→metallurgy, cannon→robotics, chariot→chivalry, knights→automobile, trireme→navigation, sail→magnetism, frigate→industrialization, ironclad→combustion. Suite 302/302 = golden-NEUTRAL + luau checksum parity. WONDER expiry already complete (11 obsoleteBy incl. great-wall→gunpowder) — no work. RULING CORRECTIONS surfaced (@65b5040d): (b) Civ1 barracks obsolescence IS authentic — "Obsoleted by Gunpowder AND Combustion", VANISH-and-rebuild mechanic (auto-SELL is the Civ2 part); awaiting re-ruling to author barracks.obsoletedByTechs. (c) WITHDRAWN — Great Wall does NOT obsolete barracks (recon misread); it's Gunpowder that obsoletes barracks + expires the Great Wall wonder (already the wonder-expiry entry). Files: tools/mapdata.js, data/units.json.

**[A63 DATA HALF COMPLETE 2026-07-16 (helper) — B13 window openable]** Barracks authored per re-ruling @8c1d2261: barracks.obsoletedByTechs = ["gunpowder","combustion"] in BUILDING_OVERLAY + a conditional pass-through in buildBuildings (only barracks gets it; other 20 buildings byte-identical). Regenerated; suite 315/302 = golden-neutral + luau checksum parity. MECHANIC (B13, not this data pass): on discovering each listed tech, REMOVE the barracks and CREDIT its sell price as gold + turn-log line (user authority over the wiki's vanish; delta logged). Removal+credit helper SHARED with A86 (manual sell-building). A63 data half DONE: 13 unit obsoletedBy chains + barracks obsoletedByTechs + wonder expiry (pre-existing). Files: tools/mapdata.js, data/units.json, data/buildings.json.



Three features, one substrate: an `obsoletedBy` chain in the unit
(and building) data, authored via tools/mapdata.js overlays from
the wiki extract (the authority — verify every trigger there at
build time, never from memory).
1. **Units obsolete** (item 2): once a unit's successor is BUILDABLE
   (its tech known), the older unit leaves the production catalog
   (client hides; engine setProduction rejects 'obsolete').
   Chains from Civ 1 (verify vs wiki): militia→musketeers→riflemen
   →mech inf; phalanx→pikemen? (Civ 1 has no pikemen — verify the
   real chain); cavalry→knights→armor per the wiki. AI unit choice
   automatically stops building stale units = the structural cure
   for B13(a)'s phalanx spam. GOLDEN-AFFECTING (AI choices change):
   window + re-record, land WITH B13(a).
2. **Auto-sell obsolete buildings** (item 3): when the obsoleting
   tech is discovered, affected buildings sell automatically for
   their Civ 1 sell price (gold credit) with a turn-log line —
   PROPOSED triggers pending wiki verification: Barracks obsolete
   at Gunpowder (rebuild for the musket era) and again at
   Combustion; the user asked for clarification and this is the
   proposal — wiki extract decides, user confirms the final table.
   EXTENDED (VIII.12, user): the table covers ALL obsoletable
   buildings (city walls included if Civ 1 says so) AND wonder
   EXPIRY (Civ 1 wonders expire on specific techs — e.g. the
   classic Colossus/Oracle expirations; the wiki extract carries
   the full expiry column). No user input needed: wiki is the
   authority, the user gets the editorial pass on the final table
   exactly like the leader names.
   GOLDEN-AFFECTING (state change on tech discovery).
3. **Field upgrades for gold** (item 4, Civ4-style): an
   `upgradeUnit` command — a unit standing IN AN OWNED CITY may
   upgrade to its successor for gold. PROPOSED formula (editable):
   `gold = 10 + 2 × (costNew − costOld)` (shield costs from
   units.json). Veteran status carries. HUMAN-ONLY at first =
   GOLDEN-SAFE initial slice; AI adoption later rides a window.
   SYNERGY: Leonardo's Workshop (already in wonders.json) gets its
   true Civ 1 effect — free automatic upgrades while active — from
   the same machinery; check what our Leonardo effect field
   currently does and wire it here.
Order: design confirmed → data authored (mapdata overlay) →
slice 3 human-only (golden-safe, ships first) → slices 1+2 in the
B13 window with the re-record.

## A55 — remaining micro-finding (screenshot hunt 2026-07-15)

**`?zoom` / `?overlay` params are ignored on the `?age=` path** —
the fast-forward hand-off overrides the boot camera and overlay
init. Honor explicit params after hand-off. Client-only, small.

## A61 — Hardened-by-default server + `--debug` mode (user posture ruling 2026-07-15; URGENT SLICE — assigned: helper, ideal B11-window filler, golden-safe)  [slice 1 done: coder-helper 2026-07-15 — static WHITELIST (/client /engine /shared /data only; else 404 before file read); --debug restores whole-repo (servable() short-circuit). Proven: real save-with-token on disk → /saves/*.json 404 + token AND seat code absence-asserted in body; /debugging /ops /package.json 404; --debug serves gallery. --debug CLI flag + boot-log posture line; shoot.sh --server auto-adds --debug for /debugging/ URLs; run.sh passes through + --help documents it. Regression-checked gallery(python) + /client/?server=1(--server). Suite 246/246. SLICE 2 (logging/error --debug umbrella) NOT done — non-urgent, wire already safe, follow-up on request.]

USER RULING: the DEFAULT server posture is HARDENED; a `--debug`
flag (passed through by run.sh/run.ps1) opens the dev conveniences.
FINDING THAT MAKES SLICE 1 URGENT (architect): server/index.js:118
serves the ENTIRE repo root with only a traversal guard — on any
LAN game, `/saves/<gameId>.json` is fetchable over plain HTTP and
carries SEAT TOKENS + SEAT CODES (seat hijack by URL);
`/debugging/logs/*` and gitignored-on-disk files (ops/,
.agent-mail/) are served too.
1. **Static WHITELIST (slice 1, do first)**: default mode serves
   ONLY `/client/*`, `/engine/*`, `/shared/*`, `/data/*`; anything
   else 404s. `--debug` restores whole-repo serving
   (debugging/gallery.html needs it; shoot.sh's `--server` mode
   passes --debug when its URL targets /debugging/).
2. **--debug umbrella**: verbose logging in debug / one-line in
   default; error replies carry detail in debug / bare codes in
   default where reasons would leak internals; future dev endpoints
   hang off the same flag. Document in run.sh --help + README.
3. Tests: default — /saves/*.json and /debugging/* 404 while the
   four whitelisted roots serve (absence-assert tokens never
   travel); --debug serves the gallery; run.sh --help documents the
   flag (the guards pattern).
A50 builds ON this posture; its remaining items assume
hardened-default.

## A76 — Space victory: Apollo Program → spaceship → Alpha Centauri (user 1.0 ruling 2026-07-16)

**[DETAIL PASS (user ruling 2026-07-16 night: same composition as
Civ 1, wiki-documented — facts extracted):** Apollo Program
(wonder, 600, Space Flight) gates ALL civs' part-building (each
needs Plastics/Robotics/Space Flight per part type) + reveals the
whole map. Parts as city builds, auto-added to the ONE ship per
civ: **STRUCTURAL** (Space Flight, 80 shields, 100t, max 39) — the
frame; unconnected parts don't function; **COMPONENTS** (Plastics,
160, 400t, max 8 EACH): propulsion / fuel, 1 fuel powers 1
propulsion; **MODULES** (Robotics, 320, max 4 EACH): habitation
(10k colonists, 1600t) / life support (feeds one hab, 1600t) /
solar (powers 2 modules, 400t). SHIP CHARACTERISTICS (all derived,
integer math): population, support%, energy%, mass, fuel%, flight
time (mass vs engine power), success probability (food+energy+
flight time). Launch = point of no return; capital captured ⇒
ship destroyed (may rebuild); FIRST ARRIVAL wins the score bonus
(zero-success arrivals score nothing). All costs/caps/masses to
rules.json; numbers above are the wiki's.]**

Civ 1's real endgame, promoted from §12 out-of-scope by the user:
someone completing the APOLLO PROGRAM wonder unlocks spaceship
PARTS in every civ's catalog (structural/component/module per
Civ 1 — the wiki extract carries part counts/costs/success math);
build parts in cities, launch, first ship to arrive (or best odds,
per Civ 1's rules) wins the SPACE VICTORY; conquest of the
launcher's capital scrubs the flight (Civ 1 rule — verify). New
victory type in checkGameEnd + A73's reason line + M-columns
(parts built, launches). Engine + data + UI; state shape grows a
spaceship block per civ = golden window family, fixtures first.
Design pass on the wiki numbers, then slices.

## A77 — Sound design v1 (user ruling 2026-07-16: effects for ALL events; tunes for creation + splash; soundtrack later)  [claimed: coder-helper 2026-07-16] [done(v1 impl): 2026-07-16 — SYNTHESIS approved (architect @0920cba9): chiptune-adjacent WebAudio, ZERO repo bytes / zero licensing surface. client/ui/sound-map.js: PURE soundForEvent(e,viewer,cityOwner) riding the turnlog-classes inputs — viewer-aware so combat-win/combat-loss are the user's triumphant/sad pair; SOUND_IDS is the published contract (Roblox row mirrors the MAP, not the source); 4 unit tests. client/ui/sound.js: a tiny oscillator+envelope synth, a recipe table for all 22 cues + two procedural TUNES (creation/splash), fog-filtered cue wiring (filterEvents, session-optional), lazy AudioContext resumed on first gesture (autoplay policy), ⚙ split (master+effects+music, SEPARATE from reduceAnimation). options.js: soundMaster range + soundEffects/soundMusic toggles + defaults. Wired: cues via ctx.sound=initSound (main.js), creation tune under the fast-forward, splash tune under the setup diorama (both tune-only instances reading stored prefs; webdriver-excluded via splashWanted). debugging/soundboard.html (architect addition @7962d375): the gallery's audio twin — every SOUND_ID as a ▶ row + both tunes + per-row comment box + download-JSON/copy-all, served under --debug; it's the USER's tuning surface AND my dev harness. VERIFIED headless (quality = the user's ears by design ruling): map tested, soundboard screenshot renders every row (synth builds w/o throwing), browser e2e 16/16 boots+plays cues in real games w/o throwing, full suite 287/287. HUMAN TUNING PASS pending → points at debugging/soundboard.html. Files: client/ui/{sound-map(new),sound(new),options,setup}.js, client/main.js, debugging/soundboard.html(new), test/sound-map.test.js(new).] [tuning round 1: 2026-07-16 — user soundboard verdicts (16 ok, both tunes approved, 6 reworked in sound.js RECIPES): combat-win longer+triumphant (rising fanfare held on high C), capture-win more triumphant (brighter high fanfare), build more triumphant (rising C-E-G), disorder = a RIOT (detuned low cluster that beats like an angry crowd), elimination longer+sadder (slow descending minor line), regent = a "yes, sir" two-note affirmative (rising fifth). Other 16 cues + tunes frozen as-approved. Synth builds (soundboard re-renders), suite 315/302. User re-runs the soundboard to sign off.]

Every game event gets a sound effect — combat WINS triumphant,
LOSSES sad (the user's explicit pair), founding, growth, discovery,
wonder completion, disorder, era change (the historian deserves a
fanfare), regent handoff, treaty events when diplomacy lands. Plus
two tunes now: world-creation/fast-forward accompaniment and a
splash/diorama theme; full soundtrack LATER by design. Design
questions for the item pass: asset sourcing (original/generated
only — the license discipline extends to audio), a data-driven
event→sound map (events already flow through turnlog-classes — the
map rides the same classification), volume/mute controls in ⚙
(master + effects/music split; reduceAnimation does NOT imply
mute — separate toggle), Roblox parity via the same event map
(docs/13 gains a sound row). Browser: WebAudio, SYNTHESIZED (ruled
2026-07-16 — license-clean by construction, no vendored audio).
PLUS THE SOUNDBOARD (user request 2026-07-16):
`debugging/soundboard.html` — the gallery's audio twin, served
under `--debug` (A61 blocks /debugging by default): every
SOUND_ID as a numbered row with a ▶ button (plays the real synth
cue), the tunes in a music section, a COMMENT box per row, and
"download comments" (JSON with sound id → note) + copy-all — so
the user clicks through, types reactions, and hands the file back
for the tuning round. Zero game deps beyond sound-map + sound.js.

## A78 — First-timer tutorial advice (user ruling 2026-07-16)  [claimed: coder-helper 2026-07-16] [done: 2026-07-16 — client/ui/advice.js: 8 short original ADVICE OFFERS surfaced once each. Pure gate in client/ui/advice-gate.js (adviceGate(id,seen,enabled,isBot) — DOM-free, 3 unit tests): shows iff tips enabled, human (never webdriver/e2e), and unseen (per-id first-visit flag in localStorage). Non-blocking lower-left card with "OK, got it" (marks this id seen) or "No thanks" (silences all present+future); a queue shows one at a time. TRIGGERS — event-driven off session.onChange with NO hooks in the emitters (disorder→cityDisorder, save-code→saveCode, regent→regentTurn, settler→first own settler in state); interaction hooks are one-liners (unit-selected→main.js selectUnit, city-view→panels openCityPanel own city, tech-choice→panels toggleResearchPanel, combat-hover→input.js on an attack-odds hover). ⚙ "Show first-time tips" toggle (firstTimeTips default true) — re-checking calls reset() so they reappear (ctx.options.watch). Content is short prose; the A58 pedia link is a future field. Screenshot-verified (the 'Founding a city' card, lower-left, OK/No-thanks); browser e2e 16/16 (webdriver-gated → no cards, existing shots byte-stable); full suite 290/290. Golden-safe (client + localStorage only). Files: client/ui/{advice(new),advice-gate(new),options,input,panels}.js, client/main.js, client/style.css, test/advice.test.js(new).]

First-time players get contextual ADVICE OFFERS — dismissible ALL
at once ("no thanks") or acknowledged one-by-one ("OK, got it"),
and mutable later in ⚙. Trigger moments (first-visit flag per
advice id, localStorage like the old splash flag): first unit
selected (movement + action bar), first settler (founding), first
city view (production/workers), first combat hover (odds), first
disorder, first tech choice, first save-code toast, first regent
offer. Content is short original prose (pedia A58 carries the
depth; advice links into it). Never blocks input; never shown to
returning players; e2e/webdriver paths skip.

## A79 — Blockade: enemy units block worked tiles (user war-doctrine rule 2026-07-16; wiki-check first)

An enemy unit standing on a tile a city works BLOCKS that tile's
harvest (city view shows the blocked tile red/crossed). CHECK the
wiki first: Civ 1 may already specify this (if authentic, it's
fidelity; if not, it's a house rule the user wants regardless —
document which). Engine change in workedTiles/auto-assign (skip
blocked tiles; manual assignment to a blocked tile rejected or
zero-yield — design call at build), golden window + scenario pin.
Sieges (docs/15 §2.4) emerge from this rule nearly free.

## A82 — Map types: Continents / Pangaea / Archipelago (user note 2026-07-16, night close)

Civ 1's "Customize World" (land mass / temperature / climate / age
— wiki verifies the authentic knob set) and the Civ 2-style map
FORMS the user names: Continents, Pangaea, Archipelago (+ more as
data). Design:
1. `setup.mapType` → a rules-driven PRESET table (data/rules.json
   mapTypes: each preset = mapgen parameter overrides — continent
   count/size distribution, drunkard-walk budgets, ocean fraction).
   Mapgen consumes the preset; SAME rng discipline, deterministic
   per (seed, type).
2. **THE IDENTITY PATTERN (A40-s1's trick)**: the DEFAULT preset's
   parameters EQUAL today's literals — goldens and scenario 002
   unchanged by construction; the proof is them staying green. New
   types are additive presets.
3. Setup dropdown + ?maptype= param; lobby create option; ff and
   sim harness accept it. (User re-confirmed Playtest-IX 2026-07-16:
   the game-options screen MUST carry the choice — Continents /
   Pangaea / Archipelago; Civ4-style variants = later ADDITIVE
   presets, data-only once the preset table exists.)
4. **THE SIM ANGLE (the user's actual point)**: landmass topology
   governs finding/attacking other civs — the war-lab ratio
   results are TOPOLOGY-CONDITIONED (current default only until
   this lands). Once presets exist, the sweep matrix gains a map-
   type axis (ratios × {pangaea, continents, archipelago}) — and
   M13 crossWater finally gets worlds where boats MATTER.
Both engines one claim (mapgen.luau twin), wiki pass on Civ 1's
authentic customize-world knobs at design time. Queue: after the
era-scaling family (it feeds the SAME sim program).

**DESIGNED with the user 2026-07-16 (four rulings, AskUserQuestion):**
1. **V1 SCOPE = Tier 1 + climate skews**: Continents (the IDENTITY
   preset — landPercent 32 / continents 5 = today's literals),
   Pangaea (1, ~36), Archipelago (12–16, ~28), Islands (20+, ~24),
   Big & Small (new sizeSplit — one walker takes most of the land
   budget). Masks (Inland Sea/Donut), Lakes (punch-lakes pass), and
   novelty shapes = a SECOND pass.
2. **SEA LEVEL + CLIMATE as separate dropdowns** (Civ4 pattern,
   honors Civ 1 Customize World): sea level low/medium/high =
   landPercent ±8; climate temperate/arid/tropical/cold = latitude
   band-table swaps (the four BAND_* tables become per-climate
   data). Defaults = today's world. riverDivisor may ride climate.
3. **TERRA gated on A69** (naval transport) — an unreachable new
   world is a trap type; starts-on-largest-landmass logic designs
   with it then.
4. **CIV CAPS = per-type table** (maxCivsByType modifiers layered
   on maxCivsBySize, enforced at the same five A38 gates).
Twins: per-(seed,type,seaLevel,climate) world-hash anchor table in
the twins gate. Sim: the topology axis joins the sweep matrix
(docs/15 §3); M13 crossWater finally measurable. Setup dropdowns +
?maptype=&sealevel=&climate= params + lobby create options.

## B20 — Ships attack coastal land (A71 headline gap; user green-lit 2026-07-16)

Civ 1: battleships/cruisers bombard units on coastal land squares.
Ours: attack = move-into, and ships can't enter land ⇒ verify then
fix — an ATTACK-IN-PLACE path for sea units vs adjacent land
targets (combat resolves normally, attacker stays at sea; no
capture from sea — an empty coastal city cannot be taken by a
ship, wiki-verify that edge). Both engines, scenario pin, golden
window (likely no golden movement since the AI builds no navy, but
window discipline anyway).

[done: bugfixer 2026-07-16 — VERIFY-FIRST VERDICT: NO CODE CHANGE
needed, the engine is already correct (claim @862778e7). movement.js
runs the hostiles->resolveAttack check BEFORE the domain check, so a
sea unit moving at an enemy on adjacent coastal land ATTACKS IN PLACE:
combat resolves normally and the attacker STAYS AT SEA (Civ 1 attacker
never advances). Probed cross-rng: ironclad/battleship vs coastal
militia both win and lose correctly with the ship never leaving water.
NO CAPTURE FROM SEA is already impossible two ways: (1) attacking a
coastal city's defender only fights the defender — resolveAttack
returns before moveUnit's capture line, so the city is never taken
(owner unchanged on a win); (2) an UNDEFENDED coastal city is a land
tile a sea unit cannot enter (impassable), so it cannot be walked onto/
captured. Wiki dump is SILENT on the ship-capture edge (no explicit
Civ1 statement in the extracted pages) — the item + user green-light is
the authority, and it matches canonical Civ 1 (ships bombard coastal
units; only land units take cities). PINNED cross-language: scenario
017-ship-vs-land (0x0f8a49f6) — battleship kills a coastal city's
fortified defender (ship stays at sea, city not captured), then cannot
move onto the emptied city (impassable). JS + luau both green (no
engine edit — the luau twins already matched), in PORTED, setup-count
15. Golden-neutral (no engine change; sim untouched). Full suite
316/316.]

## A83 — Caravan wonder-help (A71's cheap delight; user green-lit 2026-07-16)  [claimed: bugfixer 2026-07-16 @0b45b04e] [done: 2026-07-16 — explicit helpWonder command (architect-blessed deviation @e395a4e5: command over auto-on-enter), helpsWonder:true via UNIT_OVERLAY (data-driven, amount=def.cost=50, no new number), wonderHelped event + own-seat turnlog line, four rejection reasons; both engines byte-shaped; scenario 018-caravan-wonder=0x342cade9 (PORTED, setup-count 16); GOLDEN-NEUTRAL (AI fields no caravans); suite 324/324 zero-skip, 7 new tests incl. revert-proof; consume stays inline until A89 factors consumeUnit. Client button = A90.]

Civ 1: a caravan entering a DOMESTIC city building a wonder adds
its 50 shields and is consumed. Small engine command-path (the
caravan exists, unpowered today), turn-log line, both engines,
scenario pin. Trade routes stay in the phase-6/chains design.

## A89 — Caravan trade routes, Civ1-authentic (user prompt + wiki verified 2026-07-16; queue after A83)

The caravan's OTHER role (A83 = wonder-help only). Wiki (Caravan
(Civ1) article, formulas = facts, paraphrased):
1. ESTABLISH ROUTE: entering a FOREIGN city auto-establishes;
   entering a DOMESTIC city ≥10 tiles from home offers the choice
   (route or keep moving). Caravan consumed.
2. WINDFALL (one-time, cash AND research bulbs, both to sender):
   base = (distance + 10) × (tradeArrows(cityA)+tradeArrows(cityB))
   ÷ 24, integer math. ×½ if same continent; ×½ if same civ; ×⅔ if
   sender knows railroad; ×⅔ if sender knows flight (stacking ⇒
   1/9 minimum).
3. PERMANENT: home city gains trade arrows = (both cities' arrows
   + 4) ÷ 8, recomputed as the cities grow (LIVE bonus, not a
   snapshot); ×½ if same civ; distance does NOT affect this (the
   original manual was wrong — wiki correction).
4. Per-city cap: only the 3 most lucrative routes count toward
   arrows (extras still pay the windfall). Routes are NOT
   bilateral.
5. State: city.tradeRoutes = [{partnerCityId}] (live recompute
   keeps state lean); statehash-safe integers only.
USER-MEMORY DELTA (ruled): "+1 food / +1 shield" caravan delivery
is CIV 2 (food caravans/freight) — Civ2-rules-mode shelf, same as
barracks auto-sell; NOT in the Civ1 default. All numbers to
data/rules.json (tradeRoute block); both engines one window;
scenario pins (domestic-choice, foreign-auto, windfall math,
3-route cap). Turn-log 🐫 line + phase-6 chains design consumes
this later.

## A91 — Pollution, global warming, nuclear area effects (designed with user 2026-07-16; 1.0-required)

Civ 1 authentic, AUTHENTIC-ON default (user ruling; setup toggle
to disable):
1. CITY POLLUTION: points from shields (factory/power plants
   worsen; recycling/mass-transit/hydro/nuclear-plant reduce —
   BUILDING_OVERLAY effect fields) + population post-industrial
   techs (wiki-extract the trigger list). Threshold exceeded → a
   nearby tile gains polluted:true (skull prop; yields halved),
   placement via engine RNG (deterministic).
2. CLEANUP: settlers gain cleanPollution work (turns like mine).
3. GLOBAL WARMING: sustained world polluted-tile count → warming
   event (terrain transforms — swamp/jungle/desert spread; 🌍
   turn-log + historian mention). Thresholds/cadence data-driven.
4. NUKES: Manhattan Project gates globally (wonder effect); nuclear
   attack kills ALL units on target, halves city pop, pollutes the
   ring; ENABLED EVERYWHERE (user ruling) with a lobby host
   no-nukes toggle. Consumes A72's one-shot machinery.
All numbers wiki-extracted to rules.json/overlays; both engines;
scenario pins (pollution spawn, cleanup, warming, nuke strike);
MOVES GOLDENS (AI cities pollute) → full golden window.

## A92 — Debug-command surface (designed with user 2026-07-16; unblocks R7c-17)

debug:* command family — grantGold, spawnUnit, grantTech,
revealMap — RECORDED like any command (replays verify hash-exact).
Legality: state.debugEnabled fixed at game creation (server
--debug / Studio local / ?debug=1 local engine). TAINT (user
ruling): the first debug command sets state.debugUsed=true
PERMANENTLY — game-code display gains a DEBUG watermark, gameOver/
highscore flags it (docs/07 trust loop stays honest). Both
engines; scenario pin (a debug command + the taint flag in the
hash); the Roblox debug menu (R7c-17) and a browser --debug panel
become thin clients of it later.

## A90 — Help-Wonder action-bar button (A83's client half; helper, small)  [claimed: helper 2026-07-16] [done: 2026-07-16 — client/ui/input.js only: shared helpWonderCityFor(unit) gate (helpsWonder unit standing in a DOMESTIC city whose producing.kind==='wonder', mirrors engine helpWonder checks) drives both an action-bar "🏛 Help Wonder (+N shields, consumed)" button (N=def.cost, data-driven, absent otherwise) and the H key (silent no-op when gate fails; inside the INPUT/TEXTAREA-guarded keydown handler); dispatches helpWonder → hud note + nextUnit; helpWonder added to ACTION_COMMANDS, notBuildingWonder/cannotHelpWonder added to REASON_TEXT. GOLDEN-NEUTRAL (client-only, no engine/data touch); suite 324/324; node --check clean; headless boot clean (falsy gate path exercised). Truthy path verified by logic-mirror + confirmed data fields (caravan.helpsWonder=true, cost=50, ruleset.wonders keying); crafted save available for manual click-through.]

When the selected unit has helpsWonder:true AND stands in a
DOMESTIC city whose production is a wonder: the action bar shows a
Help Wonder button (tooltip: +50 shields, consumed) → emits
helpWonder. Grey/absent otherwise; keyboard-safe per the INPUT
rule; turn-log line already exists (A83). Roblox parity row rides
docs/13 Tier-2 later.

## B21 — Wake the sleeping capabilities (post-B13 re-baseline verdict, sim-runner #534; bugfixer, ONE window, after A83)

The re-baseline's headline: B13's capabilities are REAL IN CODE,
DORMANT IN PLAY. Attacker-type units = 0 at t400 across all 50
games (the branch sits behind buildings+wonders AND the monarchy
beeline never reaches attacker techs); buys = 0 in all 306 civ-
checkpoints; exploration stuck 6-7% (the radius knob is inert —
scouting is bottlenecked on WHO explores, not how far); rails
median 0%. The window (all knobs rules.json, sweepable):
(a) ATTACKER BUILD PRIORITY: the attacker branch gets a real
    build-order slot (fires when countAttackers < target, not
    behind wonders); attackerPerCity/attackerBase move to
    rules.json passthrough (STANCES become pcts of the base, the
    exploreMarchRadius pattern — the sim-runner's env hook showed
    the shape).
(b) RESEARCH GATE: the beeline gains an attacker-tech term
    (bronze/iron-working/wheel reachable early) — knob-weighted;
    this is factor-catalog group 1's first real lever and feeds
    A59 leader beelines.
(c) RUSH-BUY: the economic-coherence knob — buy defender/walls/
    (attacker) when threatened and gold > rules.buyThreshold;
    "no buys ever" dies here.
(d) SCOUT WEIGHT: a dedicated explore-unit assignment knob (share
    of military that ranges; the radius alone proved inert).
Golden window discipline (this WILL move goldens — full re-record
at close), both engines, scenario pins where commands change,
sweep-proof per knob (identity default + a sweep test). The
COORDINATION-DOCTRINE window moves BEHIND this one (measured
re-order: coordination is pointless while no attackers exist).

## B22 — Disorder tail collapse (re-baseline candidate; design-first, after B21)

disorderTurns median 181→352 is fine but the TAIL hits 2863/3820
city-turns — a minority of civs drown permanently. Diagnose (which
seeds/civs, what breaks the entertainer fallback long-term), then
a happiness-policy fix; target caps the TAIL (<500 by t400), not
the median.

**[DIAGNOSED (bugfixer @#548) + RULED (architect @f23c4f71):**
root cause PROVEN — ai.js happinessCommand's entertainer fallback
caps at ONE (target = pop-1-specialists fires once; next turn the
condition is false forever), so despotism/republic cities needing
2+ entertainers drown permanently (pop-8 witness: stuck at
unhappy=2 in disorder). FIX PRE-APPROVED: escalate one entertainer
per turn (target = current_workers - 1 while in disorder;
auto-revert unchanged = no flap; witness clears in 2 turns).
VALIDATED + CLOSED (sim-runner 2026-07-16 night): p90 @ t400 = 387 medium / 310 GE vs the <800 target — median 523→35; decisive. SEQUENCED option (ii): WAIT for the post-B21 re-baseline's
disorderTurns tail — implement only if the tail still exceeds the
<500 target (B21's rush-buy/build-reorder may have moved it);
otherwise close measured-no-change with this diagnosis as the
ledger. Golden window + full re-record when it goes.]**

## B24 — The coordination doctrine window (docs/15 §3's next window; justified twice — GAP 1 k/l≈0.28 + the §2e combat-rule inversion)

The war-lab-proven levers land on the shipped AI (docs/15 §2b–2e,
§3 — the design is DONE, this is the build):
1. PER-COMBAT-RULE DOCTRINE TABLE in rules.json: one-roll = MASS
   (no odds gate, coordinate S=3–5, volume wins); best-of-three =
   per-unit odds gate E≈2, surgical (the lab's k/l 1.1 cell).
   Table keyed by rules.combatRounds — the default rule becomes
   attacker-coherent (§2e).
2. DERIVED ARMY GROUPS (state-free, recomputed per turn): shared
   target = nearest enemy city; converge to its edge; HOLD until S
   massed adjacent; assault together (round-3's 6.8× captures).
3. PER-UNIT ODDS GATE (bo3 branch): an attacker strikes only when
   ITS odds ≥ E (round-2's correct gate).
4. Retreat-on-failed-assault + target re-selection stay OUT
   (later sweeps, per the adopted sequencing).
Golden window (moves everything), both engines, sweep tests per
constant (S, E in rules.json), lab identity default where sane.
Re-baseline + a fresh combatRounds leg at close proves §2e
inverts (bo3 should now beat or match one-roll for the attacker).
AFTER this: B23 exploration (its M9/contact fixes then measure on
a coherent war baseline).

## AI-QUALITY WAVE 2 — the N-ledger (sim-runner #601, 2026-07-16 night; slice into items AFTER B23 lands, user prioritizes)

Eight NEW measured weaknesses (canonical raw, 25 seeds t401) +
the sim-runner's challenge/legibility/fairness ranking:
- **N3 (rank 1) NAVAL+AIR ABSENT**: zero ships/aircraft EVER —
  root cause of crossWater=0; the AI is trapped on its start
  continent; two whole unit domains dead. (The docs/15 naval/air
  doctrine's build trigger.)
- **N1 (rank 2) GOVERNMENT MONOCULTURE**: 138/138 civs Monarchy
  at t401 — one revolution then never again; the economy is
  capped at the Monarchy ceiling. Foundational.
- **N2 (rank 3) TECH CEILING ~medieval**: median 27 techs; the
  late tree unreached — largely downstream of N1.
- N7 (rank 6) LEADER RUNAWAY: M14 spread to ~21× — the oldest
  finding, still no response.
- N5 (rank 7) WONDER FAILURE: median civ completes ZERO wonders.
- N4 (rank 8) DEFENDER BLOAT: 7.9 units/city median, tails to
  240+ phalanx — production sink.
- N6 (rank 9) GOLD HOARDER TAIL: rush-buy fires only under
  threat; safe civs sit on 5-10k. Peaceful spending (buildings/
  wonders/upgrades) is the missing branch.
- N8 (rank 10) LOPSIDED IMPROVEMENT: irrigation reflexive,
  mines 0-6, rails ~0.
(Ranks 4-5 = the queued B24/B23; 11-13 = known minors.)
**FIX STRATEGIES ADOPTED (user + ally table, 2026-07-16 night —
VERBATIM in specs/ai-weakness-fixes.md; supersedes the architect's
first slicing):** per-weakness designs — naval probe (ocean ratio
within 6 of cities > threshold → navyPriority; airUnlocked on
tech), periodic government re-eval every 20 turns + 40-turn
revolutionCooldown (Republic > Monarchy at cities>6 & peace) —
GROUNDING RULE (user check 2026-07-16 night): the scorer reads the
REAL engine signals, which already model Civ 1 faithfully — actual
trade lost to corruptionFor last turn (factors 4/3/3/2/0 by gov,
distance-scaled, democracy zero), maxRate headroom (60/70 vs
80/100), tradeBonus, upkeep/free-units, warUnhappiness — not
abstract heuristics; the incentive exists in-engine, the AI just
never reads it. ("Shield waste" = Civ 2 → the Civ2-rules-mode
shelf, third entry),
tech-era urgency multiplier + minimum-science floor (~40% — gold
deficit before science deficit), wonder opportunity window
(capital-completes-in-15-turns → queue above buildings +
wonderAttempted flag; economy/science wonders first — names
wiki-verified at build), garrison cap (1+ceil(threat/4), abs 3
interior/5 border; excess disband/redeploy), tiered peacetime gold
policy (2000 rush-buy-if-saves-10-turns / 4000 science-slider /
8000 force-wonder), tile yield scorer by city bottleneck + 1-mine-
per-3-irrigation quota + rails high-weight post-tech, and the
catch-up rubber-band (below 50% of leader → 1.3× settlers+science,
reduced war initiation; **AI-vs-AI ONLY, never applied against
the human** — user/ally ruling). **BUILD ORDER (the cross-fix
dependency chain, adopted): #1 naval probe → #2 gov re-eval (#3
rides it) → #8 garrison cap (fastest production-freer) → #9 gold
policy → #7 wonders → #10 yield scorer → #6 catch-up LAST.** All
constants rules.json knobs; each slice lab-measured before the
next; B23 exploration still lands FIRST (it feeds naval probe +
contact).

## B23 — Exploration is algorithm-bound (post-B21 gap 2; design-first)  [claimed: bugfixer 2026-07-16 night] [done: 2026-07-17 — FIVE-ITERATION saga (pinned scouts → ranging → CONCAVE-COAST ENTRAPMENT root cause → BFS router → self-caught oldest-scout wrong turn). Shipped rules.aiExploreMode bfs(default: coastal fast-path per user doctrine → BFS through explored land)/wallfollow(user literal hand-rule, moveUnit cmd.heading→omit-safe scoutDir)/greedy(identity); newest scout; garrison-exempt if city keeps ≥2 guards. MEASURED: bfs 39.2%/9 cities · wallfollow 20%/8 · greedy 3%/3 — M9 ceiling shattered 13×, civ THRIVES. GOLDEN RE-RECORD incl. turn-100 AND natural (winner FLIPPED p2→p1 — exploration decides games); JS==Luau every value; suite 379/379.]

M9 stuck ~7% of the world through t400; NEITHER exploreMarchRadius
NOR aiScoutSharePct moves it (sweeps #558 — the knobs are dead
ends). towardUnexplored's greedy step doesn't RANGE: units orbit
their empire's fringe. Needs a real scouting behavior — frontier-
seeking (target the nearest unexplored REGION, commit to the trip,
A65 pathfind reuse), possibly explore-until-blocked auto-mode.
Design with the war-lab loop: hypothesis → 10-seed probe → ship.
Unblocks fog-honest contact (war), M13 crossWater (with A69 ships
now real), and the M9 target.
**USER DOCTRINE (2026-07-16 night — the design's spine, like the
3:1 rule was for war): "the basic strategy is following a COAST
LINE with a scouting unit, and then have TWO, going in opposite
directions."**

**B23b — PHASED ALLOCATION (user doctrine #2, same night; the
NEXT measured slice after B23's ranging+coastline mechanics land,
A/B'd against them):** who scouts, when, with what —
1. OPENING: the FIRST military unit of the FIRST city scouts the
   local area (explore-before-garrison for the opener — it finds
   the second city site).
2. EARLY GAME: 2–5 militias from the first 2–3 cities go
   exploring — UNLESS a VISIBLE THREAT (barbarian or rival unit
   within rules.threatRadius of that city) suppresses that city's
   dispatch (local veto, not global).
3. LATER ERAS: 1–4 two-movement units (horseback-class: moves≥2)
   range far on LARGE landmasses; 2–4 BOATS on coastal maps (ties
   into Wave-2's naval probe — the same ocean-ratio signal picks
   boat-scouts).
All counts/radii/thresholds = rules.json knobs (scoutQuotaByCities
table, threat veto radius, fast-scout count, boat-scout count);
deterministic (unit-id order); lab sweeps each around the user's
suggested bands. Implementation shape: coast-following = wall-
following (keep water on a fixed hand side — deterministic, cheap,
Lua-portable, naturally circumnavigates the landmass); the civ's
first two scouts take OPPOSITE hands (clockwise/counter-clockwise
by unit-id parity); inland frontier-seeking only when the coast
is exhausted/blocked. Coast tiles are info-dense (contact, ocean,
landmass shape) — the lab probes this hypothesis first.

## A93 — M-target floors in the nightly (the pinning session's enforcement; helper, small)

tools/soak.js --stats gains a FLOORS check on the canonical
config: the six pinned targets (docs/05 §12) asserted at t401,
median over seeds; a floor breach fails the nightly lane loudly
(the M-targets are regression FLOORS, not aspirations). Floors
data-driven from a table in the script header, values mirror
docs/05 §12 — one source comment linking both.

## A97 — City-view sell button (A86's client half; helper, small — the A90 pattern)  [claimed: helper 2026-07-16] [done: 2026-07-16 — client/ui/panels.js: buildBuiltList(city,state) replaces the flat "built: …" line — each built row keeps its name and, on the owner's turn only, gains a "💰 Sell N" button (N = def.cost × rules.sellPriceRatio, data-driven); PALACE excluded (effect.isPalace, mirrors engine cannotSellPalace); DISABLED once city.soldThisTurn (view-side mirror of the engine gate so button+command never disagree — the A90 lesson). Two-step confirm: first click arms (closure-level sellConfirm survives the re-render, 4s window, label→"Confirm? 💰N"), second click emits sellBuilding{cityId,building} via ctx.apply → nextturn re-render resets. input.js: sellBuilding added to ACTION_COMMANDS + alreadySoldThisTurn/cannotSellPalace REASON_TEXT. style.css: .sell-btn (+ .armed highlighted) + .city-built .bldg spacing. Keyboard-safe (click-only, no new global key). VERIFIED: city panel renders no-crash (empty→"no buildings yet", palace→no button — screenshot); buildBuiltList logic-mirror vs REAL buildings.json/rules.json passes all gates (palace excluded, barracks sellable @40, soldThisTurn→disabled, off-turn→no buttons, armed→Confirm). GOLDEN-NEUTRAL: node --test 365/365; VISUAL-golden-neutral too (touches the CITY panel, not the setup/gallery frames — confirmed against the nightly: gallery matched, only splash moved and that was A96's link). A90-precedent verification bar (logic-mirror + no-crash render); can add a Playwright DOM case when A49 lands.]

City view buildings list: each row (except the palace) gains a
sell affordance — price = def.cost × rules.sellPriceRatio shown,
confirm on click (the A90 two-step or inline confirm), emits
sellBuilding{cityId,building}; DISABLED once the city sold this
turn (mirror the engine's soldThisTurn gate view-side so the
button and the command never disagree — the A90 shared-gate
lesson). Keyboard-safe per the INPUT rule; the 'manual'
buildingSold turn-log line already exists (A86). Roblox parity
joins the existing docs/13 Tier-2 sell row.

## A98 — LAN resume-by-code: the game code as the host's resume passphrase (user 2026-07-16 night; helper)  [claimed: helper 2026-07-16] [done: 2026-07-16 — server/index.js: new resumeByCode{code} handler — normalizes the code (uppercase, strip non-alphanumerics, so hyphen/case-insensitive), scans SAVES for the retromulticiv-server-save envelope whose code matches (newest wins), delegates to a NEW shared resumeFromFile(ws,file) helper (extracted from the A34 resume handler — one load→resetSeats→register→resumed path, two triggers); friendly rejects noSuchCode / noCode. The file NEVER comes from the client (server scans saves/), so it's traversal-safe by construction; also hardened the A34 resume-by-file with path.basename (defense-in-depth; protocol.js already shape-validates the basename). server/protocol.js: resumeByCode registered in the parse chokepoint (code string ≤40). NEW: savesDir opt on startServer (default REPO/saves) threaded through listSaves/resume/resumeByCode/savePath/default — removes the hardcoded path AND makes the flow ws-testable. client/ui/lobby.js: host-create panel gains a "Resume by game code" input + button next to the A34 pick-a-save list; reuses the SAME savesWs → {t:'resumed'} → join path; no-server readyState guard; noSuchCode/noCode friendly messages. docs/how-to-host.md: saves section documents resume-by-code AND the A50 tie-in (cleanup must retire completed/abandoned first, NEVER evict a resumable save). ws test (server.test.js): full round-trip — play→autosave→capture code, fresh server same savesDir, wrong-code→noSuchCode, empty→noCode, right code (entered lower-case + hyphen-free → normalization) → resumed reports the saved code+turn → join shows the pre-save city. GOLDEN-NEUTRAL (server/lobby/docs); suite 373/373 zero-skip; lobby.js imports clean. Roblox parity later (docs/13 Tier-3). UI verified by clean-import + the full behavioral ws round-trip (host-form live screenshot needs the setup→Host click-through; can add with A49).]

When setting up a LAN game, the HOST can enter a game code (the
docs/07 verification code every save already carries — it IS the
passphrase, no new secret invented) to resume that specific saved
game from the CLIENT:
1. Lobby create panel gains "Resume from code" (input + button,
   next to the A34 pick-a-save flow it generalizes).
2. Server: host-only message resumeByCode{code} → scan/index
   saves/ for the envelope whose gameCode matches → boot it via
   the existing A34 resume path; reject with a friendly reason if
   absent. The code is authorization-by-knowledge (docs/12 §3.1's
   design, arriving on LAN first).
3. Roblox parity later (docs/13 Tier-3 lobby row).
Server + lobby UI + ws test (resume-by-code round-trip + wrong-
code reject); golden-neutral. NOTE the A50 tie-in: rotation (item
3 there) must NEVER rotate out a save the host may still resume —
completed/abandoned first, and the how-to-host saves section
documents the interplay.

## A94 — How-to-host guide + Docker image + README links (user package 2026-07-16 evening; helper)  [claimed: helper 2026-07-16] [done: 2026-07-16 — docs/how-to-host.md (source of truth: quick-start run.sh/run.ps1, Ubuntu+systemd, Docker, promoted Hetzner nginx+certbot walkthrough SANITIZED from ops/hosting-recipe.md — DB/secrets stripped since we have neither, the /ws WebSocket upgrade block made explicit as the one RetroMultiCiv delta, Raspberry Pi deltas-only, full flag reference); client/host-guide.html (hand-authored served twin under the hardened /client/ whitelist, self-contained, renders clean); Dockerfile (node:22-slim, npm ci --omit=dev = ws only, ENTRYPOINT node server/index.js so `docker run … --flags` pass through, VOLUME /app/saves) + .dockerignore + compose.yaml; .github/workflows/docker-image.yml (build job validates always; publish job GATED on repo var PUBLISH_GHCR=='true' — owner opt-in for the public GHCR artifact per §2); README.md "Host your own server" section near top + docs-table row. All flags/paths verified against server/index.js (port 8123, /ws, hardened whitelist client/engine/shared/data). GOLDEN-NEUTRAL (docs/infra/static only); suite 359/359 zero-skip; YAML validated; host-guide screenshotted. OPTIONAL FOLLOW-UP: a visible in-client link to /client/host-guide.html from setup/lobby (left out — touches setup.js, a UI-placement call for you/user). A96 (self-check + maintenance page) is the package's second half, still queued.]

1. **docs/how-to-host.md** (source of truth) + **client/host-guide
   .html** (hand-authored twin, served by the default whitelist —
   linkable from a running server). Sections: quick start (run.sh /
   run.ps1), Ubuntu + systemd unit, DOCKER, HETZNER (a specific
   promoted walkthrough — public sanitized version of the user's
   recipe: CX-class box, ufw, node LTS, systemd, DNS), RASPBERRY
   PI/Raspbian (differences only: ARM node via nodesource, port-80
   via cap_net_bind_service, memory notes on 1-2GB models —
   otherwise identical to Ubuntu).
2. **Dockerfile** (node LTS slim, no build step — the repo IS the
   app) + compose example + a GitHub Actions image build; PUBLISH
   to GHCR flagged for user approval (free, but it is a public
   artifact channel).
3. **README.md**: a "Host your own server" section near the top
   linking the md + the Docker one-liner (user: "readily available
   when visiting the github page").

## A95 — Information-security assessment of the hosted surface (architect drafts docs/16; helper reviews)

Enumerate and assess EVERYTHING a hosting operator exposes:
HTTP static whitelist (path-traversal posture), /ws protocol
(frame parsing, payload caps, seat auth, tamper rejection), join/
create/chat (rate-limit status vs A50's queue), saves on disk
(tokens off the wire since A61 — verify at rest), --debug OFF
posture, DoS surface, dependency chain (ws + dev-only deps), TLS
story (recommend reverse proxy TLS termination — caddy/nginx
snippets in A94's guide), Pi/Hetzner firewall guidance. Deliverable:
docs/16-security-assessment.md + a gap list feeding A50's queue.
[done: 2026-07-16 night — architect draft committed: surface
enumeration (static whitelist w/ double traversal guard, /ws frame
cap + validation chokepoint + seat-token model, saves-at-rest,
supply chain, availability), ranked 6-gap list (A50's rate
limits/TTLs = the main open public-hosting risk; new: a hostile-
stream scale-test job), operator quick-card, re-assess triggers
(A50, master index, new dep, 1.0). HELPER REVIEW PENDING — second
pair of eyes per the item.]

## A96 — Nightly self-check + maintenance fallback (user package; helper, server-adjacent)  [claimed: helper 2026-07-16] [done: 2026-07-16 — tools/serve-maintenance.js (dependency-free watchdog, Node built-ins only: spawns node server/index.js, and after MULTICIV_MAX_FAILURES consecutive non-zero exits binds the SAME port and serves a 503 maintenance page with MAINTENANCE_CONTACT; retries every MULTICIV_RETRY_MS and hands the port back once a retry stays up MULTICIV_STABILIZE_MS — BOTH paths tested live: failure→503+contact and recovery→page-torn-down/real-server-retakes-port; MULTICIV_SERVER_ENTRY override added for alt entrypoints+testability); tools/host-selfcheck.sh (npm audit; on findings applies `npm audit fix` in a THROWAWAY rsync staging copy, runs the FULL suite there, and only on green swaps the verified package.json+lock into live + npm ci + MULTICIV_RESTART — NEVER touches live before the gate; stops for manual review if only a major/--force upgrade would fix; clean-audit path verified exit 0); docs/how-to-host.md "Staying up" ops section (systemd ExecStart via the wrapper + the nightly cron line + all env). PLUS the A94 optional follow-up folded in per architect #575: "Hosting guide ↗" link on the SETUP screen (setup.js, renders clean — screenshot) and the LOBBY host-create panel (lobby.js, beside "← back"), both → /client/host-guide.html. node --test suite 365/365 zero-skip; both tools syntax-clean. **VISUAL-GOLDEN FLAG (breaking for the nightly A48 lane): the setup.js link CHANGES the splash frame (?splashstill renders the setup panel) → splash.png golden will go red next nightly; re-record splash from the CI actual (eyeball: only diff = the new link line). gallery.png UNAFFECTED (renders assets, not setup DOM). Resend-mail integration deliberately NOT built (needs an outbound-dep decision).]

1. HOST-SIDE nightly cron (documented in A94, shipped as
   tools/host-selfcheck.sh): npm audit → IF findings, apply `npm
   audit fix` in a STAGING copy, run the full suite there, and
   only swap+restart on green (architect note: NEVER silent
   auto-fix on the live tree — determinism + the dependency
   whitelist demand the test gate; the user's intent is honored,
   with brakes).
2. MAINTENANCE PAGE: a watchdog wrapper (tools/serve-maintenance
   .js — dependency-free, cannot fail) — if the real server exits
   non-zero N times in a row, serve a static "down for
   maintenance" page on the port; MAINTENANCE_CONTACT env
   (email / discord) rendered when configured.
3. LATER (noted, not built): resend-mail integration so the
   server emails the maintainer — new dependency, needs the
   user's explicit approval when its time comes.

## A84 — M9 fix + canonical config (user confirmed 2026-07-16)

Small A64 follow-up: M9's denominator becomes non-polar LAND+COAST
(spec-true) + the own-continent-explored-by-t150 column; docs/05
§12 records the CANONICAL config = 7 civs, medium, no-chaos, labels
t101/201/301/401 as measured. Re-baseline once era-scaling lands.

## A85 — Seam ghost columns (user pick: LATER, behind the AI program)

The seamless east-west illusion: duplicate k columns each side of
the seam, modulo mapping in castAt picks, mirrored rendering for
seam-adjacent entities. Polish; keyboard/GoTo already cross.

## A86 — Sell building in city view (user, Playtest-IX 2026-07-16)

Civ 1 lets the player sell a city improvement for gold; ours has no
sell path at all. Engine + UI + the A63 hookup:
1. Engine command `sellBuilding {cityId, building}` — removes the
   building, credits gold, and enforces the Civ 1 limit of ONE sale
   per city per turn (a per-city `soldThisTurn` flag cleared at turn
   end — crafted-state note: omit-safe lazy default would move
   hashes, so include it in the state shape from the start). WIKI-
   VERIFY the price rule at build time (expected: gold = the
   building's shield cost; confirm vs the dump, numbers to
   data/rules.json, never hardcoded).
2. City view UI: a sell affordance on the buildings list (price
   shown, confirm on click, turn-log line, disabled once the city
   has sold this turn). Keyboard-safe per the INPUT/TEXTAREA rule.
3. **Shared path with A63/B13**: the barracks tech-obsolescence
   auto-sell (user ruling: SOLD, gold credited) calls the SAME
   engine removal+credit helper — one implementation, two triggers.
4. Both engines (twin ModuleScript change), scenario pin for the
   command, golden window discipline (state-shape addition WILL
   move goldens — coordinate with the era-scaling window; if B13
   is open, ride the same window rather than opening a second).
Roblox parity: a docs/13 Tier-2 row (city panel action) once the
browser shape settles.

## A87 — Replay theater round 2 (ally round-6 recommendations, 2026-07-16; helper, queue after A54)  [claimed: helper 2026-07-16] [done: 2026-07-16 — all three, client/ui/replay.js only, ZERO engine change. (c) VERDICT STRINGS: getRecording passes format/version through; recordingSupported() → a present-but-wrong local envelope shows "⚠ Replay format unsupported" (server recordings carry no envelope = trusted current); divergence tracked as entries apply (round entries always carry a hash, cmd under ?debug=1) → verdict is "✅ Verified" / "❌ Mismatch at command N" (the index the verifier already knows) / "⚠ replay diverged" fallback; verifyReplay now also returns divergedAt. (b) MAP PERSPECTIVE TOGGLE: a View dropdown (🌍 Omniscient + one 👁 <Civ> per player) sets perspective; the 3 render calls go through viewFor(s)=filterView(s,perspective) — 'spectator'=omniscient, a playerId = that civ's historically-accurate fog at the scrubbed turn; replaced the old omniscient() helper. (a) TURN SCRUBBER: a Jump range 0..totalRounds; scrubTo(N) re-derives from initialState to round N (sandbox rebuild, no per-step render), the scrubber tracks live during playback and pauses on drag-release. VERIFIED: theater screenshotted with all controls + "✅ Verified" on a real e2e=9 recording; replay.js imports clean; suite 373/373. GOLDEN-NEUTRAL and VISUAL-golden-neutral (theater UI, not the setup/gallery frames). No CSS needed (controls inherit #replay-bar). Roblox theater inherits the shapes later (docs/13 Tier-4). Verdict-string + per-civ-fog DOM assertions can join the A49 playwright lane.]

A47's viewer gains: (a) TURN SCRUBBER (jump to round N — sandbox
re-applies from the start or nearest feed anchor; tempo presets
already exist); (b) MAP PERSPECTIVE TOGGLE — omniscient (today's
mode) / per-civ fog (filterView with that civ's eyes) / spectator;
(c) HUMAN-READABLE VERDICT STRINGS — "✅ Verified" (exists) plus
"❌ Mismatch at command N" (surface the divergence index the
verifier already knows) and "Replay format unsupported" (version
guard) so non-technical players understand verification. Golden-
safe (client consumer). Roblox theater inherits the same shapes
later (docs/13 Tier-4).

## A88 — Asset recipes: the factory becomes data (user ruling 2026-07-16: Option C now, mesh pipeline B only where fidelity demands later; ally proposal specs/three-factory-roblox-assets.md, adapted)  [claimed: coder-helper 2026-07-16] [done: 2026-07-16 — client/renderer/three/recipes.js (NEW, pure data, no THREE/DOM): every unit silhouette body + city house/roof + tile-prop SHAPE as a {shape,size,seg,pos,scale,rot,colorRole} table; box/cyl/sphere primitive, cone/dodeca/torus = R8 approximation points (noted in the artifact header per @aa8c1ef7). assets.js + props.js refactored: one generic composeRecipe replaces the per-shape builders; base token / pennant / capital flag / wall ring / sail-plane stay PROCEDURAL (plane/torus/circle markers, ally Part 7). colorRole 'primary'/'secondary' injected from the civ visual — data never carries faction hex. GALLERY BYTE-IDENTICAL at rest pose (cmp clean across units→+cities→+props→final; WebGL1 renders). tools/export-asset-recipes.js → data/assets/asset-recipes.json (RENDER artifact in a subdir, NOT a top-level engine ruleset — ruling @aa8c1ef7 keeps the twins-gate '8 data/*.json = engine rulesets' contract crisp). Drift gate test/asset-recipes.test.js 4/4 (every units.json id→recipe, primitives well-formed, PROP_SHAPES covers every prop kind, committed JSON in sync). Twins gate green (8 files). MISS ledgered: added a 9th top-level data file, tripped the twins-gate directory COUNT (first-occurrence of the enumeration-coupling class the three-strikes rule watches); did NOT edit through the bugfixer's lock, escalated, architect relocated. Unblocks R8. Files: client/renderer/three/{recipes(new),assets,props}.js, tools/export-asset-recipes.js(new), data/assets/asset-recipes.json(new), test/asset-recipes.test.js(new).]

The ally proposed a glTF→Blender→FBX→Studio mesh pipeline. RULED
DOWN to the recipe approach: our silhouettes are COMPOSITIONS of
~13 solid-colored primitives (box/cylinder/cone/sphere), so the
cross-platform artifact is the RECIPE, not the mesh. NOTE: the
ally's inventory names (warrior/archer/tank, client/AssetFactory
.js, src/roblox/) do NOT match this repo — derive the real
manifest from client/renderer/three/{assets,props}.js + the
gallery.
1. REFACTOR assets.js + props.js to build every unit silhouette,
   city tier, and prop from a RECIPES data table (per asset: list
   of {shape: box|cyl|cone|sphere, size, offset, rot, colorRole});
   the three.js builders become one generic composer. The gallery
   is the acceptance instrument: byte-comparable screenshots
   BEFORE/AFTER must match (rest pose — that is what it is for).
2. tools/export-asset-recipes.js: imports the recipes module in
   Node (pure data — NO DOM, NO headless-three, none of the
   ally's canvas/gl deps needed) and writes
   data/assets/asset-recipes.json (committed). PATH RULED
   2026-07-16 (#504): a SUBDIR, deliberately outside the twins
   gate's top-level enumeration — "top-level data/*.json = engine
   rulesets, cross-language checksummed, count-gated" stays a
   crisp contract; render/other artifacts live in data/ subdirs.
   Standing rule for future data files.
3. Drift gate: a test asserting recipe keys cover every
   data/units.json id, every city tier, every props.js prop (the
   mock-state terrain-coverage pattern).
4. json2lua bakes it → the roblox lane consumes (R8). Markers
   (discs/flags/stars/rings/selection/GoTo arrows) stay PROCEDURAL
   per the ally's Part 7 — adopted verbatim; recipes carry
   colorRole slots, never faction colors.
Golden-safe (render-only). Helper item; queue at will — unblocks
R8. The mesh pipeline (trimmed Option B: shimmed/hand glTF writer,
try Studio's direct glTF import, Blender only if FBX forced, user
OK'd occasional manual Studio imports) stays SHELVED until Studio
screenshots show a silhouette the Part mapping can't carry.

### R12 — Playtest-C batch (user's runC feedback 2026-07-17; roblox-helper; BEFORE R9-R11)

User numbering kept:
- (2) GOVERNMENT BUTTON in the top-center cluster (next to
  Research): tax/lux/sci rate steppers move there from the
  research picker; the panel later hosts government switching.
- (3) UNIT BILLBOARD FONT: 2× size, ~30% wider font, BOLD.
- (4) CITY BILLBOARD always-on: name + pop + current production +
  turns left (fog rules: rivals show what the view knows).
- (5) RESEARCH STATUS always visible beside the Research button:
  current tech + turns remaining.
- (6) RIDE ↔ DISMOUNT: the action-bar label toggles with mount
  state; same key P toggles.
- (7) BUG: Next while DISMOUNTED must move only selection+camera,
  never teleport the avatar (mounted behavior stays).
- (9) DEBUG BUTTON (left, dev/Studio-only, stripped for publish):
  hosts the gallery grid (K stays as its hotkey), future A92
  debug-command menu rides here. INVESTIGATE: the user saw NO
  PYRAMID in the gallery grid — the city house+roof (4-CornerWedge
  path) is either absent from the grid or renders invisible (the
  flagged apex caveat may hide, not flip). Find + fix + one grid
  screenshot back to the user.
- (1) raises R7c-3 urgency: worked-tile adjustment is ABSENT from
  the city view entirely — the roblox-helper drafts the 3D
  worked-tile proposal (his shape, screenshots) for the user's
  look rather than waiting further.
CONE PICK = FAN (user, final): wedge-fan becomes the N-cone mode;
the stack variant stays code-side for the gallery only.

### B25 — City defense verification (Playtest-C #8; bugfixer, verify-first vs the dump)

User asks: (a) fortified units give their bonus? (engine: ×1.5,
combat.js — VERIFY a scenario exercises it, pin if not); (b) do
units defending a CITY get a bonus even without walls in Civ 1
(auto-fortify-in-city? inherent city bonus?) — WIKI-VERIFY; if
Civ 1 grants something we lack, fixture-first fix both engines;
if not, document the no-bonus as authentic in docs/01.

### R9 — The lobby place: observation deck + pads (Tier-3 slice 1; user design 2026-07-16 — docs/13 Tier-3 block is the spec)

Observation-deck spawn + first-visit greeting + the pad flow
(start-a-new-game/60s host countdown, join-game, 30s start
countdown, take-over-AI-civ RANDOM assignment), admins-only kick,
NO CHAT (age restriction — assert Roblox chat disabled). Server
seat model reuses R6; regency pairs with take-over.

### R10 — Roblox save/resume: DataStore keyed by game code (Tier-3 slice 2; user design 2026-07-16)

Private servers: full load/save. Public: ephemeral + all-humans-
left + 120s → end; host "Get resume code" button (game-options
menu) persists the save envelope in a DataStore keyed by the
docs/07 game code; a new server resumes by code (browser A98's
twin). Retention window configurable.

### R11 — Click-only ride-mode movement pad (R7c-13/14; user design 2026-07-16)

Left-side arrow-pad icon toggle, AUTO-DETECT non-keyboard clients
(touch/gamepad default the pads ON); ride mode renders 8 click-
targets (4 cardinal + 4 diagonal) surrounding the mounted player
in-world — click = move there (same command path as WASD).

### R8 — Luau AssetFactory from recipes (roblox-helper; after A88's recipes.json lands) [claimed: roblox-helper 2026-07-16 @f35fc677]

AssetRecipes bake (json2lua, RulesetHashes-gated like rulesets) +
a recipe composer: box→Block, cylinder→Cylinder, sphere→Ball,
4-sided cone→4 wedges (pyramid roofs), N-sided cone→your best
approximation (tapered SpecialMesh torso / wedge fan — your call,
flag it). Faction identity stays procedural on top (disc/flag/
markers — current Parts code survives). Replaces the placeholder
blocks unit-by-unit; gallery-grid screenshot in Studio vs the
browser gallery is the acceptance (user judges cone fidelity —
his ruling explicitly holds mesh-upgrade (B) for silhouettes that
disappoint). Ally's check-asset-sync idea lands as a check.sh
gate comparing baked recipe keys vs the manifest.

## ALLY ROUND-6 DISPOSITIONS (2026-07-16 — verbatim in specs/plan-feedback-6.md)

- Phase 5 ACCEPTED + phase-6 priority order adopted → docs/03.
- Diplomacy persistent-summary fields → docs/14 (D-slices build it).
- War-lab matrix additions + goal framing → docs/15 §2.7.
- Possession authority boundary + regent stance visibility →
  docs/13 standing rules (possession already compliant; regent
  HUD/log lines land with the browser A40 regency UI and Roblox R6
  regency twin).
- GoTo "route is a plan, not a guarantee": A65 already complies
  (fog-honest, replans per step, greedy fallback) — noted, no work.
- Sound: the no-sim-influence rule is the house pattern (render-
  time only); SEPARATE VOLUME CONTROLS (master / music / effects /
  turn-notification / mute-when-unfocused) join A68's options
  bundle when it lands.
- Historian determinism: A75 already rules-data-keyed + stateless-
  event + both engines; standings are WORLD-PUBLIC by user design
  ruling (not a fog leak). Replay placement verified by feed ride.
- Save size (checkpointed replay format + format version +
  data fingerprint): v2 shelf — revisit if recordings grow.
- --debug is for trusted local dev, never normal LAN hosting:
  restated (docs/06 posture, A61 boot log).

## A50 — Public-host hardening (docs/12 §3 — UN-GATED 2026-07-14; NOTE 2026-07-15: A61 sets the hardened-DEFAULT posture + static whitelist FIRST; A50's items assume it)

Queue normally at the helper tail (after A49). Every piece hardens
the LAN server too — nothing here waits on public plans. When A50
lands, docs/12 phase A (DNS alias → the user's PC, supervised
weekends) is available the moment the user flips the alias.
1. Join-by-id closed for non-public games (code required; resume by
   game code as the authorization — docs/12 §3.1).
2. Per-IP rate limits on join/create/listGames/chat + global caps
   (games, connections, creates/IP/hour).
3. Lifecycle expiry: unstarted-lobby TTL, gameOver unlist+retention,
   abandoned-game archive, saves/ size budget. USER SPEC
   (2026-07-16 night): ROTATION like logs — config-driven caps,
   defaults maxSaves=100 AND maxSavesMb=<NN, host-config>; oldest
   completed/abandoned games rotate out first, ACTIVE games never;
   log rotation likewise (maxLogDays=10 / maxLogMb=10). Flags +
   how-to-host.md documentation ride the same slice.
4. General messages/sec/conn limiter (chat's pattern, widened).
5. `/healthz` endpoint + one-line structured logs (join/create/
   expire).
6. Invite-code allowlist mode as one server flag (the no-accounts
   escape hatch).
Tests mirror A41's discipline: every limit has a red case, listings
carry no secrets, expiry is clock-injectable. Golden-safe.

## A51 — Master index: the QuakeWorld-style server lookup (docs/12 §6 — GATED on the master HOST existing, the real work per user 2026-07-14; code can queue after A50 whenever the user says the box is coming)

Privately hosted servers announce to a global list; players connect
DIRECTLY to the chosen host (the master is a bulletin board, never a
broker). Design final in docs/12 §6; queue with/after A50.
1. `tools/master.js` (plain node http, zero deps): in-memory
   registry, POST /announce (rate-limited, size-capped), TTL sweep
   (~3 min), GET /servers. Restart-safe by re-announce, no database.
2. Server `--announce <master-url>` + `--public-name`: ~60s heartbeat
   carrying name, host:port, protocol version, the eight rules-data
   checksums, open public-game count (A41's summary, already
   computed).
3. Reachability validation before listing: master probes /healthz
   (A50); unreachable = held off-list, reason relayed to the
   announcing server's console ("check port forwarding").
4. Client "global" tab in find-a-game when a master URL is
   configured: server rows → pick → the existing A41 browse flow
   against that host's origin. Version mismatch = greyed with the
   checksum hint, never hidden.
5. Trust line in the UI: a listed server is someone's private
   machine (name + chat go there); join codes/kick/block work as on
   LAN because it IS a LAN server, someone else's.
Tests: announce/expire/validate cycles clock-injectable; the list
carries no secrets (same absence discipline); a mock unreachable
host stays unlisted. Golden-safe.

## PARKED CONTEXT — Global internet hosting (superseded: design now lives in docs/12-global-host.md; this block kept for the recipe deltas)

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
  ADDED by A41 review (helper's catch, 2026-07-14): the pre-existing
  `{t:'join'}` resolveId accepts RAW gameIds, so private lobbies are
  join-by-guessable-id today (fine on a trusted LAN; A34's resume
  depends on it). The hardening item must decide: require the code
  for join-by-id on non-public games, or make gameIds unguessable —
  BEFORE any internet exposure.

Ordering: after the two-machine LAN acceptance; v1 listing pairs
naturally with A27's lobby work.

## A38 — Big-lobby scaling: probe + raise the cap to 14 (USER GO 2026-07-14)  [claimed: coder-helper 2026-07-14] [done: 2026-07-14 — MEASURED (docs/08 §8 tables): engine 200-round halves — large/12 ≈ 830ms/ROUND late (fine w/ A30 progress), xlarge/12-16 ≈ 1.7-1.9s; lan8 probe (8 live ws clients) — start fan-out 241/299ms, per-command 7-rival push 51/72ms, full 8-human round 326/486ms; fit sweep 40 seeds/cell w/ achieved-min-start-distance metric under FINAL VI.5 rule — xsmall 7 (93%, status quo), small 12 (98%), medium+ 14 (100%). SHIPPED: rules.json maxCivsBySize enforced at 5 gates (setup dropdown+hint, lobby create mapTooSmall+client text, setSlots clamp, ?civs= clamp, --civs validation); SIM_ROSTER 7→14 with p1-p7 FROZEN + first-4 assertion in simulation.test.js (goldens green; p11 color dodges frozen p4's). Probes re-runnable: tools/probe-scale.js (--help added per review) + debugging/probe-lan8.js. Tests: lobby clamp evolved to 14-ceiling + table-gate case + ws 12-civ case (reject 13-on-small, resize clamp, 12 distinct civs at start). Shots read: 12-slot lobby, 12-civ world. Suite 207/207. 16 unshipped by design.]

Two halves, one item — measure first, then ship what the numbers
support.

**Probe (measurements land in a new docs/08 §8 "Scaling" section):**
- Headless: soak ms/turn at 4 / 8 / 12 / 16 civs (16 via a TEST-ONLY
  duplicated roster — measurement needs bodies, not distinct flags) on
  large/xlarge maps, seeded. Measure END-OF-ROUND time separately —
  the N-AI-turns-between-human-turns number (A30's chunking makes it
  perceivable; this measures it). Baseline today: ~60–235 ms/turn at
  4 civs medium/GE.
- Server: extend the lan4 pattern to 8 live ws clients — join/start/
  full-round latency and per-command broadcast cost (filterView runs
  once per CONNECTED seat per push, scaling players × map tiles —
  measure, don't guess).
- Mapgen: at which sizes do 8/12/14/16 legal starts (≥3 from poles +
  the spacing rule) reliably fit? Seed-sweep; produce a civs →
  minimum-map-size table.

**Ship (gated on the numbers):**
- Raise the played cap 7 → 14 (data/civs.json already has 14
  identities): client/main.js:141 clamp, setup civs dropdown, lobby
  seat list + setSlots clamp, server --civs validation. SIM_ROSTER may
  extend for the probe BUT its first 4 entries stay byte-identical —
  the sim goldens slice those; ADD AN ASSERTION.
- Enforce the civs→min-size table at setup + lobby create (friendly
  rejection: "12 civilizations need at least a Large map").
- NOTE the spacing rule changes under my wave-VI engine batch (VI.5,
  3-ortho/2-diag) — run the mapgen fit sweep AFTER my batch lands, or
  re-run it then; coordinate by mail on timing.

16 as a SHIPPED option stays out: it needs the Civ 2/3/4 roster
extension (user decision 2026-07-13: adapt their perks to our
specialty schema, facts via wiki2data/mapdata — never prose) AND ally
visual identities — that is a separate future item with his loop.

Done-mail: the measured table (ms/turn, round time, fan-out, fit),
recommended caps per size, screenshots of a started 12-civ lobby game.
Golden-safe with the SIM_ROSTER first-4 assertion.

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

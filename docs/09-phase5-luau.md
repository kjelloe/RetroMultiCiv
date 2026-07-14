# Phase 5 — Roblox Luau port: mapping & verification design

Status: **ENGINE COLUMN COMPLETE (2026-07-14)** — designed 2026-07-12,
unblocked and executed the same week: §4 steps 1–6 all gated green
(P5-1..P5-8). Every engine module, mapgen, the AI, the sim driver, and
the replayer run in Luau with four anchors, ten scenario pins, five sim
goldens, and five replay verdicts agreeing across Node, lune, and
Studio's VM. The port was mechanical BY CONSTRUCTION — the engine was
written in a Lua-shaped JS subset from day one — and the trap list
below (§3, §7) is the record of the exceptions that needed judgment.
Remaining: the Roblox-side GameServer/client (R-queue, docs/10) and
the CI lune step (human-workitems).

## 1. Verification assets already in hand

- statehash anchor `{b:2,a:[1,"x",true]}` → `0x30db1e29`; game-code
  anchors codeHi `0xa687b72d`, code `AD1X-Q5MR-DP7H9` (doubly derived).
- xorshift32 golden sequence (seed 123456789) in rng tests.
- 10 hash-locked JSON scenarios (engine-agnostic runner by design).
- Sim checkpoint goldens (t100..t400) + the sim driver's invariant net.
- Real recorded games that must replay hash-exact (g530734: 421 commands,
  111 rounds, includes a wonder; diag format incl. `airound` + chaos).
- Cross-MACHINE determinism already proven (GitHub runner ≡ WSL,
  bit-exact goldens) — phase 5 adds the cross-LANGUAGE axis to a story
  that is already half-validated.

## 2. What ports, what doesn't

PORTS 1:1 (one ModuleScript per file, ≤300 lines each by policy):
`engine/*` (16 modules), `shared/statehash.js`, `shared/gamecode.js`,
plus twins of `test/scenario-runner.js` and `test/sim-driver.js`
(runSim + checkInvariants; artifacts optional). Ruleset JSON crosses via
a new `tools/json2lua.js` (data/*.json → ModuleScript tables; also used
for scenario files).

DOES NOT PORT: client/ (Roblox gets a parallel renderer on the
AssetFactory seam — primitives map to Parts), server/index+protocol (the
Roblox server Script replaces ws with RemoteEvents carrying the SAME
docs/06 message shapes; seat tokens are replaced by Roblox UserIds —
the one auth simplification the platform gives us for free).

## 3. The trap list (audit these; everything else is transliteration)

> **P5-1 additions (2026-07-14, found porting rng/statehash/gamecode —
> all three anchors passed on the first lune run):**
> - **Empty `[]` vs empty `{}` is THE representation question** JS
>   never had: a bare Luau table can't say which it is. Shipped
>   convention (`luau/statehash.luau`): a table is an array iff
>   `t[1] ~= nil`; EMPTY arrays carry the `ARRAY_MT` metatable marker
>   (`setmetatable({}, statehash.ARRAY_MT)`). Game states are full of
>   empty arrays (`buildings`, `cityOrder`, `techs`) — every engine
>   twin and any json→lua loader MUST emit the marker, or hashes break
>   silently. The anchors harness proves `{"a":[],"b":{}}`.
> - **Canonical number rendering** uses `string.format("%d")` after
>   the integer check — never `tostring` (immune to integral-double
>   formatting drift).
> - **require style is a lune-vs-Studio seam**: `require("./x")` under
>   lune vs `script.Parent.x` in Studio — R1 hits this first; string
>   requires or a Rojo/darklua transform are the candidate answers
>   (roblox-helper proposes, architect rules).

> **P5-3 additions (2026-07-14, found porting the dispatcher +
> movement/visibility batch — the first genuine cross-language
> divergence was caught by the report contract in minutes):**
> - **JSON field names that are Lua keywords need bracket access.**
>   `data/rules.json` yearSteps uses `"until"` — `b["until"]` works,
>   `b.until` is a SYNTAX error. Audit any new data field name against
>   the Lua keyword list.
> - **Lazy-default writes make JS process hooks NON-NEUTRAL.** JS
>   `processResearch` writes missing `bulbs`/`taxRate`/`sciRate`
>   defaults, so a naive no-op twin hook diverges the hash (001 hit
>   this at byte 419). Batch discipline: unported hooks are GUARDED
>   no-ops that error loudly when a state could make their JS twin do
>   observable work; porting a module = deleting its guard. Guard
>   errors surface as in-contract divergence reports, never harness
>   crashes.

> **P5-4 additions (2026-07-14, combat + improvements batch):**
> - **Scenario dotted paths carry 0-BASED array indices**
>   (`"map.tiles.1"` = the SECOND tile — they were authored against
>   JS). The Luau runner's getPath +1-translates numeric segments;
>   safe because state object keys are never bare digits.
> - **PARTIAL gate column**: a scenario whose steps a batch fully
>   validates but whose WRAP needs an unported module (004/005 combat
>   steps green, wraps need cities) is pinned to fail in-contract at
>   an EXACT command index — any earlier failure = regression in the
>   ported module. It flips to PORTED when the blocking module lands.
> - **Roblox CLIENT input trap** (R3, applies to roblox/ work, not
>   the engine): default control scripts pre-sink mouse events —
>   handlers never fire; POLL `IsMouseButtonPressed` + per-frame
>   screen delta instead. Recorded here because docs/09 is the trap
>   ledger; the full client note lives in roblox/SPEC.md.

> **P5-5 addition (2026-07-14, cities/tech/happiness batch — the
> subtle one):**
> - **JS `Array.sort` is STABLE; Luau `table.sort` is NOT.** A greedy
>   sort with score ties (candidateTiles' worked-tile picks) orders
>   ties arbitrarily in Luau and silently shuffles downstream state.
>   Rule: every ported sort whose comparator can tie needs an
>   EXPLICIT tie-break (candidateTiles ties on the original fat-cross
>   position). Review habit: grep the JS module for `.sort(` before
>   porting and prove each comparator total or tie-broken.

> **P5-7 addition (2026-07-14, mapgen/barbarians/score — the purest
> statement of call-order discipline):**
> - **Scan order is itself RNG contract when rolls are conditional.**
>   mapgen's specials pass consumes a roll ONLY on non-grassland
>   tiles, so the ORDER tiles are visited determines which tile gets
>   which roll — reordering a loop that conditionally consumes rng is
>   a silent full-stream divergence even when every individual roll
>   is transcribed perfectly. Same family: the start-placement
>   relaxation loop's retry COUNT is part of the stream (exit
>   conditions must transcribe exactly). Port rule: loops that touch
>   rng keep their iteration order, bounds, and early-exit shape
>   verbatim.

1. **Stored indices are 0-based VALUES.** Tile index math
   (`idx = y*width + x`) produces numbers stored IN STATE
   (`city.workers`, explored arrays are positional). Luau tables iterate
   1..#t, but the stored VALUES must remain exactly as JS computed them
   or every hash breaks. Rule: translate array *iteration* to 1-based,
   never touch index *arithmetic or stored values*.
2. **`%` semantics differ.** JS `%` is remainder (sign of dividend);
   Lua `%` is floored modulo (sign of divisor). Our wrap code always
   uses the double-wrap `((x % w) + w) % w`, which is equal under both —
   but audit every `%` with a possibly-negative left side during port
   review; a bare `a % b` with negative `a` is a silent divergence.
3. **Truthiness.** JS treats `0`/`''` as falsy; Lua only `nil`/`false`.
   The engine style is mostly explicit (`=== undefined`, `=== true`),
   which transliterates safely to `== nil`/`== true` — but any bare
   `if (x)` where x can be 0 or '' must become an explicit comparison.
4. `delete obj.k` → `t.k = nil` (same hash semantics: absent key).
   `Object.keys` order: only used order-independently or behind sortIds —
   preserve that rule; Lua `pairs` order is undefined, same discipline.
5. statehash specifics are pre-annotated in code: `>>> 0` → `bit32.bxor`
   is already unsigned; `mul32` is the same integer formula; JS
   `sort()` on keys ≡ `table.sort` default for strings; `charCodeAt` →
   `string.byte`. gamecode's two-limb base32 avoids 64-bit doubles by
   construction. deepClone's flat-array fast path → `table.clone`.
6. Engine throws only in statehash (state-contract enforcement) →
   `error()` in the twin; everywhere else rejections are return values,
   as required.

## 4. Port order and gates (leaf-first; each gate is machine-checkable)

1. `rng` → GATE: golden sequence.
2. `statehash` → GATE: `0x30db1e29`. 3. `gamecode` → GATE: the A11 anchors.
4. `json2lua` + scenario-runner twin (harness before more engine) —
   AMENDED 2026-07-14 (ally review caught a sequencing hole we walked
   past): this step also ports a MINIMAL `index` — the applyCommand
   DISPATCHER shell with rejections for unknown commands — because the
   scenario runner cannot execute script steps without it; rule
   modules then land as dispatcher entries one batch at a time.
   ADDITIONAL GATE (ally): static-data checksums — every
   `data/*.json` canonical-hashed identically in both languages
   (json2lua exercised on real ruleset shapes, not just states).
5. `visibility`, `government`, `combat` (needs rng), `improvements`,
   `happiness`, `cities`, `tech`, `movement`, `barbarians`, `score` —
   GATE per batch: scenarios 001–010 go green progressively.
6. `mapgen` EARLY within this step (ally: same seed → same world,
   gated by the generated-world canonical hash BEFORE any turn — our
   scenario 002 golden is exactly that gate), then `ai`, then full
   `index` → the sim-driver twin reproduces ALL FOUR checkpoint
   goldens, then replay conformance on real recordings — the same
   `tools/replay.js` verdict, now cross-language. AI PORTS LAST and
   is not needed for early validation: the Luau engine replays
   browser-RECORDED commands (human and AI alike), so both AIs never
   need to "think alike" — they need to REPLAY alike (ally's framing;
   it was always the design, now it's stated).

### The first-divergence report (ally contract, 2026-07-14 — PERMANENT: a first-class project feature per ally round-5, resident in CI for the life of the twin engines, never a temporary porting script)

Cross-language failures must be repair loops, not archaeology. On any
hash mismatch, the harness emits: replay version + RULES-DATA version
+ fixture name;
command number / turn / acting seat; the command payload; the JS
canonical hash AND the Luau canonical hash; the FIRST canonical
path/value that differs (walk the two canonical strings to the first
byte, then name the state path it sits in); RNG state before and
after the command; and, where relevant, the filtered player-view hash
too. The P5-2 scenario-runner twin shapes its failure output for this
contract from day one.

## 5. Harness & CI (one open decision — human input)

Headless Luau in CI keeps the port honest per-commit, exactly like the
nightly does for JS. DECIDED (user, 2026-07-12): **lune** — whitelisted as a dev-only
toolchain dependency; the Luau twins + scenario JSON run in GitHub
Actions per commit, same safety net the nightly gives JS. Roblox Studio, publishing, and in-Roblox playtesting
are human-owned regardless (division of labour, docs/03).

## 6. Slices (queued when phase 5 opens)

1. ✅ [architect] trap-audit pass over engine/ — DONE 2026-07-14 (§7;
   engine came back clean, pure transliteration).
2. ✅ [bugfixer] json2lua + rng/statehash/gamecode twins + anchor
   gates — DONE 2026-07-14 (P5-1/P5-2; all anchors first run).
3. ✅ [bugfixer] engine modules in §4 order, scenario gates per batch
   — DONE 2026-07-14 (P5-3..P5-7; ALL TEN scenario pins green
   cross-language, endTurn unguarded).
4. ✅ [bugfixer] sim-driver twin + goldens gate; replay conformance —
   DONE 2026-07-14 (P5-8: four checkpoints + natural golden
   bit-exact under lune; five replay files byte-identical verdicts;
   sim-runner cross-machine confirmation = the one open layer).
   **The engine column of this doc is CLOSED — in one day, P5-3
   through P5-8.**
5. [human] lune decision (§5) ✅ 2026-07-12; Studio project ✅ (R1-R3
   took camera/selection further than this line imagined). REMAINS:
   RemoteEvents host (R4, the GameServer), AssetFactory-for-Parts
   (with the ally), publish, playtest.

## 7. Trap-audit results (§6 slice 1, architect, 2026-07-14)

Full pass over `engine/*.js` for the three transliteration traps.
Verdict: **the discipline held — zero code changes required before
porting.** Per category:

- **`%` sites (16)**: every one is either the non-negative wrap idiom
  `((x % w) + w) % w` (idempotent under Lua's floored `%` — port
  verbatim), or provably non-negative operands (uint32 rng, rate
  multiples-of-10, turn counters, checkerboard `(x+y) % 2`). NO
  negative-dividend site exists.
- **Bare `Object.keys` iterations (~25)**: each site audited for
  order sensitivity (Luau `pairs()` is arbitrary where JS is
  insertion-ordered). ALL are order-insensitive: boolean scans
  (ZOC, enemyNear, guarded), commutative counts/sums (upkeep, score,
  martial law), idempotent set-marking (mapgen reveal), per-key
  assignment (moves refresh, deepClone), or min-searches with
  EXPLICIT id tiebreaks (`nextBuilding`/`nextWonder`: cost, then
  `id <` — order-proof by construction). Everything order-sensitive
  already goes through `sortIds` (the header rule was followed).
  PORT RULE anyway: twins iterate via a sorted-keys helper wherever
  the JS used bare keys — harmless where insensitive, and removes
  the category of doubt.
- **Bare truthiness on numbers (0-falsy trap)**: none found — the
  engine compares explicitly (`> 0`, `===`, `!== undefined`)
  throughout.

P5-3 (engine modules in §4 order) may proceed on transliteration
alone; the only conventions the twins must carry are the P5-1/P5-2
additions above (ARRAY_MT, `%d` rendering, sorted-keys iteration).

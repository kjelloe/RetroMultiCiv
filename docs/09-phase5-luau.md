# Phase 5 — Roblox Luau port: mapping & verification design

Status: DESIGN (2026-07-12) — **UNBLOCKED 2026-07-14**: phases 1–4 are
all accepted (the two-machine LAN acceptance passed), making this port
the next major technical target. The port is mechanical BY CONSTRUCTION
— the engine was written in a Lua-shaped JS subset from day one — so
this doc is mostly the trap list, the port order with its gates, and
the harness plan. Remaining prerequisite before slice 1: the user's
Roblox/lune toolchain setup (human-workitems "Later").

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
4. `json2lua` + scenario-runner twin (harness before more engine).
5. `visibility`, `government`, `combat` (needs rng), `improvements`,
   `happiness`, `cities`, `tech`, `movement`, `barbarians`, `score` —
   GATE per batch: scenarios 001–010 go green progressively.
6. `ai`, `mapgen`, `index` → GATE: scenario 002 (mapgen golden), then the
   sim-driver twin reproduces ALL FOUR checkpoint goldens, then replay
   conformance on real recordings (g530734 et al.) — the same
   `tools/replay.js` verdict, now cross-language.

## 5. Harness & CI (one open decision — human input)

Headless Luau in CI keeps the port honest per-commit, exactly like the
nightly does for JS. DECIDED (user, 2026-07-12): **lune** — whitelisted as a dev-only
toolchain dependency; the Luau twins + scenario JSON run in GitHub
Actions per commit, same safety net the nightly gives JS. Roblox Studio, publishing, and in-Roblox playtesting
are human-owned regardless (division of labour, docs/03).

## 6. Slices (queued when phase 5 opens)

1. [architect] trap-audit pass over engine/ (annotate every `%`, bare
   truthiness, unsorted-keys site) — produces the port checklist.
2. [helper] json2lua + rng/statehash/gamecode twins + anchor gates.
3. [helper] engine modules in §4 order, scenario gates per batch.
4. [helper] sim-driver twin + goldens gate; replay conformance.
5. [human] lune decision (§5); Studio project, RemoteEvents host,
   AssetFactory-for-Parts (with the ally), publish, playtest.

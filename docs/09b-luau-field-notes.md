# LUAU_SPEC — field notes on the JS→Luau engine twins

Practical, experience-based notes on writing and maintaining the `luau/*.luau`
byte-shaped twins of `engine/*.js` (and the `shared/*.js` helpers). This is the
"what actually tripped us up" companion to **`docs/09-phase5-luau.md`**, which is the
authoritative port-mapping + trap list and the source of truth if the two ever
disagree. Read docs/09 first; this doc is the working memo.

## 0. The one idea everything follows from

The engine is a **verified cross-language core**: `engine/*.js` and its `luau/*.luau`
twin must produce **bit-identical state hashes** for the same inputs. The twin is a
**byte-shaped transliteration**, not a re-implementation. Mirror the JS *structure* —
same functions, same branch order, same loop order, same RNG call sequence — even
when idiomatic Luau would be tidier. Tidiness is not the goal; **byte-for-byte hash
equality** is. If the JS is awkward, refactor the JS first (in its own change), then
port the cleaner shape; never let the twin diverge structurally "because Lua."

The forcing function: `test/luau-twins.test.js` runs both engines under `lune` and
asserts equal hashes at pinned anchors. But the pins are sparse — see §5 for why you
verify by **direct hash comparison**, not just "the gate is green."

---

## 1. What worked

- **Transliterate top-to-bottom, function-by-function, in the same order as the JS.**
  Keep the same function names and the same internal statements. A reviewer diffs the
  two files side by side; a reordered Luau file is unreviewable.

- **Default-value idiom.** JS `x === undefined ? {} : x` becomes Luau
  `if x == nil then {} else x`. Used everywhere for optional state fields
  (`wonders`, `relations`, …). Keep the exact same "absent → empty container" shape so
  hashes match on sparse states.

- **Conditional key omission for the no-null rule.** Game state holds no `null`/`nil`.
  When JS adds a key only when defined, the Luau must do the same — and crucially,
  assigning `nil` to a Luau table key is a *no-op that never creates the key*, which
  is exactly what you want. From this session's `filterView` gameOver change:
  ```lua
  if state.gameOver == true then
      view.gameOver = true
      if state.winner ~= nil then view.winner = state.winner end
  end
  ```
  mirrors the JS `if (state.gameOver === true) { view.gameOver = true;
  if (state.winner !== undefined) view.winner = state.winner; }` byte-for-byte.

- **`ARRAY_MT` on every empty array that can enter state.** `shared/statehash` (and
  its `luau/statehash.luau`) serialize an *unmarked* empty table as `{}` and an
  `ARRAY_MT`-marked one as `[]`. A city's `buildings: []`, a `cityOrder: []`, an
  `explored: []` must be `setmetatable({}, statehash.ARRAY_MT)` in Luau or the hash
  diverges the moment the array is empty. This is the single most common silent
  divergence.

- **`json2lua` for loading crafted states.** Harnesses that read a JSON state
  (`luau/maptype-hashes.luau`, `luau/scenario-hashes.luau`) parse it with
  `json2lua.parse(fs.readFile(...))` — it reproduces JS's array/object/integer
  fidelity. Reuse this pattern for any new parity harness (see §5).

- **`sortedKeys` where JS relied on `Object.keys` order-insensitivity.** JS object key
  iteration order is insertion order; Luau `pairs()` is unordered. Where the JS write
  is order-*insensitive* (accumulating into a table, not producing an ordered list),
  wrap the iteration in a `sortedKeys(t)` helper so the result is deterministic and
  identical to JS. Where order **is** load-bearing (an array, a turn loop), iterate the
  array directly — never `pairs()`.

- **Verify with direct hash comparison, both success and both seats.** The fastest,
  most trustworthy check is a throwaway harness that runs the JS function and the Luau
  function on the *same crafted input* and prints `hashState(result)` from each. When
  they match to the byte, you're done. (Example this session: a crafted gameOver state
  hashed `0x68f84ddc` for the winner's `filterView` and `0xa0171cc4` for the loser's
  in **both** engines.)

---

## 2. Gotchas that cost us time

### 2a. 1-based indexing — the tax you pay on every array access
Lua arrays are 1-indexed. Every JS index has a `+1` in Luau, and it is easy to miss
one because the code still *runs*, just produces a different (wrong) hash.

- Tile lookup: JS `tiles[y * width + x]` → Luau `tiles[y * width + x + 1]`.
- RNG-value → array index: an `rng` roll returns a 0-based value, so
  JS `arr[roll.value]` → Luau `arr[roll.value + 1]`. Miss this and you pick the
  wrong element from a distribution — a divergence that only shows on some seeds.
- Splicing/removing by index shifts everything; keep the JS algorithm, just offset.

There is no compiler help here. Grep every `[` in the ported function against its JS
twin and account for each offset deliberately.

### 2b. RNG **call order** is the contract, not just the count
All randomness flows through `engine/rng.js` (xorshift32, state in game state). The
Luau `luau/rng.luau` reimplements the *same algorithm* — never `Random.new`. But the
subtler rule is **call order**: the twin must draw from the RNG in the exact same
sequence, including **conditional** draws and **scan order**. If the JS rolls only
"on a wiggle" (a branch), the Luau must roll under the identical condition; a draw
taken one iteration earlier/later desyncs the whole stream and every subsequent hash.
When porting a loop with conditional rolls (e.g. the river meander step), trace the
draw sequence explicitly and match it.

### 2c. `table.sort` is **not** stable; JS `Array.prototype.sort` is
Where the JS sort relies on stable ordering of equal keys, the Luau `table.sort` will
reorder ties arbitrarily. Add an explicit tie-breaker (e.g. secondary sort on id) so
both languages agree on the full order. A silent tie reorder moves the hash.

### 2d. Integer math must stay integer
No floats in state (they drift and JSON-round differently). Division goes through the
`idiv` helper (floor division), never `/`. Mirror `idiv(a, b)` in Luau
(`math.floor(a / b)` behind the same helper name) and use it everywhere the JS does.
A stray `/` produces a float that either fails the statehash portability check or
hashes differently.

### 2e. Lua keyword / reserved-field collisions
JSON state fields whose names are Lua keywords (`until`, `end`, `function`, …) can't
be dotted in Luau — use bracket access `t["until"]`. Also watch `type` (a Lua global
function) as a field name; `t.type` is fine as a field but shadow carefully.

### 2f. Editing the `.luau` files: tabs are load-bearing
The `luau/` files are **tab-indented**. When editing with a scripted find/replace, the
anchor string must contain the exact tab characters and the exact indentation depth,
or the match silently fails (or, worse, matches the wrong nesting level). This bit us
repeatedly. Before editing, read the exact bytes of the target region; match on real
tabs, not spaces. Prefer a unique multi-line anchor over a short one.

### 2g. "Porting a module = deleting its guarded no-op"
Some JS hooks are guarded no-ops on the JS side until the Luau twin lands (they
`error` loudly if a state ever exercises the un-ported path). When you port the
module, remove the guard in lockstep. Leaving it makes the JS throw where the Luau
now happily runs — a cross-language behavior split, not a hash match.

---

## 3. The empty-container matrix (quick reference)

| JS value            | Luau twin                                   | Serializes as |
|---------------------|---------------------------------------------|---------------|
| `[]` (enters state) | `setmetatable({}, statehash.ARRAY_MT)`      | `[]`          |
| `{}` (plain object) | `{}`                                        | `{}`          |
| `undefined` field   | omit the key (never assign `nil` as a value)| absent        |
| `x ?? {}`           | `if x == nil then {} else x`                | matches x     |

Getting a marked-vs-unmarked empty table wrong is the classic "passes on populated
states, fails the moment it's empty" bug.

---

## 4. Data-only changes still need twin attention

A change with **no** Luau code edit can still move the cross-language contract,
because both engines read the same `data/*.json`:

- Editing a top-level `data/*.json` ruleset (e.g. `civs.json` city rosters) changes
  the **rulesetHash stamp** that `createGame` writes into state — so every
  createGame-based anchor moves in **both** languages (map-type anchors, ff-parity,
  age-snapshots, the turn-100 sim). The twins gate stays green *because* both
  languages move together, but the **pinned** values must be re-recorded.
- The twins gate's **data-checksum** test hashes each `data/*.json` live in both
  languages and asserts JS==Luau (no static pin), so a data edit passes it
  automatically — no checksum to re-record.

So: "I only touched a JSON file" is **not** "no twin/golden impact." See §5.

---

## 5. Verification recipe (do this, don't trust the gate alone)

The twins gate pins are sparse; a change can move state on a path no pin covers.
Verify directly:

1. **Direct A/B hash.** Write a tiny harness: run the JS function and the Luau
   function (via `lune run`) on the *same crafted input*, print `hashState` of each,
   diff. This is the ground truth. Do it for the meaningful cases (e.g. a gameOver
   view for both a winner and a loser seat; each of the four map types).
   *This session's harnesses to copy:* `luau/maptype-hashes.luau` (map worlds),
   an ad-hoc `_viewparity.luau` for `filterView` (delete after use).
2. **Reconcile the suite, don't skim `tail`.** `node --test` prints a `# fail N`
   summary that can hide an early failure above the fold. Grep the whole output for
   `not ok` and reconcile the count with `# fail`. (We reported a false "green" once
   by trusting a truncated tail.)
3. **Re-record together.** Any engine-semantics change adds the replay fixture FIRST,
   then moves `engine/*.js` AND `luau/*.luau` in the **same golden window**, then
   re-records every moved pin (simulation goldens, scenario `final.hash`, twins map
   anchors + turn-100 + ff-parity, age-snapshots CANONICAL_PIN + re-bake). Null the
   pin, run, paste the printed value back — guards forbid committing a null pin.
4. **Classify with the #28 discriminator.** `behaviorHash` excludes the rulesetHash
   stamp; the full `hashState` includes it. STAMP-only move (only the stamp shifted,
   behavior byte-identical) is a paste-back; a `behaviorHash` move too is a real
   behavioral re-record. A data-ruleset edit can be **both** (stamp ripple + real
   state change, e.g. 11b city names appearing in founded cities).

---

## 6. Checklist for touching a twin

- [ ] JS change has a replay fixture / scenario FIRST (engine-semantics changes).
- [ ] Luau edit mirrors JS structure, branch order, loop order, RNG call order.
- [ ] Every array index offset by `+1`; every rng-value→index is `.value + 1`.
- [ ] Empty state arrays carry `ARRAY_MT`; optional keys omitted, never `nil`-valued.
- [ ] Integer math via `idiv`; no `/`, no floats reaching state.
- [ ] `table.sort` calls have explicit tie-breakers where JS relied on stability.
- [ ] Reserved-word / reserved-global fields use bracket access.
- [ ] Direct JS==Luau hash A/B on the meaningful crafted inputs (both success paths).
- [ ] `luau-twins.test.js` green under `lune`; whole-output `not ok` reconciled.
- [ ] All moved goldens re-recorded + #28-classified; age-snapshots re-baked.
- [ ] JS and Luau edits land in the SAME golden window / commit.

---

*Sources: lived experience porting/maintaining `mapgen.luau` and `visibility.luau`
this session (river mapgen strips + hills-exclude; the `filterView` gameOver+winner
surface) plus the standing twin doctrine. Authoritative trap list: `docs/09-phase5-luau.md`.*

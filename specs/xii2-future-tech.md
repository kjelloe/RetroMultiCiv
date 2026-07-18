# XII.2 — Future Tech N: buildable spec (architect, 2026-07-18)

> User refinement XII.2 (2026-07-18): "When no tech left to research, add
> Future Tech N which gives a number of points towards score." Fact-checked
> against the wiki dump by the reviewer (#1687, Future Tech (Civ1) — real
> content). Civ1-authentic: repeatable, Fusion-Power-gated, **score-only**
> (no other effect), **no cap**. The point VALUE and bulb COST are NOT in
> the dump → labeled house values (civ-mixing ruling: Civ1-authentic
> mechanics, original numbers).

The tech tree currently STALLS gracefully when exhausted (availableTechs →
[], research stops, bulbs pile up with no sink — reviewer confirmed no
crash). Future Tech is exactly the missing sink: once the whole tree is
known, an endless repeatable "Future Tech" advance accrues score.

## 1. Design: a bounded counter (reviewer design (b), refined)

Reviewer surfaced two shapes: (a) fold each future tech into `player.techs`
as a synthetic id (zero score.js change, but the tech array grows
UNBOUNDED — a marathon accretes hundreds of strings into hashed state), or
(b) a separate `player.futureTech` integer counter. **RULED (b)** — it
represents the user's "Future Tech **N**" directly (N = the counter), keeps
state BOUNDED (one int vs an unbounded array — the state-hygiene discipline
favors this), and still gets Civ1's escalating cost for free (§3).

## 2. State (omit-safe)

- `player.futureTech` — integer, default 0 (omit-safe: absent = 0, so
  pre-XII.2 states and every non-exhausted game are byte-identical). This
  is the "N" in "Future Tech N".
- No other new state. No new tech ids in `player.techs`.

## 3. Engine (engine/tech.js + score.js + luau twins)

- **Gate = tree exhaustion.** The wiki gate is "Fusion Power known + the
  rest of the tree done". Exhausting the real tree (`availableTechs(state,
  pid, ruleset)` returns `[]`) IMPLIES Fusion Power is known (it is in the
  tree), so tree-exhaustion is the sufficient, simplest gate — no separate
  fusion check. (Add a code comment noting the subsumption; if the ruleset
  ever has an unreachable branch that empties availableTechs without fusion,
  that's a data bug, not this feature's concern.)
- **availableTechs** — when the real tree is empty, return a single
  synthetic sentinel target `FUTURE_TECH_ID` (`'future-tech'`, a constant —
  reviewer confirmed no existing `future-tech` identifier in engine/). This
  is the ONLY behavioral change to availableTechs, and it fires ONLY on
  empty — the non-exhausted path returns the identical real list (VERIFY:
  byte-identical pre-exhaustion, the golden-dormancy contract §5).
- **processResearch** — when `player.researching === FUTURE_TECH_ID` and it
  completes, DO NOT push to `player.techs`; instead `player.futureTech =
  (player.futureTech || 0) + 1`, then set researching back to
  `FUTURE_TECH_ID` (the sink is repeatable — the next level is immediately
  available). Emit a `FUTURE_TECH` event (transient, never hashed) carrying
  the new N for the turn log ("researched Future Tech N").
- **researchCost** — the sentinel's cost escalates using an effective
  known-count that INCLUDES futureTech: `known = techs.length +
  (player.futureTech || 0)`, so each level costs `techBaseCost * (known +
  1)` — Civ1's "gets more expensive" feel with NO new formula (reviewer
  prior-art: researchCost already scales linearly). For a real (non-future)
  tech the term is unchanged (futureTech is 0 until the tree empties).
- **score.js** — add a future-tech term:
  `+ (player.futureTech || 0) * rules.scorePerFutureTech`. Existing
  techs/wonders/population terms unchanged.

## 4. Constants (data/rules.json — hard rule, never hardcoded)

- `scorePerFutureTech` — house value. **Default = the same as
  `scorePerTech`** (a future tech scores like a normal advance — the
  Civ1-plausible, least-surprising default; the dump gives no basis for a
  different number). A distinct KEY so the user can tune it up/down later
  without touching normal-advance scoring.
- No new cost key — the sentinel reuses `techBaseCost` via §3's effective
  known-count (no cap, no separate cost table; authentic).

## 5. Golden classification

- **rulesetHash ripple (certain):** adding `scorePerFutureTech` to
  rules.json moves the checksum → **A82a map-type anchors + scenario 002
  re-record** (the standing ruleset-edit doctrine).
- **Behavioral soak — DORMANT expected (verify, don't assume):** the tree
  is reached ~t640 (architect note); the standard 400-turn soak likely
  never exhausts it, so `futureTech` stays 0 for every soak civ →
  soak/natural/turn-100 hashes UNCHANGED (the A76/N10 dormancy class),
  PROVIDED the non-exhausted research path is byte-identical (§3 availableTechs
  fires the sentinel ONLY on empty). **VERIFY:** if any fast-tech soak seed
  reaches tree-exhaustion by t400, that seed's hash moves BEHAVIORALLY and
  needs an honest re-record — NOT a paste-back. Marathon games are where it
  actually bites (the point of the feature).
- A crafted scenario `test/scenarios/014-future-tech.json`: a state with
  the full tree already known + researching the sentinel; completing it
  increments futureTech and raises score. Pinned `final.hash`
  cross-language (the 012/013 pattern). Also covers the escalating cost.

## 6. Cross-language (JS==Luau twin — same window)

- `engine/tech.js` (availableTechs sentinel + processResearch increment +
  researchCost effective-known) and `engine/score.js` (the futureTech term)
  mirror into `luau/tech.luau` + `luau/score.luau` byte-shaped in the SAME
  golden window. The sentinel id + the omit-safe `|| 0` default must match
  exactly (Lua `nil` → treat as 0).
- The new scenario 014 runs both engines via the twins gate.

## 7. Client (XII.2 display — golden-neutral, HELPER, after the engine lands)

- Show **"Future Tech N"** where the tech UI shows current research once the
  tree is exhausted (the research panel / tech blurbs / turn log). Reads
  `player.futureTech` (the engine field from §2) — a pure display of a new
  state field, golden-neutral, no engine change. Queue to the helper AFTER
  the engine window lands (needs the field to exist). The `FUTURE_TECH`
  event drives the turn-log line.
- Pedia/score-screen: the score breakdown should show the future-tech
  contribution (a line in the existing score panel) so the points are
  legible — the user's "gives a number of points towards score" made
  visible.

## 8. Scope fence

- Score ONLY — no unit/building/wonder/government/gate effects (reviewer:
  "provides no other benefits beyond an increase to your score"). Do NOT
  add any.
- No cap (authentic — "repeatedly for additional points", no limit).
- The engine window is the bugfixer's (tech.js/score.js/twins/goldens); it
  queues AFTER D3 (do not interleave two open golden windows). The client
  display is the helper's, after.

## 9. Provenance

Repeatable + Fusion-Power-gated + score-only + no-cap + no-other-effect are
Civ1-authentic (Future Tech (Civ1), dump-citable, reviewer #1687). The
point VALUE (`scorePerFutureTech`, defaulted to `scorePerTech`), the cost
shape (reused `techBaseCost` escalation), and the bounded-counter design
are labeled house/original choices — the dump pins none of them.

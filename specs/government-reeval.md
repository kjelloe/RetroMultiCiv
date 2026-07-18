# Government re-eval — buildable spec (architect, 2026-07-18)

Measurement basis: sim-runner #1315 (building paybacks are 80t-to-INFINITE
under Monarchy's tiny trade; Republic/Democracy ~double city trade, halving
paybacks into worthwhile — and no civ ever advances past Monarchy). One
lever easing three gaps: trade, buildings, government stagnation. The
benchmark game (all-Monarchy at 1775 AD) is the field confirmation.

## Current behavior (the gap)

ai.js beelines the Monarchy prereq path, revolts to Monarchy once, and
never re-evaluates. Republic/Democracy exist fully in data + engine
(trade bonus, war unhappiness, senate rows deferred to phase 6) but are
unreachable by AI choice.

## The v1 shape (stance-linked adoption — heterogeneous, archetype-consistent)

1. **Re-eval trigger:** on each techDiscovered of a government-granting
   tech (and once at the Monarchy-revolt site for back-compat of the
   existing flow) the AI runs `pickGovernment(state, pid, ruleset, S)`.
2. **Stance targets (new STANCES fields — behavior knobs, the A40
   precedent, NOT rules.json facts):**
   - `builder` (Perfectionist): `govTarget: 'republic'` — adopt Republic
     whenever known, unconditionally. attackerPct 0 means their units
     garrison at home → Republic's war unhappiness (away-units only) is
     near-moot; the anarchy dip is safe behind walls+garrison.
   - `balanced`: `govTarget: 'republic-if-safe'` — adopt Republic only
     when NO visible enemy unit stands within the existing threat radius
     of any own city at re-eval (fog-honest, reuses enemyNear); else hold
     Monarchy (martial law + free war). Re-evals again at the next
     government tech or when peace returns (cheap: re-check at each
     techDiscovered + every N=20 turns via the existing turn-wrap AI path
     — pick ONE site, prefer the tech trigger + a coarse periodic).
   - `defensive`/`science`/`growth` (regency stances): same as builder
     (they under-war by construction).
   - future `aggressive`: `govTarget: 'monarchy'` (explicit, never
     advances — war machine by design).
3. **Democracy: DEFERRED to phase 6** (senate/war constraints are D-family
   per docs/14; v1 tops out at Republic). Explicit non-goal line.
   FORWARD-FLAG (reviewer #1349 wiki fact): in Civ 1 the senate
   constraint ("can't declare war, must accept all peace treaties")
   applies to REPUBLIC too, not Democracy-only. It cannot bite before D1
   (no war/peace state exists); v1 ships Republic without it as a
   labeled simplification, and docs/14's senate row now lists Republic
   alongside Democracy so the D-family design inherits the fact.
4. **Mechanics reused, zero new engine surface:** setGovernment +
   processRevolutions (2-turn anarchy, Pyramids instant) unchanged; the
   only engine edit is ai.js's government policy (+ luau twin). No
   rules.json change → NO rulesetHash ripple (A82a/002 stay).

## Tests

- Fixture (test/ai.test.js): a builder civ that knows Republic issues
  setGovernment republic (revolution → 2 turns → republic); a balanced civ
  with a visible enemy near a city HOLDS monarchy; the same civ with the
  enemy removed adopts at the next re-eval site; regency stances follow
  their targets.
- Scenario pin (new NNN-government-reeval.json): a deterministic
  builder-adoption run, cross-language.
- Goldens re-record (AI behavior shifts broadly — soak/natural/turn-100 +
  witness; NOT the A82a/002 anchors, no ruleset edit).

## Acceptance gate (sim-runner, on the shipped code)

The win is the N9 CLUSTER easing, not any single number:
1. Governments ADVANCE in the soak (a meaningful share of surviving civs
   reach Republic by t400; the benchmark game's all-Monarchy signature
   dies).
2. Buildings get BUILT and PAY BACK (bldgPct up vs marker-0049 baseline;
   the payback table re-measured under Republic trade shows marketplace/
   library under ~40 turns at pop 6+).
3. Elim median stays in the 20-40 band at dg=30 (the pin holds — builders
   already don't war; balanced civs only adopt when safe, so war behavior
   at contact is unchanged).
4. M-floors: M2/M3/M4 move toward their targets (the ratchet's
   add-on-clear rule fires for any floor that crosses).

## Provenance

The government VALUES are Civ1-authentic (reviewer-verified against the
wiki table: tradeBonus 1, warUnhappiness 1, martialLawMax 0, upkeep 1,
very-low corruption — all match shipped data). The adoption RULE is
**original, Civ1-consistent** (the wiki is silent on Civ1's actual AI
government behavior — reviewer #1349), aligned with the
heterogeneous-archetype direction.

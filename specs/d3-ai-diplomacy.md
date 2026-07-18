# D3 — AI diplomacy negotiation policy: buildable spec (architect, 2026-07-18)

> **PRE-OPEN — not yet landed.** Author does a data check + the three
> flagged calls (§9) BEFORE touching engine code; request rulings if any
> finding contradicts this spec (the A59 pre-open pattern). D3 is the
> **first CONSUMER of A59** (`personalityOf`) and the FIRST BEHAVIORAL
> diplomacy window — the AI now *issues* the D1 `diplomacy` command, so
> the soak WILL diverge → this is a **behavioral golden re-record**, NOT
> golden-neutral. Two-phase close (docs process): code byte-shaped JS==Luau
> FIRST → sim-runner constant sweep (elim-band + the mix-conditional
> witness) → ONE golden re-record. No provisional pin reaches the
> committed timeline.

D3 makes AI civs *negotiate*: declare war, offer/accept peace, and demand
tribute, driven by leader personality (A59) + a per-pair relationship
model + situational inputs — table-driven score models, constants in
`data/rules.json`. This operationalizes the phase-6 relationship model
(docs/14 §"RELATIONSHIP MODEL ADOPTED", user ruling 2026-07-17) and the
user's **mix-conditional elimination** ruling (2026-07-18): the
elimination rate becomes a function of the leader mix — all-aggressive →
more eliminations; no-aggressive → an economic/tech/space contest; a
**space launch triggers all-out war on the launcher's capital**.

## 1. Scope fence (what D3 IS and IS NOT)

**D3 IS:**
- The per-pair RELATIONSHIP VALUES (trust/fear/grievance/respect) as
  omit-safe state, updated by a small fixed rule set.
- The DECISION score models (`scoreWarIntent`, `scorePeaceAccept`,
  `scoreDemandTribute`) over personality axes + relationship + situational
  inputs. Constants in `data/rules.json`.
- The AI DIPLOMACY STEP in `runAiTurn`: each AI, on its turn, evaluates
  each contacted rival and MAY issue a D1 `diplomacy` command (declare /
  offer / accept / reject) and the D3 tribute demand.
- The **mix-conditional war doctrine**: war intent scales with the
  attacker's aggression axis AND the defender's weakness/grievance, so a
  table full of Gandhis rarely eliminates and a table of Shakas does.
- The **space-launch trigger**: once any civ has a launched spaceship
  bound for Alpha Centauri, every *other* AI's war intent toward the
  launcher spikes (race to raze the capital before arrival — Civ1
  behavior; the launch is cancelled if the capital falls, existing rule).

**D3 IS NOT (later slices — do not build):**
- Tribute/tech-exchange TERMS negotiation (which tech, how much gold) —
  that's **D4**. D3's `scoreDemandTribute` only decides WHETHER to demand
  and the fixed MVP demand (gold-per-turn tribute or immediate ceasefire);
  the specific tech-swap terms are D4.
- Reputation CONSEQUENCES + the senate (a democracy/republic that cannot
  declare war, must accept peace) — that's **D5**. D3 updates the
  relationship values and the D1 `reputation` int; it does not yet gate
  war on government.
- Human-facing negotiation UI beyond what D2 shipped — D3 is engine-only
  AI policy. The D2 audience UI renders the events D3 pushes.
- Alliances, blocs, espionage, embassies (D6+ / deferred).

## 2. State: the relationship values (omit-safe)

Extend the D1 `state.relations[pairKey]` entry with FOUR integer values,
0–100, per the adopted model (docs/14). **Omit-safe**: an absent value
reads as its neutral default, so pre-D3 states and the entire pre-D3 soak
are byte-identical UNTIL the AI first writes one. A pair with no
interaction still has no entry (default war, no values) — identical to D1.

```
state.relations["p1|p6"] = {
  state, treatyTurn, expiresTurn?, offer?,   // D1, unchanged
  trust?,      // 0-100, default 50 — honors commitments → serious offers, fewer pre-emptive wars
  fear?,       // 0-100, default 0  — military danger → appease / defend
  grievance?,  // 0-100, default 0  — hostile acts → demands, war likelihood
  respect?     // 0-100, default 50 — competence/power → takes offers seriously
}
```

- **Accessors in `engine/diplomacy.js`** (extend, don't fork): `relValue(state,
  a, b, key)` returns the value or its default; `bumpRel(state, a, b, key,
  delta, ruleset)` clamps to 0–100 and LAZILY creates the entry (mirroring
  the D1 offer placeholder). All bumps go through `bumpRel` so clamping is
  one place. Integers only (no floats — hard rule).
- **Update rules (fixed, small, deterministic)** — applied at the moments
  they occur, NOT swept per turn:
  - ATTACK / capture against a pair → `grievance += relGrievanceOnAttack`
    (both directions? NO — only the *victim's* grievance toward the
    attacker rises; the attacker's does not. Directionality: grievance is
    DIRECTED, so store it under the pair but as `grievanceOf(state, holder,
    toward)` — see §2a).
  - TREATY_BROKEN (D1 already emits) → victim `grievance += relGrievanceOnBetray`,
    `trust -> max(0, trust - relTrustOnBetray)`, and the D1 `reputation`
    penalty stays.
  - PEACE_TREATY_SIGNED → `grievance -> idiv(grievance, 2)` decay both ways.
  - Per-AI-turn DECAY (cheap, in the diplomacy step, integer): `grievance
    -> grievance - relGrievanceDecay` (floored 0) so old slights fade —
    this is the ONLY per-turn write and it is idempotent-safe.
  - `fear` and `respect` are DERIVED each decision from military balance
    (§3), NOT stored-and-decayed, to keep state small — store only
    trust+grievance (the memory values); compute fear/respect on the fly.
    **CALL 1 (§9):** confirm store-2/derive-2 vs store-4.

### 2a. Grievance directionality

Grievance and trust are DIRECTED (A wronged B ≠ B wronged A). The D1 key is
an unordered sorted pair. Store directed values under the pair with an
explicit holder tag: `grievance_lo` / `grievance_hi` where `lo`/`hi` follow
the sorted-pair order (`p1|p6`: lo=p1, hi=p6). `grievanceOf(state, holder,
toward)` picks the field by comparing ids. This keeps the D1 single-entry-
per-pair shape (no new key scheme, hashing stable) while carrying
direction. **CALL 2 (§9):** confirm this vs a directed-key scheme.

## 3. The decision score models (`engine/ai-diplomacy.js`, NEW module)

New engine module (≤300 lines, one subsystem = AI diplomacy policy; keeps
`ai.js` under ceiling). Pure functions over `(state, me, other, ruleset,
S)`; all constants from `ruleset.rules` (see §5). Each returns an INTEGER
score; a fixed threshold (also a constant) gates the action. Deterministic
— any RNG uses `engine/rng.js` with state in `state` (a tie-break roll for
"declare this turn vs wait", NOT a probability float).

- **`scoreWarIntent(state, me, other, ruleset, S) -> int`**
  `= aggression*wAgg + grievanceOf(me→other)*wGrv + weakness(other)*wWeak
     + borderPressure*wBorder - fear(me→other)*wFear - trust*wTrust
     + launchThreat*wLaunch`
  where:
  - `aggression` = `personalityOf(state, me, ruleset).aggression` (A59 —
    the first consumer).
  - `weakness(other)` = my military strength vs theirs, scaled 0–100
    (`countMilitary` ratio; a weak neighbor invites attack — the user's
    "prey on the weak").
  - `borderPressure` = adjacency of our territories/units (reuse the
    `enemyNear`/city-proximity signal already in ai.js).
  - `fear` = derived from `militaryBalance` when other >> me (appeasement:
    high fear SUPPRESSES war intent — a weak civ does not declare on a
    strong one; it appeases).
  - `launchThreat` = `relLaunchWarBonus` if `other` has a launched
    spaceship (§4), else 0 — the space-launch all-out-war trigger.
  If `> warIntentThreshold` AND currently at peace (or no treaty) AND the
  senate does not forbid it (D5 — not yet, so always allowed in D3) →
  issue `diplomacy declare` (or simply proceed to attack — see §4 on the
  declare-vs-attack seam).

- **`scorePeaceAccept(state, me, other, ruleset, S) -> int`** — when
  `other` has a PENDING peace offer toward `me` (D1 `offer`), decide
  accept/reject:
  `= fear*wPFear + trust*wPTrust + warWeariness*wWeary - aggression*wPAgg
     - grievanceOf(me→other)*wPGrv - winningWar*wWinning`
  A Gandhi with high fear and low grievance ACCEPTS; a Shaka who is winning
  REJECTS. `> peaceAcceptThreshold` → `diplomacy accept`, else `reject`.

- **`scoreDemandTribute(state, me, other, ruleset, S) -> int`** — MVP: a
  strong aggressive civ at peace demands tribute from a weak neighbor.
  `= aggression*wDAgg + weakness(other)*wDWeak + grievanceOf(me→other)*wDGrv`
  gated by a COOLDOWN (`lastDemandTurn` on the entry — don't demand every
  turn). Above threshold → push a `TRIBUTE_DEMANDED` event (D4 negotiates
  the actual payment; D3 only demands + records grievance if refused).
  **CALL 3 (§9):** is tribute in D3's MVP or deferred wholesale to D4? The
  slice list puts "tribute + tech exchange TERMS" in D4; I read D3 as
  owning the DECISION-to-demand and D4 the TERMS. Confirm scope.

## 4. The AI diplomacy step (`runAiTurn` hook) and the declare-vs-attack seam

- A new step in the per-AI turn (after movement/combat resolution, before
  end-turn), guarded so it only runs when `state.relations !== undefined`
  is not required (omit-safe: the AI may CREATE the first relation). Only
  runs vs players the AI has CONTACTED (met) — reuse the visibility/known
  signal; an AI does not negotiate with a civ it has never seen. This is
  also the natural home for the deferred-to-D2 `notMet` gate consumer.
- **Declare-vs-attack:** today the AI attacks based on stance WITHOUT a
  formal war declaration (D1 combat is war-gated by `relationOf`, and an
  absent pair = war, so AI attacks "just work" at default war). D3 must
  NOT double-issue. Rule: the AI issues `diplomacy declare` ONLY to break
  an EXISTING peace treaty (transition peace→war) when `scoreWarIntent`
  clears the threshold; if the pair is already at (default) war, no declare
  is needed — the AI just attacks as today. So D3's declare fires only
  after a peace treaty has been signed and then war-intent recovers. This
  keeps the default-war baseline byte-shaped and makes `declare` a
  deliberate treaty-break (→ TREATY_BROKEN, grievance, reputation hit).
- **Offer peace:** an AI losing a war (high fear, war weariness) or a
  peaceful personality issues `diplomacy offer` to a rival it is at war
  with; the rival's `scorePeaceAccept` (on ITS turn) decides. Two AIs can
  thus negotiate a peace across two turns — deterministic, replayable.

## 5. Constants (data/rules.json — NEVER hardcoded, hard rule)

Add a `diplomacy` block to `data/rules.json` (ruleset file → checksum
moves → part of the golden re-record; that is expected here since D3 is
behavioral anyway). All INTEGERS. Proposed starting values are the
sim-runner's to SWEEP for the elim-band (§7) — do NOT treat these as final:

```
"diplomacy": {
  "warIntentThreshold": 60, "peaceAcceptThreshold": 50,
  "wAgg": 1, "wGrv": 1, "wWeak": 1, "wBorder": 1, "wFear": 2, "wTrust": 1, "wLaunch": 100,
  "wPFear": 2, "wPTrust": 1, "wWeary": 1, "wPAgg": 1, "wPGrv": 1, "wWinning": 2,
  "wDAgg": 1, "wDWeak": 1, "wDGrv": 1, "demandThreshold": 70, "demandCooldown": 20,
  "relGrievanceOnAttack": 15, "relGrievanceOnBetray": 40, "relTrustOnBetray": 30,
  "relGrievanceDecay": 1, "relLaunchWarBonus": 100
}
```

Weights are deliberately small integers so the score stays in a legible
range and the sweep can reason about it. `wLaunch`/`relLaunchWarBonus` are
large (a launch dominates all other intent — the all-out-war trigger).

## 6. Cross-language (JS==Luau twin — MANDATORY, same window)

- `engine/ai-diplomacy.js` gets a byte-shaped `luau/ai-diplomacy.luau`
  twin; the `bumpRel`/`relValue`/`grievanceOf` additions to
  `engine/diplomacy.js` mirror into `luau/diplomacy.luau` in the SAME
  window (twin-fidelity rule).
- The soak twin (`luau/sim-smoke.luau`) now exercises AI diplomacy, so its
  turn-100/400/natural hashes re-record cross-language — the twins gate
  proves JS==Luau over the NEW behavior, not just turn-100.
- A new scenario `test/scenarios/013-ai-diplomacy.json`: a crafted 2–3
  player state where one AI's `scoreWarIntent` clears the threshold and
  breaks a treaty, and another accepts a peace offer — pinned `final.hash`
  cross-language (the D1 012 pattern). Code-free (runs both engines).

## 7. Golden re-record (BEHAVIORAL — the two-phase close)

1. **Author + byte-shape** the code (JS==Luau) with the §5 starting
   constants. Suite green EXCEPT the goldens (expected to move).
2. **Hand to sim-runner** for the constant sweep: find the constants that
   land the elimination band in the mix-conditional target (§8) across the
   seed set, chaos on/off. The sweep is over `warIntentThreshold`,
   `peaceAcceptThreshold`, and the aggression weights — NOT a free-for-all.
3. **ONE golden re-record** at the swept constants: soak
   0x…/natural/turn-100/witness + A82a/002 (rules.json checksum) + the new
   scenario 013 pin. `marker` request when green. No intermediate pin is
   committed (stop-chasing-count rule).

## 8. Acceptance — the mix-conditional witness (the user's ruling)

Beyond suite-green + JS==Luau, D3 must demonstrate the mix-conditional
behavior — the user's explicit test. Sim-runner produces a small witness
table (`--stats`, a few seeds each):

- **All-aggressive table** (Shaka/Genghis/Caesar-heavy): elimination count
  UP vs the D1 baseline — wars start, capitals fall.
- **No-aggressive table** (Gandhi/Ramesses/Hammurabi-heavy): FEW or ZERO
  eliminations; the game resolves by score/tech/space — an economic
  contest, as the user described.
- **A space launch in a peaceful table** flips it: once a civ launches,
  the others' war intent spikes and at least one coalition war on the
  launcher's capital is observed (or the launch succeeds if the capital
  holds — both are valid, but the WAR must be attempted).

This table is the behavioral evidence the window is correct — attach it to
the marker report. It is also the first data point for the user's
"elimination rate as a function of leader mix" vision (memory:
ai-archetype-endings-vision).

## 9. Calls the author settles at PRE-OPEN (request rulings)

1. **Store-2/derive-2 vs store-4** (§2): I propose storing trust+grievance
   (the memory) and deriving fear+respect (situational) to keep state
   small. Confirm, or store all four.
2. **Grievance directionality** (§2a): `grievance_lo`/`grievance_hi` under
   the sorted pair vs a directed-key scheme. I propose the former (keeps
   the D1 one-entry-per-pair shape).
3. **Tribute scope** (§3): D3 owns the decision-to-demand + a fixed MVP
   demand; D4 owns the terms. Confirm, or defer tribute wholesale to D4
   (then D3 ships war/peace only — a cleaner slice; acceptable).
4. Any weight/threshold in §5 that the data check shows is unit-mismatched
   (e.g. `countMilitary` returns a raw count, not 0–100 — you may need a
   `scaleTo100` helper; flag it rather than guessing).

## 10. Dependencies & provenance

- **Consumes A59** (`personalityOf` — marker-0061). This is A59's first
  and reason-for-being consumer.
- **Builds on D1** (`state.relations`, `relationOf`, the `diplomacy`
  command, TREATY_BROKEN/PEACE_TREATY_SIGNED events — marker-0060).
- The relationship-value model, the score-model shape (`scoreWarIntent`),
  and trust/fear/grievance/respect are the designer ally's design
  (specs/leader-attributes.md, docs/14). The mix-conditional elimination +
  space-launch-triggers-war are the USER's ruling (2026-07-18). Adapted to
  integers (state bans floats) and to the D1 omit-safe pair shape.
- **Feeds D4** (tribute/tech terms negotiate the demands D3 raises) and
  **D5** (senate reads the war decisions; reputation consequences read the
  relationship values D3 maintains).

# D3 — AI diplomacy negotiation policy: buildable spec (architect, 2026-07-18)

> **STATUS 2026-07-19 — SHIPPED as marker-0064 (`87cfe3b`).** Two-phase close
> complete: phase-1 accepted (#1735) → sim-runner sweep ruled PAT=30 (#1764) →
> phase-2 re-record + Gate-B (Luau full parity) + full suite green,
> bugfixer-verified (#1837), tagged marker-0064. History below retained.
>
> **PHASE-1 ACCEPTED (historical).**
> Code complete + byte-shaped JS==Luau; phase-1 stable goldens re-recorded +
> audit ledger + both additive-proofs passed (#1735). Constant sweep DONE +
> RULED: `peaceAcceptThreshold 50→30` (#1762 sweep, #1764 ruling — §5). Only
> the phase-2 re-record remains (bugfixer's lane #1704): apply PAT=30,
> re-record the moved goldens (see §7 for the FULL expanded set — the
> rulesetHash ripple moves 6 more pins than first named), JS==Luau, Gate-B
> 400-round Luau parity (sim-runner), then the marker-0063 gate. The
> pre-open history below is retained for the record.
>
> **PRE-OPEN (historical).** Author did a data check + the three
> flagged calls (§9) BEFORE touching engine code; request rulings if any
> finding contradicts this spec (the A59 pre-open pattern). D3 is the
> **first CONSUMER of A59** (`personalityOf`) and the FIRST BEHAVIORAL
> diplomacy window — the AI now *issues* the D1 `diplomacy` command, so
> the soak WILL diverge → this is a **behavioral golden re-record**, NOT
> golden-neutral. Two-phase close (docs process): code byte-shaped JS==Luau
> FIRST → sim-runner constant sweep (elim-band + the mix-conditional
> witness) → ONE golden re-record. No provisional pin reaches the
> committed timeline.
>
> **PRE-OPEN RULED 2026-07-18 (#1679→#1680) — build to THIS amended spec:**
> CALL 1 store-2/derive-2 (store trust_lo/hi + grievance_lo/hi, derive fear/
> respect) CONFIRMED. CALL 2 directionality _lo/_hi on the sorted pair
> CONFIRMED. CALL 3 **tribute DEFERRED WHOLESALE to D4** — D3 is WAR/PEACE-
> ONLY (scoreDemandTribute + TRIBUTE_DEMANDED + the demand constants struck;
> §3/§5 amended). CALL 4 ratio-to-100 scaler CONFIRMED (symmetric weakness/
> fear, integer, div-guarded). CONTACT SIGNAL — **ruling (c): persistent
> met-state riding the D1 pair entry** (`met` bool, omit-safe + a
> FIRST_CONTACT event + a deterministic per-turn contact pass): chosen over
> proximity because the space-launch COALITION war needs NON-ADJACENT civs to
> act on the launcher (proximity can't express that) and it pays D2's
> deferred first-contact debt. See §2/§4.

D3 makes AI civs *negotiate*: declare war and offer/accept peace, driven
by leader personality (A59) + a per-pair relationship
model + situational inputs — table-driven score models, constants in
`data/rules.json`. This operationalizes the phase-6 relationship model
(docs/14 §"RELATIONSHIP MODEL ADOPTED", user ruling 2026-07-17) and the
user's **mix-conditional elimination** ruling (2026-07-18): the
elimination rate becomes a function of the leader mix — all-aggressive →
more eliminations; no-aggressive → an economic/tech/space contest; a
**space launch triggers all-out war on the launcher's capital**.

## 1. Scope fence (what D3 IS and IS NOT)

**D3 IS:**
- Persistent MET-STATE (`met` on the D1 pair entry) + a FIRST_CONTACT
  event + a per-turn contact pass — the shared foundation D2 (audiences)
  and D3 (negotiation gate) both need. §4.
- The per-pair RELATIONSHIP memory (directed trust/grievance stored;
  fear/respect derived) as omit-safe state, updated by a small fixed rule
  set.
- The DECISION score models (`scoreWarIntent`, `scorePeaceAccept`) over
  personality axes + relationship + situational inputs. Constants in
  `data/rules.json`.
- The AI DIPLOMACY STEP in `runAiTurn`: each AI, on its turn, evaluates
  each MET rival and MAY issue a D1 `diplomacy` command (declare / offer /
  accept / reject). WAR/PEACE only — tribute is D4.
- The **mix-conditional war doctrine**: war intent scales with the
  attacker's aggression axis AND the defender's weakness/grievance, so a
  table full of Gandhis rarely eliminates and a table of Shakas does.
- The **space-launch trigger**: once any civ has a launched spaceship
  bound for Alpha Centauri, every *other* AI's war intent toward the
  launcher spikes (race to raze the capital before arrival — Civ1
  behavior; the launch is cancelled if the capital falls, existing rule).

**D3 IS NOT (later slices — do not build):**
- Tribute AND tech-exchange — DEFERRED WHOLESALE to **D4** (CALL 3, #1680):
  both the decision-to-demand AND the terms. No `scoreDemandTribute`, no
  `TRIBUTE_DEMANDED`, no demand constants in D3.
- Reputation CONSEQUENCES + the senate (a democracy/republic that cannot
  declare war, must accept peace) — that's **D5**. D3 updates the
  relationship values and the D1 `reputation` int; it does not yet gate
  war on government.
- Human-facing negotiation UI beyond what D2 shipped — D3 is engine-only
  AI policy. The D2 audience UI renders the events D3 pushes.
- Alliances, blocs, espionage, embassies (D6+ / deferred).

## 2. State: the relationship values (omit-safe)

Extend the D1 `state.relations[pairKey]` entry with the DIRECTED memory
values (trust/grievance per direction, 0–100) plus the `met` bool, per the
adopted model (docs/14) and CALL 1/2. **Omit-safe**: an absent value reads
as its neutral default, so pre-D3 states and the entire pre-D3 soak are
byte-identical UNTIL the first contact/interaction writes one. A pair with
no interaction still has no entry (default war, not met) — identical to D1.

```
state.relations["p1|p6"] = {
  state, treatyTurn, expiresTurn?, offer?,   // D1, unchanged
  met?,          // bool, default false — the two civs have made contact (§4); FIRST_CONTACT on flip
  trust_lo?,     // 0-100, default 50 — lo=first sorted pid's trust TOWARD hi (directed)
  trust_hi?,     // 0-100, default 50 — hi's trust toward lo
  grievance_lo?, // 0-100, default 0  — lo's grievance toward hi (directed)
  grievance_hi?  // 0-100, default 0  — hi's grievance toward lo
}
// fear + respect are DERIVED per-decision from military balance (CALL 1: store the
// memory [trust/grievance], derive the situational) — NOT stored, keeps the entry small.
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
    **CALL 1 RULED: store-2/derive-2** (confirmed #1680).

### 2a. Grievance directionality

Grievance and trust are DIRECTED (A wronged B ≠ B wronged A). The D1 key is
an unordered sorted pair. Store directed values under the pair with an
explicit holder tag: `grievance_lo` / `grievance_hi` where `lo`/`hi` follow
the sorted-pair order (`p1|p6`: lo=p1, hi=p6). `grievanceOf(state, holder,
toward)` picks the field by comparing ids. This keeps the D1 single-entry-
per-pair shape (no new key scheme, hashing stable) while carrying
direction. **CALL 2 RULED: _lo/_hi on the sorted pair** (confirmed #1680).

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
  - `weakness(other)` = my military strength vs theirs, scaled 0–100 via
    the CALL 4 ratio-to-100 helper (`countMilitary` returns a RAW count, not
    0–100 — the helper does `clamp(idiv(myMil*100, max(1, myMil+theirMil)))`
    or equivalent monotonic integer form; pin the exact formula in code). A
    weak neighbor invites attack — the user's "prey on the weak".
  - `borderPressure` = adjacency of our territories/units (reuse the
    `enemyNear`/city-proximity signal already in ai.js).
  - `fear` = the SAME ratio helper with operands swapped (theirs vs mine —
    high when other >> me): appeasement, high fear SUPPRESSES war intent, a
    weak civ does not declare on a strong one. Derived, not stored.
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

- **Tribute — DEFERRED WHOLESALE TO D4 (CALL 3 RULED, #1680).** No
  `scoreDemandTribute`, no `TRIBUTE_DEMANDED` event, no `demandCooldown`/
  `lastDemandTurn`, no `wD*` constants in D3. D3 is WAR/PEACE-only. D4 owns
  the decision-to-demand together with the terms it already owns — a cleaner,
  tighter D3 window. (Kept here as a scope marker so the seam is not
  re-litigated at build.)

## 4. Contact (met-state), the AI diplomacy step, and the declare-vs-attack seam

**Contact — met-state (CONTACT SIGNAL RULED (c), #1680).** D1 deferred
met-tracking (there is NO engine met-state today; the only signal is
tile-level `me.explored`, which does not say "I have seen rival X"). D3
adds it, riding the D1 pair entry:
- `metOf(state, a, b) -> bool` reads `relations[pair].met` (default false,
  omit-safe). Symmetric by construction (one entry per pair).
- A **deterministic per-turn contact pass** (`detectContacts` — run for the
  ACTIVE player each turn, EVERY seat incl. humans, since D2's first-contact
  audience needs it too): `computeVisible(me)` and if any rival unit/city
  sits on a visible tile, lazily create the pair entry, set `met = true`,
  and push a **`FIRST_CONTACT`** event (UPPER_SNAKE, transient/never-hashed)
  once on the false→true flip. Pure READ of visibility; WRITES only `met` +
  the event. Behavioral (moves soak/natural — expected; a crafted scenario
  with no rival-in-sight sees no change).
- The diplomacy step GATES on `metOf` — an AI negotiates only civs it has
  MET. Persistent ("once met, always negotiable") so contact is not lost
  out of sight — this is what lets the space-launch coalition (§3/§8) form
  across the map. By the space era met-state is near-universal, so no
  special-case launch bypass is needed; a civ that genuinely never met the
  launcher does not join (authentic). This is also the real event that
  RETIRES D2's deferred client-side `notMet` turnlog derivation.

**The AI diplomacy step** — a new step in the per-AI turn (after movement/
combat resolution, before end-turn), over each MET rival. Omit-safe: the AI
may CREATE the first relation entry via `bumpRel`/contact.
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
behavioral anyway). All INTEGERS. Proposed starting values were the
sim-runner's to SWEEP for the elim-band (§7).

**SWEPT + RULED (architect #1764, sim-runner sweep #1762):**
`peaceAcceptThreshold: 50 → 30` (the one lever moved); `warIntentThreshold`
stays 60; all weights stay as-is. Rationale: the score identity
`scorePeaceAccept = 50 - aggression` at parity makes 30 a clean
personality boundary — only `aggression < 20` negotiates (peaceful leaders
YES, balanced/aggressive NO). PAT 30 chosen over 25 (robust n=6 witness vs
25's thin n=2; both keep the default-roster elim median unmoved at 3.0).
Weights unchanged because the 50-aggression identity already orders the
personalities against a single threshold — touching them would blur the
boundary without adding a witness PAT 30 doesn't already deliver.

```
"diplomacy": {
  "warIntentThreshold": 60, "peaceAcceptThreshold": 30,  // PAT ruled 30 (#1764); was 50 provisional
  "wAgg": 1, "wGrv": 1, "wWeak": 1, "wBorder": 1, "wFear": 2, "wTrust": 1, "wLaunch": 100,
  "wPFear": 2, "wPTrust": 1, "wWeary": 1, "wPAgg": 1, "wPGrv": 1, "wWinning": 2,
  "relGrievanceOnAttack": 15, "relGrievanceOnBetray": 40, "relTrustOnBetray": 30,
  "relGrievanceDecay": 1, "relLaunchWarBonus": 100
}
// tribute (wD*/demandThreshold/demandCooldown) DEFERRED to D4 (CALL 3).
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
  player state where a rival unit sits in sight (met flips → FIRST_CONTACT),
  one AI's `scoreWarIntent` clears the threshold and breaks a treaty, and
  another accepts a peace offer — pinned `final.hash` cross-language (the D1
  012 pattern). Code-free (runs both engines).

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

**EXPANDED MOVED SET at PAT=30 (bugfixer Finding 2, #1774) — the phase-2
audit ledger + marker-0063 gate must expect these 10 reds, not the 4 first
named.** `peaceAcceptThreshold` lives in `data/rules.json`, so it is part of
`hashState(ruleset)=state.rulesetHash`, which EVERY createGame-derived final
hash carries — phase-1 re-recorded these at PAT=50 as "stable" but they are
PAT-dependent through rulesetHash, so phase-2 re-records them again at PAT=30:
- **4 behavioral (expected):** soak-400 (528), natural (529), luau turn-100
  (276), B13 witness (360).
- **6 rulesetHash ripple (createGame-derived):** scenario-002 JS (363) +
  luau-checksums/002 (275), luau A82a map-type pins (278), luau ff-parity
  (279).
- **NOT D3 — pre-existing on `ba9ad3f`, fix before the batch marker (Finding
  1):** render-spec drift (342) + browser replay theater (84). These belong to
  the city-era golden-neutral batch, routed to the helper — see the batch-marker
  gate, independent of D3.
VERIFIED PAT-30 values (bugfixer #1772, JS deterministic double-run + turn-100
JS==Luau): soak {100:0xd4c36480, 200:0xe5c5807c, 300:0x160827ea,
400:0xc7d89071}; natural r395/p2/0xef761753; twin turn-100 0xd4c36480.
Scenarios 012/045 do NOT move (short scripts, civs never cross aggression<20).
The 200/300/400 Luau full-parity is Gate-B (sim-runner, stable-PAT-30 tree).

**PHASE-2 DONE + FINAL PINS (bugfixer #1810, 2026-07-19).** Re-record complete,
JS==Luau green (suite 627/630; the 3 reds are non-D3: 84 browser-theater + 342
render-spec = the committed city-era batch [42abf04], 360 B13 = local-only
gitignored fixture). Final pins: scenario-002 0x8dae6d03 (JS+Luau); A82a
continents 3132b03d / pangaea 1592f59a / archipelago fc6fbf71 / islands c2c332fc;
ff-parity 0x0971239f; turn-100 0xd4c36480; soak {100:0xd4c36480, 200:0xe5c5807c,
300:0x160827ea, 400:0xc7d89071}; natural r395/p2/0xef761753. luau-twins
275/276/278/279 green (Luau matches every new pin).

**FLOOR RULING (architect #1814):** the M2/M3/M4 floor breach at PAT=30 does NOT
block marker-0063. The floors are ADVISORY (A93 added the check; H1b put the
canonical CI lane in continue-on-error REPORT mode until the AI B-lane closes
M2/M3 — still open). Phase-2 is FLOOR-NEUTRAL: the accepted phase-1 PAT=50
breaches M2/M3/M4 near-identically (M4 better at PAT=30), and the elim guardrail
held (median 3.0, PAT 50/30/25 identical) — so the breach is a D3-feature /
AI-quality property, not a phase-2 regression.

**GATE-B + TAG (architect #1814):** option (a) — the bugfixer pushes a phase-2
BRANCH (d3-sweep mechanism, D3 footprint only); sim-runner runs Gate-B (Luau
200/300/400 parity) on it; phase-2 stays OFF dev_night until Gate-B green; then
the architect commits phase-2 to dev_night + tags marker-0063 + writes
reports/marker-0063.md with the expanded-moved-set audit ledger. marker-0063 is
cleared on the floor question; the only remaining gate is Gate-B green.

## 8. Acceptance — the mix-conditional witness (the user's ruling)

Beyond suite-green + JS==Luau, D3 must demonstrate the mix-conditional
behavior — the user's explicit test. Sim-runner produces a small witness
table (`--stats`, a few seeds each):

- **All-aggressive table** (Shaka/Genghis/Caesar-heavy): elimination count
  UP vs the D1 baseline — wars start, capitals fall.
  **RULED (architect #1764):** the measured aggressive table is D1-INVARIANT
  — warmongers' `scorePeaceAccept` is too negative to ever sign a treaty, so
  the declare-to-betray path can't add wars (D3 PAT30 elim median 2.5/36% =
  D1-off 2.5/36%, IDENTICAL, 8 seeds each). §8.1 reads as **"not pacified"**
  and PASSES: "wars start, capitals fall" is met (36% elim, conquest wins);
  strict "UP vs D1" is NOT required of D3 — decisive conquest that CLOSES a
  game is XII.5's job (the victory drive), and opportunistic
  short-treaty-then-betray is DEFERRED to D4. D3 correctly neither pacifies
  nor inflames the warmonger table.
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

## 9. Pre-open calls — ALL RULED (#1679→#1680, 2026-07-18)

1. **Store-2/derive-2** — RULED store-2 (trust+grievance stored as
   directed _lo/_hi; fear+respect derived). §2.
2. **Grievance directionality** — RULED `_lo`/`_hi` on the sorted pair. §2a.
3. **Tribute scope** — RULED DEFER WHOLESALE to D4; D3 is war/peace-only.
   §3/§5 amended (scoreDemandTribute + TRIBUTE_DEMANDED + wD*/demand
   constants struck).
4. **Unit mismatch** — CONFIRMED `countMilitary` is a raw count; a
   ratio-to-100 integer helper (div-guarded, symmetric for weakness/fear)
   scales it, exact formula pinned in code for the sweep. §3.
5. **Contact signal** (the load-bearing gap the author found — D1 has NO
   met-state) — RULED (c) persistent met-state, riding the D1 pair entry
   (`met` bool + FIRST_CONTACT event + `detectContacts` per-turn pass, all
   seats). Chosen over proximity because the space-launch coalition needs
   non-adjacent civs; also pays D2's first-contact debt. §4.

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
- **PROVENANCE LABEL (reviewer #1695):** the wiki dump is Civ1-SILENT on
  diplomacy — there is NO Diplomacy/Senate/Tribute/Reputation (Civ1) page.
  So D3's model is **house/original, labeled Civ1-consistent** (Civ2-informed
  only where a Civ2 page exists), NOT Civ1-authentic. This is expected and
  fine per the civ-mixing ruling — just label it honestly (do not claim
  Civ1-authenticity for the relationship model / score thresholds).
- **Feeds D4** (tribute/tech terms negotiate the demands D3 raises) and
  **D5** (senate reads the war decisions; reputation consequences read the
  relationship values D3 maintains).

## 11. KNOWN GAP — server-surfacing (traced 2026-07-19, roblox-helper #1884; fix queued)

D3 is **invisible over the authoritative (server-filtered) path** — a human playing
browser `?server=1` OR the Roblox client sees NO AI diplomacy. Only local browser play
(raw engine events + full `session.state`) surfaces it today. Root cause:
- The 4 events carry only civId (WAR_DECLARED/PEACE_TREATY_SIGNED/TREATY_BROKEN/
  FIRST_CONTACT — no pid, no coords). `filterEvents` (engine/visibility.js + luau twin)
  has `WORLD_NEWS = {wonderBuilt,wonderLost,gameOver,playerDefeated}` — the diplomacy
  events are NOT in it, and `eventParties()` doesn't resolve civId → so filterEvents
  **drops all 4 for every seat**.
- `filterView` exposes no `state.relations`/reputation; the browser Foreign-relations
  panel reads `session.state` DIRECTLY (full local state), which the server/roblox
  client never has.

FIX (queued to the bugfixer's engine lane, behind XII.5 + 11b — a byte-shaped
engine+luau/visibility twin): (A) `filterEvents` surfaces the 4 events under a fog
policy (WORLD_NEWS-simplest for public war/peace; FIRST_CONTACT maybe party-only) +
(B) `filterView` exposes `state.relations` (+`player.reputation`) per fog so the client
renders met/at-war/at-peace. Likely NO state-hash movement (filtering is downstream of
state) but a twin + visibility/server test updates. The roblox-helper builds the
consumer side (TurnLog narrator + panel) golden-neutral in parallel, ready to light up
when the twin lands. Benefits BOTH platforms (browser-over-server + roblox).

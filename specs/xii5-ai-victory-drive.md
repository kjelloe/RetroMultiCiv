# XII.5 — AI/regency late-game victory drive: design spec (architect, 2026-07-18)

> User refinement (2026-07-18, long-game playtest): "AI on Regency, after a
> while, says 'regent played your turn — nothing to do'. In a long end-game
> the regency should try for a victory condition — space race or conquest —
> including building up an army and attacking the best target (closest civ
> or weakest civ)." DESIGN STAGE: full pre-open opens AFTER D3 (same ai.js
> territory — window discipline), informed by the sim-runner late-game-idle
> measurement (commissioned). Behavioral golden window.

## 0. The measurement (sim-runner #1706 — the gap is confirmed and quantified)

Baseline on the current engine (12 games, 7-civ medium, no chaos; NATURAL =
endYear 2100 and EXTENDED = endYear 9999 / 800-turn cap):

- **NO DECISIVE VICTORY EVER.** NATURAL: 6/6 score-timeout at t396.
  EXTENDED: 6/6 TIMEOUT at t801 — even with the score clock removed and 800
  turns, nobody closes out a win. **0 conquest, 0 space in 12 games.** The
  four-endings vision is currently unrealized; every game ends on the calendar.
- **SPACE is dead at step 0.** Apollo is UNBUILT in 12/12 games, so the whole
  A76 chain (`apolloReady` → `nextSsPart` → launch) never fires. AIs reach the
  winning STATE (space-flight + all part techs) and never act on it. **0/12
  launches.** This is the biggest, cheapest win to unlock — the leader already
  has everything; it just never starts building Apollo.
- **Idle DEEPENS late.** Fraction of a seat's alive turns with zero applied
  commands: 46% (t300-400) → **82% median** (t400+); 18/42 seat-games idle the
  ENTIRE extended band. A teched/built-out AI has no endgame objective.
- **Conquest TAPERS, never closes.** Built-out AIs mostly stop producing
  offensive units late (median 0) and taper attacks; early eliminations happen
  (seed 1: 4/7 dead midgame) but survivors then coexist to the clock — nobody
  finishes off the rivals.

**Where the drive must intervene (ranked by leverage):** (a) SPACE — once a
civ holds space-flight + all part techs, BUILD Apollo → parts → launch (fixing
just this turns every runaway into a space finish); (b) CONQUEST — keep massing
offensive units + pressing surviving rivals late instead of idling; (c) the
idle-turn fraction is the raw symptom — give the built-out AI an endgame goal.

## 1. The gap (root-caused above)

The victory MACHINERY already exists in engine/ai.js:
- **Space:** `apolloReady` (Apollo wonder + all ssPart techs), `nextSsPart`
  (build toward a viable ship), `launchRushTarget`, ship state/launch/arrival
  (A76).
- **Conquest:** `warDoctrineOf`, `nearestKnownEnemyCity`,
  `attackersAdjacentTo` (mass), `assaultOddsOk` (per-unit odds gate).

What is MISSING is the layer that makes a built-out late-game civ (or a
regent playing a human seat) COMMIT to a victory path and DRIVE it. Today,
once the empire is developed (cities founded, improvements done, tech
flowing/exhausted → Future Tech idle) and the civ is not already at war, the
command policy runs out of pressing tasks and returns little/nothing → the
regent narrates "nothing to do." The AI does not, on its own, decide "I will
win by space" or "I will win by conquest" and mobilize for it.

**Measurement first (sim-runner, #commissioned):** quantify the idle in a
marathon (`--natural`/`--marathon`, a few seeds): per-AI command COUNT by
turn-band in the late game (t300+); do AIs build spaceship parts once
apolloReady; do they build/move offensive units; what fraction of late-game
turns produce zero commands per seat; and the victory OUTCOME distribution.
This confirms the "nothing to do" is real late-game passivity (not just a
narration artifact) and sets the baseline the drive must beat.

## 2. Design — a late-game victory-drive layer (personality-selected)

When a civ has no pressing basic task AND the game is "late" (a rules gate —
e.g. turn past a threshold, or the tree exhausted / Apollo-era techs known),
it COMMITS to a victory path and the policy escalates to pursue it. The path
is chosen by PERSONALITY (A59) + position, consistent with the heterogeneous
endings vision:

- **Aggressive personality (or clear military lead) → CONQUEST.** Build
  offensive units (army buildup), pick a TARGET, mass + assault (existing
  machinery). TARGET = the user's heuristic: the **weakest** reachable rival
  (fewest cities / lowest military) OR the **closest** (least march
  distance) — a scored pick, weakest-weighted, closest as the tie/access
  breaker. Repeat: take a city, re-target, drive toward domination.
- **Science / builder / balanced personality (or clear tech lead) → SPACE.**
  Prioritize the Apollo wonder → the ssPart techs → build parts (`nextSsPart`)
  → launch → then DEFEND the capital until arrival (pairs with D3's
  space-launch coalition: once launched, everyone else declares — so the
  launcher must garrison the capital). Escalate build priority to spaceship
  parts once `apolloReady`.
- **Defensive personality:** holds the chokepoint line (docs/15) but STILL
  picks a win path when built out (usually space if peaceful, or conquest of
  the one weak neighbor) — a defensive civ should not idle to a timeout loss.

Fallback rule (the direct "nothing to do" fix): **in the late game, if a
seat would otherwise idle, it MUST fall through to its victory drive** —
never emit an empty turn when a victory path is available.

## 3. The regent inherits this for free

The regent plays a human seat via the SAME shared policy (regency runs
`pickCommand`/`runAiTurn` for the seat — B11). Every human civ has a
leader/personality now (A59), so a regent taking over the Roman seat plays
Caesar's aggressive → conquest; a regent on a builder civ races to space.
No regent-specific code — the victory drive lands in the shared AI and the
regent gets it. The "nothing to do" narration becomes "🤖 regent built
toward the spaceship / massed an army on <city>". (Confirm the regent
narration surfaces the victory actions — turnlog byType already exists.)

## 4. Relationship to D3 and scope fence

- **D3 (SHIPPED, marker-0064)** owns the DIPLOMATIC decision (declare war / offer peace /
  the space-launch coalition intent). XII.5 owns the **victory PURSUIT +
  offensive EXECUTION** — the army buildup, target selection, the space
  commit + part prioritization. They compose: D3 decides *whether at war*;
  XII.5 decides *how to WIN* (and, for conquest, mobilizes to make the war
  decisive). Build XII.5 ON TOP of D3 (after it lands) so the war it wages is
  the war D3 declared.
- **Inherited from D3's §8.1 ruling (#1764):** D3 is D1-invariant on the
  all-aggressive table — warmongers never sign a treaty, so D3 neither
  pacifies nor makes their wars more decisive (elim 2.5/36% = D1). Making the
  aggressor's war actually CLOSE OUT a game (domination) is XII.5's charge,
  not D3's. If a stronger aggressor signal than "not pacified" is ever wanted,
  the candidate mechanism is opportunistic short-treaty-then-betray — parked
  here / to D4, explicitly OUT of D3 scope.
- NOT in XII.5: new victory CONDITIONS (the win checks exist — score/
  conquest/space); new units; diplomacy (D3). XII.5 is AI POLICY only.

## 5. Golden classification

Behavioral (changes late-game AI command streams) → soak/natural/marathon
re-record + the standard rulesetHash ripple if any `rules.json` gate is
added (late-game threshold, target-scoring weights — data-driven, never
hardcoded). Two-phase close: byte-shape JS==Luau → sim-runner sweep (the
victory-outcome + elim-band + "no idle turns late" witnesses) → ONE
re-record. Likely MOVES the natural/marathon goldens meaningfully (that's
the point — more decisive endgames). VERIFY the early/mid game is unchanged
(the drive gates on "late" — a crafted/short scenario must be byte-identical).

## 5b. Acceptance — the baseline to beat (sim-runner #1706)

XII.5 is measured against the #1706 baseline, re-run identically post-change:

| metric | baseline | XII.5 target |
| --- | --- | --- |
| decisive victories (space or conquest) | 0% (12/12 timeout) | materially > 0 |
| space launches | 0 / 12 games | leader builds Apollo + launches once eligible |
| deep-endgame idle (t400+, median) | 82% | lower |
| late offensive-unit builds (median/seat) | 0 | higher for civs pursuing conquest |

The PRIMARY, cheapest intervention is the space chain: **"an eligible leader
(space-flight + all part techs known) builds Apollo, then parts, then
launches."** That one change alone should convert runaway games into space
finishes and is the first thing to land + measure. Conquest (keep massing) and
the idle-fraction reduction follow.

## 5c. Consequence for D3 — its space-launch coalition is currently DORMANT

Because 0/12 games ever launch, **D3's space-launch coalition trigger
(`launchThreat`/`wLaunch`) never fires organically in the soak** — D3's §8
"a space launch flips a peaceful table to war" witness CANNOT be shown with
organic play today. So: (1) the D3 sweep's space-launch witness must use a
CRAFTED launched-ship state (not an organic soak), and (2) XII.5 is what makes
the coalition real in ordinary games — once XII.5 lands and leaders actually
launch, D3's coalition fires for the first time in normal play. Flagged to the
bugfixer for the D3 §8 witness; note it composes: XII.5 launches, D3 swarms.

## 6. Provenance

Pursuing space or conquest to actually WIN, and the weakest/closest targeting
heuristic, are the USER's ruling (2026-07-18). This is the execution vehicle
for the four-endings vision (memory ai-archetype-endings-vision) and composes
with A59 (personality → path), N9b (wonder/Apollo build drive), docs/15 (the
war/chokepoint doctrine), and D3 (war declaration + space-launch coalition).
Diplomacy specifics remain house/original (reviewer #1695); the space/
conquest victory conditions themselves are Civ1-authentic.

## 7. Pre-open RULED + first slice (opened 2026-07-19, D3 having shipped)

Opened after D3 (marker-0064) freed the engine lane. The bugfixer's pre-open found
the root cause of the 0/12-launch baseline and asked two calls; both RULED (#1867):

- **F1 (root cause):** `apolloReady()` only checks Apollo ALREADY built — nobody ever
  builds it. Eligibility-to-START = space-flight + all ssPart techs + Apollo unbuilt →
  the civ must FORCE Apollo as its top wonder, then the existing `nextSsPart`/launch
  chain fires.
- **F2:** the ssPart build (ai.js) was gated `S.defendFirst===true` = builder-only, and
  wonder-pick is cheapest-available → science/balanced never build Apollo/parts even
  when eligible. XII.5 extends the part-build to all committed civs + forces Apollo top.
- **Q1 — the "late" gate → RULED eligibility-only** (no separate turn threshold).
  Eligibility (end-tier techs) self-gates to the endgame AND keeps early/mid
  BYTE-IDENTICAL by construction (no eligible civ exists early → zero behavior change →
  §5 golden-neutral-for-non-late guard satisfied automatically). Verify a crafted/short
  scenario is byte-identical.
- **Q2 — first-slice personalities → RULED** science/builder/balanced/defensive COMMIT
  to space; **aggressive UNCHANGED this slice** (conquest is a LATER, separate slice —
  keep this window bounded to the space drive). New `rules.json victoryDrive` gate is
  data-driven/sweepable (never hardcode the personality set or weights).
- **FIRST SLICE = the SPACE DRIVE only** (§5b primary, cheapest highest-leverage):
  eligible leader builds Apollo → ssParts → launch → garrison capital. Conquest
  (aggressive → mass/assault weakest-closest) is deferred to a follow-on slice.
- Process: byte-shape JS==Luau → sim-runner sweep (#1706 witnesses) → ONE re-record.

## 8.1 Witness 1 result + current hold (2026-07-20)

Sim-runner witness (#1898, branch b7d09db vs #1706 baseline): apolloReady 4/49
seat-games (was 0/42), 11 ss-parts across 3 seats (was 0), launches 0 (1200t
cap), decisive victories 0. M2/M3/M4 floors byte-identical to the pre-drive
parent (zero economic regression; the floor breach is pre-existing dev_night
state). Idle-collapse post-t400 is dominated by D3, not this slice. §5b is
HALF-met: builds-Apollo YES, launches NO — the wall is the 600-shield Apollo
build (~t800 start), not eligibility (~t750).

**User ruling: MEASURE FIRST (#1897).** A 1800t diagnostic probe distinguishes
"chain closes late" (authentic late outcome → likely accept core fix) from
"chain never closes" (structural bug → fix before marker). Bugfixer's rush-buy
WIP is SHELVED (#1901/#1902) — it rushed Apollo itself, ruled out below. No
marker until probe + user ruling.

## 9. Apollo-acceleration lever authenticity (2026-07-20 ruling context)

Slice-1 measurement: AI now BUILDS Apollo (0/42 baseline → built) but does not
LAUNCH within a 1200t cap — eligibility ~t750, Apollo 600-shield build ~t800, parts
don't finish by t1200. Before proposing an accelerant, the authentic Civ-1 levers:

- **Spaceship PARTS** — gold-rushable. `rules.json buyGoldPerShieldSS: 8` already
  exists; a legit AI tuning knob for the post-Apollo parts.
- **Apollo itself is a WONDER** — Civ 1 wonders CANNOT be gold-rushed. The authentic
  1991 accelerant was caravans (start a building, switch to the wonder eating the
  shield-loss, then disband caravans into the shield box). That mechanic EXISTS here
  (`engine/cities.js` `helpWonder`, A83, `units.json helpsWonder`) but is **Human-only
  by design**: the AI never fields caravans, keeping the sim goldens untouched
  (`cities.js:438`, `tech.js:92`).

Therefore an **Apollo gold-rush is off the table** (inauthentic AND not how the engine
models it). The Apollo 600-shield build is the real wall, and the only authentic way to
speed it for the AI is to teach the AI to field-and-disband caravans for its own
wonders — a **behavioral** slice that MOVES goldens, not a tuning knob. Decision path
gated on the 1800t diagnostic probe (#1897): chain-closes-late → accept as authentic
late outcome; Apollo-build-is-the-wall → either accept late, or a dedicated AI-caravan
slice. No marker until the probe + user ruling.

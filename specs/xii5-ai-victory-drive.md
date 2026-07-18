# XII.5 — AI/regency late-game victory drive: design spec (architect, 2026-07-18)

> User refinement (2026-07-18, long-game playtest): "AI on Regency, after a
> while, says 'regent played your turn — nothing to do'. In a long end-game
> the regency should try for a victory condition — space race or conquest —
> including building up an army and attacking the best target (closest civ
> or weakest civ)." DESIGN STAGE: full pre-open opens AFTER D3 (same ai.js
> territory — window discipline), informed by the sim-runner late-game-idle
> measurement (commissioned). Behavioral golden window.

## 1. The gap (diagnosed, not assumed-final — measurement pending)

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

- **D3 (in build)** owns the DIPLOMATIC decision (declare war / offer peace /
  the space-launch coalition intent). XII.5 owns the **victory PURSUIT +
  offensive EXECUTION** — the army buildup, target selection, the space
  commit + part prioritization. They compose: D3 decides *whether at war*;
  XII.5 decides *how to WIN* (and, for conquest, mobilizes to make the war
  decisive). Build XII.5 ON TOP of D3 (after it lands) so the war it wages is
  the war D3 declared.
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

## 6. Provenance

Pursuing space or conquest to actually WIN, and the weakest/closest targeting
heuristic, are the USER's ruling (2026-07-18). This is the execution vehicle
for the four-endings vision (memory ai-archetype-endings-vision) and composes
with A59 (personality → path), N9b (wonder/Apollo build drive), docs/15 (the
war/chokepoint doctrine), and D3 (war declaration + space-launch coalition).
Diplomacy specifics remain house/original (reviewer #1695); the space/
conquest victory conditions themselves are Civ1-authentic.

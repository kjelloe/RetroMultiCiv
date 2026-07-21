# marker-0072 — §14 treasury + the XIV client wave (MERGE-CONSISTENT)

Tagged at `a07c073` (2026-07-21, user-away window). **MERGE-CONSISTENT —
supersedes 0071.**

## Gate deviation, documented up front

Second green came via the 0071-precedent FALLBACK, not a sim-runner Gate-B:
the sim-runner session sat inert 95 minutes through five routed items (its
board line is pre-§14). Fallback composition: reviewer clean-clone GREEN
(#2035 — 670/667/0, luau-400 0xb67c18e7, all four declared checks incl. the
rushBuy units-only guardrail) sha-transfer-attested to the rebased commit
(#2040, "entire game-code/ruleset byte-identical"); author verification
(luau-twins 9/9 bit-exact, ai.test 29/29, clean drift); architect landing
suites (54/54 + front-page 35/35). The reviewer itself endorsed this as a
solid second green. A real Gate-B re-run on this tag is WELCOME when the
sim-runner session wakes; any discrepancy would be treated as a new finding.

## Delta since 0071

### Engine (window 2/3): §14 treasury + two playtest riders (`7837ee9`)
- SURPLUS RUSH-BUY: a non-threatened city's CURRENT unit production
  (settler/army) is bought out when gold > aiSurplusBuyThreshold (1000,
  sim-sweepable) — one buy/turn, cityOrder-deterministic; UNITS ONLY
  (kind=='unit' guardrail: never wonders/buildings/ss-parts — #1899 holds
  and XII.5b's parts-rush stays cleanly separated). Addresses the
  100,103-gold hoard finding.
- F1: diplomacy offer REJECTION-COOLDOWN (offerCooldown=10 turns,
  entry.offerRejectedTurn) — kills the 200-turn peace-offer spam from the
  user's Studio run (#2011).
- F2: a move rejected with reason zoc 3 consecutive times is DROPPED and
  the unit re-plans (unit.zocBlocks, integer, cleared on success).
- Full golden re-record; luau twins (ai x4 + diplomacy x1) bit-exact.

### Client (helper, 11 items, golden-neutral)
Server-default redirect + ?local=1; endscreen fog-guard; in-client bug
report; regency gameOver guards + 1s/round pacing; mobile Save/Load;
E-hint unify; FOOD-TRUTH (inline settler-eaters row + home-city display +
⚠ stalled note — the Teotihuacan fix); civ-shuffle bias fix (xorshift via
NEW shared/civ-shuffle.js + distribution test); hud-polish (minimap
position, endscreen reopen, tech-tree button, top-bar rates+government);
terrain-flatten §29 FIRST CANDIDATE (flats de-jittered, hills 20% vs
mountains 80% — awaiting the desaturation review); front-page (root →
?server=1, ally's "New here?" hint overlay verbatim, Find-game master
browser, report-issue footer). One stale assertion (old A22 root target)
updated to the ruled behavior by the architect at landing.

### Also under the tag
Specs: XII.5b (GO), R6 roblox multiplayer, D4–D6 impl, ally diplomacy
verdicts, unit-truth corrections, XIV batches 3–5 (§39–§50). Plans: roblox
T1/T2/T3 flips per module audits #2020/#2028. Reports 0071.

## Test state
Reviewer clean clone 670/667/0 (attested); architect local: affected
suites green (54/54 engine-lane + 35/35 server), tree clean at tag.

## For agents
§14 locks release at this tag; the XII.5b window (full ally design) opens
at the bugfixer. Roblox consolidated manifest #2037 + MP4 stance dialog
remain parked on the sim-runner session waking (gaming-PC git operator).

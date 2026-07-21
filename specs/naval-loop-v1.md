# Naval loop v1 (user-ruled 2026-07-21: FULL loop, option a — spec of record)

Probe #2090 verdict: the AI builds zero sea units; the loop is fully open.
User ruling: full docs/05 loop in v1. Three clarifications ruled:
1. SCOPE: the five steps (exploration → transport → landing → overseas
   settlement → overseas invasion) + BASIC ESCORT — transports get a
   warship escort-accompany when available (the §12 accompany pattern at
   sea). Ship-vs-ship stays opportunistic (existing combat picks); sea
   control/blockade doctrine joins the 2.0 conquest slice.
2. INVASION GATE: war-committed civs only — aggressive-stance, plus any
   civ already AT WAR with an overseas neighbor; the docs/15 3:1 rule
   applies to the landing force composition. Peaceful civs settle
   overseas but never invade.
3. SEQUENCE: after naval-truth (the AI learns to sail under FINAL naval
   visibility rules — sub invisibility/sight land first); difficulty
   slides one slot. Biggest window since XII.5b (~1-2 sessions), so
   pre-open + impl-confirm is mandatory and the fixture set should
   include a two-continent crafted map.

Engine notes for the pre-open (grounding starters, bugfixer verifies):
- Transport capacity/loading exists (movement.js aboard machinery, A69) —
  the AI never USES it; this is behavior, not mechanics.
- bestCitySite already scans far sites; the gap is crossing water to
  reach them (transport pathing + embark/disembark decisions).
- Escort seam: nearestUnguardedSettler extends to sea legs.
- Witness: extend the probe #2090 harness into the acceptance metric —
  on 2-continent seeds, leaders found overseas cities > 0; on archipelago
  (A82), median cities within reasonable range of continents-map median
  (exact threshold set at pre-open from probe data).

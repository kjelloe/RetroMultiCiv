# marker-0075 — §40 settler pop-cost + size-1 disband (MERGE-CONSISTENT)

Tagged at `ff6b113` (2026-07-21). **MERGE-CONSISTENT — supersedes 0074;
the new merge candidate.**

## What changed

The missing Civ 1 rule restored: completing a settler deducts 1 population
(data-driven `popCost:1` in units.json, generic for any unit); a size-1
city completing one DISBANDS — the city becomes the settler. `disbandCity`:
city removed hash-safely, homed units go homeless (home-deleted, no-null
rule), a wonder in the city is DESTROYED permanently (raze precedent,
wonderActive → false), a last-city disband routes through the existing
elimination path. The AI gates settler production at pop > popCost so it
never self-disbands; humans stay unrestricted (deliberate disband-into-
settler is legal Civ 1 play — the client pre-warn is the helper's follow-up).
Fixture-first: scenario 046 RED before the fix; full re-record, JS==Luau
byte-exact; suite 681/681.

## The measured consequence (expected, documented, ruled)

The authentic expansion brake ~halves AI city counts: advisory floors
M2/M3/M4 drop back from the §12 highs (20→5 / 105→23.5 / 75→50) while all
ENFORCED floors hold and natural games still resolve (545/p2 unchanged).
Ruling #2061: authenticity wins — this is the metric measuring a rule
change, not a regression. The §12 M2/M3 ratchet is canceled; sim-runner's
queue item is repurposed to a post-§40 25-seed RE-BASELINE; whether ~5
median cities is the right authentic feel (vs a settler-timing sweep,
e.g. build-at-pop-3) is the baseline's first question — measured, later.

## Gates

Reviewer clean-clone + engine-diff GREEN (#2062): 678/675/0, luau-400
0x7b901e23, all five checks pass including the wonder-hash-safe removal;
the floor reversal gated as expected-and-documented. Gate-B: the
documented fallback (sim-runner inert; author byte-exact self-witness +
architect landing 64/64). Re-runs invited on tags 0072–0075.

## For agents

Next engine item: §50 city-as-road. Helper follow-up now unblocked: the
§40 client warn (size-1 settler queue warning + build-panel badge).

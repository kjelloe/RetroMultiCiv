# N10 / A89 — Caravan trade routes: buildable spec (architect, 2026-07-18)

Resolves the six pre-open questions (#1379) on top of the A89 workitems
design (agent-workitems.md, wiki-verified formulas). A89's text remains
the base; where this spec speaks, it wins. Ruleset-touching → this is a
GOLDEN WINDOW: reviewer pre-design check gates the open.

## Rulings

1. **Same-continent = land-connected (option b).** "Same continent" is
   decided AT ESTABLISH TIME as: the two city tiles are connected over
   land (non-ocean terrain) via 8-way adjacency, wrapX-aware, through
   the existing `neighbors` helper. Pure function, no stored state, no
   per-tile continent id. Determinism note for the twins: the reachable
   SET is traversal-order-independent — only the boolean leaves the
   function, so BFS queue order need not match across engines (but keep
   the code byte-shaped anyway per twin fidelity). Cost: one bounded
   flood fill per establish command (map-area worst case, command-time
   only, never per-turn). The windfall stores nothing; the PERMANENT
   bonus does not use continent at all (same-civ ×½ only, per A89 —
   so no recompute ever needs the fill again).
2. **distance = chebyshev** between the two city tiles, wrapX-aware —
   the game's standard metric. Confirmed.
3. **tradeArrows(city) = the post-corruption, pre-split city trade
   total** — the value the engine already computes and then splits into
   tax/sci/lux. Rationale: it is the city's EFFECTIVE trade (corruption
   already applied, government bonuses already applied — Republic
   trade feeds routes automatically), and it reuses an existing seam
   instead of introducing a second trade quantity. Label: Civ1-
   consistent interpretation (the wiki formula does not disambiguate).
4. **Command shape: `establishTradeRoute { unitId }`** — explicit
   command for BOTH foreign and domestic (A83 helpWonder precedent:
   command over auto-on-enter, replay-clean). Both endpoints DERIVED:
   partner = the city on the unit's tile, home = the unit's home city.
   No partnerCityId param (one less mismatch branch; symmetric with
   helpWonder). Caravan consumed on success. Rejections (shape per
   A83's four): `notCaravan` (no tradeRoutes capability), `cityRequired`
   (not standing in a city), `noHomeCity`, `ownCityTooClose` (domestic
   partner nearer than rules minimum), `sameCity` (partner == home),
   `duplicateRoute` (home already routes to this partner). Domestic
   "choice" is a CLIENT concern: the client offers the button when
   legal; the engine only judges legality.
5. **3-route cap ranking:** per-route permanent contribution
   `idiv(arrowsA + arrowsB + 4, 8)` (same-civ ×½ applied) recomputed
   live; the top 3 count toward the home city's arrows; ties broken by
   LOWER partnerCityId (determinism). Extras beyond 3 still paid their
   windfall and REMAIN in state (they may re-enter the top 3 as cities
   grow/shrink).
6. **Golden footprint — confirmed as budgeted:** new `rules.json`
   `tradeRoute` block (minDomesticDistance 10, windfallDivisor 24,
   permanentDivisor 8, permanentPad 4, routeCap 3, the ×½/×⅔
   multiplier numerators/denominators — ALL numbers in data, none in
   engine logic) → rulesetHash moves → A82a map-type anchors +
   scenario 002 re-record per standing doctrine. AI fields no caravans
   → soak/natural/turn-100 goldens UNCHANGED (A83 precedent; verify,
   don't assume). Scenario pins: domestic-choice, foreign-auto,
   windfall-math (multiplier stack incl. the 1/9 floor case), and
   3-route-cap.

## Windfall composition (pre-empting the next ambiguity)

Per A89's wiki paraphrase the one-time windfall pays the computed
amount to the sender as CASH **and** as RESEARCH BULBS — the FULL
amount EACH (not split). Multipliers per A89: ×½ same continent
(ruling 1), ×½ same civ, ×⅔ sender-knows-railroad, ×⅔
sender-knows-flight, integer math throughout (idiv, applied in that
fixed order — order matters under integer division; pin it in the
windfall-math scenario).

## State shape

`city.tradeRoutes = [{ partnerCityId }]` (A89: live recompute keeps
state lean — no cached arrows, no continent flag). Integers only,
statehash-safe. Dead partner cities: prune the route when the partner
city ceases to exist (capture keeps the city id → route survives
capture and becomes a foreign route; only DESTRUCTION prunes).

## Tests

Fixture-first per house rules; the four scenario pins above,
cross-language; unit tests for the flood fill (same-landmass true,
cross-ocean false, wrapX seam case) and the ranking tiebreak; A82a/002
re-record with the new rulesetHash; suite + twins green both engines.

## Provenance

Formulas Civ1-authentic (wiki-verified 2026-07-16, A89). Ruling 3's
arrow definition and ruling 1's connectivity mechanism are labeled
Civ1-consistent interpretations. The +1 food/shield delivery stays on
the Civ2-rules-mode shelf (user-ruled, A89).

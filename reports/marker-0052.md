# marker-0052 — N10/A89 caravan trade routes

## What it delivers

The caravan's second role (A83 gave it wonder-help): trade routes,
Civ1-authentic formulas wiki-verified twice (A89 2026-07-16 + reviewer
#1392, which proved the multiplier stack multiplicative using the
article's own 1/9 arithmetic). A caravan standing in a city opens a
route from its HOME city: a one-time windfall (cash AND research
bulbs, the computed amount each — Civ1-consistent label, the wiki
quantifies cash only) times the multiplier stack (½ same-continent,
½ same-civ, ⅔ railroad, ⅔ flight, fixed integer order, pinned at the
1/9 floor case 25→12→6→4→2), plus a LIVE permanent trade bonus on the
home city — top-3 routes by contribution, ties broken low-id, routes
past the cap persist and can re-enter as cities grow.

## The R1 pin (the pre-design catch that mattered)

The reviewer's required pin: both formulas read BASE arrows —
post-corruption, pre-split, EXCLUDING route contributions — at both
endpoints; bonuses add on top at the singular playerIncome seam.
Without it, city A's bonus would feed city B's recompute: an
evaluation-order-dependent fixpoint, a determinism/twins hazard.
Scenario 034 pins that the exclusion BITES: a route-holding endpoint
under the wrong (base+own-routes) reading flips a contribution 2→3
and moves the hash.

## Engine shape

NEW engine/trade.js + luau/trade.luau (byte-shaped): the command with
six rejection reasons, the windfall, the live routeArrows ranking, and
same-continent = land-connectivity at establish time (iterative 8-way
flood fill, wrapX-aware, plain-object visited — no stored continent
state, no recursion; the boolean is traversal-order-independent).
tech.js adds the route bonus post-corruption; index.js dispatches;
the tradeRouteEstablished event flows through the event catalog to
both classifiers (own-seat 🐫 turnlog line; sound reuses 'build').
All numbers in rules.json tradeRoute; the caravan gains
tradeRoutes:true via the mapdata UNIT_OVERLAY (units.json regenerated,
only that flag changed).

## Two window findings (verify-don't-assume)

1. **Full golden ripple, not the predicted limited one.** The spec
   forecast soak/natural/turn-100 unchanged on the A83 precedent — but
   A83 predates the marker-0045 ruleset pin. Post-pin, any rules/units
   change shifts rulesetHash at createGame and therefore EVERY
   createGame golden. Verified honest: soak 100/200/300/400 →
   0x99243498/0x5482a4b6/0xcdb6fbc7/0x714ff409, natural 0x834d3094,
   A82a anchors + scenario 002 + witness re-recorded, JS==Luau on all
   — with rounds and winner UNCHANGED, i.e. a hash-stamp shift only,
   AI behavior identical (AI fields no caravans).
2. **Lux stays decoupled (ratified deviation).** The route bonus lands
   at the playerIncome (tax/sci) seam; luxuries compute from raw tile
   trade and were already a documented corruption-free deviation.
   Extending routes into lux would grow the happiness hash surface for
   no measured need; Civ1's arrows nominally feed all three, so this
   is a labeled simplification with a small happiness.js follow-up
   available if ever wanted.

## Tests and pins

Scenarios 031 foreign-auto 0x1177ecd9, 032 domestic-choice
0xa45cf999, 033 windfall-math 0x9a2347cd, 034 cap+R1 0xd33e4852
(PORTED count 33); test/trade.test.js 6 rows (flood fill
same-landmass / cross-ocean / wrapX seam / island, cap ranking,
dead-partner prune). Both data checksums re-pinned. Full suite
523/523 at the marker; count pins re-synced 512→523 at this boundary.

## Client half (pre-landed at 0c5a70d, golden-neutral)

The helper's draft-live inert layer activates automatically with this
marker: establish-route button/key Y with the legality mirror, six
REASON_TEXT rows, the 🐫 windfall line, city-panel route display. Its
tradeRouteReport probe stays gracefully unfound (routeArrows exports a
scalar); a thin per-route report export is a golden-neutral rider for
a future engine touch if the panel wants arrow numbers.

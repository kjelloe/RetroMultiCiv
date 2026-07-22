# D4–D6 — diplomacy implementation spec (architect draft, 2026-07-21)

Assembles: docs/14 slice definitions · fact-packs #1691 (tribute) + #1957
(D4/D5/D6 rules: mission formulas, senate, costs) · the ally presentation
verdicts (`ally-design-response-2026-07-21-diplomacy.md` — five-beat
audience, cracked-seal reputation, warn-then-refuse senate, pending-envoy
lifecycle, vocabulary table) · unit-truth §3 (diplomat missions ride D6).
Provenance: `Civ1-authentic` mechanics, `original` presentation.
All three slices: engine lane, golden-affecting, JS+Luau twins, one window
+ marker each, two-gate pattern. Sequenced AFTER the current engine queue
unless the user re-prioritizes.

## D4 — tribute + tech exchange + human LAN treaties

ENGINE
- Extend the D3 offer object: `{ kind: 'peace'|'tribute'|'techExchange',
  from, to, terms: { gold?, techId?, wantTechId? }, offeredTurn,
  expiresTurn }` — all integer/string, hash-safe. expiresTurn = offered +
  2 recipient turns (ally ruling; rules.json knob offerExpiryTurns=2).
- AI tribute DEMAND decision per fact-pack #1691 (strength-ratio gated,
  war-threat backed); AI acceptance valuation per #1957 formulas; all
  thresholds rules.json knobs, sim-swept.
- Tech exchange = Civ1-shape one-way-or-swap per the pack (no research
  points, whole techs only); wonders/gold mixing OUT (v2 negotiation
  layer).
- HUMAN offers (LAN): a seat command `offer{...}` validated server-side;
  pending offers live in state (replay-clean); the recipient's client
  surfaces the audience at turn start; withdraw command; expiry sweep at
  turn wrap emits OFFER_EXPIRED (neutral wording per ally).
- Rejection cooldown (§14's offerCooldown) applies to AI re-offers of ALL
  kinds, not just peace.

CLIENT (helper, golden-neutral, after engine lands)
- The §33 envoy modal grows the terms/consequences beats (five-beat frame);
  pending-envoy badge + View/Withdraw; vocabulary table verbatim.

ACCEPTANCE: one full human↔human LAN negotiation (offer → pending → accept)
replays hash-exact; AI demands tribute only under the pack's conditions;
expiry works and reads neutrally; no offer ever silently disappears.

## D5 — reputation + senate

ENGINE
- `state.reputation[civId]` integer (0..4 → Honorable..Treacherous band
  mapping in rules.json; bands are DERIVED for display, integer stored).
  Events that move it: treaty broken (biggest hit, per pack), sneak attack
  during peace, [recovery: +1 band after N consecutive treaty-kept turns if
  the pack supports it — else no recovery in 1.0, flag to user].
- Reputation feeds AI acceptance valuation (a Dishonored civ's offers are
  discounted) — knob-weighted.
- SENATE (Republic/Democracy): on a human/AI war declaration against a civ
  with an active peace treaty, the senate check per #1957's trigger rules;
  refusal BLOCKS the declaration (command returns senateRefused — a
  first-class reject reason, not an error). Deterministic (state-derived,
  no roll unless the pack documents odds — if odds, engine RNG).
- Events: REPUTATION_SHIFT, SENATE_REFUSED, TREATY_BROKEN already exists.

CLIENT
- Relations panel three-layer row (status chip / cracked-seal badge /
  history line + expandable timeline — event-backed, the acceptance-test
  answers verbatim). Break-treaty blocking confirm BEFORE the act; senate
  pre-warning modal + dignified refusal proclamation (no retry button).
  Historian: landmark judgments only (ally's four triggers).

ACCEPTANCE: docs/14's test — "at war with whom, since when, why" readable
at any moment; one betrayal with visible consequences; one senate refusal
that lands as institutional, not buggy.

## D6 — embassies + intel + diplomat missions

ENGINE
- Embassy: established by a Diplomat entering a rival capital (consumed);
  `state.embassies[civId][rivalCivId] = turn`. Grants: rival's government,
  gold, tech count, capital location in filterView (the fog-refinement
  hook noted in D3-surfacing lands HERE).
- Missions (unit-truth §3, costs/formulas per #1957): investigate city
  (view a city panel snapshot), steal tech (once per city — city-flag),
  industrial sabotage (halve shields box), incite revolt (city flips at
  the pack's gold cost — the big one), bribe unit. Consumed-on-use;
  deterministic where the pack says Civ1 was; engine RNG where odds are
  documented.
- freeSupport flag interplay: diplomat upkeep exemption ships in
  air-truth riders (already queued) — D6 assumes it.

CLIENT: mission menu on a Diplomat adjacent-to/inside rival tiles; results
as event cards; discovered-sabotage grievance feeds D5 reputation.

ACCEPTANCE: each mission once in a scenario pin; embassy intel visibly
richer than fog; an incite-revolt replays hash-exact.

## Open items — ALL RESOLVED (reviewer #2066, 2026-07-21)

1. Reputation RECOVERY: RECOVERABLE, not permanent — and a PROVENANCE note:
   Civ 1 has NO reputation system at all, so D5's reputation is a
   `Civ2-informed/house` labeled mix (consistent with docs/14's design
   intent; label it so in data and pedia).
2. Senate refusal: DETERMINISTIC (cited: Republic/Democracy "must accept
   all peace treaties") — no roll, no RNG.
3. Diplomat missions: 2 of 7 ROLL (steal-tech, sabotage — engine RNG,
   replay-deterministic); the other 5 are CERTAIN.
D4–D6 are now design-complete end to end: rules (packs), presentation
(ally verdicts), engine mapping (this spec). Build-ready when the engine
queue arrives.

## United Nations wonder effect (A7 deferral, ruled #2243/#2247 — 2026-07-22)

The one wonder effect NOT built in the A7 window lands HERE: United
Nations = "rivals more willing to negotiate/peace". Its authentic home
is the D5 reputation/senate layer — encode it as a structured modifier
on the peace-accept/audience-grant path (e.g. a peaceAcceptBonus or
always-grants-audience flag on the owner), NOT a free-text effect.
Author the field in WONDER_OVERLAY (tools/mapdata.js) like the A7
batch; wire it in the D5 slice; witness = a crafted accept-threshold
scenario. wonders.json currently carries effect {} for it by design.

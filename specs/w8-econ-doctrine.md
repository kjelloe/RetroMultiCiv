# W8 — the econ pair: offensive diplomat + caravan doctrine (design contract)

The LAST engine window before RC. Promoted to v1 by user ruling 2026-07-27
(`specs/unit-doctrine-v1x.md` scope note 2). **AI BRAIN ONLY** — every mechanic
this window drives already ships:

| doctrine wants | existing mechanic | entry point |
|---|---|---|
| steal tech, weaken a target | D6 diplomat missions | `engine/diplomat-missions.js` (`stealTech`, `sabotage`, `inciteRevolt`) |
| speed a wonder | caravan wonder-help | `cities.helpWonder` |
| grow the peace economy | A89/N10 trade routes | `trade.establishTradeRoute` |

So W8 adds no mechanics and no new commands — it teaches `engine/ai.js` to
BUILD these units and ISSUE those commands. One behavioral golden window, plus
a stamp if the knobs land in `data/rules.json` (they do).

Explicitly OUT (stays v1.x): the DEFENSIVE diplomat half (garrisoned
counter-espionage) — a Civ 2 mechanic (#2798) needing its own civ-mixing
adoption decision; and nukes, pending the marathon lane.

## Slice W8a — offensive diplomat doctrine

**Build contract.** A city builds a diplomat when ALL hold:
1. the owner knows the diplomat's tech (`writing`) and has no diplomat already
   in flight beyond `maxInFlight` (one intent at a time keeps the doctrine from
   flooding — same one-in-flight shape as the wonder appetite in W6 slice-5);
2. the city's defenders are at or above the `garrisonNeed` floor (W6 slice-4's
   single formula — a doctrine that strips garrisons is a bug, the slice-1a
   lesson);
3. the city can pay for it in reasonable time (`minShields`), so the doctrine
   rides production cities rather than starving frontier ones;
4. and there is an INTENT (below). No intent ⇒ no diplomat. The failure mode to
   avoid is idle diplomats wandering the map, which is what "build when you can"
   produces.

**Intent A — steal (tech lag).** The owner is behind the most advanced KNOWN
rival by at least `techLagMin` advances. Fog-honest: only rivals whose tech
count the viewer legitimately knows (embassy, or the same knowledge the AI
already uses for its research decisions) count — never an omniscient scan.
Target preference, per the user's doctrine ("nothing to lose"): among reachable
rival cities, prefer an owner whose reputation toward me is ALREADY bad, then
the nearest.

**Intent B — assault prep.** A war target city is already being massed against
(the W6 slice-3 siege state) within `prepRadius`. The diplomat weakens it
before the assault lands: `sabotage` when the city has buildings to destroy,
otherwise `inciteRevolt` when the treasury can actually pay — never an
unaffordable mission (a rejected command is a wasted turn).

**Unit brain.** A diplomat moves toward its intent's target city (fog-honest,
`isExplored`), and when adjacent issues the mission. Determinism: target
selection scans in `sortIds` order with strictly-greater comparisons keeping
the earliest, exactly like `pickTopRole`/`wonderHostCity`.

Knobs (`rules.diplomatDoctrine`): `techLagMin`, `minShields`, `maxInFlight`,
`prepRadius`. Absent knobs ⇒ the doctrine is inert and the engine reproduces
today's behavior exactly (the W6 omit-safe pattern).

## Slice W8b — caravan doctrine

**Wonder-help chain (the classic caravan chain).** While one of the owner's
cities is building a wonder, OTHER cities build caravans once they have their
garrison floor AND their role-tier buildings (W6 slice-3's `roleTierBuilding`
ordering — a caravan must never outrank a temple in a disorderly city). The
caravan walks to the wonder city and issues `helpWonder`. Bounded by
`wonderHelpMaxDistance`, so a caravan never crosses the empire for a marginal
contribution, and by `maxInFlight` per wonder.

**Peace economy.** When the owner is at peace with every known rival, a city
with surplus production builds a caravan to establish a trade route to the best
partner (`trade.routeContribution` decides "best", so the AI and the human
share one definition of a good route). At war, the war doctrine outranks this
entirely — the peace economy is a peace dividend, not a standing habit.

Knobs (`rules.caravanDoctrine`): `minShields`, `maxInFlight`,
`wonderHelpMaxDistance`, `peaceRouteMinTrade`. Omit-safe as above.

## Verification

Fixture-FIRST, at the `pickCommand` level (the `test/siege-air.test.js`
pattern): crafted states that assert the BUILD choice and the ISSUED command,
not internals. Ten contracts:

1. tech-lagging production city with a garrison builds a diplomat;
2. no diplomat when defenders are below the floor;
3. no diplomat when the owner is not lagging (no intent);
4. a diplomat adjacent to a rival city issues `stealTech`;
5. among rivals, the one whose reputation toward me is worst is preferred;
6. assault-prep issues `sabotage` on a target that has buildings;
7. `inciteRevolt` is never issued when the treasury cannot pay;
8. a wonder in progress makes another city build a caravan;
9. a caravan adjacent to the wonder city issues `helpWonder`;
10. at peace a surplus city builds a caravan for a route; at war it does not.

Gates: the JS + `luau/ai.luau` twin in ONE window; the #28 discriminator to
classify the re-record (expect BEHAVIORAL + stamp); reviewer engine-diff +
clean-clone; a 25-seed canonical sweep with COVERAGE counted by direct count
(diplomat missions issued, caravans delivered, routes established) — the W6
lesson stands: a moved hash is not proof a mechanism fires.

## Measurement expectations

The concept histogram is the before-picture: diplomats and caravans are the two
concepts the AI never touched. The after-picture must show missions issued and
caravans delivered in canonical play — and the M-target floors must not move,
because this doctrine spends production that used to become units. If M2/M3
regress, the knobs (`minShields`, `maxInFlight`) are the dial, not the cascade
order.

## Delivery log

**2026-07-30 — both slices implemented, twinned, fixtures 11/11.** Three things
the implementation DECIDED rather than inherited; each was surfaced by a fixture
failing, not by review:

1. **EXPANSION KEEPS PRIORITY.** The first build fixture assumed a diplomat
   would simply appear and it did not: the settler loop sits ABOVE the whole
   build cascade, so a city with settler headroom builds settlers. That forced a
   ruling rather than a workaround — unlike W6 slice-1's temple/granary, neither
   W8 doctrine preempts growth. Both sit above the generic army treadmill and
   below the settler loop, so they fire once a city's settler headroom is gone,
   which is the common case at any real empire size. Documented at the code site
   and encoded in the fixtures (which saturate the loop deliberately).
2. **`relationOf` DEFAULTS TO `'war'`.** `engine/diplomacy.js` returns `'war'`
   when a pair has no relations entry, so gating the peace economy on formal
   relations would have made it dormant in crafted states AND in the
   no-diplomacy soak — the same always-false trap that left W6 slice-1a at 0.9%
   coverage. `econPeace` therefore uses the `govSafe` proxy (no enemy near an own
   city), which the codebase had already adopted for the democracy gate for
   exactly this reason. The peace fixture has no relations table at all, so a
   future "fix" to `relationOf` turns it red on purpose.
3. **Disorder outranks every doctrine**, correctly: a pop-8 city with one temple
   wants entertainers first, which showed up as a caravan fixture failing. The
   fixtures craft content cities instead of fighting it.

Also: `inciteCost` was EXTRACTED and exported in both engines so the AI prices an
incite from the same function the mission charges — no re-derived formula that
could drift and start issuing unaffordable commands.

**Re-record (#28): BEHAVIORAL + STAMP, with an honest midgame signature.**
BEHAVIOR t100 is BYTE-IDENTICAL to marker-0110 (`0x184dd153`) while t200–t400
moved (`0x24ad814c` / `0x43b2e0af` / `0x9793da66`) — exactly right, since the
doctrines need Writing and Trade, which arrive after t100. That t100-held /
midgame-moved shape is the anti-paste-back signature. Natural held 545 / p2 a
SIXTH consecutive re-record. New goldens: `GOLDEN_SOAK` `0x1392d799` /
`0x096df72c` / `0x0d2cab4b` / `0x2365c4b2`, `GOLDEN_NATURAL` `0x03a016c0`,
`BEHAVIOR_NATURAL` `0xfc1587e3`; scenario 002 `0x3ca07386` — computed
INDEPENDENTLY by both engines, which is the twin-fidelity proof.

**Still to do in this window:** finish the stamp cascade (maptype pins,
age-snapshot, ff-parity, sim-smoke), then the coverage proof by DIRECT COUNT —
diplomat missions issued, caravans delivered, routes established in canonical
play. The W6 lesson stands: a moved hash is not evidence a mechanism fires.

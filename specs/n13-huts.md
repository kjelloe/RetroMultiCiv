# N13 — goody huts (villages) + barbarian leader ransom: buildable spec (architect, 2026-07-18)

Grounded in reviewer fact-check #1481 (Village (Civ1) + Barbarian
(Civ1), both real pages). Answers the bugfixer's nine pre-open
questions (#1476). docs/04 §5's four-outcome sketch is SUPERSEDED:
Civ1 has FIVE outcomes (the advanced tribe is real). Label classes:
the outcome set, gold 50, ransom 100, the advance gates, the ambush
gates, merc types + home rule, and the nullifiers are Civ1-authentic
(dump-citable); WEIGHTS, placement density/exclusions, advanced-tribe
contents, ambush composition, and leader behavior are house choices
labeled original (darkpanda's external tables are outside the dump's
authority chain — not imported).

## Placement (Q2)

Hut pass runs at the END of createGame (after starts; no downstream
createGame draws — cleanest pin point). Per-LAND-tile independent
roll at 1-in-`rules.hut.density` (40), iterating in LINEAR
TILE-ARRAY INDEX ORDER 0..w*h-1 (the tileAt index space — R2: the
named order IS the cross-language contract for the sprinkle's RNG
sequence), EXCLUDING every start tile and its 8 neighbors (house
choice; wiki says only "random distribution at map generation"). `tile.hut = true`, present-when-true (omit-safe on
water/normal tiles). No respawn. This shifts every downstream RNG
draw → full golden re-record budgeted (Q9).

## Trigger + nullifiers (Civ1-authentic)

A GROUND unit entering the tile fires the roll; the village leaves
the map after conveying its reward. NULLIFIERS: a BARBARIAN or AIR
unit entering removes the village with NO reward. Working the tile
does NOT remove it (explicitly unlike Civ2 — no code needed, just no
code: candidateTiles ignores huts). Event `hutEntered { playerId,
x, y, result }` through the #1205 gate.

## The roll (Q1, Q6)

ONE rng draw selects among ELIGIBLE outcomes in fixed order
[advancedTribe, advance, gold, mercs, ambush] with weights from
`rules.hut.weights` = { advancedTribe 2, advance 4, gold 6, mercs 4,
ambush 4 } (house, labeled original; sums 20). Eligibility gates
(applied first; ineligible outcomes drop out and the draw runs over
the remaining weight sum):
- advance: NEVER on the game's first turn; NEVER after 1000 AD
  (year > 1000 — the wiki's temporal gates, verbatim); also
  naturally ineligible when availableTechs is empty.
- ambush: suppressed when ANY city stands within
  `rules.hut.ambushCityRadius` (3, house) of the hut, OR when the
  entering civ has founded no city yet (both wiki-stated gates).
- advancedTribe: ineligible when city-founding is illegal on the hut
  tile under the existing foundCity legality (fallback: its weight
  drops out).
If every outcome is gated off (theoretical), the village is consumed
with result 'nothing' (pinned).

## Outcomes

a. **ADVANCED TRIBE**: a new city for the discovering civ on the hut
   tile via the EXISTING foundCity machinery, pop 1, no free
   buildings (the wiki's "may begin with additional population
   and/or prebuilt improvements" has no numbers — v1 ships the plain
   city, labeled original-simplified).
b. **FREE ADVANCE**: one rng pick from the sorted availableTechs
   list, granted through tech.grantTech (Q3 CONFIRMED — fires
   Leonardo + obsolete-sell; THIS is the hut-trigger Leonardo pin
   promised at marker-0056, in this window's scenario).
c. **GOLD**: +50 (`rules.hut.gold`).
d. **MERCENARIES** (Q4): one free CAVALRY or LEGION (wiki-stated
   types; one rng coin), spawned ON the hut tile, fresh
   (moves=type, veteran false). HOME-CITY RULE (wiki footnote,
   verbatim shape): home = the closest city at the moment of
   exploration (chebyshev, tie → lower cityId); if that closest city
   belongs to ANOTHER civ, the unit has NO home and costs no
   support.
e. **BARBARIAN AMBUSH** (Q5): up to `rules.hut.ambushCount` (2)
   barbarian units owned by BARB_ID, composition via the EXISTING
   A66 era-tier pick, placed on adjacent LAND tiles in sorted
   neighbor order skipping occupied/city tiles; zero legal tiles →
   village consumed, nothing spawns (pinned case).

## Barbarian leader ransom (Q7, bundled per the user's 2026-07-17 ruling)

NEW units.json row `barbleader` (Civ1-authentic mechanic; original
numbers where unstated: attack 0, defense 1, moves 1, cost 10,
domain land, barb-only — never buildable: no tech, excluded from
build lists by a `barbOnly: true` flag). SPAWNING: inland raiding
parties (the existing A66 spawn groups) include ONE leader riding
under escort. RANSOM: when a leader is killed while it is the ONLY
unit on its tile ("by itself" — the wiki's lone-leader condition,
which our stack-top combat matches naturally: escorts die first),
the killing civ gains `rules.barb.leaderRansom` = 100 gold
(wiki-verbatim amount) + a `ransomPaid` event.
**R1 PIN (reviewer #1484 — without it the ransom is nearly dead
code): the leader is EXEMPT from open-ground stack annihilation.**
Our combat.js implements the Civ1 rule that a defender loss on open
ground kills the WHOLE stack — which would kill the leader inside
its escort and the lone-leader condition would never fire. Fix,
labeled Civ1-consistent (the wiki's flee narrative implies the
leader survives its escort's death): open-ground stack casualties =
the stack MINUS any barbleader, unless the leader is the sole
defender (then it dies normally and pays). bestDefender must NEVER
select the leader while any other unit shares the tile (explicit
exclusion, not a defense-value tie-break — deterministic by
construction). Scenario 043 gains the full sequence: attack a
2-stack on open ground → escort dies, leader SURVIVES on the tile,
no ransom; second attack → leader dies alone, +100.
HUT AMBUSHES CARRY NO LEADER (R4 — leaders belong to the roaming
A66 raiding parties only; keeps 041's ambush case clean).
V1 SIMPLIFICATIONS (labeled original): no flee/disband AI — the
leader moves with the horde per existing barbarian AI; sea raiders
carry no leader.

## RNG + the turn-16 invariant (Q8)

The barbarians.js module invariant ("no RNG consumed before turn 16")
is about that module's SPAWN scheduling and SURVIVES huts — hut rolls
are a different consumer at a different call site. But hut entries DO
consume rng before turn 16 now, so early-game hashes move: a normal
re-record, not a guarantee break. Update the barbarians.js:5-6
comment with that clarifying sentence in-window (reviewer #1481
prior-art note; also retire the line-3 "later slice" promise).

## Golden footprint (Q9, confirmed)

rules.hut + rules.barb.leaderRansom blocks + the units.json
barbleader row → rulesetHash; the map sprinkle → 002 + A82a; hut
entries + ambushes + leaders in the soak → BEHAVIORAL movement
(the first real one tonight — rounds/winner MAY change; report
whatever is true). Full re-record: soak/natural/turn-100 anchor/
A82a/002/witness; both data checksums.

## Scenario pins (cross-language)

041 seeded outcome chain (fixed state, one hut per outcome via
crafted rng states — gold, mercs w/ foreign-closest-city no-home
case, ambush w/ suppression-radius case); 042 hut-advance fires
Leonardo (owner holds the wonder — the marker-0056 promise); 043
leader ransom (+100 lone-leader kill, no ransom while escorted);
044 nullifiers (air entry + barb entry consume without reward) +
advanced tribe founds the city. Unit tests: eligibility gating,
weight renormalization, placement exclusion, closest-city tie AND
the zero-cities-anywhere case (R5: no candidate → no home, no
support — same as the foreign-closest branch), bestDefender
never-the-leader-while-escorted.

## Client half (R3 — the H-item, helper lane, post-window; the N11 pattern)

(a) The hut TILE renders: a hut prop in renderer/three/props + a
gallery row (nothing forces this mechanically — the mock-state
coverage test asserts terrain ids, not props — so it is NAMED here);
(b) barbleader gets a silhouette + gallery presence like any unit
type; (c) hutEntered toast + turnlog rows through the #1205 gate,
FOG RULE: own-seat only (another civ's hut result never broadcasts;
ambush spawns become visible via normal unit visibility); ransomPaid
= own-seat win-class line.

## Provenance summary

Five-outcome set, amounts (50/100), gates, merc types + home rule,
nullifiers, lone-leader condition: Civ1-authentic (Village (Civ1) /
Barbarian (Civ1)). Weights, density/exclusions, ambush
count/composition, advanced-tribe contents, leader stats + no-flee:
original, labeled per site. docs/04 §5 gets a superseded-by note.

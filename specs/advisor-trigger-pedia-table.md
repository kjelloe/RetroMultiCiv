# Onboarding advisor — the 15-trigger → pedia-id table (ally copy relay)

Deliverable for `specs/ally-ask-2026-07-21b.md` (the ally is ready to write the
15 card texts once the finalized event list + exact encyclopedia target ids
land). Built on the existing `client/ui/advice.js` per the A99 precedent
(`agent-workitems.md:3731` — the onboarding advisor EXTENDS advice.js, it is not
a second parallel module; a duplicate double-fires). Golden-neutral client.

Placeholder copy already ships in `advice.js` (flagged provisional) so the frame
is real; the ally's rewrite drops straight into the `ADVICE[id].text` slots.
Card = title + text (≤ 40 words) + "📖 More" (pedia deep-link, where a concept
exists) + "OK, got it" / "No thanks". One-at-a-time, once per profile
(localStorage), muted by ⚙ "Show first-time tips".

| # | Trigger (spec) | Card id | Detection (fog-honest) | Pedia target |
|---|----------------|---------|------------------------|--------------|
| 1 | First city founded | `first-city` | `hasOwnCityWhen(view)` | `concepts:cities` |
| 2 | First unit produced / build queue | `first-unit` | `unitBuilt` in an own city | `concepts:upkeep` |
| 3 | Research idle (no advance 2+ turns) | `tech-choice` | own turn start, `researching===''` + techs available, 2× | `concepts:research` |
| 4 | First contact with a rival civ | `first-contact` | `firstContactWhen` (visible non-own unit) | `concepts:zoc` |
| 5 | First war declared (on/by you) | `first-war` | `diplomacy` kind `declare` involving you | `concepts:garrison` |
| 6 | First civil disorder | `disorder` | `cityDisorder` event, own city | `concepts:disorder` |
| 7 | First city growth stall | `growth-stall` | `cityStarved` event, own city | `concepts:cities` |
| 8 | First naval unit | `first-naval` | `unitBuilt`, own city, unit `domain==='sea'` | `concepts:movement` |
| 9 | First goody hut sighted | `goody-hut` | `hutSightedWhen(view)` (a `.hut` tile in view) | — (no concept) |
| 10 | First barbarian sighting | `barbarian` | `barbarianSightedWhen(view)` (owner `barb` visible) | `concepts:garrison` |
| 11 | First wonder available to build | `wonder-available` | `wonderAvailableWhen(view, ruleset)` (tech met, unbuilt) | `concepts:buildings` |
| 12 | First government beyond Despotism | `new-government` | `governmentChanged` to non-despotism/anarchy, you | `concepts:governments` |
| 13 | First diplomacy audience | `diplo-audience` | DORMANT — wire when the D-line audience UI is on the surface | — (no concept) |
| 14 | First pollution tile | `pollution` | `pollutionSpread` event (dormant until A91 fires it) | — (no concept) |
| 15 | Endgame approach (≤ ~30 turns to endYear) | `endgame` | `endgameApproachingWhen(view, ruleset)` (`turnsToEndYear`) | — (no concept) |

## Concept gaps (flagged for the architect)

Four triggers have NO good pedia concept and stay UNLINKED on purpose — a
near-miss link is worse than none (the #1069 audit rule). If the architect
wants them linked, these concepts would need authoring in
`client/ui/pedia-concepts.js` (original prose, license boundary applies):

- **exploration / tribal huts** — for `goody-hut` (#9).
- **diplomacy / audiences** — for `diplo-audience` (#13).
- **pollution / global warming** — for `pollution` (#14).
- **victory conditions** — for `endgame` (#15).

## Pedia targets that DO exist (for the ally's "📖 More" depth)

Concept ids available now (`pedia-concepts.js`): `cities`, `terrain`,
`happiness`, `disorder`, `research`, `upkeep`, `garrison`, `zoc`, `movement`,
`governments`, `corruption`, `veterancy`, `buildings`, `regency`, `recordings`,
`gamecode`. (`ctx.pedia.openTo('concepts', id)` is the deep-link the card fires.)

## Toggle note (spec vs shipped)

The spec named an ⚙ "Show advisor hints" toggle + "Reset hints". The shipped
system reuses advice.js's existing ⚙ "Show first-time tips" toggle (same feature
category — a second toggle would fragment the mute state). Re-enabling the toggle
already re-arms every card (advice.js `reset()`), which covers "Reset hints". A
cosmetic rename of the toggle label is an optional follow-up, not required for
the trigger contract.

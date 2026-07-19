# Designer-ally request — unit + building Civilopedia blurbs (2026-07-19)

From the user's Roblox run-F item 9: the Civilopedia should carry a short blurb
per UNIT and per BUILDING — what it is + a light historical backdrop/fact —
exactly like the 68 tech-discovery blurbs (which landed cleanly). Same shape:
ORIGINAL prose, keyed by `id`, wired as DATA separate from rules (UI sources
name/stats/effects from the ruleset; flavor from this table). Cross-platform
(browser pedia + Roblox). Wonders already carry effect text via the overlay, so
they are OUT of scope here (optional later if you want prose flavor for them).

**Writing constraints (same as the tech blurbs):** entirely new prose (no
copied/paraphrased wiki or game text); one or two sentences, ~200-char max;
clear, evocative, lightly historical; must NOT imply mechanics the unit/
building doesn't have; no browser-only control references; the first clause
should scan quickly in a small card. Format per line: `id → blurb`.

## UNITS (28 — barbleader excluded, it's an internal barbarian unit)

| id | name |
|---|---|
| militia | Militia |
| phalanx | Phalanx |
| legion | Legion |
| musketeers | Musketeers |
| riflemen | Riflemen |
| mech-inf | Mech. Inf. |
| cavalry | Cavalry |
| knights | Knights |
| chariot | Chariot |
| catapult | Catapult |
| cannon | Cannon |
| artillery | Artillery |
| armor | Armor |
| settlers | Settlers |
| diplomat | Diplomat |
| caravan | Caravan |
| trireme | Trireme |
| sail | Sail |
| frigate | Frigate |
| ironclad | Ironclad |
| cruiser | Cruiser |
| battleship | Battleship |
| submarine | Submarine |
| transport | Transport |
| carrier | Carrier |
| fighter | Fighter |
| bomber | Bomber |
| nuclear | Nuclear |

## BUILDINGS (21)

| id | name |
|---|---|
| palace | Palace |
| barracks | Barracks |
| granary | Granary |
| temple | Temple |
| marketplace | Marketplace |
| library | Library |
| courthouse | Courthouse |
| city-walls | City Walls |
| aqueduct | Aqueduct |
| bank | Bank |
| cathedral | Cathedral |
| university | University |
| colosseum | Colosseum |
| factory | Factory |
| power-plant | Power Plant |
| hydro-plant | Hydro Plant |
| nuclear-plant | Nuclear Plant |
| mfg-plant | Mfg. Plant |
| recycling-center | Recycling Center |
| mass-transit | Mass Transit |
| sdi-defense | SDI Defense |

## Implementation (for our side, once the copy lands)
- A `unitBlurbs` + `buildingBlurbs` id→string table (the tech-blurbs.js
  precedent), wired into the pedia unit/building entries + the build catalog
  tooltip. Roblox consumes the same data (parity self-test like the blurb gate).
- Ids verified against data/units.json (28, barbleader excluded) +
  data/buildings.json (21) on 2026-07-19 — the ally can key by these exactly.

# Refinement XVII — browser playtest batch (user, 2026-07-25)

22 items from the user's live playtest; the session recording is at
`debugging/logs/retromulticiv-g9ur2-429.json` (dev-PC local,
gitignored — replay it for context/repro via tools/replay.js).
Routing: §5 = ENGINE (bugfixer); §3 = two-lane (hardening server +
helper client); §7/§13 = design/fact answers below; everything else =
the helper's client batch (self-ordered, golden-neutral).

## Design & fact answers (architect)

- **§7 disband-in-city shields**: Civ 1 gives NOTHING for disbanding
  (the 50%-shields-to-production on disband-in-city is Civ2's rule).
  RECOMMENDATION: v2 shelf as `Civ2-shape` (an engine+golden change
  for marginal v1 value). USER RULES — say the word and it becomes an
  engine queue item instead.
- **§13 combined terrains**: Civ 1 has NO stacked terrain (forested
  hills etc. are Civ2+) — our single-type tiles are correct. BUT
  Civ 1 DOES have **River as its own terrain type** (river squares:
  grassland-like yields +1 trade, +50% defense) and we have NO river
  terrain — a genuine axis-1 authenticity gap. Routed: reviewer
  fact-checks the dump (yields/defense/movement/mapgen distribution +
  which specials, if any); THEN the user sizes it — a river terrain
  is a real window (mapgen + engine + render + twins + goldens), not
  a batch item.
- **§5 sea-unit build legality** (engine BUG, verified): setProduction
  has no coast check at all — a landlocked city can build a Trireme
  that can never leave. Civ1-authentic rule: sea units buildable ONLY
  when the CITY CENTER tile is orthogonally/diagonally adjacent to an
  ocean tile (workable-radius water does NOT qualify). Fix in the
  engine item below.

## ENGINE item (bugfixer queue: coastal-build)

One exported `cityIsCoastal(state, city, ruleset)` (center 8-adjacency
to domain:'sea' terrain) used by: (a) setProduction — `item.kind==
'unit' && def.domain=='sea' && !cityIsCoastal(...)` → reason
`needsCoast`; (b) audit the AI's navy-injection/completion paths to
use THE SAME helper (no drift between human legality and AI choice);
(c) catalog-text greys the entry with the reason. Behavioral for
goldens only if an AI was building sea units from non-coastal cities
(measure via the #28 discrimination; likely golden-moving — honest
re-record + fixture: coastal-yes / radius-water-no / landlocked-no).
Fits the engine queue AFTER the in-hand A8 threading window.

## Two-lane item (§3): lobby joining open/closed

Host-only toggle in the game lobby: **"Joining open"** (default) /
**"Joining closed"**. While OPEN: joiners auto-fill seats INCLUDING
seats configured "AI" (the seat flips to the joiner; pre-start lobby
only — mid-game stays the late-join feature's domain). While CLOSED:
join rejected, reason `joiningClosed` (client shows "the host has
closed joining"). Server half = hardening (flag + join gate + tests);
client half = helper (toggle button + reject copy), contract = the
reason string + a `joiningOpen` field on the lobby state broadcast.

## Helper client batch (self-ordered; all golden-neutral)

1. Setup "AI plays history first" label spans BOTH columns (centered).
2. First-time hint for `?join=CODE` arrivals: the join-LAN screen
   gets the first-time instruction treatment on deep-link entry.
4. AI-regency intro box moves to LOWER-right, beside the regency
   button it explains.
6. City view: widen the catalog/build column by 3ch so upkeep lines
   don't wrap.
8. Grassland Shield special motif: replace the "sign" read with
   scattered yellow straws (wheat-sheaf read).
9. Tile hover names the special ("Horse", "Fish" — terrain.special
   .name) wherever a special is present.
10. Forest: 2x tree count. 11. Jungle: 2x canopy count at ~60%
   current height. 12. Swamp: scattered small pond discs.
14. Specials LEGIBILITY pass: every special motif must be easily
   spotted at map scale (they drive city-site planning) — esp. Gold
   in mountains + Oasis in desert. Composes with §8; gallery
   screenshot strip for user acceptance (second iteration of the
   flagged first-pass art).
15. Move the 💰⚔🏙(+income) overview buttons one button-width left
   of the research bar.
16. Research bar: turns-to-tech in the main top line; add 🔬(+N)
   per-turn bulbs next to gold; widen the bar if needed.
17. Next-unit cycle: when ALL remaining unmoved units carry goto
   orders, execute their goto moves (client driver) instead of
   requiring an extra End-turn click.
18. Foreign-relations button moves next to the economy button;
   its panel opens CENTERED like the other top-center panels.
19. Top-center panels: mutually exclusive — opening one closes any
   other open top-center panel (modals with required questions stay).
20. Economy panel: complete statement — ALL incomes (city taxes,
   per-turn treaty income if/when it exists — note what D-line
   provides today) MINUS corruption sum, military upkeep sum,
   building upkeep sum; still reconciling exactly to the top-bar +N.
21. City overview: add per-city columns "bldg upkeep" + "unit upkeep"
   (mind the currency: unit upkeep is shields/food in our rules —
   label truthfully).
22. Top-center menu +4ch: room for the lux-rate icon + value.

## Reviewer fact-checks (queue)

- §13 River terrain: the Civ1 dump — yields, defense, movement,
  specials-on-river, mapgen distribution. Verdict feeds the user's
  sizing decision.
- §5 coastal rule + §7 disband: confirm the architect's Civ1 facts
  above against the dump (cheap, rides the same pass).

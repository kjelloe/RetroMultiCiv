# Roblox runH/runI playtest triage (user feedback 2026-07-23, gaming PC)

26 numbered items (no #4 in the original), given directly to the
roblox-helper alongside runI.txt + the tier-3 acceptance. Sound +
saving are EXCLUDED here (they require Roblox test publishing — user
gate). Routing: everything is roblox-helper/roblox/ EXCEPT §19
(engine, feeds bugfixer queue #22) and §10 (investigate roblox-first,
escalate if engine). The roblox-helper self-orders the batch;
correctness/blockers first (10, 20, 25), then UX.

## Observation deck / lobby / setup
1. SPECTATE pad moves INSIDE the deck, left of "goto capitol", same
   vertical line as "start a new game".
2. User messages ("Join game claims a…"): 2x font height + an inline
   panel/box behind, sized for that font.
3. Host setup: colored BARS for ranged options (replace +/-); two-state
   toggle for on/off (green on/yes, red off/no).
5. Host setup: +50% font for text, +50% larger Start button at bottom.
6. Post-setup lobby: seat setup on the right, +50% font, ALL slots
   shown configured (human player name or "AI").

## Map / tiles / overlays
7. Mountain tiles: only 2x as tall as hill tiles (currently taller).
8. NEW left-side "Map overlays" button: semi-transparent tile coloring
   for city influence + a civ's units; plus a toggle to hide unit labels.
9. Automatic label shortening/hiding on zoom-out (when labels start to
   overlap) while tile influence stays highlighted in the civ's
   semi-transparent color.
12. Fortify visual: earthen works + pikes IN FRONT of the unit (dug-in
    reading, defense bonus) instead of the block piece; NOT shown for
    fortified units inside cities.
13. City name font: +20% vs unit-name font, stronger font, UPPERCASE only.

## Panels / HUD
11. Rename "Pedia" to "Civilopedia" (browser parity).
14. DEBUG / Pad off / Theater / Debug (Studio) / Legend / Turn log:
    expanding ONE hides the others (no visual overlap).
15. Legend lists ALL bound keys (F follow was missing).
16. Tile click → small info card (tile type + resource output) above
    unit actions, like own-unit tiles; ENEMY units on the tile shown as
    unit cards with RED background above the action bar.
26. Whole topbar (Research etc.) moves UP one button-row height.

## City view
17. Tile resources as ICONS not numbers (3/2/3 = 3 food + 2 shield +
    3 trade icons). ARCHITECT DESIGN ANSWER (asked in the item): mirror
    the browser's §24 tile-yield pattern — the icon vocabulary already
    exists cross-platform ([food]/[shield]/[trade] tokens; browser
    client/ui shows the shipped shape). No new design needed; copy the
    browser's glyph choices.
18. City view CLOSES when Options/Civilopedia/Research/any menu panel
    opens (mutual exclusion).
20. BUG: double-click to remove a worked tile does nothing; double-click
    a non-worked tile should force-work it at the expense of the least
    valuable currently worked tile. (Verify against the engine command
    surface — setWorked exists; likely a roblox input wiring gap.)
21. "Buy" on a unit → inline overlay with the buy PRICE + Yes/No confirm.

## Units
22. Unit action bar: gray out/disable actions not applicable to the
    selected unit.
23. GoTo shortcut = "G" (not "O").
24. On respawn at capitol: follow-avatar mode (F) enabled by default.
25. BUG: next-unit with multiple units on one tile ping-pongs between
    unit 1 and 2 instead of finishing the tile then moving to the next
    tile with units.

## Cross-platform / engine (NOT roblox-helper)
10. AI regent sometimes STOPS (does not advance to next turn).
    Roblox-helper investigates FIRST (regency driver wiring); if the
    trace shows engine/shared regency logic, escalate to the engine
    lane with the repro.
19. ENGINE (bugfixer queue #22, the XV §11 disorder playbook — this is
    the USER'S DESIGN RULING for it): on civil disorder in multiple
    cities, the AI/regent checks IN ORDER: (a) does lux 10/20/30%
    solve it, (b) can the treasury sustain that lux rate until a
    helping tech/building/wonder arrives, (c) if lux is too expensive,
    combine a lower lux step with converting a worked tile to an
    ENTERTAINER in the afflicted city. Recorded verbatim into the #22
    scope.

## Status

Queued to roblox-helper as one batch (self-ordered); §19 folded into
bugfixer #22; §10 investigate-first. Sound/saving await test
publishing (user gate).

# runI design rulings — items 2/3/5/6/8/9/12/16/17 (architect, 2026-07-24)

The nine design-gated items from specs/roblox-runI-triage-2026-07-23.md,
ruled concretely so the batch builds without further round-trips.
Guiding principle throughout: BROWSER PARITY for semantics, Roblox
idiom for presentation; everything render-only and fog-honest.

## 2. User messages (deck/lobby feedback lines)

Browser-banner semantics, Roblox presentation: top-center over the
deck, one message at a time (newest replaces), dark semi-transparent
rounded panel auto-sized to the text, 2x the old font height (the
user's spec). Auto-dismiss ~6s + tap-to-dismiss. Rejects/errors
(serverFull, join-claims) get a red left edge; neutral info gets no
edge. No queue/history — the turn log remains the record.

## 3. Host setup: bars + two-state toggles

- Ranged options (size, civs, difficulty, age, …): a segmented
  horizontal BAR, one segment per legal value, filled up to the
  current value in the UI accent color (NOT meaning-loaded colors —
  difficulty is not a danger ramp), current value's NAME as the label
  to the right. Tap a segment (or the end arrows) to set. Same legal
  ranges + defaults as the browser setup (size-capped civs etc.).
- Boolean options: ONE button showing the state word — green "On" /
  red "Off" (the user's spec — the on/off pair is the only
  meaning-loaded color use). Tap toggles.

## 5. Host setup sizing

As specified, no interpretation needed: all setup text +50% font;
the Start button +50%, anchored bottom-center, full-width of the
setup panel minus margins.

## 6. Post-setup lobby seats

Right-hand column, +50% font, ALL seats listed 1..N in fixed order,
each showing its configured occupant: the human player's name, or
"AI". (When late-join reaches Roblox post-v1, "AI" rows grow the
joinable affordance — not now.) Host's own row marked with the same
★ idiom the capital uses. No empty/unknown rows — every slot reads
as configured (the user's spec).

## 8. Map overlays button + panel

New left-side "Map overlays" button (with the other left-stack pads)
opening a small panel of THREE INDEPENDENT toggles, all default OFF,
persisted for the session only:
1. City influence — semi-transparent owner-color tint over each
   KNOWN city's workable radius (the fixed Civ1 fat-cross; only
   tiles the viewer has seen — fog-honest).
2. Unit presence — the same tint mechanism over tiles holding a
   civ's KNOWN units, plus a subtle emphasis ring on the unit
   markers themselves.
3. Hide unit labels — text labels off (markers stay).
Render-only, reads the same filtered view the map already has; no
new state, no engine reads beyond what the client view carries.

## 9. Label LOD on zoom-out

Cheap thresholds, NOT pairwise overlap testing (Luau perf; the user's
"when labels start to overlap" is approximated by camera distance):
- Zoom band A (near): full labels.
- Band B (mid): city names truncate to 8 chars + "…", unit labels
  drop to the unit glyph only.
- Band C (far): unit labels hidden entirely; city labels stay
  (uppercase per item 13), influence tints (item 8) unaffected.
Tune the two thresholds visually in Studio; document the chosen
camera distances in the done-mail so they're reviewable numbers.

## 12. Fortify visual

Replace the block piece with a dug-in reading: a low earthen mound
arc (brown, ~1/4 tile wide) placed on the CAMERA-FACING edge of the
unit's tile, with 3 angled pike parts rising from it toward the
camera. Static rest pose (no animation), owner-neutral colors (the
unit's own chrome already carries the faction). RULE (user spec):
never shown for fortified units INSIDE cities — the city visual
already implies walls/garrison.

## 16. Tile info card + enemy unit cards

Mirror the browser's tile/entity summary patterns:
- Click any KNOWN tile → a small card ABOVE the unit-action bar:
  terrain name, yield as ICONS (item 17's vocabulary — the
  [food]/[shield]/[trade] tokens), improvements (road/irrigation/
  mine), and the special's name when present. Same card family as
  own-unit tiles (consistent chrome).
- ENEMY units on the clicked tile: stacked unit cards with a RED
  background above the action bar — unit name, veteran mark, hp bar;
  ONLY what the viewer's fog shows (never counts of unseen stack
  members).
- Dismiss: click elsewhere / close ×. One card at a time.

## 17. City-view tile yields as icons

Already answered in the triage spec — restated as the ruling: copy
the browser §24 tile-yield pattern exactly (icon-per-point rows using
the shared token vocabulary); no new design.

## Build notes (whole batch)

Self-order as usual; everything here is roblox/-only, golden-neutral,
no gate-4 drift expected except screenshots. Acceptance: screenshots
per item in roblox/acceptance/ (never-commit) + the batch done-mail
lists item→screenshot. Anything that turns out to need engine/shared
data the view doesn't carry: STOP and escalate (do not extend the
view shape unilaterally — that is a server/contract change).

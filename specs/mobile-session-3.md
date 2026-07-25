# Mobile play-session-3 feedback (user, 2026-07-25)

All items are **mobile browser** issues. All are golden-neutral client-UI work
(no engine/gamesim change). Source: user's third mobile play session. Numbering
kept from the user's list (items 4–14; 1–3 not sent this batch).

Triage tags: **[bug]** broken on mobile · **[layout]** fit/placement · **[interaction]**
tap/long-press model · **[flow]** turn sequencing · **[feature]** new affordance.

| # | tag | item | implementation note (initial) |
|---|---|---|---|
| 4 | layout | AI regency button belongs just LEFT of End Turn | reposition in the bottom/HUD control row (client/ui/regency.js + hud.js layout) |
| 5 | feature | Compass move-arrows panel must be long-press DRAGGABLE, repositionable anywhere on screen | add drag handle + persisted position (client/ui/dpad.js); pointer long-press to enter drag mode |
| 6 | bug | Defeat + replay-history screen did NOT show on mobile | endscreen fails to render/reach on mobile viewport — reproduce on a phone-width headless run; likely a z-index/overflow or a gated-by-width path (client/ui/endscreen.js, replay.js) |
| 7 | layout | Pedia panel — and ALL menu-popup panels — don't fit the mobile screen; top close button barely clickable | responsive max-height/max-width within the mobile viewport; sticky/enlarged close target; audit every popup (pedia, panels.js, overview-panel.js, diplomacy.js, stats, etc.) |
| 8 | interaction | REMOVE bottom unit-movement arrows; instead draw arrow overlays on the MOVEABLE TILES around the selected unit (so a click = move there) | move-hints.js already computes reachable tiles — render directional arrow glyphs on them; retire the bottom d-pad arrows for unit move (keep dpad for map pan per #5?) — clarify overlap with #5 |
| 9 | layout | Unit stat line ("grassland, no moves left, support from city NN") + selected-tile yield + specials → move to TOP as part of the HUD | relocate the wait-status / hover-card content into the top HUD band (hud.js, wait-status.js, hover-card.js) |
| 10 | layout | Top bar save/pedia icons block the research button+bar → make the top bar HORIZONTALLY SCROLLABLE (like the bottom unit-action bar) | overflow-x:auto on the top-panels container (top-panels.js); ensure research bar stays reachable |
| 11 | flow | On "2 units can move" end-turn warning: after the message is dismissed, auto-show/select the NEXT movable unit | wire the warning-dismiss to the existing "cycle to next unit needing orders" path (session + hud/input) |
| 12 | interaction | Long-press an ADJACENT tile with an enemy unit → open COMBAT ODDS (not attack); attack only on a confirming single click. Long-press ANY tile → resource-yield + special inline overlay | two-stage attack confirm; long-press = inspect (odds for enemy-occupied, yield/special otherwise) — pairs with the hover-card/advice odds already computed |
| 13 | interaction | Unit selected + long-press a NON-adjacent tile → GOTO movement command | route long-press-far → issue goto (the pathing already exists; A65 road-goto) |
| 14 | interaction | Unit selected + click an ADJACENT city tile → MOVE the unit there, don't open city view | disambiguate: with a selected unit, adjacent-city tap = move; city-view opens only with no unit selected (or a dedicated gesture) |

## Structure / dependencies

- **Interaction cluster (8, 12, 13, 14)** is one coherent tap/long-press model redesign
  for the unit layer — should be designed together (client/ui/input.js + move-hints.js).
  Long-press = inspect/odds/goto; single-tap on a hinted tile = move; two-stage attack.
- **Layout cluster (4, 7, 9, 10)** is HUD/popup responsive fit for mobile viewport.
- **#5** (draggable compass) vs **#8** (retire bottom move-arrows) — **RULED (user
  2026-07-25): build BOTH.** The compass is user-toggleable on/off already, so they're
  not mutually exclusive: keep the draggable compass (#5) AND add tile-overlay move
  arrows (#8); a user preferring tile arrows toggles the compass off. No ally question.
- **#6** is a straight bug (endscreen on mobile) — highest priority, independent.
- **#11** is a small flow wire-up. NOTE (helper, 2026-07-25): #11 is NOT session/hud
  wiring — its logic lives entirely in `client/ui/input.js` `endTurn()` (the "N units
  still have moves — E/End Turn again" warning). It is gated with the interaction
  cluster on that file's lock.

## Observed during the remainder (helper, 2026-07-25) — new item, do NOT fold into a cluster

| # | tag | item | note |
|---|-----|------|------|
| 15 | bug | On mobile portrait (~360–390px) the world `#minimap` is width-pinned (114px) but height-UNCONSTRAINED, so it renders ~674px tall and covers the right half of the play area | `#minimap` mobile rule (`client/style.css` ~line 2489: `width:112px; right:8px; bottom:118px`) sets no `max-height`/aspect cap — a tall/narrow map makes the minimap canvas tall. Confirmed via DOM probe to be independent of the #10 top-bar change. Golden-neutral client CSS (cap `max-height` + preserve aspect, or scale to a fixed box). Architect to queue as its own item. |

## Lane

Golden-neutral client UI. **RE-RULED (user 2026-07-25, v1 acceleration): HELPER owns the
REMAINDER.** bugfixer shipped #6 (@1aeba0b) + #7 (@ee7b195) then PIVOTED to the W1
diplomacy engine window; the helper session was reactivated to finish #4/#5/#8/#9/#10/#11/
#12/#13/#14 in parallel (#2696, queued). Order for helper: layout (#4/#9/#10), interaction
cluster (#8/#12/#13/#14 as one input.js/move-hints.js pass), #5+#8 both built (compass
toggleable), #11 wherever. Golden-neutral throughout — any engine touch stops for architect
sign-off. bugfixer's #4/#9/#10 scoping handed to helper (esp. #10 = top-bar restructure).

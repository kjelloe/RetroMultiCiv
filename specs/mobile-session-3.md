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
- **#5** (draggable compass) overlaps **#8** (retire bottom move-arrows) — need to
  confirm whether the compass/d-pad stays for MAP PAN after unit-move arrows move to
  tile overlays. **Open question for the user/ally.**
- **#6** is a straight bug (endscreen on mobile) — highest priority, independent.
- **#11** is a small flow wire-up.

## Lane

Golden-neutral client UI. Helper lane (its natural owner) is currently STOPPED; either
the architect executes this batch, or the helper session is brought back online to run
it in parallel. Decision pending user (flagged in the status report).

# Roblox UI/interaction parity — the inventory and the plan

Status: DRAFTED 2026-07-15 (user direction after the R4 acceptance
playtest: "all the UI elements of the browser version need their own
Roblox representation in one form or another"). This doc is the
R-lane's roadmap from R5 onward: every browser UI surface, its Roblox
shape, and its tier. The roblox-helper refines Roblox-native judgment
per item; the architect cuts R-items from the tiers in order.

## Ground rules (carry from the browser client)

- The client is a VIEW: every element renders from the fog-filtered
  view push, never raw state; every action is a command through the
  dispatcher. No UI element may compute game logic locally.
- Reduced-motion and information-preservation invariants (ally's
  renderer laws) apply to Roblox UI identically.
- Roblox-NATIVE beats transliteration where the platform offers a
  better shape (the possession mode is the exemplar — the browser has
  no avatar; Roblox does. Map the PURPOSE, not the pixels).
- BillboardGuis for world-anchored info; ScreenGuis for HUD/panels;
  keep each panel a ModuleScript mirroring the browser's ui/ split so
  the file map stays recognizable across platforms.

## Tier 0 — landed (R4/R5)

| Browser element | Roblox shape | Status |
|---|---|---|
| World render, fog | Parts terrain, void+dim (R4) | ✅ R4 |
| Unit select + move | click ray → tile, adjacent move (R4) | ✅ R4 |
| Found city / end turn | B / Return keys (R4) | ✅ R4 |
| Camera | orbit/pan/zoom + follow-avatar (R3/R4) | ✅ |
| HUD status line | ScreenGui text (R4, minimal) | ✅ minimal |
| City view + production picker | panel from view data | R5 (in flight) |
| Unit possession (Roblox-native) | avatar rides unit, WASD | R5 (in flight) |

## Tier 1 — the core-loop gap (a solo game feels complete)

| Browser element | Roblox shape (proposal) | Notes |
|---|---|---|
| Action bar (unit orders) | context buttons near selected unit (BillboardGui or bottom bar): fortify, skip, irrigate/mine/road, disband, GoTo | GoTo needs a target-pick mode like the browser's |
| Research picker | panel: current tech, bulbs/turn, pick-next list (tech-tree text form first) | the browser's one-ring-ahead rule applies |
| Tax/science slider | panel slider or +/- steppers; despotism caps enforced by rejection, slider snaps back (A29 lesson) | |
| Turn log | scrolling side frame, filtered events only; major-event classes from turnlog-classes | the B5 fog rules apply verbatim |
| Combat odds preview | on hover/long-press of an attackable target: odds + multiplier breakdown Billboard | touch = long-press (mobile-relevant later) |
| City-site preview | settler selected → footprint + rating on hovered tile | reuse A45-style tile tinting |
| End-turn states | button greys/pulses (A29 three-state) + idle-units confirm | partially in R4's Hud |
| Move hints | reachable-tile arrow/tint for selected unit | overlay quad reuse |

## Tier 2 — management depth (a long game stays manageable)

| Browser element | Roblox shape | Notes |
|---|---|---|
| City list / paging | panel with arrows (browser parity) | |
| Build catalog w/ locks+effects | production picker grows lock reasons + plain-language effects | data already in view |
| Worked-tile assignment | city panel: tap tiles in the fat cross to toggle; auto/manual reset | the browser's setWorkers semantics |
| Options (anim, auto-end-turn…) | settings panel; Roblox adds its own (streaming off is pinned, input prefs) | |
| Save/load | R6 question — DataStore vs envelope (scoping lands with R5) | |
| Game code display | HUD chip + copyable (docs/07 trust loop must stay visible) | |

## Tier 3 — multiplayer/social (needs R6 seats first)

| Browser element | Roblox shape | Notes |
|---|---|---|
| Lobby (seats, civs, chat, kick) | Roblox-native: the SERVER is the room; seat claim UI at spawn; Roblox chat exists natively — decide what of A37 carries | kick/block partially platform-provided |
| Waiting/skip-vote/wait-status | HUD line + vote prompt | |
| Spectators | Roblox visitors = natural spectators; permission surface needed | |
| Regency | 🤖 equivalent + auto-regent on player leave (platform makes this MORE important: Roblox players drop constantly) | pairs with R6 seats |
| Seat codes / reconnect | UserId IS identity — reconnect is free; seat codes likely unnecessary in-platform | simplification, not a gap |
| Handoff/hotseat | NOT PORTED — hotseat is a browser concept; Roblox is always one-seat-per-player | deliberate non-goal |

## Tier 4 — meta (post-parity polish)

Setup/splash (Roblox: the place IS the lobby — a start-config surface
for the host only), overlays panel (A45's registry ports naturally),
replay theater (A47's design maps once recordings live server-side),
gallery (dev-only; stays browser).

## Interaction issues named at the R4 playtest (standing list)

GUI-inset ray offset (fixed, ScreenPointToRay); default-controls
input sinking (poll pattern); StreamingEnabled off; Baseplate
destroy; chat/keyboard focus vs game keys (Roblox chat eats keys —
audit every binding against chat focus, the INPUT/TEXTAREA lesson's
platform twin); touch/gamepad deferred until Tier 1 is stable.

## Roblox-native review round (roblox-helper, 2026-07-15 — adopted)

Tier-1 refinements, all ADOPTED: actions live in a fixed bottom
ScreenGui bar with hotkeys (Billboards are for INFO — odds, labels;
world-anchored buttons fight the orbit camera); every hotkey passes
the chat-focus audit (GetFocusedTextBox guard = house pattern); GoTo
reuses Select's pick machinery with a mode flag (Esc cancels), and
the move-hint tint doubles as the GoTo legality preview — one
overlay system, not two; the tax slider becomes +/- STEPPERS (no
native slider; a drag slider fights LMB-orbit; A29 snap-back
unchanged); move hints from view data are approximate under fog BY
CONSTRUCTION (hidden ZOC — the browser shares the property; not a
bug).

SERVER PREREQUISITE found: GameServer passes eventsOut=nil during
AI rounds — round events are dropped before filterEvents runs. The
turn-log row's first half is server-side: collect + filter + push
per-seat round events.

RULING (architect): the client MAY require read-only luau engine
modules for presentational math (combat odds, city-site rating) —
no state mutation, no RNG draw, nothing acts on the result; the
no-local-game-logic rule governs ACTING, not explaining. Cheaper
and always-consistent vs a server query round-trip.

Tier-2: Roblox has no clipboard API — the game-code chip is a
selectable TextBox (read/retype; trust loop intact, wording adapts).

Tier-3 amendments: SPECTATOR DEFAULT — visitors must NOT get an
omniscient view by default (fog leak); default = lobby-only or the
host's-seat view until seated, host grants omniscient explicitly
(the browser's host-controlled precedent). REGENCY-ON-LEAVE is
R6's TWIN feature with multiplayer seats, not later — player churn
makes it load-bearing on this platform.

Standing interaction list additions: possession-mode WASD respects
chat focus AND maps to map-absolute N/W/S/E (camera-relative would
make identical inputs produce different commands — recordings read
better absolute).

## Process

Tiers become R-items in order (Tier 1 ≈ R6–R8, sized by the
roblox-helper's claims); every item keeps the R4 acceptance bar — a
recorded run replaying hash-exact both engines whenever an item adds
COMMANDS, screenshots READ always. The user playtests per tier;
findings feed the next cut.

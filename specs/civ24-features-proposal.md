# Proposal: Civ2/Civ4 beloved features, easy tier (client-only, golden-neutral)

Advisory write-up from the reviewer (no design authority; the architect holds
the queue call). Baseline: marker-0033. All five items are CLIENT-ONLY: no
engine/ change, no state-shape change, no scenario or gamesim golden movement.
Every game action they take goes through the normal `session.apply()` command
path, so recordings and replay verification are untouched by construction.
Prior-art status per item was grepped at marker-0033: none of the five exist.

Shared constraints (from CLAUDE.md / docs/02):

- UI reads `session.state` (local mode) or the fog-filtered view (server
  mode) and calls `session.apply()`/`endTurn()`; `session.onChange` drives
  refresh. Nothing below reads engine internals the view does not carry.
- `ctx.HUMAN` is the CURRENT VIEWPOINT and mutable (hotseat) — every
  per-player client feature below keys its storage by playerId and re-reads
  `ctx.HUMAN` on every event, never caches it.
- Fog honesty applies to UI: nothing below may render or act on tiles or
  units outside the player's explored/visible map.
- Client-local persistence (queues, sentry lists, automation flags) lives in
  client state / localStorage keyed by game code + playerId — NEVER in game
  state (a game-state field would move every hash).
- New keyboard handlers follow ui/input.js conventions (ignore INPUT/TEXTAREA
  targets).

## 1. World minimap with click-to-jump (Civ2+)

What: a small canvas in a HUD corner painting one pixel/cell per explored
tile from the player's view (terrain palette is already shared between the
renderer and the DOM city-view mini-map — see the note at
client/renderer/three/index.js:12), with a viewport rectangle and
click/drag-to-jump via `renderer.centerOn()`.

Shape: new `ui/minimap.js`; repaint on `session.onChange`; unexplored = void
color (fog-honest: paint only explored tiles from the filtered view). Cities
as owner-colored dots, own units optional at first.

Edge cases: east-west map wrap (the world wraps; either draw double-width and
window it, or wrap the click x); hotseat hand-off must repaint from the new
viewpoint (subscribe to the same refresh the HUD uses).

Verification: browser.test.js-style assertion that the canvas paints >0
non-void pixels after boot and that a click moves the camera; gallery and
splash goldens untouched (minimap absent from both pages).

Size: small. Risk: lowest of the five. Suggested first.

## 2. Rich breakdown tooltips (Civ4)

What: hover (desktop) tooltips on own-city HUD/panel numbers showing the
arithmetic: tile-by-tile yields, happiness ledger (base content, luxuries,
buildings, martial law, war weariness), production/upkeep breakdown.

Shape: extend ui/panels.js / ui/hud.js with a tooltip component; all inputs
are already in the own-city view (own cities project fully; rival cities
project name/owner/size/walls only — tooltips therefore restrict to OWN
cities, which is also the Civ4 behavior). Where a number needs engine
arithmetic (e.g. corruption by distance), compute it client-side from the
same ruleset JSON the client already fetches — display math, not authority;
the engine remains the arbiter and the tooltip shows the engine's stored
outputs where the view carries them.

Edge cases: keep tooltips out of the recording (pure render); touch has no
hover — this item is where the mobile plan's long-press surrogate lands later.

Verification: UI-lane assertion that a city tile's tooltip text contains the
summed yield equal to the displayed yield.

Size: small-medium (mostly content, not plumbing). Risk: low; it can drift
from engine truth if it re-derives instead of reading stored values — prefer
reading view fields, derive only where absent.

## 3. Per-city build queue (Civ3/4 QoL)

What: an ordered per-city list of build targets; when the current item
completes, the client issues the next `setProduction` automatically.

Shape: queue stored client-side keyed by gameCode+playerId+cityId. The city
panel gains add/remove/reorder. On the production-complete event (the turn
log already receives completions), the client issues `setProduction` for the
queue head — at the next legal moment: TODAY that is the player's own turn
(the engine rejects off-turn commands), so the queue advance fires when the
player's turn opens; WHEN A54 (off-turn pre-work, designed) ships,
`setProduction` becomes whitelisted off-turn and the same code advances the
queue immediately. The queue is a pure convenience layer over logged
commands — replays reproduce exactly because the issued commands are in the
log like any human click.

Edge cases: queued item becomes illegal (tech obsoleted the unit, building
already built, wonder built elsewhere) — on rejection, drop the item, toast
via the turn log, try the next; hotseat — queues are per-playerId and the UI
only shows/acts for `ctx.HUMAN`; server mode — identical, commands go over
the socket.

Verification: UI-lane script queues two items, ends turns until the first
completes, asserts the second becomes current; replay of the recording
reproduces the hash (it must, trivially, but it is the honest check that the
queue added no out-of-band state).

Size: medium. Risk: low-medium (rejection handling is the only subtlety).

## 4. Sentry with wake-on-enemy-sighted (Civ2)

What: a client-side "asleep" order: the unit is skipped by next-unit cycling
until an enemy becomes visible within N tiles (N=2 suggested), then it wakes
with a toast.

Shape: sentry set stored client-side (gameCode+playerId → unitId set). The
existing sighting events / view diff drive the wake check each round. No
engine flag: the engine already has fortify (an engine state); sentry is
purely a client cycling filter, which is why it is golden-neutral.

Edge cases: unit dies or is disbanded → prune ids on refresh; save/load →
sentry list persists via localStorage but losing it is acceptable
(convenience, not rules); hotseat → strictly per-playerId.

Verification: UI-lane script sentries a unit, cycles (unit skipped), spawns
an enemy into view via the scripted e2e state, asserts the wake toast.

Size: small. Risk: low.

## 5. Worker/settler automation for humans

What: an "automate" toggle on a Settlers unit; each of the player's turns the
client picks the unit's next improvement action and issues the normal
commands (move / startWork), exactly as if the player clicked them. All
logged, all replayable.

Shape: the most design-sensitive of the five, because engine/ai.js expects
full state while the server-mode client only holds the fog-filtered view.
Two honest options:
  (a) small view-based policy in the client (nearest own-city tile lacking
      road/irrigation/mine by the same priority order the AI improver corps
      uses) — recommended; ~100 lines, no engine import;
  (b) reuse engine/ai.js against a state-shaped projection of the view —
      tempting but brittle (ai.js may read fields the view legitimately
      omits); not recommended.
Automation acts only during the player's turn (it is a click generator, not
an engine actor), stops on hand-off (`ctx.HUMAN` re-check per action), and a
manual order cancels it.

Edge cases: fog honesty is structural (the view IS the fog); avoid loops
(track last-worked tile client-side); pillage/war interruptions simply fall
out of "pick next action from current view each turn".

Verification: UI-lane script automates a settler for ~10 turns, asserts >0
improvement commands landed in the recording and the replay hash reproduces.

Size: medium. Risk: medium (policy quality, not correctness — worst case is
a dumb settler, never a broken game).

## Suggested order and framing

1. minimap  2. tooltips  3. build queue  4. sentry  5. automation —
ascending risk, each independently shippable and labelled
`gamesim-golden-neutral`. Items 1-2 are pure render; 3-5 add client state +
command issuance. None opens a golden window; none blocks or is blocked by
the phase-6 column. Explicitly NOT proposed (scope drift, contra docs/15):
Civ2 hitpoints/firepower, stack combat, any engine-side combat change.

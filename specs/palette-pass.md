# Design: accessibility palette pass (colorblind-safe civ colors + fog/terrain contrast)

Advisory write-up from the reviewer. Client-only, golden-neutral. Prior art:
none (no colorblind/contrast handling anywhere in client/ or docs).

## The constraint that shapes the whole design

Civ colors live in GAME STATE (`data/civs.json` `color` → `player.color`),
so changing the DATA would move every scenario/sim hash. The palette pass
must therefore be a DISPLAY-TIME REMAP, never a data edit: a pure lookup
from stored color → displayed color, applied at the two places color enters
rendering. Options toggles already have the right pattern (ui/options.js:
localStorage prefs, "never game state, never hashed").

Historical note (wiki, facts): Civ1 itself used 7 SHARED color groups
(White Romans+Russians, Green Babylonians+Zulus, Blue Germans+French,
Yellow Egyptians+Aztecs, Cyan Americans+Chinese, ...). The project's 14
distinct colors are an intentional modern divergence for 14-civ play —
which is exactly why a deliberate distinguishability pass is worth doing.

## Where color is resolved (the two seams)

1. `client/renderer/three/factions.js` — `resolveVisual()` produces
   {primary, secondary, emblem} for meshes/flags/emblems (CanvasTextures,
   cached by primary|emblem key).
2. DOM UI — HUD/panels/turn log/minimap-to-be use the same civ color
   strings.

Design: one module, `client/ui/palette.js`, exporting `displayColor(hex)`
(and `displayVisual(visual)`): identity by default; when the option is on,
maps each of the 14 stored civ colors to a curated alternative. Both seams
call through it. The texture caches key on the DISPLAYED color already
(cache key = primary|emblem string), so toggling invalidates naturally on
re-render; `session.onChange`-driven refresh repaints DOM.

## The modes (options panel, localStorage)

- `default` — today's colors, byte-identical rendering (the option OFF must
  keep gallery.png/splash goldens byte-exact; identity mapping guarantees it).
- `deuteranopia-safe` (v1's one alternative) — a 14-color set chosen for
  red-green confusability: max pairwise distance under a deuteranopia
  simulation matrix; keep bright/dark alternation so moved-out dimming
  (the baseToken bright/dim states) stays legible.
- Later if wanted: protanopia/tritanopia variants — same mechanism, one
  table each.

## Redundancy is already half-built — lean on it

Civ identity is NOT color-only today: every civ has an EMBLEM (factions.js
emblems on flags/discs) and light-civ handling exists (isLightColor →
dark rims/borders). The pass should (a) audit emblem visibility at
gallery zoom levels — emblems are the colorblind-independent channel;
(b) verify the veteran gold rim and fortified chip read against every
palette entry; (c) check fog dimming vs terrain palettes (terrain.js) for
sufficient explored-vs-visible contrast in both modes.

## Verification (all existing tooling)

- `debugging/gallery.html` already renders the 14-civ faction acceptance
  grid: screenshot per mode via `debugging/shoot.sh`, run each through a
  CVD simulator offline; pairwise-distance table goes in the review note.
- A small Node test (no browser): the alternative table has 14 entries,
  all valid hex, no duplicates, min pairwise deltaE above a floor — the
  same shape as the terrain-coverage test in mock-state.test.js.
- Goldens: option OFF byte-identical (assert by re-shooting gallery.png).

## Slices

P1 palette.js + options toggle + the two seam call-throughs (identity map
   only — pure refactor, goldens prove it).
P2 the deuteranopia-safe table + the Node distance test.
P3 the audit fixes that fall out (emblem size/contrast tweaks, if any) —
   each its own visual-golden re-record from CI actual, per the A48 process.

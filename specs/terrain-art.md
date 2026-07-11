# Designer ally — terrain art guidance (A1.5)

*(received 2026-07-11; kept as the design of record for the terrain visual
passes. A1.5 items are implemented in client/renderer/three/assets.js.)*

Key rules adopted verbatim:

- Start now, lightweight and procedural — do NOT pause hotseat for Blender.
- Readability first: identify terrain at play distance without hovering.
- Simulation state determines WHICH visual layers exist; visual code
  determines only their appearance.
- All decoration frontend-only, derived deterministically from tile
  coordinates (never Math.random, never stored in canonical state).
- Layered construction: base tile → features (trees/rocks/peaks) →
  improvements (roads/irrigation/mines) → resources → gameplay overlays.
- Roads: draw connections toward neighboring road tiles, not generic marks.
- Do not: per-tile mesh objects (instance!), heavy textures, props so tall
  they hide units, fog transparent enough to leak information.

A1.5 sequence: 1 terrain color variants · 2 land/water elevation · 3 tree
clusters · 4 angular hills/mountains · 5 road/irrigation/mine meshes ·
6 fog/selection polish. A2 (post-server): Blender GLB kit. A3 (post-LAN):
animated water, flags, ambient effects.

(Full original text in the project chat; this file records the adopted
contract so future art work follows the same rules.)

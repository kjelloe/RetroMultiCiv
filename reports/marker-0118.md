# marker-0118 — headwear + camera-facing facades (H7b/H8b)

**Tag:** `marker-0118` (code tip = the tagged commit) · **merge-consistent
— the user may merge this** (supersedes marker-0117; merge THIS one).
Client-only, High-gated, Low byte-verified.

Two corrections from the user's review of the H6–H8 pass:

1. **No bald heads.** Hair fringes under every open helmet and hat
   (spearmen, hoplite, musketeer, rifleman, diplomat, cavalry rider); the
   knight's great helm is full-cover; the wagon driver — the one genuinely
   bare head — gets hair and a straw work hat (civilian → hair/cap).
2. **Facades face the player.** The H8 kit faced the tile center, which the
   camera never sees (it sits south looking north). All high houses now
   align facing south, so windows, doors, lintels and doorsteps read from
   the real play view. **Lesson recorded in the spec: detail that doesn't
   face the camera is detail that doesn't exist.**

Test state: battery 22/22, graphics-levels.spec 3/3, Low byte-identical.

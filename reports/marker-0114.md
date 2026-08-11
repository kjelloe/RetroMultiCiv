# marker-0114 — graphics-arc polish + tooling capture

**Tag:** `marker-0114` at the report commit (code tip `b296236`) ·
**merge-consistent — the user may merge this** (supersedes marker-0113;
everything there plus the below).

Delta since marker-0113, all client-side, all golden-neutral:

- **Props lie on the relief.** `terrain.surfaceAt` (bilinear over the
  terrain mesh's own height grid) grounds every off-center prop at
  medium/high — road segments, rail ties, field patches, scrub, pebbles,
  reeds — and long strips (roads, irrigation channels) additionally TILT to
  their endpoint heights, so they follow slopes instead of bridging dips.
  Low is untouched: byte-checked against a fresh baseline (the gallery
  label line changed this window; the 3D scene compared pixel-identical
  beneath it).
- **The 3-variant art loop is a skill** (`.claude/skills/art-variants`) —
  it ran five times across the arc; the mechanized form captures the
  framing/shoot/restore discipline, the darken-below-clamp and dead-flag
  lessons, and the decide-document-flag overnight mode.
- **Gallery self-documents** rows 20–22 and `?gfx=` in its label.
- **Tier comparison sheet**: `debugging/gallery-tiers-comparison.png` —
  land units / ships / cities / terrain × low / medium / high, identically
  framed (untracked, regenerable from the gallery).

Test state: render battery 21/21, `test-ui/graphics-levels.spec.js` 3/3,
low byte-identity re-proven after every change in this window. No engine,
data-ruleset, or twin changes.

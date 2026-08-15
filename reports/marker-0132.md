# marker-0132 — H13c: medium summits + mobile pedia reach

**Tag:** `marker-0132` at `75f4051` · **merge-consistent — the user may
merge this** (supersedes marker-0131). Client render/CSS only;
gamesim-golden-neutral; LOW byte-frozen (g0 `cmp` proven — the peak-cone
gate still includes low, and the snow lerp is `perTerrain`-gated off it),
so the CI visual goldens are untouched.

## Delta since marker-0131 — the mobile playtest pair

1. **Peaks-over-peaks at MEDIUM + floating mountain gold** — the High
   bug's sibling, found on a phone: medium's SEGS-8 faceted mesh owns
   real summits since G3, so the faceted-era peak/snow prop cones read
   as a second peak floating above the top. The cones are **LOW-only**
   now; medium snow-caps its summits with a per-face vertex lerp in the
   faceted builder (snowline 0.78 vs the smooth pass's 0.85 — medium
   summits are thin spikes, the cap must start lower). The mountain
   gold now anchors per tier: low keeps the classic raised-above-the-
   cone apex (byte-frozen), medium moves to a grounded FLANK
   (dx 0.26 / dz 0.22, dy 0.05 — no more perching above a needle),
   high keeps the H12 0.45-sink on its broad smooth summits. Review
   shots: `debugging/h13c-med-mountain.png` / `h13c-med-gold.png`.
2. **Mobile pedia ✕ barely reachable** — the max-width-720 full-bleed
   sheet used `100vh` (extends under the mobile URL bar) with the head
   at the very top edge. The pedia AND ship sheets now use `100dvh` +
   `padding-top: max(26px, env(safe-area-inset-top))` on the head, and
   a coarse-pointer tap-target bump on the ✕ (42 px). Measured with the
   kept probe `debugging/pedia-shot-probe.mjs` (Pixel-7 viewport):
   close-button top 1.5 px → 26.5 px.

The art-variants skill rule is now confirmed twice and strengthened:
when a tier's MESH takes over a silhouette, audit every prop that
assumed the old one.

## Verification

- Playwright: pedia / mobile-touch / layout-contract / graphics-levels
  — 14/14. Battery: mock-state / render-spec / road-city /
  graphics-level / city-era — 24/24.
- LOW byte-identity: `cmp` vs `debugging/g0-final.png` — identical.
- High untouched by inspection (smooth path has its own H12a snowline;
  the crystal sink there is unchanged).

## Open

- User: merge marker-0132 (carries 0130's canonical-floors CI repair +
  0131's S2 reveal); redeploy for the mobile fixes; v1.0.2 release
  notes on your word.
- Roblox lane: 5 queue items + C1b Studio session (unchanged).

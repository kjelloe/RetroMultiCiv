# EditableImage tech-glyph feasibility spike (roblox-helper, polish-pair queue#1)

Feasibility ONLY — verdict-first, no production wiring. Question: can the 68 procedural tech
glyphs (browser `client/ui/tech-glyphs.js`) be rendered in Roblox via **EditableImage** for full
motif parity, replacing the current era-frame-only fallback (`TechGlyphs.luau`, ruling #2078)?

## VERDICT: FEASIBLE — moderate effort, scoped BUILD (not a quick wire-up)

- The blocker cited in ruling #2078 ("EditableImage motif path is Studio-runtime-gated, beta
  flag") is **LIFTED**: `AssetService:CreateEditableImage()` is GA — runtime creation from scratch,
  no upload, no beta flag. The gate that parked the 68-motif path is gone.
- BUT the browser draws with a canvas vocabulary that has **no 1:1 EditableImage equivalent**, so
  this is a re-implementation against a small drawing shim, not a verbatim JS port. Recommend it as
  a scoped SO18 build item; the era-frame fallback stays a valid ship-now baseline (gate 26 holds).

## Why moderate (not trivial, not blocked)

Browser primitives in tech-glyphs.js (214 lines, ~18 motif fns): `arc` ×29, `arcTo` ×8, `fill()`
×5, `stroke()` ×7, `moveTo/lineTo/closePath`, `ellipse` ×1. **No** bezier, **no** gradients, **no**
drawImage. A constrained geometric vocabulary — good news for portability.

EditableImage drawing API: `DrawRectangle`, `DrawCircle`, `DrawLine`, `WritePixels` (raw buffer),
`DrawImage` (composite). Mapping:

| Browser primitive | EditableImage path | Effort |
|---|---|---|
| circle / dot | `DrawCircle` (filled/outlined) | direct ✓ |
| straight line | `DrawLine` | direct ✓ |
| arc SEGMENT (partial arc) ×29 | tessellate into N short `DrawLine`s | small shim |
| rounded rect (`arcTo`) ×8 | tessellated corner arcs | small shim |
| filled arbitrary path (`fill()`) ×5 | `WritePixels` scanline polygon fill | bounded shim |
| ellipse | scaled-circle tessellation or WritePixels | small |
| anti-aliasing | DrawLine/DrawCircle are ALIASED — supersample 2–4× then `DrawImage` downscale, or manual AA in WritePixels | quality trade |

So the port = one `EditableGlyph` shim module (arc-tessellator + polyline stroke + scanline fill +
optional supersample/downscale) + re-writing the ~18 motif functions against it. Bounded to ~1
module; the ERA table + eraOf/colorOf in TechGlyphs.luau are reused unchanged.

## Budget / constraints (all within limits)

- Resolution: EditableImage max 1024×1024; glyphs are ~24–48px. Supersample to 96–192px for AA
  then downscale — trivially within budget.
- Count: 68 glyphs. Create-once + CACHE (never per-frame redraw); ~68 × 96×96×4B ≈ 2.4 MB, or draw
  on-demand and cache the shown subset, or pack a single atlas EditableImage. Acceptable.
- Perf: one-time procedural draw at first-show; no per-frame cost. No engine/state/RNG touch
  (render-only, golden-neutral).

## Risks / open items for the build phase (not for this spike)

1. AA quality vs the browser's native canvas AA — supersample+downscale closes most of the gap;
   confirm on the glyph-sheet.html review before committing motifs.
2. `WritePixels` scanline fill is the only non-trivial shim piece — needs a correct even-odd
   polygon rasterizer (small, testable in isolation).
3. Motif fidelity is still gated on the SO18 ally motif-concept pass for the ~32 provisional
   motifs — EditableImage unblocks the RENDERING, not the DESIGN of those motifs.

## Recommendation

Promote SO18-motif from "art-gated/parked" to a **scoped agent-executable build** (EditableImage GA
removed the platform blocker): (1) build the `EditableGlyph` shim (tessellator + scanline fill +
supersample), (2) re-implement the motif fns against it, (3) gate it with a glyph-sheet render
check. Keep the era-frame fallback as the graceful default if EditableImage is unavailable on a
given client. Design of the ~32 provisional motifs still needs the ally pass — EditableImage does
not change that.

Verdict authored from API + source analysis; no Studio execution required for a feasibility
verdict. A confirmation render in Studio (one motif through the shim) is the first build-phase step,
not a spike blocker.

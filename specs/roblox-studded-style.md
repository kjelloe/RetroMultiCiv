# Roblox "Studded" world style — style spec (XIV §15)

Third world style for the Roblox client, alongside `retro` and `enhanced`.
Renderer-only, zero engine impact (docs/13 tiers). Spec-first per the XIV §15
task; starts FROM the ally art direction in
`specs/ally-design-response-2026-07-20-evening.md` §2.

**Naming (ruled):** player-facing label **`Studded`**; internal renderer-style
id **`brick`**. IP care — ship only under "Studded"/"Brick"; **never** "LEGO"
or any trademark in code, UI, or copy.

## Guiding rule (ally)

> Preserve gameplay silhouettes and terrain readability first; let the charm
> come from chunky proportions, visible construction, and cheerful color
> blocking.

The Studded look is a complete visual translation, not "current assets + studs."

## Invariants — identical across all three styles

These must NOT change when `brick` is active (ally "what stays consistent"):

- **Terrain-color language** — water / flat land / hills / mountains / forest /
  desert / tundra scan instantly. Uses the SAME shared palette + recipe
  geometry (the `look` layer never forks the source — the existing retro/
  enhanced contract, ViewRenderer §74 comment).
- **Faction recognition** — bases, banners, trim, rings, city markers keep the
  same ownership conventions (Palette/faction system untouched).
- **Unit-class silhouettes** — cavalry ≠ infantry, ships ≠ land, aircraft ≠
  both. Brick may make them chunkier but not merge classes.
- **City progression** — size drives density/scale, era drives roofline
  (`shared/city-era.js` band contract + CITY_TIERS — unchanged).
- **Camera framing, selection, movement readability, fog** — mechanically
  identical (fog-honest: brick is render-only, never touches state/hash).

## Per-element brick direction (ally table → concrete)

| Element | Brick direction | Roblox realization |
|---|---|---|
| Terrain | broad square-ish plateaus, stepped slopes; studs sparingly on flat tops, never so dense tile borders vanish | `BRICK_MATERIAL` per-terrain map (below); studs via `Enum.SurfaceType.Studs` on the TOP face only, at low tactical zoom kept subtle |
| Hills | 2–3 clearly stepped height levels, wide flat tops (not lumpy) | reduce `tileTop(hills)` relief into 2–3 discrete steps; flatter than enhanced |
| Mountains | large faceted/stacked-brick peaks, readable summit cap; unmistakably taller than hills | keep mountains the tallest; cap kept; NO per-tile jitter |
| Forests | round canopies → stacked cones/cylinders or chunky clustered crowns; grouped blocks over many tiny pieces | prop recipe swap: fewer, chunkier canopy blocks |
| Units | slightly oversized "toy army"; broad heads/helmets, clear weapon angles, large readable hulls/wings | scale-up + bevel via material; keep class silhouette |
| Cities | low block clusters small; era cues → increasingly formal block arrangements | CITY_TIERS geometry kept; brick material + chunkier blocks |
| Water | flat bright planes, restrained repeating inset/plate; studs must not compete with ship silhouettes | `ocean/river` → flat bright plane, minimal/no studs |

**Ally emphasis (do / don't):**
- Studs = **punctuation, not blanket noise** — a few studded surfaces set the
  style; studding every face makes the strategic board busy.
- Keep terrain **flatter** than feels tempting — brick gains depth from seams/
  bevels; it needs LESS relief, not more.
- **Chunky color planes**, high saturation OK, but **values must still separate
  categories** — bright grassland ≠ bright forest.
- Cities **charmingly modular** (size-1 ancient = three blocky huts; modern
  large = stacked slabs + dome + spire) — the size×era contract holds.
- **No tiny decorative parts** (flags/windows/tracks/studs) at tactical zoom —
  they turn to static.

## Code insertion points (mapped, ready to build)

The `look` layer is a small, well-contained seam. Adding `brick` is:

1. **Toggle → 3-way cycle.** `Options.client.luau:171` currently flips
   enhanced↔retro. Change to cycle `enhanced → retro → brick → enhanced`.
   Display line `:126` already prints `o.look` verbatim ("world look: brick"
   → player sees "Studded" via a label map; keep internal id `brick`).
2. **`lookOf()` / `lookMode()`.** `ViewRenderer.client.luau:88` and the
   AssetFactory read (`:81`) currently treat anything ≠ "enhanced" as retro.
   Add an explicit `brick` branch (do NOT let brick fall through to retro).
3. **Terrain material.** Add `BRICK_MATERIAL` beside `ENHANCED_MATERIAL`
   (ViewRenderer §78). Proposed: flat plastic bodies with `SurfaceType.Studs`
   on the top face for flats/grassland/plains only; `SmoothPlastic` flat
   planes for water; slate/rock kept for mountains. Saturation boost applied
   to the shared palette shade (a `brickify(color)` HSV bump) — values kept
   separated per the ally readability invariant.
4. **Terrain relief.** In `renderTerrain`, when `look == "brick"`: quantize
   `tileTop` into stepped levels (hills 2–3 steps, flats ~1) — LESS relief
   than enhanced. Mountains stay tallest.
5. **Per-tile cache key.** `tileShown[i]` key already includes `look`
   (`t|visible|look`) — brick invalidates/rebuilds correctly for free.
6. **Assets/props.** `AssetFactory.lookMaterial` (`:81`) gets a `brick` case
   (bevelled brick material + chunkier scale where the recipe allows); forest/
   city prop recipes swap to grouped chunky blocks.

## Screenshot set (docs/13 pattern — required before build sign-off)

Produce via the existing renderer capture path (`debugging/screenshot.sh` /
`gallery.html` through the real renderer, WebGL-flagged):
1. `gallery.html` faction grid + unit silhouettes + city tiers in **brick**
   (asset shots).
2. A seeded world (`?seed=N`) top-down at tactical zoom — terrain-readability
   check: all terrain categories still separable; studs not noisy.
3. Side-by-side retro / enhanced / brick of the same seed (the soundboard
   "user picks by screenshot" pattern, ViewRenderer §77).
4. A hills+mountains close-up — the stepped-relief + taller-mountain check.
5. Desaturation/value-separation acceptance: grayscale the brick shot; terrain
   categories must still separate (ally readability invariant).

## Parity gate (planned — gate 18)

`brick-coverage.mjs`: assert `BRICK_MATERIAL` covers every `data/terrain.json`
id plus `unknown` (the ENHANCED_MATERIAL / mock-state terrain-coverage
pattern), and that `lookOf()`/`lookMaterial` have an explicit brick branch (no
silent fall-through to retro). Golden-neutral (render-only).

## Build order (after screenshot review)

1. Toggle 3-way + `Studded` label map + `brick` branches in lookOf/lookMode.
2. `BRICK_MATERIAL` + `brickify` saturation + stepped relief in renderTerrain.
3. AssetFactory brick material/scale + forest/city prop chunking.
4. Gate 18 + `gallery.html` brick shots.
5. Manifest to sim-runner (golden-neutral, roblox lane).

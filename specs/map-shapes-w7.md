# W7 — novelty map shapes (RULED INTO v1, user 2026-07-27)

One ADDITIVE golden window, sequenced after W6 slices 3–5 and before
W8 (unit-doctrine econ pair). This file is the design contract.

## Pre-design check — PASSED (reviewer #2814–#2816, 2026-07-27)

1. **Prior-art (#2814):** today's 4 mapTypes are preset-only
   landPercent/continents knobs on ONE drunkard's-walk generator
   (mapgen.js:56; A82a preset resolve :235–247) — no mask stage
   exists, so W7's is genuinely new; the `options.mapType` lookup
   (:240) is an additive-clean extension point; existing type ids
   keep their exact path, so existing goldens hold by construction.
2. **Wiki authenticity (#2815):** Civ 1 had NO named map-shape
   selector (Customize World = Land Mass/Temperature/Climate/Age
   sliders); Pangaea/Archipelago/Continents/Inland Sea exist in the
   dump only as Civ4+ articles. NOT a blocker (precedent: the shipped
   presets are themselves non-Civ1). **REQUIREMENT: W7 mapTypes carry
   a provenance note ("later-Civ shapes", civ-mixing convention).**
3. **Determinism/twin flags (#2816):**
   - **wrapX seam:** generateWorld hardcodes `map.wrapX = true`
     (:247) — ring/inland-sea masks run on a CYLINDER, so every mask
     must be wrap-aware at x=0 or it seams (pathing + render). Pin a
     determinism check with a start straddling the seam.
   - **Clover balanced starts = the highest-risk piece** (petal
     placement moves civ starts = different games): it lands INSIDE
     the golden window with its own pin + pure-int twin; the
     ship-behind / fall-to-v1.x fallback below is endorsed.
   - Per-shape JS==Luau pins (incl. fractal) + per-water-shape naval
     soaks endorsed.

## What ships

New `rules.mapTypes` entries + mapgen support, all additive (existing
type ids and their generation paths byte-untouched → existing goldens
hold; each NEW type gets its own maptype pin pair, JS==Luau):

1. **fractal** — an erraticness/roughness variant of the existing
   drunkard's-walk generator (possibly preset-only knobs: more, smaller
   walk budgets + jitter). Cheapest item; do first as the window's
   smoke test.
2. **oval** — Pangaea variant masked to a smoothed oval with
   randomized coastal bays.
3. **ring** (donut) — circular landmass around a central sea; explicit
   clockwise/counter-clockwise neighbor paths.
4. **inland-sea** — land ring along the map borders, ocean locked in
   the center.
5. **clover** (four-leaf / snowflake family) — symmetric petals per
   start region choking to a contested center. **The hidden cost is
   BALANCED STARTS**: petal-assignment start placement (one civ per
   petal, symmetric quality) — without it the shape loses its point.
   Budget this as its own sub-slice; if it drags, clover ships behind
   the others or falls back to v1.x by user call.

Mechanism: a MASK STAGE in `engine/mapgen.js` — the land-blob budget
is confined to a per-type mask function (pure, integer math, twins
byte-shaped to `luau/`). Fractal is generator-knobs, not a mask.

## Explicitly OUT (deferred, user 2026-07-27)

- **Toroidal wrap** (Y-wrap) — touches every distance/direction/BFS
  calculation, mapgen pole handling, fog, minimap, renderer tiling, AI
  pathing + the full Luau twin of all of it. Stays on the v2 shelf.
- Cylindrical + flat wraps need NO work: `map.wrapX` already
  implements both (movement.js wrapX/DIRS distance math).

## Gates & verification

- Per-shape: maptype pin (the luau-twins gate pattern, extending the
  existing 4-pin table) + a scenario-free determinism check (same seed
  → same hash, JS==Luau).
- Water-heavy shapes (ring, inland-sea, archipelago-like fractals): a
  mini naval-acceptance soak each (the naval arc's acceptance was
  archipelago-specific — AI must not faceplant on the new topology).
- One canonical 25-seed sweep on the DEFAULT type at the end proves
  the window was truly additive (goldens unmoved = the cheap proof).
- Client/lobby: setup screen + LAN lobby type picker rows +
  `?maptype=` param; Roblox inherits mapgen via the twin, needs only
  the picker addition (roblox-helper, golden-neutral).

## Estimate

~2–3 days including gates; +~1 day if clover's balanced starts are
done properly. Fractal+oval land first (low risk), ring/inland-sea
next (naval soaks), clover last.

## Delivery log

**2026-07-29 — landing 1 (mask stage + four shapes), local green, gates pending.**
Fixture-first: `test/map-shapes.test.js` 6/6 (was 3 RED before the engine
change). What shipped:

- **The mask stage** (`engine/mapgen.js` `maskAllows` + a `mask` argument to
  `generateTiles`, twinned byte-shaped in `luau/mapgen.luau`). Geometry:
  offsets from the map centre in DOUBLED coordinates (so the centre is exact
  on even sizes), expressed as PERCENT of the half-extent — a shape is
  therefore size-independent and needs no per-size tuning. `maskAllows`
  returns false inside `innerPct` and outside `outerPct`; both default to 0
  (= no constraint on that side).
- **Wrap-awareness**: the x offset takes the short way round the cylinder
  (`if (width*2 - dx < dx) dx = width*2 - dx`). The pre-design flagged the
  seam as the determinism risk; the `inland-sea` fixture is the guard — its
  rim must carry land at both `x < 3` and `x > W-4`, which a left-edge-based
  mask cannot do.
- **Start placement under a mask**: the drunkard's walk needs a start INSIDE
  the mask or it spends its whole budget in forbidden sea. Bounded re-rolls
  (40 tries, so the RNG draw count stays finite and identical in both
  engines), then a deterministic index-order scan as the fallback. Step
  budget goes from `budget*10` to `budget*20` when a mask is present, since a
  masked walk wastes steps outside the shape. Unmasked types keep both the
  old start pick and the old budget — the legacy path is byte-untouched.
- **Presets** (`data/rules.json`): `fractal` (knobs only — 26% land over 30
  walks, NO mask and NO engine code), `oval` (outer 95), `ring` (inner 45,
  outer 95), `inland-sea` (inner 50). Each carries the REQUIRED
  `provenance` field ("later-Civ shape (Civ 1 had no map-shape selector)"),
  which the setup screen now shows in its hint line.

**Geometry decision — `ring` is a donut around the map centre, not a belt
around the cylinder.** With a wrap-aware x offset, `x=0` is the FARTHEST
column from the centre, so the annulus excludes both the middle and the
extreme columns: sea inside, sea outside, land between. A belt (land that
closes all the way round the cylinder) is the `inland-sea` shape instead.
The ring fixture therefore asserts the donut property (land above AND below
the central sea) and the seam assertion lives with `inland-sea`.

**Client:** the picker was already data-driven from `rules.mapTypes`, so the
new shapes appear with no client work. The stale A82a gate group ("Advanced —
naval AI in progress") was RETIRED in the same pass — that caveat has been
false since the naval arc shipped (transport + overseas invasion, 25/25
archipelago acceptance). Groups are now Classic / Novelty shapes.

**Stamp cascade (expected, in progress):** adding `rules.mapTypes` entries
moves `rulesetHash`, so every createGame-stamped golden re-records. Done so
far: the eight maptype pins (`continents d189d249`, `pangaea 03c3e94e`,
`archipelago d46f37b3`, `islands 641d9ffb`, `fractal c101dbef`, `oval
83e8c7cb`, `ring ada85829`, `inland-sea 9ec72288`) and scenario 002
(`0x075cd7cf`). Pending: the #28 discriminator classification (expected
STAMP-ONLY — existing types generate identically), age-snapshot
`CANONICAL_PIN`, `FF_PARITY`, `GOLDEN_SOAK`/`GOLDEN_NATURAL`, sim-smoke t100.

**Still to come in this window:** clover with balanced petal starts (its own
sub-slice, per the contract), the per-shape naval acceptance runs for the
water-heavy shapes against the sim-runner's pre-baseline, and the closing
canonical sweep on the DEFAULT type that proves the window was additive.

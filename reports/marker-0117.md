# marker-0117 — the zoom-detail pass (H6–H8)

**Tag:** `marker-0117` at the report commit (code tip `68bd71d`) ·
**merge-consistent — the user may merge this** (supersedes marker-0116;
merge THIS one). Client-only, High-tier-only, golden-neutral; Low and
Medium byte-verified untouched.

From the user's review of the v2 tier sheet (2026-08-14): resource animals
needed real vertex budgets, outer houses needed zoom-visible doors and
windows, and every human figure needed a proper body — "Roblox R15 style
torso instead of cone".

- **H6 — animals.** Tier-split `SPECIAL_MOTIF_HIGH`: at High, the deer
  (forest + tundra), horse, seal and fish are rebuilt on 11 new
  high-segment prop shapes — jointed legs with hooves, antler beams with
  tine racks, real fins, horns. Special forest tiles become clearings at
  High so the deer isn't buried in the H2 canopy. The settler wagon's oxen
  get rounded horned anatomy. Low/Medium keep the H1 poses untouched.
- **H7 — figures.** Every human at High is a rounded R15: boots, jointed
  legs, pelvis, split torso, shoulder spheres, neck, 16-segment head.
  Five standing figures rebuilt (footSoldier, phalanx, musketeers,
  riflemen, diplomat); the mounted and knight riders and the wagon driver
  sit as seated R15s with saddle-hung legs. All helmets, crests, weapons
  and kit repositioned to the new frame.
- **H8 — facades.** Outer-ring houses (the zoom-visible ones): framed lit
  window panes, a door with stone lintel and doorstep on every outer
  house, gable trim, and every other outer house two-storey with an upper
  window row. Inner houses stay simple — they're occluded.

All three variant picks user-confirmed (anatomical / game-proportions /
mixed-storeys — each the in-tree recommendation;
`debugging/h6-h8-variants.html`).

**Instrument note:** `debugging/screenshot.sh` virtual-time budget 6s→9s —
the heavier High gallery began racing the old budget flaky (measured,
retried, then raised with the reason stated).

Test state: battery 22/22 (asset-recipes/mock-state/render-spec/
graphics-level/tracked-imports), `graphics-levels.spec` 3/3, Low
byte-identical, Medium deterministic and tier-split-unchanged,
asset-recipes regenerated (50 prop shapes).

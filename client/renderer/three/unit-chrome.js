// A88b: the per-RECIPE render "chrome" that createUnitMesh layers on top of the
// silhouette body — the pennant offset, the naval base height, and the one
// procedural extra (the sail plane). PURE DATA (no THREE, no DOM), keyed by the
// recipe name that UNIT_SILHOUETTE (recipes.js) already maps every unit type to.
// This is the SINGLE source the data-driven dispatch reads, killing the old
// per-type function ladder (assets.js) that hardcoded a second copy of the
// recipe mapping (my A67 drift-risk finding). A Node coverage gate
// (test/asset-recipes.test.js) asserts every UNIT_SILHOUETTE recipe has an entry
// here, so no unit can fall to an unstyled path.
//
// pennant: [x, y, scale] offset, or absent = no pennant (aircraft).
// naval:   true = the base disc sits lower (ships ride the water).
// sail:    true = add the procedural canvas sail plane (sail ships).
// plain:   true = the all-neutral fallback token (no visual, no pennant).

export const RECIPE_CHROME = {
  footSoldier: { pennant: [-0.16, 0.3, 0.7] },
  wagon:       { pennant: [-0.3, 0.32, 0.7] },
  mounted:     { pennant: [-0.28, 0.34, 0.7] },
  siege:       { pennant: [-0.26, 0.3, 0.65] },
  tank:        { pennant: [-0.28, 0.3, 0.62] },
  apc:         { pennant: [-0.28, 0.3, 0.62] },
  catapult:    { pennant: [-0.26, 0.3, 0.65] },
  diplomat:    { pennant: [-0.16, 0.3, 0.7] },
  shipSail:    { pennant: [-0.28, 0.14, 0.65], naval: true, sail: true },
  shipSub:     { pennant: [-0.28, 0.14, 0.65], naval: true },
  shipPowered: { pennant: [-0.28, 0.14, 0.65], naval: true },
  aircraft:    {},              // no pennant
  fallback:    { plain: true }  // all-neutral token, no visual, no pennant
};

// type-level extra primitive appended after the body (before the pennant):
// the chariot rides the 'mounted' body + its own wheels.
export const TYPE_EXTRA = { chariot: 'chariotWheels' };

// H4 (specs/graphics-levels.md §4b): MODEL-grade HIGH unit bodies — the
// Transport World watermark tier. Same primitive format and colorRole slots
// as recipes.js/recipes-high.js; consumed ONLY at level 'high', silhouettes
// absent here fall back to the medium (recipes-high) body, so the tier lands
// batch by batch. Batch 1 (2026-08-13): the eight flagship bodies —
// footSoldier, phalanx, mounted, knight, tank, shipSail, shipPowered,
// aircraft. Batch 2 (remaining 13 silhouettes) follows.
//
// Authoring rules: footprints/palette match the medium bodies (the tier is
// MORE detail, not different art); weapons on +x; segment counts are final
// (no segMult on this table — geometryFor caches per literal seg).
const H = {
  legL: { shape: 'cyl', size: [0.026, 0.032, 0.13], seg: 8, pos: [-0.015, 0.095, -0.05], color: 'cloth' },
  legR: { shape: 'cyl', size: [0.026, 0.032, 0.13], seg: 8, pos: [-0.005, 0.095, 0.05], color: 'cloth' },
  bootL: { shape: 'box', size: [1, 1, 1], pos: [0.0, 0.02, -0.05], scale: [0.06, 0.03, 0.04], color: 'wood' },
  bootR: { shape: 'box', size: [1, 1, 1], pos: [0.01, 0.02, 0.05], scale: [0.06, 0.03, 0.04], color: 'wood' },
  belt: { shape: 'cyl', size: [0.093, 0.098, 0.03], seg: 12, pos: [0, 0.33, 0], color: 'wood' }
};

// H7 (spec §4b, user ruling 2026-08-14): every human figure is a ROUNDED
// R15 — separate upper/lower torso, pelvis, jointed limbs, neck, high-seg
// head — soft edges, not a literal Roblox avatar. R15(torso, legs) returns
// the standing core; arms and kit stay hand-placed per figure. Head lands
// at ~0.5 (old cone figures' ~0.55) so helmets/weapons stay close to true.
const R15 = (torso, legs) => [
  { shape: 'box', size: [1, 1, 1], pos: [0, 0.03, -0.028], scale: [0.062, 0.03, 0.042], color: 'wood' },
  { shape: 'box', size: [1, 1, 1], pos: [0.008, 0.03, 0.028], scale: [0.062, 0.03, 0.042], color: 'wood' },
  { shape: 'cyl', size: [0.015, 0.018, 0.09], seg: 10, pos: [0, 0.095, -0.028], color: legs },
  { shape: 'cyl', size: [0.015, 0.018, 0.09], seg: 10, pos: [0.005, 0.095, 0.028], color: legs },
  { shape: 'cyl', size: [0.018, 0.021, 0.09], seg: 10, pos: [0, 0.18, -0.028], color: legs },
  { shape: 'cyl', size: [0.018, 0.021, 0.09], seg: 10, pos: [0.003, 0.18, 0.028], color: legs },
  { shape: 'box', size: [1, 1, 1], pos: [0, 0.245, 0], scale: [0.078, 0.045, 0.095], color: legs },
  { shape: 'box', size: [1, 1, 1], pos: [0, 0.3, 0], scale: [0.082, 0.065, 0.1], color: torso },
  { shape: 'box', size: [1, 1, 1], pos: [0, 0.375, 0], scale: [0.095, 0.085, 0.115], color: torso },
  { shape: 'sphere', size: [0.026], seg: [10, 8], pos: [0, 0.415, -0.062], color: torso },
  { shape: 'sphere', size: [0.026], seg: [10, 8], pos: [0, 0.415, 0.062], color: torso },
  { shape: 'cyl', size: [0.019, 0.021, 0.035], seg: 10, pos: [0, 0.445, 0], color: 'skin' },
  { shape: 'sphere', size: [0.052], seg: [16, 12], pos: [0, 0.5, 0], color: 'skin' }
];
const armIdle2 = (color, zs) => [
  { shape: 'cyl', size: [0.014, 0.017, 0.07], seg: 8, pos: [0.005, 0.375, zs * 0.075], rot: [zs * 0.12, 0, 0.08], color },
  { shape: 'cyl', size: [0.012, 0.014, 0.065], seg: 8, pos: [0.012, 0.31, zs * 0.082], rot: [zs * 0.12, 0, 0.12], color },
  { shape: 'sphere', size: [0.016], seg: [8, 6], pos: [0.018, 0.275, zs * 0.086], color: 'skin' }
];
const armReach2 = (color, zs, lift) => [
  { shape: 'cyl', size: [0.014, 0.017, 0.075], seg: 8, pos: [0.04, 0.4 + lift * 0.32, zs * 0.07], rot: [0, 0, -0.9 - lift * 0.5], color },
  { shape: 'cyl', size: [0.012, 0.014, 0.07], seg: 8, pos: [0.095, 0.42 + lift * 0.42, zs * 0.065], rot: [0, 0, -1.2 - lift * 0.5], color },
  { shape: 'sphere', size: [0.016], seg: [8, 6], pos: [0.125, 0.435 + lift * 0.47, zs * 0.06], color: 'skin' }
];
// a SEATED R15 (riders, drivers): pelvis-up, legs as saddle-hung stubs
const R15seated = (torso, legs, dx, dy) => [
  { shape: 'cyl', size: [0.017, 0.02, 0.07], seg: 10, pos: [dx + 0.04, dy + 0.01, -0.05], rot: [0, 0, -1.1], color: legs },
  { shape: 'cyl', size: [0.017, 0.02, 0.07], seg: 10, pos: [dx + 0.04, dy + 0.01, 0.05], rot: [0, 0, -1.1], color: legs },
  { shape: 'box', size: [1, 1, 1], pos: [dx, dy + 0.03, 0], scale: [0.075, 0.04, 0.09], color: legs },
  { shape: 'box', size: [1, 1, 1], pos: [dx, dy + 0.08, 0], scale: [0.078, 0.06, 0.095], color: torso },
  { shape: 'box', size: [1, 1, 1], pos: [dx, dy + 0.15, 0], scale: [0.09, 0.08, 0.108], color: torso },
  { shape: 'sphere', size: [0.024], seg: [10, 8], pos: [dx, dy + 0.185, -0.058], color: torso },
  { shape: 'sphere', size: [0.024], seg: [10, 8], pos: [dx, dy + 0.185, 0.058], color: torso },
  { shape: 'cyl', size: [0.018, 0.02, 0.03], seg: 10, pos: [dx, dy + 0.21, 0], color: 'skin' },
  { shape: 'sphere', size: [0.048], seg: [16, 12], pos: [dx, dy + 0.26, 0], color: 'skin' }
];

export const MODEL_UNIT_RECIPES = {
  // ---- the spearman, fully kitted: stance, belt, cheek-guard helm, butt spike
  footSoldier: R15('cloth', 'cloth').concat(armReach2('cloth', 1, 0.1)).concat(armIdle2('cloth', -1)).concat([
    { shape: 'sphere', size: [0.06], seg: [14, 10], pos: [0, 0.525, 0], scale: [1, 0.8, 1], color: 'metal' },   // helm dome
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.485, -0.05], scale: [0.04, 0.05, 0.012], color: 'metal' },      // cheek guards
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.485, 0.05], scale: [0.04, 0.05, 0.012], color: 'metal' },
    { shape: 'box', size: [0.02, 0.08, 0.01], pos: [0, 0.59, 0], color: 'primary' },                            // crest
    { shape: 'cyl', size: [0.011, 0.011, 0.72], seg: 10, pos: [0.13, 0.42, 0.06], rot: [0, 0, -0.08], color: 'wood' },
    { shape: 'cone', size: [0.038, 0.12], seg: 10, pos: [0.16, 0.8, 0.06], rot: [0, 0, -0.08], color: 'metal' },
    { shape: 'cone', size: [0.018, 0.045], seg: 8, pos: [0.1, 0.07, 0.06], rot: [0, 0, 3.06], color: 'darkMetal' },
    { shape: 'box', size: [0.02, 0.2, 0.14], pos: [-0.09, 0.33, -0.05], rot: [0, 0.25, 0.1], color: 'wood' },
    { shape: 'sphere', size: [0.03], seg: [10, 8], pos: [-0.104, 0.33, -0.05], color: 'metal' }
  ]),
  // ---- the hoplite: the big shield forward, crest cross-wise, greaves
  phalanx: R15('cloth', 'cloth').concat(armReach2('cloth', 1, 0.15)).concat([
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.095, -0.028], scale: [0.034, 0.08, 0.044], color: 'metal' },    // greaves
    { shape: 'box', size: [1, 1, 1], pos: [0.005, 0.095, 0.028], scale: [0.034, 0.08, 0.044], color: 'metal' },
    { shape: 'sphere', size: [0.06], seg: [14, 10], pos: [0, 0.525, 0], scale: [1, 0.8, 1], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.585, 0], scale: [0.075, 0.045, 0.014], rot: [1.5707963267948966, 0, 0], color: 'primary' },
    { shape: 'cyl', size: [0.011, 0.011, 0.72], seg: 10, pos: [0.12, 0.44, 0.06], rot: [0, 0, -0.1], color: 'wood' },
    { shape: 'cone', size: [0.038, 0.12], seg: 10, pos: [0.15, 0.82, 0.06], rot: [0, 0, -0.1], color: 'metal' },
    { shape: 'cyl', size: [0.14, 0.14, 0.02], seg: 22, pos: [-0.1, 0.34, 0.02], rot: [1.5707963267948966, 0, 0.14], color: 'primary' },
    { shape: 'cyl', size: [0.145, 0.145, 0.007], seg: 22, pos: [-0.107, 0.34, 0.022], rot: [1.5707963267948966, 0, 0.14], color: 'metal' },
    { shape: 'sphere', size: [0.033], seg: [10, 8], pos: [-0.114, 0.34, 0.024], color: 'darkMetal' }
  ]),
  // ---- cavalry: horse with mane/ears/hooves, saddle blanket, sword raised
  mounted: [
    { shape: 'sphere', size: [0.13], seg: [16, 12], pos: [0, 0.31, 0], scale: [1.55, 0.82, 0.68], color: 'horse' },
    { shape: 'cyl', size: [0.028, 0.044, 0.16], seg: 10, pos: [0.16, 0.43, 0], rot: [0, 0, -0.5], color: 'horse' },
    { shape: 'sphere', size: [0.052], seg: [12, 10], pos: [0.235, 0.51, 0], color: 'horse' },
    { shape: 'box', size: [0.078, 0.038, 0.042], pos: [0.295, 0.495, 0], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [0.19, 0.5, 0], scale: [0.1, 0.09, 0.012], rot: [0, 0, -0.6], color: 'darkMetal' }, // mane strip
    { shape: 'cone', size: [0.011, 0.038], seg: 5, pos: [0.23, 0.565, -0.02], color: 'darkMetal' },
    { shape: 'cone', size: [0.011, 0.038], seg: 5, pos: [0.23, 0.565, 0.02], color: 'darkMetal' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [-0.125, 0.12, -0.05], color: 'horse' },   // legs
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [-0.125, 0.12, 0.05], color: 'horse' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [0.125, 0.12, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [0.125, 0.12, 0.05], color: 'horse' },
    { shape: 'cyl', size: [0.017, 0.017, 0.028], seg: 8, pos: [-0.125, 0.03, -0.05], color: 'darkMetal' }, // hooves
    { shape: 'cyl', size: [0.017, 0.017, 0.028], seg: 8, pos: [-0.125, 0.03, 0.05], color: 'darkMetal' },
    { shape: 'cyl', size: [0.017, 0.017, 0.028], seg: 8, pos: [0.125, 0.03, -0.05], color: 'darkMetal' },
    { shape: 'cyl', size: [0.017, 0.017, 0.028], seg: 8, pos: [0.125, 0.03, 0.05], color: 'darkMetal' },
    { shape: 'cone', size: [0.017, 0.13], seg: 6, pos: [-0.2, 0.28, 0], rot: [0, 0, 2.7], color: 'darkMetal' }, // tail
    { shape: 'box', size: [0.15, 0.018, 0.13], pos: [-0.02, 0.405, 0], color: 'primary' },              // saddle blanket
    { shape: 'box', size: [0.08, 0.03, 0.08], pos: [-0.02, 0.43, 0], color: 'wood' }                    // saddle
  ].concat(R15seated('cloth', 'cloth', -0.02, 0.44)).concat([
    { shape: 'sphere', size: [0.052], seg: [14, 10], pos: [-0.02, 0.72, 0], scale: [1, 0.72, 1], color: 'metal' }, // helmet
    { shape: 'cyl', size: [0.013, 0.016, 0.09], seg: 8, pos: [0.03, 0.62, 0.05], rot: [0, 0, -1.3], color: 'cloth' }, // sword arm
    { shape: 'cyl', size: [0.011, 0.013, 0.08], seg: 8, pos: [0.08, 0.66, 0.05], rot: [0, 0, -1.6], color: 'cloth' },
    { shape: 'sphere', size: [0.015], seg: [8, 6], pos: [0.115, 0.665, 0.05], color: 'skin' },
    { shape: 'box', size: [1, 1, 1], pos: [0.14, 0.72, 0.05], scale: [0.014, 0.13, 0.007], rot: [0, 0, -0.5], color: 'metal' } // sword
  ]),
  // ---- knights: the armored charger — caparison skirt, chanfron, couched lance
  knight: [
    { shape: 'sphere', size: [0.13], seg: [16, 12], pos: [0, 0.31, 0], scale: [1.55, 0.82, 0.68], color: 'horse' },
    { shape: 'box', size: [0.34, 0.2, 0.19], pos: [0, 0.24, 0], color: 'primary' },                     // caparison skirt
    { shape: 'box', size: [0.34, 0.02, 0.21], pos: [0, 0.35, 0], color: 'secondary' },                  // trim line
    { shape: 'cyl', size: [0.028, 0.044, 0.16], seg: 10, pos: [0.16, 0.43, 0], rot: [0, 0, -0.5], color: 'horse' },
    { shape: 'sphere', size: [0.052], seg: [12, 10], pos: [0.235, 0.51, 0], color: 'horse' },
    { shape: 'box', size: [0.085, 0.042, 0.046], pos: [0.295, 0.5, 0], color: 'metal' },                // chanfron
    { shape: 'cone', size: [0.011, 0.04], seg: 5, pos: [0.23, 0.565, -0.02], color: 'metal' },          // armored ears
    { shape: 'cone', size: [0.011, 0.04], seg: 5, pos: [0.23, 0.565, 0.02], color: 'metal' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [-0.125, 0.12, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [-0.125, 0.12, 0.05], color: 'horse' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [0.125, 0.12, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.015, 0.019, 0.15], seg: 8, pos: [0.125, 0.12, 0.05], color: 'horse' },
    { shape: 'cone', size: [0.017, 0.12], seg: 6, pos: [-0.2, 0.27, 0], rot: [0, 0, 2.7], color: 'darkMetal' },
    { shape: 'box', size: [0.08, 0.03, 0.08], pos: [-0.02, 0.42, 0], color: 'wood' } // saddle
  ].concat(R15seated('metal', 'metal', -0.02, 0.43)).concat([
    { shape: 'sphere', size: [0.056], seg: [14, 10], pos: [-0.02, 0.7, 0], color: 'metal' },            // great helm over the head
    { shape: 'box', size: [1, 1, 1], pos: [-0.02, 0.695, 0.055], scale: [0.045, 0.01, 0.008], color: 'darkMetal' }, // visor slit
    { shape: 'box', size: [0.018, 0.06, 0.018], pos: [-0.02, 0.77, 0], color: 'primary' },               // plume
    { shape: 'cyl', size: [0.015, 0.015, 0.72], seg: 10, pos: [0.16, 0.58, 0.07], rot: [0, 0, -1.45], color: 'wood' },
    { shape: 'cyl', size: [0.028, 0.028, 0.03], seg: 10, pos: [0.05, 0.545, 0.07], rot: [0, 0, -1.45], color: 'metal' }, // lance guard
    { shape: 'cone', size: [0.026, 0.09], seg: 10, pos: [0.54, 0.63, 0.07], rot: [0, 0, -1.45], color: 'metal' },
    { shape: 'box', size: [0.02, 0.17, 0.12], pos: [-0.09, 0.52, 0.1], color: 'primary' },              // heater shield
    { shape: 'box', size: [0.008, 0.17, 0.02], pos: [-0.1, 0.52, 0.1], color: 'secondary' }             // shield chevron
  ]),
  // ---- armor: treads with road wheels + sprockets, skirts, mantlet, cupola
  tank: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.17, 0], scale: [0.5, 0.12, 0.3], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0.24, 0.19, 0], scale: [0.1, 0.09, 0.28], rot: [0, 0, 0.5], color: 'hull' },  // glacis
    { shape: 'box', size: [1, 1, 1], pos: [-0.24, 0.18, 0], scale: [0.08, 0.08, 0.28], rot: [0, 0, -0.4], color: 'hull' }, // rear deck
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.09, -0.17], scale: [0.56, 0.09, 0.08], color: 'darkMetal' },  // tread runs
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.09, 0.17], scale: [0.56, 0.09, 0.08], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.145, -0.17], scale: [0.58, 0.02, 0.09], color: 'hull' },      // side skirts
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.145, 0.17], scale: [0.58, 0.02, 0.09], color: 'hull' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [-0.2, 0.07, -0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [-0.07, 0.07, -0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [0.07, 0.07, -0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [0.2, 0.07, -0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [-0.2, 0.07, 0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [-0.07, 0.07, 0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [0.07, 0.07, 0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 12, pos: [0.2, 0.07, 0.215], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'sphere', size: [0.02], seg: [8, 6], pos: [-0.2, 0.07, -0.23], color: 'darkMetal' },  // hubs (outer row)
    { shape: 'sphere', size: [0.02], seg: [8, 6], pos: [0.07, 0.07, -0.23], color: 'darkMetal' },
    { shape: 'sphere', size: [0.02], seg: [8, 6], pos: [-0.07, 0.07, 0.23], color: 'darkMetal' },
    { shape: 'sphere', size: [0.02], seg: [8, 6], pos: [0.2, 0.07, 0.23], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.31, 0], scale: [0.26, 0.12, 0.22], color: 'hull' },       // turret
    { shape: 'box', size: [1, 1, 1], pos: [-0.16, 0.31, 0], scale: [0.06, 0.1, 0.18], color: 'hull' },        // bustle
    { shape: 'cyl', size: [0.05, 0.06, 0.055], seg: 12, pos: [0.1, 0.31, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' }, // mantlet
    { shape: 'cyl', size: [0.018, 0.02, 0.5], seg: 10, pos: [0.36, 0.32, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.58, 0.32, 0], scale: [0.05, 0.034, 0.034], color: 'darkMetal' }, // muzzle brake
    { shape: 'sphere', size: [0.05], seg: [12, 8], pos: [-0.08, 0.39, 0.06], scale: [1, 0.55, 1], color: 'hull' }, // cupola
    { shape: 'box', size: [1, 1, 1], pos: [-0.08, 0.415, 0.06], scale: [0.05, 0.008, 0.05], color: 'darkMetal' }, // hatch
    { shape: 'cyl', size: [0.004, 0.004, 0.24], seg: 4, pos: [-0.2, 0.47, -0.08], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.28, 0.13, -0.1], scale: [0.03, 0.02, 0.02], color: 'darkMetal' }, // tow hooks
    { shape: 'box', size: [1, 1, 1], pos: [0.28, 0.13, 0.1], scale: [0.03, 0.02, 0.02], color: 'darkMetal' }
  ],
  // ---- sail ships: planked hull, keel line, castles, two masts + nest, rudder
  shipSail: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.15, 0], scale: [0.5, 0.13, 0.2], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.1, 0], scale: [0.52, 0.02, 0.21], color: 'darkMetal' },   // waterline plank
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.17, 0], scale: [0.52, 0.014, 0.21], color: 'wheel' },     // upper plank line
    { shape: 'cone', size: [1, 1], seg: 6, pos: [0.28, 0.15, 0], scale: [0.1, 0.11, 0.1], rot: [0, 0, -1.5707963267948966], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.05, 0.06, 0], scale: [0.4, 0.03, 0.05], color: 'darkMetal' },   // keel
    { shape: 'box', size: [1, 1, 1], pos: [-0.27, 0.24, 0], scale: [0.1, 0.11, 0.17], color: 'wood' },        // sterncastle
    { shape: 'box', size: [1, 1, 1], pos: [-0.31, 0.26, -0.045], scale: [0.02, 0.03, 0.025], color: 'canvas' }, // stern windows
    { shape: 'box', size: [1, 1, 1], pos: [-0.31, 0.26, 0.045], scale: [0.02, 0.03, 0.025], color: 'canvas' },
    { shape: 'box', size: [1, 1, 1], pos: [0.17, 0.22, 0], scale: [0.09, 0.06, 0.17], color: 'wood' },        // fo'c'sle
    { shape: 'cyl', size: [0.009, 0.011, 0.22], seg: 6, pos: [0.39, 0.22, 0], rot: [0, 0, -1.15], color: 'wood' }, // bowsprit
    { shape: 'cyl', size: [0.012, 0.014, 0.72], seg: 8, pos: [-0.04, 0.46, 0], color: 'wood' },               // main mast
    { shape: 'cyl', size: [0.007, 0.007, 0.3], seg: 6, pos: [-0.04, 0.63, 0], rot: [1.5707963267948966, 0, 0], color: 'wood' },
    { shape: 'cyl', size: [0.022, 0.026, 0.035], seg: 10, pos: [-0.04, 0.72, 0], color: 'wood' },             // crow's nest
    { shape: 'cyl', size: [0.01, 0.012, 0.46], seg: 8, pos: [0.14, 0.35, 0], color: 'wood' },                 // foremast
    { shape: 'cyl', size: [0.006, 0.006, 0.22], seg: 6, pos: [0.14, 0.5, 0], rot: [1.5707963267948966, 0, 0], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.32, 0.12, 0], scale: [0.02, 0.09, 0.014], color: 'wood' }       // rudder
  ],
  // ---- powered warships: deck line, twin funnels + caps, bridge windows,
  // twin-barrel turrets, lifeboats, masts
  shipPowered: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.15, 0], scale: [0.5, 0.13, 0.2], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.1, 0], scale: [0.52, 0.02, 0.21], color: 'darkMetal' },
    { shape: 'cone', size: [1, 1], seg: 6, pos: [0.28, 0.15, 0], scale: [0.1, 0.11, 0.1], rot: [0, 0, -1.5707963267948966], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.222, 0], scale: [0.46, 0.018, 0.17], color: 'darkMetal' }, // deck
    { shape: 'cyl', size: [0.042, 0.052, 0.15], seg: 12, pos: [-0.14, 0.3, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.046, 0.046, 0.018], seg: 12, pos: [-0.14, 0.375, 0], color: 'metal' },            // funnel cap
    { shape: 'cyl', size: [0.037, 0.046, 0.12], seg: 12, pos: [-0.02, 0.285, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.041, 0.041, 0.016], seg: 12, pos: [-0.02, 0.345, 0], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.09, 0.28, 0], scale: [0.12, 0.1, 0.12], color: 'hull' },          // bridge
    { shape: 'box', size: [1, 1, 1], pos: [0.15, 0.3, 0], scale: [0.012, 0.03, 0.1], color: 'canvas' },        // bridge windows
    { shape: 'cyl', size: [0.05, 0.056, 0.045], seg: 12, pos: [0.2, 0.25, 0], color: 'darkMetal' },            // fore turret
    { shape: 'cyl', size: [0.009, 0.009, 0.13], seg: 6, pos: [0.27, 0.26, -0.018], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cyl', size: [0.009, 0.009, 0.13], seg: 6, pos: [0.27, 0.26, 0.018], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cyl', size: [0.05, 0.056, 0.045], seg: 12, pos: [-0.25, 0.25, 0], color: 'darkMetal' },          // aft turret
    { shape: 'cyl', size: [0.009, 0.009, 0.13], seg: 6, pos: [-0.32, 0.26, -0.018], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cyl', size: [0.009, 0.009, 0.13], seg: 6, pos: [-0.32, 0.26, 0.018], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cyl', size: [0.012, 0.012, 0.05], seg: 8, pos: [0.03, 0.24, -0.1], rot: [0, 0, 1.5707963267948966], color: 'canvas' }, // lifeboats
    { shape: 'cyl', size: [0.012, 0.012, 0.05], seg: 8, pos: [0.03, 0.24, 0.1], rot: [0, 0, 1.5707963267948966], color: 'canvas' },
    { shape: 'cyl', size: [0.005, 0.006, 0.22], seg: 6, pos: [0.13, 0.38, 0], color: 'metal' },                // foremast
    { shape: 'cyl', size: [0.004, 0.005, 0.16], seg: 6, pos: [-0.2, 0.36, 0], color: 'metal' }                 // aft mast
  ],
  // ---- fighter: cowl + prop + spinner, canopy, tapered wings, gear, tail
  aircraft: [
    { shape: 'cyl', size: [0.048, 0.056, 0.38], seg: 14, pos: [0, 0.33, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cyl', size: [0.052, 0.052, 0.05], seg: 14, pos: [0.22, 0.33, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' }, // engine cowl
    { shape: 'cyl', size: [0.055, 0.055, 0.006], seg: 14, pos: [0.255, 0.33, 0], rot: [0, 0, 1.5707963267948966], color: 'cloth' },   // prop disc
    { shape: 'cone', size: [0.016, 0.04], seg: 10, pos: [0.28, 0.33, 0], rot: [0, 0, -1.5707963267948966], color: 'darkMetal' },      // spinner
    { shape: 'cone', size: [0.045, 0.14], seg: 14, pos: [-0.25, 0.33, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },          // tail taper
    { shape: 'sphere', size: [0.042], seg: [12, 10], pos: [0.05, 0.375, 0], scale: [1.5, 0.68, 0.8], color: 'darkMetal' },            // canopy
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.325, -0.15], scale: [0.14, 0.016, 0.26], rot: [0, 0.1, 0.06], color: 'metal' },    // wings
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.325, 0.15], scale: [0.14, 0.016, 0.26], rot: [0, -0.1, -0.06], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.325, -0.29], scale: [0.09, 0.014, 0.06], rot: [0, 0.1, 0.06], color: 'metal' },    // rounded tips
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.325, 0.29], scale: [0.09, 0.014, 0.06], rot: [0, -0.1, -0.06], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.26, 0.4, 0], scale: [0.07, 0.1, 0.014], color: 'metal' },                               // fin
    { shape: 'box', size: [1, 1, 1], pos: [-0.26, 0.345, 0], scale: [0.05, 0.012, 0.17], color: 'metal' },                            // tailplane
    { shape: 'cyl', size: [0.006, 0.006, 0.06], seg: 6, pos: [0.1, 0.27, -0.07], color: 'darkMetal' },                                // gear legs
    { shape: 'cyl', size: [0.006, 0.006, 0.06], seg: 6, pos: [0.1, 0.27, 0.07], color: 'darkMetal' },
    { shape: 'cyl', size: [0.018, 0.018, 0.012], seg: 10, pos: [0.1, 0.24, -0.07], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' }, // wheels
    { shape: 'cyl', size: [0.018, 0.018, 0.012], seg: 10, pos: [0.1, 0.24, 0.07], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' }
  ]
,  // ---- BATCH 2 (2026-08-13, same window) ----------------------------------
  // settlers/caravan: sprung wagon — canopy hoops, seat + driver, yoked oxen pair
  wagon: [
    { shape: 'box', size: [0.44, 0.15, 0.27], pos: [-0.08, 0.22, 0], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.08, 0.15, 0], scale: [0.46, 0.02, 0.29], color: 'wheel' },   // bed rail
    { shape: 'cyl', size: [0.135, 0.135, 0.38], seg: 18, pos: [-0.08, 0.35, 0], rot: [0, 0, 1.5707963267948966], color: 'canvas' },
    { shape: 'cyl', size: [0.139, 0.139, 0.012], seg: 18, pos: [-0.22, 0.35, 0], rot: [0, 0, 1.5707963267948966], color: 'wheel' }, // hoop rims
    { shape: 'cyl', size: [0.139, 0.139, 0.012], seg: 18, pos: [0.02, 0.35, 0], rot: [0, 0, 1.5707963267948966], color: 'wheel' },
    { shape: 'box', size: [0.09, 0.035, 0.24], pos: [0.13, 0.3, 0], color: 'wood' },                       // seat
    { shape: 'box', size: [1, 1, 1], pos: [0.13, 0.35, -0.04], scale: [0.055, 0.05, 0.07], color: 'cloth' },  // driver torso (seated)
    { shape: 'box', size: [1, 1, 1], pos: [0.13, 0.4, -0.04], scale: [0.06, 0.055, 0.078], color: 'cloth' },
    { shape: 'cyl', size: [0.013, 0.015, 0.024], seg: 10, pos: [0.13, 0.435, -0.04], color: 'skin' },
    { shape: 'sphere', size: [0.036], seg: [14, 10], pos: [0.13, 0.475, -0.04], color: 'skin' },
    { shape: 'cyl', size: [0.011, 0.013, 0.055], seg: 8, pos: [0.17, 0.38, -0.04], rot: [0, 0, -1.1], color: 'cloth' }, // rein arm
    { shape: 'cyl', size: [0.095, 0.095, 0.032], seg: 16, pos: [-0.22, 0.1, -0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.095, 0.095, 0.032], seg: 16, pos: [-0.22, 0.1, 0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.075, 0.075, 0.032], seg: 16, pos: [0.1, 0.08, -0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.075, 0.075, 0.032], seg: 16, pos: [0.1, 0.08, 0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'sphere', size: [0.018], seg: [8, 6], pos: [-0.22, 0.1, -0.18], color: 'darkMetal' },          // hubs
    { shape: 'sphere', size: [0.018], seg: [8, 6], pos: [-0.22, 0.1, 0.18], color: 'darkMetal' },
    { shape: 'cyl', size: [0.011, 0.011, 0.2], seg: 6, pos: [0.24, 0.15, 0], rot: [0, 0, 1.4], color: 'wood' }, // yoke pole
    { shape: 'box', size: [1, 1, 1], pos: [0.33, 0.16, 0], scale: [0.02, 0.02, 0.18], color: 'wood' },      // yoke bar
    // H6: the oxen pair with real anatomy — rounded bodies, horned heads,
    // muzzles, four legs each, tails
    { shape: 'sphere', size: [0.075], seg: [14, 10], pos: [0.37, 0.14, -0.07], scale: [1.5, 1.05, 0.95], color: 'horse' },
    { shape: 'sphere', size: [0.075], seg: [14, 10], pos: [0.37, 0.14, 0.07], scale: [1.5, 1.05, 0.95], color: 'horse' },
    { shape: 'sphere', size: [0.042], seg: [12, 10], pos: [0.46, 0.185, -0.07], color: 'horse' },
    { shape: 'sphere', size: [0.042], seg: [12, 10], pos: [0.46, 0.185, 0.07], color: 'horse' },
    { shape: 'sphere', size: [0.026], seg: [10, 8], pos: [0.5, 0.17, -0.07], scale: [1.2, 0.85, 0.85], color: 'wheel' }, // muzzles
    { shape: 'sphere', size: [0.026], seg: [10, 8], pos: [0.5, 0.17, 0.07], scale: [1.2, 0.85, 0.85], color: 'wheel' },
    { shape: 'cone', size: [0.009, 0.05], seg: 8, pos: [0.45, 0.22, -0.095], rot: [0.9, 0, -0.6], color: 'canvas' }, // horns
    { shape: 'cone', size: [0.009, 0.05], seg: 8, pos: [0.45, 0.22, -0.045], rot: [-0.9, 0, -0.6], color: 'canvas' },
    { shape: 'cone', size: [0.009, 0.05], seg: 8, pos: [0.45, 0.22, 0.045], rot: [0.9, 0, -0.6], color: 'canvas' },
    { shape: 'cone', size: [0.009, 0.05], seg: 8, pos: [0.45, 0.22, 0.095], rot: [-0.9, 0, -0.6], color: 'canvas' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.31, 0.05, -0.095], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.31, 0.05, -0.045], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.31, 0.05, 0.045], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.31, 0.05, 0.095], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.43, 0.05, -0.095], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.43, 0.05, -0.045], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.43, 0.05, 0.045], color: 'horse' },
    { shape: 'cyl', size: [0.011, 0.014, 0.09], seg: 8, pos: [0.43, 0.05, 0.095], color: 'horse' },
    { shape: 'cone', size: [0.008, 0.07], seg: 6, pos: [0.3, 0.13, -0.07], rot: [0, 0, 2.9], color: 'wheel' }, // tails
    { shape: 'cone', size: [0.008, 0.07], seg: 6, pos: [0.3, 0.13, 0.07], rot: [0, 0, 2.9], color: 'wheel' }
  ],
  // chariot extra: spoked wheels (rim + hub + 4 spoke boxes) + basket rail
  chariotWheels: [
    { shape: 'cyl', size: [0.1, 0.1, 0.03], seg: 18, pos: [-0.14, 0.11, -0.13], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.1, 0.1, 0.03], seg: 18, pos: [-0.14, 0.11, 0.13], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'sphere', size: [0.024], seg: [8, 6], pos: [-0.14, 0.11, -0.15], color: 'darkMetal' },
    { shape: 'sphere', size: [0.024], seg: [8, 6], pos: [-0.14, 0.11, 0.15], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.14, 0.11, -0.145], scale: [0.16, 0.012, 0.012], color: 'wood' }, // spokes
    { shape: 'box', size: [1, 1, 1], pos: [-0.14, 0.11, -0.145], scale: [0.012, 0.16, 0.012], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.14, 0.11, 0.145], scale: [0.16, 0.012, 0.012], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.14, 0.11, 0.145], scale: [0.012, 0.16, 0.012], color: 'wood' },
    { shape: 'box', size: [0.13, 0.09, 0.2], pos: [-0.15, 0.19, 0], color: 'wood' },                        // basket
    { shape: 'box', size: [1, 1, 1], pos: [-0.15, 0.245, 0], scale: [0.14, 0.014, 0.22], color: 'wheel' }   // rail
  ],
  // cannon/artillery: rings, elevation screw, spoked wheels, trail + ammo box
  siege: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.18, 0], scale: [0.34, 0.07, 0.2], color: 'wood' },
    { shape: 'cyl', size: [0.115, 0.115, 0.036], seg: 18, pos: [0.02, 0.125, -0.14], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.115, 0.115, 0.036], seg: 18, pos: [0.02, 0.125, 0.14], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'sphere', size: [0.026], seg: [8, 6], pos: [0.02, 0.125, -0.165], color: 'darkMetal' },
    { shape: 'sphere', size: [0.026], seg: [8, 6], pos: [0.02, 0.125, 0.165], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.125, -0.16], scale: [0.19, 0.012, 0.012], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.125, -0.16], scale: [0.012, 0.19, 0.012], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.125, 0.16], scale: [0.19, 0.012, 0.012], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.125, 0.16], scale: [0.012, 0.19, 0.012], color: 'wood' },
    { shape: 'cyl', size: [0.033, 0.043, 0.48], seg: 14, pos: [0.1, 0.3, 0], rot: [0, 0, -1.05], color: 'metal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.02], seg: 14, pos: [0.05, 0.235, 0], rot: [0, 0, -1.05], color: 'darkMetal' },
    { shape: 'cyl', size: [0.04, 0.04, 0.018], seg: 14, pos: [0.17, 0.39, 0], rot: [0, 0, -1.05], color: 'darkMetal' },
    { shape: 'cyl', size: [0.036, 0.036, 0.016], seg: 14, pos: [0.24, 0.48, 0], rot: [0, 0, -1.05], color: 'darkMetal' }, // muzzle ring
    { shape: 'cyl', size: [0.012, 0.012, 0.07], seg: 8, pos: [-0.03, 0.2, 0], color: 'metal' },              // elevation screw
    { shape: 'box', size: [1, 1, 1], pos: [-0.18, 0.13, 0], scale: [0.16, 0.05, 0.05], rot: [0, 0, 0.28], color: 'wood' },
    { shape: 'box', size: [0.07, 0.05, 0.09], pos: [-0.13, 0.22, 0], color: 'wood' }                          // ammo box
  ],
  // catapult: full torsion frame, wound skein, arm + sling cup, winch, stone pile
  catapult: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.16, 0], scale: [0.4, 0.1, 0.24], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.28, -0.1], scale: [0.3, 0.16, 0.035], rot: [0, 0, 0.15], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.28, 0.1], scale: [0.3, 0.16, 0.035], rot: [0, 0, 0.15], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.36, 0], scale: [0.035, 0.035, 0.23], color: 'wood' },      // crossbar
    { shape: 'cyl', size: [0.024, 0.024, 0.24], seg: 10, pos: [0.09, 0.22, 0], rot: [1.5707963267948966, 0, 0], color: 'canvas' }, // skein
    { shape: 'cyl', size: [0.09, 0.09, 0.038], seg: 16, pos: [-0.12, 0.1, -0.135], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.038], seg: 16, pos: [-0.12, 0.1, 0.135], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.038], seg: 16, pos: [0.13, 0.1, -0.135], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.038], seg: 16, pos: [0.13, 0.1, 0.135], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.05, 0.37, 0], scale: [0.055, 0.42, 0.045], rot: [0, 0, 0.6], color: 'wood' }, // arm
    { shape: 'cyl', size: [0.05, 0.058, 0.05], seg: 12, pos: [-0.17, 0.54, 0], rot: [0, 0, -0.5], color: 'wood' },
    { shape: 'sphere', size: [0.042], seg: [10, 8], pos: [-0.17, 0.565, 0], color: 'stone' },
    { shape: 'cyl', size: [0.02, 0.02, 0.2], seg: 8, pos: [0.17, 0.2, 0], rot: [1.5707963267948966, 0, 0], color: 'wood' }, // winch
    { shape: 'box', size: [1, 1, 1], pos: [0.17, 0.2, -0.12], scale: [0.06, 0.012, 0.012], color: 'wood' },   // winch handle
    { shape: 'sphere', size: [0.03], seg: [8, 6], pos: [-0.05, 0.06, 0.09], color: 'stone' },                 // stone pile
    { shape: 'sphere', size: [0.026], seg: [8, 6], pos: [0.0, 0.055, 0.11], color: 'stone' },
    { shape: 'sphere', size: [0.024], seg: [8, 6], pos: [-0.02, 0.09, 0.11], color: 'stone' }
  ],
  // diplomat: robed envoy — hat, cloak, satchel with strap, raised sealed scroll
  diplomat: R15('canvas', 'canvas').concat(armIdle2('canvas', -1)).concat([
    { shape: 'cone', size: [0.13, 0.16], seg: 16, pos: [0, 0.26, 0], color: 'cloth' },                 // cloak hem
    { shape: 'cyl', size: [0.09, 0.09, 0.013], seg: 18, pos: [0, 0.55, 0], color: 'wood' },            // hat brim
    { shape: 'sphere', size: [0.045], seg: [14, 10], pos: [0, 0.565, 0], scale: [1, 0.6, 1], color: 'wood' },
    { shape: 'cyl', size: [0.013, 0.016, 0.14], seg: 8, pos: [0.075, 0.42, 0.04], rot: [0.2, 0, -1.2], color: 'canvas' },
    { shape: 'cyl', size: [0.018, 0.018, 0.09], seg: 12, pos: [0.14, 0.485, 0.05], rot: [0.3, 0, -0.3], color: 'canvas' },
    { shape: 'cyl', size: [0.024, 0.024, 0.01], seg: 10, pos: [0.155, 0.51, 0.058], rot: [0.3, 0, -0.3], color: 'primary' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.09, 0.28, 0.05], scale: [0.08, 0.1, 0.04], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.03, 0.4, 0.058], scale: [0.012, 0.18, 0.012], rot: [0, 0, 0.5], color: 'wheel' }
  ]),
  // musketeers: musket LEVELED to fire, hat with plume, powder horn + bandolier
  musketeers: R15('cloth', 'cloth').concat([
    { shape: 'box', size: [1, 1, 1], pos: [0.0, 0.36, 0], scale: [0.018, 0.15, 0.1], rot: [0, 0, 0.5], color: 'wheel' },  // bandolier
    { shape: 'cyl', size: [0.095, 0.095, 0.016], seg: 18, pos: [0, 0.545, 0], color: 'darkMetal' },   // hat brim
    { shape: 'cyl', size: [0.048, 0.053, 0.06], seg: 14, pos: [0, 0.58, 0], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.59, 0], scale: [0.065, 0.03, 0.01], rot: [0, 0, 0.5], color: 'canvas' },
    { shape: 'cyl', size: [0.016, 0.016, 0.5], seg: 12, pos: [0.19, 0.43, 0.03], rot: [0, 0, -1.45], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.04, 0.4, 0.03], scale: [0.13, 0.045, 0.04], rot: [0, 0, -0.15], color: 'wood' },
    { shape: 'cyl', size: [0.013, 0.016, 0.14], seg: 8, pos: [0.1, 0.42, 0.06], rot: [0.4, 0, -1.3], color: 'cloth' },
    { shape: 'cyl', size: [0.013, 0.016, 0.13], seg: 8, pos: [0.15, 0.39, -0.015], rot: [-0.3, 0, -1.5], color: 'cloth' },
    { shape: 'cone', size: [0.026, 0.08], seg: 10, pos: [-0.06, 0.28, -0.09], rot: [2.6, 0, 0.4], color: 'wood' }
  ]),
  // riflemen: rifle at the shoulder, brimmed helmet, pack + bedroll, bayonet
  riflemen: R15('cloth', 'cloth').concat([
    { shape: 'sphere', size: [0.096], seg: [16, 10], pos: [0, 0.53, 0], scale: [1, 0.58, 1], color: 'darkMetal' }, // brimmed helmet
    { shape: 'cyl', size: [0.011, 0.011, 0.56], seg: 12, pos: [0.16, 0.46, 0.03], rot: [0, 0, -1.35], color: 'darkMetal' },
    { shape: 'cone', size: [0.018, 0.08], seg: 10, pos: [0.41, 0.52, 0.03], rot: [0, 0, -1.35], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.41, 0.03], scale: [0.11, 0.04, 0.038], rot: [0, 0, -0.25], color: 'wood' },
    { shape: 'cyl', size: [0.013, 0.016, 0.14], seg: 8, pos: [0.1, 0.43, 0.058], rot: [0.4, 0, -1.25], color: 'cloth' },
    { shape: 'cyl', size: [0.013, 0.016, 0.13], seg: 8, pos: [0.14, 0.4, -0.005], rot: [-0.3, 0, -1.5], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.095, 0.38, 0], scale: [0.055, 0.11, 0.095], color: 'wood' },
    { shape: 'cyl', size: [0.02, 0.02, 0.085], seg: 10, pos: [-0.095, 0.45, 0], rot: [1.5707963267948966, 0, 0], color: 'cloth' }
  ]),
  // mech-inf: APC with wheel wells, hatches open, antenna, squad, headlights
  apc: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.21, 0], scale: [0.44, 0.2, 0.28], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0.2, 0.19, 0], scale: [0.12, 0.15, 0.24], rot: [0, 0, 0.4], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.22, 0.2, 0], scale: [0.05, 0.14, 0.24], rot: [0, 0, -0.3], color: 'hull' }, // rear ramp
    { shape: 'cyl', size: [0.05, 0.05, 0.03], seg: 12, pos: [-0.14, 0.08, -0.16], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.03], seg: 12, pos: [0.0, 0.08, -0.16], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.03], seg: 12, pos: [0.14, 0.08, -0.16], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.03], seg: 12, pos: [-0.14, 0.08, 0.16], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.03], seg: 12, pos: [0.0, 0.08, 0.16], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.03], seg: 12, pos: [0.14, 0.08, 0.16], rot: [1.5707963267948966, 0, 0], color: 'darkMetal' },
    { shape: 'sphere', size: [0.02], seg: [8, 6], pos: [-0.14, 0.08, -0.18], color: 'metal' },
    { shape: 'sphere', size: [0.02], seg: [8, 6], pos: [0.14, 0.08, 0.18], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.34, 0], scale: [0.13, 0.09, 0.13], color: 'darkMetal' },
    { shape: 'cyl', size: [0.011, 0.011, 0.15], seg: 6, pos: [0.09, 0.4, 0], rot: [0, 0, 1.2], color: 'metal' },
    { shape: 'sphere', size: [0.034], seg: [10, 8], pos: [-0.12, 0.33, -0.06], scale: [1, 0.7, 1], color: 'darkMetal' },
    { shape: 'sphere', size: [0.034], seg: [10, 8], pos: [-0.12, 0.33, 0.06], scale: [1, 0.7, 1], color: 'darkMetal' },
    { shape: 'cyl', size: [0.004, 0.004, 0.2], seg: 4, pos: [-0.18, 0.42, 0.1], color: 'metal' },
    { shape: 'sphere', size: [0.014], seg: [8, 6], pos: [0.27, 0.24, -0.09], color: 'canvas' },               // headlights
    { shape: 'sphere', size: [0.014], seg: [8, 6], pos: [0.27, 0.24, 0.09], color: 'canvas' }
  ],
  // bomber: glazed nose, four engines with props, waist line, twin tail
  bomber: [
    { shape: 'cyl', size: [0.058, 0.064, 0.5], seg: 14, pos: [0, 0.33, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'sphere', size: [0.058], seg: [12, 10], pos: [0.27, 0.33, 0], scale: [1.1, 1, 1], color: 'darkMetal' }, // glazed nose
    { shape: 'cone', size: [0.05, 0.12], seg: 14, pos: [-0.3, 0.33, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.335, -0.2], scale: [0.17, 0.018, 0.34], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.335, 0.2], scale: [0.17, 0.018, 0.34], color: 'metal' },
    { shape: 'cyl', size: [0.026, 0.03, 0.09], seg: 10, pos: [0.07, 0.315, -0.14], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.026, 0.03, 0.09], seg: 10, pos: [0.07, 0.315, -0.28], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.026, 0.03, 0.09], seg: 10, pos: [0.07, 0.315, 0.14], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.026, 0.03, 0.09], seg: 10, pos: [0.07, 0.315, 0.28], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.048, 0.048, 0.007], seg: 12, pos: [0.12, 0.315, -0.14], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'cyl', size: [0.048, 0.048, 0.007], seg: 12, pos: [0.12, 0.315, -0.28], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'cyl', size: [0.048, 0.048, 0.007], seg: 12, pos: [0.12, 0.315, 0.14], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'cyl', size: [0.048, 0.048, 0.007], seg: 12, pos: [0.12, 0.315, 0.28], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.27, 0.4, -0.09], scale: [0.06, 0.1, 0.014], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.27, 0.4, 0.09], scale: [0.06, 0.1, 0.014], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.27, 0.35, 0], scale: [0.05, 0.014, 0.24], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.36, 0], scale: [0.4, 0.008, 0.01], color: 'darkMetal' }    // spine line
  ],
  // nuclear: gantry-launched missile — ring fins, exhaust bell, umbilical mast
  nuclear: [
    { shape: 'cyl', size: [0.048, 0.048, 0.42], seg: 16, pos: [0, 0.37, 0], rot: [0, 0, -1.2], color: 'metal' },
    { shape: 'cone', size: [0.048, 0.13], seg: 16, pos: [0.245, 0.465, 0], rot: [0, 0, -1.2], color: 'darkMetal' },
    { shape: 'cyl', size: [0.03, 0.03, 0.02], seg: 12, pos: [0.09, 0.41, 0], rot: [0, 0, -1.2], color: 'primary' }, // faction band
    { shape: 'cyl', size: [0.058, 0.044, 0.05], seg: 12, pos: [-0.19, 0.29, 0], rot: [0, 0, -1.2], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.16, 0.3, 0], scale: [0.11, 0.09, 0.012], rot: [0, 0, -1.2], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.16, 0.3, 0], scale: [0.11, 0.012, 0.15], rot: [0, 0, -1.2], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.16, 0.3, 0], scale: [0.11, 0.065, 0.065], rot: [0.7853981633974483, 0, -1.2], color: 'cloth' },
    { shape: 'cyl', size: [0.012, 0.014, 0.3], seg: 6, pos: [-0.06, 0.18, -0.09], color: 'darkMetal' },        // gantry mast
    { shape: 'box', size: [1, 1, 1], pos: [-0.02, 0.3, -0.05], scale: [0.012, 0.012, 0.09], color: 'metal' }   // umbilical
  ],
  // submarine: pressure hull, sail + planes, periscopes, prop guard, deck line
  shipSub: [
    { shape: 'cyl', size: [0.068, 0.068, 0.42], seg: 16, pos: [-0.02, 0.12, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cone', size: [0.068, 0.12], seg: 16, pos: [0.25, 0.12, 0], rot: [0, 0, -1.5707963267948966], color: 'darkMetal' },
    { shape: 'cone', size: [0.068, 0.1], seg: 16, pos: [-0.28, 0.12, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.02, 0.19, 0], scale: [0.36, 0.012, 0.05], color: 'metal' },      // deck line
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.26, 0], scale: [0.11, 0.13, 0.045], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.0, 0.28, 0], scale: [0.02, 0.05, 0.03], color: 'metal' },         // sail window
    { shape: 'cyl', size: [0.005, 0.005, 0.1], seg: 4, pos: [-0.06, 0.37, 0], color: 'metal' },
    { shape: 'cyl', size: [0.004, 0.004, 0.08], seg: 4, pos: [-0.03, 0.36, 0], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.16, 0.12, 0], scale: [0.02, 0.01, 0.22], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.24, 0.16, 0], scale: [0.02, 0.09, 0.014], color: 'darkMetal' },
    { shape: 'cyl', size: [0.03, 0.03, 0.012], seg: 10, pos: [-0.31, 0.12, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' } // prop guard
  ],
  // carrier: angled deck stripe, island + radar mast, parked wings, crane
  carrier: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.54, 0.12, 0.18], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.095, 0], scale: [0.56, 0.02, 0.19], color: 'darkMetal' },
    { shape: 'cone', size: [1, 1], seg: 6, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.235, 0], scale: [0.64, 0.028, 0.27], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.252, 0], scale: [0.58, 0.004, 0.026], color: 'canvas' },       // centre stripe
    { shape: 'box', size: [1, 1, 1], pos: [-0.02, 0.252, -0.06], scale: [0.4, 0.004, 0.02], rot: [0, 0.22, 0], color: 'canvas' }, // angled stripe
    { shape: 'box', size: [1, 1, 1], pos: [-0.06, 0.32, 0.1], scale: [0.11, 0.13, 0.055], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.02, 0.35, 0.1], scale: [0.012, 0.03, 0.045], color: 'canvas' }, // island windows
    { shape: 'cyl', size: [0.007, 0.007, 0.1], seg: 6, pos: [-0.06, 0.42, 0.1], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.06, 0.47, 0.1], scale: [0.05, 0.008, 0.012], color: 'metal' },   // radar bar
    { shape: 'box', size: [1, 1, 1], pos: [0.14, 0.265, -0.05], scale: [0.08, 0.018, 0.026], color: 'metal' }, // parked a/c 1
    { shape: 'box', size: [1, 1, 1], pos: [0.14, 0.265, -0.05], scale: [0.026, 0.014, 0.09], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.22, 0.265, 0.04], scale: [0.08, 0.018, 0.026], color: 'metal' }, // parked a/c 2
    { shape: 'box', size: [1, 1, 1], pos: [-0.22, 0.265, 0.04], scale: [0.026, 0.014, 0.09], color: 'metal' },
    { shape: 'cyl', size: [0.008, 0.008, 0.09], seg: 6, pos: [0.24, 0.28, 0.07], rot: [0, 0, -0.5], color: 'darkMetal' } // crane
  ],
  // fallback: a neat neutral obelisk instead of the plain drum
  fallback: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.06, 0], scale: [0.22, 0.05, 0.22], color: 'stone' },
    { shape: 'cyl', size: [0.14, 0.18, 0.4], seg: 12, pos: [0, 0.3, 0], color: 'cloth' },
    { shape: 'sphere', size: [0.08], seg: [12, 10], pos: [0, 0.55, 0], color: 'cloth' }
  ]
};

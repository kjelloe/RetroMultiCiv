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

export const MODEL_UNIT_RECIPES = {
  // ---- the spearman, fully kitted: stance, belt, cheek-guard helm, butt spike
  footSoldier: [
    H.legL, H.legR, H.bootL, H.bootR,
    { shape: 'cone', size: [0.145, 0.3], seg: 12, pos: [0, 0.3, 0], color: 'cloth' },   // tunic
    H.belt,
    { shape: 'sphere', size: [0.088], seg: [14, 12], pos: [0, 0.55, 0], color: 'skin' },
    { shape: 'sphere', size: [0.098], seg: [14, 10], pos: [0, 0.575, 0], scale: [1, 0.78, 1], color: 'metal' }, // helm dome
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.52, -0.085], scale: [0.05, 0.07, 0.014], color: 'metal' },     // cheek guards
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.52, 0.085], scale: [0.05, 0.07, 0.014], color: 'metal' },
    { shape: 'box', size: [0.024, 0.1, 0.012], pos: [0, 0.67, 0], color: 'primary' },                          // crest
    { shape: 'cyl', size: [0.02, 0.026, 0.16], seg: 8, pos: [0.1, 0.42, 0.05], rot: [0, 0, -1.05], color: 'cloth' }, // spear arm
    { shape: 'cyl', size: [0.02, 0.026, 0.16], seg: 8, pos: [0.0, 0.38, -0.1], rot: [0.3, 0, 0.2], color: 'cloth' }, // shield arm
    { shape: 'cyl', size: [0.013, 0.013, 0.8], seg: 8, pos: [0.17, 0.44, 0.05], rot: [0, 0, -0.08], color: 'wood' },
    { shape: 'cone', size: [0.042, 0.13], seg: 8, pos: [0.205, 0.87, 0.05], rot: [0, 0, -0.08], color: 'metal' },
    { shape: 'cone', size: [0.02, 0.05], seg: 6, pos: [0.135, 0.06, 0.05], rot: [0, 0, 3.06], color: 'darkMetal' }, // butt spike
    { shape: 'box', size: [0.022, 0.22, 0.15], pos: [-0.1, 0.36, -0.05], rot: [0, 0.25, 0.1], color: 'wood' },  // oval shield
    { shape: 'sphere', size: [0.032], seg: [10, 8], pos: [-0.115, 0.36, -0.05], color: 'metal' }                // boss
  ],
  // ---- the hoplite: the big shield forward, crest cross-wise, greaves
  phalanx: [
    H.legL, H.legR, H.bootL, H.bootR,
    { shape: 'box', size: [1, 1, 1], pos: [-0.015, 0.13, -0.05], scale: [0.036, 0.09, 0.046], color: 'metal' }, // greaves
    { shape: 'box', size: [1, 1, 1], pos: [-0.005, 0.13, 0.05], scale: [0.036, 0.09, 0.046], color: 'metal' },
    { shape: 'cone', size: [0.145, 0.3], seg: 12, pos: [0, 0.3, 0], color: 'cloth' },
    H.belt,
    { shape: 'sphere', size: [0.088], seg: [14, 12], pos: [0, 0.55, 0], color: 'skin' },
    { shape: 'sphere', size: [0.098], seg: [14, 10], pos: [0, 0.575, 0], scale: [1, 0.78, 1], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.665, 0], scale: [0.09, 0.055, 0.016], rot: [1.5707963267948966, 0, 0], color: 'primary' }, // transverse crest
    { shape: 'cyl', size: [0.02, 0.026, 0.16], seg: 8, pos: [0.1, 0.44, 0.05], rot: [0, 0, -1.1], color: 'cloth' },
    { shape: 'cyl', size: [0.013, 0.013, 0.8], seg: 8, pos: [0.16, 0.46, 0.05], rot: [0, 0, -0.1], color: 'wood' },
    { shape: 'cone', size: [0.042, 0.13], seg: 8, pos: [0.195, 0.89, 0.05], rot: [0, 0, -0.1], color: 'metal' },
    { shape: 'cyl', size: [0.15, 0.15, 0.022], seg: 20, pos: [-0.11, 0.36, 0.02], rot: [1.5707963267948966, 0, 0.14], color: 'primary' }, // faction-blazon shield
    { shape: 'cyl', size: [0.155, 0.155, 0.008], seg: 20, pos: [-0.118, 0.36, 0.022], rot: [1.5707963267948966, 0, 0.14], color: 'metal' }, // rim
    { shape: 'sphere', size: [0.036], seg: [10, 8], pos: [-0.126, 0.36, 0.024], color: 'darkMetal' }
  ],
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
    { shape: 'box', size: [0.08, 0.03, 0.08], pos: [-0.02, 0.43, 0], color: 'wood' },                   // saddle
    { shape: 'cone', size: [0.11, 0.28], seg: 10, pos: [-0.02, 0.55, 0], color: 'cloth' },              // rider
    { shape: 'sphere', size: [0.06], seg: [12, 10], pos: [-0.02, 0.72, 0], color: 'skin' },
    { shape: 'sphere', size: [0.052], seg: [12, 8], pos: [-0.02, 0.745, 0], scale: [1, 0.7, 1], color: 'metal' },
    { shape: 'cyl', size: [0.016, 0.02, 0.13], seg: 8, pos: [0.05, 0.63, 0.05], rot: [0, 0, -1.5], color: 'cloth' }, // sword arm raised
    { shape: 'box', size: [1, 1, 1], pos: [0.14, 0.7, 0.05], scale: [0.016, 0.14, 0.008], rot: [0, 0, -0.5], color: 'metal' } // sword
  ],
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
    { shape: 'cone', size: [0.115, 0.3], seg: 10, pos: [-0.02, 0.55, 0], color: 'metal' },              // armored rider
    { shape: 'sphere', size: [0.062], seg: [12, 10], pos: [-0.02, 0.73, 0], color: 'metal' },           // great helm
    { shape: 'box', size: [1, 1, 1], pos: [-0.02, 0.71, 0.062], scale: [0.05, 0.012, 0.008], color: 'darkMetal' }, // visor slit
    { shape: 'box', size: [0.018, 0.06, 0.018], pos: [-0.02, 0.8, 0], color: 'primary' },               // plume
    { shape: 'cyl', size: [0.015, 0.015, 0.72], seg: 10, pos: [0.16, 0.58, 0.07], rot: [0, 0, -1.45], color: 'wood' },
    { shape: 'cyl', size: [0.028, 0.028, 0.03], seg: 10, pos: [0.05, 0.545, 0.07], rot: [0, 0, -1.45], color: 'metal' }, // lance guard
    { shape: 'cone', size: [0.026, 0.09], seg: 10, pos: [0.54, 0.63, 0.07], rot: [0, 0, -1.45], color: 'metal' },
    { shape: 'box', size: [0.02, 0.17, 0.12], pos: [-0.09, 0.52, 0.1], color: 'primary' },              // heater shield
    { shape: 'box', size: [0.008, 0.17, 0.02], pos: [-0.1, 0.52, 0.1], color: 'secondary' }             // shield chevron
  ],
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
};

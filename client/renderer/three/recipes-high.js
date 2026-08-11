// G4 HIGH-detail unit bodies (specs/graphics-levels.md): a full recipe table
// keyed by SILHOUETTE name (recipes.js UNIT_SILHOUETTE maps types onto these,
// so 21 bodies cover the 29-unit roster). Same primitive format, same
// colorRole slots, same footprints and palette as the low table — the high
// tier is the SAME art with real anatomy and kit, not a different style
// (user direction: "crafted to distinct detail"). PURE DATA: no three.js, no
// DOM — exportable beside recipes.js if Roblox ever grows a high tier.
//
// Composition notes shared by the humanoids: units carry weapons on +x (the
// low table's convention); legs are cylinders under a shortened tunic cone;
// helmet crowns are flattened spheres so heads stay one sphere at map scale.
const HUMAN = {
  legL: { shape: 'cyl', size: [0.028, 0.034, 0.15], seg: 6, pos: [-0.01, 0.075, -0.045], color: 'cloth' },
  legR: { shape: 'cyl', size: [0.028, 0.034, 0.15], seg: 6, pos: [-0.01, 0.075, 0.045], color: 'cloth' },
  tunic: { shape: 'cone', size: [0.15, 0.33], seg: 10, pos: [0, 0.31, 0], color: 'cloth' },
  head: { shape: 'sphere', size: [0.09], seg: [12, 10], pos: [0, 0.56, 0], color: 'skin' },
  armIdle: { shape: 'cyl', size: [0.02, 0.026, 0.17], seg: 6, pos: [0.01, 0.37, -0.11], rot: [0.25, 0, 0.15], color: 'cloth' },
  armReach: { shape: 'cyl', size: [0.02, 0.026, 0.17], seg: 6, pos: [0.09, 0.41, 0.05], rot: [0, 0, -1.1], color: 'cloth' }
};
export const HIGH_UNIT_RECIPES = {
  // militia / legion / barbleader — spearman with legs, arms, crested helm
  footSoldier: [
    HUMAN.legL, HUMAN.legR, HUMAN.tunic, HUMAN.head, HUMAN.armIdle, HUMAN.armReach,
    { shape: 'sphere', size: [0.098], seg: [12, 8], pos: [0, 0.585, 0], scale: [1, 0.78, 1], color: 'metal' }, // helmet dome
    { shape: 'cyl', size: [0.015, 0.015, 0.78], seg: 8, pos: [0.16, 0.42, 0], rot: [0, 0, -0.1], color: 'wood' },
    { shape: 'cone', size: [0.045, 0.13], seg: 8, pos: [0.2, 0.84, 0], rot: [0, 0, -0.1], color: 'metal' },
    { shape: 'box', size: [0.02, 0.2, 0.13], pos: [-0.09, 0.36, -0.02], rot: [0, 0.2, 0.1], color: 'wood' } // slung oval shield
  ],
  // hoplite — the footSoldier plus the big round shield wall-side + crest
  phalanx: [
    HUMAN.legL, HUMAN.legR, HUMAN.tunic, HUMAN.head, HUMAN.armReach,
    { shape: 'sphere', size: [0.098], seg: [12, 8], pos: [0, 0.585, 0], scale: [1, 0.78, 1], color: 'metal' },
    { shape: 'box', size: [0.026, 0.1, 0.012], pos: [0, 0.69, 0], color: 'cloth' },                    // crest ridge
    { shape: 'cyl', size: [0.015, 0.015, 0.78], seg: 8, pos: [0.15, 0.44, 0], rot: [0, 0, -0.12], color: 'wood' },
    { shape: 'cone', size: [0.045, 0.13], seg: 8, pos: [0.19, 0.86, 0], rot: [0, 0, -0.12], color: 'metal' },
    { shape: 'cyl', size: [0.145, 0.145, 0.025], seg: 16, pos: [-0.12, 0.35, 0.03], rot: [1.5707963267948966, 0, 0.15], color: 'metal' }, // hoplite shield
    { shape: 'sphere', size: [0.035], seg: [8, 6], pos: [-0.135, 0.35, 0.045], color: 'darkMetal' }     // shield boss
  ],
  // musketeer — musket at port, wide-brim hat, powder horn
  musketeers: [
    HUMAN.legL, HUMAN.legR, HUMAN.tunic, HUMAN.head, HUMAN.armIdle,
    { shape: 'cyl', size: [0.1, 0.1, 0.02], seg: 14, pos: [0, 0.63, 0], color: 'darkMetal' },          // hat brim
    { shape: 'cyl', size: [0.055, 0.06, 0.07], seg: 10, pos: [0, 0.67, 0], color: 'darkMetal' },       // hat crown
    { shape: 'cyl', size: [0.018, 0.018, 0.55], seg: 8, pos: [0.14, 0.46, 0], rot: [0, 0, -0.4], color: 'darkMetal' }, // barrel
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.33, 0], scale: [0.15, 0.05, 0.05], rot: [0, 0, -0.4], color: 'wood' }, // stock
    { shape: 'cyl', size: [0.02, 0.026, 0.17], seg: 6, pos: [0.1, 0.4, 0.04], rot: [0, 0, -0.9], color: 'cloth' }, // firing arm
    { shape: 'cone', size: [0.03, 0.09], seg: 8, pos: [-0.07, 0.28, -0.1], rot: [2.6, 0, 0.4], color: 'wood' } // powder horn
  ],
  // rifleman — long rifle + bayonet, brimmed steel helmet, pack
  riflemen: [
    HUMAN.legL, HUMAN.legR, HUMAN.tunic, HUMAN.head, HUMAN.armIdle,
    { shape: 'sphere', size: [0.105], seg: [12, 8], pos: [0, 0.59, 0], scale: [1, 0.62, 1], color: 'darkMetal' }, // brimmed helmet
    { shape: 'cyl', size: [0.013, 0.013, 0.66], seg: 8, pos: [0.16, 0.46, 0], rot: [0, 0, -0.22], color: 'darkMetal' },
    { shape: 'cone', size: [0.025, 0.1], seg: 6, pos: [0.34, 0.55, 0], rot: [0, 0, -0.22], color: 'metal' }, // bayonet
    { shape: 'box', size: [1, 1, 1], pos: [0.07, 0.36, 0], scale: [0.13, 0.045, 0.045], rot: [0, 0, -0.22], color: 'wood' },
    { shape: 'cyl', size: [0.02, 0.026, 0.17], seg: 6, pos: [0.11, 0.42, 0.04], rot: [0, 0, -0.95], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.1, 0.42, 0], scale: [0.06, 0.12, 0.1], color: 'wood' }   // field pack
  ],
  // settlers / caravan — covered wagon with seat, yoke and a draft ox
  wagon: [
    { shape: 'box', size: [0.46, 0.16, 0.28], pos: [-0.06, 0.22, 0], color: 'wood' },
    { shape: 'cyl', size: [0.14, 0.14, 0.4], seg: 16, pos: [-0.06, 0.35, 0], rot: [0, 0, 1.5707963267948966], color: 'canvas' },
    { shape: 'box', size: [0.1, 0.04, 0.24], pos: [0.16, 0.3, 0], color: 'wood' },                     // driver's seat
    { shape: 'cyl', size: [0.1, 0.1, 0.035], seg: 14, pos: [-0.2, 0.1, -0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.1, 0.1, 0.035], seg: 14, pos: [-0.2, 0.1, 0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.08, 0.08, 0.035], seg: 14, pos: [0.1, 0.09, -0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.08, 0.08, 0.035], seg: 14, pos: [0.1, 0.09, 0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.012, 0.012, 0.22], seg: 6, pos: [0.26, 0.16, 0], rot: [0, 0, 1.35], color: 'wood' }, // yoke pole
    { shape: 'box', size: [1, 1, 1], pos: [0.36, 0.14, 0], scale: [0.16, 0.11, 0.1], color: 'horse' },  // draft ox body
    { shape: 'box', size: [1, 1, 1], pos: [0.45, 0.2, 0], scale: [0.07, 0.07, 0.07], color: 'horse' },  // ox head
    { shape: 'cyl', size: [0.012, 0.014, 0.09], seg: 5, pos: [0.32, 0.045, -0.035], color: 'horse' },
    { shape: 'cyl', size: [0.012, 0.014, 0.09], seg: 5, pos: [0.32, 0.045, 0.035], color: 'horse' },
    { shape: 'cyl', size: [0.012, 0.014, 0.09], seg: 5, pos: [0.41, 0.045, -0.035], color: 'horse' },
    { shape: 'cyl', size: [0.012, 0.014, 0.09], seg: 5, pos: [0.41, 0.045, 0.035], color: 'horse' }
  ],
  // cavalry / chariot base — real horse (G0 standing idiom) + leaning rider
  mounted: [
    { shape: 'sphere', size: [0.13], seg: [12, 10], pos: [0, 0.3, 0], scale: [1.6, 0.85, 0.7], color: 'horse' }, // barrel body
    { shape: 'cyl', size: [0.03, 0.045, 0.16], seg: 8, pos: [0.16, 0.42, 0], rot: [0, 0, -0.5], color: 'horse' }, // neck
    { shape: 'sphere', size: [0.055], seg: [10, 8], pos: [0.24, 0.5, 0], color: 'horse' },
    { shape: 'box', size: [0.08, 0.04, 0.045], pos: [0.3, 0.485, 0], color: 'horse' },                 // muzzle
    { shape: 'cone', size: [0.012, 0.04], seg: 4, pos: [0.235, 0.55, -0.02], color: 'darkMetal' },     // ears
    { shape: 'cone', size: [0.012, 0.04], seg: 4, pos: [0.235, 0.55, 0.02], color: 'darkMetal' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [-0.13, 0.1, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [-0.13, 0.1, 0.05], color: 'horse' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [0.13, 0.1, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [0.13, 0.1, 0.05], color: 'horse' },
    { shape: 'cone', size: [0.018, 0.14], seg: 5, pos: [-0.21, 0.28, 0], rot: [0, 0, 2.7], color: 'darkMetal' }, // tail
    { shape: 'box', size: [0.14, 0.02, 0.12], pos: [-0.02, 0.4, 0], color: 'cloth' },                  // saddle cloth
    { shape: 'cone', size: [0.12, 0.3], seg: 8, pos: [-0.02, 0.52, 0], color: 'cloth' },               // rider torso
    { shape: 'sphere', size: [0.065], seg: [10, 8], pos: [-0.02, 0.7, 0], color: 'skin' },
    { shape: 'sphere', size: [0.055], seg: [10, 6], pos: [-0.02, 0.73, 0], scale: [1, 0.7, 1], color: 'metal' }
  ],
  // knights — the high horse in armor: caparison, helmed rider, lance + shield
  knight: [
    { shape: 'sphere', size: [0.13], seg: [12, 10], pos: [0, 0.3, 0], scale: [1.6, 0.85, 0.7], color: 'horse' },
    { shape: 'box', size: [0.34, 0.16, 0.2], pos: [0, 0.26, 0], color: 'primary' },                    // caparison drape
    { shape: 'cyl', size: [0.03, 0.045, 0.16], seg: 8, pos: [0.16, 0.42, 0], rot: [0, 0, -0.5], color: 'horse' },
    { shape: 'sphere', size: [0.055], seg: [10, 8], pos: [0.24, 0.5, 0], color: 'horse' },
    { shape: 'box', size: [0.08, 0.04, 0.045], pos: [0.3, 0.485, 0], color: 'metal' },                 // chanfron (armored muzzle)
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [-0.13, 0.1, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [-0.13, 0.1, 0.05], color: 'horse' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [0.13, 0.1, -0.05], color: 'horse' },
    { shape: 'cyl', size: [0.016, 0.02, 0.19], seg: 6, pos: [0.13, 0.1, 0.05], color: 'horse' },
    { shape: 'cone', size: [0.018, 0.14], seg: 5, pos: [-0.21, 0.28, 0], rot: [0, 0, 2.7], color: 'darkMetal' },
    { shape: 'cone', size: [0.12, 0.3], seg: 8, pos: [-0.02, 0.52, 0], color: 'metal' },               // armored torso
    { shape: 'sphere', size: [0.065], seg: [10, 8], pos: [-0.02, 0.7, 0], color: 'metal' },            // great helm
    { shape: 'box', size: [0.02, 0.05, 0.02], pos: [-0.02, 0.77, 0], color: 'primary' },               // helm plume
    { shape: 'cyl', size: [0.016, 0.016, 0.68], seg: 8, pos: [0.14, 0.56, 0.07], rot: [0, 0, -1.45], color: 'wood' },
    { shape: 'cone', size: [0.028, 0.09], seg: 8, pos: [0.5, 0.6, 0.07], rot: [0, 0, -1.45], color: 'metal' },
    { shape: 'box', size: [0.02, 0.17, 0.12], pos: [-0.08, 0.5, 0.1], color: 'primary' }               // heater shield
  ],
  chariotWheels: [
    { shape: 'cyl', size: [0.1, 0.1, 0.035], seg: 16, pos: [-0.14, 0.11, -0.13], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.1, 0.1, 0.035], seg: 16, pos: [-0.14, 0.11, 0.13], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'sphere', size: [0.025], seg: [8, 6], pos: [-0.14, 0.11, -0.15], color: 'darkMetal' },    // hubs
    { shape: 'sphere', size: [0.025], seg: [8, 6], pos: [-0.14, 0.11, 0.15], color: 'darkMetal' },
    { shape: 'box', size: [0.14, 0.1, 0.22], pos: [-0.16, 0.16, 0], color: 'wood' }                    // chariot basket
  ],
  // armor — tank with road wheels, mantlet, cupola and antenna
  tank: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.16, 0], scale: [0.5, 0.13, 0.3], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0.24, 0.18, 0], scale: [0.1, 0.1, 0.28], rot: [0, 0, 0.5], color: 'hull' }, // glacis
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, -0.17], scale: [0.54, 0.1, 0.08], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, 0.17], scale: [0.54, 0.1, 0.08], color: 'darkMetal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 10, pos: [-0.16, 0.07, -0.21], rot: [1.5707963267948966, 0, 0], color: 'metal' }, // road wheels
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 10, pos: [0, 0.07, -0.21], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 10, pos: [0.16, 0.07, -0.21], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 10, pos: [-0.16, 0.07, 0.21], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 10, pos: [0, 0.07, 0.21], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.045, 0.045, 0.02], seg: 10, pos: [0.16, 0.07, 0.21], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.03, 0.3, 0], scale: [0.26, 0.13, 0.22], color: 'hull' },
    { shape: 'cyl', size: [0.05, 0.06, 0.06], seg: 10, pos: [0.1, 0.3, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' }, // mantlet
    { shape: 'cyl', size: [0.02, 0.02, 0.52], seg: 8, pos: [0.35, 0.31, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.56, 0.31, 0], scale: [0.05, 0.035, 0.035], color: 'darkMetal' }, // muzzle brake
    { shape: 'sphere', size: [0.05], seg: [10, 6], pos: [-0.08, 0.38, 0.05], scale: [1, 0.6, 1], color: 'hull' }, // cupola
    { shape: 'cyl', size: [0.004, 0.004, 0.22], seg: 4, pos: [-0.2, 0.45, -0.08], color: 'metal' }     // antenna
  ],
  // mech-inf — APC with wheels, hatches, and a squad hint (two helmets in the bay)
  apc: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.2, 0], scale: [0.44, 0.22, 0.28], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0.2, 0.19, 0], scale: [0.12, 0.16, 0.24], rot: [0, 0, 0.4], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, -0.15], scale: [0.48, 0.1, 0.07], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, 0.15], scale: [0.48, 0.1, 0.07], color: 'darkMetal' },
    { shape: 'cyl', size: [0.04, 0.04, 0.02], seg: 10, pos: [-0.15, 0.07, -0.19], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.04, 0.04, 0.02], seg: 10, pos: [0.02, 0.07, -0.19], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.04, 0.04, 0.02], seg: 10, pos: [-0.15, 0.07, 0.19], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'cyl', size: [0.04, 0.04, 0.02], seg: 10, pos: [0.02, 0.07, 0.19], rot: [1.5707963267948966, 0, 0], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.35, 0], scale: [0.14, 0.1, 0.14], color: 'darkMetal' },
    { shape: 'cyl', size: [0.012, 0.012, 0.16], seg: 6, pos: [0.1, 0.4, 0], rot: [0, 0, 1.2], color: 'metal' },
    { shape: 'sphere', size: [0.035], seg: [8, 6], pos: [-0.12, 0.33, -0.06], scale: [1, 0.7, 1], color: 'darkMetal' }, // squad helmets
    { shape: 'sphere', size: [0.035], seg: [8, 6], pos: [-0.12, 0.33, 0.06], scale: [1, 0.7, 1], color: 'darkMetal' }
  ],
  // cannon / artillery — carriage gun with ringed barrel and trail
  siege: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.18, 0], scale: [0.36, 0.08, 0.22], color: 'wood' },
    { shape: 'cyl', size: [0.11, 0.11, 0.04], seg: 16, pos: [0.02, 0.12, -0.15], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.11, 0.11, 0.04], seg: 16, pos: [0.02, 0.12, 0.15], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'sphere', size: [0.028], seg: [8, 6], pos: [0.02, 0.12, -0.175], color: 'darkMetal' },
    { shape: 'sphere', size: [0.028], seg: [8, 6], pos: [0.02, 0.12, 0.175], color: 'darkMetal' },
    { shape: 'cyl', size: [0.035, 0.045, 0.5], seg: 12, pos: [0.1, 0.3, 0], rot: [0, 0, -1.05], color: 'metal' }, // barrel
    { shape: 'cyl', size: [0.05, 0.05, 0.02], seg: 12, pos: [0.05, 0.24, 0], rot: [0, 0, -1.05], color: 'darkMetal' }, // breech ring
    { shape: 'cyl', size: [0.042, 0.042, 0.02], seg: 12, pos: [0.16, 0.37, 0], rot: [0, 0, -1.05], color: 'darkMetal' }, // mid ring
    { shape: 'box', size: [1, 1, 1], pos: [-0.18, 0.12, 0], scale: [0.16, 0.05, 0.06], rot: [0, 0, 0.25], color: 'wood' } // trail
  ],
  // catapult — torsion engine: frame, skein, raised arm, stone, winch
  catapult: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.16, 0], scale: [0.42, 0.12, 0.26], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.26, -0.11], scale: [0.3, 0.14, 0.04], rot: [0, 0, 0.15], color: 'wood' }, // side frames
    { shape: 'box', size: [1, 1, 1], pos: [0.05, 0.26, 0.11], scale: [0.3, 0.14, 0.04], rot: [0, 0, 0.15], color: 'wood' },
    { shape: 'cyl', size: [0.022, 0.022, 0.26], seg: 8, pos: [0.1, 0.24, 0], rot: [1.5707963267948966, 0, 0], color: 'canvas' }, // torsion skein
    { shape: 'cyl', size: [0.095, 0.095, 0.04], seg: 14, pos: [-0.12, 0.1, -0.14], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.095, 0.095, 0.04], seg: 14, pos: [-0.12, 0.1, 0.14], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.095, 0.095, 0.04], seg: 14, pos: [0.14, 0.1, -0.14], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.095, 0.095, 0.04], seg: 14, pos: [0.14, 0.1, 0.14], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.06, 0.36, 0], scale: [0.06, 0.4, 0.05], rot: [0, 0, 0.6], color: 'wood' },
    { shape: 'cyl', size: [0.05, 0.06, 0.05], seg: 10, pos: [-0.18, 0.52, 0], rot: [0, 0, -0.5], color: 'wood' }, // cup
    { shape: 'sphere', size: [0.045], seg: [10, 8], pos: [-0.18, 0.545, 0], color: 'stone' },
    { shape: 'cyl', size: [0.018, 0.018, 0.2], seg: 6, pos: [0.18, 0.2, 0], rot: [1.5707963267948966, 0, 0], color: 'wood' } // winch drum
  ],
  // diplomat — robed emissary with brimmed hat, satchel and a raised scroll
  diplomat: [
    HUMAN.legL, HUMAN.legR,
    { shape: 'cone', size: [0.16, 0.4], seg: 12, pos: [0, 0.32, 0], color: 'canvas' },
    { shape: 'sphere', size: [0.09], seg: [12, 10], pos: [0, 0.58, 0], color: 'skin' },
    { shape: 'cyl', size: [0.095, 0.095, 0.015], seg: 14, pos: [0, 0.64, 0], color: 'wood' },          // hat brim
    { shape: 'sphere', size: [0.05], seg: [10, 6], pos: [0, 0.66, 0], scale: [1, 0.6, 1], color: 'wood' },
    { shape: 'cyl', size: [0.02, 0.026, 0.17], seg: 6, pos: [0.09, 0.43, 0.03], rot: [0, 0, -1.15], color: 'canvas' }, // raised arm
    { shape: 'cyl', size: [0.022, 0.022, 0.1], seg: 8, pos: [0.17, 0.52, 0.03], rot: [0.3, 0, -0.3], color: 'canvas' }, // the scroll
    { shape: 'box', size: [1, 1, 1], pos: [-0.11, 0.3, 0.05], scale: [0.09, 0.11, 0.05], color: 'wood' }, // satchel
    { shape: 'box', size: [1, 1, 1], pos: [-0.05, 0.42, 0.06], scale: [0.015, 0.18, 0.015], rot: [0, 0, 0.5], color: 'wood' } // strap
  ],
  // fighter — rounded fuselage, canopy, tapered wings, tail
  aircraft: [
    { shape: 'cyl', size: [0.05, 0.055, 0.4], seg: 12, pos: [0, 0.32, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cone', size: [0.05, 0.1], seg: 12, pos: [0.25, 0.32, 0], rot: [0, 0, -1.5707963267948966], color: 'darkMetal' }, // nose
    { shape: 'sphere', size: [0.045], seg: [10, 8], pos: [0.05, 0.37, 0], scale: [1.4, 0.7, 0.8], color: 'darkMetal' }, // canopy
    { shape: 'box', size: [1, 1, 1], pos: [0.04, 0.32, -0.14], scale: [0.13, 0.018, 0.24], rot: [0, 0.12, 0], color: 'metal' }, // wings
    { shape: 'box', size: [1, 1, 1], pos: [0.04, 0.32, 0.14], scale: [0.13, 0.018, 0.24], rot: [0, -0.12, 0], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.18, 0.39, 0], scale: [0.07, 0.11, 0.015], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.18, 0.33, 0], scale: [0.05, 0.015, 0.16], color: 'metal' }
  ],
  // heavy bomber — fat fuselage, four nacelles with prop discs, twin tail
  bomber: [
    { shape: 'cyl', size: [0.06, 0.065, 0.5], seg: 12, pos: [0, 0.32, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cone', size: [0.06, 0.1], seg: 12, pos: [0.3, 0.32, 0], rot: [0, 0, -1.5707963267948966], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.32, -0.19], scale: [0.16, 0.02, 0.32], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.32, 0.19], scale: [0.16, 0.02, 0.32], color: 'metal' },
    { shape: 'cyl', size: [0.028, 0.028, 0.09], seg: 8, pos: [0.06, 0.3, -0.13], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.028, 0.028, 0.09], seg: 8, pos: [0.06, 0.3, -0.27], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.028, 0.028, 0.09], seg: 8, pos: [0.06, 0.3, 0.13], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.028, 0.028, 0.09], seg: 8, pos: [0.06, 0.3, 0.27], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cyl', size: [0.05, 0.05, 0.008], seg: 12, pos: [0.115, 0.3, -0.13], rot: [0, 0, 1.5707963267948966], color: 'cloth' }, // prop discs
    { shape: 'cyl', size: [0.05, 0.05, 0.008], seg: 12, pos: [0.115, 0.3, -0.27], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'cyl', size: [0.05, 0.05, 0.008], seg: 12, pos: [0.115, 0.3, 0.13], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'cyl', size: [0.05, 0.05, 0.008], seg: 12, pos: [0.115, 0.3, 0.27], rot: [0, 0, 1.5707963267948966], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.24, 0.38, -0.08], scale: [0.06, 0.1, 0.015], color: 'metal' }, // twin tail
    { shape: 'box', size: [1, 1, 1], pos: [-0.24, 0.38, 0.08], scale: [0.06, 0.1, 0.015], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.24, 0.34, 0], scale: [0.05, 0.015, 0.22], color: 'metal' }
  ],
  // nuclear — the tilted missile with ring fins and an exhaust bell
  nuclear: [
    { shape: 'cyl', size: [0.05, 0.05, 0.44], seg: 14, pos: [0, 0.36, 0], rot: [0, 0, -1.2], color: 'metal' },
    { shape: 'cone', size: [0.05, 0.13], seg: 14, pos: [0.255, 0.46, 0], rot: [0, 0, -1.2], color: 'darkMetal' },
    { shape: 'cyl', size: [0.06, 0.045, 0.05], seg: 12, pos: [-0.2, 0.285, 0], rot: [0, 0, -1.2], color: 'darkMetal' }, // exhaust bell
    { shape: 'box', size: [1, 1, 1], pos: [-0.17, 0.3, 0], scale: [0.12, 0.09, 0.014], rot: [0, 0, -1.2], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.17, 0.3, 0], scale: [0.12, 0.014, 0.16], rot: [0, 0, -1.2], color: 'cloth' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.17, 0.3, 0], scale: [0.12, 0.07, 0.07], rot: [0.7853981633974483, 0, -1.2], color: 'cloth' } // x-fins
  ],
  fallback: [
    { shape: 'cyl', size: [0.2, 0.24, 0.5], seg: 14, pos: [0, 0.32, 0], color: 'cloth' }
  ],
  // trireme / sail / frigate / transport — planked hull, bowsprit, two masts
  // with yards (the procedural chrome sail plane still rides the main mast)
  shipSail: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.5, 0.14, 0.2], color: 'wood' },
    { shape: 'cone', size: [1, 1], seg: 6, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'wood' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.26, 0.22, 0], scale: [0.08, 0.1, 0.16], color: 'wood' },  // sterncastle
    { shape: 'box', size: [1, 1, 1], pos: [0.18, 0.2, 0], scale: [0.08, 0.06, 0.16], color: 'wood' },   // bow deck
    { shape: 'cyl', size: [0.01, 0.012, 0.2], seg: 6, pos: [0.38, 0.2, 0], rot: [0, 0, -1.1], color: 'wood' }, // bowsprit
    { shape: 'cyl', size: [0.012, 0.012, 0.7], seg: 8, pos: [-0.04, 0.45, 0], color: 'wood' },          // main mast
    { shape: 'cyl', size: [0.008, 0.008, 0.3], seg: 6, pos: [-0.04, 0.62, 0], rot: [1.5707963267948966, 0, 0], color: 'wood' }, // main yard
    { shape: 'cyl', size: [0.01, 0.01, 0.44], seg: 6, pos: [0.14, 0.34, 0], color: 'wood' },            // foremast
    { shape: 'cyl', size: [0.007, 0.007, 0.22], seg: 6, pos: [0.14, 0.48, 0], rot: [1.5707963267948966, 0, 0], color: 'wood' }
  ],
  // submarine — rounded pressure hull, sail with periscopes, dive planes
  shipSub: [
    { shape: 'cyl', size: [0.07, 0.07, 0.44], seg: 14, pos: [-0.02, 0.12, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'cone', size: [0.07, 0.12], seg: 14, pos: [0.26, 0.12, 0], rot: [0, 0, -1.5707963267948966], color: 'darkMetal' },
    { shape: 'cone', size: [0.07, 0.1], seg: 14, pos: [-0.29, 0.12, 0], rot: [0, 0, 1.5707963267948966], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.26, 0], scale: [0.12, 0.14, 0.05], color: 'darkMetal' }, // sail
    { shape: 'cyl', size: [0.006, 0.006, 0.1], seg: 4, pos: [-0.06, 0.36, 0], color: 'metal' },         // periscope
    { shape: 'box', size: [1, 1, 1], pos: [0.18, 0.12, 0], scale: [0.02, 0.01, 0.22], color: 'darkMetal' }, // bow planes
    { shape: 'box', size: [1, 1, 1], pos: [-0.27, 0.16, 0], scale: [0.02, 0.09, 0.015], color: 'darkMetal' } // tail rudder
  ],
  // ironclad / cruiser / battleship — deck, two funnels, bridge, two turrets
  shipPowered: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.5, 0.14, 0.2], color: 'hull' },
    { shape: 'cone', size: [1, 1], seg: 6, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.215, 0], scale: [0.46, 0.02, 0.17], color: 'darkMetal' }, // deck line
    { shape: 'cyl', size: [0.045, 0.055, 0.16], seg: 12, pos: [-0.13, 0.3, 0], color: 'darkMetal' },    // funnels
    { shape: 'cyl', size: [0.04, 0.05, 0.13], seg: 12, pos: [-0.01, 0.28, 0], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.09, 0.27, 0], scale: [0.12, 0.1, 0.12], color: 'hull' },   // bridge
    { shape: 'cyl', size: [0.05, 0.055, 0.045], seg: 10, pos: [0.2, 0.245, 0], color: 'darkMetal' },    // fore turret
    { shape: 'cyl', size: [0.012, 0.012, 0.14], seg: 6, pos: [0.28, 0.25, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' },
    { shape: 'cyl', size: [0.05, 0.055, 0.045], seg: 10, pos: [-0.24, 0.245, 0], color: 'darkMetal' },  // aft turret
    { shape: 'cyl', size: [0.012, 0.012, 0.14], seg: 6, pos: [-0.32, 0.25, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' }
  ],
  // carrier — flattop with island, deck stripe, and two parked aircraft
  carrier: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.54, 0.12, 0.18], color: 'hull' },
    { shape: 'cone', size: [1, 1], seg: 6, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'hull' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.23, 0], scale: [0.62, 0.03, 0.26], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.248, 0], scale: [0.56, 0.004, 0.03], color: 'canvas' }, // deck stripe
    { shape: 'box', size: [1, 1, 1], pos: [-0.08, 0.31, 0.09], scale: [0.1, 0.12, 0.06], color: 'hull' },
    { shape: 'cyl', size: [0.008, 0.008, 0.08], seg: 4, pos: [-0.08, 0.4, 0.09], color: 'metal' },      // island mast
    { shape: 'box', size: [1, 1, 1], pos: [0.12, 0.26, -0.04], scale: [0.09, 0.02, 0.03], color: 'metal' }, // parked aircraft
    { shape: 'box', size: [1, 1, 1], pos: [0.12, 0.26, -0.04], scale: [0.03, 0.015, 0.1], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.2, 0.26, 0.02], scale: [0.09, 0.02, 0.03], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.2, 0.26, 0.02], scale: [0.03, 0.015, 0.1], color: 'metal' }
  ]
};

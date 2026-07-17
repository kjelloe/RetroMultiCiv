// A88 asset recipes: the unit/city/prop factory as DATA. Every silhouette is a
// composition of solid-colored primitives (box / cylinder / cone / sphere /
// dodecahedron), so the cross-platform artifact is the RECIPE, not a mesh —
// composer.js (three.js) and the Roblox Luau composer (R8) build the SAME
// primitives from this one table. PURE DATA: no three.js, no DOM, so
// tools/export-asset-recipes.js imports it in Node and writes
// data/asset-recipes.json. Faction identity is a colorRole SLOT the composer
// fills from the civ visual — the data never carries a faction hex. The base
// token, pennant/flag, and every status/selection MARKER stay PROCEDURAL
// (plane/torus/circle shapes) in assets.js, per the ally's Part 7.
//
// Recipe primitive: { shape, size:[...], seg?, pos:[x,y,z], scale?, rot?, color }
//   shape  box | cyl | cone | sphere | dodeca
//   size   box [w,h,d] · cyl [rTop,rBot,h] · cone [r,h] · sphere [r] · dodeca [r]
//   seg    cyl/cone radial segments · sphere [wSeg,hSeg] · dodeca detail
//   scale  scalar or [sx,sy,sz] (applied after geometry, as the current code does)
//   rot    [rx,ry,rz] radians
//   color  a COLOR_ROLE name, or 'primary'/'secondary' (composer injects visual.*)

// neutral material colors (the composer builds Lambert materials from these; the
// current assets.js NEUTRAL table is regenerated from here so they stay one set)
export const COLOR_ROLES = {
  wood: '#6b4a2a', wheel: '#4a3319', canvas: '#e8e0cc', cloth: '#8b93a5',
  skin: '#d7a27d', metal: '#b8b8b8', stone: '#c2ab82', house: '#e1d0ad',
  horse: '#7a5230', hull: '#8a8f96', darkMetal: '#5a5f52'
};

// unit silhouette BODIES — the fixed primitive list per class (the base token
// + pennant are added procedurally by the composer's caller)
export const UNIT_RECIPES = {
  footSoldier: [
    { shape: 'cone', size: [0.17, 0.42], seg: 8, pos: [0, 0.28, 0], color: 'cloth' },
    { shape: 'sphere', size: [0.1], seg: [10, 8], pos: [0, 0.56, 0], color: 'skin' },
    { shape: 'cyl', size: [0.015, 0.015, 0.7], seg: 6, pos: [0.15, 0.42, 0], rot: [0, 0, -0.12], color: 'wood' },
    { shape: 'cone', size: [0.05, 0.12], seg: 4, pos: [0.19, 0.8, 0], rot: [0, 0, -0.12], color: 'metal' }
  ],
  wagon: [
    { shape: 'box', size: [0.5, 0.18, 0.3], pos: [0, 0.22, 0], color: 'wood' },
    { shape: 'cyl', size: [0.14, 0.14, 0.44], seg: 10, pos: [0, 0.34, 0], rot: [0, 0, 1.5707963267948966], color: 'canvas' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.17, 0.09, -0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.17, 0.09, 0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [0.17, 0.09, -0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [0.17, 0.09, 0.16], rot: [1.5707963267948966, 0, 0], color: 'wheel' }
  ],
  // horse + rider; chariot appends `chariotWheels`
  mounted: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.3, 0], scale: [0.42, 0.16, 0.16], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [0.18, 0.42, 0], scale: [0.1, 0.2, 0.1], rot: [0, 0, -0.35], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [0.27, 0.5, 0], scale: [0.14, 0.08, 0.09], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.15, 0.13, -0.05], scale: [0.05, 0.19, 0.05], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.15, 0.13, 0.05], scale: [0.05, 0.19, 0.05], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [0.15, 0.13, -0.05], scale: [0.05, 0.19, 0.05], color: 'horse' },
    { shape: 'box', size: [1, 1, 1], pos: [0.15, 0.13, 0.05], scale: [0.05, 0.19, 0.05], color: 'horse' },
    { shape: 'cone', size: [0.17, 0.42], seg: 8, pos: [-0.06, 0.52, 0], scale: 0.7, color: 'cloth' }
  ],
  chariotWheels: [
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.14, 0.11, -0.12], rot: [1.5707963267948966, 0, 0], color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.14, 0.11, 0.12], rot: [1.5707963267948966, 0, 0], color: 'wheel' }
  ],
  // A67: a real tracked TANK (was armor→siegeArmor, a generic box). Low wide
  // hull + two dark treads + a set-back turret + a long forward gun.
  tank: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.16, 0], scale: [0.5, 0.13, 0.30], color: 'hull' },        // hull
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, -0.17], scale: [0.54, 0.1, 0.08], color: 'darkMetal' }, // left tread
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, 0.17], scale: [0.54, 0.1, 0.08], color: 'darkMetal' },  // right tread
    { shape: 'box', size: [1, 1, 1], pos: [-0.03, 0.29, 0], scale: [0.24, 0.12, 0.20], color: 'hull' },     // turret
    { shape: 'cyl', size: [0.022, 0.022, 0.5], seg: 6, pos: [0.24, 0.30, 0], rot: [0, 0, 1.5707963267948966], color: 'metal' } // gun
  ],
  // A67: an APC for mech-inf (was mech-inf→footSoldier). Boxier + taller than the
  // tank, an angled front glacis, a small cupola + stub MG (not a long gun).
  apc: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.20, 0], scale: [0.44, 0.22, 0.28], color: 'hull' },        // hull
    { shape: 'box', size: [1, 1, 1], pos: [0.20, 0.19, 0], scale: [0.12, 0.16, 0.24], rot: [0, 0, 0.4], color: 'hull' }, // sloped front glacis
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, -0.15], scale: [0.48, 0.1, 0.07], color: 'darkMetal' }, // left tread
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.08, 0.15], scale: [0.48, 0.1, 0.07], color: 'darkMetal' },  // right tread
    { shape: 'box', size: [1, 1, 1], pos: [0.02, 0.35, 0], scale: [0.14, 0.1, 0.14], color: 'darkMetal' },  // cupola
    { shape: 'cyl', size: [0.012, 0.012, 0.16], seg: 6, pos: [0.10, 0.40, 0], rot: [0, 0, 1.2], color: 'metal' } // stub MG
  ],
  siege: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.2, 0], scale: [0.4, 0.1, 0.24], color: 'wood' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [0, 0.11, -0.14], rot: [1.5707963267948966, 0, 0], scale: 1.2, color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [0, 0.11, 0.14], rot: [1.5707963267948966, 0, 0], scale: 1.2, color: 'wheel' },
    { shape: 'cyl', size: [0.015, 0.015, 0.7], seg: 6, pos: [0.1, 0.38, 0], rot: [0, 0, -0.9], scale: [2.2, 0.6, 2.2], color: 'metal' }
  ],
  // A67b: the CATAPULT (was catapult→siege, a barrel-on-wheels shared with
  // cannon/artillery). A torsion engine instead: a heavy wooden frame + a
  // raised WOODEN throwing arm with a stone in its cup — reads ancient, and
  // distinct from the gunpowder siege's metal barrel.
  catapult: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.16, 0], scale: [0.42, 0.12, 0.26], color: 'wood' },        // frame
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.12, 0.1, -0.14], rot: [1.5707963267948966, 0, 0], scale: 1.1, color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.12, 0.1, 0.14], rot: [1.5707963267948966, 0, 0], scale: 1.1, color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [0.14, 0.1, -0.14], rot: [1.5707963267948966, 0, 0], scale: 1.1, color: 'wheel' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [0.14, 0.1, 0.14], rot: [1.5707963267948966, 0, 0], scale: 1.1, color: 'wheel' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.06, 0.34, 0], scale: [0.06, 0.36, 0.05], rot: [0, 0, 0.6], color: 'wood' }, // throwing arm (raised, leaning back)
    { shape: 'cone', size: [0.07, 0.08], seg: 8, pos: [-0.17, 0.49, 0], rot: [0, 0, -0.5], color: 'stone' }   // the stone in the cup
  ],
  // A67b: the DIPLOMAT (was diplomat→wagon, a cart shared with settlers/caravan).
  // A lone robed emissary with a document case — no spear (vs the foot soldier),
  // no cart.
  diplomat: [
    { shape: 'cone', size: [0.16, 0.46], seg: 8, pos: [0, 0.28, 0], color: 'canvas' },   // pale civilian robe
    { shape: 'sphere', size: [0.1], seg: [10, 8], pos: [0, 0.58, 0], color: 'skin' },     // head
    { shape: 'box', size: [1, 1, 1], pos: [0.16, 0.22, 0], scale: [0.09, 0.11, 0.05], color: 'wood' } // document case at the side
  ],
  aircraft: [
    { shape: 'box', size: [1, 1, 1], pos: [0, 0.32, 0], scale: [0.42, 0.08, 0.1], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.04, 0.32, 0], scale: [0.12, 0.02, 0.46], color: 'metal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.18, 0.38, 0], scale: [0.08, 0.1, 0.02], color: 'metal' }
  ],
  fallback: [
    { shape: 'cyl', size: [0.2, 0.24, 0.5], seg: 8, pos: [0, 0.32, 0], color: 'cloth' }
  ],
  // ships: hull + bow share the variant hull material; the SAIL (a plane) stays
  // procedural in assets.js. The pole (sail) / fin (sub) / funnel+bridge
  // (powered) primitives ride the recipe.
  shipSail: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.5, 0.14, 0.2], color: 'wood' },
    { shape: 'cone', size: [1, 1], seg: 4, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'wood' },
    { shape: 'cyl', size: [0.012, 0.012, 0.7], seg: 6, pos: [-0.04, 0.45, 0], color: 'wood' }
  ],
  shipSub: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.5, 0.1, 0.2], color: 'darkMetal' },
    { shape: 'cone', size: [1, 1], seg: 4, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [-0.06, 0.24, 0], scale: [0.12, 0.12, 0.05], color: 'darkMetal' }
  ],
  shipPowered: [
    { shape: 'box', size: [1, 1, 1], pos: [-0.04, 0.14, 0], scale: [0.5, 0.14, 0.2], color: 'hull' },
    { shape: 'cone', size: [1, 1], seg: 4, pos: [0.28, 0.14, 0], scale: [0.1, 0.12, 0.1], rot: [0, 0, -1.5707963267948966], color: 'hull' },
    { shape: 'cyl', size: [0.09, 0.09, 0.04], seg: 10, pos: [-0.1, 0.28, 0], scale: [0.6, 2.4, 0.6], color: 'darkMetal' },
    { shape: 'box', size: [1, 1, 1], pos: [0.08, 0.26, 0], scale: [0.14, 0.1, 0.12], color: 'hull' }
  ]
};

// city: the per-house TEMPLATE primitives (a box hut + a 4-sided cone/pyramid
// roof in the owner colorRole); createCityMesh places N of them per tier in a
// deterministic ring (the placement is procedural terrain-like logic, the
// SHAPES are data). The wall ring is a torus marker → procedural.
export const CITY_RECIPE = {
  house: { shape: 'box', size: [1, 1, 1], color: 'house' },
  roof: { shape: 'cone', size: [1, 1], seg: 4, color: 'primary' }
};

// tile prop SHAPES (props.js builds its InstancedMesh geometries from these;
// per-tile PLACEMENT + colors stay procedural in props.js — terrain logic, not
// a fixed recipe). 'torus' (fortress) + 'dodeca' (hills rock) are the
// non-primitive shapes = approximation points for non-three composers (R8).
export const PROP_SHAPES = {
  strip: { shape: 'box', size: [0.72, 0.02, 0.14] },
  roadSeg: { shape: 'box', size: [0.5, 0.02, 0.12] },
  mine: { shape: 'cone', size: [0.13, 0.2], seg: 4 },
  tree: { shape: 'cone', size: [0.11, 0.28], seg: 6 },
  scrub: { shape: 'cone', size: [0.055, 0.11], seg: 5 },
  rock: { shape: 'dodeca', size: [0.14], seg: 0 },
  peak: { shape: 'cone', size: [0.26, 0.5], seg: 5 },
  snow: { shape: 'cone', size: [0.12, 0.2], seg: 5 },
  special: { shape: 'sphere', size: [0.07], seg: [8, 6] },
  fortress: { shape: 'torus', size: [0.34, 0.05], seg: [6, 12] },
  tie: { shape: 'box', size: [0.03, 0.024, 0.17] },
  mineDoor: { shape: 'box', size: [0.11, 0.1, 0.02] },
  mineBeam: { shape: 'box', size: [0.15, 0.03, 0.04] },
  fieldPatch: { shape: 'box', size: [0.24, 0.012, 0.16] },
  foam: { shape: 'box', size: [0.82, 0.01, 0.06] }
};

// every unit type → its silhouette recipe (the assets.js class tables as data;
// the drift gate asserts this covers every data/units.json id). Chariot adds
// `chariotWheels`, sail ships add the procedural plane sail — variant details
// the composer's caller layers on; the base body is the mapped recipe.
export const UNIT_SILHOUETTE = {
  settlers: 'wagon', caravan: 'wagon', diplomat: 'diplomat',
  militia: 'footSoldier', phalanx: 'footSoldier', legion: 'footSoldier',
  musketeers: 'footSoldier', riflemen: 'footSoldier', 'mech-inf': 'apc',
  cavalry: 'mounted', knights: 'mounted', chariot: 'mounted',
  armor: 'tank', catapult: 'catapult', cannon: 'siege', artillery: 'siege',
  trireme: 'shipSail', sail: 'shipSail', frigate: 'shipSail', transport: 'shipSail',
  submarine: 'shipSub',
  ironclad: 'shipPowered', cruiser: 'shipPowered', battleship: 'shipPowered', carrier: 'shipPowered',
  fighter: 'aircraft', bomber: 'aircraft', nuclear: 'aircraft'
};

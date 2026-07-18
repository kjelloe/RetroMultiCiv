// City look by ERA (specs/city-era-looks.md) — the SHARED, render-only contract
// both platforms honor (browser here; Roblox roblox-helper run-F item 8). A
// city's visual era BAND is derived from the OWNER's tech era at render time —
// a pure READ of the viewed state, no engine/save change (golden-neutral). The
// band composes with the existing size tiers (size sets house count/height;
// the band sets the STYLE). The style table is pure string DATA so each
// platform maps the keys (roof/body/prop) to its own geometry + materials.

// Renderer-local band ids (specs §5d). NOT the engine era names — 'renaissance'
// maps to classicalMedieval, and no 'Classical' label is ever put on the
// renaissance era in code.
export const CITY_ERA_BANDS = ['ancient', 'classicalMedieval', 'industrial', 'modernSpace'];

// engine tech era (ancient / renaissance / industrial / modern) → visual band.
const ERA_TO_BAND = { ancient: 'ancient', renaissance: 'classicalMedieval', industrial: 'industrial', modern: 'modernSpace' };
const RANK = { ancient: 0, classicalMedieval: 1, industrial: 2, modernSpace: 3 };

// The band → style table. Pure strings the renderer maps to geometry/materials:
// `body` + `roofMat` material keys, `roofShape` (peak/flat/slab), `prop` (a
// signature central structure, '' = none). Era changes SILHOUETTE + ROOFLINE +
// material, never a plain recolor: ancient thatch wedges -> classicalMedieval
// tiled peaks + a stone keep -> industrial brick rectilinear + smokestacks ->
// modernSpace concrete slabs + a glass dome/spire. All four ship in this pass.
export const CITY_ERA_STYLES = {
  ancient:           { body: 'mud',      roofShape: 'peak', roofMat: 'thatch', prop: '' },
  classicalMedieval: { body: 'stone',    roofShape: 'peak', roofMat: 'tile',   prop: 'keep' },
  industrial:        { body: 'brick',    roofShape: 'flat', roofMat: 'tar',    prop: 'smokestack' },
  modernSpace:       { body: 'concrete', roofShape: 'slab', roofMat: 'glass',  prop: 'spire' }
};

// All four band looks ship in this pass (the ally verdict pulled the middle
// bands out of "deferred"), so nothing is flagged for a later visual pass.
export const FLAGGED = [];

// The visual band for a city, from its owner's known techs. Highest era wins.
// Fog-honest: filterView passes `techs` only for the VIEWER, so a rival city
// under fog (no techs in view) falls back to the base 'ancient' band — the
// viewer doesn't get to read a rival's tech list.
export function cityEraBand(ownerPlayer, techsTable) {
  if (!ownerPlayer || !ownerPlayer.techs || !techsTable) return 'ancient';
  let best = 'ancient';
  for (const id of ownerPlayer.techs) {
    const t = techsTable[id];
    if (!t) continue;
    const band = ERA_TO_BAND[t.era] || 'ancient';
    if (RANK[band] > RANK[best]) best = band;
  }
  return best;
}

// Annotate a fog-filtered view's cities with a render-only `eraBand` hint, so
// the (rules-agnostic) renderer just reads city.eraBand. The view is ephemeral
// (rebuilt each refresh), so this is never state/hash.
export function annotateCityEra(view, techsTable) {
  if (!view || !view.cities) return view;
  for (const id of Object.keys(view.cities)) {
    const c = view.cities[id];
    c.eraBand = cityEraBand(view.players && view.players[c.owner], techsTable);
  }
  return view;
}

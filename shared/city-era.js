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

// H13 (specs/graphics-levels.md): the ROAD-ERA stage — roads/rails restyle
// with the VIEWER's own advancement (roads have no owner, so the honest,
// fog-safe driver is what YOU know): 0 dirt path → 1 cobblestone
// (renaissance) → 2 slim unmarked asphalt (industrial) → 3 marked roads,
// the classic look (automobile) → 4 four-lane highway (plastics /
// space-flight). Render-only; low tier ignores it (byte-frozen).
export function roadStageFor(viewerPlayer, techsTable) {
  if (!viewerPlayer || !viewerPlayer.techs || !techsTable) return 0;
  let stage = 0;
  for (const id of viewerPlayer.techs) {
    const t = techsTable[id];
    if (!t) continue;
    if (t.era === 'renaissance' && stage < 1) stage = 1;
    else if (t.era === 'industrial' && stage < 2) stage = 2;
    if (id === 'automobile' && stage < 3) stage = 3;
    if ((id === 'plastics' || id === 'space-flight') && stage < 4) stage = 4;
  }
  return stage;
}

// Annotate a fog-filtered view with a render-only per-city era band, written to
// a SIDE MAP (`view.cityEraBands[id]`) the renderer reads — NOT onto the city
// objects. filterView aliases own/omniscient city objects straight from real
// state (visibility.js: `cities[id] = c`), so stamping `c.eraBand` would mutate
// state.cities and taint every hash path; the side map lives only on the fresh
// top-level view object filterView allocates, so it is truly never state/hash.
export function annotateCityEra(view, techsTable, viewerId) {
  if (!view || !view.cities) return view;
  const bands = {};
  for (const id of Object.keys(view.cities)) {
    const c = view.cities[id];
    bands[id] = cityEraBand(view.players && view.players[c.owner], techsTable);
  }
  view.cityEraBands = bands;
  // H13: the viewer's road stage rides the same side-annotation. A viewer
  // with no player (spectator/omniscient) sees the world as it is — the MAX
  // stage across players whose techs the view carries.
  if (view.players) {
    if (viewerId !== undefined && view.players[viewerId]) {
      view.viewerRoadStage = roadStageFor(view.players[viewerId], techsTable);
    } else {
      let best = 0;
      for (const p of Object.values(view.players)) {
        const st = roadStageFor(p, techsTable);
        if (st > best) best = st;
      }
      view.viewerRoadStage = best;
    }
  }
  return view;
}

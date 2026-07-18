// A89 caravan trade routes (engine/trade.js): the land-connectivity flood fill
// and the permanent-route ranking/cap. The command + windfall math + the R1
// base-arrows exclusion are pinned cross-language by scenarios 031-034; these
// are the JS-side unit rows the spec calls for (flood fill + ranking).
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/trade.js');
}

function strip(w, h, wrapX, oceanCols) {
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    tiles.push({ t: oceanCols && oceanCols.indexOf(x) !== -1 ? 'ocean' : 'grassland' });
  }
  return { width: w, height: h, wrapX: wrapX === true, tiles };
}

test('landConnected: same landmass is true, an ocean gap is false', async () => {
  const trade = await load();
  const same = { map: strip(5, 1, false) };
  assert.strictEqual(trade.landConnected(same, 0, 0, 4, 0, RULESET), true, 'all grassland — connected');
  const split = { map: strip(5, 1, false, [2]) };
  assert.strictEqual(trade.landConnected(split, 0, 0, 4, 0, RULESET), false, 'ocean at x=2 severs the two ends');
});

test('landConnected: reaches across the wrapX seam', async () => {
  const trade = await load();
  // x=0 and x=3 are land; x=1,2 ocean. Without wrap they are severed; with wrap
  // x=3 is adjacent to x=0 (the seam), so they connect.
  const noWrap = { map: strip(4, 1, false, [1, 2]) };
  assert.strictEqual(trade.landConnected(noWrap, 0, 0, 3, 0, RULESET), false, 'no wrap: ocean severs');
  const wrap = { map: strip(4, 1, true, [1, 2]) };
  assert.strictEqual(trade.landConnected(wrap, 0, 0, 3, 0, RULESET), true, 'wrapX: connected across the seam');
});

test('landConnected: a single-tile island is connected only to itself', async () => {
  const trade = await load();
  // 3x3: only the center (1,1) is land, ringed by ocean
  const ocean = [];
  for (let i = 0; i < 9; i++) ocean.push({ t: 'ocean' });
  ocean[1 * 3 + 1] = { t: 'grassland' };
  const st = { map: { width: 3, height: 3, wrapX: false, tiles: ocean } };
  assert.strictEqual(trade.landConnected(st, 1, 1, 1, 1, RULESET), true, 'a tile connects to itself');
  assert.strictEqual(trade.landConnected(st, 1, 1, 0, 0, RULESET), false, 'the surrounding ocean is not land');
});

// A home city with four routes; each route's live contribution is
// idiv(homeArrows + partnerArrows + permanentPad, permanentDivisor) (same-civ
// halved). Only the top routeCap (3) count toward the home city's arrows.
function capState() {
  // 40x1 grassland, all roaded so cities carry real trade; home c1 is p1's
  // Palace (capital → no corruption), partners are p2 with rising pop.
  const w = 40, tiles = [];
  for (let x = 0; x < w; x++) tiles.push({ t: 'grassland', road: true });
  const mk = (id, owner, x, pop, extra) => Object.assign(
    { id, name: id, owner, x, y: 0, pop, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }, extra || {});
  return {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: w, height: 1, wrapX: false, tiles },
    units: {}, wonders: {}, nextUnitId: 9, nextCityId: 9,
    cities: {
      c1: mk('c1', 'p1', 2, 4, { buildings: ['palace'], tradeRoutes: [
        { partnerCityId: 'pa' }, { partnerCityId: 'pb' }, { partnerCityId: 'pc' }, { partnerCityId: 'pd' }] }),
      pa: mk('pa', 'p2', 10, 3), pb: mk('pb', 'p2', 18, 5), pc: mk('pc', 'p2', 26, 7), pd: mk('pd', 'p2', 34, 9)
    },
    cityOrder: ['c1', 'pa', 'pb', 'pc', 'pd'],
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    }, rngState: 1
  };
}

test('routeArrows: only the top routeCap routes count, ranked by contribution', async () => {
  const trade = await load();
  const st = capState();
  const home = st.cities.c1;
  const tr = RULESET.rules.tradeRoute;
  const hb = trade.tradeArrows(st, home, RULESET);
  const contrib = pid => Math.floor((hb + trade.tradeArrows(st, st.cities[pid], RULESET) + tr.permanentPad) / tr.permanentDivisor);
  const all = ['pa', 'pb', 'pc', 'pd'].map(contrib).sort((a, b) => b - a);
  const expected = all[0] + all[1] + all[2]; // top 3 of 4
  assert.strictEqual(trade.routeArrows(st, home, RULESET), expected, 'sum of the top-3 route contributions');
  assert.ok(all[3] >= 0, 'the 4th (lowest) is excluded but still present in state');
  assert.strictEqual(home.tradeRoutes.length, 4, 'all four routes remain in state');
});

test('routeArrows: an empty / route-less city contributes 0, and the fill is stable', async () => {
  const trade = await load();
  const st = capState();
  assert.strictEqual(trade.routeArrows(st, st.cities.pa, RULESET), 0, 'no tradeRoutes → 0');
  // deterministic: repeated calls identical (the sort tiebreak keeps it stable)
  const a = trade.routeArrows(st, st.cities.c1, RULESET);
  const b = trade.routeArrows(st, st.cities.c1, RULESET);
  assert.strictEqual(a, b);
});

test('tradeRouteReport: every route in state order with its arrows + counted flag', async () => {
  const trade = await load();
  const st = capState();
  const report = trade.tradeRouteReport(st, st.cities.c1, RULESET);
  assert.deepStrictEqual(report.map(r => r.partnerCityId), ['pa', 'pb', 'pc', 'pd'], 'STATE order, not ranked');
  // the top routeCap by contribution are counted; the sum of counted == routeArrows
  const countedSum = report.filter(r => r.counted).reduce((s, r) => s + r.arrows, 0);
  assert.strictEqual(countedSum, trade.routeArrows(st, st.cities.c1, RULESET), 'counted arrows == the applied bonus');
  assert.strictEqual(report.filter(r => r.counted).length, RULESET.rules.tradeRoute.routeCap, 'exactly routeCap counted (4 routes > cap 3)');
  // the four contributions tie (idiv(·,8) flattens the pop spread), so the
  // lower-partnerCityId tiebreak keeps pa/pb/pc and leaves pd (highest id) out
  assert.strictEqual(report.find(r => r.partnerCityId === 'pd').counted, false, 'the tie-broken-out route (highest partnerCityId) is not counted');
  for (const pid of ['pa', 'pb', 'pc']) assert.strictEqual(report.find(r => r.partnerCityId === pid).counted, true, `${pid} is counted`);
  // a route-less city reports nothing
  assert.deepStrictEqual(trade.tradeRouteReport(st, st.cities.pa, RULESET), []);
});

test('a route to a destroyed partner is skipped (defensive prune)', async () => {
  const trade = await load();
  const st = capState();
  delete st.cities.pd; // pd destroyed; c1 still lists a route to it
  const tr = RULESET.rules.tradeRoute;
  const hb = trade.tradeArrows(st, st.cities.c1, RULESET);
  const contrib = pid => Math.floor((hb + trade.tradeArrows(st, st.cities[pid], RULESET) + tr.permanentPad) / tr.permanentDivisor);
  const expected = ['pa', 'pb', 'pc'].map(contrib).reduce((s, c) => s + c, 0); // pd gone; 3 left, all count
  assert.strictEqual(trade.routeArrows(st, st.cities.c1, RULESET), expected, 'the dead partner route is skipped, not counted');
});

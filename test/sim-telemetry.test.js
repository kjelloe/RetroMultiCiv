// A64: the AI-health telemetry helpers (docs/05 §12, M3–M14). The pure
// geography (continents, road connectivity, exploration) and the driver-owned
// event/idle accumulator are unit-tested on crafted inputs here; the full
// column set is smoke-exercised by the soak/sim runs. All of this is
// DIAGNOSTICS — it reads state/events, never writes near state, so the sim
// goldens are untouched (proven separately by simulation.test.js staying green).
const test = require('node:test');
const assert = require('node:assert');
const {
  landContinents, netComponents, networkPct, explorationPct, continentsSettled,
  makeTelemetry, absorbEvents, updateLedger, idleCounts
} = require('./sim-driver.js');

// a tiny ruleset: land vs ocean vs ice — only what the geography helpers read
const RULESET = { terrain: { terrains: {
  g: { domain: 'land' }, o: { domain: 'sea' }, ice: { domain: 'ice' }
} } };

// build a WxH map from a string grid (rows of single-char terrain ids)
function mapFrom(rows, wrapX) {
  const H = rows.length, W = rows[0].length, tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: rows[y][x] });
  return { width: W, height: H, wrapX: wrapX === true, tiles };
}

test('landContinents: an ocean channel splits two landmasses', () => {
  const map = mapFrom(['ggoogg', 'ggoogg']);
  const { count, label } = landContinents(map, RULESET);
  assert.strictEqual(count, 2, 'two continents either side of the channel');
  assert.strictEqual(label[0], label[6], 'top-left and bottom-left are one continent');
  assert.notStrictEqual(label[0], label[4], 'the right block is a different continent');
  assert.strictEqual(label[2], -1, 'ocean is not land');
});

test('landContinents: a diagonal land bridge is ONE continent (8-connected)', () => {
  // (1,0) and (2,1) touch only at a corner — 8-connectivity joins them
  const m2 = mapFrom(['ggo', 'ogg', 'ooo']);
  const { count } = landContinents(m2, RULESET);
  assert.strictEqual(count, 1, 'the diagonal bridge keeps it one landmass');
});

test('landContinents: wrapX joins tiles across the seam', () => {
  const map = mapFrom(['goog'], true); // x=0 and x=3 are adjacent across the wrap
  const { count, label } = landContinents(map, RULESET);
  assert.strictEqual(count, 1, 'the seam joins the two land edges');
  assert.strictEqual(label[0], label[3], 'same continent across the wrap');
});

test('networkPct: same-continent city pairs, road-connected vs not', () => {
  // one landmass; two cities at x=0 and x=4 on row 0; a road can join them
  const rows = ['ggggg', 'ggggg'];
  function stateWith(roadCols) {
    const map = mapFrom(rows);
    for (const c of roadCols) map.tiles[c].road = true; // road tiles on row 0
    return {
      map,
      cityOrder: ['a', 'b'],
      cities: { a: { id: 'a', owner: 'p1', x: 0, y: 0 }, b: { id: 'b', owner: 'p1', x: 4, y: 0 } }
    };
  }
  const cont = landContinents(mapFrom(rows), RULESET);
  // a continuous road 0..4 → connected (cities are hubs, so cols 1,2,3 suffice)
  let s = stateWith([1, 2, 3]);
  assert.strictEqual(networkPct(s, 'p1', cont, netComponents(s, false)), 100, 'a road joins the pair');
  // a gap at col 2 → the network splits → 0%
  s = stateWith([1, 3]);
  assert.strictEqual(networkPct(s, 'p1', cont, netComponents(s, false)), 0, 'a gap breaks connectivity');
});

test('networkPct: cities on different continents are not a pair (null)', () => {
  const rows = ['gog']; // two 1-tile continents split by ocean
  const map = mapFrom(rows);
  const s = { map, cityOrder: ['a', 'b'],
    cities: { a: { id: 'a', owner: 'p1', x: 0, y: 0 }, b: { id: 'b', owner: 'p1', x: 2, y: 0 } } };
  const cont = landContinents(map, RULESET);
  assert.strictEqual(networkPct(s, 'p1', cont, netComponents(s, false)), null, 'no same-continent pairs');
});

test('explorationPct: ice excluded; explored-over-non-ice', () => {
  // a 4-tile row: g g ice ice — non-ice = the two 'g'; explored the first only
  const mm = { width: 4, height: 1, wrapX: false,
    tiles: [{ t: 'g' }, { t: 'g' }, { t: 'ice' }, { t: 'ice' }] };
  const state = { map: mm, players: { p1: { explored: [1, 0, 1, 1] } } };
  // non-ice tiles = 2; explored among them = 1 → 50% (the ice explored flags ignored)
  assert.strictEqual(explorationPct(state, 'p1', RULESET), 50);
  // omniscient (no explored array) → 100
  assert.strictEqual(explorationPct({ map: mm, players: { p1: {} } }, 'p1', RULESET), 100);
});

test('continentsSettled: counts distinct continents a civ has cities on', () => {
  const map = mapFrom(['gog']); // continents 0 (x0) and 1 (x2)
  const cont = landContinents(map, RULESET);
  const state = { map, cityOrder: ['a', 'b', 'c'], cities: {
    a: { id: 'a', owner: 'p1', x: 0, y: 0 },
    b: { id: 'b', owner: 'p1', x: 2, y: 0 },
    c: { id: 'c', owner: 'p2', x: 0, y: 0 }
  } };
  assert.strictEqual(continentsSettled(state, 'p1', cont), 2);
  assert.strictEqual(continentsSettled(state, 'p2', cont), 1);
});

test('absorbEvents: attacks, captures, buys, wonder-attempts (deduped), cross-water', () => {
  const map = mapFrom(['gog']); // two continents
  const cont = landContinents(map, RULESET);
  const state = { map, playerOrder: ['p1', 'p2'], cityOrder: ['a', 'b'], cities: {
    a: { id: 'a', owner: 'p1', x: 0, y: 0 }, // p1's home on continent 0
    b: { id: 'b', owner: 'p1', x: 2, y: 0 }  // p1's SECOND city on continent 1 (cross-water)
  } };
  const tel = makeTelemetry(state);
  absorbEvents(tel, [
    { type: 'combatResolved', attackerOwner: 'p1', defenderOwner: 'p2' },
    { type: 'combatResolved', attackerOwner: 'p1', defenderOwner: 'p2' },
    { type: 'cityCaptured', from: 'p2', to: 'p1' },
    { type: 'productionBought', cityId: 'a' },
    { type: 'productionSet', cityId: 'a', item: { kind: 'wonder', id: 'pyramids' } },
    { type: 'productionSet', cityId: 'a', item: { kind: 'wonder', id: 'pyramids' } }, // dup → not recounted
    { type: 'productionSet', cityId: 'a', item: { kind: 'unit', id: 'militia' } },     // not a wonder
    { type: 'cityFounded', cityId: 'b', x: 2, y: 0 } // b is on a continent with no other p1 city
  ], state, cont);
  const t = tel.per.p1;
  assert.strictEqual(t.attacks, 2);
  assert.strictEqual(t.captures, 1);
  assert.strictEqual(t.buys, 1);
  assert.strictEqual(t.wonderTry, 1, 'the duplicate wonder set is deduped');
  assert.strictEqual(t.crossWater, 1, 'the island city was reached across water');
});

test('idleCounts: idle settlers (not terraforming) and stuck units, over the ledger', () => {
  const map = mapFrom(['ggggg']);
  const state = {
    map, playerOrder: ['p1'],
    cityOrder: [], cities: {},
    turn: 1,
    units: {
      s1: { id: 's1', owner: 'p1', type: 'settlers', x: 0, y: 0 },
      s2: { id: 's2', owner: 'p1', type: 'settlers', x: 1, y: 0, working: 'irrigate' },
      w1: { id: 'w1', owner: 'p1', type: 'militia', x: 2, y: 0 }
    }
  };
  const tel = makeTelemetry(state);
  updateLedger(tel, state, 1); // everyone's clock starts at turn 1
  // jump to turn 20 without any unit moving
  state.turn = 20;
  updateLedger(tel, state, 20); // positions unchanged → clocks stay at 1
  const out = idleCounts(tel, state, { units: { settlers: {}, militia: {} } });
  assert.strictEqual(out.p1.idleSet, 1, 's1 idle 19t; s2 is terraforming so excluded');
  assert.strictEqual(out.p1.stuckU, 1, 'w1 unmoved 19t, not in a city/fortress');
});

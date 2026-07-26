// W6 slice-1d — GARRISON ROLE DISCIPLINE (user ruling 2026-07-26): a FORTIFIED
// unit in an own city holds its post unless the city keeps its guard floor
// without it. Guards the two measured escape routes (peace-witness + #2774
// diagnosis): escort duty and the march-at-enemy branch stripping garrisons.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return { ai, engine: createEngine(RULESET) };
}

function world(units) {
  const width = 13, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units,
    cities: {
      c9: { id: 'c9', name: 'Post', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0,
            buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c9'], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('slice-1d: a sole fortified garrison does NOT leave for escort duty', async () => {
  const { ai, engine } = await load();
  // one fortified guard, an unguarded settler 3 tiles out (inside every stance's
  // escort radius) — before 1d the guard walked off and the city stood empty
  const state = world({
    g1: { id: 'g1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 1, fortified: true, veteran: false },
    s1: { id: 's1', type: 'settlers', owner: 'p1', x: 7, y: 4, moves: 0, fortified: false, veteran: false }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.units.g1.x, 4, 'garrison holds x');
  assert.strictEqual(after.units.g1.y, 4, 'garrison holds y');
  assert.strictEqual(after.units.g1.fortified, true, 'still fortified (wait, not move)');
});

test('slice-1d: a sole fortified garrison does NOT march at a nearby enemy', async () => {
  const { ai, engine } = await load();
  // viable enemy (bare settlers, trivially beatable) within march radius 8 —
  // before 1d a fortified defender sortied and the city stood empty
  const state = world({
    g1: { id: 'g1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 1, fortified: true, veteran: false },
    e1: { id: 'e1', type: 'settlers', owner: 'p2', x: 8, y: 4, moves: 0, fortified: false, veteran: false }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.units.g1.x, 4, 'garrison holds the city, no sortie');
  assert.strictEqual(after.units.g1.y, 4);
});

test('slice-1d: a SPARE fortified guard may still depart (floor kept without it)', async () => {
  const { ai, engine } = await load();
  // two fortified guards, no threat (need 1): one may take the escort; the city
  // must retain at least one attack-capable defender afterwards
  const state = world({
    g1: { id: 'g1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 1, fortified: true, veteran: false },
    g2: { id: 'g2', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 1, fortified: true, veteran: false },
    s1: { id: 's1', type: 'settlers', owner: 'p1', x: 7, y: 4, moves: 0, fortified: false, veteran: false }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  let inCity = 0;
  for (const uid of ['g1', 'g2']) {
    const u = after.units[uid];
    if (u && u.x === 4 && u.y === 4) inCity++;
  }
  assert.ok(inCity >= 1, 'the city keeps its guard floor: at least one of the pair stays');
});

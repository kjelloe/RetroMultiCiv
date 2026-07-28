// W6 build-doctrine slice-5 (specs/build-doctrine-plan.md slice-5 seed; §3a):
// the SUPER-FOOD SPECIALIST PLAY — a ONE-CITY happiness wonder (data
// effect.allContentInCity, i.e. Shakespeare's Theatre) is hosted in the
// empire's best SPAWNER-role city (high food, low shields: the city that can
// run many specialists under it), while everywhere-wonders keep concentrating
// in the highest-shield drive city. The appetite tier gate still reads the
// DRIVE city (civ maturity); only the PLACEMENT moves. The wonder host also
// gets the hoisted persist (a half-built wonder there is never dropped for a
// doctrine building). No new knobs — roles + the wonder effect field decide.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return { ai, engine: createEngine(RULESET) };
}

// cityA = mined-mountain ring (the high-shield DRIVE city, appetite gate
// opens there); cityB = irrigated grassland ring under monarchy (SPAWNER:
// big surplus, ~0 shields). builder stance (appetite HIGH). Settlers parked.
function wonderState(techs, opts) {
  const o = opts || {};
  const width = 20, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  const paint = (cx, cy, tile) => {
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      tiles[(cy + dy) * width + (cx + dx)] = Object.assign({}, tile);
    }
  };
  paint(4, 4, { t: 'grassland', special: true }); // score 8 beats plain grassland: workers take 2f1s -> real shields
  if (o.noSpawner !== true) paint(12, 4, { t: 'grassland', irrigation: true });
  const units = {};
  let n = 1;
  for (const [x, y] of o.noSpawner === true ? [[4, 4]] : [[4, 4], [12, 4]]) {
    units['g' + n] = { id: 'g' + n, type: 'militia', owner: 'p1', x, y, moves: 0, fortified: true, veteran: false }; n = n + 1;
  }
  units.s1 = { id: 's1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false };
  units.s2 = { id: 's2', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false };
  units.s3 = { id: 's3', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false };
  const cities = {
    ca: Object.assign({
      id: 'ca', name: 'Forge', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0,
      buildings: ['granary', 'temple'], producing: { kind: 'unit', id: 'militia' }
    }, o.caExtra || {})
  };
  const cityOrder = ['ca'];
  if (o.noSpawner !== true) {
    cities.cb = Object.assign({
      id: 'cb', name: 'Garden', owner: 'p1', x: 12, y: 4, pop: 4, food: 0, shields: 0,
      buildings: ['granary', 'temple'], producing: { kind: 'unit', id: 'militia' }
    }, o.cbExtra || {});
    cityOrder.push('cb');
  }
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units, cities, cityOrder, wonders: o.wonders || {}, nextUnitId: 60, nextCityId: 20,
    players: {
      p1: {
        id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs,
        researching: 'writing', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'builder',
        government: 'monarchy'
      },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

const SHAX = 'shakespeare-s-theatre';
const SHAX_TECH = RULESET.wonders[SHAX].tech;

test('slice-5: the one-city happiness wonder is HOSTED in the spawner city', async () => {
  const { ai, engine } = await load();
  // builder affinity: pyramids (masonry, unknown) -> shakespeare (tech known)
  const after = ai.runAiTurn(engine, wonderState(['pottery', 'ceremonial-burial', 'monarchy', SHAX_TECH]), 'p1', RULESET);
  assert.deepStrictEqual(after.cities.cb.producing, { kind: 'wonder', id: SHAX },
    '§3a: the specialist wonder goes where the FOOD is — the spawner runs the specialists');
  assert.notDeepStrictEqual(after.cities.ca.producing, { kind: 'wonder', id: SHAX },
    'the drive city does not duplicate it (one wonder in flight per civ)');
});

test('slice-5: an EVERYWHERE-wonder stays in the high-shield drive city', async () => {
  const { ai, engine } = await load();
  // no shakespeare tech: builder affinity misses -> cheapest fallback =
  // hanging-gardens (contentEverywhere, NOT allContentInCity)
  const after = ai.runAiTurn(engine, wonderState(['pottery', 'ceremonial-burial', 'monarchy']), 'p1', RULESET);
  assert.strictEqual(after.cities.ca.producing.kind, 'wonder',
    'empire-wide wonders concentrate where the shields are (unchanged)');
  assert.notStrictEqual(after.cities.cb.producing.kind, 'wonder', 'the spawner is not the host here');
});

test('slice-5: with NO spawner city the specialist wonder falls back to the drive city', async () => {
  const { ai, engine } = await load();
  const after = ai.runAiTurn(engine, wonderState(['pottery', 'ceremonial-burial', 'monarchy', SHAX_TECH], { noSpawner: true }), 'p1', RULESET);
  assert.deepStrictEqual(after.cities.ca.producing, { kind: 'wonder', id: SHAX },
    'placement preference, not a hard requirement');
});

test('slice-5: the wonder HOST persists its half-built wonder over an owed doctrine building', async () => {
  const { ai, engine } = await load();
  // cb is mid-shakespeare with NO granary/temple (doctrine owed): the hoisted
  // persist must keep the wonder — never restart the doctrine cascade there
  const after = ai.runAiTurn(engine,
    wonderState(['pottery', 'ceremonial-burial', 'monarchy', SHAX_TECH],
      { cbExtra: { buildings: [], shields: 40, producing: { kind: 'wonder', id: SHAX } } }),
    'p1', RULESET);
  assert.deepStrictEqual(after.cities.cb.producing, { kind: 'wonder', id: SHAX },
    'R1 for the host: a half-built wonder outranks the doctrine slot (half-shields penalty is real)');
});

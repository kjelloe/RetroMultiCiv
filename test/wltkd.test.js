// W4 — We Love the King Day (celebration). Civ1-faithful (user 2026-07-25):
// a city with happy*2 >= pop and no unhappy celebrates. While celebrating,
// corruption/waste drops to 0 (all governments); under Republic/Democracy an
// extra +1 trade lands on tiles already producing trade. No rapture growth.
// FIXTURE-FIRST: these assert the intended behaviour before the engine change.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const government = await import('../engine/government.js');
  const happiness = await import('../engine/happiness.js');
  return { government, happiness };
}

// a capital + a far city under Monarchy (corruptionFactor > 0), so the far city
// normally loses trade to corruption; celebrating zeroes it.
function corruptState(cityExtra) {
  const tiles = [];
  for (let i = 0; i < 45; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 45, height: 1, wrapX: false, tiles },
    units: {},
    cities: {
      c1: { id: 'c1', name: 'Capital', owner: 'p1', x: 0, y: 0, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: Object.assign({ id: 'c2', name: 'Far', owner: 'p1', x: 40, y: 0, pop: 4, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }, cityExtra || {})
    },
    cityOrder: ['c1', 'c2'], wonders: {}, nextUnitId: 9, nextCityId: 3,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, government: 'monarchy', gold: 0, techs: ['monarchy'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('W4: a celebrating city loses no trade to corruption (all governments)', async () => {
  const { government } = await load();
  // control: the far city is NOT celebrating — Monarchy corruption bites
  const control = corruptState();
  const lost = government.corruptionFor(control, control.cities.c2, 10, RULESET);
  assert.ok(lost > 0, 'the far Monarchy city normally loses trade to corruption (control)');
  // celebrating: corruption drops to 0
  const celebrating = corruptState({ celebrating: true });
  assert.strictEqual(government.corruptionFor(celebrating, celebrating.cities.c2, 10, RULESET), 0,
    'We Love the King Day zeroes corruption/waste');
});

test('W4: the celebrate flag is set at turn wrap when happy>=half and no unhappy', async () => {
  const { happiness } = await load();
  // a city whose mood qualifies (happy*2 >= pop, unhappy 0) gets city.celebrating;
  // one that does not has the flag absent (mirrors city.disorder set/delete).
  const state = corruptState();
  // give c2 a mood that celebrates: Cure for Cancer (happyEverywhere) + genetic-engineering
  state.wonders = { 'cure-for-cancer': 'c1' };
  state.players.p1.techs = ['monarchy', 'genetic-engineering'];
  const events = [];
  happiness.updateCelebration(state, RULESET, events);
  const mood = happiness.cityMood(state, state.cities.c2, RULESET, undefined);
  const qualifies = mood.happy * 2 >= state.cities.c2.pop && mood.unhappy === 0;
  assert.strictEqual(state.cities.c2.celebrating === true, qualifies,
    'celebrating flag matches the happy>=half && no-unhappy predicate');
});

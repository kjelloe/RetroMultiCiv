// W8 econ pair (specs/w8-econ-doctrine.md; unit-doctrine v1x §1 offensive + §2):
//   DIPLOMAT DOCTRINE — a tech-lagging civ with production and a garrison builds
//   diplomats and STEALS tech (preferring a rival whose reputation toward it is
//   already bad — "nothing to lose"); a diplomat also weakens an assault target
//   before the ground attack lands (sabotage, or incite only when affordable).
//   CARAVAN DOCTRINE — while a wonder builds, other cities that have their
//   garrison and role buildings send caravans to speed it; at peace, a surplus
//   city opens a trade route instead.
// AI BRAIN ONLY: every mechanic here already ships (diplomat-missions.js,
// cities.helpWonder, trade.establishTradeRoute) — these fixtures assert the
// BUILD choice and the ISSUED command at the pickCommand level.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  return import('../engine/ai.js');
}

// p1 (the subject) holds one city; p2 and p3 are rivals with cities. Everything
// is explored so the AI legitimately "knows" the rival cities. researching is
// non-empty so the research branch never intercepts the decision.
// SETTLER LOOP SATURATED by default (two idle settlers): EXPANSION outranks both
// doctrines by design — a city with settler headroom builds settlers, so these
// fixtures test what happens once that headroom is gone (the common case at any
// real empire size). Pass saturate:false to test the priority itself.
function econState(opts) {
  const o = opts || {};
  const width = 16, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  const units = Object.assign({
    g1: { id: 'g1', type: 'militia', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false },
    g2: { id: 'g2', type: 'militia', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false }
  }, o.saturate === false ? {} : {
    // three settlers saturate the loop at 1-3 cities (cap = settlerBase 2 + cities/2)
    s1: { id: 's1', type: 'settlers', owner: 'p1', x: 2, y: 3, moves: 1, fortified: false, veteran: false, workLeft: 9 },
    s2: { id: 's2', type: 'settlers', owner: 'p1', x: 2, y: 5, moves: 1, fortified: false, veteran: false, workLeft: 9 },
    s3: { id: 's3', type: 'settlers', owner: 'p1', x: 1, y: 4, moves: 1, fortified: false, veteran: false, workLeft: 9 }
  }, o.units || {});
  const cities = Object.assign({
    c1: {
      id: 'c1', name: 'Home', owner: 'p1', x: 3, y: 4, pop: 6, food: 0,
      shields: o.shields === undefined ? 12 : o.shields,
      // the W6 slice-1 doctrine (temple/granary) rightly outranks both W8 doctrines,
      // so a caravan/diplomat fixture must have those already built
      buildings: o.homeBuildings === undefined ? ['barracks'] : o.homeBuildings,
      producing: o.homeProducing === undefined ? { kind: 'unit', id: 'militia' } : o.homeProducing
    },
    e2: {
      id: 'e2', name: 'RivalB', owner: 'p2', x: 9, y: 4, pop: 5, food: 0, shields: 0,
      buildings: o.targetBuildings === undefined ? ['temple'] : o.targetBuildings,
      producing: { kind: 'unit', id: 'militia' }
    },
    e3: {
      id: 'e3', name: 'RivalC', owner: 'p3', x: 12, y: 6, pop: 5, food: 0, shields: 0,
      buildings: ['temple'], producing: { kind: 'unit', id: 'militia' }
    }
  }, o.cities || {});
  if (o.noOwnCity === true) { delete cities.c1; delete units.g1; delete units.g2; delete units.s1; delete units.s2; delete units.s3; }
  const cityOrder = o.noOwnCity === true ? ['e2', 'e3'] : ['c1', 'e2', 'e3'];
  for (const id of Object.keys(o.cities || {})) if (cityOrder.indexOf(id) === -1) cityOrder.push(id);
  const explored = new Array(width * height).fill(1);
  const mine = o.myTechs === undefined ? ['writing', 'bronze-working'] : o.myTechs;
  const theirs = o.rivalTechs === undefined
    ? ['writing', 'bronze-working', 'pottery', 'alphabet', 'ceremonial-burial', 'masonry', 'currency']
    : o.rivalTechs;
  return {
    version: 1, turn: 60, year: -1000, activePlayer: 'p1', playerOrder: ['p1', 'p2', 'p3'],
    map: { width, height, wrapX: false, tiles },
    units, cities, cityOrder, wonders: {}, nextUnitId: 90, nextCityId: 20,
    embassies: o.embassies === undefined ? { p1: { p2: 10, p3: 10 } } : o.embassies,
    relations: o.relations,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: o.gold === undefined ? 400 : o.gold,
        techs: mine, researching: 'currency', bulbs: 0, taxRate: 50, sciRate: 50, explored },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 100,
        techs: theirs, researching: 'trade', bulbs: 0, taxRate: 50, sciRate: 50 },
      p3: { id: 'p3', name: 'C', color: '#0f0', human: false, gold: 100,
        techs: theirs, researching: 'trade', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

function production(ai, state, cityId) {
  // walk the AI's decisions for this player until it sets THIS city's production
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  if (cmd !== undefined && cmd.type === 'setProduction' && cmd.cityId === cityId) return cmd;
  return cmd;
}

test('W8: the doctrine knobs exist in rules.json', () => {
  const d = RULESET.rules.diplomatDoctrine;
  const c = RULESET.rules.caravanDoctrine;
  assert.ok(d !== undefined, 'rules.diplomatDoctrine missing');
  assert.ok(Number.isInteger(d.techLagMin) && Number.isInteger(d.minShields)
    && Number.isInteger(d.maxInFlight) && Number.isInteger(d.prepRadius));
  assert.ok(c !== undefined, 'rules.caravanDoctrine missing');
  assert.ok(Number.isInteger(c.minShields) && Number.isInteger(c.maxInFlight)
    && Number.isInteger(c.wonderHelpMaxDistance));
});

test('W8a-1: a tech-lagging city with its garrison builds a diplomat', async () => {
  const ai = await load();
  const cmd = production(await Promise.resolve(ai), econState(), 'c1');
  assert.strictEqual(cmd.type, 'setProduction', 'behind in tech + garrison + shields -> steal intent');
  assert.strictEqual(cmd.cityId, 'c1');
  assert.deepStrictEqual(cmd.item, { kind: 'unit', id: 'diplomat' });
});

test('W8a-2: no diplomat while the garrison is below the floor', async () => {
  const ai = await load();
  const state = econState();
  delete state.units.g1;
  delete state.units.g2; // no defenders at all
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.ok(!(cmd.type === 'setProduction' && cmd.item.id === 'diplomat'),
    'the garrison floor outranks the doctrine (the slice-1a lesson)');
});

test('W8a-3: no diplomat without an intent (not lagging, no assault prep)', async () => {
  const ai = await load();
  const state = econState({ myTechs: ['writing', 'bronze-working', 'pottery', 'alphabet',
    'ceremonial-burial', 'masonry', 'currency'] }); // level with the rivals
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.ok(!(cmd.type === 'setProduction' && cmd.item.id === 'diplomat'),
    'no lag, no siege -> no diplomat (idle diplomats are the failure mode)');
});

test('W8a-4: a diplomat adjacent to a rival city STEALS tech', async () => {
  const ai = await load();
  const state = econState({ noOwnCity: true, units: {
    d9: { id: 'd9', type: 'diplomat', owner: 'p1', x: 8, y: 4, moves: 2, fortified: false, veteran: false }
  } });
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'diplomatMission');
  assert.strictEqual(cmd.unitId, 'd9');
  assert.strictEqual(cmd.mission, 'stealTech');
  assert.strictEqual(cmd.targetCityId, 'e2');
});

test('W8a-5: among rivals, the one whose reputation toward me is worst is preferred', async () => {
  const ai = await load();
  // both rival cities equidistant from the diplomat; p3 already hates p1
  const state = econState({
    noOwnCity: true,
    cities: { e2: { id: 'e2', name: 'RivalB', owner: 'p2', x: 9, y: 4, pop: 5, food: 0, shields: 0,
      buildings: ['temple'], producing: { kind: 'unit', id: 'militia' } } },
    units: { d9: { id: 'd9', type: 'diplomat', owner: 'p1', x: 10, y: 5, moves: 2, fortified: false, veteran: false } },
    relations: { p2: { p1: { reputation: 0 } }, p3: { p1: { reputation: -40 } } }
  });
  state.cities.e3.x = 11; state.cities.e3.y = 5; // same distance as e2 from (10,5)
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'diplomatMission');
  assert.strictEqual(cmd.targetCityId, 'e3', 'nothing to lose with a rival who already hates us');
});

test('W8a-6: assault prep SABOTAGES a target that has buildings', async () => {
  const ai = await load();
  // a besieger already holds adjacent to e2 -> the city is an assault target
  const state = econState({ noOwnCity: true, units: {
    a1: { id: 'a1', type: 'legion', owner: 'p1', x: 8, y: 4, moves: 0, fortified: false, veteran: false },
    d9: { id: 'd9', type: 'diplomat', owner: 'p1', x: 8, y: 5, moves: 2, fortified: false, veteran: false }
  }, myTechs: ['writing', 'bronze-working', 'pottery', 'alphabet', 'ceremonial-burial', 'masonry', 'currency'] });
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'diplomatMission');
  assert.strictEqual(cmd.unitId, 'd9');
  assert.strictEqual(cmd.mission, 'sabotage', 'weaken the target before the assault lands');
  assert.strictEqual(cmd.targetCityId, 'e2');
});

test('W8a-7: incite is never issued when the treasury cannot pay', async () => {
  const ai = await load();
  const state = econState({ gold: 0, targetBuildings: [], noOwnCity: true, units: {
    a1: { id: 'a1', type: 'legion', owner: 'p1', x: 8, y: 4, moves: 0, fortified: false, veteran: false },
    d9: { id: 'd9', type: 'diplomat', owner: 'p1', x: 8, y: 5, moves: 2, fortified: false, veteran: false }
  } });
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.ok(!(cmd.type === 'diplomatMission' && cmd.mission === 'inciteRevolt'),
    'an unaffordable mission is a wasted turn — never issue it');
});

test('W8b-8: a wonder in progress makes another city build a caravan', async () => {
  const ai = await load();
  const state = econState({
    myTechs: ['writing', 'bronze-working', 'pottery', 'alphabet', 'ceremonial-burial',
      'masonry', 'currency', 'trade'],
    homeBuildings: ['barracks', 'temple', 'granary'],
    cities: {
      w1: { id: 'w1', name: 'Wonders', owner: 'p1', x: 5, y: 2, pop: 4, food: 0, shields: 30,
        buildings: ['temple'], producing: { kind: 'wonder', id: 'pyramids' } }
    }
  });
  state.units.g3 = { id: 'g3', type: 'militia', owner: 'p1', x: 5, y: 2, moves: 0, fortified: true, veteran: false };
  state.units.g4 = { id: 'g4', type: 'militia', owner: 'p1', x: 5, y: 2, moves: 0, fortified: true, veteran: false };
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'setProduction', 'the classic caravan chain: other cities feed the wonder');
  assert.strictEqual(cmd.cityId, 'c1');
  assert.deepStrictEqual(cmd.item, { kind: 'unit', id: 'caravan' });
});

test('W8b-9: a caravan adjacent to the wonder city issues helpWonder', async () => {
  const ai = await load();
  const state = econState({
    myTechs: ['writing', 'bronze-working', 'pottery', 'alphabet', 'ceremonial-burial',
      'masonry', 'currency', 'trade'],
    homeBuildings: ['barracks', 'temple', 'granary'],
    cities: {
      w1: { id: 'w1', name: 'Wonders', owner: 'p1', x: 5, y: 2, pop: 4, food: 0, shields: 30,
        buildings: ['temple'], producing: { kind: 'wonder', id: 'pyramids' } }
    },
    // the home city already produces what the AI would choose, so no setProduction
    // command preempts the unit loop — the caravan brain is the subject here
    homeProducing: { kind: 'unit', id: 'caravan' },
    units: {
      k9: { id: 'k9', type: 'caravan', owner: 'p1', x: 5, y: 2, moves: 1, fortified: false, veteran: false, home: 'c1' }
    }
  });
  const cmd = ai.pickCommand(state, 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'helpWonder');
  assert.strictEqual(cmd.unitId, 'k9'); // helpWonder resolves the city from the unit's tile
});

test('W8b-10: at peace a surplus city opens a route; at war it does not', async () => {
  const ai = await load();
  const base = {
    myTechs: ['writing', 'bronze-working', 'pottery', 'alphabet', 'ceremonial-burial',
      'masonry', 'currency', 'trade'],
    homeBuildings: ['barracks', 'temple', 'granary'],
    cities: {
      c2: { id: 'c2', name: 'Second', owner: 'p1', x: 6, y: 7, pop: 4, food: 0, shields: 8,
        buildings: ['temple'], producing: { kind: 'unit', id: 'militia' } }
    }
  };
  const peace = econState(base);
  peace.units.g5 = { id: 'g5', type: 'militia', owner: 'p1', x: 6, y: 7, moves: 0, fortified: true, veteran: false };
  peace.units.g6 = { id: 'g6', type: 'militia', owner: 'p1', x: 6, y: 7, moves: 0, fortified: true, veteran: false };
  // NOTE (the trap this fixture guards): this state has NO `relations` table, and
  // engine/diplomacy.js relationOf() DEFAULTS TO 'war' when relations are absent.
  // A peace economy gated on formal relations would therefore read as permanent
  // war here AND in the no-diplomacy soak — dormant exactly like W6 slice-1a's
  // 0.9%-coverage doctrine. It passes only because econPeace uses the govSafe
  // proxy; if someone "fixes" that to relationOf, this test goes red on purpose.
  const peaceCmd = ai.pickCommand(peace, 'p1', RULESET, {});
  assert.ok(peaceCmd.type === 'setProduction' && peaceCmd.item.id === 'caravan',
    'the peace dividend: surplus goes into trade routes');

  const war = econState(base);
  war.units.g5 = { id: 'g5', type: 'militia', owner: 'p1', x: 6, y: 7, moves: 0, fortified: true, veteran: false };
  war.units.g6 = { id: 'g6', type: 'militia', owner: 'p1', x: 6, y: 7, moves: 0, fortified: true, veteran: false };
  war.units.a1 = { id: 'a1', type: 'legion', owner: 'p1', x: 8, y: 4, moves: 0, fortified: false, veteran: false };
  const warCmd = ai.pickCommand(war, 'p1', RULESET, {});
  assert.ok(!(warCmd.type === 'setProduction' && warCmd.item.id === 'caravan'),
    'at war the war doctrine outranks the peace economy');
});

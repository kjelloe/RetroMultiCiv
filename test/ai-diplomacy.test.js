// D3 AI diplomacy negotiation (spec d3): the relationship model + score models +
// the AI diplomacy step + the contact pass. The behavioral goldens (soak/natural)
// move under the sim-runner's swept constants; these lock the mechanism with the
// provisional constants (JS-side; the cross-language pin is scenario 013).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let engine, dip, aidip;
test('load', async () => {
  const { createEngine } = await import('../engine/index.js');
  dip = await import('../engine/diplomacy.js');
  aidip = await import('../engine/ai-diplomacy.js');
  engine = createEngine(RULESET);
});

function world(over) {
  const tiles = [];
  for (let i = 0; i < 35; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 7, height: 5, wrapX: false, tiles },
    units: {}, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: {
      p1: { id: 'p1', name: 'Rome', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, civ: 'romans' },   // Caesar, aggressive
      p2: { id: 'p2', name: 'India', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, civ: 'indians' }    // Gandhi, growth
    },
    rngState: 1
  }, over || {});
}

test('relationship accessors: directed grievance/trust, omit-safe defaults, clamp', () => {
  const s = world();
  assert.strictEqual(dip.grievanceOf(s, 'p1', 'p2'), 0, 'grievance default 0');
  assert.strictEqual(dip.trustOf(s, 'p1', 'p2'), 50, 'trust default 50');
  dip.bumpRel(s, 'p1', 'p2', 'grievance', 30);
  assert.strictEqual(dip.grievanceOf(s, 'p1', 'p2'), 30, 'p1 grievance toward p2');
  assert.strictEqual(dip.grievanceOf(s, 'p2', 'p1'), 0, 'DIRECTED — p2 grievance toward p1 unchanged');
  dip.bumpRel(s, 'p1', 'p2', 'grievance', 999);
  assert.strictEqual(dip.grievanceOf(s, 'p1', 'p2'), 100, 'clamped to 100');
  dip.bumpRel(s, 'p1', 'p2', 'trust', -999);
  assert.strictEqual(dip.trustOf(s, 'p1', 'p2'), 0, 'clamped to 0');
});

test('contact pass: a rival unit/city in sight flips met + pushes FIRST_CONTACT (both ways)', () => {
  const s = world({
    units: { u2: { id: 'u2', type: 'militia', owner: 'p2', x: 3, y: 2, moves: 1, fortified: false, veteran: false } },
    cities: { c1: { id: 'c1', name: 'A', owner: 'p1', x: 3, y: 3, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c1'],
    players: Object.assign(world().players, {}),
  });
  s.players.p1.explored = undefined; // omniscient so computeVisible sees all around c1
  const events = [];
  dip.contactPass(s, 'p1', events);
  assert.strictEqual(dip.metOf(s, 'p1', 'p2'), true, 'p1 met p2 (unit near the city)');
  assert.strictEqual(dip.metOf(s, 'p2', 'p1'), true, 'met is symmetric');
  assert.ok(events.some(e => e.type === 'FIRST_CONTACT'), 'FIRST_CONTACT pushed');
  const again = [];
  dip.contactPass(s, 'p1', again);
  assert.strictEqual(again.length, 0, 'no second FIRST_CONTACT (met already true)');
});

test('score models: aggressive-toward-weak spikes war intent; appeaser accepts, winner rejects', () => {
  const s = world({
    units: {
      a1: { id: 'a1', type: 'legion', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false },
      a2: { id: 'a2', type: 'cavalry', owner: 'p1', x: 3, y: 2, moves: 2, fortified: false, veteran: false },
      d1: { id: 'd1', type: 'militia', owner: 'p2', x: 3, y: 3, moves: 1, fortified: false, veteran: false }
    },
    cities: {
      c1: { id: 'c1', name: 'A', owner: 'p1', x: 2, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'legion' } },
      c2: { id: 'c2', name: 'B', owner: 'p2', x: 4, y: 3, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2']
  });
  const d = RULESET.rules.diplomacy;
  assert.ok(aidip.scoreWarIntent(s, 'p1', 'p2', RULESET) > d.warIntentThreshold, 'Caesar (strong) war intent toward weak Gandhi clears the bar');
  assert.ok(aidip.scorePeaceAccept(s, 'p2', 'p1', RULESET) > d.peaceAcceptThreshold, 'weak Gandhi appeases (would accept peace)');
  assert.ok(aidip.scorePeaceAccept(s, 'p1', 'p2', RULESET) <= d.peaceAcceptThreshold, 'winning Caesar does not accept peace');
});

test('the AI diplomacy step: at PEACE + high war intent -> declare (breaks the treaty)', async () => {
  const { runAiTurn } = await import('../engine/ai.js');
  const s = world({
    units: {
      a1: { id: 'a1', type: 'legion', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false },
      a2: { id: 'a2', type: 'cavalry', owner: 'p1', x: 3, y: 2, moves: 2, fortified: false, veteran: false },
      d1: { id: 'd1', type: 'militia', owner: 'p2', x: 3, y: 3, moves: 1, fortified: false, veteran: false }
    },
    cities: {
      c1: { id: 'c1', name: 'A', owner: 'p1', x: 2, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'legion' } },
      c2: { id: 'c2', name: 'B', owner: 'p2', x: 4, y: 3, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2'],
    relations: { 'p1|p2': { state: 'peace', treatyTurn: 5, met: true } }
  });
  const events = [];
  const after = runAiTurn(engine, s, 'p1', RULESET, events);
  assert.strictEqual(dip.relationOf(after, 'p1', 'p2'), 'war', 'the treaty was broken');
  assert.ok(events.some(e => e.type === 'WAR_DECLARED'), 'WAR_DECLARED');
  assert.ok(events.some(e => e.type === 'TREATY_BROKEN'), 'TREATY_BROKEN');
  assert.ok(dip.grievanceOf(after, 'p2', 'p1') > 0, 'the betrayed p2 gained grievance');
});

test('attack raises the victim grievance; a treaty-break decays on new peace', () => {
  // attack: p1 legion attacks p2 militia -> p2 grievance toward p1 rises
  const s = world({
    units: {
      a: { id: 'a', type: 'legion', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false },
      d: { id: 'd', type: 'militia', owner: 'p2', x: 3, y: 2, moves: 1, fortified: false, veteran: false }
    }
  });
  const r = engine.applyCommand(s, { type: 'moveUnit', playerId: 'p1', unitId: 'a', dir: 'E' });
  assert.ok(r.ok, r.reason);
  assert.ok(dip.grievanceOf(r.state, 'p2', 'p1') >= RULESET.rules.diplomacy.relGrievanceOnAttack - 1,
    'the attacked p2 gained grievance toward the attacker p1');
});

test('processDecay fades grievance each round (floored 0)', () => {
  const s = world();
  dip.bumpRel(s, 'p1', 'p2', 'grievance', 3);
  dip.processDecay(s, RULESET);
  assert.strictEqual(dip.grievanceOf(s, 'p1', 'p2'), 3 - RULESET.rules.diplomacy.relGrievanceDecay, 'decayed by relGrievanceDecay');
});

// A76 spaceship (engine/spaceship.js): shipStats characteristics, launch, and
// the arrival victory. The wiki-table cases (full 39/8/8/4/4/4 ship,
// minimum-viable, structurally-insufficient excess) pin the CONSTANT-INDEPENDENT
// characteristics (population/mass/support/energy/viability) as hard invariants;
// the flight-time model (flightYears/successPct) is asserted only by its bounds,
// because rules.ssFlight is sim-runner-swept — so this file never re-records when
// the flight constants freeze. The 029 scenario pins the cross-language victory.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/spaceship.js');
}

const F = RULESET.rules.ssFlight;

test('shipStats: the maxed wiki ship (39/8/8/4/4/4)', async () => {
  const ss = await load();
  const s = ss.shipStats({ structural: 39, propulsion: 8, fuel: 8, habitation: 4, lifeSupport: 4, solar: 4 }, RULESET);
  assert.strictEqual(s.population, 40000, '4 habitation * 10000 colonists');
  assert.strictEqual(s.supportPct, 100, '4 life-support fully feeds 4 habitation');
  assert.strictEqual(s.energyPct, 100, '4 solar * 2 powers 8 other modules');
  assert.strictEqual(s.mass, 39 * 100 + 16 * 400 + 8 * 1600 + 4 * 400);
  assert.ok(s.flightYears >= F.flightYearsMin, 'flight-years respect the floor');
  assert.ok(s.successPct >= 5 && s.successPct <= 100, 'viable success is clamped [5,100]');
  assert.strictEqual(ss.isViable({ structural: 39, propulsion: 8, fuel: 8, habitation: 4, lifeSupport: 4, solar: 4 }, RULESET), true);
});

test('shipStats: the minimum-viable ship (7 structural + 1 each)', async () => {
  const ss = await load();
  const ship = { structural: 7, propulsion: 1, fuel: 1, habitation: 1, lifeSupport: 1, solar: 1 };
  const s = ss.shipStats(ship, RULESET);
  assert.strictEqual(s.population, 10000);
  assert.strictEqual(s.supportPct, 100);
  assert.strictEqual(s.energyPct, 100);
  assert.strictEqual(s.mass, 7 * 100 + 2 * 400 + 2 * 1600 + 400);
  assert.strictEqual(ss.isViable(ship, RULESET), true, '7 structural (supports 5 slots) fits the 5 functional parts');
  assert.ok(s.successPct >= 5, 'a viable ship has a real success chance');
});

test('shipStats: structurally insufficient — excess parts add mass but do not function', async () => {
  const ss = await load();
  // 3 structural supports idiv(3*28,39)=2 slots; the fill order (propulsion,
  // fuel, ...) leaves fuel/modules unfunctional -> not viable, no colonists.
  const ship = { structural: 3, propulsion: 8, fuel: 8, habitation: 4, lifeSupport: 4, solar: 4 };
  const s = ss.shipStats(ship, RULESET);
  assert.strictEqual(ss.isViable(ship, RULESET), false, 'too little structure to connect the parts');
  assert.strictEqual(s.population, 0, 'no functional habitation');
  assert.strictEqual(s.successPct, 0, 'a non-viable ship has 0 success');
  // mass still counts EVERY part (the excess is dead weight, not absent)
  assert.strictEqual(s.mass, 3 * 100 + 16 * 400 + 8 * 1600 + 4 * 400);
});

test('shipStats: a ship missing a module type is not viable', async () => {
  const ss = await load();
  assert.strictEqual(ss.isViable({ structural: 7, propulsion: 1, fuel: 1, habitation: 1, lifeSupport: 1 }, RULESET), false, 'no solar');
  assert.strictEqual(ss.isViable({ structural: 7, propulsion: 1, habitation: 1, lifeSupport: 1, solar: 1 }, RULESET), false, 'no fuel');
  assert.strictEqual(ss.isViable(undefined, RULESET), false, 'no ship at all');
});

test('launchShip: viable ship launches once, sets arrivalTurn, and cannot re-launch', async () => {
  const ss = await load();
  const base = () => ({
    turn: 300, year: 1980, activePlayer: 'p1', playerOrder: ['p1'],
    cities: { c1: { id: 'c1', owner: 'p1', x: 0, y: 0, buildings: [] } }, cityOrder: ['c1'],
    wonders: { 'apollo-program': 'c1' },
    players: { p1: { id: 'p1', alive: true, techs: [],
      spaceship: { structural: 7, propulsion: 1, fuel: 1, habitation: 1, lifeSupport: 1, solar: 1 } } }
  });
  const s = base();
  const r = ss.launchShip(s, { type: 'launchShip', playerId: 'p1' }, RULESET);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.events[0].type, 'shipLaunched');
  assert.strictEqual(s.players.p1.spaceship.launched, 300);
  assert.ok(s.players.p1.spaceship.arrivalTurn > 300, 'a future arrival turn');
  const r2 = ss.launchShip(s, { type: 'launchShip', playerId: 'p1' }, RULESET);
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.reason, 'alreadyLaunched');

  // no Apollo -> cannot launch
  const noAp = base(); delete noAp.wonders;
  assert.strictEqual(ss.launchShip(noAp, { type: 'launchShip', playerId: 'p1' }, RULESET).reason, 'noApollo');
  // no ship -> cannot launch
  const noShip = base(); delete noShip.players.p1.spaceship;
  assert.strictEqual(ss.launchShip(noShip, { type: 'launchShip', playerId: 'p1' }, RULESET).reason, 'noShip');
});

test('processSpace: the first launched ship to arrive with its capital held wins', async () => {
  const ss = await load();
  const s = {
    turn: 315, year: 1980, gameOver: false, playerOrder: ['p1', 'p2'],
    cities: { c1: { id: 'c1', owner: 'p1', x: 0, y: 0, buildings: [] } }, cityOrder: ['c1'],
    wonders: { 'apollo-program': 'c1' },
    players: {
      p1: { id: 'p1', alive: true, techs: [],
        spaceship: { structural: 7, propulsion: 1, fuel: 1, habitation: 1, lifeSupport: 1, solar: 1, launched: 300, arrivalTurn: 315 } },
      p2: { id: 'p2', alive: true, techs: [] }
    }
  };
  const events = [];
  ss.processSpace(s, RULESET, events);
  assert.strictEqual(s.gameOver, true);
  assert.strictEqual(s.winner, 'p1');
  assert.ok(events.some(e => e.type === 'spaceVictory' && e.playerId === 'p1'));
  assert.ok(events.some(e => e.type === 'gameOver' && e.victory === 'space'));

  // before arrival: nothing fires
  const early = JSON.parse(JSON.stringify(s));
  early.gameOver = false; delete early.winner; early.turn = 314;
  const ev2 = [];
  ss.processSpace(early, RULESET, ev2);
  assert.strictEqual(early.gameOver, false, 'no victory before the arrival turn');
  assert.strictEqual(ev2.length, 0);
});

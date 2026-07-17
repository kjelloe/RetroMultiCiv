// B23b: phased scout allocation. A civ's scouts are the NEWEST ids across three
// pools — the early-militia QUOTA by city COUNT (rules.aiScoutQuotaByCities,
// clamped to the max key), up to aiFastScoutCount fast (moves>=2) units, and up
// to aiBoatScoutCount sea units — with a THREAT VETO that demotes any scout
// whose nearest own city is menaced (rules.aiScoutThreatVeto). The table absent
// falls back to the flat aiScoutSharePct share (old sweeps keep resolving). All
// counts are rules.json knobs the sim-runner sweeps; selection is deterministic
// (sorted-id rank). The ranging behavior itself is B23's (coast/wallfollow/bfs).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return await import('../engine/ai.js');
}

function withRules(overrides) {
  return Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, overrides) });
}

const S = { scoutSharePct: 100 }; // isScout only reads S.scoutSharePct (fallback path)

// A p1 world with `cities` p1 cities spread out, plus the given units. All tiles
// explored so enemyNear can see threats. threat=[x,y] drops a p2 unit there.
function world(cities, units, threat) {
  const W = 20, H = 12;
  const tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const explored = new Array(W * H).fill(1);
  const cityObj = {}, cityOrder = [];
  for (let i = 0; i < cities; i++) {
    const id = 'c' + (i + 1);
    cityObj[id] = { id, name: id, owner: 'p1', x: 2 + i * 3, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } };
    cityOrder.push(id);
  }
  const unitObj = {};
  for (const u of units) unitObj[u.id] = Object.assign({ owner: 'p1', moves: 1, fortified: false, veteran: false }, u);
  if (threat) unitObj.z9 = { id: 'z9', type: 'militia', owner: 'p2', x: threat[0], y: threat[1], moves: 1, fortified: false, veteran: false };
  const player = (id, exp) => ({ id, name: id, color: '#00f', human: false, gold: 0, techs: [], researching: 'x', government: 'monarchy', bulbs: 0, taxRate: 50, sciRate: 50, explored: exp });
  return {
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    units: unitObj, cities: cityObj, cityOrder, wonders: {}, nextUnitId: 99, nextCityId: 9,
    players: { p1: player('p1', explored), p2: player('p2', new Array(W * H).fill(1)) },
    rngState: 1
  };
}

const M = (id, x) => ({ id, type: 'militia', x, y: 2 });

test('B23b: the quota picks the NEWEST N militia by city COUNT (1 city -> 1, 2 -> 3)', async () => {
  const ai = await load();
  const r = withRules({ aiScoutQuotaByCities: { '1': 1, '2': 3, '3': 5 } }); // pin the table under test (mechanism, not the tunable default)
  const one = world(1, [M('u1', 6), M('u2', 7), M('u3', 8)]);
  assert.strictEqual(ai.isScout(one, 'p1', r, 'u3', S), true, '1 city, quota 1: newest militia scouts');
  assert.strictEqual(ai.isScout(one, 'p1', r, 'u2', S), false, 'older militia garrison');
  assert.strictEqual(ai.isScout(one, 'p1', r, 'u1', S), false);
  const two = world(2, [M('u1', 6), M('u2', 7), M('u3', 8)]);
  for (const id of ['u1', 'u2', 'u3']) assert.strictEqual(ai.isScout(two, 'p1', r, id, S), true, `2 cities, quota 3: ${id} scouts`);
});

test('B23b: the quota CLAMPS to the max key (4 cities uses the "3" bucket = 5)', async () => {
  const ai = await load();
  const r = withRules({ aiScoutQuotaByCities: { '1': 1, '2': 3, '3': 5 } });
  const st = world(4, [M('u1', 6), M('u2', 7), M('u3', 8), M('u4', 9), M('u5', 10), M('u6', 11)]);
  assert.strictEqual(ai.isScout(st, 'p1', r, 'u1', S), false, 'oldest of 6 is outside the newest-5 quota');
  for (const id of ['u2', 'u3', 'u4', 'u5', 'u6']) assert.strictEqual(ai.isScout(st, 'p1', r, id, S), true, `${id} within the clamped quota of 5`);
});

test('B23b: the THREAT VETO demotes a scout whose nearest own city is menaced', async () => {
  const ai = await load();
  const r = withRules({});
  const safe = world(1, [M('u1', 6)]);
  assert.strictEqual(ai.isScout(safe, 'p1', r, 'u1', S), true, 'unthreatened opener scouts');
  const menaced = world(1, [M('u1', 6)], [3, 2]); // enemy 1 tile from city c1 at (2,2)
  assert.strictEqual(ai.isScout(menaced, 'p1', r, 'u1', S), false, 'a visible threat near the home city vetoes the scout');
  const vetoOff = withRules({ aiScoutThreatVeto: false });
  assert.strictEqual(ai.isScout(menaced, 'p1', vetoOff, 'u1', S), true, 'veto off -> the scout departs regardless (sweepable)');
});

test('B23b: aiFastScoutCount tags fast (moves>=2) units BEYOND the militia quota', async () => {
  const ai = await load();
  // 1 city, quota 1 -> newest militia u3 scouts; the OLD cavalry u1 is outside
  // the militia quota but joins via the fast pool when aiFastScoutCount >= 1.
  const units = [{ id: 'u1', type: 'cavalry', x: 6, y: 2 }, M('u2', 7), M('u3', 8)];
  const on = withRules({ aiFastScoutCount: 2, aiScoutQuotaByCities: { '1': 1, '2': 3, '3': 5 } });
  const off = withRules({ aiFastScoutCount: 0, aiScoutQuotaByCities: { '1': 1, '2': 3, '3': 5 } });
  assert.strictEqual(ai.isScout(world(1, units), 'p1', on, 'u1', S), true, 'fast unit scouts via the fast pool');
  assert.strictEqual(ai.isScout(world(1, units), 'p1', off, 'u1', S), false, 'count 0 -> the old cavalry is not a scout (only the quota militia)');
});

test('B23b: aiBoatScoutCount tags sea units (coastal scouting; naval-probe gated)', async () => {
  const ai = await load();
  const units = [{ id: 'u1', type: 'sail', x: 6, y: 2 }, M('u2', 7)];
  const on = withRules({ aiBoatScoutCount: 1, aiScoutQuotaByCities: { '1': 1, '2': 3, '3': 5 } });
  const off = withRules({ aiBoatScoutCount: 0, aiScoutQuotaByCities: { '1': 1, '2': 3, '3': 5 } });
  assert.strictEqual(ai.isScout(world(1, units), 'p1', on, 'u1', S), true, 'sea unit scouts via the boat pool');
  assert.strictEqual(ai.isScout(world(1, units), 'p1', off, 'u1', S), false, 'count 0 -> no boat scout');
});

test('B23b: an ABSENT quota table falls back to the flat aiScoutSharePct share', async () => {
  const ai = await load();
  // no aiScoutQuotaByCities -> 25% of 4 militia = 1 -> newest one scouts (B21/B23)
  const r = Object.assign({}, RULESET, { rules: Object.assign({}, RULESET.rules, { aiScoutSharePct: 25 }) });
  delete r.rules.aiScoutQuotaByCities;
  const st = world(1, [M('u1', 6), M('u2', 7), M('u3', 8), M('u4', 9)]);
  assert.strictEqual(ai.isScout(st, 'p1', r, 'u4', S), true, 'fallback: newest of the flat share scouts');
  assert.strictEqual(ai.isScout(st, 'p1', r, 'u3', S), false, 'fallback share is 1 of 4');
});

// W2 OPENER EXCEPTION (experiment, rules.aiOpenerScoutException): a ONE-city civ's
// SOLE guard may scout when unthreatened — the user's founding-stage doctrine. The
// exception is confined to countCities===1; multi-city keeps the full guards>=2
// floor, and a threatened opener still holds. Tested through pickCommand (the
// garrison-departure decision), so production is pre-satisfied and fog exists for
// the freed scout to range toward.
function openerState(cityCount, threatened) {
  const W = 8, H = 5;
  const tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  const explored = new Array(W * H).fill(1);
  for (let y = 0; y < H; y++) explored[y * W + (W - 1)] = 0; // a fog column to range toward
  const cities = {}, cityOrder = [], units = {};
  for (let i = 0; i < cityCount; i++) {
    const id = 'c' + (i + 1), cx = 2 + i * 3;
    // pre-satisfy production so pickCommand reaches the UNIT decision: a threatened
    // city wants a 2nd defender (militia), an unthreatened one wants settlers.
    const wantId = threatened ? 'militia' : 'settlers';
    cities[id] = { id, name: id, owner: 'p1', x: cx, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: wantId } };
    cityOrder.push(id);
    units['u' + (i + 1)] = { id: 'u' + (i + 1), type: 'militia', owner: 'p1', x: cx, y: 2, moves: 1, fortified: false, veteran: false };
  }
  if (threatened) units.z9 = { id: 'z9', type: 'militia', owner: 'p2', x: 3, y: 2, moves: 1, fortified: false, veteran: false };
  return {
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    units, cities, cityOrder, wonders: {}, nextUnitId: 20, nextCityId: 9,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', government: 'monarchy', bulbs: 0, taxRate: 50, sciRate: 50, explored },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', government: 'monarchy', bulbs: 0, taxRate: 50, sciRate: 50, explored: new Array(W * H).fill(1) }
    },
    rngState: 1
  };
}

test('W2 opener: a 1-city sole guard SCOUTS when unthreatened (exception ON)', async () => {
  const ai = await load();
  const cmd = ai.pickCommand(openerState(1, false), 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'moveUnit', 'the opener departs to scout instead of garrisoning');
  assert.strictEqual(cmd.unitId, 'u1');
});

test('W2 opener: with the exception OFF the same sole guard GARRISONS (the guards>=2 floor)', async () => {
  const ai = await load();
  const off = withRules({ aiOpenerScoutException: false });
  const cmd = ai.pickCommand(openerState(1, false), 'p1', off, {});
  assert.strictEqual(cmd.type, 'fortify', 'no exception -> the sole guard holds the city');
  assert.strictEqual(cmd.unitId, 'u1');
});

test('W2 opener: a THREATENED 1-city opener still holds even with the exception ON', async () => {
  const ai = await load();
  const cmd = ai.pickCommand(openerState(1, true), 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'fortify', 'a visible threat keeps the sole guard home (need === 2)');
});

test('W2 opener: the exception is 1-city only — a 2-city sole guard GARRISONS (floor holds)', async () => {
  const ai = await load();
  const cmd = ai.pickCommand(openerState(2, false), 'p1', RULESET, {});
  assert.strictEqual(cmd.type, 'fortify', 'multi-city keeps the full guards>=2 floor');
});

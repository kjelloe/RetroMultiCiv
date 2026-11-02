// P3 (plan-version-1-patch.md): the retaliation-only AI nuke doctrine. The AI
// builds and fires a nuclear unit only at a met, at-war civ that has already
// detonated one (players[*].nukesUsed). Each case also runs through the Luau
// engine (luau/apollo-check.luau = runAiTurn + hash) when lune is installed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const RULESET = require('./ruleset.js');

const REPO = path.join(__dirname, '..');
const W = 30, H = 9;
const HAS_LUNE = spawnSync('lune', ['--version'], { encoding: 'utf8' }).status === 0;

function world() {
  const tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 300, year: 1980, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: W, height: H, wrapX: false, tiles },
    wonders: { 'manhattan-project': 'c2' },
    relations: { 'p1|p2': { state: 'war', met: true } },
    nextUnitId: 50, nextCityId: 10,
    cities: {
      c1: { id: 'c1', name: 'Home', owner: 'p1', x: 3, y: 4, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: { id: 'c2', name: 'Foe', owner: 'p2', x: 15, y: 4, pop: 10, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'c2'],
    units: {
      d1: { id: 'd1', type: 'mech-inf', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false },
      d2: { id: 'd2', type: 'mech-inf', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false },
      d3: { id: 'd3', type: 'mech-inf', owner: 'p1', x: 3, y: 4, moves: 0, fortified: true, veteran: false },
      e1: { id: 'e1', type: 'mech-inf', owner: 'p2', x: 15, y: 4, moves: 0, fortified: true, veteran: false }
    },
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 0, techs: ['rocketry'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50,
        explored: Array.from({ length: W * H }, () => 1) },
      p2: { id: 'p2', name: 'B', color: '#f00', human: true, alive: true, gold: 0, techs: ['rocketry'], researching: '', bulbs: 0, taxRate: 50, sciRate: 50, nukesUsed: 1 }
    },
    rngState: 1
  };
}

async function aiTurn(state) {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return ai.runAiTurn(createEngine(RULESET), JSON.parse(JSON.stringify(state)), 'p1', RULESET);
}

async function luauMatches(state, jsResult) {
  if (!HAS_LUNE) return;
  const { hashState } = await import('../shared/statehash.js');
  const h = '0x' + (hashState(jsResult) >>> 0).toString(16).padStart(8, '0');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-nuke-'));
  try {
    const p = path.join(dir, 'state.json');
    fs.writeFileSync(p, JSON.stringify(state));
    const res = spawnSync('lune', ['run', 'luau/apollo-check.luau', p], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    assert.ok(res.stdout.includes(`apollo: ${h}`), `luau runAiTurn must hash as ${h}:\n${res.stdout}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('P3: a civ at war with a nuclear aggressor builds a nuclear unit', async () => {
  const st = world();
  const r = await aiTurn(st);
  assert.deepStrictEqual(r.cities.c1.producing, { kind: 'unit', id: 'nuclear' });
  await luauMatches(st, r);
});

test('P3: no first strike — a rival that never used the bomb draws no nuclear build', async () => {
  const st = world();
  delete st.players.p2.nukesUsed;
  const r = await aiTurn(st);
  assert.notDeepStrictEqual(r.cities.c1.producing, { kind: 'unit', id: 'nuclear' });
});

test('P3: peace with the aggressor draws no nuclear build', async () => {
  const st = world();
  st.relations['p1|p2'] = { state: 'peace', met: true, treatyTurn: 290 };
  const r = await aiTurn(st);
  assert.notDeepStrictEqual(r.cities.c1.producing, { kind: 'unit', id: 'nuclear' });
});

test('P3: a based nuclear unit strikes the aggressor city in range', async () => {
  const st = world();
  st.units.n1 = { id: 'n1', type: 'nuclear', owner: 'p1', x: 3, y: 4, moves: 16, fortified: false, veteran: false };
  const r = await aiTurn(st);
  assert.strictEqual(r.units.n1, undefined, 'the missile is consumed');
  assert.strictEqual(r.units.e1, undefined, 'the defender is gone');
  assert.strictEqual(r.players.p1.nukesUsed, 1);
  assert.strictEqual(r.cities.c2.pop, 5);
  await luauMatches(st, r);
});

test('P3: a target beyond range, or too close to home, is held', async () => {
  const far = world();
  far.units.n1 = { id: 'n1', type: 'nuclear', owner: 'p1', x: 3, y: 4, moves: 16, fortified: false, veteran: false };
  far.cities.c2.x = 25; far.units.e1.x = 25;
  const r1 = await aiTurn(far);
  assert.ok(r1.units.n1 !== undefined && r1.units.n1.x === 3, 'out of range: the missile stays at base');
  const near = world();
  near.units.n1 = { id: 'n1', type: 'nuclear', owner: 'p1', x: 3, y: 4, moves: 16, fortified: false, veteran: false };
  near.cities.c2.x = 5; near.units.e1.x = 5;
  const r2 = await aiTurn(near);
  assert.ok(r2.units.n1 !== undefined && r2.units.n1.x === 3, 'fallout would reach home: held');
  await luauMatches(far, r1);
});

test('P3b: a city whose SDI shot one down ranks last; still struck when it is the only target', async () => {
  const st = world();
  st.units.n1 = { id: 'n1', type: 'nuclear', owner: 'p1', x: 3, y: 4, moves: 16, fortified: false, veteran: false };
  st.cities.c2.sdiRevealed = true; // the bigger city (pop 10) already intercepted one
  st.cities.c3 = { id: 'c3', name: 'Small', owner: 'p2', x: 12, y: 2, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } };
  st.cityOrder.push('c3');
  st.units.e2 = { id: 'e2', type: 'mech-inf', owner: 'p2', x: 12, y: 2, moves: 0, fortified: true, veteran: false };
  const r = await aiTurn(st);
  assert.strictEqual(r.units.e2, undefined, 'the unshielded city is struck');
  assert.ok(r.units.e1 !== undefined, 'the revealed-SDI city is spared');
  await luauMatches(st, r);
  const alone = world();
  alone.units.n1 = { id: 'n1', type: 'nuclear', owner: 'p1', x: 3, y: 4, moves: 16, fortified: false, veteran: false };
  alone.cities.c2.sdiRevealed = true;
  alone.cities.c2.buildings = ['sdi-defense'];
  const r2 = await aiTurn(alone);
  assert.strictEqual(r2.units.n1, undefined, 'no waiting: the only target is still struck (and here intercepted again)');
  await luauMatches(alone, r2);
});

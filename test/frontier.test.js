// W6 build-doctrine slice-4 (specs/build-doctrine-plan.md slice-4 seed; §3
// "city walls ONLY in frontline cities" + "defender coverage in core"):
//   PROACTIVE FRONTIER WALLS — a city near a KNOWN rival city (explored-map
//   read, inside cityRoles.frontierRadius) walls up BEFORE any enemy unit
//   shows, while a deep-interior city never does;
//   CORE DEFENDER FLOOR — garrisonAlways2 stances keep the 2-defender floor
//   only on the border (frontline/frontier); interior cities relax to 1,
//   freeing shields for the role lists. The floor formula must agree at ALL
//   THREE slice-1d sites (production want + unfortified stay-home + fortified
//   hold) or the garrison-roam bug returns.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return { ai, engine: createEngine(RULESET) };
}

// One own city (2 fortified guards, settlers parked at cap, doctrine done)
// plus a KNOWN rival city at `rivalX` — no rival units anywhere, so the old
// reactive canWall (threatened) can never fire. Wide map so distances rule.
function frontierState(rivalX, cityExtra, stance) {
  const width = 30, height = 9;
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  const p1 = {
    id: 'p1', name: 'A', color: '#00f', human: false, gold: 0,
    techs: ['pottery', 'ceremonial-burial', 'masonry', 'currency'],
    researching: 'writing', bulbs: 0, taxRate: 50, sciRate: 50,
    explored: new Array(width * height).fill(1)
  };
  if (stance !== undefined) p1.stance = stance;
  return {
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units: {
      g1: { id: 'g1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      g2: { id: 'g2', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      s1: { id: 's1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false },
      s2: { id: 's2', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: false }
    },
    cities: {
      c1: Object.assign({
        id: 'c1', name: 'Ours', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0,
        buildings: ['granary', 'temple'], producing: { kind: 'unit', id: 'militia' }
      }, cityExtra || {}),
      e9: { id: 'e9', name: 'Rival', owner: 'p2', x: rivalX, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    },
    cityOrder: ['c1', 'e9'], wonders: {}, nextUnitId: 50, nextCityId: 20,
    players: {
      p1,
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  };
}

test('slice-4: the frontier knob exists in rules.json', () => {
  const r = RULESET.rules.cityRoles;
  assert.ok(Number.isInteger(r.frontierRadius) && r.frontierRadius > RULESET.rules.threatRadius,
    'frontierRadius (proactive band) must exist and reach beyond the reactive threatRadius');
});

test('slice-4: a FRONTIER city (known rival city in the band, NO enemy units) walls up proactively', async () => {
  const { ai, engine } = await load();
  // rival at x=14 -> dist 10: beyond threatRadius 8 (canWall silent), inside frontierRadius
  const after = ai.runAiTurn(engine, frontierState(14), 'p1', RULESET);
  assert.deepStrictEqual(after.cities.c1.producing, { kind: 'building', id: 'city-walls' },
    'the wall goes up BEFORE the stack arrives (§3 frontier-exposed, proactive)');
});

test('slice-4: a deep-INTERIOR city never walls proactively', async () => {
  const { ai, engine } = await load();
  // rival at x=25 -> dist 21: outside the band; econ pick proceeds (marketplace, currency known)
  const after = ai.runAiTurn(engine, frontierState(25), 'p1', RULESET);
  assert.notStrictEqual(after.cities.c1.producing.id, 'city-walls',
    '§3: walls ONLY on the border — interior shields go to the role/econ lists');
});

test('slice-4: an already-walled frontier city falls through to econ (no wall loop)', async () => {
  const { ai, engine } = await load();
  const after = ai.runAiTurn(engine, frontierState(14, { buildings: ['granary', 'temple', 'city-walls'] }), 'p1', RULESET);
  assert.notStrictEqual(after.cities.c1.producing.id, 'city-walls', 'walls are once');
});

test('slice-4: CORE FLOOR — a garrisonAlways2 stance INTERIOR city keeps 1 defender and builds economy', async () => {
  const { ai, engine } = await load();
  // defensive stance, rival far (interior), only ONE guard: the old floor
  // (garrisonAlways2 -> want 2) would mint a second militia; the core floor
  // relaxes the interior to 1 -> the econ/role pick runs instead.
  const state = frontierState(25, {}, 'defensive');
  delete state.units.g2;
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c1.producing.kind, 'building',
    'interior + 1 guard satisfies the relaxed floor: shields flow to buildings (§3 core coverage)');
});

test('slice-4: CORE FLOOR — the same stance on the FRONTIER still wants its 2nd defender', async () => {
  const { ai, engine } = await load();
  const state = frontierState(14, {}, 'defensive');
  delete state.units.g2;
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c1.producing.kind, 'unit',
    'frontier keeps the full garrisonAlways2 floor — the relaxation is interior-only');
});

// FLOOR ALIGNMENT NOTE: the slice-1d rule (production want + unfortified
// stay-home + fortified hold must share ONE formula) is enforced
// STRUCTURALLY — all three sites call the same garrisonNeed helper; the
// reviewer's engine-diff verifies the three call sites. A unit-brain fixture
// can't isolate the hold (scout selection legitimately claims fortified
// spares first), so the formula itself is pinned by the two production
// fixtures above.

test('slice-4: a BALANCED interior city is unchanged by the core floor (regression guard)', async () => {
  const { ai, engine } = await load();
  // balanced never had the garrisonAlways2 floor: interior need was already
  // threatened?2:1 = 1 — the relaxation must not disturb it either way.
  const state = frontierState(25);
  delete state.units.g2;
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c1.producing.kind, 'building',
    'balanced interior with 1 guard builds economy before and after slice-4');
});

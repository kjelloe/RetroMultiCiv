// B22: the AI's entertainer fallback ESCALATES. The old code set the worker
// target to a fixed pop-1-specialists, so it could free only ONE entertainer
// and then stalled (target < current went false) — a city needing 2+ drowned
// in permanent disorder (the disorderTurns tail). Now it pulls one more worker
// into an entertainer each disorder turn (target = current - 1) until the mood
// clears, and the auto-revert still snaps a recovering city back (no flap).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  return { ai, engine: createEngine(RULESET) };
}

const cityMood = async (state) => {
  const happ = await import('../engine/happiness.js');
  return happ.cityMood(state, state.cities.c1, RULESET);
};

// a pop-8 despotism city, no temple / garrison / luxuries -> needs 2
// entertainers to leave disorder (workers 8 -> unhappy 4; one entertainer only
// gets unhappy to 2, still > happy 0).
function craft() {
  const tiles = [];
  for (let i = 0; i < 121; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 80, year: -1000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 11, height: 11, wrapX: false, tiles },
    units: {},
    cities: { c1: { id: 'c1', name: 'Big', owner: 'p1', x: 5, y: 5, pop: 8, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'temple' } } },
    cityOrder: ['c1'], wonders: {}, nextUnitId: 5, nextCityId: 5,
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, luxRate: 0 } },
    rngState: 1
  };
}

test('B22: a big unhappy city escalates entertainers until disorder clears', async () => {
  const { ai, engine } = await load();
  let st = craft();
  assert.strictEqual((await cityMood(st)).disorder, true, 'starts in disorder');
  // drive only the AI happiness step, turn by turn
  let steps = 0, cleared = false;
  for (let t = 0; t < 6; t++) {
    const cmd = ai.pickCommand(st, 'p1', RULESET, { research: true, rates: true, government: true, buy: true });
    if (!cmd || cmd.type !== 'setWorkers') break;
    st = engine.applyCommand(st, cmd).state;
    steps++;
    if (!(await cityMood(st)).disorder) { cleared = true; break; }
  }
  assert.ok(cleared, 'disorder cleared via escalation (the old one-entertainer cap never did)');
  const mood = await cityMood(st);
  assert.ok(mood.entertainers >= 2, `escalated past ONE entertainer (${mood.entertainers})`);
  assert.ok(steps <= 2, `cleared promptly (${steps} steps)`);
});

test('B22 revert: once calm enough, the city hands its tiles back to auto', async () => {
  const { ai, engine } = await load();
  // a smaller city (pop 5) with a temple already calm needs no entertainers;
  // if it carries a stale manual layout, the AI reverts it to auto.
  const st = craft();
  st.cities.c1.pop = 5;
  st.cities.c1.buildings = ['temple'];
  st.cities.c1.workers = [];
  const mood = await cityMood(st);
  if (!mood.disorder && mood.entertainers > 0) {
    const cmd = ai.pickCommand(st, 'p1', RULESET, { research: true, rates: true, government: true, buy: true });
    assert.ok(cmd && cmd.type === 'setWorkers' && cmd.auto === true, 'reverts a calm city to auto placement');
  }
});

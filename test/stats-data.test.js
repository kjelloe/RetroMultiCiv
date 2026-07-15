// A73-STATS: the sandbox-replay time-series collector (client/ui/stats-data.js).
// PURE — engine deps injected — so it runs headless over a synthetic recording.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function deps() {
  const eng = await import('../engine/index.js');
  const ai = await import('../engine/ai.js');
  const score = await import('../engine/score.js');
  const { collectStats } = await import('../client/ui/stats-data.js');
  const engine = eng.createEngine(RULESET);
  return { collectStats, engine, runAiTurn: ai.runAiTurn, deepClone: eng.deepClone, score: score.score, ruleset: RULESET };
}

// a recording = the initial state + a log; N 'round' entries replay N AI turns
function recording(engine, seed, civs, rounds) {
  const width = 40, height = 25;
  const players = [];
  const names = ['Romans', 'Greeks', 'Aztecs', 'Zulus'];
  for (let i = 0; i < civs; i++) players.push({ id: 'p' + (i + 1), civ: 'romans', name: names[i], color: '#d23b3b', human: false });
  const initialState = engine.createGame({ seed, options: { width, height, players } });
  const log = [];
  for (let i = 0; i < rounds; i++) log.push({ t: 'round' });
  return { initialState, log, finalHash: '' };
}

test('collectStats: one snapshot per round + the opening; arrays align', async () => {
  const d = await deps();
  const rec = recording(d.engine, 11, 3, 12);
  const out = d.collectStats(rec, d);
  assert.strictEqual(out.rounds.length, 13, '12 rounds + the opening snapshot');
  for (const pid of out.playerOrder) {
    const s = out.series[pid];
    assert.strictEqual(s.score.length, out.rounds.length, `${pid} score aligns with rounds`);
    assert.strictEqual(s.cities.length, out.rounds.length);
    assert.strictEqual(s.pop.length, out.rounds.length);
    assert.strictEqual(s.techs.length, out.rounds.length);
  }
});

test('collectStats: techs are monotonic non-decreasing; battles/wonders/ages are collections', async () => {
  const d = await deps();
  const rec = recording(d.engine, 4, 3, 40);
  const out = d.collectStats(rec, d);
  for (const pid of out.playerOrder) {
    const t = out.series[pid].techs;
    for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1], `${pid} techs never fall (${t[i - 1]}→${t[i]})`);
    assert.ok(out.battles[pid].won >= 0 && out.battles[pid].lost >= 0);
  }
  assert.ok(Array.isArray(out.wonders));
  assert.ok(Array.isArray(out.ages));
});

test('collectStats: a determinstic recording collects the same series twice', async () => {
  const d = await deps();
  const rec = recording(d.engine, 7, 4, 20);
  const a = d.collectStats(rec, d);
  const b = d.collectStats(rec, d);
  assert.deepStrictEqual(a.series, b.series, 'the sandbox replay is deterministic');
  assert.deepStrictEqual(a.rounds, b.rounds);
});

// endscreen-server-crash guard (#queue): a SERVER game hands the client a
// fog-filtered VIEW (engine/visibility.js) — a rival player object omits its
// `techs` field. The engine's scoreBreakdown reads player.techs.length, so
// scoring a rival off that view threw a TypeError and NO ending ever rendered
// in a server game. client/ui/score-view.js is the client-side guard; these
// pins assert it neutralises the fog shape without moving full-state scoring.
const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

// a filterView-shaped state for the VIEWER p1: p1 (self) keeps techs; the rival
// p2 has NO techs field (nor gold/researching) — exactly what visibility.js
// hands a client in a server game.
function fogView() {
  const tiles = [];
  for (let i = 0; i < 25; i++) tiles.push({ t: 'grassland' });
  return {
    version: 1, turn: 5, year: -3920, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 5, height: 5, wrapX: false, tiles },
    units: {}, gameOver: true, winner: 'p1',
    cities: {
      c1: { id: 'c1', name: 'A', owner: 'p1', x: 1, y: 1, pop: 4, buildings: [] },
      c2: { id: 'c2', name: 'B', owner: 'p2', x: 3, y: 3, pop: 3, buildings: [] }
    },
    cityOrder: ['c1', 'c2'], wonders: { pyramids: 'c1' }, nextUnitId: 9, nextCityId: 9,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: true, alive: true, techs: ['alphabet', 'pottery'] },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true } // fogged: no techs
    },
    rngState: 1
  };
}

test('techFogged: a rival without a techs field is fogged; the viewer is not', async () => {
  const { techFogged } = await import('../client/ui/score-view.js');
  const v = fogView();
  assert.strictEqual(techFogged(v.players.p1), false);
  assert.strictEqual(techFogged(v.players.p2), true);
  assert.strictEqual(techFogged(undefined), true); // defensive
});

test('techSafeState: fogged rivals gain an empty tech list; scoreBreakdown no longer throws', async () => {
  const { techSafeState } = await import('../client/ui/score-view.js');
  const { scoreBreakdown, score } = await import('../engine/score.js');
  const v = fogView();

  // BEFORE: scoring the fogged rival throws exactly as it did on the live box
  assert.throws(() => score(v, 'p2', RULESET), TypeError);

  const safe = techSafeState(v);
  assert.deepStrictEqual(safe.players.p2.techs, [], 'rival patched to an empty tech list');
  assert.strictEqual(safe.players.p1.techs, v.players.p1.techs, 'viewer techs untouched (same ref)');
  assert.strictEqual(v.players.p2.techs, undefined, 'the original view is not mutated');

  // the whole standings pass must not throw for ANY player now
  for (const pid of safe.playerOrder) {
    assert.doesNotThrow(() => scoreBreakdown(safe, pid, RULESET), `scoreBreakdown(${pid}) safe`);
  }
  const bd = scoreBreakdown(safe, 'p2', RULESET);
  assert.strictEqual(bd.techs, 0, 'fogged rival scores 0 techs (honest unknown, not a crash)');
  assert.ok(bd.population > 0, 'population still scores from visible cities');
});

test('techSafeState: a FULL state (no fog) is returned unchanged — same object', async () => {
  const { techSafeState } = await import('../client/ui/score-view.js');
  const v = fogView();
  v.players.p2.techs = ['alphabet']; // now every player has techs (a local game)
  const safe = techSafeState(v);
  assert.strictEqual(safe, v, 'no clone allocated when nothing is fogged');
});

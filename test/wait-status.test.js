// A26: the pure waiting-status tracker (client/ui/wait-status.js).
const test = require('node:test');
const assert = require('node:assert');
const mod = import('../client/ui/wait-status.js');
let createWaitTracker, formatWait, formatSlowNote;
test.before(async () => { ({ createWaitTracker, formatWait, formatSlowNote } = await mod); });

test('elapsed counts from the turn change and resets on the next', () => {
  const t = createWaitTracker();
  assert.deepStrictEqual(t.update('p2', 'p1', 1000, 30), { waitingFor: 'p2', elapsedSec: 0, note: false });
  assert.strictEqual(t.update('p2', 'p1', 13000, 30).elapsedSec, 12);
  // turn moves to p3: clock restarts
  assert.strictEqual(t.update('p3', 'p1', 20000, 30).elapsedSec, 0);
  assert.strictEqual(t.update('p3', 'p1', 25000, 30).elapsedSec, 5);
});

test('own turn shows nothing', () => {
  const t = createWaitTracker();
  assert.deepStrictEqual(t.update('p1', 'p1', 1000, 30), { waitingFor: null, elapsedSec: 0, note: false });
});

test('the slow-poke note fires once per player-turn at the threshold', () => {
  const t = createWaitTracker();
  t.update('p2', 'p1', 0, 30);
  assert.strictEqual(t.update('p2', 'p1', 29000, 30).note, false, 'under threshold');
  assert.strictEqual(t.update('p2', 'p1', 31000, 30).note, true, 'crossing fires');
  assert.strictEqual(t.update('p2', 'p1', 45000, 30).note, false, 'once only');
  t.update('p1', 'p1', 50000, 30); // hand back
  t.update('p2', 'p1', 60000, 30); // p2 again: a NEW wait
  assert.strictEqual(t.update('p2', 'p1', 95000, 30).note, true, 're-arms per turn');
});

test('threshold 0 disables the note; live threshold changes apply', () => {
  const t = createWaitTracker();
  t.update('p2', 'p1', 0, 0);
  assert.strictEqual(t.update('p2', 'p1', 999000, 0).note, false, 'disabled');
  assert.strictEqual(t.update('p2', 'p1', 1000000, 10).note, true, 'enabling mid-wait works');
});

test('formatting', () => {
  assert.strictEqual(formatWait('Ada', 12), '⏳ Ada is moving · 12s');
  assert.strictEqual(formatSlowNote('Player 2', 47), '⏱ Waited 47s for Player 2');
});

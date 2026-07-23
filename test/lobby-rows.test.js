// late-join §2: describeGameRow renders a listed game row from the server's
// contract fields (state/turn/era/joinable), additive over the old `status`.
// Pure — the row text/action logic is unit-tested here without a live server or
// a DOM (lobby.js's module eval only touches location/localStorage, polyfilled).
const test = require('node:test');
const assert = require('node:assert');

async function load() {
  global.location = global.location || { search: '' };
  global.localStorage = global.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  return import('../client/ui/lobby.js');
}

test('open lobby row: seats/size/age + a join action', async () => {
  const { describeGameRow } = await load();
  const d = describeGameRow({ hostName: 'Ada', state: 'open', openSeats: 2, totalSeats: 4, size: 'medium', age: 'ancient' });
  assert.strictEqual(d.action, 'join');
  assert.match(d.text, /Ada's game · 2\/4 seats open · medium · ancient/);
});

test('running + joinable → takeover, "in progress · turn N · <Era>"', async () => {
  const { describeGameRow } = await load();
  const d = describeGameRow({ hostName: 'Bo', state: 'running', turn: 87, era: 'industrial', joinable: true });
  assert.strictEqual(d.action, 'takeover');
  assert.match(d.text, /Bo's game · in progress · turn 87 · Industrial/);
});

test('running but NOT joinable → spectate', async () => {
  const { describeGameRow } = await load();
  const d = describeGameRow({ hostName: 'Bo', state: 'running', turn: 87, era: 'ancient', joinable: false });
  assert.strictEqual(d.action, 'spectate');
});

test('paused + joinable → takeover, "paused · turn N"', async () => {
  const { describeGameRow } = await load();
  const d = describeGameRow({ hostName: 'Cy', state: 'paused', turn: 40, joinable: true });
  assert.strictEqual(d.action, 'takeover');
  assert.match(d.text, /Cy's game · paused · turn 40/);
});

test('fallback: a pre-late-join server (no state) maps status→open/running', async () => {
  const { describeGameRow } = await load();
  assert.strictEqual(describeGameRow({ hostName: 'X', status: 'lobby', openSeats: 1, totalSeats: 2, size: 'small', age: 'ancient' }).action, 'join');
  const running = describeGameRow({ hostName: 'X', status: 'started' });
  assert.strictEqual(running.action, 'spectate'); // no joinable field → spectate, not takeover
  assert.match(running.text, /in progress/);
});

// Server VIEW-CONTRACT (architect coverage pass): the fog filter as it rides the
// WIRE. filterView is engine-covered (visibility.js/naval.test.js), but the
// SERVER view push is where client code keeps tripping — the endscreen crash
// (reading a rival's private fields that aren't there) and sub stealth. Two
// contracts over a real ws join: (a) a seat's view OMITS rival techs/gold/
// researching; (b) a rival submarine is HIDDEN unless a viewer sea/air unit is
// adjacent. server-events.test.js is the crafted-save + fog template.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RULESET = require('./ruleset.js');

function connect(port) {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [], waiters = [];
  ws.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(msg));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(msg); else inbox.push(msg);
  });
  function expect(match, label) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), 30000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ send: m => ws.send(JSON.stringify(m)), expect, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

function player(id, name, extra) {
  return Object.assign({ id, name, color: '#3b7dd8', human: true, gold: 0, techs: [], researching: '',
    bulbs: 0, taxRate: 50, sciRate: 50, explored: [1, 1, 1, 1] }, extra || {});
}
function saveOf(state) {
  return { format: 'retromulticiv-server-save', version: 1, gameId: 'gview',
    savedAt: '2026-07-14T00:00:00.000Z', rulesOverrides: {}, seats: {},
    state, diag: { format: 'retromulticiv-diagnostics', version: 1, log: [], initialState: state } };
}
function baseState(tiles, units, players) {
  return { version: 1, turn: 3, year: -3960, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 4, height: 1, wrapX: false, tiles }, units, cities: {}, cityOrder: [], wonders: {},
    nextUnitId: 9, nextCityId: 1, players, rngState: 987654321 };
}
const militia = (id, owner, x) => ({ id, type: 'militia', owner, x, y: 0, moves: 1, fortified: false, veteran: false });

// join as Ada (p1) against a crafted save; return the joined view push
async function joinView(save) {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gview-'));
  const saveFile = path.join(dir, 'gview.json');
  fs.writeFileSync(saveFile, JSON.stringify(save));
  const s = await startServer({ ruleset: RULESET, game: saveFile, autosave: false });
  const c = await connect(s.port);
  c.send({ t: 'join', name: 'Ada' });
  const joined = await c.expect(m => m.t === 'joined', 'Ada joined');
  return { view: joined.view, playerId: joined.playerId, cleanup: async () => { c.close(); await s.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

test('view contract (a): a seat\'s view OMITS a rival\'s techs/gold/researching', async () => {
  const grass = [{ t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' }, { t: 'grassland' }];
  const state = baseState(grass,
    { u1: militia('u1', 'p1', 0), u2: militia('u2', 'p2', 1) },
    { p1: player('p1', 'Ada'), p2: player('p2', 'Bo', { gold: 99, techs: ['pottery'], researching: 'writing' }) });
  const { view, playerId, cleanup } = await joinView(saveOf(state));
  try {
    assert.strictEqual(playerId, 'p1');
    assert.ok(view.players.p2, 'the rival still appears (name/color) — only PRIVATE fields are stripped');
    assert.strictEqual(view.players.p2.techs, undefined, 'rival techs must not cross the wire (endscreen-crash class)');
    assert.strictEqual(view.players.p2.gold, undefined, 'rival gold hidden');
    assert.strictEqual(view.players.p2.researching, undefined, 'rival researching hidden');
    // the OWNER's own private fields DO travel (the client needs them)
    assert.ok(Array.isArray(view.players.p1.techs) && typeof view.players.p1.gold === 'number',
      'the viewer\'s own techs/gold are present');
  } finally { await cleanup(); }
});

test('view contract (b): a rival SUBMARINE is hidden with no adjacent spotter', async () => {
  const sea = [{ t: 'grassland' }, { t: 'ocean' }, { t: 'ocean' }, { t: 'ocean' }];
  const state = baseState(sea,
    { u1: militia('u1', 'p1', 0), // land unit at (0,0) gives VISION of (1,0), but never spots a sub
      u2: { id: 'u2', type: 'submarine', owner: 'p2', x: 1, y: 0, moves: 3, fortified: false, veteran: false } },
    { p1: player('p1', 'Ada'), p2: player('p2', 'Bo') });
  const { view, cleanup } = await joinView(saveOf(state));
  try {
    assert.strictEqual(view.map.tiles[1].visible, true, 'the sub\'s tile IS visible — so stealth, not fog, hides it');
    assert.strictEqual(view.units.u2, undefined, 'the rival submarine is hidden over the wire');
  } finally { await cleanup(); }
});

test('view contract (b): the same submarine is REVEALED with a viewer ship adjacent', async () => {
  const sea = [{ t: 'grassland' }, { t: 'ocean' }, { t: 'ocean' }, { t: 'ocean' }];
  const state = baseState(sea,
    { u1: militia('u1', 'p1', 0),
      u2: { id: 'u2', type: 'submarine', owner: 'p2', x: 1, y: 0, moves: 3, fortified: false, veteran: false },
      u3: { id: 'u3', type: 'trireme', owner: 'p1', x: 2, y: 0, moves: 3, fortified: false, veteran: false } }, // sea unit adjacent to the sub
    { p1: player('p1', 'Ada'), p2: player('p2', 'Bo') });
  const { view, cleanup } = await joinView(saveOf(state));
  try {
    assert.ok(view.units.u2, 'a viewer ship adjacent to the sub reveals it over the wire');
    assert.strictEqual(view.units.u2.type, 'submarine');
  } finally { await cleanup(); }
});

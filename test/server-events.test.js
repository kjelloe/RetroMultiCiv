// B5 integration: per-seat fog-filtered round events ride the view push.
// Three humans on a 10x1 strip — p2 attacks p1's adjacent militia; p1 (a
// named party, in sight) must receive the combat event on ITS view push,
// while p3 (across the map, fog) must not. This was the user's turn-41
// report: AI/rival combat never reached the other humans' turn logs,
// because events only travelled inside the actor's own `applied` ack.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const RULESET = require('./ruleset.js');

function connect(port) {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(msg));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  function expect(match, label) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const seen = inbox.map(m => m.t).join(', ');
        reject(new Error(`timeout: ${label} — unmatched inbox: [${seen}]`));
      }, 30000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ send: m => ws.send(JSON.stringify(m)), expect, inbox, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

// A hand-built server save: deterministic adjacency instead of hoping a
// seeded AI picks a fight. p1@(0,0) and p2@(1,0) adjacent; p3@(9,0) far.
// Everyone has explored the strip — only the VISIBLE mask separates them.
function craftedSave() {
  const tiles = [];
  for (let i = 0; i < 10; i++) tiles.push({ t: 'grassland' });
  const explored = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const player = (id, name) => ({
    id, name, color: '#3b7dd8', human: true, gold: 0, techs: [], researching: '',
    bulbs: 0, taxRate: 50, sciRate: 50, explored: explored.slice()
  });
  const state = {
    version: 1, turn: 3, year: -3960,
    activePlayer: 'p2', // the attacker is at turn
    playerOrder: ['p1', 'p2', 'p3'],
    map: { width: 10, height: 1, wrapX: false, tiles },
    units: {
      u1: { id: 'u1', type: 'militia', owner: 'p1', x: 0, y: 0, moves: 1, fortified: false, veteran: false },
      u2: { id: 'u2', type: 'militia', owner: 'p2', x: 1, y: 0, moves: 1, fortified: false, veteran: false },
      u3: { id: 'u3', type: 'militia', owner: 'p3', x: 9, y: 0, moves: 1, fortified: false, veteran: false }
    },
    cities: {}, cityOrder: [], wonders: {},
    nextUnitId: 4, nextCityId: 1,
    players: { p1: player('p1', 'Ada'), p2: player('p2', 'Bo'), p3: player('p3', 'Cleo') },
    rngState: 987654321
  };
  return {
    format: 'retromulticiv-server-save', version: 1, gameId: 'gevents',
    savedAt: '2026-07-14T00:00:00.000Z', rulesOverrides: {}, seats: {},
    state, diag: { format: 'retromulticiv-diagnostics', version: 1, log: [], initialState: state }
  };
}

test('server events: rival combat reaches the victim\'s view push, fogged seats hear nothing', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-events-'));
  const saveFile = path.join(dir, 'gevents.json');
  fs.writeFileSync(saveFile, JSON.stringify(craftedSave()));
  const s = await startServer({ ruleset: RULESET, game: saveFile, autosave: false });
  const clients = [];
  try {
    // join order = seat order: Ada->p1 (victim), Bo->p2 (attacker), Cleo->p3 (fogged)
    const seats = {};
    for (const name of ['Ada', 'Bo', 'Cleo']) {
      const c = await connect(s.port);
      clients.push(c);
      c.send({ t: 'join', name });
      seats[name] = await c.expect(m => m.t === 'joined', `${name} joined`);
    }
    assert.strictEqual(seats.Ada.playerId, 'p1');
    assert.strictEqual(seats.Bo.playerId, 'p2');
    assert.strictEqual(seats.Cleo.playerId, 'p3');

    // Bo attacks Ada's militia (move W into a hostile tile = attack)
    clients[1].send({ t: 'cmd', token: seats.Bo.token, commandId: 1, cmd: { type: 'moveUnit', unitId: 'u2', dir: 'W' } });
    const applied = await clients[1].expect(m => m.t === 'applied' && m.commandId === 1, 'attack applied');
    const combat = (applied.events || []).find(e => e.type === 'combatResolved');
    assert.ok(combat, 'the attacker\'s ack carries the combat (own action passes the filter unchanged)');

    // THE B5 regression: the victim's view push carries the combat event
    const adaView = await clients[0].expect(m => m.t === 'view' && Array.isArray(m.events), 'Ada view+events');
    const adaCombat = adaView.events.find(e => e.type === 'combatResolved');
    assert.ok(adaCombat, `Ada (named party, in sight) must hear the combat — got [${adaView.events.map(e => e.type)}]`);
    assert.strictEqual(adaCombat.defenderOwner, 'p1');

    // and the fogged seat does not — same push, empty for Cleo
    const cleoView = await clients[2].expect(m => m.t === 'view' && Array.isArray(m.events), 'Cleo view+events');
    assert.strictEqual(cleoView.events.find(e => e.type === 'combatResolved'), undefined,
      `Cleo (across the map) must NOT hear the fogged combat — got [${cleoView.events.map(e => e.type)}]`);
  } finally {
    for (const c of clients) c.close();
    await s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

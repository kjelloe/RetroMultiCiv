// The user's pre-LAN gate: FOUR real ws clients on localhost, end to end —
// host creates, three join by code (one picks a seat), all four play a full
// round in seat order, everyone's views and codes stay consistent. If this
// passes, a multi-machine session is a networking exercise, not a software
// risk.
const test = require('node:test');
const assert = require('node:assert');
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
      const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), 8000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ send: m => ws.send(JSON.stringify(m)), expect, inbox, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

test('LAN dress rehearsal: 4 clients — create, join by code, full round, consistent world', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, autosave: false, host: '127.0.0.1' });
  const clients = [];
  try {
    // host creates a 4-human game
    const host = await connect(s.port);
    clients.push(host);
    host.send({ t: 'create', name: 'Kjell', options: { civs: 4, humans: 4, size: 'xsmall', seed: 777 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    const joinCode = created.joinCode;
    assert.match(joinCode, /^[0-9A-HJKMNP-TV-Z]{5}$/, 'a shoutable 5-char code');

    // three friends join by CODE; Ada PICKS p3 first, so the join-order
    // fill must route AROUND the reservation (Bo -> p2, Cleo -> p4)
    const names = [['Ada', 'p3'], ['Bo', undefined], ['Cleo', undefined]];
    const joined = [];
    for (const [name, seat] of names) {
      const c = await connect(s.port);
      clients.push(c);
      c.send({ t: 'join', joinCode, name, seat });
      joined.push(await c.expect(m => m.t === 'joinedLobby' || m.t === 'joined', `${name} in lobby`));
    }
    assert.strictEqual(joined[0].seat, 'p3', 'Ada picked p3 and got it');

    // start: every client receives its own {joined} with its own seat+token
    host.send({ t: 'start', joinCode });
    const seats = {};
    for (let i = 0; i < 4; i++) {
      const j = await clients[i].expect(m => m.t === 'joined', `client ${i} game-joined`);
      seats[i] = j;
      assert.ok(j.token, 'every player holds a token');
      assert.match(j.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}$/, 'game code delivered to all');
    }
    assert.strictEqual(seats[1].playerId, 'p3', 'the chart put Ada on her picked p3');
    assert.strictEqual(seats[2].playerId, 'p2', 'Bo filled AROUND the reservation');
    assert.strictEqual(seats[3].playerId, 'p4', 'Cleo took the last seat');
    const ids = Object.values(seats).map(j => j.playerId).sort();
    assert.deepStrictEqual(ids, ['p1', 'p2', 'p3', 'p4'], 'four distinct seats');
    const names4 = Object.values(seats[0].view.players).map(p => p.name).sort();
    for (const n of ['Kjell', 'Ada', 'Bo', 'Cleo']) {
      assert.ok(names4.includes(n), `${n} is a named player in the world`);
    }

    // one full round IN SEAT ORDER (clients joined out of order on purpose:
    // host=p1, Ada=p3, Bo=p2, Cleo=p4 — playerOrder governs, not join order)
    const bySeat = {};
    for (let i = 0; i < 4; i++) bySeat[seats[i].playerId] = { client: clients[i], joined: seats[i] };
    const order = seats[0].view.playerOrder;
    assert.deepStrictEqual(order, ['p1', 'p2', 'p3', 'p4']);
    for (let k = 0; k < 4; k++) {
      const seatId = order[k];
      const { client, joined: j } = bySeat[seatId];
      client.send({ t: 'endTurn', token: j.token, commandId: 100 + k });
      await client.expect(m => m.t === 'applied' && m.commandId === 100 + k, `${seatId} endTurn`);
    }
    // after the wrap every client must observe turn 2, and codes must agree
    const codes = [];
    for (let i = 0; i < 4; i++) {
      const turnMsg = await clients[i].expect(m => m.t === 'turn' && m.turn === 2, `client ${i} sees turn 2`);
      assert.strictEqual(turnMsg.activePlayerId, 'p1');
      const codeMsg = await clients[i].expect(m => m.t === 'code' && m.turn === 2, `client ${i} code at turn 2`);
      codes.push(codeMsg.code);
    }
    assert.strictEqual(new Set(codes).size, 1, 'all four clients hold the SAME game code');

    // fog stays personal: p1's view must not carry p2's internals
    const v = await (async () => {
      clients[0].send({ t: 'cmd', token: seats[0].token, commandId: 200, cmd: { type: 'wait', unitId: 'nope' } });
      await clients[0].expect(m => m.t === 'rejected' && m.commandId === 200, 'probe rejected');
      return seats[0].view;
    })();
    assert.strictEqual(v.players.p2.gold, undefined, 'rival internals hidden per seat');
  } finally {
    for (const c of clients) c.close();
    await s.close();
  }
});

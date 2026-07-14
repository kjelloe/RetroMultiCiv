// Phase-3 slice 2 integration (docs/06-phase3-server.md §7): a real ws
// client against a real server — join, play, per-seat view pushes, then the
// roadmap acceptance: kill the server, boot a second one from the autosave,
// reconnect with the old token, and keep playing the same game.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RULESET = require('./ruleset.js');

// minimal promise wrapper around the ws client for turn-based request/reply
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
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 5000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({
      send: msg => ws.send(JSON.stringify(msg)),
      expect,
      inbox,
      close: () => ws.close()
    }));
    ws.on('error', reject);
  });
}

test('server: join, play over the socket, restart from autosave, reconnect', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-server-'));
  const saveFile = path.join(dir, 'game.json');
  const opts = { ruleset: RULESET, seed: 424242, civs: 2, humans: 1, size: 'xsmall', saveFile, gameId: 'itest' };

  const s1 = await startServer(opts);
  let client = await connect(s1.port);
  try {
    // join
    client.send({ t: 'join', name: 'Kjell' });
    const joined = await client.expect(m => m.t === 'joined', 'joined');
    assert.strictEqual(joined.playerId, 'p1');
    assert.strictEqual(joined.view.you, 'p1');
    assert.strictEqual(joined.view.rngState, undefined, 'no rngState over the wire');
    assert.match(joined.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}$/, 'joined carries the game code');
    assert.strictEqual(joined.gameId, 'itest', 'joined carries the real gameId, not the client default');
    const token = joined.token;

    // a forged command is rejected and echoes its commandId
    client.send({ t: 'cmd', token: 'forged', commandId: 1, cmd: { type: 'wait' } });
    const rej = await client.expect(m => m.t === 'rejected' && m.commandId === 1, 'rejected');
    assert.strictEqual(rej.code, 'badToken');

    // found a city, get applied + a fresh view push
    const settlers = Object.values(joined.view.units).find(u => u.owner === 'p1' && u.type === 'settlers');
    client.send({ t: 'cmd', token, commandId: 2, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Sockettown' } });
    const applied = await client.expect(m => m.t === 'applied' && m.commandId === 2, 'applied');
    assert.ok(applied.events.some(e => e.type === 'cityFounded'));
    const view1 = await client.expect(m => m.t === 'view', 'view push');
    assert.ok(Object.values(view1.view.cities).some(c => c.name === 'Sockettown'));
    // docs/07: every command broadcasts the new authoritative code
    const codeMsg = await client.expect(m => m.t === 'code', 'code broadcast');
    assert.match(codeMsg.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}$/);
    assert.notStrictEqual(codeMsg.code, joined.code, 'founding a city moves the code');

    // end the turn: server drives the AI and hands the turn back
    client.send({ t: 'endTurn', token, commandId: 3 });
    await client.expect(m => m.t === 'applied' && m.commandId === 3, 'endTurn applied');
    const turnMsg = await client.expect(m => m.t === 'turn' && m.turn === 2, 'turn broadcast');
    assert.strictEqual(turnMsg.activePlayerId, 'p1');

    // RESTART: kill server 1, boot server 2 from the autosave
    client.close();
    await s1.close();
    assert.ok(fs.existsSync(saveFile), 'autosave written');
    const saved = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
    assert.match(saved.code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}$/, 'the save envelope carries the code');
    const s2 = await startServer({ ruleset: RULESET, game: saveFile });
    try {
      client = await connect(s2.port);
      client.send({ t: 'join', name: 'Kjell', token }); // reclaim the seat
      const rejoined = await client.expect(m => m.t === 'joined', 'rejoined');
      assert.strictEqual(rejoined.playerId, 'p1');
      assert.strictEqual(rejoined.gameId, 'itest', 'the resumed non-default gameId reaches the client (the 404 fix)');
      assert.strictEqual(rejoined.view.turn, 2, 'the game resumed where it stopped');
      assert.ok(Object.values(rejoined.view.cities).some(c => c.name === 'Sockettown'));
      assert.strictEqual(rejoined.code, saved.code, 'the resumed game reports the saved code');

      // and it still plays
      client.send({ t: 'endTurn', token, commandId: 4 });
      await client.expect(m => m.t === 'applied' && m.commandId === 4, 'plays on after restart');
      await client.expect(m => m.t === 'turn' && m.turn === 3, 'turn 3');
      client.close();
    } finally {
      await s2.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('A46 seat codes: reclaim while disconnected, live seat protected, brute force limited, never broadcast', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 31, civs: 2, humans: 2, size: 'xsmall', autosave: false });
  try {
    const kjell = await connect(s.port);
    kjell.send({ t: 'join', name: 'Kjell' });
    const kj = await kjell.expect(m => m.t === 'joined', 'kjell joined');
    assert.match(kj.seatCode, /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
      'the joined reply hands the OWNER a docs/07-alphabet seat code');
    const ada = await connect(s.port);
    ada.send({ t: 'join', name: 'Ada' });
    const aj = await ada.expect(m => m.t === 'joined', 'ada joined');
    assert.notStrictEqual(aj.seatCode, kj.seatCode, 'codes are per-seat');
    // absence discipline: the view carries no seat codes (they are envelope
    // data, not state)
    assert.ok(!JSON.stringify(kj.view).includes(kj.seatCode), 'code never rides the view');

    // a LIVE seat rejects code reclaim — recovery, never displacement
    const thief = await connect(s.port);
    thief.send({ t: 'join', name: 'Thief', seatCode: aj.seatCode });
    assert.strictEqual((await thief.expect(m => m.t === 'rejected', 'live')).code, 'seatOccupied');

    // wrong code → badSeatCode; an immediate retry → tooFast (1/sec/conn)
    await new Promise(r => setTimeout(r, 1100));
    thief.send({ t: 'join', name: 'Thief', seatCode: 'AAAA-AAAA' });
    assert.strictEqual((await thief.expect(m => m.t === 'rejected', 'wrong')).code, 'badSeatCode');
    thief.send({ t: 'join', name: 'Thief', seatCode: 'BBBB-BBBB' });
    assert.strictEqual((await thief.expect(m => m.t === 'rejected', 'rate')).code, 'tooFast');

    // the real flow: Kjell's device dies; a NEW device reclaims by code —
    // same seat, ROTATED token (the old device's copy is dead with the move)
    kjell.close();
    await new Promise(r => setTimeout(r, 150)); // let the server see the close
    const laptop = await connect(s.port);
    laptop.send({ t: 'join', name: 'Kjell', seatCode: kj.seatCode });
    const re = await laptop.expect(m => m.t === 'joined', 'reclaimed');
    assert.strictEqual(re.playerId, kj.playerId, 'the code lands on ITS seat');
    assert.notStrictEqual(re.token, kj.token, 'the token rotated');
    assert.strictEqual(re.seatCode, kj.seatCode, 'the code itself is stable');
    ada.close(); thief.close(); laptop.close();
  } finally {
    await s.close();
  }
});

test('server: static hosting serves the client files', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false });
  try {
    const html = await fetch(`http://127.0.0.1:${s.port}/client/`).then(r => r.text());
    assert.match(html, /RetroMultiCiv/);
    const rules = await fetch(`http://127.0.0.1:${s.port}/data/rules.json`).then(r => r.json());
    assert.strictEqual(rules.minCityDistance, 3);
    const forbidden = await fetch(`http://127.0.0.1:${s.port}/../etc/passwd`);
    assert.notStrictEqual(forbidden.status, 200, 'no path traversal');
    // A22: friendly entry points redirect to /client/ keeping the query
    const root = await fetch(`http://127.0.0.1:${s.port}/`, { redirect: 'manual' });
    assert.strictEqual(root.status, 302);
    assert.strictEqual(root.headers.get('location'), '/client/');
    const noSlash = await fetch(`http://127.0.0.1:${s.port}/client?server=1&game=g7`, { redirect: 'manual' });
    assert.strictEqual(noSlash.status, 302);
    assert.strictEqual(noSlash.headers.get('location'), '/client/?server=1&game=g7', 'query string preserved');
  } finally {
    await s.close();
  }
});

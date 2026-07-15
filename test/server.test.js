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

test('A40 regency: a regent seat plays unattended, its commands log, replay is hash-exact', async () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { startServer } = await import('../server/index.js');
  const { replayDiagnostics } = require('../tools/replay.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a40-'));
  const saveFile = path.join(dir, 'regent.json');
  // 1 human, 1 AI, xsmall — the human hands its seat to the AI and the
  // SERVER must carry the game forward turn after turn with nobody attending
  const s = await startServer({ ruleset: RULESET, seed: 88, civs: 2, humans: 1, size: 'xsmall', saveFile, gameId: 'a40' });
  try {
    const kjell = await connect(s.port);
    kjell.send({ t: 'join', name: 'Kjell' });
    const kj = await kjell.expect(m => m.t === 'joined', 'joined');
    assert.strictEqual(kj.view.activePlayer, 'p1', 'it is the human seat turn');
    const turn0 = kj.view.turn;

    // hand p1 to the AI: the server starts driving and the turn advances
    // WITHOUT the human ending it — presence tags the seat auto
    kjell.send({ t: 'regent', stance: 'balanced' });
    const pres = await kjell.expect(m => m.t === 'presence' && m.regents && m.regents.p1, 'regent presence');
    assert.ok(pres.regents.p1, 'the seat reads as on regency');
    // the game moves forward on its own (several unattended turns)
    let latest = kj.view;
    for (let i = 0; i < 3; i++) {
      const t = await kjell.expect(m => m.t === 'view' && m.view.turn > latest.turn, `unattended turn ${i}`);
      latest = t.view;
    }
    assert.ok(latest.turn >= turn0 + 3, 'the regent advanced the game unattended');

    // take control back mid-game — the drive stops cleanly
    kjell.send({ t: 'regent', stance: null });
    await kjell.expect(m => m.t === 'presence' && (!m.regents || !m.regents.p1), 'control returned');

    // the autosave's diagnostics must replay hash-exact: the regent's own
    // commands are cmd entries (re-applied), AI chains are round entries
    await new Promise(r => setTimeout(r, 200));
    assert.ok(fs.existsSync(saveFile), 'the game autosaved');
    const saved = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
    assert.ok(saved.diag.log.some(e => e.t === 'cmd' && e.cmd.playerId === 'p1'),
      'the regent seat commands landed in the diag as cmd entries');
    const report = await replayDiagnostics(saved.diag, RULESET);
    assert.deepStrictEqual(report.problems, [], 'the regent game replayed hash-exact');
    kjell.close();
  } finally {
    await s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('A52 seat-code acceptance: fog-shaped reclaim, spectator gets nothing, single control path, resume paths', async () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { startServer } = await import('../server/index.js');
  const { createGame } = await import('../server/game.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a52-'));
  const saveFile = path.join(dir, 'sc.json');
  const s = await startServer({ ruleset: RULESET, seed: 51, civs: 2, humans: 1, size: 'medium', saveFile, gameId: 'a52', spectators: true });
  try {
    const kjell = await connect(s.port);
    kjell.send({ t: 'join', name: 'Kjell' });
    const kj = await kjell.expect(m => m.t === 'joined', 'joined');
    const seatCode = kj.seatCode;

    // (b) a code reclaim after disconnect delivers the FOG-FILTERED view for
    // that seat — not the omniscient spectator view, not stale
    assert.ok(kj.view.map.tiles.some(t => t.t === 'unknown'), 'the seat view is fog-filtered (has unknown tiles)');
    kjell.close();
    await new Promise(r => setTimeout(r, 150));
    const laptop = await connect(s.port);
    laptop.send({ t: 'join', name: 'Kjell', seatCode });
    const re = await laptop.expect(m => m.t === 'joined', 'reclaimed');
    assert.strictEqual(re.playerId, kj.playerId, 'reclaimed its own seat');
    assert.ok(re.view.map.tiles.some(t => t.t === 'unknown'),
      'the reclaim view is fog-filtered for the seat, not omniscient');
    assert.ok(re.view.rngState === undefined, 'and never leaks rngState');

    // (c) a SPECTATOR holding the seat code gets only the spectator view —
    // the code buys nothing extra while spectating (spectate path ignores it)
    const watcher = await connect(s.port);
    watcher.send({ t: 'join', name: 'Watcher', spectator: true, seatCode });
    const sj = await watcher.expect(m => m.t === 'joined', 'spectator joined');
    assert.strictEqual(sj.playerId, 'spectator', 'a spectator with a code still only spectates');
    assert.strictEqual(sj.token, undefined, 'no seat token for the spectator');
    assert.ok(!sj.view.map.tiles.some(t => t.t === 'unknown'), 'spectator view stays omniscient');

    // (d) after the reclaim rotated the token, the OLD token is dead — a
    // connection presenting it is refused, so one seat = one control path
    const stale = await connect(s.port);
    const settlers = Object.values(re.view.units).find(u => u.owner === re.playerId && u.type === 'settlers');
    stale.send({ t: 'cmd', token: kj.token, commandId: 1, cmd: { type: 'fortify', unitId: settlers ? settlers.id : 'u1' } });
    assert.strictEqual((await stale.expect(m => m.t === 'rejected', 'stale token')).code, 'badToken',
      'the pre-rotation token no longer controls the seat');
    watcher.close(); stale.close();

    // (e) resume paths — the metadata nuance documented in docs/08 §4:
    // --game CLI resume KEEPS seats+codes (envelope); lobby resume (A34)
    // resetSeats so codes die (machines change, joiners re-pick by name).
    // Play one accepted command from the reclaimed seat so the autosave writes.
    laptop.send({ t: 'cmd', token: re.token, commandId: 2, cmd: { type: 'fortify', unitId: settlers.id } });
    await laptop.expect(m => m.t === 'applied' && m.commandId === 2, 'reclaimed seat plays');
    laptop.close();
    await new Promise(r => setTimeout(r, 200));
    const saved = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
    assert.ok(saved.seatCodes && Object.keys(saved.seatCodes).length > 0, 'codes ride the save envelope');
    const cliResumed = createGame({ ruleset: RULESET, save: saved });
    assert.strictEqual(cliResumed.seatOfCode(seatCode), kj.playerId, '--game resume keeps the seat code');
    const lobbyResumed = createGame({ ruleset: RULESET, save: saved });
    lobbyResumed.resetSeats(); // the A34 lobby-resume flow
    assert.strictEqual(lobbyResumed.seatOfCode(seatCode), null, 'lobby resume resets seats — codes die by design');
  } finally {
    await s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('A47 fullLog: rejected before game end (no fog leak), served after', async () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { startServer } = await import('../server/index.js');
  const { createGame } = await import('../server/game.js');

  // PRE-gameOver: a live game refuses the full recording
  const live = await startServer({ ruleset: RULESET, seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false });
  try {
    const c = await connect(live.port);
    c.send({ t: 'join', name: 'Kjell' });
    await c.expect(m => m.t === 'joined', 'joined');
    c.send({ t: 'fullLog' });
    assert.strictEqual((await c.expect(m => m.t === 'rejected', 'pre')).code, 'notOver',
      'before game end fullLog is refused — it would leak fog');
    c.close();
  } finally { await live.close(); }

  // POST-gameOver: craft a finished server save and serve its recording
  const g0 = createGame({ ruleset: RULESET, gameId: 'over',
    setup: { seed: 9, options: { width: 20, height: 15, players: [
      { id: 'p1', name: 'Kjell', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ] } } });
  const envelope = g0.toSave();
  const over = JSON.parse(JSON.stringify(g0.state));
  over.gameOver = true; over.winner = 'p1';
  envelope.state = over; // a genuine initial world, hand-marked finished
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a47-'));
  const file = path.join(dir, 'over.json');
  fs.writeFileSync(file, JSON.stringify(envelope));
  const done = await startServer({ ruleset: RULESET, game: file, autosave: false });
  try {
    const c = await connect(done.port);
    c.send({ t: 'join', name: 'Kjell' });
    await c.expect(m => m.t === 'joined', 'joined the finished game');
    c.send({ t: 'fullLog' });
    const rec = await c.expect(m => m.t === 'fullLog', 'served');
    assert.ok(rec.initialState && Array.isArray(rec.log), 'the recording carries initialState + log');
    assert.match(rec.finalHash, /^0x[0-9a-f]+$/, 'and the final hash for verification');
    c.close();
  } finally {
    await done.close();
    fs.rmSync(dir, { recursive: true, force: true });
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

test('A61 hardened-by-default: saves + debugging are OFF the wire; --debug restores them', async () => {
  const fs = require('fs');
  const path = require('path');
  const { startServer } = await import('../server/index.js');
  // a REAL save with a seat token on disk — it must be unreachable over HTTP
  const savePath = path.join(__dirname, '..', 'saves', 'a61hard.json');
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, JSON.stringify({
    format: 'retromulticiv-server-save', gameId: 'a61hard',
    seats: { p1: 'SECRET-TOKEN-abc123' }, seatCodes: { p1: 'AAAA-BBBB' },
    state: { turn: 1 }, diag: { initialState: {}, log: [] }
  }));
  const s = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false });
  try {
    // the four whitelisted roots serve
    for (const p of ['/client/', '/data/rules.json', '/engine/ai.js', '/shared/statehash.js']) {
      assert.strictEqual((await fetch(`http://127.0.0.1:${s.port}${p}`)).status, 200, `${p} serves`);
    }
    // the save is 404 — and its token/code NEVER travel
    const saveRes = await fetch(`http://127.0.0.1:${s.port}/saves/a61hard.json`);
    assert.strictEqual(saveRes.status, 404, 'saves/ is off the wire by default');
    const saveBody = await saveRes.text();
    assert.ok(!saveBody.includes('SECRET-TOKEN'), 'the seat token never travels');
    assert.ok(!saveBody.includes('AAAA-BBBB'), 'the seat code never travels');
    // debugging + gitignored-on-disk roots are 404 too
    for (const p of ['/debugging/gallery.html', '/debugging/logs/x.json', '/ops/hosting-recipe.md', '/package.json']) {
      assert.strictEqual((await fetch(`http://127.0.0.1:${s.port}${p}`)).status, 404, `${p} is blocked by default`);
    }
  } finally { await s.close(); }

  // --debug restores whole-repo serving (the gallery needs it)
  const dbg = await startServer({ ruleset: RULESET, seed: 7, size: 'xsmall', autosave: false, debug: true });
  try {
    assert.strictEqual((await fetch(`http://127.0.0.1:${dbg.port}/debugging/gallery.html`)).status, 200,
      '--debug serves the gallery');
    assert.strictEqual((await fetch(`http://127.0.0.1:${dbg.port}/client/`)).status, 200, '--debug still serves the client');
  } finally {
    await dbg.close();
    fs.rmSync(savePath, { force: true });
  }
});

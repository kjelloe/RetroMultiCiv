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
  const s = await startServer({ ruleset: RULESET, seed: 88, civs: 2, humans: 1, size: 'xsmall', saveFile, gameId: 'a40', regencyMinTurnMs: 0 });
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
    // B11b: each unattended turn must narrate itself — the server pushes the
    // synthetic regentTurn summary to the regent's OWN seat so the LAN client
    // shows the 🤖 turn-log line (same as local play)
    let latest = kj.view;
    let sawRegentSummary = false;
    for (let i = 0; i < 3; i++) {
      const t = await kjell.expect(m => m.t === 'view' && m.view.turn > latest.turn, `unattended turn ${i}`);
      if (Array.isArray(t.events) && t.events.some(e => e.type === 'regentTurn' && e.playerId === 'p1')) {
        sawRegentSummary = true;
      }
      latest = t.view;
    }
    assert.ok(latest.turn >= turn0 + 3, 'the regent advanced the game unattended');
    assert.ok(sawRegentSummary,
      'the regent seat received a regentTurn summary event (the 🤖 turn-log line)');

    // take control back mid-game — the drive stops cleanly
    kjell.send({ t: 'regent', stance: null });
    await kjell.expect(m => m.t === 'presence' && (!m.regents || !m.regents.p1), 'control returned');

    // #1870 slice 1: the per-command autosave no longer embeds the full log
    // (write-amplification kill) — the FILE carries round-hash entries only
    // (logTruncated), while the LIVE recording lives in RAM (fullLog) for the
    // end-of-game report + the fullLog send. Both are asserted.
    await new Promise(r => setTimeout(r, 200));
    assert.ok(fs.existsSync(saveFile), 'the game autosaved');
    const saved = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
    assert.strictEqual(saved.diag.logTruncated, true, 'the autosave file is round-hash-only (write-amp killed)');
    assert.ok(saved.diag.log.every(e => e.t === 'round'),
      'no per-command entries re-serialized into the per-command autosave');
    // the in-RAM full recording still carries the regent commands AND replays
    // hash-exact (the report/fullLog source is intact)
    const full = s.game.fullLog();
    assert.ok(full.log.some(e => e.t === 'cmd' && e.cmd.playerId === 'p1'),
      'the regent seat commands are in the in-RAM full recording as cmd entries');
    const report = await replayDiagnostics(
      { initialState: full.initialState, log: full.log, finalHash: full.finalHash }, RULESET);
    assert.deepStrictEqual(report.problems, [], 'the full in-RAM recording replayed hash-exact');
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
    // §16ext REVERSED (user ruling 2026-07-22): a bare root lands on the LOCAL
    // setup screen — server play is an explicit ?server=1 choice
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

test('A98 resume-by-code: the docs/07 game code resumes the saved game; wrong/empty code rejects', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-a98-'));

  // server 1: found a city so it autosaves into `dir`; capture the broadcast code
  const s1 = await startServer({ ruleset: RULESET, seed: 909, civs: 2, humans: 1, size: 'xsmall', savesDir: dir, gameId: 'a98game' });
  let savedCode;
  const c1 = await connect(s1.port);
  try {
    c1.send({ t: 'join', name: 'Kjell' });
    const joined = await c1.expect(m => m.t === 'joined', 'joined');
    const settlers = Object.values(joined.view.units).find(u => u.owner === 'p1' && u.type === 'settlers');
    c1.send({ t: 'cmd', token: joined.token, commandId: 1, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Codeville' } });
    await c1.expect(m => m.t === 'applied' && m.commandId === 1, 'applied');
    savedCode = (await c1.expect(m => m.t === 'code', 'code broadcast')).code;
  } finally { c1.close(); await s1.close(); }
  assert.match(savedCode, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}$/, 'captured a real game code');
  assert.ok(fs.readdirSync(dir).some(f => f.endsWith('.json')), 'a server save landed in the savesDir');

  // server 2: FRESH game, same savesDir — resume the first game purely by its code
  const s2 = await startServer({ ruleset: RULESET, seed: 1, civs: 2, humans: 1, size: 'xsmall', savesDir: dir, gameId: 'a98other' });
  const c2 = await connect(s2.port);
  try {
    // wrong code → friendly reject, nothing resumed
    c2.send({ t: 'resumeByCode', code: 'ZZZZ-ZZZZ-ZZZZZ' });
    assert.strictEqual((await c2.expect(m => m.t === 'rejected', 'wrong-code reject')).code, 'noSuchCode');
    // empty code → its own reason
    c2.send({ t: 'resumeByCode', code: '   ' });
    assert.strictEqual((await c2.expect(m => m.t === 'rejected', 'empty-code reject')).code, 'noCode');
    // right code, entered lower-case and hyphen-free → normalization still matches
    c2.send({ t: 'resumeByCode', code: savedCode.replace(/-/g, '').toLowerCase() });
    const resumed = await c2.expect(m => m.t === 'resumed', 'resumed');
    assert.strictEqual(resumed.code, savedCode, 'the resumed game reports the saved code');
    assert.ok(resumed.turn >= 1, 'resumed at the saved turn');
    // the resumed game is now joinable and carries the founded city
    c2.send({ t: 'join', joinCode: resumed.gameId, name: 'Kjell' });
    const joined2 = await c2.expect(m => m.t === 'joined', 'joined the resumed game');
    assert.ok(Object.values(joined2.view.cities).some(city => city.name === 'Codeville'),
      'the resumed game still has the city founded before the save');
  } finally { c2.close(); await s2.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('A50 item 1: a private lobby is joinable only by its code, never by gameId', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false });
  const host = await connect(s.port);
  const sneak = await connect(s.port);
  const ada = await connect(s.port);
  try {
    // Host creates a PRIVATE lobby (public omitted → private-by-default).
    host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 2, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created', 'created');
    const gameId = created.gameId, code = created.joinCode;
    assert.ok(gameId && code, 'created carries gameId + joinCode');

    // RED: enumerating the raw gameId cannot reserve a seat…
    sneak.send({ t: 'join', gameId, name: 'Sneak' });
    assert.strictEqual((await sneak.expect(m => m.t === 'rejected', 'id-join reject')).code, 'codeRequired');
    // …nor by smuggling the gameId into the joinCode field (resolveId dual-lookup).
    sneak.send({ t: 'join', joinCode: gameId, name: 'Sneak' });
    assert.strictEqual((await sneak.expect(m => m.t === 'rejected', 'id-as-code reject')).code, 'codeRequired');
    // A wrong code resolves to nothing at all.
    sneak.send({ t: 'join', joinCode: 'ZZZZZ', name: 'Sneak' });
    assert.strictEqual((await sneak.expect(m => m.t === 'rejected', 'wrong-code reject')).code, 'noSuchGame');

    // GREEN: the correct code is the authorization.
    ada.send({ t: 'join', joinCode: code, name: 'Ada' });
    const joined = await ada.expect(m => m.t === 'joinedLobby', 'joinedLobby');
    assert.strictEqual(joined.gameId, gameId);
    assert.ok(joined.seat, 'Ada got a seat by knowing the code');

    // CONTROL: a PUBLIC lobby stays id-joinable (find-a-game capability).
    host.send({ t: 'create', name: 'Host2', options: { civs: 2, humans: 2, size: 'xsmall', public: true } });
    const pub = await host.expect(m => m.t === 'created' && m.gameId !== gameId, 'public created');
    const pubJoiner = await connect(s.port);
    try {
      pubJoiner.send({ t: 'join', gameId: pub.gameId, name: 'Walkup' });
      assert.strictEqual((await pubJoiner.expect(m => m.t === 'joinedLobby', 'public id-join')).gameId, pub.gameId);
    } finally { pubJoiner.close(); }
  } finally { host.close(); sneak.close(); ada.close(); await s.close(); }
});

test('A50 item 2: per-IP rate limits + global caps reject over the socket', async () => {
  const { startServer } = await import('../server/index.js');
  // Tiny caps so the red cases trip immediately (all test conns share 127.0.0.1).
  const s = await startServer({
    ruleset: RULESET, seed: 6, civs: 2, humans: 1, size: 'xsmall', autosave: false,
    limits: { maxConnsPerIp: 2, maxConns: 50, createsPerHour: 1, maxGames: 1, joinsPerMin: 2 }
  });
  try {
    // Global game cap = 1: the default game already exists, so the first create
    // trips the cap. late-join §6: at the cap with no PAUSED game to evict, the
    // reason is now serverFull (the client contract) — the default game is active.
    const c1 = await connect(s.port);
    c1.send({ t: 'create', name: 'A', options: { civs: 2, humans: 2, size: 'xsmall' } });
    assert.strictEqual((await c1.expect(m => m.t === 'rejected', 'game cap')).code, 'serverFull');

    // Per-IP CONNECTION cap = 2: c1 is one; open a second, the third is refused.
    const c2 = await connect(s.port);
    const c3 = await connect(s.port);
    assert.strictEqual((await c3.expect(m => m.t === 'rejected', 'conn cap')).code, 'tooManyConns');

    // Per-IP JOIN rate = 2/min: two attempts pass the limiter (reach the game
    // logic), the third is rateLimited by the limiter itself.
    c2.send({ t: 'join', name: 'J1' });
    await c2.expect(m => m.t === 'joined' || m.t === 'joinedLobby' || m.t === 'rejected', 'join1');
    c2.send({ t: 'join', name: 'J2' });
    await c2.expect(m => m.t === 'joined' || m.t === 'joinedLobby' || m.t === 'rejected', 'join2');
    c2.send({ t: 'join', name: 'J3' });
    assert.strictEqual((await c2.expect(m => m.t === 'rejected', 'join rate')).code, 'rateLimited');

    c1.close(); c2.close(); c3.close();
  } finally { await s.close(); }
});

test('A50 item 3: saves/ rotation retires oldest completed first, never the active game', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-rot-'));
  const env = (gameId, savedAt, over) => JSON.stringify({
    format: 'retromulticiv-server-save', gameId, code: 'AAAA-AAAA-AAAAA', savedAt,
    state: over ? { turn: 200, gameOver: true } : { turn: 1 }
  });
  // 'live' is the server's default (registered → ACTIVE) and the OLDEST on disk;
  // n1..n3 are unrelated RESUMABLE games (newer); done1 is a COMPLETED game and
  // the NEWEST of all — the tier policy must retire it BEFORE the older resumables.
  fs.writeFileSync(path.join(dir, 'live.json'), env('live', '2026-07-10T00:00:00.000Z'));
  fs.writeFileSync(path.join(dir, 'n1.json'), env('n1', '2026-07-11T00:00:00.000Z'));
  fs.writeFileSync(path.join(dir, 'n2.json'), env('n2', '2026-07-12T00:00:00.000Z'));
  fs.writeFileSync(path.join(dir, 'n3.json'), env('n3', '2026-07-13T00:00:00.000Z'));
  fs.writeFileSync(path.join(dir, 'done1.json'), env('done1', '2026-07-14T00:00:00.000Z', true));
  // Also drop a foreign file — rotation must leave it alone.
  fs.writeFileSync(path.join(dir, 'notours.json'), JSON.stringify({ format: 'something-else' }));

  const s = await startServer({
    ruleset: RULESET, seed: 9, civs: 2, humans: 1, size: 'xsmall',
    savesDir: dir, gameId: 'live', rotation: { maxSaves: 2, maxSavesMb: 9999 }
  });
  try {
    s.rotateSaves(); // idempotent with the startup pass; deterministic
    // budget 2 over 5 saves: evict done1 (completed, tier 1) FIRST despite being
    // the newest, then the two oldest resumables (n1, n2). Survivors: the ACTIVE
    // live game (never evicted, though oldest) + the newest resumable n3.
    assert.ok(fs.existsSync(path.join(dir, 'live.json')), 'the active game is never evicted');
    assert.ok(!fs.existsSync(path.join(dir, 'done1.json')), 'the completed game retires first (tier 1), newest though it is');
    assert.ok(!fs.existsSync(path.join(dir, 'n1.json')), 'oldest resumable retired (tier 2)');
    assert.ok(!fs.existsSync(path.join(dir, 'n2.json')), 'next-oldest resumable retired');
    assert.ok(fs.existsSync(path.join(dir, 'n3.json')), 'the newest resumable survives');
    assert.ok(fs.existsSync(path.join(dir, 'notours.json')), 'foreign files untouched');
  } finally { await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('A50 item 3b: an unstarted lobby expires on the sweep; the default game is exempt', async () => {
  const { startServer } = await import('../server/index.js');
  let t = 1000;
  const s = await startServer({
    ruleset: RULESET, seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false,
    gameId: 'lan-default', now: () => t, lifecycle: { lobbyTtlMs: 1000, abandonedMs: 9e9 }
  });
  const host = await connect(s.port);
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 2, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created', 'created');

    // Not yet past the TTL → the sweep leaves it.
    t += 500; s.maintenanceSweep();
    // Past the TTL → the lobby is retired and its occupant is told.
    t += 1000; s.maintenanceSweep();
    assert.strictEqual((await host.expect(m => m.t === 'gameClosed', 'closed')).reason, 'lobbyExpired');

    // The lobby is gone: joining by its code now finds nothing.
    const late = await connect(s.port);
    try {
      late.send({ t: 'join', joinCode: created.joinCode, name: 'Late' });
      assert.strictEqual((await late.expect(m => m.t === 'rejected', 'gone')).code, 'noSuchGame');
    } finally { late.close(); }

    // The LAN default game is never swept even long past any TTL.
    t += 9e9; s.maintenanceSweep(); s.maintenanceSweep();
    const dj = await connect(s.port);
    try {
      dj.send({ t: 'join', name: 'D' }); // no target → default game
      await dj.expect(m => m.t === 'joined', 'default still joinable');
    } finally { dj.close(); }
  } finally { host.close(); await s.close(); }
});

test('A50 item 3b: an abandoned started game is retired, its save survives (resumable)', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-aband-'));
  let t = 1000;
  const s = await startServer({
    ruleset: RULESET, seed: 8, civs: 2, humans: 1, size: 'xsmall',
    gameId: 'lan-default', savesDir: dir, now: () => t, lifecycle: { lobbyTtlMs: 9e9, abandonedMs: 5000 }
  });
  const host = await connect(s.port);
  let lobbyCode, gameCode;
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created', 'created');
    lobbyCode = created.joinCode;
    host.send({ t: 'start' });
    const joined = await host.expect(m => m.t === 'joined', 'started+seated'); // host bound to its seat
    gameCode = joined.code; // the docs/07 game code — the resume gamecode (A98)
    await host.expect(m => m.t === 'started', 'started ack');

    // Still connected → a sweep must NOT retire it, however much time passes.
    t += 1e6; s.maintenanceSweep();
  } finally { host.close(); }

  // Poll until the sweep retires the game (house ~30s budget) — under
  // parallel-suite load the disconnect lands well after any fixed grace, so
  // a one-shot sweep pair races it (got 'gameFull' where 'noSuchGame' was
  // expected). Each pass: sweep (records emptySince once the socket is gone),
  // advance past abandonedMs, sweep (retires), probe by lobby code.
  const retireDeadline = Date.now() + 30000;
  for (;;) {
    s.maintenanceSweep();
    t += 6000; // past abandonedMs
    s.maintenanceSweep();
    const probe = await connect(s.port);
    let code;
    try {
      probe.send({ t: 'join', joinCode: lobbyCode, name: 'X' });
      code = (await probe.expect(m => m.t === 'rejected', 'probe rejected')).code;
    } finally { probe.close(); }
    if (code === 'noSuchGame') break; // the live entry is gone
    assert.strictEqual(code, 'gameFull', 'only the not-yet-retired shape may repeat');
    assert.ok(Date.now() < retireDeadline, 'game never retired within the budget');
    await new Promise(r => setTimeout(r, 150));
  }

  const c = await connect(s.port);
  try {
    // The SAVE survived the retire, so resume-by-(game)code brings it back.
    c.send({ t: 'resumeByCode', code: gameCode });
    assert.strictEqual((await c.expect(m => m.t === 'resumed', 'resumable')).code, gameCode);
  } finally { c.close(); await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('resume collision: join-by-id after resumeByCode lands on the SAVED world, not the fresh default', async () => {
  // The A49-ext resume spec surfaced this: a fresh server's default game
  // auto-numbered to g<seed> — the same id namespace the lobby counter mints
  // (g1, g2 …) — so joining the resumed game by its id could resolve to the
  // brand-new default world instead. The default id is namespaced now.
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-collide-'));

  // server A (seed 21 → default id g21): the first lobby-created game mints
  // g1 from the counter and autosaves as g1.json
  let s = await startServer({ ruleset: RULESET, seed: 21, civs: 2, humans: 1, size: 'xsmall', savesDir: dir,
    lobbyGameIdFn: (n => () => 'g' + (++n))(0) }); // L3b: pin the g1 collision geometry
  let host = await connect(s.port);
  let gameCode, savedTurn;
  try {
    host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created', 'created');
    assert.strictEqual(created.gameId, 'g1', 'the first lobby game takes g1 (the collision precondition)');
    host.send({ t: 'start' });
    const joined = await host.expect(m => m.t === 'joined', 'started+seated');
    gameCode = joined.code;
    savedTurn = joined.view.turn;
    await host.expect(m => m.t === 'started', 'started ack');
  } finally { host.close(); await s.close(); }
  assert.ok(fs.existsSync(path.join(dir, 'g1.json')), 'the lobby game autosaved as g1.json');

  // server B (seed 1): pre-fix its default game claimed 'g1' ('g' + seed) —
  // EXACTLY the resumed save's id — so the join-by-id below resolved to the
  // fresh default world; the namespaced default id removes the collision
  s = await startServer({ ruleset: RULESET, seed: 1, civs: 2, humans: 1, size: 'xsmall', savesDir: dir });
  const c = await connect(s.port);
  try {
    c.send({ t: 'resumeByCode', code: gameCode });
    assert.strictEqual((await c.expect(m => m.t === 'resumed', 'resumed')).gameId, 'g1');
    // the follow-up join BY ID — the resume UI's exact move (lobby.js sends
    // joinCode: msg.gameId) — must reach the RESUMED game
    c.send({ t: 'join', joinCode: 'g1', name: 'Back' });
    const rejoined = await c.expect(m => m.t === 'joined', 'rejoined');
    assert.strictEqual(rejoined.gameId, 'g1', 'joined the resumed game, not the default');
    assert.strictEqual(rejoined.code, gameCode, 'the resumed game reports the SAVED code');
    assert.strictEqual(rejoined.view.turn, savedTurn, 'the saved turn, not a fresh world');
  } finally { c.close(); await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('A54: an off-turn whitelisted command applies over the socket while a rival holds the turn', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 77, civs: 2, humans: 2, size: 'xsmall', autosave: false });
  const p1 = await connect(s.port);
  const p2 = await connect(s.port);
  try {
    p1.send({ t: 'join', name: 'Active' });
    const j1 = await p1.expect(m => m.t === 'joined', 'p1 joined');
    assert.strictEqual(j1.playerId, 'p1');
    p2.send({ t: 'join', name: 'Waiting' });
    const j2 = await p2.expect(m => m.t === 'joined', 'p2 joined');
    assert.strictEqual(j2.playerId, 'p2');
    assert.strictEqual(j2.view.turn, 1);
    assert.strictEqual(j1.view.you, 'p1');

    // it is p1's turn; the WAITING seat adjusts its own rates — accepted
    p2.send({ t: 'cmd', token: j2.token, commandId: 10, cmd: { type: 'setRates', tax: 40, sci: 60 } });
    const applied = await p2.expect(m => m.t === 'applied' && m.commandId === 10, 'off-turn setRates applied');
    assert.ok(applied.events.some(e => e.type === 'ratesSet' && e.playerId === 'p2'));
    const view2 = await p2.expect(m => m.t === 'view', 'p2 view push');
    assert.strictEqual(view2.view.players.p2.taxRate, 40, 'the pre-work stuck on the waiting seat');
    // rival internals are fog-hidden in p2's view (by design) — the active
    // seat's untouchedness is asserted from ITS OWN pushed view
    const view1 = await p1.expect(m => m.t === 'view', 'p1 view push');
    assert.strictEqual(view1.view.players.p1.taxRate, 50, 'the active seat is untouched');

    // …but a NON-whitelisted command from the waiting seat still bounces
    const settlers = Object.values(j2.view.units).find(u => u.owner === 'p2' && u.type === 'settlers');
    p2.send({ t: 'cmd', token: j2.token, commandId: 11, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Sneaky' } });
    const rej = await p2.expect(m => m.t === 'rejected' && m.commandId === 11, 'off-turn foundCity rejected');
    assert.strictEqual(rej.code, 'notYourTurn');
  } finally { p1.close(); p2.close(); await s.close(); }
});

test('L3b: two server boots mint DIFFERENT first-game join codes (boot entropy)', async () => {
  // pre-fix, the lobby counter reset every boot: first game = g1 always, so
  // joinCode('g1') repeated the SAME code across restarts (user-observed)
  const { startServer } = await import('../server/index.js');
  const codes = [];
  for (let boot = 0; boot < 2; boot++) {
    const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false });
    const host = await connect(s.port);
    try {
      host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 1, size: 'xsmall' } });
      const created = await host.expect(m => m.t === 'created', 'created');
      codes.push(created.joinCode);
      await new Promise(r => setTimeout(r, 2)); // a fresh now() tick for the next boot's suffix
    } finally { host.close(); await s.close(); }
  }
  assert.notStrictEqual(codes[0], codes[1], 'restarting the server must mint a fresh code');
});

test('A50 item 0: a per-connection command flood is cheap-rejected (rateLimited), the game path spared', async () => {
  // docs/17 lane, folded into the game stream. A tiny bucket (burst 1, no refill)
  // makes the throttle deterministic: the first cmd applies, the next is over
  // budget and comes back rejected/rateLimited WITHOUT reaching the game. The
  // full starvation A/B (co-player ack time under load) is the sim-runner's load
  // harness; this proves the wiring + the reject shape.
  const { startServer } = await import('../server/index.js');
  const s = await startServer({
    ruleset: RULESET, seed: 424242, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, gameId: 'flood', limits: { cmdBurst: 1, cmdRefillPerSec: 0 }
  });
  try {
    const client = await connect(s.port);
    client.send({ t: 'join', name: 'Kjell' });
    const joined = await client.expect(m => m.t === 'joined', 'joined');
    const token = joined.token;
    const settlers = Object.values(joined.view.units).find(u => u.owner === 'p1' && u.type === 'settlers');
    // the ONE budgeted command applies normally
    client.send({ t: 'cmd', token, commandId: 1, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Bucketville' } });
    await client.expect(m => m.t === 'applied' && m.commandId === 1, 'first command applied');
    // the next command is over budget → cheap reject, never routed to the game
    client.send({ t: 'endTurn', token, commandId: 2 });
    const rej = await client.expect(m => m.t === 'rejected' && m.commandId === 2, 'over-budget reject');
    assert.strictEqual(rej.code, 'rateLimited', 'the flood is throttled with the rateLimited code');
    client.close();
  } finally {
    await s.close();
  }
});

test('#1875 operator caps clamp the host default game (civs/size/turns)', async () => {
  const { startServer } = await import('../server/index.js');
  // request 12 civs on a huge marathon; the host caps everything down
  const s = await startServer({
    ruleset: RULESET, seed: 9, civs: 12, humans: 1, size: 'huge',
    rulesOverrides: { endYear: 9999 }, // simulate a marathon-preset boot
    maxCivs: 4, maxSize: 'small', maxTurns: 100, autosave: false
  });
  try {
    const g = s.game;
    assert.strictEqual(g.state.playerOrder.length, 4, '--max-civs clamps the boot civ count');
    assert.strictEqual(g.state.map.width, 60, '--max-size clamps huge → small (60 wide)');
    assert.strictEqual(g.toSave().rulesOverrides.endYear, -2020, '--max-turns clamps the boot endYear (turn-100 year, Calendar-545)');
  } finally {
    await s.close();
  }
});

// D3 (#2591/#2592): a client joining a FINISHED ?server=1 game must receive
// gameOver + winner in its view (world-public at gameOver) so the endscreen
// triggers + names the winner on rejoin/resume — the fog-filtered view used to
// omit both, so a joining client saw neither. Deterministic ws-level guard for the
// filterView change (the browser DOM verdict-class assertion rides test-ui/flow-4).
test('server: a client joining a finished game receives gameOver + winner in its view', async () => {
  const { startServer } = await import('../server/index.js');
  const { createGame } = await import('../server/game.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-over-'));
  const file = path.join(dir, 'over.json');
  const players = [
    { id: 'p1', name: 'Kjell', color: '#3b7dd8', human: true },
    { id: 'p2', name: 'AI', color: '#d84a3b', human: false }
  ];
  // build a real server save, then mark it finished (winner p1) — the loader
  // validates format/version/rulesetHash, not the code, so a patched state loads.
  const g = createGame({ ruleset: RULESET, setup: { seed: 7, options: { width: 20, height: 15, players } }, gameId: 'overtest' });
  g.saveTo(file);
  const env = JSON.parse(fs.readFileSync(file, 'utf8'));
  env.state.gameOver = true;
  env.state.winner = 'p1';
  fs.writeFileSync(file, JSON.stringify(env));

  const s = await startServer({ ruleset: RULESET, game: file, autosave: false });
  const client = await connect(s.port);
  try {
    client.send({ t: 'join', name: 'Kjell' });
    const joined = await client.expect(m => m.t === 'joined', 'joined');
    assert.strictEqual(joined.view.gameOver, true, 'the joined view of a finished game reports gameOver');
    assert.strictEqual(joined.view.winner, 'p1', 'the winner is world-public in the joined view');
  } finally {
    client.close();
    await s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

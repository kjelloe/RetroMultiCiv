// specs/late-join-pause.md §3: a NEW joiner to a running public+lateJoining game
// takes over an eligible AI civ (claimSeat engine command flips human=true,
// recorded+replayed) and the join answer names the assigned civ.
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');

const RULESET = require('./ruleset.js');

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [], waiters = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(m));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  });
  function expect(match, ms) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), ms || 3000);
      waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ ws, send: m => ws.send(JSON.stringify(m)), expect, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

test('§3 late-join: a new joiner takes over an AI civ on a running public+lateJoining game', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    // host creates a PUBLIC game (lateJoining defaults ON) and starts it
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    host.send({ t: 'start' });
    await host.expect(m => m.t === 'joined');

    // a NEW client late-joins by the game's code (tokenless) -> takeover
    const late = await client(s.port);
    late.send({ t: 'join', name: 'Latecomer', joinCode: created.joinCode });
    const j = await late.expect(m => m.t === 'joined' || m.t === 'rejected');
    assert.strictEqual(j.t, 'joined', 'the late joiner took over an AI civ');
    assert.ok(j.playerId && j.playerId !== 'p1', 'assigned an AI seat (not the host seat)');
    assert.ok(typeof j.token === 'string' && j.token.length > 0, 'issued a fresh seat token');
    assert.ok('assignedCiv' in j, 'the answer names the assigned civ (client reveal)');
    assert.ok(j.view && j.view.turn >= 1, 'served the taken-over civ view');
    host.close(); late.close();
  } finally { await s.close(); }
});

test('§2 listGames: a running public+lateJoining game lists with state/turn/era/joinable', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    host.send({ t: 'start' });
    await host.expect(m => m.t === 'joined');

    const browser = await client(s.port);
    browser.send({ t: 'listGames' });
    const list = await browser.expect(m => m.t === 'openGames');
    const row = list.games.find(r => r.gameId === created.gameId);
    assert.ok(row, 'the running game is listed for late-join');
    assert.strictEqual(row.state, 'running');
    assert.strictEqual(row.joinable, true, 'a takeover seat is available');
    assert.strictEqual(typeof row.turn, 'number');
    assert.ok(['ancient', 'classicalMedieval', 'industrial', 'modernSpace'].includes(row.era), 'a valid era band');
    host.close(); browser.close();
  } finally { await s.close(); }
});

test('§5 pause-on-empty: a public+lateJoining game pauses when its last human leaves', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    host.send({ t: 'start' });
    await host.expect(m => m.t === 'joined');

    // the only human leaves -> the game must PAUSE (no AI/regency advance)
    host.close();
    await new Promise(r => setTimeout(r, 150)); // let the close handler run

    const browser = await client(s.port);
    browser.send({ t: 'listGames' });
    const list = await browser.expect(m => m.t === 'openGames');
    const row = list.games.find(r => r.gameId === created.gameId);
    assert.ok(row, 'the emptied game is still listed');
    assert.strictEqual(row.state, 'paused', 'it paused when the last human left');
    assert.strictEqual(row.joinable, true, 'a late-joiner can revive it');
    browser.close();
  } finally { await s.close(); }
});

test('§6-7 eviction: Create at the cap evicts a PAUSED game to make room', async () => {
  const { startServer } = await import('../server/index.js');
  // maxGames 2: the boot game (1) + one created game = the cap.
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', limits: { maxGames: 2 } });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const a = await host.expect(m => m.t === 'created');
    host.send({ t: 'start' });
    await host.expect(m => m.t === 'joined');
    host.close(); // game A empties -> pauses
    await new Promise(r => setTimeout(r, 150));

    // now at the cap (boot + paused A); a new Create must EVICT the paused game
    const host2 = await client(s.port);
    host2.send({ t: 'create', name: 'Host2', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const j = await host2.expect(m => m.t === 'created' || m.t === 'rejected');
    assert.strictEqual(j.t, 'created', 'the paused game was evicted to make room');
    // A is gone from the live listing
    const browser = await client(s.port);
    browser.send({ t: 'listGames' });
    const list = await browser.expect(m => m.t === 'openGames');
    assert.ok(!list.games.find(r => r.gameId === a.gameId), 'the evicted game is unlisted');
    host2.close(); browser.close();
  } finally { await s.close(); }
});

test('§6-7 eviction: Create at the cap with only ACTIVE games -> serverFull (never evict active)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', limits: { maxGames: 2 } });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    await host.expect(m => m.t === 'created');
    host.send({ t: 'start' });
    await host.expect(m => m.t === 'joined'); // A stays ACTIVE (host connected)

    const host2 = await client(s.port);
    host2.send({ t: 'create', name: 'Host2', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const j = await host2.expect(m => m.t === 'created' || m.t === 'rejected');
    assert.strictEqual(j.t, 'rejected');
    assert.strictEqual(j.code, 'serverFull', 'no paused game to reclaim -> serverFull, active game spared');
    host.close(); host2.close();
  } finally { await s.close(); }
});

test('§3 late-join: --no-late-join / non-public game refuses the tokenless takeover', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', noLateJoin: true });
  try {
    const host = await client(s.port);
    host.send({ t: 'create', name: 'Host', options: { public: true, civs: 2, humans: 1, size: 'xsmall' } });
    const created = await host.expect(m => m.t === 'created');
    host.send({ t: 'start' });
    await host.expect(m => m.t === 'joined');
    const late = await client(s.port);
    late.send({ t: 'join', name: 'Latecomer', joinCode: created.joinCode });
    const j = await late.expect(m => m.t === 'joined' || m.t === 'rejected');
    assert.strictEqual(j.t, 'rejected', '--no-late-join host-wide off-switch blocks the takeover');
    host.close(); late.close();
  } finally { await s.close(); }
});

// metrics-v1 (specs/metrics-v1.md §9): counter maths, corrupt-file safety,
// the loopback-only /metrics endpoint, the lifecycle wiring (create → play →
// game over moves exactly the specified counters), and persistence.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const RULESET = require('./ruleset.js');

test('unit: bump/setPeak/set/snapshot maths', async () => {
  const { createMetrics } = await import('../server/metrics.cjs');
  const m = createMetrics({ defaults: { a: 0, peak: 0 } });
  m.bump('a'); m.bump('a', 3);
  m.setPeak('peak', 5); m.setPeak('peak', 2); // a lower value never lowers a peak
  m.set('gauge', 7); m.set('gauge', 7);       // idempotent set
  const s = m.snapshot();
  assert.strictEqual(s.a, 4);
  assert.strictEqual(s.peak, 5);
  assert.strictEqual(s.gauge, 7);
  assert.ok(Number.isInteger(s.started_at), 'started_at rides every snapshot');
});

test('unit: load() of an absent or corrupt file yields the defaults without throwing', async () => {
  const { createMetrics } = await import('../server/metrics.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
  const warns = [];
  const m = createMetrics({ defaults: { a: 0 }, warn: w => warns.push(w) });
  assert.strictEqual(m.load(path.join(dir, 'absent.json')), false);
  const corrupt = path.join(dir, 'corrupt.json');
  fs.writeFileSync(corrupt, '{not json');
  const m2 = createMetrics({ defaults: { a: 0 }, warn: w => warns.push(w) });
  assert.strictEqual(m2.load(corrupt), false);
  assert.strictEqual(m2.snapshot().a, 0, 'fresh zeros after a corrupt file');
  assert.ok(warns.length >= 1, 'one warning, not a throw');
});

test('unit: save/load round-trip continues the counters; writer is interval-gated', async () => {
  const { createMetrics } = await import('../server/metrics.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
  const file = path.join(dir, 'metrics.json');
  let t = 1000000;
  const clock = () => t;
  const m = createMetrics({ now: clock, defaults: { a: 0 } });
  m.load(file); // absent: registers the path, starts at zero
  m.bump('a', 2);
  assert.strictEqual(m.maybeSave(60000), true, 'first dirty save fires');
  m.bump('a');
  assert.strictEqual(m.maybeSave(60000), false, 'within the interval: no second write');
  t += 61000;
  assert.strictEqual(m.maybeSave(60000), true, 'after the interval: the dirty write fires');
  assert.strictEqual(m.maybeSave(60000), false, 'clean: nothing to write');
  const m2 = createMetrics({ now: clock, defaults: { a: 0 } });
  assert.strictEqual(m2.load(file), true);
  assert.strictEqual(m2.snapshot().a, 3, 'counters survive the round-trip');
});

test('unit: isLoopback covers v4, v6, and mapped forms only', async () => {
  const { isLoopback } = await import('../server/metrics.cjs');
  assert.strictEqual(isLoopback('127.0.0.1'), true);
  assert.strictEqual(isLoopback('::1'), true);
  assert.strictEqual(isLoopback('::ffff:127.0.0.1'), true);
  assert.strictEqual(isLoopback('192.168.1.10'), false);
  assert.strictEqual(isLoopback('::ffff:10.0.0.5'), false);
  assert.strictEqual(isLoopback(undefined), false);
});

test('/metrics: served on loopback with the full counter schema; snapshot matches the endpoint', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const r = await fetch(`http://127.0.0.1:${s.port}/metrics`);
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    for (const k of ['page_loads', 'games_created', 'games_resumed', 'games_completed', 'games_abandoned',
      'turns_played', 'player_joins', 'seat_reclaims', 'spectator_joins', 'bug_reports',
      'peak_games', 'peak_conns', 'started_at']) {
      assert.ok(k in body, `schema carries ${k}`);
    }
    assert.strictEqual(body.games_created, 1, 'the boot game counted');
    assert.ok(body.peak_games >= 1);
    // the entry document is a visit; another asset is not
    await fetch(`http://127.0.0.1:${s.port}/client/`);
    await fetch(`http://127.0.0.1:${s.port}/client/style.css`);
    const after = (await (await fetch(`http://127.0.0.1:${s.port}/metrics`)).json());
    assert.strictEqual(after.page_loads, body.page_loads + 1, 'entry doc counted, assets not');
  } finally { await s.close(); }
});

test('/metrics: a NON-loopback request gets the plain unknown-path 404 (flag off) and 200 with --metrics-public', async () => {
  const { startServer } = await import('../server/index.js');
  // find a non-loopback local address to originate a "remote" request against
  const cands = [];
  for (const rows of Object.values(os.networkInterfaces())) {
    for (const r of rows || []) if (!r.internal && r.family === 'IPv4') cands.push(r.address);
  }
  if (cands.length === 0) { test.skip('no non-loopback interface'); return; }
  const addr = cands[0];
  const s = await startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '0.0.0.0' });
  try {
    const r = await fetch(`http://${addr}:${s.port}/metrics`);
    assert.strictEqual(r.status, 404, 'remote: the same 404 an unknown path gets');
    const unknown = await fetch(`http://${addr}:${s.port}/no-such-path`);
    assert.strictEqual(unknown.status, 404, 'indistinguishable from any unknown path');
  } finally { await s.close(); }
  const sPub = await startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '0.0.0.0', metricsPublic: true });
  try {
    const r = await fetch(`http://${addr}:${sPub.port}/metrics`);
    assert.strictEqual(r.status, 200, '--metrics-public serves it remotely');
  } finally { await sPub.close(); }
});

test('lifecycle: create → play a turn → game over moves exactly the three counters (wiring-drift catch)', async () => {
  const { startServer } = await import('../server/index.js');
  const ENDNOW = JSON.parse(JSON.stringify(RULESET));
  // one round out (turn 1 = -4000, ~20y/turn): the first endTurn completes the
  // round, the year passes endYear, score victory — so the turn counter moves
  // AND the game completes in one deterministic step.
  ENDNOW.rules.endYear = -3990;
  const s = await startServer({ ruleset: ENDNOW, seed: 9, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  try {
    const before = s.metrics.snapshot();
    assert.strictEqual(before.games_created, 1, 'boot game');
    assert.strictEqual(before.games_completed, 0);
    assert.strictEqual(before.turns_played, 0);

    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/ws`);
    const inbox = [], waiters = [];
    ws.on('message', raw => {
      const m = JSON.parse(raw.toString());
      const i = waiters.findIndex(w => w.match(m));
      if (i !== -1) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
    });
    const expect = (match) => {
      const hit = inbox.findIndex(match);
      if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
      return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), 6000);
        waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } }); });
    };
    await new Promise(r => ws.on('open', r));
    ws.send(JSON.stringify({ t: 'join', name: 'Ada' }));
    const joined = await expect(m => m.t === 'joined');
    assert.strictEqual(s.metrics.snapshot().player_joins, before.player_joins + 1, 'fresh join counted');
    ws.send(JSON.stringify({ t: 'endTurn', token: joined.token, commandId: 1 }));
    await expect(m => m.t === 'view' && m.view.gameOver === true);
    const after = s.metrics.snapshot();
    assert.strictEqual(after.games_completed, 1, 'game over latched once');
    assert.ok(after.turns_played >= 1, 'the round advanced the turn counter');
    assert.strictEqual(after.games_created, 1, 'no phantom creates');
    assert.strictEqual(after.games_abandoned, 0, 'a finished game is not abandoned');
    ws.close();
  } finally { await s.close(); }
});

test('persistence: counters survive a server restart via --metrics-file; shutdown abandons live games', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-'));
  const file = path.join(dir, 'metrics.json');
  const s1 = await startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', metricsFile: file });
  await s1.close(); // graceful shutdown: writes the file, abandons the unfinished boot game
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(written.counters.games_created, 1);
  assert.strictEqual(written.counters.games_abandoned, 1, 'the live boot game abandoned at shutdown');
  const s2 = await startServer({ ruleset: RULESET, seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', metricsFile: file });
  try {
    const snap = s2.metrics.snapshot();
    assert.strictEqual(snap.games_created, 2, 'restart continued the totals (1 loaded + 1 new boot)');
  } finally { await s2.close(); }
});

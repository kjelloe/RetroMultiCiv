const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function load() {
  return await import('../server/crash.js');
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crashdump-'));
}

// Deterministic memory readers so no real crash/OOM is needed.
function mem(heapUsed) {
  return () => ({ rss: 1, heapTotal: heapUsed, heapUsed, external: 0, arrayBuffers: 0 });
}
function heap(limit) {
  return () => ({ heap_size_limit: limit });
}

test('writeCrashdump: well-formed file from a synthetic error', async () => {
  const { writeCrashdump } = await load();
  const dir = tmpDir();
  const err = new Error('boom'); err.name = 'BoomError';
  const { path: p, body } = writeCrashdump(err, 'uncaughtException', {
    dir, nowIso: () => '2026-07-19T12:00:00.000Z',
    memoryUsage: mem(500), heapStats: heap(1000),
    gameProbe: () => [{ gameId: 'g1', turn: 2623, units: 609, cities: 40 }]
  });
  assert.ok(p, 'a file was written');
  assert.strictEqual(p, `${dir}/crash-2026-07-19T12-00-00-000Z.log`);
  const onDisk = fs.readFileSync(p, 'utf8');
  assert.strictEqual(onDisk, body);
  assert.match(body, /origin: uncaughtException/);
  assert.match(body, /name: BoomError/);
  assert.match(body, /message: boom/);
  assert.match(body, /stack:/);
  assert.match(body, /heap_size_limit: 1000  heapUsed%: 50/);
  assert.match(body, /g1 turn=2623 units=609 cities=40/);
});

test('writeCrashdump: never throws when the game probe throws', async () => {
  const { writeCrashdump } = await load();
  const dir = tmpDir();
  const { path: p, body } = writeCrashdump(new Error('x'), 'unhandledRejection', {
    dir, nowIso: () => '2026-07-19T12-01.z'.replace(/[^0-9A-Za-z]/g, '-'),
    memoryUsage: mem(1), heapStats: heap(10),
    gameProbe: () => { throw new Error('probe blew up'); }
  });
  assert.ok(p, 'the dump still wrote despite the probe failing');
  assert.match(body, /game probe failed: probe blew up/);
});

test('writeCrashdump: file-write failure returns null path, does not throw', async () => {
  const { writeCrashdump } = await load();
  // Point at a path whose parent is a FILE, so mkdir/write fails.
  const dir = tmpDir();
  const notADir = path.join(dir, 'afile');
  fs.writeFileSync(notADir, 'x');
  const res = writeCrashdump(new Error('y'), 'uncaughtException', {
    dir: path.join(notADir, 'nested'),
    nowIso: () => '2026-07-19T00-00-00-000Z',
    memoryUsage: mem(1), heapStats: heap(10)
  });
  assert.strictEqual(res.path, null, 'no file, but no throw');
  assert.ok(res.body.length > 0);
});

test('memory watchdog: fires graceful-exit at a mocked high heapUsed', async () => {
  const { startMemoryWatchdog } = await load();
  const dir = tmpDir();
  let exited = null; let saved = 0;
  const wd = startMemoryWatchdog({
    dir, softPct: 85,
    memoryUsage: mem(900), heapStats: heap(1000), // 90% >= 85%
    nowIso: () => '2026-07-19T13-00-00-000Z',
    autosaveAll: () => { saved++; },
    exit: code => { exited = code; },
    setInterval: () => ({ unref() {} }) // don't actually schedule
  });
  const fired = wd.check();
  assert.strictEqual(fired, true);
  assert.strictEqual(exited, 70, 'exit(70) restart code');
  assert.strictEqual(saved, 1, 'best-effort save-all ran once');
  const oom = fs.readFileSync(`${dir}/oom-2026-07-19T13-00-00-000Z.log`, 'utf8');
  assert.match(oom, /# oom/);
  assert.match(oom, /heap soft-limit crossed/);
  // Idempotent: a second check does not re-fire / re-exit.
  exited = null;
  assert.strictEqual(wd.check(), false);
  assert.strictEqual(exited, null);
});

test('memory watchdog: stays quiet below the soft threshold', async () => {
  const { startMemoryWatchdog } = await load();
  let exited = null;
  const wd = startMemoryWatchdog({
    dir: tmpDir(), softPct: 85,
    memoryUsage: mem(500), heapStats: heap(1000), // 50% < 85%
    exit: code => { exited = code; },
    setInterval: () => ({ unref() {} })
  });
  assert.strictEqual(wd.check(), false);
  assert.strictEqual(exited, null);
});

test('watchdog: a reader failure does not itself take the process down', async () => {
  const { startMemoryWatchdog } = await load();
  let exited = null;
  const wd = startMemoryWatchdog({
    dir: tmpDir(),
    heapStats: () => { throw new Error('v8 unavailable'); },
    exit: code => { exited = code; },
    setInterval: () => ({ unref() {} })
  });
  assert.strictEqual(wd.check(), false);
  assert.strictEqual(exited, null);
});

test('installCrashHandlers: uncaughtException writes a dump and exits 70', async () => {
  const { installCrashHandlers } = await load();
  const dir = tmpDir();
  let exited = null;
  const before = process.listeners('uncaughtException').slice();
  installCrashHandlers({
    dir, nowIso: () => '2026-07-19T14-00-00-000Z',
    memoryUsage: mem(1), heapStats: heap(10),
    exit: code => { exited = code; }
  });
  try {
    // Invoke the registered handler DIRECTLY (not process.emit, which the test
    // runner's own uncaughtException listener would treat as a real crash).
    const added = process.listeners('uncaughtException').filter(l => !before.includes(l));
    assert.strictEqual(added.length, 1, 'exactly one handler registered');
    added[0](new Error('handler-test'), 'uncaughtException');
    assert.strictEqual(exited, 70);
    const p = `${dir}/crash-2026-07-19T14-00-00-000Z.log`;
    assert.match(fs.readFileSync(p, 'utf8'), /handler-test/);
  } finally {
    // Remove the listeners we added so the test process is not left armed.
    for (const l of process.listeners('uncaughtException')) {
      if (!before.includes(l)) process.removeListener('uncaughtException', l);
    }
    for (const l of process.listeners('unhandledRejection')) {
      process.removeListener('unhandledRejection', l);
    }
  }
});

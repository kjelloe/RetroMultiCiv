// In-client BUG REPORT (helper queue #3): the write-only server sink. Unit
// pins for server/bug-report.js (atomic write + keep-newest rotation) and route
// pins for POST /bug-report (opt-in, size cap, per-IP hourly budget, write-only
// — never served back over HTTP).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const RULESET = require('./ruleset.js');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rmc-bug-')); }

function postJson(port, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let out = '';
      res.on('data', c => { out += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}
function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, res => {
      res.resume(); resolve({ status: res.statusCode });
    });
    req.on('error', reject);
  });
}
const base = extra => Object.assign({
  ruleset: RULESET, seed: 1, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1'
}, extra);

test('writeBugReport: atomic file with a format wrapper + sanitized name', async () => {
  const { writeBugReport } = await import('../server/bug-report.js');
  const dir = tmpDir();
  try {
    const file = writeBugReport(dir, { gameId: 'g1/../x', text: 'boom' }, Date.parse('2026-07-20T22:00:00Z'));
    assert.ok(fs.existsSync(file), 'file written');
    assert.ok(!/[/\\]g1/.test(path.basename(file)), 'gameId path chars stripped from the name');
    const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(rec.format, 'retromulticiv-bug-report');
    assert.strictEqual(rec.report.text, 'boom');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rotateBugReports: keeps the newest N by mtime', async () => {
  const { writeBugReport, rotateBugReports } = await import('../server/bug-report.js');
  const dir = tmpDir();
  try {
    for (let i = 0; i < 5; i++) {
      const f = writeBugReport(dir, { gameId: 'g' + i }, Date.parse('2026-07-20T22:00:00Z') + i * 1000);
      fs.utimesSync(f, new Date(1e9 + i), new Date(1e9 + i)); // ascending mtime, i=4 newest
    }
    rotateBugReports(dir, 2);
    const left = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    assert.strictEqual(left.length, 2, 'only the newest 2 remain');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('POST /bug-report: disabled by default → 404; enabled → 200 writes one file', async () => {
  const { startServer } = await import('../server/index.js');
  const off = await startServer(base({ gameId: 'br-off' }));
  try {
    const r = await postJson(off.port, '/bug-report', { text: 'x' });
    assert.strictEqual(r.status, 404, 'no --bug-reports → route disabled');
  } finally { await off.close(); }

  const dir = tmpDir();
  const on = await startServer(base({ gameId: 'br-on', bugReports: dir }));
  try {
    const r = await postJson(on.port, '/bug-report', { gameId: 'br-on', text: 'the endscreen crashed' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(JSON.parse(r.body), { ok: true });
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    assert.strictEqual(files.length, 1, 'exactly one report file written');
    // write-only: the dir is NOT served over HTTP
    const leak = await get(on.port, '/bug-report');
    assert.notStrictEqual(leak.status, 200, 'GET /bug-report is not a readable route');
  } finally { await on.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('POST /bug-report: bad json → 400, oversize → 413', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = tmpDir();
  const s = await startServer(base({ gameId: 'br-guard', bugReports: dir }));
  try {
    const bad = await postJson(s.port, '/bug-report', '{not json');
    assert.strictEqual(bad.status, 400);
    const huge = 'x'.repeat(3 * 1024 * 1024);
    const big = await postJson(s.port, '/bug-report', JSON.stringify({ text: huge }));
    assert.strictEqual(big.status, 413, 'over the 2 MB cap');
  } finally { await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('POST /bug-report: per-IP hourly budget → 429 past the limit', async () => {
  const { startServer } = await import('../server/index.js');
  const dir = tmpDir();
  const s = await startServer(base({ gameId: 'br-rate', bugReports: dir, bugReportsPerHour: 2 }));
  try {
    assert.strictEqual((await postJson(s.port, '/bug-report', { text: '1' })).status, 200);
    assert.strictEqual((await postJson(s.port, '/bug-report', { text: '2' })).status, 200);
    const third = await postJson(s.port, '/bug-report', { text: '3' });
    assert.strictEqual(third.status, 429, 'third report in the window is rate-limited');
    assert.deepStrictEqual(JSON.parse(third.body), { ok: false, reason: 'rateLimited' });
  } finally { await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

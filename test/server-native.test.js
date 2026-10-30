// fe-R6 (A112): /native.json + /native/<file>, ported from CarrierDominion's
// server/native.js. Only this game's plain-named files are offered; a folder
// is read per request; single byte ranges resume a download.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const RULESET = require('./ruleset.js');

function folderWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmc-native-'));
  for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes, 7));
  return dir;
}

function get(port, urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath, headers }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function withServer(nativeDownloads, run) {
  const { startServer } = await import('../server/index.js');
  const log = console.log;
  console.log = () => {};
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1', nativeDownloads });
  console.log = log;
  try { await run(s.port); } finally { await s.close(); }
}

test('nativeSource: folder, file URL, web address, or nothing', async () => {
  const { nativeSource } = await import('../server/native.js');
  assert.deepStrictEqual(nativeSource(undefined, '/repo'), { kind: 'none' });
  assert.deepStrictEqual(nativeSource('dist', '/repo'), { kind: 'folder', dir: '/repo/dist' });
  assert.deepStrictEqual(nativeSource('file:///srv/builds', '/repo'), { kind: 'folder', dir: '/srv/builds' });
  assert.deepStrictEqual(nativeSource('https://example.com/rel', '/repo'), { kind: 'url', url: 'https://example.com/rel' });
});

test('/native.json is none when unset; a folder offers only RetroMultiCiv files, served with ranges', async () => {
  await withServer('', async port => {
    assert.deepStrictEqual(JSON.parse((await get(port, '/native.json')).body), { kind: 'none' });
    assert.strictEqual((await get(port, '/native/RetroMultiCiv-x.zip')).status, 404);
  });
  const dir = folderWith({
    'RetroMultiCiv-20261030-abc-linux64.zip': 1000,
    'retromulticiv-20261030-abc-win64.zip': 2000,
    'boombrawl-20261030-def-win64.zip': 500,
    '.RetroMultiCiv-partial.zip': 10
  });
  try {
    await withServer(dir, async port => {
      const listing = JSON.parse((await get(port, '/native.json')).body);
      assert.strictEqual(listing.kind, 'folder');
      assert.deepStrictEqual(listing.files.map(f => f.name).sort(),
        ['RetroMultiCiv-20261030-abc-linux64.zip', 'retromulticiv-20261030-abc-win64.zip']);
      const full = await get(port, '/native/RetroMultiCiv-20261030-abc-linux64.zip');
      assert.strictEqual(full.status, 200);
      assert.strictEqual(full.headers['content-type'], 'application/zip');
      assert.strictEqual(full.headers['accept-ranges'], 'bytes');
      assert.match(full.headers['content-disposition'], /^attachment/);
      assert.strictEqual(full.body.length, 1000);
      const part = await get(port, '/native/RetroMultiCiv-20261030-abc-linux64.zip', { Range: 'bytes=900-' });
      assert.strictEqual(part.status, 206);
      assert.strictEqual(part.headers['content-range'], 'bytes 900-999/1000');
      assert.strictEqual(part.body.length, 100);
      assert.strictEqual((await get(port, '/native/boombrawl-20261030-def-win64.zip')).status, 404, 'other games are not offered');
      assert.strictEqual((await get(port, '/native/..%2fpackage.json')).status, 404);
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('nativeLinks: labels per platform; none for an empty listing', async () => {
  const { nativeLinks } = await import('../client/ui/native-links.js');
  assert.deepStrictEqual(nativeLinks({ kind: 'none' }), []);
  assert.deepStrictEqual(nativeLinks(null), []);
  const links = nativeLinks({ kind: 'folder', files: [{ name: 'RetroMultiCiv-1-win64.zip', size: 20 * 1048576, url: '/native/RetroMultiCiv-1-win64.zip' }] });
  assert.deepStrictEqual(links, [{ label: 'Windows · RetroMultiCiv-1-win64.zip (20 MB)', href: '/native/RetroMultiCiv-1-win64.zip', external: false }]);
  assert.strictEqual(nativeLinks({ kind: 'url', url: 'https://x/rel' })[0].external, true);
});

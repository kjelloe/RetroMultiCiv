// fe-R14 (A113): `--saves-dir DIR` puts the CLI server's autosaves in DIR
// (created if missing) and nowhere under the repo's saves/.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.join(__dirname, '..');

test('CLI --saves-dir: the default game autosaves there after one command', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rmc-savesdir-'));
  const savesDir = path.join(tmp, 'nested', 'saves');
  const before = new Set(fs.existsSync(path.join(REPO, 'saves')) ? fs.readdirSync(path.join(REPO, 'saves')) : []);
  const child = spawn(process.execPath, [path.join(REPO, 'server', 'index.js'), '--port', '0', '--host', '127.0.0.1',
    '--civs', '2', '--humans', '1', '--seed', '1', '--size', 'xsmall', '--saves-dir', savesDir,
    '--crashdumps-dir', path.join(tmp, 'dumps'), '--metrics-file', path.join(tmp, 'metrics.json')],
  { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no ready line:\n' + out)), 30000);
      const poll = setInterval(() => {
        const m = /WebSocket: ws:\/\/localhost:(\d+)\/ws/.exec(out);
        if (m) { clearInterval(poll); clearTimeout(timer); resolve(Number(m[1])); }
      }, 20);
    });
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const inbox = [];
    ws.on('message', raw => inbox.push(JSON.parse(raw.toString())));
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    const next = t => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${t}`)), 30000);
      const poll = setInterval(() => {
        const i = inbox.findIndex(m => m.t === t);
        if (i !== -1) { clearInterval(poll); clearTimeout(timer); resolve(inbox.splice(i, 1)[0]); }
      }, 10);
    });
    ws.send(JSON.stringify({ t: 'join', name: 'Kjell' }));
    const joined = await next('joined');
    const settlers = Object.values(joined.view.units).find(u => u.owner === 'p1' && u.type === 'settlers');
    ws.send(JSON.stringify({ t: 'cmd', token: joined.token, commandId: 1, cmd: { type: 'foundCity', unitId: settlers.id, name: 'Dirtown' } }));
    await next('applied');
    ws.close();
    const files = fs.readdirSync(savesDir).filter(f => f.endsWith('.json'));
    assert.ok(files.includes(joined.gameId + '.json'), `autosave in --saves-dir (got ${files})`);
    const after = fs.existsSync(path.join(REPO, 'saves')) ? fs.readdirSync(path.join(REPO, 'saves')) : [];
    assert.deepStrictEqual(after.filter(f => !before.has(f)), [], 'nothing new under the repo saves/');
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

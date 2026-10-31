// workitems-roblox item 6: luau/state-string.luau (the Roblox GameServer's
// command door) agrees with shared/state-string.js on every JSON-shaped
// payload, and is stricter where a RemoteEvent can carry what JSON cannot.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const lune = spawnSync('lune', ['--version'], { encoding: 'utf8' }).status === 0;

const CASES = [
  { type: 'foundCity', unitId: 'u1', name: 'Rome' },
  { type: 'foundCity', unitId: 'u1', name: 'Åse' },
  { type: 'foundCity', unitId: 'u1', name: 'tab\there' },
  { type: 'setWorkers', cityId: 'c1', tiles: [[1, 2], [3, 4]] },
  { type: 'diplomacy', action: 'offer', terms: { gold: 50, techs: ['bronze-working'] } },
  { type: 'moveUnit', unitId: 'u1', dir: 'N', extra: { 'bæd': 1 } },
  { type: 'endTurn', ok: true }
];

test('state-string twin: JS and Luau agree on JSON payloads; Luau rejects floats, NaN, functions',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const { onlyStateStrings } = await import('../shared/state-string.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-statestring-'));
    try {
      const p = path.join(dir, 'cases.json');
      fs.writeFileSync(p, JSON.stringify(CASES));
      const res = spawnSync('lune', ['run', 'luau/state-string-check.luau', p], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
      assert.strictEqual(res.status, 0, res.stdout + res.stderr);
      CASES.forEach((c, i) => {
        assert.ok(res.stdout.includes(`case ${i + 1}: ${onlyStateStrings(c)}`), `case ${i + 1} (${JSON.stringify(c)}):\n${res.stdout}`);
      });
      for (const line of ['name-25: false', 'float: false', 'nan: false', 'function: false']) {
        assert.ok(res.stdout.includes(line), `${line}:\n${res.stdout}`);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

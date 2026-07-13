// Project-contract guards: rules from CLAUDE.md that used to live on trust,
// enforced mechanically after each bit us once. All self-skip gracefully
// where the environment lacks git.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');

function git(args) {
  const res = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : null;
}
const inGit = git(['rev-parse', '--is-inside-work-tree']) === 'true';

test('dependency whitelist: ws (runtime) and lune (dev) only', () => {
  const pkg = require('../package.json');
  const deps = Object.keys(pkg.dependencies || {});
  const dev = Object.keys(pkg.devDependencies || {});
  assert.deepStrictEqual(deps.filter(d => d !== 'ws'), [],
    `unapproved runtime dependency: ${deps} — the whitelist is CLAUDE.md's hard rule`);
  const badDev = dev.filter(d => d !== 'lune' && !d.startsWith('@lune/'));
  assert.deepStrictEqual(badDev, [], `unapproved dev dependency: ${badDev}`);
});

test('license boundary: wiki-extract (CC BY-SA) is never tracked', { skip: !inGit && 'not a git checkout' }, () => {
  const tracked = git(['ls-files', 'data/wiki-extract']);
  assert.strictEqual(tracked, '', 'data/wiki-extract must never be committed (CC BY-SA prose)');
});

test('runtime artifacts stay untracked: saves/, sim artifacts, playtest logs', { skip: !inGit && 'not a git checkout' }, () => {
  for (const dir of ['saves', 'debugging/sim', 'debugging/logs']) {
    assert.strictEqual(git(['ls-files', dir]), '', `${dir} must stay untracked`);
  }
});

test('run.sh: --help exits 0 and documents the arguments', () => {
  const res = spawnSync('bash', [path.join(REPO, 'run.sh'), '--help'], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, `run.sh --help failed:\n${res.stderr}`);
  assert.match(res.stdout, /usage: .*run\.sh/);
  for (const flag of ['--seed', '--game', '--reset-seats', '--no-save']) {
    assert.ok(res.stdout.includes(flag), `--help must document ${flag}`);
  }
});

// --- run scripts: the user's LAN front door. Two fresh-clone failures
// shipped in one wave (B: run.ps1 null ArgumentList, run.sh hiding the
// module-not-found reason), so the failure paths now run for REAL: bash
// always; the PowerShell twin through powershell.exe where reachable
// (WSL/Windows dev boxes — CI and pure-Linux machines self-skip).
const fs = require('fs');
const os = require('os');

// a minimal tree run.sh/run.ps1 accept: deps present, server is a stub
function stubServerTree(prefix, indexJs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, 'node_modules', 'ws'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'server'));
  fs.writeFileSync(path.join(dir, 'server', 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(dir, 'server', 'index.js'), indexJs);
  return dir;
}

function psRun(args, opts) {
  return spawnSync('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass'].concat(args),
    Object.assign({ encoding: 'utf8', timeout: 90000 }, opts));
}
// powershell.exe reachable AND a Windows-side node for Start-Process to find
const psReady = (() => {
  const r = psRun(['-Command', 'if (Get-Command node -ErrorAction SilentlyContinue) { "node-ok" }']);
  return !r.error && r.status === 0 && /node-ok/.test(r.stdout || '');
})();
const winPath = p => spawnSync('wslpath', ['-w', p], { encoding: 'utf8' }).stdout.trim();

test('run.sh: a module-resolution crash names the module and the recovery', () => {
  const dir = stubServerTree('multiciv-runsh-', "import './missing.js';\n");
  try {
    fs.copyFileSync(path.join(REPO, 'run.sh'), path.join(dir, 'run.sh'));
    const res = spawnSync('bash', ['run.sh', '18999'], { cwd: dir, encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(res.status, 1, `run.sh must exit 1 (stdout: ${res.stdout}\nstderr: ${res.stderr})`);
    assert.match(res.stderr, /Cannot find module/,
      'the reason line sits ABOVE the stack — the failure path must surface it, not just tail the frames (a real user pasted a stack with no module name)');
    assert.match(res.stderr, /git pull && npm ci/,
      'ERR_MODULE_NOT_FOUND must point at the stale-clone / incomplete-deps recovery');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('run.ps1: -Help parses and documents the arguments (real PowerShell)',
  { skip: !psReady && 'powershell.exe (with Windows node) not reachable' }, () => {
    const res = psRun(['-File', winPath(path.join(REPO, 'run.ps1')), '-Help']);
    assert.strictEqual(res.status, 0, `run.ps1 -Help failed:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /usage: .*run\.ps1/);
  });

test('run.ps1: no-args and port-only invocations build a clean ArgumentList (real PowerShell)',
  { skip: !psReady && 'powershell.exe (with Windows node) not reachable' }, () => {
    // the stub echoes its argv and dies -> run.ps1 must reach its
    // "server failed to start" path and the tail must show clean args
    const dir = stubServerTree('multiciv-runps-',
      "console.error('ARGV[' + process.argv.slice(2).join(' ') + ']');\nprocess.exit(7);\n");
    try {
      fs.copyFileSync(path.join(REPO, 'run.ps1'), path.join(dir, 'run.ps1'));
      const script = winPath(path.join(dir, 'run.ps1'));
      for (const extra of [[], ['18998']]) {
        const label = extra.length ? 'port-only' : 'no-args';
        const res = psRun(['-File', script].concat(extra));
        const out = `${res.stdout}\n${res.stderr}`;
        assert.ok(!/Cannot validate argument/.test(out),
          `${label}: ArgumentList carried a null element (unbound remaining-args param):\n${out}`);
        assert.ok(!/ARGV\[--port \d+ \d+\]/.test(out),
          `${label}: the port leaked back into the server args (PS descending-range slice at Count=1):\n${out}`);
        assert.match(out, /server failed to start/,
          `${label}: must reach the launch and report the stub's exit:\n${out}`);
        assert.strictEqual(res.status, 1, `${label}: expected the failed-start exit code:\n${out}`);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

test('ages data contract: hand-edited rules.json cannot silently break the tech grant', () => {
  const rules = require('../data/rules.json');
  const techs = require('../data/techs.json');
  const erasInTechs = {};
  for (const [id, t] of Object.entries(techs)) {
    assert.ok(typeof t.era === 'string' && t.era.length > 0,
      `tech ${id} lost its era field — regenerate via tools/mapdata.js (TECH_ERAS)`);
    erasInTechs[t.era] = true;
  }
  assert.ok(Array.isArray(rules.ages) && rules.ages.length > 0, 'rules.json needs an ages table');
  assert.strictEqual(rules.ages[0].turn, 0, 'the first age must be the ordinary turn-0 start');
  let prevTurn = -1;
  for (const age of rules.ages) {
    assert.ok(age.turn > prevTurn, `age turns must strictly increase (${age.id})`);
    prevTurn = age.turn;
    for (const era of age.grantEras === undefined ? [] : age.grantEras) {
      assert.ok(erasInTechs[era], `age ${age.id} grants era "${era}" which no tech carries — typo?`);
    }
    for (const id of age.except === undefined ? [] : age.except) {
      assert.ok(techs[id], `age ${age.id} excepts unknown tech id "${id}"`);
    }
  }
});

test('nightly workflow installs dependencies before testing', () => {
  const fs = require('fs');
  const yml = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'nightly-soak.yml'), 'utf8');
  const jobs = yml.split(/\n  \w+:\n/).length - 1;
  const installs = (yml.match(/npm ci/g) || []).length;
  assert.ok(installs >= 2, `every CI job needs npm ci (found ${installs}; the first nightly failed on exactly this)`);
});

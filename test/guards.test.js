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

test('agent toolbox: every debugging/*.sh parses and agent-mail.py compiles', () => {
  const fs = require('fs');
  const dir = path.join(REPO, 'debugging');
  const scripts = fs.readdirSync(dir).filter(f => f.endsWith('.sh'));
  assert.ok(scripts.length >= 7, `expected the toolbox scripts, found ${scripts.length}`);
  for (const s of scripts) {
    const res = spawnSync('bash', ['-n', path.join(dir, s)], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `${s} has a bash syntax error:\n${res.stderr}`);
  }
  const py = spawnSync('python3', ['-m', 'py_compile', path.join(REPO, 'tools', 'agent-mail.py')],
    { encoding: 'utf8' });
  assert.strictEqual(py.status, 0, `agent-mail.py does not compile:\n${py.stderr}`);
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

test('.hidden is per-element: every JS hidden-toggle target has a scoped CSS rule', () => {
  // One bug family, four shipped instances (A23 setup rows, #code-toast,
  // #wait-line, #mp-status): classList.add('hidden') on an element with no
  // matching '#id.hidden' rule silently styles nothing. Cross-reference the
  // client statically. Conservative: receivers we cannot resolve to an id
  // are skipped (panels.js's data-close loop targets are .panel anyway), so
  // a miss here is a REAL hole, not a heuristic artifact.
  const clientDir = path.join(REPO, 'client');
  const css = fs.readFileSync(path.join(clientDir, 'style.css'), 'utf8');
  const html = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');
  const ruled = new Set();
  for (const m of css.matchAll(/#([\w-]+)\.hidden/g)) ruled.add(m[1]);
  const panelClassIds = new Set(); // covered by the generic .panel.hidden rule
  for (const m of html.matchAll(/id="([\w-]+)" class="[^"]*\bpanel\b[^"]*"/g)) panelClassIds.add(m[1]);

  const jsFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'vendor') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) jsFiles.push(p);
    }
  })(clientDir);

  const missing = [];
  for (const file of jsFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const varToId = {};
    for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*document\.getElementById\('([\w-]+)'\)/g)) varToId[m[1]] = m[2];
    for (const m of src.matchAll(/(\w+)\.id\s*=\s*'([\w-]+)'/g)) varToId[m[1]] = m[2];
    for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*document\.querySelector\('#([\w-]+)'\)/g)) varToId[m[1]] = m[2];
    // JS-created panels: el.className = '... panel ...' extends the covered set
    for (const m of src.matchAll(/(\w+)\.className\s*=\s*'([^']*)'/g)) {
      if (varToId[m[1]] && /\bpanel\b/.test(m[2])) panelClassIds.add(varToId[m[1]]);
    }
    for (const m of src.matchAll(/([\w.()'-]+)\.classList\.(?:add|remove|toggle)\('hidden'\)|(\w+)\.className\s*=\s*'hidden'/g)) {
      const recv = (m[1] || m[2]).trim();
      const inline = recv.match(/^document\.getElementById\('([\w-]+)'\)$/);
      const id = inline ? inline[1] : varToId[recv];
      if (!id) continue; // unresolved receiver: out of scope by design
      if (ruled.has(id) || panelClassIds.has(id)) continue;
      missing.push(`${path.relative(REPO, file)}: #${id}`);
    }
  }
  assert.deepStrictEqual([...new Set(missing)], [],
    'these elements toggle .hidden but no scoped rule styles it — add "#<id>.hidden { display: none; }" to client/style.css');
});

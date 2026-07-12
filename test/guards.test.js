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

test('nightly workflow installs dependencies before testing', () => {
  const fs = require('fs');
  const yml = fs.readFileSync(path.join(REPO, '.github', 'workflows', 'nightly-soak.yml'), 'utf8');
  const jobs = yml.split(/\n  \w+:\n/).length - 1;
  const installs = (yml.match(/npm ci/g) || []).length;
  assert.ok(installs >= 2, `every CI job needs npm ci (found ${installs}; the first nightly failed on exactly this)`);
});

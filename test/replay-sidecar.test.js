// #1870 slice 2b: tools/replay.js must reconstruct a slice-2 server save's full
// per-command log from its sidecar (<gameId>.log.jsonl) so offline replay
// verifies the whole game — the round-only .json alone can't. The luau twin
// (luau/replay.luau) mirrors this byte-for-byte; VERDICT equality is the
// luau-twins gate. Here we cover the JS side + both fallbacks.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { spawnSync } = require('child_process');
const RULESET = require('./ruleset.js');
const { normalizeReplayInput, replayDiagnostics, loadRuleset } = require('../tools/replay.js');

const REPO = path.join(__dirname, '..');
const haveLune = spawnSync('lune', ['--version'], { encoding: 'utf8' }).status === 0;

const SETUP = {
  seed: 424242,
  options: {
    width: 24, height: 16,
    players: [
      { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ]
  }
};

// Build a real slice-2 save (round-only .json + a per-command .log.jsonl sidecar).
async function makeSlice2Save(dir) {
  const { createGame } = await import('../server/game.js');
  const savePath = path.join(dir, 'g.json');
  const game = createGame({ ruleset: RULESET, setup: SETUP, gameId: 'g', sidecarFile: path.join(dir, 'g.log.jsonl') });
  game.bindSeat('Kjell');
  const settlers = Object.values(game.state.units).find(u => u.owner === 'p1' && u.type === 'settlers');
  game.apply('p1', { type: 'foundCity', unitId: settlers.id, name: 'Fix' });
  for (let i = 0; i < 4; i++) game.endTurn('p1');
  game.saveTo(savePath);
  return savePath;
}

test('replay reconstructs the full log from the sidecar and verifies hash-exact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-sc-'));
  try {
    const savePath = await makeSlice2Save(dir);
    const raw = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    // sanity: the .json itself is round-only (bounded)
    assert.strictEqual(raw.diag.logTruncated, true);
    assert.ok(raw.diag.log.every(e => e.t === 'round'));

    const { note, diag } = await normalizeReplayInput(raw, savePath);
    assert.match(note, /per-command sidecar \(g\.log\.jsonl\)/);
    assert.ok(diag.log.some(e => e.t === 'cmd' && e.cmd.type === 'foundCity'),
      'the full per-command log came back from the sidecar');

    const report = await replayDiagnostics(diag, loadRuleset());
    assert.deepStrictEqual(report.problems, [], 'the reconstructed recording replays hash-exact');
    assert.ok(report.commands >= 1 && report.rounds >= 4);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing sidecar degrades gracefully (round-hashes only, clear note)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-sc-'));
  try {
    const savePath = await makeSlice2Save(dir);
    fs.unlinkSync(path.join(dir, 'g.log.jsonl')); // sidecar lost
    const raw = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    const { note, diag } = await normalizeReplayInput(raw, savePath);
    assert.match(note, /sidecar g\.log\.jsonl missing; replaying round-hashes only/);
    assert.ok(diag.log.every(e => e.t === 'round'), 'falls back to the embedded round-hashes');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('luau twin: the two replayers agree byte-for-byte on the sidecar path',
  { skip: !haveLune && 'lune not installed (dev-only toolchain)' }, async () => {
    // A sidecar save must replay IDENTICALLY through tools/replay.js and
    // luau/replay.luau — the P5-8 VERDICT-equality contract, extended to the
    // slice-2 format. Build the fixture inside the repo so both replayers
    // resolve the sidecar next to it, then diff their stdout.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replaytwin-'));
    try {
      const savePath = await makeSlice2Save(dir); // absolute path; both replayers derive the sidecar from its dirname
      const js = spawnSync('node', ['tools/replay.js', savePath], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
      const luau = spawnSync('lune', ['run', 'luau/replay.luau', savePath], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
      assert.match(js.stdout, /per-command sidecar/, 'JS took the sidecar path');
      assert.strictEqual(luau.stdout, js.stdout, 'the two replayers agree verbatim on the sidecar recording');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

test('no srcPath (programmatic caller) uses the embedded log, unchanged', async () => {
  // an older full-log server save still replays via its embedded diagnostics
  const raw = { format: 'retromulticiv-server-save', gameId: 'x',
    diag: { format: 'retromulticiv-diagnostics', initialState: null, log: [] } };
  const { note, diag } = await normalizeReplayInput(raw); // no srcPath
  assert.match(note, /replaying its embedded diagnostics/);
  assert.strictEqual(diag, raw.diag);
});

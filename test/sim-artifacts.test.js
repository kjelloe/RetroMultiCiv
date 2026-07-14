// B9: a sim failure's artifacts must carry the DIAGNOSIS, not just a count.
// The architect lost a 7-minute re-simulation because sim-6.diag.json said
// only "1 invariant problem(s)" — the actual invariant text lived solely in
// a truncated terminal transcript. Failure artifacts now embed err.problems
// and the failing turn verbatim, in BOTH the save envelope and the diag.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runSim } = require('./sim-driver.js');

test('sim failure artifacts embed the invariant problems and failing turn', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-simfail-'));
  try {
    let thrown = null;
    try {
      await runSim({
        seed: 11, civs: 2, width: 40, height: 25, turns: 6,
        artifactsDir: dir,
        // the custom-tripwire seam: a deterministic failure at round 3
        extraInvariant: s => (s.turn >= 3 ? ['test tripwire: injected at turn 3'] : [])
      });
    } catch (e) { thrown = e; }
    assert.ok(thrown, 'the injected tripwire must fail the sim');
    assert.deepStrictEqual(thrown.problems, ['test tripwire: injected at turn 3'],
      'err.problems carries the text (already true pre-B9)');
    assert.ok(thrown.artifacts, 'artifacts were written');

    const diag = JSON.parse(fs.readFileSync(thrown.artifacts.diag, 'utf8'));
    assert.deepStrictEqual(diag.sim.problems, ['test tripwire: injected at turn 3'],
      'the DIAG must embed the problem text verbatim — a lost terminal must cost nothing');
    assert.strictEqual(diag.sim.turn, thrown.turn, 'and the failing turn');

    const save = JSON.parse(fs.readFileSync(thrown.artifacts.save, 'utf8'));
    assert.deepStrictEqual(save.simFailure.problems, ['test tripwire: injected at turn 3'],
      'the SAVE envelope must carry the diagnosis too (it travels alone via drag-drop)');
    assert.strictEqual(save.simFailure.turn, thrown.turn);
    assert.match(save.simFailure.reason, /invariant problem/,
      'and the human-readable reason line');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

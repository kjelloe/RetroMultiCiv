// Runs every JSON scenario in test/scenarios/ against the JS engine.
// Skips (not fails) until engine/index.js exists — the scenarios are written
// first, TDD-style, and double as the contract for the later Luau engine.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runScenario } = require('./scenario-runner.js');

const ENGINE_PATH = path.join(__dirname, '..', 'engine', 'index.js');
const hasEngine = fs.existsSync(ENGINE_PATH);

async function loadEngine() {
  const { createEngine } = await import('../engine/index.js');
  return createEngine({
    terrain: require('../data/terrain.json'),
    units: require('../data/units.json')
  });
}

const scenarioDir = path.join(__dirname, 'scenarios');
const files = fs.readdirSync(scenarioDir).filter(f => f.endsWith('.json')).sort();

test('at least one scenario exists and parses', () => {
  assert.ok(files.length >= 1);
  for (const f of files) {
    const s = JSON.parse(fs.readFileSync(path.join(scenarioDir, f), 'utf8'));
    assert.ok(s.name, `${f} needs a name`);
    assert.ok(s.setup, `${f} needs a setup`);
    assert.ok(Array.isArray(s.script), `${f} needs a script array`);
  }
});

for (const f of files) {
  const scenario = JSON.parse(fs.readFileSync(path.join(scenarioDir, f), 'utf8'));
  test(`scenario ${f}: ${scenario.name}`, { skip: !hasEngine && 'engine not built yet (roadmap step 1)' }, async () => {
    const result = await runScenario(await loadEngine(), scenario);
    assert.ok(result.pass, '\n' + result.failures.join('\n'));
  });
}

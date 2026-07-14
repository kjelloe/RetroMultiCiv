// A39: the turn-log filter classes — pure event → class mapping
// (client/ui/turnlog-classes.js is DOM-free by design so this runs headless).
const test = require('node:test');
const assert = require('node:assert');

async function load() {
  return import('../client/ui/turnlog-classes.js');
}

test('classifyEvent: ownership splits combat/cities/rival; world and saves are absolute', async () => {
  const { classifyEvent } = await load();
  const owner = { c1: 'p1', c2: 'p2' };
  const cityOwner = id => owner[id] || null;

  // combat: mine either side = combat, neither = the B5 rival narration
  assert.strictEqual(classifyEvent({ type: 'combatResolved', attackerOwner: 'p1', defenderOwner: 'p2' }, 'p1', cityOwner), 'combat');
  assert.strictEqual(classifyEvent({ type: 'combatResolved', attackerOwner: 'p2', defenderOwner: 'p1' }, 'p1', cityOwner), 'combat');
  assert.strictEqual(classifyEvent({ type: 'combatResolved', attackerOwner: 'p2', defenderOwner: 'p3' }, 'p1', cityOwner), 'rival');

  // city events: my city = cities, a rival's = rival
  for (const type of ['cityFounded', 'cityGrew', 'cityStarved', 'unitBuilt', 'buildingBuilt', 'cityDisorder', 'cityOrderRestored']) {
    assert.strictEqual(classifyEvent({ type, cityId: 'c1' }, 'p1', cityOwner), 'cities', `${type} own`);
    assert.strictEqual(classifyEvent({ type, cityId: 'c2' }, 'p1', cityOwner), 'rival', `${type} rival`);
  }
  assert.strictEqual(classifyEvent({ type: 'cityCaptured', from: 'p1', to: 'p2' }, 'p1', cityOwner), 'cities');
  assert.strictEqual(classifyEvent({ type: 'cityCaptured', from: 'p2', to: 'p3' }, 'p1', cityOwner), 'rival');
  assert.strictEqual(classifyEvent({ type: 'improvementBuilt', owner: 'p1' }, 'p1', cityOwner), 'cities');
  assert.strictEqual(classifyEvent({ type: 'improvementBuilt', owner: 'p2' }, 'p1', cityOwner), 'rival');
  assert.strictEqual(classifyEvent({ type: 'governmentChanged', playerId: 'p1' }, 'p1', cityOwner), 'cities');

  // research: own only (the engine's filterEvents never delivers rivals')
  assert.strictEqual(classifyEvent({ type: 'techDiscovered', playerId: 'p1' }, 'p1', cityOwner), 'research');
  assert.strictEqual(classifyEvent({ type: 'techDiscovered', playerId: 'p2' }, 'p1', cityOwner), null);

  // world news: always the same class regardless of viewer
  for (const type of ['playerDefeated', 'wonderBuilt', 'wonderLost', 'barbariansSpawned', 'gameOver']) {
    assert.strictEqual(classifyEvent({ type }, 'p1', cityOwner), 'world', type);
  }

  // A33's synthetic save-code event; unknown types are not narrated
  assert.strictEqual(classifyEvent({ type: 'saveCode', code: 'AAAA-BBBB-CCCCC' }, 'p1', cityOwner), 'saves');
  assert.strictEqual(classifyEvent({ type: 'somethingNew' }, 'p1', cityOwner), null);
});

test('LOG_CLASSES: the filter row offers exactly the checkbox classes (world is always-on)', async () => {
  const { LOG_CLASSES } = await load();
  assert.deepStrictEqual(LOG_CLASSES.map(c => c.id),
    ['combat', 'cities', 'research', 'rival', 'saves'],
    'world has no checkbox by design — rare and load-bearing');
});

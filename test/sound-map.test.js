// A77: the pure event → sound-id map (client/ui/sound-map.js). DOM/audio-free.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../client/ui/sound-map.js'); }

// p1's cities are c1; c2 is a rival's — the lookup the map takes
const cityOwner = cid => (cid === 'c1' ? 'p1' : 'p2');

test('combat sounds from the VIEWER vantage: win triumphant, loss sad, rival faint', async () => {
  const { soundForEvent } = await load();
  // I attack and win
  assert.strictEqual(soundForEvent({ type: 'combatResolved', winner: 'attacker', attackerOwner: 'p1', defenderOwner: 'p2' }, 'p1', cityOwner), 'combat-win');
  // I defend and win
  assert.strictEqual(soundForEvent({ type: 'combatResolved', winner: 'defender', attackerOwner: 'p2', defenderOwner: 'p1' }, 'p1', cityOwner), 'combat-win');
  // I attack and lose
  assert.strictEqual(soundForEvent({ type: 'combatResolved', winner: 'defender', attackerOwner: 'p1', defenderOwner: 'p2' }, 'p1', cityOwner), 'combat-loss');
  // I defend and lose
  assert.strictEqual(soundForEvent({ type: 'combatResolved', winner: 'attacker', attackerOwner: 'p2', defenderOwner: 'p1' }, 'p1', cityOwner), 'combat-loss');
  // two rivals clash in my view
  assert.strictEqual(soundForEvent({ type: 'combatResolved', winner: 'attacker', attackerOwner: 'p2', defenderOwner: 'p3' }, 'p1', cityOwner), 'combat-distant');
});

test('city events sound only for my own cities; world news always sounds', async () => {
  const { soundForEvent } = await load();
  assert.strictEqual(soundForEvent({ type: 'cityFounded', cityId: 'c1' }, 'p1', cityOwner), 'found');
  assert.strictEqual(soundForEvent({ type: 'cityFounded', cityId: 'c2' }, 'p1', cityOwner), null);
  assert.strictEqual(soundForEvent({ type: 'cityGrew', cityId: 'c1' }, 'p1', cityOwner), 'grow');
  assert.strictEqual(soundForEvent({ type: 'cityDisorder', cityId: 'c2' }, 'p1', cityOwner), null);
  // wonders + age changes are world news — everyone hears them
  assert.strictEqual(soundForEvent({ type: 'wonderBuilt', cityId: 'c2', wonder: 'pyramids' }, 'p1', cityOwner), 'wonder');
  assert.strictEqual(soundForEvent({ type: 'ageChanged', age: 'renaissance' }, 'p1', cityOwner), 'age');
});

test('elimination + game over are viewpoint-aware', async () => {
  const { soundForEvent } = await load();
  assert.strictEqual(soundForEvent({ type: 'playerDefeated', playerId: 'p1' }, 'p1', cityOwner), 'defeat');
  assert.strictEqual(soundForEvent({ type: 'playerDefeated', playerId: 'p2' }, 'p1', cityOwner), 'elimination');
  assert.strictEqual(soundForEvent({ type: 'gameOver', winner: 'p1' }, 'p1', cityOwner), 'victory');
  assert.strictEqual(soundForEvent({ type: 'gameOver', winner: 'p2' }, 'p1', cityOwner), 'gameover');
});

test('unmapped events are silent; every emitted id is in the SOUND_IDS contract', async () => {
  const { soundForEvent, SOUND_IDS } = await load();
  assert.strictEqual(soundForEvent({ type: 'unitMoved' }, 'p1', cityOwner), null);
  assert.strictEqual(soundForEvent({ type: 'productionSet', cityId: 'c1' }, 'p1', cityOwner), null);
  // exhaustively: no mapped event may emit an id outside the published set
  const events = [
    { type: 'combatResolved', winner: 'attacker', attackerOwner: 'p1', defenderOwner: 'p2' },
    { type: 'combatResolved', winner: 'attacker', attackerOwner: 'p2', defenderOwner: 'p3' },
    { type: 'cityCaptured', from: 'p1', to: 'p2' }, { type: 'cityCaptured', from: 'p2', to: 'p1' },
    { type: 'cityCaptured', from: 'p2', to: 'p3' },
    { type: 'cityFounded', cityId: 'c1' }, { type: 'cityGrew', cityId: 'c1' },
    { type: 'cityStarved', cityId: 'c1' }, { type: 'buildingBuilt', cityId: 'c1' },
    { type: 'cityDisorder', cityId: 'c1' }, { type: 'cityOrderRestored', cityId: 'c1' },
    { type: 'techDiscovered', playerId: 'p1' }, { type: 'wonderBuilt', cityId: 'c1' },
    { type: 'ageChanged', age: 'modern' }, { type: 'playerDefeated', playerId: 'p1' },
    { type: 'playerDefeated', playerId: 'p2' }, { type: 'barbariansSpawned' },
    { type: 'gameOver', winner: 'p1' }, { type: 'gameOver', winner: 'p2' },
    { type: 'governmentChanged', playerId: 'p1' }, { type: 'regentTurn', playerId: 'p1' }
  ];
  for (const e of events) {
    const id = soundForEvent(e, 'p1', cityOwner);
    if (id !== null) assert.ok(SOUND_IDS.includes(id), `${e.type} → ${id} must be in SOUND_IDS`);
  }
});

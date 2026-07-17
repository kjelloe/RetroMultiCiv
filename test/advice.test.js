// A78: the pure first-timer-advice gate (client/ui/advice-gate.js). DOM-free.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../client/ui/advice-gate.js'); }

test('advice shows once per id when enabled for a human player', async () => {
  const { adviceGate } = await load();
  const seen = {};
  assert.strictEqual(adviceGate('settler', seen, true, false), true, 'unseen → shows');
  seen.settler = true;
  assert.strictEqual(adviceGate('settler', seen, true, false), false, 'seen → suppressed');
  assert.strictEqual(adviceGate('city-view', seen, true, false), true, 'a different id still shows');
});

test('advice is suppressed for bots, when disabled, and for empty ids', async () => {
  const { adviceGate } = await load();
  assert.strictEqual(adviceGate('settler', {}, true, true), false, 'webdriver/e2e never sees advice');
  assert.strictEqual(adviceGate('settler', {}, false, false), false, 'tips turned off in ⚙');
  assert.strictEqual(adviceGate('', {}, true, false), false, 'empty id');
  assert.strictEqual(adviceGate(undefined, {}, true, false), false, 'non-string id');
});

test('SEEN_KEY is a stable localStorage key', async () => {
  const { SEEN_KEY } = await load();
  assert.strictEqual(SEEN_KEY, 'retromulticiv-advice-seen');
});

// A99: the three pure state-predicate cards (advice.js, no DOM at import)
async function loadAdvice() { return import('../client/ui/advice.js'); }

// minimal crafted state; owner strings are the player ids
function crafted(o) {
  return Object.assign({ players: { p1: { gold: 100 }, p2: { gold: 100 } }, cities: {}, units: {} }, o || {});
}

test('firstContactWhen: true iff a non-own unit is visible', async () => {
  const { firstContactWhen } = await loadAdvice();
  assert.strictEqual(firstContactWhen(crafted({ units: { u1: { owner: 'p1', type: 'militia', x: 0, y: 0 } } }), 'p1'), false, 'only own units');
  assert.strictEqual(firstContactWhen(crafted({ units: { u1: { owner: 'p1', type: 'militia', x: 0, y: 0 }, u2: { owner: 'p2', type: 'legion', x: 5, y: 5 } } }), 'p1'), true, 'an enemy unit is visible');
  assert.strictEqual(firstContactWhen(crafted({ units: {} }), 'p1'), false, 'no units at all');
  assert.strictEqual(firstContactWhen(crafted({ units: { u2: { owner: 'p2', type: 'legion', x: 5, y: 5 } } }), 'spectator'), false, 'a non-player viewpoint never fires');
});

test('lowTreasuryWhen: gold below the per-city upkeep proxy, only with cities', async () => {
  const { lowTreasuryWhen } = await loadAdvice();
  const twoCities = { c1: { owner: 'p1', x: 0, y: 0 }, c2: { owner: 'p1', x: 2, y: 2 } };
  assert.strictEqual(lowTreasuryWhen(crafted({ cities: twoCities, players: { p1: { gold: 4 } } }), 'p1'), true, '4 < 2 cities * 3');
  assert.strictEqual(lowTreasuryWhen(crafted({ cities: twoCities, players: { p1: { gold: 20 } } }), 'p1'), false, 'comfortable treasury');
  assert.strictEqual(lowTreasuryWhen(crafted({ cities: {}, players: { p1: { gold: 0 } } }), 'p1'), false, 'no cities → no nag');
  assert.strictEqual(lowTreasuryWhen(crafted({}), 'ghost'), false, 'unknown player');
});

test('fortifyGarrisonWhen: an ungarrisoned own city while an enemy is known', async () => {
  const { fortifyGarrisonWhen } = await loadAdvice();
  const enemy = { e: { owner: 'p2', type: 'legion', x: 9, y: 9 } };
  const cityAt = { c1: { owner: 'p1', x: 3, y: 3 } };
  // enemy known + city has no military on its tile → true
  assert.strictEqual(fortifyGarrisonWhen(crafted({ cities: cityAt, units: enemy }), 'p1'), true, 'ungarrisoned while enemy known');
  // a militia sitting on the city tile IS a garrison → false
  assert.strictEqual(fortifyGarrisonWhen(crafted({ cities: cityAt, units: Object.assign({ g: { owner: 'p1', type: 'militia', x: 3, y: 3 } }, enemy) }), 'p1'), false, 'garrisoned');
  // a settler on the tile is NOT a garrison → still true
  assert.strictEqual(fortifyGarrisonWhen(crafted({ cities: cityAt, units: Object.assign({ s: { owner: 'p1', type: 'settlers', x: 3, y: 3 } }, enemy) }), 'p1'), true, 'a civilian is not a garrison');
  // no enemy visible → never fires, even ungarrisoned
  assert.strictEqual(fortifyGarrisonWhen(crafted({ cities: cityAt, units: {} }), 'p1'), false, 'no enemy → no nag');
});

// #1069 audit gate: every pedia link names a real card AND a real concept;
// the two deliberately-unlinked cards stay documented here.
test('ADVICE_PEDIA links are valid both ways; unlinked cards are the known two', async () => {
  const { ADVICE, ADVICE_PEDIA } = await loadAdvice();
  const { CONCEPTS } = await import('../client/ui/pedia-concepts.js');
  const conceptIds = CONCEPTS.map(c => c.id);
  for (const [cardId, conceptId] of Object.entries(ADVICE_PEDIA)) {
    assert.ok(ADVICE[cardId], `link key "${cardId}" must be a real advice card`);
    assert.ok(conceptIds.includes(conceptId), `"${cardId}" links to unknown concept "${conceptId}"`);
  }
  const unlinked = Object.keys(ADVICE).filter(id => ADVICE_PEDIA[id] === undefined).sort();
  assert.deepStrictEqual(unlinked, ['regent', 'unit-selected'],
    'only the two no-matching-concept cards stay unlinked (add the link when the concept lands)');
});

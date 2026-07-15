// A47: the replay theater's major-event extraction — pure, DOM-free.
const test = require('node:test');
const assert = require('node:assert');

async function load() { return import('../client/ui/replay-events.js'); }

const RULESET = {
  techs: { bronze: { name: 'Bronze Working' } },
  wonders: { pyramids: { name: 'The Pyramids' } }
};
const STATE = {
  players: { p1: { name: 'Romans' }, p2: { name: 'Zulus' } },
  cities: {
    c1: { id: 'c1', name: 'Roma', owner: 'p1', x: 5, y: 6 },
    c2: { id: 'c2', name: 'Zimbabwe', owner: 'p2', x: 9, y: 3 }
  }
};

test('majorEvents: keeps the headline classes, drops the minor ones, carries coords', async () => {
  const { majorEvents } = await load();
  const stream = [
    { type: 'cityFounded', cityId: 'c1' },
    { type: 'cityGrew', cityId: 'c1', pop: 2 },        // minor — dropped
    { type: 'unitBuilt', cityId: 'c1', unitType: 'militia' }, // minor
    { type: 'techDiscovered', playerId: 'p1', tech: 'bronze' },
    { type: 'wonderBuilt', cityId: 'c1', wonder: 'pyramids' },
    { type: 'cityCaptured', cityId: 'c2', from: 'p2', to: 'p1' },
    { type: 'cityDisorder', cityId: 'c1' },            // minor
    { type: 'barbariansSpawned' },
    { type: 'playerDefeated', playerId: 'p2' },
    { type: 'gameOver', winner: 'p1' }
  ];
  const got = majorEvents(stream, STATE, RULESET);
  assert.deepStrictEqual(got.map(e => e.icon),
    ['🏛', '🔬', '🏆', '🏰', '🏴', '💀', '🏁'], 'only the seven headline classes survive, in order');
  assert.match(got[0].text, /Romans founds Roma/);
  assert.deepStrictEqual(got[0].loc, { x: 5, y: 6 }, 'the founded city carries its coords for fly-to');
  assert.match(got[1].text, /Romans discovers Bronze Working/);
  assert.match(got[2].text, /Romans completes The Pyramids/);
  assert.match(got[3].text, /Romans captures Zimbabwe from Zulus/);
  assert.deepStrictEqual(got[3].loc, { x: 9, y: 3 });
  assert.match(got[6].text, /game over — Romans wins/);
});

test('majorEvents: unknown/empty streams yield nothing', async () => {
  const { majorEvents } = await load();
  assert.deepStrictEqual(majorEvents([], STATE, RULESET), []);
  assert.deepStrictEqual(majorEvents([{ type: 'somethingNew' }], STATE, RULESET), []);
});

// The EVENT CATALOG (reviewer #1205/#1206): EVENT_TYPES below is the
// canonical list of every event the engine emits, by emitting module. It is
// the single source docs/02 §6 references — this gate keeps it honest three
// ways: (1) every fixture row exists in its named engine file, (2) every
// `type:` literal in the event-emitting engine files is in the fixture (a new
// event forces a catalog decision), (3) the two client classifiers
// (turnlog-classes classifyEvent, sound-map soundForEvent) return a DEFINED
// decision for every type — an explicit null is deliberate silence, an
// undefined is an unhandled hole.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// type -> the engine module that emits it (docs/02 §6 mirrors this table)
const EVENT_TYPES = {
  unitMoved: 'movement', unitFortified: 'movement', unitWaited: 'movement',
  unitDisbanded: 'movement', unitLoaded: 'movement', unitUnloaded: 'movement',
  workStarted: 'improvements', improvementBuilt: 'improvements', pillaged: 'improvements',
  turnStarted: 'index', turnEnded: 'index', ageChanged: 'index',
  cityFounded: 'cities', productionSet: 'cities', workersSet: 'cities',
  productionBought: 'cities', unitBuilt: 'cities', buildingBuilt: 'cities',
  buildingSold: 'cities', wonderBuilt: 'cities', wonderHelped: 'cities',
  wonderLost: 'cities', cityGrew: 'cities', cityStarved: 'cities', cityDisbanded: 'cities',
  combatResolved: 'combat', promoted: 'combat', cityCaptured: 'combat',
  unitConsumed: 'combat', cargoLost: 'combat',
  researchSet: 'tech', ratesSet: 'tech', techDiscovered: 'tech',
  governmentChanged: 'government', revolutionStarted: 'government',
  cityDisorder: 'happiness', cityOrderRestored: 'happiness',
  barbariansSpawned: 'barbarians', sailsSpotted: 'barbarians', barbariansLanded: 'barbarians',
  pollutionSpread: 'pollution', cityMeltdown: 'pollution', terrainWarmed: 'pollution',
  airCrashed: 'air',
  gameOver: 'score', playerDefeated: 'score',
  ssPartBuilt: 'cities', shipLaunched: 'spaceship',
  shipDestroyed: 'combat', spaceVictory: 'spaceship',
  tradeRouteEstablished: 'trade',
  unitUpgraded: 'upgrade',
  debugCommand: 'debug',
  hutEntered: 'huts', ransomPaid: 'combat',
  // D1 diplomacy: UPPER_SNAKE per the ally-specified shapes (spec §3) + the
  // committed D2 client classifier — a deliberate family exception to camelCase.
  WAR_DECLARED: 'diplomacy', PEACE_TREATY_SIGNED: 'diplomacy', TREATY_BROKEN: 'diplomacy',
  FIRST_CONTACT: 'diplomacy'
};
// the event-EMITTING engine modules (ai/rng/etc. construct commands, not events)
const EMITTING = ['movement', 'improvements', 'index', 'cities', 'combat',
  'tech', 'government', 'happiness', 'barbarians', 'pollution', 'air', 'score', 'spaceship', 'trade', 'upgrade', 'debug', 'huts', 'diplomacy'];

const src = {};
for (const m of EMITTING) {
  src[m] = fs.readFileSync(path.join(__dirname, '..', 'engine', m + '.js'), 'utf8');
}

test('every catalog row is emitted by its named engine module', () => {
  for (const [type, mod] of Object.entries(EVENT_TYPES)) {
    assert.ok(src[mod].includes(`type: '${type}'`),
      `${type}: not found in engine/${mod}.js — stale catalog row`);
  }
});

test('every engine event literal is in the catalog (a new event forces a decision)', () => {
  for (const m of EMITTING) {
    for (const match of src[m].matchAll(/type: '([A-Za-z_]+)'/g)) {
      assert.ok(EVENT_TYPES[match[1]] !== undefined,
        `engine/${m}.js emits '${match[1]}' — add it to the EVENT_TYPES catalog `
        + '(and give classifyEvent + soundForEvent their decisions)');
    }
  }
});

test('classifyEvent and soundForEvent decide EVERY catalog type (null = deliberate silence)', async () => {
  const { classifyEvent } = await import('../client/ui/turnlog-classes.js');
  const { soundForEvent } = await import('../client/ui/sound-map.js');
  const cityOwner = () => 'p1';
  for (const type of Object.keys(EVENT_TYPES)) {
    // a kitchen-sink event: enough fields for any branch to read safely
    const e = {
      type, playerId: 'p1', cityId: 'c1', unitId: 'u1', owner: 'p1',
      attackerOwner: 'p1', defenderOwner: 'p2', winner: 'attacker',
      from: 'p2', to: 'p1', x: 0, y: 0, turn: 1
    };
    assert.notStrictEqual(classifyEvent(e, 'p1', cityOwner), undefined,
      `classifyEvent has no decision for '${type}'`);
    assert.notStrictEqual(soundForEvent(e, 'p1', cityOwner), undefined,
      `soundForEvent has no decision for '${type}'`);
  }
});

module.exports = { EVENT_TYPES };

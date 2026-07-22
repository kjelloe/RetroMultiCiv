// A58 "pedia complete" acceptance (specs/a58-pedia-acceptance.md), items 1-2,
// the terrain-coverage pattern: a future un-pedia'd concept fails the suite.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function concepts() { return import('../client/ui/pedia-concepts.js'); }
async function blurbs() { return import('../client/ui/unit-building-blurbs.js'); }

// ITEM 2: the concept list covers the required topics. Each topic maps to the
// concept id that carries it; a missing id fails here (this is the real teeth).
const REQUIRED_TOPICS = {
  'city management': 'cities',
  happiness: 'happiness',
  disorder: 'disorder',
  corruption: 'corruption',
  'combat + veterans': 'combat',      // veterancy carries the veteran half
  'zones of control': 'zoc',
  'fog of war': 'fog',
  'trade routes': 'traderoutes',
  'specialist: entertainer': 'entertainer',
  'specialist: tax collector': 'taxman',
  'specialist: scientist': 'scientist',
  'diplomacy + reputation': 'diplomacy',
  'space race': 'spacerace',
  regency: 'regency',
  'game code': 'gamecode',
  'recordings / saves': 'recordings'
};

test('A58 item 2: the concept list covers every required topic', async () => {
  const { CONCEPTS } = await concepts();
  const ids = CONCEPTS.map(c => c.id);
  for (const [topic, id] of Object.entries(REQUIRED_TOPICS)) {
    assert.ok(ids.includes(id), `topic "${topic}" needs a pedia concept "${id}"`);
  }
  // the veteran half of "combat + veterans" also has its own entry
  assert.ok(ids.includes('veterancy'), 'the veterancy concept must exist');
});

test('A58 item 1: every concept is well-formed + unique; no orphan blurbs', async () => {
  const { CONCEPTS } = await concepts();
  const seen = {};
  for (const c of CONCEPTS) {
    assert.ok(c.id && c.name && c.body, `concept ${JSON.stringify(c.id)} needs id + name + body`);
    assert.ok(c.body.length > 40, `concept "${c.id}" body is too thin to be an article`);
    assert.ok(!seen[c.id], `duplicate concept id "${c.id}"`);
    seen[c.id] = true;
  }
  // the pedia renders an ARTICLE for every units/buildings/wonders/techs/
  // governments/terrain id straight from the ruleset (pedia.js CATS), so item 1
  // coverage is structural; here we pin that the layered BLURB content never
  // names an id the ruleset does not have (a typo would silently show nothing).
  const { UNIT_BLURBS, BUILDING_BLURBS } = await blurbs();
  for (const id of Object.keys(UNIT_BLURBS)) {
    assert.ok(RULESET.units[id], `UNIT_BLURBS names an id "${id}" that is not a unit`);
  }
  for (const id of Object.keys(BUILDING_BLURBS)) {
    assert.ok(RULESET.buildings[id] || RULESET.wonders[id], `BUILDING_BLURBS names an id "${id}" that is neither a building nor a wonder`);
  }
});

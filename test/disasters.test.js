// CIV1 DISASTERS (#2082, user-ruled authentic-ON): 7 per-city calamities (meltdown is
// A91's). Each fixture ISOLATES one disaster via terrain + prevention so the single
// eligible kind fires deterministically (baseChancePct forced to 100). Replay-fixture-
// FIRST (#1989): the pre-disasters engine had none of this.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  return import('../engine/disasters.js');
}

// a ruleset where the per-city roll ALWAYS fires (baseChancePct 100) — so the fixtures
// exercise the selection + effect deterministically.
function always() {
  const r = JSON.parse(JSON.stringify(RULESET));
  r.rules.disasters.baseChancePct = 100;
  return r;
}

// board: 7x7, `terrain` everywhere except optional feature tiles set by `feats`.
function board(terrain, feats) {
  const W = 7, H = 7, tiles = [];
  for (let i = 0; i < W * H; i++) tiles.push({ t: terrain });
  for (const f of feats || []) tiles[f.y * W + f.x] = f.tile;
  return { width: W, height: H, wrapX: false, tiles };
}

function craft(map, cityOverrides, techs, gold) {
  return {
    version: 1, turn: 200, year: 1000, activePlayer: 'p1', playerOrder: ['p1'],
    map, units: {}, wonders: {}, nextUnitId: 10, nextCityId: 5,
    cities: { c1: Object.assign({ id: 'c1', name: 'C', owner: 'p1', x: 3, y: 3, pop: 9, food: 20, shields: 15, buildings: [], producing: { kind: 'building', id: 'temple' } }, cityOverrides) },
    cityOrder: ['c1'],
    players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: gold === undefined ? 100 : gold, techs: techs || [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}

test('famine: an ungarnished inland city loses 33% pop (floor)', async () => {
  const { process } = await load();
  // grassland everywhere (no terrain gate); aqueduct prevents fire+plague; no granary
  // -> famine is the ONLY eligible disaster.
  const st = craft(board('grassland'), { pop: 9, buildings: ['aqueduct'] });
  const events = [];
  process(st, always(), events);
  assert.strictEqual(st.cities.c1.pop, 7, 'pop 9 - idiv(9*33,100)=2 -> 7');
  assert.ok(events.some(e => e.type === 'disasterStruck' && e.kind === 'famine'), 'famine struck');
});

test('famine: a size-1 city is immune (33% floors to 0)', async () => {
  const { process } = await load();
  const st = craft(board('grassland'), { pop: 1, buildings: ['aqueduct'] });
  process(st, always(), []);
  assert.strictEqual(st.cities.c1.pop, 1, 'idiv(1*33,100)=0 -> size-1 survives');
});

test('famine: a Granary prevents it (no eligible disaster -> no rng, no strike)', async () => {
  const { process } = await load();
  const st = craft(board('grassland'), { pop: 9, buildings: ['aqueduct', 'granary'] });
  const before = st.rngState;
  const events = [];
  process(st, always(), events);
  assert.strictEqual(st.cities.c1.pop, 9, 'no famine');
  assert.strictEqual(events.length, 0, 'no disaster');
  assert.strictEqual(st.rngState, before, 'zero rng drawn when nothing is eligible');
});

test('workers>pop: a pop-losing disaster trims the workers array to the new pop', async () => {
  const { process } = await load();
  // pop 9 with a FULL manual worker assignment; aqueduct -> famine is the only eligible
  // disaster -> pop 9 - idiv(9*33,100)=2 -> 7. The workers array MUST trim to the new pop
  // (starvation + settler pop-cost already do; disasters were the gap — reviewer #2314, the
  // "workers array longer than pop" invariant that aborted archipelago sims).
  const st = craft(board('grassland'), { pop: 9, buildings: ['aqueduct'], workers: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  process(st, always(), []);
  assert.strictEqual(st.cities.c1.pop, 7, 'famine 9 -> 7');
  assert.ok(Array.isArray(st.cities.c1.workers) && st.cities.c1.workers.length <= st.cities.c1.pop,
    `the sim-driver invariant (workers.length <= pop) must hold — got ${st.cities.c1.workers && st.cities.c1.workers.length} > ${st.cities.c1.pop}`);
  assert.strictEqual(st.cities.c1.workers.length, 7, 'workers trimmed to exactly the new pop');
});

test('fire: destroys one random building (Aqueduct absent)', async () => {
  const { process } = await load();
  // granary prevents famine; Medicine tech prevents plague (NOT aqueduct, which would
  // also prevent fire); no ocean -> fire is the only eligible. buildings present so fire
  // has something to destroy.
  const st = craft(board('grassland'), { pop: 5, buildings: ['granary', 'barracks'] }, ['medicine']);
  const events = [];
  process(st, always(), events);
  const e = events.find(x => x.type === 'disasterStruck');
  assert.ok(e && e.kind === 'fire', 'fire struck');
  assert.strictEqual(st.cities.c1.buildings.length, 1, 'one building destroyed');
  assert.ok(e.buildingLost === 'granary' || e.buildingLost === 'barracks', 'a real building was named');
});

test('pirate: a coastal city loses gold + food/shield stocks (Barracks absent)', async () => {
  const { process } = await load();
  // one ocean neighbor -> pirate eligible; aqueduct+granary prevent fire/plague/famine
  // -> pirate is the only eligible.
  const map = board('grassland', [{ x: 3, y: 2, tile: { t: 'ocean' } }]);
  const st = craft(map, { pop: 6, buildings: ['aqueduct', 'granary'], food: 30, shields: 20 }, [], 200);
  const events = [];
  process(st, always(), events);
  assert.ok(events.some(e => e.type === 'disasterStruck' && e.kind === 'pirate'), 'pirate struck');
  assert.strictEqual(st.players.p1.gold, 100, '50% of 200 gold stolen');
  assert.strictEqual(st.cities.c1.food, 0, 'food stock reset');
  assert.strictEqual(st.cities.c1.shields, 0, 'shield stock reset');
});

test('flood: a riverside city loses 25% pop (City Walls absent)', async () => {
  const { process } = await load();
  const map = board('grassland', [{ x: 3, y: 4, tile: { t: 'grassland', river: true } }]);
  const st = craft(map, { pop: 8, buildings: ['aqueduct', 'granary'] }); // isolate flood
  const events = [];
  process(st, always(), events);
  assert.ok(events.some(e => e.type === 'disasterStruck' && e.kind === 'flood'), 'flood struck');
  assert.strictEqual(st.cities.c1.pop, 6, 'pop 8 - idiv(8*25,100)=2 -> 6');
});

test('volcano: a mountain-side city loses a building AND 33% pop (Temple absent)', async () => {
  const { process } = await load();
  const map = board('grassland', [{ x: 3, y: 2, tile: { t: 'mountains' } }]);
  const st = craft(map, { pop: 9, buildings: ['aqueduct', 'granary', 'barracks'] }); // isolate volcano
  const events = [];
  process(st, always(), events);
  const e = events.find(x => x.type === 'disasterStruck');
  assert.ok(e && e.kind === 'volcano', 'volcano struck');
  assert.strictEqual(st.cities.c1.pop, 7, 'pop 9 - idiv(9*33,100)=2 -> 7');
  assert.strictEqual(st.cities.c1.buildings.length, 2, 'one building destroyed too');
});

test('earthquake: a hill-side city loses a building and CANNOT be prevented', async () => {
  const { process } = await load();
  const map = board('grassland', [{ x: 3, y: 2, tile: { t: 'hills' } }]);
  // every preventable disaster blocked (aqueduct+granary; no ocean/river/mountain) ->
  // earthquake is the only eligible and has NO prevention.
  const st = craft(map, { pop: 5, buildings: ['aqueduct', 'granary', 'temple'] });
  const events = [];
  process(st, always(), events);
  const e = events.find(x => x.type === 'disasterStruck');
  assert.ok(e && e.kind === 'earthquake', 'earthquake struck (unpreventable)');
  assert.strictEqual(st.cities.c1.buildings.length, 2, 'one building destroyed');
});

test('plague: the Medicine advance prevents it (building-OR-tech)', async () => {
  const { process } = await load();
  // no aqueduct (so fire+plague not building-prevented) but Medicine tech -> plague gone;
  // granary prevents famine; fire remains eligible -> assert it is NOT plague.
  const st = craft(board('grassland'), { pop: 8, buildings: ['granary'] }, ['medicine']);
  const events = [];
  process(st, always(), events);
  assert.ok(!events.some(e => e.kind === 'plague'), 'Medicine blocks plague');
});

test('disabled: disastersEnabled=false draws zero rng and strikes nothing', async () => {
  const { process } = await load();
  const st = craft(board('grassland'), { pop: 9 });
  const before = st.rngState;
  const events = [];
  process(st, RULESET, events); // base ruleset: disastersEnabled default true, but...
  // force disabled via a clone
  const r = JSON.parse(JSON.stringify(RULESET));
  r.rules.disastersEnabled = false;
  const st2 = craft(board('grassland'), { pop: 9 });
  const b2 = st2.rngState;
  process(st2, r, []);
  assert.strictEqual(st2.cities.c1.pop, 9, 'no disaster when disabled');
  assert.strictEqual(st2.rngState, b2, 'zero rng drawn when disabled');
});

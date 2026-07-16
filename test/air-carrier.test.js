// A72 slice 3: carriers base air units. A carrier (data `airCapacity`) is a
// mobile airbase — an air unit ending the turn on a friendly carrier with a
// free slot is BASED (aboard the carrier, fuel reset), reusing A69's aboard
// machinery (it rides the carrier, is hidden from combat, drowns if the carrier
// sinks, and flies off on its next move). A full carrier bases no more; those
// air units keep burning fuel. Cross-language: test/scenarios/023-air-carrier.json.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() {
  const { createEngine } = await import('../engine/index.js');
  return { createEngine, engine: createEngine(RULESET) };
}

// columns 0-2 grassland, 3-4 ocean. A carrier at (3,2); air units fly onto it.
function craft(units, players) {
  const W = 5, H = 5;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push({ t: x >= 3 ? 'ocean' : 'grassland' });
  return {
    version: 1, turn: 5, year: -3000, activePlayer: 'p1', playerOrder: Object.keys(players || { p1: 1 }),
    map: { width: W, height: H, wrapX: false, tiles },
    units, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: players || { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: 1
  };
}

const carrier = () => ({ id: 'cv', type: 'carrier', owner: 'p1', x: 3, y: 2, moves: 5, fortified: false, veteran: false });
const fighterAt = (x, y, extra) => Object.assign({ id: 'f1', type: 'fighter', owner: 'p1', x, y, moves: 10, fortified: false, veteran: false }, extra || {});

test('A72: an air unit ending on a friendly carrier bases (aboard, fuel reset)', async () => {
  const { engine } = await load();
  // fighter already 1 turn aloft, now on the carrier tile
  const res = engine.applyCommand(craft({ cv: carrier(), f1: fighterAt(3, 2, { aloft: 1 }) }), { type: 'endTurn', playerId: 'p1' });
  assert.ok(res.state.units.f1, 'the fighter is safe on the carrier');
  assert.strictEqual(res.state.units.f1.aboard, 'cv', 'based on the carrier');
  assert.strictEqual(res.state.units.f1.aloft, undefined, 'fuel reset (aloft cleared)');
});

test('A72: a full carrier bases no more — the overflow air unit burns fuel', async () => {
  const { createEngine } = await load();
  // shrink the carrier to one slot; it already holds one air unit
  const rs = JSON.parse(JSON.stringify(RULESET));
  rs.units.carrier.airCapacity = 1;
  const eng = createEngine(rs);
  // the sole slot is taken; the overflow unit is a bomber (fuel 2) at aloft 1,
  // so it survives one more turn airborne (aloft 2) instead of being based.
  const st = craft({
    cv: carrier(),
    a1: { id: 'a1', type: 'fighter', owner: 'p1', x: 3, y: 2, moves: 10, fortified: false, veteran: false, aboard: 'cv' },
    b2: { id: 'b2', type: 'bomber', owner: 'p1', x: 3, y: 2, moves: 8, fortified: false, veteran: false, aloft: 1 }
  });
  const res = eng.applyCommand(st, { type: 'endTurn', playerId: 'p1' });
  assert.strictEqual(res.state.units.b2.aboard, undefined, 'no free slot: the bomber is not based');
  assert.strictEqual(res.state.units.b2.aloft, 2, 'it kept burning fuel');
});

test('A72: an aboard air unit flies off the carrier on its next move', async () => {
  const { engine } = await load();
  const st = craft({ cv: carrier(), f1: fighterAt(3, 2, { aboard: 'cv', moves: 0 }) });
  st.units.f1.moves = 10; // its turn to take off
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p1', unitId: 'f1', dir: 'W' });
  assert.ok(res.ok, `take-off ok: ${res.reason}`);
  assert.strictEqual(res.state.units.f1.aboard, undefined, 'took off (no longer aboard)');
  assert.strictEqual(res.state.units.f1.x, 2, 'flew west onto land');
});

test('A72: a sunk carrier drowns its based air wing (A69 reuse)', async () => {
  const { engine } = await load();
  const players = {
    p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
    p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
  };
  const st = craft({
    cv: carrier(),
    f1: fighterAt(3, 2, { aboard: 'cv' }),
    e1: { id: 'e1', type: 'battleship', owner: 'p2', x: 4, y: 2, moves: 4, fortified: false, veteran: false }
  }, players);
  st.activePlayer = 'p2';
  const res = engine.applyCommand(st, { type: 'moveUnit', playerId: 'p2', unitId: 'e1', dir: 'W' });
  assert.ok(res.ok);
  if (res.state.units.cv === undefined) {
    assert.strictEqual(res.state.units.f1, undefined, 'the air wing went down with the carrier');
  }
});

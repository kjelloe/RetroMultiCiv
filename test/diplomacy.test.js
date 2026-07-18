// D1 diplomacy (specs/d1-diplomacy.md §7): war/peace states + the declare/offer/
// accept/reject commands + the combat reframe (atPeace attack gate, war-gated
// blockade). notMet is DEFERRED to D2 (no engine met-state) — NOT tested here.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let engine, relationOf, reputationOf;
test('load', async () => {
  const { createEngine } = await import('../engine/index.js');
  ({ relationOf, reputationOf } = await import('../engine/diplomacy.js'));
  engine = createEngine(RULESET);
});

function baseState(over) {
  const tiles = [];
  for (let i = 0; i < 35; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 10, year: -3000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width: 7, height: 5, wrapX: false, tiles },
    units: {}, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: {
      p1: { id: 'p1', name: 'Rome', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'Egypt', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  }, over || {});
}
const dip = (playerId, kind, target, terms) => ({ type: 'diplomacy', kind, playerId, target, terms });

test('default is war: an empty state reads war (omit-safe, byte-identical to pre-D1)', () => {
  const s = baseState();
  assert.strictEqual(relationOf(s, 'p1', 'p2'), 'war');
  assert.strictEqual(s.relations, undefined, 'createGame/crafted states stamp no relations');
});

test('declare war: sets an explicit war entry + WAR_DECLARED', () => {
  const r = engine.applyCommand(baseState(), dip('p1', 'declare', 'p2'));
  assert.ok(r.ok, r.reason);
  assert.strictEqual(relationOf(r.state, 'p1', 'p2'), 'war');
  assert.strictEqual(r.state.relations['p1|p2'].state, 'war');
  assert.ok(r.events.some(e => e.type === 'WAR_DECLARED' && e.reason === 'border_pressure'));
  assert.ok(!r.events.some(e => e.type === 'TREATY_BROKEN'), 'no treaty was broken (was default war)');
});

test('offer -> accept: peace signed with expiresTurn (timed) + PEACE_TREATY_SIGNED', () => {
  let s = baseState();
  const off = engine.applyCommand(s, dip('p1', 'offer', 'p2', { peace: true, duration: 20 }));
  assert.ok(off.ok, off.reason);
  assert.strictEqual(off.events.length, 0, 'an offer emits nothing until answered');
  s = off.state;
  s.activePlayer = 'p2'; // the target answers
  const acc = engine.applyCommand(s, dip('p2', 'accept', 'p1'));
  assert.ok(acc.ok, acc.reason);
  assert.strictEqual(relationOf(acc.state, 'p1', 'p2'), 'peace');
  const entry = acc.state.relations['p1|p2'];
  assert.strictEqual(entry.state, 'peace');
  assert.strictEqual(entry.expiresTurn, 30, 'turn 10 + duration 20');
  assert.strictEqual(entry.offer, undefined, 'accept clears the pending offer');
  assert.ok(acc.events.some(e => e.type === 'PEACE_TREATY_SIGNED' && e.expiresTurn === 30));
});

test('perpetual peace: an offer with no duration signs a treaty with no expiresTurn (Civ1 default)', () => {
  let s = baseState();
  s = engine.applyCommand(s, dip('p1', 'offer', 'p2', { peace: true })).state;
  s.activePlayer = 'p2';
  const acc = engine.applyCommand(s, dip('p2', 'accept', 'p1'));
  assert.ok(acc.ok, acc.reason);
  assert.strictEqual(acc.state.relations['p1|p2'].expiresTurn, undefined, 'perpetual = no expiresTurn');
  assert.strictEqual(relationOf(acc.state, 'p1', 'p2'), 'peace');
});

test('timed peace lapses to war on expiry with NO mutation/event (R2 expiry derivation)', () => {
  let s = baseState();
  s = engine.applyCommand(s, dip('p1', 'offer', 'p2', { peace: true, duration: 5 })).state;
  s.activePlayer = 'p2';
  s = engine.applyCommand(s, dip('p2', 'accept', 'p1')).state; // expiresTurn = 15
  assert.strictEqual(relationOf(s, 'p1', 'p2'), 'peace');
  s.turn = 15; // reached expiry
  assert.strictEqual(relationOf(s, 'p1', 'p2'), 'war', 'derives war at expiresTurn, no mutation needed');
  assert.strictEqual(s.relations['p1|p2'].state, 'peace', 'the stored entry is untouched (lazy expiry)');
});

test('declare while at peace: breaks the treaty (TREATY_BROKEN + reputation-)', () => {
  let s = baseState();
  s = engine.applyCommand(s, dip('p1', 'offer', 'p2', { peace: true, duration: 20 })).state;
  s.activePlayer = 'p2';
  s = engine.applyCommand(s, dip('p2', 'accept', 'p1')).state;
  assert.strictEqual(relationOf(s, 'p1', 'p2'), 'peace');
  s.activePlayer = 'p1';
  const brk = engine.applyCommand(s, dip('p1', 'declare', 'p2'));
  assert.ok(brk.ok, brk.reason);
  assert.strictEqual(relationOf(brk.state, 'p1', 'p2'), 'war');
  assert.ok(brk.events.some(e => e.type === 'WAR_DECLARED'));
  assert.ok(brk.events.some(e => e.type === 'TREATY_BROKEN' && e.penalty === 'reputation_loss'));
  assert.strictEqual(reputationOf(brk.state, 'p1'), -1, 'breaking peace decrements reputation');
});

test('reject clears the offer with no state change', () => {
  let s = baseState();
  s = engine.applyCommand(s, dip('p1', 'offer', 'p2', { peace: true, duration: 20 })).state;
  s.activePlayer = 'p2';
  const rej = engine.applyCommand(s, dip('p2', 'reject', 'p1'));
  assert.ok(rej.ok, rej.reason);
  assert.strictEqual(rej.state.relations['p1|p2'].offer, undefined, 'offer cleared');
  assert.strictEqual(relationOf(rej.state, 'p1', 'p2'), 'war', 'still war (reject signs nothing)');
  assert.strictEqual(rej.events.length, 0);
});

test('rejections: selfTarget, barbarian target, noSuchOffer, alreadyWar, notYourTurn', () => {
  const s = baseState();
  assert.strictEqual(engine.applyCommand(s, dip('p1', 'declare', 'p1')).reason, 'selfTarget');
  assert.strictEqual(engine.applyCommand(s, dip('p1', 'declare', 'barb')).reason, 'cannotDiplomacyBarbarians');
  assert.strictEqual(engine.applyCommand(s, dip('p1', 'accept', 'p2')).reason, 'noSuchOffer');
  assert.strictEqual(engine.applyCommand(s, dip('p1', 'reject', 'p2')).reason, 'noSuchOffer');
  const off = baseState({ activePlayer: 'p2' });
  assert.strictEqual(engine.applyCommand(off, dip('p1', 'declare', 'p2')).reason, 'notYourTurn');
  // alreadyWar: an explicit war entry rejects a re-declare
  const warred = engine.applyCommand(s, dip('p1', 'declare', 'p2')).state;
  assert.strictEqual(engine.applyCommand(warred, dip('p1', 'declare', 'p2')).reason, 'alreadyWar');
});

// --- the combat reframe ---
function twoArmies(rel) {
  // p1 legion adjacent to a p2 militia + a p2 city; optionally at peace
  const s = baseState({
    units: {
      a: { id: 'a', type: 'legion', owner: 'p1', x: 2, y: 2, moves: 1, fortified: false, veteran: false },
      d: { id: 'd', type: 'militia', owner: 'p2', x: 3, y: 2, moves: 1, fortified: false, veteran: false }
    },
    cities: { c2: { id: 'c2', name: 'Thebes', owner: 'p2', x: 3, y: 3, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c2']
  });
  if (rel === 'peace') s.relations = { 'p1|p2': { state: 'peace', treatyTurn: 5 } };
  return s;
}

test('atPeace: a unit cannot attack a peace civ; at war (default) it can', () => {
  const war = engine.applyCommand(twoArmies('war'), { type: 'moveUnit', playerId: 'p1', unitId: 'a', dir: 'E' });
  assert.ok(war.ok, `attack at war must resolve, got ${war.reason}`); // an attack occurred
  const peace = engine.applyCommand(twoArmies('peace'), { type: 'moveUnit', playerId: 'p1', unitId: 'a', dir: 'E' });
  assert.strictEqual(peace.reason, 'atPeace', 'attacking a peace civ is rejected');
});

test('atPeace: cannot capture a peace civ undefended city; war unchanged', () => {
  // move p1 legion onto the undefended p2 city (move the defender away first via a crafted state)
  const mk = rel => {
    const s = baseState({
      units: { a: { id: 'a', type: 'legion', owner: 'p1', x: 3, y: 2, moves: 1, fortified: false, veteran: false } },
      cities: { c2: { id: 'c2', name: 'Thebes', owner: 'p2', x: 3, y: 3, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c2']
    });
    if (rel === 'peace') s.relations = { 'p1|p2': { state: 'peace', treatyTurn: 5 } };
    return s;
  };
  const peace = engine.applyCommand(mk('peace'), { type: 'moveUnit', playerId: 'p1', unitId: 'a', dir: 'S' });
  assert.strictEqual(peace.reason, 'atPeace', 'capturing a peace city is rejected');
  const war = engine.applyCommand(mk('war'), { type: 'moveUnit', playerId: 'p1', unitId: 'a', dir: 'S' });
  assert.ok(war.ok, `capturing an undefended enemy city at war must succeed, got ${war.reason}`);
  assert.strictEqual(war.state.cities.c2.owner, 'p1', 'city captured at war');
});

test('A79 blockade is war-gated: an enemy on a worked tile blocks at WAR, not at PEACE', async () => {
  const { candidateTiles } = await import('../engine/cities.js');
  // p1 city at (3,2); a p2 unit on a fat-cross tile (3,1)
  const mk = rel => {
    const s = baseState({
      units: { e: { id: 'e', type: 'militia', owner: 'p2', x: 3, y: 1, moves: 1, fortified: false, veteran: false } },
      cities: { c1: { id: 'c1', name: 'Rome', owner: 'p1', x: 3, y: 2, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c1']
    });
    if (rel === 'peace') s.relations = { 'p1|p2': { state: 'peace', treatyTurn: 5 } };
    return s;
  };
  const warTiles = candidateTiles(mk('war'), mk('war').cities.c1, RULESET);
  const peaceTiles = candidateTiles(mk('peace'), mk('peace').cities.c1, RULESET);
  const idx = 1 * 7 + 3; // (3,1)
  assert.ok(!warTiles.some(t => t.idx === idx), 'at war the enemy tile is blockaded (dropped)');
  assert.ok(peaceTiles.some(t => t.idx === idx), 'at peace the tile is workable (trade flows)');
});

test('prune on elimination: treaties/offers with a dead civ are dropped (dead-partner class)', async () => {
  const { pruneDiplomacy } = await import('../engine/diplomacy.js');
  const { checkGameEnd } = await import('../engine/score.js');
  // direct: pruning p2 drops every pair containing p2, leaves the rest
  const s = baseState();
  s.players.p3 = { id: 'p3', name: 'Greece', color: '#0f0', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 };
  s.playerOrder = ['p1', 'p2', 'p3'];
  s.relations = {
    'p1|p2': { state: 'peace', treatyTurn: 5, expiresTurn: 30 },
    'p1|p3': { state: 'war', treatyTurn: 3 },
    'p2|p3': { state: 'war', treatyTurn: 4, offer: { from: 'p3', turn: 4 } }
  };
  pruneDiplomacy(s, 'p2');
  assert.strictEqual(s.relations['p1|p2'], undefined, 'p1|p2 pruned (contains p2)');
  assert.strictEqual(s.relations['p2|p3'], undefined, 'p2|p3 pruned (contains p2)');
  assert.ok(s.relations['p1|p3'] !== undefined, 'p1|p3 survives (no p2)');

  // via elimination: p2 alive with no assets -> checkGameEnd eliminates + prunes
  const e = baseState();
  e.players.p1.alive = true; e.players.p2.alive = true;
  e.units = { u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 1, y: 1, moves: 1, fortified: false, veteran: false } };
  e.relations = { 'p1|p2': { state: 'peace', treatyTurn: 5 } };
  const events = [];
  checkGameEnd(e, RULESET, events);
  assert.ok(events.some(ev => ev.type === 'playerDefeated' && ev.playerId === 'p2'), 'p2 eliminated');
  assert.strictEqual(e.relations['p1|p2'], undefined, 'the dead civ treaty pruned on elimination');
});

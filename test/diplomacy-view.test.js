// D2 (specs/d1-diplomacy.md) — the client legibility reads + presentation.
// Pure (DOM-free) so the war/peace/expiry defaults, the status labels, the
// treaty-action mirror, and the event fog all pin in node without a browser.
// Everything is DEFENSIVE against omit-safe state (no relations map / no
// reputation) — the spec DEFAULT is war, reputation 0.
const test = require('node:test');
const assert = require('node:assert');

let D;
test.before(async () => { D = await import('../shared/diplomacy-view.js'); });

test('pairKey: sorted, order-independent', () => {
  assert.strictEqual(D.pairKey('p1', 'p6'), 'p1|p6');
  assert.strictEqual(D.pairKey('p6', 'p1'), 'p1|p6');
});

test('relationOf: absent = war (today\'s world), explicit peace, lapsed = war', () => {
  assert.strictEqual(D.relationOf({ turn: 5 }, 'p1', 'p2'), 'war', 'no relations map → war');
  assert.strictEqual(D.relationOf({ turn: 5, relations: {} }, 'p1', 'p2'), 'war', 'empty map → war');
  const peace = { turn: 10, relations: { 'p1|p2': { state: 'peace', treatyTurn: 8 } } };
  assert.strictEqual(D.relationOf(peace, 'p1', 'p2'), 'peace', 'perpetual peace holds');
  assert.strictEqual(D.relationOf(peace, 'p2', 'p1'), 'peace', 'order-independent');
  const timed = { turn: 20, relations: { 'p1|p2': { state: 'peace', treatyTurn: 8, expiresTurn: 20 } } };
  assert.strictEqual(D.relationOf(timed, 'p1', 'p2'), 'war', 'a lapsed timed treaty derives war (no mutation)');
  const live = { turn: 19, relations: { 'p1|p2': { state: 'peace', treatyTurn: 8, expiresTurn: 20 } } };
  assert.strictEqual(D.relationOf(live, 'p1', 'p2'), 'peace', 'one turn before expiry still peace');
});

test('reputationOf: default 0, reads the int when present', () => {
  // state.players always exists in engine states (the reputationOf contract)
  assert.strictEqual(D.reputationOf({ players: {} }, 'p1'), 0, 'no such player → 0');
  assert.strictEqual(D.reputationOf({ players: { p1: {} } }, 'p1'), 0, 'clean player → 0');
  assert.strictEqual(D.reputationOf({ players: { p1: { reputation: -3 } } }, 'p1'), -3);
});

test('pendingOfferFor / treatyActions: offer lives in the entry, accept only THEIRS', () => {
  const war = { turn: 5 };
  assert.strictEqual(D.pendingOfferFor(war, 'p1', 'p2'), null);
  let a = D.treatyActions(war, 'p1', 'p2');
  assert.deepStrictEqual(a, { canDeclare: false, canOffer: true, canAccept: false }, 'at war: only offer peace');

  const offered = { turn: 6, relations: { 'p1|p2': { state: 'war', offer: { from: 'p2', duration: 20, turn: 6 } } } };
  assert.deepStrictEqual(D.pendingOfferFor(offered, 'p1', 'p2'), { from: 'p2', duration: 20, turn: 6 });
  a = D.treatyActions(offered, 'p1', 'p2');
  assert.strictEqual(a.canAccept, true, 'their offer is acceptable');
  const mineOffer = { turn: 6, relations: { 'p1|p2': { state: 'war', offer: { from: 'p1', duration: 20, turn: 6 } } } };
  assert.strictEqual(D.treatyActions(mineOffer, 'p1', 'p2').canAccept, false, 'cannot accept my OWN offer');

  const peace = { turn: 10, relations: { 'p1|p2': { state: 'peace', treatyTurn: 8 } } };
  a = D.treatyActions(peace, 'p1', 'p2');
  assert.deepStrictEqual(a, { canDeclare: true, canOffer: false, canAccept: false }, 'at peace: only declare war');
});

test('relationLabel: war default, war-since, perpetual + timed peace', () => {
  assert.strictEqual(D.relationLabel({ turn: 5 }, 'p1', 'p2'), '⚔ at war', 'default war has no "since"');
  const declared = { turn: 12, relations: { 'p1|p2': { state: 'war', treatyTurn: 12 } } };
  assert.strictEqual(D.relationLabel(declared, 'p1', 'p2'), '⚔ at war since turn 12');
  const perp = { turn: 10, relations: { 'p1|p2': { state: 'peace', treatyTurn: 8 } } };
  assert.strictEqual(D.relationLabel(perp, 'p1', 'p2'), '🕊 at peace since turn 8 (perpetual)');
  const timed = { turn: 10, relations: { 'p1|p2': { state: 'peace', treatyTurn: 8, expiresTurn: 30 } } };
  assert.strictEqual(D.relationLabel(timed, 'p1', 'p2'), '🕊 at peace since turn 8 (until turn 30)');
});

test('diplomacyEventRow: party hears detail, world hears the headline (B5 fog)', () => {
  const civName = id => ({ rome: 'Rome', egypt: 'Egypt', greece: 'Greece' }[id] || id);
  const asRome = { civName, isMine: id => id === 'rome' };
  const asBystander = { civName, isMine: () => false };

  const war = { type: 'WAR_DECLARED', attackerCivId: 'rome', defenderCivId: 'egypt', turn: 4, reason: 'border_pressure' };
  assert.deepStrictEqual(D.diplomacyEventRow(war, asRome),
    { text: '⚔ Rome declares war on Egypt — border pressure', cls: '' }, 'aggressor party sees the reason');
  const defended = { ...war, attackerCivId: 'egypt', defenderCivId: 'rome' };
  assert.deepStrictEqual(D.diplomacyEventRow(defended, asRome),
    { text: '⚔ Egypt declares war on Rome — border pressure', cls: 'loss' }, 'the injured party row is a loss');
  assert.deepStrictEqual(D.diplomacyEventRow(war, asBystander),
    { text: '👀 Rome declares war on Egypt', cls: '' }, 'the world hears the headline, no reason');

  const peace = { type: 'PEACE_TREATY_SIGNED', civAId: 'rome', civBId: 'egypt', turn: 9, expiresTurn: 29 };
  assert.deepStrictEqual(D.diplomacyEventRow(peace, asRome),
    { text: '🕊 Rome and Egypt sign peace (until turn 29)', cls: 'win' }, 'a party sees the expiry');
  const perpetual = { type: 'PEACE_TREATY_SIGNED', civAId: 'rome', civBId: 'egypt', turn: 9 };
  assert.deepStrictEqual(D.diplomacyEventRow(perpetual, asRome),
    { text: '🕊 Rome and Egypt sign peace (perpetual)', cls: 'win' }, 'absent expiresTurn → perpetual');
  // the engine's REAL perpetual shape: expiresTurn:0 (state holds no undefined)
  const perpetualZero = { type: 'PEACE_TREATY_SIGNED', civAId: 'rome', civBId: 'egypt', turn: 9, expiresTurn: 0 };
  assert.deepStrictEqual(D.diplomacyEventRow(perpetualZero, asRome),
    { text: '🕊 Rome and Egypt sign peace (perpetual)', cls: 'win' }, 'expiresTurn:0 → perpetual, not "until turn 0"');
  assert.deepStrictEqual(D.diplomacyEventRow(peace, asBystander),
    { text: '🕊 Rome and Egypt sign peace', cls: '' }, 'the world hears no expiry');

  const broken = { type: 'TREATY_BROKEN', breakerCivId: 'egypt', injuredCivId: 'rome', turn: 15, penalty: 'reputation_loss' };
  assert.deepStrictEqual(D.diplomacyEventRow(broken, asRome),
    { text: '⚔ Egypt breaks the treaty with Rome — reputation cost', cls: 'loss' });
  assert.deepStrictEqual(D.diplomacyEventRow(broken, asBystander),
    { text: '👀 Egypt breaks the treaty with Rome', cls: '' });

  assert.strictEqual(D.diplomacyEventRow({ type: 'somethingElse' }, asRome), null, 'unknown types → null');
});

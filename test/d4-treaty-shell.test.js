// D4 human-treaty command builder + term describer (the D4 engine window LANDED —
// the provisional `parley` shell froze to the real engine `diplomacy` command).
// Both are pure — unit-tested here without a DOM. No cease-fire tier (ruling #2507):
// peace / tribute / tech-swap only. The chooser/modal DOM reuses the shipped envoy
// frame (a live LAN treaty is the integration realm, gated).
const test = require('node:test');
const assert = require('node:assert');

test('parleyCommand: peace emits a diplomacy offer with terms.peace (kind omitted)', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'peace'),
    { type: 'diplomacy', kind: 'offer', playerId: 'p1', target: 'p2', terms: { peace: true } });
});

test('parleyCommand: accept/reject answer a pending inbound offer', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'accept'),
    { type: 'diplomacy', kind: 'accept', playerId: 'p1', target: 'p2' });
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'reject'),
    { type: 'diplomacy', kind: 'reject', playerId: 'p1', target: 'p2' });
});

test('parleyCommand: tribute carries terms.kind + gold (clamped ≥0, integer)', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'tribute', { gold: 50 }),
    { type: 'diplomacy', kind: 'offer', playerId: 'p1', target: 'p2', terms: { kind: 'tribute', gold: 50 } });
  assert.strictEqual(parleyCommand('p1', 'p2', 'tribute', { gold: -5 }).terms.gold, 0);
});

test('parleyCommand: techswap carries techExchange terms; empty want = one-way gift', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'techswap', { giveTech: 'pottery', wantTech: 'bronze-working' }),
    { type: 'diplomacy', kind: 'offer', playerId: 'p1', target: 'p2', terms: { kind: 'techExchange', techId: 'pottery', wantTechId: 'bronze-working' } });
  const oneWay = parleyCommand('p1', 'p2', 'techswap', { giveTech: 'pottery' });
  assert.strictEqual(oneWay.terms.wantTechId, undefined, 'no wantTech -> one-way gift (field omitted)');
  assert.strictEqual(oneWay.terms.techId, 'pottery');
});

test('describeParley: each term reads as human text, with tech-name resolution', async () => {
  const { describeParley } = await import('../client/ui/diplomacy.js');
  const techName = id => ({ pottery: 'Pottery', 'bronze-working': 'Bronze Working' }[id] || id);
  assert.match(describeParley({ term: 'peace' }, { name: 'The Zulus' }), /The Zulus propose a lasting peace/);
  assert.match(describeParley({ term: 'tribute', gold: 75 }, { name: 'The Zulus' }), /tribute of 75 gold/);
  assert.match(describeParley({ term: 'techswap', giveTech: 'pottery', wantTech: 'bronze-working' }, { name: 'The Zulus', techName }),
    /offer Pottery in exchange for your Bronze Working/);
  assert.match(describeParley({ term: 'nonsense' }, { name: 'They' }), /propose terms/); // graceful default
});

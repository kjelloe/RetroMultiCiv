// D4 human-treaty SHELL (specs/d4-treaty-ui.md, un-gated speed pass). The command
// BUILDER and the term DESCRIBER are pure — unit-tested here on the PROVISIONAL
// wire shapes (command `parley`, fields term/gold/giveTech/wantTech). These pin
// the shell's contract before the D4 engine window; one rename pass at landing.
// The chooser/modal DOM reuses the shipped envoy frame (a live LAN treaty is the
// integration realm, gated).
const test = require('node:test');
const assert = require('node:assert');

test('parleyCommand: peace/ceasefire carry only the term', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'peace'),
    { type: 'parley', playerId: 'p1', target: 'p2', term: 'peace' });
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'ceasefire'),
    { type: 'parley', playerId: 'p1', target: 'p2', term: 'ceasefire' });
});

test('parleyCommand: tribute carries gold (clamped ≥0, integer)', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'tribute', { gold: 50 }),
    { type: 'parley', playerId: 'p1', target: 'p2', term: 'tribute', gold: 50 });
  assert.strictEqual(parleyCommand('p1', 'p2', 'tribute', { gold: -5 }).gold, 0);
});

test('parleyCommand: techswap carries giveTech + wantTech', async () => {
  const { parleyCommand } = await import('../client/ui/diplomacy.js');
  assert.deepStrictEqual(parleyCommand('p1', 'p2', 'techswap', { giveTech: 'pottery', wantTech: 'bronze-working' }),
    { type: 'parley', playerId: 'p1', target: 'p2', term: 'techswap', giveTech: 'pottery', wantTech: 'bronze-working' });
});

test('describeParley: each term reads as human text, with tech-name resolution', async () => {
  const { describeParley } = await import('../client/ui/diplomacy.js');
  const techName = id => ({ pottery: 'Pottery', 'bronze-working': 'Bronze Working' }[id] || id);
  assert.match(describeParley({ term: 'peace' }, { name: 'The Zulus' }), /The Zulus propose a lasting peace/);
  assert.match(describeParley({ term: 'ceasefire' }, { name: 'The Zulus' }), /ceasefire/);
  assert.match(describeParley({ term: 'tribute', gold: 75 }, { name: 'The Zulus' }), /tribute of 75 gold/);
  assert.match(describeParley({ term: 'techswap', giveTech: 'pottery', wantTech: 'bronze-working' }, { name: 'The Zulus', techName }),
    /offer Pottery in exchange for your Bronze Working/);
  assert.match(describeParley({ term: 'nonsense' }, { name: 'They' }), /propose terms/); // graceful default
});

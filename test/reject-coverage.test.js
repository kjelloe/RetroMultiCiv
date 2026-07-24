// CLIENT-SUPERSET contract (regression-guard 1, ruled #2523): the client must
// render EVERY server-layer reject `code`. The server half lives in
// test/server-reject-reasons.test.js (REJECT_REASONS is the registry); this half
// asserts the client covers it — lobby.js copy (reject-copy.js) + the rejoin.js
// graceful-card switch. Non-fragile: imports the LIVE exports, not a source scan.
const test = require('node:test');
const assert = require('node:assert');

const server = () => import('../server/protocol.js');
const copy = () => import('../client/ui/reject-copy.js');
const rejoin = () => import('../client/ui/rejoin.js');

test('client renders every server reject reason (superset by construction)', async () => {
  const { REJECT_REASONS } = await server();
  const { rejectText } = await copy();
  const { classifyRejoinReject } = await rejoin();
  for (const code of Object.keys(REJECT_REASONS)) {
    const text = rejectText(code);
    assert.strictEqual(typeof text, 'string', `rejectText(${code}) must be a string`);
    assert.ok(text.length > 0, `rejectText(${code}) must not be blank`);
    const rj = classifyRejoinReject(code);
    assert.strictEqual(typeof rj.definitive, 'boolean', `classifyRejoinReject(${code}).definitive must be boolean`);
  }
});

test('no stale client reject copy — every FRIENDLY key is a real server reason', async () => {
  const { REJECT_REASONS } = await server();
  const { REJECT_COPY } = await copy();
  for (const code of Object.keys(REJECT_COPY)) {
    assert.ok(code in REJECT_REASONS, `FRIENDLY copy for "${code}" but the server never sends it (drift)`);
  }
});

test('rejoin graceful cards: game-gone reasons are definitive, others are not', async () => {
  const { REJECT_REASONS } = await server();
  const { classifyRejoinReject } = await rejoin();
  // the definitive (game is gone) server reasons clear the stored record + offer the endscreen
  for (const code of ['gameEnded', 'noSuchGame']) {
    assert.ok(code in REJECT_REASONS, `${code} must be a real server reason`);
    assert.strictEqual(classifyRejoinReject(code).definitive, true, `${code} must classify definitive`);
  }
  // gameOver is a documented state/alias code (not in the server registry) but still handled
  assert.strictEqual(classifyRejoinReject('gameOver').definitive, true, 'gameOver alias stays definitive');
  // a transient/capacity reason is NOT definitive — a still-valid game is never wiped
  assert.strictEqual(classifyRejoinReject('serverFull').definitive, false, 'serverFull must not wipe the record');
});

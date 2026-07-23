// XV §13: ?server=1 Shift+S/Shift+D fetch /saves/<gameId>.json. The autosave
// FILE may not exist yet (before the first command, or --no-save) and saves/ is
// off the static whitelist (A61) — so the server snapshots the LIVE game's
// authoritative state on demand (write-then-serve), token-safe.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

const RULESET = require('./ruleset.js');

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

test('/saves/<id>.json snapshots on demand BEFORE any autosave, hardened mode, token-safe', async () => {
  const { startServer } = await import('../server/index.js');
  // autosave:false => the on-disk file is NEVER written; default (not --debug) =>
  // saves/ is off the static whitelist. The 404-until-autosave bug would 404 here.
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, host: '127.0.0.1' });
  try {
    const r = await get(s.port, `/saves/${s.game.gameId}.json`);
    assert.strictEqual(r.status, 200, 'served on demand, no 404 despite no autosave file');
    assert.strictEqual(r.headers['content-type'], 'application/json');
    assert.strictEqual(r.headers['cache-control'], 'no-store');
    const env = JSON.parse(r.body);
    assert.strictEqual(env.format, 'retromulticiv-server-save');
    assert.strictEqual(env.gameId, s.game.gameId);
    assert.ok(env.state && env.state.map && Array.isArray(env.state.playerOrder), 'carries a loadable authoritative state');
    assert.ok(typeof env.code === 'string' && env.code.length > 0, 'carries its verification code (client reads it)');
    // TOKEN-SAFE: seat tokens + reclaim codes stripped (A61 hijack-by-URL)
    assert.deepStrictEqual(env.seats, {}, 'no seat tokens leaked');
    assert.deepStrictEqual(env.seatCodes, {}, 'no reclaim codes leaked');
  } finally { await s.close(); }
});

test('/saves/<id>.json reflects CURRENT state (on-demand snapshot advances with play)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, host: '127.0.0.1' });
  try {
    const before = JSON.parse((await get(s.port, `/saves/${s.game.gameId}.json`)).body);
    // advance the authoritative game a turn, then re-fetch: the snapshot moved
    s.game.bindSeat('Kjell');
    s.game.endTurn('p1');
    const after = JSON.parse((await get(s.port, `/saves/${s.game.gameId}.json`)).body);
    assert.ok(after.state.turn > before.state.turn, 'the on-demand snapshot is live, not a stale file');
  } finally { await s.close(); }
});

test('/saves/<id>.json for an unknown game falls through to 404 (hardened)', async () => {
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, seed: 5, civs: 2, humans: 1, size: 'xsmall',
    autosave: false, host: '127.0.0.1' });
  try {
    assert.strictEqual((await get(s.port, '/saves/nosuchgame.json')).status, 404);
    // and no traversal via the saves route
    assert.strictEqual((await get(s.port, '/saves/..%2f..%2fpackage.json')).status, 404);
  } finally { await s.close(); }
});

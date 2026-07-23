// rejoin-nosuchgame (user playtest 2026-07-23): a rejoin to a game that is not
// live must give a DISTINCT answer, not the generic noSuchGame:
//   - the save shows gameOver  -> gameEnded (+ gameId + gameCode for the summary)
//   - a save on disk, not ended (server restarted) -> reload on demand + join
//   - no save anywhere         -> noSuchGame
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RULESET = require('./ruleset.js');

const SETUP = {
  seed: 424242,
  options: {
    width: 24, height: 16,
    players: [
      { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ]
  }
};

// a live ws client that resolves the FIRST reply frame
function joinOnce(port, msg) {
  const WebSocket = require('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    let done = false;
    const finish = m => { if (!done) { done = true; try { ws.close(); } catch (e) {} resolve(m); } };
    ws.on('open', () => ws.send(JSON.stringify(msg)));
    ws.on('message', raw => { try { finish(JSON.parse(raw)); } catch (e) {} });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
}

// write a real, loadable server-save for game id 'rejoin1' into dir; return its code
async function craftSave(dir, { ended }) {
  const { createGame } = await import('../server/game.js');
  const game = createGame({ ruleset: RULESET, setup: SETUP, gameId: 'rejoin1' });
  game.bindSeat('Kjell');
  game.endTurn('p1');
  const env = game.toSave();
  if (ended) env.state = Object.assign({}, env.state, { gameOver: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'rejoin1.json'), JSON.stringify(env));
  return env.code;
}

// a server whose default game id can't collide with 'rejoin1', pointed at dir
async function serverOn(dir) {
  const { startServer } = await import('../server/index.js');
  return startServer({ ruleset: RULESET, seed: 999, civs: 2, humans: 1, size: 'xsmall',
    host: '127.0.0.1', savesDir: dir, autosave: false });
}

test('rejoin a game whose save shows gameOver -> gameEnded (+ code for the summary)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rejoin-'));
  try {
    const code = await craftSave(dir, { ended: true });
    const s = await serverOn(dir);
    try {
      const r = await joinOnce(s.port, { t: 'join', name: 'Kjell', joinCode: code });
      assert.strictEqual(r.t, 'rejected');
      assert.strictEqual(r.code, 'gameEnded', 'distinct reason, not noSuchGame');
      assert.strictEqual(r.gameId, 'rejoin1');
      assert.ok(typeof r.gameCode === 'string' && r.gameCode.length > 0, 'carries the code for endscreen access');
    } finally { await s.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rejoin a not-ended game whose save is on disk (server restarted) -> reloaded + joined', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rejoin-'));
  try {
    const code = await craftSave(dir, { ended: false });
    const s = await serverOn(dir);
    try {
      const r = await joinOnce(s.port, { t: 'join', name: 'Kjell', joinCode: code });
      assert.strictEqual(r.t, 'joined', 'the save was reloaded on demand and the join succeeded');
      assert.strictEqual(r.gameId, 'rejoin1');
      assert.ok(r.view && r.view.turn >= 1, 'served the resumed authoritative view');
    } finally { await s.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rejoin an id/code the server never had -> noSuchGame', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rejoin-'));
  try {
    const s = await serverOn(dir); // empty saves dir
    try {
      const r = await joinOnce(s.port, { t: 'join', name: 'Kjell', joinCode: 'ZZZZ-ZZZZ-ZZZZZ' });
      assert.strictEqual(r.t, 'rejected');
      assert.strictEqual(r.code, 'noSuchGame');
    } finally { await s.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

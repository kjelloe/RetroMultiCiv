// gameover-reveal (XVII ruling #2496): at gameOver the fog rules lapse (Civ1-
// authentic — the endgame view shows the whole world). The server rides the
// UNFILTERED map on the view push that carries the gameOver broadcast, as an
// additive `reveal` field. It must be ABSENT before gameOver and PRESENT at it.
const test = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const RULESET = require('./ruleset.js');

// a ruleset whose endYear is already in the past -> the first round's
// checkGameEnd triggers a score victory, ending the game deterministically.
const ENDNOW = JSON.parse(JSON.stringify(RULESET));
ENDNOW.rules.endYear = -10000;

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [], waiters = [];
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(m));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  });
  function expect(match, ms) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms || 4000);
      waiters.push({ match, resolve: m => { clearTimeout(t); res(m); } }); });
  }
  return new Promise(resolve => ws.on('open', () => resolve({ ws, send: m => ws.send(JSON.stringify(m)), expect, close: () => ws.close() })));
}

test('reveal: ABSENT on the pre-gameOver view, PRESENT (full unfiltered map) at gameOver', async () => {
  const s = await import('../server/index.js').then(m => m.startServer({
    ruleset: ENDNOW, seed: 9, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1'
  }));
  try {
    const host = await client(s.port);
    host.send({ t: 'join', name: 'Ada' });
    const joined = await host.expect(m => m.t === 'joined');
    // before-case: the game is live, so the join view carries no full-map reveal
    assert.strictEqual(joined.view.map.tiles.some(t => t.t === 'unknown'), true, 'fog present pre-gameOver');
    assert.strictEqual('reveal' in joined, false, 'no reveal before gameOver');

    // one endTurn drives the AI round; endYear is in the past -> score victory
    host.send({ t: 'endTurn', token: joined.token, commandId: 1 });
    const view = await host.expect(m => m.t === 'view' && m.reveal !== undefined, 6000);

    const w = view.reveal.width, h = view.reveal.height;
    assert.strictEqual(view.reveal.tiles.length, w * h, 'reveal is the whole map');
    assert.strictEqual(view.reveal.tiles.some(t => t.t === 'unknown'), false, 'no fogged tiles in the reveal');
    assert.strictEqual(view.view.you, 'p1', 'the per-seat view still rides alongside the reveal');
    host.close();
  } finally { await s.close(); }
});

// XIV §2 (specs/refinement-xiv.md): AI regency must STOP at game end — a
// finished game accepts no more turn-advancing commands, on the SERVER path
// too. Evidence save: debugging/logs/g52yt-2.json is GAME OVER (winner p5) with
// active human p1; the report was that regency kept the game "running". This
// pins the invariant server-side: loading that save and driving regency leaves
// the turn frozen. (The engine already rejects every command post-gameOver;
// game.js's playRegentSeat guard + the driveRegents loop make it explicit.)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RULESET = require('./ruleset.js');

const SAVE = path.join(__dirname, '..', 'debugging', 'logs', 'g52yt-2.json');

test('XIV §2 (server): loading a GAME-OVER save and arming regency leaves the turn frozen', async (t) => {
  if (!fs.existsSync(SAVE)) { t.skip('g52yt-2 evidence save absent'); return; }
  const { createGame } = await import('../server/game.js');
  const save = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  // the save predates the current (XII.5-in-progress) ruleset hash — load anyway
  const game = createGame({ ruleset: RULESET, save, allowRulesetDrift: true });

  assert.strictEqual(game.state.gameOver, true, 'the evidence save is a finished game');
  const seat = game.state.activePlayer;
  const frozenTurn = game.state.turn;

  game.setRegent(seat, 'balanced'); // hand the finished seat to the AI
  const regentEvents = game.playRegentSeat(seat);
  const et = game.endTurn(seat);

  assert.strictEqual(et.ok, false, 'a finished game rejects endTurn');
  assert.strictEqual(et.reason, 'gameOver');
  assert.strictEqual(game.state.turn, frozenTurn, 'the turn number never advances after gameOver');
  assert.strictEqual(game.state.gameOver, true, 'the game stays over');
  // playRegentSeat applies nothing on a finished game (its §2 guard)
  assert.ok(regentEvents.every(e => e.type === 'regentTurn'),
    'no game-mutating events are produced for a regent on a finished game');
});

test('XIV §2 (server): a freshly-forced gameOver blocks playRegentSeat + endTurn', async () => {
  const { createGame } = await import('../server/game.js');
  const game = createGame({ ruleset: RULESET, gameId: 'over-fresh',
    setup: { seed: 5, options: { width: 20, height: 15, players: [
      { id: 'p1', name: 'Kjell', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ] } } });
  const seat = game.state.activePlayer;
  game.setRegent(seat, 'balanced');
  game.state.gameOver = true; // simulate reaching game end
  const frozen = game.state.turn;
  const evts = game.playRegentSeat(seat);
  const et = game.endTurn(seat);
  assert.deepStrictEqual(evts, [], 'playRegentSeat is a no-op once the game is over');
  assert.strictEqual(et.ok, false);
  assert.strictEqual(game.state.turn, frozen, 'turn frozen');
});

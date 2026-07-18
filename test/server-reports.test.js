// S1 (specs/match-report-corpus.md): the match-report writer — seat-label
// anonymization with REGENERATED hashes (the recording must replay clean
// under its own anonymized code: the S3 ingest gate's precondition),
// endReason derivation, rotation, and the ws-level consent flow (notice in
// the roster, veto flips it for everyone, report skipped).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RULESET = require('./ruleset.js');
const { replayDiagnostics } = require('../tools/replay.js');

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'mc-reports-')); }

async function playedGame() {
  const { createGame } = await import('../server/game.js');
  const game = createGame({
    ruleset: RULESET, gameId: 'rpt1',
    setup: { seed: 42, options: { width: 40, height: 25, players: [
      { id: 'p1', name: 'Kjell', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ] } }
  });
  // a little real history: found a city, then two rounds
  const u = Object.values(game.state.units).find(x => x.owner === 'p1');
  game.apply('p1', { type: 'foundCity', playerId: 'p1', unitId: u.id, name: 'Reportville' });
  game.endTurn('p1');
  game.endTurn('p1');
  return game;
}

test('report: anonymized, hash-regenerated, replay-clean under its own code', async () => {
  const { buildReport } = await import('../server/report.js');
  const game = await playedGame();
  const report = buildReport(game, RULESET);
  assert.ok(report, 'report built');
  const json = JSON.stringify(report);
  assert.ok(!json.includes('Kjell'), 'player names are gone');
  assert.ok(json.includes('seat1'), 'seat labels present');
  assert.strictEqual(report.envelope.civCount, 2);
  assert.strictEqual(report.envelope.humanSeats, 1);
  assert.strictEqual(report.envelope.mapSize, '40x25');
  assert.ok(report.envelope.ranks.length === 2 && report.envelope.ranks[0].score >= report.envelope.ranks[1].score,
    'ranks sorted by score');
  // the ingest-gate precondition: the anonymized recording replays EXACTLY
  const verdict = await replayDiagnostics(report.recording, RULESET);
  assert.deepStrictEqual(verdict.problems, [], 'anonymized recording replays clean');
  assert.strictEqual(verdict.finalHash, report.recording.finalHash, 'final hash self-consistent');
});

test('endReason: conquest / endYear / abandoned derivation', async () => {
  const { endReasonOf } = await import('../server/report.js');
  const base = {
    gameOver: true, winner: 'p1', turn: 100,
    playerOrder: ['p1', 'p2'],
    players: { p1: { alive: true }, p2: { alive: false } }
  };
  assert.strictEqual(endReasonOf(base, RULESET), 'conquest');
  const scoreEnd = { ...base, players: { p1: { alive: true }, p2: { alive: true } } };
  assert.strictEqual(endReasonOf(scoreEnd, RULESET), 'endYear');
  assert.strictEqual(endReasonOf({ ...base, gameOver: false }, RULESET), 'abandoned');
});

test('rotation: keep-last drops the oldest, leaves foreign files', async () => {
  const { rotateReports, FORMAT } = await import('../server/report.js');
  const dir = tmpdir();
  for (let i = 0; i < 5; i++) {
    const f = path.join(dir, `g${i}.json`);
    fs.writeFileSync(f, JSON.stringify({ format: FORMAT, i }));
    fs.utimesSync(f, new Date(1700000000000 + i * 1000), new Date(1700000000000 + i * 1000));
  }
  fs.writeFileSync(path.join(dir, 'foreign.json'), JSON.stringify({ format: 'other' }));
  rotateReports(dir, 3);
  const left = fs.readdirSync(dir).sort();
  assert.deepStrictEqual(left, ['foreign.json', 'g2.json', 'g3.json', 'g4.json'],
    'oldest two rotated out, foreign file untouched');
});

test('ws consent: roster notice + veto flips it and sticks', async () => {
  const { startServer } = await import('../server/index.js');
  const WebSocket = require('ws');
  const dir = tmpdir();
  const s = await startServer({ ruleset: RULESET, seed: 5, size: 'xsmall', autosave: false,
    shareReports: dir });
  function connect(port) {
    const sock = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const inbox = [];
    const waiters = [];
    sock.on('message', d => {
      const m = JSON.parse(d.toString());
      inbox.push(m);
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].match(m)) { waiters[i].resolve(m); waiters.splice(i, 1); }
      }
    });
    return new Promise(res => sock.on('open', () => res({
      send: o => sock.send(JSON.stringify(o)),
      expect: (match, label) => {
        const hit = inbox.find(match);
        if (hit) return Promise.resolve(hit);
        return new Promise((resolve, reject) => {
          waiters.push({ match, resolve });
          setTimeout(() => reject(new Error(`timeout: ${label}\ninbox: ${JSON.stringify(inbox)}`)), 30000);
        });
      },
      close: () => sock.close()
    })));
  }
  try {
    const host = await connect(s.port);
    host.send({ t: 'create', name: 'Host', options: { civs: 2, humans: 2, size: 'xsmall', seed: 3 } });
    const created = await host.expect(m => m.t === 'created', 'created');
    assert.strictEqual(created.lobby.shareReports, true, 'notice flag on with --share-reports');
    host.send({ t: 'reportVeto', gameId: created.gameId });
    const flipped = await host.expect(m => m.t === 'lobby' && m.lobby.reportVetoed === true, 'veto broadcast');
    assert.strictEqual(flipped.lobby.shareReports, false, 'veto turns the shared flag off');
    host.close();
  } finally {
    await s.close();
  }
});

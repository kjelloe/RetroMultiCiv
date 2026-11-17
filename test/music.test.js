// The music: overworld's score validator (client/music/score.js), every committed
// piece, and the theme rule (shared/music-theme.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const load = async () => ({
  score: await import('../client/music/score.js'),
  theme: await import('../shared/music-theme.js')
});
const piece = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'client/music/pieces', id + '.json'), 'utf8'));
const one = notes => ({ bpm: 60, beats: 4, loop: true, tracks: [{ patch: 'lead', gain: 0.5, notes }] });

test('score: the validator refuses overlap, range, gain 0, unknown patches and bad pieces', async () => {
  const { score } = await load();
  assert.throws(() => score.loadScore(one([[0, 60, 2], [1, 62, 1]])), /overlap/);
  assert.throws(() => score.loadScore(one([[0, 23, 1]])), /pitch outside/);
  assert.throws(() => score.loadScore(one([[0, 97, 1]])), /pitch outside/);
  assert.throws(() => score.loadScore(one([[0, 60.5, 1]])), /pitch outside/);
  assert.throws(() => score.loadScore(one([[0, 60, 0]])), /bad time/);
  assert.throws(() => score.loadScore({ ...one([[0, 60, 1]]), tracks: [{ patch: 'lead', gain: 0, notes: [[0, 60, 1]] }] }), /gain/);
  assert.throws(() => score.loadScore({ ...one([[0, 60, 1]]), tracks: [{ patch: 'lead', gain: 1.2, notes: [[0, 60, 1]] }] }), /gain/);
  assert.throws(() => score.loadScore({ ...one([[0, 60, 1]]), tracks: [{ patch: 'organ', gain: 0.5, notes: [[0, 60, 1]] }] }), /unknown patch/);
  assert.throws(() => score.loadScore({ ...one([[0, 60, 1]]), loop: 1 }), /loop/);
  assert.throws(() => score.loadScore({ ...one([[0, 60, 1]]), bpm: 0 }), /bpm/);
});

test('score: the length rounds up to whole bars and a loop wraps with rising beats', async () => {
  const { score } = await load();
  const p = score.loadScore(one([[0, 60, 1], [4.5, 62, 1]]));
  assert.strictEqual(p.lengthBeats, 8);
  const ev = score.eventsBetween(p, 7, 9.5);
  assert.deepStrictEqual(ev.map(e => [e.beat, e.midi]), [[8, 60]]);
  assert.deepStrictEqual(score.eventsBetween(p, 12, 13).map(e => e.beat), [12.5]);
  assert.strictEqual(score.lookAhead(true) > score.lookAhead(false), true);
});

test('pieces: every theme piece loads, loops, and is 16 to 32 bars', async () => {
  const { score, theme } = await load();
  const files = fs.readdirSync(path.join(ROOT, 'client/music/pieces')).map(f => f.replace(/\.json$/, '')).sort();
  assert.deepStrictEqual(files, [...theme.PIECES].sort(), 'one file per piece, no strays');
  for (const id of theme.PIECES) {
    const p = score.loadScore(piece(id));
    const bars = p.lengthBeats / p.beats;
    assert.strictEqual(p.loop, true, id);
    assert.ok(bars >= 16 && bars <= 32, `${id}: ${bars} bars`);
    for (const t of p.tracks) assert.ok(t.gain > 0 && t.gain <= 1, id);
  }
});

test('pieces: the committed JSON matches tools/compose-music.js', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/compose-music.js'), '--check']);
});

test('theme: screens, endings, war over the era, the space programme', async () => {
  const { theme } = await load();
  const m = o => Object.assign({ screen: 'game', era: 'ancient', space: false, turn: 50, lastCombatTurn: -1, outcome: '' }, o);
  assert.strictEqual(theme.themeFor(m({ screen: 'title' })), 'intro-title');
  assert.strictEqual(theme.themeFor(m({ screen: 'loading' })), 'loading-age');
  assert.strictEqual(theme.themeFor(m({ turn: 0 })), 'map-ancient');
  assert.strictEqual(theme.themeFor(m({ era: 'industrial', turn: 48 })), 'map-industrial');
  assert.strictEqual(theme.themeFor(m({ era: 'industrial', turn: 48 + theme.MAP_VARIANT_TURNS })), 'map-industrial-b', 'the era alternates its two pieces');
  assert.strictEqual(theme.themeFor(m({ era: 'industrial', turn: 48 + 2 * theme.MAP_VARIANT_TURNS })), 'map-industrial');
  assert.strictEqual(theme.themeFor(m({ era: 'modern', space: true, turn: 52 })), 'map-space', 'space has one piece');
  assert.strictEqual(theme.themeFor(m({ era: 'modern', space: true })), 'map-space');
  assert.strictEqual(theme.themeFor(m({ era: 'modern', space: true, lastCombatTurn: 49 })), 'map-war', 'war wins over every era');
  assert.strictEqual(theme.themeFor(m({ lastCombatTurn: 50 - theme.WAR_TURNS - 1 })), 'map-ancient', 'an old fight fades');
  assert.strictEqual(theme.themeFor(m({ lastCombatTurn: 50, outcome: 'defeat' })), 'end-defeat', 'a finished game wins over war');
  assert.strictEqual(theme.themeFor(m({ outcome: 'victory' })), 'end-victory');
  for (const era of ['ancient', 'renaissance', 'industrial', 'modern']) {
    for (const turn of [0, theme.MAP_VARIANT_TURNS]) assert.ok(theme.PIECES.includes(theme.themeFor(m({ era, turn }))), era + turn);
  }
});

test('theme: the moment reads the viewer\'s highest era, the space tech and the winner', async () => {
  const { theme } = await load();
  const techs = { a: { era: 'ancient' }, r: { era: 'renaissance' }, i: { era: 'industrial' }, 'space-flight': { era: 'modern' } };
  const view = { turn: 9, players: { p1: { techs: ['a', 'i', 'r'] }, p2: {} } };
  const mo = theme.musicMoment(view, 'p1', techs, -1);
  assert.strictEqual(mo.era, 'industrial');
  assert.strictEqual(mo.space, false);
  assert.strictEqual(theme.musicMoment({ ...view, players: { p1: { techs: ['space-flight'] } } }, 'p1', techs, -1).space, true);
  assert.strictEqual(theme.musicMoment(view, 'p2', techs, -1).era, 'ancient', 'no techs in view: ancient');
  assert.strictEqual(theme.musicMoment({ ...view, gameOver: true }, 'p1', techs, -1, 'p1').outcome, 'victory', 'winner from the event');
  assert.strictEqual(theme.musicMoment({ ...view, gameOver: true, winner: 'p2' }, 'p1', techs, -1).outcome, 'defeat');
});

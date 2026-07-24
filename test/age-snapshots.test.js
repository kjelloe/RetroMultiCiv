// The age-snapshot baker (tools/bake-age-snapshots.js) pre-computes starting-age
// fast-forward states for Roblox to load instead of running the slow live walk.
// This gate proves the baker is DETERMINISTIC (a snapshot reproduces byte-for-
// byte) and produces a VALID, granted state — the properties Roblox relies on.
// Uses the fastest preset (renaissance / small) to stay quick.
const test = require('node:test');
const assert = require('node:assert');
const baker = require('../tools/bake-age-snapshots.js');

async function deps() {
  const [{ createEngine }, ff, sh, cs] = await Promise.all([
    import('../engine/index.js'), import('../shared/fastforward.js'), import('../shared/statehash.js'), import('../shared/civ-shuffle.js')
  ]);
  return { createEngine, fastForwardTo: ff.fastForwardTo, hashState: sh.hashState, shuffleRoster: cs.shuffleRoster };
}

test('bake is deterministic — same preset reproduces the same statehash', async () => {
  const { createEngine, fastForwardTo, hashState, shuffleRoster } = await deps();
  const a = await baker.bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, 7, 'small', 'renaissance', 7);
  const b = await baker.bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, 7, 'small', 'renaissance', 7);
  assert.ok(!a.aborted && !b.aborted, 'renaissance/small/7 must not abort');
  assert.strictEqual(a.hash, b.hash, 'two bakes of the same preset must match');
});

test('baked state reaches the age turn and grants the prior-era techs to every civ', async () => {
  const { createEngine, fastForwardTo, hashState, shuffleRoster } = await deps();
  const r = await baker.bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, 7, 'small', 'renaissance', 7);
  assert.strictEqual(r.turn, 190, 'renaissance age turn');
  const age = baker.ageEntry('renaissance');
  // an ancient-era tech every civ must hold after the renaissance grant
  const ancient = Object.keys(baker.ruleset.techs).find(id => baker.ruleset.techs[id].era === 'ancient');
  assert.ok(ancient, 'ruleset has an ancient-era tech');
  for (const pid of r.state.playerOrder) {
    const p = r.state.players[pid];
    if (p.alive === false) continue;
    assert.ok(p.techs.includes(ancient), `${pid} was granted the ancient era`);
    assert.strictEqual(p.researching, '', 'research reset at takeover');
  }
});

test('the baked state is portable (statehash accepts it — no null/float)', async () => {
  const { createEngine, fastForwardTo, hashState, shuffleRoster } = await deps();
  const r = await baker.bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, 42, 'small', 'renaissance', 7);
  // bakeOne already calls hashState (throws on non-portable types); it returns
  // the canonical '0x…' statehash string
  if (!r.aborted) assert.match(r.hash, /^0x[0-9a-f]{8}$/);
});

// THE CORE CORRECTNESS GATE for the browser-wiring: a baked snapshot must equal
// what the browser's LIVE fast-forward would produce for the same config —
// otherwise loading it hands the player a different world. Replicates the
// client/main.js genesis (sorted+seed-shuffled lineup, continents/prince, all
// AI, humanSeats=[]) and asserts the identical statehash.
test('baker genesis == browser genesis (snapshot load reproduces the live ff)', async () => {
  const { createEngine, fastForwardTo, hashState, shuffleRoster } = await deps();
  const baked = await baker.bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, 7, 'small', 'renaissance', 7);
  const civs = baker.ruleset.civs;
  const lineup = shuffleRoster(Object.keys(civs).sort(), 7).slice(0, 7); // main.js lineup, no ?civ pick
  const players = lineup.map((civ, i) => ({ id: 'p' + (i + 1), civ, name: civs[civ].name, color: civs[civ].color, human: false }));
  const raw = createEngine(baker.ruleset).createGame({ seed: 7, options: { width: 60, height: 38, players, mapType: 'continents', difficulty: 'prince' } });
  const r = fastForwardTo(baker.ruleset, raw, baker.ageEntry('renaissance'), []);
  assert.strictEqual(hashState(baked.state), hashState(r.state), 'the snapshot equals the browser live ff');
});

// GOLDEN PIN (re-record rider, docs/05 §4): one canonical preset's baked
// statehash is COMMITTED here so a BEHAVIORAL engine change breaks THIS test —
// the mechanical forcing function behind "every behavioral re-record also
// re-runs `node tools/bake-age-snapshots.js`". The snapshot files are
// gitignored, so this pin is the only thing that goes red; move it ONLY on an
// intentional behavioral re-record (re-bake, then paste the new hash), same
// ritual as the simulation.test.js checkpoints.
const CANONICAL_PIN = { seed: 7, size: 'small', age: 'renaissance', civs: 7, statehash: '0x723cbf7a' };
test('canonical snapshot statehash pin — moves only on a behavioral re-record', async () => {
  const { createEngine, fastForwardTo, hashState, shuffleRoster } = await deps();
  const p = CANONICAL_PIN;
  const r = await baker.bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, p.seed, p.size, p.age, p.civs);
  assert.ok(!r.aborted, 'the canonical preset must not abort');
  assert.strictEqual(r.hash, p.statehash,
    'baked statehash moved — if this was an intentional behavioral re-record, run `node tools/bake-age-snapshots.js` and paste the new hash into CANONICAL_PIN');
});

test('matchSnapshot: exact config matches; a pick / wrong map type / arbitrary seed do not', async () => {
  const { matchSnapshot } = await import('../shared/age-snapshots.js');
  const manifest = { mapType: 'continents', difficulty: 'prince', presets: [
    { name: 'renaissance-small-7-c7', age: 'renaissance', size: 'small', seed: 7, civs: 7, statehash: '0xabcdef01' },
    { name: 'industrial-medium-42-c7', age: 'industrial', size: 'medium', seed: 42, civs: 7, aborted: { reason: 'gameOver' } }
  ] };
  const base = { age: 'renaissance', size: 'small', seed: 7, civs: 7, mapType: 'continents', difficulty: 'prince', picked: null };
  assert.strictEqual(matchSnapshot(manifest, base).seed, 7, 'exact match');
  assert.strictEqual(matchSnapshot(manifest, { ...base, picked: 'romans' }), null, 'a civ pick never matches');
  assert.strictEqual(matchSnapshot(manifest, { ...base, mapType: 'pangaea' }), null, 'wrong map type');
  assert.strictEqual(matchSnapshot(manifest, { ...base, difficulty: 'king' }), null, 'wrong difficulty');
  assert.strictEqual(matchSnapshot(manifest, { ...base, seed: 999 }), null, 'arbitrary seed → live ff');
  assert.strictEqual(matchSnapshot(manifest, { age: 'industrial', size: 'medium', seed: 42, civs: 7, mapType: 'continents', difficulty: 'prince' }), null, 'an aborted preset never matches');
});

test('snapshotUsable: pins the statehash and rejects a dead human seat', async () => {
  const { snapshotUsable } = await import('../shared/age-snapshots.js');
  const preset = { statehash: '0x00000001' };
  const hash = () => '0x00000001';
  const alive = { players: { p1: { alive: true }, p2: {} } };
  assert.strictEqual(snapshotUsable(alive, preset, ['p1'], hash), true, 'intact + seat alive');
  assert.strictEqual(snapshotUsable(alive, preset, ['p1'], () => '0xdeadbeef'), false, 'statehash mismatch → not usable');
  const dead = { players: { p1: { alive: false } } };
  assert.strictEqual(snapshotUsable(dead, preset, ['p1'], hash), false, 'a dead human seat → live ff (which aborts with the casualty)');
});

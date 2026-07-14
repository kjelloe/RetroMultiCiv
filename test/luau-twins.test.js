// Phase 5 (P5-1): the Luau twins of rng/statehash/gamecode must reproduce
// the three cross-language anchors exactly. Runs the luau/anchors.luau
// harness under lune and asserts every printed gate value; self-skips when
// lune is not installed (docs/09 §5 — the CI twin pattern; the nightly
// picks it up once its runner installs lune).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');

const lune = (() => {
  const r = spawnSync('lune', ['--version'], { encoding: 'utf8', timeout: 30000 });
  return !r.error && r.status === 0 ? (r.stdout || '').trim() : null;
})();

test('luau twins: rng + statehash + gamecode reproduce the phase-5 anchors under lune',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, () => {
    const res = spawnSync('lune', ['run', 'luau/anchors.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(res.status, 0, `lune run failed (${lune}):\n${res.stdout}\n${res.stderr}`);
    const out = res.stdout;
    // gate 1: xorshift32 golden sequence, seed 123456789 (test/rng.test.js)
    assert.match(out, /rng: 2714967881,2238813396,1250077441,3820100336\n/,
      'the Luau xorshift32 must reproduce the golden sequence bit-exactly');
    // gate 2: canonical serialization + hash anchor
    assert.match(out, /canon: \{"a":\[1,"x",true\],"b":2\}\n/,
      'the canonical string must be byte-identical, not merely hash-equal');
    assert.match(out, /statehash: 0x30db1e29\n/, 'the statehash anchor');
    // gate 3: the A11 game-code anchors
    assert.match(out, /codehi: 0xa687b72d\n/, 'the reverse-FNV codeHi anchor');
    assert.match(out, /gamecode: AD1X-Q5MR-DP7H9\n/, 'the grouped Crockford game code');
    // the empty-array representation convention (P5-1 trap-list addition):
    // marked empty tables are [], unmarked are {} — json2lua relies on this
    assert.match(out, /emptyarray: \{"a":\[\],"b":\{\}\}\n/,
      'ARRAY_MT-marked empty tables must serialize as [] and plain empties as {}');
  });

// P5-2 gate: every scenario's setup hashes IDENTICALLY in Node and Luau —
// json2lua's array/object/integer fidelity is what's really under test
// (inline states are contract-asserted; seed setups hash the raw setup
// object until the engine ports land, same rule both sides). Plus one
// deliberately MESSY save state — tidy scenario states won't find what
// empty arrays, empty objects, and deep nesting will.
test('luau json2lua: all ten scenario setups and a messy save hash equal in both languages',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const fs = require('fs');
    const os = require('os');
    const { hashState } = await import('../shared/statehash.js');

    // the messy save: every state-contract shape that has bitten before
    const messyState = {
      version: 1, turn: 42, year: -3160, activePlayer: 'p1',
      playerOrder: ['p1', 'p2'],
      map: {
        width: 3, height: 2, wrapX: true,
        tiles: [
          { t: 'grassland', special: true }, { t: 'ocean' },
          { t: 'hills', mine: true, road: true }, { t: 'desert', irrigation: true },
          { t: 'grassland', river: true, railroad: true, road: true }, { t: 'arctic' }
        ]
      },
      units: {
        u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 0, y: 0, moves: 0, fortified: false, veteran: true, home: 'c1' },
        u10: { id: 'u10', type: 'militia', owner: 'p2', x: 2, y: 1, moves: 1, fortified: true, veteran: false }
      },
      cities: {
        c1: {
          id: 'c1', name: 'Messy Town (test)', owner: 'p1', x: 2, y: 0,
          pop: 5, food: 0, shields: 13,
          buildings: [], workers: [0, 4], taxmen: 1,
          producing: { kind: 'wonder', id: 'pyramids' }
        }
      },
      cityOrder: ['c1'], wonders: {},
      nextUnitId: 11, nextCityId: 2,
      players: {
        p1: {
          id: 'p1', name: 'A', color: '#3b7dd8', human: true, alive: true,
          gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50,
          explored: [1, 1, 1, 0, 0, 1], government: 'monarchy'
        },
        p2: {
          id: 'p2', name: 'B "quoted"', color: '#d84a3b', human: false, alive: true,
          gold: 100000, techs: ['alphabet', 'bronze-working'], researching: 'currency',
          bulbs: 7, taxRate: 60, sciRate: 40, explored: [0, 0, 0, 0, 0, 0]
        }
      },
      rngState: 2463534242
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-p52-'));
    const savePath = path.join(dir, 'messy.save.json');
    fs.writeFileSync(savePath, JSON.stringify({ format: 'retromulticiv-save', turn: 42, state: messyState }));
    try {
      const res = spawnSync('lune', ['run', 'luau/scenario-hashes.luau', savePath],
        { cwd: REPO, encoding: 'utf8', timeout: 60000 });
      assert.strictEqual(res.status, 0, `harness failed:\n${res.stdout}\n${res.stderr}`);
      const luauHashes = {};
      for (const line of res.stdout.trim().split('\n')) {
        const m = line.match(/^(\S+): (0x[0-9a-f]{8})$/);
        if (m) luauHashes[m[1]] = m[2];
      }
      const scenarioDir = path.join(REPO, 'test', 'scenarios');
      const files = fs.readdirSync(scenarioDir).filter(f => f.endsWith('.json')).sort();
      assert.strictEqual(files.length, 10, 'the ten scenarios');
      for (const f of files) {
        const scenario = JSON.parse(fs.readFileSync(path.join(scenarioDir, f), 'utf8'));
        const nodeHash = hashState(scenario.setup.state !== undefined ? scenario.setup.state : scenario.setup);
        assert.strictEqual(luauHashes[f], nodeHash,
          `${f}: Luau ${luauHashes[f]} != Node ${nodeHash} — json2lua fidelity broke`);
      }
      assert.strictEqual(luauHashes['save:messy.save.json'], hashState(messyState),
        'the messy save state must hash identically (empty arrays/objects, quotes, deep nesting)');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

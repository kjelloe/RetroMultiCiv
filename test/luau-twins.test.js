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
test('luau json2lua: every scenario setup and a messy save hash equal in both languages',
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
      assert.strictEqual(files.length, 24, 'the twenty-four scenarios (026 fortify-defense added in B25)');
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

// P5-3 gates: (1) the eight data/*.json files canonical-hash identically in
// both languages — every engine twin's rule lookups depend on it; (2) the
// LUAU ENGINE runs each PORTED scenario to its PINNED final.hash — the pin
// is the cross-language contract (B10, ruling @2e3c2166): the JS suite
// asserts JS==pin, this asserts Luau==pin; (3) every scenario a batch has
// NOT yet reached must fail IN-CONTRACT: a docs/09 first-divergence block,
// never a crash or a silent pass. As port batches land, move their
// scenarios into PORTED and this test enforces the new gate.
const PORTED = [
  '001-move-unit.json', // P5-3 batch 1: movement + visibility
  '008-improvements.json', // P5-4 batch 2: improvements
  '004-combat.json', '005-combat-defender-wins.json', // P5-4 combat, pins reached via P5-5 harvest
  '003-found-city.json', '006-research.json', '007-buildings.json',
  '009-buy-pillage-disband.json', // P5-5 batch 3: cities + tech
  '010-happiness-government.json', // P5-6 batch 4: government proper
  '002-mapgen-determinism.json', // P5-7 batch 5: mapgen — ALL TEN green
  '013-zoc.json', // B18: enemy-city ZOC + ignoresZoc (post-port golden window)
  '014-river.json', // B19: Bridge Building river roads + no river mining
  '015-obsolescence.json', // B13a/A63: units leave the catalog on obsoletedBy tech
  '016-barracks-sell.json', // B13/A63: barracks sold for gold on the obsoleting tech
  '017-ship-vs-land.json', // B20: ships attack coastal land in-place, no capture from sea
  '018-caravan-wonder.json', // A83: caravan helps build a wonder (helpWonder command)
  '019-naval-transport.json', // A69: load onto a transport, sail, unload
  '020-transport-sunk.json', // A69: a sunk transport drowns its cargo
  '021-air-movement.json', // A72: air units fly over any tile
  '022-air-fuel.json', // A72: an air unit out of fuel crashes at the wrap
  '023-air-carrier.json', // A72: a carrier bases air units (A69 aboard reuse)
  '024-nuclear.json', // A72: the nuclear missile strikes once and is consumed
  '025-sell-building.json', // A86: manual building sale (shared A63 helper)
  '026-fortify-defense.json' // B25: the fortify x1.5 bonus is load-bearing (combat already ported)
];
// Partial column (P5-3 convention): steps before the value pass cross-
// language; the guard must fire at EXACTLY that command — earlier means a
// regression in an already-ported module. Empty since P5-6; the mechanism
// stays for future batches.
const PARTIAL = {};
test('luau engine: data checksums, ported scenarios green, unported fail in-contract',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const fs = require('fs');
    const { hashState } = await import('../shared/statehash.js');

    // gate 1: static data
    const dataRes = spawnSync('lune', ['run', 'luau/data-hashes.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(dataRes.status, 0, `data harness failed:\n${dataRes.stdout}\n${dataRes.stderr}`);
    const dataFiles = fs.readdirSync(path.join(REPO, 'data')).filter(f => f.endsWith('.json')).sort();
    assert.strictEqual(dataFiles.length, 8, 'the eight ruleset files');
    for (const f of dataFiles) {
      const nodeHash = hashState(JSON.parse(fs.readFileSync(path.join(REPO, 'data', f), 'utf8')));
      assert.ok(dataRes.stdout.includes(`${f}: ${nodeHash}`),
        `${f}: Luau must hash it as ${nodeHash} — got:\n${dataRes.stdout}`);
    }

    // gates 2+3: scenario runs
    const res = spawnSync('lune', ['run', 'luau/scenario-hashes.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    assert.strictEqual(res.status, 0, `scenario harness failed:\n${res.stdout}\n${res.stderr}`);
    const scenarioDir = path.join(REPO, 'test', 'scenarios');
    for (const f of fs.readdirSync(scenarioDir).filter(x => x.endsWith('.json')).sort()) {
      if (PORTED.includes(f)) {
        // B10: the PINNED final.hash is the cross-language contract — the JS
        // suite asserts JS==pin, this asserts Luau==pin (ruling @2e3c2166)
        const scenario = JSON.parse(fs.readFileSync(path.join(scenarioDir, f), 'utf8'));
        assert.match(scenario.final.hash || '', /^0x[0-9a-f]{8}$/,
          `${f}: a PORTED scenario needs its pinned hash (guards enforce this too)`);
        assert.ok(res.stdout.includes(`run:${f}: ${scenario.final.hash}`),
          `${f}: Luau final hash must equal the PINNED ${scenario.final.hash} — harness said:\n`
          + `${(res.stdout.match(new RegExp(`(run:${f}|DIVERGENCE fixture=${f})[^]*?(?=\\n[^ ])`)) || ['(no line)'])[0]}`);
      } else {
        const block = res.stdout.match(new RegExp(`DIVERGENCE fixture=${f} command=(-?\\d+) turn=\\S+ actor=\\S+`));
        assert.ok(block, `${f}: an unported scenario must fail IN-CONTRACT (divergence block), harness said:\n`
          + res.stdout.split('\n').filter(l => l.includes(f)).join('\n'));
        assert.ok(res.stdout.includes(`fixture=${f}`) && /fail: /.test(res.stdout),
          `${f}: the divergence block must carry failure lines`);
        if (PARTIAL[f] !== undefined) {
          assert.strictEqual(Number(block[1]), PARTIAL[f],
            `${f}: the ported steps before the wrap must PASS — failing earlier than `
            + `command ${PARTIAL[f]} means a regression in an already-ported module`);
        }
      }
    }
  });

// P5-8 (the summit): the Luau AI must THINK identically. The turn-100
// smoke replays the golden-seed all-AI game (chaos on) through the FULL
// Luau engine + AI + chaos stream and must land on the pinned soak
// checkpoint. (~15-30s under lune; the 400-round + natural goldens run on
// the sim-runner's box — Gate B — and were verified locally at port time.)
test('luau ai: the golden-seed sim reaches the turn-100 checkpoint bit-exact',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, () => {
    const res = spawnSync('lune', ['run', 'luau/sim-smoke.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 180000 });
    assert.strictEqual(res.status, 0, `sim smoke failed:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /checkpoint 100: 0x7f398c57\n/,
      'the Luau AI diverged from the JS soak trajectory — bisect with the divergence report tools');
  });

// P5-8 Gate C: VERDICT EQUALITY — the JS and Luau replayers must produce
// byte-identical reports for real recordings, including agreeing on HOW a
// stale recording diverges. Files are untracked runtime artifacts, so each
// is skipped when absent (CI has none; dev boxes replay what they have).
test('luau replay: verdicts are byte-identical with tools/replay.js',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, () => {
    const fs = require('fs');
    const candidates = [
      'debugging/logs/retromulticiv-g1.json',
      'debugging/logs/retromulticiv-g3.json',
      'debugging/logs/retromulticiv-g3-turn53.json',
      'saves/g530734.json', 'saves/g672813.json'
    ].filter(f => fs.existsSync(path.join(REPO, f)));
    if (candidates.length === 0) return; // nothing recorded on this box
    for (const f of candidates) {
      const js = spawnSync('node', ['tools/replay.js', f], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
      const luau = spawnSync('lune', ['run', 'luau/replay.luau', f], { cwd: REPO, encoding: 'utf8', timeout: 120000 });
      // exit codes differ by design (node sets exitCode 1 on divergence);
      // the REPORT TEXT is the contract
      assert.strictEqual(luau.stdout, js.stdout,
        `${f}: the two replayers must agree verbatim — even about divergence`);
    }
  });

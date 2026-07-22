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
      assert.strictEqual(files.length, 57, 'the fifty-seven scenarios (056/057 manhattan-gate added)');
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
  '012-diplomacy.json', // D1: war/peace chain (declare/offer/accept/break) + reputation cross-language
  '045-ai-diplomacy.json', // D3: relationship model (grievance/trust bumps + peace decay) cross-language
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
  '026-fortify-defense.json', // B25: the fortify x1.5 bonus is load-bearing (combat already ported)
  '027-blockade.json', // A79: enemy unit on a worked tile blockades it (house rule)
  '028-zoc-city-capture.json', // B27: capture an undefended enemy city by moving in, even in ZOC
  '029-space-race.json', // A76: launch a viable spaceship and win the space victory on arrival
  '030-government-reeval.json', // gov re-eval: Monarchy -> Republic adoption transition
  '031-traderoute-foreign-auto.json', // A89: caravan foreign-city auto-route + windfall
  '032-traderoute-domestic-choice.json', // A89: domestic route needs the min distance
  '033-traderoute-windfall-math.json', // A89: the windfall multiplier stack (1/9 floor)
  '034-traderoute-cap.json', // A89: top-3 route cap + R1 base-arrows exclusion
  '035-upgrade-in-city.json', // N11: upgradeUnit in-city, veteran-carry, moves-min
  '036-upgrade-cost.json', // N11: the cost formula
  '037-upgrade-noupgrade.json', // N11: no successor -> noUpgrade
  '038-upgrade-rejections.json', // N11: notEnoughGold + notInCity
  '039-leonardo-workshop.json', // N11 3b: Leonardo auto-upgrade on tech acquisition
  '040-debug-commands.json', // A92: debug commands + the debugUsed taint in the hash
  '041-hut-gold.json', // N13/A4: a village grants gold (the simplest weighted-roll outcome)
  '042-hut-leonardo.json', // N13/A4 x N11: a hut-granted advance fires Leonardo (the marker-0056 promise)
  '043-leader-ransom.json', // N13/A4 R1: a lone barbarian leader kill pays a ransom (two-attack sequence)
  '044-hut-nullifier-tribe.json', // N13/A4: air entry nullifies a village; a ground unit founds an advanced tribe
  '011-offturn-prework.json', // A54: the self-scoped whitelist works off-turn; everything else keeps notYourTurn
  '046-settler-popcost.json', // §40: settler completion costs 1 pop; a size-1 city disbands (cross-language)
  '047-city-as-road.json', // §50: a city square chains roads for movement
  '048-city-road-river.json', // §50: the river caveat breaks the chain until Bridge Building
  '049-air-fighter-only.json', // air-truth: only a Fighter attacks a bomber in flight
  '050-bomber-ignores-walls.json', // air-truth: a bomber skips the City Walls multiplier
  '051-freesupport-upkeep.json', // air-truth: freeSupport units cost no shield upkeep
  '052-disaster-earthquake.json', // disasters: an earthquake destroys a building (cross-language RNG path)
  '053-trireme-loss.json', // naval-truth: the trireme open-sea gamble (cross-language)
  '054-difficulty-asymmetric.json', // difficulty #2158: human-gated ASYMMETRIC AI knobs (aiCostPct + aiFoodRows)
  '055-trireme-city-disband.json', // B27: a docked sea unit is lost when its coastal city disbands (not stranded on land)
  '056-manhattan-gate-blocks.json', // manhattan-gate #16: nuclear NOT buildable before the Manhattan Project
  '057-manhattan-gate-allows.json' // manhattan-gate #16: nuclear buildable once Manhattan is active
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
    assert.match(res.stdout, /checkpoint 100: 0x087c2c81\n/,
      'the Luau AI diverged from the JS soak trajectory — bisect with the divergence report tools');
  });

// naval-presence presence-1 (#2201 Q5): the ARCHIPELAGO naval witness — the EXECUTING
// cross-language proof that the naval code paths (M1 saturation-build / M2 sea-explore /
// M3 coastal-hug pathing / M2b pickup) fire IDENTICALLY in both engines on a seed where
// they engage. The continents soak above is a single landmass, so naval stays dormant there
// (its hash moved via the seaPathRadius rulesetHash stamp, not naval firing). This runs the
// SAME config on an archipelago and asserts JS == Luau bit-for-bit (computed live, no static
// pin — self-maintaining across future re-records).
test('luau ai: the archipelago naval witness reaches the turn-100 checkpoint bit-exact (JS==Luau)',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const { runSim } = require('./sim-driver.js');
    const js = await runSim({ seed: 20260712, civs: 4, width: 56, height: 35, turns: 100,
      rulesOverrides: { endYear: 9999, disastersEnabled: false }, chaos: true,
      mapType: 'archipelago', deepAt: [100], artifactsDir: false });
    const jsHash = js.checkpoints[100];
    const res = spawnSync('lune', ['run', 'luau/sim-smoke.luau', '100', 'archipelago'],
      { cwd: REPO, encoding: 'utf8', timeout: 180000 });
    assert.strictEqual(res.status, 0, `archipelago sim smoke failed:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, new RegExp(`checkpoint 100: ${jsHash}\\n`),
      `the Luau naval AI diverged from JS on an archipelago (naval-active) seed — JS=${jsHash}, luau said:\n${res.stdout}`);
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

// A82a: map-type preset anchors — each rules.mapTypes preset generates the
// SAME world in both engines (seed 42, 80x50, the two-player roster; the
// pinned hex values are the phase-2 contract). The 'continents' preset must
// equal the presetless default (the identity that keeps every golden still).
test('luau mapgen: map-type preset worlds match the JS engine and the pins',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const RULESET = require('./ruleset.js');
    const { createGame } = await import('../engine/mapgen.js');
    const { hashState } = await import('../shared/statehash.js');
    const PINS = {
      continents: '5da34ebf', pangaea: '360078ac',
      archipelago: 'cfe3e743', islands: '94d46ee6'
    };
    const players = [
      { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
      { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
    ];
    const world = mapType => {
      const options = { width: 80, height: 50, players };
      if (mapType) options.mapType = mapType;
      return hashState(createGame({ seed: 42, options }, RULESET));
    };

    const js = { default: world(null), unknown: world('doughnut') };
    for (const t of Object.keys(PINS)) {
      js[t] = world(t);
      assert.strictEqual((js[t] >>> 0).toString(16).padStart(8, '0'), PINS[t],
        `${t}: the JS world moved off its pinned anchor`);
    }
    assert.strictEqual(js.default, js.continents, 'continents = the identity default');
    assert.strictEqual(js.unknown, js.continents, 'unknown types clamp to the default');

    const res = spawnSync('lune', ['run', 'luau/maptype-hashes.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    assert.strictEqual(res.status, 0, `maptype harness failed:\n${res.stdout}\n${res.stderr}`);
    for (const [t, h] of Object.entries(js)) {
      assert.ok(res.stdout.includes(`maptype:${t}: ${h}`),
        `${t}: Luau must hash the world as ${h} — harness said:\n${res.stdout}`);
    }
  });

// FF-PARITY (architect grant @0acb4ef4 condition c, registered #1499): the
// cross-language fast-forward proof. roblox/selftest/fastforward-parity.{mjs,luau}
// each run a fixed-seed short probe age (25 turns + the ancient grant, the same
// loop/grant code as any turn count) and print one `ff-parity 0x... turn N grant N`
// line. The two must be BYTE-IDENTICAL and equal the pin. The pin moves with every
// ruleset edit (createGame stamps rulesetHash): 0x833b415c -> 0x61138a4f (N13 goody
// huts) -> 0x0fa110e7 (A59 civs.json personality) -> 0xfbf31566 (XII.5 victoryDrive
// gate) -> 0x1192dca7 (Calendar-545 yearSteps) -> 0xdff854f9 (xiv-ai §13 economy
// knobs) -> 0xbd75915f (xiv-ai §14 treasury/F1 knobs) -> 0x017162d4 (xiv-ai XII.5b
// space-as-project knobs) -> 0x3765cd25 (xiv-ai §12 settlerPathRadius knob) ->
// 0x7f492828 (§40 settlers popCost) -> 0xe3237208 (air-truth units.json flags) ->
// 0xc2e7c52f (barb-sea seaRaidChance) -> 0x5798799d (A91 pollution block + workTurns.clean) ->
// 0xb735adcb (XII.5b latch spaceThreatPatience) -> 0x84150295 (A91c nuclearBlast flag) ->
// 0x3ad8f233 (disasters block) -> 0x13fa7076 (danger-abandon: removed spaceThreatPatience) ->
// 0xb8965a25 (difficulty block #2155/#2158: difficulties table + createGame stamps state.difficulty) ->
// 0x9f2d8558 (manhattan-gate #16: manhattan-project effect {nukesEnabled} in wonders.json) ->
// 0x56d17745 (naval-presence presence-1 #2201: seaPathRadius knob in rules.json).
// -> 0xac983686 (space-war-hold #35: victoryDrive.holdPathPct knob in rules.json).
// -> 0x46a31622 (#29 A7 wonder-stragglers: 8 effect fields added to wonders.json — a stamp move).
// Re-pin here whenever a ruleset window moves it.
const FF_PARITY_PIN = 'ff-parity 0x46a31622 turn 25 grant 22';
test('luau fast-forward: the cross-language ff-parity probe matches JS and the pin',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, () => {
    const line = out => {
      const m = (out || '').match(/ff-parity 0x[0-9a-f]{8} turn \d+ grant \d+/);
      return m ? m[0] : null;
    };
    const js = spawnSync('node', ['roblox/selftest/fastforward-parity.mjs'],
      { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(js.status, 0, `JS ff-parity selftest failed:\n${js.stdout}\n${js.stderr}`);
    const luau = spawnSync('lune', ['run', 'roblox/selftest/fastforward-parity.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 120000 });
    assert.strictEqual(luau.status, 0, `luau ff-parity selftest failed:\n${luau.stdout}\n${luau.stderr}`);

    const jsLine = line(js.stdout), luauLine = line(luau.stdout);
    assert.ok(jsLine, `JS selftest printed no ff-parity line:\n${js.stdout}`);
    assert.strictEqual(luauLine, jsLine,
      `ff-parity diverged: JS "${jsLine}" != luau "${luauLine}" — the fast-forward twin broke`);
    assert.strictEqual(jsLine, FF_PARITY_PIN,
      `ff-parity moved off its pin — if a ruleset window moved it, re-record ${FF_PARITY_PIN}`);
  });

// SO17: the strategic snapshot (shared/strategic.js) must port byte-shaped so the
// Roblox spectator overlay reads the SAME derived read as the browser overlay +
// soak --stats. A shared crafted state (test/fixtures/strategic-state.json, a
// builder/aggressive/balanced trio exercising warring/expanding/building modes +
// mil/settlers/scouts/naval + a topGoal tie) is snapshotted per player in both
// languages; the per-player snapshot hashes must be identical. Golden-neutral.
test('luau strategic: strategicSnapshot matches the JS shared/strategic.js per player',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const fs = require('fs');
    const RULESET = require('./ruleset.js');
    const { strategicSnapshot } = await import('../shared/strategic.js');
    const { hashState } = await import('../shared/statehash.js');
    const state = JSON.parse(fs.readFileSync(path.join(REPO, 'test', 'fixtures', 'strategic-state.json'), 'utf8'));
    const res = spawnSync('lune', ['run', 'luau/strategic-check.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(res.status, 0, `strategic harness failed:\n${res.stdout}\n${res.stderr}`);
    for (const pid of state.playerOrder) {
      const h = '0x' + (hashState(strategicSnapshot(state, pid, RULESET)) >>> 0).toString(16).padStart(8, '0');
      assert.ok(res.stdout.includes(`strat:${pid}: ${h}`),
        `${pid}: luau strategicSnapshot must hash as ${h} — harness said:\n${res.stdout}`);
    }
  });

// A59: the leader-personality read seam (engine/leaders.js) must derive stances
// byte-identically in luau (the roblox client + D3 read it the same way). Hashes
// { civ:<id> -> stanceFromPersonality(personality) } over all 14 real leaders +
// { stance:<s> -> stanceFromPersonality(STANCE_AXES[s]) } (the fallback), so the
// derivation AND the fallback axes are pinned cross-language. Golden-neutral seam.
test('luau leaders: the A59 personality seam derives stances identically to engine/leaders.js',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const RULESET = require('./ruleset.js');
    const { stanceFromPersonality, STANCE_AXES } = await import('../engine/leaders.js');
    const { hashState } = await import('../shared/statehash.js');
    const r = {};
    for (const id of Object.keys(RULESET.civs)) r['civ:' + id] = stanceFromPersonality(RULESET.civs[id].personality);
    for (const s of Object.keys(STANCE_AXES)) r['stance:' + s] = stanceFromPersonality(STANCE_AXES[s]);
    const h = '0x' + (hashState(r) >>> 0).toString(16).padStart(8, '0');
    const res = spawnSync('lune', ['run', 'luau/leaders-check.luau'],
      { cwd: REPO, encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(res.status, 0, `leaders harness failed:\n${res.stdout}\n${res.stderr}`);
    assert.ok(res.stdout.includes(`leaders: ${h}`),
      `luau leaders seam must hash as ${h} — harness said:\n${res.stdout}`);
  });

// apollo-narrow (#2160): the positive cross-language witness for the Apollo build
// branch. The soak goldens never reach a space-COMMITTED civ (space-flight tech) in
// 400/519 turns, so runAiTurn on a crafted committed state is the ONLY check that the
// luau apollo twin picks apollo-program identically to the JS engine.
test('luau apollo-narrow: runAiTurn on a committed civ builds Apollo identically to JS',
  { skip: !lune && 'lune not installed (dev-only toolchain)' }, async () => {
    const RULESET = require('./ruleset.js');
    const fs = require('fs');
    const os = require('os');
    const ai = await import('../engine/ai.js');
    const { createEngine } = await import('../engine/index.js');
    const { hashState } = await import('../shared/statehash.js');
    const W = 30, H = 9, tiles = [];
    for (let i = 0; i < W * H; i++) tiles.push({ t: 'grassland' });
    // space-flight = Apollo's tech (+ the 'structural' part tech) but NOT plastics/
    // robotics: committed yet NOT spaceDriveEligible — the apollo-narrow target.
    const state = {
      version: 1, turn: 260, year: 1990, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
      map: { width: W, height: H, wrapX: false, tiles }, wonders: {}, nextUnitId: 50, nextCityId: 10,
      cities: { c1: { id: 'c1', name: 'Cap', owner: 'p1', x: 4, y: 4, pop: 6, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
      cityOrder: ['c1'],
      units: { d1: { id: 'd1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
      players: {
        p1: { id: 'p1', name: 'A', color: '#00f', human: false, alive: true, gold: 20, techs: ['space-flight'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50, stance: 'science' },
        p2: { id: 'p2', name: 'B', color: '#f00', human: false, alive: true, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }
      },
      rngState: 1
    };
    // radius-mismatch fix (#2187): a committed capital with a DISTANT enemy (cheb-3) also
    // builds Apollo — the fix's cross-language witness (pre-fix it would build a defender).
    const radius = JSON.parse(JSON.stringify(state));
    radius.units.e1 = { id: 'e1', type: 'phalanx', owner: 'p2', x: 7, y: 4, moves: 1, fortified: false, veteran: false };
    radius.players.p1.explored = Array.from({ length: W * H }, () => 1);
    const cases = [
      { name: 'no enemy', st: state },
      { name: 'distant (cheb-3) enemy', st: radius }
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-apollo-'));
    try {
      for (const c of cases) {
        const jsResult = ai.runAiTurn(createEngine(RULESET), JSON.parse(JSON.stringify(c.st)), 'p1', RULESET);
        assert.deepStrictEqual(jsResult.cities.c1.producing, { kind: 'wonder', id: 'apollo-program' },
          `JS: a committed civ builds Apollo (${c.name})`);
        const h = '0x' + (hashState(jsResult) >>> 0).toString(16).padStart(8, '0');
        const statePath = path.join(dir, 'apollo-state.json');
        fs.writeFileSync(statePath, JSON.stringify(c.st));
        const res = spawnSync('lune', ['run', 'luau/apollo-check.luau', statePath],
          { cwd: REPO, encoding: 'utf8', timeout: 60000 });
        assert.strictEqual(res.status, 0, `apollo harness failed (${c.name}):\n${res.stdout}\n${res.stderr}`);
        assert.ok(res.stdout.includes(`apollo: ${h}`),
          `luau apollo build must hash as ${h} (${c.name}) — harness said:\n${res.stdout}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

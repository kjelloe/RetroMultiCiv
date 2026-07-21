// Soak the all-AI simulation (test/sim-driver.js) across many seeds — the
// wide regression net behind the fixed-seed suite (docs/05-simulation-test.md).
//
//   node tools/soak.js --seeds 25 --turns 400 --civs 4 [--size medium]
//                      [--seed 123] [--natural] [--no-chaos] [--jobs N]
//                      [--difficulty godemperor] [--stats file.jsonl]
//
//   --seeds N       run seeds start..start+N-1 (default 5; env MULTICIV_SIM_SEEDS)
//   --seed N        run exactly one seed
//   --start N       first seed of the range (default 1)
//   --turns N       rounds per game (default 400)
//   --civs N        AI civilizations, 2..7 (default 4)
//   --size S        xsmall|small|medium|large|xlarge|huge (default medium = 80x50)
//   --natural       keep the standard endYear; every game must then reach a
//                   victory by the turn limit or the seed FAILS
//                   (default pushes endYear out so every game soaks all --turns)
//   --no-chaos      disable the deterministic chaos-command layer (on by
//                   default: buy/rates/workers/pillage/disband/volatile
//                   governments injected from a separate seeded stream)
//   --difficulty D  trainer|chieftain|warlord|prince|king|emperor|godemperor (default prince)
//                   override, same table as the client (godemperor = 2:
//                   the disorder/happiness stress run)
//   --jobs N        parallel seed processes (default: cores - 1)
//   --stats F       append one JSONL telemetry row per checkpoint + a final
//                   row per seed — chart balance drift across engine versions.
//                   On the CANONICAL config (7-civ medium no-chaos normal,
//                   ≥400t) also enforces the docs/05 §12 M-target FLOORS at
//                   t401 (median over seeds); a breach exits 1 (A93)
//   --enforce-floors id,id  H1 ratchet: only the LISTED floors fail the run
//                   on breach; unlisted breaches print as ⚠ advisory. No
//                   flag = every floor enforced (local runs stay strict).
//                   The nightly adds each floor's id as the N-track earns it.
//
// Invariants run every turn; deep audits + a summary line at each checkpoint.
// Goldens don't apply (seeds vary). Failures leave artifacts in debugging/sim/
// and exit 1.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { runSim, summarize, snapshot, loadModules } = require('../test/sim-driver.js');
const RULESET = require('../test/ruleset.js');

const SIZES = { // matches the client's MAP_SIZES (main.js)
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};
// The 7-level ladder (#2155): each id maps to its contentCitizens for reference —
// difficulty now flows into createGame as state.difficulty (the engine reads the
// full difficulties table), NOT as a contentCitizens rulesOverride. The values here
// are informational; only the KEYS (valid ids) gate --difficulty.
const DIFFICULTY = { trainer: 7, chieftain: 6, warlord: 5, prince: 4, king: 3, emperor: 2, godemperor: 1 };

// ── M-target regression FLOORS (docs/05-simulation-test.md §12, the
// "M-TARGETS PINNED (user session 2026-07-16 evening)" line) ────────────────
// The six user-pinned floors, enforced only on the CANONICAL measurement
// config (7-civ medium no-chaos normal) at t401, median over seeds. A breach
// fails the run LOUDLY — these are regression floors, not aspirations. The
// values below MIRROR docs/05 §12; that line and this table are the one source
// pair (edit both together). Non-canonical soaks (godemperor/natural/small/
// chaos) are a different distribution and skip the check.
const FLOOR_CONFIG = { civs: 7, size: 'medium', chaos: false, natural: false, difficulty: 'prince' };
const FLOOR_MIN_TURNS = 400; // floors are defined at t401 = a 400-round run
const FLOORS = [
  { key: 'M2-cities',    label: 'cities founded',       metric: 'cities',      cmp: '>=', value: 6  },
  // 28->27 re-pin (architect ruling #2164): the difficulty window made 'prince'
  // the canonical config (was 'medium'); barbAtkPct 75 (the sole default world-knob
  // move, control-diff verified) re-baselined the median pop 28->27. PROVISIONAL —
  // a 25-seed confirm (sim-runner, post-land) restores 28 if that median >= 28.
  { key: 'M3-pop',       label: 'total population',     metric: 'pop',         cmp: '>=', value: 27 },
  { key: 'M4-impr',      label: 'improvement %',        metric: 'imprPct',     cmp: '>=', value: 50 },
  { key: 'M10-buys',     label: 'rush-buys per civ',    metric: 'buys',        cmp: '>',  value: 0  },
  { key: 'M10-treasury', label: 'treasury climb (g/t)', metric: 'goldRate',    cmp: '<',  value: 50 },
  // resourceCov% has no telemetry column yet (sim-driver.snapshot emits no
  // resourceCov) — the check reports it PENDING until that column lands.
  { key: 'M-resourceCov', label: 'resource coverage %', metric: 'resourceCov', cmp: '>=', value: 80 }
];

function floorCmp(a, op, b) {
  if (op === '>=') return a >= b;
  if (op === '>') return a > b;
  if (op === '<=') return a <= b;
  if (op === '<') return a < b;
  return false;
}

function floorMedian(nums) {
  if (nums.length === 0) return null;
  const s = nums.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function isCanonicalFloorRun(opts) {
  return opts.civs === FLOOR_CONFIG.civs && opts.size === FLOOR_CONFIG.size
    && opts.chaos === FLOOR_CONFIG.chaos && opts.natural === FLOOR_CONFIG.natural
    && opts.difficulty === FLOOR_CONFIG.difficulty && opts.turns >= FLOOR_MIN_TURNS;
}

function readStatsRows(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  const rows = [];
  for (const line of text.split('\n')) {
    if (line.length === 0) continue;
    try { rows.push(JSON.parse(line)); } catch (e) { /* skip a partially-written line */ }
  }
  return rows;
}

// Median over seeds of each floor's metric at the final checkpoint (t401),
// scoped to THIS run's config + seed set so a re-used stats file can't leak
// stale rows in. Per-seed value = median across that seed's surviving civs;
// the reported value = median across seeds. goldRate is the per-civ treasury
// climb (gold gained over the last 100 turns / 100) — the "sustained climb"
// M10 caps.
function computeFloorReport(rows, opts, seeds) {
  const seedSet = {};
  for (const s of seeds) seedSet[s] = true;
  const cp = rows.filter(r => r.t === 'checkpoint' && seedSet[r.seed]
    && r.civs === opts.civs && r.size === opts.size && r.chaos === opts.chaos
    && r.natural === opts.natural && r.difficulty === opts.difficulty);
  if (cp.length === 0) return { applicable: false, reason: 'no matching checkpoint rows' };
  let finalTurn = 0;
  for (const r of cp) if (r.turn > finalTurn) finalTurn = r.turn;
  if (finalTurn < FLOOR_MIN_TURNS) {
    return { applicable: false, reason: `final checkpoint t${finalTurn} < t${FLOOR_MIN_TURNS}` };
  }
  const prevTurn = finalTurn - 100;
  const goldPrev = {}; // "seed:pid" -> gold at the previous checkpoint (for goldRate)
  const finalBySeed = {};
  for (const r of cp) {
    if (r.turn === prevTurn) for (const pl of r.players) goldPrev[r.seed + ':' + pl.id] = pl.gold;
    if (r.turn === finalTurn) finalBySeed[r.seed] = r;
  }
  const results = FLOORS.map(f => {
    const perSeed = [];
    let samples = 0;
    for (const seed of Object.keys(finalBySeed)) {
      const r = finalBySeed[seed];
      const vals = [];
      for (const pl of r.players) {
        if (pl.alive !== true) continue; // eliminated civs don't count toward floors
        let v;
        if (f.metric === 'goldRate') {
          const prev = goldPrev[seed + ':' + pl.id];
          if (prev === undefined) continue;
          v = (pl.gold - prev) / 100;
        } else {
          v = pl[f.metric];
        }
        if (v === undefined || v === null) continue;
        vals.push(v);
      }
      const m = floorMedian(vals);
      if (m !== null) { perSeed.push(m); samples += vals.length; }
    }
    if (samples === 0) return Object.assign({}, f, { measured: null, ok: null, pending: true });
    const measured = floorMedian(perSeed);
    return Object.assign({}, f, { measured, ok: floorCmp(measured, f.cmp, f.value), pending: false });
  });
  return { applicable: true, finalTurn, seeds: Object.keys(finalBySeed).length, results };
}

// Prints the floor table and returns the breach count (0 unless canonical &
// applicable & a floor missed). PENDING floors (no telemetry) never breach.
function reportFloors(statsFile, opts, seeds) {
  if (!isCanonicalFloorRun(opts)) {
    console.log(`floors: skipped — not the canonical config `
      + `(need ${FLOOR_CONFIG.civs}civ ${FLOOR_CONFIG.size} no-chaos normal ≥${FLOOR_MIN_TURNS}t)`);
    return 0;
  }
  const report = computeFloorReport(readStatsRows(statsFile), opts, seeds);
  if (!report.applicable) { console.log(`floors: not evaluated — ${report.reason}`); return 0; }
  console.log(`M-target floors @ t${report.finalTurn}, median over ${report.seeds} seed(s):`);
  const { failing, advisory } = splitBreaches(report.results, opts.enforceFloors || null);
  for (const r of report.results) {
    if (r.pending) { console.log(`  ⏳ ${r.key} ${r.label}: PENDING (no telemetry column)`); continue; }
    const mark = r.ok ? '✅' : failing.indexOf(r.key) !== -1 ? '❌' : '⚠';
    const shown = Math.round(r.measured * 100) / 100;
    console.log(`  ${mark} ${r.key} ${r.label}: ${shown} (floor ${r.cmp} ${r.value})`
      + (advisory.indexOf(r.key) !== -1 ? ' — advisory, not yet ratcheted' : ''));
  }
  if (failing.length > 0) console.log(`FLOOR BREACH: ${failing.length} enforced M-target(s) below floor — regression, failing loudly`);
  if (advisory.length > 0) console.log(`floor advisories: ${advisory.length} unratcheted target(s) still below floor (the N-track's live chase)`);
  return failing.length;
}

// A93 RATCHET: split the measured results' breaches into run-FAILING (the
// floor's id is on the enforced list — or the list is null, meaning every
// floor is enforced, the original strict behavior local runs keep) and
// ADVISORY (below floor but not yet ratcheted — the N-track's live targets).
function splitBreaches(results, enforced) {
  const failing = [];
  const advisory = [];
  for (const r of results) {
    if (r.pending || r.ok) continue;
    if (enforced === null || enforced.indexOf(r.key) !== -1) failing.push(r.key);
    else advisory.push(r.key);
  }
  return { failing, advisory };
}

// listed values are read off the real tables so the help never drifts from the
// flags parseArgs actually accepts (probe-scale.js:52 precedent).
const HELP = `AI-quality soak — headless all-AI playthroughs, invariants + exit-criteria telemetry.
usage: node tools/soak.js [options]
  --seeds N            number of seeds to run (default 5)
  --start N            first seed (window start; default 1)
  --seed N             run a single explicit seed (overrides --seeds/--start)
  --jobs N             parallel workers (default: cpus-1)
  --turns N            turns per playthrough (default 400)
  --civs N             civ count per game (default 4)
  --size <sz>          map size: ${Object.keys(SIZES).join(' | ')} (default medium)
  --difficulty <d>     ${Object.keys(DIFFICULTY).join(' | ')} (default prince)
  --natural            play until a victory instead of the fixed end year
  --no-chaos           disable the chaos-command injection
  --enforce-floors ids ratchet gates (comma-separated): ${FLOORS.map(f => f.key).join(',')}
  --stats <file>       write per-AI strategic + outcome telemetry rows to <file>
  -h, --help           show this help
(--worker is internal: a child spawned by --jobs.)`;

function parseArgs(argv) {
  const opts = {
    seeds: 5, start: 1, turns: 400, civs: 4, size: 'medium', natural: false,
    seed: null, chaos: true, difficulty: 'prince', jobs: Math.max(1, os.cpus().length - 1),
    stats: null, worker: false
  };
  if (process.env.MULTICIV_SIM_SEEDS !== undefined) opts.seeds = Number(process.env.MULTICIV_SIM_SEEDS);
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { console.log(HELP); process.exit(0); }
    else if (a === '--natural') opts.natural = true;
    else if (a === '--disasters') opts.disasters = true;
    else if (a === '--no-chaos') opts.chaos = false;
    else if (a === '--worker') opts.worker = true; // internal: child of --jobs
    else if (a === '--seeds') opts.seeds = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--start') opts.start = Number(argv[++i]);
    else if (a === '--turns') opts.turns = Number(argv[++i]);
    else if (a === '--civs') opts.civs = Number(argv[++i]);
    else if (a === '--jobs') opts.jobs = Number(argv[++i]);
    else if (a === '--stats') opts.stats = argv[++i];
    else if (a === '--enforce-floors') {
      opts.enforceFloors = String(argv[++i] || '').split(',').filter(s => s !== '');
      for (const k of opts.enforceFloors) {
        if (!FLOORS.some(f => f.key === k)) {
          console.error(`unknown floor id in --enforce-floors: ${k} (known: ${FLOORS.map(f => f.key).join(',')})`);
          process.exit(1);
        }
      }
    }
    else if (a === '--size') opts.size = argv[i + 1] in SIZES ? argv[++i] : opts.size;
    else if (a === '--difficulty') opts.difficulty = argv[i + 1] in DIFFICULTY ? argv[++i] : opts.difficulty;
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  return opts;
}

function rulesOverridesFor(opts) {
  const overrides = {};
  if (!opts.natural) overrides.endYear = 9999;
  // difficulty flows into createGame as state.difficulty (see runSim opts.difficulty),
  // NOT a contentCitizens rulesOverride — the engine reads the full difficulties table.
  // disasters default OFF in the sweep harness (the pinned floors + goldens stay stable);
  // --disasters turns them ON for the mandatory non-degeneracy witness (ship default is ON).
  overrides.disastersEnabled = opts.disasters === true;
  return overrides;
}

function appendStats(file, row) {
  // a fresh CI checkout has no debugging/sim/ (gitignored) — appendFileSync
  // creates files, not directories (the first nightly failed on exactly this)
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + '\n'); // O_APPEND: parallel-safe per line
}

// v1.5 diagnostics (ROW A): the per-AI strategic snapshot now lives in
// shared/strategic.js (ESM) so the client live overlay computes it the SAME
// way — never duplicated. Loaded once in main() via dynamic import (CJS→ESM);
// strategicRow just wraps it with the JSONL envelope (t/turn/id) the --stats
// rows carry, so the emitted rows stay byte-identical.
let strategicSnapshot = null; // set in main()
function strategicRow(state, pid, ruleset, turn) {
  const s = strategicSnapshot(state, pid, ruleset);
  return { t: 'strategic', turn, id: pid, stance: s.stance, gov: s.gov,
    mode: s.mode, threat: s.threat, units: s.units, producing: s.producing, topGoal: s.topGoal };
}

// XII.5b Q6 (witness, A-ruled #2052): the space-project measurement. The engine
// predicates (spaceCommitEligible/spaceCommitted/nextSsPart) are read here for a
// Node-only witness — zero engine-decision use, no luau twin. Loaded in main().
let spaceCommitEligible = null, spaceCommitted = null, nextSsPart = null;
// the space-flight prereq closure (apollo tech + each ss-part tech, prereqs
// walked) = the path-completion denominator. Harness-local BFS (mirrors the
// engine markTechPath semantics; measurement only, never a golden input).
function spaceFlightClosure(ruleset) {
  const out = {};
  const gate = ruleset.rules.ssFlight === undefined ? undefined : ruleset.rules.ssFlight.gateWonder;
  const apolloTech = gate !== undefined && ruleset.wonders[gate] !== undefined ? ruleset.wonders[gate].tech : '';
  const stack = [];
  if (apolloTech !== '') stack.push(apolloTech);
  const parts = ruleset.rules.ssParts === undefined ? {} : ruleset.rules.ssParts;
  for (const k of Object.keys(parts)) if (parts[k].tech !== undefined && parts[k].tech !== '') stack.push(parts[k].tech);
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === '' || out[id] === true) continue;
    out[id] = true;
    const def = ruleset.techs[id];
    const pre = def !== undefined && def.prereqs !== undefined ? def.prereqs : [];
    for (const p of pre) stack.push(p);
  }
  return out;
}
// per-civ accumulators, updated each strategic tick (every 10 turns; event turns
// like launch are read exact from ship.launched). Zero = not-yet / never.
function updateSpaceWitness(wit, state, round, closure) {
  const closureSize = Math.max(1, Object.keys(closure).length);
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    if (p === undefined || p.human === true) continue;
    let w = wit[pid];
    if (w === undefined) {
      w = wit[pid] = { eligibleTurn: 0, commitTurn: 0, abandonTurn: 0, abandonReason: '',
        wasCommitted: false, pathPct: 0, committedSamples: 0, offPathSamples: 0,
        ssPartStartTurn: 0, shipDoneTurn: 0, launchTurn: 0,
        threatAtCommit: '', threatAtLaunch: '', milAtCommit: 0, milFloorMin: 0 };
    }
    if (p.alive === false) continue; // dead civs freeze their record
    let known = 0; for (const t of p.techs) if (closure[t] === true) known++;
    w.pathPct = Math.round(100 * known / closureSize);
    const eligible = spaceCommitEligible(state, pid, RULESET);
    const committed = spaceCommitted(state, pid, RULESET);
    const snap = strategicSnapshot(state, pid, RULESET);
    const mil = snap.units.mil;
    if (eligible && w.eligibleTurn === 0) w.eligibleTurn = round;
    if (committed) {
      if (w.commitTurn === 0) { w.commitTurn = round; w.threatAtCommit = snap.threat; w.milAtCommit = mil; w.milFloorMin = mil; }
      w.committedSamples++;
      if (mil < w.milFloorMin) w.milFloorMin = mil;
      if (p.researching !== undefined && p.researching !== '' && closure[p.researching] !== true) w.offPathSamples++;
      w.wasCommitted = true;
    } else if (w.wasCommitted && w.abandonTurn === 0) {
      w.abandonTurn = round;
      w.abandonReason = !eligible ? 'ineligible'
        : (snap.threat !== 'none' && snap.threat !== 'low') ? 'threat'
        : (snap.mode !== 'building' && snap.mode !== 'expanding') ? 'warring' : 'other';
    }
    if (w.ssPartStartTurn === 0) {
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        if (c !== undefined && c.owner === pid && c.producing !== undefined && c.producing.kind === 'ss-part') { w.ssPartStartTurn = round; break; }
      }
    }
    const ship = p.spaceship;
    if (ship !== undefined) {
      if (w.shipDoneTurn === 0 && nextSsPart(ship, RULESET) === null) w.shipDoneTurn = round;
      if (w.launchTurn === 0 && ship.launched) { w.launchTurn = ship.launched; w.threatAtLaunch = snap.threat; }
    }
  }
}

async function runSeed(seed, opts, checkpoints, mods) {
  const [width, height] = SIZES[opts.size];
  const meta = {
    seed, civs: opts.civs, size: opts.size, turns: opts.turns,
    chaos: opts.chaos, natural: opts.natural, difficulty: opts.difficulty
  };
  const t0 = Date.now();
  const rankAt = {}; // v1.5: score-rank at each checkpoint (for comebacks/leadChanges)
  const closure = spaceFlightClosure(RULESET); // XII.5b Q6: path-completion denominator
  const spaceWit = {}; // XII.5b Q6: per-civ space-project witness accumulators
  const r = await runSim({
    seed, civs: opts.civs, width, height, turns: opts.turns,
    difficulty: opts.difficulty, // #2155: state.difficulty (all-AI => world knobs only)
    rulesOverrides: rulesOverridesFor(opts),
    chaos: opts.chaos,
    deepAt: checkpoints,
    strategicEvery: 10, // v1.5: ROW A cadence
    onStrategic: (state, round) => {
      if (!opts.stats) return;
      for (const pid of state.playerOrder) {
        if (state.players[pid].alive !== false && state.players[pid].human !== true) {
          appendStats(opts.stats, Object.assign({}, meta, strategicRow(state, pid, RULESET, state.turn)));
        }
      }
      updateSpaceWitness(spaceWit, state, round, closure); // XII.5b Q6
    },
    onCheckpoint: (state, round, hash, tel, contLabels) => {
      console.log(`  ${summarize(state, RULESET, mods)}`);
      const snap = snapshot(state, RULESET, mods, tel, contLabels);
      rankAt[round] = snap.players.filter(p => p.alive).sort((a, b) => (b.score || 0) - (a.score || 0)).map(p => p.id);
      if (opts.stats) appendStats(opts.stats, Object.assign({ t: 'checkpoint' }, meta, snap));
    }
  });
  const ms = Date.now() - t0;
  // v1.5 diagnostics (ROW B): one outcome row per game — victory shape + mobility.
  if (opts.stats && r.outcome) {
    const finalSnap = snapshot(r.state, RULESET, mods, r.tel, r.contLabels);
    const scores = finalSnap.players.filter(p => p.alive).map(p => p.score || 0).sort((a, b) => a - b);
    const leaders = [100, 200, 300, 400].map(t => rankAt[t] ? rankAt[t][0] : null).filter(Boolean);
    let leadChanges = 0; for (let i = 1; i < leaders.length; i++) if (leaders[i] !== leaders[i - 1]) leadChanges++;
    let comebacks = 0;
    if (rankAt[200] && rankAt[400]) {
      const n2 = rankAt[200].length, n4 = rankAt[400].length;
      for (const pid of rankAt[400].slice(0, Math.ceil(n4 / 2))) { const i2 = rankAt[200].indexOf(pid); if (i2 >= Math.ceil(n2 / 2)) comebacks++; }
    }
    // victoryType is conquest/score/timeout/space from state.winner; the XII.5b
    // 'space' witness rows below carry the per-civ space-race detail (A76/Q6).
    appendStats(opts.stats, Object.assign({ t: 'outcome',
      victoryType: r.outcome.victoryType, victoryTurn: r.outcome.victoryTurn,
      scoreSpread: scores.length ? Math.round(100 * scores[scores.length - 1] / Math.max(1, scores[0])) / 100 : null,
      comebacks, leadChanges, elimTimeline: r.outcome.elimTimeline.map(e => e.turn) }, meta));
    // XII.5b Q6 (witness contract): one 'space' row per civ that ever became
    // commit-eligible — the ally's 9-metric table for the sim-runner's sweep.
    const spaceWon = r.state.winner !== undefined && r.outcome.victoryType === 'space' ? r.state.winner : null;
    for (const pid of Object.keys(spaceWit)) {
      const w = spaceWit[pid];
      if (w.eligibleTurn === 0) continue; // only civs that reached the eligibility gate
      appendStats(opts.stats, Object.assign({ t: 'space', id: pid,
        eligibleTurn: w.eligibleTurn, commitTurn: w.commitTurn,
        abandonTurn: w.abandonTurn, abandonReason: w.abandonReason,
        pathPct: w.pathPct, offPathSamples: w.offPathSamples, committedSamples: w.committedSamples,
        ssPartStartTurn: w.ssPartStartTurn, shipDoneTurn: w.shipDoneTurn,
        launchTurn: w.launchTurn, victoryTurn: pid === spaceWon ? r.outcome.victoryTurn : 0,
        threatAtCommit: w.threatAtCommit, threatAtLaunch: w.threatAtLaunch,
        milAtCommit: w.milAtCommit, milFloorMin: w.milFloorMin }, meta));
    }
  }
  if (opts.natural && r.state.gameOver !== true) {
    throw new Error(`sim seed ${seed}: NO VICTORY by turn ${r.rounds} under natural rules (score victory was due at endYear)`);
  }
  const end = r.state.gameOver === true
    ? `game over turn ${r.rounds} (winner ${r.state.players[r.state.winner].name})`
    : 'reached turn limit';
  console.log(`seed ${seed}: OK — ${r.rounds} rounds, ${end}, final ${r.finalHash}, ${ms} ms (${Math.round(ms / r.rounds)} ms/turn)`);
  if (opts.stats) {
    appendStats(opts.stats, Object.assign({ t: 'result', ok: true, rounds: r.rounds, ms,
      gameOver: r.state.gameOver === true,
      winner: r.state.gameOver === true ? r.state.winner : '',
      finalHash: r.finalHash }, meta));
  }
}

// --jobs parallelism: re-invoke this script one seed per child process and
// relay each child's buffered output atomically (no interleaving).
function runSeedInChild(seed, opts) {
  return new Promise(resolve => {
    const args = [__filename, '--worker', '--seed', String(seed),
      '--turns', String(opts.turns), '--civs', String(opts.civs),
      '--size', opts.size, '--difficulty', opts.difficulty, '--jobs', '1'];
    if (opts.natural) args.push('--natural');
    if (!opts.chaos) args.push('--no-chaos');
    if (opts.stats) args.push('--stats', opts.stats);
    const proc = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { out += d; });
    proc.on('close', code => {
      process.stdout.write(out);
      resolve(code === 0);
    });
  });
}

async function main() {
  strategicSnapshot = (await import('../shared/strategic.js')).strategicSnapshot; // ROW-A seam
  const aiMod = await import('../engine/ai.js'); // XII.5b Q6: space-project witness predicates
  spaceCommitEligible = aiMod.spaceCommitEligible;
  spaceCommitted = aiMod.spaceCommitted;
  nextSsPart = aiMod.nextSsPart;
  const opts = parseArgs(process.argv);
  const [width, height] = SIZES[opts.size];
  const seeds = opts.seed !== null
    ? [opts.seed]
    : Array.from({ length: opts.seeds }, (_, i) => opts.start + i);
  const checkpoints = [];
  for (let t = 100; t <= opts.turns; t += 100) checkpoints.push(t);

  if (!opts.worker) {
    console.log(`soaking ${seeds.length} seed(s): ${opts.civs} AIs on ${width}x${height}, ${opts.turns} turns, `
      + `${opts.natural ? 'natural end year' : 'endYear pushed out'}, chaos ${opts.chaos ? 'on' : 'off'}, `
      + `difficulty ${opts.difficulty}, ${Math.min(opts.jobs, seeds.length)} job(s)`);
  }

  let failures = 0;
  if (opts.jobs > 1 && seeds.length > 1) {
    const queue = seeds.slice();
    async function drain() {
      while (queue.length > 0) {
        const ok = await runSeedInChild(queue.shift(), opts);
        if (!ok) failures++;
      }
    }
    const workers = [];
    for (let i = 0; i < Math.min(opts.jobs, seeds.length); i++) workers.push(drain());
    await Promise.all(workers);
  } else {
    const mods = await loadModules();
    for (const seed of seeds) {
      try {
        await runSeed(seed, opts, checkpoints, mods);
      } catch (e) {
        failures++;
        console.error(`seed ${seed}: FAIL — ${e.message}`);
      }
    }
  }

  let floorBreaches = 0;
  if (!opts.worker && opts.stats) floorBreaches = reportFloors(opts.stats, opts, seeds);

  if (!opts.worker) {
    console.log(failures === 0
      ? `all ${seeds.length} seed(s) clean`
      : `${failures}/${seeds.length} seed(s) FAILED — artifacts in debugging/sim/`);
    if (floorBreaches > 0) console.log(`M-target floor check FAILED: ${floorBreaches} breach(es)`);
  }
  process.exitCode = (failures === 0 && floorBreaches === 0) ? 0 : 1;
}

if (require.main === module) main();

module.exports = {
  FLOORS, FLOOR_CONFIG, FLOOR_MIN_TURNS,
  isCanonicalFloorRun, computeFloorReport, floorMedian, floorCmp, splitBreaches,
  spaceFlightClosure // XII.5b Q6: path-completion denominator (test guard)
};

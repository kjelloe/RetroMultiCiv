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
//   --difficulty D  trainer|easy|medium|hard|godemperor — contentCitizens
//                   override, same table as the client (godemperor = 2:
//                   the disorder/happiness stress run)
//   --jobs N        parallel seed processes (default: cores - 1)
//   --stats F       append one JSONL telemetry row per checkpoint + a final
//                   row per seed — chart balance drift across engine versions
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
const DIFFICULTY = { trainer: 6, easy: 5, medium: 4, hard: 3, godemperor: 2 };

function parseArgs(argv) {
  const opts = {
    seeds: 5, start: 1, turns: 400, civs: 4, size: 'medium', natural: false,
    seed: null, chaos: true, difficulty: 'medium', jobs: Math.max(1, os.cpus().length - 1),
    stats: null, worker: false
  };
  if (process.env.MULTICIV_SIM_SEEDS !== undefined) opts.seeds = Number(process.env.MULTICIV_SIM_SEEDS);
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--natural') opts.natural = true;
    else if (a === '--no-chaos') opts.chaos = false;
    else if (a === '--worker') opts.worker = true; // internal: child of --jobs
    else if (a === '--seeds') opts.seeds = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--start') opts.start = Number(argv[++i]);
    else if (a === '--turns') opts.turns = Number(argv[++i]);
    else if (a === '--civs') opts.civs = Number(argv[++i]);
    else if (a === '--jobs') opts.jobs = Number(argv[++i]);
    else if (a === '--stats') opts.stats = argv[++i];
    else if (a === '--size') opts.size = argv[i + 1] in SIZES ? argv[++i] : opts.size;
    else if (a === '--difficulty') opts.difficulty = argv[i + 1] in DIFFICULTY ? argv[++i] : opts.difficulty;
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  return opts;
}

function rulesOverridesFor(opts) {
  const overrides = {};
  if (!opts.natural) overrides.endYear = 9999;
  if (opts.difficulty !== 'medium') overrides.contentCitizens = DIFFICULTY[opts.difficulty];
  return overrides;
}

function appendStats(file, row) {
  // a fresh CI checkout has no debugging/sim/ (gitignored) — appendFileSync
  // creates files, not directories (the first nightly failed on exactly this)
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + '\n'); // O_APPEND: parallel-safe per line
}

async function runSeed(seed, opts, checkpoints, mods) {
  const [width, height] = SIZES[opts.size];
  const meta = {
    seed, civs: opts.civs, size: opts.size, turns: opts.turns,
    chaos: opts.chaos, natural: opts.natural, difficulty: opts.difficulty
  };
  const t0 = Date.now();
  const r = await runSim({
    seed, civs: opts.civs, width, height, turns: opts.turns,
    rulesOverrides: rulesOverridesFor(opts),
    chaos: opts.chaos,
    deepAt: checkpoints,
    onCheckpoint: (state) => {
      console.log(`  ${summarize(state, RULESET, mods)}`);
      if (opts.stats) appendStats(opts.stats, Object.assign({ t: 'checkpoint' }, meta, snapshot(state, RULESET, mods)));
    }
  });
  const ms = Date.now() - t0;
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

  if (!opts.worker) {
    console.log(failures === 0
      ? `all ${seeds.length} seed(s) clean`
      : `${failures}/${seeds.length} seed(s) FAILED — artifacts in debugging/sim/`);
  }
  process.exitCode = failures === 0 ? 0 : 1;
}

main();

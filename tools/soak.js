// Soak the all-AI simulation (test/sim-driver.js) across many seeds — the
// wide regression net behind the fixed-seed suite (docs/05-simulation-test.md).
//
//   node tools/soak.js --seeds 25 --turns 400 --civs 4 [--size medium]
//                      [--seed 123] [--natural] [--start 100]
//
//   --seeds N    run seeds start..start+N-1 (default 5; env MULTICIV_SIM_SEEDS)
//   --seed N     run exactly one seed
//   --start N    first seed of the range (default 1)
//   --turns N    rounds per game (default 400)
//   --civs N     AI civilizations, 2..7 (default 4)
//   --size S     xsmall|small|medium|large|xlarge|huge (default medium = 80x50)
//   --natural    keep the standard endYear (games end ~turn 306 on score);
//                default pushes endYear out so every game soaks all --turns
//
// Invariants run every turn; deep audits + a summary line at each checkpoint.
// Goldens don't apply (seeds vary). Failures leave artifacts in debugging/sim/
// and exit 1.
const { runSim, summarize, loadModules } = require('../test/sim-driver.js');
const RULESET = require('../test/ruleset.js');

const SIZES = {
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [100, 62], xlarge: [120, 75], huge: [160, 100]
};

function parseArgs(argv) {
  const opts = { seeds: 5, start: 1, turns: 400, civs: 4, size: 'medium', natural: false, seed: null };
  if (process.env.MULTICIV_SIM_SEEDS !== undefined) opts.seeds = Number(process.env.MULTICIV_SIM_SEEDS);
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--natural') opts.natural = true;
    else if (a === '--seeds') opts.seeds = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--start') opts.start = Number(argv[++i]);
    else if (a === '--turns') opts.turns = Number(argv[++i]);
    else if (a === '--civs') opts.civs = Number(argv[++i]);
    else if (a === '--size') opts.size = argv[i + 1] in SIZES ? argv[++i] : opts.size;
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);
  const [width, height] = SIZES[opts.size];
  const seeds = opts.seed !== null
    ? [opts.seed]
    : Array.from({ length: opts.seeds }, (_, i) => opts.start + i);
  const checkpoints = [];
  for (let t = 100; t <= opts.turns; t += 100) checkpoints.push(t);
  const mods = await loadModules();

  console.log(`soaking ${seeds.length} seed(s): ${opts.civs} AIs on ${width}x${height}, ${opts.turns} turns, ${opts.natural ? 'natural end year' : 'endYear pushed out'}`);
  let failures = 0;
  for (const seed of seeds) {
    const t0 = Date.now();
    try {
      const r = await runSim({
        seed, civs: opts.civs, width, height, turns: opts.turns,
        rulesOverrides: opts.natural ? undefined : { endYear: 9999 },
        deepAt: checkpoints,
        onCheckpoint: (state) => console.log(`  ${summarize(state, RULESET, mods)}`)
      });
      const ms = Date.now() - t0;
      const end = r.state.gameOver === true
        ? `game over turn ${r.rounds} (winner ${r.state.players[r.state.winner].name})`
        : `reached turn limit`;
      console.log(`seed ${seed}: OK — ${r.rounds} rounds, ${end}, final ${r.finalHash}, ${ms} ms (${Math.round(ms / r.rounds)} ms/turn)`);
    } catch (e) {
      failures++;
      console.error(`seed ${seed}: FAIL — ${e.message}`);
    }
  }
  console.log(failures === 0
    ? `all ${seeds.length} seed(s) clean`
    : `${failures}/${seeds.length} seed(s) FAILED — artifacts in debugging/sim/`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();

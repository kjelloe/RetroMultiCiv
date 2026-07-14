// A38 scaling probe: measure before shipping the 14-civ cap.
//   node tools/probe-scale.js --mode turns [--turns 200] [--civs 4,8,12,16] [--sizes large,xlarge] [--seed N]
//   node tools/probe-scale.js --mode fit   [--seeds 40]  [--civs 8,12,14,16] [--sizes small,medium,large,xlarge,huge]
//
// turns: pure engine cost — ms per AI turn and ms per full ROUND (the
// human-perceived wait A30's chunking made visible), first/second half
// split so late-game growth shows. No invariant overhead: this times the
// engine, not the test harness.
// fit: at which sizes do N legal starts reliably fit? mapgen relaxes its
// start spacing 12→0 in steps of 3 before failing outright, so the metric
// is the MIN PAIRWISE START DISTANCE actually achieved per seed — reported
// as the distribution plus a fit%% (min distance ≥ 6 = playable spacing,
// comfortably above the 3-ortho/2-diag city rule).
const RULESET = require('../test/ruleset.js');

const SIZES = { // matches the client's MAP_SIZES (main.js)
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};

// p1–p14 mirror test/sim-driver.js SIM_ROSTER; p15/p16 are the TEST-ONLY
// duplicated bodies the probe item calls for (measurement needs players,
// not distinct flags) — they never ship.
const CIVS14 = ['romans', 'egyptians', 'greeks', 'zulus', 'babylonians', 'chinese',
  'mongols', 'germans', 'americans', 'indians', 'russians', 'french', 'aztecs', 'english'];
function roster(n) {
  const players = [];
  for (let i = 0; i < n; i++) {
    const civ = CIVS14[i % CIVS14.length];
    players.push({
      id: 'p' + (i + 1), name: `${civ}-${i + 1}`, color: '#3b7dd8',
      human: false, civ
    });
  }
  return players;
}

function parseArgs(argv) {
  const opts = { mode: 'turns', turns: 200, seeds: 40, seed: 20260714, civs: null, sizes: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') opts.mode = argv[++i];
    else if (a === '--turns') opts.turns = Number(argv[++i]);
    else if (a === '--seeds') opts.seeds = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--civs') opts.civs = argv[++i].split(',').map(Number);
    else if (a === '--sizes') opts.sizes = argv[++i].split(',');
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

async function load() {
  const { createEngine } = await import('../engine/index.js');
  const ai = await import('../engine/ai.js');
  return { engine: createEngine(RULESET), ai };
}

function wrapDist(ax, ay, bx, by, width) {
  let dx = Math.abs(ax - bx);
  if (width - dx < dx) dx = width - dx;
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

async function modeTurns(opts) {
  const { engine, ai } = await load();
  const civsList = opts.civs || [4, 8, 12, 16];
  const sizesList = opts.sizes || ['large', 'xlarge'];
  console.log(`turns probe: seed ${opts.seed}, ${opts.turns} rounds, per-config (halves = rounds 1-${opts.turns / 2} / ${opts.turns / 2 + 1}-${opts.turns})`);
  console.log('size    civs  ms/turn h1  ms/turn h2  ms/ROUND h1  ms/ROUND h2  units@end');
  for (const size of sizesList) {
    const [width, height] = SIZES[size];
    for (const civs of civsList) {
      let state = engine.createGame({
        seed: opts.seed, options: { width, height, players: roster(civs) }
      });
      if (state.ok === false) {
        console.log(`${size.padEnd(7)} ${String(civs).padEnd(5)} createGame failed: ${state.reason}`);
        continue;
      }
      const roundMs = [];
      const half = Math.floor(opts.turns / 2);
      for (let round = 0; round < opts.turns && !state.gameOver; round++) {
        const t0 = process.hrtime.bigint();
        for (let g = 0; g < civs && !state.gameOver; g++) {
          const pid = state.activePlayer;
          state = ai.runAiTurn(engine, state, pid, RULESET);
          const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
          if (!res.ok) break;
          state = res.state;
        }
        roundMs.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
      const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const h1 = roundMs.slice(0, half), h2 = roundMs.slice(half);
      const line = [
        size.padEnd(7), String(civs).padEnd(5),
        (avg(h1) / civs).toFixed(1).padEnd(11), (avg(h2) / civs).toFixed(1).padEnd(11),
        avg(h1).toFixed(1).padEnd(12), avg(h2).toFixed(1).padEnd(12),
        String(Object.keys(state.units).length)
      ].join(' ');
      console.log(line + (state.gameOver ? `  (game over round ${roundMs.length})` : ''));
    }
  }
}

async function modeFit(opts) {
  const { engine } = await load();
  const civsList = opts.civs || [8, 12, 14, 16];
  const sizesList = opts.sizes || ['small', 'medium', 'large', 'xlarge', 'huge'];
  console.log(`fit probe: ${opts.seeds} seeds per cell (seeds ${opts.seed}..${opts.seed + opts.seeds - 1})`);
  console.log('size    civs  ok%%   fit%%(minDist>=6)  minDist distribution (worst seen first)');
  for (const size of sizesList) {
    const [width, height] = SIZES[size];
    for (const civs of civsList) {
      let ok = 0, fit = 0;
      const dists = [];
      for (let s = 0; s < opts.seeds; s++) {
        const state = engine.createGame({
          seed: opts.seed + s, options: { width, height, players: roster(civs) }
        });
        if (state.ok === false) continue;
        ok++;
        // starts = each player's settlers position at turn 0
        const starts = [];
        for (const u of Object.values(state.units)) starts.push({ x: u.x, y: u.y });
        let minDist = Infinity;
        for (let i = 0; i < starts.length; i++) {
          for (let j = i + 1; j < starts.length; j++) {
            const d = wrapDist(starts[i].x, starts[i].y, starts[j].x, starts[j].y, width);
            if (d < minDist) minDist = d;
          }
        }
        dists.push(minDist);
        if (minDist >= 6) fit++;
      }
      dists.sort((a, b) => a - b);
      const pct = n => (opts.seeds ? (100 * n / opts.seeds).toFixed(0) : '0');
      console.log([
        size.padEnd(7), String(civs).padEnd(5),
        (pct(ok) + '%').padEnd(6), (pct(fit) + '%').padEnd(17),
        dists.slice(0, 8).join(',') + (dists.length > 8 ? ',…' : '')
      ].join(' '));
    }
  }
}

(async () => {
  const opts = parseArgs(process.argv);
  if (opts.mode === 'turns') await modeTurns(opts);
  else if (opts.mode === 'fit') await modeFit(opts);
  else throw new Error(`unknown mode: ${opts.mode}`);
})().catch(e => { console.error(e.message); process.exit(1); });

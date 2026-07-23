'use strict';
// tools/bake-age-snapshots.js — PRE-BAKE the starting-age fast-forward states.
//
// WHY (user ask 2026-07-23): a later-age start (?age=industrial) runs the whole
// world as AI up to the age's turn via shared/fastforward.js — LIVE. In the
// browser that is a few seconds; on Roblox the same live walk is the slow path
// at createGame. Fix: bake the fast-forward states ONCE here on the dev PC and
// ship them as generated data so Roblox loads a snapshot instead of computing.
//
// The mechanism mirrors server/lobby.js's age-start genesis EXACTLY so a baked
// snapshot is byte-identical to what a live start would produce:
//   engine.createGame({ seed, options }) -> fastForwardTo(ruleset, raw, age, [])
// humanSeats is [] — the snapshot is NEUTRAL (every civ gets the era grant, no
// seat is flipped human); the human takeover happens at LOAD time, exactly like
// loading a save (game.js opts.initialState). The snapshot is SELF-CONTAINED
// (it carries its own roster), so a consumer loads the whole state.
//
// Output: data/age-snapshots/<age>-<size>-<seed>.json (one full state each) +
// manifest.json (turn / statehash / roster / abort per preset). This is a data/
// SUBDIR, NOT a top-level engine ruleset — golden-neutral by construction (no
// engine reads it; the twins count-check only looks at top-level data/*.json).
// The states are generated + regenerable (the --check mode proves any machine
// reproduces the pinned statehash), so the dir is gitignored like other bulky
// generated artifacts; the Roblox Luau conversion is the roblox/ lane's build
// step (roblox/ is roblox-helper-exclusive — this tool never writes there).
//
//   node tools/bake-age-snapshots.js           # write snapshots + manifest
//   node tools/bake-age-snapshots.js --check    # re-bake, compare hashes to the
//                                               # manifest, write nothing (CI/verify)
//
// ---- CONFIG: edit this grid to change what gets baked ----------------------
const SIZES = { small: [60, 38], medium: [80, 50] }; // mirror server/lobby.js SIZES
const DIFFICULTY = 'prince';
const COLORS = ['#3b7dd8', '#d84a3b', '#3bd87d', '#d8b13b', '#9b59d0', '#d07f3b', '#4fd0c9'];
// The default grid: a small seed × size × age cartesian at 7 civs …
const GRID = { seeds: [209052, 7, 42], sizes: ['small', 'medium'], ages: ['renaissance', 'industrial', 'modern'], civs: 7 };
// … plus explicit EXTRA presets carrying their own civ count (each snapshot is
// self-contained). #2306: the user's own reported config (14 civs / medium /
// the default seed), including the slow Space Age — pre-baking it is the point.
const EXTRA = [
  { seed: 209052, size: 'medium', age: 'renaissance', civs: 14 },
  { seed: 209052, size: 'medium', age: 'industrial', civs: 14 },
  { seed: 209052, size: 'medium', age: 'space', civs: 14 }
];
function presetList() {
  const out = [];
  for (const age of GRID.ages) for (const size of GRID.sizes) for (const seed of GRID.seeds) out.push({ seed, size, age, civs: GRID.civs });
  for (const p of EXTRA) out.push(p);
  return out;
}
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'age-snapshots');
const ruleset = require('../test/ruleset.js');

const MAPTYPE = 'continents'; // the browser's default (main.js) — must match to be usable

// Replicate the BROWSER's genesis EXACTLY (client/main.js): the lineup is the
// SORTED civ ids SEED-SHUFFLED (shared/civ-shuffle.js), first N, all AI. A ?civ
// pick (which moves a civ to the front) or a non-default maptype/difficulty
// produces a DIFFERENT world, so those simply won't match a preset (→ live ff).
function roster(shuffleRoster, n, seed) {
  const ids = shuffleRoster(Object.keys(ruleset.civs).sort(), seed).slice(0, n);
  return ids.map((civId, i) => ({
    id: 'p' + (i + 1),
    civ: civId,
    name: ruleset.civs[civId].name,
    color: ruleset.civs[civId].color || COLORS[i % COLORS.length],
    human: false
  }));
}

function ageEntry(id) {
  const a = ((ruleset.rules && ruleset.rules.ages) || []).find(x => x.id === id);
  if (!a) throw new Error(`unknown age "${id}" — not in data/rules.json ages`);
  return a;
}

async function bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, seed, size, ageId, civs) {
  const dims = SIZES[size];
  if (!dims) throw new Error(`unknown size "${size}"`);
  const age = ageEntry(ageId);
  const players = roster(shuffleRoster, civs, seed);
  const engine = createEngine(ruleset);
  const raw = engine.createGame({
    seed,
    options: { width: dims[0], height: dims[1], players, mapType: MAPTYPE, difficulty: DIFFICULTY }
  });
  if (raw && raw.ok === false) return { aborted: { reason: 'createFailed', detail: raw.reason } };
  const r = fastForwardTo(ruleset, raw, age, []); // humanSeats [] — neutral snapshot
  if (r.aborted) return { aborted: r.aborted };
  const hash = hashState(r.state); // throws on any non-portable type — validates the snapshot
  return { state: r.state, hash, turn: r.state.turn };
}

async function main() {
  const check = process.argv.includes('--check');
  const [{ createEngine }, ffMod, shMod, csMod] = await Promise.all([
    import('../engine/index.js'),
    import('../shared/fastforward.js'),
    import('../shared/statehash.js'),
    import('../shared/civ-shuffle.js')
  ]);
  const { fastForwardTo } = ffMod;
  const { hashState } = shMod;
  const { shuffleRoster } = csMod;

  if (!check) fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { generatedBy: 'tools/bake-age-snapshots.js', difficulty: DIFFICULTY, mapType: MAPTYPE, presets: [] };
  let baked = 0, aborted = 0, mismatched = 0;

  for (const p of presetList()) {
    const { seed, size, age: ageId, civs } = p;
    const name = `${ageId}-${size}-${seed}-c${civs}`;
    const t0 = Date.now();
    const res = await bakeOne(createEngine, fastForwardTo, hashState, shuffleRoster, seed, size, ageId, civs);
    const ms = Date.now() - t0;
    if (res.aborted) {
      aborted++;
      manifest.presets.push({ name, age: ageId, size, seed, civs, aborted: res.aborted });
      console.log(`ABORT  ${name} — ${res.aborted.reason}${res.aborted.name ? ' (' + res.aborted.name + ')' : ''} (${ms}ms)`);
      continue;
    }
    const hashHex = res.hash; // hashState already returns the canonical '0x…' string
    const file = `${name}.json`;
    const entry = { name, age: ageId, size, seed, civs, turn: res.turn, statehash: hashHex, file };
    manifest.presets.push(entry);
    if (check) {
      const prevPath = path.join(OUT_DIR, 'manifest.json');
      const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')) : { presets: [] };
      const was = (prev.presets || []).find(x => x.name === name);
      const ok = was && was.statehash === hashHex;
      if (!ok) mismatched++;
      console.log(`${ok ? 'OK   ' : 'DIFF '} ${name} turn ${res.turn} ${hashHex}${was ? ' (was ' + was.statehash + ')' : ' (new)'} (${ms}ms)`);
    } else {
      fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(res.state));
      baked++;
      console.log(`bake   ${name} turn ${res.turn} ${hashHex} (${ms}ms)`);
    }
  }

  if (!check) fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(check
    ? `\n--check: ${manifest.presets.length - aborted} verified, ${mismatched} mismatch, ${aborted} abort`
    : `\nwrote ${baked} snapshots + manifest.json to data/age-snapshots/ (${aborted} aborted preset(s))`);
  process.exit(check && mismatched > 0 ? 1 : 0);
}

module.exports = { bakeOne, roster, ageEntry, ruleset, presetList, GRID, EXTRA, SIZES, DIFFICULTY, OUT_DIR };

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

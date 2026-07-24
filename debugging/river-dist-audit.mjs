// River distribution audit (queue #35, architect ruling #2553 / re-scope #2557).
// READ-ONLY: measures the two code-backed M3-pop / M2-cities channels the river
// mapgen (#36) may drive, over the 25 canonical worlds (7-civ medium prince,
// seeds 1..25 — the FLOOR_CONFIG the soak floors measure on).
//
//   Channel 1 (M3-pop): river-flagged HILLS tiles — B19 makes MINE illegal on a
//     river tile, and springs are hills-biased, so strips systematically lock
//     hill-country shields. Count river tiles by terrain.
//   Channel 2 (M2-cities): AI city sites ON / ADJACENT-to a river tile — flood
//     popPct 25 + the +6 river founding score → possible over-founding on flood
//     plains. Needs founded cities → a bounded all-AI run per seed.
//   Channel 3: realized river coverage % of land per seed (target is RIVER_PCT=11).
//
// Usage: node debugging/river-dist-audit.mjs [maxSeed] [turns]
//        maxSeed default 25, turns default 150 (founding is ~complete by then).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const jf = (p) => JSON.parse(readFileSync(join(root, 'data', p), 'utf8'));
const RULESET = {
  terrain: jf('terrain.json'), units: jf('units.json'), techs: jf('techs.json'),
  buildings: jf('buildings.json'), wonders: jf('wonders.json'),
  governments: jf('governments.json'), civs: jf('civs.json'), rules: jf('rules.json')
};
const TERR = RULESET.terrain.terrains;

const ROSTER = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', civ: 'romans' },
  { id: 'p2', name: 'Egyptians', color: '#d8b13b', civ: 'egyptians' },
  { id: 'p3', name: 'Greeks', color: '#3bd87d', civ: 'greeks' },
  { id: 'p4', name: 'Zulus', color: '#d84a3b', civ: 'zulus' },
  { id: 'p5', name: 'Babylonians', color: '#9b59d0', civ: 'babylonians' },
  { id: 'p6', name: 'Chinese', color: '#d07f3b', civ: 'chinese' },
  { id: 'p7', name: 'Mongols', color: '#4fd0c9', civ: 'mongols' }
];

const maxSeed = Number(process.argv[2] || 25);
const turns = Number(process.argv[3] || 150);
const W = 80, H = 50;

function median(a) { if (a.length === 0) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10; }

const ai = await import('../engine/ai.js');
const { createEngine } = await import('../engine/index.js');
const engine = createEngine(RULESET);

// river flag is on land (land = non-ocean non-arctic, matching mapgen landCount).
function mapgenChannels(state) {
  const { width, height, tiles } = state.map;
  let land = 0, river = 0;
  const byTerr = {};
  for (let i = 0; i < width * height; i++) {
    const t = tiles[i];
    if (t.t !== 'ocean' && t.t !== 'arctic') land++;
    if (t.river === true) { river++; byTerr[t.t] = (byTerr[t.t] || 0) + 1; }
  }
  return { land, river, byTerr };
}

// a river tile in the 8-neighbourhood (or center) of (x,y). wrapX honoured.
function cityRiverExposure(map, x, y) {
  const { width, height, tiles, wrapX } = map;
  const center = tiles[y * width + x];
  const onRiver = center && center.river === true;
  let adj = false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx; const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      if (nx < 0 || nx >= width) { if (wrapX) nx = (nx + width) % width; else continue; }
      const t = tiles[ny * width + nx];
      if (t && t.river === true) adj = true;
    }
  }
  return { onRiver, adj };
}

const rows = [];
for (let seed = 1; seed <= maxSeed; seed++) {
  const players = ROSTER.map((p) => ({ id: p.id, name: p.name, color: p.color, civ: p.civ, human: false }));
  let state = engine.createGame({ seed, options: { width: W, height: H, players, difficulty: 'prince' } });
  if (state.ok === false) { console.error(`seed ${seed} createGame failed: ${state.reason}`); continue; }
  const mg = mapgenChannels(state);

  // bounded all-AI run so cities found (no chaos, no invariant checks — read-only).
  for (let round = 0; round < turns; round++) {
    for (const pid of state.playerOrder) {
      if (state.players[pid] && state.players[pid].alive === false) continue;
      state = ai.runAiTurn(engine, state, pid, RULESET);
      const r = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
      if (r.ok) state = r.state;
    }
  }

  let cities = 0, onRiver = 0, adjRiver = 0;
  for (const cid of (state.cityOrder || [])) {
    const c = state.cities[cid];
    if (!c) continue;
    cities++;
    const e = cityRiverExposure(state.map, c.x, c.y);
    if (e.onRiver) onRiver++;
    else if (e.adj) adjRiver++;
  }

  const riverHills = mg.byTerr.hills || 0;
  const row = {
    seed, land: mg.land, river: mg.river, cov: pct(mg.river, mg.land),
    riverHills, riverHillsPct: pct(riverHills, mg.river),
    cities, onRiver, adjRiver, exposedPct: pct(onRiver + adjRiver, cities), byTerr: mg.byTerr
  };
  rows.push(row);
  console.error(`seed ${String(seed).padStart(2)}: cov ${row.cov}% (${row.river}/${row.land} land) | river-hills ${riverHills} (${row.riverHillsPct}% of strips) | cities ${cities} on-river ${onRiver} adj ${adjRiver} (${row.exposedPct}% exposed)`);
}

// ---- summary ----
console.log('\n===== RIVER DISTRIBUTION AUDIT — 25 canonical worlds (7-civ medium prince) =====');
console.log(`target RIVER_PCT=11%, turns run=${turns}\n`);
console.log('CHANNEL 3 — realized river coverage of land:');
console.log(`  median ${median(rows.map(r => r.cov))}%  min ${Math.min(...rows.map(r => r.cov))}%  max ${Math.max(...rows.map(r => r.cov))}%`);
console.log('\nCHANNEL 1 — mine-locked hills (river-flagged hills; B19 = mine illegal):');
console.log(`  median river-hills/world ${median(rows.map(r => r.riverHills))}  median share-of-strips ${median(rows.map(r => r.riverHillsPct))}%`);
// terrain histogram of what the strips flag, summed over all worlds
const terrSum = {};
for (const r of rows) for (const k of Object.keys(r.byTerr)) terrSum[k] = (terrSum[k] || 0) + r.byTerr[k];
const terrTot = Object.values(terrSum).reduce((a, b) => a + b, 0);
console.log('  river-flag terrain histogram (all worlds):');
for (const k of Object.keys(terrSum).sort((a, b) => terrSum[b] - terrSum[a])) {
  const sh = TERR[k] ? (TERR[k].yields ? TERR[k].yields.shields : '?') : '?';
  const mineable = TERR[k] && TERR[k].mine ? `mine +${TERR[k].mine.shields}` : 'no-mine';
  console.log(`    ${k.padEnd(11)} ${String(terrSum[k]).padStart(5)}  ${pct(terrSum[k], terrTot)}%  (base shields ${sh}, ${mineable})`);
}
console.log('\nCHANNEL 2 — AI city river exposure (flood popPct 25 + founding score +6):');
console.log(`  median cities/world ${median(rows.map(r => r.cities))}`);
console.log(`  median on-river ${median(rows.map(r => r.onRiver))}  median adjacent ${median(rows.map(r => r.adjRiver))}  median exposed% ${median(rows.map(r => r.exposedPct))}%`);
console.log('\nper-seed rows (JSON):');
console.log(JSON.stringify(rows.map(({ byTerr, ...r }) => r)));

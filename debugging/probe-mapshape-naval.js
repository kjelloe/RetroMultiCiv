// W7 naval-acceptance probe (specs/map-shapes-w7.md "Gates & verification"): does the
// AI actually PLAY a water-heavy shape, or does it sit inert on one landmass? The naval
// arc's acceptance was archipelago-specific, so ring/inland-sea are unproven topology.
// Direct counts from final states — the hash tells you nothing about this.
//
//   node debugging/probe-mapshape-naval.js [seeds=5] [turns=200] [civs=7] [types=ring,inland-sea,oval]
//
// Per type: cities founded, % coastal cities, sea units alive, TRANSPORT-capable hulls
// built, overseas cities (a city on a landmass its owner did not start on — the real
// "did the AI cross water" signal), and any invariant breach text.
const { runSim } = require('../test/sim-driver.js');
const RULESET = require('../test/ruleset.js');

const seeds = Number(process.argv[2] || 5);
const turns = Number(process.argv[3] || 200);
const civs = Number(process.argv[4] || 7);
const TYPES = (process.argv[5] || 'ring,inland-sea,oval').split(',');

function isLand(state, x, y) {
  const t = state.map.tiles[y * state.map.width + x];
  return RULESET.terrain.terrains[t.t].domain === 'land';
}

// flood-fill land component ids (8-adjacent, wrapX honored) — the same "contiguous land
// = one continent" definition the naval AI uses (engine/ai.js landComponent).
function landComponents(state) {
  const W = state.map.width, H = state.map.height;
  const comp = {};
  let next = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (comp[idx] !== undefined || !isLand(state, x, y)) continue;
      const id = next++;
      const stack = [idx];
      comp[idx] = id;
      while (stack.length > 0) {
        const cur = stack.pop();
        const cx = cur % W, cy = Math.floor(cur / W);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            let nx = cx + dx;
            if (nx < 0 || nx >= W) { if (state.map.wrapX !== true) continue; nx = ((nx % W) + W) % W; }
            const ny = cy + dy;
            if (ny < 0 || ny >= H) continue;
            const nidx = ny * W + nx;
            if (comp[nidx] !== undefined || !isLand(state, nx, ny)) continue;
            comp[nidx] = id;
            stack.push(nidx);
          }
        }
      }
    }
  }
  return comp;
}

function coastal(state, c) {
  const W = state.map.width, H = state.map.height;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      let x = c.x + dx;
      if (x < 0 || x >= W) { if (state.map.wrapX !== true) continue; x = ((x % W) + W) % W; }
      const y = c.y + dy;
      if (y < 0 || y >= H) continue;
      if (!isLand(state, x, y)) return true;
    }
  }
  return false;
}

async function main() {
  for (const mapType of TYPES) {
    const tot = { cities: 0, coastal: 0, sea: 0, carriers: 0, overseas: 0, games: 0, breaches: [] };
    for (let s = 1; s <= seeds; s++) {
      let r;
      try {
        r = await runSim({ seed: s, civs, width: 80, height: 50, turns, mapType,
          rulesOverrides: { endYear: 9999, disastersEnabled: false }, chaos: false, artifactsDir: false });
      } catch (e) {
        tot.breaches.push(`seed ${s}: ${String(e.message || e).split('\n')[0]}`);
        continue;
      }
      const st = r.state;
      tot.games++;
      const comp = landComponents(st);
      // each player's HOME component = the component of its earliest city (cityOrder is
      // founding order, so the first entry per owner is its capital-by-founding)
      const home = {};
      for (const cid of st.cityOrder || []) {
        const c = st.cities[cid];
        if (c === undefined) continue;
        if (home[c.owner] === undefined) home[c.owner] = comp[c.y * st.map.width + c.x];
      }
      for (const cid of st.cityOrder || []) {
        const c = st.cities[cid];
        if (c === undefined) continue;
        tot.cities++;
        if (coastal(st, c)) tot.coastal++;
        if (comp[c.y * st.map.width + c.x] !== home[c.owner]) tot.overseas++;
      }
      for (const uid of Object.keys(st.units)) {
        const def = RULESET.units[st.units[uid].type];
        if (def.domain !== 'sea') continue;
        tot.sea++;
        if (def.transport !== undefined && def.transport > 0) tot.carriers++;
      }
    }
    const pct = (a, b) => b === 0 ? '0.0' : (100 * a / b).toFixed(1);
    console.log(`\n== ${mapType} (${tot.games}/${seeds} games, ${turns}t/${civs}civ) ==`);
    console.log(`cities ${tot.cities}  coastal ${tot.coastal} (${pct(tot.coastal, tot.cities)}%)`);
    console.log(`sea units alive ${tot.sea}  transport-capable ${tot.carriers}`);
    console.log(`OVERSEAS cities ${tot.overseas} <- the "AI crossed water" signal`);
    if (tot.breaches.length > 0) console.log(`BREACHES:\n  ${tot.breaches.join('\n  ')}`);
  }
}
main();

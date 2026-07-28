// W6-closing coverage probe (slices 3-5): direct counts from canonical final
// states — walls frontier-vs-interior (§3 "walls ONLY on the border"), role
// building routing, air arms, and the shakespeare-in-spawner sighting.
// Frontier proxy = distance to the nearest RIVAL city <= cityRoles.frontierRadius
// (the engine's own formula, recomputed here so the probe needs no engine
// exports). Usage: node debugging/probe-w6.js [seeds=3] [turns=400] [civs=7]
const { runSim } = require('../test/sim-driver.js');
const RULESET = require('../test/ruleset.js');

const seeds = Number(process.argv[2] || 3);
const turns = Number(process.argv[3] || 400);
const civs = Number(process.argv[4] || 7);

function cheb(map, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  return Math.max(dx, Math.abs(ay - by));
}

async function main() {
  const R = RULESET.rules.cityRoles.frontierRadius;
  const tot = {
    borderWalled: 0, borderBare: 0, interiorWalled: 0, interiorBare: 0,
    bombers: 0, fighters: 0, wondersBuilt: 0, shax: 0,
    barracks: 0, factory: 0, library: 0, university: 0, cities: 0
  };
  for (let s = 1; s <= seeds; s++) {
    const r = await runSim({ seed: s, civs, width: 80, height: 50, turns,
      rulesOverrides: { endYear: 9999, disastersEnabled: false }, chaos: false, artifactsDir: false });
    const st = r.state;
    for (const cid of st.cityOrder || []) {
      const c = st.cities[cid];
      if (!c) continue;
      tot.cities++;
      let border = false;
      for (const oid of st.cityOrder || []) {
        const o = st.cities[oid];
        if (!o || o.owner === c.owner) continue;
        if (cheb(st.map, c.x, c.y, o.x, o.y) <= R) { border = true; break; }
      }
      const b = c.buildings || [];
      const walled = b.indexOf('city-walls') !== -1;
      if (border) { walled ? tot.borderWalled++ : tot.borderBare++; }
      else { walled ? tot.interiorWalled++ : tot.interiorBare++; }
      for (const k of ['barracks', 'factory', 'library', 'university']) {
        if (b.indexOf(k) !== -1) tot[k]++;
      }
    }
    for (const uid of Object.keys(st.units)) {
      const d = RULESET.units[st.units[uid].type];
      if (d.domain !== 'air') continue;
      if (d.attacksAir === true) tot.fighters++;
      else if (d.nuclearBlast !== true) tot.bombers++;
    }
    const w = st.wonders || {};
    tot.wondersBuilt += Object.keys(w).length;
    if (w['shakespeare-s-theatre'] !== undefined) tot.shax++;
    console.log(`seed ${s}: done (${(st.cityOrder || []).length} cities)`);
  }
  const pct = (a, b) => b === 0 ? '0' : (100 * a / (a + b)).toFixed(1);
  console.log(`\n== W6 coverage over ${seeds} canonical seeds (${turns}t/${civs}civ) ==`);
  console.log(`cities ${tot.cities}`);
  console.log(`WALLS  border: ${tot.borderWalled}/${tot.borderWalled + tot.borderBare} (${pct(tot.borderWalled, tot.borderBare)}%)  interior: ${tot.interiorWalled}/${tot.interiorWalled + tot.interiorBare} (${pct(tot.interiorWalled, tot.interiorBare)}%)  <- border should dominate`);
  console.log(`ROLE BUILDINGS  barracks ${tot.barracks}  factory ${tot.factory}  library ${tot.library}  university ${tot.university}`);
  console.log(`AIR ARMS  bombers ${tot.bombers}  fighters ${tot.fighters} (alive at t${turns})`);
  console.log(`WONDERS built ${tot.wondersBuilt}  shakespeare games: ${tot.shax}/${seeds}`);
}
main();

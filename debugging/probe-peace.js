// Peace-witness v2 (user design 2026-07-26): TWO LOW-AGGRESSION CIVS on a large
// map — chinese + germans (defense-dominant personalities -> the 'defensive'
// stance: attackerPerCityPct 0, walls-first) so neither side runs the offensive
// army doctrine. The 2-civ head-slice attempt (#2768) was a DUEL (romans/
// egyptians head has Caesar aggression 75); this isolates low threat by CHOICE
// of personality, not by civ count. Measurement only — uses the sim-driver
// roster override; no engine surface.
//
//   node debugging/probe-peace.js [seeds=10] [turns=400]
//
// Reports per seed: cities, temple/granary coverage, other buildings, disorder,
// pop, alive civs, gameOver (a conquest ending = the pair still fought).
const { runSim } = require('../test/sim-driver.js');

const ROSTER = [
  { id: 'p1', name: 'Chinese', color: '#3b7dd8', civ: 'chinese' },
  { id: 'p2', name: 'Germans', color: '#d84a3b', civ: 'germans' }
];

(async () => {
  const seeds = Number(process.argv[2] || 10);
  const turns = Number(process.argv[3] || 400);
  for (let seed = 1; seed <= seeds; seed++) {
    const r = await runSim({
      seed, civs: 2, width: 100, height: 62, turns, chaos: false, roster: ROSTER
    });
    const s = r.state;
    let cities = 0, temples = 0, granaries = 0, other = 0, disorder = 0, pops = [];
    for (const cid of s.cityOrder || []) {
      const c = s.cities[cid];
      if (!c) continue;
      cities++;
      pops.push(c.pop);
      const b = c.buildings || [];
      if (b.indexOf('temple') !== -1) temples++;
      if (b.indexOf('granary') !== -1) granaries++;
      other += b.filter(x => x !== 'temple' && x !== 'granary').length;
      if (c.disorder === true) disorder++;
    }
    pops.sort((a, b) => a - b);
    let alive = 0, totalPop = 0;
    for (const pid of Object.keys(s.players)) if (s.players[pid].alive === true) alive++;
    for (const p of pops) totalPop += p;
    console.log(JSON.stringify({
      seed, rounds: r.rounds, gameOver: s.gameOver === true, winner: s.winner,
      aliveCivs: alive, cities, temples, granaries, otherBuildings: other,
      coveragePct: cities ? Math.round(100 * (temples + granaries) / (2 * cities)) : 0,
      disorder, medianPop: pops.length ? pops[Math.floor(pops.length / 2)] : 0, totalPop
    }));
  }
})();

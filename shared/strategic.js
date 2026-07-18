// The per-AI strategic snapshot (v1.5 telemetry ROW A): a PURE read of full
// game state into { stance, gov, mode, threat, units, producing, topGoal }.
// The INFERRED mode (vs the assigned stance) catches label-vs-behavior drift;
// the producing histogram is the standing N9 diagnostic. Shared so the soak
// --stats path (tools/soak.js) and the client live overlay (ui/strategic-
// overlay.js, ?debug=1 + spectators) compute it ONE way — never duplicated.
// Needs FULL state (all players' units/cities), so the client only calls it
// where it legitimately has that: a ?debug=1 local game or a spectator's
// omniscient view. Lua-portable subset (no class/this).
export function strategicSnapshot(state, pid, ruleset) {
  const U = ruleset.units;
  const threatR = ruleset.rules.threatRadius === undefined ? 8 : ruleset.rules.threatRadius;
  const W = state.map.width;
  const cheb = (ax, ay, bx, by) => { const dx = Math.min(Math.abs(ax - bx), W - Math.abs(ax - bx)); return Math.max(dx, Math.abs(ay - by)); };
  let mil = 0, settlers = 0, scouts = 0, naval = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid]; if (u.owner !== pid) continue; const d = U[u.type];
    if (u.type === 'settlers') settlers++; else if (d.domain === 'sea') naval++; else if (d.attack > 0) { mil++; if (d.moves >= 2) scouts++; }
  }
  const prod = { attacker: 0, settler: 0, defender: 0, building: 0, wonder: 0, other: 0 };
  const myCities = [];
  for (const cid of state.cityOrder) {
    const c = state.cities[cid]; if (c.owner !== pid) continue; myCities.push(c);
    const pr = c.producing; if (!pr) { prod.other++; continue; }
    if (pr.kind === 'building') prod.building++;
    else if (pr.kind === 'wonder') prod.wonder++;
    else if (pr.kind === 'unit') { if (pr.id === 'settlers') prod.settler++; else { const d = U[pr.id]; if (d && d.attack > 0 && d.attack >= d.defense) prod.attacker++; else if (d && d.defense > 0) prod.defender++; else prod.other++; } }
    else prod.other++;
  }
  let threat = 0;
  for (const uid of Object.keys(state.units)) {
    const u = state.units[uid]; if (u.owner === pid) continue;
    for (const c of myCities) { if (cheb(u.x, u.y, c.x, c.y) <= threatR) { threat++; break; } }
  }
  const threatBucket = threat === 0 ? 'none' : threat < 3 ? 'low' : threat < 8 ? 'med' : 'high';
  const mode = (prod.attacker > 0 && threat >= 3) ? 'warring'
    : prod.settler >= prod.building + prod.wonder && prod.settler > 0 ? 'expanding'
    : (prod.building + prod.wonder) > 0 ? 'building' : 'defending';
  const topGoal = Object.entries(prod).sort((a, b) => b[1] - a[1])[0][0];
  return {
    stance: (state.players[pid].stance || 'balanced'),
    gov: (state.players[pid].government || 'despotism'),
    mode, threat: threatBucket, units: { mil, settlers, scouts, naval }, producing: prod, topGoal
  };
}

#!/usr/bin/env node
// Balance summary of a soak --stats JSONL on the command line — the numbers
// the AI-quality exit criteria are scored on (docs/03 division of labour:
// median cities >= 4, stagnant < 10%). debugging/stats.html charts the same
// rows in a browser.
//
//   node debugging/stats-summary.js <stats.jsonl> [stagnantTechs=2]
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node debugging/stats-summary.js <stats.jsonl> [stagnantTechs]');
  process.exit(1);
}
const stagnantTechs = Number(process.argv[3] || 2);
const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(l => JSON.parse(l));

const last = {}; // seed -> deepest checkpoint row
for (const r of rows) {
  if (r.t === 'checkpoint') last[r.seed] = r;
}

const cities = [], techs = [];
let alive = 0, dead = 0, stagnant = 0;
const govs = {};
for (const cp of Object.values(last)) {
  for (const p of cp.players) {
    if (!p.alive) { dead++; continue; }
    alive++;
    cities.push(p.cities);
    techs.push(p.techs);
    govs[p.government] = (govs[p.government] || 0) + 1;
    if (p.techs <= stagnantTechs) stagnant++;
  }
}
cities.sort((a, b) => a - b);
techs.sort((a, b) => a - b);
const med = arr => arr.length ? arr[Math.floor(arr.length / 2)] : 0;
const avg = arr => arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '0';

const wins = {};
for (const r of rows) {
  if (r.t === 'result' && r.winner) wins[r.winner] = (wins[r.winner] || 0) + 1;
}

console.log(`${Object.keys(last).length} seeds · ${alive + dead} civ-instances · eliminated ${dead} (${Math.round(100 * dead / (alive + dead))}%)`);
console.log(`cities: median ${med(cities)} · avg ${avg(cities)} · max ${cities[cities.length - 1] || 0} · min ${cities[0] || 0}`);
console.log(`techs:  median ${med(techs)} · avg ${avg(techs)} · stagnant (<=${stagnantTechs}t) ${stagnant}/${alive} (${alive ? Math.round(100 * stagnant / alive) : 0}%)`);
console.log(`governments: ${Object.entries(govs).map(([g, n]) => `${g} ${n}`).join(' · ')}`);
console.log(`wins by seat: ${Object.entries(wins).map(([s, n]) => `${s}:${n}`).join(' ') || '(none)'}`);

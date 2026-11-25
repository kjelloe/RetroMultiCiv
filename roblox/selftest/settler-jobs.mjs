#!/usr/bin/env node
// check.sh gate 69: writes what the browser's chooseWork (client/ui/automate.js)
// answers for every land terrain x tile state x option set to the JSON file
// named on the command line; settler-jobs.luau holds SettlerJobs.chooseWork
// to it (the file is a temp file of the gate, never committed).
// automate.js is a browser module (imports the engine, touches localStorage),
// so its chooseWork + IMPROVE_PRIORITIES are lifted from the source text.
import { readFileSync, writeFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const src = readFileSync(U('../../client/ui/automate.js'), 'utf8');
const pri = src.match(/export const IMPROVE_PRIORITIES = (\[[^\]]*\]);/);
const start = src.indexOf('export function chooseWork(');
const end = src.indexOf('\n}\n', start);
if (!pri || start < 0 || end < 0) {
  console.error('settler-jobs: chooseWork / IMPROVE_PRIORITIES not found in automate.js');
  process.exit(1);
}
const body = src.slice(start, end + 2).replace('export function', 'function');
const chooseWork = new Function(`const IMPROVE_PRIORITIES = ${pri[1]};\n${body}\nreturn chooseWork;`)();
const priorities = eval(pri[1]);

const terrains = JSON.parse(readFileSync(U('../../data/terrain.json'), 'utf8')).terrains;
const flags = ['road', 'river', 'irrigation', 'mine', 'railroad'];
const cases = [];
for (const id of Object.keys(terrains).sort()) {
  const terrain = terrains[id];
  if (terrain.domain !== 'land') continue;
  for (let bits = 0; bits < 1 << flags.length; bits++) {
    const tile = { t: id };
    flags.forEach((f, i) => { if (bits & (1 << i)) tile[f] = true; });
    if (tile.irrigation && tile.mine) continue;
    if (tile.railroad && !tile.road) continue;
    for (let o = 0; o < 8; o++) {
      const base = { water: (o & 1) !== 0, knowsRail: (o & 2) !== 0, knowsBridge: (o & 4) !== 0 };
      for (const priority of [...priorities, 'bogus']) {
        const opts = { ...base, priority };
        cases.push({ tile, opts, work: chooseWork(tile, terrain, opts) || 'none' });
      }
    }
  }
}

const outFile = process.argv[2];
if (!outFile) {
  console.error('usage: node roblox/selftest/settler-jobs.mjs OUT.json');
  process.exit(2);
}
writeFileSync(outFile, JSON.stringify({ priorities, cases }));
console.log(`settler-jobs: ${cases.length} case(s) from automate.js`);

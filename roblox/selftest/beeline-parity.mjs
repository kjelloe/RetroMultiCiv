// check.sh gate 15, JS side: must print the IDENTICAL output as
// beeline-parity.luau. Sweeps EVERY tech as a beeline goal from empty-known and
// prints "goal=firstStep" per line (sorted) — exercises prereqClosure +
// researchableNow + the level/id tie-break across the whole DAG, so the Roblox
// Beeline.luau port can't drift from shared/beeline.js.
// Run from repo root: node roblox/selftest/beeline-parity.mjs
import { readFileSync } from 'node:fs';
import { nextBeelineStep } from '../../shared/beeline.js';

const techs = JSON.parse(readFileSync(new URL('../../data/techs.json', import.meta.url), 'utf8'));
const ids = Object.keys(techs).sort();
const out = [];
for (const g of ids) out.push(`${g}=${nextBeelineStep(techs, [], g)}`);
process.stdout.write(out.join('\n') + '\n');

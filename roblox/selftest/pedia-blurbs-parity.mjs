#!/usr/bin/env node
// check.sh gate 16 (run-F #9): the Roblox PediaBlurbs.luau UNIT_BLURBS +
// BUILDING_BLURBS tables are a 1:1 port of the browser canonical table
// client/ui/unit-building-blurbs.js (the tech-blurbs.js/gate-11 precedent —
// both platforms consume the SAME id->string tables), AND cover every ruleset
// unit (minus barbleader) + building. So a reworded ally line on either side,
// a paste typo, or a new unit/building without a blurb all fail. Text-scan of
// the Luau + a real import of the browser module.
import { readFileSync } from 'node:fs';

const { UNIT_BLURBS, BUILDING_BLURBS } = await import(new URL('../../client/ui/unit-building-blurbs.js', import.meta.url));
const src = readFileSync(new URL('../src/client/PediaBlurbs.luau', import.meta.url), 'utf8');
const units = JSON.parse(readFileSync(new URL('../../data/units.json', import.meta.url), 'utf8'));
const buildings = JSON.parse(readFileSync(new URL('../../data/buildings.json', import.meta.url), 'utf8'));

const parseLuau = (name) => {
  const start = src.indexOf('M.' + name + ' = {');
  const block = src.slice(start, src.indexOf('}', start));
  const out = {};
  for (const m of block.matchAll(/\["([a-z0-9-]+)"\]\s*=\s*"((?:[^"\\]|\\.)*)"/g)) out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return out;
};

const errs = [];
function compare(label, js, luau) {
  const jIds = new Set(Object.keys(js)), lIds = new Set(Object.keys(luau));
  for (const id of jIds) if (!lIds.has(id)) errs.push(`${label}: MISSING in Luau: ${id}`);
  for (const id of lIds) if (!jIds.has(id)) errs.push(`${label}: EXTRA in Luau: ${id}`);
  for (const id of jIds) if (lIds.has(id) && js[id] !== luau[id]) errs.push(`${label}: TEXT DIFFERS: ${id}\n  js:   ${js[id]}\n  luau: ${luau[id]}`);
}
const uLuau = parseLuau('UNIT_BLURBS'), bLuau = parseLuau('BUILDING_BLURBS');
compare('units', UNIT_BLURBS, uLuau);
compare('buildings', BUILDING_BLURBS, bLuau);

// coverage: every ruleset unit (minus barbleader) + every building has a blurb
for (const id of Object.keys(units.units || units)) {
  if (id !== 'barbleader' && uLuau[id] === undefined) errs.push(`coverage: unit ${id} has no blurb`);
}
for (const id of Object.keys(buildings.buildings || buildings)) {
  if (bLuau[id] === undefined) errs.push(`coverage: building ${id} has no blurb`);
}

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`pedia-blurbs-parity: ${Object.keys(uLuau).length} units + ${Object.keys(bLuau).length} buildings match browser table + cover rulesets`);

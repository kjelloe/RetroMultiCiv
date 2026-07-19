#!/usr/bin/env node
// check.sh gate 16 (run-F #9): the Roblox PediaBlurbs.luau UNIT_BLURBS +
// BUILDING_BLURBS tables are a verbatim port of the committed authoring source
// specs/ally-unit-building-blurb-response-2026-07-19.md, AND cover every unit
// (minus barbleader) + every building in the rulesets. So a reworded ally line,
// a paste typo, or a new unit/building without a blurb all fail. Text-scan.
import { readFileSync } from 'node:fs';

const md = readFileSync(new URL('../../specs/ally-unit-building-blurb-response-2026-07-19.md', import.meta.url), 'utf8');
const src = readFileSync(new URL('../src/client/PediaBlurbs.luau', import.meta.url), 'utf8');
const units = JSON.parse(readFileSync(new URL('../../data/units.json', import.meta.url), 'utf8'));
const buildings = JSON.parse(readFileSync(new URL('../../data/buildings.json', import.meta.url), 'utf8'));

const section = (name) => {
  const start = md.indexOf('## ' + name);
  const end = md.indexOf('\n## ', start + 3);
  return md.slice(start, end === -1 ? md.length : end);
};
const parseMd = (sec) => {
  const out = {};
  for (const m of sec.matchAll(/^-\s+`([^`]+)`\s*→\s*(.+?)\s*$/gm)) out[m[1]] = m[2];
  return out;
};
const parseLuau = (name) => {
  const start = src.indexOf('M.' + name + ' = {');
  const block = src.slice(start, src.indexOf('}', start));
  const out = {};
  for (const m of block.matchAll(/\["([a-z0-9-]+)"\]\s*=\s*"((?:[^"\\]|\\.)*)"/g)) out[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return out;
};

const errs = [];
function compare(label, md, luau) {
  const mIds = new Set(Object.keys(md)), lIds = new Set(Object.keys(luau));
  for (const id of mIds) if (!lIds.has(id)) errs.push(`${label}: MISSING in Luau: ${id}`);
  for (const id of lIds) if (!mIds.has(id)) errs.push(`${label}: EXTRA in Luau: ${id}`);
  for (const id of mIds) if (lIds.has(id) && md[id] !== luau[id]) errs.push(`${label}: TEXT DIFFERS: ${id}\n  md:   ${md[id]}\n  luau: ${luau[id]}`);
}
compare('units', parseMd(section('UNITS')), parseLuau('UNIT_BLURBS'));
compare('buildings', parseMd(section('BUILDINGS')), parseLuau('BUILDING_BLURBS'));

// coverage: every ruleset unit (minus barbleader) + every building has a blurb
const uLuau = parseLuau('UNIT_BLURBS'), bLuau = parseLuau('BUILDING_BLURBS');
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
console.log(`pedia-blurbs-parity: ${Object.keys(uLuau).length} units + ${Object.keys(bLuau).length} buildings match source + cover rulesets`);

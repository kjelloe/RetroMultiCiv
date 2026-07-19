#!/usr/bin/env node
// check.sh gate 12 (run-F #8 / architect #1742): the Roblox progressive city
// model must use the SHARED band contract shared/city-era.js, not invent its
// own bands. Asserts (a) ViewRenderer BAND_STYLE keys == CITY_ERA_BANDS, (b)
// ViewRenderer ERA_TO_BAND covers exactly the engine eras present in
// data/techs.json and maps each to a real band. So a band rename in the shared
// contract, a new engine era, or a Roblox-invented band all fail the gate.
// Text-scan of the Luau + a real import of the shared module.
import { readFileSync } from 'node:fs';

const { CITY_ERA_BANDS } = await import(new URL('../../shared/city-era.js', import.meta.url));
const techsDoc = JSON.parse(readFileSync(new URL('../../data/techs.json', import.meta.url), 'utf8'));
const src = readFileSync(new URL('../src/client/ViewRenderer.client.luau', import.meta.url), 'utf8');

const errs = [];

// (a) BAND_STYLE top-level keys == the shared band ids
const bsStart = src.indexOf('local BAND_STYLE = {');
const bsBlock = src.slice(bsStart, src.indexOf('local function cityEraBand'));
const bands = [...bsBlock.matchAll(/^\t(\w+) = \{/gm)].map((m) => m[1]);
const bandSet = new Set(bands);
const contractSet = new Set(CITY_ERA_BANDS);
for (const b of contractSet) if (!bandSet.has(b)) errs.push(`BAND_STYLE missing contract band: ${b}`);
for (const b of bandSet) if (!contractSet.has(b)) errs.push(`BAND_STYLE has non-contract band: ${b}`);

// (b) ERA_TO_BAND covers every engine era in techs.json, each -> a real band
const e2bBlock = src.slice(src.indexOf('local ERA_TO_BAND = {'));
const e2b = {};
for (const m of e2bBlock.slice(0, e2bBlock.indexOf('}')).matchAll(/(\w+)\s*=\s*"(\w+)"/g)) e2b[m[1]] = m[2];
const engineEras = new Set(Object.values(techsDoc).map((t) => t.era).filter(Boolean));
for (const era of engineEras) {
  if (e2b[era] === undefined) errs.push(`ERA_TO_BAND missing engine era: ${era}`);
  else if (!contractSet.has(e2b[era])) errs.push(`ERA_TO_BAND maps ${era} -> ${e2b[era]} (not a contract band)`);
}

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`city-era-parity: ${bands.length} bands match shared/city-era.js; ${engineEras.size} engine eras mapped`);

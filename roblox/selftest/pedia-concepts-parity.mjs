#!/usr/bin/env node
// check.sh gate 14 (#1726): the Roblox PediaConcepts.luau CONCEPT set is a port
// of the browser client/ui/pedia-concepts.js (A58c + ally editorial pass). The
// id-set must match exactly; bodies must match too EXCEPT documented
// platform-divergent entries (recordings — the Roblox body describes the
// Theater + resume codes instead of Shift+D). Bodies are normalized for the
// systematic em-dash -> hyphen transliteration + whitespace before comparing,
// so real content drift (a reworded sentence, a dropped concept) still fails.
// Text-scan of the Luau + a real import of the JS module.
import { readFileSync } from 'node:fs';

const DIVERGENT = new Set(['recordings']); // body intentionally Roblox-specific

const { CONCEPTS } = await import(new URL('../../client/ui/pedia-concepts.js', import.meta.url));
const src = readFileSync(new URL('../src/client/PediaConcepts.luau', import.meta.url), 'utf8');

const norm = (s) => s.replace(/[‒-―]/g, '-').replace(/\s+/g, ' ').trim();

const luau = {};
for (const m of src.matchAll(/id\s*=\s*"([a-z-]+)"[^]*?body\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
  luau[m[1]] = m[2];
}

const jsIds = new Set(CONCEPTS.map((c) => c.id));
const luauIds = new Set(Object.keys(luau));
const errs = [];
for (const id of jsIds) if (!luauIds.has(id)) errs.push(`MISSING in Luau: ${id}`);
for (const id of luauIds) if (!jsIds.has(id)) errs.push(`EXTRA in Luau: ${id}`);
for (const c of CONCEPTS) {
  if (!luauIds.has(c.id) || DIVERGENT.has(c.id)) continue;
  if (norm(c.body) !== norm(luau[c.id])) {
    errs.push(`BODY DIFFERS: ${c.id}\n  js:   ${norm(c.body)}\n  luau: ${norm(luau[c.id])}`);
  }
}

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`pedia-concepts-parity: ${jsIds.size} concepts match (${DIVERGENT.size} divergent body allowed)`);

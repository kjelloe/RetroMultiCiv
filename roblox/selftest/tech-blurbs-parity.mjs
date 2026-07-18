#!/usr/bin/env node
// check.sh gate 11: the Roblox DiscoveryCard.client.luau TECH_BLURBS table is
// a 1:1 port of the browser's client/ui/tech-blurbs.js (the one authoring
// source — ally §B1 original prose). This asserts id-set equality AND string
// equality so the two can never drift silently (a new advance, a reworded
// line, or a paste typo on either side fails the gate). Text-scan of the
// Luau + a real import of the JS module (no Luau execution), like gate 10.
import { readFileSync } from 'node:fs';

const { TECH_BLURBS } = await import(new URL('../../client/ui/tech-blurbs.js', import.meta.url));
const src = readFileSync(new URL('../src/client/DiscoveryCard.client.luau', import.meta.url), 'utf8');

// pull only the TECH_BLURBS table body, then its ["id"] = "line" rows
const body = src.slice(src.indexOf('local TECH_BLURBS = {'));
const luau = {};
for (const m of body.matchAll(/\["([a-z-]+)"\]\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
  luau[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

const jsIds = new Set(Object.keys(TECH_BLURBS));
const luauIds = new Set(Object.keys(luau));
const errs = [];
for (const id of jsIds) if (!luauIds.has(id)) errs.push(`MISSING in Luau: ${id}`);
for (const id of luauIds) if (!jsIds.has(id)) errs.push(`EXTRA in Luau: ${id}`);
for (const id of jsIds) {
  if (luauIds.has(id) && TECH_BLURBS[id] !== luau[id]) {
    errs.push(`TEXT DIFFERS: ${id}\n  js:   ${TECH_BLURBS[id]}\n  luau: ${luau[id]}`);
  }
}

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`tech-blurbs-parity: ${jsIds.size} blurbs match browser source`);

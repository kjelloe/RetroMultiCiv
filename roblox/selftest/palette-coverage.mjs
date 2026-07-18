#!/usr/bin/env node
// check.sh gate 10 (mirrors the browser's test/palette.test.js coverage
// pin): the Roblox Palette.luau deuteranopia table must map EVERY civ color
// — both the 14 data/civs.json `color` values (map labels / UI chips) and
// the 14 `visual.primary` values (carried for parity). A civ recolor or a
// hex typo would silently leave a civ un-remapped in accessibility mode;
// this catches it. Text-scan only (no Luau execution), like gates 3/5.
import { readFileSync } from 'node:fs';

const civs = JSON.parse(readFileSync(new URL('../../data/civs.json', import.meta.url), 'utf8'));
const src = readFileSync(new URL('../src/client/Palette.luau', import.meta.url), 'utf8');

// the deuteranopia-safe table's keys, exactly as written (case-sensitive —
// civ colors are stored lowercase, visual primaries uppercase)
const keys = new Set();
for (const m of src.matchAll(/\["(#[0-9a-fA-F]{6})"\]\s*=/g)) keys.add(m[1]);

const required = [];
for (const id of Object.keys(civs)) {
  const c = civs[id];
  if (c.color) required.push(['color', id, c.color]);
  if (c.visual && c.visual.primary) required.push(['visual.primary', id, c.visual.primary]);
}

const missing = required.filter(([, , hex]) => !keys.has(hex));
if (missing.length > 0) {
  for (const [field, id, hex] of missing) {
    console.error(`MISSING ${field} ${id} ${hex} — not a key in Palette.luau deuteranopia table`);
  }
  process.exit(1);
}
console.log(`palette-coverage: ${required.length} civ colors all mapped`);

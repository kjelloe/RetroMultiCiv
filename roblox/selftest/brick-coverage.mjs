#!/usr/bin/env node
// check.sh gate 18 (XIV §15 Studded/brick world style): the third world style
// must cover every terrain the enhanced style does (so no tile silently falls
// back), wire an EXPLICIT brick branch everywhere look is read (no
// fall-through to retro), surface as the player-facing label "Studded", and
// carry NO trademarked naming. Text-scan only (no Luau execution), like gates
// 10/11/12/13.
import { readFileSync } from 'node:fs';

const renderer = readFileSync(new URL('../src/client/ViewRenderer.client.luau', import.meta.url), 'utf8');
const assets = readFileSync(new URL('../src/client/AssetFactory.luau', import.meta.url), 'utf8');
const options = readFileSync(new URL('../src/client/Options.client.luau', import.meta.url), 'utf8');
const terrain = JSON.parse(readFileSync(new URL('../../data/terrain.json', import.meta.url), 'utf8'));

const errs = [];

// parse a `NAME = { grassland = ..., ... }` key set from the Luau source
const mapKeys = (src, name) => {
  const start = src.indexOf(name + ' = {');
  if (start < 0) return null;
  const block = src.slice(start, src.indexOf('}', start));
  return new Set([...block.matchAll(/([a-z]+)\s*=/g)].map((m) => m[1]));
};

const enh = mapKeys(renderer, 'ENHANCED_MATERIAL');
const brick = mapKeys(renderer, 'BRICK_MATERIAL');
if (!enh) errs.push('ENHANCED_MATERIAL not found in ViewRenderer');
if (!brick) errs.push('BRICK_MATERIAL not found in ViewRenderer — brick terrain map missing');

if (enh && brick) {
  // parity: brick covers exactly the terrains enhanced does (no silent gap)
  for (const id of enh) if (!brick.has(id)) errs.push(`BRICK_MATERIAL missing terrain '${id}' (ENHANCED_MATERIAL has it)`);
  for (const id of brick) if (!enh.has(id)) errs.push(`BRICK_MATERIAL has extra terrain '${id}' not in ENHANCED_MATERIAL`);
}

// every ruleset terrain id is covered by the brick map
if (brick) {
  for (const id of Object.keys(terrain.terrains)) {
    if (!brick.has(id)) errs.push(`coverage: terrain '${id}' has no BRICK_MATERIAL entry`);
  }
}

// EXPLICIT brick branch everywhere look is read (no fall-through to retro)
if (!/look\s*==\s*"brick"/.test(renderer)) errs.push('ViewRenderer lookOf/renderTerrain has no explicit `look == "brick"` branch');
if (!/look\s*==\s*"brick"/.test(assets)) errs.push('AssetFactory lookMaterial has no explicit `look == "brick"` branch');

// 3-way roster + player-facing "Studded" label, internal id stays brick
if (!/LOOKS\s*=\s*{[^}]*"brick"/.test(options)) errs.push('Options LOOKS roster does not include "brick"');
if (!/brick\s*=\s*"Studded"/.test(options)) errs.push('Options LOOK_LABEL does not map brick -> "Studded"');

// IP guard: no trademarked naming anywhere in the three touched files
for (const [label, src] of [['ViewRenderer', renderer], ['AssetFactory', assets], ['Options', options]]) {
  if (/lego/i.test(src)) errs.push(`IP: "${label}" contains a forbidden trademark string (lego)`);
}

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`brick-coverage: BRICK_MATERIAL covers ${brick.size} terrains (parity with enhanced) + explicit brick branches + "Studded" label, no trademark`);

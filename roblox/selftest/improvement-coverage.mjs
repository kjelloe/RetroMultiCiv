#!/usr/bin/env node
// check.sh gate 13 (run-F #5; CP1): every tile IMPROVEMENT flag the filterView
// twin emits (luau/visibility.luau: `tile.<field> = true`) must be drawn. Since
// CP1 the drawing lives in TileProps.luau (loop var `t.<field>`); ViewRenderer
// remains a valid site (`tile.<field>`). If a new improvement is added to the
// twin, neither can silently ignore it. Text-scan only, like gate 10/11/12.
import { readFileSync } from 'node:fs';

const vis = readFileSync(new URL('../../luau/visibility.luau', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/client/ViewRenderer.client.luau', import.meta.url), 'utf8')
  + '\n' + readFileSync(new URL('../src/client/TileProps.luau', import.meta.url), 'utf8');

// terrain/resource FEATURES the filter also copies as `tile.<field> = true`
// but which are NOT tile improvements (river shapes terrain elsewhere; special
// is a resource marker) — a new improvement flag is NOT added here, so it must
// be drawn to pass
const NOT_IMPROVEMENTS = new Set(['river', 'special']);

// the improvement booleans the filter copies onto explored tiles — captured as
// `tile.<field> = true`, which excludes tile.t / tile.visible (set differently)
const fields = new Set();
for (const m of vis.matchAll(/tile\.([a-zA-Z]+)\s*=\s*true/g)) {
  if (!NOT_IMPROVEMENTS.has(m[1])) fields.add(m[1]);
}

if (fields.size === 0) {
  console.error('no `tile.<field> = true` improvement flags parsed from luau/visibility.luau');
  process.exit(1);
}

const missing = [...fields].filter((f) => !renderer.includes(`tile.${f}`) && !new RegExp(`\\bt\\.${f}\\b`).test(renderer));
if (missing.length > 0) {
  for (const f of missing) console.error(`UNDRAWN improvement: filterView emits tile.${f} but neither ViewRenderer nor TileProps reads it`);
  process.exit(1);
}
console.log(`improvement-coverage: ${fields.size} improvement flags all drawn (${[...fields].sort().join(', ')})`);

#!/usr/bin/env node
// check.sh gate 25 (CP1 tile props): TileProps.luau is the props.js twin. It
// must (a) carry the SAME PROP_SHAPES recipe keys as client/renderer/three/
// recipes.js (the shared shape table — a drift either side is a real divergence),
// (b) port visualRand's exact constants (same scatter as the browser), (c) cover
// every terrain-feature branch props.js draws, and (d) be wired into the renderer.
// String-scan, both sides — a reword or a dropped branch fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const recipes = readFileSync(U('../../client/renderer/three/recipes.js'), 'utf8');
const propsJs = readFileSync(U('../../client/renderer/three/props.js'), 'utf8');
const luau = readFileSync(U('../src/client/TileProps.luau'), 'utf8');
const renderer = readFileSync(U('../src/client/ViewRenderer.client.luau'), 'utf8');

const errs = [];

// (a) PROP_SHAPES keys — extract the block from each source and compare the sets.
function keysBetween(src, startRe, keyRe) {
  const m = src.match(startRe);
  if (!m) return null;
  const body = src.slice(m.index + m[0].length);
  const end = body.search(/\n\}/); // table/object close: newline + '}' at line start (Lua '}' or JS '};')
  const block = end === -1 ? body : body.slice(0, end);
  const keys = new Set();
  let k;
  const re = new RegExp(keyRe, 'g');
  while ((k = re.exec(block)) !== null) keys.add(k[1]);
  return keys;
}
const jsKeys = keysBetween(recipes, /export const PROP_SHAPES = \{/, '(?:^|\\n)\\s*(\\w+):\\s*\\{');
const luaKeys = keysBetween(luau, /M\.PROP_SHAPES = \{/, '(?:^|\\n)\\s*(\\w+) = \\{');
if (!jsKeys) errs.push('could not locate PROP_SHAPES in recipes.js');
if (!luaKeys) errs.push('could not locate M.PROP_SHAPES in TileProps.luau');
if (jsKeys && luaKeys) {
  for (const k of jsKeys) if (!luaKeys.has(k)) errs.push(`PROP_SHAPES key missing in TileProps.luau: ${k}`);
  for (const k of luaKeys) if (!jsKeys.has(k)) errs.push(`PROP_SHAPES key extra in TileProps.luau (not in recipes.js): ${k}`);
  if (jsKeys.size < 15) errs.push(`suspiciously few PROP_SHAPES keys parsed (${jsKeys.size})`);
}

// (b) visualRand: the exact hashing constants must appear in both.
for (const c of ['374761393', '668265263', '2246822519', '1274126177']) {
  if (!propsJs.includes(c)) errs.push(`props.js missing visualRand constant ${c}`);
  if (!luau.includes(c)) errs.push(`TileProps.luau missing visualRand constant ${c}`);
}

// (c) terrain-feature branches props.js draws — each must survive in the port.
const branches = [
  ["t.t === 'forest'", 't.t == "forest"', 'forest/jungle trees'],
  ["t.t === 'hills'", 't.t == "hills"', 'hill rocks'],
  ["t.t === 'mountains'", 't.t == "mountains"', 'mountain peak+snow'],
  ["t.t === 'ocean'", 't.t == "ocean"', 'shore foam'],
  ['t.hut === true', 't.hut == true', 'goody-hut village'],
  ['t.special', 't.special', 'resource special'],
  ['t.railroad', 't.railroad', 'railroad ties'],
];
for (const [js, lua, why] of branches) {
  if (!propsJs.includes(js)) errs.push(`props.js missing branch (${why}): ${js}`);
  if (!luau.includes(lua)) errs.push(`TileProps.luau missing branch (${why}): ${lua}`);
}

// (d) the renderer wires it.
if (!renderer.includes('TileProps.rebuild')) errs.push('ViewRenderer does not call TileProps.rebuild');
if (!renderer.includes('require(script.Parent:WaitForChild("TileProps"))')) errs.push('ViewRenderer does not require TileProps');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`tile-props-parity: PROP_SHAPES key-for-key (${luaKeys.size}), visualRand + branches ported, renderer wired`);

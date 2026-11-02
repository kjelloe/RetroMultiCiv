#!/usr/bin/env node
// check.sh gate 32: the Roblox city-panel mood tooltip filters mood wonders by
// the same effect keys as the browser (client/ui/panels.js MOOD_WONDER_EFFECTS),
// every key exists in data/wonders.json, and the faces come from the shared
// happiness.cityMood. Text-scan of both sources.
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const js = rd('../../client/ui/panels.js');
const lua = rd('../src/client/CityPanel.client.luau');
const wonders = JSON.parse(rd('../../data/wonders.json'));

const errs = [];
const jsKeys = [...js.match(/const MOOD_WONDER_EFFECTS = \[([^\]]*)\]/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
const luaM = lua.match(/local MOOD_WONDER_EFFECTS = \{([^}]*)\}/);
const luaKeys = luaM ? [...luaM[1].matchAll(/"(\w+)"/g)].map((m) => m[1]) : [];
if (JSON.stringify(jsKeys) !== JSON.stringify(luaKeys)) errs.push(`keys differ: js=${jsKeys} luau=${luaKeys}`);

const carried = new Set(Object.values(wonders).flatMap((w) => Object.keys(w.effect || {})));
for (const k of jsKeys) if (!carried.has(k)) errs.push(`key not carried by data/wonders.json: ${k}`);
if (!lua.includes('happinessModule.cityMood')) errs.push('panel does not call shared happiness.cityMood');
for (const frag of ['born content', 'one citizen up per', 'content from buildings', 'mood wonders', 'each military unit abroad upsets'])
  if (!lua.includes(frag) || !js.includes(frag)) errs.push(`tooltip fragment missing: ${frag}`);

if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`city-mood parity ok (${jsKeys.length} keys)`);

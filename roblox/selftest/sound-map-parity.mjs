#!/usr/bin/env node
// check.sh gate 27 (SO15 sound): SoundMap.luau is the pure twin of the browser
// client/ui/sound-map.js — it must emit the SAME cue CATALOGUE (SOUND_IDS) and
// carry the SAME viewer-relative decisions (combat win/loss/distant, capture
// win/loss/distant, the own-vs-rival splits), and Sound.client must consume it
// via onEvents. String-scan both sides; a cue drift or a dropped mapping fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const browser = readFileSync(U('../../client/ui/sound-map.js'), 'utf8');
const luau = readFileSync(U('../src/client/SoundMap.luau'), 'utf8');
const player = readFileSync(U('../src/client/Sound.client.luau'), 'utf8');

const errs = [];

// SOUND_IDS catalogue — extract the quoted ids from each list and compare sets.
function ids(src, startRe) {
  const m = src.match(startRe);
  if (!m) return null;
  const body = src.slice(m.index + m[0].length);
  const end = body.search(/\]|\n\}/); // JS array ']' or Lua table close
  const block = body.slice(0, end === -1 ? body.length : end);
  const set = new Set();
  for (const q of block.matchAll(/['"]([a-z-]+)['"]/g)) set.add(q[1]);
  return set;
}
const bIds = ids(browser, /export const SOUND_IDS = \[/);
const lIds = ids(luau, /M\.SOUND_IDS = \{/);
if (!bIds) errs.push('could not parse SOUND_IDS from sound-map.js');
if (!lIds) errs.push('could not parse M.SOUND_IDS from SoundMap.luau');
if (bIds && lIds) {
  for (const id of bIds) if (!lIds.has(id)) errs.push(`SOUND_IDS cue missing in SoundMap.luau: ${id}`);
  for (const id of lIds) if (!bIds.has(id)) errs.push(`SOUND_IDS cue extra in SoundMap.luau (not in sound-map.js): ${id}`);
  if (bIds.size < 20) errs.push(`suspiciously few cues parsed (${bIds.size})`);
}

// anchor decisions — event type + the cues it earns must survive both sides.
const anchors = [
  ['combatResolved', ['combat-win', 'combat-loss', 'combat-distant']],
  ['cityCaptured', ['capture-win', 'capture-loss', 'capture-distant']],
  ['techDiscovered', ['tech']],
  ['wonderBuilt', ['wonder']],
  ['gameOver', ['victory', 'gameover']],
  ['playerDefeated', ['defeat', 'elimination']],
  ['governmentChanged', ['government']],
  ['shipLaunched', ['ship-launch']],
];
for (const [ev, cues] of anchors) {
  if (!browser.includes(ev)) errs.push(`sound-map.js missing event ${ev}`);
  if (!luau.includes(ev)) errs.push(`SoundMap.luau missing event ${ev}`);
  for (const c of cues) {
    if (!browser.includes(`'${c}'`)) errs.push(`sound-map.js missing cue '${c}' for ${ev}`);
    if (!luau.includes(`"${c}"`)) errs.push(`SoundMap.luau missing cue "${c}" for ${ev}`);
  }
}

// the player consumes the map via the event stream.
if (!player.includes('SoundMap.soundForEvent')) errs.push('Sound.client does not call SoundMap.soundForEvent');
if (!player.includes('ClientState.onEvents')) errs.push('Sound.client does not subscribe to onEvents');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log(`sound-map-parity: SOUND_IDS cue-for-cue (${lIds.size}), anchor decisions + player wire present`);

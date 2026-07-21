#!/usr/bin/env node
// check.sh gate 23 (MP4 regent stance-select): RegentDialog offers the same
// STANCES as client/ui/regency.js, the arm message carries the stance, and the
// GameServer feeds it to pickCommand — whose 5th 'stance' param BOTH engine
// twins accept (so no engine change). Two-sided string-scan (regency.js is
// DOM-bound, so scanned as text, not imported); a reword either side fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const regency = readFileSync(U('../../client/ui/regency.js'), 'utf8');
const dialog = readFileSync(U('../src/client/RegentDialog.client.luau'), 'utf8');
const clientState = readFileSync(U('../src/client/ClientState.luau'), 'utf8');
const hud = readFileSync(U('../src/client/Hud.client.luau'), 'utf8');
const server = readFileSync(U('../src/server/GameServer.server.luau'), 'utf8');
const luauAi = readFileSync(U('../../luau/ai.luau'), 'utf8');

const errs = [];
const needIn = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// the STANCES ids from the browser's regency.js literal (a reword there = re-port)
const STANCE_IDS = ['balanced', 'defensive', 'aggressive', 'science', 'growth'];
for (const id of STANCE_IDS) {
  needIn(regency, 'regency.js', `'${id}'`, 'browser STANCES id');
  needIn(dialog, 'RegentDialog.luau', `"${id}"`, 'dialog offers this stance');
}
// the browser sends the stance with the regent message
needIn(regency, 'regency.js', "t: 'regent', stance", 'browser sends stance');

// the Roblox client carries the stance on the away arm + opens the picker
needIn(clientState, 'ClientState.luau', 'stance = stance', 'setAway carries the stance');
needIn(clientState, 'ClientState.luau', 'M.openRegent', 'the dialog-open hook');
needIn(dialog, 'RegentDialog.luau', 'setAway(true, id)', 'dialog arms with the picked stance');
needIn(dialog, 'RegentDialog.luau', 'ClientState.openRegent =', 'dialog registers the hook');
needIn(hud, 'Hud.client.luau', 'openRegent', 'the 🤖 button opens the picker');

// the GameServer stores + feeds the stance to pickCommand (no engine change)
needIn(server, 'GameServer.server.luau', 'regentStance', 'server stores the per-seat stance');
needIn(server, 'GameServer.server.luau', 'regentStance[pid] = on and msg.stance', 'server records the picked stance on arm');
needIn(server, 'GameServer.server.luau', 'done, regentStance[pid]', 'server feeds the stance to pickCommand');

// both engine twins accept the 5th stance param (the reason MP4 needs no engine change)
needIn(luauAi, 'luau/ai.luau', 'pickCommand(state: any, playerId: string, ruleset: any, done: any, stance: any)', 'luau pickCommand accepts stance');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('regent-stance-parity: RegentDialog STANCES match regency.js + stance wired client→GameServer→pickCommand (no engine change)');

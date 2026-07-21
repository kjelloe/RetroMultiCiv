#!/usr/bin/env node
// check.sh gate 22 (SO6 turn-log class filters): TurnLogClasses.luau is a 1:1
// port of client/ui/turnlog-classes.js (A39 LOG_CLASSES + classifyEvent), and
// TurnLog.client wires the filter. Two-sided: the browser classifyEvent is
// DRIVEN over a representative event per class (a browser change breaks it) and
// every event-type + class id it touches is required in the Luau (a Roblox
// reword breaks it). Mirrors the gate-19/20/21 pattern.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const { LOG_CLASSES, classifyEvent } = await import(U('../../client/ui/turnlog-classes.js'));
const lua = readFileSync(U('../src/client/TurnLogClasses.luau'), 'utf8');
const client = readFileSync(U('../src/client/TurnLog.client.luau'), 'utf8');

const errs = [];
const needIn = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// viewer p1; cityOwner: c1 -> p1 (own), else p2 (rival)
const cityOwner = (id) => (id === 'c1' ? 'p1' : 'p2');
// [event, expectedClass, note] — drives the browser mapping; each event type +
// each resulting class must also appear in the Luau.
const cases = [
  [{ type: 'combatResolved', attackerOwner: 'p1', defenderOwner: 'p2' }, 'combat', 'own attack'],
  [{ type: 'combatResolved', attackerOwner: 'p2', defenderOwner: 'p3' }, 'rival', 'rival battle'],
  [{ type: 'cityCaptured', from: 'p2', to: 'p1' }, 'cities', 'own capture'],
  [{ type: 'cityFounded', cityId: 'c1' }, 'cities', 'own city'],
  [{ type: 'cityFounded', cityId: 'c9' }, 'rival', 'rival city'],
  [{ type: 'improvementBuilt', owner: 'p1' }, 'cities', 'own tile improvement'],
  [{ type: 'techDiscovered', playerId: 'p1' }, 'research', 'own research'],
  [{ type: 'techDiscovered', playerId: 'p2' }, null, 'rival research not narrated'],
  [{ type: 'buildingSold', playerId: 'p2' }, null, 'rival sale not narrated'],
  [{ type: 'revolutionStarted', playerId: 'p1' }, 'cities', 'own revolution'],
  [{ type: 'governmentChanged', playerId: 'p1' }, 'cities', 'own gov change'],
  [{ type: 'saveCode' }, 'saves', 'save code'],
  [{ type: 'regentTurn' }, 'regent', 'regent turn'],
  [{ type: 'debugCommand' }, 'world', 'debug taint is public'],
  [{ type: 'wonderBuilt', wonder: 'pyramids' }, 'world', 'wonder is public'],
  [{ type: 'WAR_DECLARED' }, 'world', 'war news is public'],
  [{ type: 'gameOver' }, 'world', 'game over is public'],
];

const classesSeen = new Set();
for (const [e, expected, note] of cases) {
  const got = classifyEvent(e, 'p1', cityOwner);
  if (got !== expected) errs.push(`browser classifyEvent(${e.type}) = ${JSON.stringify(got)}, expected ${JSON.stringify(expected)} (${note}) — re-port the Luau`);
  needIn(lua, 'TurnLogClasses.luau', `"${e.type}"`, `case ${note}`);
  if (got !== null) classesSeen.add(got);
}
for (const cls of classesSeen) needIn(lua, 'TurnLogClasses.luau', `"${cls}"`, 'class id returned');

// LOG_CLASSES ids parity (the filter strip)
for (const c of LOG_CLASSES) {
  needIn(lua, 'TurnLogClasses.luau', `id = "${c.id}"`, 'LOG_CLASSES entry');
}
if (!/id:\s*'combat'/.test(readFileSync(U('../../client/ui/turnlog-classes.js'), 'utf8')) && !LOG_CLASSES.some(c => c.id === 'combat')) {
  errs.push('browser LOG_CLASSES lost the combat class');
}

// TurnLog.client wires the module + filter
needIn(client, 'TurnLog.client.luau', 'TurnLogClasses', 'client uses the ported mapping');
needIn(client, 'TurnLog.client.luau', 'classifyEvent', 'client classifies each event');
needIn(client, 'TurnLog.client.luau', 'filterEnabled', 'client tracks per-class enable');
needIn(client, 'TurnLog.client.luau', 'applyFilter', 'client re-applies visibility on toggle');
needIn(client, 'TurnLog.client.luau', 'fclass', 'client tags rows with the filter class');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('turnlog-classes-parity: TurnLogClasses.luau matches client/ui/turnlog-classes.js + filter wired');

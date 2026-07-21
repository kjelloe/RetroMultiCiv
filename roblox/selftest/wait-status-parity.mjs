#!/usr/bin/env node
// check.sh gate 20 (Tier-3 wait-status): WaitStatus.luau is a 1:1 port of
// client/ui/wait-status.js (A26 createWaitTracker + formatWait/formatSlowNote),
// and the HUD line reads the filtered view. Two-sided: each format fragment is
// derived by RENDERING the browser functions (a browser reword breaks it) AND
// checked in the Luau (a Roblox reword breaks it); the tracker's semantics
// (reset-on-turn-change, note-once-past-threshold, null-on-own-turn) are
// exercised on the JS side and their control markers asserted in the Luau.
// Mirrors the gate-19 pattern.
import { readFileSync } from 'node:fs';

const { createWaitTracker, formatWait, formatSlowNote } =
  await import(new URL('../../client/ui/wait-status.js', import.meta.url));
const lua = readFileSync(new URL('../src/client/WaitStatus.luau', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/client/WaitStatus.client.luau', import.meta.url), 'utf8');

const errs = [];
const needIn = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// --- format-string parity: render the browser strings, assert each fixed
//     fragment appears in BOTH the render and the Luau format ---
const waitStr = formatWait('Rome', 5);
const slowStr = formatSlowNote('Rome', 5);
const invariants = [
  [waitStr, '\u{23F3}', 'wait hourglass glyph'],   // ⏳
  [waitStr, ' is moving \u{00B7} ', 'wait phrase + middot'],
  [waitStr, 's', 'seconds suffix'],
  [slowStr, '\u{23F1}', 'slow-note stopwatch glyph'], // ⏱
  [slowStr, 'Waited ', 'slow-note phrase'],
  [slowStr, ' for ', 'slow-note target join'],
];
for (const [rendered, frag, why] of invariants) {
  if (!rendered.includes(frag)) errs.push(`browser render no longer contains ${JSON.stringify(frag)} (${why}) — regenerate the Luau port`);
  needIn(lua, 'WaitStatus.luau', frag, why);
}

// --- tracker-semantics parity: exercise the browser tracker, assert the
//     defining behaviours, then require the same control markers in the Luau ---
const t = createWaitTracker();
// own turn -> null
let r = t.update('p1', 'p1', 0, 0);
if (r.waitingFor !== null || r.elapsedSec !== 0) errs.push(`own-turn should yield null waitingFor: ${JSON.stringify(r)}`);
// p2's turn STARTS (turn change) -> clock resets, elapsed 0
r = t.update('p2', 'p1', 5000, 0);
if (r.waitingFor !== 'p2' || r.elapsedSec !== 0) errs.push(`turn-start should reset elapsed to 0: ${JSON.stringify(r)}`);
// same seat, 5s later, threshold 6 not yet crossed -> no note
r = t.update('p2', 'p1', 10000, 6);
if (r.elapsedSec !== 5 || r.note !== false) errs.push(`elapsed should accrue since turn start: ${JSON.stringify(r)}`);
// threshold crossed fires the note exactly once
r = t.update('p2', 'p1', 11000, 6);
if (r.note !== true) errs.push('note should fire once past threshold');
r = t.update('p2', 'p1', 12000, 6);
if (r.note !== false) errs.push('note must not refire within the same wait');
// turn change resets the clock
r = t.update('p3', 'p1', 12500, 0);
if (r.elapsedSec !== 0) errs.push(`turn change must reset elapsed: ${JSON.stringify(r)}`);

for (const marker of ['waitingFor', 'elapsedSec', 'thresholdSec', 'noted', 'createWaitTracker']) {
  needIn(lua, 'WaitStatus.luau', marker, 'tracker semantics');
}

// --- the HUD line wires the ported logic + reads the view ---
needIn(client, 'WaitStatus.client.luau', 'WaitStatus', 'client uses the ported module');
needIn(client, 'WaitStatus.client.luau', 'formatWait', 'client renders the wait line');
needIn(client, 'WaitStatus.client.luau', 'view.activePlayer', 'client reads the active seat');
needIn(client, 'WaitStatus.client.luau', 'view.you', 'client reads the viewer seat');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('wait-status-parity: WaitStatus.luau matches client/ui/wait-status.js (format + tracker semantics) + HUD wired');

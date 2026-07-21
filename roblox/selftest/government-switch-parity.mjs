#!/usr/bin/env node
// check.sh gate 21 (CP13 government switching): the GovernmentPanel switch row
// is a faithful mirror of client/ui/panels.js's gov-row (skip anarchy + current,
// tech-gate the rest, revolution countdown) and issues setGovernment, whose
// server-side reasons the client relies on. Two-sided: markers derived from the
// browser gov-row must appear in BOTH panels.js AND the Luau; the engine
// contract (the reject reasons + tech field) is asserted so the client's
// assumptions hold. A reword on either side, or an engine contract drift, fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const panels = readFileSync(U('../../client/ui/panels.js'), 'utf8');
const gov = readFileSync(U('../src/client/GovernmentPanel.client.luau'), 'utf8');
const engine = readFileSync(U('../../engine/government.js'), 'utf8');
const governments = JSON.parse(readFileSync(U('../../data/governments.json'), 'utf8'));

const errs = [];
const needIn = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// --- the browser gov-row contract (a reword there means re-port the Luau) ---
needIn(panels, 'panels.js', 'setGovernment', 'browser issues the revolution command');
needIn(panels, 'panels.js', "id === 'anarchy'", 'browser skips anarchy as an option');
needIn(panels, 'panels.js', 'me.techs.includes(gov.tech)', 'browser tech-gates each option');
needIn(panels, 'panels.js', 'revolutionTurns', 'browser shows the anarchy countdown');
needIn(panels, 'panels.js', 'pendingGovernment', 'browser names the pending government');

// --- the Luau mirrors each ---
needIn(gov, 'GovernmentPanel.luau', 'setGovernment', 'client issues the revolution command');
needIn(gov, 'GovernmentPanel.luau', 'hasTech', 'client tech-gates each option');
needIn(gov, 'GovernmentPanel.luau', '"anarchy"', 'client excludes anarchy from the order');
needIn(gov, 'GovernmentPanel.luau', 'revolutionTurns', 'client shows the anarchy countdown');
needIn(gov, 'GovernmentPanel.luau', 'pendingGovernment', 'client names the pending government');
needIn(gov, 'GovernmentPanel.luau', 'gov.tech', 'client reads the per-gov tech gate');

// --- the engine contract the client depends on (server judges these) ---
for (const reason of ['techRequired', 'inRevolution', 'badGovernment', 'alreadyGovernment']) {
  needIn(engine, 'engine/government.js', reason, 'setGovernment reject reason the client relies on');
}

// --- data: every switchable gov in the display order carries a tech gate field ---
for (const id of ['despotism', 'monarchy', 'communism', 'republic', 'democracy']) {
  if (!governments[id]) { errs.push(`governments.json missing ${id} (client display order)`); continue; }
  if (governments[id].tech === undefined) errs.push(`governments.json ${id} has no tech field (client tech-gate)`);
}

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('government-switch-parity: GovernmentPanel switch row mirrors panels.js gov-row + engine contract intact');

#!/usr/bin/env node
// check.sh gate 19 (D3 Tier-B): the Roblox DiplomacyView.luau relationLabel is
// a 1:1 port of shared/diplomacy-view.js relationLabel (the Foreign-relations
// panel's status line), and the panel reads the twin-exposed view.relations.
// Two-sided: each invariant is derived by rendering relationLabel (a browser
// reword breaks it) AND checked in the Luau (a Roblox reword breaks it).
// Mirrors the gate-17 pattern.
import { readFileSync } from 'node:fs';

const { relationLabel } = await import(new URL('../../shared/diplomacy-view.js', import.meta.url));
const dv = readFileSync(new URL('../src/client/DiplomacyView.luau', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/client/Diplomacy.client.luau', import.meta.url), 'utf8');

const errs = [];
const needIn = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// state stand-in: relationLabel touches only .relations + .turn. pairKey sorts
// the pair, so use ids that sort a<b and key accordingly.
const st = (entry) => ({ turn: 50, relations: entry ? { 'a|b': entry } : {}, players: {} });
const peaceExpiring = relationLabel(st({ state: 'peace', treatyTurn: 10, expiresTurn: 60 }), 'a', 'b');
const peacePerp = relationLabel(st({ state: 'peace', treatyTurn: 10 }), 'a', 'b');
const warSince = relationLabel(st({ state: 'war', treatyTurn: 20 }), 'a', 'b');
const warDefault = relationLabel(st(null), 'a', 'b');

// [renderedText, invariant, why] — each must appear in BOTH the render and the Luau.
const invariants = [
  [peaceExpiring, 'at peace', 'peace status'],
  [peaceExpiring, 'since turn ', 'treaty since-turn'],
  [peaceExpiring, '(until turn ', 'finite expiry'],
  [peacePerp, '(perpetual)', 'perpetual expiry'],
  [peaceExpiring, '\u{1F54A}', 'peace glyph'],
  [warSince, 'at war', 'war status'],
  [warSince, 'since turn ', 'war declaration turn'],
  [warDefault, '⚔', 'war glyph'],
];
for (const [text, frag, why] of invariants) {
  if (!text.includes(frag)) errs.push(`browser relationLabel no longer renders ${JSON.stringify(frag)} (${why}) — regenerate the Luau port`);
  needIn(dv, 'DiplomacyView.luau', frag, why);
}

// default (no entry / no map) must be plain "at war" both sides
if (warDefault.trim() !== '⚔ at war') errs.push(`browser default relation changed: ${JSON.stringify(warDefault)}`);

// the port must key relations by the sorted pair + expose the reads the panel uses
needIn(dv, 'DiplomacyView.luau', 'relations', 'reads view.relations (twin-exposed)');
needIn(dv, 'DiplomacyView.luau', 'reputationOf', 'reputation read');
needIn(dv, 'DiplomacyView.luau', 'expiresTurn', 'expired-peace reverts to war');

// the panel wires the logic module + reads the twin-exposed relations map
needIn(panel, 'Diplomacy.client.luau', 'DiplomacyView', 'panel uses the ported logic');
needIn(panel, 'Diplomacy.client.luau', 'relationLabel', 'panel shows the status line');
needIn(panel, 'Diplomacy.client.luau', 'view.you', 'panel reads the viewer');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('diplomacy-panel-parity: relationLabel (peace/war/perpetual/expiry) matches shared/diplomacy-view.js + panel wired');

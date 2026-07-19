#!/usr/bin/env node
// check.sh gate 17 (#1878, D3 diplomacy UI Tier-A): the Roblox
// TurnLog.client.luau diplomacyRow narrator is a 1:1 port of
// shared/diplomacy-view.js diplomacyEventRow, and the view-derived first-contact
// mirrors client/ui/turnlog.js scanContacts. Two-sided: each invariant is
// checked against BOTH the browser render (a browser reword breaks it) AND the
// Luau (a Roblox reword breaks it). Mirrors the gate-11/16 parity pattern.
import { readFileSync } from 'node:fs';

const { diplomacyEventRow } = await import(new URL('../../shared/diplomacy-view.js', import.meta.url));
const src = readFileSync(new URL('../src/client/TurnLog.client.luau', import.meta.url), 'utf8');

const errs = [];
const need = (frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in TurnLog.client.luau: ${JSON.stringify(frag)} (${why})`);
};

// civ display names + a "me = romans" viewpoint so one perspective is a PARTY
// (detail: reason/penalty/expiry) and the other is the WORLD (headline only).
const civName = (id) => ({ romans: 'Romans', greeks: 'Greeks' }[id] || String(id));
const asParty = { civName, isMine: (id) => id === 'romans' };
const asWorld = { civName, isMine: () => false };

const render = (e, opts) => {
  const row = diplomacyEventRow(e, opts);
  if (!row) { errs.push(`diplomacyEventRow returned null for ${e.type}`); return ''; }
  return row.text;
};
const warP = render({ type: 'WAR_DECLARED', attackerCivId: 'romans', defenderCivId: 'greeks', reason: 'border_pressure' }, asParty);
const warW = render({ type: 'WAR_DECLARED', attackerCivId: 'romans', defenderCivId: 'greeks', reason: 'border_pressure' }, asWorld);
const peaceP = render({ type: 'PEACE_TREATY_SIGNED', civAId: 'romans', civBId: 'greeks', expiresTurn: 0 }, asParty);
const peaceE = render({ type: 'PEACE_TREATY_SIGNED', civAId: 'romans', civBId: 'greeks', expiresTurn: 42 }, asParty);
const brokeP = render({ type: 'TREATY_BROKEN', breakerCivId: 'romans', injuredCivId: 'greeks', penalty: 'reputation_loss' }, asParty);
const brokeW = render({ type: 'TREATY_BROKEN', breakerCivId: 'romans', injuredCivId: 'greeks', penalty: 'reputation_loss' }, asWorld);

// [renderedText, invariant substring, why] — invariant must be in BOTH sides.
const invariants = [
  [warP, 'declares war on', 'war headline'],
  [warP, 'border pressure', 'REASON.border_pressure detail'],
  [warW, '\u{1F440}', 'world headline glyph'],
  [warP, '⚔', 'party war glyph'],
  [peaceP, 'sign peace', 'peace headline'],
  [peaceP, '(perpetual)', 'perpetual expiry'],
  [peaceP, '\u{1F54A}', 'peace glyph'],
  [peaceE, '(until turn ', 'finite expiry'],
  [brokeP, 'breaks the treaty with', 'betrayal headline'],
  [brokeP, 'reputation cost', 'PENALTY.reputation_loss detail'],
  [brokeW, '\u{1F440}', 'world headline glyph'],
];
for (const [text, sub, why] of invariants) {
  if (!text.includes(sub)) errs.push(`browser diplomacyEventRow no longer renders ${JSON.stringify(sub)} (${why}) — regenerate the Luau port`);
  need(sub, why);
}

// first contact is view-derived (turnlog.js scanContacts), not the engine event.
need('first contact: %s sighted', 'view-derived first contact (scanContacts parity)');
need('\u{1F441}', 'first-contact glyph');

// the three treaty events wired into the narrator + civIds resolve via the
// baked civs ruleset (the filtered view strips player.civ).
for (const t of ['WAR_DECLARED', 'PEACE_TREATY_SIGNED', 'TREATY_BROKEN']) need(t, `${t} wired into narrate`);
need('rs.civs', 'civId resolves via baked civs ruleset');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('diplomacy-turnlog-parity: 4 treaty renders + first-contact match diplomacyEventRow/scanContacts');

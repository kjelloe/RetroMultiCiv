#!/usr/bin/env node
// check.sh gate 26 (XII.6 Part C glyphs, Roblox fallback b per #2078 item 5):
// TechGlyphs.luau ships the 4 ERA FRAMES only (EditableImage motif path is
// Studio-runtime-gated). The era palette must match the browser
// client/ui/tech-glyphs.js ERA table EXACTLY (hex <-> Color3.fromRGB), for all
// four eras x three roles, and the shared module must be wired into the three
// tech surfaces. A colour drift either side, or a dropped wire, fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const browser = readFileSync(U('../../client/ui/tech-glyphs.js'), 'utf8');
const luau = readFileSync(U('../src/client/TechGlyphs.luau'), 'utf8');
const picker = readFileSync(U('../src/client/ResearchPicker.client.luau'), 'utf8');
const card = readFileSync(U('../src/client/DiscoveryCard.client.luau'), 'utf8');
const tree = readFileSync(U('../src/client/TechTree.client.luau'), 'utf8');

const errs = [];
const ERAS = ['ancient', 'renaissance', 'industrial', 'modern'];
const ROLES = ['edge', 'fill', 'ink'];

// browser ERA: `ancient: { edge: '#b9975b', fill: '#241d11', ink: '#ecdcb4' }`
function browserEra(era) {
  const m = browser.match(new RegExp(`${era}:\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  const out = {};
  for (const role of ROLES) {
    const h = m[1].match(new RegExp(`${role}:\\s*'#([0-9a-fA-F]{6})'`));
    if (h) out[role] = [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16)];
  }
  return out;
}
// luau ERA: `ancient = { edge = Color3.fromRGB(185, 151, 91), fill = ..., ink = ... }`
function luauEra(era) {
  const m = luau.match(new RegExp(`${era} = \\{([^\\n]*)\\}`));
  if (!m) return null;
  const out = {};
  for (const role of ROLES) {
    const r = m[1].match(new RegExp(`${role} = Color3\\.fromRGB\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`));
    if (r) out[role] = [+r[1], +r[2], +r[3]];
  }
  return out;
}

for (const era of ERAS) {
  const b = browserEra(era), l = luauEra(era);
  if (!b) { errs.push(`browser tech-glyphs.js missing era ${era}`); continue; }
  if (!l) { errs.push(`TechGlyphs.luau missing era ${era}`); continue; }
  for (const role of ROLES) {
    if (!b[role]) { errs.push(`browser ${era}.${role} unparsed`); continue; }
    if (!l[role]) { errs.push(`TechGlyphs.luau ${era}.${role} unparsed`); continue; }
    if (b[role].join(',') !== l[role].join(',')) {
      errs.push(`ERA colour drift ${era}.${role}: browser ${b[role]} vs luau ${l[role]}`);
    }
  }
}

// wired into the three tech surfaces + exposes the fallback badge
if (!luau.includes('function M.badge')) errs.push('TechGlyphs.luau missing the era-frame badge (M.badge)');
if (!picker.includes('TechGlyphs.badge')) errs.push('ResearchPicker does not place a TechGlyphs era badge');
if (!card.includes('TechGlyphs.colorOf')) errs.push('DiscoveryCard does not colour by TechGlyphs era');
if (!tree.includes('TechGlyphs.ERA')) errs.push('TechTree does not source the shared TechGlyphs palette');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('tech-glyphs-parity: 4 eras x 3 roles match tech-glyphs.js; era badge wired into picker/card/tree');

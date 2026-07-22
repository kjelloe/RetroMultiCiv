// check.sh gate 31 (SO18): the Roblox GlyphData.luau GLYPH motif table is a 1:1
// port of the browser client/ui/tech-glyphs.js GLYPH — the id set must match
// EXACTLY (all 68 techs, same ids), and every primitive KIND GlyphData uses must
// be handled by EditableGlyph.luau (the renderer's PRIMITIVE_KINDS coverage set).
// Text-scan both sides (no Luau execution; render fidelity is the Studio step,
// SPEC.md §4). Pure parity/coverage — golden-neutral.
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../../client/ui/tech-glyphs.js', import.meta.url), 'utf8');
const data = readFileSync(new URL('../src/client/GlyphData.luau', import.meta.url), 'utf8');
const rend = readFileSync(new URL('../src/client/EditableGlyph.luau', import.meta.url), 'utf8');

// browser GLYPH keys: top-level `  'id': [` entries inside the GLYPH object
const jsIds = new Set();
for (const m of js.matchAll(/^ {2}'([a-z0-9-]+)':/gm)) jsIds.add(m[1]);

// roblox GlyphData keys: `["id"] =`
const rbxIds = new Set();
for (const m of data.matchAll(/\["([a-z0-9-]+)"\]\s*=/g)) rbxIds.add(m[1]);

const errs = [];
for (const id of jsIds) if (!rbxIds.has(id)) errs.push(`MISSING in GlyphData: ${id}`);
for (const id of rbxIds) if (!jsIds.has(id)) errs.push(`EXTRA in GlyphData: ${id}`);
if (jsIds.size !== 68) errs.push(`browser GLYPH has ${jsIds.size} ids, expected 68`);

// primitive-kind coverage: every `p = "kind"` in GlyphData must be a KINDS key in EditableGlyph
const kinds = new Set();
for (const m of rend.matchAll(/\b([a-z]+)\s*=\s*true\b/g)) kinds.add(m[1]); // the KINDS = { disc=true, ... } table
const usedKinds = new Set();
for (const m of data.matchAll(/p\s*=\s*"([a-z]+)"/g)) usedKinds.add(m[1]);
for (const k of usedKinds) if (!kinds.has(k)) errs.push(`primitive kind "${k}" used in GlyphData but NOT handled in EditableGlyph KINDS`);

if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
console.log(`glyph-parity: ${rbxIds.size} tech glyphs match browser GLYPH; primitive kinds covered [${[...usedKinds].sort().join(', ')}]`);

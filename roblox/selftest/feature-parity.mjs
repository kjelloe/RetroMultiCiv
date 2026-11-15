#!/usr/bin/env node
// check.sh gate 51: the feature list and the user-scenario report.
//   roblox/parity/browser-features.txt  every player-facing browser feature, with a proof string
//   roblox/parity/roblox-status.txt     where each stands in the Roblox client, with a proof string
//   roblox/parity/scenarios.txt         user scenarios as steps over feature ids
// Fails when: a proof string is gone from its file (either side), a client/ui
// module is named by no feature, a feature has no status row (or the reverse),
// a status lacks its file / note, a scenario names an unknown feature, or
// roblox/PARITY.md is not what this script generates.
//   node roblox/selftest/feature-parity.mjs            check
//   node roblox/selftest/feature-parity.mjs --report   print the report
//   node roblox/selftest/feature-parity.mjs --write    regenerate roblox/PARITY.md
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8');
const errs = [];
// cells are separated by a single | ; a literal || inside a proof string is kept
const cellsOf = l => l.replace(/\|\|/g, '\u0001').split('|').map(c => c.trim().replace(/\u0001/g, '||'));
const rowsOf = (file, n) => read(file).split('\n')
  .filter(l => l.trim() !== '' && !l.startsWith('#'))
  .map(l => {
    const cells = cellsOf(l);
    while (cells.length < n) cells.push('');
    if (cells.length > n) errs.push(`${file}: too many cells: ${l}`);
    return cells;
  });

// ---- browser side
const features = new Map();
const cache = new Map();
const src = p => { if (!cache.has(p)) cache.set(p, existsSync(new URL(p, ROOT)) ? read(p) : null); return cache.get(p); };
const usedModules = new Set();
for (const [id, group, name, reach, file, proof] of rowsOf('roblox/parity/browser-features.txt', 6)) {
  if (features.has(id)) errs.push(`browser-features: duplicate id ${id}`);
  features.set(id, { id, group, name, reach, file, proof });
  const text = src('client/' + file);
  if (text === null) errs.push(`browser-features ${id}: client/${file} does not exist`);
  else if (!text.includes(proof)) errs.push(`browser-features ${id}: proof ${JSON.stringify(proof)} is not in client/${file} (the list is stale)`);
  if (file.startsWith('ui/')) usedModules.add(file.slice(3));
}
for (const f of readdirSync(new URL('client/ui/', ROOT)).filter(f => f.endsWith('.js'))) {
  if (!usedModules.has(f)) errs.push(`client/ui/${f} is named by no feature row: add it to roblox/parity/browser-features.txt`);
}

// ---- roblox side
const STATUS = ['yes', 'partial', 'no', 'n/a'];
const status = new Map();
for (const [id, st, file, proof, note] of rowsOf('roblox/parity/roblox-status.txt', 5)) {
  if (status.has(id)) errs.push(`roblox-status: duplicate id ${id}`);
  status.set(id, { st, file, proof, note });
  if (!features.has(id)) errs.push(`roblox-status ${id}: no such browser feature`);
  if (!STATUS.includes(st)) errs.push(`roblox-status ${id}: unknown status ${st}`);
  if (st === 'yes' || st === 'partial') {
    const text = file === '' ? null : src('roblox/src/' + file);
    if (text === null) errs.push(`roblox-status ${id}: ${st} needs an existing file under roblox/src/ (got ${JSON.stringify(file)})`);
    else if (proof === '' || !text.includes(proof)) errs.push(`roblox-status ${id}: proof ${JSON.stringify(proof)} is not in roblox/src/${file}`);
  }
  if (st !== 'yes' && note === '') errs.push(`roblox-status ${id}: ${st} needs a note`);
}
for (const id of features.keys()) if (!status.has(id)) errs.push(`roblox-status: no row for ${id}`);

// ---- scenarios
const scenarios = [];
for (const line of read('roblox/parity/scenarios.txt').split('\n')) {
  if (line.trim() === '' || line.startsWith('#')) continue;
  const cells = cellsOf(line);
  if (!line.startsWith(' ')) { scenarios.push({ id: cells[0], name: cells[1], steps: [] }); continue; }
  const ids = (cells[1] || '').split(/\s+/).filter(Boolean);
  if (scenarios.length === 0 || ids.length === 0) { errs.push(`scenarios: bad step line: ${line}`); continue; }
  for (const id of ids) if (!features.has(id)) errs.push(`scenarios ${scenarios.at(-1).id}: unknown feature ${id}`);
  scenarios.at(-1).steps.push({ text: cells[0], ids });
}
const stOf = id => (status.get(id) || { st: 'no' }).st;
const verdictOf = ids => {
  const sts = ids.map(stOf).filter(s => s !== 'n/a');
  if (sts.includes('no')) return 'BLOCKED';
  if (sts.includes('partial')) return 'DEGRADED';
  return 'PLAYABLE';
};
const rank = { PLAYABLE: 0, DEGRADED: 1, BLOCKED: 2 };
for (const s of scenarios) {
  s.verdict = 'PLAYABLE';
  for (const step of s.steps) {
    step.verdict = verdictOf(step.ids);
    if (rank[step.verdict] > rank[s.verdict]) s.verdict = step.verdict;
  }
}

// ---- report
const WORD = { yes: 'yes', partial: 'partial', no: 'MISSING', 'n/a': 'n/a' };
function report() {
  const out = [];
  const counts = { yes: 0, partial: 0, no: 0, 'n/a': 0 };
  for (const s of status.values()) if (counts[s.st] !== undefined) counts[s.st] += 1;
  const applicable = counts.yes + counts.partial + counts.no;
  out.push('# Roblox client: feature parity with the browser client', '');
  out.push('GENERATED by `node roblox/selftest/feature-parity.mjs --write` from `roblox/parity/*.txt`.');
  out.push('Do not edit by hand: change the three source files and regenerate (check.sh gate 51 compares).', '');
  out.push(`${features.size} browser features: ${counts.yes} available, ${counts.partial} partial, ${counts.no} missing, ${counts['n/a']} not applicable on the platform.`);
  out.push(`Of the ${applicable} that apply: ${Math.round(counts.yes * 100 / applicable)} % available, ${Math.round(counts.partial * 100 / applicable)} % partial, ${Math.round(counts.no * 100 / applicable)} % missing.`, '');
  out.push('## User scenarios', '');
  const tally = { PLAYABLE: 0, DEGRADED: 0, BLOCKED: 0 };
  for (const s of scenarios) tally[s.verdict] += 1;
  out.push(`${scenarios.length} scenarios: ${tally.PLAYABLE} playable, ${tally.DEGRADED} degraded, ${tally.BLOCKED} blocked.`, '');
  for (const s of scenarios) {
    out.push(`### ${s.id} ${s.name}: ${s.verdict}`, '');
    for (const step of s.steps) {
      const gaps = step.ids.filter(id => stOf(id) === 'no' || stOf(id) === 'partial')
        .map(id => `${features.get(id).name} (${WORD[stOf(id)]}: ${status.get(id).note})`);
      out.push(`- ${step.verdict === 'PLAYABLE' ? 'ok' : step.verdict.toLowerCase()}: ${step.text}${gaps.length ? ' — ' + gaps.join('; ') : ''}`);
    }
    out.push('');
  }
  out.push('## Missing', '');
  for (const [id, f] of features) if (stOf(id) === 'no') out.push(`- ${id} ${f.name} — ${status.get(id).note}`);
  out.push('', '## Partial', '');
  for (const [id, f] of features) if (stOf(id) === 'partial') out.push(`- ${id} ${f.name} — ${status.get(id).note}`);
  out.push('', '## Full list', '');
  let group = null;
  for (const [id, f] of features) {
    if (f.group !== group) {
      group = f.group;
      out.push('', `### ${group}`, '', '| id | feature | browser | Roblox | where / note |', '|---|---|---|---|---|');
    }
    const s = status.get(id) || { st: 'no', file: '', note: '' };
    const where = [s.file ? '`' + s.file.replace(/^client\//, '') + '`' : '', s.note].filter(Boolean).join(' — ');
    out.push(`| ${id} | ${f.name} | ${f.reach} | ${WORD[s.st] || s.st} | ${where} |`);
  }
  out.push('');
  return out.join('\n');
}

if (errs.length > 0) {
  console.error('feature-parity: FAIL');
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}
const text = report();
const TARGET = 'roblox/PARITY.md';
if (process.argv.includes('--write')) {
  writeFileSync(new URL(TARGET, ROOT), text);
  console.log('wrote ' + TARGET);
} else if (process.argv.includes('--report')) {
  console.log(text);
} else {
  if (!existsSync(new URL(TARGET, ROOT)) || read(TARGET) !== text) {
    console.error(`feature-parity: ${TARGET} is out of date — run: node roblox/selftest/feature-parity.mjs --write`);
    process.exit(1);
  }
  const c = { yes: 0, partial: 0, no: 0, 'n/a': 0 };
  for (const s of status.values()) c[s.st] += 1;
  console.log(`feature-parity: ${features.size} features (${c.yes} yes, ${c.partial} partial, ${c.no} missing, ${c['n/a']} n/a); ${scenarios.length} scenarios (${scenarios.filter(s => s.verdict === 'PLAYABLE').length} playable, ${scenarios.filter(s => s.verdict === 'DEGRADED').length} degraded, ${scenarios.filter(s => s.verdict === 'BLOCKED').length} blocked)`);
}

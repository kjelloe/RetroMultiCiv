// check.sh gate 38 (node half): (a) DiagAudit's expected + on-demand ScreenGui
// lists equal the names the client scripts create, so a new panel cannot be
// missing from the audit; (b) tools/studio-log.js parses the Studio log shape
// (levels, channels, continuation lines, session split, diag filter).
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const log = require('../tools/studio-log.js');

let fails = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const dir = new URL('../src/client/', import.meta.url);
const created = new Set();
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.luau')) continue;
  const src = readFileSync(new URL(f, dir), 'utf8');
  const re = /Instance\.new\("ScreenGui"\)\s*\n\s*(\w+)\.Name = "(\w+)"/g;
  let m;
  while ((m = re.exec(src))) created.add(m[2]);
  const n = (src.match(/Instance\.new\("ScreenGui"\)/g) || []).length;
  const named = (src.match(/Instance\.new\("ScreenGui"\)\s*\n\s*\w+\.Name = "/g) || []).length;
  check(`${f}: every ScreenGui is named on the next line`, named, n);
}
const audit = readFileSync(new URL('DiagAudit.client.luau', dir), 'utf8');
const list = (name) => [...audit.match(new RegExp(`local ${name} = \\{([\\s\\S]*?)\\n?\\}`))[1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
const listed = [...list('EXPECTED_GUIS'), ...list('LAZY_GUIS')];
check('audit lists have no duplicate', new Set(listed).size, listed.length);
check('audit lists == created ScreenGuis', [...listed].sort(), [...created].sort());

const T = (t, lvl, chan, msg) => `2026-11-14T00:00:${t}Z,1.0,4e1c,6${lvl ? ',' + lvl : ''} [FLog::${chan}] ${msg}`;
const text = [
  T('01.000', 'Info', 'CreatorOutput', '[old] before any boot'),
  T('09.500', 'Info', 'CreatorOutput', '[GameServer] data gate'),
  T('10.000', 'Info', 'CreatorOutput', '=== RetroMultiCiv R1 anchor gate ==='),
  T('11.000', 'Warning', 'Output', 'engine noise'),
  T('12.000', 'Warning', 'CreatorOutput', '[RMC-DIAG] FAIL icon: draw: boom'),
  T('13.000', 'Info', 'CreatorOutput', '[R4LOG] {"t":"cmd"}'),
  T('14.000', 'Error', 'Error', "Players.x.PlayerScripts.RetroMultiCivClient.Hud:12: attempt to index nil"),
  'Stack Begin',
  T('15.000', '', 'Output', 'no level field'),
  T('20.000', 'Info', 'CreatorOutput', '[GameServer] data gate'),
  T('20.500', 'Info', 'CreatorOutput', '=== RetroMultiCiv R1 anchor gate ==='),
  T('21.000', 'Info', 'CreatorOutput', '[Hud] up'),
].join('\r\n');
const recs = log.parse(text);
check('parse: record count (continuation folded)', recs.length, 11);
check('parse: level', recs[4].level, 'Warning');
check('parse: missing level reads as Info', recs[8].level, 'Info');
check('parse: continuation appended', recs[6].msg.endsWith('\nStack Begin'), true);
const sess = log.sessions(recs);
check('sessions: split at each boot', sess.length, 2);
check('sessions: boot preamble kept, older lines dropped', sess[0][0].msg, '[GameServer] data gate');
check('sessions: next preamble not in the previous tail', sess[0].length, 5);
check('sessions: engine noise excluded, script error included',
  sess[0].map((r) => r.chan), ['CreatorOutput', 'CreatorOutput', 'CreatorOutput', 'CreatorOutput', 'Error']);
check('diag filter', sess[0].filter(log.isDiag).length, 2);
check('summary', log.summarize(sess[0]), { start: '2026-11-14T00:00:09.500Z', end: '2026-11-14T00:00:14.000Z',
  lines: 5, r4log: 1, diagFail: 1, warnings: 1, errors: 1 });
check('output shape', log.outputShape(sess[1][2]), '  00:00:21.000  [Hud] up');

if (fails > 0) {
  console.error(`${fails} diag-coverage check(s) failed`);
  process.exit(1);
}
console.log('diag-coverage: ALL PASS');

// GUARD 2 (regression-guards): the A45 trap. main.js canonicalizes the URL after
// boot (history.replaceState drops unknown params), so a client/ui module that reads
// its own ?param LAZILY — inside a function that runs post-boot (an event handler,
// setTimeout, .then) — sees the param already gone. The sanctioned pattern is to
// capture at MODULE EVAL (a module-top-level const, before main.js's body runs).
// Bitten twice (the ?parleydemo A45 catch, the ?param play-lane drift).
//
// This lint fails any location.search / location.hash READ inside a function body
// (brace-depth > 0) in client/ui/*.js. WRITES (location.search = …, navigation) are
// fine. Legitimately boot-synchronous reads carry a `// a45-ok` opt-out on the line —
// the lint's job is stopping NEW lazy post-boot reads, not churning working code.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const UI_DIR = path.join(__dirname, '..', 'client', 'ui');

// strip // line comments (crudely — good enough for these hand-written files) so a
// commented location.search never trips the lint; keep the raw line for a45-ok checks
function codeOf(line) {
  const i = line.indexOf('//');
  return i === -1 ? line : line.slice(0, i);
}

test('A45 lint: no client/ui module reads location.search/hash inside a function body', () => {
  const offenders = [];
  for (const file of fs.readdirSync(UI_DIR).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(UI_DIR, file), 'utf8').split('\n');
    let depth = 0; // net brace depth at the START of each line ≈ nesting level
    for (let n = 0; n < src.length; n++) {
      const raw = src[n];
      const code = codeOf(raw);
      for (const prop of ['location.search', 'location.hash']) {
        let from = 0;
        while (true) {
          const at = code.indexOf(prop, from);
          if (at === -1) break;
          from = at + prop.length;
          const after = code.slice(at + prop.length).replace(/^\s+/, '');
          const isWrite = after.startsWith('=') && !after.startsWith('=='); // navigation, not a read
          const optOut = /\/\/\s*a45-ok/.test(raw);
          if (!isWrite && depth > 0 && !optOut) {
            offenders.push(`${file}:${n + 1}  ${raw.trim()}`);
          }
        }
      }
      // advance depth by this line's net braces (proxy for entering/leaving functions)
      for (const ch of code) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (depth < 0) depth = 0; // resync if the brace heuristic drifts (strings etc.)
    }
  }
  assert.deepStrictEqual(offenders, [],
    'lazy location.search/hash reads (capture at module eval, or mark // a45-ok if boot-synchronous):\n'
    + offenders.join('\n'));
});

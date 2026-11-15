#!/usr/bin/env node
// check.sh gate 55: a top-level `local NAME` must not be read on an earlier
// line of the same script. Luau resolves such a read as a GLOBAL (nil) with
// no error at load - it cost the city panel its queue strip (`openCityId`
// read by a function declared above it) and nearly the top row
// (`clusterButtons`). Heuristic: a name that is also a parameter, a loop
// variable or an inner local somewhere above its top-level declaration is
// skipped (it may be shadowed there).
import { readFileSync, readdirSync } from 'node:fs';

const dirs = ['roblox/src/client/', 'roblox/src/server/'];
const errs = [];
let files = 0;
for (const dir of dirs) {
  for (const f of readdirSync(new URL('../../' + dir, import.meta.url)).filter(f => f.endsWith('.luau'))) {
    files += 1;
    const lines = readFileSync(new URL('../../' + dir + f, import.meta.url), 'utf8').split('\n');
    const code = lines.map(l => l.replace(/--.*$/, '').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''"));
    const decl = new Map();
    code.forEach((l, i) => {
      const m = /^local (?:function )?([A-Za-z_]\w*)/.exec(l);
      if (m && !decl.has(m[1])) decl.set(m[1], i);
      const multi = /^local ([A-Za-z_][\w, ]*?)\s*=/.exec(l);
      if (multi) for (const n of multi[1].split(',').map(s => s.trim())) if (n && !decl.has(n)) decl.set(n, i);
    });
    for (const [name, at] of decl) {
      // `name = value` is a table key (or a write), not a read
      const use = new RegExp('(?<![\\w.:])' + name + '(?!\\w)(?!\\s*=(?!=))');
      const shadow = new RegExp('(function[^(]*\\([^)]*\\b' + name + '\\b[^)]*\\))|(^\\s+local\\s+(function\\s+)?[\\w, ]*\\b' + name + '\\b)|(\\bfor\\s+[\\w, ]*\\b' + name + '\\b)');
      let shadowed = false;
      for (let i = 0; i < at; i++) {
        if (shadow.test(code[i])) { shadowed = true; break; }
      }
      if (shadowed) continue;
      for (let i = 0; i < at; i++) {
        if (use.test(code[i])) {
          errs.push(`${dir}${f}:${i + 1}: reads ${name} before its declaration on line ${at + 1} (it is a nil global there)`);
          break;
        }
      }
    }
  }
}
if (errs.length) {
  console.error('local-order: FAIL');
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}
console.log(`local-order: ${files} scripts, no top-level local read before its declaration`);

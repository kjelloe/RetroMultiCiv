#!/usr/bin/env node
// roblox/ lane static lint (check.sh gate 8). One rule so far, born from the
// session-E 'CLOSE does nothing' bug that took TWO rounds to root-cause:
// a GuiButton parented into a BillboardGui only receives input when the
// billboard BOTH lives under PlayerGui AND sets Active = true. The rule:
// for every BillboardGui variable that receives a TextButton/ImageButton
// via `.Parent = <bbvar>`, the same file must set `<bbvar>.Active = true`.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'src');
let bad = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.luau')) lint(p);
  }
}

function lint(file) {
  const src = fs.readFileSync(file, 'utf8');
  const bbVars = new Set();
  for (const m of src.matchAll(/(\w+)\s*=\s*Instance\.new\("BillboardGui"\)/g)) {
    bbVars.add(m[1]);
  }
  if (bbVars.size === 0) return;
  const btnVars = new Set();
  for (const m of src.matchAll(/(\w+)\s*=\s*Instance\.new\("(?:Text|Image)Button"\)/g)) {
    btnVars.add(m[1]);
  }
  for (const m of src.matchAll(/(\w+)\.Parent\s*=\s*(\w+)/g)) {
    const [, child, parent] = m;
    if (btnVars.has(child) && bbVars.has(parent)) {
      if (!src.includes(parent + '.Active = true')) {
        bad.push(`${path.relative(__dirname, file)}: button '${child}' inside BillboardGui '${parent}' without ${parent}.Active = true`);
      }
    }
  }
}

walk(root);
if (bad.length > 0) {
  for (const b of bad) console.error('LINT ' + b);
  process.exit(1);
}
console.log('lint: billboard-button Active rule clean');

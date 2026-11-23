#!/usr/bin/env node
// Contact sheet of StructureModels without Studio (specs/roblox-pedia-art.md
// 2.4): lune exports the primitive lists, model-preview.html draws them with
// the vendored three.js, the headless screenshot script saves a PNG.
//   node roblox/tools/model-preview.js --variants pyramids --out /path/sheet.png
//   node roblox/tools/model-preview.js --models all --out /path/sheet.png
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const root = path.join(__dirname, '..', '..');
const mode = arg('--variants') ? ['variants', arg('--variants')]
  : arg('--set') ? [arg('--set'), arg('--range') || '1-99'] // governments | concepts, a slice of the sorted ids
  : ['models', arg('--models') || 'all'];
const out = arg('--out');
if (!out) { console.error('usage: model-preview.js (--variants <id> | --models <ids|all> | --set governments|concepts|civs [--range 1-8]) --out file.png'); process.exit(2); }

const exp = spawnSync('lune', ['run', 'roblox/tools/model-export.luau', ...mode], { cwd: root, encoding: 'utf8' });
if (exp.status !== 0) { console.error('model-preview: export failed\n' + exp.stderr); process.exit(1); }
const sheet = JSON.parse(exp.stdout);
if (sheet.cells.length === 0) { console.error('model-preview: nothing to draw for ' + mode.join(' ')); process.exit(1); }
const dir = path.join(__dirname, 'preview');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'sheet.json'), JSON.stringify(sheet));

const shot = spawnSync('bash', ['debugging/shoot.sh', path.resolve(out), '/roblox/tools/model-preview.html'], { cwd: root, encoding: 'utf8' });
if (shot.status !== 0 || !fs.existsSync(out)) { console.error('model-preview: screenshot failed\n' + shot.stderr); process.exit(1); }
console.log(`model-preview: ${sheet.cells.length} model(s) -> ${path.resolve(out)}`);
for (const c of sheet.cells) console.log('  ' + c.label);

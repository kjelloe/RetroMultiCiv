#!/usr/bin/env node
// Sheet of the yield icons without Studio: lune exports YieldIcons.ICONS,
// this writes them as SVG (large, and as a 3/2/3 tile label at tile size)
// and the headless screenshot script saves a PNG.
//   node roblox/tools/icon-preview.js --out roblox/art/yield-icons.png
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..', '..');
const i = process.argv.indexOf('--out');
if (i === -1) { console.error('usage: icon-preview.js --out file.png'); process.exit(2); }
const out = path.resolve(process.argv[i + 1]);
const exp = spawnSync('lune', ['run', 'roblox/tools/icon-export.luau'], { cwd: root, encoding: 'utf8' });
if (exp.status !== 0) { console.error('icon-preview: export failed\n' + exp.stderr); process.exit(1); }
const sheet = JSON.parse(exp.stdout);
const shade = hex => '#' + [1, 3, 5].map(k => Math.round(parseInt(hex.slice(k, k + 2), 16) / 2).toString(16).padStart(2, '0')).join('');
const prim = (p, ink) => {
  const c = p.shade ? shade(ink) : ink;
  if (p.p === 'disc') return `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${c}"/>`;
  if (p.p === 'ring') return `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="none" stroke="${c}" stroke-width="${p.w}"/>`;
  if (p.p === 'ell') return `<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="${c}" transform="rotate(${p.rot || 0} ${p.x} ${p.y})"/>`;
  if (p.p === 'bar') return `<rect x="${p.x - p.w / 2}" y="${p.y - p.h / 2}" width="${p.w}" height="${p.h}" rx="${p.r || 0}" fill="${c}" transform="rotate(${p.rot || 0} ${p.x} ${p.y})"/>`;
  if (p.p === 'poly') return `<polygon points="${p.pts.map(q => q.join(',')).join(' ')}" fill="${c}"/>`;
  throw new Error('unknown primitive ' + p.p);
};
const icon = (ic, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 100})">${ic.prims.map(p => prim(p, ic.color)).join('')}</g>`;
const byKey = Object.fromEntries(sheet.icons.map(ic => [ic.key, ic]));
const label = (x, y, w, h, bg) => {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>`;
  for (const r of sheet.sample) {
    const size = Math.min(r.h * h, w / r.n);
    const x0 = x + (w - size * r.n) / 2;
    for (let k = 0; k < r.n; k++) s += icon(byKey[r.key], x0 + k * size, y + r.y * h + (r.h * h - size) / 2, size);
  }
  return s;
};
let svg = '';
sheet.icons.forEach((ic, k) => { svg += icon(ic, 30 + k * 230, 30, 200) + `<text x="${130 + k * 230}" y="262" fill="#ddd" font-family="sans-serif" font-size="20" text-anchor="middle">${ic.key}</text>`; });
svg += label(30, 300, 184, 160, '#3c7a3a') + label(250, 300, 92, 80, '#3c7a3a') + label(380, 300, 46, 40, '#3c7a3a') + label(460, 300, 92, 80, '#2f5f96') + label(580, 300, 92, 80, '#b9a36a');
svg += `<text x="30" y="490" fill="#ddd" font-family="sans-serif" font-size="16">a 3 food / 2 shields / 3 trade label at 184, 92 and 46 px wide, and on water and desert</text>`;
const dir = path.join(__dirname, 'preview');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icons.html'), `<!doctype html><body style="margin:0;background:#1a1e28"><svg xmlns="http://www.w3.org/2000/svg" width="760" height="510">${svg}</svg></body>`);
const shot = spawnSync('bash', ['debugging/shoot.sh', out, '/roblox/tools/preview/icons.html'], { cwd: root, encoding: 'utf8' });
if (shot.status !== 0 || !fs.existsSync(out)) { console.error('icon-preview: screenshot failed\n' + shot.stderr); process.exit(1); }
console.log('icon-preview: ' + sheet.icons.length + ' icon(s) -> ' + out);

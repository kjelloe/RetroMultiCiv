// End-to-end browser smoke test: boots the real client in the Playwright-cached
// headless Chromium (software WebGL via SwiftShader), and asserts the game
// reached a playable state — engine ran, HUD shows the turn, no surfaced error.
// Self-skips when the browser binary is absent so CI/other machines stay green.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');

function findChromium() {
  const cacheDir = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(cacheDir)) return null;
  for (const entry of fs.readdirSync(cacheDir)) {
    if (!entry.startsWith('chromium_headless_shell-')) continue;
    const bin = path.join(cacheDir, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png'
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.normalize(path.join(REPO, urlPath));
      if (!file.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function dumpDom(chromium, url) {
  return new Promise((resolve, reject) => {
    const proc = spawn(chromium, [
      '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
      '--window-size=800,600', '--virtual-time-budget=8000', '--timeout=25000',
      '--dump-dom', url
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('error', reject);
    proc.on('close', () => resolve(out));
    setTimeout(() => proc.kill('SIGKILL'), 30000).unref();
  });
}

const chromium = findChromium();

test('browser smoke: client boots to a playable state', { skip: !chromium && 'headless chromium not cached' }, async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    // ?e2e=1 founds a city and fills the city + research panels (see main.js)
    const dom = await dumpDom(chromium, `http://127.0.0.1:${port}/client/?seed=12345&diag=1&e2e=1&civ=romans`);
    assert.ok(dom.length > 0, 'browser produced no DOM');
    assert.match(dom, /turn 1 · 4000 BC · Romans/, 'HUD must show the initial turn status');
    assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
    assert.ok(!/WebGL is unavailable|could not start/.test(dom), 'WebGL failure path triggered');
    assert.match(dom, /<canvas/, 'renderer must have attached a canvas');
    assert.match(dom, /WebGL2: (yes|NO)/, 'diagnostics panel must render with ?diag=1');
    // panel content from the e2e sequence
    assert.match(dom, /Testopolis/, 'the scripted city must appear in the city panel');
    assert.match(dom, /manual tile assignment/,
      'clicking a mini-map tile must switch the city to manual worker assignment');
    assert.match(dom, /actionbar: .*Found city.*(Irrigate|Clear).*(Mine|Plant).*Road.*Fortify.*Skip/,
      'the selected settler must show its full action bar (e2e probe snapshot)');
    assert.match(dom, /Buy \d+/, 'the city panel must show the rush-buy price');
    assert.match(dom, /needs [A-Z]/, 'the production catalog must list tech-locked items');
    assert.match(dom, /unlocks /, 'the research panel must show what techs unlock');
    assert.match(dom, /tax 50%/, 'the tax/science split must render at its default');
    assert.match(dom, /lux 0%/, 'the luxuries rate must render');
    assert.match(dom, /Despotism \(rates/, 'the government row must show the current government');
    assert.match(dom, /mood /, 'the city panel must show the mood row');
    assert.match(dom, /diaglog: [1-9]/, 'the diagnostics recorder must capture commands');
    assert.match(dom, /errors: 0/,
      'no JavaScript errors during the scripted session (incl. the hover sweep — HUD text may be overwritten, this counter is not)');
    assert.match(dom, /Turn log/, 'the turn log must be present');
    assert.match(dom, /id="open-options"/, 'the options button must be present');
    assert.match(dom, /Civil disorder/, 'the gameplay help panel must carry its entries');
    assert.match(dom, /Next unit/, 'the action bar must offer Next unit');
  } finally {
    server.close();
  }
});

test('browser setup: a bare URL shows the setup screen instead of booting a game',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const server = await startServer();
    try {
      const port = server.address().port;
      const dom = await dumpDom(chromium, `http://127.0.0.1:${port}/client/`);
      assert.match(dom, /id="setup-screen"/, 'the setup screen must be present');
      assert.match(dom, /Start game/, 'with its start button');
      assert.match(dom, /hotseat/, 'and the human-players picker');
      assert.match(dom, /id="setup-difficulty"/, 'and the difficulty picker');
      assert.match(dom, /id="setup-combat"/, 'and the combat-calculations picker');
      assert.ok(!/<canvas/.test(dom), 'no renderer starts before the setup choices');
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
    } finally {
      server.close();
    }
  });

test('browser hotseat: ending the turn hands off to the second human behind an opaque cover',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const server = await startServer();
    try {
      const port = server.address().port;
      // ?e2e=2 ends player 1's turn (see main.js); player 2 is human
      const dom = await dumpDom(chromium, `http://127.0.0.1:${port}/client/?seed=12345&civs=2&humans=2&e2e=2&civ=romans`);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      // player 2's civ is seed-shuffled — name it dynamically from the dump
      const incoming = dom.match(/id="handoff-title"[^>]*>([^<]+) — your turn</);
      assert.ok(incoming, 'the hand-off screen must name the incoming player');
      assert.notStrictEqual(incoming[1], 'Romans', 'the incoming player is NOT player 1');
      assert.match(dom, /id="handoff-screen" class=""/, 'the opaque cover must be visible (not .hidden)');
      assert.ok(dom.includes(`${incoming[1]} · Despotism`),
        'beneath the cover, the HUD already shows the new viewpoint');
    } finally {
      server.close();
    }
  });

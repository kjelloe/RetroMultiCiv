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

// A served-by-server page joins over a real WebSocket during boot. The shared
// dumpDom uses --virtual-time-budget, which pauses for pending fetch() (so the
// local path's data/*.json loads finish) but NOT for ws frames — so it snapshots
// before `joined` arrives. Drive a LIVE page (real time) instead and poll its
// DOM over the DevTools protocol until it settles or the deadline passes.
function dumpDomLive(chromium, url, ready, timeoutMs) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    const port = 9222 + Math.floor(Math.random() * 4000);
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-cdp-'));
    const proc = spawn(chromium, [
      '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
      '--window-size=800,600', '--user-data-dir=' + prof,
      `--remote-debugging-port=${port}`, url
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    const deadline = Date.now() + timeoutMs;
    let done = false, last = '';
    const finish = (err, html) => {
      if (done) return; done = true;
      try { proc.kill('SIGKILL'); } catch (e) { /* already gone */ }
      fs.rm(prof, { recursive: true, force: true }, () => {});
      err ? reject(err) : resolve(html);
    };
    proc.on('error', finish);
    async function connect() {
      let targets;
      try { targets = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()); }
      catch (e) { return Date.now() > deadline ? finish(new Error('devtools never came up')) : setTimeout(connect, 200); }
      const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (!page) return Date.now() > deadline ? finish(new Error('no CDP page target')) : setTimeout(connect, 200);
      const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
      let id = 0; const waiters = {};
      const cmd = (method, params) => new Promise(res => { const i = ++id; waiters[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
      ws.on('message', d => { const m = JSON.parse(d); if (m.id && waiters[m.id]) { waiters[m.id](m); delete waiters[m.id]; } });
      ws.on('error', () => finish(new Error('CDP socket error')));
      ws.on('open', async () => {
        while (Date.now() < deadline && !done) {
          const r = await cmd('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
          last = (r.result && r.result.result && r.result.result.value) || '';
          if (ready(last)) { try { ws.close(); } catch (e) {} return finish(null, last); }
          await new Promise(s => setTimeout(s, 250));
        }
        try { ws.close(); } catch (e) {}
        finish(null, last); // let the assertions report exactly what was missing
      });
    }
    connect();
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
    // docs/07 game verification code: the e2e save shows the persistent toast
    assert.match(dom, /code: [0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}/, 'the e2e probe must carry the game code');
    assert.match(dom, /Saved turn 1 — game code/, 'saving must show the persistent game-code toast');
    // B6: the ✕ must genuinely hide the toast — '.hidden' is per-element in
    // this codebase, and #code-toast shipped without its scoped rule (the
    // e2e block clicks the ✕ and records the COMPUTED display)
    assert.match(dom, /toastDisplay: none/,
      "the toast ✕ must actually dismiss it (computed display, not just the class)");
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

// Phase-3 slice 3 (docs/06 §5): the SAME client, but ?server=1 makes it join
// the authoritative Node server over a WebSocket instead of running its own
// engine. The served-by-server case boots server/index.js (static + ws) and
// drives the e2e founding — the strongest proof that ui-over-socket works.
test('browser served-by-server: the client founds a city through the WebSocket',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const { startServer: startGameServer } = await import('../server/index.js');
    const gs = await startGameServer({ seed: 12345, civs: 2, humans: 1, size: 'xsmall', autosave: false });
    try {
      // ?server=1 joins gs over ws://…/ws; ?e2e=1 founds a city through it. The
      // server stamps its own seat names (Player N) and Testopolis appears only
      // if the awaited foundCity round-tripped the socket.
      const url = `http://127.0.0.1:${gs.port}/client/?server=1&e2e=1&civ=romans`;
      const dom = await dumpDomLive(chromium, url,
        h => /turn 1 · 4000 BC · Player 1/.test(h) && /Testopolis/.test(h), 20000);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      assert.match(dom, /<canvas/, 'the renderer must attach a canvas in server mode');
      assert.match(dom, /turn 1 · 4000 BC · Player 1/, 'the HUD must show the joined seat and turn');
      assert.match(dom, /Testopolis/, 'the city founded over the socket must appear in the panel');
      assert.match(dom, /diaglog: [1-9]/, 'the remote session must have sent at least one command');
      assert.match(dom, /errors: 0/, 'no JavaScript errors during the socket session (incl. the hover sweep)');
      // docs/07 slice 3: the server-provided game code reaches the client (not 'none')
      assert.match(dom, /code: [0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}/, 'the server game code reaches the client');
      // the 404 fix: the client captures the server's real gameId (seed 12345 → g12345)
      assert.match(dom, /gameId: g12345/, 'the client adopts the server gameId for the /saves fetch');
    } finally {
      await gs.close();
    }
  });

// Phase-4 slice 2 (docs/08, boot path @704be920): ?e2ehost=1 drives the whole
// lobby flow in one live page — setup screen → create (lobby ws) → start →
// {joined} persists token+gameId → reload into ?server=1&game=<id> → the
// UNCHANGED remote session reconnects onto the bound seat. The HUD showing the
// HOST'S NAME (not "Player 1") proves the lobby's seating chart carried through
// the reload.
test('browser lobby: host → start → reload boots the game on the named seat',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const { startServer: startGameServer } = await import('../server/index.js');
    const gs = await startGameServer({ seed: 99, civs: 2, humans: 1, size: 'xsmall', autosave: false });
    try {
      const url = `http://127.0.0.1:${gs.port}/client/?e2ehost=1`;
      // A29 (VI.1): the status line reads "<Civ> (Kjell)" — the parenthesised
      // name is still the proof that the lobby's seating chart survived
      const dom = await dumpDomLive(chromium, url,
        h => /turn 1 · 4000 BC · [^·]*\(Kjell\)/.test(h), 25000);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      assert.match(dom, /turn 1 · 4000 BC · [^·]*\(Kjell\)/, 'the reloaded game runs on the lobby-named seat');
      assert.match(dom, /<canvas/, 'the renderer attached after the lobby reload');
      assert.ok(!/id="setup-screen"/.test(dom), 'the setup screen is gone after the boot');
    } finally {
      await gs.close();
    }
  });

// B1 regression (wave-III input.js fix): a multi-turn GoTo must survive a
// hotseat hand-off. ?e2e=3 (main.js) arms a REAL GoTo per player through the
// pick path, plays p1 → p2 → p1 → p2, and records positions in the probe.
// The two-hunk fix under test, each caught by its own assertion:
// (1) endTurn's human→human path must run autoSelectAfterTurn — else p1's
//     leg 2 never fires at the hand-back (the "hotseat GoTos froze" bug) and
//     p1's displacement stays 1 instead of 2;
// (2) runAllGotos must be owner-filtered — else p1's turn-start CANCELS p2's
//     queued route with notYourUnit rejections (units refreshed at the wrap),
//     which no position shows until p2's own next turn: p2's leg 2 goes
//     missing and p2's displacement stays 1 instead of 2.
test('browser hotseat GoTo: queued routes survive hand-offs and only run for their owner',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const server = await startServer();
    try {
      const port = server.address().port;
      const dom = await dumpDom(chromium,
        `http://127.0.0.1:${port}/client/?seed=12345&civs=2&humans=2&e2e=3&civ=romans`);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      const m = dom.match(
        /goto p1 (\d+),(\d+) (\d+),(\d+) (\d+),(\d+) p2 (\d+),(\d+) (\d+),(\d+) (\d+),(\d+) (\d+),(\d+)/);
      assert.ok(m, `the e2e=3 probe must record both units' positions:\n${dom.match(/goto [^<]*/)?.[0] || '(no probe)'}`);
      const [s1x, s1y, a1x, a1y, f1x, f1y,
        s2x, s2y, a2x, a2y, m2x, m2y, f2x, f2y] = m.slice(1).map(Number);
      // starts sit mid-map on seed 12345 and legs are single tiles — no wrap math needed
      const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
      assert.strictEqual(cheb(s1x, s1y, a1x, a1y), 1, 'p1 GoTo leg 1 must run on p1 own turn');
      assert.strictEqual(cheb(s1x, s1y, f1x, f1y), 2,
        'p1 GoTo leg 2 must run when the turn comes back (autoSelectAfterTurn on the hand-off path)');
      assert.strictEqual(cheb(s2x, s2y, a2x, a2y), 1, 'p2 GoTo leg 1 must run on p2 own turn');
      assert.strictEqual(`${a2x},${a2y}`, `${m2x},${m2y}`,
        "p2's unit must NOT move during p1's turn");
      assert.strictEqual(cheb(s2x, s2y, f2x, f2y), 2,
        "p2's route must survive p1's turn-start and continue on p2's turn (owner-filtered runAllGotos)");
      assert.match(dom, /errors: 0/, 'no JavaScript errors during the scripted hotseat GoTo session');
    } finally {
      server.close();
    }
  });

// A28 movement glide: picking must track the LOGICAL tile mid-tween. ?e2e=5
// (main.js) deselects, steps the settler once, and clicks the destination
// tile while renderer.animBusy() reports a glide in flight — the unit line
// must re-appear naming the destination coordinates.
test('browser mid-glide click: picking tracks the logical tile, not the tween',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const server = await startServer();
    try {
      const port = server.address().port;
      const dom = await dumpDom(chromium,
        `http://127.0.0.1:${port}/client/?seed=12345&e2e=5&civ=romans`);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      const m = dom.match(
        /e2e5 moved:(\w+) dest:\((\d+),(\d+)\) busy:(\w+) clearedLine:(\w+) selLine:\[([^\]]*)\] errors:(\d+)/);
      assert.ok(m, `the e2e=5 probe must report:\n${dom.match(/e2e5 [^<]*/)?.[0] || '(no probe)'}`);
      const [, moved, dx, dy, busy, clearedLine, selLine, errors] = m;
      assert.notStrictEqual(moved, '', 'a step direction was accepted');
      assert.strictEqual(busy, 'true', 'the glide was in flight when the click fired');
      assert.strictEqual(clearedLine, 'true', 'the far click deselected first');
      assert.match(selLine, /Settlers/, 'the mid-glide click re-selected the settler');
      assert.ok(selLine.includes(`(${dx},${dy})`),
        `the selection names the LOGICAL destination tile (${dx},${dy}): ${selLine}`);
      assert.strictEqual(errors, '0', 'no page errors during the mid-glide click session');
    } finally {
      server.close();
    }
  });

// A29 quick wins: ?e2e=6 (main.js) drags the science slider to 100 — the
// government cap rejects it and the thumb must snap back to the REAL rate
// (VI.10). The probe also proves the status line carries the civilization
// (VI.1) and the End-Turn button is enabled on the viewer's own turn (VI.6).
test('browser A29: slider snapback, civ in the status line, End-Turn enabled on turn',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const server = await startServer();
    try {
      const port = server.address().port;
      const dom = await dumpDom(chromium,
        `http://127.0.0.1:${port}/client/?seed=12345&e2e=6&civ=romans`);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      const m = dom.match(/e2e6 slider:(\d+) sci:(\d+) status:\[([^\]]*)\] endTurnDisabled:(\w+) errors:(\d+)/);
      assert.ok(m, `the e2e=6 probe must report:\n${dom.match(/e2e6 [^<]*/)?.[0] || '(no probe)'}`);
      const [, slider, sci, status, endTurnDisabled, errors] = m;
      assert.notStrictEqual(sci, '100', 'the capped setRates(100) must have been rejected');
      assert.strictEqual(slider, sci, 'the slider thumb snapped back to the real science rate');
      assert.match(status, /Romans/, 'the status line names the viewer civilization');
      assert.strictEqual(endTurnDisabled, 'false', 'End Turn is live on the viewer own turn');
      assert.strictEqual(errors, '0', 'no page errors during the A29 probe session');
    } finally {
      server.close();
    }
  });

// A30 chunked AI rounds: ?e2e=7 (main.js) observes the wait line DURING a
// local endTurn — it must show "<civ> (AI) is moving" between AI players
// (the round yields one macrotask per player) and hide again afterwards.
test('browser A30: the wait line shows the moving AI during a local round',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const server = await startServer();
    try {
      const port = server.address().port;
      const dom = await dumpDom(chromium,
        `http://127.0.0.1:${port}/client/?seed=12345&civs=3&e2e=7&civ=romans`);
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
      const m = dom.match(/e2e7 seen:\[([^\]]*)\] hidden:(\w+) errors:(\d+)/);
      assert.ok(m, `the e2e=7 probe must report:\n${dom.match(/e2e7 [^<]*/)?.[0] || '(no probe)'}`);
      const [, seen, hidden, errors] = m;
      assert.match(seen, /\(AI\) is moving/,
        'the wait line surfaced a moving AI mid-round (the chunking repaint)');
      assert.strictEqual(hidden, 'true', 'the line hides once the round lands');
      assert.strictEqual(errors, '0', 'no page errors during the chunked round');
    } finally {
      server.close();
    }
  });

// A37 XSS: a chat payload must render INERT — the client inserts chat via
// textContent (never innerHTML), so the markup arrives as visible text and
// no element is created. ?e2ehost=1&e2ehold=1&e2echat=<payload> sends it
// through the REAL server path (cap + rate + broadcast) back to the page.
test('browser lobby chat: a script payload renders as text, not markup',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const { startServer: startGameServer } = await import('../server/index.js');
    const gs = await startGameServer({ seed: 99, civs: 2, humans: 1, size: 'xsmall', autosave: false });
    try {
      const payload = encodeURIComponent('<img src=x onerror="document.title=1">hi');
      const url = `http://127.0.0.1:${gs.port}/client/?e2ehost=1&e2ehold=1&e2echat=${payload}`;
      const dom = await dumpDomLive(chromium, url, h => /lobby-chat-log/.test(h) && /Kjell:/.test(h), 20000);
      const log = dom.match(/id="lobby-chat-log"[\s\S]*?<\/div>/)[0];
      assert.match(log, /Kjell: &lt;img/, 'the payload is visible as escaped text');
      assert.ok(!/<img/.test(log), 'no element was created from the payload');
      assert.ok(!/onerror/.test(dom.match(/<img[^>]*>/g)?.join('') || ''), 'no live onerror anywhere');
    } finally {
      await gs.close();
    }
  });

// B3 regression (wave V bug 0): in a LAN game with two human seats, MY
// endTurn hands the turn to the OTHER human — the client must NOT take the
// hotseat hand-off path (it dropped the curtain on the wrong machine and
// flipped ctx.HUMAN to the rival, whose filtered view entry carries no
// techs — the research panel then died in researchCost, tech.js:13).
// One browser as p1 suffices: p2's human seat stays unbound, so the server
// parks the turn there and p1's client sees a human rival at turn.
test('browser LAN turn pass: handing to the other human keeps my own viewpoint',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const { startServer: startGameServer } = await import('../server/index.js');
    const gs = await startGameServer({ seed: 4242, civs: 2, humans: 2, size: 'xsmall', autosave: false });
    try {
      const url = `http://127.0.0.1:${gs.port}/client/?server=1&e2e=4&civ=romans`;
      const dom = await dumpDomLive(chromium, url, h => /e2e4 human:/.test(h), 20000);
      const m = dom.match(/e2e4 human:(\w+) active:(\w+) handoffOpen:(\w+) errors:(\d+)/);
      assert.ok(m, `the e2e=4 probe must report:\n${dom.match(/e2e4[^<]*/)?.[0] || '(no probe)'}`);
      assert.strictEqual(m[2], 'p2', 'the server parked the turn on the unbound human seat');
      assert.strictEqual(m[1], 'p1', 'ctx.HUMAN must STAY the local seat when a rival human is at turn');
      assert.strictEqual(m[3], 'false', 'the hotseat curtain must not drop in server mode');
      assert.strictEqual(m[4], '0', 'opening the research panel as the not-at-turn player must not throw');
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
    } finally {
      await gs.close();
    }
  });

// A25/A26 (wave V.6 regression net, same topology as the B3 case): with the
// turn parked on the RIVAL human, MY machine shows the calm waiting line and
// NEVER the 🔔 your-turn banner — the banner belongs to the machine whose
// turn it IS. (Post-B3, server-mode turn banners come from initMultiplayerFlow
// alone, so this pins both the name and the machine.)
test('browser LAN wait: rival at turn shows the waiting line, not the your-turn banner',
  { skip: !chromium && 'headless chromium not cached' }, async () => {
    const { startServer: startGameServer } = await import('../server/index.js');
    const gs = await startGameServer({ seed: 4242, civs: 2, humans: 2, size: 'xsmall', autosave: false });
    try {
      const url = `http://127.0.0.1:${gs.port}/client/?server=1&e2e=4&civ=romans`;
      const dom = await dumpDomLive(chromium, url, h => /is moving · \d+s/.test(h), 25000);
      const wait = dom.match(/⏳ ([^<]+) is moving · \d+s/);
      assert.ok(wait, 'the waiting line must appear once the rival is at turn');
      assert.strictEqual(wait[1], 'Player 2', 'it names the player we are waiting FOR');
      assert.ok(!/🔔 Your turn/.test(dom), 'the your-turn banner must NOT show on the waiting machine');
      assert.ok(!/ERROR:/.test(dom), `client surfaced an error:\n${dom.match(/ERROR:[^<]*/)?.[0] || ''}`);
    } finally {
      await gs.close();
    }
  });

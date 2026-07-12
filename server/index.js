// Server boot (docs/06-phase3-server.md §2): static file hosting for the
// client + a WebSocket endpoint wired to the authoritative game session.
// The socket layer stays thin — validation and routing are pure functions
// in protocol.js; state lives in game.js. Autosaves after every accepted
// command so a crash or restart resumes seamlessly (--game <file>).
//
//   node server/index.js [--port 8123] [--seed N] [--civs N] [--humans N]
//                        [--size medium] [--game saves/<id>.json] [--no-save]
//
// Then open http://localhost:<port>/client/?server=1 — the client joins
// this server's game instead of running its own engine (phase-3 slice 3).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame } from './game.js';
import { parseMessage, route } from './protocol.js';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml'
};
const SIZES = {
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};
const COLORS = ['#3b7dd8', '#d84a3b', '#3bd87d', '#d8b13b', '#9b59d0', '#d07f3b', '#4fd0c9'];

function loadRuleset() {
  const data = (f) => JSON.parse(fs.readFileSync(path.join(REPO, 'data', f), 'utf8'));
  return {
    terrain: data('terrain.json'), units: data('units.json'), techs: data('techs.json'),
    buildings: data('buildings.json'), wonders: data('wonders.json'),
    governments: data('governments.json'), civs: data('civs.json'), rules: data('rules.json')
  };
}

function setupFromOpts(opts) {
  const dims = SIZES[opts.size] || SIZES.medium;
  const players = [];
  for (let i = 0; i < opts.civs; i++) {
    players.push({
      id: 'p' + (i + 1), name: 'Player ' + (i + 1),
      color: COLORS[i % COLORS.length], human: i < opts.humans
    });
  }
  return { seed: opts.seed, options: { width: dims[0], height: dims[1], players } };
}

// opts: { port?, game?, saveFile?, autosave? } plus fresh-game fields
// (seed/civs/humans/size). Returns { port, game, close } — used by the
// integration test in-process and by the CLI below.
export function startServer(opts) {
  const ruleset = opts.ruleset || loadRuleset();
  let game;
  let saveFile = opts.saveFile;
  if (opts.game) {
    game = createGame({ ruleset, save: JSON.parse(fs.readFileSync(opts.game, 'utf8')) });
    if (!saveFile) saveFile = opts.game;
  } else {
    game = createGame({
      ruleset,
      gameId: opts.gameId || ('g' + (opts.seed || 1)),
      rulesOverrides: opts.rulesOverrides,
      setup: setupFromOpts({
        seed: opts.seed || 1, civs: opts.civs || 2,
        humans: opts.humans || 1, size: opts.size || 'medium'
      })
    });
    if (!saveFile) saveFile = path.join(REPO, 'saves', game.gameId + '.json');
  }
  const autosave = opts.autosave !== false;

  const httpServer = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.normalize(path.join(REPO, urlPath));
    if (!file.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const conns = new Map(); // ws -> { playerId } once joined

  function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  wss.on('connection', ws => {
    conns.set(ws, {});
    ws.on('close', () => conns.delete(ws));
    ws.on('message', raw => {
      const parsed = parseMessage(raw.toString());
      if (!parsed.ok) {
        send(ws, { t: 'rejected', commandId: -1, code: parsed.code });
        return;
      }
      const out = route(game, parsed.msg);
      for (const msg of out.reply) {
        send(ws, msg);
        if (msg.t === 'joined') conns.get(ws).playerId = msg.playerId;
      }
      for (const msg of out.broadcast) {
        for (const other of conns.keys()) send(other, msg);
      }
      if (out.viewsChanged) {
        for (const [other, info] of conns) {
          if (info.playerId) send(other, { t: 'view', view: game.view(info.playerId) });
        }
        if (autosave) game.saveTo(saveFile);
      }
    });
  });

  return new Promise(resolve => {
    httpServer.listen(opts.port || 0, '127.0.0.1', () => {
      resolve({
        port: httpServer.address().port,
        game,
        close: () => new Promise(done => {
          for (const ws of conns.keys()) ws.terminate();
          wss.close(() => httpServer.close(done));
        })
      });
    });
  });
}

// --- CLI ----------------------------------------------------------------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = { port: 8123, seed: Date.now() % 1000000, civs: 2, humans: 1, size: 'medium' };
  const argv = process.argv;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') opts.port = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--civs') opts.civs = Number(argv[++i]);
    else if (a === '--humans') opts.humans = Number(argv[++i]);
    else if (a === '--size') opts.size = argv[++i];
    else if (a === '--game') opts.game = argv[++i];
    else if (a === '--no-save') opts.autosave = false;
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  startServer(opts).then(({ port, game }) => {
    console.log(`RetroMultiCiv server: http://localhost:${port}/client/ (game ${game.gameId}, turn ${game.state.turn})`);
    console.log(`WebSocket: ws://localhost:${port}/ws — autosave ${opts.autosave === false ? 'OFF' : 'on'}`);
  });
}

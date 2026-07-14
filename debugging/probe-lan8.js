// A38 LAN scaling probe: EIGHT live ws clients against a real server —
// join latency, start fan-out, per-command broadcast cost (filterView runs
// once per connected seat per push), and a full 8-human round.
//   node debugging/probe-lan8.js [--size large] [--seed 424242]
// Measurements print to stdout; this is a probe, not a test — numbers are
// machine-relative (this box: WSL2), compare shapes not absolutes.
const RULESET = require('../test/ruleset.js');

function connect(port) {
  const WebSocket = require('ws');
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', raw => {
    const msg = JSON.parse(raw.toString());
    const i = waiters.findIndex(w => w.match(msg));
    if (i !== -1) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  function expect(match, label) {
    const hit = inbox.findIndex(match);
    if (hit !== -1) return Promise.resolve(inbox.splice(hit, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 30000);
      waiters.push({ match, resolve: m => { clearTimeout(timer); resolve(m); } });
    });
  }
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({ send: m => ws.send(JSON.stringify(m)), expect, inbox, close: () => ws.close() }));
    ws.on('error', reject);
  });
}

const now = () => Number(process.hrtime.bigint()) / 1e6;

(async () => {
  const argv = process.argv;
  let size = 'large', seed = 424242;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--size') size = argv[++i];
    else if (argv[i] === '--seed') seed = Number(argv[++i]);
  }
  const { startServer } = await import('../server/index.js');
  const s = await startServer({ ruleset: RULESET, autosave: false, host: '127.0.0.1' });
  const clients = [];
  try {
    console.log(`lan8 probe: 8 humans, size ${size}, seed ${seed}`);
    // host + creates
    let t0 = now();
    const host = await connect(s.port);
    clients.push(host);
    host.send({ t: 'create', name: 'H1', options: { civs: 8, humans: 8, size, seed } });
    const created = await host.expect(m => m.t === 'created', 'created');
    console.log(`create → created: ${(now() - t0).toFixed(1)} ms`);

    // seven joiners, timed individually
    const joinMs = [];
    for (let i = 2; i <= 8; i++) {
      const c = await connect(s.port);
      clients.push(c);
      const tj = now();
      c.send({ t: 'join', joinCode: created.joinCode, name: 'H' + i });
      await c.expect(m => m.t === 'joinedLobby', `H${i} joined`);
      joinMs.push(now() - tj);
    }
    console.log(`join → joinedLobby per client: [${joinMs.map(v => v.toFixed(1)).join(', ')}] ms`);

    // start: host sends, measure until EVERY seat holds {joined}
    t0 = now();
    host.send({ t: 'start' });
    const joins = await Promise.all(clients.map((c, i) =>
      c.expect(m => m.t === 'joined', `seat ${i + 1} joined`)));
    console.log(`start → all 8 {joined}: ${(now() - t0).toFixed(1)} ms (world ${size}, 8 seats fan-out)`);

    // per-command broadcast: p1 founds a city; every OTHER seat gets a view push
    const settlers = Object.values(joins[0].view.units).find(
      u => u.owner === 'p1' && u.type === 'settlers');
    t0 = now();
    host.send({ t: 'cmd', token: joins[0].token, commandId: 1,
      cmd: { type: 'foundCity', unitId: settlers.id, name: 'Benchville' } });
    await host.expect(m => m.t === 'applied' && m.commandId === 1, 'applied');
    const appliedMs = now() - t0;
    await Promise.all(clients.slice(1).map((c, i) =>
      c.expect(m => m.t === 'view', `seat ${i + 2} view push`)));
    console.log(`one command: applied ${appliedMs.toFixed(1)} ms · all-7-rival view pushes ${(now() - t0).toFixed(1)} ms total`);

    // full round: each seat ends its turn in order (8 × filterView × 8 seats)
    t0 = now();
    for (let i = 0; i < 8; i++) {
      const seatPid = 'p' + (i + 1);
      clients[i].send({ t: 'cmd', token: joins[i].token, commandId: 10 + i,
        cmd: { type: 'endTurn', playerId: seatPid } });
      await clients[i].expect(m => m.t === 'applied' && m.commandId === 10 + i, `${seatPid} endTurn`);
    }
    // the round wrapped: everyone hears turn back at p1
    await Promise.all(clients.map((c, i) =>
      c.expect(m => m.t === 'turn' && m.activePlayerId === 'p1', `seat ${i + 1} round wrap`)));
    console.log(`full 8-human round (8 endTurns + wrap broadcast): ${(now() - t0).toFixed(1)} ms`);
  } finally {
    for (const c of clients) c.close();
    await s.close();
  }
})().catch(e => { console.error(e.message); process.exit(1); });

// Bootstrap: fetch the ruleset, create the world + session, wire the UI.
// State lives in session.js; panels/input/saves/hud are in ui/*.
// URL params: ?seed=N fixed world · ?civs=2..7 · ?humans=1..civs (hotseat)
// · ?mock=1 static state · ?diag=1 · a bare URL opens the setup screen.
// ctx.HUMAN is the current VIEWPOINT (hotseat hands it between players).
import { createRenderer } from './renderer/renderer.js';
import { getGraphicsDiagnostics, showDiagnostics, webglHelp } from './diagnostics.js';
import { createSession } from './session.js';
import { createRemoteSession } from './session-remote.js';
import { gameCode as computeGameCode } from '../shared/gamecode.js';
import { initHud } from './ui/hud.js';
import { initPanels } from './ui/panels.js';
import { initInput } from './ui/input.js';
import { initSaves } from './ui/saves.js';
import { initTurnLog } from './ui/turnlog.js';
import { showSetupScreen } from './ui/setup.js';
import { initHandoff } from './ui/handoff.js';
import { initOptions } from './ui/options.js';

const hudStatus = document.getElementById('hud-status');

// surface any failure in the HUD — a silent exception otherwise looks like an
// empty map — and keep them for the Shift+D diagnostics download
const capturedErrors = [];
window.addEventListener('error', e => {
  if (`${e.message}`.indexOf('setup') !== -1) return; // deliberate bootstrap stop
  capturedErrors.push(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);
  hudStatus.textContent = `ERROR: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`;
  hudStatus.style.color = '#ff7b6b';
  // docs/07 §3.2: quicksave the last coherent state and show its code, so an
  // abrupt end still yields a verifiable stamp. Never let this throw (const TDZ
  // during bootstrap, a corrupt state, etc. all fall through the catch).
  try {
    const code = ctx.gameCode();
    if (code) {
      localStorage.setItem('retromulticiv-save', JSON.stringify(session.state));
      hudStatus.textContent += ` · state code ${code} (autosaved)`;
    }
  } catch (_) { /* the error handler must not error */ }
});
window.addEventListener('unhandledrejection', e => {
  if (`${e.reason}`.indexOf('setup') !== -1) return; // deliberate bootstrap stop
  capturedErrors.push(`${e.reason && e.reason.message ? e.reason.message : e.reason}`);
  hudStatus.textContent = `ERROR: ${e.reason && e.reason.message ? e.reason.message : e.reason}`;
  hudStatus.style.color = '#ff7b6b';
});

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const params = new URLSearchParams(location.search);
// a bare URL (no world parameters) gets the game-setup screen; it reloads
// with ?seed=&civs=&humans= filled in
if (!params.has('seed') && !params.has('civs') && !params.has('mock') && !params.has('server')) {
  showSetupScreen();
  throw new Error('setup'); // stop the bootstrap; the setup screen reloads
}
const [terrain, units, techs, buildings, wonders, governments, civs, rules] = await Promise.all([
  fetchJson('../data/terrain.json'),
  fetchJson('../data/units.json'),
  fetchJson('../data/techs.json'),
  fetchJson('../data/buildings.json'),
  fetchJson('../data/wonders.json'),
  fetchJson('../data/governments.json'),
  fetchJson('../data/civs.json'),
  fetchJson('../data/rules.json')
]);
const ruleset = { terrain, units, techs, buildings, wonders, governments, civs, rules };

// Difficulty adjusts the content-citizen threshold (a RULESET override, not
// state — recorded in diagnostics so tools/replay.js applies the same rules).
const DIFFICULTY = { trainer: 6, easy: 5, medium: 4, hard: 3, godemperor: 2 };
const MAP_SIZES = {
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};
const difficulty = DIFFICULTY[params.get('difficulty')] !== undefined ? params.get('difficulty') : 'medium';
// combat calculations: authentic Civ 1 one-shot (rules default) or
// best-of-three (?combat=bestof3 — the setup screen's default pick);
// a full hitpoints system is a possible third mode later
const combat = params.get('combat') === 'bestof3' ? 'bestof3' : 'authentic';
const rulesOverrides = {};
if (difficulty !== 'medium') rulesOverrides.contentCitizens = DIFFICULTY[difficulty];
if (combat === 'bestof3') rulesOverrides.combatRounds = 3;
ruleset.rules = Object.assign({}, rules, rulesOverrides);

// --- graphics: probe before three.js starts (pinned to r162 = WebGL1 capable) ---
const diag = getGraphicsDiagnostics();
console.table(diag);
if (params.get('diag') === '1' || !diag.webgl2) showDiagnostics(diag);
if (!diag.webgl2 && !diag.webgl1) {
  hudStatus.style.color = '#ff7b6b';
  hudStatus.textContent = webglHelp();
  throw new Error('WebGL unavailable');
}
if (!diag.webgl2) {
  console.warn('RetroMultiCiv: WebGL2 unavailable, rendering via WebGL1 fallback');
}
let renderer;
try {
  renderer = createRenderer(document.getElementById('app'));
} catch (err) {
  hudStatus.style.color = '#ff7b6b';
  hudStatus.textContent = `The 3D map could not start: ${err.message} — ${webglHelp()}`;
  showDiagnostics(diag);
  throw err;
}

// --- world -----------------------------------------------------------------
import { createEngine } from '../engine/index.js';

let initialState = null;
let humans = 1;
let session = null;
const cityNamesByPlayer = {}; // pid -> that civilization's historic city list
const factionsByPid = {};     // pid -> data/civs.json visual (art A1.6a); the
                              // renderer falls back to player.color when empty
                              // (mock states, server/lobby games without civs)
const serverParam = params.get('server');
if (serverParam) {
  // Phase-3 (docs/06 §5): the authoritative engine runs on the server. Join
  // it and let the per-seat filtered view BE our state; hotseat stays a
  // local-only feature (a server game is 1 human + AI until phase 4).
  const wsUrl = serverParam === '1'
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    : serverParam;
  const pick = params.get('civ');
  const myName = (pick && civs[pick] && civs[pick].name) || 'Player';
  session = await createRemoteSession({
    ruleset, baseRules: rules, wsUrl, name: myName, gameId: params.get('game') || undefined
  });
} else if (params.get('mock') === '1') {
  initialState = await fetchJson('./mock-state.json');
} else {
  const seed = parseInt(params.get('seed') || '', 10) || (Date.now() % 1000000);
  const civCount = Math.min(7, Math.max(2, parseInt(params.get('civs') || '2', 10) || 2));
  humans = Math.min(civCount, Math.max(1, parseInt(params.get('humans') || '1', 10) || 1));

  // Which civilizations play: player 1's pick (?civ=romans) first, the rest
  // drawn from data/civs.json in a seed-shuffled order — same seed, same
  // opponents, so games stay reproducible from the URL alone.
  const roster = Object.keys(civs).sort();
  let shuffleRng = seed;
  const shuffled = roster.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    shuffleRng = (shuffleRng * 1103515245 + 12345) % 2147483648;
    const j = shuffleRng % (i + 1);
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  const picked = params.get('civ');
  const lineup = picked && civs[picked]
    ? [picked].concat(shuffled.filter(id => id !== picked))
    : shuffled;

  const playerDefs = [];
  for (let i = 0; i < civCount; i++) {
    const civId = lineup[i];
    playerDefs.push({
      id: 'p' + (i + 1), civ: civId,
      name: civs[civId].name, color: civs[civId].color,
      human: i < humans
    });
    cityNamesByPlayer['p' + (i + 1)] = civs[civId].cities;
    if (civs[civId].visual) factionsByPid['p' + (i + 1)] = civs[civId].visual;
  }
  const size = MAP_SIZES[params.get('size')] !== undefined ? params.get('size') : 'medium';
  const dims = MAP_SIZES[size];
  initialState = createEngine(ruleset).createGame({
    seed, options: { width: dims[0], height: dims[1], players: playerDefs }
  });
  if (initialState.ok === false) throw new Error(`createGame failed: ${initialState.reason}`);
  history.replaceState(null, '',
    `?seed=${seed}&civs=${civCount}&humans=${humans}`
    + `${picked && civs[picked] ? `&civ=${picked}` : ''}`
    + `${size !== 'medium' ? `&size=${size}` : ''}`
    + `${difficulty !== 'medium' ? `&difficulty=${difficulty}` : ''}`
    + `${combat !== 'authentic' ? `&combat=${combat}` : ''}`);
}

// --- wiring ------------------------------------------------------------------
// ?debug=1: the diagnostics recorder also hashes after every single command
// (default: after each end-turn round) — finer replay divergence pinpointing
if (!session) session = createSession(ruleset, initialState, { debug: params.get('debug') === '1' });
const sel = { unitId: null, cityId: null, lastMoved: null };
const ctx = { session, renderer, sel, HUMAN: session.playerId || 'p1', errors: capturedErrors, rulesOverrides };

ctx.selectUnit = (unit, opts) => {
  sel.unitId = unit.id;
  sel.cityId = null;
  renderer.setSelection({ unitId: unit.id });
  if (!opts || !opts.keepStack) ctx.panels.closeStackPanel();
  ctx.hud.unitNote(unit);
  if (ctx.refreshActionBar) ctx.refreshActionBar();
};

// select the viewpoint's first idle unit (game start and every hand-off)
function selectFirstUnit() {
  const unit = Object.values(session.state.units).find(
    u => u.owner === ctx.HUMAN && u.moves > 0
  );
  if (unit) {
    ctx.selectUnit(unit);
    renderer.centerOn(unit.x, unit.y);
  } else {
    sel.unitId = null;
    if (ctx.refreshActionBar) ctx.refreshActionBar();
  }
}

// Hotseat hand-off: swap the viewpoint to the (human) active player. All
// per-player UI resets and the map re-renders through THEIR fog.
ctx.setHuman = (pid) => {
  ctx.HUMAN = pid;
  sel.unitId = null;
  sel.cityId = null;
  sel.lastMoved = null;
  ctx.panels.closeAll();
  if (ctx.turnlog) ctx.turnlog.resetViewer();
  ctx.hud.refresh();
  selectFirstUnit();
};

// next unused name from the viewpoint civilization's roster, else a fallback
ctx.suggestCityName = () => {
  const taken = {};
  for (const cid of Object.keys(session.state.cities)) {
    taken[session.state.cities[cid].name] = true;
  }
  for (const name of cityNamesByPlayer[ctx.HUMAN] || []) {
    if (!taken[name]) return name;
  }
  return `New City ${session.state.nextCityId}`;
};

// The game verification code (docs/07): computed locally from the full state,
// but in server mode the client only holds a filtered VIEW — the authoritative
// code comes from the server (slice 3, `session.serverCode`). Returns null when
// no trustworthy code is available yet (server mode before the first code push).
ctx.gameCode = () => {
  if (session.serverCode !== undefined) return session.serverCode;
  if (serverParam) return null;
  try { return computeGameCode(session.state); } catch (e) { return null; }
};
ctx.lastSaveCode = null; // set by ui/saves.js on save; shown on the hand-off screen

initOptions(ctx);
ctx.hud = initHud(ctx);
// server mode: surface disconnect/reconnect notices in the HUD banner, and
// wire the phase-4 turn flow (your-turn chime, waiting-for-<name>, skip vote)
if (session.setStatusHandler) session.setStatusHandler(msg => ctx.hud.banner(`⚠ ${msg}`));
if (serverParam) import('./ui/lobby.js').then(m => m.initMultiplayerFlow(ctx));
ctx.panels = initPanels(ctx);
ctx.handoff = initHandoff(ctx);
initInput(ctx);
initSaves(ctx);
ctx.turnlog = initTurnLog(ctx);

if (renderer.setFactions) renderer.setFactions(factionsByPid);
session.onChange(() => {
  ctx.hud.refresh();
  ctx.panels.refresh();
});

ctx.hud.refresh();
const firstUnit = Object.values(session.state.units).find(
  u => u.owner === ctx.HUMAN && session.state.players[ctx.HUMAN].human
);
if (firstUnit) {
  ctx.selectUnit(firstUnit);
  renderer.centerOn(firstUnit.x, firstUnit.y);
}
const zoom = parseInt(params.get('zoom') || '', 10);
if (zoom) renderer.setZoom(zoom); // handy for close-up screenshots

// ?e2e=1: scripted sequence for the headless browser test — found a city with
// the starting settlers and fill both panels, so their code paths execute
// (hidden panel content stays in the DOM for --dump-dom to assert on).
if (params.get('e2e') === '1' && firstUnit && firstUnit.type === 'settlers') {
  // sweep the pointer across the centered map: the hover paths (settler site
  // preview, combat odds) must not throw (playtest regression: the site
  // preview crashed on every mouse move once governments landed)
  const canvas = document.querySelector('#app canvas');
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6]) {
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: r.left + r.width * fx, clientY: r.top + r.height * 0.5, bubbles: true
      }));
    }
  }
  // snapshot the selected settler's action bar before founding consumes it
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  probe.textContent = 'actionbar: ' + document.getElementById('action-bar').textContent;
  document.body.appendChild(probe);
  await session.apply({ type: 'foundCity', playerId: ctx.HUMAN, unitId: firstUnit.id, name: 'Testopolis' });
  ctx.panels.toggleResearchPanel();
  if (session.state.cityOrder.length > 0) {
    ctx.panels.openCityPanel(session.state.cityOrder[0]);
    // click a worked mini-map tile: unassigns it and switches to manual mode
    const workedCell = document.querySelector('#city-map .ctile.assignable.worked');
    if (workedCell) workedCell.click();
  }
  // docs/07: exercise the save path so the persistent game-code toast renders
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
  probe.textContent += ' · code: ' + (ctx.gameCode() || 'none')
    + ' · gameId: ' + (session.gameId || 'none') // server's real id (404-fix regression guard)
    + ' · diaglog: ' + session.log.length // recorder captured the commands
    + ' · errors: ' + capturedErrors.length; // hover sweep etc. must stay clean
  if (params.get('e2eclose') === '1') ctx.panels.closeAll(); // unobstructed screenshots
}

// ?e2e=2 (with &humans=2): scripted hotseat hand-off — end player 1's turn
// (twice: the first press is the units-still-have-moves confirmation) so the
// opaque hand-off screen for player 2 is up when --dump-dom fires.
if (params.get('e2e') === '2') {
  await ctx.endTurn();
  await ctx.endTurn();
}

// ?e2e=3 (with &humans=2): B1 regression — a GoTo must survive a hotseat
// hand-off (input.js: owner-filtered runAllGotos + autoSelectAfterTurn on the
// human→human path). Both players arm a REAL GoTo through the pick path
// ('g' + a canvas click); the probe records each unit's position at
// start / after-arm / final so the browser test can assert that p1's leg 2
// ran at the hand-back and that p2's unit never moved during p1's turn.
if (params.get('e2e') === '3' && firstUnit && firstUnit.type === 'settlers') {
  const canvas = document.querySelector('#app canvas');
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const map = session.state.map;
  const pos = id => { const u = session.state.units[id]; return u ? `${u.x},${u.y}` : 'gone'; };
  const tick = () => new Promise(r => setTimeout(r, 120));

  // target scan: same greedy rule as input.js gotoStep (strictly-closer
  // options, stable-sorted, first passable wins), with land as the
  // apply-succeeds proxy — a settler's step onto land always succeeds this
  // early. The raycast pick can land one tile off, so a target only
  // qualifies when it AND all 8 neighbors offer two greedy legs.
  const VEC = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
  const wrapDist = (ax, ay, bx, by) => {
    let dx = Math.abs(ax - bx);
    if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
    const dy = Math.abs(ay - by);
    return dx > dy ? dx : dy;
  };
  const isLand = (x, y) => ruleset.terrain.terrains[map.tiles[y * map.width + x].t].domain === 'land';
  function greedyStep(cx, cy, tx, ty) {
    const here = wrapDist(cx, cy, tx, ty);
    const options = Object.keys(VEC).map(dir => {
      let nx = cx + VEC[dir][0];
      if (map.wrapX) nx = ((nx % map.width) + map.width) % map.width;
      return { nx, ny: cy + VEC[dir][1], d: wrapDist(nx, cy + VEC[dir][1], tx, ty) };
    }).filter(o => o.d < here && o.ny >= 0 && o.ny < map.height).sort((a, b) => a.d - b.d);
    for (const o of options) if (isLand(o.nx, o.ny)) return o;
    return null;
  }
  function twoLegs(sx, sy, tx, ty) {
    if (wrapDist(sx, sy, tx, ty) < 3) return false;
    const s1 = greedyStep(sx, sy, tx, ty);
    return s1 !== null && greedyStep(s1.nx, s1.ny, tx, ty) !== null;
  }
  function findTarget(u) {
    for (let D = 6; D >= 4; D--) {
      for (const dir of Object.keys(VEC)) {
        const tx = ((u.x + VEC[dir][0] * D) % map.width + map.width) % map.width;
        const ty = u.y + VEC[dir][1] * D;
        if (ty < 2 || ty >= map.height - 2) continue;
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++) {
          for (let dx = -1; dx <= 1 && ok; dx++) {
            const nx = ((tx + dx) % map.width + map.width) % map.width;
            if (!twoLegs(u.x, u.y, nx, ty + dy)) ok = false;
          }
        }
        if (ok) return { tx, ty };
      }
    }
    return null;
  }

  // arm a GoTo the way a player does: select, press G, click the destination
  // (centerOn puts the target tile under the canvas center for the raycast)
  async function armGoto(unit, tx, ty) {
    ctx.selectUnit(unit);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    renderer.centerOn(tx, ty);
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true }));
    await tick(); // the pick handler fires runGoto without awaiting — let leg 1 land
  }

  const u1 = firstUnit.id;
  const t1 = findTarget(session.state.units[u1]);
  const p1start = pos(u1);
  if (t1) await armGoto(session.state.units[u1], t1.tx, t1.ty);
  const p1arm = pos(u1);
  await ctx.endTurn(); // leg 1 spent the settler's move — no confirmation needed
  // the hand-off curtain is up for player 2: any key confirms it
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  const u2 = Object.values(session.state.units).find(u => u.owner === ctx.HUMAN && u.moves > 0);
  const t2 = u2 ? findTarget(u2) : null;
  const p2start = u2 ? pos(u2.id) : 'none';
  if (u2 && t2) await armGoto(u2, t2.tx, t2.ty);
  const p2arm = u2 ? pos(u2.id) : 'none';
  await ctx.endTurn(); // wraps the turn (moves refresh); the hand-back must run p1's queued route
  const p1final = pos(u1);
  const p2mid = u2 ? pos(u2.id) : 'none'; // p2 must not have moved on p1's turn
  // one more half-round: p2's route must have SURVIVED p1's turn-start
  // (an unfiltered runAllGotos would have cancelled it with notYourUnit
  // rejections — invisible in positions until p2's own next turn)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  await ctx.endTurn(); // p1 -> p2 hand-off runs p2's queued leg 2
  probe.textContent = `goto p1 ${p1start} ${p1arm} ${p1final}`
    + ` p2 ${p2start} ${p2arm} ${p2mid} ${u2 ? pos(u2.id) : 'none'}`
    + ` targets ${t1 ? `${t1.tx},${t1.ty}` : 'none'} ${t2 ? `${t2.tx},${t2.ty}` : 'none'}`
    + ` errors: ${capturedErrors.length}`;
}

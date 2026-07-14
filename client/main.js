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
import { capitalOf } from '../engine/government.js';
import { initHud } from './ui/hud.js';
import { initPanels } from './ui/panels.js';
import { initInput } from './ui/input.js';
import { initSaves } from './ui/saves.js';
import { initTurnLog } from './ui/turnlog.js';
import { initOverlays } from './ui/overlays.js';
import { initRegency } from './ui/regency.js';
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
    ruleset, baseRules: rules, wsUrl, name: myName, gameId: params.get('game') || undefined,
    spectator: params.get('spectate') === '1' // A17: tokenless omniscient viewer
  });
  // A24: server games now carry each player's civ (joined reply) — wire the
  // city-name rosters and faction visuals exactly like local games
  for (const [pid, civId] of Object.entries(session.playerCivs || {})) {
    if (!civs[civId]) continue;
    cityNamesByPlayer[pid] = civs[civId].cities;
    if (civs[civId].visual) factionsByPid[pid] = civs[civId].visual;
  }
} else if (params.get('mock') === '1') {
  initialState = await fetchJson('./mock-state.json');
} else {
  const seed = parseInt(params.get('seed') || '', 10) || (Date.now() % 1000000);
  // A38: the map size gates the civ count (measured seats-per-size table,
  // data/rules.json maxCivsBySize) — URL abuse clamps down silently, the
  // setup screen enforces the same table interactively
  const sizeParam = MAP_SIZES[params.get('size')] !== undefined ? params.get('size') : 'medium';
  const maxCivs = (rules.maxCivsBySize && rules.maxCivsBySize[sizeParam]) || 14;
  const civCount = Math.min(maxCivs, Math.max(2, parseInt(params.get('civs') || '2', 10) || 2));
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

  // A20 starting age: any age past Ancient means the whole world plays as AI
  // up to the age's turn (see shared/fastforward.js), then the humans take
  // over their seats with the cumulative tech grant of prior eras
  const age = (ruleset.rules.ages || []).find(a => a.id === (params.get('age') || 'ancient'))
    || { id: 'ancient', turn: 0 };

  const playerDefs = [];
  for (let i = 0; i < civCount; i++) {
    const civId = lineup[i];
    playerDefs.push({
      id: 'p' + (i + 1), civ: civId,
      name: civs[civId].name, color: civs[civId].color,
      human: age.turn > 0 ? false : i < humans // late starts: AI plays history first
    });
    cityNamesByPlayer['p' + (i + 1)] = civs[civId].cities;
    if (civs[civId].visual) factionsByPid['p' + (i + 1)] = civs[civId].visual;
  }
  const size = sizeParam; // resolved above the civ clamp (A38)
  const dims = MAP_SIZES[size];
  initialState = createEngine(ruleset).createGame({
    seed, options: { width: dims[0], height: dims[1], players: playerDefs }
  });
  if (initialState.ok === false) throw new Error(`createGame failed: ${initialState.reason}`);

  if (age.turn > 0) {
    const { createFastForward, applyAgeGrant } = await import('../shared/fastforward.js');
    const humanSeats = [];
    for (let i = 0; i < humans; i++) humanSeats.push('p' + (i + 1));
    const fwd = createFastForward(ruleset, initialState, { humanSeats });
    let r = { done: false };
    while (!r.done) {
      r = fwd.step(5, age.turn); // 5 rounds per slice keeps the tab responsive
      hudStatus.textContent = `⏳ simulating history… turn ${fwd.turn}/${age.turn}`;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (fwd.aborted) {
      // deterministic UX: name the casualty, never silently re-roll seeds
      const a = fwd.aborted;
      hudStatus.style.color = '#ff7b6b';
      hudStatus.textContent = a.reason === 'civEliminated'
        ? `✗ ${a.name} was destroyed before the ${age.name} — try another seed, age, or civilization`
        : `✗ history ended early (${a.reason}) — try another seed or an earlier age`;
      throw new Error('setup'); // stop the bootstrap; the message stays
    }
    initialState = fwd.state;
    applyAgeGrant(initialState, age, ruleset);
    for (const pid of humanSeats) initialState.players[pid].human = true;
    hudStatus.textContent = '';
  }

  history.replaceState(null, '',
    `?seed=${seed}&civs=${civCount}&humans=${humans}`
    + `${picked && civs[picked] ? `&civ=${picked}` : ''}`
    + `${size !== 'medium' ? `&size=${size}` : ''}`
    + `${difficulty !== 'medium' ? `&difficulty=${difficulty}` : ''}`
    + `${combat !== 'authentic' ? `&combat=${combat}` : ''}`
    + `${age.turn > 0 ? `&age=${age.id}` : ''}`);
}

// --- wiring ------------------------------------------------------------------
// ?debug=1: the diagnostics recorder also hashes after every single command
// (default: after each end-turn round) — finer replay divergence pinpointing
if (!session) session = createSession(ruleset, initialState, { debug: params.get('debug') === '1' });
// lastMovedBy: pid -> unitId, PER PLAYER (wave III) — a hotseat hand-off lands
// each incoming player on THEIR last-moved unit, not the previous player's
const sel = { unitId: null, cityId: null, lastMovedBy: {} };
const ctx = { session, renderer, sel, HUMAN: session.playerId || 'p1', errors: capturedErrors, rulesOverrides };
// A17 spectator mode: ctx.HUMAN is the 'spectator' pseudo-viewer — the UI
// renders the omniscient view read-only (no players[ctx.HUMAN] entry exists,
// so hud/input/panels gate their owner reads on this flag)
ctx.SPECTATOR = ctx.HUMAN === 'spectator';
if (ctx.SPECTATOR) {
  const chip = document.createElement('div');
  chip.id = 'spectator-chip';
  chip.textContent = '👁 spectating';
  chip.style.cssText = 'position:fixed;top:8px;right:96px;z-index:41;background:#2b2416;'
    + 'border:1px solid #6b5d2f;border-radius:6px;padding:4px 10px;color:#ffe066;'
    + 'font-family:inherit;font-size:12px;';
  document.body.appendChild(chip);
  const endBtn = document.getElementById('end-turn');
  if (endBtn) endBtn.style.display = 'none'; // nothing to end — view-only
  const selNote = document.getElementById('hud-selection');
  if (selNote) selNote.textContent = 'watching — click any unit to inspect it';
  // no own unit to land on — open on the middle of the world instead
  renderer.centerOn(Math.floor(session.state.map.width / 2), Math.floor(session.state.map.height / 2));
}

ctx.selectUnit = (unit, opts) => {
  sel.unitId = unit.id;
  sel.cityId = null;
  renderer.setSelection({ unitId: unit.id });
  if (!opts || !opts.keepStack) ctx.panels.closeStackPanel();
  ctx.hud.unitNote(unit);
  if (ctx.refreshActionBar) ctx.refreshActionBar();
};

// select the viewpoint's first idle unit (game start and every hand-off)
function selectFirstUnit(noCenter) {
  const unit = Object.values(session.state.units).find(
    u => u.owner === ctx.HUMAN && u.moves > 0
  );
  if (unit) {
    ctx.selectUnit(unit);
    if (!noCenter) renderer.centerOn(unit.x, unit.y);
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
  ctx.panels.closeAll();
  if (ctx.turnlog) ctx.turnlog.resetViewer();
  ctx.hud.refresh();
  // wave III landing order: THEIR last-moved unit → their capital → any unit
  const lastId = sel.lastMovedBy[pid];
  const last = lastId && session.state.units[lastId];
  if (last && last.owner === pid) {
    ctx.selectUnit(last);
    renderer.centerOn(last.x, last.y);
    return;
  }
  const cap = capitalOf(session.state, pid, ruleset);
  if (cap) renderer.centerOn(cap.x, cap.y);
  selectFirstUnit(Boolean(cap)); // capital shown: select without re-centering
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
ctx.overlays = initOverlays(ctx); // A45: data layers over explored tiles
ctx.regency = initRegency(ctx);   // A40: AI regency (🤖 auto turn)

if (renderer.setFactions) renderer.setFactions(factionsByPid);
// A28: renderer animations honor the ⚙ reduce-animation preference, live
if (renderer.setReduceAnimation) {
  renderer.setReduceAnimation(ctx.options.get('reduceAnimation') === true);
  ctx.options.watch((k, v) => {
    if (k === 'reduceAnimation') {
      renderer.setReduceAnimation(v === true);
      ctx.hud.refresh(); // rebuild so re-enabling re-registers sway/smoke
    }
  });
}
session.onChange((_state, events) => {
  ctx.hud.refresh();
  ctx.panels.refresh();
  // A28 combat flash: viewer-involved fights only (fog: rival-vs-rival
  // battles may sit on tiles this player has never seen) — same filter as
  // the A16 camera linger it pairs with
  const combats = (events || []).filter(e => e.type === 'combatResolved'
    && e.x !== undefined && (e.attackerOwner === ctx.HUMAN || e.defenderOwner === ctx.HUMAN));
  if (combats.length > 0 && renderer.playEvents) renderer.playEvents(combats);
});

ctx.hud.refresh();
const firstUnit = Object.values(session.state.units).find(
  u => u.owner === ctx.HUMAN && session.state.players[ctx.HUMAN]
    && session.state.players[ctx.HUMAN].human
);
if (firstUnit) {
  ctx.selectUnit(firstUnit);
  renderer.centerOn(firstUnit.x, firstUnit.y);
}
const zoom = parseInt(params.get('zoom') || '', 10);
if (zoom) renderer.setZoom(zoom); // handy for close-up screenshots

// ?bannerdemo=1 (A25 screenshots): render the your-turn banner with its
// dismiss/mute controls deterministically — re-fired so the 5s transient
// can't expire before a virtual-time screenshot captures it
if (params.get('bannerdemo') === '1') {
  ctx.hud.turnBanner('🔔 Your turn');
  setInterval(() => ctx.hud.turnBanner('🔔 Your turn'), 3000);
}

// ?spechover=unit|city (A35 screenshots): as a spectator, park the cursor
// over the first city (or a unit standing outside any city) and fire the
// hover so the tooltip renders — re-fired for virtual-time captures
if (params.get('spechover')) {
  const spKind = params.get('spechover');
  const spState = session.state;
  const cityTiles = {};
  for (const c of Object.values(spState.cities)) cityTiles[`${c.x},${c.y}`] = true;
  const spTarget = spKind === 'city'
    ? Object.values(spState.cities)[0]
    : Object.values(spState.units).find(u => !cityTiles[`${u.x},${u.y}`]);
  if (spTarget) {
    renderer.centerOn(spTarget.x, spTarget.y);
    renderer.setZoom(8);
    const fire = () => {
      const canvas = document.querySelector('#app canvas');
      const r = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true
      }));
    };
    fire();
    setInterval(fire, 400);
  }
}

// ?hoverdemo=1 (A19 screenshots): with the camera centered on the selected
// unit, hover a screen point offset from canvas center (&hoverdx/&hoverdy px)
// so the move-affordance arrow renders deterministically in headless shots
if (params.get('hoverdemo') === '1' && firstUnit) {
  const canvas = document.querySelector('#app canvas');
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: r.left + r.width / 2 + (parseInt(params.get('hoverdx') || '', 10) || 80),
      clientY: r.top + r.height / 2 + (parseInt(params.get('hoverdy') || '', 10) || 0),
      bubbles: true
    }));
  }
}

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
  // B6: the toast's ✕ must ACTUALLY hide it — record the computed display
  // after the click (a class-only check would pass even with no CSS rule)
  const toastX = document.getElementById('code-toast-x');
  if (toastX) toastX.click();
  const toastEl = document.getElementById('code-toast');
  probe.textContent += ' · toastDisplay: ' + (toastEl ? getComputedStyle(toastEl).display : 'missing')
    + ' · code: ' + (ctx.gameCode() || 'none')
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

// ?e2e=5 (A28): mid-glide click. Deselect, step the settler one tile, then
// click its DESTINATION tile while the render-layer glide is still in
// flight — the pick must resolve to the LOGICAL tile (castAt reads
// view.units, never the tween), re-selecting the settler at its new home
// mid-animation. The probe carries the destination coords so the test can
// assert the unit line names the logical tile.
if (params.get('e2e') === '5' && firstUnit && firstUnit.type === 'settlers') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const canvas = document.querySelector('#app canvas');
  const clickCenter = () => {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true }));
  };
  const unitLine = document.getElementById('unit-line');
  // deselect first (far empty tile), so the mid-glide click must do the
  // real selection work — the unit line hides on deselect
  const u0 = session.state.units[firstUnit.id];
  renderer.centerOn(u0.x + (u0.x > 6 ? -5 : 5), u0.y);
  clickCenter();
  const clearedLine = unitLine.classList.contains('hidden');
  // one step in the first direction the engine accepts; the glide starts in
  // the same synchronous refresh chain, so no clock ticks before the click
  let moved = '';
  for (const dir of ['E', 'W', 'N', 'S', 'NE', 'SE', 'SW', 'NW']) {
    const r = await session.apply({ type: 'moveUnit', playerId: session.state.activePlayer, unitId: firstUnit.id, dir });
    if (r.ok) { moved = dir; break; }
  }
  const u = session.state.units[firstUnit.id];
  const busy = renderer.animBusy ? renderer.animBusy() : 'noapi';
  renderer.centerOn(u.x, u.y); // the destination tile sits under the canvas center
  clickCenter();
  probe.textContent = `e2e5 moved:${moved} dest:(${u.x},${u.y}) busy:${busy}`
    + ` clearedLine:${clearedLine} selLine:[${unitLine.classList.contains('hidden') ? '' : unitLine.textContent}]`
    + ` errors:${capturedErrors.length}`;
}

// ?e2e=6 (A29): rate-slider snapback + HUD civ + turn-button state. Drag the
// science slider to 100 — despotism caps rates, the engine rejects, and the
// thumb must SNAP BACK to the real rate instead of staying where the drag
// died. The probe also carries the status line (VI.1 civ format) and the
// End-Turn disabled state on the viewer's own turn (VI.6: must be enabled).
if (params.get('e2e') === '6') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const slider = document.getElementById('rate-slider');
  slider.value = '100';
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150)); // the async reject + snapback
  const me = session.state.players[ctx.HUMAN];
  const sciNow = me.sciRate === undefined ? session.ruleset.rules.defaultSciRate : me.sciRate;
  probe.textContent = `e2e6 slider:${slider.value} sci:${sciNow}`
    + ` status:[${document.getElementById('hud-status').textContent}]`
    + ` endTurnDisabled:${document.getElementById('end-turn').disabled}`
    + ` errors:${capturedErrors.length}`;
}

// ?logdemo=1 (A39 screenshots): seed the turn log with one entry per filter
// class, open it with the filter row showing; &logdemooff=cities (or any
// class) unchecks that box so the shot proves the entries vanish
if (params.get('logdemo') === '1') {
  const note = ctx.turnlog.note;
  note('⚔ Roman Legion defeated Zulu Militia at (12,9)', 'win', null, 'combat');
  note('🏛 Testopolis founded', 'win', null, 'cities');
  note('🔬 Bronze Working discovered', 'win', null, 'research');
  note('👀 Zulus founded Zimbabwe', '', null, 'rival');
  note('🏆 The Pyramids completed in a Zulu city', 'loss', null, 'world');
  note('💾 saved · code FWN6-X6PQ-3X5TD', '', null, 'saves');
  document.getElementById('turn-log').open = true;
  document.getElementById('log-filter-toggle').click();
  const off = params.get('logdemooff');
  if (off) {
    for (const box of document.querySelectorAll('#log-filter-boxes input')) {
      if (box.parentElement.textContent.trim().endsWith(off)) box.click();
    }
  }
}

// ?e2e=7 (A30): the chunked AI round must repaint the HUD between AI
// players — a MutationObserver watches the wait line show "<civ> (AI) is
// moving" DURING a local endTurn, which was impossible while the round ran
// as one synchronous batch. Two presses: the first is the units-still-have-
// moves confirmation.
if (params.get('e2e') === '7') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const waitEl = document.getElementById('wait-line');
  let seenText = '';
  const obs = new MutationObserver(() => {
    if (!waitEl.classList.contains('hidden') && waitEl.textContent) {
      seenText = waitEl.textContent;
    }
  });
  obs.observe(waitEl, { attributes: true, childList: true, characterData: true, subtree: true });
  await ctx.endTurn();
  await ctx.endTurn();
  obs.disconnect();
  probe.textContent = `e2e7 seen:[${seenText}]`
    + ` hidden:${waitEl.classList.contains('hidden')} errors:${capturedErrors.length}`;
}

// ?e2e=8 (A46, server mode): reconnect coverage — sever the live socket and
// assert session-remote's 1/s retry loop reclaims the seat with the stored
// token and the HUD recovers. The reconnect announces itself via the
// stateReplaced marker (A30), which is exactly what the probe listens for.
if (params.get('e2e') === '8' && session.dropSocket) {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  session.onChange((_s, ev) => {
    if (ev.some(e => e.type === 'stateReplaced')) probe.dataset.reconnected = '1';
  });
  session.dropSocket();
  const poll = setInterval(() => {
    if (probe.dataset.reconnected === '1') {
      clearInterval(poll);
      probe.textContent = `e2e8 reconnected:true`
        + ` hud:[${document.getElementById('hud-status').textContent}]`
        + ` seatCode:${session.seatCode ? 'present' : 'missing'}`
        + ` errors:${capturedErrors.length}`;
    }
  }, 200);
}

// ?e2e=4 (with &server=1 in a 2-human game): B3 regression — ending my turn
// while the OTHER human is next must NOT take the hotseat hand-off path in
// server mode (it flipped ctx.HUMAN to the rival, whose filtered view entry
// carries no techs/gold, so the research panel crashed in researchCost).
if (params.get('e2e') === '4') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  await ctx.endTurn(); // first call arms the units-still-have-moves confirm
  await ctx.endTurn(); // second call ends the turn; next seat is the rival human
  try {
    ctx.panels.toggleResearchPanel(); // crashed pre-fix (rival ctx.HUMAN)
  } catch (e) {
    capturedErrors.push(`research panel: ${e.message}`);
  }
  probe.textContent = `e2e4 human:${ctx.HUMAN} active:${session.state.activePlayer}`
    + ` handoffOpen:${ctx.handoff.isOpen()} errors:${capturedErrors.length}`;
}

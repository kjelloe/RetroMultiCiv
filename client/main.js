// Bootstrap: fetch the ruleset, create the world + session, wire the UI.
// State lives in session.js; panels/input/saves/hud are in ui/*.
// URL params: ?seed=N fixed world · ?civs=2..7 · ?humans=1..civs (hotseat)
// · ?mock=1 static state · ?diag=1 · a bare URL opens the setup screen.
// ctx.HUMAN is the current VIEWPOINT (hotseat hands it between players).
import { createRenderer } from './renderer/renderer.js';
import { getGraphicsDiagnostics, showDiagnostics, webglHelp } from './diagnostics.js';
import { createSession } from './session.js';
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
if (!params.has('seed') && !params.has('civs') && !params.has('mock')) {
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
const rulesOverrides = {};
if (difficulty !== 'medium') rulesOverrides.contentCitizens = DIFFICULTY[difficulty];
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

let initialState;
let humans = 1;
const cityNamesByPlayer = {}; // pid -> that civilization's historic city list
if (params.get('mock') === '1') {
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
    + `${difficulty !== 'medium' ? `&difficulty=${difficulty}` : ''}`);
}

// --- wiring ------------------------------------------------------------------
// ?debug=1: the diagnostics recorder also hashes after every single command
// (default: after each end-turn round) — finer replay divergence pinpointing
const session = createSession(ruleset, initialState, { debug: params.get('debug') === '1' });
const sel = { unitId: null, cityId: null, lastMoved: null };
const ctx = { session, renderer, sel, HUMAN: 'p1', errors: capturedErrors, rulesOverrides };

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

initOptions(ctx);
ctx.hud = initHud(ctx);
ctx.panels = initPanels(ctx);
ctx.handoff = initHandoff(ctx);
initInput(ctx);
initSaves(ctx);
ctx.turnlog = initTurnLog(ctx);

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
  session.apply({ type: 'foundCity', playerId: ctx.HUMAN, unitId: firstUnit.id, name: 'Testopolis' });
  ctx.panels.toggleResearchPanel();
  if (session.state.cityOrder.length > 0) {
    ctx.panels.openCityPanel(session.state.cityOrder[0]);
    // click a worked mini-map tile: unassigns it and switches to manual mode
    const workedCell = document.querySelector('#city-map .ctile.assignable.worked');
    if (workedCell) workedCell.click();
  }
  probe.textContent += ' · diaglog: ' + session.log.length // recorder captured the commands
    + ' · errors: ' + capturedErrors.length; // hover sweep etc. must stay clean
  if (params.get('e2eclose') === '1') ctx.panels.closeAll(); // unobstructed screenshots
}

// ?e2e=2 (with &humans=2): scripted hotseat hand-off — end player 1's turn
// (twice: the first press is the units-still-have-moves confirmation) so the
// opaque hand-off screen for player 2 is up when --dump-dom fires.
if (params.get('e2e') === '2') {
  ctx.endTurn();
  ctx.endTurn();
}

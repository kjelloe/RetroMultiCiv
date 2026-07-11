// Bootstrap: fetch the ruleset, create the world + session, wire the UI.
// State lives in session.js; panels/input/saves/hud are in ui/*.
// URL params: ?seed=N fixed world · ?civs=2..7 · ?mock=1 static state · ?diag=1
import { createRenderer } from './renderer/renderer.js';
import { getGraphicsDiagnostics, showDiagnostics, webglHelp } from './diagnostics.js';
import { createSession } from './session.js';
import { initHud } from './ui/hud.js';
import { initPanels } from './ui/panels.js';
import { initInput } from './ui/input.js';
import { initSaves } from './ui/saves.js';
import { initTurnLog } from './ui/turnlog.js';

const HUMAN = 'p1';
const hudStatus = document.getElementById('hud-status');

// surface any failure in the HUD — a silent exception otherwise looks like an empty map
window.addEventListener('error', e => {
  hudStatus.textContent = `ERROR: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`;
  hudStatus.style.color = '#ff7b6b';
});
window.addEventListener('unhandledrejection', e => {
  hudStatus.textContent = `ERROR: ${e.reason && e.reason.message ? e.reason.message : e.reason}`;
  hudStatus.style.color = '#ff7b6b';
});

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const params = new URLSearchParams(location.search);
const [terrain, units, techs, buildings, wonders, rules] = await Promise.all([
  fetchJson('../data/terrain.json'),
  fetchJson('../data/units.json'),
  fetchJson('../data/techs.json'),
  fetchJson('../data/buildings.json'),
  fetchJson('../data/wonders.json'),
  fetchJson('../data/rules.json')
]);
const ruleset = { terrain, units, techs, buildings, wonders, rules };

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
let humanCityNames = [];
if (params.get('mock') === '1') {
  initialState = await fetchJson('./mock-state.json');
} else {
  const seed = parseInt(params.get('seed') || '', 10) || (Date.now() % 1000000);
  const CIV_ROSTER = [
    { name: 'Romans', color: '#3b7dd8', cities: ['Rome', 'Ostia', 'Antium', 'Cumae', 'Pompeii', 'Ravenna', 'Neapolis', 'Verona'] },
    { name: 'Zulus', color: '#d84a3b', cities: ['Zimbabwe', 'Ulundi', 'Bapedi', 'Hlobane', 'Isandhlwana', 'Intombe', 'Mpondo', 'Ngome'] },
    { name: 'Egyptians', color: '#d8b13b', cities: ['Thebes', 'Memphis', 'Heliopolis', 'Elephantine', 'Alexandria', 'Byblos', 'Giza', 'Cairo'] },
    { name: 'Greeks', color: '#3bd875', cities: ['Athens', 'Sparta', 'Corinth', 'Delphi', 'Eretria', 'Pharsalos', 'Argos', 'Mycenae'] },
    { name: 'Babylonians', color: '#b13bd8', cities: ['Babylon', 'Sumer', 'Uruk', 'Nineveh', 'Ashur', 'Akkad', 'Eridu', 'Lagash'] },
    { name: 'Mongols', color: '#d8703b', cities: ['Samarkand', 'Bokhara', 'Nishapur', 'Karakorum', 'Kashgar', 'Tabriz', 'Kabul'] },
    { name: 'Aztecs', color: '#3bc9d8', cities: ['Tenochtitlan', 'Teotihuacan', 'Tlatelolco', 'Texcoco', 'Tlaxcala', 'Xochicalco', 'Tlacopan'] }
  ];
  humanCityNames = CIV_ROSTER[0].cities; // founding-name suggestions
  const civs = Math.min(CIV_ROSTER.length, Math.max(2, parseInt(params.get('civs') || '2', 10) || 2));
  const playerDefs = [];
  for (let i = 0; i < civs; i++) {
    playerDefs.push({ id: 'p' + (i + 1), ...CIV_ROSTER[i], human: i === 0 });
  }
  initialState = createEngine(ruleset).createGame({
    seed, options: { width: 80, height: 50, players: playerDefs }
  });
  if (initialState.ok === false) throw new Error(`createGame failed: ${initialState.reason}`);
  history.replaceState(null, '', `?seed=${seed}&civs=${civs}`);
}

// --- wiring ------------------------------------------------------------------
const session = createSession(ruleset, initialState);
const sel = { unitId: null, cityId: null, lastMoved: null };
const ctx = { session, renderer, sel, HUMAN };

ctx.selectUnit = (unit, opts) => {
  sel.unitId = unit.id;
  sel.cityId = null;
  renderer.setSelection({ unitId: unit.id });
  if (!opts || !opts.keepStack) ctx.panels.closeStackPanel();
  ctx.hud.unitNote(unit);
  if (ctx.refreshActionBar) ctx.refreshActionBar();
};

// next unused name from the civilization's roster, else a numbered fallback
ctx.suggestCityName = () => {
  const taken = {};
  for (const cid of Object.keys(session.state.cities)) {
    taken[session.state.cities[cid].name] = true;
  }
  for (const name of humanCityNames) {
    if (!taken[name]) return name;
  }
  return `New City ${session.state.nextCityId}`;
};

ctx.hud = initHud(ctx);
ctx.panels = initPanels(ctx);
initInput(ctx);
initSaves(ctx);
initTurnLog(ctx);

session.onChange(() => {
  ctx.hud.refresh();
  ctx.panels.refresh();
});

ctx.hud.refresh();
const firstUnit = Object.values(session.state.units).find(
  u => u.owner === HUMAN && session.state.players[HUMAN].human
);
if (firstUnit) {
  ctx.selectUnit(firstUnit);
  renderer.centerOn(firstUnit.x, firstUnit.y);
}

// ?e2e=1: scripted sequence for the headless browser test — found a city with
// the starting settlers and fill both panels, so their code paths execute
// (hidden panel content stays in the DOM for --dump-dom to assert on).
if (params.get('e2e') === '1' && firstUnit && firstUnit.type === 'settlers') {
  // snapshot the selected settler's action bar before founding consumes it
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  probe.textContent = 'actionbar: ' + document.getElementById('action-bar').textContent;
  document.body.appendChild(probe);
  session.apply({ type: 'foundCity', playerId: HUMAN, unitId: firstUnit.id, name: 'Testopolis' });
  ctx.panels.toggleResearchPanel();
  if (session.state.cityOrder.length > 0) {
    ctx.panels.openCityPanel(session.state.cityOrder[0]);
    // click a worked mini-map tile: unassigns it and switches to manual mode
    const workedCell = document.querySelector('#city-map .ctile.assignable.worked');
    if (workedCell) workedCell.click();
  }
}

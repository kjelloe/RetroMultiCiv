// Game shell: generate a world with the engine, render it, route input as
// engine commands. Panels (research, city view) are plain DOM overlays.
// URL params: ?seed=N fixed world · ?civs=2..7 · ?mock=1 static state · ?diag=1
import { createEngine } from '../engine/index.js';
import { filterView } from '../engine/visibility.js';
import { availableTechs, researchCost } from '../engine/tech.js';
import { workedTiles } from '../engine/cities.js';
import { runAiTurn } from '../engine/ai.js';
import { score } from '../engine/score.js';
import { createRenderer, terrainColor } from './renderer/renderer.js';

const SAVE_KEY = 'retromulticiv-save';
const HUMAN = 'p1';

const hudTile = document.getElementById('hud-tile');
const hudSelection = document.getElementById('hud-selection');
const hudStatus = document.getElementById('hud-status');
const endTurnBtn = document.getElementById('end-turn');
const researchBar = document.getElementById('research-bar');
const researchFill = document.getElementById('research-fill');
const researchLabel = document.getElementById('research-label');
const researchPanel = document.getElementById('research-panel');
const cityPanel = document.getElementById('city-panel');

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
const engine = createEngine(ruleset);

let state;
if (params.get('mock') === '1') {
  state = await fetchJson('./mock-state.json');
} else {
  const seed = parseInt(params.get('seed') || '', 10) || (Date.now() % 1000000);
  const CIV_ROSTER = [
    { name: 'Romans', color: '#3b7dd8' },
    { name: 'Zulus', color: '#d84a3b' },
    { name: 'Egyptians', color: '#d8b13b' },
    { name: 'Greeks', color: '#3bd875' },
    { name: 'Babylonians', color: '#b13bd8' },
    { name: 'Mongols', color: '#d8703b' },
    { name: 'Aztecs', color: '#3bc9d8' }
  ];
  const civs = Math.min(CIV_ROSTER.length, Math.max(2, parseInt(params.get('civs') || '2', 10) || 2));
  const playerDefs = [];
  for (let i = 0; i < civs; i++) {
    playerDefs.push({ id: 'p' + (i + 1), ...CIV_ROSTER[i], human: i === 0 });
  }
  state = engine.createGame({ seed, options: { width: 80, height: 50, players: playerDefs } });
  if (state.ok === false) throw new Error(`createGame failed: ${state.reason}`);
  history.replaceState(null, '', `?seed=${seed}&civs=${civs}`);
}

// --- graphics diagnostics (design contributed by the project's WebGL ally) ---
// Separate canvases per context type: asking one canvas for "webgl" after it
// already returned a "webgl2" context yields null and under-reports support.
function getGraphicsDiagnostics() {
  let webgl2 = null, webgl1 = null;
  try { webgl2 = document.createElement('canvas').getContext('webgl2'); } catch (_e) { /* unsupported */ }
  try {
    const c = document.createElement('canvas');
    webgl1 = c.getContext('webgl') || c.getContext('experimental-webgl');
  } catch (_e) { /* unsupported */ }
  const gl = webgl2 || webgl1;
  const diag = { webgl2: Boolean(webgl2), webgl1: Boolean(webgl1), renderer: null, vendor: null };
  if (gl) {
    // Firefox exposes the real GPU via plain RENDERER/VENDOR (its
    // WEBGL_debug_renderer_info is deprecated and warns). Chrome/Safari mask
    // the plain values, so fall back to the extension only when needed.
    diag.renderer = gl.getParameter(gl.RENDERER);
    diag.vendor = gl.getParameter(gl.VENDOR);
    if (/webkit|mozilla|apple gpu/i.test(`${diag.renderer} ${diag.vendor}`)) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      if (info) {
        diag.renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
        diag.vendor = gl.getParameter(info.UNMASKED_VENDOR_WEBGL);
      }
    }
  }
  return diag;
}

function showDiagnostics(diag) {
  const el = document.getElementById('hud-diag');
  el.textContent =
    `WebGL2: ${diag.webgl2 ? 'yes' : 'NO'} · WebGL1: ${diag.webgl1 ? 'yes' : 'NO'}\n` +
    `GPU: ${diag.renderer || 'none'}\n` +
    `vendor: ${diag.vendor || 'none'} · ${navigator.userAgent.match(/(firefox|edg|chrome)\/[\d.]+/i)?.[0] || 'browser'}` +
    (diag.webgl2 ? '' : diag.webgl1 ? '\nrunning on the WebGL1 fallback (three r162)' : '');
}

function webglHelp() {
  return 'WebGL is unavailable. Check that hardware acceleration is enabled ' +
    '(chrome://settings/system), review chrome://gpu, fully restart the browser ' +
    '(chrome://restart — a crashed GPU process gives "BindToCurrentSequence failed" ' +
    'until restart), or try another browser.';
}

// vendored three.js is pinned to r162 — the last release with WebGL1 fallback —
// so browsers stuck on the ANGLE Direct3D9 path (WebGL1 only) still render
let renderer;
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
try {
  renderer = createRenderer(document.getElementById('app'));
} catch (err) {
  hudStatus.style.color = '#ff7b6b';
  hudStatus.textContent = `The 3D map could not start: ${err.message} — ${webglHelp()}`;
  showDiagnostics(diag);
  throw err;
}

let selectedUnitId = null;
let selectedCityId = null;
let openCityId = null;

// --- small helpers ---------------------------------------------------------
function humanUnits() {
  return Object.values(state.units).filter(
    u => u.owner === state.activePlayer && state.players[u.owner].human
  );
}

function describeTile(x, y) {
  const tile = state.map.tiles[y * state.map.width + x];
  const extras = (tile.river ? ' +river' : '') + (tile.special ? ' ★' : '');
  return `(${x},${y}) ${tile.t}${extras}`;
}

// Map a click on a neighboring tile to a direction command.
function dirTo(unit, tx, ty) {
  let dx = tx - unit.x;
  if (state.map.wrapX) {
    if (dx > 1) dx -= state.map.width;
    if (dx < -1) dx += state.map.width;
  }
  const dy = ty - unit.y;
  const key = { '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE', '0,1': 'S', '-1,1': 'SW', '-1,0': 'W', '-1,-1': 'NW' };
  return key[`${dx},${dy}`];
}

function itemDef(item) {
  if (item.kind === 'building') return buildings[item.id];
  if (item.kind === 'wonder') return wonders[item.id];
  return units[item.id];
}

function describeEvents(events) {
  for (const e of events) {
    if (e.type === 'combatResolved') {
      return e.winner === 'attacker'
        ? `⚔ attack succeeded (${e.unitsLost} enemy lost)`
        : '⚔ attack failed — unit lost';
    }
    if (e.type === 'cityCaptured') {
      return `🏰 ${state.cities[e.cityId].name} captured! (+${e.plunder} gold)`;
    }
    if (e.type === 'techDiscovered' && e.playerId === HUMAN) {
      return `🔬 ${techs[e.tech].name} discovered!`;
    }
  }
  return null;
}

function selectUnit(unit) {
  selectedUnitId = unit.id;
  selectedCityId = null;
  renderer.setSelection({ unitId: unit.id });
  const hint = unit.type === 'settlers' ? ' · B: found city' : ' · F: fortify';
  hudSelection.textContent = `${units[unit.type].name} at (${unit.x},${unit.y}) · moves ${unit.moves}${hint}`;
}

// --- research bar + panel --------------------------------------------------
function updateResearchBar() {
  const me = state.players[HUMAN];
  const bulbs = me.bulbs === undefined ? 0 : me.bulbs;
  if (me.researching) {
    const cost = researchCost(state, HUMAN, ruleset);
    researchFill.style.width = Math.min(100, Math.floor(bulbs * 100 / cost)) + '%';
    researchLabel.textContent = `🔬 ${techs[me.researching].name} · ${bulbs}/${cost} · 💰 ${me.gold}`;
  } else {
    researchFill.style.width = '0%';
    researchLabel.textContent = `🔬 choose research · ${bulbs} bulbs · 💰 ${me.gold}`;
  }
}

function fillResearchPanel() {
  const me = state.players[HUMAN];
  const summary = document.getElementById('research-summary');
  const cost = researchCost(state, HUMAN, ruleset);
  summary.textContent = `${me.techs.length}/${Object.keys(techs).length} advances known · `
    + `${me.bulbs || 0} bulbs · next costs ${cost} · tax ${me.taxRate}% / sci ${me.sciRate}%`;

  const list = document.getElementById('research-list');
  list.textContent = '';
  const avail = availableTechs(state, HUMAN, ruleset)
    .sort((a, b) => techs[a].level - techs[b].level || (a < b ? -1 : 1));
  let level = -1;
  for (const id of avail) {
    if (techs[id].level !== level) {
      level = techs[id].level;
      const h = document.createElement('div');
      h.className = 'group-title';
      h.textContent = `level ${level}`;
      list.appendChild(h);
    }
    const btn = document.createElement('button');
    btn.className = 'option' + (me.researching === id ? ' current' : '');
    btn.textContent = techs[id].name;
    btn.addEventListener('click', () => {
      if (apply({ type: 'setResearch', playerId: HUMAN, tech: id })) {
        fillResearchPanel();
      }
    });
    list.appendChild(btn);
  }
  if (avail.length === 0) {
    const done = document.createElement('div');
    done.textContent = 'nothing left to research';
    list.appendChild(done);
  }
}

// --- city panel --------------------------------------------------------------
function openCityPanel(cityId) {
  openCityId = cityId;
  selectedCityId = cityId;
  selectedUnitId = null;
  const city = state.cities[cityId];
  renderer.setSelection({ tile: { x: city.x, y: city.y } });
  renderer.centerOn(city.x, city.y);
  fillCityPanel();
  cityPanel.classList.remove('hidden');
  researchPanel.classList.add('hidden');
}

function fillCityPanel() {
  const city = state.cities[openCityId];
  if (!city) { closeCityPanel(); return; }
  document.getElementById('city-title').textContent =
    `🏛 ${city.name} — pop ${city.pop} (${state.players[city.owner].name})`;

  const worked = workedTiles(state, city, ruleset);
  const totals = { food: 0, shields: 0, trade: 0 };
  for (const w of worked) {
    totals.food += w.yields.food; totals.shields += w.yields.shields; totals.trade += w.yields.trade;
  }
  const surplus = totals.food - city.pop * 2;
  const threshold = 10 * (city.pop + 1);
  const def = itemDef(city.producing);
  const prodLeft = def.cost - city.shields;
  const stats = document.getElementById('city-stats');
  stats.innerHTML = '';
  const lines = [
    `🌾 food ${totals.food} (−${city.pop * 2} eaten, ${surplus >= 0 ? '+' : ''}${surplus}/turn) · box ${city.food}/${threshold}`,
    surplus > 0 ? `population grows in ~${Math.max(1, Math.ceil((threshold - city.food) / surplus))} turns` : 'no growth',
    `⚒ shields ${totals.shields}/turn · 🪙 trade ${totals.trade}/turn`,
    `building: ${def.name} ${city.shields}/${def.cost}` +
      (totals.shields > 0 ? ` (~${Math.max(1, Math.ceil(prodLeft / totals.shields))} turns)` : ''),
    (city.buildings || []).length
      ? `built: ${(city.buildings || []).map(b => buildings[b].name).join(', ')}`
      : 'no buildings yet'
  ];
  for (const text of lines) {
    const div = document.createElement('div');
    if (text.startsWith('population grows')) div.className = 'grow';
    div.textContent = text;
    stats.appendChild(div);
  }

  // 5x5 workable area, city at the center
  const map = document.getElementById('city-map');
  map.textContent = '';
  const isWorked = {};
  for (const w of worked) isWorked[`${w.x},${w.y}`] = true;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cell = document.createElement('div');
      cell.className = 'ctile';
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) {
        cell.className += ' corner';
        map.appendChild(cell);
        continue;
      }
      let x = city.x + dx;
      const y = city.y + dy;
      if (state.map.wrapX) x = ((x % state.map.width) + state.map.width) % state.map.width;
      if (y < 0 || y >= state.map.height) {
        cell.className += ' corner';
        map.appendChild(cell);
        continue;
      }
      const tile = state.map.tiles[y * state.map.width + x];
      cell.style.background = terrainColor(tile.t);
      if (tile.river) cell.style.boxShadow = 'inset 0 0 0 2px #3a7ac8';
      if (isWorked[`${x},${y}`]) cell.className += ' worked';
      if (dx === 0 && dy === 0) cell.className += ' center';
      else {
        const y_ = tile.special ? '★' : '';
        const ty = ruleset.terrain.terrains[tile.t];
        const base = tile.special ? ty.special.yields : ty.yields;
        const trade = base.trade + (tile.river ? ruleset.terrain.riverModifier.tradeBonus : 0);
        cell.textContent = `${y_}${base.food}/${base.shields}/${trade}`;
      }
      cell.title = describeTile(x, y);
      map.appendChild(cell);
    }
  }

  // production choices
  const prodEl = document.getElementById('city-production');
  prodEl.textContent = '';
  const me = state.players[HUMAN];
  const addGroup = (title) => {
    const h = document.createElement('div');
    h.className = 'group-title';
    h.textContent = title;
    prodEl.appendChild(h);
  };
  const addOption = (item, label) => {
    const btn = document.createElement('button');
    btn.className = 'option'
      + (city.producing.kind === item.kind && city.producing.id === item.id ? ' current' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (apply({ type: 'setProduction', playerId: HUMAN, cityId: city.id, item })) fillCityPanel();
    });
    prodEl.appendChild(btn);
  };
  addGroup('units');
  for (const id of Object.keys(units).sort()) {
    const u = units[id];
    if (u.tech !== '' && !me.techs.includes(u.tech)) continue;
    addOption({ kind: 'unit', id }, `${u.name} · ${u.cost}⚒ · ${u.attack}/${u.defense}/${u.moves}`);
  }
  addGroup('buildings');
  for (const id of Object.keys(buildings).sort()) {
    const b = buildings[id];
    if ((city.buildings || []).includes(id)) continue;
    if (b.tech !== '' && !me.techs.includes(b.tech)) continue;
    addOption({ kind: 'building', id }, `${b.name} · ${b.cost}⚒ · upkeep ${b.maintenance}`);
  }
  addGroup('wonders');
  for (const id of Object.keys(wonders).sort()) {
    const w = wonders[id];
    if (state.wonders && state.wonders[id] !== undefined) continue;
    if (w.tech !== '' && !me.techs.includes(w.tech)) continue;
    addOption({ kind: 'wonder', id }, `${w.name} · ${w.cost}⚒`);
  }
}

function closeCityPanel() {
  openCityId = null;
  cityPanel.classList.add('hidden');
}

function closePanels() {
  closeCityPanel();
  researchPanel.classList.add('hidden');
}

// --- main refresh ------------------------------------------------------------
function refresh() {
  renderer.setViewState(filterView(state, HUMAN));
  renderer.setSelection(selectedUnitId ? { unitId: selectedUnitId } : null);
  const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
  if (state.gameOver) {
    const w = state.players[state.winner];
    const verdict = state.winner === HUMAN ? '🏆 VICTORY' : '💀 DEFEAT';
    const scores = state.playerOrder.map(p => `${state.players[p].name} ${score(state, p, ruleset)}`).join(' · ');
    hudStatus.style.color = state.winner === HUMAN ? '#ffe066' : '#ff7b6b';
    hudStatus.textContent = `${verdict} — ${w.name} wins (turn ${state.turn}) · scores: ${scores}`;
  } else {
    hudStatus.textContent = `turn ${state.turn} · ${year} · ${state.players[state.activePlayer].name}`;
  }
  updateResearchBar();
  if (openCityId) fillCityPanel();
  if (!researchPanel.classList.contains('hidden')) fillResearchPanel();
}

function apply(cmd) {
  const res = engine.applyCommand(state, cmd);
  if (res.ok) {
    state = res.state;
    if (selectedUnitId && !state.units[selectedUnitId]) selectedUnitId = null;
    refresh();
    const note = describeEvents(res.events);
    if (note) hudSelection.textContent = note;
  } else {
    hudSelection.textContent = `✗ ${cmd.type}: ${res.reason}`;
  }
  return res.ok;
}

function endTurn() {
  selectedUnitId = null;
  if (!apply({ type: 'endTurn', playerId: state.activePlayer })) return;
  let guard = 10;
  while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
    state = runAiTurn(engine, state, state.activePlayer, ruleset);
    const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
    if (!res.ok) break;
    state = res.state;
  }
  refresh();
}

// --- renderer input ----------------------------------------------------------
renderer.onHover(pick => {
  hudTile.textContent = pick ? describeTile(pick.tile.x, pick.tile.y) : '';
});

renderer.onPick(pick => {
  const unit = pick.unitId ? state.units[pick.unitId] : null;
  if (unit && unit.owner === state.activePlayer) {
    selectUnit(unit);
    return;
  }
  const city = pick.cityId ? state.cities[pick.cityId] : null;
  if (city && city.owner === state.activePlayer) {
    openCityPanel(city.id);
    return;
  }
  if (selectedUnitId && state.units[selectedUnitId]) {
    const sel = state.units[selectedUnitId];
    const dir = dirTo(sel, pick.tile.x, pick.tile.y);
    if (dir) {
      if (apply({ type: 'moveUnit', playerId: state.activePlayer, unitId: sel.id, dir })) {
        const moved = state.units[selectedUnitId];
        if (moved) hudSelection.textContent = `${units[moved.type].name} at (${moved.x},${moved.y}) · moves ${moved.moves}`;
      }
      return;
    }
  }
  selectedUnitId = null;
  selectedCityId = null;
  hudSelection.textContent = describeTile(pick.tile.x, pick.tile.y);
  renderer.setSelection({ tile: pick.tile });
});

// --- panel chrome ------------------------------------------------------------
researchBar.addEventListener('click', () => {
  if (researchPanel.classList.contains('hidden')) {
    fillResearchPanel();
    researchPanel.classList.remove('hidden');
    closeCityPanel();
  } else {
    researchPanel.classList.add('hidden');
  }
});
for (const btn of document.querySelectorAll('.panel-close')) {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.close).classList.add('hidden'));
}
cityPanel.querySelector('.panel-close').addEventListener('click', () => { openCityId = null; });

// --- keyboard ----------------------------------------------------------------
const PRODUCTION_KEYS = { 1: 'militia', 2: 'phalanx', 3: 'settlers' };

endTurnBtn.addEventListener('click', endTurn);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePanels(); return; }
  if (e.key === 'Enter' || e.key === 'e') { endTurn(); return; }
  if (e.key === 'b' && selectedUnitId) {
    const unitId = selectedUnitId;
    if (apply({ type: 'foundCity', playerId: state.activePlayer, unitId })) {
      selectedUnitId = null;
      openCityPanel(state.cityOrder[state.cityOrder.length - 1]);
    }
    return;
  }
  if (e.key === 'f' && selectedUnitId) {
    if (apply({ type: 'fortify', playerId: state.activePlayer, unitId: selectedUnitId })) {
      hudSelection.textContent = `🛡 ${units[state.units[selectedUnitId].type].name} fortified`;
    }
    return;
  }
  if (e.key === 'n') {
    const movable = Object.values(state.units).filter(
      u => u.owner === HUMAN && u.moves > 0 && u.id !== selectedUnitId
    );
    if (movable.length === 0) { hudSelection.textContent = 'no units with moves left — E to end turn'; return; }
    const unit = movable[0];
    selectUnit(unit);
    renderer.centerOn(unit.x, unit.y);
    return;
  }
  if (e.key === 'S') { // Shift+S: download a JSON save file (debugging/sharing)
    const envelope = {
      format: 'retromulticiv-save',
      savedAt: new Date().toISOString(),
      turn: state.turn,
      state
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `retromulticiv-turn${state.turn}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    hudSelection.textContent = `💾 downloaded ${a.download}`;
    return;
  }
  if (e.key === 'L') { // Shift+L: load from a JSON file
    fileInput.click();
    return;
  }
  if (e.key === 's') {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    hudSelection.textContent = `💾 saved (turn ${state.turn})`;
    return;
  }
  if (e.key === 'l') {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { hudSelection.textContent = 'no save found'; return; }
    try {
      loadStateObject(JSON.parse(raw), 'browser save');
    } catch (err) {
      hudSelection.textContent = `load failed: ${err.message}`;
    }
    return;
  }
  if (e.key === 't') {
    const avail = availableTechs(state, HUMAN, ruleset);
    if (avail.length === 0 || state.activePlayer !== HUMAN) return;
    const idx = avail.indexOf(state.players[HUMAN].researching);
    const next = avail[(idx + 1) % avail.length];
    apply({ type: 'setResearch', playerId: HUMAN, tech: next });
    return;
  }
  if (e.key === 'c' && selectedCityId) {
    // legacy cycle key — the city panel is the primary UI now
    const city = state.cities[selectedCityId];
    const options = [];
    for (const id of Object.keys(buildings).sort()) {
      if ((city.buildings || []).includes(id)) continue;
      if (buildings[id].tech === '' || state.players[HUMAN].techs.includes(buildings[id].tech)) {
        options.push({ kind: 'building', id });
      }
    }
    for (const id of Object.keys(wonders).sort()) {
      if (state.wonders && state.wonders[id] !== undefined) continue;
      if (wonders[id].tech === '' || state.players[HUMAN].techs.includes(wonders[id].tech)) {
        options.push({ kind: 'wonder', id });
      }
    }
    if (options.length === 0) return;
    const idx = options.findIndex(o => o.kind === city.producing.kind && o.id === city.producing.id);
    apply({ type: 'setProduction', playerId: state.activePlayer, cityId: selectedCityId, item: options[(idx + 1) % options.length] });
    return;
  }
  if (PRODUCTION_KEYS[e.key] && selectedCityId) {
    const item = { kind: 'unit', id: PRODUCTION_KEYS[e.key] };
    apply({ type: 'setProduction', playerId: state.activePlayer, cityId: selectedCityId, item });
  }
});

// --- save files ----------------------------------------------------------------
function stateLooksValid(s) {
  return Boolean(s) && Boolean(s.map) && Array.isArray(s.map.tiles)
    && s.map.tiles.length === s.map.width * s.map.height
    && Boolean(s.units) && Boolean(s.players) && Array.isArray(s.playerOrder);
}

// Accepts a save-file envelope ({ format: 'retromulticiv-save', state }) or a
// bare state object (older localStorage saves).
function loadStateObject(obj, sourceLabel) {
  const s = obj && obj.format === 'retromulticiv-save' ? obj.state : obj;
  if (!stateLooksValid(s)) {
    hudSelection.textContent = `✗ not a RetroMultiCiv save (${sourceLabel})`;
    return;
  }
  state = s;
  selectedUnitId = null;
  selectedCityId = null;
  closePanels();
  refresh();
  hudSelection.textContent = `📂 loaded ${sourceLabel} (turn ${state.turn})`;
}

function loadFromFile(file) {
  file.text().then(text => {
    try {
      loadStateObject(JSON.parse(text), file.name);
    } catch (err) {
      hudSelection.textContent = `✗ ${file.name}: ${err.message}`;
    }
  });
}

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,application/json';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) loadFromFile(fileInput.files[0]);
  fileInput.value = '';
});

// drag & drop a save file anywhere on the page
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files.length > 0) loadFromFile(e.dataTransfer.files[0]);
});

// --- go ------------------------------------------------------------------------
refresh();
const firstUnit = humanUnits()[0];
if (firstUnit) renderer.centerOn(firstUnit.x, firstUnit.y);

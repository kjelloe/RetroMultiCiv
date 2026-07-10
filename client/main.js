// Game shell (phase 1): generate a real world with the engine, render it,
// and route input as engine commands. The view is still the full state —
// fog-of-war filtering (engine/visibility.js) is a later slice.
// URL params: ?seed=12345 for a reproducible world, ?mock=1 for the old
// static mock state.
import { createEngine } from '../engine/index.js';
import { filterView } from '../engine/visibility.js';
import { availableTechs, researchCost } from '../engine/tech.js';
import { runAiTurn } from '../engine/ai.js';
import { score } from '../engine/score.js';
import { createRenderer } from './renderer/renderer.js';

const SAVE_KEY = 'retromulticiv-save';

const HUMAN = 'p1';

const hudTile = document.getElementById('hud-tile');
const hudSelection = document.getElementById('hud-selection');
const hudStatus = document.getElementById('hud-status');
const endTurnBtn = document.getElementById('end-turn');

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
  hudStatus.textContent = `seed ${seed} · turn ${state.turn}`;
}

// Graphics diagnostics (design contributed by the project's WebGL ally).
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

function humanUnits() {
  return Object.values(state.units).filter(
    u => u.owner === state.activePlayer && state.players[u.owner].human
  );
}

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
  const me = state.players[HUMAN];
  const hudResearch = document.getElementById('hud-research');
  const bulbs = me.bulbs === undefined ? 0 : me.bulbs;
  hudResearch.textContent = me.researching
    ? `🔬 ${techs[me.researching].name} ${bulbs}/${researchCost(state, HUMAN, ruleset)} · 💰 ${me.gold}`
    : `🔬 nothing (press T) · ${bulbs} bulbs · 💰 ${me.gold}`;
}

function producingDef(city) {
  const p = city.producing;
  if (p.kind === 'building') return buildings[p.id];
  if (p.kind === 'wonder') return wonders[p.id];
  return units[p.id];
}

function showCity(city) {
  const def = producingDef(city);
  const built = (city.buildings || []).length;
  hudSelection.textContent =
    `${city.name} · pop ${city.pop} · food ${city.food}/${10 * (city.pop + 1)}` +
    ` · building ${def.name} ${city.shields}/${def.cost}` +
    (built ? ` · ${built} bldg` : '') +
    ` · keys: 1/2/3 units · C: buildings/wonders`;
}

// every building/wonder the selected city could start right now
function constructionOptions(city) {
  const me = state.players[HUMAN];
  const out = [];
  for (const id of Object.keys(buildings).sort()) {
    const b = buildings[id];
    if ((city.buildings || []).includes(id)) continue;
    if (b.tech !== '' && !me.techs.includes(b.tech)) continue;
    out.push({ kind: 'building', id });
  }
  for (const id of Object.keys(wonders).sort()) {
    const w = wonders[id];
    if (state.wonders && state.wonders[id] !== undefined) continue;
    if (w.tech !== '' && !me.techs.includes(w.tech)) continue;
    out.push({ kind: 'wonder', id });
  }
  return out;
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
  }
  return null;
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

renderer.onHover(pick => {
  hudTile.textContent = pick ? describeTile(pick.tile.x, pick.tile.y) : '';
});

renderer.onPick(pick => {
  const unit = pick.unitId ? state.units[pick.unitId] : null;
  if (unit && unit.owner === state.activePlayer) {
    selectedUnitId = unit.id;
    selectedCityId = null;
    const hint = unit.type === 'settlers' ? ' · B: found city' : '';
    hudSelection.textContent = `${units[unit.type].name} at (${unit.x},${unit.y}) · moves ${unit.moves}${hint}`;
    renderer.setSelection({ unitId: unit.id });
    return;
  }
  const city = pick.cityId ? state.cities[pick.cityId] : null;
  if (city && city.owner === state.activePlayer) {
    selectedCityId = city.id;
    selectedUnitId = null;
    showCity(city);
    renderer.setSelection({ tile: { x: city.x, y: city.y } });
    return;
  }
  if (selectedUnitId && state.units[selectedUnitId]) {
    const sel = state.units[selectedUnitId];
    const dir = dirTo(sel, pick.tile.x, pick.tile.y);
    if (dir) {
      if (apply({ type: 'moveUnit', playerId: state.activePlayer, unitId: sel.id, dir })) {
        const moved = state.units[selectedUnitId];
        hudSelection.textContent = `${units[moved.type].name} at (${moved.x},${moved.y}) · moves ${moved.moves}`;
      }
      return;
    }
  }
  selectedUnitId = null;
  selectedCityId = null;
  hudSelection.textContent = describeTile(pick.tile.x, pick.tile.y);
  renderer.setSelection({ tile: pick.tile });
});

const PRODUCTION_KEYS = { 1: 'militia', 2: 'phalanx', 3: 'settlers' };

endTurnBtn.addEventListener('click', endTurn);
window.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === 'e') { endTurn(); return; }
  if (e.key === 'b' && selectedUnitId) {
    const unitId = selectedUnitId;
    if (apply({ type: 'foundCity', playerId: state.activePlayer, unitId })) {
      selectedUnitId = null;
      const cityId = state.cityOrder[state.cityOrder.length - 1];
      selectedCityId = cityId;
      showCity(state.cities[cityId]);
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
    selectedUnitId = unit.id;
    selectedCityId = null;
    renderer.setSelection({ unitId: unit.id });
    renderer.centerOn(unit.x, unit.y);
    const hint = unit.type === 'settlers' ? ' · B: found city' : ' · F: fortify';
    hudSelection.textContent = `${units[unit.type].name} at (${unit.x},${unit.y}) · moves ${unit.moves}${hint}`;
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
      state = JSON.parse(raw);
      selectedUnitId = null;
      selectedCityId = null;
      refresh();
      hudSelection.textContent = `📂 loaded (turn ${state.turn})`;
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
    const city = state.cities[selectedCityId];
    const options = constructionOptions(city);
    if (options.length === 0) return;
    const idx = options.findIndex(o => o.kind === city.producing.kind && o.id === city.producing.id);
    const next = options[(idx + 1) % options.length];
    if (apply({ type: 'setProduction', playerId: state.activePlayer, cityId: selectedCityId, item: next })) {
      showCity(state.cities[selectedCityId]);
    }
    return;
  }
  if (PRODUCTION_KEYS[e.key] && selectedCityId) {
    const item = { kind: 'unit', id: PRODUCTION_KEYS[e.key] };
    if (apply({ type: 'setProduction', playerId: state.activePlayer, cityId: selectedCityId, item })) {
      showCity(state.cities[selectedCityId]);
    }
  }
});

refresh();
const firstUnit = humanUnits()[0];
if (firstUnit) renderer.centerOn(firstUnit.x, firstUnit.y);

// Game shell (phase 1): generate a real world with the engine, render it,
// and route input as engine commands. The view is still the full state —
// fog-of-war filtering (engine/visibility.js) is a later slice.
// URL params: ?seed=12345 for a reproducible world, ?mock=1 for the old
// static mock state.
import { createEngine } from '../engine/index.js';
import { filterView } from '../engine/visibility.js';
import { createRenderer } from './renderer/renderer.js';

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
const [terrain, units] = await Promise.all([
  fetchJson('../data/terrain.json'),
  fetchJson('../data/units.json')
]);
const engine = createEngine({ terrain, units });

let state;
if (params.get('mock') === '1') {
  state = await fetchJson('./mock-state.json');
} else {
  const seed = parseInt(params.get('seed') || '', 10) || (Date.now() % 1000000);
  state = engine.createGame({
    seed,
    options: {
      width: 80, height: 50,
      players: [
        { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
        { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
      ]
    }
  });
  if (state.ok === false) throw new Error(`createGame failed: ${state.reason}`);
  history.replaceState(null, '', `?seed=${seed}`);
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
  hudStatus.textContent = `turn ${state.turn} · ${year} · ${state.players[state.activePlayer].name}`;
}

function showCity(city) {
  const type = units[city.producing.id];
  hudSelection.textContent =
    `${city.name} · pop ${city.pop} · food ${city.food}/${10 * (city.pop + 1)}` +
    ` · building ${type.name} ${city.shields}/${type.cost} · keys: 1 militia · 2 phalanx · 3 settlers`;
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

function apply(cmd) {
  const res = engine.applyCommand(state, cmd);
  if (res.ok) {
    state = res.state;
    refresh();
  } else {
    hudSelection.textContent = `✗ ${cmd.type}: ${res.reason}`;
  }
  return res.ok;
}

function endTurn() {
  selectedUnitId = null;
  if (!apply({ type: 'endTurn', playerId: state.activePlayer })) return;
  // no AI yet: auto-pass non-human players
  let guard = 10;
  while (!state.players[state.activePlayer].human && guard-- > 0) {
    apply({ type: 'endTurn', playerId: state.activePlayer });
  }
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

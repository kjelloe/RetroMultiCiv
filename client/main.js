// Game shell (step 0): load the mock state, render it, wire picking + HUD.
// No engine yet — the view IS the raw state. Once engine/ exists, this file
// sends commands and applies fog-filtered views instead.
import { createRenderer } from './renderer/renderer.js';

const hudTile = document.getElementById('hud-tile');
const hudSelection = document.getElementById('hud-selection');

const state = await fetch('./mock-state.json').then(r => {
  if (!r.ok) throw new Error(`mock-state.json: HTTP ${r.status}`);
  return r.json();
});

const view = state; // step 0: omniscient view, no fog filtering yet
const renderer = createRenderer(document.getElementById('app'));
renderer.setViewState(view);
renderer.centerOn(view.map.width / 2 - 6, view.map.height / 2);

let selectedUnitId = null;

function describeTile(x, y) {
  const tile = view.map.tiles[y * view.map.width + x];
  const river = tile.river ? ' +river' : '';
  return `(${x},${y}) ${tile.t}${river}`;
}

renderer.onHover(pick => {
  hudTile.textContent = pick ? describeTile(pick.tile.x, pick.tile.y) : 'hover a tile…';
});

renderer.onPick(pick => {
  if (pick.unitId) {
    selectedUnitId = pick.unitId;
    const u = view.units[pick.unitId];
    const owner = view.players[u.owner];
    hudSelection.textContent = `selected: ${u.type} (${owner.name}) at (${u.x},${u.y})`;
    renderer.setSelection({ unitId: pick.unitId });
  } else {
    selectedUnitId = null;
    hudSelection.textContent = `tile: ${describeTile(pick.tile.x, pick.tile.y)}`;
    renderer.setSelection({ tile: pick.tile });
  }
});

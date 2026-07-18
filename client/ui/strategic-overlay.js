// Live strategic overlay (user YES 2026-07-18): the v1.5 per-AI
// stance/mode/threat snapshot rendered DURING play — a debug/analysis window
// into what each AI is doing. GATED to ?debug=1 games + spectators only (it
// reveals AI internals, so it must never reach a fair-play human seat). Reads
// the SAME shared/strategic.js computation the soak --stats path uses (never
// duplicated); that needs full state, which is exactly what a ?debug=1 local
// game or a spectator's omniscient view carries. Pure render — no commands,
// golden-neutral.
import { strategicSnapshot } from '../../shared/strategic.js';
import { displayColor } from './palette.js';

// A45: capture at module eval — main.js canonicalizes the URL after boot
const DEBUG_PARAM = new URLSearchParams(location.search).get('debug') === '1';

const MODE_ICON = { warring: '⚔', expanding: '🌱', building: '🏛', defending: '🛡' };
const THREAT_COLOR = { none: '#5aa86b', low: '#c9b458', med: '#d08a3b', high: '#c65a4a' };

export function initStrategicOverlay(ctx) {
  const { session } = ctx;
  // fairness gate: only where AI internals are already fair to show
  if (!(DEBUG_PARAM || ctx.SPECTATOR)) return null;

  const box = document.createElement('div');
  box.id = 'strat-overlay';
  box.className = 'hidden';
  box.innerHTML = '<div id="strat-head">🧠 AI strategy <button id="strat-close" title="close">✕</button></div><div id="strat-rows"></div>';
  document.body.appendChild(box);

  const btn = document.createElement('button');
  btn.id = 'open-strat'; btn.title = 'live AI strategy (debug/spectator)'; btn.textContent = '🧠';
  const corner = document.getElementById('corner-buttons');
  if (corner) corner.appendChild(btn);
  btn.addEventListener('click', () => { box.classList.toggle('hidden'); render(); });
  box.querySelector('#strat-close').addEventListener('click', () => box.classList.add('hidden'));

  const rowsEl = box.querySelector('#strat-rows');
  function render() {
    if (box.classList.contains('hidden')) return;
    const state = session.state;
    const order = state.playerOrder || Object.keys(state.players);
    const rows = [];
    for (const pid of order) {
      const p = state.players[pid];
      if (!p || p.human === true || p.alive === false) continue; // AIs only
      let snap;
      try { snap = strategicSnapshot(state, pid, session.ruleset); }
      catch (e) { continue; } // a fogged/partial view for this civ: skip it
      const u = snap.units;
      rows.push(
        `<div class="strat-row">`
        + `<span class="strat-name" style="color:${displayColor(p.color)}">${esc(p.name)}</span>`
        + `<span class="strat-tag">${esc(snap.stance)}</span>`
        + `<span class="strat-mode">${MODE_ICON[snap.mode] || ''} ${snap.mode}</span>`
        + `<span class="strat-threat" style="color:${THREAT_COLOR[snap.threat] || '#9fb3d0'}">threat: ${snap.threat}</span>`
        + `<span class="strat-units" title="military / settlers / scouts / naval">⚔${u.mil} 🌱${u.settlers} 👁${u.scouts} ⚓${u.naval}</span>`
        + `</div>`);
    }
    rowsEl.innerHTML = rows.length
      ? rows.join('')
      : '<div class="strat-row strat-empty">no AI civilizations in play</div>';
  }

  session.onChange(render);
  return { render };
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

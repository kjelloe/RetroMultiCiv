// A45 Map overlays panel: Civ4-style toggleable data layers over EXPLORED
import { displayColor } from './palette.js';
// tiles only — pure view layer. Overlay choice is per-viewer UI state
// (options store), NEVER game state, never in recordings. Derivations run
// on the FOG-FILTERED view (filterView), so unknown tiles can never tint
// even when local state is omniscient: fog is the law. ctx.HUMAN is read
// LIVE on every recompute — hotseat hands the viewpoint over mid-session.
import { filterView } from '../../engine/visibility.js';
import { FAT_CROSS } from '../../engine/cities.js';

// Captured at MODULE EVAL — main.js canonicalizes the URL after boot
// (history.replaceState drops unknown params), so a live location.search
// read would never see ?overlay/?overlaydiag. Imports evaluate first.
const PARAMS = new URLSearchParams(location.search);

// The registry: later Civ4-style layers (resources, yields, culture) are
// one entry each — {id, label, computeTiles(view, viewpoint) -> entries}.
// Entries: [{idx, color, alpha}]; active overlays stack (alpha blend, the
// renderer lifts each layer a hair so blending never z-fights).
const OVERLAYS = [
  {
    // A52 (ally round 5): "City influence", NOT "Territory" — this is a
    // working-area derivation (city fat crosses), not a legal border/
    // ownership model; "Borders" stays reserved for a future ownership
    // system. The registry id stays 'territory'; only the label is the fix.
    id: 'territory', label: '🏛 City influence',
    // Which empire an area belongs to: every explored tile in a city's
    // 21-tile fat cross tints in the owner's seat color; ties go to the
    // nearest city (Chebyshev), then the lowest city id — deterministic
    // for VISUAL stability (render-only, no hashes involved). Unclaimed
    // explored land stays untinted.
    computeTiles(view) {
      const { width, height, wrapX } = view.map;
      const best = {};
      for (const cid of Object.keys(view.cities).sort()) {
        const c = view.cities[cid];
        const color = displayColor(view.players[c.owner] ? view.players[c.owner].color : '#ffffff'); // palette pass
        for (const off of [{ dx: 0, dy: 0 }].concat(FAT_CROSS)) {
          let nx = c.x + off.dx;
          if (wrapX) nx = ((nx % width) + width) % width;
          const ny = c.y + off.dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const idx = ny * width + nx;
          if (view.map.tiles[idx].t === 'unknown') continue; // fog is the law
          const d = Math.max(Math.abs(off.dx), Math.abs(off.dy));
          const cur = best[idx];
          if (!cur || d < cur.d || (d === cur.d && cid < cur.cityId)) {
            best[idx] = { d, cityId: cid, color };
          }
        }
      }
      return Object.keys(best).map(idx => ({ idx: Number(idx), color: best[idx].color, alpha: 0.22 }));
    }
  },
  {
    id: 'units', label: '⚔ Units',
    // Tiles holding VISIBLE units: green = the current viewpoint's own,
    // red = anyone else's (stacks are single-owner by the engine's rules,
    // so per-tile occupant owner is exact).
    computeTiles(view, viewpoint) {
      const seen = {};
      for (const u of Object.values(view.units || {})) {
        seen[u.y * view.map.width + u.x] = u.owner === viewpoint ? '#3fae6a' : '#d84a3b';
      }
      return Object.keys(seen).map(idx => ({ idx: Number(idx), color: seen[idx], alpha: 0.3 }));
    }
  }
];

export function initOverlays(ctx) {
  const { session, renderer } = ctx;
  const stored = (ctx.options && ctx.options.get('overlays')) || {};
  const active = Object.assign({}, stored.active || {});
  // ?overlay=territory,units — screenshot/e2e hook
  const param = PARAMS.get('overlay');
  if (param) for (const id of param.split(',')) active[id] = true;

  const panel = document.createElement('details');
  panel.id = 'map-overlays';
  if (stored.open === true) panel.open = true;
  const summary = document.createElement('summary');
  summary.textContent = '🗺 Map overlays';
  panel.appendChild(summary);
  const body = document.createElement('div');
  body.id = 'map-overlay-boxes';
  for (const o of OVERLAYS) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = active[o.id] === true;
    box.addEventListener('change', () => {
      active[o.id] = box.checked;
      persist();
      recompute();
    });
    label.appendChild(box);
    label.appendChild(document.createTextNode(' ' + o.label));
    body.appendChild(label);
  }
  panel.appendChild(body);
  panel.addEventListener('toggle', persist);
  // A57: the panel lives in the left-stack flex column, between Controls and
  // the Turn log (expansion pushes neighbors; ui/left-stack.js adds the
  // one-open rule). Body fallback keeps stack-less harnesses working.
  const stack = document.getElementById('left-stack');
  if (stack) stack.insertBefore(panel, document.getElementById('turn-log'));
  else document.body.appendChild(panel);

  function persist() {
    if (ctx.options) ctx.options.set('overlays', { open: panel.open, active });
  }

  function recompute() {
    if (!renderer.setOverlays) return;
    const ids = OVERLAYS.filter(o => active[o.id] === true);
    if (ids.length === 0) { renderer.setOverlays(null); return; }
    const view = filterView(session.state, ctx.HUMAN); // live viewpoint
    const entries = [];
    ids.forEach((o, i) => {
      for (const e of o.computeTiles(view, ctx.HUMAN)) {
        entries.push(Object.assign({ lift: i * 0.006 }, e));
      }
    });
    renderer.setOverlays(entries);
  }

  session.onChange(recompute);
  recompute();

  // ?overlaydiag=1 — the browser case's probe: overlay quad count + the
  // left-stack anchor order (Turn log must hold the lower-left corner)
  if (PARAMS.get('overlaydiag') === '1') {
    setTimeout(() => {
      let diagErr = '';
      try { recompute(); } catch (e) { diagErr = ` err:${e.message}`; }
      const probe = document.createElement('div');
      probe.id = 'overlay-probe';
      probe.style.display = 'none';
      const rect = id => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().bottom : -1;
      };
      probe.textContent = `overlaydiag count:${renderer.overlayCount ? renderer.overlayCount() : -1}`
        + ` order:${rect('turn-log') > rect('map-overlays') && rect('map-overlays') > rect('help') ? 'ok' : 'BAD'}`
        + ` turnlog:${Math.round(rect('turn-log'))} overlays:${Math.round(rect('map-overlays'))} help:${Math.round(rect('help'))}${diagErr}`;
      document.body.appendChild(probe);
    }, 300);
  }

  return { recompute };
}

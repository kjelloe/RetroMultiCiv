// XIV §41: the military overview — every own unit on one row (type, attack /
// defense / moves, its upkeep home city, and where it is with a 🔍 zoom-to);
// clicking a row selects the unit and pans to it. Companion to the §34 city
// overview — both built on the shared overview-panel component. Client-only +
// golden-neutral (reads session.state + the ruleset stat tables).
import { makeOverviewPanel } from './overview-panel.js';

export function initMilitaryOverview(ctx) {
  const { session } = ctx;

  function build() {
    const state = session.state;
    const me = ctx.HUMAN;
    const units = session.ruleset.units;

    const ownCityIds = Object.keys(state.cities).filter(cid => state.cities[cid].owner === me);
    function cityAt(x, y) {
      for (const cid of Object.keys(state.cities)) {
        const c = state.cities[cid];
        if (c.x === x && c.y === y) return c;
      }
      return null;
    }
    function nearestOwn(x, y) {
      let best = null, bestD = Infinity;
      for (const cid of ownCityIds) {
        const c = state.cities[cid];
        const d = Math.abs(c.x - x) + Math.abs(c.y - y);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    }

    const rows = Object.keys(state.units)
      .filter(uid => state.units[uid].owner === me)
      .map(uid => {
        const u = state.units[uid];
        const def = units[u.type] || {};
        const here = cityAt(u.x, u.y);
        const near = here ? null : nearestOwn(u.x, u.y);
        const where = here ? esc(here.name) : (near ? 'near ' + esc(near.name) : 'the field');
        const home = u.home !== undefined && state.cities[u.home] ? esc(state.cities[u.home].name) : 'unsupported';
        return {
          title: 'select ' + (def.name || u.type),
          onClick: () => {
            if (ctx.renderer && ctx.renderer.centerOn) ctx.renderer.centerOn(u.x, u.y);
            if (ctx.selectUnit) ctx.selectUnit(u);
          },
          cells: [
            `<span class="mo-name">${esc(def.name || u.type)}</span>` + (u.veteran === true ? ' <span class="mo-vet" title="veteran">★</span>' : ''),
            `<span class="ys">${def.attack === undefined ? '—' : def.attack}</span>/<span class="yf">${def.defense === undefined ? '—' : def.defense}</span>/${def.moves === undefined ? '—' : def.moves}`,
            home,
            `${where} <span class="mo-loc">(${u.x},${u.y})</span> <span class="mo-zoom" title="zoom to (${u.x},${u.y})">🔍</span>`
          ]
        };
      });

    return {
      empty: 'You have no units.',
      headers: [
        { label: 'Unit' }, { label: 'A/D/M', title: 'attack / defense / moves' },
        { label: 'Upkeep', title: 'the home city that supports this unit' },
        { label: 'Location', title: 'where the unit is — 🔍 pans the camera there' }
      ],
      rows
    };
  }

  return makeOverviewPanel(ctx, {
    icon: '⚔', title: 'Military',
    buttonId: 'open-military-overview', buttonTitle: 'military overview — all your units',
    panelId: 'military-overview-panel', tableId: 'military-overview-table', rowClass: 'mo-row',
    anchorId: 'open-city-overview', build // sits LEFT of the 🏙 city button
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

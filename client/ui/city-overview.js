// XIV §34: the city overview — a center panel listing every own city with its
// key numbers on one row; clicking a row opens that city view. Fog-honest by
// construction (own cities only). Client-only + golden-neutral: reads
// session.state and the SAME engine yield/economy helpers the city view uses
// (cityYields / cityMood / cityEconOutput), never duplicating the math.
import { cityYields, itemCost } from '../../engine/cities.js';
import { cityMood } from '../../engine/happiness.js';
import { cityEconOutput } from '../../engine/tech.js';

export function initCityOverview(ctx) {
  const { session } = ctx;

  // the 🏙 button, directly LEFT of the research bar
  const btn = document.createElement('button');
  btn.id = 'open-city-overview';
  btn.title = 'city overview — all your cities';
  btn.textContent = '🏙';
  const bar = document.getElementById('research-bar');
  if (bar && bar.parentNode) bar.parentNode.insertBefore(btn, bar);

  const panel = document.createElement('div');
  panel.id = 'city-overview-panel';
  panel.className = 'panel hidden';
  panel.innerHTML = `
    <div class="panel-head"><h3>🏙 Cities</h3><button class="panel-close" data-close="city-overview-panel">✕</button></div>
    <div id="city-overview-body"></div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('#city-overview-body');
  panel.querySelector('.panel-close').addEventListener('click', close);

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

  function render() {
    const state = session.state;
    const me = ctx.HUMAN;
    const ruleset = session.ruleset;
    const rules = ruleset.rules;
    const p = state.players[me];
    const taxRate = p && p.taxRate !== undefined ? p.taxRate : rules.defaultTaxRate;
    const sciRate = p && p.sciRate !== undefined ? p.sciRate : rules.defaultSciRate;
    const perSpec = rules.specialistOutput;
    const producing = c => {
      const pd = c.producing;
      if (!pd) return { name: '—', cost: 0 };
      const table = pd.kind === 'unit' ? ruleset.units : pd.kind === 'building' ? ruleset.buildings
        : pd.kind === 'wonder' ? ruleset.wonders : null;
      const def = table && table[pd.id];
      return { name: def ? def.name : pd.id, cost: def ? itemCost(pd.kind, pd.id, def, p, ruleset) : 0 };
    };

    const ids = (state.cityOrder || Object.keys(state.cities)).filter(cid => {
      const c = state.cities[cid]; return c && c.owner === me;
    });
    if (ids.length === 0) {
      body.innerHTML = '<div class="co-empty">You have no cities yet — found one with a settler (B).</div>';
      return;
    }
    const rows = ids.map(cid => {
      const c = state.cities[cid];
      const y = cityYields(state, c, ruleset);
      const mood = cityMood(state, c, ruleset);
      const eco = cityEconOutput(state, c, taxRate, sciRate, perSpec, ruleset);
      const b = producing(c);
      const qlen = ctx.buildQueue ? ctx.buildQueue.get(cid).length : 0;
      const disorder = c.disorder === true ? ' <span class="loss" title="civil disorder">⚠</span>' : '';
      return `<tr class="co-row" data-cid="${esc(cid)}" title="open ${esc(c.name)}">`
        + `<td class="co-name">${esc(c.name)}${disorder}</td>`
        + `<td>${c.pop}</td>`
        + `<td class="co-yft"><span class="yf">🌾${y.food}</span> <span class="ys">⚒${y.shields}</span> <span class="yt">➡${y.trade}</span></td>`
        + `<td>💰${eco.gold} 🔬${eco.bulbs}</td>`
        + `<td>🎭${mood.entertainers} 💰${mood.taxmen} 🔬${mood.scientists}</td>`
        + `<td class="co-build">${esc(b.name)} <span class="co-prog">${c.shields}/${b.cost}</span>`
        + (qlen ? ` <span class="co-q" title="${qlen} queued">+${qlen}</span>` : '') + '</td>'
        + '</tr>';
    }).join('');
    body.innerHTML = '<table id="city-overview-table"><thead><tr>'
      + '<th>City</th><th>Pop</th><th title="food / shields / trade">🌾⚒➡</th>'
      + '<th title="gold / research this city contributes">Tax·Sci</th>'
      + '<th title="entertainers / tax collectors / scientists">🎭💰🔬</th>'
      + '<th>Building</th></tr></thead><tbody>' + rows + '</tbody></table>';
    body.querySelectorAll('.co-row').forEach(r => r.addEventListener('click', () => {
      close();
      if (ctx.panels && ctx.panels.openCityPanel) ctx.panels.openCityPanel(r.dataset.cid);
    }));
  }

  function open() { render(); panel.classList.remove('hidden'); }
  function close() { panel.classList.add('hidden'); }
  function toggle() { panel.classList.contains('hidden') ? open() : close(); }
  btn.addEventListener('click', toggle);

  // stay live while open (yields/build change as turns pass); read ctx.HUMAN
  // per render so hotseat viewpoint handoff is honored.
  if (session.onChange) session.onChange(() => { if (!panel.classList.contains('hidden')) render(); });

  return { open, close, toggle };
}

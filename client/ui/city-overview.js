// XIV §34: the city overview — every own city on one row (yields, tax/sci,
// specialists, current build); clicking a row opens that city. Fog-honest by
// construction (own cities only). Client-only + golden-neutral: reads
// session.state and the SAME engine yield/economy helpers the city view uses
// (cityYields / cityMood / cityEconOutput), never duplicating the math. Built on
// the shared overview-panel component (§41 military overview shares it).
import { cityYields, itemCost } from '../../engine/cities.js';
import { cityMood } from '../../engine/happiness.js';
import { cityEconOutput } from '../../engine/tech.js';
import { capitalOf } from '../../engine/government.js';
import { makeOverviewPanel } from './overview-panel.js';

export function initCityOverview(ctx) {
  const { session } = ctx;

  function build() {
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

    const capital = capitalOf(state, me, ruleset); // XIV §44: ★ the capital row
    const ids = (state.cityOrder || Object.keys(state.cities)).filter(cid => {
      const c = state.cities[cid]; return c && c.owner === me;
    });
    const rows = ids.map(cid => {
      const c = state.cities[cid];
      const y = cityYields(state, c, ruleset);
      const mood = cityMood(state, c, ruleset);
      const eco = cityEconOutput(state, c, taxRate, sciRate, perSpec, ruleset);
      const b = producing(c);
      const qlen = ctx.buildQueue ? ctx.buildQueue.get(cid).length : 0;
      const disorder = c.disorder === true ? ' <span class="loss" title="civil disorder">⚠</span>' : '';
      return {
        title: 'open ' + c.name,
        onClick: () => { if (ctx.panels && ctx.panels.openCityPanel) ctx.panels.openCityPanel(cid); },
        cells: [
          `<span class="co-name">${capital && capital.id === cid ? '★ ' : ''}${esc(c.name)}</span>${disorder}`,
          String(c.pop),
          `<span class="co-yft"><span class="yf">🌾${y.food}</span> <span class="ys">⚒${y.shields}</span> <span class="yt">➡${y.trade}</span></span>`,
          `💰${eco.gold} 🔬${eco.bulbs}`,
          `🎭${mood.entertainers} 💰${mood.taxmen} 🔬${mood.scientists}`,
          `${esc(b.name)} <span class="co-prog">${c.shields}/${b.cost}</span>` + (qlen ? ` <span class="co-q" title="${qlen} queued">+${qlen}</span>` : '')
        ]
      };
    });
    return {
      empty: 'You have no cities yet — found one with a settler (B).',
      headers: [
        { label: 'City' }, { label: 'Pop' }, { label: '🌾⚒➡', title: 'food / shields / trade' },
        { label: 'Tax·Sci', title: 'gold / research this city contributes' },
        { label: '🎭💰🔬', title: 'entertainers / tax collectors / scientists' }, { label: 'Building' }
      ],
      rows
    };
  }

  return makeOverviewPanel(ctx, {
    icon: '🏙', title: 'Cities',
    buttonId: 'open-city-overview', buttonTitle: 'city overview — all your cities',
    panelId: 'city-overview-panel', tableId: 'city-overview-table', rowClass: 'co-row',
    anchorId: 'research-bar', build
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

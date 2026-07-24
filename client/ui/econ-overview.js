// XIV §49: the economic overview — click 💰 to see WHY your gold/turn is what it
// is: every income source (per-city taxes, post-corruption, incl. routes +
// building/wonder bonuses) and every sink (building maintenance, itemized) summing
// EXACTLY to the top-bar (+N). Third overview-family panel — built on the shared
// overview-panel component (§34/§41). Client-only + golden-neutral: reads
// session.state + the SAME engine helpers the HUD's (+N) uses (playerIncome /
// cityEconOutput), so the total can never drift from the top bar.
//
// NOTE (Civ1-shape engine): UNIT upkeep is SHIELDS and SETTLER upkeep is FOOD —
// neither is a gold sink — so they are correctly absent here; only gold flows
// (taxes − building maintenance) appear, which is exactly what (+N) counts.
import { playerIncome, cityEconOutput } from '../../engine/tech.js';
import { governmentOf, corruptionFor } from '../../engine/government.js';
import { cityYields } from '../../engine/cities.js';
import { makeOverviewPanel } from './overview-panel.js';
import { cityUpkeep } from './upkeep.js';

export function initEconOverview(ctx) {
  const { session } = ctx;

  function build() {
    const state = session.state;
    const me = ctx.HUMAN;
    const ruleset = session.ruleset;
    const rules = ruleset.rules;
    const p = state.players[me];
    if (!p) return { empty: 'no economy yet', rows: [] };
    const taxRate = p.taxRate !== undefined ? p.taxRate : rules.defaultTaxRate;
    const sciRate = p.sciRate !== undefined ? p.sciRate : rules.defaultSciRate;
    const perSpec = rules.specialistOutput;
    const anarchy = governmentOf(state, me, ruleset).id === 'anarchy';

    const rows = [];
    const own = (state.cityOrder || Object.keys(state.cities)).filter(cid => {
      const c = state.cities[cid]; return c && c.owner === me;
    });

    // INCOME — per-city taxes after corruption (0 under anarchy / in disorder,
    // exactly as playerIncome counts them)
    for (const cid of own) {
      const c = state.cities[cid];
      const gold = anarchy ? 0 : cityEconOutput(state, c, taxRate, sciRate, perSpec, ruleset).gold;
      if (gold > 0) rows.push({ cells: [
        `<span class="eco-in">🏛 ${esc(c.name)}${c.disorder === true ? ' <span class="loss">⚠</span>' : ''} — taxes</span>`,
        `<span class="yf">+${gold}</span>`
      ] });
    }
    if (anarchy) rows.push({ cells: ['<span class="eco-note">⚡ Anarchy — the state collects no taxes</span>', ''] });
    // XVII #20: treaty income — note what the D-line provides TODAY (nothing yet)
    rows.push({ cells: ['<span class="eco-note">🤝 Treaty income — none (no per-turn treaties yet)</span>', ''] });

    // XVII #20: corruption — informational (trade lost, already reflected in the
    // post-corruption taxes above; it reduces BOTH gold and research)
    let corruptTrade = 0;
    if (!anarchy) for (const cid of own) {
      const c = state.cities[cid];
      if (c.disorder === true) continue;
      corruptTrade += corruptionFor(state, c, cityYields(state, c, ruleset).trade, ruleset);
    }
    if (corruptTrade > 0) rows.push({ cells: [
      '<span class="eco-note">↳ corruption skimmed (trade — already deducted above)</span>',
      `<span class="loss">−${corruptTrade}➡</span>`
    ] });

    // SINKS — building maintenance, itemized per city (always counted)
    for (const cid of own) {
      const c = state.cities[cid];
      for (const b of c.buildings || []) {
        const m = (ruleset.buildings[b] || {}).maintenance || 0;
        if (m > 0) rows.push({ cells: [
          `<span class="eco-out">${esc(c.name)} · ${esc(ruleset.buildings[b].name)}</span>`,
          `<span class="loss">−${m}</span>`
        ] });
      }
    }

    // TOTAL — the authoritative (+N) straight from playerIncome (== the top bar)
    const inc = playerIncome(state, me, ruleset);
    const net = inc.gold - inc.maintenance;
    rows.push({ cells: [
      `<b class="eco-total">NET GOLD per turn (treasury ${p.gold}💰)</b>`,
      `<b class="${net < 0 ? 'loss' : 'yf'}">${net >= 0 ? '+' : ''}${net}</b>`
    ] });

    // XVII #20: non-gold upkeep — complete the statement WITHOUT touching the gold
    // NET above. Civ1 unit upkeep is SHIELDS, settler upkeep is FOOD.
    let upShields = 0, upFood = 0;
    for (const cid of own) {
      const u = cityUpkeep(state, cid, ruleset);
      upShields += u.shields; upFood += u.food;
    }
    if (upShields > 0 || upFood > 0) {
      rows.push({ cells: ['<span class="eco-note">— non-gold upkeep (paid in production, not gold) —</span>', ''] });
      if (upShields > 0) rows.push({ cells: ['<span class="eco-out">⚒ Military unit upkeep</span>', `<span class="loss">−${upShields}⚒</span>`] });
      if (upFood > 0) rows.push({ cells: ['<span class="eco-out">🌾 Settler food upkeep</span>', `<span class="loss">−${upFood}🌾</span>`] });
    }

    return {
      empty: 'You have no cities — no economy yet.',
      headers: [{ label: 'Source / Sink' }, { label: 'Per turn', title: 'the gold NET sums exactly to the top-bar (+N); non-gold upkeep is listed below it' }],
      rows
    };
  }

  return makeOverviewPanel(ctx, {
    icon: '💰', title: 'Economy',
    buttonId: 'open-econ-overview', buttonTitle: 'economic overview — why your gold/turn is what it is',
    panelId: 'econ-overview-panel', tableId: 'econ-overview-table', rowClass: 'eco-row',
    anchorId: 'open-military-overview', build // sits LEFT of the ⚔ military button
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

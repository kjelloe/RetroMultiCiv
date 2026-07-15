// A75: the historian's report — a dismissable interstitial shown when the world
// advances into a new age (an `ageChanged` event from the engine's turn wrap).
// "The world enters the Industrial Age" + a global standings snapshot AT THAT
// MOMENT: every civ ranked by score, with cities / techs / population. Scores
// are world-public (like the score line), so this is fog-safe. Also logged in
// the turn log; the replay theater re-surfaces it because the event rides the
// recording. Reuses the engine's own score arithmetic — never a parallel one.
import { score } from '../../engine/score.js';

export function initHistorian(ctx) {
  const { session } = ctx;
  const ruleset = session.ruleset;

  function ageName(id) {
    const a = (ruleset.rules.ages || []).find(x => x.id === id);
    return a ? a.name : id;
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function escColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8899aa'; }

  // world-public standings from the engine's components (score.js) + plain reads
  function standings(state) {
    const rows = [];
    for (const pid of state.playerOrder) {
      const p = state.players[pid];
      let cities = 0, pop = 0;
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        if (c && c.owner === pid) { cities += 1; pop += c.pop; }
      }
      rows.push({
        name: p.name, color: p.color, alive: p.alive !== false,
        score: score(state, pid, ruleset), cities, techs: p.techs.length, pop
      });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows;
  }

  let open = null;
  function show(state, age) {
    if (open) open.remove();
    const rows = standings(state);
    const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
    const panel = document.createElement('div');
    panel.id = 'historian';
    let body = '';
    rows.forEach((r, i) => {
      body += `<tr class="${r.alive ? '' : 'dead'}">`
        + `<td class="rank">${i + 1}</td>`
        + `<td class="civ"><span class="swatch" style="background:${escColor(r.color)}"></span>${esc(r.name)}${r.alive ? '' : ' †'}</td>`
        + `<td>${r.score}</td><td>${r.cities}</td><td>${r.techs}</td><td>${r.pop}</td></tr>`;
    });
    panel.innerHTML = `<div id="historian-card">
      <div id="historian-head">🌍 The world enters the ${esc(ageName(age))} Age</div>
      <div id="historian-sub">${year} — a report on the state of the world</div>
      <table id="historian-table">
        <thead><tr><th>#</th><th>Civilization</th><th>Score</th><th>Cities</th><th>Techs</th><th>Pop</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <button id="historian-close">Continue ▶</button>
    </div>`;
    document.body.appendChild(panel);

    function close() {
      panel.remove();
      if (open === panel) open = null;
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); }
    }
    panel.querySelector('#historian-close').addEventListener('click', close);
    panel.addEventListener('click', e => { if (e.target === panel) close(); }); // click the backdrop
    document.addEventListener('keydown', onKey);
    open = panel;
  }

  session.onChange((state, events) => {
    for (const e of events) {
      if (e.type === 'ageChanged') { show(state, e.age); break; } // one report per batch
    }
  });

  return { show }; // exposed for e2e/screenshot hooks
}

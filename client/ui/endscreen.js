// A73: the end-game scoreboard — a full-screen END SCREEN on gameOver that says
import { displayColor } from './palette.js';
// who won, WHY, and by how much. The headline names the victory REASON in plain
// words (from the gameOver event's `victory` field). The standings table ranks
// every civ by final SCORE with its COMPONENT breakdown (population / techs /
// wonders — from the engine's scoreBreakdown, never a parallel formula) as a
// stacked bar, plus city/tech/wonder counts; dead civs are grayed with the turn
// they fell. Scores are world-public at gameOver, so spectators and every LAN
// seat see the same board. Golden-safe: render + the pre-existing event payload.
import { scoreBreakdown } from '../../engine/score.js';
import { techSafeState, techFogged } from './score-view.js';

export function initEndScreen(ctx) {
  const { session } = ctx;
  const ruleset = session.ruleset;
  const deathTurn = {}; // pid -> turn it fell (client ledger from playerDefeated; never state)
  let shownFor = null;  // the winner we've already shown, so we open exactly once

  function ageYear(state) { return state.year < 0 ? `${-state.year} BC` : `${state.year} AD`; }
  function esc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function escColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c) ? displayColor(c) : '#8899aa'; } // palette pass

  function aliveCount(state) {
    let n = 0;
    for (const pid of state.playerOrder) if (state.players[pid].alive !== false) n += 1;
    return n;
  }

  // conquest when the event says so (or, for a game loaded already-over, when a
  // single civ remains); otherwise the end year settled it on score.
  function victoryOf(state, fromEvent) {
    if (fromEvent) return fromEvent;
    return aliveCount(state) <= 1 ? 'conquest' : 'score';
  }

  function headline(state, victory) {
    const w = state.players[state.winner];
    const wname = w ? w.name : state.winner;
    if (victory === 'conquest') {
      return `Conquest — the ${wname} stand alone; every rival has fallen.`;
    }
    if (victory === 'space') { // H8/A76: first planetfall ends the game
      return `Space victory — the ${wname} have reached Alpha Centauri, and a new world is theirs.`;
    }
    return `Score victory — the year ${ageYear(state)} arrived, and the ${wname} had built the greatest civilization.`;
  }

  function rows(state) {
    const out = [];
    const sstate = techSafeState(state); // fog-filtered server views lack rival techs
    for (const pid of state.playerOrder) {
      const p = state.players[pid];
      const bd = scoreBreakdown(sstate, pid, ruleset);
      const fogged = techFogged(p); // a rival under server fog: tech count unknown
      let cities = 0, pop = 0, wonders = 0;
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        if (c && c.owner === pid) { cities += 1; pop += c.pop; }
      }
      if (state.wonders) {
        for (const wid of Object.keys(state.wonders)) {
          const h = state.cities[state.wonders[wid]];
          if (h && h.owner === pid) wonders += 1;
        }
      }
      out.push({
        pid, name: p.name, color: p.color, alive: p.alive !== false,
        total: bd.total, popPts: bd.population, techPts: bd.techs, wonderPts: bd.wonders,
        cities, techs: fogged ? null : p.techs.length, techFogged: fogged, wonders, death: deathTurn[pid]
      });
    }
    out.sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : 1));
    return out;
  }

  // a thin stacked bar: population / techs / wonders as shares of the top score,
  // so the reader sees the composition AND the gap ("by how much")
  function bar(r, max) {
    const pct = v => (max > 0 ? Math.round((v * 100) / max) : 0);
    return `<span class="eb-bar">`
      + `<span class="eb-pop" style="width:${pct(r.popPts)}%"></span>`
      + `<span class="eb-tech${r.techFogged ? ' fog' : ''}" style="width:${pct(r.techPts)}%"></span>`
      + `<span class="eb-won" style="width:${pct(r.wonderPts)}%"></span></span>`;
  }

  let panel = null;
  function show(state, victory) {
    if (panel) panel.remove();
    const list = rows(state);
    const max = list.length ? list[0].total : 0;
    const humanWon = state.winner === ctx.HUMAN;
    const verdict = ctx.SPECTATOR ? '🏁 THE GAME IS OVER'
      : (humanWon ? '🏆 VICTORY' : '💀 DEFEAT');

    panel = document.createElement('div');
    panel.id = 'endscreen';
    let body = '';
    list.forEach((r, i) => {
      const cls = [r.alive ? '' : 'dead', r.pid === state.winner ? 'winner' : ''].join(' ').trim();
      const fell = r.alive ? '' : ` <span class="fell">— fell turn ${r.death !== undefined ? r.death : '?'}</span>`;
      body += `<tr class="${cls}">`
        + `<td class="rank">${i + 1}</td>`
        + `<td class="civ"><span class="swatch" style="background:${escColor(r.color)}"></span>${esc(r.name)}${r.pid === state.winner ? ' 👑' : ''}${fell}</td>`
        + `<td>${r.cities}</td><td>${r.techFogged ? '<span class="fog" title="unknown under fog">—</span>' : r.techs}</td><td>${r.wonders}</td>`
        + `<td class="score">${r.total}${bar(r, max)}</td></tr>`;
    });

    panel.innerHTML = `<div id="endscreen-card">
      <div id="endscreen-verdict" class="${humanWon ? 'win' : (ctx.SPECTATOR ? 'neutral' : 'loss')}">${verdict}</div>
      <div id="endscreen-reason">${esc(headline(state, victory))}</div>
      ${state.debugUsed === true
        ? '<div id="endscreen-debug">⚠ DEBUG GAME — god-mode commands were used; this result carries the permanent mark (docs/07)</div>'
        : ''}
      <div id="endscreen-year">Turn ${state.turn} · ${ageYear(state)}</div>
      <table id="endscreen-table">
        <thead><tr><th>#</th><th>Civilization</th><th>Cities</th><th>Techs</th><th>Wonders</th><th>Score</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div id="endscreen-legend"><span class="eb-pop"></span>population <span class="eb-tech"></span>techs <span class="eb-won"></span>wonders</div>
      <div id="endscreen-buttons">
        <button id="es-replay">⏵ Watch the replay</button>
        <button id="es-stats">📊 View statistics</button>
        <button id="es-new">🌱 New game</button>
        <button id="es-load">📂 Load</button>
        <button id="es-close">✕</button>
      </div>
      <div id="endscreen-stats-note" class="hidden">📊 Detailed statistics are coming soon — the per-civ history charts land with A73-STATS.</div>
    </div>`;
    document.body.appendChild(panel);

    const close = () => { if (panel) { panel.remove(); panel = null; } };
    panel.querySelector('#es-close').addEventListener('click', close);
    panel.querySelector('#es-replay').addEventListener('click', () => { close(); if (ctx.replay) ctx.replay.open(); });
    panel.querySelector('#es-stats').addEventListener('click', async () => {
      if (ctx.stats && ctx.replay) { // A73-STATS: the full statistics page
        const rec = await ctx.replay.getRecording();
        ctx.stats.open(rec);
      } else {
        panel.querySelector('#endscreen-stats-note').classList.remove('hidden');
      }
    });
    panel.querySelector('#es-new').addEventListener('click', () => { location.href = location.pathname; }); // bare URL = setup
    panel.querySelector('#es-load').addEventListener('click', () => {
      close();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', shiftKey: true })); // reuse saves.js Shift+L
    });
    shownFor = state.winner;
  }

  // XIV §9: a persistent way BACK to the summary once it's been closed — a
  // "View game summary" button, shown post-game just above "Watch replay".
  const reopenBtn = document.createElement('button');
  reopenBtn.id = 'view-summary';
  reopenBtn.className = 'hidden';
  reopenBtn.textContent = '📊 View game summary';
  document.body.appendChild(reopenBtn);
  function reopen() {
    if (session.state.gameOver === true) show(session.state, victoryOf(session.state, null));
  }
  reopenBtn.addEventListener('click', reopen);

  session.onChange((state, events) => {
    for (const e of events || []) {
      if (e.type === 'playerDefeated') deathTurn[e.playerId] = state.turn;
    }
    reopenBtn.classList.toggle('hidden', state.gameOver !== true); // available whenever the game is over
    for (const e of events || []) {
      if (e.type === 'gameOver') { show(state, victoryOf(state, e.victory)); return; }
    }
    // a game LOADED already-over (no gameOver event replays): show it once
    if (state.gameOver === true && shownFor !== state.winner) show(state, victoryOf(state, null));
  });
  reopenBtn.classList.toggle('hidden', session.state.gameOver !== true);

  return { show, reopen }; // exposed for e2e/screenshot hooks
}

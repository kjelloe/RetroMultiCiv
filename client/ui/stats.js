// A73-STATS: the statistics page — opened from the end screen's "View
import { displayColor } from './palette.js';
// statistics". A render-free sandbox replay of the recording (stats-data.js)
// feeds per-civ TIME-SERIES line charts (score / cities / population / techs),
// a BATTLES won-lost table, a WONDERS timeline, and AGE MARKERS (A75's
// ageChanged moments) drawn as vertical lines across every chart. Pure SVG, no
// external libs. Golden-safe (reads the recording + the events it emits).
import { createEngine, deepClone } from '../../engine/index.js';
import { runAiTurn } from '../../engine/ai.js';
import { score } from '../../engine/score.js';
import { collectStatsAsync } from './stats-data.js';

export function initStats(ctx) {
  const ruleset = ctx.session.ruleset;
  const engine = createEngine(ruleset);

  function esc(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function escColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c) ? displayColor(c) : '#8899aa'; } // palette pass
  function ageName(id) {
    const a = (ruleset.rules.ages || []).find(x => x.id === id);
    return a ? a.name : id;
  }
  function wonderName(id) { return ruleset.wonders[id] ? ruleset.wonders[id].name : id; }

  // one line chart: seriesKey picks the metric off each civ's arrays; deaths
  // truncate the line; age markers are vertical guides shared across charts.
  function chart(title, data, key) {
    const W = 600, H = 150, padL = 34, padR = 10, padT = 22, padB = 18;
    const rounds = data.rounds;
    const tMax = rounds.length ? rounds[rounds.length - 1] : 1;
    const tMin = rounds.length ? rounds[0] : 0;
    let yMax = 1;
    for (const pid of data.playerOrder) for (const v of data.series[pid][key]) if (v > yMax) yMax = v;
    const x = t => padL + ((t - tMin) / (tMax - tMin || 1)) * (W - padL - padR);
    const y = v => H - padB - (v / yMax) * (H - padT - padB);

    let svg = `<svg class="stats-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<text x="${padL}" y="14" class="ct-title">${esc(title)}</text>`;
    svg += `<text x="2" y="${y(yMax) + 4}" class="ct-axis">${yMax}</text>`;
    svg += `<text x="2" y="${H - padB}" class="ct-axis">0</text>`;
    svg += `<line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" class="ct-base"/>`;
    // age markers
    for (const a of data.ages) {
      const ax = x(a.turn);
      svg += `<line x1="${ax}" y1="${padT}" x2="${ax}" y2="${H - padB}" class="ct-age"/>`;
      svg += `<text x="${ax + 2}" y="${padT + 8}" class="ct-agelabel">${esc(ageName(a.age))}</text>`;
    }
    // one polyline per civ (truncated at its death turn)
    for (const pid of data.playerOrder) {
      const s = data.series[pid];
      const pts = [];
      for (let i = 0; i < rounds.length; i++) {
        if (s.deathTurn !== undefined && rounds[i] > s.deathTurn) break;
        pts.push(`${x(rounds[i]).toFixed(1)},${y(s[key][i]).toFixed(1)}`);
      }
      if (pts.length > 0) svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${escColor(s.color)}" stroke-width="1.6"/>`;
    }
    svg += `</svg>`;
    return svg;
  }

  let panel = null;
  async function open(rec) {
    if (panel) panel.remove();
    // XIX #3: the sandbox replay behind these charts re-runs the whole AI (~55 s on a
    // long game) — a single sync block that hangs the tab. Show a placeholder with a
    // live %, then compute in ~30 ms slices so the tab stays responsive.
    panel = document.createElement('div');
    panel.id = 'stats';
    const close = () => { if (panel) { panel.remove(); panel = null; document.removeEventListener('keydown', onKey); } };
    function onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }
    panel.innerHTML = '<div id="stats-card"><div id="stats-head">📊 Game statistics <button id="stats-close">✕</button></div>'
      + '<div id="stats-computing">Assembling the chronicle… <span id="stats-progress">0%</span></div></div>';
    document.body.appendChild(panel);
    panel.querySelector('#stats-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    const mine = panel; // guard: don't clobber if closed/reopened mid-compute
    const data = await collectStatsAsync(rec, { engine, runAiTurn, deepClone, score, ruleset },
      f => { const p = mine.querySelector('#stats-progress'); if (p) p.textContent = Math.round(f * 100) + '%'; });
    if (panel !== mine) return; // closed or reopened while computing

    // legend
    let legend = '';
    for (const pid of data.playerOrder) {
      const s = data.series[pid];
      legend += `<span class="sl-item"><span class="swatch" style="background:${escColor(s.color)}"></span>${esc(s.name)}${s.deathTurn !== undefined ? ` †${s.deathTurn}` : ''}</span>`;
    }
    // battles table
    let bat = '';
    for (const pid of data.playerOrder) {
      const b = data.battles[pid];
      bat += `<tr><td class="civ"><span class="swatch" style="background:${escColor(data.series[pid].color)}"></span>${esc(data.series[pid].name)}</td><td>${b.won}</td><td>${b.lost}</td></tr>`;
    }
    // wonders timeline (chronological)
    let won = '';
    for (const w of data.wonders) {
      const s = w.pid ? data.series[w.pid] : null;
      won += `<tr><td>${w.turn}</td><td class="civ">${s ? `<span class="swatch" style="background:${escColor(s.color)}"></span>${esc(s.name)}` : '—'}</td><td>${esc(wonderName(w.wonder))}</td></tr>`;
    }
    if (!won) won = `<tr><td colspan="3" class="empty">no wonders were completed</td></tr>`;

    // fill the placeholder panel (reused — the keydown listener already lives)
    panel.innerHTML = `<div id="stats-card">
      <div id="stats-head">📊 Game statistics <button id="stats-close">✕</button></div>
      <div id="stats-legend">${legend}</div>
      ${chart('Score', data, 'score')}
      ${chart('Population', data, 'pop')}
      ${chart('Cities', data, 'cities')}
      ${chart('Techs', data, 'techs')}
      <div class="stats-cols">
        <div class="stats-col">
          <h3>Battles</h3>
          <table class="stats-table"><thead><tr><th>Civilization</th><th>Won</th><th>Lost</th></tr></thead><tbody>${bat}</tbody></table>
        </div>
        <div class="stats-col">
          <h3>Wonders</h3>
          <table class="stats-table"><thead><tr><th>Turn</th><th>Builder</th><th>Wonder</th></tr></thead><tbody>${won}</tbody></table>
        </div>
      </div>
    </div>`;
    panel.querySelector('#stats-close').addEventListener('click', close);
    panel.addEventListener('click', e => { if (e.target === panel) close(); });
  }

  return { open };
}

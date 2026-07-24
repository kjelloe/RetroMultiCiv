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

// XV §12: the winner's display label — name, else the id, else a safe generic.
// NEVER undefined (the fog-filtered ?server=1 view lacks state.winner, and a
// rival stub could lack a name). Pure + exported for the regression test.
export function winnerLabel(players, wid) {
  const w = players && players[wid];
  return (w && w.name) || wid || 'leading civilization';
}

export function initEndScreen(ctx) {
  const { session } = ctx;
  const ruleset = session.ruleset;
  const deathTurn = {}; // pid -> turn it fell (client ledger from playerDefeated; never state)
  let shownFor = null;  // the winner we've already shown, so we open exactly once
  // XV §12: the fog-filtered ?server=1 view OMITS state.winner (visibility.js
  // filterView), so state.players[undefined] was undefined → "the undefined had
  // built…". The gameOver EVENT carries the winner; fall back to it, then to a
  // safe label — NEVER print undefined.
  let eventWinner = null;
  const winnerId = state => (state && state.winner !== undefined ? state.winner : eventWinner);

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
    const wname = winnerLabel(state.players, winnerId(state));
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

  // --- #34 Founder's Record: per-ending "MOMENTS" that play BEFORE the scoreboard.
  // Client-only, golden-neutral (DOM/CSS/sound over the gameOver event). A moment is
  // a Continue-gated stage machine; its final stage reveals show(). A human who LOST
  // gets the DEFEAT moment; the win/spectate victory-perspective moments (CONQUEST /
  // SCORE / SPACE) land in later slices — until then those select NO stages, so the
  // scoreboard shows immediately (zero regression).
  function bestMetric(state, pid) {
    const bd = scoreBreakdown(techSafeState(state), pid, ruleset);
    const parts = [
      { pts: bd.wonders, word: 'the wonders they raised' },
      { pts: bd.techs, word: 'the knowledge they gathered' },
      { pts: bd.population, word: 'the people they shepherded' }
    ].filter(p => p.pts > 0).sort((a, b) => b.pts - a.pts);
    return parts.length ? parts[0].word : 'the age they lived through';
  }

  // a stylized last look at the fallen seat (procedural — no asset)
  function capitalGlyph(color) {
    return `<div class="moment-capital" style="--civ:${escColor(color)}">🏛</div>`;
  }

  function defeatStages(state) {
    const civ = state.players[ctx.HUMAN];
    const civName = (civ && civ.name) || 'your people';
    const color = (civ && civ.color) || '#8899aa';
    return [
      { cls: 'moment-fall',
        html: `<div class="moment-title">The Fall of the ${esc(civName)}</div>`
          + capitalGlyph(color)
          + '<div class="moment-sub">The banners come down over the last of your cities.</div>',
        continueLabel: 'Continue' },
      { cls: 'moment-fall moment-mourning',
        onEnter: () => document.body.classList.add('endgame-mourning'), // grayscale carries into the scoreboard
        html: '<div class="moment-title">The story continues without you.</div>'
          + `<div class="moment-log">Your people will remember you for ${esc(bestMetric(state, ctx.HUMAN))}, but the story of the world continues without you.</div>`,
        continueLabel: 'Witness the record' }
    ];
  }

  // SCORE (Retirement) — the Historian's Ending; the SCORE chronicle + the record it
  // opens carry the "Founder's Record" name (architect #2355). The score band → a
  // civ-fitting title (thresholds provisional — for the ally's iteration).
  function scoreTitle(total) {
    if (total >= 300) return 'an immortal people, their name outliving the ages';
    if (total >= 150) return 'a great and enduring civilization';
    if (total >= 60) return 'a capable and steady people';
    return 'a modest people — a quiet chapter in the world\'s long story';
  }
  function scoreStages(state) {
    const wid = winnerId(state);
    const w = state.players[wid];
    const civName = (w && w.name) || 'the leading people';
    const bd = scoreBreakdown(techSafeState(state), wid, ruleset);
    return [
      { cls: 'moment-chronicle',
        html: '<div class="moment-kicker">The Founder\'s Record</div>'
          + '<div class="moment-title">Chronicle of the World</div>'
          + '<div class="moment-book">📖</div>'
          + `<div class="moment-sub">The year ${esc(ageYear(state))} closes the age, and the historians take up their pens.</div>`,
        continueLabel: 'Read the verdict' },
      { cls: 'moment-chronicle',
        html: '<div class="moment-book">📖</div>'
          + `<div class="moment-title">Historians will remember the ${esc(civName)}</div>`
          + `<div class="moment-log">as ${esc(scoreTitle(bd.total))}.</div>`,
        continueLabel: 'Open the record' }
    ];
  }

  // CONQUEST — the "Total Map" reveal: the fog pulls back over the world we've seen
  // (render-only, fog-honest — unexplored tiles stay unknown; the server-map-at-gameOver
  // upgrade feeds a full map through the same setEndReveal path later). No "WINNER" text.
  function conquestStages(state) {
    const wid = winnerId(state);
    const w = state.players[wid];
    const civName = (w && w.name) || 'the victors';
    return [
      { cls: 'moment-peace', overlayCls: 'moment-reveal-bg', // transparent overlay: behold the map
        onEnter: () => { if (ctx.renderer && ctx.renderer.setEndReveal) ctx.renderer.setEndReveal(true); },
        html: '<div class="moment-title">The world is at peace.</div>'
          + `<div class="moment-sub">The colors of the ${esc(civName)} span the horizon.</div>`,
        continueLabel: 'Behold the world' }
    ];
  }

  // SPACE (Aspiration) — the launch → 15-year voyage → planetfall sequence. Uses the
  // spaceVictory event payload (population) + the launched ship's arrivalTurn where
  // present; graceful defaults otherwise (e.g. the ?ending preview). Largest moment.
  let spaceInfo = null; // captured spaceVictory event
  function spaceStages(state) {
    const wid = winnerId(state);
    const w = state.players[wid];
    const civName = (w && w.name) || 'the pioneers';
    const ship = w && w.spaceship;
    const pop = (spaceInfo && spaceInfo.population) || (ship && ship.population) || 0;
    // arrival year ~ 1yr/turn near the space age; default the design's 15-year skip
    const arriveYear = ship && ship.arrivalTurn ? state.year + (ship.arrivalTurn - state.turn) : state.year + 15;
    const arriveStr = arriveYear < 0 ? `${-arriveYear} BC` : `${arriveYear} AD`;
    return [
      { cls: 'moment-space',
        onEnter: () => {
          console.log('Launch in 3… 2… 1…'); // the design's console countdown
          if (ctx.sound && ctx.sound.play) ctx.sound.play('ship-launch');
        },
        html: '<div class="moment-kicker">Aspiration</div>'
          + `<div class="moment-title">The ${esc(civName)} launch for the stars.</div>`
          + '<div class="moment-ship">🚀</div>'
          + '<div class="moment-sub">Assembled in orbit, the great ship fires its engines.</div>',
        continueLabel: 'Follow the voyage' },
      { cls: 'moment-space', overlayCls: 'moment-star-bg',
        html: '<div class="moment-title">The voyage of the starship continues…</div>'
          + '<div class="moment-sub">Across the dark between the suns, a generation carries the hopes of a world.</div>',
        continueLabel: 'Arrive' },
      { cls: 'moment-space', overlayCls: 'moment-star-bg',
        html: '<div class="moment-title">Arrival at Alpha Centauri</div>'
          + `<div class="moment-log">Year: ${esc(arriveStr)}. A second home for humanity has been founded${pop > 0 ? `, ${pop} souls at its dawn` : ''}.</div>`,
        continueLabel: 'Open the record' }
    ];
  }

  // choose the moment for this ending; [] = go straight to the scoreboard
  function selectMoment(state, victory) {
    const wid = winnerId(state);
    if (wid !== undefined && !ctx.SPECTATOR && wid !== ctx.HUMAN) return defeatStages(state); // S1
    if (victory === 'conquest') return conquestStages(state); // S2
    if (victory === 'score') return scoreStages(state); // S3
    if (victory === 'space') return spaceStages(state); // S4
    return [];
  }

  let momentEl = null;
  function playMoment(state, victory, onDone) {
    if (momentEl) { momentEl.remove(); momentEl = null; }
    const stages = selectMoment(state, victory);
    shownFor = winnerId(state); // claim it now so a re-entrant onChange doesn't double-open
    if (stages.length === 0) { onDone(); return; }
    momentEl = document.createElement('div');
    momentEl.id = 'endscreen-moment';
    document.body.appendChild(momentEl);
    let i = 0;
    const advance = () => {
      i += 1;
      if (i >= stages.length) { if (momentEl) { momentEl.remove(); momentEl = null; } onDone(); return; }
      renderStage();
    };
    function renderStage() {
      const st = stages[i];
      momentEl.className = st.overlayCls || ''; // per-stage overlay treatment (e.g. transparent for the map reveal)
      momentEl.innerHTML = `<div id="moment-card" class="${st.cls || ''}">${st.html}`
        + `<button id="moment-continue">${esc(st.continueLabel || 'Continue')} ▸</button></div>`;
      if (st.onEnter) st.onEnter(momentEl, state);
      momentEl.querySelector('#moment-continue').addEventListener('click', advance);
    }
    renderStage();
  }

  // dev/screenshot hook (main.js ?ending=): preview a moment over the live state
  // without a real gameOver — sets the module-local eventWinner only (never state).
  function previewEnding(kind) {
    const state = session.state;
    let wid = ctx.HUMAN;
    if (kind === 'defeat') wid = (state.playerOrder || []).find(p => p !== ctx.HUMAN) || ctx.HUMAN;
    eventWinner = wid;
    shownFor = null;
    const victory = kind === 'defeat' ? 'conquest' : kind; // defeat rides any victory type
    playMoment(state, victory, () => show(state, victory));
  }

  let panel = null;
  function show(state, victory) {
    if (panel) panel.remove();
    const list = rows(state);
    const max = list.length ? list[0].total : 0;
    const wid = winnerId(state);
    const humanWon = wid === ctx.HUMAN;
    const verdict = ctx.SPECTATOR ? '🏁 THE GAME IS OVER'
      : (humanWon ? '🏆 VICTORY' : '💀 DEFEAT');

    panel = document.createElement('div');
    panel.id = 'endscreen';
    let body = '';
    list.forEach((r, i) => {
      const cls = [r.alive ? '' : 'dead', r.pid === wid ? 'winner' : ''].join(' ').trim();
      const fell = r.alive ? '' : ` <span class="fell">— fell turn ${r.death !== undefined ? r.death : '?'}</span>`;
      body += `<tr class="${cls}">`
        + `<td class="rank">${i + 1}</td>`
        + `<td class="civ"><span class="swatch" style="background:${escColor(r.color)}"></span>${esc(r.name)}${r.pid === wid ? ' 👑' : ''}${fell}</td>`
        + `<td>${r.cities}</td><td>${r.techFogged ? '<span class="fog" title="unknown under fog">—</span>' : r.techs}</td><td>${r.wonders}</td>`
        + `<td class="score">${r.total}${bar(r, max)}</td></tr>`;
    });

    panel.innerHTML = `<div id="endscreen-card" class="${victory === 'space' ? 'stellar' : ''}">
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

    const close = () => {
      if (panel) { panel.remove(); panel = null; }
      document.body.classList.remove('endgame-mourning'); // #34: lift the DEFEAT grayscale
      if (ctx.renderer && ctx.renderer.setEndReveal) ctx.renderer.setEndReveal(false); // #34: restore fog
    };
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
    shownFor = wid;
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
      if (e.type === 'spaceVictory') spaceInfo = e; // #34 S4: carry population into the moment
    }
    reopenBtn.classList.toggle('hidden', state.gameOver !== true); // available whenever the game is over
    for (const e of events || []) {
      // #34: the per-ending MOMENT plays first, then reveals the scoreboard
      if (e.type === 'gameOver') {
        eventWinner = e.winner;
        const v = victoryOf(state, e.victory);
        playMoment(state, v, () => show(state, v));
        return;
      }
    }
    // a game LOADED already-over (no gameOver event replays): show it once
    if (state.gameOver === true && shownFor !== state.winner) {
      const v = victoryOf(state, null);
      playMoment(state, v, () => show(state, v));
    }
  });
  reopenBtn.classList.toggle('hidden', session.state.gameOver !== true);

  return { show, reopen, playMoment, previewEnding }; // exposed for e2e/screenshot hooks
}

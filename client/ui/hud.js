// HUD: status line, research bar, tile/selection text, the center banner.
import { filterView } from '../../engine/visibility.js';
import { researchCost, playerIncome } from '../../engine/tech.js';
import { score } from '../../engine/score.js';
import { createWaitTracker, formatWait, formatSlowNote } from './wait-status.js';

export function initHud(ctx) {
  const { session, renderer, sel } = ctx;
  const hudStatus = document.getElementById('hud-status');
  const hudTile = document.getElementById('hud-tile');
  const hudSelection = document.getElementById('hud-selection');
  const researchFill = document.getElementById('research-fill');
  const researchLabel = document.getElementById('research-label');
  const techs = session.ruleset.techs;

  // Center messages are transient: gone after 5 s, dismissed early by any
  // click (left or right, anywhere), re-shown when the action repeats.
  function makeBanner(el) {
    let timer = 0;
    function show(text) {
      el.textContent = text;
      el.classList.remove('hidden');
      clearTimeout(timer);
      timer = setTimeout(hide, 5000);
    }
    function hide() {
      clearTimeout(timer);
      el.classList.add('hidden');
    }
    return { show, hide };
  }
  const centerBanner = makeBanner(document.getElementById('center-banner'));
  const flashBanner = makeBanner(document.getElementById('flash-banner'));

  // A26 (server games): a calm "who are we waiting for" line above End Turn,
  // ticking every second; crossing the Options threshold logs ONE slow-poke
  // note per player-turn. Pure timing logic lives in wait-status.js.
  const waitLine = document.createElement('div');
  waitLine.id = 'wait-line';
  waitLine.className = 'hidden';
  document.body.appendChild(waitLine);
  const waitTracker = createWaitTracker();
  function tickWait() {
    const state = session.state;
    if (session.gameId === undefined || !state || state.gameOver) { // local games: hotseat curtain covers this
      waitLine.classList.add('hidden');
      return;
    }
    const threshold = parseInt(ctx.options && ctx.options.get('slowPokeSecs'), 10) || 0;
    const w = waitTracker.update(state.activePlayer, ctx.HUMAN, Date.now(), threshold);
    if (w.waitingFor === null) {
      waitLine.classList.add('hidden');
      return;
    }
    const name = state.players[w.waitingFor] ? state.players[w.waitingFor].name : w.waitingFor;
    waitLine.textContent = formatWait(name, w.elapsedSec);
    waitLine.classList.remove('hidden');
    if (w.note && ctx.turnlog && ctx.turnlog.note) {
      ctx.turnlog.note(formatSlowNote(name, w.elapsedSec), 'log-wait');
    }
  }
  setInterval(tickWait, 1000);
  window.addEventListener('pointerdown', () => {
    centerBanner.hide();
    flashBanner.hide();
  });

  // totals with the per-turn gain/loss behind them: "12/40 (+3) · 💰 200 (+5)"
  function updateResearchBar() {
    const me = session.state.players[ctx.HUMAN];
    if (!me) { // A17 spectator: no own empire to report
      researchFill.style.width = '0%';
      researchLabel.textContent = '👁 spectating — omniscient view, no controls';
      return;
    }
    const bulbs = me.bulbs === undefined ? 0 : me.bulbs;
    const income = playerIncome(session.state, ctx.HUMAN, session.ruleset);
    const goldDelta = income.gold - income.maintenance;
    const money = `💰 ${me.gold} (${goldDelta >= 0 ? '+' : ''}${goldDelta})`;
    if (me.researching) {
      const cost = researchCost(session.state, ctx.HUMAN, session.ruleset);
      researchFill.style.width = Math.min(100, Math.floor(bulbs * 100 / cost)) + '%';
      researchLabel.textContent = `🔬 ${techs[me.researching].name} · ${bulbs}/${cost} (+${income.bulbs}) · ${money}`;
    } else {
      researchFill.style.width = '0%';
      researchLabel.textContent = `🔬 choose research · ${bulbs} bulbs (+${income.bulbs}) · ${money}`;
    }
  }

  // Shown once when the last unit finishes moving (the End Turn button turns
  // green and pulses); pressing N with nothing left re-shows it. The hint can
  // be muted (🔕 / options), and "auto end turn" skips the wait entirely.
  const endTurnBtn = document.getElementById('end-turn');
  let wasAllMoved = false;
  let autoEndedTurn = 0;
  function showNoMovesBanner() {
    centerBanner.show('no units with moves left — press E to end the turn ');
    const mute = document.createElement('button');
    mute.id = 'mute-hint';
    mute.title = 'stop showing this hint (re-enable in ⚙ Options)';
    mute.textContent = '🔕';
    // pointerdown + stopPropagation: runs before the dismiss-anywhere handler
    mute.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (ctx.options) ctx.options.set('hideNoMovesHint', true);
      centerBanner.hide();
    });
    document.getElementById('center-banner').appendChild(mute);
  }
  function updateBanner() {
    const state = session.state;
    let allMoved = false;
    if (!state.gameOver && state.activePlayer === ctx.HUMAN && state.players[ctx.HUMAN] && state.players[ctx.HUMAN].human) {
      // fortified units keep their refreshed moves but are on standing orders
      const movable = Object.values(state.units).filter(
        u => u.owner === ctx.HUMAN && u.moves > 0 && !u.working && !u.fortified);
      allMoved = movable.length === 0;
    }
    endTurnBtn.classList.toggle('ready', allMoved);
    if (allMoved && !wasAllMoved) {
      if (ctx.options && ctx.options.get('autoEndTurn') && autoEndedTurn !== state.turn) {
        autoEndedTurn = state.turn;
        setTimeout(() => { if (ctx.endTurn) ctx.endTurn(); }, 350);
      } else if (!ctx.options || !ctx.options.get('hideNoMovesHint')) {
        showNoMovesBanner();
      }
    } else if (!allMoved) {
      centerBanner.hide();
    }
    wasAllMoved = allMoved;
  }

  function refresh() {
    const state = session.state;
    renderer.setViewState(filterView(state, ctx.HUMAN));
    renderer.setSelection(sel.unitId ? { unitId: sel.unitId } : null);
    const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
    if (state.gameOver) {
      const w = state.players[state.winner];
      const verdict = state.winner === ctx.HUMAN ? '🏆 VICTORY' : '💀 DEFEAT';
      const scores = state.playerOrder
        .map(p => `${state.players[p].name} ${score(state, p, session.ruleset)}`).join(' · ');
      hudStatus.style.color = state.winner === ctx.HUMAN ? '#ffe066' : '#ff7b6b';
      const code = ctx.gameCode ? ctx.gameCode() : null; // docs/07 §3.3: verified-game stamp
      hudStatus.textContent = `${verdict} — ${w.name} wins (turn ${state.turn}) · scores: ${scores}`
        + (code ? ` · code ${code}` : '');
    } else {
      const me = state.players[ctx.HUMAN];
      const gov = !me ? '👁 spectator' // A17: no own government to show
        : me.revolutionTurns !== undefined
          ? `Anarchy (${me.revolutionTurns})`
          : session.ruleset.governments[me.government === undefined ? 'despotism' : me.government].name;
      hudStatus.textContent = `turn ${state.turn} · ${year} · ${state.players[state.activePlayer].name} · ${gov}`;
    }
    updateResearchBar();
    updateBanner();
    tickWait(); // A26: the waiting line reacts to turn changes immediately
  }

  // compact stat card for the selected unit, shown just ABOVE the action bar
  // (playtest: the actions clearly belong to this unit):
  // "Legion ★vet · ⚔3 🛡2 👟1/2 · hills (14,9) · ready · F: fortify"
  const unitLine = document.getElementById('unit-line');
  function unitNote(unit) {
    const t = session.ruleset.units[unit.type];
    const tile = session.state.map.tiles[unit.y * session.state.map.width + unit.x];
    const status = unit.working ? `building ${unit.working === 'irrigate' ? 'irrigation' : unit.working} (${unit.workLeft} turns)`
      : unit.fortified ? 'fortified' : unit.moves > 0 ? 'ready' : 'no moves left';
    const hint = unit.working ? ''
      : unit.type === 'settlers' ? ' · B: found city · I/M/R: improve'
      : unit.fortified ? '' : ' · F: fortify';
    unitLine.textContent = `${t.name}${unit.veteran ? ' ★vet' : ''}`
      + ` · ⚔${t.attack} 🛡${t.defense} 👟${unit.moves}/${t.moves}`
      + ` · ${tile.t} (${unit.x},${unit.y}) · ${status}${hint}`;
    unitLine.classList.remove('hidden');
  }
  function clearUnitLine() {
    unitLine.classList.add('hidden');
  }

  return {
    refresh,
    flash: flashBanner.show,
    banner: centerBanner.show,
    note(text) { hudSelection.textContent = text; },
    unitNote,
    clearUnitLine,
    tile(text) { hudTile.textContent = text; }
  };
}

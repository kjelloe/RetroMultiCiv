// HUD: status line, research bar, tile/selection text, the center banner.
import { filterView } from '../../engine/visibility.js';
import { researchCost, playerIncome } from '../../engine/tech.js';
import { score } from '../../engine/score.js';

export function initHud(ctx) {
  const { session, renderer, sel, HUMAN } = ctx;
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
  window.addEventListener('pointerdown', () => {
    centerBanner.hide();
    flashBanner.hide();
  });

  // totals with the per-turn gain/loss behind them: "12/40 (+3) · 💰 200 (+5)"
  function updateResearchBar() {
    const me = session.state.players[HUMAN];
    const bulbs = me.bulbs === undefined ? 0 : me.bulbs;
    const income = playerIncome(session.state, HUMAN, session.ruleset);
    const goldDelta = income.gold - income.maintenance;
    const money = `💰 ${me.gold} (${goldDelta >= 0 ? '+' : ''}${goldDelta})`;
    if (me.researching) {
      const cost = researchCost(session.state, HUMAN, session.ruleset);
      researchFill.style.width = Math.min(100, Math.floor(bulbs * 100 / cost)) + '%';
      researchLabel.textContent = `🔬 ${techs[me.researching].name} · ${bulbs}/${cost} (+${income.bulbs}) · ${money}`;
    } else {
      researchFill.style.width = '0%';
      researchLabel.textContent = `🔬 choose research · ${bulbs} bulbs (+${income.bulbs}) · ${money}`;
    }
  }

  // Shown once when the last unit finishes moving (the End Turn button turns
  // green and stays green); pressing N with nothing left re-shows it.
  const endTurnBtn = document.getElementById('end-turn');
  let wasAllMoved = false;
  function updateBanner() {
    const state = session.state;
    let allMoved = false;
    if (!state.gameOver && state.activePlayer === HUMAN && state.players[HUMAN] && state.players[HUMAN].human) {
      const movable = Object.values(state.units).filter(u => u.owner === HUMAN && u.moves > 0 && !u.working);
      allMoved = movable.length === 0;
    }
    endTurnBtn.classList.toggle('ready', allMoved);
    if (allMoved && !wasAllMoved) {
      centerBanner.show('no units with moves left — press E to end the turn');
    } else if (!allMoved) {
      centerBanner.hide();
    }
    wasAllMoved = allMoved;
  }

  function refresh() {
    const state = session.state;
    renderer.setViewState(filterView(state, HUMAN));
    renderer.setSelection(sel.unitId ? { unitId: sel.unitId } : null);
    const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
    if (state.gameOver) {
      const w = state.players[state.winner];
      const verdict = state.winner === HUMAN ? '🏆 VICTORY' : '💀 DEFEAT';
      const scores = state.playerOrder
        .map(p => `${state.players[p].name} ${score(state, p, session.ruleset)}`).join(' · ');
      hudStatus.style.color = state.winner === HUMAN ? '#ffe066' : '#ff7b6b';
      hudStatus.textContent = `${verdict} — ${w.name} wins (turn ${state.turn}) · scores: ${scores}`;
    } else {
      hudStatus.textContent = `turn ${state.turn} · ${year} · ${state.players[state.activePlayer].name}`;
    }
    updateResearchBar();
    updateBanner();
  }

  // compact stat card for the selected unit:
  // "Legion ★vet · ⚔3 🛡2 👟1/2 · hills (14,9) · ready · F: fortify"
  function unitNote(unit) {
    const t = session.ruleset.units[unit.type];
    const tile = session.state.map.tiles[unit.y * session.state.map.width + unit.x];
    const status = unit.working ? `building ${unit.working === 'irrigate' ? 'irrigation' : unit.working} (${unit.workLeft} turns)`
      : unit.fortified ? 'fortified' : unit.moves > 0 ? 'ready' : 'no moves left';
    const hint = unit.working ? ''
      : unit.type === 'settlers' ? ' · B: found city · I/M/R: improve'
      : unit.fortified ? '' : ' · F: fortify';
    hudSelection.textContent = `${t.name}${unit.veteran ? ' ★vet' : ''}`
      + ` · ⚔${t.attack} 🛡${t.defense} 👟${unit.moves}/${t.moves}`
      + ` · ${tile.t} (${unit.x},${unit.y}) · ${status}${hint}`;
  }

  return {
    refresh,
    flash: flashBanner.show,
    banner: centerBanner.show,
    note(text) { hudSelection.textContent = text; },
    unitNote,
    tile(text) { hudTile.textContent = text; }
  };
}

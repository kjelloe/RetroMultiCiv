// HUD: status line, research bar, tile/selection text, the center banner.
import { filterView } from '../../engine/visibility.js';
import { researchCost } from '../../engine/tech.js';
import { score } from '../../engine/score.js';

export function initHud(ctx) {
  const { session, renderer, sel, HUMAN } = ctx;
  const hudStatus = document.getElementById('hud-status');
  const hudTile = document.getElementById('hud-tile');
  const hudSelection = document.getElementById('hud-selection');
  const researchFill = document.getElementById('research-fill');
  const researchLabel = document.getElementById('research-label');
  const banner = document.getElementById('center-banner');
  const techs = session.ruleset.techs;

  function updateResearchBar() {
    const me = session.state.players[HUMAN];
    const bulbs = me.bulbs === undefined ? 0 : me.bulbs;
    if (me.researching) {
      const cost = researchCost(session.state, HUMAN, session.ruleset);
      researchFill.style.width = Math.min(100, Math.floor(bulbs * 100 / cost)) + '%';
      researchLabel.textContent = `🔬 ${techs[me.researching].name} · ${bulbs}/${cost} · 💰 ${me.gold}`;
    } else {
      researchFill.style.width = '0%';
      researchLabel.textContent = `🔬 choose research · ${bulbs} bulbs · 💰 ${me.gold}`;
    }
  }

  // unmissable, non-modal: shown when the human has no moves left this turn
  function updateBanner() {
    const state = session.state;
    if (!state.gameOver && state.activePlayer === HUMAN && state.players[HUMAN] && state.players[HUMAN].human) {
      const movable = Object.values(state.units).filter(u => u.owner === HUMAN && u.moves > 0);
      if (movable.length === 0) {
        banner.textContent = 'no units with moves left — press E to end the turn';
        banner.classList.remove('hidden');
        return;
      }
    }
    banner.classList.add('hidden');
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

  return {
    refresh,
    note(text) { hudSelection.textContent = text; },
    tile(text) { hudTile.textContent = text; }
  };
}

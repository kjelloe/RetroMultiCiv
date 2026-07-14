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
    if (!state || state.gameOver) {
      waitLine.classList.add('hidden');
      return;
    }
    // A30: local games show the line ONLY while an AI is moving (the
    // chunked round repaints between players); human-next stays hidden —
    // the hotseat curtain covers that hand-off. Server games: any rival.
    if (session.gameId === undefined) {
      const active = state.players[state.activePlayer];
      if (!active || active.human !== false) {
        waitLine.classList.add('hidden');
        return;
      }
    }
    const threshold = parseInt(ctx.options && ctx.options.get('slowPokeSecs'), 10) || 0;
    const w = waitTracker.update(state.activePlayer, ctx.HUMAN, Date.now(), threshold);
    if (w.waitingFor === null) {
      waitLine.classList.add('hidden');
      return;
    }
    const p = state.players[w.waitingFor];
    const name = (p ? p.name : w.waitingFor)
      + (p && p.human === false ? ' (AI)' : ''); // A30 (VI.3)
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
      // A29 (VI.1): the viewer reads as "Romans (Kjell)" — civ from the
      // player entry (local) or the joined reply (server); local seats are
      // NAMED after their civ, so skip the redundant parens there. No civ
      // at all (mock/test states) falls back to the name alone.
      let who = state.players[state.activePlayer].name; // spectators: whose turn
      if (me) {
        const civId = me.civ !== undefined ? me.civ
          : session.playerCivs ? session.playerCivs[ctx.HUMAN] : undefined;
        const civName = civId !== undefined && session.ruleset.civs
          && session.ruleset.civs[civId] ? session.ruleset.civs[civId].name : null;
        who = civName && civName !== me.name ? `${civName} (${me.name})` : civName || me.name;
      }
      hudStatus.textContent = `turn ${state.turn} · ${year} · ${who} · ${gov}`;
    }
    updateResearchBar();
    updateBanner();
    updateTurnButton(state); // A29: greyed off-turn, pulse on arrival
    tickWait(); // A26: the waiting line reacts to turn changes immediately
  }

  // A29 (VI.6): the End-Turn button reads the turn state — greyed + no-op
  // while it's not the viewer's turn (server/hotseat), and a brief yellow
  // pulse when the turn ARRIVES (skipped under ⚙ reduce animation).
  // A40 marker: the third state lands HERE — greyed "Auto Turn" while an
  // AI-regency stance plays this seat; keep the state derivation in this
  // one function so A40 only adds a branch.
  let wasMyTurn = false;
  function updateTurnButton(state) {
    const myTurn = !ctx.SPECTATOR && !state.gameOver
      && state.activePlayer === ctx.HUMAN
      && state.players[ctx.HUMAN] !== undefined && state.players[ctx.HUMAN].human === true;
    endTurnBtn.disabled = !myTurn;
    if (myTurn && !wasMyTurn
        && (!ctx.options || ctx.options.get('reduceAnimation') !== true)) {
      endTurnBtn.classList.add('pulse');
      setTimeout(() => endTurnBtn.classList.remove('pulse'), 1600);
    }
    wasMyTurn = myTurn;
  }

  // A25: the LAN your-turn banner — dismissible (✕), mutable (🔕 → the same
  // Options checkbox), with a soft two-note chime that obeys the mute. The
  // buttons use pointerdown+stopPropagation so they run before the global
  // dismiss-anywhere handler (the no-moves-hint mute pattern).
  let audioCtx = null;
  function chime() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      for (const [freq, at] of [[660, 0], [880, 0.12]]) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + at + 0.25);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + at);
        osc.stop(audioCtx.currentTime + at + 0.3);
      }
    } catch (e) { /* audio blocked pre-gesture — the banner still shows */ }
  }
  function turnBanner(text) {
    if (ctx.options && ctx.options.get('muteTurnBanner') === true) return;
    centerBanner.show(text);
    const host = document.getElementById('center-banner');
    for (const [label, title, onDown] of [
      ['✕', 'dismiss', () => centerBanner.hide()],
      ['🔕', 'mute your-turn banners (re-enable in ⚙ Options)', () => {
        if (ctx.options) ctx.options.set('muteTurnBanner', true);
        centerBanner.hide();
      }]
    ]) {
      const btn = document.createElement('button');
      btn.className = 'banner-btn';
      btn.title = title;
      btn.textContent = label;
      btn.addEventListener('pointerdown', e => { e.stopPropagation(); onDown(); });
      host.appendChild(btn);
    }
    chime();
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
    turnBanner,
    note(text) { hudSelection.textContent = text; },
    unitNote,
    clearUnitLine,
    tile(text) { hudTile.textContent = text; }
  };
}

// HUD: status line, research bar, tile/selection text, the center banner.
import { filterView } from '../../engine/visibility.js';
import { cityYields, itemCost } from '../../engine/cities.js';
import { corruptionFor, governmentOf, capitalOf } from '../../engine/government.js';
import { researchCost, playerIncome } from '../../engine/tech.js';
import { score } from '../../engine/score.js';
import { techSafeState } from './score-view.js';
import { createWaitTracker, formatWait, formatSlowNote } from './wait-status.js';
import { glyphDataURL } from './tech-glyphs.js';
import { annotateCityEra } from '../../shared/city-era.js';

export function initHud(ctx) {
  const { session, renderer, sel } = ctx;
  const hudStatus = document.getElementById('hud-status');
  const hudTile = document.getElementById('hud-tile');
  const hudSelection = document.getElementById('hud-selection');
  const researchFill = document.getElementById('research-fill');
  const researchLabel = document.getElementById('research-label');
  const techs = session.ruleset.techs;

  // the tech glyph for the current research (Part C, one system across surfaces)
  const researchGlyph = document.createElement('img');
  researchGlyph.id = 'research-glyph';
  researchGlyph.alt = '';
  researchGlyph.style.display = 'none';
  const researchBar = document.getElementById('research-bar');
  if (researchBar) researchBar.appendChild(researchGlyph);

  // Center messages are transient: gone after 5 s, dismissed early by any
  // click (left or right, anywhere), re-shown when the action repeats.
  function makeBanner(el) {
    let timer = 0;
    // XIV §35: an optional loc {x,y} adds a 🔍 zoom-to that pans to the event
    // tile (the turnlog ⌖ twin); a message without coords shows no icon.
    function show(text, loc) {
      el.textContent = text;
      if (loc && ctx.renderer && ctx.renderer.centerOn
          && Number.isInteger(loc.x) && Number.isInteger(loc.y)) {
        const zoom = document.createElement('button');
        zoom.className = 'banner-zoom';
        zoom.textContent = '🔍';
        zoom.title = `zoom to (${loc.x},${loc.y})`;
        zoom.addEventListener('click', e => { e.stopPropagation(); ctx.renderer.centerOn(loc.x, loc.y); });
        el.appendChild(zoom);
      }
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
    waitLine.textContent = formatWait(name, w.elapsedSec)
      // A54: the rare in-flight window — a queued self-scoped command shows
      // its pending tick until the round completes and flushes it
      + (session.pendingOffturn > 0 ? ` · ⏳ ${session.pendingOffturn} queued` : '');
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
    // C2: the income breakdown tooltip — per-city trade after corruption, the
    // totals straight from playerIncome (the engine's own numbers)
    const cityRows = [];
    for (const cid of session.state.cityOrder || []) {
      const c = session.state.cities[cid];
      if (!c || c.owner !== ctx.HUMAN) continue;
      if (c.disorder === true) { cityRows.push(`${c.name}: CIVIL DISORDER — collects nothing`); continue; }
      const trade = cityYields(session.state, c, session.ruleset).trade;
      const corr = corruptionFor(session.state, c, trade, session.ruleset);
      cityRows.push(`${c.name}: trade ${trade}${corr > 0 ? ` − ${corr} corruption` : ''}`);
    }
    const taxRate = me.taxRate === undefined ? session.ruleset.rules.defaultTaxRate : me.taxRate;
    const sciRate = me.sciRate === undefined ? session.ruleset.rules.defaultSciRate : me.sciRate;
    // XIV §28: surface the tax/sci/lux split + government in the top bar (was
    // tooltip-only). The bar already opens the rates panel on click (panels.js).
    const luxRate = 100 - taxRate - sciRate;
    const govName = governmentOf(session.state, ctx.HUMAN, session.ruleset).name;
    // XV §1: the top-bar rates use the research panel's icon vocabulary (💰 tax /
    // 🔬 science / 🎭 luxury) instead of the cryptic T/S/L.
    const ratesGov = `💰${taxRate}% 🔬${sciRate}% 🎭${luxRate}% · ${govName}`;
    researchLabel.title = 'income breakdown:\n' + (cityRows.join('\n') || 'no cities yet')
      + `\nrates: tax ${taxRate}% / science ${sciRate}% / luxury ${luxRate}% (T to change)`
      + `\ngovernment: ${govName}`
      + `\ntaxes +${income.gold} · upkeep −${income.maintenance} · research +${income.bulbs} bulbs`;
    if (me.researching) {
      const cost = researchCost(session.state, ctx.HUMAN, session.ruleset);
      researchFill.style.width = Math.min(100, Math.floor(bulbs * 100 / cost)) + '%';
      researchLabel.textContent = `🔬 ${techs[me.researching].name} · ${bulbs}/${cost} (+${income.bulbs}) · ${money} · ${ratesGov}`;
      researchGlyph.src = glyphDataURL(me.researching, techs[me.researching].era, 22);
      researchGlyph.style.display = 'block';
    } else {
      researchFill.style.width = '0%';
      researchLabel.textContent = `🔬 choose research · ${bulbs} bulbs (+${income.bulbs}) · ${money} · ${ratesGov}`;
      researchGlyph.style.display = 'none';
    }
  }

  // Shown once when the last unit finishes moving (the End Turn button turns
  // green and pulses); pressing N with nothing left re-shows it. The hint can
  // be muted (🔕 / options), and "auto end turn" skips the wait entirely.
  const endTurnBtn = document.getElementById('end-turn');
  let wasAllMoved = false;
  let autoEndedTurn = 0;
  // XIV §20: the SINGLE builder for the "press E to end the turn" hint — always
  // carries the 🔕 mute button and always honors the hideNoMovesHint option.
  // Both the auto-detect (updateBanner) and the manual "next unit with nothing
  // left" path (input.js) route through here so the two can't drift (the old
  // input.js path showed a bare centerBanner: no 🔕, ignored the mute option).
  // Returns false when muted (nothing shown), so a caller can fall back.
  function noMovesHint() {
    if (ctx.options && ctx.options.get('hideNoMovesHint')) return false;
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
    return true;
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
      } else {
        noMovesHint(); // honors hideNoMovesHint internally
      }
    } else if (!allMoved) {
      centerBanner.hide();
    }
    wasAllMoved = allMoved;
  }

  // A68 (VIII.10/13): own-city map notes — current production + turns left
  // under the name pill; civil disorder swaps the note for the loud alert
  // (the renderer adds the red tile ring for alert:true). Rival cities and
  // spectators get none: the walk only matches ctx.HUMAN-owned cities.
  function cityNotes(state) {
    const notes = {};
    const ruleset = session.ruleset;
    for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
      const c = state.cities[cid];
      if (!c || c.owner !== ctx.HUMAN) continue;
      if (c.disorder === true) {
        notes[c.id] = { text: '⚠ DISORDER', alert: true }; // the city view carries the full sentence
        continue;
      }
      if (!c.producing) continue;
      const table = c.producing.kind === 'unit' ? ruleset.units
        : c.producing.kind === 'wonder' ? ruleset.wonders : ruleset.buildings;
      const def = table[c.producing.id];
      if (!def) continue;
      const cost = itemCost(c.producing.kind, c.producing.id, def, state.players[c.owner], ruleset);
      const y = cityYields(state, c, ruleset);
      const turns = y.shields > 0 ? Math.max(1, Math.ceil((cost - c.shields) / y.shields)) : null;
      notes[c.id] = { text: `⚒ ${def.name}${turns !== null ? ` · ${turns}t` : ''}`, alert: false };
    }
    return notes;
  }

  function refresh() {
    const state = session.state;
    if (renderer.setCityNotes) renderer.setCityNotes(cityNotes(state));
    // era-band render hint (specs/city-era-looks.md): derive per city from the
    // owner's tech era on the fog-filtered view, so the renderer stays rules-blind
    const view = annotateCityEra(filterView(state, ctx.HUMAN), techs);
    // XIV §44: flag the VIEWER's own capital so the map label carries a ★ (fog-
    // honest — a rival's capital needs data the viewer can't see). Render-only:
    // the id rides a SIDE FIELD of the fresh view, NEVER stamped on the aliased
    // city objects (the city-era.js trap — that would taint the state hash).
    const cap = capitalOf(state, ctx.HUMAN, session.ruleset);
    if (cap) view.capitalId = cap.id;
    renderer.setViewState(view);
    renderer.setSelection(sel.unitId ? { unitId: sel.unitId } : null);
    const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
    if (state.gameOver) {
      const w = state.players[state.winner];
      const verdict = state.winner === ctx.HUMAN ? '🏆 VICTORY' : '💀 DEFEAT';
      const sstate = techSafeState(state); // server view omits rival techs under fog
      const scores = state.playerOrder
        .map(p => `${state.players[p].name} ${score(sstate, p, session.ruleset)}`).join(' · ');
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
      // A92: the permanent taint rides the status line once ANY debug
      // command succeeded (docs/07 — the game code chip carries it too)
      const taint = state.debugUsed === true ? ' · ⚠ DEBUG' : '';
      hudStatus.textContent = `turn ${state.turn} · ${year} · ${who} · ${gov}${taint}`;
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
    // A40: a regent playing this seat grays the button to "Auto Turn" — the
    // third state the A29 marker reserved; the 🤖 (regency.js) takes control back
    const regent = ctx.regency && ctx.regency.isRegent && ctx.regency.isRegent();
    endTurnBtn.disabled = !myTurn || regent;
    endTurnBtn.classList.toggle('auto-turn', regent === true);
    endTurnBtn.textContent = regent ? 'Auto Turn' : 'End Turn';
    if (myTurn && !regent && !wasMyTurn
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
    // XIV §45a: the HOME city was shown nowhere — half of why the settler-
    // upkeep starvation (the Teotihuacan trap) was invisible. Show it for every
    // unit (a homed settler eats 1 food/turn THERE); homeless = "unsupported".
    const homeCity = unit.home !== undefined && session.state.cities[unit.home]
      ? session.state.cities[unit.home].name : null;
    const homeStr = homeCity ? ` · 🏠 ${homeCity}` : ' · 🏠 unsupported';
    unitLine.textContent = `${t.name}${unit.veteran ? ' ★vet' : ''}`
      + ` · ⚔${t.attack} 🛡${t.defense} 👟${unit.moves}/${t.moves}`
      + ` · ${tile.t} (${unit.x},${unit.y}) · ${status}${homeStr}${hint}`;
    unitLine.classList.remove('hidden');
  }
  function clearUnitLine() {
    unitLine.classList.add('hidden');
  }

  return {
    refresh,
    flash: flashBanner.show,
    banner: centerBanner.show,
    noMovesHint, // XIV §20: the unified "press E" hint (mute 🔕 + option honored)
    turnBanner,
    note(text) { hudSelection.textContent = text; },
    unitNote,
    clearUnitLine,
    tile(text) { hudTile.textContent = text; }
  };
}

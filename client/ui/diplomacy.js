// D2 (specs/d1-diplomacy.md) — the Foreign-relations panel: the LEGIBILITY
// layer that lets a human answer, for every foreign civ, ARE WE AT WAR, SINCE
// WHEN, WHY — and act on it. Drafted the A89 way (draft-live, FEATURE-DETECTED)
// and ACTIVATED now that D1 landed: the command probe finds engine/diplomacy.js
// so the treaty actions render; a world with no treaty still reads "at war"
// (the spec DEFAULT). The probe keeps the panel graceful in a pre-D1 checkout.
// No engine writes here; the panel only READS (shared/diplomacy-view.js, which
// re-exports the engine's own relationOf) and DISPATCHES logged commands.
import { relationLabel, reputationOf, treatyActions, pendingOfferFor } from '../../shared/diplomacy-view.js';
import { displayColor } from './palette.js';

const BARB_ID = 'barb'; // never a diplomacy target (spec §2)

// The diplomacy-command rejections worth a plain-language line (the A83/A90
// house shape; input.js's REASON_TEXT is unit-action-scoped, so this is the
// diplomacy-family twin).
const DIPLO_REASON = {
  selfTarget: 'you cannot make a treaty with yourself',
  alreadyPeace: 'you are already at peace with them',
  alreadyWar: 'you are already at war with them',
  noSuchOffer: 'there is no standing offer to answer',
  noSuchTarget: 'no such civilization',
  atPeace: 'a peace treaty stands — break it first to attack',
  notYourTurn: 'wait for your turn',
  cannotDiplomacyBarbarians: 'barbarians do not negotiate',
  unknownKind: 'that is not a treaty action',
  notMet: 'you have not met that civilization yet',
  unknownCommand: 'diplomacy is not available in this game yet'
};

export function initDiplomacy(ctx) {
  const { session } = ctx;

  const box = document.createElement('div');
  box.id = 'diplo-overlay';
  box.className = 'hidden';
  box.innerHTML = '<div id="diplo-head">🤝 Foreign relations <button id="diplo-close" title="close">✕</button></div>'
    + '<div id="diplo-rows"></div><div id="diplo-note" class="hidden"></div>';
  document.body.appendChild(box);

  const btn = document.createElement('button');
  btn.id = 'open-diplo';
  btn.title = 'foreign relations — war, peace, treaties';
  btn.textContent = '🤝';
  const corner = document.getElementById('corner-buttons');
  if (corner) corner.appendChild(btn);
  btn.addEventListener('click', () => { box.classList.toggle('hidden'); render(); });
  box.querySelector('#diplo-close').addEventListener('click', () => box.classList.add('hidden'));

  const rowsEl = box.querySelector('#diplo-rows');
  const noteEl = box.querySelector('#diplo-note');

  // Feature-detect the diplomacy COMMAND (A89 trade.js precedent): probe the
  // engine module at init; absent (today) → status-only, no treaty buttons.
  // WIRE-UP: confirm the module/export names when D1 lands (a one-line change).
  let commandReady = false;
  import('../../engine/diplomacy.js')
    .then(m => { if (m && m.diplomacyCommand) { commandReady = true; render(); } })
    .catch(() => { /* no diplomacy engine (pre-D1 checkout) — the inert draft state */ });
  const canAct = () => commandReady && !ctx.SPECTATOR;

  function flashNote(text) {
    noteEl.textContent = text;
    noteEl.classList.remove('hidden');
  }

  async function dispatch(kind, target) {
    if (!canAct()) return;
    const cmd = { type: 'diplomacy', kind, playerId: ctx.HUMAN, target };
    if (kind === 'offer') cmd.terms = { peace: true }; // duration omitted = perpetual (Civ1 default, spec §9)
    const res = await session.apply(cmd);
    if (!res.ok) flashNote(`✗ ${DIPLO_REASON[res.reason] || res.reason}`);
    else noteEl.classList.add('hidden');
  }

  function rowButtons(state, pid) {
    if (!canAct()) return '';
    const a = treatyActions(state, ctx.HUMAN, pid);
    const btns = [];
    if (a.canAccept) btns.push(`<button class="diplo-act" data-kind="accept" data-pid="${pid}">✔ Accept peace</button>`);
    if (a.canOffer) {
      const mine = pendingOfferFor(state, ctx.HUMAN, pid);
      if (mine && mine.from === ctx.HUMAN) btns.push('<span class="diplo-pending">offer sent</span>');
      else btns.push(`<button class="diplo-act" data-kind="offer" data-pid="${pid}">🕊 Offer peace</button>`);
    }
    if (a.canDeclare) btns.push(`<button class="diplo-act" data-kind="declare" data-pid="${pid}">⚔ Declare war</button>`);
    return btns.join(' ');
  }

  function render() {
    if (box.classList.contains('hidden')) return;
    const state = session.state;
    // List every foreign, non-barbarian, living civ. D1 does NOT gate
    // diplomacy on met-state (specs §2: notMet DEFERRED), so this mirrors the
    // engine — the FIRST_CONTACT met-refinement rides its own future window.
    const order = state.playerOrder || Object.keys(state.players);
    const rows = [];
    for (const pid of order) {
      if (pid === ctx.HUMAN || pid === BARB_ID) continue;
      const p = state.players[pid];
      if (!p || (p.human === undefined && p.name === undefined)) continue;
      if (p.alive === false) continue;
      if (p.barbarian === true) continue;
      const rep = reputationOf(state, pid);
      const repTag = rep !== 0 ? ` <span class="diplo-rep" title="their standing (record-only until D3)">rep ${rep}</span>` : '';
      rows.push(
        '<div class="diplo-row">'
        + `<span class="diplo-name" style="color:${displayColor(p.color)}">${esc(p.name)}</span>`
        + `<span class="diplo-status">${esc(relationLabel(state, ctx.HUMAN, pid))}</span>${repTag}`
        + `<span class="diplo-acts">${rowButtons(state, pid)}</span>`
        + '</div>');
    }
    rowsEl.innerHTML = rows.length
      ? rows.join('')
      : '<div class="diplo-row diplo-empty">no other civilizations</div>';
    for (const b of rowsEl.querySelectorAll('.diplo-act')) {
      b.addEventListener('click', () => dispatch(b.dataset.kind, b.dataset.pid));
    }
  }

  session.onChange(render);
  return { render, open: () => { box.classList.remove('hidden'); render(); } };
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

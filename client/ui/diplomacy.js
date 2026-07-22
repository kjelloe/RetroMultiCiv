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

  // --- XIV §33: the incoming-offer ENVOY MODAL ----------------------------
  // When a rival's offer stands and it is the human's turn, a blocking modal
  // presents it (leader emblem + name, the offer, Accept / Reject / Consider
  // later). "Consider later" just dismisses — the offer PERSISTS in state and
  // the foreign-relations panel (no silent expiry). Pure presentation of the
  // D3 offer state; dispatches the same accept/reject commands as the panel.
  const modal = document.createElement('div');
  modal.id = 'envoy-modal';
  modal.className = 'hidden';
  document.body.appendChild(modal);
  const deferred = {};   // 'pid|turn' → true: dismissed via "later", don't re-pop
  let envoyPid = null;   // the civ whose offer is currently shown (one at a time)

  const offerKey = (pid, offer) => pid + '|' + (offer ? offer.turn : '?');

  function incomingOffers(state) {
    const out = [];
    const order = state.playerOrder || Object.keys(state.players);
    for (const pid of order) {
      if (pid === ctx.HUMAN || pid === BARB_ID) continue;
      const p = state.players[pid];
      if (!p || p.alive === false || p.barbarian === true) continue;
      const offer = pendingOfferFor(state, ctx.HUMAN, pid);
      if (offer && offer.from === pid) out.push({ pid, offer }); // an offer THEY made to me
    }
    return out;
  }

  function scanOffers() {
    if (!canAct() || envoyPid !== null) return;
    const state = session.state;
    if (state.activePlayer !== ctx.HUMAN) return; // answerable only on my turn
    for (const { pid, offer } of incomingOffers(state)) {
      if (deferred[offerKey(pid, offer)]) continue;
      showEnvoy(pid, offer);
      return;
    }
  }

  function showEnvoy(pid, offer) {
    const p = session.state.players[pid];
    envoyPid = pid;
    const dur = offer && offer.duration;
    const offerText = `${esc(p.name)} proposes a ${dur ? esc(dur) + '-turn' : 'lasting'} peace treaty.`;
    modal.innerHTML = '<div id="envoy-card" role="dialog" aria-modal="true">'
      + `<div id="envoy-head"><span id="envoy-glyph"></span>`
      + `<span class="envoy-leader" style="color:${displayColor(p.color)}">${esc(p.name)}</span></div>`
      + `<div id="envoy-body">${offerText}</div>`
      + '<div id="envoy-acts">'
      + '<button id="envoy-accept">✔ Accept</button>'
      + '<button id="envoy-reject">✗ Reject</button>'
      + '<button id="envoy-later">Consider later</button></div></div>';
    modal.classList.remove('hidden');
    const civ = p.civ;
    const visual = civ && session.ruleset.civs[civ] && session.ruleset.civs[civ].visual;
    if (visual) import('../renderer/three/factions.js').then(m => {
      const g = modal.querySelector('#envoy-glyph');
      if (!g) return;
      const img = document.createElement('img');
      img.src = m.emblemDataUrl(visual);
      img.style.cssText = 'width:22px;height:22px;vertical-align:-4px;margin-right:8px;border-radius:3px;';
      g.appendChild(img);
    }).catch(() => { /* no renderer (headless) — the name still carries it */ });
    modal.querySelector('#envoy-accept').addEventListener('click', () => { const t = envoyPid; closeEnvoy(); dispatch('accept', t); });
    modal.querySelector('#envoy-reject').addEventListener('click', () => { const t = envoyPid; closeEnvoy(); dispatch('reject', t); });
    modal.querySelector('#envoy-later').addEventListener('click', later);
  }

  function later() {
    if (envoyPid === null) return;
    const offer = pendingOfferFor(session.state, ctx.HUMAN, envoyPid);
    if (offer) deferred[offerKey(envoyPid, offer)] = true; // persists in state; just don't re-pop
    closeEnvoy();
  }

  function closeEnvoy() { envoyPid = null; modal.classList.add('hidden'); modal.innerHTML = ''; scanOffers(); }

  // block map hotkeys while the envoy is up; Esc = Consider later
  window.addEventListener('keydown', e => {
    if (envoyPid === null) return;
    if (e.key === 'Escape') { e.preventDefault(); later(); return; }
    e.stopPropagation();
  }, true);

  session.onChange(() => { render(); scanOffers(); });
  return { render, open: () => { box.classList.remove('hidden'); render(); }, scanOffers, envoyOpen: () => envoyPid !== null };
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

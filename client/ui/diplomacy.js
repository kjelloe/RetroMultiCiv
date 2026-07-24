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

// ?parleydemo=1 forces the D4 shell visible for screenshots (=chooser pops the
// outbound chooser instead of the inbound offer). Captured at MODULE EVAL —
// main.js canonicalizes the URL after boot (strips unknown params), so a LAZY
// read inside initDiplomacy sees the already-stripped search (A45 trap). Guarded
// for Node (the unit test imports this module; `location` is undefined there).
const PARLEY_DEMO = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('parleydemo') || '') : '';

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

// D4 human-treaty SHELL (specs/d4-treaty-ui.md, un-gated speed pass). PROVISIONAL
// wire names — command `parley`, events `parleyOffer`/`parleyResolved`, fields
// term/gold/giveTech/wantTech; ONE rename/reshape pass expected when the D4 engine
// window freezes the real shapes. The command builder + the term-describer are
// PURE (unit-tested without a DOM); the chooser/modal reuse the envoy frame.
export const PARLEY_TERMS = ['peace', 'ceasefire', 'tribute', 'techswap'];
const PARLEY_LABEL = { peace: '🕊 Peace', ceasefire: '✋ Ceasefire', tribute: '💰 Tribute', techswap: '🔬 Tech swap' };

// build the `parley` command payload for a chosen term. PURE.
export function parleyCommand(playerId, target, term, opts = {}) {
  const cmd = { type: 'parley', playerId, target, term };
  if (term === 'tribute') cmd.gold = Math.max(0, opts.gold | 0);
  if (term === 'techswap') { cmd.giveTech = opts.giveTech || ''; cmd.wantTech = opts.wantTech || ''; }
  return cmd;
}

// human-readable text for an INCOMING parley offer payload (envoy-modal body).
// `name` = the proposer; `techName(id)` resolves a tech id → its display name.
// PURE (plain text; the modal escapes it).
export function describeParley(payload, opts = {}) {
  const name = opts.name || 'They';
  const tn = id => (opts.techName ? opts.techName(id) : id) || 'a technology';
  switch (payload && payload.term) {
    case 'peace': return `${name} propose a lasting peace treaty.`;
    case 'ceasefire': return `${name} propose a ceasefire.`;
    case 'tribute': return `${name} propose a tribute of ${payload.gold | 0} gold.`;
    case 'techswap': return `${name} offer ${tn(payload.giveTech)} in exchange for your ${tn(payload.wantTech)}.`;
    default: return `${name} propose terms.`;
  }
}

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
  // XVII #18: sits in the top-center overview cluster (left of the 💰 economy
  // button), positioned absolutely via #open-diplo in style.css — not the corner group
  document.body.appendChild(btn);
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
    if (!canAct() && !parleyReady) return '';
    const btns = [];
    if (parleyReady && !ctx.SPECTATOR) btns.push(`<button class="diplo-act" data-kind="propose" data-pid="${pid}">🤝 Propose…</button>`); // D4 shell
    if (!canAct()) return btns.join(' ');
    const a = treatyActions(state, ctx.HUMAN, pid);
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
      b.addEventListener('click', () => b.dataset.kind === 'propose'
        ? openParleyChooser(b.dataset.pid)          // D4 shell chooser
        : dispatch(b.dataset.kind, b.dataset.pid));
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

  // --- D4 human-treaty SHELL: OUTBOUND chooser + INBOUND parley modal ---------
  // PROVISIONAL wire (parley / parleyOffer). The chooser sends a `parley` command
  // (the engine rejects it until D4 — surfaced via the standard reject toast);
  // an inbound parleyOffer reuses the envoy modal. Gated on a D4 command probe so
  // Propose… stays hidden until the engine lands; ?parleydemo=1 forces it for shots.
  let parleyReady = !!PARLEY_DEMO;
  import('../../engine/diplomacy.js').then(m => { if (m && m.parleyCommand) { parleyReady = true; render(); } }).catch(() => {});
  const techName = id => (session.ruleset.techs && session.ruleset.techs[id] && session.ruleset.techs[id].name) || id;

  function openParleyChooser(pid) {
    const p = session.state.players[pid];
    const myTechs = (session.state.players[ctx.HUMAN] && session.state.players[ctx.HUMAN].techs) || [];
    const allTechs = Object.keys(session.ruleset.techs || {});
    const give = myTechs.map(t => `<option value="${esc(t)}">${esc(techName(t))}</option>`).join('') || '<option value="">(no advances yet)</option>';
    const want = allTechs.filter(t => myTechs.indexOf(t) === -1).map(t => `<option value="${esc(t)}">${esc(techName(t))}</option>`).join('');
    const layer = document.createElement('div');
    layer.id = 'parley-chooser';
    layer.innerHTML = `<div id="parley-card" role="dialog" aria-modal="true">
      <div id="parley-head">Propose to ${esc(p ? p.name : pid)}</div>
      <div id="parley-terms">${PARLEY_TERMS.map(t => `<button class="parley-term" data-term="${t}">${PARLEY_LABEL[t]}</button>`).join('')}</div>
      <div id="parley-detail" class="hidden">
        <label class="parley-gold hidden">Tribute gold <input id="parley-gold" type="number" min="0" step="10" value="50" style="width:70px"></label>
        <div class="parley-swap hidden"><label>Give <select id="parley-give">${give}</select></label>
        <label>Want <select id="parley-want">${want}</select></label></div>
        <button id="parley-send">Send offer</button>
      </div>
      <div id="parley-foot"><button id="parley-cancel">Cancel</button></div></div>`;
    document.body.appendChild(layer);
    let term = null;
    const detail = layer.querySelector('#parley-detail');
    const goldWrap = layer.querySelector('.parley-gold');
    const swapWrap = layer.querySelector('.parley-swap');
    function close() { layer.remove(); }
    layer.addEventListener('click', e => { if (e.target === layer) close(); });
    layer.querySelector('#parley-cancel').addEventListener('click', close);
    for (const b of layer.querySelectorAll('.parley-term')) b.addEventListener('click', () => {
      term = b.dataset.term;
      for (const x of layer.querySelectorAll('.parley-term')) x.classList.toggle('sel', x === b);
      detail.classList.remove('hidden');
      goldWrap.classList.toggle('hidden', term !== 'tribute');
      swapWrap.classList.toggle('hidden', term !== 'techswap');
    });
    layer.querySelector('#parley-send').addEventListener('click', async () => {
      if (!term) return;
      const opts = { gold: parseInt(layer.querySelector('#parley-gold').value, 10) || 0,
        giveTech: layer.querySelector('#parley-give').value, wantTech: layer.querySelector('#parley-want').value };
      close();
      const res = await session.apply(parleyCommand(ctx.HUMAN, pid, term, opts));
      if (res && !res.ok) flashNote(`✗ ${DIPLO_REASON[res.reason] || res.reason}`);
    });
  }

  // INBOUND parley offer → the shipped envoy modal, terms from the event payload.
  function showParleyOffer(payload) {
    const pid = payload.from;
    const p = session.state.players[pid] || { name: pid, color: '#8899aa' };
    envoyPid = pid;
    const body = describeParley(payload, { name: p.name, techName });
    modal.innerHTML = '<div id="envoy-card" role="dialog" aria-modal="true">'
      + `<div id="envoy-head"><span id="envoy-glyph"></span>`
      + `<span class="envoy-leader" style="color:${displayColor(p.color)}">${esc(p.name)}</span></div>`
      + `<div id="envoy-body">${esc(body)}</div>`
      + '<div id="envoy-acts"><button id="envoy-accept">✔ Accept</button>'
      + '<button id="envoy-reject">✗ Reject</button>'
      + '<button id="envoy-later">Consider later</button></div></div>';
    modal.classList.remove('hidden');
    modal.querySelector('#envoy-accept').addEventListener('click', async () => { closeEnvoy(); await session.apply(parleyCommand(ctx.HUMAN, pid, 'accept')); });
    modal.querySelector('#envoy-reject').addEventListener('click', async () => { closeEnvoy(); await session.apply(parleyCommand(ctx.HUMAN, pid, 'reject')); });
    modal.querySelector('#envoy-later').addEventListener('click', () => { closeEnvoy(); });
  }
  // event hook (inert until the D4 engine emits parleyOffer): the meta/event stream
  ctx.parley = { chooser: openParleyChooser, offer: showParleyOffer }; // e2e/test/demo hook
  if (PARLEY_DEMO) {
    const other = (session.state.playerOrder || []).find(x => x !== ctx.HUMAN && x !== BARB_ID);
    setTimeout(() => PARLEY_DEMO === 'chooser'
      ? openParleyChooser(other)
      : showParleyOffer({ from: other, term: 'techswap', giveTech: Object.keys(session.ruleset.techs || {})[2], wantTech: Object.keys(session.ruleset.techs || {})[5] }), 300);
  }

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

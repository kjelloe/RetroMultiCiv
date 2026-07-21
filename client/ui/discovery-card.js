// The TECH-DISCOVERY CARD (specs/tech-discovery-card.md): a transient card
// on techDiscovered for the CURRENT viewpoint — tech name + era, the
// original blurb (tech-blurbs.js, empty-tolerant), the unlock list as PEDIA
// deep links, and the choose-research prompt folded in (turnlog's flash
// yields to this card so nothing double-flashes). Historian-precedent
// transient: one at a time, click-through or ~6 s auto-dismiss. ⚙ toggle
// 'discoveryCards' mutes it (advice precedent). Hotseat-safe: ctx.HUMAN is
// read per event, never cached.
import { TECH_BLURBS } from './tech-blurbs.js';
import { availableTechs } from '../../engine/tech.js';
import { glyphImg } from './tech-glyphs.js';

export function initDiscoveryCard(ctx) {
  const { session } = ctx;
  const { techs, units, buildings, wonders } = session.ruleset;
  let overlay = null;      // XIV §26: the full celebration overlay (world-dim + card)
  let escHandler = null;
  const queue = [];

  function enabled() {
    return !ctx.options || ctx.options.get('discoveryCards') !== false;
  }

  // what a tech unlocks, as pedia-addressable triples (mirrors the
  // catalog-text construction, but keeps cat+id so openTo can land)
  function unlocksOf(techId) {
    const out = [];
    for (const [cat, table] of [['units', units], ['buildings', buildings], ['wonders', wonders]]) {
      for (const id of Object.keys(table).sort()) {
        if (table[id].tech === techId) out.push({ cat, id, name: table[id].name });
      }
    }
    return out;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function close() {
    if (escHandler) { window.removeEventListener('keydown', escHandler); escHandler = null; }
    if (overlay) overlay.remove();
    overlay = null;
    pump();
  }

  // XIV §26 (ally design): the tech-discovery CELEBRATION — a soft world-dim
  // behind a centered card: large era-glyph → "ADVANCE DISCOVERED" → name →
  // blurb → a separate UNLOCKED consequence panel → two deliberate exits
  // ("Continue" / "Choose Research"). NO auto-close — the player decides (phone
  // players must not race the UI). The era fanfare is played by sound.js off
  // the same techDiscovered event.
  function show(techId) {
    const def = techs[techId];
    if (!def) { pump(); return; }
    const blurb = TECH_BLURBS[techId];
    const unlocks = unlocksOf(techId);
    const state = session.state;
    const canResearch = state.players[ctx.HUMAN]
      && availableTechs(state, ctx.HUMAN, session.ruleset).length > 0;

    overlay = document.createElement('div');
    overlay.id = 'discovery-overlay';
    const card = document.createElement('div');
    card.id = 'discovery-card';
    card.className = 'reveal';
    card.innerHTML = `
      <div class="dc-glyph"></div>
      <div class="dc-kicker">ADVANCE DISCOVERED</div>
      <div class="dc-name">${esc(def.name)} <span class="dc-era">${esc(def.era)}</span></div>
      ${blurb ? `<div class="dc-blurb">${esc(blurb)}</div>` : ''}
      ${unlocks.length > 0 ? `<div class="dc-unlocked"><div class="dc-unlocked-h">UNLOCKED</div>`
        + `<div class="dc-unlocked-list">${unlocks.map(u =>
          `<button class="dc-link" data-cat="${u.cat}" data-id="${u.id}">${esc(u.name)}</button>`).join('')}</div></div>` : ''}
      <div class="dc-actions">
        <button class="dc-continue">Continue</button>
        <button class="dc-choose"${canResearch ? '' : ' disabled'}>Choose Research</button>
      </div>`;
    const slot = card.querySelector('.dc-glyph');
    if (slot) slot.appendChild(glyphImg(techId, def.era, 88));
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    card.querySelector('.dc-continue').addEventListener('click', close);
    const choose = card.querySelector('.dc-choose');
    if (choose && canResearch) {
      choose.addEventListener('click', () => {
        close();
        if (ctx.panels && ctx.panels.toggleResearchPanel) ctx.panels.toggleResearchPanel();
      });
    }
    // an unlock name opens its civilopedia entry
    card.addEventListener('click', e => {
      const link = e.target.closest('.dc-link');
      if (link && ctx.pedia) { const cat = link.dataset.cat, id = link.dataset.id; close(); ctx.pedia.openTo(cat, id); }
    });
    // backdrop click / Esc = Continue; NEVER an auto-timer
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    escHandler = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', escHandler);
  }

  function pump() {
    if (overlay || queue.length === 0) return;
    show(queue.shift());
  }

  session.onChange((_state, events) => {
    if (!enabled()) return;
    for (const e of events) {
      if (e.type === 'techDiscovered' && e.playerId === ctx.HUMAN) queue.push(e.tech);
    }
    pump();
  });

  return { enabled, show }; // show exposed for e2e/screenshot hooks
}

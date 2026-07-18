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

const AUTO_MS = 6000;

export function initDiscoveryCard(ctx) {
  const { session } = ctx;
  const { techs, units, buildings, wonders } = session.ruleset;
  let card = null;
  let timer = 0;
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
    clearTimeout(timer);
    if (card) card.remove();
    card = null;
    pump();
  }

  function show(techId) {
    const def = techs[techId];
    if (!def) { pump(); return; }
    card = document.createElement('div');
    card.id = 'discovery-card';
    const blurb = TECH_BLURBS[techId];
    const unlocks = unlocksOf(techId);
    const state = session.state;
    const me = state.players[ctx.HUMAN];
    const wantsResearch = me && me.researching === ''
      && availableTechs(state, ctx.HUMAN, session.ruleset).length > 0;
    card.innerHTML = `
      <div class="dc-head"><span class="dc-glyph-slot"></span>${esc(def.name)} <span class="dc-era">${esc(def.era)}</span></div>
      ${blurb ? `<div class="dc-blurb">${esc(blurb)}</div>` : ''}
      ${unlocks.length > 0 ? `<div class="dc-unlocks">unlocks ${unlocks.map(u =>
        `<button class="dc-link" data-cat="${u.cat}" data-id="${u.id}">${esc(u.name)}</button>`).join(' ')}</div>` : ''}
      ${wantsResearch ? '<div class="dc-research">🔬 Choose new research — press T or click the research bar</div>' : ''}
      <div class="dc-hint">click to dismiss</div>`;
    const slot = card.querySelector('.dc-glyph-slot');
    if (slot) slot.appendChild(glyphImg(techId, def.era, 30));
    card.addEventListener('click', e => {
      const link = e.target.closest('.dc-link');
      if (link && ctx.pedia) {
        const cat = link.dataset.cat;
        const id = link.dataset.id;
        close();
        ctx.pedia.openTo(cat, id);
        return;
      }
      close();
    });
    document.body.appendChild(card);
    timer = setTimeout(close, AUTO_MS);
  }

  function pump() {
    if (card || queue.length === 0) return;
    show(queue.shift());
  }

  session.onChange((_state, events) => {
    if (!enabled()) return;
    for (const e of events) {
      if (e.type === 'techDiscovered' && e.playerId === ctx.HUMAN) queue.push(e.tech);
    }
    pump();
  });

  return { enabled };
}

// The TECH-DISCOVERY CARD (specs/tech-discovery-card.md): a transient card
// on techDiscovered for the CURRENT viewpoint — tech name + era, the
// original blurb (tech-blurbs.js, empty-tolerant), the unlock list as PEDIA
// deep links, and the choose-research prompt folded in (turnlog's flash
// yields to this card so nothing double-flashes). Historian-precedent
// transient: one at a time, click-through or ~6 s auto-dismiss. ⚙ toggle
// 'discoveryCards' mutes it (advice precedent). Hotseat-safe: ctx.HUMAN is
// read per event, never cached.
import { TECH_BLURBS } from './tech-blurbs.js';
import { PEDIA_NAME } from './pedia-name.js';
import { availableTechs } from '../../engine/tech.js';
import { glyphImg } from './tech-glyphs.js';
import { stanceFromPersonality } from '../../engine/leaders.js';

// A59 leader stance → a readable one-liner for the game-start splash. Reuses the
// engine's pure stance derivation (never a forked resolver); Civ 1 has no unique
// units, so the splash presents the civ's SPECIALTY + the leader's personality.
const LEADER_STANCE_PHRASE = {
  aggressive: 'an aggressive leader who favors conquest',
  science: 'a scholarly leader who favors research',
  growth: 'an expansionist leader who favors growth and settlement',
  defensive: 'a cautious leader who favors strong defenses',
  balanced: 'a balanced, even-handed leader'
};

export function initDiscoveryCard(ctx) {
  const { session } = ctx;
  const { techs, units, buildings, wonders } = session.ruleset;
  let overlay = null;      // XIV §26: the full celebration overlay (world-dim + card)
  let escHandler = null;
  const queue = [];
  let shownCivIntro = false; // #6 item 2: the game-start civ splash shows once per start

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
    // XV §6: each unlock also gets the §22 hover-card pedia summary — REUSE the
    // panels builder (ctx.panels.entitySummary), never a forked resolver.
    for (const link of card.querySelectorAll('.dc-link')) {
      link.addEventListener('mouseenter', () => {
        if (ctx.panels && ctx.panels.entitySummary && ctx.hoverCard) {
          const sum = ctx.panels.entitySummary(link.dataset.cat, link.dataset.id);
          if (sum) ctx.hoverCard.showAtEl(link, sum);
        }
      });
      link.addEventListener('mouseleave', () => { if (ctx.hoverCard) ctx.hoverCard.hide(); });
    }
    // backdrop click / Esc = Continue; NEVER an auto-timer
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    escHandler = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', escHandler);
  }

  // XIV §48: the WONDER-COMPLETE splash — the SAME discovery frame (world-dim +
  // centered card, NO auto-close): the wonder's era glyph (🏆 fallback), "WONDER
  // COMPLETE", its name, a Civilopedia deep-link, and two deliberate exits
  // (Go to the city / Continue). The triumphant cue is played by sound.js off the
  // same wonderBuilt event (own → 'wonder-triumph').
  function showWonder(wonderId, cityId) {
    const def = wonders[wonderId];
    if (!def) { pump(); return; }
    const city = session.state.cities[cityId];
    const cityName = city ? city.name : '';
    overlay = document.createElement('div');
    overlay.id = 'discovery-overlay';
    const card = document.createElement('div');
    card.id = 'discovery-card';
    card.className = 'reveal';
    card.innerHTML = `
      <div class="dc-glyph"></div>
      <div class="dc-kicker">WONDER COMPLETE</div>
      <div class="dc-name">${esc(def.name)}</div>
      <div class="dc-blurb">A Wonder of the World${cityName ? ` — built in ${esc(cityName)}` : ''}. Only one civilization can hold it.</div>
      <div class="dc-actions">
        <button class="dc-pedia">📖 ${PEDIA_NAME}</button>
        ${city ? '<button class="dc-goto">Go to ' + esc(cityName) + '</button>' : ''}
        <button class="dc-continue">Continue</button>
      </div>`;
    const slot = card.querySelector('.dc-glyph');
    if (slot) {
      const eraOf = def.tech && techs[def.tech] ? techs[def.tech].era : null;
      if (def.tech && eraOf) slot.appendChild(glyphImg(def.tech, eraOf, 88));
      else slot.innerHTML = '<div class="dc-trophy">🏆</div>';
    }
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    card.querySelector('.dc-continue').addEventListener('click', close);
    const pediaBtn = card.querySelector('.dc-pedia');
    if (pediaBtn) pediaBtn.addEventListener('click', () => { close(); if (ctx.pedia) ctx.pedia.openTo('wonders', wonderId); });
    const gotoBtn = card.querySelector('.dc-goto');
    if (gotoBtn) gotoBtn.addEventListener('click', () => { close(); if (ctx.panels && ctx.panels.openCityPanel) ctx.panels.openCityPanel(cityId); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    escHandler = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', escHandler);
  }

  // #6 item 2 (Refinement XX §2): the GAME-START civ splash — the same discovery
  // frame (world-dim + centered card, Continue-gated, no auto-close): "You lead
  // the [Civ]", the leader + personality (A59), and the civ's SPECIALTY with a §22
  // hover-card + pedia deep-link. Civ 1 has NO unique units — the identity is the
  // specialty (discount) and leader, never invented uniques. Once per game start;
  // AUTOMATION/spectator-suppressed at the main.js call site.
  function showCivIntro(civId) {
    if (overlay) return; // never stack over another card
    const civ = session.ruleset.civs && session.ruleset.civs[civId];
    if (!civ) return;
    shownCivIntro = true;
    const leader = civ.leader || 'your ruler';
    const stance = civ.personality ? stanceFromPersonality(civ.personality) : 'balanced';
    const phrase = LEADER_STANCE_PHRASE[stance] || LEADER_STANCE_PHRASE.balanced;
    const sp = civ.specialty || {};
    const specUnit = sp.unit && units[sp.unit] ? sp.unit : null;
    const rawColor = (civ.visual && civ.visual.primary) || civ.color || '#8fa8cc';
    const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#8fa8cc';

    overlay = document.createElement('div');
    overlay.id = 'discovery-overlay';
    const card = document.createElement('div');
    card.id = 'discovery-card';
    card.className = 'reveal ci-card';
    card.innerHTML = `
      <div class="dc-glyph"><div class="ci-emblem" style="--civ:${color}"></div></div>
      <div class="dc-kicker">A NEW WORLD BEGINS</div>
      <div class="dc-name">You lead the ${esc(civ.name)}</div>
      <div class="dc-blurb">${esc(leader)} — ${esc(phrase)}.</div>
      <div class="dc-unlocked">
        <div class="dc-unlocked-h">YOUR PEOPLE'S STRENGTH</div>
        <div class="ci-specialty">${esc(sp.blurb || 'a resourceful people')}`
          + `${specUnit ? ` <button class="dc-link" data-cat="units" data-id="${esc(specUnit)}">📖 ${esc(units[specUnit].name)}</button>` : ''}</div>
      </div>
      <div class="dc-actions">
        <button class="dc-continue">Begin your reign ▸</button>
      </div>`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    card.querySelector('.dc-continue').addEventListener('click', close);
    // the specialty unit opens its pedia entry
    card.addEventListener('click', e => {
      const link = e.target.closest('.dc-link');
      if (link && ctx.pedia) { const cat = link.dataset.cat, id = link.dataset.id; close(); ctx.pedia.openTo(cat, id); }
    });
    // §22 hover-card summary on the specialty link — REUSE the panels builder
    for (const link of card.querySelectorAll('.dc-link')) {
      link.addEventListener('mouseenter', () => {
        if (ctx.panels && ctx.panels.entitySummary && ctx.hoverCard) {
          const sum = ctx.panels.entitySummary(link.dataset.cat, link.dataset.id);
          if (sum) ctx.hoverCard.showAtEl(link, sum);
        }
      });
      link.addEventListener('mouseleave', () => { if (ctx.hoverCard) ctx.hoverCard.hide(); });
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    escHandler = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', escHandler);
  }

  // gated entry: show ONCE per game start, only at a fresh/turn-0 start (a load
  // into a mid-game turn does not re-introduce the civ). Returns true if it showed.
  function maybeShowCivIntro() {
    const state = session.state;
    if (shownCivIntro || !state || state.gameOver === true) return false;
    if (state.turn > 1) return false; // only the game start / a turn-0 load
    const me = state.players[ctx.HUMAN];
    const civId = me && me.civ;
    if (civId === undefined) return false;
    showCivIntro(civId);
    return overlay !== null;
  }

  function pump() {
    if (overlay || queue.length === 0) return;
    const item = queue.shift();
    if (item.kind === 'wonder') showWonder(item.id, item.cityId);
    else show(item.id);
  }

  session.onChange((state, events) => {
    if (!enabled()) return;
    for (const e of events) {
      if (e.type === 'techDiscovered' && e.playerId === ctx.HUMAN) queue.push({ kind: 'tech', id: e.tech });
      // XIV §48: the viewer's OWN wonder gets the celebration splash; a rival's
      // wonder keeps the modest §47-named turnlog line (no splash).
      else if (e.type === 'wonderBuilt' && state.cities[e.cityId] && state.cities[e.cityId].owner === ctx.HUMAN) {
        queue.push({ kind: 'wonder', id: e.wonder, cityId: e.cityId });
      }
    }
    pump();
  });

  return { enabled, show, showWonder, showCivIntro, maybeShowCivIntro }; // + civ splash (e2e/screenshot hooks)
}

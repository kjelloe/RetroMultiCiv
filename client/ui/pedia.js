// A58b: the in-game encyclopedia (Civilopedia) — a full-screen, browsable
// reference for every unit, building, wonder, tech, government, and terrain,
// rendered FROM the rulesets (numbers never hand-duplicated) via the shared
// catalog-text renderer. Concept entries (happiness, disorder, …) are A58c.
// Full-screen overlay (setup/theater precedent); ESC or the 📖 button closes;
// opens from the 📖 corner button + the '?' key. Client-only + golden-neutral:
// reads session.ruleset, never game state.
import { makeCatalogText } from './catalog-text.js';
import { CONCEPTS } from './pedia-concepts.js';
import { UNIT_BLURBS, BUILDING_BLURBS } from './unit-building-blurbs.js';

function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

export function initPedia(ctx) {
  const { session } = ctx;
  const r = session.ruleset;
  const { units, buildings, wonders, techs, governments, terrain } = r;
  const cat = makeCatalogText(r);

  // sorted [id, def] pairs by display name
  const sorted = table => Object.keys(table).map(id => [id, table[id]]).sort((a, b) => (a[1].name < b[1].name ? -1 : a[1].name > b[1].name ? 1 : 0));
  // a clickable cross-link to another entry: data-goto="cat:id"
  const link = (catId, id, label) => `<a class="pedia-link" data-goto="${catId}:${esc(id)}">${esc(label)}</a>`;
  const techLink = id => (techs[id] ? link('techs', id, techs[id].name) : '');

  function statRow(label, val) { return `<div class="pedia-stat"><span>${esc(label)}</span><b>${esc(val)}</b></div>`; }

  // per-category: label, the entry list, and the detail renderer
  const CATS = {
    units: { label: 'Units', list: () => sorted(units), render: (id, u) => `
      ${UNIT_BLURBS[id] ? `<p class="pedia-prose pedia-flavor">${esc(UNIT_BLURBS[id])}</p>` : ''}
      <div class="pedia-stats">
        ${statRow('Attack', u.attack)}${statRow('Defense', u.defense)}${statRow('Moves', u.moves)}
        ${statRow('Cost', u.cost + ' shields')}${statRow('Domain', u.domain)}
      </div>
      ${u.notes ? `<p class="pedia-prose">${esc(u.notes)}</p>` : ''}
      ${u.tech ? `<p class="pedia-req">Requires ${techLink(u.tech)}</p>` : '<p class="pedia-req">Available from the start</p>'}` },
    buildings: { label: 'Buildings', list: () => sorted(buildings), render: (id, b) => `
      ${BUILDING_BLURBS[id] ? `<p class="pedia-prose pedia-flavor">${esc(BUILDING_BLURBS[id])}</p>` : ''}
      <div class="pedia-stats">${statRow('Cost', b.cost + ' shields')}${statRow('Upkeep', (b.maintenance || 0) + ' gold/turn')}</div>
      <p class="pedia-prose">${esc(cat.effectText(b) || 'a civic improvement')}</p>
      ${b.tech ? `<p class="pedia-req">Requires ${techLink(b.tech)}</p>` : ''}` },
    wonders: { label: 'Wonders', list: () => sorted(wonders), render: (id, w) => `
      <div class="pedia-stats">${statRow('Cost', w.cost + ' shields')}</div>
      <p class="pedia-prose">${esc(cat.effectText(w) || 'a wonder of the world')}</p>
      ${w.tech ? `<p class="pedia-req">Requires ${techLink(w.tech)}</p>` : ''}` },
    techs: { label: 'Advances', list: () => sorted(techs), render: (id, t) => `
      <div class="pedia-stats">${statRow('Era', t.era)}${statRow('Tier', t.level)}</div>
      ${t.prereqs.length ? `<p class="pedia-req">Needs ${t.prereqs.map(techLink).join(' + ')}</p>` : '<p class="pedia-req">A starting advance</p>'}
      ${(cat.techUnlocks[id] || []).length ? `<p class="pedia-prose">Unlocks: ${(cat.techUnlocks[id]).map(esc).join(', ')}</p>` : ''}
      ${(() => { const kids = Object.keys(techs).filter(k => techs[k].prereqs.includes(id)); return kids.length ? `<p class="pedia-prose">Leads to: ${kids.map(k => link('techs', k, techs[k].name)).join(', ')}</p>` : ''; })()}` },
    governments: { label: 'Governments', list: () => sorted(governments), render: (id, g) => `
      <div class="pedia-stats">
        ${statRow('Max tax/science rate', g.maxRate + '%')}${statRow('Trade bonus', (g.tradeBonus ? '+' + g.tradeBonus + ' on trade tiles' : 'none'))}
        ${statRow('Corruption', g.corruptionFactor === 0 ? 'none' : 'factor ' + g.corruptionFactor)}${statRow('Free units/city', g.freeUnitsPerCity)}
        ${statRow('Martial law', g.martialLawMax ? 'up to ' + g.martialLawMax + ' units calm a city' : 'none')}${statRow('War unhappiness', g.warUnhappiness ? 'yes' : 'no')}
      </div>
      ${g.tech ? `<p class="pedia-req">Requires ${techLink(g.tech)}</p>` : '<p class="pedia-req">Available from the start</p>'}` },
    terrain: { label: 'Terrain', list: () => sorted(terrain), render: (id, t) => `
      <div class="pedia-stats">
        ${statRow('Yields (F/S/T)', (t.yields ? [t.yields.food || 0, t.yields.shields || 0, t.yields.trade || 0].join(' / ') : '0 / 0 / 0'))}
        ${statRow('Defense', t.defenseBonus ? '+' + t.defenseBonus + '%' : 'none')}${statRow('Move cost', t.move)}
      </div>
      ${t.special && t.special.name ? `<p class="pedia-prose">Special resource: ${esc(t.special.name)}${t.special.yields ? ` (${[t.special.yields.food || 0, t.special.yields.shields || 0, t.special.yields.trade || 0].join('/')})` : ''}</p>` : ''}` },
    concepts: { label: 'Concepts', list: () => CONCEPTS.map(c => [c.id, c]), render: (id, c) => `<p class="pedia-prose">${esc(c.body)}</p>` }
  };
  const CONCEPT_MAP = {}; for (const c of CONCEPTS) CONCEPT_MAP[c.id] = c;
  const CAT_ORDER = ['units', 'buildings', 'wonders', 'techs', 'governments', 'terrain', 'concepts'];

  const overlay = document.createElement('div');
  overlay.id = 'pedia';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div id="pedia-frame">
      <div id="pedia-head"><h2>📖 Civilopedia</h2><input id="pedia-search" type="search" placeholder="search by name…" autocomplete="off"><button id="pedia-close" title="close (Esc)">✕</button></div>
      <div id="pedia-body"><div id="pedia-cats"></div><div id="pedia-list"></div><div id="pedia-entry"></div></div>
    </div>`;
  document.body.appendChild(overlay);
  const catsEl = overlay.querySelector('#pedia-cats');
  const listEl = overlay.querySelector('#pedia-list');
  const entryEl = overlay.querySelector('#pedia-entry');

  let curCat = 'units';
  function renderCats() {
    catsEl.innerHTML = CAT_ORDER.map(c => `<button class="pedia-cat${c === curCat ? ' active' : ''}" data-cat="${c}">${CATS[c].label}</button>`).join('');
  }
  function renderList() {
    listEl.innerHTML = CATS[curCat].list().map(([id, def]) => `<button class="pedia-item" data-id="${esc(id)}">${esc(def.name)}</button>`).join('');
  }
  // A58 item 4: search finds every entry by name across ALL categories; a match
  // carries its category so a click opens the right article.
  function doSearch(q) {
    const query = String(q || '').trim().toLowerCase();
    if (!query) { renderList(); return; }
    const hits = [];
    for (const c of CAT_ORDER) {
      for (const [id, def] of CATS[c].list()) {
        if (String(def.name).toLowerCase().includes(query)) hits.push({ c, id, name: def.name });
      }
    }
    listEl.innerHTML = hits.length
      ? hits.map(h => `<button class="pedia-item" data-cat="${h.c}" data-id="${esc(h.id)}">${esc(h.name)} <span class="pedia-item-cat">${esc(CATS[h.c].label)}</span></button>`).join('')
      : '<div class="pedia-empty">no matches</div>';
  }
  function showEntry(catId, id) {
    const def = catId === 'concepts' ? CONCEPT_MAP[id] : r[catId][id];
    if (!def) return;
    entryEl.innerHTML = `<h3>${esc(def.name)}</h3>${CATS[catId].render(id, def)}`;
  }
  function selectCat(c) { curCat = c; renderCats(); renderList(); const first = CATS[c].list()[0]; if (first) showEntry(c, first[0]); }

  catsEl.addEventListener('click', e => { const b = e.target.closest('.pedia-cat'); if (b) selectCat(b.dataset.cat); });
  listEl.addEventListener('click', e => { const b = e.target.closest('.pedia-item'); if (b) showEntry(b.dataset.cat || curCat, b.dataset.id); });
  overlay.querySelector('#pedia-search').addEventListener('input', e => doSearch(e.target.value));
  entryEl.addEventListener('click', e => {
    const a = e.target.closest('.pedia-link'); if (!a) return;
    const [c, id] = a.dataset.goto.split(':'); selectCat(c); showEntry(c, id);
    // reflect the jumped-to entry in the list highlight
  });

  function open() { overlay.classList.remove('hidden'); selectCat(curCat); }
  function close() { overlay.classList.add('hidden'); }
  function toggle() { overlay.classList.contains('hidden') ? open() : close(); }
  // A58c: deep-link entry point — the ❓ quick-help + advice cards call this to
  // jump straight to a concept (or any) entry.
  function openTo(catId, id) { overlay.classList.remove('hidden'); selectCat(catId); showEntry(catId, id); }
  overlay.querySelector('#pedia-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); }); // click the backdrop

  // 📖 corner button next to the existing ❓/⚙ (options.js #corner-buttons)
  const corner = document.getElementById('corner-buttons');
  if (corner) {
    const b = document.createElement('button');
    b.id = 'open-pedia'; b.title = 'civilopedia (?)'; b.textContent = '📖';
    corner.insertBefore(b, corner.firstChild);
    b.addEventListener('click', toggle);
  }
  // '?' opens, Esc closes — house rule: ignore INPUT/TEXTAREA targets
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === '?') { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape' && !overlay.classList.contains('hidden')) { close(); }
  });

  return { open, close, toggle, openTo };
}

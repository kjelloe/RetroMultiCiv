// Overlay panels: research, city view, and the tile-stack unit list.
import { availableTechs, researchCost } from '../../engine/tech.js';
import { workedTiles, candidateTiles, tileYields } from '../../engine/cities.js';
import { unitsAt, cityAt } from '../../engine/combat.js';
import { terrainColor } from '../renderer/renderer.js';

export function initPanels(ctx) {
  const { session, renderer, sel, HUMAN } = ctx;
  const { techs, units, buildings, wonders } = session.ruleset;
  const researchPanel = document.getElementById('research-panel');
  const cityPanel = document.getElementById('city-panel');
  const stackPanel = document.getElementById('stack-panel');
  const startBtn = document.getElementById('research-start');

  let openCityId = null;
  let chosenTech = null;
  let stackTile = null;

  // yields as color-coded food/shields/trade spans
  function yieldsHtml(f, s, t) {
    return `<span class="yf">${f}</span>/<span class="ys">${s}</span>/<span class="yt">${t}</span>`;
  }

  // plain-language lines for the structured effect fields (tools/mapdata.js overlays)
  const EFFECT_TEXT = {
    halvesGrowthFood: () => 'keeps half the food box when the city grows',
    growthPast10: () => 'lets the city grow beyond population 10',
    veteranUnits: () => 'new units here start as veterans',
    defenseMultiplier: v => `defenders ×${v} against attacks`,
    taxBonus: v => `+${v}% gold in this city`,
    sciBonus: v => `+${v}% science in this city`,
    cityTradeBonus: () => '+1 trade on every trade tile here',
    wallsEverywhere: () => 'city walls in all your cities'
  };
  function effectText(def) {
    const parts = [];
    for (const key of Object.keys(def.effect || {})) {
      if (EFFECT_TEXT[key]) parts.push(EFFECT_TEXT[key](def.effect[key]));
    }
    if (def.obsoleteBy) parts.push(`obsolete with ${techs[def.obsoleteBy].name}`);
    return parts.join(' · ');
  }

  // tech id -> what it unlocks / which techs need it (research panel sublines)
  const techUnlocks = {};
  const techLeadsTo = {};
  {
    const add = (map, key, name) => { (map[key] = map[key] || []).push(name); };
    for (const id of Object.keys(units)) if (units[id].tech !== '') add(techUnlocks, units[id].tech, units[id].name);
    for (const id of Object.keys(buildings)) if (buildings[id].tech !== '') add(techUnlocks, buildings[id].tech, buildings[id].name);
    for (const id of Object.keys(wonders)) if (wonders[id].tech !== '') add(techUnlocks, wonders[id].tech, wonders[id].name + ' 🏆');
    for (const id of Object.keys(techs)) {
      for (const p of techs[id].prereqs) add(techLeadsTo, p, techs[id].name);
    }
  }

  // --- research panel --------------------------------------------------------
  function startResearch(techId) {
    if (!techId) return;
    const res = session.apply({ type: 'setResearch', playerId: HUMAN, tech: techId });
    if (res.ok) {
      chosenTech = null;
      researchPanel.classList.add('hidden');
    } else {
      ctx.hud.note(`✗ setResearch: ${res.reason}`);
    }
  }

  function fillResearchPanel() {
    const state = session.state;
    const me = state.players[HUMAN];
    const cost = researchCost(state, HUMAN, session.ruleset);
    document.getElementById('research-summary').textContent =
      `${me.techs.length}/${Object.keys(techs).length} advances known · `
      + `${me.bulbs || 0} bulbs · next costs ${cost}`;

    const tax = me.taxRate === undefined ? session.ruleset.rules.defaultTaxRate : me.taxRate;
    const sci = me.sciRate === undefined ? session.ruleset.rules.defaultSciRate : me.sciRate;
    document.getElementById('rate-tax').textContent = `💰 tax ${tax}%`;
    document.getElementById('rate-sci').textContent = `sci ${sci}% 🔬`;
    document.getElementById('rate-slider').value = sci;

    const list = document.getElementById('research-list');
    list.textContent = '';
    const avail = availableTechs(state, HUMAN, session.ruleset)
      .sort((a, b) => techs[a].level - techs[b].level || (a < b ? -1 : 1));
    let level = -1;
    for (const id of avail) {
      if (techs[id].level !== level) {
        level = techs[id].level;
        const h = document.createElement('div');
        h.className = 'group-title';
        h.textContent = `level ${level}`;
        list.appendChild(h);
      }
      const btn = document.createElement('button');
      btn.className = 'option'
        + (me.researching === id ? ' current' : '')
        + (chosenTech === id ? ' chosen' : '');
      btn.textContent = techs[id].name;
      const unlocks = techUnlocks[id] || [];
      const leads = techLeadsTo[id] || [];
      const bits = [];
      if (unlocks.length) bits.push(`unlocks ${unlocks.join(', ')}`);
      if (leads.length) bits.push(`→ ${leads.slice(0, 3).join(', ')}${leads.length > 3 ? '…' : ''}`);
      if (bits.length) {
        const fx = document.createElement('div');
        fx.className = 'fx';
        fx.textContent = bits.join(' · ');
        btn.appendChild(fx);
      }
      btn.addEventListener('click', () => {
        chosenTech = id;
        startBtn.disabled = false;
        fillResearchPanel();
      });
      btn.addEventListener('dblclick', () => startResearch(id));
      list.appendChild(btn);
    }
    if (avail.length === 0) {
      const done = document.createElement('div');
      done.textContent = 'nothing left to research';
      list.appendChild(done);
    }
    startBtn.disabled = !chosenTech;
  }

  function toggleResearchPanel() {
    if (researchPanel.classList.contains('hidden')) {
      chosenTech = null;
      fillResearchPanel();
      researchPanel.classList.remove('hidden');
      closeCityPanel();
    } else {
      researchPanel.classList.add('hidden');
    }
  }

  // --- city panel ------------------------------------------------------------
  function itemDef(item) {
    if (item.kind === 'building') return buildings[item.id];
    if (item.kind === 'wonder') return wonders[item.id];
    return units[item.id];
  }

  function openCityPanel(cityId) {
    openCityId = cityId;
    sel.cityId = cityId;
    sel.unitId = null;
    const city = session.state.cities[cityId];
    renderer.setSelection({ tile: { x: city.x, y: city.y } });
    renderer.centerOn(city.x, city.y);
    closeStackPanel();
    researchPanel.classList.add('hidden');
    fillCityPanel();
    cityPanel.classList.remove('hidden');
  }

  function closeCityPanel() {
    openCityId = null;
    cityPanel.classList.add('hidden');
  }

  function setProduction(city, item, closeAfter) {
    const res = session.apply({ type: 'setProduction', playerId: HUMAN, cityId: city.id, item });
    if (!res.ok) ctx.hud.note(`✗ setProduction: ${res.reason}`);
    else if (closeAfter) closeCityPanel();
  }

  function fillCityPanel() {
    const state = session.state;
    const city = state.cities[openCityId];
    if (!city || city.owner !== HUMAN) { closeCityPanel(); return; }
    document.getElementById('city-title').textContent =
      `🏛 ${city.name} — pop ${city.pop} (${state.players[city.owner].name})`;

    const worked = workedTiles(state, city, session.ruleset);
    const totals = { food: 0, shields: 0, trade: 0 };
    for (const w of worked) {
      totals.food += w.yields.food; totals.shields += w.yields.shields; totals.trade += w.yields.trade;
    }
    const surplus = totals.food - city.pop * 2;
    const threshold = 10 * (city.pop + 1);
    const def = itemDef(city.producing);
    const idle = city.pop - (worked.length - 1);
    const stats = document.getElementById('city-stats');
    stats.innerHTML =
      `<div>yields ${yieldsHtml(totals.food, totals.shields, totals.trade)} `
      + `(<span class="yf">food</span>/<span class="ys">shields</span>/<span class="yt">trade</span>)</div>`
      + `<div>🌾 eaten ${city.pop * 2} → surplus <span class="yf">${surplus >= 0 ? '+' : ''}${surplus}</span>/turn `
      + `· box ${city.food}/${threshold}</div>`
      + `<div class="grow">${surplus > 0
        ? `population grows in ~${Math.max(1, Math.ceil((threshold - city.food) / surplus))} turns` : 'no growth'}</div>`
      + `<div>building: ${def.name} <span class="ys">${city.shields}/${def.cost}</span>`
      + (totals.shields > 0 ? ` (~${Math.max(1, Math.ceil((def.cost - city.shields) / totals.shields))} turns)` : '')
      + '</div>'
      + `<div>${(city.buildings || []).length
        ? 'built: ' + (city.buildings || []).map(b => buildings[b].name).join(', ')
        : 'no buildings yet'}</div>`
      + `<div>${city.workers !== undefined
        ? '👷 manual tile assignment — click tiles below'
        : '👷 automatic tile assignment — click a tile to take over'}`
      + (idle > 0 ? ` · <span class="loss">💤 ${idle} idle citizen${idle > 1 ? 's' : ''}</span>` : '')
      + '</div>';

    // 5x5 workable area, city at the center; clicking tiles reassigns workers
    const map = document.getElementById('city-map');
    map.textContent = '';
    const isWorked = {};
    for (const w of worked) isWorked[`${w.x},${w.y}`] = true;

    function toggleWorker(idx) {
      const current = city.workers !== undefined
        ? city.workers.slice()
        : worked.filter(w => !w.center).map(w => w.y * state.map.width + w.x);
      const at = current.indexOf(idx);
      if (at !== -1) {
        current.splice(at, 1);
      } else if (current.length >= city.pop) {
        ctx.hud.note('💤 no free citizens — unassign a worked tile first');
        return;
      } else {
        current.push(idx);
      }
      const res = session.apply({ type: 'setWorkers', playerId: HUMAN, cityId: city.id, workers: current });
      if (!res.ok) ctx.hud.note(`✗ setWorkers: ${res.reason}`);
    }

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cell = document.createElement('div');
        cell.className = 'ctile';
        let x = city.x + dx;
        const y = city.y + dy;
        if (state.map.wrapX) x = ((x % state.map.width) + state.map.width) % state.map.width;
        if ((Math.abs(dx) === 2 && Math.abs(dy) === 2) || y < 0 || y >= state.map.height) {
          cell.className += ' corner';
          map.appendChild(cell);
          continue;
        }
        const tile = state.map.tiles[y * state.map.width + x];
        cell.style.background = terrainColor(tile.t);
        if (tile.river) cell.style.boxShadow = 'inset 0 0 0 2px #3a7ac8';
        if (isWorked[`${x},${y}`]) cell.className += ' worked';
        if (dx === 0 && dy === 0) cell.className += ' center';
        else {
          const ty = tileYields(tile, session.ruleset); // includes improvement bonuses
          cell.innerHTML = (tile.special ? '★' : '') + yieldsHtml(ty.food, ty.shields, ty.trade);
          cell.className += ' assignable';
          const idx = y * state.map.width + x;
          cell.addEventListener('click', () => toggleWorker(idx));
        }
        cell.title = `(${x},${y}) ${tile.t}` + (dx === 0 && dy === 0 ? '' : ' — click to (un)assign a worker');
        map.appendChild(cell);
      }
    }

    // reset to automatic placement
    let resetBtn = document.getElementById('workers-reset');
    if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.id = 'workers-reset';
      resetBtn.className = 'option';
      map.parentElement.appendChild(resetBtn);
    }
    resetBtn.textContent = '↺ reset to automatic assignment';
    resetBtn.style.display = city.workers !== undefined ? 'block' : 'none';
    resetBtn.onclick = () => {
      session.apply({ type: 'setWorkers', playerId: HUMAN, cityId: city.id, auto: true });
    };

    // production choices — click selects, double-click selects and closes;
    // tech-locked items are shown greyed with their prerequisite
    const prodEl = document.getElementById('city-production');
    prodEl.textContent = '';
    const me = state.players[HUMAN];
    // switching category forfeits half the shields (Civ 1), so the ETA differs
    const eta = (cost, kind) => {
      if (totals.shields <= 0) return '';
      const carried = city.producing.kind === kind ? city.shields : Math.floor(city.shields / 2);
      return ` ~${Math.max(1, Math.ceil((cost - carried) / totals.shields))}t`;
    };
    const addGroup = (title) => {
      const h = document.createElement('div');
      h.className = 'group-title';
      h.textContent = title;
      prodEl.appendChild(h);
    };
    const addOption = (item, label, sub) => {
      const btn = document.createElement('button');
      btn.className = 'option'
        + (city.producing.kind === item.kind && city.producing.id === item.id ? ' current' : '');
      btn.innerHTML = label + (sub ? `<div class="fx">${sub}</div>` : '');
      btn.addEventListener('click', () => setProduction(city, item, false));
      btn.addEventListener('dblclick', () => setProduction(city, item, true));
      prodEl.appendChild(btn);
    };
    const addLocked = (label, techId) => {
      const btn = document.createElement('button');
      btn.className = 'option locked';
      btn.disabled = true;
      btn.innerHTML = `🔒 ${label}<div class="fx">needs ${techs[techId].name}</div>`;
      prodEl.appendChild(btn);
    };
    const byTechLevel = (a, b, set) =>
      techs[set[a].tech].level - techs[set[b].tech].level || (a < b ? -1 : 1);

    addGroup('units');
    const lockedUnits = [];
    for (const id of Object.keys(units).sort()) {
      const u = units[id];
      if (u.tech !== '' && !me.techs.includes(u.tech)) { lockedUnits.push(id); continue; }
      addOption({ kind: 'unit', id },
        `${u.name} · <span class="ys">${u.cost}⚒${eta(u.cost, 'unit')}</span> · ${u.attack}/${u.defense}/${u.moves}`);
    }
    for (const id of lockedUnits.sort((a, b) => byTechLevel(a, b, units))) {
      addLocked(`${units[id].name} · ${units[id].cost}⚒ · ${units[id].attack}/${units[id].defense}/${units[id].moves}`, units[id].tech);
    }

    addGroup('buildings');
    const lockedBuildings = [];
    for (const id of Object.keys(buildings).sort()) {
      const b = buildings[id];
      if ((city.buildings || []).includes(id)) continue;
      if (b.tech !== '' && !me.techs.includes(b.tech)) { lockedBuildings.push(id); continue; }
      addOption({ kind: 'building', id },
        `${b.name} · <span class="ys">${b.cost}⚒${eta(b.cost, 'building')}</span> · upkeep ${b.maintenance}`,
        effectText(b) || 'no effect implemented yet');
    }
    for (const id of lockedBuildings.sort((a, b) => byTechLevel(a, b, buildings))) {
      addLocked(`${buildings[id].name} · ${buildings[id].cost}⚒`, buildings[id].tech);
    }

    addGroup('wonders');
    const lockedWonders = [];
    for (const id of Object.keys(wonders).sort()) {
      const w = wonders[id];
      if (session.state.wonders && session.state.wonders[id] !== undefined) continue;
      if (w.tech !== '' && !me.techs.includes(w.tech)) { lockedWonders.push(id); continue; }
      addOption({ kind: 'wonder', id },
        `${w.name} · <span class="ys">${w.cost}⚒${eta(w.cost, 'wonder')}</span>`,
        effectText(w) || `prestige — score +${session.ruleset.rules.scorePerWonder}`);
    }
    for (const id of lockedWonders.sort((a, b) => byTechLevel(a, b, wonders))) {
      addLocked(`${wonders[id].name} · ${wonders[id].cost}⚒`, wonders[id].tech);
    }
  }

  // --- stack panel (units on one tile) ----------------------------------------
  function openStackPanel(x, y) {
    stackTile = { x, y };
    fillStackPanel();
  }

  function closeStackPanel() {
    stackTile = null;
    stackPanel.classList.add('hidden');
  }

  function fillStackPanel() {
    if (!stackTile) return;
    const state = session.state;
    const mine = unitsAt(state, stackTile.x, stackTile.y)
      .filter(u => u.owner === HUMAN);
    if (mine.length === 0) { closeStackPanel(); return; }
    // the selected unit moved away: follow it out and close the list
    if (sel.unitId && !mine.some(u => u.id === sel.unitId)) { closeStackPanel(); return; }

    const tile = state.map.tiles[stackTile.y * state.map.width + stackTile.x];
    const cityHere = cityAt(state, stackTile.x, stackTile.y);
    document.getElementById('stack-title').textContent = cityHere
      ? `units in ${cityHere.name} (${tile.t} tile)`
      : `units on this ${tile.t} tile`;

    const list = document.getElementById('stack-list');
    list.textContent = '';
    mine.forEach((u, i) => {
      const t = units[u.type];
      const btn = document.createElement('button');
      btn.className = 'option' + (sel.unitId === u.id ? ' current' : '');
      btn.textContent = `${i + 1}. ${t.name} ${t.attack}/${t.defense}/${t.moves}`
        + (u.veteran ? ' ·vet' : '') + (u.fortified ? ' ·fort' : '') + ` · moves ${u.moves}`;
      btn.addEventListener('click', () => {
        ctx.selectUnit(u, { keepStack: true });
        fillStackPanel();
      });
      list.appendChild(btn);
    });

    const cityBtn = document.getElementById('stack-city');
    if (cityHere && cityHere.owner === HUMAN) {
      cityBtn.classList.remove('hidden');
      cityBtn.onclick = () => openCityPanel(cityHere.id);
    } else {
      cityBtn.classList.add('hidden');
    }
    stackPanel.classList.remove('hidden');
  }

  // --- city-name dialog --------------------------------------------------------
  const nameDialog = document.getElementById('name-dialog');
  const nameInput = document.getElementById('name-input');
  let nameConfirm = null;

  function openNameDialog(suggestion, onConfirm) {
    nameConfirm = onConfirm;
    nameInput.value = suggestion;
    nameDialog.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  }

  function closeNameDialog() {
    nameConfirm = null;
    nameDialog.classList.add('hidden');
  }

  document.getElementById('name-ok').addEventListener('click', () => {
    const name = nameInput.value.trim();
    const cb = nameConfirm;
    closeNameDialog();
    if (cb && name) cb(name);
  });
  document.getElementById('name-cancel').addEventListener('click', closeNameDialog);
  nameInput.addEventListener('keydown', e => {
    e.stopPropagation(); // keep game hotkeys out of the text field
    if (e.key === 'Enter') document.getElementById('name-ok').click();
    if (e.key === 'Escape') closeNameDialog();
  });

  // --- chrome -----------------------------------------------------------------
  document.getElementById('research-bar').addEventListener('click', toggleResearchPanel);
  startBtn.addEventListener('click', () => startResearch(chosenTech));
  // tax/science split: the slider position is the science share (10% steps)
  document.getElementById('rate-slider').addEventListener('change', e => {
    const sci = parseInt(e.target.value, 10);
    const res = session.apply({ type: 'setRates', playerId: HUMAN, tax: 100 - sci, sci });
    if (!res.ok) ctx.hud.note(`✗ setRates: ${res.reason}`);
  });
  document.getElementById('city-close').addEventListener('click', closeCityPanel);
  for (const btn of document.querySelectorAll('.panel-close')) {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.close).classList.add('hidden');
      if (btn.dataset.close === 'city-panel') openCityId = null;
    });
  }

  function closeAll() {
    closeCityPanel();
    closeStackPanel();
    closeNameDialog();
    researchPanel.classList.add('hidden');
  }

  // keep open panels current after every state change
  function refresh() {
    if (openCityId) fillCityPanel();
    if (stackTile) fillStackPanel();
    if (!researchPanel.classList.contains('hidden')) fillResearchPanel();
  }

  return {
    openCityPanel, closeCityPanel, toggleResearchPanel,
    openStackPanel, closeStackPanel, openNameDialog, closeAll, refresh,
    isCityOpen: () => openCityId !== null
  };
}

// Overlay panels: research, city view, and the tile-stack unit list.
import { availableTechs, researchCost } from '../../engine/tech.js';
import { workedTiles, candidateTiles, tileYields, itemCost, cityYields, effectPct, wonderActive } from '../../engine/cities.js';
import { governmentOf } from '../../engine/government.js';
import { cityMood } from '../../engine/happiness.js';
import { unitsAt, cityAt } from '../../engine/combat.js';
import { terrainColor } from '../renderer/renderer.js';
import { makeCatalogText } from './catalog-text.js';
import { UNIT_BLURBS, BUILDING_BLURBS } from './unit-building-blurbs.js';

export function initPanels(ctx) {
  const { session, renderer, sel } = ctx;
  const { techs, units, buildings, wonders } = session.ruleset;
  const researchPanel = document.getElementById('research-panel');
  const cityPanel = document.getElementById('city-panel');
  const stackPanel = document.getElementById('stack-panel');
  const startBtn = document.getElementById('research-start');

  let openCityId = null;
  let chosenTech = null;
  let stackTile = null;
  // A97: sell needs a two-step confirm; the armed building survives the
  // re-render between the two clicks (key = cityId:building, short window)
  let sellConfirm = { key: null, until: 0 };

  // Double-clicks can't be caught with 'dblclick': the first click re-renders
  // the option list, so the second click lands on a fresh element. Detect
  // repeats by key + time instead.
  let lastOptionClick = { key: '', at: 0 };
  function isDoubleClick(key) {
    const now = Date.now();
    const dbl = lastOptionClick.key === key && now - lastOptionClick.at < 450;
    lastOptionClick = { key: dbl ? '' : key, at: now };
    return dbl;
  }

  // yields as color-coded food/shields/trade spans
  function yieldsHtml(f, s, t) {
    return `<span class="yf">${f}</span>/<span class="ys">${s}</span>/<span class="yt">${t}</span>`;
  }

  // C2 (specs/civ24-features-proposal.md §2): breakdown tooltips ride native
  // title attributes (multi-line via \n; the mobile long-press surrogate is
  // the T-plan's). attr() escapes a tooltip string into a title="…" chunk.
  function attr(text) {
    const s = String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return ` title="${s}"`;
  }

  // A58a: the effect renderer + tech cross-link maps live in the pure
  // catalog-text module now (shared with the A58b pedia + a Roblox port).
  const { effectText, techUnlocks, techLeadsTo } = makeCatalogText(session.ruleset);

  // XIV §22: resolve a unit/building/wonder NAME (as techUnlocks lists them) back
  // to its def + kind, so the research panel can linkify each unlock name to a
  // shared hover-card pedia summary. Built once from the ruleset.
  const entityByName = {};
  for (const id of Object.keys(units)) entityByName[units[id].name] = { def: units[id], kind: 'unit', id };
  for (const id of Object.keys(buildings)) entityByName[buildings[id].name] = { def: buildings[id], kind: 'building', id };
  for (const id of Object.keys(wonders)) entityByName[wonders[id].name] = { def: wonders[id], kind: 'wonder', id };
  function entitySummaryCard(ent) {
    const { def, kind, id } = ent;
    const card = document.createElement('div');
    const t = document.createElement('span'); t.className = 'hover-title'; t.textContent = def.name;
    const k = document.createElement('div'); k.className = 'hover-kind'; k.textContent = kind;
    card.append(t, k);
    const stats = document.createElement('div');
    stats.textContent = kind === 'unit'
      ? `⚔${def.attack} 🛡${def.defense} 👟${def.moves} · ${def.cost} shields`
      : ((effectText(def) ? effectText(def) + ' · ' : '') + `${def.cost} shields`);
    card.appendChild(stats);
    const blurb = kind === 'unit' ? UNIT_BLURBS[id] : kind === 'building' ? BUILDING_BLURBS[id] : null;
    if (blurb) { const bl = document.createElement('div'); bl.style.marginTop = '4px'; bl.textContent = blurb; card.appendChild(bl); }
    return card;
  }
  // append `unlocks A, B` to a .fx line with each entity name a pedia hover-link
  function appendUnlocks(fx, unlocks) {
    fx.appendChild(document.createTextNode('unlocks '));
    unlocks.forEach((name, i) => {
      if (i > 0) fx.appendChild(document.createTextNode(', '));
      const ent = entityByName[name.replace(/\s*🏆\s*$/, '')]; // wonders carry a 🏆 mark
      if (!ent) { fx.appendChild(document.createTextNode(name)); return; }
      const link = document.createElement('span');
      link.className = 'pedia-link';
      link.textContent = name;
      link.addEventListener('mouseenter', () => { if (ctx.hoverCard) ctx.hoverCard.showAtEl(link, entitySummaryCard(ent)); });
      link.addEventListener('mouseleave', () => { if (ctx.hoverCard) ctx.hoverCard.hide(); });
      fx.appendChild(link);
    });
  }

  // --- research panel --------------------------------------------------------
  async function startResearch(techId) {
    if (!techId) return;
    const res = await session.apply({ type: 'setResearch', playerId: ctx.HUMAN, tech: techId });
    if (res.ok) {
      chosenTech = null;
      researchPanel.classList.add('hidden');
    } else {
      ctx.hud.note(`✗ setResearch: ${res.reason}`);
    }
  }

  function fillResearchPanel() {
    const state = session.state;
    const me = state.players[ctx.HUMAN];
    const cost = researchCost(state, ctx.HUMAN, session.ruleset);
    document.getElementById('research-summary').textContent =
      `${me.techs.length}/${Object.keys(techs).length} advances known · `
      + `${me.bulbs || 0} bulbs · next costs ${cost}`;

    const tax = me.taxRate === undefined ? session.ruleset.rules.defaultTaxRate : me.taxRate;
    const sci = me.sciRate === undefined ? session.ruleset.rules.defaultSciRate : me.sciRate;
    const lux = me.luxRate === undefined ? 0 : me.luxRate;
    document.getElementById('rate-tax').textContent = `💰 tax ${tax}%`;
    document.getElementById('rate-sci').textContent = `sci ${sci}% 🔬`;
    document.getElementById('rate-lux').textContent = `🎭 lux ${lux}%`;
    const slider = document.getElementById('rate-slider');
    slider.max = 100 - lux;
    slider.value = sci;

    // government: current + revolution options for known techs
    const govRow = document.getElementById('gov-row');
    govRow.textContent = '';
    const governments = session.ruleset.governments;
    const current = me.government === undefined ? 'despotism' : me.government;
    const label = document.createElement('span');
    label.id = 'gov-label';
    const myCiv = me.civ !== undefined && session.ruleset.civs ? session.ruleset.civs[me.civ] : undefined;
    const specialty = myCiv && myCiv.specialty ? ` · ★ ${myCiv.specialty.blurb}` : '';
    label.textContent = (me.revolutionTurns !== undefined
      ? `⚡ Anarchy — ${me.revolutionTurns} turn${me.revolutionTurns > 1 ? 's' : ''} until ${governments[me.pendingGovernment].name}`
      : `🏛 ${governments[current].name} (rates ≤ ${governments[current].maxRate}%)`)
      + specialty + ' · ';
    govRow.appendChild(label);
    if (me.revolutionTurns === undefined) {
      for (const id of Object.keys(governments)) {
        if (id === 'anarchy' || id === current) continue;
        const gov = governments[id];
        if (gov.tech !== '' && !me.techs.includes(gov.tech)) continue;
        const btn = document.createElement('button');
        btn.className = 'gov-btn';
        btn.textContent = `→ ${gov.name}`;
        btn.title = 'start a revolution (a few turns of Anarchy first)';
        btn.addEventListener('click', () =>
          ctx.apply({ type: 'setGovernment', playerId: ctx.HUMAN, government: id }));
        govRow.appendChild(btn);
      }
    }

    const list = document.getElementById('research-list');
    list.textContent = '';
    const avail = availableTechs(state, ctx.HUMAN, session.ruleset)
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
      if (unlocks.length || leads.length) {
        const fx = document.createElement('div');
        fx.className = 'fx';
        // XIV §22: each unlocked unit/building/wonder name is a pedia hover-link
        if (unlocks.length) appendUnlocks(fx, unlocks);
        if (leads.length) {
          fx.appendChild(document.createTextNode((unlocks.length ? ' · ' : '')
            + `→ ${leads.slice(0, 3).join(', ')}${leads.length > 3 ? '…' : ''}`));
        }
        btn.appendChild(fx);
      }
      btn.addEventListener('click', () => {
        if (isDoubleClick('tech:' + id)) { startResearch(id); return; }
        chosenTech = id;
        startBtn.disabled = false;
        fillResearchPanel();
      });
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
    if (ctx.SPECTATOR) { ctx.hud.note('👁 spectating — no research of your own'); return; }
    if (researchPanel.classList.contains('hidden')) {
      chosenTech = null;
      fillResearchPanel();
      researchPanel.classList.remove('hidden');
      closeCityPanel();
      if (ctx.advice) ctx.advice.offer('tech-choice'); // A78
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
    if (ctx.advice && city && city.owner === ctx.HUMAN) ctx.advice.offer('city-view'); // A78
  }

  function closeCityPanel() {
    openCityId = null;
    cityPanel.classList.add('hidden');
  }

  // ‹ › arrows (and ←/→ keys) walk your cities in founding order
  function cycleCity(dir) {
    const state = session.state;
    const mine = state.cityOrder.filter(id => state.cities[id] && state.cities[id].owner === ctx.HUMAN);
    if (mine.length === 0) return;
    const idx = mine.indexOf(openCityId);
    openCityPanel(mine[((idx === -1 ? 0 : idx) + dir + mine.length) % mine.length]);
  }
  document.getElementById('city-prev').addEventListener('click', () => cycleCity(-1));
  document.getElementById('city-next').addEventListener('click', () => cycleCity(1));

  async function setProduction(city, item, closeAfter) {
    const res = await session.apply({ type: 'setProduction', playerId: ctx.HUMAN, cityId: city.id, item });
    if (!res.ok) ctx.hud.note(`✗ setProduction: ${res.reason}`);
    else if (closeAfter) closeCityPanel();
  }

  // A97: the built-buildings line, with a per-row sell affordance (A86's
  // sellBuilding). Palace has no sell; buttons appear only on the owner's turn
  // and disable once the city has sold this turn — the soldThisTurn view-side
  // mirror keeps the button and the engine gate in agreement (the A90 lesson).
  function buildBuiltList(city, state) {
    const built = city.buildings || [];
    if (built.length === 0) return 'no buildings yet';
    const canSell = state.activePlayer === ctx.HUMAN && state.gameOver !== true;
    const ratio = session.ruleset.rules.sellPriceRatio;
    const sold = city.soldThisTurn === true;
    const rows = built.map(b => {
      const name = buildings[b].name;
      const isPalace = buildings[b].effect !== undefined && buildings[b].effect.isPalace === true;
      if (!canSell || isPalace) return `<span class="bldg">${name}</span>`;
      const price = buildings[b].cost * ratio;
      const armed = sellConfirm.key === city.id + ':' + b && Date.now() <= sellConfirm.until;
      const label = armed ? `Confirm? 💰${price}` : `💰 Sell ${price}`;
      const title = sold ? 'already sold a building this turn' : `sell ${name} for ${price} gold`;
      return `<span class="bldg">${name} <button class="sell-btn${armed ? ' armed' : ''}"`
        + ` data-b="${b}"${sold ? ' disabled' : ''} title="${title}">${label}</button></span>`;
    });
    return 'built: ' + rows.join(' ');
  }

  // A89 (specs/n10-caravans.md): the engine's route-report export, probed at
  // init — the per-route arrows + top-3 ranking are ENGINE math (R1 base-arrow
  // exclusion, live recompute, deterministic tiebreak); the client never
  // re-derives them. Seam CONFIRMED by the N10 window (bugfixer #1417):
  //   engine/trade.js tradeRouteReport(state, city, ruleset)
  //     -> [{ partnerCityId, arrows, counted }] (all routes, state order)
  // The dynamic probe tolerates checkouts where trade.js or the export does
  // not exist yet — the panel shows partners without arrows until it does.
  let routeMath = null;
  import('../../engine/trade.js').then(m => { if (m.tradeRouteReport) routeMath = m; }).catch(() => {});
  function routesHtml(state, city) {
    const routes = city.tradeRoutes;
    if (routes === undefined || routes.length === 0) return '';
    const report = routeMath ? routeMath.tradeRouteReport(state, city, session.ruleset) : null;
    const rows = routes.map(r => {
      const p = state.cities[r.partnerCityId];
      const name = p ? p.name : r.partnerCityId;
      const foreign = p && p.owner !== city.owner;
      const rep = report ? report.find(x => x.partnerCityId === r.partnerCityId) : null;
      const arrows = rep ? ` <span class="yt">+${rep.arrows}</span>` : '';
      const extra = rep && rep.counted === false ? ' <span class="route-extra">(beyond top 3)</span>' : '';
      return `${name}${foreign ? ' 🏳' : ''}${arrows}${extra}`;
    });
    return `<div id="city-routes">🐫 trade routes: ${rows.join(' · ')}</div>`;
  }

  // C3: the city's build queue — client-side list over logged setProduction
  // commands (ui/build-queue.js owns storage + the advance-on-completion)
  function renderQueue(city) {
    const host = document.getElementById('city-queue');
    if (!host || !ctx.buildQueue) return;
    const q = ctx.buildQueue.get(city.id);
    if (q.length === 0) {
      host.innerHTML = '<span class="queue-hint">⏭ queue: empty — shift-click a production item to queue it</span>';
      return;
    }
    host.innerHTML = '⏭ queue: ' + q.map((it, i) =>
      `<span class="queue-item">${i + 1}. ${ctx.buildQueue.itemName(it)}`
      + `<button class="queue-btn" data-qmove="-1" data-qi="${i}" title="earlier">↑</button>`
      + `<button class="queue-btn" data-qmove="1" data-qi="${i}" title="later">↓</button>`
      + `<button class="queue-btn" data-qdrop="${i}" title="remove">✕</button></span>`).join(' ');
    host.querySelectorAll('.queue-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.qdrop !== undefined) ctx.buildQueue.removeAt(city.id, Number(b.dataset.qdrop));
      else ctx.buildQueue.move(city.id, Number(b.dataset.qi), Number(b.dataset.qmove));
      renderQueue(city);
    }));
  }

  function fillCityPanel() {
    const state = session.state;
    const city = state.cities[openCityId];
    if (!city || city.owner !== ctx.HUMAN) { closeCityPanel(); return; }
    const title = document.getElementById('city-title');
    title.textContent = `🏛 ${city.name} — pop ${city.pop} (${state.players[city.owner].name})`;
    // faction emblem chip (art A1.6a): the owner's flag from data/civs.json
    const ownerCiv = state.players[city.owner].civ;
    const visual = ownerCiv && session.ruleset.civs[ownerCiv] && session.ruleset.civs[ownerCiv].visual;
    if (visual) {
      import('../renderer/three/factions.js').then(m => {
        const img = document.createElement('img');
        img.src = m.emblemDataUrl(visual);
        img.style.cssText = 'width:18px;height:18px;vertical-align:-3px;margin-right:6px;border-radius:3px;';
        title.prepend(img);
      });
    }

    const worked = workedTiles(state, city, session.ruleset);
    const totals = { food: 0, shields: 0, trade: 0 };
    for (const w of worked) {
      totals.food += w.yields.food; totals.shields += w.yields.shields; totals.trade += w.yields.trade;
    }
    // XIV §45: settler food upkeep is REAL (engine cities.js:551) but the panel
    // used to omit it — the Teotihuacan trap ("+2/turn, grows in ~10" while 4
    // homed settlers starved the city to −2). Count settlers homed HERE and
    // subtract, so the net the player reads is the truth the engine applies.
    const settlerUpkeep = session.ruleset.rules.settlerFoodUpkeep === undefined
      ? 0 : session.ruleset.rules.settlerFoodUpkeep;
    let settlerCount = 0;
    if (settlerUpkeep > 0) {
      for (const uid of Object.keys(state.units)) {
        const u = state.units[uid];
        if (u.home === city.id && u.type === 'settlers') settlerCount += 1;
      }
    }
    const settlerFood = settlerCount * settlerUpkeep;
    const surplus = totals.food - city.pop * 2 - settlerFood;
    const threshold = 10 * (city.pop + 1);
    const def = itemDef(city.producing);
    // the civ-effective cost (specialties discount some units/buildings)
    const defCost = itemCost(city.producing.kind, city.producing.id, def,
      state.players[city.owner], session.ruleset);
    const mood = cityMood(state, city, session.ruleset);
    const canSpecialize = mood.entertainers > 0 && city.pop >= 5;
    // the worker set as tile indices (manual when set, else the greedy picks)
    const currentWorkerIdx = () => city.workers !== undefined
      ? city.workers.slice()
      : worked.filter(w => !w.center).map(w => w.y * state.map.width + w.x);
    // rush-buy: flat gold per missing shield (wonders cost more)
    const missing = defCost - city.shields;
    const buyRate = city.producing.kind === 'wonder'
      ? session.ruleset.rules.buyGoldPerShieldWonder : session.ruleset.rules.buyGoldPerShield;
    const buyPrice = missing * buyRate;
    const canBuy = missing > 0 && state.players[ctx.HUMAN].gold >= buyPrice;
    const buyHtml = missing > 0
      ? ` <button id="city-buy"${canBuy ? '' : ' disabled'} title="finish it now for gold">💰 Buy ${buyPrice}</button>`
      : '';
    // C2: breakdown tooltips, built from the SAME engine calls the panel
    // renders from (display math, not authority — never a re-run pipeline)
    const rules = session.ruleset.rules;
    const tileLines = worked.map(w => {
      const t = state.map.tiles[w.y * state.map.width + w.x];
      return `(${w.x},${w.y}) ${t.t}${t.special ? '★' : ''}${w.center ? ' — city square' : ''}: `
        + `${w.yields.food}/${w.yields.shields}/${w.yields.trade}`;
    });
    const yieldsTip = 'worked tiles (food/shields/trade):\n' + tileLines.join('\n')
      + `\ntotal ${totals.food}/${totals.shields}/${totals.trade}`;
    const foodTip = `each citizen eats 2 food: ${city.pop} × 2 = ${city.pop * 2}`
      + (settlerFood > 0
        ? `\neach settler homed here eats ${settlerUpkeep} food/turn: ${settlerCount} × ${settlerUpkeep} = ${settlerFood}`
          + `\nrehome or expend settlers to free food`
        : '')
      + `\nnet = ${totals.food} − ${city.pop * 2}${settlerFood > 0 ? ` − ${settlerFood}` : ''} = ${surplus}`
      + `\nthe surplus fills the box; the city grows at ${threshold} (10 × (pop + 1))`;
    const prodTip = `${totals.shields} shields/turn from the worked tiles`
      + `\ncost ${defCost} shields${buyHtml ? `\nrush-buy at ${buyRate} gold per missing shield` : ''}`;
    const gov = governmentOf(state, city.owner, session.ruleset);
    const owner = state.players[city.owner];
    const luxRate = owner.luxRate === undefined ? 0 : owner.luxRate;
    let lux = Math.floor(cityYields(state, city, session.ruleset).trade * luxRate / 100);
    lux += Math.floor(lux * effectPct(city, session.ruleset, 'luxBonus') / 100);
    lux += mood.entertainers * rules.specialistOutput;
    // B2 (Oracle×4 legibility): show each calming building's REAL contribution
    // for this city — base contentBonus, ×2 if its contentDoubleTech is known
    // (Mysticism), ×2 again if this civ owns the active Oracle (Temple only).
    // Mirrors engine/happiness.js so "Temple +4" reads exactly what applies.
    const templeOracle = wonderActive(state, 'oracle', session.ruleset)
      && state.cities[(state.wonders || {})['oracle']]
      && state.cities[state.wonders['oracle']].owner === city.owner;
    const contentOf = b => {
      const eff = session.ruleset.buildings[b].effect;
      let v = eff.contentBonus;
      if (eff.contentDoubleTech !== undefined && owner.techs.indexOf(eff.contentDoubleTech) !== -1) v = v * 2;
      if (b === 'temple' && templeOracle) v = v * 2;
      return v;
    };
    const moodBldgs = (city.buildings || [])
      .filter(b => session.ruleset.buildings[b].effect.contentBonus !== undefined)
      .map(b => `${session.ruleset.buildings[b].name} +${contentOf(b)}`);
    const moodWonders = Object.keys(state.wonders || {})
      .filter(wid => wonderActive(state, wid, session.ruleset)
        && state.cities[state.wonders[wid]] && state.cities[state.wonders[wid]].owner === city.owner)
      .filter(wid => {
        const e = session.ruleset.wonders[wid].effect || {};
        return e.happyBonus !== undefined || e.contentBonus !== undefined || e.allContent !== undefined;
      })
      .map(wid => session.ruleset.wonders[wid].name);
    const moodTip = 'mood factors (the engine computes the faces):'
      + `\nfirst ${rules.contentCitizens} workers are born content, the rest unhappy`
      + `\nluxuries ${lux} (${luxRate}% of trade + entertainers): one citizen up per ${rules.luxPerStep}`
      + (moodBldgs.length ? `\ncontent from buildings: ${moodBldgs.join(', ')}` : '')
      + (moodWonders.length ? `\nmood wonders: ${moodWonders.join(', ')}` : '')
      + (gov.warUnhappiness > 0 ? `\n${gov.name}: each military unit abroad upsets ${gov.warUnhappiness} citizen(s)` : '');
    const upkeepLines = (city.buildings || [])
      .map(b => `${buildings[b].name}: ${buildings[b].maintenance} gold/turn`);
    const upkeepTip = upkeepLines.length
      ? 'building upkeep:\n' + upkeepLines.join('\n') : 'no buildings, no upkeep';
    const stats = document.getElementById('city-stats');
    stats.innerHTML =
      `<div id="city-yields-row"${attr(yieldsTip)}>yields ${yieldsHtml(totals.food, totals.shields, totals.trade)} `
      + `(<span class="yf">food</span>/<span class="ys">shields</span>/<span class="yt">trade</span>)</div>`
      + `<div${attr(foodTip)}>🌾 ${totals.food} · 👥 eat ${city.pop * 2}`
      + (settlerFood > 0
        ? ` · <span class="loss" title="settlers homed here each eat ${settlerUpkeep} food/turn">⚒👤×${settlerCount} eat ${settlerFood}</span>`
        : '')
      + ` → net <span class="${surplus < 0 ? 'loss' : 'yf'}">${surplus >= 0 ? '+' : ''}${surplus}</span>/turn `
      + `· box ${city.food}/${threshold}</div>`
      + `<div class="grow">${surplus > 0
        ? `population grows in ~${Math.max(1, Math.ceil((threshold - city.food) / surplus))} turns`
        : (surplus < 0
          ? `⚠ starving (net ${surplus}/turn)${settlerFood > 0 ? ' — rehome or expend settlers to free food' : ''}`
          : '⚠ stalled — no growth')}</div>`
      + `<div${attr(prodTip)}>building: ${def.name}${city.producing.kind === 'unit' ? ' <span title="units repeat until you change production">∞</span>' : ''} <span class="ys">${city.shields}/${defCost}</span>`
      + (totals.shields > 0 ? ` (~${Math.max(1, Math.ceil((defCost - city.shields) / totals.shields))} turns)` : '')
      + buyHtml
      + '</div>'
      + `<div class="city-built"${attr(upkeepTip)}>${buildBuiltList(city, state)}</div>`
      + routesHtml(state, city) // A89: empty until routes exist in state
      + `<div>${city.workers !== undefined
        ? '👷 manual tile assignment — click tiles below'
        : '👷 automatic tile assignment — click a tile to take over'}</div>`
      + `<div id="city-mood-row"${attr(moodTip)}>mood <span class="yf">😊${mood.happy}</span> 😐${mood.content} <span class="loss">😠${mood.unhappy}</span>`
      + ` · 🎭${mood.entertainers} 💰${mood.taxmen} 🔬${mood.scientists}`
      + (canSpecialize ? ' <button class="spec-btn" id="spec-taxman" title="entertainer → taxman">🎭→💰</button>'
        + '<button class="spec-btn" id="spec-scientist" title="entertainer → scientist">🎭→🔬</button>' : '')
      + (mood.taxmen + mood.scientists > 0 ? ' <button class="spec-btn" id="spec-clear" title="all specialists back to entertainers">↺🎭</button>' : '')
      + '</div>'
      + (city.disorder === true // A68 (VIII.13): a loud banner, not a text line
        ? '<div class="disorder-banner">⚠ CIVIL DISORDER — no production or taxes until the mood improves</div>' : '');
    const buyBtn = document.getElementById('city-buy');
    if (buyBtn) {
      buyBtn.addEventListener('click', () =>
        ctx.apply({ type: 'buy', playerId: ctx.HUMAN, cityId: city.id }));
    }
    renderQueue(city); // C3
    // A97: two-step sell — first click arms (button survives the re-render via
    // sellConfirm), second click within the window emits sellBuilding
    for (const btn of stats.querySelectorAll('.sell-btn')) {
      btn.addEventListener('click', () => {
        const b = btn.getAttribute('data-b');
        const key = city.id + ':' + b;
        if (sellConfirm.key !== key || Date.now() > sellConfirm.until) {
          sellConfirm = { key, until: Date.now() + 4000 };
          btn.classList.add('armed');
          btn.textContent = `Confirm? 💰${buildings[b].cost * session.ruleset.rules.sellPriceRatio}`;
          return;
        }
        sellConfirm = { key: null, until: 0 };
        ctx.apply({ type: 'sellBuilding', playerId: ctx.HUMAN, cityId: city.id, building: b });
      });
    }
    const specCmd = (taxmen, scientists) => ctx.apply({
      type: 'setWorkers', playerId: ctx.HUMAN, cityId: city.id,
      workers: currentWorkerIdx(), taxmen, scientists
    });
    const taxBtn = document.getElementById('spec-taxman');
    if (taxBtn) taxBtn.addEventListener('click', () => specCmd(mood.taxmen + 1, mood.scientists));
    const sciBtn = document.getElementById('spec-scientist');
    if (sciBtn) sciBtn.addEventListener('click', () => specCmd(mood.taxmen, mood.scientists + 1));
    const clearBtn = document.getElementById('spec-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => specCmd(0, 0));

    // 5x5 workable area, city at the center; clicking tiles reassigns workers
    const map = document.getElementById('city-map');
    map.textContent = '';
    const isWorked = {};
    for (const w of worked) isWorked[`${w.x},${w.y}`] = true;

    async function toggleWorker(idx) {
      const current = currentWorkerIdx();
      const at = current.indexOf(idx);
      if (at !== -1) {
        current.splice(at, 1);
      } else if (current.length >= city.pop) {
        ctx.hud.note('💤 no free citizens — unassign a worked tile first');
        return;
      } else {
        current.push(idx);
      }
      const res = await session.apply({ type: 'setWorkers', playerId: ctx.HUMAN, cityId: city.id, workers: current });
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
        if (dx === 0 && dy === 0) {
          cell.className += ' center';
          // wave III catch-up: the city square yields as if roaded+irrigated
          // (engine rule) — show the REAL worked yields, not the raw tile
          const cy = worked[0].yields;
          cell.innerHTML = (tile.special ? '★' : '') + yieldsHtml(cy.food, cy.shields, cy.trade);
        } else {
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
      session.apply({ type: 'setWorkers', playerId: ctx.HUMAN, cityId: city.id, auto: true });
    };

    // production choices — click selects, double-click selects and closes;
    // tech-locked items are shown greyed with their prerequisite
    const prodEl = document.getElementById('city-production');
    prodEl.textContent = '';
    const me = state.players[ctx.HUMAN];
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
    const addOption = (item, label, sub, tip) => {
      const btn = document.createElement('button');
      btn.className = 'option'
        + (city.producing.kind === item.kind && city.producing.id === item.id ? ' current' : '');
      btn.innerHTML = label + (sub ? `<div class="fx">${sub}</div>` : '');
      if (tip) btn.title = tip; // Civilopedia flavor blurb on hover (P2/run-F #9)
      // second click on the same item = set + close (quick change);
      // C3: shift-click APPENDS to the city's build queue instead
      btn.addEventListener('click', ev => {
        if (ev.shiftKey && ctx.buildQueue) {
          ctx.buildQueue.add(city.id, item);
          renderQueue(city);
          return;
        }
        setProduction(city, item, isDoubleClick(`prod:${item.kind}:${item.id}`));
      });
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

    // A18 one-tech look-ahead: a locked item stays in the catalog only while
    // its tech sits on the RESEARCH FRONTIER (all prereqs known — the exact
    // availableTechs set, which includes the current research). Deeper items
    // hide entirely; each discovery advances the frontier and reveals the
    // next ring. No more battleships in the 4000 BC catalog.
    const frontier = {};
    for (const t of availableTechs(session.state, ctx.HUMAN, session.ruleset)) frontier[t] = true;

    addGroup('units');
    const lockedUnits = [];
    for (const id of Object.keys(units).sort()) {
      const u = units[id];
      // barb-only units (N13 barbleader) are never player-buildable — the
      // engine's setProduction rejects them; the catalog must not offer them
      // (they have tech:'' so the tech-lock filter below wouldn't catch them).
      if (u.barbOnly === true) continue;
      if (u.tech !== '' && !me.techs.includes(u.tech)) {
        if (frontier[u.tech]) lockedUnits.push(id);
        continue;
      }
      const cost = itemCost('unit', id, u, me, session.ruleset);
      addOption({ kind: 'unit', id },
        `${u.name} · <span class="ys">${cost}⚒${eta(cost, 'unit')}</span> · ${u.attack}/${u.defense}/${u.moves}`
        + (cost < u.cost ? ' <span class="yf">★</span>' : ''),
        undefined, UNIT_BLURBS[id]);
    }
    const hideFuture = ctx.options && ctx.options.get('hideFuture');
    if (!hideFuture) {
      for (const id of lockedUnits.sort((a, b) => byTechLevel(a, b, units))) {
        addLocked(`${units[id].name} · ${units[id].cost}⚒ · ${units[id].attack}/${units[id].defense}/${units[id].moves}`, units[id].tech);
      }
    }

    addGroup('buildings');
    const lockedBuildings = [];
    for (const id of Object.keys(buildings).sort()) {
      const b = buildings[id];
      if ((city.buildings || []).includes(id)) continue;
      if (b.tech !== '' && !me.techs.includes(b.tech)) {
        if (frontier[b.tech]) lockedBuildings.push(id); // A18 frontier filter
        continue;
      }
      const cost = itemCost('building', id, b, me, session.ruleset);
      addOption({ kind: 'building', id },
        `${b.name} · <span class="ys">${cost}⚒${eta(cost, 'building')}</span> · upkeep ${b.maintenance}`
        + (cost < b.cost ? ' <span class="yf">★</span>' : ''),
        effectText(b) || 'no effect implemented yet', BUILDING_BLURBS[id]);
    }
    if (!hideFuture) {
      for (const id of lockedBuildings.sort((a, b) => byTechLevel(a, b, buildings))) {
        addLocked(`${buildings[id].name} · ${buildings[id].cost}⚒`, buildings[id].tech);
      }
    }

    addGroup('wonders');
    const lockedWonders = [];
    for (const id of Object.keys(wonders).sort()) {
      const w = wonders[id];
      if (session.state.wonders && session.state.wonders[id] !== undefined) continue;
      if (w.tech !== '' && !me.techs.includes(w.tech)) {
        if (frontier[w.tech]) lockedWonders.push(id); // A18 frontier filter
        continue;
      }
      addOption({ kind: 'wonder', id },
        `${w.name} · <span class="ys">${w.cost}⚒${eta(w.cost, 'wonder')}</span>`,
        effectText(w) || `prestige — score +${session.ruleset.rules.scorePerWonder}`);
    }
    if (!hideFuture) {
      for (const id of lockedWonders.sort((a, b) => byTechLevel(a, b, wonders))) {
        addLocked(`${wonders[id].name} · ${wonders[id].cost}⚒`, wonders[id].tech);
      }
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
      .filter(u => u.owner === ctx.HUMAN);
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
    if (cityHere && cityHere.owner === ctx.HUMAN) {
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
  // tax/science slider (the science share of what luxuries leave over) and
  // the luxuries stepper (±10%, taken from/returned to tax first)
  function ratesOf() {
    const me = session.state.players[ctx.HUMAN];
    return {
      tax: me.taxRate === undefined ? session.ruleset.rules.defaultTaxRate : me.taxRate,
      sci: me.sciRate === undefined ? session.ruleset.rules.defaultSciRate : me.sciRate,
      lux: me.luxRate === undefined ? 0 : me.luxRate
    };
  }
  document.getElementById('rate-slider').addEventListener('change', async e => {
    const { lux } = ratesOf();
    const sci = Math.min(parseInt(e.target.value, 10), 100 - lux);
    const ok = await ctx.apply({ type: 'setRates', playerId: ctx.HUMAN, tax: 100 - lux - sci, sci, lux });
    // A29 (VI.10): a capped rate leaves state untouched and nothing redraws
    // — snap the thumb back to the real rate instead of where the drag died
    if (!ok) e.target.value = ratesOf().sci;
  });
  function nudgeLux(delta) {
    const r = ratesOf();
    let lux = r.lux + delta;
    if (lux < 0 || lux > 100) return;
    let tax = r.tax - delta;
    let sci = r.sci;
    if (tax < 0) { sci = sci + tax; tax = 0; }
    if (sci < 0) { lux = lux + sci; sci = 0; }
    ctx.apply({ type: 'setRates', playerId: ctx.HUMAN, tax, sci, lux });
  }
  document.getElementById('lux-minus').addEventListener('click', () => nudgeLux(-10));
  document.getElementById('lux-plus').addEventListener('click', () => nudgeLux(10));
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
    openCityPanel, closeCityPanel, toggleResearchPanel, cycleCity,
    openStackPanel, closeStackPanel, openNameDialog, closeAll, refresh,
    isCityOpen: () => openCityId !== null
  };
}

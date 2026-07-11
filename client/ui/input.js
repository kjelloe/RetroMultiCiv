// Input: renderer picks (select / move / attack / stacks) and the keyboard.
import { unitsAt, cityAt, attackStrength, defenseStrength, bestDefender } from '../../engine/combat.js';
import { candidateTiles, tileYields, wonderActive } from '../../engine/cities.js';
import { availableTechs } from '../../engine/tech.js';

const MOVE_KEYS = {
  w: 'N', ArrowUp: 'N',
  d: 'E', ArrowRight: 'E',
  s: 'S', ArrowDown: 'S',
  a: 'W', ArrowLeft: 'W'
};

export function initInput(ctx) {
  const { session, renderer, sel, panels, hud, HUMAN } = ctx;
  const { units, buildings, wonders } = session.ruleset;

  function describeTile(x, y) {
    const tile = session.state.map.tiles[y * session.state.map.width + x];
    const extras = (tile.river ? ' +river' : '') + (tile.special ? ' ★' : '');
    return `(${x},${y}) ${tile.t}${extras}`;
  }

  // "⚔ Favorable 67% — Legion 300 vs Militia 150 (mountains +200%, fortified +50%)"
  function combatPreview(attacker, x, y) {
    const state = session.state;
    const ruleset = session.ruleset;
    if (units[attacker.type].attack <= 0) return null;
    const defender = bestDefender(state, x, y, ruleset);
    if (!defender) return null;
    const att = attackStrength(attacker, ruleset);
    const def = defenseStrength(state, defender, ruleset);
    const pct = Math.round(att * 100 / (att + def));
    const word = pct >= 75 ? 'Strong' : pct >= 55 ? 'Favorable'
      : pct >= 45 ? 'Even' : pct >= 25 ? 'Risky' : 'Desperate';
    const parts = [];
    const tile = state.map.tiles[y * state.map.width + x];
    const terrainBonus = ruleset.terrain.terrains[tile.t].defenseBonus;
    if (terrainBonus > 0) parts.push(`${tile.t} +${terrainBonus}%`);
    if (tile.river) parts.push(`river +${ruleset.terrain.riverModifier.defenseBonus}%`);
    if (defender.fortified) parts.push('fortified +50%');
    if (attacker.veteran) parts.push('veteran attacker +50%');
    const city = cityAt(state, x, y);
    if (city) {
      const greatWallHome = state.wonders && state.cities[state.wonders['great-wall']];
      const walls = (city.buildings || []).indexOf('city-walls') !== -1
        || (wonderActive(state, 'great-wall', ruleset) && greatWallHome && greatWallHome.owner === city.owner);
      if (walls) parts.push('city walls ×3');
    }
    return `⚔ ${word} ${pct}% — ${units[attacker.type].name} ${att / 100} vs `
      + `${units[defender.type].name} ${def / 100}`
      + (parts.length ? ` (${parts.join(', ')})` : '');
  }

  // Rate the hovered tile as a city site: center + the 4 best workable tiles
  // (what the first citizens would actually work), scored like the engine.
  function sitePreview(x, y) {
    const state = session.state;
    const ruleset = session.ruleset;
    const tile = state.map.tiles[y * state.map.width + x];
    if (ruleset.terrain.terrains[tile.t].domain !== 'land') {
      return { text: '🏛 cannot settle at sea', tiles: null };
    }
    if (cityAt(state, x, y)) return { text: '🏛 a city already stands here', tiles: null };
    const candidates = candidateTiles(state, { x, y }, ruleset);
    const center = tileYields(tile, ruleset);
    let food = center.food, shields = center.shields, trade = center.trade;
    for (const c of candidates.slice(0, 4)) {
      food += c.yields.food; shields += c.yields.shields; trade += c.yields.trade;
    }
    const score = food * 3 + shields * 2 + trade;
    const word = score >= 38 ? 'Excellent' : score >= 30 ? 'Good' : score >= 22 ? 'Fair' : 'Poor';
    return {
      text: `🏛 ${word} site — food ${food} · shields ${shields} · trade ${trade}`
        + (tile.river ? ' · river' : ''),
      tiles: [{ x, y }].concat(candidates.map(c => ({ x: c.x, y: c.y })))
    };
  }

  function dirTo(unit, tx, ty) {
    const map = session.state.map;
    let dx = tx - unit.x;
    if (map.wrapX) {
      if (dx > 1) dx -= map.width;
      if (dx < -1) dx += map.width;
    }
    const dy = ty - unit.y;
    const key = { '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE', '0,1': 'S', '-1,1': 'SW', '-1,0': 'W', '-1,-1': 'NW' };
    return key[`${dx},${dy}`];
  }

  function describeEvents(events) {
    const state = session.state;
    for (const e of events) {
      if (e.type === 'combatResolved') {
        return e.winner === 'attacker'
          ? `⚔ attack succeeded (${e.unitsLost} enemy lost)`
          : '⚔ attack failed — unit lost';
      }
      if (e.type === 'cityCaptured') {
        return `🏰 ${state.cities[e.cityId].name} captured! (+${e.plunder} gold)`;
      }
      if (e.type === 'techDiscovered' && e.playerId === HUMAN) {
        return `🔬 ${session.ruleset.techs[e.tech].name} discovered!`;
      }
    }
    return null;
  }

  function apply(cmd) {
    const res = session.apply(cmd);
    if (res.ok) {
      if (sel.unitId && !session.state.units[sel.unitId]) sel.unitId = null;
      const note = describeEvents(res.events);
      if (note) hud.note(note);
    } else {
      hud.note(`✗ ${cmd.type}: ${res.reason}`);
    }
    return res.ok;
  }
  ctx.apply = apply;

  function moveSelected(dir) {
    if (!sel.unitId || !session.state.units[sel.unitId]) return;
    const unitId = sel.unitId;
    if (apply({ type: 'moveUnit', playerId: session.state.activePlayer, unitId, dir })) {
      sel.lastMoved = unitId;
      const moved = session.state.units[unitId];
      if (moved) hud.unitNote(moved);
    }
  }

  // next idle unit — skips fortified and working units unless selected by hand
  function nextUnit() {
    const movable = Object.values(session.state.units).filter(
      u => u.owner === HUMAN && u.moves > 0 && !u.fortified && !u.working && u.id !== sel.unitId
    );
    if (movable.length === 0) {
      hud.note('no units with moves left — E to end turn');
      return;
    }
    ctx.selectUnit(movable[0]);
    renderer.centerOn(movable[0].x, movable[0].y);
  }

  // new turn: return to the last-moved unit, else pick like N
  function autoSelectAfterTurn() {
    if (session.state.gameOver || session.state.activePlayer !== HUMAN) return;
    const last = sel.lastMoved && session.state.units[sel.lastMoved];
    if (last && last.owner === HUMAN && last.moves > 0 && !last.fortified && !last.working) {
      ctx.selectUnit(last);
      renderer.centerOn(last.x, last.y);
      return;
    }
    sel.unitId = null;
    nextUnit();
  }

  function endTurn() {
    panels.closeStackPanel();
    sel.cityId = null;
    const res = session.endTurn();
    if (!res.ok) { hud.note(`✗ endTurn: ${res.reason}`); return; }
    autoSelectAfterTurn();
    hud.refresh();
  }
  ctx.endTurn = endTurn;

  function foundCityFlow() {
    if (!sel.unitId) return;
    const unit = session.state.units[sel.unitId];
    if (!unit || unit.type !== 'settlers') {
      hud.note('✗ only settlers can found cities');
      return;
    }
    const unitId = unit.id;
    panels.openNameDialog(ctx.suggestCityName(), name => {
      if (apply({ type: 'foundCity', playerId: session.state.activePlayer, unitId, name })) {
        sel.unitId = null;
        panels.openCityPanel(session.state.cityOrder[session.state.cityOrder.length - 1]);
      }
    });
  }

  // --- renderer picks ---------------------------------------------------------
  let lastFootprintKey = null;
  renderer.onHover(pick => {
    let text = pick ? describeTile(pick.tile.x, pick.tile.y) : '';
    let attack = false;
    let footprint = null;
    const attacker = sel.unitId ? session.state.units[sel.unitId] : null;
    if (pick && attacker) {
      const hostiles = unitsAt(session.state, pick.tile.x, pick.tile.y)
        .filter(u => u.owner !== HUMAN);
      if (hostiles.length > 0) {
        // attack preview: red hover ring + odds line
        attack = true;
        const odds = combatPreview(attacker, pick.tile.x, pick.tile.y);
        if (odds) text += `\n${odds}`;
      } else if (attacker.type === 'settlers') {
        const site = sitePreview(pick.tile.x, pick.tile.y);
        text += `\n${site.text}`;
        footprint = site.tiles;
      }
    }
    hud.tile(text);
    renderer.setHoverColor(attack ? 0xff4433 : 0xffffff);
    // rebuild the footprint overlay only when the hovered tile changes
    const key = footprint ? `${pick.tile.x},${pick.tile.y}` : null;
    if (key !== lastFootprintKey) {
      lastFootprintKey = key;
      renderer.setFootprint(footprint);
    }
  });

  // double-click a city: open the city view even when units share the tile
  renderer.onDblPick(pick => {
    const city = cityAt(session.state, pick.tile.x, pick.tile.y);
    if (city && city.owner === HUMAN) panels.openCityPanel(city.id);
  });

  renderer.onPick(pick => {
    const state = session.state;
    const mineHere = unitsAt(state, pick.tile.x, pick.tile.y).filter(u => u.owner === HUMAN);
    if (mineHere.length > 0) {
      const clicked = (pick.unitId && state.units[pick.unitId] && state.units[pick.unitId].owner === HUMAN)
        ? state.units[pick.unitId] : mineHere[0];
      ctx.selectUnit(clicked, { keepStack: true });
      const cityHere = cityAt(state, pick.tile.x, pick.tile.y);
      // show the list for stacks, and always inside cities (it carries the
      // "Open city view" button there)
      if (mineHere.length > 1 || (cityHere && cityHere.owner === HUMAN)) {
        panels.openStackPanel(pick.tile.x, pick.tile.y);
      } else {
        panels.closeStackPanel();
      }
      return;
    }
    const city = pick.cityId ? state.cities[pick.cityId] : null;
    if (city && city.owner === state.activePlayer) {
      panels.openCityPanel(city.id);
      return;
    }
    if (sel.unitId && state.units[sel.unitId]) {
      const dir = dirTo(state.units[sel.unitId], pick.tile.x, pick.tile.y);
      if (dir) { moveSelected(dir); return; }
    }
    sel.unitId = null;
    sel.cityId = null;
    panels.closeStackPanel();
    hud.note(describeTile(pick.tile.x, pick.tile.y));
    renderer.setSelection({ tile: pick.tile });
  });

  // --- keyboard ----------------------------------------------------------------
  const PRODUCTION_KEYS = { 1: 'militia', 2: 'phalanx', 3: 'settlers' };

  document.getElementById('end-turn').addEventListener('click', endTurn);
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') { panels.closeAll(); return; }
    if (MOVE_KEYS[e.key] && sel.unitId && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      moveSelected(MOVE_KEYS[e.key]);
      return;
    }
    if (e.key === 'Enter' || e.key === 'e') { endTurn(); return; }
    if (e.key === 'b' && sel.unitId) {
      foundCityFlow();
      return;
    }
    if (e.key === 'f' && sel.unitId) {
      if (apply({ type: 'fortify', playerId: session.state.activePlayer, unitId: sel.unitId })) {
        hud.note(`🛡 ${units[session.state.units[sel.unitId].type].name} fortified`);
      }
      return;
    }
    if ((e.key === 'i' || e.key === 'm' || e.key === 'r') && sel.unitId) {
      const work = { i: 'irrigate', m: 'mine', r: 'road' }[e.key];
      if (apply({ type: 'startWork', playerId: session.state.activePlayer, unitId: sel.unitId, work })) {
        hud.unitNote(session.state.units[sel.unitId]);
      }
      return;
    }
    if (e.key === 'n') { nextUnit(); return; }
    if (e.key === 't') {
      const avail = availableTechs(session.state, HUMAN, session.ruleset);
      if (avail.length === 0 || session.state.activePlayer !== HUMAN) return;
      const idx = avail.indexOf(session.state.players[HUMAN].researching);
      apply({ type: 'setResearch', playerId: HUMAN, tech: avail[(idx + 1) % avail.length] });
      return;
    }
    if (e.key === 'c' && sel.cityId) {
      const city = session.state.cities[sel.cityId];
      const me = session.state.players[HUMAN];
      const options = [];
      for (const id of Object.keys(buildings).sort()) {
        if ((city.buildings || []).includes(id)) continue;
        if (buildings[id].tech === '' || me.techs.includes(buildings[id].tech)) options.push({ kind: 'building', id });
      }
      for (const id of Object.keys(wonders).sort()) {
        if (session.state.wonders && session.state.wonders[id] !== undefined) continue;
        if (wonders[id].tech === '' || me.techs.includes(wonders[id].tech)) options.push({ kind: 'wonder', id });
      }
      if (options.length === 0) return;
      const idx = options.findIndex(o => o.kind === city.producing.kind && o.id === city.producing.id);
      apply({ type: 'setProduction', playerId: session.state.activePlayer, cityId: sel.cityId, item: options[(idx + 1) % options.length] });
      return;
    }
    if (PRODUCTION_KEYS[e.key] && sel.cityId) {
      apply({ type: 'setProduction', playerId: session.state.activePlayer, cityId: sel.cityId, item: { kind: 'unit', id: PRODUCTION_KEYS[e.key] } });
    }
  });
}

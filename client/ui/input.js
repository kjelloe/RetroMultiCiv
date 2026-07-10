// Input: renderer picks (select / move / attack / stacks) and the keyboard.
import { unitsAt, cityAt } from '../../engine/combat.js';
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
      if (moved) hud.note(`${units[moved.type].name} at (${moved.x},${moved.y}) · moves ${moved.moves}`);
    }
  }

  // next idle unit — skips fortified units unless selected by hand
  function nextUnit() {
    const movable = Object.values(session.state.units).filter(
      u => u.owner === HUMAN && u.moves > 0 && !u.fortified && u.id !== sel.unitId
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
    if (last && last.owner === HUMAN && last.moves > 0 && !last.fortified) {
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
  renderer.onHover(pick => {
    hud.tile(pick ? describeTile(pick.tile.x, pick.tile.y) : '');
    // attack preview: red hover ring when targeting an enemy with a unit selected
    let attack = false;
    if (pick && sel.unitId && session.state.units[sel.unitId]) {
      const hostiles = unitsAt(session.state, pick.tile.x, pick.tile.y)
        .filter(u => u.owner !== HUMAN);
      attack = hostiles.length > 0;
    }
    renderer.setHoverColor(attack ? 0xff4433 : 0xffffff);
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

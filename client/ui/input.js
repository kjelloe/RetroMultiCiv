// Input: renderer picks (select / move / attack / stacks) and the keyboard.
import { unitsAt, cityAt, attackStrength, defenseStrength, bestDefender } from '../../engine/combat.js';
import { candidateTiles, tileYields, wonderActive, citySpacingOk } from '../../engine/cities.js';
import { capitalOf } from '../../engine/government.js';
import { availableTechs } from '../../engine/tech.js';
import { canStepTo, stepDir, tileEnterable } from './move-hints.js';
import { findPath } from '../../shared/pathfind.js';

const MOVE_KEYS = {
  w: 'N', ArrowUp: 'N',
  d: 'E', ArrowRight: 'E',
  s: 'S', ArrowDown: 'S',
  a: 'W', ArrowLeft: 'W'
};

export function initInput(ctx) {
  const { session, renderer, sel, panels, hud } = ctx;
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
    } else if (tile.fortress === true) {
      parts.push('fortress ×2');
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
    const me = state.players[ctx.HUMAN];
    const known = (tx, ty) => !me.explored || me.explored[ty * state.map.width + tx] === 1;
    // the rating must not read through the fog — that would leak the map
    if (!known(x, y)) return { text: '🏛 unexplored territory', tiles: null };
    const tile = state.map.tiles[y * state.map.width + x];
    if (ruleset.terrain.terrains[tile.t].domain !== 'land') {
      return { text: '🏛 cannot settle at sea', tiles: null };
    }
    if (cityAt(state, x, y)) return { text: '🏛 a city already stands here', tiles: null };
    // A29 (VI.12): inside another city's spacing zone founding is illegal —
    // a rating is noise there, so show plain tile properties instead. KNOWN
    // cities only: a rival city the viewer has never seen must not change
    // the readout (that would leak the map through the fog).
    for (const c of Object.values(state.cities)) {
      if (!known(c.x, c.y)) continue;
      if (!citySpacingOk(state.map, x, y, c.x, c.y, ruleset.rules)) {
        return { text: describeTile(x, y), tiles: null };
      }
    }
    // owner matters since governments: the preview rates the site under
    // the viewing player's government (despotism tile penalty etc.)
    const all = candidateTiles(state, { x, y, owner: ctx.HUMAN }, ruleset);
    const candidates = all.filter(c => known(c.x, c.y));
    const hidden = all.length - candidates.length;
    // wave III catch-up: the engine yields the CITY SQUARE as roaded +
    // irrigated (mine kept if present) — mirror that so the rating matches
    // what founding actually produces (engine/cities.js workedTiles center)
    const centerTile = { t: tile.t, road: true };
    if (tile.special === true) centerTile.special = true;
    if (tile.river === true) centerTile.river = true;
    if (tile.mine === true) centerTile.mine = true; else centerTile.irrigation = true;
    const center = tileYields(centerTile, ruleset);
    let food = center.food, shields = center.shields, trade = center.trade;
    for (const c of candidates.slice(0, 4)) {
      food += c.yields.food; shields += c.yields.shields; trade += c.yields.trade;
    }
    const score = food * 3 + shields * 2 + trade;
    const word = score >= 38 ? 'Excellent' : score >= 30 ? 'Good' : score >= 22 ? 'Fair' : 'Poor';
    return {
      text: `🏛 ${word} site — food ${food} · shields ${shields} · trade ${trade}`
        + (tile.river ? ' · river' : '')
        + (hidden > 0 ? ` · ${hidden} tile${hidden > 1 ? 's' : ''} unexplored` : ''),
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
      if (e.type === 'techDiscovered' && e.playerId === ctx.HUMAN) {
        return `🔬 ${session.ruleset.techs[e.tech].name} discovered!`;
      }
    }
    return null;
  }

  // engine rejections worth a center message when a unit ACTION fails
  // (movement rejections stay in the quiet HUD note — arrow-key mashing)
  const REASON_TEXT = {
    alreadyImproved: 'that improvement is already on this tile',
    badTerrain: 'this terrain does not support that',
    noWater: 'irrigation needs an adjacent river, ocean, or irrigated tile',
    noMovesLeft: 'no moves left this turn',
    cityExists: 'a city already stands here',
    notSettlers: 'only settlers can do that',
    alreadyFortified: 'already fortified',
    nothingToPillage: 'nothing to pillage on this tile',
    notEnoughGold: 'not enough gold',
    alreadyComplete: 'production is already complete',
    techRequired: 'needs a technology you have not discovered',
    rateTooHigh: 'your government caps rates — see the research panel',
    inRevolution: 'wait for the revolution to end',
    alreadyGovernment: 'that is already your government',
    badSpecialists: 'taxmen and scientists need a city of 5+, and citizens to spare',
    tooCloseToCity: `cities need ${session.ruleset.rules.minCityDistance || 3} tiles of spacing (${session.ruleset.rules.minCityDiagonal || 2} diagonally) — any civilization's city counts`
  };
  const ACTION_COMMANDS = {
    startWork: true, foundCity: true, fortify: true, wait: true,
    pillage: true, disband: true, buy: true,
    setGovernment: true, setRates: true, setWorkers: true
  };

  // wave III: after a combat involving the viewer, keep the camera at the
  // battle site and skip the auto-next-unit jump for that one action — the
  // player wants to SEE the outcome. Consumed by moveSelected.
  let combatLinger = false;
  async function apply(cmd) {
    const res = await session.apply(cmd);
    if (res.ok) {
      confirmEndTurnUntil = 0; // the situation changed — a stale confirmation dies
      if (sel.unitId && !session.state.units[sel.unitId]) sel.unitId = null;
      const combat = (res.events || []).find(e => e.type === 'combatResolved'
        && (e.attackerOwner === ctx.HUMAN || e.defenderOwner === ctx.HUMAN));
      if (combat && combat.x !== undefined) {
        combatLinger = true;
        renderer.centerOn(combat.x, combat.y);
      }
      const note = describeEvents(res.events);
      if (note) hud.note(note);
    } else {
      if (ACTION_COMMANDS[cmd.type] && REASON_TEXT[res.reason]) {
        hud.flash(`✗ ${REASON_TEXT[res.reason]}`);
      }
      hud.note(`✗ ${cmd.type}: ${res.reason}`);
    }
    return res.ok;
  }
  ctx.apply = apply;

  // --- unit actions (shared by keyboard and the action bar) --------------------
  async function fortifySelected() {
    if (!sel.unitId) return;
    if (await apply({ type: 'fortify', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      hud.note(`🛡 ${units[session.state.units[sel.unitId].type].name} fortified`);
    }
  }

  async function waitSelected() {
    if (!sel.unitId) return;
    if (await apply({ type: 'wait', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      nextUnit();
    }
  }

  async function startWorkFor(work) {
    if (!sel.unitId) return;
    if (await apply({ type: 'startWork', playerId: session.state.activePlayer, unitId: sel.unitId, work })) {
      hud.unitNote(session.state.units[sel.unitId]);
    }
  }

  async function pillageSelected() {
    if (!sel.unitId) return;
    if (await apply({ type: 'pillage', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      hud.note('🔥 improvement destroyed');
    }
  }

  // destructive: needs a second press on the same unit within 5 seconds
  let confirmDisband = { unitId: null, until: 0 };
  async function disbandSelected() {
    if (!sel.unitId || !session.state.units[sel.unitId]) return;
    const unit = session.state.units[sel.unitId];
    if (confirmDisband.unitId !== unit.id || Date.now() > confirmDisband.until) {
      confirmDisband = { unitId: unit.id, until: Date.now() + 5000 };
      hud.banner(`⚠ Disband ${units[unit.type].name}? X / Disband again to confirm`);
      return;
    }
    confirmDisband = { unitId: null, until: 0 };
    if (await apply({ type: 'disband', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      hud.note('☠ unit disbanded');
      nextUnit();
    }
  }

  async function moveSelected(dir) {
    if (!sel.unitId || !session.state.units[sel.unitId]) return;
    const unitId = sel.unitId;
    delete gotoTargets[unitId]; // manual steering overrides GoTo
    if (await apply({ type: 'moveUnit', playerId: session.state.activePlayer, unitId, dir })) {
      sel.lastMovedBy[ctx.HUMAN] = unitId; // per player: hotseat lands each on THEIR unit
      const moved = session.state.units[unitId];
      const linger = combatLinger; // wave III: stay at the battle site once
      combatLinger = false;
      if (moved) {
        hud.unitNote(moved);
        if (moved.moves === 0 && !linger && ctx.options && ctx.options.get('autoNextUnit')) nextUnit();
      }
    }
  }

  // next idle unit — skips fortified and working units unless selected by
  // hand; NEAREST first, so the camera glides instead of teleporting
  function nextUnit() {
    const movable = Object.values(session.state.units).filter(
      u => u.owner === ctx.HUMAN && u.moves > 0 && !u.fortified && !u.working && u.id !== sel.unitId
    );
    if (movable.length === 0) {
      hud.note('no units with moves left — E to end turn');
      hud.banner('no units with moves left — press E to end the turn');
      return;
    }
    const lastId = sel.lastMovedBy[ctx.HUMAN];
    const anchor = (sel.unitId && session.state.units[sel.unitId])
      || (lastId && session.state.units[lastId]) || null;
    let pick = movable[0];
    if (anchor) {
      let best = 1e9;
      for (const u of movable) {
        const d = wrapDist(u.x, u.y, anchor.x, anchor.y);
        if (d < best) { best = d; pick = u; }
      }
    }
    ctx.selectUnit(pick);
    renderer.centerOn(pick.x, pick.y);
  }

  // new turn: run queued GoTo routes, then return to the last-moved unit
  async function autoSelectAfterTurn() {
    if (session.state.gameOver || session.state.activePlayer !== ctx.HUMAN) return;
    await runAllGotos();
    const lastId = sel.lastMovedBy[ctx.HUMAN];
    const last = lastId && session.state.units[lastId];
    if (last && last.owner === ctx.HUMAN && last.moves > 0 && !last.fortified && !last.working) {
      ctx.selectUnit(last);
      renderer.centerOn(last.x, last.y);
      return;
    }
    sel.unitId = null;
    nextUnit();
  }

  // Ending the turn with units still to move needs a second E (or End Turn
  // click) within the warning banner's 5-second lifetime.
  let confirmEndTurnUntil = 0;
  async function endTurn() {
    if (ctx.SPECTATOR) return; // A17: view-only — nothing to end
    if (!session.state.gameOver && session.state.activePlayer !== ctx.HUMAN) {
      return; // A29 (VI.6): off-turn no-op — the button is greyed to match
    }
    if (!session.state.gameOver && session.state.activePlayer === ctx.HUMAN
        && session.state.players[ctx.HUMAN] && session.state.players[ctx.HUMAN].human) {
      // A29 (VI.4): units with standing GoTo orders aren't idle — run their
      // legs FIRST, then warn only about the truly orderless
      const routed = Object.values(session.state.units).some(u => u.owner === ctx.HUMAN
        && u.moves > 0 && !u.working && gotoTargets[u.id] !== undefined);
      if (routed) await runAllGotos();
    }
    const state = session.state; // runAllGotos replaced it (reducer)
    if (!state.gameOver && state.activePlayer === ctx.HUMAN
        && state.players[ctx.HUMAN] && state.players[ctx.HUMAN].human) {
      const movable = Object.values(state.units).filter(
        u => u.owner === ctx.HUMAN && u.moves > 0 && !u.working && !u.fortified
          && gotoTargets[u.id] === undefined // orders standing = not idle
      );
      if (movable.length > 0 && Date.now() > confirmEndTurnUntil) {
        confirmEndTurnUntil = Date.now() + 5000;
        const plural = movable.length > 1;
        hud.banner(`⚠ ${movable.length} unit${plural ? 's' : ''} still ${plural ? 'have' : 'has'} moves — E / End Turn again to confirm`);
        return;
      }
      // a city finished its work and nobody chose what's next: open it
      const pending = Object.keys(needsOrders)
        .filter(id => state.cities[id] && state.cities[id].owner === ctx.HUMAN).sort();
      if (pending.length > 0 && Date.now() > confirmOrdersUntil) {
        confirmOrdersUntil = Date.now() + 5000;
        panels.openCityPanel(pending[0]);
        hud.banner(`🏭 ${state.cities[pending[0]].name} completed its work — choose production, or E again to continue`);
        return;
      }
      for (const id of Object.keys(needsOrders)) delete needsOrders[id]; // ignored once
    }
    confirmEndTurnUntil = 0;
    panels.closeStackPanel();
    sel.cityId = null;
    const res = await session.endTurn();
    if (!res.ok) { hud.note(`✗ endTurn: ${res.reason}`); return; }
    const now = session.state;
    const next = now.activePlayer;
    // hotseat is LOCAL-only: in server mode (the remote session exposes its
    // bound playerId) the next human plays their OWN machine — taking this
    // path there dropped the curtain on the wrong screen and flipped
    // ctx.HUMAN to a rival whose filtered view has no techs/gold (LAN
    // research-panel crash, wave V bug 0)
    if (!now.gameOver && session.playerId === undefined
        && next !== ctx.HUMAN && now.players[next] && now.players[next].human) {
      // hotseat: drop the opaque curtain FIRST, then swap the viewpoint
      // underneath it — neither player ever sees the other's map
      ctx.handoff.show(now.players[next].name, now.players[next].color, () => {});
      ctx.setHuman(next);
      // the incoming human's queued GoTo routes must run at the START of
      // their turn (this path returns before autoSelectAfterTurn, which was
      // why hotseat GoTos froze after the first leg) — and it also lands
      // the camera on one of their own units instead of the other player's
      // last view
      await autoSelectAfterTurn();
      return;
    }
    await autoSelectAfterTurn();
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
    if (unit.moves <= 0) {
      hud.flash('⏳ These settlers have no moves left — found the city next turn');
      return;
    }
    const unitId = unit.id;
    panels.openNameDialog(ctx.suggestCityName(), async name => {
      if (await apply({ type: 'foundCity', playerId: session.state.activePlayer, unitId, name })) {
        sel.unitId = null;
        panels.openCityPanel(session.state.cityOrder[session.state.cityOrder.length - 1]);
      }
    });
  }

  // --- GoTo: client-side multi-turn navigation (docs/04 §4) --------------------
  // Targets live only in the client (the engine stays one-tile-per-command);
  // each turn the unit greedily steps closer, never initiating an attack.
  const gotoTargets = {}; // unitId -> { x, y }
  let gotoArming = false;
  const GOTO_VEC = {
    N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1],
    S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1]
  };

  function wrapDist(ax, ay, bx, by) {
    const map = session.state.map;
    let dx = Math.abs(ax - bx);
    if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
    const dy = Math.abs(ay - by);
    return dx > dy ? dx : dy;
  }

  // A65: the injected legality the pathfinder plans with — the same
  // tile-entry verdict the move affordance uses (domain / fog / enemy)
  function planCanEnter(state, unit) {
    return (x, y) => tileEnterable(state, unit, x, y, session.ruleset);
  }

  async function gotoStep(unitId) {
    const state = session.state;
    const unit = state.units[unitId];
    const target = gotoTargets[unitId];
    if (!unit || !target) { delete gotoTargets[unitId]; return false; }
    if (unit.x === target.x && unit.y === target.y) { delete gotoTargets[unitId]; return false; }
    // A65: least-cost route over roads/rails — replanned each step so fog
    // lifting and terrain revise the path. The engine still validates every
    // move; a fog/enemy target the planner can't reach falls back to greedy.
    const planned = findPath(state, session.ruleset, unit, target, planCanEnter(state, unit));
    if (planned && planned.points.length > 1) {
      const next = planned.points[1];
      const dir = stepDir(state.map, unit, next.x, next.y);
      if (dir) {
        const r = await session.apply({ type: 'moveUnit', playerId: state.activePlayer, unitId, dir });
        if (r.ok) return true;
      }
    }
    const here = wrapDist(unit.x, unit.y, target.x, target.y);
    const options = Object.keys(GOTO_VEC).map(dir => {
      const v = GOTO_VEC[dir];
      let nx = unit.x + v[0];
      if (state.map.wrapX) nx = ((nx % state.map.width) + state.map.width) % state.map.width;
      return { dir, nx, ny: unit.y + v[1], d: wrapDist(nx, unit.y + v[1], target.x, target.y) };
    }).filter(o =>
      o.d < here && o.ny >= 0 && o.ny < state.map.height
      && !unitsAt(state, o.nx, o.ny).some(u => u.owner !== unit.owner) // never auto-attack
    ).sort((a, b) => a.d - b.d);
    for (const o of options) {
      const r = await session.apply({ type: 'moveUnit', playerId: state.activePlayer, unitId, dir: o.dir });
      if (r.ok) return true;
    }
    delete gotoTargets[unitId]; // boxed in: stop rather than wander
    hud.note('🎯 route blocked — GoTo cancelled');
    return false;
  }

  async function runGoto(unitId) {
    let guard = 40;
    while (gotoTargets[unitId] && session.state.units[unitId]
           && session.state.units[unitId].moves > 0 && guard-- > 0) {
      if (!(await gotoStep(unitId))) break;
    }
    if (gotoTargets[unitId] && session.state.units[unitId]) {
      hud.note(`🎯 en route to (${gotoTargets[unitId].x},${gotoTargets[unitId].y}) — continues next turn`);
    }
  }

  async function runAllGotos() {
    // hotseat: both players' orders live in this one map — only ever run
    // the CURRENT viewer's routes on their own turn
    for (const unitId of Object.keys(gotoTargets).sort()) {
      const u = session.state.units[unitId];
      if (!u) { delete gotoTargets[unitId]; continue; }
      if (u.owner !== ctx.HUMAN || session.state.activePlayer !== ctx.HUMAN) continue;
      await runGoto(unitId);
    }
  }

  // the route a GoTo order INTENDS to take — drawn over the map while the
  // unit is selected. A65: the cost-aware path when reachable (roads/rails
  // preferred); the greedy simulation is the fog/enemy-target fallback.
  function gotoPreviewPath(unit, target) {
    const state = session.state;
    const planned = findPath(state, session.ruleset, unit, target, planCanEnter(state, unit));
    if (planned) return planned.points;
    const points = [{ x: unit.x, y: unit.y }];
    let cx = unit.x, cy = unit.y, guard = 120;
    while ((cx !== target.x || cy !== target.y) && guard-- > 0) {
      const here = wrapDist(cx, cy, target.x, target.y);
      let best = null;
      for (const dir of Object.keys(GOTO_VEC)) {
        const v = GOTO_VEC[dir];
        let nx = cx + v[0];
        if (state.map.wrapX) nx = ((nx % state.map.width) + state.map.width) % state.map.width;
        const ny = cy + v[1];
        if (ny < 0 || ny >= state.map.height) continue;
        const d = wrapDist(nx, ny, target.x, target.y);
        if (d >= here) continue;
        if (unitsAt(state, nx, ny).some(u => u.owner !== unit.owner)) continue;
        if (!best || d < best.d) best = { nx, ny, d };
      }
      if (!best) break; // blocked: the drawn route ends where the unit would stop
      cx = best.nx; cy = best.ny;
      points.push({ x: cx, y: cy });
    }
    return points;
  }

  function refreshGotoPath() {
    const unit = sel.unitId ? session.state.units[sel.unitId] : null;
    const target = unit ? gotoTargets[unit.id] : null;
    renderer.setPath(unit && target ? gotoPreviewPath(unit, target) : null);
  }

  // cities that completed something and were dropped back to default
  // production — ending the turn opens them first (E again to ignore)
  const needsOrders = {};
  let confirmOrdersUntil = 0;
  session.onChange((state, events) => {
    for (const e of events) {
      if ((e.type === 'buildingBuilt' || e.type === 'wonderBuilt' || e.type === 'wonderLost')
          && state.cities[e.cityId] && state.cities[e.cityId].owner === ctx.HUMAN) {
        needsOrders[e.cityId] = true;
      } else if (e.type === 'productionSet' || e.type === 'cityCaptured') {
        delete needsOrders[e.cityId];
      }
    }
  });

  // --- action bar: the selected unit's applicable actions, bottom center -------
  const actionBar = document.getElementById('action-bar');
  function refreshActionBar() {
    const state = session.state;
    const unit = sel.unitId ? state.units[sel.unitId] : null;
    refreshGotoPath(); // the selected unit's route overlay tracks the bar
    if (unit && unit.owner === ctx.HUMAN) hud.unitNote(unit);
    else hud.clearUnitLine();
    actionBar.textContent = '';
    const usable = unit && unit.owner === ctx.HUMAN && !state.gameOver
      && state.activePlayer === ctx.HUMAN && unit.moves > 0 && !unit.working;
    if (!usable) {
      actionBar.classList.add('hidden');
      return;
    }
    const actions = [];
    if (unit.type === 'settlers') {
      const tile0 = state.map.tiles[unit.y * state.map.width + unit.x];
      const terrain = session.ruleset.terrain.terrains[tile0.t];
      const me = state.players[ctx.HUMAN];
      const irrigateLabel = terrain.irrigate === undefined
        && terrain.transforms !== undefined && terrain.transforms.irrigate !== undefined
        ? '🌿 Clear/Drain' : '💧 Irrigate';
      const mineLabel = terrain.mine === undefined
        && terrain.transforms !== undefined && terrain.transforms.mine !== undefined
        ? '🌲 Plant/Clear' : '⛏ Mine';
      const rail = tile0.road === true && tile0.railroad !== true
        && me.techs.includes(session.ruleset.rules.railroadTech);
      actions.push({ label: '🏛 Found city', key: 'B', run: foundCityFlow });
      actions.push({ label: irrigateLabel, key: 'I', run: () => startWorkFor('irrigate') });
      actions.push({ label: mineLabel, key: 'M', run: () => startWorkFor('mine') });
      actions.push({ label: rail ? '🚂 Railroad' : '🛤 Road', key: 'R', run: () => startWorkFor(rail ? 'railroad' : 'road') });
      if (me.techs.includes(session.ruleset.rules.fortressTech) && tile0.fortress !== true) {
        actions.push({ label: '🏰 Fortress', key: 'O', run: () => startWorkFor('fortress') });
      }
    }
    if (!unit.fortified) actions.push({ label: '🛡 Fortify', key: 'F', run: fortifySelected });
    actions.push({ label: '⏭ Skip', key: 'Space', run: waitSelected });
    const tile = state.map.tiles[unit.y * state.map.width + unit.x];
    if (session.ruleset.units[unit.type].domain === 'land'
        && (tile.irrigation || tile.mine || tile.road || tile.railroad)) {
      actions.push({ label: '🔥 Pillage', key: 'P', run: pillageSelected });
    }
    const hasRoute = gotoTargets[unit.id] !== undefined;
    actions.push({
      label: gotoArming ? '🎯 Click a tile…' : hasRoute ? '🎯 Re-route' : '🎯 Go to', key: 'G',
      run: () => {
        gotoArming = !gotoArming;
        hud.note(gotoArming ? '🎯 click the destination tile' : 'GoTo cancelled');
        refreshActionBar();
      }
    });
    if (hasRoute && !gotoArming) {
      actions.push({
        label: '✕ Cancel route', key: '', run: () => {
          delete gotoTargets[unit.id];
          hud.note('🎯 GoTo order cancelled');
          refreshActionBar();
        }
      });
    }
    actions.push({ label: '⏩ Next unit', key: 'N', run: nextUnit });
    actions.push({ label: '☠ Disband', key: 'X', run: disbandSelected });
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.innerHTML = a.key ? `${a.label} <span class="key">${a.key}</span>` : a.label;
      btn.addEventListener('click', a.run);
      actionBar.appendChild(btn);
    }
    actionBar.classList.remove('hidden');
  }
  ctx.refreshActionBar = refreshActionBar;
  session.onChange(refreshActionBar);

  // --- renderer picks ---------------------------------------------------------
  let lastFootprintKey = null;
  // A35: spectators (omniscient) get a cursor tooltip over units and cities
  // — civ, stats, population — reusing the unit stat-card formatting.
  // Players' hover is untouched (fog already limits what they can pick).
  const specTip = document.createElement('div');
  specTip.id = 'spectator-tip';
  specTip.className = 'hidden';
  document.body.appendChild(specTip);
  const lastPointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => {
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
  });
  function whoName(state, pid) {
    const p = state.players[pid];
    if (!p) return pid;
    const civId = p.civ !== undefined ? p.civ
      : session.playerCivs ? session.playerCivs[pid] : undefined;
    const civName = civId !== undefined && session.ruleset.civs
      && session.ruleset.civs[civId] ? session.ruleset.civs[civId].name : null;
    return civName && civName !== p.name ? `${civName} (${p.name})` : civName || p.name;
  }
  function spectatorTip(pick) {
    const state = session.state;
    const lines = [];
    // the city line leads even when the ray hits its garrison's mesh —
    // spectators hovering a city want the city first, the garrison second
    const c = pick
      ? (pick.cityId && state.cities[pick.cityId]) || cityAt(state, pick.tile.x, pick.tile.y)
      : null;
    if (c) lines.push(`${whoName(state, c.owner)} · ${c.name} · pop ${c.pop}`);
    if (pick && pick.unitId && state.units[pick.unitId]) {
      const u = state.units[pick.unitId];
      const t = units[u.type];
      lines.push(`${whoName(state, u.owner)} · ${t.name}${u.veteran ? ' ★vet' : ''}`
        + ` · ⚔${t.attack} 🛡${t.defense} 👟${u.moves}/${t.moves}`);
    }
    if (lines.length === 0) {
      specTip.classList.add('hidden');
      return;
    }
    specTip.textContent = lines.join('\n');
    specTip.style.left = `${lastPointer.x + 14}px`;
    specTip.style.top = `${lastPointer.y + 18}px`;
    specTip.classList.remove('hidden');
  }

  renderer.onHover(pick => {
    if (ctx.SPECTATOR) {
      spectatorTip(pick);
      hud.tile(pick ? describeTile(pick.tile.x, pick.tile.y) : '');
      return;
    }
    let text = pick ? describeTile(pick.tile.x, pick.tile.y) : '';
    let attack = false;
    let footprint = null;
    const attacker = sel.unitId ? session.state.units[sel.unitId] : null;
    if (pick && attacker) {
      const hostiles = unitsAt(session.state, pick.tile.x, pick.tile.y)
        .filter(u => u.owner !== ctx.HUMAN);
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
    // A19 movement affordance: an arrow on legal adjacent steps ("click will
    // move here"); enemy tiles keep the red attack ring instead
    renderer.setHoverArrow(
      pick && attacker && !attack
        && canStepTo(session.state, attacker, pick.tile.x, pick.tile.y, session.ruleset)
        ? stepDir(session.state.map, attacker, pick.tile.x, pick.tile.y)
        : null
    );
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
    if (city && city.owner === ctx.HUMAN) panels.openCityPanel(city.id);
  });

  renderer.onPick(pick => {
    const state = session.state;
    if (gotoArming && sel.unitId && state.units[sel.unitId]) {
      gotoTargets[sel.unitId] = { x: pick.tile.x, y: pick.tile.y };
      gotoArming = false;
      runGoto(sel.unitId);
      refreshActionBar();
      return;
    }
    const mineHere = unitsAt(state, pick.tile.x, pick.tile.y).filter(u => u.owner === ctx.HUMAN);
    if (mineHere.length > 0) {
      const clicked = (pick.unitId && state.units[pick.unitId] && state.units[pick.unitId].owner === ctx.HUMAN)
        ? state.units[pick.unitId] : mineHere[0];
      ctx.selectUnit(clicked, { keepStack: true });
      const cityHere = cityAt(state, pick.tile.x, pick.tile.y);
      // show the list for stacks, and always inside cities (it carries the
      // "Open city view" button there)
      if (mineHere.length > 1 || (cityHere && cityHere.owner === ctx.HUMAN)) {
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
    refreshActionBar();
    hud.note(describeTile(pick.tile.x, pick.tile.y));
    renderer.setSelection({ tile: pick.tile });
  });

  // --- keyboard ----------------------------------------------------------------
  const PRODUCTION_KEYS = { 1: 'militia', 2: 'phalanx', 3: 'settlers' };

  document.getElementById('end-turn').addEventListener('click', endTurn);
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') { panels.closeAll(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && panels.isCityOpen()) {
      e.preventDefault();
      panels.cycleCity(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (MOVE_KEYS[e.key] && sel.unitId && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      moveSelected(MOVE_KEYS[e.key]);
      return;
    }
    if (e.key === 'Enter' || e.key === 'e') { endTurn(); return; }
    if (e.key === ' ' && sel.unitId) {
      e.preventDefault(); // keep space from scrolling or re-firing a focused button
      waitSelected();
      return;
    }
    if (e.key === 'b' && sel.unitId) {
      e.preventDefault(); // the 'b' must not type into the name dialog it opens
      foundCityFlow();
      return;
    }
    if (e.key === 'f' && sel.unitId) { fortifySelected(); return; }
    if (e.key === 'p' && sel.unitId) { pillageSelected(); return; }
    if (e.key === 'x' && sel.unitId) { disbandSelected(); return; }
    if ((e.key === 'i' || e.key === 'm' || e.key === 'r' || e.key === 'o') && sel.unitId) {
      let work = { i: 'irrigate', m: 'mine', r: 'road', o: 'fortress' }[e.key];
      const u = session.state.units[sel.unitId];
      if (work === 'road' && u) {
        const t = session.state.map.tiles[u.y * session.state.map.width + u.x];
        if (t.road === true && t.railroad !== true
            && session.state.players[ctx.HUMAN].techs.includes(session.ruleset.rules.railroadTech)) {
          work = 'railroad';
        }
      }
      startWorkFor(work);
      return;
    }
    if (e.key === 'n') { nextUnit(); return; }
    if (e.key === 'g' && sel.unitId) {
      gotoArming = !gotoArming;
      hud.note(gotoArming ? '🎯 click the destination tile' : 'GoTo cancelled');
      refreshActionBar();
      return;
    }
    if (e.key === 't') {
      // playtest feedback: T used to cycle research invisibly ("didn't seem
      // to work") — opening the panel is what players expect
      panels.toggleResearchPanel();
      return;
    }
    if (e.key === 'c' && sel.cityId) {
      const city = session.state.cities[sel.cityId];
      const me = session.state.players[ctx.HUMAN];
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
    if (e.key === 'c' && !sel.cityId) {
      // wave III: C with no city selected flies to the capital (Palace, else
      // the oldest city — engine capitalOf); C on a city keeps cycling builds
      const cap = capitalOf(session.state, ctx.HUMAN, session.ruleset); // city object
      if (cap) renderer.centerOn(cap.x, cap.y);
      else hud.note('no capital yet — found a city first');
      return;
    }
    if (PRODUCTION_KEYS[e.key] && sel.cityId) {
      apply({ type: 'setProduction', playerId: session.state.activePlayer, cityId: sel.cityId, item: { kind: 'unit', id: PRODUCTION_KEYS[e.key] } });
    }
  });
}

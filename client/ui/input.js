// Input: renderer picks (select / move / attack / stacks) and the keyboard.
import { unitsAt, cityAt, attackStrength, defenseStrength, bestDefender } from '../../engine/combat.js';
import { candidateTiles, tileYields, wonderActive, citySpacingOk } from '../../engine/cities.js';
import { capitalOf } from '../../engine/government.js';
import { hasWaterSource, workFlag } from '../../engine/improvements.js';
import { computeVisible } from '../../engine/visibility.js';
import { availableTechs } from '../../engine/tech.js';
import { upgradeCost } from '../../engine/upgrade.js';
import { canStepTo, stepDir, tileEnterable, greedySteps } from './move-hints.js';
import { findPath } from '../../shared/pathfind.js';

const MOVE_KEYS = {
  w: 'N', ArrowUp: 'N',
  d: 'E', ArrowRight: 'E',
  s: 'S', ArrowDown: 'S',
  a: 'W', ArrowLeft: 'W'
};
// XIV §7: the client's touch heuristic (the same the d-pad + CSS use)
const isCoarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function initInput(ctx) {
  const { session, renderer, sel, panels, hud } = ctx;
  const { units, buildings, wonders } = session.ruleset;

  function describeTile(x, y) {
    const tile = session.state.map.tiles[y * session.state.map.width + x];
    const extras = (tile.river ? ' +river' : '') + (tile.special ? ' ★' : '');
    // A68 (VIII.9): the readout names the tile's improvements
    const imps = [
      tile.railroad === true ? '🚂 railroad' : tile.road === true ? '🛤 road' : null,
      tile.irrigation === true ? '💧 irrigation' : null,
      tile.mine === true ? '⛏ mine' : null,
      tile.fortress === true ? '🏰 fortress' : null
    ].filter(i => i !== null);
    return `(${x},${y}) ${tile.t}${extras}${imps.length > 0 ? ' · ' + imps.join(' · ') : ''}`;
  }

  // A68 (VIII.9): why a settler job can't run on THIS tile (button gray-out +
  // tooltip), or null when it can — the tile-local half of the engine's
  // startWork validation, built on its exported helpers (workFlag,
  // hasWaterSource), so the rules can't drift apart.
  function workBlocked(unit, work) {
    const state = session.state;
    const ruleset = session.ruleset;
    const tile = state.map.tiles[unit.y * state.map.width + unit.x];
    const terrain = ruleset.terrain.terrains[tile.t];
    const techs = state.players[unit.owner].techs;
    if (tile[workFlag(work)] === true) return 'already built here';
    if (tile.river === true) {
      if (work === 'road' && !techs.includes(ruleset.rules.bridgeTech)) return 'river roads need Bridge Building';
      if (work === 'mine') return 'rivers cannot be mined';
    }
    if (work === 'fortress') {
      for (const cid of state.cityOrder === undefined ? [] : state.cityOrder) {
        const c = state.cities[cid];
        if (c && c.x === unit.x && c.y === unit.y) return 'city tiles need no fortress';
      }
    } else if (work === 'railroad') {
      if (tile.road !== true) return 'needs a road first';
    } else if (work === 'irrigate' || work === 'mine') {
      const transform = terrain.transforms !== undefined && terrain.transforms[work] !== undefined;
      if (terrain[work] === undefined && !transform) return `${tile.t} does not support it`;
      if (work === 'irrigate' && !transform && !hasWaterSource(state, unit.x, unit.y)) {
        return 'needs a water source (river or adjacent water/irrigation)';
      }
    }
    return null;
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
    notBuildingWonder: 'this city is not building a wonder',
    cannotHelpWonder: 'this unit cannot help build wonders',
    // N11 unit upgrades (CP18) — the engine's rejections
    notInCity: 'upgrades happen inside your own cities',
    noUpgrade: 'no upgrade is available for this unit',
    // A92 debug commands — the engine's gate + per-action rejections
    debugDisabled: 'debug commands need a --debug server or a ?debug=1 game',
    badUnitType: 'no such unit type',
    outOfBounds: 'that tile is off the map',
    occupiedByEnemy: 'an enemy holds that tile — even god-mode keeps stacks single-owner',
    unknownTech: 'no such technology',
    alreadyKnown: 'that technology is already discovered',
    unknownDebugAction: 'unknown debug action',
    // A89 caravans (specs/n10-caravans.md §4) — the six establish rejections
    notCaravan: 'this unit cannot establish trade routes',
    cityRequired: 'trade routes are established standing IN the partner city',
    noHomeCity: 'this unit has no home city to route from',
    ownCityTooClose: 'a domestic partner must be farther from home — try a more distant city',
    sameCity: 'a city cannot trade with itself — move to a partner city',
    duplicateRoute: 'the home city already routes to this partner',
    alreadySoldThisTurn: 'only one building can be sold per city each turn',
    cannotSellPalace: 'the palace cannot be sold',
    tooCloseToCity: `cities need ${session.ruleset.rules.minCityDistance || 3} tiles of spacing (${session.ruleset.rules.minCityDiagonal || 2} diagonally) — any civilization's city counts`
  };
  const ACTION_COMMANDS = {
    startWork: true, foundCity: true, fortify: true, wait: true,
    pillage: true, disband: true, buy: true, helpWonder: true, sellBuilding: true,
    setGovernment: true, setRates: true, setWorkers: true,
    establishTradeRoute: true, // A89 (inert until the N10 engine half lands)
    debug: true, // A92: the debug panel's commands flash their rejections too
    upgradeUnit: true // N11 (CP18)
  };

  // wave III: after a combat involving the viewer, keep the camera at the
  // battle site and skip the auto-next-unit jump for that one action — the
  // player wants to SEE the outcome. Consumed by moveSelected.
  let combatLinger = false;
  async function apply(cmd) {
    // C4: a MANUAL order on a unit cancels its automation and wakes it (this
    // path carries only user-initiated commands; the automation driver calls
    // session.apply directly and never self-cancels)
    if (cmd.unitId && ctx.automate) {
      ctx.automate.cancelAuto(cmd.unitId);
      ctx.automate.wake(cmd.unitId);
    }
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

  // A90: the domestic city a helpsWonder unit stands in that is building a
  // wonder, or null — shared by the action-bar gate and the H key so both
  // agree on when the action exists.
  function helpWonderCityFor(unit) {
    if (!unit || session.ruleset.units[unit.type].helpsWonder !== true) return null;
    for (const cid of session.state.cityOrder) {
      const c = session.state.cities[cid];
      if (c && c.x === unit.x && c.y === unit.y) {
        return (c.owner === ctx.HUMAN && c.producing.kind === 'wonder') ? c : null;
      }
    }
    return null;
  }

  // N11 (CP18, the A90 pattern): the upgrade gate — a unit whose upgradesTo
  // successor's tech is KNOWN shows the button; standing outside an owned
  // city grays it with the why. Cost comes from the engine's own
  // upgradeCost export (shared seam — the preview and the charge agree by
  // construction). Returns null (no successor/tech), { to, cost } (legal),
  // or { to, cost, blocked } (grayed).
  function upgradeStateFor(unit) {
    if (!unit) return null;
    const def = session.ruleset.units[unit.type];
    if (!def || def.upgradesTo === undefined) return null;
    const target = session.ruleset.units[def.upgradesTo];
    if (!target) return null;
    const me = session.state.players[ctx.HUMAN];
    if (target.tech !== '' && (!me || me.techs.indexOf(target.tech) === -1)) return null;
    const cost = upgradeCost(unit, session.ruleset);
    let inOwnCity = false;
    for (const cid of session.state.cityOrder) {
      const c = session.state.cities[cid];
      if (c && c.x === unit.x && c.y === unit.y && c.owner === unit.owner) inOwnCity = true;
    }
    if (!inOwnCity) return { to: target, cost, blocked: 'notInCity' };
    if (me.gold < cost) return { to: target, cost, blocked: 'notEnoughGold' };
    return { to: target, cost };
  }

  async function upgradeSelected() {
    if (!sel.unitId) return;
    const unit = session.state.units[sel.unitId];
    const gate = upgradeStateFor(unit);
    if (!gate || gate.blocked) return;
    const fromName = units[unit.type].name;
    if (await apply({ type: 'upgradeUnit', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      hud.note(`⬆ ${fromName} upgraded to ${gate.to.name} (−${gate.cost}💰, veteran status carried)`);
    }
  }

  // A89 (specs/n10-caravans.md §4): the establish-route gate, MIRRORING the
  // engine's legality for the button/key (the engine stays the judge). The
  // whole feature detects on the units.json tradeRoutes capability — absent
  // until the N10 engine half lands, so everything here is inert today.
  // Returns { city } when legal, { blocked } with the rejection id when a
  // caravan stands in a city that fails a leg, null when no action applies.
  function tradeRouteStateFor(unit) {
    if (!unit || session.ruleset.units[unit.type].tradeRoutes !== true) return null;
    const state = session.state;
    let partner = null;
    for (const cid of state.cityOrder) {
      const c = state.cities[cid];
      if (c && c.x === unit.x && c.y === unit.y) { partner = c; break; }
    }
    if (!partner) return { blocked: 'cityRequired' };
    const home = unit.home !== undefined ? state.cities[unit.home] : null;
    if (!home) return { blocked: 'noHomeCity' };
    if (home.id === partner.id) return { blocked: 'sameCity' };
    const routes = home.tradeRoutes || [];
    for (const r of routes) {
      if (r.partnerCityId === partner.id) return { blocked: 'duplicateRoute' };
    }
    if (partner.owner === home.owner) { // domestic: the distance rule applies
      const tr = session.ruleset.rules.tradeRoute;
      const minD = tr && tr.minDomesticDistance !== undefined ? tr.minDomesticDistance : 10;
      const W = state.map.width;
      let dx = Math.abs(home.x - partner.x);
      if (state.map.wrapX) dx = Math.min(dx, W - dx);
      const d = Math.max(dx, Math.abs(home.y - partner.y));
      if (d < minD) return { blocked: 'ownCityTooClose' };
    }
    return { city: partner };
  }

  async function establishRouteSelected() {
    if (!sel.unitId) return;
    const unit = session.state.units[sel.unitId];
    const gate = tradeRouteStateFor(unit);
    if (!gate || !gate.city) return;
    if (await apply({ type: 'establishTradeRoute', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      hud.note(`🐫 trade route established with ${gate.city.name}`);
      nextUnit();
    }
  }

  async function helpWonderSelected() {
    if (!sel.unitId) return;
    const unit = session.state.units[sel.unitId];
    const city = helpWonderCityFor(unit);
    if (!city) return;
    const wonderName = session.ruleset.wonders[city.producing.id].name;
    if (await apply({ type: 'helpWonder', playerId: session.state.activePlayer, unitId: sel.unitId })) {
      hud.note(`🏛 ${units[unit.type].name} sped ${wonderName}`);
      nextUnit();
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

  // C4: sentry + automation toggles (ui/automate.js holds the state)
  function sentrySelected() {
    if (!sel.unitId || !ctx.automate) return;
    const on = ctx.automate.toggleSentry(sel.unitId);
    if (on) nextUnit(); // the point of sentry: move along
    hud.note(on ? '😴 sentried — skipped by N until an enemy nears' : '⏰ awake');
    refreshActionBar();
  }
  function autoSelected() {
    if (!sel.unitId || !ctx.automate) return;
    const unit = session.state.units[sel.unitId];
    if (!unit || unit.type !== 'settlers') return;
    const on = ctx.automate.toggleAuto(sel.unitId);
    hud.note(on ? '🤖 settler automated — improves nearby city tiles; any manual order cancels' : '🤖 automation off');
    if (on) ctx.automate.drive();
    refreshActionBar();
  }
  // XIV §42: the inline auto-improve priority menu — one button cycling
  // Balanced → Food → Shield → Trade (shown only while a settler is automated).
  function cyclePrioritySelected() {
    if (!ctx.automate || !ctx.automate.cyclePriority) return;
    const next = ctx.automate.cyclePriority();
    const LABELS = { balanced: 'Balanced', food: 'Food', shield: 'Shield', trade: 'Trade' };
    hud.note(`🤖 auto-improve priority: ${LABELS[next] || next}`);
    ctx.automate.drive();
    refreshActionBar();
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

  // XIV §7: a touch STEP — like moveSelected, but if the target tile holds an
  // enemy it shows an explicit Attack/Cancel overlay with the odds first (touch
  // has no hover to preview a fight before committing).
  const DIR_VEC = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
  let attackConfirm = null;
  function closeAttackConfirm() { if (attackConfirm) { attackConfirm.remove(); attackConfirm = null; } }
  function stepTarget(unit, dir) {
    const d = DIR_VEC[dir];
    if (!d) return null;
    const map = session.state.map;
    let x = unit.x + d[0];
    if (map.wrapX) x = ((x % map.width) + map.width) % map.width;
    const y = unit.y + d[1];
    if (y < 0 || y >= map.height || x < 0 || x >= map.width) return null;
    return { x, y };
  }
  function touchStep(dir) {
    const unit = sel.unitId && session.state.units[sel.unitId];
    if (!unit) return;
    const t = stepTarget(unit, dir);
    if (t && unitsAt(session.state, t.x, t.y).some(u => u.owner !== ctx.HUMAN)) {
      showAttackConfirm(dir, unit, t.x, t.y);
      return;
    }
    moveSelected(dir);
  }
  function showAttackConfirm(dir, attacker, x, y) {
    closeAttackConfirm();
    const odds = combatPreview(attacker, x, y) || 'attack this unit?';
    const box = document.createElement('div');
    box.id = 'attack-confirm';
    const oddsDiv = document.createElement('div');
    oddsDiv.className = 'ac-odds';
    oddsDiv.textContent = '⚔ ' + odds;
    const acts = document.createElement('div');
    acts.className = 'ac-actions';
    const atk = document.createElement('button'); atk.className = 'ac-attack'; atk.textContent = 'Attack';
    const cnc = document.createElement('button'); cnc.className = 'ac-cancel'; cnc.textContent = 'Cancel';
    acts.appendChild(atk); acts.appendChild(cnc);
    box.appendChild(oddsDiv); box.appendChild(acts);
    document.body.appendChild(box);
    attackConfirm = box;
    atk.addEventListener('click', () => { closeAttackConfirm(); moveSelected(dir); });
    cnc.addEventListener('click', closeAttackConfirm);
  }

  // next idle unit — skips fortified and working units unless selected by
  // hand; NEAREST first, so the camera glides instead of teleporting
  function nextUnit() {
    const movable = Object.values(session.state.units).filter(
      u => u.owner === ctx.HUMAN && u.moves > 0 && !u.fortified && !u.working && u.id !== sel.unitId
        && !(ctx.automate && ctx.automate.isSentried(u.id)) // C4: asleep units skip cycling
    );
    if (movable.length === 0) {
      hud.note('no units with moves left — E to end turn');
      hud.noMovesHint(); // XIV §20: the unified hint (adds 🔕, honors the mute option) — was a bare banner
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
          && !(ctx.automate && ctx.automate.isSentried(u.id)) // C4: asleep = not idle
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
        const pc = state.cities[pending[0]];
        panels.openCityPanel(pending[0]);
        // XIV §47: name the specific thing + carry a §35 🔍 zoom to the city
        const done = needsOrders[pending[0]];
        const what = done && done.verb && done.name ? `${done.verb} ${done.name}` : 'completed its work';
        hud.banner(`🏭 ${pc.name} ${what} — choose production, or E again to continue`, { x: pc.x, y: pc.y });
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
  let lastHoverTile = null; // XIV §25: tile under the cursor (for right-long-press goto)
  // (the step vectors + candidate rule live in move-hints greedySteps — A68)

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
    // XV §10: if an enemy unit sits on the DIRECT step toward the target, STOP at
    // the block and hand control back — no silent re-route around it, no repeated
    // bump. (Terrain still re-routes normally via findPath below; this is enemies.)
    const toward = stepDir(state.map, unit, target.x, target.y);
    if (toward) {
      const v = DIR_VEC[toward];
      let ex = unit.x + v[0];
      if (state.map.wrapX) ex = ((ex % state.map.width) + state.map.width) % state.map.width;
      const ey = unit.y + v[1];
      if (ey >= 0 && ey < state.map.height && ex >= 0 && ex < state.map.width
          && unitsAt(state, ex, ey).some(u => u.owner !== ctx.HUMAN)) {
        delete gotoTargets[unitId];
        hud.note('🎯 an enemy blocks the route — GoTo stopped');
        return false;
      }
    }
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
    // A68 (VIII.17): the candidates are domain-checked (move-hints
    // greedySteps) — a ship never even attempts a land step; enemy tiles
    // stay excluded (never auto-attack), fog tiles stay ventureable
    const options = greedySteps(state, unit, target, session.ruleset);
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
    // XIV §23: pace between units (~200ms) so a watcher can follow each unit's
    // move render fully before the next starts. Render-only (a setTimeout — no
    // engine state); toggle 'showUnitMove' (default ON) turns it instant.
    const pace = (!ctx.options || ctx.options.get('showUnitMove') !== false) ? 200 : 0;
    let first = true;
    for (const unitId of Object.keys(gotoTargets).sort()) {
      const u = session.state.units[unitId];
      if (!u) { delete gotoTargets[unitId]; continue; }
      if (u.owner !== ctx.HUMAN || session.state.activePlayer !== ctx.HUMAN) continue;
      if (!first && pace > 0) await new Promise(r => setTimeout(r, pace));
      first = false;
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
    // A68 (VIII.17): the drawn greedy walk uses the SAME candidate rule as
    // the runner (move-hints greedySteps, domain-checked) — the preview must
    // never show a beach route a ship won't take
    const points = [{ x: unit.x, y: unit.y }];
    let ghost = { ...unit };
    let guard = 120;
    while ((ghost.x !== target.x || ghost.y !== target.y) && guard-- > 0) {
      const options = greedySteps(state, ghost, target, session.ruleset);
      if (options.length === 0) break; // blocked: the route ends where the unit would stop
      ghost = { ...ghost, x: options[0].nx, y: options[0].ny };
      points.push({ x: ghost.x, y: ghost.y });
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
        // XIV §47: remember WHAT was completed so the prompt can name it
        needsOrders[e.cityId] = e.type === 'buildingBuilt'
          ? { verb: 'completed', name: (session.ruleset.buildings[e.building] || {}).name }
          : e.type === 'wonderBuilt'
            ? { verb: 'finished', name: (session.ruleset.wonders[e.wonder] || {}).name }
            : { verb: null }; // wonderLost: kept shields, but no completion to name
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
    // XIV §7: on touch, the selected unit gets on-screen STEP arrows (keyboard
    // WASD/arrows have no touch equivalent). moveSelected resolves an attack if
    // the step lands on an enemy — the combat overlay shows the odds first.
    if (isCoarse() && unit.moves > 0 && !unit.working) {
      actions.push({ label: '▲', title: 'step north', run: () => touchStep('N') });
      actions.push({ label: '◀', title: 'step west', run: () => touchStep('W') });
      actions.push({ label: '▶', title: 'step east', run: () => touchStep('E') });
      actions.push({ label: '▼', title: 'step south', run: () => touchStep('S') });
    }
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
      // A68 (VIII.9): inapplicable jobs gray out with the why, no error bounce
      actions.push({ label: irrigateLabel, key: 'I', run: () => startWorkFor('irrigate'),
        blocked: workBlocked(unit, 'irrigate') });
      actions.push({ label: mineLabel, key: 'M', run: () => startWorkFor('mine'),
        blocked: workBlocked(unit, 'mine') });
      actions.push({ label: rail ? '🚂 Railroad' : '🛤 Road', key: 'R',
        run: () => startWorkFor(rail ? 'railroad' : 'road'),
        blocked: workBlocked(unit, rail ? 'railroad' : 'road') });
      if (me.techs.includes(session.ruleset.rules.fortressTech) && tile0.fortress !== true) {
        actions.push({ label: '🏰 Fortress', key: 'O', run: () => startWorkFor('fortress'),
          blocked: workBlocked(unit, 'fortress') });
      }
    }
    if (helpWonderCityFor(unit)) {
      const added = session.ruleset.units[unit.type].cost;
      actions.push({ label: `🏛 Help Wonder (+${added} shields, consumed)`, key: 'H', run: helpWonderSelected });
    }
    // N11 (CP18): upgrade — shown when the successor's tech is known; label
    // carries the computed gold cost; veteran-carries in the tooltip
    const upGate = upgradeStateFor(unit);
    if (upGate) {
      actions.push({
        label: `⬆ Upgrade to ${upGate.to.name} (💰${upGate.cost})`, key: 'K', run: upgradeSelected,
        blocked: upGate.blocked ? REASON_TEXT[upGate.blocked] : undefined,
        title: 'pays gold, keeps veteran status, spent moves stay spent'
      });
    }
    // A89: establish trade route (feature-detected; grayed with the why when
    // a leg fails — the A68 blocked pattern)
    const trGate = tradeRouteStateFor(unit);
    if (trGate) {
      actions.push({
        label: '🐫 Trade route (consumed)', key: 'Y', run: establishRouteSelected,
        blocked: trGate.blocked ? REASON_TEXT[trGate.blocked] : undefined
      });
    }
    if (!unit.fortified) actions.push({ label: '🛡 Fortify', key: 'F', run: fortifySelected });
    // C4: sentry (any unit) + settler automation — client-side layers
    if (ctx.automate) {
      const asleep = ctx.automate.isSentried(unit.id);
      actions.push({ label: asleep ? '⏰ Wake' : '😴 Sentry', key: 'V', run: sentrySelected });
      if (unit.type === 'settlers') {
        const auto = ctx.automate.isAuto(unit.id);
        actions.push({ label: auto ? '🤖 Stop auto' : '🤖 Automate', key: 'U', run: autoSelected });
        if (auto && ctx.automate.getPriority) {
          const LABELS = { balanced: '⚖ Balanced', food: '🌾 Food', shield: '⚒ Shield', trade: '➡ Trade' };
          actions.push({ label: LABELS[ctx.automate.getPriority()] || '⚖ Balanced',
            title: 'auto-improve priority — click to cycle Balanced / Food / Shield / Trade',
            run: cyclePrioritySelected });
        }
      }
    }
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
      if (a.blocked) {
        btn.disabled = true;
        btn.title = a.blocked; // the why, on hover
      } else {
        if (a.title) btn.title = a.title; // N11: informational hover (veteran carries)
        btn.addEventListener('click', a.run);
      }
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

  // A68 (VIII.16): the viewer's visibility mask, cached per state change —
  // the hover handler fog-gates enemy identity through it (raw-state unit
  // lookups would leak hidden stacks)
  let visMask = null;
  session.onChange(() => { visMask = null; });
  function tileVisible(x, y) {
    if (visMask === null) visMask = computeVisible(session.state, ctx.HUMAN);
    return visMask[y * session.state.map.width + x] === 1;
  }

  // XIV §24: after 300ms hovering an EMPTY, fog-VISIBLE tile (no unit/city), a
  // small card shows the tile's food/shields/trade. Shares ctx.hoverCard with
  // §22/§27. Fog-honest: unexplored/unseen tiles never reveal yields.
  let yieldTimer = null, yieldKey = null;
  function cityAtTile(x, y) {
    for (const cid of session.state.cityOrder || []) {
      const c = session.state.cities[cid];
      if (c && c.x === x && c.y === y) return true;
    }
    return false;
  }
  function clearYieldCard() {
    if (yieldTimer) { clearTimeout(yieldTimer); yieldTimer = null; }
    yieldKey = null;
    if (ctx.hoverCard) ctx.hoverCard.hide();
  }
  function maybeYieldCard(pick) {
    if (!ctx.hoverCard || !pick) { clearYieldCard(); return; }
    const x = pick.tile.x, y = pick.tile.y;
    const key = x + ',' + y;
    if (key === yieldKey) return; // same tile: leave the running timer/card be
    clearYieldCard();
    if (!tileVisible(x, y)) return; // fog: no yields for tiles we can't see
    if (unitsAt(session.state, x, y).length > 0 || cityAtTile(x, y)) return; // empty only
    yieldKey = key;
    yieldTimer = setTimeout(() => {
      const tile = session.state.map.tiles[y * session.state.map.width + x];
      const yl = tileYields(tile, session.ruleset);
      const card = document.createElement('div');
      card.className = 'hover-yields';
      card.innerHTML = `<b>(${x},${y}) ${tile.t}</b>`
        + `<span class="yf">🌾${yl.food}</span> <span class="ys">⚒${yl.shields}</span> <span class="yt">💰${yl.trade}</span>`;
      ctx.hoverCard.showAt(lastPointer.x, lastPointer.y, card);
    }, 300);
  }
  window.addEventListener('pointerdown', clearYieldCard);

  renderer.onHover(pick => {
    // XV §2: suspend the tile-hover readout while the research panel is open — it
    // otherwise flickers over the panel and distracts from picking research.
    const rp = document.getElementById('research-panel');
    if (rp && !rp.classList.contains('hidden')) {
      hud.tile('');
      if (ctx.hoverCard) ctx.hoverCard.hide();
      return;
    }
    lastHoverTile = pick ? { x: pick.tile.x, y: pick.tile.y } : null; // XIV §25
    maybeYieldCard(pick); // XIV §24 (all viewers, spectators included)
    if (ctx.SPECTATOR) {
      spectatorTip(pick);
      hud.tile(pick ? describeTile(pick.tile.x, pick.tile.y) : '');
      return;
    }
    let text = pick ? describeTile(pick.tile.x, pick.tile.y) : '';
    // A68 (VIII.16): a VISIBLE enemy under the cursor names itself — civ,
    // type, stats (stacks are single-owner; the count covers the rest)
    if (pick && tileVisible(pick.tile.x, pick.tile.y)) {
      const foes = unitsAt(session.state, pick.tile.x, pick.tile.y)
        .filter(u => u.owner !== ctx.HUMAN);
      if (foes.length > 0) {
        const t = units[foes[0].type];
        text += `\n${whoName(session.state, foes[0].owner)} · ${t.name}`
          + `${foes[0].veteran ? ' ★vet' : ''} · ⚔${t.attack} 🛡${t.defense}`
          + (foes.length > 1 ? ` (+${foes.length - 1} more)` : '');
      }
    }
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
        if (odds) { text += `\n${odds}`; if (ctx.advice) ctx.advice.offer('combat-hover'); } // A78
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
    if (city && city.owner === ctx.HUMAN) { panels.openCityPanel(city.id); return; }
    // XIV §7: on touch, double-tap an open tile = move the selected unit there —
    // one adjacent step (attacks an enemy on it), or a GoTo route if farther.
    if (isCoarse() && sel.unitId && session.state.units[sel.unitId]) {
      const u = session.state.units[sel.unitId];
      const dx = pick.tile.x - u.x, dy = pick.tile.y - u.y;
      if (dx === 0 && dy === 0) return;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        touchStep((dy < 0 ? 'N' : dy > 0 ? 'S' : '') + (dx > 0 ? 'E' : dx < 0 ? 'W' : ''));
      } else {
        gotoTargets[sel.unitId] = { x: pick.tile.x, y: pick.tile.y };
        runGoto(sel.unitId);
        refreshActionBar();
      }
    }
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
      // C4: clicking a sentried unit wakes it (Civ2 behavior)
      if (ctx.automate && ctx.automate.isSentried(clicked.id)) {
        ctx.automate.wake(clicked.id);
        hud.note('⏰ awake');
      }
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

  // XIV §25: suppress the browser context menu on the map, and treat a RIGHT-
  // button LONG-press (>300ms) as GoTo for the selected unit to the hovered
  // tile (touch long-press semantics). A plain right-click does nothing.
  const mapCanvas = renderer.domElement;
  if (mapCanvas) {
    mapCanvas.addEventListener('contextmenu', e => e.preventDefault());
    let rightHold = null;
    const clearRightHold = () => { if (rightHold) { clearTimeout(rightHold); rightHold = null; } };
    mapCanvas.addEventListener('pointerdown', e => {
      if (e.button !== 2) return; // right button only
      clearRightHold();
      rightHold = setTimeout(() => {
        rightHold = null;
        const st = session.state;
        if (sel.unitId && st.units[sel.unitId] && lastHoverTile
            && st.units[sel.unitId].owner === ctx.HUMAN && st.activePlayer === ctx.HUMAN) {
          gotoTargets[sel.unitId] = { x: lastHoverTile.x, y: lastHoverTile.y };
          runGoto(sel.unitId);
          refreshActionBar();
        }
      }, 300);
    });
    mapCanvas.addEventListener('pointerup', clearRightHold);
    mapCanvas.addEventListener('pointercancel', clearRightHold);
    mapCanvas.addEventListener('pointerleave', clearRightHold);
  }

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
    // A17: a spectator inspects with the mouse (hover/click) and cycles an open
    // city panel with the arrows above, but issues NO commands — every unit/city/
    // turn action key below is a seated-player order, a no-op for the seatless
    // viewer (several also read players[ctx.HUMAN], which a spectator lacks).
    if (ctx.SPECTATOR) return;
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
    if (e.key === 'v' && sel.unitId) { sentrySelected(); return; }   // C4 sentry
    if (e.key === 'u' && sel.unitId) { autoSelected(); return; }     // C4 automate
    if (e.key === 'y' && sel.unitId) { establishRouteSelected(); return; } // A89 trade route
    if (e.key === 'k' && sel.unitId) { upgradeSelected(); return; }        // N11 upgrade
    if (e.key === 'h' && sel.unitId) { helpWonderSelected(); return; }
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
      // spectators have no seat/capital — the "found a city first" prompt is
      // a seated-player message, irrelevant to a view-only spectator (silent).
      else if (!ctx.SPECTATOR) hud.note('no capital yet — found a city first');
      return;
    }
    if (PRODUCTION_KEYS[e.key] && sel.cityId) {
      apply({ type: 'setProduction', playerId: session.state.activePlayer, cityId: sel.cityId, item: { kind: 'unit', id: PRODUCTION_KEYS[e.key] } });
    }
  });
}

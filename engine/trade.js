// A89 / N10 caravan trade routes (specs/n10-caravans.md). A caravan standing in
// a city establishes a route from its HOME city to that partner city: a one-time
// windfall (cash AND research bulbs, full each, to the sender) plus a LIVE
// permanent trade bonus on the home city (top routeCap routes count). All numbers
// live in rules.tradeRoute; nothing is hardcoded here. Lua-portable subset.
//
// R1 (reviewer #1392): both formulas use BASE arrows — the post-corruption,
// pre-split city trade EXCLUDING route contributions — at BOTH endpoints; route
// bonuses add ON TOP. tradeArrows() is exactly the playerIncome seam value
// (cityYields.trade − corruption), which carries no route term, so there is no
// self-referential cross-city fixpoint (a determinism/twins hazard).
import { cityYields } from './cities.js';
import { corruptionFor } from './government.js';

function idiv(a, b) { return Math.floor(a / b); }

function wrapX(map, x) {
  if (!map.wrapX) return x;
  return ((x % map.width) + map.width) % map.width;
}

function chebyshev(map, ax, ay, bx, by) {
  let dx = Math.abs(ax - bx);
  if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
  const dy = Math.abs(ay - by);
  return dx > dy ? dx : dy;
}

// The city on tile (x, y), or null. Local scan (keeps trade.js off combat.js).
function cityAtTile(state, x, y) {
  for (const cid of state.cityOrder || []) {
    const c = state.cities[cid];
    if (c && c.x === x && c.y === y) return c;
  }
  return null;
}

// BASE trade arrows for a city: post-corruption, pre-split, EXCLUDING routes.
function tradeArrows(state, city, ruleset) {
  const raw = cityYields(state, city, ruleset).trade;
  return raw - corruptionFor(state, city, raw, ruleset);
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

function isLand(state, ruleset, x, y) {
  const t = state.map.tiles[y * state.map.width + x];
  return ruleset.terrain.terrains[t.t].domain !== 'sea';
}

// Are the two city tiles connected over LAND (non-ocean), 8-way, wrapX-aware?
// Iterative flood fill, plain-object visited keyed by tile index (no Set/Map;
// never recursion — a continent-sized fill must not stress the Luau stack). Only
// the boolean leaves the function, so BFS order need not match cross-language.
function landConnected(state, x1, y1, x2, y2, ruleset) {
  const map = state.map;
  const w = map.width;
  const start = y1 * w + x1;
  const target = y2 * w + x2;
  if (start === target) return true;
  const visited = {};
  visited[start] = true;
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head];
    head = head + 1;
    const cx = cur % w;
    const cy = idiv(cur, w);
    for (const d of N8) {
      const ny = cy + d[1];
      if (ny < 0 || ny >= map.height) continue;
      let nx = cx + d[0];
      if (map.wrapX) nx = wrapX(map, nx);
      else if (nx < 0 || nx >= w) continue;
      if (!isLand(state, ruleset, nx, ny)) continue;
      const ni = ny * w + nx;
      if (ni === target) return true;
      if (visited[ni] === true) continue;
      visited[ni] = true;
      queue.push(ni);
    }
  }
  return false;
}

function applyMul(x, m) { return idiv(x * m.num, m.den); }

// The one-time windfall paid to the sender (home's owner) — cash and bulbs, full
// amount each. Multipliers in the FIXED order continent → civ → railroad →
// flight (integer division makes order significant; pinned in a scenario).
function windfall(state, home, partner, ruleset) {
  const tr = ruleset.rules.tradeRoute;
  const dist = chebyshev(state.map, home.x, home.y, partner.x, partner.y);
  const arrows = tradeArrows(state, home, ruleset) + tradeArrows(state, partner, ruleset);
  let amt = idiv((dist + tr.windfallDistanceBonus) * arrows, tr.windfallDivisor);
  if (landConnected(state, home.x, home.y, partner.x, partner.y, ruleset)) amt = applyMul(amt, tr.sameContinent);
  if (home.owner === partner.owner) amt = applyMul(amt, tr.sameCiv);
  const sender = state.players[home.owner];
  if (sender.techs.indexOf(tr.railroad.tech) !== -1) amt = applyMul(amt, tr.railroad);
  if (sender.techs.indexOf(tr.flight.tech) !== -1) amt = applyMul(amt, tr.flight);
  return amt;
}

// One route's live permanent contribution to the home city's arrows.
function routeContribution(state, home, partner, ruleset) {
  const tr = ruleset.rules.tradeRoute;
  const a = tradeArrows(state, home, ruleset) + tradeArrows(state, partner, ruleset) + tr.permanentPad;
  let c = idiv(a, tr.permanentDivisor);
  if (home.owner === partner.owner) c = applyMul(c, tr.sameCiv);
  return c;
}

// The permanent trade bonus added to `city`'s arrows: the sum of its top
// routeCap routes' contributions (ranked desc, ties by LOWER partnerCityId).
// Routes past the cap remain in state but do not count. A route to a destroyed
// partner is skipped (defensive prune; capture keeps the id so routes survive it).
function routeArrows(state, city, ruleset) {
  if (city.tradeRoutes === undefined || city.tradeRoutes.length === 0) return 0;
  const tr = ruleset.rules.tradeRoute;
  const list = [];
  for (const r of city.tradeRoutes) {
    const partner = state.cities[r.partnerCityId];
    if (!partner) continue;
    list.push({ pid: r.partnerCityId, c: routeContribution(state, city, partner, ruleset) });
  }
  list.sort((p, q) => q.c - p.c || (p.pid < q.pid ? -1 : p.pid > q.pid ? 1 : 0));
  let sum = 0;
  const cap = tr.routeCap;
  for (let i = 0; i < list.length && i < cap; i++) sum = sum + list[i].c;
  return sum;
}

// The establishTradeRoute command (explicit, both endpoints derived — A83
// helpWonder precedent). partner = city on the unit's tile; home = unit's home.
function establishTradeRoute(state, cmd, ruleset) {
  const unit = state.units[cmd.unitId];
  if (!unit) return { ok: false, reason: 'unknownUnit' };
  if (unit.owner !== cmd.playerId) return { ok: false, reason: 'notYourUnit' };
  if (state.activePlayer !== cmd.playerId) return { ok: false, reason: 'notYourTurn' };
  const def = ruleset.units[unit.type];
  if (!def || def.tradeRoutes !== true) return { ok: false, reason: 'notCaravan' };
  const partner = cityAtTile(state, unit.x, unit.y);
  if (partner === null) return { ok: false, reason: 'cityRequired' };
  const home = unit.home === undefined ? null : state.cities[unit.home];
  if (!home || home.owner !== unit.owner) return { ok: false, reason: 'noHomeCity' };
  if (partner.id === home.id) return { ok: false, reason: 'sameCity' };
  const routes = home.tradeRoutes === undefined ? [] : home.tradeRoutes;
  for (const r of routes) {
    if (r.partnerCityId === partner.id) return { ok: false, reason: 'duplicateRoute' };
  }
  // domestic partner (same civ) must be at least the minimum distance from home;
  // foreign partners establish at any distance (spec ruling 4 / reviewer R2).
  if (partner.owner === home.owner) {
    const dist = chebyshev(state.map, home.x, home.y, partner.x, partner.y);
    if (dist < ruleset.rules.tradeRoute.minDomesticDistance) return { ok: false, reason: 'ownCityTooClose' };
  }
  const amt = windfall(state, home, partner, ruleset);
  const sender = state.players[home.owner];
  sender.gold = sender.gold + amt;
  sender.bulbs = sender.bulbs + amt;
  if (home.tradeRoutes === undefined) home.tradeRoutes = [];
  home.tradeRoutes.push({ partnerCityId: partner.id });
  delete state.units[cmd.unitId];
  return { ok: true, events: [{
    type: 'tradeRouteEstablished', playerId: home.owner,
    cityId: home.id, partnerCityId: partner.id, gold: amt, bulbs: amt
  }] };
}

// A derived, engine-authored view of a city's routes for the client panel — so
// the client never re-derives the R1 base-arrows ranking. Every route in STATE
// order with its live permanent contribution (`arrows`) and whether it is among
// the top routeCap that actually count (`counted`). Pure read; golden-neutral.
function tradeRouteReport(state, city, ruleset) {
  const out = [];
  if (city.tradeRoutes === undefined) return out;
  const tr = ruleset.rules.tradeRoute;
  const ranked = [];
  for (const r of city.tradeRoutes) {
    const partner = state.cities[r.partnerCityId];
    if (!partner) continue;
    ranked.push({ pid: r.partnerCityId, c: routeContribution(state, city, partner, ruleset) });
  }
  ranked.sort((p, q) => q.c - p.c || (p.pid < q.pid ? -1 : p.pid > q.pid ? 1 : 0));
  const counted = {};
  for (let i = 0; i < ranked.length && i < tr.routeCap; i++) counted[ranked[i].pid] = true;
  for (const r of city.tradeRoutes) {
    const partner = state.cities[r.partnerCityId];
    const arrows = partner ? routeContribution(state, city, partner, ruleset) : 0;
    out.push({ partnerCityId: r.partnerCityId, arrows, counted: counted[r.partnerCityId] === true });
  }
  return out;
}

export { establishTradeRoute, routeArrows, tradeRouteReport, tradeArrows, windfall, landConnected, cityAtTile };

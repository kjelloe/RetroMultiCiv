// C4 (specs/civ24-features-proposal.md §4+§5): sentry-with-wake and settler
// automation — both PURE CLIENT layers: sentry is a next-unit cycling filter
// with a wake check (no engine flag), automation is a click generator that
// issues ordinary logged move/startWork commands during the player's turn.
// Fog honesty is structural: every decision reads the fog-filtered view.
// Storage: localStorage keyed by game + playerId (never game state); losing
// it is acceptable — convenience, not rules.
import { filterView } from '../../engine/visibility.js';

const WAKE_RADIUS = 2; // spec §4's suggested N

export function initAutomate(ctx) {
  const { session, hud } = ctx;
  const gameKey = session.gameId || (ctx.gameCode && ctx.gameCode()) || 'local';

  function storeKey(pid) { return `retromulticiv-auto:${gameKey}:${pid}`; }
  function load() {
    try { return JSON.parse(localStorage.getItem(storeKey(ctx.HUMAN))) || { sentry: [], auto: [] }; }
    catch (e) { return { sentry: [], auto: [] }; }
  }
  function save(data) {
    try { localStorage.setItem(storeKey(ctx.HUMAN), JSON.stringify(data)); } catch (e) { /* convenience */ }
  }

  function isSentried(uid) { return load().sentry.indexOf(uid) !== -1; }
  function isAuto(uid) { return load().auto.indexOf(uid) !== -1; }
  function toggleSentry(uid) {
    const d = load();
    const i = d.sentry.indexOf(uid);
    if (i === -1) d.sentry.push(uid); else d.sentry.splice(i, 1);
    save(d);
    return i === -1;
  }
  function toggleAuto(uid) {
    const d = load();
    const i = d.auto.indexOf(uid);
    if (i === -1) d.auto.push(uid); else d.auto.splice(i, 1);
    save(d);
    return i === -1;
  }
  function wake(uid) {
    const d = load();
    const i = d.sentry.indexOf(uid);
    if (i !== -1) { d.sentry.splice(i, 1); save(d); }
  }
  function cancelAuto(uid) {
    const d = load();
    const i = d.auto.indexOf(uid);
    if (i !== -1) { d.auto.splice(i, 1); save(d); }
  }

  function wrapDx(map, ax, bx) {
    let dx = bx - ax;
    if (map.wrapX) {
      if (dx > map.width / 2) dx -= map.width;
      if (dx < -map.width / 2) dx += map.width;
    }
    return dx;
  }
  function dist(map, ax, ay, bx, by) {
    const dx = Math.abs(wrapDx(map, ax, bx)), dy = Math.abs(ay - by);
    return dx > dy ? dx : dy;
  }

  // prune dead/foreign ids, keeping the store tidy across deaths + hotseat
  function prune(state) {
    const d = load();
    const mine = uid => state.units[uid] && state.units[uid].owner === ctx.HUMAN;
    const s = d.sentry.filter(mine), a = d.auto.filter(mine);
    if (s.length !== d.sentry.length || a.length !== d.auto.length) {
      save({ sentry: s, auto: a });
    }
  }

  // --- sentry wake check (§4): an enemy VISIBLE within the radius wakes the
  // unit with a toast; the view is the fog — unseen enemies never wake
  function checkWakes(state) {
    const d = load();
    if (d.sentry.length === 0) return;
    const view = filterView(state, ctx.HUMAN);
    for (const uid of d.sentry.slice()) {
      const u = state.units[uid];
      if (!u) continue;
      for (const vid of Object.keys(view.units)) {
        const e = view.units[vid];
        if (e.owner === ctx.HUMAN) continue;
        if (dist(view.map, u.x, u.y, e.x, e.y) <= WAKE_RADIUS) {
          wake(uid);
          const etype = session.ruleset.units[e.type] ? session.ruleset.units[e.type].name : e.type;
          const mtype = session.ruleset.units[u.type] ? session.ruleset.units[u.type].name : u.type;
          hud.banner(`⏰ ${mtype} at (${u.x},${u.y}) wakes — enemy ${etype} sighted`);
          break;
        }
      }
    }
  }

  // --- settler automation (§5, option a): a small VIEW-BASED policy — the
  // nearest own-city worked tile lacking its improvement, in the improver
  // corps' order (road → mine-where-better → irrigate → rail), all legality
  // read from the view + ruleset; the engine stays the arbiter (a rejected
  // command just ends the unit's turn slice). No engine/ai.js import — the
  // view legitimately omits fields full-state code may read (spec's (b) trap).
  function findJob(view, unit) {
    const map = view.map;
    const me = view.players[ctx.HUMAN];
    const terrains = session.ruleset.terrain.terrains;
    const knowsRail = me.techs !== undefined && me.techs.indexOf(session.ruleset.rules.railroadTech) !== -1;
    let best = null, bestD = 9999;
    for (const cid of view.cityOrder || []) {
      const city = view.cities[cid];
      if (!city || city.owner !== ctx.HUMAN) continue;
      if (dist(map, unit.x, unit.y, city.x, city.y) > 6) continue;
      // the city's fat cross from the view: own cities carry workers/pop; use
      // the 21-tile footprint and improve any unimproved LAND tile in it
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue; // corners off
          if (dx === 0 && dy === 0) continue; // the center works itself
          let x = city.x + dx;
          const y = city.y + dy;
          if (y < 0 || y >= map.height) continue;
          if (x < 0 || x >= map.width) {
            if (!map.wrapX) continue;
            x = ((x % map.width) + map.width) % map.width;
          }
          const tile = map.tiles[y * map.width + x];
          if (tile.t === 'unknown') continue; // fog: never plan into the void
          const terrain = terrains[tile.t];
          if (!terrain || terrain.domain !== 'land') continue;
          let occupiedByCity = false;
          for (const ocid of view.cityOrder || []) {
            const oc = view.cities[ocid];
            if (oc && oc.x === x && oc.y === y) occupiedByCity = true;
          }
          if (occupiedByCity) continue;
          let hostile = false;
          for (const vid of Object.keys(view.units)) {
            const e = view.units[vid];
            if (e.owner !== ctx.HUMAN && e.x === x && e.y === y) hostile = true;
          }
          if (hostile) continue;
          const water = tile.river === true || (() => {
            for (let ny = -1; ny <= 1; ny++) {
              for (let nx = -1; nx <= 1; nx++) {
                if (nx === 0 && ny === 0) continue;
                const yy = y + ny;
                if (yy < 0 || yy >= map.height) continue;
                let xx = x + nx;
                if (xx < 0 || xx >= map.width) {
                  if (!map.wrapX) continue;
                  xx = ((xx % map.width) + map.width) % map.width;
                }
                const t = map.tiles[yy * map.width + xx];
                if (t.t === 'ocean' || t.river === true || t.irrigation === true) return true;
              }
            }
            return false;
          })();
          const canIrrigate = tile.irrigation !== true && tile.mine !== true
            && terrain.irrigate !== undefined && water;
          const canMine = tile.irrigation !== true && tile.mine !== true
            && terrain.mine !== undefined && tile.river !== true;
          const mineBetter = canMine && (!canIrrigate || terrain.mine.shields > terrain.irrigate.food);
          const canRail = knowsRail && tile.road === true && tile.railroad !== true;
          const roadNeedsBridge = tile.river === true
            && (me.techs === undefined || me.techs.indexOf(session.ruleset.rules.bridgeTech) === -1);
          let work = null;
          if (tile.road !== true && !roadNeedsBridge) work = 'road';
          else if (mineBetter) work = 'mine';
          else if (canIrrigate) work = 'irrigate';
          else if (canRail) work = 'railroad';
          if (work === null) continue;
          const dd = dist(map, unit.x, unit.y, x, y);
          if (dd < bestD) { bestD = dd; best = { x, y, work }; }
        }
      }
    }
    return best;
  }

  function stepDir(map, unit, tx, ty) {
    const dx = Math.sign(wrapDx(map, unit.x, tx));
    const dy = Math.sign(ty - unit.y);
    const name = (dy === -1 ? 'N' : dy === 1 ? 'S' : '') + (dx === 1 ? 'E' : dx === -1 ? 'W' : '');
    return name === '' ? null : name;
  }

  let driving = false;
  async function drive() {
    if (driving) return;
    const state0 = session.state;
    if (state0.gameOver === true || state0.activePlayer !== ctx.HUMAN) return;
    const d = load();
    if (d.auto.length === 0) return;
    driving = true;
    try {
      for (const uid of d.auto.slice()) {
        // re-check per action: hand-off or a turn change stops the driver
        for (let steps = 0; steps < 8; steps++) {
          const state = session.state;
          if (state.activePlayer !== ctx.HUMAN) return;
          const unit = state.units[uid];
          if (!unit || unit.owner !== ctx.HUMAN || unit.type !== 'settlers') { cancelAuto(uid); break; }
          if (unit.moves <= 0 || unit.working) break;
          const view = filterView(state, ctx.HUMAN);
          const job = findJob(view, view.units[uid] || unit);
          if (!job) break;
          if (unit.x === job.x && unit.y === job.y) {
            const res = await session.apply({
              type: 'startWork', playerId: ctx.HUMAN, unitId: uid, work: job.work
            });
            if (res && res.ok !== false) {
              if (ctx.turnlog && ctx.turnlog.note) ctx.turnlog.note(`🤖 settler starts ${job.work} at (${job.x},${job.y})`, 'log-cities');
            }
            break; // working (or rejected — either way this unit is done)
          }
          const dir = stepDir(state.map, unit, job.x, job.y);
          if (!dir) break;
          const res = await session.apply({ type: 'moveUnit', playerId: ctx.HUMAN, unitId: uid, dir });
          if (!res || res.ok === false) break; // blocked: the engine arbitrates
        }
      }
    } finally {
      driving = false;
    }
  }

  session.onChange(state => {
    prune(state);
    checkWakes(state);
    if (state.activePlayer === ctx.HUMAN && !ctx.SPECTATOR) drive();
  });

  return { isSentried, isAuto, toggleSentry, toggleAuto, wake, cancelAuto, drive };
}

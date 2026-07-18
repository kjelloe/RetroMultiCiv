// C3 (Civ3/4 QoL, specs/civ24-features-proposal.md §3): the per-city build
// queue — an ordered client-side list of build targets; when production
// completes, the client issues the next setProduction EXACTLY as a human
// click would (logged command, replay-exact by construction). A54 landed:
// setProduction is off-turn whitelisted, so the advance fires immediately on
// the completion event — no waiting for the turn to come round.
// Storage: localStorage keyed by game + playerId (NEVER game state — a
// state field would move every hash). Losing a queue on key drift is
// acceptable: convenience, not rules (the spec's sentry clause).

const COMPLETION_EVENTS = { unitBuilt: 1, buildingBuilt: 1, wonderBuilt: 1, ssPartBuilt: 1 };

export function initBuildQueue(ctx) {
  const { session } = ctx;
  // stable-within-session game key: the server's gameId when joined, else the
  // boot-time docs/07 code of the loaded state (local + hotseat)
  const gameKey = session.gameId || (ctx.gameCode && ctx.gameCode()) || 'local';

  function storeKey(pid) { return `retromulticiv-bq:${gameKey}:${pid}`; }
  function load(pid) {
    try { return JSON.parse(localStorage.getItem(storeKey(pid))) || {}; }
    catch (e) { return {}; }
  }
  function save(pid, all) {
    try { localStorage.setItem(storeKey(pid), JSON.stringify(all)); } catch (e) { /* full/blocked: queue is a convenience */ }
  }

  function get(cityId) { return load(ctx.HUMAN)[cityId] || []; }
  function set(cityId, items) {
    const all = load(ctx.HUMAN);
    if (items.length === 0) delete all[cityId];
    else all[cityId] = items;
    save(ctx.HUMAN, all);
  }
  function add(cityId, item) {
    const q = get(cityId);
    q.push({ kind: item.kind, id: item.id });
    set(cityId, q);
  }
  function removeAt(cityId, idx) {
    const q = get(cityId);
    q.splice(idx, 1);
    set(cityId, q);
  }
  function move(cityId, idx, dir) {
    const q = get(cityId);
    const j = idx + dir;
    if (j < 0 || j >= q.length) return;
    const [it] = q.splice(idx, 1);
    q.splice(j, 0, it);
    set(cityId, q);
  }

  function itemName(item) {
    const table = item.kind === 'unit' ? session.ruleset.units
      : item.kind === 'wonder' ? session.ruleset.wonders : session.ruleset.buildings;
    return (table[item.id] && table[item.id].name) || item.id;
  }

  function note(text) {
    if (ctx.turnlog && ctx.turnlog.note) ctx.turnlog.note(text, 'log-cities');
    else if (ctx.hud && ctx.hud.note) ctx.hud.note(text);
  }

  // On a completion in one of MY cities with a queue: issue setProduction for
  // the head; an illegal head (obsoleted unit, built building, wonder built
  // elsewhere) is dropped with a log note and the next tried — one command
  // in flight per city per event, rejections re-enter through their reply.
  async function advance(cityId) {
    const city = session.state.cities[cityId];
    if (!city || city.owner !== ctx.HUMAN) return;
    let q = get(cityId);
    while (q.length > 0) {
      const head = q[0];
      const res = await session.apply({
        type: 'setProduction', playerId: ctx.HUMAN, cityId, item: { kind: head.kind, id: head.id }
      });
      removeAt(cityId, 0);
      if (res && res.ok !== false) {
        note(`⏭ ${city.name}: queue starts ${itemName(head)}`);
        return;
      }
      note(`⏭ ${city.name}: ${itemName(head)} dropped from the queue (${res ? res.reason : 'rejected'}) — trying next`);
      q = get(cityId);
    }
  }

  session.onChange((state, events) => {
    for (const e of events || []) {
      if (COMPLETION_EVENTS[e.type] !== 1) continue;
      const city = state.cities[e.cityId];
      if (!city || city.owner !== ctx.HUMAN) continue;
      if (get(e.cityId).length === 0) continue;
      advance(e.cityId);
    }
  });

  return { get, add, removeAt, move, itemName };
}

// Late-join server logic (specs/late-join-pause.md) — PURE, deterministic
// helpers for the server half: takeover-seat selection (§3) and eviction
// ranking (§7). No sockets, no engine mutation — score/era are injected so the
// units test without a live game. server/index.js wires these to the join/list/
// create dispatch + lifecycle.

// §3 eligible pool: a civ a late-joiner may take over = alive AND
// AI-controlled. An abandoned HUMAN seat keeps players[pid].human === true (the
// rejoin promise, §ruling 1), so !human is exactly "never-human AI civ".
export function takeoverPool(state) {
  return state.playerOrder.filter(pid => {
    const p = state.players[pid];
    return p && p.alive !== false && p.human !== true;
  });
}

// §3 selection (deterministic): rank the eligible pool by score, then
//   >=3 candidates -> drop strongest + weakest, take the strongest remaining
//                     (= SECOND-STRONGEST overall);
//   2 -> the weaker;  1 -> that one;  0 -> null.
// scoreFn(pid) -> integer (engine score.js, fog-free server-side). Ties break
// deterministically by playerOrder position so two servers agree.
export function selectTakeoverSeat(state, scoreFn) {
  const pool = takeoverPool(state);
  if (pool.length === 0) return null;
  const orderOf = pid => state.playerOrder.indexOf(pid);
  const ranked = pool
    .map(pid => ({ pid, s: scoreFn(pid) }))
    .sort((a, b) => (b.s - a.s) || (orderOf(a.pid) - orderOf(b.pid))); // score desc, then stable by order
  if (ranked.length >= 3) return ranked[1].pid; // second-strongest (index 0 dropped, last dropped)
  if (ranked.length === 2) return ranked[1].pid; // the weaker
  return ranked[0].pid;
}

// §7 eviction ranking: which PAUSED game stops first when Create hits the cap.
// games: [{ gameId, eraRank, originalHumans, pausedAt }]. Evict order (first
// match goes): earliest era first (asc eraRank) -> fewer original humans first
// -> longest-paused first (smallest pausedAt). eraRank is the ordinal of the
// city-era band (ancient=0 … modernSpace=3), injected by the caller from
// shared/city-era.js. Returns the gameId to evict, or null if the list is empty.
export function selectEviction(games) {
  if (!games || games.length === 0) return null;
  const sorted = games.slice().sort((a, b) =>
    (a.eraRank - b.eraRank) ||
    (a.originalHumans - b.originalHumans) ||
    (a.pausedAt - b.pausedAt));
  return sorted[0].gameId;
}

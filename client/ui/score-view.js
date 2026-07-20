// Server games hand the client a FOG-FILTERED view (engine/visibility.js): a
// rival player object carries no `techs` field (nor gold/researching — only the
// viewer's own player does). The engine's scoreBreakdown/score read
// player.techs.length, so scoring a rival off a server view throws a TypeError
// — which crashed the end screen (and any other score caller) the instant a
// server game rendered rivals. The real fix lifts fog at gameOver in the engine
// (final standings are world-public in classic Civ), which is routed to the
// engine lane; until then the client scores against a tech-safe shim.
//
// techSafeState returns the state unchanged when every player already carries
// techs (local games, single-player, hotseat), so those hashes/paths are
// untouched. For a fog-filtered view it returns a SHALLOW clone whose fogged
// rivals get an empty tech list — that rival's tech score reads 0, an honest
// "unknown", never a wrong number — and callers mark the row via techFogged so
// the UI shows the count as unknown ('—') rather than a fabricated 0.

export function techFogged(player) {
  return !player || player.techs === undefined;
}

export function techSafeState(state) {
  let players = null;
  for (const pid of state.playerOrder) {
    if (techFogged(state.players[pid])) {
      players = players || { ...state.players };
      players[pid] = { ...state.players[pid], techs: [] };
    }
  }
  return players ? { ...state, players } : state;
}

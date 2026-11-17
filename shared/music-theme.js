// The music theme rule: what is happening in, which piece out. Pure (no timers,
// no audio, no DOM) so node tests it and fastengine copies it into its native
// client as is. The pieces are client/music/pieces/<id>.json; the track ids and
// the era arc follow specs/game-soundtrack-design.md. The player cross-fades
// whenever the answer changes.

export const PIECES = [
  'intro-title', 'loading-age',
  'map-ancient', 'map-renaissance', 'map-industrial', 'map-modern', 'map-space',
  'map-ancient-b', 'map-renaissance-b', 'map-industrial-b', 'map-modern-b',
  'map-war', 'end-victory', 'end-defeat'
];

// a combat involving the viewer this turn or the previous one keeps the war theme
export const WAR_TURNS = 1;
// the four main eras have two pieces each, alternating every MAP_VARIANT_TURNS
// turns, so a long era is not one 40-70 s loop for an hour (brief §8, the
// three-hour test); the swap cross-fades on a turn change
export const MAP_VARIANT_TURNS = 4;
// knowing this tech moves the map music to the space-age piece (the five ages of
// rules.ages; techs.json has four eras, the fifth is the space programme)
export const SPACE_TECH = 'space-flight';

const ERA_RANK = { ancient: 0, renaissance: 1, industrial: 2, modern: 3 };

// The viewer's music moment from a (fog-filtered) view. lastCombatTurn is the
// turn of the viewer's latest seen combat (-1 = none); winnerId is the winner
// when the view omits state.winner (a server view; the gameOver event has it).
export function musicMoment(view, viewer, techsTable, lastCombatTurn, winnerId) {
  const me = view && view.players ? view.players[viewer] : undefined;
  let era = 'ancient';
  let space = false;
  if (me && me.techs && techsTable) {
    for (const id of me.techs) {
      if (id === SPACE_TECH) space = true;
      const t = techsTable[id];
      if (t && ERA_RANK[t.era] !== undefined && ERA_RANK[t.era] > ERA_RANK[era]) era = t.era;
    }
  }
  let outcome = '';
  if (view && view.gameOver === true) {
    const winner = view.winner !== undefined ? view.winner : winnerId;
    outcome = winner === viewer ? 'victory' : 'defeat';
  }
  return { screen: 'game', era, space, turn: view ? view.turn : 0, lastCombatTurn, outcome };
}

// moment: { screen: 'title' | 'loading' | 'game', era, space, turn, lastCombatTurn, outcome }.
// Order: the screen, then a finished game, then war, then the era (two pieces
// each, by turn).
export function themeFor(m) {
  if (m.screen === 'title') return 'intro-title';
  if (m.screen === 'loading') return 'loading-age';
  if (m.outcome === 'victory') return 'end-victory';
  if (m.outcome === 'defeat') return 'end-defeat';
  if (m.lastCombatTurn >= 0 && m.turn - m.lastCombatTurn <= WAR_TURNS) return 'map-war';
  if (m.space) return 'map-space';
  const era = ERA_RANK[m.era] !== undefined ? m.era : 'ancient';
  return Math.floor(m.turn / MAP_VARIANT_TURNS) % 2 === 1 ? 'map-' + era + '-b' : 'map-' + era;
}

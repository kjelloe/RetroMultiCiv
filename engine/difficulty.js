// Difficulty: the per-level knob table (data/rules.json `difficulties`), keyed by
// state.difficulty (ascii id). Split by knob CLASS (architect ruling, #2158):
//   WORLD knobs   (contentCitizens, startGold, barbAtkPct) apply at ALL times,
//                 all-AI games included — authenticity doctrine.
//   ASYMMETRIC    (aiCostPct, aiFoodRows, bulb split) express the AI's handicap
//   AI-vs-human   RELATIVE to a human, so they apply ONLY when a human seat
//                 exists; an all-AI game (soak) stays at today's neutral values.
// state.difficulty absent (crafted scenarios) => difficultyOf returns null and
// every hook falls back to today's value — the omit-safe identity.

function difficultyOf(state, ruleset) {
  if (state.difficulty === undefined) return null;
  const table = ruleset.rules.difficulties;
  if (table === undefined) return null;
  const row = table[state.difficulty];
  return row === undefined ? null : row;
}

function hasHumanSeat(state) {
  const order = state.playerOrder;
  if (order === undefined) return false;
  for (let i = 0; i < order.length; i++) {
    const p = state.players[order[i]];
    if (p !== undefined && p.human === true) return true;
  }
  return false;
}

export { difficultyOf, hasHumanSeat };

// A59 leader-personality read seam (spec a59-leader-personality.md). PURE reads;
// NOTHING in the engine BEHAVES by personality yet — D3 (diplomacy) is the first
// consumer, and a later window makes stance ASSIGNMENT personality-driven. So the
// soak is behaviorally unchanged (the rulesetHash-only shift, A76/N10 class).
//
// Axes are INTEGERS summing to 100 (ruling #1657): floats break statehash, and
// rulesetHash = hashState(ruleset), so personality had to be integer-100 (the ally's
// 0.75 -> 75). D3 compares these integers.

// the stance's implied axes — the fallback when a player has NO leader personality
// (crafted/stanceless states without a civ), so absent data reproduces today. Each
// sums to 100. Twin: luau/leaders.luau STANCE_AXES must match byte-for-byte.
const STANCE_AXES = {
  balanced:   { aggression: 25, science: 25, growth: 25, defense: 25 },
  aggressive: { aggression: 70, science: 10, growth: 10, defense: 10 },
  defensive:  { aggression: 10, science: 10, growth: 10, defense: 70 },
  science:    { aggression: 10, science: 70, growth: 10, defense: 10 },
  growth:     { aggression: 10, science: 10, growth: 70, defense: 10 },
  builder:    { aggression: 10, science: 10, growth: 70, defense: 10 }
};

// the leader's four axes: the civ's personality when present, else the player's
// stance's implied axes (balanced when stanceless). Returns the ruleset object by
// reference — callers READ, never mutate.
function personalityOf(state, pid, ruleset) {
  const player = state.players[pid];
  if (player !== undefined && player.civ !== undefined && ruleset.civs !== undefined) {
    const civ = ruleset.civs[player.civ];
    if (civ !== undefined && civ.personality !== undefined) return civ.personality;
  }
  const stance = (player !== undefined && player.stance !== undefined) ? player.stance : 'balanced';
  return STANCE_AXES[stance] !== undefined ? STANCE_AXES[stance] : STANCE_AXES.balanced;
}

// the axis->stance labels in the fixed order (deterministic tie-break for a partial
// max tie). A FLAT personality (all four axes equal, e.g. Lincoln 25/25/25/25) has
// no dominant axis -> 'balanced' (ruling #1657 labels Lincoln balanced).
const AXIS_STANCE = [['aggression', 'aggressive'], ['science', 'science'], ['growth', 'growth'], ['defense', 'defensive']];

function stanceFromPersonality(personality) {
  let maxVal = -1;
  for (const pair of AXIS_STANCE) if (personality[pair[0]] > maxVal) maxVal = personality[pair[0]];
  let count = 0;
  for (const pair of AXIS_STANCE) if (personality[pair[0]] === maxVal) count = count + 1;
  if (count === 4) return 'balanced';
  for (const pair of AXIS_STANCE) if (personality[pair[0]] === maxVal) return pair[1];
  return 'balanced';
}

// favorites-as-bounded-modifiers (the ally's "not overrides"): a small additive
// score bonus for an owner's favorite unit/wonder. A59 ships the SEAM INERT (bonus
// 0) — the behavioral wiring (favorites nudging AI choice) is a later window with
// its own sweep. Named now so D3/modes have the seam.
function favoriteModifier(_kind, _id, _ruleset) {
  return 0;
}

export { personalityOf, stanceFromPersonality, favoriteModifier, STANCE_AXES };

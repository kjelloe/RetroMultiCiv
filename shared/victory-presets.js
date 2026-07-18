// Victory-conditions presets (user directive 2026-07-18): the "Victory
// conditions" dropdown on the setup screen + the LAN-lobby host form. Each
// preset maps to a rulesOverride PATCH applied the same way marathon was (the
// endYear seam) — client/main.js folds it into ruleset.rules, server/lobby.js
// folds it in overridesFor. Shared so the two sides can never drift.
//
// EXTENSION POINT: add a preset by adding ONE row here — { id: { label,
// overrides } }. Future presets ("Conquest only", "Space race sprint", "No
// space victory") become a row + an engine victory-toggle later, NOT a UI
// rework. Keep `standard` = no overrides (the absent-default = today's game, so
// the whole feature stays golden-neutral). Values are integers/strings only.
export const VICTORY_PRESETS = {
  standard: { label: 'Standard — victory or 2100 AD', overrides: {} },
  marathon: { label: 'Marathon — play until a civ wins', overrides: { endYear: 9999 } }
};

export const DEFAULT_VICTORY = 'standard';

// A known preset id, or the default (defensive against stale URLs/saves).
export function victoryId(id) {
  return Object.prototype.hasOwnProperty.call(VICTORY_PRESETS, id) ? id : DEFAULT_VICTORY;
}

// The rulesOverride patch for a preset id (a fresh object; {} for standard/
// unknown). Callers Object.assign it onto their overrides.
export function victoryOverrides(id) {
  const p = VICTORY_PRESETS[victoryId(id)];
  return Object.assign({}, p.overrides);
}

// The dropdown rows, in table order, for the UI to render.
export function victoryOptions() {
  return Object.keys(VICTORY_PRESETS).map(id => ({ id, label: VICTORY_PRESETS[id].label }));
}

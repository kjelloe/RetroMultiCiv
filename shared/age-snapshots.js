// #2305: pre-baked starting-age snapshots (tools/bake-age-snapshots.js) let a
// later-age start LOAD a state instead of running the live fast-forward
// (shared/fastforward.js). This module is the PURE matcher — given the bake
// manifest and a game config, it finds the preset that a live fast-forward
// would reproduce EXACTLY, or null (the caller then runs the live ff unchanged,
// so arbitrary seeds keep working). Browser- and Roblox-portable (no fetch/DOM/
// engine here — the host does the I/O and the state load/verify).

// A snapshot is only usable when the config would produce the IDENTICAL world:
// the baker bakes the DEFAULT lineup (sorted+seed-shuffled civs, all AI) at a
// fixed map type / difficulty. A ?civ pick reorders the roster, and a different
// map type / difficulty changes the world — those never match.
export function matchSnapshot(manifest, cfg) {
  if (!manifest || !Array.isArray(manifest.presets) || !cfg) return null;
  if (cfg.picked) return null;
  if (manifest.mapType !== undefined && cfg.mapType !== manifest.mapType) return null;
  if (manifest.difficulty !== undefined && cfg.difficulty !== manifest.difficulty) return null;
  for (const p of manifest.presets) {
    if (p.aborted) continue;
    if (p.age === cfg.age && p.size === cfg.size && p.seed === cfg.seed && p.civs === cfg.civs) return p;
  }
  return null;
}

// After loading a matched snapshot's state, it is USABLE only if it verifies
// against the preset's pinned statehash (file intact) AND none of the human
// seats died during the baked history (a later-age start whose civ is already
// dead must fall through to the live ff, which aborts with the casualty
// message). Returns true when the state may be adopted. `hashState` is injected
// (shared/statehash.js) so this module imports nothing.
export function snapshotUsable(state, preset, humanSeats, hashState) {
  if (!state || !preset) return false;
  if (hashState(state) !== preset.statehash) return false;
  for (const pid of humanSeats || []) {
    const p = state.players && state.players[pid];
    if (!p || p.alive === false) return false;
  }
  return true;
}

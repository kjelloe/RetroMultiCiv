// Clone-on-write for state.map.tiles (deepClone map-sharing, ruled #2320). applyCommand no longer
// deep-clones the map — it SHARES state.map by reference (cloneStateShareMap in index.js), so the
// hundreds of non-tile commands per turn clone ZERO of the 1960 tile objects. A command that WRITES a
// tile clones the map lazily through the ONE legal path `cowTile` (grep-enforceable — any direct
// `state.map.tiles[i].field =` / `delete` is a bug the freeze aliasing test catches).
//
// THE SANCTIONED MODULE-STATE EXCEPTION (docs/02, alongside idiv): `owned` is a per-command transient,
// RESET at applyCommand ENTRY (resetCow) — it is an IMPLICIT PER-COMMAND ARGUMENT, never surviving
// across calls. The determinism-guard test proves identical (state, command) -> identical result
// regardless of prior calls, so the transient cannot leak. Single-threaded, deterministic engine.
let owned = false;

// index.js calls this at the top of EVERY applyCommand — the reset that keeps `owned` per-command.
function resetCow() { owned = false; }

// The ONLY legal tile-write path. Returns a WRITABLE clone of state.map.tiles[idx]; the caller mutates
// the returned tile (set/delete fields). First call this command clones state.map + a shallow copy of
// the tiles ARRAY (owning it); every call clones the specific tile object (so a write never touches the
// shared original). The pre-command state.map is left byte-identical (immutability preserved).
function cowTile(state, idx) {
  if (!owned) {
    const map = state.map;
    const m = {};
    for (const k of Object.keys(map)) m[k] = map[k];
    m.tiles = map.tiles.slice(); // shallow: shares the tile objects until each is cow'd below
    state.map = m;
    owned = true;
  }
  const t = state.map.tiles[idx];
  const nt = {};
  for (const k of Object.keys(t)) nt[k] = t[k];
  state.map.tiles[idx] = nt;
  return nt;
}

export { cowTile, resetCow };

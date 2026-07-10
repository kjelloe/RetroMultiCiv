// Renderer interface (docs/02-architecture.md §3).
// The renderer is "dumb": it maps view state to visuals and reports picks.
// It knows nothing about game rules. Swapping implementations must not
// require changes outside client/renderer/.
//
// Contract every implementation provides:
//   createRenderer(container) -> {
//     setViewState(view)        // full (fog-filtered) state: map, units, cities, players
//     playEvents(events)        // animate engine events (combat, moves, growth)
//     onPick(cb)                // cb({ tile: {x, y}, unitId?, cityId? }) on click
//     onHover(cb)               // cb({ tile: {x, y} } | null) on pointer move
//     setSelection(sel)         // { unitId? , tile? } | null — highlight marker
//     centerOn(x, y)
//     destroy()
//   }

export { createRenderer, terrainColor } from './three/index.js';

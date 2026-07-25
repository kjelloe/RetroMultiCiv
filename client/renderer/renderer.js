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
//     onDblPick(cb)             // same pick shape, on double-click
//     onHover(cb)               // cb({ tile: {x, y} } | null) on pointer move
//     setHoverColor(hex)        // tint the hover marker (red = attack preview)
//     setSelection(sel)         // { unitId? , tile? } | null — highlight marker
//     setFootprint(tiles)       // [{x, y}] overlay (settler site preview) | null
//     setMoveArrows(items)      // [{x, y, dir}] tap-to-move arrows (mobile #8) | null
//     pickAt(cx, cy)            // pick shape under a client point (touch long-press) | null
//     centerOn(x, y)
//     setZoom(dist)             // camera distance (clamped)
//     destroy()
//   }

export { createRenderer, terrainColor } from './three/index.js';

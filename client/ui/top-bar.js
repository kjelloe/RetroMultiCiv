// mobile-session-3 #10: the top-bar icons (research bar, the 🤝/💰/⚔/🏙 overview
// toggles, and the corner ❓/⚙/📖/💾/… group) are each ABSOLUTELY positioned and
// anchored independently (left / centre / right), so on a narrow phone they
// overlap and bury the research bar. This pass collects them into ONE flex strip
// (#top-bar) that scrolls horizontally on mobile — the same affordance as the
// bottom action bar.
//
// Desktop + mid-width are UNTOUCHED: #top-bar is `display: contents` there, so the
// wrapper generates no box and every child keeps its existing absolute placement.
// The flex/scroll behaviour is gated to the ≤720px block in style.css. Client-only,
// golden-neutral (no engine/state/hash).
//
// Runs after initTopPanels() — i.e. after every top-bar element has been created.
export function initTopBar() {
  if (document.getElementById('top-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'top-bar';
  // visual order on the mobile strip, left -> right: research bar FIRST (so it is
  // never hidden behind the icons — the actual #10 complaint), then the overview
  // toggles, then the corner icon group. Missing ids (diplo inert pre-D1, debug/
  // strategic gated) are skipped.
  const order = ['research-bar', 'open-diplo', 'open-econ-overview',
                 'open-military-overview', 'open-city-overview', 'corner-buttons'];
  const anchor = document.getElementById(order[0]);
  const parent = (anchor && anchor.parentNode) ? anchor.parentNode : document.body;
  parent.insertBefore(bar, anchor || null);
  for (const id of order) {
    const el = document.getElementById(id);
    if (el) bar.appendChild(el);
  }
}

// XVII #19: the top-center panels are mutually exclusive — opening one closes any
// other that's open. Client-only, golden-neutral: it toggles the `.hidden` class,
// never game state. Implemented with one MutationObserver per registered panel so
// no per-open-site wiring is needed: when a panel loses `.hidden` (just opened),
// every OTHER registered panel gets `.hidden` back. Closing a panel only ADDS
// `.hidden`, which never trips the "just opened" branch, so there's no loop.
//
// Modals with a REQUIRED question (Found-city name dialog, regency hand-over) are
// deliberately NOT registered — they must stay up until answered.
const registry = [];

function register(el) {
  if (!el || registry.indexOf(el) !== -1) return;
  registry.push(el);
  const obs = new MutationObserver(() => {
    if (el.classList.contains('hidden')) return; // it just closed — nothing to do
    for (const other of registry) {
      if (other !== el && !other.classList.contains('hidden')) other.classList.add('hidden');
    }
  });
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
}

// Called once from main.js after the UI modules have built their panels.
export function initTopPanels() {
  const ids = [
    'research-panel', 'city-panel',
    'econ-overview-panel', 'military-overview-panel', 'city-overview-panel',
    'diplo-overlay', 'pedia', 'options-panel', 'tech-tree'
  ];
  for (const id of ids) register(document.getElementById(id));
}

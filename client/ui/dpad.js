// L7b (user-requested, mobile field test): an on-screen D-PAD for coarse map
// movement on touch devices. Pure DOM over the renderer's panBy/centerOn —
// the CSS media query (pointer: coarse) is the gate, so desktop never sees
// it. Hold-to-repeat; the ⌂ center taps the existing 'c' fly-to-capital
// handler (input.js) via a synthetic keydown, so the landing logic stays
// single-sourced.
import { PEDIA_NAME } from './pedia-name.js';

export function initDpad(ctx) {
  const { renderer } = ctx;
  const pad = document.createElement('div');
  pad.id = 'dpad';
  const CELLS = [
    ['dpad-blank', ''], ['dpad-n', '▲'], ['dpad-blank', ''],
    ['dpad-w', '◀'], ['dpad-home', '⌂'], ['dpad-e', '▶'],
    ['dpad-blank', ''], ['dpad-s', '▼'], ['dpad-blank', '']
  ];
  const DIRS = { 'dpad-n': [0, -1], 'dpad-s': [0, 1], 'dpad-w': [-1, 0], 'dpad-e': [1, 0] };
  for (const [cls, glyph] of CELLS) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = glyph;
    if (cls === 'dpad-blank') b.disabled = true;
    pad.appendChild(b);
  }
  let repeat = 0;
  function stop() { clearInterval(repeat); repeat = 0; }
  pad.addEventListener('pointerdown', e => {
    const dir = DIRS[e.target.className];
    if (!dir) return;
    e.preventDefault(); // no focus/scroll side effects on touch
    renderer.panBy(dir[0] * 2, dir[1] * 2);
    stop();
    repeat = setInterval(() => renderer.panBy(dir[0] * 2, dir[1] * 2), 160);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
    pad.addEventListener(ev, stop);
  }
  pad.addEventListener('click', e => {
    if (e.target.className === 'dpad-home') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    }
  });
  document.body.appendChild(pad);

  // XII.1 (user, mobile playtest): a compass toggle to show/hide the nav pad —
  // some players want the screen space back. The choice persists in ctx.options
  // (the shared localStorage blob, like the other prefs); default SHOWN (an
  // absent option reads falsy = not hidden). The button lives in the top-right
  // corner cluster (CSS gates it to touch), NOT on the pad — a hidden pad could
  // not reveal itself.
  const opt = ctx.options;
  const toggle = document.createElement('button');
  toggle.id = 'dpad-toggle';
  toggle.textContent = '🧭';
  toggle.title = 'show/hide the map compass';
  function applyHidden() {
    const hidden = !!(opt && opt.get('dpadHidden') === true);
    pad.classList.toggle('dpad-hidden', hidden);
    toggle.setAttribute('aria-pressed', hidden ? 'false' : 'true');
  }
  toggle.addEventListener('click', () => {
    if (opt) opt.set('dpadHidden', !(opt.get('dpadHidden') === true));
    applyHidden();
  });
  const corner = document.getElementById('corner-buttons');
  if (corner) corner.appendChild(toggle);
  applyHidden();

  // XIV §6: on touch the Controls help must list GESTURES, not keyboard
  // shortcuts (the same pointer:coarse gate as the d-pad). Documents exactly the
  // §7 touch moves + the long-press GoTo (§25) / pinch (§10) already shipped.
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
    const help = document.getElementById('help');
    if (help) {
      const sum = help.querySelector('summary');
      if (sum) sum.textContent = '👆 Controls';
      const ul = help.querySelector('ul');
      if (ul) {
        ul.innerHTML = [
          ['tap a unit', 'select it (a stack shows a unit list)'],
          ['▲ ◀ ▶ ▼ on the action bar', 'step the selected unit (attacks an enemy on that tile)'],
          ['double-tap a tile', 'move the unit there — a route over turns if far'],
          ['long-press a tile', 'GoTo: the unit travels there over turns'],
          ['drag', 'pan the map'],
          ['pinch', 'zoom the map in and out'],
          ['🧭 / the ⌂ d-pad', 'pan the map, and show/hide the compass'],
          ['tap a city', 'open the city view'],
          ['💾 / 📂 / ⚙ / 📖', `save · load · options · ${PEDIA_NAME}`]
        ].map(([g, d]) => `<li><b>${g}</b> — ${d}</li>`).join('');
      }
    }
  }
}

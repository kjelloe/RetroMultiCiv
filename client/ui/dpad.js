// L7b (user-requested, mobile field test): an on-screen D-PAD for coarse map
// movement on touch devices. Pure DOM over the renderer's panBy/centerOn —
// the CSS media query (pointer: coarse) is the gate, so desktop never sees
// it. Hold-to-repeat; the ⌂ center taps the existing 'c' fly-to-capital
// handler (input.js) via a synthetic keydown, so the landing logic stays
// single-sourced.
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
}

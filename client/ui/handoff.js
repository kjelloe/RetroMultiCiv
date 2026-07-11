// Hotseat hand-off screen (phase 2): a fully OPAQUE cover between human
// turns, so neither player sees the other's fog-filtered map. The incoming
// player's view is rendered underneath while covered; confirming only lifts
// the cover. No state here — just the curtain.
export function initHandoff(ctx) {
  const overlay = document.createElement('div');
  overlay.id = 'handoff-screen';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div id="handoff-box">
      <h2 id="handoff-title"></h2>
      <p>Take the keyboard, then click or press any key.</p>
      <button id="handoff-go">Begin turn</button>
    </div>`;
  document.body.appendChild(overlay);

  let onConfirm = null;
  function confirm() {
    if (!onConfirm) return;
    const cb = onConfirm;
    onConfirm = null;
    overlay.classList.add('hidden');
    cb();
  }
  overlay.addEventListener('pointerdown', confirm);
  window.addEventListener('keydown', e => {
    if (onConfirm && !overlay.classList.contains('hidden')) {
      e.preventDefault();
      e.stopPropagation();
      confirm();
    }
  }, true); // capture: swallow the key before game hotkeys see it

  return {
    show(playerName, color, cb) {
      document.getElementById('handoff-title').textContent = `${playerName} — your turn`;
      document.getElementById('handoff-title').style.color = color;
      overlay.classList.remove('hidden');
      onConfirm = cb;
    },
    isOpen: () => !overlay.classList.contains('hidden')
  };
}

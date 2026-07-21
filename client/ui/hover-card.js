// XIV §22/§24/§27: ONE shared hover-card — a small floating panel positioned
// near a screen point (or an anchor element), viewport-clamped, reused by the
// pedia tech-text links (§22), the tile-yield overlay (§24), and the tech-tree
// node cards (§27). Pure DOM + presentation; never touches game state. Content
// is passed as a DOM node (callers build it safely) or an HTML string the
// caller controls — never untrusted text as HTML.
export function createHoverCard() {
  let el = null;
  function ensure() {
    if (!el) {
      el = document.createElement('div');
      el.id = 'hover-card';
      el.className = 'hidden';
      document.body.appendChild(el);
    }
    return el;
  }

  // place the card near (x, y) in client coords, flipping to stay on-screen
  function place(x, y) {
    const c = el;
    c.classList.remove('hidden');
    const r = c.getBoundingClientRect();
    const pad = 8, gap = 14;
    let px = x + gap, py = y + gap;
    if (px + r.width > window.innerWidth - pad) px = x - r.width - gap;
    if (py + r.height > window.innerHeight - pad) py = y - r.height - gap;
    c.style.left = Math.max(pad, px) + 'px';
    c.style.top = Math.max(pad, py) + 'px';
  }

  function setContent(content) {
    const c = ensure();
    if (content instanceof Node) { c.textContent = ''; c.appendChild(content); }
    else { c.innerHTML = String(content); }
    return c;
  }

  return {
    // show at a screen point (the tile-yield / tech-text-link case)
    showAt(x, y, content) { setContent(content); place(x, y); },
    // show anchored to an element's box (the tech-tree node case)
    showAtEl(anchor, content) {
      setContent(content);
      const b = anchor.getBoundingClientRect();
      place(b.left + b.width / 2, b.bottom);
    },
    hide() { if (el) el.classList.add('hidden'); },
    get visible() { return !!el && !el.classList.contains('hidden'); }
  };
}

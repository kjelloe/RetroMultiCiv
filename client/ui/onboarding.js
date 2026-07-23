// First-timer onboarding overlay (spec: specs/onboarding-overlay.md). A one-time
// transparent full-screen layer ABOVE the HUD with cartoony hand-drawn SVG arrows
// pointing at the main controls — one set on the setup screen, one on the first
// in-game screen. NO assets (procedural SVG), NO layout reflow (the rejoin-banner
// lesson — a floating overlay, never inserted into the HUD flow). Composes with
// the advisor cards (advisor = WHAT to do; this = WHERE things are). Client-only,
// golden-neutral. Arrows anchor to LIVE button positions (getBoundingClientRect
// at show-time, re-anchored on resize); a hidden target falls back to its proxy
// or is skipped.

const SEEN_KEY = 'rmc_onboarding_seen';

function readSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { return {}; } }
function markSeen(screen) {
  const s = readSeen(); s[screen] = true;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}
export function hasSeenOnboarding(screen) { return readSeen()[screen] === true; }

// Arrow specs. `big` = a fat labelled arrow; `proxy` = a fallback selector when
// the primary is hidden at show-time. Order is draw order (top of the list first).
// the one-line AI-regency explanation — shared by the onboarding caption AND the
// permanent button tooltip (regency.js) so the wording stays in one place.
export const REGENCY_HELP = "AI regency — the AI plays your turns while you're away; click to hand over / take back";
const SETUP_ARROWS = [
  { sel: '#setup-start', label: 'Start your game here', big: true },
  { sel: '#rejoin-banner', label: 'Or resume a game you left', big: false },
  { sel: '#setup-host', label: 'Host a LAN game', big: false },
  { sel: '#setup-find', label: 'Find a public game', big: false },
  { sel: '#setup-join', label: 'Join with a 5-letter code', big: false }
];
const GAME_ARROWS = [
  { sel: '#research-bar', label: 'Research & government — click to choose', big: true },
  { sel: '#action-bar', proxy: '#unit-dock', label: 'Pick a unit — its actions appear here', big: true },
  { sel: '#end-turn', label: 'End your turn when done', big: true },
  { sel: '#regent-btn', label: REGENCY_HELP, big: true },
  { sel: '#open-options', label: 'Options', big: false },
  { sel: '#open-pedia', label: 'Civilopedia', big: false },
  { sel: '#open-diplo', label: 'Foreign relations', big: false },
  { sel: '#help', label: 'Controls', big: false },
  { sel: '#turn-log', label: 'Turn log', big: false }
];

const SVGNS = 'http://www.w3.org/2000/svg';

function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0
    && r.top < window.innerHeight && r.left < window.innerWidth;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// a slightly jittered (hand-drawn) arrow from a label pill to the target edge.
// `placed` accumulates label boxes so a new label nudges clear of earlier ones.
function drawArrow(svg, rect, label, big, placed) {
  const tx = rect.left + rect.width / 2;
  const ty = rect.top + rect.height / 2;
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  // point the arrow from the screen-centre side so it never covers its button
  let dx = tx - cx, dy = ty - cy;
  const len = Math.max(1, Math.hypot(dx, dy));
  dx /= len; dy /= len;
  const gap = big ? 26 : 18;
  const reach = big ? 108 : 78;
  const ex = tx - dx * (rect.width / 2 + gap);
  const ey = ty - dy * (rect.height / 2 + gap);
  let sx = ex - dx * reach;
  let sy = ey - dy * reach;

  // label box near the arrow start, clamped on-screen, then nudged DOWN out of
  // any earlier label it collides with (simple stacking — clustered buttons)
  const w = big ? 210 : 152, h = big ? 92 : 58;
  let lx = sx - w / 2, ly = sy - (dy < 0 ? h + 6 : -6);
  lx = Math.max(6, Math.min(window.innerWidth - w - 6, lx));
  ly = Math.max(6, Math.min(window.innerHeight - h - 6, ly));
  const box = { x: lx, y: ly, w, h };
  for (let guard = 0; guard < 24; guard++) {
    const hit = placed.find(p => rectsOverlap(box, p));
    if (!hit) break;
    box.y = hit.y + hit.h + 8;
    if (box.y + h > window.innerHeight - 6) { box.y = 6; box.x = Math.min(window.innerWidth - w - 6, box.x + w + 8); }
  }
  placed.push(box);
  // re-anchor the arrow tail to the (possibly moved) label edge nearest the target
  sx = Math.max(box.x, Math.min(box.x + w, tx));
  sy = ty < box.y ? box.y : box.y + h;
  const mx = (sx + ex) / 2 + dy * (big ? 16 : 10);
  const my = (sy + ey) / 2 - dx * (big ? 16 : 10);

  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
  path.setAttribute('class', big ? 'ob-arrow ob-big' : 'ob-arrow');
  svg.appendChild(path);
  const ang = Math.atan2(ey - my, ex - mx);
  const hl = big ? 15 : 11;
  const head = document.createElementNS(SVGNS, 'path');
  head.setAttribute('d', `M ${ex.toFixed(1)} ${ey.toFixed(1)} L ${(ex + hl * Math.cos(ang + 2.7)).toFixed(1)} ${(ey + hl * Math.sin(ang + 2.7)).toFixed(1)} `
    + `M ${ex.toFixed(1)} ${ey.toFixed(1)} L ${(ex + hl * Math.cos(ang - 2.7)).toFixed(1)} ${(ey + hl * Math.sin(ang - 2.7)).toFixed(1)}`);
  head.setAttribute('class', big ? 'ob-arrow ob-big' : 'ob-arrow');
  svg.appendChild(head);

  const fo = document.createElementNS(SVGNS, 'foreignObject');
  fo.setAttribute('x', box.x.toFixed(1)); fo.setAttribute('y', box.y.toFixed(1));
  fo.setAttribute('width', w); fo.setAttribute('height', h);
  const div = document.createElement('div');
  div.className = big ? 'ob-label ob-label-big' : 'ob-label';
  div.textContent = label;
  fo.appendChild(div);
  svg.appendChild(fo);
}

function showOverlay(arrows, onDone) {
  const layer = document.createElement('div');
  layer.id = 'onboarding-overlay';
  const hint = document.createElement('div');
  hint.id = 'onboarding-hint';
  hint.textContent = 'Tap anywhere (or Esc) to dismiss';
  layer.appendChild(hint);
  document.body.appendChild(layer);

  let svg = null;
  function render() {
    if (svg) svg.remove();
    svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('id', 'onboarding-svg');
    layer.insertBefore(svg, hint);
    const placed = [];
    for (const a of arrows) {
      let el = document.querySelector(a.sel);
      if ((!el || !visible(el)) && a.proxy) el = document.querySelector(a.proxy);
      if (el && visible(el)) drawArrow(svg, el.getBoundingClientRect(), a.label, a.big, placed);
    }
  }
  render();

  const onResize = () => render();
  window.addEventListener('resize', onResize);
  function dismiss() {
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey, true);
    layer.remove();
    if (onDone) onDone();
  }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); dismiss(); } }
  layer.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);
  return dismiss;
}

// Public: one-time per browser+screen. Returns the dismiss fn, or null if already
// seen / nothing to point at. Deferred a frame so the target layout has settled.
function showWhenReady(arrows, onDone) {
  let dismiss = null;
  const raf = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
  raf(() => { dismiss = showOverlay(arrows, onDone); });
  return () => { if (dismiss) dismiss(); };
}

export function maybeShowSetupOnboarding() {
  if (hasSeenOnboarding('setup')) return null;
  markSeen('setup');
  return showWhenReady(SETUP_ARROWS);
}
export function maybeShowGameOnboarding() {
  if (hasSeenOnboarding('game')) return null;
  markSeen('game');
  return showWhenReady(GAME_ARROWS);
}
// the "?" re-show in Options — always shows (ignores the seen flag)
export function showOnboarding(screen) {
  return showWhenReady(screen === 'setup' ? SETUP_ARROWS : GAME_ARROWS);
}

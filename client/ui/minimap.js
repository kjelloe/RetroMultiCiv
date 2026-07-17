// C1 (Civ2 shape, specs/civ24-features-proposal.md §1): the world minimap —
// one cell per explored tile from the FOG-FILTERED view (fog honesty is
// structural: unknown tiles paint void), cities as owner-colored dots, a
// viewport rectangle tracking the camera, and click/drag-to-jump via
// renderer.centerOn(). Wrap-aware on both the click math and the rectangle.
// Pure render + camera moves — no commands, golden-neutral. Hotseat: the
// paint re-reads ctx.HUMAN every time (never cached).
import { filterView } from '../../engine/visibility.js';
import { terrainBaseColor } from '../renderer/three/terrain.js';
import { displayColor } from './palette.js';

const VOID = '#05070c';

export function initMinimap(ctx) {
  const { session, renderer } = ctx;
  if (!renderer || !renderer.getView) return null;

  const box = document.createElement('div');
  box.id = 'minimap';
  const mapCanvas = document.createElement('canvas');
  mapCanvas.id = 'minimap-map';
  const rectCanvas = document.createElement('canvas');
  rectCanvas.id = 'minimap-rect';
  box.appendChild(mapCanvas);
  box.appendChild(rectCanvas);
  document.body.appendChild(box);

  function dims() { return session.state.map; }

  function paint() {
    const { width, height } = dims();
    if (mapCanvas.width !== width) { mapCanvas.width = width; rectCanvas.width = width; }
    if (mapCanvas.height !== height) { mapCanvas.height = height; rectCanvas.height = height; }
    const view = filterView(session.state, ctx.HUMAN);
    const g = mapCanvas.getContext('2d');
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = view.map.tiles[y * width + x];
        g.fillStyle = t.t === 'unknown' ? VOID : terrainBaseColor(t.t);
        g.fillRect(x, y, 1, 1);
      }
    }
    // cities on top, in each owner's display color (view already fog-culled)
    for (const id of Object.keys(view.cities)) {
      const c = view.cities[id];
      const p = view.players[c.owner];
      g.fillStyle = p ? displayColor(p.color) : '#ffffff';
      g.fillRect(c.x, c.y, 1, 1);
    }
  }

  // the viewport rectangle rides its own transparent layer at ~60 Hz so
  // drag-pans track live without repainting the terrain; the extents are an
  // approximation of the tilted camera's ground footprint from cam.dist
  let lastKey = '';
  function drawRect() {
    const { width, height, wrapX } = dims();
    const v = renderer.getView();
    const key = `${v.x}|${v.y}|${v.dist}|${width}`;
    if (key !== lastKey) {
      lastKey = key;
      const g = rectCanvas.getContext('2d');
      g.clearRect(0, 0, width, height);
      g.strokeStyle = '#ffe066';
      g.lineWidth = 1;
      const hw = Math.max(2, v.dist * 0.62), hh = Math.max(2, v.dist * 0.42);
      let cx = v.x;
      if (wrapX) cx = ((cx % width) + width) % width;
      const draws = [cx];
      if (wrapX && cx - hw < 0) draws.push(cx + width);
      if (wrapX && cx + hw > width) draws.push(cx - width);
      for (const dx of draws) {
        g.strokeRect(dx - hw + 0.5, v.y - hh + 0.5, hw * 2 - 1, hh * 2 - 1);
      }
    }
    if (!disposed) requestAnimationFrame(drawRect);
  }
  let disposed = false;

  function jump(ev) {
    const { width, height, wrapX } = dims();
    const r = mapCanvas.getBoundingClientRect();
    let x = Math.floor((ev.clientX - r.left) / r.width * width);
    let y = Math.floor((ev.clientY - r.top) / r.height * height);
    if (wrapX) x = ((x % width) + width) % width;
    else x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));
    renderer.centerOn(x, y);
  }
  let dragging = false;
  box.addEventListener('pointerdown', ev => {
    dragging = true;
    try { box.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic events carry no active pointer */ }
    jump(ev);
  });
  box.addEventListener('pointermove', ev => { if (dragging) jump(ev); });
  box.addEventListener('pointerup', () => { dragging = false; });
  box.addEventListener('pointercancel', () => { dragging = false; });

  session.onChange(paint);
  paint();
  requestAnimationFrame(drawRect);

  return {
    repaint: paint,
    destroy() { disposed = true; box.remove(); }
  };
}

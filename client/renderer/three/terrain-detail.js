// G2 medium terrain detail (specs/graphics-levels.md): one procedural
// CanvasTexture per terrain id, MULTIPLIED into the per-face palette colors
// (the mottle idiom, scaled up) — grass reads as blades, desert as grain and
// ripple, mountains as striation. Greyscale marks only: the palette keeps
// owning hue, so river tint and fog dim compose unchanged. Deterministic:
// seeded locally, never from game state. World-planar uv (x/4) means one
// 256px texture spans 4 tiles ≈ 64px per tile.
import * as THREE from 'three';

// The G2 art style — USER-PICKED 2026-08-05 from 3 shot variants ("v2
// balanced weave"; the standing 3-variant rule, specs/graphics-levels.md).
// contrast scales mark strength, density scales mark count; scatterBoost
// drives props.js ground scatter.
export const DETAIL_STYLE = { contrast: 1.0, density: 1.0, scatterBoost: 2 };

const SIZE = 256;

function makeRnd(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

// mark helpers — g is the 2d context, v is a grey value 0..255
function grey(g, v) { const c = Math.max(0, Math.min(255, Math.round(v))); g.fillStyle = `rgb(${c},${c},${c})`; g.strokeStyle = g.fillStyle; }

// Per-terrain mark painters. A = amplitude (how far marks depart from white),
// D = density multiplier, rnd = the seeded generator. Marks must tile: every
// painter draws with wrap-around copies for anything near an edge — cheap
// version: draw everything twice more at ±SIZE on both axes via drawWrapped.
function drawWrapped(g, fn) {
  for (const ox of [-SIZE, 0, SIZE]) {
    for (const oy of [-SIZE, 0, SIZE]) {
      g.save(); g.translate(ox, oy); fn(); g.restore();
    }
  }
}

const PAINTERS = {
  grassland(g, rnd, A, D) { // short vertical blades, light and dark
    for (let i = 0; i < 500 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, h = 3 + rnd() * 3;
      grey(g, 255 - (0.35 + rnd() * 0.65) * A);
      drawWrapped(g, () => g.fillRect(x, y, 1, h));
    }
  },
  plains(g, rnd, A, D) { // sparse dry blades + lying dashes
    for (let i = 0; i < 260 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE;
      grey(g, 255 - (0.3 + rnd() * 0.6) * A);
      if (rnd() < 0.6) drawWrapped(g, () => g.fillRect(x, y, 1, 2 + rnd() * 3));
      else drawWrapped(g, () => g.fillRect(x, y, 3 + rnd() * 4, 1));
    }
  },
  desert(g, rnd, A, D) { // sand grain + faint ripple lines
    for (let i = 0; i < 700 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE;
      grey(g, 255 - (0.3 + rnd() * 0.6) * A);
      drawWrapped(g, () => g.fillRect(x, y, 1, 1));
    }
    for (let i = 0; i < 7 * D; i++) {
      const y0 = rnd() * SIZE, amp = 2 + rnd() * 3, ph = rnd() * Math.PI * 2;
      grey(g, 255 - 0.7 * A);
      drawWrapped(g, () => {
        g.beginPath();
        for (let x = 0; x <= SIZE; x += 4) g.lineTo(x, y0 + Math.sin(ph + x / 24) * amp);
        g.stroke();
      });
    }
  },
  forest(g, rnd, A, D) { // undergrowth blobs
    for (let i = 0; i < 120 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, r = 2 + rnd() * 3;
      grey(g, 255 - (0.35 + rnd() * 0.55) * A);
      drawWrapped(g, () => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    }
  },
  jungle(g, rnd, A, D) { // denser, darker canopy-floor blobs
    for (let i = 0; i < 160 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, r = 2 + rnd() * 4;
      grey(g, 255 - (0.4 + rnd() * 0.6) * A);
      drawWrapped(g, () => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    }
  },
  hills(g, rnd, A, D) { // pebble dots + short slope strokes
    for (let i = 0; i < 300 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE;
      grey(g, 255 - (0.3 + rnd() * 0.55) * A);
      if (rnd() < 0.5) drawWrapped(g, () => g.fillRect(x, y, 2, 2));
      else drawWrapped(g, () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + 3); g.stroke(); });
    }
  },
  mountains(g, rnd, A, D) { // diagonal rock striation
    for (let i = 0; i < 40 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, len = 20 + rnd() * 40;
      const slope = 0.4 + rnd() * 0.5;
      grey(g, 255 - (0.3 + rnd() * 0.6) * A);
      drawWrapped(g, () => {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + len * slope * (rnd() < 0.5 ? 1 : -1)); g.stroke();
      });
    }
  },
  tundra(g, rnd, A, D) { // lichen patch clusters
    for (let i = 0; i < 90 * D; i++) {
      const cx = rnd() * SIZE, cy = rnd() * SIZE, k = 3 + Math.floor(rnd() * 4);
      grey(g, 255 - (0.25 + rnd() * 0.55) * A);
      for (let j = 0; j < k; j++) {
        const x = cx + (rnd() - 0.5) * 10, y = cy + (rnd() - 0.5) * 10;
        drawWrapped(g, () => g.fillRect(x, y, 2, 2));
      }
    }
  },
  arctic(g, rnd, A, D) { // faint long crack lines
    for (let i = 0; i < 12 * D; i++) {
      let x = rnd() * SIZE, y = rnd() * SIZE;
      grey(g, 255 - 0.45 * A);
      drawWrapped(g, () => {
        g.beginPath(); g.moveTo(x, y);
        let px = x, py = y;
        for (let s = 0; s < 6; s++) {
          px += (rnd() - 0.3) * 24; py += (rnd() - 0.5) * 16;
          g.lineTo(px, py);
        }
        g.stroke();
      });
    }
  },
  swamp(g, rnd, A, D) { // wet dark blotches
    for (let i = 0; i < 100 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE, r = 3 + rnd() * 5;
      grey(g, 255 - (0.45 + rnd() * 0.6) * A);
      drawWrapped(g, () => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    }
  },
  ocean(g, rnd, A, D) { // soft speckle only — the water plane carries the motion
    for (let i = 0; i < 300 * D; i++) {
      const x = rnd() * SIZE, y = rnd() * SIZE;
      grey(g, 255 - (0.15 + rnd() * 0.35) * A);
      drawWrapped(g, () => g.fillRect(x, y, 1 + rnd() * 2, 1));
    }
  }
};

const cache = {}; // `${id}:${contrast}:${density}` -> CanvasTexture
export function detailTexture(terrainId) {
  const { contrast, density } = DETAIL_STYLE;
  const key = `${terrainId}:${contrast}:${density}`;
  if (cache[key]) return cache[key];
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, SIZE, SIZE);
  const painter = PAINTERS[terrainId];
  if (painter) {
    // amplitude 70 at contrast 1.0: marks darken to a 0.45-0.85 multiplier —
    // they must dip BELOW the ~1.95x lighting clamp or they render invisible
    // (the same washed-to-white trap the river-tint fix documented)
    const seed = 20260805 + terrainId.length * 7919 + terrainId.charCodeAt(0) * 131;
    painter(g, makeRnd(seed), 70 * contrast, density);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache[key] = tex;
  return tex;
}

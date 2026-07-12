// Faction identity (art A1.6a, specs/civ-visuals.md + specs/plan-assets-2.md):
// the 14 emblems as tiny canvas drawings, reused three ways — 64x64
// CanvasTexture flags (capitals), data-URL <img> icons (setup screen,
// city-view header), and a plain secondary-color disc on the primitive
// pennants (assets.js). Original geometric symbols, no real-flag copying.
// All colors come from data/civs.json `visual` entries; anything without a
// visual falls back to the player's plain color.
import * as THREE from 'three';

// perceived luminance — light primaries need a dark rim/border for
// readability. Threshold 150 catches exactly the two the ally's table calls
// out (Ivory Tower ≈229, Arctic Rune ≈155) and no mid-tone civ (Amber ≈141).
export function isLightColor(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

// draw one emblem centered at (cx,cy) with radius r in the given color.
// Build order per the ally: sun, wave, oak, star, wheel, mountain, chevron,
// hammer, tower, diamond, crescent, spiral, flame, rune.
export function drawEmblem(g, emblem, cx, cy, r, color, field) {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = Math.max(2, r * 0.22);
  g.lineCap = 'round';
  if (emblem === 'sun') {
    g.beginPath(); g.arc(0, 0, r * 0.45, 0, 7); g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      g.stroke();
    }
  } else if (emblem === 'wave') {
    for (const dy of [-r * 0.3, r * 0.3]) {
      g.beginPath();
      g.moveTo(-r, dy);
      g.quadraticCurveTo(-r * 0.5, dy - r * 0.55, 0, dy);
      g.quadraticCurveTo(r * 0.5, dy + r * 0.55, r, dy);
      g.stroke();
    }
  } else if (emblem === 'oak') {
    g.fillRect(-r * 0.12, 0, r * 0.24, r);              // trunk
    g.beginPath(); g.arc(0, -r * 0.25, r * 0.6, 0, 7); g.fill(); // canopy
  } else if (emblem === 'star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.42;
      g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  } else if (emblem === 'wheel') {
    g.beginPath(); g.arc(0, 0, r * 0.85, 0, 7); g.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      g.lineTo(-Math.cos(a) * r * 0.85, -Math.sin(a) * r * 0.85);
      g.stroke();
    }
    g.beginPath(); g.arc(0, 0, r * 0.2, 0, 7); g.fill();
  } else if (emblem === 'mountain') {
    g.beginPath();
    g.moveTo(-r, r * 0.7); g.lineTo(-r * 0.25, -r * 0.55); g.lineTo(r * 0.3, r * 0.7);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(0, r * 0.7); g.lineTo(r * 0.5, -r * 0.1); g.lineTo(r, r * 0.7);
    g.closePath(); g.fill();
  } else if (emblem === 'chevron') {
    for (const dy of [-r * 0.25, r * 0.35]) {
      g.beginPath();
      g.moveTo(-r * 0.8, dy + r * 0.45);
      g.lineTo(0, dy - r * 0.35);
      g.lineTo(r * 0.8, dy + r * 0.45);
      g.stroke();
    }
  } else if (emblem === 'hammer') {
    g.save(); g.rotate(-Math.PI / 5);
    g.fillRect(-r * 0.55, -r * 0.75, r * 1.1, r * 0.45); // head
    g.fillRect(-r * 0.12, -r * 0.35, r * 0.24, r * 1.15); // handle
    g.restore();
  } else if (emblem === 'tower') {
    g.fillRect(-r * 0.4, -r * 0.35, r * 0.8, r * 1.25);   // body
    for (const dx of [-r * 0.4, -r * 0.08, r * 0.24]) {   // crenellation
      g.fillRect(dx, -r * 0.7, r * 0.16, r * 0.4);
    }
  } else if (emblem === 'diamond') {
    g.beginPath();
    g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, r); g.lineTo(-r * 0.7, 0);
    g.closePath(); g.fill();
  } else if (emblem === 'crescent') {
    g.beginPath(); g.arc(0, 0, r * 0.8, 0, 7); g.fill();
    g.fillStyle = field; // cut the crescent with the field color
    g.beginPath(); g.arc(r * 0.35, -r * 0.15, r * 0.65, 0, 7); g.fill();
  } else if (emblem === 'spiral') {
    g.beginPath();
    for (let t = 0; t <= 2.6 * Math.PI; t += 0.15) {
      const rr = r * 0.12 + (t / (2.6 * Math.PI)) * r * 0.8;
      const x = Math.cos(t) * rr, y = Math.sin(t) * rr;
      if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  } else if (emblem === 'flame') {
    g.beginPath();
    g.moveTo(0, r);
    g.bezierCurveTo(-r * 0.9, r * 0.2, -r * 0.35, -r * 0.25, 0, -r);
    g.bezierCurveTo(r * 0.2, -r * 0.3, r * 0.9, r * 0.1, 0, r);
    g.fill();
  } else if (emblem === 'rune') {
    g.beginPath();
    g.moveTo(-r * 0.35, -r); g.lineTo(-r * 0.35, r);      // stave
    g.moveTo(-r * 0.35, -r * 0.7); g.lineTo(r * 0.55, -r * 0.15);
    g.lineTo(-r * 0.35, 0); g.moveTo(-r * 0.1, -r * 0.15); g.lineTo(r * 0.55, r * 0.75);
    g.stroke();
  } else {
    g.beginPath(); g.arc(0, 0, r * 0.6, 0, 7); g.fill(); // unknown: plain disc
  }
  g.restore();
}

// 64x64 flag canvas: primary field, secondary emblem, border (dark for light
// civs — inverted per the ally's Ivory Tower note, secondary otherwise).
function drawFlagCanvas(visual) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = visual.primary;
  g.fillRect(0, 0, 64, 64);
  const border = isLightColor(visual.primary) ? '#20242e' : visual.secondary;
  g.strokeStyle = border;
  g.lineWidth = 5;
  g.strokeRect(2.5, 2.5, 59, 59);
  drawEmblem(g, visual.emblem, 32, 32, 20, visual.secondary, visual.primary);
  return canvas;
}

const texCache = {};   // primary|emblem -> THREE.CanvasTexture
const urlCache = {};   // primary|emblem -> data URL for DOM <img>

export function emblemTexture(visual) {
  const key = visual.primary + '|' + visual.emblem;
  if (!texCache[key]) {
    const tex = new THREE.CanvasTexture(drawFlagCanvas(visual));
    tex.colorSpace = THREE.SRGBColorSpace; // r162-safe
    texCache[key] = tex;
  }
  return texCache[key];
}

export function emblemDataUrl(visual) {
  const key = visual.primary + '|' + visual.emblem;
  if (!urlCache[key]) urlCache[key] = drawFlagCanvas(visual).toDataURL();
  return urlCache[key];
}

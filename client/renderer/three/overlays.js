// A45 map overlays: one semi-transparent tinted quad per affected tile,
// floating just above the terrain surface (the city-footprint y-trick, so
// no z-fighting with the ground). RENDER-ONLY, like anim.js — never engine
// RNG or state; what to tint is decided upstream (client/ui/overlays.js)
// from the fog-filtered view, and this module just draws the given entries.
import * as THREE from 'three';
import { WATER_LEVEL } from './props.js';

const GEO = new THREE.PlaneGeometry(0.98, 0.98);
const matCache = {};
function matFor(color, alpha) {
  const key = `${color}|${alpha}`;
  if (!matCache[key]) {
    matCache[key] = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: alpha, depthWrite: false
    });
  }
  return matCache[key];
}

// entries: [{ idx, color, alpha, lift? }] — idx = tile index (y*width + x);
// lift separates stacked overlays vertically so blending never z-fights.
export function createOverlayLayer(scene) {
  const group = new THREE.Group();
  scene.add(group);
  let count = 0;
  return {
    set(entries, mapWidth, tileTop) {
      group.clear();
      count = entries ? entries.length : 0;
      if (!entries) return;
      for (const e of entries) {
        const x = e.idx % mapWidth;
        const y = (e.idx - x) / mapWidth;
        const quad = new THREE.Mesh(GEO, matFor(e.color, e.alpha));
        quad.rotation.x = -Math.PI / 2;
        // water tiles: tint ON the surface, not the sunken basin floor
        const top = Math.max(tileTop(x, y), WATER_LEVEL + 0.005);
        quad.position.set(x, top + 0.035 + (e.lift || 0), y);
        group.add(quad);
      }
    },
    count() { return count; }
  };
}

// Render-time animation layer (art A1.7 / A28): flag sway, unit movement
// glides, city smoke, combat flashes. HARD RULE (same as the A15 wave
// drift): every phase derives from the clock + world position — never from
// engine RNG or state, and nothing here is saved, hashed, or replayed. The
// simulation position updates instantly; only DISPLAY positions tween, and
// picking stays on the logical tile (index.js castAt reads view.units).
// "Reduce animation" (⚙) disables the whole layer.
import * as THREE from 'three';
import { visualRand } from './props.js';

const GLIDE_MS = 200;
const FLASH_MS = 420;
const SMOKE_POP = 5;          // cities this size and up show chimney wisps
const SMOKE_RISE = 0.45;

let smokeTex = null;
function smokeTexture() {
  if (!smokeTex) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const g = canvas.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
    grad.addColorStop(0, 'rgba(225, 228, 232, 0.9)');
    grad.addColorStop(1, 'rgba(225, 228, 232, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    smokeTex = new THREE.CanvasTexture(canvas);
  }
  return smokeTex;
}

const FLASH_GEO = new THREE.TorusGeometry(0.3, 0.05, 8, 24);

// scene: flashes live in their own group at the scene root (they must not be
// swept by the per-build mesh removal). unitMeshes: the renderer's live
// unitId -> group map — glides re-bind through it, so a mid-tween rebuild
// (every setViewState recreates meshes) just continues on the new mesh.
export function createAnimLayer(scene, unitMeshes) {
  let enabled = true;
  const sway = { unit: [], city: [] };
  const smoke = [];
  const glides = {};   // unitId -> {fx,fy,fz, tx,ty,tz, t0}
  const flashes = [];
  const fxGroup = new THREE.Group();
  scene.add(fxGroup);

  // called per freshly built unit/city group: register its sway hinges
  // (assets.js tags them with userData.sway) with a position-derived phase
  function collectSway(kind, group, x, y) {
    if (!enabled) return;
    group.traverse(child => {
      if (child.userData.sway) sway[kind].push({ node: child, phase: x * 1.7 + y * 2.9 });
    });
  }
  function resetSway(kind) { sway[kind].length = 0; }

  function addSmoke(x, y, top, pop) {
    if (!enabled || pop < SMOKE_POP) return;
    const wisps = pop >= 8 ? 3 : 2;
    for (let i = 0; i < wisps; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: smokeTexture(), color: 0xb9bec6, transparent: true,
        opacity: 0, depthWrite: false
      }));
      // deterministic chimney placement, like every other decoration —
      // biased OUTWARD so the rising wisp isn't overdrawn by the pop badge
      // sprite that floats straight above the city center
      const side = visualRand(x, y, 90 + i) < 0.5 ? -1 : 1;
      sprite.position.set(
        x + side * (0.18 + visualRand(x, y, 92 + i) * 0.2),
        top + 0.3,
        y + (visualRand(x, y, 95 + i) - 0.5) * 0.5
      );
      sprite.scale.set(0.16, 0.16, 1);
      fxGroup.add(sprite);
      smoke.push({ sprite, baseY: top + 0.3, phase: visualRand(x, y, 99 + i) + i * 0.37 });
    }
  }
  function resetSmoke() {
    for (const s of smoke) {
      fxGroup.remove(s.sprite);
      s.sprite.material.dispose(); // texture is shared — keep it
    }
    smoke.length = 0;
  }

  function glidePos(g, now) {
    const k = Math.min(1, (now - g.t0) / GLIDE_MS);
    const s = k * k * (3 - 2 * k); // smoothstep
    return {
      x: g.fx + (g.tx - g.fx) * s,
      y: g.fy + (g.ty - g.fy) * s,
      z: g.fz + (g.tz - g.fz) * s
    };
  }

  // from/to are world-space {x, y, z}. A glide already in flight chains: the
  // new tween starts from the CURRENT display position (GoTo multi-step),
  // and every tween ends exactly on the logical position — no drift.
  function glide(unitId, from, to) {
    if (!enabled) return;
    const now = performance.now();
    const prior = glides[unitId];
    const start = prior ? glidePos(prior, now) : from;
    glides[unitId] = { fx: start.x, fy: start.y, fz: start.z, tx: to.x, ty: to.y, tz: to.z, t0: now };
    const mesh = unitMeshes.get(unitId);
    if (mesh) mesh.position.set(start.x, start.y, start.z);
  }

  function flashAt(x, top, z) {
    if (!enabled) return;
    const ring = new THREE.Mesh(FLASH_GEO, new THREE.MeshBasicMaterial({
      color: 0xffd873, transparent: true, opacity: 0.9, depthWrite: false
    }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, top, z);
    fxGroup.add(ring);
    flashes.push({ ring, t0: performance.now() });
  }

  function tick(now) {
    if (!enabled) return;
    const t = now / 1000;
    for (const kind of ['unit', 'city']) {
      for (const e of sway[kind]) {
        e.node.rotation.y = Math.sin(t * 1.8 + e.phase) * 0.18;
        e.node.rotation.z = Math.sin(t * 2.6 + e.phase) * 0.04;
      }
    }
    for (const s of smoke) {
      const cycle = (t * 0.22 + s.phase) % 1;
      s.sprite.position.y = s.baseY + cycle * SMOKE_RISE;
      s.sprite.material.opacity = 0.45 * Math.sin(cycle * Math.PI);
      const size = 0.14 + cycle * 0.18;
      s.sprite.scale.set(size, size, 1);
    }
    for (const id of Object.keys(glides)) {
      const g = glides[id];
      const mesh = unitMeshes.get(id);
      if (!mesh) { delete glides[id]; continue; }
      const p = glidePos(g, now);
      mesh.position.set(p.x, p.y, p.z);
      if (now - g.t0 >= GLIDE_MS) delete glides[id];
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const k = (now - f.t0) / FLASH_MS;
      if (k >= 1) {
        fxGroup.remove(f.ring);
        f.ring.material.dispose();
        flashes.splice(i, 1);
      } else {
        const size = 0.3 + k * 1.1;
        f.ring.scale.set(size, size, size);
        f.ring.material.opacity = 0.9 * (1 - k);
      }
    }
  }

  function setEnabled(on) {
    if (enabled === on) return;
    enabled = on;
    if (!on) {
      // land everything instantly: units on their logical tiles, hinges at
      // rest, no wisps or rings (the next rebuild re-registers nothing)
      for (const id of Object.keys(glides)) {
        const mesh = unitMeshes.get(id);
        if (mesh) mesh.position.set(glides[id].tx, glides[id].ty, glides[id].tz);
        delete glides[id];
      }
      for (const kind of ['unit', 'city']) {
        for (const e of sway[kind]) e.node.rotation.set(0, 0, 0);
        resetSway(kind);
      }
      resetSmoke();
      for (const f of flashes) { fxGroup.remove(f.ring); f.ring.material.dispose(); }
      flashes.length = 0;
    }
  }

  return {
    collectSway, resetSway, addSmoke, resetSmoke, glide, flashAt, tick, setEnabled,
    busy() { return Object.keys(glides).length > 0; } // e2e: a glide is in flight
  };
}

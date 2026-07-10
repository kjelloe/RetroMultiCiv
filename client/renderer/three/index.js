// three.js low-poly renderer: tiles as flat colored boxes, units as simple
// meshes, raycast picking. Fixed-tilt camera with drag-pan and wheel-zoom.
import * as THREE from 'three';

const TERRAIN = {
  ocean:     { color: 0x1d4e79, height: 0.06 },
  grassland: { color: 0x4c9a3f, height: 0.30 },
  plains:    { color: 0xc2b46b, height: 0.30 },
  forest:    { color: 0x2d6a35, height: 0.42 },
  hills:     { color: 0x96854f, height: 0.58 },
  mountains: { color: 0x8c8c94, height: 0.95 },
  desert:    { color: 0xd9c27e, height: 0.28 },
  tundra:    { color: 0xb0b8a8, height: 0.26 },
  arctic:    { color: 0xe8eef0, height: 0.32 },
  swamp:     { color: 0x5d7a5a, height: 0.22 },
  jungle:    { color: 0x3f7d46, height: 0.44 },
  unknown:   { color: 0x0a0e16, height: 0.10 }
};
const RIVER_TINT = new THREE.Color(0x3a7ac8);
const FOG_TINT = new THREE.Color(0x0a0e16);
const TILE_GAP = 0.98; // slight seam between boxes for the retro grid look

export function createRenderer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1420);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sun.position.set(-30, 60, -20);
  scene.add(sun);

  // --- camera rig: fixed tilt, pan target + zoom distance ---
  const cam = { targetX: 0, targetZ: 0, dist: 18, minDist: 5, maxDist: 60, tilt: 0.9 };
  function updateCamera() {
    camera.position.set(
      cam.targetX,
      cam.dist * Math.sin(cam.tilt),
      cam.targetZ + cam.dist * Math.cos(cam.tilt)
    );
    camera.lookAt(cam.targetX, 0, cam.targetZ);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  // --- scene content, rebuilt by setViewState ---
  let view = null;
  let tileMesh = null;            // one InstancedMesh, instanceId = y * width + x
  const unitMeshes = new Map();   // unitId -> mesh   (client-only; Map is fine outside engine/)
  const cityMeshes = new Map();
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoSettler = new THREE.ConeGeometry(0.28, 0.55, 8);
  const geoSoldier = new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8);
  const geoCity = new THREE.BoxGeometry(0.7, 0.5, 0.7);

  const hoverMarker = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  hoverMarker.visible = false;
  scene.add(hoverMarker);

  const selectMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  );
  selectMarker.rotation.x = Math.PI / 2;
  selectMarker.visible = false;
  scene.add(selectMarker);

  function tileTop(x, y) {
    const t = view.map.tiles[y * view.map.width + x];
    return (TERRAIN[t.t] || TERRAIN.grassland).height;
  }

  function buildTiles() {
    if (tileMesh) { worldGroup.remove(tileMesh); tileMesh.dispose?.(); }
    const { width, height, tiles } = view.map;
    const mat = new THREE.MeshLambertMaterial();
    tileMesh = new THREE.InstancedMesh(geoBox, mat, width * height);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const spec = TERRAIN[tiles[i].t] || TERRAIN.grassland;
        m.makeScale(TILE_GAP, spec.height, TILE_GAP);
        m.setPosition(x, spec.height / 2, y);
        tileMesh.setMatrixAt(i, m);
        c.setHex(spec.color);
        if (tiles[i].river) c.lerp(RIVER_TINT, 0.35);
        if (tiles[i].visible === false) c.lerp(FOG_TINT, 0.45); // explored, not in sight
        tileMesh.setColorAt(i, c);
      }
    }
    tileMesh.instanceMatrix.needsUpdate = true;
    tileMesh.instanceColor.needsUpdate = true;
    worldGroup.add(tileMesh);
  }

  function buildUnits() {
    for (const mesh of unitMeshes.values()) worldGroup.remove(mesh);
    unitMeshes.clear();
    for (const u of Object.values(view.units || {})) {
      const geo = u.type === 'settlers' ? geoSettler : geoSoldier;
      const color = view.players[u.owner]?.color || '#ffffff';
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(u.x, tileTop(u.x, u.y) + 0.3, u.y);
      mesh.userData.unitId = u.id;
      unitMeshes.set(u.id, mesh);
      worldGroup.add(mesh);
    }
  }

  function buildCities() {
    for (const mesh of cityMeshes.values()) worldGroup.remove(mesh);
    cityMeshes.clear();
    for (const city of Object.values(view.cities || {})) {
      const color = view.players[city.owner]?.color || '#ffffff';
      const mesh = new THREE.Mesh(geoCity, new THREE.MeshLambertMaterial({ color }));
      mesh.position.set(city.x, tileTop(city.x, city.y) + 0.25, city.y);
      mesh.userData.cityId = city.id;
      cityMeshes.set(city.id, mesh);
      worldGroup.add(mesh);
    }
  }

  // --- picking ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pickCb = null, hoverCb = null;

  function castAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = [...unitMeshes.values(), ...cityMeshes.values()];
    if (tileMesh) targets.push(tileMesh);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    if (hit.object === tileMesh) {
      const x = hit.instanceId % view.map.width;
      const y = Math.floor(hit.instanceId / view.map.width);
      // a unit standing on this tile is picked with it
      const unit = Object.values(view.units || {}).find(u => u.x === x && u.y === y);
      return { tile: { x, y }, unitId: unit?.id, cityId: undefined };
    }
    const { unitId, cityId } = hit.object.userData;
    const src = unitId ? view.units[unitId] : view.cities[cityId];
    return { tile: { x: src.x, y: src.y }, unitId, cityId };
  }

  // --- input: click = pick, drag = pan, wheel = zoom ---
  const drag = { active: false, moved: false, x: 0, y: 0 };
  renderer.domElement.addEventListener('pointerdown', e => {
    drag.active = true; drag.moved = false; drag.x = e.clientX; drag.y = e.clientY;
  });
  window.addEventListener('pointerup', e => {
    if (drag.active && !drag.moved && pickCb && view) {
      const pick = castAt(e.clientX, e.clientY);
      if (pick) pickCb(pick);
    }
    drag.active = false;
  });
  window.addEventListener('pointermove', e => {
    if (drag.active) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) {
        const scale = cam.dist / 500;
        cam.targetX -= dx * scale;
        cam.targetZ -= dy * scale;
        drag.x = e.clientX; drag.y = e.clientY;
        updateCamera();
      }
    } else if (hoverCb && view) {
      const pick = castAt(e.clientX, e.clientY);
      if (pick) {
        hoverMarker.position.set(pick.tile.x, tileTop(pick.tile.x, pick.tile.y) / 2, pick.tile.y);
        hoverMarker.scale.setScalar(1);
        hoverMarker.scale.y = tileTop(pick.tile.x, pick.tile.y);
        hoverMarker.visible = true;
      } else {
        hoverMarker.visible = false;
      }
      hoverCb(pick);
    }
  });
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    cam.dist = Math.min(cam.maxDist, Math.max(cam.minDist, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9)));
    updateCamera();
  }, { passive: false });

  // --- render loop ---
  let disposed = false;
  function loop() {
    if (disposed) return;
    requestAnimationFrame(loop);
    renderer.render(scene, camera);
  }

  resize();
  updateCamera();
  loop();

  return {
    setViewState(v) {
      view = v;
      buildTiles();
      buildUnits();
      buildCities();
    },
    playEvents(_events) { /* step 0: no engine events yet */ },
    onPick(cb) { pickCb = cb; },
    onHover(cb) { hoverCb = cb; },
    setSelection(sel) {
      if (sel?.unitId && view?.units[sel.unitId]) {
        const u = view.units[sel.unitId];
        selectMarker.position.set(u.x, tileTop(u.x, u.y) + 0.06, u.y);
        selectMarker.visible = true;
      } else if (sel?.tile) {
        selectMarker.position.set(sel.tile.x, tileTop(sel.tile.x, sel.tile.y) + 0.06, sel.tile.y);
        selectMarker.visible = true;
      } else {
        selectMarker.visible = false;
      }
    },
    centerOn(x, y) {
      cam.targetX = x; cam.targetZ = y;
      updateCamera();
    },
    destroy() {
      disposed = true;
      window.removeEventListener('resize', resize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
  };
}

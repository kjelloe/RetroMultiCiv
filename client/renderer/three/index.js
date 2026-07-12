// three.js low-poly renderer: one continuous faceted terrain surface
// (terrain.js, specs/terrain-mesh.md), units and cities as AssetFactory
// groups (assets.js), raycast picking. Fixed-tilt camera with drag-pan and
// wheel-zoom.
import * as THREE from 'three';
import { createUnitMesh, createCityMesh, createTileProps } from './assets.js';
import { buildTerrain, terrainBaseColor } from './terrain.js';

// terrain palette shared with the DOM UI (city view mini-map)
export function terrainColor(terrainId) {
  return terrainBaseColor(terrainId);
}

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
  let terrain = null;             // { mesh, tileTop, dispose } from terrain.js
  const unitMeshes = new Map();   // unitId -> mesh   (client-only; Map is fine outside engine/)
  const cityMeshes = new Map();
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const hoverMarker = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 0.16, 1.02)),
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

  // GoTo route preview: a line riding the terrain from unit to destination
  const pathLine = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x4fd0ff })
  );
  pathLine.visible = false;
  scene.add(pathLine);
  const pathEnd = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.05, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0x4fd0ff })
  );
  pathEnd.rotation.x = Math.PI / 2;
  pathEnd.visible = false;
  scene.add(pathEnd);

  // settler site preview: translucent quads over the projected city footprint
  const footprintGroup = new THREE.Group();
  scene.add(footprintGroup);
  const geoFootprint = new THREE.PlaneGeometry(0.94, 0.94);
  const matFootprint = new THREE.MeshBasicMaterial({
    color: 0xffe066, transparent: true, opacity: 0.22, depthWrite: false
  });

  function tileTop(x, y) {
    return terrain ? terrain.tileTop(x, y) : 0;
  }

  let propMeshes = [];
  function buildTiles() {
    if (terrain) { worldGroup.remove(terrain.mesh); terrain.dispose(); }
    for (const m of propMeshes) { worldGroup.remove(m); m.dispose(); }
    // the continuous surface: heights, palette facets, river tint, fog dim
    terrain = buildTerrain(view.map);
    worldGroup.add(terrain.mesh);
    // roads draw segments toward neighbors; city tiles count as connections
    const joins = {};
    for (const city of Object.values(view.cities || {})) {
      joins[city.y * view.map.width + city.x] = true;
    }
    propMeshes = createTileProps(view.map, tileTop, joins);
    for (const m of propMeshes) worldGroup.add(m);
  }

  function buildUnits() {
    for (const mesh of unitMeshes.values()) worldGroup.remove(mesh);
    unitMeshes.clear();
    for (const u of Object.values(view.units || {})) {
      const color = view.players[u.owner]?.color || '#ffffff';
      const mesh = createUnitMesh(u.type, color); // group, base at y = 0
      mesh.position.set(u.x, tileTop(u.x, u.y), u.y);
      mesh.userData.unitId = u.id;
      unitMeshes.set(u.id, mesh);
      worldGroup.add(mesh);
    }
  }

  // population badge: a small round sprite with the city size
  const cityLabels = [];
  function makeCityLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    g.beginPath();
    g.arc(32, 32, 28, 0, Math.PI * 2);
    g.fillStyle = 'rgba(8, 12, 20, 0.82)';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = color;
    g.stroke();
    g.font = 'bold 32px monospace';
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 32, 35);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), depthTest: false
    }));
    sprite.scale.set(0.55, 0.55, 1);
    return sprite;
  }

  function buildCities() {
    for (const mesh of cityMeshes.values()) worldGroup.remove(mesh);
    cityMeshes.clear();
    for (const label of cityLabels) {
      worldGroup.remove(label);
      label.material.map.dispose();
      label.material.dispose();
    }
    cityLabels.length = 0;
    for (const city of Object.values(view.cities || {})) {
      const color = view.players[city.owner]?.color || '#ffffff';
      const mesh = createCityMesh(city, color); // group, base at y = 0
      mesh.position.set(city.x, tileTop(city.x, city.y), city.y);
      mesh.userData.cityId = city.id;
      cityMeshes.set(city.id, mesh);
      worldGroup.add(mesh);
      const label = makeCityLabel(String(city.pop), color);
      label.position.set(city.x, tileTop(city.x, city.y) + 1.05, city.y);
      cityLabels.push(label);
      worldGroup.add(label);
    }
  }

  // --- picking ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pickCb = null, hoverCb = null, dblCb = null;

  function castAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = [...unitMeshes.values(), ...cityMeshes.values()];
    if (terrain) targets.push(terrain.mesh);
    // recursive: units/cities are asset groups — the hit lands on a child
    const hit = raycaster.intersectObjects(targets, true)[0];
    if (!hit) return null;
    if (terrain && hit.object === terrain.mesh) {
      // continuous surface: the hit point IS the tile (tiles centered on ints)
      const x = Math.min(view.map.width - 1, Math.max(0, Math.round(hit.point.x)));
      const y = Math.min(view.map.height - 1, Math.max(0, Math.round(hit.point.z)));
      // a unit standing on this tile is picked with it
      const unit = Object.values(view.units || {}).find(u => u.x === x && u.y === y);
      return { tile: { x, y }, unitId: unit?.id, cityId: undefined };
    }
    let obj = hit.object;
    while (obj && !obj.userData.unitId && !obj.userData.cityId) obj = obj.parent;
    if (!obj) return null;
    const { unitId, cityId } = obj.userData;
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
        // a thin frame floating just above the surface at the tile center
        hoverMarker.position.set(pick.tile.x, tileTop(pick.tile.x, pick.tile.y) + 0.06, pick.tile.y);
        hoverMarker.visible = true;
      } else {
        hoverMarker.visible = false;
      }
      hoverCb(pick);
    }
  });
  renderer.domElement.addEventListener('dblclick', e => {
    if (dblCb && view) {
      const pick = castAt(e.clientX, e.clientY);
      if (pick) dblCb(pick);
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
    onDblPick(cb) { dblCb = cb; },
    setHoverColor(hex) { hoverMarker.material.color.setHex(hex); },
    // GoTo preview: ordered tile points, or null to clear. Drawn as segment
    // pairs so a wrap-crossing step doesn't streak across the whole map.
    setPath(points) {
      if (!points || points.length < 2 || !view) {
        pathLine.visible = false;
        pathEnd.visible = false;
        return;
      }
      const segs = [];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        if (Math.abs(a.x - b.x) > 1) continue; // seam step: skip the streak
        segs.push(a.x, tileTop(a.x, a.y) + 0.22, a.y);
        segs.push(b.x, tileTop(b.x, b.y) + 0.22, b.y);
      }
      pathLine.geometry.dispose();
      pathLine.geometry = new THREE.BufferGeometry();
      pathLine.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
      pathLine.visible = segs.length > 0;
      const last = points[points.length - 1];
      pathEnd.position.set(last.x, tileTop(last.x, last.y) + 0.1, last.y);
      pathEnd.visible = true;
    },
    // tiles: [{x, y}] to highlight (the settler's would-be city footprint), or null
    setFootprint(tiles) {
      footprintGroup.clear();
      if (!tiles || !view) return;
      for (const t of tiles) {
        const quad = new THREE.Mesh(geoFootprint, matFootprint);
        quad.rotation.x = -Math.PI / 2;
        quad.position.set(t.x, tileTop(t.x, t.y) + 0.02, t.y);
        footprintGroup.add(quad);
      }
    },
    setSelection(sel) {
      if (sel?.unitId && view?.units[sel.unitId]) {
        const u = view.units[sel.unitId];
        // yellow = can still move, orange = out of movement points
        selectMarker.material.color.setHex(u.moves > 0 ? 0xffe066 : 0xe07b30);
        selectMarker.position.set(u.x, tileTop(u.x, u.y) + 0.06, u.y);
        selectMarker.visible = true;
      } else if (sel?.tile) {
        selectMarker.material.color.setHex(0xffe066);
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
    setZoom(dist) {
      cam.dist = Math.min(cam.maxDist, Math.max(cam.minDist, dist));
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

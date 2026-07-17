// three.js low-poly renderer: one continuous faceted terrain surface
// (terrain.js, specs/terrain-mesh.md), units and cities as AssetFactory
// groups (assets.js), raycast picking. Fixed-tilt camera with drag-pan and
// wheel-zoom.
import * as THREE from 'three';
import { createUnitMesh, createCityMesh } from './assets.js';
import { createTileProps, WATER_LEVEL } from './props.js';
import { buildTerrain, buildWater, terrainBaseColor } from './terrain.js';
import { createAnimLayer } from './anim.js';
import { createOverlayLayer } from './overlays.js';
import { displayColor, displayVisual } from '../../ui/palette.js';

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
  let water = null;               // { mesh, tick, dispose } — translucent plane (A1.6b)
  const unitMeshes = new Map();   // unitId -> mesh   (client-only; Map is fine outside engine/)
  const cityMeshes = new Map();
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);
  // A28 animation layer: sway/glide/smoke/flash — render-time only, disabled
  // by the ⚙ "reduce animation" option (setReduceAnimation below)
  const anim = createAnimLayer(scene, unitMeshes);
  let animReduced = false; // A48: also freezes the water drift when true
  // A45 data overlays: tinted per-tile quads, contents decided by the UI
  const overlays = createOverlayLayer(scene);

  const hoverMarker = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 0.16, 1.02)),
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  hoverMarker.visible = false;
  scene.add(hoverMarker);
  // A19 movement affordance: a small arrow on the hover ring pointing along
  // the step the click would take (input.js decides legality; we just aim it)
  const hoverArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.24, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  );
  hoverArrow.rotation.order = 'YXZ'; // yaw around world-Y after the flat tilt
  hoverArrow.rotation.x = Math.PI / 2; // lie flat, tip pointing +z before yaw
  hoverArrow.visible = false;
  scene.add(hoverArrow);
  const ARROW_YAW = { // radians around Y so the tip points INTO the tile
    E: Math.PI / 2, NE: Math.PI * 0.75, N: Math.PI, NW: -Math.PI * 0.75,
    W: -Math.PI / 2, SW: -Math.PI / 4, S: 0, SE: Math.PI / 4
  };

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
    if (water) { worldGroup.remove(water.mesh); water.dispose(); }
    water = buildWater(view.map);
    worldGroup.add(water.mesh);
    // roads draw segments toward neighbors; city tiles count as connections
    const joins = {};
    for (const city of Object.values(view.cities || {})) {
      joins[city.y * view.map.width + city.x] = true;
    }
    propMeshes = createTileProps(view.map, tileTop, joins);
    for (const m of propMeshes) worldGroup.add(m);
  }

  // faction visuals (art A1.6a): pid -> {primary, secondary, emblem} from
  // data/civs.json, provided by the host (main.js/gallery). Anyone absent
  // falls back to their plain player color — mock/test states, lobby games.
  let factions = {};
  function visualOf(pid) {
    // palette pass: every visual/color leaves through the display remap
    // (identity unless a ⚙ palette mode is on — ui/palette.js)
    const v = factions[pid];
    if (v) return typeof v === 'string' ? displayColor(v) : displayVisual(v);
    return displayColor(view.players[pid]?.color || '#ffffff');
  }

  function unitTop(x, y) {
    // units on water ride the SURFACE, not the sunken basin floor — else the
    // translucent water plane (A1.6b) washes out their ownership disc
    return Math.max(tileTop(x, y), WATER_LEVEL + 0.01);
  }

  function buildUnits() {
    for (const mesh of unitMeshes.values()) worldGroup.remove(mesh);
    unitMeshes.clear();
    anim.resetSway('unit');
    for (const u of Object.values(view.units || {})) {
      const mesh = createUnitMesh(u.type, visualOf(u.owner), {
        veteran: u.veteran === true,
        fortified: u.fortified === true,
        canMove: u.moves > 0
      }); // group, base at y = 0
      mesh.position.set(u.x, unitTop(u.x, u.y), u.y);
      mesh.userData.unitId = u.id;
      unitMeshes.set(u.id, mesh);
      worldGroup.add(mesh);
      anim.collectSway('unit', mesh, u.x, u.y);
    }
  }

  // population badge: a small round sprite with the city size
  const cityLabels = [];
  // A68: cityId -> { text, alert } from the UI (hud) — read by buildCities
  let cityNotes = {};
  const disorderRings = [];
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

  // A36: the city's NAME on the map — a pill sprite under the pop badge,
  // faction-tinted border (shipped variant; plain lost the shot comparison).
  // Fog-safe by construction: buildCities reads the filtered view, and rival
  // shells carry name/pop only once explored.
  function makeNameLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 44;
    const g = canvas.getContext('2d');
    g.font = 'bold 22px monospace';
    const w = Math.min(250, g.measureText(text).width + 20);
    const x0 = (256 - w) / 2;
    g.beginPath();
    g.roundRect(x0, 4, w, 34, 12);
    g.fillStyle = 'rgba(8, 12, 20, 0.8)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = color;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 22);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), depthTest: false
    }));
    // screen-constant-ish: the loop rescales by camera distance so the name
    // stays readable zoomed out and stops ballooning zoomed in
    sprite.userData.nameScale = { w: 1.45, h: 0.25 };
    sprite.scale.set(1.45, 0.25, 1);
    return sprite;
  }

  // A68 (VIII.10): a smaller second pill under the name — production + turns
  // left for OWN cities; alert (civil disorder) flips it red-bordered.
  function makeNoteLabel(text, alert) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 40;
    const g = canvas.getContext('2d');
    g.font = 'bold 18px monospace';
    const w = Math.min(250, g.measureText(text).width + 18);
    const x0 = (256 - w) / 2;
    g.beginPath();
    g.roundRect(x0, 4, w, 30, 10);
    g.fillStyle = alert ? 'rgba(64, 12, 4, 0.85)' : 'rgba(8, 12, 20, 0.75)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = alert ? '#ff5533' : '#5a7396';
    g.stroke();
    g.fillStyle = alert ? '#ffd9cc' : '#cdd8ea';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 20);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas), depthTest: false
    }));
    sprite.userData.nameScale = { w: 1.2, h: 0.19 }; // rides the same zoom rescale as the name pill
    sprite.scale.set(1.2, 0.19, 1);
    return sprite;
  }

  function buildCities() {
    for (const mesh of cityMeshes.values()) worldGroup.remove(mesh);
    cityMeshes.clear();
    anim.resetSway('city');
    anim.resetSmoke();
    for (const label of cityLabels) {
      worldGroup.remove(label);
      label.material.map.dispose();
      label.material.dispose();
    }
    cityLabels.length = 0;
    for (const ring of disorderRings) {
      worldGroup.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    }
    disorderRings.length = 0;
    for (const city of Object.values(view.cities || {})) {
      const color = displayColor(view.players[city.owner]?.color || '#ffffff'); // palette pass
      // the capital flies the CanvasTexture emblem flag (own cities carry
      // buildings in the view; rival shells only show walls — pennant then)
      const isCapital = (city.buildings || []).indexOf('palace') !== -1;
      const mesh = createCityMesh(city, visualOf(city.owner), isCapital); // base at y = 0
      mesh.position.set(city.x, tileTop(city.x, city.y), city.y);
      mesh.userData.cityId = city.id;
      cityMeshes.set(city.id, mesh);
      worldGroup.add(mesh);
      anim.collectSway('city', mesh, city.x, city.y);
      anim.addSmoke(city.x, city.y, tileTop(city.x, city.y), city.pop);
      const label = makeCityLabel(String(city.pop), color);
      label.position.set(city.x, tileTop(city.x, city.y) + 1.05, city.y);
      cityLabels.push(label);
      worldGroup.add(label);
      if (city.name) { // A36: the name pill sits clear BELOW the pop badge
        const nameLabel = makeNameLabel(city.name, color);
        nameLabel.position.set(city.x, tileTop(city.x, city.y) + 0.62, city.y);
        cityLabels.push(nameLabel); // same lifecycle: removed + disposed on rebuild
        worldGroup.add(nameLabel);
      }
      // A68 (VIII.10/13): the production/disorder note pill below the name;
      // disorder additionally rings the tile red — LOUD on the map
      const note = cityNotes[city.id];
      if (note) {
        const noteLabel = makeNoteLabel(note.text, note.alert === true);
        noteLabel.position.set(city.x, tileTop(city.x, city.y) + 0.4, city.y);
        cityLabels.push(noteLabel);
        worldGroup.add(noteLabel);
        if (note.alert === true) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.55, 0.045, 8, 28),
            new THREE.MeshBasicMaterial({ color: 0xff4433 })
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.set(city.x, tileTop(city.x, city.y) + 0.06, city.y);
          disorderRings.push(ring);
          worldGroup.add(ring);
        }
      }
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

  // --- input: click/tap = pick, drag = pan, wheel/pinch = zoom ---
  // L7a (mobile T1): the canvas carries CSS touch-action:none, so touch
  // swipes reach these POINTER handlers instead of scrolling the page —
  // one unified path for mouse and finger. Two concurrent pointers = pinch
  // (the canvas pinch replaces the browser-page zoom touch-action removed).
  const drag = { active: false, moved: false, x: 0, y: 0 };
  const touches = new Map(); // pointerId -> {x, y} (render-time input, not state)
  let pinchDist = 0;
  renderer.domElement.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      drag.active = false; // a second finger ends the pan; pinch owns the gesture
      return;
    }
    drag.active = true; drag.moved = false; drag.x = e.clientX; drag.y = e.clientY;
  });
  const endPointer = e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchDist = 0;
  };
  window.addEventListener('pointercancel', endPointer);
  window.addEventListener('pointerup', e => {
    endPointer(e);
    if (drag.active && !drag.moved && pickCb && view) {
      const pick = castAt(e.clientX, e.clientY);
      if (pick) pickCb(pick);
    }
    drag.active = false;
  });
  window.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinchDist > 0) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) {
        cam.dist = Math.min(cam.maxDist, Math.max(cam.minDist, cam.dist * (pinchDist / d)));
        pinchDist = d;
        updateCamera();
      }
      return;
    }
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
        hoverArrow.visible = false;
      }
      hoverCb(pick); // may call setHoverArrow for the move affordance
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
    const now = performance.now();
    // A48: reduce-animation freezes the water drift too (it is render-time
    // animation like the rest) — completes the accessibility option AND makes
    // ocean-bearing frames byte-stable for the visual-regression goldens
    if (water && !animReduced) water.tick(now); // wave drift: render time only
    anim.tick(now);             // A28 sway/glide/smoke/flash: same clock
    // A36: name pills track the camera distance (readable at any zoom)
    const nameF = Math.min(2.2, Math.max(0.8, cam.dist / 12));
    for (const l of cityLabels) {
      const ns = l.userData.nameScale;
      if (ns) l.scale.set(ns.w * nameF, ns.h * nameF, 1);
    }
    renderer.render(scene, camera);
  }

  resize();
  updateCamera();
  loop();

  return {
    setViewState(v) {
      // A28 movement glide: snapshot logical positions before the rebuild,
      // then tween any unit that stepped ONE tile (multi-tile jumps and
      // wrap-seam steps snap, matching setPath's seam rule). Picking is
      // untouched — castAt resolves from view.units, the logical truth.
      const prev = {};
      if (view) {
        for (const u of Object.values(view.units || {})) prev[u.id] = { x: u.x, y: u.y };
      }
      view = v;
      buildTiles();
      buildUnits();
      buildCities();
      for (const u of Object.values(view.units || {})) {
        const p = prev[u.id];
        if (!p || (p.x === u.x && p.y === u.y)) continue;
        if (Math.abs(p.x - u.x) > 1 || Math.abs(p.y - u.y) > 1) continue;
        anim.glide(u.id,
          { x: p.x, y: unitTop(p.x, p.y), z: p.y },
          { x: u.x, y: unitTop(u.x, u.y), z: u.y });
      }
    },
    // faction visuals (art A1.6a): pid -> data/civs.json `visual` object;
    // players absent from the map keep their plain color
    // A68 (VIII.10/13): own-city note pills (production/turns, disorder
    // alert). Call BEFORE setViewState — buildCities reads the current map.
    setCityNotes(n) {
      cityNotes = n || {};
    },
    setFactions(map) {
      factions = map || {};
      if (view) { buildUnits(); buildCities(); }
    },
    // A28 combat flash: a brief expanding ring at each combat site (the
    // caller filters to viewer-involved fights — pairs with the A16 linger)
    playEvents(events) {
      if (!view) return;
      for (const e of events || []) {
        if (e.type === 'combatResolved' && e.x !== undefined) {
          anim.flashAt(e.x, unitTop(e.x, e.y) + 0.3, e.y);
        }
      }
    },
    // A28 accessibility: ⚙ "reduce animation" — no sway/smoke/flashes,
    // movement lands instantly
    setReduceAnimation(flag) { animReduced = flag === true; anim.setEnabled(flag !== true); },
    animBusy() { return anim.busy(); }, // e2e: is a glide in flight?
    // A45: replace the data-overlay quads ([{idx,color,alpha,lift?}] | null)
    setOverlays(entries) {
      if (!view) return; // pre-first-refresh: onChange recomputes right after
      overlays.set(entries, view.map.width, tileTop);
    },
    overlayCount() { return overlays.count(); }, // e2e probe
    onPick(cb) { pickCb = cb; },
    onHover(cb) { hoverCb = cb; },
    onDblPick(cb) { dblCb = cb; },
    setHoverColor(hex) { hoverMarker.material.color.setHex(hex); },
    // A19: aim the small move-affordance arrow along the step direction the
    // click would take, riding the hover ring; null hides it
    setHoverArrow(dir) {
      if (dir === null || ARROW_YAW[dir] === undefined || !hoverMarker.visible) {
        hoverArrow.visible = false;
        return;
      }
      hoverArrow.position.copy(hoverMarker.position);
      hoverArrow.position.y += 0.1;
      hoverArrow.rotation.set(Math.PI / 2, ARROW_YAW[dir], 0);
      hoverArrow.visible = true;
    },
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
    // L7b: relative pan in tile units (the d-pad's coarse movement)
    panBy(dx, dy) {
      cam.targetX += dx; cam.targetZ += dy;
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

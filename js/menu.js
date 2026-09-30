// Title screen: the three maps as miniature living dioramas, slices cut out of each world (you can see the earth
// and water layers on the sides), floating in a dark display case under their own spotlights. The whole scene
// drifts with the cursor; hovering a world lifts it toward you, tilts it after the cursor and dims the others while
// its name, place and description fade in underneath. Clicking one flies the camera down into it, then hands over
// to the real map load (the original menu buttons stay the source of truth, so load() is untouched).
// It has its own small renderer, which is stopped and disposed as soon as the game starts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const S = 5.6, H = S / 2;                                   // diorama tile size
const MAPS = ['downtown', 'tropical', 'suburbs'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);

// ---------- shared bits ----------
function tint(geo, c) {
  const g = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// facade atlas: walls white (tinted per building), windows dark glass; the emissive twin lights some of them.
// The bottom-left corner is plain wall so roofs can point their uvs there.
function facadeTextures() {
  const N = 64, lit = [];
  const map = canvasTex(N, N, (x) => {
    x.fillStyle = '#e8e6e2'; x.fillRect(0, 0, N, N);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = '#39414d'; x.fillRect(c * 16 + 4, r * 16 + 3, 8, 10); lit.push(Math.random() < 0.55); }
  });
  const em = canvasTex(N, N, (x) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
    let k = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (lit[k++]) { x.fillStyle = pick(['#ffcf87', '#ffe2ad', '#ffd49a', '#cfe3ff']); x.fillRect(c * 16 + 4, r * 16 + 3, 8, 10); }
  });
  for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; }
  return { map, em };
}
// a box building with windows scaled to its size and a darker, windowless roof
function building(w, h, d, x, z, color, pitch = 0.3) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, h / 2, z);
  const uv = g.attributes.uv, n = g.attributes.normal, col = new Float32Array(uv.count * 3), c = new THREE.Color(color);
  for (let i = 0; i < uv.count; i++) {
    const ny = n.getY(i), nx = Math.abs(n.getX(i));
    if (Math.abs(ny) > 0.5) { uv.setXY(i, 0.02, 0.02); c.clone().multiplyScalar(0.55).toArray(col, i * 3); continue; }
    uv.setXY(i, uv.getX(i) * (nx > 0.5 ? d : w) / pitch, uv.getY(i) * h / pitch); c.toArray(col, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const block = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

// ---------- one diorama ----------
class Diorama {
  constructor(kind, tex) {
    this.kind = kind; this.g = new THREE.Group(); this.inner = new THREE.Group(); this.g.add(this.inner);
    this.focus = 0.6; this.hover = 0; this.movers = []; this.update = [];
    const mood = { downtown: [0x9fc4ff, 0xffd49a], tropical: [0xffc58a, 0xffe0b0], suburbs: [0xc7a0ff, 0xff9fd6] }[kind];
    this.mat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.em, emissive: 0xffe0b0, emissiveIntensity: 1.2, vertexColors: true, roughness: 0.8 });
    this.plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    this.glow = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
    // display-case spotlight + a coloured rim from behind
    this.spot = new THREE.SpotLight(mood[1], 40, 22, 0.5, 0.7, 1.4); this.spot.position.set(0, 9, 3.5); this.spot.target = this.inner; this.g.add(this.spot);
    this.rim = new THREE.PointLight(mood[0], 10, 12, 1.6); this.rim.position.set(0, 3, -4.5); this.g.add(this.rim);
    this[kind]();
    // invisible hit box for the cursor
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(S, 4.4, S).translate(0, 0.8, 0), new THREE.MeshBasicMaterial({ visible: false }));
    this.g.add(this.hit);
    this.inner.traverse((o) => { if (o.isMesh && o !== this.hit) { o.castShadow = true; o.receiveShadow = true; } });
  }
  add(geos, mat = this.plain) { const m = new THREE.Mesh(mergeGeometries(geos), mat); this.inner.add(m); return m; }
  // the slice: painted top, then earth layers down the sides; `water` cuts a translucent sea section into it
  slab(paint, water = null) {
    const top = canvasTex(512, 512, (x, w) => { x.scale(w / S, w / S); x.translate(H, H); paint(x); if (water) x.clearRect(water.x0, water.z0, water.x1 - water.x0, water.z1 - water.z0); });
    const P = [];
    const layers = [[0.1, 0x6b5238], [0.18, 0x7a5c3e], [0.34, 0x5a4431], [0.6, 0x3b302a]];
    const cut = (x0, x1, z0, z1, from) => { let y = from; for (const [h, c] of layers) { P.push(block(x1 - x0, h, z1 - z0, (x0 + x1) / 2, y - h / 2, (z0 + z1) / 2, c)); y -= h; } };
    if (!water) cut(-H, H, -H, H, -0.02);
    else {
      const { x0, x1, z0, z1, depth } = water;
      // land around the water, then the sea bed under it
      if (z0 > -H) cut(-H, H, -H, z0, -0.02);
      if (z1 < H) cut(-H, H, z1, H, -0.02);
      if (x0 > -H) cut(-H, x0, z0, z1, -0.02);
      if (x1 < H) cut(x1, H, z0, z1, -0.02);
      P.push(block(x1 - x0, 0.12, z1 - z0, (x0 + x1) / 2, -depth - 0.06, (z0 + z1) / 2, 0xc9b58a));
      cut(x0, x1, z0, z1, -depth - 0.12);
      const sea = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, depth, z1 - z0).translate((x0 + x1) / 2, -depth / 2 - 0.03, (z0 + z1) / 2),
        new THREE.MeshStandardMaterial({ color: 0x155a74, transparent: true, opacity: 0.78, roughness: 0.5, metalness: 0 }));
      this.inner.add(sea);
      // the moving surface
      const seg = 28, geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, seg, seg).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0.005, (z0 + z1) / 2);
      const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: water.color || 0x2a8fb0, roughness: 0.35, metalness: 0, flatShading: true }));
      surf.receiveShadow = true; this.inner.add(surf);
      const base = geo.attributes.position.array.slice();
      this.update.push((t) => {
        const p = geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) p[i + 1] = base[i + 1] + Math.sin(base[i] * 3.1 + t * 1.6) * 0.014 + Math.sin(base[i + 2] * 4.3 - t * 2.1) * 0.012;
        geo.computeVertexNormals();
        geo.attributes.position.needsUpdate = true;
      });
    }
    this.add(P);
    const topMesh = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: top, roughness: 0.9, transparent: true }));
    topMesh.position.y = -0.015; topMesh.receiveShadow = true; this.inner.add(topMesh);
  }
  // things that move along a closed polyline
  mover(mesh, path, speed, offset = 0, y = 0) {
    let L = 0; const seg = [];
    for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push([a, b, l]); L += l; }
    this.movers.push({ mesh, seg, L, speed, s: offset * L, y });
  }
  cars(routes, n, colors) {
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.07, 0.19).translate(0, 0.05, 0), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), n);
    const lights = new THREE.InstancedMesh(mergeGeometries([new THREE.BoxGeometry(0.08, 0.02, 0.01).translate(0, 0.055, 0.1), new THREE.BoxGeometry(0.08, 0.02, 0.01).translate(0, 0.055, -0.1)]), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }), n);
    for (let i = 0; i < n; i++) body.setColorAt(i, new THREE.Color(pick(colors)));
    this.inner.add(body, lights); body.castShadow = true;
    const cars = [];
    for (let i = 0; i < n; i++) { const r = routes[i % routes.length]; cars.push({ r, s: R(0, 1), v: R(0.35, 0.55) }); }
    this.update.push((t, dt) => {
      cars.forEach((c, i) => {
        c.s = (c.s + c.v * dt / c.r.len) % 1;
        const u = c.s, x = c.r.a[0] + (c.r.b[0] - c.r.a[0]) * u, z = c.r.a[1] + (c.r.b[1] - c.r.a[1]) * u;
        _q.setFromAxisAngle(_v.set(0, 1, 0), Math.atan2(c.r.b[0] - c.r.a[0], c.r.b[1] - c.r.a[1]));
        const vis = u > 0.02 && u < 0.98 ? 1 : 0;
        _m.compose(_v.set(x, 0, z), _q, _s.set(vis, vis, vis)); body.setMatrixAt(i, _m); lights.setMatrixAt(i, _m);
      });
      body.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    });
  }
  // little people pacing the sidewalks
  people(spots, n, colors) {
    const p = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.1, 5).translate(0, 0.05, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const list = [];
    for (let i = 0; i < n; i++) {
      const [x0, z0, x1, z1] = pick(spots);
      list.push({ a: [R(x0, x1), R(z0, z1)], b: [R(x0, x1), R(z0, z1)], s: Math.random(), v: R(0.08, 0.16), ph: R(0, 6) });
      p.setColorAt(i, new THREE.Color(pick(colors)));
    }
    this.inner.add(p);
    this.update.push((t, dt) => {
      list.forEach((q, i) => {
        const L = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) || 0.1;
        q.s += q.v * dt / L; if (q.s > 1) { q.s = 0; q.a = q.b; const [x0, z0, x1, z1] = pick(spots); q.b = [R(x0, x1), R(z0, z1)]; }
        _m.makeTranslation(q.a[0] + (q.b[0] - q.a[0]) * q.s, Math.abs(Math.sin(t * 9 + q.ph)) * 0.008, q.a[1] + (q.b[1] - q.a[1]) * q.s);
        p.setMatrixAt(i, _m);
      });
      p.instanceMatrix.needsUpdate = true;
    });
  }
  palm(P, L, x, z, s = 1) {
    P.push(tint(new THREE.CylinderGeometry(0.018 * s, 0.028 * s, 0.5 * s, 5).translate(0, 0.25 * s, 0).rotateZ(R(-0.15, 0.15)).translate(x, 0, z), 0x6b4a2e));
    for (let k = 0; k < 6; k++) L.push(tint(new THREE.ConeGeometry(0.035 * s, 0.32 * s, 4).rotateZ(Math.PI / 2 - 0.5).translate(0.15 * s, 0, 0).rotateY(k * 1.05 + R(0, 0.3)).translate(x, 0.5 * s, z), pick([0x2f7a3a, 0x3b8a3f, 0x2a6b34])));
  }

  // ---------- GASLAMP: towers, the harbour with a cruise ship, the ballpark, a trolley ----------
  downtown() {
    const W = { x0: -H, x1: -1.7, z0: -H, z1: H, depth: 0.34, color: 0x1f6f95 };
    this.slab((x) => {
      x.fillStyle = '#3b3e44'; x.fillRect(-H, -H, S, S);
      x.fillStyle = '#9b958b'; x.fillRect(-1.7, -H, 0.34, S);                                  // promenade
      x.fillStyle = '#26282c'; x.fillRect(-0.55, -H, 0.5, S); x.fillRect(-1.36, 0.45, 4.2, 0.5);   // streets
      x.strokeStyle = '#d9b44a'; x.lineWidth = 0.02; x.setLineDash([0.08, 0.06]);
      x.beginPath(); x.moveTo(-0.3, -H); x.lineTo(-0.3, H); x.moveTo(-1.36, 0.7); x.lineTo(H, 0.7); x.stroke();
      x.setLineDash([]); x.fillStyle = '#8f8a82';
      for (const [a, b, c, d] of [[-1.36, -H, -0.55, 0.45], [-0.05, -H, H, 0.45], [-1.36, 0.95, -0.55, H], [-0.05, 0.95, H, H]]) { x.fillRect(a, b, c - a, 0.08); x.fillRect(a, d - 0.08, c - a, 0.08); }
      // the ballpark: green diamond in a sandstone bowl
      x.fillStyle = '#c9b89a'; x.beginPath(); x.arc(1.35, 1.8, 0.95, 0, 7); x.fill();
      x.fillStyle = '#4f8a33'; x.beginPath(); x.arc(1.35, 1.8, 0.7, 0, 7); x.fill();
      x.fillStyle = '#b98a5a'; x.beginPath(); x.moveTo(1.35, 2.35); x.lineTo(1.75, 1.95); x.lineTo(1.35, 1.55); x.lineTo(0.95, 1.95); x.fill();
      x.fillStyle = '#5f8d3c'; x.fillRect(-1.3, 1.05, 0.7, 1.6);                               // a little park
    }, W);
    const B = [], P = [], L = [];
    const tones = [0xb9c3cf, 0xd6d0c4, 0x8f9aa8, 0xa8653f, 0xc7b89e, 0x7f8ea3];
    // towers on the two north blocks, mid-rises on the south-west
    for (const [x, z, w, d, h] of [[-1.05, -2.2, 0.55, 0.6, 1.3], [-0.95, -1.35, 0.7, 0.8, 2.1], [-1.05, -0.35, 0.55, 0.9, 0.9],
      [0.35, -2.15, 0.7, 0.7, 2.8], [1.3, -2.2, 0.8, 0.6, 1.9], [2.25, -2.1, 0.55, 0.75, 1.2], [0.4, -1.1, 0.75, 0.8, 1.6], [1.4, -1.0, 0.85, 0.9, 3.3], [2.3, -0.9, 0.5, 0.7, 0.8], [0.45, -0.1, 0.6, 0.6, 0.7], [1.55, -0.05, 1.2, 0.5, 1.0]])
      B.push(building(w, h, d, x, z, pick(tones), 0.22));
    // setbacks + crowns on the tallest
    B.push(building(0.5, 0.5, 0.55, 1.4, -1.0, 0xb9c3cf, 0.22).translate(0, 3.3, 0), building(0.45, 0.6, 0.45, 0.35, -2.15, 0x8f9aa8, 0.22).translate(0, 2.8, 0));
    this.add(B, this.mat);
    // the ballpark bowl: stands round the field, light towers
    for (let k = 0; k < 20; k++) { const a = -0.3 + k / 19 * 3.6; P.push(block(0.24, 0.3, 0.12, 1.35 + Math.cos(a) * 0.82, 0.15, 1.8 + Math.sin(a) * 0.82, pick([0x1c2945, 0x24345a])).rotateY(0)); }
    for (const [a] of [[0.2], [1.6], [3.1]]) { P.push(block(0.03, 0.7, 0.03, 1.35 + Math.cos(a) * 1.0, 0.35, 1.8 + Math.sin(a) * 1.0, 0xe8e8e4)); L.push(block(0.12, 0.05, 0.05, 1.35 + Math.cos(a) * 1.0, 0.72, 1.8 + Math.sin(a) * 1.0, 0xfff4d8)); }
    // pier + cruise ship
    P.push(block(0.9, 0.06, 0.28, -2.15, 0.02, 0.2, 0xc9c3b6), block(0.9, 0.06, 0.28, -2.15, 0.02, -1.6, 0xc9c3b6));
    const ship = new THREE.Group();
    ship.add(new THREE.Mesh(mergeGeometries([block(0.34, 0.2, 1.7, 0, 0.02, 0, 0xf2f2f0), block(0.34, 0.05, 1.7, 0, -0.08, 0, 0x1f3f73), building(0.28, 0.24, 1.3, 0, 0, 0.05, 0xf2f2f0, 0.1).translate(0, 0.12, 0), block(0.1, 0.12, 0.14, 0, 0.42, -0.45, 0xc8102e)]), this.mat));
    ship.position.set(-2.25, -0.03, -0.7); this.inner.add(ship);
    this.update.push((t) => { ship.position.y = -0.03 + Math.sin(t * 0.9) * 0.012; ship.rotation.z = Math.sin(t * 0.7) * 0.012; });
    // palms along the promenade, street lamps
    for (let z = -2.4; z < 2.6; z += 0.55) this.palm(P, P, -1.53, z, 0.9);
    for (const [x, z] of [[-0.62, -2], [-0.62, -1], [-0.62, 0.2], [0.02, 1.2], [0.02, 2.3], [-0.62, 1.4], [1, 0.38], [2, 0.38], [-1, 1.02]]) { P.push(block(0.015, 0.28, 0.015, x, 0.14, z, 0x2f3338)); L.push(block(0.05, 0.02, 0.05, x, 0.29, z, 0xffe4b0)); }
    this.add(P); this.add(L, this.glow);
    // the trolley and the traffic
    const trolley = new THREE.Mesh(mergeGeometries([block(0.13, 0.11, 0.7, 0, 0.07, 0, 0xc8102e), block(0.135, 0.03, 0.6, 0, 0.1, 0, 0xfff1c8)]), this.plain);
    this.inner.add(trolley); trolley.castShadow = true;
    let tz = -H;
    this.update.push((t, dt) => { tz += dt * 0.35; if (tz > H + 0.4) tz = -H - 0.4; trolley.position.set(-0.42, 0, tz); trolley.visible = Math.abs(tz) < H - 0.3; });
    this.cars([{ a: [-0.2, -H], b: [-0.2, H], len: S }, { a: [H, 0.58], b: [-1.3, 0.58], len: 4.1 }, { a: [-1.3, 0.82], b: [H, 0.82], len: 4.1 }], 8, [0xf2f2f0, 0x1c1d20, 0x9e1b1b, 0x1e3f73, 0xf2c230, 0x8a9096]);
    this.people([[-1.66, -2.6, -1.4, 2.6], [-0.6, -2.6, -0.52, 2.6], [-0.05, 0.36, 2.6, 0.42], [-0.05, 0.98, 2.6, 1.02]], 36, [0xe8e4dc, 0x2b2d33, 0xb33a3a, 0x3565a8, 0xe0b640, 0x4f7f4a]);
  }

  // ---------- LA PLAYA: pastel town, hotel, palms, umbrellas on the sand, waves and boats ----------
  tropical() {
    const W = { x0: -H, x1: H, z0: 0.75, z1: H, depth: 0.42, color: 0x2aa3b8 };
    this.slab((x) => {
      x.fillStyle = '#d9c7a0'; x.fillRect(-H, -H, S, S);
      x.fillStyle = '#c8c0b0'; x.fillRect(-H, -H, S, 1.7);                                    // town
      x.fillStyle = '#3a3c3e'; x.fillRect(-H, -1.05, S, 0.36);                                 // coast road
      x.strokeStyle = '#f2f2ee'; x.lineWidth = 0.015; x.setLineDash([0.07, 0.07]); x.beginPath(); x.moveTo(-H, -0.87); x.lineTo(H, -0.87); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#e6d6b0'; x.fillRect(-H, -0.69, S, 0.12);                                 // malecón
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,235' : '170,150,110'},.25)`; x.fillRect(R(-H, H), R(-0.57, 0.8), 0.02, 0.02); }
      x.fillStyle = '#3fb6c8'; x.fillRect(1.3, -2.3, 0.8, 0.45); x.fillStyle = '#6fd6e0'; x.fillRect(1.35, -2.25, 0.7, 0.35);   // hotel pool
    }, W);
    const B = [], P = [], L = [];
    const pastel = [0xf2c9a0, 0xf7e3a8, 0xbfe3d6, 0xf4b8b8, 0xe8e0f5, 0xffffff, 0xf0d0a0];
    for (let x = -2.5; x < 0.9; x += R(0.45, 0.6)) for (const z of [-2.45, -1.55]) B.push(building(R(0.36, 0.46), R(0.22, 0.5), R(0.38, 0.5), x, z, pick(pastel), 0.18));
    B.push(building(0.95, 1.9, 0.55, 1.65, -1.55, 0xf4f1e8, 0.2), building(0.75, 0.3, 0.45, 1.65, -1.55, 0xf4f1e8, 0.2).translate(0, 1.9, 0));
    this.add(B, this.mat);
    for (let x = -2.6; x < 2.7; x += R(0.45, 0.7)) this.palm(P, P, x, -0.62 + R(-0.03, 0.03), R(0.85, 1.15));
    for (const [x, z] of [[-2, -2], [0.2, -2.05], [-0.9, -1.95], [2.4, -2.5]]) this.palm(P, P, x, z, 1);
    // umbrellas and towels on the sand
    for (let i = 0; i < 16; i++) {
      const x = R(-2.5, 2.5), z = R(-0.4, 0.55), c = pick([0xe6394a, 0xf2c230, 0x2a9d8f, 0xf28c28, 0x9b5de5, 0xffffff]);
      P.push(tint(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4).translate(x, 0.1, z), 0xeeeeee), tint(new THREE.ConeGeometry(0.12, 0.06, 8).translate(x, 0.21, z), c), block(0.08, 0.004, 0.15, x + 0.12, 0.003, z + 0.05, pick([0xf4b8b8, 0xbfe3d6, 0xf7e3a8])));
    }
    // lifeguard tower
    P.push(block(0.02, 0.2, 0.02, -0.5, 0.1, 0.4, 0xf2f2ee), block(0.02, 0.2, 0.02, -0.38, 0.1, 0.4, 0xf2f2ee), block(0.18, 0.1, 0.14, -0.44, 0.25, 0.4, 0xd8262a));
    for (let x = -2.6; x < 2.7; x += 0.7) { P.push(block(0.015, 0.26, 0.015, x, 0.13, -0.72, 0x2f3338)); L.push(block(0.045, 0.02, 0.045, x, 0.27, -0.72, 0xffe4b0)); }
    this.add(P); this.add(L, this.glow);
    // foam where the waves reach the sand, and boats riding the swell
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(S, 0.12, 40, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    foam.position.set(0, -0.005, 0.8); this.inner.add(foam);
    this.update.push((t) => { foam.position.z = 0.8 + Math.sin(t * 0.9) * 0.06; foam.material.opacity = 0.35 + Math.sin(t * 0.9 + 1) * 0.2; });
    for (const [x, z, c] of [[-1.6, 1.9, 0xf2f2ee], [0.9, 2.3, 0xe6394a], [2.1, 1.4, 0x2a6fb5]]) {
      const b = new THREE.Mesh(mergeGeometries([block(0.14, 0.06, 0.34, 0, 0.02, 0, c), block(0.1, 0.07, 0.12, 0, 0.08, -0.03, 0xf2f2ee)]), this.plain);
      b.position.set(x, -0.03, z); b.rotation.y = R(0, 6); this.inner.add(b);
      const ph = R(0, 6); this.update.push((t) => { b.position.y = -0.03 + Math.sin(t * 1.4 + ph) * 0.02; b.rotation.z = Math.sin(t * 1.1 + ph) * 0.08; b.position.x = x + Math.sin(t * 0.15 + ph) * 0.3; });
    }
    this.cars([{ a: [-H, -0.95], b: [H, -0.95], len: S }, { a: [H, -0.79], b: [-H, -0.79], len: S }], 6, [0xf2f2f0, 0xf2c230, 0x9e1b1b, 0x2a9d8f, 0x1e3f73]);
    this.people([[-2.6, -0.5, 2.6, 0.7], [-2.6, -0.67, 2.6, -0.6]], 44, [0xf0f0f0, 0x6fb3c9, 0xe0b640, 0xc94f7c, 0xf28c8c, 0x9ad0a0, 0xd8262a]);
  }

  // ---------- CHICAGO: brick walk-ups, the Summer Smash stage and crowd, the streetball court ----------
  suburbs() {
    this.slab((x) => {
      x.fillStyle = '#4b4c4a'; x.fillRect(-H, -H, S, S);
      x.fillStyle = '#2a2b2c'; x.fillRect(-0.3, -H, 0.46, S); x.fillRect(-H, 0.5, S, 0.46);
      x.fillStyle = '#8e8a82'; for (const [a, b, c, d] of [[-H, -H, -0.3, 0.5], [0.16, -H, H, 0.5], [-H, 0.96, -0.3, H], [0.16, 0.96, H, H]]) { x.fillRect(a, b, c - a, 0.07); x.fillRect(a, d - 0.07, c - a, 0.07); x.fillRect(a, b, 0.07, d - b); x.fillRect(c - 0.07, b, 0.07, d - b); }
      x.fillStyle = '#56693a'; x.fillRect(0.3, -2.62, 2.2, 3.0);                               // festival field
      x.fillStyle = '#3b3b3a'; x.fillRect(0.3, -2.62, 2.2, 0.75);
      // streetball court, painted blue/red
      x.fillStyle = '#c56a2c'; x.fillRect(0.35, 1.1, 2.1, 1.35);
      x.strokeStyle = '#f2f2ee'; x.lineWidth = 0.02; x.strokeRect(0.42, 1.17, 1.96, 1.21); x.beginPath(); x.moveTo(1.4, 1.17); x.lineTo(1.4, 2.38); x.stroke();
      x.fillStyle = '#1d3f8f'; x.fillRect(0.42, 1.55, 0.35, 0.45); x.fillStyle = '#c8102e'; x.fillRect(2.03, 1.55, 0.35, 0.45);
      x.beginPath(); x.arc(1.4, 1.775, 0.18, 0, 7); x.stroke();
    });
    const B = [], P = [], L = [];
    const brick = [0x8a3b2a, 0x9c4a33, 0x7a3a2c, 0xa3593c, 0x6e4a3a, 0xb58a6a];
    for (let z = -2.4; z < 0.3; z += 0.52) for (const x of [-2.35, -1.7, -1.05]) B.push(building(0.5, R(0.45, 0.85), 0.42, x + R(-0.03, 0.03), z, pick(brick), 0.16));
    for (let z = 1.2; z < 2.6; z += 0.5) for (const x of [-2.35, -1.7, -1.05]) B.push(building(0.5, R(0.4, 0.75), 0.4, x, z, pick(brick), 0.16));
    this.add(B, this.mat);
    // the stage: roof, truss, the blue Summer Smash banner and screens
    P.push(block(1.5, 0.04, 0.55, 1.4, 0.72, -2.3, 0x1c1d20), block(0.04, 0.7, 0.04, 0.68, 0.35, -2.05, 0x2b2e33), block(0.04, 0.7, 0.04, 2.12, 0.35, -2.05, 0x2b2e33), block(1.5, 0.14, 0.55, 1.4, 0.07, -2.3, 0x2b2e33));
    L.push(block(1.3, 0.14, 0.02, 1.4, 0.62, -2.02, 0x1b43c0), block(0.3, 0.22, 0.02, 0.5, 0.4, -2.0, 0x6fd0ff), block(0.3, 0.22, 0.02, 2.3, 0.4, -2.0, 0x6fd0ff));
    // court lights and street lamps
    for (const [x, z] of [[0.4, 1.12], [2.4, 1.12], [0.4, 2.42], [2.4, 2.42]]) { P.push(block(0.02, 0.4, 0.02, x, 0.2, z, 0x2f3338)); L.push(block(0.08, 0.03, 0.05, x, 0.41, z, 0xfff4d8)); }
    for (const [x, z] of [[-0.36, -2], [-0.36, -0.8], [0.22, -0.4], [-0.36, 1.6], [1, 0.44], [2, 1.02], [-1.5, 0.44]]) { P.push(block(0.015, 0.26, 0.015, x, 0.13, z, 0x2f3338)); L.push(block(0.045, 0.02, 0.045, x, 0.27, z, 0xffd49a)); }
    for (const x of [0.6, 1.2, 1.9]) L.push(block(0.02, 0.35, 0.02, x, 0.18, 1.78, 0xf2f2ee).translate(0, 0, 0));
    this.add(P); this.add(L, this.glow);
    // the crowd, jumping on the beat
    const n = 260, fans = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.09, 5).translate(0, 0.045, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const pos = [];
    for (let i = 0; i < n; i++) { const d = Math.random(); pos.push([R(0.45, 2.35), 0.2 + Math.pow(d, 0.7) * -1.9 + 0.25, R(0, 6), Math.random() < 0.6]); fans.setColorAt(i, new THREE.Color(pick([0xe8e4dc, 0x2b2d33, 0xb33a3a, 0x3565a8, 0xe0b640, 0xc94f7c, 0x1c1d20]))); }
    this.inner.add(fans);
    // light beams sweeping from the stage
    const beams = [];
    for (let k = 0; k < 5; k++) {
      const c = [0x3aa0ff, 0xff4fd8, 0xffd23a, 0x7a5cff, 0x2fe0c0][k];
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 12, 1, true).translate(0, -1.2, 0).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      b.position.set(0.8 + k * 0.3, 0.7, -2.1); this.inner.add(b); beams.push(b);
    }
    this.update.push((t) => {
      const beat = t * 151.5 / 60;
      pos.forEach(([x, z, ph, jumper], i) => { const h = jumper ? Math.abs(Math.sin(beat * Math.PI + ph * 0.1)) * 0.05 : 0; _m.makeTranslation(x, h, z); fans.setMatrixAt(i, _m); });
      fans.instanceMatrix.needsUpdate = true;
      beams.forEach((b, k) => { b.rotation.x = -0.5 + Math.sin(t * 0.8 + k) * 0.3; b.rotation.z = Math.sin(t * 1.1 + k * 1.7) * 0.5; b.material.opacity = 0.1 + 0.08 * (1 - (beat % 1)); });
    });
    this.cars([{ a: [-0.2, -H], b: [-0.2, H], len: S }, { a: [0.06, H], b: [0.06, -H], len: S }, { a: [-H, 0.62], b: [H, 0.62], len: S }], 6, [0xf2f2f0, 0x1c1d20, 0x5a1f2b, 0x3a3f46, 0x9e1b1b]);
    this.people([[-2.6, 0.45, -0.35, 0.5], [0.2, 0.96, 2.6, 1.0], [-0.35, -2.6, -0.3, 2.6], [0.4, 1.2, 2.3, 2.3]], 34, [0xe8e4dc, 0x2b2d33, 0xcc1f2a, 0x1f55d6, 0xe0b640]);
  }

  tick(t, dt) {
    for (const u of this.update) u(t, dt);
    // lights follow focus: the chosen world is lit like a display piece, the rest fall back into the dark
    const f = this.focus;
    this.spot.intensity = 10 + f * 55; this.rim.intensity = 4 + f * 12;
    this.mat.emissiveIntensity = 0.35 + f * 1.1;
    this.glow.color.setScalar(0.35 + f * 0.9);
  }
}

// ---------- the stage ----------
// the title: one span per letter; each letter's nearness to the cursor (--p) drives its lift and glow
// ---------- the little Earth that stands in for the O of WORLD ----------
// Coarse coastlines (lon, lat) rasterised once into a land mask; each frame is an orthographic render of the mask
// with a drifting cloud layer, day/night shading, ocean glint and an atmosphere rim. It spins on its own; hover turns
// it toward the cursor, dragging spins it, a click flings it.
const LAND = [
  [[-168, 66], [-162, 70], [-140, 70], [-120, 71], [-95, 72], [-80, 73], [-62, 66], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 26], [-82, 29], [-90, 30], [-97, 27], [-97, 21], [-92, 18], [-87, 21], [-84, 15], [-83, 10], [-78, 8], [-80, 7], [-86, 11], [-92, 14], [-105, 20], [-110, 24], [-112, 30], [-117, 32], [-124, 40], [-124, 48], [-130, 55], [-140, 60], [-152, 59], [-165, 55], [-160, 60], [-166, 62]],
  [[-55, 60], [-44, 60], [-20, 70], [-18, 80], [-35, 83], [-60, 82], [-72, 77], [-58, 70]],
  [[-78, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-39, -15], [-48, -26], [-58, -35], [-65, -42], [-68, -52], [-72, -54], [-75, -45], [-72, -30], [-71, -18], [-76, -14], [-81, -5], [-80, 0]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 57], [5, 58], [8, 63], [15, 68], [25, 71], [40, 68], [60, 70], [70, 73], [80, 72], [100, 77], [112, 74], [130, 72], [150, 71], [170, 70], [180, 66], [178, 64], [163, 60], [155, 58], [142, 52], [140, 46], [132, 43], [128, 38], [126, 35], [121, 40], [122, 31], [120, 23], [110, 20], [106, 11], [103, 1], [100, 6], [98, 16], [94, 17], [90, 22], [80, 15], [77, 8], [73, 20], [66, 25], [57, 26], [56, 24], [59, 22], [52, 17], [44, 12], [42, 16], [35, 28], [33, 31], [36, 36], [27, 37], [26, 40], [23, 36], [20, 40], [13, 45], [16, 41], [12, 38], [8, 44], [3, 43], [0, 39], [-6, 36]],
  [[-17, 21], [-16, 12], [-8, 4], [5, 5], [9, 4], [9, -1], [13, -10], [12, -17], [15, -27], [18, -34], [26, -34], [33, -26], [35, -18], [40, -10], [39, -4], [43, 0], [51, 11], [43, 12], [37, 19], [33, 28], [32, 31], [20, 32], [10, 37], [0, 36], [-6, 35], [-10, 30], [-14, 26]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -27], [150, -37], [141, -38], [135, -35], [129, -32], [115, -34]],
  [[-180, -70], [180, -70], [180, -90], [-180, -90]],
  [[-5, 50], [1, 51], [0, 54], [-3, 58], [-6, 57], [-5, 54]], [[-24, 64], [-14, 64], [-15, 66], [-22, 66]],
  [[130, 31], [135, 34], [141, 36], [142, 43], [140, 41], [136, 36], [131, 34]],
  [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]], [[95, 5], [106, -6], [102, -4]], [[131, -1], [141, -3], [150, -10], [141, -9]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]], [[172, -34], [178, -38], [174, -42], [167, -46], [172, -41]],
];
const MW = 180, MH = 90;
let titleHover = false;
let EARTH = null;
function earthMaps() {
  if (EARTH) return EARTH;
  const inside = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const raw = new Float32Array(MW * MH), land = new Float32Array(MW * MH), cloud = new Float32Array(MW * MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) { const lon = -180 + (i + 0.5) * 2, lat = 90 - (j + 0.5) * 2; raw[j * MW + i] = LAND.some((p) => inside(lon, lat, p)) ? 1 : 0; }
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {   // soften the coast a little
    let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += raw[Math.min(MH - 1, Math.max(0, j + dj)) * MW + (i + di + MW) % MW];
    land[j * MW + i] = s / 9;
  }
  // clouds: a few octaves of smoothed random lattice noise that wraps around in longitude, banded by latitude
  const oct = (n) => { const g = new Float32Array(n * (n >> 1 || 1)); for (let k = 0; k < g.length; k++) g[k] = Math.random(); return g; };
  const layers = [8, 16, 32].map((n) => ({ n, m: n >> 1, g: oct(n) }));
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    let v = 0, a = 0.55;
    for (const { n, m, g } of layers) {
      const x = i / MW * n, y = j / MH * m, x0 = Math.floor(x), y0 = Math.min(m - 1, Math.floor(y)), fx = x - x0, fy = y - y0;
      const s = (xx, yy) => g[Math.min(m - 1, yy) * n + (xx % n)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      v += a * ((s(x0, y0) * (1 - sx) + s(x0 + 1, y0) * sx) * (1 - sy) + (s(x0, y0 + 1) * (1 - sx) + s(x0 + 1, y0 + 1) * sx) * sy); a *= 0.5;
    }
    const lat = Math.abs(90 - (j + 0.5) * 2), band = 0.75 + 0.25 * Math.cos(lat / 90 * Math.PI * 3);
    cloud[j * MW + i] = Math.max(0, Math.min(1, (v * band - 0.5) * 3.2));
  }
  return (EARTH = { land, cloud });
}
function miniEarth(host) {
  const cv = document.createElement('canvas'); host.appendChild(cv);
  const cx = cv.getContext('2d');
  const st = { rot: -1.9, vel: 0.22, tilt: 0.36, tiltT: 0.36, hover: 0, hoverT: 0, drag: null, mx: 0, my: 0, clouds: 0 };
  let img = null, S = 0;
  const size = () => {
    const s = Math.max(24, Math.min(160, Math.round(host.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))));
    if (s !== S) { S = cv.width = cv.height = s; img = cx.createImageData(S, S); }
  };
  const L = (() => { const v = [-0.55, 0.45, 0.7], n = Math.hypot(...v); return v.map((a) => a / n); })();
  function draw() {
    const { land, cloud } = earthMaps(), d = img.data, ct = Math.cos(st.tilt), sn = Math.sin(st.tilt), R = S / 2, h = st.hover;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const o = (py * S + px) * 4, nx = (px + 0.5 - R) / R, ny = (R - py - 0.5) / R, r2 = nx * nx + ny * ny;
      if (r2 > 1) { d[o + 3] = 0; continue; }
      const nz = Math.sqrt(1 - r2);
      // view-space normal -> globe space: tilt the axis toward the viewer, then spin
      const y = ny * ct + nz * sn, z = nz * ct - ny * sn;
      const lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(nx, z) + st.rot;
      let u = (lon / (Math.PI * 2) + 0.5) % 1; if (u < 0) u += 1;
      const i = Math.min(MW - 1, Math.floor(u * MW)), j = Math.min(MH - 1, Math.floor((0.5 - lat / Math.PI) * MH));
      const ld = land[j * MW + i], alat = Math.abs(lat) * 57.3;
      let uc = u + st.clouds; uc -= Math.floor(uc);
      const cl = cloud[j * MW + Math.min(MW - 1, Math.floor(uc * MW))];
      // surface colour: ocean, then land (green, drier toward the subtropics, ice at the poles)
      const dry = Math.max(0, 1 - Math.abs(alat - 24) / 12), ice = Math.min(1, Math.max(0, (alat - 62) / 8));
      let r = 18 + 20 * h, g = 62 + 24 * h, b = 128 + 30 * h;
      const lr = 70 + 110 * dry, lg = 118 + 40 * dry - 20 * (alat / 90), lb = 58 + 40 * dry;
      r += (lr - r) * ld; g += (lg - g) * ld; b += (lb - b) * ld;
      r += (238 - r) * ice; g += (244 - g) * ice; b += (250 - b) * ice;
      r += (245 - r) * cl * 0.85; g += (247 - g) * cl * 0.85; b += (250 - b) * cl * 0.85;
      // light: day side lit from the upper left, a soft terminator, glint on open water, blue rim
      const dl = nx * L[0] + ny * L[1] + nz * L[2], lit = 0.16 + 0.95 * Math.max(0, Math.min(1, dl * 1.4 + 0.25));
      const hx = L[0], hy = L[1], hz = L[2] + 1, hn = Math.hypot(hx, hy, hz), spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hn), 40) * (1 - ld) * (1 - cl) * 120;
      const rim = Math.pow(1 - nz, 2.4) * (0.75 + 0.5 * h);
      r = r * lit + spec + (120 - r * lit) * rim; g = g * lit + spec + (190 - g * lit) * rim; b = b * lit + spec + (255 - b * lit) * rim;
      d[o] = r; d[o + 1] = g; d[o + 2] = b;
      d[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * R * 1.2);   // anti-aliased edge
    }
    cx.putImageData(img, 0, 0);
  }
  let last = performance.now();
  (function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    requestAnimationFrame(frame);
    if (!host.isConnected || host.offsetParent === null) return;   // the menu is gone or hidden: nothing to draw
    size();
    st.hover += (st.hoverT - st.hover) * Math.min(1, dt * 6);
    if (!st.drag) {
      // at rest a slow spin; under the cursor the globe turns to face it (the further off-centre, the faster)
      const want = st.hoverT ? 0.22 + st.mx * 2.4 : 0.22;
      st.vel += (want - st.vel) * Math.min(1, dt * (Math.abs(st.vel - want) > 2 ? 0.9 : st.hoverT ? 3 : 0.8));   // flings coast down
      st.rot += st.vel * dt;
      st.tiltT = st.hoverT ? 0.36 - st.my * 0.55 : 0.36;
    }
    st.tilt += (st.tiltT - st.tilt) * Math.min(1, dt * 4);
    st.clouds += dt * 0.004;
    draw();
  })(last);
  const local = (e) => { const r = host.getBoundingClientRect(); return [((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2]; };
  host.addEventListener('pointerenter', () => { st.hoverT = 1; });
  host.addEventListener('pointerleave', () => { if (!st.drag) st.hoverT = 0; });
  host.addEventListener('pointermove', (e) => {
    [st.mx, st.my] = local(e);
    if (st.drag) {
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y, w = host.getBoundingClientRect().width;
      st.rot -= dx / w * 2.6; st.tiltT = st.tilt = Math.max(-1.1, Math.min(1.1, st.tilt + dy / w * 2));
      st.vel = -dx / w * 2.6 / Math.max(0.008, (e.timeStamp - st.drag.t) / 1000);
      st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: st.drag.moved + Math.abs(dx) + Math.abs(dy) };
    }
  });
  host.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); host.setPointerCapture(e.pointerId); host.classList.add('drag'); st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: 0 }; });
  const up = (e) => {
    if (!st.drag) return;
    if (st.drag.moved < 3) st.vel += (st.mx < 0 ? -1 : 1) * 7;   // a click flings it
    st.vel = Math.max(-14, Math.min(14, st.vel));
    st.drag = null; host.classList.remove('drag');
    const r = host.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) st.hoverT = 0;
  };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('click', (e) => e.stopPropagation());
}

// ---------- stars behind the neutral room ----------
// Mostly faint pinpricks with a few brighter ones (soft halo, faint cool or warm tint), thicker along a faint diagonal
// band like the Milky Way; a handful twinkle slowly. Every few seconds a shooting star streaks across. Drawn at
// ~20 fps (full rate while a meteor is in flight) and only while the menu is up.
function starfield(menu, after) {
  const cv = document.createElement('canvas'); cv.className = 'stars'; after.after(cv);
  const cx = cv.getContext('2d');
  let stars = [], W = 0, H = 0, dpr = 1;
  const build = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
    const n = Math.round(Math.min(520, innerWidth * innerHeight / 3200)); stars = [];
    for (let i = 0; i < n; i++) {
      let x = Math.random(), y = Math.random();
      if (i % 3 === 0) {   // a third of them gather along the band (lower left to upper right), with a soft falloff
        const t = Math.random(), off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
        x = t; y = 0.95 - t * 0.8 + off;
        if (y < 0 || y > 1) continue;
      }
      const big = Math.random() < 0.06, tint = Math.random();
      stars.push({ x: x * W, y: y * H, r: (big ? 1.1 + Math.random() * 0.7 : 0.45 + Math.random() * 0.6) * dpr, a: big ? 0.55 + Math.random() * 0.3 : 0.22 + Math.random() * 0.45,
        c: tint < 0.18 ? '200,220,255' : tint > 0.9 ? '255,236,210' : '255,255,255', big,
        tw: Math.random() < 0.22 ? 0.6 + Math.random() * 1.6 : 0, ph: Math.random() * 6.3 });
    }
  };
  build(); addEventListener('resize', build);
  const band = () => {   // the faint haze of the band itself
    cx.save(); cx.globalAlpha = 0.05; cx.translate(W / 2, H * 0.55); cx.rotate(-Math.atan2(H * 0.8, W)); cx.scale(1, 0.16);
    const rg = cx.createRadialGradient(0, 0, 0, 0, 0, W * 0.7); rg.addColorStop(0, 'rgba(190,205,255,1)'); rg.addColorStop(1, 'rgba(190,205,255,0)');
    cx.fillStyle = rg; cx.beginPath(); cx.arc(0, 0, W * 0.7, 0, 6.3); cx.fill(); cx.restore();
  };
  // shooting stars: a bright head with a tapering tail, mostly falling left-to-right and down (sometimes the other way)
  const meteors = [];
  let nextMeteor = 2500 + Math.random() * 3000;
  const launch = (t) => {
    const dir = Math.random() < 0.75 ? 1 : -1, ang = (0.35 + Math.random() * 0.35) * (dir > 0 ? 1 : -1);
    const v = (0.55 + Math.random() * 0.5) * Math.hypot(W, H);            // px / s
    meteors.push({ x: (dir > 0 ? 0.05 + Math.random() * 0.6 : 0.35 + Math.random() * 0.6) * W, y: Math.random() * 0.45 * H,
      vx: Math.cos(ang) * v * dir, vy: Math.abs(Math.sin(ang)) * v, t0: t, life: 0.55 + Math.random() * 0.6, len: (0.07 + Math.random() * 0.07) * W, w: (0.9 + Math.random() * 0.8) * dpr });
  };
  let last = 0;
  (function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < (meteors.length ? 0 : 50) || !cv.isConnected || getComputedStyle(menu).display === 'none') return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    nextMeteor -= dt * 1000;
    if (nextMeteor <= 0) { launch(t); if (Math.random() < 0.15) setTimeout(() => launch(performance.now()), 250 + Math.random() * 500); nextMeteor = 4000 + Math.random() * 7000; }
    cx.clearRect(0, 0, W, H); band();
    const s = t / 1000;
    for (const p of stars) {
      const a = p.tw ? p.a * (0.55 + 0.45 * Math.sin(s * p.tw + p.ph)) : p.a;
      if (p.big) {
        const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, `rgba(${p.c},${a * 0.35})`); g.addColorStop(1, `rgba(${p.c},0)`);
        cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r * 5, 0, 6.3); cx.fill();
      }
      cx.fillStyle = `rgba(${p.c},${a})`; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.3); cx.fill();
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i], age = (t - m.t0) / 1000, k = age / m.life;
      if (k >= 1) { meteors.splice(i, 1); continue; }
      const hx = m.x + m.vx * age, hy = m.y + m.vy * age, sp = Math.hypot(m.vx, m.vy);
      const tl = m.len * Math.min(1, k * 4), tx = hx - m.vx / sp * tl, ty = hy - m.vy / sp * tl;
      const fade = Math.sin(Math.PI * Math.min(1, k * 1.15));             // swells in, burns out
      const g = cx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(200,220,255,0)'); g.addColorStop(0.7, `rgba(225,235,255,${0.35 * fade})`); g.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`);
      cx.strokeStyle = g; cx.lineWidth = m.w; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(hx, hy); cx.stroke();
      const hg = cx.createRadialGradient(hx, hy, 0, hx, hy, m.w * 4);
      hg.addColorStop(0, `rgba(255,255,255,${0.8 * fade})`); hg.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = hg; cx.beginPath(); cx.arc(hx, hy, m.w * 4, 0, 6.3); cx.fill();
    }
  })(0);
}

// ?font=1..11 tries another face for the title; Outfit (a geometric O for the globe to stand in for) is the default
const TITLE_FONTS = [['Outfit', 300], ['Playfair Display', 500], ['Cinzel', 500], ['Italiana', 400], ['Bodoni Moda', 500], ['Fraunces', 300], ['Syne', 700], ['Unbounded', 400], ['Cormorant Garamond', 500], ['Tenor Sans', 400], ['DM Serif Display', 400]];
function titleGlow(h1) {
  if (!h1) return;
  const pick = TITLE_FONTS[+new URLSearchParams(location.search).get('font') - 1];
  if (pick) {
    const [fam, w] = pick, l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}:wght@${w}&display=swap`; document.head.appendChild(l);
    h1.style.setProperty('--titleFont', `'${fam}'`); h1.style.setProperty('--titleWeight', w);
  }
  const word = document.createElement('span'); word.className = 'tw';
  const text = h1.textContent, oAt = text.lastIndexOf('O');
  h1.setAttribute('aria-label', 'Tiny World');
  const chars = [...text].map((c, i) => {
    const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
    if (i === oAt) { s.classList.add('globe'); miniEarth(s); } else s.textContent = c;
    word.appendChild(s); return s;
  });
  h1.textContent = ''; h1.appendChild(word);
  word.addEventListener('pointermove', (e) => {
    const fs = parseFloat(getComputedStyle(h1).fontSize);
    for (const s of chars) {
      const r = s.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)) / (fs * 1.6);
      s.style.setProperty('--p', Math.max(0, 1 - d * d).toFixed(3));
    }
  });
  word.addEventListener('pointerleave', () => { for (const s of chars) s.style.setProperty('--p', 0); });
  // the title sits over the stage: while the cursor is on it, the dioramas underneath don't light up
  word.addEventListener('pointerenter', () => { titleHover = true; });
  word.addEventListener('pointerleave', () => { titleHover = false; });
}

export function initMenu() {
  const menu = document.getElementById('menu');
  if (!menu) return;
  const buttons = MAPS.map((m) => menu.querySelector(`button[data-map="${m}"]`));
  const qp = new URLSearchParams(location.search).get('map');
  if (qp) { buttons.forEach((b) => b && (b.dataset.go = '1')); return; }   // quick-test links skip the show

  titleGlow(menu.querySelector('h1'));
  const canvas = document.createElement('canvas'); canvas.id = 'menuStage'; menu.prepend(canvas);
  // atmosphere layers behind the stage (crossfaded in CSS by data-hover) and a faint grain over it
  for (const k of ['suburbs', 'tropical', 'downtown', 'neutral']) { const a = document.createElement('div'); a.className = 'atmo ' + k; menu.prepend(a); }
  starfield(menu, menu.querySelector('.atmo.neutral'));
  const grain = document.createElement('div'); grain.className = 'grain'; menu.appendChild(grain);
  { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), im = x.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); grain.style.backgroundImage = `url(${c.toDataURL()})`; }
  let shownHover = null;
  const fade = document.createElement('div'); fade.id = 'menuFade'; menu.appendChild(fade);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x1a1410, 0.55));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.1); key.position.set(-8, 16, 10); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 }); key.shadow.bias = -0.0008;
  scene.add(key);
  // soft shadows on an unseen floor far below, and dust drifting in the light
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.4 }));
  floor.position.y = -3.4; floor.receiveShadow = true; scene.add(floor);
  const dustN = 220, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = R(-18, 18); dustPos[i * 3 + 1] = R(-3, 8); dustPos[i * 3 + 2] = R(-8, 8); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe6c4, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  const tex = facadeTextures();
  const worlds = MAPS.map((m) => { const d = new Diorama(m, tex); scene.add(d.g); return d; });
  const hits = worlds.map((d) => d.hit);

  // layout: an arc across wide screens, a column on tall ones
  let portrait = false, baseCam = new THREE.Vector3(), look = new THREE.Vector3(0, 0.3, 0);
  function layout() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false); camera.aspect = aspect;
    portrait = aspect < 0.95;
    worlds.forEach((d, i) => {
      const k = i - 1;
      d.home = portrait ? new THREE.Vector3(0, -k * 4.6, k * 0.8) : new THREE.Vector3(k * 7.4, 0, -Math.abs(k) * 1.4);
      d.yaw0 = portrait ? 0 : -k * 0.32;
    });
    const dist = portrait ? Math.max(24, 16.5 / (2 * Math.tan(THREE.MathUtils.degToRad(14)))) : Math.max(24, 21.5 / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * aspect));
    baseCam.set(0, dist * 0.4, dist * 0.92);
    look.set(0, portrait ? 0 : 0.3, 0);
    camera.fov = 28; camera.updateProjectionMatrix();
  }
  layout(); addEventListener('resize', layout);
  worlds.forEach((d) => { d.g.position.copy(d.home); d.g.rotation.y = d.yaw0; });

  // pointer: parallax for everything, hover by ray (or by the caption buttons)
  const ptr = new THREE.Vector2(0, 0), ptrS = new THREE.Vector2(0, 0), ray = new THREE.Raycaster();
  let hovered = -1, labelHover = -1, going = null;
  const hasHover = matchMedia('(hover: hover)').matches;
  canvas.addEventListener('pointermove', (e) => { ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
  menu.addEventListener('pointermove', (e) => { ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); });
  function pickAt() { if (titleHover) return -1; ray.setFromCamera(ptr, camera); const h = ray.intersectObjects(hits, false)[0]; return h ? hits.indexOf(h.object) : -1; }
  buttons.forEach((b, i) => {
    b.addEventListener('pointerenter', () => { labelHover = i; });
    b.addEventListener('pointerleave', () => { if (labelHover === i) labelHover = -1; });
    b.addEventListener('focus', () => { labelHover = i; });
    b.addEventListener('blur', () => { if (labelHover === i) labelHover = -1; });
    // intercept the real click: play the dive into the world first, then let main.js load it
    b.addEventListener('click', (e) => {
      if (b.dataset.go) return;
      e.stopImmediatePropagation(); e.preventDefault();
      dive(i);
    }, true);
  });
  canvas.addEventListener('click', (e) => {
    ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const i = pickAt();
    if (i < 0 || going) return;
    // on touch, the first tap picks a world, the second dives in
    if (!hasHover && hovered !== i) { hovered = labelHover = i; return; }
    dive(i);
  });

  function dive(i) {
    if (going) return;
    const dur = reduced ? 500 : 1250;
    going = { i, t: 0, from: camera.position.clone(), look0: look.clone(), fov0: camera.fov, start: performance.now(), dur };
    // hand over on time even if frames are few (a busy or backgrounded tab)
    setTimeout(() => finish(), dur + 120);
    hovered = i;
    menu.classList.add('diving');
    buttons.forEach((b, k) => b.classList.toggle('chosen', k === i));
  }

  function finish() {
    if (!going || going.done) return;
    going.done = true;
    const b = buttons[going.i]; b.dataset.go = '1'; b.click();                // hand over to main.js: load the map
  }
  // captions follow their worlds on screen
  function placeLabels() {
    worlds.forEach((d, i) => {
      _v.set(0, -1.25, H + 0.2).applyMatrix4(d.g.matrixWorld).project(camera);
      const b = buttons[i]; if (!b) return;
      b.style.left = `${(_v.x * 0.5 + 0.5) * innerWidth}px`; b.style.top = `${(-_v.y * 0.5 + 0.5) * innerHeight}px`;
      b.classList.toggle('active', hovered === i); b.classList.toggle('dimmed', hovered >= 0 && hovered !== i);
    });
  }

  let last = performance.now(), t = 0, running = true;
  function frame(now) {
    if (!running) return;
    // the game has started: stop and let the GPU go
    if (menu.style.display === 'none') { stop(); return; }
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const k = 1 - Math.exp(-dt * 5);
    ptrS.lerp(ptr, reduced ? 1 : k * 0.6);
    if (!going) { const h = labelHover >= 0 ? labelHover : pickAt(); hovered = h; canvas.style.cursor = h >= 0 ? 'pointer' : 'default'; }
    // the room takes on the hovered city's atmosphere (a slow crossfade in CSS)
    const mood = hovered >= 0 ? MAPS[hovered] : '';
    if (mood !== shownHover) { shownHover = mood; if (mood) menu.dataset.hover = mood; else delete menu.dataset.hover; }
    worlds.forEach((d, i) => {
      const on = hovered === i, any = hovered >= 0;
      d.hover += ((on ? 1 : 0) - d.hover) * k;
      d.focus += ((on ? 1 : any ? 0.28 : 0.62) - d.focus) * k;
      // lift out of the case toward the camera, grow a little; the others settle back
      const toCam = _v.copy(camera.position).sub(d.home).normalize();
      const lift = d.hover, back = any && !on ? 1 : 0;
      d.g.position.copy(d.home).addScaledVector(toCam, lift * 3.2 - back * 0.8);
      if (!portrait) d.g.position.x -= d.home.x * lift * 0.18;                // side worlds drift in a little so they stay in frame
      d.g.position.y += lift * 0.5 + (reduced ? 0 : Math.sin(t * 0.7 + i * 2) * 0.08);
      const sc = 1 + lift * 0.12 - back * 0.05; d.g.scale.setScalar(sc);
      // idle: a slow turn to show the world; hovered: face the viewer and tilt after the cursor
      _v.copy(d.home).project(camera);
      const lx = THREE.MathUtils.clamp(ptrS.x - _v.x, -0.6, 0.6), ly = THREE.MathUtils.clamp(ptrS.y - _v.y, -0.6, 0.6);
      const idleYaw = d.yaw0 + (reduced ? 0 : Math.sin(t * 0.22 + i * 1.7) * 0.22);
      d.g.rotation.y += ((on ? d.yaw0 * 0.3 + lx * 0.45 : idleYaw) - d.g.rotation.y) * k;
      d.g.rotation.x += ((on ? -ly * 0.22 + 0.05 : 0) - d.g.rotation.x) * k;
      d.tick(t, dt);
    });
    // the whole case drifts with the cursor
    if (going) {
      going.t = Math.min(1, (now - going.start) / going.dur);
      const e = ease(going.t), d = worlds[going.i], c = _v.copy(d.g.position);
      const target = c.clone().add(new THREE.Vector3(0, 1.6, 2.0));
      camera.position.lerpVectors(going.from, target, e);
      look.lerpVectors(going.look0, c.clone().add(new THREE.Vector3(0, 0.2, 0)), Math.min(1, e * 1.3));
      camera.fov = going.fov0 + (46 - going.fov0) * e; camera.updateProjectionMatrix();
      fade.style.opacity = Math.max(0, (going.t - 0.55) / 0.45);
      if (going.t >= 1) finish();
    } else {
      camera.position.set(baseCam.x + ptrS.x * 1.6, baseCam.y + ptrS.y * 0.8, baseCam.z);
    }
    camera.lookAt(look);
    const dp = dustGeo.attributes.position.array;
    if (!reduced) for (let i = 0; i < dustN; i++) { dp[i * 3 + 1] += dt * 0.12; dp[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.05; if (dp[i * 3 + 1] > 8) dp[i * 3 + 1] = -3; }
    dustGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    placeLabels();
  }
  requestAnimationFrame(frame);

  function stop() {
    running = false;
    removeEventListener('resize', layout);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map && m.map.dispose(); m.emissiveMap && m.emissiveMap.dispose(); m.dispose(); }); });
    renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
    canvas.remove();
  }
}

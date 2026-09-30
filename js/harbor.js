// Waterfront for the Gaslamp map: seawall promenade, piers with docked cruise ships, a marina, harbour
// traffic, and a tall sweeping bridge (white piers, blue girder) with a steady stream of cars.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';
import { carGeos } from './agents.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _t = new THREE.Vector3(), _v = new THREE.Vector3(), _side = new THREE.Vector3(), _fwd = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1);
const CAR_COLORS = [0xf2f2f0, 0x1c1d20, 0x8a9096, 0xb4bac0, 0x9e1b1b, 0x1e3f73, 0x2f5d3a, 0xd9c7a0, 0x3a3f46, 0xcfd6dc];
const TRUCK_COLORS = [0xf2f2f0, 0xc8352b, 0x1e3f73, 0xe6b422, 0x2f5d3a];
const BUS_COLORS = [0xf2f2f0, 0x2a6fb5, 0xe8e2d0];

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = true) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

// paint a solid colour into a geometry's vertex colours so many parts merge into one mesh
function tint(g, c) {
  const n = g.index ? g.toNonIndexed() : g;
  const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return n;
}
const box = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

// cabin balconies: one tile = 16 cabins (0.5 wide) x 8 decks (0.56 tall); random cabins lit at night
const CAB_W = 8, CAB_H = 4.48;
function cabinTextures() {
  const W = 512, H = 512, cols = 16, rows = 8, cw = W / cols, rh = H / rows;
  const [c, x] = canvas(W, H), [e, y] = canvas(W, H);
  x.fillStyle = '#f3f3ef'; x.fillRect(0, 0, W, H);
  y.fillStyle = '#000'; y.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x0 = k * cw, y0 = r * rh;
    x.fillStyle = '#34495e'; x.fillRect(x0 + 3, y0 + 3, cw - 6, rh * 0.74);           // sliding door glass
    x.fillStyle = '#5f7a93'; x.fillRect(x0 + 3, y0 + 3, cw - 6, rh * 0.14);           // sky reflection
    x.fillStyle = 'rgba(190,215,228,.55)'; x.fillRect(x0 + 2, y0 + rh * 0.48, cw - 4, rh * 0.3); // glass balustrade
    x.fillStyle = '#fff'; x.fillRect(x0 + 2, y0 + rh * 0.47, cw - 4, 3);              // hand rail
    x.fillRect(x0, y0, 3, rh);                                                         // divider
    x.fillRect(x0, y0 + rh * 0.8, cw, rh * 0.2);                                       // deck slab
    if (Math.random() < 0.42) { y.fillStyle = `rgba(255,${190 + Math.random() * 40 | 0},120,${0.55 + Math.random() * 0.45})`; y.fillRect(x0 + 3, y0 + 3, cw - 6, rh * 0.44); }
  }
  return { map: tex(c), emissiveMap: tex(e) };
}
function portholeTextures() {
  const [c, x] = canvas(256, 32), [e, y] = canvas(256, 32);
  x.fillStyle = '#f3f3ef'; x.fillRect(0, 0, 256, 32);
  y.fillStyle = '#000'; y.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 16; i++) {
    x.fillStyle = '#2b3a4c'; x.beginPath(); x.arc(8 + i * 16, 14, 4.2, 0, 6.283); x.fill();
    if (Math.random() < 0.5) { y.fillStyle = '#ffd08a'; y.beginPath(); y.arc(8 + i * 16, 14, 4, 0, 6.283); y.fill(); }
  }
  return { map: tex(c), emissiveMap: tex(e) };
}
function glassTextures() {
  const [c, x] = canvas(128, 64), [e, y] = canvas(128, 64);
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#9fc2d8'); g.addColorStop(1, '#4d6f86');
  x.fillStyle = g; x.fillRect(0, 0, 128, 64);
  y.fillStyle = '#6b5a3a'; y.fillRect(0, 0, 128, 64);
  x.fillStyle = '#e8ecee'; y.fillStyle = '#000';
  for (let i = 0; i <= 128; i += 16) { x.fillRect(i - 1, 0, 2, 64); y.fillRect(i - 1, 0, 2, 64); }
  x.fillRect(0, 30, 128, 2); x.fillRect(0, 0, 128, 3); y.fillRect(0, 30, 128, 2);
  return { map: tex(c), emissiveMap: tex(e) };
}
// a flat textured strip on a ship side, uv in world units so the pattern never stretches
function strip(len, h, x, y, z, side, uW, uH) {
  const g = new THREE.PlaneGeometry(len, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len + x) / uW, (uv.getY(i) * h + y) / uH);
  if (side < 0) g.rotateY(Math.PI);
  return g.translate(x, y + h / 2, z);
}

// ---- cruise ship, bow along +x, waterline at y = 0 ----
function shipParts() {
  const plain = [], cabins = [], ports = [], glass = [];
  const outline = (s) => {
    const h = new THREE.Shape();
    h.moveTo(-16 * s, -2.05 * s); h.quadraticCurveTo(-16 * s, -2.3 * s, -15.5 * s, -2.3 * s); h.lineTo(8.5, -2.3 * s);
    h.quadraticCurveTo(15, -2.0 * s, 16.8 * s, 0); h.quadraticCurveTo(15, 2.0 * s, 8.5, 2.3 * s);
    h.lineTo(-15.5 * s, 2.3 * s); h.quadraticCurveTo(-16 * s, 2.3 * s, -16 * s, 2.05 * s); h.closePath();
    return h;
  };
  const hull = (s, y0, y1, c) => tint(new THREE.ExtrudeGeometry(outline(s), { depth: y1 - y0, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2).translate(0, y0, 0), c);
  plain.push(hull(1, -1.2, -0.05, 0x7a2320), hull(1, -0.05, 1.55, 0x1b2640), hull(1.004, 1.55, 1.68, 0x2a6fb5), hull(1, 1.68, 2.6, 0xf3f3ef));
  for (const sd of [-1, 1]) ports.push(strip(22.5, 0.5, -3.5, 1.9, sd * 2.302, sd, 4, 0.5));
  // stepped superstructure: [x0, x1, y0, y1, halfWidth]
  const blocks = [[-14.2, 10.4, 2.6, 5.4, 2.25], [10.4, 11.8, 2.6, 4.0, 1.85], [-15.5, -14.2, 2.6, 4.3, 2.15], [-12.8, 8.4, 5.4, 6.55, 2.05]];
  for (const [x0, x1, y0, y1, hw] of blocks) {
    plain.push(box(x1 - x0, y1 - y0, hw * 2 - 0.04, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0xf3f3ef));
    for (const sd of [-1, 1]) cabins.push(strip(x1 - x0 - 0.5, y1 - y0 - 0.06, (x0 + x1) / 2, y0 + 0.03, sd * (hw - 0.005), sd, CAB_W, CAB_H));
  }
  // navigation bridge with glass band and wings
  plain.push(box(1.8, 1.6, 4.1, 9.3, 6.2, 0, 0xf3f3ef), box(0.9, 0.4, 5.5, 9.45, 6.72, 0, 0xf3f3ef));
  glass.push(box(0.04, 0.26, 5.5, 9.92, 6.74, 0, 0x1b2a38), box(0.04, 0.3, 4.0, 10.22, 6.55, 0, 0x1b2a38));
  plain.push(box(0.06, 1.6, 0.06, 9.2, 7.8, 0, 0xf3f3ef), box(0.06, 0.06, 1.2, 9.2, 8.3, 0, 0xf3f3ef));
  const dome = new THREE.SphereGeometry(0.28, 10, 8).translate(8.8, 7.25, 0); plain.push(tint(dome, 0xf3f3ef));
  // lido deck: teak, two pools, sun-deck rails, a water slide
  plain.push(box(19.2, 0.07, 3.9, -3.1, 6.585, 0, 0xb08a5e), box(3.6, 0.1, 2.0, -4.6, 6.6, 0, 0x39b6d8), box(1.6, 0.1, 1.3, -11.6, 6.6, 0, 0x39b6d8));
  for (const sd of [-1, 1]) plain.push(box(19.2, 0.22, 0.04, -3.1, 6.72, sd * 1.93, 0xeaf2f5));
  const slide = new THREE.CatmullRomCurve3([[-7.4, 8.6, 0.6], [-6.4, 8.3, 1.4], [-5.6, 7.9, 0.5], [-6.3, 7.5, -0.8], [-7.2, 7.1, -0.2], [-6.8, 6.75, 1.0]].map((v) => new THREE.Vector3(...v)));
  plain.push(tint(new THREE.TubeGeometry(slide, 40, 0.1, 6), 0xe8452c), box(0.12, 2.0, 0.12, -7.4, 7.6, 0.6, 0xd9d9d4));
  // funnel: oval, raked back, blue band and navy cap
  const fun = (r, y0, h, c) => tint(new THREE.CylinderGeometry(r, r * 1.08, h, 16, 1).scale(1.7, 1, 1).translate(-9.2, y0 + h / 2, 0), c);
  plain.push(fun(0.62, 6.6, 1.3, 0xf3f3ef), fun(0.6, 7.9, 0.35, 0x2a6fb5), fun(0.58, 8.25, 0.35, 0x1b2640));
  // lifeboats hung in the promenade recess on both sides
  for (let x = -11.8; x < 8; x += 1.75) for (const sd of [-1, 1]) {
    plain.push(box(1.4, 0.3, 0.42, x, 3.18, sd * 2.5, 0xf28c1c), box(1.2, 0.14, 0.36, x, 3.4, sd * 2.5, 0xf3f3ef));
    plain.push(box(0.05, 0.5, 0.35, x - 0.55, 3.35, sd * 2.4, 0x9aa3a8), box(0.05, 0.5, 0.35, x + 0.55, 3.35, sd * 2.4, 0x9aa3a8));
  }
  return { plain: mergeGeometries(plain), cabins: mergeGeometries(cabins), ports: mergeGeometries(ports), glass: mergeGeometries(glass) };
}

// ---- road vehicles for the bridge (car shape shared with the city traffic) ----
function truckGeos() {
  const wheel = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10).rotateZ(Math.PI / 2);
  const body = mergeGeometries([new THREE.BoxGeometry(0.7, 0.5, 0.62).translate(0, 0.42, 1.0), new THREE.BoxGeometry(0.74, 0.8, 2.0).translate(0, 0.58, -0.36)]);
  const dark = mergeGeometries([new THREE.BoxGeometry(0.66, 0.2, 0.05).translate(0, 0.55, 1.31), new THREE.BoxGeometry(0.6, 0.1, 2.5).translate(0, 0.14, 0),
    ...[1.0, -0.6, -1.0].flatMap((z) => [wheel.clone().translate(0.33, 0.13, z), wheel.clone().translate(-0.33, 0.13, z)])]);
  return { body, dark, half: 1.33 };
}
function busGeos() {
  const wheel = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 10).rotateZ(Math.PI / 2);
  const body = new THREE.BoxGeometry(0.74, 0.72, 2.9).translate(0, 0.5, 0);
  const dark = mergeGeometries([new THREE.BoxGeometry(0.76, 0.22, 2.7).translate(0, 0.62, -0.04), new THREE.BoxGeometry(0.66, 0.3, 0.03).translate(0, 0.6, 1.45),
    ...[0.95, -0.95].flatMap((z) => [wheel.clone().translate(0.35, 0.13, z), wheel.clone().translate(-0.35, 0.13, z)])]);
  return { body, dark, half: 1.45 };
}

export class Harbor {
  constructor(scene, city, ground) {
    const X0 = city.shoreX; // seawall line; water lies at x < X0
    this.X0 = X0; this.boats = [];
    const E = ground.E;
    // ---- ground: promenade + seabed tint under the transparent water ----
    ground.rect(-E, -E, X0, E, '#23404f');
    ground.rect(X0, -E, city.xs[0] - city.roadW / 2, E, '#b9b2a4');
    for (let z = -E; z < E; z += 1.2) ground.line(X0, z, city.xs[0] - city.roadW / 2, z, 0.03, 'rgba(0,0,0,.08)');
    ground.line(X0 + 0.1, -E, X0 + 0.1, E, 0.25, '#8d877c');
    ground.tex.needsUpdate = true;
    for (let z = -E + 4; z < E - 2; z += 7) {
      city.addTree(X0 + 2.2, z + rand(-0.5, 0.5), 1, 'palm');
      city.addLamp(X0 + 0.6, z + 3.5, -Math.PI / 2);
    }
    (city.wanderZones ||= []).push({ x0: X0 + 0.6, x1: city.xs[0] - city.roadW / 2 - 0.5, z0: -60, z1: 60 });
    for (let i = 0; i < 8; i++) (city.crowds ||= []).push({ x: X0 + rand(1.5, 3.5), z: rand(-60, 60), r: 0.6, n: Math.round(rand(2, 5)) });

    const white = new THREE.MeshStandardMaterial({ color: 0xeef0f0, roughness: 0.55, side: THREE.DoubleSide });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a6db8, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.9, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6, metalness: 0.4 });

    // ---- piers: glass cruise terminals, bollards, fenders, gangways, waiting buses, docked ships ----
    const parts = shipParts();
    const cab = cabinTextures(), port = portholeTextures(), gl = glassTextures();
    this.shipMats = [
      new THREE.MeshStandardMaterial({ ...cab, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ ...port, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 }),
    ];
    const shipPlain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    const shipGlass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.8 });
    this.termMat = new THREE.MeshStandardMaterial({ ...gl, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.15, metalness: 0.5 });
    const pierParts = [], termParts = [], bits = [];
    const bus = busGeos();
    const busBody = [], busDark = [];
    for (const [pz, len, ship] of [[-38, 34, true], [4, 30, true], [34, 18, false]]) {
      const sd = pz < 0 ? -1 : 1;                                  // which side of the pier the ship lies on
      pierParts.push(box(len, 0.5, 5, X0 - len / 2, 0.25, pz, 0xc9c3b6));
      pierParts.push(box(len - 0.4, 0.012, 0.12, X0 - len / 2, 0.506, pz + sd * 2.3, 0xe6c229)); // safety line
      for (let x = X0 - 2; x > X0 - len; x -= 4) for (const s2 of [-1, 1]) bits.push(box(0.3, 1.6, 0.3, x, -0.8, pz + s2 * 2.2, 0x6f6a60)); // piles
      for (let x = X0 - 1.5; x > X0 - len + 0.5; x -= 2.2) {
        bits.push(tint(new THREE.CylinderGeometry(0.09, 0.11, 0.24, 8).translate(x, 0.62, pz + sd * 2.15), 0x2b2e33));            // bollard
        bits.push(tint(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8).translate(x + 1.1, 0.15, pz + sd * 2.6), 0x151515));        // fender
      }
      // glass terminal with an overhanging white roof
      const tl = len * (ship ? 0.62 : 0.5), tx = X0 - 4.6 - tl / 2, tz = pz - sd * 0.5, tw = 2.6, th = ship ? 2.3 : 1.6;
      const tg = new THREE.BoxGeometry(tl, th, tw);
      const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tl / 4, uv.getY(i) * th / 2.3);
      termParts.push(tg.translate(tx, 0.5 + th / 2, tz));
      pierParts.push(box(tl + 0.8, 0.18, tw + 0.9, tx, 0.5 + th + 0.09, tz, 0xf1f1ed), box(tl - 1, 0.35, 0.5, tx, 0.5 + th + 0.35, tz, 0xd8d8d2));
      for (let x = tx - tl / 2; x <= tx + tl / 2 + 0.01; x += tl / 6) for (const s2 of [-1, 1]) pierParts.push(box(0.12, th, 0.12, x, 0.5 + th / 2, tz + s2 * (tw / 2 + 0.35), 0xf1f1ed));
      if (!ship) continue;
      const sx = X0 - 17.5, sz = pz + sd * 5.6;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(parts.plain, shipPlain), new THREE.Mesh(parts.cabins, this.shipMats[0]), new THREE.Mesh(parts.ports, this.shipMats[1]), new THREE.Mesh(parts.glass, shipGlass));
      g.children.forEach((m) => { m.castShadow = m.receiveShadow = true; });
      g.position.set(sx, 0, sz); g.rotation.y = Math.PI;       // bow out to sea
      scene.add(g);
      // each ship runs its own day: boarding -> departs -> away -> arrives -> boarding ...
      (this.ships ||= []).push({ g, sx, sz, pz, door: { x: X0 + 0.7, z: pz - sd * 0.6 }, phase: 'boarding', t: rand(90, 240), x: sx, v: 0 });
      // covered gangways from the terminal up to the ship's side door
      for (const gx of [tx - tl * 0.3, tx + tl * 0.25]) {
        const z0 = tz + sd * tw / 2, z1 = sz - sd * 2.3, y0 = 1.7, y1 = 2.35, L = Math.hypot(z1 - z0, y1 - y0);
        const gw = new THREE.BoxGeometry(0.45, 0.5, L).rotateX(-sd * Math.atan2(y1 - y0, Math.abs(z1 - z0))).translate(gx, (y0 + y1) / 2, (z0 + z1) / 2);
        pierParts.push(tint(gw, 0xdedfdc));
        pierParts.push(box(0.1, y0 + 0.5, 0.1, gx, (y0 + 0.5) / 2, (z0 + z1) / 2, 0x8f949a));
      }
      // tour buses waiting on the shore end of the pier
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Matrix4().compose(_p.set(X0 - 1.0 - i * 1.05, 0.5, pz - sd * 0.7), _q.setFromAxisAngle(UP, 0.08 * (i - 1)), _s.set(1, 1, 1));
        busBody.push(tint(bus.body.clone().applyMatrix4(m), pick(BUS_COLORS)));
        busDark.push(tint(bus.dark.clone().applyMatrix4(m), 0x15181c));
      }
    }
    const pm = new THREE.Mesh(mergeGeometries([...pierParts, ...bits, ...busBody]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    pm.castShadow = pm.receiveShadow = true;
    const bd = new THREE.Mesh(mergeGeometries(busDark), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.6 }));
    const tm = new THREE.Mesh(mergeGeometries(termParts), this.termMat);
    tm.castShadow = tm.receiveShadow = true;
    scene.add(pm, bd, tm);

    // ---- marina: floating docks and moored sailboats ----
    const docks = [], hulls = [], masts = [];
    const mz0 = 44, mz1 = 76, mx = X0 - 4;
    for (let z = mz0; z <= mz1; z += 5) {
      docks.push(new THREE.BoxGeometry(18, 0.12, 0.6).translate(mx - 9, 0.08, z));
      for (let x = mx - 1.5; x > mx - 17; x -= 1.4) for (const s of [-1, 1]) if (Math.random() < 0.8) {
        hulls.push([x, z + s * 1.3]); masts.push([x, z + s * 1.3]);
      }
    }
    docks.push(new THREE.BoxGeometry(0.8, 0.12, mz1 - mz0).translate(mx, 0.08, (mz0 + mz1) / 2));
    scene.add(Object.assign(new THREE.Mesh(mergeGeometries(docks), new THREE.MeshStandardMaterial({ color: 0xb0a590, roughness: 0.9 })), { receiveShadow: true }));
    const hullGeo = mergeGeometries([new THREE.BoxGeometry(1.1, 0.25, 0.42).translate(0, 0.12, 0), new THREE.BoxGeometry(0.4, 0.18, 0.3).translate(-0.1, 0.33, 0)]);
    const hm = new THREE.InstancedMesh(hullGeo, white, hulls.length);
    const mm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 2.2, 4).translate(0, 1.3, 0), dark, masts.length);
    hulls.forEach(([x, z], i) => {
      _m.compose(_p.set(x, 0.02, z), _q.setFromAxisAngle(UP, Math.PI / 2 + rand(-0.1, 0.1)), _s.set(1, 1, 1));
      hm.setMatrixAt(i, _m); mm.setMatrixAt(i, _m);
    });
    hm.castShadow = mm.castShadow = true;
    scene.add(hm, mm);

    // ---- harbour traffic: ferries and small boats moving around the bay ----
    const boatGeo = mergeGeometries([new THREE.BoxGeometry(2.2, 0.4, 0.9).translate(0, 0.2, 0), new THREE.BoxGeometry(1.1, 0.4, 0.7).translate(-0.2, 0.6, 0)]);
    this.boatMesh = new THREE.InstancedMesh(boatGeo, white, 9);
    for (let i = 0; i < 9; i++) this.boats.push({ x: X0 - rand(25, 150), z: rand(-120, 120), a: rand(0, 6.28), sp: rand(1.2, 3), turn: rand(-0.08, 0.08), s: i < 2 ? 2 : rand(0.7, 1.1) });
    this.boatMesh.castShadow = true;
    scene.add(this.boatMesh);

    this.buildBridge(scene, { white, blue, deckMat, dark });
  }

  buildBridge(scene, M) {
    // sweeping curve from the south-west shore out over the bay and away into the haze
    // …over to Coronado, coming down on the island by the golf course (js/sandiego.js draws the island)
    const pts = [[-40, 0.2, 128], [-70, 4, 112], [-100, 10, 96], [-128, 15, 80], [-152, 12, 64], [-170, 5, 52], [-186, 0.9, 44]]
      .map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.curve = curve;
    this.len = curve.getLength();
    const N = 360, W = 3.6, GD = 0.9;
    const deck = [], girder = [], rail = [], piers = [], lamps = [];
    const frames = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      frames.push({ p, t, side });
    }
    const ribbon = (y0, halfW, yOff = 0) => {
      const pos = [], idx = [];
      frames.forEach(({ p, side }, i) => {
        pos.push(p.x + side.x * halfW, p.y + y0 + yOff, p.z + side.z * halfW, p.x - side.x * halfW, p.y + y0 + yOff, p.z - side.z * halfW);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const wall = (halfW, yTop, yBot) => {
      const pos = [], idx = [];
      frames.forEach(({ p, side }, i) => {
        for (const s of [1, -1]) pos.push(p.x + side.x * halfW * s, p.y + yTop, p.z + side.z * halfW * s, p.x + side.x * halfW * s, p.y + yBot, p.z + side.z * halfW * s);
        if (i) {
          const a = (i - 1) * 4, b = i * 4;
          idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    deck.push(ribbon(0, W / 2));
    girder.push(wall(W / 2 - 0.1, -0.02, -GD), ribbon(-GD, W / 2 - 0.1));
    rail.push(wall(W / 2, 0.28, 0));
    // twin white columns with a crossbeam every ~9 units along the curve
    const spacing = 9 / this.len;
    for (let u = 0.04; u < 0.97; u += spacing) {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const h = p.y - GD;
      if (h < 1.2) continue;
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize(), yaw = Math.atan2(t.x, t.z);
      for (const s of [-1, 1]) {
        const cx = p.x + side.x * 1.15 * s, cz = p.z + side.z * 1.15 * s;
        piers.push(new THREE.BoxGeometry(0.42, h, 0.62).rotateY(yaw).translate(cx, h / 2, cz));
        piers.push(new THREE.BoxGeometry(0.9, 0.4, 1.1).rotateY(yaw).translate(cx, 0.1, cz));
      }
      piers.push(new THREE.BoxGeometry(3.0, 0.45, 0.6).rotateY(yaw + Math.PI / 2).translate(p.x, h - 0.2, p.z));
    }
    for (let u = 0.02; u < 0.98; u += 13 / this.len) {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      lamps.push(new THREE.Vector3(p.x + side.x * 1.65, p.y + 1.1, p.z + side.z * 1.65));
    }
    const mk = (geos, mat) => { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    mk(deck, M.deckMat); mk(girder, M.blue); mk(rail, M.white); mk(piers, M.white);
    // lane markings as thin dashes
    const dash = [];
    for (let u = 0; u < 1; u += 1.6 / this.len) for (const off of [-0.85, 0.85]) {
      const f = frames[Math.round(u * N)], p = f.p;
      dash.push(new THREE.BoxGeometry(0.05, 0.01, 0.7).rotateY(Math.atan2(f.t.x, f.t.z)).translate(p.x + f.side.x * off, p.y + 0.012, p.z + f.side.z * off));
    }
    mk(dash, new THREE.MeshBasicMaterial({ color: 0xe8e8e0 }));
    const cdiv = []; // centre divider
    frames.forEach((f, i) => { if (i % 2) return; cdiv.push(new THREE.BoxGeometry(0.12, 0.18, 1.2).rotateY(Math.atan2(f.t.x, f.t.z)).translate(f.p.x, f.p.y + 0.09, f.p.z)); });
    mk(cdiv, M.white);
    this.lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length);
    const poles = [];
    lamps.forEach((l, i) => { _m.makeTranslation(l.x, l.y, l.z); this.lampHeads.setMatrixAt(i, _m); poles.push(new THREE.CylinderGeometry(0.02, 0.025, 1.1, 4).translate(l.x, l.y - 0.55, l.z)); });
    mk(poles, M.dark);
    scene.add(this.lampHeads);

    // ---- bridge traffic: cars, box trucks and buses with head and tail lights ----
    const car = carGeos();
    const kinds = [{ ...car, half: 0.78, n: 64, colors: CAR_COLORS }, { ...truckGeos(), n: 9, colors: TRUCK_COLORS }, { ...busGeos(), n: 6, colors: BUS_COLORS }];
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.15, metalness: 0.7 });
    const total = kinds.reduce((a, k) => a + k.n, 0);
    const lampPair = (w, h) => mergeGeometries([new THREE.BoxGeometry(0.13, 0.06, 0.03).translate(-w, h, 0), new THREE.BoxGeometry(0.13, 0.06, 0.03).translate(w, h, 0)]);
    this.headL = new THREE.InstancedMesh(lampPair(0.22, 0.27), new THREE.MeshBasicMaterial({ color: 0xffffff }), total);
    this.tailL = new THREE.InstancedMesh(lampPair(0.25, 0.28), new THREE.MeshBasicMaterial({ color: 0xffffff }), total);
    this.cars = []; this.kinds = kinds;
    const lanes = [-1.3, -0.45, 0.45, 1.3];
    let li = 0;
    for (const k of kinds) {
      k.body = new THREE.InstancedMesh(k.body, bodyMat, k.n); k.dark = new THREE.InstancedMesh(k.dark, darkMat, k.n);
      for (const m of [k.body, k.dark]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
      for (let i = 0; i < k.n; i++) {
        // heavy vehicles keep to the slow (outer) lanes
        const lane = k.colors === CAR_COLORS ? lanes[li++ % 4] : pick([-1.3, 1.3]);
        this.cars.push({ k, i, u: Math.random(), lane, dir: lane > 0 ? 1 : -1, half: k.half, v: (k.colors === CAR_COLORS ? rand(5.5, 7.5) : rand(4.2, 5.2)) / this.len });
        k.body.setColorAt(i, new THREE.Color(pick(k.colors)));
      }
    }
    this.headL.frustumCulled = this.tailL.frustumCulled = false;
    scene.add(this.headL, this.tailL);
  }

  updateShips(dt) {
    const T = G.camTarget, far = this.X0 - 260;
    for (const s of this.ships || []) {
      s.t -= dt;
      if (s.phase === 'boarding') {
        // passengers walk down to the terminal (only bother while someone's watching)
        if (G.roles && Math.hypot(s.door.x - T.x, s.door.z - T.z) < 70 && (s.inT = (s.inT || 0) - dt) <= 0) {
          s.inT = rand(3, 6);
          const p = G.agents.peds.find((q) => q.state === 'walk' && !q.role && !q.officer && Math.hypot(q.pos.x - s.door.x, q.pos.z - s.door.z) < 40);
          if (p) { G.roles.look(p, 'TOURIST'); G.roles.visit(p, { x: s.door.x + rand(-0.8, 0.8), z: s.door.z }, rand(60, 120), true); }
        }
        if (s.t < 25 && !s.warned) { s.warned = true; G.news && G.news.post('LOCAL', 'Cruise ship preparing to depart the harbor.', 1, 'cruise-dep'); }
        if (s.t <= 0) { s.phase = 'departing'; s.v = 0; s.warned = false; sfx.shipHorn && sfx.shipHorn(s.x, s.sz); }
      } else if (s.phase === 'departing') {
        // out into the channel, swing round to the north and sail up the bay toward the sea
        s.z ??= s.sz; s.yaw ??= Math.PI;
        const lane = this.X0 - 58;
        if (s.x > lane + 0.5) { s.v = Math.min(2.4, s.v + dt * 0.12); s.x -= s.v * dt; }
        else { s.yaw += (Math.PI / 2 - s.yaw) * Math.min(1, dt * 0.35); s.v = Math.min(3.4, s.v + dt * 0.1); if (Math.abs(s.yaw - Math.PI / 2) < 0.3) s.z -= s.v * dt; }
        if (s.z < -260) { s.phase = 'away'; s.t = rand(120, 260); s.g.visible = false; }
      } else if (s.phase === 'away') {
        if (s.t <= 0) { s.phase = 'arriving'; s.x = this.X0 - 58; s.z = -260; s.yaw = -Math.PI / 2; s.v = 3.2; s.g.visible = true; G.news && G.news.post('LOCAL', 'Cruise ship arriving at the downtown terminal.', 1, 'cruise-arr'); }
      } else if (s.phase === 'arriving') {
        // down the bay, turn at the pier, back in to the berth
        if (s.z < s.sz - 0.1) { const d = s.sz - s.z; s.z += Math.max(0.4, Math.min(3.2, d * 0.04)) * dt; }
        else { s.z = s.sz; s.yaw += (Math.PI - s.yaw) * Math.min(1, dt * 0.35); if (Math.abs(s.yaw - Math.PI) < 0.05) { const d = s.sx - s.x; s.x += Math.max(0.25, Math.min(1.6, d * 0.05)) * dt; if (d < 0.05) { s.x = s.sx; s.yaw = Math.PI; s.phase = 'boarding'; s.t = rand(150, 280); sfx.shipHorn && sfx.shipHorn(s.x, s.sz); } } }
      }
      s.g.position.x = s.x; if (s.z != null) s.g.position.z = s.z; if (s.yaw != null) s.g.rotation.y = s.yaw;
    }
  }
  update(dt) {
    this.updateShips(dt);
    const n = G.night || 0;
    // vehicles keep a gap to the one ahead in their lane, and loop at the ends (both ends are far off-screen)
    const byLane = {};
    for (const c of this.cars) (byLane[c.lane] ||= []).push(c);
    for (const lane of Object.values(byLane)) {
      lane.sort((a, b) => (a.u - b.u) * a.dir);
      lane.forEach((c, i) => {
        const ahead = lane[(i + 1) % lane.length];
        let gap = (ahead.u - c.u) * c.dir; if (gap < 0) gap += 1;
        const room = gap * this.len - c.half - ahead.half;
        const want = Math.min(c.v, ahead === c ? c.v : ahead.v + 0.4 / this.len);
        const sp = room < 1.6 ? want * Math.max(0, (room - 0.5) / 1.1) : c.v;
        c.u += c.dir * sp * dt;
        if (c.u > 1) c.u -= 1; if (c.u < 0) c.u += 1;
      });
    }
    const touched = new Set();
    this.cars.forEach((c, j) => {
      const u = Math.min(0.999, Math.max(0.001, c.u));
      this.curve.getPointAt(u, _p); this.curve.getTangentAt(u, _t);
      _side.set(-_t.z, 0, _t.x).normalize();
      _fwd.copy(_t).multiplyScalar(c.dir);
      _q.setFromUnitVectors(_Z, _fwd);
      _p.x += _side.x * c.lane; _p.z += _side.z * c.lane; _p.y += 0.01;
      // vehicles pop in and out only at the far ends
      const e = Math.min(u, 1 - u) < 0.012 ? 0 : 1;
      _s.set(e, e, e);
      _m.compose(_p, _q, _s);
      c.k.body.setMatrixAt(c.i, _m); c.k.dark.setMatrixAt(c.i, _m); touched.add(c.k);
      _m.compose(_v.copy(_p).addScaledVector(_fwd, c.half + 0.01), _q, _s); this.headL.setMatrixAt(j, _m);
      _m.compose(_v.copy(_p).addScaledVector(_fwd, -c.half - 0.01), _q, _s); this.tailL.setMatrixAt(j, _m);
    });
    for (const k of touched) k.body.instanceMatrix.needsUpdate = k.dark.instanceMatrix.needsUpdate = true;
    this.headL.instanceMatrix.needsUpdate = this.tailL.instanceMatrix.needsUpdate = true;
    this.headL.material.color.setRGB(0.55 + n * 3.2, 0.55 + n * 3.0, 0.5 + n * 2.4);
    this.tailL.material.color.setRGB(0.5 + n * 2.6, 0.04, 0.03);
    for (const m of this.shipMats) m.emissiveIntensity = n * 1.3;
    this.termMat.emissiveIntensity = n * 1.1;
    this.lampHeads.material.color.setRGB(0.6 + n * 3, 0.55 + n * 2.6, 0.45 + n * 2);
    // boats wander the bay, staying off the seawall
    this.boats.forEach((b, i) => {
      b.a += b.turn * dt;
      b.x += Math.cos(b.a) * b.sp * dt; b.z += Math.sin(b.a) * b.sp * dt;
      if (b.x > this.X0 - 8) b.a = Math.PI - b.a, b.x = this.X0 - 8;
      if (b.x < this.X0 - 84 || Math.abs(b.z) > 150) b.a += Math.PI;               // stay in the bay (Coronado is over there)
      _m.compose(_p.set(b.x, 0.03 + Math.sin(G.time * 2 + i) * 0.03, b.z), _q.setFromAxisAngle(UP, -b.a), _s.set(b.s, b.s, b.s));
      this.boatMesh.setMatrixAt(i, _m);
      if (Math.random() < dt * 5) G.fx.bits.emit(b.x - Math.cos(b.a) * b.s, 0.1, b.z - Math.sin(b.a) * b.s, 0, 0.3, 0, 0.18, 2, 0.95, 0.97, 1, 1);
    });
    this.boatMesh.instanceMatrix.needsUpdate = true;
  }
}

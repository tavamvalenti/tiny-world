// LA PLAYA, a Mexican coastal resort city that grew up against the hills (Puerto Vallarta in spirit):
//   BEACH → RESORT CITY → LOCAL STREETS → STEEP HILLS → DENSE HILLSIDE NEIGHBOURHOODS → the Cristo on the summit.
// The beach and the city are flat (the playable streets are unchanged in how they work); behind the last street
// the ground rises into green hills packed with small concrete houses, laced with long staircases people climb,
// with a statue of Christ on the highest point, visible from the whole beachfront. Offshore and on the west beach
// there's a small fishing fleet. The hills are a height field (terrainH) that buildings, people, raycasts and
// debris all respect; the houses are ordinary destructible buildings standing on it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { beachRadio } from './audio.js';

// ---------- the ground ----------
export const STATUE = { x: 22, z: 113 };
const HILL0 = 66;                                                  // the last street; the slope starts behind it
// the summit is levelled into a plateau for the Cristo's plaza
let SUMMIT = null;
export function terrainH(x, z) {
  const h = baseH(x, z);
  if (SUMMIT === null) SUMMIT = baseH(STATUE.x, STATUE.z);
  const d = Math.hypot(x - STATUE.x, z - STATUE.z);
  if (d > 18) return h;
  const k = d < 11 ? 1 : 1 - (d - 11) / 7, s = k * k * (3 - 2 * k);
  return h + (SUMMIT - 0.05 - h) * s;
}
function baseH(x, z) {
  if (z < HILL0 + 1) return 0;
  const t = Math.min(1, (z - HILL0 - 1) / 56), s = t * t * (3 - 2 * t);
  let h = s * 30 + Math.max(0, z - 123) * 0.32;
  h += (Math.sin(x * 0.045 + 1.3) * 4 + Math.sin(x * 0.11 + 0.4) * 1.6) * s;             // spurs and gullies
  h += 13 * Math.exp(-((x - STATUE.x) ** 2 + (z - STATUE.z) ** 2) / 170);                // the summit
  h += 46 * Math.exp(-((x + 92) ** 2) / 700 - ((z - 168) ** 2) / 900);                  // a great granite dome to the west
  h += 30 * Math.exp(-((x - 120) ** 2) / 1600 - ((z - 175) ** 2) / 1400);
  return Math.max(0, h);
}
const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
const corridorX = (x0, z) => x0 + Math.sin(z * 0.11 + x0) * 2.2;       // the staircases wander a little
const CORRIDORS = [-82, -58, -34, -10, 16, 42, 66, 88];
const LANES = [77.5, 89, 100];

// ---------- layout (runs with the map build, before the buildings are finalised) ----------
export function buildHills(ctx) {
  const { city, B } = ctx, P = city.playa;
  P.stairs = []; P.houses = []; P.lanes = LANES;
  const zTop = (x0) => (x0 === 16 ? 101 : 96 + Math.abs(Math.sin(x0)) * 10);
  for (const x0 of CORRIDORS) {
    const pts = [];
    for (let z = HILL0 + 0.6; z < zTop(x0); z += 0.9) pts.push({ x: corridorX(x0, z), z });
    if (x0 === 16) {                                            // this one climbs all the way to the Cristo
      const last = pts[pts.length - 1];
      for (let k = 1; k <= 12; k++) { const u = k / 12; pts.push({ x: last.x + (STATUE.x - 3.5 - last.x) * u, z: last.z + (STATUE.z - 5 - last.z) * u }); }
    }
    P.stairs.push({ x0, pts, doors: [] });
  }
  const nearStair = (x, z, w) => {
    for (const s of P.stairs) { const top = s.pts[s.pts.length - 1].z; if (z > top + 1) continue; if (Math.abs(x - corridorX(s.x0, z)) < 1.25 + w / 2) return true; }
    return false;
  };
  const noise = (x, z) => Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * Math.sin(z * 0.21 + x * 0.03);
  for (let z = HILL0 + 2.8; z < 111; z += rand(2.15, 2.45)) {
    if (LANES.some((l) => Math.abs(z - l) < 1.5)) continue;
    const up = (z - HILL0) / 45;                                    // higher = sparser, smaller
    for (let x = -96; x < 96;) {
      const w = rand(1.4, 2.4), d = rand(1.9, 2.4);
      x += w / 2;
      const cx = x, cz = z + rand(-0.25, 0.25);
      x += w / 2 + (Math.random() < 0.08 ? rand(0.3, 0.8) : rand(0.02, 0.15));
      if (nearStair(cx, cz, w)) continue;
      if (Math.hypot(cx - STATUE.x, cz - STATUE.z) < 12) continue;
      if (noise(cx, cz) > 0.8 - up * 0.45 || Math.random() < up * up * 0.3) continue;      // patches of forest, more of them higher up
      const hs = [terrainH(cx - w / 2, cz - d / 2), terrainH(cx + w / 2, cz - d / 2), terrainH(cx - w / 2, cz + d / 2), terrainH(cx + w / 2, cz + d / 2)];
      const lo = Math.min(...hs), hi = Math.max(...hs);
      if (hi - lo > 2.6) continue;                                   // too steep to build on
      const base = hi - 0.15;                                        // sits level with the uphill side; a foundation fills beneath
      const floors = pick(up < 0.4 ? [1, 2, 2, 3, 3, 4] : [1, 1, 2, 2, 3]);
      const r = Math.random();
      const style = r < 0.38 ? 'brick' : r < 0.7 ? 'concrete' : 'stucco';
      const tint = style === 'brick' ? hsl(rand(0.03, 0.06), rand(0.4, 0.55), rand(0.42, 0.55))
        : style === 'concrete' ? hsl(rand(0.08, 0.12), rand(0.02, 0.1), rand(0.52, 0.74))
          : hsl(pick([0.0, 0.08, 0.13, 0.33, 0.55, 0.6, 0.95]), rand(0.35, 0.6), rand(0.55, 0.72));
      const b = B.add({ x: cx, z: cz, w, d, floors, style, tint, cell: 1.3, gh: 0.9, fh: 0.8, base, storefront: false });
      b.hill = true; b.noSigns = true; b.top = base + 0.9 + (floors - 1) * 0.8; b.found = { lo: lo - 0.4, base };
      P.houses.push(b);
      // front doors on the staircases
      for (const s of P.stairs) {
        const sx = corridorX(s.x0, cz), dx = cx - sx;
        if (Math.abs(dx) < 3.4 && cz < s.pts[s.pts.length - 1].z) { s.doors.push({ x: sx + Math.sign(dx) * 0.95, z: cz, b }); break; }
      }
    }
  }
  // the view from the Cristo: a lookout plaza
  P.statueY = terrainH(STATUE.x, STATUE.z);
}

// ---------- everything drawn on top (terrain, stairs, wires, trees, the Cristo, the coast) ----------
function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c, ry = 0) => tint(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z), c);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export class Playa {
  constructor(scene, city) {
    this.city = city; this.P = city.playa; this.scene = scene;
    const lambert = (this.lambert = new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.terrain(scene);
    this.foundations(scene);
    this.stairs(scene);
    this.trees(scene);
    this.tanks(scene);
    this.statue(scene);
    this.streets(scene);
    this.beach(scene);
    this.speakers(scene);
    this.fishing(scene);
    G.playa = this;
  }

  // the hills: one height-field mesh, green with bare earth and concrete where the houses crowd in, rock up top
  terrain(scene) {
    const X0 = -280, X1 = 280, Z0 = HILL0 - 1, Z1 = 300, NX = 140, NZ = 72;
    const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ).rotateX(-Math.PI / 2).translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    // where the houses are (coarse grid) so the ground there reads as packed earth and concrete
    const occ = new Map(), key = (x, z) => `${Math.round(x / 3)},${Math.round(z / 3)}`;
    for (const b of this.P.houses) occ.set(key(b.x, b.z), (occ.get(key(b.x, b.z)) || 0) + 1);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z);
      pos.setY(i, h + (z < HILL0 + 1.5 ? -0.03 : 0.02));
      const slope = Math.hypot(terrainH(x + 1, z) - h, terrainH(x, z + 1) - h);
      const n = Math.sin(x * 0.31 + z * 0.17) * 0.5 + Math.sin(x * 0.07 - z * 0.13) * 0.5;
      const built = occ.get(key(x, z)) || 0;
      const j = (Math.random() - 0.5) * 0.08, toe = clamp((82 - z) / 10, 0, 1);                                    // grit; the foot of the hill is bare earth
      if (h > 34 && slope > 0.9) c.setHSL(0.08, 0.06, 0.42 + n * 0.06 + j, THREE.SRGBColorSpace);                // bare granite
      else if (built > 0 || Math.random() < toe * 1.2) c.setHSL(0.07 + j * 0.2, 0.2 + j, 0.42 + n * 0.05 + j, THREE.SRGBColorSpace);   // packed earth, concrete
      else if (slope > 0.55 && Math.random() < 0.35) c.setHSL(0.08, 0.16, 0.36 + j, THREE.SRGBColorSpace);      // eroded patches on the steep bits
      else c.setHSL(0.26 + n * 0.04 + j * 0.3, 0.36 + n * 0.08 + j, 0.22 + n * 0.05 + j + Math.min(0.08, h * 0.002), THREE.SRGBColorSpace);   // green hill
      c.toArray(col, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    // a fine grit texture over the colours: speckle, pebbles, tufts
    const grit = canvasTex(256, 256, (x, w, hh) => {
      x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, hh);
      for (let i = 0; i < 9000; i++) { const v = 150 + Math.random() * 105 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * w, Math.random() * hh, 1 + Math.random() * 2, 1 + Math.random() * 2); }
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '40,34,28' : '255,250,240'},${0.1 + Math.random() * 0.2})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * hh, 1.5 + Math.random() * 4, 0, 6.3); x.fill(); }
    });
    grit.wrapS = grit.wrapT = THREE.RepeatWrapping; grit.repeat.set(140, 60); grit.colorSpace = THREE.NoColorSpace;
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: grit, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    m.receiveShadow = true; scene.add(m);
    this.ground = m;
  }

  // concrete terraces and brick footings under the downhill side of each house
  foundations(scene) {
    const F = [];
    for (const b of this.P.houses) {
      const f = b.found; if (!f || f.base - f.lo < 0.25) continue;
      const h = f.base - f.lo;
      F.push(box(b.w + 0.1, h, b.d + 0.1, b.x, f.lo + h / 2, b.z, pick([0x8f8a80, 0x9a948a, 0x7f766c, 0xa0543c])));
    }
    if (!F.length) return;
    const m = new THREE.Mesh(mergeGeometries(F), this.lambert); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }

  // the staircases (the signature of the hills), the lanes along the contours, poles and wires
  stairs(scene) {
    const S = [], wires = [];
    const concrete = [0xbdb7ab, 0xb2ab9f, 0xc6c0b4];
    for (const st of this.P.stairs) {
      const pts = st.pts;
      let lastPole = null;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], yaw = Math.atan2(b.x - a.x, b.z - a.z);
        for (let k = 0; k < 2; k++) {
          const u = k / 2, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = terrainH(x, z);
          const landing = i % 12 === 0 && k === 0;
          const top = Math.round((y + 0.08) / 0.12) * 0.12;                       // steps, not a ramp
          S.push(box(landing ? 1.7 : 1.05, 1.4, landing ? 1.2 : 0.47, x, top - 0.7, z, pick(concrete), yaw));
          if (!landing && k === 0) for (const sd of [-1, 1]) S.push(box(0.04, 0.34, 0.47, x + Math.cos(yaw) * sd * 0.52, top + 0.17, z - Math.sin(yaw) * sd * 0.52, 0x6b6f76, yaw));
        }
        // utility poles every few metres with wires between them and across to the houses
        if (i % 7 === 0) {
          const px = a.x + Math.cos(yaw) * 0.85, pz = a.z - Math.sin(yaw) * 0.85, py = terrainH(px, pz);
          S.push(box(0.07, 2.1, 0.07, px, py + 1.05, pz, 0x5a4a3a), box(0.5, 0.05, 0.05, px, py + 2, pz, 0x3a3a3a, yaw));
          const topP = new THREE.Vector3(px, py + 2, pz);
          if (lastPole) wires.push(lastPole.clone().add(new THREE.Vector3(0.2, 0, 0)), topP.clone().add(new THREE.Vector3(0.2, 0, 0)), lastPole, topP);
          const door = st.doors.filter((d) => Math.abs(d.z - pz) < 4)[0];
          if (door) wires.push(topP, new THREE.Vector3(door.b.x, door.b.top + 0.1, door.b.z));
          lastPole = topP;
        }
      }
    }
    // lanes along the contours, joining the stairs
    for (const lz of LANES) for (let x = -95; x < 95; x += 0.9) {
      const y = terrainH(x, lz);
      S.push(box(0.92, 1.2, 1.0, x, y - 0.55, lz, 0xa9a195));
    }
    const m = new THREE.Mesh(mergeGeometries(S), this.lambert); m.receiveShadow = true; m.castShadow = true; scene.add(m);
    const wg = new THREE.BufferGeometry().setFromPoints(wires);
    scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1c1c1c, transparent: true, opacity: 0.7 })));
  }

  // trees: thick on the slopes that aren't built on, palms low down, forest up to the ridges
  trees(scene) {
    const occ = new Set(), key = (x, z) => `${Math.round(x / 2)},${Math.round(z / 2)}`;
    for (const b of this.P.houses) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) occ.add(key(b.x + dx * 1.5, b.z + dz * 1.5));
    const corridor = (x, z) => this.P.stairs.some((s) => z < s.pts[s.pts.length - 1].z + 1 && Math.abs(x - corridorX(s.x0, z)) < 1.6) || LANES.some((l) => Math.abs(z - l) < 1.1 && Math.abs(x) < 96);
    const broad = [], palms = [];
    for (let n = 0; n < 2600 && broad.length < 1500; n++) {
      const x = rand(-240, 240), z = HILL0 + 2 + Math.pow(Math.random(), 1.3) * 200;
      if (occ.has(key(x, z)) || corridor(x, z) || Math.hypot(x - STATUE.x, z - STATUE.z) < 8) continue;
      const h = terrainH(x, z), slope = Math.hypot(terrainH(x + 1, z) - h, terrainH(x, z + 1) - h);
      if (h > 34 && slope > 0.9) continue;                              // bare rock
      if (z < 90 && Math.random() < 0.18) palms.push([x, h, z, rand(0.9, 1.3)]);
      else broad.push([x, h, z, rand(0.8, 1.6) * (z > 140 ? 1.6 : 1)]);
    }
    const tg = new THREE.IcosahedronGeometry(1, 1).scale(1, 0.8, 1).translate(0, 1.2, 0);
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial(), broad.length), c = new THREE.Color();
    broad.forEach(([x, y, z, s], i) => { _m.compose(_p.set(x, y - 0.2, z), _q.identity(), _s.set(s, s * rand(0.8, 1.2), s)); tm.setMatrixAt(i, _m); tm.setColorAt(i, c.setHSL(rand(0.22, 0.32), rand(0.35, 0.5), rand(0.16, 0.28), THREE.SRGBColorSpace)); });
    tm.castShadow = true; tm.receiveShadow = true; scene.add(tm);
    const pg = mergeGeometries([tint(new THREE.CylinderGeometry(0.05, 0.08, 1.8, 5).translate(0, 0.9, 0), 0x6b4a2e), ...Array.from({ length: 6 }, (_, k) => tint(new THREE.ConeGeometry(0.14, 1.0, 4).rotateZ(Math.PI / 2 - 0.5).translate(0.45, 1.8, 0).rotateY(k * 1.05), 0x2f7a3a))]);
    const pm = new THREE.InstancedMesh(pg, this.lambert, Math.max(1, palms.length));
    palms.forEach(([x, y, z, s], i) => { _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_v.set(0, 1, 0), rand(0, 6)), _s.set(s, s, s)); pm.setMatrixAt(i, _m); });
    pm.castShadow = true; scene.add(pm);
  }

  // blue water tanks on the flat roofs (they fall with the roof: registered as props of the top cells)
  tanks(scene) {
    const roofs = this.P.houses.filter(() => Math.random() < 0.55);
    const g = mergeGeometries([new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8).translate(0, 0.15, 0), new THREE.CylinderGeometry(0.23, 0.23, 0.04, 8).translate(0, 0.32, 0)]);
    const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x2f5fb8 }), Math.max(1, roofs.length));
    roofs.forEach((b, i) => {
      const cells = b.cells.filter((c) => c.f === b.floors - 1), c = pick(cells);
      const x = c.x + rand(-0.2, 0.2), y = c.y + c.hy, z = c.z + rand(-0.2, 0.2);
      _m.makeTranslation(x, y, z); m.setMatrixAt(i, _m);
      (c.props ||= []).push({ mesh: m, idx: i, x, y, z });
    });
    m.castShadow = true; scene.add(m);
  }

  // the Cristo on the summit: a lookout plaza with a balustrade, a tall pedestal, the statue with open arms
  statue(scene) {
    const { x, z } = STATUE, y = this.P.statueY, stone = 0xddd7c8, P = [];
    P.push(tint(new THREE.CylinderGeometry(7.5, 9.5, 12, 24).translate(x, y - 5.85, z), 0x7d7468));                  // plaza on a deep bedrock base, set into the plateau
    P.push(tint(new THREE.CylinderGeometry(7.45, 7.45, 0.12, 24).translate(x, y + 0.1, z), 0xc9c2b4));                  // the paved floor
    for (let a = 0; a < 6.28; a += 0.24) P.push(box(0.14, 0.5, 1.6, x + Math.cos(a) * 7.3, y + 0.4, z + Math.sin(a) * 7.3, 0xe8e2d4, -a));
    P.push(box(3.2, 1.1, 3.2, x, y + 0.55, z, 0x8f8a80), box(2.4, 3.6, 2.4, x, y + 2.9, z, 0x9c978c));                    // steps + pedestal
    const robe = new THREE.LatheGeometry([[0.001, 0], [1.05, 0], [0.98, 1.2], [0.82, 3.4], [0.78, 4.6], [0.92, 5.6], [0.62, 6.1], [0.001, 6.2]].map(([r, h]) => new THREE.Vector2(r, h)), 16);
    P.push(tint(robe.scale(1, 1, 0.62).translate(x, y + 4.7, z), stone));
    P.push(tint(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 8).translate(x, y + 11, z), stone), tint(new THREE.SphereGeometry(0.5, 10, 8).scale(0.9, 1.1, 0.95).translate(x, y + 11.6, z), stone));
    for (const s of [-1, 1]) {
      P.push(tint(new THREE.BoxGeometry(3.6, 0.62, 0.5).rotateZ(-s * 0.06).translate(x + s * 2.4, y + 10.1, z), stone));
      P.push(tint(new THREE.SphereGeometry(0.32, 8, 6).translate(x + s * 4.2, y + 9.95, z), stone));
    }
    // the pedestal and the figure are built at 1:1 and then scaled up round the plaza centre so it reads from the beach
    const plaza = P.slice(0, 2 + Math.ceil(6.28 / 0.24)), fig = mergeGeometries(P.slice(plaza.length));
    fig.translate(-x, -y, -z).scale(1.6, 1.6, 1.6).translate(x, y, z);
    const m = new THREE.Mesh(mergeGeometries([...plaza, fig]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0xfff2dc, emissiveIntensity: 0 }));
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    this.statueMesh = m;
    // floodlights round the base
    const L = [];
    for (const a of [0.6, 2.2, 3.8, 5.4]) L.push(box(0.4, 0.2, 0.3, x + Math.cos(a) * 3, y + 0.25, z + Math.sin(a) * 3, 0xffffff));
    this.floods = new THREE.Mesh(mergeGeometries(L), new THREE.MeshBasicMaterial({ vertexColors: true }));
    scene.add(this.floods);
  }

  // street life on the flat: OXXO stores and a gas station, taco stands and fruit stalls
  streets(scene) {
    const P = [], signs = [];
    const oxxoTex = canvasTex(256, 96, (x, w, h) => {
      x.fillStyle = '#f2b705'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#d7141c'; x.fillRect(0, h * 0.12, w, h * 0.76);
      x.fillStyle = '#fff'; x.font = `900 ${h * 0.58}px Arial Black, Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('OXXO', w / 2, h * 0.53);
    });
    const oxxoMat = new THREE.MeshStandardMaterial({ map: oxxoTex, emissiveMap: oxxoTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 });
    this.signMats = [oxxoMat];
    for (const o of this.P.oxxo || []) {
      // red fascia along the front with the sign over the doors (fronts face -z, toward the sea)
      P.push(box(o.w, 0.28, 0.1, o.x, o.h - 0.2, o.z - 0.06, 0xd7141c), box(o.w, 0.08, 0.11, o.x, o.h - 0.36, o.z - 0.06, 0xf2b705));
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), oxxoMat); s.position.set(o.x, o.h + 0.26, o.z - 0.12); s.rotation.y = Math.PI; signs.push(s);
      if (o.gas) {
        const gx = o.x, gz = o.z - 3.4;
        P.push(box(4.6, 0.22, 3, gx, 2.05, gz, 0xf2f2ee), box(4.62, 0.12, 3.02, gx, 1.92, gz, 0xd7141c));
        for (const [dx, dz] of [[-1.9, -1.1], [1.9, -1.1], [-1.9, 1.1], [1.9, 1.1]]) P.push(box(0.14, 1.9, 0.14, gx + dx, 0.95, gz + dz, 0xe8e8e4));
        for (const dx of [-0.9, 0.9]) P.push(box(0.35, 0.7, 0.25, gx + dx, 0.35, gz, 0xd7141c), box(0.36, 0.14, 0.26, gx + dx, 0.62, gz, 0xf2b705));
        const pylon = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), oxxoMat); pylon.position.set(gx + 2.8, 2.4, gz - 1.3); pylon.rotation.y = Math.PI; signs.push(pylon);
        P.push(box(0.14, 2.3, 0.14, gx + 2.8, 1.15, gz - 1.25, 0x9aa0a4));
        this.city.obstacles.push({ x: gx - 0.9, z: gz, r: 0.3 }, { x: gx + 0.9, z: gz, r: 0.3 });
      }
    }
    // taco stands: a tarp on four poles, a counter, a griddle, stools; fruit stalls with coloured crates
    this.smoke = [];
    for (const f of this.P.food || []) {
      const tarp = pick([0xd7141c, 0x1f63b8, 0xf2b705, 0x2a9d8f, 0xe8e4dc]), { x, z } = f;
      if (f.kind === 'fruit') {
        P.push(box(1.1, 0.5, 0.55, x, 0.25, z, 0x8a5a2b), box(0.08, 1.4, 0.08, x, 0.7, z + 0.3, 0x9aa0a4), tint(new THREE.ConeGeometry(0.9, 0.3, 8).translate(x, 1.45, z + 0.3), tarp));
        for (let k = 0; k < 4; k++) P.push(box(0.24, 0.12, 0.2, x - 0.36 + k * 0.24, 0.56, z, pick([0xf28c28, 0xf2c230, 0x2f9d3a, 0xe6394a])));
      } else {
        P.push(box(1.6, 0.06, 1.2, x, 1.35, z, tarp));
        for (const [dx, dz] of [[-0.75, -0.55], [0.75, -0.55], [-0.75, 0.55], [0.75, 0.55]]) P.push(box(0.04, 1.35, 0.04, x + dx, 0.67, z + dz, 0x9aa0a4));
        P.push(box(1.3, 0.5, 0.45, x, 0.25, z - 0.25, 0xe8e4dc), box(0.5, 0.05, 0.35, x + 0.25, 0.52, z - 0.25, 0x333333), box(1.32, 0.12, 0.08, x, 0.46, z - 0.49, tarp));
        for (const dx of [-0.5, 0, 0.5]) P.push(tint(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 6).translate(x + dx, 0.16, z - 0.8), 0x2f3338));
        this.smoke.push({ x: x + 0.25, z: z - 0.25 });
      }
      this.city.obstacles.push({ x, z, r: 0.6 });
    }
    if (P.length) { const m = new THREE.Mesh(mergeGeometries(P), this.lambert); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    for (const s of signs) scene.add(s);
  }

  // the resort beach: sun loungers in rows, thatched palapas, wooden piers with boats tied up
  beach(scene) {
    const L = [], T = [];
    for (const r of this.P.loungers || []) {
      L.push(box(0.28, 0.06, 0.72, r.x, 0.16, r.z, 0xf6f4ee), box(0.28, 0.04, 0.3, r.x, 0.27, r.z + 0.3, 0xf6f4ee));
    }
    for (const p of this.P.palapas || []) T.push(tint(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 5).translate(p.x, 0.55, p.z), 0x7a5a3a), tint(new THREE.ConeGeometry(0.85, 0.5, 9).translate(p.x, 1.25, p.z), 0xb38a4f));
    for (const pier of this.P.piers || []) {
      for (let z = pier.z0; z > pier.z1; z -= 0.5) T.push(box(1.2, 0.08, 0.46, pier.x, 0.32, z, 0x8a6a4a));
      for (let z = pier.z0; z > pier.z1; z -= 2) for (const sd of [-0.55, 0.55]) T.push(box(0.1, 0.8, 0.1, pier.x + sd, 0, z, 0x5a4a3a));
      for (const [dx, dz] of [[1.4, 2], [-1.4, 4], [1.4, 6]]) T.push(box(0.55, 0.22, 1.5, pier.x + dx, 0.05, pier.z1 + dz, 0xf2f2ee), box(0.4, 0.2, 0.5, pier.x + dx, 0.24, pier.z1 + dz - 0.2, 0x2a6fb5));
    }
    const all = [...L, ...T];
    if (all.length) { const m = new THREE.Mesh(mergeGeometries(all), this.lambert); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  // ---------- speakers on the sand: little groups of people on towels with a speaker playing (music in audio.js) ----------
  // Each group is a party speaker with a glowing ring, a cooler, towels, two people stretched out and one sitting up
  // nodding along. A blast nearby knocks the group out and that speaker goes quiet; lose them all and the music stops.
  speakers(scene) {
    this.spk = [];
    const SKIN = [0xf1c9a5, 0xd9a47a, 0xb97a55, 0x8d5a3b, 0x6a4230], SUIT = [0xd6336c, 0x1c7ed6, 0x2b8a3e, 0xf59f00, 0x212529, 0xe8590c, 0x7048e8];
    for (const [x, z, ry] of [[-44, -30.4, 0.3], [-19, -31, -0.2], [21, -30.6, 0.15], [39, -31.2, -0.35]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const parts = [];
      // towels, then the people on them: lying face-up (head toward the land), and one sitting at the front
      const towels = [[-0.55, 0.1], [0.05, 0.05], [0.65, 0.15]];
      towels.forEach(([tx, tz], i) => parts.push(box(0.5, 0.012, 1.0, tx, 0.006, tz, pick([0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xf783ac, 0xffffff]), (i - 1) * 0.08)));
      const lying = (px, pz) => {
        const sk = pick(SKIN), su = pick(SUIT);
        parts.push(box(0.2, 0.08, 0.3, px, 0.05, pz + 0.05, su));                     // torso / swimsuit
        parts.push(tint(new THREE.SphereGeometry(0.07, 8, 6).translate(px, 0.07, pz + 0.28), sk));   // head
        parts.push(box(0.17, 0.06, 0.36, px, 0.04, pz - 0.28, sk));                    // legs
        for (const sd of [-1, 1]) parts.push(box(0.05, 0.045, 0.28, px + sd * 0.13, 0.035, pz + 0.04, sk));   // arms at the sides
      };
      lying(-0.55, 0.1); lying(0.65, 0.15);
      // the sitter: legs out toward the sea, the upper body in its own group so it can nod to the music
      const sk = pick(SKIN), su = pick(SUIT);
      parts.push(box(0.2, 0.08, 0.16, 0.05, 0.05, 0.25, su), box(0.17, 0.06, 0.34, 0.05, 0.035, 0.0, sk));
      const upper = new THREE.Group(); upper.position.set(0.05, 0.09, 0.28);
      const up = new THREE.Mesh(mergeGeometries([box(0.2, 0.26, 0.12, 0, 0.13, 0, su), tint(new THREE.SphereGeometry(0.07, 8, 6).translate(0, 0.33, 0), sk),
        box(0.05, 0.22, 0.05, -0.13, 0.12, -0.03, sk), box(0.05, 0.22, 0.05, 0.13, 0.12, -0.03, sk)]), this.lambert);
      upper.add(up); g.add(upper);
      // the speaker at the back of the towels, facing the sea; a cooler beside it
      const sx = 0.05, sz = 0.85;
      parts.push(box(0.34, 0.5, 0.26, sx, 0.25, sz, 0x1b1d21), box(0.36, 0.04, 0.28, sx, 0.52, sz, 0x2b2e33));
      for (const wy of [0.15, 0.36]) parts.push(tint(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14).rotateX(Math.PI / 2).translate(sx, wy, sz - 0.135), 0x3a3d42));
      parts.push(box(0.4, 0.26, 0.26, 0.6, 0.13, 0.85, 0x1971c2), box(0.42, 0.05, 0.28, 0.6, 0.285, 0.85, 0xf8f9fa));
      const body = new THREE.Mesh(mergeGeometries(parts), this.lambert); body.castShadow = true; body.receiveShadow = true; g.add(body);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3fa4 });
      const ring = new THREE.Mesh(mergeGeometries([0.15, 0.36].map((wy) => new THREE.TorusGeometry(0.1, 0.014, 6, 18).translate(sx, wy, sz - 0.15))), ringMat);
      g.add(ring);
      scene.add(g);
      this.spk.push({ g, upper, ringMat, x, z, alive: true, ph: rand(0, 6), hue: rand(0, 1) });
    }
    this.radioSpots = this.spk.map((s) => ({ x: s.x, z: s.z, s }));
  }

  onBlast(x, y, z, radius) {
    for (const s of this.spk || []) {
      if (!s.alive || Math.hypot(s.x - x, s.z - z) > radius * 0.8 + 1) continue;
      s.alive = false; s.g.visible = false;
      G.fx && G.fx.sparks(s.x, 0.4, s.z, 10, 3, 2, 1.2, 5);   // the speaker shorts out
      beachRadio.remove(this.radioSpots.find((r) => r.s === s));
    }
  }

  // ---------- the fishing fleet: pangas pulled up on the west beach, boats offshore with lines out ----------
  fishing(scene) {
    const shore = this.city.shore ?? -36, P = [];
    for (let k = 0; k < 9; k++) {
      const x = rand(-108, -72), z = shore + rand(5, 9), c = pick([0x2a9d8f, 0xe6394a, 0xf2f2ee, 0x1f63b8, 0xf2c230]), yaw = rand(-0.4, 0.4) + Math.PI / 2;
      P.push(tint(new THREE.BoxGeometry(0.5, 0.22, 1.9).rotateY(yaw).translate(x, 0.11, z), c), tint(new THREE.BoxGeometry(0.4, 0.05, 1.7).rotateY(yaw).translate(x, 0.2, z), 0x6b4a2e));
    }
    for (let k = 0; k < 5; k++) { const x = rand(-104, -76), z = shore + rand(10, 13); P.push(box(1.2, 0.02, 0.9, x, 0.02, z, 0x6b6f76)); }    // nets drying
    const m = new THREE.Mesh(mergeGeometries(P), this.lambert); m.castShadow = true; scene.add(m);
    // boats out on the water: hull, a fisherman, a rod and a line; now and then a fish comes up
    const skin = [0x8d5524, 0xc68642, 0x6b3e1f];
    this.boats = [];
    for (let k = 0; k < 7; k++) {
      const g = new THREE.Group(), c = pick([0x2a9d8f, 0xe6394a, 0xf2f2ee, 0x1f63b8]);
      g.add(new THREE.Mesh(mergeGeometries([tint(new THREE.BoxGeometry(0.55, 0.22, 2).translate(0, 0.05, 0), c), tint(new THREE.BoxGeometry(0.45, 0.04, 1.8).translate(0, 0.16, 0), 0x6b4a2e), tint(new THREE.ConeGeometry(0.28, 0.5, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4).scale(1, 0.45, 1).translate(0, 0.05, 1.2), c)]), this.lambert));
      const man = new THREE.Mesh(mergeGeometries([tint(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 6).translate(0, 0.35, 0), pick([0xe8e4dc, 0x3565a8, 0xd8262a])), tint(new THREE.SphereGeometry(0.045, 7, 5).translate(0, 0.51, 0), pick(skin)), tint(new THREE.SphereGeometry(0.07, 7, 4, 0, 6.28, 0, 1.4).scale(1, 0.4, 1).translate(0, 0.55, 0), 0xe8dcb0)]), this.lambert);
      man.position.set(0, 0.12, -0.45); g.add(man);
      const rod = new THREE.Group(); rod.position.set(0.1, 0.55, -0.35); g.add(rod);
      rod.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 1.1, 4).translate(0, 0.55, 0), new THREE.MeshLambertMaterial({ color: 0x2b2b2b })));
      rod.rotation.set(-0.9, 0, -0.6);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.8 }));
      scene.add(line);
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4).scale(0.6, 0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xc8d4dc, metalness: 0.7, roughness: 0.3 }));
      fish.visible = false; scene.add(fish);
      const b = { g, rod, line, fish, x: rand(-118, -58), z: shore - rand(14, 34), h: rand(0, 6.28), ph: rand(0, 6), t: rand(6, 16), pull: 0 };
      g.position.set(b.x, 0, b.z); scene.add(g);
      this.boats.push(b);
    }
  }

  update(dt) {
    const T = G.camTarget, t = G.time, n = G.night || 0;
    // the beach speakers: start the music once audio is up, ring lights cycle and pulse, the sitters nod along
    if (!this.radioOn && this.radioSpots && this.radioSpots.length) { beachRadio.start(this.radioSpots); this.radioOn = !!beachRadio.out; }
    beachRadio.update();
    const playing = beachRadio.on;
    for (const s of this.spk || []) {
      if (!s.alive) continue;
      const pulse = playing ? 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 1.9 + s.ph)) : 0.15;
      s.ringMat.color.setHSL((s.hue + t * 0.05) % 1, 0.9, 0.5).multiplyScalar(pulse * (1 + n * 1.5));
      s.upper.rotation.x = playing ? Math.sin(t * Math.PI * 1.9 + s.ph) * 0.12 - 0.05 : -0.05;
    }
    this.statueMesh.material.emissiveIntensity = n * 0.35;
    this.floods.material.color.setScalar(0.4 + n * 3);
    for (const m of this.signMats) m.emissiveIntensity = 0.25 + n * 1.1;
    // griddle smoke near the camera
    for (const s of this.smoke) if (Math.random() < dt * 1.5 && Math.hypot(s.x - T.x, s.z - T.z) < 60) G.fx.smokePuff(s.x, 0.6, s.z, 0.3, 0.02);
    for (const b of this.boats) {
      // drift slowly, ride the swell
      b.h += Math.sin(t * 0.05 + b.ph) * dt * 0.05;
      b.x += Math.sin(b.h) * dt * 0.12; b.z += Math.cos(b.h) * dt * 0.12;
      b.z = clamp(b.z, -95, (this.city.shore ?? -36) - 10); b.x = clamp(b.x, -130, -50);
      b.g.position.set(b.x, Math.sin(t * 1.3 + b.ph) * 0.04 - 0.02, b.z);
      b.g.rotation.set(Math.sin(t * 1.1 + b.ph) * 0.05, b.h, Math.sin(t * 0.9 + b.ph) * 0.06);
      // the catch: the rod lifts, a fish comes out of the water on the line and into the boat
      if ((b.t -= dt) <= 0 && !b.pull) { b.pull = 0.001; b.t = rand(10, 24); }
      if (b.pull) b.pull = Math.min(2.2, b.pull + dt);
      const k = b.pull ? Math.min(1, b.pull / 0.8) : 0;
      b.rod.rotation.x = -0.9 + k * 0.8 + Math.sin(t * 2 + b.ph) * 0.03;
      b.g.updateMatrixWorld();
      const tip = _p.set(0, 1.1, 0).applyMatrix4(b.rod.matrixWorld);
      const wx = b.x + Math.sin(b.h) * -2.2 + Math.cos(b.h) * 0.6, wz = b.z + Math.cos(b.h) * -2.2 - Math.sin(b.h) * 0.6;
      let ex = wx, ey = 0, ez = wz;
      if (b.pull) {
        const u = clamp((b.pull - 0.4) / 1.2, 0, 1);
        ex = wx + (tip.x - wx) * u; ez = wz + (tip.z - wz) * u; ey = Math.sin(Math.PI * u) * 0.9 + u * (tip.y - 0.3);
        b.fish.visible = b.pull > 0.4; b.fish.position.set(ex, ey - 0.08, ez); b.fish.rotation.set(Math.sin(t * 20) * 0.6, b.h, 0);
        if (b.pull > 0.4 && b.pull < 0.45 && Math.hypot(b.x - T.x, b.z - T.z) < 90) G.fx.bits && G.fx.bits.emit(wx, 0.05, wz, 0, 1.2, 0, 0.1, 0.5, 0.9, 0.95, 1, 6);
        if (b.pull >= 2.2) { b.pull = 0; b.fish.visible = false; }
      }
      const a = b.line.geometry.attributes.position.array;
      a[0] = tip.x; a[1] = tip.y; a[2] = tip.z; a[3] = ex; a[4] = ey; a[5] = ez;
      b.line.geometry.attributes.position.needsUpdate = true;
    }
  }
}
const _v = new THREE.Vector3();

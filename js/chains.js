// Fast-food chains that belong to their city: In-N-Out Burger around the Gaslamp (white stucco, a red-tiled tower
// with the yellow arrow, red awnings and stripes, palms and a pole sign over the lot) and Raising Cane's around
// Chicago (a brick box with a white entrance tower carrying the red oval, a red glass slot, and a dark patio canopy
// with ONE LOVE on top). The buildings are ordinary destructible ones; all the dressing rides on their cells and
// goes when the wall it hangs on is destroyed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand } from './core.js';

const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a hipped roof over w x d, base at y = 0
function hipRoof(w, d, h) {
  const alongZ = d >= w, rl = Math.max(w, d) / 2 - Math.min(w, d) / 2;
  const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
  const r1 = alongZ ? [0, h, -rl] : [-rl, h, 0], r2 = alongZ ? [0, h, rl] : [rl, h, 0];
  const tris = alongZ ? [[A, r1, B], [C, r2, D], [B, r1, r2], [B, r2, C], [D, r2, r1], [D, r1, A]] : [[D, r1, A], [B, r2, C], [A, r1, r2], [A, r2, B], [C, r2, r1], [C, r1, D]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- map build: the lots
// In-N-Out on a whole Gaslamp block: the drive-thru lane behind, the store, a patio, the parking lot out front
export function innOutLot(ctx, b) {
  const { city, B, g } = ctx, cx = (b.lx0 + b.lx1) / 2;
  g.rect(b.lx0 - 0.6, b.lz0 - 0.6, b.lx1 + 0.6, b.lz1 + 0.6, '#5a5b5e');
  g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.2, 30);
  // the drive-thru lane wraps round the back, with yellow arrows painted on it
  g.rect(b.lx0, b.lz0, b.lx1, b.lz0 + 1.7, '#4c4d50');
  for (let x = b.lx0 + 2; x < b.lx1 - 1; x += 3.5) { g.line(x, b.lz0 + 0.85, x + 1, b.lz0 + 0.85, 0.12, '#e6c229'); g.line(x + 1, b.lz0 + 0.85, x + 0.7, b.lz0 + 0.6, 0.12, '#e6c229'); g.line(x + 1, b.lz0 + 0.85, x + 0.7, b.lz0 + 1.1, 0.12, '#e6c229'); }
  const z0 = b.lz0 + 2, d = 3.4, wing = 3.0, tw = 2.4, zc = z0 + d / 2;
  // white walkway and patio across the front
  g.rect(cx - 5.2, z0 + d, cx + 5.2, z0 + d + 1.6, '#cfcac0');
  g.rect(cx - 5.2, z0 + d + 1.6, cx + 5.2, z0 + d + 1.75, '#e0c23a');                       // yellow kerb
  const white = hsl(0.1, 0.06, 0.93);
  const L = B.add({ x: cx - tw / 2 - wing / 2, z: zc, w: wing, d, floors: 1, style: 'stucco', tint: white, cell: 1.5, gh: 1.9, storefront: false });
  const T = B.add({ x: cx, z: zc + 0.1, w: tw, d: d + 0.2, floors: 1, style: 'stucco', tint: white, cell: 1.2, gh: 2.7, storefront: false });
  const R = B.add({ x: cx + tw / 2 + wing / 2, z: zc, w: wing, d, floors: 1, style: 'stucco', tint: white, cell: 1.5, gh: 1.9, storefront: false });
  for (const p of [L, T, R]) p.noSigns = true;
  // the lot: two rows of stalls with the aisle between
  const spots = city.paintParking(g, b.lx0 + 0.3, z0 + d + 2.1, b.lx1 - 0.3, b.lz1 - 0.2);
  const pyl = { x: b.lx1 - 0.6, z: b.lz1 - 0.5 };
  for (const s of spots) if (Math.random() < 0.55 && Math.hypot(s.x - pyl.x, s.z - pyl.z) > 1.6) city.parked.push(s);
  for (const [x, z] of [[b.lx0 + 0.7, z0 + 0.6], [b.lx1 - 0.7, z0 + 0.6], [b.lx0 + 0.7, z0 + d - 0.2], [b.lx1 - 0.7, z0 + d - 0.2], [b.lx0 + 0.7, b.lz1 - 0.5], [b.lx1 - 2.2, b.lz1 - 0.5]]) city.addTree(x, z, 1.05, 'palm');
  city.wanderZones.push({ x0: cx - 5, x1: cx + 5, z0: z0 + d + 0.2, z1: z0 + d + 1.4 });
  (city.crowds ||= []).push({ x: cx - 0.3, z: z0 + d + 0.7, r: 0.5, n: 3 }, { x: cx + 3.6, z: z0 + d + 0.8, r: 0.5, n: 2 });
  (city.chains ||= []).push({ kind: 'innout', parts: { L, T, R }, x: cx, z0, d, front: z0 + d, lot: b, pylon: pyl });
}

// Raising Cane's on the south half of a Chicago block (the flats stay on the north half, across the alley)
export function canesLot(ctx, b, alleyW) {
  const { city, B, g } = ctx, cz = (b.lz0 + b.lz1) / 2, top = cz + alleyW / 2 + 0.3;
  g.rect(b.lx0, top, b.lx1, b.lz1, '#5b5b59');
  g.grainRect(b.lx0, top, b.lx1, b.lz1, 0.25, 30);
  const x0 = b.lx0 + 1.5, d = 4.6, z0 = top + 0.6, zc = z0 + d / 2, front = z0 + d;
  const tw = 2.6, bw = 6.4, pw = 4.6;
  // the white entrance tower, the brick dining room, and the patio beside it
  const Tw = B.add({ x: x0 + tw / 2, z: zc + 0.1, w: tw, d: d + 0.2, floors: 1, style: 'stucco', tint: hsl(0.1, 0.05, 0.92), cell: 1.3, gh: 3.0, storefront: false });
  const Br = B.add({ x: x0 + tw + bw / 2, z: zc, w: bw, d, floors: 1, style: 'brick', tint: hsl(0.045, 0.45, 0.47), cell: 1.6, gh: 2.2, storefront: false });
  for (const p of [Tw, Br]) p.noSigns = true;
  const px = x0 + tw + bw + pw / 2;
  g.rect(x0 - 0.4, front, px + pw / 2 + 0.3, front + 1.4, '#c9c4ba');                       // walk along the front
  g.rect(px - pw / 2, z0 + 0.4, px + pw / 2, front, '#b8b2a6');                              // patio slab
  for (const [dx, dz] of [[-pw / 2 + 0.15, 0.55], [pw / 2 - 0.15, 0.55], [-pw / 2 + 0.15, d - 0.15], [pw / 2 - 0.15, d - 0.15]]) city.obstacles.push({ x: px + dx, z: z0 + dz, r: 0.2 });
  // parking: the stalls fill the rest of the lot to the east, and a row along the street
  const spots = city.paintParking(g, px + pw / 2 + 1.2, top + 0.3, b.lx1 - 0.3, b.lz1 - 0.3);
  for (const s of spots) if (Math.random() < 0.55) city.parked.push(s);
  const front2 = city.paintParking(g, b.lx0 + 0.3, front + 1.7, px + pw / 2 + 0.6, b.lz1 - 0.3);
  for (const s of front2) if (Math.random() < 0.45) city.parked.push(s);
  city.wanderZones.push({ x0: x0, x1: px + pw / 2, z0: front + 0.2, z1: front + 1.2 });
  (city.crowds ||= []).push({ x: px, z: z0 + d / 2, r: 0.8, n: 4 }, { x: x0 + 1.2, z: front + 0.7, r: 0.5, n: 2 });
  (city.chains ||= []).push({ kind: 'canes', parts: { Tw, Br }, x0, z0, d, front, tw, bw, pw, px });
}

// ---------------------------------------------------------------- dressing
const RED = 0xc8202b, YEL = 0xf2c41b, GLASS = 0x22303a, TILE = 0xa8492c, DARK = 0x2a2c30;

export class Chains {
  constructor(scene, city) {
    this.scene = scene; this.city = city; this.signMats = [];
    const lit = (map, k = 0.3) => { const m = new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.05, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: k, roughness: 0.5 }); this.signMats.push(m); return m; };
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    this.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.6 });
    for (const c of city.chains || []) {
      if (c.kind === 'innout') { this.innOutMat ||= lit(this.innOutTex()); this.innOut(c); }
      else { this.canesMat ||= lit(this.canesTex(), 0.35); this.loveMat ||= lit(this.loveTex(), 0.5); this.canes(c); }
    }
  }
  // geometry goes on the nearest ground cell of the building it hangs on (vanishes when that cell is destroyed)
  hang(b, geos, mat) {
    const by = new Map();
    for (const geo of geos) {
      geo.computeBoundingBox(); const ctr = geo.boundingBox.getCenter(new THREE.Vector3());
      let best = null, bd = 1e9;
      for (const c of b.cells) { const dd = Math.hypot(c.x - ctr.x, c.z - ctr.z) + c.f * 10; if (dd < bd) { bd = dd; best = c; } }
      if (!by.has(best)) by.set(best, []);
      by.get(best).push(geo);
    }
    for (const [c, list] of by) {
      const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
      (c.props ||= []).push({ obj: [m], x: c.x, y: c.y + c.hy, z: c.z });
    }
  }
  sign(b, mat, w, h, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m);
    let best = b.cells[0]; for (const c of b.cells) if (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z)) best = c;
    (best.props ||= []).push({ obj: [m], x: best.x, y: best.y, z: best.z });
    return m;
  }

  innOut(c) {
    const { L, T, R } = c.parts, f = c.front, f2 = f + 0.2;
    for (const W of [L, R]) {
      const x = W.x, w = W.w, G0 = [], Gl = [];
      // windows across the front, a red band with a yellow pinstripe under them, and a striped awning over them
      Gl.push(box(w - 0.5, 0.75, 0.05, x, 0.95, f + 0.03, GLASS));
      for (let u = -w / 2 + 0.25 + (w - 0.5) / 3; u < w / 2 - 0.3; u += (w - 0.5) / 3) G0.push(box(0.06, 0.75, 0.07, x + u, 0.95, f + 0.04, 0xf2f2f2));
      G0.push(box(w, 0.16, 0.06, x, 0.42, f + 0.03, RED), box(w, 0.04, 0.065, x, 0.33, f + 0.035, YEL));
      const awn = new THREE.BoxGeometry(w - 0.3, 0.05, 0.7).rotateX(0.45).translate(x, 1.53, f + 0.32); G0.push(tint(awn, RED));
      G0.push(box(w - 0.3, 0.2, 0.04, x, 1.33, f + 0.66, RED), box(w - 0.3, 0.05, 0.045, x, 1.21, f + 0.665, 0xf4f4f4));
      // white coping along the parapet, red band round the side
      G0.push(box(w + 0.08, 0.1, c.d + 0.08, x, 1.95, W.z, 0xf6f4ef));
      for (const s of [-1, 1]) G0.push(box(0.06, 0.16, c.d, x + s * (w / 2 + 0.02), 0.42, W.z, RED));
      this.hang(W, G0, this.mat); this.hang(W, Gl, this.glass);
    }
    // the tower: glass doors, red trim, a terracotta hipped roof and the logo
    const x = T.x, G0 = [], Gl = [];
    Gl.push(box(1.3, 1.05, 0.05, x, 0.55, f2 + 0.03, GLASS));
    G0.push(box(0.06, 1.05, 0.07, x, 0.55, f2 + 0.04, 0xd9d9d9), box(1.45, 0.08, 0.08, x, 1.1, f2 + 0.04, 0xd9d9d9));
    G0.push(box(T.w + 0.02, 0.12, 0.06, x, 2.55, f2 + 0.03, RED), box(T.w + 0.02, 0.12, 0.06, x, 0.42, f2 + 0.03, RED));
    G0.push(box(T.w + 0.2, 0.08, T.d + 0.2, x, 2.72, T.z, 0xf6f4ef));
    G0.push(tint(hipRoof(T.w + 0.5, T.d + 0.5, 0.95).translate(x, 2.76, T.z), TILE));
    // a little tiled cap on the back corners, like the real ones
    for (const W of [L, R]) G0.push(tint(hipRoof(1.2, 1.2, 0.45).translate(W.x + Math.sign(W.x - x) * (W.w / 2 - 0.6), 2.0, c.z0 + 0.6), TILE));
    this.hang(T, G0, this.mat); this.hang(T, Gl, this.glass);
    this.sign(T, this.innOutMat, 2.1, 1.05, x, 1.85, f2 + 0.07);
    // picnic tables on the patio
    const P = [];
    for (const dx of [-3.4, -2, 2, 3.4]) {
      const tx = c.x + dx, tz = f + 0.85;
      P.push(box(0.7, 0.05, 0.38, tx, 0.42, tz, 0x8b6a45), box(0.7, 0.04, 0.12, tx, 0.25, tz - 0.32, 0x8b6a45), box(0.7, 0.04, 0.12, tx, 0.25, tz + 0.32, 0x8b6a45));
      for (const s of [-1, 1]) P.push(box(0.05, 0.42, 0.6, tx + s * 0.28, 0.21, tz, 0x5d5f63));
      this.city.obstacles.push({ x: tx, z: tz, r: 0.4 });
    }
    // the pole sign over the lot: a tall post and the arrow sign, both faces
    const { x: sx, z: sz } = c.pylon;
    P.push(box(0.16, 4.6, 0.16, sx, 2.3, sz, 0xd8d8d4), box(2.2, 0.08, 0.4, sx, 4.62, sz, RED), box(2.2, 0.08, 0.4, sx, 3.48, sz, RED));
    this.city.obstacles.push({ x: sx, z: sz, r: 0.25 });
    const pm = new THREE.Mesh(mergeGeometries(P), this.mat); pm.castShadow = true; this.scene.add(pm);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.06, 0.3).translate(sx, 4.05, sz), new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.6 }));
    back.castShadow = true; this.scene.add(back);
    for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 1.0), this.innOutMat); m.position.set(sx, 4.05, sz + s * 0.16); if (s < 0) m.rotation.y = Math.PI; this.scene.add(m); }
  }

  canes(c) {
    const { Tw, Br } = c.parts, f = c.front, G0 = [], Gl = [];
    // tower: dark coping, glass door with a dark frame, address plate, the red glass slot beside it
    const tx = Tw.x, ff = f + 0.2;
    G0.push(box(Tw.w + 0.16, 0.18, Tw.d + 0.16, tx, 3.06, Tw.z, 0x3a3c40));
    G0.push(box(1.0, 1.25, 0.08, tx, 0.63, ff + 0.03, 0x1e2024), box(1.25, 0.18, 0.12, tx, 1.38, ff + 0.06, 0x2a2c30));
    this.hang(Tw, G0.splice(0), this.mat);
    const redGlass = tint(new THREE.BoxGeometry(0.75, 2.5, 0.08).translate(Tw.x + Tw.w / 2 + 0.38, 1.25, f + 0.05), 0xd2232a);
    // dining room: a white band up top, big dark windows, planters along the front
    const bx = Br.x;
    G0.push(box(Br.w + 0.06, 0.32, Br.d + 0.06, bx, 2.08, Br.z, 0xe9e6df), box(Br.w + 0.12, 0.07, Br.d + 0.12, bx, 2.26, Br.z, 0x3a3c40));
    Gl.push(box(Br.w - 1.9, 1.1, 0.05, bx + 0.6, 0.95, f + 0.03, GLASS), redGlass);
    for (let k = 0; k <= 3; k++) G0.push(box(0.07, 1.1, 0.07, bx + 0.6 - (Br.w - 1.9) / 2 + k * (Br.w - 1.9) / 3, 0.95, f + 0.05, 0x1e2024));
    for (let u = -Br.w / 2 + 0.6; u < Br.w / 2; u += 0.9) G0.push(tint(new THREE.SphereGeometry(0.28, 8, 6).scale(1, 0.75, 1).translate(bx + u, 0.25, f + 0.45), u % 1.8 < 0.9 ? 0x3f7a35 : 0x5b8e3e), box(0.5, 0.1, 0.45, bx + u, 0.05, f + 0.45, 0x8e8a80));
    this.hang(Br, G0, this.mat); this.hang(Br, Gl, this.glass);
    this.hang(Tw, [box(0.8, 1.1, 0.05, tx, 0.56, ff + 0.08, 0x2c3a44)], this.glass);
    this.sign(Tw, this.canesMat, 2.4, 1.5, tx, 2.15, ff + 0.08);
    // the patio: four black posts, a dark flat canopy with a blue underside, string lights, a wooden rail, ONE LOVE on top
    const px = c.px, pw = c.pw, z0 = c.z0, P = [], pz = z0 + 0.4 + c.d / 2 - 0.2, pd = c.d - 0.2;
    for (const [dx, dz] of [[-pw / 2 + 0.15, -pd / 2 + 0.15], [pw / 2 - 0.15, -pd / 2 + 0.15], [-pw / 2 + 0.15, pd / 2 - 0.15], [pw / 2 - 0.15, pd / 2 - 0.15]]) P.push(box(0.14, 2.3, 0.14, px + dx, 1.15, pz + dz, DARK));
    P.push(box(pw + 0.3, 0.22, pd + 0.3, px, 2.38, pz, DARK), box(pw, 0.03, pd, px, 2.26, pz, 0x2b4fa0));
    P.push(box(pw - 0.3, 0.06, 0.06, px, 0.62, pz + pd / 2 - 0.15, 0x9a6b3f), box(0.06, 0.06, pd - 0.3, px + pw / 2 - 0.15, 0.62, pz, 0x9a6b3f));
    for (let u = -pw / 2 + 0.4; u < pw / 2; u += 0.8) for (const s of [-1, 1]) P.push(box(0.05, 0.62, 0.05, px + u, 0.31, pz + s * (pd / 2 - 0.15), 0x9a6b3f));
    for (let u = -pw / 2 + 0.5; u < pw / 2; u += 1.0) P.push(box(0.5, 0.42, 0.5, px + u, 0.21, pz, 0x6b5a48));                 // tables
    P.push(box(0.1, 0.55, 0.1, px - 1.2, 2.75, pz + pd / 2, DARK), box(0.1, 0.55, 0.1, px + 1.2, 2.75, pz + pd / 2, DARK));
    const pm = new THREE.Mesh(mergeGeometries(P), this.mat); pm.castShadow = true; pm.receiveShadow = true; this.scene.add(pm);
    const bulbs = [];
    for (let u = -pw / 2 + 0.3; u < pw / 2 - 0.2; u += 0.35) bulbs.push(new THREE.SphereGeometry(0.035, 5, 4).translate(px + u, 2.12 - Math.sin((u + pw / 2) / pw * Math.PI) * 0.12, pz + pd / 2 - 0.3));
    this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    this.scene.add(new THREE.Mesh(mergeGeometries(bulbs), this.bulbMat));
    for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.62), this.loveMat); m.position.set(px, 2.88, pz + pd / 2 + s * 0.02); if (s < 0) m.rotation.y = Math.PI; this.scene.add(m); }
  }

  update() {
    const n = G.night || 0;
    for (const m of this.signMats) m.emissiveIntensity = 0.3 + n * 1.0;
  }

  // ---------------- logos (drawn, not images)
  innOutTex() {
    return canvasTex(512, 256, (x, w, h) => {
      // the yellow boomerang arrow sweeping over the name and pointing down at the end
      x.fillStyle = '#f5c518'; x.strokeStyle = '#b8860b'; x.lineWidth = 3;
      x.beginPath();
      x.moveTo(70, 70); x.quadraticCurveTo(110, 40, 200, 42); x.lineTo(360, 42); x.lineTo(360, 22); x.lineTo(432, 70); x.lineTo(360, 118); x.lineTo(360, 96);
      x.lineTo(205, 96); x.quadraticCurveTo(130, 96, 70, 70); x.closePath(); x.fill(); x.stroke();
      x.font = '900 92px "Arial Black", Impact, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.lineWidth = 10; x.strokeStyle = '#ffffff'; x.strokeText('IN-N-OUT', w / 2, 178);
      x.fillStyle = '#d2202a'; x.fillText('IN-N-OUT', w / 2, 178);
      x.font = '800 30px Arial, sans-serif'; x.fillStyle = '#d2202a'; x.fillText('BURGER', w / 2, 232);
    });
  }
  canesTex() {
    return canvasTex(512, 340, (x, w, h) => {
      const cx = w / 2, cy = 150;
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, cy, 236, 128, -0.06, 0, 6.283); x.fill();
      x.fillStyle = '#d2202a'; x.beginPath(); x.ellipse(cx, cy, 222, 114, -0.06, 0, 6.283); x.fill();
      x.strokeStyle = '#1a1a1a'; x.lineWidth = 4; x.beginPath(); x.ellipse(cx, cy, 236, 128, -0.06, 0, 6.283); x.stroke();
      x.save(); x.translate(cx, cy + 12); x.rotate(-0.08);
      x.font = 'italic 900 128px "Georgia", "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 12; x.strokeStyle = '#1a1a1a'; x.lineJoin = 'round'; x.strokeText("Cane's", 6, 0);
      x.fillStyle = '#ffffff'; x.fillText("Cane's", 6, 0);
      x.font = 'italic 800 40px Georgia, serif'; x.fillStyle = '#f5c518'; x.lineWidth = 6; x.strokeText('Raising', -110, -78); x.fillText('Raising', -110, -78);
      x.restore();
      // CHICKEN FINGERS on a yellow strip under the oval
      x.fillStyle = '#f5c518'; x.beginPath(); x.roundRect(cx - 150, 262, 300, 50, 10); x.fill();
      x.font = '900 34px "Arial Black", Arial, sans-serif'; x.fillStyle = '#d2202a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CHICKEN FINGERS', cx, 288);
    });
  }
  loveTex() {
    return canvasTex(512, 96, (x, w, h) => {
      x.font = '900 78px "Arial Black", Impact, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 8; x.strokeStyle = '#4a4d52'; x.lineJoin = 'round'; x.strokeText('ONE LOVE', w / 2, h / 2 + 4);
      x.fillStyle = '#f4f4f2'; x.fillText('ONE LOVE', w / 2, h / 2 + 4);
    });
  }
}

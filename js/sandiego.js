// San Diego landmarks for the Gaslamp map, placed where they stand in the real city (harbour to the west, Petco
// to the south-east):
//   One America Plaza   by the Santa Fe Depot at the trolley line: chamfered blue-glass tower, glass pyramid top
//   Emerald Plaza       next door on Broadway: a cluster of faceted dark-glass towers ringed in green neon hexagons
//   Manchester Grand Hyatt  on the Marina waterfront: cream twin towers on a podium, slate hipped crowns with ribs
// The towers are ordinary destructible buildings (their crowns ride on the top floor and fall with it).
// Across the bay the Coronado Bridge now lands on Coronado Island, a background-only landmass: North Island with
// its runways and a carrier alongside, the town grid, the golf course, the Coronado Shores towers, the Hotel del.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';

const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
// knock the corner columns out of every floor: square plans become chamfered (octagonal at this scale)
function chamfer(b) {
  const drop = new Set();
  b.grid.forEach((layer) => {
    const nx = layer.length, nz = layer[0].length;
    const alive = []; for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) if (layer[i][k]) alive.push([i, k]);
    if (alive.length < 5) return;
    const i0 = Math.min(...alive.map((a) => a[0])), i1 = Math.max(...alive.map((a) => a[0])), k0 = Math.min(...alive.map((a) => a[1])), k1 = Math.max(...alive.map((a) => a[1]));
    for (const [i, k] of [[i0, k0], [i0, k1], [i1, k0], [i1, k1]]) if (layer[i][k]) { drop.add(layer[i][k]); layer[i][k] = null; }
  });
  b.cells = b.cells.filter((c) => !drop.has(c));
}
// a hipped roof over a w x d rectangle (a ridge along the long side), base at y = 0
function hipRoof(w, d, h) {
  const alongZ = d >= w, rl = Math.max(w, d) / 2 - Math.min(w, d) / 2;
  const A = [-w / 2, 0, -d / 2], Bq = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
  const r1 = alongZ ? [0, h, -rl] : [-rl, h, 0], r2 = alongZ ? [0, h, rl] : [rl, h, 0];
  const tris = alongZ
    ? [[A, r1, Bq], [C, r2, D], [Bq, r1, r2], [Bq, r2, C], [D, r2, r1], [D, r1, A]]
    : [[D, r1, A], [Bq, r2, C], [A, r1, r2], [A, r2, Bq], [C, r2, r1], [C, r1, D]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
}
const inset = (b) => ({ x0: b.lx0, x1: b.lx1, z0: b.lz0, z1: b.lz1, cx: (b.lx0 + b.lx1) / 2, cz: (b.lz0 + b.lz1) / 2 });

// ---------- during the map build ----------
export function buildLandmarks(ctx, blocks) {
  const { city, B, g } = ctx, L = (city.landmarks = []), wash = (city.washTowers = []);
  // One America Plaza
  {
    const r = inset(blocks.oneAmerica);
    g.rect(r.x0 - 0.6, r.z0 - 0.6, r.x1 + 0.6, r.z1 + 0.6, '#b9b4aa');
    // short and stocky, like the real one
    const t = B.add({ x: r.cx + 1.5, z: r.cz, w: 10, d: 10, floors: 30, style: 'office', tint: hsl(0.58, 0.45, 0.6), cell: 1.6, fh: 1.0, gh: 2.2 });
    chamfer(t); t.noSigns = true; t.landmark = true;
    const lobby = B.add({ x: r.x0 + 1.8, z: r.cz, w: 2.8, d: 9, floors: 2, style: 'concrete', tint: hsl(0.1, 0.1, 0.9), cell: 1.5, gh: 1.8, fh: 1 }); lobby.noSigns = true;
    L.push({ kind: 'oneAmerica', b: t }); wash.push(t);
    for (let x = r.x0 + 1; x < r.x1; x += 3) city.addTree(x, r.z1 - 0.8, 0.9, 'palm');
  }
  // Emerald Plaza: six faceted towers of different heights, packed together
  {
    const r = inset(blocks.emerald);
    g.rect(r.x0 - 0.6, r.z0 - 0.6, r.x1 + 0.6, r.z1 + 0.6, '#aaa59b');
    const slots = [[-4.2, -3.6, 23], [0.6, -4.4, 19], [4.6, -1.2, 16], [-4.4, 1.6, 15], [0.4, 0.8, 21], [3.2, 4.4, 13]];
    const towers = slots.map(([dx, dz, fl]) => {
      const t = B.add({ x: r.cx + dx, z: r.cz + dz, w: 4.5, d: 4.5, floors: fl, style: 'office', tint: hsl(0.53, 0.35, 0.34), cell: 1.5, fh: 1.0, gh: 2 });
      chamfer(t); t.noSigns = true; t.landmark = true; return t;
    });
    L.push({ kind: 'emerald', towers });
  }
  // Manchester Grand Hyatt: two long, slim slab towers offset along the waterfront (the site spans two blocks,
  // the street between them closed), low podium wings between
  {
    const r = inset(blocks.hyatt);
    g.rect(r.x0 - 0.6, r.z0 - 0.6, r.x1 + 0.6, r.z1 + 0.6, '#c9c2b2');
    const cream = hsl(0.1, 0.32, 0.84);
    const a = B.add({ x: r.x0 + 3.2, z: r.z0 + 9, w: 4.6, d: 16, floors: 32, style: 'concrete', tint: cream, cell: 1.6, fh: 1.0, gh: 2.2 });
    const bT = B.add({ x: r.x1 - 3.6, z: r.z1 - 9.5, w: 4.6, d: 16, floors: 28, style: 'concrete', tint: cream, cell: 1.6, fh: 1.0, gh: 2.2 });
    for (const t of [a, bT]) { t.noSigns = true; t.landmark = true; wash.push(t); }
    for (const [x, z, w, d, fl] of [[r.x1 - 3.6, r.z0 + 6, 5.5, 9, 4], [r.x0 + 3.4, r.z1 - 6, 5, 9, 4], [r.cx, r.cz, 9, 4, 2]]) { const p = B.add({ x, z, w, d, floors: fl, style: 'concrete', tint: cream, cell: 1.6, fh: 1, gh: 2 }); p.noSigns = true; }
    L.push({ kind: 'hyatt', towers: [a, bT] });
    for (let x = r.x0; x < r.x1; x += 2.6) { city.addTree(x, r.z1 + 0.9, 1.05, 'palm'); city.addTree(x, r.z0 - 0.9, 1.05, 'palm'); }
  }
}

// ---------- scene dressing (after the buildings are finalised) ----------
function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c, ry = 0) => tint(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z), c);
// the top of a building: its footprint and roof height
function topOf(b) {
  const top = b.cells.filter((c) => c.f === b.floors - 1);
  let ax = 1e9, bx = -1e9, az = 1e9, bz = -1e9;
  for (const c of top) { ax = Math.min(ax, c.x - c.hx); bx = Math.max(bx, c.x + c.hx); az = Math.min(az, c.z - c.hz); bz = Math.max(bz, c.z + c.hz); }
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const mid = top.reduce((m, c) => (Math.hypot(c.x - cx, c.z - cz) < Math.hypot(m.x - cx, m.z - cz) ? c : m), top[0]);
  return { ax, bx, az, bz, cx, cz, y: top[0].y + top[0].hy, w: bx - ax, d: bz - az, mid };
}
// crowns ride on the top floor: they vanish (with debris) when it's destroyed
const attach = (t, objs) => { (t.mid.props ||= []).push({ obj: objs, x: t.cx, y: t.y + 2, z: t.cz }); };

export class SanDiego {
  constructor(scene, city) {
    this.city = city; this.neon = []; this.uplights = [];
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x7fb2d8, metalness: 0.85, roughness: 0.15, envMapIntensity: 1.4 });
    const slate = new THREE.MeshStandardMaterial({ color: 0x8a96a0, metalness: 0.55, roughness: 0.4, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: 0xeef0f0, roughness: 0.5 });
    this.neonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 0.45) });
    this.upMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.9, 0.55) });
    for (const L of city.landmarks || []) {
      if (L.kind === 'oneAmerica') {
        // the glass pyramid: four faces over the chamfered top, white ribs on the ridges, a mast
        const t = topOf(L.b), r = Math.max(t.w, t.d) * 0.72, h = 7;
        const pyr = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4, 1).rotateY(Math.PI / 4).translate(t.cx, t.y + h / 2, t.cz), glassMat);
        const ribs = [];
        for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const ex = t.cx + sx * t.w / 2, ez = t.cz + sz * t.d / 2, L2 = Math.hypot(t.w / 2, t.d / 2, h);
          const g = new THREE.BoxGeometry(0.12, L2, 0.12); g.translate(0, L2 / 2, 0);
          const dir = new THREE.Vector3(t.cx - ex, h, t.cz - ez).normalize();
          g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g.translate(ex, t.y, ez);
          ribs.push(g);
        }
        ribs.push(new THREE.CylinderGeometry(0.05, 0.08, 2.5, 6).translate(t.cx, t.y + h + 1.2, t.cz));
        const rm = new THREE.Mesh(mergeGeometries(ribs), white);
        for (const m of [pyr, rm]) { m.castShadow = true; scene.add(m); }
        attach(t, [pyr, rm]);
        this.uplights.push(this.floodRing(scene, t, 0.3));
      } else if (L.kind === 'emerald') {
        // green neon hexagons round the top of each tower, and a second ring part way down the tallest
        for (const b of L.towers) {
          const t = topOf(b), R = Math.max(t.w, t.d) * 0.62;
          const rings = [this.hexRing(t.cx, t.y + 0.05, t.cz, R)];
          const cap = tint(new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.5, 6).translate(t.cx, t.y + 0.25, t.cz), 0x1f2a36);
          if (b.floors > 32) rings.push(this.hexRing(t.cx, t.y - 9, t.cz, R + 0.15));
          const neon = new THREE.Mesh(mergeGeometries(rings), this.neonMat);
          const capM = new THREE.Mesh(cap, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }));
          scene.add(neon, capM); capM.castShadow = true;
          attach(t, [neon, capM]);
          this.neon.push(neon);
        }
      } else if (L.kind === 'hyatt') {
        // slate hipped roofs with rows of vertical fins, lit warm from below at night
        for (const b of L.towers) {
          const t = topOf(b), h = 4.5;
          const roof = new THREE.Mesh(hipRoof(t.w, t.d, h), slate);
          roof.position.set(t.cx, t.y, t.cz);
          const fins = [];
          for (const [len, along, fixed, sgn] of [[t.w, 'x', t.az, -1], [t.w, 'x', t.bz, 1], [t.d, 'z', t.ax, -1], [t.d, 'z', t.bx, 1]]) {
            for (let u = -len / 2 + 0.4; u <= len / 2 - 0.4; u += 0.8) {
              const fh = 2.6 * (1 - Math.abs(u) / (len / 2) * 0.55);
              const x = along === 'x' ? t.cx + u : fixed + sgn * 0.04, z = along === 'x' ? fixed + sgn * 0.04 : t.cz + u;
              fins.push(new THREE.BoxGeometry(0.08, fh, 0.08).translate(x, t.y + fh / 2, z));
            }
          }
          // a spike at each end of the ridge
          const o = Math.max(t.w, t.d) / 2 - Math.min(t.w, t.d) / 2;
          for (const s of [-1, 1]) fins.push(new THREE.CylinderGeometry(0.03, 0.09, 2.4, 6).translate(t.cx + (t.w > t.d ? s * o : 0), t.y + h + 1.1, t.cz + (t.w > t.d ? 0 : s * o)));
          const fm = new THREE.Mesh(mergeGeometries(fins), white);
          for (const m of [roof, fm]) { m.castShadow = true; scene.add(m); }
          attach(t, [roof, fm]);
          this.uplights.push(this.floodRing(scene, t, 0.35));
        }
      }
    }
    this.coronado(scene);
  }
  hexRing(x, y, z, R) {
    const segs = [];
    for (let k = 0; k < 6; k++) {
      const a0 = k * Math.PI / 3, a1 = (k + 1) * Math.PI / 3;
      const x0 = x + Math.cos(a0) * R, z0 = z + Math.sin(a0) * R, x1 = x + Math.cos(a1) * R, z1 = z + Math.sin(a1) * R, L = Math.hypot(x1 - x0, z1 - z0);
      segs.push(new THREE.BoxGeometry(L, 0.14, 0.14).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, y, (z0 + z1) / 2));
    }
    return mergeGeometries(segs);
  }
  // a warm strip of light along the top edge (the crowns are washed from below after dark)
  floodRing(scene, t, h) {
    const g = [];
    for (const [w, d, x, z] of [[t.w, 0.12, t.cx, t.az], [t.w, 0.12, t.cx, t.bz], [0.12, t.d, t.ax, t.cz], [0.12, t.d, t.bx, t.cz]]) g.push(new THREE.BoxGeometry(w, h, d).translate(x, t.y + h / 2, z));
    const m = new THREE.Mesh(mergeGeometries(g), this.upMat); scene.add(m);
    attach(t, [m]);
    return m;
  }

  // ---------- Coronado Island across the bay (scenery only) ----------
  coronado(scene) {
    // outline in world x/z: North Island to the north, the town to the south, the Silver Strand running on south
    const outline = [[-168, -92], [-160, -55], [-164, -20], [-170, 20], [-176, 46], [-194, 70], [-222, 86], [-250, 92], [-262, 110], [-268, 160], [-272, 240], [-280, 330],
      [-296, 330], [-290, 240], [-286, 160], [-282, 108], [-296, 80], [-306, 40], [-308, -5], [-298, -52], [-272, -96], [-232, -120], [-192, -116]];
    const X0 = -320, X1 = -150, Z0 = -130, Z1 = 340, S = 1024;
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = S; c.height = Math.round(S * (Z1 - Z0) / (X1 - X0));
      const x = c.getContext('2d'), k = S / (X1 - X0), px = (v) => (v - X0) * k, pz = (v) => (v - Z0) * k;
      x.fillStyle = '#d9cba8'; x.fillRect(0, 0, c.width, c.height);
      const path = () => { x.beginPath(); outline.forEach(([a, b], i) => (i ? x.lineTo(px(a), pz(b)) : x.moveTo(px(a), pz(b)))); x.closePath(); };
      path(); x.save(); x.clip();
      // the town: a street grid of small roofs and green yards
      x.fillStyle = '#8c8f78'; x.fillRect(px(-300), pz(-30), px(-165) - px(-300), pz(95) - pz(-30));
      for (let gx = -300; gx < -165; gx += 3.2) for (let gz = -28; gz < 92; gz += 3.2) { x.fillStyle = pick(['#b7a58e', '#c9b9a0', '#9aa88a', '#d6cdbd', '#a8745a', '#7f9a6a']); x.fillRect(px(gx) + 1, pz(gz) + 1, 3.2 * k - 3, 3.2 * k - 3); }
      x.strokeStyle = '#6f6f6a'; x.lineWidth = 1.4;
      for (let gx = -300; gx < -165; gx += 9.6) { x.beginPath(); x.moveTo(px(gx), pz(-30)); x.lineTo(px(gx), pz(95)); x.stroke(); }
      for (let gz = -30; gz < 95; gz += 9.6) { x.beginPath(); x.moveTo(px(-300), pz(gz)); x.lineTo(px(-165), pz(gz)); x.stroke(); }
      // Orange Avenue, the boulevard up the middle
      x.strokeStyle = '#5f5f5a'; x.lineWidth = 5; x.beginPath(); x.moveTo(px(-175), pz(40)); x.lineTo(px(-250), pz(88)); x.stroke();
      // the golf course by the bay, where the bridge comes down
      x.fillStyle = '#5f8f45'; x.beginPath(); x.ellipse(px(-192), pz(52), 16 * k, 22 * k, 0.5, 0, 6.3); x.fill();
      x.fillStyle = '#76a855'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(px(-192 + rand(-10, 10)), pz(52 + rand(-15, 15)), 2.6 * k, 6 * k, rand(0, 3), 0, 6.3); x.fill(); }
      // North Island naval air station: pale concrete, runways, hangars
      x.fillStyle = '#b5b2a8'; x.fillRect(px(-310), pz(-130), px(-160) - px(-310), pz(-30) - pz(-130));
      x.strokeStyle = '#5a5a58'; x.lineWidth = 7 * k;
      for (const [a, b, c2, d] of [[-296, -40, -196, -110], [-300, -70, -176, -70], [-270, -35, -240, -118]]) { x.beginPath(); x.moveTo(px(a), pz(b)); x.lineTo(px(c2), pz(d)); x.stroke(); }
      x.strokeStyle = '#f2f2ea'; x.lineWidth = 0.4 * k; x.setLineDash([3 * k, 3 * k]);
      for (const [a, b, c2, d] of [[-296, -40, -196, -110], [-300, -70, -176, -70]]) { x.beginPath(); x.moveTo(px(a), pz(b)); x.lineTo(px(c2), pz(d)); x.stroke(); }
      x.setLineDash([]);
      // the Silver Strand: sand, a road down its spine
      x.fillStyle = '#d9cba8'; x.fillRect(px(-300), pz(96), px(-250) - px(-300), pz(340) - pz(96));
      x.strokeStyle = '#6f6f6a'; x.lineWidth = 2; x.beginPath(); x.moveTo(px(-276), pz(104)); x.lineTo(px(-282), pz(335)); x.stroke();
      x.restore();
      // beaches round the edge
      path(); x.strokeStyle = '#e8dcbc'; x.lineWidth = 3.2 * k; x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      return t;
    })();
    const shape = new THREE.Shape(outline.map(([a, b]) => new THREE.Vector2(a, b)));
    const geo = new THREE.ShapeGeometry(shape, 8);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const a = pos.getX(i), b = pos.getY(i); uv.setXY(i, (a - X0) / (X1 - X0), 1 - (b - Z0) / (Z1 - Z0)); }
    geo.rotateX(Math.PI / 2);                                             // shape x/y → world x/z (y stays up)
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
    land.position.y = 0.22; land.receiveShadow = true; scene.add(land);
    // a little height: houses, trees, the Shores towers, the Hotel del, hangars, a carrier alongside
    const P = [];
    for (let n = 0; n < 900; n++) {
      const x = rand(-298, -170), z = rand(-26, 90);
      if (Math.hypot((x + 192) / 16, (z - 52) / 22) < 1) continue;           // golf course
      if (!this.onIsland(outline, x, z)) continue;
      P.push(box(rand(1.2, 2.2), rand(0.5, 1.3), rand(1.2, 2.2), x, 0.4, z, pick([0xe8e0d0, 0xd8c8b0, 0xc9a07a, 0xf2eee6, 0xb88a6a])));
    }
    for (let k = 0; k < 10; k++) { const x = -272 + (k % 5) * 5, z = 100 + Math.floor(k / 5) * 6; P.push(box(3.4, rand(10, 14), 3.4, x, 6, z, 0xeeeae2)); }     // the Coronado Shores
    const hx = -246, hz = 86;                                                                                                // the Hotel del Coronado
    P.push(box(14, 2.4, 5, hx, 1.2, hz, 0xf6f4ee), box(5, 2.4, 9, hx - 5, 1.2, hz - 5, 0xf6f4ee));
    P.push(tint(new THREE.ConeGeometry(2.4, 3.2, 8).translate(hx + 3, 3.9, hz), 0xc0442e), tint(new THREE.ConeGeometry(6, 1.6, 4).rotateY(Math.PI / 4).scale(1.4, 1, 0.5).translate(hx, 3.1, hz), 0xb8412c));
    for (let k = 0; k < 6; k++) P.push(box(9, 3, 7, -290 + k * 18, 1.5, -48 - (k % 2) * 30, 0xa8aaa6));                   // hangars
    // an aircraft carrier tied up on the North Island waterfront
    const cx = -176, cz = -58;
    P.push(box(5.5, 2.4, 30, cx, 1.1, cz, 0x6e757c), box(7.5, 0.3, 32, cx - 0.6, 2.45, cz, 0x5c6268), box(1.4, 3.2, 3, cx + 2.8, 4, cz + 3, 0x6e757c));
    const lm = new THREE.Mesh(mergeGeometries(P), new THREE.MeshLambertMaterial({ vertexColors: true }));
    lm.castShadow = true; lm.receiveShadow = true; scene.add(lm);
    const trees = [];
    for (let n = 0; n < 500 && trees.length < 320; n++) { const x = rand(-300, -168), z = rand(-26, 110); if (this.onIsland(outline, x, z)) trees.push([x, z]); }
    const tm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.9, 1).translate(0, 1, 0), new THREE.MeshLambertMaterial(), trees.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    trees.forEach(([x, z], i) => { const s = rand(0.8, 1.6); m4.makeScale(s, s, s).setPosition(x, 0, z); tm.setMatrixAt(i, m4); tm.setColorAt(i, c.setHSL(rand(0.22, 0.32), 0.4, rand(0.2, 0.3), THREE.SRGBColorSpace)); });
    tm.castShadow = true; scene.add(tm);
  }
  onIsland(poly, x, z) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }
  update() {
    const n = G.night || 0, t = G.time;
    // the neon hums brighter after dark; the crowns are washed in warm light at night
    this.neonMat.color.setRGB(0.15 + n * 0.5, 0.9 + n * 2.2 + Math.sin(t * 3) * 0.05, 0.3 + n * 0.7);
    this.upMat.color.setRGB(0.25 + n * 2.4, 0.2 + n * 1.8, 0.12 + n * 1.1);
  }
}

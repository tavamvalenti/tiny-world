// Shared kit for the maps that don't sit on a plain city grid (Las Vegas, London): a road network painted from the
// graph itself (only the streets that exist, each with its own width), sidewalks fitted to it, decor helpers that
// hang dressing on a building's cells (so it falls with them), and a little geometry toolbox.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from './core.js';
import { City, Ground } from './city.js';

export const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
export function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
export const box = (w, h, d, x, y, z, c, ry = 0) => tint(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z), c);
export const cyl = (r0, r1, h, x, y, z, c, seg = 12) => tint(new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z), c);
export const cone = (r, h, x, y, z, c, seg = 12) => tint(new THREE.ConeGeometry(r, h, seg).translate(x, y, z), c);
export const sph = (r, x, y, z, c, ws = 12, hs = 8) => tint(new THREE.SphereGeometry(r, ws, hs).translate(x, y, z), c);
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// a hipped roof over w x d, base at y = 0
export function hipRoof(w, d, h) {
  const alongZ = d >= w, rl = Math.max(w, d) / 2 - Math.min(w, d) / 2;
  const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
  const r1 = alongZ ? [0, h, -rl] : [-rl, h, 0], r2 = alongZ ? [0, h, rl] : [rl, h, 0];
  const tris = alongZ ? [[A, r1, B], [C, r2, D], [B, r1, r2], [B, r2, C], [D, r2, r1], [D, r1, A]] : [[D, r1, A], [B, r2, C], [A, r1, r2], [A, r2, B], [C, r2, r1], [C, r1, D]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
}
export function merged(geos, mat, scene, shadow = true) {
  const m = new THREE.Mesh(mergeGeometries(geos), mat);
  m.castShadow = shadow; m.receiveShadow = true; scene.add(m);
  return m;
}

// ---------- the network ----------
// o: City options (xs, zs, roadW, sw, half, extent, skipEdge, side...) plus base: ground colour
export function netCtx(o, B) {
  const city = new City(o);
  const g = new Ground(o.extent, o.res || 4096);
  g.rect(-o.extent, -o.extent, o.extent, o.extent, o.base || '#6e6b62');
  g.grainRect(-o.extent, -o.extent, o.extent, o.extent, 0.3, 40);
  city.allX = o.xs; city.allZ = o.zs;
  return { city, g, B };
}
// Paint every street that exists. width(x0,z0,x1,z1) -> road width for that edge (defaults to roadW); the road
// surface, junction boxes, centre lines, lane lines, stop lines (on the driving side) and zebra/ladder crossings.
export function paintNetwork(g, city, opt = {}) {
  const asphalt = opt.asphalt || '#4a4b4d', W = (A, B) => (opt.width ? opt.width(A, B) : city.roadW);
  const E = [...city.edges.values()].map((e) => [city.nodes[e.a], city.nodes[e.b]]);
  const node = new Map();
  for (const [A, B] of E) {
    const w = W(A, B), v = A.x === B.x;
    if (v) g.rect(A.x - w / 2, Math.min(A.z, B.z), A.x + w / 2, Math.max(A.z, B.z), asphalt);
    else g.rect(Math.min(A.x, B.x), A.z - w / 2, Math.max(A.x, B.x), A.z + w / 2, asphalt);
    for (const N of [A, B]) { const r = node.get(N.id) || { n: N, wx: 0, wz: 0 }; if (v) r.wx = Math.max(r.wx, w); else r.wz = Math.max(r.wz, w); node.set(N.id, r); }
  }
  // stubs that carry the streets on off the edge of the map
  for (const r of node.values()) {
    const N = r.n;
    for (const s of opt.stubs ? opt.stubs(N) : []) {
      const w = s.w || city.roadW;
      if (s.axis === 'x') g.rect(Math.min(N.x, s.to), N.z - w / 2, Math.max(N.x, s.to), N.z + w / 2, asphalt);
      else g.rect(N.x - w / 2, Math.min(N.z, s.to), N.x + w / 2, Math.max(N.z, s.to), asphalt);
    }
  }
  for (const r of node.values()) { const w = Math.max(r.wx || city.roadW, r.wz || city.roadW); g.rect(r.n.x - (r.wx || w) / 2, r.n.z - (r.wz || w) / 2, r.n.x + (r.wx || w) / 2, r.n.z + (r.wz || w) / 2, asphalt); }
  g.grainRect(-g.E, -g.E, g.E, g.E, 0.16, 30);
  const cl = opt.centerLine || 'yellow', white = 'rgba(238,238,232,.85)', yel = 'rgba(226,186,60,.9)', side = city.side || 1;
  for (const [A, B] of E) {
    const w = W(A, B), v = A.x === B.x, rA = node.get(A.id), rB = node.get(B.id);
    const padA = (v ? rA.wz : rA.wx) / 2 || 0, padB = (v ? rB.wz : rB.wx) / 2 || 0;
    const s = v ? Math.sign(B.z - A.z) : Math.sign(B.x - A.x);
    const a = (v ? A.z : A.x) + s * (padA + (opt.crossings === false ? 0.3 : 2.1)), b = (v ? B.z : B.x) - s * (padB + (opt.crossings === false ? 0.3 : 2.1));
    if ((b - a) * s <= 0.5) continue;
    const L = (o, style, lw, dash) => (v ? g.line(A.x + o, a, A.x + o, b, lw, style, dash) : g.line(a, A.z + o, b, A.z + o, lw, style, dash));
    const median = opt.median && opt.median(A, B);
    if (median) {
      // a raised, planted median down the middle of a boulevard
      if (v) { g.rect(A.x - median / 2, Math.min(a, b), A.x + median / 2, Math.max(a, b), '#b9b2a4'); g.rect(A.x - median / 2 + 0.15, Math.min(a, b) + 0.6, A.x + median / 2 - 0.15, Math.max(a, b) - 0.6, '#6b7a44'); }
      else { g.rect(Math.min(a, b), A.z - median / 2, Math.max(a, b), A.z + median / 2, '#b9b2a4'); g.rect(Math.min(a, b) + 0.6, A.z - median / 2 + 0.15, Math.max(a, b) - 0.6, A.z + median / 2 - 0.15, '#6b7a44'); }
    } else if (cl === 'yellow') { L(-0.08, yel, 0.07); L(0.08, yel, 0.07); } else if (cl === 'white') L(0, white, 0.1, [1.2, 1.2]);
    // lane lines on wide roads
    const lanes = Math.max(1, Math.floor((w / 2 - (median ? median / 2 : 0)) / 1.55));
    for (let k = 1; k < lanes; k++) for (const sg of [-1, 1]) L(sg * ((median ? median / 2 : 0) + k * (w / 2 - (median ? median / 2 : 0)) / lanes), white, 0.06, [0.9, 1.4]);
    if (opt.edgeLine) for (const sg of [-1, 1]) L(sg * (w / 2 - 0.2), opt.edgeLine, 0.08);
  }
  // crossings and stop lines at signalled junctions
  if (opt.crossings !== false) for (const [A, B] of E) for (const [P, Q] of [[A, B], [B, A]]) {
    const r = node.get(P.id); if (!P.lit) continue;
    const w = W(A, B), v = A.x === B.x, s = v ? Math.sign(Q.z - P.z) : Math.sign(Q.x - P.x), pad = (v ? r.wz : r.wx) / 2 || w / 2;
    const c0 = (v ? P.z : P.x) + s * pad;
    if (v) { for (let x = P.x - w / 2 + 0.3; x < P.x + w / 2 - 0.3; x += 0.55) g.rect(x, Math.min(c0 + s * 0.2, c0 + s * 1.6), x + 0.3, Math.max(c0 + s * 0.2, c0 + s * 1.6), 'rgba(236,236,230,.82)'); }
    else { for (let z = P.z - w / 2 + 0.3; z < P.z + w / 2 - 0.3; z += 0.55) g.rect(Math.min(c0 + s * 0.2, c0 + s * 1.6), z, Math.max(c0 + s * 0.2, c0 + s * 1.6), z + 0.3, 'rgba(236,236,230,.82)'); }
    // the stop line across the lanes coming in toward P (they drive on side `side` of the centre)
    const sl = c0 + s * 1.8, k = s * side * (w / 2 - 0.1);
    if (v) g.line(P.x, sl, P.x + k, sl, 0.14, white); else g.line(sl, P.z, sl, P.z - k, 0.14, white);
  }
}
// pedestrian corners and block edges pulled out of a wide road (the graph assumes roadW everywhere)
export function widenFor(city, axis, at, half) {
  for (const b of city.blocks) {
    if (axis === 'x') { if (Math.abs(b.x0 - at) < half + 1 && b.x0 > at) { b.x0 = at + half; b.lx0 = b.x0 + city.sw; } if (Math.abs(b.x1 - at) < half + 1 && b.x1 < at) { b.x1 = at - half; b.lx1 = b.x1 - city.sw; } }
    else { if (Math.abs(b.z0 - at) < half + 1 && b.z0 > at) { b.z0 = at + half; b.lz0 = b.z0 + city.sw; } if (Math.abs(b.z1 - at) < half + 1 && b.z1 < at) { b.z1 = at - half; b.lz1 = b.z1 - city.sw; } }
  }
  for (const n of city.pedNodes) {
    if (axis === 'x' && Math.abs(n.x - at) < half + 0.6) n.x = at + Math.sign(n.x - at || 1) * (half + 0.7);
    if (axis === 'z' && Math.abs(n.z - at) < half + 0.6) n.z = at + Math.sign(n.z - at || 1) * (half + 0.7);
  }
}

// ---------- dressing that rides on buildings ----------
// the top of a building: its extent and a middle cell to hang a crown on
export function topOf(b) {
  const top = b.cells.filter((c) => c.f === b.floors - 1);
  const xs = top.map((c) => c.x), zs = top.map((c) => c.z);
  const ax = Math.min(...xs) - top[0].hx, bx = Math.max(...xs) + top[0].hx, az = Math.min(...zs) - top[0].hz, bz = Math.max(...zs) + top[0].hz;
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const mid = top.reduce((m, c) => (Math.hypot(c.x - cx, c.z - cz) < Math.hypot(m.x - cx, m.z - cz) ? c : m), top[0]);
  return { ax, bx, az, bz, cx, cz, y: top[0].y + top[0].hy, w: bx - ax, d: bz - az, mid, top };
}
// objects vanish with the cell they're hung on (nearest cell to each object, preferring floor `f`)
export function hangOn(b, objs, f = null) {
  for (const o of objs) {
    const p = o.position.lengthSq() ? o.position : (o.geometry.computeBoundingBox(), o.geometry.boundingBox.getCenter(new THREE.Vector3()));
    let best = null, bd = 1e9;
    for (const c of b.cells) { const d = Math.hypot(c.x - p.x, (c.y - p.y) * 0.5, c.z - p.z) + (f != null && c.f !== f ? 50 : 0); if (d < bd) { bd = d; best = c; } }
    (best.props ||= []).push({ obj: [o], x: best.x, y: best.y, z: best.z });
  }
}
export function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export { rand };

// A smooth skin over a stepped building (glass pyramids, spires, the Gherkin's bullet): the surface is cut into small
// triangles and each one is hung on the building cell right behind it, so the skin breaks away with the building.
// tris: [[Vector3, Vector3, Vector3], ...]; color: vertex colour or (tri) => colour
export function skinOn(scene, b, tris, color, mat, uvf) {        // uvf(vertex) -> [u, v]: texture coordinates (optional)
  const byCell = new Map();
  for (const [p1, p2, p3] of tris) {
    const c = new THREE.Vector3().add(p1).add(p2).add(p3).multiplyScalar(1 / 3);
    let best = null, bd = 1e9;
    for (const cell of b.cells) { const d = Math.hypot(cell.x - c.x, (cell.y - c.y) * 1.5, cell.z - c.z); if (d < bd) { bd = d; best = cell; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([p1, p2, p3].flatMap((v) => [v.x, v.y, v.z]), 3)); g.computeVertexNormals();
    if (!byCell.has(best)) byCell.set(best, []);
    const tg = tint(g, typeof color === 'function' ? color(c) : color);
    if (uvf) tg.setAttribute('uv', new THREE.Float32BufferAttribute([p1, p2, p3].flatMap((v) => uvf(v, p1, p2, p3)), 2));
    byCell.get(best).push(tg);
  }
  for (const [cell, geos] of byCell) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; scene.add(m); (cell.props ||= []).push({ obj: [m], x: cell.x, y: cell.y, z: cell.z }); }
}
// Decoration that breaks with the stone behind it: each piece is tied to the nearest cell of the given building(s)
// and all of them are merged into one mesh (one draw call); when a cell goes, its pieces are cut out of the mesh.
// Split big shapes (a dome, a spire) into pieces first so they break up bit by bit.
export function cutoutOn(scene, builds, geos, mat) {
  const cells = (Array.isArray(builds) ? builds : [builds]).filter(Boolean).flatMap((b) => b.cells);
  if (!geos.length || !cells.length) return null;
  const c = new THREE.Vector3(), parts = geos.map((g0) => {
    const g = g0.index ? g0.toNonIndexed() : g0; g.computeBoundingBox(); g.boundingBox.getCenter(c);
    let best = null, bd = 1e9;
    for (const cell of cells) { const d = Math.max(0, Math.abs(cell.x - c.x) - cell.hx) + Math.max(0, Math.abs(cell.y - c.y) - cell.hy) * 1.2 + Math.max(0, Math.abs(cell.z - c.z) - cell.hz) + Math.hypot(cell.x - c.x, cell.y - c.y, cell.z - c.z) * 0.05; if (d < bd) { bd = d; best = cell; } }
    return { g, cell: best };
  });
  const merged = mergeGeometries(parts.map((q) => q.g)); if (!merged) return null;
  const pos = merged.attributes.position.array, ranges = new Map(); let off = 0;
  for (const q of parts) { const n = q.g.attributes.position.count * 3; if (!ranges.has(q.cell)) ranges.set(q.cell, []); ranges.get(q.cell).push(off, off + n); off += n; }
  const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  for (const [cell, r] of ranges) (cell.props ||= []).push({ x: cell.x, y: cell.y, z: cell.z, noDebris: true, hide: () => { for (let k = 0; k < r.length; k += 2) pos.fill(0, r[k], r[k + 1]); merged.attributes.position.needsUpdate = true; } });
  return m;
}
// a shape cut into pieces round its axis (so a dome or a drum can break away a piece at a time)
export function segments(make, n) { const out = []; for (let k = 0; k < n; k++) out.push(make((k / n) * Math.PI * 2, (Math.PI * 2) / n)); return out; }
// triangles of a surface of revolution about (x, z): profile [[r, y], ...] bottom to top, n sides
export function latheTris(x, z, profile, n = 20) {
  const out = [], P = (r, y, a) => new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
  for (let k = 0; k + 1 < profile.length; k++) for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
    out.push([P(r0, y0, a0), P(r1, y1, a0), P(r1, y1, a1)]);
    if (r0 > 0) out.push([P(r0, y0, a0), P(r1, y1, a1), P(r0, y0, a1)]);
  }
  return out;
}
// triangles of a square pyramid (or frustum when top > 0) centred on (x, z): base half-size, top half-size, heights
export function pyramidTris(x, z, base, top, y0, y1, N = 6) {
  const out = [], C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let f = 0; f < 4; f++) {
    const [ax, az] = C[f], [bx, bz] = C[(f + 1) % 4];
    const at = (u, v) => { const h = base + (top - base) * v; return new THREE.Vector3(x + (ax + (bx - ax) * u) * h, y0 + (y1 - y0) * v, z + (az + (bz - az) * u) * h); };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = at(i / N, j / N), b2 = at((i + 1) / N, j / N), c = at((i + 1) / N, (j + 1) / N), d = at(i / N, (j + 1) / N);
      out.push([a, b2, c], [a, c, d]);
    }
  }
  return out;
}

// SISIMIUT, GREENLAND: a small fishing town of painted timber houses scattered over bare rock knolls on the edge of
// the Davis Strait. Snow lies everywhere all year; the rock shows through on the steep bits. Gravel roads wind
// between the knolls; the harbour pier runs out into deep blue water crowded with ice: icebergs drift in the bay
// (you can fly out to them, and blow chunks off them), floes knock about the shore, fishing boats and a supply ship
// come and go. The church and the town hall stand on the square in the middle; a small football pitch has a game
// on. Beyond: islands, coastal mountains and glaciers down to the sea; inland, rock and snow rising to far peaks.
// Everything is built on a height field (terrainH) like La Playa's hills.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { hsl, tint, box, cyl, cone, sph, canvasTex, hipRoof, merged, netCtx, topOf, hangOn, rnd } from './mapkit.js';
import { waterMaterial } from './water.js';

const XS = [-34, -6, 22, 48], ZS = [-46, -18, 10, 38];
export const SEA = -0.3;
const E = 200;
// ---------- the land ----------
const hh = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hh(ix, iz), b = hh(ix + 1, iz), c = hh(ix, iz + 1), d = hh(ix + 1, iz + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z, o = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
// the coastline: the town's shore wanders north-south a little west of the first street
export const coast = (z) => -52 + 7 * Math.sin(z * 0.045 + 1) + 4 * Math.sin(z * 0.13 + 2) + 2.5 * Math.sin(z * 0.31);
// roads (axis-aligned segments that exist), and the flat places: the square, the pitch, the harbour apron
const SKIP = (x0, z0, x1, z1) => (x0 === 48 && x1 === 48 && z0 === -46) || (z0 === 38 && z1 === 38 && x0 === 22) || (x0 === -34 && x1 === -34 && z0 === 10) || (z0 === -46 && z1 === -46 && x0 === -34);
const SEGS = [];
for (let i = 0; i < XS.length; i++) for (let j = 0; j < ZS.length; j++) {
  if (i + 1 < XS.length && !SKIP(XS[i], ZS[j], XS[i + 1], ZS[j])) SEGS.push([XS[i], ZS[j], XS[i + 1], ZS[j]]);
  if (j + 1 < ZS.length && !SKIP(XS[i], ZS[j], XS[i], ZS[j + 1])) SEGS.push([XS[i], ZS[j], XS[i], ZS[j + 1]]);
}
export const PITCH = { x: 35, z: 24, w: 15, d: 9.5 };
const FLATS = [{ x0: -3.6, x1: 19.6, z0: -15.6, z1: 7.6 }, { x0: PITCH.x - PITCH.w / 2 - 2, x1: PITCH.x + PITCH.w / 2 + 2, z0: PITCH.z - PITCH.d / 2 - 2.5, z1: PITCH.z + PITCH.d / 2 + 2.5 }, { x0: -48, x1: -36.5, z0: -9, z1: 6 }];
function flat(x, z) {
  let f = 0;
  for (const [x0, z0, x1, z1] of SEGS) {
    const d = x0 === x1 ? (z > Math.min(z0, z1) - 2 && z < Math.max(z0, z1) + 2 ? Math.abs(x - x0) : 1e9) : (x > Math.min(x0, x1) - 2 && x < Math.max(x0, x1) + 2 ? Math.abs(z - z0) : 1e9);
    if (d < 6) f = Math.max(f, 1 - sm(3.4, 5.6, d));
  }
  for (const r of FLATS) { const d = Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1, 0); if (d < 3) f = Math.max(f, 1 - sm(0, 3, d)); }
  return f;
}
function rawH(x, z) {
  const c = coast(z), d = x - c;
  const n = fbm(x * 0.07 + 3, z * 0.07 + 9), r = fbm(x * 0.23, z * 0.23, 3);
  let h;
  if (d < 0) {
    h = Math.max(-6, d * 0.3) - 0.15;
    const isl = fbm(x * 0.045 + 17, z * 0.045 + 4);                       // rocky islets and skerries off the shore
    if (isl > 0.6 && d < -8 && Math.hypot(x + 60, z + 2) > 45) h = Math.max(h, (isl - 0.6) * 22 - 1.5 + r * 1.2);
  } else {
    const rise = Math.min(1, d / 4);
    h = 0.12 + rise * (Math.max(0, n - 0.32) * 8 + r * 1.1);               // bare rock knolls
    h += sm(60, 220, x) * 5 * (0.6 + n * 0.8) + sm(66, 220, Math.abs(z)) * 3.5 * (0.5 + n);   // the land rises gently away from the town
  }
  const f = flat(x, z);
  return f > 0 ? h * (1 - f) + 0.03 * f : h;
}
// far away: islands with peaks out at sea, coastal mountains and glaciers north and south, the inland ranges east
function farH(x, z) {
  let h = rawH(x, z);
  const R = Math.max(Math.abs(x), Math.abs(z)), w = sm(200, 520, R);
  if (w <= 0) return h;
  // low rolling ground with broad flat stretches; real mountains only far off, and not too tall
  const d = x - coast(z), flatA = sm(0.42, 0.58, fbm(x * 0.0025 + 3, z * 0.0025 + 7, 3));
  const rg = 1 - Math.abs(2 * fbm(x * 0.004 + 40, z * 0.004 + 11, 5) - 1);
  if (d > 0) h += w * (5 * fbm(x * 0.012, z * 0.012, 3) * (1 - flatA * 0.7) + sm(520, 1300, R) * rg * rg * 70 * (1 - flatA * 0.85));
  else { const isl = fbm(x * 0.0035 + 5, z * 0.0035 + 9, 4); if (isl > 0.54) h = Math.max(h, w * Math.min(40, (isl - 0.54) * 260 * (0.5 + rg * 0.5) - 3)); }
  return h;
}
// a cached grid over the map (the height is asked for a lot: every person, every frame)
const GR = 0.5, GN = Math.round(E * 2 / GR) + 1;
let HG = null;
function buildGrid() { HG = new Float32Array(GN * GN); for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) HG[j * GN + i] = rawH(-E + i * GR, -E + j * GR); }
export function terrainH(x, z) {
  if (!HG) buildGrid();
  const fx = (x + E) / GR, fz = (z + E) / GR;
  if (fx < 0 || fz < 0 || fx >= GN - 1 || fz >= GN - 1) return rawH(x, z);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * GN + i;
  return HG[k] * (1 - u) * (1 - v) + HG[k + 1] * u * (1 - v) + HG[k + GN] * (1 - u) * v + HG[k + GN + 1] * u * v;
}
const footprint = (x, z, w, d) => { const hs = []; for (const sx of [-0.5, 0, 0.5]) for (const sz of [-0.5, 0, 0.5]) hs.push(terrainH(x + sx * w, z + sz * d)); return { lo: Math.min(...hs), hi: Math.max(...hs) }; };

// house paint: Falu red, deep blue, mustard yellow, green, teal, white, orange
const PAINT = [0xa8242a, 0xa8242a, 0x9a1f24, 0x245a9a, 0x1f4a86, 0xe0b02c, 0x2e6e4a, 0x2a8a8a, 0xe8e6e0, 0xd8752a, 0x6a9ac8, 0x7a1a1a];

export function greenland(B) {
  const ctx = netCtx({ xs: XS, zs: ZS, roadW: 4.4, sw: 1.4, half: 92, extent: E, res: 2048, base: '#8a8780', lights: false, centerLine: null,
    skipEdge: (a, b) => SKIP(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)) }, B);
  const { city, g } = ctx;
  city.mapKind = 'greenland'; city.named = []; city.crowds = []; city.stationed = [];
  const GL = (city.gl = { houses: [], bigs: [], dock: null, snowmobiles: [], flags: [], signs: [] });
  const name = (S, o, x0, x1, z0, z1) => city.named.push({ S, o, x0, x1, z0, z1 });
  city.vehicles = { colors: [0xb3201f, 0xe8e8e4, 0x1c1d22, 0x6b6f76, 0x1f3f8a, 0x2f5d3a, 0xc8c4bc], bus: { p: 0, kinds: [{ color: 0xc8102e, h: 1.6, len: 2.6 }] }, moto: 0 };
  // everyone in parkas: red, navy, black, orange, green, purple, cream
  city.palette = { shirts: [0xb3201f, 0x1f3f8a, 0x111214, 0xe8601a, 0x2a5a3a, 0x5a2a6a, 0xd8d2c4, 0x3a3f46, 0x1c1d22, 0x6b4a2a, 0x2a7aa8], pants: [0x111214, 0x1c1d22, 0x2a3448, 0x3a3f46, 0x4a3a2a], sleeves: 0 };

  // ---------- paint the ground: snow over the rock, the rock showing on the steep bits and the shore, gravel roads ----------
  const S = g.res, K = S / (E * 2), img = g.x.createImageData(S, S), D = img.data;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = px / K - E, z = py / K - E, h = terrainH(x, z);
    const sl = Math.abs(terrainH(x + 0.6, z) - h) + Math.abs(terrainH(x, z + 0.6) - h);
    const n1 = fbm(x * 0.35, z * 0.35, 3), n2 = vn(x * 2.1, z * 2.1), d = x - coast(z);
    let r, gg, b;
    if (h < SEA + 0.05) { r = 40; gg = 58; b = 66; }
    else {
      // rock: grey-brown granite with dark cracks and lichen
      const rk = 78 + n2 * 46 + n1 * 30, crack = vn(x * 5, z * 5) < 0.18 ? 0.55 : 1;
      r = rk * 1.02 * crack; gg = rk * 0.97 * crack; b = rk * 0.92 * crack;
      // snow: lies everywhere it can stick; thins on steep faces and right at the waterline
      const snow = sm(0.36, 0.62, n1 + 0.36 - sl * 1.35 - (d < 3 ? (3 - d) * 0.12 : 0));
      const sv = 226 + n2 * 22;
      r = r + (sv - r) * snow; gg = gg + (sv + 4 - gg) * snow; b = b + (sv + 14 - b) * snow;
    }
    const k = (py * S + px) * 4; D[k] = r; D[k + 1] = gg; D[k + 2] = b; D[k + 3] = 255;
  }
  g.x.putImageData(img, 0, 0);
  // gravel roads with snow banked along the edges and tyre tracks
  for (const [x0, z0, x1, z1] of SEGS) {
    const v = x0 === x1, a0 = Math.min(v ? z0 : x0, v ? z1 : x1) - 2.2, a1 = Math.max(v ? z0 : x0, v ? z1 : x1) + 2.2;
    const R = (o0, o1, c) => (v ? g.rect(x0 + o0, a0, x0 + o1, a1, c) : g.rect(a0, z0 + o0, a1, z0 + o1, c));
    R(-3.4, 3.4, '#e4e8ec'); R(-2.3, 2.3, '#8d867a'); R(-1.2, -0.7, 'rgba(70,64,56,.45)'); R(0.7, 1.2, 'rgba(70,64,56,.45)');
    g.grainRect(v ? x0 - 2.3 : a0, v ? a0 : z0 - 2.3, v ? x0 + 2.3 : a1, v ? a1 : z0 + 2.3, 0.35, 30);
  }
  // the square: packed snow and gravel; the pitch: green artificial turf with white lines
  g.rect(-3.6, -15.6, 19.6, 7.6, '#d2d0c8'); g.grainRect(-3.6, -15.6, 19.6, 7.6, 0.25, 30);
  const P = PITCH;
  g.rect(P.x - P.w / 2 - 1, P.z - P.d / 2 - 1, P.x + P.w / 2 + 1, P.z + P.d / 2 + 1, '#3f7a3a');
  for (let k = 0; k < 8; k++) g.rect(P.x - P.w / 2 + k * P.w / 8, P.z - P.d / 2, P.x - P.w / 2 + (k + 0.5) * P.w / 8, P.z + P.d / 2, 'rgba(255,255,255,.05)');
  g.x.save(); g.x.strokeStyle = 'rgba(245,245,240,.95)'; g.x.lineWidth = 0.12 * g.k;
  g.x.strokeRect(g.px(P.x - P.w / 2), g.px(P.z - P.d / 2), P.w * g.k, P.d * g.k); g.x.beginPath(); g.x.moveTo(g.px(P.x), g.px(P.z - P.d / 2)); g.x.lineTo(g.px(P.x), g.px(P.z + P.d / 2)); g.x.stroke();
  g.x.beginPath(); g.x.arc(g.px(P.x), g.px(P.z), 1.6 * g.k, 0, 6.28); g.x.stroke();
  for (const s of [-1, 1]) g.x.strokeRect(g.px(P.x + s * P.w / 2 - (s > 0 ? 2.2 : 0)), g.px(P.z - 2.4), 2.2 * g.k, 4.8 * g.k);
  g.x.restore();

  // ---------- buildings: everything pitched-roofed, painted timber, on its knoll ----------
  const taken = [];
  const free = (x, z, w, d, pad = 1.2) => !taken.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 + pad && Math.abs(t.z - z) < (t.d + d) / 2 + pad);
  const house = (x, z, w, d, o = {}) => {
    const f = footprint(x, z, w, d), base = Math.max(0, f.hi - 0.05);
    const b = B.add({ x, z, w, d, floors: o.floors ?? 2, style: 'nordic', tint: new THREE.Color(o.color ?? pick(PAINT)), gh: o.gh ?? 1.25, fh: o.fh ?? 1.05, cell: o.cell ?? 1.6, gable: o.gable !== false, roofTint: new THREE.Color(o.roof ?? pick([0x26282c, 0x2e3034, 0x3a3d42, 0x1e2024])), base, storefront: false });
    b.noSigns = true; b.lo = f.lo; b.baseY = base; b.kind = o.kind || 'house';
    taken.push({ x, z, w, d }); GL.houses.push(b);
    return b;
  };
  // the town square: the church (nave, and its tower with the spire) and the town hall
  const nave = house(3, -9, 6.4, 11, { floors: 2, gh: 2.1, fh: 1.9, color: 0xb8682a, cell: 2.1, kind: 'church' });
  const tower = house(3, -16.6, 2.6, 2.6, { floors: 4, gh: 2.1, fh: 1.6, color: 0xb8682a, cell: 1.3, gable: false, kind: 'tower' });
  GL.church = { nave, tower };
  const hall = house(14.2, -4, 7, 14, { floors: 2, gh: 1.6, fh: 1.3, color: 0x6b5a4a, cell: 2, kind: 'hall', roof: 0x2a2c30 });
  GL.hall = hall; GL.flags.push({ x: 9.6, z: 5.6 }, { x: 9.6, z: -12.4 });
  city.crowds.push({ x: 6, z: 2.5, r: 1.6, n: 6 }, { x: 9.6, z: -14, r: 1.2, n: 4 }, { x: -1.6, z: -2, r: 1, n: 3 });
  city.wanderZones.push({ x0: -3, x1: 9, z0: -2, z1: 7 }, { x0: -3, x1: 9, z0: -2, z1: 7 });
  name('the church', 'the church', -1, 7, -18, -3); name('the town hall', 'the town hall', 10, 18, -11, 3); name('the town square', 'the town square', -4, 20, -16, 8);
  // the harbour: the fish factory, the harbour office, sheds; the pier and its cranes are in the Greenland class
  const fc = coast(-2);
  GL.dock = { x0: fc - 24, x1: fc + 1, z: -2, w: 3.6, y: 0.75 };
  const factory = house(-33, -24, 9, 13, { floors: 2, gh: 2.4, fh: 2, color: 0xe8e8e4, cell: 2.2, kind: 'factory', roof: 0x1f3f8a });
  house(-30, 16, 7, 6, { floors: 2, color: 0xa8242a, kind: 'shed' }); house(-37.5, -12.5, 5, 4.5, { floors: 1, gh: 1.8, color: 0xa8242a, kind: 'shed' });
  GL.factory = factory;
  name('the harbour', 'the harbour', -75, -36, -12, 8); name('the fish factory', 'the fish factory', -38, -28, -31, -17);
  // the store and a few bigger timber blocks of flats, a school
  const store = house(-20, -30, 9, 6, { floors: 2, gh: 1.6, color: 0xe8e6e0, kind: 'store', roof: 0xa8242a }); GL.store = store;
  city.crowds.push({ x: -20, z: -26, r: 1.2, n: 4 });
  for (const [x, z, w, d, c] of [[30, -32, 14, 6.5, 0xe0b02c], [-18, 24, 13, 6.5, 0x2e6e4a], [32, -6, 6.5, 14, 0xa8242a], [60, 8, 13, 6.5, 0x245a9a]]) if (free(x, z, w, d)) house(x, z, w, d, { floors: 3, cell: 2.1, color: c, kind: 'flats' });
  if (free(-18, -6, 12, 7)) GL.school = house(-18, -6, 12, 7, { floors: 2, gh: 1.5, color: 0xd8752a, cell: 2, kind: 'school' });
  name('the store', 'the store', -25, -15, -33, -26);
  // the pitch: keep it clear
  taken.push({ x: P.x, z: P.z, w: P.w + 4, d: P.d + 5 }, { x: 8, z: -4, w: 24, d: 24 });
  // the houses: on the knolls among the roads and up the hills behind, none on the roads or in the water
  const rr = rnd(9031);
  for (let tries = 0; tries < 9000 && GL.houses.length < 150; tries++) {
    const z = -78 + rr() * 156, x = coast(z) + 6 + rr() * (84 - coast(z)), alongX = rr() < 0.5;
    const w = alongX ? 4.4 + rr() * 2 : 3.8 + rr() * 1.2, d = alongX ? 3.8 + rr() * 1.2 : 4.4 + rr() * 2;
    if (!free(x, z, w, d)) continue;
    let onRoad = false; for (const sx of [-0.6, 0, 0.6]) for (const sz of [-0.6, 0, 0.6]) if (flat(x + sx * w, z + sz * d) > 0.05) onRoad = true;
    if (onRoad) continue;
    const f = footprint(x, z, w, d);
    if (f.lo < 0.1 || f.hi - f.lo > 2.6 || f.hi > 26) continue;
    house(x, z, w, d, { floors: rr() < 0.75 ? 2 : rr() < 0.5 ? 1 : 3 });
  }
  // snowmobiles parked by the houses, and a row of them by the pitch
  for (const h of GL.houses) if (h.kind === 'house' && Math.random() < 0.35) GL.snowmobiles.push({ x: h.x + h.w / 2 + 1, z: h.z + rand(-1, 1), r: rand(-0.4, 0.4) + Math.PI / 2 });
  for (let k = 0; k < 5; k++) GL.snowmobiles.push({ x: P.x + P.w / 2 + 3.2, z: P.z - 3 + k * 1.3, r: Math.PI / 2 + 0.3 });
  // people: fishermen on the pier, a small crowd at the football, folk round the square and the store
  const dk = GL.dock;
  for (let k = 0; k < 7; k++) { const x = dk.x0 + 2 + k * 3, side = k % 2 ? 1 : -1, z = dk.z + side * (dk.w / 2 - 0.4); city.crowds.push({ x, z, r: 0.05, n: 1, look: 'fisher', act: 'fish', stay: true, face: { x, z: z + side * 5 }, y: dk.y - terrainH(x, z), tag: 'fisher' }); }
  for (let k = 0; k < 3; k++) { const x = dk.x0 + 5 + k * 6; city.crowds.push({ x, z: dk.z, r: 0.6, n: 2, look: 'fisher', y: dk.y - terrainH(x, dk.z), act: 'attention', stay: true, tag: 'fisher' }); }
  for (let k = 0; k < 6; k++) city.crowds.push({ x: P.x - P.w / 2 + 1.5 + k * 2.4, z: P.z + P.d / 2 + 1.6, r: 0.5, n: 2, act: 'spect', face: { x: P.x, z: P.z }, stay: true });
  for (let k = 0; k < 2; k++) city.crowds.push({ x: P.x - 3 + k * 6, z: P.z - P.d / 2 - 1.6, r: 0.5, n: 2, act: 'spect', face: { x: P.x, z: P.z }, stay: true });
  city.wanderZones.push({ x0: -44, x1: -37, z0: -8, z1: 5 });
  name('the football pitch', 'the football pitch', P.x - 9, P.x + 9, P.z - 6, P.z + 6);
  city.lampsAlongBlock && city.blocks.forEach((b) => city.lampsAlongBlock(b, 10));
  city.hotspot = { x: 0, z: -4, r: 45 };
  return { ...ctx, agents: { cars: 10, peds: 150, wanderFrac: 0.3 }, fog: 0xcfdbe6, start: { x: -10, z: 0 }, zMin: -150, zMax: 150, xMin: -280, maxD: 230, yaw: -0.9, ownBackdrop: true, terrainH };
}

// ====================================================================================================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function flagGL(c, w, h) { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#c8102e'; c.fillRect(0, h / 2, w, h / 2); const cx = w * 0.39, r = h / 3; c.beginPath(); c.arc(cx, h / 2, r, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, h / 2, r, 0, Math.PI); c.fill(); }

export class Greenland {
  constructor(scene, city) {
    this.scene = scene; this.city = city; const GL = (this.GL = city.gl);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    this.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 });
    this.signs = [];
    this.terrain(); this.sea(); this.far(); this.icebergs(); this.floes();
    this.houses(GL.houses); this.church(GL.church); this.townHall(GL.hall); this.harbour(GL.dock, GL.factory, GL.store);
    this.pitch(); this.snowmobiles(GL.snowmobiles); this.boats(); this.aurora(); this.flagpoles(GL.flags);
    this.snowStarted = false;
  }
  add(geos, mat = this.mat, shadow = true) { return merged(geos, mat, this.scene, shadow); }
  sign(w, h, draw, x, y, z, ry = 0, glow = 0.4) {
    const tex = canvasTex(Math.max(16, Math.round(w * 64)), Math.max(16, Math.round(h * 64)), draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); this.signs.push(m.material); return m;
  }
  // the land itself: one height-field mesh carrying the painted ground (the flat ground plane is hidden)
  terrain() {
    const geo = new THREE.PlaneGeometry(E * 2, E * 2, 400, 400).rotateX(-Math.PI / 2), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: G.ground.tex, roughness: 0.88 }));
    m.receiveShadow = true; this.scene.add(m);
    if (G.groundMat) G.groundMat.visible = false;
  }
  // the sea: deep, clean arctic blue with the shared ripples and boat wakes
  sea() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), waterMaterial({ color: 0x14435f, flow: [0.04, 0.08], scale: 0.7, amp: 0.9 }));
    m.position.y = SEA; m.receiveShadow = true; this.scene.add(m); this.seaMesh = m;
  }
  // everything past the map: islands and peaks out at sea, coastal mountains and glaciers, inland rock and snow
  far() {
    const N = 280, SZ = 3400, geo = new THREE.PlaneGeometry(SZ, SZ, N, N).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let h = farH(x, z);
      if (Math.abs(x) < E - 14 && Math.abs(z) < E - 14) h = -12;                              // well under the map's own terrain
      else if (Math.abs(x) < E && Math.abs(z) < E) h -= 0.3;                                  // the last ring meets it at the edge
      p.setY(i, h);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = p.getY(i), steep = 1 - nrm.getY(i), n = fbm(x * 0.02, z * 0.02, 3), d = x - coast(z);
      // the same mix as the painted ground: snow lying wherever it can, grey-brown rock on the steep bits
      const n1 = fbm(x * 0.35, z * 0.35, 3), snow = sm(0.36, 0.62, n1 + 0.36 - steep * 2.2 - (d > 0 && d < 3 ? (3 - d) * 0.12 : 0));
      if (h < SEA) c.setRGB(0.16, 0.22, 0.26);
      else if (h < 30 && d < 0 && n > 0.5) c.setHSL(0.55, 0.4, 0.88 + n * 0.06, THREE.SRGBColorSpace);         // glacier ice on the islands
      else { const rk = (78 + n * 40) / 255; c.setRGB(rk * 1.02, rk * 0.97, rk * 0.92).lerp(new THREE.Color(0.9, 0.92, 0.96), snow); c.convertSRGBToLinear(); }
      c.toArray(col, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    m.receiveShadow = true; this.scene.add(m);
  }
  // icebergs: tabular slabs, domes and pinnacles; blue in the cracks, a turquoise glow under the water round each one.
  // They drift and bob; a blast knocks chunks off (and small ones break up).
  icebergs() {
    const r = rnd(4242), bergs = [];
    const geoFor = (kind, R, H, seed) => {
      const g3 = new THREE.CylinderGeometry(R * 0.8, R, H, 28, 9, false).translate(0, H / 2, 0), p = g3.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = y / H;
        let rad = (0.6 + vn(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + t * 3) * 0.45 + vn(a * 7 + seed, t * 4) * 0.28 + (vn(a * 19 + seed, 1.3) < 0.25 ? -0.1 : 0)) * (kind === 'pin' ? 1 - t * 0.75 : kind === 'dome' ? Math.sqrt(Math.max(0.02, 1 - t * t)) : 1);
        let yy = y;
        if (t > 0.98) yy = H * (kind === 'tab' ? 0.92 + vn(x * 0.3 + seed, z * 0.3) * 0.12 : kind === 'pin' ? 0.75 + vn(x + seed, z) * 0.6 : 0.85 + vn(x * 0.5, z * 0.5 + seed) * 0.2);
        const rr0 = Math.hypot(x, z) * rad; p.setXYZ(i, Math.cos(a) * rr0, yy, Math.sin(a) * rr0);
        const blue = vn(x * 0.6 + seed, y * 0.8 + z * 0.4);
        c.setRGB(0.86 + blue * 0.1, 0.94 + blue * 0.05, 1); if (blue < 0.28) c.setRGB(0.55, 0.8, 0.92); if (t < 0.08) c.setRGB(0.6, 0.85, 0.9);
        c.toArray(col, i * 3);
      }
      g3.setAttribute('color', new THREE.BufferAttribute(col, 3)); g3.computeVertexNormals();
      return g3;
    };
    const iceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.02, emissive: 0x16303c, envMapIntensity: 1.1 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x5fd8e8, transparent: true, opacity: 0.2, depthWrite: false });
    const clear = (x, z, R) => terrainH(x, z) < SEA - 1 && bergs.every((b) => Math.hypot(b.x - x, b.z - z) > b.R + R + 4) && !(z > -14 && z < 10 && x > -80);   // keep the harbour mouth open
    for (let k = 0; k < 160 && bergs.length < 34; k++) {             // in the bay, close enough to fly out to
      const z = -150 + r() * 300, x = coast(z) - 14 - r() * 170, R = 2 + r() * 7;
      if (clear(x, z, R)) bergs.push({ x, z, R, H: R * (0.5 + r() * 0.9), kind: pick(['tab', 'tab', 'dome', 'pin']) });
    }
    for (let k = 0; k < 400 && bergs.length < 110; k++) {            // out to the horizon
      const z = -1300 + r() * 2600, x = coast(z) - 60 - r() * 1300, R = 6 + r() * 26;
      if (clear(x, z, R) && Math.hypot(x, z) > 180) bergs.push({ x, z, R, H: R * (0.4 + r() * 0.6), kind: pick(['tab', 'tab', 'dome', 'pin']) });
    }
    this.bergs = bergs.map((b, i) => {
      const g2 = new THREE.Group(), m = new THREE.Mesh(geoFor(b.kind, b.R, b.H, i * 3.7), iceMat); m.castShadow = true; m.receiveShadow = true; m.position.y = -b.H * 0.12; g2.add(m);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(b.R * 1.2, 24).rotateX(-Math.PI / 2), glowMat); glow.position.y = 0.04; glow.renderOrder = 2; g2.add(glow);
      g2.position.set(b.x, SEA, b.z); g2.rotation.y = r() * 6.28; this.scene.add(g2);
      return { ...b, g: g2, m, ph: r() * 6, vx: Math.hypot(b.x, b.z) > 200 ? (r() - 0.5) * 0.06 : 0, vz: Math.hypot(b.x, b.z) > 200 ? (r() - 0.5) * 0.06 : 0, s: 1, hp: 6 + b.R * b.H * 0.5 };
    });
    // weapons aim at the ice (and at the sea's surface rather than the sea bed)
    G.rayExtra = (p) => this.rayHit(p);
  }
  // pack ice: little floes knocking about the shore and round the bergs
  floes() {
    const geo = new THREE.CylinderGeometry(1, 1.1, 0.35, 7).translate(0, 0.05, 0), list = [], r = rnd(61);
    for (let k = 0; k < 1200 && list.length < 380; k++) {
      const z = -190 + r() * 380, x = coast(z) - 1 - Math.pow(r(), 1.8) * 190;
      if (terrainH(x, z) > SEA - 0.4 || (z > -12 && z < 8 && x > -78)) continue;
      list.push({ x, z, s: 0.3 + Math.pow(r(), 2) * 2.2, r: r() * 6, ph: r() * 6 });
    }
    // a few ragged shapes, each piece a turned and stretched copy of one of them
    const shapes = [0, 1, 2, 3].map((v) => { const sh = new THREE.Shape(), n = 9; for (let k = 0; k < n; k++) { const a = k / n * 6.283, rr = 0.6 + vn(k * 1.7 + v * 9, v) * 0.7; (k ? sh.lineTo : sh.moveTo).call(sh, Math.cos(a) * rr, Math.sin(a) * rr); } sh.closePath();
      const g3 = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 }).rotateX(-Math.PI / 2).translate(0, -0.1, 0); return g3; });
    const mat = new THREE.MeshStandardMaterial({ color: 0xeef6fb, roughness: 0.5, emissive: 0x10242e });
    this.floeMesh = shapes.map((g3, v) => { const part = list.filter((_, i) => i % 4 === v), im = new THREE.InstancedMesh(g3, mat, part.length);
      part.forEach((f, i) => { _q.setFromAxisAngle(UP, f.r); _m.compose(_p.set(f.x, SEA, f.z), _q, _s.set(f.s, 1, f.s * (0.7 + (i % 5) * 0.1))); im.setMatrixAt(i, _m); });
      im.receiveShadow = true; this.scene.add(im); return im; });
    this.floeList = list;
  }
  // the houses' feet: timber posts down to the rock on the low side, steps up to the door, a deck with a rail; a stove pipe
  houses(list) {
    for (const b of list) {
      if (b.kind === 'tower') continue;
      const P = [], wood = 0x6a4a32, x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y = b.baseY;
      // a dark plinth skirt and posts where the rock falls away
      for (const [px, pz] of [[x0 + 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2], [x0 + 0.2, z1 - 0.2], [x1 - 0.2, z1 - 0.2], [b.x, z0 + 0.2], [b.x, z1 - 0.2]]) {
        const gy = terrainH(px, pz); if (y - gy > 0.15) P.push(box(0.22, y - gy + 0.1, 0.22, px, (y + gy) / 2, pz, 0x3a3632));
      }
      if (y - b.lo > 0.2) P.push(box(b.w - 0.1, Math.min(0.5, y - b.lo), b.d - 0.1, b.x, y - Math.min(0.5, y - b.lo) / 2, b.z, 0x4a4642));
      // the deck and steps on one long side
      const side = b.w >= b.d ? (Math.random() < 0.5 ? 'n' : 's') : Math.random() < 0.5 ? 'e' : 'w';
      const dz = side === 'n' ? -1 : side === 's' ? 1 : 0, dx = side === 'e' ? 1 : side === 'w' ? -1 : 0;
      if (b.kind !== 'church' && b.kind !== 'factory') {
        const dl = dx ? b.d * 0.5 : b.w * 0.5, cx = b.x + dx * (b.w / 2 + 0.75), cz = b.z + dz * (b.d / 2 + 0.75), gy = terrainH(cx, cz);
        P.push(dx ? box(1.5, 0.1, dl, cx, y + 0.05, cz, wood) : box(dl, 0.1, 1.5, cx, y + 0.05, cz, wood));
        for (const s of [-1, 1]) { const px = cx + (dx ? dx * 0.7 : s * dl / 2), pz = cz + (dz ? dz * 0.7 : s * dl / 2); P.push(box(0.12, y - gy + 0.8, 0.12, px, (y + gy + 0.8) / 2, pz, wood)); }
        P.push(dx ? box(0.06, 0.06, dl, cx + dx * 0.72, y + 0.8, cz, 0xe8e4dc) : box(dl, 0.06, 0.06, cx, y + 0.8, cz + dz * 0.72, 0xe8e4dc));
        // steps down from the deck to the ground
        const steps = Math.max(1, Math.round((y - gy) / 0.25));
        for (let k = 0; k < steps; k++) { const t = (k + 1) / steps, sx = cx + (dx ? dx * (0.75 + t * 0.9) : dl / 2 - 0.4), sz = cz + (dz ? dz * (0.75 + t * 0.9) : dl / 2 - 0.4); P.push(box(dx ? 0.3 : 0.7, 0.08, dx ? 0.7 : 0.3, sx, y - t * (y - gy), sz, wood)); }
      }
      const cell = b.cells.find((c) => c.f === 0) || b.cells[0];
      if (P.length) { const m = this.add(P); (cell.props ||= []).push({ obj: [m], x: cell.x, y: cell.y, z: cell.z }); }
      // a black stove pipe on the roof
      const t = topOf(b), along = b.w >= b.d, rh = Math.min(b.w, b.d) * 0.42;
      const pipe = this.add([cyl(0.09, 0.09, rh * 0.8 + 0.8, b.x + (along ? b.w * 0.25 : 0), t.y + rh * 0.5 + 0.2, b.z + (along ? 0 : b.d * 0.25), 0x1a1a1a, 8)], this.metal);
      hangOn(b, [pipe], b.floors - 1);
    }
  }
  church(c) {
    const t = topOf(c.tower), y = t.y, P = [], Gd = [];
    // the belfry with its louvres, the steep four-sided spire, the gilt cross
    P.push(box(t.w + 0.2, 0.2, t.d + 0.2, t.cx, y + 0.1, t.cz, 0xf2f0ea), box(t.w - 0.2, 1.6, t.d - 0.2, t.cx, y + 1, t.cz, 0xf2f0ea));
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P.push(nx ? box(0.06, 0.9, 0.7, t.cx + nx * (t.w / 2 - 0.08), y + 1.1, t.cz, 0x2a2a2a) : box(0.7, 0.9, 0.06, t.cx, y + 1.1, t.cz + nz * (t.d / 2 - 0.08), 0x2a2a2a));
    P.push(tint(new THREE.ConeGeometry(t.w * 0.78, 4.6, 4).rotateY(Math.PI / 4).translate(t.cx, y + 4.1, t.cz), 0x26282c));
    Gd.push(box(0.08, 1, 0.08, t.cx, y + 6.8, t.cz, 0xd9b04a), box(0.5, 0.08, 0.08, t.cx, y + 6.95, t.cz, 0xd9b04a));
    hangOn(c.tower, [this.add(P), this.add(Gd, this.metal)], c.tower.floors - 1);
    // tall white-framed windows down the nave
    const n = topOf(c.nave), W = [];
    for (let z = n.az + 1.4; z < n.bz - 1; z += 2.2) for (const s of [-1, 1]) W.push(box(0.06, 2.2, 0.9, n.cx + s * (n.w / 2 + 0.02), c.nave.baseY + 2.2, z, 0xf6f6f2), box(0.07, 1.9, 0.6, n.cx + s * (n.w / 2 + 0.03), c.nave.baseY + 2.2, z, 0x1c2a3a));
    hangOn(c.nave, [this.add(W)]);
  }
  townHall(h) {
    const t = topOf(h);
    this.sign(4.2, 0.6, (c, w, hh) => { c.fillStyle = '#f2f0ea'; c.fillRect(0, 0, w, hh); c.fillStyle = '#26282c'; c.font = `700 ${hh * 0.5}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('QEQQATA KOMMUNIA', w / 2, hh / 2, w * 0.95); }, t.ax - 0.06, h.baseY + 2.2, t.cz, -Math.PI / 2, 0.3);
  }
  flagpoles(list) {
    const P = [];
    for (const f of list) { const y = terrainH(f.x, f.z); P.push(cyl(0.05, 0.07, 5, f.x, y + 2.5, f.z, 0xeeeeee, 8)); this.sign(1.2, 0.8, flagGL, f.x + 0.62, y + 4.5, f.z, 0, 0.15); }
    this.add(P);
  }
  // the harbour: the timber pier on its piles with a T-head, fish boxes, barrels, nets, a crane, the fuel tank
  harbour(d, factory, store) {
    const P = [], wood = 0x6a5038, y = d.y, len = d.x1 - d.x0;
    P.push(box(len, 0.2, d.w, (d.x0 + d.x1) / 2, y, d.z, 0x7a5c40), box(4, 0.2, 12, d.x0 + 2, y, d.z, 0x7a5c40));
    for (let x = d.x0 + 0.4; x < d.x1; x += 2) for (const s of [-1, 1]) P.push(box(0.3, y + 6, 0.3, x, y - 3, d.z + s * (d.w / 2 - 0.2), wood));
    for (const s of [-1, 1]) for (let z = -5.6; z <= 5.6; z += 2.8) P.push(box(0.3, y + 6, 0.3, d.x0 + 0.3 + (s > 0 ? 3.4 : 0), y - 3, d.z + z, wood));
    for (let x = d.x0 + 1; x < d.x1; x += 4) for (const s of [-1, 1]) P.push(box(0.3, 0.4, 0.3, x, y + 0.3, d.z + s * (d.w / 2 - 0.15), 0x1a1a1a));   // bollards
    // fish boxes, barrels, nets, buoys
    for (let k = 0; k < 14; k++) { const x = d.x0 + 4 + Math.random() * (len - 8), z = d.z + (Math.random() - 0.5) * (d.w - 1.2); P.push(box(0.7, 0.35, 0.5, x, y + 0.27, z, pick([0x2a6ad8, 0xe86a1a, 0xf2f2ee, 0x3a8a4a]))); }
    for (let k = 0; k < 6; k++) P.push(cyl(0.25, 0.25, 0.6, d.x0 + 1 + Math.random() * 3, y + 0.4, d.z + (Math.random() - 0.5) * 10, pick([0x1f3f8a, 0xb3201f, 0x3a3a3a]), 10));
    for (let k = 0; k < 4; k++) P.push(tint(new THREE.SphereGeometry(0.6, 8, 4, 0, 6.28, 0, Math.PI / 2).scale(1.4, 0.4, 1).translate(d.x0 + 6 + k * 4, y + 0.1, d.z + (k % 2 ? 1 : -1) * 0.8), 0x2a5a4a));
    // the dock crane and the fuel tank on the shore
    P.push(box(0.6, 4.4, 0.6, d.x0 + 9, y + 2.2, d.z - 1.3, 0xe8b020), tint(new THREE.BoxGeometry(0.4, 0.4, 6).rotateX(0.35).translate(d.x0 + 9, y + 4.9, d.z - 3.4), 0xe8b020));
    P.push(cyl(2.2, 2.2, 3.2, d.x1 + 4, terrainH(d.x1 + 4, d.z + 9) + 1.6, d.z + 9, 0xe8e8e4, 18));
    this.add(P);
    const t = topOf(factory);
    hangOn(factory, [this.sign(5, 0.8, (c, w, h) => { c.fillStyle = '#1f3f8a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `800 ${h * 0.5}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HALIBUT & SHRIMP CO.', w / 2, h / 2, w * 0.95); }, t.ax - 0.06, factory.baseY + 3.2, t.cz, -Math.PI / 2, 0.3)]);
    const s = topOf(store);
    hangOn(store, [this.sign(4, 0.7, (c, w, h) => { c.fillStyle = '#c8102e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `800 ${h * 0.55}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PILERSUISOQ', w / 2, h / 2, w * 0.95); }, s.cx, store.baseY + 1.9, s.bz + 0.06, 0, 0.4)]);
  }
  // the little football pitch: goals, a low fence, two floodlights; a five-a-side game on
  pitch() {
    const P = [], { x, z, w, d } = PITCH, y = 0.03;
    // the artificial turf on its own sharp texture: mown stripes, crisp white lines
    const tex = canvasTex(1024, Math.round(1024 * (d + 2) / (w + 2)), (c, W, H) => {
      const k = W / (w + 2), X = (v) => (v + w / 2 + 1) * k, Z = (v) => (v + d / 2 + 1) * k;
      c.fillStyle = '#3a7a36'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#3f8239' : '#36722f'; c.fillRect(X(-w / 2 + i * w / 10), Z(-d / 2), w / 10 * k, d * k); }
      for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.05)`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      c.strokeStyle = '#f4f4ef'; c.lineWidth = 0.12 * k;
      c.strokeRect(X(-w / 2), Z(-d / 2), w * k, d * k); c.beginPath(); c.moveTo(X(0), Z(-d / 2)); c.lineTo(X(0), Z(d / 2)); c.stroke();
      c.beginPath(); c.arc(X(0), Z(0), 1.6 * k, 0, 6.283); c.stroke(); c.fillStyle = '#f4f4ef'; c.beginPath(); c.arc(X(0), Z(0), 0.12 * k, 0, 6.283); c.fill();
      for (const s2 of [-1, 1]) { c.strokeRect(X(s2 > 0 ? w / 2 - 2.6 : -w / 2), Z(-2.8), 2.6 * k, 5.6 * k); c.strokeRect(X(s2 > 0 ? w / 2 - 1 : -w / 2), Z(-1.6), 1 * k, 3.2 * k); c.beginPath(); c.arc(X(s2 * (w / 2 - 1.9)), Z(0), 0.1 * k, 0, 6.283); c.fill(); }
    });
    tex.anisotropy = 16;
    const turf = new THREE.Mesh(new THREE.PlaneGeometry(w + 2, d + 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    turf.position.set(x, terrainH(x, z) + 0.035, z); turf.receiveShadow = true; this.scene.add(turf);
    for (const s of [-1, 1]) { const gx = x + s * w / 2; P.push(box(0.08, 1.1, 0.08, gx, y + 0.55, z - 1.6, 0xf6f6f2), box(0.08, 1.1, 0.08, gx, y + 0.55, z + 1.6, 0xf6f6f2), box(0.08, 0.08, 3.28, gx, y + 1.1, z, 0xf6f6f2), tint(new THREE.BoxGeometry(0.8, 1.1, 3.2).translate(gx + s * 0.4, y + 0.55, z), 0xdddddd)); }
    for (let a = -w / 2 - 1; a <= w / 2 + 1; a += 1.5) for (const s of [-1, 1]) P.push(box(0.05, 0.6, 0.05, x + a, y + 0.3, z + s * (d / 2 + 1), 0x2a2a2a));
    for (const s of [-1, 1]) P.push(box(w + 2, 0.04, 0.04, x, y + 0.6, z + s * (d / 2 + 1), 0x2a2a2a));
    for (const s of [-1, 1]) P.push(cyl(0.08, 0.1, 6, x + s * (w / 2 + 1.5), y + 3, z - d / 2 - 1.5, 0x8a8e92, 8), box(0.8, 0.3, 0.2, x + s * (w / 2 + 1.5), y + 6, z - d / 2 - 1.3, 0xe8e8e4));
    this.add(P);
    // the players: two teams of five, a ball
    const body = mergeGeometries([tint(new THREE.CylinderGeometry(0.066, 0.056, 0.24, 8).scale(1, 1, 0.62).translate(0, 0.43, 0), 0xffffff), tint(new THREE.SphereGeometry(0.048, 8, 6).translate(0, 0.625, 0), 0xe0b090)]);
    const leg = new THREE.CylinderGeometry(0.026, 0.02, 0.31, 6).translate(0, -0.155, 0);
    const mk = (geo, n, c) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: !c, color: c || 0xffffff, roughness: 0.7 }), n); m.castShadow = true; m.frustumCulled = false; this.scene.add(m); return m; };
    const N = 10;
    this.fb = { body: mk(body, N), legs: mk(leg, N * 2, 0x1c1d22), ball: new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf6f6f2 })), bx: x, bz: z, vx: 0, vz: 0, pl: [] };
    this.fb.ball.castShadow = true; this.scene.add(this.fb.ball);
    for (let k = 0; k < N; k++) {
      const team = k < 5 ? 0 : 1, keeper = k % 5 === 0;
      this.fb.body.setColorAt(k, new THREE.Color(keeper ? (team ? 0x2ad07a : 0xf2c21a) : team ? 0x1f3f8a : 0xc8102e));
      this.fb.pl.push({ team, keeper, x: x + (team ? 1 : -1) * (keeper ? w / 2 - 0.6 : rand(1, w / 2 - 1.5)), z: z + rand(-d / 2 + 1, d / 2 - 1), h: 0, ph: rand(0, 6), sp: rand(1.4, 2) });
    }
  }
  updateFootball(dt) {
    const F = this.fb; if (!F) return;
    const { x, z, w, d } = PITCH, t = G.time;
    // the ball rolls and slows; whoever's closest chases it and kicks it on toward the other goal
    F.bx += F.vx * dt; F.bz += F.vz * dt; F.vx *= Math.exp(-dt * 0.9); F.vz *= Math.exp(-dt * 0.9);
    if (Math.abs(F.bz - z) > d / 2 - 0.2) { F.vz *= -0.7; F.bz = z + Math.sign(F.bz - z) * (d / 2 - 0.2); }
    if (Math.abs(F.bx - x) > w / 2 - 0.1) { if (Math.abs(F.bz - z) < 1.5) { F.bx = x; F.bz = z; F.vx = F.vz = 0; } else { F.vx *= -0.7; F.bx = x + Math.sign(F.bx - x) * (w / 2 - 0.1); } }
    let chaser = null, cd = 1e9; for (const p of F.pl) { if (p.keeper) continue; const dd = Math.hypot(p.x - F.bx, p.z - F.bz); if (dd < cd) { cd = dd; chaser = p; } }
    F.pl.forEach((p, i) => {
      let tx, tz;
      if (p.keeper) { tx = x + (p.team ? 1 : -1) * (w / 2 - 0.5); tz = z + Math.max(-1.4, Math.min(1.4, F.bz - z)); }
      else if (p === chaser) { tx = F.bx; tz = F.bz; }
      else { tx = x + (F.bx - x) * 0.6 + (p.team ? 1.5 : -1.5) + Math.sin(i * 1.7 + t * 0.3) * 2.5; tz = z + Math.cos(i * 2.3 + t * 0.25) * (d / 2 - 1.2); }
      const dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz), mv = dd > 0.25;
      if (mv) { p.x += dx / dd * Math.min(dd, p.sp * dt); p.z += dz / dd * Math.min(dd, p.sp * dt); p.h = Math.atan2(dx, dz); }
      if (p === chaser && dd < 0.3 && Math.hypot(F.vx, F.vz) < 1.2) { const gx = x + (p.team ? -1 : 1) * w / 2, a = Math.atan2(gx - F.bx, z + rand(-2, 2) - F.bz), sp = rand(2.5, 5); F.vx = Math.sin(a) * sp; F.vz = Math.cos(a) * sp; }
      const cyc = t * 9 + p.ph, lg = mv ? Math.sin(cyc) * 0.6 : 0, y = terrainH(p.x, p.z) + (mv ? Math.abs(Math.sin(cyc)) * 0.02 : 0);
      _q.setFromAxisAngle(UP, p.h); _m.compose(_p.set(p.x, y, p.z), _q, ONE); F.body.setMatrixAt(i, _m);
      for (const s of [0, 1]) { const m2 = new THREE.Matrix4().makeRotationX(s ? lg : -lg); m2.setPosition(s ? 0.034 : -0.034, 0.31, 0); F.legs.setMatrixAt(i * 2 + s, new THREE.Matrix4().multiplyMatrices(_m, m2)); }
    });
    F.ball.position.set(F.bx, terrainH(F.bx, F.bz) + 0.07, F.bz);
    F.body.instanceMatrix.needsUpdate = true; F.legs.instanceMatrix.needsUpdate = true;
  }
  snowmobiles(list) {
    const geo = mergeGeometries([tint(new THREE.BoxGeometry(0.38, 0.22, 0.9).translate(0, 0.25, 0.05), 0xffffff), tint(new THREE.BoxGeometry(0.3, 0.12, 0.5).translate(0, 0.42, -0.15), 0x111111), tint(new THREE.BoxGeometry(0.3, 0.18, 0.04).rotateX(-0.5).translate(0, 0.45, 0.32), 0x9ab4c4),
      ...[-0.16, 0.16].map((x) => tint(new THREE.BoxGeometry(0.06, 0.03, 0.55).translate(x, 0.03, 0.35), 0xb8bcc0)), tint(new THREE.BoxGeometry(0.34, 0.14, 0.7).translate(0, 0.1, -0.25), 0x1a1a1a)]);
    const im = new THREE.InstancedMesh(geo, this.mat, list.length);
    list.forEach((s, i) => { _q.setFromAxisAngle(UP, s.r); _m.compose(_p.set(s.x, terrainH(s.x, s.z), s.z), _q, _s.set(1.3, 1.3, 1.3)); im.setMatrixAt(i, _m); im.setColorAt(i, new THREE.Color(pick([0xf2c21a, 0xc8102e, 0x2a6ad8, 0x111111, 0x7a2ad0, 0xe86a1a]))); });
    im.castShadow = true; this.scene.add(im);
  }
  // boats: trawlers and little open boats going out to fish and coming home, a supply ship offshore; more tied up at the pier
  boats() {
    const hullShape = (len, beam, bow) => { const s = new THREE.Shape(); s.moveTo(-beam / 2, -len / 2); s.lineTo(beam / 2, -len / 2); s.lineTo(beam / 2, len / 2 - bow); s.quadraticCurveTo(beam / 2, len / 2 - bow * 0.2, 0, len / 2); s.quadraticCurveTo(-beam / 2, len / 2 - bow * 0.2, -beam / 2, len / 2 - bow); s.closePath(); return s; };
    const hull = (len, beam, bow, h, col, y = -0.3) => tint(new THREE.ExtrudeGeometry(hullShape(len, beam, bow), { depth: h, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, y, 0), col);
    const man = (P, x, y, z, c = 0xe8601a) => P.push(box(0.12, 0.24, 0.1, x, y + 0.12, z, c), sph(0.05, x, y + 0.3, z, 0xe0b090), tint(new THREE.SphereGeometry(0.055, 8, 4, 0, 6.28, 0, Math.PI / 2).translate(x, y + 0.31, z), pick([0x1c1d22, 0xc8102e, 0x1f3f8a])));
    const kinds = {
      trawler: () => { const P = [hull(6.4, 1.8, 1.8, 0.85, pick([0xb3201f, 0xb3201f, 0x1f3f8a, 0x2a6a3a])), box(1.82, 0.14, 6, 0, 0.5, 0, 0x1a1a1a), box(1.3, 1, 1.4, 0, 1.0, 1.2, 0xf2f2ee), box(1.32, 0.3, 1.2, 0, 1.25, 1.2, 0x1c2a3a), cyl(0.05, 0.05, 2.6, 0, 1.9, 0.4, 0xdddddd, 6), tint(new THREE.BoxGeometry(0.1, 0.1, 2.4).rotateX(0.5).translate(0, 1.6, -1.2), 0xe8b020)];
        for (let k = 0; k < 4; k++) P.push(sph(0.15, (k % 2 ? 0.5 : -0.5), 0.75, -2 + k * 0.6, 0xe86a1a)); man(P, 0.4, 0.55, -1.8); man(P, -0.4, 0.55, -1.2, 0xf2c21a); return P; },
      dinghy: () => { const P = [hull(2.6, 1.0, 0.8, 0.45, pick([0xf2f2ee, 0xb3201f, 0x1f3f8a, 0xe8b020])), box(0.92, 0.04, 2, 0, 0.12, -0.1, 0x6a5038), box(0.2, 0.4, 0.25, 0, 0.25, -1.3, 0x1a1a1a)]; man(P, 0, 0.12, -0.6); P.push(tint(new THREE.CylinderGeometry(0.008, 0.012, 1.4, 4).rotateX(-0.9).rotateZ(0.6).translate(0.4, 0.8, -0.2), 0x2a2a2a)); return P; },
      ship: () => { const P = [hull(24, 4.2, 5, 1.9, 0x1f3f8a, -0.8), box(4.22, 0.4, 20, 0, -0.6, -0.5, 0xb3201f), box(3.6, 3, 4, 0, 2.2, -8.6, 0xf2f2ee), box(3.62, 0.5, 3.8, 0, 3.1, -8.6, 0x1c2a3a), cyl(0.3, 0.3, 1.6, 0, 4.2, -9.6, 0xb3201f, 10)];
        for (let r2 = 0; r2 < 5; r2++) for (let c2 = 0; c2 < 2; c2++) for (let h2 = 0; h2 < 2; h2++) P.push(box(1.7, 0.85, 2.4, -0.88 + c2 * 1.76, 1.6 + h2 * 0.88, -4.6 + r2 * 2.6, pick([0xb3201f, 0x1f63b8, 0x3a8a4a, 0xe8b020, 0xe8e8e4, 0x6a3a8a])));
        return P; },
    };
    const geo = (k) => mergeGeometries(kinds[k]());
    this.boatList = [];
    const d = this.GL.dock, mouth = { x: d.x0 - 8, z: d.z };
    for (let k = 0; k < 7; k++) {
      const kind = k < 2 ? 'trawler' : 'dinghy', m = new THREE.Mesh(geo(kind), this.mat); m.castShadow = true; this.scene.add(m);
      // a fishing ground the boat can reach in a straight line without running into ice
      const segD = (b, a, c) => { const ux = c.x - a.x, uz = c.z - a.z, l2 = ux * ux + uz * uz, t = Math.max(0, Math.min(1, ((b.x - a.x) * ux + (b.z - a.z) * uz) / l2)); return Math.hypot(a.x + ux * t - b.x, a.z + uz * t - b.z); };
      let spot = null;
      for (let tr = 0; tr < 60 && !spot; tr++) { const c = { x: mouth.x - 30 - Math.random() * 110, z: -120 + Math.random() * 240 }, a = { x: mouth.x - 4, z: d.z + (k % 2 ? 7 : -7) }; if (this.bergs.every((b) => segD(b, a, c) > b.R * 1.4 + 3) && terrainH(c.x, c.z) < SEA - 1) spot = c; }
      spot ||= { x: mouth.x - 20, z: d.z + (k % 2 ? 20 : -20) };
      this.boatList.push({ m, kind, a: { x: mouth.x - 4, z: d.z + (k % 2 ? 7 : -7) }, b: spot, u: Math.random(), dir: 1, wait: rand(0, 20), v: kind === 'trawler' ? 2.2 : 3.2, x: mouth.x, z: mouth.z, h: 0 });
    }
    this.ship = { m: new THREE.Mesh(geo('ship'), this.mat), z: -500, x: -230 };
    this.ship.m.castShadow = true; this.scene.add(this.ship.m);
    // tied up along the pier
    for (let k = 0; k < 6; k++) {
      const kind = k % 3 === 0 ? 'trawler' : 'dinghy', m = new THREE.Mesh(geo(kind), this.mat), side = k % 2 ? 1 : -1;
      m.position.set(d.x0 + 3 + Math.floor(k / 2) * 7, SEA, d.z + side * (d.w / 2 + (kind === 'trawler' ? 1.2 : 0.8))); m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; m.castShadow = true; this.scene.add(m);
    }
    this.wakeList = [];
  }
  updateBoats(dt) {
    const t = G.time, W = (this.wakeList = []);
    for (const b of this.boatList) {
      let vx = 0, vz = 0;
      if (b.wait > 0) b.wait -= dt;
      else {
        const from = b.dir > 0 ? b.a : b.b, to = b.dir > 0 ? b.b : b.a, L = Math.hypot(to.x - from.x, to.z - from.z);
        b.u += b.v * dt / L;
        if (b.u >= 1) { b.u = 0; b.dir *= -1; b.wait = rand(15, 40); }
        // a curve out of the harbour mouth: straight down the middle, then off to the fishing ground
        const u = b.u, x = from.x + (to.x - from.x) * u, z = from.z + (to.z - from.z) * u;
        vx = (x - b.x) / Math.max(dt, 1e-3); vz = (z - b.z) / Math.max(dt, 1e-3); b.x = x; b.z = z; b.h = Math.atan2(to.x - from.x, to.z - from.z);
      }
      b.m.position.set(b.x, SEA + Math.sin(t * 1.3 + b.v) * 0.04, b.z); b.m.rotation.set(Math.sin(t * 0.9 + b.v) * 0.03, b.h, Math.sin(t * 1.1 + b.v) * 0.04);
      if (b.wait <= 0) W.push({ x: b.x, z: b.z, vx: Math.sin(b.h) * b.v, vz: Math.cos(b.h) * b.v });
    }
    const s = this.ship; s.z += dt * 1.6; if (s.z > 520) s.z = -520;
    s.m.position.set(s.x, SEA + Math.sin(t * 0.6) * 0.05, s.z); W.push({ x: s.x, z: s.z, vx: 0, vz: 1.6 });
  }
  // the northern lights: green and violet curtains rippling over the mountains after dark
  aurora() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uNight; varying vec2 vUv;
        float h(float x){ return fract(sin(x * 91.7) * 4375.5); }
        float n(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h(i), h(i + 1.), f); }
        void main(){
          float x = vUv.x * 14.0, w = n(x + uTime * 0.12) * 0.6 + n(x * 2.3 - uTime * 0.2) * 0.4;
          float rays = 0.55 + 0.45 * n(vUv.x * 160.0 + uTime * 0.6);
          float base = 0.18 + w * 0.25, band = smoothstep(base - 0.06, base + 0.02, vUv.y) * (1.0 - smoothstep(base, base + 0.55 + w * 0.2, vUv.y));
          vec3 c = mix(vec3(0.15, 1.0, 0.45), vec3(0.65, 0.25, 0.95), smoothstep(base + 0.15, base + 0.6, vUv.y));
          float a = band * rays * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * uNight;
          gl_FragColor = vec4(c * a * 0.9, a);
        }`,
    });
    this.auroraMat = mat;
    for (const [cx, cz, r0, a0, a1, y] of [[0, 0, 900, -2.4, -0.6, 160], [0, 0, 1050, 0.3, 1.6, 200], [0, 0, 820, 2.0, 3.4, 140]]) {
      const geo = new THREE.CylinderGeometry(r0, r0, 420, 64, 1, true, a0, a1 - a0).translate(cx, y + 210, cz);
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 3; m.frustumCulled = false; this.scene.add(m);
    }
  }
  rayHit(p) {
    for (const b of this.bergs) {
      if (b.gone || Math.abs(p.x - b.x) > b.R * 1.3 || Math.abs(p.z - b.z) > b.R * 1.3) continue;
      const t = (p.y - SEA) / b.H; if (t < 0 || t > 0.95 * (b.dent || 1)) continue;
      const rad = b.R * 0.9 * (b.kind === 'pin' ? 1 - t * 0.7 : b.kind === 'dome' ? Math.sqrt(Math.max(0.05, 1 - t * t)) : 1);
      if (Math.hypot(p.x - b.x, p.z - b.z) < rad) return { point: p.clone(), normal: new THREE.Vector3(p.x - b.x, 0.3, p.z - b.z).normalize(), cell: null, berg: b };
    }
    if (p.y <= SEA && terrainH(p.x, p.z) < SEA) return { point: new THREE.Vector3(p.x, SEA, p.z), normal: new THREE.Vector3(0, 1, 0), cell: null };
    return null;
  }
  // blasts blow craters in the ice and throw chunks; enough of a pounding and the berg breaks up and sinks
  onBlast(x, y, z, r, power) {
    const ice = new THREE.Color(0.86, 0.94, 1), FX = G.fx;
    for (const b of this.bergs || []) {
      if (b.gone || power < 0.5) continue;
      const dh = Math.hypot(b.x - x, b.z - z) - b.R;
      if (dh > r * 0.7) continue;
      // the crater: pull the ice in toward the berg's middle and down, around the point of impact
      const ca = Math.cos(-b.g.rotation.y), sa = Math.sin(-b.g.rotation.y), lx0 = x - b.x, lz0 = z - b.z;
      const lx = lx0 * ca + lz0 * sa, lz = -lx0 * sa + lz0 * ca, ly = y - SEA - b.m.position.y, R2 = Math.max(1.2, r * 0.9);
      const pos = b.m.geometry.attributes.position;
      let moved = 0;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i), d = Math.hypot(vx - lx, vy - ly, vz - lz);
        if (d > R2) continue;
        const f = (1 - d / R2) * Math.min(1, 0.35 + power * 0.12);
        pos.setXYZ(i, vx * (1 - 0.55 * f), Math.max(b.H * 0.02, vy - f * R2 * 0.55), vz * (1 - 0.55 * f)); moved++;
      }
      if (moved) { pos.needsUpdate = true; b.m.geometry.computeVertexNormals(); b.dent = Math.max(0.3, (b.dent || 1) - 0.05); }
      b.hp -= power * (1 + r * 0.25);
      const n = Math.min(14, 4 + Math.round(power * 2));
      for (let k = 0; k < n && FX; k++) FX.debris.spawn(x + rand(-1, 1), Math.max(SEA + 0.3, y), z + rand(-1, 1), new THREE.Vector3(rand(-4, 4), rand(2, 6), rand(-4, 4)), rand(0.2, 0.8), rand(0.2, 0.7), rand(0.2, 0.8), ice);
      if (b.hp <= 0) {
        // it breaks up: a burst of ice, white water, and what's left rolls over and sinks
        b.gone = true;
        for (let k = 0; k < 26 && FX; k++) FX.debris.spawn(b.x + rand(-b.R, b.R) * 0.7, SEA + rand(0.5, b.H * 0.7), b.z + rand(-b.R, b.R) * 0.7, new THREE.Vector3(rand(-3, 3), rand(1, 4), rand(-3, 3)), rand(0.4, 1.6), rand(0.4, 1.4), rand(0.4, 1.6), ice);
        for (let k = 0; k < 40 && FX; k++) FX.bits.emit(b.x + rand(-b.R, b.R), SEA + 0.1, b.z + rand(-b.R, b.R), rand(-1.5, 1.5), rand(1, 4), rand(-1.5, 1.5), 0.3, 1.6, 0.95, 0.98, 1, 1);
      }
    }
  }
  update(dt) {
    const t = G.time, n = G.night || 0;
    for (const m of this.signs) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.3 + n * 1.4);
    if (this.auroraMat) { this.auroraMat.uniforms.uTime.value = t; this.auroraMat.uniforms.uNight.value = Math.max(0, (n - 0.35) / 0.65); }
    // icebergs drift and bob; a hit one shrinks (and a broken one sinks away)
    for (const b of this.bergs || []) {
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (b.gone) { b.sink = (b.sink || 0) + dt; b.g.rotation.z = Math.min(1.2, b.sink * 0.5); b.g.visible = b.sink < 9; b.g.position.set(b.x, SEA - b.sink * b.sink * 0.25 * Math.max(1, b.H / 4), b.z); b.g.children[1].visible = false; continue; }
      b.g.position.set(b.x, SEA + Math.sin(t * 0.5 + b.ph) * 0.05 * b.R / 4, b.z); b.g.rotation.z = Math.sin(t * 0.3 + b.ph) * 0.01;
    }
    this.updateBoats(dt); this.updateFootball(dt);
    // snow falling now and then from the start (the ground is always white)
    if (!this.snowStarted && G.world) { this.snowStarted = true; if (Math.random() < 0.6) G.world.setWeather('snow'); }
  }
}

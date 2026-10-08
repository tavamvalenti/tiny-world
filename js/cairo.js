// CAIRO, EGYPT: the dense city on both banks of the Nile and the Giza plateau beyond. East of the river: the old
// European downtown round Tahrir Square, then Islamic Cairo: the Khan el-Khalili bazaar, Al-Azhar and Al-Hussein,
// Sultan Hassan and Al-Rifa'i under the Citadel hill with Muhammad Ali's mosque on top, Ibn Tulun's spiral minaret;
// everywhere else, packed low-rise apartment blocks (plastered concrete and unfinished red brick) with shops in
// their ground floors, rooftop water tanks and satellite dishes, alleys, courtyards and dead ends, and mosques and
// minarets all over. West of the river: Giza, just as dense, then the edge of the desert and the plateau with the
// three pyramids, the mastaba fields and the Sphinx, right at the edge of Giza. The Nile is wide and sunk below the
// corniche, crossed by three bridges, with feluccas, cruise boats and river taxis on it.
// Everything is destructible, the pyramids included (they are stepped buildings under a smooth limestone skin).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { policeHQ } from './maps.js';
import { hsl, tint, box, cyl, cone, sph, canvasTex, merged, netCtx, paintNetwork, topOf, hangOn, rnd, pyramidTris, latheTris } from './mapkit.js';
import { waterMaterial } from './water.js';
import { sfx, beachRadio } from './audio.js';

export const XS = [-122, -95, -32, -6, 20, 44, 66, 92, 116, 142];
export const ZS = [-142, -112, -86, -60, -38, -10, 14, 40, 64, 90, 116, 142];
const E = 360;
// ---------- the Nile: runs north-south between Giza (x < -95) and Cairo (x > -32), wanders a little ----------
export const NILE = { hw: 21, WL: -4.2, BED: -6.4 };     // sunk deep between the corniche walls: boats clear the bridges
export const nileX = (z) => -63 + 7 * Math.sin(z * 0.011 + 0.6);
export const inNile = (x, z) => Math.abs(x - nileX(z)) < NILE.hw;
export const BW = 520;                              // how far up and down the river the boats run before wrapping
const BRIDGES = [-86, -10, 64];                                   // 6th October, Qasr al-Nil (the lions), University
const onBridge = (x, z) => BRIDGES.some((b) => Math.abs(z - b) < 3.6) && Math.abs(x - nileX(z)) < NILE.hw + 3;
const wet = (x, z) => inNile(x, z) && !onBridge(x, z);
// ---------- the desert: flat city, then the edge of the Western Desert climbing to the Giza plateau ----------
const hh = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vn(x, z) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hh(ix, iz), b = hh(ix + 1, iz), c = hh(ix, iz + 1), d = hh(ix + 1, iz + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z, o = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
const sm = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
export const PYR = [
  { name: 'Great Pyramid', x: -185, z: -42, base: 50, h: 32, floors: 14 },
  { name: 'Pyramid of Khafre', x: -232, z: 14, base: 46, h: 31, floors: 14, cap: true },
  { name: 'Pyramid of Menkaure', x: -262, z: 64, base: 22, h: 14, floors: 8 },
];
export const SPHINX = { x: -152, z: 20 };
// roped-off ground round the monuments: nobody walks up to them, the way the real site is run
export const KEEP = [...PYR.map((p) => ({ x: p.x, z: p.z, hx: p.base / 2 + 6, hz: p.base / 2 + 6 })), { x: SPHINX.x, z: SPHINX.z, hx: 14, hz: 8 }];
export const inKeep = (x, z, m = 0) => KEEP.some((k) => Math.abs(x - k.x) < k.hx + m && Math.abs(z - k.z) < k.hz + m);
const PLATEAU = 4.5;
export function terrainH(x, z) {
  if (x > -124) return 0;
  // the escarpment up to the plateau, low dunes rolling off south and west; level round each pyramid's base
  const up = sm(-124, -146, x) * PLATEAU;
  let h = up + sm(-140, -190, x) * (fbm(x * 0.02 + 5, z * 0.02 + 1, 3) - 0.35) * 5;
  for (const p of PYR) { const d = Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) - p.base / 2; if (d < 10) h = h + (PLATEAU - h) * (1 - sm(0, 10, d)); }
  const ds = Math.hypot(x - SPHINX.x, z - SPHINX.z); if (ds < 18) h = h + (PLATEAU - 1.2 - h) * (1 - sm(9, 18, ds));
  return Math.max(0, h);
}

// ---------- domes: the outline of each style as a lathe profile [[radius, height], ...] from the roof up ----------
export function domeProfile(st, rr, ali) {
  const P = [], arc = (r0, y0, ry, pointed) => { for (let k = 0; k <= 10; k++) { const t = k / 10; P.push(pointed ? [r0 * Math.cos(t * Math.PI / 2) * (1 - t * 0.05), y0 + ry * t] : [r0 * Math.cos(t * Math.PI / 2), y0 + ry * Math.sin(t * Math.PI / 2)]); } };
  if (ali) { P.push([rr * 1.1, 0], [rr * 1.05, 1.2], [rr, 1.2]); arc(rr, 1.2, rr * 1.05, false); }
  else if (st === 'mamluk') { P.push([rr * 1.12, 0], [rr * 1.05, rr * 0.9], [rr, rr * 0.9]); arc(rr, rr * 0.9, rr * 1.35, true); }
  else if (st === 'ottoman') { P.push([rr * 1.06, 0], [rr * 1.02, rr * 0.4], [rr, rr * 0.4]); arc(rr, rr * 0.4, rr, false); }
  else { P.push([rr, 0], [rr * 0.95, rr * 0.3], [rr * 0.92, rr * 0.3]); arc(rr * 0.92, rr * 0.3, rr * 0.92, false); }
  return P;
}
const profR = (P, h) => { for (let k = 0; k + 1 < P.length; k++) if (h >= P[k][1] && h <= P[k + 1][1]) { const t = (h - P[k][1]) / Math.max(1e-6, P[k + 1][1] - P[k][1]); return P[k][0] + (P[k + 1][0] - P[k][0]) * t; } return 0; };

// ---------- palettes ----------
const PLASTER = () => { const r = Math.random(); if (r < 0.7) return hsl(rand(0.085, 0.115), rand(0.2, 0.34), rand(0.66, 0.78)); return r < 0.75 ? hsl(rand(0.08, 0.11), rand(0.22, 0.38), rand(0.66, 0.78)) : r < 0.55 ? hsl(rand(0.06, 0.09), rand(0.28, 0.42), rand(0.56, 0.66)) : r < 0.7 ? hsl(rand(0.1, 0.13), rand(0.1, 0.2), rand(0.7, 0.82)) : r < 0.8 ? hsl(rand(0.02, 0.05), rand(0.22, 0.34), rand(0.62, 0.72)) : r < 0.9 ? hsl(rand(0.12, 0.16), rand(0.25, 0.4), rand(0.66, 0.76)) : hsl(rand(0.5, 0.58), rand(0.06, 0.14), rand(0.62, 0.72)); };
const BRICKC = () => hsl(rand(0.04, 0.07), rand(0.26, 0.4), rand(0.56, 0.68));
const STONE = () => hsl(rand(0.09, 0.12), rand(0.25, 0.38), rand(0.66, 0.78));

export function cairo(B) {
  const ctx = netCtx({
    xs: XS, zs: ZS, roadW: 4.6, sw: 1.3, half: 160, extent: E, res: 4096, base: '#b49c78', centerLine: 'white', lights: true,
    // no road across the river except on the bridges; a few streets missing (T-junctions, merged blocks, the bazaar)
    skipEdge: (a, b) => {
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
      if (a.z === b.z && x0 === -95 && x1 === -32) return !BRIDGES.includes(a.z);
      if (a.x === b.x && a.x === 92 && z0 === -38 && z1 === -10) return true;           // the bazaar: one big block
      if (a.z === b.z && a.z === -10 && x0 === 66 && x1 === 92) return true;
      if (a.z === b.z && a.z === -10 && x0 === 92 && x1 === 116) return true;
      if (a.x === b.x && a.x === 20 && z0 === 90 && z1 === 116) return true;
      if (a.x === b.x && a.x === -150 && z0 === -60 && z1 === -38) return true;
      if (a.z === b.z && a.z === 40 && x0 === -6 && x1 === 20) return true;
      if (a.x === b.x && a.x === 116 && z0 === 90 && z1 === 142) return true;           // the Citadel hill
      if (a.z === b.z && a.z === 116 && x0 === 116 && x1 === 142) return true;
      if (a.x === b.x && a.x === 66 && z0 === 116 && z1 === 142) return true;
      return false;
    },
  }, B);
  const { city, g } = ctx;
  city.mapKind = 'cairo'; city.named = []; city.crowds = []; city.stationed = [];
  const C = (city.cai = { mosques: [], minarets: [], roofs: [], awnings: [], lanterns: [], rugs: [], spices: [], cafes: [], felucca: [], signs: [], laundry: [], lanes: [], plants: [] });
  const name = (S, o, x0, x1, z0, z1) => city.named.push({ S, o, x0, x1, z0, z1 });
  // white-and-black taxis, white microbuses, a few red-and-white buses, tuk-tuks (they are drawn over the motorbikes)
  city.vehicles = { taxi: { p: 0.24, colors: [0x101011] }, colors: [0xe8e6e0, 0xc8c4bc, 0x8a8f96, 0x1c1d22, 0x6b1a1a, 0x2a3448, 0xd8c8a0, 0x3a4a3a, 0x9a9a92, 0xb8a888],
    bus: { p: 0.14, kinds: [{ color: 0xe9e9e7, h: 1.45, len: 1.55 }, { color: 0xe9e9e7, h: 1.45, len: 1.55 }, { color: 0xb3201f, h: 1.7, len: 3.1 }] }, moto: 0.22 };
  // modern clothing for those not in galabeyas and abayas (js/roles.js dresses the rest)
  city.palette = { shirts: [0xe8e4dc, 0x2b2d33, 0x5a6b7a, 0x8a7a5a, 0x1f2a44, 0x6b4a3a, 0xc8c0b0, 0x3a4a3a, 0x9a3a2a, 0x4a4a52, 0xf0e8d8, 0x2a5a8a], pants: [0x2a3448, 0x1f1f22, 0x5a5044, 0x3a3a3e, 0x6b5a45, 0x33415e], sleeves: 0.35 };
  const blk = (i, j) => city.blocks.find((b) => b.i === i && b.j === j);
  const inBlocks = (x, z) => city.blocks.find((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);

  // ---------- ground: dusty asphalt, worn markings, sandy pavements ----------
  g.rect(-E, -E, E, E, '#b8a07a');
  paintNetwork(g, city, { asphalt: '#4e4c48', centerLine: 'white', edgeLine: null,
    stubs: (N) => [N.x === XS[XS.length - 1] ? { axis: 'x', to: E } : null, N.z === ZS[0] && N.x > -100 ? { axis: 'z', to: -E } : null, N.z === ZS[ZS.length - 1] && N.x > -100 ? { axis: 'z', to: E } : null, N.z === ZS[0] && N.x < -100 && N.x > -190 ? { axis: 'z', to: -E } : null, N.z === ZS[ZS.length - 1] && N.x < -100 && N.x > -190 ? { axis: 'z', to: E } : null].filter(Boolean) });
  // the Pyramids Road: out of Giza west across the desert edge to the plateau
  g.rect(-150, -12.3, -122, -7.7, '#4e4c48'); g.grainRect(-150, -12.3, -122, -7.7, 0.3, 30);
  for (const b of city.blocks) city.paintSidewalk(g, b, '#b6aa94');
  g.grainRect(-E, -E, E, E, 0.12, 40);

  // ---------- helpers ----------
  // every building claims its ground: no two ever overlap (overlapping walls flicker between their colours)
  const taken = [], solid = [];
  const free = (x, z, w, d) => !taken.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 && Math.abs(t.z - z) < (t.d + d) / 2);
  const reserve = (x, z, w, d) => taken.push({ x, z, w, d });
  const clearOf = (x, z, w, d) => !solid.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 - 0.02 && Math.abs(t.z - z) < (t.d + d) / 2 - 0.02);
  const M = (o) => { const b = B.add({ cell: 1.8, gh: 1.6, fh: 1.1, storefront: false, ...o }); b.noSigns = true; b.landmark = true; solid.push({ x: o.x, z: o.z, w: o.w, d: o.d }); return b; };
  // an apartment block: plaster or unfinished brick, shops at street level, a roof cluttered with tanks and dishes
  const flat = (x, z, w, d, o = {}) => {
    if (wet(x, z) || inNile(x - w / 2, z) || inNile(x + w / 2, z) || !clearOf(x, z, w, d)) return null;
    solid.push({ x, z, w, d });
    const brick = o.brick ?? Math.random() < (o.brickP ?? 0.22);
    // mostly 4 to 8 storeys; here and there the tall 9 to 13 storey blocks that make Cairo's skyline
    const floors = o.floors ?? (o.hi == null && Math.random() < 0.16 ? Math.round(rand(9, 13)) : Math.round(rand(o.lo ?? 4, o.hi ?? 8)));
    const b = B.add({ x, z, w, d, floors, style: brick ? 'cairobrick' : 'cairo', tint: brick ? BRICKC() : PLASTER(), cell: o.cell ?? 2, gh: 1.5, fh: 1.0, storefront: o.shop ?? true, base: o.base || 0 });
    b.kind = 'flat'; b.noSigns = !(o.shop ?? true) || Math.random() < 0.35;
    C.roofs.push(b);
    return b;
  };
  // pack a rectangle organically: split it again and again at uneven places, sometimes leaving an alley (1 to 2.4
  // wide), sometimes letting the halves touch; an alley may stop short (a dead end); now and then a lot is left as a
  // courtyard, or one building takes a whole big lot
  const pack = (R, o = {}) => {
    const out = [];
    const split = (r, depth) => {
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      const big = Math.random() < (o.bigP ?? 0.08) && w < 18 && d < 18 && w > 7 && d > 7;
      if (depth > 6 || big || (w < (o.maxW ?? 9) && d < (o.maxW ?? 9) && Math.random() < 0.7) || w < 3.4 || d < 3.4) {
        if (Math.random() < (o.yardP ?? 0.05) && w > 5 && d > 5) { g.rect(r.x0, r.z0, r.x1, r.z1, '#c8b48e'); if (Math.random() < 0.6) city.addTree((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, rand(0.8, 1.1), Math.random() < 0.5 ? 'palm' : 'round'); return; }
        for (const L of C.lanes) if (L.hit(r)) return;
        const b = (o.build || flat)((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, w - 0.05, d - 0.05, o);
        if (b) out.push(b);
        return;
      }
      const alongX = w > d ? true : w < d ? false : Math.random() < 0.5;
      const len = alongX ? w : d, at = len * rand(0.3, 0.7);
      const gap = Math.random() < (o.touchP ?? 0.45) ? 0 : rand(1.0, o.alleyMax ?? 2.2);
      if (alongX) {
        const xa = r.x0 + at - gap / 2, xb = r.x0 + at + gap / 2;
        if (gap > 0) { g.rect(xa, r.z0, xb, r.z1, o.alley || '#a8957a'); if (gap > 1.2) city.wanderZones.push({ x0: xa + 0.2, x1: xb - 0.2, z0: r.z0, z1: r.z1 }); }
        split({ x0: r.x0, x1: xa, z0: r.z0, z1: r.z1 }, depth + 1); split({ x0: xb, x1: r.x1, z0: r.z0, z1: r.z1 }, depth + 1);
      } else {
        const za = r.z0 + at - gap / 2, zb = r.z0 + at + gap / 2;
        if (gap > 0) { g.rect(r.x0, za, r.x1, zb, o.alley || '#a8957a'); if (gap > 1.2) city.wanderZones.push({ x0: r.x0, x1: r.x1, z0: za + 0.2, z1: zb - 0.2 }); }
        split({ x0: r.x0, x1: r.x1, z0: r.z0, z1: za }, depth + 1); split({ x0: r.x0, x1: r.x1, z0: zb, z1: r.z1 }, depth + 1);
      }
    };
    split(R, 0);
    return out;
  };
  // old winding lanes that cut across a block on a slant: buildings keep out of them, people walk them
  const lane = (pts, w = 1.8) => {
    const segs = [];
    for (let k = 0; k + 1 < pts.length; k++) segs.push([pts[k], pts[k + 1]]);
    const near = (x, z) => segs.some(([a, b]) => { const ux = b[0] - a[0], uz = b[1] - a[1], l2 = ux * ux + uz * uz, t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / l2)); return Math.hypot(a[0] + ux * t - x, a[1] + uz * t - z) < w / 2 + 0.3; });
    const L = { pts, w, hit: (r) => { for (let x = r.x0; x <= r.x1 + 0.01; x += Math.max(0.5, (r.x1 - r.x0) / 6)) for (let z = r.z0; z <= r.z1 + 0.01; z += Math.max(0.5, (r.z1 - r.z0) / 6)) if (near(x, z)) return true; return false; } };
    g.x.save(); g.x.strokeStyle = '#b09c7c'; g.x.lineWidth = w * g.k; g.x.lineCap = 'round'; g.x.lineJoin = 'round'; g.x.beginPath(); pts.forEach(([x, z], k) => (k ? g.x.lineTo(g.px(x), g.px(z)) : g.x.moveTo(g.px(x), g.px(z)))); g.x.stroke(); g.x.restore();
    for (const [a, b] of segs) for (let t = 0; t < 1; t += 0.25) { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; city.wanderZones.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5 }); }
    C.lanes.push(L);
    return L;
  };
  // a mosque: the prayer hall, its dome(s) and minaret(s); the style varies (Mamluk, Ottoman, plain neighbourhood)
  const mosque = (x, z, o = {}) => {
    const w = o.w ?? rand(7, 11), d = o.d ?? rand(7, 11), style = o.style || pick(['mamluk', 'mamluk', 'ottoman', 'plain', 'plain']);
    const hall = M({ x, z, w, d, floors: o.floors ?? 3, style: style === 'plain' ? 'cairo' : 'islamic', tint: style === 'plain' ? PLASTER() : STONE(), cell: 1.8, gh: 1.8, fh: 1.4 });
    reserve(x, z, w + 1, d + 1);
    const mx = x + (Math.random() < 0.5 ? -1 : 1) * (w / 2 - 1), mz = z + (Math.random() < 0.5 ? -1 : 1) * (d / 2 - 1);
    const mins = [];
    for (let k = 0; k < (o.minarets ?? 1); k++) {
      const px = k ? x - (mx - x) : mx, pz = k ? z - (mz - z) : mz;
      mins.push(M({ x: px, z: pz, w: 1.5, d: 1.5, floors: o.mh ?? Math.round(rand(9, 14)), style: 'islamic', tint: STONE(), cell: 0.75, gh: 1.6, fh: 1.2 }));
    }
    const m = { hall, mins, style, dome: o.dome ?? rand(0.32, 0.45), domes: o.domes || 1, major: !!o.major };
    C.mosques.push(m);
    return m;
  };

  // ================= THE NILE: corniches, docks, cafés under the palms =================
  // the river is a hole in the street level (the water is below, in the Cairo class)
  for (let z = -E; z < E; z += 2) for (const s of [-1, 1]) { const bx = nileX(z + 1) + s * (NILE.hw + 2.6); city.paintGrass(g, Math.min(bx, nileX(z + 1) + s * NILE.hw), z, Math.max(bx, nileX(z + 1) + s * NILE.hw), z + 2.05, Math.sin(z * 0.05 + s) > -0.3 ? '#6e8a3a' : '#9a8a62'); }
  for (let z = -140; z < 140; z += 6.5) for (const s of [-1, 1]) { const x = nileX(z) + s * (NILE.hw + 1.4); if (!onBridge(x, z)) city.addTree(x, z, rand(1.0, 1.3), 'palm'); }
  // the corniche cafés and the little docks where the feluccas tie up
  for (const [z, s] of [[-50, 1], [-30, 1], [20, 1], [44, 1], [-60, -1], [30, -1], [92, 1], [-120, -1]]) {
    const x = nileX(z) + s * (NILE.hw + 2.2);
    C.cafes.push({ x, z, s });
    city.crowds.push({ x: x + s * 0.4, z, r: 1.2, n: 6, act: 'sit', stay: true, face: { x: nileX(z), z } });
  }

  // ================= DOWNTOWN (Wust el-Balad) and TAHRIR =================
  {
    // Tahrir Square: the great roundabout plaza at the Cairo end of Qasr al-Nil bridge
    const t = { x: -19, z: -24 };
    g.x.save(); g.x.fillStyle = '#c6b8a0'; g.x.beginPath(); g.x.arc(g.px(t.x), g.px(t.z), 9 * g.k, 0, 6.283); g.x.fill(); g.x.fillStyle = '#7a8a4a'; g.x.beginPath(); g.x.arc(g.px(t.x), g.px(t.z), 4 * g.k, 0, 6.283); g.x.fill(); g.x.restore();
    C.tahrir = t; C.flags = [{ x: t.x, z: t.z }];
    city.crowds.push({ x: t.x + 6, z: t.z + 6, r: 1.4, n: 7 }, { x: t.x - 6, z: t.z - 6, r: 1.2, n: 5 });
    city.wanderZones.push({ x0: t.x - 7, x1: t.x + 7, z0: t.z - 7, z1: t.z + 7 });
    reserve(t.x, t.z, 20, 20);
    // the Egyptian Museum: neoclassical, rose-red
    const em = M({ x: -18, z: -50, w: 22, d: 14, floors: 3, style: 'concrete', tint: hsl(0.02, 0.45, 0.62), cell: 2.2, gh: 2, fh: 1.6 });
    reserve(-18, -50, 23, 15); C.museum = em;
    name('Tahrir Square', 'Tahrir Square', -30, -8, -36, -12); name('the Egyptian Museum', 'the Egyptian Museum', -29, -7, -57, -43);
    // downtown blocks: older, taller (6 to 10 floors), plastered, shopfronts all along
    for (const [i, j] of [[2, 3], [3, 3], [2, 4], [3, 4], [2, 5], [3, 5], [4, 4], [4, 5], [2, 6], [3, 6], [4, 6], [2, 2], [3, 2], [4, 3]]) {
      const b = blk(i, j); if (!b) continue;
      const R = { x0: b.lx0, z0: b.lz0, x1: b.lx1, z1: b.lz1 };
      for (const t2 of taken) { if (Math.abs(t2.x - (R.x0 + R.x1) / 2) < (t2.w + R.x1 - R.x0) / 2 && Math.abs(t2.z - (R.z0 + R.z1) / 2) < (t2.d + R.z1 - R.z0) / 2) { /* partly taken: pack round it */ } }
      pack(R, { lo: 6, hi: 10, brickP: 0.08, touchP: 0.7, maxW: 12, build: (x, z, w, d, o) => (free(x, z, w, d) ? flat(x, z, w, d, o) : null) });
    }
    name('Downtown', 'downtown Cairo', -32, 66, -86, 64);
  }

  // ================= ISLAMIC CAIRO: Khan el-Khalili, Al-Azhar, Al-Hussein =================
  {
    // the bazaar: a whole merged block of narrow lanes lined with tiny shops, awnings across overhead
    const bz = { x0: 68.3, x1: 113.7, z0: -35.7, z1: 11.7 };
    C.bazaar = bz;
    g.rect(bz.x0, bz.z0, bz.x1, bz.z1, '#a89474');
    // the lanes: a main street east-west, a cross street, and side lanes that twist and dead-end
    const mainZ = -12, crossX = 90;
    const lanesZ = [mainZ, -26, 2], lanesX = [crossX, 78, 103];
    for (const z of lanesZ) { g.rect(bz.x0, z - 1.3, bz.x1, z + 1.3, '#b4a07e'); city.wanderZones.push({ x0: bz.x0 + 0.5, x1: bz.x1 - 0.5, z0: z - 1, z1: z + 1 }, { x0: bz.x0 + 0.5, x1: bz.x1 - 0.5, z0: z - 1, z1: z + 1 }); }
    for (const x of lanesX) { g.rect(x - 1.2, bz.z0, x + 1.2, bz.z1, '#b4a07e'); city.wanderZones.push({ x0: x - 0.9, x1: x + 0.9, z0: bz.z0 + 0.5, z1: bz.z1 - 0.5 }, { x0: x - 0.9, x1: x + 0.9, z0: bz.z0 + 0.5, z1: bz.z1 - 0.5 }); }
    // the shops: two- and three-storey cells packed between the lanes, every one with a shopfront
    const xs = [bz.x0, ...lanesX.slice().sort((a, b) => a - b).flatMap((x) => [x - 1.3, x + 1.3]), bz.x1], zs = [bz.z0, ...lanesZ.slice().sort((a, b) => a - b).flatMap((z) => [z - 1.4, z + 1.4]), bz.z1];
    for (let i = 0; i + 1 < xs.length; i += 2) for (let j = 0; j + 1 < zs.length; j += 2) {
      const R = { x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] };
      pack(R, { lo: 2, hi: 4, brickP: 0.2, touchP: 0.75, maxW: 4.5, alleyMax: 1.3, yardP: 0.02, cell: 1.6, build: (x, z, w, d, o) => { const b = flat(x, z, w, d, o); if (b) { b.noSigns = Math.random() < 0.15; b.bazaar = true; } return b; } });
    }
    // what hangs in the lanes: awnings and cloth overhead, lanterns, rugs on the walls, spice and fabric stalls
    for (const z of lanesZ) for (let x = bz.x0 + 1; x < bz.x1 - 1; x += rand(1.6, 2.6)) { if (lanesX.some((lx) => Math.abs(lx - x) < 1.6)) continue; C.awnings.push({ x, z, w: 2.6, ax: 'z' }); if (Math.random() < 0.6) C.lanterns.push({ x: x + rand(-0.5, 0.5), z: z + rand(-0.8, 0.8), y: rand(2.4, 3.2) }); if (Math.random() < 0.45) C.rugs.push({ x: x + rand(-0.6, 0.6), z: z + (Math.random() < 0.5 ? -1.32 : 1.32), f: Math.random() < 0.5 ? -1 : 1 }); }
    for (const x of lanesX) for (let z = bz.z0 + 1; z < bz.z1 - 1; z += rand(1.6, 2.6)) { if (lanesZ.some((lz) => Math.abs(lz - z) < 1.7)) continue; C.awnings.push({ x, z, w: 2.4, ax: 'x' }); if (Math.random() < 0.6) C.lanterns.push({ x: x + rand(-0.7, 0.7), z: z + rand(-0.5, 0.5), y: rand(2.4, 3.2) }); }
    C.stalls = [];
    for (const z of lanesZ) for (let x = bz.x0 + 2; x < bz.x1 - 2; x += rand(3.5, 6)) C.stalls.push({ x, z: z + (Math.random() < 0.5 ? -0.75 : 0.75), kind: pick(['spice', 'spice', 'fabric', 'lamps', 'brass', 'fruit', 'souvenir', 'perfume']) });
    for (const x of lanesX) for (let z = bz.z0 + 2; z < bz.z1 - 2; z += rand(4, 6.5)) C.stalls.push({ x: x + (Math.random() < 0.5 ? -0.7 : 0.7), z, kind: pick(['spice', 'fabric', 'lamps', 'fruit', 'souvenir']) });
    // crowds: shoppers, tourists, people sitting outside the cafés with tea and shisha
    for (let k = 0; k < 16; k++) { const onZ = Math.random() < 0.6, x = onZ ? rand(bz.x0 + 2, bz.x1 - 2) : pick(lanesX), z = onZ ? pick(lanesZ) : rand(bz.z0 + 2, bz.z1 - 2); city.crowds.push({ x, z, r: 0.9, n: Math.round(rand(3, 6)), tag: 'shopper' }); }
    for (const [x, z] of [[83, mainZ + 1], [97, -26 + 1], [72, 2 - 1]]) city.crowds.push({ x, z, r: 0.9, n: 6, act: 'sit', stay: true, face: { x, z: z + 3 } });
    C.bazaarLanes = { lanesZ, lanesX };
    name('Khan el-Khalili', 'Khan el-Khalili', bz.x0, bz.x1, bz.z0, bz.z1);
    // Al-Hussein mosque on its square at the bazaar's west edge; Al-Azhar south of it
    g.rect(44 + 2.3, -35.7, 66 - 2.3, -16, '#d0c2a6'); city.wanderZones.push({ x0: 47, x1: 63, z0: -34, z1: -18 });
    city.crowds.push({ x: 55, z: -24, r: 2, n: 9 });
    const hus = mosque(55, -8, { w: 14, d: 12, floors: 3, style: 'mamluk', minarets: 2, mh: 15, major: true, dome: 0.4 }); C.hussein = hus;
    const az = mosque(80, 27, { w: 20, d: 14, floors: 3, style: 'mamluk', minarets: 3, mh: 16, major: true, domes: 2 }); C.azhar = az;
    g.rect(68.3, 16.3, 91.7, 37.7, '#cdbf9f');
    name('Al-Hussein Mosque', 'the Al-Hussein Mosque', 46, 64, -16, 2); name('Al-Azhar Mosque', 'Al-Azhar Mosque', 68, 92, 16, 38);
  }
  // the Citadel on its hill, Muhammad Ali's mosque on top; Sultan Hassan and Al-Rifa'i at its foot; Ibn Tulun
  {
    const cx = 128, cz = 122;
    C.citadel = { x: cx, z: cz };
    // the hill is built up as a rocky platform (a building of stone you can blow apart), the mosque on top of it
    const hill = M({ x: cx, z: cz, w: 26, d: 30, floors: 2, style: 'limestone', tint: hsl(0.09, 0.3, 0.62), cell: 2.6, gh: 2.4, fh: 2.2 });
    const wall = [];
    for (const [x, z, w, d] of [[cx, cz - 15.5, 27, 1.2], [cx, cz + 15.5, 27, 1.2], [cx - 13.5, cz, 1.2, 31], [cx + 13.5, cz, 1.2, 31]]) wall.push(M({ x, z, w, d, floors: 4, style: 'limestone', tint: hsl(0.09, 0.28, 0.66), cell: 1.2, gh: 1.6, fh: 1.4 }));
    const ma = M({ x: cx, z: cz + 2, w: 14, d: 14, floors: 3, style: 'islamic', tint: hsl(0.1, 0.12, 0.8), cell: 1.75, gh: 1.6, fh: 1.4, base: 4.6 });
    const mins = [M({ x: cx - 6.4, z: cz - 6, w: 1.2, d: 1.2, floors: 22, style: 'islamic', tint: hsl(0.1, 0.1, 0.82), cell: 0.6, gh: 1.4, fh: 1.15, base: 4.6 }), M({ x: cx + 6.4, z: cz - 6, w: 1.2, d: 1.2, floors: 22, style: 'islamic', tint: hsl(0.1, 0.1, 0.82), cell: 0.6, gh: 1.4, fh: 1.15, base: 4.6 })];
    C.mosques.push({ hall: ma, mins, style: 'ottoman', dome: 0.5, domes: 5, major: true, ali: true });
    C.citadel.parts = { hill, wall, ma, mins };
    name('the Citadel', 'the Citadel', 114, 142, 106, 140); name('the Mosque of Muhammad Ali', 'the Mosque of Muhammad Ali', 120, 136, 112, 132);
    const sh = mosque(102, 76, { w: 18, d: 13, floors: 5, style: 'mamluk', minarets: 2, mh: 18, major: true, dome: 0.5 }); C.sultanHassan = sh;
    const rf = mosque(102, 100, { w: 18, d: 12, floors: 5, style: 'mamluk', minarets: 2, mh: 17, major: true, domes: 2 });
    name('the Mosque of Sultan Hassan', 'the Mosque of Sultan Hassan', 92, 112, 68, 84); name("Al-Rifa'i Mosque", "the Al-Rifa'i Mosque", 92, 112, 92, 108);
    // Ibn Tulun: a huge courtyard mosque with its spiral minaret
    const it = { x: 40, z: 128 };
    g.rect(it.x - 12, it.z - 10, it.x + 12, it.z + 10, '#cdbf9f');
    for (const [x, z, w, d] of [[it.x, it.z - 9.5, 24, 1.6], [it.x, it.z + 9.5, 24, 1.6], [it.x - 11.5, it.z, 1.6, 19], [it.x + 11.5, it.z, 1.6, 19]]) M({ x, z, w, d, floors: 3, style: 'islamic', tint: hsl(0.08, 0.3, 0.7), cell: 1.6, gh: 1.6, fh: 1.3 });
    const spiral = M({ x: it.x - 15, z: it.z, w: 4, d: 4, floors: 8, style: 'limestone', tint: hsl(0.08, 0.3, 0.68), cell: 1.33, gh: 1.6, fh: 1.4, setbacks: [{ f: 3, n: 1 }] });
    C.tulun = { ...it, spiral };
    reserve(it.x - 2, it.z, 34, 24);
    name('the Mosque of Ibn Tulun', 'the Mosque of Ibn Tulun', 22, 54, 116, 140);
  }
  // Cairo Tower on the Giza bank: the lattice lotus tower
  C.tower = { x: -104, z: 22 };
  reserve(-104, 22, 7, 7);
  const ct = M({ x: -104, z: 22, w: 3.2, d: 3.2, floors: 26, style: 'concrete', tint: hsl(0.08, 0.15, 0.62), cell: 1.6, gh: 1.6, fh: 1.3 });
  C.towerB = ct; name('the Cairo Tower', 'the Cairo Tower', -110, -98, 16, 28);
  // the police station (with a few patrol cars) in Giza
  policeHQ(ctx, blk(0, 7));
  name('Giza police station', 'the Giza police station', -122, -95, 40, 64);

  // ================= THE REST OF THE CITY: dense blocks, winding lanes, mosques everywhere =================
  // a few old lanes cutting diagonally through Islamic Cairo and Giza
  lane([[44, 40], [52, 48], [58, 46], [64, 58]], 1.6); lane([[92, 40], [98, 50], [96, 56], [108, 64]], 1.6); lane([[116, -60], [124, -50], [122, -44], [138, -40]], 1.7);
  lane([[-122, 90], [-112, 98], [-114, 106], [-98, 114]], 1.6); lane([[66, 90], [74, 100], [72, 106], [90, 114]], 1.6);
  // neighbourhood mosques scattered through the blocks (placed before the housing so the housing packs round them)
  const mspots = [[-136, -126], [-108, -72], [-136, -24], [-110, 52], [-136, 102], [-164, 76], [-164, -48], [8, -98], [32, 52], [-20, 104], [56, 102], [80, -76], [126, -98], [130, -24], [128, 28], [56, 80], [8, 128], [-20, 52], [104, -52], [-164, 128]];
  for (const [x, z] of mspots) if (inBlocks(x, z) && free(x, z, 12, 12)) mosque(x, z);
  name('Giza', 'Giza', -124, -95, -142, 142); name('Islamic Cairo', 'Islamic Cairo', 44, 142, -86, 142);
  // every remaining block packed solid: low-rise informal brick and plaster, shops below, courtyards here and there
  for (const b of city.blocks) {
    if (b.x0 > -95 && b.x1 < -32) continue;                                   // the river
    if (b.i === 0 && b.j === 7) continue;                                     // the police station
    const R = { x0: b.lx0, z0: b.lz0, x1: b.lx1, z1: b.lz1 };
    if (R.x1 > 68 && R.x0 < 114 && R.z1 > -36 && R.z0 < 12) continue;          // the bazaar
    if (R.x1 > 114 && R.z0 > 104) continue;                                    // the Citadel
    const giza = b.x1 < -90, islamic = b.x0 > 40;
    pack(R, { lo: giza ? 4 : 3, hi: giza ? 9 : 7, brickP: giza ? 0.16 : islamic ? 0.12 : 0.08, touchP: 0.55, maxW: 8.5, yardP: 0.04, build: (x, z, w, d, o) => (free(x, z, w, d) ? flat(x, z, w, d, o) : null) });
  }
  // the city runs right up to the desert at the edge of Giza: half-built blocks, then sand
  for (let z = -140; z < 140; z += rand(6, 12)) { const w = rand(4, 6), d = rand(5, 9), x = -129 - rand(0, 3); if ((z < -36 || z > 34) && !inKeep(x, z, 3) && Math.random() < 0.7) flat(x, z, w, d, { brick: Math.random() < 0.3, lo: 2, hi: 5, shop: false, base: terrainH(x, z) }); }

  // ================= THE GIZA PLATEAU =================
  {
    // the three pyramids: stepped piles of limestone cells (their smooth casing skin is hung on them), each floor set
    // back a cell; the mastaba fields; the Sphinx in its hollow
    C.pyr = PYR.map((p) => {
      const n = p.floors, cell = p.base / (n * 2), fh = p.h / n, base = terrainH(p.x, p.z);
      const sb = []; for (let f = 1; f < n; f++) sb.push({ f, n: f });
      const b = M({ x: p.x, z: p.z, w: p.base, d: p.base, floors: n, style: 'limestone', tint: hsl(0.1, 0.2, 0.9), cell, gh: fh, fh, setbacks: sb, base, crumble: true });
      b.pyramid = p;
      return b;
    });
    C.queens = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const x = -250 + i * 7, z = -102 + j * 6.5; M({ x, z, w: 5, d: 3, floors: 1, style: 'limestone', tint: hsl(0.1, 0.2, rand(0.8, 0.9)), cell: 1.6, gh: 1.4, crumble: true, base: terrainH(x, z) }); }
    const sp = SPHINX, by = terrainH(sp.x, sp.z);
    // the destructible cores sit inside the carving (the sculpted stone hung on them is what shows)
    const body = M({ x: sp.x - 1.5, z: sp.z, w: 9, d: 2.4, floors: 1, style: 'limestone', tint: hsl(0.09, 0.2, 0.85), cell: 1.2, gh: 2.0, base: by, crumble: true });
    const head = M({ x: sp.x + 4.2, z: sp.z, w: 1.8, d: 1.8, floors: 1, style: 'limestone', tint: hsl(0.09, 0.2, 0.85), cell: 1.8, gh: 1.8, base: by + 2.5, crumble: true });
    C.sphinx = { body, head, x: sp.x, z: sp.z, y: by };
    C.rests = [{ top: head, under: [body] }];
    // tourists, camel men, a tour-bus park at the end of the Pyramids Road
    for (const k of KEEP) for (const [sx, sz] of [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 0.6], [0.5, 1]]) {
      const x = k.x + sx * (k.hx + 3.5), z = k.z + sz * (k.hz + 3.5);
      if (inKeep(x, z, 2) || x > -128 || Math.random() < 0.15) continue;
      city.crowds.push({ x, z, r: 2.6, n: Math.round(rand(6, 12)), act: Math.random() < 0.7 ? 'film' : undefined, face: { x: k.x, z: k.z }, tag: 'tourist' });
    }
    // camel men leading tourists about on their camels, some walking a spare camel, a few camels resting by the coaches
    C.camels = [];
    for (let k = 0; k < 14; k++) C.camels.push({ kind: 'ride' });
    for (let k = 0; k < 8; k++) C.camels.push({ kind: 'led' });
    for (const [x, z] of [[-150, -34], [-152, -36], [-138, 0], [-205, 58], [-207, 60], [-285, 10]]) C.camels.push({ kind: 'rest', x, z });
    C.busPark = { x0: -150, x1: -134, z0: -28, z1: -18 };
    g.rect(C.busPark.x0, C.busPark.z0, C.busPark.x1, C.busPark.z1, '#5a5650');
    for (const p of PYR) name('the ' + p.name, 'the ' + p.name, p.x - p.base / 2 - 4, p.x + p.base / 2 + 4, p.z - p.base / 2 - 4, p.z + p.base / 2 + 4);
    name('the Sphinx', 'the Sphinx', SPHINX.x - 12, SPHINX.x + 12, SPHINX.z - 6, SPHINX.z + 6); name("the Giza Plateau", "the Giza plateau", -370, -124, -165, 165);
  }

  // ---------- keep the river clear; people never walk on the water ----------
  city.lampsAlongBlock && city.blocks.forEach((b) => city.lampsAlongBlock(b, 9));
  city.lamps = city.lamps.filter((l) => !wet(l.x, l.z));
  city.trees = city.trees.filter((t) => !inNile(t.x, t.z));
  city.crowds = city.crowds.filter((c) => !wet(c.x, c.z));
  city.parked = city.parked.filter((p) => !inNile(p.x, p.z));
  const crosses = (a, b) => { for (let t = 0.1; t < 0.95; t += 0.1) if (wet(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true; return false; };
  for (const n of city.pedNodes) n.edges = n.edges.filter((e) => !crosses(n, city.pedNodes[e.to]));
  city.noPeds = [];
  for (let z = -E; z < E; z += 4) if (!onBridge(nileX(z + 2), z + 2) && !onBridge(nileX(z + 2), z) && !onBridge(nileX(z + 2), z + 4)) city.noPeds.push({ x0: nileX(z + 2) - NILE.hw, x1: nileX(z + 2) + NILE.hw, z0: z, z1: z + 4 });
  city.wanderZones = city.wanderZones.filter((w) => !wet((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2));
  // the river hole in the street-level ground
  g.x.save(); g.x.globalCompositeOperation = 'destination-out'; g.x.fillStyle = '#000'; g.x.beginPath();
  for (let z = -E; z <= E; z += 4) g.x.lineTo(g.px(nileX(z) - NILE.hw), g.px(z));
  for (let z = E; z >= -E; z -= 4) g.x.lineTo(g.px(nileX(z) + NILE.hw), g.px(z));
  g.x.closePath(); g.x.fill(); g.x.restore();
  // every dome is real stone: a stepped core of blocks (inside the round shell the Cairo class hangs on it) standing on
  // the hall's roof; it crumbles under fire and comes down when the hall under it goes
  for (const m of C.mosques) {
    const t = topOf(m.hall), r = Math.min(t.w, t.d) * m.dome, n = m.ali ? 1 : m.domes;
    m.domeB = [];
    for (let k = 0; k < n; k++) {
      const dx = n > 1 ? (k - (n - 1) / 2) * r * 2.3 : 0, rr = r * (n > 1 ? 0.8 : 1), P = domeProfile(m.style, rr, m.ali), H = P[P.length - 1][1];
      const NF = 5, fh = H / NF, hw0 = Math.min(profR(P, fh), rr) / Math.SQRT2, cell = (2 * hw0) / 6, sb = [];
      let floors = 0;
      for (let f = 0; f < NF; f++) { const inset = Math.max(0, Math.ceil((hw0 - profR(P, (f + 1) * fh) / Math.SQRT2) / cell - 0.05)); if (inset > 2) break; floors = f + 1; if (inset) sb.push({ f, n: inset }); }
      if (!floors) continue;
      const b = M({ x: t.cx + dx, z: t.cz, w: 2 * hw0, d: 2 * hw0, floors, style: m.style === 'plain' ? 'cairo' : 'islamic', tint: hsl(0.1, 0.2, 0.8), cell, gh: fh, fh, setbacks: sb, base: t.y, crumble: true });
      b.noSigns = true;
      m.domeB.push({ b, x: t.cx + dx, z: t.cz, y: t.y, rr, P, H });
      C.rests.push({ top: b, under: [m.hall] });
    }
  }
  // Tahrir Square painted last, so nothing else draws over it: one clean paved plaza across the block, a stone kerb
  // ring and the round lawn round the obelisk
  {
    const t = C.tahrir, tb = inBlocks(t.x, t.z);
    if (tb) { g.rect(tb.lx0, tb.lz0, tb.lx1, tb.lz1, '#d2c5ac'); g.grainRect(tb.lx0, tb.lz0, tb.lx1, tb.lz1, 0.1, 60); }
    g.circle(t.x, t.z, 9.6, '#c9bba0'); g.circle(t.x, t.z, 9.2, '#d8ccb4'); g.circle(t.x, t.z, 4.9, '#a89a80'); g.circle(t.x, t.z, 4.5, '#6f8a44');
    for (let i = 0; i < 260; i++) { const a2 = Math.random() * 6.283, r2 = Math.sqrt(Math.random()) * 4.3; g.circle(t.x + Math.cos(a2) * r2, t.z + Math.sin(a2) * r2, rand(0.15, 0.5), `rgba(${Math.random() < 0.5 ? '40,70,20' : '130,150,70'},${rand(0.05, 0.12)})`); }
  }
  city.hotspot = { x: 40, z: -10, r: 90 };
  city.river = { wet, inNile, WL: NILE.WL };
  return { ...ctx, agents: { cars: 150, peds: 1050, wanderFrac: 0.3 }, fog: 0xd9c49c, start: { x: 20, z: -10 }, zMin: -165, zMax: 165, xMin: -370, maxD: 240, yaw: -1.2, ownBackdrop: true, terrainH };
}

// ====================================================================================================
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const AR = '"Cairo", "Reem Kufi", "Geeza Pro", "Noto Naskh Arabic", "Arial", sans-serif';
function flagEG(c, w, h) { c.fillStyle = '#ce1126'; c.fillRect(0, 0, w, h / 3); c.fillStyle = '#ffffff'; c.fillRect(0, h / 3, w, h / 3); c.fillStyle = '#000000'; c.fillRect(0, h * 2 / 3, w, h / 3); c.fillStyle = '#c09300'; c.beginPath(); c.ellipse(w / 2, h / 2, h * 0.09, h * 0.12, 0, 0, 6.283); c.fill(); }

export class Cairo {
  constructor(scene, city) {
    this.scene = scene; this.city = city; const C = (this.C = city.cai);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.03 });
    this.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.65 });
    this.gilt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.3 });
    this.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.signs = [];
    if (G.groundMat) { G.groundMat.alphaTest = 0.5; G.groundMat.needsUpdate = true; }
    this.nile(); this.bridges(); this.pyramids(C.pyr); this.sphinx(C.sphinx); this.mosques(C.mosques); this.tulun(C.tulun); this.cairoTower(C.towerB); this.museum(C.museum); this.tahrir(C.tahrir);
    this.roofs(C.roofs); this.bazaar(C); this.cafes(C.cafes); this.streetSigns(); this.flags();
    this.desert(); this.boats(); this.vehiclesInit(); this.animalsInit(C); this.world(scene);
    this.restsT = 0;
  }
  add(geos, mat = this.mat, shadow = true) { return geos.length ? merged(geos, mat, this.scene, shadow) : null; }
  sign(w, h, draw, x, y, z, ry = 0, glow = 0.4, ds = false) {
    const tex = canvasTex(Math.max(16, Math.round(w * 72)), Math.max(16, Math.round(h * 72)), draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, transparent: true, alphaTest: 0.05, side: ds ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); this.signs.push(m.material); return m;
  }
  // decor grouped by storey and hung on a cell of that storey (it breaks away with the building)
  deck(b, geos, mat = this.mat) {
    if (!geos.length) return;
    const byF = new Map();
    for (const g of geos) { g.computeBoundingBox(); const c = g.boundingBox.getCenter(_v); let best = null, bd = 1e9; for (const cell of b.cells) { const d = Math.abs(cell.y - c.y) * 3 + Math.hypot(cell.x - c.x, cell.z - c.z) * 0.2; if (d < bd) { bd = d; best = cell; } } if (!byF.has(best.f)) byF.set(best.f, []); byF.get(best.f).push(g); }
    for (const [f, list] of byF) { const m = this.add(list, mat); m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new THREE.Vector3()); let best = null, bd = 1e9; for (const cell of b.cells) if (cell.f === f) { const d = Math.hypot(cell.x - c.x, cell.z - c.z); if (d < bd) { bd = d; best = cell; } } (best.props ||= []).push({ obj: [m], x: best.x, y: best.y, z: best.z }); }
  }

  // ---------- the Nile: wide, blue-green, sunk below the corniche walls ----------
  nile() {
    const { hw, WL, BED } = NILE, pos = [], uv = [], idx = [];
    let n = 0;
    for (let z = -1700; z <= 1700; z += 6) { const x = nileX(z), w = hw + Math.min(14, Math.max(0, Math.abs(z) - 360) * 0.02); pos.push(x - w, WL, z, x + w, WL, z); uv.push(0, z, 1, z); if (n) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } n++; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, waterMaterial({ color: 0x1d5486, flow: [0.0, -0.45], scale: 0.8, amp: 0.9 })); m.receiveShadow = true; this.scene.add(m);
    // the walls: worn stone, a dark wet band at the waterline; a sandy reed-lined foot on stretches of the Giza bank
    const wall = (s) => { const P = [], Cc = [], I = [], rows = [[0.1, 0x9a8c74], [-0.05, 0xb3a488], [WL + 0.5, 0x8a7e66], [WL + 0.1, 0x4a4434], [BED, 0x2a2620]], col = new THREE.Color(); let k = 0;
      for (let z = -1700; z <= 1700; z += 6) { const x = nileX(z) + s * (hw + Math.min(14, Math.max(0, Math.abs(z) - 360) * 0.02)); for (const [y, c] of rows) { P.push(x, y, z); col.set(c); Cc.push(col.r, col.g, col.b); } if (k) for (let r = 0; r + 1 < rows.length; r++) { const a = (k - 1) * rows.length + r, b = a + rows.length; if (s > 0) I.push(a, a + 1, b, b, a + 1, b + 1); else I.push(a, b, a + 1, b, b + 1, a + 1); } k++; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I); g.computeVertexNormals();
      const w = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide })); w.receiveShadow = true; this.scene.add(w); };
    wall(-1); wall(1);
    const bed = new THREE.Mesh(geo.clone().translate(0, BED - WL, 0), new THREE.MeshBasicMaterial({ color: 0x1c1a14 })); this.scene.add(bed);
  }
  bridges() {
    const P = [], A = [], L = [];
    for (const bz of BRIDGES) {
      const cx = nileX(bz), x0 = cx - NILE.hw - 2.8, x1 = cx + NILE.hw + 2.8, len = x1 - x0, mid = (x0 + x1) / 2;
      P.push(box(len, 0.42, 5.2, mid, -0.2, bz, 0x4e4c48), box(len, 0.5, 0.95, mid, -0.17, bz - 3.1, 0xb6aa94), box(len, 0.5, 0.95, mid, -0.17, bz + 3.1, 0xb6aa94));
      for (const s of [-1, 1]) A.push(box(len, 0.65, 0.18, mid, 0.33, bz + s * 3.55, 0x5a6a5a), box(len, 0.08, 0.26, mid, 0.68, bz + s * 3.55, 0x3a4a3a));
      // three steel arches on stone piers; ornate cast-iron lamp standards
      const piers = [-10, 10];
      for (const p of piers) { P.push(box(2, NILE.WL + 0.4 - NILE.BED, 7.6, cx + p, (NILE.WL + NILE.BED) / 2, bz, 0xa89a7c), box(1.4, -0.45 - NILE.WL, 7, cx + p, (NILE.WL - 0.45) / 2, bz, 0xb8aa8a)); for (const s of [-1, 1]) P.push(cyl(1, 1, NILE.WL + 0.6 - NILE.BED, cx + p, (NILE.WL + NILE.BED) / 2, bz + s * 3.8, 0xa89a7c, 12)); }
      for (const [a, b] of [[-NILE.hw, -11], [-9, 9], [11, NILE.hw]]) for (const s of [-1, 1]) for (let t = 0; t <= 1.001; t += 0.1) { const u = cx + a + (b - a) * t, y = -0.5 - (1 - Math.sin(t * Math.PI)) * (b - a > 15 ? 2.2 : 1.4); A.push(box((b - a) / 10 + 0.05, 0.22, 0.2, u, Math.min(-0.5, y), bz + s * 3.3, 0x4a5a4a)); }
      for (let u = x0 + 2; u < x1 - 1; u += 5) for (const s of [-1, 1]) { L.push(cyl(0.05, 0.08, 1.9, u, 1.0, bz + s * 3.55, 0x1c1e1c, 8), box(0.6, 0.05, 0.05, u, 1.9, bz + s * 3.55, 0x1c1e1c)); }
      // Qasr al-Nil: the four bronze lions guarding the ends
      if (bz === -10) for (const ex of [x0 - 0.8, x1 + 0.8]) for (const s of [-1, 1]) { const lx = ex, lz = bz + s * 4.4; A.push(box(1.6, 1, 1, lx, 0.5, lz, 0xc8bca0), box(1.3, 0.55, 0.5, lx, 1.28, lz, 0x3a4a3a), sph(0.32, lx + (ex < cx ? 0.55 : -0.55), 1.55, lz, 0x3a4a3a), cyl(0.1, 0.1, 0.5, lx - 0.3, 1.25, lz - 0.16, 0x3a4a3a, 6)); }
    }
    this.add(P); this.add(A, this.metal); this.add(L, this.metal);
    const globes = []; for (const bz of BRIDGES) { const cx = nileX(bz); for (let u = cx - NILE.hw; u < cx + NILE.hw + 2; u += 5) for (const s of [-1, 1]) globes.push(sph(0.13, u + 0.25, 1.95, bz + s * 3.55, 0xffffff), sph(0.13, u - 0.25, 1.95, bz + s * 3.55, 0xffffff)); }
    this.lampGlobe = this.add(globes, new THREE.MeshBasicMaterial({ color: 0xffe8c0 }), false);
  }
  // ---------- the pyramids: smooth limestone casing over the stepped core; Khafre keeps its polished cap ----------
  // the casing: one textured mesh per pyramid (the stone from the reference photo), its slope running over the
  // outer edge of every step; each triangle belongs to the outer block under it and is cut out when that block goes
  pyramids(list) {
    const out = (t) => t.map(([a, b, c]) => [a, c, b]);                    // the shared helper winds faces inward
    const tex = new THREE.TextureLoader().load('assets/pyramid-stone.jpg');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95 });
    const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
    for (const b of list) {
      const p = b.pyramid, base = b.cells[0].y - b.cells[0].hy, n = p.floors, cl = p.base / (n * 2), fh = p.h / n;
      // the outer ring of blocks on each floor (the only ones the casing sits on)
      const ring = [];
      for (let f = 0; f < n; f++) { const fc = b.cells.filter((c) => c.f === f); if (!fc.length) continue; const i0 = Math.min(...fc.map((c) => c.i)), i1 = Math.max(...fc.map((c) => c.i)), k0 = Math.min(...fc.map((c) => c.k)), k1 = Math.max(...fc.map((c) => c.k)); ring[f] = fc.filter((c) => c.i === i0 || c.i === i1 || c.k === k0 || c.k === k1); }
      const tris = out(pyramidTris(p.x, p.z, p.base / 2 + cl + 0.35, 0.2, base, base + p.h + fh + 0.6, n * 2));
      const pos = new Float32Array(tris.length * 9), col = new Float32Array(tris.length * 9), uv = new Float32Array(tris.length * 6), owner = new Map(), cc = new THREE.Color();
      tris.forEach(([a, b2, c], t) => {
        const cx = (a.x + b2.x + c.x) / 3, cy = (a.y + b2.y + c.y) / 3, cz = (a.z + b2.z + c.z) / 3;
        const f0 = Math.max(0, Math.min(n - 1, Math.floor((cy - base) / fh)));
        let best = null, bd = 1e9;
        for (let f = Math.max(0, f0 - 1); f <= Math.min(n - 1, f0 + 1); f++) for (const q of ring[f] || []) { const d = Math.hypot(q.x - cx, (q.y - cy) * 1.5, q.z - cz); if (d < bd) { bd = d; best = q; } }
        if (!owner.has(best)) owner.set(best, []); owner.get(best).push(t);
        _n.crossVectors(_e1.subVectors(b2, a), _e2.subVectors(c, a)).normalize();
        const side = Math.abs(_n.x) > Math.abs(_n.z), slant = 1 / Math.max(0.3, Math.hypot(_n.x, _n.z));
        const h = (cy - base) / p.h; cc.setHSL(0.1, 0.35, p.cap && h > 0.8 ? 1.0 : 0.96 + Math.sin(cx * 0.7 + cz * 0.9) * 0.03, THREE.SRGBColorSpace);
        [a, b2, c].forEach((v, k) => { pos.set([v.x, v.y, v.z], t * 9 + k * 3); col.set([cc.r, cc.g, cc.b], t * 9 + k * 3); uv.set([(side ? v.z : v.x) / 7, v.y * slant / 5.2], t * 6 + k * 2); });
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; this.scene.add(m);
      for (const [cell, ts] of owner) (cell.props ||= []).push({ x: cell.x, y: cell.y, z: cell.z, noDebris: true, hide: () => { for (const t of ts) pos.fill(0, t * 9, t * 9 + 9); g.attributes.position.needsUpdate = true; } });
    }
  }
  sphinx(s) {
    const { body, head } = s, y = s.y, x = s.x, z = s.z, stone = 0xc4ac88, dark = 0xa89070, P = [], H = [];
    // the lion lying facing east: the long weathered back, the raised forequarters and chest under the head, the
    // front paws stretched out in front, the haunch and the tail curled along the flank
    P.push(tint(new THREE.SphereGeometry(1, 18, 12).scale(6.4, 2.1, 2.1).translate(x - 1.5, y + 1.2, z), stone));
    P.push(tint(new THREE.SphereGeometry(1, 14, 10).scale(2.0, 2.4, 1.7).translate(x + 3.4, y + 1.6, z), stone));
    P.push(tint(new THREE.SphereGeometry(1, 12, 8).scale(1.8, 1.6, 2.2).translate(x - 6.4, y + 1.1, z), stone));
    for (const sz of [-0.85, 0.85]) P.push(box(5.2, 0.75, 0.85, x + 7.6, y + 0.38, z + sz, stone), box(0.5, 0.6, 0.9, x + 10.1, y + 0.3, z + sz, dark));
    P.push(box(4.6, 0.22, 0.22, x - 4.2, y + 0.45, z + 2.0, dark), box(10, 0.12, 0.1, x - 1.5, y + 1.6, z + 2.05, dark), box(10, 0.12, 0.1, x - 1.5, y + 1.6, z - 2.05, dark));
    // the hollow it lies in: a low stone enclosure wall
    for (const [w, d, ox, oz] of [[26, 0.6, 0, -6.5], [26, 0.6, 0, 6.5], [0.6, 13, -13, 0]]) P.push(box(w, 0.9, d, x + ox, y + 0.45, z + oz, 0xb8986a));
    this.deck(body, P);
    // the head: the striped nemes headdress squared off round the face, its lappets falling to the chest, the face
    // looking east with the nose broken off
    const hy = head.cells[0].y - head.cells[0].hy, hx = x + 4.2;
    H.push(box(2.1, 1.95, 2.2, hx, hy + 0.95, z, stone), tint(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.55, 1.15).translate(hx - 0.05, hy + 1.9, z), stone));
    for (let k = 0; k < 7; k++) H.push(box(2.14, 0.08, 2.24, hx, hy + 0.35 + k * 0.24, z, k % 2 ? dark : stone));
    for (const sz of [-1.0, 1.0]) H.push(box(0.6, 2.4, 0.4, hx + 0.9, hy - 0.2, z + sz, stone));
    H.push(box(0.3, 1.25, 1.3, hx + 1.15, hy + 1.0, z, 0xc8b08c), box(0.06, 0.12, 0.6, hx + 1.32, hy + 1.3, z, 0x6a4a2a), box(0.12, 0.25, 0.2, hx + 1.32, hy + 1.0, z, dark), box(0.06, 0.06, 0.5, hx + 1.32, hy + 0.7, z, 0x6a4a2a));
    this.deck(head, H);
  }
  // ---------- mosques: domes and minarets in different styles ----------
  // pieces of decor merged into one mesh but tied each to the block under it: when that block goes, its pieces are
  // cut out of the mesh (one draw call per group instead of one per piece). parts: [{ g, cell }]
  cutout(parts, mat = this.mat) {
    parts = parts.filter((q) => q.cell);
    if (!parts.length) return null;
    const geos = parts.map((q) => (q.g.index ? q.g.toNonIndexed() : q.g)), merged = mergeGeometries(geos);
    if (!merged) return null;
    const pos = merged.attributes.position.array, ranges = new Map(); let off = 0;
    geos.forEach((g, i) => { const n = g.attributes.position.count * 3, c = parts[i].cell; if (!ranges.has(c)) ranges.set(c, []); ranges.get(c).push(off, off + n); off += n; });
    const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    for (const [c, r] of ranges) (c.props ||= []).push({ x: c.x, y: c.y, z: c.z, noDebris: true, hide: () => { for (let k = 0; k < r.length; k += 2) pos.fill(0, r[k], r[k + 1]); merged.attributes.position.needsUpdate = true; } });
    return m;
  }
  // the nearest block of building b (on floor f, if given) to a point
  nearCell(b, x, y, z, f = null) { let best = null, bd = 1e9; for (const c of b.cells) { if (f != null && c.f !== f) continue; const d = Math.hypot(c.x - x, (c.y - y) * 0.7, c.z - z); if (d < bd) { bd = d; best = c; } } return best; }
  // dome surfaces: carved stone (zigzag chevrons), ribbed lead sheets, or painted plaster; drawn pale so each dome's
  // colour tints them
  domeMats() {
    if (this._dm) return this._dm;
    const T = (draw) => { const t = canvasTex(256, 256, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }); };
    const noise = (c, w, h, a) => { for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(60,50,40,${Math.random() * a})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6); } };
    this._dm = {
      stone: T((c, w, h) => { c.fillStyle = '#efe8da'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(110,90,60,.55)'; c.lineWidth = 5;
        for (let y = -32; y < h + 32; y += 32) { c.beginPath(); for (let x = 0; x <= w; x += 32) c.lineTo(x, y + ((x / 32) % 2 ? 16 : 0)); c.stroke(); }
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; for (let y = -30; y < h + 32; y += 32) { c.beginPath(); for (let x = 0; x <= w; x += 32) c.lineTo(x, y + ((x / 32) % 2 ? 16 : 0)); c.stroke(); }
        c.fillStyle = 'rgba(110,90,60,.25)'; for (let y = 0; y < h; y += 64) c.fillRect(0, y, w, 2); noise(c, w, h, 0.12); }),
      lead: T((c, w, h) => { c.fillStyle = '#dde0e4'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(40,46,54,.45)'; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 3, h);
        c.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 4; x < w; x += 32) c.fillRect(x, 0, 2, h); c.fillStyle = 'rgba(40,46,54,.25)'; for (let y = 0; y < h; y += 42) c.fillRect(0, y, w, 2);
        for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '30,34,40'},${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 12, 2 + Math.random() * 8); } }),
      plaster: T((c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(90,80,60,.14)'; for (let y = 0; y < h; y += 24) c.fillRect(0, y, w, 1.5); noise(c, w, h, 0.16);
        for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(120,100,70,${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 10 + Math.random() * 30); } }),
    };
    return this._dm;
  }
  // a geometry with a flat colour that keeps its texture coordinates (tint() drops them)
  paint(geo, col) { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(col), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) c.toArray(a, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }
  mosques(list) {
    const DM = this.domeMats();
    for (const m of list) {
      const t = topOf(m.hall), y = t.y, st = m.style, topF = m.hall.floors - 1;
      const kind = m.ali || st === 'ottoman' ? 'lead' : st === 'mamluk' ? 'stone' : 'plaster';
      const domeCol = kind === 'lead' ? 0x8a9098 : kind === 'stone' ? 0xd2bc94 : pick([0x3a8a5a, 0xece6da, 0x2a6a8a, 0xc8b48a]);
      const shell = [], gilt = [], plain = [];
      // each dome's round shell over its stone core: a lathe of the style's outline, every triangle on the block behind it
      for (const d of m.domeB || []) {
        const rep = kind === 'lead' ? 6 : 4, outer = d.b.cells;
        for (const [a, b2, c] of latheTris(d.x, d.z, d.P.map(([r, h]) => [r, d.y + h]), 28)) {
          const cx = (a.x + b2.x + c.x) / 3, cy = (a.y + b2.y + c.y) / 3, cz = (a.z + b2.z + c.z) / 3;
          const tri = [a, b2, c], nrm = new THREE.Vector3().subVectors(b2, a).cross(new THREE.Vector3().subVectors(c, a));
          if (nrm.x * (cx - d.x) + nrm.z * (cz - d.z) + nrm.y * Math.max(0, cy - d.y) * 0.2 < 0) tri.reverse();              // face outward
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((v) => [v.x, v.y, v.z]), 3)); g.computeVertexNormals();
          let us = tri.map((v) => (Math.atan2(v.z - d.z, v.x - d.x) / (Math.PI * 2) + 0.5) * rep); const mx = Math.max(...us); us = us.map((u) => (mx - u > rep / 2 ? u + rep : u));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(tri.flatMap((v, k) => [us[k], (v.y - d.y) / d.H * 2.2]), 2));
          const drum = cy - d.y < d.P[2][1];
          shell.push({ g: this.paint(g, drum && kind !== 'plaster' ? (kind === 'lead' ? 0xd8d4cc : 0xd8c4a0) : drum ? 0xece6da : domeCol), cell: this.nearCell(d.b, cx, cy, cz) });
        }
        // the gilt finial and crescent on the top block
        const ty = d.y + d.H, topC = this.nearCell(d.b, d.x, ty, d.z, d.b.floors - 1);
        gilt.push({ g: cyl(0.06, 0.1, 1.0, d.x, ty + 0.5, d.z, 0xd9b04a, 6), cell: topC }, { g: tint(new THREE.TorusGeometry(0.24, 0.05, 6, 12, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(d.x, ty + 1.15, d.z), 0xd9b04a), cell: topC });
      }
      // Muhammad Ali: the half-domes and corner domes round the great dome, lead over the hall's roof
      if (m.ali) {
        const r = Math.min(t.w, t.d) * m.dome;
        for (const [sx, sz, k] of [[1, 0, 0.62], [-1, 0, 0.62], [0, 1, 0.62], [0, -1, 0.62], [1, 1, 0.32], [-1, 1, 0.32], [1, -1, 0.32], [-1, -1, 0.32]]) {
          const px = t.cx + sx * r * (k > 0.5 ? 1.15 : 1.3), pz = t.cz + sz * r * (k > 0.5 ? 1.15 : 1.3), g = new THREE.SphereGeometry(r * k, 16, 8, 0, 6.283, 0, Math.PI / 2).translate(px, y + (k > 0.5 ? 0.4 : 0.2), pz);
          const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 2);
          shell.push({ g: this.paint(g, 0x8a9098), cell: this.nearCell(m.hall, px, y, pz, topF) });
        }
      }
      // crenellations along the roof edge, each tied to the roof block under it
      for (let u = t.ax + 0.4; u < t.bx; u += 0.7) for (const zz of [t.az, t.bz]) plain.push({ g: box(0.3, 0.35, 0.18, u, y + 0.18, zz, st === 'plain' ? 0xe0d6c4 : 0xd0bc94), cell: this.nearCell(m.hall, u, y, zz, topF) });
      this.cutout(shell, DM[kind]); this.cutout(gilt, this.gilt); this.cutout(plain);
      for (const mi of m.mins) this.minaret(mi, st, m.ali);
    }
  }
  minaret(b, st, tall) {
    const t = topOf(b), x = t.cx, z = t.cz, y = t.y, P = [], Gd = [], w = t.w;
    // balconies on brackets partway up the shaft (hung on that storey), then the top
    const S = [];
    for (const c of b.cells) if (c.f > 2 && c.f % 4 === 0) S.push(cyl(w * 0.95, w * 0.7, 0.25, c.x, c.y + c.hy, c.z, 0xd8c8a4, 10), cyl(w * 0.98, w * 0.98, 0.35, c.x, c.y + c.hy + 0.3, c.z, 0xe0d4b8, 10));
    this.deck(b, S);
    if (st === 'ottoman') { P.push(cyl(w * 0.42, w * 0.48, 1.4, x, y + 0.7, z, 0xece6da, 12), cyl(w * 0.75, w * 0.75, 0.25, x, y + 1.5, z, 0xd8d4cc, 12), tint(new THREE.ConeGeometry(w * 0.48, tall ? 5 : 3.2, 12).translate(x, y + (tall ? 4.2 : 3.2), z), 0x8a9098)); Gd.push(cyl(0.04, 0.05, 0.8, x, y + (tall ? 7 : 5.2), z, 0xd9b04a, 6)); }
    else if (st === 'mamluk') { P.push(cyl(w * 0.45, w * 0.48, 1.6, x, y + 0.8, z, 0xd8c4a0, 8), cyl(w * 0.7, w * 0.62, 0.3, x, y + 1.7, z, 0xd0bc94, 8), cyl(w * 0.32, w * 0.35, 1.2, x, y + 2.4, z, 0xd8c4a0, 8)); for (let a = 0; a < 6.283; a += 0.785) P.push(cyl(0.05, 0.05, 1, x + Math.cos(a) * w * 0.32, y + 3.4, z + Math.sin(a) * w * 0.32, 0xd8c4a0, 4)); P.push(tint(new THREE.SphereGeometry(w * 0.4, 12, 10).scale(1, 1.4, 1).translate(x, y + 4.4, z), 0xd2bc94)); Gd.push(cyl(0.04, 0.05, 0.9, x, y + 5.3, z, 0xd9b04a, 6), tint(new THREE.TorusGeometry(0.16, 0.035, 6, 10, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(x, y + 5.9, z), 0xd9b04a)); }
    else { P.push(cyl(w * 0.75, w * 0.75, 0.25, x, y + 0.12, z, 0xece6da, 10), cyl(w * 0.38, w * 0.4, 1.4, x, y + 0.9, z, 0xece6da, 10), tint(new THREE.SphereGeometry(w * 0.42, 10, 8, 0, 6.283, 0, Math.PI / 2).translate(x, y + 1.6, z), pick([0x3a8a5a, 0xece6da, 0xc8b48a])), box(0.3, 0.25, 0.3, x + w * 0.5, y + 1.2, z, 0x3a3a3a)); Gd.push(cyl(0.04, 0.05, 0.7, x, y + 2.3, z, 0xd9b04a, 6)); }
    hangOn(b, [this.add(P), this.add(Gd, this.gilt)].filter(Boolean), b.floors - 1);
    (this.minTops ||= []).push({ x, y: y + 2, z });
  }
  // Ibn Tulun's spiral minaret: the outside stair winding round the drum
  tulun(t) {
    const b = t.spiral, tt = topOf(b), x = tt.cx, z = tt.cz, P = [];
    for (let k = 0; k < 60; k++) { const a = k * 0.32, y = 1 + k * 0.17, r = 2.1 - k * 0.006; P.push(tint(new THREE.BoxGeometry(0.9, 0.12, 0.5).translate(r, 0, 0).rotateY(-a).translate(x, y, z), 0xc8b088)); }
    this.deck(b, P);
    hangOn(b, [this.add([cyl(0.7, 0.8, 1.6, x, tt.y + 0.8, z, 0xd0b890, 8), cyl(0.5, 0.55, 1, x, tt.y + 2.1, z, 0xd0b890, 8), tint(new THREE.SphereGeometry(0.5, 10, 8).scale(1, 1.3, 1).translate(x, tt.y + 2.9, z), 0xc8b088)])], b.floors - 1);
  }
  // the Cairo Tower: a lattice of crossing concrete ribs like a lotus stem, the flower crown and the deck at the top
  cairoTower(b) {
    const t = topOf(b), x = t.cx, z = t.cz, P = [];
    for (const c of b.cells) if (c.f > 0 && c.f % 2 === 0) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const k of [-1, 1]) P.push(tint(new THREE.BoxGeometry(sx ? 0.06 : 1.7, 1.4, sz ? 0.06 : 1.7).rotateX(sx ? k * 0.5 : 0).rotateZ(sz ? k * 0.5 : 0).translate(c.x + sx * c.hx * 1.02, c.y, c.z + sz * c.hz * 1.02), 0xe0d4be));
    this.deck(b, P);
    const Q = [cyl(2.2, 1.6, 1.4, x, t.y + 0.7, z, 0xd8ccb4, 16), cyl(2.3, 2.3, 0.9, x, t.y + 1.8, z, 0x2a3a4a, 16), cyl(2.4, 2.2, 0.3, x, t.y + 2.4, z, 0xd8ccb4, 16), cyl(0.15, 0.2, 3, x, t.y + 4, z, 0xdddddd, 6)];
    for (let a = 0; a < 6.283; a += 0.52) Q.push(tint(new THREE.ConeGeometry(0.45, 1.6, 4).rotateZ(Math.cos(a) * 0.5).rotateX(-Math.sin(a) * 0.5).translate(x + Math.cos(a) * 1.9, t.y + 0.4, z + Math.sin(a) * 1.9), 0xd8ccb4));
    hangOn(b, [this.add(Q)], b.floors - 1);
  }
  museum(b) {
    const t = topOf(b), P = [box(5, 3.4, 1.2, t.cx, 1.7 + 0.1, t.bz + 0.6, 0xd88a7a), tint(new THREE.SphereGeometry(2.4, 18, 10, 0, 6.283, 0, Math.PI / 2).translate(t.cx, t.y, t.cz), 0xc8786a)];
    for (let k = 0; k < 4; k++) P.push(cyl(0.22, 0.25, 3, t.cx - 1.8 + k * 1.2, 1.6, t.bz + 1.25, 0xe8d8c8, 8));
    hangOn(b, [this.add(P)]);
    this.sign(4.4, 0.6, (c, w, h) => { c.fillStyle = '#e8d8c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a2a1a'; c.font = `700 ${h * 0.6}px ${AR}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('المتحف المصري', w / 2, h / 2); }, t.cx, 3.7, t.bz + 1.22, 0, 0.2);
  }
  tahrir(t) {
    // the obelisk in the middle of the roundabout, flagpoles
    this.add([box(1.2, 0.6, 1.2, t.x, 0.3, t.z, 0xb8a888), tint(new THREE.CylinderGeometry(0.25, 0.45, 7, 4).rotateY(Math.PI / 4).translate(t.x, 4.1, t.z), 0xb88a6a), tint(new THREE.ConeGeometry(0.36, 0.8, 4).rotateY(Math.PI / 4).translate(t.x, 8, t.z), 0xd9b04a)]);
  }
  // ---------- the roofs: water tanks, satellite dishes, AC units, stair huts, rebar sticking up from the unfinished
  // top floors, washing lines, the odd pigeon tower. All instanced, each piece hung on its roof cell. ----------
  roofs(list) {
    const geos = {
      tank: mergeGeometries([new THREE.CylinderGeometry(0.32, 0.32, 0.6, 10).translate(0, 0.62, 0), new THREE.BoxGeometry(0.06, 0.32, 0.06).translate(0.2, 0.16, 0.2), new THREE.BoxGeometry(0.06, 0.32, 0.06).translate(-0.2, 0.16, -0.2), new THREE.BoxGeometry(0.06, 0.32, 0.06).translate(0.2, 0.16, -0.2), new THREE.BoxGeometry(0.06, 0.32, 0.06).translate(-0.2, 0.16, 0.2)]),
      dish: mergeGeometries([new THREE.SphereGeometry(0.3, 10, 6, 0, 6.283, 0, 0.7).rotateX(-1.1).translate(0, 0.45, 0), new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4).translate(0, 0.2, 0)]),
      ac: new THREE.BoxGeometry(0.5, 0.3, 0.4).translate(0, 0.15, 0),
      hut: new THREE.BoxGeometry(1.2, 1.1, 1.4).translate(0, 0.55, 0),
      rebar: mergeGeometries([0, 1, 2, 3].map((k) => new THREE.CylinderGeometry(0.02, 0.02, 0.8, 3).translate((k % 2) * 0.16, 0.4, Math.floor(k / 2) * 0.16))),
      line: mergeGeometries([new THREE.BoxGeometry(2, 0.02, 0.02).translate(0, 0.9, 0), new THREE.BoxGeometry(0.4, 0.35, 0.01).translate(-0.6, 0.72, 0), new THREE.BoxGeometry(0.3, 0.4, 0.01).translate(0, 0.7, 0), new THREE.BoxGeometry(0.35, 0.3, 0.01).translate(0.6, 0.74, 0)]),
      pigeon: mergeGeometries([new THREE.BoxGeometry(0.9, 1.6, 0.9).translate(0, 1.6, 0), ...[-0.35, 0.35].flatMap((x) => [-0.35, 0.35].map((z) => new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4).translate(x, 0.4, z)))]),
    };
    const cols = { tank: [0xe8e6e0, 0x1c1d20, 0x3a5a8a, 0xc8c4bc], dish: [0xe8e6e0, 0xd0ccc4], ac: [0xe0ded8], hut: [0xc8b89a, 0xb8a888, 0xa89a80], rebar: [0x5a4a3a], line: [0xffffff], pigeon: [0x8a6a4a, 0x6a5a4a] };
    const items = Object.fromEntries(Object.keys(geos).map((k) => [k, []]));
    for (const b of list) {
      const top = b.cells.filter((c) => c.f === b.floors - 1); if (!top.length) continue;
      const brick = b.style === 'cairobrick';
      for (const c of top) {
        const r = Math.random(), y = c.y + c.hy, px = c.x + rand(-0.5, 0.5) * c.hx, pz = c.z + rand(-0.5, 0.5) * c.hz;
        if (r < 0.28) items.tank.push([px, y, pz, c]); else if (r < 0.46) items.dish.push([px, y, pz, c]); else if (r < 0.58) items.ac.push([px, y, pz, c]);
        else if (r < 0.64) items.line.push([px, y, pz, c]); else if (brick && r < 0.8) items.rebar.push([c.x + c.hx * 0.7, y, c.z + c.hz * 0.7, c]);
      }
      if (Math.random() < 0.3) { const c = pick(top); items.hut.push([c.x, c.y + c.hy, c.z, c]); }
      if (Math.random() < 0.025) { const c = pick(top); items.pigeon.push([c.x, c.y + c.hy, c.z, c]); }
    }
    for (const [k, arr] of Object.entries(items)) {
      if (!arr.length) continue;
      const im = new THREE.InstancedMesh(geos[k], new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: k === 'dish' || k === 'rebar' ? 0.4 : 0.05, side: k === 'dish' ? THREE.DoubleSide : THREE.FrontSide }), arr.length);
      arr.forEach(([x, y, z, c], i) => { _q.setFromAxisAngle(UP, rand(0, 6.28)); _m.compose(_p.set(x, y, z), _q, ONE); im.setMatrixAt(i, _m); im.setColorAt(i, new THREE.Color(k === 'line' ? pick([0xc8102e, 0x2a6ad8, 0xf2c21a, 0xffffff, 0x3a8a4a]) : pick(cols[k]))); (c.props ||= []).push({ mesh: im, idx: i, x, y, z }); });
      im.castShadow = k !== 'line'; this.scene.add(im);
    }
  }
  // ---------- Khan el-Khalili: awnings and cloth over the lanes, lanterns, rugs on the walls, a mosque of signs ----------
  bazaar(C) {
    // the cloth overhead: canvas awnings and coloured fabric strung across, each a different colour
    const aw = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2 + 0.08);
    const am = new THREE.InstancedMesh(aw, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }), C.awnings.length);
    C.awnings.forEach((a, i) => { _q.setFromAxisAngle(UP, a.ax === 'x' ? Math.PI / 2 : 0); _m.compose(_p.set(a.x, rand(2.6, 3.3), a.z), _q, _s.set(rand(1.4, 2.2), 1, a.w)); am.setMatrixAt(i, _m); am.setColorAt(i, new THREE.Color(pick([0xd8ccb0, 0xc8b490, 0xb89c74, 0xa8885e, 0xe0d6c0, 0x9a7a58, 0xb8a888, 0x8a6e52, 0xa86a4a, 0x7a7a62]))); });
    am.castShadow = true; am.receiveShadow = true; this.scene.add(am);
    // lanterns: pierced brass and coloured glass, glowing after dark
    const lg = mergeGeometries([new THREE.CylinderGeometry(0.01, 0.01, 0.4, 3).translate(0, 0.3, 0), new THREE.SphereGeometry(0.17, 8, 6).scale(1, 1.4, 1), new THREE.ConeGeometry(0.12, 0.2, 8).translate(0, 0.32, 0)]);
    const lm = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3, emissive: 0xffffff, emissiveIntensity: 0 }), C.lanterns.length);
    C.lanterns.forEach((l, i) => { _m.makeTranslation(l.x, l.y, l.z); lm.setMatrixAt(i, _m); lm.setColorAt(i, new THREE.Color(pick([0xff8a2a, 0xffc02a, 0xff3a5a, 0x3ad0ff, 0x8aff5a, 0xd04aff]))); });
    this.scene.add(lm); this.lanternMat = lm.material;
    // rugs hung on the shop walls: a handful of patterns
    const rugTex = [0, 1, 2, 3, 4, 5].map((k) => canvasTex(64, 96, (c, w, h) => {
      const base = ['#8a1a1a', '#1a2a5a', '#6a2a1a', '#2a4a2a', '#5a1a3a', '#8a5a1a'][k]; c.fillStyle = base; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e8d8b0'; c.lineWidth = 3; c.strokeRect(4, 4, w - 8, h - 8); c.strokeStyle = '#d8a040'; c.lineWidth = 2; c.strokeRect(9, 9, w - 18, h - 18);
      c.fillStyle = '#e8d8b0'; c.beginPath(); c.moveTo(w / 2, 20); c.lineTo(w - 16, h / 2); c.lineTo(w / 2, h - 20); c.lineTo(16, h / 2); c.closePath(); c.fill(); c.fillStyle = base; c.beginPath(); c.moveTo(w / 2, 32); c.lineTo(w - 24, h / 2); c.lineTo(w / 2, h - 32); c.lineTo(24, h / 2); c.closePath(); c.fill();
      for (let y = 0; y < h; y += 6) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, y, w, 2); }
    }));
    const byT = rugTex.map(() => []);
    for (const r of C.rugs) byT[(Math.random() * rugTex.length) | 0].push(r);
    byT.forEach((arr, k) => { if (!arr.length) return; const geo = mergeGeometries(arr.map((r) => new THREE.PlaneGeometry(0.9, 1.4).rotateY(r.f > 0 ? 0 : Math.PI).translate(r.x, 1.3, r.z))); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rugTex[k], side: THREE.DoubleSide, roughness: 0.95 })); this.scene.add(m); });
    // clothes hung up outside the shops on rails and hooks, the way the bazaar shows them off: galabeyas, abayas,
    // dresses and scarves, one above another up the shop front
    {
      const robe = mergeGeometries([new THREE.BoxGeometry(0.42, 0.95, 0.03).translate(0, -0.5, 0), new THREE.BoxGeometry(0.62, 0.14, 0.03).translate(0, -0.12, 0), new THREE.CylinderGeometry(0.008, 0.008, 0.5, 3).rotateZ(Math.PI / 2), new THREE.BoxGeometry(0.02, 0.1, 0.02).translate(0, 0.05, 0)]);
      const scarf = new THREE.BoxGeometry(0.22, 1.1, 0.015).translate(0, -0.55, 0);
      const spots = [], add = (x, z, rot) => { for (let k = 0; k < (Math.random() < 0.5 ? 2 : 1); k++) spots.push([x, 2.55 - k * 1.05, z, rot, Math.random() < 0.3]); };
      const { x0, x1, z0, z1 } = C.bazaar;
      for (const z of C.bazaarLanes.lanesZ) for (let x = x0 + 1; x < x1 - 1; x += rand(0.55, 1.1)) for (const sd of [-1, 1]) if (Math.random() < 0.45) add(x, z + sd * 1.3, sd > 0 ? Math.PI : 0);
      for (const x of C.bazaarLanes.lanesX) for (let z = z0 + 1; z < z1 - 1; z += rand(0.55, 1.1)) for (const sd of [-1, 1]) if (Math.random() < 0.45) add(x + sd * 1.3, z, sd > 0 ? -Math.PI / 2 : Math.PI / 2);
      const cols = [0x1a1a1e, 0xf2f0ea, 0x2a4a8a, 0xb8202a, 0xe8b020, 0x3a7a4a, 0x8a2a6a, 0xd86a2a, 0x6ab0d8, 0xc8a070, 0xe85a8a, 0x5a3a2a];
      for (const sc of [false, true]) {
        const list = spots.filter((q) => q[4] === sc), m = new THREE.InstancedMesh(sc ? scarf : robe, new THREE.MeshStandardMaterial({ roughness: 0.95 }), list.length);
        list.forEach(([x, y, z, rot], i) => { _q.setFromAxisAngle(UP, rot + rand(-0.15, 0.15)); _m.compose(_p.set(x, y, z), _q, ONE); m.setMatrixAt(i, _m); m.setColorAt(i, new THREE.Color(pick(cols))); });
        m.castShadow = true; this.scene.add(m);
      }
    }
    // brass lamps and pots stacked outside the shops
    const B = [];
    for (const z of C.bazaarLanes.lanesZ) for (let x = C.bazaar.x0 + 1; x < C.bazaar.x1 - 1; x += rand(1.2, 2.4)) { if (Math.random() < 0.5) continue; const zz = z + (Math.random() < 0.5 ? -1.15 : 1.15); B.push(cyl(0.12, 0.16, 0.3, x, 0.15, zz, pick([0xc8962a, 0xb8782a, 0x8a5a2a, 0x2a6a8a, 0xe8e0d0]), 8), box(0.4, 0.3, 0.3, x + 0.3, 0.15, zz, pick([0x6a4a2a, 0x8a6a3a]))); }
    this.add(B);
    // Arabic shop signs over the doors along the lanes
    const shops = ['عطارة الحسين', 'خان الخليلي', 'فوانيس رمضان', 'نحاس وفضة', 'سجاد يدوي', 'عطور شرقية', 'مقهى الفيشاوي', 'هدايا وتحف', 'أقمشة وحرير', 'صاغة', 'بهارات وتوابل', 'جلديات', 'زجاج يدوي', 'مشغولات يدوية'];
    for (const z of C.bazaarLanes.lanesZ) for (let x = C.bazaar.x0 + 2; x < C.bazaar.x1 - 2; x += rand(3.5, 6)) for (const s of [-1, 1]) if (Math.random() < 0.5) {
      const t = pick(shops), col = pick([['#1a3a2a', '#f2d27a'], ['#5a1a1a', '#f2e6c8'], ['#1a2a4a', '#ffffff'], ['#2a1a0a', '#e8c070']]);
      this.sign(1.6, 0.34, (c, w, h) => { c.fillStyle = col[0]; c.fillRect(0, 0, w, h); c.strokeStyle = col[1]; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = col[1]; c.font = `700 ${h * 0.55}px ${AR}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl'; c.fillText(t, w / 2, h * 0.55, w * 0.92); }, x, 2.1, z + s * 1.36, s > 0 ? Math.PI : 0, 0.35);
    }
  }
  // riverside cafés on the corniche: tables, plastic chairs, a striped canopy, a shisha or two
  cafes(list) {
    const P = [];
    for (const c of list) for (let k = 0; k < 5; k++) { const x = c.x + c.s * rand(-0.6, 0.6), z = c.z + rand(-2.2, 2.2); P.push(cyl(0.28, 0.28, 0.04, x, 0.5, z, 0xe8e4dc, 10), cyl(0.03, 0.03, 0.5, x, 0.25, z, 0x8a8a8a, 4), box(0.25, 0.3, 0.25, x + 0.4, 0.15, z, pick([0xe8e4dc, 0x2a6ad8, 0xc8361f])), cyl(0.05, 0.08, 0.3, x, 0.67, z, 0x6a9a6a, 6)); }
    for (const c of list) P.push(tint(new THREE.PlaneGeometry(2.4, 5).rotateX(-Math.PI / 2).translate(c.x, 1.9, c.z), 0xd8b040));
    this.add(P);
  }
  // street-name plates at the corners (blue enamel, white Arabic lettering)
  streetSigns() {
    const names = ['شارع التحرير', 'شارع قصر النيل', 'شارع الأزهر', 'شارع المعز', 'شارع رمسيس', 'شارع الهرم', 'شارع بورسعيد', 'شارع الجيش', 'كورنيش النيل', 'شارع صلاح سالم', 'شارع محمد علي', 'شارع الجلاء', 'شارع فيصل', 'شارع النيل'];
    const P = [];
    for (const n of this.city.nodes) {
      if (!n.edges.length || Math.random() < 0.4 || inNile(n.x, n.z)) continue;
      const x = n.x + 3.2, z = n.z + 3.2, t = pick(names);
      P.push(cyl(0.03, 0.03, 2.4, x, 1.2, z, 0x3a3a3a, 4));
      this.sign(1.2, 0.3, (c, w, h) => { c.fillStyle = '#123a8a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#fff'; c.font = `700 ${h * 0.55}px ${AR}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl'; c.fillText(t, w / 2, h * 0.55, w * 0.9); }, x, 2.3, z, Math.random() < 0.5 ? 0 : Math.PI / 2, 0.2, true);
    }
    this.add(P, this.metal);
  }
  flags() {
    const P = [], spots = [[this.C.tahrir.x + 8, this.C.tahrir.z], [this.C.tahrir.x - 8, this.C.tahrir.z], [this.C.citadel.x, this.C.citadel.z - 13], [-30, -50], [-140, -15]];
    for (const [x, z] of spots) { const y = terrainH(x, z); P.push(cyl(0.05, 0.07, 6, x, y + 3, z, 0xeeeeee, 8)); this.sign(1.5, 1, flagEG, x + 0.77, y + 5.4, z, 0, 0.15, true); }
    this.add(P);
  }
  // ---------- the desert: dunes and the plateau as a height-field mesh, sand-coloured, rock showing on the slopes ----------
  desert() {
    const W = 640, geo = new THREE.PlaneGeometry(W, 2 * E, 300, 340).rotateX(-Math.PI / 2).translate(-124 - W / 2, 0, 0), p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)) + (p.getX(i) > -126 ? -0.05 : 0));
    geo.computeVertexNormals();
    const nr = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), n = fbm(x * 0.05, z * 0.05, 3), steep = 1 - nr.getY(i); c.setHSL(0.1, 0.42 - steep * 0.3, 0.66 + n * 0.08 - steep * 0.25, THREE.SRGBColorSpace); c.toArray(col, i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; this.scene.add(m);
    // the Pyramids Road climbing the escarpment to the plateau, and the coach park at its end: asphalt laid over the sand
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x4e4c48, roughness: 0.95 }), lay = (x0, z0, x1, z1) => {
      const g2 = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 2), Math.ceil((z1 - z0) / 2)).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2), q = g2.attributes.position;
      for (let i = 0; i < q.count; i++) q.setY(i, terrainH(q.getX(i), q.getZ(i)) + 0.06);
      g2.computeVertexNormals(); const r = new THREE.Mesh(g2, asphalt); r.receiveShadow = true; this.scene.add(r);
    };
    lay(-150, -12.3, -124, -7.7); lay(this.C.busPark.x0, this.C.busPark.z0, this.C.busPark.x1, this.C.busPark.z1);
    const dash = []; for (let x = -148; x < -126; x += 3) { const y = terrainH(x, -10) + 0.08; dash.push(box(1.4, 0.02, 0.12, x, y, -10, 0xe8e4d8)); } this.add(dash);
    // the tourist bus park and its coaches; a ticket booth; camels resting
    const P = [], bp = this.C.busPark;
    for (let k = 0; k < 4; k++) { const bx = bp.x0 + 2.5 + k * 3.6, bz = (bp.z0 + bp.z1) / 2, by = terrainH(bx, bz); P.push(box(1.1, 1.3, 4.4, bx, by + 0.75, bz, pick([0xf2f2ee, 0xe8b020, 0x2a6ad8])), box(1.12, 0.4, 3.8, bx, by + 1.1, bz + 0.2, 0x1a2a3a)); }
    // the rope barriers round the monuments: short posts with a rope between
    for (const k of KEEP) for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
      const x0 = k.x + ax * k.hx, z0 = k.z + az * k.hz, x1 = k.x + bx * k.hx, z1 = k.z + bz * k.hz, L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 2.6);
      for (let q = 0; q < n; q++) { const u = q / n, v = (q + 1) / n, px = x0 + (x1 - x0) * u, pz = z0 + (z1 - z0) * u, qx = x0 + (x1 - x0) * v, qz = z0 + (z1 - z0) * v, py = terrainH(px, pz), qy = terrainH(qx, qz);
        if (inKeep(px, pz, -0.5)) continue;
        P.push(box(0.09, 0.75, 0.09, px, py + 0.37, pz, 0x6a5a48), sph(0.06, px, py + 0.77, pz, 0x6a5a48));
        const mx = (px + qx) / 2, mz = (pz + qz) / 2, sl = Math.hypot(qx - px, qz - pz), g = new THREE.BoxGeometry(0.025, 0.025, sl).rotateY(Math.atan2(qx - px, qz - pz)).translate(mx, (py + qy) / 2 + 0.62, mz); P.push(tint(g, 0xc8a83a)); }
    }
    const ty = terrainH(-140, -4); P.push(box(3, 2.2, 2, -140, ty + 1.1, -4, 0xd8c8a8), box(3.4, 0.2, 2.4, -140, ty + 2.3, -4, 0xb8a888));
    this.add(P);
  }
  // ---------- on the Nile: feluccas under their great triangular sails, cruise boats, river taxis ----------
  // Each boat works one stretch of the river between two bridges (the masts are far too tall to pass under them).
  boats() {
    const hullShape = (len, beam, bow) => { const s = new THREE.Shape(); s.moveTo(-beam / 2, -len / 2); s.quadraticCurveTo(0, -len / 2 - 0.3, beam / 2, -len / 2); s.lineTo(beam / 2, len / 2 - bow); s.quadraticCurveTo(beam / 2, len / 2 - bow * 0.2, 0, len / 2); s.quadraticCurveTo(-beam / 2, len / 2 - bow * 0.2, -beam / 2, len / 2 - bow); s.closePath(); return s; };
    const hull = (len, beam, bow, h, col, y = -0.3) => tint(new THREE.ExtrudeGeometry(hullShape(len, beam, bow), { depth: h, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, y, 0), col);
    const person = (P, x, y, z, c) => P.push(box(0.12, 0.26, 0.1, x, y + 0.13, z, c), sph(0.05, x, y + 0.31, z, 0x8a6040));
    // the felucca: a white wooden hull with a coloured stripe, a short mast raked forward, the long yard carrying a big lateen sail
    const felucca = (s) => {
      // white hull, red stripe along the sheer, a low canopy amidships, a short mast and the long yard raked back
      // carrying the tall, curved lateen sail
      const P = [hull(3.6 * s, 1.15 * s, 1.1 * s, 0.42 * s, 0xf4f2ee), box(1.17 * s, 0.07 * s, 3.1 * s, 0, 0.06 * s, 0, 0xc8241f), box(1.0 * s, 0.04 * s, 2.7 * s, 0, 0.13 * s, -0.1 * s, 0x8a6a4a)];
      P.push(box(1.0 * s, 0.03 * s, 1.0 * s, 0, 0.62 * s, -0.5 * s, 0x2a3a4a), ...[[-0.45, -0.05], [0.45, -0.05], [-0.45, -0.95], [0.45, -0.95]].map(([x, z]) => box(0.03 * s, 0.5 * s, 0.03 * s, x * s, 0.38 * s, z * s, 0xdddddd)));
      P.push(tint(new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 1.6 * s, 6).translate(0, 0.9 * s, 0.9 * s), 0x5a3a20));
      const R = [];
      const tack = new THREE.Vector3(0, 0.5 * s, 1.5 * s), peak = new THREE.Vector3(0, 6.0 * s, -1.0 * s), clew = new THREE.Vector3(0, 0.75 * s, -1.75 * s);
      const yd = new THREE.Vector3().subVectors(peak, tack), yl = yd.length(), yard = new THREE.CylinderGeometry(0.022 * s, 0.03 * s, yl, 5).translate(0, yl / 2, 0);
      yard.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, yd.clone().normalize())); yard.translate(tack.x, tack.y, tack.z); R.push(tint(yard, 0x5a3a20));
      const pts = [], N = 7;
      for (let a = 0; a <= N; a++) for (let b = 0; b <= N - a; b++) { const u = a / N, v = b / N, q = tack.clone().addScaledVector(yd, u).addScaledVector(new THREE.Vector3().subVectors(clew, tack), v); q.x += 0.55 * s * Math.sin(Math.PI * Math.min(1, v / Math.max(1e-3, 1 - u))) * (1 - u) * (1 - 0.4 * u); pts.push(q); }
      const at = (a, b) => { let k = 0; for (let i2 = 0; i2 < a; i2++) k += N - i2 + 1; return pts[k + b]; };
      const tri = [];
      for (let a = 0; a < N; a++) for (let b = 0; b < N - a; b++) { tri.push(at(a, b), at(a + 1, b), at(a, b + 1)); if (b < N - a - 1) tri.push(at(a + 1, b), at(a + 1, b + 1), at(a, b + 1)); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((q) => [q.x, q.y, q.z]), 3)); sg.computeVertexNormals();
      const back = sg.clone(); const pa = back.attributes.position; for (let i2 = 0; i2 < pa.count; i2 += 3) { for (const c of ['X', 'Y', 'Z']) { const t2 = pa['get' + c](i2 + 1); pa['set' + c](i2 + 1, pa['get' + c](i2 + 2)); pa['set' + c](i2 + 2, t2); } } back.computeVertexNormals();
      R.push(tint(sg, 0xf2efe6), tint(back, 0xe8e4d8));
      person(P, 0, 0.16 * s, -1.4 * s, pick([0xe8e4dc, 0x8a6a4a, 0x2a3a5a]));
      if (Math.random() < 0.6) for (let k = 0; k < 3; k++) person(P, rand(-0.3, 0.3) * s, 0.16 * s, (-0.2 - k * 0.3) * s, pick([0xff8fa3, 0x4fc3f7, 0xfff176, 0xffffff, 0x81c784, 0x0e0e10]));
      // the rig hinges at its foot (0.5 up): scaling it down is the yard being lowered
      const grp = new THREE.Group(), hullM = new THREE.Mesh(mergeGeometries(P), this.mat), rig = new THREE.Mesh(mergeGeometries(R).translate(0, -0.5 * s, 0), this.mat);
      hullM.castShadow = rig.castShadow = true; rig.position.y = 0.5 * s; grp.add(hullM, rig); grp.userData = { rig, s };
      return grp;
    };
    // the cruise boat: three white decks with long window bands, a sun deck with awnings
    const cruise = () => { const P = [hull(14, 3, 3, 0.9, 0xf2f2ee), box(2.8, 0.9, 12, 0, 0.9, -0.6, 0xf2f2ee), box(2.82, 0.4, 11.4, 0, 0.95, -0.6, 0x1a2a3a), box(2.6, 0.9, 10, 0, 1.8, -1, 0xf2f2ee), box(2.62, 0.4, 9.4, 0, 1.85, -1, 0x1a2a3a), box(2.6, 0.08, 10, 0, 2.3, -1, 0xd8d4cc)];
      for (let z = -5; z < 3; z += 2.5) P.push(box(2, 0.05, 2, 0, 3.1, z, pick([0xd8b040, 0x2a6a8a])), cyl(0.04, 0.04, 0.8, 0, 2.7, z, 0xdddddd, 4));
      P.push(box(1.4, 0.7, 1.4, 0, 2.6, 4.2, 0xf2f2ee)); return mergeGeometries(P); };
    // the river taxi: a small covered launch painted in bright colours
    const taxi = () => { const P = [hull(5, 1.7, 1.4, 0.5, pick([0x2a6ad8, 0x3a8a5a, 0xe8b020])), box(1.6, 0.06, 3.6, 0, 1.3, -0.3, pick([0xc8361f, 0xe8e0c8])), ...[-0.75, 0.75].flatMap((x) => [-1.9, 1.3].map((z) => box(0.06, 1.1, 0.06, x, 0.8, z, 0xdddddd)))]; for (let k = 0; k < 5; k++) person(P, rand(-0.5, 0.5), 0.2, rand(-1.6, 1), pick([0xe8e4dc, 0x1c1d22, 0x2a3448, 0x6a3a2a])); return mergeGeometries(P); };
    // every boat works the whole river: up one half, wrapping round far out of sight in the haze; each direction keeps
    // to its own half of the river, so oncoming boats never meet
    this.boatList = [];
    const DIM = { felucca: [3.6, 1.3], cruise: [14.6, 3.1], taxi: [5.3, 1.8] };
    const add = (obj, kind) => {
      const m = obj.isObject3D ? obj : new THREE.Mesh(obj, this.mat); if (m.isMesh) m.castShadow = true; this.scene.add(m);
      const sc = m.userData.s || 1, [len, beam] = DIM[kind];
      const b = { m, kind, len: len * sc, beam: beam * sc, dir: Math.random() < 0.5 ? 1 : -1, v: kind === 'felucca' ? rand(0.8, 1.4) : kind === 'taxi' ? rand(2, 2.6) : rand(1, 1.3), ph: rand(0, 6), off: 0, sp: 1, lower: 1, rig: m.userData.rig, s: sc };
      b.base = kind === 'cruise' ? rand(4, 8) : rand(4, 12);
      for (let k = 0; k < 60; k++) { b.z = rand(-BW, BW); if (!this.boatList.some((o) => o.dir === b.dir && Math.abs(o.z - b.z) < (o.len + b.len) / 2 + 10)) break; }
      this.boatList.push(b);
    };
    for (let k = 0; k < 22; k++) add(felucca(rand(0.8, 1.12)), 'felucca');
    for (let k = 0; k < 6; k++) add(cruise(), 'cruise');
    for (let k = 0; k < 6; k++) add(taxi(), 'taxi');
    // moored at the docks: feluccas side by side, a couple of cruise boats tied up along the bank
    for (const c of this.C.cafes) for (let k = 0; k < 3; k++) { const m = felucca(rand(0.8, 1.1)); m.userData.rig.scale.y = 0.3; m.position.set(nileX(c.z) + c.s * (NILE.hw - 1.6), NILE.WL, c.z + (k - 1) * 1.6); m.rotation.y = Math.random() < 0.5 ? 0 : Math.PI; this.scene.add(m); }
    for (const [z, s] of [[-120, 1], [100, -1], [-40, -1]]) { const m = new THREE.Mesh(cruise(), this.mat); m.position.set(nileX(z) + s * (NILE.hw - 2.2), NILE.WL, z); m.castShadow = true; this.scene.add(m); }
    this.wakeList = [];
  }
  updateBoats(dt) {
    const t = G.time, W = (this.wakeList = []), L = this.boatList, hw = NILE.hw;
    // lanes: a boat's centre stays between lo and hi on its own side (hull edges never cross the middle); near a
    // bridge everyone squeezes into the high middle span, and the feluccas lower their sails to pass under
    const bridgeD = (z) => Math.min(...BRIDGES.map((bz) => Math.abs(z - bz)));
    for (const b of L) {
      if (b.sunk) { b.m.position.y -= dt * 0.3; if (b.m.position.y < NILE.BED) { b.sunk = false; b.m.rotation.z = 0; b.z = -b.dir * BW; } continue; }
      const sq = 1 - Math.min(1, Math.max(0, (bridgeD(b.z) - 6) / 22));
      const lo = b.beam / 2 + 0.9, hiOpen = hw - 6.5 - b.beam / 2, hiBr = b.kind === 'cruise' ? 2.9 : 6.2, hi = Math.max(lo, hiOpen + (hiBr - hiOpen) * sq);
      let want = b.base + (b.kind === 'felucca' ? Math.sin(t * 0.1 * b.v + b.ph) * 4 : 0);
      want = Math.max(lo, Math.min(hi, want + b.off));
      b.lane = b.lane == null ? want : b.lane + Math.max(-dt * 1.2, Math.min(dt * 1.2, want - b.lane));
      b.lane = Math.max(lo, Math.min(hi, b.lane));
      b.off *= Math.max(0, 1 - dt * 0.3);
      // the rig comes down as the felucca nears a bridge and goes back up once through
      if (b.rig) { const need = Math.min(1, (2.0 / b.s - 0.5) / 5.5), tgt = bridgeD(b.z) < 26 ? need : 1; b.lower += (tgt - b.lower) * Math.min(1, dt * 0.8); b.rig.scale.y = b.lower; }
    }
    // keeping clear: a boat closing on another ahead on its side slows to its pace (or stops); side by side they ease apart
    for (const b of L) b.spT = 1;
    for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) {
      const a = L[i], c = L[k]; if (a.dir !== c.dir || a.sunk || c.sunk) continue;
      const dz = (c.z - a.z) * a.dir, gapZ = Math.abs(dz) - (a.len + c.len) / 2, gapX = Math.abs(a.lane - c.lane) - (a.beam + c.beam) / 2;
      if (gapX > 1.2 || gapZ > 9) continue;
      const back = dz > 0 ? a : c, front = back === a ? c : a;
      back.spT = Math.min(back.spT, gapZ < 2.5 ? 0 : Math.min(1, (front.v * front.sp) / back.v * (gapZ - 2.5) / 6.5 + 0.2));
      if (gapZ < 1.5) { const sgn = back.lane >= front.lane ? 1 : -1; back.off += sgn * dt * 2; front.off -= sgn * dt; }
    }
    for (const b of L) {
      if (b.sunk) continue;
      b.sp += (b.spT - b.sp) * Math.min(1, dt * 1.5);
      b.z += b.dir * b.v * b.sp * dt;
      // wrap round far away, only if the way in at the other end is clear
      if (Math.abs(b.z) > BW) { const nz = -b.dir * BW; b.z = L.some((o) => o !== b && o.dir === b.dir && Math.abs(o.z - nz) < (o.len + b.len) / 2 + 10) ? b.dir * BW : nz; }
      const x = nileX(b.z) + b.dir * b.lane, h = Math.atan2(nileX(b.z + b.dir) - nileX(b.z), b.dir);
      b.m.position.set(x, NILE.WL + Math.sin(t * 1.3 + b.ph) * 0.03, b.z);
      b.m.rotation.set(Math.sin(t * 0.9 + b.ph) * 0.02, h, b.kind === 'felucca' ? 0.1 * b.dir + Math.sin(t * 1.1 + b.ph) * 0.03 : Math.sin(t * 1.1 + b.ph) * 0.02);
      const v = b.v * b.sp; W.push({ x, z: b.z, vx: Math.sin(h) * v, vz: Math.cos(h) * v });
    }
  }
  // ---------- Cairo's vehicles over the traffic: black-and-white taxis, white microbuses, red buses, police, tuk-tuks ----------
  vehiclesInit() {
    const wheels = (P, xs, zs, r = 0.13, w = 0.09) => { for (const x of xs) for (const z of zs) P.push(tint(new THREE.CylinderGeometry(r, r, w, 10).rotateZ(Math.PI / 2).translate(x, r, z), 0x141414)); };
    const glass = 0x1a232b;
    // the old taxi: a white saloon with the black-and-white chequer band and a roof sign
    const taxi = (() => { const P = [box(0.68, 0.3, 1.6, 0, 0.28, 0, 0xf2f2ee), box(0.62, 0.22, 0.85, 0, 0.53, -0.08, 0xf2f2ee), box(0.64, 0.17, 0.78, 0, 0.53, -0.08, glass), box(0.3, 0.1, 0.12, 0, 0.7, -0.05, 0xf2f2ee)];
      for (let k = 0; k < 10; k++) for (const s of [-1, 1]) P.push(box(0.008, 0.07, 0.16, s * 0.345, 0.3, -0.72 + k * 0.16, k % 2 ? 0x111111 : 0xf2f2ee));
      wheels(P, [-0.31, 0.31], [0.52, -0.52]); return mergeGeometries(P); })();
    // the microbus: a tall white van with a blue stripe and luggage on the roof rack
    const micro = (() => { const P = [box(0.76, 0.78, 1.95, 0, 0.53, 0, 0xf0f0ec), box(0.78, 0.22, 1.5, 0, 0.66, -0.15, glass), box(0.7, 0.32, 0.03, 0, 0.66, 0.98, glass), box(0.785, 0.07, 1.95, 0, 0.38, 0, 0x1f4fa8), box(0.6, 0.06, 1.2, 0, 0.96, -0.1, 0x3a3a3a)];
      for (let k = 0; k < 3; k++) P.push(box(rand(0.2, 0.35), 0.18, rand(0.2, 0.4), rand(-0.15, 0.15), 1.08, -0.5 + k * 0.4, pick([0xc8361f, 0x2a6ad8, 0x8a6a3a, 0xe8e0c8])));
      wheels(P, [-0.34, 0.34], [0.62, -0.62], 0.14, 0.1); return mergeGeometries(P); })();
    // the city bus: red and white, a little battered
    const bus = (() => { const P = [box(1.0, 1.0, 4.6, 0, 0.75, 0, 0xb3201f), box(1.01, 0.38, 4.0, 0, 0.98, -0.2, glass), box(1.01, 0.16, 4.6, 0, 1.3, 0, 0xf2f2ee), box(0.9, 0.5, 0.03, 0, 0.95, 2.31, glass)]; wheels(P, [-0.45, 0.45], [1.5, -1.5], 0.19, 0.12); return mergeGeometries(P); })();
    // the police car: white with the blue band and the word شرطة on the doors (a decal: the colour band is enough at this size)
    const pol = (() => { const P = [box(0.7, 0.3, 1.66, 0, 0.28, 0, 0xf2f2ee), box(0.64, 0.2, 0.92, 0, 0.52, -0.1, 0xf2f2ee), box(0.66, 0.16, 0.84, 0, 0.52, -0.1, glass), box(0.71, 0.08, 1.6, 0, 0.32, 0, 0x1f3f8a), box(0.44, 0.06, 0.12, 0, 0.65, -0.1, 0x101828)]; wheels(P, [-0.32, 0.32], [0.54, -0.54]); return mergeGeometries(P); })();
    // the ambulance: white and orange
    const amb = (() => { const P = [box(0.76, 0.8, 1.6, 0, 0.55, -0.25, 0xf4f4f0), box(0.76, 0.46, 0.5, 0, 0.38, 0.8, 0xf4f4f0), box(0.77, 0.12, 2.1, 0, 0.5, 0, 0xe86a1a), box(0.5, 0.06, 0.12, 0, 0.98, 0.4, 0x101828)]; wheels(P, [-0.34, 0.34], [0.62, -0.7]); return mergeGeometries(P); })();
    // the tuk-tuk: a little three-wheeler, red or maroon, its canvas top
    const tuk = (() => { const P = [box(0.5, 0.36, 0.95, 0, 0.32, -0.05, 0xb3201f), box(0.52, 0.04, 0.95, 0, 0.82, -0.05, 0x2a2a2a), box(0.46, 0.3, 0.03, 0, 0.62, 0.38, glass), box(0.04, 0.32, 0.04, 0.24, 0.66, -0.5, 0x2a2a2a), box(0.04, 0.32, 0.04, -0.24, 0.66, -0.5, 0x2a2a2a), sph(0.06, 0, 0.36, 0.46, 0xfff2c0)]; wheels(P, [0], [0.38], 0.11, 0.07); wheels(P, [-0.24, 0.24], [-0.35], 0.11, 0.07); return mergeGeometries(P); })();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.25 });
    this.veh = {};
    for (const [k, geo] of Object.entries({ taxi, micro, bus, pol, amb, tuk })) { const m = new THREE.InstancedMesh(geo, mat, 200); m.count = 0; m.castShadow = true; m.frustumCulled = false; this.scene.add(m); this.veh[k] = m; }
    this.tukMat = new THREE.MeshStandardMaterial({ color: 0xb3201f });
  }
  updateVehicles() {
    const A = G.agents; if (!A) return;
    const n = { taxi: 0, micro: 0, bus: 0, pol: 0, amb: 0, tuk: 0 };
    for (const c of A.cars) {
      let k = null;
      if (c.moto) { if (c.i % 3 === 0) k = 'tuk'; else continue; }
      else if (c.emerg) k = c.emerg === 'police' ? 'pol' : c.emerg === 'ambulance' ? 'amb' : null;
      else { const hx = c.color.getHex(); k = hx === 0x101011 ? 'taxi' : hx === 0xe9e9e7 ? 'micro' : c.scale[2] > 2 ? 'bus' : null; }
      if (!k) continue;
      const src = k === 'tuk' ? A.moto.body : A.carBody;
      src.getMatrixAt(c.i, _m); const e = _m.elements; if (e[0] === 0 && e[1] === 0 && e[2] === 0) continue;
      _m.decompose(_p, _q, _s); _m2.compose(_p, _q, ONE); this.veh[k].setMatrixAt(n[k]++, _m2);
      if (k === 'tuk') { for (const mm of Object.values(A.moto)) mm.setMatrixAt(c.i, ZERO); }
      else { A.carBody.setMatrixAt(c.i, ZERO); A.carDark.setMatrixAt(c.i, ZERO); }
    }
    for (const k in n) { this.veh[k].count = n[k]; this.veh[k].instanceMatrix.needsUpdate = true; }
    A.carBody.instanceMatrix.needsUpdate = true; A.carDark.instanceMatrix.needsUpdate = true; for (const mm of Object.values(A.moto)) mm.instanceMatrix.needsUpdate = true;
  }
  // ---------- donkey carts on the streets of Giza and Islamic Cairo; camels with their handlers on the plateau ----------
  animalsInit(C) {
    const donkey = mergeGeometries([tint(new THREE.SphereGeometry(1, 10, 8).scale(0.09, 0.11, 0.22).translate(0, 0.42, 0), 0x8a7a6a), tint(new THREE.CylinderGeometry(0.04, 0.06, 0.22, 6).rotateX(-0.8).translate(0, 0.52, 0.2), 0x8a7a6a), tint(new THREE.BoxGeometry(0.06, 0.07, 0.16).rotateX(0.5).translate(0, 0.6, 0.3), 0x8a7a6a), ...[-0.03, 0.03].map((x) => tint(new THREE.ConeGeometry(0.015, 0.1, 4).translate(x, 0.7, 0.27), 0x6a5a4a)),
      ...[[0.05, 0.14], [-0.05, 0.14], [0.05, -0.14], [-0.05, -0.14]].map(([x, z]) => tint(new THREE.CylinderGeometry(0.018, 0.015, 0.34, 5).translate(x, 0.17, z), 0x6a5a4a)),
      tint(new THREE.BoxGeometry(0.62, 0.12, 0.9).translate(0, 0.38, -0.85), 0x8a6a3a), ...[-0.33, 0.33].map((x) => tint(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10).rotateZ(Math.PI / 2).translate(x, 0.17, -0.9), 0x3a2a1a)),
      ...[0, 1, 2, 3, 4].map((k) => tint(new THREE.SphereGeometry(0.1, 6, 4).translate(-0.2 + (k % 3) * 0.2, 0.5, -0.7 - Math.floor(k / 3) * 0.25), pick([0xe86a1a, 0x3a8a3a, 0xc8361f, 0xe8c82a]))),
      tint(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6).translate(0, 0.55, -0.45), 0xe8e4dc), tint(new THREE.SphereGeometry(0.045, 6, 5).translate(0, 0.7, -0.45), 0x8a6040)]);
    // the dromedary: long legs, deep chest, one big hump, the long neck dipping then rising to the head
    const seg = (a, b, r0, r1, c) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(), g = new THREE.CylinderGeometry(r1, r0, L, 6).translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); g.translate(a.x, a.y, a.z); return tint(g, c); };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const camelGeo = (o) => {
      const C0 = 0xc49464, C1 = 0xa87a50, P = [
        tint(new THREE.SphereGeometry(1, 12, 9).scale(0.22, 0.23, 0.48).translate(0, 1.0, 0), C0), tint(new THREE.SphereGeometry(1, 10, 8).scale(0.16, 0.2, 0.22).translate(0, 1.16, -0.04), C0),
        seg(V(0, 1.02, 0.34), V(0, 0.9, 0.62), 0.11, 0.07, C0), seg(V(0, 0.9, 0.62), V(0, 1.32, 0.78), 0.07, 0.055, C0), tint(new THREE.BoxGeometry(0.09, 0.1, 0.26).translate(0, 1.33, 0.88), C0), tint(new THREE.BoxGeometry(0.07, 0.07, 0.08).translate(0, 1.3, 1.02), C1),
        ...[-0.04, 0.04].map((x) => tint(new THREE.ConeGeometry(0.018, 0.06, 4).translate(x, 1.41, 0.8), C1)), seg(V(0, 1.02, -0.44), V(0, 0.62, -0.52), 0.025, 0.012, C1), tint(new THREE.SphereGeometry(0.04, 5, 4).translate(0, 0.6, -0.53), 0x2a2018),
      ];
      for (const [x, z] of [[0.09, 0.26], [-0.09, 0.26], [0.09, -0.3], [-0.09, -0.3]]) P.push(seg(V(x, 0.92, z), V(x, 0.45, z + (z > 0 ? 0.02 : -0.04)), 0.07, 0.048, C0), seg(V(x, 0.45, z + (z > 0 ? 0.02 : -0.04)), V(x, 0.03, z), 0.046, 0.034, C1), tint(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 6).translate(x, 0.015, z), 0x8a6a4a));
      if (o.saddle) { const rug = pick([0xb82a2a, 0x8a2a5a, 0xc8601a]); P.push(tint(new THREE.BoxGeometry(0.44, 0.04, 0.42).translate(0, 1.33, -0.04), rug), tint(new THREE.BoxGeometry(0.46, 0.18, 0.06).translate(0, 1.26, 0.17), rug), tint(new THREE.BoxGeometry(0.46, 0.18, 0.06).translate(0, 1.26, -0.25), rug), ...[-0.23, 0.23].map((x) => tint(new THREE.BoxGeometry(0.02, 0.22, 0.36).translate(x, 1.2, -0.04), 0x1a3a7a)), tint(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5).translate(0, 1.43, 0.17), 0x6a4a2a)); }
      if (o.rider) { const top = pick([0x1a1a1a, 0x6a6a6a, 0xf2f2ee, 0x3a6aa8]), leg = pick([0xb8a07a, 0x2a2a3a, 0x3a3a3a]), skin = pick([0xe8c0a0, 0xd8a888, 0xc89070]);
        P.push(tint(new THREE.BoxGeometry(0.2, 0.3, 0.13).translate(0, 1.52, -0.05), top), tint(new THREE.SphereGeometry(0.075, 8, 6).translate(0, 1.75, -0.05), skin), tint(new THREE.SphereGeometry(0.085, 8, 6, 0, 6.3, 0, 1.7).translate(0, 1.77, -0.06), 0x1e5aa8),
          ...[-0.13, 0.13].map((x) => seg(V(x, 1.4, -0.02), V(x * 1.9, 1.1, 0.08), 0.035, 0.03, leg)), ...[-0.12, 0.12].map((x) => seg(V(x, 1.62, -0.04), V(x * 0.6, 1.47, 0.12), 0.026, 0.022, skin)));
        if (Math.random() < 0.5) P.push(tint(new THREE.BoxGeometry(0.16, 0.2, 0.08).translate(0, 1.55, -0.15), 0x2a2a2a)); }
      { const g = mergeGeometries(P).scale(1.15, 1.15, 1.15); P.length = 0; P.push(g); }
      if (o.handler) { const robe = pick([0xe8e4dc, 0xa8c0d8, 0xd8ccb0, 0x6a7a8a]), hx = -0.5, hz = 1.55;
        P.push(tint(new THREE.CylinderGeometry(0.1, 0.17, 0.95, 8).translate(hx, 0.48, hz), robe), tint(new THREE.BoxGeometry(0.22, 0.3, 0.14).translate(hx, 1.08, hz), robe), tint(new THREE.SphereGeometry(0.075, 8, 6).translate(hx, 1.3, hz), 0xb07850), tint(new THREE.CylinderGeometry(0.09, 0.085, 0.09, 8).translate(hx, 1.38, hz), 0xf2efe6),
          seg(V(hx + 0.12, 1.15, hz), V(hx + 0.16, 0.9, hz - 0.12), 0.025, 0.022, robe), seg(V(hx + 0.16, 0.9, hz - 0.12), V(0, 1.5, 1.15), 0.008, 0.008, 0x2aa04a));
      }
      return mergeGeometries(P).scale(0.56, 0.56, 0.56);              // to the people's scale (a person here is about 0.8 tall)
    };
    const routes = [[[-122, -140], [-122, 140]], [[-95, -140], [-95, 30]], [[66, -86], [66, -38]], [[116, -60], [116, 64]], [[-122, -86], [-95, -86]], [[44, 64], [142, 64]]];
    const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, this.mat, n); m.castShadow = true; m.frustumCulled = false; this.scene.add(m); return m; };
    this.carts = routes.map((r, k) => ({ r, u: Math.random(), dir: k % 2 ? 1 : -1, v: rand(0.5, 0.8), ph: rand(0, 6) }));
    this.cartMesh = mk(donkey, this.carts.length);
    // camels walk the plateau from point to point, always round the outside of the roped-off monuments
    const clear = (ax, az, bx, bz) => { for (let u = 0; u <= 1; u += 0.05) if (inKeep(ax + (bx - ax) * u, az + (bz - az) * u, 3)) return false; return true; };
    this.camelGoal = (c) => { for (let k = 0; k < 14; k++) { const x = rand(-292, -140), z = rand(-140, 140); if (!inKeep(x, z, 4) && clear(c.x, c.z, x, z)) { c.tx = x; c.tz = z; return; } } c.tx = c.x + rand(-6, 6); c.tz = c.z + rand(-6, 6); if (inKeep(c.tx, c.tz, 3)) { c.tx = c.x; c.tz = c.z; } };
    const geos = { ride: [0, 1, 2].map(() => camelGeo({ saddle: true, rider: true, handler: true })), led: [camelGeo({ saddle: true, handler: true })], rest: [camelGeo({ saddle: true }), camelGeo({})] };
    const meshes = new Map(), slots = [];
    this.camels = C.camels.map((o, i) => {
      let x = o.x, z = o.z; if (x == null) do { x = rand(-290, -142); z = rand(-130, 130); } while (inKeep(x, z, 4));
      const geo = pick(geos[o.kind]); if (!meshes.has(geo)) meshes.set(geo, []); const list = meshes.get(geo);
      const c = { kind: o.kind, x, z, h: rand(0, 6), tx: x, tz: z, ph: rand(0, 6), wait: rand(0, 8), geo, idx: list.length, tint: new THREE.Color().setHSL(0.08, rand(0.1, 0.35), rand(0.72, 1)) }; list.push(c); return c;
    });
    for (const [geo, list] of meshes) { const m = mk(geo, list.length); list.forEach((c) => { c.mesh = m; m.setColorAt(c.idx, c.tint); }); slots.push(m); }
    this.camelMeshes = slots;
  }
  updateAnimals(dt) {
    const t = G.time;
    this.carts.forEach((c, i) => {
      if (c.down != null) { if ((c.down -= dt) <= 0) c.down = null; }
      else { const [a, b] = c.r, L = Math.hypot(b[0] - a[0], b[1] - a[1]); c.u += c.dir * c.v * dt / L; if (c.u > 1 || c.u < 0) { c.dir *= -1; c.u = Math.max(0, Math.min(1, c.u)); } const dx = (b[0] - a[0]) / L * c.dir, dz = (b[1] - a[1]) / L * c.dir; c.x = a[0] + (b[0] - a[0]) * c.u + dz * 1.9; c.z = a[1] + (b[1] - a[1]) * c.u - dx * 1.9; c.h = Math.atan2(dx, dz); }
      _q.setFromAxisAngle(UP, c.h); if (c.down != null) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.3));
      _m.compose(_p.set(c.x, Math.abs(Math.sin(t * 5 + c.ph)) * 0.01, c.z), _q, ONE); this.cartMesh.setMatrixAt(i, _m);
    });
    for (const c of this.camels) {
      let moving = false;
      if (c.down != null) { if ((c.down -= dt) <= 0) c.down = null; }
      else if (c.kind !== 'rest') {
        const d = Math.hypot(c.tx - c.x, c.tz - c.z);
        if (d < 0.5) { if ((c.wait -= dt) <= 0) { c.wait = rand(4, 14); this.camelGoal(c); } }
        else { moving = true; const s = Math.min(d, 0.85 * dt), want = Math.atan2(c.tx - c.x, c.tz - c.z); let dh = want - c.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); c.h += dh * Math.min(1, dt * 2); c.x += Math.sin(c.h) * s; c.z += Math.cos(c.h) * s; }
      }
      _q.setFromAxisAngle(UP, c.h); if (c.down != null) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.3));
      _m.compose(_p.set(c.x, terrainH(c.x, c.z) + (moving ? Math.abs(Math.sin(t * 3.2 + c.ph)) * 0.04 : 0), c.z), _q, ONE); c.mesh.setMatrixAt(c.idx, _m);
    }
    this.cartMesh.instanceMatrix.needsUpdate = true; for (const m of this.camelMeshes) m.instanceMatrix.needsUpdate = true;
  }
  // ---------- beyond the map: the city goes on for miles (packed flat-roofed blocks, minarets everywhere), the Nile
  // valley's palms, the Mokattam hills east; west, the desert to the horizon with Saqqara's step pyramid and Dahshur ----------
  world(scene) {
    const r = rnd(2024), R = (a, b) => a + r() * (b - a);
    const inside = (x, z) => x > -746 && x < E && Math.abs(z) < E;
    // the land: a big height field (desert west, city plain, the hills east), sunk where the map and the river are
    const N = 220, SZ = 3600, geo = new THREE.PlaneGeometry(SZ, SZ, N, N).rotateX(-Math.PI / 2), p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), riv = Math.abs(x - nileX(z)) < NILE.hw + 26;
      let h = x < -124 ? terrainH(Math.max(x, -740), z) + (x < -740 ? (fbm(x * 0.006, z * 0.006, 3) - 0.3) * 18 : 0) : x > 420 ? (x - 420) * 0.06 * (0.6 + fbm(x * 0.01, z * 0.01, 3)) : 0;
      if (riv) h = -6;
      if (inside(x, z) && (x < -746 + 20 || x > E - 20 || Math.abs(z) > E - 20)) h -= 0.3; else if (inside(x, z)) h = -10;
      p.setY(i, h);
      const n = fbm(x * 0.02, z * 0.02, 3);
      if (x < -124) c.setHSL(0.1, 0.42, 0.62 + n * 0.08, THREE.SRGBColorSpace); else if (x > 420) c.setHSL(0.09, 0.25, 0.55 + n * 0.1, THREE.SRGBColorSpace); else c.setHSL(0.09, 0.18, 0.5 + n * 0.08, THREE.SRGBColorSpace);
      c.toArray(col, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); land.receiveShadow = true; scene.add(land);
    // the endless low-rise city: boxes with a Cairo facade drawn on them by a small shader, a few minarets above
    const boxes = [], mins = [], palms = [];
    for (let x = -124; x < 900; x += R(6.5, 8.5)) for (let z = -1000; z < 1000; z += R(6.5, 8.5)) {
      if (x < 150 && Math.abs(z) < 150) continue;                    // the playable city; everything round it is the endless city
      const rw = NILE.hw + Math.min(14, Math.max(0, Math.abs(z) - 360) * 0.02); if (Math.abs(x - nileX(z)) < rw + 6) continue;
      if (x > 420) continue;
      const d = Math.hypot(x, z); if (d > 1100 || r() > Math.exp(-(d - 300) / 500)) continue;
      if (r() < 0.12) continue;                                       // a street, a gap
      const w = R(4.5, 7.5), dd = R(4.5, 7.5), h = Math.round(R(3, 10)) * 1.0 + 0.5;
      boxes.push([x, z, w, r() < 0.15 ? h + Math.round(R(3, 7)) : h, dd, r() < 0.22]);
      if (r() < 0.018) mins.push([x + R(-2, 2), z + R(-2, 2), R(10, 18)]);
    }
    for (let z = -1500; z < 1500; z += R(4, 9)) for (const s of [-1, 1]) if (!inside(nileX(z), z) || Math.abs(z) > E) for (let k = 0; k < 2; k++) palms.push([nileX(z) + s * (NILE.hw + Math.min(14, Math.max(0, Math.abs(z) - 360) * 0.02) + R(4, 30)), z + R(-3, 3)]);
    const tex = canvasTex(256, 256, (cx, w, h) => {
      cx.fillStyle = '#d8ccb6'; cx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { cx.fillStyle = `rgba(90,70,50,${Math.random() * 0.08})`; cx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 20, 3 + Math.random() * 20); }
      for (const [x, y] of [[30, 60], [150, 60]]) { cx.fillStyle = '#2c3038'; cx.fillRect(x, y, 70, 110); cx.fillStyle = '#6b5a3a'; cx.fillRect(x - 6, y, 6, 110); cx.fillRect(x + 70, y, 6, 110); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const bmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    bmat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float al = abs(normal.x) > 0.5 ? sc.z : sc.x; vMapUv = uv * vec2(max(1.0, floor(al / 2.4)), max(1.0, floor(sc.y)));
        if (abs(normal.y) > 0.5) vMapUv = vec2(0.02);`);
    };
    const bg = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const bm = new THREE.InstancedMesh(bg, bmat, boxes.length);
    boxes.forEach(([x, z, w, h, d, brick], i) => { _m.compose(_p.set(x, 0, z), _q.identity(), _s.set(w, h, d)); bm.setMatrixAt(i, _m); bm.setColorAt(i, brick ? new THREE.Color(BRICKC()) : new THREE.Color(PLASTER())); });
    bm.receiveShadow = true; scene.add(bm);
    // rooftop tanks on the background roofs too (one in three)
    const tk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), Math.ceil(boxes.length / 3));
    let ti = 0; boxes.forEach(([x, z, , h], i) => { if (i % 3) return; _m.makeTranslation(x + 1, h, z + 1); tk.setMatrixAt(ti, _m); tk.setColorAt(ti++, new THREE.Color(pick([0xe8e6e0, 0x1c1d20, 0x3a5a8a]))); }); tk.count = ti; scene.add(tk);
    const mg = mergeGeometries([tint(new THREE.CylinderGeometry(0.5, 0.6, 1, 8).translate(0, 0.5, 0), 0xd8c8a4), tint(new THREE.CylinderGeometry(0.8, 0.8, 0.04, 8).translate(0, 0.78, 0), 0xc8b894), tint(new THREE.ConeGeometry(0.4, 0.12, 8).translate(0, 1.06, 0), 0xc8b894)]);
    const mm = new THREE.InstancedMesh(mg, this.mat, mins.length);
    mins.forEach(([x, z, h], i) => { _m.compose(_p.set(x, 0, z), _q.identity(), _s.set(1, h, 1)); mm.setMatrixAt(i, _m); }); scene.add(mm);
    // palms along the river
    const pg = mergeGeometries([tint(new THREE.CylinderGeometry(0.08, 0.14, 3, 5).translate(0, 1.5, 0), 0x7a6040), tint(new THREE.SphereGeometry(1, 7, 4).scale(1.2, 0.45, 1.2).translate(0, 3.1, 0), 0x4a7a32)]);
    const pm = new THREE.InstancedMesh(pg, this.mat, palms.length);
    palms.forEach(([x, z], i) => { _m.compose(_p.set(x, 0, z), _q.setFromAxisAngle(UP, r() * 6), _s.setScalar(R(0.8, 1.3))); pm.setMatrixAt(i, _m); }); scene.add(pm);
    // the far pyramids: Saqqara's stepped one, Dahshur's Bent and Red pyramids
    const F = [];
    const stepPyr = (x, z, s) => { for (let k = 0; k < 6; k++) F.push(box(s * (1 - k * 0.15), s * 0.13, s * 0.8 * (1 - k * 0.15), x, terrainH(-740, z) + s * 0.13 * (k + 0.5), z, 0xcaa874)); };
    const pyr = (x, z, s, h, bent) => { const g3 = bent ? new THREE.CylinderGeometry(s * 0.2, s * 0.71, h, 4, 2).rotateY(Math.PI / 4) : new THREE.ConeGeometry(s * 0.71, h, 4).rotateY(Math.PI / 4); F.push(tint(g3.translate(x, h / 2 + 4, z), bent ? 0xb8a070 : 0xb87a5a)); };
    stepPyr(-820, 520, 40); pyr(-900, 980, 70, 44, true); pyr(-860, 1100, 72, 40, false); pyr(-760, 360, 22, 14, false);
    const far = new THREE.Mesh(mergeGeometries(F), this.mat); far.castShadow = true; scene.add(far);
  }

  // Cairo's sound: the bazaar's roar, the river at the bank, the call to prayer from the minarets (several at once,
  // a little out of step, the way the whole city hears it); plus generic sounds that belong here: cameras clicking
  // at the pyramids, laughter and the rattle of dice from backgammon at the cafés
  sounds(dt) {
    if (!sfx.ready) return;
    if (!this.sndReq) { this.sndReq = true; sfx.loadExtra('bazaar', 'assets/amb-bazaar.mp4'); sfx.loadExtra('nile', 'assets/amb-nile.mp4'); sfx.loadExtra('adhan', 'assets/adhan.mp4'); this.adhanT = rand(25, 40); }
    const T = G.camTarget; if (!T) return;
    const reach = (d, r0, r1) => Math.max(0, Math.min(1, 1 - (d - r0) / (r1 - r0)));
    if (!this.bzLoop && sfx.has('bazaar')) this.bzLoop = sfx.loop('bazaar', 0, 0);
    if (!this.nlLoop && sfx.has('nile')) this.nlLoop = sfx.loop('nile', 0, 0);
    const bz = this.C.bazaar;
    if (this.bzLoop) { const x = Math.max(bz.x0, Math.min(bz.x1, T.x)), z = Math.max(bz.z0, Math.min(bz.z1, T.z)); this.bzLoop.move(x, z); this.bzLoop.set(0.9 * reach(Math.hypot(x - T.x, z - T.z) + T.dist * 0.12, 4, 45)); }
    if (this.nlLoop) { const nx = nileX(T.z), side = T.x > nx ? 1 : -1, x = nx + side * (NILE.hw - 1); this.nlLoop.move(x, T.z); this.nlLoop.set(0.6 * reach(Math.abs(T.x - x) + T.dist * 0.12, 3, 34)); }
    // the adhan, five times a day here meaning every few minutes of play; from the nearest big mosque and one more
    if ((this.adhanT -= dt) <= 0 && sfx.has('adhan')) {
      this.adhanT = rand(240, 360);
      const ms = this.C.mosques.map((m) => ({ m, d: Math.hypot(m.hall.x - T.x, m.hall.z - T.z) })).sort((a, b) => a.d - b.d);
      if (ms[0]) sfx.once('adhan', ms[0].m.hall.x, ms[0].m.hall.z, 1.0);
      if (ms[1]) setTimeout(() => sfx.once('adhan', ms[1].m.hall.x, ms[1].m.hall.z, 0.55, 0.995), 2600);
      if (ms[3]) setTimeout(() => sfx.once('adhan', ms[3].m.hall.x, ms[3].m.hall.z, 0.35, 1.004), 5200);
    }
    const A = G.agents; if (!A) return;
    const near = (f) => { const c = []; for (const p of A.peds) if (f(p) && Math.abs(p.pos.x - T.x) + Math.abs(p.pos.z - T.z) < 40) { c.push(p); if (c.length > 20) break; } return c.length ? pick(c) : null; };
    if (T.x < -128 && (this._shot = (this._shot ?? 3) - dt) <= 0) { this._shot = rand(1.5, 5); const p = near((q) => q.tourist && q.act === 'film' && q.pos.x < -128); if (p) sfx.once('shutter', p.pos.x, p.pos.z, 0.45, rand(0.94, 1.08)); }
    if ((this._laugh = (this._laugh ?? 10) - dt) <= 0) { this._laugh = rand(14, 26); const p = near((q) => q.act === 'sit' || q.group); if (p) sfx.once(Math.random() < 0.6 ? 'laughW' : 'laughM', p.pos.x, p.pos.z, 0.3, rand(0.95, 1.05)); }
    if ((this._dice = (this._dice ?? 8) - dt) <= 0) { this._dice = rand(10, 20); const p = near((q) => q.act === 'sit'); if (p) sfx.once('dice', p.pos.x, p.pos.z, 0.35); }
  }
  // things knocked over by a blast: donkey carts, camels; boats close by are swamped
  onBlast(x, y, z, r, power) {
    const hit = (px, pz, k = 0.6) => Math.hypot(px - x, pz - z) < r * k && power > 1;
    for (const c of this.carts || []) if (c.down == null && hit(c.x, c.z)) c.down = rand(30, 45);
    for (const c of this.camels || []) if (c.down == null && hit(c.x, c.z)) c.down = rand(30, 45);
    for (const b of this.boatList || []) if (!b.sunk && hit(b.m.position.x, b.m.position.z, 0.45) && power > 2) { b.sunk = true; b.m.rotation.z = 0.7; }
  }
  update(dt) {
    const n = G.night || 0;
    for (const m of this.signs) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.3 + n * 1.5);
    if (this.lanternMat) this.lanternMat.emissiveIntensity = 0.15 + n * 1.6;
    if (this.lampGlobe) this.lampGlobe.material.color.setScalar(0.6 + n * 0.9);
    this.updateBoats(dt); this.updateVehicles(); this.updateAnimals(dt); this.sounds(dt);
    if (G.agents) for (const p of G.agents.peds) { const q = p.pos; if (q.x > -136) continue;
      for (const k of KEEP) { const dx = q.x - k.x, dz = q.z - k.z; if (Math.abs(dx) < k.hx && Math.abs(dz) < k.hz) { if (k.hx - Math.abs(dx) < k.hz - Math.abs(dz)) q.x = k.x + Math.sign(dx || 1) * k.hx; else q.z = k.z + Math.sign(dz || 1) * k.hz; } } }
    // the Sphinx's head comes down with its body
    if ((this.restsT -= dt) <= 0) {
      this.restsT = 0.5;
      for (const rr of this.C.rests) { if (rr.done) continue; const all = rr.under.reduce((a, b) => a + b.cells.length, 0), alive = rr.under.reduce((a, b) => a + b.cells.filter((c) => c.alive && !c.falling).length, 0); if (alive < all * 0.45) { rr.done = true; const cells = rr.top.cells.filter((c) => c.alive && !c.falling); if (cells.length) G.buildings.startCollapse(rr.top, cells); } }
    }
  }
}

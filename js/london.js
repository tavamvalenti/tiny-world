// LONDON: Westminster to the Tower on the real course of the Thames (north = -z). The river runs in from Vauxhall,
// north past Lambeth Palace, the Palace of Westminster (west bank) and the London Eye (east bank), bends east at the
// Embankment, and runs east past the South Bank, Tate Modern, Southwark and London Bridge to Tower Bridge. It is
// sunk between granite embankment walls well below the streets, so the bridges stand clear of the water on their
// piers and arches and the boats pass underneath. Bridges in their real order: Lambeth and Westminster across the
// north-south stretch; Waterloo, Blackfriars, Southwark, London Bridge and Tower Bridge across the eastward one, with
// the Millennium footbridge lined up on St Paul's. West of Whitehall: Parliament Square and the Abbey, Downing
// Street and Horse Guards, St James's Park and The Mall to Buckingham Palace; Trafalgar Square and Piccadilly Circus
// to the north. The City's towers cluster round the Gherkin north of the river, the Shard rises over London Bridge
// station, and south of the river the streets turn into the ends: council estates, tower blocks and terraces down
// through Elephant & Castle, Walworth, Peckham and Brixton. Everything is packed tight: terraces, mansion blocks and
// shopping streets; beyond the map the city carries on as dense brick terraces and flats with parks and woods.
// Distances are compressed to fit (the order, banks and alignments are kept).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { policeHQ } from './maps.js';
import { sfx, beachRadio } from './audio.js';
import { hsl, tint, box, cyl, cone, sph, canvasTex, hipRoof, merged, netCtx, paintNetwork, topOf, hangOn, rnd, skinOn, pyramidTris } from './mapkit.js';
import { makeShingles } from './textures.js';

const XS = [-110, -90, -72, -10, 25, 55, 80, 105, 135], ZS = [-96, -68, -46, 8, 42, 78, 114];
// ---------- the Thames ----------
// The water sits WL below the street; the walls drop to a bed at BED. In the map the centreline runs north up x = -43
// (banks at -56 and -30), turns round (-30, -12) and runs east along z = -25 (banks at -38 and -12): 26 wide.
export const WL = -2.8;
const BED = -4.6, HW = 13;
const BEND = { x: -30, z: -12 };
// the centreline from far in the south-west to far in the east (beyond the map it is only scenery)
function centreline() {
  const out = [], push = (x, z) => { const l = out[out.length - 1]; if (!l || Math.hypot(l.x - x, l.z - z) > 0.5) out.push(new THREE.Vector3(x, 0, z)); };
  const sw = new THREE.CatmullRomCurve3([[-1700, 300], [-1250, 390], [-900, 320], [-600, 360], [-360, 390], [-190, 340], [-95, 275], [-52, 215], [-43, 180], [-43, 170]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  for (const p of sw.getSpacedPoints(160)) push(p.x, p.z);
  for (let z = 166; z > BEND.z; z -= 4) push(-43, z);
  for (let a = Math.PI; a <= Math.PI * 1.5 + 1e-6; a += Math.PI / 24) push(BEND.x + Math.cos(a) * 13, BEND.z + Math.sin(a) * 13);
  for (let x = -26; x < 176; x += 4) push(x, -25);
  const e = new THREE.CatmullRomCurve3([[176, -25], [186, -25], [260, -27], [330, 0], [372, 80], [420, 190], [520, 236], [604, 160], [626, 40], [720, -22], [900, 22], [1150, 84], [1700, 40]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  for (const p of e.getSpacedPoints(160)) push(p.x, p.z);
  return out;
}
export const RIVER = (() => {
  const C = centreline(), L = [], R = [], W = [];
  C.forEach((p, i) => {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)], t = new THREE.Vector3().subVectors(b, a).normalize();
    const far = Math.max(0, Math.max(Math.abs(p.x), Math.abs(p.z)) - 200), w = HW + Math.min(5, far * 0.02);
    // left = the west/north bank (outer side of the bend)
    L.push(new THREE.Vector3(p.x + t.z * w, 0, p.z - t.x * w)); R.push(new THREE.Vector3(p.x - t.z * w, 0, p.z + t.x * w)); W.push(w);
  });
  // the inner bank of the bend is a single corner
  R.forEach((v) => { if (v.x < BEND.x + 0.01 && v.z < BEND.z + 0.01 && Math.hypot(v.x - BEND.x, v.z - BEND.z) < 1) v.set(BEND.x, 0, BEND.z); });
  // a coarse grid of centreline segments for "is this point in or near the river" far from the map
  const cell = 60, grid = new Map(), key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i + 1 < C.length; i++) for (const p of [C[i], C[i + 1]]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const k = key(p.x + dx * cell, p.z + dz * cell); if (!grid.has(k)) grid.set(k, new Set()); grid.get(k).add(i); }
  const near = (x, z, pad = 0) => {
    const s = grid.get(key(x, z)); if (!s) return false;
    for (const i of s) {
      const a = C[i], b = C[i + 1], ux = b.x - a.x, uz = b.z - a.z, l2 = ux * ux + uz * uz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * ux + (z - a.z) * uz) / l2)), d = Math.hypot(a.x + ux * t - x, a.z + uz * t - z);
      if (d < W[i] + pad) return true;
    }
    return false;
  };
  return { C, L, R, W, near };
})();
// the river inside the map, exactly
export function inRiver(x, z) {
  if (z > BEND.z && x > -56 && x < -30) return true;
  if (x > BEND.x && z > -38 && z < BEND.z) return true;
  if (x <= BEND.x && z <= BEND.z) return Math.hypot(x - BEND.x, z - BEND.z) < 26;
  return false;
}
// bridges: axis 'x' runs along x across the north-south stretch at z = at; axis 'z' along z across the eastward one
export const BRIDGES = [
  { name: 'Westminster', axis: 'x', at: 8, col: 0x2f6b4a, piers: [6.5, 9, 11], stone: 0x9a9384 },
  { name: 'Lambeth', axis: 'x', at: 42, col: 0xb3302a, piers: [6.5, 10], stone: 0x9a9384 },
  { name: 'Waterloo', axis: 'z', at: -10, col: 0xd8d2c4, piers: [6.5, 10], stone: 0xd2ccbe },
  { name: 'Blackfriars', axis: 'z', at: 25, col: 0xb3302a, piers: [6.5, 10], stone: 0x9a9384 },
  { name: 'Southwark', axis: 'z', at: 55, col: 0x3a7a5a, piers: [6.5], stone: 0x9a9384 },
  { name: 'London Bridge', axis: 'z', at: 80, col: 0xc9c4b8, piers: [6.5], stone: 0xc9c4b8 },
  { name: 'Tower Bridge', axis: 'z', at: 105, col: 0x6fa0d0, piers: [], tower: true },
];
const span = (b) => (b.axis === 'x' ? { c: -43, a0: -56, a1: -30 } : { c: -25, a0: -38, a1: -12 });
function onBridge(x, z) {
  for (const b of BRIDGES) { const s = span(b); if (b.axis === 'x' ? Math.abs(z - b.at) < 3.4 && x > s.a0 - 3 && x < s.a1 + 3 : Math.abs(x - b.at) < 3.4 && z > s.a0 - 3 && z < s.a1 + 3) return true; }
  return Math.abs(x - 40) < 1.3 && z > -39 && z < -11;     // the Millennium footbridge
}
const wet = (x, z) => inRiver(x, z) && !onBridge(x, z);

// ---------- palettes ----------
const BRICK = () => { const r = Math.random(); return r < 0.4 ? hsl(rand(0.02, 0.05), rand(0.38, 0.52), rand(0.36, 0.46)) : r < 0.75 ? hsl(rand(0.06, 0.09), rand(0.3, 0.42), rand(0.42, 0.52)) : hsl(rand(0.09, 0.12), rand(0.2, 0.32), rand(0.56, 0.66)); };
const STOCK = () => hsl(rand(0.09, 0.12), rand(0.18, 0.3), rand(0.5, 0.62));        // yellow London stock brick, sooted
const STUCCO = () => hsl(rand(0.09, 0.12), rand(0.06, 0.16), rand(0.86, 0.94));
const STONE = () => hsl(rand(0.1, 0.13), rand(0.12, 0.26), rand(0.7, 0.82));
const PORTLAND = hsl(0.11, 0.16, 0.84);
const GLASS = (l) => hsl(0.56, rand(0.08, 0.16), l);
const SLATE = () => (Math.random() < 0.7 ? hsl(0.6, 0.06, rand(0.26, 0.34)) : hsl(0.04, 0.32, rand(0.32, 0.4)));

// how each kind of street building is built: style, colours, floors, frontage, depth, cell size
const KIND = {
  terrace: { style: 'brick', tint: () => (Math.random() < 0.5 ? BRICK() : STOCK()), floors: [2, 3], gh: 1.25, fh: 0.95, front: [4.8, 7], depth: 4.4, cell: 1.75, gable: true, shop: false },
  stucco: { style: 'stucco', tint: STUCCO, floors: [4, 5], gh: 1.35, fh: 1.0, front: [5, 8], depth: 5, cell: 1.8, shop: false },
  mixed: { style: 'brick', tint: () => (Math.random() < 0.65 ? BRICK() : STONE()), floors: [3, 6], gh: 1.45, fh: 1.0, front: [3.4, 6], depth: 5, cell: 1.7, shop: true },
  mansion: { style: 'brick', tint: () => hsl(rand(0.02, 0.05), rand(0.42, 0.55), rand(0.38, 0.46)), floors: [5, 7], gh: 1.45, fh: 1.0, front: [8, 13], depth: 6, cell: 2, shop: true },
  city: { style: 'office', tint: () => (Math.random() < 0.5 ? STONE() : GLASS(rand(0.55, 0.72))), floors: [8, 14], gh: 1.7, fh: 1.15, front: [6, 11], depth: 8, cell: 2.2, shop: true },
  warehouse: { style: 'brick', tint: () => hsl(rand(0.03, 0.07), rand(0.3, 0.42), rand(0.3, 0.4)), floors: [5, 7], gh: 1.4, fh: 1.05, front: [7, 11], depth: 7, cell: 2.1, shop: false },
  flats: { style: 'brick', tint: () => (Math.random() < 0.2 ? hsl(0.1, 0.06, rand(0.62, 0.74)) : hsl(rand(0.03, 0.07), rand(0.3, 0.44), rand(0.34, 0.46))), floors: [4, 6], gh: 1.3, fh: 1.0, front: [10, 16], depth: 5, cell: 2.2, shop: false },
};

export function london(B) {
  const ctx = netCtx({
    xs: XS, zs: ZS, roadW: 5, sw: 1.6, half: 150, extent: 200, base: '#8a8579', centerLine: 'white', lights: true, side: -1,
    // no streets across the water except at the bridges
    skipEdge: (a, b) => (a.z === b.z ? Math.min(a.x, b.x) <= -72 && Math.max(a.x, b.x) >= -10 && ![8, 42, -46, -68, -96].includes(a.z) : Math.min(a.z, b.z) <= -46 && Math.max(a.z, b.z) >= 8 && a.x === 135),
  }, B);
  const { city, g } = ctx;
  city.side = -1;                                   // keep left
  city.mapKind = 'london';
  city.named = []; city.crowds = []; city.stationed = [];
  const L = (city.london = { pubs: [], tube: [], phones: [], posts: [], flags: [], bunting: [], roofFlags: [], chimneys: [], vendors: [], horses: [], guards: [], speakers: [], scooters: [], graffiti: [], rests: [], screens: [], lean: [] });
  const name = (S, o, x0, x1, z0, z1) => city.named.push({ S, o, x0, x1, z0, z1 });
  city.vehicles = { taxi: { p: 0.24, colors: [0x101012] }, colors: [0x1c1d22, 0x8a8f96, 0xe8e8e4, 0x2a3448, 0x3a3d42, 0x5a5e64, 0xc8c8c4, 0x1f2a44, 0x0e0e10, 0x6b1a1a],
    bus: { p: 0.1, kinds: [{ color: 0xc8102e, h: 2.4, len: 3.05 }] }, moto: 0.18 };
  // Londoners dress dark: black, charcoal, navy, grey, the odd camel coat
  city.palette = { shirts: [0x111214, 0x1c1d22, 0x26282d, 0x34373d, 0x4a4d52, 0x5e6167, 0x1f2a44, 0x2b3445, 0x3a3226, 0x6b5a45, 0x8a8f96, 0x0e0e10, 0x2a2a2e, 0xb8b2a6], pants: [0x111214, 0x1c1d22, 0x2a3448, 0x34373d, 0x4a4a4e, 0x232527], sleeves: 0.06 };
  const blk = (i, j) => city.blocks.find((b) => b.i === i && b.j === j);

  // ---------- ground ----------
  g.rect(-200, -200, 200, 200, '#7f7a70');
  paintNetwork(g, city, { centerLine: 'white', edgeLine: 'rgba(230,190,40,.9)',
    stubs: (N) => [N.x === XS[0] && (N.z < -75 || N.z > 15) ? { axis: 'x', to: -200 } : null, N.x === XS[8] && N.z !== -46 && N.z !== 8 ? { axis: 'x', to: 200 } : null, N.z === ZS[0] ? { axis: 'z', to: -200 } : null, N.z === ZS[6] && N.x !== -72 && N.x !== -10 ? { axis: 'z', to: 200 } : null].filter(Boolean) });
  for (const b of city.blocks) city.paintSidewalk(g, b, '#aea99f');
  const grass = (x0, z0, x1, z1, c = '#5d7842') => city.paintGrass(g, x0, z0, x1, z1, c);
  const lot = (x0, z0, x1, z1, c = '#8f8a7f') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.2, 30); };
  // the Mall's red road
  g.rect(-110, -48.5, -72, -43.5, '#8f4a3c');

  // ---------- building helpers ----------
  // landmarks: destructible, no random shop signs
  const M = (o) => { const b = B.add({ cell: 1.6, gh: 1.6, fh: 1.1, storefront: false, ...o }); b.noSigns = true; b.landmark = true; return b; };
  // something resting on other buildings (an upper storey on legs): it falls when they do
  const rests = (top, under) => L.rests.push({ top, under });
  const range = ([a, b]) => Math.round(rand(a, b));
  // one building of a kind; `face` is the side toward the street (n s e w)
  const bld = (x, z, w, d, kind, o = {}) => {
    const K = KIND[kind];
    if (wet(x, z) || inRiver(x - w / 2, z) || inRiver(x + w / 2, z) || inRiver(x, z - d / 2) || inRiver(x, z + d / 2)) return null;
    const floors = o.floors ?? range(K.floors);
    const b = B.add({ x, z, w, d, floors, style: o.style || K.style, tint: o.tint || K.tint(), gh: K.gh, fh: K.fh, cell: o.cell || K.cell, storefront: o.shop ?? K.shop, gable: o.gable ?? K.gable, roofTint: K.gable ? SLATE() : undefined });
    if (!(o.shop ?? K.shop)) b.noSigns = Math.random() < 0.85;
    b.kind = kind; b.face = o.face;
    if (K.gable) L.chimneys.push(b);
    return b;
  };
  // a row of buildings filling a strip: frontages along the long axis
  const strip = (x0, z0, x1, z1, kind, face, o = {}) => {
    const K = KIND[kind], along = x1 - x0 >= z1 - z0, len = along ? x1 - x0 : z1 - z0, out = [];
    const fr = o.front || K.front;
    for (let a = 0; a < len - 1.2;) {
      let w = rand(fr[0], fr[1]); if (len - a - w < fr[0] * 0.7) w = len - a;
      const m = a + w / 2;
      const b = along ? bld(x0 + m, (z0 + z1) / 2, w - 0.06, z1 - z0, kind, { ...o, face }) : bld((x0 + x1) / 2, z0 + m, x1 - x0, w - 0.06, kind, { ...o, face });
      if (b) out.push(b);
      a += w;
    }
    return out;
  };
  // pack a rectangle solid: a ring of street fronts, then rows of back buildings with narrow alleys between
  const pack = (R, kind, o = {}) => {
    const K = KIND[kind], d = o.depth || K.depth, out = [];
    lot(R.x0, R.z0, R.x1, R.z1, o.ground || '#7d786e');
    const W = R.x1 - R.x0, D = R.z1 - R.z0;
    if (W < d * 1.2 || D < d * 1.2) return strip(R.x0, R.z0, R.x1, R.z1, kind, W > D ? 's' : 'e', o);
    out.push(...strip(R.x0, R.z0, R.x1, R.z0 + d, kind, 'n', o), ...strip(R.x0, R.z1 - d, R.x1, R.z1, kind, 's', o));
    out.push(...strip(R.x0, R.z0 + d, R.x0 + d, R.z1 - d, kind, 'w', o), ...strip(R.x1 - d, R.z0 + d, R.x1, R.z1 - d, kind, 'e', o));
    // the inside: yards and alleys, then back rows
    const I = { x0: R.x0 + d + 1.1, z0: R.z0 + d + 1.1, x1: R.x1 - d - 1.1, z1: R.z1 - d - 1.1 };
    g.rect(R.x0 + d, R.z0 + d, R.x1 - d, R.z1 - d, o.yard || '#6e6a60');
    if (I.x1 - I.x0 > 3 && I.z1 - I.z0 > 3) {
      const inner = o.inner || (kind === 'city' ? 'city' : kind === 'stucco' || kind === 'terrace' ? 'terrace' : kind);
      const along = I.x1 - I.x0 >= I.z1 - I.z0, depth = Math.min(KIND[inner].depth, (along ? I.z1 - I.z0 : I.x1 - I.x0));
      const span = along ? I.z1 - I.z0 : I.x1 - I.x0;
      const n = Math.max(1, Math.floor((span + 1) / (depth + 1.1)));
      const dd = (span - (n - 1) * 1.1) / n;
      for (let k = 0; k < n; k++) {
        const a = (along ? I.z0 : I.x0) + k * (dd + 1.1);
        if (o.courtyard && n > 2 && k === Math.floor(n / 2)) { if (along) for (let x = I.x0 + 2; x < I.x1 - 1; x += 3.5) city.addTree(x, a + dd / 2, rand(0.8, 1.1)); continue; }
        out.push(...(along ? strip(I.x0, a, I.x1, a + dd, inner, 'n', { ...o, shop: false, cell: 2.2 }) : strip(a, I.z0, a + dd, I.z1, inner, 'w', { ...o, shop: false, cell: 2.2 })));
      }
    }
    return out;
  };
  // a whole block, inside its sidewalks, with a pub on a corner and people outside it
  const fillBlock = (b, kind, o = {}) => {
    const R = { x0: b.lx0, z0: b.lz0, x1: b.lx1, z1: b.lz1, ...(o.R || {}) };
    const out = pack(R, kind, o);
    if (kind !== 'city' && o.pub !== false && Math.random() < 0.8) {
      const cx = Math.random() < 0.5 ? R.x0 + 1.2 : R.x1 - 1.2, cz = Math.random() < 0.5 ? R.z0 + 1.2 : R.z1 - 1.2;
      L.pubs.push({ x: cx, z: cz, sx: cx < (R.x0 + R.x1) / 2 ? -1 : 1, sz: cz < (R.z0 + R.z1) / 2 ? -1 : 1 });
      city.crowds.push({ x: cx + (cx < (R.x0 + R.x1) / 2 ? -1.7 : 1.7), z: cz, r: 0.75, n: Math.round(rand(3, 6)), look: 'commuter' });
    }
    return out;
  };
  const flag = (x, z, h = 3.4) => L.flags.push({ x, z, h });

  // ================= WESTMINSTER: the Palace, Big Ben, the Abbey, Whitehall =================
  {
    const gold = hsl(0.11, 0.36, 0.62);
    lot(-67.9, 12.1, -56, 37.9, '#9a9384');
    // Elizabeth Tower at the bridge end: a tall square shaft (the clock stage, belfry and spire hang on its top)
    const big = M({ x: -60.6, z: 14.6, w: 4.6, d: 4.6, floors: 22, style: 'gothic', tint: hsl(0.105, 0.42, 0.6), cell: 1.53, gh: 1.6, fh: 1.12 });
    // the long river front, the inner ranges and Westminster Hall behind, the Central Tower over the lobby
    const front = M({ x: -61.4, z: 25, w: 8.6, d: 15.2, floors: 5, style: 'gothic', tint: gold, cell: 1.72, gh: 1.6, fh: 1.25 });
    const hall = M({ x: -66.4, z: 21.5, w: 3, d: 8.4, floors: 5, style: 'gothic', tint: hsl(0.1, 0.3, 0.56), cell: 1.5, gh: 1.6, fh: 1.2, gable: true, roofTint: hsl(0.58, 0.08, 0.36) });
    const inner = M({ x: -66.4, z: 30.2, w: 3, d: 8, floors: 4, style: 'gothic', tint: gold, cell: 1.5, gh: 1.6, fh: 1.25 });
    const central = M({ x: -63.4, z: 25, w: 3.2, d: 3.2, floors: 9, style: 'gothic', tint: gold, cell: 1.6, gh: 1.6, fh: 1.25 });
    const victoria = M({ x: -62.4, z: 35.2, w: 6, d: 5.2, floors: 18, style: 'gothic', tint: gold, cell: 1.5, gh: 1.6, fh: 1.18 });
    L.parliament = { big, front, hall, inner, central, victoria };
    name('The Houses of Parliament', 'the Houses of Parliament', -68, -56, 12, 38); name('Big Ben', 'Big Ben', -63, -58, 12, 17);
    city.crowds.push({ x: -50, z: 4.7, r: 1.1, n: 6, look: 'tourist', act: 'spect', face: { x: -60.6, z: 14.6 } }, { x: -36, z: 4.7, r: 1, n: 5, look: 'tourist', act: 'spect', face: { x: -60.6, z: 14.6 } }, { x: -66, z: 10.4, r: 0.9, n: 4, look: 'tourist', act: 'spect', face: { x: -60.6, z: 14.6 } });
    city.crowds.push({ x: -69, z: 38.6, r: 0.4, n: 2, look: 'metpolice', tag: 'met' }, { x: -69, z: 12.6, r: 0.4, n: 2, look: 'metpolice', tag: 'met' });
    // St Thomas' Hospital on the east bank opposite
    lot(-30, 12.1, -14.1, 37.9, '#a19b8e');
    for (const [z, d] of [[15.5, 6], [24, 7], [32.6, 6.6]]) M({ x: -21.5, z, w: 13, d, floors: Math.round(rand(6, 8)), style: 'concrete', tint: hsl(0.1, 0.05, rand(0.8, 0.86)), cell: 2.2, gh: 1.6, fh: 1.05 });
    for (let z = 13.5; z < 37; z += 4) city.addTree(-28.4, z, 1.1);
    name("St Thomas' Hospital", "St Thomas' Hospital", -30, -14, 12, 38);
  }
  {
    // Parliament Square (flags, statues, tourists) and Westminster Abbey to its south
    const b = blk(1, 3);
    grass(b.lx0, b.lz0, b.lx1, b.lz0 + 9.5);
    for (const [x, z] of [[b.lx0 + 1, b.lz0 + 1], [b.lx1 - 1, b.lz0 + 1], [b.lx0 + 1, b.lz0 + 8.5], [b.lx1 - 1, b.lz0 + 8.5]]) flag(x, z, 3.8);
    for (const x of [b.lx0 + 3, b.lx0 + 7]) city.crowds.push({ x, z: b.lz0 + 5, r: 0.8, n: 3, look: 'tourist' });
    lot(b.lx0, b.lz0 + 9.5, b.lx1, b.lz1, '#a29c8f');
    const stone = hsl(0.1, 0.16, 0.74);
    const nave = M({ x: -80.9, z: 30.5, w: 4.8, d: 13, floors: 5, style: 'gothic', tint: stone, cell: 1.6, gh: 1.8, fh: 1.4, gable: true, roofTint: hsl(0.58, 0.06, 0.4) });
    const towers = [M({ x: -82.6, z: 23.2, w: 2.2, d: 2.2, floors: 12, style: 'gothic', tint: stone, cell: 1.1, gh: 1.8, fh: 1.3 }), M({ x: -79.2, z: 23.2, w: 2.2, d: 2.2, floors: 12, style: 'gothic', tint: stone, cell: 1.1, gh: 1.8, fh: 1.3 })];
    const transept = [M({ x: -84.4, z: 32, w: 2.4, d: 3.6, floors: 5, style: 'gothic', tint: stone, cell: 1.2, gh: 1.8, fh: 1.4 }), M({ x: -77.4, z: 32, w: 2.4, d: 3.6, floors: 5, style: 'gothic', tint: stone, cell: 1.2, gh: 1.8, fh: 1.4 })];
    L.abbey = { nave, towers, transept };
    city.crowds.push({ x: -80.9, z: 21, r: 1, n: 5, look: 'tourist', act: 'spect', face: { x: -80.9, z: 24 } });
    name('Westminster Abbey', 'Westminster Abbey', -86, -76, 21, 38); name('Parliament Square', 'Parliament Square', -86, -76, 12, 21);
  }
  {
    // Whitehall's west side: Horse Guards (with the mounted sentries), the Treasury, Downing Street, the Foreign Office
    const b = blk(1, 2);
    lot(b.lx0, b.lz0, b.lx1, b.lz1, '#a29c8f');
    const hg = M({ x: -81.6, z: -33, w: 8.6, d: 10, floors: 3, style: 'concrete', tint: PORTLAND, cell: 1.72, gh: 1.8, fh: 1.3 });
    const hgT = M({ x: -81.6, z: -33, w: 2.4, d: 2.4, floors: 6, style: 'concrete', tint: PORTLAND, cell: 1.2, gh: 1.8, fh: 1.3 });
    L.horseGuards = { b: hg, tower: hgT };
    L.horses.push({ fixed: true, x: -77.1, z: -36.2, h: Math.PI / 2, cav: true }, { fixed: true, x: -77.1, z: -29.8, h: Math.PI / 2, cav: true });
    M({ x: -81, z: -21, w: 9.8, d: 9, floors: 5, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.6 });                               // the Treasury
    const ds = M({ x: -82.2, z: -12.6, w: 7.4, d: 4.4, floors: 3, style: 'brick', tint: hsl(0.04, 0.12, 0.16), cell: 1.5, gh: 1.4 });  // Downing Street (black brick)
    M({ x: -77.5, z: -12.6, w: 1.8, d: 4.4, floors: 3, style: 'brick', tint: hsl(0.04, 0.12, 0.18), cell: 1.5, gh: 1.4 });
    M({ x: -81, z: -2.4, w: 9.8, d: 10, floors: 5, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.6 });                              // the Foreign Office
    L.downing = { x: -82.2, z: -10.3, b: ds };
    city.crowds.push({ x: -82.2, z: -9.4, r: 0.3, n: 1, look: 'metpolice', tag: 'met' }, { x: -75.2, z: -33, r: 1, n: 6, look: 'tourist', act: 'spect', face: { x: -77.1, z: -33 } }, { x: -75.2, z: -12, r: 0.5, n: 2, look: 'metpolice', tag: 'met' });
    name('Downing Street', 'Downing Street', -86, -76, -16, -8); name('Horse Guards', 'Horse Guards', -86, -76, -40, -26); name('Whitehall', 'Whitehall', -76, -68, -44, 6);
  }
  {
    // the Embankment side of Whitehall: Whitehall Court, the Ministry of Defence, New Scotland Yard, Portcullis House
    lot(-67.9, -41.9, -56, 3.9, '#a29c8f');
    M({ x: -62, z: -36.5, w: 11.6, d: 10, floors: 7, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.6, fh: 1.1, setbacks: [{ f: 6, n: 1 }] });   // Whitehall Court
    M({ x: -62.6, z: -23, w: 10.4, d: 14, floors: 8, style: 'concrete', tint: hsl(0.11, 0.12, 0.78), cell: 2.3, gh: 1.6, fh: 1.1 });               // the MoD
    const nsy = M({ x: -62.6, z: -9.4, w: 10.4, d: 8, floors: 6, style: 'concrete', tint: hsl(0.09, 0.14, 0.72), cell: 2.1, gh: 1.6, fh: 1.1 });   // New Scotland Yard
    M({ x: -62.6, z: -0.6, w: 10.4, d: 7, floors: 6, style: 'concrete', tint: hsl(0.08, 0.22, 0.42), cell: 2.1, gh: 1.6, fh: 1.15 });              // Portcullis House
    L.nsy = { x: -56.9, z: -9.4, b: nsy };
    city.crowds.push({ x: -55.6, z: -12, r: 0.5, n: 2, look: 'metpolice', tag: 'met' });
    name('New Scotland Yard', 'New Scotland Yard', -68, -56, -14, -5); name('The Ministry of Defence', 'the Ministry of Defence', -68, -56, -30, -16);
    // the Embankment gardens round the bend, with Cleopatra's Needle on the river wall
    for (let x = -66; x < -14; x += 1) for (let z = -41.9; z < -33; z += 1) if (!inRiver(x + 0.5, z + 0.5) && !inRiver(x + 1.5, z + 0.5)) g.rect(x, z, x + 1, z + 1, '#5d7842');
    for (let x = -64; x < -16; x += 4.2) { const z = -40.6; if (!inRiver(x, z + 2)) city.addTree(x, z, 1.15); }
    L.needle = { x: -49.5, z: -35.6 };
    name("Cleopatra's Needle", "Cleopatra's Needle", -52, -46, -38, -33); name('Victoria Embankment', 'Victoria Embankment', -66, 135, -42, -38);
  }
  // St James's Park and its lake, between The Mall and Birdcage Walk
  {
    const b = blk(0, 2);
    grass(b.lx0 - 1.6, b.lz0 - 1.6, b.lx1 + 1.6, b.lz1 + 1.6);
    g.x.save(); g.x.fillStyle = '#5a7880'; g.x.beginPath(); g.x.ellipse(g.px((b.lx0 + b.lx1) / 2), g.px((b.lz0 + b.lz1) / 2), 4 * g.k, 15 * g.k, 0.05, 0, 6.283); g.x.fill(); g.x.restore();
    for (let i = 0; i < 70; i++) { const x = rand(b.lx0 + 0.5, b.lx1 - 0.5), z = rand(b.lz0 + 0.5, b.lz1 - 0.5); if (Math.abs((x - (b.lx0 + b.lx1) / 2) / 4.6) ** 2 + ((z - (b.lz0 + b.lz1) / 2) / 15.6) ** 2 > 1) city.addTree(x, z, rand(1.1, 1.6)); }
    city.wanderZones.push({ x0: b.lx0, x1: b.lx0 + 2.4, z0: b.lz0, z1: b.lz1 }, { x0: b.lx1 - 2.4, x1: b.lx1, z0: b.lz0, z1: b.lz1 });
    for (let k = 0; k < 6; k++) city.addProp('bench', b.lx0 + 1.2, rand(b.lz0 + 2, b.lz1 - 2), Math.PI / 2);
    name("St James's Park", "St James's Park", b.x0, b.x1, b.z0, b.z1);
    for (let x = -108; x < -74; x += 4.2) { city.addTree(x, -49.4, 1.2); city.addTree(x, -42.6, 1.2); }
    for (let x = -106; x < -74; x += 8) { flag(x, -49.9, 3.6); flag(x + 4, -42.1, 3.6); }       // Union flags all down The Mall
    L.mall = { z: -46, x0: -110, x1: -72 };
    name('The Mall', 'The Mall', -112, -72, -49, -43);
  }
  // Buckingham Palace at the end of The Mall, the Victoria Memorial in front, the King's Guard at the gates
  {
    lot(-150, -72, -112.5, -20, '#b6af9f');
    g.rect(-126, -60, -112.5, -32, '#d4cdbd');                       // the forecourt
    const pal = M({ x: -132.5, z: -46, w: 8, d: 34, floors: 4, style: 'concrete', tint: hsl(0.1, 0.1, 0.86), cell: 2.2, gh: 1.9, fh: 1.3 });
    const wings = [M({ x: -141, z: -60, w: 9, d: 6, floors: 4, style: 'concrete', tint: hsl(0.1, 0.1, 0.84), cell: 2.2, gh: 1.9, fh: 1.3 }), M({ x: -141, z: -32, w: 9, d: 6, floors: 4, style: 'concrete', tint: hsl(0.1, 0.1, 0.84), cell: 2.2, gh: 1.9, fh: 1.3 })];
    L.palace = { b: pal, wings, x: -132.5, z: -46, memorial: { x: -116.6, z: -46 } };
    // sentries at the gates in their boxes, a line of the guard in the forecourt
    for (const z of [-55, -51, -41, -37]) city.crowds.push({ x: -124.6, z, r: 0.05, n: 1, look: 'guard', act: 'attention', stay: true, face: { x: -110, z }, tag: 'guard' });
    for (const z of [-58, -52, -40, -34]) city.crowds.push({ x: -120.2, z: z + 0.5, r: 1.2, n: 6, look: 'tourist', act: 'spect', face: { x: -132, z: -46 } });
    city.wanderZones.push({ x0: -121.5, x1: -113, z0: -66, z1: -26 });
    for (let k = 0; k < 4; k++) flag(-119, -60 + k * 9.4, 3.8);
    grass(-150, -20, -112.5, 20); for (let i = 0; i < 46; i++) city.addTree(rand(-148, -114), rand(-18, 18), rand(1.2, 1.7));
    grass(-150, -112, -112.5, -72); for (let i = 0; i < 50; i++) city.addTree(rand(-148, -114), rand(-110, -74), rand(1.2, 1.7));
    city.wanderZones.push({ x0: -148, x1: -114, z0: -110, z1: -74 }, { x0: -148, x1: -114, z0: -18, z1: 18 });
    name('Buckingham Palace', 'Buckingham Palace', -138, -112, -64, -28); name('Green Park', 'Green Park', -150, -112, -112, -72);
    // the guard's march: from the palace along the south side of The Mall to Horse Guards, and back
    L.march = { a: { x: -114, z: -42.8 }, path: [[-114, -42.8], [-92.5, -42.8], [-87.5, -42.8], [-77.6, -42.8], [-77.6, -40.6]], anthem: { x: -122, z: -46 } };
  }
  // north of The Mall: Carlton House Terrace (stucco), Trafalgar Square, the National Gallery, Piccadilly Circus
  {
    fillBlock(blk(0, 1), 'stucco', { depth: 6, pub: false });
    const t = blk(1, 1);
    g.rect(t.lx0, t.lz0, t.lx1, t.lz1, '#c6bead'); g.grainRect(t.lx0, t.lz0, t.lx1, t.lz1, 0.3, 40);
    for (let x = t.lx0; x < t.lx1; x += 1.4) g.line(x, t.lz0, x, t.lz1, 0.04, 'rgba(0,0,0,.08)');
    L.trafalgar = { x: (t.lx0 + t.lx1) / 2, z: (t.lz0 + t.lz1) / 2 + 1 };
    city.wanderZones.push({ x0: t.lx0 + 0.5, x1: t.lx1 - 0.5, z0: t.lz0 + 0.5, z1: t.lz1 - 0.5 }, { x0: t.lx0 + 0.5, x1: t.lx1 - 0.5, z0: t.lz0 + 0.5, z1: t.lz1 - 0.5 });
    city.crowds.push({ x: L.trafalgar.x - 3, z: L.trafalgar.z + 4, r: 1.2, n: 7, look: 'tourist', act: 'spect', face: L.trafalgar }, { x: L.trafalgar.x + 3, z: L.trafalgar.z - 4.5, r: 1.2, n: 6, look: 'tourist' }, { x: L.trafalgar.x, z: L.trafalgar.z + 6.2, r: 0.6, n: 3, look: 'busker' });
    L.vendors.push({ x: t.lx0 + 0.8, z: t.lz1 - 1, kind: 'nuts' }, { x: t.lx1 - 0.8, z: t.lz0 + 1.4, kind: 'flags' });
    for (const [x, z] of [[t.lx0 + 0.6, t.lz0 + 0.6], [t.lx1 - 0.6, t.lz0 + 0.6]]) flag(x, z, 4);
    name('Trafalgar Square', 'Trafalgar Square', t.x0, t.x1, t.z0, t.z1); name("Nelson's Column", "Nelson's Column", L.trafalgar.x - 2, L.trafalgar.x + 2, L.trafalgar.z - 2, L.trafalgar.z + 2);
    const ng = blk(1, 0);
    lot(ng.lx0, ng.lz0, ng.lx1, ng.lz1);
    L.gallery = M({ x: (ng.lx0 + ng.lx1) / 2, z: ng.lz1 - 4.2, w: ng.lx1 - ng.lx0 - 0.4, d: 8, floors: 3, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.8, fh: 1.4 });
    strip(ng.lx0, ng.lz0, ng.lx1, ng.lz0 + 5.5, 'mixed', 'n'); strip(ng.lx0, ng.lz0 + 6.6, ng.lx1, ng.lz1 - 8.6, 'mixed', 'n', { shop: false });
    name('The National Gallery', 'the National Gallery', ng.x0, ng.x1, ng.z1 - 9, ng.z1);
    // Piccadilly Circus: the curved corner of screens over the junction, Eros, the Tube steps
    const pc = blk(0, 0);
    const scr = M({ x: pc.lx1 - 4.6, z: pc.lz1 - 4.6, w: 9.2, d: 9.2, floors: 5, style: 'brick', tint: hsl(0.08, 0.2, 0.62), cell: 1.84, gh: 1.6, fh: 1.05 });
    L.piccadilly = { b: scr, x: pc.lx1, z: pc.lz1, eros: { x: -91.2, z: -69.2 } };
    pack({ x0: pc.lx0, z0: pc.lz0, x1: pc.lx1, z1: pc.lz1 - 9.8 }, 'mixed', { depth: 5 }); strip(pc.lx0, pc.lz1 - 9.4, pc.lx1 - 9.8, pc.lz1, 'mixed', 's');
    city.crowds.push({ x: -91.6, z: -70.4, r: 1, n: 7, look: 'tourist', act: 'spect', face: { x: pc.lx1 - 3, z: pc.lz1 - 3 } }, { x: -94, z: -66.4, r: 0.8, n: 4, look: 'commuter' });
    name('Piccadilly Circus', 'Piccadilly Circus', -96, -86, -74, -64);
  }
  // Belgravia and Pimlico: white stucco terraces and red-brick mansion blocks; Victoria Tower Gardens, Millbank
  {
    for (const [i, j, k] of [[0, 3, 'stucco'], [0, 4, 'stucco'], [1, 4, 'mansion'], [0, 5, 'terrace'], [1, 5, 'stucco']]) fillBlock(blk(i, j), k, { depth: k === 'mansion' ? 6.5 : 5.4, courtyard: true });
    const b = blk(2, 4);
    grass(b.lx0, b.lz0, -56, b.lz0 + 6.5);
    for (let z = b.lz0 + 1; z < b.lz0 + 6; z += 2.4) city.addTree(-66.5, z, 1.2);
    M({ x: -62, z: 58.6, w: 11.4, d: 10, floors: 3, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.9, fh: 1.4 });           // Tate Britain
    M({ x: -61.6, z: 69.4, w: 8, d: 7.4, floors: 18, style: 'office', tint: GLASS(0.62), cell: 2, gh: 1.6, fh: 1.1 });            // Millbank Tower
    name('Tate Britain', 'Tate Britain', -68, -56, 53, 64); name('Millbank', 'Millbank', -68, -56, 46, 74);
    // across the river: Lambeth Palace's Tudor gatehouse and garden, then Lambeth's estates
    lot(-30, b.lz0, b.lx1, b.lz1);
    L.lambeth = M({ x: -26.2, z: 50, w: 6, d: 6, floors: 4, style: 'brick', tint: hsl(0.02, 0.45, 0.4), cell: 1.5, gh: 1.6 });
    M({ x: -19, z: 50, w: 8, d: 6, floors: 3, style: 'brick', tint: hsl(0.03, 0.4, 0.44), cell: 2 });
    grass(-30, 54, -14.1, 60); for (let i = 0; i < 8; i++) city.addTree(rand(-29, -15), rand(54.5, 59.5), 1.1);
    strip(-30, 61, -14.1, 67, 'flats', 's', { floors: 6 }); strip(-30, 68.2, -14.1, 73.9, 'flats', 's', { floors: 5 });
    name('Lambeth Palace', 'Lambeth Palace', -30, -14, 46, 60);
    const v = blk(2, 5);
    pack({ x0: v.lx0, z0: v.lz0, x1: -56, z1: v.lz1 }, 'terrace', { depth: 5.4 });
    // Vauxhall: newer flats by the river, an estate behind
    lot(-30, v.lz0, v.lx1, v.lz1);
    M({ x: -25.6, z: 88, w: 7, d: 7, floors: 16, style: 'office', tint: GLASS(0.6), cell: 2.3, gh: 1.6, fh: 1.05 });
    M({ x: -25.6, z: 99, w: 7, d: 8, floors: 12, style: 'concrete', tint: hsl(0.1, 0.06, 0.72), cell: 2.3, gh: 1.5, fh: 1.0 });
    strip(-20.8, v.lz0, v.lx1, v.lz1, 'flats', 'e', { floors: 7 });
    name('Vauxhall', 'Vauxhall', -30, -14, 80, 112); name('Pimlico', 'Pimlico', -112, -56, 44, 112); name('Belgravia', 'Belgravia', -112, -92, 8, 42);
  }

  // ================= THE SOUTH BANK =================
  {
    // the Eye on the east bank (its A-frame legs on the land, the wheel over the water), Jubilee Gardens, County Hall
    lot(-30, -12, -14.1, 3.9, '#a8a294');
    grass(-29.6, -11.6, -22.4, 3.4, '#628044');
    M({ x: -18, z: -4, w: 7.6, d: 14.6, floors: 6, style: 'concrete', tint: hsl(0.08, 0.2, 0.76), cell: 2.2, gh: 1.8, fh: 1.15, gable: true, roofTint: hsl(0.02, 0.35, 0.38) });   // County Hall
    L.eye = { x: -31.6, z: -3.2, r: 13.5 };
    city.crowds.push({ x: -26.4, z: 1.2, r: 1.3, n: 8, look: 'tourist', act: 'spect', face: { x: -31.6, z: -3.2 } }, { x: -24, z: -8.8, r: 0.8, n: 4, look: 'tourist' });
    city.wanderZones.push({ x0: -29.4, x1: -22.6, z0: -11.4, z1: 3.2 }, { x0: -29.4, x1: -22.6, z0: -11.4, z1: 3.2 });
    L.vendors.push({ x: -23, z: 2.6, kind: 'ice' }, { x: -28.8, z: -10.6, kind: 'flags' });
    name('The London Eye', 'the London Eye', -40, -22, -14, 4); name('County Hall', 'County Hall', -22, -14, -12, 4); name('Jubilee Gardens', 'Jubilee Gardens', -30, -22, -12, 4);
    // the Southbank Centre and the National Theatre (concrete), Tate Modern and its chimney, the Globe
    const b3 = blk(3, 2);
    lot(b3.lx0, -12, b3.lx1, b3.lz1, '#a49e90');
    M({ x: -1.4, z: -3.4, w: 8.4, d: 11, floors: 4, style: 'concrete', tint: hsl(0.1, 0.05, 0.7), cell: 2.1, gh: 1.8 });
    M({ x: 9, z: -4, w: 8, d: 10.4, floors: 5, style: 'concrete', tint: hsl(0.1, 0.04, 0.62), cell: 2.1, gh: 1.8, setbacks: [{ f: 3, n: 1 }] });
    M({ x: 17.6, z: -3.4, w: 6.6, d: 11, floors: 3, style: 'concrete', tint: hsl(0.1, 0.04, 0.66), cell: 2.2, gh: 1.8 });
    city.crowds.push({ x: 0, z: -10.6, r: 1, n: 5, look: 'tourist' }, { x: 8, z: -10.6, r: 0.6, n: 3, look: 'busker' }, { x: 16, z: -10.6, r: 1, n: 4, look: 'commuter' });
    city.wanderZones.push({ x0: -7, x1: 22, z0: -11.4, z1: -10 }, { x0: 29, x1: 52, z0: -11.4, z1: -10 }, { x0: 59, x1: 77, z0: -11.4, z1: -10 });
    L.vendors.push({ x: 4, z: -10.6, kind: 'books' }, { x: 13, z: -10.6, kind: 'hot dogs' });
    name('The South Bank', 'the South Bank', -14, 25, -12, 6);
    const b4 = blk(4, 2);
    lot(b4.lx0, -12, b4.lx1, b4.lz1);
    L.tate = M({ x: 40, z: -3, w: 18, d: 11, floors: 6, style: 'brick', tint: hsl(0.05, 0.3, 0.34), cell: 2.25, gh: 1.8, fh: 1.2 });
    L.chimney = M({ x: 40, z: -9.6, w: 2.6, d: 2.4, floors: 26, style: 'brick', tint: hsl(0.05, 0.3, 0.34), cell: 1.3, fh: 1.1 });
    city.crowds.push({ x: 40, z: -10.8, r: 1, n: 5, look: 'tourist' });
    name('Tate Modern', 'Tate Modern', 29, 51, -12, 6); name('The Millennium Bridge', 'the Millennium Bridge', 38, 42, -40, -11);
    const b5 = blk(5, 2);
    lot(b5.lx0, -12, b5.lx1, b5.lz1);
    M({ x: 66.6, z: -4.6, w: 13, d: 4.6, floors: 4, style: 'concrete', tint: hsl(0.09, 0.2, 0.68), cell: 1.63, gh: 1.8, fh: 1.4, gable: true, roofTint: hsl(0.58, 0.06, 0.4) });   // Southwark Cathedral
    M({ x: 61, z: -8.6, w: 2.6, d: 2.6, floors: 8, style: 'concrete', tint: hsl(0.09, 0.2, 0.66), cell: 1.3, gh: 1.8, fh: 1.3 });
    L.market = { x0: b5.lx0, x1: b5.lx1, z0: -1.4, z1: b5.lz1 };
    for (let x = b5.lx0 + 1; x < b5.lx1 - 1; x += 2.2) for (const z of [0, 2.4]) L.vendors.push({ x, z, kind: 'stall', still: true });
    city.crowds.push({ x: 64, z: 1.2, r: 1.6, n: 9, look: 'commuter' }, { x: 72, z: 1.2, r: 1.4, n: 7, look: 'tourist' });
    name('Southwark Cathedral', 'Southwark Cathedral', 59, 74, -8, -1); name('Borough Market', 'Borough Market', 59, 77, -1, 5);
    const b6 = blk(6, 2);
    lot(b6.lx0, -12, b6.lx1, b6.lz1);
    for (const [x, w] of [[87.4, 6.4], [95, 7.4]]) M({ x, z: -3, w, d: 11.6, floors: Math.round(rand(8, 10)), style: 'office', tint: GLASS(0.62), cell: 2.1, gh: 1.7, fh: 1.1 });
    L.belfast = { x: 93, z: -15.4 };
    name('HMS Belfast', 'HMS Belfast', 86, 100, -17, -14); name('More London', 'More London', 84, 101, -12, 4);
    const b7 = blk(7, 2);
    lot(b7.lx0, -12, b7.lx1, b7.lz1, '#a6a092'); L.cityHall = { x: 114, z: -5.4 };
    for (const [x, w] of [[123.6, 6], [129.6, 4.6]]) M({ x, z: -3, w, d: 11, floors: Math.round(rand(7, 9)), style: 'office', tint: GLASS(0.6), cell: 2.2, gh: 1.7, fh: 1.1 });
    name('City Hall', 'City Hall', 108, 120, -12, 2);
    // the river walks under the plane trees along both banks
    for (let x = -6; x < 134; x += 4.4) if (!onBridge(x, -40.4)) city.addTree(x, -40.6, 1.05);
    for (let x = -4; x < 134; x += 9) if (!onBridge(x, -39.8)) city.addProp('bench', x, -39.4, Math.PI);
    city.wanderZones.push({ x0: -6, x1: 22, z0: -41.4, z1: -39 }, { x0: 29, x1: 52, z0: -41.4, z1: -39 }, { x0: 84, x1: 101, z0: -41.4, z1: -39 });
    for (let x = -12; x < 134; x += 4.4) if (!onBridge(x, -11)) city.addTree(x, -10.9, 1.05);
  }
  {
    // Waterloo station's sheds, the Shard over London Bridge station, Guy's; Southwark's streets
    const w = blk(3, 3);
    lot(w.lx0, w.lz0, w.lx1, w.lz1, '#8b877d');
    L.waterloo = M({ x: 7.5, z: 22.5, w: 26, d: 18, floors: 2, style: 'concrete', tint: hsl(0.1, 0.12, 0.72), cell: 2.6, gh: 2.4, fh: 1.4 });
    strip(w.lx0, w.lz1 - 5.4, w.lx1, w.lz1, 'mixed', 's'); strip(w.lx0, w.lz0, w.lx0 + 5, w.lz1 - 5.6, 'mixed', 'w');
    for (let k = 0; k < 4; k++) city.crowds.push({ x: rand(-4, 18), z: 12.2, r: 0.9, n: 4, look: 'commuter' });
    name('Waterloo station', 'Waterloo station', -6, 21, 12, 38);
    fillBlock(blk(4, 3), 'mixed', { depth: 5.6 }); fillBlock(blk(5, 3), 'mixed', { depth: 5.6 });
    const s = blk(6, 3);
    lot(s.lx0, s.lz0, s.lx1, s.lz1, '#99948a');
    const sb = []; for (let f = 1; f < 40; f++) sb.push({ f, n: Math.round((f / 40) * 2.6) });
    L.shard = M({ x: 91, z: 19, w: 8.4, d: 8.4, floors: 40, style: 'office', tint: hsl(0.58, 0.12, 0.72), cell: 1.2, gh: 1.6, fh: 1.18, setbacks: sb });
    M({ x: 92.5, z: 32.4, w: 16.6, d: 8.6, floors: 2, style: 'concrete', tint: hsl(0.1, 0.06, 0.7), cell: 2.8, gh: 2.2 });            // London Bridge station
    M({ x: 98.2, z: 19.6, w: 4.4, d: 6, floors: 16, style: 'concrete', tint: hsl(0.08, 0.08, 0.64), cell: 2.2 });                     // Guy's tower
    strip(s.lx0, s.lz0, s.lx0 + 5.2, s.lz1 - 9.4, 'mixed', 'w');
    name('The Shard', 'the Shard', 86, 96, 14, 24); name('London Bridge station', 'London Bridge station', 84, 101, 28, 38);
    pack({ x0: blk(7, 3).lx0, z0: blk(7, 3).lz0, x1: blk(7, 3).lx1, z1: blk(7, 3).lz1 }, 'warehouse', { depth: 7 });
    name('Shad Thames', 'Shad Thames', 108, 134, 12, 38);
  }

  // ================= THE STRAND, COVENT GARDEN, SOHO, THE CITY (north bank) =================
  {
    fillBlock(blk(2, 0), 'mixed', { depth: 5.4 }); name('Covent Garden', 'Covent Garden', -68, -14, -92, -72);
    const cx = blk(2, 1);
    M({ x: -62, z: -57, w: 11, d: 13.6, floors: 5, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.8, fh: 1.2 });   // Charing Cross
    pack({ x0: -56, z0: cx.lz0, x1: cx.lx1, z1: cx.lz1 }, 'mixed', { depth: 5 });
    name('Charing Cross', 'Charing Cross', -68, -56, -64, -50); name('The Strand', 'the Strand', -56, 25, -66, -64);
    const sh = blk(3, 1);
    lot(sh.lx0, sh.lz0, sh.lx1, sh.lz1);
    L.somerset = M({ x: (sh.lx0 + sh.lx1) / 2, z: -54.5, w: sh.lx1 - sh.lx0 - 0.4, d: 9.2, floors: 4, style: 'concrete', tint: PORTLAND, cell: 2.3, gh: 1.8, fh: 1.25 });
    strip(sh.lx0, sh.lz0, sh.lx1, sh.lz0 + 4.4, 'mixed', 'n');
    name('Somerset House', 'Somerset House', -6, 21, -60, -49);
    fillBlock(blk(3, 0), 'mixed', { depth: 5.4 }); name('Holborn', 'Holborn', -6, 21, -92, -72);
    // St Paul's on Ludgate Hill: west towers, the nave, the dome over the crossing, lined up on the Millennium Bridge
    const sp = blk(4, 0);
    lot(sp.lx0, sp.lz0, sp.lx1, sp.lz1, '#b0aa9c');
    const ps = hsl(0.11, 0.12, 0.8);
    const nave = M({ x: 40, z: -80.4, w: 17, d: 5.6, floors: 5, style: 'concrete', tint: ps, cell: 1.9, gh: 1.8, fh: 1.4 });
    const tr = [M({ x: 40, z: -85.6, w: 5.4, d: 4.6, floors: 5, style: 'concrete', tint: ps, cell: 1.8, gh: 1.8, fh: 1.4 }), M({ x: 40, z: -75.2, w: 5.4, d: 4.6, floors: 5, style: 'concrete', tint: ps, cell: 1.8, gh: 1.8, fh: 1.4 })];
    const wt = [M({ x: 30.6, z: -83, w: 2.4, d: 2.4, floors: 10, style: 'concrete', tint: ps, cell: 1.2, gh: 1.8, fh: 1.3 }), M({ x: 30.6, z: -77.8, w: 2.4, d: 2.4, floors: 10, style: 'concrete', tint: ps, cell: 1.2, gh: 1.8, fh: 1.3 })];
    L.stpauls = { nave, tr, wt, dome: { x: 40, z: -80.4 } };
    strip(sp.lx0, sp.lz0, sp.lx1, sp.lz0 + 3.6, 'mixed', 'n', { floors: 5 });
    city.crowds.push({ x: 29.6, z: -73.4, r: 1, n: 6, look: 'tourist', act: 'spect', face: { x: 40, z: -80.4 } });
    for (let x = 32; x < 50; x += 3.6) city.addTree(x, -73.2, 1);
    name("St Paul's Cathedral", "St Paul's Cathedral", 29, 51, -92, -72);
    fillBlock(blk(4, 1), 'city', { depth: 7 }); name('Fleet Street', 'Fleet Street', 25, 55, -68, -46);
  }
  // the City of London: the Bank of England and a tight cluster of towers round the Gherkin
  {
    const bk = blk(5, 0);
    lot(bk.lx0, bk.lz0, bk.lx1, bk.lz1);
    M({ x: 67.5, z: -82, w: 16.8, d: 19.8, floors: 3, style: 'concrete', tint: PORTLAND, cell: 2.8, gh: 2 });
    name('The Bank of England', 'the Bank of England', 57, 78, -94, -70);
    const T = (x, z, w, d, floors, o = {}) => M({ x, z, w, d, floors, style: 'office', tint: o.tint || GLASS(rand(0.5, 0.72)), cell: o.cell || 2.1, gh: 1.8, fh: 1.2, ...o });
    const c5 = blk(5, 1);
    lot(c5.lx0, c5.lz0, c5.lx1, c5.lz1, '#99948a');
    const wk = [T(69, -55.6, 7, 6.4, 8), T(69, -55.6, 8.6, 7.6, 8, { base: 1.8 + 7 * 1.2 }), T(69, -55.6, 10, 8.6, 8, { base: 1.8 + 15 * 1.2 })];
    rests(wk[1], [wk[0]]); rests(wk[2], [wk[1]]);
    T(61.4, -61.2, 4, 4.6, 14); T(61.4, -52.2, 4, 4.6, 12, { tint: STONE() }); T(75.6, -61.4, 3.8, 4.4, 16); T(75.6, -51.6, 3.8, 5, 11, { tint: STONE() });
    const c6 = blk(6, 0), c61 = blk(6, 1), c7 = blk(7, 0);
    for (const q of [c6, c61, c7]) lot(q.lx0, q.lz0, q.lx1, q.lz1, '#99948a');
    const bishops = T(89.6, -85.6, 9, 9.4, 34, { tint: GLASS(0.66), cell: 2.25 });
    const t42 = T(97.6, -86.6, 5, 5.4, 25, { tint: hsl(0.08, 0.06, 0.4), cell: 1.8 });
    const heron = T(97.6, -77.4, 5, 6, 26, { tint: GLASS(0.58), cell: 2 });
    T(88.4, -76.2, 7, 5.4, 15, { tint: STONE() });
    const cheese = T(90, -58.6, 9.4, 8.4, 30, { tint: GLASS(0.64), cell: 2.35, setbacks: [{ f: 10, n: 1 }, { f: 22, n: 2 }] });
    const lloyds = T(98.4, -60.2, 4.6, 6.6, 12, { tint: hsl(0.58, 0.06, 0.72), cell: 2.2 });
    T(98.4, -51.4, 4.4, 4.6, 18); T(87.2, -50.6, 6.4, 3.8, 10, { tint: STONE() });
    const gherkin = M({ x: 116.8, z: -81, w: 8, d: 8, floors: 26, style: 'office', tint: hsl(0.5, 0.15, 0.4), cell: 1.6, gh: 1.8, fh: 1.2, setbacks: [{ f: 19, n: 1 }, { f: 23, n: 2 }] });
    const scalpel = T(127.4, -86.4, 5.6, 5, 25, { tint: GLASS(0.7) });
    T(127, -76.2, 6, 6.6, 20); T(116.8, -89.6, 10, 3.6, 9, { tint: STONE() }); T(110.8, -74.6, 3.2, 4, 12, { tint: STONE() }); T(124.4, -74, 3.2, 3.2, 14, { tint: GLASS(0.55) });
    L.city = { gherkin, bishops, cheese, t42, heron, lloyds, scalpel, wk };
    for (let k = 0; k < 8; k++) city.crowds.push({ x: rand(60, 132), z: rand(-91, -50), r: 0.7, n: 3, look: 'commuter' });
    name('The Gherkin', 'the Gherkin', 112, 121, -86, -76); name('The Walkie-Talkie', 'the Walkie-Talkie', 63, 75, -61, -50); name('The Cheesegrater', 'the Cheesegrater', 85, 95, -64, -53);
    name('22 Bishopsgate', '22 Bishopsgate', 84, 95, -91, -80); name("Lloyd's of London", "Lloyd's of London", 95, 101, -64, -56); name('The City', 'the City of London', 55, 135, -96, -46);
  }
  // the Tower of London on Tower Hill by Tower Bridge
  {
    const t = blk(7, 1);
    lot(t.lx0, t.lz0, t.lx1, -38.6, '#9a9b7a');
    g.rect(t.lx0 + 0.3, t.lz0 + 0.3, t.lx1 - 0.3, -39.2, '#6b7d4a');           // the dry moat, grassed
    g.rect(t.lx0 + 2, t.lz0 + 2, t.lx1 - 2, -41.6, '#a49a86');
    const stone = hsl(0.1, 0.18, 0.76);
    const white = M({ x: 120, z: -53.6, w: 6.6, d: 7, floors: 5, style: 'concrete', tint: hsl(0.1, 0.12, 0.88), cell: 1.65, gh: 1.8, fh: 1.4 });
    const x0 = t.lx0 + 2.2, x1 = t.lx1 - 2.2, z0 = t.lz0 + 2.2, z1 = -42;
    const W = (x, z, w, d) => M({ x, z, w, d, floors: 2, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 });
    const walls = [W((x0 + x1) / 2, z0, x1 - x0, 1.2), W((x0 + x1) / 2, z1, x1 - x0, 1.2), W(x0, (z0 + z1) / 2, 1.2, z1 - z0), W(x1, (z0 + z1) / 2, 1.2, z1 - z0)];
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) walls.push(M({ x, z, w: 2.4, d: 2.4, floors: 3, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 }));
    L.tower = { white, walls };
    city.crowds.push({ x: 115, z: -46, r: 0.5, n: 2, look: 'beefeater' }, { x: 124.6, z: -45.6, r: 0.05, n: 1, look: 'guard', act: 'attention', stay: true, face: { x: 124.6, z: -40 }, tag: 'guard' }, { x: 112, z: -40.6, r: 1.2, n: 6, look: 'tourist', act: 'spect', face: { x: 120, z: -53.6 } });
    city.wanderZones.push({ x0: 112, x1: 128, z0: -48, z1: -44 });
    L.vendors.push({ x: 128, z: -40.6, kind: 'flags' });
    name('The Tower of London', 'the Tower of London', 108, 134, -66, -38); name('Tower Bridge', 'Tower Bridge', 99, 111, -46, -4);
  }
  // Tower Bridge's towers: each on its pier, the road through its arch (two legs and the tower above them),
  // and the abutment towers at each bank. All of it falls when shot down.
  {
    const st = hsl(0.11, 0.24, 0.76), x = 105;
    const tower = (z, w, d, legH, floors, cell) => {
      const legW = (w - 4.8) / 2;
      const legs = [M({ x: x - 2.4 - legW / 2, z, w: legW, d, floors: 2, style: 'concrete', tint: st, cell: Math.min(cell, legW), gh: legH / 2, fh: legH / 2 }), M({ x: x + 2.4 + legW / 2, z, w: legW, d, floors: 2, style: 'concrete', tint: st, cell: Math.min(cell, legW), gh: legH / 2, fh: legH / 2 })];
      const top = M({ x, z, w, d, floors, style: 'gothic', tint: st, cell, gh: 1.3, fh: 1.3, base: legH });
      rests(top, legs);
      return { legs, top };
    };
    L.tb = { n: tower(-33, 8, 4.6, 3.2, 10, 1.6), s: tower(-17, 8, 4.6, 3.2, 10, 1.6), an: tower(-42.4, 7, 3.4, 2.6, 3, 1.4), as: tower(-7.6, 7, 3.4, 2.6, 3, 1.4) };
  }

  // ================= SOUTH LONDON: ELEPHANT & CASTLE, WALWORTH, PECKHAM, BRIXTON (the ends) =================
  {
    // council estates: tower blocks and long brick slabs round small greens, garages, the odd chicken shop on the corner
    const estate = (b, o = {}) => {
      const R = { x0: b.lx0, z0: b.lz0, x1: b.lx1, z1: b.lz1 };
      lot(R.x0, R.z0, R.x1, R.z1, '#7a766c');
      const out = [];
      // shops along the main road side
      out.push(...strip(R.x0, R.z0, R.x1, R.z0 + 4.6, 'mixed', 'n', { floors: 3, front: [3.2, 4.6] }));
      // slabs: long walk-up blocks of brick or concrete
      const slabs = o.slabs ?? 2;
      for (let k = 0; k < slabs; k++) {
        const z = R.z0 + 6.4 + k * ((R.z1 - R.z0 - 8) / Math.max(1, slabs)) + 2.6;
        out.push(...strip(R.x0 + 1, z - 2.6, R.x1 - (o.tower ? 11 : 1), z + 2.6, 'flats', 's', { floors: Math.round(rand(4, 6)), front: [12, 18] }));
      }
      // the tower block(s): 14 to 21 storeys, a little apart
      if (o.tower) for (const [tx, tz] of o.tower) out.push(M({ x: tx, z: tz, w: 6.6, d: 6.6, floors: Math.round(rand(14, 21)), style: 'concrete', tint: hsl(0.1, 0.05, rand(0.6, 0.72)), cell: 2.2, gh: 1.4, fh: 1.0, storefront: false }));
      grass(R.x0 + 1, R.z1 - 3.4, R.x1 - 1, R.z1 - 0.4, '#5f7444');
      for (let x = R.x0 + 2; x < R.x1 - 2; x += 5) city.addTree(x, R.z1 - 1.9, 0.9);
      L.graffiti.push(...out.filter((q) => q && q.kind === 'flats').slice(0, 3));
      return out;
    };
    const e1 = blk(3, 4), e2 = blk(4, 4), e3 = blk(5, 4), e4 = blk(6, 4), e5 = blk(7, 4);
    estate(e1, { tower: [[e1.lx1 - 5, e1.lz0 + 12], [e1.lx1 - 5, e1.lz1 - 9]], slabs: 2 });
    estate(e2, { tower: [[e2.lx1 - 5.2, e2.lz0 + 13]], slabs: 3 });
    estate(e3, { tower: [[e3.lx1 - 5, e3.lz0 + 14]], slabs: 2 });
    fillBlock(e4, 'terrace', { depth: 4.8 }); fillBlock(e5, 'terrace', { depth: 4.8 });
    name('Elephant & Castle', 'Elephant & Castle', -10, 25, 42, 78); name('Walworth', 'Walworth', 25, 55, 42, 78); name('Peckham', 'Peckham', 55, 135, 42, 114); name('Bermondsey', 'Bermondsey', 80, 135, 8, 78);
    // Kennington: the Met's police station; Brixton: the high street, the market arcade, the Tube
    const kn = blk(3, 5);
    policeHQ(ctx, { ...kn, lz0: kn.lz0, lz1: kn.lz1 });
    name('Kennington Police Station', 'Kennington police station', -6, 21, 82, 110);
    const bx = blk(4, 5);
    lot(bx.lx0, bx.lz0, bx.lx1, bx.lz1);
    strip(bx.lx0, bx.lz0, bx.lx1, bx.lz0 + 5.4, 'mixed', 'n', { floors: 3, front: [3.2, 4.6] });
    strip(bx.lx0, bx.lz0 + 5.4, bx.lx0 + 5.4, bx.lz1, 'mixed', 'w', { floors: 3, front: [3.2, 4.6] });
    strip(bx.lx1 - 5.4, bx.lz0 + 5.4, bx.lx1, bx.lz1, 'mixed', 'e', { floors: 4, front: [3.2, 4.6] });
    strip(bx.lx0 + 5.4, bx.lz1 - 5.4, bx.lx1 - 5.4, bx.lz1, 'terrace', 's');
    // the market under its canopies
    L.brixtonMarket = { x0: bx.lx0 + 6.4, x1: bx.lx1 - 6.4, z0: bx.lz0 + 6.4, z1: bx.lz1 - 6.4 };
    for (let x = bx.lx0 + 7.4; x < bx.lx1 - 7; x += 2.4) for (let z = bx.lz0 + 8; z < bx.lz1 - 7; z += 3.4) L.vendors.push({ x, z, kind: 'stall', still: true });
    city.wanderZones.push({ x0: bx.lx0 + 6.6, x1: bx.lx1 - 6.6, z0: bx.lz0 + 6.6, z1: bx.lz1 - 6.6 }, { x0: bx.lx0 + 6.6, x1: bx.lx1 - 6.6, z0: bx.lz0 + 6.6, z1: bx.lz1 - 6.6 });
    name('Brixton', 'Brixton', 25, 55, 78, 114); name('Brixton Market', 'Brixton Market', 31, 49, 84, 108);
    estate(blk(5, 5), { tower: [[blk(5, 5).lx1 - 5, blk(5, 5).lz0 + 13]], slabs: 2 });
    fillBlock(blk(6, 5), 'terrace', { depth: 4.8 }); fillBlock(blk(7, 5), 'terrace', { depth: 4.8 });
    // roadmen: crews in black on the estates and street corners, a speaker blasting drill with most of them
    const ends = [[e1, 0.3, 0.55], [e1, 0.7, 0.95], [e2, 0.25, 0.4], [e2, 0.6, 0.9], [e3, 0.3, 0.5], [e3, 0.75, 0.92], [bx, 0.1, 0.05], [bx, 0.9, 0.95], [blk(5, 5), 0.4, 0.6], [blk(5, 5), 0.2, 0.95], [e4, 0.5, 0.02], [blk(6, 5), 0.5, 0.97]];
    for (const [b, u, v] of ends) {
      const x = b.x0 + (b.x1 - b.x0) * u, z = b.z0 + (b.z1 - b.z0) * v;
      const s = { x: v < 0.1 ? x : x, z: v < 0.1 ? b.z0 + 0.8 : v > 0.93 ? b.z1 - 0.8 : z, r: 0.9, n: Math.round(rand(4, 7)), look: 'roadman', tag: 'roadman' };
      city.crowds.push(s);
      if (Math.random() < 0.75) { s.speaker = true; L.speakers.push({ x: s.x, z: s.z, spot: s }); }
    }
    city.endsZone = { x0: -12, x1: 137, z0: 40, z1: 116 };
  }

  // ---- the Tube: entrances with the roundel at the real stations (and down in south London)
  for (const [x, z, n, f] of [[-74.6, -6, 'WESTMINSTER', 0], [-55, -64.6, 'CHARING CROSS', 1], [-7.6, 12.6, 'WATERLOO', 0], [-55, -40.4, 'EMBANKMENT', 1], [27.6, -70.6, "ST PAUL'S", 0], [57.6, -94, 'BANK', 0], [82.6, 12.6, 'LONDON BRIDGE', 0], [107.6, -64.4, 'TOWER HILL', 0],
    [-107.6, -70.6, 'GREEN PARK', 0], [-93.4, -70.4, 'PICCADILLY CIRCUS', 0], [-12.6, 44.4, 'ELEPHANT & CASTLE', 0], [27.6, 80.6, 'BRIXTON', 0], [-12.4, 80.4, 'KENNINGTON', 0], [-69.4, 44.4, 'PIMLICO', 0], [-69.4, 80.4, 'VAUXHALL', 0], [57.6, 80.6, 'PECKHAM RYE', 0]]) {
    L.tube.push({ x, z, n, f }); city.crowds.push({ x: x + (x > 0 ? 1.2 : -1.2) * 0.6, z: z + 1.4, r: 0.8, n: 4, look: 'commuter' });
  }
  // phone boxes and post boxes at most corners, a Union flag on a lot of them
  for (const n of city.nodes) for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    if (Math.random() > 0.32) continue;
    const x = n.x + sx * 3.2, z = n.z + sz * 3.2;
    if (wet(x, z) || inRiver(x, z) || Math.abs(x) > 140 || z < -99 || z > 117) continue;
    (Math.random() < 0.7 ? L.phones : L.posts).push({ x, z, r: sz > 0 ? 0 : Math.PI });
  }
  // bunting of Union flags across the shopping streets
  for (const [x0, z, x1] of [[-68, -68, -14], [-6, -68, 21], [-108, -68, -94], [-68, -96, -14], [29, 78, 51], [-6, 78, 21], [59, -46, 76]]) L.bunting.push({ x0, x1, z });
  for (const [x, z0, z1] of [[-72, -44, 6], [-10, -92, -50], [25, 46, 110]]) L.bunting.push({ x, z0, z1 });
  // ---- life on the streets: Met officers on foot, horses, buskers, people at bus stops
  for (const [x, z] of [[-74.6, -18], [-74.6, 2], [-12.4, -50], [22.4, -66], [102.6, -44], [27.6, 112], [-12.6, 104], [52.4, 80.6]]) city.crowds.push({ x, z, r: 0.5, n: 2, look: 'metpolice', tag: 'met' });
  for (const [x, z] of [[-75.2, -8], [101.4, -44]]) city.stationed.push({ x, z, rot: Math.PI, quiet: true });
  L.horses.push({ route: [[-72, -43], [-72, 5]], n: 2 }, { route: [[-108, -46], [-75, -46]], n: 2 }, { route: [[28, 78], [77, 78]], n: 2 }, { route: [[-54, -40.4], [-16, -40.4]], n: 1, path: true }, { route: [[-10, 45], [-10, 111]], n: 1 });
  // e-scooters parked all over the pavements
  for (let k = 0; k < 150; k++) {
    const b = pick(city.blocks), side = Math.floor(rand(0, 4)), t = rand(0.1, 0.9);
    const x = side < 2 ? b.x0 + (b.x1 - b.x0) * t : side === 2 ? b.x0 + 0.5 : b.x1 - 0.5, z = side >= 2 ? b.z0 + (b.z1 - b.z0) * t : side === 0 ? b.z0 + 0.5 : b.z1 - 0.5;
    if (!wet(x, z) && !inRiver(x, z)) L.scooters.push({ x, z, r: rand(0, 6.28), lie: Math.random() < 0.25 });
  }

  // keep the river clear: no lamps, trees, props or people in the water (the bridges keep theirs)
  city.lampsAlongBlock && city.blocks.forEach((b) => city.lampsAlongBlock(b, 7));
  city.lamps = city.lamps.filter((l) => !wet(l.x, l.z));
  city.trees = city.trees.filter((t) => !inRiver(t.x, t.z));
  city.props = city.props.filter((p) => !inRiver(p.x, p.z));
  city.crowds = city.crowds.filter((c) => !wet(c.x, c.z));
  city.parked = city.parked.filter((p) => !inRiver(p.x, p.z));
  // pedestrians never walk on the water: drop sidewalk links that would cross it (the bridges keep theirs)
  const crosses = (a, b) => { for (let t = 0.1; t < 0.95; t += 0.1) if (wet(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true; return false; };
  for (const n of city.pedNodes) n.edges = n.edges.filter((e) => !crosses(n, city.pedNodes[e.to]));
  city.noPeds = [{ x0: -56, x1: -30, z0: -12, z1: 4.6 }, { x0: -56, x1: -30, z0: 11.4, z1: 38.6 }, { x0: -56, x1: -30, z0: 45.4, z1: 220 }];
  let x = -30;
  for (const bx of [-10, 25, 55, 80, 105]) { city.noPeds.push({ x0: x, x1: bx - 3.4, z0: -38, z1: -12 }); x = bx + 3.4; }
  city.noPeds.push({ x0: x, x1: 220, z0: -38, z1: -12 });
  city.wanderZones = city.wanderZones.filter((w) => !wet((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2));
  // the river: a hole in the street level (the water and the walls are below it, in the London class)
  g.x.save(); g.x.globalCompositeOperation = 'destination-out'; g.x.fillStyle = '#000'; g.x.beginPath();
  RIVER.L.forEach((v, i) => (i ? g.x.lineTo(g.px(v.x), g.px(v.z)) : g.x.moveTo(g.px(v.x), g.px(v.z))));
  for (let i = RIVER.R.length - 1; i >= 0; i--) g.x.lineTo(g.px(RIVER.R[i].x), g.px(RIVER.R[i].z));
  g.x.closePath(); g.x.fill(); g.x.restore();
  city.hotspot = { x: -40, z: -10, r: 80 };
  city.river = { wet, inRiver, WL };
  return { ...ctx, agents: { cars: 140, peds: 980, wanderFrac: 0.14 }, fog: 0xbcc2c6, start: { x: -40, z: 0 }, zMin: -104, zMax: 124, xMin: -150, maxD: 230, yaw: 0.35, ownBackdrop: true };
}

// ====================================================================================================
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const DRILL_SET = ['assets/drill-welcome-to-brixton.mp4', 'assets/drill-david-blaine.mp4', 'assets/drill-lotteryy.mp4', 'assets/drill-leon.mp4', 'assets/drill-ls.mp4', 'assets/drill-link-up.mp4'];
// an extruded outline, built flat in (u, y) and stood up: along x (extruded across z) or along z (extruded across x)
function standUp(shape, depth, axis, at) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 18 });
  if (axis === 'x') g.translate(0, 0, at - depth / 2); else { g.rotateY(-Math.PI / 2); g.translate(at + depth / 2, 0, 0); }
  return g;
}

export class London {
  constructor(scene, city) {
    this.scene = scene; this.city = city; const L = (this.L = city.london);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.04 });
    this.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.65 });
    this.gilt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.3 });
    this.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.8, envMapIntensity: 1.5, side: THREE.DoubleSide });
    this.glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.signs = []; this.glowMats = [];
    // the street level has a hole where the river is: the ground's alpha cuts it out
    if (G.groundMat) { G.groundMat.alphaTest = 0.5; G.groundMat.needsUpdate = true; }
    this.river(); this.bridges();
    this.parliament(L.parliament); this.abbey(L.abbey); this.palace(L.palace); this.horseGuards(L.horseGuards); this.trafalgar(L.trafalgar, L.gallery); this.piccadilly(L.piccadilly);
    this.eye(L.eye); this.needle(L.needle); this.scotlandYard(L.nsy); this.stpauls(L.stpauls); this.cityTowers(L.city); this.gherkin(L.city.gherkin); this.shard(L.shard);
    this.towerOfLondon(L.tower); this.towerBridge(L.tb); this.cityHall(L.cityHall); this.belfast(L.belfast); this.downing(L.downing); this.tate(L.chimney);
    this.street(L); this.flags(L); this.chimneys(L.chimneys); this.graffiti(L.graffiti);
    this.boats(); this.vehiclesInit(); this.horsesInit(L.horses); this.wheelsInit(); this.world(scene);
    this.restsT = 0; this.marchT = rand(40, 70); this.bongT = 0;
  }
  add(geos, mat = this.mat, shadow = true) { return merged(geos, mat, this.scene, shadow); }
  sign(w, h, draw, x, y, z, ry = 0, glow = 0.5, ds = false) {
    const tex = canvasTex(Math.max(16, Math.round(w * 64)), Math.max(16, Math.round(h * 64)), draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, transparent: true, alphaTest: 0.05, roughness: 0.5, side: ds ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); this.signs.push(m.material); return m;
  }
  // dressing that breaks away with the building: grouped by storey, each storey's pieces hung on a cell of that storey
  deck(b, geos, mat = this.mat) {
    const byF = new Map();
    for (const g of geos) {
      g.computeBoundingBox(); const c = g.boundingBox.getCenter(_v);
      let best = null, bd = 1e9;
      for (const cell of b.cells) { const d = Math.abs(cell.y - c.y) * 3 + Math.hypot(cell.x - c.x, cell.z - c.z) * 0.2; if (d < bd) { bd = d; best = cell; } }
      if (!byF.has(best.f)) byF.set(best.f, []);
      byF.get(best.f).push(g);
    }
    const out = [];
    for (const [f, list] of byF) {
      const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
      m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
      let best = null, bd = 1e9; for (const cell of b.cells) if (cell.f === f) { const d = Math.hypot(cell.x - c.x, cell.z - c.z); if (d < bd) { bd = d; best = cell; } }
      (best.props ||= []).push({ obj: [m], x: best.x, y: best.y, z: best.z }); out.push(m);
    }
    return out;
  }

  // ---------- the Thames: muddy olive water with the sky in it, flowing; granite walls down to it ----------
  river() {
    const { L, R } = RIVER, n = L.length, pos = [], uv = [], idx = [];
    let along = 0;
    for (let i = 0; i < n; i++) {
      if (i) along += L[i].distanceTo(L[i - 1]) * 0.5 + R[i].distanceTo(R[i - 1]) * 0.5;
      pos.push(L[i].x, WL, L[i].z, R[i].x, WL, R[i].z); uv.push(along, 0, along, 1);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    geo.computeVertexNormals();
    const up = geo.attributes.normal; for (let i = 0; i < up.count; i++) up.setXYZ(i, 0, 1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.0, envMapIntensity: 0.75 });
    this.boatU = { value: Array.from({ length: 14 }, () => new THREE.Vector4()) };
    const timeU = (this.waterT = { value: 0 });
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = timeU; s.uniforms.uBoats = this.boatU;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec2 vR;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vR = uv;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
          uniform float uTime; uniform vec4 uBoats[14]; varying vec3 vW; varying vec2 vR; float wFoam;
          float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
          // boat wakes: a V of ripples spreading behind each boat, a bow wave in front; returns the slope, foam in wFoam
          vec2 wakes(vec2 q) {
            vec2 g = vec2(0.0); wFoam = 0.0;
            for (int i = 0; i < 14; i++) {
              vec4 b = uBoats[i]; if (b.z == 0.0 && b.w == 0.0) continue;
              vec2 rel = q - b.xy; float d = length(rel); if (d > 26.0) continue;
              vec2 dir = normalize(b.zw); float sp = length(b.zw);
              float al = dot(rel, dir), sd = dot(rel, vec2(-dir.y, dir.x));
              float behind = -al;
              float cone = behind > -1.5 ? smoothstep(behind * 0.36 + 1.2, behind * 0.3, abs(sd)) : 0.0;
              float fade = exp(-max(behind, 0.0) * 0.12) * smoothstep(-2.0, 0.5, behind) * clamp(sp / 3.0, 0.3, 1.2);
              float ph = d * 5.5 - uTime * 7.0;
              g += normalize(rel + 0.001) * cos(ph) * cone * fade * 0.5;
              // the churned water right behind the stern and along the V's edges
              float edgeV = smoothstep(0.7, 0.0, abs(abs(sd) - behind * 0.33)) * smoothstep(0.0, 1.0, behind);
              wFoam += (smoothstep(2.5, 0.0, abs(sd)) * smoothstep(9.0, 0.5, behind) * smoothstep(-0.5, 0.5, behind) * 0.95 + edgeV * 0.45) * exp(-max(behind, 0.0) * 0.18) * clamp(sp / 3.0, 0.3, 1.0) * (0.6 + 0.4 * n2(q * 3.0 + uTime));
              // the bow pushing its own little wave out ahead
              g += normalize(rel + 0.001) * smoothstep(3.0, 1.0, d) * step(0.0, al) * sin(d * 7.0 - uTime * 6.0) * 0.25;
            }
            wFoam = clamp(wFoam, 0.0, 0.75);
            return g;
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 wk = wakes(vW.xz);
          // the tide runs downstream: silt clouds and slicks drift along the river
          vec2 fl = vec2(vR.x * 0.09 - uTime * 0.05, vR.y * 2.4);
          float silt = n2(fl * 0.9) * 0.7 + n2(fl * 3.1 + 3.1) * 0.3;
          float slick = smoothstep(0.62, 0.8, n2(vec2(vR.x * 0.04 - uTime * 0.03, vR.y * 6.0)));
          vec3 mud = mix(vec3(0.075, 0.09, 0.075), vec3(0.095, 0.108, 0.085), silt);
          mud = mix(mud, vec3(0.055, 0.075, 0.07), smoothstep(0.35, 0.0, abs(vR.y - 0.5)) * 0.45);       // deeper in the channel
          float edge = smoothstep(0.06, 0.0, min(vR.y, 1.0 - vR.y));                                     // in the shade of the wall
          diffuseColor.rgb = mix(mud, mud * 0.55, edge) * (1.0 - slick * 0.12);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.78, 0.76), wFoam);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(0.18, 0.34, silt) - slick * 0.08 + wFoam * 0.5;`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          vec2 q = vW.xz;
          // small ripples carried downstream by the current (along the river), plus the boats' wakes
          vec2 cur = vec2(vR.x * 1.4 - uTime * 0.9, vR.y * 26.0);
          vec2 wv0 = (vec2(n2(cur * 1.3), n2(cur * 1.3 + 5.0)) - 0.5) * 0.18 + (vec2(n2(cur * 3.7 + 2.0), n2(cur * 3.7 + 9.0)) - 0.5) * 0.12;
          vec2 wv = wv0 + wk * 0.7 + (vec2(n2(q * 1.7 + vec2(uTime * 0.6, uTime * 0.2)), n2(q * 1.7 + vec2(-uTime * 0.25, uTime * 0.55) + 7.0)) - 0.5) * 0.22
                  + (vec2(n2(q * 4.3 + uTime * 0.9), n2(q * 4.3 - uTime * 0.8 + 3.0)) - 0.5) * 0.12
                  + (vec2(n2(q * 0.5 + uTime * 0.12), n2(q * 0.5 - uTime * 0.1 + 9.0)) - 0.5) * 0.1;
          normal = normalize(normal + (viewMatrix * vec4(wv.x, 0., wv.y, 0.)).xyz);`);
    };
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; this.scene.add(m); this.water = m;
    // the bed (seen through nothing, but it closes the hole under the walls' feet)
    const bed = new THREE.Mesh(geo.clone().translate(0, BED - WL, 0), new THREE.MeshBasicMaterial({ color: 0x1a1a14 })); this.scene.add(bed);
    // the embankment walls: granite above the water, a dark wet band at the tide line, the coping stone, the parapet
    const wall = (B, flip) => {
      const P = [], C = [], I = [], rows = [[0.12, 0x8f8a7e], [-0.05, 0x9c978a], [WL + 1.1, 0x86817a], [WL + 0.5, 0x3d3c2e], [WL + 0.05, 0x2a2a20], [BED, 0x1c1c16]];
      const col = new THREE.Color();
      for (let i = 0; i < B.length; i++) for (const [y, c] of rows) { P.push(B[i].x, y, B[i].z); col.set(c); C.push(col.r, col.g, col.b); }
      const k = rows.length;
      for (let i = 0; i + 1 < B.length; i++) for (let r = 0; r + 1 < k; r++) { const a = i * k + r, b = a + k; if (flip) I.push(a, a + 1, b, b, a + 1, b + 1); else I.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals();
      const w = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide })); w.receiveShadow = true; this.scene.add(w);
    };
    wall(L, false); wall(R, true);
    // parapet and lamp standards along the banks inside the map (gaps where the bridges land)
    const Pp = [], lamps = [];
    for (const [B, sgn] of [[L, 1], [R, -1]]) for (let i = 0; i + 1 < B.length; i++) {
      const a = B[i], b = B[i + 1], mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (Math.max(Math.abs(mx), Math.abs(mz)) > 205) continue;
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); if (l < 0.01) continue;
      const nx = dz / l * sgn, nz = -dx / l * sgn;                 // pointing away from the water
      const ox = mx + nx * 0.22, oz = mz + nz * 0.22;
      if (onBridge(ox, oz) || onBridge(ox + nx * 1.5, oz + nz * 1.5)) continue;
      Pp.push(tint(new THREE.BoxGeometry(l + 0.04, 0.55, 0.32).rotateY(-Math.atan2(dz, dx)).translate(ox, 0.27, oz), 0xa7a294), tint(new THREE.BoxGeometry(l + 0.06, 0.07, 0.42).rotateY(-Math.atan2(dz, dx)).translate(ox, 0.58, oz), 0xbab5a6));
      if (i % 2 === 0) lamps.push([ox, oz]);
    }
    this.add(Pp);
    // the Embankment's dolphin lamp standards: black iron, a white globe
    const lg = mergeGeometries([tint(new THREE.CylinderGeometry(0.06, 0.1, 1.9, 8).translate(0, 1.1, 0), 0x1a1d1c), tint(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 8).translate(0, 0.2, 0), 0x1a1d1c), tint(new THREE.BoxGeometry(0.4, 0.04, 0.04).translate(0, 1.9, 0), 0x1a1d1c)]);
    const globe = new THREE.SphereGeometry(0.11, 10, 8).translate(0, 2.12, 0);
    const im = new THREE.InstancedMesh(lg, this.metal, lamps.length), ig = new THREE.InstancedMesh(globe, new THREE.MeshBasicMaterial({ color: 0xfff2d0 }), lamps.length);
    lamps.forEach(([x, z], k) => { _m.makeTranslation(x, 0.6, z); im.setMatrixAt(k, _m); ig.setMatrixAt(k, _m); });
    im.castShadow = true; this.scene.add(im, ig); this.lampGlobes = ig.material;
    // moorings: floating piers with gangways at Westminster, the Eye, Bankside and the Tower; clusters of boats moored
    const Q = [];
    for (const [x, z, ax, len] of [[-54.2, -1.5, 'z', 9], [-31.6, -11.8, 'z', 0], [33, -13.8, 'x', 8], [116, -36.2, 'x', 9], [70, -36.2, 'x', 7]]) {
      if (!len) continue;
      Q.push(ax === 'z' ? box(1.4, 0.35, len, x, WL + 0.15, z, 0x3a3f44) : box(len, 0.35, 1.4, x, WL + 0.15, z, 0x3a3f44));
      Q.push(ax === 'z' ? box(1.2, 0.5, len - 0.4, x, WL + 0.55, z, 0xe8e6e0) : box(len - 0.4, 0.5, 1.2, x, WL + 0.55, z, 0xe8e6e0));
      const gx = ax === 'z' ? (x < -43 ? -55.6 : -30.4) : x, gz = ax === 'z' ? z : (z < -25 ? -37.6 : -12.4);
      Q.push(tint(new THREE.BoxGeometry(0.5, 0.06, 2.4).rotateX(ax === 'z' ? 0 : 0).rotateY(ax === 'z' ? Math.PI / 2 : 0).rotateZ(0).translate((gx + x) / 2, (WL + 0.6) / 2, (gz + z) / 2), 0x6b6f74));
    }
    this.add(Q);
  }
  bridges() {
    const P = [], I = [], decks = [], parapets = [], lampsAt = [];
    for (const b of BRIDGES) {
      const s = span(b), u0 = s.a0 - 2.6, u1 = s.a1 + 2.6, L = u1 - u0, c = (u0 + u1) / 2, W = 7;
      const along = (u, y, v, w, h, d, col) => (b.axis === 'x' ? box(w, h, d, u, y, b.at + v, col) : box(d, h, w, b.at + v, y, u, col));
      // the deck: asphalt, kerbs and pavements, the parapets (iron or stone), lamps
      decks.push(along(c, -0.2, 0, L, 0.42, 5.2, 0x46474a));
      for (const sv of [-1, 1]) {
        decks.push(along(c, -0.17, sv * 3.0, L, 0.5, 1.0, 0xa9a49a));
        parapets.push(along(c, 0.36, sv * 3.42, L, 0.58, 0.16, b.tower ? 0x6fa0d0 : b.col), along(c, 0.68, sv * 3.42, L, 0.07, 0.24, b.tower ? 0x6fa0d0 : b.col === 0xd8d2c4 || b.col === 0xc9c4b8 ? b.col : 0x1d201f));
        for (let u = u0 + 1.6; u < u1 - 1; u += 3.4) lampsAt.push(b.axis === 'x' ? [u, b.at + sv * 3.42] : [b.at + sv * 3.42, u]);
      }
      for (let u = u0 + 0.6; u < u1 - 0.6; u += 1.6) decks.push(along(u + 0.4, 0.025, 0, 0.8, 0.012, 0.1, 0xe8e8e2));      // the centre line
      if (b.tower) continue;
      // under the deck: arches springing from the piers, the spandrels in the bridge's own colour
      const bounds = [-HW, ...b.piers.map((p) => -p).sort((x, y) => x - y), ...b.piers.slice().sort((x, y) => x - y), HW];
      for (let k = 0; k + 1 < bounds.length; k++) {
        const ua = s.c + bounds[k] + (k ? 0.65 : 0), ub = s.c + bounds[k + 1] - (k + 1 < bounds.length - 1 ? 0.65 : 0);
        const wdt = ub - ua, rise = Math.min(2.25, wdt * 0.32), spring = WL, top = -0.44, sh = new THREE.Shape();
        sh.moveTo(ua, spring); sh.lineTo(ua, top); sh.lineTo(ub, top); sh.lineTo(ub, spring);
        for (let t = 0; t <= 1.0001; t += 1 / 20) { const a = t * Math.PI; sh.lineTo((ua + ub) / 2 + Math.cos(a) * wdt / 2, spring + Math.sin(a) * rise); }
        I.push(tint(standUp(sh, W - 0.4, b.axis, b.at), b.piers.length > 1 && b.col !== 0xd8d2c4 && b.col !== 0xc9c4b8 ? b.col : b.stone));
        // the arch ring picked out in a lighter band on each face
        for (const sv of [-1, 1]) for (let t = 0.05; t < 0.97; t += 0.1) { const a = t * Math.PI, uu = (ua + ub) / 2 + Math.cos(a) * wdt / 2, yy = spring + Math.sin(a) * rise; I.push(along(uu, yy + 0.08, sv * (W / 2 - 0.15), 0.3, 0.16, 0.12, 0xd8d2c4)); }
      }
      // piers with cutwaters, from the bed up to the deck
      for (const p of b.piers) for (const sg of [-1, 1]) {
        const u = s.c + sg * p;
        P.push(along(u, (BED + WL + 0.2) / 2, 0, 1.3, WL + 0.2 - BED, W, b.stone), along(u, (WL - 0.44) / 2 + 0.05, 0, 1.3, -0.44 - WL, W - 0.3, b.stone));
        for (const sv of [-1, 1]) P.push(b.axis === 'x' ? cyl(0.65, 0.65, WL + 0.6 - BED, u, (BED + WL + 0.6) / 2, b.at + sv * W / 2, b.stone, 12) : cyl(0.65, 0.65, WL + 0.6 - BED, b.at + sv * W / 2, (BED + WL + 0.6) / 2, u, b.stone, 12));
      }
    }
    // the Millennium Bridge: a thin steel blade for walkers on two Y-shaped piers, lined up on St Paul's
    P.push(box(2.3, 0.14, 31.4, 40, -0.05, -25, 0xd8dcdf));
    for (const sv of [-1, 1]) P.push(box(0.1, 0.5, 31.4, 40 + sv * 1.12, 0.25, -25, 0xb8bcc0), box(0.12, 0.12, 31.4, 40 + sv * 1.5, -0.3, -25, 0x9aa0a4));
    for (const z of [-32.4, -17.6]) P.push(box(0.9, -0.2 - BED, 0.9, 40, (BED - 0.2) / 2, z, 0xb8bcc0), tint(new THREE.BoxGeometry(3.4, 0.25, 0.4).translate(40, -0.35, z), 0xb8bcc0));
    this.add(decks, this.mat, false); this.add(P); this.add(I); this.add(parapets, this.metal);
    // lamp standards on the bridges (Westminster's triple lanterns, simple ones elsewhere)
    const lg = mergeGeometries([tint(new THREE.CylinderGeometry(0.05, 0.08, 1.6, 8).translate(0, 0.8, 0), 0x1d201f), tint(new THREE.BoxGeometry(0.5, 0.04, 0.04).translate(0, 1.55, 0), 0x1d201f)]);
    const gl = mergeGeometries([new THREE.SphereGeometry(0.09, 8, 6).translate(0.22, 1.65, 0), new THREE.SphereGeometry(0.09, 8, 6).translate(-0.22, 1.65, 0), new THREE.SphereGeometry(0.1, 8, 6).translate(0, 1.72, 0)]);
    const a = new THREE.InstancedMesh(lg, this.metal, lampsAt.length), bG = new THREE.InstancedMesh(gl, new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), lampsAt.length);
    lampsAt.forEach(([x, z], k) => { _m.makeTranslation(x, 0.65, z); a.setMatrixAt(k, _m); bG.setMatrixAt(k, _m); });
    a.castShadow = true; this.scene.add(a, bG); this.bridgeGlobes = bG.material;
  }

  // ---------- Westminster ----------
  parliament(p) {
    const { big, front, hall, inner, central, victoria } = p, gold = 0xc9a46a, pale = 0xd8bd86, dark = 0x2e2a24, slate = 0x48504f;
    // Elizabeth Tower's shaft: buttressed corners, panelled faces, a string course every two storeys
    {
      const t = topOf(big), x = t.cx, z = t.cz, w = t.w, G2 = [];
      for (const c of big.cells) {
        if (c.f === 0) continue;
        const y0 = c.y - c.hy, y1 = c.y + c.hy, ym = c.y;
        if (c.i === 0 && c.k === 0) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G2.push(box(0.46, y1 - y0, 0.46, x + sx * (w / 2 - 0.12), ym, z + sz * (w / 2 - 0.12), pale));
        if (c.i === 1 && c.k === 0) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (const o of [-1, 0, 1]) G2.push(nx ? box(0.06, (y1 - y0) * 0.86, 0.1, x + nx * (w / 2 + 0.02), ym, z + o * 0.7, dark) : box(0.1, (y1 - y0) * 0.86, 0.06, x + o * 0.7, ym, z + nz * (w / 2 + 0.02), dark));
          if (c.f % 2 === 0) G2.push(nx ? box(0.08, 0.1, w, x + nx * (w / 2 + 0.03), y0 + 0.05, z, pale) : box(w, 0.1, 0.08, x, y0 + 0.05, z + nz * (w / 2 + 0.03), pale));
        }
      }
      this.deck(big, G2);
      // the clock stage, the belfry and the spire: all hung on the top storey (it comes down with the tower)
      const y = t.y, S = [], Gd = [];
      S.push(box(5.2, 5.4, 5.2, x, y + 2.7, z, 0xcdab6c), box(5.5, 0.35, 5.5, x, y + 0.18, z, pale), box(5.6, 0.4, 5.6, x, y + 5.5, z, pale));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(cyl(0.36, 0.36, 6.2, x + sx * 2.6, y + 3.1, z + sz * 2.6, pale, 8), cone(0.42, 1.6, x + sx * 2.6, y + 7, z + sz * 2.6, slate, 8));
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        // the gilded square frame round each dial, the little gable above it, the lettered band below
        Gd.push(nx ? box(0.08, 3.9, 3.9, x + nx * 2.63, y + 2.8, z, 0xd9b04a) : box(3.9, 3.9, 0.08, x, y + 2.8, z + nz * 2.63, 0xd9b04a));
        S.push(nx ? box(0.1, 3.5, 3.5, x + nx * 2.66, y + 2.8, z, 0x1c1f2a) : box(3.5, 3.5, 0.1, x, y + 2.8, z + nz * 2.66, 0x1c1f2a));
        S.push(nx ? tint(new THREE.ConeGeometry(1.4, 1.1, 3).rotateZ(nx * Math.PI / 2 * 0).rotateY(nx > 0 ? 0 : Math.PI).translate(x + nx * 2.5, y + 5.95, z), pale) : tint(new THREE.ConeGeometry(1.4, 1.1, 3).rotateY(Math.PI / 2 * nz).translate(x, y + 5.95, z + nz * 2.5), pale));
        Gd.push(nx ? box(0.06, 0.28, 3.6, x + nx * 2.67, y + 0.62, z, 0xd9b04a) : box(3.6, 0.28, 0.06, x, y + 0.62, z + nz * 2.67, 0xd9b04a));
      }
      // the belfry with its tall pointed openings and iron columns
      S.push(box(4.6, 3.3, 4.6, x, y + 7.35, z, 0xc9a462));
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const o of [-1.2, 0, 1.2]) S.push(nx ? box(0.08, 2.4, 0.8, x + nx * 2.31, y + 7.3, z + o, 0x141414) : box(0.8, 2.4, 0.08, x + o, y + 7.3, z + nz * 2.31, 0x141414));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(cone(0.3, 2.2, x + sx * 2.1, y + 10.1, z + sz * 2.1, gold, 6));
      // the spire: a cast-iron pyramid roof in dark slate and gold, the lantern, the tall needle, orb and cross
      S.push(tint(new THREE.CylinderGeometry(2.1, 2.55, 2.6, 4, 1).rotateY(Math.PI / 4).translate(x, y + 10.3, z), slate));
      Gd.push(tint(new THREE.CylinderGeometry(2.14, 2.14, 0.16, 4, 1).rotateY(Math.PI / 4).translate(x, y + 9.4, z), 0xd9b04a), tint(new THREE.CylinderGeometry(1.75, 1.75, 0.14, 4, 1).rotateY(Math.PI / 4).translate(x, y + 11.6, z), 0xd9b04a));
      S.push(box(2.3, 1.8, 2.3, x, y + 12.5, z, 0xc9a462));
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) S.push(nx ? box(0.06, 1.2, 0.5, x + nx * 1.16, y + 12.5, z, 0x141414) : box(0.5, 1.2, 0.06, x, y + 12.5, z + nz * 1.16, 0x141414));
      S.push(tint(new THREE.ConeGeometry(1.55, 7.2, 4).rotateY(Math.PI / 4).translate(x, y + 17, z), 0x3c4644));
      for (let k = 0; k < 5; k++) Gd.push(tint(new THREE.CylinderGeometry(1.2 - k * 0.22, 1.2 - k * 0.22, 0.1, 4).rotateY(Math.PI / 4).translate(x, y + 14.3 + k * 1.2, z), 0xd9b04a));
      Gd.push(cyl(0.05, 0.08, 1.4, x, y + 21.2, z, 0xd9b04a, 6), sph(0.18, x, y + 21.9, z, 0xd9b04a), box(0.05, 0.6, 0.05, x, y + 22.3, z, 0xd9b04a), box(0.36, 0.05, 0.05, x, y + 22.35, z, 0xd9b04a));
      const top = big.floors - 1;
      for (const m of [this.add(S), this.add(Gd, this.gilt)]) hangOn(big, [m], top);
      // the four dials: white opal glass, black numerals and hands, the real time (lit at night)
      const clock = document.createElement('canvas'); clock.width = clock.height = 256; this.clockCtx = clock.getContext('2d'); this.clockTex = new THREE.CanvasTexture(clock); this.clockTex.colorSpace = THREE.SRGBColorSpace;
      const cmat = new THREE.MeshStandardMaterial({ map: this.clockTex, emissiveMap: this.clockTex, emissive: 0xfff2d0, emissiveIntensity: 0.25, roughness: 0.4 }); this.clockMat = cmat;
      for (const [dx, dz, ry] of [[0, 2.72, 0], [0, -2.72, Math.PI], [2.72, 0, Math.PI / 2], [-2.72, 0, -Math.PI / 2]]) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.55, 40), cmat); f.position.set(x + dx, y + 2.85, z + dz); f.rotation.y = ry; this.scene.add(f); hangOn(big, [f], top); }
      this.drawClock(); this.bigBen = { x, z, y: y + 8 };
    }
    // the river front: buttresses with pinnacles every bay, tall traceried windows, a steep slate roof with iron cresting and turrets
    {
      const t = topOf(front), F = [], R = [];
      for (const c of front.cells) {
        const y0 = c.y - c.hy, y1 = c.y + c.hy;
        for (const [ex, sgn] of [[t.bx, 1], [t.ax, -1]]) if ((sgn > 0 ? c.i === front.nx - 1 : c.i === 0)) {
          F.push(box(0.26, y1 - y0, 0.26, ex + sgn * 0.1, c.y, c.z - c.hz + 0.1, pale));
          F.push(box(0.05, (y1 - y0) * 0.72, 0.42, ex + sgn * 0.03, c.y + 0.05, c.z - 0.3, dark), box(0.05, (y1 - y0) * 0.72, 0.42, ex + sgn * 0.03, c.y + 0.05, c.z + 0.32, dark));
        }
        if (c.k === 0 || c.k === front.nz - 1) for (const sgn of [c.k === 0 ? -1 : 1]) F.push(box(0.42, (y1 - y0) * 0.72, 0.05, c.x, c.y + 0.05, (sgn < 0 ? t.az : t.bz) + sgn * 0.03, dark));
      }
      for (let z = t.az; z <= t.bz + 0.01; z += 1.15) for (const ex of [t.bx + 0.1, t.ax - 0.1]) R.push(cone(0.16, 1.4, ex, t.y + 0.7, z, pale, 4));
      R.push(tint(hipRoof(t.w - 0.2, t.d - 0.2, 2.6).translate(t.cx, t.y, t.cz), slate));
      for (let z = t.az + 1.5; z < t.bz - 1; z += 0.5) R.push(box(0.04, 0.35, 0.04, t.cx, t.y + 2.75, z, 0x2a2a2a));
      for (let z = t.az + 2; z < t.bz - 1; z += 3.4) R.push(box(0.9, 1.6, 0.9, t.cx, t.y + 2.1, z, pale), cone(0.6, 2.2, t.cx, t.y + 4, z, slate, 4));
      for (const z of [t.az + 0.6, t.bz - 0.6]) for (const ex of [t.bx - 0.6, t.ax + 0.6]) R.push(cyl(0.5, 0.5, 2.4, ex, t.y + 1.2, z, pale, 8), cone(0.58, 2.1, ex, t.y + 3.4, z, slate, 8));
      this.deck(front, F); hangOn(front, [this.add(R)], front.floors - 1);
      const ti = topOf(inner); hangOn(inner, [this.add([tint(hipRoof(ti.w, ti.d, 1.6).translate(ti.cx, ti.y, ti.cz), slate), ...[ti.az + 0.6, ti.bz - 0.6].map((zz) => cone(0.18, 1.2, ti.ax + 0.2, ti.y + 0.6, zz, pale, 4))])], inner.floors - 1);
    }
    // the Central Tower: an octagonal lantern and spire over the Central Lobby
    { const t = topOf(central), x = t.cx, z = t.cz, y = t.y; const S = [cyl(1.7, 1.8, 3.2, x, y + 1.6, z, pale, 8), cyl(1.9, 1.9, 0.3, x, y + 3.3, z, pale, 8), tint(new THREE.ConeGeometry(1.6, 7.2, 8).translate(x, y + 7, z), slate)];
      for (let a = 0; a < 6.28; a += Math.PI / 4) S.push(cone(0.18, 1.6, x + Math.cos(a) * 1.85, y + 4.2, z + Math.sin(a) * 1.85, pale, 4), box(0.08, 2.2, 0.36, x + Math.cos(a) * 1.72, y + 1.7, z + Math.sin(a) * 1.72, dark));
      hangOn(central, [this.add(S)], central.floors - 1); }
    // Victoria Tower: panelled shaft, the crown of corner turrets and battlements, and the great Union flag
    {
      const t = topOf(victoria), x = t.cx, z = t.cz, y = t.y, V = [];
      for (const c of victoria.cells) if (c.f > 0 && (c.i === 0 || c.i === victoria.nx - 1)) for (const o of [-1, 1]) V.push(box(0.06, c.hy * 1.7, 0.4, c.x + (c.i === 0 ? -c.hx - 0.02 : c.hx + 0.02), c.y, c.z + o * 0.35, dark));
      for (const c of victoria.cells) if (c.f > 0 && (c.k === 0 || c.k === victoria.nz - 1)) for (const o of [-1, 1]) V.push(box(0.4, c.hy * 1.7, 0.06, c.x + o * 0.35, c.y, c.z + (c.k === 0 ? -c.hz - 0.02 : c.hz + 0.02), dark));
      this.deck(victoria, V);
      const C2 = [];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C2.push(cyl(0.55, 0.55, 3.6, x + sx * (t.w / 2 - 0.3), y + 1.8, z + sz * (t.d / 2 - 0.3), pale, 8), cone(0.6, 2.6, x + sx * (t.w / 2 - 0.3), y + 4.9, z + sz * (t.d / 2 - 0.3), slate, 8));
      for (let u = -t.w / 2 + 1; u < t.w / 2 - 0.8; u += 0.6) for (const sz of [-1, 1]) C2.push(box(0.3, 0.6, 0.2, x + u, y + 0.3, z + sz * (t.d / 2 - 0.1), pale));
      C2.push(cyl(0.06, 0.06, 6, x, y + 3, z, 0xe8e8e8, 6));
      hangOn(victoria, [this.add(C2)], victoria.floors - 1);
      hangOn(victoria, [this.sign(2.6, 1.6, ukFlag, x + 1.32, y + 5.2, z, Math.PI / 2, 0.15, true)], victoria.floors - 1);
    }
    // Westminster Hall's roof is the building's own gable; little turrets at its gable ends
    { const t = topOf(hall); hangOn(hall, [this.add([cone(0.3, 1.6, t.cx, t.y + 2.6, t.az + 0.2, pale, 6), cone(0.3, 1.6, t.cx, t.y + 2.6, t.bz - 0.2, pale, 6)])], hall.floors - 1); }
  }
  drawClock() {
    const c = this.clockCtx, d = new Date(), h = d.getHours() % 12, m = d.getMinutes(), S = 256, r = 120;
    c.fillStyle = '#1c1f2a'; c.fillRect(0, 0, S, S);
    const gr = c.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, r); gr.addColorStop(0, '#fbf6e8'); gr.addColorStop(1, '#ece2c8');
    c.fillStyle = gr; c.beginPath(); c.arc(S / 2, S / 2, r, 0, 6.28); c.fill();
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 3; c.beginPath(); c.arc(S / 2, S / 2, r * 0.97, 0, 6.28); c.stroke(); c.beginPath(); c.arc(S / 2, S / 2, r * 0.7, 0, 6.28); c.stroke();
    // the radial glazing bars and the Roman numerals
    c.lineWidth = 1.2; for (let k = 0; k < 60; k++) { const a = k / 60 * 6.283; c.beginPath(); c.moveTo(S / 2 + Math.sin(a) * r * 0.32, S / 2 - Math.cos(a) * r * 0.32); c.lineTo(S / 2 + Math.sin(a) * r * 0.7, S / 2 - Math.cos(a) * r * 0.7); c.stroke(); }
    c.fillStyle = '#141414'; c.font = '700 22px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
    ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((t, k) => { const a = k / 12 * 6.283; c.save(); c.translate(S / 2 + Math.sin(a) * r * 0.84, S / 2 - Math.cos(a) * r * 0.84); c.rotate(a); c.fillText(t, 0, 0); c.restore(); });
    c.strokeStyle = '#111'; c.lineCap = 'round';
    const hand = (a, len, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(S / 2, S / 2); c.lineTo(S / 2 + Math.sin(a) * len, S / 2 - Math.cos(a) * len); c.stroke(); };
    hand((h + m / 60) / 12 * 6.283, r * 0.5, 9); hand(m / 60 * 6.283, r * 0.82, 6);
    this.clockTex.needsUpdate = true;
  }
  abbey(a) {
    const st = 0xd2c8b4, dk = 0x2e2a26;
    for (const t of a.towers) { const tt = topOf(t), P = [box(tt.w + 0.2, 0.4, tt.d + 0.2, tt.cx, tt.y + 0.2, tt.cz, st)]; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(cone(0.22, 2, tt.cx + sx * 0.9, tt.y + 1, tt.cz + sz * 0.9, st, 4)); hangOn(t, [this.add(P)], t.floors - 1);
      const D = []; for (const c of t.cells) if (c.f > 2 && c.f < t.floors - 1 && c.k === 0) D.push(box(0.5, c.hy * 1.5, 0.05, c.x, c.y, c.z - c.hz - 0.03, dk)); this.deck(t, D); }
    const n = topOf(a.nave), P = [];
    // flying buttresses down both sides, pinnacles on each, and the great west window between the towers
    for (let z = n.az + 1; z < n.bz; z += 1.8) for (const s of [-1, 1]) P.push(box(0.5, 2.6, 0.4, n.cx + s * (n.w / 2 + 0.5), n.y - 1.9, z, st), tint(new THREE.BoxGeometry(0.9, 0.14, 0.2).rotateZ(s * 0.6).translate(n.cx + s * (n.w / 2 + 0.2), n.y - 0.4, z), st), cone(0.18, 1.2, n.cx + s * (n.w / 2 + 0.5), n.y - 0.1, z, st, 4));
    P.push(tint(new THREE.CircleGeometry(1.1, 18).translate(n.cx, n.y - 2.4, n.az - 0.06).rotateY(0), 0x3a4a6a));
    hangOn(a.nave, [this.add(P)]);
  }
  palace(p) {
    const b = topOf(p.b), P = [], x = p.b.x + p.b.w / 2;
    // the east front: the central portico, columns and pediment, the balcony, the Royal Standard
    for (let k = 0; k < 8; k++) P.push(cyl(0.22, 0.25, 4.8, x + 0.55, 2.4 + 1.9, p.z - 4.2 + k * 1.2, 0xece6d8, 10));
    P.push(box(1.4, 0.7, 10.4, x + 0.55, 6.9, p.z, 0xe2dccd), tint(new THREE.ConeGeometry(5.6, 1.2, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(0.3, 1, 1).translate(x + 0.55, 7.7, p.z), 0xe2dccd), box(0.9, 0.3, 5, x + 0.5, 3.4, p.z, 0xc8102e));
    P.push(box(b.w + 0.4, 0.6, b.d + 0.4, b.cx, b.y + 0.3, b.cz, 0xd8d2c4));
    for (let z = b.az + 1; z < b.bz; z += 1.6) P.push(box(0.3, 0.7, 0.3, b.bx, b.y + 0.95, z, 0xd8d2c4));
    P.push(cyl(0.05, 0.05, 4.4, b.cx, b.y + 2.4, b.cz, 0xdddddd, 6));
    hangOn(p.b, [this.add(P)]);
    hangOn(p.b, [this.sign(2.2, 1.3, (c, w, h) => { c.fillStyle = '#c8102e'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); c.fillStyle = '#2a4fa0'; c.fillRect(0, h / 2, w / 2, h / 2); c.fillStyle = '#e8b830'; c.fillRect(w / 2, 0, w / 2, h / 2); }, b.cx, b.y + 4, b.cz + 1.12, Math.PI / 2, 0.2, true)]);
    // the railings and gilded gates, the black sentry boxes
    const R = [];
    for (let z = -66; z < -26; z += 0.5) R.push(box(0.05, 1.7, 0.05, -121.4, 0.85, z, 0x111111));
    R.push(box(0.1, 0.12, 40, -121.4, 1.6, -46, 0xb8952e), box(0.1, 0.12, 40, -121.4, 0.3, -46, 0x111111));
    for (const z of [-50, -42]) R.push(box(0.5, 2.6, 0.5, -121.4, 1.3, z, 0xd9b04a));
    for (const z of [-55, -51, -41, -37]) R.push(box(0.9, 2, 0.9, -125.4, 1, z, 0x161616), tint(hipRoof(1.1, 1.1, 0.5).translate(-125.4, 2, z), 0x161616));
    this.add(R, this.metal);
    // the Victoria Memorial: white marble on a round base with pools, the gilded Winged Victory
    const { x: mx, z: mz } = p.memorial, V = [];
    V.push(cyl(4.6, 4.8, 0.6, mx, 0.3, mz, 0xe8e4da, 32), cyl(3.8, 3.8, 0.15, mx, 0.66, mz, 0x6fa8b8, 32), box(2.6, 4, 2.6, mx, 2.6, mz, 0xf2efe8), box(1.6, 3, 1.6, mx, 6, mz, 0xf2efe8));
    const Gd = [cyl(0.35, 0.45, 1.6, mx, 8.3, mz, 0xd9b04a, 8), box(1.6, 0.6, 0.2, mx, 9, mz, 0xd9b04a), sph(0.25, mx, 9.3, mz, 0xd9b04a)];
    this.add(V); this.add(Gd, this.gilt);
    for (const w of p.wings) { const t = topOf(w); hangOn(w, [this.add([box(t.w + 0.3, 0.5, t.d + 0.3, t.cx, t.y + 0.25, t.cz, 0xd8d2c4)])]); }
  }
  horseGuards(h) {
    const t = topOf(h.tower), P = [box(t.w + 0.2, 0.3, t.d + 0.2, t.cx, t.y + 0.15, t.cz, 0xe2dccd), cyl(0.8, 0.9, 1.6, t.cx, t.y + 1.1, t.cz, 0xe8e2d4, 8), tint(new THREE.SphereGeometry(0.85, 10, 6, 0, 6.28, 0, Math.PI / 2).translate(t.cx, t.y + 1.9, t.cz), 0x6a7478), cyl(0.04, 0.04, 1.2, t.cx, t.y + 3, t.cz, 0xd9b04a, 4)];
    for (const [dx, dz, ry] of [[1.21, 0, Math.PI / 2], [-1.21, 0, -Math.PI / 2]]) P.push(tint(new THREE.CircleGeometry(0.55, 20).rotateY(ry).translate(t.cx + dx, t.y - 1, t.cz + dz), 0xf2ecd8));
    hangOn(h.tower, [this.add(P)], h.tower.floors - 1);
    // the arch through to the parade ground, the cavalry sentry boxes
    const b = topOf(h.b);
    this.add([box(0.1, 2.4, 2.2, b.bx + 0.06, 1.2, b.cz, 0x1a1a1a), box(1.6, 2.4, 1.4, b.bx + 0.9, 1.2, b.cz - 3.2, 0xece6d8), box(1.6, 2.4, 1.4, b.bx + 0.9, 1.2, b.cz + 3.2, 0xece6d8)]);
  }
  trafalgar(t, gallery) {
    // Nelson's Column on its plinth with Landseer's lions, the two fountains; the National Gallery's portico and dome
    const { x, z } = t, P = [];
    P.push(box(3.2, 2.4, 3.2, x, 1.2, z, 0xc9c1b0), cyl(0.48, 0.58, 17, x, 10.9, z, 0xd8d0c0, 14), box(1.3, 1.1, 1.3, x, 19.9, z, 0xb89858), cyl(0.18, 0.24, 1.3, x, 21.1, z, 0x5a5a58, 8), sph(0.13, x, 21.85, z, 0x5a5a58));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(box(1.6, 0.8, 1, x + sx * 2.5, 0.4, z + sz * 2.5, 0xc9c1b0), tint(new THREE.BoxGeometry(0.6, 0.6, 1.3).translate(x + sx * 2.5, 1.1, z + sz * 2.5), 0x2e2e2c), sph(0.28, x + sx * 2.5, 1.45, z + sz * 2.5 + sz * 0.55, 0x2e2e2c));
    for (const dz of [-4.4, 4.4]) P.push(cyl(2, 2.1, 0.5, x + 0, 0.25, z + dz, 0xd0c8b8, 20), cyl(1.8, 1.8, 0.08, x, 0.5, z + dz, 0x6fa8b8, 20), cyl(0.3, 0.4, 1.5, x, 1.05, z + dz, 0xd0c8b8, 8));
    this.add(P);
    this.fountainJets = [-4.4, 4.4].map((dz) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.55, depthWrite: false })); m.position.set(x, 2.5, z + dz); this.scene.add(m); return m; });
    const g2 = topOf(gallery), Q = [];
    for (let k = 0; k < 8; k++) Q.push(cyl(0.2, 0.23, 3.8, g2.cx - 2.8 + k * 0.8, 2.5, gallery.z + gallery.d / 2 + 0.7, 0xece6d8, 8));
    Q.push(box(7, 0.8, 1.6, g2.cx, 4.8, gallery.z + gallery.d / 2 + 0.5, 0xe2dccd), tint(new THREE.SphereGeometry(1.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(g2.cx, g2.y + 1.2, g2.cz), 0x8a9a9a), cyl(1.4, 1.4, 1.2, g2.cx, g2.y + 0.6, g2.cz, 0xe2dccd, 16));
    hangOn(gallery, [this.add(Q)]);
  }
  // Piccadilly Circus: the curved wall of screens on the corner, Eros on his fountain
  piccadilly(pc) {
    const t = topOf(pc.b), b = pc.b, y0 = 2.2, h = t.y - y0 - 0.6;
    const ads = [['COLA', '#d7261e', '#ffffff', 'script'], ['NOVA', '#0b0b0f', '#5ce1e6'], ['THE WEST END', '#2a0a3a', '#ffe680'], ['LONDON EYE', '#0e2b4a', '#ffffff'], ['TEA TIME', '#123a1e', '#f5e7b8'], ['MIND THE GAP', '#0019a8', '#ffffff'], ['FISH & CHIPS', '#0e3d6b', '#ffd34a'], ['DOUBLE DECKER', '#c8102e', '#ffffff']];
    this.pcScreens = [];
    for (const side of ['s', 'e']) for (let k = 0; k < 2; k++) {
      const w = (side === 's' ? b.w : b.d) / 2 - 0.1, cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = Math.round(256 * h / w);
      const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
      const u = (k - 0.5) * (w + 0.1);
      if (side === 's') m.position.set(b.x + u, y0 + h / 2, b.z + b.d / 2 + 0.08); else { m.position.set(b.x + b.w / 2 + 0.08, y0 + h / 2, b.z - u); m.rotation.y = Math.PI / 2; }
      this.scene.add(m); hangOn(b, [m]);
      this.pcScreens.push({ ctx: cvs.getContext('2d'), tex, i: k * 3 + (side === 'e' ? 1 : 0), next: 0, ads });
    }
    this.add([box(0.5, h + 0.4, 0.5, b.x + b.w / 2 + 0.1, y0 + h / 2, b.z + b.d / 2 + 0.1, 0x1a1a1a)]);
    const { x, z } = pc.eros;
    this.add([cyl(1.1, 1.3, 0.5, x, 0.25, z, 0x6a5a48, 10), cyl(0.5, 0.7, 1.4, x, 1.2, z, 0x5a6a5a, 8), cyl(0.12, 0.18, 0.9, x, 2.3, z, 0x3a5a4a, 8), sph(0.16, x, 2.85, z, 0x3a5a4a), box(0.6, 0.06, 0.12, x, 2.9, z, 0x3a5a4a)], this.metal);
  }
  drawScreen(s) {
    const c = s.ctx, w = c.canvas.width, h = c.canvas.height, [txt, bg, fg, kind] = s.ads[s.i % s.ads.length];
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = kind === 'script' ? `italic 700 ${Math.round(w * 0.24)}px Georgia` : `900 ${Math.round(Math.min(w * 0.18, h * 0.22))}px Arial`;
    c.fillText(txt, w / 2, h * 0.45, w * 0.9);
    c.font = `600 ${Math.round(w * 0.06)}px Arial`; c.globalAlpha = 0.8; c.fillText('PICCADILLY · LONDON', w / 2, h * 0.75, w * 0.9); c.globalAlpha = 1;
    for (let y = 0; y < h; y += 3) { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, y, w, 1); }
    s.tex.needsUpdate = true;
  }
  // the London Eye: a truss rim on cable spokes, 32 egg-shaped capsules, the A-frame on the bank with two feet and
  // backstay cables, the boarding pier on the water
  eye(e) {
    const g2 = new THREE.Group(); g2.position.set(e.x, e.r + 2.2, e.z); g2.rotation.y = Math.PI / 2;     // the rim parallel to the river
    const R = e.r, P = [];
    for (const zz of [-0.45, 0.45]) P.push(tint(new THREE.TorusGeometry(R, 0.09, 6, 96).translate(0, 0, zz), 0xf4f4f2), tint(new THREE.TorusGeometry(R - 0.75, 0.07, 6, 96).translate(0, 0, zz), 0xf4f4f2));
    // the truss bracing round the rim
    for (let k = 0; k < 96; k++) {
      const a = k / 96 * 6.283, a2 = (k + 0.5) / 96 * 6.283, c = Math.cos(a), s = Math.sin(a);
      P.push(tint(new THREE.BoxGeometry(0.04, 0.75, 0.04).translate(0, R - 0.375, 0).rotateZ(a).translate(0, 0, k % 2 ? 0.45 : -0.45), 0xe6e6e4));
      P.push(tint(new THREE.BoxGeometry(0.035, 0.035, 0.95).translate(Math.cos(a2) * (R - 0.37), Math.sin(a2) * (R - 0.37), 0), 0xe6e6e4));
      void c; void s;
    }
    // cable spokes from the spindle to both rim rings
    for (let k = 0; k < 64; k++) { const a = k / 64 * 6.283, zz = k % 2 ? 0.45 : -0.45, len = Math.hypot(R - 0.75, zz * 1.6); P.push(tint(new THREE.CylinderGeometry(0.012, 0.012, len, 3).translate(0, len / 2, 0).rotateX(Math.atan2(zz * 1.6, R - 0.75) * (k % 2 ? 1 : -1) * 0.0).rotateZ(a - Math.PI / 2 + Math.PI / 2).translate(0, 0, zz * 0.2), 0xcfd2d4)); }
    P.push(cyl(0.6, 0.6, 2.4, 0, 0, 0, 0xdedede, 16).rotateX(Math.PI / 2), cyl(0.9, 0.9, 0.5, 0, 0, 0, 0xcfcfcf, 16).rotateX(Math.PI / 2));
    g2.add(new THREE.Mesh(mergeGeometries(P), this.metal));
    this.capsules = [];
    const cg = mergeGeometries([new THREE.SphereGeometry(0.6, 16, 10).scale(0.62, 0.62, 1.25), new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).rotateX(Math.PI / 2).translate(0, 0.5, 0)]);
    const cm = new THREE.MeshStandardMaterial({ color: 0xd8ecf6, roughness: 0.04, metalness: 0.55, transparent: true, opacity: 0.9, emissive: 0x3a6aaa, emissiveIntensity: 0, envMapIntensity: 1.5 });
    for (let k = 0; k < 32; k++) { const m = new THREE.Mesh(cg, cm); g2.add(m); this.capsules.push(m); }
    this.capMat = cm; this.eyeG = g2; this.eyeR = R; this.scene.add(g2);
    // the A-frame: two legs from feet far apart on the bank, leaning out to hold the spindle; backstays to the land
    const hub = new THREE.Vector3(e.x, R + 2.2, e.z), A = [];
    const strut = (a, b, r0, r1, col) => { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); const g3 = new THREE.CylinderGeometry(r1, r0, len, 10).translate(0, len / 2, 0); g3.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); g3.translate(a.x, a.y, a.z); return tint(g3, col); };
    const feet = [new THREE.Vector3(e.x + 6.6, 0, e.z - 7.6), new THREE.Vector3(e.x + 6.6, 0, e.z + 7.6)];
    const top = new THREE.Vector3(e.x + 1.2, R + 2.2, e.z);
    for (const f of feet) A.push(strut(f, top, 0.55, 0.32, 0xf2f2f0), box(2.2, 0.6, 2.2, f.x, 0.3, f.z, 0xbdbdb8));
    A.push(strut(top, hub, 0.45, 0.45, 0xf2f2f0), strut(new THREE.Vector3(e.x + 6.6, 3.4, e.z - 6.2), new THREE.Vector3(e.x + 6.6, 3.4, e.z + 6.2), 0.18, 0.18, 0xf2f2f0));
    for (const sz of [-1, 1]) A.push(strut(new THREE.Vector3(e.x + 15.4, 0.2, e.z + sz * 3.2), top, 0.05, 0.05, 0x9aa0a4), box(1.4, 0.4, 1.4, e.x + 15.4, 0.2, e.z + sz * 3.2, 0xbdbdb8));
    // the boarding pier under the wheel, out on the water
    A.push(box(3.4, 0.5, 10, e.x - 0.2, WL + 0.3, e.z, 0x6b6f74), box(3.2, 0.7, 9.6, e.x - 0.2, WL + 0.85, e.z, 0xd8dcdc), box(1.6, 0.16, 3, e.x + 0.9, (WL + 1.2) / 2 + 0.2, e.z + 5.4, 0x8a8e92));
    this.add(A, this.metal);
  }
  needle(n) { this.add([box(0.7, 6.4, 0.7, n.x, 3.8, n.z, 0xa89878), tint(new THREE.ConeGeometry(0.52, 0.8, 4).rotateY(Math.PI / 4).translate(n.x, 7.4, n.z), 0x9a8a6a), box(1.8, 0.6, 1.8, n.x, 0.3, n.z, 0x8a7a60), box(1.2, 0.4, 0.5, n.x - 1.4, 0.8, n.z, 0x3a3226), box(1.2, 0.4, 0.5, n.x + 1.4, 0.8, n.z, 0x3a3226)]); }
  // New Scotland Yard's revolving sign out front
  scotlandYard(s) {
    const g2 = new THREE.Group(); g2.position.set(-68.6, 0, s.z - 4.6);
    g2.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8).translate(0, 0.8, 0), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.3 })));
    const tex = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#d8dde2'; c.fillRect(0, 0, w, h); c.fillStyle = '#0a1a3a'; c.font = '700 54px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('NEW SCOTLAND YARD', w / 2, h / 2, w * 0.94); });
    const sgn = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 3, 1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1.6, 1, 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.3, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.1 }));
    sgn.position.y = 1.9; g2.add(sgn); this.scene.add(g2); this.nsySign = sgn; this.signs.push(sgn.material);
  }
  stpauls(s) {
    // the dome on its colonnaded drum, the lantern and gilded cross; the baroque west towers
    const { x, z } = s.dome, base = topOf(s.nave).y, P = [], Gd = [];
    P.push(cyl(4.3, 4.5, 4, x, base + 2, z, 0xd8d2c4, 32));
    for (let a = 0; a < 6.28; a += 0.24) P.push(cyl(0.17, 0.19, 3.4, x + Math.cos(a) * 4.62, base + 1.9, z + Math.sin(a) * 4.62, 0xece6d8, 6));
    P.push(cyl(4.85, 4.85, 0.4, x, base + 3.8, z, 0xd0c8b8, 32), cyl(3.9, 4, 2.2, x, base + 5, z, 0xd8d2c4, 28));
    P.push(tint(new THREE.SphereGeometry(4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.18, 1).translate(x, base + 6, z), 0x8a9a96));
    for (let a = 0; a < 6.28; a += 0.4) P.push(tint(new THREE.TorusGeometry(4.02, 0.05, 4, 24, Math.PI / 2).scale(1, 1.18, 1).rotateY(-a).rotateX(0).translate(x, base + 6, z), 0x7a8a86));
    P.push(cyl(0.7, 0.8, 2.6, x, base + 11.6, z, 0xd8d2c4, 12));
    Gd.push(sph(0.35, x, base + 13.2, z, 0xd9b04a), box(0.12, 1.1, 0.12, x, base + 13.9, z, 0xd9b04a), box(0.6, 0.12, 0.12, x, base + 14.1, z, 0xd9b04a));
    hangOn(s.nave, [this.add(P), this.add(Gd, this.gilt)]);
    for (const t of s.wt) { const tt = topOf(t), Q = [cyl(1, 1.1, 2.4, tt.cx, tt.y + 1.2, tt.cz, 0xd8d2c4, 12), tint(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(tt.cx, tt.y + 2.4, tt.cz), 0x8a9a96), cone(0.25, 1.6, tt.cx, tt.y + 3.9, tt.cz, 0xd9b04a, 8)]; hangOn(t, [this.add(Q)]); }
    const n = topOf(s.nave);
    hangOn(s.nave, [this.add([box(1, 3.2, 6.4, n.ax - 0.6, 3.6, n.cz, 0xe2dccd), tint(new THREE.ConeGeometry(3.6, 1, 3).rotateX(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 1, 0.25).translate(n.ax - 0.6, 5.7, n.cz), 0xe2dccd), ...[0, 1, 2, 3, 4, 5].map((k) => cyl(0.2, 0.22, 3, n.ax - 1, 2.6, n.cz - 2.5 + k, 0xece6d8, 8))])]);
  }
  cityTowers(c) {
    // the Walkie-Talkie's garden crown, the Cheesegrater's sloping face, Bishopsgate's crown, Lloyd's steel ducts,
    // the Scalpel's point, the Heron's mast, Tower 42's crown
    const w = topOf(c.wk[2]); hangOn(c.wk[2], [this.add([box(w.w - 0.4, 0.5, w.d - 0.4, w.cx, w.y + 0.25, w.cz, 0x4f7a3a), tint(new THREE.CylinderGeometry(w.w / 2, w.w / 2, w.d, 20, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.25, 1).translate(w.cx, w.y, w.cz), 0x9ab4c4)], this.glass)]);
    const ch = topOf(c.cheese), slope = [];
    for (let k = 0; k < 10; k++) slope.push(box(ch.w, 0.18, 1.2, ch.cx, ch.y - k * 3.4, ch.bz + 0.4 + k * 0.42, 0xa4b8c4));
    this.deck(c.cheese, slope, this.glass);
    const b = topOf(c.bishops); hangOn(c.bishops, [this.add([box(b.w + 0.2, 1.4, b.d + 0.2, b.cx, b.y + 0.7, b.cz, 0x8aa0aa)], this.glass)], c.bishops.floors - 1);
    const l = topOf(c.lloyds), D = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.push(cyl(0.45, 0.45, l.y + 2, l.cx + sx * (l.w / 2 + 0.3), (l.y + 2) / 2, l.cz + sz * (l.d / 2 + 0.3), 0xc8ccd0, 10));
    for (let y = 2; y < l.y; y += 1.2) D.push(box(l.w + 0.6, 0.12, 0.12, l.cx, y, l.az - 0.25, 0xb8bcc0));
    this.deck(c.lloyds, D, this.metal);
    const s = topOf(c.scalpel); hangOn(c.scalpel, [this.add([tint(hipRoof(s.w, s.d, 5.4).translate(s.cx, s.y, s.cz), 0xa8c8dc)], this.glass)], c.scalpel.floors - 1);
    const h = topOf(c.heron); hangOn(c.heron, [this.add([cyl(0.08, 0.12, 6, h.cx, h.y + 3, h.cz, 0xdddddd, 6), box(h.w, 1, h.d, h.cx, h.y + 0.5, h.cz, 0x30363c)])], c.heron.floors - 1);
    const t = topOf(c.t42); hangOn(c.t42, [this.add([box(t.w * 0.7, 1.6, t.d * 0.7, t.cx, t.y + 0.8, t.cz, 0x30363c)])], c.t42.floors - 1);
  }
  // the Gherkin: a bullet of glass in a white diagrid, the dark bands spiralling up it, a lens of glass at the top.
  // Built in rings, each one hung on its own storey so it breaks away with the building.
  gherkin(b) {
    const x = b.x, z = b.z, H = topOf(b).y + 1.6, rMax = 5.3;
    const rAt = (t) => rMax * Math.sin(Math.min(1, 0.27 + t * 0.98) * Math.PI * 0.6) * (t > 0.8 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) * 0.98 + 0.02 : 1);
    const cvs = document.createElement('canvas'); cvs.width = 1024; cvs.height = 1024; const c = cvs.getContext('2d');
    // glass: blue-green, the six dark spirals, then the white diamond grid over everything
    const gr = c.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, '#8ab4b8'); gr.addColorStop(1, '#5f8f96'); c.fillStyle = gr; c.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 6; k++) for (let y = 0; y < 1024; y += 4) { const u = ((k / 6 + y / 1024 * 0.55) % 1) * 1024; c.fillStyle = '#1f3438'; c.fillRect(u, y, 1024 / 6 * 0.42, 4); c.fillRect(u - 1024, y, 1024 / 6 * 0.42, 4); }
    for (let y = 0; y < 1024; y += 4) for (let u = 0; u < 1024; u += 32) { c.fillStyle = `rgba(255,255,255,${0.04 + 0.05 * Math.random()})`; c.fillRect(u, y, 30, 3); }
    c.strokeStyle = 'rgba(240,244,246,.95)'; c.lineWidth = 3;
    for (let k = -48; k < 96; k++) { c.beginPath(); c.moveTo(k * 32, 0); c.lineTo(k * 32 + 1024, 1024); c.stroke(); c.beginPath(); c.moveTo(k * 32, 0); c.lineTo(k * 32 - 1024, 1024); c.stroke(); }
    for (let y = 0; y < 1024; y += 21) { c.fillStyle = 'rgba(230,236,238,.5)'; c.fillRect(0, y, 1024, 1.5); }
    const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.wrapS = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.12, metalness: 0.55, envMapIntensity: 1.4 });
    const N = 24;
    for (let k = 0; k < N; k++) {
      const t0 = k / N, t1 = (k + 1) / N, pts = [];
      for (let j = 0; j <= 2; j++) { const t = t0 + (t1 - t0) * j / 2; pts.push(new THREE.Vector2(Math.max(0.02, rAt(t)), t * H)); }
      const g3 = new THREE.LatheGeometry(pts, 48);
      const uv = g3.attributes.uv, ps = g3.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setY(i, ps.getY(i) / H);
      g3.translate(x, 0, z);
      const m = new THREE.Mesh(g3, mat); m.castShadow = true; this.scene.add(m);
      const y = (t0 + t1) / 2 * H; let best = null, bd = 1e9;
      for (const cell of b.cells) { const d = Math.abs(cell.y - y) * 2 + Math.hypot(cell.x - x, cell.z - z) * 0.3; if (d < bd) { bd = d; best = cell; } }
      (best.props ||= []).push({ obj: [m], x: best.x, y: best.y, z: best.z });
    }
    hangOn(b, [this.add([sph(0.9, x, H - 0.1, z, 0x9fd0e0)], this.glass)], b.floors - 1);
  }
  shard(s) {
    // the Shard: a glass pyramid of splinters on its stepped core, open at the very top
    const t = topOf(s), H = t.y + 8;
    skinOn(this.scene, s, pyramidTris(s.x, s.z, s.w / 2 + 0.35, 0.45, 0, H - 1.2, 10), (p) => (Math.sin(p.y * 0.8 + p.x) > 0.6 ? 0xb7cbd8 : 0x8faabd), this.glass);
    const top = []; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) top.push(tint(new THREE.ConeGeometry(0.22, 3, 4).translate(s.x + sx * 0.35, H + 0.2, s.z + sz * 0.35), 0xa8c0d0));
    hangOn(s, [this.add(top, this.glass)], s.floors - 1);
  }
  towerOfLondon(t) {
    const w = topOf(t.white), P = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = w.cx + sx * (w.w / 2 - 0.5), z = w.cz + sz * (w.d / 2 - 0.5), round = sx > 0 && sz < 0;
      P.push(round ? cyl(0.8, 0.8, 2.6, x, w.y + 1.3, z, 0xe8e2d4, 12) : box(1.4, 2.6, 1.4, x, w.y + 1.3, z, 0xe8e2d4));
      P.push(tint(new THREE.SphereGeometry(0.75, 10, 8).scale(1, 1.3, 1).translate(x, w.y + 3.2, z), 0x6a7378), cyl(0.03, 0.03, 1, x, w.y + 4.5, z, 0xd9b04a, 4));
    }
    for (let x = w.ax; x < w.bx; x += 0.8) for (const z of [w.az, w.bz]) P.push(box(0.4, 0.5, 0.3, x, w.y + 0.25, z, 0xe8e2d4));
    hangOn(t.white, [this.add(P)]);
    for (const wall of t.walls) { const tt = topOf(wall), Q = []; const long = tt.w > tt.d; for (let a = 0; a < Math.max(tt.w, tt.d); a += 0.8) Q.push(box(0.4, 0.5, 0.4, long ? tt.ax + a : tt.cx, tt.y + 0.25, long ? tt.cz : tt.az + a, 0xcfc6b2)); hangOn(wall, [this.add(Q)]); }
    hangOn(t.white, [this.sign(1.6, 1, ukFlag, w.cx + 0.82, w.y + 5.6, w.cz, 0, 0.2, true), this.add([cyl(0.04, 0.04, 2.6, w.cx, w.y + 4.5, w.cz, 0xdddddd, 6)])]);
  }
  // Tower Bridge: the stone piers, the Gothic towers (buildings), the high walkways, the bascule deck, the blue chains
  towerBridge(tb) {
    const x = 105, P = [], st = 0xd8ccb0, blue = 0x6fa0d0, slate = 0x4a5458;
    for (const z of [-33, -17]) P.push(box(9.6, -BED, 6.4, x, BED / 2, z, 0x9a9384), cyl(3.2, 3.2, -BED, x - 4.8, BED / 2, z, 0x9a9384, 16), cyl(3.2, 3.2, -BED, x + 4.8, BED / 2, z, 0x9a9384, 16));
    this.add(P);
    for (const k of ['n', 's', 'an', 'as']) {
      const T = tb[k], t = topOf(T.top), big = k.length === 1, D = [], R = [], Gd = [];
      // windows and string courses up the tower, the arch over the road between the legs
      for (const c of T.top.cells) if (c.f > 0 && (c.k === 0 || c.k === T.top.nz - 1) && c.i % 2 === 1) D.push(box(0.4, c.hy * 1.3, 0.06, c.x, c.y, c.k === 0 ? c.z - c.hz - 0.03 : c.z + c.hz + 0.03, 0x2a2a2a));
      for (const c of T.top.cells) if (c.f % 3 === 1 && c.i === 0) D.push(box(t.w + 0.12, 0.14, t.d + 0.12, x, c.y - c.hy, t.cz, 0xc4b694));
      if (D.length) this.deck(T.top, D);
      // the roof: a steep slate pyramid, four corner turrets with spirelets and gilded finials, a central pinnacle
      R.push(tint(hipRoof(t.w - 0.8, t.d - 0.6, big ? 3.4 : 1.6).translate(t.cx, t.y, t.cz), slate));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const tx = t.cx + sx * (t.w / 2 - 0.45), tz = t.cz + sz * (t.d / 2 - 0.45);
        R.push(cyl(0.48, 0.48, big ? 3.4 : 1.6, tx, t.y + (big ? 1.7 : 0.8), tz, st, 8), cone(0.56, big ? 2.4 : 1.4, tx, t.y + (big ? 4.6 : 2.3), tz, slate, 8));
        Gd.push(cyl(0.03, 0.05, 0.9, tx, t.y + (big ? 6.2 : 3.4), tz, 0xd9b04a, 4));
      }
      if (big) { R.push(box(1.2, 2, 1.2, t.cx, t.y + 3.4, t.cz, st), cone(0.8, 2.4, t.cx, t.y + 5.6, t.cz, slate, 4)); Gd.push(cyl(0.04, 0.06, 1.2, t.cx, t.y + 7.3, t.cz, 0xd9b04a, 4)); }
      for (let u = -t.w / 2 + 0.9; u < t.w / 2 - 0.8; u += 0.55) for (const sz of [-1, 1]) R.push(box(0.26, 0.4, 0.16, t.cx + u, t.y + 0.2, t.cz + sz * (t.d / 2 - 0.08), st));
      hangOn(T.top, [this.add(R), this.add(Gd, this.gilt)], T.top.floors - 1);
      for (const leg of T.legs) { const lt = topOf(leg); hangOn(leg, [this.add([box(lt.w + 0.1, 0.2, lt.d + 0.1, lt.cx, lt.y - 0.1, lt.cz, 0xc4b694)])]); }
    }
    // the high walkways between the towers: blue lattice girders with white edges, half hung on each tower
    const tn = topOf(tb.n.top), ts = topOf(tb.s.top), wy = tn.y - 2.6, z0 = tn.bz, z1 = ts.az, zm = (z0 + z1) / 2;
    for (const [T, za, zb] of [[tb.n.top, z0, zm], [tb.s.top, zm, z1]]) {
      const W = [], len = zb - za, zc = (za + zb) / 2;
      for (const sx of [-1.6, 1.6]) {
        W.push(box(1.2, 0.18, len, x + sx, wy, zc, blue), box(1.2, 0.18, len, x + sx, wy + 1.3, zc, blue), box(1.25, 0.06, len, x + sx, wy + 1.42, zc, 0xf2f2f2));
        for (let zz = za; zz < zb - 0.3; zz += 0.8) for (const sd of [-0.6, 0.6]) W.push(tint(new THREE.BoxGeometry(0.06, 1.6, 0.08).rotateX(0.55).translate(x + sx + sd, wy + 0.65, zz + 0.4), blue), tint(new THREE.BoxGeometry(0.06, 1.6, 0.08).rotateX(-0.55).translate(x + sx + sd, wy + 0.65, zz + 0.4), blue));
      }
      hangOn(T, [this.add(W, this.metal)], Math.max(0, T.floors - 3));
    }
    // the bascule deck between the towers (blue side girders), and the suspension chains to the abutment towers
    const B = [];
    for (const sx of [-1, 1]) B.push(box(0.24, 0.9, z1 - z0, x + sx * 3.5, -0.2, zm, blue), box(0.26, 0.08, z1 - z0, x + sx * 3.5, 0.28, zm, 0xf2f2f2));
    this.add(B, this.metal);
    const chain = (T, zA, zB, yA, yB) => {
      const C = [];
      for (const sx of [-3.6, 3.6]) {
        const n = 10; let pa = null;
        for (let k = 0; k <= n; k++) {
          const t = k / n, zz = zA + (zB - zA) * t, sag = Math.sin(t * Math.PI) * 2.4, yy = yA + (yB - yA) * t - sag * (t < 0.5 ? 1 : 1) * 0.6 - (1 - Math.abs(t - 0.5) * 2) * 0.2;
          const p2 = new THREE.Vector3(x + sx, yy, zz);
          if (pa) { const d = new THREE.Vector3().subVectors(p2, pa), l = d.length(); const g3 = new THREE.BoxGeometry(0.22, 0.32, l).lookAt(d); g3.translate((pa.x + p2.x) / 2, (pa.y + p2.y) / 2, (pa.z + p2.z) / 2); C.push(tint(g3, blue)); if (k % 2) C.push(box(0.06, Math.max(0.1, yy + 0.1), 0.06, x + sx, yy / 2, zz, 0xd8d8d8)); }
          pa = p2;
        }
      }
      hangOn(T, [this.add(C, this.metal)], T.floors - 1);
    };
    const an = topOf(tb.an.top), as = topOf(tb.as.top);
    chain(tb.n.top, tn.az, an.bz, tn.y - 4, an.y - 0.6); chain(tb.s.top, ts.bz, as.az, ts.y - 4, as.y - 0.6);
  }
  cityHall(c) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(4.4, 28, 18).scale(1, 1.5, 1).translate(c.x, 4.6, c.z), new THREE.MeshStandardMaterial({ color: 0x9ab4c4, roughness: 0.08, metalness: 0.75, envMapIntensity: 1.4 }));
    m.castShadow = true; this.scene.add(m);
    for (let y = 1; y < 10; y += 0.7) { const r = 4.4 * Math.sqrt(Math.max(0, 1 - ((y - 4.6) / 6.6) ** 2)); this.add([tint(new THREE.TorusGeometry(r + 0.02, 0.03, 4, 32).rotateX(Math.PI / 2).translate(c.x, y, c.z), 0x30383e)]); }
  }
  belfast(b) {
    const y = WL, P = [], hull = new THREE.Shape();
    hull.moveTo(-0.9, -6.4); hull.lineTo(0.9, -6.4); hull.lineTo(0.95, 3.4); hull.quadraticCurveTo(0.6, 6.2, 0, 7.2); hull.quadraticCurveTo(-0.6, 6.2, -0.95, 3.4); hull.closePath();
    P.push(tint(new THREE.ExtrudeGeometry(hull, { depth: 1.1, bevelEnabled: false }).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(b.x, y - 0.3, b.z), 0x6a747c));
    P.push(box(13, 0.06, 1.8, b.x - 0.2, y + 0.82, b.z, 0x4a4e52), box(4, 1.2, 1.2, b.x - 1, y + 1.4, b.z, 0x7a848c), box(1.4, 2.2, 0.9, b.x - 1.4, y + 2.4, b.z, 0x6a747c), cyl(0.1, 0.12, 4, b.x - 2.4, y + 3.6, b.z, 0x3a3a3a, 6), cyl(0.1, 0.12, 3.2, b.x + 1.6, y + 3, b.z, 0x3a3a3a, 6), cyl(0.35, 0.35, 1.6, b.x - 0.4, y + 2.6, b.z, 0x5a646c, 10), cyl(0.35, 0.35, 1.4, b.x + 0.8, y + 2.4, b.z, 0x5a646c, 10));
    for (const dx of [-4.4, -3, 3.2, 4.6]) P.push(box(1, 0.5, 0.7, b.x + dx, y + 1.1, b.z, 0x5a646c), box(1.6, 0.12, 0.12, b.x + dx + Math.sign(dx) * 0.9, y + 1.3, b.z, 0x3a3a3a));
    this.add(P);
  }
  downing(d) {
    this.add([box(0.5, 1.1, 0.08, d.x, 0.55, d.z + 0.05, 0x0d0d0f), box(0.14, 0.06, 0.04, d.x, 0.9, d.z + 0.1, 0xd8d8d8), box(0.6, 0.06, 0.4, d.x, 1.15, d.z + 0.2, 0xf2f2f2)]);
    this.sign(0.7, 0.18, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `700 ${h * 0.6}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DOWNING ST', w / 2, h / 2); }, d.x + 1.4, 1.7, d.z + 0.06, 0, 0.2);
  }
  tate(ch) { const t = topOf(ch); hangOn(ch, [this.add([box(t.w + 0.1, 0.4, t.d + 0.1, t.cx, t.y - 0.6, t.cz, 0xd8e8f2)], this.glow)], ch.floors - 1); }
  // ---------- the furniture of a London street ----------
  street(L) {
    const P = [], M2 = [], g = G.ground;
    // Underground entrances: steps going down behind black railings, the roundel up on two lamp posts
    const roundel = (name) => (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = '#dc241f'; c.lineWidth = h * 0.15; c.beginPath(); c.arc(w / 2, h * 0.5, h * 0.34, 0, 6.28); c.stroke();
      c.fillStyle = '#0019a8'; c.fillRect(w * 0.03, h * 0.41, w * 0.94, h * 0.18); c.fillStyle = '#fff'; c.font = `700 ${h * 0.12}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, w / 2, h * 0.505, w * 0.9);
    };
    const board = (name) => (c, w, h) => { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#0019a8'; c.fillRect(w * 0.3, 0, w * 0.4, h); c.fillStyle = '#fff'; c.font = `700 ${h * 0.5}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UNDERGROUND', w / 2, h * 0.55, w * 0.38); c.font = `600 ${h * 0.42}px Arial`; c.fillText('SUBWAY', w * 0.85, h * 0.55); c.fillText('PUBLIC', w * 0.15, h * 0.55); void name; };
    for (const t of L.tube) {
      const ax = Math.abs(t.x - Math.round(t.x / 1) ) >= 0 && (t.f ? 'x' : 'z');
      const dx = ax === 'z' ? 0 : 1.6, dz = ax === 'z' ? 1.6 : 0, ox = t.x + dx * 0.6, oz = t.z + dz * 0.6;
      // the stairwell (painted dark into the pavement, steps in it)
      if (g) { g.rect(ox - (ax === 'z' ? 0.5 : 1.0), oz - (ax === 'z' ? 1.0 : 0.5), ox + (ax === 'z' ? 0.5 : 1.0), oz + (ax === 'z' ? 1.0 : 0.5), '#1c1b19'); for (let k = 0; k < 6; k++) { const s = -0.9 + k * 0.32; if (ax === 'z') g.line(ox - 0.45, oz + s, ox + 0.45, oz + s, 0.05, 'rgba(160,156,148,.6)'); else g.line(ox + s, oz - 0.45, ox + s, oz + 0.45, 0.05, 'rgba(160,156,148,.6)'); } }
      for (const sg of [-1, 1]) {
        if (ax === 'z') { M2.push(box(0.04, 0.55, 2.1, ox + sg * 0.55, 0.28, oz, 0x111111), box(0.06, 0.05, 2.1, ox + sg * 0.55, 0.56, oz, 0x111111)); for (let k = 0; k < 9; k++) M2.push(box(0.025, 0.5, 0.025, ox + sg * 0.55, 0.26, oz - 1 + k * 0.25, 0x111111)); }
        else { M2.push(box(2.1, 0.55, 0.04, ox, 0.28, oz + sg * 0.55, 0x111111), box(2.1, 0.05, 0.06, ox, 0.56, oz + sg * 0.55, 0x111111)); for (let k = 0; k < 9; k++) M2.push(box(0.025, 0.5, 0.025, ox - 1 + k * 0.25, 0.26, oz + sg * 0.55, 0x111111)); }
      }
      // two lamp posts with lanterns, the roundel and the UNDERGROUND bar between them
      const px = ax === 'z' ? 0.62 : 0, pz = ax === 'z' ? 0 : 0.62, bx = ox - (ax === 'z' ? 0 : 1.05), bz = oz - (ax === 'z' ? 1.05 : 0);
      for (const sg of [-1, 1]) M2.push(cyl(0.035, 0.055, 2.2, bx + px * sg, 1.1, bz + pz * sg, 0x161616, 8), box(0.16, 0.22, 0.16, bx + px * sg, 2.3, bz + pz * sg, 0x161616));
      for (const sg of [-1, 1]) P.push(box(0.12, 0.16, 0.12, bx + px * sg, 2.3, bz + pz * sg, 0xffd890));
      this.sign(1.4, 0.18, board(t.n), bx, 1.95, bz, ax === 'z' ? Math.PI / 2 : 0, 0.5, true);
      this.sign(0.8, 0.8, roundel(t.n), bx, 2.5, bz, ax === 'z' ? Math.PI / 2 : 0, 0.7, true);
    }
    this.add(M2, this.metal); this.add(P, this.glow);
    // K6 telephone boxes: red, the domed roof, glazing bars, TELEPHONE under the crown
    const k6 = mergeGeometries([
      tint(new THREE.BoxGeometry(0.62, 0.1, 0.62).translate(0, 0.05, 0), 0xb0101c),
      tint(new THREE.BoxGeometry(0.56, 1.6, 0.56).translate(0, 0.9, 0), 0xc8102e),
      ...[0, 1, 2, 3].map((k) => tint(new THREE.BoxGeometry(0.42, 1.0, 0.02).translate(0, 0.98, 0.285).rotateY(k * Math.PI / 2), 0x30404a)),
      ...[0, 1, 2, 3].flatMap((k) => [0.66, 0.84, 1.02, 1.2].map((y) => tint(new THREE.BoxGeometry(0.42, 0.025, 0.03).translate(0, y, 0.29).rotateY(k * Math.PI / 2), 0xc8102e))),
      ...[0, 1, 2, 3].map((k) => tint(new THREE.BoxGeometry(0.4, 0.1, 0.02).translate(0, 1.6, 0.285).rotateY(k * Math.PI / 2), 0xf4f0e4)),
      tint(new THREE.BoxGeometry(0.66, 0.08, 0.66).translate(0, 1.74, 0), 0xc8102e),
      tint(new THREE.CylinderGeometry(0.33, 0.33, 0.66, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.35, 1).translate(0, 1.78, 0), 0xc8102e),
      tint(new THREE.CylinderGeometry(0.33, 0.33, 0.66, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.35, 1).translate(0, 1.78, 0), 0xc8102e),
      tint(new THREE.BoxGeometry(0.1, 0.06, 0.06).translate(0, 1.9, 0), 0xd9b04a),
    ]);
    const ph = new THREE.InstancedMesh(k6, this.mat, L.phones.length);
    L.phones.forEach((p, k) => { _q.setFromAxisAngle(UP, p.r); _m.compose(_p.set(p.x, 0, p.z), _q, ONE); ph.setMatrixAt(k, _m); });
    ph.castShadow = true; this.scene.add(ph);
    // pillar boxes
    const pb = mergeGeometries([tint(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 14).translate(0, 0.06, 0), 0x111111), tint(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 14).translate(0, 0.52, 0), 0xc8102e), tint(new THREE.CylinderGeometry(0.19, 0.17, 0.08, 14).translate(0, 0.96, 0), 0xc8102e), tint(new THREE.SphereGeometry(0.17, 14, 6, 0, 6.28, 0, Math.PI / 2).translate(0, 1.0, 0), 0xc8102e), tint(new THREE.BoxGeometry(0.16, 0.03, 0.04).translate(0, 0.78, 0.15), 0x111111)]);
    const po = new THREE.InstancedMesh(pb, this.mat, L.posts.length);
    L.posts.forEach((p, k) => { _q.setFromAxisAngle(UP, p.r); _m.compose(_p.set(p.x, 0, p.z), _q, ONE); po.setMatrixAt(k, _m); });
    po.castShadow = true; this.scene.add(po);
    // pubs: the hanging sign on its bracket, a few names shared between them
    const names = ['The Red Lion', 'The Crown', 'The George', 'The Kings Arms', 'The White Hart', 'The Royal Oak', 'The Plough', 'The Swan', 'The Bell', 'The Anchor', 'The Prince Albert', 'The Lamb & Flag'];
    const mats = names.map((nm, k) => { const tex = canvasTex(64, 80, (c, w, h) => { c.fillStyle = ['#123a1e', '#5a1414', '#14243a', '#2a1a0a'][k % 4]; c.fillRect(0, 0, w, h); c.strokeStyle = '#d8b04a'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = '#f2d27a'; c.beginPath(); c.arc(w / 2, h * 0.42, w * 0.26, 0, 6.28); c.fill(); c.font = `700 ${h * 0.11}px Georgia`; c.textAlign = 'center'; c.fillText(nm.replace('The ', ''), w / 2, h * 0.88, w * 0.9); }); const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.2, side: THREE.DoubleSide }); this.signs.push(m); return m; });
    const BR = [];
    for (const pub of L.pubs) {
      const sx = pub.sx, x = pub.x + sx * 0.75, z = pub.z;
      BR.push(box(0.75, 0.04, 0.04, pub.x + sx * 0.38, 2.6, z, 0x1a1a1a));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), pick(mats)); m.position.set(x, 2.15, z); m.rotation.y = 0; this.scene.add(m);
      // hanging baskets by the door
      BR.push(sph(0.16, pub.x + sx * 0.2, 2.0, pub.z + pub.sz * 0.5, 0x4a7a3a));
    }
    if (BR.length) this.add(BR);
  }
  // Union flags: on poles along The Mall and round the squares, on top of buildings everywhere, and bunting over
  // the shopping streets. The cloth ripples in the wind.
  flags(L) {
    const tex = canvasTex(128, 64, ukFlag);
    const cloth = new THREE.PlaneGeometry(1, 0.5, 8, 1).translate(0.5, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
    const tU = (this.flagT = { value: 0 });
    mat.onBeforeCompile = (s) => { s.uniforms.uTime = tU; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
        transformed.z += sin(position.x * 5.0 - uTime * 6.0 + ph) * 0.08 * position.x; transformed.y -= position.x * position.x * 0.06;`); };
    // building-top flags: the tallest buildings in every block, the landmarks
    const B = G.buildings.list.filter((b) => b.floors >= 4 && b.cells.length > 4 && !b.gable && Math.random() < (b.landmark ? 0.55 : 0.18));
    const poles = [...L.flags.map((f) => ({ x: f.x, z: f.z, y: 0, h: f.h, b: null })), ...B.map((b) => { const t = topOf(b); return { x: t.ax + 0.4, z: t.az + 0.4, y: t.y, h: 2.2, b, cell: t.top.reduce((m, c) => (c.x + c.z < m.x + m.z ? c : m), t.top[0]) }; })];
    const pg = new THREE.CylinderGeometry(0.035, 0.045, 1, 6).translate(0, 0.5, 0);
    const poleM = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.5, roughness: 0.4 }), poles.length);
    const flagM = new THREE.InstancedMesh(cloth, mat, poles.length + 400);
    let fi = 0;
    poles.forEach((p, k) => {
      _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(1, p.h, 1)); poleM.setMatrixAt(k, _m);
      _q.setFromAxisAngle(UP, -0.4 + Math.random() * 0.2); _m.compose(_p.set(p.x, p.y + p.h - 0.28, p.z), _q, _s.set(0.9, 0.9, 1)); flagM.setMatrixAt(fi, _m);
      if (p.cell) (p.cell.props ||= []).push({ mesh: poleM, idx: k, x: p.x, y: p.y, z: p.z }, { mesh: flagM, idx: fi, x: p.x, y: p.y, z: p.z });
      fi++;
    });
    // bunting: little flags strung across the street from side to side, every few metres
    for (const s of L.bunting) {
      const vert = s.x != null, a0 = vert ? s.z0 : s.x0, a1 = vert ? s.z1 : s.x1;
      for (let a = a0; a < a1 && fi < poles.length + 400; a += 3.2) for (let u = -2.2; u <= 2.2 && fi < poles.length + 400; u += 0.75) {
        const x = vert ? s.x + u : a, z = vert ? a : s.z + u, y = 4.6 - (1 - (u / 2.4) ** 2) * 0.5;
        _q.setFromAxisAngle(UP, vert ? 0 : Math.PI / 2); _m.compose(_p.set(x, y, z), _q, _s.set(0.36, 0.36, 1)); flagM.setMatrixAt(fi++, _m);
      }
    }
    flagM.count = fi;
    poleM.castShadow = true; this.scene.add(poleM, flagM);
    const lines = [];
    for (const s of L.bunting) { const vert = s.x != null, a0 = vert ? s.z0 : s.x0, a1 = vert ? s.z1 : s.x1; for (let a = a0; a < a1; a += 3.2) lines.push(vert ? box(4.6, 0.015, 0.015, s.x, 4.42, a, 0xdddddd) : box(0.015, 0.015, 4.6, a, 4.42, s.z, 0xdddddd)); }
    if (lines.length) this.add(lines, this.mat, false);
  }
  // chimney stacks along the terraces' ridges, one at every party wall, with their pots
  chimneys(list) {
    const geo = mergeGeometries([tint(new THREE.BoxGeometry(0.34, 0.75, 0.62).translate(0, 0.37, 0), 0xffffff), tint(new THREE.BoxGeometry(0.4, 0.08, 0.68).translate(0, 0.76, 0), 0xdddddd), ...[-0.18, 0, 0.18].map((z) => tint(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6).translate(0, 0.88, z), 0xb0603a))]);
    const items = [];
    for (const b of list) {
      const t = topOf(b), along = b.w >= b.d, len = along ? b.w : b.d, rh = Math.min(b.w, b.d) * 0.42;
      for (let a = -len / 2 + 0.05; a <= len / 2; a += Math.max(2.3, len / Math.max(1, Math.round(len / 2.6)))) {
        const x = along ? b.x + a : b.x, z = along ? b.z : b.z + a;
        let best = null, bd = 1e9; for (const c of t.top) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
        items.push({ x, z, y: t.y + rh * 0.55, r: along ? 0 : Math.PI / 2, cell: best, col: b.tint });
      }
    }
    const im = new THREE.InstancedMesh(geo, this.mat, items.length);
    items.forEach((it, k) => { _q.setFromAxisAngle(UP, it.r); _m.compose(_p.set(it.x, it.y, it.z), _q, ONE); im.setMatrixAt(k, _m); im.setColorAt(k, new THREE.Color(it.col).multiplyScalar(0.85)); (it.cell.props ||= []).push({ mesh: im, idx: k, x: it.x, y: it.y, z: it.z }); });
    im.castShadow = true; this.scene.add(im);
  }
  // tags on the estates' walls
  graffiti(list) {
    const texs = [0, 1, 2].map((k) => canvasTex(256, 96, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) { const t = pick(['SE15', 'SW9', 'OFB', '410', 'ZONE 2', 'BRIXTON', 'PECKHAM', 'SE17', 'NO LACKING', 'BIG SMOKE', 'MASK UP']); c.save(); c.translate(rand(10, w * 0.5), rand(h * 0.4, h * 0.85)); c.rotate(rand(-0.15, 0.1)); c.font = `900 ${rand(26, 40)}px Impact, Arial Black, sans-serif`; c.lineWidth = 5; c.strokeStyle = pick(['#111', '#f2f2f2']); c.strokeText(t, 0, 0); c.fillStyle = pick(['#e02a2a', '#2a7ae0', '#f2c21a', '#2ad07a', '#c03ad0', '#f2f2f2']); c.fillText(t, 0, 0); c.restore(); }
      void k;
    }));
    for (const b of list) {
      const c = b.cells.find((q) => q.f === 0 && q.k === b.nz - 1) || b.cells[0];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(4, b.w * 0.6), 1.2), new THREE.MeshStandardMaterial({ map: pick(texs), transparent: true, alphaTest: 0.1, roughness: 0.9 }));
      m.position.set(b.x + rand(-1, 1), 0.8, b.z + b.d / 2 + 0.03); this.scene.add(m);
      (c.props ||= []).push({ obj: [m], x: c.x, y: c.y, z: c.z });
    }
  }

  // ---------- Thames boats: tour boats, river buses, a police launch, a tug with its barge; more moored up ----------
  boats() {
    const hullShape = (len, beam, bowLen) => { const s = new THREE.Shape(); s.moveTo(-beam / 2, -len / 2); s.lineTo(beam / 2, -len / 2); s.lineTo(beam / 2, len / 2 - bowLen); s.quadraticCurveTo(beam / 2, len / 2 - bowLen * 0.25, 0, len / 2); s.quadraticCurveTo(-beam / 2, len / 2 - bowLen * 0.25, -beam / 2, len / 2 - bowLen); s.closePath(); return s; };
    const hull = (len, beam, bowLen, h, col, y = -0.35) => tint(new THREE.ExtrudeGeometry(hullShape(len, beam, bowLen), { depth: h, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, y, 0), col);
    const people = (P, n, x0, x1, z0, z1, y) => { for (let k = 0; k < n; k++) P.push(sph(0.07, rand(x0, x1), y + 0.08, rand(z0, z1), pick([0x1c1d22, 0xe8e4dc, 0xc8102e, 0x2b3445, 0xf2c230, 0x6b5a45])), box(0.1, 0.16, 0.08, rand(x0, x1), y - 0.04, rand(z0, z1), pick([0x1c1d22, 0x2b3445, 0x8a8f96]))); };
    const kinds = {
      // the sightseeing boat: navy hull, white saloon with its window band, open top deck with seats, blue rails, the wheelhouse forward
      tour: () => { const P = [hull(7.6, 1.9, 1.8, 0.75, 0x1f3f8a), box(1.92, 0.1, 7, 0, 0.42, -0.2, 0xf2f2ee), box(1.7, 0.62, 5.4, 0, 0.76, -0.5, 0xf4f4f2), box(1.72, 0.3, 5.2, 0, 0.8, -0.5, 0x2a3440), box(1.74, 0.06, 5.6, 0, 1.08, -0.5, 0xe8e8e4), box(0.9, 0.5, 0.9, 0, 1.36, 2.1, 0xf4f4f2), box(0.92, 0.22, 0.92, 0, 1.4, 2.1, 0x2a3440)];
        for (const sx of [-0.84, 0.84]) P.push(box(0.04, 0.3, 5.4, sx, 1.24, -0.6, 0x2a5ad0)); P.push(box(1.7, 0.3, 0.04, 0, 1.24, -3.3, 0x2a5ad0));
        for (let z = -3; z < 1.4; z += 0.45) P.push(box(1.4, 0.1, 0.16, 0, 1.15, z, 0x3a4a8a));
        people(P, 22, -0.7, 0.7, -3.1, 1.4, 1.22); P.push(cyl(0.02, 0.02, 0.9, 0, 1.5, -3.4, 0xdddddd, 4)); return P; },
      // the river bus: a low catamaran, a long glazed cabin, raked front
      clipper: () => { const P = [hull(6.6, 0.55, 1.2, 0.55, 0x2a2e34, -0.3), hull(6.6, 0.55, 1.2, 0.55, 0x2a2e34, -0.3).translate(0, 0, 0)];
        P[0].translate(-0.6, 0, 0); P[1].translate(0.6, 0, 0);
        P.push(box(1.8, 0.12, 6, 0, 0.3, -0.2, 0x3a4048), box(1.6, 0.6, 4.6, 0, 0.66, -0.4, 0xd8dce0), box(1.62, 0.32, 4.4, 0, 0.7, -0.4, 0x10161c), tint(new THREE.BoxGeometry(1.5, 0.5, 0.9).rotateX(0.5).translate(0, 0.66, 2.0), 0x10161c), box(1.6, 0.06, 4.6, 0, 0.98, -0.4, 0x2a6ad0));
        people(P, 4, -0.6, 0.6, -2.8, -2.4, 0.42); return P; },
      police: () => { const P = [hull(2.8, 1.0, 0.9, 0.45, 0x1c2a4a), box(1.02, 0.12, 2.4, 0, 0.18, -0.15, 0xf2c21a), box(0.8, 0.5, 1.0, 0, 0.45, -0.2, 0xf2f2f0), box(0.82, 0.2, 0.9, 0, 0.5, -0.2, 0x10161c), box(0.3, 0.08, 0.12, 0, 0.75, -0.2, 0x2a5ad0)]; people(P, 2, -0.3, 0.3, -1.2, -0.9, 0.22); return P; },
      tug: () => { const P = [hull(2.8, 1.1, 0.8, 0.6, 0x1a1a1a), box(1.12, 0.12, 2.5, 0, 0.3, -0.2, 0xb3302a), box(0.8, 0.7, 1.0, 0, 0.6, -0.1, 0xf2f2ee), box(0.82, 0.22, 0.9, 0, 0.72, -0.1, 0x10161c), cyl(0.12, 0.12, 0.6, 0, 1.1, -0.6, 0x1a1a1a, 8), box(1.6, 0.4, 5.4, 0, -0.1, -4.6, 0x5a3a2a), box(1.4, 0.3, 4.6, 0, 0.22, -4.6, 0xd8b030), box(1.4, 0.3, 4.6, 0, 0.22, -4.6, 0xd8b030)];
        for (let z = -6.4; z < -2.9; z += 1.2) P.push(box(1.3, 0.45, 1.1, 0, 0.55, z, pick([0x2a6ad0, 0xc8102e, 0x3a8a4a, 0xd8b030]))); return P; },
      cruiser: () => { const P = [hull(3.6, 1.2, 1.1, 0.5, 0xf2f2f0), box(1.0, 0.4, 1.4, 0, 0.42, -0.4, 0xf2f2f0), box(1.02, 0.18, 1.2, 0, 0.48, -0.4, 0x203040), box(1.2, 0.04, 3.4, 0, 0.16, 0, 0x1f3f8a)]; return P; },
    };
    const geos = Object.fromEntries(Object.entries(kinds).map(([k, f]) => [k, mergeGeometries(f())]));
    // the route: the centreline from upstream (past Vauxhall) round the bend to downstream of Tower Bridge
    const pts = RIVER.C.filter((p) => p.z < 250 && p.x < 280 && !(p.x < -60));
    this.boatPath = new THREE.CatmullRomCurve3(pts);
    this.boatLen = this.boatPath.getLength();
    this.boatList = [];
    const order = ['tour', 'clipper', 'tour', 'police', 'clipper', 'tug', 'tour', 'cruiser', 'clipper', 'tour', 'cruiser', 'tug'];
    order.forEach((k, i) => {
      const m = new THREE.Mesh(geos[k], this.mat); m.castShadow = true; this.scene.add(m);
      const dir = i % 2 ? 1 : -1;
      this.boatList.push({ m, kind: k, u: (i + 0.5) / order.length, dir, v: (k === 'clipper' ? 3.6 : k === 'police' ? 4.2 : k === 'tug' ? 1.6 : 2.2) * rand(0.9, 1.1), lane: 3, ph: rand(0, 6) });
    });
    // moored along the banks away from the bridges: barges and houseboats in clusters, a few tour boats tied up
    const moor = [];
    for (const [x, z, n, ax] of [[-51.6, 54, 5, 'z'], [-51.6, 90, 6, 'z'], [-34.4, 70, 4, 'z'], [-34.4, 104, 5, 'z'], [66, -34.2, 3, 'x'], [12, -15.6, 3, 'x'], [122, -15.8, 4, 'x'], [128, -34.2, 3, 'x']]) {
      for (let k = 0; k < n; k++) {
        const kind = pick(['cruiser', 'cruiser', 'tug', 'tour']), m = new THREE.Mesh(geos[kind], this.mat);
        const off = (k - (n - 1) / 2) * (kind === 'tour' ? 8 : 4.2);
        if (ax === 'z') { m.position.set(x + (k % 2 ? 1.3 : 0), WL, z + off); m.rotation.y = 0; } else { m.position.set(x + off, WL, z + (k % 2 ? 1.3 : 0)); m.rotation.y = Math.PI / 2; }
        if (onBridge(m.position.x, m.position.z) || onBridge(m.position.x + 3, m.position.z) || onBridge(m.position.x - 3, m.position.z) || onBridge(m.position.x, m.position.z + 3) || onBridge(m.position.x, m.position.z - 3)) continue;
        m.castShadow = true; this.scene.add(m); moor.push(m);
      }
    }
    this.moored = moor;
  }
  updateBoats(dt) {
    const t = G.time, U = this.boatU && this.boatU.value; let ui = 0;
    for (const b of this.boatList) {
      if (b.sunk) { if (U && ui < 14) U[ui++].set(0, 0, 0, 0); b.m.position.y -= dt * 0.25; if (b.m.position.y < BED) { b.sunk = false; b.m.rotation.z = 0; b.u = b.dir > 0 ? 0.01 : 0.99; } continue; }
      b.u += b.dir * b.v * dt / this.boatLen;
      if (b.u > 0.995 || b.u < 0.005) { b.dir *= -1; b.u = Math.min(0.995, Math.max(0.005, b.u)); }
      const p = this.boatPath.getPointAt(b.u), q = this.boatPath.getTangentAt(b.u);
      // keep to the right of the channel (as boats do), well inside the bridges' central arches
      const side = b.dir;
      b.m.position.set(p.x - q.z * b.lane * side, WL + Math.sin(t * 1.4 + b.ph) * 0.03, p.z + q.x * b.lane * side);
      b.m.rotation.set(Math.sin(t * 0.9 + b.ph) * 0.015, Math.atan2(q.x * b.dir, q.z * b.dir), Math.sin(t * 1.1 + b.ph) * 0.02);
      if (U && ui < 14) U[ui++].set(b.m.position.x, b.m.position.z, q.x * b.dir * b.v, q.z * b.dir * b.v);
      // the wake: white water off the stern
      if (G.fx && Math.random() < dt * (b.kind === 'clipper' || b.kind === 'police' ? 22 : 10)) {
        const s = b.kind === 'tour' ? 3.8 : b.kind === 'tug' ? 7.6 : 3.2;
        G.fx.bits.emit(b.m.position.x - Math.sin(b.m.rotation.y) * s + rand(-0.4, 0.4), WL + 0.05, b.m.position.z - Math.cos(b.m.rotation.y) * s + rand(-0.4, 0.4), rand(-0.3, 0.3), 0.15, rand(-0.3, 0.3), 0.2, 1.6, 0.92, 0.94, 0.9, 1);
      }
    }
  }

  // ---------- London's own vehicles over the traffic: double-deckers, black cabs, Met police cars, ambulances ----------
  vehiclesInit() {
    const wheels = (P, xs, zs, r = 0.15, w = 0.1) => { for (const x of xs) for (const z of zs) P.push(tint(new THREE.CylinderGeometry(r, r, w, 12).rotateZ(Math.PI / 2).translate(x, r, z), 0x141414), tint(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.01, 10).rotateZ(Math.PI / 2).translate(x, r, z), 0x9a9ea2)); };
    const glass = 0x1a232b, red = 0xc8102e;
    // the double-decker: two decks of glazing, the front windscreen and destination blinds, the black skirt
    const bus = (() => { const L = 4.7, W = 1.04, P = [];
      P.push(box(W, 0.86, L, 0, 0.58, 0, red), box(W, 0.84, L - 0.12, 0, 1.43, -0.06, red), box(W - 0.08, 0.1, L - 0.3, 0, 1.88, -0.06, red), box(W + 0.01, 0.14, L - 0.1, 0, 0.2, 0, 0x151515));
      P.push(box(W + 0.014, 0.34, L - 1.1, 0, 0.76, -0.35, glass), box(W + 0.014, 0.36, L - 0.4, 0, 1.47, -0.1, glass));
      P.push(box(W - 0.1, 0.56, 0.02, 0, 0.68, L / 2 + 0.006, glass), box(W - 0.1, 0.38, 0.02, 0, 1.48, L / 2 - 0.06, glass), box(W - 0.32, 0.13, 0.02, 0, 1.08, L / 2 + 0.008, 0x111111), box(W - 0.4, 0.07, 0.022, 0, 1.08, L / 2 + 0.01, 0xffa21a));
      P.push(box(0.016, 0.66, 0.42, W / 2 + 0.008, 0.52, L / 2 - 0.62, glass), box(0.016, 0.66, 0.42, W / 2 + 0.008, 0.52, -0.1, glass));
      for (const sx of [-0.36, 0.36]) P.push(box(0.14, 0.08, 0.02, sx, 0.34, L / 2 + 0.01, 0xf2f2e8));
      P.push(box(0.9, 0.1, 0.02, 0, 0.32, -L / 2 - 0.006, 0x601010), box(0.6, 0.12, 0.02, 0, 1.74, -L / 2 + 0.06 - 0.006, 0x111111));
      wheels(P, [-0.46, 0.46], [L / 2 - 0.75, -L / 2 + 0.95], 0.2, 0.12); return mergeGeometries(P); })();
    // the black cab (TX4): round-shouldered, upright cabin, chrome grille, round lamps, the TAXI light
    const cab = (() => { const L = 1.92, W = 0.78, P = [];
      P.push(box(W, 0.34, L, 0, 0.3, 0, 0x0c0c0e), tint(new THREE.CylinderGeometry(0.17, 0.17, W, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0.46, L / 2 - 0.2), 0x0c0c0e));
      P.push(box(W - 0.06, 0.06, 0.52, 0, 0.5, L / 2 - 0.3, 0x0c0c0e), box(W - 0.04, 0.32, 1.18, 0, 0.64, -0.2, 0x0c0c0e), box(W - 0.02, 0.2, 1.06, 0, 0.66, -0.22, glass));
      P.push(tint(new THREE.BoxGeometry(W - 0.1, 0.34, 0.03).rotateX(-0.42).translate(0, 0.63, 0.42), glass), box(W - 0.14, 0.05, 1.08, 0, 0.82, -0.2, 0x0c0c0e));
      P.push(box(0.26, 0.07, 0.1, 0, 0.88, 0.3, 0xffb21a), box(0.34, 0.2, 0.02, 0, 0.33, L / 2 + 0.005, 0xc8c8c8));
      for (const sx of [-0.27, 0.27]) P.push(sph(0.07, sx, 0.37, L / 2 - 0.03, 0xf2f2e8, 10, 8), box(0.06, 0.04, 0.02, sx * 1.2, 0.22, L / 2 + 0.01, 0xff9a20));
      P.push(box(W + 0.02, 0.08, 0.06, 0, 0.17, L / 2, 0x222222), box(W + 0.02, 0.08, 0.06, 0, 0.17, -L / 2, 0x222222));
      wheels(P, [-0.36, 0.36], [0.6, -0.62]); return mergeGeometries(P); })();
    // the Met's patrol car: white, the blue-and-yellow Battenburg checks down each side
    const pol = (() => { const L = 1.72, W = 0.72, P = [];
      P.push(box(W, 0.32, L, 0, 0.28, 0, 0xf4f4f2), box(W - 0.06, 0.2, 1.0, 0, 0.53, -0.12, 0xf4f4f2), box(W - 0.04, 0.16, 0.92, 0, 0.53, -0.12, glass), box(W - 0.1, 0.03, 0.96, 0, 0.635, -0.12, 0xf4f4f2));
      for (let k = 0; k < 8; k++) for (const [y, o] of [[0.2, 0], [0.34, 1]]) for (const sx of [-1, 1]) P.push(box(0.008, 0.13, 0.2, sx * (W / 2 + 0.004), y, -0.76 + k * 0.215, (k + o) % 2 ? 0x1f3fa8 : 0xf2e41a));
      P.push(box(W, 0.02, 0.5, 0, 0.445, 0.58, 0xf2e41a), box(0.46, 0.06, 0.12, 0, 0.67, -0.12, 0x101828));
      wheels(P, [-0.33, 0.33], [0.56, -0.55], 0.13, 0.09); return mergeGeometries(P); })();
    // the ambulance: yellow, green-and-yellow checks
    const amb = (() => { const L = 2.1, W = 0.76, P = [];
      P.push(box(W, 0.8, L - 0.5, 0, 0.55, -0.25, 0xf2e41a), box(W, 0.46, 0.5, 0, 0.38, L / 2 - 0.25, 0xf2e41a), tint(new THREE.BoxGeometry(W - 0.06, 0.32, 0.03).rotateX(-0.5).translate(0, 0.66, L / 2 - 0.45), glass));
      for (let k = 0; k < 8; k++) for (const [y, o] of [[0.32, 0], [0.48, 1]]) for (const sx of [-1, 1]) P.push(box(0.008, 0.16, 0.2, sx * (W / 2 + 0.004), y, -0.95 + k * 0.215, (k + o) % 2 ? 0x1e8a3a : 0xf2e41a));
      P.push(box(0.5, 0.06, 0.12, 0, 0.98, 0.4, 0x101828)); wheels(P, [-0.34, 0.34], [0.62, -0.7], 0.14, 0.1); return mergeGeometries(P); })();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35, envMapIntensity: 1.2 });
    this.veh = {};
    for (const [k, geo] of Object.entries({ bus, cab, pol, amb })) { const m = new THREE.InstancedMesh(geo, mat, 160); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(m); this.veh[k] = m; }
    this.bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.07, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), 80); this.bars.count = 0; this.bars.frustumCulled = false; this.scene.add(this.bars);
  }
  updateVehicles() {
    const A = G.agents; if (!A) return;
    const n = { bus: 0, cab: 0, pol: 0, amb: 0 }, flash = Math.floor(G.time * 7) % 2; let nb = 0;
    for (const c of A.cars) {
      if (c.moto) continue;
      const k = c.emerg ? (c.emerg === 'police' ? 'pol' : c.emerg === 'ambulance' ? 'amb' : null) : c.scale[2] > 2 ? 'bus' : c.color.getHex() === 0x101012 ? 'cab' : null;
      if (!k) continue;
      A.carBody.getMatrixAt(c.i, _m);
      const e = _m.elements; if (e[0] === 0 && e[1] === 0 && e[2] === 0) continue;
      _m.decompose(_p, _q, _s); _m2.compose(_p, _q, ONE);
      this.veh[k].setMatrixAt(n[k]++, _m2);
      A.carBody.setMatrixAt(c.i, ZERO); A.carDark.setMatrixAt(c.i, ZERO);
      if (c.emerg && (c.state === 'drive' || c.state === 'onscene') && !c.quiet && nb < 78) for (const s of [-1, 1]) {
        _m.makeTranslation(s * 0.11, k === 'amb' ? 1.03 : 0.72, k === 'amb' ? 0.4 : -0.12); _m.premultiply(_m2); this.bars.setMatrixAt(nb, _m);
        const lit = (flash + (s > 0 ? 1 : 0)) % 2 === 0, col = k === 'pol' ? (s > 0 ? [0.2, 0.4, 6] : [0.3, 0.5, 6]) : [0.3, 0.5, 6];
        this.bars.setColorAt(nb++, _v.set(col[0] * (lit ? 1 : 0.05), col[1] * (lit ? 1 : 0.05), col[2] * (lit ? 1 : 0.05)));
      }
    }
    for (const k in n) { this.veh[k].count = n[k]; this.veh[k].instanceMatrix.needsUpdate = true; }
    this.bars.count = nb; this.bars.instanceMatrix.needsUpdate = true; if (this.bars.instanceColor) this.bars.instanceColor.needsUpdate = true;
    A.carBody.instanceMatrix.needsUpdate = true; A.carDark.instanceMatrix.needsUpdate = true;
  }

  // ---------- mounted police in hi-vis on Whitehall, The Mall, the Embankment and in Brixton; the Household Cavalry ----------
  horsesInit(list) {
    const H = [];
    const E = (sx, sy, sz, x, y, z, c) => tint(new THREE.SphereGeometry(1, 12, 8).scale(sx, sy, sz).translate(x, y, z), c);
    const horse = mergeGeometries([E(0.13, 0.15, 0.32, 0, 0.62, 0, 0xffffff), E(0.12, 0.14, 0.13, 0, 0.62, 0.2, 0xffffff), E(0.13, 0.14, 0.15, 0, 0.64, -0.2, 0xffffff),
      tint(new THREE.CylinderGeometry(0.055, 0.085, 0.34, 8).rotateX(-0.75).translate(0, 0.8, 0.31), 0xffffff), tint(new THREE.BoxGeometry(0.075, 0.09, 0.25).rotateX(0.55).translate(0, 0.93, 0.45), 0xffffff),
      tint(new THREE.BoxGeometry(0.03, 0.2, 0.22).rotateX(-0.75).translate(0, 0.86, 0.27), 0x161210), tint(new THREE.CylinderGeometry(0.035, 0.012, 0.36, 6).rotateX(0.35).translate(0, 0.5, -0.36), 0x161210),
      ...[-0.03, 0.03].map((x) => tint(new THREE.ConeGeometry(0.015, 0.05, 4).translate(x, 1.02, 0.37), 0xffffff)),
      tint(new THREE.BoxGeometry(0.2, 0.04, 0.22).translate(0, 0.78, -0.02), 0x2a1a10), tint(new THREE.BoxGeometry(0.22, 0.12, 0.2).translate(0, 0.72, -0.02), 0x1c1c1e)]);
    const leg = mergeGeometries([tint(new THREE.CylinderGeometry(0.03, 0.022, 0.46, 6).translate(0, -0.23, 0), 0xffffff), tint(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 6).translate(0, -0.47, 0), 0x111111)]);
    const rider = mergeGeometries([tint(new THREE.CylinderGeometry(0.06, 0.055, 0.25, 8).scale(1, 1, 0.7).translate(0, 0.94, -0.02), 0xffffff),
      ...[-1, 1].flatMap((s) => [tint(new THREE.BoxGeometry(0.04, 0.04, 0.2).rotateX(0.3).translate(s * 0.085, 0.8, 0.06), 0x1c1d22), tint(new THREE.BoxGeometry(0.04, 0.2, 0.04).translate(s * 0.11, 0.66, 0.13), 0x111111), tint(new THREE.BoxGeometry(0.03, 0.03, 0.18).rotateX(0.5).translate(s * 0.07, 0.94, 0.08), 0xffffff)])]);
    const head = new THREE.SphereGeometry(0.046, 10, 8).translate(0, 1.11, 0);
    const helmet = mergeGeometries([new THREE.SphereGeometry(0.052, 10, 6, 0, 6.28, 0, Math.PI / 2).translate(0, 1.12, 0), new THREE.BoxGeometry(0.07, 0.01, 0.05).translate(0, 1.12, 0.05)]);
    const plume = new THREE.ConeGeometry(0.03, 0.16, 6).rotateX(Math.PI).translate(0, 1.2, -0.03);
    const mk = (g, n, mat) => { const m = new THREE.InstancedMesh(g, mat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), n); m.castShadow = true; m.frustumCulled = false; this.scene.add(m); return m; };
    for (const h of list) {
      if (h.fixed) H.push({ x: h.x, z: h.z, h: h.h, fixed: true, cav: h.cav, ph: rand(0, 6) });
      else for (let k = 0; k < h.n; k++) H.push({ route: h.route, road: !h.path, u: (k + 0.3) / h.n, dir: k % 2 ? 1 : -1, v: rand(0.7, 0.95), ph: rand(0, 6), x: 0, z: 0, h: 0 });
    }
    const n = H.length;
    this.hz = { list: H, body: mk(horse, n), legs: mk(leg, n * 4), rider: mk(rider, n), head: mk(head, n, new THREE.MeshStandardMaterial({ roughness: 0.8 })), helmet: mk(helmet, n, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 })), plume: mk(plume, n, new THREE.MeshStandardMaterial({ roughness: 0.8 })) };
    const Z = this.hz;
    H.forEach((o, i) => {
      const coat = new THREE.Color(o.cav ? 0x141210 : pick([0x2a1a10, 0x4a2a16, 0x6a3a1a, 0x1c1410, 0x8a7a6a]));
      Z.body.setColorAt(i, coat); for (let k = 0; k < 4; k++) Z.legs.setColorAt(i * 4 + k, coat);
      Z.rider.setColorAt(i, new THREE.Color(o.cav ? (Math.random() < 0.5 ? 0xb3141c : 0x1c2a5a) : 0xd8ea3c));
      Z.head.setColorAt(i, new THREE.Color(pick([0xe8c4a8, 0xc99b78, 0x9a6b4c, 0xf0d6c0])));
      Z.helmet.setColorAt(i, new THREE.Color(o.cav ? 0xd8dce0 : 0x111318));
      Z.plume.setColorAt(i, new THREE.Color(o.cav ? 0xf2f2f2 : 0x000000));
    });
  }
  updateHorses(dt) {
    const Z = this.hz; if (!Z) return;
    const T = G.camTarget, t = G.time;
    Z.list.forEach((o, i) => {
      let moving = false;
      if (o.down != null) {
        if ((o.down -= dt) <= 0) { o.down = null; if (!o.fixed) o.u = Math.random(); }
      } else if (!o.fixed) {
        const [a, b] = o.route, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        o.u += o.dir * o.v * dt / len; if (o.u > 1 || o.u < 0) { o.dir *= -1; o.u = Math.max(0, Math.min(1, o.u)); }
        const dx = (b[0] - a[0]) / len * o.dir, dz = (b[1] - a[1]) / len * o.dir, off = o.road ? 1.9 : 0;
        o.x = a[0] + (b[0] - a[0]) * o.u + dz * off; o.z = a[1] + (b[1] - a[1]) * o.u - dx * off; o.h = Math.atan2(dx, dz); moving = true;
        // hooves on the road when you're close
        if (sfx.ready !== false && Math.hypot(o.x - T.x, o.z - T.z) < 22 && (o.step = (o.step || 0) - dt) <= 0) { o.step = 0.27; this.hoof(o.x, o.z); }
      }
      const cyc = t * 5.2 + o.ph, bob = moving ? Math.abs(Math.sin(cyc)) * 0.012 : 0;
      _q.setFromAxisAngle(UP, o.h);
      if (o.down != null) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      _m.compose(_p.set(o.x, (o.down != null ? 0.15 : 0) + bob, o.z), _q, ONE);
      for (const k of ['body', 'rider', 'head', 'helmet', 'plume']) Z[k].setMatrixAt(i, _m);
      [[0.07, 0.22, 0], [-0.07, 0.22, Math.PI], [0.07, -0.22, Math.PI], [-0.07, -0.22, 0]].forEach(([lx, lz, ph], k) => {
        const sw = moving ? Math.sin(cyc + ph) * 0.42 : (o.fixed ? 0 : 0);
        _m2.makeRotationX(sw); _m2.setPosition(lx, 0.52, lz); Z.legs.setMatrixAt(i * 4 + k, _m3.multiplyMatrices(_m, _m2));
      });
    });
    for (const k of ['body', 'legs', 'rider', 'head', 'helmet', 'plume']) Z[k].instanceMatrix.needsUpdate = true;
  }
  hoof(x, z) {
    const I = sfx._internals && sfx._internals(); if (!I || !I.ctx) return;
    const ch = I.chain(x, z, { vol: 0.22, bus: I.ambBus }); I.burst(ch.input, I.ctx.currentTime, { f: rand(1500, 2300), q: 6, a: 0.001, peak: 0.22, d: 0.045 });
  }

  // ---------- e-scooters and bikes: riders along the pavements, delivery riders, scooters dumped everywhere ----------
  wheelsInit() {
    const C = this.city, L = this.L;
    const scooter = mergeGeometries([tint(new THREE.BoxGeometry(0.1, 0.03, 0.46).translate(0, 0.07, 0), 0xffffff), tint(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6).rotateX(0.18).translate(0, 0.38, 0.22), 0xffffff), tint(new THREE.BoxGeometry(0.26, 0.022, 0.022).translate(0, 0.68, 0.27), 0x111111),
      ...[0.21, -0.2].map((z) => tint(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10).rotateZ(Math.PI / 2).translate(0, 0.055, z), 0x111111))]);
    const standing = mergeGeometries([tint(new THREE.CylinderGeometry(0.064, 0.056, 0.24, 8).scale(1, 1, 0.65).translate(0, 0.66, 0.02), 0xffffff),
      tint(new THREE.CylinderGeometry(0.026, 0.02, 0.33, 6).translate(0.035, 0.26, 0.06), 0x1c1d22), tint(new THREE.CylinderGeometry(0.026, 0.02, 0.33, 6).translate(-0.035, 0.26, -0.06), 0x1c1d22),
      ...[-1, 1].map((s) => tint(new THREE.CylinderGeometry(0.018, 0.014, 0.26, 5).rotateX(1.0).translate(s * 0.09, 0.66, 0.14), 0xffffff))]);
    const shead = mergeGeometries([new THREE.SphereGeometry(0.047, 10, 8).translate(0, 0.84, 0.03)]);
    const bike = mergeGeometries([...[0.25, -0.25].map((z) => tint(new THREE.TorusGeometry(0.13, 0.016, 6, 18).rotateY(Math.PI / 2).translate(0, 0.13, z), 0x111111)),
      tint(new THREE.BoxGeometry(0.025, 0.025, 0.46).rotateX(-0.12).translate(0, 0.3, 0), 0xffffff), tint(new THREE.BoxGeometry(0.025, 0.26, 0.025).rotateX(0.2).translate(0, 0.27, -0.09), 0xffffff), tint(new THREE.BoxGeometry(0.025, 0.25, 0.025).rotateX(-0.25).translate(0, 0.29, 0.2), 0xffffff),
      tint(new THREE.BoxGeometry(0.24, 0.02, 0.02).translate(0, 0.43, 0.22), 0x111111), tint(new THREE.BoxGeometry(0.06, 0.02, 0.12).translate(0, 0.41, -0.1), 0x111111)]);
    const cyclist = mergeGeometries([tint(new THREE.CylinderGeometry(0.06, 0.054, 0.24, 8).scale(1, 1, 0.65).rotateX(0.5).translate(0, 0.56, -0.03), 0xffffff), ...[-1, 1].map((s) => tint(new THREE.CylinderGeometry(0.017, 0.013, 0.26, 5).rotateX(1.05).translate(s * 0.08, 0.53, 0.12), 0xffffff))]);
    const chead = new THREE.SphereGeometry(0.047, 10, 8).translate(0, 0.72, 0.08);
    const leg = new THREE.CylinderGeometry(0.024, 0.018, 0.3, 5).translate(0, -0.15, 0);
    const bag = mergeGeometries([new THREE.BoxGeometry(0.17, 0.17, 0.12).translate(0, 0.66, -0.13)]);
    const M = (g, n, opts = {}) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: !!opts.vc, roughness: 0.6, ...opts.m }), n); m.castShadow = true; m.frustumCulled = false; this.scene.add(m); return m; };
    const NS = 46, NB = 36, BRAND = [0x63c132, 0x63c132, 0xe6302f, 0x1f9ad6, 0xf26a1a, 0x1c1d22];
    const W = (this.wh = { sc: M(scooter, NS + L.scooters.length, { vc: true }), sr: M(standing, NS, { vc: true }), sh: M(shead, NS), bk: M(bike, NB, { vc: true }), br: M(cyclist, NB, { vc: true }), bh: M(chead, NB), legs: M(leg, NB * 2), bag: M(bag, NB), list: [] });
    const JACK = [0x111214, 0x1c1d22, 0x2b3445, 0x34373d, 0x4a4d52, 0x6b5a45, 0xd8ea3c, 0x1f2a44], SK = [0xe8c4a8, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0];
    const nodes = C.pedNodes.filter((n) => n.edges.length && !C.pedBlocked(n.x, n.z));
    for (let k = 0; k < NS + NB; k++) {
      const bikeK = k >= NS, i = bikeK ? k - NS : k, n = pick(nodes), e = pick(n.edges);
      const o = { bike: bikeK, i, from: n.id, to: e.to, x: n.x, z: n.z, h: 0, v: bikeK ? rand(2.2, 3) : rand(1.8, 2.4), ph: rand(0, 6), deliv: bikeK && Math.random() < 0.35 };
      W.list.push(o);
      if (bikeK) { W.bk.setColorAt(i, new THREE.Color(pick([0x1c1d22, 0xc8102e, 0x2a6ad8, 0xe8e8e4, 0x3a8a4a, 0x8a8f96]))); W.br.setColorAt(i, new THREE.Color(o.deliv ? 0x00ccbc : pick(JACK))); W.bh.setColorAt(i, new THREE.Color(pick(SK))); W.legs.setColorAt(i * 2, new THREE.Color(0x1c1d22)); W.legs.setColorAt(i * 2 + 1, new THREE.Color(0x1c1d22)); W.bag.setColorAt(i, new THREE.Color(0x00ccbc)); }
      else { W.sc.setColorAt(i, new THREE.Color(pick(BRAND))); W.sr.setColorAt(i, new THREE.Color(pick(JACK))); W.sh.setColorAt(i, new THREE.Color(pick(SK))); }
    }
    // the dumped ones (standing on their stands, or knocked over), after the ridden ones in the same mesh
    L.scooters.forEach((s, k) => {
      const i = NS + k; _q.setFromEuler(_e.set(0, s.r, s.lie ? Math.PI / 2 : 0.12));
      _m.compose(_p.set(s.x, s.lie ? 0.05 : 0, s.z), _q, ONE); W.sc.setMatrixAt(i, _m); W.sc.setColorAt(i, new THREE.Color(pick(BRAND)));
    });
    for (let i = 0; i < NB; i++) if (!W.list[NS + i].deliv) W.bag.setMatrixAt(i, ZERO);
  }
  updateWheels(dt) {
    const W = this.wh; if (!W) return;
    const C = this.city, t = G.time;
    for (const o of W.list) {
      if (o.down != null) {
        o.down -= dt;
        if (o.down <= 0) { const n = pick(C.pedNodes.filter((m) => m.edges.length && !C.pedBlocked(m.x, m.z) && Math.hypot(m.x - G.camTarget.x, m.z - G.camTarget.z) > 40)); if (n) { o.down = null; o.x = n.x; o.z = n.z; o.from = n.id; o.to = n.edges[0].to; } }
      } else {
        const b = C.pedNodes[o.to], a = C.pedNodes[o.from], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
        const tx = b.x + dz / l * 0.35, tz = b.z - dx / l * 0.35, ex = tx - o.x, ez = tz - o.z, d = Math.hypot(ex, ez);
        if (d < 0.25) {
          const opts = b.edges.filter((e) => e.to !== o.from && !C.pedBlocked(C.pedNodes[e.to].x, C.pedNodes[e.to].z));
          const e = pick(opts.length ? opts : b.edges); o.from = o.to; o.to = e.to;
        } else {
          const want = Math.atan2(ex, ez); o.h += Math.atan2(Math.sin(want - o.h), Math.cos(want - o.h)) * Math.min(1, dt * 6);
          o.x += Math.sin(o.h) * o.v * dt; o.z += Math.cos(o.h) * o.v * dt;
        }
      }
      const lean = o.down != null ? Math.PI / 2 : 0;
      _q.setFromEuler(_e.set(0, o.h, lean, 'YXZ')); _m.compose(_p.set(o.x, o.down != null ? 0.06 : 0, o.z), _q, ONE);
      if (o.bike) {
        W.bk.setMatrixAt(o.i, _m);
        const ride = o.down == null ? _m : ZERO;
        W.br.setMatrixAt(o.i, ride); W.bh.setMatrixAt(o.i, ride); if (o.deliv) W.bag.setMatrixAt(o.i, ride);
        const cyc = t * o.v * 3.2 + o.ph;
        for (const s of [0, 1]) { if (o.down != null) { W.legs.setMatrixAt(o.i * 2 + s, ZERO); continue; } _m2.makeRotationX(-0.6 + Math.sin(cyc + s * Math.PI) * 0.55); _m2.setPosition(s ? 0.05 : -0.05, 0.46, -0.08); W.legs.setMatrixAt(o.i * 2 + s, _m3.multiplyMatrices(_m, _m2)); }
      } else {
        W.sc.setMatrixAt(o.i, _m);
        const ride = o.down == null ? _m : ZERO; W.sr.setMatrixAt(o.i, ride); W.sh.setMatrixAt(o.i, ride);
      }
    }
    for (const k of ['sc', 'sr', 'sh', 'bk', 'br', 'bh', 'legs', 'bag']) W[k].instanceMatrix.needsUpdate = true;
  }

  // ---------- London beyond the map: street after street of brick terraces, stucco rows, mansion blocks and council
  // estates (a few tower blocks among them), with Hyde Park, Regent's Park, Greenwich and the woods further out.
  // No skyscrapers out here: the only towers are in the City and at London Bridge. ----------
  world(scene) {
    const r = rnd(1666), R = (a, b) => a + r() * (b - a), SIZE = 3200, S = 2048, k = S / SIZE;
    const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), P = (v) => (v + SIZE / 2) * k;
    x.fillStyle = '#6c675c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 26000; i++) { x.fillStyle = ['#7a5a48', '#6a5e52', '#5a5650', '#6a7a4a', '#5e6e44', '#80766a'][(r() * 6) | 0]; x.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5); }
    const g = G.ground;
    const GREEN = [[-330, -64, 150, 66, 'park'], [-165, -382, 92, 82, 'park'], [-270, -800, 270, 190, 'wood'], [-235, 445, 74, 46, 'park'], [-120, 650, 120, 80, 'park'], [565, 330, 112, 82, 'park'], [420, -262, 112, 62, 'park'],
      [128, 268, 58, 40, 'park'], [170, 640, 210, 150, 'wood'], [-1100, 700, 320, 230, 'wood'], [920, -900, 360, 260, 'wood'], [-620, 1010, 260, 160, 'wood'], [660, 560, 100, 62, 'park'], [-560, -420, 140, 90, 'park'], [1150, 420, 260, 200, 'wood'], [-1250, -380, 260, 220, 'wood']];
    const inGreen = (px, pz) => GREEN.find(([gx, gz, rx, rz]) => ((px - gx) / rx) ** 2 + ((pz - gz) / rz) ** 2 < 1);
    const inGrid = (px, pz) => px > -112.5 && px < 137.5 && pz > -98.5 && pz < 116.5;
    const inPalace = (px, pz) => px > -151 && px < -112 && pz > -113 && pz < 21;
    const xL = [...XS], zL = [...ZS];
    for (let v = 135 + R(24, 30); v < 1600; v += R(24, 32)) xL.push(v);
    for (let v = -150; v > -1600; v -= R(24, 32)) xL.push(v);
    for (let v = 114 + R(22, 28); v < 1600; v += R(22, 30)) zL.push(v);
    for (let v = -96 - R(22, 28); v > -1600; v -= R(22, 30)) zL.push(v);
    xL.sort((a, b) => a - b); zL.sort((a, b) => a - b);
    const bodies = [], roofs = [], chims = [], trees = [];
    const near = (px, pz, pad = 3) => RIVER.near(px, pz, pad);
    const road = (x0, z0, x1, z1) => { x.fillStyle = '#4a4b4d'; x.fillRect(P(x0), P(z0), (x1 - x0) * k + 0.6, (z1 - z0) * k + 0.6); if (g && (Math.abs(x0) < 205 || Math.abs(x1) < 205) && (Math.abs(z0) < 205 || Math.abs(z1) < 205)) g.rect(x0, z0, x1, z1, '#4a4b4d'); };
    const paint = (x0, z0, x1, z1, col) => { x.fillStyle = col; x.fillRect(P(x0), P(z0), (x1 - x0) * k + 0.4, (z1 - z0) * k + 0.4); if (g && Math.max(Math.abs(x0), Math.abs(x1), Math.abs(z0), Math.abs(z1)) < 260) g.rect(x0, z0, x1, z1, col); };
    const BR = () => { const q = r(); return q < 0.42 ? hsl(0.02 + r() * 0.04, 0.38 + r() * 0.14, 0.38 + r() * 0.08) : q < 0.75 ? hsl(0.08 + r() * 0.04, 0.2 + r() * 0.12, 0.5 + r() * 0.12) : q < 0.88 ? hsl(0.1, 0.05, 0.82 + r() * 0.1) : hsl(0.07, 0.08, 0.58 + r() * 0.08); };
    // one row of houses along local x, centred at (cx, cz), turned rot (0 or pi/2), split into terraces with alleys
    const row = (cx, cz, len, depth, rot, kind, dist) => {
      let a = -len / 2;
      while (a < len / 2 - 2) {
        const seg = Math.min(len / 2 - a, R(12, 32)), mid = a + seg / 2, ca = Math.cos(rot), sa = Math.sin(rot);
        const wx = cx + mid * ca, wz = cz - mid * sa;
        if (!near(wx, wz, depth) && !near(cx + (a) * ca, cz - a * sa, 2) && !near(cx + (a + seg) * ca, cz - (a + seg) * sa, 2) && !inGrid(wx, wz) && !inPalace(wx, wz)) {
          const floors = kind === 0 ? (r() < 0.62 ? 2 : 3) : kind === 1 ? 4 + ((r() * 2) | 0) : kind === 2 ? 5 + ((r() * 2) | 0) : 4 + ((r() * 4) | 0);
          const h = floors * 1.05 + 0.25, col = kind === 1 ? hsl(0.1, 0.08, 0.86 + r() * 0.08) : kind === 2 ? hsl(0.02 + r() * 0.03, 0.42, 0.4) : kind === 3 ? (r() < 0.5 ? hsl(0.1, 0.05, 0.62 + r() * 0.1) : hsl(0.05, 0.3, 0.42)) : BR();
          bodies.push([wx, wz, seg - 0.5, h, depth, rot, kind, col]);
          if (kind === 0) {
            roofs.push([wx, h, wz, seg - 0.3, depth + 0.3, depth * 0.42, rot, r() < 0.72 ? hsl(0.6, 0.06, 0.28 + r() * 0.06) : hsl(0.03, 0.38, 0.34 + r() * 0.06)]);
            if (dist < 520) for (let u = -seg / 2 + 1.2; u < seg / 2 - 0.5; u += 2.4) chims.push([wx + u * ca, h + depth * 0.25, wz - u * sa, rot, col]);
          }
        }
        a += seg + (r() < 0.5 ? 0.9 : 0.4);
      }
    };
    for (let i = 0; i + 1 < xL.length; i++) for (let j = 0; j + 1 < zL.length; j++) {
      const a = xL[i], b = xL[i + 1], cA = zL[j], cB = zL[j + 1], cx = (a + b) / 2, cz = (cA + cB) / 2, dist = Math.hypot(cx, cz);
      if (inGrid(cx, cz) || inPalace(cx, cz) || dist > 1400) continue;
      const gr = inGreen(cx, cz);
      if (gr) {
        paint(a - 2.6, cA - 2.6, b + 2.6, cB + 2.6, gr[4] === 'wood' ? '#3f5a32' : '#5b7840');
        const n = Math.round((b - a) * (cB - cA) / (gr[4] === 'wood' ? 34 : 120));
        for (let t = 0; t < n; t++) { const tx = R(a, b), tz = R(cA, cB); if (!near(tx, tz, 2)) trees.push([tx, tz, gr[4] === 'wood' ? R(1.8, 3.2) : R(1.6, 2.8)]); }
        continue;
      }
      if (near(cx, cz, -6)) continue;
      road(a - 2.5, cA - 2.5, b + 2.5, cA + 2.5); road(a - 2.5, cB - 2.5, b + 2.5, cB + 2.5); road(a - 2.5, cA, a + 2.5, cB); road(b - 2.5, cA, b + 2.5, cB);
      const x0 = a + 3.3, x1 = b - 3.3, z0 = cA + 3.3, z1 = cB - 3.3;
      if (x1 - x0 < 6 || z1 - z0 < 6) continue;
      paint(a + 2.5, cA + 2.5, b - 2.5, cB - 2.5, '#a8a398'); paint(x0, z0, x1, z1, '#5d6a44');
      // what kind of street: Georgian stucco in the west, mansion blocks near the centre, estates mostly south and east
      const q = r(), estateP = 0.05 + (cz > 100 || cx > 150 ? 0.06 : 0);
      if (q < estateP) {
        paint(x0, z0, x1, z1, '#76726a');
        const tw = Math.min(8, (x1 - x0) * 0.4);
        bodies.push([x0 + tw / 2 + 1, (z0 + z1) / 2, tw, Math.round(R(12, 20)) * 1.05 + 0.2, tw, 0, 3, hsl(0.1, 0.04, 0.6 + r() * 0.12)]);
        if (x1 - x0 > tw + 10) row((x0 + tw + 2 + x1) / 2, z0 + 3, x1 - x0 - tw - 3, 5, 0, 3, dist), row((x0 + tw + 2 + x1) / 2, z1 - 3, x1 - x0 - tw - 3, 5, 0, 3, dist);
        for (let t = 0; t < 4; t++) trees.push([R(x0 + tw + 2, x1), (z0 + z1) / 2 + R(-1.5, 1.5), R(0.9, 1.3)]);
        continue;
      }
      const kind = cx < -60 && dist < 650 && r() < 0.45 ? 1 : dist < 520 && r() < 0.32 ? 2 : r() < 0.08 ? 3 : 0;
      const depth = kind === 0 ? R(4.2, 5) : kind === 1 ? 5.4 : kind === 2 ? 6.4 : 5.4;
      const alongX = x1 - x0 >= z1 - z0, len = alongX ? x1 - x0 : z1 - z0, wid = alongX ? z1 - z0 : x1 - x0;
      const rot = alongX ? 0 : Math.PI / 2, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const at = (o) => (alongX ? [mx, z0 + o] : [x0 + o, mz]);
      if (wid < depth * 2 + 1.5) { const [px, pz] = at(wid / 2); row(px, pz, len, Math.min(depth, wid - 0.5), rot, kind, dist); }
      else {
        const [fx, fz] = at(depth / 2), [bx, bz] = at(wid - depth / 2); row(fx, fz, len, depth, rot, kind, dist); row(bx, bz, len, depth, rot, kind, dist);
        // a mews or a middle row in the deep blocks; otherwise long back gardens with a tree or two
        if (wid > depth * 3 + 4) { const [m1, m2] = at(wid / 2); row(m1, m2, len - 4, depth, rot, kind === 1 ? 0 : kind, dist); }
        else for (let t = 0; t < len / 9; t++) { const o = R(-len / 2, len / 2), [px, pz] = at(wid / 2 + R(-1, 1)); trees.push(alongX ? [px + o, pz, R(0.8, 1.3)] : [px, pz + o, R(0.8, 1.3)]); }
      }
    }
    // the river through it all, cut out of the ground (and out of the map's own ground again over the new streets)
    const punch = (ctx, tf) => { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000'; ctx.beginPath(); RIVER.L.forEach((v, i) => (i ? ctx.lineTo(tf(v.x), tf(v.z)) : ctx.moveTo(tf(v.x), tf(v.z)))); for (let i = RIVER.R.length - 1; i >= 0; i--) ctx.lineTo(tf(RIVER.R[i].x), tf(RIVER.R[i].z)); ctx.closePath(); ctx.fill(); ctx.restore(); };
    punch(x, P); if (g) { punch(g.x, (v) => g.px(v)); g.tex.needsUpdate = true; }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, alphaTest: 0.5 }));
    ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    // the houses: one box per terrace, its facades drawn by a little shader from an atlas (a window bay per house, a
    // door storey at the bottom), lit windows at night
    const atlas = bgAtlas(), N = bodies.length;
    const bmat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    bmat.defines = { USE_UV: '' };
    const nightU = (G.nightU ||= { value: 0 });
    bmat.onBeforeCompile = (s) => {
      s.uniforms.atlas = { value: atlas.map }; s.uniforms.maskA = { value: atlas.mask }; s.uniforms.uNight = nightU;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aKind; varying vec2 vT; varying float vK; varying float vS; varying float vId;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          float bw = aKind < 0.5 ? 2.4 : aKind < 1.5 ? 2.8 : aKind < 2.5 ? 3.0 : 2.4;
          float sd = abs(normal.x) > 0.5 ? 1.0 : 0.0, tp = abs(normal.y) > 0.5 ? 1.0 : 0.0;
          float al = sd > 0.5 ? sc.z : sc.x;
          vT = vec2(uv.x * max(1.0, floor(al / bw + 0.5)), uv.y * max(1.0, floor(sc.y / 1.05)));
          vK = aKind; vS = sd + tp * 2.0; vId = float(gl_InstanceID);`);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D atlas; uniform sampler2D maskA; uniform float uNight; varying vec2 vT; varying float vK; varying float vS; varying float vId; float wWin;')
        .replace('#include <color_fragment>', `
          vec2 f = fract(vT); float fl = floor(vT.y), row = floor(vK + 0.5);
          vec2 auv = vec2((fl < 0.5 ? 0.5 : 0.0) + 0.004 + f.x * 0.492, 1.0 - (row + 1.0) * 0.25 + 0.004 + f.y * 0.242);
          if (vS > 0.5 && vS < 1.5 && row < 1.5) auv.x = 0.02;
          vec3 tc = texture2D(atlas, auv).rgb;
          wWin = vS > 1.5 ? 0.0 : texture2D(maskA, auv).r * ((vS > 0.5 && row < 1.5) ? 0.0 : 1.0);
          diffuseColor.rgb = vS > 1.5 ? vec3(0.2, 0.195, 0.19) : mix(tc * vColor, tc, wWin);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float wid = floor(vT.x) * 7.0 + floor(vT.y) * 13.0 + vId * 3.17;
          float lit = step(0.7, fract(sin(wid * 12.9898) * 43758.5453));
          totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * wWin * lit * uNight * 1.2;`);
    };
    const bgeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const kinds = new Float32Array(N); bodies.forEach((b, i) => { kinds[i] = b[6]; });
    bgeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    const bm = new THREE.InstancedMesh(bgeo, bmat, N);
    const col = new THREE.Color();
    bodies.forEach(([bx, bz, w, h, d, rot, , cc], i) => { _q.setFromAxisAngle(UP, rot); _m.compose(_p.set(bx, 0, bz), _q, _s.set(w, h, d)); bm.setMatrixAt(i, _m); bm.setColorAt(i, col.copy(cc)); });
    bm.receiveShadow = true; scene.add(bm);
    // pitched slate (or tile) roofs on the terraces
    const rgeo = (() => { const p = [], uv = []; const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5], E = [-0.5, 1, 0], F = [0.5, 1, 0]; for (const t of [[A, E, F], [A, F, B], [D, C, F], [D, F, E], [A, D, E], [B, F, C]]) for (const v of t) { p.push(...v); uv.push(v[0] * 4, v[1] * 3 + Math.abs(v[2]) * 3); } const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); q.computeVertexNormals(); return q; })();
    const sh = makeShingles(); sh.wrapS = sh.wrapT = THREE.RepeatWrapping;
    const rm = new THREE.InstancedMesh(rgeo, new THREE.MeshStandardMaterial({ map: sh, roughness: 0.9 }), roofs.length);
    roofs.forEach(([rx, ry, rz, len, d, h, rot, cc], i) => { _q.setFromAxisAngle(UP, rot); _m.compose(_p.set(rx, ry, rz), _q, _s.set(len, h, d)); rm.setMatrixAt(i, _m); rm.setColorAt(i, cc); });
    scene.add(rm);
    const cg = mergeGeometries([new THREE.BoxGeometry(0.4, 1.1, 0.7).translate(0, 0.55, 0), ...[-0.2, 0.2].map((zz) => new THREE.CylinderGeometry(0.06, 0.07, 0.24, 6).translate(0, 1.2, zz))]);
    const cm = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: 0.9 }), chims.length);
    chims.forEach(([cx2, cy, cz2, rot, cc], i) => { _q.setFromAxisAngle(UP, rot + Math.PI / 2); _m.compose(_p.set(cx2, cy, cz2), _q, ONE); cm.setMatrixAt(i, _m); cm.setColorAt(i, col.copy(cc).multiplyScalar(0.85)); });
    scene.add(cm);
    // the trees: plane trees in the gardens and squares, woods further out
    const tg = mergeGeometries([tint(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.85, 1).translate(0, 1.7, 0), 0xffffff), tint(new THREE.CylinderGeometry(0.08, 0.12, 1.1, 5).translate(0, 0.55, 0), 0x5a4a3a)]);
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), trees.length);
    trees.forEach(([tx, tz, s], i) => { _q.setFromAxisAngle(UP, r() * 6); _m.compose(_p.set(tx, 0, tz), _q, _s.set(s, s * R(0.85, 1.2), s)); tm.setMatrixAt(i, _m); tm.setColorAt(i, col.setHSL(R(0.22, 0.3), R(0.3, 0.45), R(0.2, 0.3), THREE.SRGBColorSpace)); });
    scene.add(tm);
    this.bgCount = { bodies: N, roofs: roofs.length, chims: chims.length, trees: trees.length };
  }

  // ---------- the King's Guard: sentries in their boxes, and every few minutes the guard marches down The Mall to Horse
  // Guards and back while the band plays God Save the King at the palace ----------
  guardsInit() {
    const R0 = G.roles; if (!R0 || !R0.hire) return;
    this.guards = [];
    const M = this.L.march, home = { x: -129, z: -46 };
    for (let k = 0; k < 14; k++) {
      const p = R0.hire('GUARD', home, (q) => this.guardPlan(q, k), {});
      if (!p) break;
      p.speed = 0.85; p.hidden = true; p.pos.set(home.x, 0, home.z);
      this.guards.push(p);
    }
    void M;
  }
  guardPlan(p, k) {
    const m = this.march;
    if (!m || p.marchId === m.id) return [{ do: 'hide', t: 3 }];
    p.marchId = m.id;
    const path = this.L.march.path, row = Math.floor(k / 2), lat = k % 2 ? 0.32 : -0.32;
    const pts = path.map(([x, z], i) => { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + (i ? 0 : 1))], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return { x: x + dz / l * lat, z: z - dx / l * lat }; });
    const back = [...pts].reverse();
    const steps = [{ do: 'call', fn: (q) => { q.pos.set(pts[0].x, 0, pts[0].z); q.hidden = false; q.heading = Math.PI / 2; } }, { do: 'act', pose: 'attention', t: 0.2 + row * 0.95 }];
    for (const q of pts.slice(1)) steps.push({ do: 'go', x: q.x, z: q.z });
    steps.push({ do: 'act', pose: 'attention', t: 26 - row * 0.95, face: { x: -70, z: pts[pts.length - 1].z } }, { do: 'act', pose: 'attention', t: row * 0.95 });
    for (const q of back.slice(1)) steps.push({ do: 'go', x: q.x, z: q.z });
    steps.push({ do: 'go', x: -126, z: -46 + lat * 2 }, { do: 'hide', t: 2 });
    return steps;
  }
  updateMarch(dt) {
    if (!this.guards) { if (G.roles) this.guardsInit(); return; }
    if (this.march && G.time - this.march.t0 > 150) this.march = null;
    if (!this.march && (this.marchT -= dt) <= 0) {
      this.marchT = rand(200, 300);
      this.march = { id: (this.march?.id || 0) + Math.random(), t0: G.time };
      for (const p of this.guards) if (p.state === 'job' && p.job) { p.job.steps = []; p.job.k = 0; }
      const a = this.L.march.anthem;
      sfx.once && sfx.once('anthem', a.x, a.z, 0.95);
      G.news && G.news.flash && G.news.flash('Changing of the Guard at Buckingham Palace');
    }
  }

  // ---------- a knife fight between two crews of roadmen (London has no guns on the street: only the police and the army) ----------
  knifeFight(x, z) {
    const A = G.agents, RL = G.roles; if (!A) return false;
    const crew = (cx, cz) => {
      const out = A.peds.filter((p) => p.roadman && ['idle', 'wander', 'walk'].includes(p.state) && Math.hypot(p.pos.x - cx, p.pos.z - cz) < 14).slice(0, 4);
      while (out.length < 4) { const p = A.borrowPed({ x: cx, z: cz }, 0); if (!p) break; p.pos.set(cx + rand(-1.5, 1.5), 0, cz + rand(-1.5, 1.5)); this.dressRoadman(p); out.push(p); }
      return out;
    };
    const a = crew(x - 3, z), b = crew(x + 3, z);
    if (!a.length || !b.length) return false;
    const fighters = [...a, ...b], hurt = [], id = Math.random();
    for (const p of fighters) {
      const foes = a.includes(p) ? b : a, foe = pick(foes);
      p.zone = null; p.group = null; p.roadman = true;
      if (RL && RL.hire) {
        RL.hire('ROADMAN', { x: p.pos.x, z: p.pos.z }, () => {
          if (p.fightId === id) return [{ do: 'call', fn: (q) => { RL.release(q); this.dressRoadman(q); q.state = 'flee'; q.timer = rand(8, 14); q.threat = { x, z }; } }];
          p.fightId = id;
          return [{ do: 'go', x: foe.pos.x + rand(-0.4, 0.4), z: foe.pos.z + rand(-0.4, 0.4), run: true }, { do: 'call', fn: (q) => { q.acc && (q.acc.tool = 'knife'); } }, { do: 'act', pose: 'stab', t: rand(1.6, 2.6), face: foe.pos },
            { do: 'call', fn: (q) => { if (Math.random() < 0.5 && foe.state !== 'down' && !hurt.includes(foe)) { hurt.push(foe); this.stab(q, foe); } q.acc && (q.acc.tool = null); } }, { do: 'act', pose: 'look', t: 0.6 }];
        }, {}, p);
      }
    }
    sfx.screams && setTimeout(() => sfx.screams(x, z, 2), 1500);
    for (const p of A.peds) { if (fighters.includes(p)) continue; const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < 18 && ['walk', 'idle', 'wander', 'wait'].includes(p.state)) { p.threat = { x, z }; p.state = 'flee'; p.timer = rand(6, 12); } }
    G.world && G.world.raise('GANG_CONFLICT', x, z, { severity: 1.3 });
    return true;
  }
  stab(att, v) {
    if (!v || v.state === 'air') return;
    const A = G.agents, dx = v.pos.x - att.pos.x, dz = v.pos.z - att.pos.z, d = Math.hypot(dx, dz) || 1;
    if (v.slot != null && G.roles) G.roles.release(v);
    v.job = null; v.state = 'down'; v.timer = rand(30, 55); v.heading = Math.atan2(dx, dz);
    if (G.gore && G.gore.on) { G.gore.shot(v.pos.x, v.pos.z, dx / d, dz / d); A.pTorso.setColorAt(v.i, G.gore.stain(new THREE.Color().fromArray(A.pTorso.instanceColor.array, v.i * 3), 0.45)); A.pTorso.instanceColor.needsUpdate = true; }
    sfx.yelp && sfx.yelp(v.pos.x, v.pos.z);
  }
  // the WORLD menu's "Roadmen": black puffers and Nike Tech, balaclavas; knives, no guns
  dressRoadman(p) {
    const A = G.agents, blk = [0x0c0c0e, 0x111214, 0x16171a, 0x1c1d20], c = new THREE.Color(pick(blk)), l = new THREE.Color(pick([0x0c0c0e, 0x16171a, 0x2a2b2e, 0x3a3b3e]));
    for (const m of [A.pTorso, A.pArmL, A.pArmR]) m.setColorAt(p.i, c);
    A.pLegL.setColorAt(p.i, l); A.pLegR.setColorAt(p.i, l); A.pHair.setColorAt(p.i, new THREE.Color(0x0a0a0a));
    for (const m of A.pMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    p.roadman = true;
    if (G.roles && G.roles.look) G.roles.look(p, 'ROADMAN');
  }

  // things hit by a blast: horses rear and fall, riders come off their scooters and bikes, boats nearby are swamped
  onBlast(x, y, z, r, power) {
    const hit = (px, pz, k = 0.6) => Math.hypot(px - x, pz - z) < r * k && power > 1;
    if (this.hz) for (const o of this.hz.list) if (o.down == null && hit(o.x, o.z)) o.down = rand(35, 50);
    if (this.wh) for (const o of this.wh.list) if (o.down == null && hit(o.x, o.z, 0.7)) o.down = rand(20, 35);
    for (const b of this.boatList || []) if (!b.sunk && hit(b.m.position.x, b.m.position.z, 0.45) && power > 2) { b.sunk = true; b.m.rotation.z = 0.6; }
  }

  update(dt) {
    const n = G.night || 0, t = G.time;
    if (this.waterT) this.waterT.value = t;
    if (this.flagT) this.flagT.value = t;
    for (const m of this.signs) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.3 + n * 1.4);
    if (this.clockMat) this.clockMat.emissiveIntensity = 0.2 + n * 1.4;
    if ((this._clk = (this._clk || 0) - dt) <= 0) { this._clk = 20; this.drawClock(); }
    if (this.capMat) this.capMat.emissiveIntensity = n * 1.1;
    for (const m of [this.lampGlobes, this.bridgeGlobes]) if (m) m.color.setScalar(0.55 + n * 0.9);
    if (this.nsySign) this.nsySign.rotation.y += dt * 0.5;
    for (const j of this.fountainJets || []) j.scale.y = 0.9 + Math.sin(t * 7 + j.position.z) * 0.12;
    for (const s of this.pcScreens || []) if (t > s.next) { s.next = t + rand(5, 8); s.i++; this.drawScreen(s); }
    // the Eye turns slowly, the capsules hang level
    if (this.eyeG) { const a = t * 0.02; this.eyeG.children[0].rotation.z = a; this.capsules.forEach((m, k) => { const b = a + k / 32 * 6.283; m.position.set(Math.sin(b) * (this.eyeR + 0.7), -Math.cos(b) * (this.eyeR + 0.7), 0); }); }
    this.updateBoats(dt); this.updateVehicles(); this.updateHorses(dt); this.updateWheels(dt); this.updateMarch(dt);
    // anything standing on legs comes down when the legs go
    if ((this.restsT -= dt) <= 0) {
      this.restsT = 0.5; const B = G.buildings;
      for (const r of this.L.rests) {
        if (r.done) continue;
        const all = r.under.reduce((a, b) => a + b.cells.length, 0), alive = r.under.reduce((a, b) => a + b.cells.filter((c) => c.alive && !c.falling).length, 0);
        if (alive < all * 0.45) { r.done = true; const cells = r.top.cells.filter((c) => c.alive && !c.falling); if (cells.length && B.startCollapse) B.startCollapse(r.top, cells); }
      }
    }
    this.sounds(dt);
  }
  // the sounds of London: drill from the roadmen's speakers, the anthem at the palace, Big Ben on the hour and quarters
  sounds(dt) {
    if (!sfx.ready && sfx.ready !== undefined) return;
    if (this.L.speakers.length && !this.radioOn) {
      // whoever holds each speaker: the music stops when they're down
      if (!this.holders && G.agents) { this.holders = new Map(); for (const s of this.L.speakers) { const p = G.agents.peds.find((q) => q.speakerHold && q.group && Math.abs(q.group.x - s.x) < 0.01 && Math.abs(q.group.z - s.z) < 0.01); if (p) this.holders.set(s, p); } }
      beachRadio.setList(DRILL_SET); beachRadio.start(this.L.speakers); this.radioOn = !!beachRadio.out;
    }
    if (this.radioOn) {
      beachRadio.update();
      if ((this._hold = (this._hold || 0) - dt) <= 0 && this.holders) { this._hold = 1; for (const [s, p] of this.holders) if (['down', 'gone', 'air'].includes(p.state) || p.dead) { beachRadio.remove(s); this.holders.delete(s); } }
    }
    // Big Ben: the Westminster quarters, and the hour struck on the great bell (the clock shows the real time)
    const d = new Date(), mm = d.getMinutes(), key = d.getHours() * 60 + mm;
    if (mm % 15 === 0 && this.bongKey !== key) {
      this.bongKey = key;
      const { x, z } = this.bigBen;
      if (mm === 0) { const hrs = d.getHours() % 12 || 12; this.chime(x, z, 4); for (let k = 0; k < hrs; k++) setTimeout(() => this.bong(x, z), 9500 + k * 4200); }
      else this.chime(x, z, mm / 15);
    }
  }
  bong(x, z) {
    const I = sfx._internals && sfx._internals(); if (!I || !I.ctx) return;
    const ch = I.chain(x, z, { vol: 0.9, bus: I.ambBus }), t0 = I.ctx.currentTime, f = 164.8;
    for (const [m, pk, d] of [[0.5, 0.16, 7], [1, 0.22, 6], [1.2, 0.1, 4], [1.5, 0.08, 3.5], [2, 0.12, 3], [2.5, 0.04, 2], [3, 0.03, 1.6]]) I.tone(ch.input, t0, { f: f * m, a: 0.004, peak: pk, d });
  }
  chime(x, z, quarters) {
    const I = sfx._internals && sfx._internals(); if (!I || !I.ctx) return;
    const N = { G: 392, F: 349.2, E: 329.6, B: 246.9 }, peals = [['G', 'F', 'E', 'B'], ['E', 'G', 'F', 'B'], ['E', 'F', 'G', 'E'], ['G', 'E', 'F', 'B'], ['B', 'F', 'G', 'E']];
    const ch = I.chain(x, z, { vol: 0.6, bus: I.ambBus }), t0 = I.ctx.currentTime;
    let t = 0;
    for (let q = 0; q < Math.min(quarters, 4); q++) { for (let k = 0; k < 4; k++) { const f = N[peals[(q * 2 + (quarters === 4 ? 1 : 0)) % 5][k]]; for (const [m, pk, dd] of [[1, 0.12, 2.6], [2, 0.06, 1.8], [2.4, 0.03, 1.2], [0.5, 0.05, 3]]) I.tone(ch.input, t0 + t, { f: f * m, a: 0.003, peak: pk, d: dd }); t += k === 3 ? 1.6 : 0.75; } }
  }
}
// the facade atlas for the houses beyond the map: rows = terrace brick, stucco, mansion block, council flats;
// left half = an upper storey's bay, right half = the street storey's bay. A mask marks the glass.
function bgAtlas() {
  const W = 1024, H = 1024, mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cm = mk(), ck = mk(), x = cm.getContext('2d'), m = ck.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
  const win = (X, Y, w, h, frame = '#f2f0ea', bars = 2) => { x.fillStyle = frame; x.fillRect(X - 5, Y - 5, w + 10, h + 10); x.fillStyle = '#2c3640'; x.fillRect(X, Y, w, h); x.fillStyle = 'rgba(160,190,210,.25)'; x.fillRect(X, Y, w * 0.45, h * 0.5); x.fillStyle = frame; x.fillRect(X, Y + h / 2 - 3, w, 6); for (let k = 1; k < bars; k++) x.fillRect(X + w * k / bars - 2, Y, 4, h); m.fillStyle = '#fff'; m.fillRect(X, Y, w, h); };
  const bricks = (X, Y, w, h, base) => { x.fillStyle = base; x.fillRect(X, Y, w, h); for (let yy = 0; yy < h; yy += 12) for (let xx = (yy / 12) % 2 ? -14 : 0; xx < w; xx += 28) { x.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; x.fillRect(X + xx, Y + yy, 26, 10); } x.fillStyle = 'rgba(255,255,255,.06)'; for (let yy = 0; yy < h; yy += 12) x.fillRect(X, Y + yy + 10, w, 2); };
  for (let row = 0; row < 4; row++) {
    const Y = row * 256;
    for (const half of [0, 1]) {
      const X = half * 512, ground = half === 1;
      if (row === 0) {        // Victorian terrace: two sash windows above; a front door with fanlight and a bay window below
        bricks(X, Y, 512, 256, '#c8bfb4');
        if (!ground) { win(X + 70, Y + 50, 120, 160); win(X + 320, Y + 50, 120, 160); x.fillStyle = '#e8e2d6'; x.fillRect(X + 60, Y + 36, 140, 12); x.fillRect(X + 310, Y + 36, 140, 12); }
        else { x.fillStyle = '#e8e2d6'; x.fillRect(X + 40, Y + 30, 140, 226); x.fillStyle = pick(['#1c2a4a', '#5a1414', '#123a1e', '#111111']); x.fillRect(X + 62, Y + 90, 96, 166); win(X + 70, Y + 44, 80, 36, '#e8e2d6', 3); x.fillStyle = '#d8d2c4'; x.fillRect(X + 250, Y + 30, 230, 226); win(X + 270, Y + 60, 190, 150, '#f2f0ea', 3); }
      } else if (row === 1) { // Georgian / Regency stucco: tall windows with iron balconettes; a columned porch below
        x.fillStyle = '#f4f0e8'; x.fillRect(X, Y, 512, 256); for (let yy = 0; yy < 256; yy += 64) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(X, Y + yy, 512, 3); }
        if (!ground) { for (const wx of [50, 196, 342]) { win(X + wx, Y + 30, 110, 190, '#ffffff', 2); x.fillStyle = '#1a1a1a'; x.fillRect(X + wx - 8, Y + 190, 126, 6); for (let k = 0; k < 8; k++) x.fillRect(X + wx - 6 + k * 16, Y + 190, 3, 32); } }
        else { x.fillStyle = '#ffffff'; x.fillRect(X + 30, Y + 20, 34, 236); x.fillRect(X + 186, Y + 20, 34, 236); x.fillRect(X + 20, Y + 10, 210, 20); x.fillStyle = '#111'; x.fillRect(X + 80, Y + 60, 90, 196); win(X + 300, Y + 50, 140, 150, '#ffffff', 2); x.fillStyle = '#1a1a1a'; x.fillRect(X, Y + 236, 512, 6); for (let k = 0; k < 32; k++) x.fillRect(X + k * 16, Y + 210, 3, 40); }
      } else if (row === 2) { // Edwardian mansion block: red brick, white stone bands, three windows; an entrance and shopfront below
        bricks(X, Y, 512, 256, '#c4a092'); x.fillStyle = '#efe8dc'; x.fillRect(X, Y + 236, 512, 16);
        if (!ground) for (const wx of [40, 196, 352]) { win(X + wx, Y + 50, 120, 150, '#efe8dc', 2); x.fillStyle = '#efe8dc'; x.fillRect(X + wx - 10, Y + 34, 140, 16); }
        else { x.fillStyle = '#2a2a2e'; x.fillRect(X + 20, Y + 30, 300, 26); win(X + 30, Y + 64, 280, 180, '#3a3a40', 4); x.fillStyle = '#efe8dc'; x.fillRect(X + 350, Y + 30, 140, 226); x.fillStyle = '#20304a'; x.fillRect(X + 380, Y + 80, 80, 176); }
      } else {                // council flats: concrete panels, long windows, the deck-access balcony rail; doors and garages below
        x.fillStyle = '#c8c4bc'; x.fillRect(X, Y, 512, 256); x.fillStyle = 'rgba(0,0,0,.08)'; for (let k = 0; k < 512; k += 128) x.fillRect(X + k, Y, 3, 256);
        if (!ground) { win(X + 40, Y + 60, 250, 110, '#e8e8e8', 3); win(X + 340, Y + 60, 120, 110, '#e8e8e8', 1); x.fillStyle = '#5a5e64'; x.fillRect(X, Y + 196, 512, 14); for (let k = 0; k < 512; k += 24) x.fillRect(X + k, Y + 196, 4, 60); }
        else { x.fillStyle = '#3a4a6a'; x.fillRect(X + 40, Y + 80, 90, 176); x.fillStyle = '#9a9a96'; x.fillRect(X + 200, Y + 90, 260, 166); for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(X + 200, Y + 100 + k * 20, 260, 3); } }
      }
    }
  }
  const tx = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = c === cm ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
  return { map: tx(cm), mask: tx(ck) };
}
function ukFlag(c, w, h) {
  const s = h / 5; c.fillStyle = '#012169'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#fff'; c.lineWidth = s * 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
  c.strokeStyle = '#c8102e'; c.lineWidth = s * 0.45; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(w / 2 - s, 0, s * 2, h); c.fillRect(0, h / 2 - s, w, s * 2);
  c.fillStyle = '#c8102e'; c.fillRect(w / 2 - s * 0.6, 0, s * 1.2, h); c.fillRect(0, h / 2 - s * 0.6, w, s * 1.2);
}

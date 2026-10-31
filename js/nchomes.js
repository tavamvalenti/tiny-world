// NORTH COUNTY: the houses. Which kind of house stands where, in what colours, under which roof, and what's round it.
// Neighbourhoods (from local sources: city and realtor neighbourhood descriptions, OSM, street-level references; the
// house-by-house mix is a regional approximation, not a survey):
//   the Barrio          (rail to I-5, Carlsbad Village Dr to Tamarack) small 1920s-50s clapboard and stucco cottages
//                       on small lots, some Spanish revival, the odd new two-storey infill
//   Holiday Park        (round the park by Pio Pico and Chestnut) 1950s-60s ranches, one storey, established yards
//   Olde Carlsbad       (west of the tracks south of the Village, and the hills east of I-5 by Highland Dr) mid-century
//                       ranches, Spanish revival, newer custom homes; bigger lots inland
//   coastal Carlsbad    (Ocean St, Garfield, Carlsbad Blvd, the Tamarack and Terramar beach blocks) two- and three-storey
//                       modern coastal homes and condos among older cottages and Spanish revival
//   north Carlsbad      (Laguna Dr, Las Flores, by Buena Vista Lagoon) ranches and 1970s-80s suburban
//   South Oceanside     (Cassidy to Wisconsin, the beach to I-5) 1920s-50s beach cottages and bungalows, ranches,
//                       Spanish revival, modern infill toward the beach
//   the Oceanside Strand and S Pacific St: modern three-storey beach houses beside small old cottages
//   downtown's edges    (Townsite, Eastside) Craftsman-era bungalows, Spanish revival, mid-century
//   east of I-5         planned tracts: one builder's houses, one roof and a handful of colours per subdivision
// Everything here runs inside northcounty()'s seeded random numbers, so a house looks the same on every load.
import * as THREE from 'three';
import { rand, pick, seeded } from './core.js';
import { seaDist } from './ncgeo.js';

// ---------- colour ----------
const C = (hex) => new THREE.Color(hex);
const jitter = (c, l = 0.025) => { c.offsetHSL(rand(-0.006, 0.006), rand(-0.02, 0.02), rand(-l, l)); return c; };
function weighted(list) { let t = 0; for (const e of list) t += e[1]; let r = Math.random() * t; for (const e of list) if ((r -= e[1]) < 0) return e[0]; return list[0][0]; }
// walls: neutrals carry the streets, a few muted colours show up now and then
const WALL = {
  warmWhite: '#ece7dc', offWhite: '#e4ded0', cream: '#e8dcbf', ivory: '#efe6cf', sand: '#d8c7a3', beige: '#cdbc9c',
  tan: '#c3ad8b', taupe: '#ad9d88', warmGray: '#b3ada3', sage: '#a3ad94', blueGray: '#9aa7ae', lightBrown: '#a58b6d', stucco: '#d6c8ae',
  // secondary, used sparingly
  terracotta: '#b98263', peach: '#dfb99a', dustyYellow: '#d8c88f', coastBlue: '#a3bac6', wood: '#93806a',
};
const PAL = {
  any: [['warmWhite', 10], ['offWhite', 8], ['cream', 8], ['ivory', 5], ['sand', 8], ['beige', 8], ['tan', 6], ['taupe', 5], ['warmGray', 6], ['sage', 4], ['blueGray', 4], ['lightBrown', 3], ['stucco', 6],
    ['terracotta', 1.2], ['peach', 1.2], ['dustyYellow', 1], ['coastBlue', 1.2], ['wood', 1]],
  spanish: [['warmWhite', 10], ['offWhite', 6], ['cream', 9], ['ivory', 6], ['sand', 5], ['stucco', 5], ['tan', 2], ['peach', 1]],
  modern: [['warmWhite', 10], ['offWhite', 8], ['warmGray', 6], ['blueGray', 3], ['taupe', 2], ['ivory', 2], ['wood', 1]],
  ranch: [['beige', 7], ['tan', 6], ['taupe', 5], ['warmGray', 6], ['sage', 4], ['blueGray', 4], ['lightBrown', 3], ['warmWhite', 5], ['cream', 4], ['dustyYellow', 1], ['wood', 1]],
  suburban: [['beige', 8], ['sand', 7], ['tan', 6], ['taupe', 5], ['cream', 5], ['warmGray', 5], ['stucco', 5], ['offWhite', 3]],
  cottage: [['warmWhite', 9], ['offWhite', 5], ['cream', 5], ['sage', 4], ['blueGray', 4], ['sand', 4], ['beige', 3], ['coastBlue', 2], ['dustyYellow', 1.4], ['peach', 1.4], ['terracotta', 1], ['wood', 1]],
};
export const wall = (pal = 'any') => jitter(C(WALL[weighted(PAL[pal])]));
// roofs (a little lighter than the real thing: the shingle and tile textures darken them)
const ROOF = {
  asphalt: ['#6c6e71', '#626467', '#74767a'], charcoal: ['#545659', '#4c4e51'], brownShingle: ['#87745f', '#7b6a58', '#917c66'], lightGray: ['#a6a7a3', '#9c9d99'],
  terracotta: ['#b2735a', '#a86b52', '#b98163', '#a0654f'], brownTile: ['#8e6d55', '#806250', '#9a7860'], grayTile: ['#86827c', '#7a7771'],
};
const roofC = (k) => jitter(C(pick(ROOF[k])), 0.03);
// a commercial front in the Village or downtown: mostly neutral, the odd muted colour
export const shopWall = () => (Math.random() < 0.8 ? wall('any') : jitter(C(pick(['#c99a72', '#a9b59a', '#9fb3bf', '#d6c27f', '#c58c76', '#b9a58a']))));

// ---------- where: the neighbourhood a point is in ----------
let I5 = null; const I5Z0 = -1000, I5DZ = 4;
export function setI5(pts) {                                     // I-5's x by z (js/northcounty.js passes ROADS.i5)
  I5 = new Float32Array(Math.ceil(1500 / I5DZ)).fill(1e9);
  for (const [x, z] of pts) { const k = Math.floor((z - I5Z0) / I5DZ); if (k >= 0 && k < I5.length) I5[k] = Math.min(I5[k], x); }
  for (let k = 1; k < I5.length; k++) if (I5[k] > 1e8 && I5[k - 1] < 1e8) I5[k] = I5[k - 1];
  for (let k = I5.length - 2; k >= 0; k--) if (I5[k] > 1e8 && I5[k + 1] < 1e8) I5[k] = I5[k + 1];
}
const i5x = (z) => { if (!I5) return 1e9; const k = Math.max(0, Math.min(I5.length - 1, Math.floor((z - I5Z0) / I5DZ))); return I5[k]; };
let HOLIDAY = { x: 1e9, z: 1e9 };
export const setHoliday = (p) => { if (p) HOLIDAY = p; };
export function hoodAt(x, z) {
  const east = x > i5x(z) + 4, sd = seaDist(x, z);
  if (z > -130) {                                               // Carlsbad
    if (east) return 'highlands';
    if (sd < 26 || x < -10) return 'coastC';
    if (z < -72) return 'northC';
    if (x > 40 && z > -10 && z < 240) return Math.hypot(x - HOLIDAY.x, z - HOLIDAY.z) < 42 ? 'holiday' : 'barrio';
    return 'olde';
  }
  if (z > -282) return east ? 'tract' : sd < 26 ? 'coastO' : 'northC';   // round Buena Vista Lagoon
  if (east) return 'tract';
  if (sd < 22 || x < -12) return 'coastO';
  return z > -540 ? 'southO' : 'eastside';
}
// what the streets of each neighbourhood are made of (weights per kind of house)
const MIX = {
  barrio: [['bungalow', 6], ['spanish', 2], ['ranch', 1], ['modern', 1]],
  holiday: [['ranch', 6], ['bungalow', 2], ['spanish', 1]],
  olde: [['ranch', 3], ['spanish', 3], ['bungalow', 2], ['modern', 2], ['suburban', 1]],
  coastC: [['modern', 5], ['spanish', 2], ['cottage', 1.5], ['condo', 1.2], ['suburban', 1]],
  northC: [['ranch', 4], ['suburban', 2.5], ['spanish', 1], ['bungalow', 1]],
  highlands: [['ranch', 5], ['spanish', 2], ['suburban', 1.5], ['modern', 0.6]],
  coastO: [['modern', 4], ['cottage', 3.5], ['condo', 1.2], ['spanish', 1]],
  southO: [['bungalow', 4], ['ranch', 3], ['spanish', 2], ['cottage', 1], ['modern', 1]],
  eastside: [['bungalow', 5], ['spanish', 2.5], ['ranch', 2], ['modern', 0.8]],
};

// ---------- what: the kinds of house (w = street frontage, d = depth, game units) ----------
const roofOf = (list) => roofC(weighted(list));
const ARCH = {
  // the old Southern California bungalow / clapboard cottage: small, one storey, low gable or hip, shingle, a porch
  bungalow: (h) => ({ w: rand(2.2, 2.9), d: rand(2.6, 3.3), floors: 1, style: 'house', tint: wall(h === 'barrio' || h === 'eastside' ? 'cottage' : 'any'),
    gable: true, roofKind: Math.random() < 0.7 ? 'gable' : 'hip', pitch: rand(0.32, 0.4), roofMat: 'shingle',
    roof: roofOf([['asphalt', 4], ['brownShingle', 3], ['charcoal', 2], ['lightGray', 1.5]]),
    porch: Math.random() < 0.6, fence: weighted([['picket', 3], ['hedge', 2], ['none', 4], ['wall', 1]]), yard: weighted([['lawn', 5], ['dry', 3], ['gravel', 2]]),
    garage: Math.random() < 0.15 ? 1 : 0, palm: 0.35 }),
  // the beach cottage: as small, a lighter coat, white trim
  cottage: () => ({ w: rand(2.2, 2.8), d: rand(2.6, 3.2), floors: 1, style: 'house', tint: wall('cottage'),
    gable: true, roofKind: 'gable', pitch: rand(0.34, 0.42), roofMat: 'shingle', roof: roofOf([['lightGray', 3], ['asphalt', 3], ['brownShingle', 1]]),
    porch: Math.random() < 0.45, fence: weighted([['picket', 3], ['none', 4], ['hedge', 1]]), yard: weighted([['gravel', 4], ['dry', 3], ['lawn', 2]]), garage: 0, palm: 0.55 }),
  // Spanish / Mediterranean revival: white and cream stucco, low terracotta barrel-tile roof, a courtyard wall
  spanish: () => ({ w: rand(2.6, 3.6), d: rand(3, 3.8), floors: Math.random() < 0.15 ? 2 : 1, style: 'mission', tint: wall('spanish'),
    gable: true, roofKind: Math.random() < 0.5 ? 'hip' : 'gable', pitch: rand(0.27, 0.33), roofMat: 'tile', roof: roofC('terracotta'),
    porch: false, fence: weighted([['wall', 5], ['hedge', 2], ['none', 3]]), yard: weighted([['dry', 4], ['lawn', 3], ['gravel', 2]]), garage: Math.random() < 0.35 ? 1 : 0, palm: 0.5 }),
  // the mid-century ranch: wide and low, a shallow roof, the garage on the end
  ranch: () => ({ w: rand(3.8, 4.8), d: rand(2.6, 3.1), floors: 1, style: Math.random() < 0.4 ? 'mission' : 'house', tint: wall('ranch'),
    gable: true, roofKind: Math.random() < 0.55 ? 'gable' : 'hip', pitch: rand(0.22, 0.28), roofMat: Math.random() < 0.15 ? 'tile' : 'shingle',
    roof: null, fence: weighted([['hedge', 3], ['none', 5], ['picket', 1], ['wall', 1]]), yard: weighted([['lawn', 6], ['dry', 3], ['gravel', 1]]), garage: Math.random() < 0.75 ? 1 : 0, palm: 0.2 }),
  // modern coastal: two or three storeys, white and grey, flat roof, glass balcony, a garage under
  modern: (h) => { const f = (h === 'coastC' || h === 'coastO') && Math.random() < 0.45 ? 3 : 2;
    return { w: rand(2.8, 3.8), d: rand(3.2, 4.2), floors: f, style: 'coastal', tint: wall('modern'), gable: false,
      balcony: Math.random() < 0.65, tuck: Math.random() < 0.6, fence: weighted([['none', 4], ['wall', 2], ['hedge', 1]]), yard: weighted([['gravel', 5], ['dry', 2], ['lawn', 2]]),
      setback: f === 3 && Math.random() < 0.6, garage: 0, palm: 0.5, set: rand(0.7, 1.2) }; },
  // the newer tract house: one or two storeys, stucco, concrete tile, a two-car garage
  suburban: () => ({ w: rand(3.2, 4.2), d: rand(3.2, 4), floors: Math.random() < 0.65 ? 2 : 1, style: Math.random() < 0.7 ? 'mission' : 'house', tint: wall('suburban'),
    gable: true, roofKind: Math.random() < 0.55 ? 'hip' : 'gable', pitch: rand(0.3, 0.36), roofMat: Math.random() < 0.75 ? 'tile' : 'shingle',
    roof: null, fence: weighted([['none', 5], ['hedge', 2], ['wall', 1]]), yard: weighted([['lawn', 7], ['dry', 2]]), garage: 2, palm: 0.25 }),
  // the small coastal condo block: three or four storeys of neutral stucco
  condo: () => ({ w: rand(4.4, 5.6), d: rand(3.8, 4.8), floors: pick([3, 3, 4]), style: Math.random() < 0.5 ? 'coastal' : 'mission', tint: wall(Math.random() < 0.5 ? 'modern' : 'spanish'), gable: false,
    balcony: true, fence: 'none', yard: 'gravel', garage: 0, palm: 0.6, set: rand(0.6, 1) }),
};
const roofFor = (o) => o.roof || (o.roofMat === 'tile' ? roofC(weighted([['brownTile', 4], ['grayTile', 3], ['terracotta', 2]])) : roofC(weighted([['asphalt', 4], ['charcoal', 2], ['brownShingle', 3], ['lightGray', 1]])));

// a subdivision east of I-5: one builder, one roof, a few colours (a cell of the map ~70 units across)
const TRACTS = new Map();
function tract(x, z) {
  const k = `${Math.floor(x / 70)},${Math.floor(z / 70)}`;
  if (!TRACTS.has(k)) {
    const r = seeded((Math.floor(x / 70) * 73856093) ^ (Math.floor(z / 70) * 19349663));
    const kind = r() < 0.6 ? 'suburban' : 'ranch', tile = kind === 'suburban' ? r() < 0.8 : r() < 0.2;
    const fam = tile ? ['brownTile', 'grayTile', 'terracotta'][Math.floor(r() * 3)] : ['asphalt', 'brownShingle', 'charcoal'][Math.floor(r() * 3)];
    const keys = PAL[kind].map((e) => e[0]), cols = [0, 1, 2, 3].map(() => keys[Math.floor(r() * keys.length)]);
    TRACTS.set(k, { kind, tile, fam, cols, hip: r() < 0.5, floors2: r() < 0.6 });
  }
  return TRACTS.get(k);
}

// a house for the lot at (x, z): its size, walls, roof, garage and yard
export function house(x, z) {
  const h = hoodAt(x, z);
  let o;
  if (h === 'tract') {
    const T = tract(x, z);
    o = ARCH[T.kind](h);
    o.tint = jitter(C(WALL[pick(T.cols)]), 0.015); o.roofMat = T.tile ? 'tile' : 'shingle'; o.roof = roofC(T.fam); o.roofKind = T.hip ? 'hip' : 'gable';
    if (T.kind === 'suburban') o.floors = Math.random() < (T.floors2 ? 0.8 : 0.2) ? 2 : 1;
    o.fence = Math.random() < 0.8 ? 'none' : 'hedge'; o.yard = Math.random() < 0.85 ? 'lawn' : 'dry'; o.garage = T.kind === 'suburban' ? 2 : 1;
  } else o = ARCH[weighted(MIX[h])](h);
  if (h === 'barrio') { o.w *= 0.92; o.d *= 0.92; }                           // the Barrio's lots are small
  if (h === 'highlands' || h === 'holiday') o.w *= 1.06;
  if (o.gable) o.roof = roofFor(o);
  return { gap: h === 'tract' ? rand(0.8, 1.2) : rand(0.9, 2.2), set: rand(1, 1.8), cell: 1.6, gh: 1.1, fh: 0.95, tree: 0.5, home: true, hood: h, ...o };
}

// ---------- round the house (on streets that run on the grid) ----------
// (dx, dz) the street's direction, (ox, oz) from the street toward the house; W the house's frontage, D its depth;
// front the depth of the front yard
const YARD = { lawn: ['#788a4a', '#71844a', '#7f8f50'], dry: ['#a39374', '#9c8c6c', '#ab9a78'], gravel: ['#b2a98f', '#a9a28c', '#bbb196'] };
export function lotDetails(ctx, b, o, f) {
  const { city, g, B, free, mark } = ctx, { cx, cz, dx, dz, ox, oz, W, D, front } = f;
  const rot = Math.atan2(-ox, -oz);                                      // a prop's local x runs along the street, +z faces it
  const at = (u, v) => [cx + dx * u + ox * v, cz + dz * u + oz * v];     // u along the street, v away from it (house centre = 0, 0)
  const rect = (u0, v0, u1, v1, col) => { const [ax, az] = at(u0, v0), [bx, bz] = at(u1, v1); g.rect(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), col); };
  const prop = (type, u, v, len, opts = {}) => { const [x, z] = at(u, v); city.addProp(type, x, z, rot, 1); const p = city.props[city.props.length - 1]; p.sx = len; p.sy = opts.sy || 1; p.sz = opts.sz || 1; if (opts.y) p.y = opts.y; if (opts.color) p.color = opts.color; if (opts.cell) p.cell = opts.cell; return p; };
  const cellAt = (bb, fl, u, v) => { const [x, z] = at(u, v); let best = null, bd = 1e9; for (const c of bb.cells) if (c.f === fl) { const d2 = (c.x - x) ** 2 + (c.z - z) ** 2; if (d2 < bd) { bd = d2; best = c; } } return best; };
  const fv = -D / 2;                                                      // the front wall
  // back yard (when there's room behind) and front yard
  const back = 2.6, yard = YARD[o.yard] || YARD.lawn;
  const [bx0, bz0] = at(-W / 2, D / 2 + 0.6), [bx1, bz1] = at(W / 2, D / 2 + back);
  if (free(Math.min(bx0, bx1) + 0.1, Math.min(bz0, bz1) + 0.1, Math.max(bx0, bx1) - 0.1, Math.max(bz0, bz1) - 0.1)) rect(-W / 2 - 0.15, D / 2 - 0.1, W / 2 + 0.15, D / 2 + back + 0.15, Math.random() < 0.7 ? '#6f8146' : '#8a8a5c');
  rect(-W / 2, fv - front, W / 2, fv, pick(yard));
  if (o.yard !== 'lawn') for (let k = 0; k < 4; k++) { const [x, z] = at(rand(-W / 2 + 0.3, W / 2 - 0.3), fv - rand(0.25, front - 0.2)); g.circle(x, z, rand(0.1, 0.22), pick(['#6f8a5e', '#86a0a0', '#5f7a4c', '#8a9a6a'])); }   // succulents, agave
  // the garage on the end (a ranch's one bay, a tract house's two), its door, its driveway
  const side = Math.random() < 0.5 ? -1 : 1;
  let drive = side * (W / 2 - 0.45), dw = 0.9, used = 0;
  if (o.garage) {
    const gw = o.garage === 2 ? rand(2, 2.4) : rand(1.5, 1.8), gd = D * rand(0.8, 0.95), gu = side * (W / 2 + gw / 2), gv = (D - gd) / -2;
    const [gx, gz] = at(gu, gv), along = Math.abs(dx) > Math.abs(dz), w = along ? gw : gd, d = along ? gd : gw;
    if (free(gx - w / 2 + 0.25, gz - d / 2 + 0.25, gx + w / 2 - 0.25, gz + d / 2 - 0.25)) {   // (inset: it touches the house, whose own margin is marked)
      const gb = B.add({ x: gx, z: gz, w, d, floors: 1, style: o.style === 'mission' ? 'mission' : 'house', tint: o.tint, cell: 1.6, gh: 0.95, fh: 0.95, gable: !!o.gable, roofTint: o.roof, roofKind: o.roofKind, roofMat: o.roofMat, pitch: o.pitch, storefront: false });
      gb.noSigns = true; mark(gx - w / 2 - 0.1, gz - d / 2 - 0.1, gx + w / 2 + 0.1, gz + d / 2 + 0.1);
      prop('gdoor', gu, gv - gd / 2 - 0.02, gw * 0.78, { cell: cellAt(gb, 0, gu, gv) });
      drive = gu; dw = gw * 0.85; used = gw;
    }
  }
  if (!used && o.tuck) { prop('gdoor', side * W * 0.22, fv - 0.02, Math.min(1.8, W * 0.45), { cell: cellAt(b, 0, side * W * 0.22, 0) }); drive = side * W * 0.22; dw = Math.min(1.8, W * 0.45); }
  rect(drive - dw / 2, fv - front - 0.05, drive + dw / 2, fv, '#bdb6a6');
  // a porch over the front door
  if (o.porch) prop('porch', -side * W * 0.15, fv, W * 0.42, { sz: Math.min(1, front / 0.75), cell: cellAt(b, 0, -side * W * 0.15, 0) });
  // a balcony across the upper floor
  if (o.balcony && o.floors > 1) for (let f = 1; f < o.floors; f += o.floors > 3 ? 2 : 1) prop('balcony', 0, fv, W * rand(0.55, 0.8), { y: 1.1 + (f - 1) * 0.95, cell: cellAt(b, f, 0, 0) });
  // along the front: a low stucco wall, a picket fence or a hedge, leaving the drive and the path open
  const fl = fv - front + 0.2, half = (W + used) / 2, u0 = used ? (side > 0 ? -W / 2 : -W / 2 - used) : -W / 2;
  const run = (from, to, type, opts) => { if (to - from > 0.6) prop(type, (from + to) / 2, fl, to - from, opts); };
  const gaps = [drive - dw / 2 - 0.1, drive + dw / 2 + 0.1].sort((a, b2) => a - b2), path = -side * W * 0.15;
  const spans = [[u0, Math.min(gaps[0], path - 0.35)], [Math.max(gaps[1], path + 0.35), u0 + half * 2]].filter(([a, c]) => c > a);
  if (o.fence === 'wall') for (const [a, c] of spans) run(a, c, 'wall', { color: o.tint.clone().multiplyScalar(0.94) });
  else if (o.fence === 'picket') for (const [a, c] of spans) run(a, c, 'fence');
  else if (o.fence === 'hedge') for (const [a, c] of spans) run(a, c, 'hedge', { sy: rand(0.7, 1.1), sz: 0.8 });
  // a wooden fence along the back of the older lots
  if (o.hood !== 'tract' && o.hood !== 'coastC' && o.hood !== 'coastO' && Math.random() < 0.45 && free(...box2(at(-W / 2, D / 2 + back - 0.2), at(W / 2, D / 2 + back + 0.2))))
    prop('woodfence', 0, D / 2 + back, W + 0.4, { sy: 0.8 });
}
const box2 = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];

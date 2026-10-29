// NORTH COUNTY: Carlsbad and Oceanside, the coast north of San Diego, on one continuous map (js/ncgeo.js has its
// shape). Reached only from San Diego, through the clouds (js/travel.js).
//   Carlsbad      the Village (State St, Grand Ave, Carlsbad Village Dr, the Carlsbad sign over Carlsbad Blvd, the
//                 blue Victorian on the corner), the Barrio (Roosevelt, Pine Ave Park, Holiday Park), the Coaster
//                 station, Tamarack and the seawall, Carlsbad High, Agua Hedionda Lagoon at the south end
//   Buena Vista Lagoon, the line between the two cities
//   Oceanside     South Oceanside's beach cottages, downtown (Coast Hwy, Mission Ave, Pier View Way, Tremont, the
//                 Transit Center, Civic Center), the Pier and the Strand, the resorts at its foot, the Harbor
// This file lays out the ground, the streets and the buildings; js/ncworld.js builds what stands and moves on it.
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { City, Ground } from './city.js';
import { hsl, partition } from './maps.js';
import { NC, BOUNDS, PATCHES, SEA, WATERS, PLACES, PIER, isLand, landAt, seaDist, eastEdge, MASK, maskData, BEACH_W, inPoly } from './ncgeo.js';

// ---------- the ground: several patches up the coast, drawn on as if they were one ----------
export class Patches {
  constructor(list) {
    this.list = list.map((P) => new Ground(P.E, P.res, P.cx, P.cz));
    for (const p of this.list) p.b = { x0: p.cx - p.E, x1: p.cx + p.E, z0: p.cz - p.E, z1: p.cz + p.E };
  }
  hit(x0, z0, x1, z1) { return this.list.filter((p) => x1 >= p.b.x0 && x0 <= p.b.x1 && z1 >= p.b.z0 && z0 <= p.b.z1); }
  rect(x0, z0, x1, z1, s) { for (const p of this.hit(x0, z0, x1, z1)) p.rect(x0, z0, x1, z1, s); }
  line(x0, z0, x1, z1, w, s, dash) { for (const p of this.hit(Math.min(x0, x1) - w, Math.min(z0, z1) - w, Math.max(x0, x1) + w, Math.max(z0, z1) + w)) p.line(x0, z0, x1, z1, w, s, dash); }
  circle(x, z, r, s) { for (const p of this.hit(x - r, z - r, x + r, z + r)) p.circle(x, z, r, s); }
  poly(pts, s) { const b = bbox(pts); for (const p of this.hit(b.x0, b.z0, b.x1, b.z1)) p.poly(pts, s); }
  grainRect(x0, z0, x1, z1, a, s) { for (const p of this.hit(x0, z0, x1, z1)) p.grainRect(Math.max(x0, p.b.x0), Math.max(z0, p.b.z0), Math.min(x1, p.b.x1), Math.min(z1, p.b.z1), a, s); }
  // a polyline stroked with round joins (streets that don't run on the grid, the rail, the freeway)
  stroke(pts, w, s, dash = null, bb = null) {
    const b = bb || bbox(pts);
    for (const p of this.hit(b.x0 - w, b.z0 - w, b.x1 + w, b.z1 + w)) {
      const X = p.x; X.save(); X.strokeStyle = s; X.lineWidth = w * p.k; X.lineCap = X.lineJoin = 'round'; X.setLineDash(dash ? dash.map((d) => d * p.k) : []);
      X.beginPath(); pts.forEach(([a, c], i) => (i ? X.lineTo(p.px(a), p.pz(c)) : X.moveTo(p.px(a), p.pz(c)))); X.stroke(); X.restore();
    }
  }
  each(fn) { for (const p of this.list) { p.x.save(); fn(p.x, p); p.x.restore(); } }
  scorch(x, z, r, a) { for (const p of this.hit(x - r, z - r, x + r, z + r)) p.scorch(x, z, r, a); }
  update(dt) { for (const p of this.list) p.update(dt); }
  // what's painted into "the" ground (blood, tyre marks): the patch under the view
  cur() { const c = G.cam; if (c) for (const p of this.list) if (c.x >= p.b.x0 && c.x <= p.b.x1 && c.z >= p.b.z0 && c.z <= p.b.z1) return p; return this.list[0]; }
  get x() { return this.cur().x; } get k() { return this.cur().k; } get c() { return this.cur().c; } get E() { return this.cur().E; } get tex() { return this.cur().tex; }
  get dirtyT() { return this.cur().dirtyT; } set dirtyT(v) { this.cur().dirtyT = v; }
  px(x) { return this.cur().px(x); } pz(z) { return this.cur().pz(z); }
}
function bbox(pts) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [a, b] of pts) { if (a < x0) x0 = a; if (a > x1) x1 = a; if (b < z0) z0 = b; if (b > z1) z1 = b; } return { x0, z0, x1, z1 }; }

// ---------- palettes ----------
const STUCCO = () => Math.random() < 0.5 ? hsl(rand(0.09, 0.13), rand(0.1, 0.3), rand(0.86, 0.94)) : hsl(pick([0.03, 0.08, 0.11, 0.14, 0.3, 0.5, 0.55, 0.58]), rand(0.2, 0.45), rand(0.7, 0.84));
const BEACHY = () => Math.random() < 0.55 ? hsl(rand(0.1, 0.13), rand(0.05, 0.2), rand(0.9, 0.96)) : hsl(pick([0.5, 0.52, 0.55, 0.58, 0.12, 0.95, 0.33]), rand(0.25, 0.5), rand(0.72, 0.86));
const BARRIO = () => Math.random() < 0.3 ? hsl(rand(0.08, 0.12), rand(0.08, 0.2), rand(0.7, 0.82)) : hsl(pick([0.0, 0.05, 0.1, 0.14, 0.33, 0.48, 0.58, 0.8, 0.95]), rand(0.3, 0.55), rand(0.58, 0.72));
const CAPECOD = () => Math.random() < 0.4 ? hsl(0.12, 0.08, rand(0.88, 0.94)) : hsl(rand(0.54, 0.6), rand(0.08, 0.2), rand(0.72, 0.84));
const TILE = () => hsl(rand(0.02, 0.05), rand(0.5, 0.65), rand(0.42, 0.52));
const SHINGLE = () => hsl(rand(0.06, 0.6), rand(0.0, 0.1), rand(0.32, 0.5));

// ---------- the zones (game units; see the street table in js/ncdata.js) ----------
export const ZONES = {
  village: { x0: -6, x1: 92, z0: -72, z1: 30, name: 'Carlsbad Village', o: 'Carlsbad Village' },
  barrio: { x0: 40, x1: 152, z0: 30, z1: 238, name: 'the Barrio', o: 'the Barrio' },
  carlsbadBeach: { x0: -60, x1: -10, z0: -140, z1: 300, name: 'Tamarack Beach', o: 'Tamarack Beach' },
  otown: { x0: -40, x1: 120, z0: -640, z1: -540, name: 'Downtown Oceanside', o: 'downtown Oceanside' },
  strand: { x0: -60, x1: -18, z0: -700, z1: -420, name: 'the Strand', o: 'the Strand' },
  southO: { x0: -40, x1: 160, z0: -420, z1: -282, name: 'South Oceanside', o: 'South Oceanside' },
  harbor: { x0: -90, x1: 70, z0: -950, z1: -705, name: 'Oceanside Harbor', o: 'Oceanside Harbor' },
  buenaVista: { x0: -40, x1: 200, z0: -280, z1: -130, name: 'Buena Vista Lagoon', o: 'Buena Vista Lagoon' },
  agua: { x0: -40, x1: 160, z0: 270, z1: 380, name: 'Agua Hedionda Lagoon', o: 'Agua Hedionda Lagoon' },
};
const inZ = (Z, x, z) => x > Z.x0 && x < Z.x1 && z > Z.z0 && z < Z.z1;
function zoneAt(x, z) {
  if (inZ(ZONES.harbor, x, z)) return 'harbor';
  if (inZ(ZONES.village, x, z)) return 'village';
  if (inZ(ZONES.otown, x, z)) return 'otown';
  if (seaDist(x, z) < 24) return 'beachfront';
  if (inZ(ZONES.barrio, x, z)) return 'barrio';
  return 'res';
}

// ================= THE MAP =================
export function northcounty(B) {
  const D = NC, XS = D.xs, ZS = D.zs;
  const EK = new Map();                                       // the grid's streets: "i,j,v|h" -> width
  for (const [ax, i, j, w] of D.edges) EK.set(`${i},${j},${ax ? 'h' : 'v'}`, w);
  const used = new Set();
  for (const [ax, i, j] of D.edges) { used.add(`${i},${j}`); used.add(ax ? `${i + 1},${j}` : `${i},${j + 1}`); }
  const ek = (a, b) => (a.i === b.i ? `${a.i},${Math.min(a.j, b.j)},v` : `${Math.min(a.i, b.i)},${a.j},h`);
  const side = (i, j, s) => EK.has(s === 'L' ? `${i},${j},v` : s === 'R' ? `${i + 1},${j},v` : s === 'T' ? `${i},${j},h` : `${i},${j + 1},h`);
  const blockLive = (i, j) => {
    const n = ['L', 'R', 'T', 'B'].filter((s) => side(i, j, s)).length;
    const cx = (XS[i] + XS[i + 1]) / 2, cz = (ZS[j] + ZS[j + 1]) / 2;
    return n >= 2 && isLand(cx, cz) && XS[i + 1] - XS[i] > 7 && ZS[j + 1] - ZS[j] > 7 && XS[i + 1] - XS[i] < 90 && ZS[j + 1] - ZS[j] < 90;
  };
  const city = new City({ xs: XS, zs: ZS, roadW: 4.2, sw: 1.3, half: 150, extent: 400, centerLine: 'yellow',
    skipNode: (i, j) => !used.has(`${i},${j}`), skipEdge: (a, b) => !EK.has(ek(a, b)), skipBlock: (i, j) => !blockLive(i, j) });
  // signals only where two bigger streets meet (quiet residential corners are stop signs, not lights)
  for (const n of city.nodes) if (n.lit) n.lit = n.edges.filter((m) => (EK.get(ek(n, city.nodes[m])) || 0) >= 4.2).length >= 2;
  const g = new Patches(PATCHES);
  const ctx = { city, g, B };
  city.nc = { pier: PIER, places: PLACES, umbrellas: [], towers: [], benches: [] };
  city.named = []; city.crowds = []; city.crowdsLate = [];
  const name = (Z) => city.named.push({ S: Z.name, o: Z.o, x0: Z.x0, x1: Z.x1, z0: Z.z0, z1: Z.z1 });
  Object.values(ZONES).forEach(name);
  const W = BOUNDS;

  // ---------- occupancy: what the filler buildings must keep off (1 cell per unit, the land mask's grid) ----------
  // half-unit cells, so a building can sit right at the back of the sidewalk
  const R = 2, OW = MASK.w * R, OH = MASK.h * R, OCC = new Uint8Array(OW * OH);
  const cx_ = (x) => Math.floor((x - MASK.x0) * R), cz_ = (z) => Math.floor((z - MASK.z0) * R);
  const mark = (x0, z0, x1, z1) => { const a = Math.max(0, cx_(x0)), b = Math.min(OW - 1, cx_(x1 - 1e-4)), c = Math.max(0, cz_(z0)), d = Math.min(OH - 1, cz_(z1 - 1e-4)); for (let k = c; k <= d; k++) OCC.fill(1, k * OW + a, k * OW + b + 1); };
  const free = (x0, z0, x1, z1) => {
    const a = cx_(x0), b = cx_(x1 - 1e-4), c = cz_(z0), d = cz_(z1 - 1e-4);
    if (a < 0 || c < 0 || b >= OW || d >= OH) return false;
    for (let k = c; k <= d; k++) for (let i = a; i <= b; i++) if (OCC[k * OW + i]) return false;
    return isLand(x0, z0) && isLand(x1, z1) && isLand(x0, z1) && isLand(x1, z0);
  };
  const NEAR = new Uint8Array(MASK.w * MASK.h);
  const nearStreet = (x, z) => { const i = Math.floor(x - MASK.x0), k = Math.floor(z - MASK.z0); return i >= 0 && k >= 0 && i < MASK.w && k < MASK.h && NEAR[k * MASK.w + i] === 1; };
  const nearMark = (pts, r) => { for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = pts[k], [c, d] = pts[k + 1], L = Math.hypot(c - a, d - b), n = Math.max(1, Math.ceil(L / 2)); for (let t = 0; t <= n; t++) { const x = a + (c - a) * t / n - MASK.x0, z = b + (d - b) * t / n - MASK.z0; for (let kk = Math.max(0, Math.floor(z - r)); kk <= Math.min(MASK.h - 1, Math.floor(z + r)); kk++) NEAR.fill(1, kk * MASK.w + Math.max(0, Math.floor(x - r)), kk * MASK.w + Math.min(MASK.w, Math.floor(x + r) + 1)); } } };
  const markLine = (pts, r) => { for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = pts[k], [c, d] = pts[k + 1], L = Math.hypot(c - a, d - b), n = Math.max(1, Math.ceil(L / 0.4)); for (let t = 0; t <= n; t++) { const x = a + (c - a) * t / n, z = b + (d - b) * t / n; mark(x - r, z - r, x + r, z + r); } } };
  ctx.mark = mark; ctx.free = free; ctx.markLine = markLine;
  // the beach, the water and everything past the east edge are off limits to the filler
  for (let k = 0; k < OH; k++) for (let i = 0; i < OW; i++) { const x = MASK.x0 + (i + 0.5) / R, z = MASK.z0 + (k + 0.5) / R; if (!isLand(x, z) || seaDist(x, z) < BEACH_W + 1.5 || x > eastEdge(z) - 2) OCC[k * OW + i] = 1; }

  // ---------- land and water ----------
  const sand = '#d8c79c', seabed = '#2c5662', land = '#857f69';
  g.rect(W.x0 - 50, W.z0 - 50, W.x1 + 50, W.z1 + 50, land);
  g.grainRect(W.x0 - 50, W.z0 - 50, W.x1 + 50, W.z1 + 50, 0.32, 50);
  for (let k = 0; k < 9000; k++) g.circle(rand(W.x0, W.x1), rand(W.z0, W.z1), rand(0.3, 1.6), pick(['rgba(96,110,62,.22)', 'rgba(150,140,110,.18)', 'rgba(70,86,48,.2)']));   // dry lawns and scrub
  // the beach: a band of sand inside the coast all the way up (the harbor's jetties too), then the sea
  // which stretches of the coastline face the open Pacific (the beach) and which are inside the harbor and the
  // river mouth (rip-rap and seawall): the open coast is the westmost shore for its stretch of coast
  const CO = NC.coast[0], openAt = CO.map(([x, z]) => { let m = 1e9; for (const [a, b] of CO) if (Math.abs(b - z) < 45 && a < m) m = a; return x < m + 16; });
  const runs = (want) => { const out = []; let cur = null; CO.forEach((p, i) => { if (openAt[i] === want) { (cur ||= []).push(p); } else if (cur) { if (cur.length > 1) out.push(cur); cur = null; } }); if (cur && cur.length > 1) out.push(cur); return out; };
  const OPEN = runs(true), INNER = runs(false);
  const coastPath = (X, p) => { X.beginPath(); SEA.forEach(([a, b], i) => (i ? X.lineTo(p.px(a), p.pz(b)) : X.moveTo(p.px(a), p.pz(b)))); X.closePath(); };
  g.each((X, p) => {
    X.save(); X.beginPath(); X.rect(0, 0, p.res, p.res); SEA.forEach(([a, b], i) => (i ? X.lineTo(p.px(a), p.pz(b)) : X.moveTo(p.px(a), p.pz(b)))); X.closePath(); X.clip('evenodd');
    X.lineJoin = X.lineCap = 'round';
    const run = (pts) => { X.beginPath(); pts.forEach(([a, b], i) => (i ? X.lineTo(p.px(a), p.pz(b)) : X.moveTo(p.px(a), p.pz(b)))); };
    for (const r of OPEN) { run(r); X.strokeStyle = sand; X.lineWidth = BEACH_W * 2 * p.k; X.stroke(); X.strokeStyle = '#cdb98c'; X.lineWidth = 2.2 * p.k; X.stroke(); }   // the beach, wet sand at the water's edge
    for (const r of INNER) { run(r); X.strokeStyle = '#8f8b80'; X.lineWidth = 5 * p.k; X.stroke(); X.strokeStyle = '#6f6a62'; X.lineWidth = 2 * p.k; X.stroke(); }          // the harbor's paved edge and rip-rap
    X.restore();
    X.fillStyle = seabed; coastPath(X, p); X.fill();
    X.save(); coastPath(X, p); X.clip();                                                                    // the shallows off the beach
    X.lineJoin = 'round'; X.beginPath(); NC.coast[0].forEach(([a, b], i) => (i ? X.lineTo(p.px(a), p.pz(b)) : X.moveTo(p.px(a), p.pz(b))));
    for (const [w, c] of [[30, '#356a72'], [16, '#4f8a86'], [6, '#86ab98']]) { X.strokeStyle = c; X.lineWidth = w * p.k; X.stroke(); }
    X.restore();
  });
  for (let k = 0; k < 6000; k++) { const z = rand(W.z0, W.z1), x = rand(-70, 0); if (isLand(x, z) && seaDist(x, z) < BEACH_W) g.circle(x, z, rand(0.08, 0.4), Math.random() < 0.5 ? 'rgba(255,250,235,.2)' : 'rgba(150,130,96,.18)'); }
  for (const b of D.beach) g.poly(b.p, sand);
  // the lagoons and the river: open water, reedy edges
  for (const w of WATERS) { g.stroke([...w.p, w.p[0]], 2.4, '#6e7b4c'); g.poly(w.p, '#2f5a5e'); g.stroke([...w.p, w.p[0]], 0.8, 'rgba(120,130,80,.7)'); }
  for (const r of D.river) if (r.n !== 'San Luis Rey River') g.stroke(r.p, 1.2, '#3a6266');
  for (const w of WATERS) markLine([...w.p, w.p[0]], 2.5);

  // ---------- the freeway (I-5, CA-76) and its ramps ----------
  for (const f of D.freeway) { const w = f.h === 'motorway' ? 4.6 : f.h === 'trunk' ? 4.2 : 2.4; f.W = w; g.stroke(f.p, w + 2.2, '#8a8572'); markLine(f.p, w / 2 + 1.8); }
  for (const f of D.freeway) g.stroke(f.p, f.W, '#4d4e50');
  for (const f of D.freeway) if (f.h === 'motorway') { g.stroke(f.p, 0.08, 'rgba(238,238,232,.7)', [1, 1.6]); for (const o of [-1, 1]) g.stroke(offset(f.p, o * (f.W / 2 - 0.25)), 0.08, o < 0 ? 'rgba(226,186,60,.8)' : 'rgba(238,238,232,.75)'); }

  // ---------- the rail: the coast line (Coaster, Surfliner) and its sidings ----------
  for (const r of D.rail) { g.stroke(r.p, r.s ? 1.5 : 2.2, '#7a7064'); markLine(r.p, r.s ? 1.4 : 2.4); }
  for (const r of D.rail) { g.stroke(r.p, 1.1, 'rgba(70,52,40,.75)', [0.14, 0.3]); g.stroke(r.p, 0.72, '#c3c6ca'); g.stroke(r.p, 0.6, '#6e665c'); }

  // ---------- streets ----------
  const SW = city.sw, conc = '#b9b3a6', asphalt = '#4a4b4d';
  const edges = D.edges.map(([ax, i, j, w]) => { const a = { x: XS[i], z: ZS[j] }, b = ax ? { x: XS[i + 1], z: ZS[j] } : { x: XS[i], z: ZS[j + 1] }; return { ax, i, j, w: Math.max(3.6, Math.min(5, w)), a, b }; });
  const RES = ['residential', 'unclassified', 'living_street'];
  const lanes = D.paint.filter((p) => p.h !== 'pedestrian' && p.p.length > 1);
  // sidewalks first, asphalt over them, then the markings
  for (const e of edges) { const h = e.w / 2 + SW; e.ax ? g.rect(e.a.x - 0.2, e.a.z - h, e.b.x + 0.2, e.a.z + h, conc) : g.rect(e.a.x - h, e.a.z - 0.2, e.a.x + h, e.b.z + 0.2, conc); }
  for (const p of lanes) g.stroke(p.p, p.w + SW * 2, conc);
  for (const e of edges) { const h = e.w / 2; e.ax ? g.rect(e.a.x - h, e.a.z - h, e.b.x + h, e.a.z + h, asphalt) : g.rect(e.a.x - h, e.a.z - h, e.a.x + h, e.b.z + h, asphalt); }
  for (const p of lanes) g.stroke(p.p, p.w, RES.includes(p.h) ? '#505052' : asphalt);
  for (const p of D.paint.filter((q) => q.h === 'pedestrian')) g.stroke(p.p, p.w, '#cfc6b2');
  for (const e of edges) { const pts = [[e.a.x, e.a.z], [e.b.x, e.b.z]]; markLine(pts, e.w / 2 + SW); nearMark(pts, e.w / 2 + 10); }
  for (const p of lanes) { markLine(p.p, p.w / 2 + SW); if (RES.includes(p.h) || p.w >= 4) nearMark(p.p, p.w / 2 + 10); }
  // markings: a double yellow down the bigger streets, crossings at the signals
  const yel = 'rgba(226,186,60,.9)', white = 'rgba(238,238,232,.85)';
  for (const e of edges) {
    const L = e.ax ? e.b.x - e.a.x : e.b.z - e.a.z; if (L < 8) continue;
    if (e.w >= 4.2) for (const o of [-0.08, 0.08]) e.ax ? g.line(e.a.x + 3, e.a.z + o, e.b.x - 3, e.a.z + o, 0.07, yel) : g.line(e.a.x + o, e.a.z + 3, e.a.x + o, e.b.z - 3, 0.07, yel);
    if (e.w >= 5) for (const o of [-1.25, 1.25]) e.ax ? g.line(e.a.x + 3, e.a.z + o, e.b.x - 3, e.a.z + o, 0.06, white, [0.9, 1.4]) : g.line(e.a.x + o, e.a.z + 3, e.a.x + o, e.b.z - 3, 0.06, white, [0.9, 1.4]);
  }
  for (const n of city.nodes) {
    if (!n.lit || n.dead) continue;
    for (const m of n.edges) {
      const N = city.nodes[m], w = EK.get(ek(n, N)) || 4, hw = w / 2 - 0.3, v = N.x === n.x, s = v ? Math.sign(N.z - n.z) : Math.sign(N.x - n.x), c0 = (v ? n.z : n.x) + s * (w / 2 + 0.3);
      for (let t = -hw; t < hw; t += 0.55) v ? g.rect(n.x + t, Math.min(c0, c0 + s * 1.4), n.x + t + 0.3, Math.max(c0, c0 + s * 1.4), 'rgba(236,236,230,.82)') : g.rect(Math.min(c0, c0 + s * 1.4), n.z + t, Math.max(c0, c0 + s * 1.4), n.z + t + 0.3, 'rgba(236,236,230,.82)');
    }
  }
  g.grainRect(W.x0, W.z0, W.x1, W.z1, 0.12, 30);

  // ---------- landmarks' ground (js/ncworld.js builds them) ----------
  landmarks(ctx);

  // ---------- the buildings ----------
  // the village and downtown Oceanside: every block built out to the sidewalk, lot by lot, over paved ground
  for (const b of city.blocks) {
    const Z = zoneAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); if (Z !== 'village' && Z !== 'otown') continue;
    const x0 = b.x0 + SW + 0.8, x1 = b.x1 - SW - 0.8, z0 = b.z0 + SW + 0.8, z1 = b.z1 - SW - 0.8, Wd = x1 - x0, Dp = z1 - z0;
    if (Wd < 4 || Dp < 4) continue;
    g.rect(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, '#8e8a82'); g.grainRect(x0, z0, x1, z1, 0.25, 40);
    const xw = partition(Wd, Math.max(1, Math.round(Wd / rand(3.4, 5))), 2.6), zw = partition(Dp, Math.max(1, Math.round(Dp / rand(4.5, 7))), 3);
    let x = x0;
    for (const pw of xw) {
      let z = z0;
      for (const pd of zw) {
        const o = lot(Z, true), sw = Math.random() < 0.25 ? rand(0.3, 1) : 0.15, sd = Math.random() < 0.25 ? rand(0.3, 1) : 0.15;
        const cx = x + pw / 2, cz = z + pd / 2, w = Math.max(2.2, pw - sw), d = Math.max(2.2, pd - sd);
        if (Math.random() > 0.08 && free(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2)) {
          const bb = B.add({ x: cx, z: cz, w, d, floors: o.floors, style: o.style, tint: o.tint, cell: o.cell, gh: o.gh, fh: o.fh, storefront: true });
          mark(cx - w / 2 - 0.05, cz - d / 2 - 0.05, cx + w / 2 + 0.05, cz + d / 2 + 0.05);
          if (Math.random() < 0.5) bb.noSigns = false;
        }
        z += pd;
      }
      x += pw;
    }
    if (Math.random() < 0.6) city.treesAlongBlock({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }, 6, Z === 'village' ? 'round' : 'palm', 0.75);
  }
  // everywhere else: along every street, both sides, in the local style
  const lotsAlong = (ax, az, bx, bz, w, major) => {
    const L = Math.hypot(bx - ax, bz - az); if (L < 4) return;
    const dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
    for (const s of [-1, 1]) {
      let t = 2.4;
      while (t < L - 2.4) {
        const x = ax + dx * t, z = az + dz * t, Z = zoneAt(x + nx * s * 5, z + nz * s * 5);
        const o = lot(Z, major);
        const along = Math.abs(dx) > Math.abs(dz);                    // the street runs along x: the lot's width is along x
        const bw = along ? o.w : o.d, bd = along ? o.d : o.w;
        const off = w / 2 + SW + Math.max(0.3, o.set) + (along ? bd : bw) / 2;
        const cx = x + nx * s * off + dx * o.w / 2, cz = z + nz * s * off + dz * o.w / 2;
        if (cx > eastEdge(cz) - 3) { t += o.w + o.gap; continue; }
        if (free(cx - bw / 2 - 0.05, cz - bd / 2 - 0.05, cx + bw / 2 + 0.05, cz + bd / 2 + 0.05)) {
          const b = B.add({ x: cx, z: cz, w: bw, d: bd, floors: o.floors, style: o.style, tint: o.tint, cell: o.cell, gh: o.gh, fh: o.fh, gable: o.gable, roofTint: o.roof, storefront: o.shop });
          if (!o.shop) b.noSigns = true;
          mark(cx - bw / 2 - 0.1, cz - bd / 2 - 0.1, cx + bw / 2 + 0.1, cz + bd / 2 + 0.1);
          if (o.tree && Math.random() < o.tree) { const tx = x + nx * s * (w / 2 + SW * 0.55), tz = z + nz * s * (w / 2 + SW * 0.55); city.addTree(tx, tz, rand(0.7, 1), Z === 'beachfront' || Z === 'village' || Math.random() < 0.3 ? 'palm' : 'round'); }
          t += o.w + o.gap;
        } else t += 1.2;
      }
    }
  };
  for (const e of edges) lotsAlong(e.a.x, e.a.z, e.b.x, e.b.z, e.w, e.w >= 4.6);
  for (const p of lanes) for (let k = 0; k + 1 < p.p.length; k++) lotsAlong(p.p[k][0], p.p[k][1], p.p[k + 1][0], p.p[k + 1][1], p.w, p.w >= 4.6);
  // the rest of the land near the streets: back houses, granny flats, the buildings behind the shops downtown
  // (a street within ~9 units, so open ground, the lagoon banks and the hills stay open)
  for (let z = W.z0 + 4; z < W.z1 - 4; z += 3.9) for (let x = W.x0 + 4; x < W.x1 - 4; x += 3.9) {
    const xx = x + rand(-0.4, 0.4), zz = z + rand(-0.4, 0.4);
    if (!nearStreet(xx, zz)) continue;
    const Z = zoneAt(xx, zz); if (Z === 'harbor' && Math.random() < 0.6) continue;
    const busy = Z === 'village' || Z === 'otown';
    if (!busy && Math.random() < 0.22) continue;                       // yards, empty lots
    const o = lot(Z, busy), w = Math.min(o.w, 3.5), d = Math.min(o.d, 3.5), cx = xx, cz = zz;
    if (cx > eastEdge(cz) - 3 || !free(cx - w / 2 - 0.05, cz - d / 2 - 0.05, cx + w / 2 + 0.05, cz + d / 2 + 0.05)) continue;
    const bb = B.add({ x: cx, z: cz, w, d, floors: busy ? o.floors : Math.min(o.floors, 2), style: o.style, tint: o.tint, cell: o.cell, gh: o.gh, fh: o.fh, gable: o.gable, roofTint: o.roof, storefront: false });
    bb.noSigns = true; mark(cx - w / 2 - 0.1, cz - d / 2 - 0.1, cx + w / 2 + 0.1, cz + d / 2 + 0.1);
    if (!busy && Math.random() < 0.3) city.addTree(cx + rand(-2, 2), cz + d / 2 + 0.9, rand(0.8, 1.1), Math.random() < 0.35 ? 'palm' : 'round');
  }
  // Harbor Village: the grey-shingled Cape Cod shops and restaurants round the marina, with their parking
  { let n = 0; const H = ZONES.harbor;
    for (let z = H.z0 + 6; z < H.z1 - 4 && n < 60; z += 3.2) for (let x = H.x0 + 4; x < H.x1 - 4 && n < 60; x += 3.4) {
      const wet = landAt(x + 12, z) !== 2 || landAt(x - 12, z) !== 2 || landAt(x, z + 12) !== 2 || landAt(x, z - 12) !== 2;
      if (!wet || !isLand(x, z)) continue;
      const w = rand(2.4, 3.2), d = rand(2.4, 3);
      if (!free(x - w / 2 - 0.2, z - d / 2 - 0.2, x + w / 2 + 0.2, z + d / 2 + 0.2)) continue;
      const bb = B.add({ x, z, w, d, floors: Math.random() < 0.3 ? 2 : 1, style: 'house', tint: CAPECOD(), cell: 1.6, gh: 1.15, fh: 0.95, gable: true, roofTint: SHINGLE(), storefront: true });
      bb.noSigns = Math.random() < 0.5; mark(x - w / 2 - 0.4, z - d / 2 - 0.4, x + w / 2 + 0.4, z + d / 2 + 0.4); n++;
      if (Math.random() < 0.4) city.crowds.push({ x: x + rand(-2, 2), z: z + d / 2 + 0.8, r: 0.5, n: Math.round(rand(2, 4)) });
    }
    // the lots behind the marina
    for (let z = H.z0 + 10; z < H.z1 - 10; z += 13) for (let x = H.x0 + 10; x < H.x1 - 10; x += 15) {
      if (!isLand(x, z) || !free(x - 5.5, z - 4, x + 5.5, z + 4)) continue;
      const spots = city.paintParking(g, x - 5.5, z - 4, x + 5.5, z + 4); for (const sp of spots) if (Math.random() < 0.6) city.parked.push(sp); mark(x - 5.5, z - 4, x + 5.5, z + 4);
    }
  }
  // lamps along the bigger streets
  for (const e of edges) if (e.w >= 4.2) {
    const L = e.ax ? e.b.x - e.a.x : e.b.z - e.a.z;
    for (let t = 4; t < L - 3; t += 9) for (const s of [-1, 1]) { const o = e.w / 2 + 0.35; e.ax ? city.addLamp(e.a.x + t, e.a.z + s * o, s > 0 ? 0 : Math.PI) : city.addLamp(e.a.x + s * o, e.a.z + t, s > 0 ? Math.PI / 2 : -Math.PI / 2); }
  }
  // people: on the village and downtown sidewalks, along the beach, on the pier
  for (const b of city.blocks) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, Z = zoneAt(cx, cz), busy = Z === 'village' || Z === 'otown' ? 1 : Z === 'beachfront' ? 0.5 : 0.15;
    for (const [x, z] of [[b.x0 + 0.9, b.z0 + 0.9], [b.x1 - 0.9, b.z1 - 0.9]]) if (Math.random() < busy * 0.6) city.crowds.push({ x, z, r: 0.7, n: Math.round(rand(2, 5)) });
  }
  beach(ctx);

  // where people can't go: the open sea past the surf, the lagoons, the river and the harbor (the pier is fine)
  city.deepWater = (x, z) => { const l = landAt(x, z); if (l === 2) return false; if (l === 0 && seaDist(x, z) === 0 && nearLand(x, z, 3)) return false; return !(z > PIER.z - PIER.w && z < PIER.z + PIER.w && x > PIER.x0 - 1 && x < PIER.x1 + 2); };
  city.isLand = isLand;
  city.inBounds = (x, z) => x > W.x0 + 2 && x < eastEdge(z) - 1 && z > W.z0 + 2 && z < W.z1 - 2;
  return { ...ctx, grounds: g.list, agents: { cars: 92, peds: 560, wanderFrac: 0.2 }, fog: 0xc9d2d6, start: { x: 12, z: -6 }, ownBackdrop: true,
    xMin: -150, xMax: W.x1 - 4, zMin: W.z0 + 10, zMax: W.z1 - 6, maxD: 230, yaw: 0.32 };
}
const nearLand = (x, z, r) => isLand(x + r, z) || isLand(x - r, z) || isLand(x, z + r) || isLand(x, z - r);
// a polyline moved sideways by d
function offset(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - (b[1] - a[1]) / L * d, p[1] + (b[0] - a[0]) / L * d];
  });
}

// what goes on a lot: by zone, and by the street (the bigger streets get shops)
function lot(Z, major) {
  if (Z === 'village') return { w: rand(2.8, 4.4), d: rand(4.5, 6.5), gap: rand(0.05, 0.35), set: 0.1, floors: pick([1, 2, 2, 2, 3]), style: pick(['stucco', 'stucco', 'brick', 'stucco']), tint: STUCCO(), cell: 1.5, gh: 1.4, fh: 0.95, shop: true, tree: 0.35 };
  if (Z === 'otown') return { w: rand(3.2, 6), d: rand(5, 8), gap: rand(0.05, 0.4), set: 0.1, floors: pick([2, 2, 3, 3, 4, 5, 6]), style: pick(['stucco', 'concrete', 'stucco', 'office']), tint: STUCCO(), cell: 1.6, gh: 1.5, fh: 1, shop: true, tree: 0.4 };
  if (Z === 'harbor') return { w: rand(2.6, 3.6), d: rand(3, 4), gap: rand(0.6, 1.6), set: 0.8, floors: pick([1, 1, 2]), style: 'house', tint: CAPECOD(), cell: 1.7, gh: 1.1, fh: 0.95, gable: true, roof: SHINGLE(), tree: 0.2 };
  if (Z === 'beachfront') return { w: rand(3, 5.2), d: rand(3.6, 6), gap: rand(0.4, 1.1), set: 0.5, floors: pick([2, 2, 3, 3, 4]), style: 'stucco', tint: BEACHY(), cell: 1.6, gh: 1.3, fh: 0.95, shop: major && Math.random() < 0.4, tree: 0.5 };
  if (Z === 'barrio') return major ? { w: rand(3, 4.4), d: rand(4, 6), gap: rand(0.1, 0.6), set: 0.2, floors: pick([1, 1, 2]), style: pick(['stucco', 'flat', 'stucco']), tint: BARRIO(), cell: 1.6, gh: 1.3, fh: 0.95, shop: true, tree: 0.2 }
    : { w: rand(2.2, 2.9), d: rand(2.6, 3.4), gap: rand(0.9, 1.8), set: 0.9, floors: 1, style: 'house', tint: BARRIO(), cell: 1.5, gh: 1.1, fh: 0.95, gable: Math.random() < 0.6, roof: Math.random() < 0.5 ? TILE() : SHINGLE(), tree: 0.35 };
  if (major) return { w: rand(3.6, 6), d: rand(4.5, 7), gap: rand(0.6, 2.5), set: rand(0.4, 2.2), floors: pick([1, 1, 2, 2, 3]), style: pick(['stucco', 'flat', 'concrete', 'stucco']), tint: STUCCO(), cell: 1.8, gh: 1.4, fh: 1, shop: true, tree: 0.4 };
  return { w: rand(2.4, 3.2), d: rand(2.8, 3.6), gap: rand(0.8, 1.6), set: rand(0.8, 1.4), floors: Math.random() < 0.3 ? 2 : 1, style: 'house', tint: STUCCO(), cell: 1.6, gh: 1.1, fh: 0.95, gable: Math.random() < 0.7, roof: Math.random() < 0.55 ? TILE() : SHINGLE(), tree: 0.4 };
}

// ---------- the landmarks' footprints and the ground under them (the structures: js/ncworld.js) ----------
function landmarks(ctx) {
  const { city, g, B, mark } = ctx, P = PLACES, N = city.nc;
  const plaza = (x0, z0, x1, z1, c = '#c9c0ad') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.2, 40); mark(x0, z0, x1, z1); };
  const lot = (x0, z0, x1, z1) => { const s = city.paintParking(g, x0, z0, x1, z1); for (const p of s) if (Math.random() < 0.7) city.parked.push(p); mark(x0, z0, x1, z1); };
  const park = (x0, z0, x1, z1, trees = 10) => { city.paintGrass(g, x0, z0, x1, z1, '#6f8a46'); for (let k = 0; k < trees; k++) city.addTree(rand(x0 + 1, x1 - 1), rand(z0 + 1, z1 - 1), rand(1, 1.4), Math.random() < 0.3 ? 'palm' : 'round'); city.wanderZones.push({ x0: x0 + 0.5, x1: x1 - 0.5, z0: z0 + 0.5, z1: z1 - 0.5 }); mark(x0, z0, x1, z1); };
  // the Carlsbad sign spans Carlsbad Blvd just north of Carlsbad Village Dr; the blue Victorian is on the north-east corner
  const cb = 2.91;                                            // Carlsbad Blvd's grid line through the village
  N.arch = { x: cb, z: -4.6, span: 9.4 };
  N.victorian = { x: cb + 8, z: -9, w: 6.6, d: 5.2 };
  plaza(cb + 3.4, -16.6, cb + 15.6, -3.4, '#a96f5a');          // its brick terrace and the corner plaza
  g.circle(cb + 4.4, -4.4, 1.3, '#4f9fb5'); g.circle(cb + 4.4, -4.4, 0.9, '#e7c45a');   // the tile medallion at the corner
  lot(cb + 4, -21, cb + 15.6, -17);
  // Carlsbad Village station: platforms both sides of the tracks by Grand Ave, a lot beside it
  const cs = P.carlsbadStation; N.cstation = { x: railX(cs.z), z: cs.z, len: 26 };
  plaza(N.cstation.x - 4.2, cs.z - 14, N.cstation.x + 4.2, cs.z + 14, '#bdb6a6'); lot(N.cstation.x + 4.6, cs.z - 12, N.cstation.x + 14, cs.z + 4);
  // the Barrio's parks
  park(P.pinePark.x - 9, P.pinePark.z - 8, P.pinePark.x + 9, P.pinePark.z + 8, 12);
  park(P.holidayPark.x - 8, P.holidayPark.z - 7, P.holidayPark.x + 8, P.holidayPark.z + 7, 14);
  park(P.magee.x - 5, P.magee.z - 5, P.magee.x + 5, P.magee.z + 5, 8);
  // Carlsbad High: classrooms round a quad, the football field and track behind
  const ch = P.carlsbadHigh;
  plaza(ch.x - 18, ch.z - 22, ch.x + 2, ch.z + 2, '#b3ab9a');
  g.rect(ch.x - 14, ch.z + 4, ch.x + 4, ch.z + 30, '#9a4a3a'); g.rect(ch.x - 12, ch.z + 6.5, ch.x + 2, ch.z + 27.5, '#4f8a3a'); mark(ch.x - 14, ch.z + 4, ch.x + 4, ch.z + 30);
  for (let z = ch.z + 9; z < ch.z + 26; z += 2.2) g.line(ch.x - 12, z, ch.x + 2, z, 0.06, 'rgba(255,255,255,.6)');
  // downtown Oceanside: the Transit Center (Coaster, Sprinter, Amtrak, the buses), Civic Center, the cinema plaza
  const tc = P.transit; N.transit = { x: railX(tc.z), z: tc.z, len: 30 };
  plaza(N.transit.x - 4.5, tc.z - 16, N.transit.x + 4.5, tc.z + 16, '#bdb6a6');
  plaza(N.transit.x + 5, tc.z - 12, N.transit.x + 19, tc.z + 6, '#8e8c86');           // the bus bays
  for (let z = tc.z - 10; z < tc.z + 5; z += 3.4) g.rect(N.transit.x + 6, z, N.transit.x + 18, z + 0.12, 'rgba(240,240,235,.7)');
  N.civic = { x: P.cityHallO.x, z: P.cityHallO.z };
  plaza(N.civic.x - 10, N.civic.z - 8, N.civic.x + 10, N.civic.z + 8, '#d6cfbf');
  g.circle(N.civic.x, N.civic.z + 3, 2, '#5a8fb0');
  N.regal = { x: P.regal.x, z: P.regal.z };
  plaza(N.regal.x - 8, N.regal.z - 6, N.regal.x + 8, N.regal.z + 8, '#d9d3c6');
  // the pier's foot: the amphitheater and its white bridge, the resorts either side, Pier View Way stepping down to the beach
  const pz = PIER.z; N.pierFoot = { x: PIER.x1, z: pz };
  plaza(PIER.x1 - 4, pz - 7, PIER.x1 + 34, pz + 7, '#d8d2c4');
  // the resorts either side of Pier View Way: the Wyndham north of it, Mission Pacific south, the Seabird past Mission Ave
  const hx = -27;                                             // between Pacific St and Myers St
  N.hotels = [
    { x: hx, z: pz - 11.5, w: 14, d: 13, floors: 7, name: 'PIER RESORT', tint: hsl(0.58, 0.1, 0.72), style: 'concrete' },
    { x: hx, z: pz + 11, w: 14, d: 12, floors: 6, name: 'MISSION PACIFIC', tint: hsl(0.11, 0.18, 0.92), style: 'stucco', tile: true },
    { x: hx, z: P.seabird.z + 2, w: 14, d: 12, floors: 5, name: 'THE SEABIRD', tint: hsl(0.1, 0.16, 0.9), style: 'stucco', tile: true },
  ];
  N.hotelB = N.hotels.map((h) => { const b = B.add({ x: h.x, z: h.z, w: h.w, d: h.d, floors: h.floors, style: h.style, tint: h.tint, cell: 1.75, gh: 1.4, fh: 1, setbacks: [{ f: h.floors - 1, n: 1 }] }); b.noSigns = true; b.landmark = true; b.name = h.name; mark(h.x - h.w / 2 - 1, h.z - h.d / 2 - 1, h.x + h.w / 2 + 1, h.z + h.d / 2 + 1); return { ...h, b }; });
  // the Victorian on the corner: two storeys of blue shingle (its turrets and roofs are js/ncworld.js)
  { const V = N.victorian; N.victorianB = B.add({ x: V.x, z: V.z, w: V.w, d: V.d, floors: 2, style: 'house', tint: hsl(0.56, 0.38, 0.62), cell: 1.6, gh: 1.35, fh: 1.1 }); N.victorianB.noSigns = true; N.victorianB.landmark = true; N.victorianB.name = 'the Victorian'; }
  // the cinema plaza's castle: white, navy towers
  N.regal = { x: P.regal.x - 4, z: P.regal.z - 1, w: 14, d: 9 };
  N.regalB = B.add({ x: N.regal.x, z: N.regal.z, w: N.regal.w, d: N.regal.d, floors: 3, style: 'stucco', tint: hsl(0.1, 0.06, 0.95), cell: 1.8, gh: 1.6, fh: 1.1 }); N.regalB.noSigns = true; N.regalB.landmark = true; N.regalB.name = 'the cinema';
  mark(N.regal.x - 8, N.regal.z - 6, N.regal.x + 8, N.regal.z + 6);
  // Civic Center: Irving Gill's white arcades round a courtyard
  N.civic.w = 16; N.civic.d = 6;
  N.civicB = B.add({ x: N.civic.x, z: N.civic.z - 4, w: 16, d: 6, floors: 2, style: 'stucco', tint: hsl(0.1, 0.1, 0.93), cell: 1.6, gh: 1.5, fh: 1.1 }); N.civicB.noSigns = true; N.civicB.landmark = true; N.civicB.name = 'Civic Center';
  // the Transit Center's depot east of the platforms
  N.depot = { x: N.transit.x + 9.5, z: tc.z + 11, w: 8, d: 7 };
  N.depotB = B.add({ x: N.depot.x, z: N.depot.z, w: 8, d: 7, floors: 2, style: 'stucco', tint: hsl(0.1, 0.25, 0.86), cell: 1.6, gh: 1.6, fh: 1.1 }); N.depotB.noSigns = true;
  mark(N.depot.x - 5, N.depot.z - 5, N.depot.x + 5, N.depot.z + 5);
  // Carlsbad High: two wings of classrooms and the gym
  N.chs = { x: ch.x - 8, z: ch.z - 12, d: 5 };
  N.chsB = B.add({ x: ch.x - 8, z: ch.z - 12, w: 18, d: 5, floors: 2, style: 'concrete', tint: hsl(0.1, 0.12, 0.82), cell: 1.8, gh: 1.5, fh: 1.1 }); N.chsB.noSigns = true; N.chsB.name = 'Carlsbad High';
  B.add({ x: ch.x - 14, z: ch.z - 3, w: 6, d: 9, floors: 2, style: 'concrete', tint: hsl(0.1, 0.12, 0.8), cell: 1.8, gh: 1.5, fh: 1.1 }).noSigns = true;
  B.add({ x: ch.x - 3, z: ch.z - 2, w: 8, d: 7, floors: 2, style: 'flat', tint: hsl(0.6, 0.12, 0.6), cell: 2, gh: 2.2, fh: 1.2 }).noSigns = true;
  // Coast Highway station (South Oceanside): a platform by Oceanside Blvd
  if (P.coastHwyStation) { N.coastHwy = { x: railX(P.coastHwyStation.z), z: P.coastHwyStation.z, len: 20 }; plaza(N.coastHwy.x - 4, N.coastHwy.z - 10, N.coastHwy.x + 4, N.coastHwy.z + 10, '#bdb6a6'); }
  // the coast's resorts and inns in Carlsbad, on the ocean side of Carlsbad Blvd
  for (const n of ['Carlsbad Inn Beach Resort', 'Tamarack Beach Resort', 'Ocean Palms Beach Resort', 'Beach Terrace Inn']) { const p = NC.poi.find((q) => q.n === n); if (p) (N.inns ||= []).push({ x: p.x, z: p.z, name: n }); }
  // the harbor: Harbor Village (the Cape Cod shops), docks and slips, the jetties
  N.docks = NC.piers.filter((p) => p.k === 'pier' && p.p.length >= 2 && p.n !== 'Oceanside Pier' && p.p[0][1] < -700);
  N.jetties = NC.piers.filter((p) => p.k === 'breakwater' || p.k === 'groyne');
}
// the main line's x where it crosses z (the rail runs up the coast)
export function railX(z) {
  let best = null, bd = 1e9;
  for (const r of NC.rail) { if (r.s) continue; for (let k = 0; k + 1 < r.p.length; k++) { const [a, b] = r.p[k], [c, d] = r.p[k + 1]; if ((b - z) * (d - z) <= 0 && b !== d) { const x = a + (c - a) * (z - b) / (d - b); const dd = Math.abs(x - 30); if (dd < bd) { bd = dd; best = x; } } } }
  return best ?? 30;
}

// the beach: umbrellas, towels, lifeguard towers, the Strand's palms, people on the sand
function beach(ctx) {
  const { city } = ctx, N = city.nc;
  const shoreX = (z) => { for (let x = -120; x < 80; x += 0.5) if (isLand(x, z)) return x; return null; };
  N.shoreX = shoreX;
  for (let z = BOUNDS.z0 + 40; z < BOUNDS.z1 - 30; z += rand(2.2, 4)) {
    const sx = shoreX(z); if (sx == null || inZ(ZONES.harbor, sx, z) || Math.abs(z - PIER.z) < 4) continue;
    if (seaDist(sx + 3, z) > BEACH_W + 1) continue;           // no beach here (river mouth, jetties)
    const busy = (z > -680 && z < -520) || (z > -100 && z < 140) ? 1 : 0.35;
    if (Math.random() < 0.55 * busy) {
      const x = sx + rand(2.5, BEACH_W - 1.5);
      city.addProp('umbrella', x, z, 0, 1); city.props[city.props.length - 1].color = hsl(Math.random(), 0.7, 0.55);
      city.addProp('towel', x + 0.4, z + 0.6, rand(-0.4, 0.4), 1); city.props[city.props.length - 1].color = hsl(Math.random(), 0.6, 0.6);
    }
    if (Math.random() < 0.08 * busy) city.crowds.push({ x: sx + rand(2, BEACH_W - 1), z, r: 0.9, n: Math.round(rand(2, 5)) });
  }
  for (let z = BOUNDS.z0 + 60; z < BOUNDS.z1 - 40; z += 70) { const sx = shoreX(z); if (sx != null && seaDist(sx + 3, z) < BEACH_W + 1 && !inZ(ZONES.harbor, sx, z)) N.towers.push({ x: sx + BEACH_W - 2.6, z }); }
  // walking the sand
  for (let z = BOUNDS.z0 + 60; z < BOUNDS.z1 - 40; z += 40) { const sx = shoreX(z); if (sx != null && !inZ(ZONES.harbor, sx, z)) city.wanderZones.push({ x0: sx + 1.5, x1: sx + BEACH_W - 1.5, z0: z - 18, z1: z + 18 }); }
  // the pier itself: people fishing and strolling (the deck is up above the water)
  for (let x = PIER.x0 + 6; x < PIER.x1 - 4; x += rand(8, 14)) city.crowdsLate.push({ x, z: PIER.z + rand(-0.6, 0.6), r: 0.5, n: Math.round(rand(1, 3)), y: 1.55 });
}

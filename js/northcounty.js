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
import { NC, BOUNDS, PATCHES, SEA, WATERS, PLACES, PIER, isLand, landAt, seaDist, eastEdge, hillEdge, MASK, maskData, BEACH_W, inPoly } from './ncgeo.js';
import { places } from './ncplaces.js';
import { RAIL, railGround } from './ncrail.js';

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

// ---------- which streets make the map: fewer, real ones ----------
// OSM has every cul-de-sac and alley; the map keeps the through streets (tertiary and up) everywhere, the full street
// grid only in the places people know by their streets (the Village, the Barrio, downtown, the beach blocks, the
// harbor), and drops whatever runs into the water, past the east edge, ends in a stub or floats unconnected.
// Where a kept street crosses a lagoon or the river it gets a bridge (ROADS.bridges, built in js/ncworld.js).
const CORES = [
  { x0: -10, x1: 95, z0: -80, z1: 34 },            // Carlsbad Village
  { x0: 40, x1: 150, z0: 30, z1: 240 },            // the Barrio
  { x0: -45, x1: 36, z0: -140, z1: 300 },          // the beach blocks west of the tracks, Carlsbad
  { x0: -45, x1: 125, z0: -660, z1: -520 },        // downtown Oceanside
  { x0: -45, x1: 165, z0: -520, z1: -282, grid: true },   // South Oceanside's grid, the beach to I-5 (its side streets off the grid stay out)
  { x0: -90, x1: 25, z0: -950, z1: -705 },         // the harbor
];
// side streets the map keeps whatever the rules say, because a place on them is in the game (js/ncplaces.js)
const KEEP_STREETS = [
  { n: 'Anchor Way', x0: 40, x1: 112, z0: 185, z1: 200 },
  { n: 'Chestnut Avenue', x0: 85, x1: 116, z0: 100, z1: 112 },   // past Pine Avenue Park, to the roundabout at Jefferson
];
// streets js/ncplaces.js draws itself, from their OSM centre lines, round the places on them
const DRAWN_STREETS = ['Hibiscus Circle', 'Nautical Drive'];
const inCore = (x, z, grid = true) => CORES.some((C) => (grid || !C.grid) && x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1);
const MAJOR_W = 4.2, MAJOR_H = ['primary', 'secondary', 'tertiary'];
const HALF5 = 4.5;                                   // half of I-5's width (js/ncfreeway.js builds it)
// samples along a polyline: [x, z, land?]
function samples(pts, step = 1) {
  const out = [];
  for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = pts[k], [c, d] = pts[k + 1], n = Math.max(1, Math.ceil(Math.hypot(c - a, d - b) / step)); for (let t = k ? 1 : 0; t <= n; t++) { const x = a + (c - a) * t / n, z = b + (d - b) * t / n; out.push([x, z, isLand(x, z) || isLand(x + 0.8, z) && isLand(x - 0.8, z) && isLand(x, z + 0.8) && isLand(x, z - 0.8)]); } }
  return out;
}
// the stretches of a polyline that are over water: [[x, z]...] runs (a bridge each)
function wetRuns(pts) {
  const S = samples(pts, 0.5), runs = []; let cur = null;
  for (const s of S) { if (!s[2]) (cur ||= []).push([s[0], s[1]]); else if (cur) { runs.push(cur); cur = null; } }
  if (cur) runs.push(cur);
  return runs;
}
export const ROADS = (() => {
  const D = NC, XS = D.xs, ZS = D.zs;
  const east = (x, z) => x > eastEdge(z) - 2 || z < BOUNDS.z0 + 1 || z > BOUNDS.z1 - 1;          // past the playable land
  const geo = (e) => { const [ax, i, j] = e; return ax ? [[XS[i], ZS[j]], [XS[i + 1], ZS[j]]] : [[XS[i], ZS[j]], [XS[i], ZS[j + 1]]]; };
  // the freeways up to where the hills take over (js/ncworld.js paints them on into the distance)
  const freeway = [];
  for (const f of D.freeway) {
    let cur = [];
    for (const [x, z] of samples(f.p, 2)) { if (x < hillEdge(z) + 1 && z > BOUNDS.z0 && z < BOUNDS.z1) cur.push([x, z]); else { if (cur.length > 1) freeway.push({ ...f, p: cur }); cur = []; } }
    if (cur.length > 1) freeway.push({ ...f, p: cur });
  }
  // I-5 as one road: OSM has its two carriageways, but squeezed inland they run 1.5 to 6 units apart, so the map
  // builds a single divided freeway on the line between them (js/ncfreeway.js)
  const i5 = (() => {
    const ch = joinLines(freeway.filter((f) => f.h === 'motorway' && /San Diego Freeway|I 5/.test(f.n)).map((f) => f.p), 1).sort((a, b) => lineLen(b) - lineLen(a));
    if (ch.length < 2) return ch[0] || [];
    const [A, Bq] = ch, SB = samples(Bq, 1), mid = [];
    for (const [x, z] of samples(A, 2)) { let best = null, bd = 1e9; for (const q of SB) { const d = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (d < bd) { bd = d; best = q; } } mid.push(bd < 100 ? [(x + best[0]) / 2, (z + best[1]) / 2] : [x, z]); }
    return mid.map((p, k) => { let sx = 0, sz = 0, n = 0; for (let j = Math.max(0, k - 4); j <= Math.min(mid.length - 1, k + 4); j++) { sx += mid[j][0]; sz += mid[j][1]; n++; } return [sx / n, sz / n]; });
  })();
  const IH = new Map(), ik = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  i5.forEach((p, k) => { const key = ik(p[0], p[1]); (IH.get(key) || IH.set(key, []).get(key)).push(p); });
  const i5Dist = (x, z) => { let m = 1e9; const cx = Math.floor(x / 4), cz = Math.floor(z / 4); for (let a = cx - 2; a <= cx + 2; a++) for (let b = cz - 2; b <= cz + 2; b++) for (const p of IH.get(`${a},${b}`) || []) m = Math.min(m, Math.hypot(p[0] - x, p[1] - z)); return m; };
  // a street that runs along under the freeway (rather than crossing it) is in the way of its embankment
  const UNDER = 7.5, longUnder = (S) => { let run = 0; for (const s of S) { run = i5Dist(s[0], s[1]) < UNDER ? run + 1 : 0; if (run > 18) return true; } return false; };
  // and one that runs along right beside the railway (crossing it is a level crossing)
  const RAILSIDE = 4.6, alongRail = (S) => { let run = 0; for (const s of S) { run = RAIL.dist(s[0], s[1]) < RAILSIDE ? run + 1 : 0; if (run > 14) return true; } return false; };
  // the streets off the grid: the through streets, and the side streets in the core places; cut where they leave the land
  // (Coast Highway's bridge over Buena Vista Lagoon isn't in the extract: it joins Carlsbad Blvd to South Coast Highway)
  // the extract hands each street over in many short pieces: join each named street's pieces into whole lines first
  const byName = new Map(), whole = [];
  for (const p of D.paint) { if (!p.n || p.h === 'pedestrian') { whole.push(p); continue; } const k = `${p.n}|${p.h}`; (byName.get(k) || byName.set(k, []).get(k)).push(p); }
  for (const list of byName.values()) {
    // a divided road is two one-way strips a few units apart: keep one (the pieces that mostly run beside one kept
    // already go), then join what's left end to end
    const keep = [], H2 = new Set(), hk2 = (x, z) => `${Math.round(x / 2)},${Math.round(z / 2)}`;
    const beside = (x, z) => { for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (H2.has(`${Math.round(x / 2) + a},${Math.round(z / 2) + b}`)) return true; return false; };
    for (const p of list.slice().sort((a, b) => lineLen(b.p) - lineLen(a.p))) {
      const S = samples(p.p, 1), mid = S.slice(5, -5), n = mid.filter(([x, z]) => beside(x, z)).length;   // (its ends may touch the next piece)
      if (mid.length > 2 && n > 0.7 * mid.length) continue;
      keep.push(p); for (const [x, z] of S) H2.add(hk2(x, z));
    }
    for (const pts of joinLines(keep.map((p) => p.p), 4.5, true)) whole.push({ ...list[0], p: pts });
  }
  const src = [...whole, { h: 'primary', w: 5, n: 'Coast Highway', p: [[39.19, -236], [39.19, -173]] },
    { h: 'secondary', w: 4.6, n: 'Harbor Drive', p: [[-17, -755], [-10, -766], [18, -766], [25, -780], [23, -800]] }];   // and Pacific St's bridge round the basin to Harbor Dr
  const paint = [];
  for (const p of src) {
    if (p.p.length < 2 || DRAWN_STREETS.includes(p.n)) continue;
    const major = MAJOR_H.includes(p.h);
    const S = samples(p.p, 1);
    const ok = S.map(([x, z, land]) => !east(x, z) && (major || inCore(x, z, x < 40)) && (land || major));
    // and not where it runs along under I-5 (crossing under it is fine)
    for (let k = 0; k < S.length;) { if (i5Dist(S[k][0], S[k][1]) >= UNDER) { k++; continue; } let e = k; while (e < S.length && i5Dist(S[e][0], S[e][1]) < UNDER) e++; if (e - k > 18) for (let j = k; j < e; j++) ok[j] = false; k = e; }
    // nor where it runs along right beside the tracks
    for (let k = 0; k < S.length;) { if (RAIL.dist(S[k][0], S[k][1]) >= RAILSIDE) { k++; continue; } let e = k; while (e < S.length && RAIL.dist(S[e][0], S[e][1]) < RAILSIDE) e++; if (e - k > 14) for (let j = k; j < e; j++) ok[j] = false; k = e; }
    let cur = [];
    const force = KEEP_STREETS.some((K) => K.n === p.n && S.some(([x, z]) => x > K.x0 && x < K.x1 && z > K.z0 && z < K.z1));
    const flush = () => { if (cur.length > (major ? 1 : 16) || force && cur.length > 1) paint.push({ ...p, p: cur, force }); cur = []; };
    S.forEach(([x, z], k) => { if (ok[k] || force && !east(x, z)) cur.push([+x.toFixed(2), +z.toFixed(2)]); else flush(); });
    flush();
  }
  // close the little gaps in a through street (the extract breaks them where a bit ran on the grid or off the map)
  const ends = paint.filter((p) => MAJOR_H.includes(p.h));
  // (only loose ends: an end that already meets another piece is joined)
  const tips = ends.flatMap((p) => [p.p[0], p.p[p.p.length - 1]].map((q) => ({ p, q })));
  const loose = tips.filter((t) => !tips.some((u) => u.p !== t.p && Math.hypot(u.q[0] - t.q[0], u.q[1] - t.q[1]) < 0.6));
  const done = new Set();
  for (const t of loose) {
    if (done.has(t) || !t.p.n) continue;
    let best = null, bd = 9;
    for (const u of loose) { if (u.p === t.p || done.has(u) || u.p.n !== t.p.n) continue; const d = Math.hypot(u.q[0] - t.q[0], u.q[1] - t.q[1]); if (d < bd) { bd = d; best = u; } }
    if (best) { done.add(t); done.add(best); paint.push({ ...t.p, p: [t.q, best.q] }); }
  }
  // thin the sampled polylines back down (straight stretches need two points)
  for (const p of paint) { const q = [p.p[0]]; for (let k = 1; k < p.p.length - 1; k++) { const [a, b] = q[q.length - 1], [c, d] = p.p[k], [e, f] = p.p[k + 1]; if (Math.abs((c - a) * (f - b) - (d - b) * (e - a)) > 0.05 * Math.hypot(e - a, f - b)) q.push(p.p[k]); } q.push(p.p[p.p.length - 1]); p.p = q; }
  // where those streets run: a grid corner on one of them isn't a dead end
  const HP = new Set(), hk = (x, z) => `${Math.round(x / 2)},${Math.round(z / 2)}`;
  for (const p of paint) if (p.h !== 'pedestrian') for (const [x, z] of samples(p.p, 1)) HP.add(hk(x, z));
  const onPaint = ([x, z]) => { for (const dx of [-2, 0, 2]) for (const dz of [-2, 0, 2]) if (HP.has(hk(x + dx, z + dz))) return true; return false; };
  // a street that crosses water for more than a bridge's length, or a minor one that touches it at all, goes
  const wetOK = (pts, major) => { const r = wetRuns(pts); return !r.length || major && r.every((q) => q.length * 0.5 < 60) && samples(pts, 2).filter((s) => s[2]).length > 2; };
  let edges = D.edges.filter((e) => {
    const P = geo(e), major = e[3] >= MAJOR_W, mx = (P[0][0] + P[1][0]) / 2, mz = (P[0][1] + P[1][1]) / 2;
    if (east(mx, mz)) return false;
    if (!major && !inCore(mx, mz)) return false;
    if (longUnder(samples(P, 1)) || alongRail(samples(P, 1))) return false;
    return wetOK(P, major);
  });
  // where the coast is squeezed the side streets crowd together: of two side streets side by side closer than a
  // block, keep one (a through street always wins)
  { const has = new Map(edges.map((e) => [`${e[0]},${e[1]},${e[2]}`, e]));
    const LN = (ax) => (ax ? ZS : XS);
    edges = edges.filter((e) => {
      if (e[3] >= MAJOR_W) return true;
      const [ax, i, j] = e, k = ax ? j : i, A = LN(ax);
      for (const d of [-1, 1]) {
        const n = has.get(ax ? `${ax},${i},${j + d}` : `${ax},${i + d},${j}`); if (!n || Math.abs(A[k + d] - A[k]) > 9) continue;
        if (n[3] >= MAJOR_W || d < 0 && (k % 2)) return false;
      }
      return true;
    });
  }
  // stubs: a short street whose end touches nothing else (the long ones that end at the tracks or the beach are real)
  const nodeKey = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  for (let round = 0; round < 2; round++) {
    const deg = new Map();
    for (const e of edges) for (const p of geo(e)) deg.set(nodeKey(p), (deg.get(nodeKey(p)) || 0) + 1);
    edges = edges.filter((e) => { const P = geo(e), L = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]); return L > 14 || P.every((p) => deg.get(nodeKey(p)) > 1 || onPaint(p)); });
  }
  // islands: little knots of street that join neither the rest of the grid nor a street off it
  { const adj = new Map(), add = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); };
    for (const e of edges) { const [p, q] = geo(e).map(nodeKey); add(p, q); add(q, p); }
    const comp = new Map(), size = [], tied = []; let id = 0;
    for (const s of adj.keys()) {
      if (comp.has(s)) continue; const st = [s]; comp.set(s, id); let n = 0, t = false;
      while (st.length) { const u = st.pop(); n++; if (!t) t = onPaint(u.split(',').map(Number)); for (const v of adj.get(u)) if (!comp.has(v)) { comp.set(v, id); st.push(v); } }
      size.push(n); tied.push(t); id++;
    }
    edges = edges.filter((e) => { const c = comp.get(nodeKey(geo(e)[0])); return size[c] >= 8 || tied[c]; });
  }
  // no road on top of another: OSM draws a divided road as two one-way ways, and many streets come in pieces that
  // overlap the grid's own; longest first, a street keeps only the stretches that don't run along one already kept
  // (crossing one is fine)
  { const OK = new Set(), ok = (x, z) => `${Math.round(x)},${Math.round(z)}`;
    const near = (x, z) => { for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (a * a + b * b <= 10 && OK.has(ok(x + a, z + b))) return true; return false; };
    const put = (pts) => { for (const [x, z] of samples(pts, 1)) OK.add(ok(x, z)); };
    for (const e of edges) put(geo(e));
    const kept = [];
    for (const p of paint.filter((q) => q.h !== 'pedestrian').sort((a, b) => lineLen(b.p) - lineLen(a.p))) {
      const S = samples(p.p, 1), nr = S.map(([x, z]) => (p.force ? false : near(x, z))), k0 = kept.length;
      let cur = [];
      const flush = () => { if (cur.length > 6) { const q = { ...p, p: cur }; kept.push(q); } cur = []; };
      for (let k = 0; k < S.length;) {
        if (!nr[k]) { cur.push([S[k][0], S[k][1]]); k++; continue; }
        let e = k; while (e < S.length && nr[e]) e++;
        if (e - k > 8) flush(); else for (let j = k; j < e; j++) cur.push([S[j][0], S[j][1]]);   // a crossing: run on through
        k = e;
      }
      flush();
      for (const q of kept.slice(k0)) put(q.p);
    }
    paint.splice(0, paint.length, ...kept, ...paint.filter((q) => q.h === 'pedestrian'));
  }
  // stubs and islands among the streets off the grid: a piece with a loose end that's short goes (round after round),
  // and so does any knot of streets, grid and off-grid together, that doesn't add up to a real stretch of road
  { const G2 = new Map(), gk = (x, z) => `${Math.round(x / 2)},${Math.round(z / 2)}`;
    const items = [...edges.map((e) => ({ grid: e, p: geo(e) })), ...paint.filter((p) => p.h !== 'pedestrian').map((p) => ({ paint: p, p: p.p }))];
    const index = () => { G2.clear(); items.forEach((it, i) => { if (it.dead) return; for (const [x, z] of samples(it.p, 1)) { const k = gk(x, z); (G2.get(k) || G2.set(k, new Set()).get(k)).add(i); } }); };
    const others = (i, x, z, r = 1) => { const s = new Set(); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (const j of G2.get(`${Math.round(x / 2) + a},${Math.round(z / 2) + b}`) || []) if (j !== i && !items[j].dead) s.add(j); return s; };
    const atEdge = ([x, z]) => x > eastEdge(z) - 6 || z < BOUNDS.z0 + 6 || z > BOUNDS.z1 - 6 || seaDist(x, z) < 12;   // the map's edge, or the beach
    // a through street that stops just short of the road it's heading for (the extract breaks them where a bit went
    // onto the grid): carry it on to that road
    index();
    for (const [i, it] of items.entries()) {
      if (it.grid || !MAJOR_H.includes(it.paint.h)) continue;
      for (const end of [0, 1]) {
        const P = it.p, e = end ? P[P.length - 1] : P[0], f = end ? P[Math.max(0, P.length - 4)] : P[Math.min(P.length - 1, 3)];
        if (atEdge(e) || others(i, e[0], e[1], 2).size) continue;
        const L = Math.hypot(e[0] - f[0], e[1] - f[1]) || 1, dx = (e[0] - f[0]) / L, dz = (e[1] - f[1]) / L;
        let best = null, bd = 24;
        for (let t = 3; t < 24; t += 1) for (const s of [0, -0.25, 0.25, -0.5, 0.5]) {
          const x = e[0] + (dx - dz * s) * t, z = e[1] + (dz + dx * s) * t;
          if (others(i, x, z, 0).size && t < bd) { bd = t; best = [x, z]; }
        }
        if (!best || !samples([e, best], 1).every((q) => q[2])) continue;
        if (end) P.push(best); else P.unshift(best);
      }
    }
    for (let round = 0; round < 4; round++) {
      index();
      for (const [i, it] of items.entries()) {
        if (it.dead || it.grid || it.paint.force) continue;
        const P = it.p, L = lineLen(P), major = MAJOR_H.includes(it.paint.h);
        const loose = [P[0], P[P.length - 1]].filter((q) => !atEdge(q) && !others(i, q[0], q[1], 2).size).length;
        if (major ? loose && L < 70 || loose === 2 && L < 90 : loose && L < 30 || loose === 2 && L < 80) it.dead = true;
        // a little side street that curls round on itself (a cul-de-sac loop, a parking aisle)
        const span = Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]);
        if (!major && L < 70 && L > 2.5 * (span + 1)) it.dead = true;
      }
    }
    index();
    const comp = new Array(items.length).fill(-1); let id = 0; const len = [];
    items.forEach((it, i) => {
      if (it.dead || comp[i] >= 0) return; const st = [i]; comp[i] = id; let L = 0;
      while (st.length) { const u = st.pop(); L += lineLen(items[u].p); for (const [x, z] of samples(items[u].p, 1)) for (const v of others(u, x, z)) if (comp[v] < 0) { comp[v] = id; st.push(v); } }
      len.push(L); id++;
    });
    const keep = (i) => !items[i].dead && (len[comp[i]] >= 250 || items[i].paint && items[i].paint.force);
    edges = edges.filter((e, i) => keep(i));
    const live = new Set(items.filter((it, i) => it.paint && keep(i)).map((it) => it.paint));
    paint.splice(0, paint.length, ...paint.filter((p) => p.h === 'pedestrian' || live.has(p)));
  }
  // bridges: where a kept big street crosses water
  const bridges = [];
  for (const e of edges) if (e[3] >= MAJOR_W) for (const r of wetRuns(geo(e))) bridges.push({ p: [r[0], r[r.length - 1]], w: Math.max(3.6, Math.min(5, e[3])) });
  for (const p of paint) if (MAJOR_H.includes(p.h)) for (const r of wetRuns(p.p)) if (r.length > 2) bridges.push({ p: r, w: p.w });
  // CA-76 runs at grade (an expressway): its crossings of the river get road bridges (I-5 and its ramps build their own)
  for (const f of freeway) if (f.h === 'trunk') for (const r of wetRuns(f.p)) if (r.length > 2) bridges.push({ p: r, w: 5.2 });
  // ---------- the ramps: only the ones that join I-5 to a street the map keeps ----------
  // the streets (and CA-76) by where they run, with their names (for the exit signs)
  const SH = new Map(), sk = (x, z) => `${Math.round(x / 2)},${Math.round(z / 2)}`;
  const lineName = (ax, i, at) => { const runs = (ax ? D.zn : D.xn)[i] || []; const r = runs.find((q) => at >= q[1] - 2 && at <= q[2] + 2) || runs[0]; return r ? r[0] : ''; };
  for (const e of edges) { const P = geo(e), n = lineName(e[0], e[0] ? e[2] : e[1], e[0] ? (P[0][0] + P[1][0]) / 2 : (P[0][1] + P[1][1]) / 2); for (const [x, z] of samples(P, 1)) SH.set(sk(x, z), n); }
  for (const p of paint) if (p.h !== 'pedestrian') for (const [x, z] of samples(p.p, 1)) SH.set(sk(x, z), p.n || '');
  for (const f of freeway) if (f.h === 'trunk') for (const [x, z] of samples(f.p, 1)) SH.set(sk(x, z), 'CA-76');
  const streetAt = (x, z, r = 2) => { for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) { const n = SH.get(sk(x + dx, z + dz)); if (n !== undefined) return { n }; } return null; };
  // The real ramps are squeezed into I-5's own width inland, so each real interchange is drawn as a diamond: at
  // the street the exit is for, an off-ramp and an on-ramp either side, each curving down from the deck's edge to
  // the street (one side only where the map's edge is right behind the freeway). The exits on this stretch:
  const EXITS = ['Tamarack Avenue', 'Carlsbad Village Drive', 'Las Flores Drive', 'Cassidy Street', 'Oceanside Boulevard', 'Mission Avenue', 'CA-76', 'Harbor Drive'];
  const lines = [
    ...edges.map((e) => { const P = geo(e); return { n: lineName(e[0], e[0] ? e[2] : e[1], e[0] ? (P[0][0] + P[1][0]) / 2 : (P[0][1] + P[1][1]) / 2), p: P }; }),
    ...paint.map((p) => ({ n: p.n, p: p.p })), ...freeway.filter((f) => f.h === 'trunk').map((f) => ({ n: 'CA-76', p: f.p })),
  ].filter((l) => EXITS.includes(l.n));
  const ramps = [], I5F = i5.map((p, k) => { const a = i5[Math.max(0, k - 2)], b = i5[Math.min(i5.length - 1, k + 2)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L }; });
  for (const name of EXITS) {
    // where that street passes under I-5
    let best = null;
    const cross = (list) => { let b = null; for (const l of list) if (l.n === name) { const S = samples(l.p, 0.5); for (let k = 0; k + 1 < S.length; k++) { const d = i5Dist(S[k][0], S[k][1]); if (!b || d < b.d) { const L = Math.hypot(S[k + 1][0] - S[k][0], S[k + 1][1] - S[k][1]) || 1; b = { d, x: S[k][0], z: S[k][1], ux: (S[k + 1][0] - S[k][0]) / L, uz: (S[k + 1][1] - S[k][1]) / L, l }; } } } return b; };
    best = cross(lines);
    // the street was trimmed where it meets I-5 (its stretch either side ran too close to the freeway, or broke up):
    // put that stretch of it back from the extract, out to where the ramps meet it
    if (!best || best.d > 2) {
      const raw = cross(whole.map((p) => ({ n: p.n, p: p.p, h: p.h, w: p.w })));
      if (!raw || raw.d > 2) continue;
      const S = samples(raw.l.p, 1).filter(([x, z]) => Math.hypot(x - raw.x, z - raw.z) < 16 && !east(x, z)).map((s) => [s[0], s[1]]);
      if (S.length < 4) continue;
      const piece = { n: name, h: raw.l.h, w: raw.l.w, p: S }; paint.push(piece); lines.push({ n: name, p: S });
      for (const [x, z] of S) SH.set(sk(x, z), name);
      best = cross([{ n: name, p: S }]);
    }
    let ki = 0, bd = 1e9; i5.forEach((p, k) => { const d = (p[0] - best.x) ** 2 + (p[1] - best.z) ** 2; if (d < bd) { bd = d; ki = k; } });
    if (ki < 25 || ki > i5.length - 25) continue;                            // too near the map's end, where I-5 comes down
    const { tx, tz } = I5F[ki], nx = tz, nz = -tx, [cx, cz] = i5[ki];
    for (const s of [-1, 1]) {
      // the street's point at the ramps' distance out, either side of it along the freeway
      const un = best.ux * nx + best.uz * nz; if (Math.abs(un) < 0.3) continue;
      const lam = s * 9.5 / un, qx = best.x + best.ux * lam, qz = best.z + best.uz * lam;
      if (qx > eastEdge(qz) - 2 || !isLand(qx, qz)) continue;
      const dirF = s < 0 ? 1 : -1;                                            // traffic on this side runs along +t (right-hand side) or -t
      for (const exit of [true, false]) {
        const a = exit ? -dirF : dirF;                                        // an exit leaves upstream of the street, an on-ramp joins downstream
        const P = [];
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, e = u * u * (3 - 2 * u);                          // eased out from the deck to the street
          const along = a * (30 - 26 * u), lat = s * (HALF5 + 1.1 + (9.5 - HALF5 - 1.1) * e);
          const ex = cx + tx * along + nx * lat, ez = cz + tz * along + nz * lat;
          // the last stretch bends onto the street itself
          const w = Math.max(0, (u - 0.75) / 0.25), sx = qx + tx * a * 3.2, sz = qz + tz * a * 3.2;
          P.push([ex + (sx - ex) * w * w, ez + (sz - ez) * w * w]);
        }
        ramps.push({ p: P, exit, name });
      }
    }
  }
  // CA-78 (and any other freeway) leaving I-5: raised like I-5, coming down to the ground where the hills begin
  const spurs = joinLines(freeway.filter((f) => f.h === 'motorway' && !/San Diego Freeway|I 5/.test(f.n)).map((f) => f.p), 1).filter((c) => lineLen(c) > 10)
    .map((c) => { const P = samples(c, 1).map((s) => [s[0], s[1]]); if (i5Dist(...P[0]) > i5Dist(...P[P.length - 1])) P.reverse(); let k = 0; while (k < P.length - 4 && i5Dist(...P[k]) < 4.8) k++; return { p: P.slice(k), spur: true }; })
    .filter((s) => lineLen(s.p) > 6);
  return { edges, paint, bridges, freeway, i5, i5Dist, ramps, spurs, streetAt };
})();
// join line pieces that meet end to end, and a polyline's length
export function joinLines(lines, tol, either = false) {           // either: a piece may join the wrong way round (a street, not a one-way carriageway)
  const rest = lines.map((l) => l.slice()), out = [], same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
  while (rest.length) {
    let c = rest.shift(), grown = true;
    while (grown) {
      grown = false;
      for (let k = 0; k < rest.length; k++) {
        const w = rest[k];
        if (same(w[0], c[c.length - 1])) { c = c.concat(w.slice(1)); rest.splice(k, 1); grown = true; break; }
        if (same(w[w.length - 1], c[0])) { c = w.slice(0, -1).concat(c); rest.splice(k, 1); grown = true; break; }
        if (either && same(w[0], c[0])) { c = w.slice(1).reverse().concat(c); rest.splice(k, 1); grown = true; break; }
        if (either && same(w[w.length - 1], c[c.length - 1])) { c = c.concat(w.slice(0, -1).reverse()); rest.splice(k, 1); grown = true; break; }
      }
    }
    out.push(c);
  }
  return out;
}
export function lineLen(p) { let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return L; }

// ================= THE MAP =================
export function northcounty(B) {
  const D = { ...NC, edges: ROADS.edges, paint: ROADS.paint, freeway: ROADS.freeway }, XS = D.xs, ZS = D.zs;
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
  // past the east edge the ground turns to the chaparral of the hills (js/ncworld.js raises them)
  for (let z = W.z0 - 50; z < W.z1 + 50; z += 2) { const x = eastEdge(z) - 1; g.rect(x, z, W.x1 + 60, z + 2, 'rgba(127,117,82,.9)'); g.rect(x - 4, z, x, z + 2, 'rgba(127,117,82,.45)'); }
  for (let k = 0; k < 2500; k++) { const z = rand(W.z0, W.z1), x = rand(eastEdge(z), W.x1 + 10); g.circle(x, z, rand(0.6, 2.2), pick(['rgba(92,108,62,.45)', 'rgba(150,136,96,.35)', 'rgba(70,88,52,.45)'])); }
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
  // I-5 and its ramps stand on embankments and bridges (js/ncfreeway.js): the ground under them is their footprint
  const raised = [{ p: ROADS.i5, w: 2 * 6.8 }, ...ROADS.ramps.map((r) => ({ p: r.p, w: 6 })), ...ROADS.spurs.map((r) => ({ p: r.p, w: 9 }))];
  for (const r of raised) if (r.p.length > 1) { g.stroke(r.p, r.w, '#80785a'); g.stroke(r.p, r.w * 0.6, '#6f6a55'); markLine(r.p, r.w / 2 + 0.6); }
  // CA-76 runs at grade: an expressway like a big street
  const grade = D.freeway.filter((f) => f.h === 'trunk' || f.h === 'trunk_link');
  for (const f of grade) { f.W = f.h === 'trunk' ? 4.2 : 2.4; g.stroke(f.p, f.W + 2.2, '#8a8572'); markLine(f.p, f.W / 2 + 1.8); }
  for (const f of grade) g.stroke(f.p, f.W, '#4d4e50');
  for (const f of grade) if (f.h === 'trunk') { g.stroke(f.p, 0.08, 'rgba(238,238,232,.7)', [1, 1.6]); for (const o of [-1, 1]) g.stroke(offset(f.p, o * (f.W / 2 - 0.25)), 0.08, 'rgba(238,238,232,.75)'); }

  // ---------- the railway: the coast line's double track, the Sprinter's line, the stations (js/ncrail.js) ----------
  railGround(ctx, [
    ...D.edges.map(([ax, i, j, w]) => ({ p: ax ? [[XS[i], ZS[j]], [XS[i + 1], ZS[j]]] : [[XS[i], ZS[j]], [XS[i], ZS[j + 1]]], w: Math.max(3.6, Math.min(5, w)) })),
    ...D.paint.filter((p) => p.h !== 'pedestrian').map((p) => ({ p: p.p, w: Math.min(p.w, 4.6) })),
    ...D.freeway.filter((f) => f.h === 'trunk').map((f) => ({ p: f.p, w: 4.2 })),
  ]);

  // ---------- streets ----------
  const SW = city.sw, conc = '#b9b3a6', asphalt = '#4a4b4d';
  const edges = D.edges.map(([ax, i, j, w]) => { const a = { x: XS[i], z: ZS[j] }, b = ax ? { x: XS[i + 1], z: ZS[j] } : { x: XS[i], z: ZS[j + 1] }; return { ax, i, j, w: Math.max(3.6, Math.min(5, w)), a, b }; });
  const RES = ['residential', 'unclassified', 'living_street'];
  // the streets off the grid: no wider than the grid's own, sidewalks where the town is built up, a narrow verge outside
  const lanes = D.paint.filter((p) => p.h !== 'pedestrian' && p.p.length > 1).map((p) => {
    const S = samples(p.p, 4), town = S.filter(([x, z]) => inCore(x, z)).length > S.length / 2;
    return { ...p, w: Math.min(p.w, 4.6), sw: town ? SW : 0.55, verge: town ? conc : '#a39d8c' };
  });
  // sidewalks first, asphalt over them, then the markings
  for (const e of edges) { const h = e.w / 2 + SW; e.ax ? g.rect(e.a.x - 0.2, e.a.z - h, e.b.x + 0.2, e.a.z + h, conc) : g.rect(e.a.x - h, e.a.z - 0.2, e.a.x + h, e.b.z + 0.2, conc); }
  for (const p of lanes) g.stroke(p.p, p.w + p.sw * 2, p.verge);
  for (const e of edges) { const h = e.w / 2; e.ax ? g.rect(e.a.x - h, e.a.z - h, e.b.x + h, e.a.z + h, asphalt) : g.rect(e.a.x - h, e.a.z - h, e.a.x + h, e.b.z + h, asphalt); }
  for (const p of lanes) g.stroke(p.p, p.w, RES.includes(p.h) ? '#505052' : asphalt);
  for (const p of D.paint.filter((q) => q.h === 'pedestrian')) g.stroke(p.p, p.w, '#cfc6b2');
  for (const e of edges) { const pts = [[e.a.x, e.a.z], [e.b.x, e.b.z]]; markLine(pts, e.w / 2 + SW); nearMark(pts, e.w / 2 + 10); }
  for (const p of lanes) { markLine(p.p, p.w / 2 + p.sw); if (RES.includes(p.h) || p.w >= 4) nearMark(p.p, p.w / 2 + 10); }
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
        if (!inCore(cx, cz) && Math.random() < 0.45) { t += o.w + o.gap * 2; continue; }   // past the core places the houses spread out (yards, lots, the odd gap)
        if (free(cx - bw / 2 - 0.05, cz - bd / 2 - 0.05, cx + bw / 2 + 0.05, cz + bd / 2 + 0.05)) {
          const b = B.add({ x: cx, z: cz, w: bw, d: bd, floors: o.floors, style: o.style, tint: o.tint, cell: o.cell, gh: o.gh, fh: o.fh, gable: o.gable, roofTint: o.roof, storefront: o.shop });
          if (!o.shop) b.noSigns = true;
          mark(cx - bw / 2 - 0.1, cz - bd / 2 - 0.1, cx + bw / 2 + 0.1, cz + bd / 2 + 0.1);
          // a house gets its front lawn, its driveway and a back yard (on streets that run on the grid)
          if (o.home && (Math.abs(dx) < 0.05 || Math.abs(dz) < 0.05)) {
            const ox = nx * s, oz = nz * s, back = 2.6, front = off - w / 2 - SW - (along ? bd : bw) / 2;
            const yx0 = Math.min(cx - bw / 2, cx - bw / 2 + ox * back), yx1 = Math.max(cx + bw / 2, cx + bw / 2 + ox * back), yz0 = Math.min(cz - bd / 2, cz - bd / 2 + oz * back), yz1 = Math.max(cz + bd / 2, cz + bd / 2 + oz * back);
            if (free(yx0 + ox * 0.6 + 0.1, yz0 + oz * 0.6 + 0.1, yx1 + ox * 0.6 - 0.1, yz1 + oz * 0.6 - 0.1)) g.rect(yx0 - 0.15, yz0 - 0.15, yx1 + 0.15, yz1 + 0.15, Math.random() < 0.7 ? '#6f8146' : '#8a8a5c');
            const fx0 = Math.min(cx - bw / 2, cx - bw / 2 - ox * front), fx1 = Math.max(cx + bw / 2, cx + bw / 2 - ox * front), fz0 = Math.min(cz - bd / 2, cz - bd / 2 - oz * front), fz1 = Math.max(cz + bd / 2, cz + bd / 2 - oz * front);
            g.rect(fx0, fz0, fx1, fz1, Math.random() < 0.75 ? '#788a4a' : '#9c9473');                                     // the front lawn (or gravel and succulents)
            const dw = 0.9, lo = Math.random() < 0.5;                                                                   // the driveway down one side
            if (along) { const x0 = lo ? cx - bw / 2 : cx + bw / 2 - dw; g.rect(x0, Math.min(cz, cz - oz * (bd / 2 + front)), x0 + dw, Math.max(cz, cz - oz * (bd / 2 + front)), '#b5ae9f'); }
            else { const z0 = lo ? cz - bd / 2 : cz + bd / 2 - dw; g.rect(Math.min(cx, cx - ox * (bw / 2 + front)), z0, Math.max(cx, cx - ox * (bw / 2 + front)), z0 + dw, '#b5ae9f'); }
          }
          if (o.tree && Math.random() < o.tree) { const tx = x + nx * s * (w / 2 + SW * 0.55), tz = z + nz * s * (w / 2 + SW * 0.55); city.addTree(tx, tz, rand(0.7, 1), Z === 'beachfront' || Z === 'village' || Math.random() < 0.3 ? 'palm' : 'round'); }
          t += o.w + o.gap;
        } else t += 1.2;
      }
    }
  };
  for (const e of edges) lotsAlong(e.a.x, e.a.z, e.b.x, e.b.z, e.w, e.w >= 4.6);
  for (const p of lanes) for (let k = 0; k + 1 < p.p.length; k++) lotsAlong(p.p[k][0], p.p[k][1], p.p[k + 1][0], p.p[k + 1][1], p.w, p.w >= 4.6);
  // the back lots in the dense places: granny flats in the Barrio, the buildings behind the shops downtown
  // (a street within ~9 units, so open ground, the lagoon banks and the hills stay open)
  for (let z = W.z0 + 4; z < W.z1 - 4; z += 3.9) for (let x = W.x0 + 4; x < W.x1 - 4; x += 3.9) {
    const xx = x + rand(-0.4, 0.4), zz = z + rand(-0.4, 0.4);
    if (!nearStreet(xx, zz)) continue;
    const Z = zoneAt(xx, zz); if (Z === 'harbor' && Math.random() < 0.6) continue;
    const busy = Z === 'village' || Z === 'otown';
    if (!busy && (Z !== 'barrio' || Math.random() < 0.45)) continue;   // only the village, downtown and the Barrio build out behind the street
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
    // the lots behind the marina (a few, by the water: the rest of the spit is the beach and the park)
    let lots = 0;
    for (let z = H.z0 + 10; z < H.z1 - 10 && lots < 8; z += 13) for (let x = H.x0 + 10; x < H.x1 - 10 && lots < 8; x += 15) {
      const wet = landAt(x + 14, z) !== 2 || landAt(x - 14, z) !== 2 || landAt(x, z + 14) !== 2 || landAt(x, z - 14) !== 2;
      if (!wet || !isLand(x, z) || !free(x - 5.5, z - 4, x + 5.5, z + 4)) continue;
      lots++;
      const spots = city.paintParking(g, x - 5.5, z - 4, x + 5.5, z + 4); for (const sp of spots) if (Math.random() < 0.6) city.parked.push(sp); mark(x - 5.5, z - 4, x + 5.5, z + 4);
    }
  }
  // the open ground between: eucalyptus groves, the odd palm, scrub (no filler buildings)
  for (let z = W.z0 + 4; z < W.z1 - 4; z += 5) for (let x = W.x0 + 4; x < W.x1 - 4; x += 5) {
    const xx = x + rand(-2, 2), zz = z + rand(-2, 2);
    if (xx > eastEdge(zz) - 4 || seaDist(xx, zz) < BEACH_W + 4 || !free(xx - 1, zz - 1, xx + 1, zz + 1)) continue;
    const grove = Math.sin(xx * 0.05 + 1.3) * Math.cos(zz * 0.043) > 0.35;
    if (Math.random() < (grove ? 0.55 : 0.08)) { city.addTree(xx, zz, rand(1, grove ? 1.6 : 1.2), !grove && Math.random() < 0.25 ? 'palm' : 'round'); mark(xx - 0.6, zz - 0.6, xx + 0.6, zz + 0.6); }
    else if (Math.random() < 0.3) g.circle(xx, zz, rand(0.8, 2), pick(['rgba(92,108,62,.4)', 'rgba(70,88,52,.4)']));
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
    : { w: rand(2.2, 2.9), d: rand(2.6, 3.4), gap: rand(0.9, 1.8), set: 0.9, floors: 1, style: 'house', tint: BARRIO(), cell: 1.5, gh: 1.1, fh: 0.95, gable: Math.random() < 0.6, roof: Math.random() < 0.5 ? TILE() : SHINGLE(), tree: 0.35, home: true };
  if (major) return { w: rand(3.6, 6), d: rand(4.5, 7), gap: rand(0.6, 2.5), set: rand(0.4, 2.2), floors: pick([1, 1, 2, 2, 3]), style: pick(['stucco', 'flat', 'concrete', 'stucco']), tint: STUCCO(), cell: 1.8, gh: 1.4, fh: 1, shop: true, tree: 0.4 };
  return home();
}
// the houses: a handful of the kinds that actually line Carlsbad's and Oceanside's streets, mixed house by house
const HOMES = [
  // the Spanish revival: white or cream stucco, a red tile roof
  [3, () => ({ w: rand(2.6, 3.4), d: rand(3, 3.8), floors: 1, style: 'house', tint: hsl(rand(0.09, 0.12), rand(0.1, 0.3), rand(0.88, 0.95)), gable: Math.random() < 0.5, roof: TILE() })],
  // the post-war ranch: long and low, pale paint, grey shingle
  [3, () => ({ w: rand(3.6, 4.6), d: rand(2.6, 3.1), floors: 1, style: 'house', tint: hsl(pick([0.1, 0.12, 0.55, 0.3, 0.08]), rand(0.08, 0.25), rand(0.72, 0.86)), gable: true, roof: SHINGLE() })],
  // the beach cottage: small, a coat of colour
  [2, () => ({ w: rand(2.2, 2.8), d: rand(2.6, 3.2), floors: 1, style: 'house', tint: hsl(pick([0.5, 0.53, 0.56, 0.14, 0.04, 0.33, 0.6]), rand(0.15, 0.3), rand(0.74, 0.86)), gable: true, roof: Math.random() < 0.5 ? hsl(0, 0, rand(0.85, 0.95)) : SHINGLE() })],
  // the new two-storey: white and grey boxes, flat roofs
  [2, () => ({ w: rand(2.8, 3.6), d: rand(3.2, 4), floors: 2, style: 'flat', tint: hsl(pick([0.1, 0.58]), rand(0, 0.08), rand(0.7, 0.95)) })],
  // the small apartment house: two storeys round a stair, stucco
  [1, () => ({ w: rand(4.4, 5.6), d: rand(3.6, 4.6), floors: 2, style: 'stucco', tint: hsl(rand(0.07, 0.13), rand(0.12, 0.3), rand(0.78, 0.9)) })],
];
const HOME_W = HOMES.reduce((a, h) => a + h[0], 0);
function home() {
  let r = Math.random() * HOME_W; const h = HOMES.find((k) => (r -= k[0]) < 0) || HOMES[0];
  return { gap: rand(1, 2.2), set: rand(1, 1.8), cell: 1.6, gh: 1.1, fh: 0.95, tree: 0.5, home: true, ...h[1]() };
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
  // the Barrio's parks
  // (Pine Avenue Park itself, its gardens and fields, is js/ncplaces.js)
  park(P.holidayPark.x - 8, P.holidayPark.z - 7, P.holidayPark.x + 8, P.holidayPark.z + 7, 14);
  park(P.magee.x - 5, P.magee.z - 5, P.magee.x + 5, P.magee.z + 5, 8);
  // Carlsbad High: classrooms round a quad, the football field and track behind
  const ch = P.carlsbadHigh;
  plaza(ch.x - 18, ch.z - 22, ch.x + 2, ch.z + 2, '#b3ab9a');
  g.rect(ch.x - 14, ch.z + 4, ch.x + 4, ch.z + 30, '#9a4a3a'); g.rect(ch.x - 12, ch.z + 6.5, ch.x + 2, ch.z + 27.5, '#4f8a3a'); mark(ch.x - 14, ch.z + 4, ch.x + 4, ch.z + 30);
  for (let z = ch.z + 9; z < ch.z + 26; z += 2.2) g.line(ch.x - 12, z, ch.x + 2, z, 0.06, 'rgba(255,255,255,.6)');
  // downtown Oceanside: Civic Center, the cinema plaza (the Transit Center is js/ncrail.js)
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
  // Carlsbad High: two wings of classrooms and the gym
  N.chs = { x: ch.x - 8, z: ch.z - 12, d: 5 };
  N.chsB = B.add({ x: ch.x - 8, z: ch.z - 12, w: 18, d: 5, floors: 2, style: 'concrete', tint: hsl(0.1, 0.12, 0.82), cell: 1.8, gh: 1.5, fh: 1.1 }); N.chsB.noSigns = true; N.chsB.name = 'Carlsbad High';
  B.add({ x: ch.x - 14, z: ch.z - 3, w: 6, d: 9, floors: 2, style: 'concrete', tint: hsl(0.1, 0.12, 0.8), cell: 1.8, gh: 1.5, fh: 1.1 }).noSigns = true;
  B.add({ x: ch.x - 3, z: ch.z - 2, w: 8, d: 7, floors: 2, style: 'flat', tint: hsl(0.6, 0.12, 0.6), cell: 2, gh: 2.2, fh: 1.2 }).noSigns = true;
  // the coast's resorts and inns in Carlsbad, on the ocean side of Carlsbad Blvd
  for (const n of ['Carlsbad Inn Beach Resort', 'Tamarack Beach Resort', 'Ocean Palms Beach Resort', 'Beach Terrace Inn']) { const p = NC.poi.find((q) => q.n === n); if (p) (N.inns ||= []).push({ x: p.x, z: p.z, name: n }); }
  // the harbor: Harbor Village (the Cape Cod shops), docks and slips, the jetties
  N.docks = NC.piers.filter((p) => p.k === 'pier' && p.p.length >= 2 && p.n !== 'Oceanside Pier' && p.p[0][1] < -700);
  N.jetties = NC.piers.filter((p) => p.k === 'breakwater' || p.k === 'groyne');
  places(ctx);                                                // Pine Avenue Park, Hibiscus Circle, El Camino Grove (js/ncplaces.js)
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

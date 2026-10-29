// NORTH COUNTY: the railway. The coast line (LOSSAN) as a clean double track down the whole map on its real alignment,
// the Sprinter's own line leaving it south of the Oceanside Transit Center and turning inland along the Oceanside Blvd
// corridor, every street that crosses either one a level crossing with flashing lights and gates.
//   The Coaster   NCTD's commuter train: a Siemens Charger-style locomotive (royal blue, teal cab, COASTER down the
//                 side) and bi-level cars (blue, teal roof, black skirt, the white line), a cab car at the far end, run
//                 push-pull; one each way, stopping at the Oceanside Transit Center and Carlsbad Village only (the
//                 coast line's real stops in this stretch), coming and going at the map's ends
//   The Sprinter  the two-car diesel railcar to Escondido, white and blue: shuttles from its stub platform at the
//                 Transit Center out past its Coast Highway station into the hills
//   Stations      Carlsbad Village (side platforms with canopies, the old 1887 Santa Fe depot by Carlsbad Village Dr),
//                 the Oceanside Transit Center (the mission-style depot and its tower, side and island platforms, the
//                 Sprinter's bay, the bus bays), Coast Highway on the Sprinter
// RAIL (the layout) is worked out from the OSM tracks when the module loads; railGround() paints the beds and lays out
// the stations (from js/northcounty.js, before the streets go over the crossings); Rail builds and runs the rest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { tint, box, cyl, canvasTex, cutoutOn, hipRoof } from './mapkit.js';
import { hsl } from './maps.js';
import { NC, BOUNDS, PLACES, hillEdge } from './ncgeo.js';

const TRACK = 0.75;                                       // each track this far either side of the coast line's middle
const SPR = 3.6;                                          // the Sprinter's track this far east of it, by the Transit Center

// a polyline you can ride: position, heading and sideways at distance s; the s nearest a point
export function trackOf(pts) {
  const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s) => {
    s = clamp(s, 0, L); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi], t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx, tz, nx: tz, nz: -tx, yaw: Math.atan2(tx, tz) };
  };
  const near = (x, z) => { let bs = 0, bd = 1e9; for (let k = 0; k < pts.length; k++) { const d = (pts[k][0] - x) ** 2 + (pts[k][1] - z) ** 2; if (d < bd) { bd = d; bs = cum[k]; } } return { s: bs, d: Math.sqrt(bd) }; };
  return { pts, cum, L, at, near };
}
const offsetPts = (T, d, step = 1) => { const out = []; for (let s = 0; s <= T.L; s += step) { const p = T.at(s); out.push([p.x + p.nx * d, p.z + p.nz * d]); } return out; };

// ---------- the layout ----------
export const RAIL = (() => {
  const segs = NC.rail.filter((r) => !r.s).flatMap((r) => r.p.slice(1).map((q, k) => [r.p[k], q]));
  const xsAt = (z) => { const out = []; for (const [a, b] of segs) if ((a[1] - z) * (b[1] - z) <= 0 && a[1] !== b[1]) out.push(a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])); return out; };
  // the coast line: follow the tracks up and down the coast from the Village, averaging where there are two
  const start = xsAt(0).sort((a, b) => Math.abs(a - 30) - Math.abs(b - 30))[0] ?? 30;
  const walk = (dir) => {
    const out = []; let prev = start;
    for (let z = 0; dir < 0 ? z >= BOUNDS.z0 : z <= BOUNDS.z1; z += dir * 2) {
      const xs = xsAt(z).filter((x) => Math.abs(x - prev) < 5);
      if (xs.length) { const n = xs.reduce((b, x) => (Math.abs(x - prev) < Math.abs(b - prev) ? x : b)), near = xs.filter((x) => Math.abs(x - n) < 2.4); prev = near.reduce((a, x) => a + x, 0) / near.length; }
      out.push([prev, z]);
    }
    return out;
  };
  const raw = [...walk(-1).reverse(), ...walk(1).slice(1)];
  const pts = raw.map((p, k) => { let sx = 0, n = 0; for (let j = Math.max(0, k - 3); j <= Math.min(raw.length - 1, k + 3); j++) { sx += raw[j][0]; n++; } return [sx / n, p[1]]; });
  const coast = trackOf(pts);
  const cxAt = (z) => pts[clamp(Math.round((z - pts[0][1]) / 2), 0, pts.length - 1)][0];          // the line's x where it crosses z
  // the Sprinter: from its stub by the Transit Center south beside the coast line, then round onto its own line
  // inland (OSM's, kept a few units off Oceanside Blvd where the squeezed map brings the two together)
  const tcz = PLACES.transit.z, sp = [];
  for (let z = tcz - 9; z <= -384; z += 2) sp.push([cxAt(z) + SPR, z]);
  const a = sp[sp.length - 1], b = [8, -359];
  for (let t = 0.1; t < 1; t += 0.1) { const u = t * t * (3 - 2 * t); sp.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * t + 6 * t * (1 - t)]); }
  for (const p of [[8, -359], [17, -357.4], [27, -356.4], [36, -356.2], [47, -356.2], [54, -356.2], [67, -356.6], [95, -359], [107, -361], [139, -367], [157, -370], [175, -374], [189, -375.5]]) if (p[0] < hillEdge(p[1]) - 1) sp.push(p);
  const sprinter = trackOf(sp);
  const stationOn = (T, x, z) => T.near(x, z).s;
  const stations = {
    village: { line: 'coast', s: stationOn(coast, start, PLACES.carlsbadStation.z), len: 26, name: 'CARLSBAD VILLAGE' },
    transit: { line: 'coast', s: stationOn(coast, -7, tcz), len: 30, name: 'OCEANSIDE' },
    coastHwy: { line: 'sprinter', s: stationOn(sprinter, 46, -356.2), len: 12, name: 'COAST HIGHWAY' },
    sprinterTC: { line: 'sprinter', s: 6, len: 12, name: 'OCEANSIDE' },
  };
  // the distance from any point to the nearest track (to keep streets and buildings off the beds)
  const H = new Map(), hk = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  for (const T of [coast, sprinter]) for (let s = 0; s <= T.L; s += 1) { const p = T.at(s); const k = hk(p.x, p.z); (H.get(k) || H.set(k, []).get(k)).push([p.x, p.z]); }
  const dist = (x, z) => { let m = 1e9; const cx = Math.floor(x / 4), cz = Math.floor(z / 4); for (let i = cx - 2; i <= cx + 2; i++) for (let j = cz - 2; j <= cz + 2; j++) for (const p of H.get(`${i},${j}`) || []) m = Math.min(m, Math.hypot(p[0] - x, p[1] - z)); return m; };
  return { coast, sprinter, stations, cxAt, dist, tcz };
})();

// ================= the beds, the stations' ground and buildings (js/northcounty.js) =================
export function railGround(ctx, streets) {
  const { g, city, B, mark, markLine } = ctx, N = city.nc, R = RAIL;
  // the beds: ballast, then each track's ties and the steel
  const bed = (T, w) => { g.stroke(T.pts, w + 0.6, '#6f6a60'); g.stroke(T.pts, w, '#8a8174'); markLine(T.pts, w / 2 + 0.6); };
  bed(R.coast, 2 * TRACK + 1.6); bed(R.sprinter, 1.5);
  const ties = (pts) => { g.stroke(pts, 1.15, 'rgba(66,50,38,.85)', [0.16, 0.3]); };
  for (const d of [-TRACK, TRACK]) ties(offsetPts(R.coast, d));
  ties(R.sprinter.pts);
  // the level crossings: where a street runs over a line (the street's own paint goes on top later)
  N.crossings = [];
  for (const [li, T] of [['coast', R.coast], ['sprinter', R.sprinter]]) for (const st of streets) {
    const P = st.p; for (let k = 0; k + 1 < P.length; k++) {
      const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
      for (let t = 0; t <= L; t += 0.5) {
        const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, n = RAIL.dist(x, z) < 1.6 ? T.near(x, z) : { d: 9 }; if (n.d > 1.3) continue;
        if (N.crossings.some((c) => Math.hypot(c.x - x, c.z - z) < 8)) continue;
        const p = T.at(n.s), ux = (bx - ax) / L, uz = (bz - az) / L;
        if (Math.abs(ux * p.tx + uz * p.tz) > 0.85) continue;                       // running along it, not across
        N.crossings.push({ line: li, s: n.s, x: p.x, z: p.z, ux, uz, w: st.w || 4, tx: p.tx, tz: p.tz });
      }
    }
  }
  // ---------- the stations' ground ----------
  const plaza = (x0, z0, x1, z1, c = '#c9c0ad') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.2, 40); mark(x0, z0, x1, z1); };
  // Carlsbad Village: plaza both sides, the depot by Carlsbad Village Dr
  const V = R.stations.village, vp = R.coast.at(V.s);
  N.rail = { stations: R.stations };
  for (const s of [-1, 1]) { const x = vp.x + s * 2.8; plaza(Math.min(x, x + s * 2.2), vp.z - V.len / 2, Math.max(x, x + s * 2.2), vp.z + V.len / 2); }
  const dz0 = -11, dz1 = -4, dcx = R.cxAt(-7.5) - 4.4;                              // the depot, west of the tracks
  plaza(dcx - 2.6, dz0 - 1, dcx + 1.8, dz1 + 1, '#bfb39a');
  N.depot = B.add({ x: dcx, z: (dz0 + dz1) / 2, w: 2.4, d: dz1 - dz0, floors: 1, style: 'house', tint: hsl(0.11, 0.35, 0.78), cell: 1.4, gh: 1.35, gable: true, roofTint: hsl(0.05, 0.35, 0.3), storefront: false });
  N.depot.noSigns = true; N.depot.landmark = true; N.depot.name = 'the Santa Fe depot';
  // Oceanside Transit Center: the depot east of the tracks and the Sprinter's bay, its tower, the bus bays to Tremont
  const tz = R.tcz, cx = R.cxAt(tz);
  plaza(cx - 4.2, tz - 15, cx - 2.2, tz + 15);
  plaza(cx + 4.4, tz - 15, cx + 11.4, tz + 15, '#d2c8b4');
  N.tcDepot = B.add({ x: cx + 8.2, z: tz + 1, w: 5.2, d: 13, floors: 1, style: 'stucco', tint: hsl(0.11, 0.3, 0.86), cell: 1.6, gh: 1.7, storefront: false });
  N.tcTower = B.add({ x: cx + 8.6, z: tz - 6.8, w: 2.2, d: 2.2, floors: 3, style: 'stucco', tint: hsl(0.11, 0.3, 0.86), cell: 1.1, gh: 1.7, fh: 1.2, storefront: false });
  for (const b of [N.tcDepot, N.tcTower]) { b.noSigns = true; b.landmark = true; b.bareRoof = true; b.name = 'the Transit Center'; }
  g.rect(cx + 11.6, tz - 13, Math.min(cx + 26, 18.4), tz + 9, '#8e8c86'); mark(cx + 11.6, tz - 13, Math.min(cx + 26, 18.4), tz + 9);
  N.busBays = [];
  for (let z = tz - 10; z < tz + 7; z += 3.4) { g.rect(cx + 13.2, z, Math.min(cx + 25, 17.6), z + 0.12, 'rgba(240,240,235,.7)'); N.busBays.push({ x: cx + 18.4, z: z + 1.7 }); }
  city.crowds.push({ x: cx + 6.4, z: tz, r: 1.5, n: 6 }, { x: cx - 3.2, z: tz + 4, r: 1, n: 4 }, { x: cx + 2.2, z: tz - 3, r: 1, n: 4 });
  // Coast Highway, on the Sprinter: a platform on the north side
  const C = R.stations.coastHwy, cp = R.sprinter.at(C.s);
  plaza(cp.x - C.len / 2, cp.z - 3.4, cp.x + C.len / 2, cp.z - 1.2);
  city.crowds.push({ x: cp.x, z: cp.z - 2.2, r: 1, n: 3 }, { x: vp.x + 2.4, z: vp.z, r: 1.2, n: 4 }, { x: vp.x - 2.4, z: vp.z - 4, r: 1.2, n: 4 });
}

// ================= the 3D: steel, crossings, stations, the trains =================
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });
const mergeAll = (geos) => mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), XAX = new THREE.Vector3(1, 0, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// ---------- the trains' look: one texture for everything, every part mapped onto a piece of it ----------
const ATLAS = (() => {
  const W = 1024, H = 1024;
  const tex = canvasTex(W, H, (x) => {
    const blue = '#2c3aa3', teal = '#2aa4b4', black = '#16181d', white = '#f2f2ee', glass = '#1d2733';
    // row 0: the bi-level's side
    const side = (y0, h, cab) => {
      x.fillStyle = blue; x.fillRect(0, y0, W, h);
      x.fillStyle = teal; x.fillRect(0, y0, W, h * 0.12);
      x.fillStyle = black; x.fillRect(0, y0 + h * 0.8, W, h * 0.2);
      x.fillStyle = white; x.fillRect(0, y0 + h * 0.775, W, h * 0.025);
      x.fillStyle = glass; for (let i = 0; i < 13; i++) x.fillRect(40 + i * 75, y0 + h * 0.2, 52, h * 0.15);
      for (let i = 0; i < 13; i++) if (i < 5 || i > 7) x.fillRect(40 + i * 75, y0 + h * 0.5, 52, h * 0.14);
      x.fillStyle = '#1f2a7a'; x.fillRect(W * 0.43, y0 + h * 0.46, W * 0.12, h * 0.32);          // the doors
      x.fillStyle = white; x.font = `italic 900 ${h * 0.16}px Inter, Arial`; x.textAlign = 'center'; x.fillText('COASTER', W * 0.49, y0 + h * 0.43);
    };
    side(0, 256, false); side(256, 256, true);
    // rows 2 and 2b: the locomotive's side, the teal cab at the right (its left side) and at the left (its right side),
    // so COASTER reads the right way on both
    const lside = (y2, h2, noseLeft) => {
      const nx0 = noseLeft ? 0 : W * 0.86, at = (f) => (noseLeft ? W - f : f);
      x.fillStyle = blue; x.fillRect(0, y2, W, h2); x.fillStyle = black; x.fillRect(0, y2 + h2 * 0.78, W, h2 * 0.22);
      x.fillStyle = white; x.fillRect(0, y2 + h2 * 0.76, W, h2 * 0.025);
      x.fillStyle = teal; x.fillRect(nx0, y2, W * 0.14, h2 * 0.76);
      x.fillStyle = glass; x.fillRect(noseLeft ? W * 0.03 : W * 0.9, y2 + h2 * 0.18, W * 0.07, h2 * 0.2);
      x.fillStyle = white; x.font = `italic 900 ${h2 * 0.2}px Inter, Arial`; x.textAlign = 'center'; x.fillText('COASTER', at(W * 0.45), y2 + h2 * 0.5);
      x.font = `700 ${h2 * 0.07}px Inter, Arial`; x.fillText('NORTH COUNTY TRANSIT DISTRICT', at(W * 0.45), y2 + h2 * 0.62);
      x.strokeStyle = '#1f2a7a'; x.lineWidth = 4; x.strokeRect(at(W * 0.66) - W * 0.04, y2 + h2 * 0.15, W * 0.08, h2 * 0.58);
    };
    lside(512, 128, false); lside(640, 128, true);
    // row 3: the Sprinter's side
    const y3 = 768, h3 = 160;
    x.fillStyle = white; x.fillRect(0, y3, W, h3); x.fillStyle = glass; x.fillRect(0, y3 + h3 * 0.22, W, h3 * 0.3);
    x.fillStyle = '#1f5fa8'; x.fillRect(0, y3 + h3 * 0.62, W, h3 * 0.1); x.fillStyle = '#5bb04a'; x.fillRect(0, y3 + h3 * 0.72, W, h3 * 0.05);
    x.fillStyle = '#9aa0a6'; x.fillRect(0, y3 + h3 * 0.85, W, h3 * 0.15);
    x.fillStyle = '#1f5fa8'; x.font = `italic 900 ${h3 * 0.16}px Inter, Arial`; x.textAlign = 'center'; x.fillText('SPRINTER', W * 0.5, y3 + h3 * 0.6);
    // swatches along the bottom
    ['#2c3aa3', '#2aa4b4', '#16181d', '#f2f2ee', '#1d2733', '#55595f', '#d23a2a', '#f5e9b0', '#c9ccd0', '#1f5fa8'].forEach((c, i) => { x.fillStyle = c; x.fillRect(i * 64, 960, 64, 64); });
  });
  const sw = (i) => [(i * 64 + 32) / W, 1 - 992 / H];
  return { tex, rect: { bi: [0, 0, 1, 0.25], cab: [0, 0.25, 1, 0.5], loco: [0, 0.5, 1, 0.625], locoL: [0, 0.625, 1, 0.75], spr: [0, 0.75, 1, 0.75 + 160 / 1024] }, sw: { blue: sw(0), teal: sw(1), black: sw(2), white: sw(3), glass: sw(4), grey: sw(5), red: sw(6), lamp: sw(7), silver: sw(8), sblue: sw(9) } };
})();
// a box whose two long sides carry a strip of the atlas (u along its length), everything else one swatch
function sideBox(w, h, l, x, y, z, rect, fill, flip = false) {
  const g = new THREE.BoxGeometry(w, h, l).translate(x, y, z), uv = g.attributes.uv;
  const [u0, v0, u1, v1] = rect, V0 = 1 - v1, V1 = 1 - v0;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);                                   // +x, -x, +y, -y, +z, -z
    if (face < 2) { let u = uv.getX(i), v = uv.getY(i); uv.setXY(i, u0 + (u1 - u0) * u, V0 + (V1 - V0) * v); }
    else uv.setXY(i, fill[0], fill[1]);
  }
  return g;
}
function swatch(g, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, s[0], s[1]); return g; }
// the bi-level's chamfered roof: a low prism over the body, teal
function roof(w, l, y, z) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2 - 0.16, 0.24); sh.lineTo(-w / 2 + 0.16, 0.24); sh.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false }).translate(0, y, z - l / 2);
  return swatch(g.index ? g.toNonIndexed() : g, ATLAS.sw.teal);
}
function trucks(l, fill = ATLAS.sw.black) {
  const gs = [swatch(new THREE.BoxGeometry(0.8, 0.14, l - 0.2).translate(0, 0.22, 0), fill)];
  for (const z of [-l / 2 + 0.6, l / 2 - 0.6]) for (const s of [-1, 1]) for (const dz of [-0.2, 0.2]) gs.push(swatch(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10).rotateZ(Math.PI / 2).translate(s * 0.34, 0.12, z + dz), ATLAS.sw.grey));
  return gs;
}
const CAR = (() => {
  const W = 0.94;
  // the bi-level: body to 1.3, the roof prism on top; the cab car has its windscreen and lamps on the +z end
  const bi = mergeAll([sideBox(W, 1.08, 4.5, 0, 0.84, 0, ATLAS.rect.bi, ATLAS.sw.blue), roof(W, 4.5, 1.38, 0), ...trucks(4.5)]);
  const cab = mergeAll([sideBox(W, 1.08, 4.5, 0, 0.84, 0, ATLAS.rect.cab, ATLAS.sw.blue), roof(W, 4.5, 1.38, 0), ...trucks(4.5),
    swatch(new THREE.BoxGeometry(0.7, 0.3, 0.03).translate(0, 1.15, 2.26), ATLAS.sw.glass), swatch(new THREE.BoxGeometry(0.16, 0.08, 0.03).translate(-0.3, 0.55, 2.26), ATLAS.sw.lamp), swatch(new THREE.BoxGeometry(0.16, 0.08, 0.03).translate(0.3, 0.55, 2.26), ATLAS.sw.lamp)]);
  // the locomotive: a lower body, the teal cab sloping down to its nose at +z, the windscreen, the lamps
  const lp = new THREE.Shape(); lp.moveTo(-1.95, 0.3); lp.lineTo(1.5, 0.3); lp.lineTo(1.95, 0.32); lp.lineTo(1.98, 0.75); lp.lineTo(1.75, 1.18); lp.lineTo(1.35, 1.3); lp.lineTo(-1.95, 1.3); lp.lineTo(-1.95, 0.3);
  const locoBody = new THREE.ExtrudeGeometry(lp, { depth: W, bevelEnabled: false }); locoBody.rotateY(-Math.PI / 2).translate(W / 2, 0, 0);
  const lb = locoBody.index ? locoBody.toNonIndexed() : locoBody, luv = lb.attributes.uv, lpos = lb.attributes.position, lnor = (lb.computeVertexNormals(), lb.attributes.normal);
  for (let i = 0; i < luv.count; i++) {
    // each side reads front-to-back the way you look at it: the -x side has the nose on its right, the +x side on its left
    if (Math.abs(lnor.getX(i)) > 0.9) {
      const z = lpos.getZ(i), y = lpos.getY(i), left = lnor.getX(i) > 0, [u0, v0, u1, v1] = left ? ATLAS.rect.locoL : ATLAS.rect.loco;
      const u = left ? (1.98 - z) / 3.93 : (z + 1.95) / 3.93;
      luv.setXY(i, u0 + (u1 - u0) * u, 1 - v1 + (v1 - v0) * ((y - 0.3) / 1.0));
    }
    else luv.setXY(i, ...(lpos.getZ(i) > 1.3 ? ATLAS.sw.teal : ATLAS.sw.blue));
  }
  const loco = mergeAll([lb, ...trucks(3.9), swatch(new THREE.BoxGeometry(0.72, 0.26, 0.03).rotateX(-0.5).translate(0, 1.02, 1.86), ATLAS.sw.glass),
    swatch(new THREE.BoxGeometry(0.14, 0.1, 0.04).translate(-0.3, 0.62, 1.99), ATLAS.sw.lamp), swatch(new THREE.BoxGeometry(0.14, 0.1, 0.04).translate(0.3, 0.62, 1.99), ATLAS.sw.lamp),
    swatch(new THREE.BoxGeometry(0.8, 0.16, 0.06).translate(0, 0.38, 2.0), ATLAS.sw.silver), swatch(new THREE.BoxGeometry(0.2, 0.08, 0.1).translate(0, 1.33, 1.0), ATLAS.sw.grey)]);
  // the Sprinter car: white, a long glass band, rounded off at the cab end (+z)
  const spr = mergeAll([sideBox(0.9, 0.95, 4.0, 0, 0.75, 0, ATLAS.rect.spr, ATLAS.sw.white), swatch(new THREE.BoxGeometry(0.86, 0.12, 3.9).translate(0, 1.28, 0), ATLAS.sw.silver), ...trucks(4.0, ATLAS.sw.grey),
    swatch(new THREE.BoxGeometry(0.9, 0.95, 0.3).translate(0, 0.75, 2.12), ATLAS.sw.white), swatch(new THREE.BoxGeometry(0.76, 0.34, 0.04).rotateX(-0.25).translate(0, 0.98, 2.28), ATLAS.sw.glass),
    swatch(new THREE.BoxGeometry(0.9, 0.08, 0.04).translate(0, 0.62, 2.28), ATLAS.sw.sblue), swatch(new THREE.BoxGeometry(0.12, 0.07, 0.03).translate(-0.3, 0.5, 2.29), ATLAS.sw.lamp), swatch(new THREE.BoxGeometry(0.12, 0.07, 0.03).translate(0.3, 0.5, 2.29), ATLAS.sw.lamp)]);
  return { bi, cab, loco, spr, len: { bi: 4.5, cab: 4.5, loco: 3.93, spr: 4.3 } };
})();

export class Rail {
  constructor(scene, N) {
    this.scene = scene; this.N = N; this.loose = []; this.lit = [];
    const R = RAIL;
    this.lines = { coast: R.coast, sprinter: R.sprinter };
    this.steel(scene);
    this.crossings(scene, N.crossings || []);
    this.stationsVillage(scene);
    this.stationTC(scene);
    this.stationCoastHwy(scene);
    this.trains(scene);
  }

  // ---------- the rails: steel strips on every track, a little proud of the ties ----------
  steel(scene) {
    const geos = [], strip = (pts) => {
      for (let k = 0; k + 1 < pts.length; k += 1) {
        const [a, b] = pts[k], [c, d] = pts[k + 1], L = Math.hypot(c - a, d - b); if (L < 0.01) continue;
        geos.push(new THREE.BoxGeometry(0.06, 0.07, L + 0.02).rotateY(Math.atan2(c - a, d - b)).translate((a + c) / 2, 0.06, (b + d) / 2));
      }
    };
    const tracks = [offsetPts(RAIL.coast, -TRACK, 3), offsetPts(RAIL.coast, TRACK, 3), offsetPts(RAIL.sprinter, 0, 3)];
    for (const t of tracks) { const T = trackOf(t); for (const d of [-0.36, 0.36]) strip(offsetPts(T, d, 3)); }
    const m = new THREE.Mesh(mergeAll(geos), new THREE.MeshStandardMaterial({ color: 0x9da2a8, roughness: 0.35, metalness: 0.7 })); m.receiveShadow = true; scene.add(m);
  }

  // ---------- level crossings: a mast either side with its crossbuck, red lamps and a gate arm ----------
  crossings(scene, list) {
    this.xs = [];
    const mast = mergeAll([box(0.08, 1.7, 0.08, 0, 0.85, 0, 0xf2f2ee), box(0.06, 0.6, 0.06, 0, 1.75, 0, 0xf2f2ee),
      box(0.7, 0.1, 0.03, 0, 1.75, 0.05, 0xf4f4f0).rotateZ(0), tint(new THREE.BoxGeometry(0.7, 0.1, 0.03).rotateZ(0.7).translate(0, 1.75, 0.05), 0xf4f4f0), tint(new THREE.BoxGeometry(0.7, 0.1, 0.03).rotateZ(-0.7).translate(0, 1.75, 0.05), 0xf4f4f0),
      box(0.5, 0.06, 0.04, 0, 1.28, 0.06, 0x1d1f22), box(0.3, 0.3, 0.2, 0, 0.25, 0, 0x6f7377)]);
    const arm = mergeAll([...Array.from({ length: 6 }, (_, i) => box(0.42, 0.07, 0.07, 0.25 + i * 0.42, 0, 0, i % 2 ? 0xd23a2a : 0xf4f4f0))]);
    const n = list.length * 2;
    this.mastIM = new THREE.InstancedMesh(mast, vc({ roughness: 0.5 }), Math.max(1, n));
    this.armIM = new THREE.InstancedMesh(arm, vc({ roughness: 0.5 }), Math.max(1, n));
    this.lampIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, n * 2));
    let i = 0;
    for (const c of list) {
      const T = this.lines[c.line], p = T.at(c.s);
      // either side of the line, on the right-hand side of the street as you drive up to it
      const half = (c.line === 'coast' ? TRACK + 1.4 : 1.2), sh = Math.max(1.6, (c.w || 4) / 2 + 0.25);
      const X0 = { x: c.x, z: c.z, sides: [] };
      for (const s of [-1, 1]) {
        // the approach direction on this side: along the street towards the line
        const dirx = -s * Math.sign(c.ux * p.nx + c.uz * p.nz || 1) * c.ux, dirz = -s * Math.sign(c.ux * p.nx + c.uz * p.nz || 1) * c.uz;
        const rx = -dirz, rz = dirx;                                                // the driver's right
        const mx = c.x - dirx * half + rx * sh, mz = c.z - dirz * half + rz * sh, yaw = Math.atan2(dirx, dirz);
        _m.compose(_p.set(mx, 0, mz), _q.setFromAxisAngle(UP, yaw), _s.set(1, 1, 1)); this.mastIM.setMatrixAt(i, _m);
        X0.sides.push({ i, mx, mz, yaw, armYaw: Math.atan2(rz, -rx), up: 1, alive: true });
        i++;
      }
      this.xs.push({ ...c, ...X0, down: 0, flash: 0 });
    }
    for (const m of [this.mastIM, this.armIM, this.lampIM]) { m.castShadow = m !== this.lampIM; m.frustumCulled = false; scene.add(m); }
    this.updateCrossings(0, true);
  }
  updateCrossings(dt, force = false) {
    const c = new THREE.Color(); let li = 0;
    for (const X of this.xs) {
      // a train on this line within reach: lights on, gates down
      let near = false;
      for (const t of this.allTrains || []) if (t.line === X.line && t.alive && t.visible && Math.abs(t.mid - X.s) < t.len / 2 + 20) near = true;
      const target = near ? 1 : 0, was = X.down;
      X.down = clamp(X.down + (target - X.down) * Math.min(1, dt * 1.6) + (target - X.down) * 0.002, 0, 1);
      X.flash += dt;
      const on = near ? Math.floor(X.flash * 2.5) % 2 : -1;
      for (const S of X.sides) {
        // the arm: pivots at the mast's foot, from straight up (0) to across the lane (1)
        const ang = S.alive ? (1 - X.down) * Math.PI / 2 * 0.95 : 0, k = S.i;
        if (S.alive) { _q.setFromAxisAngle(UP, S.armYaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang)); _m.compose(_p.set(S.mx, 0.85, S.mz), _q, _s.set(1, 1, 1)); }
        else _m.copy(ZERO);
        if (force || Math.abs(X.down - was) > 1e-4 || !S.alive) { this.armIM.setMatrixAt(k, _m); this.armIM.instanceMatrix.needsUpdate = true; }
        for (const j of [0, 1]) {
          if (force || near || on !== X.lastOn) {
            const lx = S.mx + Math.cos(S.yaw) * (j ? 0.18 : -0.18), lz = S.mz - Math.sin(S.yaw) * (j ? 0.18 : -0.18);
            _m.compose(_p.set(lx, 1.28, lz), _q.setFromAxisAngle(UP, S.yaw), _s.set(1, 1, 1)); this.lampIM.setMatrixAt(li, S.alive ? _m : ZERO);
            this.lampIM.setColorAt(li, c.set(on === j ? 0xff2a1a : 0x3a1410)); this.lampIM.instanceMatrix.needsUpdate = true; this.lampIM.instanceColor.needsUpdate = true;
          }
          li++;
        }
      }
      X.lastOn = on;
    }
  }

  // ---------- Carlsbad Village: side platforms, canopies, the sign, the depot's trim ----------
  stationsVillage(scene) {
    const V = RAIL.stations.village, T = RAIL.coast, p = T.at(V.s), geos = [];
    this.platforms(geos, T, V.s, V.len, [-1, 1]);
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) this.canopy(T, V.s + k * 7, s * 1.95, 3.6, 0x2b6f8a);
    this.stationSign(T, V.s - V.len / 2 + 2, 3.4, 'CARLSBAD VILLAGE', -1); this.stationSign(T, V.s + V.len / 2 - 2, -3.4, 'CARLSBAD VILLAGE', 1);
    const m = new THREE.Mesh(mergeAll(geos), vc({ roughness: 0.85 })); m.receiveShadow = true; scene.add(m);
    // the 1887 Santa Fe depot: board-and-batten, dark trim, the operator's bay toward the tracks, CARLSBAD on its ends
    const D = this.N.depot; if (!D) return;
    const top = D.cells.reduce((m2, c) => Math.max(m2, c.y + c.hy), 0), dg = [];
    for (let z = D.z - D.d / 2 + 0.2; z < D.z + D.d / 2; z += 0.3) for (const s of [-1, 1]) dg.push(box(0.03, top - 0.1, 0.04, D.x + s * (D.w / 2 + 0.01), top / 2, z, 0x9c8a63));
    dg.push(box(D.w + 0.06, 0.08, D.d + 0.06, D.x, top - 0.04, D.z, 0x5a3a26), box(D.w + 0.06, 0.08, D.d + 0.06, D.x, 0.08, D.z, 0x5a3a26));
    dg.push(box(0.6, top * 0.85, 1.4, D.x + D.w / 2 + 0.3, top * 0.42, D.z, hsl(0.11, 0.35, 0.78)), box(0.66, 0.08, 1.5, D.x + D.w / 2 + 0.3, top * 0.86, D.z, 0x5a3a26));
    cutoutOn(scene, D, dg, vc({ roughness: 0.8 }));
    const tex = canvasTex(512, 96, (x, w, h) => { x.fillStyle = '#efe4c8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#5a3a26'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); x.fillStyle = '#3d2618'; x.font = '800 58px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('CARLSBAD', w / 2, h / 2 + 3); });
    for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); pl.position.set(D.x, top + 0.45, D.z + s * (D.d / 2 + 0.25)); pl.rotation.y = s > 0 ? 0 : Math.PI; scene.add(pl); hangOn(D, pl); }
  }

  // ---------- Oceanside Transit Center ----------
  stationTC(scene) {
    const S = RAIL.stations.transit, T = RAIL.coast, geos = [], tz = RAIL.tcz, cx = RAIL.cxAt(tz);
    this.platforms(geos, T, S.s, S.len, [-1]);
    // the island between the coast line's east track and the Sprinter's bay
    const pc = T.at(S.s); geos.push(tint(new THREE.BoxGeometry(1.75, 0.32, S.len).rotateY(pc.yaw).translate(pc.x + pc.nx * (TRACK + 1.42), 0.16, pc.z + pc.nz * (TRACK + 1.42)), 0xc4bdb0));
    geos.push(tint(new THREE.BoxGeometry(0.12, 0.012, S.len).rotateY(pc.yaw).translate(pc.x + pc.nx * (TRACK + 0.62), 0.33, pc.z + pc.nz * (TRACK + 0.62)), 0xf2c21c));
    geos.push(tint(new THREE.BoxGeometry(0.12, 0.012, S.len * 0.6).rotateY(pc.yaw).translate(pc.x + pc.nx * (SPR - 0.6), 0.33, pc.z - 6 + pc.nz * (SPR - 0.6)), 0xf2c21c));
    for (const k of [-2, -1, 0, 1, 2]) this.canopy(T, S.s + k * 5.6, TRACK + 1.42, 4, 0x8a4b2c, true);
    this.canopy(T, S.s - 4, -1.95, 5, 0x8a4b2c, true); this.canopy(T, S.s + 4, -1.95, 5, 0x8a4b2c, true);
    this.stationSign(T, S.s - 12, -3.3, 'OCEANSIDE', 1);
    const m = new THREE.Mesh(mergeAll(geos), vc({ roughness: 0.85 })); m.receiveShadow = true; scene.add(m);
    // the depot: mission revival, cream stucco, red tile roofs, an arcade along the tracks; the tower with its clock
    const D = this.N.tcDepot, Tw = this.N.tcTower; if (!D || !Tw) return;
    const top = D.cells.reduce((a, c) => Math.max(a, c.y + c.hy), 0), dg = [];
    const r1 = hipRoof(D.w + 0.5, D.d + 0.5, 1.0); r1.translate(D.x, top, D.z); dg.push(tint(r1, 0xb85a36));
    for (let z = D.z - D.d / 2 + 0.6; z <= D.z + D.d / 2 - 0.5; z += 1.3) { dg.push(box(0.3, 1.3, 0.22, D.x - D.w / 2 - 1.1, 0.65, z, 0xefe6d2)); }
    dg.push(box(1.3, 0.35, D.d, D.x - D.w / 2 - 0.65, 1.48, D.z, 0xefe6d2), tint(new THREE.BoxGeometry(1.5, 0.08, D.d + 0.3).rotateZ(0.25).translate(D.x - D.w / 2 - 0.7, 1.72, D.z), 0xb85a36));
    for (let z = D.z - D.d / 2 + 1.25; z <= D.z + D.d / 2 - 1; z += 1.3) dg.push(box(0.04, 0.9, 0.9, D.x - D.w / 2 - 0.01, 0.6, z, 0x6a4a34));    // doors and windows behind the arcade
    const ttop = Tw.cells.reduce((a, c) => Math.max(a, c.y + c.hy), 0), r2 = hipRoof(Tw.w + 0.4, Tw.d + 0.4, 1.3); r2.translate(Tw.x, ttop, Tw.z); dg.push(tint(r2, 0xb85a36));
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { dg.push(box(dx ? 0.04 : 0.9, 0.9, dz ? 0.04 : 0.9, Tw.x + dx * (Tw.w / 2 + 0.02), ttop - 0.7, Tw.z + dz * (Tw.d / 2 + 0.02), 0xf8f5ec)); dg.push(box(dx ? 0.05 : 0.5, 0.05, dz ? 0.05 : 0.5, Tw.x + dx * (Tw.w / 2 + 0.04), ttop - 0.7, Tw.z + dz * (Tw.d / 2 + 0.04), 0x2a2a2a)); }
    cutoutOn(scene, [D, Tw], dg, vc({ roughness: 0.8 }));
    const tex = canvasTex(1024, 96, (x, w, h) => { x.fillStyle = '#efe6d2'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a3a22'; x.font = '800 60px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('OCEANSIDE TRANSIT CENTER', w / 2, h / 2 + 3, w - 30); });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); pl.position.set(D.x + D.w / 2 + 0.03, 1.35, D.z); pl.rotation.y = Math.PI / 2; scene.add(pl); hangOn(D, pl);
  }

  // ---------- Coast Highway (Sprinter) ----------
  stationCoastHwy(scene) {
    const S = RAIL.stations.coastHwy, T = RAIL.sprinter, geos = [];
    this.platforms(geos, T, S.s, S.len, [-1], 0, 1.1);
    this.canopy(T, S.s, -1.75, 4, 0x1f5fa8);
    this.stationSign(T, S.s + 4, -2.9, 'COAST HIGHWAY', 1);
    const m = new THREE.Mesh(mergeAll(geos), vc({ roughness: 0.85 })); m.receiveShadow = true; scene.add(m);
    // and the Sprinter's own sign at its bay in the Transit Center
    this.stationSign(RAIL.sprinter, 3, SPR - 1.3 + 0.3, 'SPRINTER', -1);
  }

  // a concrete platform beside a track: its edge 1.25 from the track (0.5 for the car and the gap), the yellow strip
  platforms(geos, T, s0, len, sides, off = TRACK, half = 0) {
    for (const sd of sides) {
      const p = T.at(s0), d = off + 1.32, h = half || 0;
      const w = h ? 1.4 : 1.4, cxp = p.x + p.nx * sd * (h ? h + 0.85 : d), czp = p.z + p.nz * sd * (h ? h + 0.85 : d);
      geos.push(tint(new THREE.BoxGeometry(w, 0.32, len).rotateY(p.yaw).translate(cxp, 0.16, czp), 0xc4bdb0));
      const ex = p.x + p.nx * sd * (h ? h + 0.22 : off + 0.7), ez = p.z + p.nz * sd * (h ? h + 0.22 : off + 0.7);
      geos.push(tint(new THREE.BoxGeometry(0.12, 0.012, len).rotateY(p.yaw).translate(ex, 0.33, ez), 0xf2c21c));
      for (let t = -len / 2 + 2; t < len / 2 - 1; t += 4.5) { const q = T.at(s0 + t); geos.push(tint(new THREE.BoxGeometry(0.22, 0.12, 0.7).rotateY(q.yaw).translate(q.x + q.nx * sd * (h ? h + 1.2 : d + 0.4), 0.38, q.z + q.nz * sd * (h ? h + 1.2 : d + 0.4)), 0x3b4a5a)); }   // benches
    }
  }
  // a canopy on a platform: posts down the middle, a roof sloping to the track side
  canopy(T, s, off, len, color, tile = false) {
    const p = T.at(s), gs = [], x = p.x + p.nx * off, z = p.z + p.nz * off;
    for (const t of [-len / 2 + 0.3, 0, len / 2 - 0.3]) gs.push(box(0.09, 1.6, 0.09, 0, 1.12, t, 0x3a3f44));
    gs.push(tint(new THREE.BoxGeometry(1.5, 0.08, len).rotateZ(-0.12 * Math.sign(off)).translate(0, 1.95, 0), tile ? 0xb85a36 : color));
    gs.push(box(1.3, 0.05, len - 0.1, 0, 1.86, 0, 0xd8d4cc));
    this.piece(gs, x, z, p.yaw, len / 2);
  }
  stationSign(T, s, off, text, face) {
    const p = T.at(s), x = p.x + p.nx * off, z = p.z + p.nz * off;
    const tex = canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#1f3f6f'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '800 50px Inter, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2, w - 24); });
    const g = new THREE.Group();
    const face1 = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide })); face1.position.y = 1.5;
    const posts = new THREE.Mesh(mergeAll([box(0.06, 1.5, 0.06, -0.8, 0.75, -0.02, 0x3a3f44), box(0.06, 1.5, 0.06, 0.8, 0.75, -0.02, 0x3a3f44)]), vc());
    g.add(face1, posts); g.position.set(x, 0.3, z); g.rotation.y = p.yaw + Math.PI / 2 * face; this.scene.add(g);
    this.loose.push({ m: g, x, z, r: 1, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) });
  }
  piece(geos, x, z, yaw, r) {
    const m = new THREE.Mesh(mergeAll(geos), vc()); m.position.set(x, 0, z); m.rotation.y = yaw; m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    this.loose.push({ m, x, z, r, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) });
  }

  // ---------- the trains ----------
  trains(scene) {
    const mat = new THREE.MeshStandardMaterial({ map: ATLAS.tex, roughness: 0.45, metalness: 0.15 });
    this.trainMat = mat;
    const make = (kinds) => kinds.map((k) => { const m = new THREE.Mesh(CAR[k], mat); m.castShadow = true; m.visible = false; scene.add(m); return { m, k, len: CAR.len[k] }; });
    const coastTrack = (d) => trackOf(offsetPts(RAIL.coast, d, 2));
    const south = coastTrack(-TRACK), north = coastTrack(TRACK);
    const stopS = (T, st) => T.near(...((p) => [p.x, p.z])(RAIL.coast.at(st.s))).s;
    const coaster = (T, dir, delay) => {
      const cars = make(['loco', 'bi', 'bi', 'bi', 'cab']);                       // the locomotive at the south end, the cab car north
      const len = cars.reduce((a, c) => a + c.len + 0.12, 0);
      return { line: 'coast', T, cars, len, dir, s: dir > 0 ? -len - 4 : T.L + len + 4, v: 6, wait: delay, dwell: 0, alive: true, visible: false, mid: -999,
        stops: [stopS(T, RAIL.stations.transit), stopS(T, RAIL.stations.village)], done: new Set(), vmax: 8 };
    };
    // southbound on the west track, northbound on the east (each runs the length of the map and comes back on the other)
    this.coasters = [coaster(south, 1, 0), coaster(north, -1, 30)];
    this.coasterTracks = { 1: south, '-1': north };
    const sp = { line: 'sprinter', T: RAIL.sprinter, cars: make(['spr', 'spr']), dir: 1, s: 3, v: 0, wait: 6, dwell: 0, alive: true, visible: true, mid: 0, stops: [RAIL.stations.coastHwy.s, RAIL.stations.sprinterTC.s], done: new Set(), vmax: 6, shuttle: true };
    sp.len = sp.cars.reduce((a, c) => a + c.len + 0.12, 0); sp.s = sp.len + 1;
    this.sprinter = sp;
    this.allTrains = [...this.coasters, sp];
    for (const t of this.allTrains) this.place(t);
  }
  // lay a train's cars out behind its front (s is the front of the train in the direction of travel)
  place(t) {
    let off = 0, any = false;
    // the cars are listed from the dir>0 end; when running the other way the last car leads
    const order = t.dir > 0 ? t.cars : t.cars.slice().reverse();
    for (const c of order) {
      const s = t.s - t.dir * (off + c.len / 2); off += c.len + 0.12;
      const inside = s > 0.5 && s < t.T.L - 0.5; c.m.visible = t.alive && inside; any ||= c.m.visible;
      if (!inside) continue;
      const p = t.T.at(s);
      c.m.position.set(p.x, 0.02, p.z);
      // each car's +z end faces the dir>0 way, so the locomotive leads southbound and the cab car northbound
      // a car's cab (+z) end: the locomotive's faces up the line (s rising), the cab car's and the Sprinter's second
      // car's face down it, so each train has a cab at both ends whichever way it runs
      c.m.rotation.y = p.yaw + (c.k === 'cab' || c.k === 'spr' && c === t.cars[1] ? Math.PI : 0);
    }
    t.visible = any; t.mid = t.s - t.dir * t.len / 2;
  }
  updateTrain(t, dt) {
    if (!t.alive) { t.deadT -= dt; if (t.deadT > 0) return; t.alive = true; t.wait = 4; t.done.clear(); if (!t.shuttle) { t.dir = -t.dir; t.T = this.coasterTracks[t.dir]; t.s = t.dir > 0 ? -t.len - 4 : t.T.L + t.len + 4; } }
    if (t.wait > 0) { t.wait -= dt; this.place(t); return; }
    // slow for the next stop ahead, wait there
    let target = t.vmax;
    for (const st of t.stops) {
      if (t.done.has(st)) continue;
      const ahead = (st - t.mid) * t.dir;
      if (ahead > -0.5 && ahead < 40) target = Math.min(target, Math.sqrt(Math.max(0, ahead) * 2.2));
      if (ahead <= 0.3 && ahead > -2 && t.dwell <= 0) { t.dwell = rand(8, 12); t.done.add(st); t.v = 0; }
    }
    if (t.dwell > 0) { t.dwell -= dt; target = 0; }
    t.v += clamp(target - t.v, -3 * dt, 1.2 * dt);
    t.s += t.dir * t.v * dt;
    // off the end of the line: gone for a while, then back the other way (the Sprinter turns round at its ends)
    if (t.shuttle) { if (t.dir > 0 && t.s > t.T.L + t.len + 2) { t.dir = -1; t.s = t.T.L + 2; t.wait = 14; t.done.clear(); } else if (t.dir < 0 && t.s < 1) { t.dir = 1; t.s = 1 + t.len; t.wait = 10; t.done.clear(); t.v = 0; } }
    else if (t.dir > 0 ? t.s > t.T.L + t.len + 4 : t.s < -t.len - 4) { t.dir = -t.dir; t.T = this.coasterTracks[t.dir]; t.s = t.dir > 0 ? -t.len - 4 : t.T.L + t.len + 4; t.wait = rand(18, 30); t.done.clear(); }
    this.place(t);
  }

  update(dt) {
    for (const t of this.allTrains) this.updateTrain(t, dt);
    this.updateCrossings(dt);
    const n = G.night || 0; this.trainMat.emissive?.setRGB(0.12 * n, 0.12 * n, 0.1 * n); this.trainMat.emissiveMap = this.trainMat.emissiveMap || ATLAS.tex;
    for (const L of this.loose) if (!L.alive && L.t < 1) { L.t = Math.min(1, L.t + dt * 2.4); const k = L.t * L.t; L.m.rotation.x = L.ax * 1.4 * k; L.m.rotation.z = L.az * 1.4 * k; L.m.position.y = -0.15 * k; }
  }

  onBlast(x, z, reach) {
    for (const t of this.allTrains) if (t.alive && t.visible && t.cars.some((c) => c.m.visible && Math.hypot(c.m.position.x - x, c.m.position.z - z) < reach + 1.5)) {
      t.alive = false; t.deadT = 40; t.v = 0; t.dwell = 0;
      for (const c of t.cars) if (c.m.visible) { G.fx.explosion(c.m.position.x, 0.8, c.m.position.z, 1.1, null, 'bomb'); c.m.visible = false; }
      G.progress && G.progress.event && G.progress.event('nc_train');
    }
    for (const L of this.loose) if (L.alive && Math.hypot(L.x - x, L.z - z) < reach + L.r) { L.alive = false; L.t = 0; G.fx.dust && G.fx.dust(L.x, 0.5, L.z, 0.6); }
    for (const X of this.xs) for (const S of X.sides) if (S.alive && Math.hypot(S.mx - x, S.mz - z) < reach + 0.4) {
      S.alive = false; _m.compose(_p.set(S.mx, 0.1, S.mz), _q.setFromAxisAngle(UP, S.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(XAX, Math.PI / 2)), _s.set(1, 1, 1));
      this.mastIM.setMatrixAt(S.i, _m); this.mastIM.instanceMatrix.needsUpdate = true;
    }
  }
}

// a sign hung on a building: it goes when the cell behind it goes
function hangOn(b, obj) {
  let best = null, bd = 1e9;
  for (const c of b.cells) { const d = Math.hypot(c.x - obj.position.x, c.y - obj.position.y, c.z - obj.position.z); if (d < bd) { bd = d; best = c; } }
  (best.props ||= []).push({ obj: [obj], x: best.x, y: best.y, z: best.z });
}

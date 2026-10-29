// NORTH COUNTY: Carlsbad and Oceanside, the shape of it. A separate map reached from San Diego (js/travel.js).
// The geography comes from OpenStreetMap (js/ncdata.js, generated): the coast, Buena Vista and Agua Hedionda
// lagoons, the San Luis Rey River and Oceanside Harbor, the rail line, I-5, every street, the landmarks.
// The frame is turned so the coast runs along z: up the coast (north-west, toward Camp Pendleton) is -z, inland is +x.
// 5.5 m to a unit. The downtowns, the village, the Barrio, the lagoons and the harbor are true to shape; only the
// stretch from Civic Center Drive to the river (x0.55) and South Oceanside (Wisconsin Ave to Vista Way, x0.3)
// are squeezed along the coast, and everything past x = 700 m inland (beyond I-5) is squeezed x0.4.
// The origin is the Carlsbad sign: Carlsbad Boulevard at Carlsbad Village Drive.
import D from './ncdata.js';

export const NC = D;
export const BOUNDS = D.bounds;
// the playable land runs inland to Carlsbad High in Carlsbad, to just past I-5 in Oceanside
export const eastEdge = (z) => (z > D.eastBreakZ ? D.xmaxCarlsbad : D.xmaxOceanside);
// where the land starts rising into the hills: the east edge with its step at Buena Vista Lagoon eased into a curve
// (it never cuts inside the playable land)
export const hillEdge = (z) => { const t = Math.min(1, Math.max(0, (z - D.eastBreakZ + 90) / 90)), s = t * t * (3 - 2 * t); return D.xmaxOceanside + (D.xmaxCarlsbad - D.xmaxOceanside) * s; };

export function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// the sea: west of the coastline (it wraps the harbor's jetties and the river mouth)
const COAST = D.coast[0];
export const SEA = [...COAST, [BOUNDS.x0 - 600, COAST[COAST.length - 1][1] + 400], [BOUNDS.x0 - 600, COAST[0][1] - 400]];
export const WATERS = D.water;                                     // the lagoons and the river

// ---------- the land mask: 1 cell per unit over the whole map ----------
export const MASK = { x0: Math.floor(BOUNDS.x0) - 40, z0: Math.floor(BOUNDS.z0) - 40, w: 0, h: 0 };
MASK.w = Math.ceil(BOUNDS.x1 + 60 - MASK.x0); MASK.h = Math.ceil(BOUNDS.z1 + 40 - MASK.z0);
// 0 open sea, 1 lagoon / river / harbor water, 2 land
let LAND = null, SEADIST = null;
function rasterize() {
  const c = document.createElement('canvas'); c.width = MASK.w; c.height = MASK.h;
  const x = c.getContext('2d');
  const path = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a - MASK.x0, b - MASK.z0) : x.moveTo(a - MASK.x0, b - MASK.z0))); x.closePath(); };
  x.fillStyle = '#f00'; x.fillRect(0, 0, MASK.w, MASK.h);           // land
  x.fillStyle = '#000'; path(SEA); x.fill();                          // the sea
  x.fillStyle = '#00f'; for (const w of WATERS) { path(w.p); x.fill(); }   // lagoons, river
  const d = x.getImageData(0, 0, MASK.w, MASK.h).data;
  LAND = new Uint8Array(MASK.w * MASK.h);
  for (let i = 0; i < LAND.length; i++) LAND[i] = d[i * 4] > 128 ? 2 : d[i * 4 + 2] > 128 ? 1 : 0;
  // distance to the open sea (chamfer), for the beach and the surf
  const N = MASK.w, M = MASK.h, INF = 1e6, s = new Float32Array(N * M);
  for (let i = 0; i < s.length; i++) s[i] = LAND[i] === 0 ? 0 : INF;
  for (let z = 0; z < M; z++) for (let xx = 0; xx < N; xx++) { const i = z * N + xx; let v = s[i]; if (xx > 0) v = Math.min(v, s[i - 1] + 1); if (z > 0) { v = Math.min(v, s[i - N] + 1); if (xx > 0) v = Math.min(v, s[i - N - 1] + 1.41); if (xx < N - 1) v = Math.min(v, s[i - N + 1] + 1.41); } s[i] = v; }
  for (let z = M - 1; z >= 0; z--) for (let xx = N - 1; xx >= 0; xx--) { const i = z * N + xx; let v = s[i]; if (xx < N - 1) v = Math.min(v, s[i + 1] + 1); if (z < M - 1) { v = Math.min(v, s[i + N] + 1); if (xx < N - 1) v = Math.min(v, s[i + N + 1] + 1.41); if (xx > 0) v = Math.min(v, s[i + N - 1] + 1.41); } s[i] = v; }
  SEADIST = s;
}
const idx = (x, z) => { const i = Math.floor(x - MASK.x0), k = Math.floor(z - MASK.z0); return i < 0 || k < 0 || i >= MASK.w || k >= MASK.h ? -1 : k * MASK.w + i; };
export function landAt(x, z) { if (!LAND) rasterize(); const i = idx(x, z); return i < 0 ? 0 : LAND[i]; }
export const isLand = (x, z) => landAt(x, z) === 2;
export function seaDist(x, z) { if (!LAND) rasterize(); const i = idx(x, z); return i < 0 ? 0 : SEADIST[i]; }
export function maskData() { if (!LAND) rasterize(); return { LAND, SEADIST }; }

// the beach: the land within a few units of the open sea (wider where OSM has a beach)
export const BEACH_W = 7;
export const onBeach = (x, z) => isLand(x, z) && seaDist(x, z) < BEACH_W;

// ---------- landmarks (from OSM) ----------
const poi = (n) => D.poi.find((p) => p.n === n);
export const PLACES = {
  arch: { x: 0, z: 0 },
  carlsbadStation: poi('Carlsbad Village') || { x: 33, z: -72 },
  carlsbadHigh: poi('Carlsbad High School'),
  pinePark: poi('Pine Park'), holidayPark: poi('Holiday Park'), magee: poi('Magee Park'),
  cityHallC: poi('Carlsbad City Hall'),
  transit: poi('Oceanside Transit Center'), regal: poi('Regal Cinemas 16'),
  missionPacific: poi('Mission Pacific Beach Resort'), seabird: poi('The Seabird Resort'), wyndham: poi('Wyndham Oceanside Pier Resort'),
  cityHallO: poi('Oceanside City Hall'), surfMuseum: poi('California Surf Museum'), topGun: poi('Top Gun House'),
  coastHwyStation: poi('Coast Highway'),
  oceansideHigh: poi('Oceanside High School'),
};
export const PIER = (() => { const p = D.piers.find((q) => q.n === 'Oceanside Pier'); const xs = p.p.map((q) => q[0]), zs = p.p.map((q) => q[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z: (Math.min(...zs) + Math.max(...zs)) / 2 - 0.4, w: 2.6 }; })();
// the grid lines (game units) by street name, for placing things on real streets
export const XS = D.xs, ZS = D.zs;
export const nearestLine = (arr, v) => arr.reduce((b, c) => (Math.abs(c - v) < Math.abs(b - v) ? c : b), arr[0]);

// ---------- the ground: four patches up the coast (the downtowns sharper) ----------
const span = BOUNDS.z1 - BOUNDS.z0, E = Math.ceil(span / 8) + 1, GX = (BOUNDS.x1 - 2 * E) + 6;
export const PATCHES = [0, 1, 2, 3].map((k) => ({ cx: GX + E, cz: BOUNDS.z0 + E * (2 * k + 1), E, res: 2048 }));
// Oceanside's downtown and Carlsbad Village get the sharper textures
for (const P of PATCHES) for (const z of [PLACES.transit.z, 0]) if (Math.abs(P.cz - z) < P.E) P.res = 3072;

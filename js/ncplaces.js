// NORTH COUNTY: three real Carlsbad places, modelled from the owner's photos and placed from OpenStreetMap: each
// footprint below is the OSM outline (or the geocoded address) run through the map's own projection
// (tools/northcounty: the coast-aligned frame, 5.5 m a unit, x squeezed x0.4 past 700 m inland), so they sit where
// they are among the real streets.
//   Pine Avenue Community Park   Pine Ave / Madison St / Harding St / Chestnut Ave (33.1566, -117.3424): the
//                                Community Center (the white frame, the terracotta tile wall, the balcony), the
//                                Senior Center, Brierly Field, the community gardens and their pergolas, the lawn and
//                                basketball court, Chase Field's two diamonds across Chestnut, the curved park sign
//   3840 Hibiscus Circle         (33.15106, -117.34102, the owner's pin): a white two-storey tract house, dark grey
//                                roof, two-car garage, red double doors, on the curve of Hibiscus Circle with Nautical
//                                Drive's loop behind and the school field at its back fence
//   El Camino Grove              the Lime Grove Apartments, 1050-1060 Chinquapin Ave (33.1510, -117.3335): long
//                                two-storey tan blocks with terracotta mansard trim, outside walkways and stairs,
//                                courtyards, its parking, the shopping center on Tamarack behind it and I-5 beside it
// places() lays out the ground and the buildings (from js/northcounty.js, before the filler); placeDetails() adds what
// hangs on them and the park's furniture (from js/ncworld.js). Everything breaks: the buildings with the usual cells,
// their trim cut out with them, the free-standing pieces (goals, backstops, pergolas, the sign) knocked flat by blasts.
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { hsl } from './maps.js';
import { tint, box, cyl, canvasTex, cutoutOn, hipRoof } from './mapkit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- where they are (game units, from OSM) ----------
export const PINE = {
  park: { x0: 91, x1: 128.8, z0: 57.8, z1: 103.6 },          // between Madison, Harding, Pine Ave and Chestnut
  center: { x0: 121.4, x1: 128.6, z0: 58.4, z1: 65.6 },       // Pine Avenue Community Center (3333 Harding St)
  senior: { x0: 108.6, x1: 120.4, z0: 58.4, z1: 69.3 },       // Carlsbad Senior Center (OSM footprint)
  lot: { x0: 100.4, x1: 108, z0: 58.6, z1: 80.5 },            // the lot off Pine Ave (OSM service loop)
  forecourt: { x0: 121.4, x1: 128.6, z0: 66.2, z1: 71.2 },
  lawn: { x0: 108.6, x1: 128.6, z0: 70, z1: 86.4 },
  court: { x0: 109.6, x1: 113.6, z0: 81.6, z1: 85.6 },        // OSM basketball pitch
  gardens: { x0: 91.8, x1: 102.8, z0: 83, z1: 101.6 },        // the community gardens (OSM garden, out to Madison's walk)
  field: { x0: 104, x1: 128.6, z0: 87.4, z1: 103.4 },         // Brierly Field
  chase: { x0: 116.6, x1: 128.6, z0: 110.6, z1: 131.6 },      // Chase Field, across Chestnut
  sign: { x: 94.2, z: 102.2 },                                // the park sign at Madison and Chestnut
};
export const HIB = {
  house: { x: 59.7, z: 215.5 },                               // 3840 Hibiscus Circle (the owner's Apple Maps pin)
  street: [[56.7, 234.4], [56.8, 231.9], [57.0, 227.5], [56.7, 225.2], [55.8, 223.2], [54.8, 220.7], [54.5, 217.6], [55.6, 199.3], [55.3, 192.2], [55.5, 190.8]],
  nautical: [[55.5, 190.8], [46.5, 190.4], [45.2, 191.5], [45.3, 205.4], [44.8, 212.5], [44.7, 218.2], [45.4, 222.4], [52.6, 223.3], [55.8, 223.2]],
  nautical2: [[45.4, 222.4], [44.9, 229.6]],
  field: { x0: 63.6, x1: 74.6, z0: 196.2, z1: 213.6 },        // the school field behind the house
  school: [[70.5, 73.5, 215.1, 218.2], [78, 80.9, 216, 219], [72.7, 78.4, 218.1, 221.3], [85.5, 90.8, 210.3, 215.7], [84.4, 89.7, 204.9, 210.2], [86.9, 93.7, 200, 205.1], [88, 99.7, 213, 222.1], [76.2, 85.4, 199.3, 203.9], [77.5, 83, 222.9, 227.1]],
  // Nautical Drive's west side (OSM footprints)
  west: [[40.1, 42.9, 210.2, 212.6], [40, 42.8, 212.8, 215.2], [40, 42.8, 215.5, 217.9], [40.1, 42.9, 218.2, 220.6], [40.4, 43.2, 220.8, 223.3], [40.5, 43.3, 223.5, 226], [40.5, 43.2, 226.1, 228.6], [40.5, 43.1, 191.6, 193.9], [40.5, 43.1, 199.6, 201.9], [40.5, 43.2, 202.2, 204.6], [40.5, 43.1, 194.6, 197], [40.5, 43.1, 197.2, 199.4], [40.5, 43.1, 205, 207.4], [40.5, 43.1, 207.6, 209.9]],
};
export const GROVE = {
  site: { x0: 141.8, x1: 160.8, z0: 268.8, z1: 286.2 },
  long: [{ x0: 146.0, x1: 148.2, z0: 269.6, z1: 284.4, walk: 1 }, { x0: 158.4, x1: 160.6, z0: 269.6, z1: 284.4, walk: -1 }],
  blocks: [[150.2, 152.4, 269.6, 272.6], [154.0, 156.2, 269.6, 272.6], [150.2, 152.4, 274.4, 277.4], [154.0, 156.2, 274.4, 277.4], [150.2, 152.4, 279.2, 282.2], [154.0, 156.2, 279.2, 282.2]],
  lot: { x0: 141.8, x1: 145.6, z0: 272, z1: 284.4 },
  sign: { x: 149.2, z: 285.5 },
  // the shopping center on Tamarack (OSM footprints): the drugstore, the shops between, the supermarket; its lot
  shops: [{ x0: 149, x1: 158, z0: 258, z1: 266, name: 'DRUG STORE' }, { x0: 158.2, x1: 163.6, z0: 258.4, z1: 263.4, name: 'LAUNDRY · NAILS' }, { x0: 163.8, x1: 171.6, z0: 259.4, z1: 267.8, name: 'FRESH MARKET' }],
  plaza: { x0: 147.4, x1: 172.4, z0: 249.6, z1: 257.6 },
};

const STUCCO_TAN = hsl(0.1, 0.36, 0.62), TILE = 0xb85a36, CREAM = hsl(0.11, 0.25, 0.9);

// ================= the ground and the buildings =================
export function places(ctx) {
  const N = ctx.city.nc;
  N.places = {};
  pinePark(ctx, N.places);
  hibiscus(ctx, N.places);
  grove(ctx, N.places);
  const name = (S, R) => ctx.city.named.push({ S, o: S, x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 });
  name('Pine Avenue Park', { x0: 91, x1: 129, z0: 57, z1: 132 });
  name('Hibiscus Circle', { x0: 40, x1: 63, z0: 190, z1: 231 });
  name('El Camino Grove', GROVE.site);
}

const rectOf = (R, pad = 0) => [R.x0 - pad, R.z0 - pad, R.x1 + pad, R.z1 + pad];
const walk = '#d9d2c3', turf = '#4b8a3c', lawn = '#6f8f45', mulch = '#7b5a3e', clay = '#b9875a';

function pinePark({ city, g, B, mark }, out) {
  const P = PINE, R = (r, c) => g.rect(...rectOf(r), c);
  mark(...rectOf(P.park)); mark(...rectOf(P.chase));
  // the whole block: lawn, a concrete walk round it and through it
  city.paintGrass(g, ...rectOf(P.park), '#6c8a44');
  for (const [a, b, c, d] of [[P.park.x0, P.park.z0, P.park.x0 + 1.1, P.park.z1], [P.park.x0, P.park.z1 - 1.1, P.park.x1, P.park.z1], [P.park.x1 - 1.1, 70, P.park.x1, P.park.z1], [100.4, 81, 108.2, 82.2], [103, 82.2, 104.2, 104]]) g.rect(a, b, c, d, walk);
  // the broad diagonal walk in from the corner of Madison and Chestnut, past the gardens to the field (the aerial's white path)
  g.stroke([[92, 103], [97, 99.5], [100.5, 95], [103, 91]], 1.6, walk);
  // the lot off Pine Ave and the forecourt of the Community Center
  for (const sp of city.paintParking(g, ...rectOf(P.lot))) if (Math.random() < 0.7) city.parked.push(sp);
  R(P.forecourt, '#bdb6a8'); g.grainRect(...rectOf(P.forecourt), 0.2, 30);
  for (let x = P.forecourt.x0 + 0.6; x < P.forecourt.x1; x += 1.2) g.rect(x, P.forecourt.z1 - 0.15, x + 0.6, P.forecourt.z1, '#3f4044');   // the dark tactile strip along the curb
  // the lawn north of the field, the basketball court on it
  city.paintGrass(g, ...rectOf(P.lawn), lawn);
  R(P.court, '#3f6f8a'); g.rect(P.court.x0 + 0.3, P.court.z0 + 0.3, P.court.x1 - 0.3, P.court.z1 - 0.3, '#4f86a3');
  for (const z of [P.court.z0 + 0.3, P.court.z1 - 0.3, (P.court.z0 + P.court.z1) / 2]) g.line(P.court.x0 + 0.3, z, P.court.x1 - 0.3, z, 0.05, 'rgba(255,255,255,.85)');
  // Brierly Field: artificial turf, white lines, the run-off round it
  const F = P.field; R(F, '#5d7f46'); g.rect(F.x0 + 0.6, F.z0 + 0.6, F.x1 - 0.6, F.z1 - 0.6, turf);
  for (let x = F.x0 + 0.6; x < F.x1 - 0.6; x += 2.2) g.rect(x, F.z0 + 0.6, x + 1.1, F.z1 - 0.6, 'rgba(255,255,255,.035)');   // mowing stripes
  const fl = (a, b, c, d) => g.line(a, b, c, d, 0.07, 'rgba(255,255,255,.9)');
  const fx0 = F.x0 + 1.1, fx1 = F.x1 - 1.1, fz0 = F.z0 + 1.1, fz1 = F.z1 - 1.1, fcx = (fx0 + fx1) / 2, fcz = (fz0 + fz1) / 2;
  fl(fx0, fz0, fx1, fz0); fl(fx0, fz1, fx1, fz1); fl(fx0, fz0, fx0, fz1); fl(fx1, fz0, fx1, fz1); fl(fcx, fz0, fcx, fz1);
  for (let a = 0; a < 6.283; a += 0.2) fl(fcx + Math.cos(a) * 2, fcz + Math.sin(a) * 2, fcx + Math.cos(a + 0.2) * 2, fcz + Math.sin(a + 0.2) * 2);
  for (const s of [-1, 1]) { const gx = s < 0 ? fx0 : fx1; fl(gx, fcz - 3.4, gx - s * 2.6, fcz - 3.4); fl(gx - s * 2.6, fcz - 3.4, gx - s * 2.6, fcz + 3.4); fl(gx - s * 2.6, fcz + 3.4, gx, fcz + 3.4); }
  city.wanderZones.push({ x0: F.x0 + 1.5, x1: F.x1 - 1.5, z0: F.z0 + 1.5, z1: F.z1 - 1.5 });
  city.crowds.push({ x: fcx, z: fcz, r: 4, n: 10 });
  // the community gardens: raised beds in rows, mulch paths, the two pergolas' slabs
  const Gd = P.gardens; R(Gd, mulch); g.grainRect(...rectOf(Gd), 0.3, 40);
  for (let z = Gd.z0 + 0.6; z < Gd.z1 - 1; z += 1.5) for (let x = Gd.x0 + 0.6; x < Gd.x1 - 1.2; x += 2.0) {
    if (Math.hypot(x - 97, z - 97) < 2.2) continue;                         // room for the diagonal walk
    g.rect(x, z, x + 1.5, z + 0.8, '#8b6a48'); g.rect(x + 0.1, z + 0.1, x + 1.4, z + 0.7, '#5b4632');
    for (let k = 0; k < 5; k++) g.circle(x + rand(0.25, 1.25), z + rand(0.2, 0.6), rand(0.1, 0.22), pick(['#6aa640', '#4f8a35', '#9fbf4a', '#c9a94a', '#a8473a']));
  }
  // the lawn with its pergola at the corner, by the sign (the aerial's square of grass and its steps)
  city.paintGrass(g, 92.6, 96.4, 99, 101.2, '#7da04e');
  // trees: the olive trees by the sign, a row along Pine Ave, Madison and Chestnut, the big ones by the gardens
  for (let x = P.park.x0 + 2; x < 100; x += 4) city.addTree(x, P.park.z0 + 1.6, rand(1, 1.3), 'round');
  for (let z = 72; z < 100; z += 5) city.addTree(P.park.x0 + 0.6, z, rand(1.1, 1.5), 'round');
  for (let x = 108; x < 128; x += 5) city.addTree(x, P.park.z1 - 0.3, rand(0.9, 1.2), 'round');
  for (const [x, z] of [[93.4, 100.8], [96.2, 102.6], [95, 99], [103.3, 86.2], [117.2, 76.2], [127.4, 82.4], [123.2, 84.2]]) city.addTree(x, z, rand(1.1, 1.5), 'round');
  for (const [x, z] of [[107.6, 68.4], [120.6, 70.6]]) city.addTree(x, z, 1, "palm");
  city.wanderZones.push({ x0: P.lawn.x0 + 1, x1: P.lawn.x1 - 1, z0: P.lawn.z0 + 1, z1: P.lawn.z1 - 1 }, { x0: Gd.x0 + 0.5, x1: Gd.x1 - 0.5, z0: Gd.z0 + 0.5, z1: Gd.z1 - 0.5 });
  city.crowds.push({ x: 111.6, z: 83.6, r: 1.2, n: 5 }, { x: 97, z: 92, r: 2, n: 4 }, { x: 125, z: 69, r: 1.4, n: 4 });

  // Chase Field: two diamonds back to back, home plates in the far corners
  const C = P.chase; city.paintGrass(g, ...rectOf(C), '#5f8a3e');
  for (let z = C.z0 + 0.4; z < C.z1; z += 2) g.rect(C.x0 + 0.4, z, C.x1 - 0.4, z + 1, 'rgba(255,255,255,.04)');
  const diamond = (hx, hz, dx, dz) => {                // home plate at (hx, hz), looking out along (dx, dz)
    const n = Math.hypot(dx, dz), ux = dx / n, uz = dz / n, vx = -uz, vz = ux, at = (a, b) => [hx + ux * a + vx * b, hz + uz * a + vz * b];
    const arc = []; for (let t = -0.85; t <= 0.85; t += 0.1) arc.push(at(Math.cos(t) * 7.6, Math.sin(t) * 7.6));
    g.poly([at(0, 0), ...arc], clay);                                                           // the skinned infield
    g.poly([at(0, 0), ...arc.map(([x, z]) => [hx + (x - hx) * 0.62, hz + (z - hz) * 0.62])], '#5f8a3e');   // the grass inside the bases
    const b1 = at(3.2, -3.2), b2 = at(6.4, 0), b3 = at(3.2, 3.2), h = at(0, 0);
    for (const [a, b] of [[h, b1], [b1, b2], [b2, b3], [b3, h]]) g.line(a[0], a[1], b[0], b[1], 0.35, clay);
    for (const [a, b] of [[h, at(14, -14)], [h, at(14, 14)]]) g.line(a[0], a[1], b[0], b[1], 0.06, 'rgba(255,255,255,.85)');
    g.circle(...at(3.2, 0), 0.6, clay); g.circle(...at(3.2, 0), 0.12, '#f4f1ea');
    for (const p of [b1, b2, b3]) g.rect(p[0] - 0.15, p[1] - 0.15, p[0] + 0.15, p[1] + 0.15, '#f4f1ea');
    g.circle(h[0], h[1], 0.9, clay);
    return { h, ux, uz };
  };
  out.diamonds = [diamond(C.x0 + 1.4, C.z1 - 1.4, 1, -1), diamond(C.x1 - 1.4, C.z0 + 1.4, -1, 1)];
  city.crowds.push({ x: (C.x0 + C.x1) / 2, z: (C.z0 + C.z1) / 2, r: 4, n: 8 });

  // ---------- the buildings ----------
  // the Community Center: two storeys, white, its front on the forecourt (the tile wall and the frame are trim)
  const c = P.center;
  out.center = B.add({ x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, w: c.x1 - c.x0, d: c.z1 - c.z0, floors: 2, style: 'stucco', tint: hsl(0.1, 0.05, 0.95), cell: 1.8, gh: 1.5, fh: 1.3, storefront: false }); out.center.bareRoof = true;
  out.center.noSigns = true; out.center.landmark = true; out.center.name = 'Pine Avenue Community Center';
  // the Senior Center: a single storey round a courtyard, tile roofs
  const s = P.senior;
  out.senior = [
    B.add({ x: (s.x0 + s.x1) / 2, z: s.z0 + 1.8, w: s.x1 - s.x0, d: 3.6, floors: 1, style: 'stucco', tint: CREAM, cell: 1.6, gh: 1.4, storefront: false }),
    B.add({ x: s.x0 + 1.7, z: (s.z0 + 3.6 + s.z1) / 2, w: 3.4, d: s.z1 - s.z0 - 3.6, floors: 1, style: 'stucco', tint: CREAM, cell: 1.6, gh: 1.4, storefront: false }),
    B.add({ x: s.x1 - 1.7, z: (s.z0 + 3.6 + s.z1) / 2, w: 3.4, d: s.z1 - s.z0 - 3.6, floors: 1, style: 'stucco', tint: CREAM, cell: 1.6, gh: 1.4, storefront: false }),
  ];
  for (const b of out.senior) { b.noSigns = true; b.name = 'Carlsbad Senior Center'; }
  g.rect(s.x0 + 3.4, s.z0 + 3.6, s.x1 - 3.4, s.z1, '#cfc6b2'); city.addTree((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2 + 2, 1, 'palm');
}

// ---------- Hibiscus Circle ----------
function hibiscus({ city, g, B, mark, markLine }, out) {
  const H = HIB;
  // Hibiscus Circle and Nautical Drive, from the OSM centre lines: sidewalk, asphalt
  for (const pts of [H.street, H.nautical, H.nautical2]) { g.stroke(pts, 3.4 + 2, '#b9b3a6'); markLine(pts, 2.7); }
  for (const pts of [H.street, H.nautical, H.nautical2]) g.stroke(pts, 3.4, '#505052');
  // the school field behind the houses, the backstop's skinned corner, the playground; the school's buildings
  const F = H.field; city.paintGrass(g, ...rectOf(F), '#6f9447'); mark(...rectOf(F));
  g.poly([[F.x1 - 0.5, F.z0 + 0.5], [F.x1 - 7, F.z0 + 0.5], [F.x1 - 6.2, F.z0 + 3.8], [F.x1 - 3.8, F.z0 + 6.2], [F.x1 - 0.5, F.z0 + 7]], clay);
  g.rect(75, 208, 78.2, 211.8, '#c9b089'); mark(74.6, 196, 100, 228);
  for (const [x0, x1, z0, z1] of H.school) { const b = B.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, floors: 1, style: 'stucco', tint: hsl(0.1, 0.22, 0.8), cell: 1.7, gh: 1.25, storefront: false }); b.noSigns = true; b.name = 'the school'; }
  g.rect(76, 204.2, 84, 208, '#9a9890'); for (const x of [78, 82]) g.line(x, 204.4, x, 207.8, 0.05, 'rgba(255,255,255,.8)');
  city.crowds.push({ x: 69, z: 205, r: 3, n: 6 });
  // the houses: 1970s two-storey tract homes, stucco in whites and creams, dark grey roofs, two-car garages
  out.houses = [];
  const house = (x0, x1, z0, z1, face, o = {}) => {
    const b = B.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, floors: o.floors ?? (Math.random() < 0.75 ? 2 : 1), style: 'house', storefront: false, tint: o.tint || pick([hsl(0.1, 0.06, 0.95), hsl(0.11, 0.15, 0.9), hsl(0.12, 0.12, 0.86), hsl(0.55, 0.05, 0.88), hsl(0.09, 0.2, 0.82)]), cell: 1.4, gh: 1.1, fh: 0.95 });
    b.noSigns = true; b.face = face; b.hero = !!o.hero; mark(x0 - 0.1, z0 - 0.1, x1 + 0.1, z1 + 0.1); out.houses.push(b);
    // its front: lawn and a driveway to the street
    const [fx, fz] = face, front = o.front ?? 1.3, gx = fx ? (fx < 0 ? x0 : x1) : 0, gz = fz ? (fz < 0 ? z0 : z1) : 0;
    if (fx) { g.rect(Math.min(gx, gx + fx * front), z0, Math.max(gx, gx + fx * front), z1, '#76924a'); const gz0 = z1 - 1.6; g.rect(Math.min(gx, gx + fx * front), gz0, Math.max(gx, gx + fx * front), z1 - 0.2, '#c2bbad'); mark(Math.min(gx, gx + fx * front), z0, Math.max(gx, gx + fx * front), z1); }
    else { g.rect(x0, Math.min(gz, gz + fz * front), x1, Math.max(gz, gz + fz * front), '#76924a'); g.rect(x1 - 1.6, Math.min(gz, gz + fz * front), x1 - 0.2, Math.max(gz, gz + fz * front), '#c2bbad'); }
    return b;
  };
  // 3840: on the outside of the curve, its back to the school field
  const hx = H.house.x, hz = H.house.z;
  out.hero = house(hx - 1.4, hx + 1.4, hz - 1.7, hz + 1.7, [-1, 0], { floors: 2, tint: hsl(0.1, 0.03, 0.97), hero: true, front: 1.5 });
  g.rect(hx + 1.4, hz - 1.7, 63.4, hz + 1.7, '#6f8a45');                           // its back yard, to the field fence
  // its neighbours down the same side
  for (const z of [196.4, 200.3, 204.2, 208.1, 212.0, 219.2, 223.6, 227.6]) { const sx = streetX(H.street, z) + 2.8; house(sx, sx + 2.6, z - 1.6, z + 1.6, [-1, 0]); g.rect(sx + 2.6, z - 1.6, 63.4, z + 1.6, '#708b46'); }
  // between Hibiscus and Nautical: back to back, one row facing each street
  for (let z = 194.2; z < 221; z += 3.6) {
    const ex = streetX(H.street, z) - 2.8, wx = 45 + 2.8;
    house(ex - 2.3, ex, z - 1.5, z + 1.5, [1, 0], { front: 1.0 });
    if (ex - 2.3 - (wx + 2.1) > 0.1) house(wx, wx + 2.1, z - 1.5, z + 1.5, [-1, 0], { front: 1.0 });
  }
  // Nautical Drive's west side: the OSM footprints, facing the street
  for (const [x0, x1, z0, z1] of H.west) house(x0, x1, z0, z1, [1, 0], { front: 1.0 });
  // street trees (the aerial's big canopy trees between the houses)
  for (const z of [198.4, 206.2, 214, 221.4, 225.6]) city.addTree(streetX(H.street, z) + 2.4, z, rand(1, 1.3), 'round');
  for (const z of [196, 203, 211, 218]) city.addTree(45 + 2.2, z, rand(0.9, 1.2), 'round');
  city.addTree(hx - 1.6, hz - 3.5, 1.2, 'round'); city.addTree(hx - 1.4, hz + 3.0, 1.25, 'round');   // the two at 3840's corners
  city.crowds.push({ x: hx - 2.6, z: hz, r: 0.5, n: 2 });
}
function streetX(pts, z) { for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = pts[k], [c, d] = pts[k + 1]; if ((b - z) * (d - z) <= 0 && b !== d) return a + (c - a) * (z - b) / (d - b); } return pts[0][0]; }

// ---------- El Camino Grove ----------
function grove({ city, g, B, mark }, out) {
  const E = GROVE;
  mark(...rectOf(E.site));
  // the grounds: lawn courtyards, curved walks, the hedges along them
  city.paintGrass(g, ...rectOf(E.site), '#6d9045');
  for (const sp of city.paintParking(g, ...rectOf(E.lot))) if (Math.random() < 0.8) city.parked.push(sp);
  g.rect(E.lot.x1, E.lot.z0, E.lot.x1 + 0.4, E.lot.z1, '#9c968a');
  for (const x of [149.3, 153.2, 157.1]) g.stroke([[x, 269.8], [x + 0.6, 273.5], [x - 0.5, 278], [x + 0.4, 282], [x, 285.6]], 0.7, walk);
  for (const z of [273.5, 278.3, 282.8]) g.stroke([[148.4, z], [151, z + 0.5], [153.2, z - 0.3], [156, z + 0.4], [158.2, z]], 0.6, walk);
  g.rect(152.6, 282.4, 153.8, 286.6, '#55565a');                       // the drive in from Chinquapin
  for (let k = 0; k < 120; k++) { const x = rand(148.6, 158), z = rand(269.8, 285); g.circle(x, z, rand(0.18, 0.35), pick(['#3f6a2e', '#4d7a34', '#5a8a3a'])); }
  g.rect(141.8, 284.8, 160.8, 286.2, '#76924a');                         // the strip of lawn along Chinquapin
  // the buildings: long two-storey blocks either side, the shorter ones round the courtyards between
  out.grove = [];
  const add = (x0, x1, z0, z1, walkSide) => { const b = B.add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, floors: 2, style: 'stucco', tint: STUCCO_TAN, cell: 1.5, gh: 1.25, fh: 1.05, storefront: false }); b.bareRoof = true; b.noSigns = true; b.name = 'El Camino Grove'; b.walk = walkSide; out.grove.push(b); return b; };
  for (const L of E.long) add(L.x0, L.x1, L.z0, L.z1, L.walk);
  E.blocks.forEach(([x0, x1, z0, z1], i) => add(x0, x1, z0, z1, i % 2 ? -1 : 1));
  for (const [x, z] of [[149.4, 271], [157.2, 276], [153.2, 273.4], [149.4, 280.6], [157.2, 284.4], [153.2, 278.2]]) city.addTree(x, z, rand(0.8, 1.05), 'round');
  for (const [x, z] of [[143.6, 286.2], [151, 286.3], [156, 286.3], [159.6, 286.3]]) city.addTree(x, z, 0.9, 'palm');
  city.crowds.push({ x: 153.2, z: 276, r: 1.5, n: 4 }, { x: 149.4, z: 286.4, r: 0.8, n: 2 });
  // the shopping center behind it on Tamarack: a supermarket, a drugstore, the shops between, the lot in front
  mark(...rectOf(E.plaza)); for (const sp of city.paintParking(g, ...rectOf(E.plaza))) if (Math.random() < 0.65) city.parked.push(sp);
  g.rect(E.plaza.x0, E.plaza.z1, E.plaza.x1, E.plaza.z1 + 0.6, '#c4bdae');
  out.shops = E.shops.map((S) => { mark(S.x0 - 0.2, S.z0 - 0.2, S.x1 + 0.2, S.z1 + 0.2); const b = B.add({ x: (S.x0 + S.x1) / 2, z: (S.z0 + S.z1) / 2, w: S.x1 - S.x0, d: S.z1 - S.z0, floors: 1, style: 'stucco', tint: hsl(0.1, 0.14, 0.88), cell: 2.2, gh: 1.9, storefront: true }); b.noSigns = true; b.bareRoof = true; b.name = 'the shopping center'; return { ...S, b }; });
  g.rect(147.4, 266.4, 172.4, 268.6, '#55565a');                         // the service lane behind the shops
  city.crowds.push({ x: 160, z: 257, r: 2, n: 6 });
}

// ================= what hangs on them, and the park's furniture =================
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });
function textTex(lines, o = {}) {
  const w = o.w || 512, h = o.h || 128;
  return canvasTex(w, h, (x, W, H) => {
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, W, H); } else x.clearRect(0, 0, W, H);
    x.fillStyle = o.fg || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((t, i) => { x.font = o.font || '700 44px Inter, Arial'; x.fillText(t, W / 2, H * (i + 0.5) / lines.length + 2, W - 20); });
  });
}
function textPlane(scene, tex, w, h, x, y, z, ry, transparent = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: 0.5, alphaTest: transparent ? 0.1 : 0 }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}
// a facade: put(u, y, w, h, depth, color, off) places a box on the face of building b that looks along (fx, fz), off
// out from it;
// u runs to the right as you look at it from outside
function facade(b, fx, fz) {
  const ox = b.x + fx * b.w / 2, oz = b.z + fz * b.d / 2, rx = fz, rz = -fx;
  return (u, y, w, h, depth, color, off = 0) => (fx ? box(depth, h, w, ox + fx * (off + depth / 2) + rx * u, y, oz + rz * u, color) : box(w, h, depth, ox + rx * u, y, oz + fz * (off + depth / 2) + rz * u, color));
}
const topY = (b) => b.cells.reduce((m, c) => Math.max(m, c.y + c.hy), 0);

export class Places {
  constructor(scene, N) {
    this.scene = scene; this.loose = [];
    const P = N.places; if (!P) return;
    this.pine(scene, P);
    this.homes(scene, P);
    this.grove(scene, P);
  }

  // a free-standing piece of furniture: knocked flat by a blast
  piece(geos, x, z, r) {
    const m = new THREE.Mesh(mergeAll(geos), vc());
    m.geometry.translate(-x, 0, -z); m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    this.loose.push({ m, x, z, r, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) });
    return m;
  }

  pine(scene, P) {
    const Pi = PINE, geo = [];
    // ---- the Community Center's front: the white frame, the balcony, the terracotta tile wall, the glass, the name
    const C = P.center, put = facade(C, 0, 1), top = topY(C);
    geo.push(put(1.35, top / 2, 4.6, top, 0.07, 0xb7644a));                                                 // the tile wall (right of the entrance)
    const r = Math.random; for (let k = 0; k < 46; k++) { const u = -0.9 + r() * 4.5, y = 0.2 + r() * (top - 0.4); if (y > 1.25 && y < 1.75 || y < 1.15 && u > 0.1 && u < 2.9) continue; geo.push(put(u, y, pick([0.32, 0.48, 0.64]), 0.13, 0.1, 0x3b302c)); }
    // the solar panels on the roof (the aerial's dark rows)
    for (let z = C.z - C.d / 2 + 0.7; z < C.z + C.d / 2 - 0.9; z += 1.0) for (let x = C.x - C.w / 2 + 0.7; x < C.x + C.w / 2 - 0.6; x += 1.25) geo.push(tint(new THREE.BoxGeometry(1.1, 0.05, 0.7).rotateX(-0.3).translate(x, top + 0.22, z), 0x1d2a4a));
    geo.push(put(-2.4, 0.62, 1.7, 1.15, 0.05, 0x1b2a33), put(-2.4, 1.2, 1.8, 0.06, 0.08, 0xd9d4c8));        // the entrance's glass
    geo.push(put(-2.0, 2.1, 2.4, 0.7, 0.05, 0x22333d), put(2.6, 2.15, 1.0, 0.9, 0.1, 0x22333d));             // upstairs glass
    geo.push(put(-3.42, (top + 0.3) / 2, 0.36, top + 0.3, 1.7, 0xf4f2ec));                                 // the frame's pillar
    geo.push(put(-0.2, top + 0.12, 6.9, 0.32, 1.7, 0xf4f2ec));                                              // its top beam, over the balcony
    geo.push(put(-0.4, 1.5, 6.2, 0.12, 1.25, 0xb9b5ad));                                                    // the balcony slab
    for (let u = -3.4; u <= 2.8; u += 0.3) geo.push(put(u, 1.78, 0.035, 0.46, 0.04, 0x8b7f75, 1.18));          // its railing, along the slab's edge
    geo.push(put(-0.3, 2.02, 6.3, 0.05, 0.06, 0x8b7f75, 1.17));
    cutoutOn(scene, C, geo, vc({ roughness: 0.55 }));
    const name = textPlane(scene, textTex(['PINE AVENUE', 'COMMUNITY CENTER'], { w: 512, h: 160, fg: '#d9dde0', font: '700 50px Inter, Arial' }), 2.5, 0.72, C.x + 1.5, 0.72, C.z + C.d / 2 + 0.12, 0);
    name.material.emissive = new THREE.Color(0); hang(C, name);
    // the bollards along the forecourt
    for (let k = 0; k < 7; k++) this.piece([cyl(0.12, 0.12, 0.5, 0, 0.25, 0, 0xe2d8c0, 8), cyl(0.12, 0.12, 0.02, 0, 0.5, 0, 0xe2d8c0, 8)], Pi.forecourt.x0 + 0.7 + k * 1.1, Pi.forecourt.z1 - 0.5, 0.4);
    // ---- the Senior Center's tile roofs
    const rg = []; for (const b of P.senior) { const r1 = hipRoof(b.w + 0.4, b.d + 0.4, 0.9); r1.translate(b.x, topY(b), b.z); rg.push(tint(r1, TILE)); }
    cutoutOn(scene, P.senior, rg, vc({ roughness: 0.8 }));
    // ---- the field: goals, the fence round it
    const F = Pi.field, fcz = (F.z0 + F.z1) / 2;
    for (const s of [-1, 1]) {
      const gx = s < 0 ? F.x0 + 1.1 : F.x1 - 1.1, w = 2.4, h = 0.8;
      this.piece([box(0.08, h, 0.08, 0, h / 2, -w / 2, 0xffffff), box(0.08, h, 0.08, 0, h / 2, w / 2, 0xffffff), box(0.08, 0.08, w, 0, h, 0, 0xffffff), box(0.6, 0.04, w, s * 0.3, 0.02, 0, 0xdddddd), box(0.04, h, w, s * 0.6, h / 2, 0, 0xcfcfcf)], gx, fcz, 1.6);
    }
    const fence = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), gs = [], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      gs.push(along ? box(L, 0.04, 0.04, 0, 0.9, 0, 0x5d6266) : box(0.04, 0.04, L, 0, 0.9, 0, 0x5d6266), along ? box(L, 0.86, 0.01, 0, 0.45, 0, 0x7d8388) : box(0.01, 0.86, L, 0, 0.45, 0, 0x7d8388));
      for (let t = 0; t <= L; t += 2.4) gs.push(along ? box(0.06, 0.92, 0.06, -L / 2 + t, 0.46, 0, 0x5d6266) : box(0.06, 0.92, 0.06, 0, 0.46, -L / 2 + t, 0x5d6266));
      const m = this.piece(gs, cx, cz, L / 2); m.material.transparent = true; m.material.opacity = 0.75; m.material.depthWrite = false; };
    fence(F.x0 + 0.3, F.z0 + 0.3, F.x1 - 0.3, F.z0 + 0.3); fence(F.x0 + 0.3, F.z1 - 0.3, F.x1 - 0.3, F.z1 - 0.3); fence(F.x0 + 0.3, F.z0 + 0.3, F.x0 + 0.3, F.z1 - 0.3); fence(F.x1 - 0.3, F.z0 + 0.3, F.x1 - 0.3, F.z1 - 0.3);
    // ---- the basketball hoops
    const Ct = Pi.court, ccx = (Ct.x0 + Ct.x1) / 2;
    for (const [z, s] of [[Ct.z0 + 0.15, 1], [Ct.z1 - 0.15, -1]]) this.piece([box(0.08, 1.4, 0.08, 0, 0.7, 0, 0x3d4247), box(0.7, 0.45, 0.05, 0, 1.4, s * 0.25, 0xf4f4f4), box(0.22, 0.02, 0.22, 0, 1.22, s * 0.42, 0xe0561f)], ccx, z, 0.6);
    // ---- the pergolas: in the gardens and on the corner lawn, dark posts and slatted tops
    const pergola = (x, z, w, d) => { const gs = []; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) gs.push(box(0.16, 1.5, 0.16, a * (w / 2 - 0.1), 0.75, b * (d / 2 - 0.1), 0x5a4a3c)); gs.push(box(w + 0.3, 0.12, 0.16, 0, 1.52, -d / 2 + 0.1, 0x4c3e32), box(w + 0.3, 0.12, 0.16, 0, 1.52, d / 2 - 0.1, 0x4c3e32)); for (let t = -w / 2; t <= w / 2; t += 0.32) gs.push(box(0.08, 0.08, d + 0.4, t, 1.64, 0, 0x6a5848)); gs.push(box(w, 0.06, d, 0, 0.03, 0, 0xc9c1b1)); this.piece(gs, x, z, Math.max(w, d) / 2 + 0.3); };
    pergola(96.2, 89.6, 2.6, 2.2); pergola(100.4, 96.2, 2.2, 2.2); pergola(95.4, 98.6, 2.4, 2);
    // ---- the backstops and dugouts at Chase Field
    for (const D of P.diamonds) {
      const gs = [], [hx, hz] = D.h, bx = -D.ux, bz = -D.uz;
      for (let a = -1.1; a <= 1.1; a += 0.22) { const ca = Math.cos(a), sa = Math.sin(a), dx = (bx * ca - bz * sa) * 2.2, dz = (bx * sa + bz * ca) * 2.2; gs.push(box(0.06, 1.7, 0.06, dx, 0.85, dz, 0x5d6266)); }
      for (const [a, b] of [[-1.1, 0], [0, 1.1]]) { const p = (t) => [(bx * Math.cos(t) - bz * Math.sin(t)) * 2.2, (bx * Math.sin(t) + bz * Math.cos(t)) * 2.2]; const [x0, z0] = p(a), [x1, z1] = p(b), L = Math.hypot(x1 - x0, z1 - z0); gs.push(tint(new THREE.BoxGeometry(L, 1.6, 0.02).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate((x0 + x1) / 2, 0.85, (z0 + z1) / 2), 0x7d8388)); }
      const m = this.piece(gs, hx, hz, 2.4); m.material.transparent = true; m.material.opacity = 0.8; m.material.depthWrite = false;
      for (const s of [-1, 1]) { const vx = -D.uz * s, vz = D.ux * s, x = hx + vx * 3.4 + D.ux * 1.2, z = hz + vz * 3.4 + D.uz * 1.2; this.piece([box(1.6, 0.06, 0.7, 0, 0.75, 0, 0x2f5f8a), box(1.6, 0.7, 0.06, 0, 0.35, -0.3, 0x8b8f93), box(1.4, 0.2, 0.3, 0, 0.2, 0, 0x6b5a4a)], x, z, 1); }
    }
    // ---- the park sign at the corner: a wave of tan concrete, a red-brown band, its grey footing, the bird of paradise
    const S = Pi.sign, W = 2.6, Hh = 1.0;
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(W, 0); shape.lineTo(W, Hh * 0.92);
    for (let t = 1; t >= 0; t -= 0.05) shape.lineTo(W * t, Hh * (0.72 + 0.2 * Math.sin(t * 5.2 + 0.9) * (0.6 + 0.4 * t)));
    shape.lineTo(0, 0);
    const sg = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false }); sg.translate(-W / 2, 0.15, -0.11);
    const tex = canvasTex(512, 200, (x, w, h) => {
      x.fillStyle = '#d8c39b'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#7a2e22'; x.beginPath(); x.moveTo(0, h * 0.86); for (let t = 0; t <= 1.001; t += 0.05) x.lineTo(w * t, h * (0.8 - 0.07 * Math.sin(t * 6.3))); for (let t = 1; t >= -0.001; t -= 0.05) x.lineTo(w * t, h * (0.88 - 0.07 * Math.sin(t * 6.3))); x.fill();
      x.fillStyle = '#4a3a30'; x.textAlign = 'left'; x.font = '700 40px Georgia, serif'; x.fillText('PINE AVENUE PARK', 34, h * 0.48);
      x.font = 'italic 30px Georgia, serif'; x.fillText('City of Carlsbad', 120, h * 0.66);
      // the bird of paradise
      const bx = w * 0.86, by = h * 0.42;
      x.fillStyle = '#e8892a'; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(bx, by); x.lineTo(bx - 18 + k * 9, by - 52 + k * 4); x.lineTo(bx - 6 + k * 9, by - 50 + k * 4); x.fill(); }
      x.fillStyle = '#3a6fb0'; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + 34, by - 6); x.lineTo(bx + 8, by + 4); x.fill();
      x.strokeStyle = '#3f7a3a'; x.lineWidth = 7; x.beginPath(); x.moveTo(bx - 34, by + 24); x.quadraticCurveTo(bx, by + 10, bx + 18, by - 2); x.stroke();
    });
    tex.repeat.set(1 / W, 1 / Hh); tex.offset.set(0, 0);                      // the face's UVs are the shape's own coordinates
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), side = new THREE.MeshStandardMaterial({ color: 0xd2bd94, roughness: 0.85 });
    const sign = new THREE.Mesh(sg, [face, side]); sign.castShadow = true;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.2, 0.5).translate(0, 0.1, 0), new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 }));
    const grp = new THREE.Group(); grp.add(sign, foot); grp.position.set(S.x, 0, S.z); grp.rotation.y = -0.5; scene.add(grp);
    this.loose.push({ m: grp, x: S.x, z: S.z, r: 1.4, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) });
    // a hedge of gold and green round its foot
    const hed = []; for (let k = 0; k < 9; k++) hed.push(tint(new THREE.SphereGeometry(rand(0.18, 0.26), 7, 5).scale(1, 0.45, 1).translate(S.x - 1.4 + k * 0.35, 0.08, S.z + 0.75 + rand(-0.1, 0.2)), pick([0xa9b94a, 0x7f9b3c, 0xc4c75a])));
    this.piece(hed, S.x, S.z + 0.5, 1.5);
  }

  homes(scene, P) {
    // every house: a dark grey hip roof, its garage door and front door on the street side, a strip of white trim
    const geo = [];
    for (const b of P.houses) {
      const [fx, fz] = b.face, put = facade(b, fx, fz), top = topY(b), wide = fx ? b.d : b.w;
      const r = hipRoof(b.w + 0.3, b.d + 0.3, b.hero ? 0.75 : 0.65); r.translate(b.x, top, b.z); geo.push(tint(r, b.hero ? 0x55595f : pick([0x4f5358, 0x5b5f64, 0x63666b, 0x6f6458])));
      const gw = Math.min(1.5, wide * 0.48);
      geo.push(put(wide / 2 - gw / 2 - 0.12, 0.42, gw, 0.84, 0.04, 0xf2f2ee));                                   // the garage door
      for (let y = 0.15; y < 0.84; y += 0.17) geo.push(put(wide / 2 - gw / 2 - 0.12, y, gw - 0.08, 0.015, 0.05, 0xc9c9c3));
      geo.push(put(-wide / 2 + 0.75, 0.4, b.hero ? 0.5 : 0.3, 0.72, 0.04, b.hero ? 0xb3341f : pick([0x6b4a32, 0x3b4450, 0x7a2f22, 0xe8e2d4])));   // the front door
      if (b.floors > 1) geo.push(put(0, 1.12, wide + 0.02, 0.05, 0.04, 0xe9e6de));
    }
    // 3840's own details: the porch roof over the doors, its brackets, the lamp, the window boxes, the mailbox, a palm
    const h = P.hero; if (h) {
      const put = facade(h, -1, 0);
      geo.push(put(-0.5, 1.02, 1.7, 0.06, 0.55, 0x4d5157), put(-0.5, 1.07, 1.7, 0.04, 0.45, 0x5b5f64));
      geo.push(put(-1.25, 0.86, 0.06, 0.24, 0.45, 0xe7e3d8), put(0.25, 0.86, 0.06, 0.24, 0.45, 0xe7e3d8));
      geo.push(put(-0.38, 0.41, 0.04, 0.73, 0.05, 0x2a1a14));                                                     // the line between the two red doors
      geo.push(put(0.12, 0.62, 0.07, 0.12, 0.07, 0x2d2d2d));                                                      // the coach lamp
      geo.push(put(-1.05, 0.48, 0.55, 0.4, 0.05, 0x24323c), put(-0.85, 1.55, 0.6, 0.42, 0.05, 0x24323c), put(0.95, 1.55, 0.6, 0.42, 0.05, 0x24323c));
      for (const u of [-1.6, -0.15, 0.55, 1.6]) geo.push(put(u, 1.0, 0.05, 1.95, 0.03, 0xe9e6de));               // the board-and-batten trim strips
    }
    cutoutOn(scene, P.houses, geo, vc({ roughness: 0.75 }));
    if (h) {
      this.piece([box(0.05, 0.55, 0.05, 0, 0.27, 0, 0x4b3b2e), box(0.22, 0.14, 0.12, 0, 0.6, 0, 0x2c2c2c)], h.x - h.w / 2 - 1.3, h.z - 1.2, 0.3);   // the mailbox
      this.piece([box(0.5, 0.06, 0.18, 0, 0.22, 0, 0x3a3f44), box(0.5, 0.2, 0.03, 0, 0.35, 0.08, 0x3a3f44)], h.x - h.w / 2 - 0.45, h.z - 0.95, 0.4);   // the bench by the door
    }
  }

  grove(scene, P) {
    // each block: the terracotta mansard round the top, the walkway along its courtyard side with white railings,
    // the stairs up to it, the brown doors along both floors
    const geo = [];
    for (const b of P.grove) {
      const top = topY(b), long = b.d > b.w, put = facade(b, long ? b.walk : 0, long ? 0 : b.walk), len = long ? b.d : b.w;
      // the mansard: four sloped bands of tile round the roof
      for (const [fx, fz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const L = fx ? b.d : b.w, g0 = new THREE.BoxGeometry(fx ? 0.06 : L + 0.5, 0.5, fx ? L + 0.5 : 0.06).rotateX(fz * 0.55).rotateZ(-fx * 0.55);
        g0.translate(b.x + fx * (b.w / 2 + 0.12), top - 0.12, b.z + fz * (b.d / 2 + 0.12)); geo.push(tint(g0, TILE));
      }
      geo.push(tint(new THREE.BoxGeometry(b.w + 0.05, 0.05, b.d + 0.05).translate(b.x, top - 0.42, b.z), 0x8a4b2c));
      // the walkway: a slab at the upper floor, posts, the railing
      const gh = 1.25;
      geo.push(put(0, gh, len - 0.2, 0.1, 0.62, 0xe8e2d4));
      for (let u = -len / 2 + 0.2; u <= len / 2 - 0.1; u += 1.1) geo.push(put(u, gh / 2, 0.08, gh, 0.08, 0xe8e2d4, 0.52), put(u, gh + 0.32, 0.05, 0.5, 0.05, 0xf4f2ec, 0.56));
      geo.push(put(0, gh + 0.56, len - 0.2, 0.05, 0.06, 0xf4f2ec, 0.56));
      for (let u = -len / 2 + 0.2; u <= len / 2 - 0.2; u += 0.24) geo.push(put(u, gh + 0.32, 0.025, 0.42, 0.03, 0xf4f2ec, 0.57));
      // the stairs at one end
      const su = len / 2 - 0.55;
      for (let k = 0; k < 6; k++) geo.push(put(su - k * 0.22, 0.12 + k * 0.2, 0.22, 0.06, 0.45, 0xd8d2c4, 0.64));          // the treads, outside the walkway
      // the doors along both floors
      for (let u = -len / 2 + 0.7; u < len / 2 - 0.9; u += 1.6) geo.push(put(u, 0.42, 0.34, 0.7, 0.03, 0x5a3f2c), put(u, gh + 0.4, 0.34, 0.7, 0.03, 0x5a3f2c));
    }
    cutoutOn(scene, P.grove, geo, vc({ roughness: 0.75 }));
    // the sign on Chinquapin: a wooden frame, the tree, the name
    const S = GROVE.sign, tex = canvasTex(512, 300, (x, w, h) => {
      x.fillStyle = '#efe6cf'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6b4a2e'; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14);
      x.fillStyle = '#5a3a24'; x.fillRect(w * 0.14, h * 0.5, 14, h * 0.32); x.fillStyle = '#4f8a35'; x.beginPath(); x.arc(w * 0.155, h * 0.42, 52, 0, 6.283); x.fill();
      x.fillStyle = '#2f2a24'; x.textAlign = 'center'; x.font = '700 58px Georgia, serif'; x.fillText('El Camino', w * 0.6, h * 0.36); x.fillText('Grove', w * 0.6, h * 0.6);
      x.font = '26px Georgia, serif'; x.fillText('1 & 2 Bedroom Apartment Homes', w * 0.6, h * 0.82);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); face.position.set(0, 0.85, 0.06);
    const posts = new THREE.Mesh(mergeAll([box(0.12, 1.3, 0.12, -0.82, 0.65, 0, 0x5a3a24), box(0.12, 1.3, 0.12, 0.82, 0.65, 0, 0x5a3a24), box(1.5, 0.88, 0.08, 0, 0.85, 0, 0x6b4a2e), box(0.7, 0.18, 0.06, 0, 1.4, 0, 0x6b4a2e)]), vc());
    const grp = new THREE.Group(); grp.add(face, posts); grp.position.set(S.x, 0, S.z); scene.add(grp);
    this.loose.push({ m: grp, x: S.x, z: S.z, r: 1, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) });
    // the shops' signs over their doors (facing the lot)
    for (const s of P.shops) {
      const t = textPlane(scene, textTex([s.name], { bg: '#f4f1ea', fg: s.name === 'FRESH MARKET' ? '#b3241e' : '#1f3f6f', w: 512, h: 96, font: '800 54px Inter, Arial' }), Math.min(4, (s.x1 - s.x0) * 0.6), 0.55, (s.x0 + s.x1) / 2, 1.45, s.z0 - 0.05, Math.PI, false);
      hang(s.b, t);
    }
  }

  // ---------- each frame: what's been knocked over falls ----------
  update(dt) {
    for (const L of this.loose) if (!L.alive && L.t < 1) { L.t = Math.min(1, L.t + dt * 2.4); const k = L.t * L.t; L.m.rotation.x = L.ax * 1.4 * k; L.m.rotation.z = L.az * 1.4 * k; L.m.position.y = -0.15 * k; }
  }
  onBlast(x, z, reach) {
    for (const L of this.loose) if (L.alive && Math.hypot(L.x - x, L.z - z) < reach + L.r) { L.alive = false; L.t = 0; G.fx && G.fx.dust && G.fx.dust(L.x, 0.4, L.z, 0.6); }
  }
}

// merge vertex-coloured pieces into one geometry (non-indexed)
function mergeAll(geos) { return mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))); }
// a sign hung on a building: it goes when the cell behind it goes
function hang(b, obj) {
  let best = null, bd = 1e9;
  for (const c of b.cells) { const d = Math.hypot(c.x - obj.position.x, c.y - obj.position.y, c.z - obj.position.z); if (d < bd) { bd = d; best = c; } }
  (best.props ||= []).push({ obj: [obj], x: best.x, y: best.y, z: best.z });
}

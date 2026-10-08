// LAS VEGAS: the Strip, in its real order. Las Vegas Boulevard runs north-south (north = -z) with its real cross
// streets (Russell, Mandalay Bay Rd/Hacienda, Tropicana, Harmon (east side only), Flamingo, Sands/Spring
// Mountain, Desert Inn), Frank Sinatra Dr behind the west side, Koval Lane and Paradise Rd behind the east side,
// I-15 further west. Distances are compressed to fit (about 1 unit = 3.5 m up, much less along the Strip), but
// every resort is on its own side of the street, in its real order, at its real corner:
//   west, south to north: Mandalay Bay | Luxor | Excalibur | Tropicana Ave | New York-New York | Park MGM | Aria |
//     Cosmopolitan | Bellagio (+ the lake and fountains) | Flamingo Rd | Caesars Palace | Treasure Island |
//     Spring Mountain Rd | Fashion Show | Resorts World
//   east: (Tropicana site, now the ballpark dig) | Tropicana Ave | MGM Grand | Showcase (M&M's, Coca-Cola) |
//     Harmon Ave | Planet Hollywood | Paris (+ Eiffel Tower) | Flamingo Rd | Flamingo | The LINQ | Harrah's |
//     Venetian | Palazzo | Sands Ave | Wynn | Encore; Sphere and the High Roller east of Koval
//   north on the skyline: Fontainebleau, the Sahara, the STRAT, downtown beyond
// Then scattered development, a Henderson-style tract neighbourhood to the south-east, open desert and the ring of
// mountains (Spring Mountains / Red Rock west, Frenchman and Sunrise east, the River and McCullough ranges south).
// The resorts are ordinary destructible buildings; their dressing hangs on their cells and falls with them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { policeHQ } from './maps.js';
import { hsl, tint, box, cyl, cone, sph, canvasTex, hipRoof, merged, netCtx, paintNetwork, widenFor, topOf, hangOn, rnd } from './mapkit.js';

const XS = [-80, 0, 54, 104], ZS = [-138, -86, -24, 16, 60, 102, 140];
const STRIP = 5.5;                       // half width of Las Vegas Boulevard (8 lanes and a median)
const W0 = -74.6, W1 = -8, E0 = 8, E1 = 48.6;   // west / east frontage lots between Sinatra, the Strip and Koval

// a resort building: destructible, kept clear of random shop signs, billboards and scaffolding
function R(B, o) {
  // towers: fewer, taller floors and bigger sections (same height, a third of the pieces to draw and break)
  if (o.floors > 12 && !o.exact) {
    const k = 0.8;
    o = { ...o, floors: Math.round(o.floors * k), fh: (o.fh || 1) / k, cell: Math.max(o.cell || 1.8, 2.15), setbacks: o.setbacks && o.setbacks.map((s) => ({ ...s, f: Math.round(s.f * k) })) };
  }
  const b = B.add({ cell: 1.8, gh: 1.6, fh: 1, storefront: false, ...o }); b.noSigns = true; b.landmark = true; return b;
}
// a curved slab as segments along an arc (Bellagio, Wynn, Encore, Aria): pts [[x, z], ...]
function arcSlab(B, pts, w, d, floors, style, tnt, o = {}) {
  // each segment as deep as the gap to its neighbours, so they meet without overlapping
  const gap = (i) => Math.min(i > 0 ? Math.abs(pts[i][1] - pts[i - 1][1]) : 1e9, i < pts.length - 1 ? Math.abs(pts[i + 1][1] - pts[i][1]) : 1e9) - 0.05;
  return pts.map(([x, z], i) => R(B, { x, z, w, d: Math.min(d, gap(i)), floors: Array.isArray(floors) ? floors[i] : floors, style, tint: tnt, cell: 1.7, ...o }));
}
// a pyramid made of floors stepping in (Luxor)
function pyramid(base, floors, cell) { const n = Math.floor(base / cell / 2) - 0.5; const s = []; for (let f = 1; f < floors; f++) s.push({ f, n: Math.round((f / floors) * n) }); return s; }

export function vegas(B) {
  const ctx = netCtx({
    xs: XS, zs: ZS, roadW: 6, sw: 2.4, half: 100, extent: 175, base: '#c9b490', centerLine: 'yellow', lights: true,
    // Harmon Avenue only runs east of the Strip; Frank Sinatra Drive stops at Sands / Spring Mountain
    skipEdge: (a, b) => (a.z === 16 && b.z === 16 && Math.min(a.x, b.x) < 0) || (a.x === -80 && b.x === -80 && Math.min(a.z, b.z) < -86),
  }, B);
  const { city, g } = ctx;
  city.mapKind = 'vegas';
  city.named = []; city.crowds = []; city.stationed = [];
  const V = (city.vegas = { resorts: {} });
  const name = (S, o, x0, x1, z0, z1) => city.named.push({ S, o, x0, x1, z0, z1 });
  // vehicles: yellow-and-black and white cabs, stretch limos, white tour coaches and the double-decker Deuce
  city.vehicles = { taxi: { p: 0.24, colors: [0xf2c230, 0xf2c230, 0xf4f4f0, 0x1c1c1e, 0xe8e0c8] }, limo: { p: 0.07, colors: [0xf4f4f2, 0x0e0e10, 0x0e0e10] },
    bus: { p: 0.07, kinds: [{ color: 0xf4f4f0 }, { color: 0xf4f4f0 }, { color: 0xb3141c, h: 2.5, len: 2.9 }] }, moto: 0.06 };
  city.palette = { shirts: [0xffffff, 0x0e0e10, 0xff8fa3, 0x4fc3f7, 0xfff176, 0xe8e4dc, 0xb3141c, 0x81c784, 0x1f2a44, 0xf28c28, 0xba68c8, 0x2b2d33], sleeves: 0.6 };

  // ---------- the ground: valley desert, the developed blocks, the Strip and its streets
  g.rect(-175, -175, 175, 175, '#c9b490');
  for (let i = 0; i < 2600; i++) g.circle(rand(-175, 175), rand(-175, 175), rand(0.15, 0.6), `rgba(${pick(['92,98,60', '120,110,80', '160,140,110'])},${rand(0.15, 0.4)})`);   // creosote and gravel
  // developed land: everything between I-15 and Paradise, Russell to Desert Inn
  g.rect(-120, -175, 175, 175, '#b8ab94'); g.grainRect(-120, -175, 175, 175, 0.2, 40);
  for (let i = 0; i < 900; i++) g.circle(rand(-120, 175), rand(-175, 175), rand(0.1, 0.4), `rgba(80,80,80,${rand(0.05, 0.12)})`);
  // I-15: eight lanes behind the west side, with its shoulders
  g.rect(-110, -175, -94, 175, '#46474a'); g.rect(-102.3, -175, -101.7, 175, '#bdb8ac');
  for (const x of [-108, -106, -104, -100, -98, -96]) g.line(x, -175, x, 175, 0.08, 'rgba(240,240,235,.7)', [1, 1.6]);
  for (const x of [-109.6, -94.4]) g.line(x, -175, x, 175, 0.1, 'rgba(240,240,235,.8)');
  paintNetwork(g, city, {
    width: (A, Bn) => (A.x === 0 && Bn.x === 0 ? STRIP * 2 : city.roadW),
    median: (A, Bn) => (A.x === 0 && Bn.x === 0 ? 1.3 : 0),
    stubs: (N) => [N.x === XS[0] && N.z !== 16 ? { axis: 'x', to: -175 } : null, N.x === XS[3] ? { axis: 'x', to: 175 } : null, N.z === ZS[0] ? { axis: 'z', to: -175, w: N.x === 0 ? STRIP * 2 : 6 } : null, N.z === ZS[6] ? { axis: 'z', to: 175, w: N.x === 0 ? STRIP * 2 : 6 } : null].filter(Boolean),
  });
  widenFor(city, 'x', 0, STRIP);
  // sidewalks: wide and busy along the Strip, normal elsewhere
  for (const b of city.blocks) city.paintSidewalk(g, b, '#c9c3b8');
  for (const b of city.blocks) city.lampsAlongBlock(b, 9);
  // palms down the Strip's median
  for (let z = -170; z < 172; z += 7) if (!ZS.some((zz) => Math.abs(z - zz) < 6)) city.addTree(rand(-0.25, 0.25), z, 1.15, 'palm');

  const lot = (x0, z0, x1, z1, c = '#9d968a') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.2, 30); };
  const pool = (x0, z0, x1, z1) => { g.rect(x0 - 0.8, z0 - 0.8, x1 + 0.8, z1 + 0.8, '#e6dccb'); g.rect(x0, z0, x1, z1, '#3fc3d8'); g.rect(x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, '#5fd6e6'); city.crowds.push({ x: (x0 + x1) / 2, z: z1 + 0.5, r: 1.2, n: 5, look: 'swim' }); };
  const palmsAlong = (x0, z0, x1, z1, step = 4) => { for (let t = 0; t <= 1.0001; t += step / Math.max(1, Math.hypot(x1 - x0, z1 - z0))) city.addTree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 1.1, 'palm'); };
  // a porte-cochère drive off the Strip with a cab line, valets and doormen
  const driveway = (side, z, look = 'valet') => {
    const x = side * 10.5;
    g.rect(Math.min(x, side * 8.5), z - 2.6, Math.max(x, side * 8.5) + side * 6, z + 2.6, '#5c5a57');
    for (let k = 0; k < 3; k++) city.parked.push({ x: x + side * (1.2 + k * 1.5), z: z - 1.2, rot: Math.PI / 2 });
    city.crowds.push({ x: x + side * 4.6, z: z + 1.4, r: 0.6, n: 2, look }, { x: x + side * 2.6, z: z + 1.5, r: 0.7, n: 4, look: 'tourist' });
  };
  // the Strip sidewalks: tourists, photo-takers, groups heading out for the night
  const strip = (side, z0, z1, every = 5) => {
    for (let z = z0; z < z1; z += every) if (!ZS.some((zz) => Math.abs(z - zz) < 5)) city.crowds.push({ x: side * rand(6.6, 7.8), z: z + rand(-1, 1), r: 0.7, n: Math.round(rand(2, 5)), look: Math.random() < 0.25 ? 'nightlife' : 'tourist' });
  };
  strip(-1, -132, 134); strip(1, -132, 134);
  city.wanderZones.push({ x0: -8.4, x1: -6, z0: -132, z1: 134 }, { x0: 6, x1: 8.4, z0: -132, z1: 134 });

  // ===== WEST SIDE =====
  // Mandalay Bay: the gold Y, three stepped wings round a core, and its beach behind
  {
    lot(W0, 107.4, W1, 134.6);
    const gold = hsl(0.115, 0.62, 0.56), cx = -40, cz = 121;
    const core = R(B, { x: cx, z: cz, w: 6.4, d: 6.4, floors: 45, style: 'office', tint: gold });
    const wings = [];
    [[-33.8, 121, 6, 4.4, 43], [-27.8, 121, 6, 4.4, 40], [-21.8, 121, 6, 4.4, 35]].forEach(([x, z, w, d, f]) => wings.push(R(B, { x, z, w, d, floors: f, style: 'office', tint: gold })));
    for (const s of [-1, 1]) [[1, 43], [2, 40], [3, 36]].forEach(([k, f]) => wings.push(R(B, { x: cx - 1 - 4.4 * k, z: cz + s * (1 + 4.4 * k), w: 4.4, d: 4.4, floors: f, style: 'office', tint: gold })));
    R(B, { x: -14, z: 120, w: 8, d: 18, floors: 3, style: 'stucco', tint: hsl(0.1, 0.25, 0.8), cell: 2 });
    pool(-72, 110, -58, 120); g.rect(-73, 121, -58, 132, '#e7d7b0'); pool(-72, 124, -62, 131);
    palmsAlong(-73, 109, -73, 133, 3); palmsAlong(-57, 111, -57, 132, 4);
    driveway(-1, 128);
    V.resorts.mandalay = { core, wings };
    name('Mandalay Bay', 'Mandalay Bay', W0, W1, 107.4, 134.6);
  }
  // Luxor: the black glass pyramid (and its sphinx and obelisk out front), ziggurat towers behind
  {
    lot(W0, 77, W1, 96.6, '#b3a68e');
    const black = hsl(0.6, 0.2, 0.13), cell = 1.2;
    const pyr = R(B, { x: -34, z: 87.2, w: 18, d: 18, floors: 26, style: 'office', tint: black, cell, gh: 1.1, fh: 0.95, setbacks: pyramid(18, 26, cell), exact: true });
    const zig = [];
    for (const z of [81.5, 92]) zig.push(R(B, { x: -63, z, w: 14, d: 7, floors: 22, style: 'office', tint: black, cell: 1.75, setbacks: [{ f: 8, n: 1 }, { f: 15, n: 2 }] }));
    g.rect(-24, 82, -9, 93, '#d8c9a4');                         // the plaza the sphinx guards
    V.resorts.luxor = { pyr, zig, sphinx: { x: -18.5, z: 87.5 }, obelisk: { x: -11.5, z: 80 } };
    city.crowds.push({ x: -13, z: 84, r: 1.2, n: 5, look: 'tourist', face: { x: -18.5, z: 87.5 } });
    driveway(-1, 94);
    name('Luxor', 'the Luxor', W0, W1, 77, 96.6);
  }
  // Excalibur: the white castle with coloured turrets on the Strip, two stepped white towers behind
  {
    lot(W0, 65.4, W1, 76, '#b7ab96');
    const white = hsl(0.1, 0.12, 0.92);
    const towers = [R(B, { x: -57, z: 67.6, w: 16, d: 3.6, floors: 26, style: 'stucco', tint: white, cell: 1.6, setbacks: [{ f: 20, n: 1 }] }),
      R(B, { x: -57, z: 73.6, w: 16, d: 3.6, floors: 26, style: 'stucco', tint: white, cell: 1.6, setbacks: [{ f: 20, n: 1 }] })];
    const castle = R(B, { x: -27, z: 70.8, w: 26, d: 8.4, floors: 4, style: 'stucco', tint: hsl(0.1, 0.1, 0.9), cell: 2.1, gh: 2 });
    V.resorts.excalibur = { towers, castle };
    name('Excalibur', 'the Excalibur', W0, W1, 65.4, 76);
  }
  // New York-New York: the Manhattan skyline in miniature, the Statue of Liberty and Brooklyn Bridge on the corner
  {
    lot(W0, 35, W1, 54.6, '#a69e90');
    const T = (x, z, w, d, f, c, sb) => R(B, { x, z, w, d, floors: f, style: pick(['office', 'concrete']), tint: c, cell: 1.5, setbacks: sb });
    const esb = R(B, { x: -31, z: 45, w: 5.4, d: 5.4, floors: 46, style: 'concrete', tint: hsl(0.09, 0.25, 0.72), cell: 1.35, setbacks: [{ f: 18, n: 1 }, { f: 38, n: 2 }] });
    const chrysler = R(B, { x: -40, z: 40.5, w: 4.2, d: 4.2, floors: 40, style: 'concrete', tint: hsl(0.1, 0.06, 0.82), cell: 1.4, setbacks: [{ f: 30, n: 1 }] });
    const rest = [T(-43, 50, 4.4, 4.6, 30, hsl(0.03, 0.4, 0.5)), T(-36, 50.8, 4, 3.6, 34, hsl(0.08, 0.15, 0.7)), T(-24, 50.6, 4.4, 4, 25, hsl(0.58, 0.1, 0.72), [{ f: 20, n: 1 }]),
      T(-46, 41, 3.6, 4, 27, hsl(0.06, 0.3, 0.6)), T(-24, 39, 4, 4.4, 31, hsl(0.1, 0.18, 0.78), [{ f: 24, n: 1 }]), T(-34.4, 37.6, 3.4, 3.4, 22, hsl(0.04, 0.35, 0.55))];
    const street = R(B, { x: -15.5, z: 45, w: 6, d: 18, floors: 3, style: 'brick', tint: hsl(0.04, 0.35, 0.58), cell: 1.6, gh: 1.6, storefront: true });
    V.resorts.nyny = { esb, chrysler, rest, street, liberty: { x: -11, z: 53 }, bridge: { x: -10.2, z0: 37.5, z1: 50 } };
    city.crowds.push({ x: -9.5, z: 51, r: 1, n: 4, look: 'tourist', face: { x: -11, z: 53 } });
    name('New York-New York', 'New York-New York', W0, W1, 35, 54.6);
  }
  // Park MGM, with T-Mobile Arena behind
  {
    lot(W0, 26.5, W1, 34);
    V.resorts.park = R(B, { x: -26, z: 30.3, w: 26, d: 4.2, floors: 32, style: 'concrete', tint: hsl(0.08, 0.12, 0.8), cell: 1.75 });
    R(B, { x: -61, z: 30, w: 16, d: 8, floors: 5, style: 'office', tint: hsl(0.58, 0.08, 0.6), cell: 2.6, gh: 2 });
    driveway(-1, 33);
    name('Park MGM', 'Park MGM', W0, W1, 26.5, 34);
  }
  // Aria (set back, curved glass) and the Cosmopolitan's twin towers right on the Strip
  {
    lot(W0, 6.5, W1, 26, '#a39d93');
    const glass = hsl(0.57, 0.14, 0.66);
    V.resorts.aria = arcSlab(B, [[-58, 9.5], [-55, 13.5], [-53, 17.5], [-55, 21.5]], 6, 4.2, [46, 50, 50, 46], 'office', glass);
    const blk = hsl(0.62, 0.25, 0.22);
    const cosmo = [R(B, { x: -19.5, z: 10.5, w: 5, d: 5, floors: 52, style: 'office', tint: blk, cell: 1.65 }), R(B, { x: -19.5, z: 19, w: 5, d: 5, floors: 50, style: 'office', tint: blk, cell: 1.65 })];
    R(B, { x: -12.5, z: 14.8, w: 5, d: 14, floors: 4, style: 'office', tint: hsl(0.62, 0.1, 0.3), cell: 1.8, gh: 2 });
    V.resorts.cosmo = { towers: cosmo, marquee: { x: -9.4, z: 7.5 } };
    city.crowds.push({ x: -10, z: 22, r: 0.9, n: 6, look: 'nightlife' }, { x: -10.5, z: 9, r: 0.8, n: 5, look: 'nightlife' });
    name('The Cosmopolitan', 'the Cosmopolitan', -28, W1, 6.5, 26); name('Aria', 'Aria', W0, -28, 6.5, 26);
  }
  // Bellagio: the curved cream tower behind its lake; the fountains in front, on the Strip
  {
    lot(W0, -18.6, W1, 5, '#b1a891');
    const cream = hsl(0.1, 0.32, 0.82);
    V.resorts.bellagio = arcSlab(B, [[-44, -16], [-47, -11.5], [-49, -7], [-47, -2.5], [-44, 2]], 5.4, 4.8, [33, 36, 37, 36, 33], 'concrete', cream);
    R(B, { x: -35.5, z: -7, w: 4, d: 20, floors: 3, style: 'stucco', tint: hsl(0.1, 0.3, 0.86), cell: 2 });
    // the lake: a balustraded edge along the Strip, villas and cypresses round the far shore
    g.rect(-31.5, -17.6, -9.2, 3.6, '#e9e2d2'); g.rect(-30.8, -17, -9.9, 3, '#2f7f9a');
    V.lake = { x0: -30.8, x1: -9.9, z0: -17, z1: 3 };
    for (let z = -16.5; z < 3; z += 3) city.addTree(-32.5, z, 0.9, 'round');
    for (let z = -16; z < 3; z += 2.2) city.crowds.push({ x: -8.6, z, r: 0.5, n: 3, look: 'tourist', face: { x: -20, z } });   // watching the water
    pool(-72, -16, -60, -6);
    name('Bellagio', 'the Bellagio', W0, W1, -18.6, 5);
  }
  // Caesars Palace: white towers, the temple front and fountains, cypresses and statues, the Colosseum
  {
    lot(W0, -63, W1, -29.4, '#b4ab98');
    const white = hsl(0.1, 0.08, 0.92), blue = hsl(0.55, 0.25, 0.62);
    const towers = [R(B, { x: -58, z: -52, w: 5, d: 18, floors: 26, style: 'office', tint: white, cell: 1.7 }), R(B, { x: -45, z: -58, w: 16, d: 4.6, floors: 29, style: 'office', tint: white, cell: 1.7 }),
      R(B, { x: -42, z: -42, w: 14, d: 4.6, floors: 24, style: 'office', tint: blue, cell: 1.7 }), R(B, { x: -64, z: -36, w: 12, d: 4.6, floors: 22, style: 'office', tint: white, cell: 1.7 })];
    R(B, { x: -24, z: -56, w: 12, d: 10, floors: 4, style: 'stucco', tint: hsl(0.09, 0.15, 0.88), cell: 2 });   // the Forum Shops
    V.resorts.caesars = { towers, temple: { x: -13.5, z: -45 }, colosseum: { x: -27, z: -36 } };
    for (let z = -60; z < -31; z += 3) city.addTree(-10.5, z, 1, 'round');
    pool(-56, -42, -48, -34);
    city.crowds.push({ x: -9.2, z: -40, r: 0.7, n: 3, look: 'showgirl' }, { x: -9.2, z: -52, r: 0.6, n: 2, look: 'elvis' });
    driveway(-1, -50);
    name('Caesars Palace', 'Caesars Palace', W0, W1, -63, -29.4);
  }
  // Treasure Island: the Y tower and its lagoon (the pirate ships) on the corner of Spring Mountain
  {
    lot(W0, -80.6, W1, -64, '#ada38f');
    V.resorts.ti = [R(B, { x: -40, z: -73, w: 14, d: 4.4, floors: 36, style: 'concrete', tint: hsl(0.08, 0.3, 0.74), cell: 1.7 }), R(B, { x: -30, z: -68, w: 4.4, d: 8, floors: 34, style: 'concrete', tint: hsl(0.08, 0.3, 0.74), cell: 1.7 })];
    g.rect(-22, -79, -9.2, -66, '#2d7f8e'); V.lagoon = { x: -15.5, z: -72.5 };
    name('Treasure Island', 'Treasure Island', W0, W1, -80.6, -64);
  }
  // north of Spring Mountain: Fashion Show (the Cloud) and Resorts World
  {
    lot(W0, -106, W1, -91.4);
    R(B, { x: -40, z: -99, w: 40, d: 12, floors: 4, style: 'stucco', tint: hsl(0.1, 0.08, 0.9), cell: 2.6, gh: 2 });
    V.cloud = { x: -14, z: -98.5 };
    name('Fashion Show', 'Fashion Show mall', W0, W1, -106, -91.4);
    lot(W0, -132.6, W1, -107.5, '#a89e8d');
    const red = hsl(0.01, 0.55, 0.38);
    V.resorts.rw = arcSlab(B, [[-42, -126], [-38, -121.5], [-35, -117], [-38, -112.5]], 6, 4.4, [50, 54, 54, 50], 'office', red);
    R(B, { x: -18, z: -120, w: 12, d: 22, floors: 4, style: 'office', tint: hsl(0.02, 0.3, 0.3), cell: 2.2, gh: 2 });
    driveway(-1, -112);
    name('Resorts World', 'Resorts World', W0, W1, -132.6, -107.5);
  }

  // ===== EAST SIDE =====
  // south of Tropicana: the old Tropicana site, now a dig for the ballpark
  {
    g.rect(E0, 65.4, E1, 96.6, '#a38c6a'); g.grainRect(E0, 65.4, E1, 96.6, 0.35, 40);
    for (let k = 0; k < 40; k++) g.circle(rand(E0 + 2, E1 - 2), rand(67, 95), rand(0.5, 2), 'rgba(90,70,50,.25)');
    for (let x = E0 + 0.5; x < E1; x += 1) { city.addProp('chainlink', x, 65.8, 0); city.addProp('chainlink', x, 96.2, 0); }
    for (let k = 0; k < 4; k++) city.parked.push({ x: rand(E0 + 6, E1 - 6), z: rand(70, 92), rot: rand(0, 6) });
    V.site = { x0: E0, x1: E1, z0: 65.4, z1: 96.6 };
    name('The ballpark site', 'the ballpark construction site', E0, E1, 65.4, 96.6);
    lot(E0, 107.4, E1, 134.6, '#bcae95');
    for (let k = 0; k < 3; k++) R(B, { x: 20 + k * 9, z: 126, w: 6, d: 5, floors: 2, style: 'stucco', tint: hsl(rand(0, 1), 0.3, 0.8), cell: 2 });
  }
  // MGM Grand: the emerald tower (four wings in a cross), the gold lion on the corner, the arena behind
  {
    lot(E0, 27.6, E1, 54.6, '#a59d90');
    const em = hsl(0.42, 0.55, 0.38);
    const wings = [R(B, { x: 33.5, z: 41, w: 5.4, d: 25, floors: 30, style: 'office', tint: em, cell: 1.8 }),
      R(B, { x: 24.5, z: 41, w: 12.6, d: 5, floors: 30, style: 'office', tint: em, cell: 1.8 }), R(B, { x: 42.4, z: 41, w: 12.4, d: 5, floors: 30, style: 'office', tint: em, cell: 1.8 })];
    R(B, { x: 17, z: 50, w: 14, d: 8, floors: 4, style: 'office', tint: hsl(0.42, 0.3, 0.45), cell: 2, gh: 2 });
    R(B, { x: 44, z: 50, w: 8, d: 8, floors: 5, style: 'concrete', tint: hsl(0.1, 0.08, 0.8), cell: 2.6, gh: 2 });
    V.resorts.mgm = { wings, lion: { x: 11.8, z: 51.5 }, marquee: { x: 9.6, z: 31 } };
    city.crowds.push({ x: 11, z: 47.5, r: 1, n: 4, look: 'tourist', face: { x: 11.8, z: 51.5 } });
    driveway(1, 36);
    name('MGM Grand', 'the MGM Grand', E0, E1, 27.6, 54.6);
    lot(E0, 21.4, E1, 27);
    R(B, { x: 26, z: 24.2, w: 14, d: 5.4, floors: 4, style: 'office', tint: hsl(0.15, 0.6, 0.6), cell: 2 });
    V.coke = { x: 12.5, z: 24 };
    name("M&M'S World", "M&M'S World", E0, E1, 21.4, 27);
  }
  // Planet Hollywood: the dark curved tower and the Miracle Mile
  {
    lot(E0, -6, E1, 10.6, '#a29b8f');
    V.resorts.ph = arcSlab(B, [[40, -3], [37.5, 1.5], [37.5, 6]], 6, 4.4, 40, 'office', hsl(0.6, 0.1, 0.2));
    R(B, { x: 20, z: 2.5, w: 18, d: 14, floors: 3, style: 'office', tint: hsl(0.6, 0.15, 0.32), cell: 2.2, gh: 2 });
    city.crowds.push({ x: 9.8, z: 6, r: 0.8, n: 5, look: 'nightlife' });
    name('Planet Hollywood', 'Planet Hollywood', E0, E1, -6, 10.6);
  }
  // Paris: the Eiffel Tower on the Strip (legs down into the casino), the Hôtel de Ville tower behind, the balloon
  {
    lot(E0, -18.6, E1, -6.8, '#b0a690');
    const tower = R(B, { x: 40, z: -12.7, w: 12, d: 7.6, floors: 33, style: 'concrete', tint: hsl(0.1, 0.3, 0.84), cell: 1.7 });
    R(B, { x: 28.5, z: -12.7, w: 7, d: 10, floors: 4, style: 'stucco', tint: hsl(0.1, 0.3, 0.86), cell: 2.2, gh: 2 });
    V.resorts.paris = { tower, eiffel: { x: 17, z: -12.7 }, balloon: { x: 10.6, z: -3.4 } };
    city.crowds.push({ x: 10, z: -16, r: 0.8, n: 4, look: 'tourist', face: { x: 17, z: -12.7 } }, { x: 9.4, z: -12, r: 0.6, n: 2, look: 'elvis' });
    name('Paris Las Vegas', 'Paris Las Vegas', E0, E1, -18.6, -6.8);
  }
  // Flamingo, the LINQ (and its promenade to the High Roller), Harrah's
  {
    lot(E0, -38, E1, -29.4, '#b3a493');
    V.resorts.flamingo = [R(B, { x: 33, z: -34, w: 20, d: 4.4, floors: 28, style: 'stucco', tint: hsl(0.97, 0.35, 0.86), cell: 1.7 }), R(B, { x: 18, z: -33.6, w: 8, d: 7, floors: 4, style: 'stucco', tint: hsl(0.96, 0.4, 0.8), cell: 2 })];
    city.crowds.push({ x: 9.4, z: -33, r: 0.7, n: 3, look: 'showgirl' });
    name('Flamingo', 'the Flamingo', E0, E1, -38, -29.4);
    lot(E0, -46, E1, -39);
    V.resorts.linq = R(B, { x: 33, z: -42.5, w: 20, d: 4.4, floors: 30, style: 'office', tint: hsl(0.08, 0.15, 0.7), cell: 1.7 });
    g.rect(E0, -49, 60, -46.2, '#cbbfae'); for (let x = 12; x < 56; x += 4) g.line(x, -49, x + 2, -46.2, 0.05, 'rgba(0,0,0,.12)');
    city.wanderZones.push({ x0: 10, x1: 52, z0: -48.8, z1: -46.4 }); city.crowds.push({ x: 26, z: -47.6, r: 1, n: 6, look: 'tourist' }, { x: 40, z: -47.5, r: 1, n: 5, look: 'nightlife' });
    name('The LINQ', 'the LINQ', E0, E1, -49, -39);
    lot(E0, -57, E1, -49.5);
    V.resorts.harrahs = [R(B, { x: 32, z: -53.4, w: 22, d: 4.6, floors: 35, style: 'concrete', tint: hsl(0.07, 0.35, 0.74), cell: 1.7 }), R(B, { x: 15, z: -53, w: 10, d: 7, floors: 4, style: 'stucco', tint: hsl(0.04, 0.5, 0.6), cell: 2 })];
    name("Harrah's", "Harrah's", E0, E1, -57, -49.5);
  }
  // the Venetian (campanile, Doge's palace, the canal and Rialto bridge) and the Palazzo
  {
    lot(E0, -71, E1, -58, '#b5aa94');
    const cream = hsl(0.09, 0.32, 0.8);
    V.resorts.venetian = [R(B, { x: 36, z: -67.8, w: 20, d: 4.4, floors: 36, style: 'concrete', tint: cream, cell: 1.7 }), R(B, { x: 43.6, z: -61.6, w: 4.6, d: 8, floors: 36, style: 'concrete', tint: cream, cell: 1.7 })];
    R(B, { x: 20, z: -64.5, w: 6, d: 11, floors: 3, style: 'stucco', tint: hsl(0.02, 0.35, 0.82), cell: 2 });     // the Doge's Palace front
    g.rect(9.2, -70.4, 14.4, -58.6, '#2f8a96');                     // the canal
    V.venice = { campanile: { x: 15.8, z: -59.6 }, canal: { x0: 9.6, x1: 14, z0: -70, z1: -59 }, rialto: { x: 11.8, z: -66 } };
    city.crowds.push({ x: 15.6, z: -66, r: 0.8, n: 4, look: 'tourist', face: { x: 11.8, z: -66 } });
    name('The Venetian', 'the Venetian', E0, E1, -71, -58);
    lot(E0, -80.6, E1, -72);
    V.resorts.palazzo = R(B, { x: 33, z: -76.3, w: 22, d: 5.4, floors: 50, style: 'concrete', tint: hsl(0.09, 0.3, 0.72), cell: 1.8, setbacks: [{ f: 40, n: 1 }, { f: 46, n: 2 }] });
    driveway(1, -78);
    name('The Palazzo', 'the Palazzo', E0, E1, -80.6, -72);
  }
  // Wynn and Encore: two bronze curves, and Wynn's mountain hiding the resort from the Strip
  {
    lot(E0, -110.5, E1, -91.4, '#a9a08f');
    const bronze = hsl(0.075, 0.42, 0.42);
    V.resorts.wynn = arcSlab(B, [[26, -93.5], [29.5, -97.5], [31.5, -101], [29.5, -104.5], [26, -108.5]], 6, 4.4, [42, 45, 45, 45, 42], 'office', bronze);
    V.mountain = { x: 15, z: -101, r: 6.5 };
    name('Wynn Las Vegas', 'Wynn Las Vegas', E0, E1, -110.5, -91.4);
    lot(E0, -132.6, E1, -111.5);
    V.resorts.encore = arcSlab(B, [[26, -114.5], [29.5, -118.5], [31.5, -122], [29.5, -125.5], [26, -129.5]], 5.6, 4.2, [45, 48, 48, 48, 45], 'office', bronze);
    city.crowds.push({ x: 10, z: -118, r: 0.9, n: 6, look: 'nightlife' });
    driveway(1, -127);
    name('Encore', 'Encore', E0, E1, -132.6, -111.5);
  }
  // ---- east of Koval: Sphere, the High Roller, the police, apartments and garages
  {
    lot(59.4, -80.6, 98.6, -56, '#a6a093');
    V.sphere = { x: 79, z: -68, r: 12.5 };
    city.crowds.push({ x: 64, z: -60, r: 1.2, n: 6, look: 'tourist', face: { x: 79, z: -68 } });
    name('Sphere', 'the Sphere', 64, 94, -80, -56);
    lot(59.4, -50, 98.6, -29.4);
    V.wheel = { x: 66, z: -46, r: 15 };
    name('The High Roller', 'the High Roller', 52, 80, -50, -40);
    const hq = city.blocks.find((b) => b.i === 2 && b.j === 3);
    if (hq) { city.paintSidewalk(g, hq); policeHQ(ctx, hq); }
  }
  // the rest of the blocks off the Strip: mid-rise hotels, apartments, garages and parking
  for (const b of city.blocks) {
    const used = (b.i === 0 || b.i === 1) || (b.i === 2 && (b.j === 3 || b.j === 1));
    if (used) continue;
    lot(b.lx0, b.lz0, b.lx1, b.lz1);
    const n = Math.floor((b.lx1 - b.lx0) / 12);
    for (let k = 0; k < n; k++) {
      const x = b.lx0 + 6 + k * 12;
      for (const z of [b.lz0 + 5, b.lz1 - 5]) if (Math.random() < 0.75) {
        const tall = Math.random() < 0.25, st = tall ? pick(['office', 'concrete']) : 'stucco';
        const bb = B.add({ x, z, w: rand(6, 9), d: rand(5, 7), floors: tall ? Math.round(rand(10, 22)) : Math.round(rand(2, 5)), style: st, tint: st === 'stucco' ? hsl(rand(0.06, 0.12), rand(0.2, 0.4), rand(0.75, 0.88)) : hsl(rand(0.05, 0.6), 0.12, rand(0.6, 0.8)), cell: 2.2, gh: 1.5 });
        if (tall) bb.noSigns = true;
      }
    }
    const spots = city.paintParking(g, b.lx0 + 1, (b.lz0 + b.lz1) / 2 - 3, b.lx1 - 1, (b.lz0 + b.lz1) / 2 + 3);
    for (const s of spots) if (Math.random() < 0.5) city.parked.push(s);
    for (let x = b.x0 + 3; x < b.x1 - 2; x += 6) { city.addTree(x, b.z0 + 1.2, 1, 'palm'); city.addTree(x, b.z1 - 1.2, 1, 'palm'); }
  }
  // Industrial Road, between Sinatra and I-15: warehouses, a couple of gentlemen's clubs, a wedding chapel
  {
    for (let z = -80; z < 134; z += 11) {
      if (ZS.some((zz) => Math.abs(z - zz) < 6)) continue;
      const club = z > 20 && z < 44, chapel = z > -60 && z < -50;
      const b = B.add({ x: -88.5, z, w: 8, d: 8, floors: club ? 2 : chapel ? 1 : Math.round(rand(1, 3)), style: 'stucco', tint: club ? hsl(0.85, 0.15, 0.22) : chapel ? hsl(0.95, 0.15, 0.95) : hsl(rand(0.06, 0.12), 0.15, rand(0.6, 0.78)), cell: 2.6, gh: 1.6, storefront: false });
      b.noSigns = !club;
      if (club) { (V.clubs ||= []).push({ x: -84.4, z }); city.crowds.push({ x: -83.6, z: z + 3, r: 0.7, n: 4, look: 'nightlife' }, { x: -83.6, z: z - 2.5, r: 0.4, n: 1, look: 'security' }); city.parked.push({ x: -84, z: z + 6, rot: 0 }); }
      if (chapel) V.chapel = { x: -84.4, z, b };
    }
  }
  // a Henderson-style tract neighbourhood out to the south-east: stucco, tile roofs, block walls, palms
  {
    g.rect(108, 60, 175, 175, '#b9ad97');
    for (let z = 66; z < 172; z += 13) {
      g.rect(108, z - 1.6, 175, z + 1.6, '#5a5b5e');
      for (let x = 112; x < 172; x += 6.2) for (const s of [-1, 1]) {
        const hz = z + s * 5;
        if (hz > 172) continue;
        B.add({ x, z: hz, w: 4.4, d: 4.6, floors: 1 + (Math.random() < 0.3), style: 'house', tint: hsl(rand(0.07, 0.12), rand(0.25, 0.45), rand(0.74, 0.86)), cell: 2.2, fh: 0.95, gh: 1, gable: true, roofTint: hsl(rand(0.03, 0.06), 0.45, rand(0.38, 0.48)) });
        if (Math.random() < 0.4) city.addTree(x + 2.6, hz + s * 1.5, 0.9, 'palm');
      }
    }
    for (let x = 108; x < 175; x += 22) g.rect(x - 1.6, 60, x + 1.6, 175, '#5a5b5e');
  }

  // police posted on the Strip (bridges, the fountains)
  for (const [x, z] of [[-6.8, 58], [6.8, -22], [-6.8, -6], [6.8, -84]]) { city.stationed.push({ x: x * 1.25, z: z + 4, rot: 0, quiet: true }); city.crowds.push({ x: x * 1.12, z: z + 2, r: 0.5, n: 2, look: 'lvmpd' }); }
  city.hotspot = { x: 0, z: -10, r: 70 };
  city.side = 1;
  return { ...ctx, agents: { cars: 72, peds: 360, wanderFrac: 0.12 }, fog: 0xdccdb3, start: { x: 0, z: -4 }, zMin: -138, zMax: 140, xMin: -100, maxD: 230, yaw: 0.42, ownBackdrop: true };
}

// ====================================================================================================
// Dressing, life and the world around (built after the buildings exist)
// ====================================================================================================
export class Vegas {
  constructor(scene, city) {
    this.city = city; this.scene = scene; const V = city.vegas;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 });
    this.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.8 });
    this.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.7, envMapIntensity: 1.4 });
    this.neon = new THREE.MeshBasicMaterial({ vertexColors: true }); this.neon.userData.neon = true;
    this.anim = [];
    const R = V.resorts;
    this.mandalay(R.mandalay); this.luxor(R.luxor); this.excalibur(R.excalibur); this.nyny(R.nyny);
    this.mgm(R.mgm, V.coke); this.cosmo(R.cosmo); this.bellagio(R.bellagio, V.lake); this.paris(R.paris); this.caesars(R.caesars);
    this.venice(R.venetian, R.palazzo, V.venice); this.wynn(R.wynn, R.encore, V.mountain); this.rw(R.rw); this.flamingo(R.flamingo, R.linq, R.harrahs);
    this.ph(R.ph); this.ti(R.ti, V.lagoon); this.cloud(V.cloud); this.sphere(V.sphere); this.wheel(V.wheel); this.bridges(); this.welcome();
    this.clubs(V.clubs || [], V.chapel); this.site(V.site); this.crowns(R);
    this.world(scene);
  }
  add(geos, mat = this.mat, shadow = true) { return merged(geos, mat, this.scene, shadow); }
  // a canvas sign as a plane (lit at night)
  sign(w, h, draw, x, y, z, ry = 0, glow = 0.6) {
    const tex = canvasTex(Math.round(w * 64), Math.round(h * 64), draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, transparent: true, alphaTest: 0.05, roughness: 0.5 }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); (this.signs ||= []).push(m.material); return m;
  }
  text(txt, font, fill, glow) { return (x, w, h) => { x.font = font.replace('$', Math.round(h * 0.72)); x.textAlign = 'center'; x.textBaseline = 'middle'; if (glow) { x.shadowColor = glow; x.shadowBlur = h * 0.25; } x.fillStyle = fill; x.fillText(txt, w / 2, h * 0.54); }; }

  mandalay(r) {
    const t = topOf(r.core);
    this.add([box(t.w + 0.4, 1.4, t.d + 0.4, t.cx, t.y + 0.7, t.cz, 0xd9b45a)], this.metal);
    const s = this.sign(7, 1.5, this.text('MANDALAY BAY', '600 $px Georgia, serif', '#fff3c8', '#ffcc66'), t.cx + t.w / 2 + 0.3, t.y - 1.2, t.cz, Math.PI / 2, 0.9);
    hangOn(r.core, [s], r.core.floors - 1);
  }
  luxor(r) {
    // the smooth black glass skin over the stepped floors, in small panels that each fall with the floor behind them
    const P0 = r.pyr, bx = P0.x, bz = P0.z, hw = P0.w / 2 + 0.25, apexY = topOf(P0).y + 2.2, byCell = new Map();
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]], N = 7;
    for (let f = 0; f < 4; f++) {
      const [ax, az] = corners[f], [cx2, cz2] = corners[(f + 1) % 4];
      const A = new THREE.Vector3(bx + ax * hw, 0, bz + az * hw), Bv = new THREE.Vector3(bx + cx2 * hw, 0, bz + cz2 * hw), T = new THREE.Vector3(bx, apexY, bz);
      const at = (u, v) => A.clone().lerp(Bv, u).lerp(T, v);   // u along the base, v up the face
      for (let j = 0; j < N; j++) for (let i = 0; i < N - j; i++) {
        const q = (a2, b2) => at((a2 + 0.5 * b2) / N, b2 / N);
        const tris = [[q(i, j), q(i + 1, j), q(i, j + 1)]];
        if (i < N - j - 1) tris.push([q(i + 1, j), q(i + 1, j + 1), q(i, j + 1)]);
        for (const [p1, p2, p3] of tris) {
          const c = new THREE.Vector3().add(p1).add(p2).add(p3).multiplyScalar(1 / 3);
          let best = null, bd = 1e9;
          for (const cell of P0.cells) { const d = Math.hypot(cell.x - c.x, (cell.y - c.y) * 1.5, cell.z - c.z); if (d < bd) { bd = d; best = cell; } }
          const g3 = new THREE.BufferGeometry(); g3.setAttribute('position', new THREE.Float32BufferAttribute([p1, p2, p3].flatMap((v) => [v.x, v.y, v.z]), 3)); g3.computeVertexNormals();
          if (!byCell.has(best)) byCell.set(best, []);
          byCell.get(best).push(tint(g3, 0x14181f));
        }
      }
    }
    const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.75, envMapIntensity: 1.3, side: THREE.DoubleSide });
    for (const [cell, geos] of byCell) { const m = new THREE.Mesh(mergeGeometries(geos), skin); m.castShadow = true; this.scene.add(m); (cell.props ||= []).push({ obj: [m], x: cell.x, y: cell.y, z: cell.z }); }
    // the beam from the apex (night only) and a glass cap
    const t = topOf(r.pyr);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 600, 12, 1, true).translate(bx, apexY + 300, bz), beamMat);
    this.scene.add(this.beam); hangOn(r.pyr, [this.beam], r.pyr.floors - 1);
    // the sphinx, facing the Strip, and the obelisk
    const { x, z } = r.sphinx, sand = 0xc8a46a, P = [];
    P.push(box(6.5, 2, 3, x, 1, z, sand), box(2.6, 1, 0.8, x + 4, 0.5, z - 0.9, sand), box(2.6, 1, 0.8, x + 4, 0.5, z + 0.9, sand));
    P.push(box(2.2, 2.6, 2.6, x + 2.4, 3.2, z, sand), box(1.2, 1.3, 1.4, x + 3.6, 3.4, z, 0xd9b77d), box(0.4, 0.5, 0.6, x + 4.3, 3.2, z, sand));
    P.push(box(0.6, 3.2, 3.2, x + 1.7, 3.6, z, 0x2a4a8a), box(0.7, 0.8, 0.6, x + 1.6, 4.9, z, 0xd9b45a));
    P.push(box(5, 0.5, 5.6, x - 0.5, 0.25, z, 0xb89c6c));
    const o = r.obelisk; P.push(box(1.1, 9, 1.1, o.x, 4.8, o.z, 0x9c8a6a), cone(0.8, 1.2, o.x, 9.9, o.z, 0xd9b45a, 4), box(2, 0.6, 2, o.x, 0.3, o.z, 0x8a7a5a));
    this.add(P);
    for (const zg of r.zig) { const t2 = topOf(zg); this.add([box(t2.w, 0.4, t2.d, t2.cx, t2.y + 0.2, t2.cz, 0x2a3240)], this.glass); }
  }
  excalibur(r) {
    // turrets: white drums with red, blue and gold cones along the castle front; red caps on the towers
    const c = r.castle, P = [], top = c.cells[0].hy * 2 + 0;
    const cols = [0xc8202a, 0x1f4fb3, 0xd9a21b];
    let k = 0;
    for (let x = c.x - c.w / 2 + 1; x <= c.x + c.w / 2 - 1; x += 2.4) for (const dz of [c.d / 2 - 0.6, -c.d / 2 + 0.6]) {
      const h = 6.5 + ((k * 7) % 4) * 1.4, rr = 0.7 + (k % 3) * 0.15;
      P.push(cyl(rr, rr, h, x, h / 2, c.z + dz, 0xf2efe8), cone(rr * 1.35, 2.6, x, h + 1.3, c.z + dz, cols[k % 3]));
      k++;
    }
    for (let x = c.x - c.w / 2 + 0.6; x < c.x + c.w / 2; x += 1.2) P.push(box(0.6, 0.6, 0.4, x, 6.6, c.z + c.d / 2 - 0.1, 0xe8e4dc));   // battlements
    const m = this.add(P); hangOn(c, [m], 0);
    for (const t of r.towers) { const tt = topOf(t); this.add([tint(hipRoof(1.8, tt.d + 0.4, 2.2).translate(tt.ax + 0.9, tt.y, tt.cz), 0xb3202a), tint(hipRoof(1.8, tt.d + 0.4, 2.2).translate(tt.bx - 0.9, tt.y, tt.cz), 0xb3202a)]); }
  }
  nyny(r) {
    // the Empire State spire, the Chrysler's stainless crown, the statue on the corner, Brooklyn Bridge along the front
    const e = topOf(r.esb);
    const sp = this.add([box(e.w * 0.6, 2.2, e.d * 0.6, e.cx, e.y + 1.1, e.cz, 0xcfc8b8), cyl(0.35, 0.5, 3, e.cx, e.y + 3.7, e.cz, 0xd8d8d8), cyl(0.05, 0.15, 4, e.cx, e.y + 7.2, e.cz, 0xd0d0d0)], this.metal); hangOn(r.esb, [sp], r.esb.floors - 1);
    const c = topOf(r.chrysler), P = [];
    for (let k = 0; k < 6; k++) P.push(cyl(c.w * 0.55 * (1 - k * 0.15), c.w * 0.62 * (1 - k * 0.15), 1, c.cx, c.y + 0.5 + k * 1, c.cz, 0xe6e8ec, 4));
    P.push(cyl(0.04, 0.2, 5, c.cx, c.y + 8.5, c.cz, 0xe6e8ec, 6));
    const cr = this.add(P, this.metal); cr.rotation.y = 0; hangOn(r.chrysler, [cr], r.chrysler.floors - 1);
    const { x, z } = r.liberty, green = 0x6fae9a, L = [];
    L.push(box(2.6, 3, 2.6, x, 1.5, z, 0xb9ab8f), box(1.8, 1.4, 1.8, x, 3.7, z, 0xc4b79c));
    L.push(cone(0.9, 6, x, 7.4, z, green, 10), sph(0.42, x, 10.6, z, green), cone(0.5, 0.5, x, 11.1, z, green, 7));
    L.push(box(0.22, 2.4, 0.22, x + 0.45, 11.2, z, green), cone(0.25, 0.5, x + 0.45, 12.6, z, 0xe8b830, 6), box(0.5, 0.7, 0.2, x - 0.5, 8.6, z + 0.45, green));
    this.add(L);
    this.torch = this.add([sph(0.26, x + 0.45, 12.95, z, 0xffd060, 8, 6)], this.neon, false);
    const b = r.bridge, B2 = [];
    for (const zz of [b.z0 + 2, b.z1 - 2]) { B2.push(box(1.4, 6, 1.6, b.x, 3, zz, 0xb8a98c)); B2.push(box(1.45, 1.6, 0.5, b.x, 3.6, zz, 0x5a4a3a)); }
    B2.push(box(1.2, 0.3, b.z1 - b.z0, b.x, 2.4, (b.z0 + b.z1) / 2, 0x7a6e60));
    for (let t = 0; t <= 1; t += 0.1) { const zz = b.z0 + 2 + t * (b.z1 - b.z0 - 4), h = 2.6 + 3 * Math.pow(2 * t - 1, 2); B2.push(box(0.06, h - 2.4, 0.06, b.x, 2.4 + (h - 2.4) / 2, zz, 0x3a3a3a)); }
    this.add(B2);
    // the roller coaster: a red tube weaving round the towers
    const pts = [[-12, 6, 52], [-20, 12, 54], [-30, 20, 54], [-44, 16, 53], [-48, 10, 46], [-47, 18, 38], [-40, 24, 35], [-28, 14, 35.5], [-18, 9, 36], [-12, 12, 40], [-13, 5, 46]].map(([a, h, c2]) => new THREE.Vector3(a, h, c2));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    this.add([tint(new THREE.TubeGeometry(curve, 160, 0.16, 6, true), 0xc8202a)], this.metal);
    const posts = []; for (let k = 0; k < 22; k++) { const p = curve.getPointAt(k / 22); posts.push(box(0.12, p.y, 0.12, p.x, p.y / 2, p.z, 0x8a8f96)); }
    this.add(posts);
  }
  mgm(r, coke) {
    // the lion: a golden cat on its pedestal at the corner
    const { x, z } = r.lion, gold = 0xd9a83a, P = [];
    P.push(cyl(2.4, 2.6, 2.4, x, 1.2, z, 0xd8d0c0, 20), cyl(2.6, 2.6, 0.3, x, 2.5, z, 0xb7ad99, 20));
    P.push(tint(new THREE.SphereGeometry(1.5, 12, 8).scale(1.3, 0.8, 0.8).translate(x - 0.3, 3.9, z), gold));
    P.push(sph(1.15, x + 1.2, 5.2, z, 0xc8922e), sph(0.75, x + 1.8, 5.1, z, gold), box(0.5, 1.4, 0.4, x + 0.7, 3.3, z - 0.5, gold), box(0.5, 1.4, 0.4, x + 0.7, 3.3, z + 0.5, gold));
    this.add(P, this.metal);
    // the marquee by the drive
    const m = r.marquee;
    this.add([box(0.8, 9, 0.8, m.x, 4.5, m.z, 0x2c3e2f), box(1, 1.4, 4, m.x, 9.7, m.z, 0x1e5a3a)]);
    this.sign(3.6, 2.8, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b3d24'); gr.addColorStop(1, '#13643a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#f2e2a0'; c.font = `700 ${h * 0.28}px Georgia, serif`; c.textAlign = 'center'; c.fillText('MGM', w / 2, h * 0.42); c.fillText('GRAND', w / 2, h * 0.75); }, m.x - 0.42, 6.2, m.z, -Math.PI / 2, 0.9);
    for (const w of r.wings) { const t = topOf(w); this.add([box(t.w + 0.2, 0.5, t.d + 0.2, t.cx, t.y + 0.25, t.cz, 0x0f4a2e)], this.glass); }
    // the giant Coca-Cola bottle
    const pts = [[0, 0], [1.3, 0], [1.4, 0.6], [1.2, 2.2], [1.45, 4.2], [1.0, 6.2], [0.55, 7.4], [0.5, 8.6], [0.6, 8.8], [0, 8.8]].map(([a, b]) => new THREE.Vector2(a, b));
    const bottle = new THREE.Mesh(new THREE.LatheGeometry(pts, 20).translate(coke.x, 0, coke.z), new THREE.MeshStandardMaterial({ color: 0x5e8f6e, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }));
    bottle.castShadow = true; this.scene.add(bottle);
    this.sign(2.8, 0.9, this.text('Coca-Cola', 'italic 700 $px Georgia, serif', '#ffffff', '#ff2a2a'), coke.x - 1.5, 3.6, coke.z, -Math.PI / 2, 0.8);
  }
  cosmo(r) {
    // the marquee: a tall LED column on the Strip that keeps changing colour
    const { x, z } = r.marquee;
    this.add([box(1.2, 14, 2.4, x, 7, z, 0x1a1a1e)]);
    const tex = canvasTex(64, 256, () => {});
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.25, 12.5, 2.45).translate(x, 7.5, z), new THREE.MeshBasicMaterial({ map: tex }));
    this.scene.add(m); this.cosmoTex = tex;
    for (const t of r.towers) { const tt = topOf(t); this.add([box(tt.w + 0.2, 0.6, tt.d + 0.2, tt.cx, tt.y + 0.3, tt.cz, 0x0e1420)], this.glass); }
  }
  bellagio(segs, lake) {
    // terracotta caps on each wing, and the fountains: jets in the lake that put on a show every so often
    for (const s of segs) { const t = topOf(s); const roof = this.add([tint(hipRoof(t.w + 0.5, t.d + 0.5, 1.6).translate(t.cx, t.y, t.cz), 0xb8613a)]); hangOn(s, [roof], s.floors - 1); }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(lake.x1 - lake.x0, lake.z1 - lake.z0).rotateX(-Math.PI / 2).translate((lake.x0 + lake.x1) / 2, 0.06, (lake.z0 + lake.z1) / 2),
      new THREE.MeshStandardMaterial({ color: 0x1d6684, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.94 }));
    water.receiveShadow = true; this.scene.add(water);
    const N = 64, jets = [];
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1), z = lake.z0 + 1.2 + t * (lake.z1 - lake.z0 - 2.4), x = lake.x1 - 3.2 - Math.sin(t * Math.PI) * 6 - (k % 2) * 1.6;
      jets.push({ x, z, k, row: k % 2, h: 0 });
    }
    const geo = new THREE.CylinderGeometry(0.05, 0.32, 1, 6, 1, true).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.7, depthWrite: false });
    this.jets = new THREE.InstancedMesh(geo, mat, N); this.jets.frustumCulled = false; this.scene.add(this.jets);
    const mist = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false });
    this.mist = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mist, N); this.mist.frustumCulled = false; this.scene.add(this.mist);
    this.fountain = { jets, t: 20, show: 0, N };
  }
  paris(r) {
    // the Eiffel Tower: four splayed lattice legs, the arches, two platforms, the shaft and the mast; gold lights after dark
    const { x, z } = r.eiffel, brown = 0x7b5a3c, P = [], L = [];
    const leg = (a, b, w) => { const d = new THREE.Vector3().subVectors(b, a), len = d.length(); const g2 = new THREE.BoxGeometry(w, len, w).translate(0, len / 2, 0); g2.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g2.translate(a.x, a.y, a.z); return g2; };
    const V3 = (a, b, c) => new THREE.Vector3(a, b, c);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      P.push(tint(leg(V3(x + sx * 5.6, 0, z + sz * 5.6), V3(x + sx * 3.4, 9, z + sz * 3.4), 1.2), brown));
      P.push(tint(leg(V3(x + sx * 3.2, 9.6, z + sz * 3.2), V3(x + sx * 1.9, 19, z + sz * 1.9), 0.8), brown));
      P.push(tint(leg(V3(x + sx * 1.8, 19.5, z + sz * 1.8), V3(x + sx * 0.35, 36, z + sz * 0.35), 0.5), brown));
      L.push(tint(leg(V3(x + sx * 5.6, 0.2, z + sz * 5.6), V3(x + sx * 0.4, 36, z + sz * 0.4), 0.12), 0xffc861));
    }
    for (const [ax, az, bx, bz] of [[1, 1, 1, -1], [-1, 1, -1, -1], [1, 1, -1, 1], [1, -1, -1, -1]]) {
      for (let t = 0; t <= 1.001; t += 1 / 8) { const u = t * 2 - 1, h = 6.5 - 2 * u * u; P.push(box(0.35, 0.35, 0.35, x + (ax + (bx - ax) * t) * 4.3, h, z + (az + (bz - az) * t) * 4.3, brown)); }
    }
    P.push(box(8, 0.6, 8, x, 9.3, z, 0x6a4c33), box(4.8, 0.5, 4.8, x, 19.3, z, 0x6a4c33), box(1.4, 1.2, 1.4, x, 36.4, z, 0x6a4c33), cyl(0.1, 0.18, 5, x, 39.5, z, 0x9a9a9a, 6));
    for (let y = 21; y < 35; y += 2.4) { const s = 1.8 - (y - 19.5) / 16.5 * 1.45; P.push(box(s * 2 + 0.2, 0.2, s * 2 + 0.2, x, y, z, brown)); }
    this.add(P, this.metal);
    this.eiffelLights = this.add(L, this.neon, false);
    // the mansard roof on the Hôtel de Ville tower, and the striped balloon sign
    const t = topOf(r.tower); this.add([tint(hipRoof(t.w + 0.4, t.d + 0.4, 2.6).translate(t.cx, t.y, t.cz), 0x5b6b7a)]);
    const b = r.balloon, tex = canvasTex(256, 128, (c, w, h) => { const cols = ['#d8262c', '#f4f0e6', '#1f3f8f', '#f2c230']; for (let k = 0; k < 16; k++) { c.fillStyle = cols[k % 4]; c.fillRect(k * w / 16, 0, w / 16 + 1, h); } c.fillStyle = '#fff'; c.font = '700 26px Georgia'; c.textAlign = 'center'; c.fillText('PARIS', w * 0.25, h * 0.55); c.fillText('PARIS', w * 0.75, h * 0.55); });
    const bal = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16).scale(1, 1.15, 1).translate(b.x, 8.5, b.z), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6 }));
    this.scene.add(bal); (this.signs ||= []).push(bal.material);
    this.add([cyl(0.25, 0.4, 5.4, b.x, 2.7, b.z, 0x3a3a3e), box(1.6, 1, 1.6, b.x, 5.6, b.z, 0x7a5a3a)]);
  }
  caesars(r) {
    const { x, z } = r.temple, wh = 0xf2efe6, P = [];
    P.push(box(5, 0.8, 12, x, 0.4, z, 0xe6e0d2));
    for (let k = 0; k < 8; k++) P.push(cyl(0.3, 0.34, 5, x + 1.6, 3.3, z - 5 + k * (10 / 7), wh, 10));
    P.push(box(3.8, 0.8, 11.6, x, 6.2, z, wh));
    const ped = new THREE.BufferGeometry(); ped.setAttribute('position', new THREE.Float32BufferAttribute([x + 1.9, 6.6, z - 5.8, x + 1.9, 6.6, z + 5.8, x + 1.9, 8.4, z, x - 1.9, 6.6, z - 5.8, x - 1.9, 8.4, z, x - 1.9, 6.6, z + 5.8, x + 1.9, 6.6, z - 5.8, x + 1.9, 8.4, z, x - 1.9, 8.4, z, x + 1.9, 6.6, z - 5.8, x - 1.9, 8.4, z, x - 1.9, 6.6, z - 5.8, x + 1.9, 6.6, z + 5.8, x - 1.9, 6.6, z + 5.8, x - 1.9, 8.4, z, x + 1.9, 6.6, z + 5.8, x - 1.9, 8.4, z, x + 1.9, 8.4, z], 3)); ped.computeVertexNormals();
    P.push(tint(ped, wh));
    // fountains in front and statues on plinths, the Colosseum drum behind
    for (const zz of [z - 9, z + 8]) { P.push(cyl(2, 2.1, 0.5, x + 0.5, 0.25, zz, 0xd8d0c0, 18), cyl(1.8, 1.8, 0.1, x + 0.5, 0.48, zz, 0x5fb3c8, 18), cyl(0.3, 0.4, 1.8, x + 0.5, 1.2, zz, wh, 8)); }
    for (let k = 0; k < 5; k++) P.push(box(0.6, 1, 0.6, x + 3, 0.5, z - 6 + k * 3, 0xd8d0c0), cyl(0.18, 0.22, 1.2, x + 3, 1.6, z - 6 + k * 3, wh, 6), sph(0.16, x + 3, 2.35, z - 6 + k * 3, wh));
    const c = r.colosseum; P.push(cyl(5, 5, 4, c.x, 2, c.z, 0xe9e2d2, 28), cyl(5.1, 5.1, 0.4, c.x, 4.2, c.z, 0xd8cfbd, 28));
    for (let a = 0; a < 6.28; a += 0.35) P.push(box(0.3, 2.6, 0.12, c.x + Math.cos(a) * 5.05, 2, c.z + Math.sin(a) * 5.05, 0xc9bfa9, -a));
    this.add(P);
    // cypresses: tall dark green spires along the drive
    const C = []; for (let zz = z - 16; zz < z + 15; zz += 2.6) C.push(tint(new THREE.ConeGeometry(0.45, 4.2, 8).translate(x + 4.6, 2.3, zz), 0x234a2a));
    this.add(C);
    for (const t of r.towers) { const tt = topOf(t); this.add([box(tt.w + 0.3, 0.7, tt.d + 0.3, tt.cx, tt.y + 0.35, tt.cz, 0xe8e4da)]); }
    this.sign(6, 1.2, this.text('CAESARS PALACE', '600 $px "Times New Roman", serif', '#f6ecd0', '#ffd890'), x + 1.95, 7.3, z, Math.PI / 2, 0.8);
  }
  venice(ven, pal, v) {
    // the campanile, the Rialto bridge over the canal, gondolas, red tile caps
    const { x, z } = v.campanile, P = [];
    P.push(box(2.2, 16, 2.2, x, 8, z, 0xa24a33), box(2.6, 2.4, 2.6, x, 17.2, z, 0xece4d2), box(2.8, 0.4, 2.8, x, 18.6, z, 0xd8cfbd), box(2.2, 2, 2.2, x, 19.8, z, 0xece4d2), cone(1.6, 4, x, 22.8, z, 0xd9b04a, 4), sph(0.2, x, 25, z, 0xe8c050));
    const r = v.rialto;
    for (let k = 0; k <= 10; k++) { const t = k / 10 - 0.5; P.push(box(4.8, 0.4, 0.62, r.x, 1.6 - t * t * 4.4, r.z + t * 6.2, 0xf0ebe0)); }
    P.push(box(1.4, 1.6, 2.4, r.x, 2.3, r.z, 0xece4d2), tint(hipRoof(1.8, 2.8, 0.8).translate(r.x, 3.1, r.z), 0xb8613a));
    this.add(P);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(v.canal.x1 - v.canal.x0, v.canal.z1 - v.canal.z0).rotateX(-Math.PI / 2).translate((v.canal.x0 + v.canal.x1) / 2, 0.06, (v.canal.z0 + v.canal.z1) / 2), new THREE.MeshStandardMaterial({ color: 0x2f8a96, roughness: 0.1, metalness: 0.2 }));
    this.scene.add(water);
    const gGeo = mergeGeometries([tint(new THREE.BoxGeometry(0.45, 0.22, 2.2).translate(0, 0.16, 0), 0x0d0d10), tint(new THREE.BoxGeometry(0.06, 0.4, 0.1).translate(0, 0.35, 1.05), 0x0d0d10), tint(new THREE.CylinderGeometry(0.07, 0.08, 0.36, 6).translate(0, 0.45, -0.7), 0xf2f2ee)]);
    this.gondolas = [0, 1, 2].map((k) => { const m = new THREE.Mesh(gGeo, this.mat); this.scene.add(m); return { m, t: k / 3, v: v.canal }; });
    for (const b of [...ven, pal]) { const t = topOf(b); this.add([tint(hipRoof(t.w + 0.3, t.d + 0.3, 1.2).translate(t.cx, t.y, t.cz), 0xb8613a)]); }
  }
  wynn(wynn, encore, mtn) {
    // signature scripts on top of each curve, and the wooded mountain (with its waterfall) out front
    const sig = (b, txt) => { const t = topOf(b); const s = this.sign(Math.max(5, t.d * 1.6), 1.9, this.text(txt, 'italic 600 $px "Brush Script MT", "Segoe Script", cursive', '#f6e4b8', '#ffcf80'), t.ax - 0.15, t.y - 1.4, t.cz, -Math.PI / 2, 0.9); hangOn(b, [s], b.floors - 1); };
    sig(wynn[2], 'Wynn'); sig(encore[2], 'Encore');
    const { x, z, r } = mtn, P = [];
    P.push(tint(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.75, 0.9, 1.4).translate(x, 0, z), 0x4f6a3a));
    const T = []; for (let k = 0; k < 40; k++) { const a = rand(0, 6.28), d = rand(0, r * 0.9), px = x + Math.cos(a) * d * 0.75, pz = z + Math.sin(a) * d * 1.4, h = Math.sqrt(Math.max(0, 1 - (d / r) ** 2)) * r * 0.9; T.push(tint(new THREE.ConeGeometry(0.6, 2.4, 7).translate(px, h + 1.1, pz), 0x2a4a2a)); }
    this.add([...P, ...T]);
    this.add([box(0.2, 4.5, 3, x - 4.6, 2.3, z, 0xe8f4ff)], this.neon, false);
  }
  rw(segs) {
    // Resorts World's giant LED screen down the tower face
    const t = topOf(segs[1]);
    const tex = canvasTex(64, 512, () => {});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 40).rotateY(Math.PI / 2).translate(t.bx + 0.15, 22, t.cz), new THREE.MeshBasicMaterial({ map: tex }));
    this.scene.add(m); this.rwTex = tex; hangOn(segs[1], [m]);
  }
  flamingo(fl, linq, har) {
    // the pink and orange neon front with its flamingo feathers, and the signs
    const p = fl[1];
    this.sign(7, 4, (c, w, h) => { const g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, '#ff5aa8'); g2.addColorStop(1, '#ff8a2a'); c.fillStyle = g2; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff2f8'; c.lineWidth = 6; for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(w * (0.1 + k * 0.13), h * 0.62, w * 0.05, h * 0.3, -0.4, 0, 6.28); c.stroke(); } c.fillStyle = '#fff'; c.font = `italic 700 ${h * 0.24}px Georgia, serif`; c.textAlign = 'center'; c.fillText('Flamingo', w / 2, h * 0.26); }, p.x - p.w / 2 - 0.05, 4.4, p.z, -Math.PI / 2, 1.1);
    this.sign(6, 1.2, this.text('THE LINQ', '800 $px Arial, sans-serif', '#ffffff', '#9ad7ff'), linq.x - linq.w / 2 - 0.1, linq.floors * 0.8, linq.z, -Math.PI / 2, 0.9);
    this.sign(6, 1.4, this.text("HARRAH'S", '800 italic $px Georgia, serif', '#ff3b2f', '#ff8a6a'), har[1].x - har[1].w / 2 - 0.05, 5.4, har[1].z, -Math.PI / 2, 1);
  }
  ph(segs) {
    const t = topOf(segs[1]);
    const s = this.sign(4, 3, (c, w, h) => { c.fillStyle = '#ffffff'; c.font = `900 ${h * 0.8}px Arial Black, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PH', w / 2, h / 2); }, t.ax - 0.2, t.y - 2.5, t.cz, -Math.PI / 2, 1.2);
    hangOn(segs[1], [s], segs[1].floors - 1);
    this.sign(8, 2.5, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#2a0b5a'); gr.addColorStop(1, '#0b3a6a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#7ff0ff'; c.font = `700 ${h * 0.4}px Arial`; c.textAlign = 'center'; c.fillText('MIRACLE MILE SHOPS', w / 2, h * 0.62); }, 10.9, 5.5, 2.5, -Math.PI / 2, 1);
  }
  ti(segs, lag) {
    // a pirate ship in the lagoon
    const { x, z } = lag, P = [];
    P.push(tint(new THREE.BoxGeometry(2.2, 1.4, 7).translate(x, 0.6, z), 0x4a2e1a), box(2, 0.6, 1.8, x, 1.6, z + 2.8, 0x5a3a22));
    for (const dz of [-2, 0.4, 2.2]) { P.push(cyl(0.08, 0.1, 7, x, 4.4, z + dz, 0x3a2414, 6)); P.push(box(0.08, 2.4, 2.4, x, 5.2, z + dz, 0xf0e8d8)); }
    this.add(P);
  }
  cloud(c) {
    // the Cloud: a flat white disc canopy over Fashion Show's plaza
    this.add([tint(new THREE.SphereGeometry(1, 24, 8).scale(9, 0.35, 5.5).translate(c.x, 9.5, c.z), 0xf2f2f0), ...[[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 0]].map(([dx, dz]) => cyl(0.2, 0.2, 9.4, c.x + dx * 0.9, 4.7, c.z + dz * 0.8, 0xdcdcda, 6))]);
  }
  sphere(s) {
    // Sphere: an LED skin showing a slow loop of the famous scenes (the eye, the emoji, the Earth, colour fields)
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    this.sphCtx = cv.getContext('2d'); this.sphTex = new THREE.CanvasTexture(cv); this.sphTex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.78), new THREE.MeshBasicMaterial({ map: this.sphTex }));
    m.position.set(s.x, s.r * 0.62, s.z); m.rotation.y = Math.PI; this.scene.add(m);
    this.add([cyl(s.r * 0.8, s.r * 0.83, 1.2, s.x, 0.6, s.z, 0x2a2c30, 32)]);
    this.sph = { mode: 0, t: 0, m };
    this.drawSphere(0);
  }
  drawSphere(t) {
    const c = this.sphCtx, W = 512, H = 256, k = Math.floor(t / 14) % 5, u = (t % 14) / 14;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42;
    if (k === 0) { // the eye
      c.fillStyle = '#f4f0ea'; c.beginPath(); c.ellipse(cx, cy, 120, 80, 0, 0, 6.28); c.fill();
      const lx = Math.sin(t * 0.7) * 40, ly = Math.cos(t * 0.5) * 14;
      const gr = c.createRadialGradient(cx + lx, cy + ly, 6, cx + lx, cy + ly, 46); gr.addColorStop(0, '#0a0a0a'); gr.addColorStop(0.3, '#0a0a0a'); gr.addColorStop(0.35, '#2a7ab8'); gr.addColorStop(1, '#0b3d66');
      c.fillStyle = gr; c.beginPath(); c.arc(cx + lx, cy + ly, 46, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(cx + lx - 14, cy + ly - 14, 8, 0, 6.28); c.fill();
      const blink = Math.max(0, 1 - Math.abs((t % 5) - 4.8) * 8);
      if (blink > 0) { c.fillStyle = '#c99a7a'; c.fillRect(cx - 130, cy - 90, 260, 180 * blink); }
    } else if (k === 1) { // the emoji
      c.fillStyle = '#ffcc22'; c.beginPath(); c.arc(cx, cy, 100, 0, 6.28); c.fill();
      c.fillStyle = '#3a2410'; c.beginPath(); c.ellipse(cx - 35, cy - 20, 12, 20, 0, 0, 6.28); c.ellipse(cx + 35, cy - 20, 12, 20, 0, 0, 6.28); c.fill();
      c.strokeStyle = '#3a2410'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cy + 10, 55, 0.2, Math.PI - 0.2); c.stroke();
    } else if (k === 2) { // the Earth
      const gr = c.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 110); gr.addColorStop(0, '#5fa8e8'); gr.addColorStop(1, '#0b2a6a');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 110, 0, 6.28); c.fill(); c.fillStyle = '#3f8a4a';
      for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(cx - 60 + ((i * 47 + t * 20) % 140), cy - 50 + (i * 31) % 100, 22, 14, i, 0, 6.28); c.fill(); }
    } else if (k === 3) { // colour fields sweeping round
      for (let x = 0; x < W; x += 8) { c.fillStyle = `hsl(${(x / W * 360 + t * 60) % 360},90%,55%)`; c.fillRect(x, 0, 8, H); }
    } else { // fireworks of dots
      for (let i = 0; i < 60; i++) { const a = i * 0.7 + t, r = (u * 160 + i * 3) % 160; c.fillStyle = `hsl(${(i * 37) % 360},95%,60%)`; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 5, 0, 6.28); c.fill(); }
    }
    this.sphTex.needsUpdate = true;
  }
  wheel(w) {
    // the High Roller: a white rim on spokes, 28 glass cabins, on two splayed legs
    const g2 = new THREE.Group(); g2.position.set(w.x, w.r + 3, w.z);
    const P = [tint(new THREE.TorusGeometry(w.r, 0.22, 6, 64), 0xf2f2f0), tint(new THREE.TorusGeometry(w.r - 0.6, 0.12, 6, 64), 0xe0e0e0), cyl(0.8, 0.8, 1.2, 0, 0, 0, 0xd8d8d8).rotateX(Math.PI / 2)];
    for (let k = 0; k < 28; k++) { const a = k / 28 * 6.283; const sp = new THREE.BoxGeometry(0.06, w.r, 0.06).translate(0, w.r / 2, 0).rotateZ(a); P.push(tint(sp, 0xd0d0d0)); }
    g2.add(new THREE.Mesh(mergeGeometries(P), this.metal));
    this.cabins = [];
    const cabGeo = new THREE.SphereGeometry(0.75, 10, 8).scale(1, 0.75, 0.75);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xbfe4ff, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85, emissive: 0x2a5aaa, emissiveIntensity: 0 });
    for (let k = 0; k < 28; k++) { const m = new THREE.Mesh(cabGeo, cabMat); g2.add(m); this.cabins.push(m); }
    this.cabMat = cabMat;
    this.scene.add(g2); this.wheelG = g2; this.wheelR = w.r;
    this.add([tint(new THREE.CylinderGeometry(0.35, 0.6, w.r + 3.5, 8).translate(0, (w.r + 3.5) / 2, 0).rotateX(0.18).translate(w.x, 0, w.z + 1.2), 0xe8e8e6), tint(new THREE.CylinderGeometry(0.35, 0.6, w.r + 3.5, 8).translate(0, (w.r + 3.5) / 2, 0).rotateX(-0.18).translate(w.x, 0, w.z - 1.2), 0xe8e8e6)]);
  }
  bridges() {
    // the pedestrian bridges: four at Tropicana and at Flamingo, Venetian–TI and Wynn–Fashion Show at Sands
    const P = [], G2 = [], dk = 4.6;
    const span = (x0, z0, x1, z1) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0), along = x0 === x1 ? 'z' : 'x';
      const w = 2.2;
      P.push(along === 'x' ? box(L, 0.5, w, cx, dk, cz, 0xd8d2c6) : box(w, 0.5, L, cx, dk, cz, 0xd8d2c6));
      G2.push(along === 'x' ? box(L, 1.3, 0.06, cx, dk + 0.9, cz - w / 2, 0x9fd0e8) : box(0.06, 1.3, L, cx - w / 2, dk + 0.9, cz, 0x9fd0e8));
      G2.push(along === 'x' ? box(L, 1.3, 0.06, cx, dk + 0.9, cz + w / 2, 0x9fd0e8) : box(0.06, 1.3, L, cx + w / 2, dk + 0.9, cz, 0x9fd0e8));
      P.push(along === 'x' ? box(L, 0.15, w + 0.3, cx, dk + 1.6, cz, 0xeeeae2) : box(w + 0.3, 0.15, L, cx, dk + 1.6, cz, 0xeeeae2));
      for (const [ex, ez] of [[x0, z0], [x1, z1]]) P.push(box(2.6, dk + 1.7, 2.6, ex, (dk + 1.7) / 2, ez, 0xe2dccf));
    };
    for (const [nx, nz] of [[0, 60], [0, -24]]) {
      span(-9.5, nz - 5.6, 9.5, nz - 5.6); span(-9.5, nz + 5.6, 9.5, nz + 5.6);
      span(-9.5, nz - 5.6, -9.5, nz + 5.6); span(9.5, nz - 5.6, 9.5, nz + 5.6);
    }
    span(-9.5, -81.5, 9.5, -81.5); span(-9.5, -91.8, 9.5, -91.8);
    this.add(P); this.add(G2, this.glass, false);
  }
  welcome() {
    // "Welcome to Fabulous Las Vegas", in the median south of Russell Road
    const z = 152;
    this.add([box(0.3, 4.2, 0.3, -1.6, 2.1, z, 0xd8d8d8), box(0.3, 4.2, 0.3, 1.6, 2.1, z, 0xd8d8d8)]);
    const s = this.sign(5.4, 4.4, (c, w, h) => {
      c.fillStyle = '#f4f2ea'; c.beginPath(); c.moveTo(w * 0.5, h * 0.12); c.lineTo(w * 0.98, h * 0.5); c.lineTo(w * 0.5, h * 0.88); c.lineTo(w * 0.02, h * 0.5); c.closePath(); c.fill();
      c.strokeStyle = '#d8b04a'; c.lineWidth = 8; c.stroke();
      c.fillStyle = '#d8262c'; c.font = `700 ${h * 0.07}px Arial`; c.textAlign = 'center'; c.fillText('WELCOME', w / 2, h * 0.36);
      c.fillStyle = '#1f3f8f'; c.font = `italic 700 ${h * 0.08}px Georgia`; c.fillText('Fabulous', w / 2, h * 0.47);
      c.fillStyle = '#d8262c'; c.font = `900 ${h * 0.12}px Georgia`; c.fillText('LAS VEGAS', w / 2, h * 0.61);
      c.fillStyle = '#1f3f8f'; c.font = `700 ${h * 0.06}px Arial`; c.fillText('NEVADA', w / 2, h * 0.71);
      c.fillStyle = '#d8262c'; c.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, r = k % 2 ? 0.04 : 0.09; c.lineTo(w / 2 + Math.cos(a) * r * w, h * 0.12 + Math.sin(a) * r * w); } c.fill();
    }, 0, 5.4, z + 0.16, 0, 0.7);
    s.material.side = THREE.DoubleSide;
    (this.city.crowds ||= []);
  }
  clubs(list, chapel) {
    for (const c of list) this.sign(3.2, 1, this.text("GENTLEMEN'S CLUB", '700 $px Arial', '#ff4fc8', '#ff4fc8'), c.x + 0.05, 3.2, c.z, Math.PI / 2, 1.3);
    if (chapel) {
      this.sign(3.6, 1, this.text('LITTLE WEDDING CHAPEL', '700 $px Georgia', '#d81b60', '#ff8fc0'), chapel.x + 0.05, 2.2, chapel.z, Math.PI / 2, 1);
      this.add([tint(hipRoof(3, 3, 2).translate(chapel.x - 4, 1.6, chapel.z), 0xf2f2ee), cyl(0.06, 0.06, 1.6, chapel.x - 4, 4.2, chapel.z, 0xe8e8e8)]);
    }
  }
  site(s) {
    // the ballpark dig: two tower cranes and a pit
    const P = [];
    for (const [x, z] of [[20, 76], [38, 88]]) {
      P.push(box(0.6, 26, 0.6, x, 13, z, 0xf2c230), box(16, 0.6, 0.6, x + 4, 26, z, 0xf2c230), box(2, 1.4, 1.4, x - 3, 25.6, z, 0x6a6a6a), box(0.04, 10, 0.04, x + 8, 21, z, 0x222222));
    }
    this.add(P);
  }
  // the hotels' names on their crowns, lit at night
  crowns(R) {
    // on the face toward the Strip: west-side hotels face east (+x), east-side ones face west
    const put = (b, txt, col, glow) => { const t = topOf(b), w = t.cx < 0; const s = this.sign(Math.max(4, t.d * 0.95), 1.3, this.text(txt, '700 $px Arial', col, glow), w ? t.bx + 0.12 : t.ax - 0.12, t.y - 1, t.cz, w ? Math.PI / 2 : -Math.PI / 2, 1); hangOn(b, [s], b.floors - 1); };
    put(R.park, 'PARK MGM', '#f2e6c8', '#ffd890'); put(R.luxor.zig[0], 'LUXOR', '#e8f0ff', '#9fc0ff'); put(R.excalibur.towers[0], 'EXCALIBUR', '#ffe0a0', '#ff9a50');
    put(R.ti[0], 'TI', '#ffffff', '#ff5a3a'); put(R.harrahs[0], "HARRAH'S", '#ff4a3a', '#ff8a6a'); put(R.linq, 'THE LINQ', '#ffffff', '#88ccff'); put(R.flamingo[0], 'FLAMINGO', '#ff6ab0', '#ff6ab0');
    put(R.venetian[0], 'THE VENETIAN', '#f6e8c8', '#ffd890'); put(R.palazzo, 'THE PALAZZO', '#f6e8c8', '#ffd890'); put(R.paris.tower, 'PARIS', '#ffffff', '#ffccdd');
    put(R.mgm.wings[0], 'MGM GRAND', '#f2e2a0', '#d4ffd8'); put(R.caesars.towers[1], 'CAESARS PALACE', '#f6ecd0', '#ffd890'); put(R.aria[2], 'ARIA', '#ffffff', '#cfe8ff');
    put(R.cosmo.towers[0], 'THE COSMOPOLITAN', '#ffffff', '#ff9ad6'); put(R.rw[1], 'RESORTS WORLD', '#ffffff', '#ff6a6a'); put(R.bellagio[2], 'BELLAGIO', '#f6ecd0', '#ffd890');
  }

  // ---------- the world around: development thinning into desert, the mountains, the north end of the Strip
  world(scene) {
    const r = rnd(1905);
    const Rr = (a, b) => a + r() * (b - a);
    // the valley floor out to the mountains: a big painted canvas (development, the airport, I-15, the Strip north)
    const S = 2048, SIZE = 3600, k = S / SIZE, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), P = (v) => (v + SIZE / 2) * k;
    x.fillStyle = '#c7b38f'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${pick(['96,104,64', '130,115,85', '170,150,120', '110,95,70'])},${Rr(0.1, 0.35)})`; x.fillRect(Rr(0, S), Rr(0, S), Rr(1, 3), Rr(1, 3)); }
    // the city: dense near the Strip, thinning out; streets on a mile grid
    const blob = (cx, cz, rx, rz, col) => { const g2 = x.createRadialGradient(P(cx), P(cz), 0, P(cx), P(cz), Math.max(rx, rz) * k); g2.addColorStop(0, col); g2.addColorStop(0.7, col.replace(/[\d.]+\)$/, '0.6)')); g2.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.save(); x.translate(P(cx), P(cz)); x.scale(1, rz / rx); x.translate(-P(cx), -P(cz)); x.fillStyle = g2; x.beginPath(); x.arc(P(cx), P(cz), rx * k, 0, 6.28); x.fill(); x.restore(); };
    blob(0, -150, 620, 760, 'rgba(176,168,152,1)'); blob(380, 520, 360, 300, 'rgba(184,174,156,1)');
    for (let v = -1600; v <= 1600; v += 160) { x.fillStyle = 'rgba(70,70,72,.55)'; x.fillRect(P(v) - 1, P(-900), 2.2, 1500 * k); x.fillRect(P(-700), P(v) - 1, 1500 * k, 2.2); }
    x.fillStyle = '#4a4b4d'; x.fillRect(P(-102) - 4, 0, 8, S); x.fillRect(P(-4), 0, 5, P(-150));   // I-15 and the Strip running north
    // Harry Reid airport, south-east: two pairs of runways and the terminals
    x.save(); x.translate(P(260), P(260)); x.fillStyle = '#9f9888'; x.fillRect(-200 * k, -160 * k, 420 * k, 320 * k);
    x.fillStyle = '#3e3f42'; for (const [a, b] of [[-150, -60], [-150, -20]]) x.fillRect(a * k, b * k, 340 * k, 9 * k); x.rotate(Math.PI / 2 - 0.3); for (const b of [-60, -24]) x.fillRect(-150 * k, b * k, 300 * k, 9 * k); x.restore();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    // low development around the map, thinning with distance (stucco boxes, the odd tower)
    const boxes = [];
    for (let i = 0; i < 2600; i++) {
      const bx = Rr(-900, 900), bz = Rr(-1000, 800), d = Math.hypot(bx * 0.9, (bz + 150) * 0.8);
      if (Math.max(Math.abs(bx), Math.abs(bz)) < 182 || r() > Math.exp(-d / 420)) continue;
      if (Math.abs(bx + 102) < 10) continue;
      boxes.push([bx, bz, Rr(4, 12), Rr(4, 12), r() < 0.06 ? Rr(8, 26) : Rr(1.5, 4.5)]);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), boxes.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    boxes.forEach(([bx, bz, w, d, h], i) => { m4.makeScale(w, h, d).setPosition(bx, 0, bz); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHSL(Rr(0.06, 0.12), Rr(0.15, 0.35), Rr(0.68, 0.85), THREE.SRGBColorSpace)); });
    im.receiveShadow = true; scene.add(im);
    // the north end of the Strip: Fontainebleau, the Sahara, the STRAT; downtown beyond
    const N = [];
    N.push(box(10, 66, 6, 22, 33, -175, 0x6a9ac8), box(12, 2, 8, 22, 67, -175, 0x8ab8e0));                            // Fontainebleau
    N.push(box(14, 26, 6, -26, 13, -240, 0xe8dcc8), box(8, 30, 8, -10, 15, -246, 0xe2d6c2));                           // the Sahara
    N.push(box(16, 8, 10, 120, 4, -175, 0xd8d2c6), box(30, 6, 22, 120, 3, -205, 0xbab4a8));                           // the convention centre
    const strat = [cyl(1.6, 3.2, 98, 6, 49, -330, 0xece8e0, 12), cyl(2.6, 2.6, 0.8, 6, 98, -330, 0xd8d4cc, 3)];
    for (const s of [0, 2.09, 4.19]) strat.push(tint(new THREE.BoxGeometry(1.2, 92, 3).translate(0, 46, 2.4).rotateY(s).translate(6, 0, -330), 0xece8e0));
    strat.push(cyl(6, 5, 3, 6, 101.5, -330, 0xdedad2, 20), cyl(6.4, 6.4, 1, 6, 103.5, -330, 0x7a8a9a, 20), cyl(5.4, 6, 2.2, 6, 105, -330, 0xdedad2, 20), cyl(0.4, 0.6, 14, 6, 113, -330, 0xd8d8d8, 8));
    for (let i = 0; i < 26; i++) N.push(box(Rr(6, 12), Rr(8, 40), Rr(6, 12), Rr(-60, 70), 0, Rr(-560, -470), 0xd8d0c0).translate(0, 0, 0));
    N.forEach((g3) => { g3.computeBoundingBox(); const h = g3.boundingBox.max.y - g3.boundingBox.min.y; if (g3.boundingBox.min.y < -1) g3.translate(0, h / 2, 0); });
    const north = new THREE.Mesh(mergeGeometries([...N, ...strat]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, fog: true }));
    north.castShadow = true; scene.add(north);
    this.stratTop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6).translate(6, 120.5, -330), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); scene.add(this.stratTop);
    // the mountains: a ring of ranges, hazed by distance (Red Rock and the Spring Mountains with Mt Charleston's snow
    // to the west, Frenchman and Sunrise to the east, the River and McCullough ranges to the south)
    const seg = 360, rings = 18, pos = [], cols = [], idx = [];
    const Rin = 760, Rout = 1500;
    const H = (a, rr) => {
      const deg = ((a * 180 / Math.PI) % 360 + 360) % 360;   // 0 = +x (east), 90 = +z (south), 180 = west, 270 = north
      const range = (c, w, h) => h * Math.exp(-(((deg - c + 540) % 360 - 180) ** 2) / (2 * w * w));
      let h = 30 + range(180, 40, 210) + range(215, 22, 300) + range(150, 25, 120) + range(0, 28, 140) + range(330, 30, 110) + range(80, 30, 120) + range(270, 35, 60);
      h *= 0.72 + 0.22 * Math.sin(a * 17 + rr * 0.008) * Math.sin(a * 5.3 - rr * 0.003) + 0.06 * Math.sin(a * 47 + rr * 0.02);
      return Math.max(0, h * Math.sin(Math.PI * (rr - Rin) / (Rout - Rin)));
    };
    for (let j = 0; j <= rings; j++) for (let i = 0; i <= seg; i++) {
      const a = i / seg * 6.283, rr = Rin + (Rout - Rin) * j / rings, h = H(a, rr);
      pos.push(Math.cos(a) * rr, h, Math.sin(a) * rr - 150);
      const deg = ((a * 180 / Math.PI) % 360 + 360) % 360, red = Math.exp(-(((deg - 195 + 540) % 360 - 180) ** 2) / 300) * (h < 140 ? 1 : 0);
      const cc = new THREE.Color().setHSL(0.07 - red * 0.04, 0.28 + red * 0.25, 0.42 + h / 1400 - red * 0.05, THREE.SRGBColorSpace);
      if (h > 250 && deg > 190 && deg < 250) cc.lerp(new THREE.Color(0.95, 0.96, 0.98), Math.min(1, (h - 250) / 50));
      cols.push(cc.r, cc.g, cc.b);
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); mg.setIndex(idx); mg.computeVertexNormals();
    const mm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, fog: false });
    // distance haze of its own (the scene fog would swallow them whole)
    mm.onBeforeCompile = (sh) => {
      sh.uniforms.uHaze = (this.hazeU = { value: new THREE.Color(0xd8c9b0) });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vD;').replace('#include <project_vertex>', '#include <project_vertex>\nvD = length(mvPosition.xyz);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHaze; varying float vD;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp((vD - 500.0) / 1400.0, 0.0, 0.62));');
    };
    scene.add(new THREE.Mesh(mg, mm));
  }

  // ---------- per frame
  update(dt) {
    const t = G.time, n = G.night || 0;
    if (this.hazeU && this.scene.fog) this.hazeU.value.copy(this.scene.fog.color);
    // neon and signs: bright after dark
    this.neon.color.setScalar(0.55 + n * 1.2);
    for (const m of this.signs || []) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.35 + n * 1.3);
    if (this.beam) this.beam.material.opacity = n * 0.55;
    if (this.stratTop) this.stratTop.visible = Math.sin(t * 2.4) > 0;
    if (this.torch) this.torch.material.color.setScalar(0.8 + n);
    if (this.cabMat) this.cabMat.emissiveIntensity = n * 1.2;
    // the High Roller turns (a lap takes half an hour for real; here a few minutes)
    if (this.wheelG) { const a = t * 0.02; this.cabins.forEach((m, k) => { const b = a + k / 28 * 6.283; m.position.set(Math.sin(b) * (this.wheelR + 0.4), Math.cos(b) * (this.wheelR + 0.4), 0); }); this.wheelG.children[0].rotation.z = -a; }
    // gondolas glide up and down the canal
    for (const gd of this.gondolas || []) { gd.t = (gd.t + dt * 0.02) % 1; const u = gd.t < 0.5 ? gd.t * 2 : 2 - gd.t * 2; gd.m.position.set((gd.v.x0 + gd.v.x1) / 2 + (gd.t < 0.5 ? -0.8 : 0.8), 0.05, gd.v.z0 + 1.2 + u * (gd.v.z1 - gd.v.z0 - 2.4)); gd.m.rotation.y = gd.t < 0.5 ? 0 : Math.PI; }
    // Sphere and the LED screens
    if (this.sphCtx && (this._sphT = (this._sphT || 0) - dt) <= 0) { this._sphT = 0.08; this.drawSphere(t); }
    if (this.cosmoTex && (this._cosT = (this._cosT || 0) - dt) <= 0) {
      this._cosT = 0.1; const c = this.cosmoTex.image.getContext('2d');
      for (let y = 0; y < 256; y += 8) { c.fillStyle = `hsl(${(y * 1.5 + t * 40) % 360},85%,${45 + 15 * Math.sin(y * 0.1 + t * 3)}%)`; c.fillRect(0, y, 64, 8); }
      c.fillStyle = '#fff'; c.save(); c.translate(32, 128); c.rotate(-Math.PI / 2); c.font = '700 22px Arial'; c.textAlign = 'center'; c.fillText('THE COSMOPOLITAN', 0, 8); c.restore();
      this.cosmoTex.needsUpdate = true;
    }
    if (this.rwTex && (this._rwT = (this._rwT || 0) - dt) <= 0) {
      this._rwT = 0.12; const c = this.rwTex.image.getContext('2d');
      const gr = c.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, `hsl(${(t * 20) % 360},90%,50%)`); gr.addColorStop(1, `hsl(${(t * 20 + 120) % 360},90%,40%)`);
      c.fillStyle = gr; c.fillRect(0, 0, 64, 512); c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '700 13px Arial'; c.textAlign = 'center';
      for (let y = ((t * 40) % 80) - 80; y < 512; y += 80) c.fillText('RESORTS WORLD', 32, y);
      this.rwTex.needsUpdate = true;
    }
    this.fountains(dt);
  }
  // the Bellagio fountains: quiet most of the time; every couple of minutes a show (waves, sweeps, the big shooters)
  fountains(dt) {
    const F = this.fountain; if (!F) return;
    F.t -= dt;
    if (F.t <= 0 && F.show <= 0) { F.show = 38; F.t = 75 + Math.random() * 40; F.style = Math.floor(Math.random() * 3); G.news && Math.random() < 0.3 && G.news.post('LOCAL', 'The Bellagio fountains are dancing on the Strip', 1.2, 'fountains'); }
    const on = F.show > 0; if (on) F.show -= dt;
    const t = G.time, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const fade = on ? Math.min(1, (38 - F.show) / 2, F.show / 2.5) : 0;
    for (const j of F.jets) {
      let h;
      if (!on) h = 0;
      else if (F.style === 0) h = 3 + 9 * Math.max(0, Math.sin(j.k * 0.35 - t * 3));                          // a travelling wave
      else if (F.style === 1) h = (j.row ? 4 : 10) + 6 * Math.sin(t * 1.4 + j.k * 0.1);                     // two rows breathing
      else h = (Math.sin(t * 0.9) > 0.6 && j.k % 4 === 0) ? 22 : 2.5 + 2 * Math.sin(j.k + t * 4);            // the shooters
      if (on && F.show < 6) h = Math.max(h, 18 * (F.show < 3 && j.k % 3 === 0 ? 1 : 0.5));                    // the finale
      j.h += (h * fade - j.h) * Math.min(1, dt * 6);
      const hh = Math.max(0.001, j.h);
      m4.compose(p.set(j.x, 0.05, j.z), q, s.set(1 + hh * 0.04, hh, 1 + hh * 0.04)); this.jets.setMatrixAt(j.k, m4);
      m4.compose(p.set(j.x, hh * 0.9, j.z), q, s.setScalar(hh > 0.3 ? 0.4 + hh * 0.07 : 0.001)); this.mist.setMatrixAt(j.k, m4);
    }
    this.jets.instanceMatrix.needsUpdate = true; this.mist.instanceMatrix.needsUpdate = true;
  }
}

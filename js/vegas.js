// LAS VEGAS: the Strip, in its real order. Las Vegas Boulevard runs north-south (north = -z) with its real cross
// streets (Russell, Mandalay Bay Rd/Hacienda, Tropicana, Harmon (east side only), Flamingo, Sands/Spring
// Mountain, Desert Inn), Frank Sinatra Dr behind the west side, Koval Lane and Paradise Rd behind the east side,
// I-15 further west. Distances are compressed to fit (about 1 unit = 3.5 m up, much less along the Strip), but
// every resort is on its own side of the street, in its real order, at its real corner:
//   west, south to north: Mandalay Bay | Luxor | Excalibur | Tropicana Ave | New York-New York | Park MGM | Aria |
//     Cosmopolitan | Bellagio (+ the lake and fountains) | Flamingo Rd | Caesars Palace | Treasure Island |
//     Spring Mountain Rd | Fashion Show | Resorts World | (north end) the Sahara
//   east: (Tropicana site, now the ballpark dig) | Tropicana Ave | MGM Grand | Showcase (Coca-Cola, M&M's) |
//     Harmon Ave | Planet Hollywood | Paris (+ Eiffel Tower and balloon) | Flamingo Rd | Flamingo | The LINQ |
//     Harrah's | Venetian | Palazzo | Sands Ave | Wynn | Encore | (north end) the STRAT;
//     Sphere and the High Roller east of Koval
// The gaps along the Strip are packed with casinos, shops, garages, LED screens and neon. Outside: I-15 and Las
// Vegas Boulevard run in from far out across the Mojave (Joshua trees, cacti, creosote) full of traffic, past the
// Welcome sign; a Henderson-style tract neighbourhood to the south-east; the ranges low on the far horizon.
// The resorts are ordinary destructible buildings; their dressing hangs on their cells and falls with them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { policeHQ } from './maps.js';
import { beachRadio, sfx } from './audio.js';

// the rooftop clubs' set (shuffled, every song once before any repeats)
const CLUB_SET = ['assets/club-come-get-her.mp4', 'assets/club-disco-inferno.mp4', 'assets/club-massive.mp4', 'assets/club-like-a-g6.mp4', 'assets/club-low.mp4'];
import { hsl, tint, box, cyl, cone, sph, canvasTex, hipRoof, merged, netCtx, paintNetwork, widenFor, topOf, hangOn, rnd, skinOn, pyramidTris } from './mapkit.js';
import { waterMaterial } from './water.js';

const XS = [-80, 0, 54, 104, 142], ZS = [-138, -86, -24, 16, 60, 102, 140];
const STRIP = 5.5;                       // half width of Las Vegas Boulevard (8 lanes and a median)
const W0 = -74.6, W1 = -8, E0 = 8, E1 = 48.6;   // west / east frontage lots between Sinatra, the Strip and Koval
const I15 = -102;                        // I-15 runs north-south behind the west side

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
  return pts.map(([x, z], i) => R(B, { x, z, w, d: Math.min(d, gap(i)), floors: Array.isArray(floors) ? floors[i] : floors, style, tint: Array.isArray(tnt) ? tnt[i] : tnt, cell: 1.7, ...o }));
}

// ---------- the ads: all invented brands and shows, drawn on canvases (shared by screens, billboards and trucks)
const ADS = [
  (c, w, h) => { bg(c, w, h, '#120a2a', '#3a0a5a'); stars(c, w, h); txt(c, 'THE MAGIC OF', w / 2, h * 0.24, h * 0.1, '#f2d9ff', 'Georgia'); txt(c, 'MARCO VALE', w / 2, h * 0.5, h * 0.24, '#ffd34a', 'Georgia', 'italic 900'); txt(c, 'NIGHTLY 7 & 9:30 · TICKETS NOW', w / 2, h * 0.8, h * 0.08, '#fff', 'Arial', '700'); },
  (c, w, h) => { bg(c, w, h, '#03121f', '#0b4a6a'); for (let i = 0; i < 6; i++) { c.strokeStyle = `hsla(${180 + i * 20},90%,60%,.6)`; c.lineWidth = 3; c.beginPath(); c.arc(w * 0.75, h * 0.55, 20 + i * 14, 0, 6.28); c.stroke(); } txt(c, 'CIRQUE AURORA', w * 0.4, h * 0.42, h * 0.17, '#e8faff', 'Georgia', '700'); txt(c, 'An aerial spectacle', w * 0.4, h * 0.65, h * 0.09, '#9fe8ff', 'Georgia', 'italic 400'); },
  (c, w, h) => { bg(c, w, h, '#0a0a0a', '#1a1a1a'); c.fillStyle = '#b0461a'; c.beginPath(); c.roundRect(w * 0.08, h * 0.2, w * 0.14, h * 0.7, 10); c.fill(); c.fillStyle = '#e8b04a'; c.fillRect(w * 0.1, h * 0.42, w * 0.1, h * 0.2); c.fillStyle = '#1a1a1a'; c.fillRect(w * 0.12, h * 0.1, w * 0.06, h * 0.12); txt(c, 'GOLDEN OAK', w * 0.6, h * 0.36, h * 0.2, '#e8c46a', 'Georgia', '700'); txt(c, 'KENTUCKY STRAIGHT WHISKEY', w * 0.6, h * 0.58, h * 0.07, '#f2e6c8', 'Arial', '700'); txt(c, 'Bold. Smooth. Vegas.', w * 0.6, h * 0.78, h * 0.09, '#fff', 'Georgia', 'italic 400'); },
  (c, w, h) => { bg(c, w, h, '#0d1b3d', '#1d3f8a'); txt(c, 'HURT IN A CRASH?', w * 0.38, h * 0.22, h * 0.13, '#fff', 'Arial', '900'); txt(c, 'CALL BIG TONY!', w * 0.38, h * 0.45, h * 0.16, '#ffd200', 'Arial', 'italic 900'); txt(c, '702-555-0142', w * 0.38, h * 0.72, h * 0.18, '#c8f06a', 'Arial', '900'); face(c, w * 0.83, h * 0.55, h * 0.36); },
  (c, w, h) => { bg(c, w, h, '#ffd200', '#ffb800'); txt(c, 'PLATINUM ROSE', w * 0.4, h * 0.3, h * 0.17, '#b3005e', 'Georgia', '900'); txt(c, "GENTLEMEN'S CLUB · OPEN 24/7", w * 0.4, h * 0.55, h * 0.08, '#4a0028', 'Arial', '900'); c.fillStyle = '#b3005e'; c.fillRect(0, h * 0.72, w, h * 0.2); txt(c, 'FREE LIMO · EXIT NOW', w * 0.4, h * 0.83, h * 0.09, '#fff', 'Arial', '900'); c.fillStyle = '#e83a8a'; c.beginPath(); c.ellipse(w * 0.84, h * 0.38, w * 0.06, h * 0.22, 0, 0, 6.28); c.fill(); c.beginPath(); c.arc(w * 0.84, h * 0.12, h * 0.07, 0, 6.28); c.fill(); },
  (c, w, h) => { bg(c, w, h, '#2a0505', '#6a0a0a'); txt(c, '$1.99', w * 0.3, h * 0.48, h * 0.38, '#ffe04a', 'Arial', '900'); txt(c, 'SHRIMP COCKTAIL', w * 0.72, h * 0.38, h * 0.1, '#fff', 'Arial', '900'); txt(c, '24 HOURS · DOWNTOWN', w * 0.72, h * 0.6, h * 0.07, '#ffb0a0', 'Arial', '700'); },
  (c, w, h) => { bg(c, w, h, '#000', '#200030'); for (let i = 0; i < 12; i++) { c.fillStyle = `hsl(${i * 30},100%,55%)`; c.beginPath(); c.arc(w * (0.05 + i * 0.082), h * 0.12, 6, 0, 6.28); c.fill(); c.beginPath(); c.arc(w * (0.05 + i * 0.082), h * 0.9, 6, 0, 6.28); c.fill(); } txt(c, 'LOOSEST SLOTS', w / 2, h * 0.42, h * 0.22, '#ff3bd4', 'Arial', '900'); txt(c, 'ON THE STRIP', w / 2, h * 0.66, h * 0.14, '#3bf0ff', 'Arial', '900'); },
  (c, w, h) => { bg(c, w, h, '#0a0a0a', '#30200a'); txt(c, 'DJ NOVA', w * 0.4, h * 0.38, h * 0.26, '#ffffff', 'Arial', '900'); txt(c, 'LIVE · SKYLINE POOL CLUB · SATURDAYS', w * 0.45, h * 0.68, h * 0.07, '#ffb84a', 'Arial', '700'); for (let i = 0; i < 9; i++) { c.fillStyle = `rgba(255,${150 + i * 10},60,.8)`; c.fillRect(w * 0.82 + i * 7, h * (0.7 - (i % 4) * 0.12), 5, h * (0.1 + (i % 4) * 0.12)); } },
  (c, w, h) => { bg(c, w, h, '#f4f4f0', '#dedad0'); c.fillStyle = '#c8102e'; c.fillRect(0, 0, w * 0.32, h); txt(c, 'VELVET', w * 0.16, h * 0.42, h * 0.14, '#fff', 'Georgia', '700'); txt(c, 'VODKA', w * 0.16, h * 0.6, h * 0.1, '#fff', 'Georgia', '400'); txt(c, 'Make it a night.', w * 0.66, h * 0.45, h * 0.13, '#1a1a1a', 'Georgia', 'italic 400'); txt(c, 'Drink responsibly', w * 0.66, h * 0.7, h * 0.06, '#666', 'Arial', '400'); },
  (c, w, h) => { bg(c, w, h, '#1a0f05', '#3a2408'); txt(c, 'KING OF THE CAGE', w / 2, h * 0.36, h * 0.17, '#ff5a1a', 'Arial', 'italic 900'); txt(c, 'FIGHT NIGHT · SATURDAY · LIVE', w / 2, h * 0.62, h * 0.09, '#fff', 'Arial', '900'); },
  (c, w, h) => { bg(c, w, h, '#2b0a3a', '#5a1a7a'); txt(c, 'THE COMEDY VAULT', w / 2, h * 0.36, h * 0.16, '#ffe680', 'Georgia', '900'); txt(c, 'Stand-up every night · 10PM', w / 2, h * 0.62, h * 0.09, '#fff', 'Georgia', 'italic 400'); },
  (c, w, h) => { bg(c, w, h, '#fffbe6', '#ffe9a0'); txt(c, 'BUFFET OF THE GODS', w / 2, h * 0.32, h * 0.14, '#7a2a00', 'Georgia', '900'); txt(c, 'ALL YOU CAN EAT · $39.99', w / 2, h * 0.58, h * 0.11, '#c8102e', 'Arial', '900'); },
  (c, w, h) => { bg(c, w, h, '#0b2a14', '#145a28'); txt(c, 'WE BUY GOLD', w / 2, h * 0.38, h * 0.2, '#ffd84a', 'Arial', '900'); txt(c, 'CASH ON THE SPOT · OPEN LATE', w / 2, h * 0.64, h * 0.09, '#fff', 'Arial', '700'); },
  (c, w, h) => { bg(c, w, h, '#fbe9f2', '#f7c6dc'); txt(c, 'ELVIS WEDDINGS', w / 2, h * 0.34, h * 0.16, '#c2185b', 'Georgia', '900'); txt(c, '24/7 · Drive-thru available', w / 2, h * 0.6, h * 0.09, '#5a1a3a', 'Georgia', 'italic 400'); },
  (c, w, h) => { bg(c, w, h, '#001a33', '#003a70'); txt(c, 'SKYHIGH', w * 0.36, h * 0.38, h * 0.24, '#7fe6ff', 'Arial', 'italic 900'); txt(c, 'THRILL RIDES · DOWNTOWN', w * 0.42, h * 0.66, h * 0.08, '#fff', 'Arial', '900'); c.fillStyle = '#e8e8e0'; c.fillRect(w * 0.86, h * 0.1, w * 0.03, h * 0.9); c.fillRect(w * 0.82, h * 0.18, w * 0.11, h * 0.08); },
  (c, w, h) => { bg(c, w, h, '#000', '#111'); txt(c, 'INJURED? WE FIGHT.', w * 0.4, h * 0.3, h * 0.12, '#fff', 'Arial', '900'); txt(c, 'LAWRENCE & LOPEZ', w * 0.4, h * 0.52, h * 0.13, '#ffb800', 'Georgia', '900'); txt(c, '702-555-0199 · NO FEE UNLESS WE WIN', w * 0.4, h * 0.74, h * 0.065, '#fff', 'Arial', '700'); face(c, w * 0.83, h * 0.55, h * 0.36, '#3a2a1a'); },
];
function bg(c, w, h, a, b) { const g2 = c.createLinearGradient(0, 0, w, h); g2.addColorStop(0, a); g2.addColorStop(1, b); c.fillStyle = g2; c.fillRect(0, 0, w, h); }
function txt(c, s, x, y, size, col, font = 'Arial', weight = '700') { c.font = `${weight} ${Math.round(size)}px ${font}, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y, c.canvas.width * 0.9); }
function stars(c, w, h) { for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${Math.random()})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
function face(c, x, y, r, hair = '#5a3a2a') { c.fillStyle = '#2a2a3a'; c.beginPath(); c.moveTo(x - r, y + r * 1.4); c.lineTo(x - r * 0.6, y + r * 0.5); c.lineTo(x + r * 0.6, y + r * 0.5); c.lineTo(x + r, y + r * 1.4); c.fill(); c.fillStyle = '#e8b896'; c.beginPath(); c.ellipse(x, y, r * 0.42, r * 0.52, 0, 0, 6.28); c.fill(); c.fillStyle = hair; c.beginPath(); c.ellipse(x, y - r * 0.32, r * 0.44, r * 0.25, 0, Math.PI, 0); c.fill(); c.fillStyle = '#c8102e'; c.fillRect(x - r * 0.06, y + r * 0.55, r * 0.12, r * 0.5); }
function adTex(i, W = 512, H = 256) { return canvasTex(W, H, (c, w, h) => ADS[i % ADS.length](c, w, h)); }

export function vegas(B) {
  const ctx = netCtx({
    xs: XS, zs: ZS, roadW: 6, sw: 2.4, half: 150, extent: 175, base: '#d4bd93', centerLine: 'yellow', lights: true,
    // Harmon Avenue only runs east of the Strip; Frank Sinatra Drive stops at Sands / Spring Mountain
    // the east end's streets stop at the suburb (its own little street grid)
    skipEdge: (a, b) => (a.z === 16 && b.z === 16 && Math.min(a.x, b.x) < 0) || (a.x === -80 && b.x === -80 && Math.min(a.z, b.z) < -86) || (Math.min(a.x, b.x) >= 104 && Math.max(a.x, b.x) >= 142 && Math.min(a.z, b.z) >= 60 && Math.max(a.z, b.z) > 60) || (a.x === 142 && b.x === 142 && Math.min(a.z, b.z) >= 60),
  }, B);
  const { city, g } = ctx;
  city.mapKind = 'vegas';
  city.named = []; city.crowds = []; city.stationed = [];
  const V = (city.vegas = { resorts: {}, pylons: [], screens: [], neon: [], roofs: [], clubs: [] });
  const keep = [];                        // footprints kept clear of filler (lakes, statues, plazas, drives)
  const clear = (x0, x1, z0, z1) => keep.push({ x0, x1, z0, z1 });
  const name = (S, o, x0, x1, z0, z1) => city.named.push({ S, o, x0, x1, z0, z1 });
  // vehicles: yellow-and-black and white cabs, stretch limos, white tour coaches and the double-decker Deuce
  city.vehicles = { taxi: { p: 0.24, colors: [0xf2c230, 0xf2c230, 0xf4f4f0, 0x1c1c1e, 0xe8e0c8] }, limo: { p: 0.07, colors: [0xf4f4f2, 0x0e0e10, 0x0e0e10] },
    bus: { p: 0.07, kinds: [{ color: 0xf4f4f0 }, { color: 0xf4f4f0 }, { color: 0xb3141c, h: 2.5, len: 2.9 }] }, moto: 0.06 };
  city.palette = { shirts: [0xffffff, 0x0e0e10, 0xff8fa3, 0x4fc3f7, 0xfff176, 0xe8e4dc, 0xb3141c, 0x81c784, 0x1f2a44, 0xf28c28, 0xba68c8, 0x2b2d33], sleeves: 0.6 };

  // ---------- the ground: valley desert, the developed blocks, I-15, the Strip and its streets
  g.rect(-175, -175, 175, 175, '#d4bd93');
  for (let i = 0; i < 2600; i++) g.circle(rand(-175, 175), rand(-175, 175), rand(0.15, 0.6), `rgba(${pick(['120,112,70', '170,140,100', '190,160,120'])},${rand(0.15, 0.35)})`);
  g.rect(-92, -175, 175, 175, '#bcae96'); g.grainRect(-92, -175, 175, 175, 0.2, 40);
  // I-15: eight lanes and shoulders, the median barrier
  g.rect(I15 - 8, -175, I15 + 8, 175, '#46474a'); g.rect(I15 - 0.3, -175, I15 + 0.3, 175, '#bdb8ac');
  for (const x of [-6, -4, -2, 2, 4, 6]) g.line(I15 + x, -175, I15 + x, 175, 0.08, 'rgba(240,240,235,.7)', [1, 1.6]);
  for (const x of [-7.6, 7.6]) g.line(I15 + x, -175, I15 + x, 175, 0.1, 'rgba(240,240,235,.8)');
  paintNetwork(g, city, {
    width: (A, Bn) => (A.x === 0 && Bn.x === 0 ? STRIP * 2 : city.roadW),
    median: (A, Bn) => (A.x === 0 && Bn.x === 0 ? 1.3 : 0),
    stubs: (N) => [N.x === XS[0] && N.z !== 16 ? { axis: 'x', to: I15 } : null, N.x === XS[4] && N.z < 60 ? { axis: 'x', to: 175 } : null, N.z === ZS[0] ? { axis: 'z', to: -175, w: N.x === 0 ? STRIP * 2 : 6 } : null, N.z === ZS[6] ? { axis: 'z', to: 175, w: N.x === 0 ? STRIP * 2 : 6 } : null].filter(Boolean),
  });
  widenFor(city, 'x', 0, STRIP);
  for (const b of city.blocks) city.paintSidewalk(g, b, '#cfc8bc');
  for (const b of city.blocks) city.lampsAlongBlock(b, 8);
  for (let z = -170; z < 172; z += 6) if (!ZS.some((zz) => Math.abs(z - zz) < 6)) city.addTree(rand(-0.25, 0.25), z, 1.2, 'palm');

  const lot = (x0, z0, x1, z1, c = '#a49d91') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.2, 30); };
  const pool = (x0, z0, x1, z1) => { g.rect(x0 - 0.8, z0 - 0.8, x1 + 0.8, z1 + 0.8, '#e6dccb'); g.rect(x0, z0, x1, z1, '#3fc3d8'); g.rect(x0 + 0.3, z0 + 0.3, x1 - 0.3, z1 - 0.3, '#5fd6e6'); (city.pools ||= []).push({ x0, z0, x1, z1 }); city.crowds.push({ x: (x0 + x1) / 2, z: z1 + 0.5, r: 1.2, n: 6, look: 'swim' }); };
  const palmsAlong = (x0, z0, x1, z1, step = 4) => { for (let t = 0; t <= 1.0001; t += step / Math.max(1, Math.hypot(x1 - x0, z1 - z0))) city.addTree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 1.1, 'palm'); };
  // a porte-cochère drive off the Strip with a cab line, valets and doormen
  const driveway = (side, z, look = 'valet') => {
    const x = side * 10.5;
    g.rect(Math.min(x, side * 8.5), z - 2.6, Math.max(x, side * 8.5) + side * 6, z + 2.6, '#5c5a57');
    for (let k = 0; k < 3; k++) city.parked.push({ x: x + side * (1.2 + k * 1.5), z: z - 1.2, rot: Math.PI / 2 });
    city.crowds.push({ x: x + side * 4.6, z: z + 1.4, r: 0.6, n: 2, look }, { x: x + side * 2.6, z: z + 1.5, r: 0.7, n: 4, look: 'tourist' });
    clear(Math.min(x, side * 8.5) - 0.5, Math.max(x, side * 8.5) + side * 6 + 0.5 * side, z - 3, z + 3);
    if (side < 0) keep[keep.length - 1] = { x0: x - 6.5, x1: -8, z0: z - 3, z1: z + 3 }; else keep[keep.length - 1] = { x0: 8, x1: x + 6.5, z0: z - 3, z1: z + 3 };
  };
  // a casino's pylon sign by the Strip: the name, an LED screen, a chase of bulbs
  const pylon = (x, z, name2, col, glow, h = 9) => { V.pylons.push({ x, z, name: name2, col, glow, h }); clear(x - 1.2, x + 1.2, z - 2.6, z + 2.6); };
  // the Strip sidewalks: tourists, people filming, groups heading out for the night
  const strip = (side, z0, z1, every = 2.1) => {
    for (let z = z0; z < z1; z += every) if (!ZS.some((zz) => Math.abs(z - zz) < 4)) city.crowds.push({ x: side * rand(6.2, 8.2), z: z + rand(-1, 1), r: 0.75, n: Math.round(rand(3, 7)), look: Math.random() < 0.3 ? 'nightlife' : 'tourist', act: Math.random() < 0.25 ? 'film' : null, face: Math.random() < 0.25 ? { x: -side * 30, z } : null });
  };
  strip(-1, -132, 134); strip(1, -132, 134);
  // street performers on the Strip, each with a ring of people watching (and filming) the show
  for (const [x, z, look] of [[-7.4, 1, 'performer'], [7.4, -4, 'elvis'], [-7.4, -27.5, 'showgirl'], [7.4, -44, 'performer'], [-7.4, 46, 'performer'], [7.4, 40, 'busker'], [-7.4, -70, 'performer'], [7.4, -64, 'elvis'],
    [-7.4, 88, 'performer'], [7.4, 18.5, 'performer'], [-7.4, -100, 'busker'], [7.4, -120, 'performer'], [7.4, -27.5, 'showgirl'], [-7.4, 12, 'elvis'], [24, -47.6, 'performer'], [36, -47.6, 'busker']]) {
    city.crowds.push({ x, z, r: 0.25, n: 1, look, act: look === 'busker' ? 'dance' : 'trick', stay: true });
    city.crowds.push({ x, z, r: 2.1, n: Math.round(rand(9, 15)), look: 'tourist', act: 'spect', stay: true });
  }
  city.wanderZones.push({ x0: -8.4, x1: -6, z0: -132, z1: 134 }, { x0: 6, x1: 8.4, z0: -132, z1: 134 });

  // ===== WEST SIDE =====
  // Mandalay Bay: the gold Y, three stepped wings round a core, its beach behind
  {
    lot(W0, 107.4, W1, 134.6);
    const gold = hsl(0.115, 0.62, 0.56), cx = -40, cz = 121;
    const core = R(B, { x: cx, z: cz, w: 6.4, d: 6.4, floors: 45, style: 'office', tint: gold });
    const wings = [];
    [[-33.8, 121, 6, 4.4, 43], [-27.8, 121, 6, 4.4, 40], [-21.8, 121, 6, 4.4, 35]].forEach(([x, z, w, d, f]) => wings.push(R(B, { x, z, w, d, floors: f, style: 'office', tint: gold })));
    for (const s of [-1, 1]) [[1, 43], [2, 40], [3, 36]].forEach(([k, f]) => wings.push(R(B, { x: cx - 1 - 4.4 * k, z: cz + s * (1 + 4.4 * k), w: 4.4, d: 4.4, floors: f, style: 'office', tint: gold })));
    const pod = R(B, { x: -14, z: 120, w: 8, d: 18, floors: 3, style: 'stucco', tint: hsl(0.1, 0.25, 0.8), cell: 2 });
    pool(-72, 110, -58, 120); g.rect(-73, 121, -58, 132, '#e7d7b0'); pool(-72, 124, -62, 131);
    palmsAlong(-73, 109, -73, 133, 3); palmsAlong(-57, 111, -57, 132, 4);
    driveway(-1, 129.5);
    pylon(-9.6, 110.5, 'MANDALAY BAY', '#ffd98a', '#ffb84a', 10);
    V.resorts.mandalay = { core, wings, pod };
    V.roofs.push({ b: pod, kind: 'pool' });
    name('Mandalay Bay', 'Mandalay Bay', W0, W1, 107.4, 134.6);
  }
  // Luxor: a true black glass pyramid (the sphinx and obelisk out front, the beam at night), stepped towers behind
  {
    lot(W0, 80, W1, 96.6, '#b3a68e');
    const black = hsl(0.6, 0.2, 0.1), cell = 1.6, base = 16, apex = 19.5, nx = Math.round(base / cell);
    // the inner core steps in so it always stays inside the glass skin
    const sb = []; const fl = 12, gh = 1.2, fh = 1.05;
    for (let f = 0; f < fl; f++) { const yTop = gh + f * fh + fh, skin = (base / 2 + 0.25) * (1 - yTop / apex) - 0.3; sb.push({ f, n: Math.max(0, Math.min(Math.floor((nx - 1) / 2), Math.ceil(nx / 2 - skin / cell))) }); }
    const pyr = R(B, { x: -38, z: 88.5, w: base, d: base, floors: fl, style: 'office', tint: black, cell, gh, fh, setbacks: sb, exact: true });
    const zig = [];
    for (const z of [83, 93]) zig.push(R(B, { x: -63.5, z, w: 13, d: 6.6, floors: 22, style: 'office', tint: hsl(0.6, 0.15, 0.12), cell: 1.75, setbacks: [{ f: 8, n: 1 }, { f: 15, n: 2 }] }));
    g.rect(-27, 81, -9, 95.6, '#d8c9a4');
    V.resorts.luxor = { pyr, zig, base, apex, sphinx: { x: -19.5, z: 88.5 }, obelisk: { x: -11.5, z: 82.5 } };
    clear(-29, -8, 80, 96.6);
    city.crowds.push({ x: -12.5, z: 85.5, r: 1.2, n: 6, look: 'tourist', act: 'film', face: { x: -19.5, z: 88.5 } });
    pylon(-9.6, 94.6, 'LUXOR', '#e8f0ff', '#9fc0ff');
    name('Luxor', 'the Luxor', W0, W1, 80, 96.6);
  }
  // Excalibur: two white towers with red-roofed turrets and blue corner roofs either side of the fairy-tale castle
  {
    lot(W0, 65.4, W1, 78.5, '#b7ab96');
    const white = hsl(0.1, 0.1, 0.94);
    const towers = [R(B, { x: -50, z: 67.6, w: 28, d: 3.6, floors: 28, style: 'stucco', tint: white, cell: 1.75 }), R(B, { x: -50, z: 76.4, w: 28, d: 3.6, floors: 28, style: 'stucco', tint: white, cell: 1.75 })];
    const castle = R(B, { x: -23, z: 72, w: 20, d: 8.4, floors: 4, style: 'stucco', tint: hsl(0.1, 0.08, 0.92), cell: 2.1, gh: 2 });
    V.resorts.excalibur = { towers, castle };
    pylon(-9.6, 72.5, 'EXCALIBUR', '#fff0c0', '#ff6a2a', 9);
    clear(-34, -8, 65.4, 78.5);
    name('Excalibur', 'the Excalibur', W0, W1, 65.4, 78.5);
  }
  // New York-New York: the Manhattan skyline in miniature, the Statue of Liberty and Brooklyn Bridge on the corner
  {
    lot(W0, 35, W1, 54.6, '#a69e90');
    const T = (x, z, w, d, f, c, sb, st = 'concrete') => R(B, { x, z, w, d, floors: f, style: st, tint: c, cell: 1.5, setbacks: sb });
    const esb = R(B, { x: -31, z: 45, w: 5.4, d: 5.4, floors: 46, style: 'concrete', tint: hsl(0.1, 0.22, 0.82), cell: 1.35, setbacks: [{ f: 18, n: 1 }, { f: 38, n: 2 }] });
    const chrysler = R(B, { x: -40, z: 40.5, w: 4.2, d: 4.2, floors: 40, style: 'concrete', tint: hsl(0.1, 0.18, 0.84), cell: 1.4, setbacks: [{ f: 30, n: 1 }] });
    const rest = [T(-43, 50, 4.4, 4.6, 30, hsl(0.04, 0.55, 0.42)), T(-36, 50.8, 4, 3.6, 34, hsl(0.07, 0.55, 0.6)), T(-24, 50.6, 4.4, 4, 25, hsl(0.42, 0.3, 0.3), [{ f: 20, n: 1 }], 'office'),
      T(-46, 41, 3.6, 4, 27, hsl(0.07, 0.6, 0.55)), T(-24, 39, 4, 4.4, 31, hsl(0.09, 0.45, 0.66), [{ f: 24, n: 1 }]), T(-34.4, 37.6, 3.4, 3.4, 22, hsl(0.58, 0.25, 0.35), null, 'office')];
    const street = R(B, { x: -15.5, z: 42.5, w: 6, d: 11, floors: 3, style: 'brick', tint: hsl(0.06, 0.35, 0.62), cell: 1.6, gh: 1.6, storefront: true });
    V.resorts.nyny = { esb, chrysler, rest, street, liberty: { x: -12, z: 50.6 }, bridge: { x: -10.2, z0: 36, z1: 47 } };
    clear(-14, -8, 48, 57);
    city.crowds.push({ x: -9.2, z: 49, r: 1, n: 5, look: 'tourist', act: 'film', face: { x: -12, z: 50.6 } });
    pylon(-9.6, 36.2, 'NEW YORK-NEW YORK', '#ffffff', '#ff4a3a', 9);
    name('New York-New York', 'New York-New York', W0, W1, 35, 54.6);
  }
  // Park MGM, with T-Mobile Arena behind
  {
    lot(W0, 26.5, W1, 34);
    V.resorts.park = R(B, { x: -28, z: 30.3, w: 22, d: 4.2, floors: 32, style: 'concrete', tint: hsl(0.08, 0.12, 0.8), cell: 1.75 });
    R(B, { x: -61, z: 30, w: 16, d: 8, floors: 5, style: 'office', tint: hsl(0.58, 0.08, 0.6), cell: 2.6, gh: 2 });
    name('Park MGM', 'Park MGM', W0, W1, 26.5, 34);
  }
  // Aria (set back, curved glass) and the Cosmopolitan's twin towers right on the Strip
  {
    lot(W0, 6.5, W1, 26, '#a39d93');
    const glass = hsl(0.57, 0.14, 0.66);
    V.resorts.aria = arcSlab(B, [[-58, 9.5], [-55, 13.5], [-53, 17.5], [-55, 21.5]], 6, 4.2, [46, 50, 50, 46], 'office', glass);
    const blk = hsl(0.62, 0.25, 0.16);
    const cosmo = [R(B, { x: -21, z: 10.5, w: 5, d: 5, floors: 52, style: 'office', tint: blk, cell: 1.65 }), R(B, { x: -21, z: 19, w: 5, d: 5, floors: 50, style: 'office', tint: blk, cell: 1.65 })];
    const pod = R(B, { x: -13, z: 14.8, w: 6, d: 14, floors: 4, style: 'office', tint: hsl(0.62, 0.1, 0.3), cell: 1.8, gh: 2 });
    V.resorts.cosmo = { towers: cosmo, pod };
    V.roofs.push({ b: pod, kind: 'club', name: 'MARQUEE' });
    city.crowds.push({ x: -9.6, z: 22, r: 0.9, n: 6, look: 'nightlife' }, { x: -9.6, z: 9, r: 0.8, n: 5, look: 'nightlife' });
    name('The Cosmopolitan', 'the Cosmopolitan', -28, W1, 6.5, 26); name('Aria', 'Aria', W0, -28, 6.5, 26);
  }
  // Bellagio: the curved cream tower with its cupola behind the lake; Italian villas round the water; the fountains
  {
    lot(W0, -18.6, W1, 5, '#b1a891');
    const cream = hsl(0.1, 0.34, 0.84);
    V.resorts.bellagio = arcSlab(B, [[-44, -16], [-47, -11.5], [-49, -7], [-47, -2.5], [-44, 2]], 5.4, 4.8, [33, 36, 37, 36, 33], 'concrete', cream);
    const villas = [R(B, { x: -35.5, z: -7, w: 4, d: 20, floors: 3, style: 'stucco', tint: hsl(0.06, 0.35, 0.82), cell: 2 }), R(B, { x: -24, z: 4.2, w: 13, d: 1.6, floors: 2, style: 'stucco', tint: hsl(0.07, 0.4, 0.8), cell: 1.6 })];
    g.rect(-33.5, -17.6, -9.2, 3.4, '#e9e2d2');
    V.lake = { x0: -32.6, x1: -9.9, z0: -17, z1: 2.8 };
    clear(-34, -8, -18.6, 5);
    for (let z = -16.5; z < 3; z += 2.2) city.crowds.push({ x: -8.7, z, r: 0.5, n: 3, look: 'tourist', act: Math.random() < 0.5 ? 'film' : null, face: { x: -20, z } });
    V.villas = villas;
    pool(-72, -16, -60, -6);
    pylon(-9.6, 4.2, 'BELLAGIO', '#f6ecd0', '#ffd890', 9);
    name('Bellagio', 'the Bellagio', W0, W1, -18.6, 5);
  }
  // Caesars Palace: white towers with their pediment crowns, the temple front and fountains, domes, cypresses, the Colosseum
  {
    lot(W0, -63, W1, -29.4, '#b4ab98');
    const white = hsl(0.1, 0.12, 0.92);
    const towers = [R(B, { x: -58, z: -52, w: 5, d: 18, floors: 26, style: 'concrete', tint: white, cell: 1.7 }), R(B, { x: -45, z: -58, w: 16, d: 4.6, floors: 29, style: 'concrete', tint: white, cell: 1.7 }),
      R(B, { x: -40, z: -42, w: 12, d: 4.6, floors: 24, style: 'concrete', tint: hsl(0.1, 0.15, 0.88), cell: 1.7 }), R(B, { x: -64, z: -36, w: 12, d: 4.6, floors: 22, style: 'concrete', tint: white, cell: 1.7 })];
    const forum = R(B, { x: -26, z: -56, w: 12, d: 10, floors: 4, style: 'stucco', tint: hsl(0.09, 0.15, 0.88), cell: 2 });
    V.resorts.caesars = { towers, forum, temple: { x: -13.5, z: -45 }, colosseum: { x: -27, z: -37 } };
    clear(-19, -8, -63, -29.4); clear(-33, -21, -43, -31);
    pool(-56, -42, -48, -34);
    city.crowds.push({ x: -9.2, z: -40, r: 0.7, n: 3, look: 'showgirl', act: 'dance', stay: true }, { x: -9.2, z: -53, r: 0.6, n: 2, look: 'elvis' }, { x: -10, z: -46, r: 1, n: 5, look: 'tourist', act: 'film', face: { x: -13.5, z: -45 } });
    pylon(-9.6, -36, 'CAESARS PALACE', '#fff2d0', '#ff4a3a', 10);
    name('Caesars Palace', 'Caesars Palace', W0, W1, -63, -29.4);
  }
  // Treasure Island: the curved red tower and its lagoon with the pirate ship; the giant round LED screen on the corner
  {
    lot(W0, -80.6, W1, -64, '#ada38f');
    V.resorts.ti = [R(B, { x: -40, z: -73, w: 14, d: 4.4, floors: 36, style: 'concrete', tint: hsl(0.02, 0.45, 0.45), cell: 1.7 }), R(B, { x: -30, z: -69, w: 4.4, d: 8, floors: 34, style: 'concrete', tint: hsl(0.02, 0.45, 0.45), cell: 1.7 })];
    g.rect(-22, -74, -9.2, -66, '#2d7f8e'); V.lagoon = { x: -15.5, z: -70 };
    V.exhibit = { x: -13.2, z: -76.4, r: 3.0 };
    clear(-23, -8, -80.6, -65);
    name('Treasure Island', 'Treasure Island', W0, W1, -80.6, -64);
  }
  // north of Spring Mountain: Fashion Show (the Cloud), Resorts World; the Sahara at the north end
  {
    lot(W0, -106, W1, -91.4);
    R(B, { x: -40, z: -99, w: 40, d: 12, floors: 4, style: 'stucco', tint: hsl(0.1, 0.08, 0.9), cell: 2.6, gh: 2 });
    V.cloud = { x: -14, z: -98.5 }; clear(-20, -8, -104, -93);
    name('Fashion Show', 'Fashion Show mall', W0, W1, -106, -91.4);
    lot(W0, -132.6, W1, -107.5, '#a89e8d');
    const red = hsl(0.01, 0.6, 0.36);
    V.resorts.rw = arcSlab(B, [[-42, -126], [-38, -121.5], [-35, -117], [-38, -112.5]], 6, 4.4, [50, 54, 54, 50], 'office', red);
    R(B, { x: -18, z: -120, w: 12, d: 22, floors: 4, style: 'office', tint: hsl(0.02, 0.3, 0.3), cell: 2.2, gh: 2 });
    pylon(-9.6, -108.6, 'RESORTS WORLD', '#ffffff', '#ff5a5a', 10);
    name('Resorts World', 'Resorts World', W0, W1, -132.6, -107.5);
    lot(W0, -175, W1, -141.4, '#a89e8d');
    V.sahara = [R(B, { x: -40, z: -158, w: 24, d: 5, floors: 26, style: 'concrete', tint: hsl(0.1, 0.15, 0.9), cell: 1.8 }), R(B, { x: -20, z: -158, w: 14, d: 10, floors: 4, style: 'stucco', tint: hsl(0.08, 0.3, 0.82), cell: 2.2 })];
    pylon(-9.6, -146, 'SAHARA', '#ffe6b0', '#ffb84a', 9);
    name('The Sahara', 'the Sahara', W0, W1, -175, -141.4);
  }

  // ===== EAST SIDE =====
  // south of Tropicana: the old Tropicana site, now a dig for the ballpark
  {
    g.rect(E0, 65.4, E1, 96.6, '#a38c6a'); g.grainRect(E0, 65.4, E1, 96.6, 0.35, 40);
    for (let k = 0; k < 40; k++) g.circle(rand(E0 + 2, E1 - 2), rand(67, 95), rand(0.5, 2), 'rgba(90,70,50,.25)');
    for (let x = E0 + 0.5; x < E1; x += 1) { city.addProp('chainlink', x, 65.8, 0); city.addProp('chainlink', x, 96.2, 0); }
    for (let k = 0; k < 4; k++) city.parked.push({ x: rand(E0 + 6, E1 - 6), z: rand(70, 92), rot: rand(0, 6) });
    V.site = { x0: E0, x1: E1, z0: 65.4, z1: 96.6 }; clear(E0, E1, 65.4, 96.6);
    // the stadium's concrete going up: a horseshoe of decks at different stages round the field
    V.siteParts = [];
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * 0.15 + k * (Math.PI * 1.7 / 8), r = 12.5, x = 29 + Math.cos(a) * r, z = 81 + Math.sin(a) * r * 0.9;
      const sp = B.add({ x, z, w: 5.6, d: 5.6, floors: [2, 3, 4, 4, 3, 4, 2, 3, 1][k], style: 'site', tint: hsl(0.1, 0.04, 0.72), cell: 1.9, gh: 1.6, fh: 1.2 }); sp.noSigns = true; sp.landmark = true; V.siteParts.push(sp);
    }
    name('The ballpark site', 'the ballpark construction site', E0, E1, 65.4, 96.6);
    lot(E0, 107.4, E1, 134.6, '#bcae95');
  }
  // MGM Grand: the emerald tower (four wings in a cross), the gold lion on the corner, the arena behind
  {
    lot(E0, 27.6, E1, 54.6, '#a59d90');
    const em = hsl(0.42, 0.6, 0.36);
    const wings = [R(B, { x: 33.5, z: 41, w: 5.4, d: 25, floors: 30, style: 'office', tint: em, cell: 1.8 }),
      R(B, { x: 24.5, z: 41, w: 12.6, d: 5, floors: 30, style: 'office', tint: em, cell: 1.8 }), R(B, { x: 42.4, z: 41, w: 12.4, d: 5, floors: 30, style: 'office', tint: em, cell: 1.8 })];
    const pod = R(B, { x: 19.5, z: 50.4, w: 11, d: 7.2, floors: 4, style: 'office', tint: hsl(0.42, 0.3, 0.45), cell: 2, gh: 2 });
    R(B, { x: 44, z: 50, w: 8, d: 8, floors: 5, style: 'concrete', tint: hsl(0.1, 0.08, 0.8), cell: 2.6, gh: 2 });
    V.resorts.mgm = { wings, pod, lion: { x: 11.5, z: 49.4 } };
    V.roofs.push({ b: pod, kind: 'pool' });
    clear(8, 14, 46, 57);
    city.crowds.push({ x: 9.4, z: 45.6, r: 1, n: 4, look: 'tourist', act: 'film', face: { x: 11.5, z: 49.4 } });
    driveway(1, 33);
    pylon(9.6, 29.6, 'MGM GRAND', '#f2e2a0', '#5aff8a', 10);
    name('MGM Grand', 'the MGM Grand', E0, E1, 27.6, 54.6);
    // the Showcase: the Coca-Cola store's giant bottle set into its glass front, M&M's World next door
    lot(E0, 21.4, E1, 27);
    V.showcase = R(B, { x: 25, z: 24.2, w: 22, d: 5.4, floors: 4, style: 'office', tint: hsl(0.55, 0.08, 0.72), cell: 2 });
    V.coke = { x: 13.3, z: 24.2 }; clear(8, 14.5, 21.4, 27);
    name("M&M'S World", "M&M'S World", E0, E1, 21.4, 27);
  }
  // Planet Hollywood: the white tower with its dark glass centre, gold letters on top, the Miracle Mile in front
  {
    lot(E0, -6, E1, 10.6, '#a29b8f');
    V.resorts.ph = arcSlab(B, [[40, -3.2], [37.5, 1.5], [40, 6.2]], 6, 4.6, [38, 41, 38], 'concrete', [hsl(0.1, 0.18, 0.9), hsl(0.6, 0.12, 0.16), hsl(0.1, 0.18, 0.9)]);
    const pod = R(B, { x: 21, z: 2.5, w: 16, d: 13, floors: 3, style: 'office', tint: hsl(0.6, 0.15, 0.32), cell: 2.2, gh: 2 });
    V.roofs.push({ b: pod, kind: 'club', name: 'SKYLINE' });
    city.crowds.push({ x: 9.8, z: 6, r: 0.8, n: 5, look: 'nightlife' });
    pylon(9.6, 9.2, 'PLANET HOLLYWOOD', '#ffffff', '#ff3bd4', 9);
    name('Planet Hollywood', 'Planet Hollywood', E0, E1, -6, 10.6);
  }
  // Paris: the Eiffel Tower on the Strip (its legs down into the casino), the Hôtel de Ville tower, the balloon
  {
    lot(E0, -18.6, E1, -6.8, '#b0a690');
    const tower = R(B, { x: 40, z: -12.7, w: 12, d: 7.6, floors: 33, style: 'concrete', tint: hsl(0.1, 0.34, 0.84), cell: 1.7 });
    R(B, { x: 29, z: -12.7, w: 6, d: 10, floors: 4, style: 'stucco', tint: hsl(0.04, 0.4, 0.84), cell: 2.2, gh: 2 });
    V.resorts.paris = { tower, eiffel: { x: 18, z: -12.7 }, balloon: { x: 10.8, z: -3.6 } };
    clear(8, 25.8, -19, -6.4); clear(8, 14, -6.5, -0.8);
    city.crowds.push({ x: 9.6, z: -17, r: 0.9, n: 5, look: 'tourist', act: 'film', face: { x: 18, z: -12.7 } }, { x: 9.4, z: -9, r: 0.6, n: 2, look: 'elvis' });
    name('Paris Las Vegas', 'Paris Las Vegas', E0, E1, -18.6, -6.8);
  }
  // Flamingo, the LINQ (and its promenade to the High Roller), Harrah's
  {
    lot(E0, -38, E1, -29.4, '#b3a493');
    const fl = [R(B, { x: 33, z: -34, w: 20, d: 4.4, floors: 28, style: 'stucco', tint: hsl(0.97, 0.35, 0.86), cell: 1.7 }), R(B, { x: 17, z: -33.6, w: 9, d: 7, floors: 4, style: 'stucco', tint: hsl(0.96, 0.45, 0.78), cell: 2 })];
    V.resorts.flamingo = fl; V.roofs.push({ b: fl[1], kind: 'pool' });
    city.crowds.push({ x: 9.4, z: -32, r: 0.7, n: 3, look: 'showgirl', act: 'dance', stay: true });
    pylon(9.6, -35, 'FLAMINGO', '#ff6ab0', '#ff3b8a', 9);
    name('Flamingo', 'the Flamingo', E0, E1, -38, -29.4);
    lot(E0, -46, E1, -39);
    V.resorts.linq = R(B, { x: 33, z: -42.5, w: 20, d: 4.4, floors: 30, style: 'office', tint: hsl(0.08, 0.15, 0.7), cell: 1.7 });
    g.rect(E0, -49, 60, -46.2, '#cbbfae'); for (let x = 12; x < 56; x += 4) g.line(x, -49, x + 2, -46.2, 0.05, 'rgba(0,0,0,.12)');
    clear(8, 52, -49.2, -46);
    city.wanderZones.push({ x0: 10, x1: 52, z0: -48.8, z1: -46.4 }); city.crowds.push({ x: 26, z: -47.6, r: 1, n: 7, look: 'tourist', act: 'mix' }, { x: 40, z: -47.5, r: 1, n: 6, look: 'nightlife', act: 'mix' });
    name('The LINQ', 'the LINQ', E0, E1, -49, -39);
    lot(E0, -57, E1, -49.5);
    const hr = [R(B, { x: 32, z: -53.4, w: 22, d: 4.6, floors: 35, style: 'concrete', tint: hsl(0.07, 0.4, 0.72), cell: 1.7 }), R(B, { x: 15, z: -53, w: 10, d: 7, floors: 4, style: 'stucco', tint: hsl(0.03, 0.55, 0.55), cell: 2 })];
    V.resorts.harrahs = hr; V.roofs.push({ b: hr[1], kind: 'club', name: 'CARNAVAL' });
    pylon(9.6, -50.4, "HARRAH'S", '#ff4a3a', '#ffd34a', 9);
    name("Harrah's", "Harrah's", E0, E1, -57, -49.5);
  }
  // the Venetian (campanile, Doge's palace, the canal and Rialto bridge) and the Palazzo
  {
    lot(E0, -71, E1, -58, '#b5aa94');
    const cream = hsl(0.09, 0.32, 0.8);
    V.resorts.venetian = [R(B, { x: 36, z: -67.8, w: 20, d: 4.4, floors: 36, style: 'concrete', tint: cream, cell: 1.7 }), R(B, { x: 43.6, z: -61.6, w: 4.6, d: 8, floors: 36, style: 'concrete', tint: cream, cell: 1.7 })];
    R(B, { x: 20, z: -64.5, w: 6, d: 11, floors: 3, style: 'stucco', tint: hsl(0.02, 0.35, 0.82), cell: 2 });
    g.rect(9.2, -70.4, 14.4, -58.6, '#2f8a96');
    V.venice = { campanile: { x: 15.8, z: -59.6 }, canal: { x0: 9.6, x1: 14, z0: -70, z1: -59 }, rialto: { x: 11.8, z: -66 } };
    clear(8, 17.5, -71, -58);
    city.crowds.push({ x: 15.6, z: -66, r: 0.8, n: 4, look: 'tourist', act: 'film', face: { x: 11.8, z: -66 } });
    pylon(9.6, -57.6, 'THE VENETIAN', '#f6e8c8', '#ffd890', 10);
    name('The Venetian', 'the Venetian', E0, E1, -71, -58);
    lot(E0, -80.6, E1, -72);
    V.resorts.palazzo = R(B, { x: 33, z: -76.3, w: 22, d: 5.4, floors: 50, style: 'concrete', tint: hsl(0.09, 0.3, 0.72), cell: 1.8, setbacks: [{ f: 40, n: 1 }, { f: 46, n: 2 }] });
    name('The Palazzo', 'the Palazzo', E0, E1, -80.6, -72);
  }
  // Wynn and Encore: two bronze curves; Wynn's shops and a fountain court out front
  {
    lot(E0, -110.5, E1, -91.4, '#a9a08f');
    const bronze = hsl(0.075, 0.45, 0.4);
    V.resorts.wynn = arcSlab(B, [[26, -93.5], [29.5, -97.5], [31.5, -101], [29.5, -104.5], [26, -108.5]], 6, 4.4, [42, 45, 45, 45, 42], 'office', bronze);
    const pod = R(B, { x: 15, z: -101, w: 8, d: 16, floors: 3, style: 'stucco', tint: hsl(0.07, 0.35, 0.78), cell: 2.2, gh: 2 });
    V.roofs.push({ b: pod, kind: 'club', name: 'XS' });
    pylon(9.6, -97, 'Wynn', '#f6e4b8', '#ffcf80', 10);
    name('Wynn Las Vegas', 'Wynn Las Vegas', E0, E1, -110.5, -91.4);
    lot(E0, -132.6, E1, -111.5);
    V.resorts.encore = arcSlab(B, [[26, -114.5], [29.5, -118.5], [31.5, -122], [29.5, -125.5], [26, -129.5]], 5.6, 4.2, [45, 48, 48, 48, 45], 'office', bronze);
    city.crowds.push({ x: 10, z: -118, r: 0.9, n: 6, look: 'nightlife' });
    driveway(1, -127);
    name('Encore', 'Encore', E0, E1, -132.6, -111.5);
    lot(E0, -175, E1, -141.4, '#a9a08f');
  }
  // ---- east of Koval: Sphere, the High Roller, the police
  {
    lot(59.4, -80.6, 98.6, -56, '#a6a093');
    V.sphere = { x: 79, z: -68, r: 12.5 };
    city.crowds.push({ x: 64, z: -60, r: 1.2, n: 7, look: 'tourist', act: 'film', face: { x: 79, z: -68 } });
    name('Sphere', 'the Sphere', 64, 94, -80, -56);
    lot(59.4, -50, 98.6, -29.4);
    V.wheel = { x: 66, z: -46, r: 15 };
    name('The High Roller', 'the High Roller', 52, 80, -50, -40);
    const hq = city.blocks.find((b) => b.i === 2 && b.j === 3);
    if (hq) { city.paintSidewalk(g, hq); policeHQ(ctx, hq); }
  }
  // the blocks off the Strip: mid-rise hotels, apartments, garages, motels; the odd strip club
  const used = (b) => b.i === 0 || b.i === 1 || b.i === 3 || (b.i === 2 && (b.j === 3 || b.j === 1));
  const clubNames = ['STRIP CLUB', 'STRIP CLUB', 'STRIP CLUB', 'STRIP CLUB'];
  let nClub = 0;
  for (const b of city.blocks) {
    if (used(b)) continue;
    lot(b.lx0, b.lz0, b.lx1, b.lz1);
    const n = Math.floor((b.lx1 - b.lx0) / 10);
    for (let k = 0; k < n; k++) {
      const x = b.lx0 + 5 + k * 10;
      for (const z of [b.lz0 + 5, b.lz1 - 5]) if (Math.random() < 0.85) {
        const tall = Math.random() < 0.3, st = tall ? pick(['office', 'concrete']) : 'stucco';
        const bb = B.add({ x, z, w: rand(6, 8.5), d: rand(5, 7), floors: tall ? Math.round(rand(10, 24)) : Math.round(rand(2, 5)), style: st, tint: st === 'stucco' ? hsl(rand(0.05, 0.12), rand(0.2, 0.45), rand(0.72, 0.88)) : hsl(rand(0.05, 0.6), 0.12, rand(0.55, 0.8)), cell: 2.2, gh: 1.5 });
        if (tall) bb.noSigns = true;
        if (!tall && nClub < 3 && Math.random() < 0.12) { V.clubs.push({ x: x - 4.3 * Math.sign(x || 1) * 0, z: z + (z < (b.lz0 + b.lz1) / 2 ? -3.6 : 3.6), name: clubNames[nClub++], b: bb, face: z < (b.lz0 + b.lz1) / 2 ? Math.PI : 0 }); }
      }
    }
    const spots = city.paintParking(g, b.lx0 + 1, (b.lz0 + b.lz1) / 2 - 3, b.lx1 - 1, (b.lz0 + b.lz1) / 2 + 3);
    for (const s of spots) if (Math.random() < 0.55) city.parked.push(s);
    for (let x = b.x0 + 3; x < b.x1 - 2; x += 6) { city.addTree(x, b.z0 + 1.2, 1, 'palm'); city.addTree(x, b.z1 - 1.2, 1, 'palm'); }
  }
  // Industrial Road, between Sinatra and I-15: gentlemen's clubs, a wedding chapel, warehouses, billboards
  {
    for (let z = -150; z < 160; z += 10) {
      if (ZS.some((zz) => Math.abs(z - zz) < 6)) continue;
      const club = (z > 20 && z < 44) || (z > -110 && z < -100), chapel = z > -62 && z < -50;
      const b = B.add({ x: -87.5, z, w: 7.5, d: 8, floors: club ? 2 : chapel ? 1 : Math.round(rand(1, 3)), style: 'stucco', tint: club ? hsl(0.85, 0.15, 0.22) : chapel ? hsl(0.95, 0.15, 0.95) : hsl(rand(0.06, 0.12), 0.15, rand(0.6, 0.78)), cell: 2.6, gh: 1.6, storefront: false });
      b.noSigns = !club;
      if (club) V.clubs.push({ x: -83.7, z, name: clubNames[(nClub++) % clubNames.length], b, face: Math.PI / 2 });
      if (chapel) V.chapel = { x: -83.7, z, b };
    }
  }
  for (const c of V.clubs) {
    const fx = Math.sin(c.face), fz = Math.cos(c.face);
    city.crowds.push({ x: c.x + fx * 1.4, z: c.z + fz * 1.4 + 1.6, r: 0.8, n: 5, look: 'nightlife' }, { x: c.x + fx * 1.2, z: c.z + fz * 1.2 - 2, r: 0.4, n: 1, look: 'security', stay: true }, { x: c.x + fx * 1.0, z: c.z + fz * 1.0, r: 0.3, n: 1, look: 'showgirl', act: 'pole', stay: true });
    city.parked.push({ x: c.x + fx * 4, z: c.z + fz * 4 + 3, rot: c.face });
  }
  // a Henderson-style tract neighbourhood out to the south-east: stucco, tile roofs, block walls, palms
  {
    g.rect(108, 60, 175, 175, '#c8b896');
    const park = { x0: 128, x1: 150, z0: 136, z1: 158 };
    city.paintGrass(g, park.x0, park.z0, park.x1, park.z1, '#6f8a46');
    (city.lawns ||= []).push({ x0: park.x0 + 1, x1: park.x1 - 1, z0: park.z0 + 1, z1: park.z1 - 1, name: 'the park' });
    for (let k = 0; k < 10; k++) city.addTree(rand(park.x0 + 1, park.x1 - 1), pick([park.z0 + 1, park.z1 - 1]), 1, pick(['palm', 'round']));
    city.dogArea = { x0: 108, x1: 175, z0: 60, z1: 175 };
    for (let z = 66; z < 172; z += 13) {
      g.rect(108, z - 1.6, 175, z + 1.6, '#5a5b5e');
      city.wanderZones.push({ x0: 110, x1: 172, z0: z - 2.4, z1: z - 1.8 }, { x0: 110, x1: 172, z0: z + 1.8, z1: z + 2.4 });
      (V.bikeRows ||= []).push(z);
      for (let k = 0; k < 2; k++) city.crowds.push({ x: rand(114, 170), z: z + pick([-2.2, 2.2]), r: 0.6, n: Math.round(rand(2, 3)), look: pick(['tourist', 'commuter']) });
      for (let x = 112; x < 172; x += 6.2) for (const s of [-1, 1]) {
        const hz = z + s * 5;
        if (hz > 172 || (x > park.x0 - 2 && x < park.x1 + 2 && hz > park.z0 - 2 && hz < park.z1 + 2)) continue;
        B.add({ x, z: hz, w: 4.4, d: 4.6, floors: 1 + (Math.random() < 0.3), style: 'house', tint: hsl(rand(0.07, 0.12), rand(0.25, 0.45), rand(0.74, 0.86)), cell: 2.2, fh: 0.95, gh: 1, gable: true, roofTint: hsl(rand(0.03, 0.06), 0.45, rand(0.38, 0.48)) });
        if (Math.random() < 0.4) city.addTree(x + 2.6, hz + s * 1.5, 0.9, 'palm');
      }
    }
    for (let x = 108; x < 175; x += 22) g.rect(x - 1.6, 60, x + 1.6, 175, '#5a5b5e');
  }

  // ---- the east end, past Paradise Road: the city's darker side. Small locals' casinos, 7-Elevens, gentlemen's clubs,
  // pay-by-the-week motels, pawn and liquor and check-cashing; alleys behind with dumpsters and graffiti, vacant lots
  // behind chain-link where people are living in tents
  {
    const D = (V.dark = { lots: [], alleys: [], tents: [], carts: [], dumpsters: [], graffiti: [] });
    const dirty = () => hsl(rand(0.02, 0.12), rand(0.08, 0.28), rand(0.38, 0.58));
    const strips = [];                          // [x of the street front, building direction (+1 = east), z0, z1]
    for (const b of city.blocks) if (b.i === 3 && b.j <= 3) {
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#8a8378'); g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.4, 30);
      const mid = (b.lx0 + b.lx1) / 2;
      g.rect(mid - 1.6, b.lz0, mid + 1.6, b.lz1, '#49484a'); D.alleys.push({ x: mid, z0: b.lz0, z1: b.lz1 });     // the alley
      strips.push([b.lx0, 1, b.lz0, b.lz1, mid - 1.8], [b.lx1, -1, b.lz0, b.lz1, mid + 1.8]);
    }
    // east of the last street, out to the edge of town
    g.rect(147.4, -175, 175, 56.6, '#8a8378'); g.grainRect(147.4, -175, 175, 56.6, 0.4, 30);
    g.rect(162.4, -175, 165.6, 56.6, '#49484a'); D.alleys.push({ x: 164, z0: -172, z1: 56 });
    strips.push([147.4, 1, -172, 56.6, 162]);
    for (let i = 0; i < 260; i++) g.circle(rand(105, 175), rand(-175, 58), rand(0.2, 1.4), `rgba(${pick(['30,28,26', '60,50,40', '90,80,60'])},${rand(0.1, 0.3)})`);   // stains, oil, litter
    const KINDS = ['711', 'casino', 'club', 'motel', 'shop', 'shop', 'shop', 'vacant', 'casino', 'shop', 'vacant', '711', 'club'];
    const casinoNames = ['LUCKY 7 CASINO', 'SILVER SPUR', 'HOT SHOE CASINO', 'WILD ACE', 'DOUBLE DOWN', 'GOLDEN BUCK'];
    const clubNames2 = ['STRIP CLUB'];
    const motelNames = ['DESERT ROSE MOTEL', 'STARLITE MOTEL', 'EL RANCHO INN', 'WEEKLY RATES MOTEL'];
    let ki = Math.floor(rand(0, KINDS.length));
    for (const [xf, dir, z0, z1, xBack] of strips) {
      const depth = Math.abs(xBack - xf) - 0.6;
      for (let z = z0 + 0.6; z < z1 - 3;) {
        const kind = KINDS[ki++ % KINDS.length];
        const w = kind === '711' ? 9 : kind === 'casino' ? 11 : kind === 'club' ? 9 : kind === 'motel' ? 12 : kind === 'vacant' ? rand(7, 10) : rand(4, 6);
        if (z + w > z1 - 0.4) break;
        const zc = z + w / 2, ry = dir > 0 ? -Math.PI / 2 : Math.PI / 2;   // the front faces the street
        const at = (dd) => xf + dir * dd;                                    // dd units back from the street
        const lotD = { kind, x: xf, dir, z: zc, w, ry };
        if (kind === 'vacant') {
          g.rect(Math.min(xf, at(depth)), z, Math.max(xf, at(depth)), z + w, '#9a8a6e');
          for (let zz = z + 0.4; zz < z + w; zz += 1) city.addProp('chainlink', at(0.3), zz, Math.PI / 2);
          for (let k = 0; k < Math.round(rand(2, 4)); k++) D.tents.push({ x: at(rand(2, depth - 1.5)), z: rand(z + 1, z + w - 1), ry: rand(0, 6), col: pick([0x2a5a8a, 0x3a6a3a, 0x8a3a2a, 0x6a6a6a, 0xc8a030]) });
          D.carts.push({ x: at(rand(1.5, depth - 1)), z: rand(z + 1, z + w - 1), ry: rand(0, 6) });
          city.crowds.push({ x: at(depth * 0.5), z: zc, r: 1.4, n: Math.round(rand(2, 4)), look: 'homeless', act: 'sit', stay: true });
        } else {
          const floors = kind === 'casino' ? 2 : kind === 'motel' ? 2 : kind === 'club' ? 1 : Math.round(rand(1, 2));
          const bd = kind === '711' ? 5.5 : Math.min(depth, kind === 'motel' ? 6 : 7.5);
          const off = kind === '711' ? depth - bd / 2 - 0.2 : bd / 2 + 0.2;
          const tintC = kind === 'club' ? hsl(0.03, 0.55, 0.42) : kind === '711' ? hsl(0.04, 0.45, 0.4) : kind === 'casino' ? hsl(rand(0, 1), 0.3, 0.45) : dirty();
          const bb = B.add({ x: at(off), z: zc, w: bd, d: w - 0.3, floors, style: kind === '711' || kind === 'shop' ? 'brick' : 'stucco', tint: tintC, cell: 2, gh: kind === 'club' ? 2.4 : 1.6, storefront: kind === 'shop' });
          bb.noSigns = kind !== 'shop';
          lotD.b = bb; lotD.front = at(off - bd / 2);
          if (kind === '711') {
            const p0 = Math.min(xf, at(depth - bd)), p1 = Math.max(xf, at(depth - bd));
            const sp = city.paintParking(g, p0 + 0.2, z + 0.3, p1 - 0.2, z + w - 0.3);
            for (const q of sp) if (Math.random() < 0.4) city.parked.push(q);
            city.crowds.push({ x: at(depth - bd - 1), z: zc + rand(-2, 2), r: 0.8, n: Math.round(rand(2, 4)), look: Math.random() < 0.5 ? 'homeless' : 'tourist' });
          } else if (kind === 'casino' || kind === 'club') {
            V.neon.push({ b: bb, side: -dir, col: kind === 'club' ? '#ff3bd4' : pick(['#ffd34a', '#3bf0ff', '#ff5a3a']), scr: true });
            city.crowds.push({ x: at(-0.9), z: zc, r: 0.8, n: Math.round(rand(2, 5)), look: kind === 'club' ? 'nightlife' : 'tourist' });
            if (kind === 'club') city.crowds.push({ x: at(-0.6), z: zc + w / 2 - 1, r: 0.3, n: 1, look: 'security', stay: true });
            lotD.name = kind === 'club' ? pick(clubNames2) : pick(casinoNames);
          } else if (kind === 'motel') {
            lotD.name = pick(motelNames);
            city.crowds.push({ x: at(-0.8), z: zc - 2, r: 0.6, n: 2, look: 'homeless', act: Math.random() < 0.5 ? 'sit' : null });
          }
          // the back of every building: a dumpster, tags on the wall, someone sleeping rough now and then
          if (Math.random() < 0.6) D.dumpsters.push({ x: at(depth + 0.2), z: zc + rand(-w / 3, w / 3) });
          if (Math.random() < 0.7) D.graffiti.push({ x: at(off + bd / 2) + dir * 0.06, z: zc, ry: dir > 0 ? Math.PI / 2 : -Math.PI / 2, w: Math.min(w - 1, 6) });
          if (Math.random() < 0.35) city.crowds.push({ x: at(depth + 0.4), z: zc + rand(-w / 3, w / 3), r: 0.5, n: Math.round(rand(1, 3)), look: 'homeless', act: 'sit', stay: true });
        }
        D.lots.push(lotD);
        z += w + rand(0.2, 1.2);
      }
    }
    for (const a2 of D.alleys) for (let k = 0; k < 3; k++) D.tents.push({ x: a2.x + rand(-1, 1), z: rand(a2.z0 + 3, a2.z1 - 3), ry: rand(0, 6), col: pick([0x2a5a8a, 0x3a6a3a, 0x6a6a6a]) });
    city.stationed.push({ x: 106.6, z: -40, rot: 0, quiet: true });
    city.crowds.push({ x: 107.2, z: -37, r: 0.5, n: 2, look: 'lvmpd' });
    name('East Las Vegas', 'east Las Vegas', 104, 175, -175, 60);
  }
  for (const nz of [60, -24]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) clear(sx < 0 ? -12 : 8, sx < 0 ? -8 : 12, nz + sz * 3 - (sz < 0 ? 4.6 : 0), nz + sz * 3 + (sz > 0 ? 4.6 : 0));
  for (const z of [-81.5, -91.8]) clear(-12, 12, z - 2.4, z + 2.4);
  // ---- packing the Strip: casinos, shops and LED walls fill every gap along both frontages; garages and towers behind
  const overlaps = (x0, x1, z0, z1) => B.list.some((b) => x0 < b.x + b.w / 2 + 0.4 && x1 > b.x - b.w / 2 - 0.4 && z0 < b.z + b.d / 2 + 0.4 && z1 > b.z - b.d / 2 - 0.4) || keep.some((k) => x0 < k.x1 && x1 > k.x0 && z0 < k.z1 && z1 > k.z0);
  const fillers = ['casino', 'shops', 'casino', 'show', 'shops'];
  for (const side of [-1, 1]) for (let z = -170; z < 136; z += 6.4) {
    if (ZS.some((zz) => Math.abs(z - zz) < 7.5)) continue;
    const x0 = side < 0 ? -15 : 8.6, x1 = side < 0 ? -8.6 : 15, z0 = z - 3, z1 = z + 3;
    if (side > 0 && z > 60 && z < 100) continue;              // the ballpark dig
    if (overlaps(x0, x1, z0, z1)) continue;
    const kind = pick(fillers), f = kind === 'show' ? 3 : Math.round(rand(2, 4));
    const b = B.add({ x: (x0 + x1) / 2, z, w: 6.2, d: 6, floors: f, style: pick(['stucco', 'office', 'concrete']), tint: hsl(rand(0, 1), rand(0.2, 0.5), rand(0.55, 0.8)), cell: 2, gh: 2, storefront: true });
    V.neon.push({ b, side, col: pick(['#ff3bd4', '#3bf0ff', '#ffd34a', '#ff5a3a', '#7aff5a', '#b06aff']), get scr() { return scr; } });
    const scr = f >= 3 && Math.random() < 0.6;
    if (scr) V.screens.push({ x: side < 0 ? -8.5 : 8.5, z, y: f + 1 - 1.3, w: 5, h: 2.2, ry: side < 0 ? Math.PI / 2 : -Math.PI / 2, b });
    if (Math.random() < 0.3) V.roofs.push({ b, kind: Math.random() < 0.5 ? 'pool' : 'club' });
    city.crowds.push({ x: side * 9.2, z: z + rand(-2, 2), r: 0.6, n: Math.round(rand(2, 5)), look: kind === 'show' ? 'nightlife' : 'tourist' });
  }
  for (const [xa, xb] of [[W0 + 3, -17], [17, E1 - 3]]) for (let z = -170; z < 132; z += 7.5) for (let x = xa; x < xb; x += 8) {
    if (ZS.some((zz) => Math.abs(z - zz) < 6.5) || (x > 0 && z > 60 && z < 100)) continue;
    if (overlaps(x - 3, x + 3, z - 3, z + 3) || Math.random() < 0.25) continue;
    const garage = Math.random() < 0.4;
    const b = B.add({ x, z, w: rand(5, 6.5), d: rand(5, 6.5), floors: garage ? Math.round(rand(4, 7)) : Math.round(rand(6, 18)), style: garage ? 'concrete' : pick(['office', 'concrete', 'stucco']), tint: garage ? hsl(0.1, 0.05, rand(0.62, 0.74)) : hsl(rand(0, 1), rand(0.1, 0.3), rand(0.6, 0.85)), cell: 2.2, gh: 1.6 });
    b.noSigns = true;
    if (!garage && Math.random() < 0.35) V.roofs.push({ b, kind: 'pool' });
  }

  // neon on every low casino front along the Strip (not just the fillers), and lit crowns on the resort towers
  const hasNeon = new Set(V.neon.map((n) => n.b));
  for (const b of B.list) {
    if (hasNeon.has(b) || Math.abs(b.x) > 34 || b.z > 140 || b.z < -170 || b.style === 'house') continue;
    if (b.floors <= 6) V.neon.push({ b, side: b.x < 0 ? -1 : 1, col: pick(['#ff3bd4', '#3bf0ff', '#ffd34a', '#ff5a3a', '#ffe8b0', '#b06aff']), scr: true });
    else if (b.landmark) (V.crownLit ||= []).push(b);
  }
  // police posted on the Strip (bridges, the fountains)
  for (const [x, z] of [[-6.8, 58], [6.8, -22], [-6.8, -6], [6.8, -84]]) { city.stationed.push({ x: x * 1.25, z: z + 4, rot: 0, quiet: true }); city.crowds.push({ x: x * 1.12, z: z + 2, r: 0.5, n: 2, look: 'lvmpd' }); }
  // rooftop terraces: who's up there (the dressing comes later, in the Vegas class)
  for (const r of V.roofs) {
    const top = r.b.cells.filter((c) => c.f === r.b.floors - 1); if (!top.length) continue;
    const y = top[0].y + top[0].hy, x = r.b.x, z = r.b.z;
    r.y = y;
    if (r.kind === 'club') { city.crowds.push({ x, z, r: Math.min(r.b.w, r.b.d) * 0.36, n: Math.round(Math.min(34, r.b.w * r.b.d * 0.3)), y, look: 'nightlife', act: 'dance', stay: true }); city.crowds.push({ x: x + r.b.w * 0.3, z: z - r.b.d * 0.3, r: 0.3, n: 1, y, look: 'showgirl', act: 'pole', stay: true }); }
    else city.crowds.push({ x, z: z + r.b.d * 0.25, r: Math.min(r.b.w, r.b.d) * 0.25, n: Math.round(Math.min(9, r.b.w * r.b.d * 0.08)), y, look: 'swim', act: Math.random() < 0.5 ? 'dance' : null, stay: true });
  }
  city.hotspot = { x: 0, z: -10, r: 70 };
  city.side = 1;
  return { ...ctx, agents: { cars: 112, peds: 640, wanderFrac: 0.16 }, fog: 0xe2d2b6, start: { x: 0, z: -4 }, zMin: -168, zMax: 150, xMin: -100, maxD: 230, yaw: 0.42, ownBackdrop: true };
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
    this.clearGlass = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
    this.neon = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.signs = []; this.screenMats = [];
    // a few ad reels shared by every LED screen (each changes ad every few seconds)
    this.reels = [0, 1, 2, 3].map((k) => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return { cv, t, i: k * 4, next: k * 1.7 }; });
    for (const r of this.reels) this.drawReel(r);
    const R = V.resorts;
    this.mandalay(R.mandalay); this.luxor(R.luxor); this.excalibur(R.excalibur); this.nyny(R.nyny);
    this.mgm(R.mgm, V.coke, V.showcase); this.cosmo(R.cosmo); this.bellagio(R.bellagio, V.lake, V.villas); this.paris(R.paris); this.caesars(R.caesars);
    this.venice(R.venetian, R.palazzo, V.venice); this.wynn(R.wynn, R.encore); this.rw(R.rw); this.flamingo(R.flamingo, R.linq, R.harrahs);
    this.ph(R.ph); this.ti(R.ti, V.lagoon, V.exhibit); this.cloud(V.cloud); this.sphere(V.sphere); this.wheel(V.wheel); this.bridges(); this.welcome();
    this.clubs(V.clubs || [], V.chapel); this.site(V.site); this.crowns(R); this.saharaSign(V.sahara);
    this.dark(V.dark); this.bikes(V.bikeRows || []); this.girls(V); this.bigSigns(V);
    this.pylons(V.pylons); this.screens(V.screens); this.neonEdges(V.neon); this.rooftops(V.roofs); this.crownLights(V.crownLit || []);
    this.world(scene);
  }
  add(geos, mat = this.mat, shadow = true) { return merged(geos, mat, this.scene, shadow); }
  // a canvas sign as a plane (lit at night)
  sign(w, h, draw, x, y, z, ry = 0, glow = 0.6, ds = false) {
    const tex = canvasTex(Math.max(16, Math.round(w * 64)), Math.max(16, Math.round(h * 64)), draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, transparent: true, alphaTest: 0.05, roughness: 0.5, side: ds ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); this.signs.push(m.material); return m;
  }
  text(txt2, font, fill, glow) { return (x, w, h) => { x.font = font.replace('$', Math.round(h * 0.72)); x.textAlign = 'center'; x.textBaseline = 'middle'; if (glow) { x.shadowColor = glow; x.shadowBlur = h * 0.25; } x.fillStyle = fill; x.fillText(txt2, w / 2, h * 0.54, w * 0.96); }; }
  // an LED screen showing one of the ad reels
  screen(w, h, x, y, z, ry, reel = 0) {
    const mat = new THREE.MeshBasicMaterial({ map: this.reels[reel % this.reels.length].t, toneMapped: false });
    this.screenMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); return m;
  }
  drawReel(r) {
    const c = r.cv.getContext('2d'); ADS[r.i % ADS.length](c, 512, 256);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let y = 0; y < 256; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }   // LED rows
    r.t.needsUpdate = true;
  }

  mandalay(r) {
    const t = topOf(r.core);
    this.add([box(t.w + 0.4, 1.4, t.d + 0.4, t.cx, t.y + 0.7, t.cz, 0xd9b45a)], this.metal);
    const s = this.sign(7, 1.5, this.text('MANDALAY BAY', '600 $px Georgia, serif', '#fff3c8', '#ffcc66'), t.cx + t.w / 2 + 0.3, t.y - 1.2, t.cz, Math.PI / 2, 0.9);
    hangOn(r.core, [s], r.core.floors - 1);
  }
  luxor(r) {
    // the pyramid itself: smooth black glass from the ground to the apex, each panel falling with the floor behind it
    const P0 = r.pyr, apexY = r.apex;
    const tileTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#0d1016'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a3442'; c.lineWidth = 2; for (let k = 0; k <= w; k += 16) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(w, k); c.stroke(); } });
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    const skin = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTex, vertexColors: true, roughness: 0.1, metalness: 0.8, envMapIntensity: 1.5, side: THREE.DoubleSide });
    const tris = pyramidTris(P0.x, P0.z, r.base / 2 + 0.25, 0.01, 0, apexY, 8);
    // planar uvs so the glass tiles run across each face
    skinOn(this.scene, P0, tris, 0x9aa4b4, skin);
    this.scene.traverse((o) => { if (o.material === skin && o.geometry && !o.geometry.attributes.uv) { const p = o.geometry.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + p.getZ(i)) * 0.25; uv[i * 2 + 1] = p.getY(i) * 0.35; } o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); } });
    // the beam: a narrow shaft of white-blue light straight up out of the apex, after dark
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 2.2, 1100, 14, 1, true).translate(P0.x, apexY + 550, P0.z), beamMat);
    this.beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.5, 1100, 8, 1, true).translate(P0.x, apexY + 550, P0.z), beamMat.clone());
    this.beamGlow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12).translate(P0.x, apexY, P0.z), beamMat.clone());
    for (const m of [this.beam, this.beamCore, this.beamGlow]) { this.scene.add(m); hangOn(P0, [m], P0.floors - 1); }
    // the sphinx, cream stone, facing the Strip; the obelisk
    const { x, z } = r.sphinx, sand = 0xe2d2b0, P = [];
    P.push(box(8, 2.2, 3.4, x, 1.1, z, sand), box(3, 1, 0.9, x + 5, 0.5, z - 1, sand), box(3, 1, 0.9, x + 5, 0.5, z + 1, sand));
    P.push(box(2.6, 3, 3, x + 2.8, 3.6, z, sand), box(1.5, 1.6, 1.7, x + 4.3, 3.9, z, 0xecdcbc), box(0.5, 0.6, 0.7, x + 5.2, 3.6, z, sand));
    P.push(box(0.7, 3.6, 3.6, x + 2.2, 4.1, z, 0xdcc89c), box(0.9, 1, 0.7, x + 2.1, 5.6, z, 0xd9b45a));
    P.push(box(7, 0.5, 6.4, x - 0.5, 0.25, z, 0xc8b38a));
    const o = r.obelisk; P.push(box(1.1, 10, 1.1, o.x, 5.3, o.z, 0xd8c8a8), cone(0.8, 1.2, o.x, 10.9, o.z, 0xd9b45a, 4), box(2, 0.6, 2, o.x, 0.3, o.z, 0xb8a888));
    this.add(P);
    for (const zg of r.zig) { const t2 = topOf(zg); this.add([box(t2.w, 0.4, t2.d, t2.cx, t2.y + 0.2, t2.cz, 0x1a222c)], this.glass); }
  }
  excalibur(r) {
    // the castle: white keeps of every height under red, blue and gold cones; battlements; the drawbridge gate
    const c = r.castle, P = [], top = topOf(c).y, rnd2 = rnd(77);
    const roofs = [0xd83a1a, 0x2a52c8, 0xe8a41a, 0xe86a1a];
    const keepAt = (x, z, rad, h, k) => { P.push(cyl(rad, rad, h, x, h / 2, z, 0xf4f1ea, 14), cyl(rad * 1.12, rad * 1.12, 0.5, x, h + 0.1, z, 0xece6da, 14)); for (let a = 0; a < 6.28; a += 0.7) P.push(box(0.28, 0.4, 0.28, x + Math.cos(a) * rad * 1.05, h + 0.55, z + Math.sin(a) * rad * 1.05, 0xece6da)); P.push(cone(rad * 1.25, rad * 3.4, x, h + 0.35 + rad * 1.7, z, roofs[k % 4], 14)); };
    const spots = [[-30, 68.5, 1.3, 13], [-30, 75.5, 1.3, 13], [-25, 72, 1.6, 17], [-21, 69, 1.0, 12], [-21, 75, 1.0, 12], [-17, 72, 1.2, 10], [-27, 69.6, 0.8, 11], [-27, 74.4, 0.8, 11], [-14, 68.4, 0.8, 7], [-14, 75.6, 0.8, 7], [-19, 72, 0.9, 14], [-33, 72, 1.1, 10]];
    spots.forEach(([x, z, rad, h], k) => keepAt(x, z, rad, h, k + Math.floor(rnd2() * 4)));
    P.push(box(2.4, 3.6, 3.2, c.x + c.w / 2 + 0.6, 1.8, c.z, 0xf0ebe0), box(0.2, 2.2, 1.8, c.x + c.w / 2 + 1.85, 1.1, c.z, 0x3a2a1a));
    const m = this.add(P); hangOn(c, [m], 0);
    // the towers: blue-roofed corner turrets on top, a row of small red-roofed turrets along the base
    for (const t of r.towers) {
      const tt = topOf(t), Q = [];
      for (const ex of [tt.ax + 1, tt.bx - 1]) { Q.push(box(2, 2.4, tt.d + 0.6, ex, tt.y + 1.2, tt.cz, 0xf4f1ea)); Q.push(tint(hipRoof(2.4, tt.d + 1, 2.6).translate(ex, tt.y + 2.4, tt.cz), 0x2a52c8)); }
      for (let x = tt.ax + 1; x < tt.bx; x += 2.4) for (const dz of [-1, 1]) Q.push(cyl(0.3, 0.3, 2.6, x, 1.3 + 3, tt.cz + dz * (tt.d / 2 + 0.3), 0xf4f1ea, 8), cone(0.42, 1.2, x, 5.2, tt.cz + dz * (tt.d / 2 + 0.3), 0xc82a1a, 8));
      hangOn(t, [this.add(Q)]);
    }
  }
  nyny(r) {
    // the Empire State's lit spire, the Chrysler's stainless sunburst crown, Liberty on her pedestal, the bridge
    const e = topOf(r.esb);
    const sp = this.add([box(e.w * 0.6, 2.2, e.d * 0.6, e.cx, e.y + 1.1, e.cz, 0xe8e2d0), box(e.w * 0.4, 1.6, e.d * 0.4, e.cx, e.y + 2.9, e.cz, 0xe8e2d0), cyl(0.35, 0.5, 2.6, e.cx, e.y + 4.9, e.cz, 0xf2f2f2), cyl(0.05, 0.15, 4, e.cx, e.y + 8.2, e.cz, 0xd0d0d0)], this.metal); hangOn(r.esb, [sp], r.esb.floors - 1);
    const c = topOf(r.chrysler), P = [];
    for (let k = 0; k < 7; k++) { const rr = c.w * 0.58 * (1 - k * 0.13); P.push(tint(new THREE.SphereGeometry(rr, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1).translate(c.cx, c.y + k * 1.05, c.cz), 0xe9ecf0)); for (let a = 0; a < 6.28; a += 1.05) P.push(tint(new THREE.ConeGeometry(0.12, 0.5, 3).translate(c.cx + Math.cos(a) * rr * 0.8, c.y + k * 1.05 + rr * 0.55, c.cz + Math.sin(a) * rr * 0.8), 0x2a2e36)); }
    P.push(cyl(0.04, 0.2, 5, c.cx, c.y + 9.5, c.cz, 0xe6e8ec, 6));
    hangOn(r.chrysler, [this.add(P, this.metal)], r.chrysler.floors - 1);
    // the Statue of Liberty: granite pedestal, the robed figure, the raised torch, the tablet
    const { x, z } = r.liberty, green = 0x7fb8a4, L = [];
    L.push(box(3.4, 1.2, 3.4, x, 0.6, z, 0xb9ab8f), box(2.6, 3.2, 2.6, x, 2.8, z, 0xc4b79c), box(2.9, 0.4, 2.9, x, 4.6, z, 0xd2c6ac));
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) L.push(box(sx ? 0.15 : 1.4, 1.6, sz ? 0.15 : 1.4, x + sx * 1.32, 2.8, z + sz * 1.32, 0xb0a286));
    const robe = new THREE.LatheGeometry([[0, 0], [0.95, 0], [0.85, 0.6], [0.7, 2.4], [0.62, 4.2], [0.5, 4.9], [0.32, 5.3], [0, 5.35]].map(([a, b]) => new THREE.Vector2(a, b)), 14).translate(x, 4.8, z);
    L.push(tint(robe, green), sph(0.36, x, 10.55, z, green), cyl(0.18, 0.2, 0.3, x, 10.15, z, green, 8));
    for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3; L.push(tint(new THREE.ConeGeometry(0.05, 0.45, 4).rotateX(-Math.PI / 2).rotateY(-a).translate(x + Math.sin(a) * 0.4, 10.75, z + Math.cos(a) * 0.4), green)); }
    L.push(tint(new THREE.CylinderGeometry(0.12, 0.15, 2.6, 8).translate(0, 1.3, 0).rotateZ(-0.12).translate(x - 0.35, 9.6, z + 0.1), green), cyl(0.2, 0.12, 0.45, x - 0.05, 12.3, z + 0.1, 0xd9b04a, 8));
    L.push(box(0.6, 0.9, 0.18, x + 0.5, 8.6, z + 0.55, green), tint(new THREE.CylinderGeometry(0.11, 0.13, 1.3, 8).rotateX(0.9).translate(x + 0.45, 8.9, z + 0.3), green));
    this.add(L);
    this.torch = this.add([cone(0.24, 0.6, x - 0.05, 12.8, z + 0.1, 0xffc040, 8)], this.neon, false);
    // the casino front buildings with green domes, and the bridge
    const s = topOf(r.street), F = [];
    for (const dz of [-4.5, 0, 4.5]) F.push(tint(new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(s.bx - 1, s.y, s.cz + dz), 0x3f8a7a), cyl(0.3, 0.3, 0.8, s.bx - 1, s.y + 1.3, s.cz + dz, 0x3f8a7a, 8));
    hangOn(r.street, [this.add(F)]);
    const b = r.bridge, B2 = [];
    for (const zz of [b.z0 + 2, b.z1 - 2]) { B2.push(box(1.4, 6, 1.6, b.x, 3, zz, 0xb8a98c)); B2.push(box(1.45, 1.6, 0.5, b.x, 3.6, zz, 0x5a4a3a)); }
    B2.push(box(1.2, 0.3, b.z1 - b.z0, b.x, 2.4, (b.z0 + b.z1) / 2, 0x7a6e60));
    for (let t = 0; t <= 1; t += 0.1) { const zz = b.z0 + 2 + t * (b.z1 - b.z0 - 4), h = 2.6 + 3 * Math.pow(2 * t - 1, 2); B2.push(box(0.06, h - 2.4, 0.06, b.x, 2.4 + (h - 2.4) / 2, zz, 0x3a3a3a)); }
    this.add(B2);
    // the roller coaster: a red track weaving round the towers on its white trestles
    const pts = [[-12, 6, 52], [-20, 12, 54], [-30, 20, 54], [-44, 16, 53], [-48, 10, 46], [-47, 18, 38], [-40, 24, 35.6], [-28, 14, 35.6], [-18, 9, 36], [-12, 12, 40], [-13, 5, 46]].map(([a, h, c2]) => new THREE.Vector3(a, h, c2));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    this.add([tint(new THREE.TubeGeometry(curve, 200, 0.18, 6, true), 0xc8202a)], this.metal);
    const posts = []; for (let k = 0; k < 26; k++) { const p = curve.getPointAt(k / 26); posts.push(box(0.1, p.y, 0.1, p.x - 0.3, p.y / 2, p.z, 0xe8e8e4), box(0.1, p.y, 0.1, p.x + 0.3, p.y / 2, p.z, 0xe8e8e4)); }
    this.add(posts);
  }
  mgm(r, coke, showcase) {
    // the lion: a golden cat on its pedestal at the corner
    const { x, z } = r.lion, gold = 0xd9a83a, P = [];
    P.push(cyl(2.2, 2.4, 2.4, x, 1.2, z, 0xd8d0c0, 20), cyl(2.4, 2.4, 0.3, x, 2.5, z, 0xb7ad99, 20));
    P.push(tint(new THREE.SphereGeometry(1.4, 12, 8).scale(1.3, 0.8, 0.8).translate(x - 0.3, 3.9, z), gold));
    P.push(sph(1.1, x + 1.1, 5.2, z, 0xc8922e), sph(0.7, x + 1.7, 5.1, z, gold), box(0.5, 1.4, 0.4, x + 0.7, 3.3, z - 0.5, gold), box(0.5, 1.4, 0.4, x + 0.7, 3.3, z + 0.5, gold));
    this.add(P, this.metal);
    for (const w of r.wings) { const t = topOf(w); this.add([box(t.w + 0.2, 0.5, t.d + 0.2, t.cx, t.y + 0.25, t.cz, 0x0f4a2e)], this.glass); }
    // the giant Coca-Cola bottle set into the Showcase's front, its red glowing label band
    const pts = [[0, 0], [1.4, 0], [1.5, 0.6], [1.3, 2.2], [1.55, 4.4], [1.05, 6.6], [0.55, 7.8], [0.5, 9], [0.6, 9.2], [0, 9.2]].map(([a, b]) => new THREE.Vector2(a, b));
    const bottle = new THREE.Mesh(new THREE.LatheGeometry(pts, 24).translate(coke.x, 0, coke.z), new THREE.MeshStandardMaterial({ color: 0x5e8f6e, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.88 }));
    bottle.castShadow = true; this.scene.add(bottle); hangOn(showcase, [bottle], 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.5, 1.6, 24, 1, true).translate(coke.x, 4.6, coke.z), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.4 }));
    this.scene.add(band); this.signs.push(band.material); hangOn(showcase, [band], 0);
    const s = this.sign(3, 0.95, this.text('Coca-Cola', 'italic 700 $px Georgia, serif', '#ffffff', '#ff8080'), coke.x - 1.55, 4.6, coke.z, -Math.PI / 2, 1.2); hangOn(showcase, [s], 0);
    const t = topOf(showcase);
    this.sign(5, 1, this.text("M&M'S WORLD", '900 $px Arial', '#ffd200', '#ff6a00'), t.ax - 0.06, 3.6, t.cz + 4, -Math.PI / 2, 1);
    this.screen(5, 2.4, t.ax - 0.07, 7, t.cz + 1.5, -Math.PI / 2, 1);
  }
  cosmo(r) {
    // dark glass towers with random blue lines of lit balconies, the name in white with a violet glow on top
    for (const t of r.towers) {
      const tt = topOf(t), L = [];
      for (let y = 4; y < tt.y - 1; y += 1.6) for (const [fx, fz, rot] of [[tt.bx + 0.03, tt.cz, Math.PI / 2], [tt.ax - 0.03, tt.cz, -Math.PI / 2], [tt.cx, tt.bz + 0.03, 0], [tt.cx, tt.az - 0.03, Math.PI]]) {
        if (Math.random() < 0.55) continue;
        const len = rand(0.8, 3.4), off = rand(-1.2, 1.2);
        L.push(tint(new THREE.BoxGeometry(len, 0.08, 0.02).rotateY(rot).translate(fx + (rot === 0 || rot === Math.PI ? off : 0), y, fz + (rot === 0 || rot === Math.PI ? 0 : off)), 0x3a8aff));
      }
      hangOn(t, [this.add(L, this.neon, false)]);
      this.add([box(tt.w + 0.2, 0.6, tt.d + 0.2, tt.cx, tt.y + 0.3, tt.cz, 0x0e1420)], this.glass);
      const s = this.sign(5.2, 0.9, this.text('THE COSMOPOLITAN', '600 $px Arial', '#ffffff', '#b45aff'), tt.bx + 0.1, tt.y - 0.8, tt.cz, Math.PI / 2, 1.2); hangOn(t, [s], t.floors - 1);
    }
  }
  bellagio(segs, lake, villas) {
    // the cream curve: its cupola tower at the centre, the arched top floors lit gold, teal roofs over the wings
    segs.forEach((s, i) => {
      const t = topOf(s), P = [];
      P.push(box(t.w + 0.4, 0.5, t.d + 0.4, t.cx, t.y + 0.25, t.cz, 0xefe6d2));
      if (i !== 2) P.push(tint(hipRoof(t.w + 0.2, t.d + 0.2, 1.2).translate(t.cx, t.y + 0.5, t.cz), 0x4f8a86));
      hangOn(s, [this.add(P)], s.floors - 1);
      this.arcade(s, '#f6e9c8', 3);
    });
    const c = topOf(segs[2]), C = [];
    C.push(cyl(2.2, 2.3, 4, c.cx + 1, c.y + 2, c.cz, 0xf2e8d4, 20), cyl(2.45, 2.45, 0.4, c.cx + 1, c.y + 4.2, c.cz, 0xe6dcc6, 20), tint(new THREE.SphereGeometry(2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(c.cx + 1, c.y + 4.4, c.cz), 0x4f8a86), cyl(0.4, 0.5, 1.2, c.cx + 1, c.y + 6.4, c.cz, 0xf2e8d4, 10), sph(0.3, c.cx + 1, c.y + 7.2, c.cz, 0xd9b04a));
    hangOn(segs[2], [this.add(C)], segs[2].floors - 1);
    const s = this.sign(4, 0.8, this.text('BELLAGIO', '600 $px "Times New Roman", serif', '#fff3d0', '#ffcf80'), c.cx + 3.25, c.y + 1.6, c.cz, Math.PI / 2, 1.2); hangOn(segs[2], [s], segs[2].floors - 1);
    // the Italian villas: terracotta roofs, warm stucco
    for (const v of villas) { const t = topOf(v); hangOn(v, [this.add([tint(hipRoof(t.w + 0.4, t.d + 0.4, 1).translate(t.cx, t.y, t.cz), 0xb8613a)])]); }
    // the lake: dark water, the lit balustrade along the Strip, olive trees and lamps
    const water = new THREE.Mesh(new THREE.PlaneGeometry(lake.x1 - lake.x0, lake.z1 - lake.z0, 1, 1).rotateX(-Math.PI / 2).translate((lake.x0 + lake.x1) / 2, 0.06, (lake.z0 + lake.z1) / 2),
      waterMaterial({ color: 0x17485e, flow: [0.05, 0.12], wakes: false }));
    water.receiveShadow = true; this.scene.add(water); this.lakeWater = water;
    const Bal = [];
    for (let z = lake.z0; z < lake.z1; z += 0.5) Bal.push(box(0.12, 0.6, 0.12, lake.x1 + 0.25, 0.3, z, 0xf2ece0));
    Bal.push(box(0.3, 0.1, lake.z1 - lake.z0, lake.x1 + 0.25, 0.62, (lake.z0 + lake.z1) / 2, 0xf2ece0));
    for (let z = lake.z0 + 1; z < lake.z1; z += 3) Bal.push(cyl(0.05, 0.06, 1.8, lake.x1 + 0.6, 0.9, z, 0x2a2a2a, 6));
    this.add(Bal);
    this.balLights = this.add([...Array(Math.ceil((lake.z1 - lake.z0) / 3))].map((_, k) => sph(0.12, lake.x1 + 0.6, 1.85, lake.z0 + 1 + k * 3, 0xffe2a0, 6, 4)), this.neon, false);
    const T = []; for (let k = 0; k < 14; k++) T.push(sph(0.7, lake.x0 - 0.5 + rand(-0.4, 0.4), 1.5, lake.z0 + k * 1.5, 0x3f5a3a), cyl(0.08, 0.1, 1, lake.x0 - 0.5, 0.5, lake.z0 + k * 1.5, 0x5a4636, 5));
    this.add(T);
    this.fountains0(lake);
  }
  // arched windows round the top floors, warm-lit after dark (Bellagio, Caesars, Paris)
  arcade(b, col = '#f6e9c8', rows = 2) {
    const t = topOf(b), y0 = t.y - rows * 1.25 - 0.2, h = rows * 1.25;
    const tex = canvasTex(256, 64 * rows, (c, w, hh) => { c.clearRect(0, 0, w, hh); for (let r2 = 0; r2 < rows; r2++) for (let k = 0; k < 8; k++) { const x = k * 32 + 6, y = r2 * 64 + 10; c.fillStyle = col; c.fillRect(x - 3, y - 4, 26, 52); c.fillStyle = '#3a3226'; c.beginPath(); c.moveTo(x, y + 44); c.lineTo(x, y + 10); c.arc(x + 10, y + 10, 10, Math.PI, 0); c.lineTo(x + 20, y + 44); c.fill(); } });
    tex.wrapS = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, emissive: 0xffc670, emissiveIntensity: 0, roughness: 0.6 });
    this.arcades = this.arcades || []; this.arcades.push(mat);
    const ms = [];
    for (const [fx, fz, ry, len] of [[t.bx + 0.04, t.cz, Math.PI / 2, t.d], [t.ax - 0.04, t.cz, -Math.PI / 2, t.d], [t.cx, t.bz + 0.04, 0, t.w], [t.cx, t.az - 0.04, Math.PI, t.w]]) {
      const geo = new THREE.PlaneGeometry(len, h); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 4);
      const m = new THREE.Mesh(geo, mat); m.position.set(fx, y0 + h / 2, fz); m.rotation.y = ry; this.scene.add(m); ms.push(m);
    }
    hangOn(b, ms, b.floors - 1);
  }
  paris(r) {
    // the Eiffel Tower: four curved lattice faces (wrought-iron X bracing, the great arches at the base), the platforms
    // with the restaurant, the slim top and its lantern; gold lights after dark
    const { x, z } = r.eiffel, H = 38;
    const half = (y) => (y < 9 ? 3.3 + 3.1 * Math.pow(1 - y / 9, 1.7) : y < 19 ? 3.3 - (y - 9) / 10 * 1.45 : 0.42 + 1.43 * Math.pow(1 - (y - 19) / (H - 19), 1.35));
    const lattice = canvasTex(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.strokeStyle = '#6b4a30'; c.lineWidth = 3.2; c.strokeRect(1.5, 1.5, w - 3, h - 3);
      c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
      c.lineWidth = 1.2; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    });
    lattice.wrapS = lattice.wrapT = THREE.RepeatWrapping; lattice.colorSpace = THREE.SRGBColorSpace;
    const latMat = new THREE.MeshStandardMaterial({ map: lattice, color: 0xffffff, alphaTest: 0.35, transparent: false, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3, emissive: 0xffb44a, emissiveMap: lattice, emissiveIntensity: 0 });
    this.eiffelMat = latMat;
    const pos = [], uv = [], idx = [];
    const arch = (y) => (y < 6.2 ? Math.sqrt(Math.max(0, 1 - Math.pow(y / 6.2, 2))) * 0.62 : 0);   // fraction of the face open under the arch
    const N = 60;
    for (let f = 0; f < 4; f++) {
      const ang = f * Math.PI / 2, nx = Math.sin(ang), nz = Math.cos(ang), tx = Math.cos(ang), tz = -Math.sin(ang);
      const P = (y, s) => { const h2 = half(y); return [x + nx * h2 + tx * h2 * s, y, z + nz * h2 + tz * h2 * s]; };
      for (let k = 0; k < N; k++) {
        const y0 = (k / N) * H, y1 = ((k + 1) / N) * H, a0 = arch(y0), a1 = arch(y1);
        // under the great arch the middle of the face is open: two strips (left and right of the opening)
        const segs = a0 > 0 || a1 > 0 ? [[-1, -a0, -1, -a1], [a0, 1, a1, 1]] : [[-1, 1, -1, 1]];
        for (const [b0, b1, t0, t1] of segs) {
          const base = pos.length / 3;
          for (const [yy, ss] of [[y0, b0], [y0, b1], [y1, t1], [y1, t0]]) { pos.push(...P(yy, ss)); uv.push(ss * half(yy) * 0.55, yy * 0.55); }
          idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    const tower = new THREE.Mesh(tg, latMat); tower.castShadow = true; this.scene.add(tower);
    // solid corner edges, the platforms (the restaurant's glass band on the first), the lantern and the mast
    const E = [];
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let k = 0; k < 24; k++) {
      const y0 = (k / 24) * H, y1 = ((k + 1) / 24) * H, a = new THREE.Vector3(x + sx * half(y0), y0, z + sz * half(y0)), b2 = new THREE.Vector3(x + sx * half(y1), y1, z + sz * half(y1));
      const d = b2.clone().sub(a), len = d.length(), g3 = new THREE.BoxGeometry(0.32, len, 0.32).translate(0, len / 2, 0); g3.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g3.translate(a.x, a.y, a.z); E.push(tint(g3, 0x6b4a30));
    }
    E.push(box(half(9) * 2 + 1, 0.9, half(9) * 2 + 1, x, 9.2, z, 0x6b4a30), box(half(9) * 2 + 0.6, 0.7, half(9) * 2 + 0.6, x, 10, z, 0x2a3a4a));
    E.push(box(half(19) * 2 + 0.6, 0.6, half(19) * 2 + 0.6, x, 19.2, z, 0x6b4a30), box(1.6, 1.2, 1.6, x, H + 0.4, z, 0x6b4a30), cyl(0.5, 0.6, 1.2, x, H + 1.6, z, 0x6b4a30, 8), cone(0.5, 1.2, x, H + 2.8, z, 0x6b4a30, 8), cyl(0.06, 0.12, 3, x, H + 4.8, z, 0x9a9a9a, 6));
    this.add(E, this.metal);
    this.sign(half(9) * 2 + 0.6, 0.55, this.text('EIFFEL TOWER RESTAURANT', '600 $px Georgia', '#f6e8c0', '#ffcf80'), x - half(9) - 0.32, 10, z, -Math.PI / 2, 0.8);
    // the Hôtel de Ville tower: blue mansard roofs, arcade windows, the name
    const t = topOf(r.tower);
    this.add([tint(hipRoof(t.w + 0.4, t.d + 0.4, 2.6).translate(t.cx, t.y, t.cz), 0x3a5a8a), box(1.4, 2.4, 1.4, t.ax + 1, t.y + 2.2, t.az + 1, 0x3a5a8a), box(1.4, 2.4, 1.4, t.ax + 1, t.y + 2.2, t.bz - 1, 0x3a5a8a)]);
    this.arcade(r.tower, '#f2e6c8', 2);
    // the Montgolfier balloon: blue with gold bands, the zig-zag band, sun faces; "Paris" in neon; the LED pedestal
    const b = r.balloon;
    const tex = canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = '#1d3c8f'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#e8b830'; c.lineWidth = 4; for (let k = 0; k < 24; k++) { c.beginPath(); c.moveTo(k * w / 24, 0); c.lineTo(k * w / 24, h); c.stroke(); }
      c.fillStyle = '#e8b830'; c.fillRect(0, h * 0.16, w, 8); c.fillRect(0, h * 0.28, w, 6);
      for (let k = 0; k < 24; k++) { c.fillStyle = '#f2e0a0'; c.beginPath(); c.arc((k + 0.5) * w / 24, h * 0.22, 7, 0, 6.28); c.fill(); }
      c.fillStyle = '#e8b830'; c.fillRect(0, h * 0.56, w, h * 0.09); c.fillStyle = '#c8202a';
      for (let k = 0; k < 48; k++) { c.beginPath(); c.moveTo(k * w / 48, h * 0.565); c.lineTo((k + 0.5) * w / 48, h * 0.64); c.lineTo((k + 1) * w / 48, h * 0.565); c.fill(); }
      for (let k = 0; k < 4; k++) { const cx = (k + 0.5) * w / 4, cy = h * 0.42; c.fillStyle = '#e8b830'; c.beginPath(); c.arc(cx, cy, 44, 0, 6.28); c.fill(); for (let a = 0; a < 6.28; a += 0.3) { c.strokeStyle = '#f2d060'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); c.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58); c.stroke(); } c.fillStyle = '#f6e0b8'; c.beginPath(); c.arc(cx, cy, 26, 0, 6.28); c.fill(); c.fillStyle = '#8a5a2a'; c.fillRect(cx - 10, cy - 6, 4, 4); c.fillRect(cx + 6, cy - 6, 4, 4); }
      c.fillStyle = '#c8202a'; c.fillRect(0, h * 0.74, w, 10); c.fillStyle = '#e8b830'; c.fillRect(0, h * 0.78, w, 6);
    });
    const bal = new THREE.Mesh(new THREE.SphereGeometry(2.8, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.82).scale(1, 1.12, 1).translate(b.x, 9.6, b.z), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.5 }));
    this.scene.add(bal); this.signs.push(bal.material);
    this.add([cyl(1.0, 1.4, 1.6, b.x, 6.3, b.z, 0x2a52b8, 20), box(3.2, 2.2, 3.2, b.x, 4.4, b.z, 0x3a2a3a), cyl(0.9, 1.1, 3.4, b.x, 1.7, b.z, 0xd8d0c0, 16)]);
    for (const [ry, dx, dz] of [[-Math.PI / 2, -1.62, 0], [Math.PI, 0, -1.62], [0, 0, 1.62]]) this.screen(2.8, 1.8, b.x + dx, 4.4, b.z + dz, ry, 2);
    this.sign(3.6, 2, (c, w, h) => { c.font = `italic 700 ${h * 0.7}px "Brush Script MT", "Segoe Script", cursive`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = h * 0.12; c.strokeStyle = '#c8102e'; c.shadowColor = '#ff4a5a'; c.shadowBlur = 18; c.strokeText('Paris', w / 2, h / 2); c.fillStyle = '#fff4f4'; c.fillText('Paris', w / 2, h / 2); }, b.x - 2.95, 10.2, b.z, -Math.PI / 2, 1.3);
  }
  caesars(r) {
    const { x, z } = r.temple, wh = 0xf4f0e6, P = [];
    P.push(box(5, 0.8, 12, x, 0.4, z, 0xe6e0d2));
    for (let k = 0; k < 8; k++) P.push(cyl(0.3, 0.34, 5, x + 1.6, 3.3, z - 5 + k * (10 / 7), wh, 10));
    P.push(box(3.8, 0.8, 11.6, x, 6.2, z, wh));
    P.push(...this.pediment(x + 1.9, 6.6, z, 11.6, 1.8, 'x', wh));
    // fountains in front, statues on plinths, the Colosseum drum and two lattice domes on the casino
    for (const zz of [z - 9, z + 8]) { P.push(cyl(2, 2.1, 0.5, x + 0.5, 0.25, zz, 0xd8d0c0, 18), cyl(1.8, 1.8, 0.1, x + 0.5, 0.48, zz, 0x5fb3c8, 18), cyl(0.3, 0.4, 1.8, x + 0.5, 1.2, zz, wh, 8)); }
    for (let k = 0; k < 5; k++) P.push(box(0.6, 1, 0.6, x + 3, 0.5, z - 6 + k * 3, 0xd8d0c0), cyl(0.18, 0.22, 1.2, x + 3, 1.6, z - 6 + k * 3, wh, 6), sph(0.16, x + 3, 2.35, z - 6 + k * 3, wh));
    const c = r.colosseum; P.push(cyl(5, 5, 4, c.x, 2, c.z, 0xe9e2d2, 28), cyl(5.1, 5.1, 0.4, c.x, 4.2, c.z, 0xd8cfbd, 28));
    for (let a = 0; a < 6.28; a += 0.35) P.push(box(0.3, 2.6, 0.12, c.x + Math.cos(a) * 5.05, 2, c.z + Math.sin(a) * 5.05, 0xc9bfa9, -a));
    const f = topOf(r.forum);
    for (const dz of [-2.5, 2.5]) P.push(tint(new THREE.SphereGeometry(1.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(f.bx - 2, f.y, f.cz + dz), 0xe8d8b8), cyl(0.35, 0.4, 0.8, f.bx - 2, f.y + 2, f.cz + dz, 0x3f8a7a, 8));
    this.add(P);
    const C = []; for (let zz = z - 16; zz < z + 15; zz += 2.6) C.push(tint(new THREE.ConeGeometry(0.45, 4.2, 8).translate(x + 4.6, 2.3, zz), 0x234a2a));
    this.add(C);
    // each tower: a cornice, a pediment crowning the middle of each long face (red CAESARS PALACE on the Strip side), arcades
    for (const t of r.towers) {
      const tt = topOf(t), Q = [box(tt.w + 0.4, 0.8, tt.d + 0.4, tt.cx, tt.y + 0.4, tt.cz, 0xf4f0e6)];
      const along = tt.w >= tt.d ? 'z' : 'x';
      if (along === 'z') { Q.push(...this.pediment(tt.cx, tt.y + 0.8, tt.az - 0.2, Math.min(7, tt.w * 0.5), 1.8, 'z', wh)); Q.push(...this.pediment(tt.cx, tt.y + 0.8, tt.bz + 0.2, Math.min(7, tt.w * 0.5), 1.8, 'z', wh)); }
      else { Q.push(...this.pediment(tt.ax - 0.2, tt.y + 0.8, tt.cz, Math.min(7, tt.d * 0.5), 1.8, 'x', wh)); Q.push(...this.pediment(tt.bx + 0.2, tt.y + 0.8, tt.cz, Math.min(7, tt.d * 0.5), 1.8, 'x', wh)); }
      hangOn(t, [this.add(Q)], t.floors - 1);
      this.arcade(t, '#f6efe0', 2);
    }
    const t1 = topOf(r.towers[2]);
    const s = this.sign(6, 1, this.text('CAESARS PALACE', '700 $px "Times New Roman", serif', '#ffffff', '#ff2a2a'), t1.bx + 0.25, t1.y - 0.8, t1.cz, Math.PI / 2, 1.2);
    s.material.color = new THREE.Color(1, 0.4, 0.4); hangOn(r.towers[2], [s], r.towers[2].floors - 1);
    this.sign(6, 1.2, this.text('CAESARS PALACE', '600 $px "Times New Roman", serif', '#f6ecd0', '#ffd890'), x + 1.95, 7.3, z, Math.PI / 2, 0.8);
  }
  // a triangular pediment: base width `w`, height `h`, the face pointing along `axis` (x: faces ±x, z: faces ±z)
  pediment(x, y, z, w, h, axis, col) {
    const g3 = new THREE.BufferGeometry(), d = 0.5;
    const v = axis === 'x' ? [[0, 0, -w / 2], [0, 0, w / 2], [0, h, 0]] : [[-w / 2, 0, 0], [w / 2, 0, 0], [0, h, 0]];
    const off = axis === 'x' ? [d, 0, 0] : [0, 0, d];
    const P = [...v, ...v.map((p) => [p[0] + off[0], p[1], p[2] + off[2]])];
    const tri = [[0, 1, 2], [3, 5, 4], [0, 3, 1], [1, 3, 4], [1, 4, 2], [2, 4, 5], [2, 5, 0], [0, 5, 3]];
    g3.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat().flatMap((i) => [x + P[i][0] - off[0] / 2, y + P[i][1], z + P[i][2] - off[2] / 2]), 3)); g3.computeVertexNormals();
    return [tint(g3, col)];
  }
  venice(ven, pal, v) {
    const { x, z } = v.campanile, P = [];
    P.push(box(2.2, 16, 2.2, x, 8, z, 0xa24a33), box(2.6, 2.4, 2.6, x, 17.2, z, 0xece4d2), box(2.8, 0.4, 2.8, x, 18.6, z, 0xd8cfbd), box(2.2, 2, 2.2, x, 19.8, z, 0xece4d2), cone(1.6, 4, x, 22.8, z, 0xd9b04a, 4), sph(0.2, x, 25, z, 0xe8c050));
    const r = v.rialto;
    for (let k = 0; k <= 10; k++) { const t = k / 10 - 0.5; P.push(box(4.8, 0.4, 0.62, r.x, 1.6 - t * t * 4.4, r.z + t * 6.2, 0xf0ebe0)); }
    P.push(box(1.4, 1.6, 2.4, r.x, 2.3, r.z, 0xece4d2), tint(hipRoof(1.8, 2.8, 0.8).translate(r.x, 3.1, r.z), 0xb8613a));
    this.add(P);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(v.canal.x1 - v.canal.x0, v.canal.z1 - v.canal.z0).rotateX(-Math.PI / 2).translate((v.canal.x0 + v.canal.x1) / 2, 0.06, (v.canal.z0 + v.canal.z1) / 2), waterMaterial({ color: 0x2f8a96, flow: [0.02, 0.1], scale: 1.0 }));
    this.scene.add(water);
    const gGeo = mergeGeometries([tint(new THREE.BoxGeometry(0.45, 0.22, 2.2).translate(0, 0.16, 0), 0x0d0d10), tint(new THREE.BoxGeometry(0.06, 0.4, 0.1).translate(0, 0.35, 1.05), 0x0d0d10), tint(new THREE.CylinderGeometry(0.07, 0.08, 0.36, 6).translate(0, 0.45, -0.7), 0xf2f2ee)]);
    this.gondolas = [0, 1, 2].map((k) => { const m = new THREE.Mesh(gGeo, this.mat); this.scene.add(m); return { m, t: k / 3, v: v.canal }; });
    for (const b of [...ven, pal]) { const t = topOf(b); this.add([tint(hipRoof(t.w + 0.3, t.d + 0.3, 1.2).translate(t.cx, t.y, t.cz), 0xb8613a)]); }
  }
  wynn(wynn, encore) {
    const sig = (b, txt2) => { const t = topOf(b); const s = this.sign(Math.max(5, t.d * 1.6), 1.9, this.text(txt2, 'italic 600 $px "Brush Script MT", "Segoe Script", cursive', '#f6e4b8', '#ffcf80'), t.ax - 0.15, t.y - 1.4, t.cz, -Math.PI / 2, 0.9); hangOn(b, [s], b.floors - 1); };
    sig(wynn[2], 'Wynn'); sig(encore[2], 'Encore');
  }
  rw(segs) {
    const t = topOf(segs[1]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 40).rotateY(Math.PI / 2).translate(t.bx + 0.15, 22, t.cz), new THREE.MeshBasicMaterial({ map: this.reels[3].t, toneMapped: false }));
    this.scene.add(m); this.screenMats.push(m.material); hangOn(segs[1], [m]);
  }
  flamingo(fl, linq, har) {
    const p = fl[1];
    this.sign(8, 4.2, (c, w, h) => { const g2 = c.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, '#ff5aa8'); g2.addColorStop(1, '#ff8a2a'); c.fillStyle = g2; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff2f8'; c.lineWidth = 6; for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(w * (0.1 + k * 0.13), h * 0.62, w * 0.05, h * 0.3, -0.4, 0, 6.28); c.stroke(); } c.fillStyle = '#fff'; c.font = `italic 700 ${h * 0.24}px Georgia, serif`; c.textAlign = 'center'; c.fillText('Flamingo', w / 2, h * 0.26); }, p.x - p.w / 2 - 0.05, 4.4, p.z, -Math.PI / 2, 1.1);
    this.sign(6, 1.4, this.text("HARRAH'S", '800 italic $px Georgia, serif', '#ff3b2f', '#ff8a6a'), har[1].x - har[1].w / 2 - 0.05, 5.4, har[1].z, -Math.PI / 2, 1);
  }
  ph(segs) {
    // gold "planet hollywood" across the top of the white tower
    const t = topOf(segs[1]);
    const s = this.sign(Math.max(9, t.d * 3), 1.6, this.text('planet hollywood', '700 $px Arial', '#ffe08a', '#ffb84a'), t.ax - 0.4, t.y + 0.4, t.cz, -Math.PI / 2, 1.3);
    hangOn(segs[1], [s], segs[1].floors - 1);
    for (const sg of segs) { const tt = topOf(sg); this.add([box(tt.w + 0.3, 0.6, tt.d + 0.3, tt.cx, tt.y + 0.3, tt.cz, 0xf2efe8)]); }
    this.screen(9, 3.2, 12.9, 5.6, 2.5, -Math.PI / 2, 0);
  }
  ti(segs, lag, ex) {
    const { x, z } = lag, P = [];
    P.push(tint(new THREE.BoxGeometry(2.2, 1.4, 7).translate(x, 0.6, z), 0x4a2e1a), box(2, 0.6, 1.8, x, 1.6, z + 2.8, 0x5a3a22));
    for (const dz of [-2, 0.4, 2.2]) { P.push(cyl(0.08, 0.1, 7, x, 4.4, z + dz, 0x3a2414, 6)); P.push(box(0.08, 2.4, 2.4, x, 5.2, z + dz, 0xf0e8d8)); }
    this.add(P);
    // the giant round LED screen on the corner of Spring Mountain (and the drugstore under it)
    const r = ex.r, scr = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 4.4, 40, 1, true, -Math.PI * 0.05, Math.PI * 1.1).translate(ex.x, 7, ex.z), new THREE.MeshBasicMaterial({ map: this.reels[0].t, toneMapped: false, side: THREE.DoubleSide }));
    this.scene.add(scr); this.screenMats.push(scr.material);
    this.add([cyl(r * 0.92, r * 0.95, 4.8, ex.x, 2.4, ex.z, 0x2a2c30, 32), cyl(r + 0.1, r + 0.1, 0.3, ex.x, 9.3, ex.z, 0x1a1a1a, 32)]);
    this.sign(4, 0.8, this.text('PHARMACY · OPEN 24 HOURS', '800 $px Arial', '#ff3a2a', '#ff3a2a'), ex.x + r * 0.96 + 0.05, 3.6, ex.z, Math.PI / 2, 1.2);
    const t = topOf(segs[0]);
    const s = this.sign(7, 1.4, this.text('TREASURE ISLAND', '700 $px "Times New Roman", serif', '#f2d27a', '#ffcf80'), t.bx + 0.1, t.y - 1, t.cz, Math.PI / 2, 1); hangOn(segs[0], [s], segs[0].floors - 1);
  }
  cloud(c) {
    this.add([tint(new THREE.SphereGeometry(1, 24, 8).scale(9, 0.35, 5.5).translate(c.x, 9.5, c.z), 0xf2f2f0), ...[[-6, -3], [6, -3], [-6, 3], [6, 3], [0, 0]].map(([dx, dz]) => cyl(0.2, 0.2, 9.4, c.x + dx * 0.9, 4.7, c.z + dz * 0.8, 0xdcdcda, 6))]);
  }
  sphere(s) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    this.sphCtx = cv.getContext('2d'); this.sphTex = new THREE.CanvasTexture(cv); this.sphTex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.78), new THREE.MeshBasicMaterial({ map: this.sphTex, toneMapped: false }));
    m.position.set(s.x, s.r * 0.62, s.z); m.rotation.y = Math.PI; this.scene.add(m);
    this.add([cyl(s.r * 0.8, s.r * 0.83, 1.2, s.x, 0.6, s.z, 0x2a2c30, 32)]);
    this.drawSphere(0);
  }
  drawSphere(t) {
    const c = this.sphCtx, W = 512, H = 256, k = Math.floor(t / 14) % 5, u = (t % 14) / 14;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42;
    if (k === 0) {
      c.fillStyle = '#f4f0ea'; c.beginPath(); c.ellipse(cx, cy, 120, 80, 0, 0, 6.28); c.fill();
      const lx = Math.sin(t * 0.7) * 40, ly = Math.cos(t * 0.5) * 14;
      const gr = c.createRadialGradient(cx + lx, cy + ly, 6, cx + lx, cy + ly, 46); gr.addColorStop(0, '#0a0a0a'); gr.addColorStop(0.3, '#0a0a0a'); gr.addColorStop(0.35, '#2a7ab8'); gr.addColorStop(1, '#0b3d66');
      c.fillStyle = gr; c.beginPath(); c.arc(cx + lx, cy + ly, 46, 0, 6.28); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(cx + lx - 14, cy + ly - 14, 8, 0, 6.28); c.fill();
      const blink = Math.max(0, 1 - Math.abs((t % 5) - 4.8) * 8);
      if (blink > 0) { c.fillStyle = '#c99a7a'; c.fillRect(cx - 130, cy - 90, 260, 180 * blink); }
    } else if (k === 1) {
      c.fillStyle = '#ffcc22'; c.beginPath(); c.arc(cx, cy, 100, 0, 6.28); c.fill();
      c.fillStyle = '#3a2410'; c.beginPath(); c.ellipse(cx - 35, cy - 20, 12, 20, 0, 0, 6.28); c.ellipse(cx + 35, cy - 20, 12, 20, 0, 0, 6.28); c.fill();
      c.strokeStyle = '#3a2410'; c.lineWidth = 10; c.beginPath(); c.arc(cx, cy + 10, 55, 0.2, Math.PI - 0.2); c.stroke();
    } else if (k === 2) {
      const gr = c.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, 110); gr.addColorStop(0, '#5fa8e8'); gr.addColorStop(1, '#0b2a6a');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 110, 0, 6.28); c.fill(); c.fillStyle = '#3f8a4a';
      for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(cx - 60 + ((i * 47 + t * 20) % 140), cy - 50 + (i * 31) % 100, 22, 14, i, 0, 6.28); c.fill(); }
    } else if (k === 3) {
      for (let x = 0; x < W; x += 8) { c.fillStyle = `hsl(${(x / W * 360 + t * 60) % 360},90%,55%)`; c.fillRect(x, 0, 8, H); }
    } else {
      for (let i = 0; i < 60; i++) { const a = i * 0.7 + t, r = (u * 160 + i * 3) % 160; c.fillStyle = `hsl(${(i * 37) % 360},95%,60%)`; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 5, 0, 6.28); c.fill(); }
    }
    this.sphTex.needsUpdate = true;
  }
  wheel(w) {
    // the High Roller: white rim and spokes, 28 glass cabins, an LED ring that runs colours after dark
    const g2 = new THREE.Group(); g2.position.set(w.x, w.r + 3, w.z);
    const P = [tint(new THREE.TorusGeometry(w.r, 0.22, 6, 64), 0xf2f2f0), tint(new THREE.TorusGeometry(w.r - 0.6, 0.12, 6, 64), 0xe0e0e0), cyl(0.8, 0.8, 1.2, 0, 0, 0, 0xd8d8d8).rotateX(Math.PI / 2)];
    for (let k = 0; k < 28; k++) { const a = k / 28 * 6.283; P.push(tint(new THREE.BoxGeometry(0.06, w.r, 0.06).translate(0, w.r / 2, 0).rotateZ(a), 0xd0d0d0)); }
    g2.add(new THREE.Mesh(mergeGeometries(P), this.metal));
    this.wheelLED = new THREE.MeshBasicMaterial({ color: 0x5a8aff });
    g2.add(new THREE.Mesh(new THREE.TorusGeometry(w.r + 0.05, 0.09, 4, 96), this.wheelLED), new THREE.Mesh(new THREE.TorusGeometry(w.r - 0.62, 0.06, 4, 96), this.wheelLED));
    this.cabins = [];
    const cabGeo = new THREE.SphereGeometry(0.75, 10, 8).scale(1, 0.75, 0.75);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xbfe4ff, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85, emissive: 0x6aa0ff, emissiveIntensity: 0 });
    for (let k = 0; k < 28; k++) { const m = new THREE.Mesh(cabGeo, cabMat); g2.add(m); this.cabins.push(m); }
    this.cabMat = cabMat;
    this.scene.add(g2); this.wheelG = g2; this.wheelR = w.r;
    this.add([tint(new THREE.CylinderGeometry(0.35, 0.6, w.r + 3.5, 8).translate(0, (w.r + 3.5) / 2, 0).rotateX(0.18).translate(w.x, 0, w.z + 1.2), 0xe8e8e6), tint(new THREE.CylinderGeometry(0.35, 0.6, w.r + 3.5, 8).translate(0, (w.r + 3.5) / 2, 0).rotateX(-0.18).translate(w.x, 0, w.z - 1.2), 0xe8e8e6)]);
  }
  bridges() {
    // the pedestrian bridges: open decks with glass sides; at each corner a landing with two escalators (up and down)
    // and a stair between them, running down onto the plaza; people riding them, crossing, stopping to look
    const P = [], Gl = [], S = [], dk = 4.6, w = 2.6, deckTop = dk + 0.3;
    this.bridgePaths = [];
    const deck = (x0, z0, x1, z1) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0), alX = z0 === z1;
      P.push(alX ? box(L, 0.6, w, cx, dk, cz, 0xdcd6ca) : box(w, 0.6, L, cx, dk, cz, 0xdcd6ca));
      for (const s of [-1, 1]) {
        Gl.push(alX ? box(L, 1.1, 0.04, cx, deckTop + 0.55, cz + s * w / 2, 0xbfe6ff) : box(0.04, 1.1, L, cx + s * w / 2, deckTop + 0.55, cz, 0xbfe6ff));
        S.push(alX ? box(L, 0.07, 0.09, cx, deckTop + 1.12, cz + s * w / 2, 0xd8dcdf) : box(0.09, 0.07, L, cx + s * w / 2, deckTop + 1.12, cz, 0xd8dcdf));
        S.push(alX ? box(L, 0.05, 0.05, cx, deckTop + 0.12, cz + s * (w / 2 - 0.05), 0xffffff) : box(0.05, 0.05, L, cx + s * (w / 2 - 0.05), deckTop + 0.12, cz, 0xffffff));
      }
      // people stopping on the bridge to look down the Strip
      this.city.crowds.push({ x: cx + (alX ? rand(-L / 4, L / 4) : 0), z: cz + (alX ? 0 : rand(-L / 4, L / 4)), r: 0.6, n: Math.round(rand(3, 6)), y: deckTop, look: 'tourist', act: 'spect', stay: true });
    };
    // an escalator from the deck (at x = ax) down to the ground, running along x in direction dir
    const RUN = 7, ang = Math.atan2(dk, RUN), SL = Math.hypot(RUN, dk);
    const escalator = (ax, z, dir) => {
      const cx = ax + dir * RUN / 2, rot = (g3) => g3.rotateZ(dir > 0 ? -ang : ang);
      // the stainless truss under the steps, and the steps themselves
      P.push(tint(rot(new THREE.BoxGeometry(SL, 0.5, 0.86)).translate(cx, dk / 2 - 0.3, z), 0xc8ccd2));
      const N = 22;
      for (let k = 0; k < N; k++) { const u = (k + 0.5) / N, y = dk * (1 - u); P.push(box(RUN / N + 0.01, 0.1, 0.7, ax + dir * RUN * u, y - 0.04, z, k % 2 ? 0x55585e : 0x6a6d72)); }
      // glass balustrades both sides, the black handrails, the comb plates at top and bottom
      for (const s of [-1, 1]) {
        Gl.push(tint(rot(new THREE.BoxGeometry(SL, 0.75, 0.03)).translate(cx, dk / 2 + 0.42, z + s * 0.4), 0xbfe6ff));
        S.push(tint(rot(new THREE.BoxGeometry(SL + 0.3, 0.06, 0.07)).translate(cx, dk / 2 + 0.8, z + s * 0.4), 0x111111));
        S.push(tint(rot(new THREE.BoxGeometry(SL, 0.04, 0.04)).translate(cx, dk / 2 + 0.08, z + s * 0.36), 0xffffff));
      }
      P.push(box(1.1, 0.08, 0.9, ax + dir * (RUN + 0.5), 0.04, z, 0x9a9da2));
    };
    // a corner landing; the two escalators run outward along the cross street's sidewalk (lanes nearest the road)
    const corner = (x, z, dir, nz) => {
      const sg = Math.sign(z - nz), lanes = [nz + sg * 3.7, nz + sg * 4.6], lz = nz + sg * 5.2;
      P.push(box(2.8, 0.6, 4, x, dk, lz, 0xdcd6ca), box(0.9, dk, 0.9, x, dk / 2, z, 0xd8d0c0));
      for (const l of lanes) escalator(x + dir * 1.4, l, dir);
      return lanes;
    };
    const paths = [];
    for (const nz of [60, -24]) {
      const cs = [[-9.7, nz - 5.8], [9.7, nz - 5.8], [9.7, nz + 5.8], [-9.7, nz + 5.8]];
      deck(-9.7, nz - 5.8, 9.7, nz - 5.8); deck(-9.7, nz + 5.8, 9.7, nz + 5.8); deck(-9.7, nz - 5.8, -9.7, nz + 5.8); deck(9.7, nz - 5.8, 9.7, nz + 5.8);
      const ln = cs.map(([x, z]) => corner(x, z, Math.sign(x), nz));
      paths.push([cs[0], cs[1], ln[0], ln[1]], [cs[3], cs[2], ln[3], ln[2]]);
    }
    for (const z of [-81.5, -91.8]) { deck(-9.7, z, 9.7, z); const a2 = corner(-9.7, z, -1, -86), b2 = corner(9.7, z, 1, -86); paths.push([[-9.7, z], [9.7, z], a2, b2]); }
    this.add(P); this.add(S, this.metal); this.add(Gl, this.clearGlass, false);
    // the riders: up an escalator, across, down the far one (and back), at walking pace on the deck
    for (const [[ax, az], [bx, bz], la, lb] of paths) {
      const sa = Math.sign(ax), sb = Math.sign(bx);
      this.bridgePaths.push([[ax + sa * (1.4 + RUN + 0.6), 0, la[0]], [ax + sa * 1.4, deckTop, la[0]], [ax, deckTop, az], [bx, deckTop, bz], [bx + sb * 1.4, deckTop, lb[1]], [bx + sb * (1.4 + RUN + 0.6), 0, lb[1]]]);
    }
    this.riders();
  }
  // people riding the escalators and crossing the bridges: simple figures following the bridge paths
  riders() {
    const body = mergeGeometries([tint(new THREE.CylinderGeometry(0.066, 0.056, 0.24, 7).scale(1, 1, 0.62).translate(0, 0.43, 0), 0xffffff), tint(new THREE.CylinderGeometry(0.024, 0.02, 0.31, 5).translate(0.034, 0.155, 0), 0x2a3448), tint(new THREE.CylinderGeometry(0.024, 0.02, 0.31, 5).translate(-0.034, 0.155, 0), 0x2a3448), tint(new THREE.CylinderGeometry(0.018, 0.014, 0.24, 5).translate(0.084, 0.42, 0), 0xffffff), tint(new THREE.CylinderGeometry(0.018, 0.014, 0.24, 5).translate(-0.084, 0.42, 0), 0xffffff)]);
    const head = mergeGeometries([tint(new THREE.SphereGeometry(0.048, 8, 6).translate(0, 0.625, 0), 0xffffff), tint(new THREE.SphereGeometry(0.052, 8, 4, 0, 6.28, 0, 1.6).translate(0, 0.632, -0.005), 0x2a2018)]);
    const n = this.bridgePaths.length * 9;
    this.rB = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), n);
    this.rH = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), n);
    for (const m of [this.rB, this.rH]) { m.frustumCulled = false; m.castShadow = true; this.scene.add(m); }
    this.rList = [];
    const SH = [0xffffff, 0x0e0e10, 0xff8fa3, 0x4fc3f7, 0xfff176, 0xb3141c, 0x81c784, 0xf28c28, 0xba68c8], SK = [0xe8c4a8, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0];
    for (let i = 0; i < n; i++) {
      this.rB.setColorAt(i, new THREE.Color(pick(SH))); this.rH.setColorAt(i, new THREE.Color(pick(SK)));
      this.rList.push({ path: this.bridgePaths[i % this.bridgePaths.length], u: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, v: rand(0.04, 0.07), ph: rand(0, 6), side: rand(-0.35, 0.35) });
    }
  }
  updateRiders(dt) {
    if (!this.rList) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    this.rList.forEach((r, i) => {
      r.u += r.dir * r.v * dt;
      if (r.u > 1) { r.u = 1; r.dir = -1; } else if (r.u < 0) { r.u = 0; r.dir = 1; }
      const W = r.path, segs = W.length - 1, f = r.u * segs, k = Math.min(segs - 1, Math.floor(f)), t = f - k, a = W[k], b = W[k + 1];
      const onEsc = k === 0 || k === segs - 1;
      p.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
      const dx = (b[0] - a[0]) * r.dir, dz = (b[2] - a[2]) * r.dir;
      if (!onEsc) p.z += r.side * (Math.abs(b[0] - a[0]) > 0.5 ? 1 : 0), p.x += r.side * (Math.abs(b[2] - a[2]) > 0.5 ? 1 : 0);
      p.y += onEsc ? 0 : Math.abs(Math.sin(G.time * 7 + r.ph)) * 0.02;
      q.setFromAxisAngle(up, Math.atan2(dx, dz));
      m4.compose(p, q, one); this.rB.setMatrixAt(i, m4); this.rH.setMatrixAt(i, m4);
    });
    this.rB.instanceMatrix.needsUpdate = true; this.rH.instanceMatrix.needsUpdate = true;
  }
  welcome() {
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
    }, 0, 5.4, z + 0.16, 0, 0.7, true);
    this.city.crowds.push({ x: 1.2, z: z + 1.4, r: 0.8, n: 5, look: 'tourist', act: 'film', face: { x: 0, z } });
  }
  clubs(list, chapel) {
    // the gentlemen's clubs: a neon name, a pink-lit canopy, a dancer on the little stage out front
    for (const c of list) {
      const fx = Math.sin(c.face), fz = Math.cos(c.face);
      this.sign(4, 1.1, this.text(c.name, '800 $px Arial', '#ff4fc8', '#ff4fc8'), c.x + fx * 0.05, 3.4, c.z + fz * 0.05, c.face, 1.4);
      this.add([box(fz ? 3.4 : 1.4, 0.12, fz ? 1.4 : 3.4, c.x + fx * 0.7, 2.4, c.z + fz * 0.7, 0x3a0a2a), cyl(0.4, 0.4, 0.3, c.x + fx * 1.0, 0.15, c.z + fz * 1.0, 0x2a0a20, 12), cyl(0.03, 0.03, 2.2, c.x + fx * 1.0, 1.4, c.z + fz * 1.0, 0xe8e8e8, 6)]);
      this.add([box(fz ? 3.4 : 0.06, 0.06, fz ? 0.06 : 3.4, c.x + fx * 1.4, 2.34, c.z + fz * 1.4, 0xff3bd4)], this.neon, false);
    }
    if (chapel) {
      this.sign(3.6, 1, this.text('LITTLE WEDDING CHAPEL', '700 $px Georgia', '#d81b60', '#ff8fc0'), chapel.x + 0.05, 2.2, chapel.z, Math.PI / 2, 1);
      this.add([tint(hipRoof(3, 3, 2).translate(chapel.x - 4, 1.6, chapel.z), 0xf2f2ee), cyl(0.06, 0.06, 1.6, chapel.x - 4, 4.2, chapel.z, 0xe8e8e8)]);
    }
  }
  site(s) {
    const P = [];
    for (const [x, z] of [[20, 76], [38, 88]]) P.push(box(0.6, 26, 0.6, x, 13, z, 0xf2c230), box(16, 0.6, 0.6, x + 4, 26, z, 0xf2c230), box(2, 1.4, 1.4, x - 3, 25.6, z, 0x6a6a6a), box(0.04, 10, 0.04, x + 8, 21, z, 0x222222));
    this.add(P);
  }
  saharaSign(sahara) {
    const sh = topOf(sahara[0]); hangOn(sahara[0], [this.sign(6, 1.2, this.text('SAHARA', '700 $px Georgia', '#ffe6b0', '#ffb84a'), sh.bx + 0.1, sh.y - 1, sh.cz, Math.PI / 2, 1.1)], sahara[0].floors - 1);
  }
  strat(s, sahara) {
    // the STRAT: the tapering white needle on its three fins, the pod with its rings, the mast and the thrill rides
    const t = topOf(s), P = [];
    for (const a of [0, 2.09, 4.19]) P.push(tint(new THREE.BoxGeometry(1.2, t.y * 0.92, 3.4).translate(0, t.y * 0.46, 2.6).rotateY(a).translate(t.cx, 0, t.cz), 0xeeeae2));
    P.push(cyl(5, 3.6, 3, t.cx, t.y + 1.5, t.cz, 0xdedad2, 24), cyl(5.6, 5.6, 1, t.cx, t.y + 3.4, t.cz, 0x6a7a8a, 24), cyl(5, 5.6, 2.4, t.cx, t.y + 5.1, t.cz, 0xdedad2, 24), cyl(4.2, 5, 1.6, t.cx, t.y + 7.1, t.cz, 0xc8c4bc, 24), cyl(0.4, 0.7, 16, t.cx, t.y + 15.9, t.cz, 0xd8d8d8, 8));
    P.push(box(0.5, 6, 0.5, t.cx + 4, t.y + 11, t.cz, 0xd84a2a), box(3, 0.3, 0.3, t.cx + 5, t.y + 14, t.cz, 0xd84a2a));
    hangOn(s, [this.add(P)], s.floors - 1);
    this.stratTop = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6).translate(t.cx, t.y + 24.2, t.cz), new THREE.MeshBasicMaterial({ color: 0xff2a2a })); this.scene.add(this.stratTop); hangOn(s, [this.stratTop], s.floors - 1);
    const ring = this.add([cyl(5.65, 5.65, 0.35, t.cx, t.y + 3.1, t.cz, 0xffd84a, 24)], this.neon, false); hangOn(s, [ring], s.floors - 1);
    this.sign(6, 1.2, this.text('THE STRAT', '800 $px Arial', '#ffffff', '#ff3a2a'), t.cx - 5.7, t.y - 4, t.cz, -Math.PI / 2, 1.2);
    const sh = topOf(sahara[0]); hangOn(sahara[0], [this.sign(6, 1.2, this.text('SAHARA', '700 $px Georgia', '#ffe6b0', '#ffb84a'), sh.bx + 0.1, sh.y - 1, sh.cz, Math.PI / 2, 1.1)], sahara[0].floors - 1);
  }
  crowns(R) {
    const put = (b, txt2, col, glow) => { const t = topOf(b), w = t.cx < 0; const s = this.sign(Math.max(4, t.d * 0.95), 1.3, this.text(txt2, '700 $px Arial', col, glow), w ? t.bx + 0.12 : t.ax - 0.12, t.y - 1, t.cz, w ? Math.PI / 2 : -Math.PI / 2, 1); hangOn(b, [s], b.floors - 1); };
    put(R.park, 'PARK MGM', '#f2e6c8', '#ffd890'); put(R.luxor.zig[0], 'LUXOR', '#e8f0ff', '#9fc0ff'); put(R.excalibur.towers[0], 'EXCALIBUR', '#ffe0a0', '#ff9a50');
    put(R.harrahs[0], "HARRAH'S", '#ff4a3a', '#ff8a6a'); put(R.linq, 'THE LINQ', '#ffffff', '#88ccff'); put(R.flamingo[0], 'FLAMINGO', '#ff6ab0', '#ff6ab0');
    put(R.venetian[0], 'THE VENETIAN', '#f6e8c8', '#ffd890'); put(R.palazzo, 'THE PALAZZO', '#f6e8c8', '#ffd890'); put(R.paris.tower, 'PARIS', '#ffffff', '#ffccdd');
    put(R.mgm.wings[0], 'MGM GRAND', '#f2e2a0', '#d4ffd8'); put(R.aria[2], 'ARIA', '#ffffff', '#cfe8ff'); put(R.rw[1], 'RESORTS WORLD', '#ffffff', '#ff6a6a');
  }
  // casino pylons by the Strip: the name in lights, an LED screen, a running border of bulbs
  pylons(list) {
    const P = [], bulbs = [];
    list.forEach((p, k) => {
      const ry = p.x < 0 ? Math.PI / 2 : -Math.PI / 2, s = -Math.sign(p.x);   // the faces toward the Strip
      P.push(box(0.9, p.h, 0.9, p.x, p.h / 2, p.z, 0x2a2a30), box(0.8, 3.4, 4, p.x, p.h + 1.7, p.z, 0x1a1a20));
      this.sign(3.8, 1.3, this.text(p.name, '800 $px Arial', p.col, p.glow), p.x + s * 0.42, p.h + 2.6, p.z, ry, 1.3);
      this.screen(3.6, 1.6, p.x + s * 0.42, p.h + 0.95, p.z, ry, k);
      for (let i = 0; i < 18; i++) { const u = i / 17; bulbs.push(sph(0.08, p.x + s * 0.43, p.h + 0.05, p.z - 2 + u * 4, 0xffe4a0, 5, 4), sph(0.08, p.x + s * 0.43, p.h + 3.35, p.z - 2 + u * 4, 0xffe4a0, 5, 4)); }
    });
    this.add(P); this.bulbs = this.add(bulbs, this.neon, false);
  }
  // LED walls on the filler casinos and shop fronts
  screens(list) { list.forEach((s, k) => { const m = this.screen(s.w, s.h, s.x + (s.x < 0 ? 0.06 : -0.06), s.y, s.z, s.ry, k); hangOn(s.b, [m]); }); }
  // neon outlines on the filler casinos: tubes along the roof edges and a sign band, bright after dark
  neonEdges(list) {
    const byCol = new Map();
    for (const n of list) {
      const t = topOf(n.b), c = n.col, L = byCol.get(c) || [];
      L.push(box(t.w + 0.1, 0.1, 0.1, t.cx, t.y + 0.05, t.az, c), box(t.w + 0.1, 0.1, 0.1, t.cx, t.y + 0.05, t.bz, c), box(0.1, 0.1, t.d, t.ax, t.y + 0.05, t.cz, c), box(0.1, 0.1, t.d, t.bx, t.y + 0.05, t.cz, c));
      const fx = n.side < 0 ? t.bx + 0.06 : t.ax - 0.06; L.push(box(0.06, 0.08, t.d * 0.9, fx, 1.9, t.cz, c), box(0.06, 0.08, t.d * 0.9, fx, 2.2, t.cz, c));
      byCol.set(c, L);
      const nm = pick(['SLOTS', 'CASINO', 'BAR · GRILL', 'SHOW TONIGHT', 'ABC STORE', 'TATTOO', 'BUFFET', 'POKER', 'SPORTSBOOK', 'CLUB', 'DAIQUIRIS', 'GIFTS']);
      if (!n.scr) hangOn(n.b, [this.sign(Math.min(5.4, t.d * 0.9), 0.9, this.text(nm, '800 $px Arial', '#ffffff', c), fx + (n.side < 0 ? 0.02 : -0.02), 2.9, t.cz, n.side < 0 ? Math.PI / 2 : -Math.PI / 2, 1.2)]);
    }
    for (const [c, L] of byCol) {
      const col = new THREE.Color(c);
      const m = new THREE.Mesh(mergeGeometries(L.map((g3) => { g3.deleteAttribute('color'); return g3; })), new THREE.MeshBasicMaterial({ color: col }));
      m.userData.base = col.clone(); this.scene.add(m); (this.neonMeshes ||= []).push(m);
    }
  }
  // the east end: 7-Eleven canopies and pole signs, the clubs' big pink letters and flags, casino signs with bulbs,
  // motel signs; tents, shopping carts, dumpsters, graffiti; a couple of streetlights that flicker
  dark(D) {
    if (!D) return;
    const P = [], L = [];
    const elevenTex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h); const st = [['#f28a1a', 0.12], ['#0e7a4a', 0.38], ['#d8222a', 0.66]]; for (const [col, y] of st) { c.fillStyle = col; c.fillRect(0, h * y, w, h * 0.18); } c.fillStyle = '#fff'; c.fillRect(w * 0.44, 0, w * 0.12, h); c.font = `900 ${h * 0.7}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f28a1a'; c.fillText('7', w * 0.5, h * 0.48); });
    const poleTex = canvasTex(64, 96, (c, w, h) => { c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h); c.fillStyle = '#0e7a4a'; c.fillRect(3, 3, w - 6, h * 0.72); c.fillStyle = '#fff'; c.fillRect(8, 8, w - 16, h * 0.62); c.fillStyle = '#f28a1a'; c.font = `900 ${h * 0.5}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', w / 2, h * 0.32); c.fillStyle = '#0e7a4a'; c.font = `900 ${h * 0.13}px Arial`; c.fillText('ELEVEN', w / 2, h * 0.6); c.fillStyle = '#ff2a8a'; c.fillRect(3, h * 0.8, w - 6, h * 0.16); c.fillStyle = '#ffe24a'; c.font = `900 ${h * 0.1}px Arial`; c.fillText('SLURPEE', w / 2, h * 0.88); });
    for (const lot of D.lots) {
      const b = lot.b; if (!b) continue;
      const fr = lot.front, s = -lot.dir, ry = lot.ry, t = topOf(b);
      if (lot.kind === '711') {
        // the striped fascia across the front and the corner pole sign
        const m = new THREE.Mesh(new THREE.PlaneGeometry(lot.w - 0.5, 1.1), new THREE.MeshStandardMaterial({ map: elevenTex, emissiveMap: elevenTex, emissive: 0xffffff, emissiveIntensity: 0.3 }));
        m.position.set(fr + s * 0.08, t.y - 0.55, lot.z); m.rotation.y = ry; this.scene.add(m); this.signs.push(m.material); hangOn(b, [m]);
        P.push(box(0.5, t.y + 0.2, lot.w - 0.3, fr + s * 0.25, (t.y + 0.2) / 2, lot.z, 0x8a3a2a));
        const px = lot.x - lot.dir * -0.8, pz = lot.z + lot.w / 2 - 0.6;
        P.push(box(0.2, 4.4, 0.2, px, 2.2, pz, 0xf2f2ee));
        const ps = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 1.4), new THREE.MeshStandardMaterial({ map: poleTex, emissiveMap: poleTex, emissive: 0xffffff, emissiveIntensity: 0.4 }));
        ps.position.set(px, 5.2, pz); this.scene.add(ps); this.signs.push(ps.material);
      } else if (lot.kind === 'club') {
        // big pink bulb letters over the door, the club's line underneath, a flag on top
        this.sign(Math.min(5, lot.w - 1), 1.6, (c, w, h) => { c.font = `900 ${h * 0.85}px Georgia, serif`; const fit = Math.min(1, (w * 0.94) / c.measureText(lot.name).width); c.font = `900 ${h * 0.85 * fit}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#7a1048'; c.strokeText(lot.name, w / 2, h / 2); c.fillStyle = '#ff6ac8'; c.fillText(lot.name, w / 2, h / 2); c.fillStyle = 'rgba(255,240,250,.9)'; for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(Math.random() * w, h * 0.2 + Math.random() * h * 0.6, 1.5, 0, 6.28); c.fill(); } }, fr + s * 0.1, t.y - 0.4, lot.z, ry, 1.4);
        this.sign(Math.min(5.5, lot.w - 1), 0.5, this.text("SHOWGIRLS · GENTLEMEN'S CLUB", '800 $px Arial', '#ffffff', '#ff8ad8'), fr + s * 0.1, t.y - 1.4, lot.z, ry, 1.1);
        P.push(box(0.12, 0.3, lot.w - 0.4, fr + s * 0.15, t.y - 1.9, lot.z, 0xe8e0d0), cyl(0.04, 0.05, 3, t.cx, t.y + 1.5, t.cz, 0xdddddd, 6));
        this.sign(1.2, 0.7, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#fff' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.4, h * 0.54); }, t.cx + 0.62, t.y + 2.6, t.cz, 0, 0.15, true);
      } else if (lot.kind === 'casino') {
        this.sign(Math.min(7, lot.w - 1), 1.2, this.text(lot.name, '900 $px Arial', '#fff4c0', '#ffb030'), fr + s * 0.1, t.y + 0.6, lot.z, ry, 1.4);
        for (let k = 0; k < 16; k++) L.push(sph(0.07, fr + s * 0.12, t.y + 1.25, lot.z - lot.w * 0.4 + k * lot.w * 0.8 / 15, 0xffe4a0, 5, 4), sph(0.07, fr + s * 0.12, t.y - 0.05, lot.z - lot.w * 0.4 + k * lot.w * 0.8 / 15, 0xffe4a0, 5, 4));
      } else if (lot.kind === 'motel') {
        const px = lot.x - lot.dir * -0.6, pz = lot.z - lot.w / 2 + 0.6;
        P.push(box(0.25, 4, 0.25, px, 2, pz, 0x3a3a3a));
        this.sign(3.2, 1.6, (c, w, h) => { c.fillStyle = '#1a3a5a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd34a'; c.font = `900 ${h * 0.22}px Georgia`; c.textAlign = 'center'; c.fillText(lot.name.replace(' MOTEL', '').replace(' INN', ''), w / 2, h * 0.35); c.fillStyle = '#ff3a3a'; c.font = `900 ${h * 0.2}px Arial`; c.fillText('MOTEL', w / 2, h * 0.62); c.fillStyle = '#5aff7a'; c.font = `700 ${h * 0.14}px Arial`; c.fillText('VACANCY · WEEKLY RATES', w / 2, h * 0.86); }, px, 5, pz, 0, 1.2, true);
        for (let k = 0; k < 4; k++) P.push(box(0.06, 1.1, 0.6, fr + s * 0.04, 0.55, lot.z - lot.w * 0.35 + k * lot.w * 0.23, 0x6a3a2a), box(0.06, 1.1, 0.6, fr + s * 0.04, 2.05, lot.z - lot.w * 0.35 + k * lot.w * 0.23, 0x6a3a2a));
        P.push(box(1, 0.08, lot.w - 0.6, fr + s * 0.5, 1.6, lot.z, 0xb8b0a0));
      }
    }
    // tents (tarp ridges), shopping carts, dumpsters, tags
    for (const tn of D.tents) { const g3 = new THREE.ConeGeometry(0.75, 0.8, 4).rotateY(Math.PI / 4).scale(1.4, 1, 1).rotateY(tn.ry).translate(tn.x, 0.4, tn.z); P.push(tint(g3, tn.col)); }
    for (const c of D.carts) P.push(box(0.5, 0.35, 0.8, c.x, 0.55, c.z, 0x9aa0a6), box(0.48, 0.05, 0.78, c.x, 0.3, c.z, 0x7a7f86), box(0.6, 0.3, 0.6, c.x + 0.2, 0.9, c.z, 0x3a3a3a));
    for (const d of D.dumpsters) P.push(box(0.9, 0.8, 1.6, d.x, 0.4, d.z, pick([0x2f5a3a, 0x2a3a5a, 0x5a3a2a])), box(0.95, 0.06, 1.65, d.x, 0.82, d.z, 0x222222), box(0.4, 0.3, 0.5, d.x + 0.5, 0.15, d.z + 0.6, 0x1a1a1a));
    for (let k = 0; k < 60; k++) { const a2 = pick(D.alleys); P.push(box(rand(0.2, 0.5), 0.2, rand(0.2, 0.5), a2.x + rand(-1.4, 1.4), 0.1, rand(a2.z0, a2.z1), pick([0x1a1a1a, 0x3a3a3a, 0x6a5a4a, 0x2a4a2a]))); }   // trash bags, boxes
    for (const gf of D.graffiti) {
      const cols = ['#ff3b8a', '#3bd4ff', '#ffd34a', '#7aff5a', '#ff7a2a', '#ffffff', '#b06aff'];
      this.sign(gf.w, 1.4, (c, w, h) => { for (let k = 0; k < 3; k++) { const x0 = Math.random() * w * 0.6; c.font = `900 italic ${h * (0.5 + Math.random() * 0.3)}px Impact, Arial`; c.lineWidth = 6; c.strokeStyle = '#111'; const tag = pick(['SK8', 'ZONE', 'KRS', 'LUCK', 'VGS', 'REAL', 'NO1', 'SIN', 'DUST', 'XO']); c.strokeText(tag, x0, h * (0.4 + Math.random() * 0.4)); c.fillStyle = pick(cols); c.fillText(tag, x0, h * (0.4 + Math.random() * 0.4)); } }, gf.x, 1.1, gf.z, gf.ry, 0.05);
    }
    this.add(P);
    if (L.length) { const m = this.add(L, this.neon, false); this.darkBulbs = m; }
    // a couple of failing streetlights
    this.flicker = this.city.lamps.filter((l) => l.x > 104).filter(() => Math.random() < 0.15);
  }
  // women working the clubs and the corners: bikinis and heels, curvy but in proportion; they shift their weight and sway
  girls(V) {
    const spots = [];
    const D = V.dark || { lots: [] };
    for (const l of D.lots) if (l.kind === 'club' && l.front != null) for (const dz of [-1.2, 1.2]) spots.push({ x: l.front + l.dir * -0.7, z: l.z + dz, h: l.dir > 0 ? -Math.PI / 2 : Math.PI / 2 });
    for (const c of V.clubs || []) for (const dz of [-1.6, 1.6]) spots.push({ x: c.x + Math.sin(c.face) * 1.6, z: c.z + Math.cos(c.face) * 1.6 + dz, h: c.face });
    for (const a2 of D.alleys || []) for (let k = 0; k < 2; k++) spots.push({ x: a2.x + rand(-6, -3.5), z: rand(a2.z0 + 4, a2.z1 - 4), h: rand(0, 6.28) });     // on the corners at the alley mouths
    for (const z of [-60, -36, -6, 26, 44, 70, 100, -110]) spots.push({ x: (z % 20 ? -1 : 1) * 8.3, z: z + rand(-1, 1), h: (z % 20 ? 1 : -1) * Math.PI / 2 });   // on the Strip, near the photo-posing showgirls
    for (const r of V.roofs) if (r.kind === 'club' && r.y != null) { const t = topOf(r.b); spots.push({ x: t.cx - t.w * 0.25, z: t.cz - t.d * 0.25, y: r.y, h: rand(0, 6.28), stage: true }, { x: t.cx + t.w * 0.2, z: t.cz - t.d * 0.25, y: r.y, h: rand(0, 6.28), stage: true }); }
    if (!spots.length) return;
    const SKIN = [0xe8c4a8, 0xd8a888, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0], BIK = [0x111111, 0xd8222a, 0xff3b9a, 0xf2f2f0, 0x7a2aff, 0xffd200, 0x1a8ad8], HAIR = [0x1a1410, 0x3a2418, 0xc9a86a, 0xe8d0a0, 0x8a2a2a, 0x111111];
    // one body, built round the origin, front = +z, ~0.74 tall (ped scale)
    const body = (skin, bik, hair, shoe) => {
      const P = [];
      const C = (r0, r1, h, x, y, z, c, rx = 0, rz = 0) => tint(new THREE.CylinderGeometry(r0, r1, h, 8).rotateX(rx).rotateZ(rz).translate(x, y, z), c);
      const E = (r, sx, sy, sz, x, y, z, c, ws = 10, hs = 8) => tint(new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z), c);
      for (const sx of [-1, 1]) {
        P.push(C(0.043, 0.03, 0.19, sx * 0.036, 0.29, 0, skin, 0, sx * 0.04));                  // thigh
        P.push(C(0.028, 0.019, 0.19, sx * 0.04, 0.11, -0.004, skin));                           // calf
        P.push(tint(new THREE.BoxGeometry(0.03, 0.045, 0.07).translate(sx * 0.04, 0.022, 0.012), shoe), C(0.006, 0.006, 0.04, sx * 0.04, 0.02, -0.02, shoe));   // heels
        P.push(C(0.016, 0.012, 0.22, sx * 0.09, 0.49, 0, skin, 0, sx * 0.18));                  // arms, a little out
        P.push(E(0.034, 1, 1, 0.95, sx * 0.027, 0.548, 0.032, bik, 8, 6));                       // bikini top
        P.push(C(0.003, 0.003, 0.08, sx * 0.022, 0.6, 0.02, bik, 0.3));                          // straps
      }
      P.push(E(0.078, 1.22, 0.78, 1.12, 0, 0.385, -0.014, skin));                                  // hips and seat
      P.push(tint(new THREE.SphereGeometry(0.0795, 12, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.3).scale(1.23, 0.78, 1.13).translate(0, 0.385, -0.014), bik));   // bikini bottom
      P.push(C(0.044, 0.05, 0.1, 0, 0.46, 0, skin));                                               // waist
      P.push(C(0.052, 0.044, 0.1, 0, 0.55, 0, skin));                                              // ribs
      P.push(C(0.017, 0.02, 0.05, 0, 0.615, 0, skin), E(0.046, 0.92, 1.08, 0.98, 0, 0.665, 0.004, skin));   // neck, head
      P.push(E(0.05, 1, 1, 1, 0, 0.675, -0.008, hair, 10, 6), tint(new THREE.BoxGeometry(0.085, 0.14, 0.03).translate(0, 0.6, -0.04), hair));   // long hair
      return mergeGeometries(P);
    };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const V2 = [];
    for (let k = 0; k < 8; k++) V2.push(body(SKIN[k % SKIN.length], BIK[(k * 3) % BIK.length], HAIR[(k * 5) % HAIR.length], k % 3 ? 0xf2f2f0 : 0x111111));
    this.girlSets = V2.map((geo) => { const m = new THREE.InstancedMesh(geo, mat, spots.length); m.count = 0; m.frustumCulled = false; m.castShadow = true; this.scene.add(m); return m; });
    this.girlList = spots.map((sp, i) => { const m = this.girlSets[i % V2.length]; const idx = m.count++; return { ...sp, m, idx, ph: rand(0, 6), y: sp.y || 0 }; });
    this.updateGirls();
  }
  updateGirls() {
    if (!this.girlList) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), t = G.time;
    for (const g2 of this.girlList) {
      const sway = g2.stage ? Math.sin(t * 2.6 + g2.ph) * 0.5 : Math.sin(t * 0.7 + g2.ph) * 0.15;
      q.setFromAxisAngle(up, g2.h + sway).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * (g2.stage ? 2.6 : 0.9) + g2.ph) * 0.05));
      p.set(g2.x, g2.y + (g2.stage ? Math.abs(Math.sin(t * 2.6 + g2.ph)) * 0.02 : 0), g2.z);
      m4.compose(p, q, sc); g2.m.setMatrixAt(g2.idx, m4);
    }
    for (const m of this.girlSets) m.instanceMatrix.needsUpdate = true;
  }
  // the big signs: LED "CASINO" ovals, neon "STRIP CLUB" with its reclining figure, "GIRLS" with dancers and an arrow
  bigSigns(V) {
    const casinoTex = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#060606'; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, 6.28); c.fill();
      for (let a = 0; a < 6.28; a += 0.075) { c.fillStyle = '#3aff5a'; c.beginPath(); c.arc(w / 2 + Math.cos(a) * (w / 2 - 16), h / 2 + Math.sin(a) * (h / 2 - 14), 5, 0, 6.28); c.fill(); }
      const o = document.createElement('canvas'); o.width = w; o.height = h; const ox = o.getContext('2d'); ox.font = `900 ${h * 0.46}px Arial`; ox.textAlign = 'center'; ox.textBaseline = 'middle'; ox.fillStyle = '#fff'; ox.fillText('CASINO', w / 2, h / 2 + 4);
      const d = ox.getImageData(0, 0, w, h).data; c.fillStyle = '#ff2a2a';
      for (let y = 6; y < h; y += 11) for (let x = 6; x < w; x += 11) if (d[(y * w + x) * 4 + 3] > 128) { c.beginPath(); c.arc(x, y, 4.2, 0, 6.28); c.fill(); }
    });
    const neon = (c, col, blur, lw) => { c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = blur; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; };
    const clubTex = canvasTex(512, 384, (c, w, h) => {
      const g2 = c.createLinearGradient(0, 0, w, h); g2.addColorStop(0, '#16083a'); g2.addColorStop(1, '#3a0a5a'); c.fillStyle = g2; c.fillRect(0, 0, w, h);
      neon(c, '#ffc02a', 18, 7); c.beginPath(); c.moveTo(70, 70); c.lineTo(70, 270); c.lineTo(440, 270); c.stroke(); c.beginPath(); c.moveTo(440, 256); c.lineTo(462, 270); c.lineTo(440, 284); c.stroke();
      c.beginPath(); c.moveTo(70, 66); c.bezierCurveTo(46, 40, 54, 22, 70, 40); c.bezierCurveTo(86, 22, 94, 40, 70, 66); c.stroke();
      // the reclining figure: a single neon line (head and hair, back, hip, the legs drawn up)
      neon(c, '#ff3bd4', 20, 6); c.beginPath();
      c.moveTo(118, 130); c.bezierCurveTo(112, 104, 140, 92, 150, 110); c.bezierCurveTo(160, 140, 170, 180, 200, 200); c.bezierCurveTo(232, 220, 246, 170, 270, 168); c.bezierCurveTo(300, 166, 312, 210, 360, 236); c.lineTo(420, 250); c.stroke();
      c.beginPath(); c.moveTo(150, 120); c.bezierCurveTo(140, 160, 120, 200, 104, 230); c.stroke(); c.beginPath(); c.moveTo(200, 210); c.bezierCurveTo(240, 236, 300, 244, 400, 252); c.stroke();
      c.shadowBlur = 22; c.fillStyle = '#3a6aff'; c.shadowColor = '#3a6aff'; c.font = '600 64px Arial'; c.textAlign = 'center'; c.fillText('STRIP CLUB', w / 2 + 10, 344);
    });
    const girlsTex = canvasTex(512, 384, (c, w, h) => {
      const g2 = c.createLinearGradient(0, 0, w, h); g2.addColorStop(0, '#2a1a8a'); g2.addColorStop(0.5, '#7a2ac8'); g2.addColorStop(1, '#2a0a3a'); c.fillStyle = g2; c.fillRect(0, 0, w, h);
      neon(c, '#ff6ad8', 16, 4); c.strokeRect(60, 30, 300, 190);
      for (const x0 of [110, 200, 290]) { c.beginPath(); c.arc(x0, 70, 14, 0, 6.28); c.stroke(); c.beginPath(); c.moveTo(x0 - 6, 84); c.bezierCurveTo(x0 - 22, 120, x0 + 10, 130, x0 - 14, 160); c.lineTo(x0 - 22, 212); c.moveTo(x0 + 6, 84); c.bezierCurveTo(x0 + 22, 118, x0 + 4, 134, x0 + 18, 160); c.lineTo(x0 + 24, 212); c.moveTo(x0 - 8, 92); c.lineTo(x0 - 30, 60); c.moveTo(x0 + 8, 92); c.lineTo(x0 + 26, 64); c.stroke(); }
      neon(c, '#ff2a6a', 20, 6); c.beginPath(); c.moveTo(60, 250); c.lineTo(370, 250); c.lineTo(370, 228); c.lineTo(470, 290); c.lineTo(370, 352); c.lineTo(370, 330); c.lineTo(60, 330); c.closePath(); c.stroke();
      c.shadowBlur = 18; c.fillStyle = '#ff6ad8'; c.font = 'italic 900 70px Arial'; c.textAlign = 'center'; c.fillText('GIRLS', 220, 314);
    });
    const mats = [casinoTex, clubTex, girlsTex].map((t) => { const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.6, transparent: true, alphaTest: 0.05, roughness: 0.5 }); this.signs.push(m); return m; });
    const P = [];
    const put = (b, kind, faceX) => {
      const t = topOf(b), w = kind === 0 ? 6 : 5.4, h = kind === 0 ? 3 : 4, y = t.y + h / 2 + 0.5;
      const x = faceX < 0 ? t.ax + 0.6 : t.bx - 0.6, ry = faceX < 0 ? -Math.PI / 2 : Math.PI / 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[kind]); m.position.set(x, y, t.cz); m.rotation.y = ry; this.scene.add(m);
      P.push(box(0.15, h * 0.6 + 0.5, 0.15, x - faceX * 0.3, t.y + (h * 0.6 + 0.5) / 2, t.cz - w * 0.3, 0x2a2a2e), box(0.15, h * 0.6 + 0.5, 0.15, x - faceX * 0.3, t.y + (h * 0.6 + 0.5) / 2, t.cz + w * 0.3, 0x2a2a2e));
      hangOn(b, [m], b.floors - 1);
    };
    // casinos along the Strip (every few fillers), the east end's casinos and clubs, the clubs on Industrial Road
    V.neon.forEach((n, i) => { if (Math.abs(n.b.x) < 30 && n.b.floors <= 4 && i % 3 === 0) put(n.b, Math.random() < 0.7 ? 0 : 2, n.side < 0 ? 1 : -1); });
    for (const l of (V.dark || { lots: [] }).lots) if (l.b && (l.kind === 'club' || l.kind === 'casino')) put(l.b, l.kind === 'casino' ? 0 : Math.random() < 0.5 ? 1 : 2, -l.dir);
    for (const c of V.clubs || []) if (c.b) put(c.b, Math.random() < 0.5 ? 1 : 2, Math.sin(c.face) > 0 ? 1 : -1);
    if (P.length) this.add(P);
  }
  // people out on bikes in the suburb, riding up and down its streets
  bikes(rows) {
    this.bikers = [];
    const wheel = new THREE.TorusGeometry(0.12, 0.018, 6, 16);
    for (let k = 0; k < Math.min(12, rows.length * 2); k++) {
      const g3 = new THREE.Group(), frame = new THREE.MeshStandardMaterial({ color: pick([0xc8102e, 0x2a6ad8, 0x1a1a1a, 0x2aa86a, 0xf2c230]), roughness: 0.4, metalness: 0.5 });
      const shirt = new THREE.MeshStandardMaterial({ color: pick([0xff8fa3, 0x4fc3f7, 0xfff176, 0xffffff, 0x81c784, 0xff7043]) }), skin = new THREE.MeshStandardMaterial({ color: pick([0xe8c4a8, 0xc99b78, 0x9a6b4c, 0xf0d6c0]) });
      for (const z of [-0.22, 0.22]) { const w = new THREE.Mesh(wheel, new THREE.MeshStandardMaterial({ color: 0x111111 })); w.rotation.y = Math.PI / 2; w.position.set(0, 0.12, z); g3.add(w); }
      g3.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.44).translate(0, 0.24, 0), frame), new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03).translate(0, 0.3, -0.08), frame), new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.02).translate(0, 0.38, 0.18), frame));
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.22, 7).rotateX(0.35).translate(0, 0.52, -0.02), shirt); g3.add(body);
      g3.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6).translate(0, 0.68, 0.03), skin), new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 5, 0, 6.28, 0, 1.6).translate(0, 0.69, 0.03), new THREE.MeshStandardMaterial({ color: pick([0x111111, 0xc8102e, 0xf2f2ee]) })));
      const legs = [-1, 1].map((sx) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.26, 5).translate(0, -0.13, 0), new THREE.MeshStandardMaterial({ color: 0x2a3448 })); l.position.set(sx * 0.04, 0.42, -0.06); g3.add(l); return l; });
      this.scene.add(g3);
      const row = rows[k % rows.length];
      this.bikers.push({ g: g3, legs, row, x: rand(112, 170), dir: Math.random() < 0.5 ? 1 : -1, v: rand(2.2, 3.4), ph: rand(0, 6) });
    }
  }
  // the resort towers' crowns: a band of light round each top, warm white (MGM green, Wynn gold, the Cosmo violet...)
  crownLights(list) {
    const L = [];
    for (const b of list) {
      const t = topOf(b), y = t.y - 0.25;
      L.push(box(t.w + 0.14, 0.18, 0.06, t.cx, y, t.az - 0.04, 0xffffff), box(t.w + 0.14, 0.18, 0.06, t.cx, y, t.bz + 0.04, 0xffffff), box(0.06, 0.18, t.d + 0.14, t.ax - 0.04, y, t.cz, 0xffffff), box(0.06, 0.18, t.d + 0.14, t.bx + 0.04, y, t.cz, 0xffffff));
    }
    if (!L.length) return;
    const m = new THREE.Mesh(mergeGeometries(L.map((g3) => { g3.deleteAttribute('color'); return g3; })), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
    m.userData.base = new THREE.Color(0xffe2a8); this.scene.add(m); (this.neonMeshes ||= []).push(m);
  }
  // rooftop terraces: pools with loungers and umbrellas; clubs with a DJ booth, speakers, lights and a dance floor
  rooftops(list) {
    const P = [], L = [], spk = [];
    for (const r of list) {
      if (r.y == null) continue;
      const t = topOf(r.b), y = r.y;
      if (r.kind === 'pool') {
        P.push(box(t.w * 0.66, 0.1, t.d * 0.52, t.cx, y + 0.05, t.cz - t.d * 0.1, 0xe6dccb));
        const pw = new THREE.Mesh(new THREE.PlaneGeometry(t.w * 0.6, t.d * 0.45).rotateX(-Math.PI / 2), this.poolMat ||= waterMaterial({ pool: true, color: 0x2fb6c8, wakes: false }));
        pw.position.set(t.cx, y + 0.115, t.cz - t.d * 0.1); this.scene.add(pw); hangOn(r.b, [pw], r.b.floors - 1);
        for (let k = 0; k < 4; k++) { const x = t.cx - t.w * 0.3 + k * t.w * 0.2; P.push(box(0.35, 0.12, 0.9, x, y + 0.1, t.cz + t.d * 0.3, 0xf2f2ee), cyl(0.03, 0.03, 1, x + 0.3, y + 0.5, t.cz + t.d * 0.3, 0xdddddd, 4), cone(0.55, 0.3, x + 0.3, y + 1.05, t.cz + t.d * 0.3, pick([0xe83a3a, 0xf2f2ee, 0x2a8ad8, 0xf2c230]), 8)); }
      } else {
        P.push(box(t.w * 0.7, 0.06, t.d * 0.6, t.cx, y + 0.03, t.cz, 0x1a1a22), box(1.6, 0.9, 0.7, t.cx, y + 0.45, t.cz - t.d * 0.32, 0x101014));
        for (const sx of [-1, 1]) P.push(box(0.5, 1.4, 0.5, t.cx + sx * 1.3, y + 0.7, t.cz - t.d * 0.32, 0x101014));
        for (let k = 0; k < 6; k++) L.push(box(0.12, 0.12, 0.12, t.cx - t.w * 0.3 + k * t.w * 0.12, y + 2.4, t.cz, pick([0xff3bd4, 0x3bf0ff, 0xffd34a, 0x7aff5a])));
        for (let k = 0; k < 4; k++) P.push(cyl(0.03, 0.03, 2.4, t.cx + (k % 2 ? 1 : -1) * t.w * 0.33, y + 1.2, t.cz + (k < 2 ? 1 : -1) * t.d * 0.28, 0x2a2a2a, 4));
        if (r.name) hangOn(r.b, [this.sign(Math.min(4, t.w * 0.7), 0.8, this.text(r.name, '900 $px Arial', '#ffffff', '#ff3bd4'), t.cx, y + 2.4, t.cz - t.d * 0.32, 0, 1.4, true)]);
        spk.push({ x: t.cx, z: t.cz, s: r });
      }
    }
    if (P.length) this.add(P);
    if (L.length) this.clubLights = this.add(L, this.neon, false);
    this.radioSpots = spk;
  }

  // ---------- the Bellagio fountains: real-looking water — jets of white water with streaks rising, mist at the top
  fountains0(lake) {
    const N = 72, jets = [];
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1), z = lake.z0 + 1.2 + t * (lake.z1 - lake.z0 - 2.4), x = lake.x1 - 3.4 - Math.sin(t * Math.PI) * 6.5 - (k % 2) * 1.6;
      jets.push({ x, z, k, row: k % 2, h: 0, t });
    }
    // the jet: two crossed vertical quads; the shader draws a water column (narrow at the nozzle, spreading and
    // breaking into spray at the top) with streaks streaming up, white by day and gold-lit after dark
    const quad = (r) => { const g3 = new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0); if (r) g3.rotateY(Math.PI / 2); return g3; };
    const geo = mergeGeometries([quad(false), quad(true)]);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying float vH; uniform float uTime;
        void main() { vUv = uv; vec3 p = position; float w = mix(0.18, 1.0, pow(uv.y, 1.6)); p.x *= w; p.z *= w;
          vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0); vH = instanceMatrix[1][1]; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `varying vec2 vUv; varying float vH; uniform float uTime; uniform float uNight;
        float h1(float n) { return fract(sin(n) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = h1(i.x + i.y * 57.0), b = h1(i.x + 1.0 + i.y * 57.0), c = h1(i.x + (i.y + 1.0) * 57.0), d = h1(i.x + 1.0 + (i.y + 1.0) * 57.0); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
        void main() {
          float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;
          float col = smoothstep(1.0, 0.15, x) * (1.0 - smoothstep(0.8, 1.0, y));
          float streak = noise(vec2(vUv.x * 18.0, y * 6.0 - uTime * 4.0)) * 0.6 + noise(vec2(vUv.x * 40.0, y * 14.0 - uTime * 7.0)) * 0.4;
          float spray = smoothstep(0.45, 1.0, y) * noise(vec2(vUv.x * 10.0 + uTime, y * 10.0 - uTime * 2.0));
          float a = col * (0.35 + 0.65 * streak) * mix(0.95, 0.55, y) + spray * 0.35 * smoothstep(1.0, 0.3, x);
          vec3 day = vec3(0.92, 0.96, 1.0), night = vec3(1.0, 0.82, 0.48);
          gl_FragColor = vec4(mix(day, night, uNight) * (0.85 + 0.25 * streak), clamp(a, 0.0, 0.92) * step(0.05, vH));
          #include <colorspace_fragment>
        }`,
    });
    this.jets = new THREE.InstancedMesh(geo, mat, N); this.jets.frustumCulled = false; this.jets.renderOrder = 3; this.scene.add(this.jets);
    // mist that hangs over the water when the show is going
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false });
    this.mist = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8).scale(9, 2.2, (lake.z1 - lake.z0) * 0.5).translate(lake.x1 - 7, 3, (lake.z0 + lake.z1) / 2), mistMat);
    this.scene.add(this.mist);
    this.jetMat = mat; this.fountain = { jets, t: 15, show: 0, N };
  }

  // ---------- the world around: the Mojave, the roads in, the far ranges
  world(scene) {
    const r = rnd(1905);
    const Rr = (a, b) => a + r() * (b - a);
    const S = 2048, SIZE = 2600, k = S / SIZE, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), P = (v) => (v + SIZE / 2) * k;
    // the desert floor: light tan and orange sand, gravel washes, the dark specks of creosote
    x.fillStyle = '#d8bf92'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) { const g2 = x.createRadialGradient(Rr(0, S), Rr(0, S), 0, 0, 0, 0); x.fillStyle = pick(['rgba(220,190,140,.35)', 'rgba(200,165,115,.3)', 'rgba(232,210,170,.35)', 'rgba(190,150,100,.25)']); x.beginPath(); x.ellipse(Rr(0, S), Rr(0, S), Rr(20, 120), Rr(10, 60), Rr(0, 3), 0, 6.28); x.fill(); void g2; }
    for (let i = 0; i < 26000; i++) { x.fillStyle = `rgba(${pick(['110,105,60', '140,120,80', '170,140,95', '95,90,55'])},${Rr(0.2, 0.55)})`; x.fillRect(Rr(0, S), Rr(0, S), Rr(1, 2.4), Rr(1, 2.4)); }
    for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(235,220,190,.35)'; x.lineWidth = Rr(2, 6); x.beginPath(); let px = Rr(0, S), pz = Rr(0, S); x.moveTo(px, pz); for (let j = 0; j < 12; j++) { px += Rr(-40, 40); pz += Rr(10, 50); x.lineTo(px, pz); } x.stroke(); }   // dry washes
    // the valley's edge of town around the map, thinning quickly into open desert
    const blob = (cx, cz, rx, rz, col) => { x.save(); x.translate(P(cx), P(cz)); x.scale(1, rz / rx); const g2 = x.createRadialGradient(0, 0, 0, 0, 0, rx * k); g2.addColorStop(0, col); g2.addColorStop(0.75, col.replace(/[\d.]+\)$/, '0.5)')); g2.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); x.fillStyle = g2; x.beginPath(); x.arc(0, 0, rx * k, 0, 6.28); x.fill(); x.restore(); };
    // the roads: I-15 and Las Vegas Boulevard running in from far off; the airport's runways
    x.fillStyle = '#4a4b4e'; x.fillRect(P(I15 - 8), 0, 16 * k, S);
    x.fillStyle = '#bdb8ac'; x.fillRect(P(I15 - 0.3), 0, 0.6 * k + 0.5, S);
    x.fillStyle = '#4a4b4e'; x.fillRect(P(-STRIP), P(150), STRIP * 2 * k, S); x.fillStyle = '#9a9384'; x.fillRect(P(-0.6), P(150), 1.2 * k + 0.5, S);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    // a little edge-of-town development right around the map (motels, warehouses, a few houses), nothing far out
    const boxes = [];
    for (let i = 0; i < 0; i++) {   // (nothing built out there: just the desert)
      const bx = Rr(-330, 330), bz = Rr(-380, 320), d = Math.hypot(bx * 0.9, (bz + 40) * 0.8);
      if (Math.max(Math.abs(bx), Math.abs(bz)) < 182 || r() > Math.exp(-(d - 170) / 70) || bx < I15 + 12 || (Math.abs(bx) < 10 && bz > 150)) continue;   // nothing built west of I-15
      boxes.push([bx, bz, Rr(4, 10), Rr(4, 10), Rr(1.2, 3.6)]);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), Math.max(1, boxes.length));
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    boxes.forEach(([bx, bz, w, d, h], i) => { m4.makeScale(w, h, d).setPosition(bx, 0, bz); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHSL(Rr(0.06, 0.12), Rr(0.2, 0.4), Rr(0.7, 0.86), THREE.SRGBColorSpace)); });
    im.count = boxes.length; im.receiveShadow = true; im.castShadow = true; scene.add(im);
    // the Mojave: Joshua trees, cholla and barrel cacti, the odd saguaro, creosote everywhere
    this.desertPlants(scene, Rr, r);
    // the ranges, low and far: muted violet-brown silhouettes hazed into the sky (kept inside the camera's reach so
    // they never get clipped as you move around)
    const seg = 300, rings = 10, pos = [], cols = [], idx = [], Rin = 980, Rout = 1240;
    const Hf = (a, rr) => {
      const deg = ((a * 180 / Math.PI) % 360 + 360) % 360;
      const range = (c2, w, h) => h * Math.exp(-(((deg - c2 + 540) % 360 - 180) ** 2) / (2 * w * w));
      let h = 22 + range(185, 40, 95) + range(215, 20, 130) + range(150, 25, 55) + range(0, 28, 60) + range(330, 30, 50) + range(80, 30, 55) + range(270, 35, 30);
      h *= 0.75 + 0.18 * Math.sin(a * 13 + rr * 0.008) * Math.sin(a * 4.3 - rr * 0.003) + 0.05 * Math.sin(a * 37 + rr * 0.02);
      return Math.max(0, h * Math.sin(Math.PI * (rr - Rin) / (Rout - Rin)));
    };
    for (let j = 0; j <= rings; j++) for (let i = 0; i <= seg; i++) {
      const a = i / seg * 6.283, rr = Rin + (Rout - Rin) * j / rings, h = Hf(a, rr);
      pos.push(Math.cos(a) * rr, h, Math.sin(a) * rr);
      const cc = new THREE.Color().setHSL(0.04 + h / 2000, 0.16, 0.48 + h / 900, THREE.SRGBColorSpace);
      cols.push(cc.r, cc.g, cc.b);
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); mg.setIndex(idx); mg.computeVertexNormals();
    const mm = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
    mm.onBeforeCompile = (sh) => {
      sh.uniforms.uHaze = (this.hazeU = { value: new THREE.Color(0xe2d2b6) });
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHaze;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, 0.55);');
    };
    const mountains = new THREE.Mesh(mg, mm); mountains.frustumCulled = false; scene.add(mountains); this.mountains = mountains;
    // traffic on the roads in from the desert: I-15 the whole way through, Las Vegas Boulevard south of the map
    this.highway(scene);
    // billboards along the roads in and around the edges: the lawyers, the clubs, the shows, the liquor
    this.billboards(scene);
  }
  desertPlants(scene, Rr, r) {
    const out = (x, z) => (Math.abs(x) > 178 || Math.abs(z) > 178) && Math.abs(x - I15) > 12 && !(Math.abs(x) < 9 && z > 140) && Math.hypot(x, z + 40) < 1150;
    const place = (n, minR) => { const a = []; for (let i = 0; a.length < n && i < n * 6; i++) { const x = Rr(-1100, 1100), z = Rr(-1100, 1100); if (out(x, z) && Math.hypot(x, z) > minR) a.push([x, z, Rr(0.7, 1.4), Rr(0, 6.28)]); } return a; };
    // Joshua tree: a shaggy trunk splitting into crooked arms, each tipped with a spiky green tuft
    const jt = []; const arm = (x0, y0, ang, len, tilt) => { const g3 = new THREE.CylinderGeometry(0.09, 0.13, len, 5).translate(0, len / 2, 0).rotateZ(tilt).rotateY(ang).translate(x0, y0, 0); jt.push(tint(g3, 0x6a5a44)); const tip = new THREE.Vector3(0, len, 0).applyEuler(new THREE.Euler(0, 0, tilt)).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang); jt.push(tint(new THREE.IcosahedronGeometry(0.32, 0).scale(1, 1.3, 1).translate(x0 + tip.x, y0 + tip.y + 0.2, tip.z), 0x5f7a3a)); };
    jt.push(tint(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6).translate(0, 0.8, 0), 0x6a5a44));
    arm(0, 1.5, 0, 1.1, 0.7); arm(0, 1.5, 2.2, 1.3, 0.6); arm(0, 1.5, 4.1, 0.9, 0.8); arm(0, 1.6, 1.2, 1.4, 0.15);
    const jtGeo = mergeGeometries(jt);
    // saguaro: a ribbed column with two arms turning up
    const sg = [cyl(0.22, 0.26, 4.2, 0, 2.1, 0, 0x6f8a4a, 8), sph(0.22, 0, 4.2, 0, 0x6f8a4a, 8, 6)];
    for (const [s, h] of [[1, 1.9], [-1, 2.5]]) sg.push(tint(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 7).rotateZ(Math.PI / 2).translate(s * 0.5, h, 0), 0x6f8a4a), cyl(0.15, 0.15, 1.3, s * 0.8, h + 0.6, 0, 0x6f8a4a, 7), sph(0.15, s * 0.8, h + 1.25, 0, 0x6f8a4a, 7, 5));
    const sgGeo = mergeGeometries(sg);
    const barrel = mergeGeometries([tint(new THREE.SphereGeometry(0.3, 8, 6).scale(1, 1.2, 1).translate(0, 0.3, 0), 0x7a9a4a), cone(0.1, 0.12, 0, 0.68, 0, 0xe8b830, 6)]);
    const bush = tint(new THREE.IcosahedronGeometry(0.55, 0).scale(1, 0.6, 1).translate(0, 0.3, 0), 0x7a7a3e);
    const inst = (geo, list, s0, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      list.forEach(([x, z, s, a], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * s0, s * s0, s * s0)); m.setMatrixAt(i, m4); });
      m.count = list.length; m.castShadow = true; scene.add(m); return m;
    };
    const vm = new THREE.MeshLambertMaterial({ vertexColors: true });
    inst(jtGeo, place(1000, 0), 1.6, vm);
    inst(sgGeo, place(260, 220), 1.4, vm);
    inst(barrel, place(900, 0), 1.6, vm);
    inst(bush, place(3000, 0), 1.3, vm);
    // a few inside the map's empty desert corners too
    const inner = []; for (let i = 0; i < 160; i++) { const x = Rr(-175, -112), z = Rr(-175, 175); if (Math.abs(x - I15) > 10) inner.push([x, z, Rr(0.7, 1.2), Rr(0, 6)]); }
    inst(jtGeo, inner.slice(0, 60), 1.4, vm); inst(bush, inner, 1.1, vm);
  }
  highway(scene) {
    // cars on the open road: each lane a loop of cars spaced out, moving at highway speed
    const body = mergeGeometries([tint(new THREE.BoxGeometry(0.62, 0.32, 1.4).translate(0, 0.28, 0), 0xffffff), tint(new THREE.BoxGeometry(0.56, 0.24, 0.75).translate(0, 0.55, -0.08), 0x20262c)]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    const lanes = [];
    for (const o of [1.6, 3.4, 5.2, 7]) { lanes.push({ x: I15 + o, dir: -1, v: Rr2(13, 17), z0: -1250, z1: 1250 }); lanes.push({ x: I15 - o, dir: 1, v: Rr2(13, 17), z0: -1250, z1: 1250 }); }
    for (const o of [2.5, 4.3]) { lanes.push({ x: o, dir: -1, v: Rr2(9, 12), z0: 150, z1: 1250 }); lanes.push({ x: -o, dir: 1, v: Rr2(9, 12), z0: 150, z1: 1250 }); }
    function Rr2(a, b) { return a + Math.random() * (b - a); }
    const cars = [];
    for (const L of lanes) { const n = Math.round((L.z1 - L.z0) / Rr2(14, 22)); for (let i = 0; i < n; i++) cars.push({ L, z: L.z0 + Math.random() * (L.z1 - L.z0), v: L.v * Rr2(0.92, 1.08), truck: Math.random() < 0.12 }); }
    const im = new THREE.InstancedMesh(body, mat, cars.length);
    const COL = [0xf2f2f0, 0x1c1d22, 0x8a8f96, 0xc8102e, 0x1e3f73, 0xd8d8d4, 0x5a5f66, 0xb8b8b4, 0x2a4a7a, 0x7a1a1a];
    cars.forEach((c, i) => im.setColorAt(i, new THREE.Color(c.truck ? 0xf2f2ee : pick(COL))));
    im.frustumCulled = false; im.castShadow = true; scene.add(im);
    this.hw = { im, cars, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3() };
    this.updateHighway(0);
  }
  updateHighway(dt) {
    const H = this.hw; if (!H) return;
    H.cars.forEach((c, i) => {
      c.z += c.L.dir * c.v * dt;
      if (c.z > c.L.z1) c.z = c.L.z0; else if (c.z < c.L.z0) c.z = c.L.z1;
      H.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.L.dir > 0 ? 0 : Math.PI);
      const sc = c.truck ? H.s.set(1.2, 1.7, 3.2) : H.s.set(1, 1, 1);
      H.m4.compose(H.p.set(c.L.x, 0, c.z), H.q, sc); H.im.setMatrixAt(i, H.m4);
    });
    H.im.instanceMatrix.needsUpdate = true;
  }
  billboards(scene) {
    const spots = [];
    for (let z = -1000; z < 1100; z += 140) for (const s of [-1, 1]) if (Math.abs(z) > 200 || s < 0) spots.push({ x: I15 + s * 15, z: z + s * 40, ry: s < 0 ? Math.PI / 2 : -Math.PI / 2 });
    for (let z = 220, k = 0; z < 1100; z += 120, k++) spots.push({ x: k % 2 ? 13 : -13, z, ry: k % 2 ? -Math.PI / 2 : Math.PI / 2 });
    for (const [x, z, ry] of [[-118, 40, Math.PI / 2], [-118, -60, Math.PI / 2], [-118, 130, Math.PI / 2], [70, 150, 0], [-60, 160, 0], [120, -120, Math.PI], [-118, -140, Math.PI / 2]]) spots.push({ x, z, ry });
    const P = [];
    spots.forEach((s, i) => {
      const tex = adTex(i * 3 + 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.6, side: THREE.DoubleSide }));
      m.position.set(s.x, 9, s.z); m.rotation.y = s.ry; scene.add(m); this.signs.push(m.material);
      P.push(box(0.7, 7, 0.7, s.x, 3.5, s.z, 0xb8b0a4), box(Math.abs(Math.sin(s.ry)) > 0.5 ? 0.3 : 12.4, 4.4, Math.abs(Math.sin(s.ry)) > 0.5 ? 12.4 : 0.3, s.x - Math.sin(s.ry) * 0.2, 9, s.z - Math.cos(s.ry) * 0.2, 0x2a2a2e), box(Math.abs(Math.sin(s.ry)) > 0.5 ? 1.4 : 12, 0.1, Math.abs(Math.sin(s.ry)) > 0.5 ? 12 : 1.4, s.x, 6.7, s.z, 0x6a6a6e));
    });
    merged(P, this.mat, scene);
  }

  // ---------- per frame
  update(dt) {
    const t = G.time, n = G.night || 0;
    if (this.hazeU && this.scene.fog) this.hazeU.value.copy(this.scene.fog.color);
    this.neon.color.setScalar(0.5 + n * 1.3);
    for (const m of this.signs) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.35 + n * 1.4);
    for (const m of this.screenMats) m.color.setScalar(0.85 + n * 0.5);
    for (const m of this.neonMeshes || []) m.material.color.copy(m.userData.base).multiplyScalar(0.45 + n * 1.6);
    for (const m of this.arcades || []) m.emissiveIntensity = n * 1.3;
    if (this.eiffelMat) this.eiffelMat.emissiveIntensity = n * 0.9 + (n > 0.5 && (t % 3600) < 5 ? Math.random() * 1.5 : 0);
    if (this.beam) { const k = Math.pow(Math.max(0, (n - 0.45) / 0.55), 2); this.beam.material.opacity = k * 0.18; this.beamCore.material.opacity = k * 0.35; this.beamGlow.material.opacity = k * 0.35; }
    if (this.stratTop) this.stratTop.visible = Math.sin(t * 2.4) > 0;
    if (this.torch) this.torch.material.color.setScalar(0.8 + n);
    if (this.cabMat) this.cabMat.emissiveIntensity = n * 1.2;
    if (this.wheelLED) this.wheelLED.color.setHSL((t * 0.05) % 1, 0.9, 0.35 + n * 0.25, THREE.SRGBColorSpace);
    if (this.bulbs) this.bulbs.material.color.setScalar(0.4 + n * 1.2 + 0.4 * Math.max(0, Math.sin(t * 9)));
    if (this.clubLights) this.clubLights.material.color.setHSL((t * 0.3) % 1, 1, 0.3 + n * 0.3 + 0.2 * Math.max(0, Math.sin(t * 12)), THREE.SRGBColorSpace);
    if (this.wheelG) { const a = t * 0.02; this.cabins.forEach((m, k) => { const b = a + k / 28 * 6.283; m.position.set(Math.sin(b) * (this.wheelR + 0.4), Math.cos(b) * (this.wheelR + 0.4), 0); }); this.wheelG.children[0].rotation.z = -a; }
    for (const gd of this.gondolas || []) { gd.t = (gd.t + dt * 0.02) % 1; const u = gd.t < 0.5 ? gd.t * 2 : 2 - gd.t * 2; gd.m.position.set((gd.v.x0 + gd.v.x1) / 2 + (gd.t < 0.5 ? -0.8 : 0.8), 0.05, gd.v.z0 + 1.2 + u * (gd.v.z1 - gd.v.z0 - 2.4)); gd.m.rotation.y = gd.t < 0.5 ? 0 : Math.PI; }
    if (this.sphCtx && (this._sphT = (this._sphT || 0) - dt) <= 0) { this._sphT = 0.08; this.drawSphere(t); }
    // the ad reels: each screen changes ad every few seconds
    for (const r of this.reels) if (t > r.next) { r.next = t + 6 + Math.random() * 3; r.i++; this.drawReel(r); }
    this.updateHighway(dt);
    this.updateRiders(dt);
    this.updateGirls();
    for (const b of this.bikers || []) { b.x += b.dir * b.v * dt; if (b.x > 171 || b.x < 111) { b.dir *= -1; b.x = Math.max(111, Math.min(171, b.x)); } b.g.position.set(b.x, 0, b.row + (b.dir > 0 ? 0.8 : -0.8)); b.g.rotation.y = b.dir > 0 ? Math.PI / 2 : -Math.PI / 2; b.ph += dt * b.v * 3; b.legs[0].rotation.x = Math.sin(b.ph) * 0.7; b.legs[1].rotation.x = -Math.sin(b.ph) * 0.7; }
    if (this.flicker && G.city && (this._fl = (this._fl || 0) - dt) <= 0) { this._fl = rand(0.05, 0.4); for (const l of this.flicker) { l.flick = Math.random() < 0.4 ? 1 : 0; } }
    if (this.flashSprite && (this.flashT -= dt) <= 0) this.flashSprite.visible = false;
    this.trucks();
    // the rooftop clubs' music (the songs from the beach speakers), loudest by whichever club you're nearest
    if (this.radioSpots && this.radioSpots.length && !this.radioOn) { beachRadio.setList(CLUB_SET); beachRadio.start(this.radioSpots); this.radioOn = !!beachRadio.out; }
    this.sounds(dt);
    if (this.radioOn) beachRadio.update();
    this.fountains(dt);
  }
  // the sounds of the Strip, each from something you can see: the casino floor through the nearest doors, the crowd
  // at the nearest rooftop club, neon tubes humming right beside you after dark, phones snapping photos (with the
  // flash), people laughing in the groups on the sidewalk, dice at a casino door now and then
  sounds(dt) {
    const T = G.camTarget, n = G.night || 0, t = G.time; if (!T || !sfx.ready) return;
    if (!this.doors) {
      const V = this.city.vegas;
      this.doors = [...V.pylons.map((p) => ({ x: p.x, z: p.z })), ...V.neon.filter((q) => q.b.floors <= 4).map((q) => ({ x: q.b.x + (q.side < 0 ? q.b.w / 2 : -q.b.w / 2), z: q.b.z }))];
      this.neonSpots = V.neon.map((q) => ({ x: q.b.x + (q.side < 0 ? q.b.w / 2 : -q.b.w / 2), z: q.b.z }));
    }
    if (!this.snd) {
      const s = { casino: sfx.loop('casino', 0, 0), crowd: sfx.loop('clubCrowd', 0, 0), neon: sfx.loop('neon', 0, 0), water: sfx.loop('fountain', 0, 0) };
      if (!s.casino || !s.crowd || !s.neon || !s.water) { for (const l of Object.values(s)) l && l.stop(); return; }   // not loaded yet
      this.snd = s;
    }
    const nearest = (list) => { let b = null, bd = 1e9; for (const p of list) { const d = Math.hypot(p.x - T.x, p.z - T.z); if (d < bd) { bd = d; b = p; } } return [b, bd + T.dist * 0.12]; };
    const reach = (d, r0, r1) => Math.max(0, Math.min(1, 1 - (d - r0) / (r1 - r0)));
    const [door, dd] = nearest(this.doors);
    if (door) { this.snd.casino.move(door.x, door.z); this.snd.casino.set(0.55 * reach(dd, 4, 34)); }
    const [club, cd] = nearest(this.radioSpots || []);
    if (club) { this.snd.crowd.move(club.x, club.z); this.snd.crowd.set((0.15 + 0.4 * n) * reach(cd, 4, 36)); } else this.snd.crowd.set(0);
    const [neo, nd] = nearest(this.neonSpots);
    if (neo) { this.snd.neon.move(neo.x, neo.z); this.snd.neon.set(0.18 * n * reach(nd, 2, 14)); }
    // the Bellagio fountains: the rush of the jets while a show is on, louder the higher they fly
    if (this.fountain && this.lakeWater) { const L = this.lakeWater.position, lk = this.city.vegas.lake, lx = lk.x1 - 6, lz = Math.max(lk.z0, Math.min(lk.z1, T.z)); this.snd.water.move(lx, lz); this.snd.water.set(Math.min(1, (this.fountain.level || 0) * 1.4) * 0.7 * reach(Math.hypot(lx - T.x, lz - T.z) + T.dist * 0.12, 6, 45)); void L; }
    const A = G.agents; if (!A) return;
    const near = (f) => { const c = []; for (const p of A.peds) if (p.state === 'idle' && f(p) && Math.hypot(p.pos.x - T.x, p.pos.z - T.z) < 30) { c.push(p); if (c.length > 30) break; } return c.length ? pick(c) : null; };
    if ((this._shot = (this._shot ?? 2) - dt) <= 0) {
      this._shot = rand(10, 20);
      const p = near((q) => q.act === 'film');
      if (p) { sfx.once('shutter', p.pos.x, p.pos.z, 0.5, rand(0.95, 1.08)); this.flash(p.pos.x + Math.sin(p.heading) * 0.15, p.pos.y + 0.62, p.pos.z + Math.cos(p.heading) * 0.15); }
    }
    if ((this._laugh = (this._laugh ?? 4) - dt) <= 0) {
      this._laugh = rand(10, 22);
      const p = near((q) => q.group && !q.officer);
      if (p) { const man = Math.random() < 0.15 && t - (this._manLaugh || -1e9) > 75; if (man) this._manLaugh = t; sfx.once(man ? 'laughM' : 'laughW', p.pos.x, p.pos.z, man ? 0.3 : 0.4, rand(0.95, 1.06)); }
    }
    if ((this._dice = (this._dice ?? 8) - dt) <= 0) { this._dice = rand(12, 25); if (door && dd < 22) sfx.once('dice', door.x, door.z, 0.3); }
  }
  // a phone camera's flash: a quick white pop
  flash(x, y, z) {
    if (!this.flashSprite) { this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.flashSprite.scale.setScalar(0.7); this.scene.add(this.flashSprite); }
    this.flashSprite.position.set(x, y, z); this.flashSprite.visible = true; this.flashT = 0.09;
  }
  // billboard trucks: a few delivery-size trucks in traffic carry ads on both sides
  trucks() {
    const A = G.agents; if (!A) return;
    if (!this.truckList) {
      this.truckList = [];
      const vans = A.cars.filter((c) => !c.emerg && !c.moto && c.scale && c.scale[1] > 1.3 && c.scale[2] < 2 && c.state === 'drive').slice(0, 5);
      vans.forEach((c, k) => {
        c.scale = [1.2, 1.95, 2.1]; c.len = 0.8 * 2.1; c.color = new THREE.Color(0xf2f2f0); A.carBody.setColorAt(c.i, c.color); A.carBody.instanceColor.needsUpdate = true;
        const mat = new THREE.MeshBasicMaterial({ map: this.reels[k % this.reels.length].t, toneMapped: false, side: THREE.DoubleSide });
        this.screenMats.push(mat);
        const panels = [1, -1].map((s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), mat); m.userData.s = s; this.scene.add(m); return m; });
        this.truckList.push({ c, panels });
      });
    }
    for (const tr of this.truckList) {
      const c = tr.c, h = c.heading, vis = c.state !== 'hidden' && c.state !== 'air' && !c.dead;
      for (const m of tr.panels) {
        m.visible = vis; if (!vis) continue;
        const s = m.userData.s, ox = Math.cos(h) * 0.37 * s, oz = -Math.sin(h) * 0.37 * s;
        m.position.set(c.pos.x + ox - Math.sin(h) * 0.25, c.pos.y + 0.78, c.pos.z + oz - Math.cos(h) * 0.25); m.rotation.set(0, h + (s > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
      }
    }
  }
  fountains(dt) {
    const F = this.fountain; if (!F) return;
    this.jetMat.uniforms.uTime.value = G.time; this.jetMat.uniforms.uNight.value = G.night || 0;
    F.t -= dt;
    if (F.t <= 0 && F.show <= 0) { F.show = 40; F.t = 70 + Math.random() * 35; F.style = Math.floor(Math.random() * 4); G.news && Math.random() < 0.3 && G.news.post('LOCAL', 'The Bellagio fountains are dancing on the Strip', 1.2, 'fountains'); }
    const on = F.show > 0; if (on) F.show -= dt;
    const t = G.time, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const fade = on ? Math.min(1, (40 - F.show) / 2, F.show / 2.5) : 0;
    let tot = 0;
    for (const j of F.jets) {
      let h;
      if (!on) h = 0;
      else if (F.style === 0) h = 3 + 10 * Math.max(0, Math.sin(j.k * 0.32 - t * 3));                          // a wave running down the line
      else if (F.style === 1) h = (j.row ? 5 : 11) + 6 * Math.sin(t * 1.4 + j.k * 0.1);                    // two rows breathing
      else if (F.style === 2) h = (Math.sin(t * 0.9) > 0.5 && j.k % 4 === 0) ? 24 : 3 + 2.5 * Math.sin(j.k + t * 4);   // the shooters
      else h = 6 + 9 * Math.abs(Math.sin(t * 2 + Math.abs(j.t - 0.5) * 9));                              // swaying out from the centre
      if (on && F.show < 6) h = Math.max(h, 20 * (F.show < 3 && j.k % 3 === 0 ? 1.2 : 0.6));               // the finale
      j.h += (h * fade - j.h) * Math.min(1, dt * 5);
      const hh = Math.max(0.001, j.h); tot += hh;
      m4.compose(p.set(j.x, 0.06, j.z), q, s.set(0.9 + hh * 0.06, hh, 0.9 + hh * 0.06)); this.jets.setMatrixAt(j.k, m4);
    }
    this.jets.instanceMatrix.needsUpdate = true;
    this.mist.material.opacity = Math.min(0.22, tot / F.N / 60);
    F.level = Math.min(1, tot / F.N / 10);
  }
}

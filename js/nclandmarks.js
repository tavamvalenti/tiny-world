// NORTH COUNTY, phase 4: the landmarks people know, each on its OSM spot (js/ncdata.js poi) run through the map's
// projection. Simplified to Tiny World's blocks; the overall shape, colours and setting are what's meant to read.
//   Carlsbad High        the campus off Monroe St (OSM: the school and its stadium): the stadium with the track, the
//                        purple C at midfield and on the gym roof (assets/carlsbad-high-c.png, square, as given), the
//                        home stands and press box, the classroom wing, the gym, the library, the sign
//   Carlsbad Inn         the big half-timbered inn at Carlsbad Blvd and Carlsbad Village Dr: cream walls, dark timbers,
//                        steep roofs
//   Army and Navy Academy  white Spanish revival halls with tile roofs round the parade lawn, the bell tower
//   Magee House          the 1887 cottage in Magee Park
//   the Graves house     the 1887 Victorian by Oceanside Pier (the film house), cream with blue-grey trim, the porch
//   Surf museum          on Pier View Way, the giant board out front
//   Museum of art        Irving Gill's white 1934 city hall on Pier View Way, its arcade
//   Carlsbad City Hall   the low civic buildings on Carlsbad Village Dr east of I-5, the flagpole
// heroSites() claims the ground and adds the buildings (from js/northcounty.js, before the filler); Heroes adds what
// hangs on them and the free-standing pieces (from js/ncworld.js). Everything breaks: the buildings with their cells,
// the decor cut out with them, signs with the cell behind, the free-standing pieces knocked flat.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand } from './core.js';
import { hsl } from './maps.js';
import { tint, box, cyl, cone, canvasTex, cutoutOn, hipRoof } from './mapkit.js';
import { NC } from './ncgeo.js';

const poi = (n, dx = 0, dz = 0) => { const p = NC.poi.find((q) => q.n === n); return p ? { x: p.x + dx, z: p.z + dz } : null; };
const PURPLE = '#4a2a8a', PURPLE_HEX = 0x4a2a8a, CREAM = 0xf2ead6, TIMBER = 0x4a3426, TILE = 0xb06a4c, WHITE = 0xf4f1ea;
// the sites (game units). Each was checked against the streets the map keeps (tools: the occupancy map in the dev console)
export const HERO = {
  chs: { x0: 233.5, x1: 256, z0: 104, z1: 150 },                      // Carlsbad High: stadium north, buildings south
  inn: { x: -20, z: 12.5, w: 12, d: 8.5 },                            // Carlsbad Inn Beach Resort (OSM -14, 19)
  innWing: { x: -21.5, z: 21, w: 9, d: 4.6 },
  academy: { x0: -4, x1: 20, z0: -127, z1: -103 },                    // Army and Navy Academy (OSM 7, -115)
  magee: { x: -11.5, z: -79.5, w: 3.4, d: 2.6 },                      // in Magee Park
  graves: { x: -42.5, z: -599.5, w: 3.4, d: 3.2 },                    // beside the Mission Pacific, on the beach side of Pacific St
  surf: { x: 11.5, z: -619, w: 7, d: 4 },                             // 312 Pier View Way
  oma: { x: 76.5, z: -620.5, w: 9, d: 6 },                            // 704 Pier View Way
  cityHall: { x: 186, z: -9.5, w: 12, d: 6 },                         // 1200 Carlsbad Village Dr
  library: { x: 196, z: -12, w: 6, d: 8 },
};

// ---------- the ground and the buildings ----------
export function heroSites(ctx) {
  const { city, g, B, mark } = ctx, N = city.nc, H = (N.heroes = {});
  const add = (o, name) => { const b = B.add({ cell: 1.6, gh: 1.3, fh: 1.05, storefront: false, ...o }); b.noSigns = true; b.landmark = true; if (name) b.name = name; mark(o.x - o.w / 2 - 0.2, o.z - o.d / 2 - 0.2, o.x + o.w / 2 + 0.2, o.z + o.d / 2 + 0.2); return b; };
  const lawn = (x0, z0, x1, z1, c = '#6f8a46') => { city.paintGrass ? city.paintGrass(g, x0, z0, x1, z1, c) : g.rect(x0, z0, x1, z1, c); };
  const paved = (x0, z0, x1, z1, c = '#cfc8b8') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.18, 40); };

  // ---- Carlsbad High ----
  { const S = HERO.chs; mark(S.x0, S.z0, S.x1, S.z1);
    paved(S.x0, S.z0, S.x1, S.z1, '#c9c2b2');
    // the stadium: a 400 m track round the field (long axis north-south), the field with its yard lines and end zones
    const cx = 245, cz = 119, L = 13, R = 7.6;                       // the track's straights run z = cz +- L/2, its bends radius R
    g.rect(cx - R, cz - L / 2, cx + R, cz + L / 2, '#a5503f'); g.circle(cx, cz - L / 2, R, '#a5503f'); g.circle(cx, cz + L / 2, R, '#a5503f');
    for (let k = 1; k < 6; k++) { const r = R - k * 0.28; g.line(cx - r, cz - L / 2, cx - r, cz + L / 2, 0.035, 'rgba(255,255,255,.55)'); g.line(cx + r, cz - L / 2, cx + r, cz + L / 2, 0.035, 'rgba(255,255,255,.55)'); }
    const fx0 = cx - 4.6, fx1 = cx + 4.6, fz0 = cz - 11.2, fz1 = cz + 11.2;     // 120 yd x 53 yd, about
    g.rect(cx - 5.9, cz - 12.4, cx + 5.9, cz + 12.4, '#5f8f3c'); g.circle(cx, cz - L / 2, 5.9, '#5f8f3c'); g.circle(cx, cz + L / 2, 5.9, '#5f8f3c');
    g.rect(fx0, fz0, fx1, fz1, '#4f8a34');
    for (let k = 0; k <= 20; k++) { const z = fz0 + 1.87 + k * (fz1 - fz0 - 3.74) / 20; g.line(fx0, z, fx1, z, k % 2 ? 0.03 : 0.06, 'rgba(255,255,255,.85)'); }
    g.rect(fx0, fz0, fx1, fz0 + 1.87, PURPLE); g.rect(fx0, fz1 - 1.87, fx1, fz1, PURPLE);
    for (const [a, b] of [[fx0, fx1]]) { g.line(a, fz0, a, fz1, 0.07, '#fff'); g.line(b, fz0, b, fz1, 0.07, '#fff'); }
    g.line(fx0, fz0, fx1, fz0, 0.07, '#fff'); g.line(fx0, fz1, fx1, fz1, 0.07, '#fff');
    H.field = { cx, cz, fz0, fz1, fx0, fx1 };
    // the home stands on the west side (a low concrete deck, the seats and press box are its decor), the visitors' east
    H.home = add({ x: 235.9, z: cz, w: 2.6, d: 17, floors: 1, style: 'concrete', tint: hsl(0.1, 0.05, 0.78), gh: 1.1 }, 'the stadium');
    H.away = add({ x: 254.4, z: cz, w: 1.6, d: 11, floors: 1, style: 'concrete', tint: hsl(0.1, 0.05, 0.78), gh: 0.6 }, 'the stadium');
    // the campus: the classroom wing across it, the gym and the library behind, a quad between
    paved(S.x0, 134, S.x1, S.z1, '#d3ccbc');
    H.wing = add({ x: 245.5, z: 138.4, w: 19, d: 4, floors: 2, style: 'mission', tint: hsl(0.11, 0.12, 0.88), gh: 1.4, fh: 1.1, cell: 1.8 }, 'Carlsbad High');
    H.gym = add({ x: 244.5, z: 146.2, w: 9, d: 6.4, floors: 1, style: 'concrete', tint: hsl(0.1, 0.06, 0.86), gh: 2.8, cell: 2.2 }, 'the gym');
    H.lib = add({ x: 253.2, z: 145.6, w: 4.8, d: 5.4, floors: 2, style: 'coastal', tint: hsl(0.1, 0.05, 0.9), gh: 1.4, fh: 1.1 }, 'Carlsbad High');
    lawn(236.5, 141.4, 239.6, 149.4, '#6f8a46');
    N.chs = { x: 245.5, z: 138.4, d: 4 }; N.chsB = H.wing;            // (js/ncworld.js hangs the name on it)
  }

  // ---- Carlsbad Inn: three storeys round the corner, the wing behind ----
  { const I = HERO.inn, W2 = HERO.innWing;
    paved(I.x - I.w / 2 - 1, I.z - I.d / 2 - 1, I.x + I.w / 2 + 1, W2.z + W2.d / 2 + 0.8, '#d2cabb');
    H.inn = add({ x: I.x, z: I.z, w: I.w, d: I.d, floors: 3, style: 'house', tint: hsl(0.12, 0.3, 0.88), gh: 1.3, fh: 1.05, gable: true, roofKind: 'gable', pitch: 0.48, roofTint: hsl(0.06, 0.14, 0.52) }, 'Carlsbad Inn');
    H.innWing = add({ x: W2.x, z: W2.z, w: W2.w, d: W2.d, floors: 2, style: 'house', tint: hsl(0.12, 0.3, 0.88), gh: 1.3, fh: 1.05, gable: true, roofKind: 'gable', pitch: 0.6, roofTint: hsl(0.06, 0.14, 0.52) }, 'Carlsbad Inn');
  }

  // ---- Army and Navy Academy: halls round the parade lawn, the bell tower ----
  { const A = HERO.academy; mark(A.x0, A.z0, A.x1, A.z1);
    paved(A.x0, A.z0, A.x1, A.z1, '#d6cfc0'); lawn(A.x0 + 6.5, A.z0 + 7, A.x1 - 1.5, A.z1 - 6.5, '#6c8a44');
    const hall = (x, z, w, d, f = 2) => add({ x, z, w, d, floors: f, style: 'mission', tint: hsl(0.11, 0.1, 0.93), gh: 1.35, fh: 1.1, gable: true, roofKind: 'hip', roofMat: 'tile', pitch: 0.3, roofTint: new THREE.Color(0xb7745a) }, 'Army and Navy Academy');
    H.acad = [hall(A.x0 + 3, (A.z0 + A.z1) / 2, 5, 22), hall((A.x0 + A.x1) / 2 + 2.5, A.z0 + 3, 15, 4.6), hall((A.x0 + A.x1) / 2 + 2.5, A.z1 - 3, 15, 4.6, 1)];
    H.tower = add({ x: A.x0 + 6.8, z: (A.z0 + A.z1) / 2, w: 2.2, d: 2.2, floors: 5, style: 'mission', tint: hsl(0.11, 0.1, 0.94), gh: 1.35, fh: 1.1, cell: 2.2 }, 'the bell tower');   // against the long hall
    H.tower.bareRoof = true;
  }

  // ---- Magee House ----
  { const M = HERO.magee; H.magee = add({ x: M.x, z: M.z, w: M.w, d: M.d, floors: 1, style: 'house', tint: hsl(0.12, 0.12, 0.93), gh: 1.2, gable: true, roofKind: 'gable', pitch: 0.55, roofTint: hsl(0.08, 0.06, 0.42) }, 'Magee House'); }
  // ---- the Graves house, 1887 ----
  { const V = HERO.graves; paved(V.x - V.w / 2 - 0.8, V.z - V.d / 2 - 0.8, V.x + V.w / 2 + 1.6, V.z + V.d / 2 + 0.8, '#d8cfbc');
    H.graves = add({ x: V.x, z: V.z, w: V.w, d: V.d, floors: 2, style: 'house', tint: hsl(0.13, 0.35, 0.9), gh: 1.25, fh: 1.05, gable: true, roofKind: 'gable', pitch: 0.7, roofTint: hsl(0.58, 0.06, 0.62) }, 'the 1887 house'); }
  // ---- the surf museum and the museum of art on Pier View Way ----
  { const S = HERO.surf; paved(S.x - S.w / 2 - 0.6, S.z - S.d / 2 - 0.6, S.x + S.w / 2 + 0.6, S.z + S.d / 2 + 1.6, '#d6cfbf');
    H.surf = add({ x: S.x, z: S.z, w: S.w, d: S.d, floors: 1, style: 'coastal', tint: hsl(0.55, 0.12, 0.86), gh: 1.6 }, 'the surf museum'); }
  { const O = HERO.oma; paved(O.x - O.w / 2 - 0.6, O.z - O.d / 2 - 0.6, O.x + O.w / 2 + 0.6, O.z + O.d / 2 + 2, '#ddd6c6');
    H.oma = add({ x: O.x, z: O.z, w: O.w, d: O.d, floors: 2, style: 'mission', tint: hsl(0.1, 0.05, 0.96), gh: 1.5, fh: 1.15 }, 'the museum of art'); }
  // ---- Carlsbad City Hall and the library beside it ----
  { const C = HERO.cityHall, Lb = HERO.library;
    paved(C.x - C.w / 2 - 1, Lb.z - Lb.d / 2 - 1, Lb.x + Lb.w / 2 + 1, C.z + C.d / 2 + 2.5, '#d4cdbd'); lawn(C.x - 4, C.z + C.d / 2 + 0.6, C.x + 4, C.z + C.d / 2 + 2.4);
    H.cityHall = add({ x: C.x, z: C.z, w: C.w, d: C.d, floors: 1, style: 'mission', tint: hsl(0.1, 0.1, 0.9), gh: 1.6, gable: true, roofKind: 'hip', roofMat: 'tile', pitch: 0.28, roofTint: new THREE.Color(0xb27458) }, 'Carlsbad City Hall');
    H.library = add({ x: Lb.x, z: Lb.z, w: Lb.w, d: Lb.d, floors: 2, style: 'coastal', tint: hsl(0.1, 0.08, 0.86), gh: 1.4, fh: 1.1 }, 'the library'); }
  const name = (S, R) => city.named.push({ S, o: S, x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1 });
  name('Carlsbad High', HERO.chs); name('Army and Navy Academy', HERO.academy);
}

// ---------- what hangs on them, the free-standing pieces ----------
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, ...o });
const mergeAll = (geos) => mergeGeometries(geos.map((q) => (q.index ? q.toNonIndexed() : q)));
const topY = (b) => b.cells.reduce((m, c) => Math.max(m, c.y + c.hy), 0);
function textTex(lines, o = {}) {
  const w = o.w || 512, h = o.h || 128;
  return canvasTex(w, h, (x, W, Hh) => {
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, W, Hh); } else x.clearRect(0, 0, W, Hh);
    x.fillStyle = o.fg || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((t, i) => { x.font = o.font || '700 44px Inter, Arial'; x.fillText(t, W / 2, Hh * (i + 0.5) / lines.length + 2, W - 20); });
  });
}
function textPlane(scene, tex, w, h, x, y, z, ry, transparent = true) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: 0.5, alphaTest: transparent ? 0.1 : 0 }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}
function hang(b, obj) {
  let best = null, bd = 1e9;
  for (const c of b.cells) { const d = Math.hypot(c.x - obj.position.x, c.y - obj.position.y, c.z - obj.position.z); if (d < bd) { bd = d; best = c; } }
  (best.props ||= []).push({ obj: [obj], x: best.x, y: best.y, z: best.z });
}

export class Heroes {
  constructor(scene, N) {
    this.scene = scene; this.loose = [];
    const H = N.heroes; if (!H) return;
    this.chs(scene, H, N);
    this.inn(scene, H);
    this.academy(scene, H);
    this.small(scene, H);
  }
  piece(geos, x, z, r) {
    const m = new THREE.Mesh(mergeAll(geos), vc());
    m.geometry.translate(-x, 0, -z); m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    this.loose.push({ m, x, z, r, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) });
    return m;
  }

  // ---- Carlsbad High: the stands, the press box, the lights, the goalposts, the C on the field and the gym ----
  chs(scene, H, N) {
    const F = H.field, home = H.home, geo = [], away = [];
    // the home stands: rows of benches stepping up away from the field, the press box on top
    for (let k = 0; k < 6; k++) geo.push(box(0.42, 0.14, 15.6, 236.9 - k * 0.42, 1.1 + k * 0.3, F.cz, k % 2 ? 0xc9c9cc : 0xb4b4b8), box(0.4, 0.06, 15.6, 236.9 - k * 0.42, 1.2 + k * 0.3, F.cz, 0x5a3f8f));
    geo.push(box(1.6, 1.1, 5, 234.9, 3.4, F.cz, 0xeeeae2), box(1.62, 0.36, 4.6, 234.88, 3.55, F.cz, 0x1d2630), box(1.8, 0.12, 5.2, 234.9, 4.0, F.cz, PURPLE_HEX));
    cutoutOn(scene, home, geo, vc({ roughness: 0.6 }));
    for (let k = 0; k < 3; k++) away.push(box(0.4, 0.12, 10, 253.9 + k * 0.4, 0.6 + k * 0.25, F.cz, 0xbdbdc1));
    cutoutOn(scene, H.away, away, vc({ roughness: 0.6 }));
    const name = textPlane(scene, textTex(['CARLSBAD LANCERS'], { bg: '#4a2a8a', fg: '#ffffff', w: 768, h: 96, font: '800 58px Inter, Arial' }), 4.4, 0.55, 235.72 + 0.82, 3.4, F.cz, Math.PI / 2, false);
    hang(home, name);
    // goalposts (yellow) and the four light towers
    for (const s of [-1, 1]) { const z = s < 0 ? F.fz0 - 0.05 : F.fz1 + 0.05; this.piece([cyl(0.05, 0.05, 1.1, 0, 0.55, 0, 0xf1d23a, 6), box(1.7, 0.06, 0.06, 0, 1.1, 0, 0xf1d23a), cyl(0.035, 0.035, 1.4, -0.82, 1.8, 0, 0xf1d23a, 6), cyl(0.035, 0.035, 1.4, 0.82, 1.8, 0, 0xf1d23a, 6)], F.cx, z, 1); }
    for (const [x, z] of [[237.4, F.cz - 9], [237.4, F.cz + 9], [253, F.cz - 9], [253, F.cz + 9]]) this.piece([cyl(0.09, 0.13, 6, 0, 3, 0, 0x9a9da2, 6), box(0.2, 0.6, 1.2, 0, 6.1, 0, 0x2b2e33), box(0.05, 0.5, 1.1, x < 245 ? 0.12 : -0.12, 6.1, 0, 0xf6f2dc)], x, z, 0.8);
    // the C: at midfield (painted into the ground) and on the gym's roof
    const img = new Image();
    img.onload = () => {
      const s = 4.4, x0 = F.cx - s / 2, z0 = F.cz - s / 2;
      for (const p of G.ground.list || [G.ground]) { if (p.b && (F.cx < p.b.x0 || F.cx > p.b.x1 || F.cz < p.b.z0 || F.cz > p.b.z1)) continue; p.x.drawImage(img, p.px(x0), p.pz(z0), s * p.k, s * p.k); }
      if (G.ground.touch) G.ground.touch(F.cx, F.cz, s); else G.ground.dirtyT = 0.1;
      const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
      const gy = topY(H.gym), m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.1, roughness: 0.7 }));
      m.position.set(H.gym.x, gy + 0.03, H.gym.z); this.scene.add(m); hang(H.gym, m);
    };
    img.src = 'assets/carlsbad-high-c.png';
    // the gym's purple trim and the wing's covered walkway
    const gm = H.gym, gt = topY(gm), trim = [];                      // a purple band round the top of the walls
    for (const s of [-1, 1]) trim.push(box(gm.w + 0.1, 0.3, 0.06, gm.x, gt - 0.15, gm.z + s * (gm.d / 2 + 0.03), PURPLE_HEX), box(0.06, 0.3, gm.d + 0.1, gm.x + s * (gm.w / 2 + 0.03), gt - 0.15, gm.z, PURPLE_HEX));
    cutoutOn(scene, H.gym, trim, vc());
    const wing = H.wing, wt = topY(wing), walk = [];
    for (let x = wing.x - wing.w / 2 + 0.6; x < wing.x + wing.w / 2; x += 2.1) walk.push(box(0.12, 1.35, 0.12, x, 0.68, wing.z + wing.d / 2 + 1.1, WHITE));
    walk.push(box(wing.w, 0.1, 1.3, wing.x, 1.4, wing.z + wing.d / 2 + 0.6, PURPLE_HEX), box(wing.w + 0.2, 0.12, wing.d + 0.2, wing.x, wt + 0.06, wing.z, 0xd9d2c4));
    cutoutOn(scene, wing, walk, vc());
    // the school sign on the corner by Monroe St
    const sign = this.piece([box(3.4, 0.9, 0.3, 0, 0.75, 0, 0xe9e4d8), box(3.6, 0.2, 0.4, 0, 0.1, 0, 0x8c8478)], 235.6, 150.6, 1.6);
    const st = textPlane(scene, textTex(['CARLSBAD HIGH SCHOOL', 'HOME OF THE LANCERS'], { fg: PURPLE, w: 768, h: 200, font: '800 56px Inter, Arial' }), 3.2, 0.8, 0, 0.78, 0.16, 0);
    sign.add(st);
  }

  // ---- Carlsbad Inn: the timber frame on the cream walls, the name ----
  inn(scene, H) {
    for (const b of [H.inn, H.innWing]) {
      const t = topY(b), geo = [], fr = (x, y, z, w, h, d) => geo.push(box(w, h, d, x, y, z, TIMBER));
      for (const s of [-1, 1]) {
        const z = b.z + s * (b.d / 2 + 0.03);
        for (let x = b.x - b.w / 2; x <= b.x + b.w / 2 + 0.01; x += 1.5) fr(x, t / 2, z, 0.14, t, 0.06);
        for (let y = 1.3; y < t; y += 1.05) fr(b.x, y, z, b.w, 0.12, 0.06);
        for (let x = b.x - b.w / 2 + 0.75; x < b.x + b.w / 2; x += 3) geo.push(tint(new THREE.BoxGeometry(0.1, 1.2, 0.06).rotateZ(0.6).translate(x, t - 0.55, z), TIMBER));
      }
      for (const s of [-1, 1]) { const x = b.x + s * (b.w / 2 + 0.03); for (let z = b.z - b.d / 2; z <= b.z + b.d / 2 + 0.01; z += 1.5) geo.push(box(0.06, t, 0.14, x, t / 2, z, TIMBER)); }
      // dormers on the long roof
      for (let x = b.x - b.w / 2 + 2; x < b.x + b.w / 2 - 1.5; x += 3) geo.push(box(1, 0.8, 1, x, t + 0.6, b.z - b.d / 2 + 1.2, CREAM), tint(new THREE.ConeGeometry(0.8, 0.7, 4).rotateY(Math.PI / 4).translate(x, t + 1.35, b.z - b.d / 2 + 1.2), 0x5d4a3e));
      cutoutOn(scene, b, geo, vc({ roughness: 0.8 }));
    }
    const b = H.inn, n = textPlane(scene, textTex(['CARLSBAD INN'], { fg: '#3a2a20', bg: '#efe6cc', w: 512, h: 96, font: '700 54px Georgia, serif' }), 3.2, 0.6, b.x, 1.75, b.z - b.d / 2 - 0.08, Math.PI, false);
    hang(b, n);
  }

  // ---- Army and Navy Academy: the bell tower's top, arcades, the name ----
  academy(scene, H) {
    const T = H.tower, t = topY(T), geo = [];
    geo.push(box(2.5, 0.2, 2.5, T.x, t + 0.1, T.z, WHITE));
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) geo.push(box(0.35, 1.3, 0.35, T.x + dx * 0.95, t + 0.85, T.z + dz * 0.95, WHITE));
    geo.push(box(2.5, 0.25, 2.5, T.x, t + 1.6, T.z, WHITE), tint(new THREE.ConeGeometry(1.85, 1.3, 4).rotateY(Math.PI / 4).translate(T.x, t + 2.35, T.z), TILE), cyl(0.28, 0.32, 0.5, T.x, t + 0.6, T.z, 0x8a6a2a, 8));
    cutoutOn(scene, T, geo, vc());
    // the arcade along the north hall
    const h = H.acad[1], ar = [];
    for (let x = h.x - h.w / 2 + 0.7; x < h.x + h.w / 2; x += 1.5) ar.push(box(0.3, 1.25, 0.3, x, 0.62, h.z + h.d / 2 + 0.9, WHITE));
    ar.push(box(h.w, 0.3, 1.2, h.x, 1.35, h.z + h.d / 2 + 0.55, WHITE), box(h.w, 0.12, 1.3, h.x, 1.55, h.z + h.d / 2 + 0.55, TILE));
    cutoutOn(scene, h, ar, vc());
    const n = textPlane(scene, textTex(['ARMY AND NAVY ACADEMY'], { fg: '#1d2b4f', w: 768, h: 96, font: '700 50px Georgia, serif' }), 4.2, 0.5, h.x, 1.95, h.z + h.d / 2 + 1.16, 0);
    hang(h, n);
    // the flagpole on the parade lawn
    this.piece([cyl(0.05, 0.07, 5.5, 0, 2.75, 0, 0xe8e8e8, 6), box(0.04, 0.6, 1, 0, 5.1, 0.5, 0x3a4f8f)], h.x + 2, h.z + 8, 0.6);
  }

  // ---- the small ones ----
  small(scene, H) {
    // Magee House: white, a deep porch along the front
    { const b = H.magee, g = []; g.push(box(b.w + 0.2, 0.08, 1, b.x, 1.15, b.z + b.d / 2 + 0.5, WHITE), box(b.w, 0.15, 1, b.x, 0.08, b.z + b.d / 2 + 0.5, 0x9a8a72));
      for (let k = 0; k < 4; k++) g.push(box(0.08, 1.1, 0.08, b.x - b.w / 2 + 0.2 + k * (b.w - 0.4) / 3, 0.6, b.z + b.d / 2 + 0.95, WHITE));
      cutoutOn(scene, b, g, vc()); }
    // the Graves house: blue-grey trim, a turret-less Queen Anne front gable, the wrap porch, the picket fence
    { const b = H.graves, t = topY(b), g = [], trim = 0x6f8396;
      g.push(box(b.w + 0.1, 0.1, b.d + 0.1, b.x, 1.25, b.z, trim), box(b.w + 0.1, 0.1, b.d + 0.1, b.x, t - 0.05, b.z, trim));
      g.push(box(1.1, 0.08, b.d + 1, b.x + b.w / 2 + 0.55, 1.15, b.z, trim), box(1.1, 0.15, b.d + 1, b.x + b.w / 2 + 0.55, 0.08, b.z, 0x8f7c64));
      for (let k = 0; k < 4; k++) g.push(box(0.08, 1.1, 0.08, b.x + b.w / 2 + 1.0, 0.6, b.z - b.d / 2 - 0.3 + k * (b.d + 0.6) / 3, WHITE));
      g.push(tint(new THREE.ConeGeometry(1.3, 1.6, 4, 1).rotateY(Math.PI / 4).scale(0.5, 1, 1).translate(b.x + b.w / 2 - 0.2, t + 0.8, b.z), 0x667480));
      cutoutOn(scene, b, g, vc());
      this.piece([...Array.from({ length: 9 }, (_, k) => box(0.06, 0.45, 0.06, 0, 0.22, -2.4 + k * 0.6, WHITE)), box(0.04, 0.06, 4.9, 0, 0.36, 0, WHITE)], b.x + b.w / 2 + 1.9, b.z, 2.4);
      const n = textPlane(scene, textTex(['1887'], { fg: '#3d4f62', w: 256, h: 96, font: '700 60px Georgia, serif' }), 0.8, 0.3, b.x + b.w / 2 + 0.06, 2.1, b.z, Math.PI / 2); hang(b, n); }
    // the surf museum: the name across the front, the giant board standing by the door
    { const b = H.surf, n = textPlane(scene, textTex(['SURF MUSEUM'], { fg: '#0f4a6b', bg: '#f3efe4', w: 512, h: 96, font: '800 56px Inter, Arial' }), 3.6, 0.6, b.x, 1.3, b.z + b.d / 2 + 0.08, 0, false); hang(b, n);
      const board = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.6, 16).scale(1, 1, 0.16), new THREE.MeshStandardMaterial({ color: 0xf2f0e6, roughness: 0.4 }));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.17), new THREE.MeshStandardMaterial({ color: 0xd2492a, roughness: 0.5 }));
      const grp = new THREE.Group(); board.position.y = 1.8; stripe.position.y = 1.8; grp.add(board, stripe); grp.position.set(b.x + b.w / 2 + 0.3, 0, b.z + b.d / 2 + 0.9); grp.rotation.y = 0.3; scene.add(grp);
      this.loose.push({ m: grp, x: grp.position.x, z: grp.position.z, r: 0.8, alive: true, t: 0, ax: rand(-1, 1), az: rand(-1, 1) }); }
    // the museum of art: Gill's arcade along the front, the name
    { const b = H.oma, g = [];
      for (let x = b.x - b.w / 2 + 0.5; x < b.x + b.w / 2; x += 1.35) g.push(box(0.35, 1.5, 0.35, x, 0.75, b.z + b.d / 2 + 1, WHITE));
      g.push(box(b.w, 0.35, 1.3, b.x, 1.65, b.z + b.d / 2 + 0.6, WHITE));
      cutoutOn(scene, b, g, vc());
      const n = textPlane(scene, textTex(['MUSEUM OF ART'], { fg: '#2a2a2a', w: 512, h: 96, font: '600 52px Georgia, serif' }), 3.4, 0.5, b.x, 2.05, b.z + b.d / 2 + 1.27, 0); hang(b, n); }
    // Carlsbad City Hall: the name, the flagpole
    { const b = H.cityHall, n = textPlane(scene, textTex(['CITY OF CARLSBAD'], { fg: '#2c3e2c', w: 512, h: 96, font: '700 50px Georgia, serif' }), 3.6, 0.5, b.x, 1.3, b.z + b.d / 2 + 0.08, 0); hang(b, n);
      this.piece([cyl(0.05, 0.07, 5, 0, 2.5, 0, 0xe8e8e8, 6), box(0.04, 0.55, 0.9, 0, 4.65, 0.45, 0x2f4f8f)], b.x - b.w / 2 - 0.8, b.z + b.d / 2 + 1.4, 0.6); }
  }

  update(dt) {
    for (const L of this.loose) if (!L.alive && L.t < 1) { L.t = Math.min(1, L.t + dt * 2.4); const k = L.t * L.t; L.m.rotation.x = L.ax * 1.4 * k; L.m.rotation.z = L.az * 1.4 * k; L.m.position.y = -0.15 * k; }
  }
  onBlast(x, z, reach) {
    for (const L of this.loose) if (L.alive && Math.hypot(L.x - x, L.z - z) < reach + L.r) { L.alive = false; L.t = 0; G.fx && G.fx.dust && G.fx.dust(L.x, 0.4, L.z, 0.6); }
  }
}

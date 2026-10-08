// LONDON: Westminster to the Tower, on the real course of the Thames (north = -z). The river comes up from Lambeth
// running north past the Palace of Westminster (west bank) and the London Eye (east bank), bends east at the
// Embankment, and runs east past the South Bank, Tate Modern, Southwark and London Bridge to Tower Bridge. The
// bridges are in their real order: Lambeth, Westminster across the north-south stretch; Waterloo, Blackfriars,
// Southwark, London Bridge and Tower Bridge across the eastward stretch, with the Millennium footbridge lined up on
// St Paul's. West of Whitehall: Parliament Square and the Abbey, Downing Street and Horse Guards, St James's Park
// and The Mall running to Buckingham Palace and the Victoria Memorial; Trafalgar Square at the top of Whitehall.
// The City sits north of the eastward stretch (St Paul's, the Bank, the Gherkin and the towers), the Tower of London
// by Tower Bridge; the Shard rises south of London Bridge. Around them: Georgian stucco and Victorian brick
// terraces, mixed shopping streets, pubs, Tube entrances, red buses and black cabs, all driving on the left.
// Distances are compressed to fit (the order, banks and alignments are kept).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { policeHQ } from './maps.js';
import { hsl, tint, box, cyl, cone, sph, canvasTex, hipRoof, merged, netCtx, paintNetwork, topOf, hangOn, rnd, skinOn, latheTris, pyramidTris } from './mapkit.js';

const XS = [-110, -85, -62, -15, 25, 55, 80, 105], ZS = [-88, -60, -40, 6, 40, 75];
// the Thames: the north-south stretch (x -47..-33), the bend, the eastward stretch (z -31..-17)
const RV = { x0: -47, x1: -33, z0: -31, z1: -17, bend: { x: -35, z: -19, r: 12 } };
const BRIDGES = { v: [6, 40], h: [-15, 25, 55, 80, 105] };   // Westminster, Lambeth | Waterloo, Blackfriars, Southwark, London, Tower
export function inRiver(x, z) {
  const inV = x > RV.x0 && x < RV.x1 && z > RV.z0, inH = z > RV.z0 && z < RV.z1 && x > RV.x0;
  if (!(inV || inH)) return false;
  if (x < RV.bend.x && z < RV.bend.z) return Math.hypot(x - RV.bend.x, z - RV.bend.z) < RV.bend.r;
  return true;
}
const onBridge = (x, z) => (x > RV.x0 - 1 && x < RV.x1 + 1 && BRIDGES.v.some((b) => Math.abs(z - b) < 3.4)) || (z > RV.z0 - 1 && z < RV.z1 + 1 && BRIDGES.h.some((b) => Math.abs(x - b) < 3.4));
const wet = (x, z) => inRiver(x, z) && !onBridge(x, z);

const BRICK = () => (Math.random() < 0.55 ? hsl(rand(0.08, 0.11), rand(0.25, 0.38), rand(0.52, 0.64)) : hsl(rand(0.0, 0.04), rand(0.38, 0.5), rand(0.4, 0.52)));
const STUCCO = () => hsl(rand(0.09, 0.12), rand(0.08, 0.2), rand(0.88, 0.95));
const STONE = () => hsl(rand(0.1, 0.13), rand(0.15, 0.3), rand(0.72, 0.84));
const PORTLAND = hsl(0.11, 0.18, 0.84);

export function london(B) {
  const ctx = netCtx({
    xs: XS, zs: ZS, roadW: 5, sw: 1.6, half: 130, extent: 195, base: '#8a8579', centerLine: 'white', lights: true, side: -1,
    skipEdge: (a, b) => a.z === b.z && a.z === 75 && Math.min(a.x, b.x) < -40 && Math.max(a.x, b.x) > -40,
  }, B);
  const { city, g } = ctx;
  city.side = -1;                                   // keep left
  city.mapKind = 'london';
  city.named = []; city.crowds = []; city.stationed = [];
  const L = (city.london = { pubs: [], tube: [], phones: [] });
  const name = (S, o, x0, x1, z0, z1) => city.named.push({ S, o, x0, x1, z0, z1 });
  city.vehicles = { taxi: { p: 0.3, colors: [0x101012, 0x101012, 0x101012, 0x2a2a30] }, colors: [0x1c1d22, 0x8a8f96, 0xe8e8e4, 0x2a3448, 0x5a1a1a, 0x3a4a3a, 0xc8c8c4, 0x1f2a44],
    bus: { p: 0.1, kinds: [{ color: 0xc8102e, h: 2.6, len: 3 }] }, moto: 0.08 };
  city.palette = { shirts: [0x1c1d22, 0x2b3445, 0x4a4a4e, 0x6b5a45, 0x7b1f2a, 0xe8e4dc, 0x3a4a3a, 0x8a8f96, 0x1f2a44, 0x9a7a55], pants: [0x1c1d22, 0x2a3448, 0x4a4a4e, 0x3c3a36, 0x6b6f76], sleeves: 0.15 };

  // ---------- ground: streets (white centre lines, double yellows, zebras), then the river over them
  g.rect(-195, -195, 195, 195, '#8c877c');
  paintNetwork(g, city, { centerLine: 'white', edgeLine: 'rgba(230,190,40,.9)',
    stubs: (N) => [N.x === XS[0] ? { axis: 'x', to: -195 } : null, N.x === XS[7] ? { axis: 'x', to: 195 } : null, N.z === ZS[0] ? { axis: 'z', to: -195 } : null, N.z === ZS[5] ? { axis: 'z', to: 195 } : null].filter(Boolean) });
  for (const b of city.blocks) city.paintSidewalk(g, b, '#b7b2a8');
  // the Thames, its embankment walls and the river stairs
  const riverPath = (x) => {
    x.beginPath(); x.moveTo(g.px(RV.x0), g.px(195)); x.lineTo(g.px(RV.x0), g.px(RV.bend.z));
    x.arc(g.px(RV.bend.x), g.px(RV.bend.z), RV.bend.r * g.k, Math.PI, Math.PI * 1.5); x.lineTo(g.px(195), g.px(RV.z0)); x.lineTo(g.px(195), g.px(RV.z1));
    x.lineTo(g.px(RV.x1), g.px(RV.z1)); x.lineTo(g.px(RV.x1), g.px(195)); x.closePath();
  };
  g.x.save(); riverPath(g.x); g.x.fillStyle = '#4c5b52'; g.x.fill(); g.x.lineWidth = 0.6 * g.k; g.x.strokeStyle = '#cfc8b8'; g.x.stroke(); g.x.restore();
  // parks and squares (painted before the buildings so they sit on grass)
  const grass = (x0, z0, x1, z1) => city.paintGrass(g, x0, z0, x1, z1, '#5f7a42');
  const blk = (i, j) => city.blocks.find((b) => b.i === i && b.j === j);

  // ---------- helpers: terraces, shopping streets, offices
  const house = (x, z, w, d, kind, floors) => {
    const k = kind === 'stucco' ? { style: 'stucco', tint: STUCCO(), gh: 1.4, fh: 1.05 } : kind === 'mixed' ? { style: 'brick', tint: BRICK(), gh: 1.4, fh: 1, storefront: true } : kind === 'city' ? { style: pick(['concrete', 'office', 'concrete']), tint: Math.random() < 0.6 ? STONE() : hsl(0.58, 0.08, rand(0.6, 0.78)), gh: 1.6, fh: 1.05 } : { style: 'brick', tint: BRICK(), gh: 1.2, fh: 0.95, storefront: false };
    const b = B.add({ x, z, w, d, floors, cell: kind === 'city' ? 2.2 : 1.7, ...k });
    if (kind === 'terrace' || kind === 'stucco') b.noSigns = Math.random() < 0.7;
    return b;
  };
  // one side of a block: houses along the street, `dir` pointing into the block
  const side = (b, edge, kind, depth) => {
    const fl = () => (kind === 'city' ? Math.round(rand(6, 13)) : kind === 'mixed' ? Math.round(rand(3, 6)) : kind === 'stucco' ? Math.round(rand(4, 5)) : Math.round(rand(3, 4)));
    const wr = kind === 'city' ? [5, 9] : kind === 'mixed' ? [2.8, 5] : [2.3, 3.2];
    const horiz = edge === 'n' || edge === 's';
    const a0 = horiz ? b.lx0 + (edge === 'n' ? 0 : depth) : b.lz0 + depth, a1 = horiz ? b.lx1 - (edge === 'n' ? 0 : depth) : b.lz1 - depth;
    const out = [];
    for (let a = a0; a < a1 - 1.6;) {
      let w = rand(wr[0], wr[1]); if (a1 - a - w < 2) w = a1 - a;
      const mid = a + w / 2;
      const x = horiz ? mid : edge === 'w' ? b.lx0 + depth / 2 : b.lx1 - depth / 2, z = horiz ? (edge === 'n' ? b.lz0 + depth / 2 : b.lz1 - depth / 2) : mid;
      if (!wet(x, z) && !inRiver(x, z)) out.push(house(x, z, horiz ? w - 0.05 : depth, horiz ? depth : w - 0.05, kind, fl()));
      a += w;
    }
    return out;
  };
  const fill = (b, kind, depth = kind === 'city' ? 8 : 5, gardens = true) => {
    g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#827d72');
    if (gardens && kind !== 'city') city.paintGrass(g, b.lx0 + depth, b.lz0 + depth, b.lx1 - depth, b.lz1 - depth, '#627a46');
    const all = [...side(b, 'n', kind, depth), ...side(b, 's', kind, depth), ...side(b, 'w', kind, depth), ...side(b, 'e', kind, depth)];
    // a pub on a corner, people outside with their pints
    if (kind !== 'city' && Math.random() < 0.75) { const cx = Math.random() < 0.5 ? b.lx0 + 1.4 : b.lx1 - 1.4, cz = Math.random() < 0.5 ? b.lz0 + 1.4 : b.lz1 - 1.4; L.pubs.push({ x: cx, z: cz, b }); city.crowds.push({ x: cx + (cx < (b.lx0 + b.lx1) / 2 ? -1.5 : 1.5), z: cz, r: 0.7, n: Math.round(rand(3, 6)), look: 'commuter' }); }
    return all;
  };
  const lot = (x0, z0, x1, z1, c = '#a39d90') => { g.rect(x0, z0, x1, z1, c); g.grainRect(x0, z0, x1, z1, 0.2, 30); };
  // landmark buildings: destructible, no random shop signs or scaffolding
  const M = (o) => { const b = B.add({ cell: 1.6, gh: 1.6, fh: 1.1, storefront: false, ...o }); b.noSigns = true; b.landmark = true; return b; };

  // ================= WESTMINSTER (west bank) =================
  // the Palace of Westminster along the river: the long Gothic front, Elizabeth Tower at the bridge, Victoria Tower
  // at the south end, the central spire; Parliament Square and the Abbey behind; Westminster Bridge
  {
    const b = blk(2, 3);                          // x -62..-15, z 6..40 (the river runs through it)
    lot(-60.4, 7.6, RV.x0, 38.4, '#9a9384');
    const gold = hsl(0.11, 0.38, 0.64);
    const palace = [M({ x: -53, z: 21, w: 10, d: 18, floors: 4, style: 'concrete', tint: gold, cell: 2, gh: 1.6 })];
    const big = M({ x: -50.2, z: 10.2, w: 3, d: 3, floors: 17, style: 'concrete', tint: hsl(0.11, 0.42, 0.6), cell: 1.5, gh: 1.6, fh: 1.15 });
    const victoria = M({ x: -55, z: 32.8, w: 5, d: 5, floors: 16, style: 'concrete', tint: gold, cell: 1.7, gh: 1.6, fh: 1.15 });
    L.parliament = { palace, big, victoria, river: RV.x0 };
    name('The Houses of Parliament', 'the Houses of Parliament', -60, -47, 7, 38); name('Big Ben', 'Big Ben', -52, -48, 8, 12);
    // the east bank opposite: St Thomas' Hospital
    lot(RV.x1, 7.6, b.lx1, 38.4);
    for (const z of [13, 20, 27, 33]) M({ x: -25.5, z, w: 12, d: 5, floors: Math.round(rand(5, 8)), style: 'concrete', tint: hsl(0.1, 0.06, 0.82), cell: 2.2 });
    name("St Thomas' Hospital", "St Thomas' Hospital", -33, -15, 7, 39);
    city.crowds.push({ x: -43, z: 4.5, r: 1, n: 5, look: 'tourist', face: { x: -50, z: 9.6 } }, { x: -36, z: 7.6, r: 0.9, n: 4, look: 'tourist', face: { x: -50, z: 9.6 } });
  }
  {
    const b = blk(1, 3);                          // x -85..-62, z 6..40: Parliament Square and Westminster Abbey
    grass(b.lx0, b.lz0, b.lx1, b.lz0 + 9);
    for (const [x, z] of [[-80, 9], [-74, 9], [-68, 9]]) city.crowds.push({ x, z, r: 0.6, n: 2, look: 'tourist' });
    lot(b.lx0, b.lz0 + 9, b.lx1, b.lz1, '#9e988b');
    const stone = hsl(0.1, 0.16, 0.76);
    const nave = M({ x: -72, z: 25, w: 12, d: 5, floors: 5, style: 'concrete', tint: stone, cell: 1.75, gh: 1.8, fh: 1.4, gable: true, roofTint: hsl(0.58, 0.06, 0.42) });
    const towers = [M({ x: -79.4, z: 23.4, w: 2.4, d: 2.4, floors: 11, style: 'concrete', tint: stone, cell: 1.2, gh: 1.8, fh: 1.3 }), M({ x: -79.4, z: 26.6, w: 2.4, d: 2.4, floors: 11, style: 'concrete', tint: stone, cell: 1.2, gh: 1.8, fh: 1.3 })];
    const transept = [M({ x: -69, z: 20.2, w: 3.6, d: 4.4, floors: 5, style: 'concrete', tint: stone, cell: 1.8, gh: 1.8, fh: 1.4 }), M({ x: -69, z: 29.8, w: 3.6, d: 4.4, floors: 5, style: 'concrete', tint: stone, cell: 1.8, gh: 1.8, fh: 1.4 })];
    L.abbey = { nave, towers, transept };
    for (let x = -82; x < -64; x += 4) city.addTree(x, 34, 1, 'round');
    city.crowds.push({ x: -82.5, z: 20, r: 0.9, n: 5, look: 'tourist', face: { x: -80, z: 25 } });
    name('Westminster Abbey', 'Westminster Abbey', -84, -63, 17, 33); name('Parliament Square', 'Parliament Square', -85, -62, 6, 16);
  }
  // Whitehall's west side: the Treasury, Downing Street, Horse Guards
  {
    const b = blk(1, 2);                          // x -85..-62, z -40..6
    lot(b.lx0, b.lz0, b.lx1, b.lz1, '#9e988b');
    const portland = PORTLAND;
    M({ x: -73.5, z: -2, w: 14, d: 6, floors: 5, style: 'concrete', tint: portland, cell: 2.2, gh: 1.6 });                              // the Treasury
    const ds = M({ x: -76, z: -14, w: 9, d: 4.5, floors: 3, style: 'brick', tint: hsl(0.04, 0.15, 0.18), cell: 1.5, gh: 1.4 });      // Downing Street (black brick)
    M({ x: -69, z: -14, w: 4, d: 9, floors: 4, style: 'concrete', tint: portland, cell: 2, gh: 1.6 });
    const hg = M({ x: -73.5, z: -30, w: 14, d: 6, floors: 3, style: 'concrete', tint: portland, cell: 2, gh: 1.8 });                   // Horse Guards
    L.downing = { x: -76, z: -11.6, b: ds }; L.horseGuards = hg;
    city.crowds.push({ x: -63.5, z: -31, r: 0.4, n: 1, look: 'guard' }, { x: -63.5, z: -27, r: 0.4, n: 1, look: 'guard' }, { x: -64.5, z: -12, r: 0.5, n: 2, look: 'metpolice' }, { x: -64.6, z: -22, r: 1, n: 5, look: 'tourist', face: { x: -73.5, z: -30 } });
    name('Downing Street', 'Downing Street', -82, -70, -18, -10); name('Horse Guards', 'Horse Guards Parade', -79, -62, -35, -27); name('Whitehall', 'Whitehall', -66, -60, -40, 6);
  }
  // St James's Park (with its lake) between Birdcage Walk and The Mall
  {
    const b = blk(0, 2);
    grass(b.lx0 - 1.6, b.lz0 - 1.6, b.lx1 + 1.6, b.lz1 + 1.6);
    g.x.save(); g.x.fillStyle = '#5a7d86'; g.x.beginPath(); g.x.ellipse(g.px((b.lx0 + b.lx1) / 2), g.px((b.lz0 + b.lz1) / 2), (b.lx1 - b.lx0) * 0.38 * g.k, 5 * g.k, -0.12, 0, 6.283); g.x.fill(); g.x.restore();
    for (let i = 0; i < 40; i++) { const x = rand(b.lx0 + 1, b.lx1 - 1), z = rand(b.lz0 + 1, b.lz1 - 1); if (Math.abs(z - (b.lz0 + b.lz1) / 2) > 6) city.addTree(x, z, rand(1.1, 1.5)); }
    city.wanderZones.push({ x0: b.lx0, x1: b.lx1, z0: b.lz0 + 1, z1: (b.lz0 + b.lz1) / 2 - 6 }, { x0: b.lx0, x1: b.lx1, z0: (b.lz0 + b.lz1) / 2 + 6, z1: b.lz1 - 1 });
    for (let k = 0; k < 6; k++) city.addProp('bench', rand(b.lx0 + 2, b.lx1 - 2), b.lz0 + 2, 0);
    name("St James's Park", "St James's Park", b.x0, b.x1, b.z0, b.z1);
    // The Mall: the red road, plane trees both sides, Union flags on poles
    g.rect(-110, -42.5, -62, -37.5, '#8f4a3c');
    for (let x = -108; x < -64; x += 4) { city.addTree(x, -44.6, 1.2); city.addTree(x, -35.4, 1.2); }
    L.mall = { z: -40, x0: -108, x1: -64 };
  }
  // Buckingham Palace at the end of The Mall, the Victoria Memorial in front, the King's Guard at the gates
  {
    lot(-150, -66, -113, -14, '#b9b2a2');
    g.rect(-122, -54, -113, -26, '#d9d2c2');                       // the forecourt
    const pal = M({ x: -131, z: -40, w: 8, d: 32, floors: 4, style: 'concrete', tint: hsl(0.1, 0.12, 0.86), cell: 2.2, gh: 1.8, fh: 1.2 });
    M({ x: -140, z: -26, w: 10, d: 5, floors: 4, style: 'concrete', tint: hsl(0.1, 0.12, 0.84), cell: 2.2, gh: 1.8, fh: 1.2 }); M({ x: -140, z: -54, w: 10, d: 5, floors: 4, style: 'concrete', tint: hsl(0.1, 0.12, 0.84), cell: 2.2, gh: 1.8, fh: 1.2 });
    L.palace = { b: pal, x: -131, z: -40, memorial: { x: -116.5, z: -40 } };
    for (const z of [-46, -43, -37, -34]) city.crowds.push({ x: -121.6, z, r: 0.3, n: 1, look: 'guard' });
    for (const z of [-52, -46, -34, -28]) city.crowds.push({ x: -111.6, z, r: 1.1, n: 5, look: 'tourist', face: { x: -131, z: -40 } });
    city.wanderZones.push({ x0: -114, x1: -111.5, z0: -60, z1: -20 });
    grass(-150, -14, -113, 20); for (let i = 0; i < 26; i++) city.addTree(rand(-148, -114), rand(-12, 18), rand(1.2, 1.6));
    grass(-150, -100, -113, -66); for (let i = 0; i < 26; i++) city.addTree(rand(-148, -114), rand(-98, -68), rand(1.2, 1.6));
    name('Buckingham Palace', 'Buckingham Palace', -136, -113, -57, -23); name('The Mall', 'The Mall', -110, -62, -43, -37);
  }
  // north of The Mall: Carlton House Terrace (stucco); Trafalgar Square with Nelson's Column; the National Gallery
  {
    const b = blk(0, 1);
    fill(b, 'stucco', 5);
    const t = blk(1, 1);                          // Trafalgar Square
    g.rect(t.lx0, t.lz0, t.lx1, t.lz1, '#c9c1b0'); g.grainRect(t.lx0, t.lz0, t.lx1, t.lz1, 0.3, 40);
    for (let x = t.lx0; x < t.lx1; x += 1.6) g.line(x, t.lz0, x, t.lz1, 0.04, 'rgba(0,0,0,.08)');
    L.trafalgar = { x: (t.lx0 + t.lx1) / 2, z: (t.lz0 + t.lz1) / 2, b: t };
    city.wanderZones.push({ x0: t.lx0 + 1, x1: t.lx1 - 1, z0: t.lz0 + 1, z1: t.lz1 - 1 });
    city.crowds.push({ x: L.trafalgar.x - 5, z: L.trafalgar.z + 3, r: 1.2, n: 6, look: 'tourist', face: L.trafalgar }, { x: L.trafalgar.x + 5, z: L.trafalgar.z - 3, r: 1.2, n: 6, look: 'tourist' }, { x: L.trafalgar.x + 2, z: L.trafalgar.z + 6, r: 0.6, n: 3, look: 'busker' });
    L.admiralty = { x: -86.5, z: -40 };
    name('Trafalgar Square', 'Trafalgar Square', t.x0, t.x1, t.z0, t.z1); name("Nelson's Column", "Nelson's Column", L.trafalgar.x - 2, L.trafalgar.x + 2, L.trafalgar.z - 2, L.trafalgar.z + 2);
    const ng = blk(1, 0);                         // the National Gallery along the north side of the square
    lot(ng.lx0, ng.lz0, ng.lx1, ng.lz1);
    L.gallery = M({ x: (ng.lx0 + ng.lx1) / 2, z: ng.lz1 - 4, w: ng.lx1 - ng.lx0 - 1, d: 7, floors: 3, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.8, fh: 1.4 });
    side(ng, 'n', 'mixed', 5);
    name('The National Gallery', 'the National Gallery', ng.x0, ng.x1, ng.z1 - 9, ng.z1);
    grass(blk(0, 0).lx0 - 1.6, blk(0, 0).lz0 - 1.6, blk(0, 0).lx1 + 1.6, blk(0, 0).lz1 + 1.6);           // Green Park
    for (let i = 0; i < 30; i++) city.addTree(rand(blk(0, 0).lx0, blk(0, 0).lx1), rand(blk(0, 0).lz0, blk(0, 0).lz1), rand(1.1, 1.5));
    city.wanderZones.push({ x0: blk(0, 0).lx0, x1: blk(0, 0).lx1, z0: blk(0, 0).lz0, z1: blk(0, 0).lz1 });
    name('Green Park', 'Green Park', blk(0, 0).x0, blk(0, 0).x1, blk(0, 0).z0, blk(0, 0).z1);
  }
  // Belgravia and Pimlico: white stucco terraces; Millbank and Tate Britain; Lambeth Palace across the river
  {
    fill(blk(0, 3), 'stucco'); fill(blk(0, 4), 'stucco'); fill(blk(1, 4), 'stucco');
    const b = blk(2, 4);
    lot(b.lx0, b.lz0, RV.x0, b.lz1);
    grass(b.lx0 + 6, b.lz0, RV.x0, b.lz0 + 14);                          // Victoria Tower Gardens
    M({ x: -53.5, z: 62, w: 8, d: 10, floors: 3, style: 'concrete', tint: PORTLAND, cell: 2, gh: 1.8 });                     // Tate Britain
    lot(RV.x1, b.lz0, b.lx1, b.lz1);
    L.lambeth = M({ x: -27, z: 48, w: 6, d: 6, floors: 4, style: 'brick', tint: hsl(0.02, 0.45, 0.42), cell: 1.5, gh: 1.6 });   // Lambeth Palace gatehouse
    M({ x: -22, z: 54, w: 5, d: 8, floors: 3, style: 'brick', tint: hsl(0.03, 0.4, 0.46), cell: 2 });
    for (let i = 0; i < 12; i++) city.addTree(rand(-31, -17), rand(58, 72), 1.2);
    name('Lambeth Palace', 'Lambeth Palace', -33, -15, 42, 74);
  }

  // ================= THE SOUTH BANK =================
  {
    const b = blk(2, 2);                          // x -62..-15, z -40..6: the bend; the Eye and County Hall on the east bank
    lot(RV.x1, RV.z1, b.lx1, b.lz1, '#aaa496');
    M({ x: -22.5, z: -6, w: 6, d: 16, floors: 5, style: 'concrete', tint: hsl(0.08, 0.2, 0.76), cell: 2.2, gh: 1.8, gable: true, roofTint: hsl(0.02, 0.35, 0.38) });   // County Hall
    L.eye = { x: -37.5, z: -6, r: 12 };
    grass(-32.6, 0, -25, 5.6);
    city.crowds.push({ x: -29, z: 2.5, r: 1.2, n: 7, look: 'tourist', face: { x: -37.5, z: -6 } }, { x: -24, z: -16, r: 0.8, n: 3, look: 'busker' });
    city.wanderZones.push({ x0: -32.4, x1: -25.5, z0: -16, z1: 5 });
    name('The London Eye', 'the London Eye', -40, -24, -16, 2); name('County Hall', 'County Hall', -25, -17, -14, 2);
    // west bank north of the bridge: Portcullis House, the Embankment gardens and Cleopatra's Needle
    lot(b.lx0, b.lz0, RV.x0, b.lz1);
    M({ x: -53.5, z: -1, w: 9, d: 5.5, floors: 6, style: 'concrete', tint: hsl(0.08, 0.2, 0.55), cell: 2, gh: 1.8 });         // Portcullis House
    M({ x: -54, z: -13, w: 9, d: 14, floors: 6, style: 'concrete', tint: PORTLAND, cell: 2.2, gh: 1.8 });                 // Whitehall Court
    grass(-60, -38, -42, -33.5); L.needle = { x: -40, z: -34 };
    name("Cleopatra's Needle", "Cleopatra's Needle", -43, -37, -37, -31);
  }
  {
    // the South Bank: the Royal Festival Hall and the National Theatre; Tate Modern (and its chimney) facing St Paul's
    const b3 = blk(3, 2);
    lot(b3.lx0, RV.z1 + 0.5, b3.lx1, b3.lz1, '#a8a296');
    M({ x: -3.5, z: -6, w: 13, d: 12, floors: 4, style: 'concrete', tint: hsl(0.1, 0.06, 0.72), cell: 2.4, gh: 1.8 });
    M({ x: 14, z: -7, w: 12, d: 12, floors: 5, style: 'concrete', tint: hsl(0.1, 0.05, 0.62), cell: 2.4, gh: 1.8, setbacks: [{ f: 3, n: 1 }] });
    city.crowds.push({ x: 0, z: -15.6, r: 1, n: 5, look: 'tourist' }, { x: 10, z: -15.6, r: 0.6, n: 2, look: 'busker' }, { x: 20, z: -15.6, r: 1, n: 4, look: 'commuter' });
    city.wanderZones.push({ x0: -12, x1: 22, z0: -16.4, z1: -15 });
    name('The South Bank', 'the South Bank', -15, 25, -17, 6);
    const b4 = blk(4, 2);
    lot(b4.lx0, RV.z1 + 0.5, b4.lx1, b4.lz1);
    L.tate = M({ x: 40, z: -5, w: 20, d: 12, floors: 6, style: 'brick', tint: hsl(0.05, 0.3, 0.36), cell: 2.4, gh: 1.8, fh: 1.2 });
    M({ x: 40, z: -12.6, w: 3, d: 2.4, floors: 22, style: 'brick', tint: hsl(0.05, 0.3, 0.36), cell: 1.5, fh: 1.1 });       // the chimney
    city.crowds.push({ x: 40, z: -15.6, r: 1, n: 5, look: 'tourist' });
    name('Tate Modern', 'Tate Modern', 27, 53, -17, 6); name('The Millennium Bridge', 'the Millennium Bridge', 37, 43, -40, -17);
    const b5 = blk(5, 2);
    lot(b5.lx0, RV.z1 + 0.5, b5.lx1, b5.lz1);
    M({ x: 66, z: -4, w: 14, d: 5, floors: 4, style: 'concrete', tint: hsl(0.09, 0.2, 0.7), cell: 1.8, gh: 1.8, fh: 1.4, gable: true, roofTint: hsl(0.58, 0.06, 0.42) });   // Southwark Cathedral
    M({ x: 62, z: -12, w: 6, d: 3.4, floors: 3, style: 'brick', tint: BRICK(), cell: 1.7 }); M({ x: 72, z: -12, w: 6, d: 4, floors: 3, style: 'brick', tint: BRICK(), cell: 1.7, storefront: true });
    city.crowds.push({ x: 70, z: -10, r: 1, n: 6, look: 'commuter' });
    name('Southwark Cathedral', 'Southwark Cathedral', 59, 73, -7, -1); name('Borough Market', 'Borough Market', 66, 78, -1, 6);
    const b6 = blk(6, 2);
    lot(b6.lx0, RV.z1 + 0.5, b6.lx1, b6.lz1);
    side({ ...b6, lz0: -16.5 }, 's', 'mixed', 6);
    L.belfast = { x: 93, z: -20.6 };
    name('HMS Belfast', 'HMS Belfast', 87, 99, -22, -19);
  }
  {
    // Waterloo station's train shed; the Shard over London Bridge station; Guy's
    const w = blk(3, 3);
    lot(w.lx0, w.lz0, w.lx1, w.lz1, '#8e8a80');
    L.waterloo = M({ x: 5, z: 23, w: 31, d: 24, floors: 2, style: 'concrete', tint: hsl(0.1, 0.12, 0.72), cell: 3, gh: 2.4 });
    for (let k = 0; k < 4; k++) city.crowds.push({ x: rand(-10, 20), z: 8.6, r: 0.9, n: 4, look: 'commuter' });
    name('Waterloo station', 'Waterloo station', -15, 25, 6, 40);
    fill(blk(4, 3), 'mixed'); fill(blk(5, 3), 'mixed');
    const s = blk(6, 3);
    lot(s.lx0, s.lz0, s.lx1, s.lz1, '#9a958a');
    // the core tapers floor by floor inside the glass (the splinters above it are glass only)
    const sb = []; for (let f = 1; f < 54; f++) sb.push({ f, n: Math.round((f / 54) * 3.2) });
    const shard = M({ x: 90, z: 17, w: 9, d: 9, floors: 54, style: 'office', tint: hsl(0.58, 0.12, 0.72), cell: 1.15, gh: 1.6, fh: 1.3, setbacks: sb });
    L.shard = shard;
    M({ x: 92.5, z: 31.5, w: 16, d: 8, floors: 2, style: 'concrete', tint: hsl(0.1, 0.06, 0.7), cell: 3, gh: 2 });             // London Bridge station
    M({ x: 97.5, z: 22, w: 4.6, d: 5, floors: 22, style: 'concrete', tint: hsl(0.08, 0.08, 0.66), cell: 2.2 });             // Guy's tower
    name('The Shard', 'the Shard', 85, 95, 12, 22); name('London Bridge station', 'London Bridge station', 80, 100, 27, 37);
    for (const i of [3, 4, 5, 6]) fill(blk(i, 4), 'terrace');
  }

  // ================= THE STRAND AND THE CITY (north bank) =================
  {
    // the Embankment strip along the river: gardens, plane trees, Somerset House
    for (let i = 2; i <= 6; i++) { const b = blk(i, 2); const x0 = Math.max(b.lx0, RV.x0 + 0.5), z1 = RV.z0 - 0.5; if (x0 < b.lx1) { grass(x0, b.lz0, b.lx1, z1); for (let x = x0 + 2; x < b.lx1 - 1; x += 4.5) city.addTree(x, z1 - 1, 1.1); } }
    city.wanderZones.push({ x0: -30, x1: 100, z0: -33, z1: -32 });
    fill(blk(2, 1), 'mixed'); fill(blk(2, 0), 'mixed');
    const sh = blk(3, 1);
    lot(sh.lx0, sh.lz0, sh.lx1, sh.lz1);
    L.somerset = M({ x: 5, z: -50, w: 30, d: 11.6, floors: 4, style: 'concrete', tint: PORTLAND, cell: 2.4, gh: 1.8, fh: 1.2 });
    name('Somerset House', 'Somerset House', -15, 25, -58, -42);
    fill(blk(3, 0), 'mixed');
    // St Paul's Cathedral: west towers on Ludgate Hill, the nave, the dome over the crossing, lined up on the Millennium Bridge
    const sp = blk(4, 0);
    lot(sp.lx0, sp.lz0, sp.lx1, sp.lz1, '#b3ad9f');
    const ps = hsl(0.11, 0.12, 0.82);
    const nave = M({ x: 41, z: -74, w: 18, d: 6, floors: 5, style: 'concrete', tint: ps, cell: 2, gh: 1.8, fh: 1.4 });
    const tr = [M({ x: 40.5, z: -79.5, w: 5.4, d: 5, floors: 5, style: 'concrete', tint: ps, cell: 1.8, gh: 1.8, fh: 1.4 }), M({ x: 40.5, z: -68.5, w: 5.4, d: 5, floors: 5, style: 'concrete', tint: ps, cell: 1.8, gh: 1.8, fh: 1.4 })];
    const wt = [M({ x: 30.5, z: -76.6, w: 2.4, d: 2.4, floors: 10, style: 'concrete', tint: ps, cell: 1.3, gh: 1.8, fh: 1.3 }), M({ x: 30.5, z: -71.4, w: 2.4, d: 2.4, floors: 10, style: 'concrete', tint: ps, cell: 1.3, gh: 1.8, fh: 1.3 })];
    L.stpauls = { nave, tr, wt, dome: { x: 40.5, z: -74 } };
    city.crowds.push({ x: 35, z: -66, r: 1, n: 6, look: 'tourist', face: { x: 40.5, z: -74 } });
    fill(blk(4, 1), 'city', 6);
    name("St Paul's Cathedral", "St Paul's Cathedral", 27, 53, -84, -64);
    // the City: the Bank of England, Royal Exchange, and the towers (the Gherkin, the Cheesegrater, 22 Bishopsgate, the Walkie-Talkie)
    const bk = blk(5, 0), bk1 = blk(5, 1);
    lot(bk.lx0, bk.lz0, bk.lx1, bk.lz1);
    M({ x: 67.5, z: -74, w: 20, d: 19, floors: 3, style: 'concrete', tint: PORTLAND, cell: 3, gh: 2 });
    name('The Bank of England', 'the Bank of England', 56, 79, -87, -61);
    fill(bk1, 'city', 7);
    const c0 = blk(6, 0), c1 = blk(6, 1);
    lot(c0.lx0, c0.lz0, c0.lx1, c0.lz1, '#9c978d'); lot(c1.lx0, c1.lz0, c1.lx1, c1.lz1, '#9c978d');
    const glass = (l) => hsl(0.56, 0.12, l);
    const gherkin = M({ x: 97, z: -80, w: 7, d: 7, floors: 36, style: 'office', tint: hsl(0.5, 0.15, 0.42), cell: 1.75, fh: 1.15, setbacks: [{ f: 28, n: 1 }, { f: 33, n: 2 }] });
    const bishops = M({ x: 88.5, z: -79, w: 8, d: 8, floors: 50, style: 'office', tint: glass(0.7), cell: 2, fh: 1.2 });
    const cheese = M({ x: 88.5, z: -69, w: 8, d: 6, floors: 42, style: 'office', tint: glass(0.62), cell: 2, fh: 1.2, setbacks: [{ f: 12, n: 1 }, { f: 26, n: 2 }] });
    const t42 = M({ x: 98, z: -69, w: 5, d: 5, floors: 36, style: 'office', tint: glass(0.5), cell: 1.7, fh: 1.2 });
    const wk = [M({ x: 90, z: -51, w: 7, d: 6, floors: 8, style: 'office', tint: glass(0.6), cell: 1.75, fh: 1.2 }), M({ x: 90, z: -51, w: 8.6, d: 7, floors: 10, style: 'office', tint: glass(0.6), cell: 1.75, fh: 1.2, base: 1.6 + 7 * 1.2 }), M({ x: 90, z: -51, w: 10.4, d: 8, floors: 9, style: 'office', tint: glass(0.6), cell: 1.75, fh: 1.2, base: 1.6 + 17 * 1.2 })];
    L.city = { gherkin, bishops, cheese, t42, wk };
    M({ x: 98.5, z: -50, w: 4.6, d: 10, floors: 12, style: 'concrete', tint: STONE(), cell: 2.2 });
    for (let k = 0; k < 6; k++) city.crowds.push({ x: rand(82, 103), z: rand(-86, -46), r: 0.7, n: 3, look: 'commuter' });
    name('The Gherkin', 'the Gherkin', 93, 101, -84, -76); name('The Walkie-Talkie', 'the Walkie-Talkie', 84, 96, -57, -45); name('The Cheesegrater', 'the Cheesegrater', 83, 92, -72, -64);
    name('22 Bishopsgate', '22 Bishopsgate', 80, 90, -84, -74); name('The City', 'the City of London', 55, 105, -88, -40);
  }
  // the Tower of London on Tower Hill, beside Tower Bridge; City Hall's glass egg across the river
  {
    lot(108, -66, 140, -33, '#9fa07e');
    g.rect(110, -62, 134, -36, '#6d7f4c');                         // the dry moat, grassed
    g.rect(113, -59, 131, -39, '#a49a86');
    const stone = hsl(0.1, 0.18, 0.78);
    const white = M({ x: 122, z: -49, w: 7, d: 8, floors: 5, style: 'concrete', tint: hsl(0.1, 0.12, 0.88), cell: 1.75, gh: 1.8, fh: 1.4 });
    const walls = [M({ x: 122, z: -58.6, w: 18, d: 1.2, floors: 2, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 }), M({ x: 122, z: -39.4, w: 18, d: 1.2, floors: 2, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 }),
      M({ x: 113.6, z: -49, w: 1.2, d: 18, floors: 2, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 }), M({ x: 130.4, z: -49, w: 1.2, d: 18, floors: 2, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 })];
    for (const [x, z] of [[113.6, -58.6], [130.4, -58.6], [113.6, -39.4], [130.4, -39.4]]) walls.push(M({ x, z, w: 2.4, d: 2.4, floors: 3, style: 'concrete', tint: stone, cell: 1.2, gh: 1.4, fh: 1.2 }));
    L.tower = { white, walls };
    city.crowds.push({ x: 118, z: -42, r: 0.5, n: 2, look: 'beefeater' }, { x: 116, z: -36, r: 1.2, n: 6, look: 'tourist', face: { x: 122, z: -49 } });
    city.wanderZones.push({ x0: 115, x1: 129, z0: -45, z1: -41 });
    name('The Tower of London', 'the Tower of London', 109, 135, -63, -35); name('Tower Bridge', 'Tower Bridge', 101, 109, -33, -15);
    lot(108, -16, 140, 6, '#a49e90'); L.cityHall = { x: 116, z: -8 };
    name('City Hall', 'City Hall', 110, 122, -14, -2);
  }
  // everything else north of the river and in Covent Garden / Soho: mixed shopping streets and terraces

  // ---- the Tube: entrances with the roundel at the real stations
  for (const [x, z, n] of [[-58.7, -2, 'WESTMINSTER'], [-58.7, -55, 'CHARING CROSS'], [-11.7, 12, 'WATERLOO'], [-46, -36.7, 'EMBANKMENT'], [28.3, -57, "ST PAUL'S"], [58.3, -82, 'BANK'], [83.3, 12, 'LONDON BRIDGE'], [108.3, -36, 'TOWER HILL'], [-106.7, -45, 'GREEN PARK']]) {
    L.tube.push({ x, z, n }); city.crowds.push({ x: x + 1, z: z + 1, r: 0.7, n: 3, look: 'commuter' });
  }
  // red phone boxes and post boxes by the busy corners
  for (const n of city.nodes) if (Math.random() < 0.35 && !wet(n.x + 4, n.z + 4)) L.phones.push({ x: n.x + 3.3, z: n.z + 3.3 });
  // ---- life on the streets: Met officers, buskers, commuters at bus stops
  for (const [x, z] of [[-58.7, -6], [-65.3, -45], [21, -43.3], [101.7, -34]]) city.crowds.push({ x, z, r: 0.5, n: 2, look: 'metpolice' });
  for (const [x, z] of [[-65.2, -8], [101.7, -36]]) city.stationed.push({ x, z, rot: Math.PI, quiet: true });

  // keep the river clear: no lamps, trees, props or people standing in the water (the bridges keep theirs)
  city.lampsAlongBlock && city.blocks.forEach((b) => city.lampsAlongBlock(b, 8));
  city.lamps = city.lamps.filter((l) => !wet(l.x, l.z));
  city.trees = city.trees.filter((t) => !inRiver(t.x, t.z));
  city.props = city.props.filter((p) => !inRiver(p.x, p.z));
  city.crowds = city.crowds.filter((c) => !wet(c.x, c.z));
  city.parked = city.parked.filter((p) => !inRiver(p.x, p.z));
  // pedestrians never walk on the water (only over the bridges)
  city.noPeds = [{ x0: RV.x0, x1: RV.x1, z0: RV.z1 - 0.5, z1: 2.5 }, { x0: RV.x0, x1: RV.x1, z0: 9.5, z1: 36.5 }, { x0: RV.x0, x1: RV.x1, z0: 43.5, z1: 200 }];
  let x = RV.x0 + 6;
  for (const bx of BRIDGES.h) { city.noPeds.push({ x0: x, x1: bx - 3.4, z0: RV.z0, z1: RV.z1 }); x = bx + 3.4; }
  city.noPeds.push({ x0: x, x1: 200, z0: RV.z0, z1: RV.z1 });
  city.wanderZones = city.wanderZones.filter((w) => !wet((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2));
  city.hotspot = { x: -40, z: -10, r: 70 };
  city.river = RV; city.bridges = BRIDGES;
  return { ...ctx, agents: { cars: 64, peds: 340, wanderFrac: 0.14 }, fog: 0xbcc2c6, start: { x: -36, z: 0 }, zMin: -100, zMax: 90, xMin: -135, maxD: 220, yaw: 0.35, ownBackdrop: true };
}

// ====================================================================================================
export class London {
  constructor(scene, city) {
    this.scene = scene; this.city = city; const L = city.london;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
    this.metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.7 });
    this.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.75, envMapIntensity: 1.4, side: THREE.DoubleSide });
    this.neon = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.signs = [];
    this.river(); this.bridges(); this.parliament(L.parliament); this.abbey(L.abbey); this.palace(L.palace); this.mall(L.mall, L.admiralty);
    this.trafalgar(L.trafalgar, L.gallery); this.eye(L.eye); this.needle(L.needle); this.stpauls(L.stpauls); this.cityTowers(L.city); this.shard(L.shard);
    this.towerOfLondon(L.tower); this.towerBridge(); this.tate(); this.belfast(L.belfast); this.cityHall(L.cityHall); this.downing(L.downing);
    this.street(L); this.boats(); this.world(scene);
  }
  add(geos, mat = this.mat, shadow = true) { return merged(geos, mat, this.scene, shadow); }
  sign(w, h, draw, x, y, z, ry = 0, glow = 0.5, ds = false) {
    const tex = canvasTex(Math.max(16, Math.round(w * 64)), Math.max(16, Math.round(h * 64)), draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, transparent: true, alphaTest: 0.05, roughness: 0.5, side: ds ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m); this.signs.push(m.material); return m;
  }

  // ---------- the Thames
  river() {
    const RVv = this.city.river, sh = new THREE.Shape();
    // shape space: (x, -z)
    sh.moveTo(RVv.x0, -400); sh.lineTo(RVv.x0, -RVv.bend.z);
    sh.absarc(RVv.bend.x, -RVv.bend.z, RVv.bend.r, Math.PI, Math.PI / 2, true);
    sh.lineTo(600, -RVv.z0); sh.lineTo(600, -RVv.z1); sh.lineTo(RVv.x1, -RVv.z1); sh.lineTo(RVv.x1, -400); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh, 24).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4e5d55, roughness: 0.22, metalness: 0.35, envMapIntensity: 0.9 });
    const timeU = { value: 0 }; this.waterT = timeU;
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = timeU;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vW;')
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          vec2 wv = vec2(sin(vW.x * 1.1 + uTime * 1.3) + 0.5 * sin(vW.x * 2.7 - vW.z * 1.9 + uTime * 2.1), cos(vW.z * 1.3 + uTime * 1.1) + 0.5 * cos(vW.z * 2.3 + vW.x * 1.7 - uTime * 1.8)) * 0.06;
          normal = normalize(normal + (viewMatrix * vec4(wv.x, 0., wv.y, 0.)).xyz);`);
    };
    const m = new THREE.Mesh(geo, mat); m.position.y = 0.04; m.receiveShadow = true; this.scene.add(m);
    // embankment walls with the lamp standards along the north bank
    const P = [];
    P.push(box(0.4, 0.6, 600, RVv.x0 - 0.2, 0.3, 300 + RVv.bend.z, 0xb9b2a2), box(0.4, 0.6, 600, RVv.x1 + 0.2, 0.3, 300 + RVv.z1, 0xb9b2a2));
    P.push(box(600, 0.6, 0.4, 300 + RVv.bend.x, 0.3, RVv.z0 - 0.2, 0xb9b2a2), box(600, 0.6, 0.4, 300 + RVv.x1, 0.3, RVv.z1 + 0.2, 0xb9b2a2));
    this.add(P);
  }
  bridges() {
    const RVv = this.city.river, P = [], decks = [];
    const span = (axis, at, a0, a1, col, arches = 5) => {
      const L = a1 - a0, c = (a0 + a1) / 2;
      if (axis === 'z') {   // runs along x across the north-south stretch, at z = at
        decks.push(box(L, 0.16, 6.6, c, 0.08, at, 0x4a4b4d));
        for (const s of [-1, 1]) { P.push(box(L, 0.5, 0.3, c, 0.35, at + s * 3.3, col)); P.push(box(L, 0.7, 0.2, c, -0.25, at + s * 3.25, col)); }
        for (let k = 0; k < arches; k++) { const x = a0 + (k + 0.5) * L / arches; P.push(box(0.8, 0.6, 6.4, x - L / arches / 2, -0.1, at, 0x9a9384)); }
      } else {
        decks.push(box(6.6, 0.16, L, at, 0.08, c, 0x4a4b4d));
        for (const s of [-1, 1]) { P.push(box(0.3, 0.5, L, at + s * 3.3, 0.35, c, col)); P.push(box(0.2, 0.7, L, at + s * 3.25, -0.25, c, col)); }
        for (let k = 1; k < arches; k++) P.push(box(6.4, 0.6, 0.8, at, -0.1, a0 + k * L / arches, 0x9a9384));
      }
    };
    span('z', 6, RVv.x0 - 1, RVv.x1 + 1, 0x2f6b4a, 7);        // Westminster: green, like the Commons benches
    span('z', 40, RVv.x0 - 1, RVv.x1 + 1, 0xb3302a, 5);       // Lambeth: red, like the Lords
    span('x', -15, RVv.z0 - 1, RVv.z1 + 1, 0xd8d2c4, 5);      // Waterloo
    span('x', 25, RVv.z0 - 1, RVv.z1 + 1, 0xb3302a, 5);       // Blackfriars: red and white
    span('x', 55, RVv.z0 - 1, RVv.z1 + 1, 0x3a7a5a, 3);       // Southwark: green and yellow
    span('x', 80, RVv.z0 - 1, RVv.z1 + 1, 0xc9c4b8, 3);       // London Bridge
    span('x', 105, RVv.z0 - 1, RVv.z1 + 1, 0x2a5d9a, 2);      // Tower Bridge's deck (the towers come later)
    // the Millennium Bridge: a thin steel blade for walkers, from St Paul's to Tate Modern
    P.push(box(2.4, 0.12, RVv.z1 - RVv.z0 + 2, 40, 0.5, (RVv.z0 + RVv.z1) / 2, 0xd8dcdf));
    for (const z of [RVv.z0 + 4, RVv.z1 - 4]) P.push(box(2.8, 0.5, 0.4, 40, 0.2, z, 0xb8bcc0), box(0.15, 1.4, 0.15, 39, 1, z, 0xb8bcc0), box(0.15, 1.4, 0.15, 41, 1, z, 0xb8bcc0));
    this.add(P); this.add(decks, this.mat, false);
  }
  // ---------- Westminster
  parliament(p) {
    const { palace, big, victoria } = p, gold = 0xc9a86a, P = [];
    // pinnacles all along the river front and the roofs, the central spire, Victoria Tower's corner turrets and flag
    for (const b of palace) {
      const t = topOf(b);
      P.push(tint(hipRoof(t.w, t.d, 1.6).translate(t.cx, t.y, t.cz), 0x5f6b6e));
      for (let z = t.az + 0.6; z < t.bz; z += 1.4) for (const x of [t.ax + 0.2, t.bx - 0.2]) P.push(cone(0.18, 1.6, x, t.y + 0.8, z, gold, 4));
    }
    const pz = palace[0].z;
    P.push(cyl(1.2, 1.4, 4, -53, palace[0].cells[0].hy * 0 + topOf(palace[0]).y + 2, pz, gold, 8), cone(1.3, 7, -53, topOf(palace[0]).y + 7.5, pz, 0x6a7072, 8));
    const roof = this.add(P); hangOn(palace[0], [roof]);
    const v = topOf(victoria), V2 = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) V2.push(cyl(0.35, 0.35, 3, v.cx + sx * (v.w / 2 - 0.3), v.y + 1.5, v.cz + sz * (v.d / 2 - 0.3), gold, 8), cone(0.45, 1.6, v.cx + sx * (v.w / 2 - 0.3), v.y + 3.8, v.cz + sz * (v.d / 2 - 0.3), 0x6a7072, 8));
    V2.push(cyl(0.06, 0.06, 5, v.cx, v.y + 2.5, v.cz, 0xdddddd, 6));
    const vm = this.add(V2); hangOn(victoria, [vm], victoria.floors - 1);
    this.sign(1.6, 1, (c, w, h) => { const s = h / 3; const cols = ['#012169', '#ffffff', '#c8102e']; c.fillStyle = '#012169'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = s * 0.9; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke(); c.fillStyle = '#fff'; c.fillRect(w / 2 - s * 0.5, 0, s, h); c.fillRect(0, h / 2 - s * 0.5, w, s); c.fillStyle = cols[2]; c.fillRect(w / 2 - s * 0.3, 0, s * 0.6, h); c.fillRect(0, h / 2 - s * 0.3, w, s * 0.6); }, v.cx + 0.8, v.y + 4.4, v.cz, 0, 0.2, true);
    // Elizabeth Tower: the clock stage with four faces (showing the real time), the belfry, the spire
    const b = topOf(big), E = [], x = b.cx, z = b.cz, y = b.y;
    E.push(box(3.6, 3.4, 3.6, x, y + 1.7, z, 0xc9a86a), box(3.9, 0.3, 3.9, x, y + 3.5, z, 0xb89858));
    E.push(box(3.3, 2.2, 3.3, x, y + 4.75, z, 0xc5a465));
    for (let k = 0; k < 3; k++) E.push(box(0.25, 1.6, 3.4, x - 1.2 + k * 1.2, y + 4.75, z, 0x8a7448));
    E.push(tint(new THREE.ConeGeometry(2.3, 6.5, 4).rotateY(Math.PI / 4).translate(x, y + 9.1, z), 0x4f5a5c));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) E.push(cone(0.22, 1.6, x + sx * 1.7, y + 6.6, z + sz * 1.7, gold, 4));
    E.push(cyl(0.05, 0.12, 2.2, x, y + 13.4, z, 0xc9a86a, 6));
    const et = this.add(E, this.metal); hangOn(big, [et], big.floors - 1);
    const clock = document.createElement('canvas'); clock.width = clock.height = 128; this.clockCtx = clock.getContext('2d'); this.clockTex = new THREE.CanvasTexture(clock); this.clockTex.colorSpace = THREE.SRGBColorSpace;
    const cmat = new THREE.MeshStandardMaterial({ map: this.clockTex, emissiveMap: this.clockTex, emissive: 0xfff2d0, emissiveIntensity: 0.3, roughness: 0.5 }); this.clockMat = cmat;
    for (const [dx, dz, ry] of [[0, 1.82, 0], [0, -1.82, Math.PI], [1.82, 0, Math.PI / 2], [-1.82, 0, -Math.PI / 2]]) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), cmat); f.position.set(x + dx, y + 1.8, z + dz); f.rotation.y = ry; this.scene.add(f); hangOn(big, [f], big.floors - 1); }
    this.drawClock();
  }
  drawClock() {
    const c = this.clockCtx, d = new Date(), h = d.getHours() % 12, m = d.getMinutes();
    c.fillStyle = '#20232a'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#f4ecd2'; c.beginPath(); c.arc(64, 64, 60, 0, 6.28); c.fill();
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 3; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; c.beginPath(); c.moveTo(64 + Math.sin(a) * 46, 64 - Math.cos(a) * 46); c.lineTo(64 + Math.sin(a) * 56, 64 - Math.cos(a) * 56); c.stroke(); }
    c.strokeStyle = '#1a1a1a'; c.lineCap = 'round';
    const hand = (a, len, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); c.stroke(); };
    hand((h + m / 60) / 12 * 6.283, 30, 6); hand(m / 60 * 6.283, 48, 4);
    this.clockTex.needsUpdate = true;
  }
  abbey(a) {
    const P = [], st = 0xd8cfbd;
    for (const t of a.towers) { const tt = topOf(t); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(cone(0.25, 1.8, tt.cx + sx * 1, tt.y + 0.9, tt.cz + sz * 1, st, 4)); P.push(box(tt.w + 0.2, 0.4, tt.d + 0.2, tt.cx, tt.y + 0.2, tt.cz, st)); }
    const n = topOf(a.nave);
    for (let x = n.ax + 1; x < n.bx; x += 2) for (const s of [-1, 1]) P.push(box(0.4, 2.4, 0.5, x, n.y - 1.6, n.cz + s * (n.d / 2 + 0.3), st), cone(0.2, 1.2, x, n.y + 0.4, n.cz + s * (n.d / 2 + 0.3), st, 4));
    P.push(tint(new THREE.CircleGeometry(1.1, 16).rotateY(-Math.PI / 2).translate(n.ax - 0.05, n.y - 2.5, n.cz), 0x3a4a6a));       // the west window
    const m = this.add(P); hangOn(a.nave, [m]);
  }
  palace(p) {
    const b = topOf(p.b), P = [], x = p.b.x + p.b.w / 2;
    // the east front: the central portico with its columns and pediment, the balcony, the Royal Standard
    for (let k = 0; k < 8; k++) P.push(cyl(0.22, 0.25, 4.6, x + 0.6, 2.3 + 1.6, p.z - 4.2 + k * 1.2, 0xece6d8, 8));
    P.push(box(1.4, 0.6, 10.4, x + 0.6, 6.5, p.z, 0xe2dccd), box(0.8, 0.3, 4, x + 0.5, 3.2, p.z, 0xc8102e));
    P.push(box(b.w + 0.4, 0.6, b.d + 0.4, b.cx, b.y + 0.3, b.cz, 0xd8d2c4));
    for (let z = b.az + 1; z < b.bz; z += 2.2) P.push(box(0.3, 0.8, 0.3, b.bx, b.y + 1, z, 0xd8d2c4));
    P.push(cyl(0.05, 0.05, 4, b.cx, b.y + 2, b.cz, 0xdddddd, 6));
    const m = this.add(P); hangOn(p.b, [m]);
    this.sign(1.8, 1.1, (c, w, h) => { c.fillStyle = '#c8102e'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); c.fillStyle = '#2a4fa0'; c.fillRect(0, h / 2, w / 2, h / 2); c.fillStyle = '#e8b830'; c.fillRect(w / 2, 0, w / 2, h / 2); }, b.cx + 0.9, b.y + 3.4, b.cz, 0, 0.2, true);
    // the railings and gilded gates, the sentry boxes
    const R = [];
    for (let z = -58; z < -22; z += 0.6) R.push(box(0.06, 1.6, 0.06, -121.4, 0.8, z, 0x111111));
    R.push(box(0.1, 0.12, 36, -121.4, 1.55, -40, 0xb8952e));
    for (const z of [-47.5, -32.5]) R.push(box(0.8, 1.9, 0.8, -122.4, 0.95, z, 0x1a1a1a), tint(hipRoof(1, 1, 0.4).translate(-122.4, 1.9, z), 0x1a1a1a));
    this.add(R, this.metal);
    // the Victoria Memorial: white marble, the gilded Winged Victory on top
    const { x: mx, z: mz } = p.memorial, V = [];
    V.push(cyl(4.4, 4.6, 0.6, mx, 0.3, mz, 0xe8e4da, 28), cyl(3.6, 3.6, 0.15, mx, 0.65, mz, 0x6fa8b8, 28), box(2.6, 4, 2.6, mx, 2.6, mz, 0xf2efe8), box(1.6, 3, 1.6, mx, 6, mz, 0xf2efe8));
    V.push(cyl(0.35, 0.45, 1.6, mx, 8.3, mz, 0xd9b04a, 8), box(1.6, 0.6, 0.2, mx, 9, mz, 0xd9b04a), sph(0.25, mx, 9.3, mz, 0xd9b04a));
    this.add(V, this.metal);
  }
  mall(m, arch) {
    // Union flags along The Mall, and Admiralty Arch at the Trafalgar end
    const P = [];
    for (let x = m.x0 + 2; x < m.x1; x += 8) for (const s of [-1, 1]) { P.push(cyl(0.04, 0.05, 3.4, x, 1.7, m.z + s * 3.1, 0xe8e8e8, 6)); this.sign(0.8, 0.5, ukFlag, x + 0.42, 3.1, m.z + s * 3.1, 0, 0.15, true); }
    P.push(box(2.8, 5, 12, arch.x, 2.5, arch.z - 0, 0xe2dccd));
    this.add(P);
    const hole = this.add([box(2.9, 3, 3.2, arch.x, 1.5, arch.z, 0x2a2a2a)]); hole.scale.set(1, 1, 1);
  }
  trafalgar(t, gallery) {
    // Nelson's Column with Landseer's lions and the fountains; the National Gallery's portico and dome
    const { x, z } = t, P = [];
    P.push(box(3.2, 2.2, 3.2, x, 1.1, z, 0xc9c1b0), cyl(0.5, 0.6, 15, x, 9.7, z, 0xd8d0c0, 12), box(1.3, 1, 1.3, x, 17.6, z, 0xb89858), cyl(0.2, 0.25, 1.2, x, 18.7, z, 0x6a6a6a, 8));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(box(1.6, 0.8, 0.9, x + sx * 2.4, 0.4, z + sz * 2.4, 0xc9c1b0), tint(new THREE.BoxGeometry(1.3, 0.7, 0.6).translate(x + sx * 2.4, 1.15, z + sz * 2.4), 0x3a3a38));
    for (const dx of [-6, 6]) P.push(cyl(2.2, 2.3, 0.5, x + dx, 0.25, z + 2, 0xd0c8b8, 18), cyl(2, 2, 0.08, x + dx, 0.5, z + 2, 0x6fa8b8, 18), cyl(0.3, 0.4, 1.6, x + dx, 1.1, z + 2, 0xd0c8b8, 8));
    this.add(P);
    const g2 = topOf(gallery), Q = [];
    for (let k = 0; k < 8; k++) Q.push(cyl(0.22, 0.25, 4, g2.cx - 2.8 + k * 0.8, 2.6, gallery.z + gallery.d / 2 + 0.6, 0xece6d8, 8));
    Q.push(box(7, 0.8, 1.6, g2.cx, 5, gallery.z + gallery.d / 2 + 0.4, 0xe2dccd), tint(new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(g2.cx, g2.y + 0.6, g2.cz), 0x8a9a9a), cyl(1.4, 1.4, 1.2, g2.cx, g2.y, g2.cz, 0xe2dccd, 16));
    const gm = this.add(Q); hangOn(gallery, [gm]);
  }
  eye(e) {
    // the London Eye: the rim on its cable spokes, 32 capsules, the A-frame legs on the bank
    const g2 = new THREE.Group(); g2.position.set(e.x, e.r + 1.6, e.z); g2.rotation.y = Math.PI / 2;     // its rim parallel to the river
    const P = [tint(new THREE.TorusGeometry(e.r, 0.18, 6, 72), 0xf2f2f0), tint(new THREE.TorusGeometry(e.r - 0.7, 0.08, 6, 72), 0xe0e0e0), cyl(0.7, 0.7, 1.4, 0, 0, 0, 0xdedede).rotateX(Math.PI / 2)];
    for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283; P.push(tint(new THREE.BoxGeometry(0.035, e.r, 0.035).translate(0, e.r / 2, 0).rotateZ(a), 0xd8d8d8)); }
    g2.add(new THREE.Mesh(mergeGeometries(P), this.metal));
    this.capsules = [];
    const cg = new THREE.SphereGeometry(0.62, 12, 8).scale(1.25, 0.7, 0.7), cm = new THREE.MeshStandardMaterial({ color: 0xcfe8f6, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85, emissive: 0x3a6aaa, emissiveIntensity: 0 });
    for (let k = 0; k < 32; k++) { const m = new THREE.Mesh(cg, cm); g2.add(m); this.capsules.push(m); }
    this.capMat = cm; this.eyeG = g2; this.eyeR = e.r; this.scene.add(g2);
    // the A-frame: two legs from the bank up to the hub, leaning out over the water
    const hub = new THREE.Vector3(e.x, e.r + 1.6, e.z), legs = [];
    for (const s of [-1, 1]) { const foot = new THREE.Vector3(e.x + 5.5, 0, e.z + s * 3), d = hub.clone().sub(foot), len = d.length(); const g3 = new THREE.CylinderGeometry(0.22, 0.4, len, 8).translate(0, len / 2, 0); g3.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g3.translate(foot.x, foot.y, foot.z); legs.push(tint(g3, 0xf2f2f0)); }
    legs.push(box(2, 0.6, 9, e.x + 5.5, 0.3, e.z, 0xd8d8d8));
    this.add(legs, this.metal);
  }
  needle(n) { this.add([box(0.7, 6, 0.7, n.x, 3.4, n.z, 0xa89878), cone(0.5, 0.8, n.x, 6.8, n.z, 0x9a8a6a, 4), box(1.6, 0.5, 1.6, n.x, 0.25, n.z, 0x8a7a60)]); }
  stpauls(s) {
    // the dome on its colonnaded drum, the lantern and gilded cross; the baroque west towers
    const { x, z } = s.dome, base = topOf(s.nave).y, P = [];
    P.push(cyl(4.4, 4.6, 4, x, base + 2, z, 0xd8d2c4, 28));
    for (let a = 0; a < 6.28; a += 0.26) P.push(cyl(0.18, 0.2, 3.4, x + Math.cos(a) * 4.7, base + 1.9, z + Math.sin(a) * 4.7, 0xe8e2d4, 6));
    P.push(cyl(4.9, 4.9, 0.4, x, base + 3.8, z, 0xd0c8b8, 28), cyl(3.9, 4, 2.2, x, base + 5, z, 0xd8d2c4, 24));
    P.push(tint(new THREE.SphereGeometry(4, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(x, base + 6, z), 0x8a9a96));
    for (let a = 0; a < 6.28; a += 0.52) P.push(box(0.12, 4.4, 0.12, x + Math.cos(a) * 2.3, base + 8.4, z + Math.sin(a) * 2.3, 0xd8d2c4).rotateX(0));
    P.push(cyl(0.7, 0.8, 2.6, x, base + 11.8, z, 0xd8d2c4, 12), sph(0.35, x, base + 13.4, z, 0xd9b04a), box(0.12, 1.1, 0.12, x, base + 14.1, z, 0xd9b04a), box(0.6, 0.12, 0.12, x, base + 14.3, z, 0xd9b04a));
    const dome = this.add(P); hangOn(s.nave, [dome]);
    for (const t of s.wt) { const tt = topOf(t), Q = [cyl(1, 1.1, 2.4, tt.cx, tt.y + 1.2, tt.cz, 0xd8d2c4, 12), tint(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(tt.cx, tt.y + 2.4, tt.cz), 0x8a9a96), cone(0.25, 1.6, tt.cx, tt.y + 3.9, tt.cz, 0xd9b04a, 8)]; hangOn(t, [this.add(Q)]); }
    const n = topOf(s.nave);
    this.add([box(1, 3, 6.4, n.ax - 0.6, 3.5, n.cz, 0xe2dccd), ...[0, 1, 2, 3, 4, 5].map((k) => cyl(0.2, 0.22, 3, n.ax - 0.9, 2.6, n.cz - 2.5 + k, 0xece6d8, 8))]);
  }
  cityTowers(c) {
    // the Gherkin: its bullet of glass with the dark spiral bands
    const g2 = c.gherkin, gx = g2.x, gz = g2.z, H = topOf(g2).y + 1.2;
    const prof = []; for (let k = 0; k <= 14; k++) { const t = k / 14, y = t * H, r = 4.1 * Math.sin(Math.min(1, 0.22 + t * 1.05) * Math.PI * 0.62) * (t > 0.86 ? 1 - (t - 0.86) * 4.5 : 1); prof.push([Math.max(0, r), y]); }
    prof.push([0, H + 0.4]);
    skinOn(this.scene, g2, latheTris(gx, gz, prof, 24), (p) => ((Math.atan2(p.z - gz, p.x - gx) * 3 + p.y * 0.35) % 1.2 + 1.2) % 1.2 < 0.35 ? 0x1a2a2a : 0x6f8f8e, this.glass);
    // the Walkie-Talkie's green crown garden, the Cheesegrater's sloping face, Bishopsgate's crown
    const w = topOf(c.wk[2]); this.add([box(w.w - 0.4, 0.4, w.d - 0.4, w.cx, w.y + 0.2, w.cz, 0x4f7a3a)]);
    const ch = topOf(c.cheese), slope = []; for (let k = 0; k < 4; k++) slope.push(box(ch.w, 0.2, 2, ch.cx, ch.y - k * 6, ch.bz + 0.6 + k * 1.2, 0x9ab0bc));
    hangOn(c.cheese, [this.add(slope, this.glass)]);
    const b = topOf(c.bishops); hangOn(c.bishops, [this.add([box(b.w + 0.2, 1.2, b.d + 0.2, b.cx, b.y + 0.6, b.cz, 0x8aa0aa)], this.glass)], c.bishops.floors - 1);
  }
  shard(s) {
    // the Shard: a glass pyramid of splinters on its stepped core, open at the very top
    const t = topOf(s), H = t.y + 22;
    skinOn(this.scene, s, pyramidTris(s.x, s.z, s.w / 2 + 0.35, 0.45, 0, H - 2, 10), (p) => (Math.sin(p.y * 0.8 + p.x) > 0.6 ? 0xb7cbd8 : 0x8faabd), this.glass);
    const top = []; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) top.push(tint(new THREE.ConeGeometry(0.25, 4, 4).translate(s.x + sx * 0.35, H, s.z + sz * 0.35), 0xa8c0d0));
    hangOn(s, [this.add(top, this.glass)], s.floors - 1);
  }
  towerOfLondon(t) {
    // the White Tower's four corner turrets with their lead cupolas and weathervanes; crenellations on the walls
    const w = topOf(t.white), P = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = w.cx + sx * (w.w / 2 - 0.5), z = w.cz + sz * (w.d / 2 - 0.5), round = sx > 0 && sz < 0;
      P.push(round ? cyl(0.8, 0.8, 2.6, x, w.y + 1.3, z, 0xe8e2d4, 12) : box(1.4, 2.6, 1.4, x, w.y + 1.3, z, 0xe8e2d4));
      P.push(tint(new THREE.SphereGeometry(0.75, 10, 8).scale(1, 1.3, 1).translate(x, w.y + 3.2, z), 0x6a7378), cyl(0.03, 0.03, 1, x, w.y + 4.5, z, 0xd9b04a, 4));
    }
    for (let x = w.ax; x < w.bx; x += 0.8) for (const z of [w.az, w.bz]) P.push(box(0.4, 0.5, 0.3, x, w.y + 0.25, z, 0xe8e2d4));
    hangOn(t.white, [this.add(P)]);
    for (const wall of t.walls) { const tt = topOf(wall), Q = []; const long = tt.w > tt.d; for (let a = 0; a < Math.max(tt.w, tt.d); a += 0.8) Q.push(box(0.4, 0.5, 0.4, long ? tt.ax + a : tt.cx, tt.y + 0.25, long ? tt.cz : tt.az + a, 0xcfc6b2)); hangOn(wall, [this.add(Q)]); }
    this.sign(1.6, 1, ukFlag, w.cx, w.y + 5.6, w.cz, 0, 0.2, true);
    this.add([cyl(0.04, 0.04, 2.4, w.cx - 0.8, w.y + 4.4, w.cz, 0xdddddd, 6)]);
  }
  towerBridge() {
    // two Gothic towers on piers in the river, the high walkways, the blue suspension chains to the banks
    const RVv = this.city.river, x = 105, zs = [RVv.z0 + 3.8, RVv.z1 - 3.8], P = [], B = [];
    for (const z of zs) {
      P.push(box(4.6, 1.2, 4.6, x, -0.2, z, 0x9a9384));
      P.push(box(4, 12, 3.4, x, 6, z, 0xd8ccb0));
      for (let y = 2; y < 12; y += 2.5) P.push(box(4.05, 0.25, 3.45, x, y, z, 0xc2b494));
      P.push(box(1.6, 3.6, 0.1, x, 4.2, z - 1.75, 0x2a2a2a), box(1.6, 3.6, 0.1, x, 4.2, z + 1.75, 0x2a2a2a));
      P.push(tint(hipRoof(4.2, 3.6, 2.6).translate(x, 12, z), 0x5a6468));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.push(cyl(0.45, 0.45, 3, x + sx * 1.8, 13, z + sz * 1.5, 0xd8ccb0, 8), cone(0.55, 2, x + sx * 1.8, 15.5, z + sz * 1.5, 0x5a6468, 8), cyl(0.03, 0.03, 0.8, x + sx * 1.8, 16.8, z + sz * 1.5, 0xd9b04a, 4));
    }
    // walkways between the towers (blue and white), and the chains to each bank
    for (const y of [10.2, 11.2]) B.push(box(2.2, 0.5, zs[1] - zs[0] - 3.4, x, y, (zs[0] + zs[1]) / 2, 0x6fa0d0));
    B.push(box(0.15, 0.9, zs[1] - zs[0] - 3.4, x - 1.1, 10.7, (zs[0] + zs[1]) / 2, 0xf2f2f2), box(0.15, 0.9, zs[1] - zs[0] - 3.4, x + 1.1, 10.7, (zs[0] + zs[1]) / 2, 0xf2f2f2));
    for (const [z0, z1] of [[zs[0] - 1.7, RVv.z0 - 4], [zs[1] + 1.7, RVv.z1 + 4]]) for (const sx of [-1, 1]) {
      const n = 8; for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, ya = 9 - Math.sin(t0 * Math.PI / 2) * 8.4, yb = 9 - Math.sin(t1 * Math.PI / 2) * 8.4, za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1; const L = Math.hypot(zb - za, yb - ya); B.push(tint(new THREE.BoxGeometry(0.3, 0.3, L).rotateX(Math.atan2(-(yb - ya), zb - za)).translate(x + sx * 2.1, (ya + yb) / 2, (za + zb) / 2), 0x5aa0d8)); }
    }
    this.add(P); this.add(B, this.metal);
  }
  tate() { /* the chimney is a building (js/london.js map); a lit slit at the top */ }
  belfast(b) {
    const P = [box(1.6, 1.2, 12, b.x, 0.4, b.z, 0x6a747c), box(1.2, 1.4, 4, b.x, 1.6, b.z - 1, 0x7a848c), box(0.8, 2.4, 1.2, b.x, 2.6, b.z - 1.4, 0x6a747c), cyl(0.08, 0.1, 4, b.x, 4, b.z - 2, 0x3a3a3a, 6), cyl(0.08, 0.1, 3.2, b.x, 3.4, b.z + 1.5, 0x3a3a3a, 6)];
    for (const dz of [-4.4, -3, 3, 4.4]) P.push(box(0.6, 0.5, 1, b.x, 1.3, b.z + dz, 0x5a646c), box(0.12, 0.12, 1.6, b.x, 1.5, b.z + dz + Math.sign(dz) * 0.9, 0x3a3a3a));
    this.add(P);
  }
  cityHall(c) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 16).scale(1, 1.5, 1).translate(c.x, 4.4, c.z), new THREE.MeshStandardMaterial({ color: 0x9ab4c4, roughness: 0.1, metalness: 0.7 }));
    m.castShadow = true; this.scene.add(m);
  }
  downing(d) {
    // the most famous front door in Britain, and the policeman outside it
    this.add([box(0.5, 1.1, 0.08, d.x, 0.55, d.z + 0.05, 0x0d0d0f), box(0.14, 0.06, 0.04, d.x, 0.9, d.z + 0.1, 0xd8d8d8), box(0.6, 0.06, 0.4, d.x, 1.15, d.z + 0.2, 0xf2f2f2)]);
    this.sign(0.7, 0.18, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `700 ${h * 0.6}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DOWNING ST', w / 2, h / 2); }, d.x + 1.4, 1.7, d.z + 0.06, 0, 0.2);
  }
  // the furniture of a London street: Tube roundels, phone boxes, post boxes, pub boards
  street(L) {
    const roundel = (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#dc241f'; c.lineWidth = h * 0.16; c.beginPath(); c.arc(w / 2, h / 2, h * 0.36, 0, 6.28); c.stroke(); c.fillStyle = '#0019a8'; c.fillRect(w * 0.04, h * 0.41, w * 0.92, h * 0.18); c.fillStyle = '#fff'; c.font = `700 ${h * 0.13}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UNDERGROUND', w / 2, h * 0.5); };
    const P = [];
    for (const t of L.tube) {
      P.push(box(0.08, 2.6, 0.08, t.x, 1.3, t.z, 0x2a2a2a));
      this.sign(1, 1, roundel, t.x, 2.9, t.z, 0, 0.6, true);
      P.push(box(0.9, 0.06, 2, t.x, 0.03, t.z + 1.6, 0x1a1a1a), box(0.05, 0.6, 2, t.x - 0.45, 0.3, t.z + 1.6, 0x2a2a2a), box(0.05, 0.6, 2, t.x + 0.45, 0.3, t.z + 1.6, 0x2a2a2a));
    }
    for (const p of L.phones) {
      P.push(box(0.5, 1.5, 0.5, p.x, 0.75, p.z, 0xc8102e), box(0.56, 0.12, 0.56, p.x, 1.56, p.z, 0xc8102e), box(0.42, 0.9, 0.52, p.x, 0.85, p.z, 0x5a7a8a));
      P.push(cyl(0.16, 0.16, 0.9, p.x + 0.9, 0.45, p.z, 0xc8102e, 10), cyl(0.18, 0.18, 0.1, p.x + 0.9, 0.95, p.z, 0x111111, 10));
    }
    for (const pub of L.pubs) {
      P.push(box(0.06, 0.06, 1, pub.x, 2.2, pub.z + 0.5, 0x1a1a1a));
      const nm = pick(['THE RED LION', 'THE CROWN', 'THE GEORGE', 'THE KINGS ARMS', 'THE WHITE HART', 'THE ROYAL OAK', 'THE PLOUGH', 'THE SWAN', 'THE BELL', 'THE ANCHOR']);
      this.sign(0.9, 1.1, (c, w, h) => { c.fillStyle = pick(['#123a1e', '#5a1414', '#14243a', '#2a1a0a']); c.fillRect(0, 0, w, h); c.strokeStyle = '#d8b04a'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = '#f2d27a'; c.font = `700 ${h * 0.11}px Georgia`; c.textAlign = 'center'; c.fillText(nm.replace('THE ', 'The '), w / 2, h * 0.88); c.beginPath(); c.arc(w / 2, h * 0.45, w * 0.28, 0, 6.28); c.fill(); }, pub.x, 1.6, pub.z + 1, Math.PI / 2, 0.5, true);
    }
    this.add(P);
  }
  // Thames boats: river buses and tour boats going up and down
  boats() {
    const RVv = this.city.river;
    const hull = mergeGeometries([tint(new THREE.BoxGeometry(1.6, 0.5, 5).translate(0, 0.25, 0), 0xf2f2ee), tint(new THREE.BoxGeometry(1.4, 0.7, 3.2).translate(0, 0.85, -0.2), 0x2a3a4a), tint(new THREE.BoxGeometry(1.5, 0.12, 3.4).translate(0, 1.25, -0.2), 0xf2f2ee)]);
    this.boatList = [];
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(hull, this.mat); m.castShadow = true; this.scene.add(m);
      this.boatList.push({ m, t: k / 5, v: 0.01 + Math.random() * 0.006, lane: k % 2 ? 1 : -1 });
    }
    // the route: up the north-south stretch, round the bend, east along the eastward stretch
    const pts = [[-40, 120], [-40, -14], [-34, -22], [-20, -24], [200, -24]].map(([a, b]) => new THREE.Vector3(a, 0, b));
    this.boatPath = new THREE.CatmullRomCurve3(pts);
  }

  // ---------- the rest of London around the map: terraces in every direction, the river beyond, distant towers
  world(scene) {
    const r = rnd(1666), R = (a, b) => a + r() * (b - a);
    const S = 2048, SIZE = 3600, k = S / SIZE, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), P = (v) => (v + SIZE / 2) * k;
    x.fillStyle = '#7d786e'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 16000; i++) { x.fillStyle = pick(['#8a6a58', '#9a7a62', '#7a6a5a', '#8a8a82', '#6a7a52', '#a09080']); x.fillRect(R(0, S), R(0, S), R(1.5, 4), R(1.5, 4)); }
    for (let v = -1800; v < 1800; v += R(18, 34)) { x.fillStyle = 'rgba(70,70,72,.6)'; x.fillRect(P(v), 0, 1.4, S); }
    for (let v = -1800; v < 1800; v += R(18, 34)) { x.fillStyle = 'rgba(70,70,72,.6)'; x.fillRect(0, P(v), S, 1.4); }
    // parks: Hyde Park to the west, Regent's Park to the north-west, Greenwich far east
    for (const [cx, cz, rx, rz] of [[-330, -90, 120, 60], [-260, -330, 70, 60], [560, 120, 70, 50], [80, 260, 60, 40]]) { x.fillStyle = '#5f7a42'; x.beginPath(); x.ellipse(P(cx), P(cz), rx * k, rz * k, 0, 0, 6.28); x.fill(); }
    // the Thames: south-west past Battersea, and east to the loop round the Isle of Dogs
    x.strokeStyle = '#4c5b52'; x.lineWidth = 15 * k; x.lineCap = 'round'; x.beginPath();
    x.moveTo(P(-40), P(180)); x.bezierCurveTo(P(-40), P(260), P(-120), P(300), P(-260), P(290)); x.bezierCurveTo(P(-400), P(280), P(-520), P(200), P(-700), P(260)); x.stroke();
    x.beginPath(); x.moveTo(P(190), P(-24)); x.bezierCurveTo(P(300), P(-30), P(360), P(0), P(380), P(80)); x.bezierCurveTo(P(400), P(220), P(560), P(230), P(560), P(100)); x.bezierCurveTo(P(560), P(10), P(700), P(-20), P(900), P(40)); x.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
    // terraces and blocks all around, taller toward the centres
    const boxes = [];
    for (let i = 0; i < 4200; i++) {
      const bx = R(-900, 900), bz = R(-900, 900);
      if (Math.max(Math.abs(bx), Math.abs(bz)) < 200 && !(bx < -150 && bz > -110 && bz < 30)) continue;
      if (Math.abs(bx) < 205 && Math.abs(bz) < 205) continue;
      const d = Math.hypot(bx, bz); if (r() > Math.exp(-d / 650)) continue;
      boxes.push([bx, bz, R(5, 12), R(5, 12), r() < 0.05 ? R(10, 30) : R(2.5, 6)]);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), boxes.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    boxes.forEach(([bx, bz, w, d, h], i) => { m4.makeScale(w, h, d).setPosition(bx, 0, bz); im.setMatrixAt(i, m4); im.setColorAt(i, r() < 0.55 ? col.setHSL(R(0.02, 0.1), R(0.25, 0.45), R(0.42, 0.62), THREE.SRGBColorSpace) : col.setHSL(R(0.08, 0.12), R(0.05, 0.15), R(0.7, 0.86), THREE.SRGBColorSpace)); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
    // landmarks on the horizon: Canary Wharf's towers, the BT Tower, Battersea Power Station's four chimneys
    const N = [];
    for (const [bx, bz, h, w] of [[480, 140, 78, 9], [500, 120, 64, 8], [460, 120, 68, 8], [520, 150, 52, 8], [470, 165, 50, 7]]) N.push(box(w, h, w, bx, h / 2, bz, 0xb8c4cc));
    N.push(cone(5, 6, 480, 81, 140, 0xc8d0d4, 4));
    N.push(cyl(2.2, 2.4, 58, -150, 29, -330, 0xc8c8c4, 12), cyl(3.2, 3.2, 6, -150, 48, -330, 0x4a4e52, 12));
    N.push(box(30, 14, 22, -150, 7, 300, 0x8a5a42));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) N.push(cyl(1.4, 1.8, 30, -150 + sx * 14, 15, 300 + sz * 10, 0xf2f0ea, 12));
    const far = new THREE.Mesh(mergeGeometries(N), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    far.castShadow = true; scene.add(far);
  }

  update(dt) {
    const n = G.night || 0, t = G.time;
    if (this.waterT) this.waterT.value = t;
    for (const m of this.signs) m.emissiveIntensity = (m.userData.base ??= m.emissiveIntensity) * (0.3 + n * 1.4);
    if (this.clockMat) this.clockMat.emissiveIntensity = 0.25 + n * 1.2;
    if ((this._clk = (this._clk || 0) - dt) <= 0) { this._clk = 20; this.drawClock(); }
    if (this.capMat) this.capMat.emissiveIntensity = n * 1.1;
    // the Eye turns slowly (half an hour a lap for real), capsules stay level
    if (this.eyeG) { const a = t * 0.025; this.eyeG.children[0].rotation.z = a; this.capsules.forEach((m, k) => { const b = a + k / 32 * 6.283; m.position.set(Math.sin(b) * (this.eyeR + 0.5), -Math.cos(b) * (this.eyeR + 0.5), 0); }); }
    // boats on the Thames
    for (const b of this.boatList || []) {
      b.t = (b.t + dt * b.v) % 1; const dir = b.lane > 0 ? b.t : 1 - b.t;
      const p = this.boatPath.getPointAt(dir), q = this.boatPath.getTangentAt(dir).multiplyScalar(b.lane > 0 ? 1 : -1);
      b.m.position.set(p.x + q.z * 2.2 * b.lane * 0 + (b.lane > 0 ? -q.z : q.z) * 2.4, 0.08 + Math.sin(t * 1.5 + b.t * 40) * 0.03, p.z + (b.lane > 0 ? q.x : -q.x) * 2.4);
      b.m.rotation.y = Math.atan2(q.x, q.z);
    }
  }
}
function ukFlag(c, w, h) {
  const s = h / 5; c.fillStyle = '#012169'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#fff'; c.lineWidth = s * 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
  c.strokeStyle = '#c8102e'; c.lineWidth = s * 0.45; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(w / 2 - s, 0, s * 2, h); c.fillRect(0, h / 2 - s, w, s * 2);
  c.fillStyle = '#c8102e'; c.fillRect(w / 2 - s * 0.6, 0, s * 1.2, h); c.fillRect(0, h / 2 - s * 0.6, w, s * 1.2);
}

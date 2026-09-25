import * as THREE from 'three';
import { rand, pick } from './core.js';
import { City, Ground } from './city.js';

const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
const TINT = {
  brick: () => Math.random() < 0.2 ? hsl(rand(0.07, 0.1), rand(0.25, 0.4), rand(0.62, 0.72)) : hsl(rand(0.0, 0.05), rand(0.35, 0.55), rand(0.42, 0.6)),
  concrete: () => hsl(rand(0.08, 0.14), rand(0.05, 0.2), rand(0.66, 0.84)),
  office: () => hsl(rand(0.55, 0.62), rand(0.03, 0.12), rand(0.7, 0.88)),
  stucco: () => Math.random() < 0.45 ? hsl(0.1, 0.2, rand(0.88, 0.95)) : hsl(Math.random(), rand(0.3, 0.55), rand(0.72, 0.84)),
  house: () => Math.random() < 0.35 ? hsl(0.12, 0.15, rand(0.86, 0.94)) : hsl(pick([0.08, 0.12, 0.3, 0.55, 0.6, 0.02]), rand(0.2, 0.4), rand(0.66, 0.8)),
};
const ROOF_TINTS = [hsl(0, 0, 0.55), hsl(0.05, 0.3, 0.52), hsl(0.6, 0.12, 0.58), hsl(0.02, 0.4, 0.52), hsl(0.08, 0.2, 0.62)];

function partition(total, n, min = 3) {
  const w = [];
  let left = total;
  for (let i = 0; i < n - 1; i++) { const v = Math.max(min, rand(0.7, 1.3) * left / (n - i)); w.push(v); left -= v; }
  w.push(left);
  return w;
}

// Coarse "outskirts" blocks filling the blurred horizon; still destructible, just with bigger cells.
function outskirts(ctx, kind) {
  const { city, B, g } = ctx;
  const X = city.allX, Z = city.allZ, hw = city.roadW / 2;
  for (let a = 0; a + 1 < X.length; a++) for (let b = 0; b + 1 < Z.length; b++) {
    const x0 = X[a] + hw, x1 = X[a + 1] - hw, z0 = Z[b] + hw, z1 = Z[b + 1] - hw;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const inner = cx > city.xs[0] && cx < city.xs[city.xs.length - 1] && cz > city.zs[0] && cz < city.zs[city.zs.length - 1];
    if (inner || (ctx.skipOuter && ctx.skipOuter(cx, cz))) continue;
    const blk = { x0, x1, z0, z1 };
    city.paintSidewalk(g, blk);
    const s = city.sw;
    if (kind === 'houses') {
      city.paintGrass(g, x0 + s, z0 + s, x1 - s, z1 - s);
      for (const zz of [z0 + s + 4, z1 - s - 4]) for (let x = x0 + s + 3.5; x < x1 - s - 3; x += 7) {
        B.add({ x, z: zz, w: 4.4, d: 4, floors: 1 + (Math.random() < 0.4), style: 'house', tint: TINT.house(), cell: 2.2, fh: 0.95, gh: 1, gable: true, roofTint: pick(ROOF_TINTS) });
        city.addTree(x + 3, (z0 + z1) / 2 + rand(-3, 3), 1.1);
      }
    } else {
      g.rect(x0 + s, z0 + s, x1 - s, z1 - s, '#6d6a64');
      const d = Math.hypot(cx, cz);
      const f = kind === 'tropical' ? Math.round(rand(2, 5)) : Math.max(3, Math.round(rand(4, 12) * Math.exp(-(d - 60) / 60)));
      const style = kind === 'tropical' ? 'stucco' : pick(['brick', 'concrete', 'brick', 'office']);
      const half = (x1 - x0 - 2 * s) / 2;
      for (const ox of [-1, 1]) {
        B.add({ x: cx + ox * (half / 2 + 0.1), z: cz, w: half - 0.3, d: z1 - z0 - 2 * s - 0.3, floors: Math.max(2, f + Math.round(rand(-2, 3))), style, tint: TINT[style](), cell: 3.4, fh: 1, gh: 1.35 });
      }
    }
  }
}

// Groups of people standing around: street corners, storefronts, plazas.
function crowdsAroundBlock(city, b, pCorner, pFront, big = 1) {
  const cr = (city.crowds ||= []), s = city.sw;
  for (const [x, z] of [[b.x0 + 0.9, b.z0 + 0.9], [b.x1 - 0.9, b.z0 + 0.9], [b.x0 + 0.9, b.z1 - 0.9], [b.x1 - 0.9, b.z1 - 0.9]]) {
    if (Math.random() < pCorner) cr.push({ x, z, r: 0.7, n: Math.round(rand(3, 6) * big) });
  }
  for (let x = b.x0 + 4; x < b.x1 - 4; x += 6) {
    if (Math.random() < pFront) cr.push({ x: x + rand(-1, 1), z: b.z0 + s * 0.55, r: 0.55, n: Math.round(rand(2, 4) * big) });
    if (Math.random() < pFront) cr.push({ x: x + rand(-1, 1), z: b.z1 - s * 0.55, r: 0.55, n: Math.round(rand(2, 4) * big) });
  }
  for (let z = b.z0 + 4; z < b.z1 - 4; z += 6) {
    if (Math.random() < pFront) cr.push({ x: b.x0 + s * 0.55, z: z + rand(-1, 1), r: 0.55, n: Math.round(rand(2, 4) * big) });
    if (Math.random() < pFront) cr.push({ x: b.x1 - s * 0.55, z: z + rand(-1, 1), r: 0.55, n: Math.round(rand(2, 4) * big) });
  }
}
function crowdsIn(city, z0, n, sizeMin = 3, sizeMax = 7) {
  for (let i = 0; i < n; i++) (city.crowds ||= []).push({ x: rand(z0.x0, z0.x1), z: rand(z0.z0, z0.z1), r: rand(0.7, 1.2), n: Math.round(rand(sizeMin, sizeMax)) });
}

function makeCtx(o, B) {
  const city = new City(o);
  const g = new Ground(o.extent, 4096);
  g.rect(-o.extent, -o.extent, o.extent, o.extent, o.baseColor || '#6e6b62');
  g.grainRect(-o.extent, -o.extent, o.extent, o.extent, 0.3, 40);
  city.paintRoads(g);
  return { city, g, B };
}

// ================= DOWNTOWN =================
export function downtown(B) {
  const P = [-66, -44, -22, 0, 22, 44, 66];
  const ctx = makeCtx({ xs: P, zs: P, roadW: 5, sw: 1.7, half: 66, extent: 112, centerLine: 'yellow' }, B);
  const { city, g } = ctx;
  const special = { '2,3': 'park', '0,4': 'parking', '4,1': 'parking', '3,2': 'plaza', '5,5': 'parking', '4,4': 'ballpark', '2,1': 'tower', '3,1': 'tower', '1,3': 'tower' };
  const towerFloors = { '2,1': 60, '3,1': 50, '1,3': 44 };
  // light rail runs down the street at z = 0 (a trolley-only transit mall), with two stations
  // the harbour is the west edge: seawall at x = -74, open water beyond (see harbor.js)
  city.shoreX = -74;
  city.bridgeClear = [{ x: -45, z: 124, r: 22 }, { x: -62, z: 112, r: 16 }];
  ctx.skipOuter = (x, z) => x < -70;
  city.rail = { z: 0, stations: [{ x: 11, name: 'CIVIC CENTER' }, { x: -33, name: 'GASLAMP QUARTER' }] };
  city.towers = [];
  for (const b of city.blocks) {
    city.paintSidewalk(g, b);
    const kind = special[`${b.i},${b.j}`];
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    city.lampsAlongBlock(b, 7.5);
    city.addProp('hydrant', b.x0 + 0.5, b.z0 + 2.2); city.addProp('bin', b.x1 - 0.5, b.z1 - 2.6);
    city.addProp('sign', b.x0 + 0.4, b.z1 - 0.4, 0);
    if (kind === 'park') {
      city.paintGrass(g, b.lx0 - 0.4, b.lz0 - 0.4, b.lx1 + 0.4, b.lz1 + 0.4, '#58793a');
      g.line(b.lx0, b.lz0, b.lx1, b.lz1, 1.1, '#c8b995'); g.line(b.lx1, b.lz0, b.lx0, b.lz1, 1.1, '#c8b995');
      g.circle(cx, cz, 2.2, '#c8b995'); g.circle(cx, cz, 1.2, '#5a86a8');
      for (let i = 0; i < 26; i++) city.addTree(rand(b.lx0 + 1, b.lx1 - 1), rand(b.lz0 + 1, b.lz1 - 1), rand(1.1, 1.5));
      for (let i = 0; i < 6; i++) city.addProp('bench', cx + rand(-5, 5), cz + rand(-5, 5), rand(0, 6));
      city.wanderZones.push({ x0: b.lx0 + 0.5, x1: b.lx1 - 0.5, z0: b.lz0 + 0.5, z1: b.lz1 - 0.5 });
      crowdsIn(city, { x0: b.lx0 + 1, x1: b.lx1 - 1, z0: b.lz0 + 1, z1: b.lz1 - 1 }, 5, 3, 6);
      crowdsAroundBlock(city, b, 0.5, 0.1);
    } else if (kind === 'plaza') {
      g.rect(b.lx0 - 0.5, b.lz0 - 0.5, b.lx1 + 0.5, b.lz1 + 0.5, '#b9b2a4');
      for (let x = b.lx0; x < b.lx1; x += 1.2) g.line(x, b.lz0, x, b.lz1, 0.03, 'rgba(0,0,0,.12)');
      for (let z = b.lz0; z < b.lz1; z += 1.2) g.line(b.lx0, z, b.lx1, z, 0.03, 'rgba(0,0,0,.12)');
      B.add({ x: cx, z: b.lz0 + 3, w: b.lx1 - b.lx0, d: 5.5, floors: 20, style: 'office', tint: TINT.office(), cell: 1.7, gh: 1.8, setbacks: [{ f: 14, n: 1 }] });
      for (let x = b.lx0 + 1.5; x < b.lx1; x += 3) for (let z = cz + 1; z < b.lz1; z += 3) { city.addTree(x, z, 0.9); }
      city.wanderZones.push({ x0: b.lx0, x1: b.lx1, z0: cz, z1: b.lz1 });
      crowdsIn(city, { x0: b.lx0 + 1, x1: b.lx1 - 1, z0: cz + 1, z1: b.lz1 - 1 }, 7, 4, 9);
      crowdsAroundBlock(city, b, 0.8, 0.35);
    } else if (kind === 'tower') {
      // supertall: full-block podium, then a slimmer shaft with setbacks; the tallest gets a crown (see signs.js)
      g.rect(b.lx0 - 0.6, b.lz0 - 0.6, b.lx1 + 0.6, b.lz1 + 0.6, '#9b968d');
      const floors = towerFloors[`${b.i},${b.j}`], W = b.lx1 - b.lx0 + 1.2, D = b.lz1 - b.lz0 + 1.2;
      const style = floors >= 55 ? 'office' : pick(['office', 'concrete']);
      const t = B.add({ x: cx, z: cz, w: W - 0.4, d: D - 0.4, floors, style, tint: TINT.office(), cell: 2.1, fh: 1.05, gh: 1.9,
        setbacks: [{ f: 6, n: 1 }, { f: Math.round(floors * 0.55), n: 2 }, { f: floors - 6, n: 3 }] });
      t.landmark = floors >= 55;
      city.towers.push(t);
      crowdsAroundBlock(city, b, 0.9, 0.4);
    } else if (kind === 'ballpark') {
      // Daygo ballpark: grandstands wrapped around home plate, diamond facing the outfield
      const x0 = b.lx0 - 0.6, x1 = b.lx1 + 0.6, z0 = b.lz0 - 0.6, z1 = b.lz1 + 0.6;
      city.paintGrass(g, x0, z0, x1, z1, '#4f7d33');
      for (let k = 0; k < 8; k++) g.rect(x0, z0 + k * (z1 - z0) / 8, x1, z0 + (k + 0.5) * (z1 - z0) / 8, 'rgba(255,255,255,.05)'); // mowing stripes
      const hx = x0 + 3.2, hz = z1 - 3.2; // home plate (near the camera side)
      const X = g.x, K = g.k;
      X.save(); X.translate(g.px(hx), g.px(hz));
      X.fillStyle = '#b98a5a'; X.beginPath(); X.arc(0, 0, 6.2 * K, -Math.PI / 2, 0); X.lineTo(0, 0); X.fill();      // infield dirt arc
      X.fillStyle = '#5a8a3a'; X.fillRect(0.9 * K, -4.1 * K, 3.2 * K, 3.2 * K);                                     // infield grass
      X.fillStyle = '#fff'; for (const [bx, bz] of [[0, 0], [4.3, 0], [4.3, -4.3], [0, -4.3]]) X.fillRect(bx * K - 3, bz * K - 3, 6, 6);
      X.strokeStyle = 'rgba(255,255,255,.85)'; X.lineWidth = 0.08 * K;
      X.beginPath(); X.moveTo(0, 0); X.lineTo(11 * K, 0); X.moveTo(0, 0); X.lineTo(0, -11 * K); X.stroke();          // foul lines
      X.fillStyle = '#b98a5a'; X.beginPath(); X.arc(2.15 * K, -2.15 * K, 0.5 * K, 0, 6.283); X.fill();               // mound
      X.restore();
      // stands: behind home and down both lines, low concrete sections (destructible like any building)
      const st = { style: 'concrete', cell: 1.8, gh: 1.2, fh: 1.0, storefront: false };
      B.add({ ...st, x: (x0 + x1) / 2 - 1, z: z1 - 1.1, w: x1 - x0 - 2, d: 2.2, floors: 2, tint: TINT.concrete() });
      B.add({ ...st, x: x0 + 1.1, z: (z0 + z1) / 2 - 1, w: 2.2, d: z1 - z0 - 4.4, floors: 4, tint: TINT.concrete() });
      B.add({ ...st, x: x1 - 1.0, z: z1 - 5.5, w: 2, d: 5, floors: 3, tint: TINT.concrete() });
      city.ballpark = { x0, x1, z0, z1, hx, hz };
      // players in position and fans on the concourse
      const pos = [[0, 0], [2.15, -2.15], [4.8, 0.3], [4.6, -3.6], [2.6, -4.9], [0.3, -4.8], [9, -1.5], [7.6, -7.6], [1.5, -9], [-0.4, 0.4]];
      for (const [px, pz] of pos) {
        (city.crowds ||= []).push({ x: hx + px, z: hz + pz, r: 0.2, n: 1 });
      }
      crowdsAroundBlock(city, b, 1, 0.8, 1.4);
    } else if (kind === 'parking') {
      const spots = city.paintParking(g, b.lx0 - 0.3, b.lz0 - 0.3, b.lx1 + 0.3, b.lz1 + 0.3);
      for (const s of spots) if (Math.random() < 0.72) city.parked.push(s);
      city.treesAlongBlock(b, 5.5, 'round', 0.8);
    } else {
      const d = Math.hypot(cx - 4, cz + 6);
      const hf = 3 + 13 * Math.exp(-((d / 42) ** 2));
      const W = b.lx1 - b.lx0 + 1.2, D = b.lz1 - b.lz0 + 1.2;
      g.rect(b.lx0 - 0.6, b.lz0 - 0.6, b.lx1 + 0.6, b.lz1 + 0.6, '#5c5955');
      const lx = b.lx0 - 0.6, lz = b.lz0 - 0.6;
      const r = Math.random();
      if (r < 0.14 && hf > 7) {
        // superblock: a broad podium with a slender tower rising out of it
        const floors = Math.round(rand(18, 30));
        const style = pick(['office', 'concrete']);
        B.add({ x: lx + W / 2, z: lz + D / 2, w: W - 0.3, d: D - 0.3, floors, style, tint: TINT[style](), cell: 1.7, fh: rand(0.95, 1.1), gh: 1.7,
          setbacks: [{ f: Math.round(rand(3, 6)), n: 2 }, { f: floors - Math.round(rand(3, 6)), n: 3 }] });
      } else {
        // irregular lots: skinny walk-ups next to wide mid-rises and the odd tall tower
        const xw = partition(W, pick([2, 3, 3, 4]), 2.8), zw = partition(D, pick([1, 2, 2, 3]), 3.2);
        let x = lx;
        for (const pw of xw) {
          let z = lz;
          for (const pd of zw) {
            const kind = Math.random();
            let floors = kind < 0.2 ? Math.round(rand(2, 4)) : kind > 0.9 ? Math.round(hf * rand(1.4, 2.0)) : Math.round(hf * rand(0.5, 1.3));
            floors = Math.max(2, Math.min(32, floors));
            const style = floors > 11 ? pick(['office', 'office', 'concrete']) : pick(['brick', 'brick', 'brick', 'concrete']);
            // not every building fills its lot; leaves small gaps, alleys and forecourts
            const shrinkW = Math.random() < 0.3 ? rand(0.3, 1.4) : 0, shrinkD = Math.random() < 0.3 ? rand(0.3, 1.4) : 0;
            const sb = floors > 12 ? [{ f: floors - Math.round(rand(3, 7)), n: 1 }] : floors > 7 && Math.random() < 0.3 ? [{ f: floors - 2, n: 1 }] : null;
            B.add({ x: x + pw / 2, z: z + pd / 2 + (Math.random() < 0.5 ? shrinkD / 2 : -shrinkD / 2), w: Math.max(2.4, pw - 0.3 - shrinkW), d: Math.max(2.4, pd - 0.3 - shrinkD),
              floors, style, tint: TINT[style](), cell: floors > 16 ? 1.8 : 1.6, fh: rand(0.92, 1.15), gh: rand(1.2, 1.6), setbacks: sb });
            z += pd;
          }
          x += pw;
        }
      }
      if (Math.random() < 0.45) city.treesAlongBlock(b, 6, 'round', 0.75);
      // the denser the core, the busier the sidewalks
      const busy = Math.min(1, hf / 12);
      crowdsAroundBlock(city, b, 0.35 + busy * 0.45, 0.12 + busy * 0.3);
    }
  }
  outskirts(ctx, 'city');
  return { ...ctx, agents: { cars: 60, peds: 400, wanderFrac: 0.1 }, fog: 0xc6cdd3, start: { x: 0, z: 8 }, water: { shore: -74, axis: 'x' }, xMin: -110 };
}

// ================= TROPICAL =================
export function tropical(B) {
  const XS = [-65, -39, -13, 13, 39, 65], ZS = [-13, 13, 39, 65];
  const ctx = makeCtx({ xs: XS, zs: ZS, roadW: 4.6, sw: 1.6, half: 66, extent: 112, centerLine: 'white', baseColor: '#8a8a6a' }, B);
  const { city, g } = ctx;
  const shore = -36;
  ctx.skipOuter = (x, z) => z < -13;
  // beach + shallow sea floor (painted over the extended road grid)
  g.rect(-112, -112, 112, -15.3, '#d9c7a0');
  g.grainRect(-112, -112, 112, -15.3, 0.35, 45);
  for (let i = 0; i < 1400; i++) g.circle(rand(-112, 112), rand(-40, -15.3), rand(0.1, 0.5), `rgba(${Math.random() < 0.5 ? '255,250,235' : '170,150,110'},.12)`);
  g.rect(-112, -112, 112, shore - 2, '#c9b58a');
  for (let x = -112; x < 112; x += 1.2) g.circle(x, shore + Math.sin(x * 0.2) * 0.8, 1.1, 'rgba(190,172,130,.5)');
  g.line(-112, -15.3, 112, -15.3, 0.4, '#bfb8a8');
  city.wanderZones.push({ x0: -60, x1: 60, z0: shore + 2, z1: -18 });
  crowdsIn(city, { x0: -58, x1: 58, z0: shore + 3, z1: -20 }, 14, 3, 7);
  for (let x = -62; x < 64; x += rand(4, 7)) city.addTree(x, rand(-19, -17), rand(0.9, 1.2), 'palm');
  for (let i = 0; i < 40; i++) {
    const x = rand(-58, 58), z = rand(shore + 4, -21);
    const col = hsl(Math.random(), 0.7, 0.55);
    city.addProp('umbrella', x, z, 0, 1); city.props[city.props.length - 1].color = col;
    city.addProp('towel', x + 0.4, z + 0.6, rand(-0.4, 0.4), 1); city.props[city.props.length - 1].color = hsl(Math.random(), 0.6, 0.6);
  }
  city.boats = [];
  for (let i = 0; i < 7; i++) {
    city.addProp('boat', rand(-80, 80), rand(-80, -45), rand(0, 6), rand(1, 1.6));
    const b = city.props[city.props.length - 1];
    b.y = 0.05; b.color = pick([hsl(0, 0, 0.95), hsl(0.58, 0.5, 0.45), hsl(0.02, 0.6, 0.5)]);
    b.speed = rand(0.8, 2.2); city.boats.push(b);
  }
  city.shore = shore;
  for (const b of city.blocks) {
    city.paintSidewalk(g, b, '#c8c0b0');
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    city.lampsAlongBlock(b, 9);
    city.treesAlongBlock(b, 7, 'palm', 0.75);
    crowdsAroundBlock(city, b, b.j === 0 ? 0.6 : 0.2, b.j === 0 ? 0.3 : 0.06);
    if (b.j === 0) {
      // beachfront: hotels + restaurants
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#bdb6a6');
      if (b.i === 2) {
        const spots = city.paintParking(g, b.lx0, b.lz0, b.lx1, b.lz1);
        for (const s of spots) if (Math.random() < 0.6) city.parked.push(s);
        continue;
      }
      const floors = Math.round(rand(5, 19)), hw = rand(8, 13), hd = rand(4.5, 7);
      B.add({ x: cx - 3.5, z: b.lz0 + hd / 2 + 0.4, w: hw, d: hd, floors, fh: rand(0.9, 1.1), style: 'stucco', tint: TINT.stucco(), cell: 1.6, gh: 1.5, setbacks: [{ f: floors - 3, n: 1 }] });
      g.rect(cx + 4.5, b.lz0 + 1, b.lx1 - 0.5, b.lz0 + 7, '#d8d2c4');
      g.rect(cx + 5.5, b.lz0 + 2, b.lx1 - 1.5, b.lz0 + 5.5, '#3fb6c8'); // pool
      g.rect(cx + 5.8, b.lz0 + 2.3, b.lx1 - 1.8, b.lz0 + 5.2, '#5fd2dc');
      for (let x = b.lx0 + 1; x < b.lx1 - 3; x += rand(4.5, 6.5)) {
        B.add({ x: x + 2, z: b.lz1 - 3, w: 4, d: 4.6, floors: Math.round(rand(1, 3)), style: 'stucco', tint: TINT.stucco(), cell: 1.5, gh: 1.3 });
      }
      city.addTree(cx + 4, b.lz0 + 8, 1, 'palm'); city.addTree(b.lx1 - 1, b.lz0 + 8, 1.1, 'palm');
    } else {
      city.paintGrass(g, b.lx0, b.lz0, b.lx1, b.lz1, '#6f8a45');
      for (const zz of [b.lz0 + 3, b.lz1 - 3]) for (let x = b.lx0 + 3; x < b.lx1 - 2; x += rand(5.5, 7)) {
        const shop = Math.random() < 0.3;
        B.add({ x, z: zz, w: rand(3.8, 4.8), d: rand(3.6, 4.4), floors: shop ? Math.round(rand(2, 4)) : Math.round(rand(1, 2)), style: 'stucco', tint: TINT.stucco(), cell: 1.5, gh: 1.2, fh: 0.95,
          gable: !shop && Math.random() < 0.6, roofTint: hsl(rand(0.02, 0.06), 0.55, rand(0.4, 0.5)) });
        if (Math.random() < 0.5) city.addTree(x + 2.8, zz + (zz < cz ? 2.5 : -2.5), rand(0.8, 1.1), Math.random() < 0.6 ? 'palm' : 'round');
      }
      if (Math.random() < 0.5) { g.rect(cx - 2, cz - 1.5, cx + 2, cz + 1.5, '#3fb6c8'); g.rect(cx - 1.7, cz - 1.2, cx + 1.7, cz + 1.2, '#63d3dd'); }
    }
  }
  outskirts(ctx, 'tropical');
  return { ...ctx, agents: { cars: 40, peds: 300, wanderFrac: 0.4 }, fog: 0xcfdde3, start: { x: 0, z: 0 }, water: { shore }, zMin: -40 };
}

// ================= SUBURBS =================
export function suburbs(B) {
  const P = [-66, -33, 0, 33, 66];
  const ctx = makeCtx({ xs: P, zs: P, roadW: 4.2, sw: 1.3, half: 66, extent: 112, centerLine: null, lights: false, noCrosswalks: false, baseColor: '#6a7a48' }, B);
  const { city, g } = ctx;
  for (const b of city.blocks) {
    city.paintSidewalk(g, b, '#b8b4aa');
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    city.lampsAlongBlock(b, 11);
    city.treesAlongBlock(b, 6.5, 'round', 1.0);
    const key = `${b.i},${b.j}`;
    if (key === '1,1') { // school
      city.paintGrass(g, b.lx0, b.lz0, b.lx1, b.lz1, '#6c8c44');
      B.add({ x: cx - 4, z: b.lz0 + 4, w: 18, d: 6, floors: 2, style: 'brick', tint: TINT.brick(), cell: 1.7, gh: 1.4, fh: 1.1 });
      B.add({ x: b.lx0 + 3.5, z: cz + 2, w: 5, d: 8, floors: 2, style: 'brick', tint: TINT.brick(), cell: 1.7, gh: 1.4, fh: 1.1 });
      // track + field
      g.x.save(); g.x.strokeStyle = '#b5553a'; g.x.lineWidth = 1.3 * g.k;
      g.x.beginPath(); g.x.ellipse(g.px(cx + 5), g.px(cz + 5), 6 * g.k, 3.6 * g.k, 0, 0, 6.283); g.x.stroke(); g.x.restore();
      g.x.save(); g.x.strokeStyle = 'rgba(255,255,255,.7)'; g.x.lineWidth = 0.06 * g.k;
      g.x.beginPath(); g.x.ellipse(g.px(cx + 5), g.px(cz + 5), 5.4 * g.k, 3 * g.k, 0, 0, 6.283); g.x.stroke(); g.x.restore();
      // playground
      g.rect(b.lx0 + 1, b.lz1 - 7, b.lx0 + 8, b.lz1 - 1, '#c9a574');
      city.addProp('swing', b.lx0 + 3, b.lz1 - 5, 0); city.addProp('slide', b.lx0 + 6, b.lz1 - 4.5, 0.4); city.addProp('swing', b.lx0 + 4, b.lz1 - 2.5, 0.2);
      city.wanderZones.push({ x0: b.lx0 + 1, x1: b.lx0 + 8, z0: b.lz1 - 7, z1: b.lz1 - 1 }, { x0: cx, x1: cx + 10, z0: cz + 2, z1: cz + 8 });
      crowdsIn(city, { x0: cx, x1: cx + 10, z0: cz + 2, z1: cz + 8 }, 3, 3, 6);
      crowdsIn(city, { x0: b.lx0 + 1, x1: b.lx0 + 8, z0: b.lz1 - 7, z1: b.lz1 - 1 }, 2, 3, 5);
      const spots = city.paintParking(g, cx + 3, b.lz0 + 0.5, b.lx1, b.lz0 + 5.2);
      for (const s of spots) if (Math.random() < 0.7) city.parked.push(s);
    } else if (key === '2,2') { // strip mall + gas station
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#5a5b5e');
      g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.2, 30);
      let x = b.lx0 + 0.3;
      for (const w of partition(b.lx1 - b.lx0 - 11, 4, 3)) {
        B.add({ x: x + w / 2, z: b.lz1 - 3, w: w - 0.2, d: 5.4, floors: 1, style: pick(['brick', 'stucco', 'concrete']), tint: TINT.brick(), cell: 1.6, gh: 1.5 });
        x += w;
      }
      const spots = city.paintParking(g, b.lx0 + 0.5, cz - 4, b.lx1 - 11.5, cz + 4);
      for (const s of spots) if (Math.random() < 0.55) city.parked.push(s);
      // gas station
      const gx = b.lx1 - 5.5, gz = b.lz0 + 5;
      city.addProp('canopy', gx, gz, 0); Object.assign(city.props[city.props.length - 1], { sx: 7, sy: 1, sz: 5, color: hsl(0.0, 0.7, 0.5) });
      for (const [dx, dz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) city.addProp('pillar', gx + dx, gz + dz, 0);
      for (const dx of [-1.6, 1.6]) city.addProp('pump', gx + dx, gz, 0);
      B.add({ x: gx, z: b.lz1 - 3, w: 7, d: 5, floors: 1, style: 'concrete', tint: TINT.concrete(), cell: 1.7, gh: 1.5 });
    } else {
      city.paintGrass(g, b.lx0, b.lz0, b.lx1, b.lz1);
      // two rows of houses facing the streets, driveways out to the curb
      for (const [zz, face] of [[b.lz0 + 4.2, -1], [b.lz1 - 4.2, 1]]) {
        for (let x = b.lx0 + 3.6; x < b.lx1 - 3; x += 6.8) {
          const big = Math.random() < 0.25, w = big ? rand(5, 5.8) : rand(3.6, 5), d = big ? rand(4.2, 4.8) : rand(3.2, 4.2);
          B.add({ x, z: zz, w, d, floors: big || Math.random() < 0.35 ? 2 : 1, style: 'house', tint: TINT.house(), cell: 1.5, fh: 0.95, gh: 1, gable: true, roofTint: pick(ROOF_TINTS) });
          const dx = x + w / 2 + 0.9, curb = face < 0 ? b.z0 : b.z1;
          g.rect(dx - 0.7, Math.min(zz, curb), dx + 0.7, Math.max(zz, curb), '#bdb8ad');
          g.line(x - 1.5, zz - face * (d / 2 + 0.2), x - 1.5, curb - face * 0.2, 0.35, '#c9c4b8'); // front path
          if (Math.random() < 0.6) city.parked.push({ x: dx, z: zz + face * (d / 2 + 1.2), rot: 0 });
          if (Math.random() < 0.5) city.addProp('hedge', x - w / 2 - 0.4, zz, Math.PI / 2, 1);
          if (Math.random() < 0.25) { const pz = zz - face * (d / 2 + 3); g.rect(x - 1.5, pz - 1, x + 1.5, pz + 1, '#48b6d2'); }
          city.addTree(x + rand(-1.5, 1.5), zz - face * rand(4.5, 6), rand(1, 1.4));
        }
      }
      city.wanderZones.push({ x0: b.lx0 + 1, x1: b.lx1 - 1, z0: cz - 2, z1: cz + 2 });
      // neighbours chatting on the sidewalk
      crowdsAroundBlock(city, b, 0.1, 0.03, 0.6);
    }
  }
  outskirts(ctx, 'houses');
  return { ...ctx, agents: { cars: 28, peds: 120, wanderFrac: 0.25 }, fog: 0xcdd6d8, start: { x: 0, z: 10 } };
}

export const MAPS = { downtown, tropical, suburbs };

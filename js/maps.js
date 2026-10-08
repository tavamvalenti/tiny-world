import { innOutLot, canesLot } from './chains.js';
import * as THREE from 'three';
import { rand, pick } from './core.js';
import { City, Ground } from './city.js';
import { petcoLayout, paintPetco } from './petco.js';
import { paintCourts } from './court.js';
import { buildHills } from './playa.js';
import { buildLandmarks } from './sandiego.js';

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
    if (kind === 'flats') {
      g.rect(x0 + s, z0 + s, x1 - s, z1 - s, '#5d6442');
      g.rect(x0, cz - 0.9, x1, cz + 0.9, '#595753');
      for (const [zz, dirIn] of [[z0 + s + 4, 1], [z1 - s - 4, -1]]) for (let x = x0 + s + 1.8; x < x1 - s - 1.5; x += rand(3.3, 3.9)) {
        if (Math.random() < 0.1) continue;
        const b = B.add({ x, z: zz, w: rand(2.8, 3.2), d: rand(5, 6), floors: Math.random() < 0.55 ? 2 : 3, style: 'flat', tint: chicagoBrick(), cell: 1.6, gh: 1.25, fh: 1 });
        b.noSigns = true; weather(b, Math.random() < 0.12);
      }
    } else if (kind === 'houses') {
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

// ================= POLICE HEADQUARTERS (every map) =================
// Station building set back on the block, a plaza and guard booth in front, a lot full of patrol cars, and guard
// posts; js/station.js dresses it and js/responders.js staffs it. Front faces +z (toward the default camera).
function policeHQ(ctx, b) {
  const { city, B, g } = ctx;
  const W = b.lx1 - b.lx0, D = b.lz1 - b.lz0, cx = (b.lx0 + b.lx1) / 2;
  g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#8f8c86'); g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.25, 40);
  const bw = Math.min(16, W * 0.7), bd = Math.min(8, D * 0.38), bz = b.lz0 + 0.6 + bd / 2;
  const hq = B.add({ x: cx, z: bz, w: bw, d: bd, floors: W > 20 ? 4 : 5, style: 'concrete', tint: hsl(0.6, 0.12, 0.74), cell: 1.5, gh: 1.5, fh: 1.05 });
  hq.noSigns = true;
  // front plaza and the lot in front of the doors
  const front = bz + bd / 2;
  g.rect(cx - 2.5, front, cx + 2.5, front + 2.2, '#b3aea4');
  const lot = { x0: b.lx0 + 0.6, x1: b.lx1 - 0.6, z0: front + 2.6, z1: b.lz1 - 0.8 };
  g.rect(lot.x0, lot.z0, lot.x1, lot.z1, '#4c4c4e');
  // a lot full of patrol cars: a row by the building and, if there's room, a second row facing it
  const cars = [], rows = lot.z1 - lot.z0 > 6 ? [lot.z0 + 1.1, lot.z1 - 1.1] : [lot.z0 + 1.1];
  rows.forEach((rz, k) => {
    for (let x = lot.x0 + 0.3; x < lot.x1 - 1.3; x += 1.45) {
      if (Math.abs(x + 0.72 - cx) < 2) continue;                // keep the drive clear
      g.rect(x - 0.03, rz - 1.1, x + 0.03, rz + 1.1, 'rgba(255,255,255,.6)');
      if (Math.random() < 0.85) cars.push({ x: x + 0.72, z: rz, rot: k ? Math.PI : 0, quiet: true });
    }
  });
  (city.stationed ||= []).push(...cars);
  const r = Math.max(W, D) / 2 + 6;
  const posts = [
    { x: cx - 1.2, z: front + 0.4, h: 0 }, { x: cx + 1.2, z: front + 0.4, h: 0 },          // either side of the doors
    { x: cx, z: b.lz1 - 0.4, h: 0 },                                                      // at the gate
    { x: b.lx0 + 0.4, z: b.lz1 - 0.4, h: -0.8 }, { x: b.lx1 - 0.4, z: b.lz1 - 0.4, h: 0.8 }, // lot corners
    { x: b.lx0 + 0.4, z: bz, h: -Math.PI / 2 }, { x: b.lx1 - 0.4, z: bz, h: Math.PI / 2 },   // the sides
    { x: cx - bw / 2 + 0.8, z: b.lz0 + 0.3, h: Math.PI }, { x: cx + bw / 2 - 0.8, z: b.lz0 + 0.3, h: Math.PI }, // round the back
    { x: cx - 3.5, z: b.lz1 - 0.4, h: 0 }, { x: cx + 3.5, z: b.lz1 - 0.4, h: 0 },          // a line along the front
    { x: cx - 2.4, z: front + 1.6, h: 0 }, { x: cx + 2.4, z: front + 1.6, h: 0 },          // the plaza
  ];
  city.policeHQ = { x: cx, z: (b.lz0 + b.lz1) / 2, r, bw, bd, bx: cx, bz, front, lot, gate: { x: cx, z: b.z1 }, block: b, posts, patrols: 6 };
  city.lampsAlongBlock(b, 6);
}

// ================= DOWNTOWN =================
export function downtown(B) {
  const P = [-66, -44, -22, 0, 22, 44, 66];
  const ctx = makeCtx({ xs: P, zs: P, roadW: 5, sw: 1.7, half: 66, extent: 112, centerLine: 'yellow' }, B);
  const { city, g } = ctx;
  // the real skyline: One America Plaza and Emerald Plaza on Broadway by the depot, the Grand Hyatt on the Marina (js/sandiego.js)
  const special = { '2,3': 'park', '0,4': 'hyatt', '0,5': 'hyatt', '4,1': 'parking', '3,2': 'plaza', '5,5': 'petco', '4,4': 'petco', '5,4': 'petco', '4,5': 'petco', '0,3': 'oneAmerica', '1,3': 'emerald', '5,1': 'innout', '2,5': 'innout', '0,1': 'innout' };
  const landmarkBlocks = {};
  const towerFloors = { '2,1': 60, '3,1': 50, '1,3': 44 };
  // light rail runs down the street at z = 0 (a trolley-only transit mall), with two stations
  // the harbour is the west edge: seawall at x = -74, open water beyond (see harbor.js)
  city.shoreX = -74;
  city.bridgeClear = [{ x: -45, z: 124, r: 22 }, { x: -62, z: 112, r: 16 }];
  ctx.skipOuter = (x, z) => x < -70;
  city.rail = { z: 0, stations: [{ x: 11, name: 'CIVIC CENTER' }, { x: -33, name: 'GASLAMP QUARTER' }] };
  city.towers = [];
  // Petco Park takes a 2x2 block site in the south-east; the streets through it are closed
  const site = { x0: P[4] + 2.5 + 1.7, x1: P[6] - 2.5 - 1.7, z0: P[4] + 2.5 + 1.7, z1: P[6] - 2.5 - 1.7 };
  {
    const outer = { x0: P[4] + 2.5, x1: P[6] - 2.5, z0: P[4] + 2.5, z1: P[6] - 2.5 };
    city.paintSidewalk(g, outer);
    paintPetco(g, site, city);
    city.lampsAlongBlock(outer, 8);
    for (let t = outer.x0 + 3; t < outer.x1 - 2; t += 5) { city.addTree(t, outer.z1 - 0.9, 0.9, 'palm'); city.addTree(t, outer.z0 + 0.9, 0.9, 'palm'); }
    for (let t = outer.z0 + 3; t < outer.z1 - 2; t += 5) { city.addTree(outer.x0 + 0.9, t, 0.9, 'palm'); city.addTree(outer.x1 - 0.9, t, 0.9, 'palm'); }
    const { H } = petcoLayout(site);
    city.westernMetal = B.add({ x: H.x + 3.8, z: H.z - 21.2, w: 5, d: 3.4, floors: 4, style: 'brick', tint: hsl(0.03, 0.5, 0.42), cell: 1.6, fh: 1.05, gh: 1.4 });
    city.westernMetal.noSigns = true; // keeps its own painted sign, no random shop/billboard signs
    city.petco = site;
    // (the players on the field are js/baseball.js now)
    crowdsAroundBlock(city, outer, 1, 0.9, 1.5);
    crowdsIn(city, { x0: site.x1 - 7, x1: site.x1 - 1.5, z0: site.z0 + 1.5, z1: site.z0 + 8 }, 5, 3, 7);
    city.closeArea(outer);
  }
  // the Grand Hyatt stretches over two blocks on the Marina; the street between them is closed
  {
    const outer = { x0: P[0] + 2.5, x1: P[1] - 2.5, z0: P[4] + 2.5, z1: P[6] - 2.5 };
    city.paintSidewalk(g, outer);
    city.lampsAlongBlock(outer, 7.5);
    landmarkBlocks.hyatt = { lx0: outer.x0 + 1.7, lx1: outer.x1 - 1.7, lz0: outer.z0 + 1.7, lz1: outer.z1 - 1.7 };
    crowdsAroundBlock(city, outer, 0.9, 0.45);
    city.closeArea(outer);
  }
  for (const b of city.blocks) {
    const kind = special[`${b.i},${b.j}`];
    if (kind === 'petco' || kind === 'hyatt') { b.closed = true; continue; }
    if (`${b.i},${b.j}` === '1,1') { city.paintSidewalk(g, b); policeHQ(ctx, b); continue; }
    city.paintSidewalk(g, b);
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    city.lampsAlongBlock(b, 7.5);
    city.addProp('hydrant', b.x0 + 0.5, b.z0 + 2.2); city.addProp('bin', b.x1 - 0.5, b.z1 - 2.6);
    city.addProp('sign', b.x0 + 0.4, b.z1 - 0.4, 0);
    if (kind === 'oneAmerica' || kind === 'emerald') { landmarkBlocks[kind] = b; crowdsAroundBlock(city, b, 0.9, 0.45); continue; }
    if (kind === 'innout') { innOutLot(ctx, b); crowdsAroundBlock(city, b, 0.4, 0.15); continue; }
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
      B.add({ x: cx, z: b.lz0 + 3, w: b.lx1 - b.lx0, d: 5.5, floors: 12, style: 'office', tint: TINT.office(), cell: 1.7, gh: 1.8, setbacks: [{ f: 14, n: 1 }] });
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
        const floors = Math.round(rand(10, 15));   // kept well under the landmark towers
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
            floors = Math.max(2, Math.min(17, floors));
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
  buildLandmarks(ctx, landmarkBlocks);
  outskirts(ctx, 'city');
  return { ...ctx, agents: { cars: 60, peds: 400, wanderFrac: 0.1 }, fog: 0xc6cdd3, start: { x: 0, z: 8 }, water: { shore: -74, axis: 'x' }, xMin: -110 };
}

// ================= TROPICAL: LA PLAYA =================
// Beach → resort city → local streets → the hills (js/playa.js builds the hillside, stairs and the Cristo).
const RESORT = () => hsl(rand(0.09, 0.12), rand(0.18, 0.3), rand(0.84, 0.9));
const COASTAL = () => Math.random() < 0.3 ? hsl(0.1, 0.2, rand(0.86, 0.93)) : hsl(pick([0.0, 0.03, 0.08, 0.12, 0.16, 0.33, 0.47, 0.55, 0.58, 0.92]), rand(0.45, 0.7), rand(0.58, 0.76));
const LOCAL = () => pick([() => hsl(rand(0.08, 0.12), rand(0.03, 0.12), rand(0.6, 0.78)), () => hsl(rand(0.03, 0.06), rand(0.35, 0.5), rand(0.5, 0.62)), COASTAL])();

function resortBlock(ctx, b) {
  const { city, B, g } = ctx, P = city.playa;
  const cx = (b.lx0 + b.lx1) / 2, W = b.lx1 - b.lx0, front = b.lz0;
  g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#e3dccb');
  const pool = (x0, z0, x1, z1) => { g.rect(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, '#efe9dc'); g.rect(x0, z0, x1, z1, '#2fa9bf'); g.rect(x0 + 0.25, z0 + 0.25, x1 - 0.25, z1 - 0.25, '#5fd2dc'); };
  const deckLoungers = (x0, x1, z) => { for (let x = x0; x < x1; x += 0.55) P.loungers.push({ x, z }); };
  const hotel = (o) => { const h = B.add({ style: 'stucco', tint: RESORT(), cell: 1.7, gh: 1.5, fh: 0.95, ...o }); h.noSigns = true; P.hotels.push(h); return h; };
  if (b.i === 1 || b.i === 4) {
    // a terraced resort: floors stepping down toward the sea, a long lagoon pool in front
    const tint = RESORT(), Wd = W - 3.5, steps = [12, 10, 8, 6, 4], back = b.lz1 - 1.4;
    steps.forEach((fl, k) => { const h = B.add({ x: cx + (b.i === 1 ? -1 : 1), z: back - 0.9 - k * 1.8, w: Wd, d: 1.8, floors: fl, style: 'stucco', tint, cell: 1.7, gh: 1.5, fh: 0.95 }); h.noSigns = true; if (!k) P.hotels.push(h); });
    pool(b.lx0 + 1.5, front + 1.2, cx - 1, front + 4.8); pool(cx + 0.5, front + 2, b.lx1 - 1.5, front + 5.2);
    deckLoungers(b.lx0 + 1.6, b.lx1 - 1.6, front + 0.6);
    for (let x = b.lx0 + 1; x < b.lx1; x += 3.2) city.addTree(x, front + 6.2, 1.05, 'palm');
  } else if (b.i === 2) {
    // twin towers on a podium
    hotel({ x: cx - 4.5, z: b.lz1 - 5, w: 5.2, d: 5.2, floors: 18 });
    hotel({ x: cx + 4.5, z: b.lz1 - 4.5, w: 5.2, d: 5.2, floors: 15 });
    const pod = B.add({ x: cx, z: b.lz1 - 1.6, w: W - 2, d: 2.6, floors: 2, style: 'stucco', tint: RESORT(), cell: 1.7, gh: 1.6, fh: 1 }); pod.noSigns = true;
    pool(cx - 7, front + 1.2, cx + 7, front + 5.5);
    deckLoungers(cx - 8, cx + 8, front + 0.6);
    for (let x = b.lx0 + 1; x < b.lx1; x += 3) city.addTree(x, front + 7, 1.05, 'palm');
  } else if (b.i === 3) {
    // the tall one, and a lower wing
    hotel({ x: cx - 3.5, z: b.lz1 - 4.2, w: 7.5, d: 5, floors: 20 });
    hotel({ x: cx + 5.5, z: b.lz1 - 3, w: 6, d: 4.5, floors: 9 });
    pool(b.lx0 + 1.5, front + 1.2, b.lx1 - 1.5, front + 4.5);
    deckLoungers(b.lx0 + 1.6, b.lx1 - 1.6, front + 0.6);
  } else {
    // west end: smaller family hotels and seafood restaurants, closer to the fishing beach
    for (const [dx, fl, w] of [[-6, 6, 6], [1, 4, 5], [7, 3, 5]]) hotel({ x: cx + dx, z: b.lz1 - 3.5, w, d: 5, floors: fl, cell: 1.6, gh: 1.35, fh: 0.95 });
    g.rect(b.lx0 + 1, front + 1, b.lx1 - 1, front + 5, '#cdb89a');
    for (let x = b.lx0 + 2; x < b.lx1 - 1; x += 2.6) P.palapas.push({ x, z: front + 3 });
  }
  // beach loungers and palapas across the road, in front of each resort
  if (b.i >= 1) {
    for (let x = b.lx0 + 1; x < b.lx1 - 1; x += 0.6) for (const z of [-21.5, -23.3]) if (Math.random() < 0.85) P.loungers.push({ x, z });
    for (let x = b.lx0 + 2; x < b.lx1 - 1; x += 3.4) P.palapas.push({ x, z: -25.5 });
  }
  crowdsAroundBlock(city, b, 0.7, 0.4);
}
// dense, colourful coastal streets: storefronts shoulder to shoulder, taco stands on the pavement
function townBlock(ctx, b) {
  const { city, B, g } = ctx, P = city.playa;
  g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#cfc4ae');
  for (const [zz, face] of [[b.lz0 + 3, -1], [b.lz1 - 3, 1]]) {
    for (let x = b.lx0 + 0.3; x < b.lx1 - 1.5;) {
      const w = rand(2.8, 4.2); if (x + w > b.lx1 - 0.2) break;
      const d = rand(4.5, 6);
      B.add({ x: x + w / 2, z: zz + face * (3 - d / 2), w, d, floors: pick([2, 2, 3, 3, 4, 5]), style: 'stucco', tint: COASTAL(), cell: 1.5, gh: 1.35, fh: 0.95 });
      x += w + rand(0.05, 0.3);
    }
  }
  for (let k = 0; k < 2; k++) P.food.push({ x: rand(b.lx0 + 3, b.lx1 - 3), z: b.z0 + 0.75, kind: Math.random() < 0.7 ? 'taco' : 'fruit' });
  if (Math.random() < 0.6) P.food.push({ x: rand(b.lx0 + 3, b.lx1 - 3), z: b.z1 - 0.75, kind: 'taco' });
  city.addTree(b.lx0 + 2, (b.lz0 + b.lz1) / 2, 1, 'palm'); city.addTree(b.lx1 - 2, (b.lz0 + b.lz1) / 2 + 1, 1, 'round');
  crowdsAroundBlock(city, b, 0.65, 0.45);
  city.wanderZones.push({ x0: b.lx0 + 1, x1: b.lx1 - 1, z0: b.z0 + 0.2, z1: b.z0 + 1.3 });
}
// the local streets below the hills: smaller, plainer houses packed in rows, corner shops, an OXXO or two
function localBlock(ctx, b) {
  const { city, B, g } = ctx, P = city.playa;
  g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#b9ae98');
  const oxxo = b.i === 1 || b.i === 3, gas = b.i === 0;
  const rows = [[b.lz0 + 2.2, 4.2], [(b.lz0 + b.lz1) / 2, 3.4], [b.lz1 - 2.2, 4.2]];
  rows.forEach(([zz, d], ri) => {
    for (let x = b.lx0 + 0.3; x < b.lx1 - 1.5;) {
      if (ri === 0 && (oxxo || gas) && x < b.lx0 + 6.5) { x = b.lx0 + 6.8; continue; }       // the corner lot
      const w = rand(2.2, 3.3); if (x + w > b.lx1 - 0.2) break;
      const r = Math.random(), style = ri === 2 ? (r < 0.55 ? 'brick' : 'concrete') : r < 0.35 ? 'brick' : r < 0.65 ? 'concrete' : 'stucco';
      B.add({ x: x + w / 2, z: zz, w, d: d - rand(0, 0.8), floors: pick([1, 2, 2, 2, 3]), style, tint: style === 'stucco' ? COASTAL() : style === 'brick' ? hsl(rand(0.03, 0.06), rand(0.4, 0.55), rand(0.45, 0.58)) : LOCAL(), cell: 1.4, gh: 1.2, fh: 0.9, storefront: ri === 0 && Math.random() < 0.5 });
      x += w + (Math.random() < 0.15 ? rand(0.6, 1.4) : rand(0.05, 0.2));
    }
  });
  if (oxxo || gas) {
    const w = 5.4, d = 3.6, x = b.lx0 + 3.2, z = gas ? b.lz0 + 5.6 : b.lz0 + d / 2 + 0.2;
    const o = B.add({ x, z, w, d, floors: 1, style: 'stucco', tint: hsl(0.1, 0.08, 0.9), cell: 1.8, gh: 1.8, fh: 1 });
    o.noSigns = true;
    P.oxxo.push({ x, z: z - d / 2, w, h: 1.8, gas });
    if (gas) g.rect(x - 2.6, b.lz0, x + 2.6, z - d / 2, '#7f7c77');
  }
  P.food.push({ x: rand(b.lx0 + 8, b.lx1 - 3), z: b.z0 + 0.75, kind: pick(['taco', 'taco', 'fruit']) });
  crowdsAroundBlock(city, b, 0.5, 0.3);
}

export function tropical(B) {
  const XS = [-65, -39, -13, 13, 39, 65], ZS = [-13, 13, 39, 65];
  const ctx = makeCtx({ xs: XS, zs: ZS, roadW: 4.6, sw: 1.6, half: 66, extent: 112, centerLine: 'white', baseColor: '#4f6a36', noSouthExtend: true, extendRoads: false }, B);
  const { city, g } = ctx;
  const shore = -36;
  city.playa = { oxxo: [], food: [], loungers: [], palapas: [], piers: [{ x: -2, z0: -34.5, z1: -47 }, { x: 50, z0: -34.5, z1: -45 }], hotels: [] };
  ctx.skipOuter = (x, z) => z < -13 || z > 60;
  // beach + shallow sea floor (painted over the extended road grid)
  g.rect(-112, -112, 112, -15.3, '#d9c7a0');
  g.grainRect(-112, -112, 112, -15.3, 0.35, 45);
  for (let i = 0; i < 1400; i++) g.circle(rand(-112, 112), rand(-40, -15.3), rand(0.1, 0.5), `rgba(${Math.random() < 0.5 ? '255,250,235' : '170,150,110'},.12)`);
  g.rect(-112, -112, 112, shore - 2, '#c9b58a');
  for (let x = -112; x < 112; x += 1.2) g.circle(x, shore + Math.sin(x * 0.2) * 0.8, 1.1, 'rgba(190,172,130,.5)');
  g.line(-112, -15.3, 112, -15.3, 0.4, '#bfb8a8');
  g.rect(-112, -17.2, 112, -15.3, '#e6d6b0');                                     // the malecón
  city.wanderZones.push({ x0: -60, x1: 60, z0: shore + 2, z1: -18 }, { x0: -60, x1: 60, z0: -17, z1: -15.6 });
  crowdsIn(city, { x0: -58, x1: 58, z0: shore + 3, z1: -20 }, 16, 3, 7);
  crowdsIn(city, { x0: -58, x1: 58, z0: -17, z1: -15.8 }, 10, 2, 5);
  for (let x = -62; x < 64; x += rand(4, 7)) city.addTree(x, rand(-19, -17.6), rand(0.9, 1.2), 'palm');
  for (let i = 0; i < 26; i++) {
    const x = rand(-58, 58), z = rand(shore + 4, -27);
    const col = hsl(Math.random(), 0.7, 0.55);
    city.addProp('umbrella', x, z, 0, 1); city.props[city.props.length - 1].color = col;
    city.addProp('towel', x + 0.4, z + 0.6, rand(-0.4, 0.4), 1); city.props[city.props.length - 1].color = hsl(Math.random(), 0.6, 0.6);
  }
  city.boats = [];
  for (let i = 0; i < 7; i++) {
    city.addProp('boat', rand(-40, 80), rand(-80, -50), rand(0, 6), rand(1, 1.6));
    const b = city.props[city.props.length - 1];
    b.y = 0.05; b.color = pick([hsl(0, 0, 0.95), hsl(0.58, 0.5, 0.45), hsl(0.02, 0.6, 0.5)]);
    b.speed = rand(0.8, 2.2); city.boats.push(b);
  }
  city.shore = shore;
  for (const b of city.blocks) {
    city.paintSidewalk(g, b, '#c8c0b0');
    if (b.i === 3 && b.j === 1) { policeHQ(ctx, b); continue; }            // La Playa's police headquarters
    city.lampsAlongBlock(b, 9);
    city.treesAlongBlock(b, 7, 'palm', b.j === 0 ? 0.85 : 0.55);
    if (b.j === 0) resortBlock(ctx, b);
    else if (b.j === 1) townBlock(ctx, b);
    else localBlock(ctx, b);
  }
  // below the hill the streets go to dirt: the last street and the ends of the cross streets, fading in from asphalt
  const dirt = '#6c4c39', dirt2 = '#5b3f2f';                        // the same earth as the foot of the hill
  for (let k = 0; k < 6000; k++) { const x = rand(-112, 112), z = rand(45, 57); const onRoad = XS.some((v) => Math.abs(x - v) < 3.9) || Math.abs(x) > 66; if (onRoad && Math.random() < ((z - 45) / 12) ** 1.5) g.circle(x + rand(-0.2, 0.2), z, rand(0.08, 0.45), pick(['rgba(108,76,57,.85)', 'rgba(94,66,49,.8)', 'rgba(124,92,70,.7)'])); }
  for (const v of [...XS, -91, 91]) { g.rect(v - 3.9, 56, v + 3.9, 68.5, dirt); g.grainRect(v - 3.9, 56, v + 3.9, 68.5, 0.5, 40); for (const o of [-1, 1]) g.rect(v + o * 1.1 - 0.25, 56, v + o * 1.1 + 0.25, 68.5, dirt2); }
  g.rect(-112, 61.5, 112, 68.5, dirt); g.grainRect(-112, 61.5, 112, 68.5, 0.55, 50);
  for (const o of [-1.1, 1.1]) g.rect(-112, 65 + o - 0.25, 112, 65 + o + 0.25, dirt2);          // tyre ruts
  for (let k = 0; k < 160; k++) g.circle(rand(-112, 112), rand(61.5, 68.5), rand(0.2, 0.9), Math.random() < 0.5 ? 'rgba(52,36,26,.35)' : 'rgba(150,118,92,.3)');
  // taco and fruit stands at the foot of the stairs, where the hill meets the street
  for (const x of [-58, -10, 16, 42]) city.playa.food.push({ x: x + 3, z: 68.2, kind: pick(['taco', 'fruit']) });
  buildHills(ctx);
  // beyond the town it's all countryside: green scrub and trees either side, the roads simply end
  for (const [x0, x1] of [[-112, -67.6], [67.6, 112]]) {
    g.rect(x0, -15.3, x1, 70, '#4f6a36'); g.grainRect(x0, -15.3, x1, 70, 0.5, 60);
    for (let k = 0; k < 600; k++) g.circle(rand(x0, x1), rand(-15, 70), rand(0.3, 2.2), pick(['rgba(62,86,40,.5)', 'rgba(96,110,58,.35)', 'rgba(96,76,54,.3)', 'rgba(44,66,32,.45)']));
    for (let k = 0; k < 110; k++) city.addTree(rand(x0 + 1, x1 - 1), rand(-12, 64), rand(0.9, 1.6), Math.random() < 0.4 ? 'palm' : 'round');
  }
  return { ...ctx, agents: { cars: 52, peds: 340, wanderFrac: 0.35 }, fog: 0xcfdde3, start: { x: 0, z: 4 }, water: { shore }, zMin: -40, zMax: 112, yaw: Math.PI + 0.28 };
}

// ================= CHICAGO =================
// A dense, run-down Chicago neighbourhood: brick two- and three-flats shoulder to shoulder with
// stoops and chain-link, rear alleys lined with garages and dumpsters, vacant lots, boarded and
// fire-scarred buildings, corner stores, potholed streets.
const chicagoBrick = () => {
  const r = Math.random();
  if (r < 0.4) return hsl(rand(0.02, 0.05), rand(0.35, 0.5), rand(0.42, 0.54));   // red-brown
  if (r < 0.7) return hsl(rand(0.09, 0.11), rand(0.3, 0.45), rand(0.64, 0.74));   // yellow "Chicago common"
  if (r < 0.9) return hsl(rand(0.04, 0.07), rand(0.3, 0.4), rand(0.4, 0.47));   // dark brown
  return hsl(0.1, 0.05, rand(0.62, 0.72));                                       // painted grey
};
// age a building: grimy/cracked cells, the odd boarded window; abandoned ones are boarded up and fire-scarred
function weather(b, abandoned = false) {
  const scorched = abandoned && Math.random() < 0.5, fireFloor = Math.floor(rand(0, b.floors));
  for (const c of b.cells) {
    if (abandoned) {
      c.dmg = rand(0.15, 0.45);
      if (Math.random() < 0.65 && c.style !== 'garage') c.style = 'boarded';
      c.burn = scorched && c.f >= fireFloor ? rand(0.45, 0.95) : rand(0, 0.12);
    } else {
      c.dmg = rand(0, 0.16);
      if (Math.random() < 0.04 && c.style === 'flat') c.style = 'boarded';
      if (Math.random() < 0.08) c.burn = rand(0.1, 0.3);
    }
  }
  return b;
}
function junk(city, x, z) {
  city.addProp('junk', x, z, rand(0, 6.28), rand(0.6, 1.4));
  city.props[city.props.length - 1].color = hsl(rand(0.05, 0.6), rand(0, 0.12), rand(0.25, 0.5));
}

// One side of a block: walk-ups facing the street, back yards, garages on the alley.
function flatsRow(ctx, b, face, alleyW, opts = {}) {
  const { city, B, g } = ctx;
  const dirIn = -face, street = face < 0 ? b.lz0 : b.lz1, cz = (b.lz0 + b.lz1) / 2;
  const alleyEdge = cz - dirIn * alleyW / 2;
  const lots = [];
  for (let x = b.lx0; x < b.lx1 - 0.5;) {
    let w = rand(3.1, 3.9);
    if (b.lx1 - x - w < 2.8) w = b.lx1 - x;
    lots.push([x, w]); x += w;
  }
  lots.forEach(([x0, w], li) => {
    const lx = x0 + w / 2, corner = li === 0 || li === lots.length - 1;
    const zr = (a, c) => [Math.min(street + dirIn * a, street + dirIn * c), Math.max(street + dirIn * a, street + dirIn * c)];
    // corner store: brick, flush to the sidewalk, storefront signs
    if (corner && Math.random() < (opts.stores ?? 0.45)) {
      const d = rand(6.5, 8);
      weather(B.add({ x: lx, z: street + dirIn * (0.1 + d / 2), w: w - 0.1, d, floors: Math.random() < 0.5 ? 2 : 3, style: 'brick', tint: chicagoBrick(), cell: 1.3, gh: 1.35, fh: 1 }), Math.random() < 0.15);
      const [za, zb] = zr(d + 0.1, Math.abs(alleyEdge - street));
      g.rect(x0, za, x0 + w, zb, '#5f5e5a');
      city.addProp('dumpster', lx, alleyEdge - dirIn * 0.5, 0);
      (city.crowds ||= []).push({ x: lx, z: street - dirIn * 0.7, r: 0.6, n: Math.round(rand(2, 5)) });
      return;
    }
    if (Math.random() < 0.14) {
      // vacant lot: weeds, dirt, junk, chain-link along the sidewalk, sometimes a burned-out shell
      const [za, zb] = zr(0, Math.abs(alleyEdge - street));
      g.rect(x0, za, x0 + w, zb, '#6e7446');
      for (let k = 0; k < 5; k++) g.circle(rand(x0, x0 + w), rand(za, zb), rand(0.4, 1.2), 'rgba(122,104,80,.8)');
      g.grainRect(x0, za, x0 + w, zb, 0.35, 50);
      for (let k = 0; k < 4; k++) junk(city, rand(x0 + 0.4, x0 + w - 0.4), rand(za + 1, zb - 1));
      for (let fx = x0 + 0.5; fx < x0 + w; fx += 1) city.addProp('chainlink', fx, street + dirIn * 0.15, 0);
      if (Math.random() < 0.35) {
        const d = rand(4.5, 6);
        const shell = B.add({ x: lx, z: street + dirIn * (1.4 + d / 2), w: w - 0.5, d, floors: 2, style: 'boarded', tint: chicagoBrick(), cell: 1.25, gh: 1.25, fh: 1 });
        shell.noSigns = true;
        for (const c of shell.cells) { c.dmg = rand(0.35, 0.7); c.burn = rand(0.7, 1); }
      }
      return;
    }
    // the walk-up
    const fy = rand(1.1, 1.5), d = rand(5.4, 6.8), bw = w - rand(0.3, 0.6), floors = Math.random() < 0.55 ? 2 : 3;
    const [ya, yb] = zr(0, fy);
    g.rect(x0, ya, x0 + w, yb, Math.random() < 0.6 ? '#6c7a45' : '#7b7456');              // scrappy front yard
    const bz = street + dirIn * (fy + d / 2);
    const fl = weather(B.add({ x: lx, z: bz, w: bw, d, floors, style: 'flat', tint: chicagoBrick(), cell: 1.25, gh: 1.25, fh: 1 }), Math.random() < (opts.abandoned ?? 0.15));
    fl.noSigns = true;
    const sx = lx + rand(-0.4, 0.4);
    city.addProp('stoop', sx, street + dirIn * fy, dirIn > 0 ? Math.PI : 0);
    g.rect(sx - 0.35, ya, sx + 0.35, yb, '#aaa59b');                                          // front walk
    if (Math.random() < 0.55) for (let fx = x0 + 0.5; fx < x0 + w; fx += 1) if (Math.abs(fx - sx) > 0.6) city.addProp(Math.random() < 0.85 ? 'chainlink' : 'woodfence', fx, street + dirIn * 0.15, 0);
    // back yard: dirt and patchy grass out to the alley, a fence down the lot line
    const rear = street + dirIn * (fy + d);
    const [ra, rb] = [Math.min(rear, alleyEdge), Math.max(rear, alleyEdge)];
    g.rect(x0, ra, x0 + w, rb, Math.random() < 0.5 ? '#66703f' : '#77694f');
    g.grainRect(x0, ra, x0 + w, rb, 0.3, 45);
    const fenceType = Math.random() < 0.5 ? 'woodfence' : 'chainlink';
    if (li > 0) for (let fz = ra + 0.5; fz < rb; fz += 1) city.addProp(fenceType, x0, fz, Math.PI / 2);
    if (Math.random() < 0.62) {
      const gw = Math.min(bw, rand(2.6, 3));
      const ga = B.add({ x: lx + rand(-0.2, 0.2), z: alleyEdge - dirIn * 1.25, w: gw, d: 2.4, floors: 1, style: 'garage', tint: chicagoBrick().lerp(new THREE.Color(0.6, 0.58, 0.55), 0.4), cell: 1.5, gh: 1.15 });
      ga.noSigns = true; weather(ga, Math.random() < 0.1);
      if (Math.random() < 0.4) city.addProp('bin', lx + gw / 2 + 0.25, alleyEdge - dirIn * 0.3, 0);
    } else {
      g.rect(lx - 1.2, Math.min(alleyEdge, alleyEdge - dirIn * 2.6), lx + 1.2, Math.max(alleyEdge, alleyEdge - dirIn * 2.6), '#6b6863');
      if (Math.random() < 0.5) city.parked.push({ x: lx, z: alleyEdge - dirIn * 1.3, rot: 0 });
      else if (Math.random() < 0.5) junk(city, lx, alleyEdge - dirIn * 1.5);
      for (let fx = x0 + 0.5; fx < x0 + w; fx += 1) if (Math.abs(fx - lx) > 1.3) city.addProp('chainlink', fx, alleyEdge - dirIn * 0.1, 0);
    }
  });
}

function paintAlley(ctx, b, alleyW) {
  const { city, g } = ctx, cz = (b.lz0 + b.lz1) / 2;
  g.rect(b.x0, cz - alleyW / 2, b.x1, cz + alleyW / 2, '#595753');
  g.grainRect(b.x0, cz - alleyW / 2, b.x1, cz + alleyW / 2, 0.35, 50);
  for (let k = 0; k < 6; k++) { const x = rand(b.lx0, b.lx1); g.line(x, cz - alleyW / 2, x + rand(-1, 1), cz + alleyW / 2, 0.04, 'rgba(30,28,26,.6)'); }
  for (let x = b.lx0 + rand(2, 6); x < b.lx1 - 1; x += rand(7, 12)) city.addProp('dumpster', x, cz + pick([-1, 1]) * (alleyW / 2 - 0.35), 0);
  city.wanderZones.push({ x0: b.lx0 + 1, x1: b.lx1 - 1, z0: cz - 0.5, z1: cz + 0.5 });
}

// potholes, patches and cracks all over the streets
function paintPotholes(ctx) {
  const { city, g } = ctx, hw = city.roadW / 2 - 0.3, X = g.x;
  const spots = [];
  for (const z of city.zs) for (let i = 0; i < 26; i++) spots.push([rand(city.xs[0], city.xs[city.xs.length - 1]), z + rand(-hw, hw)]);
  for (const x of city.xs) for (let i = 0; i < 26; i++) spots.push([x + rand(-hw, hw), rand(city.zs[0], city.zs[city.zs.length - 1])]);
  for (const [x, z] of spots) {
    const r = Math.random();
    if (r < 0.4) {
      const rx = rand(0.18, 0.5), rz = rand(0.15, 0.4), a = rand(0, 3);
      X.fillStyle = '#6a6863'; X.beginPath(); X.ellipse(g.px(x), g.px(z), (rx + 0.06) * g.k, (rz + 0.06) * g.k, a, 0, 6.283); X.fill();
      X.fillStyle = '#262523'; X.beginPath(); X.ellipse(g.px(x), g.px(z), rx * g.k, rz * g.k, a, 0, 6.283); X.fill();
    } else if (r < 0.7) {
      X.save(); X.translate(g.px(x), g.px(z)); X.rotate(rand(-0.1, 0.1));
      X.fillStyle = pick(['#333331', '#3b3a38', '#2d2d2c']); X.fillRect(-rand(0.6, 1.4) * g.k, -rand(0.4, 1) * g.k, rand(1.2, 2.8) * g.k, rand(0.8, 2) * g.k);
      X.restore();
    } else {
      X.strokeStyle = 'rgba(28,27,25,.7)'; X.lineWidth = 0.05 * g.k; X.beginPath(); X.moveTo(g.px(x), g.px(z));
      let px = x, pz = z;
      for (let k = 0; k < 6; k++) { px += rand(-0.6, 0.6); pz += rand(-0.6, 0.6); X.lineTo(g.px(px), g.px(pz)); }
      X.stroke();
    }
  }
}

// ---- faction blocks: the row facing the border street is a corner store, two walk-ups and two open hangout
// lots with garages on the alley; the back row stays an ordinary Chicago row ----
function gangRow(ctx, b, side, alleyW) {
  const { city, B, g } = ctx;
  const face = side === 'blue' ? 1 : -1;                      // blue's front row faces north (z1), red's faces south (z0)
  const dirIn = -face, street = face < 0 ? b.lz0 : b.lz1, cz = (b.lz0 + b.lz1) / 2, alleyEdge = cz - dirIn * alleyW / 2;
  const zr = (a, c) => [Math.min(street + dirIn * a, street + dirIn * c), Math.max(street + dirIn * a, street + dirIn * c)];
  const depth = Math.abs(alleyEdge - street);
  const plan = side === 'blue' ? [['store', 5], ['lot', 6.6], ['flat', 3.6], ['flat', 3.6], ['lot', 6.2]] : [['lot', 6.2], ['flat', 3.6], ['flat', 3.6], ['lot', 6.6], ['store', 5]];
  const out = { lots: [], stores: [], street, dirIn, alleyEdge };
  let x = b.lx0 + 0.3;
  for (const [kind, w] of plan) {
    const lx = x + w / 2;
    if (kind === 'store') {
      const d = 7, z = street + dirIn * (0.1 + d / 2);
      const st = B.add({ x: lx, z, w: w - 0.1, d, floors: 2, style: 'brick', tint: chicagoBrick(), cell: 1.3, gh: 1.35, fh: 1 });
      st.noSigns = true; weather(st);
      const [a, c] = zr(d + 0.2, depth); g.rect(x, a, x + w, c, '#555553');
      out.stores.push({ x: lx, z, w: w - 0.1, d });
    } else if (kind === 'flat') {
      const fy = 1.2, d = rand(5.6, 6.4), [ya, yb] = zr(0, fy);
      g.rect(x, ya, x + w, yb, '#6c7446');
      const fl = weather(B.add({ x: lx, z: street + dirIn * (fy + d / 2), w: w - 0.35, d, floors: 3, style: 'flat', tint: chicagoBrick(), cell: 1.25, gh: 1.25, fh: 1 }));
      fl.noSigns = true;
      city.addProp('stoop', lx, street + dirIn * fy, dirIn > 0 ? Math.PI : 0);
      const [ra, rb] = zr(fy + d, depth); g.rect(x, ra, x + w, rb, '#77694f');
    } else {
      const [a, c] = zr(0, depth);
      g.rect(x, a, x + w, c, '#58564f'); g.grainRect(x, a, x + w, c, 0.4, 50);
      for (let k = 0; k < 4; k++) g.circle(rand(x, x + w), rand(a, c), rand(0.4, 1), 'rgba(110,92,70,.6)');
      const ga = B.add({ x: lx, z: alleyEdge - dirIn * 1.3, w: Math.min(w - 0.6, 4.2), d: 2.5, floors: 1, style: 'garage', tint: chicagoBrick().lerp(new THREE.Color(0.6, 0.58, 0.55), 0.4), cell: 1.5, gh: 1.2 });
      ga.noSigns = true; weather(ga);
      city.parked.push({ x: x + 1.2, z: street + dirIn * depth * 0.62, rot: 0 });
      out.lots.push({ x0: x, x1: x + w, cx: lx, cz: street + dirIn * depth * 0.38, garageZ: alleyEdge - dirIn * 2.6 });
    }
    x += w + 0.1;
  }
  return out;
}

export function suburbs(B) {
  const P = [-66, -33, 0, 33, 66];
  const ctx = makeCtx({ xs: P, zs: P, roadW: 4.2, sw: 1.3, half: 66, extent: 112, centerLine: null, lights: false, noCrosswalks: false, baseColor: '#5d6442' }, B);
  const { city, g } = ctx;
  const alleyW = 1.8;
  // Summer Smash takes the 2x2 site north-west of the start (blocks 0..1 x 2..3); streets through it close
  const outer = { x0: P[0] + 2.1, x1: P[2] - 2.1, z0: P[2] + 2.1, z1: P[4] - 2.1 };
  const site = { x0: outer.x0 + 1.3, x1: outer.x1 - 1.3, z0: outer.z0 + 1.3, z1: outer.z1 - 1.3 };
  {
    city.crowds ||= [];
    city.paintSidewalk(g, outer, '#aaa59b');
    g.rect(site.x0, site.z0, site.x1, site.z1, '#56693a');                    // trampled field
    for (let k = 0; k < 40; k++) g.circle(rand(site.x0, site.x1), rand(site.z0 + 14, site.z1 - 10), rand(0.8, 3), 'rgba(110,92,64,.55)');
    g.grainRect(site.x0, site.z0, site.x1, site.z1, 0.35, 50);
    g.rect(site.x0, site.z0, site.x1, site.z0 + 15.5, '#3b3b3a');              // backstage + pit asphalt
    g.rect(site.x0, site.z1 - 10, site.x1, site.z1, '#8e8a82');                // gate plaza
    g.grainRect(site.x0, site.z1 - 10, site.x1, site.z1, 0.3, 40);
    city.lampsAlongBlock(outer, 7);
    city.closeArea(outer);
    city.concert = site;
    const cx = (site.x0 + site.x1) / 2;
    city.hotspot = { x: cx, z: (site.z0 + site.z1) / 2, r: 60 };
    // lines at the gate, groups on every side walk, police posted around the venue
    for (let x = cx - 4; x <= cx + 4; x += 1.4) city.crowds.push({ x, z: outer.z1 + 1.2 + rand(0, 1.5), r: 0.5, n: Math.round(rand(3, 5)) });
    for (let x = outer.x0 + 3; x < outer.x1 - 2; x += 3.5) city.crowds.push({ x, z: outer.z1 - 0.6, r: 0.5, n: Math.round(rand(2, 5)) });
    for (let z = outer.z0 + 3; z < outer.z1 - 2; z += 3.5) city.crowds.push({ x: outer.x1 - 0.6, z, r: 0.5, n: Math.round(rand(2, 4)) });
    crowdsIn(city, { x0: site.x0 + 2, x1: site.x1 - 2, z0: site.z1 - 9, z1: site.z1 - 1.5 }, 14, 4, 8);
    city.stationed = [{ x: cx - 8, z: site.z1 - 1.8, rot: Math.PI / 2 }, { x: cx + 8, z: site.z1 - 1.8, rot: -Math.PI / 2 }, { x: site.x1 - 3, z: site.z0 + 3, rot: 0 }];
    for (const s of city.stationed) city.crowds.push({ x: s.x + 1.3, z: s.z - 0.6, r: 0.5, n: 2, uniform: 0x1d2a44 });
  }
  for (const b of city.blocks) {
    if (b.i <= 1 && b.j >= 2) { b.closed = true; continue; }
    if (b.i === 2 && b.j === 3) { city.paintSidewalk(g, b, '#aaa59b'); policeHQ(ctx, b); continue; }   // Chicago PD, next to the festival
    if (b.i === 0 && b.j === 1) { // streetball courts behind a tall chain-link fence, festival parking below
      city.paintSidewalk(g, b, '#aaa59b');
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#4f4f4e');
      const court = { x0: b.lx0 + 0.4, x1: b.lx1 - 0.4, z0: b.lz0 + 0.5, z1: b.lz0 + 10.5 };
      city.court = court;
      paintCourts(g, court);
      const spots = city.paintParking(g, b.lx0 + 0.5, court.z1 + 1.2, b.lx1 - 0.5, b.lz1 - 0.5);
      for (const sp of spots) if (Math.random() < 0.9) city.parked.push(sp);
      crowdsIn(city, { x0: b.lx0 + 1, x1: b.lx1 - 1, z0: court.z1 + 1.5, z1: b.lz1 - 1 }, 5, 3, 6);
      // spectators: on the benches along the south fence, and hanging on the fence from the sidewalk
      for (let x = court.x0 + 1.2; x < court.x1 - 1; x += 2.2) city.crowds.push({ x: x + rand(-0.3, 0.3), z: court.z1 - 0.9, r: 0.45, n: Math.round(rand(2, 4)) });
      for (let x = court.x0 + 2; x < court.x1 - 1; x += 3.5) if (Math.random() < 0.7) city.crowds.push({ x, z: court.z1 + 0.7, r: 0.4, n: Math.round(rand(2, 3)) });
      for (let z = court.z0 + 1.5; z < court.z1 - 1; z += 3) city.crowds.push({ x: b.x0 + 0.65, z, r: 0.4, n: 2 });
      const st = { x: b.lx1 - 2, z: b.lz1 - 1.5, rot: 0 };
      city.stationed.push(st, { x: b.lx0 + 2, z: b.lz1 - 1.5, rot: 0 });
      city.crowds.push({ x: st.x - 1.3, z: st.z - 0.8, r: 0.5, n: 2, uniform: 0x1d2a44 });
      city.lampsAlongBlock(b, 11);
      continue;
    }
    city.paintSidewalk(g, b, '#aaa59b');
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    city.lampsAlongBlock(b, 11);
    city.treesAlongBlock(b, 8.5, 'round', 0.95);
    const key = `${b.i},${b.j}`;
    if (key === '3,0' || key === '3,1') { // faction territory: Blue Line (south block) vs. Red Row (north block), border = the street between
      const side = key === '3,0' ? 'blue' : 'red';
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#646b43');
      paintAlley(ctx, b, alleyW);
      const gs = (city.gangs ||= { zones: {} });
      gs[side] = gangRow(ctx, b, side, alleyW);
      flatsRow(ctx, b, side === 'blue' ? -1 : 1, alleyW, { stores: 0.3, abandoned: 0.25 });
      gs.zones[side] = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
      (city.noPeds ||= []).push({ x0: b.x0 - 0.2, x1: b.x1 + 0.2, z0: b.z0 - 0.2, z1: b.z1 + 0.2 });
      continue;
    }
    if (key === '1,1') { // public school: three-storey brick, asphalt schoolyard, a small field
      city.school = { x0: b.lx0, x1: b.lx1, z0: b.lz0, z1: b.lz1 };       // named in the news (js/news.js)
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#5e5d59'); g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.25, 40);
      B.add({ x: cx - 4, z: b.lz0 + 4, w: 18, d: 6, floors: 3, style: 'brick', tint: chicagoBrick(), cell: 1.7, gh: 1.4, fh: 1.1 });
      B.add({ x: b.lx0 + 3.5, z: cz + 2, w: 5, d: 8, floors: 3, style: 'brick', tint: chicagoBrick(), cell: 1.7, gh: 1.4, fh: 1.1 });
      city.paintGrass(g, cx - 1.5, cz + 0.5, cx + 11.5, cz + 9.5, '#667a3e');
      (city.lawns ||= []).push({ x0: cx - 1, x1: cx + 11, z0: cz + 1, z1: cz + 9, name: 'school field' });   // mowed by the groundskeeper (js/pets.js)
      g.x.save(); g.x.strokeStyle = '#a4553d'; g.x.lineWidth = 1.2 * g.k;
      g.x.beginPath(); g.x.ellipse(g.px(cx + 5), g.px(cz + 5), 5.6 * g.k, 3.4 * g.k, 0, 0, 6.283); g.x.stroke(); g.x.restore();
      for (let fx = b.lx0 + 0.5; fx < b.lx1; fx += 1) { city.addProp('chainlink', fx, b.lz1 - 0.15, 0); city.addProp('chainlink', fx, b.lz0 + 0.15, 0); }
      g.rect(b.lx0 + 1, b.lz1 - 7, b.lx0 + 8, b.lz1 - 1, '#8a7a62');
      city.addProp('swing', b.lx0 + 3, b.lz1 - 5, 0); city.addProp('slide', b.lx0 + 6, b.lz1 - 4.5, 0.4); city.addProp('swing', b.lx0 + 4, b.lz1 - 2.5, 0.2);
      city.wanderZones.push({ x0: b.lx0 + 1, x1: b.lx0 + 8, z0: b.lz1 - 7, z1: b.lz1 - 1 }, { x0: cx, x1: cx + 10, z0: cz + 2, z1: cz + 8 });
      crowdsIn(city, { x0: cx, x1: cx + 10, z0: cz + 2, z1: cz + 8 }, 3, 3, 6);
      crowdsIn(city, { x0: b.lx0 + 1, x1: b.lx0 + 8, z0: b.lz1 - 7, z1: b.lz1 - 1 }, 2, 3, 5);
      const spots = city.paintParking(g, cx + 3, b.lz0 + 0.5, b.lx1, b.lz0 + 5.2);
      for (const s of spots) if (Math.random() < 0.5) city.parked.push(s);
    } else if (key === '2,2') { // commercial strip: two-storey brick storefronts, a gas station, a cracked lot
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#555553'); g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.3, 40);
      let x = b.lx0 + 0.2;
      for (const w of partition(b.lx1 - b.lx0 - 11, 5, 3)) {
        weather(B.add({ x: x + w / 2, z: b.lz1 - 3.2, w: w - 0.1, d: 6, floors: 2, style: 'brick', tint: chicagoBrick(), cell: 1.4, gh: 1.5, fh: 1 }), Math.random() < 0.25);
        x += w;
      }
      const spots = city.paintParking(g, b.lx0 + 0.5, cz - 4, b.lx1 - 11.5, cz + 4);
      for (const s of spots) if (Math.random() < 0.4) city.parked.push(s);
      for (let k = 0; k < 5; k++) junk(city, rand(b.lx0 + 1, b.lx1 - 12), rand(cz - 4, cz + 4));
      const gx = b.lx1 - 5.5, gz = b.lz0 + 5;
      city.addProp('canopy', gx, gz, 0); Object.assign(city.props[city.props.length - 1], { sx: 7, sy: 1, sz: 5, color: hsl(0.0, 0.7, 0.5) });
      for (const [dx, dz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) city.addProp('pillar', gx + dx, gz + dz, 0);
      for (const dx of [-1.6, 1.6]) city.addProp('pump', gx + dx, gz, 0);
      B.add({ x: gx, z: b.lz1 - 3, w: 7, d: 5, floors: 1, style: 'concrete', tint: TINT.concrete(), cell: 1.7, gh: 1.5 });
      crowdsAroundBlock(city, b, 0.6, 0.15);
    } else if (key === '2,1') { // U-shaped courtyard apartment building facing the north street, flats behind
      paintAlley(ctx, b, alleyW);
      const z0 = b.lz0 + 1.2, D = cz - alleyW / 2 - 1.5 - z0, W = b.lx1 - b.lx0 - 3, tint = chicagoBrick();
      g.rect(b.lx0, b.lz0, b.lx1, cz - alleyW / 2, '#5f5e5a');
      city.paintGrass(g, cx - W / 2 + 5, z0, cx + W / 2 - 5, z0 + D - 4.5, '#667a3e');
      (city.lawns ||= []).push({ x0: cx - W / 2 + 5.5, x1: cx + W / 2 - 5.5, z0: z0 + 0.5, z1: z0 + D - 5, name: 'courtyard' });
      g.rect(cx - 0.5, b.lz0, cx + 0.5, z0 + D - 4.5, '#aaa59b');
      const abandoned = Math.random() < 0.3;
      for (const o of [{ x: cx - W / 2 + 2.5, z: z0 + D / 2, w: 5, d: D }, { x: cx + W / 2 - 2.5, z: z0 + D / 2, w: 5, d: D }, { x: cx, z: z0 + D - 2.25, w: W - 10, d: 4.5 }]) {
        const a = B.add({ ...o, floors: 3, style: 'flat', tint, cell: 1.25, gh: 1.25, fh: 1 });
        a.noSigns = true; weather(a, abandoned);
      }
      for (const x of [cx - 3, cx + 3]) city.addTree(x, z0 + 2, 1.1);
      for (let fx = b.lx0 + 0.5; fx < b.lx1; fx += 1) if (Math.abs(fx - cx) > 0.7) city.addProp('chainlink', fx, b.lz0 + 0.15, 0);
      crowdsIn(city, { x0: cx - 3, x1: cx + 3, z0: z0, z1: z0 + 4 }, 2, 2, 5);
      flatsRow(ctx, b, 1, alleyW);
    } else {
      g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#646b43');
      paintAlley(ctx, b, alleyW);
      flatsRow(ctx, b, -1, alleyW);
      if (key === '0,0' || key === '2,0' || key === '3,3') canesLot(ctx, b, alleyW);       // a Raising Cane's on the corner
      else flatsRow(ctx, b, 1, alleyW);
      crowdsAroundBlock(city, b, 0.35, 0.05, 0.8);
    }
  }
  paintPotholes(ctx);
  if (city.gangs) {
    const zb = city.gangs.zones.blue, zred = city.gangs.zones.red, bz = (zb.z1 + zred.z0) / 2;
    city.gangs.border = { z: bz, x0: zb.x0, x1: zb.x1 };   // the street itself is left unmarked: flags say whose side is whose
    const blocked = (x, z) => city.pedBlocked(x, z);
    city.crowds = city.crowds.filter((c) => !blocked(c.x, c.z));
    city.wanderZones = city.wanderZones.filter((w) => !blocked((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2));
  }
  outskirts(ctx, 'flats');
  return { ...ctx, agents: { cars: 46, peds: 240, wanderFrac: 0.25 }, fog: 0xc9cfcf, start: { x: -33, z: 30 } };
}

export const MAPS = { downtown, tropical, suburbs };

// SAN DIEGO beyond the Gaslamp: the rest of the bay, built into the same map (one city graph, one set of systems).
//   Barrio Logan  south of downtown along the bay: run-down, low and loud; murals, lowriders, auto shops, tiendas
//   Chicano Park  under the Coronado Bridge's Barrio Logan approach: murals on every pillar, crowds, the kiosko
//   Coronado      across the bay: Naval Air Station North Island (runways, hangars, carriers, jets, sailors only),
//                 the village (Orange Avenue, cottages and Spanish revival houses, the golf course on Glorietta
//                 Bay), the Hotel del Coronado on Central Beach, the Coronado Shores towers, the Silver Strand
//   Naval Base San Diego  south of the bridge on the mainland: Gate 7, piers full of warships, sailors only
// This file lays it all out on the ground (a second ground patch, js/city.js Ground with an offset) and fills
// the blocks; js/sdbay.js builds what stands and moves on it (the bridge, ships, jets, the hotel's roofs...).
import * as THREE from 'three';
import { rand, pick } from './core.js';
import { Ground } from './city.js';
import { hsl, partition, crowdsAroundBlock, crowdsIn, weather, junk } from './maps.js';
import { sdShoreX, CORONADO, inPoly, onCoronado, NAS_FENCE, NBSD, WORLD, BRIDGE, BRIDGE_ENDS, CHICANO, VILLAGE, HOTEL, isLand } from './sdgeo.js';

const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-6; v += s) o.push(v); return o; };
export const SD_XS = range(-264, 88, 22), SD_ZS = range(-66, 198, 22);
const CORE = (x, z) => Math.abs(x) <= 66 && Math.abs(z) <= 66;
const onIsle = (x, z, m = 6) => onCoronado(x, z) && onCoronado(x - m, z) && onCoronado(x + m, z) && onCoronado(x, z - m) && onCoronado(x, z + m);
// which street corners exist (the grid is one big 22-unit grid; everything off the land is dropped)
export function sdLive(x, z) {
  if (CORE(x, z)) return true;
  if (x === 22 && z === 110) return false;                                                       // Chicano Park: the bridge ramps took that corner
  if (z >= 66 && z <= 176 && x >= -66 && x <= 88 && x > sdShoreX(z) + 3) return true;            // Barrio Logan (and East Village's south edge)
  if (x >= VILLAGE.x0 && x <= VILLAGE.x1 && z >= VILLAGE.z0 && z <= VILLAGE.z1 && onIsle(x, z) && !(x === VILLAGE.x0 && z >= 176)) return true;   // Coronado village
  return false;
}
// the old z = 110 street under the bridge ramps is gone (the ramps and the park are there)
export function sdSkipEdge(a, b) {
  return a.z === 110 && b.z === 110 && Math.min(a.x, b.x) >= 0 && Math.max(a.x, b.x) <= 44;
}

// ---------- palettes ----------
const BARRIO = () => Math.random() < 0.3 ? hsl(rand(0.08, 0.12), rand(0.08, 0.2), rand(0.66, 0.8))
  : hsl(pick([0.0, 0.04, 0.09, 0.13, 0.33, 0.5, 0.58, 0.8, 0.95]), rand(0.3, 0.55), rand(0.5, 0.68));   // faded pastels, sun-bleached
const COTTAGE = () => Math.random() < 0.55 ? hsl(rand(0.1, 0.14), rand(0.05, 0.2), rand(0.88, 0.95)) : hsl(pick([0.08, 0.12, 0.55, 0.58, 0.32, 0.02]), rand(0.15, 0.35), rand(0.74, 0.86));
const TILE = () => hsl(rand(0.02, 0.05), rand(0.5, 0.65), rand(0.42, 0.52));                      // Spanish tile roofs
const SHINGLE = () => hsl(rand(0.06, 0.6), rand(0.0, 0.1), rand(0.32, 0.5));
const NAVYGREY = () => hsl(0.58, rand(0.02, 0.06), rand(0.62, 0.72));

// The extension: returns what the map adds (second ground, patches, water mask, bounds). extBlocks: the blocks of the
// big grid outside the Gaslamp core.
export function sdExtension(ctx, extBlocks) {
  const { city, B } = ctx;
  const E = (WORLD.x1 - WORLD.x0) / 2, g = new Ground(E, 4096, (WORLD.x0 + WORLD.x1) / 2, (WORLD.z0 + WORLD.z1) / 2);
  const X = g.x;
  const sd = (city.sd = { murals: [], lowriders: [], military: [], hangars: [], piers: [], ships: [], jets: [], vehicles: [], umbrellas: [], fences: [], gates: [], towers: [], containers: [], cranes: [] });
  city.named ||= []; city.crowds ||= [];
  const name = (S, x0, x1, z0, z1, o) => city.named.push({ S, o: o || `the ${S}`, x0, x1, z0, z1 });

  // ---------- land and water ----------
  const W = WORLD, seabed = '#1d3846';
  g.rect(W.x0, W.z0, W.x1, W.z1, seabed); g.grainRect(W.x0, W.z0, W.x1, W.z1, 0.25, 60);
  const isle = () => { X.beginPath(); CORONADO.forEach(([a, b], i) => (i ? X.lineTo(g.px(a), g.pz(b)) : X.moveTo(g.px(a), g.pz(b)))); X.closePath(); };
  // the island, its ocean beach (sand worn into the land side of the coast), then the sea put back outside it
  isle(); X.fillStyle = '#7b7f66'; X.fill();
  const OCEAN = CORONADO.slice(CORONADO.findIndex(([a, b]) => a === -112 && b === 320), CORONADO.findIndex(([a, b]) => a === -256 && b === -56) + 1);
  const strokeAlong = (pts, w, style) => { X.save(); X.strokeStyle = style; X.lineWidth = w * g.k; X.lineJoin = X.lineCap = 'round'; X.beginPath(); pts.forEach(([a, b], i) => (i ? X.lineTo(g.px(a), g.pz(b)) : X.moveTo(g.px(a), g.pz(b)))); X.stroke(); X.restore(); };
  strokeAlong(OCEAN, 20, '#e0cfa6');
  for (let k = 0; k < 2200; k++) { const [a, b] = pick(OCEAN); g.circle(a + rand(-12, 12), b + rand(-12, 12), rand(0.1, 0.5), `rgba(${Math.random() < 0.5 ? '255,250,235' : '160,140,100'},.14)`); }
  X.save(); X.beginPath(); X.rect(0, 0, g.res, g.res); CORONADO.forEach(([a, b], i) => (i ? X.lineTo(g.px(a), g.pz(b)) : X.moveTo(g.px(a), g.pz(b)))); X.closePath();
  X.clip('evenodd'); X.fillStyle = seabed; X.fillRect(0, 0, g.res, g.res);
  strokeAlong(OCEAN, 16, '#3c7480'); strokeAlong(OCEAN, 7, '#77a39a'); X.restore();             // the shallows off the beach
  // the mainland, east of the shore
  const mainland = [[W.x1 + 5, W.z0 - 5]]; for (let z = W.z0 - 5; z <= W.z1 + 5; z += 2) mainland.push([sdShoreX(z), z]); mainland.push([W.x1 + 5, W.z1 + 5]);
  g.poly(mainland, '#6d6962'); g.grainRect(W.x0, 66, W.x1, W.z1, 0.3, 50);
  strokeAlong(mainland.slice(1, -1), 1.4, '#8d877c');                                             // rip-rap and seawall
  X.save(); isle(); X.clip(); strokeAlong(CORONADO.slice(0, 17), 1.2, '#8d877c'); X.restore();   // the island's bay side

  // ---------- streets (only where the graph has them, outside the Gaslamp core) ----------
  const hw = city.roadW / 2, asphalt = '#4a4b4d', worn = '#525250';
  const extEdges = [...city.edges.values()].filter((e) => { const A = city.nodes[e.a], Bn = city.nodes[e.b]; return !e.bridge && !(CORE(A.x, A.z) && CORE(Bn.x, Bn.z)); });
  for (const e of extEdges) {
    const A = city.nodes[e.a], Bn = city.nodes[e.b], v = A.x === Bn.x, barrio = !onCoronado(A.x, A.z);
    const col = barrio ? worn : asphalt;
    if (v) g.rect(A.x - hw, Math.min(A.z, Bn.z) - hw, A.x + hw, Math.max(A.z, Bn.z) + hw, col);
    else g.rect(Math.min(A.x, Bn.x) - hw, A.z - hw, Math.max(A.x, Bn.x) + hw, A.z + hw, col);
  }
  for (const e of extEdges) {
    const A = city.nodes[e.a], Bn = city.nodes[e.b], v = A.x === Bn.x;
    const a = (v ? Math.min(A.z, Bn.z) : Math.min(A.x, Bn.x)) + hw + 2, b = (v ? Math.max(A.z, Bn.z) : Math.max(A.x, Bn.x)) - hw - 2;
    const yel = 'rgba(226,186,60,.85)';
    for (const o of [-0.08, 0.08]) v ? g.line(A.x + o, a, A.x + o, b, 0.07, yel) : g.line(a, A.z + o, b, A.z + o, 0.07, yel);
    // crosswalks at both ends (the Barrio's are half worn away)
    for (const [P, s] of [[A, 1], [Bn, -1]]) {
      const c0 = (v ? P.z : P.x) + (P === A ? 1 : -1) * Math.sign(v ? Bn.z - A.z : Bn.x - A.x) * (hw + 0.2);
      if (!P.lit && Math.random() < 0.5) continue;
      for (let t = -hw + 0.3; t < hw - 0.3; t += 0.55) {
        const al = onCoronado(P.x, P.z) ? '.82' : String(rand(0.25, 0.6).toFixed(2));
        if (v) g.rect(P.x + t, Math.min(c0, c0 + Math.sign(Bn.z - A.z) * s * 1.4), P.x + t + 0.3, Math.max(c0, c0 + Math.sign(Bn.z - A.z) * s * 1.4), `rgba(236,236,230,${al})`);
        else g.rect(Math.min(c0, c0 + Math.sign(Bn.x - A.x) * s * 1.4), P.z + t, Math.max(c0, c0 + Math.sign(Bn.x - A.x) * s * 1.4), P.z + t + 0.3, `rgba(236,236,230,${al})`);
      }
    }
  }

  // ---------- blocks ----------
  const live = (b) => [[b.x0 - hw, b.z0 - hw], [b.x1 + hw, b.z0 - hw], [b.x0 - hw, b.z1 + hw], [b.x1 + hw, b.z1 + hw]].every(([x, z]) => sdLive(Math.round(x), Math.round(z)));
  const chicano = { x0: CHICANO.x0 + hw, x1: CHICANO.x1 - hw, z0: CHICANO.z0 + hw - 2, z1: CHICANO.z1 - hw };
  for (const b of extBlocks) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (cx > CHICANO.x0 && cx < CHICANO.x1 && cz > CHICANO.z0 && cz < CHICANO.z1) { b.closed = true; continue; }      // the park, below
    if (!live(b)) { b.closed = true; city.closeArea(b); continue; }
    if (onCoronado(cx, cz)) villageBlock(ctx, g, b); else barrioBlock(ctx, g, b);
  }
  // the band of blocks between the old outskirts and the Barrio grid's east edge (x 88..110): auto yards and flats
  for (let z = 70; z < 180; z += 22) {
    g.rect(90.5, z, W.x1, z + 17, '#66625b'); g.grainRect(90.5, z, W.x1, z + 17, 0.35, 50);
    for (let x = 92; x < W.x1 - 3; x += rand(4.5, 6.5)) {
      const b2 = B.add({ x: x + 2, z: z + rand(5, 11), w: rand(3.4, 4.6), d: rand(5, 8), floors: Math.random() < 0.7 ? 1 : 2, style: pick(['garage', 'stucco', 'flat']), tint: BARRIO(), cell: 1.7, gh: 1.3, fh: 1 });
      b2.noSigns = true; weather(b2, Math.random() < 0.25);
    }
  }
  waterfront(ctx, g);
  chicanoPark(ctx, g, chicano);
  name('Barrio Logan', -66, 88, 70, 180, 'Barrio Logan');
  name('Chicano Park', chicano.x0, chicano.x1, chicano.z0, chicano.z1, 'Chicano Park');
  hotelDel(ctx, g);
  coronadoBeach(ctx, g);
  northIsland(ctx, g);
  navalBase(ctx, g);
  silverStrand(ctx, g);
  name('Coronado Island', -290, -136, 96, 250, 'Coronado');
  name('Orange Avenue', -201, -195, 110, 214, 'Orange Avenue');

  // where people can't go: the bay and the ocean (beach shallows are fine), the bases' inner areas are for crowds only
  city.deepWater = (x, z) => !isLand(x, z) && !(x > -74.5 && z < 70) && !sd.piers.some((p) => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) && !(onCoronado(x + 4, z) || onCoronado(x - 4, z) || onCoronado(x, z + 4) || onCoronado(x, z - 4));
  city.isLand = isLand;
  city.inBounds = (x, z) => x > W.x0 + 2 && x < W.x1 - 2 && z > W.z0 + 2 && z < W.z1 - 2;
  city.noBackdrop = (x, z) => x < sdShoreX(z) + 6 || (x > W.x0 - 14 && x < W.x1 + 14 && z > W.z0 - 14 && z < W.z1 + 14);
  g.tex.needsUpdate = true;
  return { g2: g };
}

// ---------- Barrio Logan ----------
function barrioBlock(ctx, g, b) {
  const { city, B } = ctx;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, sd = city.sd;
  city.paintSidewalk(g, b, '#a19b90');
  // the sidewalk is cracked and patched
  for (let k = 0; k < 18; k++) g.line(rand(b.x0, b.x1), rand(b.z0, b.z1), rand(b.x0, b.x1), rand(b.z0, b.z1), 0.03, 'rgba(40,36,30,.35)');
  g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#6b665c'); g.grainRect(b.lx0, b.lz0, b.lx1, b.lz1, 0.4, 50);
  if (Math.random() < 0.6) city.lampsAlongBlock(b, 12);
  if (Math.random() < 0.5) city.treesAlongBlock(b, 9, Math.random() < 0.6 ? 'palm' : 'round', 0.75);
  const industrial = cx < sdShoreX(cz) + 30;                                       // shipyards and warehouses along the water
  const r = Math.random();
  if (industrial) {
    // warehouses, a scrap yard, shipyard sheds: big boxes, chain-link, junk
    const W = b.lx1 - b.lx0, D = b.lz1 - b.lz0;
    for (const [w, ox] of [[W * 0.55, -W * 0.22], [W * 0.38, W * 0.3]]) {
      const wh = B.add({ x: cx + ox, z: cz + rand(-1, 1), w: w - 0.6, d: D * rand(0.6, 0.85), floors: Math.random() < 0.6 ? 2 : 3, style: Math.random() < 0.5 ? 'concrete' : 'brick', tint: hsl(rand(0.05, 0.6), rand(0.03, 0.12), rand(0.48, 0.66)), cell: 2.2, gh: 1.8, fh: 1.4 });
      wh.noSigns = true; weather(wh, Math.random() < 0.15);
      sd.murals.push({ b: wh, side: pick(['n', 's', 'e', 'w']) });
    }
    for (let x = b.lx0 + 0.5; x < b.lx1; x += 1) city.addProp('chainlink', x, b.lz1 - 0.15, 0);
    for (let k = 0; k < 6; k++) junk(city, rand(b.lx0 + 1, b.lx1 - 1), rand(b.lz1 - 4, b.lz1 - 1));
    crowdsAroundBlock(city, b, 0.3, 0.05, 0.8);
  } else if (r < 0.22) {
    // a corner tienda / taqueria / auto shop strip, with a lot
    let x = b.lx0 + 0.2;
    for (const w of partition(b.lx1 - b.lx0 - 0.4, 4, 3)) {
      const shop = B.add({ x: x + w / 2, z: b.lz0 + 3.4, w: w - 0.15, d: 6.4, floors: Math.random() < 0.7 ? 1 : 2, style: Math.random() < 0.65 ? 'stucco' : 'brick', tint: BARRIO(), cell: 1.4, gh: 1.6, fh: 1.05 });
      weather(shop, Math.random() < 0.15);
      if (Math.random() < 0.4) sd.murals.push({ b: shop, side: 'n' });
      x += w;
    }
    const spots = city.paintParking(g, b.lx0 + 0.5, cz + 1, b.lx1 - 0.5, b.lz1 - 0.5);
    for (const s of spots) if (Math.random() < 0.55) { city.parked.push(s); if (Math.random() < 0.25) sd.lowriders.push(s); }
    for (let k = 0; k < 4; k++) junk(city, rand(b.lx0 + 1, b.lx1 - 1), rand(cz + 1, b.lz1 - 1));
    crowdsAroundBlock(city, b, 0.8, 0.45, 1.2);
    city.crowds.push({ x: b.lx0 + 1.2, z: b.lz0 - 0.4, n: 4, look: 'cholo', r: 0.7, tag: 'gang' });                  // the corner crew
  } else {
    // little stucco houses and bungalows, chain-link front yards, cars on the dirt, the odd boarded-up one
    for (const face of [-1, 1]) {
      const street = face < 0 ? b.lz0 : b.lz1, dirIn = -face;
      for (let x = b.lx0 + 0.3; x < b.lx1 - 2.6;) {
        const w = Math.min(rand(3.4, 4.4), b.lx1 - x - 0.2);
        if (w < 2.6) break;
        const fy = rand(1.4, 2.4), d = rand(3.8, 5.2), lx = x + w / 2;
        const za = Math.min(street, street + dirIn * fy), zb = Math.max(street, street + dirIn * fy);
        g.rect(x, za, x + w, zb, pick(['#7a7152', '#6c7445', '#80745a', '#8a8070']));     // dirt and dead grass
        if (Math.random() < 0.12) {
          for (let k = 0; k < 3; k++) junk(city, rand(x + 0.4, x + w - 0.4), street + dirIn * rand(1, 5));
        } else {
          const h = B.add({ x: lx, z: street + dirIn * (fy + d / 2), w: w - rand(0.4, 0.9), d, floors: Math.random() < 0.82 ? 1 : 2, style: Math.random() < 0.75 ? 'stucco' : 'flat', tint: BARRIO(), cell: 1.3, gh: 1.25, fh: 1,
            gable: Math.random() < 0.35, roofTint: SHINGLE() });
          h.noSigns = true; weather(h, Math.random() < 0.14);
          if (Math.random() < 0.18) sd.murals.push({ b: h, side: face < 0 ? 'n' : 's' });
        }
        if (Math.random() < 0.6) for (let fx = x + 0.5; fx < x + w; fx += 1) city.addProp('chainlink', fx, street + dirIn * 0.15, 0);
        if (Math.random() < 0.4) { const s = { x: lx + rand(-0.6, 0.6), z: street + dirIn * fy * 0.5, rot: Math.PI / 2 }; city.parked.push(s); if (Math.random() < 0.3) sd.lowriders.push(s); }
        x += w + 0.1;
      }
    }
    crowdsAroundBlock(city, b, 0.45, 0.12, 0.9);
    if (Math.random() < 0.35) city.crowds.push({ x: pick([b.lx0, b.lx1]) + rand(-0.4, 0.4), z: pick([b.lz0, b.lz1]), n: Math.round(rand(3, 6)), look: 'cholo', r: 0.8, tag: 'gang' });
    if (Math.random() < 0.25) city.crowds.push({ x: rand(b.lx0, b.lx1), z: b.lz0 - 0.5, n: 1, look: 'homeless', r: 0.3 });
  }
  // potholes and patches on the streets around it
  for (let k = 0; k < 14; k++) {
    const onX = Math.random() < 0.5, x = onX ? rand(b.x0, b.x1) : pick([b.x0 - 2.5, b.x1 + 2.5]) + rand(-1.8, 1.8), z = onX ? pick([b.z0 - 2.5, b.z1 + 2.5]) + rand(-1.8, 1.8) : rand(b.z0, b.z1);
    if (Math.random() < 0.5) { g.circle(x, z, rand(0.22, 0.45), '#6a6863'); g.circle(x, z, rand(0.15, 0.32), '#242322'); }
    else g.rect(x - rand(0.5, 1.2), z - rand(0.3, 0.8), x + rand(0.5, 1.2), z + rand(0.3, 0.8), pick(['#333331', '#3b3a38']));
  }
}

// the Barrio's waterfront between the shore and the street grid: shipyard sheds, container stacks, scrap, cranes
function waterfront(ctx, g) {
  const { city, B } = ctx, sd = city.sd;
  const westOf = (z) => { let m = 99; for (const n of city.nodes) if (!n.dead && n.z >= 66 && Math.abs(n.z - z) <= 11.01) m = Math.min(m, n.x); return m === 99 ? 88 : m; };
  for (let z = 70; z < 186; z += 2) {
    const xa = sdShoreX(z) + 1.2, xb = (z > 178 ? 110 : westOf(z) - 2.8);
    if (xb - xa < 2) continue;
    g.rect(xa, z, xb, z + 2, '#77736b');
  }
  g.grainRect(-80, 70, 110, 186, 0.25, 40);
  for (let z = 72; z < 184; z += rand(7, 10)) {
    const xa = sdShoreX(z) + 2, xb = (z > 178 ? 104 : westOf(z) - 4);
    for (let x = xa; x < xb - 5; x += rand(7, 11)) {
      const r = Math.random();
      if (r < 0.45) { const b = B.add({ x: x + 3, z: z + 2.5, w: rand(5, 8), d: rand(4, 6), floors: Math.random() < 0.5 ? 2 : 3, style: Math.random() < 0.5 ? 'garage' : 'concrete', tint: hsl(rand(0.05, 0.6), rand(0.04, 0.14), rand(0.5, 0.68)), cell: 2.2, gh: 1.8, fh: 1.4 }); b.noSigns = true; weather(b, Math.random() < 0.2); if (Math.random() < 0.3) sd.murals.push({ b, side: pick(['e', 's']) }); }
      else if (r < 0.8) sd.containers.push({ x: x + 3, z: z + 2.5, n: Math.floor(rand(2, 7)) });
      else for (let k = 0; k < 4; k++) junk(city, x + rand(0, 6), z + rand(0, 5));
    }
  }
  for (const z of [92, 128, 160]) sd.cranes.push({ x: sdShoreX(z) + 3, z });
  city.named.push({ S: 'The Barrio Logan shipyards', o: 'the Barrio Logan shipyards', x0: -80, x1: -20, z0: 70, z1: 186 });
}

// ---------- Chicano Park ----------
function chicanoPark(ctx, g, r) {
  const { city } = ctx;
  city.paintSidewalk(g, { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, '#a8a296');
  const lx0 = r.x0 + 1.5, lx1 = r.x1 - 1.5, lz0 = r.z0 + 1.5, lz1 = r.z1 - 1.5;
  g.rect(lx0, lz0, lx1, lz1, '#8e887c'); g.grainRect(lx0, lz0, lx1, lz1, 0.3, 40);
  // lawns between the paths, a red-brick walk through the middle, the kiosko's plaza
  for (const [a, b, c, d] of [[lx0 + 1, lz0 + 1, lx0 + 15, lz1 - 1], [lx1 - 15, lz0 + 1, lx1 - 1, lz1 - 1]]) city.paintGrass(g, a, b, c, d, '#5e7a3c');
  g.rect(lx0, (lz0 + lz1) / 2 - 1, lx1, (lz0 + lz1) / 2 + 1, '#9a5a44');
  for (let x = lx0; x < lx1; x += 0.6) g.line(x, (lz0 + lz1) / 2 - 1, x, (lz0 + lz1) / 2 + 1, 0.03, 'rgba(0,0,0,.18)');
  const kx = (lx0 + lx1) / 2, kz = (lz0 + lz1) / 2;
  g.circle(kx, kz, 4.2, '#b9b2a4'); g.circle(kx, kz, 2.6, '#c9503a'); g.circle(kx, kz, 1.6, '#e3b23c');   // the kiosko's painted plaza
  // the skate spot under the ramps
  g.rect(lx0 + 16, lz0 + 1, lx1 - 16, lz0 + 7, '#9c988f');
  city.sd.chicano = { ...r, kx, kz, skate: { x0: lx0 + 16, x1: lx1 - 16, z0: lz0 + 1, z1: lz0 + 7 } };
  city.wanderZones.push({ x0: lx0 + 1, x1: lx1 - 1, z0: lz0 + 1, z1: lz1 - 1 }, { x0: lx0 + 1, x1: lx1 - 1, z0: kz - 0.8, z1: kz + 0.8 });
  for (let i = 0; i < 8; i++) city.addProp('bench', rand(lx0 + 2, lx1 - 2), rand(lz0 + 2, lz1 - 2), rand(0, 6));
  // a crowd: families, people looking at the murals, dancers, the crew by the lowriders, skaters
  crowdsIn(city, { x0: lx0 + 2, x1: lx1 - 2, z0: lz0 + 2, z1: lz1 - 2 }, 12, 3, 7);
  for (let k = 0; k < 8; k++) city.crowds.push({ x: rand(lx0 + 2, lx1 - 2), z: rand(lz0 + 2, lz1 - 2), r: 0.6, n: Math.round(rand(2, 4)), act: 'spect' });
  city.crowds.push({ x: kx, z: kz, r: 2.4, n: 10, act: 'mix', stay: true });
  for (let k = 0; k < 3; k++) city.crowds.push({ x: rand(lx0 + 2, lx1 - 2), z: lz1 - 1.2, r: 0.8, n: Math.round(rand(4, 6)), look: 'cholo', tag: 'gang' });
  city.crowds.push({ x: (lx0 + lx1) / 2, z: lz0 + 4, r: 2, n: 5, act: 'trick', stay: true });
  for (let k = 0; k < 6; k++) { const s = { x: lx0 + 3 + k * 2.6, z: lz1 + 1.3, rot: Math.PI / 2 }; city.parked.push(s); city.sd.lowriders.push(s); }
  for (let k = 0; k < 4; k++) city.crowds.push({ x: rand(lx0, lx1), z: rand(lz0, lz1), r: 0.3, n: 1, look: 'homeless' });
  city.closeArea({ x0: r.x0 + 0.5, x1: r.x1 - 0.5, z0: r.z0 + 0.5, z1: r.z1 - 0.5 });     // no cars through it (people still walk in)
}

// ---------- Coronado village ----------
function villageBlock(ctx, g, b) {
  const { city, B } = ctx;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const orange = Math.abs(b.x0 - 2.5 - -198) < 1 || Math.abs(b.x1 + 2.5 - -198) < 1;           // a block on Orange Avenue
  const golf = cx > -176 && cz > 154;                                                          // the golf course by Glorietta Bay
  city.paintSidewalk(g, b, '#c4bcae');
  city.lampsAlongBlock(b, orange ? 7 : 11);
  if (golf) {
    city.paintGrass(g, b.lx0 - 0.4, b.lz0 - 0.4, b.lx1 + 0.4, b.lz1 + 0.4, '#5f8f45');
    for (let k = 0; k < 4; k++) g.circle(rand(b.lx0 + 2, b.lx1 - 2), rand(b.lz0 + 2, b.lz1 - 2), rand(1, 2), '#e2d6b0');   // bunkers
    g.circle(cx, cz, 2.6, '#79b25a'); city.addProp('sign', cx, cz, 0);
    for (let k = 0; k < 7; k++) city.addTree(rand(b.lx0, b.lx1), rand(b.lz0, b.lz1), rand(1.1, 1.5), Math.random() < 0.5 ? 'palm' : 'round');
    city.crowds.push({ x: cx + rand(-3, 3), z: cz + rand(-3, 3), r: 1, n: Math.round(rand(2, 4)) });
    return;
  }
  if (cx > -220 && cx < -198 && cz > 154 && cz < 176) {
    // Spreckels Park: lawn, the bandstand, big trees
    city.paintGrass(g, b.lx0 - 0.4, b.lz0 - 0.4, b.lx1 + 0.4, b.lz1 + 0.4, '#5f8f45');
    g.circle(cx, cz, 3, '#c9c0ae');
    B.add({ x: cx, z: cz, w: 3.4, d: 3.4, floors: 1, style: 'house', tint: hsl(0.1, 0.1, 0.94), cell: 1.7, gh: 1.6, gable: true, roofTint: TILE() });
    for (let k = 0; k < 14; k++) city.addTree(rand(b.lx0 + 1, b.lx1 - 1), rand(b.lz0 + 1, b.lz1 - 1), rand(1.2, 1.7));
    city.wanderZones.push({ x0: b.lx0 + 1, x1: b.lx1 - 1, z0: b.lz0 + 1, z1: b.lz1 - 1 });
    crowdsIn(city, { x0: b.lx0 + 1, x1: b.lx1 - 1, z0: b.lz0 + 1, z1: b.lz1 - 1 }, 6, 3, 6);
    city.named.push({ S: 'Spreckels Park', o: 'Spreckels Park', x0: b.lx0, x1: b.lx1, z0: b.lz0, z1: b.lz1 });
    return;
  }
  if (orange) {
    // shops and restaurants along Orange Avenue: one- and two-storey, Spanish revival and old storefronts, palms
    const face = b.x1 + 2.5 === -198 ? 1 : -1;                                // which side faces the avenue
    const street = face > 0 ? b.lx1 : b.lx0;
    let z = b.lz0 + 0.2;
    for (const d of partition(b.lz1 - b.lz0 - 0.4, 4, 3)) {
      const w = rand(5.5, 7.5);
      const s = B.add({ x: street - face * w / 2, z: z + d / 2, w, d: d - 0.15, floors: Math.random() < 0.6 ? 1 : 2, style: 'stucco', tint: COTTAGE(), cell: 1.4, gh: 1.55, fh: 1.05,
        gable: Math.random() < 0.4, roofTint: TILE() });
      s.coronado = true;
      z += d;
    }
    for (let t = b.lz0 + 2; t < b.lz1 - 1; t += 3.5) city.addTree(street + face * 0.9, t, 1, 'palm');
    // houses on the back half
    cottages(ctx, g, { ...b, lx0: face > 0 ? b.lx0 : b.lx0 + 8, lx1: face > 0 ? b.lx1 - 8 : b.lx1 }, 'z');
    crowdsAroundBlock(city, b, 0.7, 0.4, 1.1);
    for (let k = 0; k < 4; k++) city.crowds.push({ x: street + face * 1.2, z: rand(b.lz0 + 1, b.lz1 - 1), r: 0.6, n: Math.round(rand(2, 4)), look: Math.random() < 0.5 ? 'tourist' : undefined });
    return;
  }
  cottages(ctx, g, b, 'x');
  city.treesAlongBlock(b, 5, Math.random() < 0.4 ? 'palm' : 'round', 0.95);
  crowdsAroundBlock(city, b, 0.3, 0.08, 0.8);
}
// rows of cottages, craftsman bungalows and Spanish revival houses with lawns, hedges and an alley down the middle
function cottages(ctx, g, b, along) {
  const { city, B } = ctx;
  const cz = (b.lz0 + b.lz1) / 2, alley = 1.4;
  g.rect(b.lx0, b.lz0, b.lx1, b.lz1, '#6f8d4a');
  g.rect(b.lx0, cz - alley / 2, b.lx1, cz + alley / 2, '#8f8a80');
  for (const face of [-1, 1]) {
    const street = face < 0 ? b.lz0 : b.lz1, dirIn = -face;
    for (let x = b.lx0 + 0.2; x < b.lx1 - 3;) {
      const w = Math.min(rand(4, 5.2), b.lx1 - x - 0.2);
      if (w < 3) break;
      const fy = rand(1.6, 2.4), d = Math.min(rand(3.6, 4.6), Math.abs(cz - street) - fy - alley / 2 - 0.4), lx = x + w / 2;
      if (d < 2.4) break;
      const spanish = Math.random() < 0.45;
      const h = B.add({ x: lx, z: street + dirIn * (fy + d / 2), w: w - rand(0.6, 1.1), d, floors: Math.random() < 0.65 ? 1 : 2, style: spanish ? 'stucco' : 'house', tint: COTTAGE(), cell: 1.3, gh: 1.3, fh: 1,
        gable: true, roofTint: spanish ? TILE() : SHINGLE() });
      h.noSigns = true; h.coronado = true;
      if (Math.random() < 0.5) for (let fx = x + 0.5; fx < x + w; fx += 1) city.addProp(Math.random() < 0.6 ? 'hedge' : 'fence', fx, street + dirIn * 0.2, 0);
      g.rect(lx - 0.3, Math.min(street, street + dirIn * fy), lx + 0.3, Math.max(street, street + dirIn * fy), '#d6d0c4');
      if (Math.random() < 0.55) city.addTree(x + rand(0.5, w - 0.5), street + dirIn * rand(0.6, fy - 0.3), rand(0.8, 1.2), Math.random() < 0.3 ? 'palm' : 'round');
      if (Math.random() < 0.35) city.parked.push({ x: lx + w / 2 - 0.4, z: cz - dirIn * (alley / 2 + 1.1), rot: 0 });
      x += w;
    }
  }
}

// ---------- the Hotel del Coronado and its beach ----------
function hotelDel(ctx, g) {
  const { city, B } = ctx;
  const H = HOTEL, x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z - H.d / 2, z1 = H.z + H.d / 2;
  // the grounds: the drive and lawn on the town side, the courtyard, the Windsor Lawn and pool on the ocean side
  g.rect(x0 - 4, 200.5, x1 + 6, z1 + 4, '#6f8d4a');
  g.rect(H.x - 3, 200.5, H.x + 3, z0, '#c9c0ae');                                          // the drive from Orange Avenue
  g.circle(H.x, z0 - 3, 2.6, '#6f8d4a'); g.circle(H.x, z0 - 3, 1.2, '#c9503a');
  city.paintGrass(g, x0 + 5, z0 + 5, x1 - 5, z1 - 5, '#6a9a48');                           // the courtyard garden
  const pool = { x0: x1 - 12, z0: z1 + 1.2, x1: x1 - 4, z1: z1 + 3.4 };
  g.rect(pool.x0 - 0.6, pool.z0 - 0.6, pool.x1 + 0.6, pool.z1 + 0.6, '#ece6d8');
  (city.pools ||= []).push(pool);
  const tint = hsl(0.11, 0.06, 0.95), roof = hsl(0.01, 0.62, 0.45);
  // the wings round the courtyard: four storeys of white wood, the long ocean front, the Crown Room at the north-west
  const wing = (x, z, w, d, floors, part) => { const b = B.add({ x, z, w, d, floors, style: 'house', tint, cell: 1.5, gh: 1.5, fh: 1.05, gable: false, roofTint: roof }); b.noSigns = true; b.landmark = true; b.hotel = part; return b; };
  const parts = city.sd.hotel = {
    north: wing(H.x + 2, z0 + 2.5, H.w - 14, 5, 4, 'north'),
    south: wing(H.x, z1 - 2.5, H.w, 5, 5, 'south'),
    east: wing(x1 - 2.5, H.z, 5, H.d - 10, 4, 'east'),
    west: wing(x0 + 6, H.z, 5, H.d - 10, 4, 'west'),
    crown: B.add({ x: x0 + 3.5, z: z0 + 3.5, w: 7, d: 7, floors: 2, style: 'house', tint, cell: 1.75, gh: 1.8, fh: 1.3 }),
    tower: B.add({ x: H.x + 4, z: z1 - 2.5, w: 3, d: 3, floors: 7, style: 'house', tint, cell: 1.5, gh: 1.5, fh: 1.05 }),
    x0, x1, z0, z1, pool,
  };
  for (const k of ['crown', 'tower']) { parts[k].noSigns = true; parts[k].landmark = true; parts[k].hotel = k; }
  city.named.push({ S: 'The Hotel del Coronado', o: 'the Hotel del Coronado', x0, x1, z0, z1, landmark: true });
  // guests and staff: the lawn, the pool, the terrace, the drive (they act like La Playa's resort crowds)
  city.wanderZones.push({ x0: x0, x1: x1, z0: z1 + 0.5, z1: z1 + 4 }, { x0: x0 + 5, x1: x1 - 5, z0: z0 + 5, z1: z1 - 5 });
  for (let k = 0; k < 10; k++) city.crowds.push({ x: rand(x0, x1), z: z1 + rand(0.8, 3.6), r: 0.6, n: Math.round(rand(2, 5)), look: Math.random() < 0.55 ? 'tourist' : 'swim' });
  for (let k = 0; k < 6; k++) city.crowds.push({ x: rand(pool.x0, pool.x1), z: pool.z1 + 0.7, r: 0.5, n: Math.round(rand(2, 3)), look: 'swim', act: Math.random() < 0.5 ? 'sit' : undefined, stay: true });
  for (const x of [H.x - 2, H.x + 2]) city.crowds.push({ x, z: z0 - 1.2, r: 0.4, n: 2, look: 'hotelstaff' });
  for (let k = 0; k < 4; k++) city.crowds.push({ x: rand(x0 + 6, x1 - 6), z: rand(z0 + 6, z1 - 6), r: 0.6, n: 3, look: 'tourist' });
  for (let t = x0 - 2; t < x1 + 4; t += 4) { city.addTree(t, 202, 1.1, 'palm'); city.addTree(t + 1.5, z1 + 4.6, 1.2, 'palm'); }
  city.closeArea({ x0: x0 - 2, x1: x1 + 2, z0: z0 - 2, z1: z1 + 1 });
}
function coronadoBeach(ctx, g) {
  const { city } = ctx;
  const sd = city.sd;
  // Central Beach runs from the Hotel del round to the north-west: umbrellas, towels, crowds, swimmers in the shallows
  const coast = [[-160, 252], [-186, 249], [-214, 245], [-242, 233], [-264, 212], [-280, 184], [-288, 150]];
  const along = (t) => { const f = t * (coast.length - 1), i = Math.min(coast.length - 2, Math.floor(f)), u = f - i; return [coast[i][0] + (coast[i + 1][0] - coast[i][0]) * u, coast[i][1] + (coast[i + 1][1] - coast[i][1]) * u, i]; };
  const inland = (x, z, d) => { const cx = -215, cz = 165; const l = Math.hypot(x - cx, z - cz); return [x + (cx - x) / l * d, z + (cz - z) / l * d]; };
  for (let k = 0; k < 70; k++) {
    const [x, z] = along(rand(0.02, 0.98)), [bx, bz] = inland(x, z, rand(2.5, 8.5));
    if (!onCoronado(bx, bz)) continue;
    const col = hsl(Math.random(), 0.7, 0.55);
    city.addProp('umbrella', bx, bz, 0, 1); city.props[city.props.length - 1].color = col;
    city.addProp('towel', bx + 0.4, bz + 0.6, rand(0, 6), 1); city.props[city.props.length - 1].color = hsl(Math.random(), 0.6, 0.6);
  }
  for (let k = 0; k < 34; k++) {
    const [x, z] = along(rand(0.02, 0.98)), [bx, bz] = inland(x, z, rand(1.5, 8));
    if (!onCoronado(bx, bz)) continue;
    city.crowds.push({ x: bx, z: bz, r: 0.9, n: Math.round(rand(3, 7)), look: Math.random() < 0.6 ? 'swim' : 'tourist', act: Math.random() < 0.3 ? 'sit' : undefined, stay: Math.random() < 0.3 });
  }
  for (let k = 0; k < 14; k++) { const [x, z] = along(rand(0.02, 0.98)), [bx, bz] = inland(x, z, rand(-1.5, 0.5)); city.crowds.push({ x: bx, z: bz, r: 0.8, n: Math.round(rand(2, 4)), look: 'swim', act: Math.random() < 0.4 ? 'dance' : undefined }); }
  for (let k = 0; k + 1 < coast.length; k++) { const [a, b] = coast[k], [c, d] = coast[k + 1], [ia, ib] = inland(a, b, 5), [ic, id] = inland(c, d, 5); city.wanderZones.push({ x0: Math.min(ia, ic), x1: Math.max(ia, ic), z0: Math.min(ib, id), z1: Math.max(ib, id) }); }
  city.wanderZones = city.wanderZones.filter((w) => onCoronado((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2));
  // lifeguard towers
  for (const t of [0.15, 0.45, 0.75]) { const [x, z] = along(t), [bx, bz] = inland(x, z, 7); sd.towers.push({ x: bx, z: bz }); }
  city.named.push({ S: 'Coronado Central Beach', o: 'Coronado Central Beach', x0: -290, x1: -160, z0: 150, z1: 252 });
  // the Coronado Shores towers along the start of the Strand
  for (const [x, z] of [[-152, 240], [-142, 248], [-133, 257], [-146, 260]]) {
    if (!onCoronado(x, z)) continue;
    const t = ctx.B.add({ x, z, w: 4.6, d: 4.2, floors: 15, style: 'concrete', tint: hsl(0.1, 0.05, 0.93), cell: 1.4, gh: 1.5, fh: 1.05 });
    t.noSigns = true;
    g.rect(x - 3.5, z - 3.5, x + 3.5, z + 3.5, '#b9b2a4');
  }
}

// ---------- Naval Air Station North Island ----------
function northIsland(ctx, g) {
  const { city, B } = ctx, sd = city.sd, X = g.x;
  // everything north of the fence: pale concrete, grass, the runways
  X.save(); X.beginPath(); CORONADO.forEach(([a, b], i) => (i ? X.lineTo(g.px(a), g.pz(b)) : X.moveTo(g.px(a), g.pz(b)))); X.closePath(); X.clip();
  g.rect(-300, -110, -130, NAS_FENCE, '#8f946e'); g.grainRect(-300, -110, -130, NAS_FENCE, 0.4, 60);
  for (let k = 0; k < 500; k++) g.circle(rand(-295, -135), rand(-100, NAS_FENCE), rand(0.5, 3), pick(['rgba(110,120,80,.35)', 'rgba(150,146,120,.3)']));
  // the runways: 29/11 along the island, 18/36 across it
  const runway = (x0, z0, x1, z1, w, name) => {
    const a = Math.atan2(z1 - z0, x1 - x0), L = Math.hypot(x1 - x0, z1 - z0);
    X.save(); X.translate(g.px(x0), g.pz(z0)); X.rotate(a);
    X.fillStyle = '#3e3f41'; X.fillRect(0, -w / 2 * g.k, L * g.k, w * g.k);
    X.fillStyle = 'rgba(240,240,235,.9)';
    for (let t = 6; t < L - 6; t += 4) X.fillRect(t * g.k, -0.08 * g.k, 2 * g.k, 0.16 * g.k);          // centre line
    for (const e of [0.5, L - 3.5]) for (let s = -w / 2 + 0.5; s < w / 2 - 0.5; s += 0.7) X.fillRect(e * g.k, s * g.k, 3 * g.k, 0.35 * g.k);   // threshold bars
    X.fillRect(0, (-w / 2 + 0.2) * g.k, L * g.k, 0.1 * g.k); X.fillRect(0, (w / 2 - 0.3) * g.k, L * g.k, 0.1 * g.k);
    X.restore();
    sd.runways = sd.runways || []; sd.runways.push({ x0, z0, x1, z1, w, a, L, name });
  };
  runway(-276, -6, -156, -54, 6, '29');
  runway(-232, -84, -214, 62, 5, '36');
  // aprons and taxiways by the bay, the hangar line, the carrier piers
  g.rect(-212, 0, -150, 76, '#a9a8a2'); g.grainRect(-212, 0, -150, 76, 0.25, 40);
  for (let x = -210; x < -150; x += 6) g.line(x, 2, x, 74, 0.05, 'rgba(60,60,60,.25)');
  g.rect(-205, -42, -165, -24, '#a9a8a2');
  X.restore();
  for (let k = 0; k < 6; k++) {
    const x = -204 + k * 9.5, z = 82;
    const h = B.add({ x, z, w: 8.5, d: 9, floors: 2, style: 'garage', tint: hsl(0.1, 0.05, rand(0.72, 0.8)), cell: 2.8, gh: 2.6, fh: 1.6 });
    h.noSigns = true; sd.hangars.push(h);
  }
  for (const [x, z, w, d, f] of [[-226, 70, 10, 6, 3], [-242, 78, 8, 8, 2], [-226, 50, 6, 12, 2], [-252, 40, 9, 6, 3], [-244, 18, 7, 7, 2], [-262, 64, 8, 5, 2]]) {
    const b = B.add({ x, z, w, d, floors: f, style: 'concrete', tint: hsl(0.1, 0.06, rand(0.74, 0.84)), cell: 1.8, gh: 1.6, fh: 1.1 }); b.noSigns = true;
  }
  sd.tower = B.add({ x: -218, z: 30, w: 3, d: 3, floors: 9, style: 'concrete', tint: hsl(0.1, 0.04, 0.85), cell: 1.5, gh: 1.6, fh: 1.1 });
  sd.tower.noSigns = true; sd.tower.landmark = true;
  // the carrier quay along the bay side: the carriers tie up end to end along it (js/sdbay.js)
  sd.piers.push({ x0: -142, x1: -131, z0: -30, z1: 96, kind: 'quay' });
  sd.carriers = [{ x: -122, z: 14, kind: 'cvn', yaw: -Math.PI / 2, s: 1.7 }, { x: -124, z: 70, kind: 'lhd', yaw: -Math.PI / 2, s: 1.5 }];
  // sailors everywhere: the flight line, the hangars, the piers; marines at the gate; no civilians and no civilian cars
  const mil = (x, z, n, look, r = 1.2) => city.crowds.push({ x, z, r, n, look, tag: 'military' });
  for (let k = 0; k < 14; k++) mil(rand(-208, -154), rand(4, 72), Math.round(rand(2, 5)), pick(['navy', 'navy', 'flightdeck', 'flightdeck', 'khaki']), 2);
  for (const h of sd.hangars) mil(h.x, h.z - 6, Math.round(rand(3, 6)), pick(['navy', 'flightdeck']), 1.5);
  for (const p of sd.piers) for (let k = 0; k < 3; k++) mil(rand(p.x0 + 2, p.x1 - 2), (p.z0 + p.z1) / 2, 3, pick(['navy', 'navywhite']), 1);
  for (let k = 0; k < 10; k++) mil(rand(-270, -230), rand(10, 80), Math.round(rand(2, 5)), pick(['marine', 'navy', 'khaki']), 2);
  // the gate where the village meets the base (Fourth Street side), and the fence
  sd.gates.push({ x: -220, z: NAS_FENCE, name: 'NAS North Island' });
  mil(-218, NAS_FENCE + 1.6, 3, 'marine', 0.5); mil(-222, NAS_FENCE - 2, 2, 'mp', 0.5);
  sd.fences.push({ x0: -292, x1: -140, z: NAS_FENCE, gap: [-224, -216] });
  g.rect(-292, NAS_FENCE - 0.15, -140, NAS_FENCE + 0.15, '#7d7c78');
  city.named.push({ S: 'Naval Air Station North Island', o: 'Naval Air Station North Island', x0: -292, x1: -136, z0: -94, z1: NAS_FENCE });
}

// ---------- Naval Base San Diego ----------
function navalBase(ctx, g) {
  const { city, B } = ctx, sd = city.sd, N = NBSD;
  const pts = [[N.x1, N.z0]]; for (let z = N.z0; z <= N.z1; z += 2) pts.push([sdShoreX(z) + 0.2, z]); pts.push([N.x1, N.z1]);
  g.poly(pts, '#a19f99'); g.grainRect(-40, N.z0, N.x1, N.z1, 0.3, 40);
  // Harbor Drive along the top and down the east side, Gate 7 where it enters
  g.rect(-14, N.z0 - 2, N.x1, N.z0 + 3, '#4a4b4d'); g.rect(N.x1 - 9, N.z0, N.x1 - 4, N.z1, '#4a4b4d');
  for (let x = -12; x < N.x1; x += 3) g.rect(x, N.z0 + 0.45, x + 1.6, N.z0 + 0.55, 'rgba(226,186,60,.85)');
  sd.gates.push({ x: N.x1 - 6.5, z: N.z0 + 5, name: 'Gate 7', nbsd: true });
  // piers out into the bay, each with ships tied up on both sides
  for (let k = 0; k < 5; k++) {
    const z = N.z0 + 18 + k * 24, sx = sdShoreX(z);
    const p = { x0: sx - 50, x1: sx + 1, z0: z - 2.4, z1: z + 2.4, kind: 'pier' };
    sd.piers.push(p);
    for (const s of [-1, 1]) { const kind = pick(k % 2 ? ['ddg', 'ddg', 'lpd', 'cg'] : ['lhd', 'ddg', 'zumwalt', 'lcs']); sd.ships.push({ x: sx - 27, z: z + s * (kind === 'lhd' || kind === 'lpd' ? 8.6 : 7.2), kind, yaw: Math.PI, s: kind === 'lhd' ? 1.35 : 1.5 }); }
  }
  // warehouses, barracks, the waterfront sheds, parking full of grey trucks
  for (let z = N.z0 + 10; z < N.z1 - 8; z += 16) for (let x = sdShoreX(z) + 8; x < N.x1 - 14; x += 14) {
    if (Math.random() < 0.25) { const sp = city.paintParking(g, x, z, x + 10, z + 8); for (const s of sp) if (Math.random() < 0.5) sd.vehicles.push({ ...s, kind: pick(['humvee', 'truck', 'pickup']) }); continue; }
    const b = B.add({ x: x + 5, z: z + 4, w: rand(8, 11), d: rand(6, 8), floors: Math.random() < 0.5 ? 2 : 3, style: Math.random() < 0.6 ? 'concrete' : 'garage', tint: NAVYGREY(), cell: 2.2, gh: 1.8, fh: 1.3 });
    b.noSigns = true;
  }
  const mil = (x, z, n, look, r = 1.2) => city.crowds.push({ x, z, r, n, look, tag: 'military' });
  for (const p of sd.piers.filter((q) => q.kind === 'pier')) for (let k = 0; k < 4; k++) mil(rand(p.x0 + 2, p.x1 - 2), (p.z0 + p.z1) / 2, Math.round(rand(2, 4)), pick(['navy', 'navy', 'navywhite', 'khaki']), 1.2);
  for (let k = 0; k < 16; k++) { const z = rand(N.z0 + 8, N.z1 - 8); mil(rand(sdShoreX(z) + 4, N.x1 - 12), z, Math.round(rand(2, 5)), pick(['navy', 'navy', 'marine', 'khaki']), 2); }
  mil(N.x1 - 6.5, N.z0 + 4, 3, 'mp', 0.6);
  city.named.push({ S: 'Naval Base San Diego', o: 'Naval Base San Diego', x0: -40, x1: N.x1, z0: N.z0, z1: N.z1 });
}

// ---------- the Silver Strand (Highway 75), until the map ends ----------
function silverStrand(ctx, g) {
  const { city } = ctx;
  const road = [[-176, 199], [-160, 206], [-148, 218], [-132, 242], [-118, 266], [-106, 292], [-100, 316]];
  const X = g.x;
  X.save(); X.strokeStyle = '#4a4b4d'; X.lineWidth = 5.4 * g.k; X.lineJoin = 'round'; X.beginPath(); road.forEach(([a, b], i) => (i ? X.lineTo(g.px(a), g.pz(b)) : X.moveTo(g.px(a), g.pz(b)))); X.stroke();
  X.strokeStyle = 'rgba(226,186,60,.9)'; X.lineWidth = 0.08 * g.k; X.stroke();
  X.restore();
  city.sd.strand = road;
  city.named.push({ S: 'The Silver Strand', o: 'the Silver Strand', x0: -170, x1: -96, z0: 205, z1: 320 });
}

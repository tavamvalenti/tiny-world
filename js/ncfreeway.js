// NORTH COUNTY: I-5. A divided freeway that reads as one from any height: two decks side by side behind a median
// barrier, concrete barriers along both edges, lanes and shoulders painted on. It stands on an embankment of dry grass
// and opens into bridges wherever a street, the lagoons or the river pass under it, so the city's streets cross
// beneath it and never meet it. Ramps come off only where the real interchanges are (js/northcounty.js picks them:
// each joins I-5 to a street the map keeps) and run down to that street, with a green exit sign over the lanes
// before each exit. CA-78 leaves on its own raised deck and comes down where the hills begin.
// Traffic runs both ways on it; a heavy hit drops a span (traffic stops coming through it), and it's solid to fly into.
import * as THREE from 'three';
import { G, rand, pick, clamp } from './core.js';
import { solids } from './solids.js';
import { canvasTex } from './mapkit.js';
import { NC, isLand } from './ncgeo.js';
import { ROADS, lineLen } from './northcounty.js';
import { carGeos } from './agents.js';
import { truckGeos } from './harbor.js';

const H = 1.5;                                   // the deck's height over the streets
const MED = 0.3, CW = 4.2, HALF = MED + CW;      // half the median, a carriageway (3 lanes and the shoulders), half the road
const LANES = [1.3, 2.4, 3.5];                   // lane centres out from the middle (forward traffic on the minus side)
const SLAB = 0.35;
const C = { asphalt: 0x4a4b4e, conc: 0xc9c3b6, barrier: 0xd9d4c8, under: 0x8d877c, white: 0xecebe4, yellow: 0xe0b83c, pole: 0x6c7075 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();

// triangles with colours, grouped into chunks (a chunk is what a blast knocks down)
class Build {
  constructor() { this.pos = []; this.col = []; }
  get n() { return this.pos.length / 3; }
  tri(a, b, c, color) { _c.set(color); for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.col.push(_c.r, _c.g, _c.b); } }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
}

// a line through samples ~1-2 units apart: points, the sideways direction at each (track()'s sign: + is left of travel)
function frame(P) {
  return P.map((p, k) => {
    const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    return { x: p[0], z: p[1], nx: tz, nz: -tx, tx, tz };
  });
}
const at = (f, o, y) => [f.x + f.nx * o, y, f.z + f.nz * o];

export class Freeway {
  constructor(scene) {
    this.scene = scene; this.chunks = []; this.lit = []; this.signs = [];
    this.DECK = new Map();
    // where the city passes under: its streets, the coast line's tracks, the water
    const RH = new Set(); for (const r of NC.rail) for (let k = 0; k + 1 < r.p.length; k++) { const [a, b] = r.p[k], [c, d] = r.p[k + 1], n = Math.ceil(Math.hypot(c - a, d - b)); for (let t = 0; t <= n; t++) RH.add(`${Math.round(a + (c - a) * t / n)},${Math.round(b + (d - b) * t / n)}`); }
    this.under = (x, z) => !isLand(x, z) || !!ROADS.streetAt(x, z, 0) || RH.has(`${Math.round(x)},${Math.round(z)}`);
    const main = new Build(), lamps = new Build();
    this.main = main; this.lamps = lamps;

    // ---------- I-5 ----------
    const P = ROADS.i5; if (P.length < 4) return;
    const F = frame(P), n = F.length, cum = [0];
    for (let k = 1; k < n; k++) cum.push(cum[k - 1] + Math.hypot(F[k].x - F[k - 1].x, F[k].z - F[k - 1].z));
    const L = cum[n - 1];
    // height: up on its embankment, easing down to the ground at the map's two ends (where it runs on into the haze)
    const h = cum.map((s) => H * smooth(clamp(Math.min(s, L - s) / 30, 0, 1)));
    // a bridge where anything passes under (a little either side, for the abutments)
    const openRaw = F.map((f) => [-HALF - 1, 0, HALF + 1].some((o) => this.under(f.x + f.nx * o, f.z + f.nz * o)));
    const open = openRaw.map((v, k) => h[k] > 0.6 && openRaw.slice(Math.max(0, k - 2), k + 3).some(Boolean));
    // where the ramps join, the outer barrier opens for them
    const gap = [new Set(), new Set()];
    for (const r of [...ROADS.ramps, ...ROADS.spurs]) {
      const p = r.p[0]; let kb = 0, bd = 1e9; F.forEach((f, k) => { const d = (f.x - p[0]) ** 2 + (f.z - p[1]) ** 2; if (d < bd) { bd = d; kb = k; } });
      const side = (p[0] - F[kb].x) * F[kb].nx + (p[1] - F[kb].z) * F[kb].nz > 0 ? 1 : 0;
      for (let k = kb - 7; k <= kb + 7; k++) gap[side].add(k);
      r.join = { k: kb, side: side ? 1 : -1 };
    }
    this.i5 = { F, cum, L, h, open };
    const CH = 12;
    for (let k0 = 0; k0 < n - 1; k0 += CH) {
      const k1 = Math.min(n - 1, k0 + CH);
      this.chunk(() => {
        for (let k = k0; k < k1; k++) this.section(F[k], F[k + 1], h[k], h[k + 1], open[k] && open[k + 1], {
          half: HALF, median: true, barL: !gap[1].has(k), barR: !gap[0].has(k), mark: true, dash: cum[k],
          capA: k > 0 && open[k] !== open[k - 1] ? 1 : 0, capB: open[k] !== open[k + 1] && k + 1 < n - 1 ? 1 : 0, openA: open[k], openB: open[k + 1],
        });
        // the median's lights, every 18 units
        for (let k = k0; k < k1; k++) if (Math.floor(cum[k] / 18) !== Math.floor(cum[k + 1] / 18) && h[k] > 1) this.lamp(F[k], h[k]);
      }, F.slice(k0, k1 + 1), h.slice(k0, k1 + 1), open.slice(k0, k1 + 1), HALF);
    }
    // ---------- the ramps and CA-78 ----------
    for (const r of [...ROADS.ramps, ...ROADS.spurs]) {
      const RF = frame(r.p), rc = [0]; for (let k = 1; k < RF.length; k++) rc.push(rc[k - 1] + Math.hypot(RF[k].x - RF[k - 1].x, RF[k].z - RF[k - 1].z));
      const RL = rc[rc.length - 1], half = r.spur ? 2.3 : 1.35;
      // a ramp runs straight down to its street; CA-78 stays up until the last stretch before the hills
      const rh = rc.map((s) => (r.spur ? H * smooth(clamp((RL - s) / 22, 0, 1)) : H * smooth(clamp(1 - s / RL, 0, 1))) + 0.03);
      const ro = RF.map((f, k) => rh[k] > 0.9 && this.under(f.x, f.z));
      this.chunk(() => { for (let k = 0; k + 1 < RF.length; k++) this.section(RF[k], RF[k + 1], rh[k], rh[k + 1], ro[k] && ro[k + 1], { half, barL: true, barR: true, mark: false, dash: rc[k], capA: k > 0 && ro[k] !== ro[k - 1] ? 1 : 0, capB: 0, openA: ro[k], openB: ro[k + 1] }); }, RF, rh, ro, half);
      if (r.exit && r.join) this.exitSign(r);
      if (r.spur && r.join) this.safariSign(r);
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    this.mesh = main.mesh(mat); scene.add(this.mesh);
    this.y0 = this.mesh.geometry.attributes.position.array.slice();
    const lm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: 0xffe2a8, emissiveIntensity: 0 });
    this.lampMesh = lamps.mesh(lm); this.lampMesh.castShadow = false; scene.add(this.lampMesh); this.lit.push({ mat: lm, k: 1.4 });
    this.ly0 = this.lampMesh.geometry.attributes.position.array.slice();
    // solid: the deck (and the embankment under it) to anything flying into it
    solids.push({ alive: true, test: (p) => {
      const d = this.DECK.get(`${Math.round(p.x)},${Math.round(p.z)}`); if (!d || !d.c.alive) return null;
      const top = d.h + 0.05; if (p.y > top || p.y < (d.open ? d.h - SLAB - 0.1 : -0.5)) return null;
      return { n: new THREE.Vector3(0, 1, 0), pen: top - p.y };
    } });
    this.traffic(scene);
  }

  // record what one chunk adds, and where it stands (for blasts, the solid and the traffic)
  chunk(make, F, h, open, half) {
    const c = { a: this.main.n, la: this.lamps.n, alive: true, hp: 700, fall: 0, pts: F.map((f, k) => ({ x: f.x, z: f.z, h: h[k] })), signs: [] };
    this.cur = c; make(); c.b = this.main.n; c.lb = this.lamps.n; this.cur = null;
    F.forEach((f, k) => { for (let o = -half; o <= half + 0.01; o += 0.7) { const key = `${Math.round(f.x + f.nx * o)},${Math.round(f.z + f.nz * o)}`, old = this.DECK.get(key); if (!old || old.h < h[k]) this.DECK.set(key, { h: h[k], open: open[k], c }); } });
    this.chunks.push(c); return c;
  }

  // one stretch of road between two cross-sections
  section(A, B, ha, hb, open, o) {
    const M = this.main, w = o.half, s = SLAB;
    // the deck: asphalt on top, the concrete edge either side, the underside where it's a bridge
    M.quad(at(A, -w, ha), at(B, -w, hb), at(B, w, hb), at(A, w, ha), C.asphalt);
    for (const sd of [-1, 1]) M.quad(at(A, sd * w, ha), at(B, sd * w, hb), at(B, sd * w, hb - s), at(A, sd * w, ha - s), C.conc);
    if (open) {
      M.quad(at(A, w, ha - s), at(B, w, hb - s), at(B, -w, hb - s), at(A, -w, ha - s), C.under);
      // piers under the middle and both carriageways (or the ramp's middle)
      const L = Math.hypot(B.x - A.x, B.z - A.z);
      if (L > 0 && Math.floor((o.dash ?? 0) / 6) !== Math.floor(((o.dash ?? 0) + L) / 6)) for (const off of o.median ? [-w * 0.6, 0, w * 0.6] : [0]) this.pier(A, off, ha - s);
    } else {
      // the embankment: dry grass sloping down from the deck's edges
      const grass = 0x746e50, d = (y) => y * 1.15 + 0.3;
      for (const sd of [-1, 1]) M.quad(at(A, sd * w, ha - s), at(A, sd * (w + d(ha)), -0.02), at(B, sd * (w + d(hb)), -0.02), at(B, sd * w, hb - s), sd > 0 ? grass : 0x6c6649);
    }
    // the abutment: a concrete wall closing the embankment where a bridge begins or ends
    for (const [cap, F, hh, isOpen] of [[o.capA, A, ha, o.openA], [o.capB, B, hb, o.openB]]) if (cap && !isOpen) {
      const e = w + hh * 1.15 + 0.3;
      M.quad(at(F, -e, -0.02), at(F, -w, hh - s), at(F, w, hh - s), at(F, e, -0.02), C.conc);
    }
    // the barriers: concrete along both edges, and the median's down the middle
    const bar = (off, wd, ht) => {
      const a0 = at(A, off - wd / 2, ha), a1 = at(A, off + wd / 2, ha), b0 = at(B, off - wd / 2, hb), b1 = at(B, off + wd / 2, hb), up = (p) => [p[0], p[1] + ht, p[2]];
      M.quad(up(a0), up(b0), up(b1), up(a1), C.barrier); M.quad(a0, b0, up(b0), up(a0), C.barrier); M.quad(b1, a1, up(a1), up(b1), C.barrier);
    };
    if (o.barL) bar(w - 0.12, 0.24, 0.32);
    if (o.barR) bar(-w + 0.12, 0.24, 0.32);
    if (o.median) bar(0, 0.3, 0.4);
    // the paint: yellow inside, white outside, dashes between the lanes
    if (o.mark) {
      const line = (off, wd, color, a = A, b = B, ya = ha, yb = hb) => M.quad(at(a, off - wd / 2, ya + 0.012), at(b, off - wd / 2, yb + 0.012), at(b, off + wd / 2, yb + 0.012), at(a, off + wd / 2, ya + 0.012), color);
      for (const sd of [-1, 1]) { line(sd * (MED + 0.45), 0.07, C.yellow); line(sd * (HALF - 0.45), 0.07, C.white); }
      const L = Math.hypot(B.x - A.x, B.z - A.z), ph = (o.dash % 2.6) / 2.6;
      if (ph < 0.4 && L > 0) for (const sd of [-1, 1]) for (const off of [1.85, 2.95]) line(sd * off, 0.06, C.white);
    }
  }
  pier(F, off, top) { const M = this.main, x = F.x + F.nx * off, z = F.z + F.nz * off, r = 0.28; const c = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([a, b]) => [x + a, z + b]); for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; M.quad([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], top, q[1]], [p[0], top, p[1]], C.conc); } }
  lamp(F, h) {
    const M = this.main, Lm = this.lamps, ht = 2.4, x = F.x, z = F.z, r = 0.06;
    for (const [a, b, c, d] of [[[-r, -r], [r, -r], [r, r], [-r, r]]]) { const pts = [a, b, c, d]; for (let i = 0; i < 4; i++) { const p = pts[i], q = pts[(i + 1) % 4]; M.quad([x + p[0], h + 0.4, z + p[1]], [x + q[0], h + 0.4, z + q[1]], [x + q[0], h + ht, z + q[1]], [x + p[0], h + ht, z + p[1]], C.pole); } }
    for (const sd of [-1, 1]) {
      const end = at(F, sd * 1.3, h + ht), mid = [x, h + ht, z];
      M.quad([mid[0], mid[1] - 0.05, mid[2]], [end[0], end[1] - 0.05, end[2]], [end[0], end[1] + 0.05, end[2]], [mid[0], mid[1] + 0.05, mid[2]], C.pole);
      const e = at(F, sd * 1.45, h + ht - 0.06), s = 0.16;
      Lm.quad([e[0] - s, e[1], e[2] - s], [e[0] + s, e[1], e[2] - s], [e[0] + s, e[1], e[2] + s], [e[0] - s, e[1], e[2] + s], 0xfff4d6);
      Lm.quad([e[0] - s, e[1], e[2] + s], [e[0] + s, e[1], e[2] + s], [e[0] + s, e[1], e[2] - s], [e[0] - s, e[1], e[2] - s], 0xfff4d6);
    }
  }

  // ---------- signs ----------
  // a green sign over the lanes about 30 units before an exit: EXIT on a tab, the street's name
  exitSign(r) {
    const { F, cum, h } = this.i5, j = r.join, dir = j.side < 0 ? 1 : -1;             // traffic toward the exit runs this way
    let k = j.k; while (k > 0 && k < F.length - 1 && Math.abs(cum[k] - cum[j.k]) < 28) k -= dir;
    if (h[k] < 1.2) return;
    const f = F[k], y = h[k], side = j.side, M = this.main, chunk = this.chunks.find((c) => c.pts.some((p) => p.x === f.x && p.z === f.z)) || this.chunks[0];
    // the gantry: posts at the median and the outer edge, a truss across
    const post = (o) => { const p = at(f, o, 0); const r = 0.09; const c = [[-r, -r], [r, -r], [r, r], [-r, r]]; for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; M.quad([p[0] + a[0], y, p[2] + a[1]], [p[0] + b[0], y, p[2] + b[1]], [p[0] + b[0], y + 3, p[2] + b[1]], [p[0] + a[0], y + 3, p[2] + a[1]], C.pole); } };
    const o0 = side * 0.35, o1 = side * (HALF + 0.05);
    post(o0); post(o1);
    for (const dy of [2.75, 3.0]) M.quad(at(f, o0, y + dy - 0.05), at(f, o1, y + dy - 0.05), at(f, o1, y + dy + 0.05), at(f, o0, y + dy + 0.05), C.pole);
    // the panel, facing the oncoming traffic
    const tex = exitTex(short(r.name));
    const pm = signPanel(tex, 2.6, 1.0);
    const c = at(f, side * 2.6, y + 2.45); pm.position.set(c[0], c[1], c[2]);
    pm.rotation.y = Math.atan2(f.tx, f.tz) + (dir > 0 ? Math.PI : 0); pm.castShadow = true;
    this.scene.add(pm); chunk.signs.push(pm);
  }
  // the one everybody passes: the Safari Park, by way of CA-78
  safariSign(r) {
    if (this.safari) return; this.safari = true;
    const { F, h } = this.i5, j = r.join, k = clamp(j.k + (j.side < 0 ? -20 : 20), 0, F.length - 1), f = F[k];
    if (h[k] < 1.2) return;
    const tex = canvasTex(512, 256, (x, w, hh) => {
      x.fillStyle = '#0b6b3a'; x.beginPath(); x.roundRect(0, 0, w, hh, 18); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.roundRect(10, 10, w - 20, hh - 20, 12); x.stroke();
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 50px Inter, Arial'; x.fillText('San Diego Zoo', w / 2, 70); x.fillText('Safari Park', w / 2, 126);
      x.font = '700 40px Inter, Arial'; x.fillText('USE', w / 2 - 130, 205); x.fillText('EAST', w / 2 + 120, 205);
      x.beginPath(); x.arc(w / 2, 192, 34, 0, 6.283); x.fillStyle = '#fff'; x.fill(); x.fillStyle = '#0b6b3a'; x.font = '800 36px Inter, Arial'; x.fillText('78', w / 2, 205);
    });
    const pm = signPanel(tex, 1.6, 0.8);
    const c = at(f, j.side * (HALF + 1.2), h[k] + 1.1); pm.position.set(c[0], c[1], c[2]); pm.rotation.y = Math.atan2(f.tx, f.tz) + (j.side < 0 ? Math.PI : 0); this.scene.add(pm);
    const M = this.main, p = at(f, j.side * (HALF + 1.2), 0);
    for (const dz of [-0.55, 0.55]) { const a = [p[0] + f.tx * dz, 0, p[2] + f.tz * dz]; M.quad([a[0] - 0.04, 0, a[2]], [a[0] + 0.04, 0, a[2]], [a[0] + 0.04, h[k] + 0.75, a[2]], [a[0] - 0.04, h[k] + 0.75, a[2]], C.pole); }
    this.chunks[this.chunks.length - 1].signs.push(pm);
  }

  // ---------- traffic: both ways, three lanes each ----------
  traffic(scene) {
    const { F, cum, L, h } = this.i5;
    this.at = (s) => {
      s = clamp(s, 0, L); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
      const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1), a = F[lo], b = F[hi];
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: h[lo] + (h[hi] - h[lo]) * t, nx: a.nx, nz: a.nz, yaw: Math.atan2(b.x - a.x, b.z - a.z), k: lo };
    };
    this.kOf = (k) => this.chunks[Math.min(this.chunks.length - 1, Math.floor(k / 12))];
    const car = carGeos(), truck = truckGeos();
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }), darkMat = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.15, metalness: 0.7 });
    const kinds = [{ g: car, n: 130, colors: [0xf2f2f0, 0x1c1d20, 0x8a9096, 0xb4bac0, 0x9e1b1b, 0x1e3f73, 0x2f5d3a, 0xd9c7a0, 0x3a3f46, 0xcfd6dc] }, { g: truck, n: 20, colors: [0xf2f2f0, 0xc8352b, 0x1e3f73, 0xe6b422, 0x2f5d3a] }];
    this.cars = [];
    for (const k of kinds) {
      k.body = new THREE.InstancedMesh(k.g.body, bodyMat, k.n); k.dark = new THREE.InstancedMesh(k.g.dark, darkMat, k.n);
      for (const m of [k.body, k.dark]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
      for (let i = 0; i < k.n; i++) {
        const heavy = k.g === truck, dir = i % 2 ? 1 : -1;
        this.cars.push({ k, i, dir, s: rand(0, L), v: heavy ? rand(7, 8.5) : rand(9, 12.5), lane: -dir * (heavy ? pick([2.4, 3.5]) : pick(LANES)), alive: true, deadT: 0 });
        k.body.setColorAt(i, _c.set(pick(k.colors)));
      }
    }
    this.kinds = kinds;
  }
  updateTraffic(dt) {
    if (!this.cars) return;
    const L = this.i5.L;
    for (const c of this.cars) {
      if (!c.alive) { c.deadT -= dt; if (c.deadT > 0) { c.k.body.setMatrixAt(c.i, ZERO); c.k.dark.setMatrixAt(c.i, ZERO); continue; } c.alive = true; c.s = c.dir > 0 ? 0 : L; }
      c.s += c.dir * c.v * dt;
      if (c.s > L) c.s -= L; else if (c.s < 0) c.s += L;
      // a span down ahead: the traffic stops coming through (that car turns off out of sight)
      const ahead = this.at(c.s + c.dir * 4);
      if (!this.kOf(ahead.k).alive) { c.alive = false; c.deadT = rand(4, 10); continue; }
      const p = this.at(c.s);
      _m.compose(_p.set(p.x + p.nx * c.lane, p.y, p.z + p.nz * c.lane), _q.setFromAxisAngle(UP, p.yaw + (c.dir < 0 ? Math.PI : 0)), _s.set(1, 1, 1));
      c.k.body.setMatrixAt(c.i, _m); c.k.dark.setMatrixAt(c.i, _m);
    }
    for (const k of this.kinds) { k.body.instanceMatrix.needsUpdate = true; k.dark.instanceMatrix.needsUpdate = true; }
  }

  update(dt) {
    this.updateTraffic(dt);
    // spans coming down: the deck, its barriers and its embankment slump to rubble
    const falling = this.chunks.filter((c) => !c.alive && c.fall < 1);
    if (falling.length) for (const m of [this.mesh, this.lampMesh]) m.geometry.attributes.position.clearUpdateRanges();
    for (const c of falling) {
      c.fall = Math.min(1, c.fall + dt * 1.6);
      const k = c.fall * c.fall;
      for (const [mesh, y0, a, b] of [[this.mesh, this.y0, c.a, c.b], [this.lampMesh, this.ly0, c.la, c.lb]]) {
        if (b <= a) continue;
        const A = mesh.geometry.attributes.position, arr = A.array;
        // down and broken up: each triangle drops by its own amount, so the deck and barriers lie in cracked slabs
        for (let i = a; i < b; i++) { const j = Math.floor(i / 3), r = ((j * 2654435761) >>> 0) / 4294967296, y = y0[i * 3 + 1]; arr[i * 3 + 1] = y < 0.2 ? y : y * (1 - k) + k * (0.05 + 0.45 * r); }
        A.addUpdateRange(a * 3, (b - a) * 3); A.needsUpdate = true;
      }
    }
  }

  onBlast(x, y, z, reach, dmg) {
    for (const c of this.chunks) {
      if (!c.alive) continue;
      if (!c.pts.some((p) => Math.hypot(p.x - x, p.z - z) < reach + HALF && y < p.h + 4)) continue;
      c.hp -= dmg;
      if (c.hp > 0) continue;
      c.alive = false; c.fall = 0;
      for (const s of c.signs) s.visible = false;
      const m = c.pts[Math.floor(c.pts.length / 2)];
      G.fx.dust(m.x, m.h, m.z, 2.2); G.shake = Math.max(G.shake || 0, 0.6);
      G.ground && G.ground.scorch && G.ground.scorch(m.x, m.z, 7, 0.5);
    }
    if (this.cars) for (const c of this.cars) if (c.alive) {
      const p = this.at(c.s), px = p.x + p.nx * c.lane, pz = p.z + p.nz * c.lane;
      if (Math.hypot(px - x, pz - z) < reach + 1 && Math.abs(y - p.y) < 4) { c.alive = false; c.deadT = rand(20, 40); G.fx.explosion(px, p.y + 0.5, pz, 0.8, null, 'bomb'); }
    }
  }
}

const smooth = (t) => t * t * (3 - 2 * t);
// a sign: the face in front, plain galvanised grey behind
function signPanel(tex, w, h) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x8e9398, roughness: 0.6 }));
  back.rotation.y = Math.PI; back.position.z = -0.02; face.castShadow = true;
  g.add(face, back); return g;
}
// "Carlsbad Village Drive" -> "Carlsbad Village Dr", the way the signs have it
function short(n) {
  if (n === 'CA-76') return '76 East';
  return (n || 'Local Traffic').replace(/\bDrive\b/, 'Dr').replace(/\bAvenue\b/, 'Ave').replace(/\bBoulevard\b/, 'Blvd').replace(/\bStreet\b/, 'St').replace(/\bRoad\b/, 'Rd').replace(/\bNorth\b|\bSouth\b/, '').replace(/\s+/g, ' ').trim();
}
function exitTex(name) {
  return canvasTex(512, 200, (x, w, h) => {
    x.fillStyle = '#0b6b3a'; x.beginPath(); x.roundRect(0, 34, w, h - 34, 16); x.fill();
    x.beginPath(); x.roundRect(w - 150, 0, 150, 52, 10); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.roundRect(8, 42, w - 16, h - 50, 10); x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 30px Inter, Arial'; x.fillText('EXIT', w - 75, 28);
    x.font = '700 54px Inter, Arial'; x.fillText(name, w / 2, 112, w - 40);
  });
}

// SISIMIUT — SNOWMOBILE JUMP & TIME TRIAL. A groomed snowcross loop on the open snowfield east of town: a raised
// track with jumps built into it (a warm-up tabletop, a run of rollers, the big gap jump, a mega gap on the risky
// shortcut, a step-down), ice blocks and rocks to dodge, five checkpoint gates and a start / finish arch.
//   - the track is a real surface: groundAt() is the map's terrain or the track (whichever is higher), so the
//     snowmobile rides it, takes off from the lips and lands on the landing slopes with the shared Ride physics;
//   - jumps are measured from take-off to touch-down (distance, airtime), the landing is judged against the slope
//     (PERFECT / GOOD / SKETCHY / wipe-out); stunt points reward long jumps and clean landings, chain clean jumps
//     together, and pay less and less for taking off again and again from the same spot;
//   - time trial: the clock starts as you cross the line; every gate in order, or the lap doesn't count;
//   - stunt run: the same lap, scored on stunts.
import * as THREE from 'three';
import { G, clamp, rand } from '../core.js';
import { sfx } from '../audio.js';
import { Ride, ChaseCam } from './drive.js';

const M = 2.33, HW = 3.4, SKIRT = 5;            // metres per unit; the track's half width and its sloping sides
// the loop's line (clockwise seen from above), the shortcut, the gates, the features along it
const MAIN = [[106, 20], [106, -30], [112, -80], [135, -118], [168, -126], [188, -98], [187, -50], [180, -22], [157, -4], [144, 26], [153, 58], [177, 80], [165, 114], [135, 128], [110, 110], [103, 66]];
const ALT = { from: [180, -22], to: [177, 80] };   // the shortcut: straight across, over the mega gap
const GATES = [[106, 20], [118, -95], [186, -44], [175, 79], [146, 126], [104, 74]];   // 0: start / finish
const FEATS = [
  { at: [106, 2], kind: 'kick', h: 1.5, L: 7, T: 6, G: 0, Ld: 7 },                // warm-up tabletop
  { at: [109, -52], kind: 'roll', n: 4, len: 10, h: 0.5 },                         // rollers
  { at: [187, -92], kind: 'kick', h: 2.5, L: 12, T: 0, G: 10, Ld: 22 },            // the big gap
  { at: [146, 14], kind: 'kick', h: 2.0, L: 9, T: 0, G: 6, Ld: 12 },               // main branch: a medium gap
  { at: [180, -6], alt: true, kind: 'kick', h: 4.2, L: 13, T: 0, G: 17, Ld: 20 },  // shortcut: the mega gap
  { at: [158, 120], kind: 'kick', h: 1.6, L: 9, T: 6, G: 0, Ld: 18 },              // tabletop on the last stretch
];
const OBST = [[112, -72, 'ice'], [125, -108, 'rock'], [150, -126, 'ice'], [187, -58, 'rock'], [148, 44, 'ice'], [123, 124, 'rock'], [108, 92, 'ice']];

class Course {
  constructor() {
    const T = G.terrainH;
    this.T = (x, z) => (T ? T(x, z) : 0);
    const curve = new THREE.CatmullRomCurve3(MAIN.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const len = curve.getLength(), n = Math.round(len / 0.5);
    this.main = this.branch(curve.getSpacedPoints(n).slice(0, n), true);
    // the shortcut: from the main line's point at its start to the one at its end, a straight run
    const a = this.nearestOn(this.main, ALT.from[0], ALT.from[1]), b = this.nearestOn(this.main, ALT.to[0], ALT.to[1]);
    const pa = this.main.pts[a.i], pb = this.main.pts[b.i], d = Math.hypot(pb.x - pa.x, pb.z - pa.z), m = Math.round(d / 0.5);
    const alt = []; for (let i = 0; i <= m; i++) alt.push(new THREE.Vector3(pa.x + (pb.x - pa.x) * i / m, 0, pa.z + (pb.z - pa.z) * i / m));
    this.alt = this.branch(alt, false, pa.base, pb.base);
    this.alt.joinA = a.i; this.alt.joinB = b.i;
    // near its two ends the shortcut takes the main track's height, so the two surfaces meet without a step
    const AN = this.alt.pts.length;
    this.alt.pts.forEach((p, i) => { const endD = Math.min(i, AN - 1 - i) * 0.5, w = clamp((endD - 8) / 16, 0, 1); if (w >= 1) return; const q = this.nearestOn(this.main, p.x, p.z, true); p.base = q.p.base * (1 - w) + p.base * w; });
    for (const f of FEATS) { const br = f.alt ? this.alt : this.main, q = this.nearestOn(br, f.at[0], f.at[1]); (br.feats ||= []).push({ ...f, s0: br.pts[q.i].s }); }
    for (const br of [this.main, this.alt]) for (const p of br.pts) p.top = p.base + this.featH(br, p.s);
    this.length = this.main.length;
  }
  // a line of samples: position, direction, distance along, and a smoothed base height that sits on the snow
  branch(points, closed, h0, h1) {
    const pts = points.map((v) => ({ x: v.x, z: v.z }));
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], r = pts[(i - 1 + pts.length) % pts.length];
      const nx = closed || i < pts.length - 1 ? q : p, px = closed || i > 0 ? r : p;
      const tx = nx.x - px.x, tz = nx.z - px.z, tl = Math.hypot(tx, tz) || 1; p.tx = tx / tl; p.tz = tz / tl;
      if (i > 0) s += Math.hypot(p.x - r.x, p.z - r.z); p.s = s;
      // the highest snow across the track's width here
      let hi = -99; for (let o = -HW - 0.5; o <= HW + 0.51; o += 0.6) hi = Math.max(hi, this.T(p.x - p.tz * o, p.z + p.tx * o));
      p.raw = hi + 0.35;
    }
    // a groomed track draped over the snow like a rolling ball: every crest at least a 40-unit radius (gentle enough not
    // to throw a snowmobile off at full speed), never below the snow it crosses; then a light smoothing of the dips
    const N = pts.length, idx = (i) => (closed ? (i + N) % N : clamp(i, 0, N - 1)), R2 = 2 * 40, W = 80;
    for (let i = 0; i < N; i++) { let m = -99; for (let k = -W; k <= W; k++) { const ds = k * 0.5; m = Math.max(m, pts[idx(i + k)].raw - ds * ds / R2); } pts[i].base = m; }
    for (let pass = 0; pass < 3; pass++) {
      const b = pts.map((p) => p.base);
      for (let i = 0; i < N; i++) { let sum = 0; for (let k = -8; k <= 8; k++) sum += b[idx(i + k)]; pts[i].base = Math.max(sum / 17, pts[i].raw - 0.15); }
    }
    if (h0 != null) for (let i = 0; i < N; i++) { const t = i / (N - 1), e = Math.min(1, Math.min(t, 1 - t) * 6); pts[i].base = pts[i].base * e + (h0 * (1 - t) + h1 * t) * (1 - e); }
    // a lookup grid for the nearest sample
    const grid = new Map();
    pts.forEach((p, i) => { const k = `${Math.floor(p.x / 6)},${Math.floor(p.z / 6)}`; let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(i); });
    return { pts, grid, closed, length: s };
  }
  nearestOn(br, x, z, full = false) {
    const gx = Math.floor(x / 6), gz = Math.floor(z / 6); let best = -1, bd = 1e9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = br.grid.get(`${gx + a},${gz + b}`); if (!l) continue; for (const i of l) { const p = br.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } }
    if (best < 0) {
      if (!full) return null;                         // the ground: far from this line, nothing to add
      br.pts.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } });
    }
    const p = br.pts[best], lat = (x - p.x) * -p.tz + (z - p.z) * p.tx, along = (x - p.x) * p.tx + (z - p.z) * p.tz;
    // the height between this sample and the next (or previous), so ramps are smooth, not little steps
    const j = along >= 0 ? best + 1 : best - 1, n = br.pts.length, q = br.pts[br.closed ? (j + n) % n : clamp(j, 0, n - 1)];
    const top = p.top != null && q.top != null ? p.top + (q.top - p.top) * Math.min(1, Math.abs(along) / 0.5) : p.top;
    return { i: best, d: Math.sqrt(bd), lat, along, p, top };
  }
  // the jumps' shapes, added on top of the base
  featH(br, s) {
    let h = 0;
    for (const f of br.feats || []) {
      let u = s - f.s0; if (br.closed && u < -br.length / 2) u += br.length;
      if (u < 0) continue;
      if (f.kind === 'roll') { const tot = f.n * f.len; if (u < tot) h = Math.max(h, f.h * Math.sin(Math.PI * ((u % f.len) / f.len))); continue; }
      const L = f.L, T = f.T, Gp = f.G, Ld = f.Ld, hl = f.down ? f.h - f.down : f.h * 0.85;
      if (u < L) { const t = u / L; h = Math.max(h, f.h * t * (0.6 + 0.4 * t)); }            // the kicker, steepening to the lip
      else if (u < L + T) h = Math.max(h, f.h);                                               // tabletop
      else if (u < L + T + Gp) { const t = (u - L - T - Gp * 0.55) / (Gp * 0.45); h = Math.max(h, t > 0 ? hl * t * t : 0); }   // the gap, its far side sloping up to the landing
      else if (u < L + T + Gp + Ld) { const t = Math.max(0, (u - L - T - Gp - 2) / (Ld - 2)); h = Math.max(h, (Gp ? hl : f.h) * Math.pow(1 - t, 1.3)); }   // the landing (a short flat knuckle, then down)
    }
    return h;
  }
  // the ground the snowmobile rides on: the track, or the snow round it, whichever is higher
  groundAt(x, z) {
    let g = this.T(x, z);
    for (const br of [this.main, this.alt]) {
      const q = this.nearestOn(br, x, z); if (!q) continue;
      const d = Math.abs(q.lat), along = Math.sqrt(Math.max(0, q.d * q.d - q.lat * q.lat));
      if (!br.closed && (q.i === 0 || q.i === br.pts.length - 1) && along > 0.5) continue;   // beyond the shortcut's ends
      const top = q.top;
      if (d <= HW) g = Math.max(g, top);
      else if (d < HW + SKIRT) { const t = (d - HW) / SKIRT, ground = this.T(x, z); g = Math.max(g, top + (ground - top) * t * t * (3 - 2 * t)); }
    }
    return g;
  }
  // which part of the course you're on, for the gates and the respawns
  locate(x, z) {
    const a = this.nearestOn(this.main, x, z, true), b = this.nearestOn(this.alt, x, z, true);
    if (b && (!a || b.d < a.d)) return { br: this.alt, ...b };
    return a ? { br: this.main, ...a } : null;
  }
  // the meshes: the track ribbon with its sides, marker poles, gates, the start arch, obstacles
  build(scene) {
    const objs = [];
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#f2f5fa'; g.fillRect(0, 0, 128, 64);
      for (let y = 0; y < 64; y += 4) { g.fillStyle = 'rgba(130,155,190,.22)'; g.fillRect(25, y, 78, 1.5); }   // corduroy from the groomer
      g.fillStyle = '#2a6ae8'; g.fillRect(24, 0, 3, 64); g.fillRect(101, 0, 3, 64);                          // blue dye along the edges
      const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    })();
    const snow = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.85 });
    for (const br of [this.main, this.alt]) {
      const P = br.pts, N = P.length, offs = [-(HW + SKIRT), -HW, -HW * 0.33, HW * 0.33, HW, HW + SKIRT], V = [], UV = [], I = [];
      for (let i = 0; i < N; i++) {
        const p = P[i];
        for (let k = 0; k < offs.length; k++) {
          const o = offs[k], x = p.x - p.tz * o, z = p.z + p.tx * o;
          const y = Math.abs(o) > HW ? Math.max(this.T(x, z) - 0.08, p.top - 6) : p.top;
          V.push(x, y + 0.02, z); UV.push([0, 0.2, 0.4, 0.6, 0.8, 1][k], p.s / 3);
        }
      }
      const rows = br.closed ? N : N - 1, W = offs.length;
      for (let i = 0; i < rows; i++) { const j = (i + 1) % N; for (let k = 0; k < W - 1; k++) { const a = i * W + k, b = j * W + k; I.push(a, b, a + 1, a + 1, b, b + 1); } }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, snow); mesh.receiveShadow = true; scene.add(mesh); objs.push(mesh);
    }
    // marker poles along both edges (orange and blue)
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 5).translate(0, 0.65, 0), poleM = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5 }), poleB = new THREE.MeshStandardMaterial({ color: 0x1a5aff, roughness: 0.5 });
    const spots = [[], []];
    for (const br of [this.main, this.alt]) for (let i = 0; i < br.pts.length; i += 22) { const p = br.pts[i]; for (const [k, o] of [[0, -HW - 0.4], [1, HW + 0.4]]) spots[k].push(new THREE.Vector3(p.x - p.tz * o, p.top, p.z + p.tx * o)); }
    spots.forEach((list, k) => { const im = new THREE.InstancedMesh(pole, k ? poleB : poleM, list.length); list.forEach((v, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(v.x, v.y, v.z))); im.castShadow = true; scene.add(im); objs.push(im); });
    // gates: two posts and a banner across, numbered; the start / finish arch is checkered
    this.gates = GATES.map(([x, z], gi) => {
      const q = this.nearestOn(this.main, x, z), p = q.p, g = new THREE.Group();
      g.position.set(p.x, p.top, p.z); g.rotation.y = Math.atan2(-p.tx, -p.tz);
      const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x2 = c.getContext('2d');
      if (gi === 0) { for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) { x2.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x2.fillRect(i * 8, j * 8, 8, 8); } x2.fillStyle = '#ff6a1a'; x2.fillRect(78, 8, 100, 32); x2.fillStyle = '#fff'; x2.font = '800 22px Inter, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText('START', 128, 25); }
      else { x2.fillStyle = gi % 2 ? '#1a5aff' : '#ff6a1a'; x2.fillRect(0, 0, 256, 48); x2.fillStyle = '#fff'; x2.font = '800 26px Inter, sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(`CHECKPOINT ${gi}`, 128, 25); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const post = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.5 });
      for (const sx of [-HW - 0.3, HW + 0.3]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.2, 0.16).translate(0, 1.6, 0), post); m.position.x = sx; m.castShadow = true; g.add(m); }
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 + 0.6, 0.85), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.7 })); banner.position.y = 2.85; g.add(banner);
      // a glow strip on the ground across the line
      const line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 0.35).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: gi === 0 ? 0xffffff : 0xffd46b, transparent: true, opacity: 0.7, depthWrite: false })); line.position.y = 0.04; g.add(line);
      scene.add(g); objs.push(g);
      return { i: gi, x: p.x, z: p.z, tx: p.tx, tz: p.tz, s: p.s, mesh: g, line };
    });
    // obstacles: ice blocks and rocks sitting on the track's edge lanes
    this.obst = OBST.map(([x, z, kind]) => {
      const q = this.nearestOn(this.main, x, z), p = q.p, lat = (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 2.4), ox = p.x - p.tz * lat, oz = p.z + p.tx * lat;
      const m = kind === 'ice' ? new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }))
        : new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: 0x5a5c62, roughness: 0.9 }));
      m.position.set(ox, p.top + (kind === 'ice' ? 0.45 : 0.35), oz); m.rotation.y = rand(0, 3); m.castShadow = true; scene.add(m); objs.push(m);
      return { x: ox, z: oz, r: kind === 'ice' ? 0.75 : 0.7, top: p.top + 0.9 };
    });
    this.objs = objs;
  }
  dispose(scene) { for (const o of this.objs || []) { scene.remove(o); o.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }); } }
}

export class SnowmobileTrial {
  constructor(hub, def) { this.hub = hub; this.def = def; }
  start(mode) {
    if (G.mapName !== 'greenland') { this.hub.exit(); return; }
    this.mode = mode;
    this.course = new Course(); this.course.build(G.scene);
    const C = this.course, g0 = C.gates[0];
    this.ride = new Ride(G.scene, (x, z) => C.groundAt(x, z), { kind: 'sled', paint: 0xd8202a, tune: { vmax: 22, boostMax: 27, accel: 12, boostAccel: 16, gravity: 16 } });
    this.ride.refill = 0.06;
    // behind the start line, facing along the track
    const sx = g0.x - g0.tx * 7, sz = g0.z - g0.tz * 7;
    this.ride.place(sx, sz, Math.atan2(-g0.tx, -g0.tz), 0);
    this.chase = new ChaseCam(G.camera); this.chase.dist = 4.2; this.chase.h = 1.5;
    Object.assign(this, { go: -3.2, lastCount: 3, started: false, t: 0, next: 1, missed: new Set(), wipeouts: 0, stunt: 0, chain: 0, jumps: [], bestJump: 0, bestAir: 0, perfects: 0, takeoffs: [], over: false, respawnT: 0, ghost: 0, topSpeed: 0, offT: 0 });
    this.prevA = C.gates.map(() => null);
    this.buildHud();
    this.hub.count('3');
  }
  buildHud() {
    const el = this.hub.gameEl;
    el.innerHTML = `<style>
      .sl-top{position:absolute;left:50%;top:calc(4.2vh + 64px);transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)}
      .sl-time{font:900 34px Inter;font-variant-numeric:tabular-nums;letter-spacing:.02em}
      .sl-sub{display:flex;gap:14px;justify-content:center;font:800 10.5px Inter;letter-spacing:.22em;color:#7ff0c8;margin-top:3px}
      .sl-sub .warn{color:#ff8a6a}
      .sl-air{position:absolute;left:50%;top:30%;transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 0 14px rgba(120,200,255,.9),0 2px 4px rgba(0,0,0,.6);opacity:0;transition:opacity .15s}
      .sl-air.on{opacity:1}
      .sl-air b{display:block;font:900 30px Inter;font-variant-numeric:tabular-nums} .sl-air span{font:800 11px Inter;letter-spacing:.22em}
      .sl-spd{position:absolute;left:50%;bottom:calc(4.2vh + 16px);transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.7)}
      .sl-spd b{font:900 36px Inter;font-variant-numeric:tabular-nums} .sl-spd small{font:800 10px Inter;letter-spacing:.24em;margin-left:4px;color:rgba(255,255,255,.75)}
      .sl-boost{width:150px;height:5px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden;margin:4px auto 0} .sl-boost em{display:block;height:100%;background:linear-gradient(90deg,#3ab0ff,#7ff0ff)}
      .sl-tgt{position:absolute;right:16px;top:calc(4.2vh + 64px);text-align:right;font:700 10px Inter;letter-spacing:.16em;color:rgba(255,255,255,.85);text-shadow:0 1px 3px rgba(0,0,0,.7);line-height:1.8}
      .sl-tgt i{font-style:normal;display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
    </style>
    <div class="sl-top"><div class="sl-time">0:00.00</div><div class="sl-sub"><span class="cp"></span><span class="st"></span></div></div>
    <div class="sl-air"><b>0 m</b><span></span></div>
    <div class="sl-tgt"></div>
    <div class="sl-spd"><b>0</b><small>KM/H</small><div class="sl-boost"><em></em></div></div>`;
    this.el = { time: el.querySelector('.sl-time'), cp: el.querySelector('.cp'), st: el.querySelector('.st'), air: el.querySelector('.sl-air'), airB: el.querySelector('.sl-air b'), airS: el.querySelector('.sl-air span'), spd: el.querySelector('.sl-spd b'), bbar: el.querySelector('.sl-boost em'), tgt: el.querySelector('.sl-tgt') };
    const med = this.def.medals[this.mode], col = { gold: '#ffd34a', silver: '#d6dde4', bronze: '#d08a4a' };
    const f = (v) => (med.unit === 's' ? fmtTime(v) : Math.round(v).toLocaleString());
    this.el.tgt.innerHTML = ['gold', 'silver', 'bronze'].map((k) => `<div><i style="background:${col[k]}"></i>${k.toUpperCase()} ${f(med[k])}</div>`).join('');
  }
  key(e, down) {
    (this.keys ||= {})[e.code] = down;
    if (down && e.code === 'KeyV') this.chase.zoom = this.chase.zoom > 1.1 ? 0.8 : this.chase.zoom < 0.9 ? 1 : 1.3;
    return true;
  }
  wheel(e) { this.chase.zoom = clamp(this.chase.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.7, 1.8); }
  where() { return this.ride ? this.ride.pos : null; }

  update(dt) {
    if (!this.ride) return;
    const k = this.keys || {}, R = this.ride;
    if (this.go < 0) {
      this.go += dt;
      const n = Math.ceil(-this.go); if (n < this.lastCount && n > 0) { this.hub.count(String(n)); this.lastCount = n; }
      if (this.go >= 0) this.hub.count('GO');
      R.update(dt, { throttle: 0, brake: 1, hold: true, steer: 0 });
      this.hudUpdate(); return;
    }
    if (this.over) { R.update(dt, { throttle: 0, brake: 0.5, steer: 0 }); return; }
    if (this.started) this.t += dt;
    if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) this.respawn(); this.hudUpdate(); return; }
    this.ghost = Math.max(0, this.ghost - dt);
    const fwd = k.KeyW || k.ArrowUp ? 1 : 0, back = k.KeyS || k.ArrowDown ? 1 : 0;
    const landed = R.update(dt, { throttle: fwd, brake: back, steer: (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), hand: !!k.Space, boost: !!(k.ShiftLeft || k.ShiftRight), leanFwd: fwd - back });
    this.topSpeed = Math.max(this.topSpeed, R.speed);
    if (landed) this.landing(landed);
    if (R.air) this.airHud(); else this.el.air.classList.remove('on');
    this.gatesCheck();
    if (this.ghost <= 0) this.obstacles();
    // too far off the course: back on it
    const loc = this.course.locate(R.pos.x, R.pos.z);
    if (!loc || loc.d > 28) { this.offT += dt; if (this.offT > 2.5) { this.hub.pop('BACK TO THE COURSE', 'rgba(255,140,90,.9)'); this.wipeout(true); } } else this.offT = 0;
    this.hudUpdate();
  }
  // in the air: the provisional numbers
  airHud() {
    const R = this.ride, from = R.takeoff; if (!from) return;
    const d = Math.hypot(R.pos.x - from.x, R.pos.z - from.z) * M;
    if (R.airT < 0.3) return;
    this.el.air.classList.add('on');
    this.el.airB.textContent = `${d.toFixed(1)} m`;
    this.el.airS.textContent = `AIR ${R.airT.toFixed(2)} s · +${this.jumpPoints(d, R.airT, 1)}`;
  }
  jumpPoints(dm, air, q) { return Math.round((dm * 10 + air * 120) * q * (1 + 0.25 * Math.min(this.chain, 8))); }
  // touch down: judge it, score it
  landing(L) {
    const R = this.ride, dm = Math.hypot(L.to.x - L.from.x, L.to.z - L.from.z) * M;
    if (L.airT < 0.4 || dm < 4) return;                                   // a hop, not a jump
    const grade = L.err > 0.75 || L.impact > 22 ? 'crash' : L.err < 0.12 ? 'perfect' : L.err < 0.32 ? 'good' : 'sketchy';
    if (grade === 'crash') { this.hub.pop('WIPEOUT', 'rgba(255,80,80,.95)', true); this.chain = 0; this.wipeout(false); return; }
    // only jumps off the course itself count, and the same take-off again and again pays less each time
    const onCourse = (() => { const q = this.course.locate(L.from.x, L.from.z); return q && q.d < HW + 2; })();
    if (!onCourse) { this.hub.pop(`${dm.toFixed(0)} M · OFF COURSE`, 'rgba(200,220,255,.8)'); return; }
    const recent = this.takeoffs.filter((q) => this.t - q.t < 40 && Math.hypot(q.x - L.from.x, q.z - L.from.z) < 10).length;
    this.takeoffs.push({ x: L.from.x, z: L.from.z, t: this.t }); if (this.takeoffs.length > 20) this.takeoffs.shift();
    const q = { perfect: 1.5, good: 1, sketchy: 0.5 }[grade] * Math.pow(0.3, recent);
    if (grade !== 'sketchy') this.chain++; else this.chain = 0;
    const pts = this.jumpPoints(dm, L.airT, q);
    this.stunt += pts;
    if (grade === 'perfect') this.perfects++;
    const newBest = dm > this.bestJump && recent === 0; if (recent === 0) { this.bestJump = Math.max(this.bestJump, dm); this.bestAir = Math.max(this.bestAir, L.airT); }
    this.jumps.push({ dm, air: L.airT, grade, pts });
    const col = grade === 'perfect' ? 'rgba(120,255,200,.95)' : grade === 'good' ? 'rgba(160,210,255,.95)' : 'rgba(255,200,120,.9)';
    this.hub.pop(`${grade.toUpperCase()} LANDING  +${pts}`, col, grade === 'perfect');
    if (newBest && dm > 20) { const pb = G.progress && G.progress.P.records.sled_jump; if (!pb || dm > pb.value) this.hub.pop(`${dm.toFixed(1)} M · LONGEST YET`, 'rgba(255,212,107,.95)'); }
    if (this.chain >= 2) this.hub.pop(`${this.chain} CLEAN IN A ROW`, 'rgba(255,212,107,.9)');
    sfx.thump && sfx.thump(R.pos.x, R.pos.z, Math.min(1, L.impact / 14));
    this.chase.shake = Math.max(this.chase.shake, Math.min(0.8, L.impact / 20));
    if (G.fx) for (let i = 0; i < 4; i++) G.fx.smokePuff(R.pos.x + rand(-0.6, 0.6), R.pos.y + 0.1, R.pos.z + rand(-0.6, 0.6), 0.5, 0.95, 1.2);
  }
  // a crash: the rider tumbles; back on the track where it happened a moment later (the clock keeps running)
  wipeout(quiet) {
    const R = this.ride;
    this.wipeouts++; this.chain = 0;
    if (!quiet) { G.slowmo && G.slowmo(1.1, 0.22); sfx.crash(R.pos.x, R.pos.z, 0.5); this.chase.shake = 1; if (G.fx) { G.fx.dust(R.pos.x, R.pos.y + 0.2, R.pos.z, 1.4); for (let i = 0; i < 5; i++) G.fx.smokePuff(R.pos.x + rand(-1, 1), R.pos.y + 0.2, R.pos.z + rand(-1, 1), 0.7, 0.95, 2); } }
    R.spin = (Math.random() < 0.5 ? -1 : 1) * rand(4, 7); R.v *= 0.3;
    this.respawnT = quiet ? 0.01 : 1.3;
  }
  respawn() {
    const R = this.ride, q = this.course.locate(R.pos.x, R.pos.z);
    R.spin = 0;
    if (q) R.place(q.p.x, q.p.z, Math.atan2(-q.p.tx, -q.p.tz), 6); else { const g = this.course.gates[0]; R.place(g.x, g.z, Math.atan2(-g.tx, -g.tz), 0); }
    // not on a jump's face or in a gap: back a few metres to the flat
    this.ghost = 1.2; this.offT = 0;
  }
  obstacles() {
    const R = this.ride;
    for (const o of this.course.obst) {
      if (R.pos.y > o.top) continue;
      if (Math.hypot(R.pos.x - o.x, R.pos.z - o.z) < o.r + R.P.halfW) {
        if (R.speed > 9) { this.hub.pop('CRASHED INTO THE ' + (o.r > 0.72 ? 'ICE' : 'ROCK'), 'rgba(255,80,80,.95)', true); this.wipeout(false); }
        else { const a = Math.atan2(R.pos.z - o.z, R.pos.x - o.x); R.pos.x = o.x + Math.cos(a) * (o.r + R.P.halfW + 0.02); R.pos.z = o.z + Math.sin(a) * (o.r + R.P.halfW + 0.02); R.v *= 0.5; }
        return;
      }
    }
  }
  // the gates: crossing a line (within the track's width, going the right way) counts
  gatesCheck() {
    const R = this.ride, C = this.course;
    for (const g of C.gates) {
      const a = (R.pos.x - g.x) * g.tx + (R.pos.z - g.z) * g.tz, b = (R.pos.x - g.x) * -g.tz + (R.pos.z - g.z) * g.tx;
      const prev = this.prevA[g.i]; this.prevA[g.i] = a;
      if (prev == null || !(prev < 0 && a >= 0) || Math.abs(b) > HW + 1.5 || Math.abs(a) > 4) continue;
      this.crossed(g);
    }
  }
  crossed(g) {
    const N = this.course.gates.length;
    if (g.i === 0) {
      if (!this.started) { this.started = true; this.t = 0; this.hub.pop('GO GO GO', 'rgba(120,255,200,.95)', true); return; }
      if (this.next >= N) { this.finish(); return; }
      // crossing the line early: the gates still missing
      for (let i = this.next; i < N; i++) this.missed.add(i);
      this.finish(); return;
    }
    if (!this.started) return;
    if (this.missed.has(g.i)) { this.missed.delete(g.i); this.hub.pop(`CHECKPOINT ${g.i} · MADE UP`, 'rgba(120,255,200,.9)'); return; }
    if (g.i < this.next) return;
    for (let i = this.next; i < g.i; i++) { this.missed.add(i); this.hub.pop(`MISSED CHECKPOINT ${i}`, 'rgba(255,90,90,.95)', true); }
    this.next = g.i + 1;
    const split = fmtTime(this.t);
    this.hub.pop(`CHECKPOINT ${g.i}  ${split}`, 'rgba(255,212,107,.95)');
    g.line.material.color.set(0x6ff0c4);
  }
  finish() {
    if (this.over) return;
    this.over = true; this.el.air.classList.remove('on');
    const valid = this.missed.size === 0, clean = valid && this.wipeouts === 0;
    const kmh = (u) => Math.round(u * M * 3.6);
    const lines = [['Lap time', fmtTime(this.t)], ['Stunt score', this.stunt.toLocaleString()], ['Jumps landed', this.jumps.length], ['Perfect landings', this.perfects], ['Longest jump', `${this.bestJump.toFixed(1)} m`], ['Longest airtime', `${this.bestAir.toFixed(2)} s`], ['Wipeouts', this.wipeouts], ['Checkpoints', `${this.course.gates.length - 1 - this.missed.size} / ${this.course.gates.length - 1}`], ['Top speed', `${kmh(this.topSpeed)} km/h`]];
    const records = valid ? { sled_time: +this.t.toFixed(2), sled_jump: +this.bestJump.toFixed(1), sled_stunt: this.stunt } : {};
    if (clean) records.sled_clean = +this.t.toFixed(2);
    const trial = this.mode === 'trial';
    setTimeout(() => this.hub.finish({
      valid, invalidWhy: `Missed checkpoint${this.missed.size > 1 ? 's' : ''} ${[...this.missed].sort().join(', ')}: this lap doesn't count.`,
      title: trial ? 'SNOWMOBILE · TIME TRIAL' : 'SNOWMOBILE · STUNT RUN',
      headline: trial ? fmtTime(this.t) : this.stunt.toLocaleString(), headlineLabel: trial ? (clean ? 'CLEAN LAP' : `${this.wipeouts} WIPEOUT${this.wipeouts === 1 ? '' : 'S'}`) : 'STUNT POINTS',
      medalValue: trial ? this.t : this.stunt, lines, records,
      evidence: { t: +this.t.toFixed(2), cps: this.course.gates.length - 1, jumps: this.jumps.length, wipe: this.wipeouts, best: +this.bestJump.toFixed(1) },
      xp: Math.min(80, 20 + this.jumps.length * 3 + this.perfects * 4),
      stats: { laps: 1, jumps: this.jumps.length, perfects: this.perfects, clean: clean ? 1 : 0 },
    }), 400);
  }
  hudUpdate() {
    const e = this.el, R = this.ride; if (!e) return;
    e.time.textContent = fmtTime(this.started ? this.t : 0);
    const N = this.course.gates.length - 1;
    e.cp.innerHTML = this.missed.size ? `<span class="warn">MISSED CP ${[...this.missed].join(', ')}</span>` : `CHECKPOINT ${Math.min(this.next - 1, N)} / ${N}`;
    e.st.textContent = `STUNT ${this.stunt.toLocaleString()}${this.chain > 1 ? ` · x${(1 + 0.25 * Math.min(this.chain, 8)).toFixed(2)}` : ''}`;
    e.spd.textContent = Math.round(R.speed * M * 3.6); e.bbar.style.width = `${R.boost * 100}%`;
  }
  applyCamera(dt) {
    if (!this.ride) return;
    this.chase.update(dt, this.ride, G.post, G.scene);
    this.hub.followSun(this.ride.pos.x, this.ride.pos.z);
  }
  minimap(c, s, p, C) {
    const K = this.course; c.lineCap = 'round'; c.lineJoin = 'round';
    const line = (br, w, col, dash) => { c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); br.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.z) : c.moveTo(q.x, q.z))); if (br.closed) c.closePath(); c.stroke(); c.setLineDash([]); };
    line(K.main, HW * 2 + 2.5 / s, C.routeEdge); line(K.main, HW * 2, C.route);
    line(K.alt, HW * 1.4, 'rgba(10,132,255,.55)', [4, 3]);
    for (const g of K.gates) { c.fillStyle = g.i === this.next || (g.i === 0 && this.next >= K.gates.length) ? '#ffd46b' : '#ffffff'; c.beginPath(); c.arc(g.x, g.z, 3.2 / s * 2.5, 0, 6.283); c.fill(); }
  }
  dispose() {
    if (this.course) this.course.dispose(G.scene);
    if (this.ride) { this.ride.dispose(); this.ride = null; }
  }
}
export const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };

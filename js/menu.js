// Title screen: Earth. A large interactive globe floating in clean space is the map picker: drag to spin it,
// scroll or pinch to zoom, and each Tiny World sits on its real place with a flag pin (Gaslamp in San Diego,
// Chicago, La Playa on Mexico's Pacific coast). Hovering a pin (or a row in the destination list) lifts it, names
// it and turns the globe toward it; clicking flies the camera down through the clouds into the city, then hands
// over to the real map load (the original menu buttons stay the source of truth, so load() is untouched), and the
// game camera finishes the descent onto the miniature. Light and dark themes, saved per browser.
// It has its own small renderer, which is stopped and disposed as soon as the game starts.
import * as THREE from 'three';
import { viewH } from './core.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const D2R = Math.PI / 180;

// ---------- shared bits ----------
function tint(geo, c) {
  const g = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------- the stage ----------
// the title: one span per letter; each letter's nearness to the cursor (--p) drives its lift and glow
// ---------- the little Earth that stands in for the O of WORLD ----------
// Coarse coastlines (lon, lat) rasterised once into a land mask; each frame is an orthographic render of the mask
// with a drifting cloud layer, day/night shading, ocean glint and an atmosphere rim. It spins on its own; hover turns
// it toward the cursor, dragging spins it, a click flings it.
const LAND = [
  [[-168, 66], [-162, 70], [-140, 70], [-120, 71], [-95, 72], [-80, 73], [-62, 66], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 26], [-82, 29], [-90, 30], [-97, 27], [-97, 21], [-92, 18], [-87, 21], [-84, 15], [-83, 10], [-78, 8], [-80, 7], [-86, 11], [-92, 14], [-105, 20], [-110, 24], [-112, 30], [-117, 32], [-124, 40], [-124, 48], [-130, 55], [-140, 60], [-152, 59], [-165, 55], [-160, 60], [-166, 62]],
  [[-55, 60], [-44, 60], [-20, 70], [-18, 80], [-35, 83], [-60, 82], [-72, 77], [-58, 70]],
  [[-78, 8], [-72, 12], [-62, 10], [-50, 0], [-35, -6], [-39, -15], [-48, -26], [-58, -35], [-65, -42], [-68, -52], [-72, -54], [-75, -45], [-72, -30], [-71, -18], [-76, -14], [-81, -5], [-80, 0]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 57], [5, 58], [8, 63], [15, 68], [25, 71], [40, 68], [60, 70], [70, 73], [80, 72], [100, 77], [112, 74], [130, 72], [150, 71], [170, 70], [180, 66], [178, 64], [163, 60], [155, 58], [142, 52], [140, 46], [132, 43], [128, 38], [126, 35], [121, 40], [122, 31], [120, 23], [110, 20], [106, 11], [103, 1], [100, 6], [98, 16], [94, 17], [90, 22], [80, 15], [77, 8], [73, 20], [66, 25], [57, 26], [56, 24], [59, 22], [52, 17], [44, 12], [42, 16], [35, 28], [33, 31], [36, 36], [27, 37], [26, 40], [23, 36], [20, 40], [13, 45], [16, 41], [12, 38], [8, 44], [3, 43], [0, 39], [-6, 36]],
  [[-17, 21], [-16, 12], [-8, 4], [5, 5], [9, 4], [9, -1], [13, -10], [12, -17], [15, -27], [18, -34], [26, -34], [33, -26], [35, -18], [40, -10], [39, -4], [43, 0], [51, 11], [43, 12], [37, 19], [33, 28], [32, 31], [20, 32], [10, 37], [0, 36], [-6, 35], [-10, 30], [-14, 26]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -27], [150, -37], [141, -38], [135, -35], [129, -32], [115, -34]],
  [[-180, -70], [180, -70], [180, -90], [-180, -90]],
  [[-5, 50], [1, 51], [0, 54], [-3, 58], [-6, 57], [-5, 54]], [[-24, 64], [-14, 64], [-15, 66], [-22, 66]],
  [[130, 31], [135, 34], [141, 36], [142, 43], [140, 41], [136, 36], [131, 34]],
  [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]], [[95, 5], [106, -6], [102, -4]], [[131, -1], [141, -3], [150, -10], [141, -9]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]], [[172, -34], [178, -38], [174, -42], [167, -46], [172, -41]],
];
const MW = 180, MH = 90;
let titleHover = false;
let EARTH = null;
function earthMaps() {
  if (EARTH) return EARTH;
  const inside = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const raw = new Float32Array(MW * MH), land = new Float32Array(MW * MH), cloud = new Float32Array(MW * MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) { const lon = -180 + (i + 0.5) * 2, lat = 90 - (j + 0.5) * 2; raw[j * MW + i] = LAND.some((p) => inside(lon, lat, p)) ? 1 : 0; }
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {   // soften the coast a little
    let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += raw[Math.min(MH - 1, Math.max(0, j + dj)) * MW + (i + di + MW) % MW];
    land[j * MW + i] = s / 9;
  }
  // clouds: a few octaves of smoothed random lattice noise that wraps around in longitude, banded by latitude
  const oct = (n) => { const g = new Float32Array(n * (n >> 1 || 1)); for (let k = 0; k < g.length; k++) g[k] = Math.random(); return g; };
  const layers = [8, 16, 32].map((n) => ({ n, m: n >> 1, g: oct(n) }));
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    let v = 0, a = 0.55;
    for (const { n, m, g } of layers) {
      const x = i / MW * n, y = j / MH * m, x0 = Math.floor(x), y0 = Math.min(m - 1, Math.floor(y)), fx = x - x0, fy = y - y0;
      const s = (xx, yy) => g[Math.min(m - 1, yy) * n + (xx % n)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      v += a * ((s(x0, y0) * (1 - sx) + s(x0 + 1, y0) * sx) * (1 - sy) + (s(x0, y0 + 1) * (1 - sx) + s(x0 + 1, y0 + 1) * sx) * sy); a *= 0.5;
    }
    const lat = Math.abs(90 - (j + 0.5) * 2), band = 0.75 + 0.25 * Math.cos(lat / 90 * Math.PI * 3);
    cloud[j * MW + i] = Math.max(0, Math.min(1, (v * band - 0.5) * 3.2));
  }
  return (EARTH = { land, cloud });
}
function miniEarth(host) {
  const cv = document.createElement('canvas'); host.appendChild(cv);
  const cx = cv.getContext('2d');
  const st = { rot: -1.9, vel: 0.22, tilt: 0.36, tiltT: 0.36, hover: 0, hoverT: 0, drag: null, mx: 0, my: 0, clouds: 0 };
  let img = null, S = 0;
  const size = () => {
    const s = Math.max(24, Math.min(160, Math.round(host.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))));
    if (s !== S) { S = cv.width = cv.height = s; img = cx.createImageData(S, S); }
  };
  const L = (() => { const v = [-0.55, 0.45, 0.7], n = Math.hypot(...v); return v.map((a) => a / n); })();
  function draw() {
    const { land, cloud } = earthMaps(), d = img.data, ct = Math.cos(st.tilt), sn = Math.sin(st.tilt), R = S / 2, h = st.hover;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const o = (py * S + px) * 4, nx = (px + 0.5 - R) / R, ny = (R - py - 0.5) / R, r2 = nx * nx + ny * ny;
      if (r2 > 1) { d[o + 3] = 0; continue; }
      const nz = Math.sqrt(1 - r2);
      // view-space normal -> globe space: tilt the axis toward the viewer, then spin
      const y = ny * ct + nz * sn, z = nz * ct - ny * sn;
      const lat = Math.asin(Math.max(-1, Math.min(1, y))), lon = Math.atan2(nx, z) + st.rot;
      let u = (lon / (Math.PI * 2) + 0.5) % 1; if (u < 0) u += 1;
      const i = Math.min(MW - 1, Math.floor(u * MW)), j = Math.min(MH - 1, Math.floor((0.5 - lat / Math.PI) * MH));
      const ld = land[j * MW + i], alat = Math.abs(lat) * 57.3;
      let uc = u + st.clouds; uc -= Math.floor(uc);
      const cl = cloud[j * MW + Math.min(MW - 1, Math.floor(uc * MW))];
      // surface colour: ocean, then land (green, drier toward the subtropics, ice at the poles)
      const dry = Math.max(0, 1 - Math.abs(alat - 24) / 12), ice = Math.min(1, Math.max(0, (alat - 62) / 8));
      let r = 18 + 20 * h, g = 62 + 24 * h, b = 128 + 30 * h;
      const lr = 70 + 110 * dry, lg = 118 + 40 * dry - 20 * (alat / 90), lb = 58 + 40 * dry;
      r += (lr - r) * ld; g += (lg - g) * ld; b += (lb - b) * ld;
      r += (238 - r) * ice; g += (244 - g) * ice; b += (250 - b) * ice;
      r += (245 - r) * cl * 0.85; g += (247 - g) * cl * 0.85; b += (250 - b) * cl * 0.85;
      // light: day side lit from the upper left, a soft terminator, glint on open water, blue rim
      const dl = nx * L[0] + ny * L[1] + nz * L[2], lit = 0.16 + 0.95 * Math.max(0, Math.min(1, dl * 1.4 + 0.25));
      const hx = L[0], hy = L[1], hz = L[2] + 1, hn = Math.hypot(hx, hy, hz), spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hn), 40) * (1 - ld) * (1 - cl) * 120;
      const rim = Math.pow(1 - nz, 2.4) * (0.75 + 0.5 * h);
      r = r * lit + spec + (120 - r * lit) * rim; g = g * lit + spec + (190 - g * lit) * rim; b = b * lit + spec + (255 - b * lit) * rim;
      d[o] = r; d[o + 1] = g; d[o + 2] = b;
      d[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * R * 1.2);   // anti-aliased edge
    }
    cx.putImageData(img, 0, 0);
  }
  let last = performance.now();
  (function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    requestAnimationFrame(frame);
    if (!host.isConnected || host.offsetParent === null) return;   // the menu is gone or hidden: nothing to draw
    size();
    st.hover += (st.hoverT - st.hover) * Math.min(1, dt * 6);
    if (!st.drag) {
      // at rest a slow spin; under the cursor the globe turns to face it (the further off-centre, the faster)
      const want = st.hoverT ? 0.22 + st.mx * 2.4 : 0.22;
      st.vel += (want - st.vel) * Math.min(1, dt * (Math.abs(st.vel - want) > 2 ? 0.9 : st.hoverT ? 3 : 0.8));   // flings coast down
      st.rot += st.vel * dt;
      st.tiltT = st.hoverT ? 0.36 - st.my * 0.55 : 0.36;
    }
    st.tilt += (st.tiltT - st.tilt) * Math.min(1, dt * 4);
    st.clouds += dt * 0.004;
    draw();
  })(last);
  const local = (e) => { const r = host.getBoundingClientRect(); return [((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2]; };
  host.addEventListener('pointerenter', () => { st.hoverT = 1; });
  host.addEventListener('pointerleave', () => { if (!st.drag) st.hoverT = 0; });
  host.addEventListener('pointermove', (e) => {
    [st.mx, st.my] = local(e);
    if (st.drag) {
      const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y, w = host.getBoundingClientRect().width;
      st.rot -= dx / w * 2.6; st.tiltT = st.tilt = Math.max(-1.1, Math.min(1.1, st.tilt + dy / w * 2));
      st.vel = -dx / w * 2.6 / Math.max(0.008, (e.timeStamp - st.drag.t) / 1000);
      st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: st.drag.moved + Math.abs(dx) + Math.abs(dy) };
    }
  });
  host.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); host.setPointerCapture(e.pointerId); host.classList.add('drag'); st.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: 0 }; });
  const up = (e) => {
    if (!st.drag) return;
    if (st.drag.moved < 3) st.vel += (st.mx < 0 ? -1 : 1) * 7;   // a click flings it
    st.vel = Math.max(-14, Math.min(14, st.vel));
    st.drag = null; host.classList.remove('drag');
    const r = host.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) st.hoverT = 0;
  };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('click', (e) => e.stopPropagation());
}

// ---------- a little International Space Station that drifts across the sky now and then ----------
// Truss along x, four pairs of solar wings (copper-gold cells on dark frames), white radiators hanging below the
// truss, and the cluster of pressurised modules in the middle. About 2.4 units across.
function makeISS() {
  const g = new THREE.Group(), mats = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial({ transparent: true, ...o }); mats.push(m); return m; };
  const metal = M({ color: 0xb9bec6, metalness: 0.7, roughness: 0.35 }), white = M({ color: 0xe9ebee, roughness: 0.6 });
  const cells = M({ color: 0xb07a2a, metalness: 0.55, roughness: 0.35, emissive: 0x2a1a06, side: THREE.DoubleSide });
  const frame = M({ color: 0x2a2f38, metalness: 0.6, roughness: 0.5 });
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.BoxGeometry(2.4, 0.06, 0.06), metal);                                   // the main truss
  for (const x of [-1.1, -0.72, 0.72, 1.1]) {
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), metal, x, 0, 0);               // rotary joints
    for (const zs of [-1, 1]) {                                                           // a wing pair either side of the truss
      const w = add(new THREE.BoxGeometry(0.2, 0.004, 0.72), cells, x, 0, zs * 0.44);
      add(new THREE.BoxGeometry(0.012, 0.012, 0.74), frame, x, 0.004, zs * 0.44);       // the mast down the middle of the wing
      w.rotation.x = 0.12 * zs;
    }
  }
  for (const x of [-0.38, 0.38]) add(new THREE.BoxGeometry(0.14, 0.004, 0.42), white, x, -0.06, -0.24).rotation.x = Math.PI / 2;   // radiators
  const mod = (len, r, x, y, z, rx = 0, rz = 0) => { const o = add(new THREE.CylinderGeometry(r, r, len, 12), white, x, y, z); o.rotation.set(rx, 0, rz); return o; };
  mod(0.9, 0.055, 0, -0.08, 0, Math.PI / 2);                                           // the long module stack, fore and aft
  mod(0.34, 0.05, 0, -0.08, 0, 0, Math.PI / 2);                                         // a node crossing it
  mod(0.22, 0.045, 0.12, -0.08, 0.3, 0, Math.PI / 2); mod(0.22, 0.045, -0.12, -0.08, 0.3, 0, Math.PI / 2);   // labs off the front node
  for (const zs of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.003, 0.2), cells, 0, -0.08, zs * 0.62);        // the service module's small wings
  const blink = add(new THREE.SphereGeometry(0.018, 8, 6), M({ color: 0xff5a4a, emissive: 0xff2a1a, emissiveIntensity: 2 }), 1.2, 0, 0);
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  return { g, mats, blink };
}

// ---------- stars behind the neutral room ----------
// Mostly faint pinpricks with a few brighter ones (soft halo, faint cool or warm tint), thicker along a faint diagonal
// band like the Milky Way; a handful twinkle slowly. Every few seconds a shooting star streaks across. Drawn at
// ~20 fps (full rate while a meteor is in flight) and only while the menu is up.
function starfield(menu, after) {
  const cv = document.createElement('canvas'); cv.className = 'stars'; after.after(cv);
  const cx = cv.getContext('2d');
  let stars = [], W = 0, H = 0, dpr = 1;
  const build = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(viewH() * dpr);
    const n = Math.round(Math.min(520, innerWidth * viewH() / 3200)); stars = [];
    for (let i = 0; i < n; i++) {
      let x = Math.random(), y = Math.random();
      if (i % 3 === 0) {   // a third of them gather along the band (lower left to upper right), with a soft falloff
        const t = Math.random(), off = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
        x = t; y = 0.95 - t * 0.8 + off;
        if (y < 0 || y > 1) continue;
      }
      const big = Math.random() < 0.06, tint = Math.random();
      stars.push({ x: x * W, y: y * H, r: (big ? 1.1 + Math.random() * 0.7 : 0.45 + Math.random() * 0.6) * dpr, a: big ? 0.55 + Math.random() * 0.3 : 0.22 + Math.random() * 0.45,
        c: tint < 0.18 ? '200,220,255' : tint > 0.9 ? '255,236,210' : '255,255,255', big,
        tw: Math.random() < 0.22 ? 0.6 + Math.random() * 1.6 : 0, ph: Math.random() * 6.3 });
    }
  };
  build(); addEventListener('resize', build);
  const band = () => {   // the faint haze of the band itself
    cx.save(); cx.globalAlpha = 0.05; cx.translate(W / 2, H * 0.55); cx.rotate(-Math.atan2(H * 0.8, W)); cx.scale(1, 0.16);
    const rg = cx.createRadialGradient(0, 0, 0, 0, 0, W * 0.7); rg.addColorStop(0, 'rgba(190,205,255,1)'); rg.addColorStop(1, 'rgba(190,205,255,0)');
    cx.fillStyle = rg; cx.beginPath(); cx.arc(0, 0, W * 0.7, 0, 6.3); cx.fill(); cx.restore();
  };
  // shooting stars: a bright head with a tapering tail, mostly falling left-to-right and down (sometimes the other way)
  const meteors = [];
  let nextMeteor = 2500 + Math.random() * 3000;
  const launch = (t) => {
    const dir = Math.random() < 0.75 ? 1 : -1, ang = (0.35 + Math.random() * 0.35) * (dir > 0 ? 1 : -1);
    const v = (0.55 + Math.random() * 0.5) * Math.hypot(W, H);            // px / s
    meteors.push({ x: (dir > 0 ? 0.05 + Math.random() * 0.6 : 0.35 + Math.random() * 0.6) * W, y: Math.random() * 0.45 * H,
      vx: Math.cos(ang) * v * dir, vy: Math.abs(Math.sin(ang)) * v, t0: t, life: 0.55 + Math.random() * 0.6, len: (0.07 + Math.random() * 0.07) * W, w: (0.9 + Math.random() * 0.8) * dpr });
  };
  let last = 0;
  (function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < (meteors.length ? 0 : 50) || !cv.isConnected || getComputedStyle(menu).display === 'none') return;
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    nextMeteor -= dt * 1000;
    if (nextMeteor <= 0) { launch(t); if (Math.random() < 0.1) setTimeout(() => launch(performance.now()), 250 + Math.random() * 500); nextMeteor = 7000 + Math.random() * 9000; }
    cx.clearRect(0, 0, W, H); band();
    const s = t / 1000;
    for (const p of stars) {
      const a = p.tw ? p.a * (0.55 + 0.45 * Math.sin(s * p.tw + p.ph)) : p.a;
      if (p.big) {
        const g = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, `rgba(${p.c},${a * 0.35})`); g.addColorStop(1, `rgba(${p.c},0)`);
        cx.fillStyle = g; cx.beginPath(); cx.arc(p.x, p.y, p.r * 5, 0, 6.3); cx.fill();
      }
      cx.fillStyle = `rgba(${p.c},${a})`; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.3); cx.fill();
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i], age = (t - m.t0) / 1000, k = age / m.life;
      if (k >= 1) { meteors.splice(i, 1); continue; }
      const hx = m.x + m.vx * age, hy = m.y + m.vy * age, sp = Math.hypot(m.vx, m.vy);
      const tl = m.len * Math.min(1, k * 4), tx = hx - m.vx / sp * tl, ty = hy - m.vy / sp * tl;
      const fade = Math.sin(Math.PI * Math.min(1, k * 1.15));             // swells in, burns out
      const g = cx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(200,220,255,0)'); g.addColorStop(0.7, `rgba(225,235,255,${0.35 * fade})`); g.addColorStop(1, `rgba(255,255,255,${0.95 * fade})`);
      cx.strokeStyle = g; cx.lineWidth = m.w; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(hx, hy); cx.stroke();
      const hg = cx.createRadialGradient(hx, hy, 0, hx, hy, m.w * 4);
      hg.addColorStop(0, `rgba(255,255,255,${0.8 * fade})`); hg.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = hg; cx.beginPath(); cx.arc(hx, hy, m.w * 4, 0, 6.3); cx.fill();
    }
  })(0);
}

// ?font=1..11 tries another face for the title; Outfit (a geometric O for the globe to stand in for) is the default
const TITLE_FONTS = [['Outfit', 300], ['Playfair Display', 500], ['Cinzel', 500], ['Italiana', 400], ['Bodoni Moda', 500], ['Fraunces', 300], ['Syne', 700], ['Unbounded', 400], ['Cormorant Garamond', 500], ['Tenor Sans', 400], ['DM Serif Display', 400]];
function titleGlow(h1) {
  if (!h1) return;
  const pick = TITLE_FONTS[+new URLSearchParams(location.search).get('font') - 1];
  if (pick) {
    const [fam, w] = pick, l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${fam.replace(/ /g, '+')}:wght@${w}&display=swap`; document.head.appendChild(l);
    h1.style.setProperty('--titleFont', `'${fam}'`); h1.style.setProperty('--titleWeight', w);
  }
  const word = document.createElement('span'); word.className = 'tw';
  const text = h1.textContent, oAt = text.lastIndexOf('O');
  h1.setAttribute('aria-label', 'Tiny World');
  const chars = [...text].map((c, i) => {
    const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
    if (i === oAt) { s.classList.add('globe'); miniEarth(s); } else s.textContent = c;
    word.appendChild(s); return s;
  });
  h1.textContent = ''; h1.appendChild(word);
  word.addEventListener('pointermove', (e) => {
    const fs = parseFloat(getComputedStyle(h1).fontSize);
    for (const s of chars) {
      const r = s.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)) / (fs * 1.6);
      s.style.setProperty('--p', Math.max(0, 1 - d * d).toFixed(3));
    }
  });
  word.addEventListener('pointerleave', () => { for (const s of chars) s.style.setProperty('--p', 0); });
  // the title sits over the stage: while the cursor is on it, the dioramas underneath don't light up
  word.addEventListener('pointerenter', () => { titleHover = true; });
  word.addEventListener('pointerleave', () => { titleHover = false; });
}


// ---------- the globe ----------
// the worlds where they really are (La Playa: a Pacific beach town with a Cristo on the hill, around Puerto Vallarta)
const PLACES = [
  { map: 'downtown', name: 'Gaslamp District', place: 'San Diego, California', lat: 32.711, lon: -117.161, badge: 'assets/flag-california.png', color: '#ff8a3d' },
  { map: 'suburbs', name: 'Chicago', place: 'Chicago, Illinois', lat: 41.878, lon: -87.63, badge: 'assets/flag-illinois.png', color: '#3d9bff' },
  { map: 'tropical', name: 'La Playa', place: 'Pacific Coast, Mexico', lat: 20.65, lon: -105.23, badge: 'assets/flag-mexico.png', color: '#16c79a' },
];
// NASA Blue Marble-based maps from the three.js examples (day, city lights, ocean mask, clouds)
const TEX = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/';
// lat/lon -> unit vector, matching SphereGeometry's uv layout (u = 0 at 180° W)
const llDir = (lat, lon, o = new THREE.Vector3()) => { const la = lat * D2R, ph = (lon + 180) * D2R; return o.set(-Math.cos(ph) * Math.cos(la), Math.sin(la), Math.sin(ph) * Math.cos(la)); };
// the nearest copy of a longitude to another (so the globe always turns the short way round)
const near = (lon, ref) => lon + 360 * Math.round((ref - lon) / 360);

const EARTH_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
// a relief-map Earth: the real colours pulled toward a soft painted palette, terrain picked out by exaggerated
// hill shading from the normal map, turquoise shelves along the coasts fading to deep blue, a light coastline,
// and a glassy sheen; the dark theme keeps a real terminator with the night side in city lights
const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay, uNight, uSpec, uNorm; uniform vec3 uSun, uCam, uAtmo; uniform float uMode, uNightOn, uSpecOn, uNormOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec3 N = normalize(vN), V = normalize(uCam - vW), L = normalize(uSun);
  vec3 day = texture2D(uDay, vUv, -0.5).rgb;
  // water mask (the ocean map once it's in; till then a guess from the colours), and a blurred copy for the shelves
  float water = mix(smoothstep(0.03, 0.12, day.b - day.r), texture2D(uSpec, vUv, -0.5).r, uSpecOn);
  float open = mix(water, texture2D(uSpec, vUv, 4.5).r, uSpecOn);
  float wide = mix(water, texture2D(uSpec, vUv, 6.5).r, uSpecOn);
  // relief: the terrain's normals, tipped hard so ranges and valleys read from orbit
  vec3 E = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-5)), Nn = cross(N, E);
  vec3 nm = texture2D(uNorm, vUv).xyz * 2.0 - 1.0;
  vec3 P = normalize(N + (nm.x * E + nm.y * Nn) * 3.2 * uNormOn);
  // land: sand to sage by how green it really is, snow and ice kept white
  float lum = dot(day, vec3(0.3, 0.59, 0.11)), green = clamp((day.g - day.r) * 14.0 + 0.45, 0.0, 1.0);
  vec3 pal = mix(vec3(0.79, 0.64, 0.37), vec3(0.3, 0.47, 0.19), green);      // (colours here are linear light)
  pal = mix(pal, vec3(0.92, 0.95, 1.0), smoothstep(0.3, 0.55, lum));
  vec3 land = mix(day * 1.35, pal * (0.8 + lum * 0.6), 0.55);
  // sea: bright turquoise on the shelves, deep blue far out
  vec3 deep = mix(vec3(0.016, 0.17, 0.34), vec3(0.006, 0.075, 0.2), uMode), mid = mix(vec3(0.03, 0.33, 0.5), vec3(0.012, 0.2, 0.36), uMode), shallow = vec3(0.1, 0.58, 0.6);
  vec3 sea = mix(shallow, mid, smoothstep(0.55, 0.95, open));
  sea = mix(sea, deep, smoothstep(0.8, 1.0, wide));
  vec3 base = mix(land, sea, water);
  // light
  float ndl = dot(N, L), lit = smoothstep(-0.18, 0.32, ndl);
  float relief = clamp(1.0 + (dot(P, L) - ndl) * 2.6, 0.4, 1.7);
  float amb = mix(0.6, 0.04, uMode);
  float diff = amb + (1.0 - amb) * max(ndl, 0.0) * mix(0.82, 1.22, uMode);
  vec3 col = base * diff * mix(relief, 1.0, water) * mix(1.1, 1.0, uMode);
  // a thin pale line where the land meets the sea
  float coast = clamp(water * (1.0 - water) * 4.0, 0.0, 1.0);
  col = mix(col, vec3(0.66, 0.93, 0.88) * diff * 1.1, coast * 0.55 * uSpecOn);
  vec3 night = texture2D(uNight, vUv).rgb * uNightOn;
  col += night * vec3(1.0, 0.78, 0.5) * 1.7 * (1.0 - lit) * uMode;
  // glass: a broad soft sheen over everything, a sharper glint on the water
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  col += vec3(1.0) * pow(nh, 10.0) * 0.06 * lit + vec3(1.0, 0.97, 0.9) * pow(nh, 70.0) * water * 0.35 * lit;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  col = mix(col, mix(uAtmo, vec3(0.69, 0.93, 1.0), 0.4) * (0.3 + lit * 0.8), fr * 0.55);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uSun; uniform float uMode, uFade;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * dot(t.rgb, vec3(0.333)), ndl = dot(normalize(vN), normalize(uSun));
  float light = mix(0.92, 0.05 + 1.05 * smoothstep(-0.15, 0.6, ndl), uMode);
  gl_FragColor = vec4(vec3(light), a * mix(0.32, 0.55, uMode) * uFade);
  #include <colorspace_fragment>
}`;
const ATMO_VERT = /* glsl */ `
varying vec3 vNv; varying vec3 vNw;
void main() { vNv = normalize(normalMatrix * normal); vNw = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor, uSun; uniform float uStrength;
varying vec3 vNv; varying vec3 vNw;
void main() {
  // the far side of a slightly bigger sphere: 0 at its outer rim, 1 where it meets the planet's edge
  float g = pow(smoothstep(0.02, -0.4, dot(vNv, vec3(0.0, 0.0, 1.0))), 2.6);
  float sun = 0.4 + 0.8 * max(dot(vNw, normalize(uSun)), 0.0);
  gl_FragColor = vec4(uColor, clamp(g * uStrength * sun, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

// a quick stand-in Earth from the coarse coastlines, shown until the real maps arrive (or if they can't)
function fallbackDay() {
  const { land } = earthMaps();
  return canvasTex(MW * 4, MH * 4, (x, w, h) => {
    const im = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const l = land[Math.floor(j / 4) * MW + Math.floor(i / 4)], lat = Math.abs(90 - (j + 0.5) / h * 180), o = (j * w + i) * 4;
      const dry = Math.max(0, 1 - Math.abs(lat - 24) / 12), ice = clamp((lat - 64) / 6, 0, 1);
      let r = 16 + (88 + 90 * dry - 16) * l, g = 52 + (122 + 30 * dry - 52) * l, b = 98 + (64 + 30 * dry - 98) * l;
      r += (236 - r) * ice; g += (242 - g) * ice; b += (248 - b) * ice;
      im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  });
}

export function initMenu() {
  const menu = document.getElementById('menu');
  if (!menu) return;
  const buttons = Object.fromEntries(PLACES.map((p) => [p.map, menu.querySelector(`button[data-map="${p.map}"]`)]));
  if (new URLSearchParams(location.search).get('map')) return;          // quick-test links skip the show
  const TOUCH = document.documentElement.classList.contains('touch');

  // ---- theme
  let theme = 'dark';
  try { theme = localStorage.getItem('tinyworld.theme') || 'dark'; } catch { /* default */ }
  menu.dataset.theme = theme;
  let mode = theme === 'dark' ? 1 : 0;

  // ---- layers: drifting colour light, stars (dark theme), the globe, pins, then the interface
  titleGlow(menu.querySelector('h1'));
  const bg = document.createElement('div'); bg.className = 'gm-bg'; bg.innerHTML = '<i class="b1"></i><i class="b2"></i><i class="b3"></i>'; menu.prepend(bg);
  starfield(menu, bg);
  const canvas = document.createElement('canvas'); canvas.id = 'menuStage'; menu.querySelector('canvas.stars').after(canvas);
  const pinLayer = document.createElement('div'); pinLayer.className = 'gm-pins'; canvas.after(pinLayer);
  const pins = PLACES.map((p) => {
    const el = document.createElement('div'); el.className = 'pin'; el.style.setProperty('--c', p.color);
    el.innerHTML = `<i class="halo"></i><i class="ring"></i><i class="ring r2"></i><i class="dot"></i><i class="stem"></i>
      <button class="badge" aria-label="${p.name}, ${p.place}"><img src="${p.badge}" alt=""></button>
      <span class="label"><b>${p.name}</b><small>${p.place}</small><em>${TOUCH ? 'Tap again to fly in' : 'Click to fly in'}</em></span>`;
    pinLayer.appendChild(el); return el;
  });
  const ui = document.createElement('div'); ui.className = 'gm-ui';
  ui.innerHTML = `
    <aside class="gm-dest"><div class="gm-k"><span>Choose a destination</span><i></i></div>
      ${PLACES.map((p, i) => `<button class="gm-row" data-i="${i}" style="--c:${p.color}"><span class="n">0${i + 1}</span><span class="t"><b>${p.name}</b><small>${p.place}</small></span><span class="go"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>`).join('')}
    </aside>
    <button class="gm-mode" aria-label="Switch light or dark theme"><span class="knob"></span>
      <svg class="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>
      <svg class="moon" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg></button>
    <div class="gm-zoom"><button data-z="-1" aria-label="Zoom in">+</button><i></i><button data-z="1" aria-label="Zoom out">−</button></div>
    <div class="gm-foot"><span class="gm-coord"></span><span class="gm-hint">${TOUCH ? 'Drag to spin · pinch to zoom · tap a pin' : 'Drag to spin · scroll to zoom · click a pin to fly in'}</span></div>`;
  menu.appendChild(ui);
  const rows = [...ui.querySelectorAll('.gm-row')], coordEl = ui.querySelector('.gm-coord');
  // the dive overlay lives outside the menu so it can cover the loading screen and fade off the finished map
  const fade = document.createElement('div'); fade.id = 'diveFade'; fade.innerHTML = '<div class="df-name"></div><div class="df-sub"></div><div class="df-bar"><i></i></div>';
  document.body.appendChild(fade);

  // ---- renderer and scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOUCH ? 2 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.005, 100);
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  const U = {
    uDay: { value: fallbackDay() }, uNight: { value: black }, uSpec: { value: black }, uNorm: { value: black }, uNightOn: { value: 0 }, uSpecOn: { value: 0 }, uNormOn: { value: 0 },
    uSun: { value: new THREE.Vector3(1, 0, 0) }, uCam: { value: new THREE.Vector3() }, uAtmo: { value: new THREE.Color() }, uMode: { value: mode },
  };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.ShaderMaterial({ uniforms: U, vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG }));
  scene.add(earth);
  const CU = { uMap: { value: black }, uSun: U.uSun, uMode: U.uMode, uFade: { value: 0 } };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.008, 96, 72), new THREE.ShaderMaterial({ uniforms: CU, vertexShader: EARTH_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false }));
  scene.add(clouds);
  const AU = { uColor: { value: new THREE.Color() }, uSun: U.uSun, uStrength: { value: 1 } };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 48), new THREE.ShaderMaterial({ uniforms: AU, vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false }));
  scene.add(atmo);
  // light for the little ISS circling the planet
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2); scene.add(sunLight, new THREE.AmbientLight(0xbfd0ff, 0.5));
  const iss = makeISS(); iss.g.scale.setScalar(0.03); scene.add(iss.g);
  let cloudsReady = false;
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const load = (f, srgb, done) => loader.load(TEX + f, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); done(t); }, undefined, () => { /* the stand-in stays */ });
  load('earth_atmos_2048.jpg', true, (t) => { U.uDay.value = t; });
  load('earth_lights_2048.png', true, (t) => { U.uNight.value = t; U.uNightOn.value = 1; });
  load('earth_specular_2048.jpg', false, (t) => { U.uSpec.value = t; U.uSpecOn.value = 1; });
  load('earth_normal_2048.jpg', false, (t) => { U.uNorm.value = t; U.uNormOn.value = 1; });
  load('earth_clouds_1024.png', false, (t) => { CU.uMap.value = t; cloudsReady = true; });

  // ---- the view: the camera orbits the planet (lat/lon over a point, distance from the centre)
  let baseDist = 4.2, minDist = 1.32, maxDist = 7;
  const view = { lat: 18, lon: -160, dist: 9 }, target = { lat: 31, lon: -104, dist: 4.2 };
  let shiftX = 0, shiftY = 0;
  function layout() {
    const w = innerWidth, h = viewH(), aspect = w / h;
    renderer.setSize(w, h, false); camera.aspect = aspect;
    // the globe fills ~80% of the height on a wide screen (less on squarer ones, where the title and list share it),
    // nearly the width on a phone held upright
    const halfW = Math.atan(Math.tan(15 * D2R) * aspect), f = aspect >= 1.15 ? 0.8 : aspect < 0.75 ? 0.88 : 0.66;
    baseDist = 1 / Math.sin(Math.min(15 * D2R, halfW) * f);
    maxDist = baseDist * 1.7;
    // wide screens: the globe sits right of centre, leaving the left for the title and the list; tall: a little up
    shiftX = aspect > 1.15 ? -w * Math.min(0.13, (aspect - 1.15) * 0.25 + 0.06) : 0;
    shiftY = aspect < 0.9 ? h * 0.07 : 0;
    camera.setViewOffset(w, h, shiftX, shiftY, w, h);
    camera.updateProjectionMatrix();
  }
  layout(); addEventListener('resize', layout);
  target.dist = baseDist; view.dist = baseDist * 2.3;
  function place() {
    llDir(view.lat, view.lon, camera.position).multiplyScalar(view.dist);
    camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  }
  place();                                                     // placed before the first frame projects anything

  // ---- input: drag to spin (with a little coast), wheel / pinch / buttons to zoom
  let lastInput = -10, drag = null, vel = { lon: 0, lat: 0 }, hovered = -1, pinHover = -1, rowHover = -1, going = null, now = 0;
  const pointers = new Map();
  const degPerPx = () => 0.2 * (view.dist - 0.92) / (baseDist - 0.92) * (900 / Math.max(500, viewH()));
  canvas.addEventListener('pointerdown', (e) => {
    if (going) return;
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, t: e.timeStamp, moved: 0 }; vel = { lon: 0, lat: 0 }; lastInput = now; canvas.classList.add('drag');
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.pinch) target.dist = clamp(target.dist * drag.pinch / d, minDist, maxDist);
      drag.pinch = d; lastInput = now; return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = degPerPx(), dt = Math.max(0.008, (e.timeStamp - drag.t) / 1000);
    target.lon -= dx * k; target.lat = clamp(target.lat + dy * k, -70, 78);
    vel = { lon: -dx * k / dt, lat: dy * k / dt };
    drag.x = e.clientX; drag.y = e.clientY; drag.t = e.timeStamp; drag.moved += Math.abs(dx) + Math.abs(dy); lastInput = now;
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size) return;
    if (drag && e.timeStamp - drag.t > 80) vel = { lon: 0, lat: 0 };            // held still before letting go: no coast
    drag = null; canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  menu.addEventListener('wheel', (e) => {
    if (going || e.target.closest('#settings')) return;
    e.preventDefault(); lastInput = now;
    target.dist = clamp(target.dist * Math.exp(e.deltaY * 0.0011), minDist, maxDist);
  }, { passive: false });
  ui.querySelectorAll('.gm-zoom button').forEach((b) => b.addEventListener('click', () => { lastInput = now; target.dist = clamp(target.dist * (+b.dataset.z > 0 ? 1.3 : 1 / 1.3), minDist, maxDist); }));

  // ---- pins and rows: hover to focus, click to fly in (touch: first tap focuses, second goes)
  pins.forEach((el, i) => {
    const b = el.querySelector('.badge');
    b.addEventListener('pointerenter', () => { pinHover = i; });
    b.addEventListener('pointerleave', () => { if (pinHover === i && !TOUCH) pinHover = -1; });
    b.addEventListener('focus', () => { pinHover = i; });
    b.addEventListener('blur', () => { if (pinHover === i) pinHover = -1; });
    b.addEventListener('click', (e) => { e.stopPropagation(); if (TOUCH && hovered !== i) { pinHover = i; return; } dive(i); });
  });
  rows.forEach((r, i) => {
    r.addEventListener('pointerenter', () => { rowHover = i; });
    r.addEventListener('pointerleave', () => { if (rowHover === i) rowHover = -1; });
    r.addEventListener('focus', () => { rowHover = i; });
    r.addEventListener('blur', () => { if (rowHover === i) rowHover = -1; });
    r.addEventListener('click', () => dive(i));
  });
  // a tap on empty space lets go of a focused pin (touch)
  canvas.addEventListener('click', () => { if (TOUCH && drag === null) pinHover = -1; });

  // ---- theme switch: everything eases across (CSS for the page, uniforms for the planet)
  ui.querySelector('.gm-mode').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'; menu.dataset.theme = theme;
    try { localStorage.setItem('tinyworld.theme', theme); } catch { /* not saved */ }
  });

  // ---- flying in
  function dive(i) {
    if (going) return;
    const p = PLACES[i];
    going = { i, p, start: performance.now(), dur: reduced ? 700 : 2100, from: { ...view }, lon: near(p.lon, view.lon), fov: camera.fov };
    hovered = i; menu.classList.add('diving');
    fade.style.setProperty('--fbg', getComputedStyle(menu).getPropertyValue('--bg').trim() || '#05070d');
    fade.dataset.theme = theme;
    fade.querySelector('.df-name').textContent = p.name; fade.querySelector('.df-sub').textContent = p.place;
    fade.style.setProperty('--c', p.color);
    setTimeout(finish, going.dur + 150);                        // hand over on time even if frames are few
  }
  function finish() {
    if (!going || going.done) return;
    going.done = true;
    fade.classList.add('hold'); fade.style.opacity = 1;
    window.__twDive = true;                                     // main.js: finish the descent onto the miniature
    buttons[going.p.map].click();                               // hand over to main.js: load the map
  }
  // the map is built and running: the curtain lifts off the miniature
  document.addEventListener('tw:start', () => {
    if (!fade.classList.contains('hold')) return;
    setTimeout(() => { fade.classList.add('out'); setTimeout(() => fade.remove(), 1800); }, 40);
  }, { once: true });

  // ---- per frame
  const _p = new THREE.Vector3(), _c = new THREE.Vector3(), sunView = new THREE.Vector3();
  const SUN_LIGHT = new THREE.Vector3(-0.42, 0.5, 0.76).normalize(), SUN_DARK = new THREE.Vector3(-0.62, 0.36, 0.58).normalize();
  const ATMO_LIGHT = new THREE.Color(0.5, 0.86, 1.0), ATMO_DARK = new THREE.Color(0.34, 0.7, 1.0);
  let last = performance.now(), born = last, t = 0, running = true, issA = Math.random() * 6, shown = 0;
  function frame(ms) {
    if (!running) return;
    if (menu.style.display === 'none') { stop(); return; }     // the game has started: stop and let the GPU go
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ms - last) / 1000); last = ms; t += dt; now = t;
    const wall = (performance.now() - born) / 1000;                 // real seconds since the menu opened
    mode += ((theme === 'dark' ? 1 : 0) - mode) * Math.min(1, dt * 2.6);
    hovered = going ? going.i : pinHover >= 0 ? pinHover : rowHover;
    if (!going) {
      // coast after a fling; idle: a slow turn west to east; focused: lean toward the place (and in a little)
      if (!drag) { target.lon += vel.lon * dt; target.lat = clamp(target.lat + vel.lat * dt, -70, 78); const f = Math.exp(-dt * 3.2); vel.lon *= f; vel.lat *= f; }
      if (hovered >= 0 && !drag) {
        const p = PLACES[hovered], k = Math.min(1, dt * 1.6);
        target.lon += (near(p.lon, target.lon) - target.lon) * k; target.lat += (p.lat * 0.85 - target.lat) * k;
        if (target.dist > baseDist * 0.82) target.dist += (baseDist * 0.82 - target.dist) * Math.min(1, dt * 0.8);
      } else if (!drag && t - lastInput > 4 && !reduced) target.lon += dt * 2.6;
      const k = 1 - Math.exp(-dt * (t < 2.6 ? 1.9 : drag ? 14 : 6));
      view.lat += (target.lat - view.lat) * k; view.lon += (target.lon - view.lon) * k; view.dist += (target.dist - view.dist) * k;
    } else {
      const g = going, k = clamp((performance.now() - g.start) / g.dur, 0, 1), turn = ease(Math.min(1, k * 1.3)), e = ease(k);
      view.lon = g.from.lon + (g.lon - g.from.lon) * turn; view.lat = g.from.lat + (g.p.lat - g.from.lat) * turn;
      view.dist = g.from.dist + (1.004 - g.from.dist) * Math.pow(e, 1.15);
      camera.fov = g.fov + (17 - g.fov) * e;
      camera.setViewOffset(innerWidth, viewH(), shiftX * (1 - turn), shiftY * (1 - turn), innerWidth, viewH());   // the place comes to the middle of the screen
      camera.updateProjectionMatrix();
      fade.style.opacity = clamp((k - 0.62) / 0.3, 0, 1);
      canvas.style.filter = k > 0.55 ? `blur(${((k - 0.55) * 14).toFixed(1)}px)` : '';
      if (k >= 1) finish();
    }
    place();
    // light: kept to the camera's upper left so the face you're looking at is always well lit (dark: side-lit)
    sunView.copy(SUN_LIGHT).lerp(SUN_DARK, mode).normalize();
    U.uSun.value.copy(sunView).applyQuaternion(camera.quaternion);
    U.uCam.value.copy(camera.position); U.uMode.value = mode;
    U.uAtmo.value.copy(ATMO_LIGHT).lerp(ATMO_DARK, mode);
    AU.uColor.value.copy(U.uAtmo.value); AU.uStrength.value = (0.7 + 0.35 * mode) * (1 + 0.08 * Math.sin(t * 0.6));
    sunLight.position.copy(U.uSun.value).multiplyScalar(10);
    CU.uFade.value = (cloudsReady ? 1 : 0) * clamp((view.dist - 1.03) / 0.35, 0, 1);
    clouds.rotation.y += dt * 0.006;
    // the ISS: an inclined orbit, about a minute per lap, truss across its path
    issA += dt * 0.11;
    const inc = 51.6 * D2R, ox = Math.cos(issA), oz = Math.sin(issA);
    iss.g.position.set(ox * 1.22, oz * Math.sin(inc) * 1.22, oz * Math.cos(inc) * 1.22);
    _c.set(-Math.sin(issA), Math.cos(issA) * Math.sin(inc), Math.cos(issA) * Math.cos(inc));
    iss.g.lookAt(_p.copy(iss.g.position).add(_c)); iss.g.rotateY(Math.PI / 2);
    iss.blink.visible = Math.sin(t * 2.4) > 0.75;
    renderer.render(scene, camera);
    if (!shown && (t > 0.15)) { shown = 1; canvas.classList.add('on'); }
    // pins ride on their places; past the horizon they fade out
    const camDir = _c.copy(camera.position).normalize(), horizon = 1 / view.dist, W = innerWidth, H = viewH();
    pins.forEach((el, i) => {
      const p = PLACES[i], d = llDir(p.lat, p.lon, _p), facing = d.dot(camDir);
      const vis = clamp((facing - horizon - 0.02) / 0.14, 0, 1);
      d.project(camera);
      el.style.transform = `translate3d(${((d.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-d.y * 0.5 + 0.5) * H).toFixed(1)}px, 0)`;
      el.style.opacity = going && going.i !== i ? 0 : vis * clamp((wall - 1.3 - i * 0.15) / 0.7, 0, 1);   // the pins land once the planet has come in
      el.style.zIndex = Math.round(facing * 100) + (hovered === i ? 200 : 0);
      el.classList.toggle('on', hovered === i); el.classList.toggle('dim', hovered >= 0 && hovered !== i);
      el.classList.toggle('off', vis < 0.4);
    });
    rows.forEach((r, i) => { r.classList.toggle('on', hovered === i); r.classList.toggle('dim', hovered >= 0 && hovered !== i); });
    // where you're looking, as a coordinate readout
    let lon = ((view.lon + 180) % 360 + 360) % 360 - 180;
    coordEl.textContent = `${Math.abs(view.lat).toFixed(2)}° ${view.lat >= 0 ? 'N' : 'S'}   ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}   ·   ALT ${Math.round((view.dist - 1) * 6371).toLocaleString('en-US')} KM`;
  }
  requestAnimationFrame(frame);

  function stop() {
    running = false;
    removeEventListener('resize', layout);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    for (const u of [U.uDay, U.uNight, U.uSpec, U.uNorm, CU.uMap]) u.value && u.value.dispose();
    renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
    canvas.remove();
  }
}

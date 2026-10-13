// The players' globe (the players' hall on the menu): a spinning wireframe Earth in white glowing lines, the
// continents in fine white dots, and a red pulsing dot for each player (up to a few dozen), scattered over the land.
// Drawn on a canvas with an orthographic projection, so it looks right however it's turned.
const LAND = [
  // rough outlines (longitude, latitude) of the continents and big islands
  [[-168, 65], [-140, 70], [-110, 72], [-85, 70], [-80, 63], [-65, 60], [-55, 52], [-66, 45], [-75, 38], [-81, 31], [-80, 25], [-90, 29], [-97, 26], [-97, 20], [-87, 21], [-83, 10], [-78, 8], [-90, 14], [-105, 20], [-115, 30], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 62]],
  [[-50, 60], [-42, 60], [-20, 70], [-20, 80], [-40, 83], [-60, 80], [-55, 70]],
  [[-80, 10], [-72, 12], [-60, 8], [-50, 0], [-35, -6], [-38, -15], [-48, -25], [-58, -35], [-65, -42], [-68, -52], [-75, -50], [-73, -38], [-71, -20], [-80, -5]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [40, 67], [30, 60], [28, 55], [40, 45], [28, 41], [22, 37], [12, 38], [8, 44], [3, 43]],
  [[-6, 50], [1, 51], [0, 53], [-3, 56], [-5, 58], [-6, 55], [-3, 53]],
  [[-17, 15], [-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 11], [42, -2], [40, -15], [35, -25], [25, -34], [18, -34], [12, -18], [9, -1], [8, 4], [-8, 5], [-13, 8]],
  [[35, 28], [39, 22], [43, 13], [52, 16], [57, 22], [56, 26], [50, 30], [48, 30], [36, 33]],
  [[28, 41], [40, 45], [50, 46], [55, 40], [60, 25], [67, 25], [72, 20], [77, 8], [80, 15], [88, 22], [92, 21], [98, 15], [100, 3], [104, 1], [105, 10], [109, 12], [108, 21], [118, 24], [122, 31], [120, 40], [128, 35], [130, 43], [140, 50], [143, 60], [160, 62], [178, 66], [170, 70], [140, 73], [110, 76], [80, 73], [60, 70], [45, 68], [40, 67], [30, 60], [28, 55], [40, 45]],
  [[130, 31], [135, 34], [141, 38], [142, 45], [140, 41], [133, 34]],
  [[95, 5], [105, -6], [115, -8], [120, -5], [110, -2], [100, 0]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [130, -32], [115, -34]],
  [[172, -35], [178, -38], [170, -46], [168, -44]],
];
const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
// the land as a field of dots (every 3 degrees), made once
let DOTS = null;
function landDots() {
  if (DOTS) return DOTS;
  DOTS = [];
  for (let lat = -56; lat <= 82; lat += 3) for (let lon = -180; lon < 180; lon += 3 / Math.max(0.35, Math.cos(lat * Math.PI / 180))) if (LAND.some((p) => inPoly(lon, lat, p))) DOTS.push([lon, lat]);
  return DOTS;
}
const R2D = Math.PI / 180;

export function startGlobe(canvas, players) {
  const g = canvas.getContext('2d'), dots = landDots();
  // the players: spread over the land (the same spots each time for the same count)
  let seed = 17; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = Math.max(16, Math.min(48, players || 1)), pins = [];   // (at least a handful, so there are always some in view)
  for (let i = 0; i < n; i++) pins.push({ p: dots[Math.floor(rnd() * dots.length)], ph: rnd() * Math.PI * 2, sp: 1.6 + rnd() * 1.6 });
  let lon0 = -40, raf = 0, last = performance.now(), alive = true;
  const tilt = 18 * R2D, ct = Math.cos(tilt), st = Math.sin(tilt);
  const frame = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; lon0 += dt * 14;
    const W = canvas.width, H = canvas.height, r = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2, k = W / 220;
    const proj = (lon, lat) => {
      const l = (lon - lon0) * R2D, p = lat * R2D, cl = Math.cos(l), cp = Math.cos(p), sp = Math.sin(p);
      const z = st * sp + ct * cp * cl;                                  // > 0: on the side facing us
      return [cx + r * cp * Math.sin(l), cy - r * (ct * sp - st * cp * cl), z];
    };
    g.clearRect(0, 0, W, H);
    // a faint halo and the globe's dark body
    const halo = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.35); halo.addColorStop(0, 'rgba(160,200,255,.18)'); halo.addColorStop(1, 'rgba(160,200,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    const body = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r); body.addColorStop(0, 'rgba(40,52,78,.9)'); body.addColorStop(1, 'rgba(6,8,16,.95)');
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill();
    // the grid: white with a glow
    g.save(); g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 6 * k; g.lineWidth = 1.1 * k; g.strokeStyle = 'rgba(255,255,255,.55)';
    const line = (pts) => { g.beginPath(); let on = false; for (const [lo, la] of pts) { const [x, y, z] = proj(lo, la); if (z > 0) { if (on) g.lineTo(x, y); else g.moveTo(x, y); on = true; } else on = false; } g.stroke(); };
    for (let lo = -180; lo < 180; lo += 20) { const pts = []; for (let la = -90; la <= 90; la += 4) pts.push([lo, la]); line(pts); }
    for (let la = -60; la <= 60; la += 20) { const pts = []; for (let lo = -180; lo <= 180; lo += 4) pts.push([lo, la]); line(pts); }
    g.lineWidth = 1.8 * k; g.strokeStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
    g.restore();
    // the continents, in dots (brighter toward the middle of the globe)
    for (const [lo, la] of dots) { const [x, y, z] = proj(lo, la); if (z <= 0.02) continue; g.fillStyle = `rgba(235,242,255,${0.25 + z * 0.6})`; g.fillRect(x - 0.9 * k, y - 0.9 * k, 1.8 * k, 1.8 * k); }
    // the players: red dots with a pulsing glow
    const t = now / 1000;
    for (const pin of pins) {
      const [x, y, z] = proj(pin.p[0], pin.p[1]); if (z <= 0.05) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * pin.sp + pin.ph), a = Math.min(1, z * 1.6);
      const gr = g.createRadialGradient(x, y, 0, x, y, (6 + pulse * 7) * k); gr.addColorStop(0, `rgba(255,60,60,${0.75 * a})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, (6 + pulse * 7) * k, 0, 6.283); g.fill();
      g.fillStyle = `rgba(255,${120 + pulse * 100},${110 + pulse * 90},${a})`; g.beginPath(); g.arc(x, y, 2.1 * k, 0, 6.283); g.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop() { alive = false; cancelAnimationFrame(raf); }, setPlayers(m) { /* the count can grow while open */ const want = Math.max(16, Math.min(48, m || 1)); while (pins.length < want) pins.push({ p: dots[Math.floor(rnd() * dots.length)], ph: rnd() * 6.28, sp: 1.6 + rnd() * 1.6 }); } };
}

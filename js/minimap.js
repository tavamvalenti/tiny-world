// The minimap (bottom left) while flying Rick's ship, any vehicle, or driving in a mini-game, in the look of Apple
// Maps' dark mode: a deep navy base, blue-grey streets with lighter edges, teal parks, darker blue water, buildings
// as slightly lighter blocks (fading as they're destroyed), places as coloured pins with haloed labels, and you as
// the blue dot with a white ring and a soft heading cone. The map turns so you always face up. A range ring, a
// compass button (its arrow points north), and a pill with your speed and height. Activities can draw their own
// route on it in Apple blue (hub.cur.minimap(ctx, scale)).
// The base (water / parks / land) is made once per map from the painted ground, at about 1.5 px per unit; the
// streets are drawn as vectors from the road network each frame (20 times a second).
import { G } from './core.js';

const CSS = `
#minimap{position:absolute;left:16px;bottom:calc(4.2vh + 14px);width:236px;height:164px;border-radius:22px;overflow:hidden;display:none;pointer-events:none;
  background:rgba(38,45,58,.28);backdrop-filter:blur(14px) saturate(170%);-webkit-backdrop-filter:blur(14px) saturate(170%);
  box-shadow:0 18px 40px -14px rgba(0,0,0,.65),0 6px 14px -6px rgba(0,0,0,.45),0 0 0 .5px rgba(255,255,255,.22)}
/* liquid glass: a soft sheen across the top and a bright rim that fades down the sides */
#minimap:after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.04) 28%,rgba(255,255,255,0) 55%,rgba(255,255,255,.05) 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.38),inset 0 -1px 0 rgba(255,255,255,.08),inset 1px 0 0 rgba(255,255,255,.1),inset -1px 0 0 rgba(255,255,255,.1)}
body.rick-on #minimap,body.veh-on #minimap,body.act-map #minimap{display:block}
#minimap canvas{width:100%;height:100%;display:block;opacity:.84}
#minimap .mm-btn{position:absolute;z-index:1;bottom:9px;width:30px;height:30px;border-radius:50%;background:rgba(70,80,98,.55);backdrop-filter:blur(8px) saturate(160%);box-shadow:0 3px 8px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.35),inset 0 0 0 .5px rgba(255,255,255,.18);display:grid;place-items:center}
#minimap .mm-btn.l{left:9px} #minimap .mm-btn.r{right:9px}
#minimap .mm-btn svg{width:15px;height:15px;transition:transform .15s linear}
#minimap .mm-pill{position:absolute;z-index:1;left:50%;bottom:12px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;white-space:nowrap;
  font:700 11px -apple-system,'SF Pro Text',Inter,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8)}
#minimap .mm-pill svg{width:12px;height:12px}
#minimap .mm-place{position:absolute;z-index:1;right:12px;top:9px;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 11px -apple-system,'SF Pro Text',Inter,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85)}
body.rick-on #rickHud .rk-keys{bottom:calc(4.2vh + 194px)}
body.veh-on #vehHud .vh-keys{bottom:calc(4.2vh + 194px)}
html.touch #minimap{display:none!important}
`;
const C = { base: '#2b3242', land2: '#303849', water: '#1f3d61', park: '#1f4f4a', road: '#4c566c', roadEdge: '#5f6a82', hw: '#6a7590', bld: '#353e51', bldMark: '#43506a', route: '#0a84ff', routeEdge: '#0a5fc2', dot: '#0a84ff' };
const PIN = ['#e8853a', '#8a7ae8', '#3fbf6a', '#e8b23a', '#e85a8a', '#3ab0e8'];

export class Minimap {
  constructor() {
    if (!document.getElementById('mmCss')) { const st = document.createElement('style'); st.id = 'mmCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.el = document.createElement('div'); this.el.id = 'minimap';
    this.el.innerHTML = `<canvas></canvas><div class="mm-place"></div>
      <div class="mm-btn l"><svg viewBox="0 0 16 16"><path d="M8 1.5l4.6 12.2L8 11.2l-4.6 2.5z" fill="#fff"/></svg></div>
      <div class="mm-pill"><svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M6 6l2.4-2.2" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg><span></span></div>
      <div class="mm-btn r"><svg viewBox="0 0 16 16"><path d="M8 2v3M8 11v3M2 8h3M11 8h3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="8" r="2.3" fill="none" stroke="#fff" stroke-width="1.5"/></svg></div>`;
    document.getElementById('hud').appendChild(this.el);
    this.cv = this.el.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.compass = this.el.querySelector('.mm-btn.l svg'); this.pill = this.el.querySelector('.mm-pill span'); this.placeEl = this.el.querySelector('.mm-place');
    this.t = 0; this.baseFor = null;
  }
  // who is moving, where, and which way they face
  pilot() {
    const R = G.rick, V = G.veh, H = G.hub && G.hub.cur;
    if (H && H.ride) { const r = H.ride, f = r.fwd; return { p: r.pos, fx: f.x, fz: f.z, v: r.vel, ground: r.groundAt(r.pos.x, r.pos.z) }; }
    if (H && H.pilot) return H.pilot();
    if (R && R.active) { const q = R.quat; return { p: R.pos, fx: -2 * (q.x * q.z + q.w * q.y), fz: -(1 - 2 * (q.x * q.x + q.y * q.y)), v: R.vel }; }
    if (V && V.active) return { p: V.pos, fx: -Math.sin(V.yaw), fz: -Math.cos(V.yaw), v: V.vel };
    return null;
  }
  // the map's base, once: land, parks and water read off the painted ground, in Apple's dark palette
  buildBase() {
    const gr = G.ground; this.baseFor = G.mapName; this.base = null;
    if (!gr || !gr.c || !gr.k) return;
    const E = gr.E || gr.c.width / gr.k / 2, ppu = Math.min(1.5, 1400 / (2 * E)), N = Math.round(2 * E * ppu);
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const c = cv.getContext('2d');
    try { c.drawImage(gr.c, gr.px(-E), gr.px(-E), 2 * E * gr.k, 2 * E * gr.k, 0, 0, N, N); } catch { return; }
    const img = c.getImageData(0, 0, N, N), d = img.data, hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const W = hex(C.water), P = hex(C.park), B = hex(C.base), L = hex(C.land2), R = hex(C.road);
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = (r + g + b) / 3;
      let o = B;
      if (b > r + 18 && b >= g - 6) o = W;                                  // water: clearly blue
      else if (g > r + 12 && g > b + 4) o = P;                              // grass, parks, trees
      else if (mx - mn < 16 && lum > 38 && lum < 105) o = R;                // asphalt: grey and dark
      else if (lum > 200) o = L;                                            // snow, plazas: a touch lighter
      d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    this.base = { cv, E, ppu };
    // the road network, as segments
    const city = G.city; this.roads = [];
    if (city && city.nodes && city.edges) {
      const byId = new Map(city.nodes.map((n) => [n.id, n]));
      for (const e of city.edges.values ? city.edges.values() : city.edges) { const a = byId.get(e.a), b = byId.get(e.b); if (a && b) this.roads.push([a.x, a.z, b.x, b.z]); }
    }
    this.roadW = (city && city.roadW) || 6;
    this.places = (G.progress && G.progress.places) || (city && city.named) || [];
  }
  update(dt) {
    const who = this.pilot(); if (!who) return;
    if ((this.t -= dt) > 0) return; this.t = 0.05;
    if (this.baseFor !== G.mapName) this.buildBase();
    const cv = this.cv, dpr = Math.min(2, devicePixelRatio || 1), W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = this.ctx, B = G.buildings, { p } = who;
    const view = 70, s = (Math.min(W, H) * 0.5) / view * 1.25;               // pixels per world unit
    const ang = -Math.PI / 2 - Math.atan2(who.fz, who.fx);                    // turn so you face up
    const cx = W / 2, cy = H * 0.6;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = C.base; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(cx, cy); c.rotate(ang); c.scale(s, s); c.translate(-p.x, -p.z);
    const r = view * 1.7;
    if (this.base) { const b = this.base; c.imageSmoothingEnabled = true; c.drawImage(b.cv, -b.E, -b.E, 2 * b.E, 2 * b.E); }
    // streets: a lighter edge under a blue-grey fill, round caps so the corners join
    if (this.roads && this.roads.length) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [w, col] of [[this.roadW * 0.62 + 1.4 / s, C.roadEdge], [this.roadW * 0.62, C.road]]) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        for (const [x0, z0, x1, z1] of this.roads) { if (Math.min(Math.abs(x0 - p.x), Math.abs(x1 - p.x)) > r && Math.abs((x0 + x1) / 2 - p.x) > r) continue; if (Math.min(Math.abs(z0 - p.z), Math.abs(z1 - p.z)) > r && Math.abs((z0 + z1) / 2 - p.z) > r) continue; c.moveTo(x0, z0); c.lineTo(x1, z1); }
        c.stroke();
      }
    }
    // buildings: slightly lighter blocks; landmarks a touch brighter; they fade as they're knocked down
    if (B) {
      for (const b of B.list) {
        if (Math.abs(b.x - p.x) > r || Math.abs(b.z - p.z) > r) continue;
        let alive = 0; const n = b.cells.length; for (let i = 0; i < n; i += 4) if (b.cells[i].alive) alive++;
        const f = alive / Math.ceil(n / 4); if (f < 0.08) continue;
        c.globalAlpha = 0.35 + f * 0.65; c.fillStyle = b.landmark ? C.bldMark : C.bld;
        c.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
      }
      c.globalAlpha = 1;
    }
    // the activity's own route / road, in Apple's route blue
    const act = G.hub && G.hub.cur;
    if (act && act.minimap) { try { act.minimap(c, s, p, C); } catch (e) { /* the map still draws */ } }
    c.restore();
    // place pins and labels, upright whatever the turn
    const cosA = Math.cos(ang), sinA = Math.sin(ang), toScreen = (x, z) => { const dx = (x - p.x) * s, dz = (z - p.z) * s; return [cx + dx * cosA - dz * sinA, cy + dx * sinA + dz * cosA]; };
    c.font = "600 9px -apple-system,'SF Pro Text',Inter,system-ui,sans-serif"; c.textBaseline = 'middle'; c.textAlign = 'left';
    const taken = [[cx - 12, cy - 12, cx + 12, cy + 12]];                    // the dot's own space, then each label's
    (this.places || []).forEach((q, i) => {
      if (taken.length > 6) return;
      const x = (q.x0 + q.x1) / 2, z = (q.z0 + q.z1) / 2; const [sx, sy] = toScreen(x, z);
      if (sx < 8 || sx > W - 60 || sy < 24 || sy > H - 44) return;
      const name0 = String(q.name || q.S || '').replace(/^the /i, ''), box = [sx - 6, sy - 7, sx + 9 + c.measureText(name0).width, sy + 7];
      if (taken.some((t) => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1])) return;
      taken.push(box);
      const col = PIN[i % PIN.length];
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(sx, sy + 0.6, 5, 0, 6.283); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(sx, sy, 4.5, 0, 6.283); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 1.5, 0, 6.283); c.fill();
      const name = String(q.name || q.S || '').replace(/^the /i, '');
      c.lineWidth = 2.6; c.strokeStyle = 'rgba(20,24,32,.85)'; c.strokeText(name, sx + 7, sy); c.fillStyle = col; c.fillText(name, sx + 7, sy);
    });
    // the range ring (as on the watch), open at the bottom for the buttons
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6; c.beginPath(); c.arc(cx, cy, Math.min(W, H) * 0.44, Math.PI * 0.78, Math.PI * 2.22); c.stroke();
    // you: the heading cone, then the blue dot in its white ring
    const cone = c.createRadialGradient(cx, cy, 2, cx, cy, 34); cone.addColorStop(0, 'rgba(10,132,255,.75)'); cone.addColorStop(1, 'rgba(10,132,255,0)');
    c.fillStyle = cone; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 34, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); c.closePath(); c.fill();
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 4;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 7.5, 0, 6.283); c.fill();
    c.shadowBlur = 0; c.fillStyle = C.dot; c.beginPath(); c.arc(cx, cy, 5.2, 0, 6.283); c.fill();
    // the compass button's arrow points to north; the pill: speed and height
    this.compass.style.transform = `rotate(${ang}rad)`;
    const ground = who.ground ?? (B ? B.surfaceAt(p.x, p.z, p.y + 0.5).y : 0), alt = Math.max(0, p.y - ground) * 2.33, sp = who.v ? Math.hypot(who.v.x, who.v.z) * 2.33 * 3.6 : 0;
    this.pill.textContent = alt > 3 ? `${Math.round(sp)} km/h · ${Math.round(alt)} m` : `${Math.round(sp)} km/h`;
    const here = (this.places || []).find((q) => p.x >= q.x0 && p.x <= q.x1 && p.z >= q.z0 && p.z <= q.z1);
    this.placeEl.textContent = here ? String(here.name || here.S || '').replace(/^the /i, '') : (G.city && G.city.mapLabel) || '';
  }
}

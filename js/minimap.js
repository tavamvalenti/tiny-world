// The minimap (bottom left, like GTA's) while flying Rick's ship or any vehicle: the city's own ground painting
// (streets, pavements, parks; rivers and sea show through in blue), the buildings (fading as they're destroyed),
// named places as dots, and you in the middle, the map turning so you always face up. A compass N on the rim,
// and a height gauge for the flyers. Drawn about 20 times a second on a small canvas.
import { G } from './core.js';

const CSS = `
#minimap{position:absolute;left:16px;bottom:calc(4.2vh + 14px);width:232px;height:156px;border-radius:12px;overflow:hidden;display:none;pointer-events:none;
  border:2px solid rgba(255,255,255,.22);box-shadow:0 10px 30px -10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.4);background:#1d4f6e}
body.rick-on #minimap,body.veh-on #minimap{display:block}
#minimap canvas{width:100%;height:100%;display:block}
#minimap .mm-alt{position:absolute;right:6px;top:10px;bottom:24px;width:4px;border-radius:2px;background:rgba(0,0,0,.35)}
#minimap .mm-alt i{position:absolute;left:-2px;width:8px;height:3px;border-radius:2px;background:#ffd46b;box-shadow:0 0 6px rgba(255,200,90,.8)}
#minimap .mm-info{position:absolute;left:8px;bottom:6px;font:700 9px Inter;letter-spacing:.14em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.9)}
body.rick-on #rickHud .rk-keys{bottom:calc(4.2vh + 186px)}
body.veh-on #vehHud .vh-keys{bottom:calc(4.2vh + 186px)}
html.touch #minimap{display:none!important}
`;

export class Minimap {
  constructor() {
    if (!document.getElementById('mmCss')) { const st = document.createElement('style'); st.id = 'mmCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.el = document.createElement('div'); this.el.id = 'minimap';
    this.el.innerHTML = '<canvas></canvas><div class="mm-alt"><i></i></div><div class="mm-info"></div>';
    document.getElementById('hud').appendChild(this.el);
    this.cv = this.el.querySelector('canvas'); this.ctx = this.cv.getContext('2d');
    this.altI = this.el.querySelector('.mm-alt i'); this.info = this.el.querySelector('.mm-info');
    this.t = 0;
  }
  // who is flying, where, and which way they face
  pilot() {
    const R = G.rick, V = G.veh;
    if (R && R.active) { const f = { x: 0, z: -1 }, q = R.quat; const fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y)); f.x = fx; f.z = fz; return { p: R.pos, fx: f.x, fz: f.z, v: R.vel }; }
    if (V && V.active) return { p: V.pos, fx: -Math.sin(V.yaw), fz: -Math.cos(V.yaw), v: V.vel };
    return null;
  }
  update(dt) {
    const who = this.pilot(); if (!who) return;
    if ((this.t -= dt) > 0) return; this.t = 0.05;
    const cv = this.cv, dpr = Math.min(2, devicePixelRatio || 1), W = this.el.clientWidth, H = this.el.clientHeight;
    if (!W) return;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = this.ctx, gr = G.ground, B = G.buildings, { p } = who;
    const view = 80, s = (Math.min(W, H) * 0.5) / view * 1.3;                 // pixels per world unit (about 120 units across)
    const ang = -Math.PI / 2 - Math.atan2(who.fz, who.fx);                     // turn so you face up
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#1d4f6e'; c.fillRect(0, 0, W, H);                         // water / beyond the map
    c.save();
    c.translate(W / 2, H * 0.62); c.rotate(ang); c.scale(s, s); c.translate(-p.x, -p.z);
    // the ground painting around you
    if (gr && gr.c) {
      const r = view * 1.6, k = gr.k, sx = gr.px(p.x - r), sy = gr.px(p.z - r), sw = r * 2 * k;
      try { c.drawImage(gr.c, sx, sy, sw, sw, p.x - r, p.z - r, r * 2, r * 2); } catch { /* off the canvas */ }
      c.fillStyle = 'rgba(10,14,20,.28)'; c.fillRect(p.x - r, p.z - r, r * 2, r * 2);     // darker, map-like
    }
    // the buildings: light blocks, fading as they go
    if (B) {
      const r = view * 1.5;
      for (const b of B.list) {
        if (Math.abs(b.x - p.x) > r || Math.abs(b.z - p.z) > r) continue;
        let alive = 0; const n = b.cells.length; for (let i = 0; i < n; i += 4) if (b.cells[i].alive) alive++;
        const f = alive / Math.ceil(n / 4); if (f < 0.08) continue;
        c.fillStyle = b.landmark ? `rgba(255,214,140,${0.35 + f * 0.55})` : `rgba(200,206,214,${0.2 + f * 0.5})`;
        c.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
      }
    }
    // named places
    const pl = G.progress && G.progress.places;
    if (pl) { c.fillStyle = '#ffd46b'; for (const q of pl) { const x = (q.x0 + q.x1) / 2, z = (q.z0 + q.z1) / 2; if (Math.abs(x - p.x) < view * 1.5 && Math.abs(z - p.z) < view * 1.5) { c.beginPath(); c.arc(x, z, 1.6, 0, 6.283); c.fill(); } } }
    c.restore();
    // you: an arrow in the middle, always pointing up
    c.save(); c.translate(W / 2, H * 0.62);
    c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
    // north on the rim
    // world north (-z) after the map's turn: (0,-1) rotated by ang
    const cx = W / 2, cy = H * 0.62, rr = Math.min(W, H) * 0.42;
    const bx = Math.max(10, Math.min(W - 18, cx + Math.sin(ang) * rr)), by = Math.max(10, Math.min(H - 10, cy - Math.cos(ang) * rr));
    c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(bx, by, 7, 0, 6.283); c.fill();
    c.fillStyle = '#fff'; c.font = '700 9px Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', bx, by + 0.5);
    // height above the ground and speed
    const ground = B ? B.surfaceAt(p.x, p.z, p.y + 0.5).y : 0, alt = Math.max(0, p.y - ground) * 2.33, sp = who.v ? Math.hypot(who.v.x, who.v.z) * 2.33 * 3.6 : 0;
    this.altI.style.top = `${Math.max(0, Math.min(100, 100 - (alt / 200) * 100))}%`;
    this.info.textContent = `${Math.round(alt)} M · ${Math.round(sp)} KM/H`;
  }
}

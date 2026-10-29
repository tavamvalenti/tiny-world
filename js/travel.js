// TRAVEL between San Diego and North County (Carlsbad & Oceanside): two maps, one coast.
// Only one region is ever loaded. The chip under the map title starts the trip: the view turns up the coast (or
// down it), lifts toward the horizon and races off into the marine layer; once the clouds have closed over
// everything the page reloads into the other map (nothing to tear down, all memory freed). The new page shows the
// same clouds from its very first paint (game.html, html.traveling), builds the map behind them, then the view
// glides in out of the fog and settles over the new coast. Time of day, sound on/off and the weapon carry over.
import { G, clamp, lerp } from './core.js';
import { sfx } from './audio.js';

const KEY = 'tw-travel';
export const LINKS = {
  downtown: { to: 'northcounty', label: 'NORTH COUNTY', sub: 'Carlsbad &amp; Oceanside', arrow: '↑', yaw: 0 },     // north up the coast (-z)
  northcounty: { to: 'downtown', label: 'SAN DIEGO', sub: 'Gaslamp, the Bay &amp; Coronado', arrow: '↓', yaw: Math.PI },   // back down it (+z)
};
const FOG = '#cfd7db';

export function pending() {
  try { const t = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return t && Date.now() - t.t < 60000 ? t : null; } catch { return null; }
}

export class Travel {
  constructor({ cam, scene, tod, makeEnv, setTodButtons, selectWeapon, mapName }) {
    Object.assign(this, { cam, scene, tod, makeEnv, setTodButtons, selectWeapon, mapName });
    this.fog = document.getElementById('travelFog');
    this.out = null; this.in = null;
    G.travel = this;
    if (LINKS[mapName]) this.chip(LINKS[mapName]);
  }

  // ---------- the chip under the map title ----------
  chip(L) {
    const host = document.getElementById('hud'); if (!host) return;
    const b = document.createElement('button');
    b.id = 'travelChip'; b.type = 'button';
    b.innerHTML = `<span class="ar">${L.arrow}</span><b>${L.label}</b><i>${L.sub}</i>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); sfx.unlock(); this.go(L.to); });
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    host.appendChild(b);
    this.chipEl = b;
  }

  // ---------- leaving ----------
  go(to) {
    if (this.out || this.in) return;
    const L = LINKS[this.mapName], c = this.cam;
    this.out = { to, t: 0, yaw: L.yaw, v: 0, vol: 1 };
    c.zMin = c.xMin = -1e6; c.zMax = c.xMax = 1e6;            // the edges don't hold us any more
    c.yawT = c.yaw + wrap(L.yaw - c.yaw);
    G.traveling = true;
    if (this.chipEl) this.chipEl.disabled = true;
    try { if (window.frameElement) window.frameElement.style.background = FOG; } catch { /* another origin */ }
  }

  // ---------- arriving: called once the map is built ----------
  arrive(t) {
    const c = this.cam, L = LINKS[this.mapName];
    try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
    if (t.tod && this.tod && this.tod.mode !== t.tod) { this.tod.set(t.tod, this.makeEnv); this.setTodButtons && this.setTodButtons(); }
    if (t.weapon != null && this.selectWeapon) this.selectWeapon(t.weapon);
    if (t.muted && !sfx.muted) sfx.toggleMute();
    // we come in from the direction we left in: up the coast into North County from the south, down it into San Diego
    // from the north, still facing the way we were going
    const dir = this.mapName === 'northcounty' ? -1 : 1, face = this.mapName === 'northcounty' ? 0 : Math.PI + 0.32;
    const goal = { x: c.x, z: c.z, dist: c.distT, yaw: face };
    this.in = { t: 0, from: { x: c.x, z: c.z - dir * 230 }, goal, lim: { zMin: c.zMin, zMax: c.zMax, xMin: c.xMin, xMax: c.xMax } };
    c.zMin = c.xMin = -1e6; c.zMax = c.xMax = 1e6;
    c.x = this.in.from.x; c.z = this.in.from.z; c.yaw = c.yawT = face; c.dist = 210; c.tilt = c.tiltT = -0.55;
    G.traveling = true;
    document.documentElement.classList.add('traveling');
  }

  // ---------- each frame, after the camera has been placed ----------
  update(dt) {
    dt = clamp(dt, 0, 0.05);                                   // the first frame after a load can report a step backwards
    const c = this.cam, F = this.scene.fog;
    if (this.out) {
      const O = this.out; O.t += dt;
      // turn up the coast and look toward the horizon, then accelerate away into the haze
      c.tiltT = lerp(c.tiltT, -0.8, 1 - Math.exp(-dt * 2.5));
      c.distT = lerp(c.distT, 150, 1 - Math.exp(-dt * 1.5));
      O.v = Math.min(520, O.v + dt * (O.t < 0.6 ? 40 : 360));
      c.x += -Math.sin(O.yaw) * O.v * dt; c.z += -Math.cos(O.yaw) * O.v * dt;
      const k = clamp((O.t - 0.5) / 1.3, 0, 1);
      if (F) { F.near = lerp(F.near, 4, k); F.far = lerp(F.far, 60, k * k); }
      this.cloud(clamp((O.t - 0.7) / 1.1, 0, 1), O.t);
      O.vol = Math.max(0, 1 - O.t / 1.8); if (sfx.ready) sfx.setVolumes({ master: 0.8 * O.vol });
      if (O.t > 2.0 && !O.gone) {
        O.gone = true;
        try { sessionStorage.setItem(KEY, JSON.stringify({ to: O.to, from: this.mapName, t: Date.now(), tod: this.tod && this.tod.mode, weapon: G.weapons ? G.weapons.cur : 0, muted: sfx.muted })); } catch { /* private mode */ }
        const q = new URLSearchParams(location.search); q.set('map', O.to);
        location.replace(location.pathname + '?' + q);
      }
      return;
    }
    if (this.in) {
      const I = this.in; I.t += dt;
      const D = 3.4, k = clamp(I.t / D, 0, 1), e = 1 - Math.pow(1 - k, 3);      // fast out of the clouds, slowing to a stop
      c.x = lerp(I.from.x, I.goal.x, e); c.z = lerp(I.from.z, I.goal.z, e);
      c.distT = lerp(210, I.goal.dist, e); c.dist = c.distT;
      c.tiltT = lerp(-0.55, 0, clamp((k - 0.35) / 0.65, 0, 1));
      const f = clamp((I.t - 0.25) / 1.6, 0, 1);
      if (F) { F.near = lerp(4, F.near, f); F.far = lerp(60, F.far, f * f); }
      this.cloud(1 - f, I.t);
      if (I.t >= D) { Object.assign(c, I.lim); c.yaw0 = c.yaw0 ?? c.yaw; this.in = null; G.traveling = false; this.cloud(0); document.documentElement.classList.remove('traveling'); }
    }
  }

  // the cloud screen: its opacity, and how fast the cloud layers race past
  cloud(a, t = 0) {
    const el = this.fog; if (!el) return;
    el.style.display = a > 0.001 ? 'block' : 'none';
    el.style.opacity = a.toFixed(3);
  }
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

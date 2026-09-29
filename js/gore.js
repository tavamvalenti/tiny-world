// Blood and dismemberment for people who are shot or caught in explosions. Aimed at grim realism rather than
// cartoon splatter: dark, desaturated arterial red; fine droplet sprays; directional spatter and spreading
// pools painted into the ground; limbs only come off in explosions, and only in proportion to the force.
// Everything can be switched off in Settings (World > Blood & gore).
import * as THREE from 'three';
import { G, rand } from './core.js';
import { settings } from './settings.js';

const BLOOD = [0.3, 0.012, 0.01];               // particle colour (linear): deep, not candy red
const GIB_CAP = 160;
// limb shapes in world units at street-crowd scale (a person is ~0.66 tall)
const GIB = { armL: [0.034, 0.24, 0.034], armR: [0.034, 0.24, 0.034], legL: [0.046, 0.3, 0.046], legR: [0.046, 0.3, 0.046], head: [0.1, 0.11, 0.1] };

export class Gore {
  constructor(scene) {
    this.pools = [];
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    this.gibMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, GIB_CAP);
    this.gibMesh.count = 0; this.gibMesh.castShadow = true; this.gibMesh.frustumCulled = false;
    this.gibMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.gibMesh);
    this.gibs = []; this.next = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  get on() { return settings.gore !== 'off'; }

  // fine droplets thrown out from a wound, biased along (dx, dz)
  spray(x, y, z, n, dx = 0, dz = 0, force = 1) {
    if (!this.on || !G.fx) return;
    for (let i = 0; i < n; i++) {
      const sp = rand(0.4, 2.2) * force;
      G.fx.bits.emit(x + rand(-0.03, 0.03), y + rand(-0.04, 0.04), z + rand(-0.03, 0.03),
        dx * sp + rand(-0.8, 0.8) * force, rand(0.3, 2.2) * force, dz * sp + rand(-0.8, 0.8) * force,
        rand(0.025, 0.07), rand(0.6, 1.2), BLOOD[0] * rand(0.8, 1.2), BLOOD[1], BLOOD[2], 1);
    }
  }

  // ---- ground decals, painted into the terrain texture ----
  paint(fn) {
    const g = G.ground; if (!g) return;
    const X = g.x; X.save(); fn(X, g); X.restore();
    if (g.dirtyT < 0) g.dirtyT = 0.3;
  }
  // spatter: a dense core, satellite drops and elongated streaks thrown along the blast/shot direction
  splat(x, z, size = 0.3, dx = 0, dz = 0) {
    if (!this.on) return;
    this.paint((X, g) => {
      const k = g.k, cx = g.px(x), cz = g.px(z);
      X.fillStyle = `rgba(74,4,4,${rand(0.55, 0.75)})`;
      for (let i = 0; i < 5; i++) { X.beginPath(); X.ellipse(cx + rand(-0.4, 0.4) * size * k, cz + rand(-0.4, 0.4) * size * k, rand(0.25, 0.55) * size * k, rand(0.2, 0.45) * size * k, rand(0, 3), 0, 6.283); X.fill(); }
      const ang = Math.atan2(dz, dx), dir = Math.hypot(dx, dz) > 0.1;
      for (let i = 0; i < 22; i++) {
        const a = dir ? ang + rand(-0.6, 0.6) : rand(0, 6.283), r = rand(0.4, 2.2) * size;
        const px = cx + Math.cos(a) * r * k, pz = cz + Math.sin(a) * r * k, s = rand(0.02, 0.07) * size * k * 3;
        X.fillStyle = `rgba(${rand(60, 90) | 0},4,4,${rand(0.5, 0.85)})`;
        X.beginPath(); X.ellipse(px, pz, s * (dir ? 2.2 : 1), s, a, 0, 6.283); X.fill();
      }
    });
  }
  // a pool that spreads under a body over several seconds and darkens as it goes
  pool(x, z, r = 0.32, dur = 7) {
    if (!this.on) return;
    this.pools.push({ x, z, r, t: 0, dur, lobes: Array.from({ length: 4 }, () => [rand(-0.35, 0.35), rand(-0.35, 0.35), rand(0.55, 0.9), rand(0, 3)]), drawn: 0 });
  }

  // ---- limbs ----
  gib(x, y, z, vx, vy, vz, kind, color) {
    if (!this.on) return;
    const i = this.next; this.next = (this.next + 1) % GIB_CAP;
    this.gibMesh.count = Math.max(this.gibMesh.count, i + 1);
    const g = (this.gibs[i] ||= { p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3() });
    g.p.set(x, y, z); g.v.set(vx, vy, vz); g.s.set(...GIB[kind]);
    g.q.setFromEuler(this._e.set(rand(0, 6), rand(0, 6), rand(0, 6))); g.w.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    g.moving = true; g.i = i; g.trail = 0;
    this.gibMesh.setColorAt(i, color); this.gibMesh.instanceColor.needsUpdate = true;
  }

  // An explosion hit someone with force f, from direction (dx, dz). Decides what comes off (nothing at low
  // force, more the closer they were), throws those limbs with the body, sprays and marks the ground.
  // `colors` gives { skin, arm, leg } THREE.Colors. Returns the set of lost parts plus whether it was fatal.
  blast(x, y, z, f, dx, dz, colors, kind = 'explosion') {
    const res = { lost: {}, dead: f > 4.5 };
    if (!this.on) return res;
    const blunt = kind === 'wind';                                  // thrown, not torn apart
    const parts = ['armL', 'armR', 'legL', 'legR'];
    let n = 0;
    if (!blunt) {
      if (f > 12) n = 4; else if (f > 6) n = 2 + (Math.random() < 0.5 ? 1 : 0); else if (f > 3.5 && Math.random() < 0.65) n = 1;
    }
    parts.sort(() => Math.random() - 0.5).slice(0, n).forEach((p) => { res.lost[p] = true; });
    if (!blunt && (f > 12 || (f > 6 && Math.random() < 0.3))) res.lost.head = true;
    if (n || res.lost.head) res.dead = true;
    for (const p of Object.keys(res.lost)) {
      const up = p === 'head' ? 0.6 : p.startsWith('arm') ? 0.45 : 0.18;
      const sp = Math.min(9, f * rand(0.6, 1.1));
      this.gib(x + rand(-0.05, 0.05), y + up, z + rand(-0.05, 0.05), dx * sp + rand(-1.5, 1.5), rand(2, 4.5) + f * 0.25, dz * sp + rand(-1.5, 1.5), p,
        p === 'head' ? colors.skin : p.startsWith('arm') ? colors.arm : colors.leg);
    }
    const heavy = Math.min(3, f / 3);
    this.spray(x, y + 0.35, z, Math.round((blunt ? 6 : 14) + heavy * 14 + n * 10), dx, dz, 0.7 + heavy * 0.5);
    this.splat(x + dx * 0.3, z + dz * 0.3, 0.22 + heavy * 0.12 + n * 0.05, dx, dz);
    return res;
  }
  // a gunshot: a short exit spray and a spatter behind the victim, then a pool where they fall
  shot(x, z, dx, dz, torsoY = 0.45) {
    if (!this.on) return;
    this.spray(x, torsoY, z, 10, dx, dz, 0.8);
    this.splat(x + dx * 0.35, z + dz * 0.35, 0.18, dx, dz);
    this.pool(x, z, rand(0.26, 0.36));
  }
  // darken a victim's clothes toward blood
  stain(color, amount = 0.35) { return this.on ? color.clone().lerp(new THREE.Color(0.22, 0.015, 0.012), amount) : color; }

  update(dt) {
    // spreading pools: repaint the growing blot a few times a second
    for (const p of [...this.pools]) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur), e = 1 - (1 - k) * (1 - k);
      if (e - p.drawn > 0.08 || k >= 1) {
        p.drawn = e;
        this.paint((X, g) => {
          for (const [ox, oz, s, a] of p.lobes) {
            const R = p.r * e * s * g.k, cx = g.px(p.x + ox * p.r * e), cz = g.px(p.z + oz * p.r * e);
            const gr = X.createRadialGradient(cx, cz, 0, cx, cz, R);
            gr.addColorStop(0, 'rgba(52,2,2,0.5)'); gr.addColorStop(0.75, 'rgba(66,3,3,0.42)'); gr.addColorStop(1, 'rgba(66,3,3,0)');
            X.fillStyle = gr; X.beginPath(); X.ellipse(cx, cz, R, R * 0.8, a, 0, 6.283); X.fill();
          }
        });
      }
      if (k >= 1) this.pools.splice(this.pools.indexOf(p), 1);
    }
    // limbs: tumble, leave a trail of drops, bounce, come to rest with a stain beneath
    let dirty = false;
    for (const g of this.gibs) {
      if (!g || !g.moving) continue;
      dirty = true;
      g.v.y -= 14 * dt; g.p.addScaledVector(g.v, dt);
      this._q.setFromEuler(this._e.set(g.w.x * dt, g.w.y * dt, g.w.z * dt)); g.q.multiply(this._q);
      if ((g.trail -= dt) <= 0 && this.on) { g.trail = 0.05; G.fx.bits.emit(g.p.x, g.p.y, g.p.z, rand(-0.3, 0.3), 0, rand(-0.3, 0.3), rand(0.02, 0.045), 0.8, BLOOD[0], BLOOD[1], BLOOD[2], 1); }
      const floor = g.s.y * 0.25;
      if (g.p.y < floor) {
        g.p.y = floor;
        if (Math.abs(g.v.y) > 1.2) { g.v.y = -g.v.y * 0.3; g.v.x *= 0.5; g.v.z *= 0.5; g.w.multiplyScalar(0.5); this.splat(g.p.x, g.p.z, 0.12); }
        else {
          g.moving = false; g.v.set(0, 0, 0);
          // lie flat along the ground
          this._e.setFromQuaternion(g.q); g.q.setFromEuler(this._e.set(Math.PI / 2, this._e.y, 0));
          this.pool(g.p.x, g.p.z, 0.14, 4);
        }
      }
      this._m.compose(g.p, g.q, g.s); this.gibMesh.setMatrixAt(g.i, this._m);
    }
    if (dirty) this.gibMesh.instanceMatrix.needsUpdate = true;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, blast } from './core.js';
import { sfx } from './audio.js';

export const WEAPONS = [
  { name: 'LASER', color: 0xff5a3c, radius: 1.0, hold: true },
  { name: 'BOMB', color: 0xffb347, radius: 4.2, cd: 0.3 },
  { name: 'WIND', color: 0xbfe9ff, radius: 11, hold: true },
  { name: 'METEOR', color: 0xff7a1a, radius: 8, cd: 1.0 },
  { name: 'ENERGY', color: 0x8a7dff, radius: 5, cd: 0.7 },
];

const BEAM_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;
const BEAM_FS = `uniform vec3 color; uniform float time; uniform float power; varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float core = pow(f, 2.5);
  float pulse = 0.8 + 0.2 * sin(time * 70.0 + vUv.y * 60.0);
  gl_FragColor = vec4(color * core * pulse * power, core * power); }`;

function beamMat(color, opacity = 1) {
  // plain additive glow; HDR colour feeds the bloom pass
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  m.uniforms = { time: { value: 0 }, power: { value: 1 } };
  return m;
}

function bolt(a, b, jag = 1.2, segs = 14) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, s = Math.sin(t * Math.PI) * jag;
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(rand(-s, s), rand(-s, s) * 0.5, rand(-s, s))));
  }
  return pts;
}

export class Weapons {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.cur = 0; this.cd = 0; this.aim = null; this.pulseT = 0;
    this.projectiles = [];
    // reticle
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide }));
    this.reticleDot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), this.reticle.material);
    this.reticle.renderOrder = this.reticleDot.renderOrder = 10;
    scene.add(this.reticle, this.reticleDot);
    // laser beam
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    this.beamCore = new THREE.Mesh(cyl, beamMat(new THREE.Color(9, 6, 4.5)));
    this.beamGlow = new THREE.Mesh(cyl, beamMat(new THREE.Color(3.5, 0.5, 0.2), 0.35));
    this.beamCore.frustumCulled = this.beamGlow.frustumCulled = false;
    this.beamCore.visible = this.beamGlow.visible = false;
    scene.add(this.beamGlow, this.beamCore);
    this.laserLight = new THREE.PointLight(0xff6a3a, 0, 18, 1.5);
    scene.add(this.laserLight);
    this.laserT = 0;
    // projectile meshes
    this.bombGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.22, 0.22, 0.9, 12),
      new THREE.SphereGeometry(0.22, 12, 8).translate(0, -0.45, 0),
      new THREE.ConeGeometry(0.2, 0.35, 12).rotateX(Math.PI).translate(0, 0.6, 0).rotateX(Math.PI),
      new THREE.BoxGeometry(0.6, 0.3, 0.03).translate(0, 0.55, 0), new THREE.BoxGeometry(0.03, 0.3, 0.6).translate(0, 0.55, 0),
    ].map((g) => g.index ? g.toNonIndexed() : g));
    this.bombMat = new THREE.MeshStandardMaterial({ color: 0x3d4234, roughness: 0.5, metalness: 0.5 });
    const rock = new THREE.IcosahedronGeometry(1, 3), rp = rock.attributes.position;
    for (let i = 0; i < rp.count; i++) { const s = 1 + Math.sin(rp.getX(i) * 5) * Math.cos(rp.getY(i) * 4) * 0.15 + rand(-0.05, 0.05); rp.setXYZ(i, rp.getX(i) * s, rp.getY(i) * s, rp.getZ(i) * s); }
    rock.computeVertexNormals();
    this.rockGeo = rock;
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 1, emissive: 0xff5010, emissiveIntensity: 1.6 });
    this.glowGeo = new THREE.IcosahedronGeometry(1, 3);
    this.boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.2, 9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  select(i) { this.cur = i; }

  update(dt, input) {
    const W = WEAPONS[this.cur];
    this.cd -= dt;
    this.updateReticle(W);
    this.updateProjectiles(dt);
    const firing = input.down && this.aim;
    if (this.cur === 0) this.laser(dt, firing);
    else this.laser(dt, false);
    if (!firing) { this.pulseT = 0; return; }
    if (this.cur === 2) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) { this.pulseT = 0.14; this.wind(this.aim.point); }
      return;
    }
    if (!input.pressed && !(this.cd <= 0 && input.down)) return;
    if (this.cd > 0) return;
    this.cd = W.cd;
    const p = this.aim.point.clone();
    if (this.cur === 1) this.dropBomb(p);
    if (this.cur === 3) this.callMeteor(p);
    if (this.cur === 4) this.energy(p);
  }

  updateReticle(W) {
    const a = this.aim;
    this.reticle.visible = this.reticleDot.visible = !!a;
    if (!a) return;
    this.reticle.material.color.set(W.color);
    for (const m of [this.reticle, this.reticleDot]) {
      m.position.copy(a.point).addScaledVector(a.normal, 0.06);
      m.lookAt(m.position.clone().add(a.normal));
    }
    const pulse = 1 + Math.sin(G.time * 6) * 0.04;
    this.reticle.scale.setScalar(W.radius * pulse);
  }

  // ---------- 1. mega laser ----------
  laser(dt, on) {
    const B = G.buildings;
    this.beamCore.visible = this.beamGlow.visible = on;
    if (!on) { this.laserLight.intensity = 0; this.laserT = 0; sfx.laser(false); return; }
    sfx.laser(true);
    this.laserT += dt;
    const cam = this.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const origin = cam.position.clone().addScaledVector(right, 16).add(new THREE.Vector3(0, 26, 0));
    const dir = this.aim.point.clone().sub(origin).normalize();
    const hit = B.raycast(origin, dir, 1200) || { point: this.aim.point, normal: new THREE.Vector3(0, 1, 0), cell: null };
    const p = hit.point, len = origin.distanceTo(p);
    const ramp = Math.min(1, this.laserT * 4);
    for (const [m, r] of [[this.beamCore, 0.32], [this.beamGlow, 1.25]]) {
      m.position.copy(origin); m.lookAt(p);
      const w = r * (0.85 + Math.random() * 0.3) * ramp;
      m.scale.set(w, w, len);
      m.material.uniforms.time.value = G.time;
    }
    this.laserLight.position.copy(p).addScaledVector(hit.normal, 0.8);
    this.laserLight.intensity = 60 * ramp;
    // damage ramps up the longer you hold on a spot
    const dmg = (340 + Math.min(this.laserT, 3) * 140) * dt;
    B.damageSphere(p.x, p.y, p.z, 1.6, dmg, 2.2 * dt, 0.5 * dt, origin);
    B.query(p.x, p.z, 2.6, (c) => { if (c.alive && Math.abs(c.y - p.y) < 2.5 && Math.hypot(c.x - p.x, c.z - p.z) < 2.6) B.heat(c, dt * 0.9); });
    const fx = G.fx, n = hit.normal;
    fx.sparks(p.x + n.x * 0.1, p.y + n.y * 0.1, p.z + n.z * 0.1, 4, 5, 2.5, 1, 7);
    fx.fire.emit(p.x + n.x * 0.2, p.y + n.y * 0.2, p.z + n.z * 0.2, n.x, 1.5, n.z, rand(1.2, 2.2), 0.25, 1.6, 1.3, 1.2, 1);
    if (Math.random() < dt * 20) fx.smokePuff(p.x + n.x * 0.4, p.y + 0.3, p.z + n.z * 0.4, 0.7, 0.12, 5);
    if (!hit.cell) {
      if (Math.random() < dt * 25) G.ground.scorch(p.x, p.z, rand(0.5, 0.9), 0.35);
      if (Math.random() < dt * 1.5) fx.groundFire(p.x, 0, p.z, rand(4, 10), 0.6);
    }
    this.laserBlastT = (this.laserBlastT || 0) - dt;
    if (this.laserBlastT <= 0) { this.laserBlastT = 0.35; blast(p.x, p.y, p.z, 14, 0.3, 'laser'); }
    // vehicles cooked by the beam eventually blow
    for (const c of G.agents.cars) {
      if (c.state === 'air') continue;
      if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < 1.3 && Math.abs(c.pos.y - p.y) < 1.5) {
        c.cook = (c.cook || 0) + dt;
        if (c.cook > 0.45) { c.cook = -10; this.carExplode(c); }
      }
    }
  }

  carExplode(c) {
    const p = c.pos;
    G.fx.explosion(p.x, p.y + 0.3, p.z, 0.55);
    sfx.boom(0.5);
    c.fire = rand(20, 40);
    blast(p.x, p.y, p.z, 14, 6, 'explosion');
    G.agents.launch(c, { x: rand(-0.3, 0.3), z: rand(-0.3, 0.3) }, 2, 7, true, 5);
  }

  // ---------- 2. bomb ----------
  dropBomb(p) {
    const cam = this.camera;
    const back = new THREE.Vector3().subVectors(cam.position, p).setY(0).normalize();
    const start = p.clone().addScaledVector(back, 12).add(new THREE.Vector3(0, 55, 0));
    const m = new THREE.Mesh(this.bombGeo, this.bombMat);
    m.castShadow = true;
    m.position.copy(start);
    this.scene.add(m);
    const T = 1.05;
    const vel = new THREE.Vector3().subVectors(p, start).divideScalar(T);
    vel.y = (p.y - start.y) / T + 0.5 * 30 * T; // compensate gravity 30 so it lands at p
    this.projectiles.push({ kind: 'bomb', mesh: m, vel, grav: 30, t: 0 });
    sfx.whistle(1.0);
  }

  // ---------- 3. wind ----------
  wind(p) {
    const B = G.buildings, fx = G.fx;
    sfx.wind();
    blast(p.x, p.y, p.z, 12, 9, 'wind');
    // tear loose already-damaged sections
    B.query(p.x, p.z, 7, (c) => {
      if (!c.alive || c.falling || c.dmg < 0.35) return;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 7 && Math.random() < 0.35) B.damage(c, 30 * (1 - d / 7) + 8, 0, { x: p.x, y: 0, z: p.z });
    });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, r = rand(0.5, 6);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const out = rand(6, 12), tan = rand(3, 7);
      const vx = Math.cos(a) * out - Math.sin(a) * tan, vz = Math.sin(a) * out + Math.cos(a) * tan;
      const k = Math.random();
      if (k < 0.35) fx.bits.emit(x, rand(0.2, 1.5), z, vx, rand(2, 6), vz, rand(0.08, 0.14), rand(2, 4), 0.95, 0.94, 0.9, 0.9); // paper
      else if (k < 0.7) fx.bits.emit(x, rand(0.2, 1.5), z, vx, rand(2, 6), vz, rand(0.07, 0.12), rand(2, 4), rand(0.25, 0.5), rand(0.35, 0.55), 0.15, 0.9); // leaves
      else fx.smoke.emit(x, rand(0.1, 0.8), z, vx * 0.7, rand(0.3, 1.5), vz * 0.7, rand(0.8, 1.6), rand(1.5, 3), 0.75, 0.73, 0.68, 0.28); // dust swirl
    }
    fx.ring(p.x, 0.1, p.z, 12, 0.55, 0x9fcfe8, 0.25);
  }

  // ---------- 4. meteor ----------
  callMeteor(p) {
    const cam = this.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const back = new THREE.Vector3().subVectors(cam.position, p).setY(0).normalize();
    const start = p.clone().addScaledVector(right, -70).addScaledVector(back, -40).add(new THREE.Vector3(0, 110, 0));
    const m = new THREE.Mesh(this.rockGeo, this.rockMat);
    m.scale.setScalar(1.4);
    const glow = new THREE.Mesh(this.glowGeo, beamMat(new THREE.Color(4, 1.2, 0.3), 0.45));
    glow.scale.setScalar(2.6);
    m.add(glow); glow.scale.setScalar(1.9);
    m.position.copy(start);
    this.scene.add(m);
    const T = 1.5;
    this.projectiles.push({ kind: 'meteor', mesh: m, vel: new THREE.Vector3().subVectors(p, start).divideScalar(T), grav: 0, t: 0, spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)) });
    sfx.whistle(1.6, true);
  }

  updateProjectiles(dt) {
    const B = G.buildings, fx = G.fx;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i], m = pr.mesh;
      pr.t += dt;
      pr.vel.y -= pr.grav * dt;
      const prev = m.position.clone();
      const steps = 4;
      let hit = null;
      for (let s = 1; s <= steps && !hit; s++) {
        const q = prev.clone().addScaledVector(pr.vel, (dt * s) / steps);
        if (q.y <= 0) { q.y = 0; hit = q; }
        else if (B.inside(q)) hit = q;
      }
      if (hit) {
        this.scene.remove(m);
        this.projectiles.splice(i, 1);
        pr.kind === 'bomb' ? this.bombImpact(hit) : this.meteorImpact(hit);
        continue;
      }
      m.position.addScaledVector(pr.vel, dt);
      if (pr.kind === 'bomb') {
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), pr.vel.clone().normalize());
        if (Math.random() < 0.6) fx.smoke.emit(m.position.x, m.position.y + 0.5, m.position.z, 0, 0.2, 0, 0.35, 1.2, 0.8, 0.8, 0.8, 0.3);
      } else {
        m.rotation.x += pr.spin.x * dt; m.rotation.y += pr.spin.y * dt;
        const p = m.position;
        for (let k = 0; k < 10; k++) fx.fire.emit(p.x + rand(-0.8, 0.8), p.y + rand(-0.8, 0.8), p.z + rand(-0.8, 0.8), -pr.vel.x * 0.1, -pr.vel.y * 0.1, -pr.vel.z * 0.1, rand(1.5, 3.2), rand(0.3, 0.6));
        for (let k = 0; k < 4; k++) fx.smoke.emit(p.x + rand(-1, 1), p.y + rand(-1, 1), p.z + rand(-1, 1), rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), rand(1.5, 2.8), rand(4, 8), 0.12, 0.11, 0.1, 0.55);
      }
    }
  }

  bombImpact(p) {
    const B = G.buildings, fx = G.fx;
    fx.explosion(p.x, p.y, p.z, 1.1);
    sfx.boom(1);
    B.damageSphere(p.x, p.y, p.z, 4.4, 280, 0.9, 0.45);
    if (p.y < 0.6) { fx.crater(p.x, p.z, 1.7); this.groundChunks(p, 10, 8); }
    for (let i = 0; i < 3; i++) fx.groundFire(p.x + rand(-2, 2), Math.max(0, p.y), p.z + rand(-2, 2), rand(8, 20), rand(0.8, 1.4));
    blast(p.x, p.y, p.z, 24, 12, 'explosion');
  }

  meteorImpact(p) {
    const B = G.buildings, fx = G.fx;
    fx.explosion(p.x, p.y, p.z, 2.3);
    fx.fireball(p.x, p.y + 3, p.z, 9, 1.6, new THREE.Color(1, 0.45, 0.12));
    fx.flash(p.x, p.y + 8, p.z, 0xffb070, 400, 1.2, 120);
    sfx.boom(2);
    B.damageSphere(p.x, p.y, p.z, 8.5, 520, 1.2, 0.7);
    B.damageSphere(p.x, p.y, p.z, 13, 70, 0.4, 0.25);
    if (p.y < 2) fx.crater(p.x, p.z, 4.6);
    this.groundChunks(p, 45, 16);
    for (let i = 0; i < 10; i++) { const a = rand(0, 6.28), r = rand(3, 8); fx.groundFire(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r, rand(25, 60), rand(1, 1.8)); }
    fx.ring(p.x, 0.1, p.z, 40, 1.1, 0xffa060, 0.6);
    G.shake = 1.4;
    blast(p.x, p.y, p.z, 45, 26, 'meteor');
  }

  groundChunks(p, n, sp) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), s = rand(0.2, 0.55), v = rand(0.4, 1) * sp;
      const c = rand(0.18, 0.32);
      G.fx.debris.spawn(p.x + Math.cos(a), Math.max(0.3, p.y + 0.3), p.z + Math.sin(a), new THREE.Vector3(Math.cos(a) * v, rand(4, 10) * sp / 8, Math.sin(a) * v),
        s, s * 0.5, s * rand(0.7, 1.2), new THREE.Color(c * 1.05, c, c * 0.92));
    }
  }

  // ---------- 5. energy blast ----------
  energy(p) {
    const fx = G.fx;
    const orb = new THREE.Mesh(this.glowGeo, beamMat(new THREE.Color(2.5, 2.2, 7), 0.7));
    orb.frustumCulled = false;
    this.scene.add(orb);
    const top = p.clone().add(new THREE.Vector3(0, 30, 0));
    sfx.charge();
    fx.anims.push({ dur: 0.45, t: 0, fn: (k) => {
      orb.position.lerpVectors(top, p.clone().add(new THREE.Vector3(0, 2, 0)), k * k);
      orb.scale.setScalar(0.4 + k * 1.3 + Math.random() * 0.2);
      if (Math.random() < 0.5) fx.sparks(orb.position.x, orb.position.y, orb.position.z, 3, 1.5, 1.6, 5, 4);
    }, end: () => { this.scene.remove(orb); this.energyStrike(p); } });
  }

  energyStrike(p) {
    const B = G.buildings, fx = G.fx;
    sfx.zap();
    const sky = p.clone().add(new THREE.Vector3(rand(-3, 3), 60, rand(-3, 3)));
    const targets = [];
    B.query(p.x, p.z, 9, (c) => { if (c.alive && !c.falling && Math.random() < 0.08) targets.push(new THREE.Vector3(c.x, c.y, c.z)); });
    for (const c of G.agents.cars) if (c.pos.distanceTo(p) < 10) targets.push(c.pos.clone().add(new THREE.Vector3(0, 0.4, 0)));
    for (const l of G.city.lamps) if (Math.hypot(l.x - p.x, l.z - p.z) < 10) targets.push(new THREE.Vector3(l.x, 2.2, l.z));
    targets.sort(() => Math.random() - 0.5).splice(7);
    const meshes = [];
    const regen = () => {
      for (const m of meshes) { this.scene.remove(m); m.geometry.dispose(); }
      meshes.length = 0;
      const add = (a, b, r, jag) => {
        const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bolt(a, b, jag)), 24, r, 4);
        const m = new THREE.Mesh(g, this.boltMat); m.frustumCulled = false;
        this.scene.add(m); meshes.push(m);
      };
      add(sky, p, 0.12, 4); add(sky.clone().add(new THREE.Vector3(rand(-6, 6), 0, rand(-6, 6))), p, 0.06, 3);
      for (const t of targets) add(p.clone().add(new THREE.Vector3(0, 0.5, 0)), t, 0.04, 0.8);
    };
    regen();
    let flick = 0;
    fx.anims.push({ dur: 0.5, t: 0, fn: (k) => { flick++; if (flick % 3 === 0) regen(); this.boltMat.opacity = 1 - k * 0.6; },
      end: () => { for (const m of meshes) { this.scene.remove(m); m.geometry.dispose(); } this.boltMat.opacity = 1; } });
    fx.flash(p.x, p.y + 4, p.z, 0x9a8cff, 260, 0.6, 70);
    fx.fireball(p.x, p.y + 0.5, p.z, 4, 0.5, new THREE.Color(0.45, 0.5, 1.4));
    fx.ring(p.x, p.y + 0.1, p.z, 16, 0.5, 0x8a7dff, 0.9);
    fx.ring(p.x, p.y + 0.1, p.z, 26, 0.9, 0x5fd0ff, 0.5);
    fx.sparks(p.x, p.y + 0.5, p.z, 160, 1.8, 2.2, 6, 16);
    for (const t of targets) { fx.sparks(t.x, t.y, t.z, 25, 2, 2.4, 6, 6); B.damageSphere(t.x, t.y, t.z, 1.2, 90, 0.5, 0.4); }
    B.damageSphere(p.x, p.y, p.z, 5.2, 250, 0.7, 0.35);
    if (p.y < 0.6) { G.ground.scorch(p.x, p.z, 4, 0.6); this.groundChunks(p, 8, 7); }
    // residual crackle
    fx.anims.push({ dur: 2.2, t: 0, fn: () => { if (Math.random() < 0.4) fx.sparks(p.x + rand(-2, 2), p.y + rand(0, 1.5), p.z + rand(-2, 2), 5, 1.5, 1.8, 5, 3); } });
    G.shake = Math.max(G.shake, 0.5);
    blast(p.x, p.y, p.z, 26, 11, 'energy');
  }
}

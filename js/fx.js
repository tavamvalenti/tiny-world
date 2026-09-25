import * as THREE from 'three';
import { G, rand } from './core.js';
import { makeSoftSprite, makeSmokeSprite } from './textures.js';

const PVS = `attribute float aSize; attribute vec4 aColor; varying vec4 vC; uniform float uScale;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / -mv.z; vC = aColor; }`;
const PFS = `uniform sampler2D map; varying vec4 vC;
void main(){ vec4 t = texture2D(map, gl_PointCoord); float a = vC.a * t.a; if (a < 0.004) discard; gl_FragColor = vec4(vC.rgb, a); }`;

// CPU-simulated point particles. Modes change how colour/alpha evolve.
class Particles {
  constructor(cap, mode, map, blending) {
    this.cap = cap; this.mode = mode; this.n = 0;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4); this.base = new Float32Array(cap * 4);
    this.size = new Float32Array(cap); this.s0 = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.seed = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: 400 } }, vertexShader: PVS, fragmentShader: PFS,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, size, life, r = 1, gg = 1, b = 1, a = 1) {
    let i = this.n;
    if (i >= this.cap) i = (Math.random() * this.cap) | 0; else this.n++;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.base[i4] = r; this.base[i4 + 1] = gg; this.base[i4 + 2] = b; this.base[i4 + 3] = a;
    this.s0[i] = size; this.life[i] = 0; this.max[i] = life; this.seed[i] = Math.random() * 10;
  }
  update(dt) {
    const { pos, vel, col, base, size, s0, life, max, mode } = this;
    const wx = G.wind.x, wz = G.wind.z;
    let i = 0;
    while (i < this.n) {
      life[i] += dt;
      const t = life[i] / max[i];
      if (t >= 1) { this.kill(i); continue; }
      const i3 = i * 3, i4 = i * 4;
      if (mode === 'fire') {
        vel[i3 + 1] += 2.5 * dt;
        vel[i3] += (wx * 0.8 - vel[i3]) * dt; vel[i3 + 2] += (wz * 0.8 - vel[i3 + 2]) * dt;
        size[i] = s0[i] * (1 - t * 0.75) * (0.5 + Math.min(1, t * 10) * 0.5);
        const k = t;
        col[i4] = (2.8 - k * 1.3) * base[i4]; col[i4 + 1] = (1.35 - k * 1.1) * base[i4 + 1]; col[i4 + 2] = (0.45 - k * 0.42) * base[i4 + 2];
        col[i4 + 3] = Math.pow(1 - t, 1.3) * base[i4 + 3];
      } else if (mode === 'smoke') {
        const d = 1 - dt * 0.45;
        vel[i3] = vel[i3] * d + wx * dt * 0.9; vel[i3 + 2] = vel[i3 + 2] * d + wz * dt * 0.9;
        vel[i3 + 1] = vel[i3 + 1] * (1 - dt * 0.25) + 0.25 * dt;
        size[i] = s0[i] * (1 + t * 3.2);
        col[i4] = base[i4]; col[i4 + 1] = base[i4 + 1]; col[i4 + 2] = base[i4 + 2];
        col[i4 + 3] = base[i4 + 3] * Math.min(1, t * 6) * (1 - t) * (1 - t);
      } else if (mode === 'spark') {
        vel[i3 + 1] -= 16 * dt;
        size[i] = s0[i] * (1 - t);
        col[i4] = base[i4]; col[i4 + 1] = base[i4 + 1]; col[i4 + 2] = base[i4 + 2]; col[i4 + 3] = 1 - t;
      } else if (mode === 'ember') {
        vel[i3 + 1] += (0.6 - vel[i3 + 1] * 0.8) * dt;
        vel[i3] += (wx * 1.2 - vel[i3]) * dt * 0.8 + Math.sin(life[i] * 5 + this.seed[i]) * dt * 1.5;
        vel[i3 + 2] += (wz * 1.2 - vel[i3 + 2]) * dt * 0.8 + Math.cos(life[i] * 4 + this.seed[i]) * dt * 1.5;
        size[i] = s0[i] * (1 - t * 0.5);
        const fl = 0.6 + 0.4 * Math.sin(life[i] * 20 + this.seed[i] * 7);
        col[i4] = base[i4] * fl; col[i4 + 1] = base[i4 + 1] * fl; col[i4 + 2] = base[i4 + 2] * fl; col[i4 + 3] = 1 - t;
      } else { // bits: leaves, paper, glass, sand
        const flutter = base[i4 + 3] < 0.95;
        vel[i3 + 1] -= (flutter ? 2.2 : 12) * dt;
        const dr = 1 - dt * (flutter ? 1.2 : 0.3);
        vel[i3] *= dr; vel[i3 + 2] *= dr;
        if (flutter) { vel[i3] += Math.sin(life[i] * 7 + this.seed[i]) * dt * 3; vel[i3 + 2] += Math.cos(life[i] * 5 + this.seed[i]) * dt * 3; }
        size[i] = s0[i];
        col[i4] = base[i4]; col[i4 + 1] = base[i4 + 1]; col[i4 + 2] = base[i4 + 2]; col[i4 + 3] = t > 0.85 ? (1 - t) / 0.15 : 1;
      }
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      if (pos[i3 + 1] < 0.03) {
        pos[i3 + 1] = 0.03;
        if (mode === 'bits' || mode === 'spark') { vel[i3 + 1] *= -0.25; vel[i3] *= 0.5; vel[i3 + 2] *= 0.5; }
        else vel[i3 + 1] = Math.abs(vel[i3 + 1]) * 0.3;
      }
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'aColor', 'aSize']) this.geo.attributes[k].needsUpdate = true;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    this.pos.copyWithin(i * 3, j * 3, j * 3 + 3); this.vel.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.base.copyWithin(i * 4, j * 4, j * 4 + 4); this.col.copyWithin(i * 4, j * 4, j * 4 + 4);
    this.size[i] = this.size[j]; this.s0[i] = this.s0[j]; this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.seed[i] = this.seed[j];
  }
  // radial push for wind / shockwaves
  push(x, y, z, r, power) {
    const { pos, vel } = this;
    for (let i = 0; i < this.n; i++) {
      const dx = pos[i * 3] - x, dy = pos[i * 3 + 1] - y, dz = pos[i * 3 + 2] - z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > r || d < 0.01) continue;
      const f = power * (1 - d / r) / d;
      vel[i * 3] += dx * f; vel[i * 3 + 1] += Math.abs(dy) * f * 0.5 + f * 0.3; vel[i * 3 + 2] += dz * f;
    }
  }
}

// Rigid-ish chunks of building that fly, bounce, and then freeze into permanent rubble.
class Debris {
  constructor(scene, cap = 9000) {
    this.cap = cap;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, cap);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.items = [];
    this.active = new Set();
    this.next = 0;
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }
  spawn(x, y, z, vel, sx, sy, sz, color) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.mesh.count = Math.max(this.mesh.count, i + 1);
    const it = (this.items[i] ||= { p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), s: new THREE.Vector3() });
    it.p.set(x, y, z); it.v.copy(vel); it.s.set(sx, sy, sz); it.q.setFromEuler(this._e.set(rand(0, 6), rand(0, 6), rand(0, 6)));
    it.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); it.t = 0; it.i = i;
    this.mesh.setColorAt(i, color);
    this.mesh.instanceColor.needsUpdate = true;
    // over budget: settle immediately to keep the sim cheap
    if (this.active.size > 450) { it.p.y = G.buildings.surfaceAt(x, z, y).y + sy * 0.4; this.settle(it); }
    else this.active.add(it);
    this.write(it);
  }
  write(it) { this._m.compose(it.p, it.q, it.s); this.mesh.setMatrixAt(it.i, this._m); this.mesh.instanceMatrix.needsUpdate = true; }
  wake(it, v) {
    if (!it) return;
    if (v) it.v.add(v); else it.v.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5));
    it.w.set(rand(-4, 4), rand(-4, 4), rand(-4, 4)); it.t = 0;
    this.active.add(it);
  }
  settle(it) {
    this.active.delete(it);
    const s = G.buildings.surfaceAt(it.p.x, it.p.z, it.p.y + 0.3);
    if (s.cell) (s.cell.rest ||= []).push(it);
    else if (G.city) G.city.addRubble(it.p.x, it.p.z, Math.max(it.s.x, it.s.z));
  }
  push(x, z, r, power, up = 0.5) {
    const v = new THREE.Vector3();
    for (let i = 0; i < this.mesh.count; i++) {
      const it = this.items[i];
      if (!it) continue;
      const dx = it.p.x - x, dz = it.p.z - z, d = Math.hypot(dx, dz);
      if (d > r) continue;
      const vol = it.s.x * it.s.y * it.s.z;
      const f = power * (1 - d / r) / (0.4 + vol * 3);
      if (f < 0.6) continue;
      v.set(dx / (d + 0.1) * f, f * up, dz / (d + 0.1) * f);
      this.wake(it, v);
    }
  }
  update(dt) {
    const B = G.buildings;
    for (const it of this.active) {
      it.t += dt;
      it.v.y -= 14 * dt;
      it.p.addScaledVector(it.v, dt);
      const wl = it.w.length();
      if (wl > 0.01) { const dq = new THREE.Quaternion().setFromAxisAngle(this._s.copy(it.w).divideScalar(wl), wl * dt); it.q.premultiply(dq); }
      const floor = B.surfaceAt(it.p.x, it.p.z, it.p.y).y + it.s.y * 0.4;
      if (it.p.y < floor) {
        it.p.y = floor;
        if (it.v.y < -3) { it.v.y *= -0.25; it.v.x *= 0.55; it.v.z *= 0.55; it.w.multiplyScalar(0.5); if (Math.random() < 0.3) G.fx.dust(it.p.x, it.p.y, it.p.z, 0.25); }
        else { it.v.multiplyScalar(0.5); it.v.y = 0; it.w.multiplyScalar(0.6); }
        if (it.v.lengthSq() < 0.3 || it.t > 8) { this.settle(it); }
      }
      this.write(it);
    }
  }
}

const FIREBALL_FS = `uniform float t; uniform vec3 c1; varying vec3 vN; varying vec3 vP;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
void main(){ float n = n3(vP * 3.0 + t * 3.0) * 0.6 + n3(vP * 7.0 - t * 4.0) * 0.4;
  float rim = pow(1.0 - abs(vN.z), 1.5);
  float a = (1.0 - t) * (0.55 + 0.6 * n) * (1.0 - rim * 0.7);
  vec3 col = mix(c1 * 1.6, c1 * vec3(0.8, 0.35, 0.15), t + n * 0.3);
  gl_FragColor = vec4(col * 3.0, clamp(a, 0., 1.)); }`;
const FIREBALL_VS = `varying vec3 vN; varying vec3 vP; void main(){ vP = position; vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

export class FX {
  constructor(scene) {
    this.scene = scene;
    const soft = makeSoftSprite(), smoke = makeSmokeSprite();
    this.smoke = new Particles(5000, 'smoke', smoke, THREE.NormalBlending);
    this.fire = new Particles(3500, 'fire', soft, THREE.AdditiveBlending);
    this.spark = new Particles(2500, 'spark', soft, THREE.AdditiveBlending);
    this.bits = new Particles(2500, 'bits', soft, THREE.NormalBlending);
    this.ember = new Particles(1500, 'ember', soft, THREE.AdditiveBlending);
    for (const p of [this.smoke, this.bits, this.fire, this.spark, this.ember]) scene.add(p.points);
    this.fire.points.renderOrder = 2; this.spark.points.renderOrder = 3;
    this.debris = new Debris(scene);
    this.groundFires = [];
    this.anims = [];
    // pooled flash lights
    this.lights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffa050, 0, 40, 1.6); scene.add(l); this.lights.push({ l, t: 0, max: 1, i0: 0 }); }
    this.fireLights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff7a2a, 0, 22, 1.8); scene.add(l); this.fireLights.push(l); }
    this.fireLightT = 0;
    this.sphereGeo = new THREE.IcosahedronGeometry(1, 3);
    this.lumpGeos = [0, 1, 2].map((k) => {
      const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = 1 + 0.22 * Math.sin(x * 3.1 + k * 2) * Math.cos(y * 2.7 + k) + 0.14 * Math.sin(z * 5.3 + y * 4.1 + k * 3);
        p.setXYZ(i, x * n, y * n, z * n);
      }
      g.computeVertexNormals();
      return g;
    });
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2);
    this.craterGeo = this.makeCraterGeo();
    this.craterMesh = new THREE.InstancedMesh(this.craterGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), 400);
    this.craterMesh.count = 0; this.craterMesh.receiveShadow = true; this.craterMesh.castShadow = true;
    scene.add(this.craterMesh);
  }

  makeCraterGeo() {
    const pts = [[0, 0.03], [0.55, 0.05], [0.8, 0.14], [0.95, 0.32], [1.08, 0.3], [1.25, 0.1], [1.45, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 40);
    const pos = g.attributes.position, col = [];
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      const jitter = 1 + (Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 7) * 0.08);
      pos.setY(i, pos.getY(i) * jitter);
      const c = r < 0.7 ? 0.07 : r < 1.1 ? 0.2 : 0.3;
      col.push(c * 1.1, c * 0.95, c * 0.8);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  // ---------- helpers ----------
  smokePuff(x, y, z, size = 1, dark = 0.1, life = 7) {
    const c = dark;
    this.smoke.emit(x, y, z, rand(-0.3, 0.3), rand(0.6, 1.4), rand(-0.3, 0.3), size * rand(1.2, 2.0), life * rand(0.7, 1.3), c, c * 0.97, c * 0.95, 0.55);
  }
  dust(x, y, z, s = 1) {
    const n = Math.ceil(6 * s);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = rand(0.5, 2.5) * s;
      const c = rand(0.5, 0.62);
      this.smoke.emit(x + rand(-0.5, 0.5) * s, y + rand(0, 0.5), z + rand(-0.5, 0.5) * s, Math.cos(a) * sp, rand(0.2, 1), Math.sin(a) * sp,
        rand(1.2, 2.2) * s, rand(4, 9), c, c * 0.93, c * 0.84, 0.5);
    }
  }
  emitFire(x, y, z, n = 6, s = 1) {
    for (let i = 0; i < n; i++) this.fire.emit(x + rand(-0.4, 0.4) * s, y + rand(0, 0.4), z + rand(-0.4, 0.4) * s, rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), rand(0.4, 0.9) * s, rand(0.35, 0.7));
  }
  sparks(x, y, z, n, r = 4, g = 2.2, b = 0.8, speed = 8) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 1) * speed);
      this.spark.emit(x, y, z, v.x, v.y, v.z, rand(0.12, 0.3), rand(0.3, 1.0), r, g, b, 1);
    }
  }
  flash(x, y, z, color, intensity, dur = 0.4, dist = 50) {
    const L = this.lights.reduce((a, b) => (a.t / a.max > b.t / b.max ? a : b));
    L.l.position.set(x, y, z); L.l.color.set(color); L.l.distance = dist;
    L.i0 = intensity; L.t = 0; L.max = dur; L.l.intensity = intensity;
  }
  groundFire(x, y, z, dur = 20, s = 1) { this.groundFires.push({ x, y, z, t: dur, s }); }

  fireball(x, y, z, r, dur = 0.9, color = new THREE.Color(1, 0.55, 0.2)) {
    const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, c1: { value: color } }, vertexShader: FIREBALL_VS, fragmentShader: FIREBALL_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(this.lumpGeos[(Math.random() * 3) | 0], mat);
    m.position.set(x, y, z);
    m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    const sx = rand(0.75, 1.25), sy = rand(0.6, 1.1), sz = rand(0.75, 1.25), rise = rand(0.3, 0.8), spin = rand(-1, 1);
    this.scene.add(m);
    this.anims.push({ dur, t: 0, fn: (k) => { mat.uniforms.t.value = k; const s = r * (0.3 + Math.pow(k, 0.35) * 0.9); m.scale.set(s * sx, s * sy, s * sz); m.position.y = y + k * r * rise; m.rotation.y += spin * 0.02; },
      end: () => { this.scene.remove(m); mat.dispose(); } });
  }

  ring(x, y, z, r, dur, color, opacity = 0.6) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(x, y + 0.15, z);
    this.scene.add(m);
    this.anims.push({ dur, t: 0, fn: (k) => { const s = 0.5 + r * Math.pow(k, 0.5); m.scale.set(s, 1, s); mat.opacity = opacity * (1 - k); },
      end: () => { this.scene.remove(m); mat.dispose(); } });
  }

  crater(x, z, r) {
    const i = this.craterMesh.count;
    if (i >= 400) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6)), new THREE.Vector3(r, r * 0.55, r));
    this.craterMesh.setMatrixAt(i, m);
    this.craterMesh.count++;
    this.craterMesh.instanceMatrix.needsUpdate = true;
    G.ground && G.ground.scorch(x, z, r * 2.3, 0.85);
    G.city && G.city.addObstacle(x, z, r * 1.2, 'crater');
  }

  later(delay, fn) { this.anims.push({ dur: delay, t: 0, fn: () => {}, end: fn }); }

  // Explosion composite, built from several irregular lobes that bloom at slightly different times.
  // kind shapes it: 'bomb' compact and punchy, 'meteor' huge column + ground surge, 'small' car/gas blasts.
  explosion(x, y, z, s = 1, tint = null, kind = 'bomb') {
    const base = tint || new THREE.Color(1, 0.55, 0.2);
    const lobes = kind === 'meteor' ? 9 : kind === 'small' ? 3 : 5 + ((Math.random() * 3) | 0);
    for (let i = 0; i < lobes; i++) {
      const a = Math.random() * 6.283, rr = rand(0, 1.4) * s, delay = i === 0 ? 0 : rand(0.02, 0.28) * (kind === 'meteor' ? 2 : 1);
      const col = base.clone().offsetHSL(rand(-0.03, 0.02), 0, rand(-0.12, 0.05));
      this.later(delay, () => this.fireball(x + Math.cos(a) * rr, y + rand(0.2, 1.6) * s, z + Math.sin(a) * rr, rand(1.3, 2.6) * s, rand(0.7, 1.2) + s * 0.15, col));
    }
    this.flash(x, y + 3 * s, z, 0xffa860, 120 * s, 0.5 + s * 0.2, 45 * s);
    this.sparks(x, y + 0.5, z, 50 * s, 4, 2, 0.7, 14 * s);
    // flame tongues licking outwards (not a sphere): directional jets
    for (let j = 0; j < 7; j++) {
      const a = Math.random() * 6.283, up = rand(0.2, 1.2);
      for (let i = 0; i < 8 * s; i++) {
        const sp = rand(2, 7) * s;
        this.fire.emit(x + rand(-0.5, 0.5) * s, y + rand(0, 1) * s, z + rand(-0.5, 0.5) * s, Math.cos(a) * sp + rand(-1, 1), up * sp + rand(0, 2), Math.sin(a) * sp + rand(-1, 1), rand(0.9, 2.2) * s, rand(0.3, 0.8));
      }
    }
    // glowing embers drifting on the heat
    for (let i = 0; i < 70 * s; i++) {
      const a = Math.random() * 6.283, sp = rand(1, 7) * s;
      this.ember.emit(x, y + rand(0.3, 2) * s, z, Math.cos(a) * sp, rand(2, 8) * s, Math.sin(a) * sp, rand(0.05, 0.12), rand(2, 6), rand(3, 5), rand(1, 1.8), 0.2, 1);
    }
    // smoke: a rolling column with varied tones
    const col = kind === 'meteor' ? 70 : 38;
    for (let i = 0; i < col * s; i++) {
      const c = rand(0.06, 0.22), h = Math.random();
      const delay = rand(0, 0.6);
      this.later(delay, () => this.smoke.emit(x + rand(-1.5, 1.5) * s, y + (0.5 + h * 4) * s, z + rand(-1.5, 1.5) * s, rand(-1.4, 1.4) * s, rand(1.2, 4.5) * s * (1 - h * 0.5), rand(-1.4, 1.4) * s,
        rand(1.6, 3.4) * s, rand(8, 18), c * 1.05, c, c * 0.92, 0.7));
    }
    // ground surge of dust
    this.dust(x, 0.2, z, 2.2 * s);
    for (let i = 0; i < 24 * s; i++) {
      const a = Math.random() * 6.283, sp = rand(4, 9) * s, c = rand(0.45, 0.6);
      this.smoke.emit(x + Math.cos(a), 0.3, z + Math.sin(a), Math.cos(a) * sp, rand(0.2, 0.8), Math.sin(a) * sp, rand(1, 2) * s, rand(4, 8), c, c * 0.93, c * 0.84, 0.45);
    }
    this.ring(x, 0.05, z, 14 * s, 0.6, 0xffc080, 0.5);
    for (let i = 0; i < 40 * s; i++) {
      const a = Math.random() * 6.283, sp = rand(3, 12) * s, c = rand(0.15, 0.35);
      this.bits.emit(x, y + 0.5, z, Math.cos(a) * sp, rand(4, 12) * s, Math.sin(a) * sp, rand(0.06, 0.16), rand(1.5, 3), c, c * 0.9, c * 0.8, 1);
    }
    // secondary pops (gas lines, cars, debris flashes)
    const pops = kind === 'meteor' ? 5 : kind === 'small' ? 0 : 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < pops; i++) {
      const a = Math.random() * 6.283, r = rand(2, 5) * s;
      this.later(rand(0.4, 1.8), () => {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        this.fireball(px, rand(0.3, 1.5), pz, rand(0.8, 1.4) * s, 0.6, new THREE.Color(1, 0.5, 0.15));
        this.sparks(px, 0.6, pz, 20, 4, 2, 0.7, 7);
        this.flash(px, 2, pz, 0xff9040, 40, 0.3, 25);
      });
    }
    G.shake = Math.max(G.shake, 0.25 * s);
  }

  // laser/energy section blowouts: no big fireball, just a burst of molten material, sparks and dust
  blowout(x, y, z, hot = true) {
    this.sparks(x, y, z, 14, 5, 2.6, 1, 6);
    if (hot) for (let i = 0; i < 10; i++) this.ember.emit(x, y, z, rand(-2, 2), rand(0, 3), rand(-2, 2), rand(0.05, 0.1), rand(1, 3), 4, 1.6, 0.3, 1);
    this.dust(x, y, z, 0.5);
  }

  onBlast(x, y, z, r, power, kind) {
    this.smoke.push(x, y, z, r * 0.8, power * 0.6);
    if (kind !== 'collapse') this.debris.push(x, z, r * 0.45, power * 1.3, kind === 'wind' ? 0.35 : 0.9);
  }

  update(dt, camera, renderer) {
    // point size: world units -> pixels
    const scale = renderer.domElement.height * camera.projectionMatrix.elements[5] * 0.5;
    for (const p of [this.smoke, this.fire, this.spark, this.bits, this.ember]) { p.mat.uniforms.uScale.value = scale; p.update(dt); }
    this.debris.update(dt);
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k);
      if (k >= 1) { a.end && a.end(); this.anims.splice(i, 1); }
    }
    for (const L of this.lights) {
      if (L.l.intensity <= 0) continue;
      L.t += dt;
      L.l.intensity = L.t >= L.max ? 0 : L.i0 * Math.pow(1 - L.t / L.max, 2);
    }
    for (let i = this.groundFires.length - 1; i >= 0; i--) {
      const f = this.groundFires[i];
      f.t -= dt;
      if (f.t <= 0) { this.groundFires.splice(i, 1); continue; }
      const k = Math.min(1, f.t / 6);
      for (let n = 0; n < 2; n++) if (Math.random() < dt * 16 * k) this.fire.emit(f.x + rand(-0.5, 0.5) * f.s, f.y, f.z + rand(-0.5, 0.5) * f.s, rand(-0.15, 0.15), rand(1.5, 3), rand(-0.15, 0.15), rand(0.35, 0.75) * f.s, rand(0.35, 0.7));
      if (Math.random() < dt * 4 * k) this.smokePuff(f.x, f.y + 0.8, f.z, f.s, 0.08);
    }
    // fire glow lights follow burning cells near the camera focus
    this.fireLightT -= dt;
    const B = G.buildings, T = G.camTarget;
    if (this.fireLightT <= 0 && B && T) {
      this.fireLightT = 0.6;
      const near = B.burnArr.filter((c) => c.alive && c.fire > 0 && Math.hypot(c.x - T.x, c.z - T.z) < 50);
      this.fireLights.forEach((l, i) => {
        const c = near.length ? near[(Math.random() * near.length) | 0] : null;
        l.userData.on = !!c;
        if (c) l.position.set(c.x, c.y + c.hy + 0.5, c.z);
      });
    }
    for (const l of this.fireLights) l.intensity = l.userData.on ? 14 + Math.sin(G.time * 17 + l.id) * 4 + Math.random() * 3 : 0;
  }
}

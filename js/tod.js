// Day / sunset / night lighting states, blended smoothly when switching.
import * as THREE from 'three';
import { G, lerp } from './core.js';

const C = (h) => new THREE.Color(h);
export const PRESETS = {
  day: {
    sun: C(0xffeed6), sunI: 3.6, dir: new THREE.Vector3(-0.55, 0.72, -0.42).normalize(),
    sky: C(0xc4d8ff), gnd: C(0x8a7a62), hemiI: 0.7, exposure: 0.72, night: 0,
    horizon: C(0xdfe3e6), zenith: C(0x7fa6d6), glow: C(0xfff4e0), tint: C(0xffffff), envTop: [0.42, 0.6, 0.9], envHor: [0.95, 0.9, 0.82], envSun: [8, 7, 5],
  },
  sunset: {
    sun: C(0xff7a30), sunI: 4.6, dir: new THREE.Vector3(-0.78, 0.21, 0.5).normalize(),
    sky: C(0xb07a90), gnd: C(0x5a3a30), hemiI: 0.5, exposure: 0.8, night: 0.3,
    horizon: C(0xf49a5c), zenith: C(0x4a4f86), glow: C(0xffa050), tint: C(0xffeadb), envTop: [0.35, 0.33, 0.55], envHor: [1.2, 0.62, 0.35], envSun: [10, 5, 2],
  },
  night: {
    sun: C(0x7f9bff), sunI: 0.32, dir: new THREE.Vector3(0.35, 0.8, 0.25).normalize(),
    sky: C(0x1c2640), gnd: C(0x07090d), hemiI: 0.16, exposure: 1.0, night: 1,
    horizon: C(0x1a2436), zenith: C(0x05080f), glow: C(0x3a4a70), tint: C(0xe8eeff), envTop: [0.03, 0.04, 0.08], envHor: [0.12, 0.1, 0.12], envSun: [0.3, 0.35, 0.5],
  },
};

export class TimeOfDay {
  constructor({ scene, sun, hemi, post, renderer, fogDay }) {
    Object.assign(this, { scene, sun, hemi, post, renderer });
    this.fogDay = new THREE.Color(fogDay);
    this.mode = 'day';
    this.cur = this.snapshot(PRESETS.day, this.fogDay);
    this.target = this.cur;
    G.nightU = G.nightU || { value: 0 };
    this.sunDir = PRESETS.day.dir.clone();
    // sky dome so the horizon glows at sunset and goes dark at night
    this.skyU = { horizon: { value: new THREE.Color() }, zenith: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform vec3 horizon, zenith, glow, sunDir; varying vec3 vP;
        void main(){ float h = max(vP.y, 0.0);
          vec3 c = mix(horizon, zenith, pow(h, 0.55));
          float s = max(dot(normalize(vec3(vP.x, max(vP.y, 0.0), vP.z)), normalize(vec3(sunDir.x, 0.05, sunDir.z))), 0.0);
          c += glow * pow(s, 6.0) * (1.0 - h) * 0.9;
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.dome = dome;
    scene.add(dome);
  }

  snapshot(p, fog) {
    const fogC = p === PRESETS.day ? fog.clone() : p.horizon.clone().lerp(fog, p === PRESETS.sunset ? 0.12 : 0.05);
    return { ...p, sun: p.sun.clone(), sky: p.sky.clone(), gnd: p.gnd.clone(), dir: p.dir.clone(), fog: fogC,
      horizon: p === PRESETS.day ? fog.clone() : p.horizon.clone(), zenith: p.zenith.clone(), glow: p.glow.clone(), tint: p.tint.clone() };
  }

  set(mode, makeEnv) {
    if (!PRESETS[mode]) return;
    this.mode = mode;
    this.from = this.cur;
    this.target = this.snapshot(PRESETS[mode], this.fogDay);
    this.k = 0;
    const p = PRESETS[mode];
    if (makeEnv) this.scene.environment = makeEnv(p.envTop, p.envHor, p.envSun);
  }

  cycle(makeEnv) {
    const order = ['day', 'sunset', 'night'];
    this.set(order[(order.indexOf(this.mode) + 1) % 3], makeEnv);
    return this.mode;
  }

  update(dt) {
    if (this.from && this.k < 1) {
      this.k = Math.min(1, this.k + dt / 1.1);
      const t = this.k * this.k * (3 - 2 * this.k), a = this.from, b = this.target;
      const o = (this.cur = { ...b });
      for (const key of ['sun', 'sky', 'gnd', 'fog', 'horizon', 'zenith', 'glow', 'tint']) o[key] = a[key].clone().lerp(b[key], t);
      for (const key of ['sunI', 'hemiI', 'exposure', 'night']) o[key] = lerp(a[key], b[key], t);
      o.dir = a.dir.clone().lerp(b.dir, t).normalize();
    }
    const c = this.cur;
    this.sun.color.copy(c.sun); this.sun.intensity = c.sunI;
    this.hemi.color.copy(c.sky); this.hemi.groundColor.copy(c.gnd); this.hemi.intensity = c.hemiI;
    this.sunDir.copy(c.dir);
    if (this.scene.fog) this.scene.fog.color.copy(c.fog);
    this.scene.background = c.fog;
    this.post.final.uniforms.exposure.value = c.exposure;
    this.post.final.uniforms.tint.value.copy(c.tint);
    G.night = c.night; G.nightU.value = c.night;
    this.skyU.horizon.value.copy(c.horizon); this.skyU.zenith.value.copy(c.zenith); this.skyU.glow.value.copy(c.glow);
    this.skyU.sunDir.value.copy(c.dir);
    if (G.camera) this.dome.position.copy(G.camera.position);
  }
}

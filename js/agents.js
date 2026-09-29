import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { sfx } from './audio.js';

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0), XAX = new THREE.Vector3(1, 0, 0), ZAX = new THREE.Vector3(0, 0, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const CAR_COLORS = [0xf2f2f0, 0x1c1d20, 0x8a9096, 0xb4bac0, 0x9e1b1b, 0x1e3f73, 0x2f5d3a, 0xd9c7a0, 0x5a1f2b, 0x3a3f46, 0xcfd6dc, 0x7a5230];
const SHIRTS = [0xe8e4dc, 0x2b2d33, 0xb33a3a, 0x3565a8, 0xe0b640, 0x4f7f4a, 0xd87a3a, 0x9a5fb0, 0xf0f0f0, 0x6fb3c9, 0xc94f7c, 0x1f2a44, 0x8a8f96];
const PANTS = [0x2a3448, 0x1f1f22, 0x5a5044, 0x7b8794, 0x3c4a3a, 0xb8ad96, 0x33415e];
const SKIN = [0xe8c4a8, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0, 0xb07e5a];
const HAIR = [0x1a1410, 0x2e2118, 0x5a3b22, 0x8a6a3a, 0xc9a86a, 0x6b6b6b, 0x0e0e0e];
const EMERG_TYPES = ['police', 'police', 'police', 'police', 'police', 'fire', 'fire', 'fire', 'fire', 'ambulance', 'ambulance', 'ambulance', 'ambulance', 'police'];

export function carGeos() {
  const body = mergeGeometries([
    new THREE.BoxGeometry(0.66, 0.2, 1.55).translate(0, 0.2, 0),
    new THREE.BoxGeometry(0.6, 0.035, 0.74).translate(0, 0.505, -0.08),
    new THREE.BoxGeometry(0.64, 0.06, 0.36).translate(0, 0.31, 0.56),
  ]);
  const wheel = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10).rotateZ(Math.PI / 2);
  const dark = mergeGeometries([
    new THREE.BoxGeometry(0.58, 0.2, 0.72).translate(0, 0.39, -0.08),
    wheel.clone().translate(0.3, 0.12, 0.48), wheel.clone().translate(-0.3, 0.12, 0.48),
    wheel.clone().translate(0.3, 0.12, -0.5), wheel.clone().translate(-0.3, 0.12, -0.5),
  ]);
  return { body, dark };
}

function beamTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 120, 2, 32, 90, 90);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  return new THREE.CanvasTexture(c);
}

export class Agents {
  constructor(scene, city, opts) {
    this.city = city;
    this.cars = []; this.peds = [];
    this.incidents = [];
    const E = (this.EMERG = EMERG_TYPES.length);
    const { body, dark } = carGeos();
    const stationed = city.stationed || [];
    const nCars = opts.cars + city.parked.length + E + stationed.length;
    this.carBody = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4, envMapIntensity: 1.2 }), nCars);
    this.carDark = new THREE.InstancedMesh(dark, new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.15, metalness: 0.7 }), nCars);
    for (const m of [this.carBody, this.carDark]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }

    // head/tail lamps (always present, bright at night) + headlight pools on the road
    const lampPair = (z, w, h) => mergeGeometries([new THREE.BoxGeometry(0.13, 0.06, 0.03).translate(-w, h, z), new THREE.BoxGeometry(0.13, 0.06, 0.03).translate(w, h, z)]);
    this.headL = new THREE.InstancedMesh(lampPair(0.785, 0.22, 0.26), new THREE.MeshBasicMaterial({ color: 0xffffff }), nCars);
    this.tailL = new THREE.InstancedMesh(lampPair(-0.785, 0.24, 0.27), new THREE.MeshBasicMaterial({ color: 0xffffff }), nCars);
    const poolGeo = new THREE.PlaneGeometry(1.5, 3.6).rotateX(-Math.PI / 2).translate(0, 0.035, 2.5);
    this.headPool = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x000000 }), nCars);
    for (const m of [this.headL, this.tailL, this.headPool]) { m.frustumCulled = false; scene.add(m); }
    this.headPool.renderOrder = 1;
    // emergency light bars
    this.beacons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.07, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }), E * 2);
    this.beacons.frustumCulled = false; scene.add(this.beacons);
    this.beaconLights = []; // light bars glow on their own; no point lights (they cost every lit pixel)

    // pedestrians: articulated just enough to read as people from far above
    const torso = mergeGeometries([
      new THREE.CylinderGeometry(0.066, 0.056, 0.24, 8).scale(1, 1, 0.62).translate(0, 0.43, 0),
      new THREE.CylinderGeometry(0.02, 0.024, 0.05, 5).translate(0, 0.57, 0),
    ]);
    const head = new THREE.SphereGeometry(0.048, 10, 8).scale(0.92, 1.08, 0.98).translate(0, 0.625, 0);
    const hair = new THREE.SphereGeometry(0.052, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.52).translate(0, 0.632, -0.005);
    const leg = new THREE.CylinderGeometry(0.027, 0.02, 0.31, 6).translate(0, -0.155, 0);
    const arm = new THREE.CylinderGeometry(0.018, 0.014, 0.24, 5).translate(0, -0.12, 0);
    this.crowdSpots = city.crowds || [];
    const nCrowd = this.crowdSpots.reduce((a, c) => a + c.n, 0);
    const nP = opts.peds + nCrowd;
    const pm = () => new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.pTorso = new THREE.InstancedMesh(torso, pm(), nP);
    this.pHead = new THREE.InstancedMesh(head, pm(), nP);
    this.pHair = new THREE.InstancedMesh(hair, pm(), nP);
    this.pLegL = new THREE.InstancedMesh(leg, pm(), nP);
    this.pLegR = new THREE.InstancedMesh(leg, this.pLegL.material, nP);
    this.pArmL = new THREE.InstancedMesh(arm, pm(), nP);
    this.pArmR = new THREE.InstancedMesh(arm, this.pArmL.material, nP);
    this.pMeshes = [this.pTorso, this.pHead, this.pHair, this.pLegL, this.pLegR, this.pArmL, this.pArmR];
    for (const m of this.pMeshes) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }

    for (let i = 0; i < opts.cars; i++) this.spawnCar(i);
    city.parked.forEach((p, i) => this.spawnParked(opts.cars + i, p));
    for (let i = 0; i < E; i++) this.spawnEmergency(opts.cars + city.parked.length + i, EMERG_TYPES[i]);
    // police posted at events: parked with lights going, sirens silent, never dispatched
    stationed.forEach((st, k) => {
      this.spawnEmergency(opts.cars + city.parked.length + E + k, 'police');
      const c = this.cars[this.cars.length - 1];
      c.state = 'onscene'; c.posted = true; c.sirenOffAt = -1; c.pos.set(st.x, 0, st.z); c.heading = st.rot;
    });
    let pi = 0;
    for (; pi < opts.peds; pi++) this.spawnPed(pi, opts.wanderFrac || 0);
    for (const spot of this.crowdSpots) for (let k = 0; k < spot.n; k++) this.spawnCrowdPed(pi++, spot, k);
    this.carBody.instanceColor.needsUpdate = true;
    this.grid = new Map();
    this.sirenT = 0; this.fireCheckT = 5;
    G.emergency = this;
  }

  // ---------- cars ----------
  carColor() {
    const r = Math.random();
    if (r < 0.07) return new THREE.Color(0xf2c230); // taxi
    return new THREE.Color(pick(CAR_COLORS));
  }
  newCar(i, type) {
    const scale = type === 'bus' ? [1.15, 1.7, 3.2] : type === 'van' ? [1.05, 1.35, 1.35] : type === 'suv' ? [1.06, 1.12, 1.08] : [1, 1, rand(0.95, 1.05)];
    const c = { i, pos: new THREE.Vector3(), heading: 0, speed: 0, queue: [], state: 'drive', vel: new THREE.Vector3(), q: new THREE.Quaternion(),
      w: new THREE.Vector3(), scale, maxSpeed: rand(3.2, 4.4) * (type === 'bus' ? 0.75 : 1), color: type === 'bus' ? new THREE.Color(0xe8e4d8) : this.carColor(),
      len: 0.8 * scale[2], timer: 0, stuck: 0, flee: 0, fire: 0 };
    this.carBody.setColorAt(i, c.color);
    return c;
  }
  spawnCar(i, replace = null) {
    const r = Math.random();
    const c = this.newCar(i, r < 0.05 ? 'bus' : r < 0.14 ? 'van' : r < 0.3 ? 'suv' : 'car');
    const C = this.city;
    let edges = [...C.edges.values()].filter((e) => !e.blocked);
    const hs = C.hotspot;
    if (hs && Math.random() < 0.5) {
      const near = edges.filter((e) => Math.hypot((C.nodes[e.a].x + C.nodes[e.b].x) / 2 - hs.x, (C.nodes[e.a].z + C.nodes[e.b].z) / 2 - hs.z) < hs.r);
      if (near.length) edges = near;
    }
    for (let tries = 0; tries < 30; tries++) {
      const e = pick(edges);
      const [a, b] = Math.random() < 0.5 ? [e.a, e.b] : [e.b, e.a];
      const A = C.nodes[a], B = C.nodes[b];
      const t = rand(0.25, 0.75);
      const d = _v.set(B.x - A.x, 0, B.z - A.z).normalize();
      const off = C.roadW / 4;
      const x = A.x + (B.x - A.x) * t - d.z * off, z = A.z + (B.z - A.z) * t + d.x * off;
      if (this.cars.some((o) => o.pos.distanceTo(_p.set(x, 0, z)) < 3)) continue;
      if (replace && G.camTarget && Math.hypot(x - G.camTarget.x, z - G.camTarget.z) < 40 && tries < 25) continue;
      c.pos.set(x, 0, z); c.heading = Math.atan2(d.x, d.z); c.from = a; c.to = b;
      c.queue = [this.stopPoint(A, B)];
      c.speed = c.maxSpeed * 0.6;
      break;
    }
    if (replace) this.cars[this.cars.indexOf(replace)] = c; else this.cars.push(c);
  }
  spawnParked(i, p) {
    const c = this.newCar(i, Math.random() < 0.2 ? 'suv' : 'car');
    c.state = 'parked'; c.pos.set(p.x, 0, p.z); c.heading = p.rot + (Math.random() < 0.5 ? Math.PI : 0);
    this.cars.push(c);
  }
  spawnEmergency(i, type) {
    const c = this.newCar(i, 'car');
    c.emerg = type; c.state = 'hidden'; c.maxSpeed = 5.6;
    c.scale = type === 'fire' ? [1.2, 1.45, 2.6] : type === 'ambulance' ? [1.1, 1.45, 1.4] : [1, 0.98, 1.06];
    c.len = 0.8 * c.scale[2];
    c.color = new THREE.Color(type === 'fire' ? 0xb3140f : type === 'ambulance' ? 0xf4f4f0 : 0xeeeeea);
    this.carBody.setColorAt(i, c.color);
    c.ei = this.cars.filter((o) => o.emerg).length;
    this.cars.push(c);
  }
  laneDir(A, B) { return _v.set(B.x - A.x, 0, B.z - A.z).normalize().clone(); }
  stopPoint(A, B) {
    const C = this.city, d = this.laneDir(A, B), off = C.roadW / 4, back = C.roadW / 2 + 2.3;
    return { x: B.x - d.x * back - d.z * off, z: B.z - d.z * back + d.x * off, stop: true, node: B.id, axis: Math.abs(d.x) > 0.5 ? 'x' : 'z' };
  }
  entryPoint(A, B) {
    const C = this.city, d = this.laneDir(A, B), off = C.roadW / 4, fwd = C.roadW / 2 + 1.0;
    return { x: A.x + d.x * fwd - d.z * off, z: A.z + d.z * fwd + d.x * off };
  }
  // breadth-first route over unblocked streets; returns the next node to take from `from`
  route(from, prev, dest) {
    const C = this.city;
    if (from === dest) return null;
    const came = new Map([[from, -1]]), q = [from];
    while (q.length) {
      const n = q.shift();
      if (n === dest) break;
      for (const m of C.nodes[n].edges) {
        if (came.has(m) || C.edge(n, m).blocked) continue;
        if (n === from && m === prev && C.nodes[from].edges.length > 1) continue;
        came.set(m, n); q.push(m);
      }
    }
    if (!came.has(dest)) return undefined;
    let n = dest;
    while (came.get(n) !== from) n = came.get(n);
    return n;
  }
  chooseNext(c) {
    const C = this.city, B = C.nodes[c.to];
    if (c.dest != null) {
      const n = this.route(c.to, c.from, c.dest);
      if (n != null) return n;
    }
    let opts = B.edges.filter((n) => n !== c.from && !C.edge(B.id, n).blocked);
    if (!opts.length) opts = B.edges.filter((n) => !C.edge(B.id, n).blocked);
    if (!opts.length) return null;
    if (c.flee > 0 && c.threat) {
      opts.sort((a, b) => Math.hypot(C.nodes[b].x - c.threat.x, C.nodes[b].z - c.threat.z) - Math.hypot(C.nodes[a].x - c.threat.x, C.nodes[a].z - c.threat.z));
      return opts[0];
    }
    // mild preference for going straight
    const A = C.nodes[c.from], d = this.laneDir(A, B);
    const straight = opts.find((n) => { const N = C.nodes[n]; return this.laneDir(B, N).dot(d) > 0.9; });
    if (straight !== undefined && Math.random() < 0.55) return straight;
    return pick(opts);
  }
  planTurn(c, nextId) {
    const C = this.city, A = C.nodes[c.from], B = C.nodes[c.to], N = C.nodes[nextId];
    const p0 = { x: c.pos.x, z: c.pos.z }, p2 = this.entryPoint(B, N);
    let ctrl;
    if (nextId === c.from) {
      const d = this.laneDir(A, B);
      ctrl = { x: B.x + d.x * 1.5, z: B.z + d.z * 1.5 };
    } else {
      const d1 = this.laneDir(A, B), d2 = this.laneDir(B, N), off = C.roadW / 4;
      ctrl = Math.abs(d1.dot(d2)) > 0.9 ? { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 }
        : { x: B.x - d1.z * off - d2.z * off, z: B.z + d1.x * off + d2.x * off };
    }
    const pts = [];
    for (let k = 1; k <= 5; k++) {
      const t = k / 5, u = 1 - t;
      pts.push({ x: u * u * p0.x + 2 * u * t * ctrl.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * ctrl.z + t * t * p2.z });
    }
    c.from = c.to; c.to = nextId;
    c.queue = [...pts, this.stopPoint(B, N)];
  }
  uTurn(c) {
    const C = this.city, A = C.nodes[c.from], B = C.nodes[c.to];
    const d = this.laneDir(A, B), off = C.roadW / 4;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    c.queue = [
      { x: c.pos.x + fx * 0.7 + d.z * off * 0.8, z: c.pos.z + fz * 0.7 - d.x * off * 0.8 },
      { x: c.pos.x - fx * 0.3 + d.z * off * 2, z: c.pos.z - fz * 0.3 - d.x * off * 2 },
      this.stopPoint(B, A),
    ];
    [c.from, c.to] = [c.to, c.from];
    c.stuck = 0;
  }

  updateCar(c, dt) {
    const C = this.city;
    if (c.state === 'hidden') return;
    if (c.state === 'air') return this.updateAir(c, dt, true);
    if (c.fire > 0) {
      c.fire -= dt;
      if (Math.random() < dt * 18) G.fx.fire.emit(c.pos.x + rand(-0.3, 0.3), c.pos.y + 0.45, c.pos.z + rand(-0.3, 0.3), rand(-0.15, 0.15), rand(1.5, 2.6), rand(-0.15, 0.15), rand(0.35, 0.7), rand(0.35, 0.7));
      if (Math.random() < dt * 5) G.fx.smokePuff(c.pos.x, c.pos.y + 0.8, c.pos.z, 0.9, 0.06);
    }
    if (c.state === 'wreck' || c.state === 'parked' || c.state === 'onscene') { c.speed = 0; return; }
    if (c.timer > 0) { c.timer -= dt; c.speed = Math.max(0, c.speed - 14 * dt); this.moveCar(c, dt); return; }
    if (c.flee > 0) c.flee -= dt;
    if (c.leaving && G.camTarget && Math.hypot(c.pos.x - G.camTarget.x, c.pos.z - G.camTarget.z) > 60) {
      c.leaving = false; c.state = 'hidden'; if (c.siren) { c.siren.stop(true); c.siren = null; } return;
    }
    // responders pull up and park once they're close to the incident
    if (c.incident && Math.hypot(c.pos.x - c.incident.x, c.pos.z - c.incident.z) < 10 + c.ei % 3 * 2) { this.arrive(c); return; }
    if (!c.queue.length) {
      if (c.dest != null && c.to === c.dest) { this.arrive(c); return; }
      const n = this.chooseNext(c);
      if (n === null) { c.speed = 0; return; }
      this.planTurn(c, n);
    }
    const wp = c.queue[0];
    const dx = wp.x - c.pos.x, dz = wp.z - c.pos.z, dist = Math.hypot(dx, dz);
    let target = c.maxSpeed * (c.flee > 0 ? 1.6 : 1);
    if (wp.stop) {
      const node = C.nodes[wp.node];
      const calm = c.flee <= 0 && !c.emerg;
      const mustStop = calm && node.lit && !C.green(node, wp.axis);
      const stopSign = calm && !node.lit && node.edges.length >= 3;
      if (mustStop || (stopSign && !wp.done)) {
        target = Math.min(target, Math.sqrt(2 * 9 * Math.max(0, dist - 0.05)));
        if (dist < 0.25 && stopSign) { wp.done = true; c.timer = rand(0.5, 1.0); }
      } else if (dist < 0.6) { c.queue.shift(); }
    } else if (dist < 0.6) c.queue.shift();
    // steering
    const want = Math.atan2(dx, dz);
    let diff = want - c.heading;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    c.heading += clamp(diff, -3 * dt, 3 * dt) * Math.min(1, c.speed / 1.2 + 0.4);
    target *= Math.abs(diff) > 0.5 ? 0.5 : 1;
    // car following / pedestrian braking / obstacle avoidance
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    for (const o of this.cars) {
      if (o === c || o.state === 'hidden') continue;
      const ox = o.pos.x - c.pos.x, oz = o.pos.z - c.pos.z;
      const along = ox * fx + oz * fz;
      if (along <= 0 || along > 4) continue;
      const lat = Math.abs(ox * fz - oz * fx);
      if (lat < 0.55 + (o.state === 'wreck' || o.state === 'parked' ? 0.15 : 0)) target = Math.min(target, Math.max(0, (along - c.len - o.len - 0.3) * 2.2));
    }
    const hx = c.pos.x + fx * 1.2, hz = c.pos.z + fz * 1.2;
    const cell = this.grid.get(this.gk(hx, hz));
    if (cell) for (const p of cell) if (p.state !== 'air' && Math.hypot(p.pos.x - hx, p.pos.z - hz) < 0.8) target = Math.min(target, 0);
    // yield to trolleys at the transit-mall crossings
    if (G.trains && (G.trains.blocks(c.pos.x + fx * 1.8, c.pos.z + fz * 1.8) || G.trains.blocks(c.pos.x + fx * 3.6, c.pos.z + fz * 3.6))) target = 0;
    const obs = C.obstacleNear(c.pos.x + fx * 2, c.pos.z + fz * 2, 0.7);
    if (obs) target = 0;
    if (target < 0.1 && (obs || c.speed < 0.1)) {
      c.stuck += dt;
      if (c.stuck > (obs ? 1.5 : 12)) { if (c.incident && obs) { this.arrive(c); return; } this.uTurn(c); }
    } else c.stuck = Math.max(0, c.stuck - dt);
    c.braking = target < c.speed - 0.3;
    const acc = target > c.speed ? 3.5 : 12;
    c.speed += clamp(target - c.speed, -acc * dt, acc * dt);
    this.moveCar(c, dt);
  }
  moveCar(c, dt) {
    c.pos.x += Math.sin(c.heading) * c.speed * dt;
    c.pos.z += Math.cos(c.heading) * c.speed * dt;
  }

  updateAir(a, dt, isCar) {
    const B = G.buildings;
    a.vel.y -= 14 * dt;
    _v.copy(a.vel).multiplyScalar(dt);
    a.pos.add(_v);
    const wl = a.w.length();
    if (wl > 0.01) { _q.setFromAxisAngle(_s.copy(a.w).divideScalar(wl), wl * dt); a.q.premultiply(_q); }
    const hitCell = B.inside(_p.set(a.pos.x, a.pos.y + 0.3, a.pos.z));
    if (hitCell) {
      a.pos.sub(_v); a.vel.x *= -0.3; a.vel.z *= -0.3;
      if (isCar) B.damage(hitCell, Math.min(60, a.vel.length() * 8), 0, a.pos);
    }
    const floor = B.surfaceAt(a.pos.x, a.pos.z, a.pos.y + 0.2).y;
    if (a.pos.y <= floor) {
      a.pos.y = floor;
      if (a.vel.y < -3) {
        a.vel.y *= -0.3; a.vel.x *= 0.6; a.vel.z *= 0.6; a.w.multiplyScalar(0.6);
        if (isCar) { G.fx.dust(a.pos.x, a.pos.y, a.pos.z, 0.4); G.fx.sparks(a.pos.x, a.pos.y + 0.2, a.pos.z, 8, 3, 2, 1, 4); sfx.crumble(a.pos.x, a.pos.z, 0.7); }
      } else {
        a.vel.multiplyScalar(Math.max(0, 1 - dt * 6)); a.vel.y = 0; a.w.multiplyScalar(Math.max(0, 1 - dt * 5));
        if (a.vel.lengthSq() < 0.05) this.land(a, isCar);
      }
    }
  }
  land(a, isCar) {
    // settle upright or on its roof, keeping yaw
    const up = _v.set(0, 1, 0).applyQuaternion(a.q);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(a.q);
    a.heading = Math.atan2(fwd.x, fwd.z);
    a.flipped = up.y < 0;
    if (isCar) {
      a.state = 'wreck';
      a.incident = null; a.dest = null;
      if (a.siren) { a.siren.stop(); a.siren = null; }
      if (a.obs) { const k = this.city.obstacles.indexOf(a.obs); if (k >= 0) this.city.obstacles.splice(k, 1); }
      a.obs = { x: a.pos.x, z: a.pos.z, r: 0.9, kind: 'wreck' };
      this.city.obstacles.push(a.obs);
      this.carBody.setColorAt(a.i, a.color.clone().multiplyScalar(a.fire > 0 ? 0.25 : 0.6));
      this.carBody.instanceColor.needsUpdate = true;
    } else {
      a.state = 'down'; a.timer = rand(1.5, 3.5);
    }
  }
  launch(a, dir, f, up, isCar, spin = 6) {
    a.state = 'air';
    if (!a.q || a.q.lengthSq() === 0 || !a.airborneBefore) a.q.setFromAxisAngle(UP, a.heading);
    if (a.flipped) a.q.multiply(_q.setFromAxisAngle(ZAX, Math.PI));
    a.airborneBefore = true; a.flipped = false;
    a.vel.set(dir.x * f, up, dir.z * f);
    a.w.set(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin));
    if (a.pos.y < 0.02) a.pos.y = 0.02;
  }

  // ---------- first responders ----------
  report(x, z, sev = 1) {
    for (const inc of this.incidents) if (Math.hypot(inc.x - x, inc.z - z) < 28) { inc.sev = Math.max(inc.sev, sev); return; }
    this.incidents.push({ x, z, sev, delay: rand(3, 7), sent: false });
  }
  dispatch(inc) {
    inc.sent = true;
    const want = ['police', 'fire', 'ambulance'];
    if (inc.sev > 1.5) want.push('police', 'fire');
    if (inc.sev > 2.5) want.push('ambulance', 'fire');
    const hs = this.city.hotspot;
    if (hs && Math.hypot(inc.x - hs.x, inc.z - hs.z) < hs.r + 15) want.push('police', 'police');
    const C = this.city;
    const target = C.nodes.filter((n) => !n.dead && n.edges.length).sort((a, b) => Math.hypot(a.x - inc.x, a.z - inc.z) - Math.hypot(b.x - inc.x, b.z - inc.z))[0];
    const starts = C.nodes.filter((n) => !n.dead && n.edges.length && Math.hypot(n.x - inc.x, n.z - inc.z) > 45);
    want.forEach((type, k) => {
      const c = this.cars.find((o) => o.emerg === type && o.state === 'hidden' && !o.posted);
      if (!c || !starts.length) return;
      setTimeout(() => {
        const A = pick(starts);
        const nb = A.edges.filter((m) => !C.edge(A.id, m).blocked);
        if (!nb.length) return;
        const B = C.nodes[pick(nb)];
        const e = this.entryPoint(A, B);
        c.pos.set(e.x, 0, e.z); c.heading = Math.atan2(B.x - A.x, B.z - A.z);
        c.from = A.id; c.to = B.id; c.queue = [this.stopPoint(A, B)];
        c.state = 'drive'; c.speed = 2; c.dest = target.id; c.incident = inc; c.flee = 0; c.sirenOn = true;
        c.sirenOffAt = G.time + rand(40, 60); // even en route, sirens eventually wind down
      }, k * rand(900, 2200));
    });
  }
  // scene cleared: responders drive off and return to the pool once out of sight
  release(inc) {
    for (const c of this.cars) {
      if (c.incident !== inc) continue;
      c.incident = null; c.dest = null; c.leaving = true; c.sirenOn = false; c.sirenOffAt = G.time;
      if (c.state === 'onscene') { c.state = 'drive'; c.speed = 0.5; c.queue = []; }
    }
    const k = this.incidents.indexOf(inc); if (k >= 0) this.incidents.splice(k, 1);
  }
  arrive(c) {
    c.state = 'onscene'; c.speed = 0; c.queue = [];
    c.sirenOffAt = Math.min(c.sirenOffAt ?? 1e9, G.time + rand(8, 15));
    // angle the vehicle a little, the way responders park
    c.heading += rand(-0.35, 0.35);
  }
  updateEmergency(dt) {
    for (const inc of this.incidents) {
      if (inc.sent) continue;
      inc.delay -= dt;
      if (inc.delay <= 0) this.dispatch(inc);
    }
    // large fires with nobody attending also get reported
    this.fireCheckT -= dt;
    if (this.fireCheckT <= 0) {
      this.fireCheckT = 4;
      const b = G.buildings.burnArr;
      if (b.length > 6) { const c = pick(b); if (c && c.alive) this.report(c.x, c.z, Math.min(3, b.length / 30)); }
    }
    // only the nearest few sirens are audible at once
    this.sirenT -= dt;
    if (this.sirenT <= 0) {
      this.sirenT = 0.4;
      const T = G.camTarget;
      const active = this.cars.filter((c) => c.emerg && (c.state === 'drive' || c.state === 'onscene') && G.time < (c.sirenOffAt ?? 1e9));
      active.sort((a, b) => Math.hypot(a.pos.x - T.x, a.pos.z - T.z) - Math.hypot(b.pos.x - T.x, b.pos.z - T.z));
      const keep = new Set(active.slice(0, 3));
      for (const c of this.cars) {
        if (!c.emerg) continue;
        if (keep.has(c)) { if (!c.siren) c.siren = sfx.siren(c.emerg); if (c.siren) c.siren.set(c.pos.x, c.pos.z, true); }
        else if (c.siren) { c.siren.stop(G.time >= (c.sirenOffAt ?? 1e9)); c.siren = null; }
      }
    }
  }

  // ---------- pedestrians ----------
  pedColors(i) {
    const shirt = new THREE.Color(pick(SHIRTS)), skin = new THREE.Color(pick(SKIN));
    this.pTorso.setColorAt(i, shirt);
    this.pArmL.setColorAt(i, Math.random() < 0.4 ? skin : shirt);
    const pants = new THREE.Color(pick(PANTS));
    this.pLegL.setColorAt(i, pants); this.pLegR.setColorAt(i, pants);
    this.pArmR.setColorAt(i, this.pArmL.instanceColor ? new THREE.Color().fromArray(this.pArmL.instanceColor.array, i * 3) : shirt);
    this.pHead.setColorAt(i, skin);
    this.pHair.setColorAt(i, new THREE.Color(pick(HAIR)));
  }
  newPed(i) {
    return { i, pos: new THREE.Vector3(), heading: 0, state: 'walk', speed: rand(0.7, 1.1), lat: rand(-0.35, 0.35), vel: new THREE.Vector3(),
      q: new THREE.Quaternion(), w: new THREE.Vector3(), timer: 0, phase: rand(0, 6), s: rand(0.88, 1.08) };
  }
  spawnPed(i, wanderFrac) {
    const C = this.city;
    const p = this.newPed(i);
    const zones = C.wanderZones;
    if (zones.length && Math.random() < wanderFrac) {
      p.zone = pick(zones);
      p.state = 'wander';
      p.pos.set(rand(p.zone.x0, p.zone.x1), 0, rand(p.zone.z0, p.zone.z1));
      p.target = { x: rand(p.zone.x0, p.zone.x1), z: rand(p.zone.z0, p.zone.z1) };
      if (Math.random() < 0.3) { p.state = 'idle'; p.timer = rand(5, 40); }
    } else {
      let nodes = C.pedNodes.filter((n) => n.edges.length);
      const hs = C.hotspot;
      if (hs && Math.random() < 0.55) { const near = nodes.filter((n) => Math.hypot(n.x - hs.x, n.z - hs.z) < hs.r); if (near.length) nodes = near; }
      const n = pick(nodes), e = pick(n.edges.filter((e) => !e.light)) || n.edges[0];
      const t = Math.random(), m = C.pedNodes[e.to];
      p.pos.set(n.x + (m.x - n.x) * t, 0, n.z + (m.z - n.z) * t);
      p.from = n.id; p.to = m.id;
    }
    this.pedColors(i);
    this.peds.push(p);
  }
  // people standing around in small groups: outside shops, at corners, bus stops, plazas
  spawnCrowdPed(i, spot, k) {
    const p = this.newPed(i);
    const a = (k / spot.n) * 6.283 + rand(-0.3, 0.3), r = spot.r * rand(0.5, 1);
    p.pos.set(spot.x + Math.cos(a) * r, 0, spot.z + Math.sin(a) * r);
    p.group = { x: spot.x, z: spot.z };
    p.zone = { x0: spot.x - spot.r, x1: spot.x + spot.r, z0: spot.z - spot.r, z1: spot.z + spot.r };
    p.state = 'idle'; p.timer = rand(4, 40); p.target = { x: p.pos.x, z: p.pos.z };
    p.heading = Math.atan2(spot.x - p.pos.x, spot.z - p.pos.z);
    this.pedColors(i);
    if (spot.uniform) { const u = new THREE.Color(spot.uniform); for (const m of [this.pTorso, this.pArmL, this.pArmR, this.pLegL, this.pLegR]) m.setColorAt(i, u); p.officer = true; }
    this.peds.push(p);
  }
  pedTarget(p) {
    const C = this.city, a = C.pedNodes[p.from], b = C.pedNodes[p.to];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    return { x: b.x - dz / l * p.lat, z: b.z + dx / l * p.lat };
  }
  nextPedEdge(p) {
    const C = this.city, n = C.pedNodes[p.to];
    let opts = n.edges.filter((e) => e.to !== p.from);
    if (!opts.length) opts = n.edges;
    opts = opts.filter((e) => { const m = C.pedNodes[e.to]; return !C.obstacleNear((n.x + m.x) / 2, (n.z + m.z) / 2, 0.8); });
    if (!opts.length) { [p.from, p.to] = [p.to, p.from]; return; }
    const e = pick(opts);
    p.pending = e;
  }
  updatePed(p, dt) {
    const C = this.city;
    switch (p.state) {
      case 'air': return this.updateAir(p, dt, false);
      case 'down':
        p.timer -= dt;
        if (p.timer <= 0) { p.state = 'flee'; p.timer = rand(4, 8); p.q.identity(); }
        return;
      case 'alert':
        p.timer -= dt;
        if (p.threat) p.heading = Math.atan2(p.threat.x - p.pos.x, p.threat.z - p.pos.z);
        if (p.timer <= 0) { p.state = 'flee'; p.timer = rand(5, 9); }
        return;
      case 'flee': {
        p.timer -= dt;
        const t = p.threat || p.pos;
        let dx = p.pos.x - t.x, dz = p.pos.z - t.z;
        const l = Math.hypot(dx, dz) || 1;
        let want = Math.atan2(dx / l, dz / l) + Math.sin(G.time * 2 + p.phase) * 0.4;
        let moved = false;
        for (const off of [0, 0.8, -0.8, 1.6, -1.6, 2.6]) {
          const h = want + off, sp = p.speed * 3.2;
          const nx = p.pos.x + Math.sin(h) * sp * dt * 6, nz = p.pos.z + Math.cos(h) * sp * dt * 6;
          if (!G.buildings.inside(_p.set(nx, 0.3, nz)) && !C.obstacleNear(nx, nz, 0.2) && Math.abs(nx) < C.half + 10 && Math.abs(nz) < C.half + 10) {
            p.heading = h; p.pos.x += Math.sin(h) * sp * dt; p.pos.z += Math.cos(h) * sp * dt; moved = true; break;
          }
        }
        if (!moved) p.heading += dt * 3;
        if (p.timer <= 0) this.resumePed(p);
        return;
      }
      case 'return': {
        const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { p.state = p.zone ? (p.group ? 'idle' : 'wander') : 'walk'; p.timer = rand(5, 20); return; }
        p.heading = Math.atan2(dx, dz);
        const nx = p.pos.x + dx / d * p.speed * dt, nz = p.pos.z + dz / d * p.speed * dt;
        if (G.buildings.inside(_p.set(nx, 0.3, nz))) { p.state = 'flee'; p.timer = 1; p.threat = { x: nx, z: nz }; return; }
        p.pos.x = nx; p.pos.z = nz;
        return;
      }
      case 'idle':
        p.timer -= dt;
        if (p.group) {
          // face the group and gesture now and then
          const want = Math.atan2(p.group.x - p.pos.x, p.group.z - p.pos.z);
          p.heading += Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading)) * Math.min(1, dt * 3);
        }
        if (p.timer <= 0) { p.state = 'wander'; p.target = { x: rand(p.zone.x0, p.zone.x1), z: rand(p.zone.z0, p.zone.z1) }; }
        return;
      case 'wander': {
        const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.3) {
          if (Math.random() < (p.group ? 0.9 : 0.4)) { p.state = 'idle'; p.timer = p.group ? rand(8, 40) : rand(3, 15); }
          p.target = { x: rand(p.zone.x0, p.zone.x1), z: rand(p.zone.z0, p.zone.z1) };
          return;
        }
        p.heading = Math.atan2(dx, dz);
        p.pos.x += dx / d * p.speed * 0.8 * dt; p.pos.z += dz / d * p.speed * 0.8 * dt;
        return;
      }
      case 'wait': {
        const e = p.pending;
        if (!e.light || C.green(e.light, e.axis) && C.phase(e.light) % 8 < 5.5) { p.state = 'walk'; p.from = p.to; p.to = e.to; p.pending = null; }
        return;
      }
      default: { // walk
        const tg = this.pedTarget(p);
        const dx = tg.x - p.pos.x, dz = tg.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.15) {
          this.nextPedEdge(p);
          const e = p.pending;
          if (e) {
            if (e.light && !(C.green(e.light, e.axis) && C.phase(e.light) % 8 < 5.5)) p.state = 'wait';
            else { p.from = p.to; p.to = e.to; p.pending = null; }
          }
          return;
        }
        let want = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading));
        p.heading += clamp(diff, -6 * dt, 6 * dt);
        if (C.obstacleNear(p.pos.x + dx / d * 0.5, p.pos.z + dz / d * 0.5, 0.2)) { [p.from, p.to] = [p.to, p.from]; return; }
        p.pos.x += Math.sin(p.heading) * p.speed * dt; p.pos.z += Math.cos(p.heading) * p.speed * dt;
      }
    }
  }
  resumePed(p) {
    const C = this.city;
    if (p.zone) { p.state = 'return'; p.target = { x: clamp(p.pos.x, p.zone.x0, p.zone.x1), z: clamp(p.pos.z, p.zone.z0, p.zone.z1) }; return; }
    let best = null, bd = 1e9;
    for (const n of C.pedNodes) { if (!n.edges.length) continue; const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z); if (d < bd && !C.obstacleNear(n.x, n.z, 0.5)) { bd = d; best = n; } }
    if (!best) return;
    // walk back to the nearest sidewalk corner, then continue along the graph from there
    p.state = 'return'; p.target = { x: best.x, z: best.z };
    p.to = best.id; p.from = best.edges[0].to;
  }

  // ---------- reactions ----------
  onBlast(x, y, z, r, power, kind) {
    const threat = { x, z };
    const kill = kind === 'wind' ? r * 0.9 : r * 0.35;
    let honks = 0, scared = 0;
    for (const c of this.cars) {
      if (c.state === 'hidden') continue;
      const dx = c.pos.x - x, dz = c.pos.z - z, d = Math.hypot(dx, dz) + 0.01;
      if (d > r) continue;
      const dir = { x: dx / d, z: dz / d };
      if (d < kill && power > 2) {
        const f = power * (1 - d / kill);
        const push = kind === 'wind' ? f * 0.9 : f * 1.2;
        if (push > 1.5) {
          if (c.siren) { c.siren.stop(); c.siren = null; }
          this.launch(c, dir, push, kind === 'wind' ? f * 0.35 : f * 0.9, true, kind === 'wind' ? 3 : 7);
          if (kind !== 'wind' && kind !== 'collapse' && Math.random() < 0.6) c.fire = rand(15, 40);
          continue;
        }
      }
      if (kind === 'energy' && d < r * 0.6) { c.timer = rand(2, 4); }
      if (c.state === 'drive' && !c.emerg) {
        c.timer = Math.max(c.timer, rand(0.2, 0.7));
        c.flee = rand(6, 12); c.threat = threat;
        if (honks < 3 && Math.random() < 0.25 && power > 1) { honks++; setTimeout(() => sfx.horn(c.pos.x, c.pos.z, rand(0.3, 0.6)), rand(300, 1600)); }
        // if the danger is ahead on this street, turn around
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        if ((-dx * fx - dz * fz) > 0 && d < r * 0.7) this.uTurn(c);
      }
    }
    for (const p of this.peds) {
      const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz) + 0.01;
      if (d > r * 1.2) continue;
      p.threat = threat;
      if (d < kill && power > 1.5 && p.state !== 'air') {
        const f = power * (1 - d / kill);
        if (f > 1) { this.launch(p, { x: dx / d, z: dz / d }, f * 1.3, f * (kind === 'wind' ? 0.6 : 1.1), false, 10); scared++; continue; }
      }
      if (p.state === 'walk' || p.state === 'wait' || p.state === 'wander' || p.state === 'idle' || p.state === 'return') {
        p.state = 'alert'; p.timer = rand(0.1, 0.7); scared++;
      } else if (p.state === 'flee') p.timer = Math.max(p.timer, rand(3, 6));
    }
    if (scared > 2 && power > 0.5) sfx.screams(x, z, Math.min(6, 1 + Math.floor(scared / 8)));
  }

  gk(x, z) { return Math.floor(x / 4) * 1000 + Math.floor(z / 4); }

  limb(mesh, i, px, py, ax, az = 0) {
    _m2.makeRotationFromEuler(_e.set(ax, 0, az));
    _m2.setPosition(px, py, 0);
    _m3.multiplyMatrices(_m, _m2);
    mesh.setMatrixAt(i, _m3);
  }

  update(dt) {
    this.grid.clear();
    for (const p of this.peds) {
      const k = this.gk(p.pos.x, p.pos.z);
      let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(p);
    }
    for (const c of this.cars) this.updateCar(c, dt);
    this.updateEmergency(dt);

    const night = G.night || 0;
    const hk = 0.25 + night * 3.2;
    this.headL.material.color.setRGB(hk, hk * 0.95, hk * 0.8);
    const tk = 0.35 + night * 1.8;
    this.tailL.material.color.setRGB(tk, tk * 0.05, tk * 0.04);
    this.headPool.material.color.setRGB(night * 0.55, night * 0.5, night * 0.4);
    const flash = Math.floor(G.time * 7) % 2;
    const T = G.camTarget;
    let bl = 0;
    const lightCands = [];
    for (const c of this.cars) {
      const hidden = c.state === 'hidden';
      if (hidden) { for (const m of [this.carBody, this.carDark, this.headL, this.tailL, this.headPool]) m.setMatrixAt(c.i, ZERO); }
      else {
        if (c.state === 'air' || c.state === 'wreck' && c.airborneBefore) {
          if (c.state === 'wreck') {
            _q.setFromAxisAngle(UP, c.heading);
            if (c.flipped) _q.multiply(new THREE.Quaternion().setFromAxisAngle(ZAX, Math.PI));
            _p.copy(c.pos); if (c.flipped) _p.y += 0.55;
          } else { _q.copy(c.q); _p.copy(c.pos); }
        } else {
          _q.setFromAxisAngle(UP, c.heading);
          _p.copy(c.pos);
        }
        _m.compose(_p, _q, _s.set(c.scale[0], c.scale[1], c.scale[2]));
        this.carBody.setMatrixAt(c.i, _m); this.carDark.setMatrixAt(c.i, _m);
        const lit = c.state === 'drive' || c.state === 'onscene';
        this.headL.setMatrixAt(c.i, lit ? _m : ZERO);
        this.tailL.setMatrixAt(c.i, lit ? _m : ZERO);
        if (lit) { _m2.compose(_p, _q, _s.set(1, 1, 1)); this.headPool.setMatrixAt(c.i, night > 0.05 && c.state === 'drive' ? _m2 : ZERO); }
        else this.headPool.setMatrixAt(c.i, ZERO);
        const b = c.braking || c.speed < 0.2 ? 2.2 : 1;
        this.tailL.setColorAt(c.i, _v.set(b, b, b));
      }
      if (c.emerg) {
        const on = c.state === 'drive' || c.state === 'onscene';
        for (let s = 0; s < 2; s++) {
          const idx = c.ei * 2 + s;
          if (!on) { this.beacons.setMatrixAt(idx, ZERO); continue; }
          _m2.makeTranslation(s ? 0.13 : -0.13, 0.56, c.emerg === 'fire' ? 0.5 : 0);
          _m3.multiplyMatrices(_m, _m2);
          this.beacons.setMatrixAt(idx, _m3);
          const lit = (flash + s) % 2 === 0;
          const col = c.emerg === 'police' ? (s ? [0.2, 0.4, 6] : [6, 0.2, 0.2]) : c.emerg === 'fire' ? [6, 0.5, 0.1] : (s ? [5, 5, 5] : [6, 0.2, 0.2]);
          const k = lit ? 1 : 0.05;
          this.beacons.setColorAt(idx, _v.set(col[0] * k, col[1] * k, col[2] * k));
        }
        if (on) lightCands.push(c);
      }
    }
    for (const m of [this.carBody, this.carDark, this.headL, this.tailL, this.headPool, this.beacons]) m.instanceMatrix.needsUpdate = true;
    if (this.tailL.instanceColor) this.tailL.instanceColor.needsUpdate = true;
    if (this.beacons.instanceColor) this.beacons.instanceColor.needsUpdate = true;
    // two real flashing lights for the responders nearest the view (they light up facades at night)
    lightCands.sort((a, b) => Math.hypot(a.pos.x - T.x, a.pos.z - T.z) - Math.hypot(b.pos.x - T.x, b.pos.z - T.z));
    this.beaconLights.forEach((l, k) => {
      const c = lightCands[k];
      if (!c) { l.intensity = 0; return; }
      l.position.set(c.pos.x, 1.4, c.pos.z);
      const red = (flash + k) % 2 === 0;
      l.color.setRGB(red ? 1 : c.emerg === 'police' ? 0.15 : 1, red ? 0.1 : 0.2, red ? 0.08 : c.emerg === 'police' ? 1 : 0.1);
      l.intensity = (6 + night * 30);
    });

    for (const p of this.peds) {
      this.updatePed(p, dt);
      const moving = p.state === 'walk' || p.state === 'flee' || p.state === 'wander' || p.state === 'return';
      const run = p.state === 'flee';
      const cyc = G.time * (run ? 13 : 7.5) + p.phase;
      const bob = moving ? Math.abs(Math.sin(cyc)) * (run ? 0.035 : 0.018) : 0;
      if (p.state === 'air') _q.copy(p.q);
      else if (p.state === 'down') _q.setFromAxisAngle(UP, p.heading).multiply(new THREE.Quaternion().setFromAxisAngle(XAX, Math.PI / 2));
      else { _q.setFromAxisAngle(UP, p.heading); if (run) _q.multiply(new THREE.Quaternion().setFromAxisAngle(XAX, 0.2)); }
      _p.set(p.pos.x, p.pos.y + bob + (p.state === 'down' ? 0.06 : 0), p.pos.z);
      _m.compose(_p, _q, _s.set(p.s, p.s, p.s));
      const i = p.i;
      this.pTorso.setMatrixAt(i, _m); this.pHead.setMatrixAt(i, _m); this.pHair.setMatrixAt(i, _m);
      let leg = 0, arm = 0, armOut = 0.1;
      if (moving) { leg = Math.sin(cyc) * (run ? 0.8 : 0.45); arm = -leg * (run ? 1.1 : 0.8); }
      else if (p.state === 'air') { leg = Math.sin(G.time * 18 + p.phase) * 0.7; arm = -leg; armOut = 1.1; }
      else if (p.state === 'alert') { armOut = 0.35; }
      else if (p.state === 'idle' && p.group) arm = Math.max(0, Math.sin(G.time * 1.3 + p.phase * 3)) * 0.7; // talking with hands
      this.limb(this.pLegL, i, 0.034, 0.31, leg);
      this.limb(this.pLegR, i, -0.034, 0.31, -leg);
      this.limb(this.pArmL, i, 0.084, 0.535, arm, armOut);
      this.limb(this.pArmR, i, -0.084, 0.535, p.state === 'idle' ? 0 : -arm, -armOut);
    }
    for (const m of this.pMeshes) m.instanceMatrix.needsUpdate = true;
  }
}

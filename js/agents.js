import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), XAX = new THREE.Vector3(1, 0, 0);
const CAR_COLORS = [0xf2f2f0, 0x1c1d20, 0x8a9096, 0xb4bac0, 0x9e1b1b, 0x1e3f73, 0x2f5d3a, 0xd9c7a0, 0x5a1f2b, 0x3a3f46, 0xcfd6dc, 0x7a5230];
const SHIRTS = [0xe8e4dc, 0x2b2d33, 0xb33a3a, 0x3565a8, 0xe0b640, 0x4f7f4a, 0xd87a3a, 0x9a5fb0, 0xf0f0f0, 0x6fb3c9, 0xc94f7c];
const PANTS = [0x2a3448, 0x1f1f22, 0x5a5044, 0x7b8794, 0x3c4a3a, 0xb8ad96];
const SKIN = [0xe8c4a8, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0];

function carGeos() {
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

export class Agents {
  constructor(scene, city, opts) {
    this.city = city;
    this.cars = []; this.peds = [];
    const { body, dark } = carGeos();
    const nCars = opts.cars + city.parked.length;
    this.carBody = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4, envMapIntensity: 1.2 }), nCars);
    this.carDark = new THREE.InstancedMesh(dark, new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.15, metalness: 0.7 }), nCars);
    for (const m of [this.carBody, this.carDark]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }

    const legs = new THREE.CylinderGeometry(0.06, 0.05, 0.28, 6).translate(0, 0.14, 0);
    const torso = new THREE.CylinderGeometry(0.075, 0.065, 0.26, 7).translate(0, 0.4, 0);
    const head = new THREE.SphereGeometry(0.058, 8, 6).translate(0, 0.6, 0);
    const nP = opts.peds;
    const pm = () => new THREE.MeshStandardMaterial({ roughness: 0.9 });
    this.pLegs = new THREE.InstancedMesh(legs, pm(), nP);
    this.pTorso = new THREE.InstancedMesh(torso, pm(), nP);
    this.pHead = new THREE.InstancedMesh(head, pm(), nP);
    for (const m of [this.pLegs, this.pTorso, this.pHead]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }

    for (let i = 0; i < opts.cars; i++) this.spawnCar(i);
    city.parked.forEach((p, i) => this.spawnParked(opts.cars + i, p));
    for (let i = 0; i < nP; i++) this.spawnPed(i, opts.wanderFrac || 0);
    this.carBody.instanceColor.needsUpdate = true;
    this.grid = new Map();
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
  spawnCar(i) {
    const r = Math.random();
    const c = this.newCar(i, r < 0.05 ? 'bus' : r < 0.14 ? 'van' : r < 0.3 ? 'suv' : 'car');
    const C = this.city;
    const edges = [...C.edges.values()];
    for (let tries = 0; tries < 30; tries++) {
      const e = pick(edges);
      const [a, b] = Math.random() < 0.5 ? [e.a, e.b] : [e.b, e.a];
      const A = C.nodes[a], B = C.nodes[b];
      const t = rand(0.25, 0.75);
      const d = _v.set(B.x - A.x, 0, B.z - A.z).normalize();
      const off = C.roadW / 4;
      const x = A.x + (B.x - A.x) * t - d.z * off, z = A.z + (B.z - A.z) * t + d.x * off;
      if (this.cars.some((o) => o.pos.distanceTo(_p.set(x, 0, z)) < 3)) continue;
      c.pos.set(x, 0, z); c.heading = Math.atan2(d.x, d.z); c.from = a; c.to = b;
      c.queue = [this.stopPoint(A, B)];
      c.speed = c.maxSpeed * 0.6;
      break;
    }
    this.cars.push(c);
  }
  spawnParked(i, p) {
    const c = this.newCar(i, Math.random() < 0.2 ? 'suv' : 'car');
    c.state = 'parked'; c.pos.set(p.x, 0, p.z); c.heading = p.rot + (Math.random() < 0.5 ? Math.PI : 0);
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
  chooseNext(c) {
    const C = this.city, B = C.nodes[c.to];
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
    if (C.edge(A.id, B.id) && C.edge(A.id, B.id).blocked && false) return;
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
    if (c.state === 'air') return this.updateAir(c, dt, true);
    if (c.fire > 0) {
      c.fire -= dt;
      if (Math.random() < dt * 18) G.fx.fire.emit(c.pos.x + rand(-0.3, 0.3), c.pos.y + 0.45, c.pos.z + rand(-0.3, 0.3), rand(-0.15, 0.15), rand(1.5, 2.6), rand(-0.15, 0.15), rand(0.35, 0.7), rand(0.35, 0.7));
      if (Math.random() < dt * 5) G.fx.smokePuff(c.pos.x, c.pos.y + 0.8, c.pos.z, 0.9, 0.06);
    }
    if (c.state === 'wreck' || c.state === 'parked') return;
    if (c.timer > 0) { c.timer -= dt; c.speed = Math.max(0, c.speed - 14 * dt); this.moveCar(c, dt); return; }
    if (c.flee > 0) c.flee -= dt;
    if (!c.queue.length) {
      const n = this.chooseNext(c);
      if (n === null) { c.speed = 0; return; }
      this.planTurn(c, n);
    }
    const wp = c.queue[0];
    const dx = wp.x - c.pos.x, dz = wp.z - c.pos.z, dist = Math.hypot(dx, dz);
    let target = c.maxSpeed * (c.flee > 0 ? 1.6 : 1);
    if (wp.stop) {
      const node = C.nodes[wp.node];
      const mustStop = c.flee <= 0 && node.lit && !C.green(node, wp.axis);
      const stopSign = !node.lit && node.edges.length >= 3 && c.flee <= 0;
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
      if (o === c) continue;
      const ox = o.pos.x - c.pos.x, oz = o.pos.z - c.pos.z;
      const along = ox * fx + oz * fz;
      if (along <= 0 || along > 4) continue;
      const lat = Math.abs(ox * fz - oz * fx);
      if (lat < 0.55 + (o.state === 'wreck' || o.state === 'parked' ? 0.15 : 0)) target = Math.min(target, Math.max(0, (along - c.len - o.len - 0.3) * 2.2));
    }
    const hx = c.pos.x + fx * 1.2, hz = c.pos.z + fz * 1.2;
    const cell = this.grid.get(this.gk(hx, hz));
    if (cell) for (const p of cell) if (p.state !== 'air' && Math.hypot(p.pos.x - hx, p.pos.z - hz) < 0.8) target = Math.min(target, 0);
    const obs = C.obstacleNear(c.pos.x + fx * 2, c.pos.z + fz * 2, 0.7);
    if (obs) target = 0;
    if (target < 0.1 && (obs || c.speed < 0.1)) {
      c.stuck += dt;
      if (c.stuck > (obs ? 1.5 : 12)) this.uTurn(c);
    } else c.stuck = Math.max(0, c.stuck - dt);
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
        if (isCar) { G.fx.dust(a.pos.x, a.pos.y, a.pos.z, 0.4); G.fx.sparks(a.pos.x, a.pos.y + 0.2, a.pos.z, 8, 3, 2, 1, 4); }
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
    if (a.flipped) a.q.multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
    a.airborneBefore = true; a.flipped = false;
    a.vel.set(dir.x * f, up, dir.z * f);
    a.w.set(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin));
    if (a.pos.y < 0.02) a.pos.y = 0.02;
  }

  // ---------- pedestrians ----------
  spawnPed(i, wanderFrac) {
    const C = this.city;
    const p = { i, pos: new THREE.Vector3(), heading: 0, state: 'walk', speed: rand(0.7, 1.1), lat: rand(-0.35, 0.35), vel: new THREE.Vector3(),
      q: new THREE.Quaternion(), w: new THREE.Vector3(), timer: 0, phase: rand(0, 6), s: rand(0.9, 1.1) };
    const zones = C.wanderZones;
    if (zones.length && Math.random() < wanderFrac) {
      p.zone = pick(zones);
      p.state = 'wander';
      p.pos.set(rand(p.zone.x0, p.zone.x1), 0, rand(p.zone.z0, p.zone.z1));
      p.target = { x: rand(p.zone.x0, p.zone.x1), z: rand(p.zone.z0, p.zone.z1) };
      if (Math.random() < 0.3) { p.state = 'idle'; p.timer = rand(5, 40); }
    } else {
      const n = pick(C.pedNodes), e = pick(n.edges.filter((e) => !e.light)) || n.edges[0];
      const t = Math.random(), m = C.pedNodes[e.to];
      p.pos.set(n.x + (m.x - n.x) * t, 0, n.z + (m.z - n.z) * t);
      p.from = n.id; p.to = m.id;
    }
    this.pLegs.setColorAt(i, new THREE.Color(pick(PANTS)));
    this.pTorso.setColorAt(i, new THREE.Color(pick(SHIRTS)));
    this.pHead.setColorAt(i, new THREE.Color(pick(SKIN)));
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
        if (d < 0.2) { p.state = p.zone ? 'wander' : 'walk'; return; }
        p.heading = Math.atan2(dx, dz);
        const nx = p.pos.x + dx / d * p.speed * dt, nz = p.pos.z + dz / d * p.speed * dt;
        if (G.buildings.inside(_p.set(nx, 0.3, nz))) { p.state = 'flee'; p.timer = 1; p.threat = { x: nx, z: nz }; return; }
        p.pos.x = nx; p.pos.z = nz;
        return;
      }
      case 'idle':
        p.timer -= dt;
        if (p.timer <= 0) { p.state = 'wander'; p.target = { x: rand(p.zone.x0, p.zone.x1), z: rand(p.zone.z0, p.zone.z1) }; }
        return;
      case 'wander': {
        const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.3) { if (Math.random() < 0.4) { p.state = 'idle'; p.timer = rand(3, 15); } p.target = { x: rand(p.zone.x0, p.zone.x1), z: rand(p.zone.z0, p.zone.z1) }; return; }
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
    for (const n of C.pedNodes) { const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z); if (d < bd && !C.obstacleNear(n.x, n.z, 0.5)) { bd = d; best = n; } }
    if (!best) return;
    // walk back to the nearest sidewalk corner, then continue along the graph from there
    p.state = 'return'; p.target = { x: best.x, z: best.z };
    p.to = best.id; p.from = best.edges[0].to;
  }

  // ---------- reactions ----------
  onBlast(x, y, z, r, power, kind) {
    const threat = { x, z };
    const kill = kind === 'wind' ? r * 0.9 : r * 0.35;
    for (const c of this.cars) {
      const dx = c.pos.x - x, dz = c.pos.z - z, d = Math.hypot(dx, dz) + 0.01;
      if (d > r) continue;
      const dir = { x: dx / d, z: dz / d };
      if (d < kill && power > 2) {
        const f = power * (1 - d / kill);
        const push = kind === 'wind' ? f * 0.9 : f * 1.2;
        if (push > 1.5) {
          this.launch(c, dir, push, kind === 'wind' ? f * 0.35 : f * 0.9, true, kind === 'wind' ? 3 : 7);
          if (kind !== 'wind' && kind !== 'collapse' && Math.random() < 0.6) c.fire = rand(15, 40);
          continue;
        }
      }
      if (kind === 'energy' && d < r * 0.6) { c.timer = rand(2, 4); }
      if (c.state === 'drive') {
        c.timer = Math.max(c.timer, rand(0.2, 0.7));
        c.flee = rand(6, 12); c.threat = threat;
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
        if (f > 1) { this.launch(p, { x: dx / d, z: dz / d }, f * 1.3, f * (kind === 'wind' ? 0.6 : 1.1), false, 10); continue; }
      }
      if (p.state === 'walk' || p.state === 'wait' || p.state === 'wander' || p.state === 'idle' || p.state === 'return') {
        p.state = 'alert'; p.timer = rand(0.1, 0.7);
      } else if (p.state === 'flee') p.timer = Math.max(p.timer, rand(3, 6));
    }
  }

  gk(x, z) { return Math.floor(x / 4) * 1000 + Math.floor(z / 4); }

  update(dt) {
    this.grid.clear();
    for (const p of this.peds) {
      const k = this.gk(p.pos.x, p.pos.z);
      let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(p);
    }
    for (const c of this.cars) this.updateCar(c, dt);
    for (const c of this.cars) {
      if (c.state === 'air' || c.state === 'wreck' && c.airborneBefore) {
        if (c.state === 'wreck') {
          _q.setFromAxisAngle(UP, c.heading);
          if (c.flipped) _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI));
          _p.copy(c.pos); if (c.flipped) _p.y += 0.55;
        } else { _q.copy(c.q); _p.copy(c.pos); }
      } else {
        _q.setFromAxisAngle(UP, c.heading);
        _p.copy(c.pos);
      }
      _m.compose(_p, _q, _s.set(c.scale[0], c.scale[1], c.scale[2]));
      this.carBody.setMatrixAt(c.i, _m); this.carDark.setMatrixAt(c.i, _m);
    }
    this.carBody.instanceMatrix.needsUpdate = this.carDark.instanceMatrix.needsUpdate = true;

    for (const p of this.peds) {
      this.updatePed(p, dt);
      const moving = p.state === 'walk' || p.state === 'flee' || p.state === 'wander' || p.state === 'return';
      const run = p.state === 'flee';
      const bob = moving ? Math.abs(Math.sin(G.time * (run ? 16 : 9) + p.phase)) * (run ? 0.05 : 0.025) : 0;
      if (p.state === 'air') _q.copy(p.q);
      else if (p.state === 'down') _q.setFromAxisAngle(UP, p.heading).multiply(new THREE.Quaternion().setFromAxisAngle(XAX, Math.PI / 2));
      else { _q.setFromAxisAngle(UP, p.heading); if (run) _q.multiply(new THREE.Quaternion().setFromAxisAngle(XAX, 0.25)); }
      _p.set(p.pos.x, p.pos.y + bob + (p.state === 'down' ? 0.06 : 0), p.pos.z);
      _m.compose(_p, _q, _s.set(p.s, p.s, p.s));
      this.pLegs.setMatrixAt(p.i, _m); this.pTorso.setMatrixAt(p.i, _m); this.pHead.setMatrixAt(p.i, _m);
    }
    this.pLegs.instanceMatrix.needsUpdate = this.pTorso.instanceMatrix.needsUpdate = this.pHead.instanceMatrix.needsUpdate = true;
  }
}

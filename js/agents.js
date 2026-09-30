import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { sfx } from './audio.js';

const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0), XAX = new THREE.Vector3(1, 0, 0), ZAX = new THREE.Vector3(0, 0, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const POSE = { aL: 0, aR: 0, oL: 0, oR: 0, lL: 0, lR: 0, dy: 0 };
const LOD_STATES = new Set(['walk', 'wander', 'idle', 'wait', 'job', 'return']);
const CAR_COLORS = [0xf2f2f0, 0x1c1d20, 0x8a9096, 0xb4bac0, 0x9e1b1b, 0x1e3f73, 0x2f5d3a, 0xd9c7a0, 0x5a1f2b, 0x3a3f46, 0xcfd6dc, 0x7a5230];
const SHIRTS = [0xe8e4dc, 0x2b2d33, 0xb33a3a, 0x3565a8, 0xe0b640, 0x4f7f4a, 0xd87a3a, 0x9a5fb0, 0xf0f0f0, 0x6fb3c9, 0xc94f7c, 0x1f2a44, 0x8a8f96];
const PANTS = [0x2a3448, 0x1f1f22, 0x5a5044, 0x7b8794, 0x3c4a3a, 0xb8ad96, 0x33415e];
const SKIN = [0xe8c4a8, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0, 0xb07e5a];
const HAIR = [0x1a1410, 0x2e2118, 0x5a3b22, 0x8a6a3a, 0xc9a86a, 0x6b6b6b, 0x0e0e0e];
// which vehicles each kind of world event calls for (untyped legacy incidents keep the old mix)
const NEEDS = {
  FIRE: (s) => ['fire', 'police', ...(s > 1.5 ? ['fire'] : []), ...(s > 2.2 ? ['ambulance'] : [])],
  TRAFFIC_ACCIDENT: (s) => ['police', 'ambulance', ...(s > 1.5 ? ['fire'] : [])],
  SHOOTING: () => ['police', 'police', 'ambulance'],
  GANG_CONFLICT: () => ['police', 'police', 'ambulance'],
  RIOT: () => ['police', 'police', 'police'],
  DISTURBANCE: () => ['police', 'police'],
  EVACUATION: () => ['police', 'fire'],
  POLICE_RESPONSE: () => ['police'], FIRE_RESPONSE: () => ['fire'], MEDICAL_RESPONSE: () => ['ambulance'],
};
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

// motorcycle + rider, forward +z, ground at y = 0 (split by colour: bike paint, black parts, rider's jacket, helmet)
function motoGeos() {
  const bx = (w, h, d, x, y, z, rx = 0) => new THREE.BoxGeometry(w, h, d).rotateX(rx).translate(x, y, z);
  const wheel = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12).rotateZ(Math.PI / 2);
  return {
    body: mergeGeometries([bx(0.11, 0.08, 0.2, 0, 0.37, 0.07), bx(0.13, 0.15, 0.1, 0, 0.43, 0.3), bx(0.08, 0.04, 0.22, 0, 0.35, -0.26)]),
    dark: mergeGeometries([bx(0.05, 0.08, 0.56, 0, 0.25, 0), bx(0.09, 0.04, 0.2, 0, 0.38, -0.1), wheel.clone().translate(0, 0.12, 0.31), wheel.clone().translate(0, 0.12, -0.31),
      bx(0.26, 0.02, 0.02, 0, 0.51, 0.24), bx(0.03, 0.3, 0.03, 0, 0.32, 0.3, -0.35)]),
    rider: mergeGeometries([
      new THREE.CylinderGeometry(0.06, 0.052, 0.22, 7).scale(1, 1, 0.7).rotateX(0.55).translate(0, 0.55, -0.02),
      ...[-1, 1].flatMap((s) => [bx(0.035, 0.035, 0.24, s * 0.085, 0.57, 0.12, 0.35), bx(0.045, 0.045, 0.22, s * 0.07, 0.4, 0.0, -0.1), bx(0.04, 0.2, 0.04, s * 0.08, 0.29, 0.1, 0.3)]),
    ]),
    helmet: new THREE.SphereGeometry(0.058, 10, 8).translate(0, 0.73, 0.08),
    lamp: bx(0.05, 0.04, 0.02, 0, 0.44, 0.36),
  };
}
const MOTO_PAINT = [0x111111, 0xc8102e, 0x1e3f73, 0xf2f2f0, 0xe0b000, 0x2f6d3a, 0x7a7f86];
const JACKETS = [0x1c1d20, 0x3a2a1c, 0x2b3a55, 0x5a1f2b, 0x3c4a3a, 0x6b6f76];

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
    // motorcycles: separate instanced parts, one slot per vehicle, hidden unless that vehicle is a bike
    const mg = motoGeos(), lambert = () => new THREE.MeshLambertMaterial();
    this.moto = { body: new THREE.InstancedMesh(mg.body, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }), nCars), dark: new THREE.InstancedMesh(mg.dark, new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4, metalness: 0.5 }), nCars),
      rider: new THREE.InstancedMesh(mg.rider, lambert(), nCars), helmet: new THREE.InstancedMesh(mg.helmet, new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.2 }), nCars),
      lamp: new THREE.InstancedMesh(mg.lamp, this.headL.material, nCars) };
    for (const m of Object.values(this.moto)) { m.frustumCulled = false; m.castShadow = true; for (let k = 0; k < nCars; k++) m.setMatrixAt(k, ZERO); scene.add(m); }
    for (let k = 0; k < nCars; k++) { this.moto.body.setColorAt(k, new THREE.Color(0xffffff)); this.moto.rider.setColorAt(k, new THREE.Color(0xffffff)); this.moto.helmet.setColorAt(k, new THREE.Color(0xffffff)); }
    // car doors, shown only while someone is getting in or out (hinged at the front edge, swing outward)
    const doorGeo = new THREE.BoxGeometry(0.03, 0.22, 0.38).translate(0, 0.32, -0.19);
    this.doors = new THREE.InstancedMesh(doorGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }), nCars * 2);
    for (let k = 0; k < nCars * 2; k++) this.doors.setMatrixAt(k, ZERO);
    this.doors.frustumCulled = false; scene.add(this.doors);
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
    // umbrellas: up over about a third of the people out walking when it rains
    const umb = mergeGeometries([new THREE.ConeGeometry(0.2, 0.1, 8, 1, true).translate(0, 0.86, 0.02), new THREE.CylinderGeometry(0.006, 0.006, 0.36, 4).translate(0, 0.68, 0.02)]);
    this.umb = new THREE.InstancedMesh(umb, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), nP);
    for (let k = 0; k < nP; k++) { this.umb.setMatrixAt(k, ZERO); this.umb.setColorAt(k, new THREE.Color(pick([0x111111, 0x1c1d20, 0x1f3f7a, 0xc8102e, 0x2f5d3a, 0xe0b640, 0x6b2a6b]))); }
    this.umb.frustumCulled = false; this.umb.castShadow = true; scene.add(this.umb);
    this.pace = 1; this.frame = 0;

    for (let i = 0; i < opts.cars; i++) this.spawnCar(i);
    city.parked.forEach((p, i) => this.spawnParked(opts.cars + i, p));
    for (let i = 0; i < E; i++) this.spawnEmergency(opts.cars + city.parked.length + i, EMERG_TYPES[i]);
    // police posted at events: parked with lights going, sirens silent, never dispatched
    stationed.forEach((st, k) => {
      this.spawnEmergency(opts.cars + city.parked.length + E + k, 'police');
      const c = this.cars[this.cars.length - 1];
      c.state = 'onscene'; c.posted = true; c.sirenOffAt = -1; c.pos.set(st.x, 0, st.z); c.heading = st.rot; c.quiet = !!st.quiet;
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
    if (type === 'moto') {
      const c = { i, pos: new THREE.Vector3(), heading: 0, speed: 0, queue: [], state: 'drive', vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(),
        scale: [1, 1, 1], maxSpeed: rand(4, 5.2), color: new THREE.Color(pick(MOTO_PAINT)), len: 0.45, timer: 0, stuck: 0, flee: 0, fire: 0, lean: 0 };
      this.makeMoto(c);
      return c;
    }
    const scale = type === 'bus' ? [1.15, 1.7, 3.2] : type === 'van' ? [1.05, 1.35, 1.35] : type === 'suv' ? [1.06, 1.12, 1.08] : [1, 1, rand(0.95, 1.05)];
    const c = { i, pos: new THREE.Vector3(), heading: 0, speed: 0, queue: [], state: 'drive', vel: new THREE.Vector3(), q: new THREE.Quaternion(),
      w: new THREE.Vector3(), scale, maxSpeed: rand(3.2, 4.4) * (type === 'bus' ? 0.75 : 1), color: type === 'bus' ? new THREE.Color(0xe8e4d8) : this.carColor(),
      len: 0.8 * scale[2], timer: 0, stuck: 0, flee: 0, fire: 0 };
    this.carBody.setColorAt(i, c.color);
    if (this.doors) { this.doors.setColorAt(i * 2, c.color); this.doors.setColorAt(i * 2 + 1, c.color); }
    return c;
  }
  spawnCar(i, replace = null) {
    const r = Math.random();
    const c = this.newCar(i, r < 0.05 ? 'bus' : r < 0.14 ? 'van' : r < 0.3 ? 'suv' : r > 0.88 ? 'moto' : 'car');
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
    if (replace && replace.driver) this.respawnPed(replace.driver);
    if (replace && replace.motoShown) this.drawMoto({ i: replace.i, moto: false }, 0);
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
    if (c.doorT > 0) c.doorT -= dt;
    if (c.doorT2 > 0) c.doorT2 -= dt;
    if (c.state === 'parked' && c.pullOut != null) { c.speed = 0; if ((c.pullOut -= dt) <= 0) { c.pullOut = null; this.joinTraffic(c); } return; }
    if (c.state === 'onscene' && c.awaitCrew && (!G.responders || G.responders.aboard(c))) { this.leave(c); return; }
    if (c.patrolUntil && G.time > c.patrolUntil && c.state === 'drive') { c.patrolUntil = null; c.leaving = true; }
    if (c.state === 'wreck' || c.state === 'parked' || c.state === 'onscene') { c.speed = 0; return; }
    if (c.yieldT > 0) {
      // pulled over for an emergency vehicle: ease to the right and stop, then carry on
      c.yieldT -= dt; c.speed = Math.max(0, c.speed - 10 * dt);
      if ((c.yieldOff || 0) < 0.85) { const k = Math.min(0.85 - (c.yieldOff || 0), dt * 1.6); c.yieldOff = (c.yieldOff || 0) + k; c.pos.x -= Math.cos(c.heading) * k; c.pos.z += Math.sin(c.heading) * k; }
      this.moveCar(c, dt); if (c.yieldT <= 0) c.yieldOff = 0; return;
    }
    if (c.timer > 0) { c.timer -= dt; c.speed = Math.max(0, c.speed - 14 * dt); this.moveCar(c, dt); return; }
    if (c.flee > 0) c.flee -= dt;
    if (c.leaving && G.camTarget && Math.hypot(c.pos.x - G.camTarget.x, c.pos.z - G.camTarget.z) > 60) {
      c.leaving = false; c.state = 'hidden'; if (c.siren) { c.siren.stop(true); c.siren = null; } return;
    }
    // responders pull up and park once they're close to the incident
    if (c.incident && Math.hypot(c.pos.x - c.incident.x, c.pos.z - c.incident.z) < (c.emerg === 'fire' ? 6 + c.ei % 3 : 10 + c.ei % 3 * 2)) { this.arrive(c); return; }
    if (!c.queue.length) {
      if (c.parking) { this.parkHere(c); return; }
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
      if (lat < 0.55 + (o.state === 'wreck' || o.state === 'parked' ? 0.15 : 0)) {
        target = Math.min(target, Math.max(0, (along - c.len - o.len - 0.3) * 2.2));
        if (c.emerg && c.incident && !o.emerg && o.state === 'drive' && along < 4) o.yieldT = 3;
      }
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
      if (a.driver) { const d = a.driver; a.driver = null; d.car = null; d.pos.set(a.pos.x + 0.6, 0, a.pos.z); d.state = 'down'; d.timer = rand(4, 8); }
      a.incident = null; a.dest = null;
      if (a.siren) { a.siren.stop(); a.siren = null; }
      if (a.obs) { const k = this.city.obstacles.indexOf(a.obs); if (k >= 0) this.city.obstacles.splice(k, 1); }
      a.obs = { x: a.pos.x, z: a.pos.z, r: 0.9, kind: 'wreck' };
      this.city.obstacles.push(a.obs);
      this.carBody.setColorAt(a.i, a.color.clone().multiplyScalar(a.fire > 0 ? 0.25 : 0.6));
      this.carBody.instanceColor.needsUpdate = true;
    } else {
      a.state = 'down'; a.timer = rand(1.5, 3.5);
      if (a.bleed && G.gore) { G.gore.pool(a.pos.x, a.pos.z, a.dead ? rand(0.36, 0.5) : 0.26); a.bleed = false; }
    }
  }
  launch(a, dir, f, up, isCar, spin = 6) {
    if (!isCar && !a.dead && a.state !== 'air') sfx.yelp(a.pos.x, a.pos.z);   // a cry from someone knocked flying (limited in audio.js)
    if (isCar && a.moto && !a.thrown) {
      a.thrown = true;
      const p = this.borrowPed(a.pos, 0);
      if (p) { p.pos.set(a.pos.x, 0.4, a.pos.z); p.heading = a.heading; this.launch(p, dir, f * 1.1 + 1, up + 1, false, 10); p.bleed = true; }
    }
    a.state = 'air';
    if (!a.q || a.q.lengthSq() === 0 || !a.airborneBefore) a.q.setFromAxisAngle(UP, a.heading);
    if (a.flipped) a.q.multiply(_q.setFromAxisAngle(ZAX, Math.PI));
    a.airborneBefore = true; a.flipped = false;
    a.vel.set(dir.x * f, up, dir.z * f);
    a.w.set(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin));
    if (a.pos.y < 0.02) a.pos.y = 0.02;
  }

  // turn a vehicle into a motorcycle with a rider (also used by the WORLD menu)
  makeMoto(c) {
    c.moto = true; c.thrown = false; c.scale = [1, 1, 1]; c.len = 0.45; c.lean = 0;
    c.color = new THREE.Color(pick(MOTO_PAINT));
    this.moto.body.setColorAt(c.i, c.color); this.moto.rider.setColorAt(c.i, new THREE.Color(pick(JACKETS)));
    this.moto.helmet.setColorAt(c.i, new THREE.Color(Math.random() < 0.5 ? pick(MOTO_PAINT) : 0x111111));
    for (const k of ['body', 'rider', 'helmet']) this.moto[k].instanceColor.needsUpdate = true;
  }

  // ---------- getting in and out of cars ----------
  // world position of a car-local point (lx to the car's left, lz forward)
  carPoint(c, lx, lz) {
    const h = c.heading, sx = c.scale[0], sz = c.scale[2];
    return { x: c.pos.x + lx * sx * Math.cos(h) + lz * sz * Math.sin(h), z: c.pos.z - lx * sx * Math.sin(h) + lz * sz * Math.cos(h) };
  }
  // a stopped car finds the nearest lane and pulls into traffic
  joinTraffic(c) {
    const C = this.city, off = C.roadW / 4;
    let best = null, bd = 1e9;
    for (const e of C.edges.values()) {
      if (e.blocked) continue;
      for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) {
        const A = C.nodes[a], B = C.nodes[b], L = Math.hypot(B.x - A.x, B.z - A.z) || 1, dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
        const ax = A.x - dz * off, az = A.z + dx * off;
        const t = clamp(((c.pos.x - ax) * dx + (c.pos.z - az) * dz) / L, 0.2, 0.75);
        const px = ax + dx * L * t, pz = az + dz * L * t, d = Math.hypot(px - c.pos.x, pz - c.pos.z);
        if (d < bd) { bd = d; best = { a, b, px: px + dx * 1.2, pz: pz + dz * 1.2 }; }
      }
    }
    if (!best) return;
    const A = C.nodes[best.a], B = C.nodes[best.b];
    c.from = best.a; c.to = best.b; c.queue = [{ x: best.px, z: best.pz }, this.stopPoint(A, B)];
    c.state = 'drive'; c.speed = 0.3; c.stuck = 0; c.timer = 0;
    if (c.obs) { const k = C.obstacles.indexOf(c.obs); if (k >= 0) C.obstacles.splice(k, 1); c.obs = null; }
  }
  // pull over to the curb on the right, stop, and let the driver out
  parkHere(c) {
    c.parking = null; c.state = 'parked'; c.speed = 0; c.queue = [];
    const drv = c.driver || this.borrowPed();
    c.driver = null;
    if (!drv) return;
    setTimeout(() => {
      c.doorT = 1.3;
      setTimeout(() => {
        const d = this.carPoint(c, 0.55, 0.1);
        drv.pos.set(d.x, 0, d.z); drv.heading = c.heading + Math.PI / 2; drv.car = null; drv.lost = null; drv.dead = false;
        this.resumePed(drv);
        G.roles && G.roles.parked(drv, c);                       // an errand or a delivery, then back to the car
      }, 450);
    }, 500);
  }
  // someone off-screen we can quietly re-use for a spawn or a driver
  borrowPed(awayFrom = G.camTarget, minD = 55) {
    const ok = this.peds.filter((p) => p.state === 'walk' && !p.officer && !p.zone && !p.hostile && Math.hypot(p.pos.x - awayFrom.x, p.pos.z - awayFrom.z) > minD);
    return ok.length ? pick(ok) : null;
  }
  borrowCar(awayFrom = G.camTarget, minD = 55) {
    const ok = this.cars.filter((c) => c.state === 'drive' && !c.emerg && !c.incident && !c.leaving && Math.hypot(c.pos.x - awayFrom.x, c.pos.z - awayFrom.z) > minD);
    return ok.length ? pick(ok) : null;
  }
  // near the camera now and then: someone walks to a parked car and drives off, or a car pulls over and its
  // driver gets out (the world's cars are driven by people, not remote controlled)
  updateDrivers(dt) {
    if ((this.drvT = (this.drvT ?? rand(4, 8)) - dt) > 0) return;
    this.drvT = rand(5, 11);
    const T = G.camTarget, near = (o, r) => Math.hypot(o.pos.x - T.x, o.pos.z - T.z) < r;
    if (Math.random() < 0.55) {
      const parked = this.cars.filter((c) => c.state === 'parked' && !c.emerg && c.pullOut == null && !c.reserved && near(c, 40));
      for (const c of parked.sort(() => Math.random() - 0.5).slice(0, 6)) {
        const walker = this.peds.find((p) => p.state === 'walk' && !p.officer && !p.hostile && Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) < 14);
        if (!walker) continue;
        c.reserved = true; walker.state = 'toCar'; walker.car = c; walker.target = this.carPoint(c, 0.62, 0.1);
        return;
      }
    } else {
      const C = this.city;
      const moving = this.cars.filter((c) => c.state === 'drive' && !c.emerg && !c.moto && !c.incident && !c.leaving && c.scale[2] < 2 && c.speed > 1.5 && c.flee <= 0 && near(c, 40) && c.queue.length === 1);
      const c = pick(moving);
      if (!c) return;
      const wp = c.queue[0];
      if (Math.hypot(wp.x - c.pos.x, wp.z - c.pos.z) < 8) return;          // not right before a junction
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading), off = C.roadW / 4 + 0.32;
      const px = c.pos.x + fx * 3 - fz * off, pz = c.pos.z + fz * 3 + fx * off;
      if (C.pedBlocked && C.pedBlocked(px, pz)) return;
      c.parking = true; c.queue = [{ x: px, z: pz }];
    }
  }

  // ---------- first responders ----------
  // A world event that needs responders. Nearby events of the same kind merge. Returns the event.
  // (type/opts are optional so older callers that just say "something happened here" keep working)
  report(x, z, sev = 1, type = 'INCIDENT', opts = {}) {
    for (const inc of this.incidents) {
      if (inc.active && inc.type === type && Math.hypot(inc.x - x, inc.z - z) < 28) { inc.sev = Math.max(inc.sev, sev); if (opts.threat) inc.threat = opts.threat; return inc; }
    }
    const inc = { x, z, sev, type, active: true, t: 0, threat: opts.threat || null, needs: opts.needs || null, delay: opts.delay ?? (type === 'FIRE' ? rand(0.6, 1.4) : rand(3, 7)), sent: false };
    this.incidents.push(inc);
    // every emergency makes the news, whoever or whatever caused it (player, NPCs, the director, the menu)
    inc.reported = true;
    if (opts.quiet !== true) G.news && G.news.event(inc);
    if (G.sky && ['FIRE', 'SHOOTING', 'RIOT', 'GANG_CONFLICT', 'EVACUATION', 'INCIDENT'].includes(type)) G.sky.toScene(inc);   // a helicopter over the scene, sometimes
    return inc;
  }
  dispatch(inc) {
    inc.sent = true;
    let want = inc.needs || (NEEDS[inc.type] && NEEDS[inc.type](inc.sev));
    if (!want) {
      want = ['police', 'fire', 'ambulance'];
      if (inc.sev > 1.5) want.push('police', 'fire');
      if (inc.sev > 2.5) want.push('ambulance', 'fire');
    }
    const hs = this.city.hotspot;
    if (hs && (inc.type === 'SHOOTING' || inc.type === 'INCIDENT') && Math.hypot(inc.x - hs.x, inc.z - hs.z) < hs.r + 15) want.push('police', 'police');
    const C = this.city;
    const target = C.nodes.filter((n) => !n.dead && n.edges.length).sort((a, b) => Math.hypot(a.x - inc.x, a.z - inc.z) - Math.hypot(b.x - inc.x, b.z - inc.z))[0];
    // responders come in from a few blocks away (out of view), not from the far side of the map
    const starts = C.nodes.filter((n) => !n.dead && n.edges.length && Math.hypot(n.x - inc.x, n.z - inc.z) > 30)
      .sort((a, b) => Math.hypot(a.x - inc.x, a.z - inc.z) - Math.hypot(b.x - inc.x, b.z - inc.z)).slice(0, 6);
    const hq = C.policeHQ, hqNode = hq && C.nodes.filter((n) => !n.dead && n.edges.length).sort((a, b) => Math.hypot(a.x - hq.x, a.z - hq.z) - Math.hypot(b.x - hq.x, b.z - hq.z))[0];
    want.forEach((type, k) => {
      // reserve the vehicle now: two requests for the same type must not grab the same idle car
      const c = this.cars.find((o) => o.emerg === type && o.state === 'hidden' && !o.posted && !o.reserved);
      if (!c || !starts.length) return;
      c.reserved = true;
      setTimeout(() => {
        c.reserved = false;
        const A = type === 'police' && hqNode ? hqNode : pick(starts);          // police roll out of headquarters
        const nb = A.edges.filter((m) => !C.edge(A.id, m).blocked);
        if (!nb.length) return;
        const B = C.nodes[pick(nb)];
        const e = this.entryPoint(A, B);
        c.pos.set(e.x, 0, e.z); c.heading = Math.atan2(B.x - A.x, B.z - A.z);
        c.from = A.id; c.to = B.id; c.queue = [this.stopPoint(A, B)];
        c.state = 'drive'; c.speed = type === 'fire' ? 3.5 : 2; c.maxSpeed = type === 'fire' ? 6.6 : 5.6; c.dest = target.id; c.incident = inc; c.flee = 0; c.sirenOn = true;
        c.sirenOffAt = G.time + rand(18, 28); // even en route, sirens wind down fairly soon
      }, type === 'fire' ? k * rand(200, 450) : k * rand(900, 2200));
    });
  }
  // scene cleared: responders drive off and return to the pool once out of sight
  // the event is resolved: crews that are out walk back and climb in first, then the vehicle leaves
  release(inc) {
    if (!inc) return;
    inc.active = false;
    for (const c of this.cars) {
      if (c.incident !== inc) continue;
      c.sirenOn = false; c.sirenOffAt = G.time;
      if (c.state === 'onscene' && G.responders && G.responders.recall(c)) c.awaitCrew = true;
      else this.leave(c);
    }
    const k = this.incidents.indexOf(inc); if (k >= 0) this.incidents.splice(k, 1);
  }
  leave(c) {
    c.incident = null; c.dest = null; c.leaving = true; c.awaitCrew = false; c.sirenOn = false; c.sirenOffAt = G.time;
    if (c.state === 'onscene') { c.state = 'drive'; c.speed = 0.5; c.queue = []; }
  }
  arrive(c) {
    c.state = 'onscene'; c.speed = 0; c.queue = [];
    c.sirenOffAt = Math.min(c.sirenOffAt ?? 1e9, G.time + rand(3, 6));
    // angle the vehicle a little, the way responders park
    c.heading += rand(-0.35, 0.35);
    G.responders && G.responders.arrive(c);
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
      this.fireCheckT = 1.5;
      const b = G.buildings.burnArr;
      if (b.length > 2) { const c = pick(b); if (c && c.alive) this.report(c.x, c.z, Math.min(3, 0.8 + b.length / 30), 'FIRE'); }
    }
    // one siren voice at a time: the nearest active responder, kept until another is clearly closer, with a
    // short breather after a siren winds down before the next one starts
    this.sirenT -= dt;
    this.sirenRest = Math.max(0, (this.sirenRest || 0) - dt);
    if (this.sirenT <= 0) {
      this.sirenT = 0.4;
      const T = G.camTarget, dist = (c) => Math.hypot(c.pos.x - T.x, c.pos.z - T.z);
      const active = this.cars.filter((c) => c.emerg && !c.posted && (c.state === 'drive' || c.state === 'onscene') && G.time < (c.sirenOffAt ?? 1e9));
      active.sort((a, b) => dist(a) - dist(b));
      let voice = this.sirenVoice && active.includes(this.sirenVoice) ? this.sirenVoice : null;
      if (voice && active[0] !== voice && dist(active[0]) < dist(voice) * 0.6) voice = active[0];
      if (!voice && active.length && this.sirenRest <= 0) voice = active[0];
      if (this.sirenVoice && !voice) this.sirenRest = rand(4, 8);
      this.sirenVoice = voice;
      const keep = new Set(voice ? [voice] : []);
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
      let nodes = C.pedNodes.filter((n) => n.edges.length && !C.pedBlocked(n.x, n.z));
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
    opts = opts.filter((e) => { const m = C.pedNodes[e.to]; return !C.pedBlocked(m.x, m.z) && !C.obstacleNear((n.x + m.x) / 2, (n.z + m.z) / 2, 0.8); });
    if (!opts.length) { [p.from, p.to] = [p.to, p.from]; return; }
    const e = pick(opts);
    p.pending = e;
  }
  updatePed(p, dt) {
    const C = this.city;
    switch (p.state) {
      case 'air': return this.updateAir(p, dt, false);
      case 'down':
        if (p.dead) return;                  // killed: stays where they fell
        p.timer -= dt;
        if (p.timer <= 0) { p.state = 'flee'; p.timer = rand(4, 8); p.q.identity(); }
        return;
      case 'gone':                            // taken away (e.g. by paramedics); a new person turns up later
        if ((p.respawn -= dt) <= 0) this.respawnPed(p);
        return;
      case 'incar': return;                   // riding in a car: hidden until they get out
      case 'job': return G.roles ? G.roles.tick(p, dt) : this.resumePed(p);   // working (roles.js)
      case 'carried': return;                 // on a stretcher, moved by the paramedics
      case 'toCar': {
        const c = p.car, d = c ? this.carPoint(c, 0.62, 0.1) : null;
        if (!c || c.state !== 'parked') { p.car = null; if (c) c.reserved = false; this.resumePed(p); return; }
        const dx = d.x - p.pos.x, dz = d.z - p.pos.z, l = Math.hypot(dx, dz);
        if (l < 0.12) {
          p.heading = c.heading; c.doorT = 1.3; p.state = 'entering'; p.timer = 0.55;
          return;
        }
        p.heading = Math.atan2(dx, dz); p.pos.x += dx / l * Math.min(l, p.speed * dt); p.pos.z += dz / l * Math.min(l, p.speed * dt);
        return;
      }
      case 'entering':
        if ((p.timer -= dt) <= 0) {
          p.state = 'incar'; const c = p.car; c.driver = p; c.reserved = false; c.pullOut = rand(0.8, 1.4);
          if (p.dropLook && G.roles) G.roles.release(p);          // off shift: the courier's uniform goes with the van
        }
        return;
      case 'riot': {
        // rioters mill around the flashpoint, pump fists, now and then hurl something at a car
        const r = p.riot;
        if (!r || G.time > r.until) { p.riot = null; p.state = 'flee'; p.timer = rand(3, 6); p.threat = r ? { x: r.x, z: r.z } : p.pos; return; }
        const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z, l = Math.hypot(dx, dz);
        if (l > 0.15) { p.heading = Math.atan2(dx, dz); p.pos.x += dx / l * p.speed * 1.2 * dt; p.pos.z += dz / l * p.speed * 1.2 * dt; }
        else {
          p.heading = Math.atan2(r.x - p.pos.x, r.z - p.pos.z);
          if (Math.random() < dt * 0.15) p.target = { x: r.x + rand(-2.5, 2.5), z: r.z + rand(-2.5, 2.5) };
          if (Math.random() < dt * 0.06) G.world && G.world.riotThrow(p);
        }
        return;
      }
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
        if (d < 0.2) { if (p.job) { p.state = 'job'; return; } p.state = p.zone ? (p.group ? 'idle' : 'wander') : 'walk'; p.timer = rand(5, 20); return; }
        // head back toward the sidewalk, stepping around a wall rather than freezing against it
        const want = Math.atan2(dx, dz);
        for (const off of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
          const h = want + off, nx = p.pos.x + Math.sin(h) * p.speed * dt, nz = p.pos.z + Math.cos(h) * p.speed * dt;
          if (G.buildings.inside(_p.set(nx, 0.3, nz))) continue;
          p.heading = h; p.pos.x = nx; p.pos.z = nz; p.returnT = 0;
          return;
        }
        if ((p.returnT = (p.returnT || 0) + dt) > 3) { p.returnT = 0; this.resumePed(p); }
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
        p.pos.x += Math.sin(p.heading) * p.speed * this.pace * dt; p.pos.z += Math.cos(p.heading) * p.speed * this.pace * dt;
      }
    }
  }
  // a fresh person appears somewhere out of view (used after someone is taken away)
  respawnPed(p) {
    const C = this.city, T = G.camTarget;
    const nodes = C.pedNodes.filter((n) => n.edges.length && !C.pedBlocked(n.x, n.z) && Math.hypot(n.x - T.x, n.z - T.z) > 50);
    const n = pick(nodes.length ? nodes : C.pedNodes.filter((m) => m.edges.length)), e = n.edges[0];
    Object.assign(p, { dead: false, lost: null, treated: false, claimed: false, bleed: false, hostile: false, riot: null, car: null, zone: null, group: null });
    p.pos.set(n.x, 0, n.z); p.q.identity(); p.from = n.id; p.to = e.to; p.state = 'walk';
    this.pedColors(p.i);
    for (const m of this.pMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    G.roles && G.roles.respawned(p);
  }
  resumePed(p) {
    const C = this.city;
    if (p.job) { p.hidden = false; p.carry = false; p.pose = null; p.job.steps = []; p.job.k = 0; p.job.chat = null; p.state = 'return'; p.target = { x: p.job.home.x, z: p.job.home.z }; return; }
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
      if (p.state === 'job' && p.hidden) continue;             // indoors
      const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz) + 0.01;
      if (d > r * 1.2) continue;
      p.threat = threat;
      if (d < kill && power > 1.5 && p.state !== 'air') {
        const f = power * (1 - d / kill);
        if (f > 1) {
          if (G.gore && G.gore.on) {
            const col = (m) => new THREE.Color().fromArray(m.instanceColor.array, p.i * 3);
            const r = G.gore.blast(p.pos.x, p.pos.y, p.pos.z, f, dx / d, dz / d, { skin: col(this.pHead), arm: col(this.pArmL), leg: col(this.pLegL) }, kind);
            p.lost = { ...(p.lost || {}), ...r.lost }; if (r.dead) p.dead = true;
            p.bleed = f > 2 || r.dead;
            this.pTorso.setColorAt(p.i, G.gore.stain(col(this.pTorso), r.dead ? 0.55 : 0.3)); this.pTorso.instanceColor.needsUpdate = true;
          }
          this.launch(p, { x: dx / d, z: dz / d }, f * 1.3, f * (kind === 'wind' ? 0.6 : 1.1), false, 10); scared++; continue;
        }
      }
      if (p.state === 'walk' || p.state === 'wait' || p.state === 'wander' || p.state === 'idle' || p.state === 'return' || p.state === 'job') {
        if (p.state === 'job') { p.carry = false; p.pose = null; if (p.pos.y > 0.3) p.pos.y = 0; }
        p.state = 'alert'; p.timer = rand(0.1, 0.7); scared++;
      } else if (p.state === 'flee') p.timer = Math.max(p.timer, rand(3, 6));
    }
    if (scared > 2 && power > 0.5) sfx.screams(x, z, Math.min(6, 1 + Math.floor(scared / 8)));
  }

  gk(x, z) { return Math.floor(x / 4) * 1000 + Math.floor(z / 4); }

  // a bike leans into turns; its rider rides it until thrown off
  drawMoto(c, dt) {
    const M = this.moto, i = c.i;
    if (!c.moto) { for (const m of Object.values(M)) m.setMatrixAt(i, ZERO); c.motoShown = false; return; }
    c.motoShown = true;
    const turn = c.prevH == null ? 0 : Math.atan2(Math.sin(c.heading - c.prevH), Math.cos(c.heading - c.prevH)) / Math.max(dt, 1e-3);
    c.prevH = c.heading;
    c.lean += (clamp(-turn * 0.28 * Math.min(1, c.speed / 3), -0.55, 0.55) - c.lean) * Math.min(1, dt * 6);
    if (c.state !== 'air' && !(c.state === 'wreck' && c.airborneBefore)) _q.setFromEuler(_e.set(0, c.heading, c.state === 'wreck' ? 1.4 : c.lean, 'YXZ'));
    _m2.compose(c.pos, _q, _s.set(1, 1, 1));
    M.body.setMatrixAt(i, _m2); M.dark.setMatrixAt(i, _m2);
    const riding = !c.thrown && c.state !== 'hidden';
    M.rider.setMatrixAt(i, riding ? _m2 : ZERO); M.helmet.setMatrixAt(i, riding ? _m2 : ZERO);
    M.lamp.setMatrixAt(i, c.state === 'drive' ? _m2 : ZERO);
  }
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
    this.updateDrivers(dt);

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
      if (hidden) { for (const m of [this.carBody, this.carDark, this.headL, this.tailL, this.headPool]) m.setMatrixAt(c.i, ZERO); if (c.motoShown) this.drawMoto({ ...c, moto: false }, dt), (c.motoShown = false); this.doors.setMatrixAt(c.i * 2, ZERO); this.doors.setMatrixAt(c.i * 2 + 1, ZERO); }
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
        if (c.moto || c.motoShown) this.drawMoto(c, dt);
        if (c.moto) { for (const m of [this.carBody, this.carDark, this.headL, this.tailL, this.headPool]) m.setMatrixAt(c.i, ZERO); continue; }
        this.carBody.setMatrixAt(c.i, _m); this.carDark.setMatrixAt(c.i, _m);
        const lit = c.state === 'drive' || c.state === 'onscene';
        this.headL.setMatrixAt(c.i, lit ? _m : ZERO);
        this.tailL.setMatrixAt(c.i, lit ? _m : ZERO);
        if (lit) { _m2.compose(_p, _q, _s.set(1, 1, 1)); this.headPool.setMatrixAt(c.i, night > 0.05 && c.state === 'drive' ? _m2 : ZERO); }
        else this.headPool.setMatrixAt(c.i, ZERO);
        const b = c.braking || c.speed < 0.2 ? 2.2 : 1;
        this.tailL.setColorAt(c.i, _v.set(b, b, b));
        // doors swing open while someone gets in or out (driver side, and the far side for crews)
        for (const [k, t, side] of [[0, c.doorT, 1], [1, c.doorT2, -1]]) {
          if (!(t > 0)) { this.doors.setMatrixAt(c.i * 2 + k, ZERO); continue; }
          const open = Math.min(1, t / 0.3, (1.3 - t) / 0.3 + 0.001);
          _m2.makeRotationY(-side * 1.1 * Math.max(0, open)); _m2.setPosition(side * 0.335, 0, 0.29);
          this.doors.setMatrixAt(c.i * 2 + k, _m3.multiplyMatrices(_m, _m2));
        }
      }
      if (c.emerg) {
        const on = (c.state === 'drive' || c.state === 'onscene') && !c.quiet;
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
    for (const m of [this.carBody, this.carDark, this.headL, this.tailL, this.headPool, this.beacons, this.doors, ...Object.values(this.moto)]) m.instanceMatrix.needsUpdate = true;
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

    // weather: people hurry in the rain, step carefully in snow; umbrellas go up
    const W = G.world, rain = W ? W.rain : 0, snow = W ? W.snow || 0 : 0;
    this.pace = 1 + rain * 0.3 - snow * 0.15;
    const umbOn = rain > 0.25;
    this.frame++;
    for (const p of this.peds) {
      // distance LOD: people far from the view in routine states update every third frame (and keep their last pose)
      const far = Math.abs(p.pos.x - T.x) + Math.abs(p.pos.z - T.z) > 150 && LOD_STATES.has(p.state);
      if (far) { p.lodDt = (p.lodDt || 0) + dt; if ((this.frame + p.i) % 3) continue; this.updatePed(p, p.lodDt); p.lodDt = 0; }
      else this.updatePed(p, dt);
      const umbrella = umbOn && p.i % 3 === 0 && !p.officer && (p.state === 'walk' || p.state === 'wait' || p.state === 'wander' || p.state === 'idle' || p.state === 'return' || (p.state === 'job' && !p.hidden && !p.carry));
      if (!umbrella && p.umbShown) { this.umb.setMatrixAt(p.i, ZERO); p.umbShown = false; }
      if (p.state === 'gone' || p.state === 'incar' || (p.hidden && p.state === 'job')) { for (const m of this.pMeshes) m.setMatrixAt(p.i, ZERO); if (p.slot != null) G.roles.draw(p, null, null); continue; }
      const moving = p.state === 'walk' || p.state === 'flee' || p.state === 'wander' || p.state === 'return' || p.state === 'toCar' || (p.state === 'job' && p.jmove) || (p.state === 'riot' && p.target && Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z) > 0.15);
      const run = p.state === 'flee';
      const cyc = G.time * (run ? 13 : 7.5) + p.phase;
      const bob = moving ? Math.abs(Math.sin(cyc)) * (run ? 0.035 : 0.018) : 0;
      if (p.state === 'air') _q.copy(p.q);
      else if (p.state === 'down' || p.state === 'carried') _q.setFromAxisAngle(UP, p.heading).multiply(new THREE.Quaternion().setFromAxisAngle(XAX, Math.PI / 2));
      else { _q.setFromAxisAngle(UP, p.heading); if (run) _q.multiply(new THREE.Quaternion().setFromAxisAngle(XAX, 0.2)); }
      let leg = 0, arm = 0, armOut = 0.1;
      if (moving) { leg = Math.sin(cyc) * (run ? 0.8 : 0.45); arm = -leg * (run ? 1.1 : 0.8); }
      else if (p.state === 'air') { leg = Math.sin(G.time * 18 + p.phase) * 0.7; arm = -leg; armOut = 1.1; }
      else if (p.state === 'alert') { armOut = 0.35; }
      else if (p.state === 'idle' && p.group) arm = Math.max(0, Math.sin(G.time * 1.3 + p.phase * 3)) * 0.7; // talking with hands
      else if (p.state === 'riot' || p.state === 'entering') { arm = p.state === 'riot' ? -2.6 + Math.sin(G.time * 7 + p.phase) * 0.5 : -0.8; }
      // working poses (hammering, sweeping, carrying, radio...) from roles.js
      const o = POSE; o.aL = arm; o.aR = p.state === 'idle' ? 0 : -arm; o.oL = armOut; o.oR = armOut; o.lL = leg; o.lR = -leg; o.dy = 0;
      if (p.role && G.roles) G.roles.pose(p, o, moving);
      _p.set(p.pos.x, p.pos.y + bob + o.dy + (p.state === 'down' ? 0.06 : 0), p.pos.z);
      _m.compose(_p, _q, _s.set(p.s, p.s, p.s));
      const i = p.i;
      this.pTorso.setMatrixAt(i, _m); this.pHead.setMatrixAt(i, _m); this.pHair.setMatrixAt(i, _m);
      this.limb(this.pLegL, i, 0.034, 0.31, o.lL);
      this.limb(this.pLegR, i, -0.034, 0.31, o.lR);
      this.limb(this.pArmL, i, 0.084, 0.535, o.aL, o.oL);
      this.limb(this.pArmR, i, -0.084, 0.535, o.aR, -o.oR);
      if (p.slot != null) G.roles.draw(p, _m, _m3);
      if (umbrella) { this.umb.setMatrixAt(p.i, _m); p.umbShown = true; }
      if (p.lost) {
        if (p.lost.armL) this.pArmL.setMatrixAt(i, ZERO);
        if (p.lost.armR) this.pArmR.setMatrixAt(i, ZERO);
        if (p.lost.legL) this.pLegL.setMatrixAt(i, ZERO);
        if (p.lost.legR) this.pLegR.setMatrixAt(i, ZERO);
        if (p.lost.head) { this.pHead.setMatrixAt(i, ZERO); this.pHair.setMatrixAt(i, ZERO); }
      }
    }
    for (const m of this.pMeshes) m.instanceMatrix.needsUpdate = true;
    this.umb.instanceMatrix.needsUpdate = true;
    G.roles && G.roles.flush();
  }
}

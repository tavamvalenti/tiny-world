// Things in the sky: now and then an airliner, a small plane or a helicopter crosses high over the city on a
// straight line (helicopters sometimes circle over an emergency scene), and bird flocks wheel about, circle,
// scatter from explosions and fly off. No physics: aircraft follow a line, a flock is one moving centre that
// its birds trail with a little noise. Everything is a few instanced/merged meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), _w = new THREE.Matrix4(), _w2 = new THREE.Matrix4();
const MAX_BIRDS = 60;
// per map: how often things turn up (mean seconds), where birds like to be, what they look like
const MAP = {
  downtown: { plane: 70, heli: 150, flock: 45, birdCol: [0xffffff, 0xe6e1d8], spots: (C) => [{ x: C.shoreX + 6, z: rand(-40, 40) }, { x: rand(-40, 40), z: rand(-40, 40) }] },
  suburbs: { plane: 80, heli: 200, flock: 55, birdCol: [0xd6d3cd, 0xc2beb6], spots: (C) => [{ x: rand(-50, 50), z: rand(-50, 50) }, C.court ? { x: (C.court.x0 + C.court.x1) / 2, z: C.court.z1 + 6 } : { x: 0, z: 0 }] },
  vegas: { plane: 40, heli: 70, flock: 90, birdCol: [0x5a5550, 0x3a3632], spots: () => [{ x: rand(-60, 60), z: rand(-100, 100) }, { x: -16, z: -10 }] },
  greenland: { plane: 140, heli: 120, flock: 30, birdCol: [0xffffff, 0xdfe4e8], spots: () => [{ x: rand(-90, -45), z: rand(-30, 30) }, { x: rand(-120, -60), z: rand(-60, 60) }] },
  london: { plane: 45, heli: 140, flock: 35, birdCol: [0x7a7f86, 0xe8e8e4], spots: (C) => [{ x: rand(-60, 60), z: rand(-20, 10) }, { x: rand(-60, 60), z: rand(-60, 60) }] },
  tropical: { plane: 90, heli: 220, flock: 28, birdCol: [0xffffff, 0xfff6ea], spots: (C) => [{ x: rand(-50, 50), z: rand(-34, -20) }, { x: rand(-50, 50), z: rand(-45, -30) }] },
};

function tintGeo(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const bx = (w, h, d, x, y, z, c) => tintGeo(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);

// ---- a seabird (after a booby in flight): cream body, dark head, pale beak, dark wedge tail; forward +z ----
function birdBody() {
  const col = (g, c) => tintGeo(g, c);
  return mergeGeometries([
    col(new THREE.SphereGeometry(1, 10, 7).scale(0.045, 0.04, 0.15), 0xf1e8d8),                        // body
    col(new THREE.SphereGeometry(1, 9, 6).scale(0.034, 0.032, 0.05).translate(0, 0.006, 0.15), 0x2a211b),   // dark head and neck
    col(new THREE.ConeGeometry(0.014, 0.085, 6).rotateX(Math.PI / 2).translate(0, 0.002, 0.23), 0xe8c98e),  // beak
    col(new THREE.ConeGeometry(0.05, 0.14, 4).scale(1, 0.18, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.2), 0x241c17),   // wedge tail
  ]);
}
// one wing (the right one, spanning +x from the shoulder): long and narrow with a crook at the wrist; dark leading
// edge, trailing edge and hand, a pale band down the middle of the arm (the look of the underwing in flight)
function birdWing() {
  const N = 10, rows = [0, 0.3, 0.62, 1], pos = [], colr = [], idx = [];
  const dark = new THREE.Color(0x221b16), pale = new THREE.Color(0xf4efe4), c = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = 0.03 + u * 0.56;
    // leading edge sweeps back past the wrist; the chord narrows to a point at the tip
    const lead = 0.05 + 0.035 * Math.sin(Math.min(1, u / 0.45) * Math.PI / 2) - Math.max(0, u - 0.45) * 0.42;
    const chord = (0.13 - u * 0.1) * (u > 0.92 ? (1 - u) / 0.08 : 1) + 0.004;
    const lift = Math.sin(u * Math.PI) * 0.012;                                   // a gentle arch
    rows.forEach((r) => {
      pos.push(x, lift, lead - chord * r);
      const band = u < 0.62 && r > 0.1 && r < 0.9;                                  // the white band on the arm
      c.copy(band ? pale : dark).lerp(dark, band ? Math.max(0, (u - 0.4) / 0.22) : 0);
      colr.push(c.r, c.g, c.b);
    });
  }
  for (let i = 0; i < N; i++) for (let r = 0; r < 3; r++) {
    const a = i * 4 + r, b = a + 1, d = a + 4, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function airliner() {   // nose +z, ~7 units long
  return mergeGeometries([
    tintGeo(new THREE.CylinderGeometry(0.36, 0.3, 6.4, 10).rotateX(Math.PI / 2), 0xf2f2f0), tintGeo(new THREE.SphereGeometry(0.36, 10, 6).scale(1, 1, 1.4).translate(0, 0, 3.2), 0xf2f2f0),
    tintGeo(new THREE.ConeGeometry(0.3, 1.1, 10).rotateX(-Math.PI / 2).translate(0, 0.05, -3.7), 0xf2f2f0),
    bx(6.6, 0.07, 1.1, 0, -0.1, 0.2, 0xd8dbe0), bx(2.4, 0.06, 0.6, 0, 0.1, -3.4, 0xd8dbe0), bx(0.07, 1.2, 0.9, 0, 0.7, -3.5, 0x1f55d6),
    tintGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 8).rotateX(Math.PI / 2).translate(-1.4, -0.35, 0.5), 0x8f949a), tintGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.8, 8).rotateX(Math.PI / 2).translate(1.4, -0.35, 0.5), 0x8f949a),
    bx(0.72, 0.05, 5.2, 0, -0.02, 0.1, 0x1f55d6),
  ]);
}
function smallPlane() {
  return mergeGeometries([
    tintGeo(new THREE.CylinderGeometry(0.16, 0.1, 2, 8).rotateX(Math.PI / 2), 0xf2f2ee), bx(2.6, 0.05, 0.4, 0, 0.12, 0.2, 0xc8361f),
    bx(0.9, 0.04, 0.25, 0, 0.05, -0.9, 0xf2f2ee), bx(0.04, 0.35, 0.3, 0, 0.2, -0.9, 0xc8361f), bx(0.5, 0.02, 0.04, 0, 0, 1.03, 0x333333),
  ]);
}
function heliBody() {
  return mergeGeometries([
    tintGeo(new THREE.SphereGeometry(0.42, 10, 8).scale(0.8, 0.75, 1.2), 0x1f2a44), tintGeo(new THREE.CylinderGeometry(0.08, 0.05, 1.5, 6).rotateX(Math.PI / 2).translate(0, 0.08, -1.1), 0x1f2a44),
    bx(0.04, 0.35, 0.22, 0.03, 0.2, -1.8, 0x1f2a44), bx(0.05, 0.05, 0.9, 0.3, -0.4, 0, 0x2b2e33), bx(0.05, 0.05, 0.9, -0.3, -0.4, 0, 0x2b2e33),
    tintGeo(new THREE.SphereGeometry(0.3, 8, 6).scale(0.7, 0.55, 0.6).translate(0, 0.02, 0.32), 0x9fd0ff),
  ]);
}

export class Sky {
  constructor(scene, mapName, city) {
    this.map = MAP[mapName] || MAP.downtown; this.city = city; this.scene = scene;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.kinds = { airliner: new THREE.Mesh(airliner(), mat), small: new THREE.Mesh(smallPlane(), mat), heli: new THREE.Mesh(heliBody(), mat) };
    for (const m of Object.values(this.kinds)) { m.visible = false; m.castShadow = true; scene.add(m); }
    this.kinds.airliner.scale.setScalar(0.42); this.kinds.small.scale.setScalar(0.6); this.kinds.heli.scale.setScalar(0.85);   // read as far off
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.55 }));
    this.rotor.position.y = 0.42; this.kinds.heli.add(this.rotor);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    scene.add(this.beacon); this.beacon.visible = false;
    this.craft = [];
    this.t = { plane: rand(15, 35), heli: rand(60, 120), flock: rand(4, 12) };
    // birds: body + two hinged wings, three instanced meshes; the wings flap about the shoulder
    const bmat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const rw = birdWing(), lw = rw.clone().scale(-1, 1, 1);
    lw.index.array.reverse?.(); lw.computeVertexNormals();
    this.birds = new THREE.InstancedMesh(birdBody(), bmat, MAX_BIRDS);
    this.wingR = new THREE.InstancedMesh(rw, bmat, MAX_BIRDS);
    this.wingL = new THREE.InstancedMesh(lw, bmat, MAX_BIRDS);
    this.birdParts = [this.birds, this.wingR, this.wingL];
    for (const m of this.birdParts) { for (let i = 0; i < MAX_BIRDS; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, new THREE.Color(0xffffff)); } m.frustumCulled = false; m.castShadow = true; scene.add(m); }
    this.flocks = []; this.free = Array.from({ length: MAX_BIRDS }, (_, i) => MAX_BIRDS - 1 - i);
    G.sky = this;
  }

  // ---------- aircraft ----------
  launch(kind, over = null) {
    // below the camera (it sits ~70 up at the usual zoom) but above the rooftops, on a line that misses the towers
    const T = G.camTarget, alt = kind === 'airliner' ? rand(38, 44) : kind === 'small' ? rand(30, 36) : rand(22, 28);
    const speed = kind === 'airliner' ? rand(16, 20) : kind === 'small' ? rand(10, 13) : rand(8, 11);
    const L = 300, tall = G.buildings.list.filter((b) => b.floors * 1.05 + 2 > alt - 4);
    let dir, side, cx, cz, ok = tall.length === 0;
    for (let k = 0; k < 12; k++) {
      const ang = rand(0, 6.28); dir = { x: Math.cos(ang), z: Math.sin(ang) }; side = 0;
      // aim the line through a point that's on screen at that height (a ray from the camera through the view),
      // unless the camera is zoomed in below it, in which case it just passes over unseen
      let bx = T.x, bz = T.z;
      const C = G.camera.position;
      if (!over && C.y > alt + 8) {
        const v = _p.set(rand(-0.5, 0.5), rand(-0.2, 0.5), 0.5).unproject(G.camera).sub(C).normalize();
        if (v.y < -0.05) { const t = (alt - C.y) / v.y; bx = C.x + v.x * t; bz = C.z + v.z * t; }
      }
      cx = (over ? over.x : bx) - dir.z * (over ? 0 : side); cz = (over ? over.z : bz) + dir.x * (over ? 0 : side);
      // distance from each tall building to the flight line
      if (!tall.some((b) => Math.abs((b.x - cx) * dir.z - (b.z - cz) * dir.x) < Math.max(b.w, b.d) / 2 + 6)) { ok = true; break; }
    }
    if (!ok && !over) return;                                  // no clear line past the towers this time
    const c = { kind, m: this.kinds[kind], x: cx - dir.x * L / 2, z: cz - dir.z * L / 2, y: over ? Math.max(alt, this.roofNear(over) + 8) : alt, dir, speed, left: L, over, orbit: over ? rand(20, 35) : 0, a: 0 };
    c.m.visible = true; this.craft.push(c);
    if (kind === 'heli' && Math.hypot(cx - T.x, cz - T.z) < 80) sfx.heli && sfx.heli(cx, cz);
  }
  roofNear(o) { let h = 0; for (const b of G.buildings.list) if (Math.abs(b.x - o.x) < 20 && Math.abs(b.z - o.z) < 20) h = Math.max(h, b.floors * 1.05 + 2); return h; }
  busy(kind) { return this.craft.some((c) => c.kind === kind); }
  // an emergency scene gets a news/police helicopter now and then
  toScene(ev) { if (!this.busy('heli') && Math.random() < 0.35) this.launch('heli', { x: ev.x, z: ev.z }); }

  // ---------- birds ----------
  flock(at = null) {
    const n = Math.min(this.free.length, Math.round(rand(8, 25)));
    if (n < 6) return;
    const spot = at || pick(this.map.spots(this.city)), col = new THREE.Color(pick(this.map.birdCol));
    const f = { x: spot.x + rand(-30, 30), z: spot.z + rand(-30, 30), y: rand(7, 13), h: rand(0, 6.28), turn: rand(-0.3, 0.3), sp: rand(4, 6), life: rand(40, 80), circle: 0, scatter: 0, birds: [] };
    for (let k = 0; k < n; k++) {
      const i = this.free.pop();
      for (const m of this.birdParts) m.setColorAt(i, col);
      f.birds.push({ i, ox: rand(-7, 7), oy: rand(-1.8, 1.8), oz: rand(-7, 7), ph: rand(0, 6.28), vx: 0, vy: 0, vz: 0 });
    }
    for (const m of this.birdParts) m.instanceColor.needsUpdate = true;
    this.flocks.push(f);
  }
  onBlast(x, y, z, r, power) {
    if (power < 2) return;
    for (const f of this.flocks) if (Math.hypot(f.x - x, f.z - z) < r * 2.5 + 20) {
      f.scatter = 2.5; f.life = Math.min(f.life, 6); f.h = Math.atan2(f.z - z, f.x - x); f.sp = 10;
      for (const b of f.birds) { const a = rand(0, 6.28); b.vx = Math.cos(a) * rand(4, 9); b.vz = Math.sin(a) * rand(4, 9); b.vy = rand(2, 6); }
    }
  }

  // the bird closest to (x, z) within r, with how many of its flock are near it: { x, y, z, n } or null
  nearestBird(x, z, r = 50) {
    let best = null, bd = r;
    for (const f of this.flocks) for (const b of f.birds) {
      const bx = f.x + b.ox, bz = f.z + b.oz, d = Math.hypot(bx - x, bz - z);
      if (d < bd) { bd = d; best = { x: bx, y: f.y + b.oy, z: bz, n: f.birds.length }; }
    }
    return best;
  }
  update(dt) {
    const T = G.camTarget, M = this.map;
    // schedule: rare, and never two of a kind at once
    if ((this.t.plane -= dt) <= 0) { this.t.plane = M.plane * rand(0.6, 1.5); if (!this.busy('airliner') && !this.busy('small')) this.launch(Math.random() < 0.65 ? 'airliner' : 'small'); }
    if ((this.t.heli -= dt) <= 0) { this.t.heli = M.heli * rand(0.6, 1.5); if (!this.busy('heli')) this.launch('heli'); }
    if ((this.t.flock -= dt) <= 0) { this.t.flock = M.flock * rand(0.6, 1.5); if (this.flocks.length < 2) this.flock(); }
    // aircraft along their lines (helicopters sent to a scene circle it for a while first)
    for (const c of [...this.craft]) {
      if (c.over && c.orbit > 0) {
        c.orbit -= dt; c.a += dt * 0.35;
        const tx = c.over.x + Math.cos(c.a) * 14, tz = c.over.z + Math.sin(c.a) * 14, dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
        if (d > 0.5) { c.dir = { x: dx / d, z: dz / d }; }
        c.x += c.dir.x * Math.min(d, c.speed * dt); c.z += c.dir.z * Math.min(d, c.speed * dt);
        if (c.orbit <= 0) { c.left = 170; c.over = null; }
      } else { c.x += c.dir.x * c.speed * dt; c.z += c.dir.z * c.speed * dt; c.left -= c.speed * dt; }
      const yaw = Math.atan2(c.dir.x, c.dir.z), bank = c.over ? -0.25 : 0;
      c.m.position.set(c.x, c.y, c.z); c.m.rotation.set(c.kind === 'heli' ? 0.12 : 0, yaw, bank, 'YXZ');
      if (c.kind === 'heli') this.rotor.rotation.y += dt * 40;
      if (c.kind !== 'heli') { this.beacon.visible = Math.floor(G.time * 1.2) % 2 === 0; this.beacon.position.set(c.x, c.y - 0.3, c.z); }
      if (!c.over && c.left <= 0) { c.m.visible = false; this.craft.splice(this.craft.indexOf(c), 1); if (c.kind !== 'heli') this.beacon.visible = false; }
    }
    // flocks: the centre wanders, circles for a spell, then leaves; birds trail it with a flap
    for (const f of [...this.flocks]) {
      f.life -= dt;
      if (f.scatter > 0) f.scatter -= dt;
      else if (f.circle > 0) { f.circle -= dt; f.h += dt * 0.9; }
      else { if (Math.random() < dt * 0.08) f.circle = rand(5, 10); f.h += (f.turn + Math.sin(G.time * 0.3 + f.x) * 0.25) * dt; }
      if (f.life < 0) { f.y += dt * 3; f.sp = Math.min(12, f.sp + dt * 2); }     // off it goes
      f.x += Math.cos(f.h) * f.sp * dt; f.z += Math.sin(f.h) * f.sp * dt;
      const far = Math.hypot(f.x - T.x, f.z - T.z) > 200;
      for (const b of f.birds) {
        if (f.scatter > 0) { b.ox += b.vx * dt; b.oy += b.vy * dt; b.oz += b.vz * dt; b.vy *= 0.97; }
        else { b.ox *= 1 - dt * 0.03; b.oz *= 1 - dt * 0.03; b.ox += Math.sin(G.time * 0.5 + b.ph) * dt * 1.1; b.oz += Math.cos(G.time * 0.45 + b.ph) * dt * 1.1; /* loose, spread-out flock */ }
        // wingbeats in bursts with long glides between (faster, constant beating when scattering)
        const glide = f.scatter > 0 ? 1 : Math.max(0, Math.sin(G.time * 0.45 + b.ph * 3));
        const beat = Math.sin(G.time * (f.scatter > 0 ? 16 : 9) + b.ph);
        const flap = 0.08 + beat * (f.scatter > 0 ? 0.75 : 0.62) * glide + (1 - glide) * 0.12;
        const bank = f.circle > 0 ? -0.35 : Math.sin(G.time * 0.6 + b.ph) * 0.12;
        _q.setFromEuler(_e.set(-beat * 0.05 * glide, -f.h + Math.PI / 2, bank, 'YXZ'));
        _m.compose(_p.set(f.x + b.ox, f.y + b.oy + Math.sin(G.time * 2 + b.ph) * 0.2 - beat * 0.03 * glide, f.z + b.oz), _q, _s.set(1.1, 1.1, 1.1));
        if (far && f.life < 0) { for (const m of this.birdParts) m.setMatrixAt(b.i, ZERO); continue; }
        this.birds.setMatrixAt(b.i, _m);
        // each wing hinges at its shoulder
        _w.makeRotationZ(flap); _w.setPosition(0.035, 0.01, 0.02); this.wingR.setMatrixAt(b.i, _w2.multiplyMatrices(_m, _w));
        _w.makeRotationZ(-flap); _w.setPosition(-0.035, 0.01, 0.02); this.wingL.setMatrixAt(b.i, _w2.multiplyMatrices(_m, _w));
      }
      if (f.life < -20 || (far && f.life < 0)) { for (const b of f.birds) { for (const m of this.birdParts) m.setMatrixAt(b.i, ZERO); this.free.push(b.i); } this.flocks.splice(this.flocks.indexOf(f), 1); }
    }
    for (const m of this.birdParts) m.instanceMatrix.needsUpdate = true;
  }
}

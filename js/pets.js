// Life that makes its own sounds: dogs out on walks (Chicago and La Playa) and a groundskeeper mowing a lawn
// (Chicago). The barking and the mower engine only ever come from these, so every one of those sounds has
// something in the world making it.
//   Dogs trot on a leash a little behind their owner (an ordinary pedestrian), bark now and then when the camera
//   is close, bark and bolt at an explosion, and run off if their owner runs or goes down. A dog that ran off
//   comes back later with a new owner somewhere out of view.
//   The groundskeeper pushes a mower back and forth across a lawn in stripes, in daylight only; a blast nearby
//   sends them running (the engine stops) and they come back to finish the job a while later.
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const DOGS = { suburbs: 7, tropical: 6, downtown: 0, vegas: 6, greenland: 5, cairo: 6 };
const COATS = [0x6b4a2e, 0x2a2420, 0xd8c7a6, 0xa86a32, 0xf2efe8, 0x8a8178, 0x3d2a1e];
const WALKING = new Set(['walk', 'wander', 'wait', 'idle', 'return']);
const UP = new THREE.Vector3(0, 1, 0);

function lambert(c) { return new THREE.MeshLambertMaterial({ color: c }); }
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// a small dog facing +z: body, head with snout and ears, tail; four legs on their own hinges
function makeDog(coat) {
  const g = new THREE.Group(), m = lambert(coat), dark = lambert(0x1c1916);
  const body = new THREE.Mesh(box(0.09, 0.08, 0.22, 0, 0.13, 0), m);
  const head = new THREE.Group(); head.position.set(0, 0.19, 0.12);
  head.add(new THREE.Mesh(box(0.08, 0.075, 0.08, 0, 0, 0.01), m), new THREE.Mesh(box(0.045, 0.04, 0.05, 0, -0.012, 0.07), m),
    new THREE.Mesh(box(0.02, 0.02, 0.012, 0, -0.005, 0.098), dark), new THREE.Mesh(box(0.022, 0.04, 0.02, -0.03, 0.045, -0.01), m), new THREE.Mesh(box(0.022, 0.04, 0.02, 0.03, 0.045, -0.01), m));
  const tail = new THREE.Mesh(box(0.018, 0.018, 0.09, 0, 0, -0.045), m); tail.position.set(0, 0.16, -0.11); tail.rotation.x = 0.6;
  const legs = [[-0.03, 0.08], [0.03, 0.08], [-0.03, -0.08], [0.03, -0.08]].map(([x, z]) => {
    const p = new THREE.Group(); p.position.set(x, 0.1, z); p.add(new THREE.Mesh(box(0.022, 0.1, 0.022, 0, -0.05, 0), m)); g.add(p); return p;
  });
  g.add(body, head, tail);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, head, tail, legs };
}

// the groundskeeper (hi-vis vest, cap) and a red push mower, as one group facing +z: the mower out in front
function makeMowing() {
  const g = new THREE.Group(), skin = lambert(0xc68e66), vest = lambert(0xd7ff3a), pants = lambert(0x2f3a4a), red = lambert(0xc0281e), blk = lambert(0x1a1a1a), steel = lambert(0x9aa0a6);
  const person = new THREE.Group();
  person.add(new THREE.Mesh(box(0.13, 0.2, 0.08, 0, 0.42, 0), vest), new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.58, 0), skin),
    new THREE.Mesh(box(0.11, 0.025, 0.11, 0, 0.62, 0.01), lambert(0x2b4f8a)));
  for (const s of [-1, 1]) { const a = new THREE.Mesh(box(0.035, 0.035, 0.18, s * 0.075, 0.45, 0.08), vest); a.rotation.x = 0.35; person.add(a); }
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.035, 0.31, 0); p.add(new THREE.Mesh(box(0.045, 0.31, 0.05, 0, -0.155, 0), pants)); person.add(p); return p; });
  const mower = new THREE.Group(); mower.position.set(0, 0, 0.36);
  mower.add(new THREE.Mesh(box(0.2, 0.06, 0.24, 0, 0.07, 0), red), new THREE.Mesh(box(0.08, 0.05, 0.08, 0, 0.12, 0.02), blk),
    new THREE.Mesh(box(0.018, 0.018, 0.26, -0.07, 0.25, -0.17), steel), new THREE.Mesh(box(0.018, 0.018, 0.26, 0.07, 0.25, -0.17), steel), new THREE.Mesh(box(0.16, 0.02, 0.02, 0, 0.36, -0.28), blk));
  mower.children[2].rotation.x = mower.children[3].rotation.x = 0.85;
  for (const [x, z] of [[-0.1, 0.09], [0.1, 0.09], [-0.1, -0.09], [0.1, -0.09]]) mower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8).rotateZ(Math.PI / 2).translate(x, 0.03, z), blk));
  g.add(person, mower);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, person, legs, mower };
}

export class Pets {
  constructor(scene, map, city) {
    this.scene = scene; this.dogs = []; this.mow = null;
    const n = DOGS[map] || 0;
    for (let i = 0; i < n; i++) {
      const d = makeDog(pick(COATS)), sc = rand(0.85, 1.25);
      d.g.scale.setScalar(sc); d.g.visible = false; scene.add(d.g);
      const leashGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const leash = new THREE.Line(leashGeo, new THREE.LineBasicMaterial({ color: pick([0xc0392b, 0x2e86de, 0x111111, 0x27ae60]) }));
      leash.frustumCulled = false; leash.visible = false; scene.add(leash);
      this.dogs.push({ ...d, sc, leash, owner: null, x: 0, z: 0, h: 0, sp: 0, state: 'wait', t: rand(0, 2), barkT: rand(4, 14), hop: 0, ph: rand(0, 6) });
    }
    // the groundskeeper works the biggest lawn on the map (Chicago's school field)
    const lawn = (city.lawns || []).slice().sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0];
    if (lawn) {
      const m = makeMowing(); scene.add(m.g);
      this.mow = { ...m, lawn, x: lawn.x0 + 0.5, z: lawn.z0 + 0.4, dir: 1, row: 0, state: 'mow', t: 0, eng: null, ph: 0 };
    }
    G.pets = this;
  }

  // a walker for a dog: an ordinary pedestrian out walking, away from the camera when re-homing an off-screen dog
  findOwner(awayFrom = null) {
    const P = G.agents ? G.agents.peds : [];
    let ok = P.filter((p) => WALKING.has(p.state) && !p.hidden && !p.role && !p.officer && !p.dog && !p.group &&
      (!awayFrom || Math.hypot(p.pos.x - awayFrom.x, p.pos.z - awayFrom.z) > 55));
    // a map can keep its dog walkers in its neighbourhood (Las Vegas: the suburb)
    const A = G.city && G.city.dogArea; if (A) { const inA = ok.filter((p) => p.pos.x > A.x0 && p.pos.x < A.x1 && p.pos.z > A.z0 && p.pos.z < A.z1); if (inA.length) ok = inA; }
    return ok.length ? pick(ok) : null;
  }

  onBlast(x, y, z, r) {
    for (const d of this.dogs) {
      if (d.state !== 'walk') continue;
      const dist = Math.hypot(d.x - x, d.z - z);
      if (dist < r * 0.6) { this.drop(d, 'gone'); d.g.visible = false; d.t = rand(30, 60); continue; }   // caught in it
      if (dist < r * 4) {                                                                            // startled: bark, and bolt if close
        setTimeout(() => sfx.bark(d.x, d.z, 0.8), rand(150, 600));
        if (dist < r * 2) { this.drop(d, 'run'); d.h = Math.atan2(d.x - x, d.z - z); d.t = rand(4, 7); }
      }
    }
    const m = this.mow;
    if (m && (m.state === 'mow' || m.state === 'walk')) {
      const dist = Math.hypot(m.x - x, m.z - z);
      if (dist < r * 0.6) { m.state = 'gone'; m.g.visible = false; m.t = rand(60, 90); this.engine(false); }
      else if (dist < r * 3) { m.state = 'flee'; m.h = Math.atan2(m.x - x, m.z - z); m.t = rand(4, 6); this.engine(false); }
    }
  }

  drop(d, state) {
    if (d.owner) d.owner.dog = null;
    d.owner = null; d.state = state; d.leash.visible = false;
  }

  engine(on) {
    const m = this.mow;
    if (on && !m.eng) m.eng = sfx.mowerLoop(m.x, m.z);
    if (m.eng) m.eng.set(on ? 0.5 : 0, on ? 0.6 : 0.25);
  }

  update(dt) {
    const T = G.camTarget, TH = G.terrainH, t = G.time;
    for (const d of this.dogs) {
      d.t -= dt;
      if (d.state === 'wait' || d.state === 'gone') {
        // (re)assign: start next to a walker, out of view if this is a dog coming back
        if (d.t > 0) continue;
        const o = this.findOwner(d.state === 'gone' ? T : null);
        if (!o) { d.t = rand(2, 5); continue; }
        d.owner = o; o.dog = d; d.state = 'walk';
        d.x = o.pos.x - Math.sin(o.heading) * 0.5; d.z = o.pos.z - Math.cos(o.heading) * 0.5; d.h = o.heading;
        d.g.visible = true; d.leash.visible = true;
        continue;
      }
      if (d.state === 'walk') {
        const o = d.owner;
        if (!o || o.hidden || o.dead || !(WALKING.has(o.state) || o.state === 'alert' || o.state === 'toCar')) {
          // the owner ran, went down, got in a car or vanished: the dog runs off on its own
          this.drop(d, 'run'); d.t = rand(4, 7); d.h += rand(-1, 1);
          if (Math.random() < 0.7) sfx.bark(d.x, d.z, 0.7);
        } else {
          // heel: a little behind and to the right of the owner
          const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
          const tx = o.pos.x - fx * 0.45 + fz * 0.22, tz = o.pos.z - fz * 0.45 - fx * 0.22;
          const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
          const want = dist > 0.08 ? Math.min(3.2, dist * 3.2) : 0;
          d.sp += (want - d.sp) * Math.min(1, dt * 6);
          if (dist > 0.08) { const a = Math.atan2(dx, dz); let df = a - d.h; df = Math.atan2(Math.sin(df), Math.cos(df)); d.h += df * Math.min(1, dt * 8); }
          d.x += Math.sin(d.h) * d.sp * dt; d.z += Math.cos(d.h) * d.sp * dt;
          if (dist > 4) { d.x = tx; d.z = tz; }                                       // never strung out across a block
          // now and then a bark, only when it's close enough to hear
          if ((d.barkT -= dt) <= 0) {
            d.barkT = rand(8, 22);
            if (T && Math.hypot(d.x - T.x, d.z - T.z) < 45 && sfx.bark(d.x, d.z, 0.55)) d.hop = 0.35;
          }
          // the leash from the owner's hand to the collar
          const a = d.leash.geometry.attributes.position, oy = (TH ? TH(o.pos.x, o.pos.z) : 0);
          a.setXYZ(0, o.pos.x + fz * 0.08 + fx * 0.05, oy + 0.4, o.pos.z - fx * 0.08 + fz * 0.05);
          a.setXYZ(1, d.x + Math.sin(d.h) * 0.11 * d.sc, (TH ? TH(d.x, d.z) : 0) + 0.15 * d.sc, d.z + Math.cos(d.h) * 0.11 * d.sc);
          a.needsUpdate = true;
        }
      } else if (d.state === 'run') {
        d.sp += (4 - d.sp) * Math.min(1, dt * 3);
        d.x += Math.sin(d.h) * d.sp * dt; d.z += Math.cos(d.h) * d.sp * dt;
        if (d.t <= 0) { d.state = 'gone'; d.g.visible = false; d.t = rand(25, 50); continue; }
      }
      // pose: trot by speed, tail wag, a little hop when it barks
      d.hop = Math.max(0, d.hop - dt);
      const trot = Math.min(1, d.sp / 1.5), cyc = t * (8 + d.sp * 3) + d.ph;
      d.legs.forEach((l, k) => { l.rotation.x = Math.sin(cyc + (k === 0 || k === 3 ? 0 : Math.PI)) * 0.7 * trot; });
      d.tail.rotation.y = Math.sin(t * (d.sp > 0.3 ? 14 : 6) + d.ph) * 0.5;
      d.head.rotation.x = d.hop > 0 ? -0.35 * Math.sin(d.hop * 18) : Math.sin(t * 1.3 + d.ph) * 0.06;
      d.g.position.set(d.x, (TH ? TH(d.x, d.z) : 0) + Math.abs(Math.sin(cyc)) * 0.015 * trot + Math.sin(d.hop * 9) * 0.04, d.z);
      d.g.quaternion.setFromAxisAngle(UP, d.h);
    }
    if (this.mow) this.updateMower(dt);
  }

  updateMower(dt) {
    const m = this.mow, L = m.lawn, t = G.time, day = (G.night || 0) < 0.45;
    m.t -= dt;
    if (m.state === 'gone') {
      if (m.t <= 0 && day) { m.state = 'mow'; m.g.visible = true; m.x = L.x0 + 0.5; m.z = L.z0 + 0.4; m.row = 0; m.dir = 1; }
      return;
    }
    if (m.state === 'flee') {
      m.x += Math.sin(m.h) * 3 * dt; m.z += Math.cos(m.h) * 3 * dt;
      m.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 14 + k * Math.PI) * 0.8; });
      m.g.position.set(m.x, 0, m.z); m.g.quaternion.setFromAxisAngle(UP, m.h); m.mower.visible = false;
      if (m.t <= 0) { m.state = 'gone'; m.g.visible = false; m.mower.visible = true; m.t = rand(50, 80); }
      return;
    }
    // mowing: a stripe across the lawn, then step over a row and come back; after dark they pack up
    if (!day) { this.engine(false); m.state = 'gone'; m.g.visible = false; m.t = 5; return; }
    this.engine(true);
    const speed = 0.55, xEnd = m.dir > 0 ? L.x1 - 0.5 : L.x0 + 0.5;
    m.x += m.dir * speed * dt;
    if ((m.dir > 0 && m.x >= xEnd) || (m.dir < 0 && m.x <= xEnd)) {
      m.x = xEnd; m.dir *= -1; m.row++;
      m.z = L.z0 + 0.4 + (m.row * 0.42) % Math.max(0.5, L.z1 - L.z0 - 0.8);                         // next stripe (wraps back to the start)
    }
    const h = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.g.position.set(m.x - Math.sin(h) * 0.18, 0, m.z);
    m.g.quaternion.setFromAxisAngle(UP, h);
    m.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 5.5 + k * Math.PI) * 0.45; });
    m.mower.position.y = Math.abs(Math.sin(t * 22)) * 0.004;                                     // the engine's buzz
    if (m.eng) m.eng.move(m.x, m.z);
  }
}

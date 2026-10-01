// FREE HAND: the default "weapon", which can't blow anything up. Hold over a person, a car or a loose object
// to pick it up; it rises a little and follows the cursor, swinging like a rag doll; let go while moving to throw
// it (the speed and direction of the drag), or let go when still to set it down. Buildings, fences, playground
// kit and other fixtures can't be picked up.
//   People and cars use the agents' own flight and landing physics once released (state 'air'); while held they
//   are in state 'held', which agents.js leaves alone apart from drawing them with their flailing air pose.
//   Loose props (bins, benches, dumpsters, beach umbrellas, junk) fly on a little simulation here.
import * as THREE from 'three';
import { G, rand, clamp } from './core.js';
import { sfx } from './audio.js';

const GRAB_PEDS = new Set(['walk', 'wander', 'wait', 'idle', 'return', 'alert', 'flee', 'down', 'riot', 'entering', 'air', 'job', 'toCar']);
const GRAB_CARS = new Set(['drive', 'parked', 'wreck', 'onscene', 'air']);
const GRAB_PROPS = new Set(['bin', 'bench', 'dumpster', 'umbrella', 'junk']);
const LIFT = { ped: 1.6, car: 2.0, prop: 1.5 };
const HANG = { ped: 0.55, car: 0.3, prop: 0.25 };          // how far the body hangs below the grip
const UP = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export class Hand {
  constructor(scene) {
    this.held = null; this.hover = null; this.flying = [];
    // a soft ring under whatever the hand would pick up, and a faint tether to what it's holding
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ff5d2, transparent: true, opacity: 0.85, depthTest: false }));
    this.ring.renderOrder = 11; this.ring.visible = false; scene.add(this.ring);
    const tg = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tether = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0x9ff5d2, transparent: true, opacity: 0.55, depthTest: false }));
    this.tether.frustumCulled = false; this.tether.renderOrder = 11; this.tether.visible = false; scene.add(this.tether);
  }

  // the nearest thing the hand could pick up at a point, or null
  pick(pt) {
    let best = null, bd = 1;
    const consider = (kind, o, x, z, r) => { const d = Math.hypot(x - pt.x, z - pt.z) / r; if (d < bd) { bd = d; best = { kind, o }; } };
    const A = G.agents;
    if (A) {
      for (const p of A.peds) if (GRAB_PEDS.has(p.state) && !p.hidden && !p.car) consider('ped', p, p.pos.x, p.pos.z, 0.55);
      for (const c of A.cars) if (GRAB_CARS.has(c.state)) consider('car', c, c.pos.x, c.pos.z, 1.05);
    }
    for (const p of (G.city && G.city.props) || []) if (p.alive && !p.flying && GRAB_PROPS.has(p.type)) consider('prop', p, p.x, p.z, p.type === 'dumpster' ? 0.75 : 0.5);
    return best;
  }

  pos(h) { return h.kind === 'prop' ? _v.set(h.o.x, h.o.y || 0, h.o.z) : h.o.pos; }

  grab(h) {
    const o = h.o;
    const p0 = this.pos(h);
    this.held = { ...h, vel: new THREE.Vector3(), grip: new THREE.Vector3(p0.x, p0.y + HANG[h.kind], p0.z), sway: new THREE.Vector2(), spin: rand(-0.6, 0.6) };
    if (h.kind === 'ped') {
      if (o.state !== 'air' && !o.dead) sfx.yelp(o.pos.x, o.pos.z);
      o.state = 'held'; o.target = null; o.group = null; o.zone = null;
      o.heading = o.heading || 0;
    } else if (h.kind === 'car') {
      o.wasState = o.state; o.state = 'held'; o.speed = 0; o.queue = [];
      if (o.obs) { const k = G.city.obstacles.indexOf(o.obs); if (k >= 0) G.city.obstacles.splice(k, 1); o.obs = null; }
      if (o.siren) { o.siren.stop(); o.siren = null; }
    } else {
      o.held = true; o.y = o.y || 0;
    }
  }

  release() {
    const h = this.held; this.held = null;
    if (!h) return;
    const o = h.o, v = h.vel, sp = Math.hypot(v.x, v.z);
    const dir = sp > 0.01 ? { x: v.x / sp, z: v.z / sp } : { x: 0, z: 1 };
    const f = clamp(sp * 1.1, 0, 28), up = clamp(v.y * 0.9 + sp * 0.12, -4, 16);
    if (h.kind === 'prop') {
      o.held = false; o.flying = true;
      this.flying.push({ p: o, vel: new THREE.Vector3(dir.x * f, up, dir.z * f), w: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(2 + sp * 0.5), q: (o.q || new THREE.Quaternion().setFromAxisAngle(UP, o.rot)).clone() });
      return;
    }
    const isCar = h.kind === 'car';
    if (isCar) o.gentle = sp < 2.5 && (o.wasState !== 'wreck');           // set down softly: it stays a working car
    else if (sp > 18 && !o.dead) { o.dead = true; o.bleed = true; }      // flung hard enough, that's the end of them
    G.agents.launch(o, dir, f, up, isCar, Math.min(9, 1 + sp * 0.45));
    o.q.copy(h.q || o.q);                                                 // keep the pose it had in the hand
  }

  // dt; aim = the cursor's point in the world; down = button / finger held; active = Free Hand is selected
  update(dt, aim, down, active) {
    // things thrown earlier fly on regardless of what's selected
    this.updateFlying(dt);
    if (!active) { if (this.held) this.release(); this.ring.visible = this.tether.visible = false; this.cursor(''); return; }
    if (this.held && (!down || !aim)) { this.release(); }
    if (!this.held) {
      this.hover = aim ? this.pick(aim.point) : null;
      if (this.hover && down && this.pressed) this.grab(this.hover);
    }
    this.pressed = false;
    // the hover ring
    const h = this.held || this.hover;
    if (h && !this.held) {
      const p = this.pos(h), r = h.kind === 'car' ? 2 : h.kind === 'prop' && h.o.type === 'dumpster' ? 1.5 : 1;
      this.ring.visible = true; this.ring.position.set(p.x, (G.terrainH ? G.terrainH(p.x, p.z) : 0) + 0.04, p.z); this.ring.scale.setScalar(r);
    } else this.ring.visible = false;
    this.cursor(this.held ? 'grabbing' : this.hover ? 'grab' : '');
    if (!this.held) { this.tether.visible = false; return; }
    // carrying: rise above the cursor point and follow it with a little lag; measure the motion for the throw
    const H = this.held, o = H.o, cur = H.grip;                         // the grip point follows the cursor; the body hangs from it
    const ground = aim.point.y, tx = aim.point.x, tz = aim.point.z, ty = ground + LIFT[H.kind];
    const k = 1 - Math.exp(-dt * 11);
    const nx = cur.x + (tx - cur.x) * k, ny = cur.y + (ty - cur.y) * k, nz = cur.z + (tz - cur.z) * k;
    _v.set(nx - cur.x, ny - cur.y, nz - cur.z).divideScalar(Math.max(dt, 1e-3));
    cur.set(nx, ny, nz);
    H.vel.lerp(_v, 1 - Math.exp(-dt * 10));
    // swing: hang back against the motion like a rag doll on a string, with a slow twist
    H.sway.x += ((clamp(-H.vel.z * 0.08, -1.1, 1.1)) - H.sway.x) * Math.min(1, dt * 6);
    H.sway.y += ((clamp(H.vel.x * 0.08, -1.1, 1.1)) - H.sway.y) * Math.min(1, dt * 6);
    H.spin += dt * 0.4;
    const heading = o.heading || o.rot || 0, wob = Math.sin(G.time * 3.1) * 0.12;
    _q.setFromEuler(_e.set(H.sway.x + wob, heading + H.spin, H.sway.y + wob * 0.6, 'XYZ'));
    if (H.kind === 'ped') {
      o.pos.set(nx, ny - HANG.ped, nz);                                 // held by the shoulders: the body hangs below the grip
      o.q.copy(_q); H.q = o.q.clone();
    } else if (H.kind === 'car') {
      o.pos.set(nx, ny - HANG.car, nz); o.q.copy(_q); H.q = o.q.clone();
    } else {
      o.x = nx; o.y = ny - HANG.prop; o.z = nz;
      _q2.copy(_q); o.q = _q2.clone();
      this.writeProp(o, o.q);
    }
    // the tether from the cursor's spot on the ground up to the grip
    const a = this.tether.geometry.attributes.position;
    a.setXYZ(0, tx, ground + 0.05, tz); a.setXYZ(1, nx, ny + 0.2, nz); a.needsUpdate = true;
    this.tether.visible = true;
  }

  writeProp(p, q) {
    _m.compose(_s.set(p.x, p.y || 0, p.z), q, _v.set(p.sx || p.s, p.sy || p.s, p.sz || p.s));
    p.mesh.setMatrixAt(p.i, _m); p.mesh.instanceMatrix.needsUpdate = true;
  }

  updateFlying(dt) {
    const B = G.buildings;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i], p = f.p;
      if (!p.alive) { this.flying.splice(i, 1); continue; }
      f.vel.y -= 14 * dt;
      p.x += f.vel.x * dt; p.y = (p.y || 0) + f.vel.y * dt; p.z += f.vel.z * dt;
      if (B.inside(_v.set(p.x, p.y + 0.2, p.z))) { p.x -= f.vel.x * dt; p.z -= f.vel.z * dt; f.vel.x *= -0.3; f.vel.z *= -0.3; }
      const wl = f.w.length(); if (wl > 0.01) f.q.premultiply(_q.setFromAxisAngle(_v.copy(f.w).divideScalar(wl), wl * dt));
      const floor = B.surfaceAt(p.x, p.z, p.y + 0.2).y;
      if (p.y <= floor) {
        p.y = floor;
        if (f.vel.y < -3) { f.vel.y *= -0.3; f.vel.x *= 0.55; f.vel.z *= 0.55; f.w.multiplyScalar(0.5); sfx.crumble(p.x, p.z, 0.35); G.fx.dust(p.x, p.y, p.z, 0.3); }
        else {
          // settled: upright where it came down, facing however it landed
          const fwd = _v.set(0, 0, 1).applyQuaternion(f.q);
          p.rot = Math.atan2(fwd.x, fwd.z); p.q = null; p.flying = false;
          this.writeProp(p, _q.setFromAxisAngle(UP, p.rot));
          this.flying.splice(i, 1);
          continue;
        }
      }
      this.writeProp(p, f.q);
    }
  }

  cursor(c) {
    if (c === this.cur) return;
    this.cur = c;
    const el = G.renderer && G.renderer.domElement;
    if (el) el.style.cursor = c || '';
  }
}

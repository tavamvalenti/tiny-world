// A ground vehicle for the mini-games: an arcade sports car (the highway cut-up) or a snowmobile (the Greenland
// course). One controller for both: throttle, brake / reverse, steering that tightens up at speed, grip that lets
// the back slide a little, a handbrake, a boost, and real airtime (gravity, take-off off a crest or a ramp, in-air
// lean, landings judged against the slope underneath). The ground comes from the activity (groundAt), so a course
// can add its own ramps on top of the map's terrain.
import * as THREE from 'three';
import { G, clamp } from '../core.js';
import { EngineSynth } from '../vehicles.js';

const UP = new THREE.Vector3(0, 1, 0);

export const RIDES = {
  car: { vmax: 34, boostMax: 44, accel: 15, boostAccel: 26, brake: 32, grip: 9, turn: 2.1, turnFall: 22, halfW: 0.33, halfL: 0.76, gravity: 22, lean: 0 },
  sled: { vmax: 27, boostMax: 33, accel: 13, boostAccel: 20, brake: 22, grip: 5.5, turn: 2.3, turnFall: 18, halfW: 0.3, halfL: 0.62, gravity: 16, lean: 1.0 },
};

export class Ride {
  // groundAt(x, z) -> height; opts: { kind, paint }
  constructor(scene, groundAt, opts = {}) {
    this.scene = scene; this.groundAt = groundAt;
    this.kind = opts.kind || 'car'; this.P = { ...RIDES[this.kind], ...(opts.tune || {}) };
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.v = 0; this.vx = 0; this.vy = 0; this.air = false; this.airT = 0;
    this.pitch = 0; this.roll = 0; this.lean = 0; this.spin = 0; this.boost = 1;
    this.model = this.kind === 'sled' ? buildSled(opts.paint) : buildCar(opts.paint);
    scene.add(this.model.root);
    this.engine = new EngineSynth(this.kind === 'sled' ? 'sled' : 'car'); this.engine.start();
  }
  place(x, z, yaw, speed = 0) {
    this.pos.set(x, this.groundAt(x, z), z); this.yaw = yaw; this.v = speed; this.vx = 0; this.vy = 0; this.air = false; this.airT = 0; this.spin = 0; this.pitch = 0; this.roll = 0;
    this.vel.set(-Math.sin(yaw) * speed, 0, -Math.cos(yaw) * speed);
    this.sync(0);
  }
  get fwd() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  // controls: { throttle 0..1, brake 0..1, steer -1..1 (right +), hand, boost, leanFwd -1..1 }; returns landing info or null
  update(dt, c) {
    const P = this.P;
    let landed = null;
    // boost: a tank that drains while used and refills slowly (the activity can top it up)
    const boosting = c.boost && this.boost > 0.02 && this.v > 4 && !this.air;
    if (boosting) this.boost = Math.max(0, this.boost - dt * 0.28); else this.boost = Math.min(1, this.boost + dt * (this.refill ?? 0.04));
    this.boosting = boosting;
    const vmax = boosting ? P.boostMax : P.vmax;
    if (this.spin !== 0) {
      // spun out after a crash: the wheels lock, it slides and turns until it stops
      this.yaw += this.spin * dt; this.spin *= Math.exp(-dt * 2.2); if (Math.abs(this.spin) < 0.15) this.spin = 0;
      this.v *= Math.exp(-dt * 2.6); this.vx *= Math.exp(-dt * 2);
    } else if (!this.air) {
      // engine and brakes
      if (c.throttle > 0 && this.v < -0.5) this.v = Math.min(0, this.v + P.brake * c.throttle * dt);        // rolling back: throttle brakes first
      else if (c.throttle > 0) this.v += c.throttle * (boosting ? P.boostAccel : P.accel) * clamp(1 - this.v / vmax, 0, 1) * dt;
      if (c.brake > 0) { if (this.v > 0.5) this.v -= P.brake * c.brake * dt; else if (!c.hold) this.v = Math.max(-7, this.v - 9 * c.brake * dt); else this.v = 0; }
      if (!c.throttle && !c.brake) this.v *= Math.exp(-dt * 0.22);
      if (this.v > vmax) this.v += (vmax - this.v) * (1 - Math.exp(-dt * 1.5));
      // steering: quick at low speed, steadier at high speed; the handbrake swings the back round
      const sv = clamp(Math.abs(this.v) / 3, 0, 1) * Math.sign(this.v || 1);
      const rate = P.turn / (1 + Math.abs(this.v) / P.turnFall) * (c.hand ? 1.6 : 1);
      const dyaw = -c.steer * rate * sv * dt;
      this.yaw += dyaw;
      // the car keeps some of its old heading as sideways slip (more with the handbrake), which grip takes away
      this.vx += -dyaw * this.v * (c.hand ? 0.9 : 0.35);
      this.vx *= Math.exp(-dt * (c.hand ? 1.4 : P.grip));
      if (c.hand) this.v *= Math.exp(-dt * 0.5);
    } else {
      // in the air: no grip, a little steering (for style), lean back / forward with the throttle keys
      this.yaw += -c.steer * 0.9 * dt;
      this.lean = clamp(this.lean + (c.leanFwd || 0) * P.lean * dt, -0.8, 0.8);
    }
    // world velocity on the ground plane
    const f = this.fwd, r = this.right;
    this.vel.set(f.x * this.v + r.x * this.vx, this.vel.y, f.z * this.v + r.z * this.vx);
    const x0 = this.pos.x, z0 = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // vertical: follow the ground, or fly
    const g = this.groundAt(this.pos.x, this.pos.z);
    if (!this.air) {
      const g0 = this.groundAt(x0, z0), slopeV = (g - g0) / Math.max(dt, 1e-4);
      // over a crest or off a ramp's lip the ground falls away faster than gravity can pull the vehicle down
      const fall = this.vy - P.gravity * dt;
      if (g < this.pos.y + fall * dt - 0.04 && this.speed > 6) { this.air = true; this.airT = 0; this.vy = Math.max(this.vy, 0); this.takeoff = this.pos.clone(); this.lean = 0; this.pos.y += this.vy * dt; }
      else { this.pos.y = g; this.vy = clamp(slopeV, -30, 30); }
    }
    if (this.air) {
      this.airT += dt;
      this.vy -= P.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= g) {
        // touch down: judge the landing by how the vehicle meets the slope (its pitch against the ground's)
        const ah = this.pos.clone().addScaledVector(f, 0.7), n = this.normalAt(ah.x, ah.z), slopePitch = Math.atan2(-(n.x * f.x + n.z * f.z), n.y);
        const err = Math.abs(this.pitch - slopePitch) + Math.abs(this.roll) * 0.5, impact = Math.max(0, -this.vy);
        landed = { airT: this.airT, from: this.takeoff, to: this.pos.clone(), err, impact };
        this.pos.y = g; this.air = false;
        // a bad landing scrubs speed; a clean one keeps it
        this.v *= clamp(1 - err * 0.45 - Math.max(0, impact - 12) * 0.02, 0.35, 1);
        this.vy = 0; this.lean = 0;
      }
    }
    this.vel.y = this.air ? this.vy : 0;
    this.sync(dt);
    // engine voice: rpm through five gears
    const sp = Math.abs(this.v) / P.boostMax, gear = sp * 5, frac = gear % 1;
    this.engine.set(0.5 + clamp(c.throttle, 0, 1) * 0.5, clamp(0.12 + frac * 0.5 + sp * 0.35 + (this.air ? 0.25 : 0), 0, 1));
    return landed;
  }
  normalAt(x, z) {
    const e = 0.4, h = this.groundAt;
    return new THREE.Vector3(h(x - e, z) - h(x + e, z), 2 * e, h(x, z - e) - h(x, z + e)).normalize();
  }
  // pose the model: pitched and rolled to the ground (or to the lean in the air), wheels / track turning
  sync(dt) {
    const M = this.model, f = this.fwd;
    if (!this.air) {
      const n = this.normalAt(this.pos.x, this.pos.z), r = this.right;
      const tp = Math.atan2(-(n.x * f.x + n.z * f.z), n.y), tr = Math.atan2(n.x * r.x + n.z * r.z, n.y);
      this.pitch += (tp - this.pitch) * (1 - Math.exp(-dt * 14)); this.roll += (tr - this.roll) * (1 - Math.exp(-dt * 14));
    } else {
      // in the air the nose follows the flight path, plus the rider's lean
      const path = Math.atan2(this.vy, Math.max(4, this.speed)) * 0.6 - this.lean * 0.5;
      this.pitch += (path - this.pitch) * (1 - Math.exp(-dt * 3)); this.roll *= Math.exp(-dt * 2);
    }
    M.root.position.copy(this.pos);
    M.root.rotation.set(0, 0, 0); M.root.rotateY(this.yaw); M.root.rotateX(this.pitch); M.root.rotateZ(-this.roll);
    M.update(dt, this);
  }
  dispose() {
    this.scene.remove(this.model.root);
    this.model.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    this.engine.stop();
  }
}

// ---------------------------------------------------------------- models
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, ...o });
function addBox(p, w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; }

// a low wedge sports car, a little bigger than the traffic so it reads, its nose to -z
function buildCar(paint = 0xff5a1f) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const pm = mat(paint, { roughness: 0.25, metalness: 0.55 }), dark = mat(0x16181c, { roughness: 0.6 }), glass = mat(0x0c1218, { roughness: 0.05, metalness: 0.9 });
  const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2) }), tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.15, 0.1) });
  addBox(body, 0.66, 0.2, 1.52, pm, 0, 0.2, 0);                  // the tub
  addBox(body, 0.62, 0.1, 0.5, pm, 0, 0.32, -0.46).rotation.x = 0.12;   // bonnet sloping to the nose
  addBox(body, 0.56, 0.17, 0.62, glass, 0, 0.38, 0.06);          // canopy
  addBox(body, 0.5, 0.05, 0.42, pm, 0, 0.47, 0.1);               // roof
  addBox(body, 0.66, 0.04, 0.12, dark, 0, 0.42, 0.72);           // wing
  addBox(body, 0.04, 0.12, 0.08, dark, 0.26, 0.35, 0.72); addBox(body, 0.04, 0.12, 0.08, dark, -0.26, 0.35, 0.72);
  addBox(body, 0.12, 0.04, 0.02, lit, 0.22, 0.24, -0.77); addBox(body, 0.12, 0.04, 0.02, lit, -0.22, 0.24, -0.77);
  addBox(body, 0.18, 0.04, 0.02, tail, 0.2, 0.26, 0.77); addBox(body, 0.18, 0.04, 0.02, tail, -0.2, 0.26, 0.77);
  addBox(body, 0.68, 0.06, 1.2, dark, 0, 0.1, 0);                // skirts
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 12).rotateZ(Math.PI / 2), wm = mat(0x111214, { roughness: 0.8 });
  for (const [x, z] of [[0.31, -0.5], [-0.31, -0.5], [0.31, 0.5], [-0.31, 0.5]]) { const w = new THREE.Mesh(wg, wm); w.position.set(x, 0.13, z); w.castShadow = true; root.add(w); wheels.push(w); }
  // boost flames out of the exhausts
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.4, 0.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flames = [flame, flame.clone()]; flames[0].position.set(0.12, 0.16, 0.95); flames[1].position.set(-0.12, 0.16, 0.95); for (const fl of flames) root.add(fl);
  let roll = 0;
  return {
    root, body,
    update(dt, R) {
      roll += R.v * dt / 0.13; for (const w of wheels) w.rotation.x = -roll;
      wheels[0].rotation.y = wheels[1].rotation.y = 0;
      body.rotation.z = clamp(-R.vx * 0.04, -0.12, 0.12);       // body roll in a slide
      for (const fl of flames) { fl.visible = !!R.boosting; fl.scale.set(1, 1, 0.7 + Math.random() * 0.6); }
    },
  };
}

// a snowmobile: skis in front, a track behind, a rider in a red suit leaning into it
function buildSled(paint = 0xd8202a) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const pm = mat(paint, { roughness: 0.35, metalness: 0.35 }), dark = mat(0x1a1b1f, { roughness: 0.7 }), chrome = mat(0xb8bcc2, { metalness: 0.9, roughness: 0.25 });
  const suit = mat(0x1d3a7a, { roughness: 0.8 }), skin = mat(0xe0b090, { roughness: 0.8 }), helm = mat(0xf2f2ee, { roughness: 0.3 });
  addBox(body, 0.42, 0.16, 0.9, pm, 0, 0.26, -0.05);            // hood and body
  addBox(body, 0.36, 0.12, 0.34, pm, 0, 0.36, -0.36).rotation.x = 0.35;
  addBox(body, 0.3, 0.12, 0.05, mat(0x88aacc, { transparent: true, opacity: 0.55, roughness: 0.05 }), 0, 0.46, -0.24).rotation.x = -0.5;   // windscreen
  addBox(body, 0.3, 0.1, 0.5, dark, 0, 0.38, 0.28);              // seat
  addBox(body, 0.36, 0.14, 0.86, dark, 0, 0.1, 0.28);            // track housing
  const track = addBox(body, 0.3, 0.1, 0.8, mat(0x0c0c0e, { roughness: 0.9 }), 0, 0.05, 0.3);
  for (const x of [0.2, -0.2]) { addBox(root, 0.05, 0.03, 0.62, chrome, x, 0.02, -0.42); addBox(root, 0.03, 0.18, 0.03, chrome, x, 0.1, -0.42); const tip = addBox(root, 0.05, 0.03, 0.14, chrome, x, 0.06, -0.76); tip.rotation.x = -0.6; }
  addBox(body, 0.5, 0.025, 0.025, chrome, 0, 0.56, -0.12);       // handlebar
  const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2) }); addBox(body, 0.14, 0.05, 0.02, lit, 0, 0.32, -0.52);
  // the rider
  const rider = new THREE.Group(); rider.position.set(0, 0.42, 0.18); body.add(rider);
  addBox(rider, 0.22, 0.28, 0.16, suit, 0, 0.2, 0).rotation.x = -0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), helm); head.position.set(0, 0.42, -0.08); head.castShadow = true; rider.add(head);
  addBox(rider, 0.16, 0.05, 0.03, mat(0x111111, { roughness: 0.1, metalness: 0.8 }), 0, 0.42, -0.17);
  for (const x of [0.12, -0.12]) { const arm = addBox(rider, 0.06, 0.06, 0.28, suit, x, 0.22, -0.16); arm.rotation.x = 0.4; addBox(rider, 0.07, 0.2, 0.08, suit, x * 0.9, -0.02, 0.02); }
  addBox(rider, 0.04, 0.04, 0.04, skin, 0, 0.32, -0.12);
  const spray = [];
  return {
    root, body,
    update(dt, R) {
      track.position.z = 0.3 + ((performance.now() * 0.001 * R.v) % 0.05);
      rider.rotation.x = -0.15 - R.lean * 0.35 + (R.air ? -0.1 : 0);
      rider.rotation.z = clamp(R.vx * 0.05, -0.3, 0.3);
      body.rotation.z = clamp(-R.vx * 0.05, -0.15, 0.15);
      // a spray of snow off the track at speed
      if (!R.air && R.speed > 8 && G.fx && Math.random() < 0.5) { const b = R.pos.clone().addScaledVector(R.fwd, -0.7); G.fx.smokePuff(b.x, b.y + 0.1, b.z, 0.25, 0.95, 0.8); }
      void spray;
    },
  };
}

// the chase camera: right behind, steadied (the yaw is smoothed, the position isn't, so it never lags at speed)
export class ChaseCam {
  constructor(camera) { this.camera = camera; this.yaw = null; this.fov = 64; this.dist = 4.6; this.h = 1.45; this.shake = 0; this.zoom = 1; }
  update(dt, ride, post, scene) {
    const cam = this.camera;
    if (this.yaw == null) this.yaw = ride.yaw;
    let d = ride.yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * (1 - Math.exp(-dt * 5));
    const sp = ride.speed, dist = (this.dist + sp * 0.03) * this.zoom;
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const want = ride.pos.clone().addScaledVector(back, dist); want.y = ride.pos.y + this.h * this.zoom + (ride.air ? 0.4 : 0);
    const gy = ride.groundAt(want.x, want.z); if (want.y < gy + 0.4) want.y = gy + 0.4;
    cam.position.copy(want);
    cam.up.copy(UP); cam.lookAt(ride.pos.x - back.x * 6, ride.pos.y + 0.55, ride.pos.z - back.z * 6);
    this.shake = Math.max(0, this.shake - dt * 2);
    if (this.shake > 0) { const s = this.shake * this.shake * 0.025, t = performance.now() * 0.04; cam.rotateX(Math.sin(t) * s); cam.rotateY(Math.sin(t * 1.3) * s); }
    const fov = 62 + clamp(sp / 40, 0, 1) * 16 + (ride.boosting ? 6 : 0);
    this.fov += (fov - this.fov) * (1 - Math.exp(-dt * 3));
    cam.fov = this.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    if (post) { post.maxBlur = 0; post.band = 1; }
    if (scene && scene.fog) { scene.fog.near = 70; scene.fog.far = 320; }
  }
}

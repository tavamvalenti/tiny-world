// LAS VEGAS — HIGHWAY TRAFFIC CUT-UP. A sports car on the northbound side of I-15 (four lanes, the existing highway
// traffic), weaving through it as fast as you dare.
//   - near misses: when you pass a car, how close you came alongside it (the gap between the two bodies, from their
//     real positions and sizes) and how much faster you were going decide the points; each car pays once per pass;
//   - combos: near misses within 3.5 s of each other build a combo; the points go into a pot that's multiplied up
//     and banked when the combo runs out. A collision loses the pot;
//   - speed and distance pay steadily; every 500 m without touching anything pays a clean-run bonus;
//   - 90-second score attack (a crash spins you out, then you carry on) or endless survival (a serious crash ends it).
// The traffic is Las Vegas' own I-15 traffic (js/vegas.js highway()); while a run is on, the cars near you keep their
// distance from the car in front (and from you), so lanes behave; their own speeds are put back afterwards.
import * as THREE from 'three';
import { G, clamp, rand } from '../core.js';
import { sfx } from '../audio.js';
import { Ride, ChaseCam } from './drive.js';

export const TRAFFIC_CFG = {
  I15: -102, lanes: [1.6, 3.4, 5.2, 7],           // northbound lane centres, east of the median
  density90: 0.8, densityStart: 0.55, densityMax: 1, densityPerKm: 0.05,
  near: 0.8,                                     // a pass this close (world units, ~1.9 m) is a near miss
  minSpeed: 16, minRel: 3.5,                     // ... at speed, and actually overtaking
  comboTime: 3.5, crash: 9,                      // closing speed (u/s) that counts as a serious crash
  wrapAt: -1100, wrapBy: 2240,                   // the far end: you (and the traffic round you) loop back south
};
const M = 2.33;                                  // metres per world unit
const CAR = { hw: 0.31, hl: 0.7 }, TRUCK = { hw: 0.37, hl: 2.24 };

export class TrafficCutUp {
  constructor(hub, def) { this.hub = hub; this.def = def; this.disposables = []; }
  start(mode) {
    const H = G.vegas && G.vegas.hw, C = TRAFFIC_CFG;
    if (!H) { this.hub.exit(); return; }
    this.mode = mode; this.H = H;
    // the cars on I-15 (both directions), with their own speeds kept to put back later
    this.cars = H.cars.filter((c) => Math.abs(c.L.x - C.I15) < 9);
    for (const c of this.cars) { c.v0 ??= c.v; c.off = false; }
    this.north = this.cars.filter((c) => c.L.dir < 0);
    this.density = mode === 'endless' ? C.densityStart : C.density90;
    this.applyDensity(true);
    // a jersey barrier down the median and a guardrail on the right, for the run
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.8 }), rail = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 2500), mat); bar.position.set(C.I15, 0.16, 0); bar.receiveShadow = true;
    const gr = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 2500), rail); gr.position.set(C.I15 + 8.25, 0.28, 0);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), rail, 640); for (let i = 0; i < 640; i++) posts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(C.I15 + 8.25, 0.15, -1250 + i * 3.9));
    for (const m of [bar, gr, posts]) { G.scene.add(m); this.disposables.push(m); }
    // the car, on the inside lane south of the Strip, stopped; the cars right round it are cleared
    this.ride = new Ride(G.scene, () => 0, { kind: 'car', paint: (G.progress && G.progress.equipped('car_paint')) ?? 0xff5a1f, flame: G.progress && G.progress.equipped('car_flame') });
    const x0 = C.I15 + C.lanes[1], z0 = 230;
    for (const c of this.north) if (Math.abs(c.z - z0) < 45) c.z = z0 - 45 - Math.random() * 60;
    this.ride.place(x0, z0, 0, 0); this.ride.refill = 0.02;
    this.chase = new ChaseCam(G.camera);
    // the run's numbers
    Object.assign(this, { t: 0, go: -3.2, score: 0, pot: 0, combo: 0, comboT: 0, bestCombo: 0, nearMisses: 0, dist: 0, clean: 0, bestClean: 0, cleanPaid: 0, topSpeed: 0, speedSum: 0, collisions: 0, crashes: 0, ghost: 0, over: false, recoverT: 0, lastNear: null, splits: 0 });
    this.track = new Map();                       // car -> { ahead, minGap, near }
    this.buildHud();
    this.hub.count('3'); this.lastCount = 3;
  }
  // traffic density: switch off a share of the I-15 cars (the ones out of sight first when it rises mid-run)
  applyDensity(init) {
    const want = this.density;
    if (init) { for (const c of this.cars) c.off = Math.random() > want; return; }
    const pz = this.ride.pos.z;
    for (const c of this.cars) if (c.off && Math.abs(c.z - pz) > 300 && Math.random() < 0.02 * (want - this.liveShare())) c.off = false;
  }
  liveShare() { let n = 0; for (const c of this.cars) if (!c.off) n++; return n / this.cars.length; }

  buildHud() {
    const el = this.hub.gameEl;
    el.innerHTML = `<style>
      .tc-top{position:absolute;left:50%;top:calc(4.2vh + 64px);transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7)}
      .tc-score{font:900 34px Inter;letter-spacing:.02em}
      .tc-sub{font:800 11px Inter;letter-spacing:.26em;color:#7ff0c8;margin-top:2px}
      .tc-sub.warn{color:#ff8a6a}
      .tc-combo{position:absolute;left:50%;top:calc(4.2vh + 136px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px;opacity:0;transition:opacity .2s}
      .tc-combo.on{opacity:1}
      .tc-combo b{font:900 22px Inter;color:#ffd46b;text-shadow:0 0 14px rgba(255,180,60,.8)}
      .tc-combo span{font:800 10px Inter;letter-spacing:.2em;color:#fff;text-shadow:0 1px 3px #000}
      .tc-combo i{display:block;width:120px;height:4px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden}
      .tc-combo i em{display:block;height:100%;background:linear-gradient(90deg,#ffd46b,#ff7a3a)}
      .tc-spd{position:absolute;left:50%;bottom:calc(4.2vh + 16px);transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.8)}
      .tc-spd b{font:900 40px Inter;font-variant-numeric:tabular-nums} .tc-spd small{font:800 10px Inter;letter-spacing:.24em;margin-left:4px;color:rgba(255,255,255,.7)}
      .tc-boost{width:170px;height:6px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden;margin:4px auto 0}
      .tc-boost em{display:block;height:100%;background:linear-gradient(90deg,#3ab0ff,#7ff0ff)}
      .tc-boost.on em{background:linear-gradient(90deg,#ffb34a,#ff5a3c)}
      .tc-blabel{font:800 8.5px Inter;letter-spacing:.24em;color:rgba(200,240,255,.7);margin-top:3px}
    </style>
    <div class="tc-top"><div class="tc-score">0</div><div class="tc-sub"></div></div>
    <div class="tc-combo"><b>x1</b><span></span><i><em></em></i></div>
    <div class="tc-spd"><b>0</b><small>KM/H</small><div class="tc-boost"><em></em></div><div class="tc-blabel">BOOST · SHIFT</div></div>`;
    this.el = { score: el.querySelector('.tc-score'), sub: el.querySelector('.tc-sub'), combo: el.querySelector('.tc-combo'), mult: el.querySelector('.tc-combo b'), pot: el.querySelector('.tc-combo span'), cbar: el.querySelector('.tc-combo i em'), spd: el.querySelector('.tc-spd b'), boost: el.querySelector('.tc-boost'), bbar: el.querySelector('.tc-boost em') };
  }
  get mult() { return 1 + 0.5 * Math.min(this.combo, 18); }

  key(e, down) {
    (this.keys ||= {})[e.code] = down;
    if (down && e.code === 'KeyV') this.chase.zoom = this.chase.zoom > 1.1 ? 0.8 : this.chase.zoom < 0.9 ? 1 : 1.3;
    return true;
  }
  wheel(e) { this.chase.zoom = clamp(this.chase.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.7, 1.8); }
  where() { return this.ride ? this.ride.pos : null; }

  update(dt) {
    if (!this.ride) return;
    const k = this.keys || {}, R = this.ride, C = TRAFFIC_CFG;
    // the countdown: you can rev, not roll
    if (this.go < 0) {
      this.go += dt;
      const n = Math.ceil(-this.go); if (n < this.lastCount && n > 0) { this.hub.count(String(n)); this.lastCount = n; }
      if (this.go >= 0) { this.hub.count('GO'); sfx.horn && sfx.horn(R.pos.x, R.pos.z, 0.3); }
      R.update(dt, { throttle: 0, brake: 1, hold: true, steer: 0 });
      R.engine.set(0.6, (k.KeyW || k.ArrowUp) ? 0.7 : 0.15);
      this.traffic(dt); this.hudUpdate();
      return;
    }
    if (this.over) { R.update(dt, { throttle: 0, brake: 0.4, steer: 0 }); this.traffic(dt); return; }
    this.t += dt;
    const ctl = this.recoverT > 0 ? { throttle: 0, brake: 0, steer: 0 } : {
      throttle: k.KeyW || k.ArrowUp ? 1 : 0, brake: k.KeyS || k.ArrowDown ? 1 : 0,
      steer: (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), hand: !!k.Space, boost: !!(k.ShiftLeft || k.ShiftRight),
    };
    const z0 = R.pos.z;
    R.update(dt, ctl);
    this.walls(dt);
    // distance north along the highway (going the wrong way doesn't count)
    const dz = Math.max(0, z0 - R.pos.z); this.dist += dz; this.clean += dz;
    const sp = R.speed; this.topSpeed = Math.max(this.topSpeed, sp); this.speedSum += sp * dt;
    // steady pay: distance and speed
    this.score += dz * 0.5 + Math.max(0, sp - 24) * 4 * dt;
    // the clean-run bonus every 500 m without touching anything
    if (this.clean * M - this.cleanPaid >= 500) { this.cleanPaid += 500; this.score += 500; this.hub.pop(`CLEAN ${Math.round(this.cleanPaid)} M  +500`, 'rgba(120,255,200,.9)'); }
    this.bestClean = Math.max(this.bestClean, this.clean * M);
    // the combo clock
    if (this.combo > 0) { this.comboT -= dt; if (this.comboT <= 0) this.bank(); }
    // recovering after a spin-out (score attack): back in a lane, rolling, untouchable for a moment
    if (this.recoverT > 0) { this.recoverT -= dt; if (this.recoverT <= 0) this.recover(); }
    this.ghost = Math.max(0, this.ghost - dt);
    R.model.root.visible = this.ghost > 0 ? Math.floor(this.ghost * 12) % 2 === 0 : true;
    this.traffic(dt);
    if (!this.over && this.ghost <= 0 && this.recoverT <= 0) this.contacts(dt);
    // endless: the traffic gets thicker as you go
    if (this.mode === 'endless') { this.density = Math.min(C.densityMax, C.densityStart + (this.dist * M / 1000) * C.densityPerKm); this.applyDensity(false); }
    // the far end of the highway: loop back south, the traffic round you coming too
    if (R.pos.z < C.wrapAt) this.wrap();
    if (this.mode === 'score90' && this.t >= 90) this.end('time');
    this.hudUpdate();
  }
  // the median barrier and the guardrail: slide along them; hitting them hard counts as a collision
  walls() {
    const R = this.ride, C = TRAFFIC_CFG, lo = C.I15 + 0.17 + R.P.halfW + 0.02, hi = C.I15 + 8.22 - R.P.halfW;
    const side = R.pos.x < lo ? 1 : R.pos.x > hi ? -1 : 0; if (!side) return;
    R.pos.x = side > 0 ? lo : hi;
    const into = -side * R.vel.x;                   // sideways speed into the wall
    const yawOff = Math.atan2(Math.sin(R.yaw), Math.cos(R.yaw));
    R.yaw -= yawOff * 0.5; R.vx = 0;
    if (G.fx && R.speed > 5) G.fx.sparks(R.pos.x - side * R.P.halfW, 0.2, R.pos.z, 4, 2.4, 1.8, 0.8, 4);
    if (into > 3 && this.ghost <= 0 && this.go >= 0) this.hit(into, null, R.pos.clone());
  }
  // the traffic: lanes keep their spacing near you (followers slow for the car ahead and for you); none drive through you
  traffic(dt) {
    const R = this.ride, pz = R.pos.z, lanes = new Map();
    for (const c of this.cars) {
      c.v = c.v0;
      if (c.off || Math.abs(c.z - pz) > 220) continue;
      let l = lanes.get(c.L); if (!l) lanes.set(c.L, (l = [])); l.push(c);
    }
    const P = { player: true, z: pz, x: R.pos.x, v: Math.max(0, -R.vel.z), hl: R.P.halfL, hw: R.P.halfW };
    for (const [L, list] of lanes) {
      // the player counts as a car in the lane they overlap
      if (L.dir < 0 && Math.abs(L.x - P.x) < 0.31 + P.hw + 0.1) list.push(P);
      if (L.dir < 0) list.sort((a, b) => a.z - b.z); else list.sort((a, b) => b.z - a.z);
      for (let i = 1; i < list.length; i++) {
        const lead = list[i - 1], c = list[i]; if (c.player) continue;
        const hl = (o) => (o.player ? o.hl : o.truck ? TRUCK.hl : CAR.hl);
        const gap = Math.abs(c.z - lead.z) - hl(c) - hl(lead), lv = lead.player ? lead.v : lead.v;
        const safe = 2.2 + c.v * 0.35;
        if (gap < safe) { c.v = Math.min(c.v, Math.max(0, lv - (safe - gap) * 0.8)); }
        if (gap < 0.15) c.z = lead.z - L.dir * (hl(c) + hl(lead) + 0.15);     // never through the one in front
      }
    }
  }
  // near misses and collisions with every car near you
  contacts() {
    const R = this.ride, C = TRAFFIC_CFG, f = R.fwd, yawOff = Math.atan2(Math.sin(R.yaw), Math.cos(R.yaw));
    // the car's footprint on the road's axes (it's a box turned a little off the road's line)
    const phw = R.P.halfW * Math.abs(Math.cos(yawOff)) + R.P.halfL * Math.abs(Math.sin(yawOff)), phl = R.P.halfL * Math.abs(Math.cos(yawOff)) + R.P.halfW * Math.abs(Math.sin(yawOff));
    const pv = -R.vel.z;                                     // the car's speed up the highway
    for (const c of this.north) {
      if (c.off) { this.track.delete(c); continue; }
      const dz = R.pos.z - c.z;                              // > 0: that car is ahead of you
      if (Math.abs(dz) > 14) { this.track.delete(c); continue; }
      const s = c.truck ? TRUCK : CAR, gapX = Math.abs(c.L.x - R.pos.x) - phw - s.hw, gapZ = Math.abs(dz) - phl - s.hl;
      let tr = this.track.get(c); if (!tr) { tr = { ahead: dz > 0, minGap: 99, paid: false, hitT: -9 }; this.track.set(c, tr); }
      // touching: the two boxes overlap
      if (gapX < 0 && gapZ < 0) {
        if (this.t - tr.hitT > 1) {
          tr.hitT = this.t; tr.paid = true;
          const n = Math.abs(gapX) < Math.abs(gapZ) ? new THREE.Vector3(Math.sign(R.pos.x - c.L.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz) || 1);
          const rel = new THREE.Vector3(R.vel.x, 0, R.vel.z).sub(new THREE.Vector3(0, 0, -c.v)), closing = Math.max(0, -rel.dot(n));
          this.hit(closing, c, new THREE.Vector3((R.pos.x + c.L.x) / 2, 0.3, (R.pos.z + c.z) / 2), n);
          if (this.over) return;
        }
        continue;
      }
      // alongside: how close the bodies come
      if (gapZ < 0) tr.minGap = Math.min(tr.minGap, gapX);
      // passed it: you were behind, now it's behind you
      const ahead = dz > 0;
      if (tr.ahead && !ahead && gapZ > 0 && !tr.paid) {
        tr.paid = true;
        const rel2 = pv - c.v;
        if (tr.minGap < C.near && tr.minGap >= 0 && pv > C.minSpeed && rel2 > C.minRel) this.nearMiss(c, tr.minGap, rel2, Math.sign(c.L.x - R.pos.x));
      }
      if (!ahead && gapZ > 3) tr.ahead = false;
      if (ahead && gapZ > 1) { tr.ahead = true; tr.paid = false; tr.minGap = 99; }   // got ahead of you again: a fresh pass
      void f;
    }
  }
  nearMiss(c, gap, rel, side) {
    const q = clamp(1 - gap / TRAFFIC_CFG.near, 0, 1);
    let pts = Math.round((60 + 240 * q * q) * (0.6 + rel / 25) * (c.truck ? 1.5 : 1));
    this.combo++; this.comboT = TRAFFIC_CFG.comboTime; this.nearMisses++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const label = q > 0.75 ? 'RAZOR CLOSE' : q > 0.45 ? 'CLOSE CALL' : 'NEAR MISS';
    // two cars either side of you in one go: a lane split
    if (this.lastNear && this.t - this.lastNear.t < 0.4 && this.lastNear.side !== side) { pts += 300; this.splits++; this.hub.pop('LANE SPLIT  +300', 'rgba(255,120,220,.9)', true); }
    this.lastNear = { t: this.t, side };
    this.pot += pts * this.mult;
    this.ride.boost = Math.min(1, this.ride.boost + 0.1 + q * 0.08);
    this.hub.pop(`${label}  +${Math.round(pts * this.mult)}`, q > 0.75 ? 'rgba(255,90,90,.95)' : 'rgba(255,200,80,.9)', q > 0.75);
    sfx.whoosh && sfx.whoosh(c.L.x, c.z, 0.5 + q * 0.5);
    if (q > 0.7 && Math.random() < 0.5) sfx.horn && sfx.horn(c.L.x, c.z, 0.35);
  }
  bank() {
    if (this.pot > 0) { this.score += this.pot; this.hub.pop(`COMBO x${this.combo} BANKED  +${Math.round(this.pot).toLocaleString()}`, 'rgba(120,255,200,.95)', true); }
    this.pot = 0; this.combo = 0; this.comboT = 0;
  }
  // a collision: the combo pot is lost; hard enough, it's a crash (spin-out, or the end of an endless run)
  hit(closing, car, at, n) {
    const R = this.ride, C = TRAFFIC_CFG, fx = G.fx;
    this.collisions++; this.clean = 0; this.cleanPaid = 0;
    if (this.pot > 0) this.hub.pop('COMBO LOST', 'rgba(255,90,90,.95)');
    this.pot = 0; this.combo = 0; this.comboT = 0;
    if (closing < C.crash) {
      // a scrape or a nudge: speed lost, pushed apart, sparks
      R.v *= 0.72; if (n) { R.pos.addScaledVector(n, 0.12); if (n.x) R.vx = n.x * 2.5; }
      if (car) car.z -= 0.6;                       // shoved on ahead a little
      fx && fx.sparks(at.x, 0.3, at.z, 10, 2.4, 1.8, 0.8, 6);
      sfx.crash(at.x, at.z, 0.35); this.chase.shake = 0.5;
      this.hub.pop('SCRAPE', 'rgba(255,140,90,.9)');
      return;
    }
    // a real crash: the other car is wrecked, yours spins
    this.crashes++;
    if (car) { car.off = true; this.wreckFx(new THREE.Vector3(car.L.x, 0.3, car.z), car.truck); }
    fx && fx.sparks(at.x, 0.4, at.z, 30, 2.4, 1.8, 0.8, 9);
    sfx.crashRec ? sfx.crashRec(at.x, at.z, 0.05, 1) || sfx.crash(at.x, at.z, 1) : sfx.crash(at.x, at.z, 1);
    this.chase.shake = 1.2; G.shake = Math.max(G.shake || 0, 0.4);
    G.slowmo && G.slowmo(1.2, 0.2);                 // a cinematic beat of slow motion
    R.spin = (Math.random() < 0.5 ? -1 : 1) * rand(5, 8); R.v *= 0.45;
    if (this.mode === 'endless') { this.wreckFx(R.pos.clone(), false, true); this.end('crash'); return; }
    this.hub.pop('CRASHED', 'rgba(255,80,80,.95)', true);
    this.recoverT = 1.6;
  }
  wreckFx(p, big, mine = false) {
    const fx = G.fx; if (!fx) return;
    fx.fireball(p.x, p.y + 0.3, p.z, big ? 2.6 : 1.8, 0.7);
    for (let i = 0; i < 10; i++) fx.debris.spawn(p.x, p.y + 0.2, p.z, new THREE.Vector3(rand(-5, 5), rand(2, 7), rand(-5, 5)), rand(0.06, 0.16), rand(0.04, 0.1), rand(0.06, 0.18), new THREE.Color(mine ? 0xff5a1f : 0x8a8f96));
    for (let i = 0; i < 4; i++) fx.smokePuff(p.x + rand(-0.5, 0.5), p.y + 0.4, p.z + rand(-0.5, 0.5), 0.8, 0.25, 4);
  }
  recover() {
    const R = this.ride, C = TRAFFIC_CFG, lane = C.lanes.reduce((a, b) => (Math.abs(C.I15 + b - R.pos.x) < Math.abs(C.I15 + a - R.pos.x) ? b : a));
    R.spin = 0; R.place(C.I15 + lane, R.pos.z, 0, 12); this.ghost = 1.6;
    // make room ahead and behind in that lane
    for (const c of this.north) if (!c.off && Math.abs(c.L.x - (C.I15 + lane)) < 0.5 && Math.abs(c.z - R.pos.z) < 8) c.z += c.z < R.pos.z ? -8 : 8;
  }
  // loop back south: you and every car near you move together, so nothing jumps; the cars that were there swap in
  wrap() {
    const R = this.ride, C = TRAFFIC_CFG, d = C.wrapBy, pz = R.pos.z, span = 2500;
    const inRange = (z, c0) => Math.abs(z - c0) < 260;
    for (const c of this.cars) {
      if (inRange(c.z, pz)) c.z += d; else if (inRange(c.z, pz + d)) c.z -= d;
      if (c.z > c.L.z1) c.z -= span; if (c.z < c.L.z0) c.z += span;
    }
    R.pos.z += d; this.track.clear();
    if (R.model) R.sync(0);
  }
  end(why) {
    if (this.over) return;
    this.over = true;
    const C = TRAFFIC_CFG;
    if (this.pot > 0 && why === 'time') this.bank();
    const score = Math.round(this.score), distM = this.dist * M, kmh = (u) => Math.round(u * M * 3.6);
    const avg = this.t > 0 ? this.speedSum / this.t : 0;
    const lines = [['Near misses', this.nearMisses], ['Best combo', `x${this.bestCombo}`], ['Lane splits', this.splits], ['Distance', `${(distM / 1000).toFixed(2)} km`], ['Top speed', `${kmh(this.topSpeed)} km/h`], ['Average speed', `${kmh(avg)} km/h`], ['Longest clean run', `${Math.round(this.bestClean)} m`], ['Collisions', this.collisions], ['Time', `${this.t.toFixed(1)} s`]];
    const valid = this.mode === 'score90' ? this.t >= 90 - 1e-6 : distM >= 100;
    const records = { traffic_combo: this.bestCombo, traffic_clean: Math.round(this.bestClean) };
    if (this.mode === 'score90') records.traffic_score90 = score; else records.traffic_distance = Math.round(distM);
    const evidence = { t: +this.t.toFixed(2), nm: this.nearMisses, dist: Math.round(distM), top: kmh(this.topSpeed), col: this.collisions };
    setTimeout(() => this.hub.finish({
      valid, invalidWhy: 'Drive at least 100 m for a run to count.',
      title: this.mode === 'score90' ? 'HIGHWAY CUT-UP · 90 SECONDS' : 'HIGHWAY CUT-UP · ENDLESS',
      headline: this.mode === 'score90' ? score.toLocaleString() : `${(distM / 1000).toFixed(2)} km`,
      headlineLabel: this.mode === 'score90' ? 'POINTS' : why === 'crash' ? `WRECKED · ${score.toLocaleString()} POINTS` : `${score.toLocaleString()} POINTS`,
      medalValue: this.mode === 'score90' ? score : distM, lines, records, evidence,
      xp: this.mode === 'score90' ? Math.min(80, 15 + score / 1500) : Math.min(80, 15 + distM / 250),
      score, stats: { runs: 1, nearMisses: this.nearMisses, km: distM / 1000, max_combo: this.bestCombo, collisions: this.collisions, cleanM: Math.round(this.bestClean) },
    }), why === 'crash' ? 1400 : 300);
    void C;
  }
  hudUpdate() {
    const e = this.el, R = this.ride; if (!e) return;
    e.score.textContent = Math.round(this.score).toLocaleString();
    if (this.mode === 'score90') { const left = Math.max(0, 90 - this.t); e.sub.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; e.sub.classList.toggle('warn', left < 10 && this.go >= 0); }
    else e.sub.textContent = `${(this.dist * M / 1000).toFixed(2)} KM`;
    e.combo.classList.toggle('on', this.combo > 0);
    if (this.combo > 0) { e.mult.textContent = `x${this.mult.toFixed(1)}`; e.pot.textContent = `${this.combo} IN A ROW · +${Math.round(this.pot).toLocaleString()}`; e.cbar.style.width = `${(this.comboT / TRAFFIC_CFG.comboTime) * 100}%`; }
    e.spd.textContent = Math.round(R.speed * M * 3.6);
    e.bbar.style.width = `${R.boost * 100}%`; e.boost.classList.toggle('on', !!R.boosting);
  }
  applyCamera(dt) {
    if (!this.ride) return;
    this.chase.update(dt, this.ride, G.post, G.scene);
    this.hub.followSun(this.ride.pos.x, this.ride.pos.z);
  }
  // on the minimap: the highway, with your lanes in route blue
  minimap(c, s, p, C) {
    const X = TRAFFIC_CFG.I15;
    c.fillStyle = C.hw; c.fillRect(X - 8, p.z - 400, 16, 800);
    c.fillStyle = 'rgba(10,132,255,.55)'; c.fillRect(X + 0.4, p.z - 400, 7.6, 800);
    c.fillStyle = '#7d879e'; c.fillRect(X - 0.25, p.z - 400, 0.5, 800);
    // the cars around you
    c.fillStyle = '#e8ecf2';
    for (const car of this.cars) if (!car.off && Math.abs(car.z - p.z) < 120) { const h = car.truck ? TRUCK : CAR; c.fillRect(car.L.x - h.hw, car.z - h.hl, h.hw * 2, h.hl * 2); }
    void s;
  }
  dispose() {
    for (const c of this.cars || []) { if (c.v0 != null) c.v = c.v0; c.off = false; }
    for (const m of this.disposables) { G.scene.remove(m); m.geometry && m.geometry.dispose(); }
    this.disposables.length = 0;
    if (this.ride) { this.ride.dispose(); this.ride = null; }
    this.track && this.track.clear();
  }
}

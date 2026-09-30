// People who ride in the emergency vehicles. When a police car, fire truck or ambulance parks at an event, its
// crew climbs out, does the job, walks back, climbs in, and only then does the vehicle leave.
//   police:    investigate the scene; if there is a hostile, close in and neutralise them; move rioters on
//   fire:      run a hose from the truck, spray the nearest burning sections until the fire is out
//   paramedic: go to someone who is down, kneel and treat them; the dead go onto a stretcher and into the ambulance
// A small fixed pool (10 officers, 6 firefighters, 4 paramedics) drawn with a handful of instanced meshes.
// Scenes far from the camera get no crew at all: the event resolves in the abstract (see world.js).
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const POOL = { police: 10, fire: 6, medic: 4 };
const CREW = { police: () => (Math.random() < 0.3 ? 3 : 2), fire: () => 3, ambulance: () => 2 };
const ROLE_OF = { police: 'police', fire: 'fire', ambulance: 'medic' };
const LOOK = {
  police: { torso: 0x1d2a44, legs: 0x141a26, hat: 0x141a26, gear: 0x111111 },
  fire: { torso: 0xb58a3a, legs: 0x9c7430, hat: 0xe0b000, gear: 0x2a2a2a },
  medic: { torso: 0xeeeeea, legs: 0x1f2a44, hat: 0x2f6f3a, gear: 0xd05a1a },
};
const SKIN = [0xe8c4a8, 0xc99b78, 0x9a6b4c, 0x6b4630, 0xf0d6c0, 0xb07e5a];
const NEAR_CAM = 90;                                  // crews are only simulated when the scene is this close

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Responders {
  constructor(scene, city = null) {
    this.people = [];
    // police headquarters: its own guard detail (fixed posts round the building plus a few walking the block)
    this.hq = city && city.policeHQ;
    const guards = this.hq ? this.hq.posts.length + this.hq.patrols : 0;
    const roster = { ...POOL, guard: guards };
    const N = POOL.police + POOL.fire + POOL.medic + guards;
    const geo = {
      torso: new THREE.CylinderGeometry(0.068, 0.058, 0.25, 7).scale(1, 1, 0.64).translate(0, 0.43, 0),
      head: new THREE.SphereGeometry(0.048, 8, 6).translate(0, 0.625, 0),
      hat: new THREE.CylinderGeometry(0.055, 0.058, 0.04, 8).translate(0, 0.67, 0),
      leg: new THREE.CylinderGeometry(0.028, 0.021, 0.31, 5).translate(0, -0.155, 0),
      arm: new THREE.CylinderGeometry(0.019, 0.015, 0.24, 5).translate(0, -0.12, 0),
      gear: new THREE.BoxGeometry(0.03, 0.05, 0.09).translate(0, -0.25, 0.03),
    };
    const mk = (g, n) => { const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial(), n); m.frustumCulled = false; m.castShadow = true; for (let i = 0; i < n; i++) m.setMatrixAt(i, ZERO); scene.add(m); return m; };
    this.I = { torso: mk(geo.torso, N), head: mk(geo.head, N), hat: mk(geo.hat, N), leg: mk(geo.leg, N * 2), arm: mk(geo.arm, N * 2), gear: mk(geo.gear, N) };
    // stretchers (one per paramedic pair) and hoses (one per firefighter)
    this.stretch = mk(new THREE.BoxGeometry(0.22, 0.04, 0.62).translate(0, 0.24, 0), 2); this.stretch.material.color.set(0xd8d8d4);
    this.hose = mk(new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0.02, 0.5), POOL.fire); this.hose.material.color.set(0xb8321f);
    let i = 0;
    for (const [role, n] of Object.entries(roster)) for (let k = 0; k < n; k++, i++) {
      const L = LOOK[role] || LOOK.police, p = { i, role, state: 'free', x: 0, z: 0, h: 0, run: 0, crouch: 0, aim: 0, moving: false };
      this.I.torso.setColorAt(i, new THREE.Color(L.torso)); this.I.head.setColorAt(i, new THREE.Color(pick(SKIN)));
      this.I.hat.setColorAt(i, new THREE.Color(L.hat)); this.I.gear.setColorAt(i, new THREE.Color(L.gear));
      for (const s of [0, 1]) { this.I.leg.setColorAt(i * 2 + s, new THREE.Color(L.legs)); this.I.arm.setColorAt(i * 2 + s, new THREE.Color(L.torso)); }
      this.people.push(p);
    }
    for (const m of Object.values(this.I)) m.instanceColor.needsUpdate = true;
    if (this.hq) this.people.filter((p) => p.role === 'guard').forEach((p, k) => {
      const post = this.hq.posts[k];
      Object.assign(p, { state: 'guard', hidden: false, patrol: !post, post: post || { x: this.hq.x, z: this.hq.z, h: 0 }, ev: { x: this.hq.x, z: this.hq.z, type: 'HQ', active: true } });
      p.x = p.post.x + (post ? 0 : Math.random() * 4 - 2); p.z = p.post.z + (post ? 0 : Math.random() * 4 - 2); p.h = p.post.h || 0;
    });
    this.threats = []; this.scanT = 0; this.alertT = 0;
    this.stretchers = [null, null]; this.shotGap = 0;
  }

  // ---------- vehicles ----------
  arrive(c) {
    const ev = c.incident;
    if (!ev || c.posted) return;
    const T = G.camTarget;
    if (Math.hypot(c.pos.x - T.x, c.pos.z - T.z) > NEAR_CAM) { c.virtual = true; return; }    // far away: abstract
    const role = ROLE_OF[c.emerg], want = CREW[c.emerg]();
    const free = this.people.filter((p) => p.role === role && p.state === 'free').slice(0, want);
    if (!free.length) { c.virtual = true; return; }
    c.crew = free; c.virtual = false;
    free.forEach((p, k) => {
      p.car = c; p.ev = ev; p.state = 'exiting'; p.t = role === 'fire' ? 0.2 + k * 0.2 : 0.35 + k * 0.45; p.side = k % 2 ? -1 : 1; p.job = null; p.post = null;
      const d = G.emergency.carPoint(c, 0.3 * p.side, 0.05 - k * 0.25);
      p.x = d.x; p.z = d.z; p.h = c.heading + p.side * Math.PI / 2; p.hidden = true;
    });
  }
  // event resolved: everyone walks back to the vehicle. Returns true if anyone is out (the car waits for them).
  recall(c) {
    if (!c.crew) return false;
    let out = false;
    for (const p of c.crew) if (p.state !== 'free' && p.state !== 'inCar') { this.dropJob(p); p.state = 'returning'; out = true; }
    return out;
  }
  aboard(c) {
    if (!c.crew) return true;
    if (c.crew.every((p) => p.state === 'inCar' || p.state === 'free')) { for (const p of c.crew) this.free(p); c.crew = null; return true; }
    return false;
  }
  free(p) { this.dropJob(p); p.state = 'free'; p.car = null; p.ev = null; p.hidden = true; }
  dropJob(p) {
    const j = p.job;
    if (j && j.victim && j.victim.claimedBy === p) j.victim.claimedBy = null;
    if (j && j.victim && j.victim.state === 'carried' && p.role === 'medic') { j.victim.state = 'down'; j.victim.pos.y = 0; }
    if (p.stretch != null) { this.stretch.setMatrixAt(p.stretch, ZERO); this.stretchers[p.stretch] = null; p.stretch = null; }
    p.job = null; p.aim = 0; p.crouch = 0;
  }

  // spawned from the WORLD menu: a responder on foot, working the area around where they were placed
  spawnStandalone(role, x, z) {
    let p = this.people.find((q) => q.role === role && q.state === 'free');
    if (!p) p = this.people.filter((q) => q.role === role && q.state === 'standalone').sort((a, b) => a.since - b.since)[0];
    if (!p) return null;
    this.dropJob(p);
    Object.assign(p, { state: 'standalone', car: null, ev: { x, z, type: 'PATROL', active: true }, post: { x, z }, x, z, h: rand(0, 6.28), hidden: false, since: G.time, job: null });
    return p;
  }

  // ---------- behaviour ----------
  update(dt) {
    this.shotGap = Math.max(0, this.shotGap - dt);
    this.retarget = (this.retarget || 0) - dt;
    const re = this.retarget <= 0; if (re) this.retarget = 0.5;
    if (this.hq && (this.scanT -= dt) <= 0) { this.scanT = 0.2; this.threats = this.findThreats(); }
    this.alertT = Math.max(0, this.alertT - dt);
    for (const p of this.people) {
      if (p.state === 'guard') { this.guard(p, dt); continue; }
      if (p.state === 'free' || p.state === 'inCar') { p.hidden = true; continue; }
      const c = p.car;
      // the vehicle was destroyed or driven off without them: they finish up and are stood down out of view
      if (c && p.state !== 'returning' && p.state !== 'entering' && c.state !== 'onscene') { this.dropJob(p); p.car = null; p.state = 'standalone'; p.post = { x: p.x, z: p.z }; p.since = G.time; }
      if (p.state === 'standalone' && !p.car && G.time - p.since > 150 && Math.hypot(p.x - G.camTarget.x, p.z - G.camTarget.z) > 60) { this.free(p); continue; }
      if (p.state === 'exiting') {
        if ((p.t -= dt) <= 0.25 && p.hidden) { p.hidden = false; if (p.side > 0) c.doorT = 1.3; else c.doorT2 = 1.3; }
        if (p.t <= 0) { p.state = 'working'; }
        else if (!p.hidden) this.step(p, G.emergency.carPoint(c, 0.75 * p.side, 0.05), 1.2, dt);
        continue;
      }
      if (p.state === 'returning') {
        const d = G.emergency.carPoint(c, 0.7 * p.side, 0.05);
        if (this.step(p, d, 2.4, dt)) { p.state = 'entering'; p.t = 0.5; if (p.side > 0) c.doorT = 1.3; else c.doorT2 = 1.3; }
        continue;
      }
      if (p.state === 'entering') { if ((p.t -= dt) <= 0) { p.state = 'inCar'; p.hidden = true; } continue; }
      // working (with a vehicle) or standalone (placed by the player): do the job
      if (p.role === 'police') this.police(p, dt, re);
      else if (p.role === 'fire') this.fire(p, dt, re);
      else this.medic(p, dt, re);
    }
    this.draw();
  }
  // walk/run toward d; returns true when there
  step(p, d, speed, dt) {
    const dx = d.x - p.x, dz = d.z - p.z, l = Math.hypot(dx, dz);
    if (l < 0.1) { p.moving = false; return true; }
    const s = Math.min(l, speed * dt);
    const nx = p.x + dx / l * s, nz = p.z + dz / l * s;
    if (G.buildings.inside(_v.set(nx, 0.3, nz))) { p.x += -dz / l * s; p.z += dx / l * s; }  // sidestep a wall
    else { p.x = nx; p.z = nz; }
    p.h = Math.atan2(dx, dz); p.moving = true; p.run += dt * (speed > 1.8 ? 15 : 9);
    return false;
  }
  scene(p) { return p.ev || { x: p.x, z: p.z }; }

  // ---- headquarters guards: hold their posts; anything threatening near the station gets shot, immediately ----
  findThreats() {
    const hq = this.hq, R = hq.r + 4, out = [];
    for (const q of G.agents.peds) {
      if (!(q.hostile || q.state === 'riot' || q.gangSide) || ['down', 'gone', 'incar', 'carried', 'air'].includes(q.state)) continue;
      if (Math.hypot(q.pos.x - hq.x, q.pos.z - hq.z) < R) out.push({ kind: 'ped', o: q, x: q.pos.x, z: q.pos.z });
    }
    if (G.gangs) for (const m of G.gangs.members) if (m.state !== 'down' && Math.hypot(m.x - hq.x, m.z - hq.z) < R) out.push({ kind: 'gang', o: m, x: m.x, z: m.z });
    return out;
  }
  onBlast(x, y, z, r, power, kind) {
    const hq = this.hq;
    if (!hq || kind === 'collapse' || Math.hypot(x - hq.x, z - hq.z) > hq.r + 10) return;
    this.alertT = 7; this.alertAt = { x, z };                    // the station is under attack: weapons up, facing it
  }
  guard(p, dt) {
    p.hidden = false;
    const hq = this.hq, j = p.job;
    const alive = (t) => (t.kind === 'gang' ? t.o.state !== 'down' : !['down', 'gone', 'carried'].includes(t.o.state) && (t.o.hostile || t.o.state === 'riot' || t.o.gangSide));
    if (j && j.kind === 'engage' && !alive(j)) p.job = null;
    if (!p.job || p.job.kind !== 'cuff') {
      const t = this.threats.filter(alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (t && (!p.job || p.job.o !== t.o)) p.job = { kind: 'engage', o: t.o, tk: t.kind, fireT: rand(0.1, 0.35) };
    }
    const job = p.job;
    if (job && job.kind === 'cuff') {
      const o = job.o;
      if (o.state !== 'down') { p.job = null; return; }
      if (!this.step(p, { x: o.pos.x + 0.3, z: o.pos.z }, 2.4, dt)) { p.crouch = 0; p.aim = 0; return; }
      p.h = Math.atan2(o.pos.x - p.x, o.pos.z - p.z); p.crouch = Math.min(1, p.crouch + dt * 3);
      if ((job.t -= dt) <= 0) { o.state = 'gone'; o.respawn = rand(60, 90); o.gangSide = null; p.crouch = 0; p.job = null; }
      return;
    }
    if (job && job.kind === 'engage') {
      const o = job.o, tx = job.tk === 'gang' ? o.x : o.pos.x, tz = job.tk === 'gang' ? o.z : o.pos.z, d = Math.hypot(tx - p.x, tz - p.z);
      p.h = Math.atan2(tx - p.x, tz - p.z); p.aim = Math.min(1, p.aim + dt * 8); p.moving = false;
      if (d > 14 && Math.hypot(p.x - hq.x, p.z - hq.z) < hq.r) { this.step(p, { x: tx, z: tz }, 2.6, dt); return; }   // close in, but don't leave the grounds
      if (p.aim < 0.7 || (job.fireT -= dt) > 0) return;
      job.fireT = rand(0.25, 0.55);
      const hx = p.x + Math.sin(p.h) * 0.25, hz = p.z + Math.cos(p.h) * 0.25;
      if (Math.hypot(hx - G.camTarget.x, hz - G.camTarget.z) < 70) {
        G.fx.fire.emit(hx, 0.5, hz, Math.sin(p.h) * 2, 0.2, Math.cos(p.h) * 2, 0.22, 0.05);
        G.fx.spark.emit(hx, 0.5, hz, Math.sin(p.h) * 40, 0, Math.cos(p.h) * 40, 0.08, 0.15, 4, 3, 1.4, 1);
        if (this.shotGap <= 0) { this.shotGap = rand(0.25, 0.5); sfx.gunshot(hx, hz, 1); }
      }
      if (Math.random() < 0.4) {
        const dx = (tx - p.x) / (d || 1), dz = (tz - p.z) / (d || 1);
        if (job.tk === 'gang') { G.gangs.hit(o, { dx, dz }); p.job = null; return; }
        o.state = 'down'; o.timer = rand(40, 60); o.hostile = false; o.riot = null; o.heading = rand(0, 6.28);
        G.gore && G.gore.shot(o.pos.x, o.pos.z, dx, dz);
        // the nearest free guard goes to restrain them
        const cuffer = this.people.filter((q) => q.state === 'guard' && (!q.job || q.job.kind !== 'cuff')).sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz))[0];
        if (cuffer) cuffer.job = { kind: 'cuff', o, t: 3 };
        if (cuffer !== p) p.job = null;
      }
      return;
    }
    // nothing to shoot: back to post (or walk the block), weapon lowered unless the station was just attacked
    if (this.alertT > 0 && this.alertAt) { p.h = Math.atan2(this.alertAt.x - p.x, this.alertAt.z - p.z); p.aim = Math.min(1, p.aim + dt * 6); p.moving = false; return; }
    p.aim = Math.max(0, p.aim - dt * 2); p.crouch = 0;
    if (p.patrol) {
      if (!p.beatSpot) p.beatSpot = this.beat({ post: { x: hq.x, z: hq.z } }, hq.r);
      if (this.step(p, p.beatSpot, 1.0, dt)) p.beatSpot = null;
      return;
    }
    if (this.step(p, p.post, 1.6, dt)) { p.moving = false; p.h += (p.post.h + Math.sin(G.time * 0.4 + p.i) * 0.5 - p.h) * Math.min(1, dt * 2); }
  }

  // ---- police: neutralise a hostile if there is one, otherwise hold and look around the scene ----
  police(p, dt, re) {
    const ev = this.scene(p);
    if ((re && !(p.job && p.job.kind === 'cuff')) || !p.job) {
      let target = null;
      const th = ev.threat;
      if (th && th.state !== 'down' && th.state !== 'gone' && th.hostile && Math.hypot(th.pos.x - ev.x, th.pos.z - ev.z) < 40) target = { kind: 'ped', o: th };
      if (!target && !p.car) {
        const h = G.agents.peds.find((q) => (q.hostile || q.state === 'riot') && q.state !== 'down' && Math.hypot(q.pos.x - p.x, q.pos.z - p.z) < 20);
        if (h) target = { kind: h.state === 'riot' ? 'rioter' : 'ped', o: h };
      }
      if (!target && G.gangs) {
        const m = G.gangs.members.filter((q) => q.state !== 'down' && Math.hypot(q.x - p.x, q.z - p.z) < 13).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        if (m && (ev.type === 'GANG_CONFLICT' || G.gangs.fight)) target = { kind: 'gang', o: m };
      }
      if (!target && ev.rioters) {
        const r = ev.rioters.filter((q) => q.state === 'riot').sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z))[0];
        if (r) target = { kind: 'rioter', o: r };
      }
      // same target as before: keep the job (and its trigger timer) rather than starting over
      if (target) { if (!p.job || p.job.o !== target.o) p.job = { ...target, fireT: rand(0.5, 1.2) }; }
      else if (!p.job || p.job.kind !== 'look') p.job = { kind: 'look', spot: p.car ? { x: ev.x + rand(-4, 4), z: ev.z + rand(-4, 4) } : this.beat(p, 18), t: p.car ? rand(3, 7) : rand(1, 3) };
    }
    const j = p.job;
    if (j.kind === 'cuff') {
      const o = j.o;
      if (o.state !== 'down') { p.job = null; return; }
      if (!this.step(p, { x: o.pos.x + 0.3, z: o.pos.z }, 2.2, dt)) { p.crouch = 0; return; }
      p.h = Math.atan2(o.pos.x - p.x, o.pos.z - p.z); p.crouch = Math.min(1, p.crouch + dt * 3); p.aim = 0;
      if ((j.t -= dt) <= 0) { o.state = 'gone'; o.respawn = rand(60, 90); p.crouch = 0; p.job = null; G.fx.dust(o.pos.x, 0.1, o.pos.z, 0.2); }
      return;
    }
    if (j.kind === 'look') {
      p.aim = Math.max(0, p.aim - dt * 3);
      if (this.step(p, j.spot, 1.0, dt)) { p.h += Math.sin(G.time * 0.7 + p.i) * dt * 0.8; if ((j.t -= dt) <= 0) p.job = null; }
      return;
    }
    const o = j.o, tx = j.kind === 'gang' ? o.x : o.pos.x, tz = j.kind === 'gang' ? o.z : o.pos.z;
    const d = Math.hypot(tx - p.x, tz - p.z);
    if (j.kind === 'rioter') {
      // walk up to rioters and move them on
      if (d > 1.2) this.step(p, { x: tx, z: tz }, 2.2, dt);
      else { o.riot = null; o.state = 'flee'; o.timer = rand(4, 7); o.threat = { x: p.x, z: p.z }; p.job = null; }
      return;
    }
    // hostile: close to ~6, then take aim and fire
    if (d > 6.5) { p.aim = Math.max(0, p.aim - dt * 2); this.step(p, { x: tx, z: tz }, 2.4, dt); return; }
    p.moving = false; p.h = Math.atan2(tx - p.x, tz - p.z); p.aim = Math.min(1, p.aim + dt * 4);
    if (p.aim < 0.9 || (j.fireT -= dt) > 0) return;
    j.fireT = rand(0.35, 0.8);
    const hx = p.x + Math.sin(p.h) * 0.25, hz = p.z + Math.cos(p.h) * 0.25;
    if (Math.hypot(hx - G.camTarget.x, hz - G.camTarget.z) < 70) {
      G.fx.fire.emit(hx, 0.5, hz, Math.sin(p.h) * 2, 0.2, Math.cos(p.h) * 2, 0.22, 0.05);
      if (this.shotGap <= 0) { this.shotGap = rand(0.3, 0.6); sfx.gunshot(hx, hz, 1); }
    }
    if (Math.random() < 0.3) {
      const dx = (tx - p.x) / (d || 1), dz = (tz - p.z) / (d || 1);
      if (j.kind === 'gang') G.gangs.hit(o, { dx, dz });
      else {
        o.state = 'down'; o.timer = rand(40, 60); o.hostile = false; o.heading = rand(0, 6.28);
        G.gore && G.gore.shot(o.pos.x, o.pos.z, dx, dz);
        if (p.ev) p.ev.threatDown = true;
        p.job = { kind: 'cuff', o, t: 3 };                     // walk over, restrain them, take them away
        return;
      }
      p.job = null;
    }
  }

  // ---- fire: hose line from the truck, spray the nearest burning section until it's out ----
  fire(p, dt, re) {
    const ev = this.scene(p);
    if (re || !p.job || p.job.done) {
      const t = this.fireTarget(ev, p);
      p.job = t ? { kind: 'spray', ...t } : { kind: 'idle' };
    }
    const j = p.job;
    if (j.kind === 'idle') {
      p.aim = 0;
      if (p.car) { this.step(p, G.emergency.carPoint(p.car, 1.2 * p.side, -0.6), 1.0, dt); return; }
      if (!j.spot) j.spot = this.beat(p, 12);
      if (this.step(p, j.spot, 1.0, dt)) j.spot = null;
      return;
    }
    // stand in the open a few metres from the fire, on whichever side is clear (walls get in the way)
    if (!j.stand) j.stand = this.standSpot(p, j);
    const reach = Math.hypot(j.x - p.x, j.z - p.z);
    j.walk = (j.walk || 0) + dt;
    // rush in; open up the hose as soon as the fire is within reach (or from wherever they got stuck)
    const arrived = reach < 6 || this.step(p, j.stand, 3.2, dt) || (j.walk > 5 && reach < 8);
    if (!arrived) { p.aim = 0; if (j.walk > 14) j.done = true; return; }
    p.moving = false;
    p.h = Math.atan2(j.x - p.x, j.z - p.z); p.aim = Math.min(1, p.aim + dt * 3);
    // water arcs from the nozzle onto the target, with steam where it lands
    const near = Math.hypot(p.x - G.camTarget.x, p.z - G.camTarget.z) < 75;
    const nx = p.x + Math.sin(p.h) * 0.22, nz = p.z + Math.cos(p.h) * 0.22, ny = 0.48;
    if (near) {
      const T = 0.55, dx = j.x - nx, dz = j.z - nz, dy = j.y - ny;
      for (let k = 0; k < 4; k++) {
        const s = rand(0.9, 1.1);
        G.fx.bits.emit(nx, ny, nz, dx / T * s + rand(-0.2, 0.2), (dy + 0.5 * 12 * T * T) / T * s, dz / T * s + rand(-0.2, 0.2), rand(0.05, 0.09), T * 1.05, 0.75, 0.85, 1.0, 1);
      }
      if (Math.random() < dt * 3) G.fx.smokePuff(j.x, j.y + 0.2, j.z, 0.6, 0.85, 3);
    }
    // knock the fire down: sections near the stream burn out, burning cars and ground fires too
    const B = G.buildings;
    for (const c of B.burning) {
      if (Math.abs(c.x - j.x) > 2.4 || Math.abs(c.z - j.z) > 2.4 || Math.abs(c.y - j.y) > 3) continue;
      c.fire -= dt * 9;
      if (c.fire <= 0) { c.fire = 0; c.heat = 0; B.burning.delete(c); B.writeState(c); }
    }
    for (const car of G.agents.cars) if (car.fire > 0 && Math.hypot(car.pos.x - j.x, car.pos.z - j.z) < 2) car.fire -= dt * 7;
    for (const f of G.fx.groundFires) if (Math.hypot(f.x - j.x, f.z - j.z) < 2.5) f.t -= dt * 7;
    if (j.cell && !B.burning.has(j.cell)) j.done = true;
    if (j.car && !(j.car.fire > 0)) j.done = true;
    if (j.ground && !(j.ground.t > 0)) j.done = true;
  }
  standSpot(p, j) {
    const B = G.buildings;
    let best = null, bd = 1e9;
    for (const r of [j.far || 2.6, 3.8, 5.2]) for (let a = 0; a < 6.283; a += 0.52) {
      const x = j.x + Math.cos(a) * r, z = j.z + Math.sin(a) * r;
      if (B.inside(_v.set(x, 0.3, z)) || B.inside(_v.set((x + p.x) / 2, 0.3, (z + p.z) / 2))) continue;
      const d = Math.hypot(x - p.x, z - p.z) + r * 0.8;
      if (d < bd) { bd = d; best = { x, z }; }
    }
    return best || { x: p.x, z: p.z };
  }
  // somewhere to walk to on the sidewalks near an officer's post (falls back to a point near it)
  beat(p, r) {
    const C = G.city, post = p.post || { x: p.x, z: p.z };
    const ok = C.pedNodes.filter((n) => n.edges.length && Math.hypot(n.x - post.x, n.z - post.z) < r && !(C.pedBlocked && C.pedBlocked(n.x, n.z)));
    const n = ok.length ? pick(ok) : null;
    return n ? { x: n.x + rand(-0.4, 0.4), z: n.z + rand(-0.4, 0.4) } : { x: post.x + rand(-3, 3), z: post.z + rand(-3, 3) };
  }
  fireTarget(ev, p) {
    const B = G.buildings, R = p.car ? 18 : 45;              // placed firefighters go looking further afield
    let best = null, bd = 1e9;
    const consider = (x, y, z, o) => { const d = Math.hypot(x - p.x, z - p.z) + y * 0.3; if (Math.hypot(x - ev.x, z - ev.z) < R && d < bd) { bd = d; best = { x, y, z, ...o }; } };
    for (const c of B.burning) if (c.alive && c.fire > 0) consider(c.x, c.y, c.z, { cell: c, far: 2.4 + c.b.w * 0.15 });
    for (const car of G.agents.cars) if (car.fire > 0 && car.state !== 'hidden') consider(car.pos.x, 0.4, car.pos.z, { car, far: 2 });
    for (const f of G.fx.groundFires) if (f.t > 0) consider(f.x, 0.2, f.z, { ground: f, far: 2 });
    return best;
  }

  // ---- paramedics: treat the injured; the dead are carried to the ambulance on a stretcher ----
  medic(p, dt, re) {
    const ev = this.scene(p);
    if (!p.job || p.job.done) {
      const A = G.agents;
      // the partner's patient first, then anyone down near the scene
      const mate = (p.car ? p.car.crew : []).find((q) => q !== p && q.job && q.job.victim && q.job.victim.state === 'down');
      let v = mate ? mate.job.victim : null;
      const R = p.car ? 20 : 40;
      if (!v) v = A.peds.filter((q) => q.state === 'down' && !q.claimedBy && !q.treated && Math.hypot(q.pos.x - ev.x, q.pos.z - ev.z) < R).sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z))[0];
      if (v) { if (!v.claimedBy) v.claimedBy = p; p.job = { kind: 'treat', victim: v, t: rand(5, 7), side: v.claimedBy === p ? 1 : -1 }; }
      else p.job = { kind: 'idle' };
    }
    const j = p.job;
    if (j.kind === 'idle') {
      p.crouch = Math.max(0, p.crouch - dt * 3);
      if (p.car) { this.step(p, G.emergency.carPoint(p.car, 0.9 * p.side, -1.1), 1.0, dt); if (re) p.job = null; return; }
      if (!j.spot) j.spot = this.beat(p, 12);
      if (this.step(p, j.spot, 1.0, dt)) { j.spot = null; if (Math.random() < 0.5) p.job = null; }
      else if (re && Math.random() < 0.3) p.job = null;           // keep checking for someone who needs help
      return;
    }
    const v = j.victim;
    if (j.kind === 'treat') {
      if (v.state !== 'down') { j.done = true; p.crouch = 0; return; }
      const spot = { x: v.pos.x + Math.cos(v.heading) * 0.3 * j.side, z: v.pos.z - Math.sin(v.heading) * 0.3 * j.side };
      if (!this.step(p, spot, 2.2, dt)) { p.crouch = 0; return; }
      p.h = Math.atan2(v.pos.x - p.x, v.pos.z - p.z); p.crouch = Math.min(1, p.crouch + dt * 3);
      if (j.side < 0) return;                                  // the partner assists; the lead decides
      if ((j.t -= dt) > 0) return;
      p.crouch = 0;
      if (!v.dead) {
        // patched up: back on their feet, a little shaky
        v.state = 'flee'; v.timer = rand(1.5, 3); v.threat = { x: p.x, z: p.z }; v.treated = true; v.claimedBy = null; v.q.identity(); v.bleed = false;
        j.done = true; return;
      }
      // onto the stretcher and back to the ambulance (if we have one and a stretcher is free)
      const slot = this.stretchers.indexOf(null);
      if (!p.car || slot < 0) { v.claimedBy = null; v.treated = true; j.done = true; return; }
      p.stretch = slot; this.stretchers[slot] = p; v.state = 'carried';
      p.job = { kind: 'carry', victim: v };
      return;
    }
    if (j.kind === 'carry') {
      const back = G.emergency.carPoint(p.car, 0, -1.25);
      const there = this.step(p, back, 1.1, dt);
      // the stretcher rides ahead of the lead, the body on top
      const sx = p.x + Math.sin(p.h) * 0.45, sz = p.z + Math.cos(p.h) * 0.45;
      v.pos.set(sx, 0.2, sz); v.heading = p.h;
      _m.compose(_v.set(sx, 0, sz), _q.setFromAxisAngle(_s.set(0, 1, 0), p.h), _s.set(1, 1, 1)); this.stretch.setMatrixAt(p.stretch, _m);
      if (there) {
        v.state = 'gone'; v.respawn = rand(40, 80); v.pos.y = 0; v.claimedBy = null;
        this.stretch.setMatrixAt(p.stretch, ZERO); this.stretchers[p.stretch] = null; p.stretch = null;
        p.car.doorT = p.car.doorT2 = 1.3;
        p.job = null;
      }
    }
  }

  // ---------- drawing ----------
  draw() {
    const I = this.I;
    let hoses = 0;
    for (const p of this.people) {
      const i = p.i;
      if (p.hidden || p.state === 'free' || p.state === 'inCar') {
        for (const k of ['torso', 'head', 'hat', 'gear']) I[k].setMatrixAt(i, ZERO);
        for (const s of [0, 1]) { I.leg.setMatrixAt(i * 2 + s, ZERO); I.arm.setMatrixAt(i * 2 + s, ZERO); }
        continue;
      }
      const crouch = p.crouch || 0;
      _e.set(0, p.h, 0); _b.compose(_v.set(p.x, -crouch * 0.12 + (p.moving ? Math.abs(Math.sin(p.run)) * 0.02 : 0), p.z), _q.setFromEuler(_e), _s.set(1, 1, 1));
      for (const k of ['torso', 'head', 'hat']) I[k].setMatrixAt(i, _b);
      const r = p.moving ? Math.sin(p.run) : 0;
      this.limb(I.leg, i * 2, 0.034, 0.31, r * 0.8 - crouch * 1.2);
      this.limb(I.leg, i * 2 + 1, -0.034, 0.31, -r * 0.8 - crouch * 0.4);
      const aimR = -r * 0.7 + (-1.5 + r * 0.7) * p.aim, aimL = r * 0.7 + (-1.3 - r * 0.7) * p.aim * (p.role === 'fire' ? 1 : 0.4);
      const carrying = p.job && p.job.kind === 'carry';
      this.limb(I.arm, i * 2, 0.084, 0.535, carrying ? -1.2 : aimL, 0.1);
      const hand = this.limb(I.arm, i * 2 + 1, -0.084, 0.535, carrying ? -1.2 : crouch > 0.5 ? -0.9 : aimR, -0.1);
      I.gear.setMatrixAt(i, hand);
      // a hose from the truck to anyone spraying
      if (p.role === 'fire' && p.car && p.job && p.job.kind === 'spray' && p.aim > 0.3 && hoses < POOL.fire) {
        const a = G.emergency.carPoint(p.car, 0.4 * p.side, -0.8), dx = p.x - a.x, dz = p.z - a.z, L = Math.hypot(dx, dz);
        _m.compose(_v.set(a.x, 0, a.z), _q.setFromAxisAngle(_s.set(0, 1, 0), Math.atan2(dx, dz)), _s.set(1, 1, L));
        this.hose.setMatrixAt(hoses++, _m);
      }
    }
    for (let k = hoses; k < POOL.fire; k++) this.hose.setMatrixAt(k, ZERO);
    for (const m of [...Object.values(I), this.stretch, this.hose]) m.instanceMatrix.needsUpdate = true;
  }
  limb(mesh, idx, px, py, rx, rz = 0) {
    _l.makeRotationFromEuler(_e.set(rx, 0, rz)); _l.setPosition(px, py, 0);
    const out = _m.multiplyMatrices(_b, _l);
    mesh.setMatrixAt(idx, out);
    return out;
  }
}

// Random civilian incidents, independent of the player's weapons: car crashes, street shootings and fires
// (kept non-graphic: gunshots, muzzle flashes, people dropping or scattering). Each one is reported so
// police, fire and ambulances respond; after a while the scene clears, responders leave and wrecks are towed.
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';
import { settings } from './settings.js';


export class Chaos {
  constructor(agents) {
    this.A = agents;
    this.t = rand(20, 35);          // give the player a moment before the first one
    this.scenes = [];
  }

  // when and what happens on its own is the director's call (director.js); this just runs the scenes
  update(dt) {
    for (const s of [...this.scenes]) this.tickScene(s, dt);
  }

  // the festival is a no-incident zone: the game never starts a crash or shooting within a wide ring of it
  safe(o) {
    const S = G.concert && G.concert.site;
    if (!S) return true;
    const M = 35, x = o.pos.x, z = o.pos.z;
    return !(x > S.x0 - M && x < S.x1 + M && z > S.z0 - M && z < S.z1 + M);
  }

  // somewhere the player can plausibly see or hear it
  near(list, r = 48) {
    const T = G.camTarget;
    const close = list.filter((o) => Math.hypot(o.pos.x - T.x, o.pos.z - T.z) < r);
    return close.length ? pick(close) : null;
  }

  // pick someone near the camera, favouring spots with lots of people around them
  crowded(list, r = 48) {
    const T = G.camTarget;
    const close = list.filter((o) => Math.hypot(o.pos.x - T.x, o.pos.z - T.z) < r);
    if (!close.length) return null;
    const sample = close.length > 40 ? Array.from({ length: 40 }, () => pick(close)) : close;
    const w = sample.map((p) => 1 + close.filter((o) => Math.abs(o.pos.x - p.pos.x) < 6 && Math.abs(o.pos.z - p.pos.z) < 6).length ** 1.5);
    let k = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < sample.length; i++) if ((k -= w[i]) <= 0) return sample[i];
    return sample[0];
  }

  // ---------- car crash ----------
  // a: a specific car (from the WORLD menu); otherwise one near the camera
  crash(a = null) {
    const A = this.A;
    const driving = A.cars.filter((c) => c.state === 'drive' && !c.emerg && !c.leaving && c.speed > 1 && this.safe(c));
    a = a || this.near(driving);
    if (!a) return false;
    const b = driving.filter((o) => o !== a).sort((p, q) => p.pos.distanceTo(a.pos) - q.pos.distanceTo(a.pos))[0];
    const hitCar = b && b.pos.distanceTo(a.pos) < 9 ? b : null;
    // the recorded brake-and-crash, timed so its impact lands on the collision; the synthesized skid + crash if it isn't loaded
    const rec = sfx.crashRec && sfx.crashRec(a.pos.x, a.pos.z, 1.0);
    if (!rec) sfx.skid(a.pos.x, a.pos.z, 0.55);
    setTimeout(() => {
      if (a.state !== 'drive') return;
      const x = hitCar ? (a.pos.x + hitCar.pos.x) / 2 : a.pos.x, z = hitCar ? (a.pos.z + hitCar.pos.z) / 2 : a.pos.z;
      const wrecks = [a];
      if (hitCar && hitCar.state === 'drive') wrecks.push(hitCar);
      for (const c of wrecks) {
        let dx = c.pos.x - x, dz = c.pos.z - z, d = Math.hypot(dx, dz);
        if (d < 0.1) { dx = Math.sin(c.heading + Math.PI / 2); dz = Math.cos(c.heading + Math.PI / 2); d = 1; }
        A.launch(c, { x: dx / d, z: dz / d }, rand(1.6, 3), rand(0.6, 1.6), true, rand(2.5, 5));
        if (Math.random() < 0.12) c.fire = rand(12, 25);
      }
      if (!rec) sfx.crash(x, z, wrecks.length > 1 ? 1.2 : 0.9);
      G.fx.sparks(x, 0.4, z, 14, 4, 2.2, 0.8, 5);
      G.fx.dust(x, 0.2, z, 0.8);
      G.shake = Math.max(G.shake, 0.3);
      // bystanders: anyone right there is knocked over, others stop and stare, then back away
      for (const p of A.peds) {
        const dx = p.pos.x - x, dz = p.pos.z - z, d = Math.hypot(dx, dz);
        if (d < 1.4 && p.state !== 'air') A.launch(p, { x: dx / (d + 0.01), z: dz / (d + 0.01) }, 2, 1.2, false, 6);
        else if (d < 14 && ['walk', 'wait', 'wander', 'idle', 'return'].includes(p.state)) { p.state = 'alert'; p.timer = rand(1.5, 4); p.threat = { x, z }; }
      }
      for (const c of A.cars) {
        if (c.state !== 'drive' || c.emerg || wrecks.includes(c)) continue;
        if (c.pos.distanceTo(_v.set(x, 0, z)) < 16) { c.timer = rand(0.5, 1.5); if (Math.random() < 0.4) setTimeout(() => sfx.horn(c.pos.x, c.pos.z, 0.4), rand(400, 1800)); }
      }
      this.open(x, z, 1.2, wrecks, [], 'TRAFFIC_ACCIDENT');
    }, rec ? 1000 : 550);
    return true;
  }

  // ---------- street shooting ----------
  // at: a spot chosen from the WORLD menu (the shooter is someone nearby, or someone who walks up)
  shooting(at = null, type = 'SHOOTING') {
    const A = this.A;
    const calm = A.peds.filter((p) => !p.officer && ['walk', 'wander', 'idle', 'wait'].includes(p.state) && (at || this.safe(p)));
    let shooter = at ? calm.filter((p) => Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < 12).sort(() => Math.random() - 0.5)[0] : this.crowded(calm);
    if (!shooter && at) { shooter = A.borrowPed(at, 25); if (shooter) shooter.pos.set(at.x + rand(-1, 1), 0, at.z + rand(-1, 1)); }
    if (!shooter) return false;
    // armed and dangerous until the police deal with them (or they get away)
    shooter.hostile = true; setTimeout(() => { shooter.hostile = false; }, 90000);
    const { x, z } = shooter.pos;
    const around = calm.filter((p) => p !== shooter && Math.hypot(p.pos.x - x, p.pos.z - z) < 7);
    const victims = around.sort(() => Math.random() - 0.5).slice(0, Math.min(around.length, Math.round(rand(1, 3))));
    const facing = victims[0] ? Math.atan2(victims[0].pos.x - x, victims[0].pos.z - z) : rand(0, 6.28);
    shooter.state = 'alert'; shooter.timer = 2.2; shooter.threat = { x: x + Math.sin(facing), z: z + Math.cos(facing) };
    const shots = Math.round(rand(3, 7));
    // a volley of flashes from the shooter's hand height
    for (let k = 0; k < shots; k++) {
      setTimeout(() => {
        const hx = shooter.pos.x + Math.sin(facing) * 0.15, hz = shooter.pos.z + Math.cos(facing) * 0.15;
        G.fx.flash(hx, 0.6, hz, 0xffd08a, 6, 0.06, 8);
        G.fx.sparks(hx, 0.5, hz, 3, 5, 3.5, 1.2, 2);
        if (k === 0 || Math.random() < 0.35) sfx.gunshot(hx, hz, 1);   // not every round needs its own report
      }, 300 + k * rand(140, 320));
    }
    const dur = 300 + shots * 260;
    setTimeout(() => {
      for (const v of victims) {
        if (v.state === 'air') continue;
        v.state = 'down'; v.timer = rand(30, 55); v.heading = rand(0, 6.28);
        if (G.gore && G.gore.on) {
          const dx = v.pos.x - x, dz = v.pos.z - z, d = Math.hypot(dx, dz) || 1;
          G.gore.shot(v.pos.x, v.pos.z, dx / d, dz / d);
          const A = G.agents; A.pTorso.setColorAt(v.i, G.gore.stain(new THREE.Color().fromArray(A.pTorso.instanceColor.array, v.i * 3), 0.4)); A.pTorso.instanceColor.needsUpdate = true;
        }
      }
      // everyone nearby scatters; the shooter runs off
      for (const p of A.peds) {
        if (p === shooter || victims.includes(p)) continue;
        const d = Math.hypot(p.pos.x - x, p.pos.z - z);
        if (d < 22 && p.state !== 'down' && p.state !== 'air') { p.threat = { x, z }; p.state = 'flee'; p.timer = rand(6, 12); }
      }
      if (around.length > 1) sfx.screams(x, z, Math.min(5, 1 + around.length));
      shooter.state = 'flee'; shooter.timer = rand(10, 16); shooter.threat = { x: x - Math.sin(facing) * 3, z: z - Math.cos(facing) * 3 };
      for (const c of A.cars) {
        if (c.state !== 'drive' || c.emerg) continue;
        if (c.pos.distanceTo(_v.set(x, 0, z)) < 18) { c.flee = rand(6, 10); c.threat = { x, z }; }
      }
      this.open(x, z, victims.length ? 1.6 : 1.1, [], victims, type, shooter);
    }, dur);
    return true;
  }

  // ---------- building fire ----------
  // a random fire in a building near the camera: the same FIRE event, and the same fire response, as any other
  fire() {
    const T = G.camTarget, B = G.buildings;
    const near = B.list.filter((b) => !b.gable && Math.hypot(b.x - T.x, b.z - T.z) < 45 && this.safe({ pos: { x: b.x, z: b.z } }));
    const b = pick(near);
    if (!b) return false;
    const cells = b.cells.filter((c) => c.alive && !c.burnedOut && c.f <= 1);
    const c = pick(cells);
    if (!c) return false;
    c.heat = 1; B.ignite(c);
    G.world ? G.world.raise('FIRE', c.x, c.z, { severity: 1, delay: rand(4, 8) }) : this.A.report(c.x, c.z, 1, 'FIRE');
    return true;
  }

  // ---------- scene lifecycle ----------
  open(x, z, sev, wrecks, hurt, type = 'INCIDENT', threat = null) {
    const inc = G.world ? G.world.raise(type, x, z, { severity: sev, threat }) : this.A.report(x, z, sev, type, { threat });
    this.scenes.push({ x, z, inc, wrecks, hurt, t: 0, arrived: null, hold: rand(35, 50), cleared: false });
  }
  tickScene(s, dt) {
    const A = this.A;
    s.t += dt;
    if (!s.cleared) {
      // the injured stay down until help has been there a while
      if (s.arrived == null && A.cars.some((c) => c.incident === s.inc && c.state === 'onscene')) s.arrived = s.t;
      for (const p of s.hurt) if (p.state === 'down') p.timer = Math.max(p.timer, 1);
      if (s.arrived != null ? s.t - s.arrived < s.hold : s.t < 110) return;
      // clear: responders leave, the injured get up and walk off
      s.cleared = true;
      if (s.inc) A.release(s.inc);
      for (const p of s.hurt) if (p.state === 'down') p.timer = 0.1;
    }
    // wrecks are towed once the fire is out (they come back later as fresh traffic out of view)
    s.wrecks = s.wrecks.filter((c) => {
      if (A.cars[A.cars.indexOf(c)] !== c) return false;
      if (c.state === 'air' || c.fire > 0) return true;
      if (c.obs) { const k = A.city.obstacles.indexOf(c.obs); if (k >= 0) A.city.obstacles.splice(k, 1); }
      G.fx.dust(c.pos.x, 0.2, c.pos.z, 0.6);
      A.spawnCar(c.i, c);
      return false;
    });
    if (!s.wrecks.length) this.scenes.splice(this.scenes.indexOf(s), 1);
  }
}

const _v = new THREE.Vector3();

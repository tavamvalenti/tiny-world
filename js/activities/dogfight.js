// DRONE COMBAT — an aerial dogfight over whichever city you're in. You fly the armed drone (its own controls, from
// js/vehicles.js) against AI drones:
//   - enemies pursue you, hold a fighting distance and circle, fly in three dimensions with limited acceleration (no
//     teleporting), stay above the roofs and steer round buildings, only see you with a clear line of sight, lose you
//     and go looking where they last saw you, fire bursts back, and break hard (and sometimes drop a flare) when a
//     missile is coming. Hit: they flash; badly hit: they smoke; destroyed: they fall burning and blow up;
//   - your machine gun gets gentle aim assist inside a small cone round the crosshair (the crosshair turns red while
//     it's helping); right click / G fires a lock-on missile once a lock has built up on a target in your sights;
//   - survival waves (the run ends when you're shot down), a two-minute time attack (you come back, at a cost), and a
//     boss with its own readable attacks: fans of fire after a charge-up, slow homing rockets you can outrun or shoot
//     down, and a dash it lines up first.
// Everything it makes is pooled or removed when you leave; at most a handful of drones fly at once.
import * as THREE from 'three';
import { G, clamp, rand, pick } from '../core.js';
import { sfx } from '../audio.js';

export const DOG_CFG = {
  assistCone: 0.1, assistStrength: 0.6, assistRange: 140,                 // aim assist: radians round the crosshair
  lockCone: 0.2, lockBreak: 0.32, lockTime: 1.15, lockRange: 170,         // missile lock
  missile: { ammo: 4, reload: 6, speed0: 22, speed: 58, accel: 42, turn: 2.4, life: 6, fuse: 1.4, damage: 75, radius: 3.4 },
  gun: { damage: 7 },
  enemy: { hp: 55, speed: 16, accel: 13, range: 72, see: 150, fireGap: 2.1, burst: 4, bulletSpeed: 72, damage: 3, spread: 0.06 },
  playerHp: 100, timeAttack: 120, maxAlive: 6,
};
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1);

export class DroneCombat {
  constructor(hub, def) { this.hub = hub; this.def = def; this.passKeys = true; this.usesR = false; }
  start(mode) {
    const V = G.veh; if (!V || !G.buildings) { this.hub.exit(); return; }
    this.mode = mode; this.V = V;
    V.enter('drone'); V.combat = this;
    V.hud.querySelector('.vh-keys').innerHTML = `<div class="vh-title">DRONE COMBAT</div>` + [['Mouse', 'aim · point to climb or dive'], ['W S', 'fly where you point'], ['A D', 'strafe'], ['Space', 'rise'], ['Shift', 'boost'], ['Click', 'machine gun (aim assist)'], ['Right click / G', 'missile (lock on first)'], ['V', 'camera'], ['R', 'restart'], ['Esc', 'leave']].map(([k, t]) => `<span>${k.split(' / ').map((x) => `<b class="key">${x}</b>`).join('')}${t}</span>`).join('');
    // put the fight high over the middle of where you are, with room round it
    const B = G.buildings, C = G.cam, cx = Number.isFinite(C.x) ? C.x : 0, cz = Number.isFinite(C.z) ? C.z : 0;
    V.pos.set(cx, Math.max(B.surfaceAt(cx, cz, 999).y + 24, 34), cz); V.vel.set(0, 0, 0);
    this.group = new THREE.Group(); G.scene.add(this.group);
    this.buildPools();
    Object.assign(this, { t: 0, hp: DOG_CFG.playerHp, ammo: DOG_CFG.missile.ammo, reloadT: 0, kills: 0, missileKills: 0, shots: 0, hits: 0, score: 0, deaths: 0, wave: 0, waveT: 2.5, spawnQ: 0, spawnT: 0,
      over: false, enemies: [], bullets: [], missiles: [], rockets: [], flares: [], lock: { target: null, p: 0, locked: false, tick: 0 }, wasDead: false, dmgFlash: 0, hitFlash: 0, boss: null, bossT: 0, warnT: 0 });
    this.buildHud();
    if (mode === 'boss') { this.spawnBoss(); this.banner('THE HORNET', 'Destroy it. Watch for its tells.'); }
    else if (mode === 'time') this.banner('TWO MINUTES', 'Shoot down as many as you can');
    else this.banner('WAVE 1', 'Incoming');
    if (mode === 'survival') { this.wave = 1; this.queueWave(1); }
  }
  where() { return this.V ? this.V.pos : null; }
  pilot() { const V = this.V; return V ? { p: V.pos, fx: -Math.sin(V.yaw), fz: -Math.cos(V.yaw), v: V.vel } : null; }
  key() { return false; }
  wheel(e) { this.V && this.V.wheel(e); }

  // ---------------------------------------------------------------- shared meshes, pooled
  buildPools() {
    // enemy drones: a grey body with a red stripe and eye, four arms, four discs for rotors, a gun
    const grey = new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.45, metalness: 0.55 });
    this.enemyGeo = {
      body: new THREE.BoxGeometry(0.75, 0.24, 0.95), stripe: new THREE.BoxGeometry(0.77, 0.05, 0.6), arm: new THREE.BoxGeometry(1.5, 0.06, 0.08),
      rotor: new THREE.CylinderGeometry(0.34, 0.34, 0.02, 14), eye: new THREE.SphereGeometry(0.09, 8, 6), gun: new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6).rotateX(Math.PI / 2),
    };
    this.enemyMat = { grey, red: new THREE.MeshStandardMaterial({ color: 0xc81a1a, roughness: 0.4, emissive: 0x300000 }), rotor: new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.35 }), eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2) }) };
    // tracers for enemy fire (red), missiles and rockets
    const tg = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).rotateX(Math.PI / 2);
    this.tracers = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.5, 0.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 160);
    this.tracers.frustumCulled = false; this.tracers.count = 0; this.group.add(this.tracers);
    const mg = new THREE.Group();
    mg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 })));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8202a })); nose.position.z = -0.35; mg.add(nose);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6) })); fl.position.z = 0.32; mg.add(fl);
    this.missileProto = mg;
  }
  makeEnemy(boss = false) {
    const g = this.enemyGeo, M = this.enemyMat, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const mat = M.grey.clone();                                  // its own, so it can flash when hit
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; body.add(o); return o; };
    add(g.body, mat, 0, 0, 0); add(g.stripe, M.red, 0, 0.12, 0);
    const a1 = add(g.arm, mat, 0, 0.02, 0); a1.rotation.y = Math.PI / 4; const a2 = add(g.arm, mat, 0, 0.02, 0); a2.rotation.y = -Math.PI / 4;
    const rotors = [[0.53, 0.53], [-0.53, 0.53], [0.53, -0.53], [-0.53, -0.53]].map(([x, z]) => add(g.rotor, M.rotor, x, 0.09, z));
    add(g.eye, M.eye, 0, 0, -0.48); add(g.gun, mat, 0, -0.16, -0.4);
    if (boss) { root.scale.setScalar(2.4); add(g.stripe, M.red, 0, -0.12, 0); }
    this.group.add(root);
    return { root, body, mat, rotors };
  }

  // ---------------------------------------------------------------- spawning: far off, never on top of you
  queueWave(n) { this.spawnQ = Math.min(1 + n, DOG_CFG.maxAlive); this.spawnT = 0; this.waveDiff = 1 + (n - 1) * 0.13; }
  spawnEnemy(diff = 1, opts = {}) {
    const V = this.V, B = G.buildings, a = rand(0, Math.PI * 2), d = rand(95, 130);
    const x = V.pos.x + Math.cos(a) * d, z = V.pos.z + Math.sin(a) * d, y = Math.max(B.surfaceAt(x, z, 999).y + 10, V.pos.y + rand(-4, 14));
    const E = this.makeEnemy(opts.boss);
    const e = { ...E, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), yaw: 0, hp: (opts.hp || DOG_CFG.enemy.hp) * diff, maxHp: (opts.hp || DOG_CFG.enemy.hp) * diff, diff,
      state: 'pursue', seen: false, seeT: 0, lastSeen: V.pos.clone(), lostT: 0, fireT: rand(1, 2.5), burst: 0, burstT: 0, orbit: rand(0, 6.28), orbitDir: Math.random() < 0.5 ? -1 : 1, evadeT: 0, flareUsed: new Set(), flashT: 0, dead: false, fallT: 0, boss: !!opts.boss, r: opts.boss ? 2 : 0.85, smokeT: 0, los: true, losT: 0 };
    e.root.position.copy(e.pos);
    this.enemies.push(e);
    return e;
  }
  spawnBoss() {
    const e = this.spawnEnemy(1, { boss: true, hp: 1400 });
    e.pattern = 'strafe'; e.patT = 7; e.chargeT = 0; e.dash = null;
    this.boss = e; this.bossT = 0;
    for (let i = 0; i < 2; i++) this.spawnEnemy(0.9);
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const V = this.V; if (!V || !V.active) { if (!this.over) this.hub.exit(); return; }
    if (this.over) { this.updateWorld(dt); return; }
    this.t += dt; if (this.boss) this.bossT += dt;
    // back from a crash (time attack): full hull again
    if (this.wasDead && !V.dead) { this.hp = DOG_CFG.playerHp; this.lock.target = null; }
    this.wasDead = V.dead;
    // missiles reload one at a time
    if (this.ammo < DOG_CFG.missile.ammo) { this.reloadT += dt; if (this.reloadT >= DOG_CFG.missile.reload) { this.reloadT = 0; this.ammo++; } }
    // spawning
    if (this.mode === 'survival') {
      if (this.spawnQ > 0) { this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnEnemy(this.waveDiff); this.spawnQ--; this.spawnT = 0.7; } }
      else if (!this.alive().length) {
        // wave cleared: patch up, a short breather, then the next (each a little harder)
        if (!this.clearing) { this.clearing = true; this.waveT = 3.8; this.hp = Math.min(DOG_CFG.playerHp, this.hp + 25); this.ammo = Math.min(DOG_CFG.missile.ammo, this.ammo + 2); this.score += 250 * this.wave; this.banner(`WAVE ${this.wave} CLEARED`, 'Hull patched · missiles topped up'); }
        this.waveT -= dt;
        if (this.waveT <= 0) { this.clearing = false; this.wave++; this.queueWave(this.wave); this.banner(`WAVE ${this.wave}`, this.wave % 5 === 0 ? 'They\'re getting better' : 'Incoming'); }
      }
    } else if (this.mode === 'time') {
      const want = Math.min(3 + Math.floor(this.t / 30), 5);
      this.spawnT -= dt;
      if (this.alive().length < want && this.spawnT <= 0) { this.spawnEnemy(1 + this.t / 120 * 0.5); this.spawnT = 2.5; }
      if (this.t >= DOG_CFG.timeAttack) this.end('time');
    }
    this.updateWorld(dt);
    this.updateLock(dt);
    if (this.boss && this.boss.dead && !this.over) this.end('boss');
    this.hud();
  }
  alive() { return this.enemies.filter((e) => !e.dead); }
  updateWorld(dt) {
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => { if (e.gone) { this.group.remove(e.root); e.mat.dispose(); } return !e.gone; });
    this.updateBullets(dt); this.updateMissiles(dt); this.updateRockets(dt);
    this.flares = this.flares.filter((f) => { f.t -= dt; f.pos.addScaledVector(f.vel, dt); f.vel.y -= 6 * dt; if (G.fx && Math.random() < 0.6) G.fx.sparks(f.pos.x, f.pos.y, f.pos.z, 2, 3, 2.4, 1.2, 2); return f.t > 0; });
  }

  // ---------------------------------------------------------------- enemy AI
  updateEnemy(e, dt) {
    const V = this.V, B = G.buildings, P = V.pos, cfg = DOG_CFG.enemy;
    for (const r of e.rotors) r.rotation.y += dt * 50;
    if (e.dead) {
      // falling, burning, then the bang
      e.vel.y -= 16 * dt; e.pos.addScaledVector(e.vel, dt); e.root.rotation.x += dt * 3; e.root.rotation.z += dt * 2.2; e.root.position.copy(e.pos);
      if (G.fx && Math.random() < 0.5) G.fx.fire.emit(e.pos.x, e.pos.y, e.pos.z, 0, 1, 0, rand(0.25, 0.5), 0.35, 1.6, 0.8, 0.4, 1);
      e.fallT += dt;
      if (e.pos.y <= B.surfaceAt(e.pos.x, e.pos.z, e.pos.y + 1).y + 0.3 || e.fallT > 4) { this.boom(e.pos, e.boss ? 2.2 : 0.9, false); e.gone = true; }
      return;
    }
    e.flashT = Math.max(0, e.flashT - dt); e.mat.emissive.setRGB(e.flashT > 0 ? 1.2 : 0, 0, 0);
    if (e.hp < e.maxHp * 0.4 && (e.smokeT -= dt) <= 0) { e.smokeT = 0.16; puff(e.pos, 0.3, 0.25, 1.4); }
    // what it can see (not every frame): close enough, and nothing in the way
    if ((e.seeT -= dt) <= 0) {
      e.seeT = 0.35;
      const d = e.pos.distanceTo(P), dir = _a.copy(P).sub(e.pos).normalize();
      e.los = !B.raycast(e.pos, dir, d - 0.8);
      const sees = !V.dead && d < cfg.see * (e.boss ? 1.6 : 1) && e.los;
      if (sees) { e.seen = true; e.lostT = 0; e.lastSeen.copy(P); if (e.state === 'search') e.state = 'pursue'; }
      else { e.lostT += 0.35; if (e.seen && e.lostT > 3) { e.seen = false; e.state = 'search'; } }
    }
    // a missile coming for it: break hard, maybe a flare
    for (const m of this.missiles) {
      if (m.target !== e || m.dead) continue;
      const d = m.pos.distanceTo(e.pos);
      if (d < 38 && e.evadeT <= 0) {
        e.evadeT = rand(1, 1.5);
        e.evadeDir = _b.copy(m.vel).cross(UP).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1).add(new THREE.Vector3(0, rand(-0.6, 0.8), 0)).normalize().clone();
        if (!e.flareUsed.has(m) && Math.random() < (e.boss ? 0.6 : 0.35)) { e.flareUsed.add(m); this.dropFlare(e); }
      }
    }
    e.evadeT = Math.max(0, e.evadeT - dt);
    // where it wants to be
    const speed = (cfg.speed + (e.diff - 1) * 6) * (e.boss ? 0.85 : 1), want = new THREE.Vector3();
    if (e.evadeT > 0) want.copy(e.evadeDir).multiplyScalar(speed * 1.4);
    else if (e.boss && e.dash) want.copy(e.dash.dir).multiplyScalar(e.dash.t > 0 ? 0 : 46);
    else if (e.state === 'search') {
      const to = _a.copy(e.lastSeen).sub(e.pos); if (to.length() < 8) { e.lastSeen.add(new THREE.Vector3(rand(-40, 40), rand(-4, 6), rand(-40, 40))); }
      want.copy(to.normalize()).multiplyScalar(speed * 0.7);
    } else {
      // circle the player at a fighting distance, a little above
      e.orbit += dt * 0.35 * e.orbitDir;
      const dist = e.boss ? 34 : 24 + (e.diff - 1) * 4, tgt = new THREE.Vector3(P.x + Math.cos(e.orbit) * dist, P.y + (e.boss ? 8 : 4), P.z + Math.sin(e.orbit) * dist);
      const to = tgt.sub(e.pos), L = to.length(); want.copy(to).multiplyScalar(Math.min(1, L / 12) * speed / Math.max(L, 0.01));
    }
    // keep off the roofs and out of buildings: look ahead, climb over what's there
    const ahead = _b.copy(e.pos).addScaledVector(e.vel, 0.9), floor = B.surfaceAt(ahead.x, ahead.z, 999).y;
    if (ahead.y < floor + 5 || B.inside(ahead)) want.y = Math.max(want.y, speed * 0.9);
    const here = B.surfaceAt(e.pos.x, e.pos.z, 999).y; if (e.pos.y < here + 4) want.y = Math.max(want.y, 6);
    if (e.pos.y > 95) want.y = Math.min(want.y, -2);
    // a little room from the others
    for (const o of this.enemies) if (o !== e && !o.dead) { const d = e.pos.distanceTo(o.pos); if (d < 5) want.add(_a.copy(e.pos).sub(o.pos).normalize().multiplyScalar((5 - d) * 2)); }
    // limited acceleration: it has to turn and brake like anything else that flies
    const acc = _a.copy(want).sub(e.vel), maxA = (cfg.accel + (e.diff - 1) * 4) * (e.evadeT > 0 ? 1.8 : 1) * dt;
    if (acc.length() > maxA) acc.setLength(maxA);
    e.vel.add(acc); e.pos.addScaledVector(e.vel, dt);
    if (B.inside(e.pos)) { e.pos.addScaledVector(e.vel, -dt); e.vel.multiplyScalar(-0.3); e.vel.y = 6; }
    // face the player when it can see you, otherwise where it's going
    const face = e.seen && !e.dash ? _a.copy(P).sub(e.pos) : _a.copy(e.vel);
    const yawWant = Math.atan2(-face.x, -face.z); let dy = yawWant - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy * (1 - Math.exp(-dt * 4));
    e.root.position.copy(e.pos); e.root.rotation.set(0, e.yaw, 0); e.body.rotation.set(clamp(-e.vel.length() / 40, -0.4, 0), 0, clamp(-dy, -0.5, 0.5));
    // ramming: a drone that touches yours hurts both
    if (!V.dead && e.pos.distanceTo(V.pos) < e.r + 0.6) { this.damagePlayer(e.boss ? 35 : 20, e.pos); this.damageEnemy(e, 30, e.pos); V.vel.addScaledVector(_a.copy(V.pos).sub(e.pos).normalize(), 10); }
    if (e.boss) this.bossBrain(e, dt);
    else this.enemyGun(e, dt);
  }
  // fire back: a burst when it has you in its sights and in range
  enemyGun(e, dt) {
    const V = this.V, cfg = DOG_CFG.enemy; if (V.dead) return;
    e.fireT -= dt;
    const d = e.pos.distanceTo(V.pos), fwd = new THREE.Vector3(-Math.sin(e.yaw), 0, -Math.cos(e.yaw)), to = _a.copy(V.pos).sub(e.pos).normalize();
    const facing = fwd.x * to.x + fwd.z * to.z > 0.93;
    if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.09; this.enemyShot(e.pos, V, cfg.spread * (1.6 - Math.min(0.9, (e.diff - 1) * 0.6)) * (0.6 + d / 80), cfg.damage * e.diff); } return; }
    if (e.seen && e.los && d < cfg.range && facing && e.fireT <= 0) { e.burst = cfg.burst; e.burstT = 0; e.fireT = cfg.fireGap / Math.min(1.8, e.diff) + rand(0, 0.8); }
  }
  enemyShot(from, V, spread, dmg, speed = DOG_CFG.enemy.bulletSpeed) {
    const lead = V.pos.clone().addScaledVector(V.vel, V.pos.distanceTo(from) / speed);
    const dir = lead.sub(from).normalize(); dir.x += rand(-spread, spread); dir.y += rand(-spread, spread); dir.z += rand(-spread, spread); dir.normalize();
    const p = from.clone().addScaledVector(dir, 0.9);
    this.bullets.push({ pos: p, prev: p.clone(), vel: dir.multiplyScalar(speed), life: 2, dmg });
    if ((this.shotSnd = (this.shotSnd || 0) + 1) % 3 === 0) sfx.gunshot(from.x, from.z, 1);
    if (G.fx) G.fx.sparks(p.x, p.y, p.z, 2, 3, 0.8, 0.4, 2);
  }
  updateBullets(dt) {
    const V = this.V, B = G.buildings; let n = 0;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const s = this.bullets[i]; s.life -= dt; s.prev.copy(s.pos); s.pos.addScaledVector(s.vel, dt);
      const seg = _a.copy(s.pos).sub(s.prev), len = seg.length(), dir = seg.normalize();
      // into you
      if (!V.dead) { const t = clamp(_b.copy(V.pos).sub(s.prev).dot(dir), 0, len), cl = s.prev.clone().addScaledVector(dir, t); if (cl.distanceTo(V.pos) < 0.7) { this.damagePlayer(s.dmg, cl); this.bullets.splice(i, 1); continue; } }
      const h = len > 0 ? B.raycast(s.prev, dir, len) : null;
      if (h) { if (G.fx) G.fx.sparks(h.point.x, h.point.y, h.point.z, 3, 2.4, 1, 0.5, 3); this.bullets.splice(i, 1); continue; }
      if (s.life <= 0) { this.bullets.splice(i, 1); continue; }
      if (n < 160) { _q.setFromUnitVectors(_z, dir); _m.compose(_b.copy(s.pos).addScaledVector(dir, -0.7), _q, new THREE.Vector3(0.035, 0.035, 1.4)); this.tracers.setMatrixAt(n++, _m); }
    }
    this.tracers.count = n; this.tracers.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the boss: three attacks, each with a tell
  bossBrain(e, dt) {
    const V = this.V; if (V.dead) return;
    e.patT -= dt;
    if (e.patT <= 0 && !e.chargeT && !e.dash) { e.pattern = pick(['strafe', 'rockets', 'dash'].filter((p) => p !== e.pattern)); e.patT = e.pattern === 'strafe' ? 8 : 6; e.chargeT = 1.1; this.bossTell(e); }
    if (e.chargeT > 0) {
      e.chargeT -= dt; e.mat.emissive.setRGB(0.6 + Math.sin(this.t * 30) * 0.5, 0.2, 0);   // glowing: it's about to do something
      if (e.dash && e.dash.t > 0) e.dash.line.visible = true;
      if (e.chargeT <= 0) {
        e.chargeT = 0;
        if (e.pattern === 'strafe') { const n = 11; for (let i = 0; i < n; i++) { const spread = (i - (n - 1) / 2) * 0.07; const aim = V.pos.clone().add(new THREE.Vector3(Math.cos(e.yaw) * spread * 30, rand(-1, 1), -Math.sin(e.yaw) * spread * 30)); this.enemyShot(e.pos, { pos: aim, vel: new THREE.Vector3() }, 0.01, 8, 60); } e.nextFan = 2.2; }
        if (e.pattern === 'rockets') { e.rocketQ = 3; e.rocketT = 0; }
        if (e.pattern === 'dash' && e.dash) { e.dash.t = 0; e.dash.line.visible = false; e.dash.left = 1.1; }
      }
    }
    // the fan repeats a couple of times while strafing, each after its own short tell
    if (e.pattern === 'strafe' && !e.chargeT && e.nextFan != null) { e.nextFan -= dt; if (e.nextFan <= 0 && e.patT > 1.5) { e.chargeT = 0.8; e.nextFan = null; this.bossTell(e); } }
    // the salvo goes out one rocket at a time (on the game's clock)
    if (e.rocketQ > 0) { e.rocketT -= dt; if (e.rocketT <= 0) { this.fireRocket(e); e.rocketQ--; e.rocketT = 0.35; } }
    if (e.dash) {
      if (e.dash.t > 0) { e.dash.t -= dt; this.layLine(e.dash.line, e.pos, e.dash.to); }
      else if (e.dash.left != null) { e.dash.left -= dt; if (e.dash.left <= 0) { this.group.remove(e.dash.line); e.dash = null; } }
    }
  }
  bossTell(e) {
    const V = this.V;
    if (e.pattern === 'dash') {
      const to = V.pos.clone().addScaledVector(V.vel, 0.6), dir = to.clone().sub(e.pos).normalize();
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2), transparent: true, opacity: 0.7, depthWrite: false }));
      this.group.add(line); e.dash = { to, dir, t: e.chargeT, line }; this.layLine(line, e.pos, to);
      this.warn('DASH INCOMING · MOVE');
    } else if (e.pattern === 'rockets') this.warn('ROCKETS · OUTRUN OR SHOOT THEM');
    else this.warn('INCOMING FIRE');
  }
  layLine(line, a, b) { const mid = a.clone().add(b).multiplyScalar(0.5), L = a.distanceTo(b); line.position.copy(mid); line.scale.set(1, 1, L); line.lookAt(b); }
  fireRocket(e) {
    const mesh = this.missileProto.clone(true); mesh.scale.setScalar(1.6); mesh.children[1].material = new THREE.MeshStandardMaterial({ color: 0x1a1a1a }); this.group.add(mesh);
    const dir = this.V.pos.clone().sub(e.pos).normalize().add(new THREE.Vector3(rand(-0.4, 0.4), 0.4, rand(-0.4, 0.4))).normalize();
    this.rockets.push({ mesh, pos: e.pos.clone(), vel: dir.multiplyScalar(14), life: 7, hp: 1 });
    sfx.lock('launch', e.pos.x, e.pos.z); sfx.lock('warn', this.V.pos.x, this.V.pos.z);
  }
  updateRockets(dt) {
    const V = this.V, B = G.buildings;
    for (const r of this.rockets) {
      if (r.dead) continue;
      r.life -= dt;
      const want = V.pos.clone().sub(r.pos).normalize(), cur = r.vel.clone().normalize(), ang = cur.angleTo(want), turn = 1.2 * dt;
      const nd = ang > turn ? cur.lerp(want, turn / ang).normalize() : want; r.vel.copy(nd.multiplyScalar(Math.min(22, r.vel.length() + 8 * dt)));
      const prev = r.pos.clone(); r.pos.addScaledVector(r.vel, dt);
      r.mesh.position.copy(r.pos); r.mesh.lookAt(r.pos.clone().sub(r.vel));
      if (Math.random() < 0.5) puff(r.pos, 0.22, 0.3, 0.9);
      const hit = B.raycast(prev, r.vel.clone().normalize(), r.vel.length() * dt);
      if (!V.dead && r.pos.distanceTo(V.pos) < 1.4) { this.damagePlayer(28, r.pos); this.boom(r.pos, 0.7, false); r.dead = true; }
      else if (hit || r.life <= 0 || r.hp <= 0) { this.boom(hit ? hit.point : r.pos, 0.6, !!hit); r.dead = true; }
      if (r.dead) this.group.remove(r.mesh);
    }
    this.rockets = this.rockets.filter((r) => !r.dead);
    this.warnT = Math.max(0, this.warnT - dt);
    if (this.rockets.length && (this.rocketWarnT = (this.rocketWarnT || 0) - dt) <= 0) { this.rocketWarnT = 1.2; sfx.lock('warn', V.pos.x, V.pos.z); }
  }

  // ---------------------------------------------------------------- your weapons
  // the gun: within a small cone round the crosshair, aim slides toward the target's lead (skill still counts)
  assist(mz, dir) {
    this.shots++;
    let best = null, bestA = DOG_CFG.assistCone;
    for (const t of this.targets()) {
      const d = t.pos.distanceTo(mz); if (d > DOG_CFG.assistRange) continue;
      const lead = t.pos.clone().addScaledVector(t.vel, d / 150), to = lead.sub(mz).normalize(), a = to.angleTo(dir);
      if (a < bestA && t.los !== false) { bestA = a; best = to; }
    }
    this.assisting = !!best;
    if (best) dir.lerp(best, DOG_CFG.assistStrength).normalize();
  }
  targets() { return [...this.enemies.filter((e) => !e.dead), ...this.rockets.map((r) => ({ pos: r.pos, vel: r.vel, rocket: r, r: 0.6, los: true }))]; }
  rayHit(o, dir, len) {
    let best = null;
    for (const t of this.targets()) {
      const r = t.r || 0.85, oc = _a.copy(t.pos).sub(o), along = oc.dot(dir); if (along < -r || along > len + r) continue;
      const d2 = oc.lengthSq() - along * along; if (d2 > r * r) continue;
      const tt = Math.max(0, along - Math.sqrt(r * r - d2)); if (!best || tt < best.t) best = { enemy: t, t: tt };
    }
    return best;
  }
  bulletHit(t, p) {
    this.hits++;
    if (t.rocket) { t.rocket.hp = 0; this.score += 50; this.hub.pop('ROCKET SHOT DOWN  +50', 'rgba(255,212,107,.95)'); return; }
    this.damageEnemy(t, DOG_CFG.gun.damage, p);
    if (G.fx) G.fx.sparks(p.x, p.y, p.z, 4, 2.6, 2, 0.8, 4);
    this.hitFlash = 0.12; sfx.lock('hit', p.x, p.z);
  }
  damageEnemy(e, dmg, p, byMissile = false) {
    if (e.dead) return;
    e.hp -= dmg; e.flashT = 0.08;
    if (!e.seen) { e.seen = true; e.state = 'pursue'; e.lastSeen.copy(this.V.pos); }   // shot from out of sight: now it knows
    if (e.hp <= 0) {
      e.dead = true; e.vel.multiplyScalar(0.4); e.vel.y = 2;
      if (G.fx) { G.fx.fireball(e.pos.x, e.pos.y, e.pos.z, e.boss ? 3.5 : 1.4, 0.6); for (let i = 0; i < (e.boss ? 18 : 8); i++) G.fx.debris.spawn(e.pos.x, e.pos.y, e.pos.z, new THREE.Vector3(rand(-6, 6), rand(1, 7), rand(-6, 6)), rand(0.06, 0.16), rand(0.03, 0.08), rand(0.06, 0.16), new THREE.Color(pick([0x3a3d44, 0xc81a1a, 0x222222]))); }
      sfx.boom(e.pos.x, e.pos.z, e.boss ? 1.6 : 0.6, 'bomb');
      if (this.lock.target === e) this.lock = { target: null, p: 0, locked: false, tick: 0 };
      if (e.boss) { this.hub.pop('THE HORNET IS DOWN', 'rgba(255,212,107,.98)', true); G.slowmo && G.slowmo(1.6, 0.18); return; }
      this.kills++; if (byMissile) this.missileKills++;
      const pts = Math.round(100 * (1 + (this.wave || 1) * 0.1) * (byMissile ? 1.25 : 1)); this.score += pts;
      this.hub.pop(`${byMissile ? 'MISSILE KILL' : 'DRONE DOWN'}  +${pts}`, byMissile ? 'rgba(120,200,255,.95)' : 'rgba(255,200,80,.95)');
    }
  }
  // the lock: hold a target in the cone; it fills, it breaks if you wander off
  updateLock(dt) {
    const V = this.V, L = this.lock; if (V.dead) { L.target = null; L.p = 0; L.locked = false; return; }
    const cam = G.camera, aim = new THREE.Vector3(0, 0.08, -1).unproject(cam).sub(cam.position).normalize();
    // keep line of sight up to date for the targets (cheap: a few at a time)
    for (const e of this.enemies) if (!e.dead && (e.losT -= dt) <= 0) { e.losT = 0.25; const d = e.pos.distanceTo(V.pos); e.los = !G.buildings.raycast(V.pos, _a.copy(e.pos).sub(V.pos).normalize(), d - 1); }
    const angleTo = (e) => _a.copy(e.pos).sub(cam.position).normalize().angleTo(aim);
    if (L.target && (L.target.dead || angleTo(L.target) > DOG_CFG.lockBreak || !L.target.los || L.target.pos.distanceTo(V.pos) > DOG_CFG.lockRange * 1.15)) { L.target = null; L.p = 0; L.locked = false; }
    if (!L.target) {
      let best = null, ba = DOG_CFG.lockCone;
      for (const e of this.enemies) { if (e.dead || !e.los || e.pos.distanceTo(V.pos) > DOG_CFG.lockRange) continue; const a = angleTo(e); if (a < ba) { ba = a; best = e; } }
      if (best) { L.target = best; L.p = 0; L.locked = false; }
    }
    if (L.target && !L.locked) {
      L.p += dt / DOG_CFG.lockTime * (angleTo(L.target) < DOG_CFG.lockCone ? 1 : -0.6); L.p = clamp(L.p, 0, 1);
      L.tick -= dt; if (L.tick <= 0) { L.tick = 0.28 - L.p * 0.2; sfx.lock('tick', V.pos.x, V.pos.z, L.p); }
      if (L.p >= 1) { L.locked = true; sfx.lock('locked', V.pos.x, V.pos.z); }
    }
  }
  fireMissile() {
    const V = this.V, L = this.lock;
    if (this.ammo <= 0) { this.hub.pop('MISSILES RELOADING', 'rgba(255,140,90,.9)'); return false; }
    if (!L.locked || !L.target) { this.hub.pop('NO LOCK · HOLD A TARGET IN YOUR SIGHTS', 'rgba(255,140,90,.9)'); return false; }
    const mz = V.model.muzzle(true), fwd = new THREE.Vector3(-Math.sin(V.yaw), -0.05, -Math.cos(V.yaw)).normalize();
    const mesh = this.missileProto.clone(true); mesh.position.copy(mz); this.group.add(mesh);
    this.missiles.push({ mesh, pos: mz.clone(), vel: fwd.multiplyScalar(DOG_CFG.missile.speed0).add(V.vel), target: L.target, life: DOG_CFG.missile.life, smokeT: 0 });
    this.ammo--; if (this.ammo < DOG_CFG.missile.ammo && this.reloadT <= 0) this.reloadT = 0;
    sfx.lock('launch', mz.x, mz.z);
    return true;
  }
  updateMissiles(dt) {
    const M = DOG_CFG.missile, B = G.buildings;
    for (const m of this.missiles) {
      if (m.dead) continue;
      m.life -= dt;
      // a flare nearby can pull it off
      if (m.target && !m.decoyed) for (const f of this.flares) if (f.from === m.target && Math.random() < 0.6) { m.target = { pos: f.pos, vel: f.vel, flare: true }; m.decoyed = true; break; }
      const tgt = m.target && (m.target.flare || !m.target.dead) ? m.target : null;
      const sp = Math.min(M.speed, m.vel.length() + M.accel * dt);
      if (tgt) {
        const lead = tgt.pos.clone().addScaledVector(tgt.vel || _b.set(0, 0, 0), tgt.pos.distanceTo(m.pos) / sp * 0.6);
        const want = lead.sub(m.pos).normalize(), cur = m.vel.clone().normalize(), ang = cur.angleTo(want), turn = M.turn * dt;
        m.vel.copy((ang > turn ? cur.lerp(want, turn / ang) : want).normalize().multiplyScalar(sp));
      } else m.vel.setLength(sp);
      const prev = m.pos.clone(); m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos); m.mesh.lookAt(m.pos.clone().sub(m.vel));
      if ((m.smokeT -= dt) <= 0) { m.smokeT = 0.06; puff(m.pos, 0.16, 0.9, 0.7); }
      const hit = B.raycast(prev, m.vel.clone().normalize(), m.vel.length() * dt);
      const near = tgt && !tgt.flare && m.pos.distanceTo(tgt.pos) < M.fuse + (tgt.r || 0.85);
      if (near || hit || m.life <= 0) { this.missileBoom(hit ? hit.point : m.pos, !!hit); m.dead = true; this.group.remove(m.mesh); }
    }
    this.missiles = this.missiles.filter((m) => !m.dead);
  }
  missileBoom(p, onSurface) {
    const M = DOG_CFG.missile;
    this.boom(p, 1, onSurface);
    for (const e of this.enemies) { if (e.dead) continue; const d = e.pos.distanceTo(p); if (d < M.radius + e.r) this.damageEnemy(e, M.damage * (1 - d / (M.radius + e.r) * 0.6), p, true); }
    for (const r of this.rockets) if (r.pos.distanceTo(p) < M.radius) r.hp = 0;
  }
  dropFlare(e) {
    for (let i = 0; i < 3; i++) this.flares.push({ pos: e.pos.clone(), vel: new THREE.Vector3(rand(-6, 6), rand(2, 6), rand(-6, 6)), t: 2.2, from: e });
    this.hub.pop('FLARES', 'rgba(255,200,120,.9)');
  }
  boom(p, size, onSurface) {
    const fx = G.fx; if (!fx) return;
    fx.explosion(p.x, p.y, p.z, size * 0.7);
    sfx.boom(p.x, p.z, size * 0.7, 'bomb');
    if (onSurface) G.buildings.damageSphere(p.x, p.y, p.z, 1.2 * size, 40, 0.4, 0.2);   // a scorch on a wall, not a demolition
  }
  damagePlayer(dmg, from) {
    const V = this.V; if (V.dead || V.safeT > 0) return;
    this.hp -= dmg; this.dmgFlash = 0.35; V.shake = Math.max(V.shake, Math.min(1, dmg / 20));
    this.hitFrom = from.clone();
    if (this.hp <= 0) { this.hp = 0; V.explodeDrone(); }
  }
  // shot down: the end of a survival or boss run; in time attack you come back (at a price)
  playerDown() {
    this.deaths++;
    if (this.mode === 'time') { this.score = Math.max(0, this.score - 300); this.hub.pop('SHOT DOWN  −300', 'rgba(255,90,90,.95)', true); return; }
    this.V.respawnT = 1e9; G.slowmo && G.slowmo(1.2, 0.2);
    setTimeout(() => this.end('down'), 1500);
  }
  banner(a, b) { if (!this.el) return; this.el.ban.innerHTML = `<b>${a}</b><span>${b || ''}</span>`; this.el.ban.classList.remove('on'); void this.el.ban.offsetWidth; this.el.ban.classList.add('on'); }
  warn(t) { this.warnT = 2; if (this.el) this.el.warn.textContent = t; sfx.lock('warn', this.V.pos.x, this.V.pos.z); }

  // ---------------------------------------------------------------- the end of a run
  end(why) {
    if (this.over) return; this.over = true;
    const acc = this.shots ? this.hits / this.shots : 0, mode = this.mode;
    if (acc > 0.25 && this.kills > 0) this.score += Math.round(acc * 1000);
    const lines = [['Drones destroyed', this.kills], ['Missile kills', this.missileKills], ['Accuracy', this.shots ? `${Math.round(acc * 100)}%` : '—'], ['Time', fmtT(this.t)]];
    if (mode === 'survival') lines.unshift(['Wave reached', this.wave]);
    if (mode === 'time') lines.push(['Times shot down', this.deaths]);
    const bossWin = mode === 'boss' && why === 'boss';
    if (bossWin) this.score += Math.max(0, Math.round(5000 - this.bossT * 15));
    const records = { dogfight_score: this.score };
    if (mode === 'survival') records.dogfight_wave = this.wave;
    if (mode === 'time') records.dogfight_kills = this.kills;
    if (bossWin) records.dogfight_boss = +this.bossT.toFixed(2);
    const valid = mode === 'survival' ? this.t > 10 : mode === 'time' ? this.t >= DOG_CFG.timeAttack - 0.01 : bossWin;
    const medalValue = mode === 'survival' ? this.wave : mode === 'time' ? this.kills : this.bossT;
    setTimeout(() => this.hub.finish({
      valid, invalidWhy: mode === 'boss' ? 'The Hornet got you. Try again: watch for the glow before each attack.' : 'Too short to count.',
      title: mode === 'survival' ? 'DRONE COMBAT · SURVIVAL' : mode === 'time' ? 'DRONE COMBAT · TIME ATTACK' : 'DRONE COMBAT · THE HORNET',
      headline: mode === 'survival' ? `Wave ${this.wave}` : mode === 'time' ? `${this.kills} kills` : bossWin ? fmtT(this.bossT) : 'Shot down',
      headlineLabel: `${this.score.toLocaleString()} POINTS`, medalValue, lines, records, score: this.score,
      evidence: { t: +this.t.toFixed(1), kills: this.kills, shots: this.shots, hits: this.hits, wave: this.wave },
      xp: Math.min(90, 15 + this.kills * 4 + (bossWin ? 40 : 0)),
      stats: { runs: 1, kills: this.kills, missileKills: this.missileKills, waves: mode === 'survival' ? this.wave : 0, boss: bossWin ? 1 : 0, accuracy: Math.round(acc * 100) },
    }), 400);
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const el = this.hub.gameEl;
    el.innerHTML = `<style>
      .dg-top{position:absolute;left:50%;top:calc(4.2vh + 64px);transform:translateX(-50%);text-align:center;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);font-family:-apple-system,'SF Pro Text',Inter,sans-serif}
      .dg-top b{display:block;font:800 22px -apple-system,'SF Pro Display',Inter,sans-serif;letter-spacing:.02em} .dg-top span{font:700 11px -apple-system,Inter,sans-serif;letter-spacing:.18em;color:#ff8a7a}
      .dg-boss{width:min(420px,70vw);height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden;margin:6px auto 0;display:none} .dg-boss i{display:block;height:100%;background:linear-gradient(90deg,#ff375f,#ff9f0a)}
      .dg-bot{position:absolute;left:50%;bottom:calc(4.2vh + 16px);transform:translateX(-50%);display:flex;gap:18px;align-items:flex-end;color:#fff;font-family:-apple-system,'SF Pro Text',Inter,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.8)}
      .dg-hp small,.dg-ms small{display:block;font:700 9.5px -apple-system,Inter,sans-serif;letter-spacing:.18em;color:rgba(255,255,255,.7);margin-bottom:4px}
      .dg-hp div{width:180px;height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden} .dg-hp i{display:block;height:100%;background:linear-gradient(90deg,#30d158,#a8f06a);transition:width .2s}
      .dg-hp.low i{background:linear-gradient(90deg,#ff375f,#ff9f0a)}
      .dg-ms span{display:inline-block;width:10px;height:22px;border-radius:5px;margin-right:4px;background:rgba(255,255,255,.15)} .dg-ms span.on{background:linear-gradient(180deg,#e8f4ff,#64d2ff);box-shadow:0 0 8px rgba(100,210,255,.8)}
      .dg-lock{position:absolute;left:0;top:0;transform:translate(-50%,-50%);border:2px solid #ffd60a;border-radius:6px;display:none;pointer-events:none;box-shadow:0 0 10px rgba(255,214,10,.6)}
      .dg-lock.locked{border-color:#ff375f;box-shadow:0 0 16px rgba(255,55,95,.9)}
      .dg-lock small{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:5px;white-space:nowrap;font:800 9.5px -apple-system,Inter,sans-serif;letter-spacing:.16em;color:#ffd60a;text-shadow:0 1px 3px #000}
      .dg-lock.locked small{color:#ff375f}
      .dg-lock em{position:absolute;left:0;right:0;bottom:-20px;height:3px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden} .dg-lock em i{display:block;height:100%;background:#ff375f}
      .dg-mk{position:absolute;left:0;top:0;width:12px;height:12px;transform:translate(-50%,-50%) rotate(45deg);border:2px solid #ff453a;display:none;pointer-events:none;box-shadow:0 0 6px rgba(255,69,58,.8)}
      .dg-mk.edge{border-radius:0 6px 0 6px;background:rgba(255,69,58,.5)}
      .dg-hit{position:absolute;left:50%;top:46%;width:22px;height:22px;transform:translate(-50%,-50%) rotate(45deg);opacity:0;pointer-events:none}
      .dg-hit:before,.dg-hit:after{content:'';position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:linear-gradient(#fff 35%,transparent 35% 65%,#fff 65%)} .dg-hit:after{transform:rotate(90deg)}
      .dg-dmg{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 120px 30px rgba(255,30,30,.55);opacity:0}
      .dg-warn{position:absolute;left:50%;top:calc(4.2vh + 128px);transform:translateX(-50%);font:900 13px -apple-system,Inter,sans-serif;letter-spacing:.24em;color:#ff453a;text-shadow:0 0 12px rgba(255,69,58,.9);opacity:0}
      .dg-ban{position:absolute;left:50%;top:30%;transform:translateX(-50%);text-align:center;opacity:0;pointer-events:none;color:#fff}
      .dg-ban b{display:block;font:900 30px -apple-system,'SF Pro Display',Inter,sans-serif;letter-spacing:.06em;text-shadow:0 0 18px rgba(255,69,58,.8)} .dg-ban span{font:600 13px -apple-system,Inter,sans-serif;color:rgba(255,255,255,.8)}
      .dg-ban.on{animation:dgBan 2.6s ease-out forwards}
      @keyframes dgBan{0%{opacity:0;transform:translate(-50%,10px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0}}
      #vehHud .vh-ret.assist{--col:#ff453a}
    </style>
    <div class="dg-top"><b></b><span></span><div class="dg-boss"><i></i></div></div>
    <div class="dg-warn"></div><div class="dg-ban"></div><div class="dg-dmg"></div><div class="dg-hit"></div>
    <div class="dg-lock"><small></small><em><i></i></em></div>
    ${'<div class="dg-mk"></div>'.repeat(8)}
    <div class="dg-bot"><div class="dg-hp"><small>HULL</small><div><i></i></div></div><div class="dg-ms"><small>MISSILES</small><span></span><span></span><span></span><span></span></div></div>`;
    const q = (s) => el.querySelector(s);
    this.el = { top: q('.dg-top b'), sub: q('.dg-top span'), boss: q('.dg-boss'), bossI: q('.dg-boss i'), warn: q('.dg-warn'), ban: q('.dg-ban'), dmg: q('.dg-dmg'), hit: q('.dg-hit'), lock: q('.dg-lock'), lockT: q('.dg-lock small'), lockI: q('.dg-lock em i'), mk: [...el.querySelectorAll('.dg-mk')], hp: q('.dg-hp'), hpI: q('.dg-hp i'), ms: [...el.querySelectorAll('.dg-ms span')] };
  }
  hud() {
    const e = this.el; if (!e) return;
    const dt = G.dt || 1 / 60, w = innerWidth, h = innerHeight, cam = G.camera, v = new THREE.Vector3();
    if (this.mode === 'survival') { e.top.textContent = `WAVE ${this.wave}`; e.sub.textContent = `${this.alive().length + this.spawnQ} LEFT · ${this.score.toLocaleString()} PTS`; }
    else if (this.mode === 'time') { const left = Math.max(0, DOG_CFG.timeAttack - this.t); e.top.textContent = fmtT(left); e.sub.textContent = `${this.kills} KILLS · ${this.score.toLocaleString()} PTS`; }
    else { e.top.textContent = 'THE HORNET'; e.sub.textContent = fmtT(this.bossT); e.boss.style.display = 'block'; if (this.boss) e.bossI.style.width = `${Math.max(0, this.boss.hp / this.boss.maxHp) * 100}%`; }
    e.hpI.style.width = `${(this.hp / DOG_CFG.playerHp) * 100}%`; e.hp.classList.toggle('low', this.hp < 35);
    e.ms.forEach((s, i) => s.classList.toggle('on', i < this.ammo));
    this.dmgFlash = Math.max(0, this.dmgFlash - dt); e.dmg.style.opacity = this.dmgFlash * 2;
    this.hitFlash = Math.max(0, this.hitFlash - dt); e.hit.style.opacity = this.hitFlash > 0 ? 1 : 0;
    e.warn.style.opacity = this.warnT > 0 || this.rockets.length ? (Math.floor(this.t * 6) % 2 ? 1 : 0.35) : 0;
    if (this.rockets.length && this.warnT <= 0) e.warn.textContent = 'MISSILE INCOMING';
    if (this.V.ret) this.V.ret.classList.toggle('assist', !!this.assisting);
    this.assisting = false;
    // markers on every enemy (pinned to the edge, pointing, when off screen)
    const alive = this.alive();
    e.mk.forEach((m, i) => {
      const en = alive[i]; if (!en || this.V.dead) { m.style.display = 'none'; return; }
      v.copy(en.pos).project(cam); const behind = v.z > 1; if (behind) { v.x = -v.x; v.y = -v.y; }
      const off = behind || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.9;
      if (off) { const k = 1 / Math.max(Math.abs(v.x) / 0.92, Math.abs(v.y) / 0.85); v.x *= k; v.y *= k; }
      m.classList.toggle('edge', off); m.style.display = 'block';
      m.style.left = `${(v.x + 1) / 2 * w}px`; m.style.top = `${(1 - v.y) / 2 * h}px`;
      m.style.borderColor = en.boss ? '#ff9f0a' : '#ff453a';
    });
    // the lock box: shrinks as the lock builds, red when locked, with the target's health
    const L = this.lock;
    if (L.target && !L.target.dead) {
      v.copy(L.target.pos).project(cam);
      if (v.z < 1) {
        const size = 84 - L.p * 44; e.lock.style.display = 'block'; e.lock.style.width = e.lock.style.height = `${size}px`;
        e.lock.style.left = `${(v.x + 1) / 2 * w}px`; e.lock.style.top = `${(1 - v.y) / 2 * h}px`;
        e.lock.classList.toggle('locked', L.locked);
        e.lockT.textContent = L.locked ? (this.ammo ? 'LOCKED · FIRE' : 'LOCKED · RELOADING') : `LOCKING ${Math.round(L.p * 100)}%`;
        e.lockI.style.width = `${Math.max(0, L.target.hp / L.target.maxHp) * 100}%`;
      } else e.lock.style.display = 'none';
    } else e.lock.style.display = 'none';
  }
  applyCamera() { /* the drone's own chase camera */ }
  minimap(c, s, p) {
    for (const e of this.alive()) { c.fillStyle = e.boss ? '#ff9f0a' : '#ff453a'; c.beginPath(); c.arc(e.pos.x, e.pos.z, (e.boss ? 7 : 4.5) / s, 0, 6.283); c.fill(); }
    void p;
  }
  dispose() {
    const V = this.V;
    for (const e of this.enemies) e.mat && e.mat.dispose();
    if (this.group) { G.scene.remove(this.group); this.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
    this.enemies = []; this.bullets = []; this.missiles = []; this.rockets = []; this.flares = [];
    if (V) { V.combat = null; if (V.ret) V.ret.classList.remove('assist'); if (V.active) V.exit(); }
  }
}
// smoke, kept small and never right in front of the lens (so the fight stays readable)
function puff(p, size, dark, life) { const c = G.camera.position; if (!G.fx || c.distanceToSquared(p) < 36) return; G.fx.smokePuff(p.x, p.y, p.z, size, dark, life); }
const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

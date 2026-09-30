// Baseball at Petco Park: two nine-man teams play a real (simplified) game on the field, in the manner of the
// Chicago streetball courts: pitches, swings and misses, fouls, grounders fielded and thrown to first, line
// drives and fly balls caught or dropping in, runners going round the bases, home runs, three outs and the teams
// change over, and the scoreboard keeps up. The stands hold an instanced crowd (the Summer Smash approach) that
// sways, jumps and roars on big plays, groans when the visitors score, and does the wave in quiet spells.
// It follows Petco's game-day schedule (pregame warm-ups, the game, walking off, an empty park).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const RUN = 3.1, FIELD = 3.4, GRAV = -12;
const BASES = [[0, 0], [4.3, 0], [4.3, 4.3], [0, 4.3]];
// fielding positions (u along the first-base line, v along the third-base line): P C 1B 2B SS 3B LF CF RF
const POS = [[2.15, 2.15], [-0.42, -0.42], [4.0, 0.8], [5.3, 3.1], [3.1, 5.3], [0.8, 4.0], [4.2, 12.6], [10.2, 10.2], [12.6, 4.2]];
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0x6b3e1f, 0x4a2c17, 0xf1c27d];
// home: San Diego browns (the reference jersey) with gold trim and white pants; road greys for the visitors
const KITS = [
  { jersey: 0x3d2b20, trim: 0xffc425, pants: 0xf2efe6, cap: 0x3d2b20, capMark: 0xffc425, sock: 0x3d2b20, letter: 0xffc425 },
  { jersey: 0x9ea3a9, trim: 0x1c2945, pants: 0x9ea3a9, cap: 0x1c2945, capMark: 0xf2f2f0, sock: 0x1c2945, letter: 0x1c2945 },
];
const FANS = { shirt: [0x3d2b20, 0x3d2b20, 0xffc425, 0xf2efe6, 0xf2efe6, 0x2f241d, 0x9ea3a9, 0x1c2945, 0xe8e4dc, 0xb33a3a], skin: SKIN, pants: [0x2a3448, 0x1f1f22, 0x5a5044, 0x7b8794, 0xb8ad96] };

function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo, col = new THREE.Color(c), a = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) col.toArray(a, i);
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const cyl = (r0, r1, h, s = 7) => new THREE.CylinderGeometry(r0, r1, h, s);

// ---------- a ballplayer: body (one merged mesh) + two legs + two arms (glove on the left, bat on its own pivot) ----------
function makePlayer(scene, kit, mat, umpire = false) {
  const skin = pick(SKIN), g = new THREE.Group();
  const K = umpire ? { jersey: 0x1c1d20, trim: 0x1c1d20, pants: 0x6b6f76, cap: 0x1c1d20, capMark: 0x1c1d20, sock: 0x1c1d20, letter: 0x1c1d20 } : kit;
  const body = mergeGeometries([
    tint(cyl(0.07, 0.06, 0.25).scale(1, 1, 0.66).translate(0, 0.45, 0), K.jersey),                  // jersey
    tint(cyl(0.072, 0.072, 0.02, 10).scale(1, 1, 0.68).translate(0, 0.575, 0), K.trim),             // collar trim
    tint(new THREE.BoxGeometry(0.1, 0.028, 0.008).translate(0, 0.5, 0.047), K.letter),              // chest lettering
    tint(cyl(0.068, 0.07, 0.1).scale(1, 1, 0.7).translate(0, 0.3, 0), K.pants),                      // pants
    tint(cyl(0.07, 0.07, 0.014, 10).scale(1, 1, 0.7).translate(0, 0.355, 0), 0x1c1d20),               // belt
    tint(new THREE.SphereGeometry(0.052, 8, 6).translate(0, 0.64, 0), skin),                          // head
    tint(new THREE.SphereGeometry(0.056, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.65, 0), K.cap),   // cap
    tint(new THREE.BoxGeometry(0.07, 0.008, 0.06).translate(0, 0.652, 0.055), K.cap),                 // brim
    tint(new THREE.SphereGeometry(0.012, 5, 4).translate(0, 0.675, 0.047), K.capMark),                // cap logo
  ]);
  const b = new THREE.Mesh(body, mat); g.add(b);
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.035, 0.3, 0); g.add(p);
    p.add(new THREE.Mesh(mergeGeometries([tint(cyl(0.028, 0.024, 0.16).translate(0, -0.08, 0), K.pants), tint(cyl(0.023, 0.02, 0.13).translate(0, -0.22, 0), K.sock), tint(new THREE.BoxGeometry(0.05, 0.035, 0.09).translate(0, -0.285, 0.015), 0x111111)]), mat));
    return p;
  });
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.088, 0.55, 0); g.add(p);
    const parts = [tint(cyl(0.024, 0.022, 0.08).translate(0, -0.04, 0), K.jersey), tint(cyl(0.025, 0.025, 0.014, 8).translate(0, -0.08, 0), K.trim), tint(cyl(0.017, 0.014, 0.16).translate(0, -0.165, 0), skin)];
    if (s < 0 && !umpire) parts.push(tint(new THREE.SphereGeometry(0.038, 7, 5).scale(1, 1.2, 0.7).translate(0, -0.255, 0.01), 0x8a5a2b));   // glove
    p.add(new THREE.Mesh(mergeGeometries(parts), mat));
    return p;
  });
  // the bat hangs off a pivot between the hands
  const batPivot = new THREE.Group(); batPivot.position.set(0, 0.46, 0.08); g.add(batPivot);
  const bat = new THREE.Mesh(tint(cyl(0.016, 0.009, 0.36, 6).translate(0, 0.18, 0), 0xc89b62), mat); batPivot.add(bat);
  batPivot.visible = false;
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);
  return { g, legs, arms, batPivot, x: 0, z: 0, y: 0, h: 0, tx: 0, tz: 0, run: 0, pose: 'stand', poseT: 0, speed: RUN, umpire };
}

export class Baseball {
  constructor(scene, park) {
    this.park = park; this.H = park.H; this.wallR = park.wallR;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.teams = KITS.map((kit, t) => Array.from({ length: 9 }, (_, k) => { const p = makePlayer(scene, kit, mat); p.team = t; p.k = k; return p; }));
    this.ump = makePlayer(scene, KITS[0], mat, true);
    this.all = [...this.teams[0], ...this.teams[1], this.ump];
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf8f6f0 }));
    this.ball.castShadow = true; scene.add(this.ball);
    this.b = { p: new THREE.Vector3(), mode: 'held', holder: null };
    this.crowd = new Crowd(scene, park);
    this.score = [0, 0]; this.inning = 1; this.half = 0; this.outs = 0; this.balls = 0; this.strikes = 0;
    this.order = [0, 0]; this.bases = [null, null, null, null];
    this.st = { k: 'off', t: 0 }; this.live = false; this.waveT = rand(50, 90);
    this.hideAll();
  }
  // ---------- field coordinates ----------
  W(u, v) { return { x: this.H.x + u, z: this.H.z - v }; }
  UV(p) { return { u: p.x - this.H.x, v: this.H.z - p.z }; }
  go(p, u, v, speed = RUN) { const w = this.W(u, v); p.tx = w.x; p.tz = w.z; p.speed = speed; }
  put(p, u, v) { const w = this.W(u, v); p.x = p.tx = w.x; p.z = p.tz = w.z; }
  at(p, d = 0.1) { return Math.hypot(p.tx - p.x, p.tz - p.z) < d; }
  face(p, u, v) { const w = this.W(u, v); p.faceTo = w; }
  hideAll() { for (const p of this.all) p.g.visible = false; this.ball.visible = false; }
  fielding() { return this.teams[this.half === 0 ? 0 : 1]; }
  batting() { return this.teams[this.half === 0 ? 1 : 0]; }
  dugout(t, k) { return t === 0 ? [-1.9, 1.2 + k * 0.32] : [1.2 + k * 0.32, -1.9]; }

  // ---------- game flow ----------
  startGame() {
    this.score = [0, 0]; this.inning = 1; this.half = 0; this.outs = 0; this.balls = 0; this.strikes = 0; this.order = [0, 0];
    this.bases = [null, null, null, null]; this.live = true; this.halted = 0; this.warm = false; this.play = null;
    for (const p of this.all) { p.g.visible = true; p.gone = false; p.fly = null; p.g.rotation.set(0, 0, 0); }
    for (let t = 0; t < 2; t++) this.teams[t].forEach((p, k) => { const [u, v] = this.dugout(t, k); this.put(p, u, v); });
    this.put(this.ump, -1, -1.4);
    this.setupHalf(true);
    this.board();
  }
  setupHalf(first = false) {
    this.outs = 0; this.balls = 0; this.strikes = 0; this.bases = [null, null, null, null]; this.runners = [];
    this.halfId = (this.halfId || 0) + 1; this.play = null;
    const F = this.fielding(), Bt = this.batting();
    F.forEach((p, k) => { this.go(p, ...POS[k], first ? RUN * 0.8 : RUN * 0.7); p.role = k; p.pose = 'run'; });
    Bt.forEach((p, k) => { const [u, v] = this.dugout(p.team, k); this.go(p, u, v, RUN * 0.7); p.role = null; p.batPivot.visible = false; });
    this.go(this.ump, -0.8, -0.8, RUN * 0.6);
    this.b.mode = 'held'; this.b.holder = F[0];
    this.st = { k: 'takeField', t: 0 };
  }
  nextBatter() {
    const Bt = this.batting(), t = Bt[0].team;
    this.batter = Bt[this.order[t] % 9]; this.order[t]++;
    this.balls = 0; this.strikes = 0;
    this.go(this.batter, -0.36, 0.36, RUN * 0.8);
    this.batter.batPivot.visible = true;
    this.st = { k: 'walkup', t: 0 };
    this.board();
  }
  endHalf() {
    if (this.batter) this.batter.batPivot.visible = false;
    this.half = 1 - this.half; if (this.half === 0) this.inning++;
    this.setupHalf();
  }
  // a pitch: windup, the ball to the plate, and whatever the batter does with it
  pitch() {
    const P = this.fielding()[0];
    const swing = Math.random() < 0.55, contact = swing && Math.random() < 0.72;
    let result;
    if (!swing) result = Math.random() < (this.balls === 3 ? 0.55 : 0.5) ? 'strike' : 'ball';
    else if (!contact) result = 'miss';
    else { const r = Math.random(); result = r < 0.33 ? 'foul' : 'play'; }
    this.pitchRes = result;
    P.pose = 'windup'; P.poseT = 0;
    this.st = { k: 'windup', t: 0 };
  }
  releasePitch() {
    const P = this.fielding()[0], hand = this.hand(P);
    const plate = this.W(0.05, 0.05);
    this.b.mode = 'pitch'; this.b.from = new THREE.Vector3(hand.x, 0.62, hand.z); this.b.to = new THREE.Vector3(plate.x, 0.42, plate.z); this.b.t = 0; this.b.T = rand(0.42, 0.52);
    P.pose = 'follow'; P.poseT = 0;
    if (this.pitchRes !== 'strike' && this.pitchRes !== 'ball') { this.batter.pose = 'swing'; this.batter.poseT = -this.b.T * 0.55; }
    this.st = { k: 'pitch', t: 0 };
  }
  hand(p) { return { x: p.x + Math.sin(p.h) * 0.1 + Math.cos(p.h) * 0.09, z: p.z + Math.cos(p.h) * 0.1 - Math.sin(p.h) * 0.09 }; }
  // the ball reaches the plate
  atPlate() {
    const res = this.pitchRes, C = this.fielding()[1], near = this.near();
    if (res === 'strike' || res === 'ball' || res === 'miss') {
      this.b.mode = 'held'; this.b.holder = C; C.pose = 'catcher'; if (near) this.pop();
      if (res === 'ball') {
        this.balls++;
        if (this.balls >= 4) { this.walk(); return; }
      } else {
        this.strikes++;
        if (this.strikes >= 3) {
          this.out('K');
          if (this.half === 1) this.crowd.cheer(0.45, 2.5);             // home pitcher strikes him out
          return;
        }
      }
      this.board();
      this.st = { k: 'toss', t: 0 }; return;
    }
    if (near) this.crack(0.8);
    if (res === 'foul') {
      // off into the stands behind or down a line
      const a = pick([rand(-1.6, -0.2), rand(Math.PI / 2 + 0.2, Math.PI + 0.5)]), d = rand(7, 12);
      this.fly(a, d, rand(1.1, 1.7), rand(3, 6), 'foul');
      if (this.strikes < 2) this.strikes++;
      this.board();
      this.st = { k: 'foul', t: 0 }; return;
    }
    this.inPlay();
  }
  // a ball in the air from the plate: angle in the field, distance, hang time, peak
  fly(a, d, T, peak, kind) {
    const from = this.W(0.1, 0.1), L = this.W(Math.cos(a) * d, Math.sin(a) * d);
    this.b.mode = 'air'; this.b.kind = kind; this.b.from = new THREE.Vector3(from.x, 0.45, from.z); this.b.to = new THREE.Vector3(L.x, 0.05, L.z); this.b.t = 0; this.b.T = T; this.b.peak = peak;
    return L;
  }
  inPlay() {
    this.st = { k: 'play', t: 0 };
    const r = Math.random(), a = rand(0.08, Math.PI / 2 - 0.08), wall = this.wallR(a), F = this.fielding();
    const kind = r < 0.075 ? 'hr' : r < 0.33 ? 'flyball' : r < 0.57 ? 'liner' : 'grounder';
    this.batter.pose = 'run'; this.batter.batPivot.visible = false;
    const homeBat = this.half === 1;
    this.play = { kind, t: 0, done: false, throwAt: null };
    const fielders = F.filter((p, k) => k !== 1);
    if (kind === 'grounder') {
      // rolls out along the ground; the infielder who can get to its line first fields it, then throws to first
      const dir = { u: Math.cos(a), v: Math.sin(a) }, v0 = 11, dec = 4, tStop = v0 / (2 * dec) * 1.0;
      const pos = (t) => { t = Math.min(t, v0 / (2 * dec)); const s = v0 * t - dec * t * t; return { u: 0.1 + dir.u * s, v: 0.1 + dir.v * s }; };
      this.b.mode = 'roll'; this.b.pos = pos; this.b.t = 0; this.b.tStop = v0 / (2 * dec);
      let best = null;
      for (const f of F.filter((p, k) => [0, 2, 3, 4, 5].includes(k))) {
        const fu = this.UV(f);
        for (let t = 0.15; t < 1.6; t += 0.05) { const q = pos(t); if (Math.hypot(q.u - fu.u, q.v - fu.v) / FIELD + 0.15 <= t) { if (!best || t < best.t) best = { f, t, q }; break; } }
      }
      if (best && Math.random() < 0.82) {
        const bag = BASES[1], cover = best.f === F[2] ? F[0] : F[2];
        this.go(cover, bag[0] + 0.1, bag[1] + 0.2, FIELD);
        const throwT = Math.hypot(best.q.u - bag[0], best.q.v - bag[1]) / 13 + 0.3;
        const out = best.t + throwT < 1.75 + rand(-0.2, 0.25);
        this.go(best.f, best.q.u, best.q.v, FIELD);
        this.play.field = { f: best.f, t: best.t, to: cover, bag, out };
        this.advance(out ? 1 : 1, out ? 'groundout' : 'single');
      } else {
        // through the infield: an outfielder comes in and picks it up
        const q = pos(this.b.tStop), of = fielders.sort((m, n) => { const a1 = this.UV(m), b1 = this.UV(n); return Math.hypot(a1.u - q.u, a1.v - q.v) - Math.hypot(b1.u - q.u, b1.v - q.v); })[0];
        this.go(of, q.u, q.v, FIELD);
        this.play.retrieve = { f: of, q };
        this.advance(1, 'single');
      }
    } else {
      const d = kind === 'hr' ? wall + rand(3, 7) : kind === 'flyball' ? Math.min(wall - 0.7, rand(10, 17.5)) : Math.min(wall - 0.7, rand(7, 12.5));
      const T = kind === 'hr' ? 3.1 : kind === 'flyball' ? 2 + d * 0.05 : 0.65 + d * 0.025, peak = kind === 'hr' ? 10 : kind === 'flyball' ? 6 + d * 0.2 : 1.1;
      this.fly(a, d, T, peak, kind);
      const L = { u: Math.cos(a) * d, v: Math.sin(a) * d };
      if (kind === 'hr') {
        this.play.hr = true;
        for (const f of fielders.slice(4)) { const fu = this.UV(f); this.go(f, fu.u + (L.u - fu.u) * 0.4, fu.v + (L.v - fu.v) * 0.4, FIELD); }
        this.advance(4, 'hr');
        return;
      }
      const f = fielders.slice().sort((m, n) => { const a1 = this.UV(m), b1 = this.UV(n); return Math.hypot(a1.u - L.u, a1.v - L.v) - Math.hypot(b1.u - L.u, b1.v - L.v); })[0];
      const fu = this.UV(f), reach = Math.hypot(fu.u - L.u, fu.v - L.v) / FIELD + 0.25;
      const caught = reach <= T + 0.1 && Math.random() < (kind === 'liner' ? 0.62 : 0.88);
      this.go(f, L.u, L.v, FIELD);
      if (caught) { this.play.catch = f; this.advance(0, 'flyout'); }
      else {
        const roll = Math.min(this.wallR(a) - 0.5, d + rand(1.5, 3.5));
        this.play.retrieve = { f, q: { u: Math.cos(a) * roll, v: Math.sin(a) * roll }, afterLand: true };
        this.advance(kind === 'flyball' ? (Math.random() < 0.7 ? 2 : 3) : (Math.random() < 0.7 ? 1 : 2), 'hit');
      }
    }
  }
  // runners (and the batter) set off: n bases for everyone (forced/extra advances kept simple)
  advance(n, how) {
    const batterOut = how === 'groundout' || how === 'flyout';
    const moves = [];
    for (let b = 3; b >= 1; b--) {
      const r = this.bases[b]; if (!r) continue;
      let to = b + (how === 'flyout' ? 0 : n);
      if (how === 'single' && b === 2 && Math.random() < 0.55) to = 4;      // scores from second
      moves.push({ p: r, from: b, to: Math.min(4, to) });
    }
    if (!batterOut) moves.push({ p: this.batter, from: 0, to: Math.min(4, n) });
    this.bases = [null, null, null, null];
    for (const m of moves) if (m.to < 4) this.bases[m.to] = m.p;
    this.runners = moves.filter((m) => m.to > m.from).map((m) => ({ ...m, at: m.from, trot: how === 'hr' }));
    if (batterOut) {
      // the batter still runs it out down the line, then heads back
      this.runners.push({ p: this.batter, from: 0, to: 1, at: 0, out: true });
    }
    this.play.how = how;
  }
  walk() {
    // force: runners move up only if pushed
    const moves = [{ p: this.batter, from: 0, to: 1 }];
    if (this.bases[1]) { moves.push({ p: this.bases[1], from: 1, to: 2 }); if (this.bases[2]) { moves.push({ p: this.bases[2], from: 2, to: 3 }); if (this.bases[3]) moves.push({ p: this.bases[3], from: 3, to: 4 }); } }
    for (const m of moves) { if (this.bases[m.from] === m.p) this.bases[m.from] = null; }
    for (const m of moves) if (m.to < 4) this.bases[m.to] = m.p;
    this.runners = moves.map((m) => ({ ...m, at: m.from, jog: true }));
    this.batter.batPivot.visible = false;
    this.play = { kind: 'walk', t: 0 };
    this.st = { k: 'running', t: 0 };
    this.board();
  }
  out(why) {
    this.outs++;
    if (this.batter && why === 'K') { this.batter.batPivot.visible = false; const [u, v] = this.dugout(this.batter.team, this.batter.k); this.go(this.batter, u, v, RUN * 0.6); }
    this.board();
    if (this.outs >= 3) { this.st = { k: 'threeOut', t: 0 }; return; }
    this.st = { k: 'toss', t: 0, newBatter: true };
  }
  scoreRun(p) {
    const t = p.team; this.score[t]++;
    if (t === 0) this.crowd.cheer(0.8, 3.5); else this.crowd.groan();
    this.board();
    const [u, v] = this.dugout(t, p.k); this.go(p, u, v, RUN * 0.7);
  }

  // ---------- per frame ----------
  update(dt, phase) {
    const T = G.camTarget, near = Math.hypot(this.park.center.x - T.x, this.park.center.z - T.z) < 150;
    this.crowd.update(dt, near);
    if (phase === 'pregame' && this.halted) { this.reset(); this.crowd.revive(); }
    if (phase === 'game' && !this.live && !this.halted) this.startGame();
    if (phase === 'pregame' && !this.live) this.warmups(dt);
    // a quiet spell in the game: the wave goes round
    if (this.live && this.crowd.hype < 0.1 && (this.waveT -= dt) <= 0) { this.waveT = rand(70, 130); this.crowd.startWave(); }
    if (phase !== 'game' && this.live) this.walkOff();
    if (this.halted > 0) this.halted -= dt;
    if (this.live && !this.halted) this.step(dt);
    // everyone moves toward their target; animate only when someone could see it
    for (const p of this.all) {
      if (!p.g.visible) continue;
      if (p.fly) { this.updateFly(p, dt); continue; }
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz), moving = d > 0.05;
      if (moving) { const s = Math.min(d, p.speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.run += dt * p.speed * 5; }
      if (p.leaving && !moving) { p.g.visible = false; p.leaving = false; continue; }
      const face = moving && d > 0.15 ? Math.atan2(dx, dz) : p.faceTo ? Math.atan2(p.faceTo.x - p.x, p.faceTo.z - p.z) : p.h;
      p.h += Math.atan2(Math.sin(face - p.h), Math.cos(face - p.h)) * Math.min(1, dt * 9);
      if (near) this.pose(p, moving, dt);
      else { p.g.position.set(p.x, 0, p.z); p.g.rotation.y = p.h; }
    }
    if (this.ball.visible) this.ball.position.copy(this.b.p);
  }
  step(dt) {
    const st = this.st, F = this.fielding(), P = F[0], C = F[1];
    st.t += dt;
    // who's looking at what
    const mound = this.W(...POS[0]), home = this.W(0, 0);
    for (const f of F) if (!this.play || this.play.done || st.k === 'toss' || st.k === 'ready') f.faceTo = home;
    P.faceTo = home; C.faceTo = mound; this.ump.faceTo = mound;
    if (this.batter && ['walkup', 'ready', 'windup', 'pitch'].includes(st.k)) this.batter.faceTo = this.W(0.35, -0.35);
    // the ball follows whoever has it
    const b = this.b;
    if (b.mode === 'held' && b.holder) { const h = this.hand(b.holder); b.p.set(h.x, 0.5, h.z); }
    this.ball.visible = true;
    switch (st.k) {
      case 'takeField':
        if (st.t > 1.5 && F.every((p) => this.at(p, 0.3))) { this.nextBatter(); }
        break;
      case 'walkup':
        if (this.at(this.batter, 0.1)) { this.batter.pose = 'stance'; this.st = { k: 'ready', t: 0, wait: rand(1, 2.2) }; }
        break;
      case 'ready':
        for (const f of F.slice(2)) if (f.role != null) f.pose = 'readyField';
        C.pose = 'catcher';
        if (st.t > st.wait) this.pitch();
        break;
      case 'windup':
        if (st.t > 0.75) this.releasePitch();
        break;
      case 'pitch': {
        b.t += dt; const k = Math.min(1, b.t / b.T);
        b.p.lerpVectors(b.from, b.to, k);
        if (k >= 1) this.atPlate();
        break;
      }
      case 'toss':
        // (if the ball has somehow ended up with someone else, it goes straight to the catcher)
        if (b.mode === 'held' && b.holder !== C && b.holder !== P) b.holder = C;
        if (b.mode !== 'held' && b.mode !== 'thrown') { b.mode = 'held'; b.holder = C; }
        // catcher throws it back to the pitcher
        if (st.t > 0.5 && b.mode === 'held' && b.holder === C) this.throwTo(C, P, 0.6);
        if (b.mode === 'thrown') this.flight(dt);
        if (b.mode === 'held' && b.holder === P && st.t > 0.9) {
          if (st.newBatter) this.nextBatter();
          else { this.batter.pose = 'stance'; this.st = { k: 'ready', t: 0, wait: rand(0.8, 1.8) }; }
        }
        break;
      case 'foul':
        this.airBall(dt);
        if (st.t > 1.8) { b.mode = 'held'; b.holder = C; this.batter.pose = 'stance'; this.st = { k: 'toss', t: 0 }; }
        break;
      case 'play': case 'running':
        this.updatePlay(dt);
        break;
      case 'threeOut':
        if (st.t > 1.8) this.endHalf();
        break;
    }
    // runners on the move (walks, hits, home runs)
    if ((st.k === 'play' || st.k === 'running') && this.runners) this.moveRunners(dt);
    if (st.k === 'running' && (!this.runners || !this.runners.length) && st.t > 1) this.st = { k: 'toss', t: 0.6, newBatter: true };
  }
  airBall(dt) {
    const b = this.b; b.t += dt; const k = Math.min(1, b.t / b.T);
    b.p.lerpVectors(b.from, b.to, k); b.p.y = b.from.y + (b.to.y - b.from.y) * k + b.peak * 4 * k * (1 - k);
    return k >= 1;
  }
  throwTo(from, to, T = null) {
    const b = this.b, h = this.hand(from);
    b.mode = 'thrown'; b.holder = null; b.from = new THREE.Vector3(h.x, 0.55, h.z); b.target = to; b.t = 0;
    b.T = T ?? Math.max(0.25, Math.hypot(to.x - from.x, to.z - from.z) / 13);
    from.pose = 'throw'; from.poseT = 0;
  }
  flight(dt) {
    const b = this.b, to = this.hand(b.target); b.t += dt; const k = Math.min(1, b.t / b.T);
    b.p.set(b.from.x + (to.x - b.from.x) * k, 0.55 + Math.sin(Math.PI * k) * (0.2 + b.T * 0.6), b.from.z + (to.z - b.from.z) * k);
    if (k >= 1) { b.mode = 'held'; b.holder = b.target; if (this.near()) this.pop(0.5); return true; }
    return false;
  }
  updatePlay(dt) {
    const pl = this.play, b = this.b, F = this.fielding();
    if (!pl) return;
    pl.t += dt;
    if (this.st.k === 'running') return;
    if (this.st.k !== 'play') this.st = { k: 'play', t: 0 };
    if (b.mode === 'air') {
      const landed = this.airBall(dt);
      if (pl.catch && this.at(pl.catch, 0.4)) pl.catch.pose = 'catchHigh';
      if (landed) {
        if (pl.catch) {
          b.mode = 'held'; b.holder = pl.catch; if (this.near()) this.pop(0.6);
          this.out('fly'); if (this.outs < 3) this.st = { k: 'play', t: 0 };
          if (this.half === 1) this.crowd.cheer(0.35, 2);
          pl.returning = true;
        } else if (pl.hr) {
          b.mode = 'gone'; this.ball.visible = false; this.homeRun();
        } else { b.mode = 'loose'; b.p.copy(b.to); }
      }
    } else if (b.mode === 'roll') {
      b.t += dt; const q = b.pos(b.t), w = this.W(q.u, q.v); b.p.set(w.x, 0.05, w.z);
      const fd = pl.field;
      if (fd && b.t >= fd.t && Math.hypot(fd.f.x - w.x, fd.f.z - w.z) < 0.45) {
        b.mode = 'held'; b.holder = fd.f; fd.f.pose = 'readyField';
        const hid = this.halfId;
        setTimeout(() => { if (this.b.holder === fd.f && this.play === pl && hid === this.halfId) this.throwTo(fd.f, fd.to); }, 280);
        pl.throwing = true;
      }
      if (b.t > b.tStop + 0.2 && !fd) { b.mode = 'loose'; }
    } else if (b.mode === 'loose' && pl.retrieve) {
      const f = pl.retrieve.f, w = this.W(pl.retrieve.q.u, pl.retrieve.q.v);
      if (pl.retrieve.afterLand && !pl.retrieve.rolled) { pl.retrieve.rolled = true; }
      b.p.lerp(new THREE.Vector3(w.x, 0.05, w.z), Math.min(1, dt * 2));
      if (Math.hypot(f.x - b.p.x, f.z - b.p.z) < 0.4) { b.mode = 'held'; b.holder = f; this.throwTo(f, f === F[4] ? F[3] : F[4]); pl.returning = true; }
      else this.go(f, this.UV(b.p).u, this.UV(b.p).v, FIELD);
    } else if (b.mode === 'thrown') {
      if (this.flight(dt) && pl.field && b.holder === pl.field.to && !pl.field.called) {
        pl.field.called = true;
        if (pl.field.out) { this.out('ground'); if (this.outs < 3) this.st = { k: 'play', t: 0 }; if (this.half === 1) this.crowd.cheer(0.3, 1.5); }
        pl.returning = true;
      }
    }
    // everyone back to position once the ball is dead and the runners have stopped
    if (pl.returning && !this.runners.length && b.mode === 'held' && !pl.done) {
      pl.done = true;
      F.forEach((f, k) => this.go(f, ...POS[k], RUN * 0.7));
      const hid = this.halfId;
      setTimeout(() => {
        if (this.play !== pl || !this.live || this.outs >= 3 || hid !== this.halfId) return;
        this.b.mode = 'held'; this.b.holder = F[0];
        this.st = { k: 'toss', t: 0.9, newBatter: true };
      }, 1600);
    }
    // a home run: once they're all round, play on
    if (pl.hr && !this.runners.length && !pl.done) {
      pl.done = true; F.forEach((f, k) => this.go(f, ...POS[k], RUN * 0.7));
      const hid = this.halfId;
      setTimeout(() => { if (this.play === pl && this.live && hid === this.halfId) { this.b.mode = 'held'; this.b.holder = F[0]; this.ball.visible = true; this.st = { k: 'toss', t: 0.9, newBatter: true }; } }, 1200);
    }
    if (pl.t > 14 && !pl.done) { pl.done = true; this.runners = []; this.b.mode = 'held'; this.b.holder = F[0]; this.st = { k: 'toss', t: 0.9, newBatter: true }; }   // safety net
  }
  moveRunners(dt) {
    for (const r of [...this.runners]) {
      const p = r.p, next = Math.min(4, r.at + 1), [bu, bv] = BASES[next % 4];
      if (r.out && next === 1 && this.st.k === 'play' && this.play && (this.play.how === 'flyout') && this.play.t > 1.2) { this.back(r); continue; }
      this.go(p, bu + (next === 1 ? 0.15 : 0), bv, r.trot ? RUN * 0.75 : r.jog ? RUN * 0.6 : RUN);
      p.pose = 'run';
      if (this.at(p, 0.08)) {
        r.at = next;
        if (r.at === 4) { this.runners.splice(this.runners.indexOf(r), 1); this.scoreRun(p); continue; }
        if (r.at >= r.to) {
          this.runners.splice(this.runners.indexOf(r), 1);
          if (r.out) { this.back(r, true); continue; }
          p.pose = 'lead'; p.faceTo = this.W(...POS[0]);
        }
      }
    }
  }
  back(r, arrived = false) { const k = this.runners.indexOf(r); if (k >= 0) this.runners.splice(k, 1); const [u, v] = this.dugout(r.p.team, r.p.k); this.go(r.p, u, v, RUN * 0.6); r.p.pose = 'run'; }
  homeRun() {
    const home = this.half === 1, c = this.park.center;
    if (home) {
      this.crowd.cheer(1, 6);
      // fireworks over centre field
      for (let k = 0; k < 6; k++) setTimeout(() => { const x = c.x + rand(-6, 6), z = c.z + rand(-6, 6), y = rand(14, 20); G.fx.flash(x, y, z, pick([0xffc425, 0xffffff, 0xff6a3a]), 60, 0.3, 40); G.fx.sparks(x, y, z, 40, 6, 5, 3, 6); if (this.near()) sfx.pyro && sfx.pyro(x, z, true); }, k * 350);
    } else this.crowd.groan();
    G.news && G.news.post('SPORTS', home ? 'Home run! San Diego goes deep at Petco Park' : 'Visitors homer at Petco Park; the crowd goes quiet', 1.5, 'hr');
  }
  walkOff() {
    // game over (or called): both teams head for the dugouts and out of sight
    this.live = false; this.runners = []; this.ball.visible = false;
    for (const p of this.all) { if (!p.g.visible) continue; const [u, v] = p.umpire ? [-2.4, -2.4] : this.dugout(p.team, p.k); this.go(p, u, v, RUN * 0.6); p.leaving = true; p.batPivot.visible = false; p.pose = 'run'; }
  }
  warmups(dt) {
    // pregame: the home side plays catch along the lines
    if (!this.warm) {
      this.warm = true;
      this.teams[0].forEach((p, k) => { p.g.visible = true; p.gone = false; const u = 1 + (k % 5) * 1.3, v = k < 5 ? 0.8 : 2.6; this.put(p, u, v); p.faceTo = this.W(u, k < 5 ? 2.6 : 0.8); p.pose = 'readyField'; });
    }
    if ((this.warmT = (this.warmT || 0) - dt) <= 0) { this.warmT = rand(0.6, 1.2); const p = pick(this.teams[0]); p.pose = 'throw'; p.poseT = 0; }
  }
  near() { return Math.hypot(this.park.center.x - G.camTarget.x, this.park.center.z - G.camTarget.z) < 90; }

  // ---------- poses ----------
  pose(p, moving, dt) {
    p.poseT += dt;
    const r = moving ? Math.sin(p.run) : 0, A = p.arms, L = p.legs;
    let y = 0, lean = 0;
    for (const a of A) a.rotation.set(0, 0, 0);
    L[0].rotation.set(r * 0.8, 0, 0); L[1].rotation.set(-r * 0.8, 0, 0);
    p.batPivot.rotation.set(0, 0, 0);
    if (moving) { A[0].rotation.x = -r * 0.7; A[1].rotation.x = r * 0.7; lean = 0.15; }
    else switch (p.pose) {
      case 'catcher': y = -0.13; L[0].rotation.set(-1.25, 0, 0.35); L[1].rotation.set(-1.25, 0, -0.35); A[0].rotation.set(-1.3, 0, 0.1); A[1].rotation.set(-0.4, 0, 0); break;
      case 'readyField': y = -0.04; lean = 0.35; L[0].rotation.z = 0.25; L[1].rotation.z = -0.25; A[0].rotation.set(-0.7, 0, 0.1); A[1].rotation.set(-0.7, 0, -0.1); break;
      case 'lead': y = -0.02; lean = 0.25; L[0].rotation.z = 0.3; L[1].rotation.z = -0.3; A[0].rotation.set(-0.3, 0, 0.3); A[1].rotation.set(-0.3, 0, -0.3); break;
      case 'windup': { const k = Math.min(1, p.poseT / 0.75); L[1].rotation.x = -1.1 * Math.sin(Math.PI * Math.min(1, k * 1.3)); A[1].rotation.x = 1.2 * k; A[0].rotation.x = -1.2 * Math.sin(Math.PI * k); break; }
      case 'follow': case 'throw': { const k = Math.min(1, p.poseT / 0.35); A[1].rotation.x = 2.4 - 4.2 * k; lean = 0.35 * k; L[0].rotation.x = -0.5 * k; if (p.poseT > 0.8) p.pose = p.role != null ? 'readyField' : 'stand'; break; }
      case 'stance': p.batPivot.rotation.set(0.9, 0, -0.5); A[0].rotation.set(-1.0, 0, 0.5); A[1].rotation.set(-1.2, 0, -0.2); L[0].rotation.z = 0.2; L[1].rotation.z = -0.2; break;
      case 'swing': { const k = Math.max(0, Math.min(1, p.poseT / 0.18)); p.batPivot.rotation.set(0.9 - k * 0.5, -k * 3.2, -0.5 + k * 1.9); A[0].rotation.set(-1.1, -k * 1.6, 0.5); A[1].rotation.set(-1.2, -k * 1.6, -0.2); break; }
      case 'catchHigh': A[0].rotation.set(-2.8, 0, 0.1); A[1].rotation.set(-2.6, 0, -0.1); break;
      case 'celebrate': A[0].rotation.set(-2.9, 0, 0.4); A[1].rotation.set(-2.9, 0, -0.4); break;
    }
    if (p.umpire && !moving) { y = -0.07; lean = 0.45; A[0].rotation.set(-0.3, 0, 0.3); A[1].rotation.set(-0.3, 0, -0.3); }
    p.g.position.set(p.x, y, p.z); p.g.rotation.set(lean * 0.4, p.h, 0, 'YXZ');
  }
  updateFly(p, dt) {
    const f = p.fly;
    f.v.y -= 14 * dt; p.x += f.v.x * dt; p.z += f.v.z * dt; p.y += f.v.y * dt; f.rot += f.spin * dt;
    if (p.y <= 0 && f.v.y < 0) { p.y = 0.04; p.g.rotation.set(Math.PI / 2, p.h, 0, 'YXZ'); p.g.position.set(p.x, p.y, p.z); p.fly = null; p.tx = p.x; p.tz = p.z; if (G.gore && G.gore.on) G.gore.pool(p.x, p.z, rand(0.3, 0.45)); return; }
    p.g.position.set(p.x, p.y, p.z); p.g.rotation.set(f.rot, p.h, 0, 'YXZ');
  }
  // ---------- a blast in the park: the game's off ----------
  onBlast(x, y, z, r, power) {
    const c = this.park.center;
    if (Math.hypot(x - c.x, z - c.z) > 34 || power < 1.5) return false;
    this.crowd.onBlast(x, y, z, r, power);
    if (!this.live && !this.all.some((p) => p.g.visible)) return true;
    for (const p of this.all) {
      if (!p.g.visible) continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz) + 0.01;
      if (d < r * 0.45) { const f = power * (1 - d / (r * 0.45)); p.fly = { v: new THREE.Vector3(dx / d * f, f * 0.9 + 1, dz / d * f), rot: 0, spin: rand(-8, 8) }; p.y = 0.1; continue; }
    }
    this.live = false; this.halted = 999; this.runners = []; this.ball.visible = false;
    // everyone else runs for the tunnels
    for (const p of this.all) if (p.g.visible && !p.fly) { const [u, v] = p.umpire ? [-2.4, -2.4] : this.dugout(p.team, p.k); this.go(p, u, v, RUN * 1.2); p.leaving = true; p.batPivot.visible = false; }
    return true;
  }
  reset() { this.halted = 0; this.warm = false; for (const p of this.all) { p.fly = null; p.leaving = false; p.g.visible = false; p.g.rotation.set(0, 0, 0); } }

  // ---------- sounds ----------
  crack(v = 1) { const w0 = this.W(0, 0); if (sfx.bat && sfx.bat(w0.x, w0.z, v)) return; const I = sfx._internals(); if (!I.ctx) return; const w = this.W(0, 0), ch = I.chain(w.x, w.z, { vol: 1.2 * v }), t = I.ctx.currentTime; I.burst(ch.input, t, { type: 'highpass', f: 2200, a: 0.001, peak: 0.9, d: 0.05 }); I.tone(ch.input, t, { type: 'triangle', f: 1500, a: 0.001, peak: 0.25, d: 0.07 }); }
  pop(v = 0.8) { const I = sfx._internals(); if (!I.ctx) return; const w = this.W(-0.4, -0.4), ch = I.chain(w.x, w.z, { vol: v }), t = I.ctx.currentTime; I.burst(ch.input, t, { type: 'lowpass', f: 700, a: 0.001, peak: 0.7, d: 0.05 }); }

  // ---------- the video board ----------
  board() {
    const m = this.park.board && this.park.board.material.map; if (!m) return;
    const c = m.image, x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#111'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2f241d'; x.fillRect(8, 8, w * 0.52, h - 16);
    x.fillStyle = '#ffc425'; x.font = `900 ${h * 0.3}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('PADRES', 8 + w * 0.26, h * 0.38);
    x.font = `600 ${h * 0.11}px Inter, Arial`; x.fillStyle = '#f2efe6';
    x.fillText(`${this.half === 0 ? 'TOP' : 'BOT'} ${this.inning}  ·  ${this.outs} OUT${this.outs === 1 ? '' : 'S'}`, 8 + w * 0.26, h * 0.7);
    x.fillText(`BALLS ${this.balls}  STRIKES ${this.strikes}`, 8 + w * 0.26, h * 0.85);
    x.textAlign = 'left'; x.font = `800 ${h * 0.16}px Inter, Arial`;
    [['VIS', this.score[1]], ['SD', this.score[0]]].forEach(([a, s], i) => {
      x.fillStyle = a === 'SD' ? '#ffc425' : '#9ea3a9'; x.fillText(a, w * 0.6, h * (0.32 + i * 0.34));
      x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(String(s), w * 0.95, h * (0.32 + i * 0.34)); x.textAlign = 'left';
    });
    m.needsUpdate = true;
  }
}

// ---------- the crowd in the stands ----------
function fanGeo() {
  const parts = [];
  const put = (g, part) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); n.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count).fill(part), 1)); parts.push(n); };
  put(new THREE.CylinderGeometry(0.066, 0.056, 0.24, 5).scale(1, 1, 0.62).translate(0, 0.43, 0), 0);
  put(new THREE.IcosahedronGeometry(0.052, 0).translate(0, 0.62, 0), 1);
  for (const s of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.018, 0.015, 0.25, 3, 1, true).translate(0, 0.125, 0).rotateZ(-s * 0.38).translate(s * 0.07, 0.52, 0), 1);
    put(new THREE.CylinderGeometry(0.028, 0.021, 0.31, 4, 1, true).translate(s * 0.034, 0.155, 0), 2);
  }
  return mergeGeometries(parts);
}
class Crowd {
  constructor(scene, park) {
    const pts = [], path = park.path, rows = park.seatRows;
    for (let i = 0; i < path.length; i++) {
      if (i % 12 === 0) continue;                                       // aisles
      const p = path[i];
      for (const r of rows) {
        if (Math.random() > 0.82) continue;
        pts.push([p.x + p.nx * r.o + rand(-0.05, 0.05), r.y, p.z + p.nz * r.o + rand(-0.05, 0.05), Math.atan2(-p.nx, -p.nz) + rand(-0.25, 0.25), i / path.length]);
      }
    }
    const n = pts.length, g = fanGeo();
    this.N = n; this.pts = pts;
    const col = new THREE.Color();
    for (const [k, pal] of [['aC0', FANS.shirt], ['aC1', FANS.skin], ['aC2', FANS.pants]]) {
      const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(pick(pal)).toArray(a, i * 3);
      g.setAttribute(k, new THREE.InstancedBufferAttribute(a, 3));
    }
    const seed = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { seed[i * 4] = Math.random(); seed[i * 4 + 1] = rand(0.08, 0.2); seed[i * 4 + 2] = Math.random() < 0.6 ? 1 : 0; seed[i * 4 + 3] = pts[i][4]; }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    this.U = { uT: { value: 0 }, uHype: { value: 0.05 }, uWave: { value: -1 }, uArms: { value: 0 } };
    const mat = new THREE.MeshLambertMaterial();
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aPart; attribute vec3 aC0; attribute vec3 aC1; attribute vec3 aC2; attribute vec4 aSeed; varying vec3 vFan;
          uniform float uT; uniform float uHype; uniform float uWave; uniform float uArms;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vFan = aPart < 0.5 ? aC0 : aPart < 1.5 ? aC1 : aC2;
          float f = fract(uT * 1.9 + aSeed.x);
          float hop = pow(sin(3.14159 * f), 0.8);
          float wave = uWave < 0.0 ? 0.0 : exp(-pow((aSeed.w - uWave) * 16.0, 2.0));
          transformed.y += uHype * aSeed.y * mix(0.25, 1.0, aSeed.z) * hop + wave * 0.13;
          transformed.x += sin(uT * 1.2 + aSeed.x * 6.28) * 0.008;
          // arms: pumped when cheering, straight up in the wave
          if (position.y > 0.5 && abs(position.x) > 0.06) transformed.y += uHype * 0.06 * hop + (wave + uArms * aSeed.z) * 0.12;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFan;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vFan;');
    };
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    this.rank = Array.from({ length: n }, () => Math.random());
    this.gone = new Uint8Array(n);
    this.fill = -1; this.setFill(1);
    scene.add(this.mesh);
    this.hype = 0.05; this.hypeT = 0; this.arms = 0; this.wave = -1;
    this.center = park.center;
  }
  place(i, show) {
    const [x, y, z, yaw] = this.pts[i];
    if (!show || this.gone[i]) _m.makeScale(0, 0, 0);
    else _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, yaw), _s.set(1, 1, 1));
    this.mesh.setMatrixAt(i, _m);
  }
  setFill(f) {
    if (Math.abs(f - this.fill) < 0.02) return;
    this.fill = f;
    for (let i = 0; i < this.N; i++) this.place(i, this.rank[i] < f);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  cheer(level, dur) {
    this.hype = Math.max(this.hype, level); this.hypeT = dur; this.arms = level > 0.6 ? 1 : 0.4;
    const c = this.center;
    if (!(sfx.cheer && sfx.cheer(c.x, c.z, level)) && G.ambience && G.ambience.stadium) { G.ambience.stadium(); if (level > 0.6) setTimeout(() => G.ambience.stadium(), 700); }
  }
  groan() { this.hype = 0.02; this.hypeT = 2; this.arms = 0; }
  onBlast(x, y, z, r, power) {
    const kill = r * 0.5;
    for (let i = 0; i < this.N; i++) {
      const [px, , pz] = this.pts[i];
      if (Math.hypot(px - x, pz - z) < kill && !this.gone[i]) { this.gone[i] = 1; this.place(i, false); if (G.gore && G.gore.on && Math.random() < 0.15) G.gore.pool(px, pz, rand(0.2, 0.35)); }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.hype = 0; this.hypeT = 0; this.arms = 0; this.wave = -1;
  }
  revive() { this.gone.fill(0); const f = this.fill; this.fill = -1; this.setFill(f); }
  update(dt, near) {
    this.U.uT.value += dt;
    if (this.hypeT > 0) this.hypeT -= dt; else this.hype += (0.05 - this.hype) * Math.min(1, dt * 1.5);
    this.arms = Math.max(0, this.arms - dt * 0.4);
    this.U.uHype.value = this.hype; this.U.uArms.value = this.arms;
    // the wave rolls round the bowl now and then in a quiet spell
    if (this.wave >= 0) { this.wave += dt / 7; if (this.wave > 1.15) this.wave = -1; }
    this.U.uWave.value = this.wave;
  }
  startWave() { if (this.wave < 0 && this.fill > 0.5) this.wave = -0.1; }
}
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

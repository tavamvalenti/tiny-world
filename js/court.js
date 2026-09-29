// Streetball courts in Chicago, north of the festival: two outdoor courts behind a tall chain-link fence,
// a graffiti-covered concrete wall, light poles, benches and spectators. Each court runs a live 3-on-3 game:
// dribbling, passing, jump shots and dunks, makes and clanks, rebounds and possession changes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const M = 0.41;                                   // world units per metre (people are ~0.8 tall)
const L = 28 * M, W = 15 * M, RIM_Y = 3.05 * M, GRAV = -6;
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0x6b3e1f, 0x4a2c17, 0xf1c27d];

// two courts side by side inside the fenced area
export function courtLayout(area) {
  const cz = area.z0 + 1.6 + W / 2;
  const cx1 = area.x0 + 0.6 + L / 2, cx2 = cx1 + L + 1.1;
  return [{ cx: cx1, cz }, { cx: cx2, cz }];
}

// painted surfaces: faded red court, tan keys, white lines, asphalt around
export function paintCourts(g, area) {
  g.rect(area.x0, area.z0, area.x1, area.z1, '#4a4947');
  g.grainRect(area.x0, area.z0, area.x1, area.z1, 0.4, 50);
  const X = g.x, K = g.k;
  for (const { cx, cz } of courtLayout(area)) {
    g.rect(cx - L / 2 - 0.3, cz - W / 2 - 0.3, cx + L / 2 + 0.3, cz + W / 2 + 0.3, '#8a4e44');
    g.rect(cx - L / 2, cz - W / 2, cx + L / 2, cz + W / 2, '#a8604f');
    for (const s of [-1, 1]) g.rect(Math.min(cx + s * L / 2, cx + s * (L / 2 - 5.8 * M)), cz - 2.45 * M, Math.max(cx + s * L / 2, cx + s * (L / 2 - 5.8 * M)), cz + 2.45 * M, '#c2956f');
    g.grainRect(cx - L / 2, cz - W / 2, cx + L / 2, cz + W / 2, 0.45, 60);
    X.save(); X.strokeStyle = 'rgba(240,236,228,.85)'; X.lineWidth = 0.06 * K;
    X.strokeRect(g.px(cx - L / 2), g.px(cz - W / 2), L * K, W * K);
    X.beginPath(); X.moveTo(g.px(cx), g.px(cz - W / 2)); X.lineTo(g.px(cx), g.px(cz + W / 2)); X.stroke();
    X.beginPath(); X.arc(g.px(cx), g.px(cz), 1.8 * M * K, 0, 6.283); X.stroke();
    for (const s of [-1, 1]) {
      const hx = cx + s * (L / 2 - 1.575 * M);
      X.strokeRect(g.px(Math.min(cx + s * L / 2, cx + s * (L / 2 - 5.8 * M))), g.px(cz - 2.45 * M), 5.8 * M * K, 4.9 * M * K);
      X.beginPath(); X.arc(g.px(cx + s * (L / 2 - 5.8 * M)), g.px(cz), 1.8 * M * K, 0, 6.283); X.stroke();
      X.beginPath(); X.arc(g.px(hx), g.px(cz), 6.75 * M * K, s > 0 ? Math.PI / 2 + 0.22 : -Math.PI / 2 + 0.22, s > 0 ? Math.PI * 1.5 - 0.22 : Math.PI / 2 - 0.22); X.stroke();
    }
    // worn patches and cracks
    for (let k = 0; k < 18; k++) { X.fillStyle = `rgba(70,55,50,${rand(0.15, 0.35)})`; X.beginPath(); X.ellipse(g.px(cx + rand(-L / 2, L / 2)), g.px(cz + rand(-W / 2, W / 2)), rand(0.2, 0.9) * K, rand(0.1, 0.5) * K, rand(0, 3), 0, 6.283); X.fill(); }
    X.strokeStyle = 'rgba(40,32,30,.6)'; X.lineWidth = 0.035 * K;
    for (let k = 0; k < 6; k++) { let px = cx + rand(-L / 2, L / 2), pz = cz + rand(-W / 2, W / 2); X.beginPath(); X.moveTo(g.px(px), g.px(pz)); for (let j = 0; j < 5; j++) { px += rand(-0.6, 0.6); pz += rand(-0.6, 0.6); X.lineTo(g.px(px), g.px(pz)); } X.stroke(); }
    X.restore();
  }
}

function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo;
  const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function chainLinkTex() {
  const t = canvasTex(64, 64, (x) => {
    // a faint base so the mesh still reads as a grey haze from far away (where the wires average out)
    x.clearRect(0, 0, 64, 64); x.fillStyle = 'rgba(150,156,162,0.22)'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(190,196,202,1)'; x.lineWidth = 5;
    for (const k of [-64, 0, 64]) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function graffitiTex() {
  return canvasTex(1024, 96, (x, w, h) => {
    x.fillStyle = '#5a5b5d'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let i = (y / 16) % 2 ? -20 : 0; i < w; i += 40) { x.strokeStyle = 'rgba(0,0,0,.22)'; x.strokeRect(i, y, 40, 16); }
    const words = ['773', 'SMASH', 'CHI', 'DRILL', 'OMERTA', 'SOUTHSIDE', 'O-BLOCK', 'KRONIK'];
    const cols = ['#35c6b4', '#e84393', '#f2f2f2', '#f7e531', '#2a6fb5', '#e8453c', '#8e5cf0'];
    let px = 10;
    while (px < w - 60) {
      const word = pick(words), size = rand(34, 58);
      x.save(); x.translate(px, h * rand(0.55, 0.75)); x.rotate(rand(-0.12, 0.08));
      x.font = `900 ${size}px Impact, "Arial Black", sans-serif`; x.lineJoin = 'round';
      x.lineWidth = 9; x.strokeStyle = '#111'; x.strokeText(word, 0, 0);
      x.fillStyle = pick(cols); x.fillText(word, 0, 0);
      x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.7)'; x.strokeText(word, 0, 0);
      const wd = x.measureText(word).width; x.restore();
      px += wd + rand(12, 40);
    }
    // scribbled tags on top
    for (let k = 0; k < 14; k++) { x.strokeStyle = pick(['#111', '#fff', '#e84393']); x.lineWidth = 2; x.beginPath(); let a = rand(0, w), b = rand(8, h - 8); x.moveTo(a, b); for (let j = 0; j < 6; j++) { a += rand(4, 14); b += rand(-10, 10); x.lineTo(a, b); } x.stroke(); }
  });
}

function makePlayer(scene, jersey, shorts, trim) {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const g = new THREE.Group(), skin = mat(pick(SKIN));
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.25, 7).scale(1, 1, 0.65), mat(jersey)); t.position.y = 0.45; g.add(t);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.1, 7).scale(1, 1, 0.7), mat(shorts)); sh.position.y = 0.3; g.add(sh);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), skin); h.position.y = 0.64; g.add(h);
  if (trim != null && Math.random() < 0.5) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 10).rotateX(Math.PI / 2), mat(trim)); b.position.y = 0.66; g.add(b); }
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.034, 0.3, 0); g.add(p);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.28, 5).translate(0, -0.14, 0), skin); p.add(l);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.09), mat(trim ?? 0xf2f2f0)); shoe.position.set(0, -0.285, 0.015); p.add(shoe);
    return p;
  });
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.085, 0.55, 0); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.015, 0.25, 5).translate(0, -0.125, 0), skin); p.add(a); g.add(p); return p; });
  g.scale.setScalar(1.2);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);
  return { g, legs, arms, x: 0, z: 0, y: 0, h: 0, tx: 0, tz: 0, jumpT: 0, jumpDur: 0.5, jumpH: 0.2, spotT: 0, run: 0 };
}

const HAND = (p, up = false) => ({ x: p.x + Math.sin(p.h) * 0.13 + Math.cos(p.h) * 0.1, y: p.y + (up ? 0.98 : 0.5), z: p.z + Math.cos(p.h) * 0.13 - Math.sin(p.h) * 0.1 });

class Game {
  constructor(scene, cx, cz, ballMat) {
    this.cx = cx; this.cz = cz; this.time = rand(0, 5);
    this.hoops = [-1, 1].map((s) => ({ s, x: cx + s * (L / 2 - 1.575 * M), y: RIM_Y, z: cz, net: null }));
    const kits = [[0x2a4fbf, 0xe8453c, 0xe8453c], [0xf2f2f0, 0x1c1d20, 0x1c1d20]];
    this.players = [];
    for (let team = 0; team < 2; team++) for (let k = 0; k < 3; k++) {
      const [j, s, trim] = kits[team];
      const p = makePlayer(scene, team === 1 && Math.random() < 0.4 ? pick([0x6b6f76, 0x1c1d20, 0x8a2b2b]) : j, s, trim);
      p.team = team; p.k = k;
      this.players.push(p);
    }
    this.ball = { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), ballMat), p: new THREE.Vector3(cx, 0.1, cz), v: new THREE.Vector3(), mode: 'loose', holder: null, lock: null, t: 0, stuck: 0, prevDrib: 0 };
    this.ball.mesh.castShadow = true; scene.add(this.ball.mesh);
    this.reset();
  }
  reset() {
    this.players.forEach((p) => {
      p.x = this.cx + (p.team ? 1 : -1) * rand(0.6, 2.5); p.z = this.cz + rand(-W / 3, W / 3); p.y = 0; p.jumpT = 0;
      p.tx = p.x; p.tz = p.z; p.g.visible = true; p.g.rotation.set(0, 0, 0); p.gone = false; p.flee = null; p.fly = null;
    });
    this.poss = Math.random() < 0.5 ? 0 : 1;
    this.give(this.players[this.poss * 3]);
  }
  attack(team) { return this.hoops[team === 0 ? 1 : 0]; }
  give(p) {
    const b = this.ball; b.mode = 'held'; b.holder = p; b.lock = null; b.stuck = 0;
    this.poss = p.team; p.decide = rand(1.5, 3.5); p.dunk = false;
    const hp = this.attack(p.team), a = rand(-1.1, 1.1), d = rand(1.0, 2.8);
    p.spot = { x: hp.x - hp.s * Math.cos(a) * d, z: this.cz + Math.sin(a) * d };
  }
  inCourt(x, z) { return { x: Math.max(this.cx - L / 2 + 0.15, Math.min(this.cx + L / 2 - 0.15, x)), z: Math.max(this.cz - W / 2 + 0.15, Math.min(this.cz + W / 2 - 0.15, z)) }; }

  shoot(p, dunk) {
    const b = this.ball, hp = this.attack(p.team);
    const d = Math.hypot(hp.x - p.x, hp.z - p.z);
    b.make = Math.random() < (dunk ? 0.92 : Math.max(0.3, Math.min(0.72, 0.8 - d * 0.14)));
    const from = HAND(p, true); from.y += dunk ? 0.5 : 0.15;
    const a = rand(0, 6.28), miss = b.make ? 0 : 0.15;
    b.to = new THREE.Vector3(hp.x + Math.cos(a) * miss, hp.y + 0.03, hp.z + Math.sin(a) * miss);
    b.from = new THREE.Vector3(from.x, from.y, from.z);
    b.T = dunk ? 0.22 : 0.55 + d * 0.13; b.t = 0;
    b.v0 = b.to.clone().sub(b.from).addScaledVector(new THREE.Vector3(0, GRAV, 0), -0.5 * b.T * b.T).divideScalar(b.T);
    b.mode = 'shot'; b.holder = null; b.shooter = p; b.hoop = hp; b.dunk = dunk;
    p.jumpT = p.jumpDur = dunk ? 0.7 : 0.5; p.jumpH = dunk ? 0.55 : 0.22;
  }
  pass(p, to) {
    const b = this.ball, f = HAND(p), t = HAND(to);
    b.mode = 'pass'; b.holder = null; b.from = new THREE.Vector3(f.x, f.y, f.z); b.passTo = to; b.t = 0; b.T = 0.35 + Math.hypot(t.x - f.x, t.z - f.z) * 0.06;
  }

  update(dt, near, halted) {
    this.time += dt;
    const b = this.ball, off = this.poss, carrier = b.mode === 'held' ? b.holder : null;
    const hp = this.attack(off);
    // ---- decide where everyone wants to be ----
    const chasers = new Set();
    if (b.mode === 'loose' || b.mode === 'drop') {
      const cand = this.players.filter((p) => !p.gone && (b.lock == null || p.team === b.lock)).sort((a, c) => Math.hypot(a.x - b.p.x, a.z - b.p.z) - Math.hypot(c.x - b.p.x, c.z - b.p.z));
      cand.slice(0, 2).forEach((p) => chasers.add(p));
    }
    for (const p of this.players) {
      if (p.gone || p.fly || p.flee) continue;
      if (halted) { p.tx = p.x; p.tz = p.z; continue; }
      if (chasers.has(p)) { p.tx = b.p.x; p.tz = b.p.z; }
      else if (p === carrier) {
        if (p.dunk) { p.tx = hp.x - hp.s * 0.3; p.tz = hp.z; } else if (p.spot) { p.tx = p.spot.x; p.tz = p.spot.z; }
      } else if (p.team === off) {
        if ((p.spotT -= dt) <= 0 || !p.spot) { const a = rand(-1.3, 1.3), d = rand(1.4, 3.3); p.spot = { x: hp.x - hp.s * Math.cos(a) * d, z: this.cz + Math.sin(a) * d }; p.spotT = rand(1.8, 3.5); }
        p.tx = p.spot.x; p.tz = p.spot.z;
      } else {
        const mark = this.players[off * 3 + p.k];
        const dx = hp.x - mark.x, dz = hp.z - mark.z, d = Math.hypot(dx, dz) || 1;
        p.tx = mark.x + dx / d * 0.42; p.tz = mark.z + dz / d * 0.42; p.mark = mark;
      }
      const c = this.inCourt(p.tx, p.tz); p.tx = c.x; p.tz = c.z;
    }
    // ---- move + animate ----
    for (const p of this.players) {
      if (p.gone) continue;
      if (p.fly) { this.updateFly(p, dt); continue; }
      if (p.flee) {
        const f = p.flee, dx = f.x - p.x, dz = f.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { if (f.next) { p.flee = f.next; } else { p.gone = true; p.g.visible = false; continue; } }
        else { const s = Math.min(d, 2.6 * dt); p.x += dx / d * s; p.z += dz / d * s; p.h = Math.atan2(dx, dz); p.run += dt * 16; }
        this.pose(p, true, false); continue;
      }
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      const sp = p === carrier ? 1.4 : p.team === off ? 1.8 : 1.9;
      const moving = d > 0.08;
      if (moving) { const s = Math.min(d, sp * dt); p.x += dx / d * s; p.z += dz / d * s; p.run += dt * 15; }
      // run where you're going; otherwise offense faces the rim and defenders square up to their man
      const face = moving && d > 0.3 ? Math.atan2(dx, dz) : p.team === off || !p.mark ? Math.atan2(hp.x - p.x, hp.z - p.z) : Math.atan2(p.mark.x - p.x, p.mark.z - p.z);
      p.h += Math.atan2(Math.sin(face - p.h), Math.cos(face - p.h)) * Math.min(1, dt * 10);
      if (p.jumpT > 0) { p.jumpT = Math.max(0, p.jumpT - dt); p.y = p.jumpH * Math.sin(Math.PI * (1 - p.jumpT / p.jumpDur)); } else p.y = 0;
      this.pose(p, moving, p === carrier);
    }
    // ---- the ball ----
    b.stuck += dt;
    if (b.mode === 'held') {
      const p = b.holder, hand = HAND(p);
      const ph = Math.abs(Math.sin(this.time * 9));
      b.p.set(hand.x, 0.07 + ph * (hand.y - 0.1), hand.z);
      if (near && ph < b.prevDrib && ph < 0.12 && !this.dribbled) { sfx.bounce(b.p.x, b.p.z, 0.6); this.dribbled = true; }
      if (ph > 0.5) this.dribbled = false;
      b.prevDrib = ph;
      if (!halted) {
        const dist = Math.hypot(hp.x - p.x, hp.z - p.z), there = Math.hypot(p.tx - p.x, p.tz - p.z) < 0.12;
        p.decide -= dt;
        if (p.dunk && dist < 0.45) this.shoot(p, true);
        else if (!p.dunk && (there || p.decide <= 0)) {
          const mates = this.players.filter((o) => o.team === p.team && o !== p && !o.gone && !o.flee);
          if (dist < 1.3 && Math.random() < 0.45) p.dunk = true;
          else if (mates.length && Math.random() < 0.35) this.pass(p, pick(mates));
          else this.shoot(p, false);
          p.decide = rand(1.2, 2.5);
        }
      }
    } else if (b.mode === 'pass') {
      b.t += dt; const k = Math.min(1, b.t / b.T), to = HAND(b.passTo);
      b.p.set(b.from.x + (to.x - b.from.x) * k, b.from.y + (to.y - b.from.y) * k + Math.sin(Math.PI * k) * 0.25, b.from.z + (to.z - b.from.z) * k);
      if (k >= 1) this.give(b.passTo);
    } else if (b.mode === 'shot') {
      b.t += dt; const t = Math.min(b.t, b.T);
      b.p.copy(b.from).addScaledVector(b.v0, t); b.p.y += 0.5 * GRAV * t * t;
      if (b.t >= b.T) {
        const h = b.hoop;
        if (b.make) {
          b.mode = 'drop'; b.p.set(h.x, h.y - 0.02, h.z); b.v.set(0, -1.4, 0); b.lock = 1 - b.shooter.team;
          h.wobble = 0.6;
          if (near) b.dunk ? sfx.rim(h.x, h.z) : sfx.swish(h.x, h.z);
        } else {
          b.mode = 'loose'; b.lock = null;
          const a = Math.atan2(b.p.z - h.z, b.p.x - h.x);
          b.v.set(Math.cos(a) * rand(0.8, 1.8) - h.s * 0.6, rand(1.4, 2.4), Math.sin(a) * rand(0.8, 1.8));
          if (near) sfx.rim(h.x, h.z);
        }
        b.stuck = 0;
      }
    } else {
      b.v.y += GRAV * dt; b.p.addScaledVector(b.v, dt);
      if (b.p.y < 0.05) { b.p.y = 0.05; if (Math.abs(b.v.y) > 0.5 && near) sfx.bounce(b.p.x, b.p.z, Math.min(1, Math.abs(b.v.y) / 3)); b.v.y = Math.abs(b.v.y) * 0.62; b.v.x *= 0.85; b.v.z *= 0.85; }
      const c = this.inCourt(b.p.x, b.p.z);
      if (c.x !== b.p.x) { b.p.x = c.x; b.v.x *= -0.6; }
      if (c.z !== b.p.z) { b.p.z = c.z; b.v.z *= -0.6; }
      if (!halted) {
        for (const p of this.players) {
          if (p.gone || p.flee || p.fly || (b.lock != null && p.team !== b.lock)) continue;
          if (b.p.y < 0.75 && Math.hypot(p.x - b.p.x, p.z - b.p.z) < 0.3) { this.give(p); break; }
        }
        if (b.stuck > 6 && (b.mode === 'loose' || b.mode === 'drop')) { const p = this.players.find((o) => !o.gone && !o.flee && !o.fly); if (p) this.give(p); }
      }
    }
    b.mesh.position.copy(b.p);
    b.mesh.rotation.x += dt * 6;
    for (const h of this.hoops) if (h.net) { h.wobble = Math.max(0, (h.wobble || 0) - dt); h.net.scale.set(1, 1 + Math.sin(h.wobble * 30) * h.wobble * 0.5, 1); }
  }
  pose(p, moving, dribbling) {
    const r = moving ? Math.sin(p.run) : 0;
    p.g.position.set(p.x, p.y, p.z); p.g.rotation.y = p.h;
    p.legs[0].rotation.x = r * 0.8; p.legs[1].rotation.x = -r * 0.8;
    const up = p.jumpT > 0 && this.ball.shooter === p;
    if (up) { p.arms[0].rotation.x = p.arms[1].rotation.x = -2.9; p.arms[0].rotation.z = p.arms[1].rotation.z = 0; }
    else if (dribbling) { p.arms[1].rotation.x = -0.5 - Math.abs(Math.sin(this.time * 9)) * 0.3; p.arms[0].rotation.x = -r * 0.6; p.arms[0].rotation.z = p.arms[1].rotation.z = 0; }
    else if (p.team !== this.poss && !p.flee) { p.arms[0].rotation.set(-0.3, 0, -0.9); p.arms[1].rotation.set(-0.3, 0, 0.9); }        // defensive stance
    else { p.arms[0].rotation.set(-r * 0.7, 0, 0); p.arms[1].rotation.set(r * 0.7, 0, 0); }
  }
  updateFly(p, dt) {
    const f = p.fly;
    f.v.y += -14 * dt; p.x += f.v.x * dt; p.z += f.v.z * dt; p.y += f.v.y * dt; f.rot += f.spin * dt;
    if (p.y <= 0 && f.v.y < 0) { p.y = 0.04; p.g.rotation.set(Math.PI / 2, p.h, 0, 'YXZ'); p.g.position.set(p.x, p.y, p.z); p.fly = null; p.gone = true; return; }
    p.g.position.set(p.x, p.y, p.z); p.g.rotation.set(f.rot, p.h, 0, 'YXZ');
  }
}

export class Court {
  constructor(scene, area) {
    this.area = area;
    const layout = courtLayout(area);
    const P = [];
    // ---- fence: tall chain-link on posts, gate gap on the south side; graffiti wall on the north ----
    const H = 3, wallH = 1.7, gate = { x: (layout[0].cx + layout[1].cx) / 2, w: 1.2 };
    const link = chainLinkTex();
    const linkMat = new THREE.MeshStandardMaterial({ map: link, transparent: true, depthWrite: false, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
    const fg = [];
    const run = (ax, az, bx, bz, y0, y1) => {
      const len = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(len, y1 - y0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * 2.2, uv.getY(i) * (y1 - y0) * 2.2);
      fg.push(g.rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2));
      for (let t = 0; t <= len + 0.01; t += 2.4) { const k = Math.min(1, t / len); P.push(box(0.07, y1 + 0.1, 0.07, ax + (bx - ax) * k, (y1 + 0.1) / 2, az + (bz - az) * k, 0x2f3338)); }
      P.push(tint(new THREE.BoxGeometry(len, 0.05, 0.05).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y1, (az + bz) / 2), 0x3a3e44));
    };
    const { x0, x1, z0, z1 } = area;
    run(x0, z0, x0, z1, 0, H); run(x1, z0, x1, z1, 0, H);
    run(x0, z1, gate.x - gate.w, z1, 0, H); run(gate.x + gate.w, z1, x1, z1, 0, H);
    run(x0, z0, x1, z0, wallH, H);                                   // chain-link above the wall
    const fm = new THREE.Mesh(mergeGeometries(fg), linkMat); fm.castShadow = true; scene.add(fm);
    const gw = graffitiTex();
    const conc = new THREE.MeshStandardMaterial({ color: 0x5a5b5d, roughness: 0.95 }), graf = new THREE.MeshStandardMaterial({ map: gw, roughness: 0.9 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, wallH, 0.3), [conc, conc, conc, conc, graf, conc]);
    wall.position.set((x0 + x1) / 2, wallH / 2, z0 - 0.15); wall.castShadow = wall.receiveShadow = true; scene.add(wall);
    // ---- hoops, benches, light poles ----
    const ballMat = new THREE.MeshLambertMaterial({ color: 0xd9652b });
    this.games = layout.map(({ cx, cz }) => new Game(scene, cx, cz, ballMat));
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe8541c, emissive: 0x401000, metalness: 0.4, roughness: 0.5 });
    const netMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f0, wireframe: true, transparent: true, opacity: 0.75 });
    const board = canvasTex(64, 40, (x, w, h) => { x.fillStyle = '#c9ccd0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a8d91'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4); x.strokeStyle = '#e8541c'; x.lineWidth = 3; x.strokeRect(w * 0.36, h * 0.45, w * 0.28, h * 0.4); for (let k = 0; k < 20; k++) { x.fillStyle = 'rgba(40,40,40,.25)'; x.fillRect(Math.random() * w, Math.random() * h, 3, 2); } });
    const boardMat = new THREE.MeshStandardMaterial({ map: board, roughness: 0.6, metalness: 0.3 });
    for (const gm of this.games) for (const h of gm.hoops) {
      const bx = h.x + h.s * 0.18;
      P.push(box(0.08, RIM_Y + 0.5, 0.08, h.x + h.s * 0.75, (RIM_Y + 0.5) / 2, h.z, 0x3a3e44));
      P.push(box(0.55, 0.06, 0.06, h.x + h.s * 0.48, RIM_Y + 0.35, h.z, 0x3a3e44));
      const bd = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.43, 0.74), [boardMat, boardMat, boardMat, boardMat, boardMat, boardMat]);
      bd.position.set(bx, RIM_Y + 0.17, h.z); bd.castShadow = true; scene.add(bd);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 18).rotateX(Math.PI / 2), rimMat); rim.position.set(h.x, h.y, h.z); scene.add(rim);
      const net = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.16, 10, 2, true).translate(0, -0.08, 0), netMat); net.position.set(h.x, h.y, h.z); scene.add(net);
      h.net = net;
    }
    for (const { cx } of layout) for (const dx of [-3, 0, 3]) P.push(box(1.1, 0.06, 0.26, cx + dx, 0.22, z1 - 0.45, 0x6b4a32), box(0.05, 0.22, 0.2, cx + dx - 0.45, 0.11, z1 - 0.45, 0x2f3338), box(0.05, 0.22, 0.2, cx + dx + 0.45, 0.11, z1 - 0.45, 0x2f3338));
    this.lamps = [];
    for (const { cx, cz } of layout) for (const s of [-1, 1]) {
      const px = cx, pz = s < 0 ? z0 + 0.35 : z1 - 0.2, hy = 4.6;
      P.push(box(0.12, hy, 0.12, px, hy / 2, pz, 0x2f3338), box(1.1, 0.28, 0.3, px, hy, pz - s * 0.2, 0x2b2e33));
      this.lamps.push({ x: px, y: hy - 0.15, z: pz - s * 0.36, s });
    }
    const m = new THREE.Mesh(mergeGeometries(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2 }));
    m.castShadow = m.receiveShadow = true; scene.add(m);
    // lamp faces glow at night, and throw light pools on the courts (no point lights: they're expensive)
    this.lampFaces = new THREE.Mesh(mergeGeometries(this.lamps.map((l) => new THREE.PlaneGeometry(1.0, 0.18).rotateX(Math.PI / 2).translate(l.x, l.y, l.z))), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    scene.add(this.lampFaces);
    const pool = canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    this.pools = layout.map(({ cx, cz }) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(L + 3, W + 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: pool, color: 0xfff1d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); p.position.set(cx, 0.03, cz); scene.add(p); return p; });
    this.gate = gate; this.halt = 0;
  }

  // a player weapon near the courts: people right there go flying, everyone else runs out of the gate
  onBlast(x, y, z, r, power, kind) {
    const A = this.area;
    if (kind === 'collapse' || x < A.x0 - 10 || x > A.x1 + 10 || z < A.z0 - 10 || z > A.z1 + 10) return;
    if (kind === 'laser') { this.laserHits = (this.laserHits || []).filter((t) => G.time - t < 2); this.laserHits.push(G.time); if (this.laserHits.length < 3) return; }
    const kill = kind === 'wind' ? r * 0.55 : r * 0.3;
    for (const gm of this.games) {
      for (const p of gm.players) {
        if (p.gone || p.fly) continue;
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d < kill && power > 1.5) { const f = power * (1 - d / kill) * 0.8; p.flee = null; p.fly = { v: new THREE.Vector3(dx / (d + 0.1) * f, f * 0.9 + 1, dz / (d + 0.1) * f), rot: 0, spin: rand(-8, 8) }; continue; }
        if (p.flee) continue;
        const gx = this.gate.x + rand(-this.gate.w, this.gate.w) * 0.7;
        p.flee = { x: gx, z: A.z1 - 0.5, next: { x: gx, z: A.z1 + 2.2, next: { x: gx + rand(-14, 14), z: A.z1 + 2.2 + rand(-0.8, 0.8) } } };
      }
      const b = gm.ball; if (b.mode === 'held') { b.mode = 'loose'; b.v.set(rand(-1, 1), 1.5, rand(-1, 1)); b.holder = null; }
    }
    this.halt = 40;
  }

  update(dt) {
    const T = G.camTarget, A = this.area;
    const near = Math.hypot(T.x - (A.x0 + A.x1) / 2, T.z - (A.z0 + A.z1) / 2) < 45;
    if (this.halt > 0) { this.halt -= dt; if (this.halt <= 0) for (const gm of this.games) gm.reset(); }
    for (const gm of this.games) gm.update(dt, near, this.halt > 0);
    const n = G.night || 0;
    this.lampFaces.material.color.setScalar(0.6 + n * 3);
    for (const p of this.pools) p.material.opacity = n * 0.3;
  }
}

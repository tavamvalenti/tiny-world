// Street-running light rail: a trolley-only transit mall with twin tracks, overhead wires on centre poles,
// side-platform stations, and red articulated trains that run both ways and dwell at each stop.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, clamp } from './core.js';
import { sfx } from './audio.js';

const SEC_L = 4.4, SEC_W = 0.86, SEC_H = 1.3, GAP = 0.12, SECS = 4; // two 2-section vehicles
const TRACK = 0.62;                                                  // track offset from street centreline
const SPEED = 4.6;

function sideTexture(num) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c8141c'; x.fillRect(0, 0, 512, 128);                           // body red
  x.fillStyle = '#1e2127'; x.fillRect(0, 0, 512, 16);                             // roof edge
  const g = x.createLinearGradient(0, 88, 0, 106); g.addColorStop(0, '#f2b21c'); g.addColorStop(1, '#e0561c');
  x.fillStyle = g; x.fillRect(0, 90, 512, 14);                                    // yellow-orange stripe
  x.fillStyle = '#231417'; x.fillRect(0, 112, 512, 16);                           // skirt
  // window band with frames and two double doors
  x.fillStyle = '#151a22'; x.fillRect(8, 26, 496, 44);
  x.fillStyle = 'rgba(160,190,215,.35)'; for (let i = 0; i < 8; i++) x.fillRect(14 + i * 62, 30, 54, 16);
  x.strokeStyle = '#8f0f15'; x.lineWidth = 4;
  for (const d of [150, 330]) { x.fillStyle = '#b3121a'; x.fillRect(d, 24, 46, 88); x.fillStyle = '#151a22'; x.fillRect(d + 5, 30, 16, 50); x.fillRect(d + 25, 30, 16, 50); x.strokeRect(d, 24, 46, 88); }
  x.fillStyle = '#fff'; x.font = '600 13px Inter, Arial'; x.fillText('Daygo Trolley', 28, 84);
  x.font = '700 16px Inter, Arial'; x.fillText(String(num), 450, 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // emissive: lit windows at night
  const e = document.createElement('canvas'); e.width = 512; e.height = 128;
  const ex = e.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, 512, 128);
  ex.fillStyle = '#ffe7b8'; for (let i = 0; i < 8; i++) ex.fillRect(14 + i * 62, 30, 54, 36);
  const et = new THREE.CanvasTexture(e); et.colorSpace = THREE.SRGBColorSpace;
  return [t, et];
}
function frontTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c8141c'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#1e2127'; x.fillRect(0, 0, 128, 16);
  x.fillStyle = '#10141a'; x.fillRect(10, 18, 108, 62);                           // windshield
  x.fillStyle = '#000'; x.fillRect(22, 20, 84, 12);
  x.fillStyle = '#ff9a1a'; x.font = '700 9px Inter, Arial'; x.textAlign = 'center'; x.fillText('GREEN LINE', 64, 29);
  x.fillStyle = '#fff6d8'; x.fillRect(16, 92, 14, 8); x.fillRect(98, 92, 14, 8);  // headlamps
  x.fillStyle = '#231417'; x.fillRect(0, 112, 128, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Trolley {
  constructor(scene, city, ground) {
    const R = city.rail;
    this.city = city; this.z = R.z; this.stations = R.stations; this.trains = [];
    const E = ground.E, hw = city.roadW / 2;
    // west terminus at the waterfront when the map has a harbour, otherwise the line runs off the map
    this.west = city.shoreX != null ? city.shoreX + 3 : -128;
    const W0 = Math.max(-E, this.west - 1);
    // ---- the transit mall: trolley-only, so cars never route along it ----
    for (let i = 0; i + 1 < city.xs.length; i++) {
      const j = city.zs.indexOf(R.z);
      const e = city.edge(city.nid(i, j), city.nid(i + 1, j));
      if (e) { e.blocked = true; e.transit = true; }
    }
    const X = city.allX || city.xs;
    for (let a = 0; a + 1 < X.length; a++) {
      const x0 = X[a] + hw, x1 = X[a + 1] - hw;
      ground.rect(x0, R.z - hw, x1, R.z + hw, '#9d978c');                       // pavers
      for (let x = x0; x < x1; x += 0.6) ground.line(x, R.z - hw, x, R.z + hw, 0.02, 'rgba(0,0,0,.08)');
    }
    for (const s of [-1, 1]) {
      const tz = R.z + s * TRACK;
      ground.rect(W0, tz - 0.34, E, tz + 0.34, '#6b665f');                       // track bed
      for (let x = W0; x < E; x += 0.45) ground.rect(x, tz - 0.3, x + 0.14, tz + 0.3, 'rgba(60,45,35,.55)'); // ties
      for (const r of [-0.2, 0.2]) ground.line(W0, tz + r, E, tz + r, 0.05, '#c9ccd0');    // rails
      ground.rect(W0 - 0.3, tz - 0.4, W0, tz + 0.4, '#d8b21c');                    // buffer stop
    }
    ground.tex.needsUpdate = true;

    // ---- stations: side platforms, tactile edges, canopies, signs ----
    const concrete = new THREE.MeshStandardMaterial({ color: 0xbdb7ab, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.5 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.4, metalness: 0.3 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c21c, roughness: 0.8 });
    const plat = [], edge = [], posts = [], roofs = [];
    for (const st of this.stations) {
      for (const s of [-1, 1]) {
        const pz = R.z + s * (hw - 0.62), len = 15;
        plat.push(new THREE.BoxGeometry(len, 0.1, 1.24).translate(st.x, 0.05, pz));
        edge.push(new THREE.BoxGeometry(len, 0.012, 0.16).translate(st.x, 0.106, R.z + s * (hw - 1.16)));
        for (let k = -2; k <= 2; k++) posts.push(new THREE.BoxGeometry(0.06, 1.3, 0.06).translate(st.x + k * 3, 0.75, pz + s * 0.35));
        roofs.push(new THREE.BoxGeometry(13, 0.06, 1.1).translate(st.x, 1.42, pz));
        (city.crowds ||= []).push({ x: st.x + rand(-4, 4), z: pz, r: 0.45, n: Math.round(rand(3, 6)) }, { x: st.x + rand(-5, 5), z: pz, r: 0.45, n: Math.round(rand(2, 4)) });
        // station name sign on a pole
        const sign = this.stationSign(st.name);
        sign.position.set(st.x + 6.4, 1.2, pz + s * 0.35); sign.rotation.y = s > 0 ? 0 : Math.PI;
        scene.add(sign);
      }
    }
    const add = (geos, mat, shadow = true) => { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };
    add(plat, concrete); add(edge, yellow, false); add(posts, dark); add(roofs, canopyMat);

    // ---- overhead contact system: centre poles with bracket arms, two contact wires ----
    const poleGeo = [], wires = [];
    for (let x = W0 + 2; x < E; x += 7) {
      if (city.xs.some((v) => Math.abs(v - x) < hw + 0.6)) continue; // keep intersections clear
      poleGeo.push(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 6).translate(x, 1.15, R.z));
      poleGeo.push(new THREE.BoxGeometry(0.04, 0.04, TRACK * 2 + 0.2).translate(x, 2.2, R.z));
    }
    for (const s of [-1, 1]) wires.push(new THREE.BoxGeometry(E - W0, 0.018, 0.018).translate((E + W0) / 2, 2.16, R.z + s * TRACK));
    add(poleGeo, dark);
    add(wires, new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), false);

    // ---- trains ----
    this.front = frontTexture();
    this.makeTrain(scene, 1, Math.max(-60, this.west + 30), 4050);
    this.makeTrain(scene, -1, 70, 4051);
    this.bellT = 0;
  }

  stationSign(name) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const x = c.getContext('2d');
    x.fillStyle = '#1a3a6b'; x.fillRect(0, 0, 256, 48);
    x.fillStyle = '#c8141c'; x.fillRect(0, 0, 18, 48);
    x.fillStyle = '#fff'; x.font = '700 20px Inter, Arial'; x.textBaseline = 'middle'; x.fillText(name, 28, 25);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.DoubleSide }));
    board.position.y = 0.55; g.add(board);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2d31 }));
    g.add(pole);
    this.signBoards = (this.signBoards || []).concat(board);
    return g;
  }

  makeTrain(scene, dir, x, num) {
    const [side, emis] = sideTexture(num);
    const body = new THREE.MeshStandardMaterial({ map: side, emissiveMap: emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, metalness: 0.2 });
    // red roof reads from the aerial camera; equipment on top stays dark grey
    const roof = new THREE.MeshStandardMaterial({ color: 0xb3141b, roughness: 0.5 });
    const gear = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.6, metalness: 0.4 });
    const nose = new THREE.MeshStandardMaterial({ map: this.front, roughness: 0.35 });
    const geo = new THREE.BoxGeometry(SEC_L, SEC_H, SEC_W).translate(0, SEC_H / 2 + 0.12, 0);
    const pantoGeo = mergeGeometries([
      new THREE.BoxGeometry(0.5, 0.18, 0.4).translate(0, SEC_H + 0.21, 0),
      new THREE.BoxGeometry(0.03, 0.6, 0.03).rotateZ(0.6).translate(0.1, SEC_H + 0.5, 0),
      new THREE.BoxGeometry(0.03, 0.4, 0.03).rotateZ(-0.7).translate(0.05, SEC_H + 0.72, 0),
      new THREE.BoxGeometry(0.06, 0.03, 0.5).translate(0, SEC_H + 0.86, 0),
    ]);
    const equipGeo = mergeGeometries([new THREE.BoxGeometry(1.1, 0.16, 0.5).translate(-0.8, SEC_H + 0.2, 0), new THREE.BoxGeometry(0.7, 0.12, 0.4).translate(0.9, SEC_H + 0.18, 0)]);
    const t = { dir, x, z: this.z + dir * TRACK, speed: SPEED, dwell: 0, secs: [], derailed: false, lastStop: null, num };
    for (let i = 0; i < SECS; i++) {
      const m = new THREE.Mesh(geo, [body, body, roof, roof, body, body]);
      m.castShadow = true; m.receiveShadow = true;
      if (i % 2 === 0) m.add(new THREE.Mesh(pantoGeo, gear));
      else m.add(new THREE.Mesh(equipGeo, gear));
      scene.add(m);
      t.secs.push({ m, dx: 0, rot: new THREE.Euler() });
    }
    // headlight glow on the leading end
    t.lamp = { position: new THREE.Vector3(), intensity: 0 }; // headlamp glow is emissive; no point light (performance)
    t.bodyMat = body; t.nose = nose;
    this.setMats(t);
    this.trains.push(t);
    this.place(t);
  }

  // box face order: +x, -x, +y, -y, +z, -z. The nose texture goes on the two outer ends.
  setMats(t) {
    t.secs.forEach((s, i) => {
      const m = s.m.material;
      const head = i === 0, tail = i === SECS - 1;
      m[0] = (t.dir > 0 ? head : tail) ? t.nose : t.bodyMat;
      m[1] = (t.dir > 0 ? tail : head) ? t.nose : t.bodyMat;
    });
  }
  // reverse at a terminus: the tail becomes the head and the train crosses over to the other track
  flip(t) {
    t.x -= t.dir * SECS * (SEC_L + GAP);
    t.dir *= -1;
    t.z = this.z + t.dir * TRACK;
    t.secs.reverse();
    t.lastStop = null; t.term = false;
    this.setMats(t);
  }

  // section centres trail behind the head in the direction of travel
  place(t) {
    for (let i = 0; i < SECS; i++) {
      const s = t.secs[i];
      const cx = t.x - t.dir * (i * (SEC_L + GAP) + SEC_L / 2);
      if (!t.derailed) { s.m.position.set(cx, 0, t.z); s.m.rotation.set(0, 0, 0); }
    }
  }
  extent(t) {
    const a = t.x, b = t.x - t.dir * (SECS * (SEC_L + GAP));
    return [Math.min(a, b), Math.max(a, b)];
  }

  // Cars ask this before entering the mall: is a train on (or about to be on) the crossing ahead?
  blocks(px, pz) {
    if (Math.abs(pz - this.z) > TRACK + 1.4) return false;
    for (const t of this.trains) {
      const [a, b] = this.extent(t);
      const lead = t.derailed ? 0.6 : 6;
      const lo = a - (t.dir < 0 ? lead : 0.8), hi = b + (t.dir > 0 ? lead : 0.8);
      if (px > lo && px < hi) return true;
    }
    return false;
  }

  onBlast(x, y, z, r, power, kind) {
    for (const t of this.trains) {
      if (t.derailed) continue;
      let near = 1e9;
      for (const s of t.secs) near = Math.min(near, Math.hypot(s.m.position.x - x, s.m.position.z - z));
      const reach = kind === 'wind' ? r * 0.7 : r * 0.35;
      if (near > reach || power < 4) { if (near < r) t.alarm = 3; continue; }
      // derail: each section kinks, tilts and is shoved away from the blast; it stays that way
      t.derailed = true;
      for (const s of t.secs) {
        const dx = s.m.position.x - x, dz = s.m.position.z - z, d = Math.hypot(dx, dz) + 0.1;
        const f = Math.min(1, power / 12) * (1 - Math.min(1, d / (reach * 1.6)));
        s.m.position.x += dx / d * f * 1.5; s.m.position.z += dz / d * f * 2.2;
        s.m.rotation.set(rand(-0.1, 0.1), rand(-0.5, 0.5) * f, (dz > 0 ? -1 : 1) * rand(0.2, 1.3) * f);
        if (f > 0.5) s.m.position.y = 0.2 * Math.abs(Math.sin(s.m.rotation.z));
        this.city.obstacles.push({ x: s.m.position.x, z: s.m.position.z, r: 1.4, kind: 'train' });
      }
      t.bodyMat.color.setScalar(kind === 'wind' ? 0.8 : 0.45);
      t.speed = 0;
      G.fx && G.fx.sparks(t.secs[1].m.position.x, 1, t.secs[1].m.position.z, 40, 4, 2.4, 1, 6);
      sfx.crumble(x, z, 1.4);
      G.emergency && G.emergency.report(t.secs[1].m.position.x, t.z, 1.5);
    }
  }

  update(dt) {
    const n = G.night || 0;
    for (const b of this.signBoards || []) b.material.emissiveIntensity = 0.1 + n * 1.2;
    for (const t of this.trains) {
      t.bodyMat.emissiveIntensity = t.derailed ? 0 : n * 1.3;
      if (t.derailed) { t.lamp.intensity = 0; continue; }
      // stations: slow to a stop centred on the platform, dwell, ring the bell and go
      let target = SPEED;
      const head = t.x;
      for (const st of this.stations) {
        if (t.lastStop === st) continue;
        const stopAt = st.x + t.dir * (SECS * (SEC_L + GAP)) / 2;
        const ahead = (stopAt - head) * t.dir;
        if (ahead > -0.2 && ahead < 14) target = Math.min(target, Math.max(0, Math.sqrt(Math.max(0, ahead) * 2 * 2.2)));
        if (ahead <= 0.05 && ahead > -0.5 && t.dwell <= 0 && t.lastStop !== st) { t.dwell = rand(6, 10); t.lastStop = st; t.speed = 0; }
      }
      if (t.dwell > 0) {
        t.dwell -= dt; target = 0;
        if (t.dwell <= 0) this.bell(t);
      }
      // anything on the track ahead (crossing cars, wrecks, rubble, a derailed train) brings it to a halt
      const probe = head + t.dir * 3;
      if (this.city.obstacleNear(probe, t.z, 0.6)) target = 0;
      for (const c of G.agents.cars) {
        if (c.state === 'hidden') continue;
        if (Math.abs(c.pos.z - t.z) < 0.7 && (c.pos.x - head) * t.dir > 0 && (c.pos.x - head) * t.dir < 4) target = 0;
      }
      for (const o of this.trains) if (o !== t && o.derailed && Math.abs(o.z - t.z) < 1.5) {
        const [a, b] = this.extent(o);
        if (t.dir > 0 ? a - head < 5 && a - head > -1 : head - b < 5 && head - b > -1) target = 0;
      }
      // keep spacing behind another train on the same track
      for (const o of this.trains) if (o !== t && !o.derailed && o.dir === t.dir) {
        const [a, b] = this.extent(o);
        const gap = t.dir > 0 ? a - head : head - b;
        if (gap > -1 && gap < 8) target = 0;
      }
      // west terminus: slow in, dwell, ring the bell and reverse
      if (t.dir < 0 && this.west > -128) {
        const toEnd = head - (this.west + 0.5);
        target = Math.min(target, Math.sqrt(Math.max(0, toEnd) * 2 * 2.2));
        if (toEnd < 0.1 && !t.term) { t.term = true; t.dwell = rand(8, 12); t.speed = 0; }
        if (t.term && t.dwell <= 0) this.flip(t);
      }
      t.speed += clamp(target - t.speed, -5 * dt, 1.6 * dt);
      t.x += t.dir * t.speed * dt;
      // far end (off-screen): reverse onto the other track
      if (t.dir > 0 && t.x > 128) this.flip(t);
      else if (t.dir < 0 && t.x < -128) this.flip(t);
      this.place(t);
      t.lamp.position.set(head + t.dir * 1.2, 0.8, t.z);
      t.lamp.intensity = n * 8;
      // rail clatter near the camera
      if (t.speed > 1 && Math.random() < dt * t.speed * 0.4) {
        const T = G.camTarget;
        if (Math.hypot(head - T.x, t.z - T.z) < 55) sfx.clack && sfx.clack(head, t.z);
      }
    }
  }

  bell(t) { sfx.bell && sfx.bell(t.x, t.z); }
}

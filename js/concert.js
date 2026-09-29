// Summer Smash: a stadium festival in Chicago that never stops. Stage with the blue Summer Smash banner and
// the Lyrical Lemonade carton logo, LED walls, line arrays, giant carton inflatables, a grandstand, a gate
// plaza with food trucks, thousands of fans jumping on the beat, rappers running the stage, sweeping
// beams and pyro on the drops. Music comes from audio.js (music), whose beat clock drives everything here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { music, sfx } from './audio.js';

const BLUE = '#1f4fd6', YELLOW = '#f7e531', CARTON = '#74cdea';
const SHIRTS = [0xf2f2f0, 0x1c1d20, 0xf7e531, 0x74cdea, 0xd23b2e, 0x2a6fb5, 0xe88a2e, 0x6b4a8a, 0x2f7a45, 0xf2a0b5, 0x8a9096, 0x111111, 0xffffff];
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xffdbac, 0x6b3e1f, 0x4a2c17];
const PANTS = [0x2b3a55, 0x1c1d20, 0x3a3f46, 0x6b6f76, 0x4a3b2c, 0x20283a];
const BEAM_COLORS = [0xff2bd6, 0x22e0ff, 0x4d5bff, 0xa24dff, 0xffe14d, 0xff4d6d];

// ---------- helpers ----------
function tint(g, c) {
  const n = g.index ? g.toNonIndexed() : g;
  const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.redraw = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; };
  t.redraw();
  return t;
}
function plane(w, h, tex, glow = 0.25) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.6, side: THREE.DoubleSide }));
}
const logo = new Image();
let logoReady = false;
const onLogo = [];
logo.onload = () => { logoReady = true; for (const f of onLogo) f(); };
logo.src = 'assets/lyrical-lemonade.jpg';
function drawLogo(x, cx, cy, size, round = 0.18) {
  if (!logoReady) return;
  x.save();
  x.beginPath(); x.roundRect(cx - size / 2, cy - size / 2, size, size, size * round); x.clip();
  x.drawImage(logo, cx - size / 2, cy - size / 2, size, size);
  x.restore();
}

// Summer Smash banner: blue band, white rounded bold wordmark, the carton logo on the left
function drawBanner(x, w, h) {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a5ff0'); g.addColorStop(1, '#1b43c0');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, h - 6, w, 6);
  drawLogo(x, h * 0.62, h / 2, h * 0.78);
  x.fillStyle = '#fff'; x.font = `800 ${h * 0.5}px Inter, "Arial Rounded MT Bold", Arial, sans-serif`;
  x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText('Summer Smash', h * 1.25, h * 0.54);
}
function drawFence(x, w, h) {
  const seg = w / 4;
  for (let i = 0; i < 4; i++) {
    const blue = i % 2 === 0;
    x.fillStyle = blue ? BLUE : YELLOW; x.fillRect(i * seg, 0, seg, h);
    drawLogo(x, i * seg + h * 0.6, h / 2, h * 0.8, 0.12);
    x.fillStyle = blue ? '#fff' : '#111'; x.font = `800 ${h * 0.46}px Inter, Arial, sans-serif`; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillText(blue ? 'SUMMER SMASH' : 'LYRICAL LEMONADE', i * seg + h * 1.2, h * 0.54);
  }
}
// carton inflatable faces, drawn after the logo's style
function drawCartonFront(x, w, h) {
  x.fillStyle = CARTON; x.fillRect(0, 0, w, h);
  x.lineWidth = w * 0.03; x.strokeStyle = '#111'; x.strokeRect(0, 0, w, h);
  x.fillStyle = '#fff'; x.strokeStyle = '#111'; x.lineWidth = w * 0.02;
  x.font = `900 ${w * 0.3}px Inter, Arial Black, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const [t, y] of [['LYRI', 0.2], ['CAL', 0.43]]) { x.strokeText(t, w / 2, h * y); x.fillText(t, w / 2, h * y); }
  x.fillStyle = YELLOW; x.fillRect(0, h * 0.58, w, h * 0.13); x.strokeRect(0, h * 0.58, w, h * 0.13);
  x.fillStyle = '#111'; x.font = `800 ${w * 0.12}px Inter, Arial, sans-serif`; x.fillText('LEMONADE', w / 2, h * 0.65);
  x.fillStyle = YELLOW; x.beginPath(); x.arc(w / 2, h, w * 0.36, Math.PI, 0); x.fill(); x.stroke();
  x.strokeStyle = '#111'; x.lineWidth = w * 0.012;
  for (let k = 1; k < 8; k++) { const a = Math.PI + (k / 8) * Math.PI; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2 + Math.cos(a) * w * 0.34, h + Math.sin(a) * w * 0.34); x.stroke(); }
}
function drawCartonSide(x, w, h) {
  x.fillStyle = CARTON; x.fillRect(0, 0, w, h);
  x.lineWidth = w * 0.03; x.strokeStyle = '#111'; x.strokeRect(0, 0, w, h);
  x.fillStyle = '#fff'; x.fillRect(w * 0.35, 0, w * 0.2, h); x.strokeRect(w * 0.35, 0, w * 0.2, h);
  x.save(); x.translate(w / 2, h * 0.45); x.rotate(-0.12);
  x.fillStyle = '#fff'; x.fillRect(-w * 0.34, -h * 0.12, w * 0.68, h * 0.24); x.lineWidth = w * 0.02; x.strokeRect(-w * 0.34, -h * 0.12, w * 0.68, h * 0.24);
  x.fillStyle = '#111'; x.font = `900 ${w * 0.15}px Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('100%', 0, -h * 0.05); x.fillText('REAL', 0, h * 0.06);
  x.restore();
}

// a fan: shirt (torso), skin (head + raised arms), pants (legs); low-poly, ~0.65 tall like the street crowd
function fanGeos() {
  const torso = new THREE.CylinderGeometry(0.066, 0.056, 0.24, 7).scale(1, 1, 0.62).translate(0, 0.43, 0);
  const head = new THREE.SphereGeometry(0.05, 7, 5).translate(0, 0.62, 0);
  const arm = (s) => new THREE.CylinderGeometry(0.018, 0.015, 0.25, 4).translate(0, 0.125, 0).rotateZ(-s * 0.38).translate(s * 0.07, 0.52, 0);
  const skin = mergeGeometries([head, arm(1), arm(-1)]);
  const leg = (s) => new THREE.CylinderGeometry(0.028, 0.021, 0.31, 5).translate(s * 0.034, 0.155, 0);
  const legs = mergeGeometries([leg(1), leg(-1)]);
  return { torso, skin, legs };
}
// jumping in the vertex shader: per-instance phase/amplitude, shared beat uniform
function jumpify(mat, U) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBeat = U.beat; sh.uniforms.uHype = U.hype;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aJump; uniform float uBeat; uniform float uHype;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float f = fract(uBeat + aJump.x);
        float hop = pow(sin(3.14159 * f), 0.8);
        transformed.y += uHype * aJump.y * mix(0.22, 1.0, aJump.z) * hop;
        // hands pump on the beat
        if (position.y > 0.5 && abs(position.x) > 0.06) transformed.y += uHype * 0.04 * hop;`);
  };
  return mat;
}

export class Concert {
  constructor(scene, site, city) {
    this.site = site;
    const cx = (site.x0 + site.x1) / 2;
    this.cx = cx; this.z0 = site.z0;
    this.stage = { x0: cx - 13, x1: cx + 13, z0: site.z0 + 1.5, z1: site.z0 + 12, y: 1.8 };
    this.center = { x: cx, z: (site.z0 + site.z1) / 2 };
    this.U = { beat: { value: 0 }, hype: { value: 1 } };
    this.halt = 0; this.lastBar = -1; this.pyro = []; this.flyers = []; this.movers = [];
    this.mats = [];
    this.buildStage(scene);
    this.buildStands(scene);
    this.buildPlaza(scene, city);
    this.buildCrowd(scene);
    this.buildPerformers(scene);
    this.buildLights(scene);
  }

  // ---------- structures ----------
  buildStage(scene) {
    const { x0, x1, z0, z1, y } = this.stage, cx = this.cx;
    const P = [];
    P.push(box(x1 - x0, y, z1 - z0, cx, y / 2, (z0 + z1) / 2, 0x4a4d53));                 // deck
    P.push(box(x1 - x0 + 0.1, 0.12, 0.1, cx, y - 0.06, z1, 0xf7e531));                  // yellow deck edge
    for (const x of [x0, x1]) for (const z of [z0 + 0.3, z1 - 0.4]) P.push(box(0.6, 12, 0.6, x, 6, z, 0x2b2e33)); // towers
    P.push(box(x1 - x0 + 1.2, 0.9, z1 - z0 + 1.2, cx, 11.6, (z0 + z1) / 2, 0x3a3d42));  // roof truss
    P.push(box(x1 - x0 + 2, 0.25, z1 - z0 + 2.4, cx, 12.2, (z0 + z1) / 2 - 0.2, 0x2f3236)); // roof skin
    for (let x = x0 + 1; x < x1; x += 2.2) P.push(box(0.12, 0.12, z1 - z0, x, 11.05, (z0 + z1) / 2, 0x55595f));
    P.push(box(x1 - x0 - 1, 9, 0.3, cx, y + 4.5, z0 + 0.1, 0x111214));                   // back wall
    // line arrays hung from the roof, sub stacks on the floor
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) P.push(box(1.1, 0.42, 0.9, cx + s * 14.8, 10.2 - k * 0.45, z1 - 0.8, 0x1a1b1e));
      for (let k = 0; k < 2; k++) P.push(box(1.5, 0.8, 1.2, cx + s * 14.4, 0.4 + k * 0.82, z1 + 1.2, 0x1a1b1e));
    }
    // DJ riser + booth
    P.push(box(5, 0.6, 2.4, cx, y + 0.3, z0 + 2.4, 0x2b2e33), box(3.2, 1.0, 0.8, cx, y + 1.1, z0 + 3.2, 0xf7e531));
    // pit barricade
    for (let x = x0 - 2; x < x1 + 2; x += 1) P.push(box(0.95, 1.0, 0.1, x + 0.5, 0.5, z1 + 2.6, 0x9aa0a4));
    const stage = new THREE.Mesh(mergeGeometries(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 }));
    stage.castShadow = stage.receiveShadow = true; scene.add(stage);
    // Summer Smash banner across the roof front (as in the photo), glowing at night
    this.banner = canvasTex(1024, 160, drawBanner); onLogo.push(() => this.banner.redraw());
    const bn = plane(26, 4.06, this.banner, 0.35); bn.position.set(cx, 14.4, z1 + 0.6); scene.add(bn);
    const bnBack = box(26.4, 4.4, 0.4, cx, 14.4, z1 + 0.35, 0x1b43c0);
    const bb = new THREE.Mesh(bnBack, new THREE.MeshStandardMaterial({ vertexColors: true })); scene.add(bb);
    this.mats.push(bn.material);
    // LED walls: backdrop + two side screens, animated on the beat
    this.screenTex = canvasTex(512, 288, (x, w, h) => this.drawScreen(x, w, h, 0));
    const back = plane(20, 8.4, this.screenTex, 1); back.position.set(cx, y + 4.9, z0 + 0.3); scene.add(back);
    for (const s of [-1, 1]) {
      const scr = plane(6.4, 3.6, this.screenTex, 1); scr.position.set(cx + s * 18.5, 8, z1 - 0.5); scene.add(scr);
      const frame = new THREE.Mesh(mergeGeometries([box(6.8, 4, 0.3, 0, 8, -0.2, 0x1a1b1e), box(0.4, 6, 0.4, 0, 3, -0.3, 0x2b2e33)]), new THREE.MeshStandardMaterial({ vertexColors: true }));
      frame.position.set(cx + s * 18.5, 0, z1 - 0.5); scene.add(frame);
    }
    // giant carton inflatables flanking the stage
    const front = canvasTex(256, 384, drawCartonFront), side = canvasTex(256, 384, drawCartonSide);
    const fm = new THREE.MeshStandardMaterial({ map: front, roughness: 0.5 }), sm = new THREE.MeshStandardMaterial({ map: side, roughness: 0.5 });
    const topM = new THREE.MeshStandardMaterial({ color: 0x74cdea, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.8, 3.2), [sm, sm, topM, topM, fm, fm]);
      body.position.y = 2.4; g.add(body);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.3, 1.4, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 1), topM);
      roof.position.y = 5.5; g.add(roof);
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0xe8453c }));
      straw.position.set(0.5, 6.6, 0.3); straw.rotation.z = -0.35; g.add(straw);
      g.position.set(cx + s * 22.5, 0, z1 - 1); g.rotation.y = -s * 0.25;
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
    }
    // front-of-house mix tent in the middle of the crowd
    const foh = new THREE.Mesh(mergeGeometries([box(4, 1.2, 3, 0, 0.6, 0, 0x2b2e33), box(4.6, 0.15, 3.6, 0, 2.3, 0, 0xf2f2ee),
      ...[[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]].map(([a, b]) => box(0.08, 2.3, 0.08, a, 1.15, b, 0x8f949a))]), new THREE.MeshStandardMaterial({ vertexColors: true }));
    this.foh = { x: cx, z: z1 + 20 };
    foh.position.set(this.foh.x, 0, this.foh.z); foh.castShadow = true; scene.add(foh);
  }
  drawScreen(x, w, h, beat) {
    const bar = Math.floor(beat / 4), f = beat % 1;
    if (bar % 4 >= 2) {
      x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, w, h);
      x.fillStyle = `rgba(160,20,16,${0.25 + (1 - f) * 0.25})`; x.fillRect(0, 0, w, h);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#c42a22'; x.font = `900 ${h * 0.34}px Impact, "Arial Black", sans-serif`;
      x.fillText('CHUCKYY', w / 2, h * 0.38);
      // distressed print
      x.fillStyle = '#0b0b0c';
      for (let k = 0; k < 140; k++) { const px = ((k * 73.1) % 1) * w, py = h * 0.2 + ((k * 37.7) % 1) * h * 0.36; x.fillRect((px + k * 11) % w, py, 2 + (k % 3), 1 + (k % 2)); }
      x.fillStyle = '#f2ede4'; x.font = `800 ${h * 0.1}px Inter, Arial, sans-serif`;
      x.fillText('PERFORMING LIVE', w / 2, h * 0.66);
      x.font = `700 ${h * 0.07}px Inter, Arial, sans-serif`; x.fillStyle = '#f7e531';
      x.fillText('SUMMER SMASH  ·  CHICAGO', w / 2, h * 0.84);
      return;
    }
    const hue = (bar * 47) % 360;
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue},90%,${28 + (1 - f) * 22}%)`); g.addColorStop(1, `hsl(${(hue + 60) % 360},90%,${18 + (1 - f) * 12}%)`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // light bars sweeping
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (let k = 0; k < 6; k++) { const px = ((k * 97 + beat * 60) % (w + 80)) - 40; x.fillRect(px, 0, 18, h); }
    const s = h * (0.62 + (1 - f) * 0.08);
    drawLogo(x, w / 2, h * 0.46, s, 0.14);
    x.fillStyle = '#fff'; x.font = `800 ${h * 0.11}px Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('SUMMER SMASH', w / 2, h * 0.9);
  }
  buildStands(scene) {
    const S = this.site, P = [];
    // main grandstand along the east side, rising away from the field (like the photo)
    // starts behind the stage wing so the side screen and carton stay clear of the seats
    const gx0 = S.x1 - 12.2, gz0 = S.z0 + 15, gz1 = S.z1 - 12, rows = 13;
    this.grand = { x0: gx0, z0: gz0, z1: gz1 };
    this.standRows = [];
    for (let r = 0; r < rows; r++) {
      const x = gx0 + r * 0.9 + 0.45, h = 0.6 + r * 0.5;
      P.push(box(0.9, h, gz1 - gz0, x, h / 2, (gz0 + gz1) / 2, r % 2 ? 0x6f737a : 0x7b8087));
      P.push(box(0.9, 0.08, gz1 - gz0, x, h + 0.04, (gz0 + gz1) / 2, 0x28324a));
      this.standRows.push({ x, y: h + 0.08, z0: gz0 + 0.4, z1: gz1 - 0.4 });
    }
    // press box + roof over the top rows
    const top = gx0 + rows * 0.9;
    P.push(box(1.4, 3, gz1 - gz0, top + 0.5, 0.6 + rows * 0.5 + 1.5, (gz0 + gz1) / 2, 0xd8d2c0));
    for (let z = gz0; z <= gz1; z += 5) P.push(box(0.2, 4.5, 0.2, top + 1.1, 0.6 + rows * 0.5 + 2.2, z, 0xf2f2ee));
    P.push(box(3.2, 0.2, gz1 - gz0 + 1, top - 0.4, 0.6 + rows * 0.5 + 4.5, (gz0 + gz1) / 2, 0xb9bcc0));
    P.push(box(0.4, 0.6 + rows * 0.5 + 3, 0.4, gx0, 0, gz0, 0x2b2e33));
    // west bleachers
    const wx0 = S.x0 + 0.5;
    this.westRows = [];
    for (let r = 0; r < 5; r++) {
      const x = wx0 + (4 - r) * 0.9 + 0.45, h = 0.5 + r * 0.45;
      P.push(box(0.9, h, 26, x, h / 2, S.z0 + 30, 0x8f949a));
      this.westRows.push({ x, y: h, z0: S.z0 + 17.5, z1: S.z0 + 42.5 });
    }
    // two stadium light towers
    for (const z of [gz0 - 2, gz1 - 0.5]) {
      P.push(box(0.5, 18, 0.5, S.x1 - 1, 9, z, 0x8f949a), box(3, 1.6, 0.4, S.x1 - 1.2, 18.4, z, 0x2b2e33));
    }
    const m = new THREE.Mesh(mergeGeometries(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    m.castShadow = m.receiveShadow = true; scene.add(m);
    this.towerLamps = [gz0 - 2, gz1 - 0.5].map((z) => { const l = plane(2.8, 1.4, null, 0); l.material = new THREE.MeshBasicMaterial({ color: 0xffffff }); l.position.set(S.x1 - 1.45, 18.4, z); l.rotation.y = -Math.PI / 2 - 0.3; scene.add(l); return l; });
  }
  buildPlaza(scene, city) {
    const S = this.site, cx = this.cx, P = [];
    // perimeter fence wrapped in Summer Smash / Lyrical Lemonade banners, gap for the gate
    const fence = canvasTex(1024, 64, drawFence); fence.wrapS = THREE.RepeatWrapping; onLogo.push(() => fence.redraw());
    const fm = new THREE.MeshStandardMaterial({ map: fence, emissiveMap: fence, emissive: 0xffffff, emissiveIntensity: 0.15, side: THREE.DoubleSide, roughness: 0.7 });
    this.mats.push(fm);
    // emergency exits sit in the clear lanes between the stands and the plaza, never behind seating
    const wz = this.westRows[0].z1 + 3, ez = this.grand.z1 + 3;
    this.exits = [{ x: cx, z: S.z1, ox: 0, oz: 1, w: 3.5 }, { x: S.x0, z: wz, ox: -1, oz: 0, w: 1.6 }, { x: S.x1, z: ez, ox: 1, oz: 0, w: 1.6 }];
    const runs = [[S.x0, S.z0, S.x1, S.z0], [S.x0, S.z0, S.x0, wz - 2.5], [S.x0, wz + 2.5, S.x0, S.z1], [S.x1, S.z0, S.x1, ez - 2.5], [S.x1, ez + 2.5, S.x1, S.z1],
      [S.x0, S.z1, cx - 5, S.z1], [cx + 5, S.z1, S.x1, S.z1]];
    const fg = [];
    for (const [ax, az, bx, bz] of runs) {
      const L = Math.hypot(bx - ax, bz - az), g = new THREE.PlaneGeometry(L, 1.8);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 14);
      g.rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, 0.9, (az + bz) / 2);
      fg.push(g);
    }
    scene.add(new THREE.Mesh(mergeGeometries(fg), fm));
    for (const e of this.exits.slice(1)) {
      P.push(box(0.25, 2.6, 0.25, e.x, 1.3, e.z - 2.4, 0x8f949a), box(0.25, 2.6, 0.25, e.x, 1.3, e.z + 2.4, 0x8f949a), box(0.3, 0.5, 5, e.x, 2.7, e.z, 0x1d7a3a));
    }
    // gate arch with the wordmark
    const gz = S.z1;
    P.push(box(1, 6, 1, cx - 5.5, 3, gz, 0x1b43c0), box(1, 6, 1, cx + 5.5, 3, gz, 0x1b43c0));
    const arch = plane(12, 1.9, this.banner, 0.35); arch.position.set(cx, 5.6, gz + 0.56); scene.add(arch);
    const arch2 = plane(12, 1.9, this.banner, 0.35); arch2.position.set(cx, 5.6, gz - 0.56); arch2.rotation.y = Math.PI; scene.add(arch2);
    P.push(box(12.2, 2.1, 1, cx, 5.6, gz, 0x1b43c0));
    for (let x = cx - 4; x <= cx + 4; x += 1.6) P.push(box(0.5, 1, 0.5, x, 0.5, gz, 0x9aa0a4)); // turnstiles
    // food trucks + merch tents in the plaza
    const TRUCKS = [0xf7e531, 0xd23b2e, 0xf2f2f0, 0x2a6fb5, 0x2f7a45, 0xe88a2e];
    let k = 0;
    for (const x of [S.x0 + 4, S.x0 + 9, S.x0 + 14, cx + 9, cx + 14]) {
      const c = TRUCKS[k++ % TRUCKS.length];
      P.push(box(1.8, 1.5, 3.4, x, 0.95, gz - 4.5, c), box(1.82, 0.5, 1.8, x, 1.2, gz - 4.1, 0x1c1d20), box(1.9, 0.08, 2, x + 0.1, 1.9, gz - 4.1, 0xf2f2ee));
      for (const w of [-1, 1]) P.push(tint(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8).rotateZ(Math.PI / 2).translate(x + w * 0.85, 0.25, gz - 5.6), 0x111111));
      (city.crowds ||= []).push({ x: x + 1.8, z: gz - 4.3, r: 0.8, n: Math.round(rand(4, 7)) });
    }
    for (const x of [cx - 10, cx - 14]) {
      P.push(tint(new THREE.ConeGeometry(2.2, 1.4, 4).rotateY(Math.PI / 4).translate(x, 3.1, gz - 5), 0xf2f2ee));
      P.push(box(3, 0.9, 1, x, 0.45, gz - 5, 0x1b43c0));
      for (const [a, b] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) P.push(box(0.08, 2.4, 0.08, x + a, 1.2, gz - 5 + b, 0x8f949a));
      (city.crowds ||= []).push({ x, z: gz - 3, r: 1, n: Math.round(rand(5, 8)) });
    }
    const m = new THREE.Mesh(mergeGeometries(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    m.castShadow = m.receiveShadow = true; scene.add(m);
    this.mats.push(arch.material, arch2.material);
  }

  // ---------- the crowd ----------
  buildCrowd(scene) {
    const S = this.site, st = this.stage, pts = [];
    const fx0 = S.x0 + 6.5, fx1 = S.x1 - 13, fz0 = st.z1 + 3, fz1 = S.z1 - 10.5, cell = 0.4;
    for (let x = fx0; x < fx1; x += cell) for (let z = fz0; z < fz1; z += cell) {
      const depth = (z - fz0) / (fz1 - fz0);
      if (Math.random() > 0.97 - depth * 0.45) continue;
      if (Math.abs(x - this.foh.x) < 2.8 && Math.abs(z - this.foh.z) < 2.3) continue;
      pts.push([x + rand(-0.14, 0.14), 0, z + rand(-0.14, 0.14), 0.9 - depth * 0.5]);
    }
    for (const rowset of [this.standRows, this.westRows]) for (const r of rowset) for (let z = r.z0; z < r.z1; z += 0.44) if (Math.random() < 0.62) pts.push([r.x + rand(-0.15, 0.15), r.y, z, 0.5]);
    const n = pts.length;
    this.N = n;
    const { torso, skin, legs } = fanGeos();
    const aJump = new Float32Array(n * 3);
    this.home = pts;
    this.orig = pts.map((p) => p.slice());
    this.origJump = null;
    const mk = (geo, pal) => {
      const g = geo.clone(); g.setAttribute('aJump', new THREE.InstancedBufferAttribute(aJump, 3));
      const m = new THREE.InstancedMesh(g, jumpify(new THREE.MeshStandardMaterial({ roughness: 0.85 }), this.U), n);
      m.receiveShadow = true; m.frustumCulled = false;
      for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(pick(pal)));
      scene.add(m); return m;
    };
    this.parts = [mk(torso, SHIRTS), mk(skin, SKIN), mk(legs, PANTS)];
    this.aJump = this.parts.map((m) => m.geometry.attributes.aJump);
    this.jump = aJump;
    const cx = this.cx, cz = this.stage.z1;
    pts.forEach(([x, y, z, eager], i) => {
      aJump[i * 3] = rand(-0.06, 0.06);                                  // slight timing spread
      aJump[i * 3 + 1] = rand(0.09, 0.2) * (0.6 + eager * 0.6);          // jump height
      aJump[i * 3 + 2] = Math.random() < 0.35 + eager * 0.55 ? 1 : 0;    // jumper vs bouncer
      this.place(i, x, y, z, Math.atan2(cx - x, cz - z) + rand(-0.3, 0.3));
    });
    this.origJump = aJump.slice();
    // phone lights held up here and there (glow at night)
    const phones = pts.map((p, i) => i).filter(() => Math.random() < 0.06);
    const pg = new THREE.BoxGeometry(0.035, 0.06, 0.01).translate(0.1, 0.8, 0);
    const pa = new Float32Array(phones.length * 3);
    phones.forEach((i, k) => { pa[k * 3] = aJump[i * 3]; pa[k * 3 + 1] = aJump[i * 3 + 1]; pa[k * 3 + 2] = aJump[i * 3 + 2]; });
    pg.setAttribute('aJump', new THREE.InstancedBufferAttribute(pa, 3));
    this.phones = new THREE.InstancedMesh(pg, jumpify(new THREE.MeshBasicMaterial({ color: 0xffffff }), this.U), phones.length);
    this.phoneIdx = phones;
    phones.forEach((i, k) => { this.parts[0].getMatrixAt(i, _m); this.phones.setMatrixAt(k, _m); });
    this.phones.frustumCulled = false; scene.add(this.phones);
    for (const m of this.parts) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  place(i, x, y, z, yaw, tilt = 0) {
    _q.setFromEuler(_e.set(tilt, yaw, 0, 'YXZ'));
    _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
    for (const m of this.parts) m.setMatrixAt(i, _m);
  }
  setJump(i, amp) {
    this.jump[i * 3 + 1] = amp;
    for (const a of this.aJump) a.needsUpdate = true;
  }

  // ---------- performers ----------
  buildPerformers(scene) {
    const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    // headliner first, then two hype men and the DJ
    this.acts = [this.makeChuckyy(scene, mat)];
    const outfits = [[0xd23b2e, 0x2b3a55], [0x1c1d20, 0x1c1d20], [0xf7e531, 0x3a3f46]];
    outfits.forEach(([shirt, pants], k) => {
      const g = new THREE.Group();
      const skin = mat(pick(SKIN));
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.26, 8).scale(1, 1, 0.65), mat(shirt)); t.position.y = 0.44; g.add(t);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), skin); h.position.y = 0.64; g.add(h);
      const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.036, 0.31, 0); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.31, 6).translate(0, -0.155, 0), mat(pants)); p.add(l); g.add(p); return p; });
      const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.085, 0.55, 0); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.26, 5).translate(0, -0.13, 0), skin); p.add(a); g.add(p); return p; });
      const dj = k === 2;
      if (!dj) { const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.08, 5), mat(0x111111)); mic.position.set(0, -0.26, 0.02); arms[1].add(mic); }
      g.scale.setScalar(2.8);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      scene.add(g);
      const p = { g, legs, arms, dj, sp: 3.4, x: dj ? this.cx : rand(this.stage.x0 + 2, this.stage.x1 - 2), z: dj ? this.stage.z0 + 2.6 : rand(this.stage.z0 + 5, this.stage.z1 - 1), tx: 0, tz: 0, wait: 0, phase: rand(0, 6), yaw: 0 };
      p.tx = p.x; p.tz = p.z;
      this.acts.push(p);
    });
  }
  // Chuckyy, the headliner: a bobblehead-proportioned figure (big head on a small body) after the collectible —
  // red-brown dreads, neck tattoos, grey hoodie over a white tee, gold and silver chains, grey pants, tan boots
  makeChuckyy(scene, mat) {
    const g = new THREE.Group();
    const skin = mat(0xb87a52, 0.6), grey = mat(0x9a9ca1, 0.85), greyD = mat(0x7d7f84, 0.85), white = mat(0xf4f4f0), boot = mat(0xd9962e, 0.6);
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.9, roughness: 0.25 }), silver = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.25 });
    const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    // legs + boots
    const legs = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.075, 0.36, 0); g.add(p);
      add(p, new THREE.CylinderGeometry(0.058, 0.052, 0.3, 8).translate(0, -0.15, 0), greyD);
      add(p, new THREE.BoxGeometry(0.12, 0.08, 0.19), boot, 0, -0.31, 0.03);
      return p;
    });
    // hoodie body (open at the front over a white tee), hood bunched behind the neck
    add(g, new THREE.CylinderGeometry(0.15, 0.165, 0.36, 12).scale(1, 1, 0.72), grey, 0, 0.55, 0);
    add(g, new THREE.BoxGeometry(0.11, 0.33, 0.02), white, 0, 0.56, 0.115);
    add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12).scale(1, 1, 0.74), greyD, 0, 0.38, 0);   // waistband
    add(g, new THREE.TorusGeometry(0.1, 0.035, 6, 12).scale(1, 0.6, 0.8), grey, 0, 0.73, -0.06);        // hood
    // neck with tattoos, chains
    add(g, new THREE.CylinderGeometry(0.055, 0.06, 0.09, 10), mat(0x7a4a32, 0.7), 0, 0.77, 0);
    for (const [r, y, m, t] of [[0.085, 0.69, gold, 0.013], [0.1, 0.64, gold, 0.011], [0.12, 0.6, silver, 0.006]]) {
      const c = add(g, new THREE.TorusGeometry(r, t, 5, 20), m, 0, y, 0.035); c.rotation.x = Math.PI / 2 - 0.5; c.scale.set(1, 0.85, 1);
    }
    // arms in hoodie sleeves, hands
    const arms = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.17, 0.68, 0); g.add(p);
      add(p, new THREE.CylinderGeometry(0.05, 0.045, 0.3, 8).translate(0, -0.15, 0), grey);
      add(p, new THREE.SphereGeometry(0.04, 8, 6), skin, 0, -0.32, 0);
      return p;
    });
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.12, 6), mat(0x111111)); mic.position.set(0, -0.37, 0.03); arms[1].add(mic);
    // the bobble head: pivots on the neck
    const head = new THREE.Group(); head.position.set(0, 0.82, 0); g.add(head);
    add(head, new THREE.SphereGeometry(0.2, 18, 14).scale(0.92, 1.08, 0.95), skin, 0, 0.19, 0);
    for (const s of [-1, 1]) {
      add(head, new THREE.SphereGeometry(0.03, 8, 6).scale(1.2, 0.55, 0.5), mat(0xf2ede4), s * 0.07, 0.21, 0.172);       // heavy-lidded eyes
      add(head, new THREE.SphereGeometry(0.016, 6, 5), mat(0x2a1a12), s * 0.07, 0.205, 0.186);
      add(head, new THREE.BoxGeometry(0.07, 0.014, 0.02), mat(0x2a1a12), s * 0.07, 0.255, 0.17);                           // brows
      add(head, new THREE.SphereGeometry(0.035, 8, 6), skin, s * 0.185, 0.18, 0);                                             // ears
    }
    add(head, new THREE.SphereGeometry(0.035, 8, 6).scale(1, 0.8, 0.9), skin, 0, 0.15, 0.195);                               // nose
    add(head, new THREE.SphereGeometry(0.05, 10, 6).scale(1, 0.45, 0.4), mat(0x6e3a2e), 0, 0.075, 0.18);                    // mouth
    add(head, new THREE.BoxGeometry(0.035, 0.012, 0.01), white, 0, 0.078, 0.2);                                               // teeth
    // dreads: a thick crown plus locs hanging all round, clear of the face
    const locs = [];
    const locCols = [0x9a3a22, 0x8a321e, 0xa8452a, 0x7a2c1a, 0xb04e30];
    locs.push(tint(new THREE.SphereGeometry(0.215, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(0.95, 1.1, 1).translate(0, 0.19, -0.01), 0x8e3620));
    for (let k = 0; k < 46; k++) {
      const a = (k / 46) * Math.PI * 2 + rand(-0.06, 0.06);
      const front = Math.cos(a);                       // +z is the face
      const bang = front > 0.55, len = bang ? rand(0.08, 0.13) : rand(0.3, 0.46);
      const r0 = 0.2, y0 = (bang ? 0.37 : 0.3) + rand(-0.02, 0.04);
      // negative X tilt + Y turn points each loc outward from the head
      const geo = new THREE.CylinderGeometry(0.02, 0.013, len, 5).translate(0, -len / 2, 0)
        .rotateX(bang ? -1.1 : -0.22).rotateY(a).translate(Math.sin(a) * r0 * 0.95, y0, Math.cos(a) * r0 * 0.9);
      locs.push(tint(geo, pick(locCols)));
    }
    add(head, mergeGeometries(locs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    g.scale.setScalar(2.6);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    scene.add(g);
    const p = { g, legs, arms, head, star: true, sp: 2.8, x: this.cx, z: this.stage.z1 - 2, tx: this.cx, tz: this.stage.z1 - 2, wait: 1, phase: 0, yaw: 0 };
    return p;
  }
  updatePerformers(dt, beat) {
    const st = this.stage, f = beat % 1;
    for (const p of this.acts) {
      const hop = Math.pow(Math.sin(Math.PI * f), 0.8);
      if (p.dj) {
        p.g.position.set(p.x, st.y + 0.6 + hop * 0.05, p.z);
        p.g.rotation.y = 0;
        p.arms[0].rotation.x = -1.2 + hop * 0.2; p.arms[1].rotation.x = Math.sin(beat * Math.PI) > 0.6 ? -2.8 : -1.1;
        continue;
      }
      if (this.halt > 0) { p.tx = Math.max(st.x0 + 1, Math.min(st.x1 - 1, p.x)); p.tz = st.z0 + 1.6; }
      else if ((p.wait -= dt) <= 0 && Math.hypot(p.tx - p.x, p.tz - p.z) < 0.3) {
        // dart to a new spot on the front half of the stage, or hang at the lip to hype the crowd
        if (p.star) { p.tx = this.cx + rand(-8, 8); p.tz = Math.random() < 0.55 ? st.z1 - 1.3 : rand(st.z0 + 5, st.z1 - 1.5); }
        else { p.tx = rand(st.x0 + 1.5, st.x1 - 1.5); p.tz = Math.random() < 0.4 ? st.z1 - 0.8 : rand(st.z0 + 4, st.z1 - 1); }
        p.wait = rand(0.4, 2.2);
      }
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      const moving = d > 0.3, sp = this.halt > 0 ? 4 : p.sp;
      if (moving) { p.x += dx / d * Math.min(d, sp * dt); p.z += dz / d * Math.min(d, sp * dt); p.yaw = Math.atan2(dx, dz); }
      else p.yaw += (Math.atan2(0, 1) - p.yaw) * Math.min(1, dt * 6); // face the crowd
      const run = moving ? Math.sin(G.time * 16 + p.phase) : 0;
      p.g.position.set(p.x, st.y + (moving ? Math.abs(run) * 0.04 : hop * (this.halt > 0 ? 0 : 0.18)), p.z);
      p.g.rotation.y = p.yaw;
      p.legs[0].rotation.x = run * 0.8; p.legs[1].rotation.x = -run * 0.8;
      if (p.head) {
        // bobblehead: nods hard on every beat, wobbles side to side, sloshes when he runs
        const on = this.halt > 0 ? 0.3 : 1;
        p.head.rotation.x = on * (0.2 * Math.sin(beat * Math.PI * 2) + (moving ? 0.12 * Math.sin(G.time * 16) : 0));
        p.head.rotation.z = on * 0.14 * Math.sin(beat * Math.PI + 0.6);
      }
      if (this.halt > 0) { p.arms[0].rotation.x = p.arms[1].rotation.x = 0; continue; }
      // mic hand up, free hand pumping on the beat
      p.arms[1].rotation.x = -2.3 + Math.sin(G.time * 3 + p.phase) * 0.2;
      p.arms[0].rotation.x = moving ? -run * 0.9 : -1.6 - hop * 1.2;
    }
  }

  // ---------- lights + pyro ----------
  buildLights(scene) {
    const st = this.stage;
    const cone = new THREE.ConeGeometry(1.5, 26, 18, 1, true).translate(0, -13, 0);
    this.beams = [];
    for (let k = 0; k < 10; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: BEAM_COLORS[k % BEAM_COLORS.length], transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const m = new THREE.Mesh(cone, mat);
      m.position.set(st.x0 + 1 + k * (st.x1 - st.x0 - 2) / 9, 11, st.z1 - 0.2);
      m.frustumCulled = false; scene.add(m);
      this.beams.push({ m, k });
    }
    this.wash = [0, 1].map((k) => { const l = new THREE.PointLight(BEAM_COLORS[k], 0, 45, 1.3); l.position.set(this.cx + (k ? 8 : -8), 9, st.z1 + 6); scene.add(l); return l; });
    this.crowdLight = new THREE.PointLight(0xa24dff, 0, 60, 1.2); this.crowdLight.position.set(this.cx, 14, st.z1 + 18); scene.add(this.crowdLight);
    this.jets = [-12, -8, -4, 4, 8, 12].map((dx) => ({ x: this.cx + dx, z: st.z1 - 0.3 }));
  }
  firePyro(big) {
    const jets = big ? this.jets : [this.jets[0], this.jets[5]];
    for (const j of jets) this.pyro.push({ x: j.x, z: j.z, t: big ? 0.9 : 0.55, big });
    sfx.pyro(this.cx, this.stage.z1, big);
    G.fx.flash(this.cx, 4, this.stage.z1 + 2, 0xffa040, big ? 60 : 30, 0.5, 40);
    if (big) { for (const j of this.jets) G.fx.sparks(j.x, this.stage.y, j.z, 18, 4, 2.6, 1, 7); music.swell(0.5, 2.5); }
  }

  // ---------- reactions ----------
  inVenue(x, z, m = 0) { const S = this.site; return x > S.x0 - m && x < S.x1 + m && z > S.z0 - m && z < S.z1 + m; }
  // any weapon fired at the venue: people right there are knocked flying, then the whole place empties
  // (the game's own random incidents never clear the venue: only the player's weapons do)
  onBlast(x, y, z, r, power, kind) {
    if (kind === 'collapse' || !this.inVenue(x, z, 3)) return;
    // a brushed laser click isn't an attack: it takes about a second of holding the beam on the venue
    if (kind === 'laser') {
      this.laserHits = (this.laserHits || []).filter((t) => G.time - t < 2);
      this.laserHits.push(G.time);
      if (this.laserHits.length < 3 && !this.evac) return;
    }
    this.lastAttack = { kind, x, z, time: G.time };
    const kill = kind === 'wind' ? r * 0.55 : r * 0.28;
    if (power > 1.5) for (let i = 0; i < this.N; i++) {
      const h = this.home[i]; if (h.gone || h.out) continue;
      const dx = h[0] - x, dz = h[2] - z, d = Math.hypot(dx, dz);
      if (d >= kill) continue;
      const f = power * (1 - d / kill) * 0.8;
      h.gone = true; h.run = null; this.setJump(i, 0);
      this.flyers.push({ i, p: new THREE.Vector3(h[0], h[1], h[2]), v: new THREE.Vector3(dx / (d + 0.1) * f, f * 0.9 + 1, dz / (d + 0.1) * f), rot: 0, spin: rand(-8, 8), yaw: rand(0, 6.28) });
    }
    this.evacuate(x, z);
  }

  evacuate(x, z) {
    this.halt = 1e9; this.resetT = null;
    if (this.evac) return;
    this.evac = { x, z, t: 0 };
    const S = this.site, eastFront = this.grand.x0 - 1.5, westFront = this.westRows[0].x + 1.7;
    const street = { gate: S.z1 + 3.4, east: S.x1 + 3.4, west: S.x0 - 3.4 };    // road centre lines around the site
    for (let i = 0; i < this.N; i++) {
      const h = this.home[i]; if (h.gone) continue;
      const wps = [];
      // off the seats first: straight down the rows to the field edge
      if (h[1] > 0) wps.push({ x: h[0] > this.cx ? eastFront : westFront, z: h[2] + rand(-0.6, 0.6) });
      const from = wps[0] || { x: h[0], z: h[2] };
      const routes = this.exits.map((e, k) => {
        const j = rand(-e.w, e.w);
        let path;
        if (k === 0) path = [{ x: Math.max(this.cx - 3.5, Math.min(this.cx + 3.5, from.x)), z: S.z1 - 11 }, { x: e.x + j, z: S.z1 - 1.5 }, { x: e.x + j * 1.4, z: street.gate + rand(-1.2, 1.2) }];
        else if (k === 1) path = [{ x: westFront, z: e.z + j }, { x: S.x0 + 1, z: e.z + j }, { x: street.west + rand(-1.2, 1.2), z: e.z + j * 1.4 }];
        else path = [{ x: eastFront, z: e.z + j }, { x: S.x1 - 1, z: e.z + j }, { x: street.east + rand(-1.2, 1.2), z: e.z + j * 1.4 }];
        // then off down the street, away from the venue
        const last = path[path.length - 1], along = rand(10, 28) * (Math.random() < 0.5 ? -1 : 1);
        path.push(k === 0 ? { x: last.x + along, z: last.z } : { x: last.x, z: last.z + along });
        let len = 0, p0 = from;
        for (const q of path) { len += Math.hypot(q.x - p0.x, q.z - p0.z); p0 = q; }
        return { path, cost: len + (Math.hypot(e.x - x, e.z - z) < 16 ? 45 : 0) + rand(0, 6) };
      }).sort((a, b) => a.cost - b.cost);
      wps.push(...routes[0].path);
      h.run = { wps, delay: rand(0.1, 2.5), sp: rand(1.6, 2.8), y0: h[1] };
      this.setJump(i, 0);
    }
    this.U.hype.value = 0;
    for (const k of [0, 0.6, 1.4, 2.5]) setTimeout(() => sfx.screams(this.cx + rand(-15, 15), this.center.z + rand(-10, 10), 6), k * 1000);
    // everyone on the surrounding streets runs too, and the police get called in
    const A = G.agents, hs = { x: this.center.x, z: this.center.z };
    if (A) {
      for (const p of A.peds) {
        if (p.state === 'air' || p.state === 'down' || Math.hypot(p.pos.x - hs.x, p.pos.z - hs.z) > 75) continue;
        p.threat = { x, z }; p.state = 'flee'; p.timer = rand(10, 18);
      }
      for (const c of A.cars) if (c.state === 'drive' && !c.emerg && Math.hypot(c.pos.x - hs.x, c.pos.z - hs.z) < 75) { c.flee = rand(8, 14); c.threat = { x, z }; }
      A.report(x, z, 2.5);
    }
  }
  updateEvac(dt) {
    const E = this.evac; E.t += dt;
    let running = 0;
    for (let i = 0; i < this.N; i++) {
      const h = this.home[i], r = h.run;
      if (!r || h.out) continue;
      if ((r.delay -= dt) > 0) { running++; continue; }
      const wp = r.wps[0], dx = wp.x - h[0], dz = wp.z - h[2], d = Math.hypot(dx, dz), step = r.sp * dt;
      if (d <= step) { h[0] = wp.x; h[2] = wp.z; r.wps.shift(); if (!r.wps.length) { h.out = true; this.hide(i); continue; } }
      else { h[0] += dx / d * step; h[2] += dz / d * step; }
      if (h[1] > 0) h[1] = this.surfaceY(h[0], h[2]);                      // scrambling down the steps
      running++;
      this.place(i, h[0], h[1] + Math.abs(Math.sin(G.time * 14 + i)) * 0.03, h[2], Math.atan2(dx, dz));
    }
    for (const m of this.parts) m.instanceMatrix.needsUpdate = true;
    // once the grounds are empty, wait a while, then the show starts over with a fresh crowd
    if (!running && this.resetT == null) this.resetT = 45;
    if (this.resetT != null && (this.resetT -= dt) <= 0) this.restart();
  }
  // height of the stand treads under a point (0 on the field)
  surfaceY(x, z) {
    for (const r of [...this.standRows, ...this.westRows]) if (Math.abs(x - r.x) <= 0.45 && z > r.z0 - 1 && z < r.z1 + 1) return r.y;
    return 0;
  }
  hide(i) { _m.makeScale(0, 0, 0); for (const m of this.parts) m.setMatrixAt(i, _m); }
  restart() {
    this.evac = null; this.resetT = null; this.halt = 0; this.flyers.length = 0; this.movers.length = 0;
    const cx = this.cx, cz = this.stage.z1;
    this.home = this.orig.map((p) => p.slice());
    this.jump.set(this.origJump);
    for (const a of this.aJump) a.needsUpdate = true;
    this.home.forEach(([x, y, z], i) => this.place(i, x, y, z, Math.atan2(cx - x, cz - z) + rand(-0.3, 0.3)));
    for (const m of this.parts) m.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    if (!music.on && sfx.ready) music.start(this.cx, this.stage.z1 + 6);
    if (this.evac) this.updateEvac(dt);
    this.halt = Math.max(0, this.halt - dt);
    music.update(this.halt > 0);
    const beat = music.beat(), n = G.night || 0;
    this.U.beat.value = beat;
    this.U.hype.value += ((this.halt > 0 ? 0 : 1) - this.U.hype.value) * Math.min(1, dt * 4);
    // bars: pyro every 4 bars, a big burst on every drop (start of each 16-bar phrase)
    const bar = Math.floor(beat / 4);
    if (bar !== this.lastBar) {
      if (this.lastBar >= 0 && this.halt <= 0) {
        if (bar % 16 === 0) this.firePyro(true);
        else if (bar % 4 === 0 && bar % 16 !== 15) this.firePyro(false);
      }
      this.lastBar = bar;
    }
    for (const p of [...this.pyro]) {
      p.t -= dt;
      const k = p.big ? 10 : 6;
      for (let i = 0; i < k; i++) G.fx.fire.emit(p.x + rand(-0.12, 0.12), this.stage.y + 0.2, p.z + rand(-0.12, 0.12), rand(-0.3, 0.3), rand(9, 14) * (p.big ? 1.2 : 1), rand(-0.3, 0.3), rand(0.5, 1.0), rand(0.35, 0.6));
      if (p.t <= 0) this.pyro.splice(this.pyro.indexOf(p), 1);
    }
    // screens + beams + washes
    this.screenT = (this.screenT || 0) - dt;
    if (this.screenT <= 0) { this.screenT = 1 / 15; this.drawScreen(this.screenTex.image.getContext('2d'), 512, 288, this.halt > 0 ? 0.99 : beat); this.screenTex.needsUpdate = true; }
    const f = beat % 1, on = this.halt > 0 ? 0 : 1;
    for (const b of this.beams) {
      const a = G.time * 0.8 + b.k * 0.7;
      b.m.rotation.set(-0.55 + Math.sin(a) * 0.35, 0, Math.sin(a * 1.3 + b.k) * 0.5);
      b.m.material.opacity = on * (0.05 + n * 0.22) * (0.75 + 0.25 * (1 - f));
      if (f < 0.05) b.m.material.color.setHex(BEAM_COLORS[(bar + b.k) % BEAM_COLORS.length]);
    }
    this.wash.forEach((l, k) => { l.intensity = on * (10 + n * 50) * (0.6 + 0.4 * (1 - f)); if (f < 0.05) l.color.setHex(BEAM_COLORS[(bar * 2 + k * 3) % BEAM_COLORS.length]); });
    this.crowdLight.intensity = on * n * 40 * (0.5 + 0.5 * (1 - f));
    for (const m of this.mats) m.emissiveIntensity = 0.25 + n * 0.9;
    for (const l of this.towerLamps) l.material.color.setScalar(0.8 + n * 3);
    this.phones.visible = !this.evac;
    this.phones.material.color.setScalar(0.4 + n * 2.5);
    this.updatePerformers(dt, beat);
    // people blown into the air land and stay down; shoved people stumble back to a new spot
    for (const fl of [...this.flyers]) {
      fl.v.y -= 14 * dt; fl.p.addScaledVector(fl.v, dt); fl.rot += fl.spin * dt;
      if (fl.p.y <= 0 && fl.v.y < 0) { fl.p.y = 0.05; this.place(fl.i, fl.p.x, 0.05, fl.p.z, fl.yaw, Math.PI / 2); this.flyers.splice(this.flyers.indexOf(fl), 1); }
      else this.place(fl.i, fl.p.x, fl.p.y, fl.p.z, fl.yaw, fl.rot);
    }
    for (const mv of [...this.movers]) {
      mv.t = Math.min(1, mv.t + dt * 1.2);
      const e = 1 - (1 - mv.t) ** 2, h = this.home[mv.i];
      h[0] = mv.x0 + (mv.x1 - mv.x0) * e; h[2] = mv.z0 + (mv.z1 - mv.z0) * e;
      this.place(mv.i, h[0], h[1], h[2], Math.atan2(mv.x0 - mv.x1, mv.z0 - mv.z1));
      if (mv.t >= 1) { h.moving = false; this.movers.splice(this.movers.indexOf(mv), 1); }
    }
    if (this.flyers.length || this.movers.length) for (const m of this.parts) m.instanceMatrix.needsUpdate = true;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

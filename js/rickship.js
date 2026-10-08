// Rick's ship, Rick and Morty — ported from Cosmic Solitude (src/entities/ship/RickShipModel.ts,
// src/entities/ship/Headlight.ts, the plume shaders in ShipModel.ts, src/entities/astronaut/AstronautModel.ts and
// CartoonCharacterModel.ts). Same procedural geometry, materials, textures and animation, kept in Cosmic Solitude's
// own look on purpose (it's a crossover). Built at Cosmic Solitude's 1 unit = 1 m; js/rick.js scales the whole
// group down to Tiny World's miniature.
//   Differences from the original: no Cosmetics (both were fixed looks anyway); the headlights keep their visible
//   beam cones and lenses but cast no real light (adding spot lights recompiles every material in the city).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------- shaders (ShipModel.ts)
export const PLUME_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
export const PLUME_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCore;
uniform vec3 uEdge;
uniform float uPower;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  float along = vUv.y;            // 1 at nozzle, 0 at tip
  float rim = pow(max(abs(dot(vN, vV)), 1e-6), 1.6);
  float flicker = 0.9 + 0.1 * sin(uTime * 60.0 + along * 30.0);
  float diamonds = 0.75 + 0.25 * sin(along * 38.0 - uTime * 25.0);
  float a = pow(max(along, 1e-6), 1.6) * rim * flicker * mix(1.0, diamonds, 0.5);
  vec3 c = mix(uEdge, uCore, pow(max(rim, 1e-6), 3.0) * along);
  gl_FragColor = vec4(c * a * uPower, 1.0);
}
`;

// ---------------------------------------------------------------- headlight (Headlight.ts)
const BEAM_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main() {
  vAlong = uv.y;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;
const BEAM_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uLevel;
uniform vec3 uColor;
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  float core = pow(max(abs(dot(normalize(vN), normalize(vV))), 1e-6), 1.4);
  float fall = pow(max(vAlong, 1e-6), 2.2);
  float a = core * fall * uLevel * 0.22;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;
class Headlight {
  constructor(parent, at, dir, range = 1500, lensRadius = 0.18) {
    const d = dir.clone().normalize();
    this.level = 0;
    this.beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      uniforms: { uLevel: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.95, 0.85) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const len = Math.min(range, 90);
    const geo = new THREE.CylinderGeometry(lensRadius * 0.9, len * Math.tan(0.36), len, 24, 1, true);
    geo.translate(0, -len / 2, 0);
    const beam = new THREE.Mesh(geo, this.beamMat);
    beam.position.copy(at);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
    beam.renderOrder = 9;
    beam.frustumCulled = false;
    parent.add(beam);
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(lensRadius, 16), this.lensMat);
    lens.position.copy(at).addScaledVector(d, 0.02);
    lens.lookAt(lens.position.clone().add(d));
    parent.add(lens);
  }
  update(dt, on, boost = 1) {
    this.level += ((on ? 1 : 0) - this.level) * Math.min(1, dt * 6);
    this.beamMat.uniforms.uLevel.value = this.level * Math.min(1.6, boost);
    this.lensMat.color.setScalar(0.35 + this.level * 2.4);
  }
}

// ---------------------------------------------------------------- Rick's ship (RickShipModel.ts)
const RIM_R = 3.8, RING_R = 1.75, RING_Y = 0.42;
const PROFILE = [
  [RING_R, RING_Y + 0.02], [2.2, 0.32], [2.7, 0.14], [3.2, -0.08], [3.6, -0.26], [3.8, -0.38],
  [3.82, -0.5], [3.7, -0.6], [3.2, -0.72], [2.5, -0.86], [1.9, -1.0], [1.45, -1.16], [0.9, -1.3], [0.4, -1.37], [0.0, -1.39],
];

function hullTextures(rimV) {
  const W = 1024, H = 512;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
  const [mc, m] = mk();
  m.fillStyle = '#8f979c'; m.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + Math.random() * 40;
    m.fillStyle = `rgba(${v},${v + 4},${v + 8},0.18)`;
    const r = 6 + Math.random() * 46;
    m.beginPath(); m.ellipse(Math.random() * W, Math.random() * H, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2); m.fill();
  }
  for (let i = 0; i < 260; i++) {
    m.strokeStyle = `rgba(${Math.random() < 0.6 ? '60,58,52' : '210,214,216'},${0.06 + Math.random() * 0.1})`;
    m.lineWidth = 0.6 + Math.random() * 1.2;
    const x = Math.random() * W, y = Math.random() * H;
    m.beginPath(); m.moveTo(x, y); m.lineTo(x + (Math.random() - 0.5) * 40, y + Math.random() * 30); m.stroke();
  }
  const [ec, e] = mk();
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const yRim = rimV * H;
  for (let k = 0; k < 8; k++) {
    const x = ((k + 0.5) / 8) * W;
    m.fillStyle = 'rgba(30,30,30,0.9)'; m.fillRect(x - 6, 0, 12, yRim);
    const g = e.createLinearGradient(x - 6, 0, x + 6, 0);
    g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(0.3, 'rgba(255,120,30,1)'); g.addColorStop(0.5, 'rgba(255,200,90,1)');
    g.addColorStop(0.7, 'rgba(255,120,30,1)'); g.addColorStop(1, 'rgba(255,90,20,0)');
    e.fillStyle = g; e.fillRect(x - 6, 6, 12, yRim - 10);
    for (let y = 10; y < yRim; y += 14) { e.fillStyle = 'rgba(255,60,10,0.6)'; e.fillRect(x - 3 + Math.sin(y * 0.3 + k) * 2, y, 2, 6); }
  }
  m.fillStyle = 'rgba(40,40,40,0.8)'; m.fillRect(0, yRim - 2, W, 4);
  const [rc, r] = mk();
  r.drawImage(mc, 0, 0);
  const id = r.getImageData(0, 0, W, H);
  for (let i = 0; i < id.data.length; i += 4) { const v = 255 - id.data[i] * 0.9; id.data[i] = id.data[i + 1] = id.data[i + 2] = Math.max(70, Math.min(230, v + 40)); }
  r.putImageData(id, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(mc, true), emissive: tex(ec, true), rough: tex(rc, false) };
}

function stickerTexture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  if (kind === 0) {
    g.fillStyle = '#5fd0c8'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#123'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(30, 50); g.bezierCurveTo(60, 20, 90, 80, 120, 45); g.bezierCurveTo(150, 15, 190, 85, 225, 50); g.stroke();
    g.beginPath(); g.moveTo(40, 92); g.lineTo(210, 92); g.stroke();
  } else if (kind === 1) {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#f2efe8' : '#c8322c'; g.fillRect(0, 64 + i * 13, 256, 13); }
    g.fillStyle = '#2b4a8a'; g.fillRect(0, 0, 100, 64);
    g.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) g.fillRect(10 + (i % 4) * 22, 12 + Math.floor(i / 4) * 24, 8, 8);
  } else {
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = '#8ccf3a'; g.beginPath(); g.arc(128, 64, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2d5a10'; g.lineWidth = 4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(128, 64, 44, 16, (i * Math.PI) / 3, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#2d5a10'; g.beginPath(); g.arc(128, 64, 7, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function hullPoint(phi, r) {
  let y = PROFILE[0][1], slope = 0;
  for (let i = 0; i < 5; i++) {
    const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1];
    if (r >= r0 && r <= r1) { const t = (r - r0) / (r1 - r0); y = y0 + (y1 - y0) * t; slope = (y1 - y0) / (r1 - r0); }
  }
  const s = Math.sin(phi), c = Math.cos(phi);
  return { p: new THREE.Vector3(r * s, y, r * c), n: new THREE.Vector3(-slope * s, 1, -slope * c).normalize() };
}
const phiTangent = (side) => Math.PI + side * 0.55;
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

export class RickShipModel {
  constructor() {
    this.root = new THREE.Group();
    this.seat = new THREE.Object3D();
    this.passengerSeat = new THREE.Object3D();
    this.colliders = [[0, -1.75, 0], [0, -1.4, -1.6], [0, -1.4, 1.6], [3.7, -0.5, 0], [-3.7, -0.5, 0], [0, -0.5, -3.7], [0, -0.5, 3.7],
      [2.6, -0.5, 2.6], [-2.6, -0.5, 2.6], [2.6, -0.5, -2.6], [-2.6, -0.5, -2.6], [0, 2.2, 0]];
    this.state = { throttle: 0, boost: 0, sonic: 0, gear: 0, canopy: 0, thrustersUp: 0, headlights: true, headlightBoost: 1 };
    this.time = 0;
    this.canopyPivot = new THREE.Group();
    this.plumes = []; this.plumeMats = []; this.wheels = []; this.rcs = []; this.headlights = [];
    const add = (parent, o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); parent.add(o); return o; };
    const bronze = new THREE.MeshStandardMaterial({ color: 0x8a6c3e, metalness: 0.85, roughness: 0.42 });
    const darkBronze = new THREE.MeshStandardMaterial({ color: 0x4e3d24, metalness: 0.8, roughness: 0.5 });
    const canMetal = new THREE.MeshStandardMaterial({ color: 0x7c7867, metalness: 0.75, roughness: 0.5 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.78 });
    const leatherDark = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.82 });
    const blackPlastic = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0xe8b83a, roughness: 0.55 });
    const lampHousing = new THREE.MeshStandardMaterial({ color: 0xe0a33a, roughness: 0.5, metalness: 0.2 });
    const tape = new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.95 });

    // --- Hull (lathe) ---
    const spline = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
    const smoothPts = spline.getPoints(64).reverse();
    let rimIdx = 0;
    smoothPts.forEach((p, i) => { if (p.x > smoothPts[rimIdx].x) rimIdx = i; });
    const tx = hullTextures((smoothPts.length - 1 - rimIdx) / (smoothPts.length - 1));
    this.seamMat = new THREE.MeshStandardMaterial({
      map: tx.map, roughnessMap: tx.rough, roughness: 0.62, metalness: 0.55,
      emissiveMap: tx.emissive, emissive: new THREE.Color(1, 0.55, 0.2), emissiveIntensity: 2.4, bumpMap: tx.rough, bumpScale: 0.4,
    });
    const hullGeo = new THREE.LatheGeometry(smoothPts, 96);
    hullGeo.computeVertexNormals();
    add(this.root, new THREE.Mesh(hullGeo, this.seamMat));
    add(this.root, new THREE.Mesh(new THREE.TorusGeometry(RIM_R - 0.02, 0.07, 10, 96), darkBronze), 0, -0.44, 0).rotation.x = Math.PI / 2;

    // --- Wheel pods & wheels ---
    const podMat = new THREE.MeshStandardMaterial({ map: tx.map, roughnessMap: tx.rough, roughness: 0.6, metalness: 0.55 });
    for (const [x, z] of [[-1.55, -1.25], [1.55, -1.25], [-1.55, 1.35], [1.55, 1.35]]) {
      const pod = add(this.root, new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 14), podMat), x, -1.0, z);
      pod.scale.set(0.75, 0.6, 1);
      const wheel = new THREE.Group();
      wheel.position.set(x * 1.08, -1.25, z);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.32, 24), rubber); tyre.rotation.z = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 16), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.7, roughness: 0.35 })); hub.rotation.z = Math.PI / 2;
      wheel.add(tyre, hub); this.root.add(wheel); this.wheels.push(wheel);
    }
    for (let i = 0; i < 6; i++) add(this.root, new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.05), blackPlastic), 0, -1.32, 1.0 + i * 0.1);

    // --- Cockpit ring with screw heads ---
    add(this.root, new THREE.Mesh(new THREE.TorusGeometry(RING_R + 0.02, 0.12, 14, 96), bronze), 0, RING_Y + 0.04, 0).rotation.x = Math.PI / 2;
    add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(RING_R + 0.12, RING_R + 0.18, 0.16, 96, 1, true), darkBronze), 0, RING_Y - 0.06, 0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const screw = add(this.root, new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), bronze), Math.sin(a) * (RING_R + 0.16), RING_Y - 0.02, Math.cos(a) * (RING_R + 0.16));
      screw.rotation.set(0, a, 0);
      screw.lookAt(screw.position.clone().multiplyScalar(2).setY(RING_Y + 0.4));
      screw.rotateX(Math.PI / 2);
    }

    // --- Interior ---
    const floor = add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(RING_R - 0.05, RING_R - 0.25, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.85 })), 0, 0.05, 0);
    floor.receiveShadow = true;
    add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(RING_R - 0.04, RING_R - 0.2, 0.5, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3631, roughness: 0.8, side: THREE.BackSide })), 0, 0.2, 0);
    const cushionTop = 0.42;
    const makeSeat = (x) => {
      const g = new THREE.Group(); g.position.set(x, 0, 0.05); this.root.add(g);
      add(g, new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.24, 0.64, 3, 0.08), leather), 0, cushionTop - 0.12, 0);
      const back = add(g, new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.86, 0.18, 3, 0.08), leather), 0, cushionTop + 0.42, 0.36);
      back.rotation.x = 0.16;
      for (let i = 0; i < 3; i++) add(back, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.015, 0.01), leatherDark), 0, -0.25 + i * 0.22, -0.095);
      const head = add(g, new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.26, 0.14, 3, 0.06), leather), 0, cushionTop + 1.0, 0.47);
      head.rotation.x = 0.16;
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), blackPlastic), -0.12, cushionTop + 0.86, 0.45);
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), blackPlastic), 0.12, cushionTop + 0.86, 0.45);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), blackPlastic), 0, 0.15, 0);
    };
    makeSeat(-0.52); makeSeat(0.52);
    this.seat.position.set(-0.52, cushionTop - 0.1, -0.02);
    this.passengerSeat.position.set(0.52, cushionTop - 0.1, -0.02);
    this.root.add(this.seat, this.passengerSeat);
    const dash = add(this.root, new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.36, 0.5, 3, 0.1), new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 0.7 })), 0, 0.62, -1.15);
    dash.rotation.x = -0.35;
    for (let i = 0; i < 5; i++) add(dash, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), new THREE.MeshBasicMaterial({ color: [0xff5040, 0x60ff80, 0xffcc40, 0x50b0ff, 0xff60c0][i] })), -0.5 + i * 0.25, 0.19, -0.05);
    const column = add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), blackPlastic), -0.52, 0.78, -0.82);
    column.rotation.x = 0.9;
    const wheel = add(this.root, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 8, 28), blackPlastic), -0.52, 0.98, -0.62);
    wheel.rotation.x = -0.6;
    add(wheel, new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.03), blackPlastic));
    add(this.root, new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.3, 0.7, 2, 0.05), leatherDark), 0, 0.3, -0.1);
    const lever = add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 })), 0, 0.58, -0.2);
    lever.rotation.x = -0.4;
    add(lever, new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), blackPlastic), 0, 0.17, 0);
    const tank = add(this.root, new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.25, 8, 20), new THREE.MeshStandardMaterial({ color: 0x1e2022, metalness: 0.6, roughness: 0.35 })), 0, 0.55, 0.95);
    tank.rotation.z = Math.PI / 2;
    this.tankGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 0.4) });
    for (const x of [-0.35, 0.35]) add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.14, 24), this.tankGlow), x, 0.55, 0.95).rotation.z = Math.PI / 2;
    for (const x of [-0.6, 0, 0.6]) add(this.root, new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 6, 24), canMetal), x, 0.55, 0.95).rotation.y = Math.PI / 2;

    // --- Canopy: glass dome + bronze grab-arch, hinged at the back ---
    this.canopyPivot.position.set(0, RING_Y + 0.1, RING_R);
    this.root.add(this.canopyPivot);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(RING_R + 0.02, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    dome.position.set(0, 0, -RING_R); dome.renderOrder = 8; dome.castShadow = false;
    this.canopyPivot.add(dome);
    const sheen = new THREE.Mesh(new THREE.SphereGeometry(RING_R + 0.03, 40, 20, Math.PI * 1.15, 0.5, 0.25, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }));
    sheen.position.copy(dome.position); this.canopyPivot.add(sheen);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(RING_R + 0.1, 0.07, 10, 64, Math.PI), bronze);
    arch.position.set(0, 0, -RING_R); arch.rotation.y = 0.55; this.canopyPivot.add(arch);
    add(this.canopyPivot, new THREE.Mesh(new THREE.TorusGeometry(RING_R + 0.03, 0.06, 8, 96), bronze), 0, 0.02, -RING_R).rotation.x = Math.PI / 2;

    // --- Trash-can thrusters on corrugated hoses ---
    this.canGlow = new THREE.MeshBasicMaterial({ color: 0x223322 });
    for (const side of [-1, 1]) {
      const can = new THREE.Group();
      can.position.set(side * 2.35, 0.55, 2.15); can.rotation.y = side * -0.32; can.rotation.x = 0.12;
      this.root.add(can);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 1.25, 28, 1, true), canMetal.clone());
      body.rotation.x = Math.PI / 2; body.material.side = THREE.DoubleSide; can.add(body);
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(can, new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, 1.0, 2, 0.02), canMetal), Math.cos(a) * 0.49, Math.sin(a) * 0.49, 0).rotation.z = a; }
      add(can, new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 32), canMetal), 0, 0, -0.62);
      add(can, new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.04, 8, 32), canMetal), 0, 0, 0.62);
      add(can, new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), canMetal), 0, 0, -0.62).rotation.y = Math.PI;
      add(can, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), darkBronze), side * 0.5, 0.1, -0.5);
      add(can, new THREE.Mesh(new THREE.CircleGeometry(0.44, 28), this.canGlow), 0, 0, 0.35);
      const plumeMat = new THREE.ShaderMaterial({
        vertexShader: PLUME_VERT, fragmentShader: PLUME_FRAG,
        uniforms: { uCore: { value: new THREE.Color(0.9, 1.0, 0.85) }, uEdge: { value: new THREE.Color(0.3, 0.9, 0.5) }, uPower: { value: 0 }, uTime: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const plumeGeo = new THREE.CylinderGeometry(0.42, 0.06, 1, 24, 8, true);
      plumeGeo.translate(0, -0.5, 0); plumeGeo.rotateX(-Math.PI / 2);
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.z = 0.62; plume.renderOrder = 10; plume.frustumCulled = false;
      can.add(plume); this.plumes.push(plume); this.plumeMats.push(plumeMat);
      const start = new THREE.Vector3(side * 2.1, 0.62, 1.55), end = new THREE.Vector3(side * 1.55, 0.5, 1.05);
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(side * 0.25, 0.45, 0.1));
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      add(this.root, new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.15, 12), hoseMat));
      for (let i = 0; i <= 9; i++) {
        const t = i / 9, p = curve.getPoint(t), tan = curve.getTangent(t);
        const ring = add(this.root, new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), hoseMat), p.x, p.y, p.z);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      }
    }

    // --- Taped-on headlights on the front slope ---
    this.lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2) });
    for (const side of [-1, 1]) {
      const { p, n } = hullPoint(Math.PI + side * 0.55, 3.0);
      const lamp = new THREE.Group();
      lamp.position.copy(p).addScaledVector(n, 0.12);
      lamp.lookAt(p.clone().add(new THREE.Vector3(Math.sin(Math.PI + side * 0.3), 0.05, Math.cos(Math.PI + side * 0.3))));
      const beamDir = new THREE.Vector3(Math.sin(Math.PI + side * 0.18), -0.06, Math.cos(Math.PI + side * 0.18));
      this.headlights.push(new Headlight(this.root, lamp.position.clone().addScaledVector(beamDir, 0.16), beamDir, 1500, 0.15));
      this.root.add(lamp);
      add(lamp, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.28, 18), lampHousing)).rotation.x = Math.PI / 2;
      add(lamp, new THREE.Mesh(new THREE.CircleGeometry(0.16, 18), this.lampMat), 0, 0, 0.145);
      add(lamp, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 18), lampHousing), 0, 0, 0.14);
      add(lamp, new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16, Math.PI), lampHousing), 0, 0, -0.02);
      for (const sx of [-1, 1]) {
        const t = add(this.root, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.42), tape));
        t.position.copy(p).addScaledVector(n, 0.02).add(new THREE.Vector3(Math.cos(phiTangent(side)) * sx * 0.16, 0, Math.sin(phiTangent(side)) * sx * 0.16));
        t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        t.rotateY(sx * 0.4);
      }
    }

    // --- Stickers ---
    for (const [phi, r, kind, w, hgt] of [[Math.PI - 0.95, 3.15, 0, 0.62, 0.3], [Math.PI - 1.2, 3.25, 1, 0.5, 0.25], [Math.PI - 1.05, 3.55, 2, 0.32, 0.32]]) {
      const { p, n } = hullPoint(phi, r);
      const m = add(this.root, new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshStandardMaterial({ map: stickerTexture(kind), transparent: kind === 2, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })));
      m.position.copy(p).addScaledVector(n, 0.015);
      m.lookAt(m.position.clone().add(n));
      m.rotateZ(phi + Math.PI);
    }
    add(this.root, new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.9, 6), canMetal), 0.4, 0.75, 2.4);
    add(this.root, new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4030 })), 0.4, 1.2, 2.4);

    // --- RCS puffs under the rim ---
    for (const [x, z] of [[2.8, 0], [-2.8, 0], [0, 2.8], [0, -2.8]]) {
      this.rcs.push(add(this.root, new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })), x, -0.9, z));
    }

    this.root.traverse((o) => {
      if (!o.isMesh) return;
      const mat = o.material, additive = mat.blending === THREE.AdditiveBlending || mat instanceof THREE.MeshBasicMaterial;
      o.castShadow = !additive && !mat.transparent;
      o.receiveShadow = !additive;
    });
    this.root.name = 'RickShip';
  }

  update(dt) {
    this.time += dt;
    const s = this.state;
    for (const h of this.headlights) h.update(dt, s.headlights, s.headlightBoost);
    const power = Math.max(0.05, s.throttle * 0.9 + s.boost * 0.6);
    const len = 0.8 + s.throttle * 3.2 + s.boost * 3;
    for (const p of this.plumes) p.scale.set(1, 1, len);
    for (const m of this.plumeMats) { m.uniforms.uPower.value = power * 1.4; m.uniforms.uTime.value = this.time; }
    this.canGlow.color.setRGB(0.02 + power * 0.5, 0.03 + power * 1.4, 0.025 + power * 0.6);
    this.seamMat.emissiveIntensity = 2.0 + 0.4 * Math.sin(this.time * 1.7) + power * 1.2;
    this.tankGlow.color.setRGB(1.4 + 0.3 * Math.sin(this.time * 3), 1.8, 0.35);
    const g = smooth(s.gear);
    for (const w of this.wheels) { w.position.y = -1.0 - 0.38 * g; w.visible = g > 0.02; }
    this.canopyPivot.rotation.x = smooth(s.canopy) * 0.95;
    for (const r of this.rcs) { r.material.opacity = Math.min(1, Math.abs(s.thrustersUp)) * (0.5 + 0.4 * Math.random()); r.rotation.x = s.thrustersUp >= 0 ? 0 : Math.PI; }
    this.lampMat.color.setRGB(1.5, 1.4, 1.1);
  }
}

// ---------------------------------------------------------------- the figure rig (AstronautModel.ts)
// Only the skeleton and its procedural animation are needed: the cartoon characters replace every suit mesh.
class FigureRig {
  constructor() {
    this.root = new THREE.Group();
    this.pelvis = new THREE.Object3D(); this.spine = new THREE.Object3D(); this.chest = new THREE.Object3D();
    this.neck = new THREE.Object3D(); this.head = new THREE.Object3D();
    this.phase = 0; this.time = 0;
    this.blend = { walk: 0, seated: 0 };
    this.root.add(this.pelvis); this.pelvis.position.set(0, 0.98, 0);
    this.pelvis.add(this.spine); this.spine.position.set(0, 0.12, 0);
    this.spine.add(this.chest); this.chest.position.set(0, 0.2, 0);
    this.chest.add(this.neck); this.neck.position.set(0, 0.24, 0);
    this.neck.add(this.head); this.head.position.set(0, 0.14, -0.01);
    const makeArm = (side) => {
      const upper = new THREE.Object3D(); upper.position.set(side * 0.29, 0.13, 0); this.chest.add(upper);
      const mid = new THREE.Object3D(); mid.position.set(0, -0.3, 0); upper.add(mid);
      const end = new THREE.Object3D(); end.position.set(0, -0.27, 0); mid.add(end);
      return { upper, mid, end };
    };
    const makeLeg = (side) => {
      const upper = new THREE.Object3D(); upper.position.set(side * 0.12, -0.06, 0); this.pelvis.add(upper);
      const mid = new THREE.Object3D(); mid.position.set(0, -0.44, 0); upper.add(mid);
      const end = new THREE.Object3D(); end.position.set(0, -0.4, 0); mid.add(end);
      return { upper, mid, end };
    };
    this.armL = makeArm(-1); this.armR = makeArm(1); this.legL = makeLeg(-1); this.legR = makeLeg(1);
  }
  // the original's update(), for the poses used here (seated in the cockpit; idle as fallback)
  update(dt, pose = 'seated') {
    this.time += dt;
    const b = this.blend, rate = 1 - Math.exp(-dt * 6);
    b.seated += ((pose === 'seated' ? 1 : 0) - b.seated) * rate;
    const breathe = Math.sin(this.time * 1.6) * 0.012;
    let hipL = 0, hipR = 0, kneeL = 0.05, kneeR = 0.05, shL = 0.05, shR = 0.05, elL = -0.35, elR = -0.35;
    let armOut = 0.22, spineX = 0.04 + breathe, pelvisY = 0.98, footL = 0, footR = 0;
    if (b.seated > 0.001) {
      const s = b.seated;
      hipL = hipL * (1 - s) + s * 1.45; hipR = hipR * (1 - s) + s * 1.45;
      kneeL = kneeL * (1 - s) + s * 1.35; kneeR = kneeR * (1 - s) + s * 1.35;
      shL = shL * (1 - s) + s * 0.75; shR = shR * (1 - s) + s * 0.85;
      elL = elL * (1 - s) + s * -0.9; elR = elR * (1 - s) + s * -0.8;
      armOut = armOut * (1 - s) + s * 0.12;
      spineX = spineX * (1 - s) + s * -0.12;
      pelvisY = pelvisY * (1 - s) + s * 0.5;
      footL = footL * (1 - s) + s * -0.2; footR = footR * (1 - s) + s * -0.2;
    }
    this.pelvis.position.y = pelvisY;
    this.spine.rotation.x = -spineX;
    this.chest.scale.set(1 + breathe * 0.5, 1, 1 + breathe);
    this.head.rotation.x = Math.sin(this.time * 0.37) * 0.03;
    this.head.rotation.y = Math.sin(this.time * 0.23) * 0.12;
    this.legL.upper.rotation.x = hipL; this.legR.upper.rotation.x = hipR;
    this.legL.mid.rotation.x = -kneeL; this.legR.mid.rotation.x = -kneeR;
    this.legL.end.rotation.x = kneeL - hipL + footL; this.legR.end.rotation.x = kneeR - hipR + footR;
    this.legL.upper.rotation.z = -0.03; this.legR.upper.rotation.z = 0.03;
    this.armL.upper.rotation.set(shL, 0, -armOut); this.armR.upper.rotation.set(shR, 0, armOut);
    this.armL.mid.rotation.x = -elL; this.armR.mid.rotation.x = -elR;
    this.armL.end.rotation.x = -0.1; this.armR.end.rotation.x = -0.1;
  }
}

// ---------------------------------------------------------------- Rick and Morty (CartoonCharacterModel.ts)
let toonRamp = null;
function ramp() {
  if (toonRamp) return toonRamp;
  toonRamp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
  toonRamp.needsUpdate = true;
  return toonRamp;
}
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x14161a, side: THREE.BackSide });
outlineMat.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normal * 0.0075;'); };

export class CartoonCharacter extends FigureRig {
  constructor(kind) {
    super();
    this.kind = kind;
    this.figureScale = kind === 'morty' ? 0.84 : 1;
    this.root.scale.setScalar(this.figureScale);
    if (kind === 'rick') this.buildRick(); else if (kind === 'dad') this.buildDad(); else if (kind === 'guy') this.buildGuy(); else this.buildMorty();
    this.head.scale.setScalar({ rick: 1.38, morty: 1.3, dad: 1.22, guy: 1.15 }[kind] ?? 1.3);
    const parts = [];
    this.root.traverse((o) => { if (o.isMesh && !o.userData.noOutline) parts.push(o); });
    for (const m of parts) { const o = new THREE.Mesh(m.geometry, outlineMat); o.userData.noOutline = true; o.castShadow = false; m.add(o); }
    this.root.name = { rick: 'Rick', morty: 'Morty', dad: 'Dad', guy: 'Pilot' }[kind] || kind;
  }
  toon(color) { return new THREE.MeshToonMaterial({ color, gradientMap: ramp() }); }
  add(parent, geo, mat, x = 0, y = 0, z = 0, outline = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (!outline) m.userData.noOutline = true;
    parent.add(m); return m;
  }
  face(head, o) {
    const white = this.toon(0xffffff), black = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
    for (const s of [-1, 1]) {
      const eye = this.add(head, new THREE.SphereGeometry(o.eyeR, 20, 14), white, s * o.eyeX, o.eyeY, o.eyeZ);
      eye.scale.set(1, 1.08, 0.6);
      this.add(eye, new THREE.SphereGeometry(o.eyeR * 0.13, 8, 6), black, 0, 0, -o.eyeR * 0.98, false);
    }
  }
  hand(parent, skin, side, s = 1) {
    this.add(parent, new RoundedBoxGeometry(0.075 * s, 0.085 * s, 0.035 * s, 2, 0.014 * s), skin, 0, -0.05 * s, 0);
    for (let f = 0; f < 3; f++) { const fing = this.add(parent, new THREE.CapsuleGeometry(0.011 * s, 0.05 * s, 4, 8), skin, (-0.022 + f * 0.022) * s, -0.115 * s, 0, false); fing.rotation.x = 0.2; }
    const thumb = this.add(parent, new THREE.CapsuleGeometry(0.012 * s, 0.035 * s, 4, 8), skin, side * -0.045 * s, -0.06 * s, -0.015 * s, false);
    thumb.rotation.z = side * 0.6;
  }
  buildRick() {
    const coat = this.toon(0xf1f2ee), shirt = this.toon(0x8fd6dc), pants = this.toon(0x7b5a34), skin = this.toon(0xd6d2c4);
    const hair = this.toon(0xa9dcef), brow = this.toon(0x6d8794), shoe = this.toon(0x2a2a2c), sock = this.toon(0xf4f4f2);
    const belt = this.toon(0x3a2c1c), buckle = this.toon(0xd9b030);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
    this.add(this.pelvis, new RoundedBoxGeometry(0.27, 0.17, 0.17, 3, 0.06), pants, 0, -0.03, 0);
    this.add(this.pelvis, new THREE.CylinderGeometry(0.14, 0.14, 0.04, 20), belt, 0, 0.07, 0);
    this.add(this.pelvis, new RoundedBoxGeometry(0.06, 0.04, 0.02, 2, 0.006), buckle, 0, 0.07, -0.14);
    const skirtBack = this.add(this.pelvis, new RoundedBoxGeometry(0.36, 0.7, 0.03, 2, 0.012), coat, 0, -0.25, 0.1);
    skirtBack.rotation.x = -0.06;
    for (const s of [-1, 1]) { const flap = this.add(this.pelvis, new RoundedBoxGeometry(0.13, 0.7, 0.03, 2, 0.012), coat, s * 0.15, -0.25, -0.05); flap.rotation.set(0.05, s * 0.5, s * 0.06); }
    this.add(this.spine, cap(0.11, 0.06), shirt, 0, 0.03, 0).scale.set(1.1, 1, 0.8);
    this.add(this.chest, new RoundedBoxGeometry(0.28, 0.38, 0.17, 3, 0.06), shirt, 0, 0.0, 0);
    this.add(this.chest, new RoundedBoxGeometry(0.36, 0.42, 0.03, 2, 0.012), coat, 0, 0.0, 0.1);
    for (const s of [-1, 1]) {
      this.add(this.chest, new RoundedBoxGeometry(0.03, 0.42, 0.2, 2, 0.012), coat, s * 0.17, 0, 0.0);
      const lapel = this.add(this.chest, new RoundedBoxGeometry(0.09, 0.44, 0.03, 2, 0.012), coat, s * 0.125, -0.01, -0.095);
      lapel.rotation.set(0, s * 0.3, s * 0.08);
      this.add(this.chest, new THREE.SphereGeometry(0.06, 12, 8), coat, s * 0.17, 0.17, 0).scale.set(1, 0.6, 1.2);
    }
    this.add(this.neck, new THREE.CylinderGeometry(0.035, 0.04, 0.16, 12), skin, 0, 0.03, 0);
    const headMesh = this.add(this.head, new THREE.SphereGeometry(0.115, 32, 24), skin, 0, 0.12, -0.005);
    headMesh.scale.set(0.95, 1.45, 1.05);
    this.add(this.head, new THREE.SphereGeometry(0.08, 20, 14), skin, 0, 0.02, -0.03).scale.set(0.95, 0.75, 0.95);
    this.face(this.head, { eyeR: 0.042, eyeX: 0.047, eyeY: 0.155, eyeZ: -0.105, skin });
    const ub = this.add(this.head, new RoundedBoxGeometry(0.19, 0.03, 0.04, 2, 0.012), brow, 0, 0.22, -0.103);
    ub.rotation.x = 0.15;
    const nose = this.add(this.head, new THREE.CapsuleGeometry(0.02, 0.05, 4, 10), skin, 0, 0.09, -0.135);
    nose.rotation.x = 1.1;
    this.add(this.head, new RoundedBoxGeometry(0.075, 0.012, 0.012, 1, 0.005), new THREE.MeshBasicMaterial({ color: 0x2a2020 }), 0, 0.03, -0.1, false);
    this.add(this.head, new THREE.CapsuleGeometry(0.006, 0.025, 3, 6), new THREE.MeshToonMaterial({ color: 0x9adf6a, gradientMap: ramp() }), 0.02, 0.0, -0.1, false);
    for (const s of [-1, 1]) this.add(this.head, new THREE.SphereGeometry(0.03, 10, 8), skin, s * 0.11, 0.12, 0.0).scale.set(0.5, 1, 0.8);
    const capMesh = this.add(this.head, new THREE.SphereGeometry(0.125, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, 0, 0.14, 0.03);
    capMesh.scale.set(1.0, 1.45, 1.05); capMesh.rotation.x = -0.55;
    const spikes = [];
    for (let i = 0; i < 13; i++) { const a = -Math.PI * 0.62 + (i / 12) * Math.PI * 1.24; spikes.push([Math.sin(a), 0.15 + 0.12 * Math.cos(i * 1.7), Math.cos(a)]); }
    for (let i = 0; i < 5; i++) spikes.push([(i - 2) * 0.35, 1, 0.35 + Math.abs(i - 2) * 0.1]);
    for (const [x, y, z] of spikes) {
      const dir = new THREE.Vector3(x, y, z).normalize();
      const spike = this.add(this.head, new THREE.ConeGeometry(0.04, 0.16, 8), hair, 0, 0, 0);
      spike.position.set(0, 0.16, 0.035).addScaledVector(dir, 0.13).add(new THREE.Vector3(0, dir.y * 0.06, 0));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    for (const [limb, side] of [[this.armL, -1], [this.armR, 1]]) {
      this.add(limb.upper, cap(0.05, 0.22), coat, 0, -0.15, 0);
      this.add(limb.mid, cap(0.045, 0.2), coat, 0, -0.13, 0);
      this.add(limb.mid, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14), shirt, 0, -0.25, 0);
      this.hand(limb.end, skin, side);
    }
    for (const limb of [this.legL, this.legR]) {
      this.add(limb.upper, cap(0.055, 0.34), pants, 0, -0.21, 0);
      this.add(limb.mid, cap(0.05, 0.3), pants, 0, -0.18, 0);
      this.add(limb.end, new THREE.CylinderGeometry(0.042, 0.042, 0.08, 12), sock, 0, 0.02, 0);
      this.add(limb.end, new RoundedBoxGeometry(0.11, 0.08, 0.24, 3, 0.04), shoe, 0, -0.045, -0.05);
    }
  }
  buildMorty() {
    const tee = this.toon(0xf3e15a), jeans = this.toon(0x2f4f8e), skin = this.toon(0xf4d2a4), hairMat = this.toon(0x6e4a2c), shoe = this.toon(0xf2f2f0);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
    this.add(this.pelvis, new RoundedBoxGeometry(0.3, 0.2, 0.2, 3, 0.07), jeans, 0, -0.03, 0);
    this.add(this.spine, cap(0.13, 0.08), tee, 0, 0.03, 0).scale.set(1.15, 1, 0.85);
    this.add(this.chest, new RoundedBoxGeometry(0.34, 0.4, 0.21, 3, 0.08), tee, 0, 0.0, 0);
    for (const s of [-1, 1]) this.add(this.chest, new THREE.SphereGeometry(0.07, 14, 10), tee, s * 0.17, 0.15, 0).scale.set(1, 0.8, 1.1);
    this.add(this.neck, new THREE.CylinderGeometry(0.04, 0.045, 0.14, 12), skin, 0, 0.02, 0);
    const headMesh = this.add(this.head, new THREE.SphereGeometry(0.165, 32, 24), skin, 0, 0.11, -0.01);
    headMesh.scale.set(1.04, 1.0, 1.0);
    this.face(this.head, { eyeR: 0.056, eyeX: 0.062, eyeY: 0.13, eyeZ: -0.14, skin });
    const nose = this.add(this.head, new THREE.SphereGeometry(0.018, 10, 8), skin, 0, 0.075, -0.17);
    nose.scale.set(1, 0.8, 1);
    this.add(this.head, new RoundedBoxGeometry(0.06, 0.012, 0.012, 1, 0.005), new THREE.MeshBasicMaterial({ color: 0x3a2020 }), 0, 0.03, -0.155, false);
    for (const s of [-1, 1]) this.add(this.head, new THREE.SphereGeometry(0.035, 10, 8), skin, s * 0.168, 0.1, 0.0).scale.set(0.5, 1, 0.8);
    const hair = this.add(this.head, new THREE.SphereGeometry(0.172, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, 0, 0.115, 0.012);
    hair.rotation.x = -0.32; hair.scale.set(1.05, 1.0, 1.02);
    const fringe = this.add(this.head, new THREE.SphereGeometry(0.173, 32, 10, Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.18, Math.PI * 0.12), hairMat, 0, 0.115, -0.01);
    fringe.scale.set(1.05, 1.0, 1.02);
    for (const [limb, side] of [[this.armL, -1], [this.armR, 1]]) {
      this.add(limb.upper, cap(0.065, 0.06), tee, 0, -0.06, 0);
      this.add(limb.upper, cap(0.042, 0.2), skin, 0, -0.16, 0);
      this.add(limb.mid, cap(0.04, 0.2), skin, 0, -0.13, 0);
      this.hand(limb.end, skin, side, 1.15);
    }
    for (const limb of [this.legL, this.legR]) {
      this.add(limb.upper, cap(0.07, 0.32), jeans, 0, -0.21, 0);
      this.add(limb.mid, cap(0.062, 0.3), jeans, 0, -0.18, 0);
      this.add(limb.end, new RoundedBoxGeometry(0.13, 0.08, 0.24, 3, 0.04), shoe, 0, -0.045, -0.05);
    }
  }

  // the paraglider pilot (from the user's reference): a tall, square-jawed dad in a plain white T-shirt tucked into
  // blue jeans with a brown belt, a belly over the belt, square black glasses, a short brown flat-top, brown shoes
  buildDad() {
    const tee = this.toon(0xf4f4f2), jeans = this.toon(0x5a86c0), skin = this.toon(0xf0b98a), hairMat = this.toon(0x8a5a2e), shoe = this.toon(0x9a4f22), belt = this.toon(0x7a5232), frame = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
    this.add(this.pelvis, new RoundedBoxGeometry(0.3, 0.2, 0.2, 3, 0.07), jeans, 0, -0.03, 0);
    this.add(this.pelvis, new THREE.CylinderGeometry(0.155, 0.155, 0.04, 20), belt, 0, 0.07, 0);
    this.add(this.pelvis, new RoundedBoxGeometry(0.05, 0.035, 0.02, 2, 0.006), this.toon(0xb0b0b0), 0, 0.07, -0.158);
    this.add(this.spine, cap(0.15, 0.06), tee, 0, 0.03, 0).scale.set(1.15, 1, 1.0);
    this.add(this.spine, new THREE.SphereGeometry(0.15, 18, 12), tee, 0, -0.02, -0.06).scale.set(1.05, 0.9, 0.95);          // the belly
    this.add(this.chest, new RoundedBoxGeometry(0.36, 0.4, 0.22, 3, 0.08), tee, 0, 0.0, 0);
    for (const sd of [-1, 1]) this.add(this.chest, new THREE.SphereGeometry(0.075, 14, 10), tee, sd * 0.18, 0.15, 0).scale.set(1, 0.8, 1.1);
    this.add(this.neck, new THREE.CylinderGeometry(0.045, 0.05, 0.2, 12), skin, 0, 0.04, 0);
    const headMesh = this.add(this.head, new RoundedBoxGeometry(0.2, 0.27, 0.2, 4, 0.08), skin, 0, 0.13, -0.01);
    headMesh.scale.set(1, 1, 1);
    this.add(this.head, new RoundedBoxGeometry(0.17, 0.06, 0.16, 3, 0.03), skin, 0, 0.0, -0.03);                                // the jaw
    for (const sd of [-1, 1]) {
      this.add(this.head, new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }), sd * 0.045, 0.15, -0.112, false);
      this.add(this.head, new RoundedBoxGeometry(0.075, 0.055, 0.012, 1, 0.006), frame, sd * 0.047, 0.15, -0.118, false);           // square lenses
      this.add(this.head, new RoundedBoxGeometry(0.06, 0.04, 0.006, 1, 0.004), new THREE.MeshBasicMaterial({ color: 0xd8e2e8 }), sd * 0.047, 0.15, -0.126, false);
      this.add(this.head, new THREE.SphereGeometry(0.03, 10, 8), skin, sd * 0.105, 0.13, 0.0).scale.set(0.5, 1, 0.8);
    }
    this.add(this.head, new RoundedBoxGeometry(0.03, 0.012, 0.012, 1, 0.004), frame, 0, 0.155, -0.12, false);
    const nose = this.add(this.head, new THREE.CapsuleGeometry(0.018, 0.04, 4, 8), skin, 0, 0.1, -0.125); nose.rotation.x = 0.4;
    this.add(this.head, new RoundedBoxGeometry(0.06, 0.01, 0.012, 1, 0.004), new THREE.MeshBasicMaterial({ color: 0x5a3020 }), 0, 0.045, -0.112, false);
    this.add(this.head, new RoundedBoxGeometry(0.205, 0.08, 0.2, 3, 0.02), hairMat, 0, 0.29, 0.0);                             // the flat-top
    this.add(this.head, new RoundedBoxGeometry(0.21, 0.12, 0.08, 3, 0.03), hairMat, 0, 0.22, 0.07);
    for (const [limb, side] of [[this.armL, -1], [this.armR, 1]]) {
      this.add(limb.upper, cap(0.07, 0.06), tee, 0, -0.06, 0);
      this.add(limb.upper, cap(0.045, 0.2), skin, 0, -0.16, 0);
      this.add(limb.mid, cap(0.042, 0.2), skin, 0, -0.13, 0);
      this.hand(limb.end, skin, side, 1.15);
    }
    for (const limb of [this.legL, this.legR]) {
      this.add(limb.upper, cap(0.068, 0.34), jeans, 0, -0.21, 0);
      this.add(limb.mid, cap(0.06, 0.3), jeans, 0, -0.18, 0);
      this.add(limb.end, new RoundedBoxGeometry(0.13, 0.09, 0.26, 3, 0.04), shoe, 0, -0.045, -0.05);
    }
  }
  // the jetpack pilot (from the user's reference): a regular guy in a grey polo shirt with a collar, worn dark jeans,
  // white sneakers, short dark hair and stubble
  buildGuy() {
    const polo = this.toon(0x6e7073), jeans = this.toon(0x2a2c30), skin = this.toon(0xe8b48c), hairMat = this.toon(0x2a1e18), shoe = this.toon(0xf2f2f0), sole = this.toon(0x1a1a1a), stub = this.toon(0x9a7a62);
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
    this.add(this.pelvis, new RoundedBoxGeometry(0.29, 0.2, 0.19, 3, 0.07), jeans, 0, -0.03, 0);
    this.add(this.spine, cap(0.13, 0.08), polo, 0, 0.03, 0).scale.set(1.15, 1, 0.85);
    this.add(this.chest, new RoundedBoxGeometry(0.36, 0.4, 0.2, 3, 0.08), polo, 0, 0.0, 0);
    for (const sd of [-1, 1]) {
      this.add(this.chest, new THREE.SphereGeometry(0.075, 14, 10), polo, sd * 0.18, 0.15, 0).scale.set(1, 0.8, 1.1);
      const col = this.add(this.chest, new RoundedBoxGeometry(0.09, 0.03, 0.06, 2, 0.01), polo, sd * 0.05, 0.2, -0.08); col.rotation.z = sd * 0.5;   // the collar
    }
    this.add(this.chest, new RoundedBoxGeometry(0.03, 0.1, 0.01, 1, 0.004), this.toon(0x5a5c60), 0, 0.12, -0.103);
    this.add(this.neck, new THREE.CylinderGeometry(0.045, 0.05, 0.14, 12), skin, 0, 0.02, 0);
    const headMesh = this.add(this.head, new THREE.SphereGeometry(0.12, 28, 20), skin, 0, 0.12, -0.01); headMesh.scale.set(0.95, 1.18, 1.0);
    this.add(this.head, new THREE.SphereGeometry(0.105, 20, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), stub, 0, 0.1, -0.012).scale.set(0.98, 1.1, 1.02);   // stubble
    this.face(this.head, { eyeR: 0.026, eyeX: 0.045, eyeY: 0.15, eyeZ: -0.1, skin });
    const brow = this.add(this.head, new RoundedBoxGeometry(0.15, 0.018, 0.02, 1, 0.006), hairMat, 0, 0.185, -0.105, false); brow.rotation.x = 0.1;
    const nose = this.add(this.head, new THREE.CapsuleGeometry(0.018, 0.035, 4, 8), skin, 0, 0.12, -0.12); nose.rotation.x = 0.5;
    this.add(this.head, new RoundedBoxGeometry(0.05, 0.01, 0.012, 1, 0.004), new THREE.MeshBasicMaterial({ color: 0x5a3020 }), 0, 0.06, -0.112, false);
    for (const sd of [-1, 1]) this.add(this.head, new THREE.SphereGeometry(0.03, 10, 8), skin, sd * 0.115, 0.12, 0.0).scale.set(0.5, 1, 0.8);
    const hair = this.add(this.head, new THREE.SphereGeometry(0.126, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat, 0, 0.14, 0.01); hair.scale.set(1, 1.15, 1.04); hair.rotation.x = -0.25;
    this.add(this.head, new RoundedBoxGeometry(0.16, 0.05, 0.08, 2, 0.02), hairMat, 0, 0.24, -0.05);
    for (const [limb, side] of [[this.armL, -1], [this.armR, 1]]) {
      this.add(limb.upper, cap(0.065, 0.07), polo, 0, -0.06, 0);
      this.add(limb.upper, cap(0.042, 0.2), skin, 0, -0.16, 0);
      this.add(limb.mid, cap(0.04, 0.2), skin, 0, -0.13, 0);
      this.hand(limb.end, skin, side, 1.12);
    }
    for (const limb of [this.legL, this.legR]) {
      this.add(limb.upper, cap(0.062, 0.34), jeans, 0, -0.21, 0);
      this.add(limb.mid, cap(0.056, 0.3), jeans, 0, -0.18, 0);
      this.add(limb.end, new RoundedBoxGeometry(0.12, 0.08, 0.25, 3, 0.04), shoe, 0, -0.04, -0.05);
      this.add(limb.end, new RoundedBoxGeometry(0.125, 0.025, 0.26, 2, 0.01), sole, 0, -0.085, -0.05);
    }
  }
}

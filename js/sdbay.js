// SAN DIEGO BAY: what stands and moves on the ground js/sdworld.js laid out.
//   the bay's water (one surface for the bay and the Pacific, its depth from a mask of the coastlines)
//   the Coronado Bridge: a high curve in spans you can blow out of the sky; real traffic drives it (js/agents.js)
//   Chicano Park's murals on the bridge pillars, the kiosko
//   the Hotel del Coronado's red roofs, turrets and the Crown Room's cone, the Coronado Shores, lifeguard towers
//   North Island: carriers at the piers, jets taking off and landing, parked jets, the fence, the gate
//   Naval Base San Diego: destroyers, amphibious ships, a Zumwalt at the piers; grey trucks and Humvees
//   the label in the corner: "CORONADO ISLAND, CA" over the island, "SAN DIEGO, CA" everywhere else
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { sfx } from './audio.js';
import { addRipples } from './water.js';
import { solids } from './solids.js';
import { tint, box, cyl, cone, sph, hipRoof, canvasTex, cutoutOn, topOf } from './mapkit.js';
import { sideTexture, frontTexture } from './trolley.js';
import { BRIDGE, BRIDGE_W, RAMPS, CORONADO, SOUTHBAY, onCoronado, sdShoreX, isLand, WORLD, NAS_FENCE, HOTEL } from './sdgeo.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });

// ---------- the water: a mask of the land (red: land, green: a little blurred, blue: well blurred = depth) ----------
const MASK = { x0: WORLD.x0 - 120, x1: WORLD.x1 + 30, z0: WORLD.z0 - 120, z1: WORLD.z1 + 320 };
function maskTexture() {
  const S = 1024, k = S / (MASK.x1 - MASK.x0), kz = S / (MASK.z1 - MASK.z0);
  const layer = (blur) => {
    const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S); if (blur) x.filter = `blur(${blur}px)`;
    x.fillStyle = '#fff';
    const P = (a, b) => [(a - MASK.x0) * k, (b - MASK.z0) * kz];
    x.beginPath(); CORONADO.forEach(([a, b], i) => { const [u, v] = P(a, b); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill();
    x.beginPath(); SOUTHBAY.forEach(([a, b], i) => { const [u, v] = P(a, b); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.closePath(); x.fill();
    x.beginPath(); let first = true;
    for (let z = MASK.z0 - 20; z <= MASK.z1 + 20; z += 3) { const [u, v] = P(sdShoreX(z), z); first ? x.moveTo(u, v) : x.lineTo(u, v); first = false; }
    const [ue] = P(MASK.x1 + 40, 0); x.lineTo(ue, S + 60); x.lineTo(ue, -60); x.closePath(); x.fill();
    return x.getImageData(0, 0, S, S).data;
  };
  const hard = layer(0), soft = layer(3), deep = layer(26);
  const out = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { out[i * 4] = hard[i * 4]; out[i * 4 + 1] = soft[i * 4]; out[i * 4 + 2] = deep[i * 4]; out[i * 4 + 3] = 255; }
  // canvas rows run north to south; DataTexture rows run upward, so flip
  const flip = new Uint8Array(S * S * 4);
  for (let r = 0; r < S; r++) flip.set(out.subarray(r * S * 4, (r + 1) * S * 4), (S - 1 - r) * S * 4);
  const t = new THREE.DataTexture(flip, S, S, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
export function makeBayWater() {
  const timeU = { value: 0 }, mask = maskTexture();
  G.bayMask = { tex: mask, box: new THREE.Vector4(MASK.x0, MASK.z0, MASK.x1 - MASK.x0, MASK.z1 - MASK.z0) };   // the backdrop paints seabed under the water with it
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, specularIntensity: 0.45, transparent: true, envMapIntensity: 0.55, depthWrite: false });
  mat.customProgramCacheKey = () => 'sdbay-water';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU; sh.uniforms.uMask = { value: mask }; sh.uniforms.uBox = { value: new THREE.Vector4(MASK.x0, MASK.z0, MASK.x1 - MASK.x0, MASK.z1 - MASK.z0) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform float uTime; uniform sampler2D uMask; uniform vec4 uBox;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 muv = vec2((vW.x - uBox.x) / uBox.z, 1.0 - (vW.z - uBox.y) / uBox.w);
        vec3 mk = texture2D(uMask, muv).rgb;
        float land = mk.r, near = mk.g, depth = clamp(1.0 - mk.b * 1.6, 0., 1.);
        // the Pacific (west of the island, and off the Strand) has surf; the bay is calm
        float ocean = clamp((-vW.x - 236.) / 30., 0., 1.) + clamp((vW.z - 236.) / 20., 0., 1.) * clamp((-vW.x - 118.) / 30., 0., 1.);
        ocean = clamp(ocean, 0., 1.);
        float wpatch = 0.5 + 0.5 * sin(vW.x * 0.07 + vW.z * 0.05 + uTime * 0.05) * sin(vW.x * 0.023 - vW.z * 0.041);
        vec3 deep = mix(mix(vec3(0.02,0.11,0.2), vec3(0.03,0.15,0.25), wpatch), mix(vec3(0.02,0.14,0.24), vec3(0.03,0.2,0.3), wpatch), ocean);
        vec3 shallow = mix(vec3(0.09,0.32,0.36), vec3(0.2,0.6,0.58), ocean);
        diffuseColor.rgb = mix(shallow, deep, sqrt(depth));
        diffuseColor.a = mix(0.25, 0.995, smoothstep(0., 0.4, depth));
        float edge = near + 0.06 * sin(dot(vW.xz, vec2(0.3, 0.2)) + uTime * 1.2);
        float foam = smoothstep(0.12, 0.0, abs(edge - 0.35)) * (0.55 + 0.45 * sin(vW.x * 1.7 + vW.z * 1.3 + uTime * 3.0));
        foam += smoothstep(0.1, 0.0, abs(edge - 0.16 - 0.05 * sin(uTime * 0.8 + vW.x * 0.2))) * 0.4;
        foam *= mix(0.22, 1.0, ocean) * smoothstep(0.02, 0.1, near);   // surf only along the shore, never speckles on open water
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), clamp(foam, 0., 1.) * 0.85);
        diffuseColor.a = max(diffuseColor.a, clamp(foam, 0., 1.) * 0.9);
        diffuseColor.a *= 1.0 - smoothstep(0.45, 0.6, land);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec2 wv = vec2(sin(vW.x * 1.3 + uTime * 1.7) + sin(vW.x * 0.6 + vW.z * 1.1 + uTime * 1.2), cos(vW.z * 1.5 + uTime * 1.3) + sin(vW.z * 0.7 - vW.x * 0.9 + uTime)) * 0.05;
        normal = normalize(normal + (viewMatrix * vec4(wv.x, 0., wv.y, 0.)).xyz * 0.6);`);
    addRipples(sh, { flow: [0.05, 0.3], scale: 0.9, amp: 0.8, gloss: [0.14, 0.34] });
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), mat);
  m.position.set(-300, 0.05, 100); m.renderOrder = 1;
  return { mesh: m, timeU };
}

// ---------- murals (painted on the bridge's pillars in Chicano Park, and on walls round the Barrio) ----------
// Original designs in the style of the park's murals: suns and feathered serpents, eagles, nopales and roses,
// lowriders, calaveras, bold lettering. Each texture is one tall panel.
function muralTexture(seed) {
  const r = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed * 7919 + 13);
  const P = (a) => a[Math.floor(r() * a.length)];
  return canvasTex(256, 512, (x, w, h) => {
    const bgs = [['#1d4fa8', '#0f2f6e'], ['#c8202a', '#7a1016'], ['#f2b81c', '#c8701a'], ['#1f8a5a', '#0f5a3a'], ['#6a2a8a', '#2a1440'], ['#e8601a', '#a82a10']];
    const [b1, b2] = P(bgs), gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, b1); gr.addColorStop(1, b2);
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const motif = Math.floor(r() * 6), cx = w / 2;
    // a sunburst behind most of them
    if (motif !== 3) { x.save(); x.translate(cx, h * 0.36); for (let k = 0; k < 24; k++) { x.rotate(Math.PI / 12); x.fillStyle = k % 2 ? '#f6d23a' : '#f08a1a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(-14, -150); x.lineTo(14, -150); x.fill(); } x.restore(); x.fillStyle = '#f6c21a'; x.beginPath(); x.arc(cx, h * 0.36, 52, 0, 6.283); x.fill(); }
    if (motif === 0) {
      // the sun stone: rings and a face
      for (const [rr, c] of [[48, '#c8701a'], [38, '#f2d27a'], [26, '#c8202a']]) { x.fillStyle = c; x.beginPath(); x.arc(cx, h * 0.36, rr, 0, 6.283); x.fill(); }
      x.fillStyle = '#2a1408'; x.fillRect(cx - 14, h * 0.33, 8, 6); x.fillRect(cx + 6, h * 0.33, 8, 6); x.fillRect(cx - 10, h * 0.39, 20, 5);
    } else if (motif === 1) {
      // an eagle on a nopal with a serpent
      x.fillStyle = '#2f7a3a'; for (const [ox, oy, rx, ry] of [[0, 0.62, 26, 40], [-30, 0.56, 18, 26], [30, 0.54, 18, 28]]) { x.beginPath(); x.ellipse(cx + ox, h * oy, rx, ry, 0, 0, 6.283); x.fill(); }
      x.fillStyle = '#5a3a1a'; x.beginPath(); x.moveTo(cx - 60, h * 0.36); x.quadraticCurveTo(cx, h * 0.22, cx + 60, h * 0.36); x.lineTo(cx + 20, h * 0.42); x.lineTo(cx, h * 0.5); x.lineTo(cx - 20, h * 0.42); x.closePath(); x.fill();
      x.fillStyle = '#e8e2d0'; x.beginPath(); x.arc(cx, h * 0.31, 12, 0, 6.283); x.fill(); x.fillStyle = '#f2b81c'; x.fillRect(cx + 8, h * 0.31, 14, 5);
      x.strokeStyle = '#3a8a2a'; x.lineWidth = 7; x.beginPath(); x.moveTo(cx - 40, h * 0.48); x.bezierCurveTo(cx - 10, h * 0.44, cx + 10, h * 0.52, cx + 34, h * 0.46); x.stroke();
    } else if (motif === 2) {
      // a feathered serpent curling down the pillar
      x.strokeStyle = '#2aa86a'; x.lineWidth = 22; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx - 50, 40);
      for (let k = 1; k < 9; k++) x.quadraticCurveTo(cx + (k % 2 ? 70 : -70), 40 + k * 50 - 25, cx + (k % 2 ? 50 : -50), 40 + k * 50); x.stroke();
      x.strokeStyle = '#f2d23a'; x.lineWidth = 6; x.stroke();
      x.fillStyle = '#c8202a'; for (let k = 0; k < 10; k++) { x.beginPath(); x.ellipse(cx + rand(-60, 60), 30 + k * 46, 8, 18, rand(0, 3), 0, 6.283); x.fill(); }
    } else if (motif === 3) {
      // a lowrider on a big orange sunset, palms
      const s = x.createLinearGradient(0, 0, 0, h * 0.6); s.addColorStop(0, '#f0702a'); s.addColorStop(1, '#f2c84a'); x.fillStyle = s; x.fillRect(0, h * 0.1, w, h * 0.5);
      x.fillStyle = '#1a1020'; for (const px of [40, 210]) { x.fillRect(px, h * 0.25, 6, h * 0.35); for (let k = 0; k < 6; k++) { x.save(); x.translate(px + 3, h * 0.25); x.rotate(k * 1.05); x.fillRect(0, -3, 40, 6); x.restore(); } }
      x.fillStyle = P(['#c8202a', '#6a2a8a', '#1d4fa8', '#1f8a5a']); x.fillRect(30, h * 0.52, 196, 30); x.fillRect(70, h * 0.47, 110, 22);
      x.fillStyle = '#e8e8f0'; x.fillRect(80, h * 0.48, 40, 14); x.fillRect(130, h * 0.48, 40, 14);
      x.fillStyle = '#111'; for (const wx of [70, 186]) { x.beginPath(); x.arc(wx, h * 0.59, 15, 0, 6.283); x.fill(); x.fillStyle = '#d8d8e0'; x.beginPath(); x.arc(wx, h * 0.59, 7, 0, 6.283); x.fill(); x.fillStyle = '#111'; }
    } else if (motif === 4) {
      // a calavera with roses
      x.fillStyle = '#f2eee6'; x.beginPath(); x.ellipse(cx, h * 0.34, 46, 54, 0, 0, 6.283); x.fill(); x.fillRect(cx - 28, h * 0.4, 56, 34);
      x.fillStyle = '#1a1414'; for (const ox of [-18, 18]) { x.beginPath(); x.arc(cx + ox, h * 0.33, 13, 0, 6.283); x.fill(); }
      x.beginPath(); x.moveTo(cx, h * 0.37); x.lineTo(cx - 6, h * 0.4); x.lineTo(cx + 6, h * 0.4); x.fill();
      for (let k = -2; k <= 2; k++) x.fillRect(cx + k * 9 - 2, h * 0.43, 4, 12);
      for (const [ox, oy] of [[-40, 0.22], [40, 0.22], [0, 0.18]]) { x.fillStyle = '#c8202a'; x.beginPath(); x.arc(cx + ox, h * oy, 14, 0, 6.283); x.fill(); x.fillStyle = '#7a1016'; x.beginPath(); x.arc(cx + ox, h * oy, 6, 0, 6.283); x.fill(); }
    } else {
      // a portrait-style figure in bold blocks of colour (nobody in particular)
      x.fillStyle = '#7a4a2a'; x.beginPath(); x.ellipse(cx, h * 0.32, 34, 44, 0, 0, 6.283); x.fill();
      x.fillStyle = '#1a1010'; x.beginPath(); x.ellipse(cx, h * 0.25, 40, 26, 0, Math.PI, 0); x.fill(); x.fillRect(cx - 40, h * 0.25, 12, 70); x.fillRect(cx + 28, h * 0.25, 12, 70);
      x.fillStyle = '#f2eee6'; for (const ox of [-12, 12]) x.fillRect(cx + ox - 6, h * 0.31, 12, 5);
      x.fillStyle = '#c8202a'; x.fillRect(cx - 10, h * 0.38, 20, 5);
      x.fillStyle = P(['#1f8a5a', '#c8202a', '#1d4fa8']); x.fillRect(cx - 50, h * 0.42, 100, 60);
    }
    // the lettering band at the bottom
    const words = ['CHICANO PARK', 'BARRIO LOGAN', 'LA RAZA', 'AZTLAN', 'SAN DIEGO', 'LOGAN HEIGHTS', 'EL PUEBLO', 'CULTURA'];
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, h * 0.78, w, h * 0.14);
    x.fillStyle = '#f6d23a'; x.font = '900 30px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(P(words), cx, h * 0.85, w - 16);
    // a border of zig-zags, Aztec style
    x.fillStyle = '#f2eee6'; for (let k = 0; k < 16; k++) { x.beginPath(); x.moveTo(k * 16, h); x.lineTo(k * 16 + 8, h - 14); x.lineTo(k * 16 + 16, h); x.fill(); x.beginPath(); x.moveTo(k * 16, 0); x.lineTo(k * 16 + 8, 14); x.lineTo(k * 16 + 16, 0); x.fill(); }
  });
}

// ---------- ships (bow along -x... built along +x, waterline at y = 0); grey ships of the Pacific Fleet ----------
const GREY = 0x8a9096, DGREY = 0x6e757c, DECK = 0x4e5459, RED = 0x7a2320, BLACK = 0x202326;
function hull(L, B, H, c = GREY) {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, -B / 2); s.lineTo(L * 0.28, -B / 2); s.quadraticCurveTo(L * 0.46, -B * 0.4, L / 2, 0); s.quadraticCurveTo(L * 0.46, B * 0.4, L * 0.28, B / 2); s.lineTo(-L / 2, B / 2); s.closePath();
  return [tint(new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, -0.6, 0), c),
    tint(new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2).translate(0, -1.2, 0), RED)];
}
function shipGeo(kind) {
  const P = [];
  if (kind === 'cvn') {
    // a supercarrier: the long flight deck overhanging the hull, the angled deck, the island to starboard, jets on deck
    P.push(...hull(46, 7, 3.6), box(48, 0.35, 11, 0, 3.15, -0.8, DECK), box(18, 0.36, 4, -8, 3.16, -5.4, DECK, 0.15));
    P.push(box(4.2, 4, 1.8, 6, 5.3, 3.4, GREY), box(3, 1.4, 1.6, 6, 7.8, 3.4, DGREY), box(0.2, 3, 0.2, 6, 9.8, 3.4, DGREY));
    for (let k = 0; k < 9; k++) P.push(box(0.12, 0.012, 3, -20 + k * 5, 3.34, -0.8, 0xf2f2ea));
    for (let k = 0; k < 10; k++) P.push(...jetParts(0.62).map((g) => g.clone().rotateY(rand(-0.4, 0.4) + Math.PI / 2).translate(-18 + k * 3.8, 3.33, rand(-5.2, 2.6))));
  } else if (kind === 'lhd') {
    // an amphibious assault ship: a flat deck end to end, the island, helicopters and Ospreys
    P.push(...hull(34, 5.6, 3.4), box(34, 0.3, 6.4, 0, 2.95, -0.2, DECK), box(5, 3.2, 1.4, 2, 4.7, 2.3, GREY), box(2, 1.4, 1, 2, 6.9, 2.3, DGREY), box(0.16, 2.4, 0.16, 2, 8.6, 2.3, DGREY));
    for (let k = 0; k < 6; k++) P.push(box(1.6, 0.4, 0.5, -14 + k * 5, 3.3, -1.2, 0x5a6066), box(2.2, 0.03, 0.12, -14 + k * 5, 3.62, -1.2, 0x2a2c2e));
    // deck markings, the elevators, the island's radars and masts, Ospreys folded on deck, rails and boats along the hull
    P.push(box(33, 0.012, 0.12, 0, 3.11, -0.2, 0xf2f2ea));
    for (let k = 0; k < 9; k++) P.push(box(0.9, 0.012, 0.9, -15 + k * 3.6, 3.11, -1.8, 0xe8c040));
    P.push(box(3, 0.05, 2, -8, 3.1, 3.2, 0x55595e), box(3, 0.05, 2, 9, 3.1, -3.4, 0x55595e));
    P.push(box(0.9, 0.9, 0.9, 2, 7.9, 2.3, GREY), cyl(0.5, 0.5, 0.15, 2.8, 8.5, 2.3, 0xf2f2ea, 10), box(0.08, 1.4, 1.6, 0.6, 9.4, 2.3, DGREY), box(1.4, 0.06, 0.06, 2, 9.6, 2.3, DGREY));
    for (let k = 0; k < 4; k++) { const x = 6 + k * 2.6; P.push(box(1.4, 0.35, 0.45, x, 3.35, 1.4, 0x6a6e72), box(0.08, 0.04, 1.9, x - 0.4, 3.6, 1.4, 0x2a2c2e), box(0.08, 0.04, 1.9, x + 0.4, 3.6, 1.4, 0x2a2c2e)); }
    for (const sd of [-1, 1]) { P.push(box(32, 0.12, 0.04, 0, 3.25, sd * 3.25, 0xc8ccd0)); for (let k = 0; k < 6; k++) P.push(cyl(0.18, 0.18, 0.6, -12 + k * 4.5, 2.2, sd * 2.9, 0xe8e8e2, 8)); }
  } else if (kind === 'lpd') {
    // a San Antonio class: the hull rising to a tall slab of superstructure with two enclosed masts, a flight deck aft
    P.push(...hull(28, 4.4, 2.6), box(13, 2.6, 4.2, 1, 3.3, 0, GREY), box(5, 4.2, 1.6, 4, 6.6, 0, DGREY, 0), cone(0.9, 3, 4, 9.6, 0, DGREY, 6), cone(0.9, 3, -2, 9, 0, DGREY, 6), box(10, 0.2, 4.2, -9, 2.1, 0, DECK));
    P.push(box(10, 0.012, 0.1, -9, 2.22, 0, 0xf2f2ea), cyl(1.1, 1.1, 0.012, -10, 2.22, 0, 0xe8c040, 16), box(2.2, 1.4, 3.6, -3.5, 2.7, 0, GREY), box(0.6, 0.6, 0.6, 9, 2.2, 0, DGREY), box(1.4, 0.08, 0.1, 9.9, 2.4, 0, DGREY));
    for (const sd of [-1, 1]) P.push(box(26, 0.1, 0.04, 0, 2.05, sd * 2.25, 0xc8ccd0), box(1.2, 0.5, 0.5, -3, 4.8, sd * 1.9, 0xe8e8e2));
  } else if (kind === 'zumwalt') {
    // the stealth destroyer: tumblehome hull, the angular deckhouse, no masts
    P.push(...hull(30, 4.2, 1.6, 0x7c8288));
    const dh = new THREE.CylinderGeometry(1.4, 2.1, 3, 4, 1).rotateY(Math.PI / 4).scale(3.2, 1, 1).translate(-2, 2.5, 0);
    P.push(tint(dh, 0x7c8288), box(2.6, 0.5, 2.4, 9, 1.3, 0, 0x6e757c), box(1.4, 0.2, 1.4, 11, 1.4, 0, 0x5a6066));
  } else if (kind === 'lcs') {
    P.push(...hull(20, 3.6, 1.6, 0x9aa0a4), box(8, 2.2, 3.4, 0, 2.4, 0, 0x9aa0a4), cone(0.5, 2.4, 1, 4.6, 0, DGREY, 6));
  } else {
    // a destroyer (or a cruiser, a little longer, two superstructures): bow gun, the bridge, mast, stacks, VLS, helo deck
    const L = kind === 'cg' ? 26 : 23;
    P.push(...hull(L, 3.6, 1.6));
    P.push(box(5.5, 2.2, 3, 2.2, 2.3, 0, GREY), box(2.4, 1.2, 2.4, 3.4, 4, 0, DGREY), box(0.18, 3.2, 0.18, 2.4, 6, 0, DGREY), box(1.6, 0.12, 0.12, 2.4, 6.6, 0, DGREY));
    P.push(box(1.4, 1.6, 1.4, -1.6, 2.6, 0, DGREY), box(1.2, 1.6, 1.2, -4.4, 2.6, 0, DGREY), box(0.7, 0.5, 0.7, L * 0.36, 1.35, 0, GREY), box(1.6, 0.08, 0.12, L * 0.36 + 0.9, 1.5, 0, DGREY));
    if (kind === 'cg') P.push(box(4, 1.8, 2.6, -7, 2.1, 0, GREY), box(1.6, 0.8, 1.6, -7, 3.4, 0, DGREY));
    for (let k = 0; k < 8; k++) P.push(box(0.4, 0.06, 0.4, L * 0.22 + (k % 4) * 0.45 - 0.7, 1.03, (k < 4 ? -0.45 : 0.45), 0x3a3e42));
    // the radar faces on the bridge block, CIWS mounts, the helicopter deck aft with its markings, rails, life-raft canisters
    for (const sd of [-1, 1]) P.push(box(1.1, 1.1, 0.06, 3.4, 3.1, sd * 1.52, 0x4e5459), box(0.06, 1.1, 1.1, 4.62, 3.1, sd * 0.7, 0x4e5459));
    P.push(cyl(0.22, 0.22, 0.35, 0.6, 3.6, 0, 0xf2f2ea, 8), cyl(0.2, 0.2, 0.3, -5.6, 3.5, 0, 0xf2f2ea, 8));
    P.push(box(5, 0.012, 3.2, -L * 0.38, 1.03, 0, 0x4a4f54), cyl(1.1, 1.1, 0.014, -L * 0.38, 1.05, 0, 0xf2f2ea, 18), cyl(0.95, 0.95, 0.016, -L * 0.38, 1.055, 0, 0x4a4f54, 18), box(4.4, 0.016, 0.06, -L * 0.38, 1.06, 0, 0xe8c040));
    for (const sd of [-1, 1]) { P.push(box(L * 0.85, 0.1, 0.04, -L * 0.02, 1.2, sd * 1.82, 0xc8ccd0)); for (let k = 0; k < 4; k++) P.push(cyl(0.12, 0.12, 0.4, -1 + k * 0.5, 1.6, sd * 1.65, 0xe8e8e2, 6)); }
    P.push(box(0.12, 1.2, 0.12, 2.4, 7.2, 0, DGREY), box(1, 0.08, 0.08, 2.4, 7.4, 0, DGREY), box(0.4, 0.3, 0.4, 2.4, 7.9, 0, 0xf2f2ea));
  }
  return mergeGeometries(P.map((g) => (g.index ? g.toNonIndexed() : g)));
}
// a fighter jet, nose along +x (wings, twin tails, canopy); s = scale
function jetParts(s = 1) {
  const fus = new THREE.CylinderGeometry(0.16, 0.22, 2.6, 8).rotateZ(Math.PI / 2);
  const nose = new THREE.ConeGeometry(0.16, 0.9, 8).rotateZ(-Math.PI / 2).translate(1.75, 0, 0);
  const wing = new THREE.BoxGeometry(1.1, 0.04, 2.4).translate(-0.2, 0, 0);
  const tailH = new THREE.BoxGeometry(0.5, 0.03, 1.1).translate(-1.15, 0, 0);
  const fins = [-1, 1].map((sd) => new THREE.BoxGeometry(0.5, 0.55, 0.03).rotateX(sd * 0.35).translate(-1.05, 0.3, sd * 0.22));
  const canopy = new THREE.SphereGeometry(0.15, 8, 6).scale(2.2, 1, 1).translate(0.7, 0.16, 0);
  const g = [tint(fus, 0x8f979e), tint(nose, 0x8f979e), tint(wing, 0x828a91), tint(tailH, 0x828a91), ...fins.map((f) => tint(f, 0x7a8288)), tint(canopy, 0x26333d)];
  return g.map((p) => p.scale(s, s, s).translate(0, 0.35 * s, 0));
}
function jetGeo(s = 1) { return mergeGeometries(jetParts(s).map((g) => (g.index ? g.toNonIndexed() : g))); }
// military trucks: a Humvee, a 7-ton truck, a grey pickup (nose along +z)
function milGeo(kind) {
  const sand = 0x8a7d5a, olive = 0x4e5636, grey = 0x8a9096, dark = 0x1c1e20, wheel = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 8).rotateZ(Math.PI / 2);
  const W = (x, z) => tint(wheel.clone().translate(x, 0.14, z), dark);
  if (kind === 'humvee') return mergeGeometries([box(0.86, 0.36, 1.6, 0, 0.4, 0, sand), box(0.8, 0.26, 0.8, 0, 0.7, -0.2, sand), box(0.7, 0.18, 0.04, 0, 0.72, 0.21, dark), W(0.4, 0.55), W(-0.4, 0.55), W(0.4, -0.55), W(-0.4, -0.55)]);
  if (kind === 'truck') return mergeGeometries([box(0.86, 0.5, 0.8, 0, 0.55, 0.9, olive), box(0.9, 0.12, 2, 0, 0.42, -0.4, olive), box(0.9, 0.6, 1.9, 0, 0.82, -0.45, 0x5e6644), W(0.42, 0.9), W(-0.42, 0.9), W(0.42, -0.4), W(-0.42, -0.4), W(0.42, -1.0), W(-0.42, -1.0)]);
  return mergeGeometries([box(0.8, 0.32, 1.7, 0, 0.36, 0, grey), box(0.76, 0.3, 0.7, 0, 0.66, 0.1, grey), box(0.7, 0.16, 0.04, 0, 0.66, 0.46, dark), W(0.38, 0.55), W(-0.38, 0.55), W(0.38, -0.55), W(-0.38, -0.55)]);
}

export class SDBay {
  constructor(scene, city) {
    this.scene = scene; this.city = city; G.sdbay = this;
    const sd = this.sd = city.sd;
    this.buildBridge(scene);
    this.chicano(scene);
    this.hotel(scene);
    this.coastline(scene);
    this.strandFar(scene);
    this.yards(scene);
    this.jetSkiFleet(scene);
    this.blueLine(scene);
    this.northIsland(scene);
    this.navalBase(scene);
    this.label = { on: null };
    this.sunkCheckT = 5;
  }

  // ================= the Coronado Bridge =================
  buildBridge(scene) {
    const curve = this.curve = new THREE.CatmullRomCurve3(BRIDGE.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const L = this.len = curve.getLength();
    const N = Math.ceil(L / 0.8);
    const S = this.samples = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      S.push({ u, x: p.x, y: p.y, z: p.z, tx: t.x, tz: t.z, ty: t.y, sx: side.x, sz: side.z, seg: 0 });
    }
    // spans of ~7 units; each its own mesh so it can fall
    const segLen = 7, nSeg = Math.ceil(L / segLen);
    S.forEach((s, i) => { s.seg = Math.min(nSeg - 1, Math.floor((i / N) * nSeg)); });
    const W = BRIDGE_W, GD = 1.0;
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x5b5c5f, roughness: 0.9 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x3b6fa8, roughness: 0.55, metalness: 0.3 });   // the bridge's famous blue
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.7 });
    const line = new THREE.MeshBasicMaterial({ color: 0xe8e8e0 });
    this.segs = [];
    for (let k = 0; k < nSeg; k++) {
      const idx = S.map((s, i) => (s.seg === k ? i : -1)).filter((i) => i >= 0);
      const a = Math.max(0, idx[0] - 1), b = idx[idx.length - 1];
      const fr = S.slice(a, b + 1);
      const ribbon = (y0, hw) => { const pos = [], id = []; fr.forEach((s, i) => { pos.push(s.x + s.sx * hw, s.y + y0, s.z + s.sz * hw, s.x - s.sx * hw, s.y + y0, s.z - s.sz * hw); if (i) { const q = (i - 1) * 2; id.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(id); g.computeVertexNormals(); return g; };
      const wall = (hw, yT, yB) => { const pos = [], id = []; fr.forEach((s, i) => { for (const sg of [1, -1]) pos.push(s.x + s.sx * hw * sg, s.y + yT, s.z + s.sz * hw * sg, s.x + s.sx * hw * sg, s.y + yB, s.z + s.sz * hw * sg); if (i) { const q = (i - 1) * 4, r = i * 4; id.push(q, r, q + 1, q + 1, r, r + 1, q + 2, q + 3, r + 2, q + 3, r + 3, r + 2); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(id); g.computeVertexNormals(); return g; };
      const grp = new THREE.Group();
      const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
      mk(ribbon(0, W / 2), deckMat);
      mk(mergeGeometries([wall(W / 2 - 0.15, -0.02, -GD), ribbon(-GD, W / 2 - 0.15)]), blue);
      mk(wall(W / 2, 0.32, 0), white);
      const dashes = [], mid = [];
      fr.forEach((s, i) => {
        const yaw = Math.atan2(s.tx, s.tz);
        if (i % 2 === 0) for (const off of [-0.95, 0.95]) dashes.push(new THREE.BoxGeometry(0.05, 0.01, 0.55).rotateY(yaw).translate(s.x + s.sx * off, s.y + 0.012, s.z + s.sz * off));
        mid.push(new THREE.BoxGeometry(0.14, 0.2, 0.85).rotateY(yaw).translate(s.x, s.y + 0.1, s.z));
      });
      if (dashes.length) mk(mergeGeometries(dashes), line);
      if (mid.length) mk(mergeGeometries(mid), white);
      const c = S[idx[Math.floor(idx.length / 2)]];
      for (const ch of grp.children) ch.geometry.translate(-c.x, -c.y, -c.z);
      grp.position.set(c.x, c.y, c.z);
      scene.add(grp);
      this.segs.push({ k, grp, alive: true, hp: 380, i0: idx[0], i1: idx[idx.length - 1], cx: c.x, cy: c.y, cz: c.z, fall: null });
    }
    // piers: twin white columns with a cap beam (the Chicano Park ones painted with murals)
    this.piers = [];
    const murals = Array.from({ length: 10 }, (_, k) => new THREE.MeshStandardMaterial({ map: muralTexture(k + 1), roughness: 0.85 }));
    this.muralMats = murals;
    const pierAt = (u) => {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u), side = new THREE.Vector3(-t.z, 0, t.x).normalize(), yaw = Math.atan2(t.x, t.z);
      const h = p.y - GD; if (h < 1.1) return;
      const inPark = p.x > -2 && p.x < 46 && p.z > 86 && p.z < 140;
      const grp = new THREE.Group(), parts = [];
      for (const sgn of [-1, 1]) {
        const cx = p.x + side.x * 1.2 * sgn, cz = p.z + side.z * 1.2 * sgn;
        if (inPark) {
          // a broad mural pillar: four painted faces (a box with one mural material)
          const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1).rotateY(yaw).translate(cx, h / 2, cz), pick(murals)); m.castShadow = true; grp.add(m);
        } else parts.push(new THREE.BoxGeometry(0.5, h, 0.7).rotateY(yaw).translate(cx, h / 2, cz));
        parts.push(new THREE.BoxGeometry(1.0, 0.4, 1.2).rotateY(yaw).translate(cx, 0.15, cz));
      }
      parts.push(new THREE.BoxGeometry(3.2, 0.5, 0.7).rotateY(yaw + Math.PI / 2).translate(p.x, h - 0.22, p.z));
      const m = new THREE.Mesh(mergeGeometries(parts), white); m.castShadow = true; m.receiveShadow = true; grp.add(m);
      for (const ch of grp.children) ch.geometry.translate(-p.x, 0, -p.z);
      grp.position.set(p.x, 0, p.z);
      scene.add(grp);
      const seg = this.segs[S[Math.round(u * N)].seg];
      this.piers.push({ x: p.x, z: p.z, h, grp, alive: true, hp: 300, seg: seg.k, yaw });
    };
    for (let u = 0.03; u < 0.985; u += 9 / L) pierAt(u);
    // lamp posts along the rail (heads glow at night)
    const lamps = [], poles = [];
    for (let u = 0.02; u < 0.98; u += 12 / L) { const p = curve.getPointAt(u), t = curve.getTangentAt(u), sd = new THREE.Vector3(-t.z, 0, t.x).normalize(); for (const sg of [-1, 1]) { lamps.push([p.x + sd.x * 1.75 * sg, p.y + 1.25, p.z + sd.z * 1.75 * sg, S[Math.round(u * N)].seg]); poles.push(new THREE.CylinderGeometry(0.025, 0.03, 1.25, 4).translate(p.x + sd.x * 1.8 * sg, p.y + 0.62, p.z + sd.z * 1.8 * sg)); } }
    this.lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length);
    this.lamps = lamps; lamps.forEach(([x, y, z], i) => { _m.makeTranslation(x, y, z); this.lampHeads.setMatrixAt(i, _m); });
    this.lampHeads.frustumCulled = false; scene.add(this.lampHeads);
    this.poleMesh = new THREE.Mesh(mergeGeometries(poles), new THREE.MeshStandardMaterial({ color: 0x2a2c2e })); scene.add(this.poleMesh);
    // the deck as a height field for cars, people and debris (1-unit cells)
    this.deckGrid = new Map();
    for (const s of S) for (let o = -W / 2 - 0.25; o <= W / 2 + 0.25; o += 0.25) {
      const x = s.x + s.sx * o, z = s.z + s.sz * o, key = Math.floor(x) * 4096 + Math.floor(z);
      const e = this.deckGrid.get(key); if (!e || e.y < s.y) this.deckGrid.set(key, { y: s.y, seg: s.seg });
    }
    // solid to fly into: each span an oriented slab
    for (const sg of this.segs) {
      const a = S[sg.i0], b = S[sg.i1];
      solids.push({
        get alive() { return sg.alive; },
        test: (p) => {
          let best = null, bd = 1e9;
          for (let i = sg.i0; i <= sg.i1; i += 2) { const s = S[i], d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2; if (d < bd) { bd = d; best = s; } }
          if (!best || bd > (W / 2 + 0.3) ** 2) return null;
          const dy = p.y - best.y;
          if (dy > 0.35 || dy < -GD - 0.2) return null;
          return dy > -GD / 2 ? { n: new THREE.Vector3(0, 1, 0), pen: 0.35 - dy } : { n: new THREE.Vector3(0, -1, 0), pen: dy + GD + 0.2 };
        },
        hit: (p, speed) => this.damageSeg(sg, speed * 6, p),
      });
      void a; void b;
    }
    // aim at it: the laser and everything else that raycasts finds the deck
    const prev = G.rayExtra;
    G.rayExtra = (p) => {
      const y = this.deckAt(p.x, p.z); if (y != null && p.y <= y + 0.02 && p.y > y - GD) return { point: p.clone().setY(y), cell: null, normal: new THREE.Vector3(0, 1, 0), bridge: true };
      if (this.airHit(p)) return { point: p.clone(), cell: null, normal: new THREE.Vector3(0, 1, 0), air: true };     // aim at a jet, a plane, a helicopter
      return prev ? prev(p) : null;
    };
    G.projHit = (q) => { const y = this.deckAt(q.x, q.z); return (y != null && q.y <= y + 0.2 && q.y > y - GD) || !!this.airHit(q); };
    G.city.bridgeEdge && (G.city.bridgeEdge.deck = true);
    for (const r of RAMPS) this.rampDeck(scene, r, 3.4, deckMat, white);
  }
  // a freeway ramp over Chicano Park: concrete deck and parapets on mural-painted columns with cap beams; it breaks
  // in spans like the bridge (and anything standing on it lands on its deck)
  rampDeck(scene, pts, W, deckMat, white) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const L = curve.getLength(), N = Math.ceil(L / 0.7), S = [];
    for (let i = 0; i <= N; i++) { const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u), sd = new THREE.Vector3(-t.z, 0, t.x).normalize(); S.push({ x: p.x, y: p.y, z: p.z, sx: sd.x, sz: sd.z }); }
    const nSeg = Math.max(1, Math.ceil(L / 6)), GD = 0.8, base = this.segs.length;
    for (let k = 0; k < nSeg; k++) {
      const i0 = Math.floor(k / nSeg * N), i1 = Math.min(N, Math.floor((k + 1) / nSeg * N) + 1), fr = S.slice(i0, i1 + 1);
      const ribbon = (y0, hw) => { const pos = [], id = []; fr.forEach((s, i) => { pos.push(s.x + s.sx * hw, s.y + y0, s.z + s.sz * hw, s.x - s.sx * hw, s.y + y0, s.z - s.sz * hw); if (i) { const q = (i - 1) * 2; id.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(id); g.computeVertexNormals(); return g; };
      const wall = (hw, yT, yB) => { const pos = [], id = []; fr.forEach((s, i) => { for (const sg of [1, -1]) pos.push(s.x + s.sx * hw * sg, s.y + yT, s.z + s.sz * hw * sg, s.x + s.sx * hw * sg, s.y + yB, s.z + s.sz * hw * sg); if (i) { const q = (i - 1) * 4, r = i * 4; id.push(q, r, q + 1, q + 1, r, r + 1, q + 2, q + 3, r + 2, q + 3, r + 3, r + 2); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(id); g.computeVertexNormals(); return g; };
      const c = fr[Math.floor(fr.length / 2)], grp = new THREE.Group();
      for (const [geo, mat] of [[ribbon(0, W / 2), deckMat], [mergeGeometries([wall(W / 2 - 0.1, -0.02, -GD), ribbon(-GD, W / 2 - 0.1)]), white], [wall(W / 2, 0.35, 0), white]]) { geo.translate(-c.x, -c.y, -c.z); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; grp.add(m); }
      grp.position.set(c.x, c.y, c.z); scene.add(grp);
      this.segs.push({ k: base + k, grp, alive: true, hp: 300, ramp: true, samples: fr, i0: 0, i1: fr.length - 1, cx: c.x, cy: c.y, cz: c.z, fall: null });
      for (const s of fr) for (let o = -W / 2 - 0.2; o <= W / 2 + 0.2; o += 0.3) { const key = Math.floor(s.x + s.sx * o) * 4096 + Math.floor(s.z + s.sz * o), e = this.deckGrid.get(key); if (!e || e.y < s.y) this.deckGrid.set(key, { y: s.y, seg: base + k }); }
    }
    // columns: a painted pillar under each side of the deck with a cap beam across, every few units
    for (let u = 0.08; u < 0.98; u += 5 / L) {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u), sd = new THREE.Vector3(-t.z, 0, t.x).normalize(), yaw = Math.atan2(t.x, t.z), h = p.y - GD;
      if (h < 1.3) continue;
      const grp = new THREE.Group();
      for (const sg of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1).rotateY(yaw).translate(sd.x * 1.05 * sg, h / 2, sd.z * 1.05 * sg), pick(this.muralMats)); m.castShadow = true; grp.add(m); }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.45, 1.3).rotateY(yaw).translate(0, h - 0.2, 0), white); cap.castShadow = true; grp.add(cap);
      grp.position.set(p.x, 0, p.z); scene.add(grp);
      const seg = this.segs[base + Math.min(nSeg - 1, Math.floor(u * nSeg))];
      this.piers.push({ x: p.x, z: p.z, h, grp, alive: true, hp: 260, seg: seg.k, yaw });
    }
  }
  deckAt(x, z) {
    const e = this.deckGrid.get(Math.floor(x) * 4096 + Math.floor(z));
    return e && this.segs[e.seg].alive ? e.y : null;
  }
  // the path a car follows over the bridge from node `fromId` (right-hand lane, waypoints flagged as deck)
  bridgePath(fromId, c) {
    const [A] = this.city.bridgeNodes, fwd = fromId === A, S = this.samples, n = S.length, lane = c.bridgeLane ?? (c.bridgeLane = pick([0.48, 1.18]));
    const out = [];
    for (let k = 0; k < n; k += 2) {
      const s = S[fwd ? k : n - 1 - k], dx = fwd ? s.tx : -s.tx, dz = fwd ? s.tz : -s.tz, l = Math.hypot(dx, dz) || 1;
      out.push({ x: s.x - (dz / l) * lane, z: s.z + (dx / l) * lane, deck: true });        // keep right of the centre line
    }
    out[out.length - 1].deck = false;
    return out;
  }
  placeOnBridge(c, f) {
    if (!c || c.moto || c.emerg) return;
    const [A, Bn] = this.city.bridgeNodes, fwd = Math.random() < 0.5;
    c.from = fwd ? A : Bn; c.to = fwd ? Bn : A;
    const path = this.bridgePath(c.from, c), i = Math.min(path.length - 3, Math.max(1, Math.floor(f * path.length)));
    const p = path[i], q = path[i + 1];
    c.pos.set(p.x, this.deckAt(p.x, p.z) ?? 0.3, p.z); c.heading = Math.atan2(q.x - p.x, q.z - p.z);
    c.queue = path.slice(i + 1); c.deck = true; c.speed = c.maxSpeed * 0.8;
  }
  uTurnOnBridge(c) {
    const S = this.samples, n = S.length; let bi = 0, bd = 1e9;
    for (let i = 0; i < n; i += 2) { const d = (S[i].x - c.pos.x) ** 2 + (S[i].z - c.pos.z) ** 2; if (d < bd) { bd = d; bi = i; } }
    const [A, Bn] = this.city.bridgeNodes, toA = c.from === A;                          // back the way it came
    const path = this.bridgePath(toA ? Bn : A, c), e = Math.round(toA ? (n - 1 - bi) / 2 : bi / 2);
    c.queue = path.slice(Math.min(path.length - 1, e + 1));
    [c.from, c.to] = [c.to, c.from];
    c.stuck = 0;
    return true;
  }
  damageSeg(sg, dmg, p) {
    if (!sg.alive) return;
    sg.hp -= dmg;
    if (Math.random() < 0.3) G.fx.sparks(p.x, p.y, p.z, 6, 3, 2, 1, 5);
    if (sg.hp <= 0) this.collapse(sg);
  }
  collapse(sg) {
    if (!sg.alive) return;
    sg.alive = false;
    const c = { x: sg.cx, y: sg.cy, z: sg.cz };
    sg.fall = { t: 0, vy: 0, rx: rand(-0.5, 0.5), rz: rand(-0.4, 0.4), pivot: new THREE.Vector3(c.x, c.y, c.z) };
    G.fx.explosion(c.x, c.y, c.z, 1.4, null, 'bomb'); G.fx.dust(c.x, c.y, c.z, 2.5);
    sfx.crumble && sfx.crumble(c.x, c.z, 1.2);
    G.shake = Math.max(G.shake || 0, 0.5);
    // the cars on it go down with it
    for (const car of G.agents ? G.agents.cars : []) if (car.deck && car.state === 'drive') {
      const e = this.deckGrid.get(Math.floor(car.pos.x) * 4096 + Math.floor(car.pos.z));
      if (e && e.seg === sg.k) G.agents.launch(car, { x: rand(-0.3, 0.3), z: rand(-0.3, 0.3) }, rand(0.5, 2), rand(0, 2), true, 2);
    }
    if (sg.ramp) { for (const pr of this.piers) if (pr.seg === sg.k && pr.alive && Math.random() < 0.5) this.breakPier(pr); return; }
    // the road is cut: no more routes over it, and traffic on the deck stops at the edge
    const C = this.city;
    if (C.bridgeEdge) { C.bridgeEdge.blocked = true; C.bridgeEdge.closed = true; }
    const S = this.samples;
    for (const i of [Math.max(0, sg.i0 - 4), Math.min(S.length - 1, sg.i1 + 4)]) C.obstacles.push({ x: S[i].x, z: S[i].z, r: 2.2, kind: 'gap' });
    G.news && G.news.post && G.news.post('BREAKING', 'Section of the Coronado Bridge collapses into the bay.', 3, 'cbridge');
    if (!this.cut) { this.cut = true; G.progress && G.progress.event && G.progress.event('coronado_bridge'); }
    // the piers under it lose their load
    for (const pr of this.piers) if (pr.seg === sg.k && pr.alive && Math.random() < 0.5) this.breakPier(pr);
  }
  breakPier(pr) {
    if (!pr.alive) return; pr.alive = false;
    pr.fall = { t: 0, ax: rand(-1, 1), az: rand(-1, 1) };
    G.fx.dust(pr.x, pr.h / 2, pr.z, 2);
    const sg = this.segs[pr.seg]; if (sg && sg.alive) this.collapse(sg);
  }

  // ================= Chicano Park =================
  chicano(scene) {
    const P = this.sd.chicano; if (!P) return;
    // freestanding mural pillars and walls round the park (the old ramp supports), and the kiosko
    const mats = this.muralMats;
    // (the mural pillars are the ramps' own supports: rampDeck below)
    // the kiosko: an octagonal pavilion with a tiled roof
    const kx = P.kx, kz = P.kz, K = [];
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; K.push(cyl(0.1, 0.1, 2.2, kx + Math.cos(a) * 2, 1.1, kz + Math.sin(a) * 2, 0xe8c040, 6)); }
    K.push(cyl(2.3, 2.3, 0.3, kx, 0.15, kz, 0xc9503a, 8), cone(2.8, 1.6, kx, 3, kz, 0x2a8a5a, 8), cyl(0.3, 0.3, 0.6, kx, 4, kz, 0xe8c040, 8));
    const km = new THREE.Mesh(mergeGeometries(K), vc()); km.castShadow = true; scene.add(km);
    // the skate spot: a couple of ramps and a rail
    const S = P.skate, R = [];
    R.push(tint(new THREE.BoxGeometry(3, 0.8, 2).translate(0, 0.4, 0).rotateZ(0.25).translate(S.x0 + 3, 0, (S.z0 + S.z1) / 2), 0xb5b0a6));
    R.push(tint(new THREE.BoxGeometry(3, 0.8, 2).translate(0, 0.4, 0).rotateZ(-0.25).translate(S.x1 - 3, 0, (S.z0 + S.z1) / 2), 0xb5b0a6));
    R.push(box(5, 0.06, 0.06, (S.x0 + S.x1) / 2, 0.5, S.z0 + 1, 0xc8202a), box(0.06, 0.5, 0.06, (S.x0 + S.x1) / 2 - 2.4, 0.25, S.z0 + 1, 0x333333), box(0.06, 0.5, 0.06, (S.x0 + S.x1) / 2 + 2.4, 0.25, S.z0 + 1, 0x333333));
    const rm = new THREE.Mesh(mergeGeometries(R.map((g) => (g.index ? g.toNonIndexed() : g))), vc()); rm.receiveShadow = rm.castShadow = true; scene.add(rm);
    // murals on Barrio walls: a painted panel on one face of each chosen building's ground floor (it goes with the wall)
    for (const m of this.sd.murals) {
      if (!m.b) continue;
      const b = m.b, ground = b.cells.filter((c) => c.f === 0); if (!ground.length) continue;
      const xs = ground.map((c) => c.x), zs = ground.map((c) => c.z), hx = ground[0].hx, hz = ground[0].hz, h = b.cells.filter((c) => c.f === 0)[0].hy * 2;
      const x0 = Math.min(...xs) - hx, x1 = Math.max(...xs) + hx, z0 = Math.min(...zs) - hz, z1 = Math.max(...zs) + hz;
      const w = m.side === 'n' || m.side === 's' ? x1 - x0 : z1 - z0;
      const geo = new THREE.PlaneGeometry(w * 0.9, h * 0.92);
      if (m.side === 'n') geo.rotateY(Math.PI).translate((x0 + x1) / 2, h / 2, z0 - 0.02);
      else if (m.side === 's') geo.translate((x0 + x1) / 2, h / 2, z1 + 0.02);
      else if (m.side === 'w') geo.rotateY(-Math.PI / 2).translate(x0 - 0.02, h / 2, (z0 + z1) / 2);
      else geo.rotateY(Math.PI / 2).translate(x1 + 0.02, h / 2, (z0 + z1) / 2);
      const mesh = new THREE.Mesh(geo, pick(mats)); scene.add(mesh);
      const c = ground[0]; (c.props ||= []).push({ obj: [mesh], x: c.x, y: c.y, z: c.z });
    }
  }

  // ================= the Hotel del Coronado =================
  hotel(scene) {
    const H = this.sd.hotel; if (!H) return;
    const red = 0x8c2326, redD = 0x6e1a1e, white = 0xf4f2ec, P = [];          // the Del's deep barn red (not orange)
    const roofOn = (b, h = 1.6) => { const t = topOf(b); P.push({ b, g: tint(hipRoof(t.w + 0.5, t.d + 0.5, h).translate(t.cx, t.y, t.cz), red) }); return t; };
    for (const k of ['north', 'south', 'east', 'west']) {
      const t = roofOn(H[k], 1.8);
      // dormers along the long sides, and a little red cone turret at each end
      const along = t.w > t.d, n = Math.floor((along ? t.w : t.d) / 3);
      for (let i = 0; i < n; i++) {
        const u = -((along ? t.w : t.d) / 2) + 1.5 + i * 3;
        for (const s of [-1, 1]) {
          const x = along ? t.cx + u : t.cx + s * (t.w / 2 - 0.3), z = along ? t.cz + s * (t.d / 2 - 0.3) : t.cz + u;
          P.push({ b: H[k], g: box(0.8, 0.6, 0.8, x, t.y + 0.45, z, white) }, { b: H[k], g: tint(hipRoof(0.9, 0.9, 0.4).translate(x, t.y + 0.75, z), redD) });
        }
      }
      for (const s of [-1, 1]) {
        const x = along ? t.cx + s * (t.w / 2 - 0.6) : t.cx, z = along ? t.cz : t.cz + s * (t.d / 2 - 0.6);
        P.push({ b: H[k], g: cyl(0.7, 0.7, 1.2, x, t.y + 0.6, z, white, 8) }, { b: H[k], g: cone(0.95, 2, x, t.y + 2.2, z, red, 8) });
      }
    }
    // the Crown Room: a great red cone (eight-sided) with a little lantern and cupola on top
    const cr = topOf(H.crown);
    P.push({ b: H.crown, g: cyl(3.6, 3.6, 0.5, cr.cx, cr.y + 0.25, cr.cz, white, 16) });
    for (let k = 0; k < 8; k++) P.push({ b: H.crown, g: tint(new THREE.ConeGeometry(4.2, 4.4, 8, 1, true, k * Math.PI / 4, Math.PI / 4).translate(cr.cx, cr.y + 2.7, cr.cz), red) });
    // a ring of little gabled dormers round the cone, the white lantern with its balcony and windows, the top cone,
    // the flagpole and the Stars and Stripes (as in the photo from Orange Avenue)
    for (let k = 0; k < 8; k++) for (const [r0, y0] of [[2.9, 1.6], [1.9, 2.9]]) {
      const a = (k + (y0 > 2 ? 0.5 : 0)) / 8 * Math.PI * 2, x = cr.cx + Math.cos(a) * r0, z = cr.cz + Math.sin(a) * r0;
      P.push({ b: H.crown, g: box(0.5, 0.35, 0.4, x, cr.y + y0, z, white, -a) }, { b: H.crown, g: tint(new THREE.ConeGeometry(0.38, 0.35, 4).rotateY(Math.PI / 4).translate(x, cr.y + y0 + 0.33, z), white) });
    }
    P.push({ b: H.crown, g: cyl(1.05, 1.05, 1.3, cr.cx, cr.y + 5.3, cr.cz, white, 10) }, { b: H.crown, g: cyl(1.35, 1.35, 0.1, cr.cx, cr.y + 4.75, cr.cz, white, 12) });
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; P.push({ b: H.crown, g: box(0.05, 0.4, 0.05, cr.cx + Math.cos(a) * 1.3, cr.y + 5, cr.cz + Math.sin(a) * 1.3, white) }); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; P.push({ b: H.crown, g: box(0.32, 0.4, 0.04, cr.cx + Math.cos(a) * 1.07, cr.y + 5.4, cr.cz + Math.sin(a) * 1.07, 0x2a3138, -a + Math.PI / 2) }); }
    P.push({ b: H.crown, g: cone(1.25, 2.2, cr.cx, cr.y + 7.05, cr.cz, red, 8) }, { b: H.crown, g: cyl(0.03, 0.03, 3, cr.cx, cr.y + 9.6, cr.cz, 0xf2f2ee, 4) });
    P.push({ b: H.crown, g: box(0.04, 0.5, 0.8, cr.cx, cr.y + 10.8, cr.cz + 0.42, 0xb22234) }, { b: H.crown, g: box(0.05, 0.27, 0.36, cr.cx, cr.y + 10.92, cr.cz + 0.2, 0x3c3b6e) });
    // the round skirt roof of the ballroom under the cone
    P.push({ b: H.crown, g: tint(new THREE.CylinderGeometry(4.3, 5.1, 0.7, 16, 1, true).translate(cr.cx, cr.y - 1.6, cr.cz), red) });
    // the tower over the ocean front: a tall square spire with a flagpole
    const tw = topOf(H.tower);
    P.push({ b: H.tower, g: tint(new THREE.ConeGeometry(2.3, 4, 4, 1).rotateY(Math.PI / 4).translate(tw.cx, tw.y + 2, tw.cz), red) }, { b: H.tower, g: cyl(0.03, 0.03, 2, tw.cx, tw.y + 5, tw.cz, 0x333333, 4) });
    // verandas: white rails along the ocean front
    const so = topOf(H.south);
    for (let f = 1; f < 4; f++) P.push({ b: H.south, g: box(so.w, 0.08, 0.1, so.cx, 1.5 + f * 1.05, H.z1 + 0.06, white) });
    const byB = new Map(); for (const { b, g } of P) { if (!byB.has(b)) byB.set(b, []); byB.get(b).push(g.index ? g.toNonIndexed() : g); }
    const mat = vc({ roughness: 0.6 });
    for (const [b, geos] of byB) cutoutOn(scene, b, geos, mat);
    // the flag on the tower, cabanas and umbrellas on the lawn by the beach
    const cab = [];
    for (let x = H.x0 + 2; x < H.x1 - 2; x += 3) cab.push(box(1.6, 1.2, 1.4, x, 0.6, H.z1 + 7.5, 0xf2f2ea), tint(hipRoof(1.8, 1.6, 0.5).translate(x, 1.2, H.z1 + 7.5), pick([0xb8342a, 0x2a6ab0, 0xf2f2ea])));
    const cm = new THREE.Mesh(mergeGeometries(cab.map((g) => (g.index ? g.toNonIndexed() : g))), vc()); cm.castShadow = true; scene.add(cm);
  }

  // ================= the coast: lifeguard towers, the Shores, the fence and gates =================
  coastline(scene) {
    const P = [];
    for (const t of this.sd.towers) { P.push(box(1.2, 0.9, 1.2, t.x, 1.6, t.z, 0x4aa8d8), tint(hipRoof(1.5, 1.5, 0.4).translate(t.x, 2.05, t.z), 0xf2f2ea)); for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) P.push(box(0.08, 1.2, 0.08, t.x + a, 0.6, t.z + b, 0xd8d0c0)); P.push(box(0.3, 0.05, 1.4, t.x + 0.9, 0.6, t.z, 0xd8d0c0)); }
    // the base fences (chain-link with a top rail) and the gate booths
    for (const f of this.sd.fences) for (let x = f.x0; x < f.x1; x += 2) {
      if (x > f.gap[0] && x < f.gap[1]) continue;
      if (!onCoronado(x, f.z)) continue;
      P.push(box(2, 1.2, 0.04, x + 1, 0.6, f.z, 0x9aa0a4), box(0.06, 1.4, 0.06, x, 0.7, f.z, 0x6a6e72));
    }
    for (const f of this.sd.fenceLines || []) for (let i = 1; i < f.pts.length; i++) {
      const [ax, az] = f.pts[i - 1], [bx, bz] = f.pts[i], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bz - az, bx - ax);
      for (let d = 0; d < L - 0.5; d += 2) { const x = ax + (bx - ax) * (d + 1) / L, z = az + (bz - az) * (d + 1) / L; P.push(box(2, 1.2, 0.04, x, 0.6, z, 0x9aa0a4, -yaw), box(0.06, 1.45, 0.06, ax + (bx - ax) * d / L, 0.72, az + (bz - az) * d / L, 0x6a6e72), box(2, 0.04, 0.04, x, 1.38, z, 0x8a8e92, -yaw)); }
    }
    for (const g of this.sd.gates) {
      P.push(box(1.8, 1.4, 1.4, g.x, 0.7, g.z, 0xd8d4c8), tint(hipRoof(2.2, 1.8, 0.4).translate(g.x, 1.4, g.z), 0x5a6066), box(4, 0.08, 0.08, g.x + 2.6, 0.8, g.z + (g.nbsd ? 2 : -1), 0xe8e8e2), box(0.5, 0.08, 0.08, g.x + 4.4, 0.8, g.z + (g.nbsd ? 2 : -1), 0xc8202a));
    }
    if (P.length) { const m = new THREE.Mesh(mergeGeometries(P.map((g) => (g.index ? g.toNonIndexed() : g))), vc()); m.castShadow = true; scene.add(m); }
    // the gate signs
    for (const g of this.sd.gates) {
      const t = canvasTex(512, 128, (x, w, h) => { x.fillStyle = '#0d2a52'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e8c040'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); x.fillStyle = '#fff'; x.font = '800 40px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(g.nbsd ? 'NAVAL BASE SAN DIEGO' : 'NAS NORTH ISLAND', w / 2, h * 0.42); x.font = '700 26px Inter, Arial, sans-serif'; x.fillStyle = '#e8c040'; x.fillText(g.nbsd ? 'GATE 7' : 'U.S. NAVY', w / 2, h * 0.78); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide }));
      s.position.set(g.x - 3.4, 1.4, g.z + (g.nbsd ? 0 : 1)); s.rotation.y = g.nbsd ? Math.PI / 2 : 0; scene.add(s);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: 0x333333 })); post.position.set(g.x - 3.4, 0.45, g.z + (g.nbsd ? 0 : 1)); scene.add(post);
    }
  }

  // ================= the Silver Strand past the edge of the map: sand, dunes, the highway, fading into the haze =================
  strandFar(scene) {
    const i0 = CORONADO.findIndex(([a, b]) => a === -100 && b === 296), i1 = CORONADO.findIndex(([a, b]) => a === -122 && b === 298);
    const pts = CORONADO.slice(i0, i1 + 1);
    const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, -b)));
    const geo = new THREE.ShapeGeometry(shape, 4).rotateX(-Math.PI / 2);
    const tex = canvasTex(64, 512, (x, w, h) => {
      x.fillStyle = '#d9c9a2'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 900; k++) { x.fillStyle = k % 3 ? 'rgba(170,150,110,.18)' : 'rgba(110,130,70,.25)'; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2 + Math.random() * 5); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 20, pos.getZ(i) / 60);
    // and where it meets Imperial Beach: the beach runs on down the ocean side, dunes behind it
    const ib = new THREE.ShapeGeometry(new THREE.Shape([[-56, 500], [-48, 522], [-50, 560], [-58, 640], [-72, 760], [-104, 760], [-82, 560], [-76, 520], [-70, 470]].map(([a, b]) => new THREE.Vector2(a, -b))), 4).rotateX(-Math.PI / 2);
    const ipos = ib.attributes.position, iuv = ib.attributes.uv;
    for (let i = 0; i < ipos.count; i++) iuv.setXY(i, ipos.getX(i) / 20, ipos.getZ(i) / 60);
    const sm = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    const sand = new THREE.Mesh(mergeGeometries([geo, ib]), sm); sand.position.y = -0.02; sand.receiveShadow = true; scene.add(sand);
    // the highway carries on down the middle, with dune scrub and the odd palm either side
    const road = [[-111, 296], [-104, 312], [-96, 340], [-87, 380], [-76, 440], [-65, 520], [-62, 560], [-70, 640]].map(([a, b]) => new THREE.Vector3(a, 0, b));
    const curve = new THREE.CatmullRomCurve3(road), P = [];
    const NS = Math.ceil(curve.getLength() / 1.6);
    for (let k = 0; k <= NS; k++) {
      const u = k / NS, p = curve.getPointAt(u), t = curve.getTangentAt(u), yaw = Math.atan2(t.x, t.z);
      P.push(box(5.2, 0.02, 1.9, p.x, 0.0, p.z, 0x4a4b4d, yaw));
      if (k % 2) P.push(box(0.08, 0.025, 0.9, p.x, 0.01, p.z, 0xe2ba3c, yaw));
    }
    const rm = new THREE.Mesh(mergeGeometries(P.map((g) => (g.index ? g.toNonIndexed() : g))), vc({ roughness: 0.9 })); rm.receiveShadow = true; scene.add(rm);
    const trees = [];
    for (let k = 0; k < 90; k++) { const u = Math.random(), p = curve.getPointAt(u), s = (Math.random() < 0.5 ? -1 : 1) * rand(4, 7); trees.push(cone(rand(0.5, 1.1), rand(0.6, 1.4), p.x + s, 0.4, p.z + rand(-2, 2), pick([0x6a7a42, 0x7d8a4e, 0x5a6a3a]), 6)); }
    const tm = new THREE.Mesh(mergeGeometries(trees.map((g) => (g.index ? g.toNonIndexed() : g))), vc({ roughness: 1 })); scene.add(tm);
  }

  // ================= the Barrio shipyards: container stacks and cranes =================
  yards(scene) {
    const cols = [0xc8352b, 0x1e5aa8, 0x2f7a45, 0xe0a020, 0x7a7d80, 0x8a3a1a, 0xf2f2ea, 0x1a6a7a];
    const list = []; for (const c of this.sd.containers) for (let k = 0; k < c.n; k++) list.push({ x: c.x + (k % 3) * 0.05, y: Math.floor(k / 3) * 1.05, z: c.z + (k % 3) * 1.1 - 1.1, col: pick(cols), alive: true });
    if (list.length) {
      const geo = new THREE.BoxGeometry(2.6, 1, 1).translate(0, 0.5, 0), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 }), list.length);
      list.forEach((c, i) => { _m.makeTranslation(c.x, c.y, c.z); im.setMatrixAt(i, _m); im.setColorAt(i, new THREE.Color(c.col)); c.i = i; });
      im.castShadow = im.receiveShadow = true; scene.add(im); this.containers = { im, list };
    }
    // shipyard gantry cranes: braced legs on rails, a portal deck, the machinery house with its cab, an A-frame and a
    // lattice boom reaching out over the water with its cables and hook
    const P = [], Y = 0xd8a020, YD = 0xb07a14, W = 0xe8e8e2, DK = 0x2a2c2e;
    const strut = (a, b, r, c) => { const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = v.length(); const g = new THREE.BoxGeometry(r, L, r); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize())); g.translate(a[0], a[1], a[2]); return tint(g, c); };
    for (const c of this.sd.cranes) {
      const x = c.x, z = c.z, H = 11;
      for (const [a, b] of [[-2.4, -2], [2.4, -2], [-2.4, 2], [2.4, 2]]) P.push(box(0.5, H, 0.5, x + a, H / 2, z + b, Y), box(1, 0.5, 1.2, x + a, 0.25, z + b, YD));
      for (const sx of [-2.4, 2.4]) for (let y = 1; y < H - 1; y += 3) { P.push(strut([x + sx, y, z - 2], [x + sx, y + 3, z + 2], 0.14, Y), strut([x + sx, y, z + 2], [x + sx, y + 3, z - 2], 0.14, Y)); }
      for (const sz of [-2, 2]) P.push(box(5.3, 0.6, 0.5, x, H - 0.3, z + sz, Y), box(5.3, 0.3, 0.3, x, 3, z + sz, Y));
      for (const sz of [-2, 2]) P.push(box(30, 0.12, 0.2, x + 5, 0.06, z + sz, 0x6a6a6a));                         // the rails along the quay
      P.push(box(5.6, 0.5, 4.8, x, H + 0.25, z, Y));
      P.push(box(4, 2.6, 3.4, x + 0.8, H + 1.8, z, W), box(0.05, 0.6, 2.6, x + 2.82, H + 2.2, z, 0x2a3a48), box(1.6, 1.3, 1.4, x - 1.2, H + 1.15, z + 1.4, W), box(0.05, 0.7, 1.1, x - 2.02, H + 1.3, z + 1.4, 0x2a3a48));
      P.push(box(3, 1.4, 3, x + 2.6, H + 3.6, z, 0x8a8a86));                                                      // counterweight
      const top = [x + 0.5, H + 8, z];
      for (const sz of [-1.2, 1.2]) { P.push(strut([x - 1.5, H + 3, z + sz], top, 0.3, Y), strut([x + 2.5, H + 3, z + sz], top, 0.3, Y)); }
      // the boom: two lower chords and a top chord, braced, out over the bay (to the west)
      const bx0 = x - 1, bx1 = x - 26, by0 = H + 3.2, by1 = H + 4.4;
      for (const sz of [-0.7, 0.7]) P.push(strut([bx0, by0, z + sz], [bx1, by1, z + sz], 0.22, Y));
      P.push(strut([bx0, by0 + 1.4, z], [bx1, by1 + 0.4, z], 0.22, Y));
      for (let k = 0; k < 12; k++) { const u0 = k / 12, u1 = (k + 1) / 12, xa = bx0 + (bx1 - bx0) * u0, xb = bx0 + (bx1 - bx0) * u1, ya = by0 + (by1 - by0) * u0, yb = by0 + (by1 - by0) * u1; for (const sz of [-0.7, 0.7]) P.push(strut([xa, ya, z + sz], [xb, yb + 1.4 - 1 * u1, z], 0.08, Y)); }
      P.push(strut(top, [bx1 + 6, by1 + 0.8, z], 0.06, DK), strut(top, [x - 12, by0 + 1.6, z], 0.06, DK));       // stays
      P.push(box(1.2, 0.6, 1.2, bx1 + 3, by1 - 0.3, z, DK), strut([bx1 + 3, by1 - 0.6, z], [bx1 + 3, 3, z], 0.04, DK), box(0.5, 0.6, 0.4, bx1 + 3, 2.7, z, 0xc8352b));   // trolley, hoist rope, hook
    }
    if (P.length) { const m = new THREE.Mesh(mergeGeometries(P.map((g) => (g.index ? g.toNonIndexed() : g))), vc({ metalness: 0.3 })); m.castShadow = true; scene.add(m); }
  }

  // ================= ships, piers, jets, trucks =================
  shipsAt(scene, list) {
    const mat = vc({ roughness: 0.55, metalness: 0.2 }), cache = {};
    for (const s of list) {
      const geo = cache[s.kind] ||= shipGeo(s.kind);
      const m = new THREE.Mesh(geo, mat); m.position.set(s.x, 0.02, s.z); m.rotation.y = s.yaw || 0; m.scale.setScalar(s.s || 1); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const len = (s.kind === 'cvn' ? 46 : s.kind === 'lhd' ? 34 : s.kind === 'lpd' ? 28 : s.kind === 'zumwalt' ? 30 : s.kind === 'lcs' ? 20 : 24) * (s.s || 1);
      this.ships.push({ m, kind: s.kind, len, x: s.x, z: s.z, yaw: s.yaw || 0, sunk: false });
    }
  }
  piersMesh(scene) {
    const P = [];
    for (const p of this.sd.piers) { P.push(box(p.x1 - p.x0, 0.35, p.z1 - p.z0, (p.x0 + p.x1) / 2, 0.45, (p.z0 + p.z1) / 2, 0xa8a49a)); for (let x = p.x0 + 1; x < p.x1; x += 3) for (const z of [p.z0 + 0.3, p.z1 - 0.3]) P.push(box(0.3, 0.8, 0.3, x, 0.05, z, 0x5a5650)); for (let x = p.x0 + 2; x < p.x1 - 1; x += 5) for (const z of [p.z0 + 0.4, p.z1 - 0.4]) P.push(cyl(0.12, 0.14, 0.3, x, 0.78, z, 0x2a2c2e, 6)); }
    if (!P.length) return;
    const m = new THREE.Mesh(mergeGeometries(P.map((g) => (g.index ? g.toNonIndexed() : g))), vc()); m.receiveShadow = true; m.castShadow = true; scene.add(m);
    // people can stand on them: a little height field like the deck's
    this.pierTop = 0.62;
  }
  northIsland(scene) {
    this.ships = []; this.jets = []; this.milList = [];
    const sd = this.sd;
    this.piersMesh(scene);
    // carriers tied up at the North Island piers
    this.shipsAt(scene, sd.carriers || []);
    // jets: parked on the apron, and a flight working the runway (take off, circle out over the ocean, come back in)
    const jg = jetGeo(2.1), jmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });
    const parked = [];
    for (let k = 0; k < 16; k++) parked.push({ x: -204 + (k % 8) * 6.6, z: 12 + Math.floor(k / 8) * 11, yaw: Math.PI / 2 });
    const R = sd.runways && sd.runways[0];
    this.jetMesh = new THREE.InstancedMesh(jg, jmat, parked.length + 4); this.jetMesh.castShadow = true; this.jetMesh.frustumCulled = false; scene.add(this.jetMesh);
    parked.forEach((j, i) => { this.jets.push({ ...j, i, y: 0, mode: 'parked', alive: true }); });
    if (R) for (let k = 0; k < 4; k++) this.jets.push({ i: parked.length + k, mode: 'cycle', alive: true, t: -k * 22, R, x: R.x0, z: R.z0, y: 0, yaw: 0, pitch: 0, roll: 0 });
    for (const j of this.jets) this.drawJet(j);
    this.jetBurn = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.9, 6).rotateZ(Math.PI / 2).translate(-1.95, 0.38, 0), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8 }), 4);
    this.jetBurn.frustumCulled = false; scene.add(this.jetBurn);
    // military vehicles on the base (grey trucks, Humvees, 7-tons)
    const kinds = ['humvee', 'truck', 'pickup'], mm = vc({ roughness: 0.6 });
    const spots = [...sd.vehicles];
    for (let k = 0; k < 24; k++) spots.push({ x: rand(-214, -152), z: rand(2, 74), rot: rand(0, 6.28), kind: pick(kinds) });
    for (let k = 0; k < 10; k++) spots.push({ x: rand(-270, -232), z: rand(14, 84), rot: rand(0, 6.28), kind: pick(kinds) });
    this.milMesh = {};
    for (const kd of kinds) {
      const list = spots.filter((s) => s.kind === kd); if (!list.length) continue;
      const im = new THREE.InstancedMesh(milGeo(kd), mm, list.length); im.castShadow = true; scene.add(im);
      list.forEach((s, i) => { _m.compose(_p.set(s.x, 0, s.z), _q.setFromAxisAngle(UP, s.rot || 0), _s.set(1, 1, 1)); im.setMatrixAt(i, _m); this.milList.push({ ...s, im, i, alive: true }); });
      this.milMesh[kd] = im;
    }
    // a few that drive the base roads (loops round the apron and along the hangar line)
    this.drivers = [];
    const loops = [[[-210, 78], [-152, 78], [-152, 2], [-210, 2]], [[-270, 90], [-232, 90], [-232, 10], [-270, 10]], ...(sd.baseLoops || [])];
    for (let k = 0; k < 12; k++) {
      const kd = pick(kinds), im = new THREE.InstancedMesh(milGeo(kd), mm, 1); im.castShadow = true; im.frustumCulled = false; scene.add(im);
      this.drivers.push({ im, path: loops[k % loops.length], seg: k % 4, u: rand(0, 1), sp: rand(2.5, 4), alive: true, x: 0, z: 0 });
    }
    // the lines at the gates: military vehicles only, stopping for the guard one at a time
    this.queues = (sd.queues || []).map((q) => {
      const P = q.path, cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const vs = [];
      for (let k = 0; k < q.n; k++) { const kd = pick(kinds), im = new THREE.InstancedMesh(milGeo(kd), mm, 1); im.castShadow = true; im.frustumCulled = false; scene.add(im); vs.push({ im, s: cum[q.gate] - 1 - k * 2.6, v: 0, alive: true, hold: 0, x: 0, z: 0 }); }
      return { P, cum, gateS: cum[q.gate], L: cum[cum.length - 1], vs, gateT: 0 };
    });
  }
  navalBase(scene) { this.shipsAt(scene, this.sd.ships); }
  drawJet(j) {
    if (!j.alive) { this.jetMesh.setMatrixAt(j.i, ZERO); return; }
    _q.setFromEuler(new THREE.Euler(j.roll || 0, -(j.yaw || 0), j.pitch || 0, 'YZX'));
    _m.compose(_p.set(j.x, j.y || 0, j.z), _q, _s.set(1, 1, 1)); this.jetMesh.setMatrixAt(j.i, _m);
  }
  // one jet's sortie: taxi to the end, roll, rotate, climb out over the ocean, a long circuit, land back on the runway
  flyJet(j, dt, bi) {
    const R = j.R; j.t += dt;
    const T = 70, t = ((j.t % T) + T) % T, dx = (R.x1 - R.x0) / R.L, dz = (R.z1 - R.z0) / R.L;
    let x, z, y = 0, yaw = Math.atan2(R.z1 - R.z0, R.x1 - R.x0), pitch = 0, roll = 0, burn = 0;
    if (t < 12) { const d = t * t * 0.55; x = R.x0 + dx * d; z = R.z0 + dz * d; burn = 1; if (d > R.L * 0.55) { const k = d - R.L * 0.55; y = k * 0.18; pitch = 0.2; } }
    else if (t < 46) {
      // the circuit: out over the Pacific and round in a big loop back to line up with the runway
      const k = (t - 12) / 34, a = k * Math.PI * 2;
      const cx = (R.x0 + R.x1) / 2 - 30, cz = (R.z0 + R.z1) / 2 - 20, r = 110;
      x = cx + Math.cos(a + Math.PI * 0.85) * r * 1.1; z = cz + Math.sin(a + Math.PI * 0.85) * r * 0.75; y = 24 + Math.sin(a) * 8;
      const nx = cx + Math.cos(a + 0.05 + Math.PI * 0.85) * r * 1.1, nz = cz + Math.sin(a + 0.05 + Math.PI * 0.85) * r * 0.75;
      yaw = Math.atan2(nz - z, nx - x); roll = -0.5; burn = 0.6;
    } else if (t < 58) {
      // the approach: down a glide path to the threshold
      const k = (t - 46) / 12, sx = R.x0 - dx * 120, sz = R.z0 - dz * 120;
      x = sx + (R.x0 - sx) * k; z = sz + (R.z0 - sz) * k; y = 18 * (1 - k) + 0.02; pitch = 0.05;
    } else { const k = (t - 58) / 12, d = R.L * 0.75 * (1 - (1 - k) ** 2); x = R.x0 + dx * d; z = R.z0 + dz * d; }
    j.x = x; j.z = z; j.y = y; j.yaw = yaw; j.pitch = pitch; j.roll = roll;
    // afterburner glow on the take-off roll
    if (burn > 0 && bi < 4) { _q.setFromEuler(new THREE.Euler(roll, -yaw, pitch, 'YZX')); _m.compose(_p.set(x, y, z), _q, _s.set(burn * 1.1, 1, 1)); this.jetBurn.setMatrixAt(bi, _m); }
    else if (bi < 4) this.jetBurn.setMatrixAt(bi, ZERO);
  }

  // ================= the corner label, the boats, the sunk cars =================
  // ================= jet skis: on looping lanes north of the bridge only (clear of the piers, the cruise ships and the
  // naval base), each lane run one way so they never cross; they slow behind anything in front and blow up like boats
  jetSkiFleet(scene) {
    const lanes = [{ cx: -119, cz: -32, rx: 9, rz: 44 }, { cx: -120, cz: 62, rx: 8, rz: 27 }, { cx: -112, cz: -88, rx: 8, rz: 8 }];
    const cols = [0xe8e8e2, 0x1e5aa8, 0xc8202a, 0xf2c21a, 0x2a2c2e, 0x16a38a];
    this.jetskis = [];
    lanes.forEach((L, li) => {
      const n = li === 2 ? 1 : 3;
      for (let k = 0; k < n; k++) {
        const g = new THREE.Group(), col = pick(cols);
        const parts = [box(1.0, 0.22, 0.42, 0, 0.11, 0, col), box(0.4, 0.14, 0.34, 0.15, 0.28, 0, 0x1c1d20), box(0.2, 0.18, 0.36, 0.42, 0.28, 0, col),
          box(0.12, 0.3, 0.16, -0.05, 0.5, 0, pick([0xf26a1a, 0xf2c21a, 0xe8e8e2])), sph(0.06, -0.02, 0.72, 0, 0x6b4a32), box(0.05, 0.05, 0.36, 0.35, 0.45, 0, 0x2a2c2e)];
        const m = new THREE.Mesh(mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q))), vc({ roughness: 0.4 })); m.castShadow = true; g.add(m);
        g.scale.setScalar(1.25); scene.add(g);
        this.jetskis.push({ m: g, lane: L, a: (k / n) * Math.PI * 2 + li, sp: rand(0.11, 0.15), dir: li % 2 ? -1 : 1, x: 0, z: 0, sunk: false, len: 1.3 });
      }
    });
  }
  updateJetSkis(dt) {
    for (const j of this.jetskis || []) {
      if (j.sunk) continue;
      const L = j.lane;
      // keep a gap to the one ahead on the same lane, and stop for any harbour boat that wanders across
      let slow = 1;
      for (const o of this.jetskis) if (o !== j && !o.sunk && o.lane === L) { let d = (o.a - j.a) * j.dir; d = ((d % 6.283) + 6.283) % 6.283; if (d < 0.35) slow = Math.min(slow, d / 0.35); }
      const hb = G.harbor && G.harbor.boats; if (hb) for (const b of hb) if (!b.dead && Math.hypot(b.x - j.x, b.z - j.z) < 4.5) slow = Math.min(slow, 0.25);
      j.a += j.dir * j.sp * slow * dt * (1 + 0.15 * Math.sin(G.time * 0.7 + j.a));
      const x = L.cx + Math.cos(j.a) * L.rx, z = L.cz + Math.sin(j.a) * L.rz, nx = L.cx + Math.cos(j.a + j.dir * 0.05) * L.rx, nz = L.cz + Math.sin(j.a + j.dir * 0.05) * L.rz;
      j.x = x; j.z = z;
      j.m.position.set(x, 0.04 + Math.abs(Math.sin(G.time * 6 + j.a * 3)) * 0.06, z);
      j.m.rotation.set(0, -Math.atan2(nz - z, nx - x), j.dir * -0.25);
      if (slow > 0.5 && Math.random() < dt * 22) G.fx.bits.emit(x - Math.cos(Math.atan2(nz - z, nx - x)) * 0.8, 0.12, z - Math.sin(Math.atan2(nz - z, nx - x)) * 0.8, rand(-0.6, 0.6), rand(0.6, 1.6), rand(-0.6, 0.6), rand(0.08, 0.16), 0.7, 0.9, 0.95, 1, 0.9);
    }
  }
  // ================= the Blue Line: a second trolley line down Fifth Avenue, through Barrio Logan to the Naval Base =================
  blueLine(scene) {
    const C = this.city, X = 66, Z0 = -62, Z1 = 184, TR = 0.62, hw = C.roadW / 2;
    // the street becomes trolley-only (cars cross it at the junctions, they don't drive along it)
    for (const e of C.edges.values()) { const a = C.nodes[e.a], b = C.nodes[e.b]; if (a.x === X && b.x === X && Math.min(a.z, b.z) >= -66) { e.blocked = true; e.transit = true; } }
    const grounds = [G.ground, G.ground && G.ground.second].filter(Boolean);
    for (const gr of grounds) {
      gr.rect(X - hw, Z0, X + hw, Z1 + 2, '#9d978c');
      for (const s of [-1, 1]) { const tx = X + s * TR; gr.rect(tx - 0.34, Z0, tx + 0.34, Z1 + 2, '#6b665f'); for (let z = Z0; z < Z1 + 2; z += 0.45) gr.rect(tx - 0.3, z, tx + 0.3, z + 0.14, 'rgba(60,45,35,.55)'); for (const r of [-0.2, 0.2]) gr.line(tx + r, Z0, tx + r, Z1 + 2, 0.05, '#c9ccd0'); }
      gr.rect(X - 1.6, Z1 + 2, X + 1.6, Z1 + 2.4, '#d8b21c');
      gr.tex.needsUpdate = true;
    }
    // stations
    const stations = [{ z: 30, name: 'PARK & MARKET' }, { z: 120, name: 'BARRIO LOGAN' }, { z: 176 + 5.5, name: '32ND ST · NAVAL BASE' }];
    const P = [];
    for (const st of stations) for (const s of [-1, 1]) {
      const px = X + s * (hw - 0.62);
      P.push(box(1.24, 0.1, 13, px, 0.05, st.z, 0xbdb7ab), box(0.16, 0.012, 13, X + s * (hw - 1.16), 0.106, st.z, 0xf2c21c), box(1.1, 0.06, 11, px, 1.42, st.z, 0xd9dde0));
      for (let k = -2; k <= 2; k++) P.push(box(0.06, 1.3, 0.06, px + s * 0.35, 0.75, st.z + k * 2.6, 0x2a2d31));
      (C.crowds ||= []); for (let k = 0; k < 2; k++) C.crowds.push({ x: px, z: st.z + rand(-4, 4), r: 0.45, n: Math.round(rand(2, 5)), look: st.z > 170 && Math.random() < 0.6 ? 'navy' : undefined });
    }
    for (let z = Z0 + 2; z < Z1; z += 7) { if (C.zs.some((v) => Math.abs(v - z) < hw + 0.6)) continue; P.push(cyl(0.05, 0.06, 2.3, X, 1.15, z, 0x2a2d31, 6), box(TR * 2 + 0.2, 0.04, 0.04, X, 2.2, z, 0x2a2d31)); }
    for (const s of [-1, 1]) P.push(box(0.018, 0.018, Z1 - Z0, X + s * TR, 2.16, (Z0 + Z1) / 2, 0x1a1a1a));
    const pm = new THREE.Mesh(mergeGeometries(P.map((g) => (g.index ? g.toNonIndexed() : g))), vc({ roughness: 0.6 })); pm.castShadow = true; pm.receiveShadow = true; scene.add(pm);
    for (const st of stations) {
      const t = canvasTex(256, 48, (x, w, h) => { x.fillStyle = '#1a3a6b'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a6fd0'; x.fillRect(0, 0, 18, h); x.fillStyle = '#fff'; x.font = '700 18px Inter, Arial'; x.textBaseline = 'middle'; x.fillText(st.name, 26, 25, w - 30); });
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.34), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); b.position.set(X + hw - 0.3, 1.75, st.z + 6); b.rotation.y = Math.PI / 2; scene.add(b);
    }
    // two trains: red, articulated, the Blue Line on their destination boards
    const [side] = sideTexture(4062), front = frontTexture();
    const body = new THREE.MeshStandardMaterial({ map: side, roughness: 0.4, metalness: 0.2 }), roof = new THREE.MeshStandardMaterial({ color: 0xb3141b, roughness: 0.5 }), nose = new THREE.MeshStandardMaterial({ map: front, roughness: 0.35 });
    const geo = new THREE.BoxGeometry(0.86, 1.3, 4.4).translate(0, 0.77, 0);
    this.blue = { X, Z0, Z1, TR, stations, trains: [] };
    for (const [dir, z] of [[1, 40], [-1, 150]]) {
      const secs = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, [body, body, roof, roof, nose, nose]); m.castShadow = true; scene.add(m); secs.push(m); }
      this.blue.trains.push({ dir, z, speed: 4.4, dwell: 0, last: null, secs, derailed: false });
    }
  }
  railBlocks(x1, z1, x2, z2) {
    const B = this.blue; if (!B) return false;
    for (const [x, z] of [[x1, z1], [x2, z2]]) {
      if (Math.abs(x - B.X) > B.TR + 1.4) continue;
      for (const t of B.trains) { const a = Math.min(t.z, t.z - t.dir * 18), b = Math.max(t.z, t.z - t.dir * 18); if (z > a - (t.dir > 0 ? 0.8 : 6) && z < b + (t.dir > 0 ? 6 : 0.8)) return true; }
    }
    return false;
  }
  updateBlue(dt) {
    const B = this.blue; if (!B) return;
    for (const t of B.trains) {
      if (t.derailed) continue;
      let target = 4.4;
      for (const st of B.stations) {
        if (t.last === st) continue;
        const stopAt = st.z + t.dir * 9, ahead = (stopAt - t.z) * t.dir;
        if (ahead > -0.2 && ahead < 14) target = Math.min(target, Math.sqrt(Math.max(0, ahead) * 4.4));
        if (ahead < 0.1 && ahead > -0.6 && t.dwell <= 0) { t.dwell = rand(6, 10); t.last = st; t.speed = 0; }
      }
      if (t.dwell > 0) { t.dwell -= dt; target = 0; }
      for (const c of G.agents.cars) if (c.state !== 'hidden' && Math.abs(c.pos.x - (B.X + t.dir * B.TR)) < 0.9 && (c.pos.z - t.z) * t.dir > 0 && (c.pos.z - t.z) * t.dir < 4) target = 0;
      if (this.city.obstacleNear(B.X + t.dir * B.TR, t.z + t.dir * 3, 0.6)) target = 0;
      t.speed += clamp(target - t.speed, -5 * dt, 1.6 * dt);
      t.z += t.dir * t.speed * dt;
      // the ends: run back on the other track
      if ((t.dir > 0 && t.z > B.Z1) || (t.dir < 0 && t.z < B.Z0 + 18)) { t.z -= t.dir * 18; t.dir *= -1; t.last = null; t.dwell = rand(8, 12); }
      const x = B.X + t.dir * B.TR;
      t.secs.forEach((m, i) => m.position.set(x, 0, t.z - t.dir * (i * 4.52 + 2.2)));
    }
  }
  airHit(p) {
    for (const j of this.jets || []) if (j.alive && (j.y || 0) > 0.5 && Math.hypot(j.x - p.x, j.y - p.y, j.z - p.z) < 2.6) return j;
    return G.sky && G.sky.hitTest ? G.sky.hitTest(p) : null;
  }
  blocksBoat(x, z) {
    for (const pr of this.piers) if (pr.alive && Math.hypot(x - pr.x, z - pr.z) < 3) return true;
    for (const p of this.sd.piers) if (x > p.x0 - 2 && x < p.x1 + 2 && z > p.z0 - 8 && z < p.z1 + 8) return true;
    return false;
  }
  splash(x, z, s = 1) {
    for (let k = 0; k < 30 * s; k++) G.fx.bits.emit(x + rand(-0.4, 0.4), 0.15, z + rand(-0.4, 0.4), rand(-1.5, 1.5) * s, rand(3, 7) * s, rand(-1.5, 1.5) * s, rand(0.08, 0.18), rand(0.8, 1.4), 0.8, 0.9, 1, 0.9);
    G.fx.ring && G.fx.ring(x, 0.08, z, 2.5 * s, 1.2, new THREE.Color(0.9, 0.95, 1), 0.5);
  }
  onBlast(x, y, z, r, power, kind) {
    const reach = { bomb: 5.5, meteor: 10, explosion: 3.2, laser: 2.2, wind: 0 }[kind] ?? Math.min(6, r * 0.25);
    const dmgBase = { bomb: 520, meteor: 1400, explosion: 160, laser: 46 }[kind] ?? power * 30;
    if (reach > 0) {
      for (const sg of this.segs) {
        if (!sg.alive) continue;
        let bd = 1e9; const SS = sg.samples || this.samples; for (let i = sg.i0; i <= sg.i1; i += 2) { const s = SS[i], d = Math.hypot(s.x - x, s.y - y, s.z - z); if (d < bd) bd = d; }
        if (bd < reach + 1.5) this.damageSeg(sg, dmgBase * clamp(1 - bd / (reach + 2), 0.15, 1), { x, y, z });
      }
      for (const pr of this.piers) if (pr.alive && Math.hypot(pr.x - x, pr.z - z) < reach + 1 && y < pr.h + 1) { pr.hp -= dmgBase * 0.8; if (pr.hp <= 0) this.breakPier(pr); }
      // jets and trucks blow up
      for (const j of this.jets) if (j.alive && Math.hypot(j.x - x, j.z - z, (j.y || 0) - y) < reach + 1.5) { j.alive = false; j.deadT = 40; G.fx.explosion(j.x, (j.y || 0) + 0.4, j.z, 1.1, null, 'bomb'); this.drawJet(j); this.jetMesh.instanceMatrix.needsUpdate = true; }
      for (const v of this.milList) if (v.alive && Math.hypot(v.x - x, v.z - z) < reach + 1) { v.alive = false; G.fx.explosion(v.x, 0.5, v.z, 0.9, null, 'bomb'); G.fx.groundFire(v.x, 0, v.z, rand(8, 16), 0.7); _m.compose(_p.set(v.x, 0, v.z), _q.setFromAxisAngle(UP, v.rot || 0), _s.set(1, 0.7, 1)); v.im.setMatrixAt(v.i, _m); v.im.instanceMatrix.needsUpdate = true; v.im.setColorAt && null; }
      if (this.containers) { let hit = false; for (const c of this.containers.list) if (c.alive && Math.hypot(c.x - x, c.y - y, c.z - z) < reach + 1) { c.alive = false; hit = true; this.containers.im.setMatrixAt(c.i, ZERO); G.fx.dust(c.x, c.y, c.z, 0.6); } if (hit) this.containers.im.instanceMatrix.needsUpdate = true; }
      for (const q of this.queues || []) for (const v of q.vs) if (v.alive && Math.hypot(v.x - x, v.z - z) < reach + 1) { v.alive = false; G.fx.explosion(v.x, 0.5, v.z, 0.9, null, 'bomb'); G.fx.groundFire(v.x, 0, v.z, rand(6, 12), 0.6); _m.compose(_p.set(v.x, 0, v.z), _q.identity(), _s.set(1, 0.6, 1)); v.im.setMatrixAt(0, _m); v.im.instanceMatrix.needsUpdate = true; }
      for (const d of this.drivers) if (d.alive && Math.hypot(d.x - x, d.z - z) < reach + 1) { d.alive = false; G.fx.explosion(d.x, 0.5, d.z, 0.9, null, 'bomb'); d.im.setMatrixAt(0, ZERO); d.im.instanceMatrix.needsUpdate = true; }
    }
  }
  paintLowriders() {
    // the Barrio's parked cars: candy paint, chrome, a few riding low (js/sdworld.js picked the spots)
    const A = G.agents; if (!A) return;
    const spots = new Set(this.sd.lowriders.map((s) => `${s.x.toFixed(1)},${s.z.toFixed(1)}`));
    for (const c of A.cars) if (c.state === 'parked' && spots.has(`${c.pos.x.toFixed(1)},${c.pos.z.toFixed(1)}`)) {
      c.color = new THREE.Color(pick([0x7a0d6a, 0xc8102e, 0x1d4fa8, 0x0f7a5a, 0xe8b818, 0x5a1a8a, 0x111111, 0xd8d8e0])); A.carBody.setColorAt(c.i, c.color);
      c.scale = [1.02, 0.86, 1.18]; c.lowrider = true;
    }
    if (A.carBody.instanceColor) A.carBody.instanceColor.needsUpdate = true;
  }
  update(dt) {
    const n = G.night || 0;
    this.lampHeads.material.color.setRGB(0.6 + n * 3, 0.55 + n * 2.6, 0.45 + n * 2);
    // falling spans and piers
    for (const sg of this.segs) if (sg.fall) {
      const f = sg.fall; f.t += dt; f.vy += 14 * dt;
      sg.grp.position.y -= f.vy * dt;   // (the group sits at the span's centre)
      sg.grp.rotation.x += f.rx * dt * 0.4; sg.grp.rotation.z += f.rz * dt * 0.4;
      if (sg.grp.position.y < -0.2 && !f.splashed) { f.splashed = true; this.splash(sg.cx, sg.cz, 2.4); }
      if (f.t > 4) { sg.grp.visible = false; sg.fall = null; }
    }
    for (const pr of this.piers) if (pr.fall) {
      const f = pr.fall; f.t += dt;
      pr.grp.rotation.x = f.ax * Math.min(1.4, f.t * f.t * 0.6); pr.grp.rotation.z = f.az * Math.min(1.4, f.t * f.t * 0.6);
      if (f.t > 3) { pr.grp.visible = false; pr.fall = null; }
    }
    // jets
    let bi = 0;
    for (const j of this.jets) {
      if (!j.alive) { if ((j.deadT -= dt) <= 0 && j.mode === 'cycle') { j.alive = true; j.t = 0; } else { if (j.mode === 'cycle' && bi < 4) this.jetBurn.setMatrixAt(bi++, ZERO); continue; } }
      if (j.mode === 'cycle') { this.flyJet(j, dt, bi++); this.drawJet(j); }
    }
    this.jetMesh.instanceMatrix.needsUpdate = true; this.jetBurn.instanceMatrix.needsUpdate = true;
    this.updateJetSkis(dt);
    this.updateBlue(dt);
    // trucks round the base
    for (const d of this.drivers) {
      if (!d.alive) continue;
      const P = d.path, a = P[d.seg], b = P[(d.seg + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      d.u += d.sp * dt / L; if (d.u >= 1) { d.u -= 1; d.seg = (d.seg + 1) % P.length; }
      d.x = a[0] + (b[0] - a[0]) * d.u; d.z = a[1] + (b[1] - a[1]) * d.u;
      _m.compose(_p.set(d.x, 0, d.z), _q.setFromAxisAngle(UP, Math.atan2(b[0] - a[0], b[1] - a[1])), _s.set(1, 1, 1)); d.im.setMatrixAt(0, _m); d.im.instanceMatrix.needsUpdate = true;
    }
    for (const q of this.queues || []) {
      const live = q.vs.filter((v) => v.alive).sort((a, b) => b.s - a.s);
      let ahead = null;
      for (const v of live) {
        let want = 2.6;
        if (ahead && ahead.s < q.L) want = Math.min(want, Math.max(0, (ahead.s - v.s - 2.4) * 1.8));
        if (!v.cleared && v.s < q.gateS) { const d = q.gateS - v.s; want = Math.min(want, Math.max(0, d * 1.4)); if (d < 0.15) { v.hold += dt; if (v.hold > 3.5) { v.cleared = true; v.hold = 0; } } }
        v.v += clamp(want - v.v, -6 * dt, 2.5 * dt); v.s += v.v * dt;
        if (v.s >= q.L) { const last = live[live.length - 1]; v.s = Math.min(-2, (last && last !== v ? last.s : 0) - 2.6); v.cleared = false; v.v = 0; }
        let i = 1; while (i < q.P.length - 1 && q.cum[i] < v.s) i++;
        const a = q.P[i - 1], b = q.P[i], u = clamp((v.s - q.cum[i - 1]) / (q.cum[i] - q.cum[i - 1] || 1), 0, 1);
        v.x = a[0] + (b[0] - a[0]) * u; v.z = a[1] + (b[1] - a[1]) * u;
        const sc = v.s < 0 ? 0 : 1;
        _m.compose(_p.set(v.x, 0, v.z), _q.setFromAxisAngle(UP, Math.atan2(b[0] - a[0], b[1] - a[1])), _s.set(sc, sc, sc)); v.im.setMatrixAt(0, _m); v.im.instanceMatrix.needsUpdate = true;
        ahead = v;
      }
    }
    // cars that went into the bay come back later as fresh traffic out of view
    if ((this.sunkCheckT -= dt) <= 0 && G.agents) {
      this.sunkCheckT = 6;
      for (const c of G.agents.cars) if (c.state === 'hidden' && !c.emerg && !c.posted && c.sunkT == null) c.sunkT = G.time;
      for (const c of G.agents.cars) if (c.state === 'hidden' && c.sunkT != null && G.time - c.sunkT > 25) { c.sunkT = null; G.agents.spawnCar(c.i, c); }
    }
    // the corner label follows the view: Coronado over the island (and the bridge's Coronado half), San Diego elsewhere
    const T = G.camTarget, onIsle = !!T && (onCoronado(T.x, T.z) || onCoronado(T.x + 12, T.z) || onCoronado(T.x - 12, T.z));
    if (T && onIsle !== this.label.on) {
      this.label.on = onIsle;
      const el = document.getElementById('mapTitle'); if (el) el.textContent = onIsle ? 'CORONADO ISLAND, CA' : 'SAN DIEGO, CA';
    }
  }
}

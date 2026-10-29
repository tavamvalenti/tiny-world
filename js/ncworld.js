// NORTH COUNTY: what stands and moves on the ground js/northcounty.js laid out.
//   the Pacific, the lagoons and the harbor (one water surface, its depth from the land mask), the seabed and the
//   land past the map's edge, Camp Pendleton's hills on the northern horizon, the towns inland
//   Oceanside Pier: a long wooden pier on pilings, lamps, the building at the end; it breaks span by span
//   the Carlsbad sign: the white truss arch over Carlsbad Blvd, lit at night; the blue Victorian behind it
//   the stations (Carlsbad Village, the Oceanside Transit Center) and the Coastliner trains up and down the coast
//   I-5's traffic, the harbor's docks, slips and boats, the jetties, the lifeguard towers
//   the corner label: CARLSBAD, CA or OCEANSIDE, CA, whichever side of Buena Vista Lagoon you're over
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { addRipples } from './water.js';
import { solids } from './solids.js';
import { tint, box, cyl, cone, canvasTex, cutoutOn, hipRoof } from './mapkit.js';
import { NC, BOUNDS, MASK, maskData, PIER, isLand, SEA, hillEdge } from './ncgeo.js';
import { railX, ZONES, ROADS } from './northcounty.js';
import { carGeos } from './agents.js';
import { busGeos } from './harbor.js';
import { Freeway } from './ncfreeway.js';
import { Places } from './ncplaces.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, ...o });
const mergeTo = (scene, geos, mat, shadow = true) => { const m = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), mat); m.castShadow = shadow; m.receiveShadow = true; scene.add(m); return m; };
// a polyline's length and a point/heading at distance s along it
function track(pts) {
  const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s) => {
    s = clamp(s, 0, L); let k = 1; while (k < cum.length - 1 && cum[k] < s) k++;
    const a = pts[k - 1], b = pts[k], t = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  };
  return { pts, L, at };
}
// join line pieces that meet end to end (OSM splits every road and track into many ways)
function chains(lines, tol = 0.8) {
  const rest = lines.map((l) => l.slice()), out = [];
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
  while (rest.length) {
    let c = rest.shift(), grown = true;
    while (grown) {
      grown = false;
      for (let k = 0; k < rest.length; k++) {
        const w = rest[k];
        if (same(w[0], c[c.length - 1])) { c = c.concat(w.slice(1)); rest.splice(k, 1); grown = true; break; }
        if (same(w[w.length - 1], c[0])) { c = w.slice(0, -1).concat(c); rest.splice(k, 1); grown = true; break; }
      }
    }
    out.push(c);
  }
  return out.sort((a, b) => track(b).L - track(a).L);
}

// ---------- the water: one surface for the Pacific, the lagoons, the river and the harbor ----------
function maskTexture() {
  const { LAND } = maskData(), W = MASK.w, H = MASK.h;
  const layer = (blur, test) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const img = x.createImageData(W, H); for (let i = 0; i < LAND.length; i++) { const v = test(LAND[i]) ? 255 : 0; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    if (!blur) return img.data;
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const x2 = c2.getContext('2d');
    x2.fillStyle = '#fff'; x2.fillRect(0, 0, W, H); x2.filter = `blur(${blur}px)`; x2.drawImage(c, 0, 0);
    return x2.getImageData(0, 0, W, H).data;
  };
  const land = (v) => v === 2, hard = layer(0, land), soft = layer(2, land), deep = layer(14, land), sea = layer(3, (v) => v === 0);
  const out = new Uint8Array(W * H * 4);
  for (let r = 0; r < H; r++) for (let i = 0; i < W; i++) { const s = (r * W + i) * 4, d = ((H - 1 - r) * W + i) * 4; out[d] = hard[s]; out[d + 1] = soft[s]; out[d + 2] = deep[s]; out[d + 3] = sea[s]; }
  const t = new THREE.DataTexture(out, W, H, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}
function makeWater() {
  const timeU = { value: 0 }, mask = maskTexture(), box4 = new THREE.Vector4(MASK.x0, MASK.z0, MASK.w, MASK.h);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, specularIntensity: 0.45, transparent: true, envMapIntensity: 0.55, depthWrite: false });
  mat.customProgramCacheKey = () => 'nc-water';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU; sh.uniforms.uMask = { value: mask }; sh.uniforms.uBox = { value: box4 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform float uTime; uniform sampler2D uMask; uniform vec4 uBox;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 muv = vec2((vW.x - uBox.x) / uBox.z, 1.0 - (vW.z - uBox.y) / uBox.w);
        vec4 mk = texture2D(uMask, muv);
        float land = mk.r, near = mk.g, depth = clamp(1.0 - mk.b * 1.5, 0., 1.), ocean = mk.a;
        float wpatch = 0.5 + 0.5 * sin(vW.x * 0.07 + vW.z * 0.05 + uTime * 0.05) * sin(vW.x * 0.023 - vW.z * 0.041);
        vec3 deep = mix(mix(vec3(0.05,0.17,0.17), vec3(0.07,0.2,0.2), wpatch), mix(vec3(0.03,0.15,0.24), vec3(0.04,0.2,0.29), wpatch), ocean);
        vec3 shallow = mix(vec3(0.16,0.32,0.28), vec3(0.22,0.55,0.52), ocean);
        diffuseColor.rgb = mix(shallow, deep, sqrt(depth));
        diffuseColor.a = mix(0.28, 0.995, smoothstep(0., 0.35, depth));
        // the surf: lines of breakers rolling in on the open coast (the lagoons and the harbor are calm)
        float edge = near + 0.07 * sin(vW.z * 0.21 + uTime * 0.9);
        float foam = smoothstep(0.12, 0.0, abs(edge - 0.32 - 0.1 * fract(uTime * 0.12 + vW.z * 0.002))) * (0.55 + 0.45 * sin(vW.z * 1.3 + vW.x * 0.7 + uTime * 2.6));
        foam += smoothstep(0.1, 0.0, abs(edge - 0.14 - 0.05 * sin(uTime * 0.8 + vW.z * 0.2))) * 0.5;
        foam *= smoothstep(0.35, 0.85, ocean) * smoothstep(0.02, 0.1, near);   // the lagoons and the harbor are flat calm
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96), clamp(foam, 0., 1.) * 0.85);
        diffuseColor.a = max(diffuseColor.a, clamp(foam, 0., 1.) * 0.9);
        diffuseColor.a *= 1.0 - smoothstep(0.45, 0.6, land);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec2 wv = vec2(sin(vW.x * 1.3 + uTime * 1.7) + sin(vW.x * 0.6 + vW.z * 1.1 + uTime * 1.2), cos(vW.z * 1.5 + uTime * 1.3) + sin(vW.z * 0.7 - vW.x * 0.9 + uTime)) * 0.05;
        normal = normalize(normal + (viewMatrix * vec4(wv.x, 0., wv.y, 0.)).xyz * 0.6);`);
    addRipples(sh, { flow: [0.3, 0.05], scale: 0.9, amp: 0.8, gloss: [0.14, 0.34] });
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), mat);
  m.position.set(-300, 0.05, (BOUNDS.z0 + BOUNDS.z1) / 2); m.renderOrder = 1;
  return { mesh: m, timeU, mask, box: box4 };
}

// ---------- signs ----------
function archSignTex() {
  return canvasTex(1024, 192, (x, w, h) => {
    x.fillStyle = '#d7b25a'; x.beginPath(); x.roundRect(0, 0, w, h, 28); x.fill();
    x.fillStyle = '#16305e'; x.beginPath(); x.roundRect(14, 14, w - 28, h - 28, 20); x.fill();
    x.strokeStyle = '#e8c76c'; x.lineWidth = 5; x.beginPath(); x.roundRect(28, 28, w - 56, h - 56, 14); x.stroke();
    x.fillStyle = '#f6f1e2'; x.font = '900 118px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowOffsetY = 4; x.fillText('CARLSBAD', w / 2, h / 2 + 6, w - 90);
  });
}
const label = (text, bg, fg, w = 512, h = 96, font = '800 54px Inter, Arial') => canvasTex(w, h, (x, W, H) => { x.fillStyle = bg; x.fillRect(0, 0, W, H); x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, W / 2, H / 2 + 3, W - 24); });
function plane(scene, tex, w, h, x, y, z, ry = 0, emissive = false) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide, ...(emissive ? { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 } : {}) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
}

export class NorthCounty {
  constructor(scene, city) {
    this.scene = scene; this.city = city; this.N = city.nc;
    this.lit = [];                                               // signs that glow at night
    this.water = makeWater(); scene.add(this.water.mesh);
    G.bayMask = { tex: this.water.mask, box: this.water.box };
    this.backdrop(scene);
    this.pier(scene);
    this.arch(scene);
    this.victorian(scene);
    this.stations(scene);
    this.resorts(scene);
    this.harbor(scene);
    this.bridges(scene);
    this.beachKit(scene);
    this.trains(scene);
    this.fw = new Freeway(scene); this.lit.push(...this.fw.lit);       // I-5, its ramps and its traffic (js/ncfreeway.js)
    this.places = new Places(scene, this.N);                            // Pine Avenue Park, Hibiscus Circle, El Camino Grove
    this.title = '';
  }

  // ---------- the sea floor and the land past the map's edges ----------
  // One terrain mesh all round the map: flat at the playable edge, then rising inland into the coastal hills (the
  // mesas east of I-5, the ridges past them), north into Camp Pendleton and south past Agua Hedionda, fading into
  // the haze. Its texture carries the towns inland as flat roofs and streets seen from far off (no geometry), and the
  // freeways running on out of the map.
  backdrop(scene) {
    const B = BOUNDS, X0 = -700, X1 = 2600, Z0 = B.z0 - 1600, Z1 = B.z1 + 1600;
    // the coast past both ends of the map carries straight on (as the water's mask does)
    const shore = (z) => { for (let x = -140; x < 120; x += 1) if (isLand(x, z)) return x; return 0; };
    const sN = shore(B.z0 - 30), sS = shore(B.z1 + 30);
    const coastX = (z) => (z < B.z0 ? sN : sS);
    const out = (x, z) => Math.max(x - hillEdge(z), B.z0 - z, z - B.z1);       // how far past the playable land
    const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.011 + Math.sin(z * 0.007) * 2) * Math.cos(z * 0.009 - x * 0.004) + 0.25 * Math.sin(x * 0.031 - z * 0.023 + 1.7) * Math.sin(z * 0.027 + 0.4);
    const height = (x, z) => {
      const d = out(x, z); if (d < 0) return -1;
      if ((z < B.z0 || z > B.z1) && x < coastX(z) + 2) return -2;               // the sea off the ends of the map
      const cliff = z < B.z0 || z > B.z1 ? clamp((x - coastX(z)) / 40, 0, 1) : 1;  // low near the sand, bluffs behind
      const far = clamp((d - 120) / 700, 0, 1), north = clamp((B.z0 - z) / 500, 0, 1);
      return -0.05 + cliff * ((1 - Math.exp(-d / 70)) * (6 + 16 * noise(x, z)) + far * 55 * noise(x * 0.6 + 300, z * 0.6) + north * 70 * noise(x * 0.5, z * 0.5 - 900));
    };
    // the texture: chaparral, dry grass and sage on the hills, the towns on the mesas inland
    const S = 2048, U = (x) => (x - X0) / (X1 - X0), V = (z) => (z - Z0) / (Z1 - Z0);
    const towns = [
      { x0: 300, x1: 1300, z0: B.z0 + 120, z1: -60 },                   // Oceanside east of I-5, toward Vista
      { x0: 330, x1: 1100, z0: -60, z1: B.z1 + 700 },                   // Carlsbad east of I-5, south past the lagoon
      { x0: 120, x1: 600, z0: B.z1 + 60, z1: B.z1 + 900 },              // Carlsbad's south shore
    ];
    const tex = canvasTex(S, S, (c, w, h) => {
      const px = (x) => U(x) * w, pz = (z) => V(z) * h;
      c.fillStyle = '#86805c'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 9000; k++) { c.fillStyle = pick(['rgba(92,108,62,.45)', 'rgba(150,136,96,.35)', 'rgba(70,88,52,.45)', 'rgba(176,160,118,.3)', 'rgba(110,120,74,.4)']); c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rand(1.5, 7), 0, 6.283); c.fill(); }
      // the towns: blocks of streets, roofs, yards and trees
      for (const T of towns) for (let z = T.z0; z < T.z1; z += rand(9, 13)) for (let x = T.x0; x < T.x1; x += rand(9, 13)) {
        const edge = Math.min(x - T.x0, T.x1 - x, z - T.z0, T.z1 - z); if (edge < 60 && Math.random() > edge / 60) continue;
        if (out(x, z) < 20 || Math.sin(x * 0.013) * Math.cos(z * 0.017) > 0.55) continue;   // canyons stay wild
        c.fillStyle = 'rgba(120,120,112,.55)'; c.fillRect(px(x) - 0.5, pz(z) - 0.5, px(x + 11) - px(x) + 1, 1.2); c.fillRect(px(x) - 0.5, pz(z), 1.2, pz(z + 11) - pz(z));
        for (let k = 0; k < 4; k++) { c.fillStyle = pick(['#c46b4a', '#d9d2c2', '#b8b2a6', '#cf7f5c', '#8f8b84', '#e6e0d2']); c.fillRect(px(x + rand(2, 8)), pz(z + rand(2, 8)), 1.6, 1.6); }
        if (Math.random() < 0.6) { c.fillStyle = 'rgba(64,86,48,.8)'; c.beginPath(); c.arc(px(x + rand(1, 10)), pz(z + rand(1, 10)), 1.3, 0, 6.283); c.fill(); }
      }
      // the freeways run on: I-5 up the coast and down it, CA-78 and CA-76 inland
      const ends = this.freewayEnds();
      c.lineCap = 'round';
      for (const [w, col] of [[9, '#8f8a78'], [6, '#4d4e50']]) for (const e of ends) { c.strokeStyle = col; c.lineWidth = w / ((X1 - X0) / S); c.beginPath(); c.moveTo(px(e.x), pz(e.z)); c.lineTo(px(e.x + e.dx * 2000), pz(e.z + e.dz * 2000)); c.stroke(); }
      // the sand where the coast runs on
      c.fillStyle = '#d8c79c'; for (const [z0, z1, sx] of [[Z0, B.z0, sN], [B.z1, Z1, sS]]) c.fillRect(px(sx - 2), pz(z0), px(sx + 9) - px(sx - 2), pz(z1) - pz(z0));
    });
    // the mesh: 12-unit squares, only where there's land to show
    const STEP = 12, nx = Math.ceil((X1 - X0) / STEP) + 1, nz = Math.ceil((Z1 - Z0) / STEP) + 1;
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), col = new Float32Array(nx * nz * 3), H = new Float32Array(nx * nz);
    const cl = new THREE.Color();
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = X0 + i * STEP, z = Z0 + j * STEP, y = height(x, z); H[k] = y;
      pos.set([x, y, z], k * 3); uv.set([U(x), 1 - V(z)], k * 2);
      cl.setHSL(0.11 + 0.05 * noise(x * 2, z * 2), 0.12, clamp(0.9 + y * 0.003, 0.85, 1), THREE.SRGBColorSpace); col.set([cl.r, cl.g, cl.b], k * 3);
    }
    const idx = [];
    for (let j = 0; j + 1 < nz; j++) for (let i = 0; i + 1 < nx; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (Math.max(H[a], H[b], H[c], H[d]) <= -0.99) continue;                    // under the map, or out at sea
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95 }));
    land.receiveShadow = true; scene.add(land);
    // the seabed under all of it
    const sb = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a5560, roughness: 1 }));
    sb.position.set(-600, -0.7, (B.z0 + B.z1) / 2); scene.add(sb);
  }
  // where I-5 and the highways inland leave the map: a point and the way they're heading
  freewayEnds() {
    const B = BOUNDS, out = [];
    for (const c of chains(ROADS.freeway.filter((f) => f.h === 'motorway' || f.h === 'trunk').map((f) => f.p), 1)) {
      if (track(c).L < 60) continue;
      for (const [p, q] of [[c[0], c[Math.min(3, c.length - 1)]], [c[c.length - 1], c[Math.max(0, c.length - 4)]]]) {
        const near = p[0] > hillEdge(p[1]) - 40 || p[1] < B.z0 + 30 || p[1] > B.z1 - 30; if (!near) continue;
        const L = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1; out.push({ x: p[0], z: p[1], dx: (p[0] - q[0]) / L, dz: (p[1] - q[1]) / L });
      }
    }
    return out;
  }

  // ---------- Oceanside Pier ----------
  pier(scene) {
    const P = PIER, H = 1.45, W = 2.2, x0 = P.x0, x1 = -38, z = P.z;   // the deck runs on over the Strand to Pacific St
    const wood = 0x8a6a4c, rail = 0x6b5038;
    this.spans = [];
    const SEG = 8;
    for (let a = x0; a < x1 - 0.01; a += SEG) {
      const b = Math.min(x1, a + SEG), geos = [], cx = (a + b) / 2, L = b - a, overLand = a > P.x1;
      geos.push(box(L, 0.16, W, cx, H, z, overLand ? 0xe7e3d8 : wood));
      for (let x = a + 0.6; x < b; x += 2.4) for (const s of [-1, 1]) geos.push(box(0.2, H, 0.2, x, H / 2, z + s * (W / 2 - 0.25), overLand ? 0xe7e3d8 : 0x5b4634));
      if (!overLand) for (let x = a + 0.6; x < b; x += 2.4) geos.push(box(0.08, 0.08, W - 0.3, x, H * 0.55, z, 0x5b4634));     // cross bracing
      for (const s of [-1, 1]) { geos.push(box(L, 0.07, 0.07, cx, H + 0.5, z + s * (W / 2 - 0.04), overLand ? 0xffffff : rail)); for (let x = a + 0.3; x < b; x += 1.2) geos.push(box(0.06, 0.5, 0.06, x, H + 0.28, z + s * (W / 2 - 0.04), overLand ? 0xffffff : rail)); }
      for (let x = a + 2; x < b; x += 6) geos.push(box(0.06, 1.3, 0.06, x, H + 0.72, z - W / 2 + 0.1, 0x2a2d31), box(0.24, 0.12, 0.24, x, H + 1.4, z - W / 2 + 0.1, 0xfff3c8));
      const m = mergeTo(scene, geos, vc());
      const span = { m, x0: a, x1: b, z, hp: 260, alive: true, fall: 0, vy: 0, ry: 0 };
      this.spans.push(span);
      solids.push({ alive: true, span, test: (p) => (span.alive && p.x > a && p.x < b && Math.abs(p.z - z) < W / 2 && p.y > 0 && p.y < H + 0.2 ? { n: new THREE.Vector3(0, 1, 0), pen: H + 0.2 - p.y } : null) });
    }
    // the building at the end: white, blue trim, a red roof
    const e = x0 + 3.2, geos = [box(4.6, 1.5, 3.6, e, H + 0.85, z, 0xf2efe6), box(4.8, 0.14, 3.8, e, H + 1.65, z, 0x2a5fa0), box(1.2, 0.9, 0.05, e + 2.32, H + 0.9, z, 0x1a2a3a)];
    const roof = hipRoof(5.2, 4.2, 0.9); roof.translate(e, H + 1.72, z); geos.push(tint(roof, 0xc0413a));
    geos.push(box(6.4, 0.16, 4.6, e, H, z, 0x8a6a4c));
    const end = mergeTo(scene, geos, vc()); this.spans[0].extra = end;
    plane(scene, label('OCEANSIDE PIER', '#1f4f8f', '#ffffff', 512, 80, '800 44px Inter, Arial'), 3.2, 0.5, -36.8, H + 2.4, z, -Math.PI / 2);
    // the white bridge at its foot (the amphitheater by the Strand): arches either side under the deck
    const am = [];
    // the white arcade along the Strand either side of the pier's foot: a wall of arches, a balustrade on top
    const ax = P.x1 + 7;
    for (const s of [-1, 1]) {
      const cz = z + s * (W / 2 + 5.2);
      am.push(box(0.5, 1.7, 8.6, ax, 0.85, cz, 0xf4f1ea), box(0.7, 0.12, 8.8, ax, 1.76, cz, 0xffffff));
      for (let k = -3; k <= 3; k++) am.push(box(0.06, 1.05, 0.8, ax - 0.27, 0.55, cz + k * 1.2, 0x9aa4ab));
      for (let k = -4; k <= 4; k++) am.push(box(0.08, 0.32, 0.08, ax, 1.98, cz + k * 1.05, 0xffffff));
      am.push(box(0.7, 0.1, 8.8, ax, 2.14, cz, 0xffffff));
    }
    am.push(box(10, 0.5, 2.2, P.x1 + 12, 0.25, z + 6, 0xe6e1d6), box(10, 0.5, 2.2, P.x1 + 12, 0.25, z - 6, 0xe6e1d6));   // the seating steps
    mergeTo(scene, am, vc());
  }

  // ---------- the Carlsbad sign ----------
  arch(scene) {
    const A = this.N.arch, half = A.span / 2, top = 3.6, x = A.x, z = A.z, geos = [];
    const cream = 0xefe6cf;
    for (const s of [-1, 1]) { geos.push(cyl(0.14, 0.16, top + 0.4, x + s * half, (top + 0.4) / 2, z, 0x2a2d31, 8), box(0.4, 0.3, 0.4, x + s * half, top + 0.55, z, 0x2a2d31)); }
    // the truss: top and bottom chords and the zigzag between them, either side of the sign
    for (const y of [top - 0.3, top + 0.45]) geos.push(box(A.span, 0.08, 0.08, x, y, z - 0.1, cream), box(A.span, 0.08, 0.08, x, y, z + 0.1, cream));
    for (let t = -half; t < half - 0.01; t += 0.5) { const g = new THREE.BoxGeometry(0.05, 0.85, 0.05).rotateZ(((t / 0.5) % 2 ? 1 : -1) * 0.55).translate(x + t + 0.25, top + 0.08, z); geos.push(tint(g, cream)); }
    // it all hangs off a pivot along the line of its feet, so a hit topples the whole arch flat across the boulevard
    const pivot = new THREE.Group(); pivot.position.set(x, 0, z); scene.add(pivot); this.archPivot = pivot;
    const mesh = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))).translate(-x, 0, -z), vc({ roughness: 0.5 }));
    mesh.castShadow = true; pivot.add(mesh);
    const tex = archSignTex(), mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffe7b0, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.4 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.86, 0.12), [mat, mat, mat, mat, mat, mat]); sign.position.set(0, top + 0.08, 0); sign.castShadow = true; pivot.add(sign);
    this.lit.push({ mat, k: 1.1 });
    this.archState = { alive: true, t: 0 };
    const a = new THREE.Vector3(x - half, top, z), b = new THREE.Vector3(x + half, top, z);
    solids.push({ alive: true, test: (p) => { if (!this.archState.alive) return null; const t = clamp((p.x - a.x) / (b.x - a.x), 0, 1), cx = a.x + (b.x - a.x) * t, d = Math.hypot(p.x - cx, p.y - top, p.z - z); return d < 0.7 ? { n: new THREE.Vector3(0, Math.sign(p.y - top) || 1, 0), pen: 0.7 - d } : null; },
      hit: () => this.breakArch() });
  }
  breakArch() {
    const S = this.archState; if (!S.alive) return; S.alive = false; S.t = 0;
    G.fx && G.fx.dust && G.fx.dust(this.N.arch.x, 3.6, this.N.arch.z, 1.2);
    G.progress && G.progress.event && G.progress.event('nc_arch');
  }

  // ---------- the blue Victorian on the corner (built in js/northcounty.js; its roofs and turrets here) ----------
  victorian(scene) {
    const b = this.N.victorianB; if (!b) return;
    const V = this.N.victorian, top = b.cells.reduce((m, c) => Math.max(m, c.y + c.hy), 0), geos = [], slate = 0x4a5058, trim = 0xf2ead2;
    const r1 = hipRoof(V.w + 0.6, V.d + 0.6, 1.5); r1.translate(V.x, top, V.z); geos.push(tint(r1, slate));
    // two front gables and two turrets with tall pointed roofs
    for (const [dx, dz] of [[-2.2, -V.d / 2], [1.4, -V.d / 2]]) { const g = new THREE.ConeGeometry(1.5, 1.4, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.45).translate(V.x + dx, top + 0.65, V.z + dz + 0.2); geos.push(tint(g, slate)); }
    for (const [dx, dz, h] of [[-V.w / 2 + 0.6, -V.d / 2 + 0.6, 2.2], [V.w / 2 - 1.2, -V.d / 2 + 0.8, 1.6]]) {
      geos.push(cyl(0.75, 0.75, h, V.x + dx, top + h / 2, V.z + dz, 0x6f9fbb, 8), cone(0.95, 1.6, V.x + dx, top + h + 0.8, V.z + dz, slate, 8), box(0.05, 0.6, 0.05, V.x + dx, top + h + 1.9, V.z + dz, 0x2a2d31));
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; geos.push(box(0.22, 0.4, 0.04, V.x + dx + Math.cos(a) * 0.76, top + h * 0.55, V.z + dz + Math.sin(a) * 0.76, 0xf6f0dc)); }
    }
    // white trim bands and the porch
    geos.push(box(V.w + 0.1, 0.1, V.d + 0.1, V.x, top - 0.05, V.z, trim), box(V.w + 0.1, 0.08, V.d + 0.1, V.x, 1.3, V.z, trim));
    geos.push(box(V.w * 0.7, 0.08, 1.6, V.x - 0.6, 1.25, V.z + V.d / 2 + 0.8, trim), box(V.w * 0.7, 0.2, 1.6, V.x - 0.6, 0.1, V.z + V.d / 2 + 0.8, 0x8a5a4a));
    for (let k = 0; k < 5; k++) geos.push(box(0.1, 1.2, 0.1, V.x - 0.6 - V.w * 0.33 + k * V.w * 0.165, 0.65, V.z + V.d / 2 + 1.5, trim));
    cutoutOn(scene, b, geos, vc({ roughness: 0.6 }));
    plane(scene, label('SUN DAYGO', '#183a6b', '#f3e6c0', 512, 96, '800 52px Georgia, serif'), 2.2, 0.42, V.x - 0.6, 1.62, V.z + V.d / 2 + 1.62, 0);
    // the flag on the turret
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ map: canvasTex(96, 56, (x) => { for (let i = 0; i < 7; i++) { x.fillStyle = i % 2 ? '#fff' : '#b22234'; x.fillRect(0, i * 8, 96, 8); } x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, 40, 32); }), side: THREE.DoubleSide }));
    fm.position.set(V.x - V.w / 2 + 1.05, top + 4.4, V.z - V.d / 2 + 0.6); scene.add(fm); this.flag = fm;
  }

  // ---------- stations ----------
  stations(scene) {
    const P = [];
    const station = (st, nameTxt, bg) => {
      for (const s of [-1, 1]) {
        const px = st.x + s * 2.6;
        P.push(box(1.6, 0.3, st.len, px, 0.15, st.z, 0xbdb7ab), box(0.18, 0.012, st.len, st.x + s * 1.86, 0.31, st.z, 0xf2c21c));
        P.push(box(1.4, 0.08, st.len * 0.55, px + s * 0.1, 1.85, st.z, 0x2f6a7a));
        for (let k = -2; k <= 2; k++) P.push(box(0.08, 1.55, 0.08, px + s * 0.5, 1.07, st.z + k * st.len * 0.12, 0x2a2d31));
      }
      for (const s of [-1, 1]) plane(scene, label(nameTxt, bg, '#ffffff'), 2.6, 0.48, st.x + s * 3.5, 1.4, st.z + st.len * 0.3, s * Math.PI / 2);
      (this.city.crowds ||= []); for (let k = 0; k < 4; k++) this.city.crowds.push({ x: st.x + pick([-2.6, 2.6]), z: st.z + rand(-st.len / 3, st.len / 3), r: 0.5, n: Math.round(rand(2, 5)), y: 0.3 });
    };
    if (this.N.cstation) station(this.N.cstation, 'CARLSBAD VILLAGE', '#20507a');
    if (this.N.coastHwy) station(this.N.coastHwy, 'COAST HIGHWAY', '#20507a');
    if (this.N.transit) {
      station(this.N.transit, 'OCEANSIDE', '#20507a');
      const T = this.N.transit;
      // bus shelters and buses in the bays
      for (let z = T.z - 9; z < T.z + 5; z += 3.4) P.push(box(1.6, 0.06, 0.9, T.x + 7.2, 1.25, z + 1.7, 0x2f6a7a), box(0.06, 1.2, 0.06, T.x + 6.6, 0.6, z + 1.7, 0x2a2d31));
      // the buses in the bays: white, the blue and green band, their name down the side (the city buses' shape, bigger)
      const bg = busGeos(), white = new THREE.MeshStandardMaterial({ color: 0xf2f3f0, roughness: 0.45, metalness: 0.2 }), glass = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.15, metalness: 0.6 });
      const band = new THREE.MeshStandardMaterial({ color: 0x1f6fa0, roughness: 0.5 }), green = new THREE.MeshStandardMaterial({ color: 0x5fb04a, roughness: 0.5 });
      const name = new THREE.MeshStandardMaterial({ map: label('COAST BREEZE', '#f2f3f0', '#1f5f8a', 512, 64, '800 40px Inter, Arial'), roughness: 0.5 });
      this.buses = [];
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Group();
        m.add(new THREE.Mesh(bg.body, white), new THREE.Mesh(bg.dark, glass));
        for (const s of [-1, 1]) {
          const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 2.7), band); b1.position.set(s * 0.375, 0.32, 0); m.add(b1);
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 2.7), green); b2.position.set(s * 0.375, 0.27, 0); m.add(b2);
          const t = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.16), name); t.position.set(s * 0.376, 0.44, -0.4); t.rotation.y = s * Math.PI / 2; m.add(t);
        }
        m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        m.scale.setScalar(1.35); m.rotation.y = Math.PI / 2; m.position.set(T.x + 12, 0, T.z - 8 + k * 3.4); scene.add(m); this.buses.push({ m, alive: true });
      }
    }
    mergeTo(scene, P, vc({ roughness: 0.6 }));
  }

  // ---------- the resorts by the pier, the cinema, Civic Center: their trim ----------
  resorts(scene) {
    for (const h of this.N.hotelB || []) {
      const geos = [], top = h.b.cells.reduce((m, c) => Math.max(m, c.y + c.hy), 0);
      if (h.tile) { const r = hipRoof(h.w * 0.45, h.d * 0.6, 1.2); r.translate(h.x - h.w * 0.22, top, h.z); geos.push(tint(r, 0xb5523b)); const r2 = hipRoof(h.w * 0.35, h.d * 0.5, 1); r2.translate(h.x + h.w * 0.28, top, h.z); geos.push(tint(r2, 0xb5523b)); }
      for (let f = 1; f < h.floors; f++) geos.push(box(h.w + 0.2, 0.08, 0.5, h.x, 1.4 + (f - 1) * 1.0 + 0.95, h.z + h.d / 2 + 0.2, 0xf4f1ea), box(h.w + 0.2, 0.08, 0.5, h.x, 1.4 + (f - 1) * 1.0 + 0.95, h.z - h.d / 2 - 0.2, 0xf4f1ea));
      cutoutOn(scene, h.b, geos, vc());
      plane(scene, label(h.name, h.tile ? '#f4efe4' : '#203a58', h.tile ? '#2d4a6a' : '#ffffff', 512, 96, '700 46px Georgia, serif'), 4, 0.6, h.x - h.w / 2 - 0.06, top - 0.8, h.z, -Math.PI / 2);
    }
    const R = this.N.regalB;
    if (R) {
      const geos = [], top = R.cells.reduce((m, c) => Math.max(m, c.y + c.hy), 0), { x, z, w, d } = this.N.regal;
      for (const [dx, dz] of [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2 + 3, d / 2 + 0.2], [w / 2 - 3, d / 2 + 0.2]]) geos.push(cyl(0.45, 0.45, top + 1.6, x + dx, (top + 1.6) / 2, z + dz, 0x1d2f55, 10), cyl(0.5, 0.5, 0.2, x + dx, top + 1.7, z + dz, 0xf2efe6, 10));
      for (let t = -w / 2; t < w / 2; t += 0.9) geos.push(box(0.45, 0.4, 0.2, x + t, top + 0.2, z + d / 2, 0xf6f3ec));
      cutoutOn(scene, R, geos, vc());
      plane(scene, label('ROYAL CINEMAS', '#f6f3ec', '#b3242e', 512, 96, '800 50px Georgia, serif'), 3.6, 0.6, x, top - 0.9, z + d / 2 + 0.07, 0);
    }
    const C = this.N.civicB;
    if (C) plane(scene, label('CITY OF OCEANSIDE', '#f4efe4', '#3a5a3a', 512, 80, '700 40px Georgia, serif'), 3.6, 0.5, this.N.civic.x, 1.7, this.N.civic.z + this.N.civic.d / 2 + 0.07, 0);
    const T = this.N.depotB;
    if (T) plane(scene, label('OCEANSIDE TRANSIT CENTER', '#f4efe4', '#1f4f7a', 768, 80, '800 40px Inter, Arial'), 4.6, 0.48, this.N.depot.x - this.N.depot.w / 2 - 0.07, 1.8, this.N.depot.z, -Math.PI / 2);
    const H = this.N.chsB;
    if (H) plane(scene, label('CARLSBAD HIGH SCHOOL', '#1b2a52', '#f2c94c', 768, 80, '800 40px Inter, Arial'), 5, 0.5, this.N.chs.x, 1.8, this.N.chs.z + this.N.chs.d / 2 + 0.07, 0);
  }

  // ---------- the harbor: docks, slips and moored boats, the jetties ----------
  harbor(scene) {
    const geos = [], rocks = [], boats = [];
    for (const d of this.N.docks || []) {
      for (let k = 0; k + 1 < d.p.length; k++) {
        const [a, b] = d.p[k], [c, e] = d.p[k + 1], L = Math.hypot(c - a, e - b); if (L < 0.5) continue;
        const yaw = Math.atan2(c - a, e - b);
        geos.push(tint(new THREE.BoxGeometry(0.55, 0.16, L).rotateY(yaw).translate((a + c) / 2, 0.14, (b + e) / 2), 0xb9b0a0));
        // slips either side with boats in about half of them
        for (let t = 1.2; t < L - 0.6; t += 1.4) for (const s of [-1, 1]) if (Math.random() < 0.55) {
          const nx = Math.cos(yaw) * s, nz = -Math.sin(yaw) * s, x = a + (c - a) * t / L + nx * 1.4, z = b + (e - b) * t / L + nz * 1.4;
          if (isLand(x, z)) continue;
          boats.push({ x, z, yaw: yaw + Math.PI / 2 * s, sail: Math.random() < 0.55, s: rand(0.75, 1.15) });
        }
      }
    }
    for (const j of this.N.jetties || []) {
      const pts = j.p;
      for (let k = 0; k + 1 < pts.length; k++) { const [a, b] = pts[k], [c, e] = pts[k + 1], L = Math.hypot(c - a, e - b); for (let t = 0; t < L; t += 0.9) rocks.push(tint(new THREE.DodecahedronGeometry(rand(0.5, 0.9), 0).translate(a + (c - a) * t / L + rand(-0.5, 0.5), rand(-0.1, 0.35), b + (e - b) * t / L + rand(-0.5, 0.5)), new THREE.Color().setHSL(0.08, 0.05, rand(0.38, 0.55), THREE.SRGBColorSpace))); }
    }
    if (geos.length) mergeTo(scene, geos, vc(), false);
    if (rocks.length) mergeTo(scene, rocks, vc({ roughness: 1, flatShading: true }));
    // moored boats: hull, cabin and (for the sailboats) a mast; one instanced mesh each
    const hull = new THREE.BoxGeometry(0.75, 0.38, 2.3).translate(0, 0.2, 0), cab = new THREE.BoxGeometry(0.55, 0.35, 0.9).translate(0, 0.55, -0.1), mast = new THREE.CylinderGeometry(0.03, 0.03, 2.8, 5).translate(0, 1.8, 0.2);
    const mk = (geo, color, list) => { const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), Math.max(1, list.length)); list.forEach((b, i) => { _m.compose(_p.set(b.x, 0.02, b.z), _q.setFromAxisAngle(UP, b.yaw), _s.set(b.s, b.s, b.s)); im.setMatrixAt(i, _m); }); im.castShadow = true; scene.add(im); return im; };
    this.boatList = boats.map((b) => ({ ...b, alive: true }));
    this.boatIM = [mk(hull, 0xf4f4f0, boats), mk(cab, 0xd8dde2, boats), mk(mast, 0xe8e8e8, boats.filter((b) => b.sail))];
    this.sailIdx = []; boats.forEach((b, i) => { if (b.sail) this.sailIdx[i] = this.sailIdx.length; });
  }

  // ---------- bridges: where a street or the freeway crosses a lagoon or the river ----------
  // a concrete deck just over the water, parapets, piers into the water; DECK remembers where they are so the
  // freeway's traffic rides on them
  bridges(scene) {
    const geos = [], conc = 0xbdb7aa, road = 0x4d4e50;
    this.DECK = new Set();
    for (const b of ROADS.bridges) {
      const P = b.p, a = P[0], c = P[P.length - 1], L0 = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L0 < 0.5) continue;
      const dx = (c[0] - a[0]) / L0, dz = (c[1] - a[1]) / L0, x0 = a[0] - dx * 1.5, z0 = a[1] - dz * 1.5, L = L0 + 3, yaw = Math.atan2(dx, dz), mx = x0 + dx * L / 2, mz = z0 + dz * L / 2, W = b.w + 0.6;
      const put = (g, ox, y, oz = 0) => geos.push(g.rotateY(yaw).translate(mx + Math.cos(yaw) * ox + Math.sin(yaw) * oz, y, mz - Math.sin(yaw) * ox + Math.cos(yaw) * oz));
      put(tint(new THREE.BoxGeometry(W, 0.4, L), conc), 0, -0.14);
      put(tint(new THREE.BoxGeometry(b.w, 0.02, L), road), 0, 0.07);
      for (const s of [-1, 1]) put(tint(new THREE.BoxGeometry(0.22, 0.3, L), 0xd8d2c4), s * (W / 2 - 0.11), 0.2);
      for (let t = 2; t < L - 1; t += 6) put(tint(new THREE.BoxGeometry(W * 0.7, 1.2, 0.6), 0x9a958a), 0, -0.9, t - L / 2);
      for (let t = 0; t <= L; t += 0.5) { const x = x0 + dx * t, z = z0 + dz * t; for (let o = -W / 2; o <= W / 2; o += 0.5) this.DECK.add(`${Math.round(x - dz * o)},${Math.round(z + dx * o)}`); }
    }
    if (geos.length) mergeTo(scene, geos, vc({ roughness: 0.85 }));
  }

  // ---------- lifeguard towers along the sand ----------
  beachKit(scene) {
    const geos = [];
    for (const t of this.N.towers) { geos.push(box(1.4, 1, 1.2, t.x, 1.4, t.z, 0x3f7fb5), box(1.6, 0.12, 1.4, t.x, 1.96, t.z, 0xf2efe6), box(1.2, 0.1, 0.9, t.x - 0.9, 0.9, t.z, 0xd9d2c0)); for (const [a, b] of [[-0.55, -0.45], [0.55, -0.45], [-0.55, 0.45], [0.55, 0.45]]) geos.push(box(0.1, 0.9, 0.1, t.x + a, 0.45, t.z + b, 0xd9d2c0)); }
    if (geos.length) mergeTo(scene, geos, vc());
  }

  // ---------- the Coastliner (commuter trains up and down the coast) ----------
  trains(scene) {
    const lines = chains(NC.rail.filter((r) => !r.s).map((r) => r.p), 1.2);
    if (!lines.length) return;
    const T = track(lines[0]);
    if (T.pts[0][1] > T.pts[T.pts.length - 1][1]) T.pts.reverse();
    this.rail = track(T.pts);
    const stopsAt = (z) => { let best = 0, bd = 1e9; for (let s = 0; s < this.rail.L; s += 0.5) { const p = this.rail.at(s), d = Math.abs(p.z - z); if (d < bd) { bd = d; best = s; } } return best; };
    this.stops = [this.N.transit, this.N.cstation, this.N.coastHwy].filter(Boolean).map((st) => stopsAt(st.z));
    const side = canvasTex(512, 128, (x, w, h) => {
      x.fillStyle = '#f2f3f0'; x.fillRect(0, 0, w, h); x.fillStyle = '#1f4f8f'; x.fillRect(0, 84, w, 16); x.fillStyle = '#3aa58a'; x.fillRect(0, 100, w, 8);
      x.fillStyle = '#1b2430'; for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) x.fillRect(16 + i * 54, 14 + r * 34, 42, 22);
      x.fillStyle = '#1f4f8f'; x.font = '800 18px Inter, Arial'; x.fillText('COASTLINER', 360, 122);
    });
    const body = new THREE.MeshStandardMaterial({ map: side, roughness: 0.45 }), roof = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.5 }), loco = new THREE.MeshStandardMaterial({ color: 0x1f4f8f, roughness: 0.4 });
    const car = new THREE.BoxGeometry(0.95, 1.45, 4.4).translate(0, 0.85, 0), eng = new THREE.BoxGeometry(0.95, 1.35, 3.6).translate(0, 0.8, 0);
    this.coaster = [];
    for (const [dir, s] of [[1, this.rail.L * 0.25], [-1, this.rail.L * 0.75]]) {
      const secs = [new THREE.Mesh(eng, [loco, loco, roof, roof, loco, loco])]; for (let k = 0; k < 3; k++) secs.push(new THREE.Mesh(car, [body, body, roof, roof, body, body]));
      for (const m of secs) { m.castShadow = true; scene.add(m); }
      this.coaster.push({ dir, s, v: 5, dwell: 0, last: -1, secs, alive: true, deadT: 0 });
    }
  }
  updateTrains(dt) {
    if (!this.rail) return;
    const R = this.rail;
    for (const t of this.coaster) {
      if (!t.alive) { t.deadT -= dt; if (t.deadT > 0) continue; t.alive = true; t.s = t.dir > 0 ? 2 : R.L - 2; for (const m of t.secs) m.visible = true; }
      let target = 7;
      for (let k = 0; k < this.stops.length; k++) {
        if (t.last === k) continue;
        const ahead = (this.stops[k] - t.s) * t.dir;
        if (ahead > -0.2 && ahead < 18) target = Math.min(target, Math.sqrt(Math.max(0, ahead) * 3));
        if (ahead < 0.15 && ahead > -0.8 && t.dwell <= 0) { t.dwell = rand(7, 11); t.last = k; t.v = 0; }
      }
      if (t.dwell > 0) { t.dwell -= dt; target = 0; }
      t.v += clamp(target - t.v, -4 * dt, 1.4 * dt);
      t.s += t.dir * t.v * dt;
      if (t.s > R.L - 1 || t.s < 1) { t.dir *= -1; t.last = -1; t.dwell = 4; t.s = clamp(t.s, 1, R.L - 1); }
      t.secs.forEach((m, i) => { const p = R.at(t.s - t.dir * (i * 4.55 + 1.8)); const off = t.dir * 0.75; m.position.set(p.x + Math.cos(p.yaw) * off, 0, p.z - Math.sin(p.yaw) * off); m.rotation.y = p.yaw; });
    }
  }

  // ---------- each frame ----------
  update(dt) {
    this.water.timeU.value = G.time;
    this.updateTrains(dt);
    if (this.fw) this.fw.update(dt);
    this.places.update(dt);
    const n = G.night || 0;
    for (const l of this.lit) l.mat.emissiveIntensity = n * l.k;
    if (this.flag) this.flag.rotation.y = Math.sin(G.time * 2.2) * 0.25;
    // the pier: broken spans drop into the sea
    for (const s of this.spans) if (!s.alive && s.fall < 6) {
      s.fall += dt; s.vy -= 9 * dt; s.m.position.y = Math.max(-2.2, s.m.position.y + s.vy * dt); s.m.rotation.x = Math.min(0.5, s.m.rotation.x + dt * s.ry);
      if (s.extra) s.extra.position.y = s.m.position.y, s.extra.rotation.x = s.m.rotation.x;
    }
    // the sign: down it comes, swinging off one post
    const A = this.archState;
    if (A && !A.alive && A.t < 3) { A.t += dt; this.archPivot.rotation.x = Math.min(1.5, A.t * A.t * 2.4); if (A.t > 0.7 && !A.thud) { A.thud = true; G.fx.dust(this.N.arch.x, 0.3, this.N.arch.z + 3.5, 1.6); G.shake = Math.max(G.shake || 0, 0.4); } }
    // the corner label: which city you're over
    const t = G.cam && G.cam.z < -205 ? 'OCEANSIDE, CA' : 'CARLSBAD, CA';
    if (t !== this.title) { this.title = t; const el = document.getElementById('mapTitle'); if (el) el.textContent = t; }
  }

  onBlast(x, y, z, r, power, kind) {
    const reach = { bomb: 5.5, meteor: 10, explosion: 3.2, laser: 2.2, wind: 0 }[kind] ?? Math.min(6, r * 0.25);
    const dmg = { bomb: 520, meteor: 1400, explosion: 160, laser: 46 }[kind] ?? power * 30;
    if (reach <= 0) return;
    for (const s of this.spans) if (s.alive && x > s.x0 - reach && x < s.x1 + reach && Math.abs(z - s.z) < reach + 1.5 && y < 4) {
      s.hp -= dmg; if (s.hp <= 0) { s.alive = false; s.vy = 0; s.ry = rand(-0.3, 0.3); G.fx.dust((s.x0 + s.x1) / 2, 1.4, s.z, 1); for (const so of solids) if (so.span === s) so.alive = false; G.progress && G.progress.event && G.progress.event('nc_pier'); }
    }
    const A = this.N.arch; if (A && this.archState.alive && Math.hypot(x - A.x, z - A.z) < reach + A.span / 2 && dmg > 100) this.breakArch();
    for (const t of this.coaster || []) if (t.alive && t.secs.some((m) => Math.hypot(m.position.x - x, m.position.z - z) < reach + 1.5)) { t.alive = false; t.deadT = 40; for (const m of t.secs) { m.visible = false; } G.fx.explosion(t.secs[0].position.x, 1, t.secs[0].position.z, 1.4, null, 'bomb'); }
    if (this.fw) this.fw.onBlast(x, y, z, reach, dmg);
    this.places.onBlast(x, z, reach);
    for (const b of this.buses || []) if (b.alive && Math.hypot(b.m.position.x - x, b.m.position.z - z) < reach + 2) {
      b.alive = false; b.m.scale.y *= 0.6; const burnt = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }); b.m.traverse((o) => { if (o.isMesh) o.material = burnt; });
      G.fx.explosion(b.m.position.x, 0.6, b.m.position.z, 1, null, 'bomb');
    }
    if (this.boatList) {
      let hit = false;
      this.boatList.forEach((b, i) => { if (b.alive && Math.hypot(b.x - x, b.z - z) < reach + 1) { b.alive = false; hit = true; for (const im of this.boatIM.slice(0, 2)) im.setMatrixAt(i, ZERO); if (b.sail) this.boatIM[2].setMatrixAt(this.sailIdx[i], ZERO); G.progress && G.progress.boatSunk && G.progress.boatSunk(); } });
      if (hit) for (const im of this.boatIM) im.instanceMatrix.needsUpdate = true;
    }
  }
}

// Downtown Chicago on the northern horizon of the Chicago map, as seen from the South Side: scenery only, far past
// anywhere you can go. The Willis Tower is modelled properly (nine bundled tubes stepping back at floors 50, 66 and 90,
// the two antennas on the west and centre tubes); around it the Loop, River North and Streeterville are massed
// towers with a few familiar shapes (Aon, Trump, the St. Regis, Two Prudential, the Hancock), and a band of mid-rises
// in front. Everything ignores the scene fog and gets its own haze instead (thick at street level, thinning up the
// towers) so the skyline reads through the distance the way it does from Hyde Park; after dark the windows light up,
// the antennas blink red and the city throws a warm glow on the sky.
import * as THREE from 'three';
import { G } from './core.js';

function seeded(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

function skylineMaterial(haze) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.25, fog: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = (G.nightU ||= { value: 0 });
    sh.uniforms.uHaze = { value: haze };
    sh.uniforms.uBlue = { value: new THREE.Color(0.42, 0.55, 0.74) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(position,1.)).xyz; vWN = normalize(mat3(modelMatrix * instanceMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform float uNight; uniform vec3 uHaze; uniform vec3 uBlue;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
        // a grid of window bays: 1.6 wide, one storey (1.45) tall, in world units so every tower shares the rhythm
        vec2 fuv = vec2((abs(vWN.x) > 0.5 ? vWP.z : vWP.x) / 1.6, vWP.y / 1.45);
        vec2 cl = fract(fuv);
        float roof = step(0.5, vWN.y);
        float win = (1.0 - roof) * step(0.16, cl.x) * step(cl.x, 0.84) * step(0.22, cl.y) * step(cl.y, 0.86);
        diffuseColor.rgb *= mix(1.0, 0.7, win) * mix(1.0, 0.6, roof);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec2 wid = floor(fuv) + floor(vWP.xz * 0.07) * 17.0;
        float lit = step(0.74, bh(wid)) * win;
        vec3 winE = mix(vec3(1.0, 0.78, 0.5), vec3(0.78, 0.88, 1.0), step(0.55, bh(wid * 1.7))) * lit * uNight * 1.25;
        totalEmissiveRadiance += winE;`)
      .replace('#include <fog_fragment>', `
        // haze: heavy at the foot of the city, thinning with height; lit windows punch through it at night
        float hz = clamp(0.66 - vWP.y * 0.0034, 0.22, 0.72) * (1.0 - 0.6 * clamp(length(winE), 0.0, 1.0));
        // by day the distance goes a little blue, as in the photos; at night it's the plain night haze
        vec3 hc = mix(uHaze, uHaze * uBlue * 1.6, 0.35 * (1.0 - uNight));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hc, hz);`);
  };
  return mat;
}

export function chicagoSkyline(scene) {
  const haze = scene.fog ? scene.fog.color : new THREE.Color(0xc9cfcf);
  // the whole city sits a little west so the map's usual north-west view frames the Willis with the Loop beside it
  const root = new THREE.Group(); root.position.x = -210; scene.add(root);
  const rnd = seeded(60606), R = (a, b) => a + rnd() * (b - a);
  const mat = skylineMaterial(haze);
  const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l, THREE.SRGBColorSpace);
  const boxes = [], tapers = [], caps = [], masts = [], beacons = [], taken = [];
  const box = (x, z, w, d, h, c, y = 0) => { boxes.push({ x, z, w, d, h, y, c }); };

  // ---- Willis Tower: a 3 x 3 bundle of square tubes, each 7.6 across; floor 50 = 69, 66 = 92, 90 = 125, 108 = 150 ----
  const WX = -170, WZ = -700, s = 7.6, black = hsl(0.08, 0.14, 0.09);
  // columns west -> east (x), rows north -> south (z); heights per tube
  const H = [
    [69, 150, 92],    // west column: NW ends at 50, W runs to the top, SW ends at 66
    [125, 150, 125],  // centre column: N and S end at 90, the centre runs to the top
    [92, 125, 69],    // east column: NE ends at 66, E ends at 90, SE ends at 50
  ];
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) box(WX + (i - 1) * s, WZ + (k - 1) * s, s - 0.05, s - 0.05, H[i][k], black);
  for (const [i, k] of [[0, 1], [1, 1]]) {
    const x = WX + (i - 1) * s + (i ? 1.4 : -1.4), z = WZ + (k - 1) * s;
    masts.push({ x, z, y: 150, h: 27, r: 0.42 });
    beacons.push(new THREE.Vector3(x, 150 + 27.4, z));
  }
  taken.push([WX, WZ, 20]);

  // ---- a few familiar neighbours ----
  const glass = () => hsl(R(0.55, 0.6), R(0.12, 0.28), R(0.34, 0.56));
  box(60, -732, 12, 12, 106, hsl(0.1, 0.04, 0.8)); taken.push([60, -732, 14]);                  // Aon Center: plain white shaft
  box(18, -688, 9, 7, 62, hsl(0.58, 0.14, 0.62)); box(18, -688, 7, 5.5, 88, hsl(0.58, 0.14, 0.62)); box(18.5, -688, 5, 4, 108, hsl(0.58, 0.14, 0.62));   // Trump: stepped slab
  masts.push({ x: 18.5, z: -688, y: 108, h: 18, r: 0.35 }); taken.push([18, -688, 12]);
  box(96, -690, 8, 10, 82, hsl(0.55, 0.32, 0.5)); box(99, -690, 7, 9, 104, hsl(0.55, 0.32, 0.5)); box(101.5, -690, 5.5, 7, 116, hsl(0.55, 0.32, 0.5)); taken.push([98, -690, 12]);   // St. Regis: three stepped blades
  box(40, -762, 9, 9, 88, hsl(0.07, 0.22, 0.55)); caps.push({ x: 40, z: -762, y: 88, r: 6.2, h: 12, c: hsl(0.07, 0.22, 0.55) }); masts.push({ x: 40, z: -762, y: 100, h: 9, r: 0.3 }); taken.push([40, -762, 12]);   // Two Prudential
  tapers.push({ x: 212, z: -782, rb: 9.5, rt: 5.8, h: 112, c: hsl(0.08, 0.1, 0.11) }); taken.push([212, -782, 14]);      // Hancock: tapered black
  for (const dx of [-1.6, 1.6]) { masts.push({ x: 212 + dx, z: -782, y: 112, h: 22, r: 0.4 }); beacons.push(new THREE.Vector3(212 + dx, 134.4, -782)); }

  // ---- the rest of the Loop, River North, Streeterville and the fringes ----
  const clusters = [
    { x: -150, z: -705, r: 75, n: 55, hmax: 92 },   // West Loop / Loop west of Wacker
    { x: 10, z: -722, r: 95, n: 80, hmax: 100 },     // the Loop and the river
    { x: 180, z: -770, r: 85, n: 55, hmax: 88 },    // Streeterville / Gold Coast
    { x: 80, z: -640, r: 70, n: 30, hmax: 42 },     // South Loop towers
    { x: -290, z: -720, r: 60, n: 16, hmax: 34 },   // West Side
    { x: 320, z: -820, r: 70, n: 16, hmax: 48 },    // up the lakefront
  ];
  for (const c of clusters) for (let n = 0, tries = 0; n < c.n && tries < c.n * 8; tries++) {
    const a = R(0, Math.PI * 2), rr = Math.sqrt(rnd()) * c.r, x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr * 0.6;
    const w = R(5, 11), d = R(5, 11);
    if (taken.some(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) < tr + Math.max(w, d) * 0.5)) continue;
    const h = 20 + c.hmax * Math.pow(rnd(), 1.25) * (1 - 0.5 * rr / c.r);
    const kind = rnd(), col = kind < 0.55 ? glass() : kind < 0.8 ? hsl(R(0.06, 0.1), R(0.12, 0.3), R(0.45, 0.66)) : kind < 0.92 ? hsl(0, 0, R(0.72, 0.84)) : hsl(0.6, 0.08, R(0.16, 0.26));
    box(x, z, w, d, h, col);
    if (h > 45 && rnd() < 0.45) box(x + R(-1, 1), z + R(-1, 1), w * R(0.55, 0.75), d * R(0.55, 0.75), h + R(6, 16), col);   // a setback crown
    if (h > 60 && rnd() < 0.25) masts.push({ x, z, y: h, h: R(6, 14), r: 0.25 });
    taken.push([x, z, Math.max(w, d) * 0.55]);
    n++;
  }
  // mid-rise band in front: the Near South Side and Bronzeville, rising toward the Loop
  for (let x = -460; x <= 480; x += R(7, 11)) for (let z = -470; z >= -655; z -= R(8, 12)) {
    if (rnd() < 0.3) continue;
    const t = (-z - 470) / 185, w = R(5, 9), d = R(5, 9);
    box(x + R(-2, 2), z, w, d, R(4, 9) + t * R(4, 16) + (rnd() < 0.06 ? R(10, 24) : 0), rnd() < 0.6 ? hsl(R(0.05, 0.1), R(0.15, 0.35), R(0.4, 0.6)) : glass());
  }

  // ---- meshes ----
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3();
  const inst = (geo, list, place) => {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((b, i) => { place(b); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, b.c); });
    mesh.computeBoundingSphere(); root.add(mesh); return mesh;
  };
  inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), boxes, (b) => m4.compose(one.set(b.x, b.y, b.z), q.identity(), new THREE.Vector3(b.w, b.h, b.d)));
  // tapered and pyramid-capped towers: 4-sided cylinders/cones turned to square the footprint
  const tg = (rt) => new THREE.CylinderGeometry(rt, 1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  for (const t of tapers) inst(tg(t.rt / t.rb), [t], (b) => m4.compose(one.set(b.x, 0, b.z), q.identity(), new THREE.Vector3(b.rb, b.h, b.rb)));
  if (caps.length) inst(new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), caps, (b) => m4.compose(one.set(b.x, b.y, b.z), q.identity(), new THREE.Vector3(b.r, b.h, b.r)));
  // antennas: plain pale masts, hazed by hand (they're too thin for the window shader)
  const mastGeo = [];
  for (const a of masts) mastGeo.push(new THREE.CylinderGeometry(a.r * 0.5, a.r, a.h, 5).translate(a.x, a.y + a.h / 2, a.z));
  const mastMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc4c8cc).lerp(haze, 0.35), fog: false });
  for (const g of mastGeo) root.add(new THREE.Mesh(g, mastMat));
  // red beacons on the antenna tips: a slow blink, only after dark
  const bMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false, transparent: true, depthWrite: false });
  for (const p of beacons) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), bMat); b.position.copy(p); root.add(b);
  }
  // the city's glow on the sky after dark
  const gc = document.createElement('canvas'); gc.width = 256; gc.height = 128;
  { const x = gc.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    for (let i = 0; i <= 10; i++) { const k = i / 10; g.addColorStop(k, `rgba(255,${Math.round(176 - 36 * k)},${Math.round(104 - 24 * k)},${(Math.pow(1 - k, 2.2)).toFixed(3)})`); }   // a smooth fall-off, no visible rim
    x.fillStyle = g; x.fillRect(0, 0, 256, 128); }
  const glowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1100, 260), glowMat);
  glow.position.set(0, 128, -860); root.add(glow);
  glow.onBeforeRender = () => {
    const n = (G.nightU || { value: 0 }).value;
    glowMat.opacity = n * 0.24;
    bMat.opacity = n > 0.3 ? (Math.sin(performance.now() / 1000 * 2.2) > 0.2 ? 0.95 : 0.12) : 0;
  };
  glow.renderOrder = -1;
}

// Visual world beyond the playable area: an endless-looking street grid, low-detail buildings
// (a skyline downtown, rooftops in the suburbs, stucco towns by the coast) and trees. Not interactive.
import * as THREE from 'three';
import { chicagoSkyline } from './skyline.js';
import { G, rand, pick, seeded } from './core.js';

function tileTexture(map, pitch, roadW) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), k = S / pitch, r = roadW * k;
  const lot = map === 'suburbs' ? '#5d6442' : map === 'tropical' ? '#8f8a6c' : '#5f5c57';
  x.fillStyle = lot; x.fillRect(0, 0, S, S);
  // sidewalks
  x.fillStyle = '#a19c92';
  x.fillRect(0, 0, S, r / 2 + 1.6 * k); x.fillRect(0, S - r / 2 - 1.6 * k, S, r / 2 + 1.6 * k);
  x.fillRect(0, 0, r / 2 + 1.6 * k, S); x.fillRect(S - r / 2 - 1.6 * k, 0, r / 2 + 1.6 * k, S);
  // roads centred on tile edges (so they wrap into a grid)
  x.fillStyle = '#48494b';
  x.fillRect(0, 0, S, r / 2); x.fillRect(0, S - r / 2, S, r / 2); x.fillRect(0, 0, r / 2, S); x.fillRect(S - r / 2, 0, r / 2, S);
  // hints of roofs and yards inside each lot
  for (let i = 0; i < 26; i++) {
    const w = rand(20, 90), h = rand(20, 90), px = rand(r, S - r - w), py = rand(r, S - r - h);
    const v = map === 'suburbs' ? pick(['#4f5a36', '#7a6e62', '#6d4f45', '#58503f']) : map === 'tropical' ? pick(['#d9cdb8', '#c98e6a', '#e8e0cf', '#b9a58c']) : pick(['#6c6a66', '#7c7874', '#565450', '#8a857d']);
    x.fillStyle = v; x.globalAlpha = 0.8; x.fillRect(px, py, w, h); x.globalAlpha = 1;
  }
  if (map === 'suburbs') { x.fillStyle = '#58575a'; x.fillRect(r, S / 2 - 0.9 * k, S - 2 * r, 1.8 * k); } // alleys
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function natureTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#4f6a36'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { x.fillStyle = pick(['rgba(62,86,40,.5)', 'rgba(96,110,58,.35)', 'rgba(96,76,54,.3)', 'rgba(40,62,30,.5)']); x.beginPath(); x.arc(rand(0, S), rand(0, S), rand(3, 26), 0, 6.3); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// Box buildings with facade UVs derived from world position so windows keep a constant size at any scale.
function backdropMaterial(facade) {
  const mat = new THREE.MeshStandardMaterial({ map: facade.map, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.maskMap = { value: facade.mask };
    sh.uniforms.uNight = (G.nightU ||= { value: 0 });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(position,1.)).xyz; vWN = normalize(mat3(modelMatrix * instanceMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform sampler2D maskMap; uniform float uNight;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5); }')
      .replace('#include <map_fragment>', `
        vec2 fuv = abs(vWN.x) > 0.5 ? vec2(vWP.z / 1.7, vWP.y) : vec2(vWP.x / 1.7, vWP.y);
        vec2 tuv = vec2(fract(fuv.x), 0.5 + fract(fuv.y) * 0.5);
        vec4 tc = texture2D(map, tuv);
        float win = texture2D(maskMap, tuv).r;
        diffuseColor.rgb *= vWN.y > 0.5 ? vec3(0.42, 0.41, 0.4) : tc.rgb;
        if (vWN.y > 0.5) win = 0.0;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float wid = floor(fuv.x) * 13.0 + floor(fuv.y) * 7.0 + floor(vWP.x * 0.05) * 3.0 + floor(vWP.z * 0.05);
        totalEmissiveRadiance += vec3(1.0, 0.76, 0.45) * win * uNight * step(0.55, bh(vec2(wid, 3.0))) * 1.1;`);
  };
  return mat;
}

export function buildBackdrop(scene, mapName, city, facades, E, water) {
  const pitch = city.xs[1] - city.xs[0], pitchZ = city.zs[1] - city.zs[0];
  // ground: a tiled street grid lined up with the playable grid
  // La Playa sits in open country: no street grid out there, just scrub and trees
  const tex = mapName === 'tropical' ? natureTexture() : tileTexture(mapName, pitch, city.roadW);
  const SIZE = 3000;
  tex.repeat.set(SIZE / pitch, SIZE / pitchZ);
  const ox = (((city.xs[0] + SIZE / 2) / pitch) % 1 + 1) % 1, oz = (((SIZE / 2 - city.zs[0]) / pitchZ) % 1 + 1) % 1;
  tex.offset.set(-ox, -oz);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);

  const rnd = seeded(mapName.length * 977);
  const R = (a, b) => a + rnd() * (b - a);
  const style = mapName === 'tropical' ? 'stucco' : mapName === 'suburbs' ? 'flat' : 'concrete';
  const mat = backdropMaterial(facades[style]);
  const boxes = [];
  const trees = [];
  const MAXR = 290;
  for (let ix = -20; ix <= 20; ix++) for (let iz = -20; iz <= 20; iz++) {
    const cx = city.xs[0] + (ix + 0.5) * pitch, cz = city.zs[0] + (iz + 0.5) * pitchZ;
    const far = Math.max(Math.abs(cx), Math.abs(cz));
    // Chicago: the walk-ups carry on north all the way to the downtown skyline (js/skyline.js starts ~470 out)
    const northFill = mapName === 'suburbs' && cz < 0 && cz > -485 && Math.abs(cx + 100) < 620;
    if (far < E + 2 || (far > MAXR && !northFill)) continue;
    if (water && (water.axis === 'x' ? cx < water.shore + 6 : cz < water.shore + 6)) continue;
    if (city.bridgeClear && city.bridgeClear.some((c) => Math.hypot(cx - c.x, cz - c.z) < c.r + 8)) continue;
    const lot = pitch - city.roadW - 3.4, lotZ = pitchZ - city.roadW - 3.4;
    if (mapName === 'suburbs') {
      // rows of narrow flat-roofed walk-ups on both street fronts, garages on the alley
      for (const sd of [-1, 1]) for (let x = cx - lot / 2 + 1.8; x < cx + lot / 2 - 1.5; x += R(3.2, 3.9)) {
        if (rnd() < 0.1) continue; // vacant lot
        boxes.push([x, cz + sd * (lotZ / 2 - 4.2), R(2.8, 3.3), R(5.4, 6.6), R(2.4, 3.5)]);
        if (rnd() < 0.6) boxes.push([x, cz + sd * 2.2, R(2.4, 2.9), 2.3, 1.15]);
      }
      for (let k = 0; k < 4; k++) trees.push([cx + R(-lot / 2, lot / 2), cz + (k % 2 ? 1 : -1) * (lotZ / 2 + 0.6), R(0.9, 1.3)]);
    } else if (mapName === 'tropical') {
      if (cz > 58) continue;                                   // the hills stand there (js/playa.js)
      for (let k = 0; k < 9; k++) trees.push([cx + R(-pitch / 2, pitch / 2), cz + R(-pitchZ / 2, pitchZ / 2), R(1.1, 2.2)]);   // just woods and scrub
    } else {
      // skyline: taller toward one side so the city seems to continue into a denser core
      const core = Math.exp(-(((cx + 40) ** 2 + (cz + 170) ** 2) / (140 ** 2)));
      const n = 1 + Math.floor(R(0, 3));
      for (let k = 0; k < n; k++) {
        const w = lot / n - 0.6;
        boxes.push([cx - lot / 2 + (k + 0.5) * lot / n, cz + R(-1, 1), w, lotZ - R(0, 3), R(3, 10) + core * R(10, 42)]);
      }
      if (rnd() < 0.2) for (let k = 0; k < 4; k++) trees.push([cx + R(-lot / 2, lot / 2), cz + R(-lotZ / 2, lotZ / 2), R(0.9, 1.3)]);
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, boxes.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  boxes.forEach(([x, z, w, d, h], i) => {
    m.makeScale(w, h, d).setPosition(x, 0, z);
    mesh.setMatrixAt(i, m);
    if (mapName === 'downtown') col.setHSL(R(0.05, 0.12), R(0.05, 0.25), R(0.55, 0.8), THREE.SRGBColorSpace);
    else if (mapName === 'tropical') col.setHSL(R(0, 1), R(0.1, 0.4), R(0.78, 0.92), THREE.SRGBColorSpace);
    else col.setHSL(pick([0.02, 0.04, 0.1, 0.06]), R(0.2, 0.45), R(0.42, 0.7), THREE.SRGBColorSpace);
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  const tgeo = new THREE.IcosahedronGeometry(1, 1).scale(1, 0.85, 1).translate(0, 1.6, 0);
  const tmesh = new THREE.InstancedMesh(tgeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: false }), Math.max(1, trees.length));
  trees.forEach(([x, z, s], i) => {
    m.makeScale(s, s, s).setPosition(x, 0, z); tmesh.setMatrixAt(i, m);
    tmesh.setColorAt(i, col.setHSL(R(0.2, 0.3), 0.4, R(0.18, 0.28), THREE.SRGBColorSpace));
  });
  tmesh.castShadow = true; scene.add(tmesh);
  if (mapName === 'suburbs') chicagoSkyline(scene);   // downtown Chicago on the northern horizon (js/skyline.js)
}

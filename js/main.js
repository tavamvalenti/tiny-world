import * as THREE from 'three';
import { G, clamp, lerp } from './core.js';
import { Post } from './post.js';
import { makeFacades } from './textures.js';
import { Buildings } from './buildings.js';
import { FX } from './fx.js';
import { Agents } from './agents.js';
import { Weapons, WEAPONS } from './weapons.js';
import { MAPS } from './maps.js';
import { sfx } from './audio.js';

const $ = (s) => document.querySelector(s);
const canvasEl = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const PR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(1);
const post = new Post(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, 1, 1, 1600);
Object.assign(G, { scene, camera, renderer });
window.G = G;

// ---------- camera rig: an invisible mothership hovering over the miniature ----------
const cam = { x: 0, z: 0, vx: 0, vz: 0, dist: 92, distT: 92, yaw: 0.32, yawT: 0.32, minD: 30, maxD: 150, half: 66, zMin: -66 };
G.camTarget = cam;
const keys = {};
const input = { down: false, pressed: false, mx: 0, my: 0 };
G.input = input; G.cam = cam;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(PR);
  post.setSize(Math.floor(w * PR), Math.floor(h * PR));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- environment ----------
function makeEnv() {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y;
      vec3 sky = mix(vec3(0.95,0.9,0.82), vec3(0.42,0.6,0.9), smoothstep(0.0, 0.6, y));
      vec3 gnd = mix(vec3(0.5,0.47,0.42), vec3(0.3,0.28,0.25), smoothstep(0.0, -0.5, y));
      vec3 c = y > 0. ? sky : gnd;
      float sun = pow(max(dot(vP, normalize(vec3(-0.5,0.6,-0.4))), 0.), 64.);
      gl_FragColor = vec4(c * 0.75 + sun * vec3(8.,7.,5.), 1.); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return t;
}

const sun = new THREE.DirectionalLight(0xffeed6, 3.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
const SUN_DIR = new THREE.Vector3(-0.55, 0.72, -0.42).normalize();
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xc4d8ff, 0x8a7a62, 0.7);
scene.add(hemi);

// ---------- water (tropical) ----------
function makeWater(shore) {
  const timeU = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.15, transparent: true, envMapIntensity: 1.3, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU; sh.uniforms.shore = { value: shore };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform float uTime; uniform float shore;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float depth = clamp((shore - vW.z) / 16., 0., 1.);
        diffuseColor.rgb = mix(vec3(0.22,0.72,0.70), vec3(0.03,0.2,0.32), sqrt(depth));
        diffuseColor.a = mix(0.2, 0.95, smoothstep(0., 0.45, depth));
        float edge = shore - 0.8 + 0.7 * sin(vW.x * 0.35 + uTime * 1.1) + 0.3 * sin(vW.x * 1.3 - uTime * 0.7);
        float foam = smoothstep(0.9, 0.0, abs(vW.z - edge)) * (0.6 + 0.4 * sin(vW.x * 4.0 + uTime * 3.0));
        foam += smoothstep(0.5, 0.0, abs(vW.z - edge + 3.0 + sin(uTime * 0.8 + vW.x * 0.2))) * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), clamp(foam, 0., 1.) * 0.85);
        diffuseColor.a = max(diffuseColor.a, clamp(foam, 0., 1.) * 0.9);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec2 wv = vec2(sin(vW.x * 1.3 + uTime * 1.7) + sin(vW.x * 0.6 + vW.z * 1.1 + uTime * 1.2) + 0.5 * sin(vW.x * 3.1 - vW.z * 2.3 + uTime * 2.6),
                       cos(vW.z * 1.5 + uTime * 1.3) + sin(vW.z * 0.7 - vW.x * 0.9 + uTime) + 0.5 * cos(vW.z * 2.9 + vW.x * 2.1 - uTime * 2.2)) * 0.07;
        normal = normalize(normal + (viewMatrix * vec4(wv.x, 0., wv.y, 0.)).xyz);`);
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 400).rotateX(-Math.PI / 2), mat);
  m.position.set(0, 0.05, shore + 1.5 - 200);
  m.receiveShadow = true;
  m.renderOrder = 1;
  return { mesh: m, timeU };
}

// ---------- load a map ----------
let running = false, water = null, mapName = '';
function load(name) {
  mapName = name;
  scene.environment = makeEnv();
  const facades = makeFacades();
  const B = new Buildings(facades);
  const map = MAPS[name](B);
  G.buildings = B; G.city = map.city; G.ground = map.g;
  scene.background = new THREE.Color(map.fog);
  scene.fog = new THREE.Fog(map.fog, 100, 300);

  const gmat = new THREE.MeshStandardMaterial({ map: map.g.tex, roughness: 0.93, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.g.E * 2, map.g.E * 2).rotateX(-Math.PI / 2), gmat);
  ground.receiveShadow = true;
  scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: map.water ? 0x0b3346 : 0x5e5c55, roughness: 1 }));
  outer.position.y = -0.05;
  scene.add(outer);
  if (map.water) { water = makeWater(map.water.shore); scene.add(water.mesh); }

  B.finalize(scene);
  map.city.build(scene);
  G.fx = new FX(scene);
  G.agents = new Agents(scene, map.city, map.agents);
  G.weapons = new Weapons(scene, camera);
  cam.x = map.start.x; cam.z = map.start.z;
  cam.half = map.city.half; cam.zMin = map.zMin ?? -map.city.half;
  $('#mapname').firstChild.textContent = { downtown: 'DOWNTOWN', tropical: 'TROPICAL TOWN', suburbs: 'SUBURBS' }[name];
  selectWeapon(0);
  updateCamera(0);
  renderer.compile(scene, camera);
}

function selectWeapon(i) {
  G.weapons && G.weapons.select(i);
  document.querySelectorAll('#weapons .w').forEach((el) => el.classList.toggle('on', +el.dataset.w === i));
}

// ---------- camera ----------
const ray = new THREE.Raycaster();
function updateCamera(dt) {
  const f = keys.KeyW || keys.ArrowUp ? 1 : 0, b = keys.KeyS || keys.ArrowDown ? 1 : 0;
  const l = keys.KeyA || keys.ArrowLeft ? 1 : 0, r = keys.KeyD || keys.ArrowRight ? 1 : 0;
  const sp = cam.dist * 0.75 * (keys.ShiftLeft ? 1.8 : 1);
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const ax = (f - b) * fx + (r - l) * rx, az = (f - b) * fz + (r - l) * rz;
  const k = 1 - Math.exp(-dt * 6);
  cam.vx = lerp(cam.vx, ax * sp, k); cam.vz = lerp(cam.vz, az * sp, k);
  cam.x = clamp(cam.x + cam.vx * dt, -cam.half, cam.half);
  cam.z = clamp(cam.z + cam.vz * dt, cam.zMin, cam.half);
  if (keys.KeyQ) cam.yawT += dt * 0.9;
  if (keys.KeyE) cam.yawT -= dt * 0.9;
  cam.yaw = lerp(cam.yaw, cam.yawT, 1 - Math.exp(-dt * 5));
  cam.dist = lerp(cam.dist, cam.distT, 1 - Math.exp(-dt * 6));
  const zt = (cam.dist - cam.minD) / (cam.maxD - cam.minD);
  const pitch = lerp(0.8, 0.98, zt); // ~46° close up to ~56° far out: always the same aerial 3/4 look
  // gentle hover drift, like a massive craft holding position
  const hx = Math.sin(G.time * 0.31) * 0.25, hy = Math.sin(G.time * 0.23) * 0.3;
  const sh = G.shake;
  camera.position.set(
    cam.x + Math.sin(cam.yaw) * Math.cos(pitch) * cam.dist + hx + (Math.random() - 0.5) * sh * 1.2,
    Math.sin(pitch) * cam.dist + hy + (Math.random() - 0.5) * sh * 1.2,
    cam.z + Math.cos(cam.yaw) * Math.cos(pitch) * cam.dist + (Math.random() - 0.5) * sh * 1.2,
  );
  camera.lookAt(cam.x, 0, cam.z);
  G.shake = Math.max(0, G.shake - dt * 1.6);
  // atmospheric perspective: haze starts just behind the focus point whatever the zoom
  if (scene.fog) { scene.fog.near = cam.dist * 1.05; scene.fog.far = cam.dist * 3.4 + 60; }
  // tilt-shift band narrows as you zoom in, strengthening the miniature illusion
  post.focusY = 0.5;
  post.band = lerp(0.16, 0.3, zt);
  post.maxBlur = lerp(15, 11, zt);
  // sun + shadow frustum follow the view, snapped to shadow texels to avoid shimmer
  const ext = clamp(cam.dist * 0.75, 30, 95);
  const sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400;
  sc.updateProjectionMatrix();
  const texel = (ext * 2) / 4096;
  const tx = Math.round(cam.x / texel) * texel, tz = Math.round(cam.z / texel) * texel;
  sun.target.position.set(tx, 0, tz);
  sun.position.set(tx + SUN_DIR.x * 200, SUN_DIR.y * 200, tz + SUN_DIR.z * 200);
}

function aim() {
  const ndc = new THREE.Vector2((input.mx / window.innerWidth) * 2 - 1, -(input.my / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  G.weapons.aim = G.buildings.raycast(camera.position, ray.ray.direction, 1500);
}

function updateBoats(dt) {
  const boats = G.city.boats;
  if (!boats) return;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const b of boats) {
    if (!b.alive) continue;
    b.x += Math.sin(b.rot) * b.speed * dt; b.z += Math.cos(b.rot) * b.speed * dt;
    if (b.x > 120) b.x = -120; if (b.x < -120) b.x = 120;
    if (b.z > G.city.shore - 8) { b.rot = Math.PI - b.rot; b.z = G.city.shore - 8; }
    if (b.z < -140) { b.rot = Math.PI - b.rot; }
    q.setFromAxisAngle(up, b.rot);
    m.compose(new THREE.Vector3(b.x, 0.05 + Math.sin(G.time * 2 + b.x) * 0.04, b.z), q, new THREE.Vector3(b.s, b.s, b.s));
    b.mesh.setMatrixAt(b.i, m);
    if (Math.random() < dt * 6) G.fx.bits.emit(b.x - Math.sin(b.rot) * b.s, 0.1, b.z - Math.cos(b.rot) * b.s, 0, 0.3, 0, 0.15, 1.5, 0.95, 0.97, 1, 1);
  }
  boats[0].mesh.instanceMatrix.needsUpdate = true;
}

// ---------- loop ----------
let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
}
// one simulation + render tick (also used by automated tests via G.step)
function step(dt) {
  G.dt = dt; G.time += dt;
  updateCamera(dt);
  aim();
  G.city.update(dt);
  updateBoats(dt);
  G.agents.update(dt);
  G.weapons.update(dt, input);
  input.pressed = false;
  G.buildings.update(dt);
  G.fx.update(dt, camera, renderer);
  G.ground.update(dt);
  if (water) water.timeU.value = G.time;
  post.render(scene, camera, G.time);
  frames++; fpsT += dt;
  if (fpsT > 0.5) {
    fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    $('#stats').textContent = `${fps} FPS · ${G.buildings.destroyed} sections destroyed · ${G.buildings.burning.size} burning`;
  }
}
G.step = (dt = 1 / 30, n = 1) => { for (let i = 0; i < n; i++) step(dt); };
G.snap = (w = 560, q = 0.55) => {
  step(1 / 60);
  const src = renderer.domElement, c = document.createElement('canvas');
  c.width = w; c.height = Math.round(w * src.height / src.width);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
};
requestAnimationFrame(frame);

// ---------- input ----------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!running) return;
  if (e.code >= 'Digit1' && e.code <= 'Digit5') selectWeapon(+e.code.slice(5) - 1);
  if (e.code === 'Escape') location.reload();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.down = false; });
canvasEl.addEventListener('mousemove', (e) => { input.mx = e.clientX; input.my = e.clientY; });
canvasEl.addEventListener('mousedown', (e) => { if (e.button === 0) { input.down = true; input.pressed = true; sfx.unlock(); } });
window.addEventListener('mouseup', (e) => { if (e.button === 0) input.down = false; });
canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
canvasEl.addEventListener('wheel', (e) => { e.preventDefault(); cam.distT = clamp(cam.distT * Math.exp(e.deltaY * 0.0012), cam.minD, cam.maxD); }, { passive: false });
document.querySelectorAll('#weapons .w').forEach((el) => el.addEventListener('click', () => selectWeapon(+el.dataset.w)));

document.querySelectorAll('#menu button').forEach((btn) => btn.addEventListener('click', () => {
  sfx.unlock();
  $('#menu').style.display = 'none';
  $('#loading').style.display = 'flex';
  setTimeout(() => {
    try {
      load(btn.dataset.map);
    } catch (err) {
      console.error(err);
      $('#loading').textContent = 'FAILED TO BUILD MAP — ' + err.message;
      return;
    }
    $('#loading').style.display = 'none';
    $('#hud').style.display = 'block';
    last = performance.now();
    running = true;
  }, 60);
}));

// allow ?map=downtown for quick testing
const qp = new URLSearchParams(location.search).get('map');
if (qp && MAPS[qp]) document.querySelector(`#menu button[data-map="${qp}"]`).click();

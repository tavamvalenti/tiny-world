import * as THREE from 'three';
import { G, clamp, lerp, viewH } from './core.js';
import { Post } from './post.js';
import { makeFacades } from './textures.js';
import { Buildings } from './buildings.js';
import { FX } from './fx.js';
import { Agents } from './agents.js';
import { Weapons, WEAPONS } from './weapons.js';
import { MAPS } from './maps.js';
import { sfx } from './audio.js';
import { Ambience } from './ambience.js';
import { TimeOfDay } from './tod.js';
import { Signs } from './signs.js';
import { buildBackdrop } from './backdrop.js';
import { Trolley } from './trolley.js';
import { Harbor } from './harbor.js';
import { Chaos } from './chaos.js';
import { Concert } from './concert.js';
import { Court } from './court.js';
import { Gangs } from './gangs.js';
import { Gore } from './gore.js';
import { World, MENU } from './world.js';
import { Responders } from './responders.js';
import { Station } from './station.js';
import { pickSites, Construction } from './construction.js';
import { Roles } from './roles.js';
import { News } from './news.js';
import { Sky } from './sky.js';
import { Director } from './director.js';
import { initMenu } from './menu.js';
import { Playa, terrainH } from './playa.js';
import { SanDiego } from './sandiego.js';
import { Pets } from './pets.js';
import { Petco } from './petco.js';
import { settings, onSettingsChange, buildSettingsPanel } from './settings.js';
import { RickMode } from './rick.js';
import { addRipples, gatherWakes, buildPools } from './water.js';
import { Chains } from './chains.js';
import { vegas, Vegas } from './vegas.js';
import { london, London } from './london.js';
import { greenland, Greenland, terrainH as glTerrainH } from './greenland.js';
import { cairo, Cairo, terrainH as caTerrainH } from './cairo.js';
if (document.fonts && document.fonts.load) for (const f of ['700 40px Cairo', '900 40px Cairo', '700 40px "Reem Kufi"']) document.fonts.load(f, 'القاهرة').catch(() => {});
MAPS.vegas = vegas; MAPS.london = london; MAPS.greenland = greenland; MAPS.cairo = cairo;

const TOUCH = document.documentElement.classList.contains('touch');   // phones and tablets (set in index.html)
export const MAP_NAMES = { downtown: 'GASLAMP DISTRICT', tropical: 'LA PLAYA', suburbs: 'CHICAGO', vegas: 'LAS VEGAS', london: 'LONDON', greenland: 'SISIMIUT', cairo: 'CAIRO' };

const $ = (s) => document.querySelector(s);
const canvasEl = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
let PR = DPR;
renderer.setPixelRatio(1);
const post = new Post(renderer);
G.post = post; // exposed for tuning and tests

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, 1, 0.5, 1600);
Object.assign(G, { scene, camera, renderer });
window.G = G;

// ---------- camera rig: an invisible mothership hovering over the miniature ----------
const cam = { x: 0, z: 0, vx: 0, vz: 0, dist: 92, distT: 92, yaw: 0.32, yawT: 0.32, minD: 12, maxD: 200, half: 66, zMin: -66, tilt: 0, tiltT: 0, yaw0: 0.32 };
G.camTarget = cam;
const keys = {};
const input = { down: false, pressed: false, mx: 0, my: 0 };
G.input = input; G.cam = cam;

function resize() {
  const w = window.innerWidth, h = viewH();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(PR);
  post.setSize(Math.floor(w * PR), Math.floor(h * PR));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- environment ----------
function makeEnv(top = [0.42, 0.6, 0.9], hor = [0.95, 0.9, 0.82], sunC = [8, 7, 5]) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y;
      vec3 sky = mix(vec3(${hor.join(',')}), vec3(${top.join(',')}), smoothstep(0.0, 0.6, y));
      vec3 gnd = mix(vec3(${hor.join(',')}) * 0.5, vec3(0.3,0.28,0.25) * vec3(${top.join(',')}) * 2.0, smoothstep(0.0, -0.5, y));
      vec3 c = y > 0. ? sky : gnd;
      float sun = pow(max(dot(vP, normalize(vec3(-0.5,0.4,-0.4))), 0.), 48.);
      gl_FragColor = vec4(c * 0.75 + sun * vec3(${sunC.join(',')}), 1.); }`,
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
function makeWater(shore, axis = 'z') {
  const timeU = { value: 0 };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.0, specularIntensity: 0.45, transparent: true, envMapIntensity: 0.55, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU; sh.uniforms.shore = { value: shore }; sh.uniforms.axisX = { value: axis === 'x' ? 1 : 0 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform float uTime; uniform float shore; uniform float axisX;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float along = mix(vW.x, vW.z, axisX), across = mix(vW.z, vW.x, axisX);
        float depth = clamp((shore - across) / mix(16., 5., axisX), 0., 1.);  // harbour drops off at the seawall
        float wpatch = 0.5 + 0.5 * sin(vW.x * 0.07 + vW.z * 0.05 + uTime * 0.05) * sin(vW.x * 0.023 - vW.z * 0.041);
        vec3 deep = mix(mix(vec3(0.03,0.17,0.27), vec3(0.05,0.24,0.3), wpatch), mix(vec3(0.02,0.1,0.2), vec3(0.03,0.14,0.25), wpatch), axisX);
        diffuseColor.rgb = mix(mix(vec3(0.2,0.62,0.6), vec3(0.08,0.3,0.36), axisX), deep, sqrt(depth));
        diffuseColor.a = mix(0.2, 0.995, smoothstep(0., 0.45, depth));
        float edge = shore - 0.8 + 0.7 * sin(along * 0.35 + uTime * 1.1) + 0.3 * sin(along * 1.3 - uTime * 0.7);
        float foam = smoothstep(0.9, 0.0, abs(across - edge)) * (0.6 + 0.4 * sin(along * 4.0 + uTime * 3.0));
        foam += smoothstep(0.5, 0.0, abs(across - edge + 3.0 + sin(uTime * 0.8 + along * 0.2))) * 0.35;
        foam *= 1.0 - axisX * 0.75; // harbour seawall: barely any surf
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), clamp(foam, 0., 1.) * 0.85);
        diffuseColor.a = max(diffuseColor.a, clamp(foam, 0., 1.) * 0.9);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec2 wv = vec2(sin(vW.x * 1.3 + uTime * 1.7) + sin(vW.x * 0.6 + vW.z * 1.1 + uTime * 1.2) + 0.5 * sin(vW.x * 3.1 - vW.z * 2.3 + uTime * 2.6),
                       cos(vW.z * 1.5 + uTime * 1.3) + sin(vW.z * 0.7 - vW.x * 0.9 + uTime) + 0.5 * cos(vW.z * 2.9 + vW.x * 2.1 - uTime * 2.2)) * 0.05
                  + vec2(sin(vW.x * 0.21 + vW.z * 0.13 + uTime * 0.6), cos(vW.z * 0.19 - vW.x * 0.11 + uTime * 0.5)) * 0.05;
        normal = normalize(normal + (viewMatrix * vec4(wv.x, 0., wv.y, 0.)).xyz * mix(0.8, 0.45, axisX));`);
    // ripples carried by the current and the swell, and the wakes of every boat out on it (js/water.js)
    addRipples(sh, { flow: axis === 'x' ? [0.05, 0.35] : [0.08, 0.45], scale: 0.9, amp: 0.85, gloss: [0.14, 0.34] });
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(axis === 'x' ? 800 : 700, axis === 'x' ? 1400 : 400).rotateX(-Math.PI / 2), mat);
  if (axis === 'x') m.position.set(shore + 1.5 - 400, 0.05, 0); else m.position.set(0, 0.05, shore + 1.5 - 200);
  m.receiveShadow = false;
  m.renderOrder = 1;
  return { mesh: m, timeU };
}

// ---------- load a map ----------
let running = false, water = null, mapName = '', tod = null, ambience = null, signs = null;
function load(name) {
  mapName = name;
  scene.environment = makeEnv();
  const facades = makeFacades();
  const B = new Buildings(facades);
  G.terrainH = name === 'tropical' ? terrainH : name === 'greenland' ? glTerrainH : name === 'cairo' ? caTerrainH : null;       // La Playa's hills, Sisimiut's rock
  G.rayExtra = null;                                       // a map can add its own things to aim at (Greenland's icebergs)
  const map = MAPS[name](B);
  const sites = pickSites(B, map.city, name);             // a few buildings are still going up
  const density = { low: 0.5, normal: 1, high: 1.5 }[settings.crowds] || 1;
  map.agents.peds = Math.round(map.agents.peds * density);
  if (map.city.crowds) for (const c of map.city.crowds) c.n = Math.max(1, Math.round(c.n * density));
  G.buildings = B; G.city = map.city; G.ground = map.g;
  scene.background = new THREE.Color(map.fog);
  scene.fog = new THREE.Fog(map.fog, 100, 300);

  const gmat = new THREE.MeshStandardMaterial({ map: map.g.tex, roughness: 0.93, metalness: 0 });
  G.groundMat = gmat; G.mapName = name;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.g.E * 2, map.g.E * 2).rotateX(-Math.PI / 2), gmat);
  ground.receiveShadow = true;
  scene.add(ground);
  if (map.water) { water = makeWater(map.water.shore, map.water.axis); scene.add(water.mesh); }
  buildPools(scene, map.city.pools, map.city.ponds);                          // pools and ponds painted on the ground get real water

  B.finalize(scene);
  G.construction = new Construction(scene, sites, map.city, name);
  G.harbor = map.city.shoreX != null ? new Harbor(scene, map.city, map.g) : null;
  map.city.build(scene);
  G.playa = map.city.playa ? new Playa(scene, map.city) : null;
  G.sandiego = map.city.landmarks ? new SanDiego(scene, map.city) : null;
  G.chains = map.city.chains ? new Chains(scene, map.city) : null;           // In-N-Out (Gaslamp), Raising Cane's (Chicago)
  G.vegas = map.city.vegas ? new Vegas(scene, map.city) : null;              // the Strip's landmarks, fountains, Sphere, mountains
  G.london = map.city.london ? new London(scene, map.city) : null;           // the Thames, the landmarks, the city around them
  G.greenland = map.city.gl ? new Greenland(scene, map.city) : null;
  G.cairo = map.city.cai ? new Cairo(scene, map.city) : null;             // Cairo: the Nile, the pyramids, the bazaar, mosques, feluccas        // Sisimiut: the rock, the sea and its ice, the boats, the pitch
  if (!map.ownBackdrop) buildBackdrop(scene, name, map.city, facades, map.g.E, map.water);
  signs = new Signs(scene, name, B, map.city);
  G.trains = map.city.rail ? new Trolley(scene, map.city, map.g) : null;
  G.petco = map.city.petco ? new Petco(scene, map.city, map.city.petco, B) : null;
  if (map.city.crowdsLate) (map.city.crowds ||= []).push(...map.city.crowdsLate);
  G.concert = map.city.concert ? new Concert(scene, map.city.concert, map.city) : null;
  G.court = map.city.court ? new Court(scene, map.city.court, map.g) : null;
  G.gangs = map.city.gangs ? new Gangs(scene, map.city) : null;
  G.fx = new FX(scene);
  G.gore = new Gore(scene);
  G.agents = new Agents(scene, map.city, map.agents);
  G.chaos = new Chaos(G.agents);
  new Roles(scene, map.city, name, sites);                 // sets G.roles
  new Pets(scene, name, map.city);                          // dogs on walks, a groundskeeper mowing (sets G.pets)
  G.responders = new Responders(scene, map.city);
  G.station = map.city.policeHQ ? new Station(scene, map.city.policeHQ, name) : null;
  G.world = new World(scene);
  new News(name, map.city);                                 // sets G.news
  new Sky(scene, name, map.city);                           // sets G.sky
  new Director(name);                                       // sets G.director
  worldMenu.querySelector('[data-id="w-snow"]')?.style.setProperty('display', name === 'suburbs' || name === 'greenland' ? '' : 'none');   // snow: Chicago and Greenland
  // London calls its gang members roadmen, and their fights are knife fights
  for (const [id, ldn, def] of [['gang', 'Roadmen', 'Gang Member'], ['e-gang', 'Knife Fight', 'Gang Conflict']]) { const b = worldMenu.querySelector(`[data-id="${id}"]`); if (b) { b.textContent = name === 'london' ? ldn : def; b.dataset.label = b.textContent; } }
  G.weapons = new Weapons(scene, camera);
  cam.x = map.start.x; cam.z = map.start.z;
  cam.half = map.city.half; cam.zMin = map.zMin ?? -map.city.half; cam.xMin = map.xMin ?? -map.city.half; cam.zMax = map.zMax ?? map.city.half;
  cam.yaw = cam.yawT = cam.yaw0 = map.yaw ?? 0.32; cam.maxD = map.maxD ?? 200; cam.tilt = cam.tiltT = 0;
  if (camera.fov !== 24) { camera.fov = 24; camera.updateProjectionMatrix(); }
  $('#mapTitle').textContent = MAP_NAMES[name];
  // reuse the region label (flag/logo + place) from the menu button
  $('#mapRegion').innerHTML = document.querySelector(`#menu button[data-map="${name}"] .region`).innerHTML;
  tod = new TimeOfDay({ scene, sun, hemi, post, renderer, fogDay: map.fog });
  G.tod = tod; G.makeEnv = makeEnv;
  ambience = new Ambience(name); G.ambience = ambience;
  setTodButtons();
  selectWeapon(0);
  updateCamera(0);
  renderer.compile(scene, camera);
}

function selectWeapon(i) {
  if (G.world && G.world.armed) disarm();          // back to weapons
  G.weapons && G.weapons.select(i);
  document.querySelectorAll('#weapons .w').forEach((el) => {
    const on = +el.dataset.w === i;
    el.classList.toggle('on', on);
    // replay the selection pop
    el.classList.remove('pop');
    if (on) { void el.offsetWidth; el.classList.add('pop'); }
  });
}

// ---------- camera ----------
const ray = new THREE.Raycaster();
function updateCamera(dt) {
  const f = keys.KeyW || keys.ArrowUp ? 1 : 0, b = keys.KeyS || keys.ArrowDown ? 1 : 0;
  const l = keys.KeyA || keys.ArrowLeft ? 1 : 0, r = keys.KeyD || keys.ArrowRight ? 1 : 0;
  const sp = cam.dist * 0.75 * (keys.ShiftLeft ? 1.8 : 1) * settings.moveSpeed / 100;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const ax = (f - b) * fx + (r - l) * rx, az = (f - b) * fz + (r - l) * rz;
  const k = 1 - Math.exp(-dt * 6);
  cam.vx = lerp(cam.vx, ax * sp, k); cam.vz = lerp(cam.vz, az * sp, k);
  // touch drag: take a share of the queued move each frame (smooth), plus a short glide after the finger lifts
  const ease = 1 - Math.exp(-dt * 10), mx = drag.x * ease + drag.vx * dt, mz = drag.z * ease + drag.vz * dt;
  drag.x -= drag.x * ease; drag.z -= drag.z * ease;
  const fr = Math.exp(-dt * 4.5); drag.vx *= fr; drag.vz *= fr;
  cam.x = clamp(cam.x + cam.vx * dt + mx, cam.xMin ?? -cam.half, cam.half);
  cam.z = clamp(cam.z + cam.vz * dt + mz, cam.zMin, cam.zMax ?? cam.half);
  const rs = 0.9 * settings.rotateSpeed / 100;
  // vertical view: R looks up toward the horizon, F back down (V or the RESET VIEW button returns to the locked view)
  if (keys.KeyR) cam.tiltT = clamp(cam.tiltT - dt * 0.7, -1.1, 0.5);
  if (keys.KeyF) cam.tiltT = clamp(cam.tiltT + dt * 0.7, -1.1, 0.5);
  cam.tilt = lerp(cam.tilt, cam.tiltT, 1 - Math.exp(-dt * 6));
  syncTilt();
  if (keys.KeyQ) cam.yawT += dt * rs;
  if (keys.KeyE) cam.yawT -= dt * rs;
  cam.yaw = lerp(cam.yaw, cam.yawT, 1 - Math.exp(-dt * 5));
  // arriving from the globe: a slower glide down onto the miniature, then the usual snappy zoom
  if (cam.intro > 0) cam.intro -= dt;
  cam.dist = lerp(cam.dist, cam.distT, 1 - Math.exp(-dt * (cam.intro > 0 ? 1.5 : 6)));
  const zt = clamp((cam.dist - 30) / 120, 0, 1);
  // La Playa zooms out past the usual limit into a panorama: the lens widens and the camera lowers until the
  // whole city lines up in one frame: beach, resorts, streets, the hills and the Cristo on top
  const pano = cam.maxD > 150 ? clamp((cam.dist - 150) / (cam.maxD - 150), 0, 1) : 0;
  // the locked view: ~46° close up to ~56° far out (a touch lower when you're right in close), plus any manual tilt
  const pitch = clamp(lerp(lerp(0.8, 0.98, zt), 0.44, pano) - (cam.dist < 30 ? (30 - cam.dist) * 0.008 : 0) + cam.tilt, 0.08, 1.5);
  // a phone held upright sees a narrow slice at the desktop lens: widen it so the city doesn't feel squeezed
  const fov0 = camera.aspect < 1 ? lerp(24, 38, clamp((1 - camera.aspect) / 0.55, 0, 1)) : 24;
  const fov = lerp(fov0, 44, pano);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // gentle hover drift, like a massive craft holding position
  const hx = Math.sin(G.time * 0.31) * 0.25, hy = Math.sin(G.time * 0.23) * 0.3;
  const sh = G.shake * settings.shake / 100;
  // on the hills the camera rides up with the ground it's looking at (eased so it glides over the slope)
  cam.ty = lerp(cam.ty || 0, G.terrainH ? G.terrainH(cam.x, cam.z) : 0, 1 - Math.exp(-dt * 3));
  camera.position.set(
    cam.x + Math.sin(cam.yaw) * Math.cos(pitch) * cam.dist + hx + (Math.random() - 0.5) * sh * 0.45,
    Math.max(cam.ty + 1.2, Math.sin(pitch) * cam.dist + cam.ty + hy + (Math.random() - 0.5) * sh * 0.45),
    cam.z + Math.cos(cam.yaw) * Math.cos(pitch) * cam.dist + (Math.random() - 0.5) * sh * 0.45,
  );
  camera.lookAt(cam.x, pano * 16 + cam.ty, cam.z);
  G.shake = Math.max(0, G.shake - dt * 1.6);
  // atmospheric perspective: haze starts just behind the focus point whatever the zoom
  if (scene.fog) { scene.fog.near = Math.max(40, cam.dist * 1.05); scene.fog.far = Math.max(200, cam.dist * 3.4 + 60) + (1 - Math.min(1, pitch / 0.8)) * 250; }
  // tilt-shift band narrows as you zoom in, strengthening the miniature illusion
  post.focusY = 0.5;
  post.band = lerp(0.16, 0.3, zt);
  post.maxBlur = lerp(15, 11, zt) * settings.tiltShift / 100;
  // sun + shadow frustum follow the view, snapped to shadow texels to avoid shimmer
  const ext = clamp(cam.dist * 0.75, 30, 95);
  const sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400;
  sc.updateProjectionMatrix();
  const texel = (ext * 2) / sun.shadow.mapSize.x;
  const tx = Math.round(cam.x / texel) * texel, tz = Math.round(cam.z / texel) * texel;
  sun.target.position.set(tx, 0, tz);
  const sd = tod ? tod.sunDir : SUN_DIR;
  sun.position.set(tx + sd.x * 200, sd.y * 200, tz + sd.z * 200);
}

function aim() {
  const ndc = new THREE.Vector2((input.mx / window.innerWidth) * 2 - 1, -(input.my / viewH()) * 2 + 1);
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
  if (!running || settingsOpen) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
}
// one simulation + render tick (also used by automated tests via G.step)
let rick = null;
const NO_INPUT = { down: false, pressed: false };
function step(dt) {
  G.dt = dt; G.time += dt;
  const flying = !!(rick && rick.active);
  if (flying) rick.update(dt);                                  // Rick's ship: flies, then parks the view target on itself
  updateCamera(dt);
  if (flying) rick.applyCamera(dt);                             // ... and the chase camera replaces the overhead one
  aim();
  tod && tod.update(dt);
  G.city.update(dt);
  G.trains && G.trains.update(dt);
  G.harbor && G.harbor.update(dt);
  G.petco && G.petco.update(dt);
  G.concert && G.concert.update(dt);
  G.court && G.court.update(dt);
  G.gangs && G.gangs.update(dt);
  G.gore && G.gore.update(dt);
  signs && signs.update();
  ambience && ambience.update(dt);
  updateBoats(dt);
  G.roles && G.roles.update(dt);
  G.agents.update(dt);
  G.chaos.update(dt);
  G.responders.update(dt);
  G.station && G.station.update();
  G.playa && G.playa.update(dt);
  G.pets && G.pets.update(dt);
  G.sandiego && G.sandiego.update();
  G.chains && G.chains.update();
  G.vegas && G.vegas.update(dt);
  G.london && G.london.update(dt);
  G.greenland && G.greenland.update(dt);
  G.cairo && G.cairo.update(dt);
  G.construction && G.construction.update(dt);
  G.world.update(dt);
  G.director && G.director.update(dt);
  G.sky && G.sky.update(dt);
  G.news && G.news.update(dt);
  updatePlacing(dt);
  G.weapons.update(dt, flying ? NO_INPUT : input);
  if (flying) G.weapons.reticle.visible = G.weapons.reticleDot.visible = false;
  input.pressed = false;
  G.buildings.update(dt);
  G.fx.update(dt, camera, renderer);
  G.ground.update(dt);
  if (water) water.timeU.value = G.time;
  gatherWakes();
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

// ---------- WORLD menu: pick something, then click the map to place it ----------
const worldMenu = $('#worldMenu'), placeHint = $('#placeHint');
worldMenu.innerHTML = '<div class="wm-head"><b>WORLD</b><button class="wm-close" aria-label="Close">✕</button></div>' + MENU.map((c) => `<div class="col"><h4>${c.cat}</h4>${c.items.map(([id, label, now]) => `<button data-id="${id}" data-label="${label}"${now ? ' data-now="1"' : ''}>${label}</button>`).join('')}</div>`).join('');
$('#worldBtn').addEventListener('click', () => { const open = worldMenu.classList.toggle('open'); $('#worldBtn').classList.toggle('on', open || !!(G.world && G.world.armed)); });
worldMenu.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !G.world) return;
  if (b.classList.contains('wm-close')) { worldMenu.classList.remove('open'); $('#worldBtn').classList.toggle('on', !!G.world.armed); return; }
  sfx.unlock();
  if (b.dataset.now) { G.world.place(b.dataset.id, { x: cam.x, y: 0, z: cam.z }); flashHint(b.dataset.label.toUpperCase()); worldMenu.classList.remove('open'); $('#worldBtn').classList.remove('on'); return; }
  G.world.armed = { id: b.dataset.id, label: b.dataset.label, n: 0 };
  worldMenu.querySelectorAll('button').forEach((x) => x.classList.toggle('armed', x === b));
  worldMenu.classList.remove('open'); $('#worldBtn').classList.add('on');
  document.querySelectorAll('#weapons .w').forEach((el) => el.classList.remove('on'));
  placeHint.textContent = armedHint(); placeHint.classList.add('show');
});
function disarm() {
  placeHold = false;
  if (G.world) G.world.armed = null;
  placeHint.classList.remove('show'); $('#worldBtn').classList.remove('on');
  worldMenu.querySelectorAll('button').forEach((x) => x.classList.remove('armed'));
  if (G.weapons) document.querySelectorAll('#weapons .w').forEach((el) => el.classList.toggle('on', +el.dataset.w === G.weapons.cur));
}
// the chosen item stays selected: click to place one, hold (and drag) to keep placing, until a weapon is picked
const REPEAT = (id) => (/^(civilian|worker|security|gang|police|firefighter|paramedic)$/.test(id) ? 0.16 : id.startsWith('v-') ? 0.45 : id === 'w-lightning' ? 0.35 : 0.6);
let placeHold = false, placeT = 0;
function armedHint(extra = '') {
  const it = G.world.armed;
  return `PLACING ${it.label.toUpperCase()}${it.n ? ` ×${it.n}` : ''}${extra} — ${TOUCH ? 'TAP OR HOLD THE MAP · PICK A WEAPON TO STOP' : 'CLICK OR HOLD · 1–5 / ESC / RIGHT-CLICK FOR WEAPONS'}`;
}
function placeArmed() {
  const it = G.world.armed, a = G.weapons.aim;
  if (!it || !a) return;
  const ok = G.world.place(it.id, a.point);
  if (ok) it.n++;
  placeHint.textContent = armedHint(ok ? '' : ' (NOTHING FREE TO PLACE HERE)');
}
function startPlacing() { placeArmed(); placeHold = true; placeT = REPEAT(G.world.armed.id); }
function updatePlacing(dt) {
  if (!placeHold || !G.world || !G.world.armed) return;
  if ((placeT -= dt) <= 0) { placeArmed(); placeT = REPEAT(G.world.armed.id); }
}
let hintT = 0;
function flashHint(text) { placeHint.textContent = text; placeHint.classList.add('show'); clearTimeout(hintT); hintT = setTimeout(() => { if (!G.world || !G.world.armed) placeHint.classList.remove('show'); }, 1400); }

// ---------- input ----------
window.addEventListener('keydown', (e) => {
  if (settingsOpen) { if (e.code === 'Escape') closeSettings(); return; }
  if (rick && rick.key(e, true)) return;                        // flying the ship: it takes the keys it uses
  keys[e.code] = true;
  if (!running) return;
  if (e.code >= 'Digit1' && e.code <= 'Digit5') selectWeapon(+e.code.slice(5) - 1);
  if (e.code === 'Escape') { if (G.world && G.world.armed) { disarm(); return; } if (worldMenu.classList.contains('open')) { worldMenu.classList.remove('open'); $('#worldBtn').classList.remove('on'); return; } location.reload(); }
  if (e.code === 'KeyT') { tod.cycle(makeEnv); setTodButtons(); }
  if (e.code === 'KeyV') resetView();
  if (e.code === 'KeyM') { const m = sfx.toggleMute(); $('#mute').textContent = m ? 'SOUND OFF' : 'SOUND ON'; }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (rick) rick.key(e, false); });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.down = false; });
canvasEl.addEventListener('mousemove', (e) => {
  input.mx = e.clientX; input.my = e.clientY;
  if (input.down && e.pointerType !== 'touch' && !(e.buttons & 1) && !touch) input.down = false; // released outside the window
});
document.addEventListener('mouseleave', () => { if (!touch) input.down = false; });
canvasEl.addEventListener('mousedown', (e) => {
  if (TOUCH && !matchMedia('(any-pointer: fine)').matches) return;   // touch-only device: taps go through the touch code, not these copies
  if (e.button !== 0) return;
  sfx.unlock();
  if (rick && rick.active) return;                              // the ship has its own guns
  if (G.world && G.world.armed) { startPlacing(); return; }      // placing from the WORLD menu, not firing
  input.down = true; input.pressed = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) { input.down = false; placeHold = false; } });
// middle-mouse drag: tilt the view up/down and turn it left/right
let midDrag = null;
canvasEl.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); midDrag = { x: e.clientX, y: e.clientY }; } });
window.addEventListener('mousemove', (e) => {
  if (!midDrag) return;
  cam.tiltT = clamp(cam.tiltT + (e.clientY - midDrag.y) * 0.004, -1.1, 0.5);
  cam.yawT += (e.clientX - midDrag.x) * 0.004;
  midDrag = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mouseup', (e) => { if (e.button === 1) midDrag = null; });
// back to the normal view: locked angle, map heading, usual zoom
function resetView() { cam.tiltT = 0; cam.yawT = cam.yaw0; cam.distT = 92; }
$('#resetView').addEventListener('click', resetView);
// the tilt slider on the right edge (drag it; it follows R / F and middle-drag too)
const TILT_MIN = -1.1, TILT_MAX = 0.5, tiltEl = $('#tiltCtl'), tiltThumb = tiltEl.querySelector('.thumb');
tiltEl.querySelector('.tick').style.top = `${(0 - TILT_MIN) / (TILT_MAX - TILT_MIN) * 100}%`;
let tiltDrag = false;
const tiltFrom = (e) => { const r = tiltEl.getBoundingClientRect(); cam.tiltT = clamp(TILT_MIN + (e.clientY - r.top) / r.height * (TILT_MAX - TILT_MIN), TILT_MIN, TILT_MAX); };
tiltEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); tiltDrag = true; tiltEl.classList.add('drag'); tiltEl.setPointerCapture(e.pointerId); tiltFrom(e); });
tiltEl.addEventListener('pointermove', (e) => { if (tiltDrag) tiltFrom(e); });
tiltEl.addEventListener('pointerup', () => { tiltDrag = false; tiltEl.classList.remove('drag'); });
tiltEl.addEventListener('dblclick', () => { cam.tiltT = 0; });
function syncTilt() { tiltThumb.style.top = `${(cam.tiltT - TILT_MIN) / (TILT_MAX - TILT_MIN) * 100}%`; }
canvasEl.addEventListener('contextmenu', (e) => { e.preventDefault(); if (G.world && G.world.armed) disarm(); });
canvasEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (rick && rick.active) { rick.wheel(e); return; }
  const k = 0.0012 * settings.zoomSpeed / 100 * (settings.invertZoom ? -1 : 1);
  cam.distT = clamp(cam.distT * Math.exp(e.deltaY * k), cam.minD, cam.maxD);
}, { passive: false });
document.querySelectorAll('#weapons .w').forEach((el) => el.addEventListener('click', () => selectWeapon(+el.dataset.w)));
function setTodButtons() { document.querySelectorAll('#tod .t').forEach((el) => el.classList.toggle('on', tod && el.dataset.t === tod.mode)); if (tod) $('#todCycle').dataset.t = tod.mode; }
document.querySelectorAll('#tod .t').forEach((el) => el.addEventListener('click', () => { tod.set(el.dataset.t, makeEnv); setTodButtons(); }));
$('#mute').addEventListener('click', () => { const m = sfx.toggleMute(); $('#mute .tx').textContent = m ? 'SOUND OFF' : 'SOUND ON'; $('#mute').classList.toggle('off', m); });
// touch: one button steps through day, sunset and night; the back button returns to the city menu (desktop: Esc)
$('#todCycle').addEventListener('click', () => { const T = ['day', 'sunset', 'night']; tod.set(T[(T.indexOf(tod.mode) + 1) % 3], makeEnv); setTodButtons(); });
$('#backBtn').addEventListener('click', () => { const q = new URLSearchParams(location.search); q.delete('map'); location.replace(location.pathname + (q.toString() ? '?' + q : '')); });

document.querySelectorAll('#menu button[data-map]').forEach((btn) => btn.addEventListener('click', () => {
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
    if (!TOUCH) rick = new RickMode(scene, camera, post, cam, renderer);   // the RICK & MORTY button (desktop)
    last = performance.now();
    running = true;
    if (window.__twDive) { cam.dist = Math.min(cam.maxD * 1.25, cam.distT * 2.4); cam.intro = 2.2; }   // the descent from the globe carries on
    document.dispatchEvent(new Event('tw:start'));
  }, 60);
}));

initMenu();                                                    // the title screen: the interactive Earth

// allow ?map=downtown for quick testing
const qp = new URLSearchParams(location.search).get('map');
if (qp && MAPS[qp]) document.querySelector(`#menu button[data-map="${qp}"]`).click();

// ---------- settings ----------
let settingsOpen = false;
const settingsRoot = $('#settings');
function openSettings() {
  settingsOpen = true;
  input.down = false;
  for (const k in keys) keys[k] = false;
  buildSettingsPanel(settingsRoot, { onClose: closeSettings });
  settingsRoot.style.display = 'flex';
}
function closeSettings() { settingsOpen = false; settingsRoot.style.display = 'none'; }
document.querySelectorAll('.open-settings').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openSettings(); }));
settingsRoot.addEventListener('mousedown', (e) => { if (e.target === settingsRoot) closeSettings(); });
let lastQuality = null;
onSettingsChange((s) => {
  sfx.setVolumes({ master: s.master / 100, sfx: s.sfx / 100, ambience: s.ambience / 100, voices: s.voices / 100, music: s.music / 100 });
  post.final.uniforms.grain.value = s.grain / 100;
  if (s.quality !== lastQuality) {
    lastQuality = s.quality;
    // Retina screens at full density cost ~4x the pixels; the tilt-shift hides the difference, so cap it
    PR = TOUCH ? ({ low: 1, medium: Math.min(DPR, 1.35), high: DPR }[s.quality] || 1)       // small screens: full-res is cheap, soft looks worse
      : ({ low: 0.75, medium: 1, high: Math.min(DPR, 1.25) }[s.quality] || Math.min(DPR, 1.25));
    const ms = { low: 1024, medium: 2048, high: 4096 }[s.quality] || 4096;
    if (sun.shadow.mapSize.x !== ms) {
      sun.shadow.mapSize.set(ms, ms);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    resize();
  }
});

// ---------- touch: drag to move, pinch to zoom, tap / hold to fire ----------
let touch = null;
// ---------- one-finger drag: moves are queued and eased in by updateCamera, so the view glides instead of jumping ----------
const drag = { x: 0, z: 0, vx: 0, vz: 0 };
const pinchDist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
const pinchAng = (ts) => Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX);
canvasEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  sfx.unlock();
  const ts = e.targetTouches;                                  // only fingers that landed on the map, never ones on a button
  if (ts.length === 1) {
    const t = ts[0];
    input.mx = t.clientX; input.my = t.clientY;
    touch = { x: t.clientX, y: t.clientY, moved: false, firing: false, t: performance.now() };
    drag.vx = drag.vz = 0;                                     // a new touch catches the glide
    touch.hold = setTimeout(() => { if (!touch || touch.moved || touch.pinch) return; if (G.world && G.world.armed) { touch.placing = true; startPlacing(); } else { touch.firing = true; input.down = true; input.pressed = true; } }, 220);
  } else if (ts.length === 2) {
    if (touch) clearTimeout(touch.hold);
    input.down = false;
    // two fingers: pinch to zoom, twist to turn the view, slide up/down together to tilt toward the horizon
    touch = { pinch: pinchDist(ts), d0: cam.distT, a0: pinchAng(ts), yaw0: cam.yawT, y0: (ts[0].clientY + ts[1].clientY) / 2, tilt0: cam.tiltT };
  }
}, { passive: false });
canvasEl.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touch) return;
  const ts = e.targetTouches;
  if (touch.pinch && ts.length === 2) {
    cam.distT = clamp(touch.d0 * touch.pinch / pinchDist(ts), cam.minD, cam.maxD);
    let da = pinchAng(ts) - touch.a0; da = Math.atan2(Math.sin(da), Math.cos(da));
    cam.yawT = touch.yaw0 + da;
    cam.tiltT = clamp(touch.tilt0 + ((ts[0].clientY + ts[1].clientY) / 2 - touch.y0) * 0.004, -1.1, 0.5);
    return;
  }
  if (touch.pinch || !ts.length) return;                     // lifting one finger of a pinch doesn't turn into a drag
  const t = ts[0];
  input.mx = t.clientX; input.my = t.clientY;
  if (touch.firing) return;
  const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
  // the drag starts from where it passed the tap threshold, so the first move doesn't jump by the slack
  if (!touch.moved) { if (Math.hypot(dx, dy) < 10) return; touch.moved = true; touch.x = t.clientX; touch.y = t.clientY; touch.t = performance.now(); return; }
  const k = cam.dist * 0.0016 * settings.moveSpeed / 100;
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const wx = (-dx * rx + dy * fx) * k, wz = (-dx * rz + dy * fz) * k;
  drag.x += wx; drag.z += wz;
  // remember how fast the finger was going (for the glide on release), smoothed so one twitchy event doesn't fling it
  const now = performance.now(), sdt = Math.max(0.008, (now - touch.t) / 1000);
  touch.gx = (touch.gx || 0) * 0.6 + (wx / sdt) * 0.4; touch.gz = (touch.gz || 0) * 0.6 + (wz / sdt) * 0.4;
  touch.x = t.clientX; touch.y = t.clientY; touch.t = now;
}, { passive: false });
canvasEl.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!touch || e.targetTouches.length) return;
  clearTimeout(touch.hold);
  if (touch.placing) placeHold = false;
  else if (touch.firing) input.down = false;
  else if (touch.moved && !touch.pinch) {
    // a gentle glide if the finger was still moving when it lifted (none if it paused first)
    const still = performance.now() - touch.t > 90, cap = cam.dist * 0.9;
    if (!still) { drag.vx = clamp(touch.gx || 0, -cap, cap) * 0.35; drag.vz = clamp(touch.gz || 0, -cap, cap) * 0.35; }
  } else if (!touch.moved && !touch.pinch) {
    const ct = e.changedTouches[0], under = ct && document.elementFromPoint(ct.clientX, ct.clientY);
    if (under === canvasEl) { if (G.world && G.world.armed) placeArmed(); else { input.down = true; input.pressed = true; setTimeout(() => { input.down = false; }, 80); } }
  }
  touch = null;
}, { passive: false });

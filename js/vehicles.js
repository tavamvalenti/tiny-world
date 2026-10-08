// VEHICLES: three more things to fly round Tiny World, next to Rick's ship in the bottom bar.
//   - the armed drone: a heavy black quadcopter with a machine gun slung under it. Fast, precise, and fragile: it
//     blows up the moment it touches anything (a big blast that hurts whatever is near), then a fresh one drops in
//     high above. Damage done stays done; the map is never reset.
//   - the powered paraglider: the dad in his white T-shirt in a paramotor trike under a big white wing. Always flying
//     forward, it banks to turn, climbs on the throttle and glides when you let off; lands and takes off on its
//     wheels. Rapid fireballs, and a bomb-power firework.
//   - the jetpack: a regular guy with a red twin-tank jetpack. Hovers, lifts straight up, strafes, bursts; the most
//     agile of the three. A machine gun and a grenade launcher.
// Everything they do goes through Tiny World's own systems: damageSphere / blast / bombImpact / carExplode / the fx.
import * as THREE from 'three';
import { G, clamp, rand, blast } from './core.js';
import { sfx } from './audio.js';
import { CartoonCharacter } from './rickship.js';

const S = 0.42;                                     // the characters' scale (as Rick and Morty: people on the street)
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);

const KINDS = {
  drone: { name: 'Armed Drone', sub: 'Machine gun · explodes on contact', keys: [['Mouse', 'aim · point up or down to climb or dive'], ['W S', 'fly where you point'], ['A D', 'strafe'], ['Shift', 'boost'], ['Click / Space', 'machine gun'], ['V', 'camera'], ['Esc', 'leave']] },
  glider: { name: 'Paraglider', sub: 'Fireballs · bomb-power firework', keys: [['Mouse', 'aim · point up or down to climb or dive'], ['A D', 'bank / turn'], ['W', 'throttle'], ['S', 'idle'], ['Shift', 'speed bar'], ['Click / Space', 'fireballs'], ['Right click / G', 'firework'], ['V', 'camera'], ['Esc', 'leave']] },
  jetpack: { name: 'Jetpack', sub: 'Machine gun · grenade launcher', keys: [['Mouse', 'aim · point up or down to climb or dive'], ['W S', 'fly where you point'], ['A D', 'strafe'], ['Shift', 'thrust burst'], ['Click / Space', 'machine gun'], ['Right click / G', 'grenade'], ['V', 'camera'], ['Esc', 'leave']] },
};

const CSS = `
#vehBtn{position:relative;display:flex;align-items:center;font:800 11px Inter;letter-spacing:.2em;color:#fff1dc;padding:8px 16px 8px 54px;border-radius:999px;margin:-3px 0 -3px 10px;cursor:pointer;user-select:none;
  border:1px solid rgba(255,180,90,.6);background:linear-gradient(90deg,rgba(190,90,20,.6),rgba(40,26,16,.55));backdrop-filter:blur(8px);
  box-shadow:0 0 16px -3px rgba(255,150,60,.75),inset 0 0 12px rgba(255,190,110,.22);text-shadow:0 0 8px rgba(255,180,100,.8);transition:transform .25s cubic-bezier(.2,1.4,.4,1),filter .2s,box-shadow .3s}
#vehBtn:hover,#vehBtn.open{transform:translateY(-3px);filter:brightness(1.15);box-shadow:0 0 28px 0 rgba(255,150,60,.9),inset 0 0 14px rgba(255,190,110,.3)}
#vehBtn.on{border-color:#ffe1b8;box-shadow:0 0 26px 2px rgba(255,150,60,.95)}
#vehBtn .vh-icon{position:absolute;left:5px;bottom:-4px;width:44px;height:44px;pointer-events:none;transition:transform .35s cubic-bezier(.2,1.4,.4,1)}
#vehBtn .vh-glow{position:absolute;inset:4px;border-radius:50%;background:radial-gradient(circle,rgba(255,220,160,.9),rgba(255,140,40,.35) 45%,transparent 70%);animation:vhPulse 1.8s ease-in-out infinite}
#vehBtn .vh-rotor{position:absolute;inset:3px;animation:vhSpin .5s linear infinite;opacity:.85}
#vehBtn .vh-rotor i{position:absolute;left:50%;top:50%;width:36px;height:3px;margin:-1.5px 0 0 -18px;border-radius:2px;background:linear-gradient(90deg,transparent,#ffe6c4 30%,#fff 50%,#ffe6c4 70%,transparent)}
#vehBtn .vh-rotor i+i{transform:rotate(90deg)}
#vehBtn .vh-drone{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-11px 0 0 -13px;filter:drop-shadow(0 0 3px rgba(255,160,70,.9));transition:transform .45s cubic-bezier(.2,1.5,.4,1)}
#vehBtn:hover .vh-icon{transform:scale(1.15)}
#vehBtn:hover .vh-drone{transform:translateY(-5px) rotate(-6deg)}
#vehBtn:hover .vh-rotor{animation-duration:.18s}
@keyframes vhSpin{to{transform:rotate(360deg)}}
@keyframes vhPulse{50%{transform:scale(1.15);opacity:.75}}
#vehMenu{position:absolute;bottom:calc(100% + 14px);left:0;display:none;flex-direction:column;gap:6px;padding:8px;border-radius:14px;min-width:250px;
  background:rgba(22,16,12,.86);border:1px solid rgba(255,180,90,.35);backdrop-filter:blur(12px);box-shadow:0 18px 40px -12px rgba(0,0,0,.7),0 0 24px -8px rgba(255,150,60,.6);cursor:default}
#vehBtn.open #vehMenu{display:flex;animation:vhUp .22s cubic-bezier(.2,.9,.3,1)}
@keyframes vhUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
#vehMenu .vh-item{display:grid;grid-template-columns:40px 1fr;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .2s,transform .2s;letter-spacing:.12em}
#vehMenu .vh-item:hover{background:rgba(255,150,60,.18);transform:translateX(3px)}
#vehMenu .vh-item.on{background:rgba(255,150,60,.3)}
#vehMenu .vh-item svg{width:40px;height:30px}
#vehMenu .vh-item b{display:block;font:800 11px Inter;color:#fff1dc}
#vehMenu .vh-item small{display:block;margin-top:3px;font:500 9.5px Inter;letter-spacing:.04em;color:rgba(255,230,200,.6);text-transform:none;text-shadow:none}
html.touch #vehBtn{display:none}
body.veh-on #weapons .w, body.veh-on #weapons .sep, body.veh-on #worldBtn, body.veh-on #tiltCtl, body.veh-on #help, body.veh-on #placeHint, body.veh-on #worldMenu{display:none!important}
#vehHud{position:absolute;inset:0;pointer-events:none;display:none;font-family:Inter,system-ui,sans-serif}
body.veh-on #vehHud{display:block}
/* crosshairs: a classic four-line cross with a gap that opens while firing, one look per vehicle */
#vehHud .vh-ret{position:absolute;left:50%;top:46%;width:0;height:0;--gap:6px;--len:9px;--th:2px;--col:#fff;transition:--gap .1s}
#vehHud .vh-ret i{position:absolute;background:var(--col);box-shadow:0 0 0 1px rgba(0,0,0,.55);transition:transform .08s ease-out}
#vehHud .vh-ret .t,#vehHud .vh-ret .b{width:var(--th);height:var(--len);left:calc(var(--th) / -2)}
#vehHud .vh-ret .l,#vehHud .vh-ret .r{height:var(--th);width:var(--len);top:calc(var(--th) / -2)}
#vehHud .vh-ret .t{bottom:var(--gap)} #vehHud .vh-ret .b{top:var(--gap)} #vehHud .vh-ret .l{right:var(--gap)} #vehHud .vh-ret .r{left:var(--gap)}
#vehHud .vh-ret .c{width:3px;height:3px;left:-1.5px;top:-1.5px;border-radius:50%;display:none}
/* the drone: thin white lines, a centre dot and corner ticks like a gimbal camera's targeting box */
#vehHud .vh-ret.drone{--gap:5px;--len:10px;--th:1.5px;--col:#f2f6f8}
#vehHud .vh-ret.drone .c{display:block}
#vehHud .vh-ret.drone .k{display:block;position:absolute;width:7px;height:7px;border:1.5px solid rgba(242,246,248,.8);background:none;box-shadow:none}
#vehHud .vh-ret .k{display:none}
#vehHud .vh-ret.drone .k1{left:-20px;top:-20px;border-right:0;border-bottom:0} #vehHud .vh-ret.drone .k2{right:-20px;top:-20px;border-left:0;border-bottom:0}
#vehHud .vh-ret.drone .k3{left:-20px;bottom:-20px;border-right:0;border-top:0} #vehHud .vh-ret.drone .k4{right:-20px;bottom:-20px;border-left:0;border-top:0}
/* the jetpack: a heavier assault-rifle cross, wider gap, warm white, no dot */
#vehHud .vh-ret.jetpack{--gap:8px;--len:11px;--th:2.5px;--col:#fff4e2}
/* the paraglider: the fireball launcher's sight, flame-orange, with a dot and a short drop line under it */
#vehHud .vh-ret.glider{--gap:7px;--len:8px;--th:2px;--col:#ffb04a}
#vehHud .vh-ret.glider .c{display:block;width:4px;height:4px;left:-2px;top:-2px;background:#ffe2b0}
#vehHud .vh-ret.glider .b{height:16px}
#vehHud .vh-cd{position:absolute;left:50%;top:46%;width:64px;height:4px;margin:24px 0 0 -32px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden}
#vehHud .vh-cd i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ffb35a,#ff5a3c)}
#vehHud .vh-title{font:800 12px Inter;letter-spacing:.24em;color:#ffd9a8;text-shadow:0 1px 4px rgba(0,0,0,.8);margin-bottom:4px}
#vehHud .vh-keys{position:absolute;left:16px;bottom:calc(4.2vh + 60px);display:flex;flex-direction:column;gap:5px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,240,225,.75);text-shadow:0 1px 3px rgba(0,0,0,.8)}
#vehHud .key{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:16px;padding:0 4px;margin-right:6px;border-radius:3px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);font:600 9px Inter;color:#fff;letter-spacing:0}
#vehHud .vh-msg{position:absolute;left:50%;top:30%;transform:translateX(-50%);font:800 13px Inter;letter-spacing:.3em;color:#ffcf8a;text-shadow:0 0 12px rgba(255,120,40,.9);opacity:0;transition:opacity .3s}
#vehHud .vh-msg.show{opacity:1}
#vehHud .vh-tip{position:absolute;left:50%;top:22%;transform:translateX(-50%);font:600 11px Inter;letter-spacing:.2em;color:#fff;background:rgba(0,0,0,.45);padding:8px 14px;border-radius:999px;transition:opacity .3s}
`;

const ICONS = {
  drone: '<svg viewBox="0 0 40 30"><g fill="none" stroke="#ffd6a0" stroke-width="1.6" stroke-linecap="round"><path d="M8 9h8M24 9h8M12 9l4 6M28 9l-4 6"/><ellipse cx="12" cy="8" rx="7" ry="1.6"/><ellipse cx="28" cy="8" rx="7" ry="1.6"/></g><rect x="14" y="13" width="12" height="6" rx="2" fill="#2a2a2e" stroke="#ffd6a0" stroke-width="1.2"/><path d="M20 19v4h7" stroke="#ff9a4a" stroke-width="2" fill="none"/></svg>',
  glider: '<svg viewBox="0 0 40 30"><path d="M4 12C10 2 30 2 36 12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M6 12l13 11M34 12L21 23M14 6l5 17M26 6l-5 17" stroke="#ffd6a0" stroke-width=".7"/><circle cx="20" cy="24" r="3.4" fill="none" stroke="#ffd6a0" stroke-width="1.2"/><circle cx="20" cy="24" r="1.3" fill="#fff"/></svg>',
  jetpack: '<svg viewBox="0 0 40 30"><rect x="9" y="6" width="6" height="15" rx="3" fill="#e0342a"/><rect x="25" y="6" width="6" height="15" rx="3" fill="#e0342a"/><rect x="15" y="8" width="10" height="13" rx="2" fill="#f2a52a"/><path d="M12 6c0-5 8-5 8 0M28 6c0-5-8-5-8 0" fill="none" stroke="#8a8a8a" stroke-width="1.2"/><path d="M10 21l2 6 2-6M26 21l2 6 2-6" fill="#ffb84a"/></svg>',
};

// a small engine voice made in Web Audio (no recordings exist for these yet): a buzz of props, a two-stroke, a roar
class EngineSynth {
  constructor(kind) { this.kind = kind; }
  start() {
    if (this.ctx || !sfx.ctx) return;
    const ctx = (this.ctx = sfx.ctx), out = (this.out = ctx.createGain());
    out.gain.value = 0; out.connect(sfx.bus || ctx.destination);
    const lp = (this.lp = ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
    const osc = (this.osc = ctx.createOscillator()); osc.type = this.kind === 'jetpack' ? 'triangle' : 'sawtooth'; osc.frequency.value = 80;
    const og = ctx.createGain(); og.gain.value = this.kind === 'jetpack' ? 0.15 : 0.35; osc.connect(og); og.connect(lp); osc.start();
    // noise for the rush of air / the jet
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = (this.noise = ctx.createBufferSource()); src.buffer = buf; src.loop = true;
    const bp = (this.bp = ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = this.kind === 'jetpack' ? 500 : 1400; bp.Q.value = 0.7;
    const ng = (this.ng = ctx.createGain()); ng.gain.value = this.kind === 'jetpack' ? 0.9 : 0.25; src.connect(bp); bp.connect(ng); ng.connect(out); src.start();
    // the two-stroke's chop
    if (this.kind === 'glider') { const lfo = (this.lfo = ctx.createOscillator()), lg = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(out.gain); lfo.start(); }
  }
  set(level, pitch) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, base = this.kind === 'drone' ? 150 : this.kind === 'glider' ? 62 : 55;
    this.osc.frequency.setTargetAtTime(base * (1 + pitch * 0.9), t, 0.08);
    this.lp.frequency.setTargetAtTime(500 + pitch * 1800, t, 0.1);
    if (this.kind === 'jetpack') this.bp.frequency.setTargetAtTime(350 + pitch * 900, t, 0.1);
    this.out.gain.setTargetAtTime(sfx.muted ? 0 : level * 0.16, t, 0.1);
  }
  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; this.out.gain.setTargetAtTime(0, t, 0.05);
    const nodes = [this.osc, this.noise, this.lfo].filter(Boolean);
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } } this.out.disconnect(); }, 300);
    this.ctx = null;
  }
}

export class VehicleMode {
  constructor(scene, camera, post, cam, renderer) {
    this.scene = scene; this.camera = camera; this.post = post; this.cam = cam; this.canvas = renderer.domElement;
    this.active = false; this.kind = null; this.keys = {}; this.zoom = 1;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.aim = -0.15; this.look = 0;
    this.camPos = new THREE.Vector3(); this.camInit = false; this.fov = 62; this.shake = 0;
    this.shots = []; this.bombs = []; this.flashes = [];
    G.veh = this;
    if (!document.getElementById('vehCss')) { const st = document.createElement('style'); st.id = 'vehCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.buildUi(); this.bindInput();
  }

  // ---------------- the button, its menu and the in-flight HUD
  buildUi() {
    const bar = document.getElementById('weapons');
    this.btn = document.createElement('span'); this.btn.id = 'vehBtn'; this.btn.title = 'Fly a drone, a paraglider or a jetpack';
    this.btn.innerHTML = `<span class="vh-icon"><i class="vh-glow"></i><span class="vh-rotor"><i></i><i></i></span><svg class="vh-drone" viewBox="0 0 26 26"><rect x="8" y="10" width="10" height="6" rx="2" fill="#1c1c20" stroke="#ffd6a0" stroke-width="1"/><path d="M8 11L3 7M18 11l5-4M8 15l-5 4M18 15l5 4" stroke="#ffd6a0" stroke-width="1.4"/><path d="M13 16v4h5" stroke="#ff9a4a" stroke-width="1.6" fill="none"/></svg></span>VEHICLES
      <div id="vehMenu">${Object.entries(KINDS).map(([k, v]) => `<div class="vh-item" data-k="${k}">${ICONS[k]}<span><b>${v.name.toUpperCase()}</b><small>${v.sub}</small></span></div>`).join('')}</div>`;
    const rickBtn = document.getElementById('rickBtn');
    if (rickBtn && rickBtn.parentNode === bar) rickBtn.after(this.btn); else bar.appendChild(this.btn);
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation(); sfx.unlock();
      const item = e.target.closest('.vh-item');
      if (item) { this.btn.classList.remove('open'); if (this.active && this.kind === item.dataset.k) this.exit(); else this.enter(item.dataset.k); return; }
      if (this.active) { this.exit(); return; }
      this.btn.classList.toggle('open');
    });
    document.addEventListener('click', (e) => { if (!this.btn.contains(e.target)) this.btn.classList.remove('open'); });
    const hud = document.getElementById('hud');
    this.hud = document.createElement('div'); this.hud.id = 'vehHud';
    this.hud.innerHTML = '<div class="vh-ret"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="c"></i><i class="k k1"></i><i class="k k2"></i><i class="k k3"></i><i class="k k4"></i></div><div class="vh-cd"><i></i></div><div class="vh-keys"></div><div class="vh-msg"></div><div class="vh-tip">Click to grab the mouse and aim</div>';
    hud.appendChild(this.hud);
    this.ret = this.hud.querySelector('.vh-ret'); this.spread = 0; this.cdEl = this.hud.querySelector('.vh-cd'); this.cdBar = this.cdEl.querySelector('i'); this.msgEl = this.hud.querySelector('.vh-msg'); this.tip = this.hud.querySelector('.vh-tip');
  }
  bindInput() {
    const canvas = this.canvas;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (document.pointerLockElement !== canvas) { this.lock(); return; }
      if (e.button === 0) this.keys.Mouse0 = true;
      if (e.button === 2) this.keys.Mouse2 = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.keys.Mouse0 = false; if (e.button === 2) this.keys.Mouse2 = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      this.look += e.movementX * 0.0026;
      this.aim = clamp(this.aim - e.movementY * 0.0022, -1.2, 0.95);
    });
    document.addEventListener('pointerlockchange', () => { if (this.tip) this.tip.style.opacity = document.pointerLockElement === canvas || !this.active ? 0 : 1; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }
  lock() { try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => undefined); } catch { /* the tip stays up */ } }
  // Tiny World's key handler asks first while a vehicle is up; returns true when the vehicle used the key
  key(e, down) {
    if (!this.active) return false;
    const c = e.code;
    if (c === 'KeyT' || c === 'KeyM' || /^F\d+$/.test(c)) return false;
    if (down && !e.repeat) {
      if (c === 'Escape') { this.exit(); return true; }
      if (c === 'KeyV') this.zoom = this.zoom > 1.2 ? 0.75 : this.zoom < 0.9 ? 1 : 1.5;
    }
    this.keys[c] = down;
    e.preventDefault();
    return true;
  }
  wheel(e) { this.zoom = clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.1), 0.55, 2.4); }

  enter(kind) {
    if (!G.buildings) return;
    if (G.rick && G.rick.active) G.rick.exit();
    if (this.active) this.exit(true);
    sfx.unlock();
    this.kind = kind; this.active = true;
    this.buildFx();
    this.model = kind === 'drone' ? this.buildDrone() : kind === 'glider' ? this.buildGlider() : this.buildJetpack();
    this.scene.add(this.model.root, this.fxGroup);
    // appear above where the view was looking, facing the way it faced
    const T = this.cam, B = G.buildings, ground = B.surfaceAt(T.x, T.z, 999).y;
    this.yaw = T.yaw; this.look = 0; this.aim = 0;
    this.pos.set(T.x, kind === 'jetpack' ? ground + 0.05 : Math.max(ground + (kind === 'drone' ? 18 : 14), 20), T.z);
    this.vel.set(0, 0, 0); this.dead = false; this.respawnT = 0; this.safeT = 1.2; this.fireCd = 0; this.secCd = 0; this.burstCd = 0; this.lost = 0; this.bank = 0;
    this.airspeed = kind === 'glider' ? 8 : 0; this.grounded = kind === 'jetpack';
    this.camInit = false; this.keys = {};
    this.engine = new EngineSynth(kind); this.engine.start();
    document.body.classList.add('veh-on'); this.btn.classList.add('on');
    this.hud.querySelector('.vh-keys').innerHTML = `<div class="vh-title">${KINDS[kind].name.toUpperCase()}</div>` + KINDS[kind].keys.map(([k, t]) => `<span>${k.split(' / ').map((x) => `<b class="key">${x}</b>`).join('')}${t}</span>`).join('');
    this.btn.querySelectorAll('.vh-item').forEach((el) => el.classList.toggle('on', el.dataset.k === kind));
    this.cdEl.style.display = kind === 'drone' ? 'none' : '';
    this.ret.className = 'vh-ret ' + kind;
    this.tip.style.opacity = 1;
    this.lock();
  }
  exit(switching = false) {
    if (!this.active) return;
    this.active = false;
    if (!switching && document.pointerLockElement) document.exitPointerLock();
    this.scene.remove(this.model.root, this.fxGroup);
    this.dispose(this.model.root);
    for (const b of this.bombs) this.fxGroup.remove(b.mesh);
    this.shots.length = 0; this.bombs.length = 0;
    for (const f of this.flashes) f.visible = false; this.flashes.length = 0;
    this.engine && this.engine.stop();
    this.keys = {};
    this.btn.querySelectorAll('.vh-item').forEach((el) => el.classList.remove('on'));
    this.msgEl.classList.remove('show');
    if (switching) return;
    document.body.classList.remove('veh-on'); this.btn.classList.remove('on');
    const C = this.cam;
    C.x = clamp(this.pos.x, C.xMin ?? -C.half, C.half); C.z = clamp(this.pos.z, C.zMin ?? -C.half, C.zMax ?? C.half);
    C.yaw = C.yawT = this.yaw; C.distT = 70; C.tiltT = 0;
  }
  dispose(root) { root.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); }); }

  // ---------------- shared effects: tracers, glows, projectiles
  buildFx() {
    if (this.fxGroup) return;
    this.fxGroup = new THREE.Group();
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,230,180,.9)'); r.addColorStop(0.55, 'rgba(255,140,40,.35)'); r.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.sprites = [];
    for (let i = 0; i < 96; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.visible = false; sp.renderOrder = 8; this.sprites.push(sp); this.fxGroup.add(sp); }
    // tracers: short bright streaks, instanced
    const tg = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
    this.tracers = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.1), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 160);
    this.tracers.frustumCulled = false; this.tracers.count = 0; this.fxGroup.add(this.tracers);
  }
  sprite() { return this.sprites.find((s) => !s.visible); }
  pop(p, size, life, color) {
    const sp = this.sprite(); if (!sp) return;
    sp.visible = true; sp.position.copy(p); sp.material.color.copy(color || new THREE.Color(1.6, 1.2, 0.6)); sp.material.opacity = 1;
    sp.userData = { t: 0, life, size, flash: true }; sp.scale.setScalar(size * 0.4); this.flashes.push(sp);
  }

  // the direction through the crosshair (from the last frame's camera): pointing steers up and down
  lookDir() {
    const cam = this.camera; cam.updateMatrixWorld();
    return new THREE.Vector3(0, 0.08, -1).unproject(cam).sub(cam.position).normalize();
  }
  // ---------------- per frame (before Tiny World's camera update)
  update(dt) {
    if (!this.active) return;
    this.safeT = Math.max(0, this.safeT - dt);
    const turn = this.look; this.look = 0;
    if (this.dead) this.updateDead(dt);
    else if (this.kind === 'drone') this.flyDrone(dt, turn);
    else if (this.kind === 'glider') this.flyGlider(dt, turn);
    else this.flyJetpack(dt, turn);
    this.keepInBounds();
    if (!this.dead) this.weapons(dt);
    this.updateShots(dt); this.updateBombs(dt); this.updateFlashes(dt);
    this.model.root.visible = !this.dead;
    this.model.update(dt);
    // everything that follows the camera (shadows, sound, crowd detail) follows the vehicle
    const C = this.cam; C.x = this.pos.x; C.z = this.pos.z; C.dist = C.distT = 26; C.ty = 0;
    // the cross opens up while the gun runs and closes again after
    this.spread = Math.max(0, this.spread - dt * 6);
    const base = { drone: 5, jetpack: 8, glider: 7 }[this.kind];
    this.ret.style.setProperty('--gap', `${base + this.spread * (this.kind === 'jetpack' ? 9 : 6)}px`);
    this.cdBar.style.width = `${(1 - clamp(this.secCd / (this.kind === 'glider' ? 2.4 : 0.7), 0, 1)) * 100}%`;
  }
  keepInBounds() {
    const Cm = this.cam, p = this.pos;
    const lo = { x: Math.min(-150, (Cm.xMin ?? -Cm.half) - 40), z: Math.min(-150, (Cm.zMin ?? -Cm.half) - 40) }, hi = { x: Math.max(150, (Cm.xMax ?? Cm.half) + 40), z: Math.max(150, (Cm.zMax ?? Cm.half) + 40) };
    for (const a of ['x', 'z']) if (p[a] < lo[a] || p[a] > hi[a]) { p[a] = clamp(p[a], lo[a], hi[a]); this.vel[a] *= -0.3; }
    if (p.y > 90) { p.y = 90; if (this.vel.y > 0) this.vel.y = 0; }
  }
  // the points of the vehicle that touch things: in its own frame, rotated by yaw only
  touching(points) {
    const B = G.buildings;
    for (const [x, y, z] of points) {
      const w = _v.set(x, y, z).applyAxisAngle(UP, this.yaw).add(this.pos);
      const floor = B.surfaceAt(w.x, w.z, w.y + 0.3).y;
      if (w.y < floor) return { w: w.clone(), pen: floor - w.y, n: new THREE.Vector3(0, 1, 0), ground: true };
      const cell = B.inside(w);
      if (cell) {
        const dx = w.x - cell.x, dy = w.y - cell.y, dz = w.z - cell.z, px = cell.hx - Math.abs(dx), py = cell.hy - Math.abs(dy), pz = cell.hz - Math.abs(dz), m = Math.min(px, py, pz);
        return { w: w.clone(), pen: m, cell, n: px === m ? new THREE.Vector3(Math.sign(dx), 0, 0) : py === m ? new THREE.Vector3(0, Math.sign(dy), 0) : new THREE.Vector3(0, 0, Math.sign(dz)) };
      }
    }
    return null;
  }
  carNear(r, h) {
    const A = G.agents; if (!A) return null;
    for (const c of A.cars) { if (c.state === 'hidden') continue; if (Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < r && this.pos.y < c.pos.y + h && this.pos.y > c.pos.y - 0.2) return c; }
    return null;
  }

  // ---------------- the drone: a precise hover platform; touching anything sets it off
  flyDrone(dt, turn) {
    const k = this.keys, boost = k.ShiftLeft || k.ShiftRight;
    this.yaw -= turn;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const vmax = boost ? 24 : 14, fw = _v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), rt = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // W flies straight down the crosshair (point down to dive, up to climb); A/D slide sideways; let go to hover
    const look = this.lookDir(), want = new THREE.Vector3().addScaledVector(look, f).addScaledVector(rt, s); if (want.lengthSq() > 1) want.normalize(); want.multiplyScalar(vmax); const u = want.y / vmax;
    this.vel.lerp(want, 1 - Math.exp(-dt * 2.6));
    this.pos.addScaledVector(this.vel, dt);
    // lean into the motion
    const lf = this.vel.dot(fw) / 24, ls = this.vel.dot(rt) / 24;
    this.model.tilt(-lf * 0.45, -ls * 0.45, this.yaw, this.aim);
    this.engine.set(1, clamp(this.vel.length() / 24 + Math.abs(u) * 0.2, 0, 1));
    // contact: a building, the ground, a roof, a car -> boom
    if (this.safeT > 0) return;
    const hit = this.touching([[0, -0.35, 0], [0.55, 0, 0.55], [-0.55, 0, 0.55], [0.55, 0, -0.55], [-0.55, 0, -0.55], [0, 0.05, -0.75], [0, -0.45, -0.3]]);
    if (hit || this.carNear(1.1, 0.9)) this.explodeDrone();
  }
  explodeDrone() {
    if (this.dead) return;                                  // one crash, one explosion, one respawn
    this.dead = true; this.respawnT = 2.2;
    const p = this.pos.clone(), B = G.buildings, fx = G.fx;
    G.weapons.bombImpact(p);                                 // Tiny World's bomb ...
    B.damageSphere(p.x, p.y, p.z, 5.5, 360, 1.0, 0.55);      // ... and a heavier punch round it
    fx.fireball(p.x, p.y + 0.5, p.z, 4.5, 0.9);
    for (let i = 0; i < 14; i++) fx.debris.spawn(p.x, p.y, p.z, new THREE.Vector3(rand(-8, 8), rand(2, 9), rand(-8, 8)), rand(0.08, 0.2), rand(0.03, 0.08), rand(0.1, 0.3), new THREE.Color(0.06, 0.06, 0.07));
    G.shake = Math.max(G.shake || 0, 0.9); this.shake = 1.4;
    this.vel.set(0, 0, 0); this.shots.length = 0;
    this.engine.set(0, 0);
    this.msgEl.textContent = 'DRONE DOWN — NEW DRONE INBOUND'; this.msgEl.classList.add('show');
  }
  updateDead(dt) {
    this.respawnT -= dt;
    if (this.respawnT > 0) return;
    // a fresh drone high over the wreck; the wreckage stays
    const B = G.buildings, ground = B.surfaceAt(this.pos.x, this.pos.z, 999).y;
    this.pos.y = Math.max(ground + 30, 40); this.vel.set(0, 0, 0);
    this.dead = false; this.safeT = 1.0; this.aim = -0.2;
    this.msgEl.classList.remove('show');
  }

  // ---------------- the paraglider: always flying, banks to turn, climbs on the throttle
  flyGlider(dt, turn) {
    const k = this.keys, B = G.buildings;
    const throttle = k.KeyW ? 1 : 0, idle = k.KeyS, bar = k.ShiftLeft || k.ShiftRight;
    const steer = clamp(((k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)) + turn * 6, -1, 1);
    this.lost = Math.max(0, this.lost - dt);
    // the wing banks (and swings the pilot under it) toward the turn; the turn follows the bank
    this.bank += ((steer * 0.55 * (this.lost > 0 ? 0.3 : 1)) - this.bank) * (1 - Math.exp(-dt * 2.2));
    const ground = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.5).y;
    this.grounded = this.pos.y <= ground + 0.06;
    if (!this.grounded) this.yaw -= this.bank * 1.25 * dt; else this.yaw -= steer * 0.9 * dt;
    const target = this.grounded ? (throttle ? 10 : 0) : bar ? 12.5 : 8.5;
    this.airspeed += (target - this.airspeed) * (1 - Math.exp(-dt * (this.grounded ? 0.8 : 1.4)));
    // up and down by pointing: nose the view up to climb (the throttle gives the power to climb hard), down to dive;
    // with the engine off it can only glide, slowly sinking
    const look = this.lookDir();
    let vy;
    if (this.grounded) vy = this.airspeed > 7 && throttle && look.y > -0.05 ? 3 : 0;   // rolls along, lifts off at speed
    else vy = clamp(look.y * this.airspeed * 1.1, -7, throttle ? 4.5 : idle ? -1.8 : 0.4) - (throttle ? 0 : 0.9) - (bar ? 0.4 : 0);
    if (this.lost > 0) vy = Math.min(vy, -3.5);
    const fw = _v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.vel.set(fw.x * this.airspeed, vy, fw.z * this.airspeed);
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y < ground) { this.pos.y = ground; }
    this.model.pose(this.yaw, this.bank, throttle, this.grounded, this.lost);
    this.engine.set(throttle ? 1 : 0.35, throttle ? 0.9 : 0.25);
    // knocks: the trike against a wall or roof edge, or the wing into a building. bounced off, the wing partly
    // collapses for a moment and he drops, then it reinflates. Never blown up.
    const hit = this.touching([[0, 0.25, -0.7], [0, 0.25, 0.6], [0.5, 0.25, 0], [-0.5, 0.25, 0], [0, 3.7, 0], [2.8, 1.9, 0], [-2.8, 1.9, 0]]);
    if (hit && !hit.ground) {
      this.pos.addScaledVector(hit.n, hit.pen + 0.05);
      if (hit.n.y < 0.5) { this.yaw += Math.PI * 0.6 * (Math.random() < 0.5 ? 1 : -1); this.airspeed *= 0.4; }
      if (this.lost <= 0) { this.lost = 1.1; this.shake = 0.8; sfx.crash(hit.w.x, hit.w.z, 0.4); if (hit.cell && this.airspeed > 6) B.damageSphere(hit.w.x, hit.w.y, hit.w.z, 0.8, 50, 0, 0, this.pos); }
    }
  }

  // ---------------- the jetpack: hover, lift, strafe, burst
  flyJetpack(dt, turn) {
    const k = this.keys, B = G.buildings;
    this.yaw -= turn;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const fw = _v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), rt = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // W flies down the crosshair: point up to rise, down to drop; A/D strafe; nothing pressed: he hovers
    const look = this.lookDir(), dir3 = new THREE.Vector3().addScaledVector(look, f).addScaledVector(rt, s); if (dir3.lengthSq() > 1) dir3.normalize();
    const wish = new THREE.Vector3(dir3.x, 0, dir3.z), u = clamp(dir3.y * 1.6, -1, 1);
    const ground = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.4).y;
    this.grounded = this.pos.y <= ground + 0.03 && this.vel.y <= 0.01;
    // horizontal: quick to answer, a little slide
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z).lerp(wish.clone().multiplyScalar(13), 1 - Math.exp(-dt * (this.grounded ? 6 : 3.4)));
    // vertical: lift on R, drop on F, hold altitude (hover) with neither; standing on the ground until you lift off
    let vy = this.vel.y;
    if (Math.abs(u) > 0.05) vy += (u * 11 - vy) * (1 - Math.exp(-dt * 4));
    else if (!this.grounded) vy *= Math.exp(-dt * 3.5);
    vy = clamp(vy, -14, 11);
    // burst: a sharp kick of thrust the way you're steering (or straight ahead)
    this.burstCd -= dt;
    if ((k.ShiftLeft || k.ShiftRight) && this.burstCd <= 0) {
      const d = dir3.lengthSq() > 0 ? dir3.clone() : look.clone(); hv.addScaledVector(new THREE.Vector3(d.x, 0, d.z), 16); vy += d.y * 14 + 1.5;
      this.burstCd = 0.9; this.model.burst = 0.35; this.shake = Math.max(this.shake, 0.35);
    }
    this.vel.set(hv.x, vy, hv.z);
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y < ground) { this.pos.y = ground; if (this.vel.y < 0) this.vel.y = 0; }
    // walls and roof edges: slide along them
    for (let it = 0; it < 2; it++) {
      const hit = this.touching([[0, 0.05, 0], [0, 0.75, 0], [0.22, 0.45, 0], [-0.22, 0.45, 0], [0, 0.45, 0.28], [0, 0.45, -0.22]]);
      if (!hit || hit.ground) break;
      this.pos.addScaledVector(hit.n, hit.pen + 0.02);
      const vn = this.vel.dot(hit.n); if (vn < 0) this.vel.addScaledVector(hit.n, -vn * 1.2);
      if (vn < -9) { this.shake = 0.6; sfx.crash(hit.w.x, hit.w.z, 0.3); }
    }
    const thrust = this.grounded && u <= 0 ? 0 : clamp(0.55 + u * 0.45 + wish.length() * 0.15, 0, 1);
    this.model.pose(this.yaw, this.vel, this.yaw, thrust, this.grounded, dt);
    this.engine.set(thrust > 0 ? 0.5 + thrust * 0.5 : 0.05, thrust);
  }

  // ---------------- weapons
  // where the crosshair is pointing: the first thing under the screen's aim point, or far ahead
  aimPoint() {
    const cam = this.camera, o = cam.position.clone(), d = new THREE.Vector3(0, 0.08, -1).unproject(cam).sub(o).normalize();
    const hit = G.buildings.raycast(o, d, 260);
    return hit ? hit.point : o.addScaledVector(d, 160);
  }
  weapons(dt) {
    this.fireCd -= dt; this.secCd -= dt;
    const k = this.keys, firing = k.Space || k.Mouse0, second = k.Mouse2 || k.KeyG;
    if (firing && this.fireCd <= 0) this.firePrimary();
    if (second && this.secCd <= 0 && this.kind !== 'drone') this.fireSecondary();
  }
  firePrimary() {
    const mz = this.model.muzzle(), target = this.aimPoint(), dir = target.clone().sub(mz).normalize();
    if (this.kind === 'glider') {
      // fireballs: a rapid stream of glowing balls of fire
      dir.x += rand(-0.02, 0.02); dir.y += rand(-0.02, 0.02); dir.normalize();
      this.shots.push({ kind: 'fire', pos: mz.clone(), prev: mz.clone(), vel: dir.multiplyScalar(48).add(this.vel), life: 1.6, sp: null });
      this.fireCd = 1 / 10; this.spread = Math.min(1, this.spread + 0.15);
      this.pop(mz, 0.9, 0.08, new THREE.Color(1.8, 0.9, 0.3));
      if (Math.random() < 0.5) sfx.zap && sfx.zap(mz.x, mz.z);
      return;
    }
    // machine guns: fast tracers, a muzzle flash, the gun's report
    dir.x += rand(-0.012, 0.012); dir.y += rand(-0.012, 0.012); dir.z += rand(-0.012, 0.012); dir.normalize();
    this.shots.push({ kind: 'bullet', pos: mz.clone(), prev: mz.clone(), vel: dir.multiplyScalar(150), life: 1.1 });
    this.fireCd = this.kind === 'drone' ? 1 / 13 : 1 / 11;
    this.pop(mz, 0.7, 0.05, new THREE.Color(2, 1.5, 0.7));
    this.model.recoil = 1; this.spread = Math.min(1, this.spread + 0.25);
    if ((this.shotN = (this.shotN || 0) + 1) % 2 === 0) sfx.gunshot(mz.x, mz.z, 1);
  }
  fireSecondary() {
    const mz = this.model.muzzle(true), target = this.aimPoint(), dir = target.clone().sub(mz).normalize();
    if (this.kind === 'glider') {
      // the firework: a fat rocket on a stick, sparkling, that goes off like a bomb
      const mesh = this.fireworkMesh(); mesh.position.copy(mz); this.fxGroup.add(mesh);
      this.bombs.push({ kind: 'firework', pos: mz.clone(), vel: dir.multiplyScalar(55).add(this.vel), life: 2.4, mesh, t: 0 });
      this.secCd = 2.4;
      this.pop(mz, 1.6, 0.2, new THREE.Color(2, 1.2, 0.5));
      sfx.pyro && sfx.pyro(mz.x, mz.z, false);
    } else {
      // a grenade lobbed along the aim, a little high
      dir.y += 0.12; dir.normalize();
      const mesh = this.grenadeMesh(); mesh.position.copy(mz); this.fxGroup.add(mesh);
      this.bombs.push({ kind: 'grenade', pos: mz.clone(), vel: dir.multiplyScalar(32).add(this.vel), life: 2.6, mesh, t: 0, spin: rand(4, 9) });
      this.secCd = 0.7;
      this.pop(mz, 0.9, 0.08, new THREE.Color(1.6, 1.4, 1));
      sfx.clack && sfx.clack(mz.x, mz.z);
    }
  }
  fireworkMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8202a, roughness: 0.5 }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2c21a }));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a5ad8 })); nose.position.z = 0.42;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8a070 })); stick.position.set(0.1, 0, -0.6);
    g.add(body, band, nose, stick); return g;
  }
  grenadeMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8).scale(1, 1, 1.35), new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.6 })));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7 })); cap.position.z = 0.13; g.add(cap);
    return g;
  }
  // people and cars along a shot's path (as Rick's bolts)
  victim(o, dir, len) {
    const A = G.agents; if (!A) return null;
    let best = null;
    const test = (obj, x, y, z, r) => { const tx = x - o.x, ty = y - o.y, tz = z - o.z, al = tx * dir.x + ty * dir.y + tz * dir.z; if (al < -r || al > len + r) return; const d2 = tx * tx + ty * ty + tz * tz - al * al; if (d2 < r * r && (!best || al < best.t)) best = { obj, t: Math.max(0, al) }; };
    for (const p of A.peds) if (!p.hidden && p.state !== 'gone' && p.state !== 'incar' && !p.dead) test(p, p.pos.x, p.pos.y + 0.4, p.pos.z, 0.4);
    for (const c of A.cars) if (c.state !== 'hidden') test(c, c.pos.x, c.pos.y + 0.35, c.pos.z, 0.8);
    if (best) best.car = A.cars.includes(best.obj);
    return best;
  }
  updateShots(dt) {
    const B = G.buildings, TH = G.terrainH, fx = G.fx;
    let n = 0;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      if (s.kind === 'fire') s.vel.y -= 4 * dt;
      s.prev.copy(s.pos); s.pos.addScaledVector(s.vel, dt);
      const seg = _v.copy(s.pos).sub(s.prev), len = seg.length(), dir = seg.clone().normalize();
      let hit = len > 0 ? B.raycast(s.prev, dir, len) : null;
      const vic = this.victim(s.prev, dir, len);
      if (vic && (!hit || vic.t < s.prev.distanceTo(hit.point))) hit = { point: s.prev.clone().addScaledVector(dir, vic.t), normal: new THREE.Vector3(0, 1, 0), cell: null, victim: vic };
      const gy = TH ? TH(s.pos.x, s.pos.z) : 0;
      if (!hit && s.pos.y <= gy) hit = { point: s.pos.clone().setY(gy), normal: new THREE.Vector3(0, 1, 0), cell: null, ground: true };
      if (hit) { if (s.kind === 'fire') this.fireHit(hit); else this.bulletHit(hit); if (s.sp) { s.sp.visible = false; s.sp = null; } this.shots.splice(i, 1); continue; }
      if (s.life <= 0) { if (s.sp) { s.sp.visible = false; s.sp = null; } this.shots.splice(i, 1); continue; }
      if (s.kind === 'fire') {
        // the fireball: a glow sprite, flames shed behind it now and then (kept light)
        if (!s.sp) { s.sp = this.sprite(); if (s.sp) { s.sp.visible = true; s.sp.userData = { shot: true }; s.sp.material.color.setRGB(2, 0.9, 0.25); s.sp.material.opacity = 1; } }
        if (s.sp) { s.sp.position.copy(s.pos); s.sp.scale.setScalar(0.9 + Math.sin(s.life * 40) * 0.12); }
        if (Math.random() < 0.45) fx.fire.emit(s.pos.x, s.pos.y, s.pos.z, -s.vel.x * 0.02, 0.6, -s.vel.z * 0.02, rand(0.5, 0.9), 0.3, 1.6, 0.9, 0.5, 1);
      } else if (n < 160) {
        const d = _v2.copy(s.vel).normalize(); _q.setFromUnitVectors(_z, d);
        _m.compose(_v.copy(s.pos).addScaledVector(d, -0.9), _q, new THREE.Vector3(0.03, 0.03, 1.8)); this.tracers.setMatrixAt(n++, _m);
      }
    }
    this.tracers.count = n; this.tracers.instanceMatrix.needsUpdate = true;
  }
  bulletHit(hit) {
    const B = G.buildings, fx = G.fx, p = hit.point, nrm = hit.normal;
    B.damageSphere(p.x, p.y, p.z, 0.9, 34, 0.05, 0.03, this.pos);
    fx.sparks(p.x + nrm.x * 0.1, p.y + nrm.y * 0.1, p.z + nrm.z * 0.1, 5, 2.2, 1.8, 0.8, 5);
    if (Math.random() < 0.25) fx.smokePuff(p.x + nrm.x * 0.3, p.y + 0.2, p.z + nrm.z * 0.3, 0.35, 0.2, 2);
    if (hit.victim && hit.victim.car) { const c = hit.victim.obj; c.cook = (c.cook || 0) + 0.12; if (c.cook > 1) { c.cook = -10; G.weapons.carExplode(c); } }
    blast(p.x, p.y, p.z, hit.victim && !hit.victim.car ? 1.6 : 0.9, hit.victim && !hit.victim.car ? 2.4 : 0.6, 'laser');
  }
  fireHit(hit) {
    const B = G.buildings, fx = G.fx, p = hit.point;
    B.damageSphere(p.x, p.y, p.z, 1.5, 48, 0.9, 0.3, this.pos);
    if (hit.cell && Math.random() < 0.35) B.ignite(hit.cell);
    fx.emitFire(p.x, p.y + 0.2, p.z, 4, 0.8);
    this.pop(_v.copy(p), 2, 0.25, new THREE.Color(2, 0.9, 0.3));
    if (hit.ground && Math.random() < 0.15) fx.groundFire(p.x, p.y, p.z, rand(4, 8), 0.5);
    if (hit.victim && hit.victim.car) { const c = hit.victim.obj; c.cook = (c.cook || 0) + 0.3; if (c.cook > 1) { c.cook = -10; G.weapons.carExplode(c); } }
    blast(p.x, p.y, p.z, hit.victim && !hit.victim.car ? 2.2 : 1.4, hit.victim && !hit.victim.car ? 3 : 1, 'laser');
  }
  updateBombs(dt) {
    const B = G.buildings, fx = G.fx;
    for (const b of this.bombs) {
      if (b.dead) continue;
      b.t += dt; b.life -= dt;
      b.vel.y -= (b.kind === 'grenade' ? 15 : 3) * dt;
      const prev = b.pos.clone(); b.pos.addScaledVector(b.vel, dt);
      const dir = _v.copy(b.pos).sub(prev), len = dir.length(); dir.normalize();
      let hitP = null;
      const h = len > 0 ? B.raycast(prev, dir, len) : null; if (h) hitP = h.point;
      const vic = this.victim(prev, dir, len); if (!hitP && vic) hitP = prev.clone().addScaledVector(dir, vic.t);
      const floor = B.surfaceAt(b.pos.x, b.pos.z, prev.y + 0.3).y; if (!hitP && b.pos.y <= floor) hitP = b.pos.clone().setY(floor);
      if (hitP || b.life <= 0) { b.dead = true; this.fxGroup.remove(b.mesh); if (b.kind === 'firework') this.fireworkBoom(hitP || b.pos.clone()); else this.grenadeBoom(hitP || b.pos.clone()); continue; }
      b.mesh.position.copy(b.pos); _q.setFromUnitVectors(_z, _v2.copy(b.vel).normalize()); b.mesh.quaternion.copy(_q);
      if (b.kind === 'grenade') b.mesh.rotateZ(b.t * b.spin);
      if (b.kind === 'firework') { if (Math.random() < 0.8) fx.sparks(b.pos.x, b.pos.y, b.pos.z, 3, 2.4, 1.6, 0.6, 2); if (Math.random() < 0.3) fx.smokePuff(b.pos.x, b.pos.y, b.pos.z, 0.3, 0.4, 1.5); }
    }
    this.bombs = this.bombs.filter((b) => !b.dead);
  }
  grenadeBoom(p) {
    const B = G.buildings, fx = G.fx;
    fx.explosion(p.x, p.y, p.z, 0.8);
    sfx.boom(p.x, p.z, 0.8, 'bomb');
    B.damageSphere(p.x, p.y, p.z, 3.3, 230, 0.8, 0.4);
    const gy = G.terrainH ? G.terrainH(p.x, p.z) : 0;
    if (p.y < gy + 0.6) fx.crater(p.x, p.z, 1.1);
    blast(p.x, p.y, p.z, 16, 9, 'explosion');
  }
  // the firework goes off like a bomb and then some: a fireball, a burst of coloured stars, a shock ring, deep damage
  fireworkBoom(p) {
    const B = G.buildings, fx = G.fx;
    fx.explosion(p.x, p.y, p.z, 2.2, null, 'meteor');
    fx.fireball(p.x, p.y + 1, p.z, 7, 1.3, new THREE.Color(1, 0.5, 0.15));
    fx.flash(p.x, p.y + 4, p.z, 0xffc080, 320, 1, 100);
    const cols = [[2.4, 0.5, 0.5], [0.5, 2.2, 0.6], [0.6, 0.9, 2.6], [2.4, 2.0, 0.5], [2.2, 0.6, 2.2], [2.4, 2.4, 2.4]];
    for (const c of cols) fx.sparks(p.x, p.y + 2, p.z, 60, c[0], c[1], c[2], 22);
    fx.ring(p.x, Math.max(0.1, p.y), p.z, 32, 1, 0xffb070, 0.6);
    sfx.boom(p.x, p.z, 2, 'meteor'); sfx.pyro && sfx.pyro(p.x, p.z, true);
    B.damageSphere(p.x, p.y, p.z, 8, 500, 1.2, 0.7);
    B.damageSphere(p.x, p.y, p.z, 12.5, 80, 0.4, 0.25);
    const gy = G.terrainH ? G.terrainH(p.x, p.z) : 0;
    if (p.y < gy + 2) { fx.crater(p.x, p.z, 3.8); G.weapons.groundChunks(p, 30, 14); }
    for (let i = 0; i < 6; i++) { const a = rand(0, 6.28), r = rand(2, 6); fx.groundFire(p.x + Math.cos(a) * r, gy, p.z + Math.sin(a) * r, rand(15, 35), rand(0.8, 1.5)); }
    G.shake = Math.max(G.shake || 0, 1.2); this.shake = Math.max(this.shake, 0.6);
    blast(p.x, p.y, p.z, 40, 22, 'meteor');
    G.emergency && G.emergency.report(p.x, p.z, 2.5);
  }
  updateFlashes(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i], u = f.userData; u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) { f.visible = false; f.userData = {}; this.flashes.splice(i, 1); continue; }
      f.scale.setScalar(u.size * (0.4 + 0.8 * Math.sqrt(k))); f.material.opacity = 1 - k * k;
    }
  }

  // ---------------- the chase camera, after Tiny World's own camera update
  applyCamera(dt) {
    if (!this.active) return;
    const cam = this.camera, K = this.kind;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const dist = (K === 'drone' ? 3.6 : K === 'glider' ? 7.5 : 3.2) * this.zoom, h = K === 'glider' ? 1.8 : K === 'drone' ? 0.55 : 0.45;
    const pitch = clamp(this.aim * 0.85, -1.1, 0.55);
    const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    const focus = this.pos.clone().add(new THREE.Vector3(0, K === 'glider' ? 1.6 : K === 'jetpack' ? 0.55 : 0.1, 0));
    const want = focus.clone().addScaledVector(back, dist).add(new THREE.Vector3(0, h, 0));
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    this.camPos.lerp(want, 1 - Math.exp(-dt * (K === 'glider' ? 4 : 8)));
    cam.position.copy(this.camPos);
    const B = G.buildings, floor = B ? B.surfaceAt(cam.position.x, cam.position.z, cam.position.y + 0.2).y : 0;
    if (cam.position.y < floor + 0.3) cam.position.y = floor + 0.3;
    const look = focus.clone().addScaledVector(back, -7).add(new THREE.Vector3(0, K === 'glider' ? 0.3 : 0.25, 0));
    cam.up.set(0, 1, 0); cam.lookAt(look);
    if (this.shake > 0) { const s = this.shake * this.shake * 0.02, t = performance.now() * 0.037; cam.quaternion.multiply(_q.setFromEuler(new THREE.Euler(Math.sin(t) * s, Math.sin(t * 1.3 + 1) * s, 0))); }
    const sp = this.vel.length(), fov = 64 + clamp(sp / 24, 0, 1) * 8;
    this.fov += (fov - this.fov) * (1 - Math.exp(-dt * 2));
    cam.fov = this.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    this.post.maxBlur = 0; this.post.band = 1;
    if (this.scene.fog) { this.scene.fog.near = 60; this.scene.fog.far = 280; }
  }

  // ======================================================================== the models
  buildDrone() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const black = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.5, metalness: 0.6 });
    const gun = new THREE.MeshStandardMaterial({ color: 0x2e3034, roughness: 0.35, metalness: 0.85 }), lens = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.1, metalness: 0.9 });
    const add = (p, g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    // the hull: a long body with a raised spine, chamfered nose, a camera eye
    add(body, new THREE.BoxGeometry(0.42, 0.16, 0.85), black, 0, 0, 0);
    add(body, new THREE.BoxGeometry(0.3, 0.08, 0.6), dark, 0, 0.11, 0.04);
    add(body, new THREE.BoxGeometry(0.34, 0.12, 0.18), black, 0, -0.01, -0.48).rotation.x = 0.35;
    add(body, new THREE.SphereGeometry(0.05, 10, 8), lens, 0, -0.03, -0.55);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); led.position.set(0, 0.16, 0.36); body.add(led);
    // arms, motors and props
    const props = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const arm = add(body, new THREE.BoxGeometry(0.06, 0.05, 0.62), black, sx * 0.34, 0.03, sz * 0.28); arm.rotation.y = sx * sz * 0.85;
      add(body, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), dark, sx * 0.55, 0.08, sz * 0.5);
      add(body, new THREE.BoxGeometry(0.03, 0.22, 0.03), black, sx * 0.55, -0.1, sz * 0.5);                           // landing legs
      const prop = new THREE.Group(); prop.position.set(sx * 0.55, 0.15, sz * 0.5); body.add(prop);
      add(prop, new THREE.BoxGeometry(0.62, 0.008, 0.05), dark, 0, 0, 0);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x222226, transparent: true, opacity: 0.18, depthWrite: false })); prop.add(disc);
      props.push(prop);
    }
    // the machine gun slung under the hull on a gimbal: receiver, long barrel with a flash hider, ammo box and belt
    const gimbal = new THREE.Group(); gimbal.position.set(0, -0.14, -0.12); body.add(gimbal);
    add(gimbal, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), dark, 0, 0.02, 0);
    add(gimbal, new THREE.BoxGeometry(0.11, 0.1, 0.36), gun, 0, -0.06, -0.06);
    const barrel = add(gimbal, new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8).rotateX(Math.PI / 2), gun, 0, -0.05, -0.47);
    add(gimbal, new THREE.CylinderGeometry(0.035, 0.03, 0.09, 8).rotateX(Math.PI / 2), gun, 0, -0.05, -0.74);
    add(gimbal, new THREE.BoxGeometry(0.12, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x3a3f2a, roughness: 0.6 }), 0.12, -0.06, 0.02);
    for (let i = 0; i < 5; i++) add(gimbal, new THREE.BoxGeometry(0.02, 0.025, 0.04), new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.8, roughness: 0.3 }), 0.06 - i * 0.012, -0.02, -0.04 + i * 0.01);
    root.scale.setScalar(1.25);
    const self = this;
    return {
      root, recoil: 0,
      tilt(p, r, yaw, aim) { root.rotation.set(0, 0, 0); root.rotateY(yaw); body.rotation.set(p, 0, r); gimbal.rotation.x = clamp(aim + 0.35, -1.2, 0.5) - p; },
      update(dt) { for (const pr of props) pr.rotation.y += dt * 60; root.position.copy(self.pos); this.recoil = Math.max(0, this.recoil - dt * 12); barrel.position.z = -0.47 + this.recoil * 0.04; led.visible = (performance.now() / 400) % 1 < 0.5; },
      muzzle() { root.updateMatrixWorld(true); return new THREE.Vector3(0, -0.05, -0.8).applyMatrix4(gimbal.matrixWorld); },
    };
  }

  buildGlider() {
    const root = new THREE.Group(), swing = new THREE.Group(); root.add(swing);
    const tube = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.35, metalness: 0.8 }), red = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.45 }), green = new THREE.MeshStandardMaterial({ color: 0x3ad22a, roughness: 0.5 }), tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const add = (p, g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    const rod = (p, a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const o = add(p, new THREE.CylinderGeometry(r, r, L, 6), m, 0, 0, 0); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o; };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // the trike (after the reference): a tube frame, three green wheels, the seat, the red engine and its prop in a
    // round cage behind the pilot
    const trike = new THREE.Group(); swing.add(trike);
    rod(trike, V(0, 0.16, -0.75), V(0, 0.22, 0.25), 0.025, tube);
    rod(trike, V(-0.45, 0.16, 0.25), V(0.45, 0.16, 0.25), 0.025, tube);
    rod(trike, V(0, 0.22, 0.25), V(0, 0.95, 0.3), 0.025, tube);
    for (const s of [-1, 1]) rod(trike, V(s * 0.45, 0.16, 0.25), V(0, 0.6, 0.3), 0.02, tube);
    for (const [x, z] of [[0, -0.75], [-0.45, 0.25], [0.45, 0.25]]) { add(trike, new THREE.CylinderGeometry(0.15, 0.15, 0.07, 14).rotateZ(Math.PI / 2), green, x, 0.15, z); add(trike, new THREE.TorusGeometry(0.15, 0.035, 6, 14).rotateY(Math.PI / 2), tyre, x, 0.15, z); }
    add(trike, new THREE.BoxGeometry(0.34, 0.06, 0.34), new THREE.MeshStandardMaterial({ color: 0x2a2a2e }), 0, 0.32, 0.05);
    add(trike, new THREE.BoxGeometry(0.34, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a2a2e }), 0, 0.52, 0.24).rotation.x = -0.2;
    add(trike, new THREE.BoxGeometry(0.3, 0.42, 0.26), red, 0, 0.6, 0.45);
    add(trike, new THREE.CylinderGeometry(0.08, 0.08, 0.2, 10).rotateX(Math.PI / 2), tube, 0, 0.62, 0.62);
    const cage = new THREE.Group(); cage.position.set(0, 0.68, 0.74); trike.add(cage);
    cage.add(Object.assign(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.016, 6, 40), tube), { castShadow: true }));
    for (let i = 0; i < 6; i++) { const sp = add(cage, new THREE.BoxGeometry(0.012, 1.24, 0.012), tube, 0, 0, 0); sp.rotation.z = (i / 6) * Math.PI; }
    const prop = new THREE.Group(); prop.position.z = -0.03; cage.add(prop);
    add(prop, new THREE.BoxGeometry(1.12, 0.07, 0.02), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 }), 0, 0, 0);
    const blur = new THREE.Mesh(new THREE.CircleGeometry(0.58, 28), new THREE.MeshBasicMaterial({ color: 0x8a7a6a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); cage.add(blur);
    // the pilot: the dad, seated, hands up on the brake toggles
    const pilot = new CartoonCharacter('dad'); pilot.root.scale.setScalar(S); pilot.root.position.set(0, 0.12, 0.06); trike.add(pilot.root);
    // the wing: a long arc of white cells with dark bands and blue tips, its lines down to the risers
    const wing = new THREE.Group(); wing.position.y = 3.7; swing.add(wing);
    const N = 22, R = 3.2, span = 1.25, wingCol = (i) => (i === 0 || i === N - 1 ? 0x2a9ad8 : [5, 6, 15, 16].includes(i) ? 0x3a5868 : 0xf4f6f8);
    const ribs = [];
    for (let i = 0; i < N; i++) {
      const a0 = -span + (i / N) * span * 2, a1 = -span + ((i + 1) / N) * span * 2, am = (a0 + a1) / 2;
      const cell = add(wing, new THREE.BoxGeometry(R * (a1 - a0) * 1.02, 0.16, 1.15), new THREE.MeshStandardMaterial({ color: wingCol(i), roughness: 0.7, side: THREE.DoubleSide }), Math.sin(am) * R, Math.cos(am) * R - R, 0);
      cell.rotation.z = -am; ribs.push([Math.sin(am) * R, Math.cos(am) * R - R]);
    }
    const lp = [];
    for (const [x, y] of ribs.filter((_, i) => i % 2 === 0)) for (const z of [-0.4, 0.3]) lp.push(x, y + 3.7 - 0.08, z, x > 0 ? 0.22 : -0.22, 1.05, 0.15);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: 0x9aa0a6, transparent: true, opacity: 0.7 }));
    swing.add(lines);
    // the launchers: the fireball tube on the right of the frame, the firework rack on the left
    add(trike, new THREE.CylinderGeometry(0.05, 0.06, 0.55, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.4 }), 0.3, 0.55, -0.3);
    add(trike, new THREE.BoxGeometry(0.18, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0xd8202a, roughness: 0.5 }), -0.32, 0.55, -0.2);
    const self = this;
    let collapse = 0;
    return {
      root,
      pose(yaw, bank, throttle, grounded, lost) {
        root.rotation.set(0, yaw, 0);
        swing.rotation.z = bank * 0.9; trike.rotation.x = grounded ? 0 : -0.08 + throttle * 0.1;
        collapse += ((lost > 0 ? 1 : 0) - collapse) * 0.15;
        wing.scale.set(1 - collapse * 0.35, 1, 1 - collapse * 0.2); wing.rotation.z = collapse * 0.4 * Math.sin(performance.now() * 0.01);
        lines.visible = wing.visible = !grounded || self.airspeed > 2;
        this.throttle = throttle;
      },
      update(dt) {
        root.position.copy(self.pos);
        prop.rotation.z += dt * (8 + (this.throttle ? 70 : 30)); blur.material.opacity = this.throttle ? 0.3 : 0.15;
        pilot.update(dt, 'seated'); pilot.armL.upper.rotation.set(2.6, 0, -0.35); pilot.armR.upper.rotation.set(2.6, 0, 0.35); pilot.armL.mid.rotation.x = 0.3; pilot.armR.mid.rotation.x = 0.3;
      },
      muzzle(second) { root.updateMatrixWorld(true); return new THREE.Vector3(second ? -0.32 : 0.3, 0.55, second ? -0.5 : -0.6).applyMatrix4(trike.matrixWorld); },
    };
  }

  buildJetpack() {
    const root = new THREE.Group();
    const guy = new CartoonCharacter('guy'); guy.root.scale.setScalar(S); root.add(guy.root);
    const add = (p, g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    // the jetpack (after the reference): two red tanks with chrome nose cones and dark nozzles either side of a
    // yellow-and-grey core with red lamps, black hoses looping up over the shoulders
    const pack = new THREE.Group(); pack.position.set(0, 0.0, 0.17); guy.chest.add(pack);
    const red = new THREE.MeshStandardMaterial({ color: 0xd8262a, roughness: 0.3, metalness: 0.2 }), chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4da, roughness: 0.2, metalness: 1 }), grey = new THREE.MeshStandardMaterial({ color: 0x4a4c52, roughness: 0.5, metalness: 0.5 }), yellow = new THREE.MeshStandardMaterial({ color: 0xf2a52a, roughness: 0.45 }), lamp = new THREE.MeshBasicMaterial({ color: 0xff3a2a });
    add(pack, new THREE.BoxGeometry(0.22, 0.34, 0.12), grey, 0, 0, 0);
    add(pack, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 18).rotateX(Math.PI / 2), yellow, 0, 0.06, 0.065);
    add(pack, new THREE.BoxGeometry(0.12, 0.08, 0.02), yellow, 0, -0.08, 0.065);
    for (const s of [-1, 1]) {
      add(pack, new THREE.CapsuleGeometry(0.075, 0.26, 6, 14), red, s * 0.17, -0.02, 0.02);
      add(pack, new THREE.ConeGeometry(0.075, 0.12, 14), chrome, s * 0.17, 0.22, 0.02);
      add(pack, new THREE.CylinderGeometry(0.06, 0.09, 0.09, 8, 1, true), grey, s * 0.17, -0.21, 0.02);
      for (const y of [0.08, -0.04]) add(pack, new THREE.SphereGeometry(0.018, 8, 6), lamp, s * 0.09, y, 0.065);
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6 })); hose.position.set(s * 0.1, 0.23, 0.02); hose.rotation.y = Math.PI / 2; pack.add(hose);
    }
    // the flames: two cones of additive glow under the nozzles
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.2, 0.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const flames = [-1, 1].map((s) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 10, 1, true).rotateX(Math.PI), flameMat); f.position.set(s * 0.17, -0.5, 0.02); pack.add(f); return f; });
    // the gun in his hands: a compact machine gun with a grenade tube under the barrel
    const gunG = new THREE.Group(); guy.armR.end.add(gunG); gunG.position.set(-0.03, -0.08, 0); gunG.rotation.x = -Math.PI / 2;   // barrel along the arm
    const gm = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.35 });
    add(gunG, new THREE.BoxGeometry(0.06, 0.1, 0.38), gm, 0, 0, -0.12);
    add(gunG, new THREE.CylinderGeometry(0.016, 0.016, 0.28, 8).rotateX(Math.PI / 2), gm, 0, 0.02, -0.42);
    add(gunG, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.6 }), 0, -0.05, -0.34);
    add(gunG, new THREE.BoxGeometry(0.05, 0.12, 0.05), gm, 0, -0.1, -0.02);
    const self = this;
    let lean = 0, side = 0;
    return {
      root, burst: 0, recoil: 0,
      pose(yaw, vel, _y, thrust, grounded, dt) {
        const fw = vel.x * -Math.sin(yaw) + vel.z * -Math.cos(yaw), sd = vel.x * Math.cos(yaw) + vel.z * -Math.sin(yaw);
        lean += (clamp(-fw / 13, -1, 1) * 0.35 - lean) * (1 - Math.exp(-dt * 5)); side += (clamp(-sd / 13, -1, 1) * 0.3 - side) * (1 - Math.exp(-dt * 5));
        root.rotation.set(0, 0, 0); root.rotateY(yaw); guy.root.rotation.set(grounded ? 0 : lean, 0, grounded ? 0 : side);
        this.thrust = thrust; this.grounded = grounded;
      },
      update(dt) {
        root.position.copy(self.pos);
        guy.update(dt, 'idle');
        // arms up holding the gun forward along the aim; legs hang a little when flying
        const a = clamp(self.aim, -1, 0.6);
        guy.armR.upper.rotation.set(1.35 + a, 0, 0.1); guy.armR.mid.rotation.x = 0.1; guy.armL.upper.rotation.set(1.2 + a, 0, -0.45); guy.armL.mid.rotation.x = 0.9;
        if (!this.grounded) { guy.legL.upper.rotation.x = 0.25; guy.legR.upper.rotation.x = 0.05; guy.legL.mid.rotation.x = -0.45; guy.legR.mid.rotation.x = -0.25; }
        this.burst = Math.max(0, this.burst - dt);
        const f = (this.thrust || 0) + this.burst * 3;
        for (const fl of flames) { fl.visible = f > 0.02; fl.scale.set(1, 0.4 + f * 0.9 + Math.random() * 0.25, 1); fl.position.y = -0.27 - (0.4 + f * 0.9) * 0.25; }
        if (f > 0.1 && Math.random() < 0.6) { const p = new THREE.Vector3(0, -0.3, 0).applyMatrix4(pack.matrixWorld); G.fx.fire.emit(p.x, p.y, p.z, rand(-0.3, 0.3), -2 - f * 2, rand(-0.3, 0.3), rand(0.25, 0.4) * (0.6 + f), 0.18, 1.8, 1.0, 0.45, 1); }
        if (f > 0.1 && Math.random() < 0.08) { const p = new THREE.Vector3(0, -0.5, 0).applyMatrix4(pack.matrixWorld); G.fx.smokePuff(p.x, p.y, p.z, 0.25, 0.35, 1.2); }
      },
      muzzle(second) { root.updateMatrixWorld(true); return new THREE.Vector3(0, second ? -0.05 : 0.02, second ? -0.45 : -0.57).applyMatrix4(gunG.matrixWorld); },
    };
  }
}

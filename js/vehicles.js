// VEHICLES: three more things to fly round Tiny World, next to Rick's ship in the bottom bar.
//   - the armed drone: a heavy black quadcopter with a machine gun slung under it. Fast, precise, and fragile: it
//     blows up the moment it touches anything (a big blast that hurts whatever is near), then a fresh one drops in
//     high above. Damage done stays done; the map is never reset.
//   - the balloon chair: the dad in his white T-shirt stretched out in a lawn chair under two bunches of balloons,
//     with a little fan behind. Point and fly, holds its height; rise and the balloons fill up, sink and they come
//     loose and float away (or pop). Rapid fireballs, and a bomb-power firework.
//   - the jetpack: a regular guy with a red twin-tank jetpack. Hovers, lifts straight up, strafes, bursts; the most
//     agile of the three. A machine gun and a grenade launcher.
// Everything they do goes through Tiny World's own systems: damageSphere / blast / bombImpact / carExplode / the fx.
import * as THREE from 'three';
import { G, clamp, rand, pick, blast } from './core.js';
import { sfx } from './audio.js';
import { CartoonCharacter } from './rickship.js';
import { boatTargets, damageBoat } from './boats.js';

const S = 0.42;                                     // the characters' scale (as Rick and Morty: people on the street)
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);

const KINDS = {
  drone: { name: 'Armed Drone', sub: 'Machine gun · grenades · explodes if rammed', keys: [['Mouse', 'aim · point up or down to climb or dive'], ['W S', 'fly where you point'], ['A D', 'strafe'], ['Space', 'rise'], ['Shift', 'boost'], ['Click', 'machine gun'], ['Right click / G', 'grenade'], ['V', 'camera'], ['Esc', 'leave']] },
  chair: { name: 'Balloon Chair', sub: 'Fireballs · bomb-power firework', keys: [['Mouse', 'turn · aim'], ['W S', 'forward / back'], ['A D', 'slide sideways'], ['Space', 'rise (balloons fill)'], ['⌘ Cmd', 'hold: drop balloons, sink'], ['Shift', 'faster'], ['Click', 'fireballs'], ['Right click / G', 'firework'], ['V', 'camera'], ['Esc', 'leave']] },
  jetpack: { name: 'Jetpack', sub: 'Machine gun · grenade launcher · real gravity', keys: [['Mouse', 'aim · point up or down to climb or dive'], ['W S', 'thrust where you point'], ['A D', 'strafe'], ['Space', 'thrust up'], ['—', 'let go and you fall'], ['Shift', 'thrust burst'], ['Click', 'machine gun'], ['Right click / G', 'grenade'], ['V', 'camera'], ['Esc', 'leave']] },
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
/* the balloon chair: the fireball launcher's sight, flame-orange, with a dot and a short drop line under it */
#vehHud .vh-ret.chair{--gap:7px;--len:8px;--th:2px;--col:#ffb04a}
#vehHud .vh-ret.chair .c{display:block;width:4px;height:4px;left:-2px;top:-2px;background:#ffe2b0}
#vehHud .vh-ret.chair .b{height:16px}
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
  chair: '<svg viewBox="0 0 40 30"><g stroke="#e8e8e8" stroke-width=".6"><path d="M14 13l3 9M26 13l-3 9"/></g><circle cx="11" cy="7" r="4.2" fill="#e8342a"/><circle cx="16" cy="5" r="4" fill="#2a7ae8"/><circle cx="13" cy="11" r="3.6" fill="#f2c21a"/><circle cx="25" cy="7" r="4.2" fill="#2ac85a"/><circle cx="30" cy="10" r="3.8" fill="#e83a9a"/><circle cx="27" cy="12" r="3.4" fill="#8a4ae8"/><path d="M11 24h18l-3-3H15z" fill="#f2d27a" stroke="#fff" stroke-width=".8"/><path d="M12 24l-1 4M28 24l1 4" stroke="#fff" stroke-width="1"/></svg>',
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
    if (this.kind === 'chair') { const lfo = (this.lfo = ctx.createOscillator()), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = 0.1; lfo.connect(lg); lg.connect(out.gain); lfo.start(); }
  }
  set(level, pitch) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, base = this.kind === 'drone' ? 150 : this.kind === 'chair' ? 120 : 55;
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
    this.btn = document.createElement('span'); this.btn.id = 'vehBtn'; this.btn.title = 'Fly a drone, a balloon chair or a jetpack';
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
    // macOS drops the key-ups of anything pressed while Command is down: let go of Command and the movement keys
    // reset (a key still held comes straight back on its repeat)
    if (!down && (c === 'MetaLeft' || c === 'MetaRight')) for (const kk of Object.keys(this.keys)) if (kk.startsWith('Key') || kk === 'Space' || kk.startsWith('Shift')) this.keys[kk] = false;
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
    this.model = kind === 'drone' ? this.buildDrone() : kind === 'chair' ? this.buildChair() : this.buildJetpack();
    this.scene.add(this.model.root, this.fxGroup);
    // appear above where the view was looking, facing the way it faced
    const T = this.cam, B = G.buildings, ground = B.surfaceAt(T.x, T.z, 999).y;
    this.yaw = T.yaw; this.look = 0; this.aim = 0;
    this.pos.set(T.x, kind === 'jetpack' ? ground + 0.05 : Math.max(ground + (kind === 'drone' ? 18 : 10), kind === 'drone' ? 20 : 12), T.z);
    this.vel.set(0, 0, 0); this.dead = false; this.respawnT = 0; this.safeT = 1.2; this.fireCd = 0; this.secCd = 0; this.burstCd = 0; this.lost = 0; this.bank = 0;
    this.grounded = kind === 'jetpack';
    this.camInit = false; this.keys = {};
    this.engine = new EngineSynth(kind); this.engine.start();
    document.body.classList.add('veh-on'); this.btn.classList.add('on');
    this.hud.querySelector('.vh-keys').innerHTML = `<div class="vh-title">${KINDS[kind].name.toUpperCase()}</div>` + KINDS[kind].keys.map(([k, t]) => `<span>${k.split(' / ').map((x) => `<b class="key">${x}</b>`).join('')}${t}</span>`).join('');
    this.btn.querySelectorAll('.vh-item').forEach((el) => el.classList.toggle('on', el.dataset.k === kind));
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
    this.model.dispose && this.model.dispose();
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
    this.lastDt = dt;
    this.safeT = Math.max(0, this.safeT - dt);
    const turn = this.look; this.look = 0;
    if (this.dead) this.updateDead(dt);
    else if (this.kind === 'drone') this.flyDrone(dt, turn);
    else if (this.kind === 'chair') this.flyChair(dt, turn);
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
    const base = { drone: 5, jetpack: 8, chair: 7 }[this.kind];
    this.ret.style.setProperty('--gap', `${base + this.spread * (this.kind === 'jetpack' ? 9 : 6)}px`);
    this.cdBar.style.width = `${(1 - clamp(this.secCd / (this.kind === 'chair' ? 2.4 : 0.7), 0, 1)) * 100}%`;
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
      const cell = B.inside(w);
      if (cell) {
        const dx = w.x - cell.x, dy = w.y - cell.y, dz = w.z - cell.z, px = cell.hx - Math.abs(dx), py = cell.hy - Math.abs(dy), pz = cell.hz - Math.abs(dz);
        // the face it came in through: the axis on which the point was still outside the block a frame ago
        // (the shallowest axis is wrong for flat, wide blocks: it would call a wall hit a landing on the roof)
        const dt = this.lastDt || 1 / 60, ox = w.x - this.vel.x * dt - cell.x, oy = w.y - this.vel.y * dt - cell.y, oz = w.z - this.vel.z * dt - cell.z;
        const outX = Math.abs(ox) >= cell.hx, outY = Math.abs(oy) >= cell.hy, outZ = Math.abs(oz) >= cell.hz;
        let ax = outX ? 'x' : outY ? 'y' : outZ ? 'z' : null;
        if (outX + outY + outZ > 1) ax = [['x', outX, px], ['y', outY, py], ['z', outZ, pz]].filter((q) => q[1]).sort((a2, b2) => a2[2] - b2[2])[0][0];
        if (!ax) { const m = Math.min(px, py, pz); ax = px === m ? 'x' : py === m ? 'y' : 'z'; }
        const n = ax === 'x' ? new THREE.Vector3(Math.sign(dx) || 1, 0, 0) : ax === 'y' ? new THREE.Vector3(0, Math.sign(dy) || 1, 0) : new THREE.Vector3(0, 0, Math.sign(dz) || 1);
        return { w: w.clone(), pen: ax === 'x' ? px : ax === 'y' ? py : pz, cell, n, ground: ax === 'y' && n.y > 0 };
      }
      // a solid that isn't a block (the Eye, a pole)
      const so = G.solidHit && G.solidHit(w);
      if (so) { if (so.solid.hit) so.solid.hit(w, this.vel.length()); return { w: w.clone(), pen: so.pen, n: so.n.clone(), solid: so.solid }; }
      // the bare ground (terrain), once no block is involved
      const gy = G.terrainH ? G.terrainH(w.x, w.z) : 0;
      if (w.y < gy) return { w: w.clone(), pen: gy - w.y, n: new THREE.Vector3(0, 1, 0), ground: true };
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
    const look = this.lookDir(), want = new THREE.Vector3().addScaledVector(look, f).addScaledVector(rt, s); if (want.lengthSq() > 1) want.normalize(); want.multiplyScalar(vmax); if (k.Space) want.y = Math.max(want.y, 0) + 9; const u = want.y / vmax;
    this.vel.lerp(want, 1 - Math.exp(-dt * 2.6));
    this.pos.addScaledVector(this.vel, dt);
    // lean into the motion
    const lf = this.vel.dot(fw) / 24, ls = this.vel.dot(rt) / 24;
    this.model.tilt(-lf * 0.45, -ls * 0.45, this.yaw, this.aim);
    this.engine.set(1, clamp(this.vel.length() / 24 + Math.abs(u) * 0.2, 0, 1));
    // contact: rammed hard into a building, the ground, a roof or a car -> boom; a bump or a scrape just knocks it back
    if (this.safeT > 0) return;
    const RAM = 7.5;                                         // closing speed that counts as ramming
    const hit = this.touching([[0, -0.35, 0], [0.55, 0, 0.55], [-0.55, 0, 0.55], [0.55, 0, -0.55], [-0.55, 0, -0.55], [0, 0.05, -0.75], [0, -0.45, -0.3]]);
    if (hit) {
      const vn = this.vel.dot(hit.n);
      if (-vn > RAM) { this.explodeDrone(); return; }
      this.pos.addScaledVector(hit.n, hit.pen + 0.03);
      if (vn < 0) this.vel.addScaledVector(hit.n, -vn * 1.4);
      this.vel.multiplyScalar(0.8);
      if (-vn > 2 && (this.bumpT || 0) <= G.time) { this.bumpT = G.time + 0.25; this.shake = Math.max(this.shake, 0.3); sfx.crash(hit.w.x, hit.w.z, 0.25); }
    }
    const car = this.carNear(1.1, 0.9);
    if (car) {
      const away = new THREE.Vector3(this.pos.x - car.pos.x, 0, this.pos.z - car.pos.z).normalize(), closing = -this.vel.dot(away) + (this.vel.y < 0 ? -this.vel.y * 0.5 : 0);
      if (closing > RAM) { this.explodeDrone(); return; }
      this.vel.addScaledVector(away, Math.max(0, closing) * 1.4 + 1).multiplyScalar(0.85); this.pos.y += 0.05;
    }
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
    // the drone: a fresh one high over the wreck (the wreckage stays). The jetpack: back on his feet where he fell
    const B = G.buildings, ground = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.5).y;
    if (this.kind === 'drone') { this.pos.y = Math.max(B.surfaceAt(this.pos.x, this.pos.z, 999).y + 30, 40); this.aim = -0.2; } else { this.pos.y = ground; this.aim = 0; }
    this.vel.set(0, 0, 0);
    this.dead = false; this.safeT = 1.0;
    this.msgEl.classList.remove('show');
  }

  // ---------------- the balloon chair: point-and-fly like the drone, but it holds its height by itself. Mouse turns
  // and aims (aiming never changes altitude); W/S forward and back, A/D slide sideways, let go and it stops and hovers.
  // Space rises (the balloons fill back up), C / Ctrl sinks (balloons come loose one at a time and float off), and
  // the vertical speed follows the lift the balloons give, so what you see is what it does.
  flyChair(dt, turn) {
    const k = this.keys, B = G.buildings, M = this.model;
    this.yaw -= turn;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), boost = k.ShiftLeft || k.ShiftRight;
    const up = !!k.Space, down = !!(k.MetaLeft || k.MetaRight || k.KeyC || k.ControlLeft || k.ControlRight) && !up;   // Command (or C / Ctrl): let balloons go
    const fw = _v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), rt = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3().addScaledVector(fw, f).addScaledVector(rt, s); if (wish.lengthSq() > 1) wish.normalize();
    const vmax = boost ? 13 : 8;
    // horizontal: quick to start, quick to stop (no drifting off into walls)
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z).lerp(wish.multiplyScalar(vmax), 1 - Math.exp(-dt * (wish.lengthSq() ? 3 : 4.5)));
    // vertical: balloons. Sinking lets them go one by one (never below a floor that still holds him up); rising
    // fills them back; in between it simply holds its height
    const want = up ? 4.2 : down ? -3.6 : 0;
    let vy = this.vel.y + (want - this.vel.y) * (1 - Math.exp(-dt * 3));
    M.lift(dt, up, down && !this.grounded);
    const ground = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.3).y;
    this.grounded = this.pos.y <= ground + 0.03;
    if (this.grounded && vy < 0) vy = 0;
    this.vel.set(hv.x, vy, hv.z);
    // move in small steps so a fast chair can't skip through a thin wall
    const steps = Math.max(1, Math.ceil(this.vel.length() * dt / 0.25));
    for (let st = 0; st < steps; st++) {
      this.pos.addScaledVector(this.vel, dt / steps);
      const g2 = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.3).y;
      if (this.pos.y < g2) { this.pos.y = g2; if (this.vel.y < 0) this.vel.y = 0; }
      this.collideChair();
    }
    M.pose(this.yaw, this.vel, dt);
    this.engine.set(0.25 + Math.min(1, hv.length() / 10) * 0.6, Math.min(1, hv.length() / 12));
  }
  // the chair's own small, stable box of points (the balloons and strings take no part): pushed straight back out of
  // whatever it touches through the face it came in by, the speed into the wall taken away, so it slides along walls,
  // settles on roofs and can always back away
  collideChair() {
    const pts = [[0, 0.06, 0], [0.24, 0.12, 0.4], [-0.24, 0.12, 0.4], [0.24, 0.12, -0.42], [-0.24, 0.12, -0.42], [0.22, 0.55, 0.42], [-0.22, 0.55, 0.42], [0, 0.85, 0.3], [0, 0.4, -0.5]];
    for (let it = 0; it < 3; it++) {
      const hit = this.touching(pts);
      if (!hit) return;
      if (hit.ground) { this.pos.y += hit.pen + 0.01; if (this.vel.y < 0) this.vel.y = 0; continue; }
      this.pos.addScaledVector(hit.n, hit.pen + 0.02);
      const vn = this.vel.dot(hit.n); if (vn < 0) this.vel.addScaledVector(hit.n, -vn);
      if (vn < -5 && (this.bumpT || 0) <= G.time) { this.bumpT = G.time + 0.4; this.shake = Math.max(this.shake, 0.25); sfx.crash(hit.w.x, hit.w.z, 0.2); }
    }
  }

  // ---------------- the jetpack: hover, lift, strafe, burst
  flyJetpack(dt, turn) {
    const k = this.keys, B = G.buildings, GRAV = 12;
    this.yaw -= turn;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    const rt = _v2.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // a real jetpack: gravity always pulls. While you're firing it (W/S/A/D along the crosshair, Space straight up)
    // it carries his weight and pushes him where you point; let go of everything and he drops like a stone
    const look = this.lookDir(), dir3 = new THREE.Vector3().addScaledVector(look, f).addScaledVector(rt, s); if (dir3.lengthSq() > 1) dir3.normalize();
    const firing = f !== 0 || s !== 0 || !!k.Space;
    const ground = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.4).y;
    this.grounded = this.pos.y <= ground + 0.03 && this.vel.y <= 0.01;
    const v = this.vel.clone();
    v.y -= GRAV * dt;
    if (firing) {
      v.y += GRAV * dt;                                                   // the jets hold him up ...
      const want = dir3.clone().multiplyScalar(13); if (k.Space) want.y = Math.max(want.y, 0) + 9;
      v.lerp(want, 1 - Math.exp(-dt * 3.2));                              // ... and drive him where he's pointed
    } else if (!this.grounded) {
      v.x *= Math.exp(-dt * 0.25); v.z *= Math.exp(-dt * 0.25);           // falling: only a little air drag
    }
    if (this.grounded && !firing) { v.x *= Math.exp(-dt * 10); v.z *= Math.exp(-dt * 10); }
    v.y = Math.max(v.y, -40);
    // burst: a sharp kick of thrust the way you're pointing
    this.burstCd -= dt;
    if ((k.ShiftLeft || k.ShiftRight) && this.burstCd <= 0) {
      const d = dir3.lengthSq() > 0 ? dir3.clone() : look.clone(); v.addScaledVector(d, 16); v.y += 2;
      this.burstCd = 0.9; this.model.burst = 0.35; this.shake = Math.max(this.shake, 0.35);
    }
    this.vel.copy(v);
    const fallSpeed = -this.vel.y;
    this.pos.addScaledVector(this.vel, dt);
    // landing: from high enough (hitting at over 17, about four storeys' drop) it kills him
    const g2 = B.surfaceAt(this.pos.x, this.pos.z, this.pos.y + 0.4 + fallSpeed * dt).y;
    if (this.pos.y < g2) {
      this.pos.y = g2;
      if (fallSpeed > 17) { this.jetpackDeath(fallSpeed); return; }
      if (fallSpeed > 9) { this.shake = Math.max(this.shake, 0.5); sfx.crash(this.pos.x, this.pos.z, 0.3); }
      if (this.vel.y < 0) this.vel.y = 0;
    }
    // walls and roof edges: slide along them
    for (let it = 0; it < 2; it++) {
      const hit = this.touching([[0, 0.05, 0], [0, 0.75, 0], [0.22, 0.45, 0], [-0.22, 0.45, 0], [0, 0.45, 0.28], [0, 0.45, -0.22]]);
      if (!hit || hit.ground) break;
      this.pos.addScaledVector(hit.n, hit.pen + 0.02);
      const vn = this.vel.dot(hit.n); if (vn < 0) this.vel.addScaledVector(hit.n, -vn * 1.2);
      if (vn < -9) { this.shake = 0.6; sfx.crash(hit.w.x, hit.w.z, 0.3); }
    }
    const thrust = firing ? clamp(0.6 + (k.Space ? 0.4 : 0) + Math.max(0, dir3.y) * 0.3, 0, 1) : 0;
    this.model.pose(this.yaw, this.vel, this.yaw, thrust, this.grounded, dt);
    this.engine.set(thrust > 0 ? 0.5 + thrust * 0.5 : 0.05, thrust);
  }
  // hit the ground too fast: he's killed (a thump, dust, the crowd scatters), then back on his feet a moment later
  jetpackDeath(speed) {
    if (this.dead) return;
    const p = this.pos.clone(), fx = G.fx;
    this.dead = true; this.respawnT = 1.6; this.vel.set(0, 0, 0); this.shots.length = 0;
    fx.dust(p.x, p.y + 0.2, p.z, 1.6); for (let i = 0; i < 3; i++) fx.smokePuff(p.x + rand(-0.4, 0.4), p.y + 0.3, p.z + rand(-0.4, 0.4), 0.6, 0.3, 3);
    for (let i = 0; i < 8; i++) fx.debris.spawn(p.x, p.y + 0.2, p.z, new THREE.Vector3(rand(-3, 3), rand(2, 5), rand(-3, 3)), rand(0.06, 0.14), rand(0.06, 0.1), rand(0.06, 0.14), new THREE.Color(pick([0xd8262a, 0xf2a52a, 0x4a4c52, 0x6e7073])));
    sfx.crash(p.x, p.z, 0.8); sfx.yelp && sfx.yelp(p.x, p.z);
    if (speed > 25) G.ground && G.ground.scorch && G.ground.scorch(p.x, p.z, 0.8, 0.4);
    blast(p.x, p.y, p.z, 3, 1.5, 'collapse');
    this.shake = 1; this.engine.set(0, 0);
    this.msgEl.textContent = 'SPLAT — BACK ON YOUR FEET'; this.msgEl.classList.add('show');
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
    const k = this.keys, firing = k.Mouse0, second = k.Mouse2 || k.KeyG;
    if (firing && this.fireCd <= 0) this.firePrimary();
    if (second && this.secCd <= 0) this.fireSecondary();
  }
  firePrimary() {
    const mz = this.model.muzzle(), target = this.aimPoint(), dir = target.clone().sub(mz).normalize();
    if (this.kind === 'chair') {
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
    if (this.kind === 'chair') {
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
    for (const t of boatTargets()) test(t, t.x, t.y, t.z, t.r);
    if (best) { best.car = A.cars.includes(best.obj); best.boat = !best.car && !!best.obj.kill; }
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
      if (!hit && G.solidHit) { const so = G.solidHit(s.pos); if (so) hit = { point: s.pos.clone(), normal: so.n, cell: null }; }   // the Eye, poles
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
    // the machine guns are for people: on a building a round only chips the surface (it takes a long burst to break a
    // single block), but anyone it hits goes down
    B.damageSphere(p.x, p.y, p.z, 0.45, 3, 0, 0, this.pos);
    fx.sparks(p.x + nrm.x * 0.1, p.y + nrm.y * 0.1, p.z + nrm.z * 0.1, 5, 2.2, 1.8, 0.8, 5);
    if (Math.random() < 0.25) fx.smokePuff(p.x + nrm.x * 0.3, p.y + 0.2, p.z + nrm.z * 0.3, 0.35, 0.2, 2);
    if (hit.victim && hit.victim.car) { const c = hit.victim.obj; c.cook = (c.cook || 0) + 0.12; if (c.cook > 1) { c.cook = -10; G.weapons.carExplode(c); } }
    if (hit.victim && hit.victim.boat) damageBoat(hit.victim.obj, 0.1);
    const person = hit.victim && !hit.victim.car && !hit.victim.boat;
    blast(p.x, p.y, p.z, person ? 1.8 : 0.9, person ? 3 : 0.6, 'laser');
  }
  fireHit(hit) {
    const B = G.buildings, fx = G.fx, p = hit.point;
    B.damageSphere(p.x, p.y, p.z, 1.5, 48, 0.9, 0.3, this.pos);
    if (hit.cell && Math.random() < 0.35) B.ignite(hit.cell);
    fx.emitFire(p.x, p.y + 0.2, p.z, 4, 0.8);
    this.pop(_v.copy(p), 2, 0.25, new THREE.Color(2, 0.9, 0.3));
    if (hit.ground && Math.random() < 0.15) fx.groundFire(p.x, p.y, p.z, rand(4, 8), 0.5);
    if (hit.victim && hit.victim.car) { const c = hit.victim.obj; c.cook = (c.cook || 0) + 0.3; if (c.cook > 1) { c.cook = -10; G.weapons.carExplode(c); } }
    if (hit.victim && hit.victim.boat) damageBoat(hit.victim.obj, 0.3);
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
    const dist = (K === 'drone' ? 3.6 : K === 'chair' ? 4.6 : 3.2) * this.zoom, h = K === 'chair' ? 1.25 : K === 'drone' ? 0.55 : 0.45;
    const pitch = clamp(this.aim * 0.85, -1.1, 0.55);
    const back = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.yaw) * Math.cos(pitch));
    const focus = this.pos.clone().add(new THREE.Vector3(0, K === 'chair' ? 0.75 : K === 'jetpack' ? 0.55 : 0.1, 0));
    const want = focus.clone().addScaledVector(back, dist).add(new THREE.Vector3(0, h, 0));
    if (!this.camInit) { this.camPos.copy(want); this.camInit = true; }
    this.camPos.lerp(want, 1 - Math.exp(-dt * (K === 'chair' ? 6 : 8)));
    cam.position.copy(this.camPos);
    const B = G.buildings, floor = B ? B.surfaceAt(cam.position.x, cam.position.z, cam.position.y + 0.2).y : 0;
    if (cam.position.y < floor + 0.3) cam.position.y = floor + 0.3;
    const look = focus.clone().addScaledVector(back, -7).add(new THREE.Vector3(0, 0.25, 0));
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
    // the grenade launcher beside it: a fat olive tube with a rear breech
    add(gimbal, new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.6 }), -0.11, -0.07, -0.3);
    add(gimbal, new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10).rotateX(Math.PI / 2), gun, -0.11, -0.07, -0.06);
    for (let i = 0; i < 5; i++) add(gimbal, new THREE.BoxGeometry(0.02, 0.025, 0.04), new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.8, roughness: 0.3 }), 0.06 - i * 0.012, -0.02, -0.04 + i * 0.01);
    root.scale.setScalar(1.25);
    const self = this;
    return {
      root, recoil: 0,
      tilt(p, r, yaw, aim) { root.rotation.set(0, 0, 0); root.rotateY(yaw); body.rotation.set(p, 0, r); gimbal.rotation.x = clamp(aim + 0.35, -1.2, 0.5) - p; },
      update(dt) { for (const pr of props) pr.rotation.y += dt * 60; root.position.copy(self.pos); this.recoil = Math.max(0, this.recoil - dt * 12); barrel.position.z = -0.47 + this.recoil * 0.04; led.visible = (performance.now() / 400) % 1 < 0.5; },
      muzzle(second) { root.updateMatrixWorld(true); return (second ? new THREE.Vector3(-0.11, -0.07, -0.55) : new THREE.Vector3(0, -0.05, -0.8)).applyMatrix4(gimbal.matrixWorld); },
    };
  }

  buildChair() {
    const root = new THREE.Group(), chair = new THREE.Group(); root.add(chair);
    const self = this;
    const frameM = new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.3, metalness: 0.75 }), web = new THREE.MeshStandardMaterial({ color: 0xf2d27a, roughness: 0.75, side: THREE.DoubleSide }), webW = new THREE.MeshStandardMaterial({ color: 0xfaf6ea, roughness: 0.75, side: THREE.DoubleSide });
    const add = (p, g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    const rod = (p, a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const o = add(p, new THREE.CylinderGeometry(r, r, L, 6), m, 0, 0, 0); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o; };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // the folding lounge chair (after the reference): aluminium tube frame on two pairs of legs, a long seat, the back
    // reclined, yellow-and-white striped webbing, armrests
    // (the frame is built with its foot toward +z and turned round, so the feet point the way he faces, -z)
    const W = 0.2, seatY = 0.2, frame = new THREE.Group(); frame.rotation.y = Math.PI; chair.add(frame);
    for (const sx of [-W, W]) {
      rod(frame, V(sx, seatY, 0.5), V(sx, seatY, -0.3), 0.012, frameM);                      // seat rail
      rod(frame, V(sx, seatY, -0.3), V(sx, 0.62, -0.52), 0.012, frameM);                     // reclined back
      rod(frame, V(sx, seatY, 0.42), V(sx, 0.02, 0.5), 0.01, frameM); rod(frame, V(sx, seatY, -0.22), V(sx, 0.02, -0.3), 0.01, frameM);   // legs
      rod(frame, V(sx, 0.36, -0.12), V(sx, 0.36, -0.36), 0.01, frameM); rod(frame, V(sx, seatY, -0.12), V(sx, 0.36, -0.12), 0.01, frameM);  // armrest
    }
    rod(frame, V(-W, 0.62, -0.52), V(W, 0.62, -0.52), 0.012, frameM); rod(frame, V(-W, seatY, 0.5), V(W, seatY, 0.5), 0.012, frameM);
    for (let i = 0; i < 9; i++) { const z = 0.46 - i * 0.085; add(frame, new THREE.BoxGeometry(W * 2, 0.008, 0.07), i % 2 ? webW : web, 0, seatY, z); }
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, y = seatY + (0.62 - seatY) * t, z = -0.3 - 0.22 * t; const sl = add(frame, new THREE.BoxGeometry(W * 2, 0.07, 0.008), i % 2 ? webW : web, 0, y, z); sl.rotation.x = -0.48; }
    // the dad, stretched out in it with a drink
    const dad = new CartoonCharacter('dad'); dad.root.scale.setScalar(S); dad.root.position.set(0, 0.05, 0.2); dad.root.rotation.x = 0.28; chair.add(dad.root);
    const drink = new THREE.Group(); dad.armL.end.add(drink); drink.position.set(0, -0.12, -0.02);
    add(drink, new THREE.CylinderGeometry(0.035, 0.02, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.85, roughness: 0.1 }), 0, 0.02, 0);
    add(drink, new THREE.CylinderGeometry(0.006, 0.006, 0.07, 4), new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, -0.05, 0);
    add(drink, new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffa020 }), 0.03, 0.06, 0);
    // propulsion: a small caged fan behind the backrest, and the weapons on the armrests (fireball tube right,
    // firework rack left)
    const fan = new THREE.Group(); fan.position.set(0, 0.36, -0.62); fan.scale.setScalar(0.7); frame.add(fan);
    add(fan, new THREE.TorusGeometry(0.14, 0.01, 6, 24), frameM, 0, 0, 0);
    const blades = new THREE.Group(); fan.add(blades);
    for (let i = 0; i < 3; i++) { const bl = add(blades, new THREE.BoxGeometry(0.24, 0.035, 0.01), new THREE.MeshStandardMaterial({ color: 0x2a2a2e }), 0, 0, 0); bl.rotation.z = (i / 3) * Math.PI; }
    add(fan, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8202a }), 0, 0, 0.04);
    rod(frame, V(0, 0.36, -0.58), V(0, 0.42, -0.4), 0.01, frameM);
    add(chair, new THREE.CylinderGeometry(0.03, 0.035, 0.32, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3e, metalness: 0.7, roughness: 0.4 }), W + 0.04, 0.4, 0.1);
    add(chair, new THREE.BoxGeometry(0.1, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: 0xd8202a, roughness: 0.5 }), -W - 0.05, 0.41, 0.14);
    // the balloons: two bunches, one tied at the head of the chair and one at the foot, strings to each balloon.
    // Drawn in world space (one instanced mesh) so balloons that come loose can float away on their own.
    const MAX = 34, FREE = 24, bal = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10).scale(1, 1.18, 1), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.94 }), MAX + FREE);
    bal.frustumCulled = false; bal.castShadow = true;
    const knot = [V(0, 0.64, 0.52), V(0, 0.22, -0.5)];                                      // tie points (head, foot), chair space
    const cols = [0xe8342a, 0x2a7ae8, 0x2ac85a, 0xf2c21a, 0xe83a9a, 0x8a4ae8, 0xf2802a, 0x2ac8c8, 0xffffff, 0x9ae82a];
    const slots = [];
    for (let i = 0; i < MAX; i++) {
      const g = i % 2, a = rand(0, 6.28), r = rand(0.04, 0.24), h = rand(1.15, 1.6) + (g ? -0.1 : 0);
      slots.push({ g, off: V(Math.cos(a) * r, h, Math.sin(a) * r * 0.8 + (g ? 0.08 : -0.08)), size: rand(0.09, 0.115), on: true, fill: 1, ph: rand(0, 6), col: new THREE.Color(pick(cols)) });
      bal.setColorAt(i, slots[i].col);
    }
    const free = [];
    for (let i = 0; i < FREE; i++) bal.setColorAt(MAX + i, new THREE.Color(1, 1, 1));
    const strings = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3)), new THREE.LineBasicMaterial({ color: 0xdedede, transparent: true, opacity: 0.75 }));
    strings.frustumCulled = false;
    const world = new THREE.Group(); world.add(bal, strings); world.userData.shared = false;
    this.fxGroup.add(world);
    let releaseT = 0, fillT = 0, sway = new THREE.Vector2(), lean = [new THREE.Vector3(), new THREE.Vector3()];
    const popSound = (p, popped) => {
      const ctx = sfx.ctx; if (!ctx || sfx.muted) return;
      const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * (popped ? 0.08 : 0.25)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, popped ? 4 : 1.5);
      const src = ctx.createBufferSource(); src.buffer = buf; const f = ctx.createBiquadFilter(); f.type = popped ? 'highpass' : 'bandpass'; f.frequency.value = popped ? 900 : 2400;
      const g2 = ctx.createGain(); const dist = Math.hypot(p.x - G.camTarget.x, p.z - G.camTarget.z); g2.gain.value = (popped ? 0.5 : 0.12) / (1 + dist * 0.05);
      src.connect(f); f.connect(g2); g2.connect(sfx.bus || ctx.destination); src.start(t);
    };
    const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), wp = new THREE.Vector3();
    return {
      root,
      // sinking lets balloons go (from alternate bunches, down to a floor of 10 that always keeps him flying); rising
      // fills them back up one at a time
      lift(dt, up, down) {
        const on = slots.filter((b) => b.on);
        if (down && on.length > 10 && (releaseT -= dt) <= 0) {
          releaseT = rand(0.22, 0.4);
          const ready = on.filter((x) => x.fill >= 1), b = ready.length ? pick(ready) : null;
          if (b) {
            b.on = false; b.fill = 0;
            const w = this.balloonWorld(b), popped = Math.random() < 0.35;
            if (popped) { G.fx.sparks(w.x, w.y, w.z, 6, b.col.r * 2, b.col.g * 2, b.col.b * 2, 3); popSound(w, true); }
            else { const fr = free.find((x) => !x.live) || (free.length < FREE ? (free[free.length] = { i: MAX + free.length }) : null); if (fr) Object.assign(fr, { live: true, p: w.clone(), v: new THREE.Vector3(rand(-0.6, 0.6), rand(1.6, 2.6), rand(-0.6, 0.6)), t: 0, size: b.size, col: b.col }), bal.setColorAt(fr.i, b.col), bal.instanceColor.needsUpdate = true; popSound(w, false); }
          }
        }
        if (up && (fillT -= dt) <= 0) {
          const b = slots.find((x) => !x.on); fillT = 0.18;
          if (b) { b.on = true; b.fill = 0.05; b.col.set(pick(cols)); bal.setColorAt(slots.indexOf(b), b.col); bal.instanceColor.needsUpdate = true; }
        }
        for (const b of slots) if (b.on && b.fill < 1) b.fill = Math.min(1, b.fill + dt * 2.2);
      },
      count() { return { on: slots.filter((b) => b.on).length, floating: free.filter((f) => f.live).length }; },
      balloonWorld(b) { root.updateMatrixWorld(true); return wp.copy(knot[b.g]).add(b.off).add(lean[b.g]).applyMatrix4(chair.matrixWorld).clone(); },
      pose(yaw, vel, dt) {
        root.rotation.set(0, yaw, 0);
        // the chair swings a little under the balloons as it speeds up, slows and turns
        const fwd = vel.x * -Math.sin(yaw) + vel.z * -Math.cos(yaw), side = vel.x * Math.cos(yaw) + vel.z * -Math.sin(yaw);
        sway.x += (clamp(fwd / 13, -1, 1) * 0.16 - sway.x) * (1 - Math.exp(-dt * 2.5)); sway.y += (clamp(-side / 13, -1, 1) * 0.14 - sway.y) * (1 - Math.exp(-dt * 2.5));
        chair.rotation.set(-sway.x, 0, sway.y);
        this.speed = Math.hypot(vel.x, vel.z); this.vy = vel.y;
      },
      update(dt) {
        root.position.copy(self.pos);
        dad.update(dt, 'seated');
        dad.legL.upper.rotation.x = dad.legR.upper.rotation.x = 1.3; dad.legL.mid.rotation.x = dad.legR.mid.rotation.x = -0.12; dad.legL.end.rotation.x = dad.legR.end.rotation.x = -0.9;   // legs out along the chair
        dad.armL.upper.rotation.set(0.9, 0, -0.3); dad.armL.mid.rotation.x = 1.0; dad.armR.upper.rotation.set(0.35, 0, 0.25); dad.armR.mid.rotation.x = 0.8;
        blades.rotation.z += dt * (6 + (this.speed || 0) * 6);
        root.updateMatrixWorld(true);
        // the bunches lean away from any wall they'd push into, so they never sink into a building
        const B = G.buildings, t = performance.now() * 0.001;
        for (let g = 0; g < 2; g++) {
          const top = wp.copy(knot[g]).add(V(0, 1.4, 0)).applyMatrix4(chair.matrixWorld), cell = B.inside(top);
          const want = new THREE.Vector3();
          if (cell) { const dx = top.x - cell.x, dz = top.z - cell.z; const away = Math.abs(dx) / cell.hx > Math.abs(dz) / cell.hz ? V(Math.sign(dx) * (cell.hx - Math.abs(dx) + 0.3), 0, 0) : V(0, 0, Math.sign(dz) * (cell.hz - Math.abs(dz) + 0.3)); want.copy(away).applyQuaternion(q.copy(chair.getWorldQuaternion(new THREE.Quaternion())).invert()); want.y = -Math.min(0.8, cell.hy); }
          lean[g].lerp(want, 1 - Math.exp(-dt * 6));
        }
        // balloons on the chair: bobbing on their strings, trailing a little behind the motion
        const pos = strings.geometry.attributes.position.array;
        const trail = V(sway.x * 0.0, -(this.vy || 0) * 0.02, (this.speed || 0) * 0.012);
        slots.forEach((b, i) => {
          if (!b.on) { mat4.makeScale(0, 0, 0); bal.setMatrixAt(i, mat4); pos.fill(0, i * 6, i * 6 + 6); return; }
          const o = wp.copy(knot[b.g]).add(b.off).add(lean[b.g]).add(trail).add(V(Math.sin(t * 1.3 + b.ph) * 0.03, Math.sin(t * 1.7 + b.ph) * 0.02, Math.cos(t * 1.1 + b.ph) * 0.03));
          const w = o.clone().applyMatrix4(chair.matrixWorld), k0 = knot[b.g].clone().applyMatrix4(chair.matrixWorld);
          const s2 = b.size * (0.2 + 0.8 * b.fill);
          mat4.compose(w, q.identity(), sc.set(s2, s2, s2)); bal.setMatrixAt(i, mat4);
          pos.set([k0.x, k0.y, k0.z, w.x, w.y - s2 * 1.15, w.z], i * 6);
        });
        // the ones that got away: up and off on the wind, swaying, shrinking into the sky
        for (const fr of free) {
          if (!fr.live) { if (fr.i != null) { mat4.makeScale(0, 0, 0); bal.setMatrixAt(fr.i, mat4); } continue; }
          fr.t += dt; fr.v.y += dt * 0.4; fr.v.x += Math.sin(fr.t * 2 + fr.i) * dt * 0.8;
          fr.p.addScaledVector(fr.v, dt);
          if (fr.t > 9 || B.inside(fr.p)) { fr.live = false; if (fr.t <= 9) popSound(fr.p, true); continue; }
          mat4.compose(fr.p, q.identity(), sc.setScalar(fr.size)); bal.setMatrixAt(fr.i, mat4);
        }
        bal.instanceMatrix.needsUpdate = true; strings.geometry.attributes.position.needsUpdate = true;
      },
      muzzle(second) { root.updateMatrixWorld(true); return new THREE.Vector3(second ? -W - 0.05 : W + 0.04, 0.41, second ? -0.04 : -0.08).applyMatrix4(chair.matrixWorld); },
      dispose() { this.fxGroupRemove = true; self.fxGroup.remove(world); bal.geometry.dispose(); strings.geometry.dispose(); },
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

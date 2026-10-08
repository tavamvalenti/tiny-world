// RICK & MORTY: fly Rick's ship (with Rick and Morty aboard) through Tiny World. A crossover from Cosmic Solitude:
// the ship, the crew, the flight model, the guns and bombs, the intergalactic radio, the crew's voice lines and the
// ship's own sounds all come from there (src/entities/ship/Ship.ts, src/gameplay/CameraRig.ts, src/combat/Combat.ts,
// src/audio/Radio.ts, src/audio/CrewChatter.ts, src/ui/RadioWidget.ts), kept as they were apart from:
//   - scale: Cosmic Solitude is 1 unit = 1 m; here everything is S times that so the ship (≈3.2 across) sits in
//     the city like a vehicle and Rick and Morty match the people on the street
//   - speed: the "near the ground in an atmosphere" envelope, slowed right down for a city a few hundred units wide
//   - no Sonic Drive, no landing/planets/autopilot/map; bombs and guns don't run out (no spaceports here)
//   - damage: a bolt hits like Tiny World's laser does, a bomb goes off exactly like Tiny World's bomb
import * as THREE from 'three';
import { G, clamp, rand, blast } from './core.js';
import { sfx } from './audio.js';
import { RickShipModel, CartoonCharacter } from './rickship.js';

const S = 0.42;                          // Cosmic Solitude metres -> Tiny World units
const VMAX = 11;                          // top speed near the ground (CS: 240 m/s), x(1 + 1.4 boost)
const ACCEL = VMAX * 1.4;                 // CS: 120 + vmax * 0.9
const VERT = 10;                          // vertical thrusters (R up, F down)
const BOLT_SPEED = 90, BOLT_LIFE = 1.35;  // lasers: 9 shots/s, alternating muzzles
const BASE = 'assets/rick/';
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _z = new THREE.Vector3(0, 0, 1);

const CSS = `
:root{--rk-ease:cubic-bezier(.2,.8,.2,1)}
#rickBtn{position:relative;display:flex;align-items:center;font:800 11px Inter;letter-spacing:.2em;color:#eaffd8;padding:8px 16px 8px 54px;border-radius:999px;margin:-3px 0 -3px 10px;cursor:pointer;user-select:none;
  border:1px solid rgba(150,255,120,.55);background:linear-gradient(90deg,rgba(40,140,60,.55),rgba(20,40,30,.55));backdrop-filter:blur(8px);
  box-shadow:0 0 16px -3px rgba(120,255,90,.7),inset 0 0 12px rgba(150,255,120,.2);text-shadow:0 0 8px rgba(160,255,120,.8);transition:transform .25s cubic-bezier(.2,1.4,.4,1),filter .2s,box-shadow .3s}
#rickBtn:hover{transform:translateY(-3px);filter:brightness(1.15);box-shadow:0 0 28px 0 rgba(120,255,90,.85),inset 0 0 14px rgba(150,255,120,.3)}
#rickBtn .rk-portal{position:absolute;left:3px;bottom:-5px;width:48px;height:48px;pointer-events:none;transition:transform .35s cubic-bezier(.2,1.4,.4,1)}
#rickBtn .rk-swirl{position:absolute;inset:5px;border-radius:50%;background:conic-gradient(from 0deg,#d9ff9a,#2fbf3a,#8dff52,#0b6a22,#c8ff7a,#1e9f33,#e9ffb0,#2fbf3a,#d9ff9a);
  -webkit-mask:radial-gradient(circle,#000 0 30%,rgba(0,0,0,.85) 48%,#000 62%,transparent 71%);mask:radial-gradient(circle,#000 0 30%,rgba(0,0,0,.85) 48%,#000 62%,transparent 71%);
  filter:blur(.6px) drop-shadow(0 0 6px #7dff4a);animation:rkSpin 2.2s linear infinite}
#rickBtn .rk-swirl.s2{inset:11px;opacity:.75;mix-blend-mode:screen;animation-duration:1.4s;animation-direction:reverse}
#rickBtn .rk-core{position:absolute;inset:16px;border-radius:50%;background:radial-gradient(circle,#f4ffe6,#9dff6a 45%,transparent 72%);animation:rkPulse 1.6s ease-in-out infinite}
#rickBtn .rk-chars{position:absolute;left:50%;bottom:10px;width:54px;transform:translateX(-50%) translateY(12px) scale(.78);transform-origin:50% 100%;transition:transform .45s cubic-bezier(.2,1.5,.4,1),filter .3s;
  -webkit-mask:linear-gradient(#000 70%,transparent 96%);mask:linear-gradient(#000 70%,transparent 96%);filter:drop-shadow(0 0 4px rgba(150,255,110,.6))}
#rickBtn:hover .rk-chars{transform:translateX(-50%) translateY(-6px) scale(1.05) rotate(-3deg)}
#rickBtn:hover .rk-portal{transform:scale(1.18)}
#rickBtn:hover .rk-swirl{animation-duration:.9s}
#rickBtn .rk-spark{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:#d6ff9e;box-shadow:0 0 6px #7dff4a;opacity:0}
#rickBtn:hover .rk-spark{animation:rkSpark 1.1s ease-out infinite}
#rickBtn .rk-spark:nth-child(5){--a:20deg}#rickBtn .rk-spark:nth-child(6){--a:140deg;animation-delay:.35s}#rickBtn .rk-spark:nth-child(7){--a:260deg;animation-delay:.7s}#rickBtn .rk-spark:nth-child(8){--a:330deg;animation-delay:.2s}
@keyframes rkSpark{0%{opacity:1;transform:rotate(var(--a)) translateX(10px)}100%{opacity:0;transform:rotate(calc(var(--a) + 90deg)) translateX(28px)}}
@keyframes rkSpin{to{transform:rotate(360deg)}}
@keyframes rkPulse{50%{transform:scale(1.2);opacity:.7}}
#rickBtn.warp .rk-portal{animation:rkWarpBtn .6s ease-in}
@keyframes rkWarpBtn{40%{transform:scale(1.6)}100%{transform:scale(1)}}
#rickBtn.on{border-color:#d6ffc8;box-shadow:0 0 26px 2px rgba(120,255,90,.9)}
html.touch #rickBtn{display:none}
body.rick-on #weapons .w, body.rick-on #weapons .sep, body.rick-on #worldBtn, body.rick-on #tiltCtl, body.rick-on #help, body.rick-on #placeHint, body.rick-on #worldMenu{display:none!important}
#rickHud{position:absolute;inset:0;pointer-events:none;display:none;font-family:Inter,system-ui,sans-serif}
body.rick-on #rickHud{display:block}
#rickHud .rk-reticle{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid rgba(140,255,170,.75);box-shadow:0 0 10px rgba(120,255,150,.5)}
#rickHud .rk-reticle::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#bfffcf}
#rickHud .rk-keys{position:absolute;left:16px;bottom:calc(4.2vh + 150px);display:flex;flex-direction:column;gap:5px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(230,255,235,.7);text-shadow:0 1px 3px rgba(0,0,0,.8)}
#rickHud .key{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:16px;padding:0 4px;margin-right:4px;border-radius:3px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.35);font:600 9px Inter;color:#fff;letter-spacing:0}
#rickHud .rk-heat{position:absolute;width:60px;margin:26px 0 0 -30px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
#rickHud .rk-heat i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6dff9a,#ffd36b,#ff5a3c)}
#rickHud .rk-heat.hot i{animation:rkBlink .35s steps(2) infinite}
@keyframes rkBlink{50%{opacity:.35}}
#rickHud .rk-lock{position:absolute;left:50%;bottom:9vh;transform:translateX(-50%);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#1a0f00;background:#ffd36b;padding:6px 14px;border-radius:999px;opacity:0;transition:opacity .25s;box-shadow:0 0 18px rgba(255,190,80,.6)}
#rickHud .rk-lock.on{opacity:1}
#rickHud .rk-tip{position:absolute;left:50%;top:calc(4.2vh + 64px);transform:translateX(-50%);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#d8ffe0;background:rgba(10,20,14,.55);border:1px solid rgba(140,255,170,.35);padding:7px 14px;border-radius:999px;transition:opacity .4s}
.radio-widget{position:absolute;top:calc(4.2vh + 58px);right:16px;width:268px;padding:12px 14px 10px;border-radius:6px;background:linear-gradient(160deg,rgba(20,34,54,.62),rgba(6,10,18,.7));border:1px solid rgba(127,212,255,.2);box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 1px 0 rgba(200,238,255,.12),0 0 24px rgba(127,212,255,.08);backdrop-filter:blur(10px);opacity:0;transform:translateY(-8px);transition:opacity .5s var(--rk-ease),transform .5s var(--rk-ease),box-shadow .6s;pointer-events:none;font-family:Inter,system-ui,sans-serif;color:#eef6ff}
.radio-widget.on{opacity:.82;transform:none}
.radio-widget.on.flare{opacity:1;box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 1px 0 rgba(200,238,255,.2),0 0 34px rgba(127,212,255,.35);border-color:rgba(127,212,255,.55)}
.radio-top{display:flex;align-items:center;gap:8px}
.radio-dot{width:6px;height:6px;border-radius:50%;background:#ff6b6b;box-shadow:0 0 8px #ff6b6b;animation:radioDot 1.6s ease-in-out infinite}
@keyframes radioDot{50%{opacity:.35}}
.radio-kicker{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:8.5px;letter-spacing:.32em;text-transform:uppercase;color:rgba(127,212,255,.85);text-shadow:0 0 8px rgba(127,212,255,.6)}
.radio-station{display:flex;align-items:baseline;gap:10px;margin-top:8px;white-space:nowrap;overflow:hidden}
.radio-freq{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:20px;font-weight:300;color:#fff;text-shadow:0 0 14px rgba(127,212,255,.7)}
.radio-name{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:rgba(200,238,255,.9);overflow:hidden;text-overflow:ellipsis}
.radio-genre{margin-top:2px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:rgba(127,212,255,.7)}
.radio-now{display:flex;gap:11px;align-items:center;margin-top:10px}
.radio-cover{position:relative;flex:0 0 52px;width:52px;height:52px;border-radius:5px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.55),0 0 18px rgba(127,212,255,.25);border:1px solid rgba(200,238,255,.25);display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:15px;color:rgba(255,255,255,.9)}
.radio-cover-img{width:100%;height:100%;object-fit:cover;display:block}
.radio-meta{min-width:0;flex:1}
.radio-song{font-size:13px;font-weight:500;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.radio-artist{margin-top:3px;font-size:10.5px;color:rgba(236,240,244,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.radio-eq{display:block;width:100%;height:28px;margin-top:8px;filter:drop-shadow(0 0 4px rgba(127,212,255,.6))}
.radio-keys{margin-top:6px;font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(236,240,244,.4)}
.radio-keys .key{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:15px;padding:0 4px;margin-right:3px;border-radius:3px;border:1px solid rgba(255,255,255,.3);font-size:9px;color:#fff}
.radio-widget.tuned .radio-station,.radio-widget.tuned .radio-meta{animation:radioTune .7s var(--rk-ease)}
@keyframes radioTune{0%{opacity:0;filter:blur(6px);transform:translateX(8px)}100%{opacity:1;filter:none;transform:none}}
.radio-widget.tuned .radio-cover{animation:coverIn .7s var(--rk-ease)}
@keyframes coverIn{0%{opacity:0;transform:scale(.85) rotate(-4deg);filter:blur(4px)}100%{opacity:1;transform:none;filter:none}}
.crew-caption{position:absolute;left:50%;bottom:calc(4.2vh + 120px);transform:translate(-50%,6px);width:min(720px,78vw);text-align:center;font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.5;color:rgba(255,255,255,.96);text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 14px rgba(0,0,0,.75),0 0 28px rgba(0,0,0,.5);opacity:0;transition:opacity .4s var(--rk-ease),transform .4s var(--rk-ease);pointer-events:none}
.crew-caption.show{opacity:1;transform:translate(-50%,0)}
.crew-caption .who{display:block;margin-bottom:3px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#a6e4ff}
`;

// ---------------------------------------------------------------- sound (the ship's own; Cosmic Solitude's AudioManager hooks)
class ShipAudio {
  constructor() { this.buf = {}; this.loaded = false; }
  init() {
    if (this.ctx || !sfx.ready) return !!this.ctx;
    const I = sfx._internals();
    this.ctx = I.ctx;
    this.out = this.ctx.createGain(); this.out.gain.value = 1.8; this.out.connect(I.sfxBus);
    this.music = this.ctx.createGain(); this.music.gain.value = 2.2; this.music.connect(I.sfxBus);
    if (!this.loaded) {
      this.loaded = true;
      for (const [k, f] of [['engine', 'sfx/loop_engine.mp3'], ['impact0', 'sfx/impact_0.mp3'], ['impact1', 'sfx/impact_1.mp3'], ['static', 'sfx/radio_static.mp3']]) this.load(k, BASE + f);
    }
    return true;
  }
  load(k, url) {
    return fetch(url).then((r) => r.arrayBuffer()).then((ab) => this.ctx.decodeAudioData(ab)).then((b) => { this.buf[k] = b; return b; }).catch((e) => console.warn('ship sound unavailable', url, e));
  }
  has(k) { return !!this.buf[k]; }
  play(k, vol = 1) {
    const b = this.buf[k]; if (!b || !this.ctx) return 0;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); g.gain.value = vol;
    s.buffer = b; s.connect(g); g.connect(this.out); s.start(); return b.duration;
  }
  // the engine loop: level and pitch follow the throttle (CS setLoop('engine'): rate 0.85 + param * 0.45, mix 0.32)
  engine(level, param) {
    if (!this.ctx || !this.buf.engine) return;
    if (!this.eng) {
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); g.gain.value = 0;
      s.buffer = this.buf.engine; s.loop = true; s.connect(g); g.connect(this.out); s.start();
      this.eng = { s, g };
    }
    const t = this.ctx.currentTime;
    this.eng.g.gain.setTargetAtTime(clamp(level, 0, 1) * 0.32, t, 0.12);
    this.eng.s.playbackRate.setTargetAtTime(0.85 + param * 0.45, t, 0.2);
  }
  // Cosmic Solitude's synthesized combat sounds (laser.fire, bomb.drop, overheat): pitch sweeps through a lowpass
  sweep(f0, f1, start, dur, vol, type = 'sawtooth') {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f0, t + start); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + start + dur);
    g.gain.setValueAtTime(vol, t + start); g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
    lp.type = 'lowpass'; lp.frequency.value = 3800;
    o.connect(lp); lp.connect(g); g.connect(this.out); o.start(t + start); o.stop(t + start + dur + 0.05);
  }
  // the guns: a harsh, gritty zap: overdriven saw and square dives, plus a crack of noise at the front
  laser() {
    const c = this.ctx; if (!c) return;
    if (!this.drive) {
      this.drive = c.createWaveShaper();
      const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 6) * 0.9; }
      this.drive.curve = curve; this.driveOut = c.createGain(); this.driveOut.gain.value = 0.5;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      this.drive.connect(hp); hp.connect(this.driveOut); this.driveOut.connect(this.out);
      const n = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
    }
    const t = c.currentTime, j = 1 + (Math.random() - 0.5) * 0.12;
    const dive = (type, f0, f1, dur, vol) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type;
      o.frequency.setValueAtTime(f0 * j, t); o.frequency.exponentialRampToValueAtTime(f1 * j, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.drive); o.start(t); o.stop(t + dur + 0.02);
    };
    dive('sawtooth', 2600, 170, 0.15, 0.22); dive('square', 1300, 90, 0.12, 0.14); dive('sawtooth', 2645, 175, 0.14, 0.12);
    const ns = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain();
    ns.buffer = this.noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.8;
    ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    ns.connect(bp); bp.connect(ng); ng.connect(this.drive); ns.start(t);
  }
  bombDrop() { this.sweep(900, 120, 0, 0.7, 0.03 * 0.8, 'triangle'); }
  overheat() { this.sweep(600, 120, 0, 0.6, 0.05 * 0.8, 'square'); }
  stop() { if (this.eng) this.eng.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2); }
}

// ---------------------------------------------------------------- the intergalactic radio (Radio.ts)
class Radio {
  constructor(audio) {
    this.audio = audio; this.stations = []; this.index = 0; this.songIndex = 0; this.on = false;
    this.fade = 0; this.fadeTarget = 0; this.voiceDuck = 1; this.offsets = []; this.analyser = null; this.changed = 0;
    try { this.index = +localStorage.getItem('tinyworld.rick.station') || 0; this.wasOn = localStorage.getItem('tinyworld.rick.radio') === '1'; } catch { this.wasOn = false; }
  }
  load() {
    if (this.loading) return this.loading;
    return (this.loading = fetch(BASE + 'radio/stations.json').then((r) => (r.ok ? r.json() : [])).then((list) => {
      this.stations = list.filter((s) => s.songs && s.songs.length);
      this.offsets = this.stations.map(() => Math.random() * 3600);
      this.index = Math.min(this.index, Math.max(0, this.stations.length - 1));
    }).catch(() => { /* no radio installed */ }));
  }
  get station() { return this.stations[this.index] || null; }
  get song() { const st = this.station; return st ? st.songs[this.songIndex] : null; }
  url(p) { return BASE + 'radio/' + p; }
  save() { try { localStorage.setItem('tinyworld.rick.station', String(this.index)); localStorage.setItem('tinyworld.rick.radio', this.on ? '1' : '0'); } catch { /* not saved */ } }
  toggle() { if (this.stations.length) this.setOn(!this.on); }
  setOn(on) {
    if (!this.stations.length) return;
    this.on = on; this.save();
    if (on) { this.audio.play('static', 0.3); this.tuneLive(); } else this.fadeTarget = 0;
    this.changed = 4;
  }
  next(dir = 1) {
    if (!this.stations.length) return;
    if (!this.on) return this.setOn(true);
    const n = this.stations.length;
    this.index = (((this.index + dir) % n) + n) % n; this.save();
    this.audio.play('static', 0.3); this.tuneLive(); this.changed = 4;
  }
  skip() { const st = this.station; if (!this.on || !st) return; this.audio.play('static', 0.25); this.playSong((this.songIndex + 1) % st.songs.length, 0); this.changed = 4; }
  element() {
    if (!this.el) {
      this.el = new Audio(); this.el.preload = 'auto'; this.el.volume = 0;
      this.el.addEventListener('ended', () => { const st = this.station; if (!st || !this.on) return; this.playSong((this.songIndex + 1) % st.songs.length, 0); this.changed = 4; });
    }
    if (!this.analyser && this.audio.ctx) {
      try {
        const src = this.audio.ctx.createMediaElementSource(this.el);
        this.analyser = this.audio.ctx.createAnalyser(); this.analyser.fftSize = 256;
        src.connect(this.analyser); this.analyser.connect(this.audio.music);
      } catch { /* plays straight out */ }
    }
    return this.el;
  }
  // every station is "on air": tuning in joins its playlist where the broadcast currently is
  tuneLive() {
    const st = this.station; if (!st) return;
    const total = st.songs.reduce((s, x) => s + Math.max(1, x.duration), 0);
    let t = (Date.now() / 1000 + this.offsets[this.index]) % total, i = 0;
    while (i < st.songs.length - 1 && t >= st.songs[i].duration) { t -= st.songs[i].duration; i++; }
    this.fade = 0;
    this.playSong(i, Math.max(0, Math.min(t, st.songs[i].duration - 2)));
  }
  playSong(i, at) {
    const st = this.station; if (!st) return;
    this.songIndex = i;
    const el = this.element(), src = new URL(this.url(st.songs[i].file), location.href).href;
    this.fadeTarget = 1;
    const start = () => { try { el.currentTime = at; } catch { /* not seekable yet */ } el.play().catch(() => undefined); };
    if (el.src !== src) { el.src = src; el.addEventListener('loadedmetadata', start, { once: true }); el.load(); } else start();
  }
  // leaving the ship: the music fades out (and picks the broadcast up again when you're back aboard)
  halt() { this.fadeTarget = 0; }
  update(dt) {
    this.changed = Math.max(0, this.changed - dt);
    if (!this.el) return;
    this.fade += (this.fadeTarget - this.fade) * Math.min(1, dt * 4);
    this.el.volume = clamp(this.fade * this.voiceDuck, 0, 1);
    if (this.fadeTarget === 0 && this.fade < 0.01 && !this.el.paused) this.el.pause();
  }
}

// ---------------------------------------------------------------- crew chatter (CrewChatter.ts)
const REACT = { crash: { p: 0.75, cooldown: 25 }, fast: { p: 0.3, cooldown: 120 }, land: { p: 0.55, cooldown: 60 }, takeoff: { p: 0.45, cooldown: 60 } };
class Chatter {
  constructor(audio, radio, caption) {
    this.audio = audio; this.radio = radio; this.caption = caption;
    this.lines = []; this.timer = 30 + Math.random() * 20; this.speaking = 0; this.sinceLine = 999; this.recent = []; this.cooldowns = new Map(); this.followUp = null; this.active = false;
  }
  load() {
    if (this.loading) return;
    this.loading = fetch(BASE + 'voice/lines.json').then((r) => (r.ok ? r.json() : [])).then((list) => {
      this.lines = list.map((l) => ({ ...l, tags: l.tags || ['idle'] }));
      this.lines.forEach((l, i) => this.audio.load('voice.' + i, BASE + 'voice/' + l.file));
    }).catch(() => undefined);
  }
  react(tag) {
    if (!this.active || this.speaking > 0 || this.followUp) return;
    const r = REACT[tag];
    if (!r || (this.cooldowns.get(tag) || 0) > 0 || this.sinceLine < (tag === 'crash' ? 6 : 14) || Math.random() > r.p) return;
    const i = this.pick((l) => l.tags.includes(tag));
    if (i < 0) return;
    this.cooldowns.set(tag, r.cooldown); this.say(i, true);
  }
  update(dt, active, activity) {
    this.active = active; this.sinceLine += dt;
    for (const [k, v] of this.cooldowns) this.cooldowns.set(k, v - dt);
    this.radio.voiceDuck += ((this.speaking > 0 ? 0.3 : 1) - this.radio.voiceDuck) * Math.min(1, dt * 5);
    if (this.speaking > 0) { this.speaking -= dt; if (this.speaking <= 0) this.caption.classList.remove('show'); return; }
    if (this.followUp) {
      this.followUp.delay -= dt;
      if (this.followUp.delay <= 0) { const f = this.followUp; this.followUp = null; if (active) this.say(f.index, false); }
      return;
    }
    if (!active || !this.lines.length) return;
    // busy pilots hear a lot more from the crew; idle ones get near-silence
    this.timer -= dt * (0.08 + 1.7 * Math.pow(clamp(activity, 0, 1), 1.2));
    if (this.timer > 0) return;
    const i = this.pick((l) => l.tags.includes('idle'));
    if (i >= 0) this.say(i, true); else this.timer = 10;
  }
  pick(filter) {
    const ok = (i) => filter(this.lines[i]) && this.audio.has('voice.' + i);
    let pool = this.lines.map((_, i) => i).filter((i) => ok(i) && !this.recent.includes(i));
    if (!pool.length) pool = this.lines.map((_, i) => i).filter(ok);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : -1;
  }
  say(i, allowAnswer) {
    const line = this.lines[i], dur = this.audio.play('voice.' + i, 0.32 * 2.2);
    this.speaking = dur + 0.15; this.sinceLine = -dur;
    this.recent.push(i); if (this.recent.length > Math.min(12, this.lines.length - 3)) this.recent.shift();
    const who = line.speaker === 'both' ? '' : line.speaker === 'rick' ? 'Rick' : 'Morty';
    this.caption.innerHTML = (who ? `<span class="who">${who}</span>` : '') + line.text.replace(/</g, '&lt;');
    this.caption.classList.add('show');
    if (allowAnswer) {
      let answer = -1;
      if (line.speaker === 'rick' && Math.random() < 0.65) answer = this.pick((l) => l.tags.includes('reply'));
      else if (line.speaker === 'morty' && !line.tags.includes('reply') && Math.random() < 0.85) answer = this.pick((l) => l.tags.includes('rickReply'));
      else if (line.speaker === 'morty' && Math.random() < 0.35) answer = this.pick((l) => l.tags.includes('rickReply'));
      if (answer >= 0 && answer !== i) this.followUp = { index: answer, delay: 0.35 + Math.random() * 0.6 };
    }
    this.timer = 55 + Math.random() * 60 + dur * 1.5;
  }
}

// ---------------------------------------------------------------- the mode
export class RickMode {
  constructor(scene, camera, post, cam, renderer) {
    this.canvas = renderer.domElement; this.scene = scene; this.camera = camera; this.post = post; this.cam = cam;
    this.active = false; this.built = false;
    this.keys = {}; this.stick = new THREE.Vector2(); this.activity = 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.angVel = new THREE.Vector3();
    this.throttle = 0; this.boost = 0; this.lostControl = 0;
    this.heat = 0; this.overheated = false; this.fireCd = 0; this.secCd = 0; this.muzzleSide = 1;
    this.bolts = []; this.bombs = [];
    // chase camera (CameraRig 'ship' mode)
    this.camPos = new THREE.Vector3(); this.camQuat = new THREE.Quaternion(); this.offset = new THREE.Vector3(); this.smoothUp = new THREE.Vector3(0, 1, 0);
    this.fov = 62; this.zoom = 1; this.lookBack = false; this.wasLookBack = false; this.shake = 0; this.shakeT = 0; this.camInit = false;
    this.audio = new ShipAudio();
    if (!document.getElementById('rickCss')) { const st = document.createElement('style'); st.id = 'rickCss'; st.textContent = CSS; document.head.appendChild(st); }
    this.buildHud();
    this.radio = new Radio(this.audio);
    this.chatter = new Chatter(this.audio, this.radio, this.caption);
    this.bind();
  }

  build() {
    if (this.built) return;
    this.built = true;
    this.model = new RickShipModel();
    this.group = new THREE.Group(); this.group.add(this.model.root); this.model.root.scale.setScalar(S);
    this.rick = new CartoonCharacter('rick'); this.morty = new CartoonCharacter('morty');
    this.model.seat.add(this.rick.root); this.model.passengerSeat.add(this.morty.root);
    // laser bolts: round energy beams, a soft green glow around a white-hot core, brightest at the head and
    // fading down the tail (instanced, additive, lit by nothing but themselves)
    const geo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).rotateX(Math.PI / 2);   // along +Z, uv.y = 1 at the head
    const beam = (color, edge, power) => new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying float vAlong; varying vec3 vN; varying vec3 vV;
        void main() { vAlong = uv.y; mat4 mv = modelViewMatrix * instanceMatrix; vN = normalize(mat3(mv) * normal);
          vec4 p = mv * vec4(position, 1.0); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
      fragmentShader: `uniform vec3 uColor; varying float vAlong; varying vec3 vN; varying vec3 vV;
        void main() { float core = pow(max(abs(dot(normalize(vN), normalize(vV))), 1e-4), ${edge.toFixed(1)});
          float tail = pow(max(vAlong, 1e-4), 1.6) * smoothstep(1.0, 0.9, vAlong);
          gl_FragColor = vec4(max(uColor * core * tail * ${power.toFixed(2)}, 0.0), 1.0); }`,
    });
    this.boltGlow = new THREE.InstancedMesh(geo, beam(new THREE.Color(0.25, 1.6, 0.55), 2.0, 1.4), 120);
    this.boltCore = new THREE.InstancedMesh(geo, beam(new THREE.Color(0.85, 1.6, 0.95), 0.8, 2.6), 120);
    for (const m of [this.boltGlow, this.boltCore]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 7; }
    // glow sprites: the hot head of each bolt, muzzle flashes and the green flash where a bolt lands
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(220,255,225,.9)'); r.addColorStop(0.45, 'rgba(110,255,140,.35)'); r.addColorStop(1, 'rgba(60,255,100,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    this.glowTex = tex;
    this.sprites = [];
    for (let i = 0; i < 48; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0.6, 1.4, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      sp.visible = false; sp.renderOrder = 8; this.sprites.push(sp);
    }
    this.flashes = [];
    this.fxGroup = new THREE.Group(); this.fxGroup.add(...this.sprites);
    // the bomb: a stubby finned casing with a nose cone, a hazard band and a blinking red light
    this.bombProto = (() => {
      const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0x5d646c, roughness: 0.35, metalness: 0.85 });
      const band = new THREE.MeshStandardMaterial({ color: 0xe9c21a, roughness: 0.5, metalness: 0.2 }), dark = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.5, metalness: 0.7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 6, 14).rotateX(Math.PI / 2), metal);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.45, 14).rotateX(Math.PI / 2), dark); nose.position.z = 0.78;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.12, 14).rotateX(Math.PI / 2), band); ring.position.z = 0.35;
      g.add(body, nose, ring);
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.38), dark);
        fin.position.set(0, 0, -0.62); fin.rotation.z = i * Math.PI / 2; fin.translateY(0.36); g.add(fin);
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 14, 1, true).rotateX(Math.PI / 2), dark); tail.position.z = -0.8; g.add(tail);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); lamp.position.set(0, 0.32, 0.1); lamp.name = 'lamp'; g.add(lamp);
      g.scale.setScalar(1.25 * S);
      return g;
    })();
    this.fxGroup.add(this.boltGlow, this.boltCore);
    this._spinQ = new THREE.Quaternion();
  }
  // a glow that pops and fades: muzzle flashes, bolt impacts
  pop(p, size, life, color) {
    const sp = this.sprites.find((s) => !s.visible && !s.userData.bolt); if (!sp) return;
    sp.visible = true; sp.position.copy(p); sp.material.color.copy(color || new THREE.Color(0.6, 1.4, 0.7)); sp.material.opacity = 1;
    sp.userData = { t: 0, life, size }; sp.scale.setScalar(size * 0.4); this.flashes.push(sp);
  }

  // ---------------- HUD
  buildHud() {
    const hud = document.getElementById('hud');
    // the button sits next to WORLD in the bottom bar
    this.btn = document.createElement('span'); this.btn.id = 'rickBtn'; this.btn.title = 'Fly Rick\'s ship';
    this.btn.innerHTML = '<span class="rk-portal"><i class="rk-swirl"></i><i class="rk-swirl s2"></i><i class="rk-core"></i><img class="rk-chars" src="assets/rick/rickmorty.png" alt=""><i class="rk-spark"></i><i class="rk-spark"></i><i class="rk-spark"></i><i class="rk-spark"></i></span>RICK &amp; MORTY';
    document.getElementById('weapons').appendChild(this.btn);
    this.hud = document.createElement('div'); this.hud.id = 'rickHud';
    this.hud.innerHTML = `<div class="rk-reticle"></div><div class="rk-heat"><i></i></div>
      <div class="rk-keys"><span><b class="key">Mouse</b>steer</span><span><b class="key">W</b>hold to fly</span><span><b class="key">S</b>brake / back</span><span><b class="key">A</b><b class="key">D</b>turn</span><span><b class="key">Q</b><b class="key">E</b>roll</span><span><b class="key">R</b><b class="key">F</b>up / down</span><span><b class="key">Shift</b>boost (2× to lock)</span><span><b class="key">Space</b>guns</span><span><b class="key">G</b>bomb</span><span><b class="key">P</b>radio</span><span><b class="key">V</b>camera</span><span><b class="key">Esc</b>leave ship</span></div>
      <div class="rk-tip">Click to grab the mouse and steer</div><div class="rk-lock">Boost locked · Shift to release</div><div class="crew-caption"></div>`;
    hud.appendChild(this.hud);
    this.reticle = this.hud.querySelector('.rk-reticle'); this.heatEl = this.hud.querySelector('.rk-heat'); this.heatBar = this.heatEl.querySelector('i');
    this.tip = this.hud.querySelector('.rk-tip'); this.lockEl = this.hud.querySelector('.rk-lock'); this.caption = this.hud.querySelector('.crew-caption');
    // the radio readout (RadioWidget.ts)
    this.rw = document.createElement('div'); this.rw.className = 'radio-widget';
    this.rw.innerHTML = `<div class="radio-top"><span class="radio-dot"></span><span class="radio-kicker">Intergalactic radio</span></div>
      <div class="radio-station"><span class="radio-freq"></span><span class="radio-name"></span></div><div class="radio-genre"></div>
      <div class="radio-now"><div class="radio-cover"><img class="radio-cover-img" alt=""></div><div class="radio-meta"><div class="radio-song"></div><div class="radio-artist"></div></div></div>
      <canvas class="radio-eq" width="120" height="28"></canvas>
      <div class="radio-keys"><span class="key">[</span><span class="key">]</span> station · <span class="key">\\</span> skip · <span class="key">P</span> off</div>`;
    this.hud.appendChild(this.rw);
    this.eq = this.rw.querySelector('canvas').getContext('2d'); this.levels = new Float32Array(18); this.eqData = new Uint8Array(128); this.rwKey = '';
  }

  bind() {
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); sfx.unlock(); this.warp(); this.active ? this.exit() : this.enter(); });
    const canvas = this.canvas;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      if (document.pointerLockElement !== canvas) { this.lock(); return; }
      if (e.button === 0) this.keys.Mouse0 = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.keys.Mouse0 = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      // the ship follows the mouse: moving it turns the ship, which stops turning shortly after the mouse stops
      this.stick.x += e.movementX * 0.007; this.stick.y += e.movementY * 0.007;
      this.activity = Math.min(1, this.activity + Math.hypot(e.movementX, e.movementY) * 0.002);
    });
    document.addEventListener('pointerlockchange', () => { if (this.tip) this.tip.style.opacity = document.pointerLockElement === canvas || !this.active ? 0 : 1; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  lock() { try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => undefined); } catch { /* the click-to-steer tip stays up */ } }

  // the button's portal flares as you jump in (or out)
  warp() {
    this.btn.classList.remove('warp'); void this.btn.offsetWidth; this.btn.classList.add('warp');
    if (this.audio.init()) { this.audio.sweep(140, 900, 0, 0.55, 0.05, 'triangle'); this.audio.sweep(900, 120, 0.45, 0.6, 0.04, 'sine'); }
  }

  // Tiny World's key handler asks first while the ship is up; returns true when the ship used the key
  key(e, down) {
    if (!this.active) return false;
    const c = e.code;
    if (c === 'KeyT' || c === 'KeyM' || c.startsWith('F')) return false;          // day/night and mute still work
    if (down && !e.repeat) {
      if (c === 'Escape') { this.exit(); return true; }
      if (c === 'KeyP') this.radio.toggle();
      if (c === 'BracketRight' || c === 'Period') this.radio.next(1);
      if (c === 'BracketLeft' || c === 'Comma') this.radio.next(-1);
      if (c === 'Backslash') this.radio.skip();
      if (c === 'KeyH') this.model.state.headlights = !this.model.state.headlights;
      if (c === 'KeyV') this.zoom = this.zoom > 1.2 ? 0.75 : this.zoom < 0.9 ? 1 : 1.6;
      if (c === 'KeyG' && this.secCd <= 0) this.dropBomb();
      // double-tap Shift locks boost on (tap Shift again to release)
      if (c === 'ShiftLeft' || c === 'ShiftRight') {
        const now = performance.now();
        if (this.boostLock) { this.boostLock = false; this.lastShift = 0; }
        else if (now - (this.lastShift || 0) < 320) { this.boostLock = true; this.lastShift = 0; }
        else this.lastShift = now;
        this.lockEl && this.lockEl.classList.toggle('on', !!this.boostLock);
      }
    }
    this.keys[c] = down;
    if (down) this.activity = Math.min(1, this.activity + 0.15);
    e.preventDefault();
    return true;
  }
  wheel(e) { this.zoom = clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.1), 0.55, 2.4); }

  enter() {
    if (!G.buildings) return;
    sfx.unlock(); this.audio.init();
    this.build();
    this.radio.load(); this.chatter.load();
    const T = this.cam, B = G.buildings;
    // appear above where the camera was looking, facing the way the view faced
    const yaw = T.yaw, ground = B.surfaceAt(T.x, T.z, 999).y;
    this.pos.set(T.x, Math.max(ground + 4, 10), T.z);
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0); this.throttle = 0; this.boost = 0; this.lostControl = 0; this.boostLock = false; this.lockEl && this.lockEl.classList.remove("on");
    this.heat = 0; this.overheated = false; this.stick.set(0, 0); this.camInit = false;
    this.scene.add(this.group, this.fxGroup);
    this.active = true; G.rick = this;
    document.body.classList.add('rick-on'); this.btn.classList.add('on');
    this.tip.style.opacity = 1;
    this.lock();
    if (this.radio.wasOn) this.radio.load().then(() => this.active && this.radio.setOn(true));
    setTimeout(() => this.chatter.react('takeoff'), 900);
    setTimeout(() => this.active && G.news && G.news.rick('sighted', this.pos.x, this.pos.z), 2500);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.scene.remove(this.group, this.fxGroup);
    this.bolts.length = 0;
    for (const b of this.bombs) { b.dead = true; this.fxGroup.remove(b.mesh); }
    for (const sp of this.sprites) { sp.visible = false; sp.userData = {}; }
    this.flashes.length = 0;
    this.audio.stop(); this.radio.wasOn = this.radio.on; this.radio.halt();
    this.caption.classList.remove('show');
    document.body.classList.remove('rick-on'); this.btn.classList.remove('on');
    G.news && G.news.rick('gone', this.pos.x, this.pos.z);
    this.keys = {};
    // back to the normal view, over where the ship was
    const C = this.cam, fwd = _v.set(0, 0, -1).applyQuaternion(this.quat);
    C.x = clamp(this.pos.x, C.xMin ?? -C.half, C.half); C.z = clamp(this.pos.z, C.zMin, C.zMax ?? C.half);
    C.yaw = C.yawT = Math.atan2(-fwd.x, -fwd.z); C.distT = 70; C.tiltT = 0;
  }

  // ---------------- per frame (before Tiny World's camera update): fly, and park the camera target on the ship
  update(dt) {
    if (!this.active) return;
    this.activity = Math.max(0, this.activity - dt / 25);
    this.fly(dt);
    this.collide(dt);
    this.knockAbout();
    this.weapons(dt);
    this.updateProjectiles(dt);
    // everything that follows the camera (shadows, sound, crowd detail) follows the ship
    const C = this.cam;
    C.x = this.pos.x; C.z = this.pos.z; C.dist = C.distT = 26; C.ty = 0;
    // the ship and its crew
    const ms = this.model.state;
    ms.throttle = Math.max(0.04, Math.abs(this.throttle)); ms.boost = this.boost;
    ms.headlightBoost = (G.night || 0) > 0.3 ? 1.6 : 0.5;
    this.model.update(dt); this.rick.update(dt, 'seated'); this.morty.update(dt, 'seated');
    this.group.position.copy(this.pos); this.group.quaternion.copy(this.quat);
    // sound
    this.audio.engine(1, Math.abs(this.throttle) + this.boost * 0.5);
    this.radio.update(dt);
    this.chatter.update(dt, true, this.activity);
    const speed = this.vel.length();
    if (this.boost > 0.9 && speed > VMAX * 1.8) this.chatter.react('fast');
    this.updateHud(dt);
  }

  // Ship.updateFlight, the "low and in an atmosphere" case
  fly(dt) {
    const k = this.keys, p = this.pos;
    const fwd = _v.set(0, 0, -1).applyQuaternion(this.quat).clone(), upS = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat), right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat);
    const control = this.lostControl > 0 ? Math.max(0, 1 - this.lostControl * 1.2) : 1;
    this.lostControl = Math.max(0, this.lostControl - dt);
    if (this.stick.length() > 1) this.stick.normalize();
    this.stick.multiplyScalar(Math.exp(-dt * 4));
    const ax = (a, b) => (k[b] ? 1 : 0) - (k[a] ? 1 : 0);
    const ctrl = {
      pitch: clamp(-this.stick.y + ax('ArrowUp', 'ArrowDown'), -1, 1),
      yaw: clamp(this.stick.x + (ax('KeyA', 'KeyD') + ax('ArrowLeft', 'ArrowRight')) * 0.85, -1, 1),
      roll: ax('KeyQ', 'KeyE'),
      throttleUp: !!k.KeyW, throttleDown: !!k.KeyS,
      vertical: (k.KeyR ? 1 : 0) - (k.KeyF || k.KeyC || k.ControlLeft ? 1 : 0), boost: !!(k.ShiftLeft || k.ShiftRight || this.boostLock),
    };
    // no throttle lever here: hold W to fly forward, let go and the ship eases to a hover; S brakes, then backs up
    if (control > 0.2) this.throttle = ctrl.throttleUp ? 1 : ctrl.throttleDown ? -0.3 : 0;
    const braking = ctrl.throttleDown && this.vel.dot(fwd) > 0.5;
    const boosting = ctrl.boost && control > 0.5;
    this.boost += ((boosting ? 1 : 0) - this.boost) * Math.min(1, dt * 6);
    const vmax = VMAX * (1 + this.boost * 1.4);
    const target = this.throttle * vmax, fwdSpeed = this.vel.dot(fwd);
    const accel = ACCEL * (1 + this.boost * 0.8) * control;
    const over = Math.max(0, fwdSpeed - Math.max(target, vmax));
    const decel = Math.max(accel * (braking ? 1.6 : 0.7), over * 2.5);
    const dv = clamp(target - fwdSpeed, -decel * dt, accel * dt);
    const lat = _v2.copy(this.vel).addScaledVector(fwd, -fwdSpeed);
    const grip = (3.2 + (braking ? 2.5 : 0)) * control;
    lat.multiplyScalar(Math.exp(-grip * dt));
    this.vel.copy(fwd).multiplyScalar(fwdSpeed + dv).add(lat);
    if (ctrl.vertical !== 0 && control > 0.3) this.vel.addScaledVector(upS, ctrl.vertical * VERT * dt);
    this.model.state.thrustersUp = ctrl.vertical;
    if (this.lostControl > 0) this.vel.y -= 9.8 * S * dt;                         // gravity only bites when knocked about
    // rotation (rad/s, as in Cosmic Solitude), with auto-level and coordinated banking
    const rates = new THREE.Vector3();
    if (control > 0) { rates.x = ctrl.pitch * 1.7; rates.y = -ctrl.yaw * 1.35; rates.z = -ctrl.roll * 2.3; }
    if (Math.abs(ctrl.roll) < 0.05) {
      const bank = Math.asin(clamp(right.y, -1, 1)), desired = rates.y * 0.55;
      rates.z += (desired - bank) * 2.2 * control * (Math.abs(fwd.y) < 0.95 ? 1 : 0);
    }
    const resp = 1 - Math.exp(-dt * (this.lostControl > 0 ? 0.6 : 7));
    this.angVel.lerp(rates, resp * control + (1 - control) * dt * 0.2);
    const ang = this.angVel.length() * dt;
    if (ang > 1e-9) { _q.setFromAxisAngle(_v.copy(this.angVel).normalize(), ang); this.quat.multiply(_q).normalize(); }
    p.addScaledVector(this.vel, dt);
    // the edges of the world: a soft wall out past the backdrop, and a ceiling
    const lim = 150;
    for (const a of ['x', 'z']) if (Math.abs(p[a]) > lim) { p[a] = Math.sign(p[a]) * lim; if (this.vel[a] * Math.sign(p[a]) > 0) this.vel[a] *= -0.3; }
    if (p.y > 80) { p.y = 80; if (this.vel.y > 0) this.vel.y = 0; }
    this.speedFrac = clamp(this.vel.length() / (VMAX * 2.4), 0, 1);
  }

  // Ship.collide: the hull's collision points against roofs, walls and the ground; knocked about, never destroyed
  collide() {
    const B = G.buildings; if (!B) return;
    let worst = 0, n = null, wallCell = null, wp = null;
    for (const c of this.model.colliders) {
      const w = _v.set(c[0] * S, c[1] * S, c[2] * S).applyQuaternion(this.quat).add(this.pos);
      const floor = B.surfaceAt(w.x, w.z, w.y + 0.3).y, pen = floor - w.y;
      if (pen > worst) { worst = pen; n = new THREE.Vector3(0, 1, 0); wallCell = null; wp = w.clone(); }
      const cell = B.inside(w);
      if (cell) {
        const dx = w.x - cell.x, dy = w.y - cell.y, dz = w.z - cell.z;
        const px = cell.hx - Math.abs(dx), py = cell.hy - Math.abs(dy), pz = cell.hz - Math.abs(dz);
        const m = Math.min(px, py, pz), nn = px === m ? new THREE.Vector3(Math.sign(dx), 0, 0) : py === m ? new THREE.Vector3(0, Math.sign(dy), 0) : new THREE.Vector3(0, 0, Math.sign(dz));
        if (m > worst) { worst = m; n = nn; wallCell = cell; wp = w.clone(); }
      }
    }
    if (!n) return;
    this.pos.addScaledVector(n, worst);
    const vn = this.vel.dot(n);
    if (vn >= 0) return;
    const impact = -vn;
    this.vel.addScaledVector(n, -(1 + 0.35) * vn).multiplyScalar(0.82);
    if (impact > 1.2) {
      const arm = wp.clone().sub(this.pos), torque = arm.cross(n).multiplyScalar(impact * 0.012 / S).applyQuaternion(_q.copy(this.quat).invert());
      this.angVel.add(torque.clampLength(0, 3.5));
      this.angVel.x += (Math.random() - 0.5) * Math.min(2, impact * 0.1);
      this.lostControl = Math.max(this.lostControl, clamp(impact / 3.2, 0.35, 2.2));
      const strength = Math.min(1, impact / 5.5);
      this.audio.play(Math.random() < 0.5 ? 'impact0' : 'impact1', 0.4 + strength * 0.6);
      this.shake = Math.min(1.5, this.shake + strength);
      if (strength > 0.15) this.chatter.react('crash');
      if (impact > 3 && G.news) G.news.rick('crash', wp.x, wp.z);
      if (wallCell && impact > 3) B.damageSphere(wp.x, wp.y, wp.z, 0.8, impact * 9, 0, 0, this.pos);   // a hard knock chips the wall
    }
  }

  // flying low through a crowd or traffic knocks people and cars flying
  knockAbout() {
    const A = G.agents; if (!A) return;
    const sp = this.vel.length(), bottom = this.pos.y - 1.4 * S;
    if (sp < 1.5 || bottom > 1.4) return;
    const R = 3.8 * S;
    for (const p of A.peds) {
      if (p.state === 'air' || p.state === 'gone' || p.state === 'incar' || p.hidden || p.state === 'held') continue;
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < R && bottom < p.pos.y + 0.8) A.launch(p, { x: dx / (d + 0.01), z: dz / (d + 0.01) }, 2 + sp * 0.5, 2 + sp * 0.2, false, 8);
    }
    if (sp < 4) return;
    for (const c of A.cars) {
      if (c.state === 'air' || c.state === 'hidden' || c.state === 'held') continue;
      const dx = c.pos.x - this.pos.x, dz = c.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < R + 0.5 && bottom < c.pos.y + 0.7) A.launch(c, { x: dx / (d + 0.01), z: dz / (d + 0.01) }, 1 + sp * 0.35, 1.5 + sp * 0.15, true, 4);
    }
  }

  // ---------------- guns and bombs (Combat.firePrimary / fireSecondary)
  weapons(dt) {
    this.fireCd -= dt; this.secCd -= dt;
    this.heat = Math.max(0, this.heat - dt * (this.overheated ? 0.45 : 0.32));
    if (this.overheated && this.heat < 0.3) this.overheated = false;
    const firing = this.keys.Space || this.keys.Mouse0;
    if (firing && this.fireCd <= 0 && !this.overheated) this.fireLaser();
  }
  fireLaser() {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    this.muzzleSide = -this.muzzleSide;
    const origin = new THREE.Vector3(this.muzzleSide * 2.4 * S, -0.3 * S, -3 * S).applyQuaternion(this.quat).add(this.pos);
    this.bolts.push({ pos: origin.clone(), prev: origin.clone(), vel: fwd.multiplyScalar(BOLT_SPEED).add(this.vel), life: BOLT_LIFE });
    this.pop(origin, 0.9, 0.08);
    this.heat += 0.05;
    if (this.heat >= 1) { this.heat = 1; this.overheated = true; this.audio.overheat(); }
    this.fireCd = 1 / 9;
    this.audio.laser();
  }
  dropBomb() {
    this.secCd = 0.9;
    const origin = this.pos.clone().add(new THREE.Vector3(0, -3 * S, 0));
    const mesh = this.bombProto.clone(); mesh.position.copy(origin); this.fxGroup.add(mesh);
    this.bombs.push({ pos: origin, vel: this.vel.clone().add(new THREE.Vector3(0, -25 * S, 0)), life: 25, mesh, t: 0, spin: rand(-6, 6) });
    this.pop(origin, 1.1, 0.15, new THREE.Color(1.4, 0.9, 0.4));
    this.audio.bombDrop();
  }

  updateProjectiles(dt) {
    const B = G.buildings, TH = G.terrainH;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.prev.copy(b.pos); b.pos.addScaledVector(b.vel, dt);
      const seg = _v.copy(b.pos).sub(b.prev), len = seg.length(), dir = seg.clone().normalize();
      let hit = len > 0 ? B.raycast(b.prev, dir, len) : null;
      // people and cars along the bolt's path
      const victim = this.boltVictim(b.prev, dir, len);
      if (victim && (!hit || victim.t < b.prev.distanceTo(hit.point))) hit = { point: b.prev.clone().addScaledVector(dir, victim.t), normal: new THREE.Vector3(0, 1, 0), cell: null, victim };
      if (!hit && b.pos.y <= (TH ? TH(b.pos.x, b.pos.z) : 0)) hit = { point: b.pos.clone().setY(TH ? TH(b.pos.x, b.pos.z) : 0), normal: new THREE.Vector3(0, 1, 0), cell: null };
      if (hit) { this.boltHit(hit); this.bolts.splice(i, 1); continue; }
      if (b.life <= 0) this.bolts.splice(i, 1);
    }
    for (const b of this.bombs) {
      if (b.dead) continue;
      b.life -= dt; b.vel.y -= 14 * dt; b.t += dt;
      // a thin smoke trail and a little rocket glow behind it on the way down
      if (Math.random() < dt * 30) G.fx.smokePuff(b.pos.x, b.pos.y, b.pos.z, 0.25, 0.35, 1.4);
      const prev = b.pos.clone(); b.pos.addScaledVector(b.vel, dt);
      const floor = B.surfaceAt(b.pos.x, b.pos.z, prev.y + 0.3).y;
      if (b.pos.y <= floor || B.inside(b.pos) || b.life <= 0) {
        b.dead = true;
        if (b.pos.y < floor) b.pos.y = floor;
        this.fxGroup.remove(b.mesh);
        G.weapons.bombImpact(b.pos.clone());                                         // exactly Tiny World's bomb
      }
    }
    this.bombs = this.bombs.filter((b) => !b.dead);
    // draw: each bolt a long tapered beam (the streak grows out of the muzzle over its first metres) with a hot head
    let n = 0;
    const w = 0.15, heads = this.sprites.filter((s) => s.userData.bolt);
    for (const s of heads) { s.visible = false; s.userData = {}; }
    for (const b of this.bolts) {
      if (n >= 120) break;
      const d = _v.copy(b.vel).normalize(); _q.setFromUnitVectors(_z, d);
      const len = Math.min(5.5, (BOLT_LIFE - b.life) * BOLT_SPEED * 0.9 + 0.3);
      const c = _v2.copy(b.pos).addScaledVector(d, -len / 2);
      _m.compose(c, _q, new THREE.Vector3(w * 2.8, w * 2.8, len)); this.boltGlow.setMatrixAt(n, _m);
      _m.compose(c, _q, new THREE.Vector3(w * 0.75, w * 0.75, len * 0.92)); this.boltCore.setMatrixAt(n, _m);
      const h = this.sprites.find((s) => !s.visible);
      if (h) { h.visible = true; h.userData = { bolt: true }; h.position.copy(b.pos); h.scale.setScalar(0.5); h.material.opacity = 0.8; h.material.color.setRGB(0.5, 1.5, 0.65); }
      n++;
    }
    this.boltGlow.count = this.boltCore.count = n;
    this.boltGlow.instanceMatrix.needsUpdate = this.boltCore.instanceMatrix.needsUpdate = true;
    // the bombs tumble nose-down along their fall, the red light blinking
    for (const b of this.bombs) {
      b.mesh.position.copy(b.pos);
      _q.setFromUnitVectors(_z, _v.copy(b.vel).normalize()); b.mesh.quaternion.copy(_q).multiply(this._spinQ.setFromAxisAngle(_z, b.t * b.spin));
      b.mesh.getObjectByName('lamp').visible = (b.t * 6) % 1 < 0.5;
    }
    // flashes grow and fade
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i], u = f.userData; u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) { f.visible = false; f.userData = {}; this.flashes.splice(i, 1); continue; }
      f.scale.setScalar(u.size * (0.4 + 0.8 * Math.sqrt(k))); f.material.opacity = 1 - k * k;
    }
  }
  boltVictim(o, dir, len) {
    const A = G.agents; if (!A) return null;
    let best = null;
    const test = (obj, x, y, z, r) => {
      const tx = x - o.x, ty = y - o.y, tz = z - o.z, along = tx * dir.x + ty * dir.y + tz * dir.z;
      if (along < -r || along > len + r) return;
      const d2 = tx * tx + ty * ty + tz * tz - along * along;
      if (d2 < r * r && (!best || along < best.t)) best = { obj, t: Math.max(0, along) };
    };
    for (const p of A.peds) if (!p.hidden && p.state !== 'gone' && p.state !== 'incar' && !p.dead) test(p, p.pos.x, p.pos.y + 0.4, p.pos.z, 0.45);
    for (const c of A.cars) if (c.state !== 'hidden') test(c, c.pos.x, c.pos.y + 0.35, c.pos.z, 0.8);
    if (best) best.car = A.cars.includes(best.obj);
    return best;
  }
  // a bolt lands: the same kind of damage Tiny World's laser does where it touches
  boltHit(hit) {
    const B = G.buildings, fx = G.fx, p = hit.point, n = hit.normal;
    B.damageSphere(p.x, p.y, p.z, 1.3, 60, 0.35, 0.07, this.pos);
    this.pop(_v.set(p.x + n.x * 0.15, p.y + n.y * 0.15, p.z + n.z * 0.15), 2.2, 0.22);
    fx.sparks(p.x + n.x * 0.1, p.y + n.y * 0.1, p.z + n.z * 0.1, 8, 1.2, 4, 1.6, 6);
    fx.fire.emit(p.x + n.x * 0.2, p.y + n.y * 0.2, p.z + n.z * 0.2, n.x, 1.5, n.z, rand(1, 1.8), 0.25, 1.6, 1.3, 1.2, 1);
    if (Math.random() < 0.3) fx.smokePuff(p.x + n.x * 0.4, p.y + 0.3, p.z + n.z * 0.4, 0.6, 0.12, 4);
    if (!hit.cell && !hit.victim && Math.random() < 0.5) G.ground.scorch(p.x, p.z, rand(0.4, 0.7), 0.3);
    if (hit.victim && hit.victim.car) {
      const c = hit.victim.obj;
      c.cook = (c.cook || 0) + 0.34;
      if (c.cook > 1) { c.cook = -10; G.weapons.carExplode(c); }
    }
    // people right at the spot are cut down; everyone nearby takes fright (and the news hears about it)
    blast(p.x, p.y, p.z, hit.victim && !hit.victim.car ? 2.6 : 1.6, hit.victim && !hit.victim.car ? 3 : 0.9, 'laser');
  }

  // ---------------- camera (CameraRig.updateShip), applied after Tiny World's own camera update
  applyCamera(dt) {
    if (!this.active) return;
    const cam = this.camera;
    this.shakeT += dt; this.shake = Math.max(0, this.shake - dt * 1.6);
    const shipUp = _v.set(0, 1, 0).applyQuaternion(this.quat);
    const up = _v2.copy(shipUp).lerp(new THREE.Vector3(0, 1, 0), 0.55).normalize();
    if (!this.camInit) this.smoothUp.copy(up);
    this.smoothUp.lerp(up, 1 - Math.exp(-dt * 3)).normalize();
    const U = this.smoothUp.clone(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);
    const dist = 19 * this.zoom * 0.62 * S;
    const back = fwd.clone().negate(), right = new THREE.Vector3().crossVectors(fwd, U).normalize();
    back.applyAxisAngle(right, -0.12);
    const flip = !!this.keys.KeyB;
    const desired = (flip ? fwd.clone().multiplyScalar(dist * 0.85) : back.multiplyScalar(dist)).addScaledVector(U, 3.2 * this.zoom * 0.8 * S);
    if (!this.camInit || flip !== this.wasLookBack) this.offset.copy(desired);
    this.wasLookBack = flip; this.camInit = true;
    this.offset.lerp(desired, 1 - Math.exp(-dt * 5));
    cam.position.copy(this.pos).add(this.offset);
    // never under the street or inside a roof
    const B = G.buildings, floor = B ? B.surfaceAt(cam.position.x, cam.position.z, cam.position.y + 0.2).y : 0;
    if (cam.position.y < floor + 0.4) cam.position.y = floor + 0.4;
    const look = this.pos.clone().addScaledVector(fwd, (flip ? -12 : 12) * S).addScaledVector(U, 1.2 * S);
    cam.up.copy(U); cam.lookAt(look); cam.up.set(0, 1, 0);
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.02, k = this.shakeT * 37;
      cam.quaternion.multiply(_q.setFromEuler(new THREE.Euler(Math.sin(k) * s, Math.sin(k * 1.3 + 1) * s, Math.sin(k * 0.7 + 2) * s * 0.5)));
    }
    const fov = 62 + (this.speedFrac || 0) * 8;
    this.fov += (fov - this.fov) * (1 - Math.exp(-dt * 2));
    cam.fov = this.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    // a normal lens up close: no miniature tilt-shift, and the haze set for a low, near view
    this.post.maxBlur = 0; this.post.band = 1;
    if (this.scene.fog) { this.scene.fog.near = 60; this.scene.fog.far = 280; }
  }

  // ---------------- HUD
  updateHud(dt) {
    // the aim point: where the guns converge, a little ahead of the nose
    const aim = new THREE.Vector3(0, -0.3 * S, -40).applyQuaternion(this.quat).add(this.pos).project(this.camera);
    const vis = aim.z < 1;
    this.reticle.style.display = this.heatEl.style.display = vis ? '' : 'none';
    if (vis) { this.reticle.style.left = `${(aim.x * 0.5 + 0.5) * innerWidth}px`; this.reticle.style.top = `${(-aim.y * 0.5 + 0.5) * innerHeight}px`; this.heatEl.style.left = this.reticle.style.left; this.heatEl.style.top = this.reticle.style.top; }
    this.heatBar.style.width = `${this.heat * 100}%`;
    this.heatEl.classList.toggle('hot', this.overheated);
    this.updateRadioWidget(dt);
  }
  updateRadioWidget(dt) {
    const R = this.radio, st = R.station, song = R.song, on = R.on && !!st && !!song;
    this.rw.classList.toggle('on', on);
    if (!on) return;
    const key = `${st.freq}|${song.file}`;
    if (key !== this.rwKey) {
      this.rwKey = key;
      this.rw.querySelector('.radio-freq').textContent = st.freq;
      this.rw.querySelector('.radio-name').textContent = st.name;
      this.rw.querySelector('.radio-genre').textContent = st.genre;
      this.rw.querySelector('.radio-song').textContent = song.title;
      this.rw.querySelector('.radio-artist').textContent = song.album ? `${song.artist} · ${song.album}` : song.artist;
      const img = this.rw.querySelector('.radio-cover-img');
      if (song.cover) { img.style.display = ''; img.src = R.url(song.cover); } else img.style.display = 'none';
      this.rw.classList.remove('tuned'); void this.rw.offsetWidth; this.rw.classList.add('tuned');
    }
    this.rw.classList.toggle('flare', R.changed > 0);
    // spectrum: the real analyser when the music runs through Web Audio, else a gentle idle
    const an = R.analyser, g = this.eq, W = 120, H = 28, bw = W / 18;
    if (an) an.getByteFrequencyData(this.eqData);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {
      const bin = Math.min(this.eqData.length - 1, Math.round(Math.pow(64, i / 17)));
      const raw = an ? Math.pow(this.eqData[bin] / 255, 1.3) : 0.15 + 0.1 * Math.sin(performance.now() / 300 + i);
      this.levels[i] += (raw - this.levels[i]) * Math.min(1, dt * 14);
      const bh = Math.max(1.5, this.levels[i] * (H - 2)), grad = g.createLinearGradient(0, H, 0, H - bh);
      grad.addColorStop(0, 'rgba(127, 212, 255, 0.35)'); grad.addColorStop(1, 'rgba(200, 238, 255, 0.95)');
      g.fillStyle = grad; g.fillRect(i * bw + 1, H - bh, bw - 2, bh);
    }
  }
}

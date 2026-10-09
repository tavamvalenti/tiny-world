// Procedural audio engine: no sound files. Everything is synthesized with WebAudio.
// Spatial model: sounds are placed on the ground; the listener is the hovering camera, so
// distance = ground distance from the view focus plus camera altitude. Farther sounds get
// quieter, duller (low-pass), wetter (reverb) and trail a slap echo off the city blocks.
import { G } from './core.js';

export const A = { ctx: null, muted: false };
let ctx = null, master, sfxBus, ambBus, ambVol, voiceBus, reverb, revSend, echo, echoSend;
// user volume settings (0..1), applied whenever the engine exists
const VOL = { master: 0.8, sfx: 0.5, ambience: 0.35, voices: 0.15, music: 0.6 };
let white, pink, brown;
let shotBuf = null, shotLoading = false;   // recorded gunshot sample
let rainNode = null;
function loadShot() {
  if (shotBuf || shotLoading || !ctx) return;
  shotLoading = true;
  fetch('assets/gunshot.wav').then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)).then((b) => { shotBuf = b; }).catch(() => { shotLoading = false; });
}
const voicePool = { talk: [], laugh: [], scream: [], murmur: null };

const R = (a, b) => a + Math.random() * (b - a);
const now = () => ctx.currentTime;

// ---------- setup ----------
function noiseBuffers() {
  const n = ctx.sampleRate * 4;
  white = ctx.createBuffer(1, n, ctx.sampleRate);
  pink = ctx.createBuffer(1, n, ctx.sampleRate);
  brown = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0), p = pink.getChannelData(0), b = brown.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
    last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5;
  }
}

function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // early reflections off nearby facades, then a diffuse tail
      const early = i < ctx.sampleRate * 0.12 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 2 : 0;
      d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early) * (1 - Math.exp(-i / 200));
    }
  }
  return buf;
}

function init() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = VOL.master * 1.1;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    // ambBus is used for ducking; ambVol carries the user's ambience volume
    ambVol = ctx.createGain(); ambVol.gain.value = VOL.ambience; ambVol.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(ambVol);
    voiceBus = ctx.createGain(); voiceBus.gain.value = VOL.voices; voiceBus.connect(master);
    sfxBus.gain.value = VOL.sfx;
    reverb = ctx.createConvolver(); reverb.buffer = impulse(3.6, 2.6);
    const revOut = ctx.createGain(); revOut.gain.value = 0.55;
    reverb.connect(revOut); revOut.connect(master);
    revSend = ctx.createGain(); revSend.connect(reverb);
    // slap-back echo between buildings for distant events
    echo = ctx.createDelay(1.5); echo.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const eLp = ctx.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 1400;
    echo.connect(eLp); eLp.connect(fb); fb.connect(echo);
    const eOut = ctx.createGain(); eOut.gain.value = 0.5; eLp.connect(eOut); eOut.connect(master); eOut.connect(revSend);
    echoSend = ctx.createGain(); echoSend.connect(echo);
    noiseBuffers();
    buildVoices();
    loadRecorded();
    loadSamples();
    return true;
  } catch (e) { console.warn('audio unavailable', e); return false; }
}

// ---------- spatial helpers ----------
export function spatial(x, z) {
  const T = G.camTarget || { x: 0, z: 0, dist: 90, yaw: 0 };
  const dx = x - T.x, dz = z - T.z;
  const ground = Math.hypot(dx, dz);
  const D = Math.hypot(ground, T.dist * 0.4);
  const gain = 1 / (1 + Math.pow(D / 32, 1.35));
  const cutoff = Math.max(320, Math.min(18000, 19000 * Math.exp(-(D - 20) / 38)));
  const rx = Math.cos(T.yaw), rz = -Math.sin(T.yaw);
  const pan = Math.max(-0.85, Math.min(0.85, (dx * rx + dz * rz) / (ground + 25)));
  const wet = Math.max(0.12, Math.min(0.9, (D - 25) / 90));
  return { gain, cutoff, pan, wet, D };
}

// A positioned voice chain: input -> lowpass -> gain -> pan -> bus (+ reverb/echo sends)
function chain(x, z, { bus = sfxBus, vol = 1, echoAmt = 0, wetBoost = 0 } = {}) {
  const s = spatial(x, z);
  const input = ctx.createGain();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = s.cutoff; lp.Q.value = 0.5;
  const g = ctx.createGain(); g.gain.value = s.gain * vol;
  const pan = ctx.createStereoPanner(); pan.pan.value = s.pan;
  const send = ctx.createGain(); send.gain.value = Math.min(1, s.wet + wetBoost);
  input.connect(lp); lp.connect(g); g.connect(pan); pan.connect(bus);
  g.connect(send); send.connect(revSend);
  if (echoAmt) { const es = ctx.createGain(); es.gain.value = echoAmt * Math.min(1, s.wet * 1.4); g.connect(es); es.connect(echoSend); }
  return {
    input, lp, g, pan, send, vol,
    move(nx, nz, t = 0.08) {
      const q = spatial(nx, nz);
      lp.frequency.setTargetAtTime(q.cutoff, now(), t);
      g.gain.setTargetAtTime(q.gain * this.vol, now(), t);
      pan.pan.setTargetAtTime(q.pan, now(), t);
      send.gain.setTargetAtTime(Math.min(1, q.wet + wetBoost), now(), t);
    },
  };
}

function noise(buf, rate = 1) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random() * 3; return s; }
function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function amp(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function env(param, t0, attack, peak, decay, floor = 0.0001) {
  param.cancelScheduledValues(t0);
  param.setValueAtTime(floor, t0);
  param.exponentialRampToValueAtTime(Math.max(floor * 1.01, peak), t0 + attack);
  param.exponentialRampToValueAtTime(floor, t0 + attack + decay);
}
function play(node, t0, dur) { node.start(t0, node.buffer ? Math.random() * 2 : undefined); node.stop(t0 + dur + 0.1); }
let satCurve = null;
function saturator(k = 4) {
  if (!satCurve) { satCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; satCurve[i] = Math.tanh(x * k) / Math.tanh(k); } }
  const w = ctx.createWaveShaper(); w.curve = satCurve; return w;
}

// one-shot noise burst through a filter into a destination
function burst(dest, t0, { buf = white, type = 'bandpass', f = 1000, q = 0.7, a = 0.002, peak = 0.5, d = 0.1, sweep = null, rate = 1 }) {
  const s = noise(buf, rate), fl = filt(type, f, q), g = amp();
  if (sweep) { fl.frequency.setValueAtTime(f, t0); fl.frequency.exponentialRampToValueAtTime(sweep, t0 + a + d); }
  s.connect(fl); fl.connect(g); g.connect(dest);
  env(g.gain, t0, a, peak, d);
  play(s, t0, a + d);
}
function tone(dest, t0, { type = 'sine', f = 100, f1 = null, a = 0.005, peak = 0.5, d = 0.5, glide = null }) {
  const o = osc(type, f), g = amp();
  if (f1) { o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + (glide ?? a + d)); }
  o.connect(g); g.connect(dest);
  env(g.gain, t0, a, peak, d);
  o.start(t0); o.stop(t0 + a + d + 0.05);
  return o;
}

// ---------- tiny formant speech synthesizer (indistinct voices, laughs, screams) ----------
const VOWELS = [[800, 1200, 2500], [400, 2000, 2600], [300, 2300, 3000], [500, 900, 2400], [350, 800, 2300], [650, 1700, 2500], [450, 1400, 2500]];
function synthVoice(dur, mode, female) {
  const sr = 22050, n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const f0base = mode === 'scream' ? (female ? R(420, 560) : R(300, 420)) : female ? R(170, 240) : R(95, 140);
  const fs = female ? 1.16 : 1;
  const res = [0, 0, 0].map(() => ({ y1: 0, y2: 0, a1: 0, a2: 0, g: 0 }));
  const setF = (r, f, bw) => { const R2 = Math.exp(-Math.PI * bw / sr); r.a1 = 2 * R2 * Math.cos(2 * Math.PI * f / sr); r.a2 = -R2 * R2; r.g = 1 - R2; };
  let phase = 0, i = 0;
  while (i < n) {
    // syllable: optional consonant (noise) + vowel
    const vow = mode === 'laugh' || mode === 'scream' ? VOWELS[Math.random() < 0.7 ? 0 : 5] : VOWELS[(Math.random() * VOWELS.length) | 0];
    const sylLen = Math.floor(sr * (mode === 'laugh' ? R(0.13, 0.18) : mode === 'scream' ? dur : R(0.1, 0.24)));
    const cons = mode === 'scream' ? 0 : Math.floor(sr * (mode === 'laugh' ? 0.04 : Math.random() < 0.7 ? R(0.02, 0.06) : 0));
    const consF = mode === 'laugh' ? 1200 : R(2500, 6000);
    [0, 1, 2].forEach((k) => setF(res[k], vow[k] * fs * R(0.92, 1.08), [80, 110, 160][k]));
    const pitchSlope = mode === 'laugh' ? -0.35 : mode === 'scream' ? 0.25 : R(-0.25, 0.2);
    for (let j = 0; j < sylLen && i < n; j++, i++) {
      const t = j / sylLen;
      let src;
      if (j < cons) src = (Math.random() * 2 - 1) * 0.25 * (mode === 'laugh' ? 1 : Math.sin(Math.PI * j / cons));
      else {
        const vib = mode === 'scream' ? 1 + 0.04 * Math.sin(i / sr * 2 * Math.PI * 6) : 1 + 0.02 * Math.sin(i / sr * 2 * Math.PI * 4.5);
        const f0 = f0base * (1 + pitchSlope * (i / n)) * vib * (1 + 0.05 * Math.sin(t * Math.PI));
        phase += f0 / sr;
        if (phase >= 1) phase -= 1;
        src = (phase < 0.4 ? Math.sin(Math.PI * phase / 0.4) : 0) - 0.25 + (Math.random() - 0.5) * (mode === 'scream' ? 0.25 : 0.08);
      }
      let y = 0;
      for (const r of res) { const v = r.g * src + r.a1 * r.y1 + r.a2 * r.y2; r.y2 = r.y1; r.y1 = v; y += v; }
      const envA = mode === 'scream' ? Math.min(1, t * 8) * Math.min(1, (1 - t) * 3) : Math.sin(Math.PI * Math.min(1, t * 1.1));
      out[i] = y * envA;
    }
    // pauses between words
    const gap = mode === 'talk' ? (Math.random() < 0.25 ? R(0.12, 0.35) : R(0.0, 0.05)) : mode === 'laugh' ? 0.03 : 0;
    i += Math.floor(sr * gap);
  }
  let peak = 0;
  for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(out[k]));
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  for (let k = 0; k < n; k++) d[k] = out[k] / (peak || 1) * 0.9;
  return buf;
}

function buildVoices() {
  for (let i = 0; i < 26; i++) voicePool.talk.push(synthVoice(R(0.7, 2.2), 'talk', Math.random() < 0.5));
  for (let i = 0; i < 8; i++) voicePool.laugh.push(synthVoice(R(0.7, 1.3), 'laugh', Math.random() < 0.5));
  for (let i = 0; i < 10; i++) voicePool.scream.push(synthVoice(R(0.6, 1.3), 'scream', Math.random() < 0.6));
  // continuous crowd murmur: many overlapping talkers
  const sr = 22050, len = sr * 9, mix = new Float32Array(len);
  for (let v = 0; v < 14; v++) {
    let pos = Math.floor(Math.random() * sr);
    while (pos < len) {
      const b = voicePool.talk[(Math.random() * voicePool.talk.length) | 0].getChannelData(0);
      const g = R(0.15, 0.5);
      for (let k = 0; k < b.length; k++) mix[(pos + k) % len] += b[k] * g;
      pos += b.length + Math.floor(sr * R(0.2, 1.5));
    }
  }
  let pk = 0; for (let k = 0; k < len; k++) pk = Math.max(pk, Math.abs(mix[k]));
  voicePool.murmur = ctx.createBuffer(1, len, sr);
  const d = voicePool.murmur.getChannelData(0);
  for (let k = 0; k < len; k++) d[k] = mix[k] / pk * 0.8;
}

// ---------- recorded pedestrian voices (assets/npc-screams.mp4, assets/npc-talk.mp4) ----------
// Each file is a strip of short clips cut from a longer recording (silence-split, levelled, faded); CLIPS holds
// [start, length] in seconds. They're used sparingly: a few voices at once at most, cooldowns between them, and
// each kind drawn from a shuffled bag so the same clip doesn't come round again soon.
const CLIPS = {"artalk":[[0.08, 0.618], [0.778, 0.685], [1.542, 0.675], [2.297, 0.499], [2.876, 0.698], [3.654, 0.777], [4.511, 0.406], [4.998, 0.415], [5.492, 0.931], [6.503, 1.196], [7.779, 0.635], [8.495, 0.6], [9.174, 0.729], [9.983, 0.679], [10.742, 0.73], [11.551, 1.063], [12.694, 0.896], [13.67, 0.923], [14.673, 0.964], [15.716, 0.921], [16.717, 0.812], [17.609, 1.033], [18.723, 0.979], [19.782, 0.735], [20.597, 0.761], [21.437, 0.846], [22.363, 0.312], [22.755, 0.334], [23.168, 0.349], [23.597, 0.75], [24.427, 0.913], [25.42, 0.539], [26.04, 0.412], [26.532, 0.399], [27.011, 0.884], [27.975, 0.834], [28.888, 0.912], [29.881, 0.889], [30.85, 0.366], [31.295, 0.398], [31.774, 0.386], [32.239, 0.37], [32.689, 0.601], [33.37, 0.446], [33.896, 0.52], [34.496, 0.734], [35.309, 0.715], [36.104, 0.744], [36.928, 0.916], [37.924, 0.312], [38.316, 0.28], [38.676, 0.255], [39.011, 0.33], [39.421, 0.573], [40.074, 0.493], [40.647, 0.329]],"arshout":[[0.08, 1.179], [1.339, 0.79], [2.208, 0.925], [3.213, 0.718], [4.011, 0.754], [4.845, 0.734], [5.659, 0.785], [6.525, 0.699], [7.303, 0.61], [7.994, 1.117], [9.191, 1.148], [10.419, 0.834], [11.332, 0.86], [12.273, 0.9], [13.253, 0.856], [14.189, 0.791], [15.06, 0.82], [15.96, 0.952], [16.992, 0.967], [18.039, 0.854], [18.973, 0.962], [20.015, 0.854], [20.949, 0.476], [21.505, 0.379], [21.964, 0.416], [22.46, 0.425], [22.965, 0.577], [23.622, 0.495], [24.197, 1.111], [25.388, 1.05], [26.518, 0.95], [27.548, 1.025], [28.653, 1.021], [29.754, 1.035], [30.869, 0.499], [31.449, 0.733], [32.262, 0.699]],"brit":[[0.1,0.662],[0.862,0.755],[1.716,0.875],[2.691,0.483],[3.274,0.598]],"scream":[[0.0,2.38],[2.5,1.36],[3.98,1.58],[5.68,1.26],[7.06,1.32],[8.5,1.68],[10.3,1.72],[12.14,1.16],[13.42,1.34],[14.88,3.0],[18.0,1.06],[19.18,1.26],[20.56,1.38],[22.06,2.22],[24.4001,1.94],[26.4601,1.8],[28.3801,1.56],[30.0601,0.98],[31.1601,1.74],[33.0201,2.84],[35.9801,1.36],[37.4601,1.12],[38.7001,1.54],[40.3602,1.58],[42.0602,1.56],[43.7402,1.0],[44.8602,1.38],[46.3602,0.96],[47.4402,1.12]],"yelp":[[48.6802,0.54],[49.3402,0.54],[50.0002,0.56],[50.6802,0.82],[51.6202,0.54],[52.2803,0.52],[52.9203,0.92],[53.9603,0.72],[54.8003,0.5],[55.4203,0.56],[56.1003,0.6],[56.8203,0.5],[57.4403,0.76],[58.3203,0.58]],"talk":[[0.0,1.1],[1.22,1.66],[3.0,1.52],[4.64,1.08],[5.84,4.48],[10.44,1.98],[12.54,1.76],[14.42,1.56],[16.1,1.78],[18.0,2.84],[20.9601,1.12],[22.2001,1.84],[24.1601,1.94],[26.2201,2.34],[28.6801,1.38],[30.1801,2.16],[32.4601,2.24],[34.8201,2.92],[37.8601,1.16],[39.1401,1.5],[40.7601,4.82],[45.7001,1.34],[47.16,1.26],[48.54,1.1],[49.76,1.54],[51.42,1.0],[52.54,1.64],[54.3,2.3],[56.72,1.18],[58.02,1.28],[59.42,1.68],[61.22,1.44],[62.78,1.8],[64.7,2.58],[67.4,1.24],[68.76,1.18],[70.0599,1.66],[71.8399,1.0],[72.9599,2.66],[75.7399,2.72],[78.5799,2.54],[81.2399,2.04],[83.3999,1.0],[84.5199,3.92],[88.5599,2.42],[91.0999,2.18],[93.3998,2.9],[96.4198,4.4],[100.9397,4.1]]};
const REC = { buf: {}, bag: {}, playing: { scream: 0, yelp: 0, talk: 0, arshout: 0 }, last: { scream: -9, yelp: -9, talk: -9, arshout: -9 } };
const REC_MAX = { scream: 2, yelp: 1, talk: 1, arshout: 2 };            // at most this many of each sounding at once
const REC_GAP = { scream: 0.4, yelp: 0.8, talk: 3, arshout: 0.5 };         // and at least this long between starts
function loadRecorded() {
  // decoded at 22 kHz mono (the clips' own rate) to keep memory small
  const dec = typeof OfflineAudioContext !== 'undefined' ? new OfflineAudioContext(1, 1, 22050) : ctx;
  for (const [key, url] of [['screams', 'assets/npc-screams.mp4'], ['talk', 'assets/npc-talk.mp4'], ['brit', 'assets/npc-brit.mp4'], ['artalk', 'assets/npc-ar-talk.mp4'], ['arshout', 'assets/npc-ar-shout.mp4']]) {
    fetch(url).then((r) => r.arrayBuffer()).then((ab) => dec.decodeAudioData(ab)).then((b) => { REC.buf[key] = b; }).catch((e) => console.warn('npc voices unavailable', url, e));
  }
}
function recClip(kind) {
  const list = CLIPS[kind];
  if (!REC.bag[kind] || !REC.bag[kind].length) {
    const b = list.map((_, i) => i);
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    REC.bag[kind] = b;
  }
  return list[REC.bag[kind].shift()];
}
// play one recorded clip at a spot in the world; returns false if it's too busy (the caller just stays quiet)
function recorded(kind, x, z, vol = 1) {
  // in London most of what you overhear is British (the recorded lines), mixed with the usual chatter
  // London: mostly British voices; Cairo: mostly Arabic (calm in conversation, shouted when something happens)
  const brit = kind === 'talk' && G.mapName === 'london' && REC.buf.brit && Math.random() < 0.65;
  const ar = kind === 'talk' && G.mapName === 'cairo' && REC.buf.artalk && Math.random() < 0.85;
  const buf = kind === 'arshout' ? REC.buf.arshout : ar ? REC.buf.artalk : brit ? REC.buf.brit : REC.buf[kind === 'talk' ? 'talk' : 'screams'];
  if (!buf || A.muted) return false;
  const t = now();
  if (REC.playing[kind] >= REC_MAX[kind] || t - REC.last[kind] < REC_GAP[kind]) return false;
  const [start, len] = recClip(ar ? 'artalk' : brit ? 'brit' : kind);
  REC.playing[kind]++; REC.last[kind] = t;
  const ch = chain(x, z, { vol, bus: voiceBus });
  const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = R(0.96, 1.04);
  // same overheard treatment as the synthesized voices (plus the distance muffling from chain())
  const lp = filt('lowpass', kind === 'talk' ? 3400 : 5500), hp = filt('highpass', kind === 'talk' ? 220 : 160);
  s.connect(hp); hp.connect(lp); lp.connect(ch.input);
  s.start(t + R(0, 0.1), start, len);
  s.onended = () => { REC.playing[kind] = Math.max(0, REC.playing[kind] - 1); };
  return true;
}

// ---------- recorded sound effects (assets/sfx-*.mp4): bat, crowd, fire, cars, sirens ----------
// Decoded at 22 kHz mono and levelled to the same peak; each one is played as a slice (with short fades) through
// the same positional chain as everything else, so distance muffling still applies.
const SFX_FILES = { bat: 'assets/sfx-bat.mp4', cheer: 'assets/sfx-cheer.mp4', fire: 'assets/sfx-fire.mp4', cars: 'assets/sfx-cars.mp4', fireSiren: 'assets/sfx-firetruck.mp4', policeSiren: 'assets/sfx-police.mp4', crash: 'assets/sfx-crash.mp4',
  bell: 'assets/sfx-bell.mp4', dog: 'assets/sfx-dog.mp4', gull: 'assets/sfx-gull.mp4', whistle: 'assets/sfx-whistle.mp4', collapse: 'assets/sfx-collapse.mp4', boom: 'assets/sfx-boom.mp4', pyro: 'assets/sfx-pyro.mp4', glass: 'assets/sfx-glass.mp4', dunk: 'assets/sfx-dunk.mp4', net: 'assets/sfx-net.mp4', horn: 'assets/sfx-horn.mp4', thunder: 'assets/sfx-thunder.mp4', rain: 'assets/sfx-rain.mp4', mower: 'assets/sfx-mower.mp4',
  // Las Vegas: the casino floor through the doors, a club crowd, neon hum, a phone camera, laughter, dice
  casino: 'assets/amb-casino.mp4', clubCrowd: 'assets/amb-club-crowd.mp4', neon: 'assets/amb-neon.mp4', shutter: 'assets/sfx-shutter.mp4', laughW: 'assets/sfx-laugh-women.mp4', laughM: 'assets/sfx-laugh-man.mp4', dice: 'assets/sfx-dice.mp4', fountain: 'assets/amb-fountain.mp4',
  // London: the band playing the national anthem at the palace for the Changing of the Guard
  anthem: 'assets/anthem.mp4' };
// where each take sits inside its (trimmed, compressed) file: [offset, duration] in seconds, grouped by kind
const SL = {"bell":{"bell":[[0.1,2.6]]},"dog":{"bark":[[0.1,0.58],[0.8,0.6]]},"gull":{"call":[[0.1,0.6],[0.82,0.75],[1.69,0.35],[2.16,0.37],[2.65,0.65],[3.42,0.9],[4.44,0.7]],"flock":[[5.26,2.05],[7.43,2.0],[9.55,2.2],[11.87,2.1]]},"whistle":{"fall":[[0.1,3.95]]},"collapse":{"collapse":[[0.1,5.5],[5.72,5.5],[11.34,5.5],[16.96,5.5],[22.58,5.5]]},"boom":{"boom":[[0.1,4.4],[4.62,4.9]]},"pyro":{"burst":[[0.1,2.9]]},"glass":{"break":[[0.1,0.75],[0.97,0.92],[2.01,0.9],[3.03,1.03],[4.18,0.97],[5.27,0.9],[6.29,0.9],[7.31,0.77],[8.2,1.0],[9.32,0.87]]},"dunk":{"dunk":[[0.1,0.95],[1.17,0.95],[2.24,1.15]],"bounce":[[3.51,0.32],[3.95,0.27],[4.34,0.32],[4.78,0.24],[5.14,0.28],[5.54,0.25]]},"net":{"swish":[[0.1,0.55],[0.77,0.77],[1.66,0.47],[2.25,0.53],[2.9,0.5],[3.52,0.66],[4.3,0.63],[5.05,0.65],[5.82,0.85],[6.79,0.43]]},"horn":{"honk":[[0.1,0.85],[1.07,0.62],[1.81,0.53],[2.46,0.88],[3.46,1.06],[4.64,0.85],[5.61,1.03]],"long":[[6.76,4.11]]},"thunder":{"roll":[[0.1,12.5]]}};
const SMP = {}, EXTRA = {};
function loadSamples() {
  const dec = typeof OfflineAudioContext !== 'undefined' ? new OfflineAudioContext(1, 1, 22050) : ctx;
  for (const [k, url] of Object.entries(SFX_FILES)) fetch(url).then((r) => r.arrayBuffer()).then((ab) => dec.decodeAudioData(ab)).then((b) => {
    const d = b.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
    if (pk > 0) for (let i = 0; i < d.length; i++) d[i] *= 0.9 / pk;
    SMP[k] = b;
  }).catch((e) => console.warn('sound effect unavailable', url, e));
}
function sample(name, x, z, { vol = 1, offset = 0, dur = null, fade = 0.05, rate = 1, bus = sfxBus, echo = 0 } = {}) {
  const buf = SMP[name];
  if (!buf || A.muted) return null;
  const ch = chain(x, z, { vol, bus, echoAmt: echo }), s = ctx.createBufferSource(), g = amp(0), t = now();
  const D = Math.min(dur ?? buf.duration - offset, (buf.duration - offset) / rate);
  s.buffer = buf; s.playbackRate.value = rate; s.connect(g); g.connect(ch.input);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + fade);
  g.gain.setValueAtTime(1, t + Math.max(fade, D - fade)); g.gain.linearRampToValueAtTime(0, t + D);
  s.start(t, offset, D + 0.05);
  return { ch, s, g, D };
}
// play one take of a recorded sound: a random one from the group (or o.pick), optionally skipping into it
function slice(name, group, x, z, o = {}) {
  const list = SL[name] && SL[name][group];
  if (!list || !SMP[name]) return null;
  const [off, dur] = list[o.pick != null ? o.pick % list.length : (Math.random() * list.length) | 0];
  const skip = Math.min(o.skip || 0, dur - 0.05), rate = o.rate || 1;
  return sample(name, x, z, { fade: 0.01, ...o, offset: off + skip, dur: (o.len ?? dur - skip) / rate });
}
// a recorded loop held at a level (rain, the lawnmower): returns { set(level), move(x, z), stop() }
function loopOf(name, x, z, { bus = ambBus } = {}) {
  const buf = SMP[name]; if (!buf) return null;
  const ch = chain(x, z, { vol: 1, bus }), s = ctx.createBufferSource(), g = amp(0);
  s.buffer = buf; s.loop = true; s.loopStart = 0.05; s.loopEnd = buf.duration - 0.03;
  s.connect(g); g.connect(ch.input); s.start(now(), 0.05 + Math.random() * (buf.duration - 0.2));
  return { set(v, tc = 0.4) { g.gain.setTargetAtTime(A.muted ? 0 : v, now(), tc); }, move(x, z) { ch.move(x, z, 0.3); }, stop() { g.gain.setTargetAtTime(0, now(), 0.3); s.stop(now() + 1.5); } };
}
let carsPlaying = 0, fireLoop = null, rainLoop = null;

function voice(kind, x, z, vol = 1, rate = 1) {
  // screams use the recordings once they're loaded; if too many are already going, this one stays silent
  if (kind === 'scream' && REC.buf.screams) { recorded('scream', x, z, vol * 2); return; }
  const pool = voicePool[kind];
  if (!pool || !pool.length) return;
  const ch = chain(x, z, { vol, bus: voiceBus });
  const s = ctx.createBufferSource(); s.buffer = pool[(Math.random() * pool.length) | 0];
  s.playbackRate.value = rate * R(0.92, 1.08);
  // voices are always a little muffled: overheard, not addressed to the player
  const lp = filt('lowpass', kind === 'scream' ? 5000 : R(1800, 3200));
  const hp = filt('highpass', 180);
  s.connect(hp); hp.connect(lp); lp.connect(ch.input);
  s.start(now() + R(0, 0.15));
}

// Occasional clearly-spoken phrase via the browser's speech engine (quiet and rare).
let speechBusy = false, voicesList = null;
function say(text, x, z, vol = 0.35) {
  return; // spoken phrases are disabled; crowds use the indistinct synthesized voices only
  // eslint-disable-next-line no-unreachable
  if (A.muted || VOL.master <= 0 || !('speechSynthesis' in window) || speechBusy) return;
  const s = spatial(x, z);
  if (s.gain < 0.18) return;
  try {
    voicesList ||= speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('en'));
    const u = new SpeechSynthesisUtterance(text);
    if (voicesList.length) u.voice = voicesList[(Math.random() * voicesList.length) | 0];
    u.volume = Math.min(1, vol * s.gain * 1.6 * VOL.master * 1.2 * Math.max(0.2, VOL.voices)); u.rate = R(0.95, 1.2); u.pitch = R(0.75, 1.35);
    speechBusy = true;
    u.onend = u.onerror = () => { speechBusy = false; };
    setTimeout(() => { speechBusy = false; }, 4000);
    speechSynthesis.speak(u);
  } catch { speechBusy = false; }
}

// ---------- sustained sounds ----------
let laser = null, windS = null;
const sirens = new Set();

function startLaser(x, z) {
  const t = now();
  const ch = chain(x, z, { vol: 1.2, echoAmt: 0.5, wetBoost: 0.15 });
  // the beam itself comes from overhead, so keep part of it centred and close
  const direct = amp(0); direct.connect(sfxBus);
  const body = amp(0);
  body.connect(ch.input); body.connect(direct);
  const sat = saturator(3); sat.connect(body);
  const nodes = [];
  // sub energy
  for (const f of [36, 54.5]) { const o = osc('sine', f); const g = amp(0.55); o.connect(g); g.connect(sat); nodes.push(o); }
  // massive detuned drone
  const droneLp = filt('lowpass', 500, 2); droneLp.connect(sat);
  for (const f of [72, 72.6, 108.4, 145]) { const o = osc('sawtooth', f); const g = amp(0.12); o.connect(g); g.connect(droneLp); nodes.push(o); }
  const lfo = osc('sine', 0.6), lfoG = amp(220); lfo.connect(lfoG); lfoG.connect(droneLp.frequency); nodes.push(lfo);
  // electrical crackle: bandpassed noise whose amplitude is modulated by slow noise
  const ec = noise(white), ecF = filt('bandpass', 3200, 1.5), ecG = amp(0.0);
  const mod = noise(white, 0.02), modLp = filt('lowpass', 35), modG = amp(0.9);
  mod.connect(modLp); modLp.connect(modG); modG.connect(ecG.gain);
  ec.connect(ecF); ecF.connect(ecG); ecG.connect(body);
  // impact sizzle and roar at the target
  const roar = noise(brown), roarF = filt('lowpass', 900), roarG = amp(0.6); roar.connect(roarF); roarF.connect(roarG); roarG.connect(ch.input);
  const siz = noise(white), sizF = filt('highpass', 5000), sizG = amp(0.12); siz.connect(sizF); sizF.connect(sizG); sizG.connect(ch.input);
  for (const s of [ec, mod, roar, siz]) { s.start(t); nodes.push(s); }
  for (const o of nodes) if (o.start && !o.buffer) o.start(t);
  body.gain.setValueAtTime(0.0001, t); body.gain.exponentialRampToValueAtTime(0.9, t + 0.25);
  direct.gain.setValueAtTime(0.0001, t); direct.gain.exponentialRampToValueAtTime(0.35, t + 0.25);
  // ignition whoomp
  tone(ch.input, t, { f: 40, f1: 120, a: 0.01, peak: 0.9, d: 0.5 });
  burst(ch.input, t, { buf: pink, type: 'lowpass', f: 300, sweep: 4000, a: 0.08, peak: 0.6, d: 0.4 });
  laser = { ch, body, direct, nodes, droneLp, ecF, roarF, roarG, sizG, t0: t };
}
function updateLaser(x, z, intensity) {
  const L = laser, t = now();
  L.ch.move(x, z, 0.05);
  // the longer it burns, the bigger and brighter it sounds
  L.droneLp.frequency.setTargetAtTime(420 + intensity * 900, t, 0.2);
  L.roarF.frequency.setTargetAtTime(600 + intensity * 2200, t, 0.2);
  L.roarG.gain.setTargetAtTime(0.5 + intensity * 0.8, t, 0.2);
  L.sizG.gain.setTargetAtTime(0.08 + intensity * 0.2, t, 0.2);
  L.body.gain.setTargetAtTime(0.8 + intensity * 0.5, t, 0.2);
}
function stopLaser() {
  const L = laser; laser = null;
  const t = now();
  L.body.gain.setTargetAtTime(0.0001, t, 0.12); L.direct.gain.setTargetAtTime(0.0001, t, 0.12);
  L.roarG.gain.setTargetAtTime(0.0001, t, 0.15); L.sizG.gain.setTargetAtTime(0.0001, t, 0.1);
  // power-down sigh and a long tail rolling off the buildings
  tone(L.ch.input, t, { f: 90, f1: 28, a: 0.01, peak: 0.5, d: 0.9 });
  for (const n of L.nodes) { try { n.stop(t + 1.2); } catch {} }
}

function startWind(x, z) {
  const t = now();
  const ch = chain(x, z, { vol: 1.3, wetBoost: 0.1 });
  const out = amp(0.0001); out.connect(ch.input);
  const deep = noise(brown), deepF = filt('lowpass', 220), deepG = amp(1.0);
  const howl = noise(pink), howlF = filt('bandpass', 700, 2.2), howlG = amp(0.5);
  const hiss = noise(white), hissF = filt('highpass', 3500), hissG = amp(0.08);
  const lfo = osc('sine', 0.23), lfoG = amp(380); lfo.connect(lfoG); lfoG.connect(howlF.frequency);
  const lfo2 = osc('sine', 0.37), lfo2G = amp(0.25); lfo2.connect(lfo2G); lfo2G.connect(howlG.gain);
  const rum = osc('sine', 33), rumG = amp(0.3);
  deep.connect(deepF); deepF.connect(deepG); deepG.connect(out);
  howl.connect(howlF); howlF.connect(howlG); howlG.connect(out);
  hiss.connect(hissF); hissF.connect(hissG); hissG.connect(out);
  rum.connect(rumG); rumG.connect(out);
  const nodes = [deep, howl, hiss, lfo, lfo2, rum];
  for (const n of nodes) n.start(t);
  out.gain.setTargetAtTime(1, t, 0.25);
  windS = { ch, out, nodes, x, z, rattleT: 0, deepF, hissG };
}
function stopWind() {
  const W = windS; windS = null;
  const t = now();
  W.out.gain.setTargetAtTime(0.0001, t, 0.6);
  for (const n of W.nodes) n.stop(t + 3);
}

// ---------- public API ----------
export const sfx = {
  // for sounds made elsewhere (the vehicles' engines): the context, the effects bus, and whether the game is muted
  get ctx() { return ctx; }, get bus() { return sfxBus; }, get muted() { return A.muted; },
  unlock() { if (init()) { if (ctx.state === 'suspended') ctx.resume(); loadShot(); } },
  get ready() { return !!ctx; },
  setVolumes(v) {
    Object.assign(VOL, v);
    if (!ctx) return;
    const t = now();
    master.gain.setTargetAtTime(A.muted ? 0 : VOL.master * 1.1, t, 0.05);
    sfxBus.gain.setTargetAtTime(VOL.sfx, t, 0.05);
    ambVol.gain.setTargetAtTime(VOL.ambience, t, 0.05);
    voiceBus.gain.setTargetAtTime(VOL.voices, t, 0.05);
    if (music.bus) music.bus.gain.setTargetAtTime(VOL.music, t, 0.05);
    if (beachRadio.bus) beachRadio.bus.gain.setTargetAtTime(VOL.music, t, 0.05);
  },
  toggleMute() {
    if (!init()) return false;
    A.muted = !A.muted;
    master.gain.setTargetAtTime(A.muted ? 0 : VOL.master * 1.1, now(), 0.05);
    if (A.muted && 'speechSynthesis' in window) speechSynthesis.cancel();
    return A.muted;
  },
  // ambience ducking so big events briefly dominate the mix
  duck(amount = 0.35, hold = 1.5) {
    if (!ctx) return;
    const t = now();
    ambBus.gain.cancelScheduledValues(t);
    ambBus.gain.setTargetAtTime(amount, t, 0.03);
    ambBus.gain.setTargetAtTime(1, t + hold, 1.2);
  },

  laser(on, x = 0, z = 0, intensity = 0) {
    if (!on) { if (laser) stopLaser(); return; }
    if (!init()) return;
    if (!laser) startLaser(x, z);
    updateLaser(x, z, intensity);
  },
  wind(on, x = 0, z = 0, strength = 1) {
    if (!on) { if (windS) stopWind(); return; }
    if (!init()) return;
    if (!windS) startWind(x, z);
    const W = windS, t = now();
    W.ch.move(x, z, 0.15);
    W.deepF.frequency.setTargetAtTime(180 + strength * 160, t, 0.3);
    // debris and objects rattling through the gust
    W.rattleT -= 1 / 60;
    if (W.rattleT <= 0) {
      W.rattleT = R(0.04, 0.2);
      burst(W.ch.input, t, { f: R(700, 3500), q: R(2, 6), a: 0.002, peak: R(0.05, 0.25), d: R(0.02, 0.08) });
      if (Math.random() < 0.15) burst(W.ch.input, t, { buf: brown, type: 'lowpass', f: 250, a: 0.005, peak: 0.4, d: 0.2 });
    }
  },

  bombFall(x, z, T) {
    if (!init()) return;
    // the recorded whistle, started so it finishes as the bomb lands (it's 3.95 s long)
    if (SMP.whistle) { if (T >= 3.9) setTimeout(() => slice('whistle', 'fall', x, z, { vol: 0.4 }), (T - 3.9) * 1000); else slice('whistle', 'fall', x, z, { vol: 0.4, skip: 3.9 - T }); return; }   // kept low: loud, it sounded cartoonish
    const t = now();
    const ch = chain(x, z, { vol: 0.9 });
    // falling whistle: pitch drops as it approaches, air rush swells
    const o1 = osc('sine', 1500), o2 = osc('sine', 1507), g = amp(0.0001);
    for (const o of [o1, o2]) { o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(420, t + T); o.connect(g); o.start(t); o.stop(t + T + 0.05); }
    g.gain.exponentialRampToValueAtTime(0.07, t + T * 0.6); g.gain.exponentialRampToValueAtTime(0.16, t + T * 0.97); g.gain.exponentialRampToValueAtTime(0.0001, t + T + 0.03);
    g.connect(ch.input);
    const air = noise(pink), af = filt('bandpass', 400, 1.2), ag = amp(0.0001);
    af.frequency.exponentialRampToValueAtTime(2200, t + T);
    ag.gain.exponentialRampToValueAtTime(0.5, t + T * 0.98); ag.gain.exponentialRampToValueAtTime(0.0001, t + T + 0.05);
    air.connect(af); af.connect(ag); ag.connect(ch.input); play(air, t, T + 0.1);
  },

  meteorFall(x, z, T) {
    if (!init()) return;
    const t = now();
    const ch = chain(x, z, { vol: 1.2, wetBoost: 0.2 });
    const direct = amp(0.0001); direct.connect(sfxBus);
    // distant rumble building into an atmospheric roar
    const rum = noise(brown), rf = filt('lowpass', 90, 1), rg = amp(0.0001);
    rf.frequency.exponentialRampToValueAtTime(420, t + T);
    rg.gain.exponentialRampToValueAtTime(1.2, t + T);
    rum.connect(rf); rf.connect(rg); rg.connect(ch.input); rg.connect(direct); play(rum, t, T + 0.1);
    const rush = noise(pink), rsf = filt('bandpass', 250, 0.9), rsg = amp(0.0001);
    rsf.frequency.exponentialRampToValueAtTime(2600, t + T);
    rsg.gain.exponentialRampToValueAtTime(0.9, t + T * 0.97);
    rush.connect(rsf); rsf.connect(rsg); rsg.connect(ch.input); play(rush, t, T + 0.05);
    const sub = osc('sine', 24), sg = amp(0.0001);
    sub.frequency.exponentialRampToValueAtTime(44, t + T);
    sg.gain.exponentialRampToValueAtTime(0.8, t + T);
    sub.connect(sg); sg.connect(direct); sub.start(t); sub.stop(t + T + 0.05);
    direct.gain.exponentialRampToValueAtTime(0.5, t + T);
    // burning crackle riding the roar
    for (let i = 0; i < 40; i++) burst(ch.input, t + T * Math.pow(Math.random(), 0.5), { f: R(1500, 5000), q: 3, peak: R(0.05, 0.2), d: 0.03 });
    sfx.duck(0.5, T);
  },

  // Layered explosion: crack, body, sub thump, debris, secondary thumps, echo tail.
  boom(x, z, size = 1, kind = 'bomb') {
    if (!init()) return;
    if (SMP.boom) {
      // the recorded explosion: lower and longer for big blasts and meteors, a little higher for small ones
      const rate = kind === 'meteor' ? 0.78 : kind === 'small' ? 1.15 : Math.max(0.82, 1.02 - size * 0.08);
      slice('boom', 'boom', x, z, { vol: 1.15 * Math.min(1.7, 0.6 + size * 0.5), rate: rate * R(0.97, 1.03), echo: 0.6 });
      if (kind === 'meteor') slice('collapse', 'collapse', x, z, { vol: 0.7, rate: 0.85, skip: 0.6 });                  // the ground rumbling after
      if (kind === 'energy') { const ch = chain(x, z, { vol: 1 }), t = now(); tone(ch.input, t, { type: 'sawtooth', f: 1400, f1: 90, a: 0.002, peak: 0.25, d: 0.5 }); }
      if (kind !== 'meteor') sfx.glass(x, z, 10 * size, 0.12);
      G.camTarget && sfx.duck(kind === 'meteor' ? 0.15 : 0.35, kind === 'meteor' ? 3 : 1.2);
      return;
    }
    const t = now();
    const s = spatial(x, z);
    const ch = chain(x, z, { vol: 1.1 * Math.min(1.8, size), echoAmt: 0.7, wetBoost: kind === 'meteor' ? 0.25 : 0.1 });
    const pre = amp(1); const sat = saturator(2.5); pre.connect(sat); sat.connect(ch.input);
    // subsonic body goes partly direct: you feel it even from far away
    const subOut = amp(Math.min(1, 0.45 + s.gain)); subOut.connect(sfxBus);
    const L = kind === 'meteor' ? 2.2 : kind === 'small' ? 0.5 : 1;
    // 1 crack
    burst(pre, t, { f: 3000, type: 'highpass', a: 0.001, peak: 0.9, d: 0.06 * L });
    // 2 body roar
    burst(pre, t, { buf: pink, type: 'lowpass', f: 4000 * L, sweep: 140, q: 0.6, a: 0.005, peak: 1.0, d: 1.4 * L + size * 0.4 });
    burst(pre, t + 0.02, { buf: brown, type: 'lowpass', f: 700, sweep: 60, a: 0.02, peak: 1.2, d: 2.2 * L });
    // 3 sub thump
    tone(subOut, t, { f: kind === 'meteor' ? 48 : 62, f1: kind === 'meteor' ? 16 : 26, a: 0.008, peak: 0.95, d: 0.9 * L + 0.3, glide: 0.8 * L });
    if (kind === 'meteor') {
      tone(subOut, t + 0.05, { f: 30, f1: 14, a: 0.05, peak: 0.8, d: 4.5, glide: 4 });
      burst(ch.input, t + 0.1, { buf: brown, type: 'lowpass', f: 160, a: 0.4, peak: 0.9, d: 6 }); // long ground rumble
    }
    if (kind === 'energy') {
      tone(pre, t, { type: 'sawtooth', f: 1400, f1: 90, a: 0.002, peak: 0.35, d: 0.5 });
      for (let i = 0; i < 6; i++) tone(pre, t + R(0, 0.3), { type: 'sine', f: R(2500, 6000), a: 0.001, peak: 0.08, d: R(0.4, 1.2) });
    }
    // 4 debris rain + glass
    const nDeb = Math.round(40 * Math.min(2.5, size) * (kind === 'meteor' ? 1.8 : 1));
    for (let i = 0; i < nDeb; i++) {
      const dt = 0.15 + Math.pow(Math.random(), 1.6) * 2.6 * L;
      burst(ch.input, t + dt, { f: R(600, 4500), q: R(1.5, 5), a: 0.001, peak: R(0.04, 0.22) * (1 - dt / 4), d: R(0.015, 0.07) });
    }
    if (kind !== 'meteor') sfx.glass(x, z, 10 * size, 0.1);
    // 5 secondary impacts
    for (let i = 0; i < 2 + size * 2; i++) {
      const dt = R(0.3, 1.8) * L;
      burst(ch.input, t + dt, { buf: brown, type: 'lowpass', f: R(200, 500), a: 0.004, peak: R(0.3, 0.7), d: R(0.2, 0.5) });
    }
    G.camTarget && sfx.duck(kind === 'meteor' ? 0.15 : 0.35, kind === 'meteor' ? 3 : 1.2);
  },

  crumble(x, z, size = 1) {
    if (!init()) return;
    // a chunk breaking off: a short stretch of rubble from inside one of the recorded collapses
    if (SMP.collapse) { slice('collapse', 'collapse', x, z, { vol: 0.45 * Math.min(1.6, size), skip: R(1, 3.5), len: 0.9, fade: 0.08, rate: R(1, 1.15) }); return; }
    const t = now(), ch = chain(x, z, { vol: 0.6 * size });
    burst(ch.input, t, { buf: brown, type: 'lowpass', f: 400, a: 0.005, peak: 0.6, d: 0.35 });
    for (let i = 0; i < 6; i++) burst(ch.input, t + R(0, 0.5), { f: R(800, 4000), q: 3, a: 0.001, peak: R(0.05, 0.2), d: 0.04 });
  },
  collapse(x, z, n) {
    if (!init()) return;
    const t = now(), sz = Math.min(3, 0.6 + n / 40);
    if (SMP.collapse) { slice('collapse', 'collapse', x, z, { vol: 0.75 * sz, rate: Math.max(0.8, 1.05 - sz * 0.08), echo: 0.5 }); sfx.duck(0.4, 2); return; }
    const ch = chain(x, z, { vol: 1.1 * sz, echoAmt: 0.6, wetBoost: 0.15 });
    burst(ch.input, t, { buf: brown, type: 'lowpass', f: 500, sweep: 120, a: 0.15, peak: 1.1, d: 2.5 + sz });
    burst(ch.input, t, { buf: pink, type: 'lowpass', f: 2500, sweep: 300, a: 0.05, peak: 0.5, d: 1.8 + sz });
    tone(ch.input, t, { f: 50, f1: 22, a: 0.1, peak: 0.8, d: 2 + sz });
    for (let i = 0; i < 50 * sz; i++) { const dt = R(0, 3 + sz); burst(ch.input, t + dt, { f: R(500, 4000), q: R(2, 5), a: 0.001, peak: R(0.04, 0.2), d: R(0.02, 0.08) }); }
    for (let i = 0; i < 4 * sz; i++) burst(ch.input, t + R(0.2, 2.5), { buf: brown, type: 'lowpass', f: 300, a: 0.01, peak: 0.6, d: 0.4 });
    sfx.duck(0.4, 2);
  },
  glass(x, z, n = 8, delay = 0) {
    if (!init()) return;
    // one to three recorded breaks, a beat apart, depending on how much glass goes
    if (SMP.glass) { const k = n > 14 ? 3 : n > 6 ? 2 : 1; for (let i = 0; i < k; i++) setTimeout(() => slice('glass', 'break', x, z, { vol: 0.45, rate: R(0.92, 1.1) }), (delay + i * R(0.08, 0.25)) * 1000); return; }
    const t = now() + delay, ch = chain(x, z, { vol: 0.5 });
    for (let i = 0; i < n; i++) {
      const dt = R(0, 0.6);
      burst(ch.input, t + dt, { type: 'highpass', f: R(4000, 8000), a: 0.001, peak: R(0.05, 0.2), d: R(0.03, 0.12) });
      tone(ch.input, t + dt, { f: R(3000, 7500), a: 0.001, peak: R(0.02, 0.06), d: R(0.1, 0.4) });
    }
  },
  charge(x, z) {
    if (!init()) return;
    const t = now(), ch = chain(x, z, { vol: 1 }), d = 0.45;
    const direct = amp(0.4); direct.connect(sfxBus);
    const car = osc('sawtooth', 110), mod = osc('sine', 55), modG = amp(80);
    car.frequency.exponentialRampToValueAtTime(1400, t + d); mod.frequency.exponentialRampToValueAtTime(700, t + d);
    modG.gain.linearRampToValueAtTime(900, t + d);
    mod.connect(modG); modG.connect(car.frequency);
    const g = amp(0.0001); g.gain.exponentialRampToValueAtTime(0.25, t + d);
    const lp = filt('lowpass', 800, 4); lp.frequency.exponentialRampToValueAtTime(6000, t + d);
    car.connect(lp); lp.connect(g); g.connect(ch.input); g.connect(direct);
    for (const o of [car, mod]) { o.start(t); o.stop(t + d + 0.05); }
    tone(direct, t, { f: 30, f1: 70, a: d, peak: 0.7, d: 0.05 });
    burst(ch.input, t, { buf: pink, type: 'bandpass', f: 500, sweep: 5000, q: 2, a: d, peak: 0.4, d: 0.05 });
  },
  zap(x, z) {
    if (!init()) return;
    const t = now(), ch = chain(x, z, { vol: 1.2, echoAmt: 0.6 });
    burst(ch.input, t, { type: 'highpass', f: 2000, a: 0.0005, peak: 1, d: 0.12 });
    // electrical buzz with noise-modulated amplitude
    const buzz = osc('sawtooth', 58), bg = amp(0.0001), lp = filt('lowpass', 2500);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.35, t + 0.01); bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    buzz.connect(lp); lp.connect(bg); bg.connect(ch.input); buzz.start(t); buzz.stop(t + 1.2);
    for (let i = 0; i < 25; i++) burst(ch.input, t + R(0, 1.4), { f: R(2000, 7000), q: 4, a: 0.0005, peak: R(0.05, 0.3), d: 0.015 });
    sfx.boom(x, z, 1.1, 'energy');
  },
  screams(x, z, n = 3) {
    if (!init()) return;
    // a panicked crowd: one or two real screams carry it (the limiter drops the rest), not a wall of them
    if (REC.buf.screams) n = Math.min(n, Math.random() < 0.25 ? 1 : 2);
    if (G.mapName === 'cairo' && REC.buf.arshout) { recorded('arshout', x + R(-4, 4), z + R(-4, 4), 0.6); if (Math.random() < 0.6) setTimeout(() => recorded('arshout', x + R(-6, 6), z + R(-6, 6), 0.5), R(500, 1400)); n = Math.max(0, n - 1); }
    for (let i = 0; i < n; i++) setTimeout(() => voice('scream', x + R(-6, 6), z + R(-6, 6), R(0.25, 0.5)), R(80, 900));
  },
  // a cruise ship's horn: two long low notes across the water
  // someone knocked flying lets out a short cry (now and then)
  yelp(x, z) { if (init() && Math.random() < 0.55) recorded(G.mapName === 'cairo' && REC.buf.arshout && Math.random() < 0.6 ? 'arshout' : 'yelp', x, z, 0.55); },
  // a line of real conversation from someone nearby; false if another is already playing
  line(x, z, vol = 0.5) { return init() ? recorded('talk', x, z, vol) : false; },
  chatter(x, z, vol = 0.25) { if (init()) voice(Math.random() < 0.12 ? 'laugh' : 'talk', x, z, vol); },
  say,
  // trolley bell: two bright struck tones, rung twice
  bell(x, z) {
    if (!init()) return;
    if (slice('bell', 'bell', x, z, { vol: 0.55, bus: ambBus, fade: 0.05 })) return;   // the recorded warning bell
    const t = now(), ch = chain(x, z, { vol: 0.5, bus: ambBus });
    for (const k of [0, 0.32]) for (const f of [1480, 2230, 3690]) tone(ch.input, t + k, { f, a: 0.002, peak: f === 1480 ? 0.12 : 0.05, d: 0.9 });
  },
  // steel wheels over rail joints
  clack(x, z) {
    if (!init()) return;
    const t = now(), ch = chain(x, z, { vol: 0.35, bus: ambBus });
    for (const k of [0, 0.09]) burst(ch.input, t + k, { f: R(900, 1600), q: 3, a: 0.001, peak: 0.12, d: 0.04 });
    burst(ch.input, t, { buf: brown, type: 'lowpass', f: 260, a: 0.02, peak: 0.25, d: 0.5 });
  },
  // Gunfire: the recorded AK shot (assets/gunshot.wav, trimmed so the crack is at t = 0), placed in the world
  // with the usual distance lowpass/pan and a slap echo; a hair of pitch variation keeps bursts from sounding cloned.
  // Falls back to a synthesized crack until the sample has loaded.
  gunshot(x, z, n = 1, gap = 0.18) {
    if (!init()) return;
    loadShot();
    const t = now(), ch = chain(x, z, { vol: 0.9, echoAmt: 0.7, wetBoost: 0.15 });
    for (let k = 0; k < n; k++) {
      const t0 = t + k * gap * R(0.7, 1.4);
      if (shotBuf) {
        const src = ctx.createBufferSource(); src.buffer = shotBuf; src.playbackRate.value = R(0.94, 1.06);
        src.connect(ch.input); src.start(t0);
      } else {
        burst(ch.input, t0, { type: 'highpass', f: 1800, a: 0.0005, peak: 1.0, d: 0.035 });
        burst(ch.input, t0, { buf: pink, type: 'lowpass', f: 2600, sweep: 300, a: 0.001, peak: 0.8, d: 0.16 });
      }
    }
  },
  // the rush of a car going past close by (the highway cut-up's near misses): a band of noise sweeping down
  whoosh(x, z, v = 1) {
    if (!init()) return;
    const t = now(), ch = chain(x, z, { vol: 0.5 * v });
    burst(ch.input, t, { buf: pink, type: 'bandpass', f: 1800, q: 1.4, a: 0.05, peak: 0.6, d: 0.35, sweep: 650 });
  },
  // Tyre squeal leading into a collision
  skid(x, z, d = 0.6) {
    if (!init()) return;
    const t = now(), ch = chain(x, z, { vol: 0.45 });
    burst(ch.input, t, { f: 2300, q: 9, a: 0.04, peak: 0.5, d, sweep: 1500 });
    tone(ch.input, t, { type: 'sawtooth', f: 1150, f1: 900, a: 0.04, peak: 0.05, d });
  },
  // recorded car crash: brakes screeching, then the impact (at 2.70 s in the file) and the debris settling.
  // Started `lead` seconds before the cars meet so the hit in the recording lands on the hit in the game.
  crashRec(x, z, lead = 1, size = 1) {
    if (!init() || !SMP.crash) return false;
    const off = Math.max(0, 2.7 - lead);
    return !!sample('crash', x, z, { vol: 1.1 * size, offset: off, dur: 4.65 - off, fade: 0.03, echo: 0.35 });
  },
  // Car crash (synthesized fallback if the recording isn't loaded): thud, crumpling metal, glass and settling clanks
  crash(x, z, size = 1) {
    if (!init()) return;
    const t = now(), ch = chain(x, z, { vol: 0.9 * size, echoAmt: 0.5 });
    burst(ch.input, t, { buf: brown, type: 'lowpass', f: 700, a: 0.003, peak: 1.1, d: 0.45 });
    burst(ch.input, t, { buf: pink, type: 'bandpass', f: 1400, q: 1.2, a: 0.002, peak: 0.7, d: 0.3 });
    for (let i = 0; i < 7; i++) tone(ch.input, t + R(0, 0.25), { type: 'triangle', f: R(260, 1300), f1: R(200, 900), a: 0.002, peak: R(0.05, 0.14), d: R(0.25, 0.8) });
    for (let i = 0; i < 5; i++) burst(ch.input, t + R(0.3, 1.4), { f: R(900, 3000), q: 4, a: 0.001, peak: R(0.05, 0.15), d: 0.05 });
    sfx.glass(x, z, 6, 0.02);
  },
  // concert pyro: a gas whoomp with crackle
  pyro(x, z, big = false) {
    if (!init()) return;
    if (slice('pyro', 'burst', x, z, { vol: big ? 0.85 : 0.5, rate: big ? 0.9 : R(1, 1.12), echo: 0.4 })) return;   // the recorded flame burst
    const t = now(), ch = chain(x, z, { vol: big ? 0.8 : 0.45, echoAmt: 0.4 });
    burst(ch.input, t, { buf: brown, type: 'lowpass', f: 900, sweep: 200, a: 0.03, peak: 0.9, d: big ? 0.9 : 0.5 });
    burst(ch.input, t, { buf: pink, type: 'bandpass', f: 1800, q: 0.8, a: 0.02, peak: 0.35, d: 0.4 });
    for (let i = 0; i < (big ? 18 : 6); i++) burst(ch.input, t + R(0.05, 0.9), { f: R(2000, 6000), q: 3, a: 0.001, peak: R(0.04, 0.12), d: 0.03 });
  },
  // weather: a steady hiss of rain on the city, and thunder (a crack close up, a long rumble far away)
  rain(level) {
    if (!ctx) return;
    // the recorded downpour (rain only: the thunder in that recording is kept for lightning strikes)
    if (SMP.rain && !rainNode) {
      if (!rainLoop && level > 0.01) {
        const s = ctx.createBufferSource(), g = amp(0); s.buffer = SMP.rain; s.loop = true; s.loopStart = 0.05; s.loopEnd = SMP.rain.duration - 0.03;
        s.connect(g); g.connect(ambBus); s.start(now(), Math.random() * 3);
        rainLoop = g;
      }
      if (rainLoop) rainLoop.gain.setTargetAtTime(level * 0.55, now(), 0.6);
      return;
    }
    if (!rainNode && level > 0.01) {
      const n = noise(pink), hp = filt('highpass', 700), lp = filt('lowpass', 7000); rainNode = amp(0);
      n.connect(hp); hp.connect(lp); lp.connect(rainNode); rainNode.connect(ambBus); n.start();
    }
    if (rainNode) rainNode.gain.setTargetAtTime(level * 0.5, now(), 0.4);
  },
  thunder(x, z, v = 1) {
    if (!init()) return;
    // the recorded roll: a strike close by comes in sharp; far off it's slower, deeper and softer
    if (SMP.thunder) { const D = spatial(x, z).D; slice('thunder', 'roll', x, z, { vol: 0.9 * v, rate: D < 40 ? 1 : R(0.82, 0.92), skip: D < 40 ? 0.3 : 0, echo: 0.6, bus: ambBus }); return; }
    const t = now(), s = spatial(x, z), ch = chain(x, z, { vol: 0.9 * v, echoAmt: 0.8, wetBoost: 0.3 });
    const close = s.D < 40;
    if (close) burst(ch.input, t, { type: 'highpass', f: 1200, a: 0.002, peak: 0.8, d: 0.25 });
    burst(ch.input, t + (close ? 0.05 : 0), { buf: brown, type: 'lowpass', f: 420, sweep: 90, a: close ? 0.04 : 0.4, peak: 1.0, d: 4.5 });
    for (let i = 0; i < 5; i++) burst(ch.input, t + R(0.3, 3), { buf: brown, type: 'lowpass', f: 250, a: 0.2, peak: R(0.3, 0.6), d: R(0.8, 1.6) });
    sfx.duck(0.5, 2);
  },
  // streetball: ball on asphalt, rim clank, net swish
  bounce(x, z, v = 1) {
    if (!init()) return;
    if (slice('dunk', 'bounce', x, z, { vol: 0.5 * v, rate: R(0.95, 1.05) })) return;   // a recorded dribble
    const t = now(), ch = chain(x, z, { vol: 0.35 * v });
    tone(ch.input, t, { f: 140, f1: 70, a: 0.002, peak: 0.5, d: 0.07 });
    burst(ch.input, t, { buf: brown, type: 'lowpass', f: 900, a: 0.001, peak: 0.25, d: 0.04 });
  },
  rim(x, z) {
    if (!init()) return;
    if (slice('dunk', 'dunk', x, z, { vol: 0.35, rate: R(1.05, 1.15), len: 0.45 })) return;   // the iron ringing off a miss
    const t = now(), ch = chain(x, z, { vol: 0.4, echoAmt: 0.3 });
    for (const f of [690, 1140, 1830]) tone(ch.input, t, { type: 'triangle', f, a: 0.001, peak: 0.12, d: 0.35 });
    burst(ch.input, t, { f: 2500, q: 2, a: 0.001, peak: 0.2, d: 0.05 });
  },
  // a dog barking where it stands (one or two barks)
  bark(x, z, vol = 0.6) { if (!init()) return false; const h = slice('dog', 'bark', x, z, { vol, rate: R(0.92, 1.12) }); if (h && Math.random() < 0.45) setTimeout(() => slice('dog', 'bark', x, z, { vol: vol * 0.9, rate: R(0.92, 1.12) }), R(250, 500)); return !!h; },
  // a gull calling from where it flies; a whole flock squabbling now and then
  gull(x, z, flock = false) { return init() ? !!slice('gull', flock ? 'flock' : 'call', x, z, { vol: flock ? 0.4 : 0.5, rate: R(0.94, 1.08), bus: ambBus, fade: 0.06 }) : false; },
  // the lawnmower engine, held while someone is mowing (returns a handle: set(level) / move(x, z) / stop())
  mowerLoop(x, z) { return init() ? loopOf('mower', x, z) : null; },
  // any loaded recording as a held loop, or played once, at a place
  loop(name, x, z) { return init() ? loopOf(name, x, z) : null; },
  // a map's own long recordings, fetched only when that map is open (the adhan, the bazaar, the river...)
  loadExtra(name, url) {
    if (SMP[name] || EXTRA[name] || !init()) return;
    EXTRA[name] = fetch(url).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)).then((b) => { SMP[name] = b; }).catch((e) => console.warn('sound unavailable', url, e));
  },
  has(name) { return !!SMP[name]; },
  once(name, x, z, vol = 1, rate = 1) { return init() ? !!sample(name, x, z, { vol, rate, bus: ambBus, fade: 0.01 }) : false; },
  // a dunk: the ball slammed through the rim (recorded)
  dunk(x, z) { if (init() && !slice('dunk', 'dunk', x, z, { vol: 0.75 })) { sfx.rim(x, z); sfx.swish(x, z); } },
  swish(x, z) {
    if (!init()) return;
    if (slice('net', 'swish', x, z, { vol: 0.55 })) return;   // the recorded net
    const t = now(), ch = chain(x, z, { vol: 0.35 });
    burst(ch.input, t, { buf: pink, f: 3200, q: 0.7, a: 0.03, peak: 0.25, d: 0.22 });
  },
  horn(x, z, vol = 0.5) {
    if (!init()) return;
    if (slice('horn', vol > 0.55 ? 'long' : 'honk', x, z, { vol: vol * 1.1, rate: R(0.94, 1.06), len: vol > 0.55 ? R(1.2, 2.6) : undefined, fade: 0.04 })) return;   // the recorded V8 horn
    const t = now(), ch = chain(x, z, { vol });
    const n = Math.random() < 0.4 ? 2 : 1, f = R(350, 480);
    for (let k = 0; k < n; k++) {
      const t0 = t + k * 0.22, d = n > 1 ? 0.14 : R(0.25, 0.7);
      for (const ff of [f, f * 1.26]) {
        const o = osc('square', ff), g = amp(0.0001), lp = filt('lowpass', 1800);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01); g.gain.setValueAtTime(0.12, t0 + d); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.05);
        o.connect(lp); lp.connect(g); g.connect(ch.input); o.start(t0); o.stop(t0 + d + 0.1);
      }
    }
  },
  siren(type) {
    if (!init()) return null;
    const rec = SMP[type === 'fire' ? 'fireSiren' : 'policeSiren'];
    if (rec) {
      // a recorded siren looping (the fire truck's horn blasts included); ambulances run the wail a touch faster
      const ch = chain(0, 0, { vol: 0.34, echoAmt: 0.3 }), s = ctx.createBufferSource(), g = amp(0.0001);
      s.buffer = rec; s.loop = true;
      if (type === 'fire') { s.loopStart = 0.6; s.loopEnd = 10.2; } else { s.loopStart = 0.5; s.loopEnd = rec.duration - 0.5; }
      s.playbackRate.value = type === 'ambulance' ? 1.12 : 1;
      s.connect(g); g.connect(ch.input); s.start(now(), type === 'fire' ? 0.6 : Math.random() * 20);
      const h = {
        ch, g, on: false,
        set(x, z, on) { this.ch.move(x, z, 0.2); if (on !== this.on) { this.on = on; g.gain.setTargetAtTime(on ? 0.55 : 0.0001, now(), 0.6); } },
        stop(slow = false) {
          const t = now(), tc = slow ? 2.8 : 0.3, end = slow ? 16 : 1.5;
          g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0.0001, t, tc);
          if (slow) s.playbackRate.setTargetAtTime(s.playbackRate.value * 0.85, t, 4);
          s.stop(t + end); sirens.delete(h);
        },
      };
      sirens.add(h);
      return h;
    }
    const ch = chain(0, 0, { vol: 0.34, echoAmt: 0.3 });
    const o = osc(type === 'fire' ? 'sawtooth' : 'square', 700), lp = filt('lowpass', 2200), g = amp(0.0001);
    const lfo = osc(type === 'ambulance' ? 'square' : 'sine', type === 'police' ? 0.28 : type === 'ambulance' ? 1.6 : 0.18);
    const lfoG = amp(type === 'ambulance' ? 180 : 420);
    o.frequency.value = type === 'ambulance' ? 900 : 1000;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    o.connect(lp); lp.connect(g); g.connect(ch.input);
    o.start(); lfo.start();
    const h = {
      ch, g, on: false,
      set(x, z, on) {
        this.ch.move(x, z, 0.2);
        if (on !== this.on) { this.on = on; g.gain.setTargetAtTime(on ? 0.1 : 0.0001, now(), 0.6); }
      },
      stop(slow = false) {
        // slow: wind down gradually over several seconds instead of cutting off
        const t = now(), tc = slow ? 2.8 : 0.3, end = slow ? 16 : 1.5;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0.0001, t, tc);
        if (slow) o.frequency.setTargetAtTime(o.frequency.value * 0.8, t, 4);
        o.stop(t + end); lfo.stop(t + end); sirens.delete(h);
      },
    };
    sirens.add(h);
    return h;
  },
  // the crack of an aluminium bat (one of eight takes)
  bat(x, z, v = 1) { return init() ? sample('bat', x, z, { vol: 1.3 * v, offset: Math.floor(Math.random() * 8) * 1.0, dur: 0.8, fade: 0.004 }) : null; },
  // a stadium crowd erupting: a slice of the roar, longer and louder for bigger moments
  cheer(x, z, level = 0.6) {
    if (!init()) return null;
    const d = 2.2 + level * 4;
    return sample('cheer', x, z, { vol: 0.35 + level * 0.9, offset: 1.5 + Math.random() * Math.max(0.1, 13.5 - d), dur: d, fade: Math.min(0.9, d * 0.25), bus: ambBus, echo: 0.3 });
  },
  // two cars going by (one pass of the recording), following the car it belongs to
  carBy(c) {
    if (!init() || carsPlaying >= 1 || !SMP.cars || now() - (sfx.lastCars || -99) < 7) return false;
    sfx.lastCars = now();
    const h = sample('cars', c.pos.x, c.pos.z, { vol: 0.55, offset: Math.random() < 0.5 ? 3.3 : 7.2, dur: 4.4, fade: 0.9, bus: ambBus });
    if (!h) return false;
    carsPlaying++;
    const iv = setInterval(() => h.ch.move(c.pos.x, c.pos.z, 0.2), 200);
    setTimeout(() => { clearInterval(iv); carsPlaying--; }, h.D * 1000 + 100);
    return true;
  },
  // one crackling-fire loop that sits on the nearest blaze to the camera, louder the more is burning
  fire(x, z, level) {
    if (!init() || !SMP.fire) return;
    if (!fireLoop) {
      const ch = chain(x, z, { vol: 1, bus: ambBus }), s = ctx.createBufferSource(), g = amp(0);
      s.buffer = SMP.fire; s.loop = true; s.loopStart = 0.5; s.loopEnd = SMP.fire.duration - 0.5;
      s.connect(g); g.connect(ch.input); s.start(now(), Math.random() * 20);
      fireLoop = { ch, g };
    }
    fireLoop.ch.move(x, z, 0.4);
    fireLoop.g.gain.setTargetAtTime(A.muted ? 0 : level, now(), 0.6);
  },
  _internals: () => ({ ctx, chain, burst, tone, noise, filt, amp, osc, voice, ambBus, sfxBus, voiceBus, white, pink, brown, voicePool, spatial, say }),
};

// ---------- phrases ----------
export const CASUAL = ['Excuse me.', 'Come on.', "Let's go.", 'Over here.', 'Hey!', 'See you later.', 'No way.', 'I know, right?', 'Hang on.', 'This way.', 'Good morning.', 'Oh, hi!', 'Wait up.', 'Sounds good.', 'Is it this way?'];
export const REACT = ['What was that?', 'Did you see that?', 'What happened?', 'Run!', 'Oh my god!', 'Get back!', 'Somebody call nine one one!', 'Move, move!', 'Hey, what is going on?', 'Look out!', 'Is everyone okay?'];
export function pickLine(arr) { return arr[(Math.random() * arr.length) | 0]; }


// ---------- concert music: the Summer Smash set (OMERTA + three Chuckyy tracks), from one spot in the world ----------
// The set is shuffled: every song plays once, in a random order, before any plays again (and a new round never
// opens with the song that just ended). There's a short break between songs while the crowd cheers. It goes
// through a lowpass/gain/pan that tracks the camera, so it is faint and muffled from across the map and fuller up
// close, plus a crowd bed. Each song's tempo and first downbeat were measured offline from the file (beat-grid fit
// over the whole track), and that beat clock drives the crowd's jumping and the pyro.
const SET = [
  { url: 'assets/omerta.mp3', bpm: 151.5, offset: 0.29 },
  { url: 'assets/2am.mp3', bpm: 126, offset: 0.015 },
  { url: 'assets/free-smurk.mp3', bpm: 123.25, offset: 0.472 },
  { url: 'assets/testimony.mp3', bpm: 139.75, offset: 0.417 },
];
const GAP = 2.5;                                          // seconds between songs
export const music = {
  bus: null, t0: 0, x: 0, z: 0, on: false, crowd: null, buf: null, tempo: SET[0], k: 0, beatBase: 0, bag: [],
  get bpm() { return this.tempo.bpm; },
  // beats since the set started, aligned to what is currently heard (holds still in the breaks between songs)
  beat() {
    const bpm = this.tempo.bpm;
    if (!ctx || !this.on || !this.buf) return G.time * bpm / 60;
    const el = now() - (ctx.outputLatency || 0.02) - this.t0;
    return this.beatBase + Math.max(0, el - this.tempo.offset) / (60 / bpm);
  },
  // shuffle-bag: draw songs from a shuffled list, refilling it only once every song has had its turn
  pickNext() {
    if (!this.bag.length) {
      const b = SET.map((_, i) => i);
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      if (this.buf && b.length > 1 && b[0] === this.k) b.push(b.shift());     // no back-to-back repeat across rounds
      this.bag = b;
    }
    return this.bag.shift();
  },
  // decoded audio is big, so only the playing song and the next one are ever held
  load(k) { return fetch(SET[k].url).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)); },
  play(buf, k, at) {
    if (this.buf) {                                       // carry the beat count over the song change
      const played = Math.max(0, this.buf.duration - this.tempo.offset) / (60 / this.tempo.bpm);
      this.beatBase += Math.ceil(played);
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(this.in);
    this.buf = buf; this.tempo = SET[k]; this.k = k; this.t0 = at; this.src = src; this.on = true;
    src.start(at);
    src.onended = () => { if (this.src === src) this.next(); };
    const n = this.pickNext();
    this.upcoming = this.load(n).then((b) => ({ b, n })).catch((e) => { console.warn('concert track unavailable', SET[n].url, e); return null; });
  },
  next() {
    this.swell(0.45, GAP);                                // the crowd cheers between songs
    sfx.cheer && sfx.cheer(this.x, this.z - 12, 0.75);
    const p = this.upcoming || Promise.resolve(null);
    p.then((r) => {
      if (r) this.play(r.b, r.n, now() + GAP);
      else { const n = this.pickNext(); this.k = n; this.load(n).then((b) => this.play(b, n, now() + 0.5)).catch(() => {}); }
    });
  },
  start(x, z) {
    this.x = x; this.z = z;
    if (!init() || this.out) return;                     // build the chain once; the first song loads in the background
    const out = ctx.createGain(); out.gain.value = 0;
    this.lp = filt('lowpass', 1200, 0.6); this.pan = ctx.createStereoPanner(); this.send = amp(0.3);
    this.bus = amp(VOL.music); this.in = amp(1);
    this.in.connect(this.bus); this.bus.connect(this.lp); this.lp.connect(out); out.connect(this.pan); this.pan.connect(master);
    out.connect(this.send); this.send.connect(revSend);
    this.out = out;
    // crowd bed: a broad roar that swells with the drops
    const cr = noise(pink), cf = filt('bandpass', 900, 0.5); this.crowdG = amp(0.12);
    cr.connect(cf); cf.connect(this.crowdG); this.crowdG.connect(this.lp); cr.start();
    const first = this.pickNext();
    this.load(first).then((buf) => this.play(buf, first, now() + 0.1)).catch((e) => console.warn('concert track unavailable', e));
  },
  stop() { if (this.on && this.out) this.out.gain.setTargetAtTime(0, now(), 0.3); },
  // call every frame: moves the mix with the camera (the track keeps rolling underneath while the show is halted)
  update(paused = false) {
    if (!ctx || !this.out) return;
    const s = spatial(this.x, this.z), t = now();
    // heard over the walls: quiet and muffled, a little clearer up close
    const g = Math.max(0.02, Math.min(0.4, s.gain * 1.1));
    this.out.gain.setTargetAtTime(paused || !this.on ? 0 : g, t, 0.15);
    this.lp.frequency.setTargetAtTime(Math.max(180, Math.min(2200, s.cutoff * 0.35)), t, 0.15);
    this.pan.pan.setTargetAtTime(s.pan * 0.8, t, 0.15);
    this.send.gain.setTargetAtTime(Math.min(0.8, s.wet), t, 0.2);
  },
  swell(amount = 0.35, hold = 1.5) {
    if (!this.crowdG) return;
    const t = now(); this.crowdG.gain.setTargetAtTime(amount, t, 0.1); this.crowdG.gain.setTargetAtTime(0.12, t + hold, 1);
  },
};

// ---------- beach speakers at La Playa: people's own music on the sand ----------
// The same shuffle-bag set-list as the concert (every song once, in a random order, no back-to-back repeat), but
// played from a few little speakers on the beach: the loudest spot is whichever speaker is nearest the camera, it
// tops out well under the concert, and it fades to nothing within a few dozen units (the concert carries across the
// whole map). Thin in the bass and a little boxy, like a bluetooth speaker; muffled with distance like everything else.
const BEACH_SET = ['assets/beach-crazyz.mp4', 'assets/beach-chica-atractiva.mp4', 'assets/beach-locura-y-maldad.mp4', 'assets/beach-si-no-es-contigo.mp4', 'assets/beach-callaita.mp4'];
export const beachRadio = {
  spots: [], on: false, out: null, bus: null, buf: null, k: -1, bag: [], level: 0,
  pickNext() {
    if (!this.bag.length) {
      const b = (this.list || BEACH_SET).map((_, i) => i);
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      if (this.k >= 0 && b.length > 1 && b[0] === this.k) b.push(b.shift());
      this.bag = b;
    }
    return this.bag.shift();
  },
  load(k) { return fetch((this.list || BEACH_SET)[k]).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)); },
  // another set of songs (the Las Vegas rooftop clubs play their own)
  setList(list) { if (this.list !== list) { this.list = list; this.bag = []; } },
  play(buf, k, at) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(this.in);
    this.buf = buf; this.k = k; this.src = src; this.on = true;
    src.start(at);
    src.onended = () => { if (this.src === src) this.next(); };
    const n = this.pickNext();
    this.upcoming = this.load(n).then((b) => ({ b, n })).catch((e) => { console.warn('beach track unavailable', BEACH_SET[n], e); return null; });
  },
  next() {
    if (!this.spots.length) { this.on = false; return; }
    const p = this.upcoming || Promise.resolve(null);
    p.then((r) => {
      if (r) this.play(r.b, r.n, now() + 2);
      else { const n = this.pickNext(); this.load(n).then((b) => this.play(b, n, now() + 0.5)).catch(() => {}); }
    });
  },
  start(spots) {
    this.spots = spots;
    if (!init() || this.out) return;
    const out = ctx.createGain(); out.gain.value = 0;
    const hp = filt('highpass', 140, 0.7), box = filt('peaking', 1400, 0.9); box.gain.value = 3;   // small-speaker tone
    this.lp = filt('lowpass', 1200, 0.6); this.pan = ctx.createStereoPanner(); this.send = amp(0.15);
    this.bus = amp(VOL.music); this.in = amp(1);
    this.in.connect(hp); hp.connect(box); box.connect(this.bus); this.bus.connect(this.lp); this.lp.connect(out); out.connect(this.pan); this.pan.connect(master);
    out.connect(this.send); this.send.connect(revSend);
    this.out = out;
    const first = this.pickNext();
    this.load(first).then((buf) => this.play(buf, first, now() + 0.1)).catch((e) => console.warn('beach track unavailable', e));
  },
  // a speaker was blown up: it goes quiet; when none are left the music stops
  remove(spot) {
    this.spots = this.spots.filter((s) => s !== spot);
    if (!this.spots.length && this.src) { const t = now(); this.out.gain.setTargetAtTime(0, t, 0.08); this.src.onended = null; try { this.src.stop(t + 0.5); } catch (e) { /* already stopped */ } this.on = false; }
  },
  update() {
    if (!ctx || !this.out) return;
    const T = G.camTarget || { x: 0, z: 0, dist: 90 };
    let best = null, bd = 1e9;
    for (const s of this.spots) { const d = Math.hypot(s.x - T.x, s.z - T.z); if (d < bd) { bd = d; best = s; } }
    const t = now();
    if (!best || !this.on) { this.out.gain.setTargetAtTime(0, t, 0.2); this.level = 0; return; }
    // a short reach: loud-ish right by a speaker, gone about 36 units away (the zoom counts a little, not like the concert)
    const D = Math.hypot(bd, T.dist * 0.15), near = Math.max(0, Math.min(1, 1 - (D - 6) / 30));
    this.level = Math.pow(near, 1.7);
    this.out.gain.setTargetAtTime(0.21 * this.level, t, 0.15);   // about half the concert at its loudest
    this.lp.frequency.setTargetAtTime(600 + 9000 * Math.pow(near, 1.5), t, 0.15);
    const s = spatial(best.x, best.z);
    this.pan.pan.setTargetAtTime(s.pan * 0.7, t, 0.15);
    this.send.gain.setTargetAtTime(Math.min(0.5, s.wet * 0.6), t, 0.2);
  },
};

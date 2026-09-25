// Small procedural sound kit (WebAudio) so the game needs no asset files.
let ctx = null, master = null, noiseBuf = null, laserNodes = null;

function init() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  } catch { return false; }
}

function noise(dur, { freq = 800, q = 0.7, type = 'lowpass', gain = 1, attack = 0.005, decay = dur, sweepTo = null } = {}) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

function tone(type, f0, f1, dur, gain) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock() { if (init() && ctx.state === 'suspended') ctx.resume(); },
  boom(s = 1) {
    if (!init()) return;
    noise(1.2 + s, { freq: 900, sweepTo: 60, gain: 0.9 * Math.min(1.4, s), decay: 1.1 + s * 0.9 });
    tone('sine', 90, 28, 0.9 + s * 0.4, 0.8 * Math.min(1.3, s));
  },
  whistle(dur, heavy = false) {
    if (!init()) return;
    if (heavy) noise(dur, { freq: 300, sweepTo: 1800, type: 'bandpass', q: 1.2, gain: 0.35, attack: dur * 0.8, decay: dur });
    else tone('sine', 1800, 500, dur, 0.06);
  },
  wind() { if (init()) noise(0.5, { freq: 500, sweepTo: 1400, type: 'bandpass', q: 0.6, gain: 0.12, attack: 0.08, decay: 0.5 }); },
  charge() { if (init()) tone('sawtooth', 120, 1600, 0.45, 0.05); },
  zap() {
    if (!init()) return;
    noise(0.5, { freq: 3000, type: 'highpass', gain: 0.5, decay: 0.45 });
    tone('square', 900, 60, 0.35, 0.12);
    noise(1.0, { freq: 500, sweepTo: 80, gain: 0.6, decay: 0.9 });
  },
  laser(on) {
    if (!on && !laserNodes) return;
    if (!init()) return;
    if (on && !laserNodes) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
      o1.frequency.value = 110; o2.frequency.value = 113;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.1);
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2500;
      const ng = ctx.createGain(); ng.gain.value = 0.08;
      o1.connect(f); o2.connect(f); f.connect(g); src.connect(nf); nf.connect(ng); ng.connect(g); g.connect(master);
      o1.start(); o2.start(); src.start();
      laserNodes = { o1, o2, src, g };
    } else if (!on && laserNodes) {
      const n = laserNodes; laserNodes = null;
      n.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      setTimeout(() => { n.o1.stop(); n.o2.stop(); n.src.stop(); }, 300);
    }
  },
};

// Per-map ambient soundscape: continuous beds whose levels follow what is near the camera,
// plus randomly scheduled, spatially placed events (cars, horns, voices, birds, music...).
import { G } from './core.js';
import { sfx, CASUAL, REACT, pickLine } from './audio.js';

const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

// events per second, per map
const RATES = {
  downtown: { line: 1 / 4, car: 1.3, horn: 0.1, siren: 1 / 45, chatter: 1.6, say: 0, music: 1 / 28, birds: 0.05, dog: 0, mower: 0, construct: 1 / 25, gull: 0.05, boat: 1 / 60, stadium: 1 / 7 },
  tropical: { line: 1 / 4.5, car: 0.45, horn: 0.03, siren: 1 / 150, chatter: 1.0, say: 0, music: 1 / 18, birds: 0.08, dog: 1 / 80, mower: 0, construct: 0, gull: 0.18, boat: 1 / 70 },
  suburbs: { line: 1 / 6, car: 0.18, horn: 0.01, siren: 1 / 240, chatter: 0.3, say: 0, music: 1 / 90, birds: 0.35, dog: 1 / 16, mower: 1 / 45, construct: 1 / 120, gull: 0, boat: 0 },
};
const BEDS = {
  downtown: { traffic: 0.34, murmur: 0.5, wind: 0.05, hum: 0.05, waves: 0.5 },
  tropical: { traffic: 0.12, murmur: 0.35, wind: 0.12, hum: 0.0, waves: 0.9 },
  suburbs: { traffic: 0.05, murmur: 0.12, wind: 0.08, hum: 0.0, waves: 0 },
};

export class Ambience {
  constructor(map) {
    this.map = map; this.rates = RATES[map]; this.levels = BEDS[map];
    this.t = {}; this.started = false; this.waveT = 0;
  }

  start() {
    if (this.started || !sfx.ready) return;
    this.started = true;
    const I = (this.I = sfx._internals());
    const { ctx, ambBus } = I;
    const bed = (buf, type, f, q, pan = 0, rate = 1) => {
      const s = I.noise(buf, rate), fl = I.filt(type, f, q), g = I.amp(0), p = ctx.createStereoPanner();
      p.pan.value = pan;
      s.connect(fl); fl.connect(g); g.connect(p); p.connect(ambBus); s.start();
      return { g, fl };
    };
    this.traffic = [bed(I.brown, 'lowpass', 380, 0.7, -0.4), bed(I.brown, 'lowpass', 420, 0.7, 0.4)];
    this.tires = bed(I.pink, 'bandpass', 900, 0.5);
    this.wind = bed(I.pink, 'bandpass', 520, 0.6);
    this.windLfo = 0;
    this.hum = bed(I.brown, 'bandpass', 110, 3);
    this.surf = [bed(I.brown, 'lowpass', 500, 0.6, -0.3), bed(I.white, 'highpass', 2500, 0.5, 0.3)];
    // crowd murmur: two decorrelated loops for width
    this.murmur = [-0.5, 0.5].map((pan) => {
      const s = ctx.createBufferSource(); s.buffer = I.voicePool.murmur; s.loop = true;
      const bp = I.filt('bandpass', 900, 0.5), lp = I.filt('lowpass', 2400), g = I.amp(0), p = ctx.createStereoPanner();
      p.pan.value = pan; s.playbackRate.value = pan < 0 ? 0.97 : 1.04;
      s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(p); p.connect(ambBus); s.start(0, Math.random() * 8);
      return { g, lp };
    });
  }

  // what the camera is looking at: nearby people, moving cars, distance to the sea
  sample() {
    const T = G.camTarget, A = G.agents;
    let peds = 0, cars = 0, panicked = 0;
    const r2 = 40 * 40;
    for (const p of A.peds) { const d = (p.pos.x - T.x) ** 2 + (p.pos.z - T.z) ** 2; if (d < r2) { peds++; if (p.state === 'flee' || p.state === 'alert') panicked++; } }
    for (const c of A.cars) { if (c.state !== 'drive') continue; const d = (c.pos.x - T.x) ** 2 + (c.pos.z - T.z) ** 2; if (d < r2 * 1.5) cars++; }
    return { peds, cars, panicked };
  }

  set(node, v, tc = 0.8) { node.g.gain.setTargetAtTime(v, this.I.ctx.currentTime, tc); }

  update(dt) {
    if (!sfx.ready) return;
    if (!this.started) this.start();
    const L = this.levels, T = G.camTarget;
    // zoomed right in on someone: they (or whoever's next to them) say something every few seconds
    if (T.dist < 48 && (this.closeT = (this.closeT ?? 1) - dt) <= 0) {
      this.closeT = R(2.5, 5);
      let best = null, bd = 7;
      for (const p of G.agents.peds) {
        if (p.dead || p.hidden || p.state === 'gone' || p.state === 'incar' || p.state === 'air' || p.state === 'down' || p.state === 'flee' || p.state === 'alert') continue;
        const d = Math.hypot(p.pos.x - T.x, p.pos.z - T.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) sfx.line(best.pos.x, best.pos.z, 0.7);
    }
    this.sampleT = (this.sampleT || 0) - dt;
    if (this.sampleT <= 0) {
      this.sampleT = 0.5;
      const s = (this.s = this.sample());
      const alt = Math.min(1, T.dist / 150);
      const close = 1 - alt * 0.5;
      const tr = L.traffic * Math.min(1.4, 0.35 + s.cars / 14) * close;
      this.traffic.forEach((b) => this.set(b, tr));
      this.set(this.tires, tr * 0.12);
      for (const b of this.traffic) b.fl.frequency.setTargetAtTime(300 + (1 - alt) * 250, this.I.ctx.currentTime, 1);
      const mm = L.murmur * Math.min(1.5, s.peds / 45) * close * (1 - Math.min(0.7, s.panicked / Math.max(1, s.peds)));
      this.murmur.forEach((m) => { m.g.gain.setTargetAtTime(mm, this.I.ctx.currentTime, 1); m.lp.frequency.setTargetAtTime(1400 + (1 - alt) * 1800, this.I.ctx.currentTime, 1); });
      this.set(this.hum, L.hum);
      // sea gets louder the closer the view is to the shoreline
      if (L.waves) {
        const near = G.city.shoreX != null ? Math.max(0, 1 - Math.max(0, T.x - G.city.shoreX) / 70) : Math.max(0, 1 - Math.max(0, T.z - (G.city.shore ?? -36)) / 90);
        this.waveLevel = L.waves * (0.25 + near * 0.75);
      }
    }
    // gusting wind bed, stronger at altitude
    this.windLfo += dt;
    const gust = 0.6 + 0.4 * Math.sin(this.windLfo * 0.3) * Math.sin(this.windLfo * 0.17 + 1);
    this.wind.g.gain.setTargetAtTime(L.wind * gust * (0.5 + T.dist / 150), this.I.ctx.currentTime, 0.5);
    // wave swells
    if (L.waves) {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = R(4.5, 8);
        const t = this.I.ctx.currentTime, lv = this.waveLevel || 0.3;
        for (const [b, k] of [[this.surf[0], 0.55], [this.surf[1], 0.08]]) {
          b.g.gain.cancelScheduledValues(t);
          b.g.gain.setTargetAtTime(lv * k, t, 0.9);
          b.g.gain.setTargetAtTime(lv * k * 0.25, t + R(1.6, 2.4), 1.6);
        }
      }
    }
    // random events
    for (const [k, rate] of Object.entries(this.rates)) {
      if (!rate) continue;
      if (Math.random() < rate * dt) this.event(k);
    }
  }

  near(list, r, filter) {
    const T = G.camTarget, out = [];
    for (let i = 0; i < 40 && out.length < 1; i++) {
      const a = list[(Math.random() * list.length) | 0];
      if (!a) break;
      if (Math.hypot(a.pos.x - T.x, a.pos.z - T.z) < r && (!filter || filter(a))) out.push(a);
    }
    return out[0];
  }

  event(k) {
    const I = this.I, T = G.camTarget, ctx = I.ctx, t = ctx.currentTime;
    switch (k) {
      case 'car': {
        const c = this.near(G.agents.cars, 55, (c) => c.state === 'drive' && c.speed > 1);
        if (!c) return;
        const ch = I.chain(c.pos.x, c.pos.z, { bus: I.ambBus, vol: R(0.3, 0.6) });
        const d = R(1.5, 3);
        I.burst(ch.input, t, { buf: I.pink, type: 'bandpass', f: 500, sweep: 250, q: 0.8, a: d * 0.45, peak: 0.25, d: d * 0.55 });
        const o = I.osc('sawtooth', R(45, 75)), lp = I.filt('lowpass', 300), g = I.amp(0.0001);
        o.frequency.linearRampToValueAtTime(o.frequency.value * R(0.8, 1.3), t + d);
        g.gain.exponentialRampToValueAtTime(0.06, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(lp); lp.connect(g); g.connect(ch.input); o.start(t); o.stop(t + d + 0.05);
        return;
      }
      case 'horn': { const c = this.near(G.agents.cars, 60, (c) => c.state === 'drive'); if (c) sfx.horn(c.pos.x, c.pos.z, R(0.25, 0.5)); return; }
      case 'siren': {
        const a = Math.random() * 6.28, x = T.x + Math.cos(a) * 170, z = T.z + Math.sin(a) * 170;
        const ch = I.chain(x, z, { bus: I.ambBus, vol: 0.9 });
        const o = I.osc('sine', 800), lfo = I.osc('sine', 0.22), lg = I.amp(380), g = I.amp(0.0001), d = R(6, 11);
        lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(ch.input);
        g.gain.exponentialRampToValueAtTime(0.09, t + d * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.start(t); lfo.start(t); o.stop(t + d); lfo.stop(t + d);
        return;
      }
      case 'chatter': {
        const p = this.near(G.agents.peds, 38, (p) => p.state !== 'air' && p.state !== 'down');
        if (!p) return;
        if (p.state === 'flee' || p.state === 'alert') { if (Math.random() < 0.25) I.voice('scream', p.pos.x, p.pos.z, R(0.15, 0.3)); return; }   // the odd scream while people run
        sfx.chatter(p.pos.x, p.pos.z, R(0.12, 0.3));
        return;
      }
      case 'line': {
        // a recorded line of conversation from someone nearby who's plausibly talking (a group, a crew chatting,
        // now and then a passer-by); only when zoomed in enough to be among them, and not over a panic
        if (T.dist > 140 || (this.s && this.s.panicked > 3) || (G.world && G.world.rain > 0.4 && Math.random() < 0.6)) return;   // fewer people chatting in the rain
        const p = this.near(G.agents.peds, 32, (p) => (p.state === 'idle' && p.group) || p.pose === 'talk' || p.pose === 'hands' || p.pose === 'serve' || (p.state === 'walk' && Math.random() < 0.25));
        if (p) sfx.line(p.pos.x, p.pos.z, R(0.4, 0.6));
        return;
      }
      case 'say': {
        if (T.dist > 85) return;
        const p = this.near(G.agents.peds, 25);
        if (!p) return;
        const scared = this.s && this.s.panicked > 3;
        sfx.say(pickLine(scared ? REACT : CASUAL), p.pos.x, p.pos.z, 0.3);
        return;
      }
      case 'stadium': this.stadium(); return;
      case 'music': this.music(); return;
      case 'birds': case 'gull': this.bird(k === 'gull'); return;
      case 'dog': this.dog(); return;
      case 'mower': this.mower(); return;
      case 'construct': this.construct(); return;
      case 'boat': {
        const ch = G.city.shoreX != null ? I.chain(G.city.shoreX - 60, T.z + R(-60, 60), { bus: I.ambBus, vol: 0.8 }) : I.chain(T.x + R(-60, 60), (G.city.shore ?? -40) - 60, { bus: I.ambBus, vol: 0.8 });
        for (const f of [82, 123]) I.tone(ch.input, t, { type: 'sawtooth', f, a: 0.3, peak: 0.08, d: 2.5 });
        return;
      }
    }
  }

  spotNear(r) {
    const T = G.camTarget;
    return { x: T.x + R(-r, r), z: T.z + R(-r, r) };
  }

  music() {
    const I = this.I, t = I.ctx.currentTime, p = this.spotNear(30);
    const ch = I.chain(p.x, p.z, { bus: I.ambBus, vol: 0.5 });
    const wall = I.filt('lowpass', this.map === 'tropical' ? 2200 : 1300); wall.connect(ch.input); // heard from outside the shop
    const bpm = this.map === 'tropical' ? R(100, 118) : R(84, 100), beat = 60 / bpm, bars = Math.round(R(4, 7));
    const root = pick([196, 220, 174.6, 233]);
    const progs = this.map === 'tropical' ? [[0, 5, 7, 5], [0, 9, 5, 7]] : [[0, 5, 10, 3], [0, 9, 2, 7]];
    const prog = pick(progs);
    const fade = I.amp(0.0001); fade.connect(wall);
    const total = bars * 4 * beat;
    fade.gain.exponentialRampToValueAtTime(1, t + 1.5); fade.gain.setValueAtTime(1, t + total - 1.5); fade.gain.exponentialRampToValueAtTime(0.0001, t + total);
    for (let b = 0; b < bars; b++) {
      const deg = prog[b % prog.length], base = root * Math.pow(2, deg / 12);
      for (let q = 0; q < 4; q++) {
        const tq = t + (b * 4 + q) * beat;
        const chord = [1, 1.26, 1.5, 1.89];
        chord.forEach((m, i) => { if (this.map !== 'tropical' || q % 2 === 0) I.tone(fade, tq + i * 0.01, { type: this.map === 'tropical' ? 'sine' : 'triangle', f: base * m, a: 0.005, peak: 0.05, d: this.map === 'tropical' ? 0.3 : beat * 0.9 }); });
        I.tone(fade, tq, { f: base / 2, a: 0.01, peak: 0.12, d: beat * 0.8 });
        I.tone(fade, tq, { f: 90, f1: 45, a: 0.002, peak: q % 2 ? 0.05 : 0.18, d: 0.18 });
        I.burst(fade, tq + beat / 2, { type: 'highpass', f: 7000, a: 0.001, peak: 0.04, d: 0.04 });
      }
    }
  }

  // crowd reaction drifting out of the ballpark: a swelling roar, sometimes applause
  stadium() {
    const P = G.petco;
    if (!P || (P.phase && P.phase !== 'game')) return;
    const I = this.I, t = I.ctx.currentTime;
    const s = I.spatial(P.center.x, P.center.z);
    if (s.D > 110) return;
    const ch = I.chain(P.center.x, P.center.z, { bus: I.ambBus, vol: 1.1, wetBoost: 0.25 });
    const big = Math.random() < 0.3, d = big ? R(3, 5) : R(1.5, 3);
    I.burst(ch.input, t, { buf: I.pink, type: 'bandpass', f: big ? 900 : 700, q: 0.6, a: big ? 0.25 : 0.5, peak: big ? 0.55 : 0.25, d });
    if (Math.random() < 0.6) for (let i = 0; i < 70; i++) I.burst(ch.input, t + R(0.2, d), { f: R(1500, 3500), q: 2, a: 0.001, peak: R(0.02, 0.06), d: 0.02 });
  }

  bird(gull) {
    const I = this.I, t = I.ctx.currentTime, p = this.spotNear(45);
    const ch = I.chain(p.x, p.z, { bus: I.ambBus, vol: gull ? 0.5 : 0.35 });
    if (gull) {
      for (let i = 0, n = 2 + (Math.random() * 3) | 0; i < n; i++) {
        const t0 = t + i * R(0.3, 0.45), f = R(1100, 1500);
        const o = I.osc('sawtooth', f), bp = I.filt('bandpass', 1800, 3), g = I.amp(0.0001);
        o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.62, t0 + 0.28);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        o.connect(bp); bp.connect(g); g.connect(ch.input); o.start(t0); o.stop(t0 + 0.35);
      }
      return;
    }
    const n = 3 + (Math.random() * 6) | 0, base = R(2600, 4200);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * R(0.08, 0.2);
      I.tone(ch.input, t0, { f: base * R(0.85, 1.1), f1: base * R(1.2, 1.6), a: 0.004, peak: 0.08, d: R(0.04, 0.1), glide: 0.06 });
    }
  }

  dog() {
    const I = this.I, t = I.ctx.currentTime, p = this.spotNear(55);
    const ch = I.chain(p.x, p.z, { bus: I.ambBus, vol: 0.6 });
    for (let i = 0, n = 1 + (Math.random() * 3) | 0; i < n; i++) {
      const t0 = t + i * R(0.25, 0.4), f = R(280, 420);
      const o = I.osc('sawtooth', f), bp = I.filt('bandpass', R(700, 1100), 2), g = I.amp(0.0001);
      o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 0.14);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(bp); bp.connect(g); g.connect(ch.input); o.start(t0); o.stop(t0 + 0.2);
      I.burst(ch.input, t0, { f: 1500, q: 1, a: 0.002, peak: 0.1, d: 0.06 });
    }
  }

  mower() {
    const I = this.I, t = I.ctx.currentTime, p = this.spotNear(60), d = R(6, 12);
    const ch = I.chain(p.x, p.z, { bus: I.ambBus, vol: 0.5 });
    const o = I.osc('sawtooth', R(38, 48)), lp = I.filt('lowpass', 700), g = I.amp(0.0001);
    const wob = I.osc('sine', 0.5), wg = I.amp(3); wob.connect(wg); wg.connect(o.frequency);
    g.gain.exponentialRampToValueAtTime(0.07, t + 1.5); g.gain.setValueAtTime(0.07, t + d - 2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp); lp.connect(g); g.connect(ch.input); o.start(t); wob.start(t); o.stop(t + d); wob.stop(t + d);
  }

  construct() {
    const I = this.I, t = I.ctx.currentTime, p = this.spotNear(60);
    const ch = I.chain(p.x, p.z, { bus: I.ambBus, vol: 0.5 });
    if (Math.random() < 0.5) {
      for (let i = 0, n = 4 + (Math.random() * 8) | 0; i < n; i++) {
        const t0 = t + i * R(0.35, 0.6);
        I.burst(ch.input, t0, { f: 2500, q: 4, a: 0.001, peak: 0.25, d: 0.05 });
        I.tone(ch.input, t0, { f: R(1800, 2600), a: 0.001, peak: 0.04, d: 0.25 });
      }
    } else {
      const d = R(1.5, 3.5);
      for (let i = 0; i < d * 22; i++) I.burst(ch.input, t + i / 22, { buf: I.brown, type: 'bandpass', f: 400, q: 1, a: 0.002, peak: 0.2, d: 0.03 });
    }
  }
}

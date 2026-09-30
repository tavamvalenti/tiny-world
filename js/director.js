// The world director: decides when something happens on its own. A small pool of believable events (accident,
// small fire, street disturbance, traffic jam, the odd evacuation, a gang flare-up in Chicago, weather changes),
// each started through the very same functions the WORLD menu uses, so an autonomous fire is the same FIRE event
// as a placed one, with the same responders. It's deliberately sparing:
//   - long quiet spells between events (the city mostly just goes about its day)
//   - at most 2 major events running at once from here (3 counting the player's), and none while 3 are active
//   - when the player causes chaos, autonomous events back off for a while
//   - events start near where the player is looking, so they're seen; far-off events aren't started at all
// It runs on a shared 0.5 s tick, not every frame.
import { G, rand, pick } from './core.js';
import { settings } from './settings.js';

const MAJOR = new Set(['FIRE', 'TRAFFIC_ACCIDENT', 'SHOOTING', 'RIOT', 'EVACUATION', 'GANG_CONFLICT', 'DISTURBANCE']);
const MEAN = { off: 0, low: 150, normal: 80, high: 40 };        // mean seconds between autonomous events
const PLAYER = new Set(['explosion', 'wind', 'meteor', 'energy', 'laser']);
// what can happen where (weights)
const POOL = {
  downtown: { accident: 3, jam: 3, fire: 2, disturbance: 2, evacuation: 0.5, weather: 1.2 },
  suburbs: { accident: 2, jam: 1.5, fire: 2, disturbance: 2, evacuation: 0.5, gang: 1.5, weather: 1.6 },
  tropical: { accident: 2, jam: 2, fire: 1.5, disturbance: 1.5, evacuation: 0.4, weather: 1.2 },
};
// weather each place tends toward (clear dominates)
const WEATHER = {
  downtown: { clear: 5, rain: 2, storm: 0.6 },
  suburbs: { clear: 4, rain: 2, storm: 1, snow: 2 },
  tropical: { clear: 6, rain: 1.5, storm: 1 },
};
const weighted = (o) => { let k = Math.random() * Object.values(o).reduce((a, b) => a + b, 0); for (const [n, w] of Object.entries(o)) if ((k -= w) <= 0) return n; return Object.keys(o)[0]; };

export class Director {
  constructor(mapName) {
    this.map = mapName;
    this.t = rand(45, 70);          // a peaceful start
    this.tick = 0; this.heat = 0;
    this.weatherT = rand(90, 200);
    G.director = this;
  }
  // how much is going on right now
  active() {
    const A = G.agents;
    let n = A.incidents.filter((e) => e.active && MAJOR.has(e.type)).length;
    if (G.gangs && G.gangs.fight) n++;
    return n;
  }
  // the player's weapons stir things up: autonomous events hold off while the dust settles
  onBlast(x, y, z, r, power, kind) { if (PLAYER.has(kind)) this.heat = Math.min(120, this.heat + Math.max(4, power * 2.5)); }
  allow(kind = null) {
    const cap = this.heat > 20 ? 0 : 2;                      // player chaos: nothing new of our own for a while
    return this.active() < cap && (kind !== 'GANG_CONFLICT' || this.heat < 10);
  }

  update(dt) {
    this.heat = Math.max(0, this.heat - dt);
    if ((this.tick -= dt) > 0) return;
    const step = 0.5 - this.tick; this.tick = 0.5;
    // everyday stories for the ticker's quiet spells
    if ((this.storyT = (this.storyT ?? rand(30, 60)) - step) <= 0) { this.storyT = rand(60, 120); this.story(); }
    // weather drifts on its own clock
    if ((this.weatherT -= step) <= 0) { this.weatherT = rand(150, 320); this.weather(); }
    const mean = MEAN[settings.incidents] || 0;
    if (!mean) return;
    if ((this.t -= step) > 0) return;
    if (!this.allow()) { this.t = rand(10, 20); return; }
    const kind = weighted(POOL[this.map] || POOL.downtown);
    const ok = this.start(kind);
    this.t = ok ? mean * rand(0.6, 1.5) : rand(6, 12);           // nothing suitable in view: try again shortly
  }
  start(kind) {
    const W = G.world, T = G.camTarget;
    switch (kind) {
      case 'accident': return G.chaos.crash();
      case 'fire': return G.chaos.fire();
      case 'jam': return !!W.jam();
      case 'weather': this.weatherT = 0; return true;
      case 'gang': if (!G.gangs || !this.allow('GANG_CONFLICT')) return false; G.gangs.startFight(); return true;
      case 'disturbance': {
        const p = G.chaos.crowded(G.agents.peds.filter((q) => q.state === 'walk' && !q.role && G.chaos.safe(q)), 45);
        if (!p) return false;
        return !!W.riot(p.pos.x, p.pos.z, { n: Math.round(rand(3, 6)), type: 'DISTURBANCE' });
      }
      case 'evacuation': {
        // a gas leak: people are moved away from a building and a fire crew checks it
        const B = G.buildings.list.filter((b) => !b.gable && Math.hypot(b.x - T.x, b.z - T.z) < 40 && G.chaos.safe({ pos: { x: b.x, z: b.z } }));
        const b = pick(B);
        if (!b) return false;
        return !!W.evacuate(b.x, b.z + b.d / 2 + 1, 18);
      }
    }
    return false;
  }
  story() {
    const N = G.news, clear = !G.world.kind || G.world.kind === 'clear';
    if (!N) return;
    const S = {
      downtown: [['LOCAL', 'Crane work continues on downtown construction sites'], ['LOCAL', 'Trolley running on schedule through the Gaslamp Quarter'], ...(clear ? [['LOCAL', 'Sunny afternoon brings crowds to the waterfront']] : [])],
      suburbs: [['SPORTS', 'Streetball game under way by the courts'], ['LOCAL', 'Construction crews busy on the South Side'], ...(G.concert && G.concert.phase === 'active' ? [['FESTIVAL', 'Summer Smash crowd packed in front of the main stage']] : [])],
      tropical: N.es ? [['LOCAL', clear ? 'Día soleado: la playa llena de turistas' : 'Pocos bañistas por el mal tiempo'], ['LOCAL', 'Salvavidas vigilan la playa'], ['LOCAL', 'Hoteles de la costa reportan alta ocupación']]
        : [['LOCAL', clear ? 'Sunny day brings crowds to the beach' : 'Beach quiet as weather turns'], ['LOCAL', 'Lifeguards on watch along the beach'], ['LOCAL', 'Beachfront hotels report a busy week']],
    }[this.map];
    if (S) { const [tag, text] = pick(S); N.post(tag, text, 1, 'story-' + text); }
  }
  weather() {
    const W = G.world, next = weighted(WEATHER[this.map] || WEATHER.downtown);
    if (next === (W.kind || 'clear')) return;
    W.setWeather(next);
  }
}

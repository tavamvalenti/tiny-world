// Shared game state. Every system hangs itself off G so modules can talk without wiring.
export const G = {
  scene: null, camera: null, renderer: null,
  time: 0, dt: 0,
  city: null, buildings: null, fx: null, agents: null, weapons: null, ground: null,
  wind: { x: 0.6, z: -0.25 },
  shake: 0,
  camTarget: null,
  terrainH: null,           // (x, z) => ground height, for maps with hills (La Playa); flat elsewhere
};

// the real screen height: an app launched from the iPhone home screen reports innerHeight a status bar short,
// which left an empty band at the bottom; index.html measures the true height into --appH there
export function viewH() {
  const v = document.documentElement.style.getPropertyValue('--appH');
  return v ? parseFloat(v) : window.innerHeight;
}

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Deterministic RNG for map generation so layouts look curated rather than noisy.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Global blast notification: agents, props, trees react to this.
// power ~ impulse scale, radius ~ how far people notice.
export function blast(x, y, z, radius, power, kind = 'explosion') {
  G.agents && G.agents.onBlast(x, y, z, radius, power, kind);
  G.city && G.city.onBlast(x, y, z, radius, power, kind);
  G.fx && G.fx.onBlast(x, y, z, radius, power, kind);
  G.trains && G.trains.onBlast(x, y, z, radius, power, kind);
  G.concert && G.concert.onBlast(x, y, z, radius, power, kind);
  G.court && G.court.onBlast(x, y, z, radius, power, kind);
  G.petco && G.petco.onBlast && G.petco.onBlast(x, y, z, radius, power, kind);
  G.playa && G.playa.onBlast && G.playa.onBlast(x, y, z, radius, power, kind);
  G.gangs && G.gangs.onBlast(x, y, z, radius, power, kind);
  G.responders && G.responders.onBlast(x, y, z, radius, power, kind);
  G.sky && G.sky.onBlast(x, y, z, radius, power, kind);
  G.construction && G.construction.onBlast(x, y, z, radius, power, kind);
  G.director && G.director.onBlast(x, y, z, radius, power, kind);
  G.news && G.news.onBlast(x, y, z, radius, power, kind);
}

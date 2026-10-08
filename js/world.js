// One continuous world: a small shared event layer plus the WORLD menu's spawns and triggers.
//
// World events (FIRE, TRAFFIC_ACCIDENT, SHOOTING, RIOT, ...) are the existing emergency incidents with a type:
// { type, x, z, sev, active, threat?, rioters?, needs? }. Whatever causes one (a player bomb that sets a
// building alight, a random fire, a fire placed from the menu, a lightning strike) raises the same event, and
// the same responders answer it. This file also decides when an event is resolved (fire out, threat down,
// rioters dispersed, the injured seen to) and then releases the responders.
import * as THREE from 'three';
import { G, rand, pick, blast } from './core.js';
import { sfx } from './audio.js';

export const EV = {
  FIRE: 'FIRE', TRAFFIC_ACCIDENT: 'TRAFFIC_ACCIDENT', SHOOTING: 'SHOOTING', POLICE_RESPONSE: 'POLICE_RESPONSE', FIRE_RESPONSE: 'FIRE_RESPONSE',
  MEDICAL_RESPONSE: 'MEDICAL_RESPONSE', EVACUATION: 'EVACUATION', RIOT: 'RIOT', GANG_CONFLICT: 'GANG_CONFLICT', FESTIVAL_EVENT: 'FESTIVAL_EVENT', WEATHER_EVENT: 'WEATHER_EVENT',
  DISTURBANCE: 'DISTURBANCE', TRAFFIC_JAM: 'TRAFFIC_JAM',
};
const NO_RESPONDERS = new Set([EV.FESTIVAL_EVENT, EV.WEATHER_EVENT, EV.TRAFFIC_JAM]);

// The WORLD menu. `now` items apply immediately; everything else is placed by clicking the map.
export const MENU = [
  { cat: 'PEOPLE', items: [['civilian', 'Civilian'], ['worker', 'Worker'], ['police', 'Police'], ['firefighter', 'Firefighter'], ['paramedic', 'Paramedic'], ['security', 'Security'], ['gang', 'Gang Member']] },
  { cat: 'VEHICLES', items: [['v-police', 'Police'], ['v-fire', 'Fire Truck'], ['v-ambulance', 'Ambulance'], ['v-car', 'Civilian Car'], ['v-bus', 'Bus'], ['v-taxi', 'Taxi'], ['v-moto', 'Motorcycle']] },
  { cat: 'EVENTS', items: [['e-accident', 'Traffic Accident'], ['e-jam', 'Traffic Jam'], ['e-fire', 'Fire'], ['e-disturb', 'Disturbance'], ['e-riot', 'Riot'], ['e-evac', 'Evacuation'], ['e-gang', 'Gang Conflict']] },
  { cat: 'WORLD', items: [['w-clear', 'Clear', 'now'], ['w-rain', 'Rain', 'now'], ['w-storm', 'Storm', 'now'], ['w-snow', 'Snow', 'now'], ['w-lightning', 'Lightning']] },
];

const RAIN_N = 1600, RAIN_BOX = 46, RAIN_TOP = 42, SNOW_N = 1400;

export class World {
  constructor(scene) {
    this.misc = [];                 // events nobody responds to (weather, festival)
    this.armed = null;              // menu item waiting for a click on the map
    this.rain = 0; this.rainTarget = 0; this.storm = false; this.boltT = rand(6, 12); this.flashT = 0;
    // rain: one line-segment buffer of streaks that follows the camera
    const pos = new Float32Array(RAIN_N * 6);
    this.drops = new Float32Array(RAIN_N * 3);
    for (let i = 0; i < RAIN_N; i++) { this.drops[i * 3] = rand(-RAIN_BOX, RAIN_BOX); this.drops[i * 3 + 1] = rand(0, RAIN_TOP); this.drops[i * 3 + 2] = rand(-RAIN_BOX, RAIN_BOX); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb4c4d0, transparent: true, opacity: 0.4, depthWrite: false }));
    this.rainLines.frustumCulled = false; this.rainLines.visible = false; scene.add(this.rainLines);
    this.boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4.4, 6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.bolts = [];
    this.scene = scene;
  }

  // ---------- events ----------
  get events() { return [...G.agents.incidents, ...this.misc]; }
  raise(type, x, z, opts = {}) {
    let ev;
    if (NO_RESPONDERS.has(type)) { ev = { type, x, z, sev: opts.severity || 1, active: true, t: 0, life: opts.life || 20, news: opts.news, tag: opts.tag }; this.misc.push(ev); }
    else ev = G.agents.report(x, z, opts.severity ?? 1, type, opts);
    // the local news picks it up (once per event; merged reports don't make a second story)
    // (emergencies are reported to the news by agents.report; these are the ones nobody responds to)
    if (ev && !ev.reported && opts.quiet !== true) { ev.reported = true; G.news && G.news.event(ev); }
    return ev;
  }
  resolve(ev) {
    if (!ev || !ev.active) return;
    const k = this.misc.indexOf(ev);
    if (k >= 0) { ev.active = false; this.misc.splice(k, 1); } else G.agents.release(ev);
    G.news && G.news.resolved(ev);
  }
  update(dt) {
    const A = G.agents;
    for (const ev of [...A.incidents]) {
      if (!ev.active) continue;
      ev.t = (ev.t || 0) + dt;
      const cars = A.cars.filter((c) => c.incident === ev && c.state === 'onscene');
      if (cars.length && ev.arrived == null) ev.arrived = ev.t;
      if (ev.arrived == null) { if (ev.t > 180) this.resolve(ev); continue; }
      // far from the camera there are no crews: fires are knocked down in the abstract
      if (ev.type === EV.FIRE && cars.some((c) => c.virtual && c.emerg === 'fire')) this.douse(ev, 16, dt * 1.5);
      if (this.done(ev, ev.t - ev.arrived)) this.resolve(ev);
    }
    for (const ev of [...this.misc]) if ((ev.t += dt) > ev.life) this.resolve(ev);
    this.updateRiots(dt);
    this.updateWeather(dt);
  }
  done(ev, held) {
    // the injured have been seen to: nobody near the scene is still lying there or being worked on
    const treated = () => held > 80 || (!G.agents.peds.some((p) => (p.state === 'down' || p.state === 'carried') && Math.hypot(p.pos.x - ev.x, p.pos.z - ev.z) < 15)
      && !(G.responders && G.responders.people.some((p) => p.role === 'medic' && p.ev === ev && p.job && p.job.kind !== 'idle')));
    const threatDealt = () => !ev.threat || ev.threatDown || !ev.threat.hostile || ev.threat.state === 'down' || ev.threat.state === 'gone';
    switch (ev.type) {
      case EV.FIRE: return (held > 6 && !this.fireNear(ev, 16)) || held > 160;
      case EV.SHOOTING: return (held > 15 && threatDealt() && treated()) || held > 110;
      case EV.GANG_CONFLICT: return (held > 15 && threatDealt() && !(G.gangs && G.gangs.fight) && treated()) || held > 110;
      case EV.RIOT: case EV.DISTURBANCE: return (held > 10 && !(ev.rioters || []).some((p) => p.state === 'riot')) || held > 130;
      case EV.TRAFFIC_ACCIDENT: return (held > 18 && treated() && !this.fireNear(ev, 10)) || held > 100;
      case EV.EVACUATION: return held > 25;
      default: return (held > 30 && !this.fireNear(ev, 12) && treated()) || held > 130;
    }
  }
  fireNear(ev, r) {
    for (const c of G.buildings.burning) if (c.alive && c.fire > 0 && Math.hypot(c.x - ev.x, c.z - ev.z) < r) return true;
    for (const c of G.agents.cars) if (c.fire > 0 && c.state !== 'hidden' && Math.hypot(c.pos.x - ev.x, c.pos.z - ev.z) < r) return true;
    return G.fx.groundFires.some((f) => f.t > 0 && Math.hypot(f.x - ev.x, f.z - ev.z) < r);
  }
  douse(ev, r, k) {
    const B = G.buildings;
    for (const c of B.burning) if (Math.hypot(c.x - ev.x, c.z - ev.z) < r) { c.fire -= k * 4; if (c.fire <= 0) { c.fire = 0; B.burning.delete(c); B.writeState(c); } }
  }

  // ---------- spawning from the WORLD menu ----------
  // a walkable spot at/near p (clicks can land on roofs and walls)
  ground(p) {
    const B = G.buildings;
    for (let r = 0; r < 6; r += 0.6) for (let a = 0; a < 6.28; a += r ? 0.7 : 7) {
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!B.inside(new THREE.Vector3(x, 0.3, z))) return { x, z };
    }
    return { x: p.x, z: p.z };
  }
  place(id, point) {
    const A = G.agents, g = this.ground(point), { x, z } = g;
    const col = (m, i, c) => { m.setColorAt(i, new THREE.Color(c)); m.instanceColor.needsUpdate = true; };
    const person = (look, setup) => {
      const p = A.borrowPed({ x, z }, 25) || A.borrowPed({ x, z }, 0);
      if (!p) return null;
      A.pedColors(p.i);
      if (look) { const [t, l, h] = look; col(A.pTorso, p.i, t); if (l) { col(A.pLegL, p.i, l); col(A.pLegR, p.i, l); } if (h) col(A.pHair, p.i, h); col(A.pArmL, p.i, t); col(A.pArmR, p.i, t); }
      for (const m of A.pMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
      p.pos.set(x + rand(-0.4, 0.4), 0, z + rand(-0.4, 0.4)); p.q.identity(); p.dead = false; p.lost = null; p.hostile = false; p.riot = null;
      setup(p);
      G.fx.dust(p.pos.x, 0.1, p.pos.z, 0.2);
      return p;
    };
    const hangAround = (p, r, group) => { p.zone = { x0: x - r, x1: x + r, z0: z - r, z1: z + r }; p.group = group ? { x, z } : null; p.state = 'idle'; p.timer = rand(4, 12); p.target = { x: p.pos.x, z: p.pos.z }; };
    switch (id) {
      case 'civilian': return person(null, (p) => { p.zone = null; p.group = null; A.resumePed(p); });
      case 'worker': return person([pick([0xf28c1c, 0xd8e03a]), 0x2a3448, 0xf2c230], (p) => { if (G.roles) return G.roles.hireAt(p, 'worker', x, z); hangAround(p, 3, false); p.state = 'wander'; p.target = { x: x + rand(-3, 3), z: z + rand(-3, 3) }; p.worker = true; });
      case 'security': return person([0x141414, 0x141414, 0x141414], (p) => { if (G.roles) return G.roles.hireAt(p, 'security', x, z); hangAround(p, 4, false); p.state = 'wander'; p.target = { x: x + rand(-4, 4), z: z + rand(-4, 4) }; });   // walks their post
      case 'gang': {
        // London: roadmen, all in black (puffers, Nike Tech, balaclavas); knives, never guns
        if (G.london) { for (let k = 0; k < 4; k++) person(null, (p) => { hangAround(p, 1, true); G.london.dressRoadman(p); p.gangSide = 'roadmen'; }); return true; }
        // a few colour-wearing members loitering together (blue or red by which side of town they're on)
        const Z = G.gangs && G.gangs.zones, side = Z ? (Math.abs(z - Z.red.z0) < Math.abs(z - Z.blue.z1) ? 'red' : 'blue') : pick(['red', 'blue']);
        const c = side === 'red' ? 0xcc1f2a : 0x1f55d6;
        for (let k = 0; k < 3; k++) person([k ? pick([c, 0x1c1d20]) : c, 0x1c1d20, c], (p) => { hangAround(p, 1, true); p.gangSide = side; });
        return true;
      }
      case 'police': return G.responders.spawnStandalone('police', x, z);
      case 'firefighter': return G.responders.spawnStandalone('fire', x, z);
      case 'paramedic': return G.responders.spawnStandalone('medic', x, z);
      case 'v-police': case 'v-fire': case 'v-ambulance': {
        const type = id.slice(2) === 'fire' ? 'fire' : id.slice(2);
        const c = A.cars.find((o) => o.emerg === type && o.state === 'hidden' && !o.posted);
        if (!c) return null;
        this.onRoad(c, x, z); c.patrolUntil = G.time + rand(60, 120); c.sirenOn = false; c.sirenOffAt = G.time - 1; c.incident = null; c.dest = null; c.leaving = false;
        return c;
      }
      case 'v-moto': {
        const c = A.borrowCar({ x, z }, 25) || A.borrowCar({ x, z }, 0);
        if (!c) return null;
        if (!c.moto) { A.carBody.setMatrixAt(c.i, new THREE.Matrix4().makeScale(0, 0, 0)); A.makeMoto(c); }
        c.maxSpeed = rand(4, 5.2);
        this.onRoad(c, x, z);
        return c;
      }
      case 'v-car': case 'v-bus': case 'v-taxi': {
        const c = A.borrowCar({ x, z }, 25) || A.borrowCar({ x, z }, 0);
        if (!c) return null;
        c.moto = false;                                            // (a borrowed bike becomes a car)
        const bus = id === 'v-bus';
        c.scale = bus ? [1.15, 1.7, 3.2] : [1, 1, rand(0.95, 1.05)]; c.len = 0.8 * c.scale[2];
        c.color = new THREE.Color(bus ? 0xe8e4d8 : id === 'v-taxi' ? 0xf2c230 : A.carColor());
        c.maxSpeed = rand(3.2, 4.4) * (bus ? 0.75 : 1);
        A.carBody.setColorAt(c.i, c.color); A.carBody.instanceColor.needsUpdate = true;
        A.doors.setColorAt(c.i * 2, c.color); A.doors.setColorAt(c.i * 2 + 1, c.color); A.doors.instanceColor.needsUpdate = true;
        this.onRoad(c, x, z);
        return c;
      }
      case 'e-fire': return this.startFire(point.x, point.z, point.y ?? 0);
      case 'e-accident': {
        let car = A.cars.filter((c) => c.state === 'drive' && !c.emerg && !c.incident && Math.hypot(c.pos.x - x, c.pos.z - z) < 18).sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0];
        if (!car) { car = A.borrowCar({ x, z }, 25); if (car) this.onRoad(car, x, z); }
        return car && G.chaos.crash(car);
      }
      case 'e-riot': return this.riot(x, z);
      case 'e-disturb': return this.riot(x, z, { n: 5, type: EV.DISTURBANCE });
      case 'e-jam': return this.jam(x, z);
      case 'e-evac': return this.evacuate(x, z);
      case 'e-gang': {
        if (G.london) return G.london.knifeFight(x, z);         // London: two crews of roadmen with knives
        const Gs = G.gangs;
        if (Gs && Math.abs(z - Gs.border.z) < 40 && x > Gs.border.x0 - 20 && x < Gs.border.x1 + 20) { Gs.startFight(null, Math.max(Gs.border.x0 + 3, Math.min(Gs.border.x1 - 3, x))); return this.raise(EV.GANG_CONFLICT, x, Gs.border.z, { severity: 1.4 }); }
        return G.chaos.shooting({ x, z }, EV.GANG_CONFLICT);
      }
      case 'w-lightning': return this.strike(point.x, point.y ?? 0, point.z);
      case 'w-clear': return this.setWeather('clear');
      case 'w-rain': return this.setWeather('rain');
      case 'w-storm': return this.setWeather('storm');
      case 'w-snow': return this.setWeather('snow');
    }
    return null;
  }
  // put a car straight onto the nearest lane, facing along it
  onRoad(c, x, z) {
    const A = G.agents;
    c.pos.set(x, 0, z); c.state = 'parked';
    A.joinTraffic(c);
    const q = c.queue.shift(), n = c.queue[0];
    if (q) c.pos.set(q.x, 0, q.z);
    if (n) c.heading = Math.atan2(n.x - c.pos.x, n.z - c.pos.z);
    c.speed = 1; c.flee = 0; c.timer = 0; c.parking = null; c.driver = null;
  }

  // ---------- events the player can start ----------
  startFire(x, z, y = 0) {
    const B = G.buildings;
    const cells = [];
    for (const b of B.list) {
      if (Math.abs(b.x - x) > b.w / 2 + 3 || Math.abs(b.z - z) > b.d / 2 + 3) continue;
      for (const c of b.cells) if (c.alive && !c.burnedOut && c.fire <= 0) cells.push(c);
    }
    cells.sort((a, b) => Math.hypot(a.x - x, a.y - y, a.z - z) - Math.hypot(b.x - x, b.y - y, b.z - z));
    const lit = cells.slice(0, 3).filter((c) => Math.hypot(c.x - x, c.z - z) < 4);
    for (const c of lit) { c.heat = 1; B.ignite(c); }
    if (!lit.length) {
      G.fx.groundFire(x, 0.05, z, rand(45, 70), 1.2);
      const car = G.agents.cars.filter((c) => c.state !== 'hidden' && Math.hypot(c.pos.x - x, c.pos.z - z) < 3)[0];
      if (car) car.fire = rand(35, 55);
    }
    G.fx.flash(x, 1.5, z, 0xff9040, 20, 0.3, 20);
    sfx.pyro(x, z, false);
    return this.raise(EV.FIRE, x, z, { severity: lit.length ? 1.2 : 1, delay: rand(0.6, 1.2) });
  }
  evacuate(x, z, R = 35) {
    const A = G.agents;
    for (const p of A.peds) {
      if (['down', 'air', 'gone', 'incar', 'carried'].includes(p.state) || Math.hypot(p.pos.x - x, p.pos.z - z) > R) continue;
      p.threat = { x, z }; p.state = 'flee'; p.timer = rand(10, 16); p.riot = null;
    }
    for (const c of A.cars) if (c.state === 'drive' && !c.emerg && Math.hypot(c.pos.x - x, c.pos.z - z) < R) { c.flee = rand(8, 12); c.threat = { x, z }; }
    if (G.concert && G.concert.inVenue(x, z, 10)) G.concert.evacuate(x, z);
    sfx.screams(x, z, 3);
    return this.raise(EV.EVACUATION, x, z, { severity: 1, delay: rand(2, 4) });
  }
  // a riot, or (smaller, shorter) a street disturbance: same crowd behaviour, same police response
  riot(x, z, { n = 12, type = EV.RIOT } = {}) {
    const A = G.agents, small = type === EV.DISTURBANCE, until = G.time + (small ? rand(45, 70) : rand(80, 110));
    let crowd = A.peds.filter((p) => ['walk', 'wander', 'idle', 'wait', 'return'].includes(p.state) && !p.officer && !p.role && Math.hypot(p.pos.x - x, p.pos.z - z) < 22).slice(0, Math.round(n * 1.3));
    // not enough people here: others turn up from out of view
    for (let k = crowd.length; k < n; k++) { const p = A.borrowPed({ x, z }, 30); if (!p) break; const a = rand(0, 6.28); p.pos.set(x + Math.cos(a) * rand(6, 10), 0, z + Math.sin(a) * rand(6, 10)); crowd.push(p); }
    crowd = [...new Set(crowd)];
    for (const p of crowd) { p.state = 'riot'; p.riot = { x, z, until, calm: small }; p.target = { x: x + rand(-2.5, 2.5), z: z + rand(-2.5, 2.5) }; p.zone = null; p.group = null; }
    // bystanders back off from it
    for (const p of A.peds) if (!crowd.includes(p) && ['walk', 'wander', 'idle', 'wait'].includes(p.state) && Math.hypot(p.pos.x - x, p.pos.z - z) < 14) { p.state = 'flee'; p.timer = rand(4, 8); p.threat = { x, z }; }
    const ev = this.raise(type, x, z, { severity: small ? 1 : 1.5, delay: rand(3, 5) });
    ev.rioters = crowd; ev.noiseT = 0;
    return ev;
  }
  // a rioter hurls something at the nearest car; now and then a car goes up
  riotThrow(p) {
    if (p.riot && p.riot.calm && Math.random() < 0.7) return;      // a disturbance is mostly shouting and shoving
    const car = G.agents.cars.filter((c) => c.state !== 'hidden' && !c.emerg && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 9)[0];
    const tx = car ? car.pos.x : p.riot.x + rand(-3, 3), tz = car ? car.pos.z : p.riot.z + rand(-3, 3), T = 0.7;
    G.fx.bits.emit(p.pos.x, 0.7, p.pos.z, (tx - p.pos.x) / T, 0.5 * 12 * T, (tz - p.pos.z) / T, 0.08, T, 0.3, 0.28, 0.25, 1);
    if (car && !(car.fire > 0) && Math.random() < 0.18) setTimeout(() => { car.fire = rand(30, 50); G.fx.flash(car.pos.x, 1, car.pos.z, 0xff9040, 15, 0.25, 15); this.raise(EV.FIRE, car.pos.x, car.pos.z, { severity: 1 }); }, T * 1000);
  }
  updateRiots(dt) {
    for (const ev of G.agents.incidents) {
      if ((ev.type !== EV.RIOT && ev.type !== EV.DISTURBANCE) || !ev.active) continue;
      if ((ev.noiseT -= dt) <= 0) { ev.noiseT = rand(2.5, 5); if (ev.rioters.some((p) => p.state === 'riot')) { sfx.screams(ev.x, ev.z, 2); sfx.chatter(ev.x, ev.z, 0.5); } }
    }
  }

  // ---------- traffic jam: a car breaks down in its lane, traffic stacks up behind it, horns, then it clears ----------
  jam(x = null, z = null) {
    const A = G.agents, T = G.camTarget, at = x == null ? T : { x, z };
    const cars = A.cars.filter((c) => c.state === 'drive' && !c.emerg && !c.moto && !c.incident && !c.leaving && c.scale[2] < 2 && Math.hypot(c.pos.x - at.x, c.pos.z - at.z) < (x == null ? 45 : 18) && (!G.chaos || G.chaos.safe(c)));
    const c = cars.sort((a, b) => Math.hypot(a.pos.x - at.x, a.pos.z - at.z) - Math.hypot(b.pos.x - at.x, b.pos.z - at.z))[0];
    if (!c) return null;
    const hold = rand(35, 55);
    c.timer = hold; c.hazard = G.time + hold;
    // more cars turn onto that street (borrowed from out of view), so the queue builds
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    for (let k = 1; k <= 5; k++) {
      const o = A.borrowCar(c.pos, 55); if (!o || o.moto) continue;
      this.onRoad(o, c.pos.x - fx * (2.2 * k + 1), c.pos.z - fz * (2.2 * k + 1));
    }
    for (let k = 0; k < 4; k++) setTimeout(() => { const o = pick(A.cars.filter((q) => q.state === 'drive' && q.speed < 0.5 && Math.hypot(q.pos.x - c.pos.x, q.pos.z - c.pos.z) < 16)); if (o) sfx.horn(o.pos.x, o.pos.z, rand(0.25, 0.45)); }, rand(3000, hold * 900));
    return this.raise(EV.TRAFFIC_JAM, c.pos.x, c.pos.z, { life: hold });
  }

  // ---------- weather: clear / rain / storm / snow (snow only in Chicago), cheap particles + light changes ----------
  setWeather(kind, quiet = false) {
    if (kind === 'snow' && G.mapName !== 'suburbs' && G.mapName !== 'greenland') kind = 'rain';            // no snow on the warm coasts
    this.kind = kind;
    this.rainTarget = kind === 'rain' ? 0.6 : kind === 'storm' ? 1 : 0;
    this.snowTarget = kind === 'snow' ? 1 : 0;
    this.storm = kind === 'storm';
    if (this.storm) this.boltT = rand(3, 6);
    return this.raise(EV.WEATHER_EVENT, G.camTarget.x, G.camTarget.z, { life: 5, news: kind, quiet });
  }
  initSnow() {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(SNOW_N * 3);
    this.flakes = new Float32Array(SNOW_N * 4);
    for (let i = 0; i < SNOW_N; i++) { const k = i * 4; this.flakes[k] = rand(-RAIN_BOX, RAIN_BOX); this.flakes[k + 1] = rand(0, RAIN_TOP); this.flakes[k + 2] = rand(-RAIN_BOX, RAIN_BOX); this.flakes[k + 3] = rand(0, 6.28); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.snowPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.9, depthWrite: false }));
    this.snowPts.frustumCulled = false; this.snowPts.visible = false; this.scene.add(this.snowPts);
    // snow cover that builds up: a white layer over the ground (thinner on the roads, where it turns to slush),
    // and roofs that go white
    const E = G.ground.E, c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), px = (v) => ((v + E) / (2 * E)) * 512, C = G.city;
    const img = x.createImageData(512, 512);
    for (let i = 0; i < img.data.length; i += 4) { const n = 225 + Math.random() * 30; img.data[i] = img.data[i + 1] = n; img.data[i + 2] = Math.min(255, n + 8); img.data[i + 3] = 200 + Math.random() * 55; }
    x.putImageData(img, 0, 0);
    x.globalCompositeOperation = 'destination-out';
    const hw = C.roadW / 2;
    x.fillStyle = 'rgba(0,0,0,0.72)';
    for (const v of C.xs) x.fillRect(px(v - hw), 0, px(v + hw) - px(v - hw), 512);
    for (const v of C.zs) x.fillRect(0, px(v - hw), 512, px(v + hw) - px(v - hw));
    x.fillStyle = 'rgba(0,0,0,0.5)';                                         // tyre tracks
    for (const v of C.xs) for (const o of [-hw / 2, hw / 2]) x.fillRect(px(v + o - 0.35), 0, px(v + o + 0.35) - px(v + o - 0.35), 512);
    for (const v of C.zs) for (const o of [-hw / 2, hw / 2]) x.fillRect(0, px(v + o - 0.35), 512, px(v + o + 0.35) - px(v + o - 0.35));
    // closed streets (under the festival grounds) aren't roads any more: snow lies there like anywhere else
    x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(236,238,244,0.95)';
    for (const e of C.edges.values()) {
      if (!e.closed) continue;
      const A = C.nodes[e.a], B = C.nodes[e.b], x0 = Math.min(A.x, B.x) - hw, x1 = Math.max(A.x, B.x) + hw, z0 = Math.min(A.z, B.z) - hw, z1 = Math.max(A.z, B.z) + hw;
      x.fillRect(px(x0), px(z0), px(x1) - px(x0), px(z1) - px(z0));
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.snowCover = new THREE.Mesh(new THREE.PlaneGeometry(2 * E, 2 * E).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
      new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false }));
    this.snowCover.receiveShadow = true; this.snowCover.visible = false; this.scene.add(this.snowCover);
    this.cover = 0;
  }
  // ---------- weather (the simplest useful version: rain, storms, lightning) ----------
  strike(x, y, z) {
    // a jagged bolt from the sky, a flash, thunder, and whatever it hits may catch fire
    const pts = [new THREE.Vector3(x + rand(-8, 8), 70, z + rand(-8, 8))];
    for (let k = 1; k <= 9; k++) { const t = k / 9; pts.push(new THREE.Vector3(pts[0].x + (x - pts[0].x) * t + (k < 9 ? rand(-1.5, 1.5) : 0), 70 + (y - 70) * t, pts[0].z + (z - pts[0].z) * t + (k < 9 ? rand(-1.5, 1.5) : 0))); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 40, 0.12, 4);
    const m = new THREE.Mesh(geo, this.boltMat); this.scene.add(m); this.bolts.push({ m, t: 0.22 });
    this.flashT = 0.25;
    G.fx.flash(x, y + 3, z, 0xcfe0ff, 160, 0.35, 90);
    G.fx.sparks(x, y + 0.2, z, 20, 3, 3.5, 6, 6);
    G.shake = Math.max(G.shake, 0.4);
    const dist = Math.hypot(x - G.camTarget.x, z - G.camTarget.z);
    setTimeout(() => sfx.thunder(x, z, 1), Math.min(2500, dist * 12));
    blast(x, y, z, 6, 2.5, 'lightning');
    return this.startFire(x, z, y);
  }
  updateWeather(dt) {
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.5);
    this.updateSnow(dt);
    const r = this.rain, on = r > 0.02;
    G.wet = Math.max(0, Math.min(1, (G.wet || 0) + (r > 0.2 ? dt / 20 : -dt / 60)));   // roads stay wet a while after
    if (G.groundMat) { G.groundMat.roughness = 0.93 - G.wet * 0.45; G.groundMat.color.setScalar(1 - G.wet * 0.18); }
    this.rainLines.visible = on;
    sfx.rain(r);
    if (on) {
      const T = G.camTarget, pos = this.rainLines.geometry.attributes.position.array, n = Math.floor(RAIN_N * r), D = this.drops;
      const wx = G.wind.x * (this.storm ? 5 : 2), wz = G.wind.z * (this.storm ? 5 : 2), fall = 30 * dt;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        D[k + 1] -= fall; D[k] += wx * dt; D[k + 2] += wz * dt;
        if (D[k + 1] < 0) { D[k + 1] = RAIN_TOP; D[k] = rand(-RAIN_BOX, RAIN_BOX); D[k + 2] = rand(-RAIN_BOX, RAIN_BOX); }
        const x = T.x + D[k], y = D[k + 1], z = T.z + D[k + 2], o = i * 6;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = x - wx * 0.03; pos[o + 4] = y + 0.9; pos[o + 5] = z - wz * 0.03;
      }
      this.rainLines.geometry.setDrawRange(0, n * 2);
      this.rainLines.geometry.attributes.position.needsUpdate = true;
      this.rainLines.material.opacity = 0.25 + r * 0.25;
    }
    // overcast: dimmer sun, greyer fog; lightning briefly floods the screen
    const tod = G.tod, sn = this.snow || 0, grey = Math.max(r, sn * 0.6);
    if (tod && grey > 0.01) {
      tod.sun.intensity *= 1 - 0.6 * grey; tod.hemi.intensity *= 1 - 0.25 * grey;
      if (tod.scene.fog) tod.scene.fog.color.lerp(new THREE.Color(sn > r ? 0xc4c9d0 : 0x7d8690), 0.5 * grey);
    }
    if (this.flashT > 0) { this.flashT -= dt; if (tod) tod.post.final.uniforms.exposure.value *= 1 + Math.max(0, this.flashT) * 5; }
    // storms throw their own lightning now and then
    if (this.storm && (this.boltT -= dt) <= 0) {
      this.boltT = rand(7, 16);
      const T = G.camTarget, x = T.x + rand(-40, 40), z = T.z + rand(-40, 40);
      const hit = G.buildings.raycast(new THREE.Vector3(x, 80, z), new THREE.Vector3(0, -1, 0), 200);
      // (never on the festival grounds: the crowd only evacuates when the player attacks it)
      if (Math.random() < 0.4 && !(G.concert && G.concert.inVenue(x, z, 20))) this.strike(x, hit ? hit.point.y : 0, z);
      else { this.flashT = 0.2; setTimeout(() => sfx.thunder(x, z, 0.6), rand(600, 2200)); }
    }
    for (const b of [...this.bolts]) if ((b.t -= dt) <= 0) { this.scene.remove(b.m); b.m.geometry.dispose(); this.bolts.splice(this.bolts.indexOf(b), 1); }
  }
  updateSnow(dt) {
    this.snow = (this.snow || 0) + (((this.snowTarget || 0) - (this.snow || 0)) * Math.min(1, dt * 0.4));
    const s = this.snow;
    if (s < 0.01 && !(this.cover > 0.001)) { if (this.snowPts) this.snowPts.visible = false; return; }
    if (!this.snowPts) this.initSnow();
    // snow settles over a couple of minutes and melts slowly once it stops
    this.cover = Math.max(0, Math.min(1, this.cover + (s > 0.3 ? dt / 90 * s : -dt / 240)));
    if (G.mapName === 'greenland') this.cover = 0;                         // already white all year; and the sea must stay blue
    this.snowCover.visible = this.cover > 0.001; this.snowCover.material.opacity = this.cover * 0.92;
    G.snowCover = this.cover;
    if (G.snowU) G.snowU.value = this.cover;
    this.snowPts.visible = s > 0.02;
    if (!this.snowPts.visible) return;
    const T = G.camTarget, pos = this.snowPts.geometry.attributes.position.array, F = this.flakes, n = Math.floor(SNOW_N * s);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      F[k + 1] -= 2.4 * dt; F[k + 3] += dt * 1.3;
      F[k] += (Math.sin(F[k + 3]) * 0.6 + G.wind.x) * dt; F[k + 2] += (Math.cos(F[k + 3] * 0.8) * 0.5 + G.wind.z) * dt;
      if (F[k + 1] < 0) { F[k + 1] = RAIN_TOP; F[k] = rand(-RAIN_BOX, RAIN_BOX); F[k + 2] = rand(-RAIN_BOX, RAIN_BOX); }
      pos[i * 3] = T.x + F[k]; pos[i * 3 + 1] = F[k + 1]; pos[i * 3 + 2] = T.z + F[k + 2];
    }
    this.snowPts.geometry.setDrawRange(0, n);
    this.snowPts.geometry.attributes.position.needsUpdate = true;
  }
}

// People with reasons to be where they are. Roles are a light layer over the existing pedestrians (agents.js):
// a role changes how someone looks (uniform colours plus a few shared instanced accessories: hard hats, caps,
// sun hats, hi-vis vests, backpacks, bags, carried boxes, tools, radios, lanyards) and, for working roles, gives
// them a job: a short list of steps (walk to a point, do something for a while, carry, go inside, talk) that is
// re-planned whenever it runs out. Every role runs through the same few step types; no role has its own AI.
// Nobody new is created: staff are existing pedestrians re-assigned at load, so the population stays the same.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';
import { STATUE, terrainH } from './playa.js';

export const ROLE = {
  CIVILIAN: 'CIVILIAN', TOURIST: 'TOURIST', SHOPPER: 'SHOPPER', WORKER: 'WORKER', CONSTRUCTION_WORKER: 'CONSTRUCTION_WORKER',
  DELIVERY_WORKER: 'DELIVERY_WORKER', MAINTENANCE_WORKER: 'MAINTENANCE_WORKER', CLEANER: 'CLEANER', SECURITY: 'SECURITY',
  FESTIVAL_STAFF: 'FESTIVAL_STAFF', HOTEL_WORKER: 'HOTEL_WORKER', RESTAURANT_WORKER: 'RESTAURANT_WORKER', VENDOR: 'VENDOR',
  LIFEGUARD: 'LIFEGUARD', BEACH_WORKER: 'BEACH_WORKER', HARBOR_WORKER: 'HARBOR_WORKER', STADIUM_WORKER: 'STADIUM_WORKER',
  // these already have their own systems; officers standing at posts and crew members are tagged so they read the same
  POLICE: 'POLICE', FIREFIGHTER: 'FIREFIGHTER', PARAMEDIC: 'PARAMEDIC', BASKETBALL_PLAYER: 'BASKETBALL_PLAYER', GANG_MEMBER: 'GANG_MEMBER',
};
const R = ROLE;
const HIVIS = [0xf26a1a, 0xd8f23a];
// how each role looks: shirt/pants colours (arrays = pick one), headwear, vest, bag/pack, hand tool
const LOOK = {
  [R.CONSTRUCTION_WORKER]: { shirt: [0x5a6b7a, 0x3a3f46, 0x7a5230, 0xe8e4dc], pants: [0x33415e, 0x5a5044, 0x2a3448], hat: 'hard', hatC: [0xf2c21a, 0xf2f2ee, 0xe86a1a], vest: HIVIS, stripe: 1, tool: 'hammer' },
  [R.MAINTENANCE_WORKER]: { shirt: [0x2b3a55, 0x3c4a3a], pants: [0x2a3448], hat: 'hard', hatC: [0xf2f2ee], vest: [0xf26a1a], stripe: 1, tool: 'hammer' },
  [R.CLEANER]: { shirt: [0x3c6a3a, 0x2b3a55], pants: [0x2a3448], hat: 'cap', hatC: [0x3c6a3a, 0x1f2a44], vest: [0xd8f23a], stripe: 1, tool: 'broom' },
  [R.SECURITY]: { shirt: [0x16181c], pants: [0x16181c], hat: 'cap', hatC: [0x0e0e0e], vest: [0x24262b], badge: 1, tool: 'radio' },
  [R.FESTIVAL_STAFF]: { shirt: [0xb026ff, 0xf2c21a, 0x2fd0c0], pants: [0x1f1f22, 0x2a3448], hat: 'cap', hatC: [0x111111], lanyard: 1, tool: 'clipboard' },
  [R.HOTEL_WORKER]: { shirt: [0xf2f2ee], pants: [0x1f1f22], lanyard: 1 },
  [R.RESTAURANT_WORKER]: { shirt: [0xf2f2ee, 0x1f1f22], pants: [0x1f1f22], vest: [0x2a2a2a, 0xf2f2ee], apron: 1 },
  [R.DELIVERY_WORKER]: { shirt: [0x5a3b22], pants: [0x5a3b22], hat: 'cap', hatC: [0x5a3b22] },
  [R.VENDOR]: { shirt: [0xf2f2ee, 0xc8361f], pants: [0x2a3448], hat: 'cap', hatC: [0xc8361f, 0xf2f2ee], vest: [0xf2f2ee], apron: 1 },
  [R.LIFEGUARD]: { shirt: [0xd8262a], pants: [0xd8262a], hat: 'sun', hatC: [0xf2f2ee], tool: 'radio' },
  [R.BEACH_WORKER]: { shirt: [0x2a8a8a], pants: [0xe8dcb0], hat: 'sun', hatC: [0xe8dcb0], tool: 'broom' },
  [R.HARBOR_WORKER]: { shirt: [0x2b3a55], pants: [0x2a3448], hat: 'hard', hatC: [0xf2f2ee, 0xf2c21a], vest: [0xf26a1a], stripe: 1, tool: 'radio' },
  [R.STADIUM_WORKER]: { shirt: [0x1f2a44], pants: [0x1f1f22], hat: 'cap', hatC: [0xf26a1a], lanyard: 1, tool: 'radio' },
  [R.TOURIST]: { shirt: [0xf0f0f0, 0x6fb3c9, 0xe0b640, 0xc94f7c, 0xf28c8c, 0x9ad0a0], pants: [0xb8ad96, 0x7b8794, 0xe8e4dc], hat: 'sun', hatC: [0xe8dcb0, 0xf2f2ee, 0x6fb3c9], pack: [0x2a5aa0, 0xc8361f, 0x3c4a3a, 0x1c1c1c], tool: 'camera', keep: 1 },
  [R.SHOPPER]: { bag: [0xf2f2ee, 0xc94f7c, 0xe0b640, 0x8a6a3a, 0x1c1c1c], keep: 1 },
  [R.WORKER]: { shirt: [0xe8e4dc, 0xcfe0f0, 0x8a9096], pants: [0x1f1f22, 0x2a3448, 0x3a3f46], bag: [0x1c1c1c, 0x3a2a1c] },
};
// hotel staff on the tropical map wear the resort's teal polos and khakis
const RESORT = { shirt: [0x2a8a8a, 0x3fb6c8], pants: [0xd8c9a0] };

// ---------- accessory geometry (body space, feet at 0, facing +z; tools in the right arm's space) ----------
function geos() {
  const bx = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const dome = (r, y) => new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y, 0);
  const disc = (r, y) => new THREE.CylinderGeometry(r, r, 0.008, 12).translate(0, y, 0);
  return {
    hard: mergeGeometries([dome(0.058, 0.64), disc(0.072, 0.642)]),
    cap: mergeGeometries([dome(0.054, 0.645), bx(0.07, 0.008, 0.055, 0, 0.648, 0.05)]),
    sun: mergeGeometries([dome(0.052, 0.65), disc(0.1, 0.652)]),
    vest: new THREE.CylinderGeometry(0.071, 0.062, 0.2, 8, 1, true).scale(1, 1, 0.7).translate(0, 0.445, 0),
    stripe: mergeGeometries([0.4, 0.47].map((y) => new THREE.CylinderGeometry(0.073, 0.071, 0.018, 8, 1, true).scale(1, 1, 0.72).translate(0, y, 0))),
    badge: bx(0.022, 0.026, 0.006, 0.03, 0.49, 0.043),
    lanyard: mergeGeometries([bx(0.01, 0.07, 0.005, 0, 0.51, 0.043), bx(0.03, 0.038, 0.006, 0, 0.46, 0.046)]),
    pack: mergeGeometries([bx(0.09, 0.12, 0.045, 0, 0.46, -0.06), bx(0.07, 0.04, 0.02, 0, 0.42, -0.087)]),
    bag: bx(0.022, 0.08, 0.07, 0.105, 0.3, 0.0),
    box: bx(0.15, 0.1, 0.11, 0, 0.44, 0.14),
    hammer: mergeGeometries([bx(0.012, 0.012, 0.12, 0, -0.245, 0.05), bx(0.02, 0.022, 0.05, 0, -0.245, 0.11)]),
    broom: mergeGeometries([new THREE.CylinderGeometry(0.006, 0.006, 0.52, 5).translate(0, -0.45, 0.02), bx(0.1, 0.03, 0.03, 0, -0.71, 0.02)]),
    radio: bx(0.02, 0.05, 0.016, 0, -0.25, 0.012),
    camera: bx(0.05, 0.03, 0.025, 0.03, -0.25, 0.02),
    clipboard: bx(0.06, 0.08, 0.006, 0, -0.25, 0.03),
  };
}
const PARTS = ['hard', 'cap', 'sun', 'vest', 'stripe', 'badge', 'lanyard', 'pack', 'bag', 'box', 'hammer', 'broom', 'radio', 'camera', 'clipboard'];
const TOOLS = new Set(['hammer', 'broom', 'radio', 'camera', 'clipboard']);
const TINTED = new Set(['hard', 'cap', 'sun', 'vest', 'pack', 'bag']);
const SLOTS = 190;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

// step builders
const go = (x, z, run) => ({ do: 'go', x, z, run });
const act = (pose, a, b, face) => ({ do: 'act', pose, t: rand(a, b), face });
const carry = (on) => ({ do: 'carry', on });
const hide = (a, b) => ({ do: 'hide', t: rand(a, b) });
const call = (fn) => ({ do: 'call', fn });
const talk = (a, b) => ({ do: 'talk', t: rand(a, b) });

export class Roles {
  constructor(scene, city, mapName, sites = []) {
    this.city = city; this.map = mapName; this.sites = sites;
    this.A = G.agents; this.B = G.buildings;
    this.staff = []; this.slots = []; this.free = [];
    this.far = 90; this.drawFar = 115;          // distance LOD (shrinks if the frame rate drops)
    this.fpsAvg = 60; this.lowT = 0;
    const g = geos(), mats = {};
    this.mesh = {};
    for (const k of PARTS) {
      const mat = k === 'stripe' ? new THREE.MeshBasicMaterial({ color: 0xd8dde2 }) : k === 'badge' ? new THREE.MeshStandardMaterial({ color: 0xd9b44a, metalness: 0.8, roughness: 0.3 })
        : TINTED.has(k) ? new THREE.MeshLambertMaterial() : new THREE.MeshLambertMaterial({ color: { box: 0xb08a5a, hammer: 0x6b4a2a, broom: 0x8a6a3a, radio: 0x111111, camera: 0x1c1c1c, clipboard: 0xd8d2c4, lanyard: 0x1f55d6 }[k] });
      const m = new THREE.InstancedMesh(g[k], mat, SLOTS);
      for (let i = 0; i < SLOTS; i++) m.setMatrixAt(i, ZERO);
      if (TINTED.has(k)) for (let i = 0; i < SLOTS; i++) m.setColorAt(i, new THREE.Color(1, 1, 1));
      m.frustumCulled = false; m.castShadow = k !== 'stripe' && k !== 'badge' && k !== 'lanyard';
      scene.add(m); this.mesh[k] = m; mats[k] = mat;
    }
    for (let i = SLOTS - 1; i >= 0; i--) this.free.push(i);
    this.props = [];                           // static dressing: vendor carts, lifeguard towers, maintenance cones
    this.deliveryT = rand(6, 14);
    this.staffMap(scene);
    if (this.props.length) {
      const m = new THREE.Mesh(mergeGeometries(this.props), new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.castShadow = m.receiveShadow = true; scene.add(m);
    }
    // officers standing at posts, gang members: tag the roles the other systems already play
    for (const p of this.A.peds) { if (p.officer) p.role = R.POLICE; else if (p.gangSide) p.role = R.GANG_MEMBER; }
    G.roles = this;
  }

  // ---------- looks ----------
  col(m, i, c) { m.setColorAt(i, typeof c === 'number' ? new THREE.Color(c) : c); }
  look(p, role, opts = {}) {
    const A = this.A, L = { ...LOOK[role], ...(opts.look || {}) }, i = p.i;
    p.role = role;
    if (L.shirt) { const s = pick(L.shirt); this.col(A.pTorso, i, s); this.col(A.pArmL, i, s); this.col(A.pArmR, i, s); }
    if (L.pants) { const c = pick(L.pants); this.col(A.pLegL, i, c); this.col(A.pLegR, i, c); }
    for (const m of A.pMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (p.slot == null) { if (!this.free.length) return; p.slot = this.free.pop(); this.slots[p.slot] = p; }
    const k = p.slot;
    p.acc = { hat: L.hat || null, vest: !!L.vest, stripe: !!L.stripe, badge: !!L.badge, lanyard: !!L.lanyard, pack: !!L.pack, bag: !!L.bag, tool: L.tool || null };
    if (L.hat) this.col(this.mesh[L.hat], k, pick(L.hatC));
    if (L.vest) this.col(this.mesh.vest, k, pick(L.vest));
    if (L.pack) this.col(this.mesh.pack, k, pick(L.pack));
    if (L.bag) this.col(this.mesh.bag, k, pick(L.bag));
    for (const m of Object.values(this.mesh)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.clearSlot(k);
  }
  clearSlot(k) { for (const m of Object.values(this.mesh)) m.setMatrixAt(k, ZERO); }
  // back to an ordinary pedestrian (e.g. a delivery driver who's got back in the van)
  release(p) {
    if (p.slot != null) { this.clearSlot(p.slot); this.slots[p.slot] = null; this.free.push(p.slot); }
    const k = this.staff.indexOf(p); if (k >= 0) this.staff.splice(k, 1);
    Object.assign(p, { slot: null, acc: null, role: null, job: null, pose: null, carry: false, hidden: false, jmove: false, dropLook: false });
    this.A.pedColors(p.i);
    for (const m of this.A.pMeshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  // someone who was taken away comes back as a new person: staff come back to work (in uniform)
  respawned(p) {
    if (!p.role) return;
    if (!p.job) { if (LOOK[p.role]?.keep) this.look(p, p.role); else this.release(p); return; }
    this.look(p, p.role, p.job.opts);
    p.hidden = false; p.carry = false; p.pos.y = 0;
    this.A.resumePed(p);
  }

  // ---------- hiring ----------
  // someone walking about, preferably far from the camera, reassigned to a job at (x, z)
  grab(x, z) {
    const ok = this.A.peds.filter((p) => p.state === 'walk' && !p.role && !p.officer && !p.hostile && !p.zone && !p.car && !p.homeCar);
    if (!ok.length) return null;
    // mostly someone from nearby, so the streets don't visibly thin out anywhere
    let best = null, bd = 1e9;
    for (let n = 0; n < 12; n++) { const p = pick(ok), d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  hire(role, home, plan, opts = {}, p = null) {
    p = p || this.grab(home.x, home.z);
    if (!p) return null;
    this.look(p, role, opts);
    p.zone = null; p.group = null;
    p.pos.set(home.x + rand(-0.3, 0.3), 0, home.z + rand(-0.3, 0.3));
    if (this.B.inside(_v.set(p.pos.x, 0.3, p.pos.z))) p.pos.set(home.x, 0, home.z);
    p.job = { home, plan, steps: [], k: 0, acc: 0, crew: opts.crew || null, opts };
    p.state = 'job'; p.speed = rand(0.75, 0.95);
    this.staff.push(p);
    return p;
  }
  // a WORLD-menu spawn gets a proper job where it was placed
  hireAt(p, kind, x, z) {
    const home = this.clear(x, z) || { x, z };
    if (kind === 'security') return this.hire(R.SECURITY, home, this.planSecurity(home, this.ring(home, 4, 5)), {}, p);
    return this.hire(R.MAINTENANCE_WORKER, home, this.planMaint(home), {}, p);
  }

  // ---------- places ----------
  isFree(x, z, r = 0.2) { return !this.B.inside(_v.set(x, 0.3, z)) && !this.city.obstacleNear(x, z, r) && !(this.city.pedBlocked && this.city.pedBlocked(x, z)); }
  clear(x, z, r = 3) {
    if (this.isFree(x, z)) return { x, z };
    for (let d = 0.5; d <= r; d += 0.5) for (let a = 0; a < 6.28; a += 0.6) { const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (this.isFree(px, pz)) return { x: px, z: pz }; }
    return null;
  }
  ring(c, r, n) { const out = []; for (let k = 0; k < n * 3 && out.length < n; k++) { const a = rand(0, 6.28), p = this.clear(c.x + Math.cos(a) * r * rand(0.5, 1), c.z + Math.sin(a) * r * rand(0.5, 1), 1); if (p) out.push(p); } return out.length ? out : [c]; }
  node(x, z) { let best = null, bd = 1e9; for (const n of this.city.pedNodes) { if (!n.edges.length) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } return best; }
  // a point just outside the nearest building's wall (for "goes inside" steps)
  door(x, z, maxD = 10) {
    let best = null, bd = 1e9;
    for (const b of this.B.list) {
      if (b.gable || Math.abs(b.x - x) > maxD + b.w || Math.abs(b.z - z) > maxD + b.d) continue;
      if (!b.cells.some((c) => c.f === 0 && c.alive)) continue;
      const px = clamp(x, b.x - b.w / 2, b.x + b.w / 2), pz = clamp(z, b.z - b.d / 2, b.z + b.d / 2), d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; best = { b, px, pz }; }
    }
    if (!best || bd > maxD) return null;
    const { b } = best; let { px, pz } = best;
    const ex = [px - (b.x - b.w / 2), b.x + b.w / 2 - px, pz - (b.z - b.d / 2), b.z + b.d / 2 - pz], k = ex.indexOf(Math.min(...ex));
    if (k === 0) px = b.x - b.w / 2 - 0.25; else if (k === 1) px = b.x + b.w / 2 + 0.25; else if (k === 2) pz = b.z - b.d / 2 - 0.25; else pz = b.z + b.d / 2 + 0.25;
    return this.isFree(px, pz, 0.1) ? { x: px, z: pz, face: { x: b.x, z: b.z } } : null;
  }
  // a short walk along the sidewalk graph from the nearest corner, drifting back toward home if it wanders off
  stroll(p, home, hops, reach = 30) {
    const C = this.city, out = [];
    let n = this.node(p.pos.x, p.pos.z), prev = -1;
    for (let h = 0; h < hops && n; h++) {
      let opts = n.edges.filter((e) => e.to !== prev && !C.pedBlocked(C.pedNodes[e.to].x, C.pedNodes[e.to].z));
      if (!opts.length) break;
      if (Math.hypot(n.x - home.x, n.z - home.z) > reach) opts.sort((a, b) => Math.hypot(C.pedNodes[a.to].x - home.x, C.pedNodes[a.to].z - home.z) - Math.hypot(C.pedNodes[b.to].x - home.x, C.pedNodes[b.to].z - home.z));
      const e = Math.random() < 0.7 ? opts[0] : pick(opts), m = C.pedNodes[e.to];
      // stop part-way along the block now and then
      const t = h === hops - 1 ? rand(0.3, 1) : 1;
      out.push(go(n.x + (m.x - n.x) * t + rand(-0.25, 0.25), n.z + (m.z - n.z) * t + rand(-0.25, 0.25)));
      prev = n.id; n = m;
    }
    if (!out.length) out.push(go(home.x, home.z));
    return out;
  }

  // ---------- job plans (each returns a fresh list of steps) ----------
  planConstruction(s, variant) {
    const B = this.B;
    const edge = () => {
      for (let k = 0; k < 8; k++) {
        const side = Math.floor(rand(0, 4)), t = rand(-0.45, 0.45);
        const x = s.x + (side < 2 ? t * s.w : (side === 2 ? -1 : 1) * (s.w / 2 + 0.55)), z = s.z + (side >= 2 ? t * s.d : (side === 0 ? -1 : 1) * (s.d / 2 + 0.55));
        if (this.isFree(x, z, 0.1)) return { x, z };
      }
      return s.front;
    };
    const center = { x: s.x, z: s.z };
    return () => {
      if (variant === 'signal') {                        // the banksman at the crane pile, radioing the operator
        const a = this.clear(s.pile.x + rand(-1, 1), s.pile.z + rand(-1, 1), 1.5) || s.pile;
        return [go(a.x, a.z), act('radio', 3, 6, center), act('look', 2, 5), act('point', 1.5, 3, center), act('look', 3, 7), ...(Math.random() < 0.4 ? [talk(3, 6)] : [])];
      }
      if (variant === 'truck') {                          // at the mixer truck: check the chute, wave it on
        const t = this.clear(s.truck.x - s.front.nx * 1.2, s.truck.z - s.front.nz * 1.2, 1.5) || s.front;
        return [go(t.x, t.z), act('inspect', 3, 6, s.truck), act('point', 1, 2, center), act('look', 2, 4), go(s.front.x, s.front.z), act('look', 2, 5)];
      }
      const w = edge(), w2 = edge();
      const steps = [go(s.pile.x + rand(-0.4, 0.4), s.pile.z + rand(-0.4, 0.4)), act('lift', 0.8, 1.3, s.pile), carry(true), go(w.x, w.z), act('drop', 0.5, 0.8, center), carry(false),
        act('hammer', 4, 9, center), act('look', 1.5, 3)];
      if (Math.random() < 0.35) steps.push(talk(3, 7));
      if (Math.random() < 0.5) steps.push(go(w2.x, w2.z), act('inspect', 3, 6, center), act('hammer', 3, 6, center));
      steps.push(act('wait', 2, 5));
      return steps;
    };
  }
  planMaint(spot) {
    return () => {
      const a = this.clear(spot.x + rand(-0.8, 0.8), spot.z + rand(-0.8, 0.8), 1) || spot;
      return [go(a.x, a.z), act('inspect', 4, 8, spot), act('hammer', 3, 6, spot), act('look', 2, 4), ...(Math.random() < 0.4 ? [talk(3, 6)] : []), act('wait', 2, 5)];
    };
  }
  planCleaner(home) {
    return (p) => [...this.stroll(p, home, Math.round(rand(1, 2)), 22), act('sweep', 3, 7), ...(Math.random() < 0.5 ? [act('sweep', 2, 5)] : []), act('look', 1, 2)];
  }
  planSecurity(post, perim) {
    return () => {
      const a = pick(perim), b = pick(perim);
      const steps = [go(post.x, post.z), act('look', 5, 12), ...(Math.random() < 0.4 ? [act('radio', 2, 4)] : []), go(a.x, a.z), act('look', 3, 6)];
      if (Math.random() < 0.5) steps.push(go(b.x, b.z), act('look', 2, 5));
      return steps;
    };
  }
  planStaff(home, area) {            // festival / stadium / harbor staff: walk → work → inspect → back
    return () => {
      const a = pick(area);
      const steps = [go(a.x, a.z), act(pick(['work', 'sweep', 'carryWork']), 3, 6), act('inspect', 2, 4), act('look', 2, 4)];
      if (Math.random() < 0.3) steps.push(act('radio', 2, 3));
      if (Math.random() < 0.3) steps.push(talk(3, 6));
      steps.push(go(home.x, home.z), act('look', 3, 7));
      return steps;
    };
  }
  planDoorman(stand, door, face) {   // hotel / restaurant staff: stand out front, tidy, pop inside, come back out
    return () => {
      const steps = [go(stand.x, stand.z), act('hands', 4, 10, face), act('look', 2, 4)];
      if (Math.random() < 0.5) steps.push(act('wipe', 3, 6));
      if (Math.random() < 0.3) steps.push(talk(3, 6));
      if (door && Math.random() < 0.6) steps.push(go(door.x, door.z), hide(6, 20));
      return steps;
    };
  }
  planVendor(stand, cart) {
    return () => [go(stand.x, stand.z), act('serve', 3, 6, cart), act('hands', 2, 5, cart), act('look', 2, 5), ...(Math.random() < 0.4 ? [act('serve', 2, 4, cart)] : []), act('wave', 1, 2)];
  }
  planLifeguard(tower) {
    const up = { x: tower.x, z: tower.z - 0.3 }, base = { x: tower.x, z: tower.z + 0.8 };   // on the deck in front of the hut
    return (p) => {
      const water = { x: tower.x + rand(-4, 4), z: tower.water + 1.2 };
      return [go(base.x, base.z), call(() => { p.pos.set(up.x, tower.y, up.z); }), act('look', 10, 20, { x: tower.x, z: tower.water - 6 }), act('radio', 2, 3), act('look', 10, 20, { x: tower.x + rand(-8, 8), z: tower.water - 6 }),
        call(() => { p.pos.set(base.x, 0, base.z); }), go(water.x, water.z), act('look', 4, 8, { x: water.x, z: water.z - 6 }), act('point', 1, 2, { x: water.x, z: water.z - 6 })];
    };
  }
  planBeach(home, area) {
    return () => { const a = pick(area); return [go(a.x, a.z), act('sweep', 4, 8), act('look', 1, 2), go(a.x + rand(-2, 2), a.z + rand(-1, 1)), act('sweep', 3, 6), act('wait', 1, 3)]; };
  }
  planTourist(home) {
    return (p) => {
      const steps = this.stroll(p, home, Math.round(rand(1, 3)), 26);
      steps.push(act('photo', 2, 4, { x: p.pos.x + rand(-10, 10), z: p.pos.z + rand(-10, 10) }), act('look', 2, 5));
      if (Math.random() < 0.3) steps.push(act('photo', 1.5, 3));
      return steps;
    };
  }
  // a driver who parked: goes into a building for a while, comes back, drives off
  planErrand(p, c, role) {
    const d = this.door(p.pos.x, p.pos.z, 9), back = this.A.carPoint(c, 0.62, 0.1);
    const rear = this.A.carPoint(c, 0, -0.95);
    const steps = [];
    if (role === R.DELIVERY_WORKER) steps.push(go(rear.x, rear.z), act('lift', 0.9, 1.4, c.pos), carry(true));
    if (d) steps.push(go(d.x, d.z), act(role === R.DELIVERY_WORKER ? 'drop' : 'wait', 0.5, 1, d.face), hide(role === R.DELIVERY_WORKER ? 3 : 10, role === R.DELIVERY_WORKER ? 8 : 35), carry(false));
    else steps.push(act('look', 3, 6), carry(false));
    steps.push(go(back.x, back.z), call(() => {
      if (c.state !== 'parked') { this.release(p); this.A.resumePed(p); return; }
      p.job = null; p.state = 'toCar'; p.car = c; p.target = back; p.dropLook = !!p.role; p.pose = null; p.jmove = false;
      const k = this.staff.indexOf(p); if (k >= 0) this.staff.splice(k, 1);
    }));
    let once = true;
    return () => { if (!once) return [call(() => { this.release(p); this.A.resumePed(p); })]; once = false; return steps; };
  }

  // ---------- staffing each map ----------
  staffMap(scene) {
    const C = this.city, M = this.map, P = this.props;
    // construction crews: 2–4 per site, one signalling at the crane, one at the truck
    this.sites.forEach((s, k) => {
      if (!s.front) return;
      const n = Math.round(rand(2, 3)) + (s.crane ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const variant = i === 0 && s.crane ? 'signal' : i === 1 ? 'truck' : 'crew';
        this.hire(R.CONSTRUCTION_WORKER, s.front, this.planConstruction(s, variant), { crew: 'site' + k });
      }
    });
    // street maintenance: an open utility hatch with cones round it and a crew of two
    const maint = Math.round(M === 'tropical' ? 1 : 2);
    for (let k = 0; k < maint; k++) {
      const n = pick(C.pedNodes.filter((n) => n.edges.length && !C.pedBlocked(n.x, n.z) && Math.hypot(n.x - (C.hotspot?.x ?? 0), n.z - (C.hotspot?.z ?? 0)) < 60));
      if (!n) continue;
      const m = C.pedNodes[n.edges[0].to], spot = this.clear(n.x + (m.x - n.x) * 0.5, n.z + (m.z - n.z) * 0.5, 1);
      if (!spot) continue;
      this.maintProps(spot);
      for (let i = 0; i < 2; i++) this.hire(R.MAINTENANCE_WORKER, spot, this.planMaint(spot), { crew: 'maint' + k });
    }
    // street cleaners anywhere on the grid
    for (let k = 0; k < (M === 'tropical' ? 2 : 4); k++) { const n = pick(C.pedNodes.filter((n) => n.edges.length && !C.pedBlocked(n.x, n.z))); if (n) this.hire(R.CLEANER, n, this.planCleaner(n)); }
    // shoppers with bags, office workers with briefcases (looks only: they keep walking as before)
    const walkers = this.A.peds.filter((p) => p.state === 'walk' && !p.role && !p.officer);
    const nShop = { downtown: 30, suburbs: 14, tropical: 16 }[M] ?? 12, nWork = { downtown: 26, suburbs: 6, tropical: 4 }[M] ?? 6;
    for (const p of walkers.sort(() => Math.random() - 0.5).slice(0, nShop)) this.look(p, R.SHOPPER);
    for (const p of walkers.filter((p) => !p.role).slice(0, nWork)) this.look(p, R.WORKER);
    if (M === 'downtown') this.staffDowntown(P);
    if (M === 'suburbs') this.staffChicago(P);
    if (M === 'tropical') this.staffPlaya(P);
  }
  staffDowntown(P) {
    const C = this.city;
    // hotels + restaurants: staff at the doors of the towers' podiums and a few street-front shops
    for (const t of (C.towers || []).slice(0, 4)) {
      const d = this.door(t.x, t.z + t.d / 2 + 2, 4); if (!d) continue;
      const stand = this.clear(d.x + rand(-1.5, 1.5), d.z + 0.9, 1) || d;
      this.hire(R.HOTEL_WORKER, stand, this.planDoorman(stand, d, { x: stand.x, z: stand.z + 5 }));
      if (Math.random() < 0.6) this.hire(R.SECURITY, stand, this.planSecurity(stand, this.ring(stand, 3, 4)));
    }
    this.restaurants(5);
    // harbor workers along the waterfront, near the piers
    if (C.shoreX != null) for (const pz of [-38, 4, 34]) {
      const home = this.clear(C.shoreX + 2.5, pz + rand(-3, 3), 2); if (!home) continue;
      const area = [-4, -1, 2, 5].map((dz) => this.clear(C.shoreX + rand(1.5, 3.5), pz + dz, 1)).filter(Boolean);
      for (let i = 0; i < 2; i++) this.hire(R.HARBOR_WORKER, home, this.planStaff(home, area), { crew: 'harbor' + pz });
    }
    // stadium staff round Petco's outer sidewalks
    if (C.petco) {
      const S = C.petco, ring = [];
      for (let t = 0.15; t < 1; t += 0.14) ring.push(this.clear(S.x0 + (S.x1 - S.x0) * t, S.z1 + 1, 1), this.clear(S.x0 - 1, S.z0 + (S.z1 - S.z0) * t, 1));
      const area = ring.filter(Boolean);
      for (let i = 0; i < 5 && area.length; i++) { const h = pick(area); this.hire(R.STADIUM_WORKER, h, this.planStaff(h, area), { crew: 'petco' }); }
      this.vendor(P, pick(area), 'hot dogs');
    }
    // tourists near the harbor and the Gaslamp
    this.tourists(18, C.shoreX != null ? { x: C.shoreX + 12, z: 0 } : { x: 0, z: 0 }, 45);
  }
  staffChicago(P) {
    const C = this.city, S = C.concert;
    if (S) {
      const cx = (S.x0 + S.x1) / 2;
      const plaza = []; for (let k = 0; k < 14; k++) { const q = this.clear(rand(S.x0 + 3, S.x1 - 3), rand(S.z1 - 9, S.z1 - 2), 1); if (q) plaza.push(q); }
      const street = []; for (let k = 0; k < 10; k++) { const q = this.clear(rand(S.x0 + 2, S.x1 - 2), S.z1 + rand(2.2, 3.6), 1); if (q) street.push(q); }
      // gate security, staff in event shirts working the plaza, cleanup crew, vendors on the closed street
      for (const gx of [cx - 5, cx + 5, cx - 12, cx + 12]) { const post = this.clear(gx, S.z1 - 0.8, 1.5); if (post) this.hire(R.SECURITY, post, this.planSecurity(post, [...plaza.slice(0, 3), this.clear(gx, S.z1 + 2.5, 1.5) || post]), { crew: 'gate' }); }
      if (plaza.length) for (let i = 0; i < 7; i++) { const h = pick(plaza); this.hire(R.FESTIVAL_STAFF, h, this.planStaff(h, plaza), { crew: 'fest' }); }
      if (plaza.length) for (let i = 0; i < 3; i++) this.hire(R.CLEANER, pick(plaza), this.planBeach(pick(plaza), plaza), { look: { shirt: [0xb026ff], vest: [0xd8f23a] } });
      for (let i = 0; i < 3 && street.length; i++) this.vendor(P, street.splice(Math.floor(rand(0, street.length)), 1)[0], 'food');
      if (street.length) for (let i = 0; i < 2; i++) this.hire(R.SECURITY, pick(street), this.planSecurity(pick(street), street), { crew: 'street' });
    }
    // streetball: a handful of people come and watch from outside the fence, drift off, come back
    const K = C.court;
    if (K) {
      const court = { x: (K.x0 + K.x1) / 2, z: (K.z0 + K.z1) / 2 };
      for (let i = 0; i < 6; i++) {
        const side = i % 3, spot = side === 0 ? { x: rand(K.x0 + 2, K.x1 - 2), z: K.z1 + 1.4 } : { x: side === 1 ? K.x0 - 1.2 : K.x1 + 1.2, z: rand(K.z0 + 2, K.z1 - 2) };
        const q = this.clear(spot.x, spot.z, 2); if (q) this.hire(R.CIVILIAN, q, this.planSpectator(q, court), { crew: 'court' });
      }
    }
    this.restaurants(3);
  }
  staffPlaya(P) {
    const C = this.city, shore = C.shore ?? -36;
    // resort staff at each beachfront hotel (the tall stucco buildings on the front row)
    const hotels = C.playa ? C.playa.hotels : this.B.list.filter((b) => b.style === 'stucco' && b.floors >= 5 && b.z < 0);
    for (const b of hotels) {
      const d = this.door(b.x, b.z - b.d / 2 - 1.5, 3); if (!d) continue;
      const stand = this.clear(d.x + rand(-2, 2), d.z - 0.9, 1) || d;
      for (let i = 0; i < 2; i++) this.hire(R.HOTEL_WORKER, stand, this.planDoorman(stand, d, { x: stand.x, z: stand.z - 5 }), { look: RESORT, crew: 'hotel' + b.x });
      if (Math.random() < 0.5) this.hire(R.SECURITY, stand, this.planSecurity(stand, this.ring(stand, 3, 3)), { look: { shirt: [0xf2f2ee], pants: [0x1f1f22] } });
    }
    this.restaurants(4);
    // lifeguard towers along the beach, with a lifeguard on each
    for (const x of [-42, 0, 38]) {
      const tw = { x, z: shore + 7, y: 0.95, water: shore };
      this.towerProps(P, tw);
      this.hire(R.LIFEGUARD, { x, z: tw.z + 0.8 }, this.planLifeguard(tw));
    }
    // beach crew raking the sand; vendors along the promenade
    const sand = []; for (let k = 0; k < 16; k++) sand.push({ x: rand(-55, 55), z: rand(shore + 4, -21) });
    for (let i = 0; i < 3; i++) { const h = pick(sand); this.hire(R.BEACH_WORKER, h, this.planBeach(h, sand.filter((q) => Math.abs(q.x - h.x) < 20))); }
    for (const x of [-30, 8, 30]) { const q = this.clear(x, -17.2, 1.5); if (q) this.vendor(P, q, 'coco'); }
    // lots of tourists: the beach wanderers get the look, and some walkers on the front become sightseers
    const beach = this.A.peds.filter((p) => p.zone && !p.group && p.pos.z < -15 && !p.role);
    for (const p of beach.slice(0, 40)) { this.look(p, R.TOURIST); p.photo = Math.random() < 0.5; }
    this.tourists(14, { x: 0, z: -8 }, 40);
    if (C.playa) this.staffHills(P, C.playa);
  }
  // ---------- La Playa: street food, the OXXOs, and life on the hill ----------
  staffHills(P, PL) {
    // a cook behind every taco stand and a stallholder at every fruit stall, with customers coming and going
    for (const f of PL.food) {
      const stand = { x: f.x, z: f.z + (f.kind === 'taco' ? 0.35 : 0.55) }, front = { x: f.x, z: f.z - 2 };
      this.hire(R.VENDOR, stand, this.planVendor(stand, front), { look: { shirt: [0xf2f2ee, 0xd7141c, 0x2a8a8a], vest: [0xf2f2ee] } });
      if (f.kind === 'taco') {
        const spot = { x: f.x + rand(-0.5, 0.5), z: f.z - 1.05 };
        this.hire(R.CIVILIAN, spot, (p) => Math.random() < 0.35 ? [...this.stroll(p, spot, Math.round(rand(2, 4)), 25), act('look', 2, 5)]
          : [go(spot.x + rand(-0.4, 0.4), spot.z), act('hands', 6, 14, f), act('talk', 2, 4, f), act('wait', 2, 5)], { crew: 'taco' + f.x });
      }
    }
    // OXXO staff in red, out front now and then
    for (const o of PL.oxxo) {
      const door = { x: o.x, z: o.z - 0.25 }, stand = { x: o.x + rand(-1.2, 1.2), z: o.z - 0.8 };
      this.hire(R.RESTAURANT_WORKER, stand, this.planDoorman(stand, door, { x: stand.x, z: stand.z - 5 }), { look: { shirt: [0xd7141c], pants: [0x1f1f22], vest: [0xf2b705] } });
    }
    // the hill: people living up the staircases go down for shopping and come back up with it
    const shops = PL.food.filter((f) => f.z > 60).concat(PL.oxxo.map((o) => ({ x: o.x, z: o.z })));
    for (const st of PL.stairs) {
      const n = Math.min(st.doors.length, 6);
      for (let k = 0; k < n; k++) {
        const door = st.doors[Math.floor(k * st.doors.length / n)];
        const p = this.hire(R.CIVILIAN, door, this.planResident(st, door, shops), { crew: 'stair' + st.x0 });
        if (p) { p.speed = rand(0.55, 0.75); if (Math.random() < 0.25) p.s = 0.72; p.hidden = Math.random() < 0.5; }
      }
      // a vendor on a landing part way up
      if (st.pts.length > 26 && Math.random() < 0.7) {
        const a = st.pts[24], b = st.pts[25], yaw = Math.atan2(b.x - a.x, b.z - a.z), sx = a.x + Math.cos(yaw) * 0.95, sz = a.z - Math.sin(yaw) * 0.95, y = terrainH(sx, sz);
        const box = (w, h, d, x, yy, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, yy, z), c);
        P.push(box(0.6, 0.45, 0.4, sx, y + 0.22, sz, 0x8a5a2b), box(0.03, 1.1, 0.03, sx, y + 0.55, sz, 0x9aa0a4), tint(new THREE.ConeGeometry(0.5, 0.2, 8).translate(sx, y + 1.1, sz), pick([0xd7141c, 0x1f63b8, 0xf2b705])));
        const stand = { x: a.x + Math.cos(yaw) * 0.45, z: a.z - Math.sin(yaw) * 0.45 };
        this.hire(R.VENDOR, stand, this.planVendor(stand, { x: sx, z: sz }), { look: { shirt: [0xf2f2ee, 0x2a8a8a], vest: [0xf2f2ee] } });
      }
    }
    // visitors at the Cristo lookout, taking in the view over the city and the bay
    const ring = []; for (let a = 0; a < 6.28; a += 0.5) ring.push({ x: STATUE.x + Math.cos(a) * rand(4.2, 6.2), z: STATUE.z + Math.sin(a) * rand(4.2, 6.2) });
    for (let k = 0; k < 9; k++) {
      const h = pick(ring);
      this.hire(R.TOURIST, h, () => { const a = pick(ring); return [go(a.x, a.z), act('photo', 2, 4, { x: a.x + (a.x - STATUE.x) * 3, z: a.z - 30 }), act('look', 4, 9, { x: a.x, z: a.z - 30 }), act('photo', 2, 3, STATUE), act('wait', 2, 5)]; });
    }
  }
  // down the stairs to the shops at the bottom, and back up with the shopping
  planResident(st, door, shops) {
    return (p) => {
      const pts = st.pts;
      let di = 0, bd = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q.x - door.x, q.z - door.z); if (d < bd) { bd = d; di = i; } });
      const steps = [go(door.x, door.z), hide(6, 30)];
      for (let i = di; i >= 0; i -= 2) { steps.push(go(pts[i].x + rand(-0.12, 0.12), pts[i].z)); if (i % 12 < 2 && Math.random() < 0.18) steps.push(act(pick(['look', 'wait']), 1.5, 4)); }
      const shop = shops.slice().sort((a, b) => Math.hypot(a.x - pts[0].x, a.z - pts[0].z) - Math.hypot(b.x - pts[0].x, b.z - pts[0].z))[0];
      if (shop) steps.push(go(shop.x + rand(-0.6, 0.6), shop.z - 1.3), act('wait', 3, 8, shop));
      steps.push(carry(true), go(pts[0].x, pts[0].z));
      for (let i = 0; i <= di; i += 2) { steps.push(go(pts[i].x + rand(-0.12, 0.12), pts[i].z)); if (i % 12 < 2 && Math.random() < 0.15) steps.push(act('wait', 1.5, 3)); }     // catching a breath on the landings
      steps.push(go(door.x, door.z), carry(false), hide(15, 60));
      return steps;
    };
  }
  restaurants(n) {
    const C = this.city, hs = C.hotspot || { x: 0, z: 0 };
    const shops = this.B.list.filter((b) => !b.gable && b.style !== 'site' && !b.site && b.floors <= 6 && b.cells.some((c) => c.ground) && Math.hypot(b.x - hs.x, b.z - hs.z) < 70);
    for (const b of shops.sort(() => Math.random() - 0.5)) {
      if (n <= 0) break;
      const n0 = this.node(b.x, b.z); if (!n0) continue;
      const d = this.door(n0.x, n0.z, 6); if (!d) continue;
      const out = this.clear(d.x + (n0.x - d.x) * 0.35, d.z + (n0.z - d.z) * 0.35, 1); if (!out) continue;
      this.hire(R.RESTAURANT_WORKER, out, this.planDoorman(out, d, { x: n0.x, z: n0.z }));
      n--;
    }
  }
  tourists(n, c, r) {
    for (let k = 0; k < n; k++) {
      const node = pick(this.city.pedNodes.filter((m) => m.edges.length && !this.city.pedBlocked(m.x, m.z) && Math.hypot(m.x - c.x, m.z - c.z) < r));
      if (!node) return;
      this.hire(R.TOURIST, node, this.planTourist(node));
    }
  }
  vendor(P, q, kind) {
    if (!q) return;
    const box = (w, h, d, x, y, z, col) => tint(new THREE.BoxGeometry(w, h, d).translate(q.x + x, y, q.z + z), col);
    const top = kind === 'coco' ? 0x2a8a8a : kind === 'hot dogs' ? 0xf2c21a : 0xc8361f;
    P.push(box(0.9, 0.42, 0.45, 0, 0.36, 0, 0xe8e4dc), box(0.92, 0.06, 0.47, 0, 0.6, 0, top), box(0.05, 0.9, 0.05, 0.4, 0.95, 0, 0x6b6f76));
    P.push(tint(new THREE.ConeGeometry(0.7, 0.28, 10).translate(q.x + 0.4, 1.46, q.z), top));
    for (const sx of [-0.35, 0.35]) P.push(tint(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(q.x + sx, 0.12, q.z + 0.24), 0x1c1c1c));
    this.city.obstacles && this.city.obstacles.push({ x: q.x, z: q.z, r: 0.5 });
    const stand = this.clear(q.x, q.z - 0.6, 1) || { x: q.x, z: q.z - 0.6 };
    this.hire(R.VENDOR, stand, this.planVendor(stand, { x: q.x, z: q.z }));
  }
  maintProps(s) {
    const P = this.props, box = (w, h, d, x, y, z, col) => tint(new THREE.BoxGeometry(w, h, d).translate(s.x + x, y, s.z + z), col);
    P.push(tint(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 12).translate(s.x, 0.012, s.z), 0x111111), box(0.4, 0.02, 0.4, 0.45, 0.03, 0.1, 0x4a4d52));
    for (let a = 0; a < 6.28; a += 1.26) { const x = Math.cos(a) * 0.75, z = Math.sin(a) * 0.75; P.push(tint(new THREE.ConeGeometry(0.06, 0.18, 6).translate(s.x + x, 0.09, s.z + z), 0xf26a1a)); }
    P.push(box(0.5, 0.05, 0.03, -0.9, 0.3, 0, 0xf2f2ee), box(0.03, 0.3, 0.03, -1.12, 0.15, 0, 0x6b6f76), box(0.03, 0.3, 0.03, -0.68, 0.15, 0, 0x6b6f76));
  }
  towerProps(P, t) {
    const box = (w, h, d, x, y, z, col) => tint(new THREE.BoxGeometry(w, h, d).translate(t.x + x, y, t.z + z), col);
    for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) P.push(box(0.05, 0.9, 0.05, x, 0.45, z, 0xe8e4dc));
    P.push(box(0.95, 0.06, 0.95, 0, 0.92, 0, 0xe8e4dc), box(0.7, 0.45, 0.5, 0, 1.2, 0.2, 0xd8262a), box(0.8, 0.05, 0.62, 0, 1.45, 0.2, 0xf2f2ee));
    for (let k = 0; k < 4; k++) P.push(box(0.35, 0.03, 0.05, 0, 0.12 + k * 0.2, 0.62 + k * 0.08, 0xc9b88a));
    P.push(box(0.14, 0.04, 0.01, 0, 1.25, -0.06, 0xf2f2ee), box(0.04, 0.14, 0.01, 0, 1.25, -0.06, 0xf2f2ee));
  }

  // someone heads in through a door (a stadium gate, the cruise terminal), is inside for a while, then carries on
  visit(p, door, stay, respawn = false) {
    p.zone = null; p.group = null;
    p.job = { home: { x: door.x, z: door.z }, plan: null, steps: [], k: 0, acc: 0 };
    let once = true;
    p.job.plan = () => {
      if (!once) return [call(() => { if (respawn) { this.release(p); this.A.respawnPed(p); } else { this.release(p); this.A.resumePed(p); } })];
      once = false;
      return [go(door.x, door.z), hide(stay, stay + 1)];
    };
    p.state = 'job'; if (!this.staff.includes(p)) this.staff.push(p);
  }
  // people watching a streetball game: lean on the fence a while, cheer, wander off, come back later
  planSpectator(spot, court) {
    return (p) => {
      if (Math.random() < 0.3) return [...this.stroll(p, spot, Math.round(rand(2, 4)), 30), act('look', 3, 8)];     // off for a walk
      const s = this.clear(spot.x + rand(-2, 2), spot.z + rand(-0.4, 0.4), 1) || spot;
      return [go(s.x, s.z), act('look', 12, 30, court), act(Math.random() < 0.5 ? 'wave' : 'talk', 1.5, 3, court), act('look', 10, 25, court), ...(Math.random() < 0.4 ? [talk(3, 6)] : [])];
    };
  }

  // ---------- vehicle life ----------
  // agents.parkHere: a driver just got out of a parked car
  parked(p, c) {
    if (!p || p.role === R.POLICE) return;
    if (c.delivery) {
      c.reserved = true;
      this.look(p, R.DELIVERY_WORKER); p.zone = null; p.group = null;
      p.job = { home: { x: p.pos.x, z: p.pos.z }, plan: this.planErrand(p, c, R.DELIVERY_WORKER), steps: [], k: 0, acc: 0 };
      p.state = 'job'; this.staff.push(p);
      c.delivery = false;
    } else if (Math.random() < 0.55 && !p.role) {
      // an errand: into a shop or an office for a while, then back to the car and away
      c.reserved = true;
      p.job = { home: { x: p.pos.x, z: p.pos.z }, plan: this.planErrand(p, c, R.CIVILIAN), steps: [], k: 0, acc: 0 };
      p.state = 'job'; this.staff.push(p);
    }
  }
  // now and then a van near the view pulls over and makes a delivery
  deliveries(dt) {
    if ((this.deliveryT -= dt) > 0) return;
    this.deliveryT = rand(16, 32);
    const A = this.A, C = this.city, T = G.camTarget;
    const vans = A.cars.filter((c) => c.state === 'drive' && !c.emerg && !c.moto && !c.incident && !c.leaving && c.scale[1] > 1.3 && c.scale[2] < 2 && c.speed > 1.5 && c.flee <= 0 && c.queue.length === 1 && Math.hypot(c.pos.x - T.x, c.pos.z - T.z) < 50);
    const c = pick(vans);
    if (!c) return;
    const wp = c.queue[0];
    if (Math.hypot(wp.x - c.pos.x, wp.z - c.pos.z) < 8) return;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading), off = (C.roadW / 4 + 0.32) * (C.side || 1);
    const px = c.pos.x + fx * 3 - fz * off, pz = c.pos.z + fz * 3 + fx * off;
    if (C.pedBlocked && C.pedBlocked(px, pz)) return;
    c.parking = true; c.queue = [{ x: px, z: pz }]; c.delivery = true;
    // a courier's van: brown or white
    c.color = new THREE.Color(pick([0x5a3b22, 0xf2f2ee, 0xf2f2ee]));
    A.carBody.setColorAt(c.i, c.color); A.doors.setColorAt(c.i * 2, c.color); A.doors.setColorAt(c.i * 2 + 1, c.color);
    A.carBody.instanceColor.needsUpdate = true; A.doors.instanceColor.needsUpdate = true;
  }

  // ---------- the shared job runner (agents.updatePed 'job' → here) ----------
  tick(p, dt) {
    const j = p.job;
    if (!j) { p.state = 'walk'; this.A.resumePed(p); return; }
    const T = G.camTarget, dist = Math.hypot(p.pos.x - T.x, p.pos.z - T.z);
    // distance LOD: far away, update four times a second (they're a few pixels tall)
    if (dist > this.far) { j.acc += dt; if (j.acc < 0.25) return; dt = j.acc; j.acc = 0; }
    if (j.chat) {                                   // someone came over to talk
      p.jmove = false; p.pose = 'talk';
      const o = j.chat.with; this.face(p, o.pos, dt);
      if ((j.chat.t -= dt) <= 0 || o.state !== 'job') j.chat = null;
      return;
    }
    let s = j.steps[j.k];
    if (!s) { j.steps = j.plan(p) || []; j.k = 0; s = j.steps[0]; if (!s) return; }
    switch (s.do) {
      case 'go': {
        p.pose = null; p.hidden = false;
        const done = this.move(p, s.x, s.z, p.speed * (s.run ? 2 : 1), dt);
        p.jmove = !done;
        if (done) j.k++;
        return;
      }
      case 'act':
        p.jmove = false; p.pose = s.pose;
        if (s.face) this.face(p, s.face, dt);
        else if (s.pose === 'look') p.heading += Math.sin(G.time * 0.7 + p.phase) * dt * 0.8;
        if ((s.t -= dt) <= 0) { j.k++; p.pose = null; }
        return;
      case 'hide':
        p.jmove = false; p.pose = null; p.hidden = true;
        if ((s.t -= dt) <= 0) { p.hidden = false; j.k++; }
        return;
      case 'carry': p.carry = s.on; j.k++; return;
      case 'call': j.k++; s.fn(p); return;
      case 'talk': {
        // find a crewmate who's standing still and go chat
        if (!s.buddy) {
          s.buddy = this.staff.find((o) => o !== p && o.job && j.crew && o.job.crew === j.crew && o.state === 'job' && !o.jmove && !o.hidden && !o.job.chat && Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) < 8);
          if (!s.buddy) { j.k++; return; }
        }
        const o = s.buddy, dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, l = Math.hypot(dx, dz) || 1;
        if (l > 0.75 && !s.there) { const ok = this.move(p, o.pos.x + dx / l * 0.6, o.pos.z + dz / l * 0.6, p.speed, dt); p.jmove = !ok; p.pose = null; if (ok) s.there = true; if ((s.t -= dt * 0.2) <= 0) j.k++; return; }
        if (!s.there) s.there = true;
        if (!o.job.chat) o.job.chat = { with: p, t: s.t };
        p.jmove = false; p.pose = 'talk'; this.face(p, o.pos, dt);
        if ((s.t -= dt) <= 0 || o.state !== 'job') { j.k++; p.pose = null; }
        return;
      }
      default: j.k++;
    }
  }
  face(p, t, dt) {
    const want = Math.atan2(t.x - p.pos.x, t.z - p.pos.z);
    p.heading += Math.atan2(Math.sin(want - p.heading), Math.cos(want - p.heading)) * Math.min(1, dt * 4);
  }
  // straight toward a point, stepping round walls; gives up (counts as arrived) if properly stuck
  move(p, x, z, sp, dt) {
    const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.12) { p.stuck = 0; return true; }
    const want = Math.atan2(dx, dz), step = Math.min(d, sp * dt);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 2]) {
      const h = want + off, nx = p.pos.x + Math.sin(h) * step, nz = p.pos.z + Math.cos(h) * step;
      if (this.B.inside(_v.set(nx, 0.3, nz))) continue;
      p.heading = h; p.pos.x = nx; p.pos.z = nz;
      if (off) p.stuck = (p.stuck || 0) + dt; else p.stuck = Math.max(0, (p.stuck || 0) - dt);
      return p.stuck > 6 ? ((p.stuck = 0), true) : false;
    }
    p.stuck = (p.stuck || 0) + dt;
    if (p.stuck > 3) { p.stuck = 0; return true; }
    return false;
  }

  // ---------- poses (agents.update asks, for anyone with a role) ----------
  // o = { aL, aR, oL, oR, lL, lR, dy } arm/leg swing angles (negative = forward), arm spread, body drop
  pose(p, o, moving) {
    if (p.state !== 'job' && p.state !== 'idle' && p.state !== 'wander') return;
    const t = G.time + p.phase;
    if (p.carry) { o.aL = o.aR = -1.15; o.oL = o.oR = -0.12; return; }
    const pose = p.state === 'job' ? p.pose : (p.state === 'idle' && p.photo ? 'photo' : null);
    if (!pose || moving) return;
    switch (pose) {
      case 'hammer': o.aR = -1.5 + Math.max(0, Math.sin(t * 7)) * 1.0; o.aL = -0.5; o.oR = 0.05; break;
      case 'sweep': { const s = Math.sin(t * 3) * 0.35; o.aL = -0.65 + s; o.aR = -0.75 + s; o.oL = -0.15; o.oR = -0.15; o.lL = 0.15; o.lR = -0.15; break; }
      case 'wipe': o.aR = -1.1 + Math.sin(t * 4) * 0.2; o.oR = -0.2 + Math.cos(t * 4) * 0.3; o.aL = -0.2; break;
      case 'inspect': o.dy = -0.07; o.lL = 1.1; o.lR = -0.5; o.aL = -0.9; o.aR = -1.1 + Math.sin(t * 2) * 0.15; break;
      case 'lift': o.dy = -0.05; o.aL = o.aR = -1.3; o.oL = o.oR = -0.1; o.lL = 0.6; o.lR = 0.6; break;
      case 'drop': o.dy = -0.04; o.aL = o.aR = -1.0; o.oL = o.oR = -0.1; o.lL = 0.4; o.lR = 0.4; break;
      case 'work': case 'carryWork': o.aL = -0.9 + Math.sin(t * 2.5) * 0.25; o.aR = -1.0 - Math.sin(t * 2.5) * 0.25; o.oL = o.oR = -0.1; break;
      case 'serve': o.aL = -1.2; o.aR = -1.0 + Math.sin(t * 3) * 0.3; o.oL = -0.1; o.oR = -0.1; break;
      case 'radio': o.aR = -2.55; o.oR = -0.45; o.aL = 0; break;
      case 'point': o.aR = -1.6; o.oR = 0.1; break;
      case 'photo': o.aL = o.aR = -1.95; o.oL = o.oR = -0.4; break;
      case 'talk': o.aL = Math.min(0, -Math.max(0, Math.sin(t * 1.6)) * 0.8); o.aR = -Math.max(0, Math.sin(t * 1.3 + 1)) * 0.6; break;
      case 'hands': o.aL = o.aR = -0.35; o.oL = o.oR = -0.35; break;
      case 'wave': o.aR = -2.6 + Math.sin(t * 9) * 0.3; o.oR = 0.3; break;
      case 'look': case 'wait': default: break;
    }
  }
  // accessories for one person: body matrix m, right-arm matrix arm (hidden = both null)
  draw(p, m, arm) {
    const k = p.slot, a = p.acc;
    if (k == null || !a) return;
    const M = this.mesh;
    if (!m || Math.hypot(p.pos.x - G.camTarget.x, p.pos.z - G.camTarget.z) > this.drawFar) { if (!p.accHidden) { this.clearSlot(k); p.accHidden = true; } return; }
    p.accHidden = false;
    const head = !(p.lost && p.lost.head);
    if (a.hat) M[a.hat].setMatrixAt(k, head ? m : ZERO);
    if (a.vest) M.vest.setMatrixAt(k, m);
    if (a.stripe) M.stripe.setMatrixAt(k, m);
    if (a.badge) M.badge.setMatrixAt(k, m);
    if (a.lanyard) M.lanyard.setMatrixAt(k, m);
    if (a.pack) M.pack.setMatrixAt(k, m);
    if (a.bag) M.bag.setMatrixAt(k, p.carry ? ZERO : m);
    M.box.setMatrixAt(k, p.carry ? m : ZERO);
    if (a.tool) M[a.tool].setMatrixAt(k, p.carry || (p.lost && p.lost.armR) ? ZERO : arm);
  }
  flush() { for (const m of Object.values(this.mesh)) m.instanceMatrix.needsUpdate = true; }

  update(dt) {
    // performance guard: if frames get slow, pull the detail distances in; ease them back out when it recovers
    const now = performance.now(), fps = this.lastT ? 1000 / Math.max(1, now - this.lastT) : 60; this.lastT = now;
    this.fpsAvg += (fps - this.fpsAvg) * 0.05;
    if (this.fpsAvg < 32) { this.far = Math.max(45, this.far - dt * 10); this.drawFar = Math.max(60, this.drawFar - dt * 12); }
    else if (this.fpsAvg > 50) { this.far = Math.min(90, this.far + dt * 4); this.drawFar = Math.min(115, this.drawFar + dt * 4); }
    this.deliveries(dt);
    for (const p of this.staff) if (p.state !== 'job' && p.state !== 'air' && p.pos.y > 0.5 && p.role === R.LIFEGUARD) p.pos.y = 0;
  }
}

function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo;
  const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}

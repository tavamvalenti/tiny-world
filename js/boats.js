// Every boat on every map can be destroyed. Each map keeps its own boats its own way; this gathers them all as
// targets ({ x, y, z, r, dead(), kill() }) so explosions (core.blast) and gunfire (the vehicles' guns) can wreck
// any of them the same way: a blast, flames and planks, then the hull rolls over and goes down. London's and
// Cairo's river boats already know how to sink (and come back upriver later); the rest stay wrecked.
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const wrecks = [];                          // boats going down: { draw(t) -> false when gone, x, z, t }

// sink an instanced boat: tip over and slide under, then vanish
const instSink = (mesh, i, x, z, s, rot) => (t) => {
  if (t > 7) { mesh.setMatrixAt(i, ZERO); mesh.instanceMatrix.needsUpdate = true; return false; }
  _q.setFromEuler(_e.set(Math.min(1.1, t * 0.5), rot, Math.min(0.5, t * 0.2)));
  mesh.setMatrixAt(i, _m.compose(_p.set(x, -t * t * 0.05, z), _q, _s.set(s, s, s))); mesh.instanceMatrix.needsUpdate = true;
  return true;
};
// sink an object boat
const objSink = (o, extra) => { const y0 = o.position.y, rz = o.rotation.z; return (t) => {
  if (t > 7) { o.visible = false; if (extra) extra(); return false; }
  o.position.y = y0 - t * t * 0.06; o.rotation.z = rz + Math.min(1.1, t * 0.5); o.rotation.x = Math.min(0.4, t * 0.15);
  return true;
}; };

let cache = { t: -1, list: [] };
export function boatTargets() {
  if (cache.t === G.time && cache.list.length) return cache.list.filter((t) => !t.dead());       // once per frame (the guns ask for every shot)
  const out = [];
  // the beach boats on La Playa's shore water (city props)
  for (const b of (G.city && G.city.boats) || []) if (b.alive && b.mesh) out.push({ obj: b, x: b.x, y: 0.25, z: b.z, r: 1 * (b.s || 1), dead: () => !b.alive, kill: () => { b.alive = false; return instSink(b.mesh, b.i, b.x, b.z, b.s || 1, b.rot); } });
  // San Diego's harbour traffic
  const H = G.harbor; if (H && H.boats) H.boats.forEach((b, i) => { if (!b.dead) out.push({ obj: b, x: b.x, y: 0.35, z: b.z, r: 1.2 * b.s, dead: () => b.dead, kill: () => { b.dead = true; return instSink(H.boatMesh, i, b.x, b.z, b.s, -b.a); } }); });
  // La Playa's fishing boats
  const P = G.playa; if (P && P.boats) for (const b of P.boats) if (!b.dead) out.push({ obj: b, x: b.x, y: 0.15, z: b.z, r: 1.1, dead: () => b.dead, kill: () => { b.dead = true; return objSink(b.g, () => { b.line.visible = false; b.fish.visible = false; }); } });
  // Sisimiut's trawlers and boats
  const GL = G.greenland; if (GL && GL.boatList) for (const b of GL.boatList) if (!b.dead) out.push({ obj: b, x: b.m.position.x, y: b.m.position.y + 0.4, z: b.m.position.z, r: b.kind === 'trawler' || b.kind === 'supply' ? 2.6 : 1.4, dead: () => b.dead, kill: () => { b.dead = true; return objSink(b.m); } });
  // the Thames and the Nile: their boats sink and are replaced upriver by their own maps
  for (const S of [G.london, G.cairo]) if (S && S.boatList) for (const b of S.boatList) if (!b.sunk) out.push({ obj: b, x: b.m.position.x, y: b.m.position.y + 0.4, z: b.m.position.z, r: b.len ? b.len / 2 : b.kind === 'cruise' || b.kind === 'clipper' ? 3.5 : 1.8, dead: () => b.sunk, kill: () => { b.sunk = true; b.m.rotation.z = 0.7; return null; } });
  // boats tied up along the Thames and the Nile: they go down and stay down
  for (const S of [G.london, G.cairo]) for (const m of (S && S.moored) || []) {
    const u = m.userData; if (u.dead) continue;
    if (u.r == null) { const sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()); u.r = Math.max(0.8, Math.max(sz.x, sz.z) * 0.45); }
    out.push({ obj: u, x: m.position.x, y: m.position.y + 0.4, z: m.position.z, r: u.r, dead: () => !!u.dead, kill: () => { u.dead = true; return objSink(m); } });
  }
  // the Venetian's gondolas
  const VG = G.vegas; if (VG && VG.gondolas) for (const gd of VG.gondolas) if (!gd.dead) out.push({ obj: gd, x: gd.m.position.x, y: gd.m.position.y + 0.2, z: gd.m.position.z, r: 1.2, dead: () => gd.dead, kill: () => { gd.dead = true; return objSink(gd.m); } });
  cache = { t: G.time, list: out };
  return out;
}

// blow a boat up: a blast and flames on the water, planks and bits of hull thrown about, then it goes down
export function wreckBoat(t) {
  if (t.dead()) return;
  const draw = t.kill(), fx = G.fx, x = t.x, y = t.y, z = t.z, big = t.r > 2;
  fx.explosion(x, y + 0.2, z, big ? 1 : 0.6);
  fx.fireball(x, y + 0.4, z, big ? 3 : 1.8, 0.7);
  for (let i = 0; i < (big ? 18 : 10); i++) fx.debris.spawn(x + rand(-0.5, 0.5), y + 0.3, z + rand(-0.5, 0.5), new THREE.Vector3(rand(-5, 5), rand(3, 8), rand(-5, 5)), rand(0.15, 0.5), rand(0.04, 0.08), rand(0.08, 0.2), new THREE.Color(pick([0x6a4a2a, 0x8a6a4a, 0xf2f2ee, 0xc8202a, 0x2a2a2e])));
  for (let i = 0; i < 12; i++) fx.bits.emit(x + rand(-1, 1), 0.1, z + rand(-1, 1), rand(-2, 2), rand(2, 5), rand(-2, 2), rand(0.2, 0.4), 1.2, 0.9, 0.95, 1, 1);   // spray
  sfx.boom(x, z, big ? 1 : 0.6, 'bomb');
  G.shake = Math.max(G.shake || 0, big ? 0.5 : 0.3);
  G.news && G.news.destruction && G.news.destruction(x, z, big ? 20 : 8);
  if (draw) wrecks.push({ draw, x, z, t: 0 });
  G.progress && G.progress.boatSunk();
}
// gunfire wears a boat down until it goes up (like a car)
export function damageBoat(t, amount) {
  if (t.dead()) return;
  t.obj.cook = (t.obj.cook || 0) + amount;
  if (t.obj.cook >= 1) wreckBoat(t);
}
// explosions: anything strong enough sinks the boats close to it
export function boatsOnBlast(x, y, z, r, power, kind) {
  if (power < 2 || kind === 'wind' || kind === 'laser' || kind === 'collapse' || kind === 'energy') return;
  for (const t of boatTargets()) if (Math.hypot(t.x - x, t.z - z) < r * 0.45 + t.r && Math.abs(t.y - y) < r * 0.5 + 2) wreckBoat(t);
}
// the wrecks burn as they go down
export function updateWrecks(dt) {
  for (let i = wrecks.length - 1; i >= 0; i--) {
    const w = wrecks[i]; w.t += dt;
    if (w.t < 4 && Math.random() < dt * 10) G.fx.fire.emit(w.x + rand(-0.4, 0.4), 0.3, w.z + rand(-0.4, 0.4), 0, 1, 0, rand(0.4, 0.8), 0.4, 1.6, 0.9, 0.5, 1);
    if (w.t < 6 && Math.random() < dt * 3) G.fx.smokePuff(w.x, 0.6, w.z, 0.6, 0.15, 4);
    if (!w.draw(w.t)) wrecks.splice(i, 1);
  }
}

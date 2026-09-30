// A city that is still being built: a few buildings are active construction sites (top floors missing, exposed
// concrete, a steel frame going up, scaffolding and netting, hoarding with a gate, cones, materials, a dumpster,
// a site trailer and trucks), a couple of tower cranes that slowly lift loads onto them, and window-washing
// gondolas working their way down the tall downtown towers. All static geometry is merged; the moving parts
// are a handful of meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick, clamp } from './core.js';

const LIMIT = { downtown: 6, suburbs: 4, tropical: 2 };
const CRANES = { downtown: 2, suburbs: 2, tropical: 1 };

function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo;
  const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c, ry = 0) => tint(new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z), c);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- choosing sites (runs before the buildings are finalised, so floors can be taken off) ----------
export function pickSites(B, city, mapName) {
  const keepOut = [];
  const add = (x0, z0, x1, z1) => keepOut.push({ x0, z0, x1, z1 });
  if (city.concert) { const S = city.concert; add(S.x0 - 6, S.z0 - 6, S.x1 + 6, S.z1 + 6); }
  if (city.court) { const S = city.court; add(S.x0 - 3, S.z0 - 3, S.x1 + 3, S.z1 + 3); }
  if (city.policeHQ) { const b = city.policeHQ.block; add(b.x0 - 3, b.z0 - 3, b.x1 + 3, b.z1 + 3); }
  if (city.petco) { const S = city.petco; add(S.x0 - 4, S.z0 - 4, S.x1 + 4, S.z1 + 4); }
  const blocked = (x, z) => keepOut.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) || (city.pedBlocked && city.pedBlocked(x, z));
  const cands = B.list.filter((b) => !b.gable && !b.landmark && (!b.noSigns || b.style === 'flat') && ['brick', 'concrete', 'office', 'stucco', 'flat'].includes(b.style)
    && b.floors >= 3 && b.floors <= 16 && b.w >= 3.5 && b.d >= 3.5 && Math.abs(b.x) < city.half - 4 && Math.abs(b.z) < city.half - 4 && !blocked(b.x, b.z));
  const n = Math.min(LIMIT[mapName] ?? 3, Math.max(mapName === 'tropical' ? 1 : 3, Math.round(cands.length * 0.07)));
  // a site needs an open side (street or yard) for its scaffolding, gate and trucks
  const overlaps = (x0, z0, x1, z1, self) => B.list.some((o) => o !== self && x1 > o.x - o.w / 2 && x0 < o.x + o.w / 2 && z1 > o.z - o.d / 2 && z0 < o.z + o.d / 2);
  const openSides = (b) => {
    const hw = b.w / 2, hd = b.d / 2;
    return [[b.x - hw, b.z + hd + 0.2, b.x + hw, b.z + hd + 2.2], [b.x - hw, b.z - hd - 2.2, b.x + hw, b.z - hd - 0.2], [b.x + hw + 0.2, b.z - hd, b.x + hw + 2.2, b.z + hd], [b.x - hw - 2.2, b.z - hd, b.x - hw - 0.2, b.z + hd]]
      .filter((r) => !overlaps(...r, b)).length;
  };
  const sites = [];
  for (const b of cands.sort(() => Math.random() - 0.5)) {
    if (sites.length >= n) break;
    if (openSides(b) < 2) continue;
    if (sites.some((s) => Math.hypot(s.b.x - b.x, s.b.z - b.z) < 24)) continue;
    // take the upper floors off: what's left is the part that's been built so far
    const keep = clamp(Math.round(b.floors * rand(0.45, 0.7)), 2, b.floors - 1);
    b.cells = b.cells.filter((c) => c.f < keep);
    b.grid.length = keep; b.floors = keep;
    for (const c of b.cells) if (c.f >= keep - 1 || Math.random() < 0.15 * (c.f / keep)) c.style = 'site';   // newest floors: bare concrete
    b.noSigns = true; b.site = true;
    const top = Math.max(...b.cells.map((c) => c.y + c.hy));
    const fh = Math.max(0.9, ...b.cells.filter((c) => c.f === keep - 1).map((c) => c.hy * 2));
    sites.push({ b, x: b.x, z: b.z, w: b.w, d: b.d, top, fh, levels: Math.round(rand(2, 3)), crane: false });
  }
  sites.slice(0, CRANES[mapName] ?? 1).forEach((s) => { s.crane = true; });
  return sites;
}

// ---------- the sites, cranes and gondolas ----------
export class Construction {
  constructor(scene, sites, city, mapName) {
    this.sites = sites; this.city = city; this.cranes = []; this.gondolas = [];
    const B = G.buildings, P = [], nets = [], hoard = [];
    const free = (x, z) => !B.inside(new THREE.Vector3(x, 0.3, z));
    const roadDist = (x, z) => Math.min(...city.xs.map((v) => Math.abs(x - v)), ...city.zs.map((v) => Math.abs(z - v)));
    const onRoad = (x, z) => roadDist(x, z) < city.roadW / 2 + 0.3;
    for (const s of sites) {
      const { x, z, w, d, top, fh, levels } = s, hw = w / 2, hd = d / 2;
      // steel frame going up above the finished floors: columns, perimeter beams, a partial deck
      const colsX = Math.max(2, Math.round(w / 2.2)), colsZ = Math.max(2, Math.round(d / 2.2));
      for (let i = 0; i <= colsX; i++) for (let k = 0; k <= colsZ; k++) {
        if (i > 0 && i < colsX && k > 0 && k < colsZ) continue;
        const cx = x - hw + (w * i) / colsX, cz = z - hd + (d * k) / colsZ, lv = i % 2 && Math.random() < 0.5 ? levels - 1 : levels;
        P.push(box(0.12, fh * lv, 0.12, cx, top + (fh * lv) / 2, cz, 0x7a4a2a));
      }
      for (let l = 1; l <= levels; l++) {
        const y = top + fh * l;
        P.push(box(w, 0.1, 0.1, x, y, z - hd, 0x6b6f76), box(w, 0.1, 0.1, x, y, z + hd, 0x6b6f76), box(0.1, 0.1, d, x - hw, y, z, 0x6b6f76), box(0.1, 0.1, d, x + hw, y, z, 0x6b6f76));
        if (l === 1) P.push(box(w * rand(0.4, 0.7), 0.08, d, x - hw * 0.2, y - 0.04, z, 0x9d9a94));
      }
      // scaffolding + netting on the side facing the street
      const sides = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([nx, nz]) => ({ nx, nz, d: roadDist(x + nx * (hw + 2), z + nz * (hd + 2)) + (free(x + nx * (hw + 1), z + nz * (hd + 1)) ? 0 : 100) })).sort((a, b) => a.d - b.d);
      const f0 = sides[0], len = f0.nz ? w : d, off = (f0.nz ? hd : hw) + 0.45;
      const sx = x + f0.nx * off, sz = z + f0.nz * off, tx = f0.nz ? 1 : 0, tz = f0.nz ? 0 : 1;
      for (let t = -len / 2; t <= len / 2 + 0.01; t += 1.2) for (const o of [-0.2, 0.2]) P.push(box(0.04, top + fh, 0.04, sx + tx * t + f0.nx * o, (top + fh) / 2, sz + tz * t + f0.nz * o, 0x9aa0a4));
      for (let y = 1; y < top + fh; y += 1.05) {
        P.push(box(tx ? len : 0.46, 0.04, tz ? len : 0.46, sx, y, sz, 0x8a6a3a));
        P.push(box(tx ? len : 0.03, 0.03, tz ? len : 0.03, sx + f0.nx * 0.2, y + 0.45, sz + f0.nz * 0.2, 0x9aa0a4));
      }
      const net = new THREE.PlaneGeometry(len, (top + fh) * 0.55).rotateY(f0.nz ? (f0.nz > 0 ? 0 : Math.PI) : (f0.nx > 0 ? Math.PI / 2 : -Math.PI / 2)).translate(sx + f0.nx * 0.25, (top + fh) * 0.72, sz + f0.nz * 0.25);
      nets.push(net);
      s.front = { x: x + f0.nx * (off + 1.4), z: z + f0.nz * (off + 1.4), nx: f0.nx, nz: f0.nz, tx, tz };
      // hoarding round the site, skipping bits that would run into a neighbour or the road; a gate on the front
      const m = 1.3;
      for (const [ax, az, bx, bz] of [[x - hw - m, z - hd - m, x + hw + m, z - hd - m], [x - hw - m, z + hd + m, x + hw + m, z + hd + m], [x - hw - m, z - hd - m, x - hw - m, z + hd + m], [x + hw + m, z - hd - m, x + hw + m, z + hd + m]]) {
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.6));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n, mx = ax + (bx - ax) * (t0 + t1) / 2, mz = az + (bz - az) * (t0 + t1) / 2;
          if (!free(mx, mz) || onRoad(mx, mz)) continue;
          if (Math.abs((mx - s.front.x) * tx + (mz - s.front.z) * tz) < 1.2 && Math.hypot(mx - s.front.x, mz - s.front.z) < 2.5) continue;   // gate
          const g = new THREE.PlaneGeometry(L / n, 0.95), uv = g.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (L / n) / 3.2);
          hoard.push(g.rotateY(-Math.atan2(bz - az, bx - ax)).translate(mx, 0.48, mz));
        }
      }
      // yard: materials, dumpster, trailer, toilet, cones, a mixer truck and a pickup where there's room
      const spot = (fx, fz) => { const px = x + fx, pz = z + fz; return free(px, pz) && !onRoad(px, pz) ? { x: px, z: pz } : null; };
      const corner = [[hw + 0.7, hd + 0.7], [-hw - 0.7, hd + 0.7], [hw + 0.7, -hd - 0.7], [-hw - 0.7, -hd - 0.7]].map(([a, b]) => spot(a, b)).filter(Boolean);
      const pile = corner[0] || { x: s.front.x, z: s.front.z };
      s.pile = pile; s.corners = corner;
      for (let i = 0; i < 3; i++) P.push(box(0.5, 0.18, 0.5, pile.x + (i % 2) * 0.55, 0.09 + Math.floor(i / 2) * 0.18, pile.z, 0x8a6a3a), box(0.46, 0.16, 0.46, pile.x + (i % 2) * 0.55, 0.26 + Math.floor(i / 2) * 0.18, pile.z, 0xb8b2a6));
      for (let i = 0; i < 5; i++) P.push(tint(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 5).rotateZ(Math.PI / 2).translate(pile.x + 0.2, 0.05 + i * 0.05, pile.z + 0.6 + (i % 3) * 0.05), 0x7a4a2a));
      if (corner[1]) P.push(box(0.9, 0.5, 0.55, corner[1].x, 0.25, corner[1].z, 0xd96a1a), box(0.95, 0.04, 0.6, corner[1].x, 0.52, corner[1].z, 0x6b6f76));
      if (corner[2]) P.push(box(1.6, 0.8, 0.8, corner[2].x, 0.45, corner[2].z, 0xeeeeea), box(1.62, 0.06, 0.82, corner[2].x, 0.88, corner[2].z, 0x9aa0a4), box(0.3, 0.7, 0.3, corner[2].x + 1.1, 0.35, corner[2].z, 0x2a6fb5));
      if (corner[3]) P.push(tint(new THREE.ConeGeometry(0.6, 0.5, 10).translate(corner[3].x, 0.25, corner[3].z), 0xc9b88a));
      const fr = s.front;
      // mixer truck pulled in at the curb in front of the gate (the parking edge of the nearest street), coned off
      const near = (arr, v) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
      const curb = city.roadW / 2 - 0.45;
      let tkx = fr.x, tkz = fr.z;
      if (fr.nz) { const rz = near(city.zs, fr.z); if (Math.abs(rz - fr.z) < 6) tkz = rz - Math.sign(rz - z) * curb; }
      else { const rx = near(city.xs, fr.x); if (Math.abs(rx - fr.x) < 6) tkx = rx - Math.sign(rx - x) * curb; }
      const ry = Math.atan2(tx, tz);
      for (const k of [-1.9, -1.5, 1.5, 1.9]) { const cx = tkx + tx * k, cz = tkz + tz * k; P.push(tint(new THREE.ConeGeometry(0.07, 0.2, 6).translate(cx, 0.1, cz), 0xf26a1a), box(0.13, 0.02, 0.13, cx, 0.01, cz, 0x1c1c1c)); }
      P.push(box(0.7, 0.5, 0.6, tkx + tx * 0.8, 0.45, tkz + tz * 0.8, 0xe8e8e0, ry), box(0.7, 0.1, 1.9, tkx, 0.2, tkz, 0x2b2e33, ry));
      P.push(tint(new THREE.CylinderGeometry(0.28, 0.34, 1.1, 10).rotateX(Math.PI / 2 - 0.3).rotateY(ry).translate(tkx - tx * 0.3, 0.72, tkz - tz * 0.3), 0xd96a1a));
      for (const t of [-0.7, 0.6]) for (const q of [-0.32, 0.32]) P.push(tint(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 8).rotateZ(Math.PI / 2).rotateY(ry).translate(tkx + tx * t + tz * q, 0.13, tkz + tz * t - tx * q), 0x111111));
      s.truck = { x: tkx, z: tkz };
    }
    // cranes: on the chosen sites, or on another site if a chosen one has nowhere to stand one
    const want = sites.filter((s) => s.crane).length, first = sites.filter((s) => s.crane), rest = sites.filter((s) => !s.crane);
    for (const s of sites) s.crane = false;                 // set again by addCrane where one actually stands
    for (const s of [...first, ...rest]) { if (this.cranes.length >= want) break; this.addCrane(scene, s, free); }
    if (P.length) { const m = new THREE.Mesh(mergeGeometries(P), new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = m.receiveShadow = true; scene.add(m); }
    if (nets.length) scene.add(new THREE.Mesh(mergeGeometries(nets), new THREE.MeshLambertMaterial({ color: 0x3f7a4a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
    if (hoard.length) {
      const tex = canvasTex(256, 64, (x, w, h) => {
        x.fillStyle = '#1f4e8a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2f2ee'; x.fillRect(0, h * 0.72, w, h * 0.28);
        x.fillStyle = '#f7c21a'; for (let i = -1; i < 12; i++) { x.beginPath(); x.moveTo(i * 24, h); x.lineTo(i * 24 + 12, h * 0.72); x.lineTo(i * 24 + 24, h * 0.72); x.lineTo(i * 24 + 12, h); x.fill(); }
        x.fillStyle = '#fff'; x.font = '800 16px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText(pick(['HARD HAT AREA', 'CONSTRUCTION SITE', 'KEEP OUT · SITE ENTRANCE']), w / 2, h * 0.45);
      });
      tex.wrapS = THREE.RepeatWrapping;
      const hm = new THREE.Mesh(mergeGeometries(hoard), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      hm.castShadow = true; scene.add(hm);
    }
    if (mapName === 'downtown') this.addGondolas(scene, city);
  }

  // ---------- tower crane: slew, trolley and hoist between the material pile and the top of the frame ----------
  addCrane(scene, s, free) {
    const { x, z, w, d, top, fh, levels } = s;
    let base = null;
    const spots = [];
    for (const m of [1.1, 2]) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) spots.push([x + a * (w / 2 + m), z + b * (d / 2 + m), a, b]);
    for (const [bx, bz, a, b] of spots) if (free(bx, bz) && free(bx + a * 0.4, bz + b * 0.4) && !this.cranes.some((c) => Math.hypot(c.base.x - bx, c.base.z - bz) < 16)) { base = { x: bx, z: bz }; break; }
    if (!base) return false;
    const H = top + fh * levels + 6, L = 14, yellow = new THREE.MeshLambertMaterial({ color: 0xe8b41a }), dark = new THREE.MeshLambertMaterial({ color: 0x2b2e33 });
    const lattice = canvasTex(32, 32, (x) => { x.clearRect(0, 0, 32, 32); x.strokeStyle = '#e8b41a'; x.lineWidth = 3; x.strokeRect(1, 1, 30, 30); x.beginPath(); x.moveTo(0, 0); x.lineTo(32, 32); x.moveTo(32, 0); x.lineTo(0, 32); x.stroke(); });
    lattice.wrapS = lattice.wrapT = THREE.RepeatWrapping; lattice.repeat.set(1, H / 0.5);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.5, H, 0.5).translate(0, H / 2, 0), new THREE.MeshLambertMaterial({ map: lattice, alphaTest: 0.5, side: THREE.DoubleSide }));
    mast.position.set(base.x, 0, base.z); scene.add(mast);
    const slew = new THREE.Group(); slew.position.set(base.x, H, base.z); scene.add(slew);
    const jibTex = lattice.clone(); jibTex.repeat.set(L / 0.5, 1); jibTex.needsUpdate = true;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(L, 0.45, 0.45).translate(L / 2, 0.2, 0), new THREE.MeshLambertMaterial({ map: jibTex, alphaTest: 0.5, side: THREE.DoubleSide }));
    slew.add(jib);
    slew.add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 0.4).translate(-2.2, 0.2, 0), yellow), new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8).translate(-4, 0, 0), new THREE.MeshLambertMaterial({ color: 0x8f949a })),
      new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.6).translate(0.4, -0.3, 0.5), yellow), new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2).translate(0, 1.2, 0), yellow));
    const trolley = new THREE.Group(); slew.add(trolley);
    trolley.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), dark));
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03).translate(0, -0.5, 0), dark); trolley.add(cable);
    const hook = new THREE.Group(); trolley.add(hook);
    hook.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.2), new THREE.MeshLambertMaterial({ color: 0xc8361f })));
    const load = new THREE.Mesh(mergeGeometries([tint(new THREE.BoxGeometry(0.9, 0.12, 0.9).translate(0, -0.5, 0), 0x8a6a3a), tint(new THREE.BoxGeometry(0.8, 0.35, 0.8).translate(0, -0.27, 0), 0xb8b2a6)]), new THREE.MeshLambertMaterial({ vertexColors: true }));
    hook.add(load); load.visible = false;
    for (const m of [mast, jib, load]) m.castShadow = true;
    const toLocal = (px, pz) => ({ yaw: Math.atan2(-(pz - base.z), px - base.x), r: clamp(Math.hypot(px - base.x, pz - base.z), 1.5, L - 0.6) });
    const pickP = toLocal(s.pile.x, s.pile.z), dropP = toLocal(x + rand(-w / 4, w / 4), z + rand(-d / 4, d / 4));
    s.crane = true;
    this.cranes.push({ s, base, H, slew, trolley, hook, cable, load, pickP, dropP, pickY: 0.6, dropY: top + fh * levels + 0.6, yaw: rand(0, 6.28), r: 6, y: H - 2, step: 0, t: rand(1, 4) });
  }
  // ---------- window washers: a gondola works down one face of a tall tower, pausing floor by floor ----------
  addGondolas(scene, city) {
    const towers = (city.towers || []).slice(0, 3);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const t of towers) {
      // the face toward the camera (+z); its depth steps back with the setbacks, so track it per floor
      const col = t.cells.filter((c) => Math.abs(c.x - t.x) < c.hx * 1.5);
      const faceZ = [], floorY = [];
      for (let f = 0; f < t.floors; f++) { const cs = col.filter((c) => c.f === f); if (!cs.length) break; faceZ[f] = Math.max(...cs.map((c) => c.z + c.hz)); floorY[f] = cs[0].y; }
      if (faceZ.length < 8) continue;
      const P = [box(1.7, 0.1, 0.4, 0, 0, 0, 0x9aa0a4), box(1.7, 0.3, 0.03, 0, 0.18, 0.19, 0xd8d8d4), box(0.03, 0.3, 0.4, -0.84, 0.18, 0, 0xd8d8d4), box(0.03, 0.3, 0.4, 0.84, 0.18, 0, 0xd8d8d4)];
      for (const sx of [-0.45, 0.45]) P.push(box(0.12, 0.26, 0.08, sx, 0.2, 0.02, 0x2a5aa0), tint(new THREE.SphereGeometry(0.045, 6, 5).translate(sx, 0.39, 0.02), 0xc68642), tint(new THREE.SphereGeometry(0.05, 6, 3, 0, 6.28, 0, 1.6).translate(sx, 0.41, 0.02), 0xf2f2ee));
      const g = new THREE.Mesh(mergeGeometries(P), mat); g.castShadow = true; scene.add(g);
      const cables = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1, 0.02).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      const cables2 = cables.clone(); scene.add(cables, cables2);
      const topY = Math.max(...t.cells.map((c) => c.y + c.hy));
      const f0 = Math.floor(rand(4, faceZ.length / 2));          // start part-way down so they're in view
      this.gondolas.push({ t, g, cables: [cables, cables2], faceZ, floorY, f: f0, x: t.x + rand(-t.w / 4, t.w / 4), topY, dir: -1, pause: rand(2, 5), y: floorY[f0] });
    }
  }

  update(dt) {
    const T = G.camTarget, near = (x, z, r) => Math.hypot(x - T.x, z - T.z) < r;
    for (const c of this.cranes) {
      if (!near(c.base.x, c.base.z, 130)) continue;
      // a simple cycle: to the pile, lower, hook on, raise, swing to the building, lower, unhook, raise, rest
      const P = c.step < 4 ? c.pickP : c.dropP;
      const to = (v, t, rate) => { const d = t - v; return Math.abs(d) < rate * dt ? t : v + Math.sign(d) * rate * dt; };
      const yawTo = (t) => { let d = Math.atan2(Math.sin(t - c.yaw), Math.cos(t - c.yaw)); c.yaw += clamp(d, -0.22 * dt, 0.22 * dt); return Math.abs(d) < 0.01; };
      const hy = c.step === 2 || c.step === 6 ? (c.step === 2 ? c.pickY : c.dropY) : c.H - 2.2;
      switch (c.step) {
        case 0: case 4: { const a = yawTo(P.yaw); c.r = to(c.r, P.r, 1.2); c.y = to(c.y, c.H - 2.2, 1.5); if (a && Math.abs(c.r - P.r) < 0.01) c.step++; break; }
        case 1: case 5: c.y = to(c.y, hy + (c.step === 1 ? c.pickY : c.dropY) - hy, 1.4); if (Math.abs(c.y - (c.step === 1 ? c.pickY : c.dropY)) < 0.01) { c.step++; c.t = rand(1.5, 3); } break;
        case 2: case 6: if ((c.t -= dt) <= 0) { c.load.visible = c.step === 2; c.step++; } break;
        case 3: case 7: c.y = to(c.y, c.H - 2.2, 1.4); if (Math.abs(c.y - (c.H - 2.2)) < 0.01) { c.step = c.step === 7 ? 8 : 4; c.t = rand(4, 9); } break;
        case 8: if ((c.t -= dt) <= 0) c.step = 0; break;
      }
      c.slew.rotation.y = c.yaw;
      c.trolley.position.set(c.r, 0, 0);
      const drop = c.H - c.y;
      c.hook.position.y = -drop; c.cable.scale.y = Math.max(0.01, drop);
    }
    for (const g of this.gondolas) {
      if (!near(g.t.x, g.t.z, 150)) continue;
      // down a floor, clean for a while, down again; at the bottom, shift along and ride back up
      if (g.pause > 0) g.pause -= dt;
      else {
        const target = g.floorY[g.f];
        const d = target - g.y, sp = g.dir < 0 ? 0.35 : 1.2;
        if (Math.abs(d) < sp * dt) {
          g.y = target;
          if (g.dir < 0) { if (g.f <= 2) { g.dir = 1; g.x = g.t.x + clamp(g.x - g.t.x + rand(-2, 2), -g.t.w / 3, g.t.w / 3); g.f = g.faceZ.length - 2; } else { g.f -= 1; g.pause = rand(3, 7); } }
          else { g.dir = -1; g.pause = rand(2, 4); g.f -= 1; }
        } else g.y += Math.sign(d) * sp * dt;
      }
      const fi = Math.max(0, Math.min(g.faceZ.length - 1, Math.round((g.y - g.floorY[0]) / Math.max(0.5, (g.floorY[1] || 1) - g.floorY[0]))));
      const z = g.faceZ[Math.min(fi, g.faceZ.length - 1)] + 0.25;
      g.g.position.set(g.x, g.y - 0.35, z);
      g.cables.forEach((cb, k) => { cb.position.set(g.x + (k ? 0.7 : -0.7), g.y - 0.3, z - 0.1); cb.scale.y = Math.max(0.1, g.topY - g.y + 0.3); });
    }
  }
}

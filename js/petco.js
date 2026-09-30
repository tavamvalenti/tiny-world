// Petco Park: a navy seating bowl wrapped around home plate (lower + upper deck, speckled with fans),
// white lattice light towers, the left-field video board, the Western Metal Supply Co. building,
// the grass berm beyond the outfield, sandstone exterior and crowd noise.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { Baseball } from './baseball.js';

const NAVY = new THREE.Color(0x1c2945), NAVY2 = new THREE.Color(0x24345a);
const FANS = [0xf2efe6, 0xf2efe6, 0xffc425, 0x6b4a2e, 0x6b4a2e, 0xe8c4a8, 0x9a6b4c, 0x2f241d, 0x2f241d, 0xbfd3e6].map((c) => new THREE.Color(c).lerp(NAVY, 0.35));

function textPlane(w, h, draw, emissive = true) {
  const c = document.createElement('canvas'); c.width = Math.round(w * 64); c.height = Math.round(h * 64);
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: emissive ? t : null, emissive: emissive ? 0xffffff : 0, emissiveIntensity: 0.15, roughness: 0.6, side: THREE.DoubleSide }));
  return m;
}

// Layout shared with maps.js (field painting, Western Metal building, players).
export function petcoLayout(site) {
  const H = { x: site.x0 + 10.6, z: site.z1 - 10.6 }; // home plate; +x and -z are the foul lines
  const wallR = (a) => 18.6 + 2.6 * Math.sin(2 * a);  // a: 0 along +x line .. PI/2 along -z line
  return { H, wallR };
}

export function paintPetco(g, site, city) {
  const { H, wallR } = petcoLayout(site);
  const X = g.x, K = g.k;
  g.rect(site.x0, site.z0, site.x1, site.z1, '#c9bda6');                         // sandstone plaza
  g.grainRect(site.x0, site.z0, site.x1, site.z1, 0.25, 30);
  // park at the park: grass berm beyond the outfield
  X.save(); X.fillStyle = '#5f8d3c';
  X.beginPath(); X.moveTo(g.px(H.x + 17), g.px(H.z - 3)); X.lineTo(g.px(site.x1 - 1), g.px(H.z - 3)); X.lineTo(g.px(site.x1 - 1), g.px(site.z0 + 1));
  X.lineTo(g.px(H.x + 6), g.px(site.z0 + 1)); X.closePath(); X.fill(); X.restore();
  // outfield grass inside the wall, with a mowed checkerboard
  X.save(); X.translate(g.px(H.x), g.px(H.z));
  X.beginPath(); X.moveTo(0, 0);
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI / 2; X.lineTo(Math.cos(a) * wallR(a) * K, -Math.sin(a) * wallR(a) * K); }
  X.closePath();
  X.fillStyle = '#b58a5c'; X.fill();                                             // warning track colour underneath
  X.beginPath(); X.moveTo(0, 0);
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI / 2, r = wallR(a) - 0.9; X.lineTo(Math.cos(a) * r * K, -Math.sin(a) * r * K); }
  X.closePath(); X.save(); X.clip();
  X.fillStyle = '#4f8a33'; X.fillRect(-2 * K, -24 * K, 28 * K, 26 * K);
  X.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = -2; i < 26; i += 2) for (let j = -24; j < 2; j += 2) if (((i + j) / 2) % 2 === 0) X.fillRect(i * K, j * K, 2 * K, 2 * K);
  X.restore();
  // infield
  X.fillStyle = '#b98a5a'; X.beginPath(); X.arc(0, 0, 6.3 * K, -Math.PI / 2, 0); X.lineTo(0, 0); X.fill();
  X.fillStyle = '#56903a'; X.fillRect(0.95 * K, -4.15 * K, 3.2 * K, 3.2 * K);
  X.fillStyle = '#b98a5a'; X.beginPath(); X.arc(2.15 * K, -2.15 * K, 0.55 * K, 0, 6.283); X.fill();
  X.beginPath(); X.arc(0, 0, 1.0 * K, 0, 6.283); X.fill();
  X.fillStyle = '#fff'; for (const [bx, bz] of [[0, 0], [4.3, 0], [4.3, -4.3], [0, -4.3]]) X.fillRect(bx * K - 4, bz * K - 4, 8, 8);
  X.strokeStyle = 'rgba(255,255,255,.9)'; X.lineWidth = 0.08 * K;
  X.beginPath(); X.moveTo(0, 0); X.lineTo(18.6 * K, 0); X.moveTo(0, 0); X.lineTo(0, -18.6 * K); X.stroke();
  X.restore();
}

export class Petco {
  constructor(scene, city, site, B) {
    this.site = site;
    const { H, wallR } = petcoLayout(site);
    this.H = H;
    this.center = { x: H.x + 7, z: H.z - 7 };
    // ---- the bowl: a stepped profile swept along a path hugging the foul lines and home plate ----
    const R0 = 2.5, L = 19.5;
    const path = [];
    for (let x = H.x + L; x > H.x; x -= 0.32) path.push({ x, z: H.z + R0, nx: 0, nz: 1 });
    for (let a = Math.PI / 2; a <= Math.PI + 1e-6; a += 0.06) path.push({ x: H.x + Math.cos(a) * R0, z: H.z + Math.sin(a) * R0, nx: Math.cos(a), nz: Math.sin(a) });
    for (let z = H.z; z > H.z - L; z -= 0.32) path.push({ x: H.x - R0, z, nx: -1, nz: 0 });
    // profile: [offset, height, kind]
    const prof = [[0, 0, 'wall'], [0, 0.45, 'wall'], [0.15, 0.45, 'seat']];
    for (let i = 1; i <= 9; i++) prof.push([0.15 + i * 0.42, 0.45 + i * 0.24, 'seat']);
    prof.push([4.3, 2.6, 'conc'], [4.8, 2.6, 'face'], [4.8, 3.5, 'seat']);
    for (let i = 1; i <= 8; i++) prof.push([4.8 + i * 0.36, 3.5 + i * 0.33, 'seat']);
    prof.push([7.9, 6.4, 'rim'], [7.9, 0, 'ext']);
    const pos = [], col = [], fans = [];
    const tint = { wall: NAVY, conc: new THREE.Color(0xb9b4aa), face: new THREE.Color(0xe9e7e1), rim: new THREE.Color(0xe9e7e1), ext: new THREE.Color(0xc8a882) };
    const P = (p, o, y) => [p.x + p.nx * o, y, p.z + p.nz * o];
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      for (let k = 0; k + 1 < prof.length; k++) {
        const [o0, y0] = prof[k], [o1, y1, kind] = prof[k + 1];
        const v = [P(a, o0, y0), P(b, o0, y0), P(b, o1, y1), P(a, o1, y1)];
        let c;
        if (kind === 'seat') {
          // mostly navy seats, heavily speckled with fans in their colours; aisles every ~12 steps
          const fan = false;                                   // (the crowd is real now: js/baseball.js)
          c = i % 12 === 0 ? tint.conc : fan ? pick(FANS) : (k % 2 ? NAVY : NAVY2);
          if (fan) fans.push({ o: col.length, c, e: k % 2 ? NAVY : NAVY2, r: Math.random() });   // a fan: this seat empties after the game
        } else c = tint[kind];
        pos.push(...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]);
        for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
      }
    }
    const bowl = new THREE.BufferGeometry();
    bowl.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bowl.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    bowl.computeVertexNormals();
    const bowlMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    const bowlMesh = new THREE.Mesh(bowl, bowlMat);
    bowlMesh.castShadow = bowlMesh.receiveShadow = true;
    scene.add(bowlMesh);
    this.bowl = bowl; this.fans = fans; this.fill = 1; this.path = path; this.wallR = wallR;
    this.seatRows = [];
    for (let i = 1; i <= 9; i++) this.seatRows.push({ o: 0.15 + (i - 0.5) * 0.42, y: 0.45 + (i - 0.5) * 0.24 });
    for (let i = 1; i <= 8; i++) this.seatRows.push({ o: 4.8 + (i - 0.5) * 0.36, y: 3.5 + (i - 0.5) * 0.33 });
    // game day: game -> ending (the stands empty, fans pour out, traffic builds) -> empty (staff clean) -> pregame
    this.phase = 'game'; this.phaseT = rand(220, 340); this.fillT = 0;
    // end caps where the bowl stops at the foul poles
    const shape = new THREE.Shape(prof.map(([o, y]) => new THREE.Vector2(o, y)));
    for (const [p, dir] of [[path[0], 1], [path[path.length - 1], -1]]) {
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0xc8a882, roughness: 0.9, side: THREE.DoubleSide }));
      // shape x = outward offset, y = height; orient so shape x follows the path normal
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(p.nx, 0, p.nz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(p.nz, 0, -p.nx).multiplyScalar(dir));
      cap.applyMatrix4(m); cap.position.set(p.x, 0, p.z);
      cap.castShadow = true; scene.add(cap);
    }
    // ---- white roof canopy over the upper deck behind home ----
    const canopy = [];
    for (let i = 0; i < path.length; i += 3) {
      const p = path[i];
      if (Math.hypot(p.x - H.x, p.z - H.z) > 9) continue;
      canopy.push(new THREE.BoxGeometry(0.9, 0.08, 3.4).rotateY(Math.atan2(p.nx, p.nz)).translate(p.x + p.nx * 7.2, 7.9, p.z + p.nz * 7.2));
      canopy.push(new THREE.BoxGeometry(0.08, 1.6, 0.08).translate(p.x + p.nx * 7.9, 7.1, p.z + p.nz * 7.9));
    }
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5, metalness: 0.2 });
    const cm = new THREE.Mesh(mergeGeometries(canopy), white); cm.castShadow = true; scene.add(cm);

    // ---- outfield wall ----
    const wall = [];
    for (let i = 0; i < 60; i++) {
      const a0 = (i / 60) * Math.PI / 2, a1 = ((i + 1) / 60) * Math.PI / 2;
      const p0 = [H.x + Math.cos(a0) * wallR(a0), H.z - Math.sin(a0) * wallR(a0)], p1 = [H.x + Math.cos(a1) * wallR(a1), H.z - Math.sin(a1) * wallR(a1)];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      wall.push(new THREE.BoxGeometry(len + 0.02, 0.5, 0.12).rotateY(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0])).translate((p0[0] + p1[0]) / 2, 0.25, (p0[1] + p1[1]) / 2));
    }
    const wm = new THREE.Mesh(mergeGeometries(wall), new THREE.MeshStandardMaterial({ color: 0x1c2945, roughness: 0.8 }));
    wm.castShadow = true; scene.add(wm);
    // foul poles
    for (const [x, z] of [[H.x + wallR(0), H.z], [H.x, H.z - wallR(Math.PI / 2)]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 6).translate(0, 2, 0), new THREE.MeshStandardMaterial({ color: 0xf5c400, emissive: 0x332200 }));
      pole.position.set(x, 0, z); scene.add(pole);
    }

    // ---- lattice light towers on the rim ----
    this.glow = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 16);
    this.glow.count = 0;
    const lattice = [];
    const towerAt = [0.08, 0.3, 0.5, 0.7, 0.92];
    for (const f of towerAt) {
      const p = path[Math.floor(f * (path.length - 1))];
      const x = p.x + p.nx * 7.6, z = p.z + p.nz * 7.6, h = 12.5;
      for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) lattice.push(new THREE.BoxGeometry(0.05, h - 6.4, 0.05).translate(x + dx, 6.4 + (h - 6.4) / 2, z + dz));
      for (let y = 7; y < h; y += 0.8) lattice.push(new THREE.BoxGeometry(0.55, 0.03, 0.03).rotateY(Math.PI / 4).translate(x, y, z), new THREE.BoxGeometry(0.55, 0.03, 0.03).rotateY(-Math.PI / 4).translate(x, y + 0.4, z));
      const yaw = Math.atan2(this.center.x - x, this.center.z - z);
      lattice.push(new THREE.BoxGeometry(2.2, 1.2, 0.12).rotateX(-0.35).rotateY(yaw).translate(x, h + 0.4, z));
      const i = this.glow.count++;
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(x + Math.sin(yaw) * 0.08, h + 0.4, z + Math.cos(yaw) * 0.08),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, yaw, 0, 'YXZ')), new THREE.Vector3(2.0, 1.0, 0.05));
      this.glow.setMatrixAt(i, mm);
    }
    const lm = new THREE.Mesh(mergeGeometries(lattice), white); lm.castShadow = true; scene.add(lm);
    scene.add(this.glow);
    this.fieldLight = new THREE.PointLight(0xfff4e0, 0, 60, 1.2);
    this.fieldLight.position.set(this.center.x, 14, this.center.z); scene.add(this.fieldLight);

    // ---- left-field video board ----
    const bx = H.x + 3.5, bz = H.z - wallR(Math.PI / 2) - 6.2;
    const board = textPlane(9, 3.4, (x, w, h) => {
      x.fillStyle = '#111'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#2f241d'; x.fillRect(8, 8, w * 0.62, h - 16);
      x.fillStyle = '#ffc425'; x.font = `900 ${h * 0.34}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('PADRES', 8 + w * 0.31, h * 0.44);
      x.font = `600 ${h * 0.12}px Inter, Arial`; x.fillStyle = '#f2efe6'; x.fillText('TONIGHT  ·  7:10 PM', 8 + w * 0.31, h * 0.78);
      x.textAlign = 'left'; x.font = `700 ${h * 0.13}px Inter, Arial`;
      const rows = [['SD', '4'], ['VIS', '2'], ['INN', '7']];
      rows.forEach(([a, b], i) => { x.fillStyle = '#ffc425'; x.fillText(a, w * 0.68, h * (0.25 + i * 0.25)); x.fillStyle = '#fff'; x.fillText(b, w * 0.88, h * (0.25 + i * 0.25)); });
    });
    board.position.set(bx, 6.6, bz); board.rotation.y = Math.atan2(H.x - bx, H.z - bz);
    scene.add(board);
    this.board = board;
    this.game = new Baseball(scene, this);
    const legs = [];
    for (const s of [-3.5, 0, 3.5]) legs.push(new THREE.BoxGeometry(0.3, 4.9, 0.3).translate(s, 2.45, -0.2));
    legs.push(new THREE.BoxGeometry(9.3, 3.7, 0.3).translate(0, 6.6, -0.25));
    const lg = new THREE.Mesh(mergeGeometries(legs), new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.7 }));
    lg.position.copy(board.position).setY(0); lg.rotation.y = board.rotation.y; lg.castShadow = true;
    scene.add(lg);

    // ---- "PETCO PARK" lettering on the home-plate entrance ----
    const sign = textPlane(8, 1.1, (x, w, h) => {
      x.fillStyle = '#c8a882'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1c2945'; x.font = `800 ${h * 0.62}px Inter, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('PETCO PARK', w / 2, h * 0.55);
    });
    // freestanding monument on the plaza outside the home-plate gate (clear of the canopy overhang)
    const corner = { x: H.x - (R0 + 10.4) * 0.707, z: H.z + (R0 + 10.4) * 0.707 };
    sign.position.set(corner.x, 1.25, corner.z); sign.rotation.y = -Math.PI / 4;
    scene.add(sign);
    const base = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.7, 0.5).translate(0, 0.35, -0.28), new THREE.MeshStandardMaterial({ color: 0x9c8466, roughness: 0.9 }));
    base.position.set(corner.x, 0, corner.z); base.rotation.y = sign.rotation.y; base.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.2, 0.3).translate(0, 1.25, -0.18), new THREE.MeshStandardMaterial({ color: 0x1c2945, roughness: 0.8 }));
    back.position.copy(base.position); back.rotation.y = sign.rotation.y; back.castShadow = true;
    scene.add(base, back);
    this.sign = sign;

    // ---- Western Metal Supply Co. sign on its brick building (the building itself is destructible) ----
    const wmb = city.westernMetal;
    if (wmb) {
      const t = textPlane(4.6, 0.55, (x, w, h) => {
        x.fillStyle = '#efe6d2'; x.fillRect(0, 0, w, h);
        x.fillStyle = '#2b2b2b'; x.font = `700 ${h * 0.5}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('WESTERN METAL SUPPLY CO.', w / 2, h * 0.55);
      }, false);
      const top = wmb.cells.filter((c) => c.f === wmb.floors - 1 && c.k === wmb.nz - 1);
      const c = top[Math.floor(top.length / 2)] || wmb.cells[0];
      t.position.set(wmb.x, c.y + c.hy - 0.5, wmb.z + wmb.d / 2 + 0.03);
      scene.add(t);
      (c.props ||= []).push({ obj: [t], x: t.position.x, y: t.position.y, z: t.position.z });
    }
  }

  // how full the stands look: fan-coloured seats go back to navy as people leave
  setFill(f) {
    this.fill = f;
    if (this.game) this.game.crowd.setFill(f);
    const a = this.bowl.attributes.color;
    for (const s of this.fans) { const c = s.r < f ? s.c : s.e; for (let q = 0; q < 6; q++) { a.array[s.o + q * 3] = c.r; a.array[s.o + q * 3 + 1] = c.g; a.array[s.o + q * 3 + 2] = c.b; } }
    a.needsUpdate = true;
  }
  news(text) { G.world && G.world.raise('FESTIVAL_EVENT', this.center.x, this.center.z, { news: text, life: 10, tag: 'SPORTS' }); }
  gates() {
    const S = this.site;
    return [{ x: S.x0 - 1, z: S.z1 - 4 }, { x: S.x0 + 6, z: S.z1 + 1 }, { x: (S.x0 + S.x1) / 2, z: S.z1 + 1 }];
  }
  updateDay(dt) {
    this.phaseT -= dt;
    const A = G.agents, R = G.roles;
    if (this.phase === 'game' && this.phaseT <= 0) {
      this.phase = 'ending'; this.phaseT = 70;
      const sc = this.game ? this.game.score : null;
      this.news(sc ? `Final at Petco Park: San Diego ${sc[0]}, Visitors ${sc[1]}` : 'Final out at Petco Park; fans heading home.');
      // traffic builds on the streets round the park
      if (A && G.world) for (let k = 0; k < 8; k++) { const c = A.borrowCar(this.center, 60); if (c && !c.moto) { const g = pick(this.gates()); G.world.onRoad(c, g.x + rand(-8, 8), g.z + rand(2, 6)); } }
    } else if (this.phase === 'ending') {
      this.setFillSoon(Math.max(0, this.phaseT / 70));
      // fans stream out of the gates and walk off
      if (A && (this.outT = (this.outT || 0) - dt) <= 0) {
        this.outT = 1.2;
        const p = A.borrowPed(this.center, 50), g = pick(this.gates());
        if (p) { p.pos.set(g.x + rand(-1.5, 1.5), 0, g.z + rand(-1, 1)); p.q.identity(); A.resumePed(p); }
      }
      if (this.phaseT <= 0) { this.phase = 'empty'; this.phaseT = rand(60, 90); this.setFill(0); }
    } else if (this.phase === 'empty' && this.phaseT <= 0) {
      this.phase = 'pregame'; this.phaseT = 80;
      this.news('Gates open at Petco Park; fans arriving for tonight\'s game.');
    } else if (this.phase === 'pregame') {
      this.setFillSoon(1 - Math.max(0, this.phaseT / 80));
      // people nearby head in through the gates
      if (A && R && (this.inT = (this.inT || 0) - dt) <= 0) {
        this.inT = 2.5;
        const p = A.peds.find((q) => q.state === 'walk' && !q.role && !q.officer && Math.hypot(q.pos.x - this.center.x, q.pos.z - this.center.z) < 45);
        if (p) R.visit(p, pick(this.gates()), rand(40, 90));
      }
      if (this.phaseT <= 0) { this.phase = 'game'; this.phaseT = rand(220, 340); this.setFill(1); this.news('Home game under way at Petco Park.'); }
    }
  }
  setFillSoon(f) { if (Math.abs(f - this.fill) > 0.04) this.setFill(f); }
  // an explosion in the ballpark: the game is called and everyone heads out
  onBlast(x, y, z, r, power, kind) {
    if (!this.game || kind === 'collapse') return;
    if (this.game.onBlast(x, y, z, r, power) && (this.phase === 'game' || this.phase === 'pregame')) {
      this.phase = 'ending'; this.phaseT = 70;
      this.news('Game suspended at Petco Park after an explosion in the stands');
    }
  }
  update(dt = 0) {
    this.updateDay(dt);
    this.game && this.game.update(dt, this.phase);
    const n = G.night || 0;
    this.glow.material.color.setScalar(0.8 + n * 7);
    this.fieldLight.intensity = n * 60;
    this.board.material.emissiveIntensity = 0.5 + n * 1.2;
    this.sign.material.emissiveIntensity = 0.1 + n * 0.7;
  }
}

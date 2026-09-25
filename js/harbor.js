// Waterfront for the Gaslamp map: seawall promenade, piers with docked cruise ships, a marina, harbour
// traffic, and a tall sweeping bridge (white piers, blue girder) with a steady stream of cars.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const CAR_COLORS = [0xf2f2f0, 0x1c1d20, 0x8a9096, 0xb4bac0, 0x9e1b1b, 0x1e3f73, 0x2f5d3a, 0xd9c7a0, 0x3a3f46, 0xcfd6dc];

function shipGeometry() {
  // hull with a pointed bow, stacked white decks, blue band, funnel
  const hull = new THREE.Shape();
  hull.moveTo(-15, -2.2); hull.lineTo(11, -2.2); hull.quadraticCurveTo(16.5, 0, 11, 2.2); hull.lineTo(-15, 2.2); hull.lineTo(-15, -2.2);
  const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 2.4, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const parts = [{ g: hullGeo, c: 0x1d2a44 }];
  const decks = [[-13, 9, 2.4, 1.0, 1.95], [-12, 7.5, 3.4, 1.0, 1.85], [-11, 6, 4.4, 1.0, 1.75], [-10, 4, 5.4, 0.9, 1.6], [-8, 1.5, 6.3, 0.8, 1.3]];
  for (const [x0, x1, y, h, w] of decks) parts.push({ g: new THREE.BoxGeometry(x1 - x0, h, w * 2).translate((x0 + x1) / 2, y + h / 2, 0), c: 0xf4f4f0 });
  parts.push({ g: new THREE.BoxGeometry(26, 0.22, 4.42).translate(-2, 2.3, 0), c: 0x2a6fb5 });                 // blue band
  parts.push({ g: new THREE.CylinderGeometry(0.8, 1.0, 2.2, 10).translate(-9, 8.1, 0), c: 0xf4f4f0 });       // funnel
  parts.push({ g: new THREE.CylinderGeometry(0.82, 0.82, 0.5, 10).translate(-9, 9.0, 0), c: 0x1d2a44 });
  // lifeboats along both sides
  for (let x = -11; x < 5; x += 2.2) for (const s of [-1, 1]) parts.push({ g: new THREE.BoxGeometry(1.5, 0.35, 0.4).translate(x, 3.1, s * 2.05), c: 0xf28c1c });
  const geos = parts.map(({ g, c }) => {
    const n = g.index ? g.toNonIndexed() : g;
    const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
    n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
    return n;
  });
  return mergeGeometries(geos);
}

export class Harbor {
  constructor(scene, city, ground) {
    const X0 = city.shoreX; // seawall line; water lies at x < X0
    this.X0 = X0; this.boats = [];
    const E = ground.E;
    // ---- ground: promenade + seabed tint under the transparent water ----
    ground.rect(-E, -E, X0, E, '#23404f');
    ground.rect(X0, -E, city.xs[0] - city.roadW / 2, E, '#b9b2a4');
    for (let z = -E; z < E; z += 1.2) ground.line(X0, z, city.xs[0] - city.roadW / 2, z, 0.03, 'rgba(0,0,0,.08)');
    ground.line(X0 + 0.1, -E, X0 + 0.1, E, 0.25, '#8d877c');
    ground.tex.needsUpdate = true;
    for (let z = -E + 4; z < E - 2; z += 7) {
      city.addTree(X0 + 2.2, z + rand(-0.5, 0.5), 1, 'palm');
      city.addLamp(X0 + 0.6, z + 3.5, -Math.PI / 2);
    }
    (city.wanderZones ||= []).push({ x0: X0 + 0.6, x1: city.xs[0] - city.roadW / 2 - 0.5, z0: -60, z1: 60 });
    for (let i = 0; i < 8; i++) (city.crowds ||= []).push({ x: X0 + rand(1.5, 3.5), z: rand(-60, 60), r: 0.6, n: Math.round(rand(2, 5)) });

    const concrete = new THREE.MeshStandardMaterial({ color: 0xc9c3b6, roughness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeef0f0, roughness: 0.55, side: THREE.DoubleSide });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a6db8, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.9, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.6, metalness: 0.4 });

    // ---- piers with cruise ships ----
    const piers = [];
    const shipGeo = shipGeometry();
    const shipMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });
    for (const [pz, len, ship] of [[-38, 34, true], [4, 30, true], [34, 18, false]]) {
      piers.push(new THREE.BoxGeometry(len, 0.5, 5).translate(X0 - len / 2, 0.25, pz));
      piers.push(new THREE.BoxGeometry(len * 0.7, 1.4, 3.2).translate(X0 - len * 0.45, 1.2, pz)); // terminal shed
      if (ship) {
        const m = new THREE.Mesh(shipGeo, shipMat);
        m.position.set(X0 - len / 2 - 1, -0.9, pz + 5.6 * (pz < 0 ? -1 : 1));
        m.rotation.y = Math.PI; m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
      }
    }
    const pierMesh = new THREE.Mesh(mergeGeometries(piers), concrete);
    pierMesh.castShadow = pierMesh.receiveShadow = true;
    scene.add(pierMesh);

    // ---- marina: floating docks and moored sailboats ----
    const docks = [], hulls = [], masts = [];
    const mz0 = 44, mz1 = 76, mx = X0 - 4;
    for (let z = mz0; z <= mz1; z += 5) {
      docks.push(new THREE.BoxGeometry(18, 0.12, 0.6).translate(mx - 9, 0.08, z));
      for (let x = mx - 1.5; x > mx - 17; x -= 1.4) for (const s of [-1, 1]) if (Math.random() < 0.8) {
        hulls.push([x, z + s * 1.3]); masts.push([x, z + s * 1.3]);
      }
    }
    docks.push(new THREE.BoxGeometry(0.8, 0.12, mz1 - mz0).translate(mx, 0.08, (mz0 + mz1) / 2));
    scene.add(Object.assign(new THREE.Mesh(mergeGeometries(docks), new THREE.MeshStandardMaterial({ color: 0xb0a590, roughness: 0.9 })), { receiveShadow: true }));
    const hullGeo = mergeGeometries([new THREE.BoxGeometry(1.1, 0.25, 0.42).translate(0, 0.12, 0), new THREE.BoxGeometry(0.4, 0.18, 0.3).translate(-0.1, 0.33, 0)]);
    const hm = new THREE.InstancedMesh(hullGeo, white, hulls.length);
    const mm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.02, 2.2, 4).translate(0, 1.3, 0), dark, masts.length);
    hulls.forEach(([x, z], i) => {
      _m.compose(_p.set(x, 0.02, z), _q.setFromAxisAngle(UP, Math.PI / 2 + rand(-0.1, 0.1)), _s.set(1, 1, 1));
      hm.setMatrixAt(i, _m); mm.setMatrixAt(i, _m);
    });
    hm.castShadow = mm.castShadow = true;
    scene.add(hm, mm);

    // ---- harbour traffic: ferries and small boats moving around the bay ----
    const boatGeo = mergeGeometries([new THREE.BoxGeometry(2.2, 0.4, 0.9).translate(0, 0.2, 0), new THREE.BoxGeometry(1.1, 0.4, 0.7).translate(-0.2, 0.6, 0)]);
    this.boatMesh = new THREE.InstancedMesh(boatGeo, white, 9);
    for (let i = 0; i < 9; i++) this.boats.push({ x: X0 - rand(25, 150), z: rand(-120, 120), a: rand(0, 6.28), sp: rand(1.2, 3), turn: rand(-0.08, 0.08), s: i < 2 ? 2 : rand(0.7, 1.1) });
    this.boatMesh.castShadow = true;
    scene.add(this.boatMesh);

    this.buildBridge(scene, { white, blue, deckMat, dark });
  }

  buildBridge(scene, M) {
    // sweeping curve from the south-west shore out over the bay and away into the haze
    const pts = [[-40, 0.2, 128], [-72, 4, 108], [-108, 11, 84], [-150, 16, 48], [-190, 17, 2], [-222, 15, -52], [-248, 10, -110], [-268, 4, -170], [-282, 0.5, -230]]
      .map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.curve = curve;
    this.len = curve.getLength();
    const N = 360, W = 3.6, GD = 0.9;
    const deck = [], girder = [], rail = [], piers = [], lamps = [];
    const frames = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      frames.push({ p, t, side });
    }
    const ribbon = (y0, halfW, yOff = 0) => {
      const pos = [], idx = [];
      frames.forEach(({ p, side }, i) => {
        pos.push(p.x + side.x * halfW, p.y + y0 + yOff, p.z + side.z * halfW, p.x - side.x * halfW, p.y + y0 + yOff, p.z - side.z * halfW);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const wall = (halfW, yTop, yBot) => {
      const pos = [], idx = [];
      frames.forEach(({ p, side }, i) => {
        for (const s of [1, -1]) pos.push(p.x + side.x * halfW * s, p.y + yTop, p.z + side.z * halfW * s, p.x + side.x * halfW * s, p.y + yBot, p.z + side.z * halfW * s);
        if (i) {
          const a = (i - 1) * 4, b = i * 4;
          idx.push(a, b, a + 1, a + 1, b, b + 1, a + 2, a + 3, b + 2, a + 3, b + 3, b + 2);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    deck.push(ribbon(0, W / 2));
    girder.push(wall(W / 2 - 0.1, -0.02, -GD), ribbon(-GD, W / 2 - 0.1));
    rail.push(wall(W / 2, 0.28, 0));
    // twin white columns with a crossbeam every ~9 units along the curve
    const spacing = 9 / this.len;
    for (let u = 0.04; u < 0.97; u += spacing) {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const h = p.y - GD;
      if (h < 1.2) continue;
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize(), yaw = Math.atan2(t.x, t.z);
      for (const s of [-1, 1]) {
        const cx = p.x + side.x * 1.15 * s, cz = p.z + side.z * 1.15 * s;
        piers.push(new THREE.BoxGeometry(0.42, h, 0.62).rotateY(yaw).translate(cx, h / 2, cz));
        piers.push(new THREE.BoxGeometry(0.9, 0.4, 1.1).rotateY(yaw).translate(cx, 0.1, cz));
      }
      piers.push(new THREE.BoxGeometry(3.0, 0.45, 0.6).rotateY(yaw + Math.PI / 2).translate(p.x, h - 0.2, p.z));
    }
    for (let u = 0.02; u < 0.98; u += 13 / this.len) {
      const p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const side = new THREE.Vector3(-t.z, 0, t.x).normalize();
      lamps.push(new THREE.Vector3(p.x + side.x * 1.65, p.y + 1.1, p.z + side.z * 1.65));
    }
    const mk = (geos, mat) => { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
    mk(deck, M.deckMat); mk(girder, M.blue); mk(rail, M.white); mk(piers, M.white);
    // lane markings as thin dashes
    const dash = [];
    for (let u = 0; u < 1; u += 1.6 / this.len) for (const off of [-0.85, 0.85]) {
      const f = frames[Math.round(u * N)], p = f.p;
      dash.push(new THREE.BoxGeometry(0.05, 0.01, 0.7).rotateY(Math.atan2(f.t.x, f.t.z)).translate(p.x + f.side.x * off, p.y + 0.012, p.z + f.side.z * off));
    }
    mk(dash, new THREE.MeshBasicMaterial({ color: 0xe8e8e0 }));
    const cdiv = []; // centre divider
    frames.forEach((f, i) => { if (i % 2) return; cdiv.push(new THREE.BoxGeometry(0.12, 0.18, 1.2).rotateY(Math.atan2(f.t.x, f.t.z)).translate(f.p.x, f.p.y + 0.09, f.p.z)); });
    mk(cdiv, M.white);
    this.lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps.length);
    const poles = [];
    lamps.forEach((l, i) => { _m.makeTranslation(l.x, l.y, l.z); this.lampHeads.setMatrixAt(i, _m); poles.push(new THREE.CylinderGeometry(0.02, 0.025, 1.1, 4).translate(l.x, l.y - 0.55, l.z)); });
    mk(poles, M.dark);
    scene.add(this.lampHeads);

    // ---- bridge traffic ----
    const body = mergeGeometries([new THREE.BoxGeometry(0.66, 0.2, 1.55).translate(0, 0.2, 0), new THREE.BoxGeometry(0.6, 0.18, 0.74).translate(0, 0.38, -0.08)]);
    const n = 46;
    this.cars = [];
    this.carMesh = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }), n);
    this.lightMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.05, 0.04).translate(0, 0.26, 0.79), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    const lanes = [-1.3, -0.45, 0.45, 1.3];
    for (let i = 0; i < n; i++) {
      const lane = lanes[i % 4];
      const c = { u: Math.random(), lane, dir: lane > 0 ? 1 : -1, v: rand(5, 7.5) / this.len };
      this.cars.push(c);
      this.carMesh.setColorAt(i, new THREE.Color(pick(CAR_COLORS)));
    }
    this.carMesh.castShadow = true;
    scene.add(this.carMesh, this.lightMesh);
  }

  update(dt) {
    const n = G.night || 0;
    // cars keep a gap to the car ahead in their lane, and loop at the ends (both ends are far off-screen)
    const byLane = {};
    for (const c of this.cars) (byLane[c.lane] ||= []).push(c);
    for (const lane of Object.values(byLane)) {
      lane.sort((a, b) => (a.u - b.u) * a.dir);
      lane.forEach((c, i) => {
        const ahead = lane[(i + 1) % lane.length];
        let gap = (ahead.u - c.u) * c.dir; if (gap < 0) gap += 1;
        const gapU = gap * this.len;
        const sp = gapU < 3 ? c.v * Math.max(0, (gapU - 1.6) / 1.4) : c.v;
        c.u += c.dir * sp * dt;
        if (c.u > 1) c.u -= 1; if (c.u < 0) c.u += 1;
      });
    }
    const col = new THREE.Color();
    this.cars.forEach((c, i) => {
      const u = Math.min(0.999, Math.max(0.001, c.u));
      const p = this.curve.getPointAt(u), t = this.curve.getTangentAt(u);
      const side = _s.set(-t.z, 0, t.x).normalize();
      const fwd = t.clone().multiplyScalar(c.dir);
      _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
      _p.set(p.x + side.x * c.lane, p.y + 0.01, p.z + side.z * c.lane);
      // cars pop in and out only at the far ends
      const edge = Math.min(u, 1 - u) < 0.012 ? 0 : 1;
      _m.compose(_p, _q, new THREE.Vector3(edge, edge, edge));
      this.carMesh.setMatrixAt(i, _m); this.lightMesh.setMatrixAt(i, _m);
    });
    this.carMesh.instanceMatrix.needsUpdate = this.lightMesh.instanceMatrix.needsUpdate = true;
    this.lightMesh.material.color.setRGB(0.3 + n * 3, 0.3 + n * 2.8, 0.25 + n * 2.2);
    this.lampHeads.material.color.setRGB(0.6 + n * 3, 0.55 + n * 2.6, 0.45 + n * 2);
    // boats wander the bay, staying off the seawall
    this.boats.forEach((b, i) => {
      b.a += b.turn * dt;
      b.x += Math.cos(b.a) * b.sp * dt; b.z += Math.sin(b.a) * b.sp * dt;
      if (b.x > this.X0 - 8) b.a = Math.PI - b.a, b.x = this.X0 - 8;
      if (b.x < this.X0 - 220 || Math.abs(b.z) > 150) b.a += Math.PI;
      _m.compose(_p.set(b.x, 0.03 + Math.sin(G.time * 2 + i) * 0.03, b.z), _q.setFromAxisAngle(UP, -b.a), _s.set(b.s, b.s, b.s));
      this.boatMesh.setMatrixAt(i, _m);
      if (Math.random() < dt * 5) G.fx.bits.emit(b.x - Math.cos(b.a) * b.s, 0.1, b.z - Math.sin(b.a) * b.s, 0, 0.3, 0, 0.18, 2, 0.95, 0.97, 1, 1);
    });
    this.boatMesh.instanceMatrix.needsUpdate = true;
  }
}

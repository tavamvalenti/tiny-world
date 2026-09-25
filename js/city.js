import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand } from './core.js';
import { canvas, grain, noisePattern } from './textures.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

// ---------- ground painter ----------
export class Ground {
  constructor(extent, res = 4096) {
    this.E = extent; this.res = res;
    this.c = canvas(res, res);
    this.x = this.c.getContext('2d');
    this.k = res / (extent * 2);
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 16;
    this.dirtyT = -1;
  }
  px(x) { return (x + this.E) * this.k; }
  rect(x0, z0, x1, z1, style) { this.x.fillStyle = style; this.x.fillRect(this.px(x0), this.px(z0), (x1 - x0) * this.k, (z1 - z0) * this.k); }
  line(x0, z0, x1, z1, w, style, dash = null) {
    const x = this.x;
    x.strokeStyle = style; x.lineWidth = w * this.k; x.setLineDash(dash ? dash.map((d) => d * this.k) : []);
    x.beginPath(); x.moveTo(this.px(x0), this.px(z0)); x.lineTo(this.px(x1), this.px(z1)); x.stroke();
    x.setLineDash([]);
  }
  circle(cx, cz, r, style) { const x = this.x; x.fillStyle = style; x.beginPath(); x.arc(this.px(cx), this.px(cz), r * this.k, 0, 6.283); x.fill(); }
  grainRect(x0, z0, x1, z1, a = 0.25, s = 40) { grain(this.x, this.px(x0), this.px(z0), (x1 - x0) * this.k, (z1 - z0) * this.k, a, 128, s); }
  // Persistent scorch decal painted into the ground texture.
  scorch(cx, cz, r, a = 0.8) {
    const x = this.x, X = this.px(cx), Z = this.px(cz), R = r * this.k;
    const g = x.createRadialGradient(X, Z, 0, X, Z, R);
    g.addColorStop(0, `rgba(12,10,8,${a})`); g.addColorStop(0.55, `rgba(20,16,12,${a * 0.6})`); g.addColorStop(1, 'rgba(20,16,12,0)');
    x.fillStyle = g; x.beginPath(); x.arc(X, Z, R, 0, 6.283); x.fill();
    if (this.dirtyT < 0) this.dirtyT = 0.35;
  }
  update(dt) {
    if (this.dirtyT < 0) return;
    this.dirtyT -= dt;
    if (this.dirtyT < 0) this.tex.needsUpdate = true;
  }
}

// ---------- geometry kits ----------
function lampGeo() {
  return mergeGeometries([
    new THREE.CylinderGeometry(0.035, 0.05, 2.3, 6).translate(0, 1.15, 0),
    new THREE.BoxGeometry(0.05, 0.05, 0.7).translate(0, 2.28, 0.33),
  ]);
}
function treeCanopy(seed) {
  const parts = [];
  const n = 4 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(rand(0.45, 0.7), 2);
    const p = g.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const s = 1 + (Math.sin(p.getX(v) * 9 + seed) * Math.cos(p.getZ(v) * 7 + i) * 0.12) + rand(-0.05, 0.05);
      p.setXYZ(v, p.getX(v) * s, p.getY(v) * s * 0.85, p.getZ(v) * s);
    }
    const a = (i / n) * 6.28;
    g.translate(Math.cos(a) * 0.45, rand(-0.15, 0.3), Math.sin(a) * 0.45);
    parts.push(g);
  }
  parts.push(new THREE.IcosahedronGeometry(0.62, 2).translate(0, 0.45, 0));
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}
function palmFronds() {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.28, 1.5, 1, 4);
    const p = g.attributes.position;
    for (let v = 0; v < p.count; v++) { const y = p.getY(v) + 0.75; p.setY(v, y); p.setZ(v, -y * y * 0.35); p.setX(v, p.getX(v) * (1 - y / 1.7)); }
    g.rotateX(-Math.PI / 2 + 0.5).rotateY((i / 9) * 6.28 + rand(-0.2, 0.2));
    parts.push(g);
  }
  return mergeGeometries(parts);
}

export class City {
  constructor(o) {
    Object.assign(this, { roadW: 5, sw: 1.6, lights: true, centerLine: 'yellow' }, o);
    this.nodes = []; this.edges = new Map(); this.blocks = []; this.outer = [];
    this.pedNodes = []; this.pedEdges = [];
    this.obstacles = [];
    this.trees = []; this.lamps = []; this.props = [];
    this.parked = []; this.wanderZones = [];
    this.headInst = [];
    this.buildGraph();
  }

  // ---------- road graph ----------
  buildGraph() {
    const { xs, zs, roadW } = this;
    xs.forEach((x, i) => zs.forEach((z, j) => this.nodes.push({ id: this.nodes.length, i, j, x, z, edges: [], off: rand(0, 16) })));
    const nid = (i, j) => i * zs.length + j;
    this.nid = nid;
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < zs.length; j++) {
      const n = this.nodes[nid(i, j)];
      if (this.skipNode && this.skipNode(i, j)) n.dead = true;
    }
    const link = (a, b) => {
      if (a.dead || b.dead) return;
      if (this.skipEdge && this.skipEdge(a, b)) return;
      a.edges.push(b.id); b.edges.push(a.id);
      this.edges.set(this.ek(a.id, b.id), { a: a.id, b: b.id, blocked: false, rubble: 0 });
    };
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < zs.length; j++) {
      if (i + 1 < xs.length) link(this.nodes[nid(i, j)], this.nodes[nid(i + 1, j)]);
      if (j + 1 < zs.length) link(this.nodes[nid(i, j)], this.nodes[nid(i, j + 1)]);
    }
    for (const n of this.nodes) n.lit = this.lights && n.edges.length >= 3;
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++) {
      const b = { i, j, x0: xs[i] + roadW / 2, x1: xs[i + 1] - roadW / 2, z0: zs[j] + roadW / 2, z1: zs[j + 1] - roadW / 2 };
      b.lx0 = b.x0 + this.sw; b.lx1 = b.x1 - this.sw; b.lz0 = b.z0 + this.sw; b.lz1 = b.z1 - this.sw;
      this.blocks.push(b);
    }
    // pedestrian graph: sidewalk corners + crosswalks
    const inset = 0.7;
    const corner = {};
    for (const b of this.blocks) {
      const ids = [];
      for (const [sx, sz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const node = { id: this.pedNodes.length, x: sx ? b.x1 - inset : b.x0 + inset, z: sz ? b.z1 - inset : b.z0 + inset, edges: [] };
        this.pedNodes.push(node); ids.push(node.id);
        corner[`${b.i},${b.j},${sx},${sz}`] = node;
      }
      for (let k = 0; k < 4; k++) this.pedLink(this.pedNodes[ids[k]], this.pedNodes[ids[(k + 1) % 4]], null, null);
    }
    for (const b of this.blocks) for (const s of [0, 1]) {
      const a = corner[`${b.i},${b.j},1,${s}`], c = corner[`${b.i + 1},${b.j},0,${s}`];
      if (a && c) this.pedLink(a, c, this.nodes[nid(b.i + 1, b.j + s)], 'x');
      const d = corner[`${b.i},${b.j},${s},1`], e = corner[`${b.i},${b.j + 1},${s},0`];
      if (d && e) this.pedLink(d, e, this.nodes[nid(b.i + s, b.j + 1)], 'z');
    }
  }
  pedLink(a, b, light, axis) { a.edges.push({ to: b.id, light, axis }); b.edges.push({ to: a.id, light, axis }); }
  ek(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
  edge(a, b) { return this.edges.get(this.ek(a, b)); }

  phase(n) { return (G.time + n.off) % 16; }
  green(n, axis) {
    if (!n.lit) return true;
    const p = this.phase(n);
    return axis === 'x' ? p < 6.5 : p >= 8 && p < 14.5;
  }
  lightState(n, axis) {
    const p = this.phase(n);
    if (axis === 'x') return p < 6.5 ? 0 : p < 8 ? 1 : 2;
    return p >= 8 && p < 14.5 ? 0 : p >= 14.5 ? 1 : 2;
  }

  // ---------- ground painting ----------
  paintRoads(g) {
    const { xs, zs, roadW, E } = this;
    const asphalt = '#4a4b4d';
    const ext = g.E;
    const allX = [...xs], allZ = [...zs];
    // extend the grid visually into the blurred outskirts
    if (this.extendRoads !== false) {
      const px = xs[1] - xs[0], pz = zs[1] - zs[0];
      for (let x = xs[0] - px; x > -ext; x -= px) allX.unshift(x);
      for (let x = xs[xs.length - 1] + px; x < ext; x += px) allX.push(x);
      for (let z = zs[0] - pz; z > -ext; z -= pz) allZ.unshift(z);
      if (!this.noSouthExtend) for (let z = zs[zs.length - 1] + pz; z < ext; z += pz) allZ.push(z);
    }
    this.allX = allX; this.allZ = allZ;
    const zMax = this.noSouthExtend ? zs[zs.length - 1] + roadW / 2 : ext;
    for (const x of allX) g.rect(x - roadW / 2, -ext, x + roadW / 2, zMax, asphalt);
    for (const z of allZ) g.rect(-ext, z - roadW / 2, ext, z + roadW / 2, asphalt);
    g.grainRect(-ext, -ext, ext, ext, 0.18, 30);
    // patches and stains
    for (let i = 0; i < 500; i++) {
      const onX = Math.random() < 0.5;
      const x = onX ? allX[(Math.random() * allX.length) | 0] + rand(-roadW / 2, roadW / 2) : rand(-ext, ext);
      const z = onX ? rand(-ext, zMax) : allZ[(Math.random() * allZ.length) | 0] + rand(-roadW / 2, roadW / 2);
      g.circle(x, z, rand(0.1, 0.5), `rgba(${Math.random() < 0.5 ? '20,20,20' : '120,120,120'},${rand(0.05, 0.15)})`);
    }
    // markings between intersections
    const cl = this.centerLine === 'yellow' ? 'rgba(226,186,60,.9)' : 'rgba(235,235,230,.8)';
    const white = 'rgba(238,238,232,.85)';
    const hw = roadW / 2;
    for (let a = 0; a < allX.length; a++) for (let b = 0; b + 1 < allZ.length; b++) {
      const x = allX[a], z0 = allZ[b] + hw, z1 = allZ[b + 1] - hw;
      if (z0 >= zMax) continue;
      if (this.centerLine === 'yellow') { g.line(x - 0.08, z0 + 2.5, x - 0.08, z1 - 2.5, 0.07, cl); g.line(x + 0.08, z0 + 2.5, x + 0.08, z1 - 2.5, 0.07, cl); }
      else if (this.centerLine) g.line(x, z0 + 2.5, x, z1 - 2.5, 0.1, cl, [1.2, 1.2]);
      this.crosswalk(g, x, z0, x, z0 + 1.6, 'z'); this.crosswalk(g, x, z1 - 1.6, x, z1, 'z');
      g.line(x, z0 + 1.8, x + hw - 0.1, z0 + 1.8, 0.14, white); g.line(x - hw + 0.1, z1 - 1.8, x, z1 - 1.8, 0.14, white);
    }
    for (let b = 0; b < allZ.length; b++) for (let a = 0; a + 1 < allX.length; a++) {
      const z = allZ[b], x0 = allX[a] + hw, x1 = allX[a + 1] - hw;
      if (this.centerLine === 'yellow') { g.line(x0 + 2.5, z - 0.08, x1 - 2.5, z - 0.08, 0.07, cl); g.line(x0 + 2.5, z + 0.08, x1 - 2.5, z + 0.08, 0.07, cl); }
      else if (this.centerLine) g.line(x0 + 2.5, z, x1 - 2.5, z, 0.1, cl, [1.2, 1.2]);
      this.crosswalk(g, x0, z, x0 + 1.6, z, 'x'); this.crosswalk(g, x1 - 1.6, z, x1, z, 'x');
      g.line(x0 + 1.8, z - hw + 0.1, x0 + 1.8, z, 0.14, white); g.line(x1 - 1.8, z, x1 - 1.8, z + hw - 0.1, 0.14, white);
    }
  }
  crosswalk(g, x0, z0, x1, z1, along) {
    if (this.noCrosswalks) return;
    const hw = this.roadW / 2 - 0.3;
    const w = 'rgba(236,236,230,.82)';
    if (along === 'z') for (let x = x0 - hw; x < x0 + hw; x += 0.55) g.rect(x, z0 + 0.2, x + 0.3, z1 - 0.2, w);
    else for (let z = z0 - hw; z < z0 + hw; z += 0.55) g.rect(x0 + 0.2, z, x1 - 0.2, z + 0.3, w);
  }
  paintSidewalk(g, b, color = '#a9a59d') {
    g.rect(b.x0, b.z0, b.x1, b.z1, color);
    const x = g.x;
    x.save(); x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 1;
    for (let t = b.x0; t < b.x1; t += 1.1) { g.line(t, b.z0, t, b.z0 + this.sw, 0.02, 'rgba(0,0,0,.12)'); g.line(t, b.z1 - this.sw, t, b.z1, 0.02, 'rgba(0,0,0,.12)'); }
    for (let t = b.z0; t < b.z1; t += 1.1) { g.line(b.x0, t, b.x0 + this.sw, t, 0.02, 'rgba(0,0,0,.12)'); g.line(b.x1 - this.sw, t, b.x1, t, 0.02, 'rgba(0,0,0,.12)'); }
    x.restore();
    // curb edge + faint shadow on the road
    g.line(b.x0, b.z0, b.x1, b.z0, 0.12, '#c9c5bc'); g.line(b.x0, b.z1, b.x1, b.z1, 0.12, '#c9c5bc');
    g.line(b.x0, b.z0, b.x0, b.z1, 0.12, '#c9c5bc'); g.line(b.x1, b.z0, b.x1, b.z1, 0.12, '#c9c5bc');
    g.line(b.x0 - 0.12, b.z0 - 0.12, b.x1 + 0.12, b.z0 - 0.12, 0.12, 'rgba(0,0,0,.18)');
    g.line(b.x0 - 0.12, b.z0, b.x0 - 0.12, b.z1 + 0.12, 0.12, 'rgba(0,0,0,.18)');
  }
  paintGrass(g, x0, z0, x1, z1, base = '#6b8048') {
    g.rect(x0, z0, x1, z1, base);
    for (let i = 0; i < (x1 - x0) * (z1 - z0) * 1.5; i++) g.circle(rand(x0, x1), rand(z0, z1), rand(0.2, 0.9), `rgba(${Math.random() < 0.5 ? '40,70,20' : '120,140,60'},${rand(0.05, 0.14)})`);
    g.grainRect(x0, z0, x1, z1, 0.3, 50);
  }
  paintParking(g, x0, z0, x1, z1, stallsAlongX = true) {
    g.rect(x0, z0, x1, z1, '#55565a');
    g.grainRect(x0, z0, x1, z1, 0.2, 30);
    const spots = [];
    const W = 1.05, D = 2.1;
    if (stallsAlongX) {
      for (const [zz, dir] of [[z0 + 0.2, 1], [z1 - 0.2, -1]]) {
        for (let x = x0 + 0.4; x + W < x1 - 0.2; x += W) {
          g.line(x, zz, x, zz + dir * D, 0.06, 'rgba(240,240,235,.8)');
          spots.push({ x: x + W / 2, z: zz + dir * D / 2, rot: Math.PI / 2 });
        }
      }
    }
    return spots;
  }

  // ---------- props ----------
  addTree(x, z, s = 1, kind = 'round') { this.trees.push({ x, z, s: s * rand(0.85, 1.15), kind, alive: true, burn: 0, rot: rand(0, 6.28), tilt: 0 }); }
  addLamp(x, z, rot) { this.lamps.push({ x, z, rot, alive: true, flick: 0 }); }
  addProp(type, x, z, rot = 0, s = 1) { this.props.push({ type, x, z, rot, s, alive: true }); }

  lampsAlongBlock(b, spacing = 8) {
    const o = 0.35;
    for (let x = b.x0 + 3; x < b.x1 - 2; x += spacing) { this.addLamp(x, b.z0 + o, Math.PI); this.addLamp(x, b.z1 - o, 0); }
    for (let z = b.z0 + 3 + spacing / 2; z < b.z1 - 2; z += spacing) { this.addLamp(b.x0 + o, z, -Math.PI / 2); this.addLamp(b.x1 - o, z, Math.PI / 2); }
  }
  treesAlongBlock(b, spacing = 5, kind = 'round', s = 0.8) {
    const o = this.sw * 0.55;
    for (let x = b.x0 + 2.5; x < b.x1 - 2; x += spacing) { this.addTree(x + rand(-0.4, 0.4), b.z0 + o, s, kind); this.addTree(x + rand(-0.4, 0.4), b.z1 - o, s, kind); }
    for (let z = b.z0 + 2.5; z < b.z1 - 2; z += spacing) { this.addTree(b.x0 + o, z, s, kind); this.addTree(b.x1 - o, z, s, kind); }
  }

  build(scene) {
    this.scene = scene;
    // trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const palmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
    const round = this.trees.filter((t) => t.kind !== 'palm'), palms = this.trees.filter((t) => t.kind === 'palm');
    const variants = [treeCanopy(1), treeCanopy(2), treeCanopy(3)];
    this.treeMeshes = [];
    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.11, 1, 6).translate(0, 0.5, 0);
    this.trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, round.length));
    this.canopies = variants.map((v) => new THREE.InstancedMesh(v, leafMat, Math.max(1, round.length)));
    this.canopies.forEach((m) => (m.count = 0));
    round.forEach((t, i) => {
      t.trunk = i;
      const m = this.canopies[i % 3]; t.canopyMesh = m; t.canopy = m.count++;
      t.color = new THREE.Color().setHSL(rand(0.2, 0.3), rand(0.3, 0.5), rand(0.2, 0.3), THREE.SRGBColorSpace);
      this.writeTree(t);
    });
    const palmTrunk = new THREE.CylinderGeometry(0.06, 0.1, 1, 6, 4).translate(0, 0.5, 0);
    { const p = palmTrunk.attributes.position; for (let v = 0; v < p.count; v++) p.setX(v, p.getX(v) + Math.pow(p.getY(v), 2) * 0.35); }
    this.palmTrunks = new THREE.InstancedMesh(palmTrunk, new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 1 }), Math.max(1, palms.length));
    this.palmTops = new THREE.InstancedMesh(palmFronds(), palmMat, Math.max(1, palms.length));
    palms.forEach((t, i) => { t.trunk = i; t.canopy = i; t.canopyMesh = this.palmTops; t.color = new THREE.Color().setHSL(rand(0.22, 0.3), 0.45, rand(0.24, 0.32), THREE.SRGBColorSpace); this.writeTree(t); });
    for (const m of [this.trunks, ...this.canopies, this.palmTrunks, this.palmTops]) { m.castShadow = m.receiveShadow = true; scene.add(m); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }

    // lamps
    this.lampMesh = new THREE.InstancedMesh(lampGeo(), new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: 0.5, metalness: 0.6 }), Math.max(1, this.lamps.length));
    this.lampHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, this.lamps.length));
    this.lamps.forEach((l, i) => { l.i = i; this.writeLamp(l); this.lampHeads.setColorAt(i, new THREE.Color(1.4, 1.3, 1.1)); });
    this.lampMesh.castShadow = true;
    scene.add(this.lampMesh, this.lampHeads);

    // traffic lights
    const lit = this.nodes.filter((n) => n.lit);
    const poles = [], hw = this.roadW / 2 + 0.35;
    for (const n of lit) {
      for (const [sx, sz, axis, rot] of [[1, 1, 'x', -Math.PI / 2], [-1, -1, 'x', Math.PI / 2], [-1, 1, 'z', 0], [1, -1, 'z', Math.PI]]) {
        poles.push({ x: n.x + sx * hw, z: n.z + sz * hw, rot, n, axis });
      }
    }
    const poleGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6).translate(0, 0.95, 0),
      new THREE.BoxGeometry(0.16, 0.42, 0.14).translate(0, 1.75, 0),
    ]);
    this.tlMesh = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6, metalness: 0.4 }), Math.max(1, poles.length));
    this.tlLamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial(), Math.max(1, poles.length * 3));
    this.tlLamp.count = poles.length;
    poles.forEach((p, i) => {
      _q.setFromAxisAngle(UP, p.rot);
      _m.compose(_p.set(p.x, 0, p.z), _q, _s.set(1, 1, 1)); this.tlMesh.setMatrixAt(i, _m);
      const off = new THREE.Vector3(0, 0, 0.08).applyQuaternion(_q);
      p.i = i; p.base = new THREE.Vector3(p.x + off.x, 0, p.z + off.z);
      this.tlLamp.setColorAt(i, new THREE.Color(0, 0, 0));
    });
    this.tlPoles = poles;
    this.tlMesh.castShadow = true;
    scene.add(this.tlMesh, this.tlLamp);

    this.buildProps(scene);
  }

  writeTree(t) {
    const palm = t.kind === 'palm';
    const trunk = palm ? this.palmTrunks : this.trunks;
    const h = palm ? 3.2 * t.s : 1.0 * t.s;
    _e.set(t.tilt * Math.cos(t.rot), t.rot, t.tilt * Math.sin(t.rot));
    _q.setFromEuler(_e);
    _m.compose(_p.set(t.x, 0, t.z), _q, _s.set(t.s, h, t.s)); trunk.setMatrixAt(t.trunk, _m);
    if (t.alive) {
      const top = new THREE.Vector3(palm ? 0.35 * t.s * t.s : 0, h, 0).applyQuaternion(_q);
      const cs = palm ? t.s * 1.1 : t.s * (1 - t.burn * 0.35) * 1.15;
      _m.compose(_p.set(t.x + top.x, top.y + (palm ? 0 : 0.35 * t.s), t.z + top.z), _q, _s.set(cs, cs, cs));
      t.canopyMesh.setMatrixAt(t.canopy, _m);
      const c = t.color.clone().lerp(new THREE.Color(0.08, 0.06, 0.04), t.burn);
      t.canopyMesh.setColorAt(t.canopy, c);
    } else t.canopyMesh.setMatrixAt(t.canopy, ZERO);
    trunk.instanceMatrix.needsUpdate = true; t.canopyMesh.instanceMatrix.needsUpdate = true;
    if (t.canopyMesh.instanceColor) t.canopyMesh.instanceColor.needsUpdate = true;
  }

  writeLamp(l) {
    _e.set(l.tilt ? l.tilt * Math.cos(l.tr) : 0, l.rot, l.tilt ? l.tilt * Math.sin(l.tr) : 0);
    _q.setFromEuler(_e);
    _m.compose(_p.set(l.x, 0, l.z), _q, _s.set(1, 1, 1));
    this.lampMesh.setMatrixAt(l.i, _m);
    const head = new THREE.Vector3(0, 2.24, 0.62).applyQuaternion(_q);
    _m.compose(_p.set(l.x + head.x, head.y, l.z + head.z), _q, _s.set(1, 1, 1));
    this.lampHeads.setMatrixAt(l.i, l.alive ? _m : ZERO);
    this.lampMesh.instanceMatrix.needsUpdate = true; this.lampHeads.instanceMatrix.needsUpdate = true;
  }

  buildProps(scene) {
    const kits = {
      bench: [mergeGeometries([new THREE.BoxGeometry(0.7, 0.05, 0.22).translate(0, 0.2, 0), new THREE.BoxGeometry(0.7, 0.18, 0.04).translate(0, 0.32, -0.1)]), 0x6b4a32],
      hydrant: [new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8).translate(0, 0.11, 0), 0xc23a2a],
      bin: [new THREE.CylinderGeometry(0.09, 0.08, 0.26, 8).translate(0, 0.13, 0), 0x2f4a3a],
      umbrella: [mergeGeometries([new THREE.ConeGeometry(0.7, 0.25, 10).translate(0, 1.05, 0), new THREE.CylinderGeometry(0.02, 0.02, 1, 4).translate(0, 0.5, 0)]), 0xffffff],
      towel: [new THREE.BoxGeometry(0.35, 0.01, 0.8).translate(0, 0.01, 0), 0xffffff],
      pump: [new THREE.BoxGeometry(0.3, 0.6, 0.2).translate(0, 0.3, 0), 0xd8d8d8],
      canopy: [new THREE.BoxGeometry(1, 0.2, 1).translate(0, 2.2, 0), 0xf0f0f0],
      pillar: [new THREE.BoxGeometry(0.2, 2.2, 0.2).translate(0, 1.1, 0), 0xdddddd],
      swing: [mergeGeometries([new THREE.BoxGeometry(0.05, 1, 0.05).translate(-0.8, 0.5, 0), new THREE.BoxGeometry(0.05, 1, 0.05).translate(0.8, 0.5, 0), new THREE.BoxGeometry(1.65, 0.05, 0.05).translate(0, 1, 0)]), 0xd04040],
      slide: [mergeGeometries([new THREE.BoxGeometry(0.4, 0.7, 0.4).translate(0, 0.35, 0), new THREE.BoxGeometry(0.3, 0.04, 1.2).rotateX(0.55).translate(0, 0.35, 0.75)]), 0x3a7fd0],
      sign: [mergeGeometries([new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4).translate(0, 0.6, 0), new THREE.BoxGeometry(0.4, 0.12, 0.02).translate(0, 1.15, 0)]), 0x2f7a45],
      fence: [new THREE.BoxGeometry(1, 0.35, 0.04).translate(0, 0.175, 0), 0xf2f0ea],
      hedge: [new THREE.BoxGeometry(1, 0.4, 0.4).translate(0, 0.2, 0), 0x3f5e2a],
      boat: [mergeGeometries([new THREE.BoxGeometry(0.6, 0.2, 1.8).translate(0, 0.1, 0), new THREE.BoxGeometry(0.45, 0.25, 0.6).translate(0, 0.32, -0.1)]), 0xf4f4f4],
      car_wreck: [new THREE.BoxGeometry(0.1, 0.1, 0.1), 0x222222],
    };
    const byType = {};
    for (const p of this.props) (byType[p.type] ||= []).push(p);
    this.propMeshes = {};
    for (const [type, list] of Object.entries(byType)) {
      const [geo, col] = kits[type];
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), list.length);
      list.forEach((p, i) => {
        p.mesh = mesh; p.i = i;
        _q.setFromAxisAngle(UP, p.rot);
        _m.compose(_p.set(p.x, p.y || 0, p.z), _q, _s.set(p.sx || p.s, p.sy || p.s, p.sz || p.s));
        mesh.setMatrixAt(i, _m);
        mesh.setColorAt(i, p.color || new THREE.Color(col));
      });
      mesh.castShadow = type !== 'towel'; mesh.receiveShadow = true;
      scene.add(mesh);
      this.propMeshes[type] = mesh;
    }
  }

  // ---------- obstacles / rubble ----------
  roadEdgeAt(x, z) {
    const { xs, zs, roadW } = this, hw = roadW / 2 + 0.2;
    for (let j = 0; j < zs.length; j++) if (Math.abs(z - zs[j]) < hw) for (let i = 0; i + 1 < xs.length; i++) if (x > xs[i] && x < xs[i + 1]) return this.edge(this.nid(i, j), this.nid(i + 1, j));
    for (let i = 0; i < xs.length; i++) if (Math.abs(x - xs[i]) < hw) for (let j = 0; j + 1 < zs.length; j++) if (z > zs[j] && z < zs[j + 1]) return this.edge(this.nid(i, j), this.nid(i, j + 1));
    return null;
  }
  addRubble(x, z, s) {
    const e = this.roadEdgeAt(x, z);
    if (!e) return;
    e.rubble += s;
    this.rubbleAcc = (this.rubbleAcc || 0) + s;
    if (e.rubble > 1.2) {
      // cluster rubble into coarse blocking circles
      const near = this.obstacles.find((o) => o.kind === 'rubble' && Math.hypot(o.x - x, o.z - z) < 2);
      if (near) near.r = Math.min(3, near.r + s * 0.15);
      else this.obstacles.push({ x, z, r: 1 + s * 0.3, kind: 'rubble' });
      e.blocked = e.rubble > 3;
    }
  }
  addObstacle(x, z, r, kind) {
    this.obstacles.push({ x, z, r, kind });
    for (const e of this.edges.values()) {
      const a = this.nodes[e.a], b = this.nodes[e.b];
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2)));
      if (Math.hypot(a.x + (b.x - a.x) * t - x, a.z + (b.z - a.z) * t - z) < r + this.roadW / 2) e.blocked = true;
    }
  }
  obstacleNear(x, z, r) {
    for (const o of this.obstacles) if ((o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2) return o;
    return null;
  }

  onBlast(x, y, z, r, power, kind) {
    const reach = kind === 'wind' ? r : r * 0.5;
    for (const t of this.trees) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d > reach) continue;
      const f = 1 - d / reach;
      if (kind === 'wind') {
        for (let i = 0; i < 4; i++) G.fx.bits.emit(t.x, 1.2 * t.s, t.z, (t.x - x) / d * 6 + rand(-1, 1), rand(1, 3), (t.z - z) / d * 6 + rand(-1, 1), 0.12, rand(2, 4), t.color.r, t.color.g, t.color.b, 0.9);
        if (power * f > 7 && t.alive) { t.tilt = Math.min(1.2, t.tilt + f * 0.4); t.rot = Math.atan2(t.z - z, t.x - x); }
      } else {
        if (kind !== 'collapse' && f > 0.25) { t.burn = Math.min(1, t.burn + f); if (Math.random() < f) G.fx.groundFire(t.x, 1, t.z, rand(10, 25), 0.8); }
        if (power * f > 6) { t.tilt = Math.min(1.4, f * 1.5); t.rot = Math.atan2(t.z - z, t.x - x); }
        if (f > 0.6 && power > 5) t.alive = false;
      }
      this.writeTree(t);
    }
    for (const l of this.lamps) {
      const d = Math.hypot(l.x - x, l.z - z);
      if (kind === 'energy' && d < r * 1.4) l.flick = rand(2, 5);
      if (d > reach * 0.8 || power < 4) continue;
      const f = 1 - d / (reach * 0.8);
      if (power * f > 5) { l.tilt = Math.min(1.45, f * 2); l.tr = Math.atan2(l.z - z, l.x - x); if (f > 0.5) l.alive = false; this.writeLamp(l); }
    }
    for (const p of this.props) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > reach * 0.7 || ['canopy', 'pillar'].includes(p.type)) continue;
      p.alive = false;
      p.mesh.setMatrixAt(p.i, ZERO); p.mesh.instanceMatrix.needsUpdate = true;
      const v = new THREE.Vector3((p.x - x) / (d + 0.5), 0.8, (p.z - z) / (d + 0.5)).multiplyScalar(Math.min(12, power * 1.5));
      G.fx.debris.spawn(p.x, 0.3, p.z, v, 0.3, 0.2, 0.3, p.color || new THREE.Color(0.4, 0.4, 0.4));
    }
  }

  update(dt) {
    // traffic light colours
    const C = [new THREE.Color(0.2, 3, 1.1), new THREE.Color(3, 2, 0.1), new THREE.Color(3.2, 0.15, 0.1)];
    for (const p of this.tlPoles) {
      const s = this.lightState(p.n, p.axis);
      _m.makeTranslation(p.base.x, 1.63 + (2 - s) * 0.12, p.base.z);
      this.tlLamp.setMatrixAt(p.i, _m);
      this.tlLamp.setColorAt(p.i, C[s]);
    }
    this.tlLamp.instanceMatrix.needsUpdate = true;
    if (this.tlLamp.instanceColor) this.tlLamp.instanceColor.needsUpdate = true;
    // electrical flicker from the energy weapon
    let any = false;
    const col = new THREE.Color();
    for (const l of this.lamps) {
      if (l.flick <= 0) continue;
      l.flick -= dt; any = true;
      const on = Math.random() < 0.5;
      col.setRGB(on ? 2.5 : 0.05, on ? 2.8 : 0.05, on ? 4 : 0.08);
      if (l.flick <= 0) col.setRGB(1.4, 1.3, 1.1);
      this.lampHeads.setColorAt(l.i, col);
    }
    if (any) this.lampHeads.instanceColor.needsUpdate = true;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, clamp, blast } from './core.js';
import { makeShingles } from './textures.js';
import { sfx } from './audio.js';

// Buildings are grids of box "cells" (one bay wide, one floor tall). Every cell of a style lives in one
// InstancedMesh; per-instance attributes drive a patched standard shader: which faces are exterior
// (facade vs exposed interior slab), damage (broken glass, cracks), soot and heat glow.
const HASH = 4;
const HP = { brick: 100, office: 130, concrete: 150, stucco: 85, house: 60, flat: 90, boarded: 70, garage: 55 };
const ROOF = {
  brick: new THREE.Color(0.16, 0.15, 0.14), office: new THREE.Color(0.22, 0.23, 0.24),
  concrete: new THREE.Color(0.2, 0.19, 0.18), stucco: new THREE.Color(0.5, 0.45, 0.38), house: new THREE.Color(0.15, 0.15, 0.15),
  flat: new THREE.Color(0.13, 0.12, 0.12), boarded: new THREE.Color(0.12, 0.11, 0.1), garage: new THREE.Color(0.2, 0.19, 0.18),
};
const GRAV = 14;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function cellGeometry() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const f = new Float32Array(24);
  for (let i = 0; i < 24; i++) f[i] = Math.floor(i / 4);
  g.setAttribute('faceId', new THREE.BufferAttribute(f, 1));
  return g;
}

function gableGeometry() {
  // unit prism: ridge along x, base 1x1 at y=0, apex at y=1
  const p = [], uv = [];
  const tri = (a, b, c) => { p.push(...a, ...b, ...c); };
  const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5], E = [-0.5, 1, 0], F = [0.5, 1, 0];
  tri(A, E, F); tri(A, F, B); // back slope
  tri(D, C, F); tri(D, F, E); // front slope
  tri(A, D, E); tri(B, F, C); // gables
  for (let i = 0; i < p.length; i += 3) uv.push(p[i] * 3, (p[i + 1] + Math.abs(p[i + 2])) * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export class Buildings {
  constructor(facades) {
    this.facades = facades;
    this.timeU = { value: 0 };
    this.list = [];
    this.byStyle = {};
    this.hash = new Map();
    this.burning = new Set();
    this.burnArr = []; this.burnArrT = 0;
    this.falling = [];
    this.dirty = new Set();
    this.props = [];
    this.roofs = [];
    this.maxH = 1;
    this.q = 0;
    this.destroyed = 0;
    this.stateDirty = {};
  }

  // ---------- construction ----------
  add(o) {
    const b = {
      style: o.style, tint: o.tint || new THREE.Color(1, 1, 1), floors: o.floors, gable: !!o.gable,
      roofTint: o.roofTint, x: o.x, z: o.z, w: o.w, d: o.d, grid: [], cells: [], falling: false,
    };
    const cell = o.cell || 1.6;
    const nx = Math.max(1, Math.round(o.w / cell)), nz = Math.max(1, Math.round(o.d / cell));
    const cw = o.w / nx, cd = o.d / nz, fh = o.fh || 1, gh = o.gh || 1.3;
    b.nx = nx; b.nz = nz;
    for (let f = 0; f < o.floors; f++) {
      let inset = 0;
      if (o.setbacks) for (const s of o.setbacks) if (f >= s.f) inset = s.n;
      inset = Math.min(inset, Math.floor((Math.min(nx, nz) - 1) / 2));
      const y0 = f === 0 ? 0 : gh + (f - 1) * fh, h = f === 0 ? gh : fh;
      const layer = [];
      for (let i = 0; i < nx; i++) {
        layer.push([]);
        for (let k = 0; k < nz; k++) {
          if (i < inset || k < inset || i >= nx - inset || k >= nz - inset) { layer[i].push(null); continue; }
          const c = {
            b, f, i, k, style: o.style,
            x: o.x - o.w / 2 + cw * (i + 0.5), y: y0 + h / 2, z: o.z - o.d / 2 + cd * (k + 0.5),
            hx: cw / 2, hy: h / 2, hz: cd / 2,
            hp: HP[o.style], max: HP[o.style], dmg: 0, heat: 0, fire: 0, burn: 0,
            alive: true, falling: false, ground: f === 0 && o.storefront !== false, rest: null, props: null, idx: -1,
          };
          layer[i].push(c); b.cells.push(c);
          this.maxH = Math.max(this.maxH, y0 + h);
        }
      }
      b.grid.push(layer);
    }
    this.list.push(b);
    return b;
  }

  at(b, f, i, k) {
    if (f < 0 || f >= b.floors || i < 0 || i >= b.nx || k < 0 || k >= b.nz) return null;
    return b.grid[f][i][k];
  }

  finalize(scene) {
    this.scene = scene;
    const geoBase = cellGeometry();
    for (const b of this.list) for (const c of b.cells) (this.byStyle[c.style] ||= { cells: [] }).cells.push(c);

    for (const [style, S] of Object.entries(this.byStyle)) {
      const n = S.cells.length;
      const geo = geoBase.clone();
      const mask = new Float32Array(n), state = new Float32Array(n * 4);
      geo.setAttribute('aMask', new THREE.InstancedBufferAttribute(mask, 1));
      geo.setAttribute('aState', new THREE.InstancedBufferAttribute(state, 4));
      const mat = this.material(style);
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      S.mesh = mesh; S.mask = mask; S.state = state;
      S.cells.forEach((c, idx) => {
        c.idx = idx;
        const { b, f, i, k } = c;
        const nb = [this.at(b, f, i + 1, k), this.at(b, f, i - 1, k), this.at(b, f + 1, i, k), this.at(b, f - 1, i, k), this.at(b, f, i, k + 1), this.at(b, f, i, k - 1)];
        let m = 0;
        nb.forEach((x, bit) => { if (!x && !(bit === 3 && f === 0)) m |= 1 << bit; });
        if (f === 0) m |= 0; // bottom face never seen
        mask[idx] = m;
        c.topExposed = !!(m & 4);
        state[idx * 4 + 3] = c.ground ? 1 : 0;
        if (c.dmg || c.burn) { state[idx * 4] = c.dmg; state[idx * 4 + 1] = c.burn; c.hp = c.max * (1 - c.dmg * 0.6); }
        this.writeMatrix(c);
        mesh.setColorAt(idx, b.tint);
        this.hashInsert(c);
      });
      mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }
    this.buildRoofs(scene);
    this.buildProps(scene);
  }

  material(style) {
    const F = this.facades[style];
    const mat = new THREE.MeshStandardMaterial({ map: F.map, roughness: 0.82, metalness: 0, envMapIntensity: 0.8 });
    const timeU = this.timeU;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.maskMap = { value: F.mask };
      sh.uniforms.roofColor = { value: ROOF[style] };
      sh.uniforms.uTime = timeU;
      sh.uniforms.uNight = (G.nightU ||= { value: 0 });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float faceId; attribute float aMask; attribute vec4 aState;
          varying float vFace; varying float vExt; varying vec4 vState; varying vec3 vWPos; varying vec2 vUv0;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vUv0 = uv; vMapUv = vec2(uv.x, uv.y * 0.5 + (aState.w > 0.5 ? 0.0 : 0.5));
          vFace = faceId; vExt = mod(floor(aMask / pow(2.0, faceId) + 0.01), 2.0); vState = aState;
          vWPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D maskMap; uniform vec3 roofColor; uniform float uTime; uniform float uNight;
          varying float vFace; varying float vExt; varying vec4 vState; varying vec3 vWPos; varying vec2 vUv0;
          float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
            return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 texc = texture2D(map, vMapUv).rgb;
          float isWin = texture2D(maskMap, vMapUv).r;
          diffuseColor.rgb = mix(diffuseColor.rgb, texc, isWin);
          float winO = isWin;
          if (vExt < 0.5) {
            isWin = 0.0; winO = 0.0;
            if (vFace > 1.5 && vFace < 2.5) diffuseColor.rgb = vec3(0.34,0.33,0.31) * (0.75 + 0.45 * vn(vWPos.xz * 4.));
            else if (vFace > 2.5 && vFace < 3.5) diffuseColor.rgb = vec3(0.07);
            else {
              float slab = clamp(step(vUv0.y, 0.12) + step(0.9, vUv0.y), 0., 1.);
              diffuseColor.rgb = mix(vec3(0.12,0.11,0.105) * (0.7 + 0.6 * vn(vWPos.xy * 3. + vWPos.zy)), vec3(0.43,0.42,0.40), slab);
            }
          } else if (vFace > 1.5 && vFace < 2.5) {
            isWin = 0.0; winO = 0.0;
            float n = vn(vWPos.xz * 5.0) * 0.6 + vn(vWPos.xz * 21.0) * 0.4;
            diffuseColor.rgb = roofColor * (0.75 + 0.45 * n);
          } else if (vFace > 2.5 && vFace < 3.5) { diffuseColor.rgb = vec3(0.08); isWin = 0.0; }
          float dmg = vState.x, burn = vState.y, heat = vState.z;
          float sn = vn(vWPos.xy * 2.3 + vWPos.zy * 2.3 + vWPos.xz * 1.7);
          float broken = isWin * smoothstep(0.2, 0.5, dmg + sn * 0.25);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), broken);
          diffuseColor.rgb *= 1.0 - dmg * 0.4 * (0.4 + sn);
          float soot = clamp(burn * 1.5 - sn * 0.5, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035,0.03,0.028) * (0.5 + sn), soot);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.1, isWin * (1.0 - broken));`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          metalnessFactor = mix(metalnessFactor, 0.6, isWin * (1.0 - broken));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float fl = 0.6 + 0.4 * sin(uTime * 13.0 + vWPos.x * 3.1 + vWPos.y * 5.3) * sin(uTime * 5.3 + vWPos.z * 2.7);
          float glowMask = mix(0.35, 1.6, max(winO, (1.0 - vExt)));
          totalEmissiveRadiance += vec3(1.0, 0.36, 0.07) * heat * 2.6 * glowMask * (0.45 + 0.55 * sn) * fl;
          // lit windows after dark: each window independently on/off with a few colour temperatures
          if (uNight > 0.01 && winO > 0.5) {
            float wid = floor(vWPos.x * 0.62) * 17.0 + floor(vWPos.z * 0.62) * 31.0 + floor(vWPos.y * 0.98) * 7.0 + step(0.5, vMapUv.x) * 3.0 + vFace * 11.0;
            float r1 = hsh(vec2(wid, 1.7)), r2 = hsh(vec2(wid, 9.1));
            float shop = vState.w;
            float on = shop > 0.5 ? 1.0 : step(1.0 - (0.12 + 0.3 * uNight), r1);
            vec3 wc = r2 < 0.55 ? vec3(1.0, 0.7, 0.38) : r2 < 0.85 ? vec3(1.0, 0.86, 0.62) : vec3(0.62, 0.78, 1.0);
            float flick = r2 > 0.97 ? 0.6 + 0.4 * sin(uTime * 9.0 + wid) : 1.0;
            totalEmissiveRadiance += wc * on * flick * uNight * (1.0 - broken) * (1.0 - clamp(burn * 1.5, 0.0, 1.0)) * (shop > 0.5 ? 2.4 : 1.25) * (0.7 + 0.5 * r2);
          }`);
    };
    return mat;
  }

  buildRoofs(scene) {
    const gb = this.list.filter((b) => b.gable);
    if (!gb.length) return;
    const mat = new THREE.MeshStandardMaterial({ map: makeShingles(), roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(gableGeometry(), mat, gb.length);
    mesh.castShadow = mesh.receiveShadow = true;
    gb.forEach((b, i) => {
      const top = b.grid[b.floors - 1][0][0];
      const along = b.w >= b.d;
      const y = top.y + top.hy;
      _q.setFromAxisAngle(_v.set(0, 1, 0), along ? 0 : Math.PI / 2);
      _m.compose(_p.set(b.x, y, b.z), _q, _s.set((along ? b.w : b.d) + 0.5, Math.min(b.w, b.d) * 0.42, (along ? b.d : b.w) + 0.5));
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, b.roofTint || new THREE.Color(0.45, 0.42, 0.4));
      b.roof = { idx: i, alive: true };
    });
    this.roofMesh = mesh;
    scene.add(mesh);
  }

  buildProps(scene) {
    const tops = [];
    for (const b of this.list) {
      if (b.gable || b.style === 'house') continue;
      const p = b.style === 'flat' || b.style === 'garage' ? 0.04 : 0.14; // Glockton roofs stay mostly bare tar
      for (const c of b.cells) if (c.topExposed && c.f > 0 && Math.random() < p) tops.push(c);
    }
    const ac = new THREE.BoxGeometry(0.55, 0.28, 0.42);
    const tank = mergeGeometries([
      new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12).translate(0, 0.45, 0),
      new THREE.ConeGeometry(0.31, 0.2, 12).translate(0, 0.8, 0),
      new THREE.CylinderGeometry(0.03, 0.03, 0.2, 4).translate(0.2, 0.1, 0.2),
      new THREE.CylinderGeometry(0.03, 0.03, 0.2, 4).translate(-0.2, 0.1, -0.2),
    ]);
    const mA = new THREE.InstancedMesh(ac, new THREE.MeshStandardMaterial({ color: 0xb8bab8, roughness: 0.6, metalness: 0.3 }), tops.length || 1);
    const mT = new THREE.InstancedMesh(tank, new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.9 }), tops.length || 1);
    let a = 0, t = 0;
    for (const c of tops) {
      const isTank = Math.random() < 0.25;
      const mesh = isTank ? mT : mA, idx = isTank ? t++ : a++;
      const y = c.y + c.hy + (isTank ? 0 : 0.14);
      _q.setFromAxisAngle(_v.set(0, 1, 0), Math.random() * 3);
      _m.compose(_p.set(c.x + rand(-0.3, 0.3) * c.hx, y, c.z + rand(-0.3, 0.3) * c.hz), _q, _s.set(1, 1, 1));
      mesh.setMatrixAt(idx, _m);
      (c.props ||= []).push({ mesh, idx, x: _p.x, y, z: _p.z });
    }
    mA.count = a; mT.count = t;
    for (const m of [mA, mT]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  writeMatrix(c) {
    const S = this.byStyle[c.style];
    _m.makeScale(c.hx * 2, c.hy * 2, c.hz * 2).setPosition(c.x, c.y, c.z);
    S.mesh.setMatrixAt(c.idx, _m);
    S.mesh.instanceMatrix.needsUpdate = true;
  }

  writeState(c) {
    const S = this.byStyle[c.style], o = c.idx * 4;
    S.state[o] = c.dmg; S.state[o + 1] = c.burn;
    S.state[o + 2] = c.fire > 0 ? 0.55 : c.heat;
    this.stateDirty[c.style] = true;
  }

  hashKey(ix, iz) { return (ix + 1000) * 4096 + (iz + 1000); }
  hashInsert(c) {
    const x0 = Math.floor((c.x - c.hx) / HASH), x1 = Math.floor((c.x + c.hx) / HASH);
    const z0 = Math.floor((c.z - c.hz) / HASH), z1 = Math.floor((c.z + c.hz) / HASH);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this.hashKey(ix, iz);
      let arr = this.hash.get(k);
      if (!arr) this.hash.set(k, (arr = []));
      arr.push(c);
    }
  }

  query(x, z, r, fn) {
    const id = ++this.q;
    const x0 = Math.floor((x - r) / HASH), x1 = Math.floor((x + r) / HASH);
    const z0 = Math.floor((z - r) / HASH), z1 = Math.floor((z + r) / HASH);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const arr = this.hash.get(this.hashKey(ix, iz));
      if (!arr) continue;
      for (const c of arr) { if (c._q === id) continue; c._q = id; fn(c); }
    }
  }

  // Highest solid surface under (x,z) at or below height y (for debris / agents landing on rooftops).
  surfaceAt(x, z, y = 999) {
    let top = 0, cell = null;
    const arr = this.hash.get(this.hashKey(Math.floor(x / HASH), Math.floor(z / HASH)));
    if (arr) for (const c of arr) {
      if (!c.alive || c.falling) continue;
      if (Math.abs(x - c.x) > c.hx || Math.abs(z - c.z) > c.hz) continue;
      const t = c.y + c.hy;
      if (t > top && t <= y + 0.35) { top = t; cell = c; }
    }
    return { y: top, cell };
  }

  inside(p) {
    const arr = this.hash.get(this.hashKey(Math.floor(p.x / HASH), Math.floor(p.z / HASH)));
    if (!arr) return null;
    for (const c of arr) {
      if (!c.alive || c.falling) continue;
      if (Math.abs(p.x - c.x) <= c.hx && Math.abs(p.y - c.y) <= c.hy && Math.abs(p.z - c.z) <= c.hz) return c;
    }
    return null;
  }

  raycast(o, d, maxDist = 900) {
    let t = 0;
    if (o.y > this.maxH + 1 && d.y < 0) t = (o.y - this.maxH - 1) / -d.y;
    const p = new THREE.Vector3();
    const step = 0.2;
    for (; t < maxDist; t += step) {
      p.copy(d).multiplyScalar(t).add(o);
      if (p.y <= 0) {
        const tg = o.y / -d.y;
        p.copy(d).multiplyScalar(tg).add(o);
        return { point: p, cell: null, normal: new THREE.Vector3(0, 1, 0) };
      }
      const c = this.inside(p);
      if (c) {
        let lo = t - step, hi = t;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          _v.copy(d).multiplyScalar(mid).add(o);
          if (Math.abs(_v.x - c.x) <= c.hx && Math.abs(_v.y - c.y) <= c.hy && Math.abs(_v.z - c.z) <= c.hz) hi = mid; else lo = mid;
        }
        p.copy(d).multiplyScalar(hi).add(o);
        const ax = Math.abs(p.x - c.x) / c.hx, ay = Math.abs(p.y - c.y) / c.hy, az = Math.abs(p.z - c.z) / c.hz;
        const n = new THREE.Vector3();
        if (ax >= ay && ax >= az) n.x = Math.sign(p.x - c.x); else if (ay >= az) n.y = Math.sign(p.y - c.y); else n.z = Math.sign(p.z - c.z);
        return { point: p, cell: c, normal: n };
      }
    }
    return null;
  }

  // ---------- damage ----------
  damageSphere(x, y, z, r, dmg, heat = 0, ignite = 0, src = null) {
    const hit = [];
    this.query(x, z, r + 2, (c) => {
      if (!c.alive || c.falling) return;
      const dx = Math.max(Math.abs(x - c.x) - c.hx, 0), dy = Math.max(Math.abs(y - c.y) - c.hy, 0), dz = Math.max(Math.abs(z - c.z) - c.hz, 0);
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > r) return;
      hit.push([c, 1 - dist / r]);
    });
    for (const [c, f] of hit) {
      if (Math.random() < ignite * f) this.ignite(c);
      this.damage(c, dmg * f, heat * f, src || { x, y, z });
    }
    return hit.length;
  }

  damage(c, amount, heat = 0, src = null) {
    if (!c.alive || c.falling) return;
    c.hp -= amount;
    const was = c.dmg;
    c.dmg = clamp(1 - c.hp / c.max, c.dmg, 1);
    if (was < 0.3 && c.dmg >= 0.3 && G.time - (this.glassT || 0) > 0.15) { this.glassT = G.time; sfx.glass(c.x, c.z, 4); }
    if (heat) {
      this.heat(c, heat);
      c.burn = Math.min(1, c.burn + heat * 0.35);
      if (c.heat > 0.55) this.ignite(c);
    }
    if (c.hp <= 0) this.destroy(c, src);
    else this.writeState(c);
  }

  ignite(c) {
    if (!c.alive || c.fire > 0 || c.burnedOut) return;
    c.fire = rand(30, 75);
    this.burning.add(c);
    this.writeState(c);
  }

  destroy(c, src = null, opts = {}) {
    if (!c.alive) return;
    c.alive = false; c.falling = false;
    this.destroyed++;
    const S = this.byStyle[c.style];
    S.mesh.setMatrixAt(c.idx, ZERO);
    S.mesh.instanceMatrix.needsUpdate = true;
    this.burning.delete(c);
    this.dirty.add(c.b);
    const fx = G.fx;
    // hybrid LOD: detailed debris near the camera focus, cheaper far away
    const camD = G.camTarget ? Math.hypot(c.x - G.camTarget.x, c.z - G.camTarget.z) : 0;
    const n = opts.pieces ?? (camD < 45 ? 3 : camD < 90 ? 2 : 1);
    const base = c.b.tint;
    for (let i = 0; i < n; i++) {
      const s = rand(0.35, 0.65);
      const col = new THREE.Color().copy(base).lerp(new THREE.Color(0.3, 0.29, 0.27), rand(0.3, 0.8)).multiplyScalar(rand(0.35, 0.6) * (1 - c.burn * 0.8));
      const vel = new THREE.Vector3(rand(-1.5, 1.5), rand(0, 2), rand(-1.5, 1.5));
      if (src) {
        _v.set(c.x - src.x, c.y - src.y, c.z - src.z);
        const l = _v.length() || 1;
        vel.addScaledVector(_v, (opts.push ?? 5) / l / Math.max(1, l * 0.3));
      }
      if (opts.vel) vel.add(opts.vel);
      fx.debris.spawn(c.x + rand(-c.hx, c.hx) * 0.6, c.y + rand(-c.hy, c.hy) * 0.6, c.z + rand(-c.hz, c.hz) * 0.6,
        vel, c.hx * 2 * s, c.hy * 2 * s * rand(0.5, 1), c.hz * 2 * s, col);
    }
    if (!opts.quiet) fx.dust(c.x, c.y, c.z, 0.6);
    if (!opts.quiet && G.time - (this.crumbleT || 0) > 0.09) { this.crumbleT = G.time; sfx.crumble(c.x, c.z, 0.5 + Math.min(1, c.y / 10)); }
    if (c.fire > 0 || c.burn > 0.5) fx.emitFire(c.x, c.y, c.z, 4);
    if (c.heat > 0.3 && camD < 70) fx.blowout(c.x, c.y, c.z);
    if (c.props) for (const p of c.props) {
      if (p.obj) { for (const o of p.obj) o.visible = false; }
      else { p.mesh.setMatrixAt(p.idx, ZERO); p.mesh.instanceMatrix.needsUpdate = true; }
      fx.debris.spawn(p.x, p.y + 0.2, p.z, new THREE.Vector3(rand(-2, 2), rand(1, 3), rand(-2, 2)), 0.4, 0.25, 0.35, new THREE.Color(0.55, 0.55, 0.55));
    }
    if (c.rest) for (const d of c.rest) fx.debris.wake(d);
    c.rest = null;
    // neighbours get cracked
    const { b, f, i, k } = c;
    for (const nb of [this.at(b, f, i + 1, k), this.at(b, f, i - 1, k), this.at(b, f, i, k + 1), this.at(b, f, i, k - 1), this.at(b, f + 1, i, k)]) {
      if (nb && nb.alive && !nb.falling) { nb.dmg = Math.min(1, nb.dmg + 0.12); this.writeState(nb); }
    }
    if (b.roof && b.roof.alive && f === b.floors - 1) this.dropRoof(b);
  }

  dropRoof(b) {
    b.roof.alive = false;
    this.roofMesh.setMatrixAt(b.roof.idx, ZERO);
    this.roofMesh.instanceMatrix.needsUpdate = true;
    const top = b.grid[b.floors - 1][0][0];
    const y = top.y + top.hy + 0.4;
    for (let i = 0; i < 6; i++) {
      G.fx.debris.spawn(b.x + rand(-b.w / 2, b.w / 2), y, b.z + rand(-b.d / 2, b.d / 2), new THREE.Vector3(rand(-2, 2), rand(0, 2), rand(-2, 2)),
        rand(0.6, 1.2), 0.08, rand(0.5, 1), new THREE.Color(0.3, 0.28, 0.27));
    }
  }

  // ---------- structure ----------
  checkStructure(b) {
    const alive = (c) => c && c.alive && !c.falling;
    const reached = new Set(), q = [];
    for (const c of b.cells) if (c.f === 0 && alive(c)) { reached.add(c); q.push(c); }
    while (q.length) {
      const c = q.pop();
      const { f, i, k } = c;
      for (const n of [this.at(b, f + 1, i, k), this.at(b, f - 1, i, k), this.at(b, f, i + 1, k), this.at(b, f, i - 1, k), this.at(b, f, i, k + 1), this.at(b, f, i, k - 1)]) {
        if (alive(n) && !reached.has(n)) { reached.add(n); q.push(n); }
      }
    }
    const fall = new Set();
    for (const c of b.cells) if (alive(c) && !reached.has(c)) fall.add(c);

    // Overhang rule: a cell with nothing beneath needs two neighbours that are themselves directly supported.
    for (let f = 1; f < b.floors; f++) {
      for (const row of b.grid[f]) for (const c of row) {
        if (!alive(c) || fall.has(c)) continue;
        if (alive(this.at(b, f - 1, c.i, c.k))) continue;
        let sup = 0;
        for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.at(b, f, c.i + di, c.k + dk);
          if (alive(n) && !fall.has(n) && alive(this.at(b, f - 1, c.i + di, c.k + dk))) sup++;
        }
        if (sup < 2) fall.add(c);
      }
    }

    // Pancake rule: if a storey has lost most of its columns, everything above it comes down.
    for (let f = 1; f < b.floors; f++) {
      let above = 0, below = 0;
      for (const row of b.grid[f]) for (const c of row) if (alive(c) && !fall.has(c)) above++;
      for (const row of b.grid[f - 1]) for (const c of row) if (alive(c) && !fall.has(c)) below++;
      if (above > 0 && below < above * 0.4) {
        for (const c of b.cells) if (c.f >= f && alive(c)) fall.add(c);
        break;
      }
    }
    if (fall.size) this.startCollapse(b, [...fall]);
  }

  startCollapse(b, cells) {
    let cx = 0, cz = 0, minF = 99;
    for (const c of cells) { c.falling = true; cx += c.x; cz += c.z; minF = Math.min(minF, c.f); }
    cx /= cells.length; cz /= cells.length;
    // tilt toward the side that lost the most support
    let hx = 0, hz = 0;
    const lower = minF - 1;
    if (lower >= 0) for (const row of b.grid[lower]) for (const c of row) if (c && !c.alive) { hx += c.x - cx; hz += c.z - cz; }
    if (!hx && !hz) { hx = rand(-1, 1); hz = rand(-1, 1); }
    const axis = new THREE.Vector3(hz, 0, -hx).normalize();
    const pivotY = Math.min(...cells.map((c) => c.y - c.hy));
    this.falling.push({
      b, cells, vy: 0, off: 0, ang: 0, angV: rand(0.15, 0.5) * (cells.length > 6 ? 1 : 2),
      axis, pivot: new THREE.Vector3(cx + hx * 0.2, pivotY, cz + hz * 0.2), t: 0,
    });
    if (cells.length > 4) {
      G.fx.dust(cx, pivotY, cz, 1.4);
      G.shake = Math.max(G.shake, Math.min(0.7, cells.length * 0.01));
    }
  }

  updateFalling(dt) {
    for (let gi = this.falling.length - 1; gi >= 0; gi--) {
      const g = this.falling[gi];
      g.t += dt;
      g.vy -= GRAV * dt;
      g.off += g.vy * dt;
      g.ang = Math.min(g.ang + g.angV * dt * (1 + g.t), 0.5);
      _q.setFromAxisAngle(g.axis, g.ang);
      let landed = false;
      for (const c of g.cells) {
        const S = this.byStyle[c.style];
        _p.set(c.x - g.pivot.x, c.y - g.pivot.y, c.z - g.pivot.z).applyQuaternion(_q).add(g.pivot);
        _p.y += g.off;
        c.px = _p.x; c.py = _p.y; c.pz = _p.z;
        _m.compose(_p, _q, _s.set(c.hx * 2, c.hy * 2, c.hz * 2));
        S.mesh.setMatrixAt(c.idx, _m);
        S.mesh.instanceMatrix.needsUpdate = true;
        if (!landed) {
          const sup = this.surfaceAt(_p.x, _p.z, _p.y - c.hy).y;
          if (_p.y - c.hy <= sup + 0.05) landed = true;
        }
      }
      if (landed || g.t > 6) {
        this.falling.splice(gi, 1);
        this.impact(g);
      }
    }
  }

  impact(g) {
    const v = new THREE.Vector3(0, g.vy * 0.15, 0);
    let cx = 0, cz = 0, lowY = 99;
    const many = g.cells.length;
    const hit = new Set();
    for (const c of g.cells) {
      cx += c.px; cz += c.pz; lowY = Math.min(lowY, c.py);
      c.x = c.px; c.y = c.py; c.z = c.pz;
      const under = this.surfaceAt(c.x, c.z, c.y - c.hy).cell;
      if (under && under.b === g.b) hit.add(under);
      this.destroy(c, null, { pieces: many > 80 ? 1 : 2, vel: v, quiet: many > 10 && Math.random() < 0.7, push: 0 });
    }
    cx /= many; cz /= many;
    // Crush whatever it landed on; this can cascade into further collapse.
    for (const u of hit) this.damage(u, 25 + many * 3, 0, null);
    const s = Math.min(3.5, 0.8 + many * 0.04);
    for (let i = 0; i < Math.min(8, 2 + many / 10); i++) G.fx.dust(cx + rand(-2, 2), Math.max(0.3, lowY), cz + rand(-2, 2), s);
    G.shake = Math.max(G.shake, Math.min(1, many * 0.015));
    blast(cx, lowY, cz, 10 + many * 0.3, 1.5 + many * 0.04, 'collapse');
    if (many > 6) sfx.collapse(cx, cz, many); else sfx.crumble(cx, cz, 1);
    if (many > 20 && G.emergency) G.emergency.report(cx, cz, many / 20);
  }

  // ---------- per-frame ----------
  update(dt) {
    this.timeU.value = G.time;
    this.updateFalling(dt);

    // fire lifecycle: heated -> ignited -> burning -> burned out (persistently charred)
    this.burnArrT -= dt;
    if (this.burnArrT <= 0) { this.burnArr = [...this.burning]; this.burnArrT = 0.25; }
    for (const c of this.burnArr) {
      if (!c.alive || c.fire <= 0) continue;
      c.fire -= dt;
      c.burn = Math.min(1, c.burn + dt * 0.03);
      c.hp -= dt * 0.9;
      c.dmg = Math.max(c.dmg, 1 - c.hp / c.max);
      if (Math.random() < dt * 0.1) this.writeState(c);
      if (c.hp <= 0) { this.destroy(c); continue; }
      if (Math.random() < dt * 0.09) {
        const { b, f, i, k } = c;
        const n = [this.at(b, f + 1, i, k), this.at(b, f + 1, i, k), this.at(b, f, i + 1, k), this.at(b, f, i - 1, k), this.at(b, f, i, k + 1), this.at(b, f, i, k - 1), this.at(b, f - 1, i, k)][Math.floor(Math.random() * 7)];
        if (n) this.ignite(n);
      }
      if (c.fire <= 0) { this.burning.delete(c); c.burnedOut = true; c.burn = Math.max(c.burn, 0.9); c.heat = 0; this.writeState(c); }
    }
    this.emitFireFx(dt);

    // laser heat bleeds off
    if (this.hot) for (const c of this.hot) {
      if (c.fire > 0 || !c.alive) { this.hot.delete(c); continue; }
      c.heat -= dt * 0.35;
      if (c.heat <= 0) { c.heat = 0; this.hot.delete(c); }
      this.writeState(c);
    }

    for (const b of this.dirty) this.checkStructure(b);
    this.dirty.clear();

    for (const [style, d] of Object.entries(this.stateDirty)) {
      if (d) { this.byStyle[style].mesh.geometry.attributes.aState.needsUpdate = true; this.stateDirty[style] = false; }
    }
  }

  heat(c, amt) {
    (this.hot ||= new Set()).add(c);
    c.heat = Math.min(1, c.heat + amt);
  }

  emitFireFx(dt) {
    const arr = this.burnArr;
    if (!arr.length) return;
    const fx = G.fx, T = G.camTarget;
    const budget = Math.min(arr.length * 3, 260) * dt * 10;
    for (let n = 0; n < budget; n++) {
      const c = arr[(Math.random() * arr.length) | 0];
      if (!c.alive || c.fire <= 0) continue;
      const far = T ? Math.hypot(c.x - T.x, c.z - T.z) : 0;
      if (far > 70 && Math.random() < 0.6) continue;
      // flames lick out of an exterior face
      const side = (Math.random() * 4) | 0;
      const ox = side === 0 ? c.hx : side === 1 ? -c.hx : rand(-c.hx, c.hx);
      const oz = side === 2 ? c.hz : side === 3 ? -c.hz : rand(-c.hz, c.hz);
      const intensity = Math.min(1, c.fire / 20);
      fx.fire.emit(c.x + ox, c.y + rand(-c.hy, c.hy * 0.6), c.z + oz, rand(-0.15, 0.15), rand(1.4, 2.8), rand(-0.15, 0.15),
        rand(0.4, 0.85) * (0.6 + intensity * 0.6), rand(0.35, 0.75));
      if (Math.random() < 0.35) fx.smokePuff(c.x + ox, c.y + c.hy, c.z + oz, 0.8 + intensity, 0.08 + c.burn * 0.1);
    }
  }
}

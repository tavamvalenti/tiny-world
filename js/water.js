// Shared water realism for every lake, pool, harbour and sea in the game (the Thames does the same in london.js):
// small ripples carried along by the current, sun glints, and wakes: a V of ripples and churned white water
// behind every moving boat, a little bow wave in front. Boats from every system are gathered into one uniform
// array each frame (gatherWakes), so any water material patched here reacts to whatever is moving on it.
import * as THREE from 'three';
import { G } from './core.js';

const N = 16;
export const wakeU = { value: Array.from({ length: N }, () => new THREE.Vector4()) };
export const timeU = { value: 0 };

// every boat on the water this frame: { x, z, vx, vz }
export function gatherWakes() {
  timeU.value = G.time;
  const out = [];
  for (const b of (G.city && G.city.boats) || []) if (b.alive !== false) out.push([b.x, b.z, Math.sin(b.rot) * b.speed, Math.cos(b.rot) * b.speed]);
  for (const b of (G.harbor && G.harbor.boats) || []) out.push([b.x, b.z, Math.cos(b.a) * b.sp, Math.sin(b.a) * b.sp]);
  for (const b of (G.playa && G.playa.boats) || []) out.push([b.x, b.z, Math.sin(b.h) * 0.4, Math.cos(b.h) * 0.4]);
  for (const b of (G.greenland && G.greenland.wakeList) || []) out.push([b.x, b.z, b.vx, b.vz]);
  for (const g of (G.vegas && G.vegas.gondolas) || []) { const d = g.t < 0.5 ? 1 : -1; out.push([g.m.position.x, g.m.position.z, 0, d * 0.9]); }
  const T = G.camTarget || { x: 0, z: 0 };
  out.sort((a, b) => Math.hypot(a[0] - T.x, a[1] - T.z) - Math.hypot(b[0] - T.x, b[1] - T.z));
  for (let i = 0; i < N; i++) { const o = out[i]; if (o) wakeU.value[i].set(o[0], o[1], o[2], o[3]); else wakeU.value[i].set(0, 0, 0, 0); }
}

// patch a MeshStandard/Physical material's shader (call from inside onBeforeCompile, after any other replacements).
// o: { flow: [dx, dz] current direction and speed, scale: ripple size (1 = river), amp: ripple strength,
//      wakes: react to boats, foam: wake foam strength, gloss: roughness range [min, max] }
export function addRipples(s, o = {}) {
  const flow = o.flow || [0.6, 0.2], sc = (o.scale ?? 1).toFixed(3), amp = (o.amp ?? 1).toFixed(3), foam = (o.foam ?? 1).toFixed(3), [r0, r1] = o.gloss || [0.12, 0.3];
  s.uniforms.uRT = timeU; s.uniforms.uWk = wakeU;
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRw;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvRw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
    uniform float uRT; uniform vec4 uWk[${N}]; varying vec3 vRw; float rwFoam; vec2 rwWk;
    float rh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float rn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(rh2(i), rh2(i + vec2(1, 0)), f.x), mix(rh2(i + vec2(0, 1)), rh2(i + vec2(1, 1)), f.x), f.y); }
    vec2 rwWakes(vec2 q) {
      vec2 g = vec2(0.0); rwFoam = 0.0;
      ${o.wakes === false ? '' : `for (int i = 0; i < ${N}; i++) {
        vec4 b = uWk[i]; float sp = length(b.zw); if (sp < 0.05) continue;
        vec2 rel = q - b.xy; float d = length(rel); if (d > 24.0) continue;
        vec2 dir = b.zw / sp; float al = dot(rel, dir), sd = dot(rel, vec2(-dir.y, dir.x)), behind = -al;
        float k = clamp(sp / 3.0, 0.3, 1.2);
        float cone = behind > -1.5 ? smoothstep(behind * 0.36 + 1.2, behind * 0.3, abs(sd)) : 0.0;
        float fade = exp(-max(behind, 0.0) * 0.12) * smoothstep(-2.0, 0.5, behind) * k;
        g += (rel / (d + 0.001)) * cos(d * 5.5 - uRT * 7.0) * cone * fade * 0.5;
        float edgeV = smoothstep(0.35, 0.0, abs(abs(sd) - behind * 0.33)) * smoothstep(0.0, 1.0, behind);
        rwFoam += (smoothstep(1.2, 0.0, abs(sd)) * smoothstep(5.0, 0.4, behind) * smoothstep(-0.5, 0.5, behind) * 0.7 + edgeV * 0.18) * exp(-max(behind, 0.0) * 0.32) * k * (0.45 + 0.55 * rn2(q * 4.0 + uRT));
        g += (rel / (d + 0.001)) * smoothstep(2.6, 0.8, d) * step(0.0, al) * sin(d * 7.0 - uRT * 6.0) * 0.25;
      }`}
      rwFoam = clamp(rwFoam, 0.0, 0.6);
      return g;
    }`)
    .replace('#include <roughnessmap_fragment>', `rwWk = rwWakes(vRw.xz);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.9), rwFoam * ${foam});
    #include <roughnessmap_fragment>
    roughnessFactor = mix(${r0.toFixed(3)}, ${r1.toFixed(3)}, rn2(vRw.xz * 0.35 + uRT * 0.05)) + rwFoam * 0.5;`)
    .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
    {
      vec2 cq = vRw.xz * ${sc} - vec2(${flow[0].toFixed(3)}, ${flow[1].toFixed(3)}) * uRT;
      vec2 rp = (vec2(rn2(cq * 0.9), rn2(cq * 0.9 + 5.0)) - 0.5) * 0.18 + (vec2(rn2(cq * 2.3 + 2.0), rn2(cq * 2.3 + 9.0)) - 0.5) * 0.09
              + (vec2(rn2(vRw.xz * ${sc} * 4.0 + uRT * 0.6), rn2(vRw.xz * ${sc} * 4.0 - uRT * 0.5 + 3.0)) - 0.5) * 0.03;
      rp = rp * ${amp} + rwWk * 0.7;
      normal = normalize(normal + (viewMatrix * vec4(rp.x, 0., rp.y, 0.)).xyz);
    }`);
}

// a clean water surface for a lake, canal or pool: o.color (deep), o.pool for a tiled swimming pool (bright,
// with the light dancing on the bottom)
export function waterMaterial(o = {}) {
  const mat = new THREE.MeshStandardMaterial({ color: o.color ?? 0x24505a, roughness: 0.2, metalness: 0.05, envMapIntensity: o.pool ? 0.9 : 1.0, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
  mat.onBeforeCompile = (s) => {
    addRipples(s, { flow: o.flow || [0.15, 0.08], scale: o.scale ?? (o.pool ? 1.6 : 0.8), amp: o.amp ?? (o.pool ? 0.5 : 0.85), wakes: o.wakes !== false, foam: 1, gloss: o.pool ? [0.08, 0.16] : [0.14, 0.3] });
    if (o.pool) s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // sunlight caught in the ripples, dancing on the pool floor
      float cs = abs(sin(vRw.x * 5.0 + rn2(vRw.xz * 2.0 + uRT * 0.6) * 6.0) * sin(vRw.z * 5.0 + rn2(vRw.zx * 2.0 - uRT * 0.5) * 6.0));
      totalEmissiveRadiance += vec3(0.25, 0.42, 0.45) * pow(cs, 6.0) * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'water:' + JSON.stringify(o);
  return mat;
}
// pools and ponds a map painted on its ground: real water meshes over them (rects { x0, z0, x1, z1 } or ellipses
// { x, z, rx, rz, rot })
export function buildPools(scene, pools = [], ponds = []) {
  const pm = waterMaterial({ pool: true, color: 0x2fb6c8, wakes: false });
  for (const p of pools) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0).rotateX(-Math.PI / 2), pm);
    const cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2; m.position.set(cx, (p.y ?? (G.terrainH ? G.terrainH(cx, cz) : 0)) + 0.03, cz); m.receiveShadow = true; scene.add(m);
  }
  const lm = waterMaterial({ color: 0x3a5a52, flow: [0.08, 0.05] });
  for (const p of ponds) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), lm);
    m.scale.set(p.rx, 1, p.rz); m.rotation.y = p.rot || 0; m.position.set(p.x, 0.03, p.z); m.receiveShadow = true; scene.add(m);
  }
}

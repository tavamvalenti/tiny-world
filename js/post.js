import * as THREE from 'three';

// Tilt-shift pipeline:
//   scene (HDR, MSAA) -> bloom (bright pass + blur at 1/4 res)
//   -> variable-radius separable blur driven by screen-space distance from a focus band (at half resolution;
//      the final pass keeps the in-focus band from the full-resolution scene)
//   -> grade + tone map + vignette + grain to screen.
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const BLUR_FS = `
uniform sampler2D tSrc; uniform vec2 dir; uniform vec2 res;
uniform float focusY, band, maxBlur, uniformRadius;
varying vec2 vUv;
float amount(vec2 uv){
  float d = abs(uv.y - focusY);
  float t = smoothstep(band * 0.5, band * 0.5 + 0.42, d);
  return t * t;
}
void main(){
  float r = uniformRadius > 0. ? uniformRadius : amount(vUv) * maxBlur;
  if (r < 0.35) { gl_FragColor = texture2D(tSrc, vUv); return; }
  vec2 stepv = dir / res * (r / 6.0);
  vec4 acc = vec4(0.); float wsum = 0.;
  for (int i = -7; i <= 7; i++) {
    float fi = float(i);
    float w = exp(-fi * fi / 18.0);
    acc += texture2D(tSrc, vUv + stepv * fi) * w; wsum += w;
  }
  gl_FragColor = acc / wsum;
}`;

const BRIGHT_FS = `
uniform sampler2D tSrc; varying vec2 vUv;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = max(max(c.r,c.g),c.b);
  gl_FragColor = vec4(c * smoothstep(1.4, 3.5, l), 1.); }`;

const FINAL_FS = `
uniform sampler2D tSrc; uniform sampler2D tSharp; uniform float focusY, band, maxBlur; uniform sampler2D tBloom; uniform float time; uniform float exposure; uniform vec2 res; uniform vec3 tint; uniform float grain;
varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  float d = abs(vUv.y - focusY), t = smoothstep(band * 0.5, band * 0.5 + 0.42, d);
  float k = clamp((t * t * maxBlur - 0.35) / 1.5, 0., 1.);
  vec3 c = mix(texture2D(tSharp, vUv).rgb, texture2D(tSrc, vUv).rgb, k) + bloom * vec3(1.0, 0.9, 0.8);   // slightly warm halation
  c *= exposure * tint;
  c = aces(c);
  // cinematic miniature grade: gentle S-curve, cool shadows, warm highlights, restrained saturation
  float l = dot(c, vec3(0.299,0.587,0.114));
  c = mix(vec3(l), c, 1.08);
  c += vec3(-0.014, 0.002, 0.02) * (1.0 - l) * (1.0 - l) + vec3(0.024, 0.01, -0.018) * l * l;
  c = c * c * (3.0 - 2.0 * c) * 0.35 + c * 0.65;
  c = pow(max(c, 0.), vec3(1.0/2.2));
  c = c * 0.975 + 0.012;                                   // film toe: blacks never fully crush
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.62;
  float g = h(vUv * res + fract(time * 7.13) * 100.) - 0.5;
  c += g * mix(0.045, 0.02, l) * grain;                           // grain sits mostly in the shadows
  gl_FragColor = vec4(c, 1.);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opt);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opt);
    this.b1 = new THREE.WebGLRenderTarget(1, 1, opt);
    this.b2 = new THREE.WebGLRenderTarget(1, 1, opt);
    const u = () => ({ tSrc: { value: null }, dir: { value: new THREE.Vector2() }, res: { value: new THREE.Vector2() },
      focusY: { value: 0.5 }, band: { value: 0.3 }, maxBlur: { value: 14 }, uniformRadius: { value: 0 } });
    this.blur = new THREE.ShaderMaterial({ uniforms: u(), vertexShader: VS, fragmentShader: BLUR_FS, depthTest: false });
    this.bright = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: VS, fragmentShader: BRIGHT_FS, depthTest: false });
    this.final = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, tSharp: { value: null }, focusY: { value: 0.5 }, band: { value: 0.3 }, maxBlur: { value: 14 }, tBloom: { value: null }, time: { value: 0 }, exposure: { value: 0.72 }, res: { value: new THREE.Vector2() }, tint: { value: new THREE.Color(1, 1, 1) }, grain: { value: 1 } },
      vertexShader: VS, fragmentShader: FINAL_FS, depthTest: false,
    });
    this.focusY = 0.5; this.band = 0.3; this.maxBlur = 14;
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    this.rtScene.setSize(w, h);
    this.rtA.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.rtB.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.b1.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.b2.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.final.uniforms.res.value.set(w, h);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  blurPass(src, dst, dx, dy, w, h, uniformRadius = 0) {
    const U = this.blur.uniforms;
    U.tSrc.value = src.texture; U.dir.value.set(dx, dy); U.res.value.set(w, h);
    U.focusY.value = this.focusY; U.band.value = this.band;
    U.maxBlur.value = this.maxBlur * (h / 1080); U.uniformRadius.value = uniformRadius;
    this.pass(this.blur, dst);
  }

  render(scene, camera, time) {
    const { w, h } = this;
    this.r.setRenderTarget(this.rtScene);
    this.r.render(scene, camera);
    // bloom
    this.bright.uniforms.tSrc.value = this.rtScene.texture;
    this.pass(this.bright, this.b1);
    const bw = this.b1.width, bh = this.b1.height;
    this.blurPass(this.b1, this.b2, 1, 0, bw, bh, 9);
    this.blurPass(this.b2, this.b1, 0, 1, bw, bh, 9);
    // tilt-shift, blurred at half resolution
    const hw = this.rtA.width, hh = this.rtA.height;
    this.blurPass(this.rtScene, this.rtA, 1, 0, hw, hh);
    this.blurPass(this.rtA, this.rtB, 0, 1, hw, hh);
    const F = this.final.uniforms;
    F.tSrc.value = this.rtB.texture; F.tSharp.value = this.rtScene.texture;
    F.focusY.value = this.focusY; F.band.value = this.band; F.maxBlur.value = this.maxBlur * (h / 1080); F.tBloom.value = this.b1.texture; F.time.value = time;
    this.pass(this.final, null);
  }
}

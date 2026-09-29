// Two rival crews in Chicago: the blue "Blue Line" (south block) and the red "Red Row" (north block), with the
// street between them as the border. Each crew holds its own block (strict territory zones), hangs out in small
// armed groups at its store and hangout lots, patrols its sidewalks, and every so often the groups converge on
// the border and trade fire from cover across the street, then drift back. Everything is drawn with a handful
// of instanced meshes (bodies, outfits, weapons) so the whole zone costs only a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, pick } from './core.js';
import { sfx } from './audio.js';

const SIDE = {
  blue: { col: 0x1f55d6, dark: 0x16307a, light: 0x6aa2ff, css: '#2f6fe0', cssDark: '#16307a', name: 'BLUE LINE', tags: ['BLUE LINE', 'BL', 'BLUE SIDE', 'B/L', '7TH ST'], rival: ['RR', 'RED ROW'], store: 'BLUE LINE LIQUOR' },
  red: { col: 0xcc1f2a, dark: 0x6e1016, light: 0xff6a70, css: '#d6262e', cssDark: '#6e1016', name: 'RED ROW', tags: ['RED ROW', 'RR', 'RED SIDE', 'R/R', '9TH ST'], rival: ['BL', 'BLUE LINE'], store: 'RED ROW FOOD MART' },
};
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0x6b3e1f, 0x4a2c17, 0xf1c27d, 0xa86b3c];
const NEUTRAL = [0x1c1d20, 0x2b2e33, 0x6b6f76, 0xf2f2f0, 0x3a3f46, 0x4a3b2c];
const PANTS = [0x20283a, 0x1c1d20, 0x3a3f46, 0x2b3a55, 0x4a4f57, 0x5a4a3a];
const WEAPONS = ['ak', 'ar', 'smg', 'shotgun', 'pistol'];
// hit chances are per shot at someone exposed; most fire is suppressive (a fight downs at most a couple per side)
const FIRE = { ak: { gap: 0.11, burst: [3, 6], hit: 0.008 }, ar: { gap: 0.1, burst: [3, 5], hit: 0.009 }, smg: { gap: 0.07, burst: [5, 9], hit: 0.005 }, shotgun: { gap: 0.6, burst: [1, 2], hit: 0.02 }, pistol: { gap: 0.28, burst: [2, 4], hit: 0.007 } };
const MAX_DOWN = 2;

// ---------- geometry helpers ----------
function tint(geo, c) {
  const n = geo.index ? geo.toNonIndexed() : geo;
  const col = new THREE.Color(c), arr = new Float32Array(n.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
  n.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
  return n;
}
const box = (w, h, d, x, y, z, c) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// weapons, muzzle along +z, grip at the origin (figure-local units: a person is ~0.68 tall)
const BLK = 0x1b1c1e, WOOD = 0x7a4a22, STEEL = 0x4a4d52;
function weaponGeo(kind) {
  const P = [];
  if (kind === 'ak') {
    P.push(box(0.03, 0.035, 0.2, 0, 0.02, 0.06, BLK), box(0.028, 0.03, 0.09, 0, 0.015, -0.1, WOOD), box(0.028, 0.022, 0.07, 0, 0.022, 0.14, WOOD), box(0.012, 0.012, 0.11, 0, 0.03, 0.22, STEEL));
    P.push(tint(new THREE.BoxGeometry(0.02, 0.075, 0.03).rotateX(-0.35).translate(0, -0.03, 0.08), BLK), box(0.018, 0.045, 0.022, 0, -0.02, -0.01, WOOD));
  } else if (kind === 'ar') {
    P.push(box(0.03, 0.04, 0.2, 0, 0.02, 0.05, BLK), box(0.028, 0.035, 0.09, 0, 0.012, -0.1, BLK), box(0.03, 0.03, 0.09, 0, 0.022, 0.16, 0x2a2b2e), box(0.012, 0.012, 0.1, 0, 0.025, 0.24, STEEL));
    P.push(box(0.02, 0.06, 0.028, 0, -0.03, 0.07, BLK), box(0.018, 0.045, 0.022, 0, -0.02, -0.01, BLK), box(0.016, 0.02, 0.06, 0, 0.055, 0.06, BLK));
  } else if (kind === 'smg') {
    P.push(box(0.03, 0.04, 0.13, 0, 0.02, 0.04, BLK), box(0.02, 0.07, 0.022, 0, -0.035, 0.05, BLK), box(0.012, 0.012, 0.05, 0, 0.025, 0.13, STEEL), box(0.018, 0.04, 0.02, 0, -0.02, -0.005, BLK), box(0.012, 0.012, 0.07, 0, 0.03, -0.06, STEEL));
  } else if (kind === 'shotgun') {
    P.push(box(0.03, 0.035, 0.12, 0, 0.02, 0.02, BLK), box(0.028, 0.035, 0.1, 0, 0.012, -0.11, WOOD), box(0.016, 0.016, 0.24, 0, 0.035, 0.18, STEEL), box(0.024, 0.024, 0.08, 0, 0.012, 0.16, WOOD), box(0.018, 0.045, 0.022, 0, -0.02, -0.01, WOOD));
  } else {
    P.push(box(0.022, 0.026, 0.075, 0, 0.03, 0.03, BLK), box(0.02, 0.05, 0.024, 0, 0.0, 0.0, 0x2a2b2e));
  }
  return mergeGeometries(P);
}

// ---------- textures ----------
function tagTex(side, w = 512, h = 128, crossRival = false) {
  const S = SIDE[side];
  return canvasTex(w, h, (x) => {
    x.fillStyle = '#5b5c5e'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let i = (y / 16) % 2 ? -20 : 0; i < w; i += 40) { x.strokeStyle = 'rgba(0,0,0,.2)'; x.strokeRect(i, y, 40, 16); }
    let px = 8;
    while (px < w - 40) {
      const t = pick(S.tags), size = rand(h * 0.32, h * 0.52);
      x.save(); x.translate(px, h * rand(0.55, 0.78)); x.rotate(rand(-0.12, 0.08));
      x.font = `900 ${size}px Impact, "Arial Black", sans-serif`; x.lineJoin = 'round';
      x.lineWidth = size * 0.16; x.strokeStyle = pick(['#111', '#f2f2f2']); x.strokeText(t, 0, 0);
      x.fillStyle = pick([S.css, S.css, S.cssDark]); x.fillText(t, 0, 0);
      const tw = x.measureText(t).width; x.restore(); px += tw + rand(10, 30);
    }
    // the rival's tag, crossed out
    if (crossRival) {
      const t = pick(S.rival), rx = rand(w * 0.2, w * 0.7), ry = h * 0.4;
      x.font = `900 ${h * 0.3}px Impact, sans-serif`; x.fillStyle = side === 'blue' ? '#d6262e' : '#2f6fe0'; x.fillText(t, rx, ry);
      x.strokeStyle = S.css; x.lineWidth = 7; x.beginPath(); x.moveTo(rx - 8, ry - h * 0.28); x.lineTo(rx + x.measureText(t).width + 8, ry + 6); x.stroke();
    }
  });
}
function flagTex(side) {
  const S = SIDE[side];
  return canvasTex(128, 80, (x, w, h) => {
    x.fillStyle = S.css; x.fillRect(0, 0, w, h);
    x.fillStyle = S.cssDark; x.fillRect(0, h * 0.72, w, h * 0.28);
    // paisley-ish bandana dots and a star
    x.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(Math.random() * w, Math.random() * h * 0.7, 1.6, 0, 6.283); x.fill(); }
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; x.lineTo(w * 0.28 + Math.cos(a) * r, h * 0.38 + Math.sin(a) * r); } x.closePath(); x.fill();
    x.font = '900 22px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(side === 'blue' ? 'BL' : 'RR', w * 0.68, h * 0.38);
  });
}
function signTex(text, side, w = 512, h = 96) {
  const S = SIDE[side];
  return canvasTex(w, h, (x) => {
    x.fillStyle = '#141414'; x.fillRect(0, 0, w, h);
    x.fillStyle = S.css; x.fillRect(0, h - 10, w, 10); x.fillRect(0, 0, w, 6);
    x.fillStyle = '#fff'; x.font = `800 ${h * 0.42}px Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h * 0.52);
  });
}
function posterTex(side) {
  const S = SIDE[side];
  return canvasTex(64, 96, (x, w, h) => {
    x.fillStyle = S.css; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.fillRect(4, 4, w - 8, h * 0.55);
    x.fillStyle = '#fff'; x.font = '900 14px Impact, sans-serif'; x.textAlign = 'center'; x.fillText(S.name.split(' ')[0], w / 2, h * 0.74); x.fillText(S.name.split(' ')[1], w / 2, h * 0.9);
    x.fillStyle = S.light; x.beginPath(); x.arc(w / 2, h * 0.3, 11, 0, 6.283); x.fill();
  });
}

// ---------- a crew member's body parts (figure-local, pivots at the origin for limbs) ----------
function bodyGeos() {
  return {
    torso: new THREE.CylinderGeometry(0.072, 0.064, 0.26, 7).scale(1, 1, 0.66).translate(0, 0.45, 0),
    head: new THREE.SphereGeometry(0.052, 8, 6).translate(0, 0.64, 0),
    cap: mergeGeometries([new THREE.SphereGeometry(0.056, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.655, 0), new THREE.BoxGeometry(0.07, 0.008, 0.06).translate(0, 0.66, 0.06)]),
    wrap: new THREE.SphereGeometry(0.057, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.42).translate(0, 0.645, -0.004),
    scarf: new THREE.ConeGeometry(0.06, 0.07, 6, 1, true).rotateX(Math.PI).translate(0, 0.585, 0.012),
    hood: new THREE.TorusGeometry(0.05, 0.022, 5, 10).scale(1, 0.6, 0.9).translate(0, 0.575, -0.03),
    leg: new THREE.CylinderGeometry(0.03, 0.023, 0.3, 5).translate(0, -0.15, 0),
    arm: new THREE.CylinderGeometry(0.022, 0.017, 0.25, 5).translate(0, -0.125, 0),
  };
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const SCALE = 1.2;

export class Gangs {
  constructor(scene, city) {
    this.city = city; const GS = city.gangs;
    this.zones = GS.zones; this.border = GS.border;
    this.members = []; this.groups = []; this.cover = { blue: [], red: [] }; this.flags = [];
    this.calm = rand(10, 20); this.fight = null; this.shotBudget = 0;
    this.dress(scene, GS);
    this.spawn(scene, GS);
  }

  // which way is the enemy from this side (+1 = towards larger z)
  toward(side) { return side === 'blue' ? 1 : -1; }
  clampTo(side, x, z) {
    const Z = this.zones[side], m = 0.35;
    return { x: Math.max(Z.x0 + m, Math.min(Z.x1 - m, x)), z: Math.max(Z.z0 + m, Math.min(Z.z1 - m, z)) };
  }

  // ---------- environment ----------
  dress(scene, GS) {
    const P = [];                                                  // plain vertex-coloured bits, one merged mesh
    const lay = { blue: [], red: [] }, lean = { blue: [], red: [] }; // weapon props: lying on tables / leaning on walls
    const panels = [];                                             // textured planes: [tex, w, h, x, y, z, rotY]
    const B = this.border;
    for (const side of ['blue', 'red']) {
      const S = SIDE[side], Z = this.zones[side], row = GS[side], d = this.toward(side);
      // border cover: jersey barriers, burned-out cars and dumpsters on this side's sidewalk
      const sideZ = row.street + d * 1.0;                               // props on the curb half of the sidewalk
      const behind = row.street + d * 0.35;                             // where a shooter crouches (inner half)
      let k = 0;
      for (let x = Z.x0 + 1.6; x < Z.x1 - 1; x += rand(2.8, 3.6), k++) {
        const kind = ['barrier', 'wreck', 'barrier', 'dumpster'][k % 4];
        if (kind === 'barrier') { P.push(box(1.5, 0.42, 0.34, x, 0.21, sideZ, 0x9c9a94), box(1.5, 0.12, 0.44, x, 0.06, sideZ, 0x8e8c86)); panels.push([tagTex(side, 256, 64, Math.random() < 0.4), 1.5, 0.36, x, 0.22, sideZ + d * 0.175, d > 0 ? 0 : Math.PI]); }
        else if (kind === 'wreck') { P.push(box(1.6, 0.24, 0.72, x, 0.2, sideZ, 0x3b2e28), box(0.8, 0.2, 0.64, x - 0.1, 0.42, sideZ, 0x201a17), box(1.62, 0.04, 0.74, x, 0.08, sideZ, 0x5a3a24)); }  // burned-out car along the curb
        else { P.push(box(1.0, 0.55, 0.62, x, 0.28, sideZ, side === 'blue' ? 0x243a6e : 0x6e2430), box(1.04, 0.05, 0.66, x, 0.58, sideZ, 0x1c1d20)); }
        // faction cloth thrown over the top and hanging down the street side
        P.push(box(kind === 'barrier' ? 1.1 : 0.9, 0.015, kind === 'barrier' ? 0.38 : 0.5, x + rand(-0.15, 0.15), kind === 'barrier' ? 0.43 : kind === 'wreck' ? 0.53 : 0.61, sideZ, S.col));
        P.push(box(kind === 'barrier' ? 0.9 : 0.7, kind === 'barrier' ? 0.3 : 0.4, 0.012, x, kind === 'barrier' ? 0.28 : 0.36, sideZ + d * (kind === 'barrier' ? 0.2 : kind === 'wreck' ? 0.37 : 0.33), S.col));
        this.cover[side].push({ x, z: behind, used: null }, { x: x + 0.5, z: behind, used: null });
      }
      // the front line: a row of flags along the border sidewalk, cloth draped over the cover, emblem boards
      for (let x = Z.x0 + 0.5; x < Z.x1; x += 2.4) this.flagAt(scene, side, x, row.street + d * 1.22, rand(2.5, 3), rand(-0.25, 0.25) + (d > 0 ? 0 : Math.PI), 1.4);  // at the curb edge, flying toward the street
      for (const x of [Z.x0 + 0.9, (Z.x0 + Z.x1) / 2 + 1.3, Z.x1 - 0.9]) {
        P.push(box(0.06, 1.6, 0.06, x - 0.4, 0.8, sideZ - d * 0.35, 0x2f3338), box(0.06, 1.6, 0.06, x + 0.4, 0.8, sideZ - d * 0.35, 0x2f3338));
        panels.push([this.emblem(side), 0.95, 0.95, x, 1.2, sideZ - d * 0.35 + d * 0.035, d > 0 ? 0 : Math.PI]);
      }
      // corner store: faction sign, posters, tags down the side walls, a flag, lights over the door
      for (const st of row.stores) {
        const fz = st.z + d * st.d / 2 + d * 0.02;
        panels.push([signTex(S.store, side), st.w * 0.9, 0.36, st.x, 1.55, fz, d > 0 ? 0 : Math.PI]);
        for (const sx of [-1, 1]) panels.push([tagTex(side, 512, 128, true), st.d * 0.9, 1.1, st.x + sx * (st.w / 2 + 0.02), 0.62, st.z, sx * Math.PI / 2]);
        for (let i = 0; i < 3; i++) panels.push([posterTex(side), 0.24, 0.36, st.x - st.w * 0.35 + i * 0.3, 0.75, fz + d * 0.005, d > 0 ? 0 : Math.PI]);
        this.flagAt(scene, side, st.x + st.w * 0.42, fz + d * 0.3, 2.4);
        for (const bx of [st.x - st.w * 0.46, st.x + st.w * 0.46]) panels.push([this.vbanner(side), 0.5, 1.4, bx, 2.45, fz + d * 0.03, d > 0 ? 0 : Math.PI]);
        panels.push([this.emblem(side), 0.8, 0.8, st.x, 2.6, fz + d * 0.025, d > 0 ? 0 : Math.PI]);
        (this.lamps ||= []).push([st.x - 0.8, 1.35, fz + d * 0.05], [st.x + 0.8, 1.35, fz + d * 0.05]);
        // an ammo crate by the door with pistols on it
        const tx = st.x + st.w * 0.3, tz = row.street + d * 0.12;     // against the storefront
        P.push(box(0.5, 0.26, 0.34, tx, 0.13, tz, 0x4a5a2a), box(0.2, 0.03, 0.005, tx, 0.16, tz + d * 0.175, 0xd9b12e));
        lay[side].push([tx - 0.1, 0.29, tz, 'pistol', rand(0, 6)], [tx + 0.12, 0.29, tz + 0.04, 'pistol', rand(0, 6)]);
      }
      // hangout lots: couch, chairs, grill, cooler, tables with guns, weapon cases, ammo crates, rifles against the
      // garage, a fence with tags on the lot line, bunting over the street end, flags, coloured lights
      for (const lot of row.lots) {
        const cz = lot.cz, gx = lot.cx;
        this.table(P, gx - 0.6, cz); lay[side].push([gx - 0.75, 0.34, cz - 0.05, pick(['ak', 'ar', 'smg']), rand(-0.3, 0.3) + Math.PI / 2], [gx - 0.4, 0.34, cz + 0.1, 'pistol', rand(0, 6)]);
        this.table(P, gx + 1.1, cz + d * -1.2); lay[side].push([gx + 1.1, 0.34, cz - d * 1.2, pick(['shotgun', 'ak']), Math.PI / 2 + rand(-0.2, 0.2)]);
        // open weapon case with a rifle inside, ammo crates
        const cx2 = gx + 1.5, cz2 = cz + d * 0.9;
        P.push(box(0.5, 0.08, 0.18, cx2, 0.04, cz2, 0x151515), box(0.46, 0.02, 0.15, cx2, 0.085, cz2, 0x55585c), box(0.5, 0.16, 0.02, cx2, 0.16, cz2 - 0.1, 0x151515));
        lay[side].push([cx2, 0.1, cz2, 'ar', Math.PI / 2]);
        for (let i = 0; i < 3; i++) P.push(box(0.3, 0.16, 0.2, gx - 1.9 + (i % 2) * 0.05, 0.08 + Math.floor(i / 2) * 0.16, cz + d * 1.3 + i * 0.02, 0x4a5a2a), box(0.12, 0.03, 0.005, gx - 1.9, 0.1 + Math.floor(i / 2) * 0.16, cz + d * 1.3 + i * 0.02 - 0.1, 0xd9b12e));
        // couch + chairs + grill + cooler
        P.push(box(1.2, 0.18, 0.42, gx, 0.14, cz - d * 1.4, 0x5a4636), box(1.2, 0.3, 0.12, gx, 0.3, cz - d * 1.6, 0x5a4636), box(0.14, 0.26, 0.42, gx - 0.6, 0.2, cz - d * 1.4, 0x4d3c2e), box(0.14, 0.26, 0.42, gx + 0.6, 0.2, cz - d * 1.4, 0x4d3c2e));
        for (const s of [-1, 1]) P.push(box(0.22, 0.04, 0.22, gx + s * 1.4, 0.2, cz, 0xeeeeea), box(0.22, 0.2, 0.03, gx + s * 1.4, 0.3, cz - 0.1, 0xeeeeea));
        P.push(tint(new THREE.CylinderGeometry(0.16, 0.12, 0.14, 10).translate(gx + 2, 0.36, cz - d * 0.5), 0x1c1d20), box(0.03, 0.3, 0.03, gx + 2, 0.15, cz - d * 0.5, 0x1c1d20));
        P.push(box(0.34, 0.22, 0.22, gx - 1.3, 0.11, cz - d * 0.6, S.col), box(0.35, 0.04, 0.23, gx - 1.3, 0.23, cz - d * 0.6, 0xf2f2f0));
        panels.push([this.emblem(side), 1.0, 1.0, gx, 0.7, lot.garageZ + d * 0.02, d > 0 ? 0 : Math.PI]);   // emblem sprayed on the garage door
        // rifles leaning on the garage
        for (let i = 0; i < 3; i++) lean[side].push([gx - 0.6 + i * 0.35, lot.garageZ + d * 0.25, pick(['ak', 'ar', 'shotgun', 'smg'])]);
        // tagged wooden fence on the lot line + a flag on each lot, bunting at the street end
        const fx = lot.x0 + 0.05;
        panels.push([tagTex(side, 512, 96, Math.random() < 0.5), Math.abs(lot.garageZ - row.street) - 0.6, 0.8, fx, 0.4, (lot.garageZ + row.street) / 2, Math.PI / 2]);
        this.flagAt(scene, side, lot.x1 - 0.4, row.street + d * -0.9, 2.2);
        this.bunting(P, side, lot.x0 + 0.2, lot.x1 - 0.2, row.street - d * 0.4, 2.1);
        (this.lamps ||= []).push([gx - 1, 1.5, lot.garageZ + d * 0.05], [gx + 1, 1.5, lot.garageZ + d * 0.05]);
        this.hangouts = this.hangouts || { blue: [], red: [] };
        this.hangouts[side].push({ x: gx, z: cz, exit: { x: gx, z: row.street + d * 0.35 } });
      }
      // a few more flags along the side streets of the block
      for (const [fx, fz] of [[Z.x0 + 0.5, (Z.z0 + Z.z1) / 2], [Z.x1 - 0.5, (Z.z0 + Z.z1) / 2 - 3], [Z.x0 + 0.5, Z.z0 + 0.5], [Z.x1 - 0.5, Z.z0 + 0.5], [Z.x0 + 0.5, Z.z1 - 0.5], [Z.x1 - 0.5, Z.z1 - 0.5]]) this.flagAt(scene, side, fx, fz, 2.2);
      for (const st of row.stores) { this.hangouts[side].push({ x: st.x, z: row.street + d * 0.35, exit: { x: st.x, z: row.street + d * 0.35 } }); }
      this.sidewalkZ = this.sidewalkZ || {}; this.sidewalkZ[side] = row.street + d * 0.35;
    }
    const mesh = new THREE.Mesh(mergeGeometries(P), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    for (const [tex, w, h, x, y, z, ry] of panels) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); }
    // weapon props, one instanced mesh per weapon type
    const props = WEAPONS.map((k) => ({ k, list: [] }));
    for (const side of ['blue', 'red']) {
      for (const [x, y, z, k, ry] of lay[side]) props.find((p) => p.k === k).list.push(new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, Math.PI / 2)), _s.setScalar(SCALE)));
      // stock on the ground, muzzle up, resting back against the garage wall
      for (const [x, z, k] of lean[side]) props.find((p) => p.k === k).list.push(new THREE.Matrix4().compose(_v.set(x, 0.12, z), _q.setFromEuler(_e.set(side === 'blue' ? -1.84 : -1.3, 0, 0)), _s.setScalar(SCALE)));
    }
    const wmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const p of props) {
      if (!p.list.length) continue;
      const im = new THREE.InstancedMesh(weaponGeo(p.k), wmat, p.list.length);
      p.list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; scene.add(im);
    }
    // faction-coloured lights over doors and lots (glow at night; no point lights)
    const lg = mergeGeometries(this.lamps.map(([x, y, z]) => new THREE.BoxGeometry(0.12, 0.08, 0.06).translate(x, y, z)));
    const cols = new Float32Array(lg.attributes.position.count * 3);
    this.lamps.forEach(([x, y, z], i) => { const c = new THREE.Color(z < B.z ? SIDE.blue.light : SIDE.red.light); for (let v = 0; v < 24; v++) c.toArray(cols, (i * 24 + v) * 3); });
    lg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.lampMesh = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true })); scene.add(this.lampMesh);
  }
  table(P, x, z) {
    P.push(box(0.7, 0.04, 0.4, x, 0.3, z, 0x6b4a32));
    for (const [a, b] of [[-0.3, -0.16], [0.3, -0.16], [-0.3, 0.16], [0.3, 0.16]]) P.push(box(0.03, 0.3, 0.03, x + a, 0.15, z + b, 0x3a2a1c));
  }
  bunting(P, side, x0, x1, z, y) {
    const S = SIDE[side];
    P.push(box(x1 - x0, 0.01, 0.01, (x0 + x1) / 2, y, z, 0x222222), box(0.04, y, 0.04, x0, y / 2, z, 0x2f3338), box(0.04, y, 0.04, x1, y / 2, z, 0x2f3338));
    for (let x = x0 + 0.15, i = 0; x < x1 - 0.1; x += 0.3, i++) P.push(tint(new THREE.ConeGeometry(0.08, 0.18, 3).rotateX(Math.PI).translate(x, y - 0.1 - Math.sin((x - x0) / (x1 - x0) * Math.PI) * 0.12, z), i % 3 === 2 ? 0x111111 : i % 3 === 1 ? 0xf2f2f0 : S.col));
  }
  // crew emblem: a star in a ring over the crew initials, on the crew colour
  emblem(side) {
    return ((this.emblems ||= {})[side] ||= canvasTex(128, 128, (x, w, h) => {
      const S = SIDE[side];
      x.fillStyle = '#111'; x.fillRect(0, 0, w, h);
      x.fillStyle = S.css; x.beginPath(); x.arc(w / 2, h / 2, w * 0.46, 0, 6.283); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.arc(w / 2, h / 2, w * 0.4, 0, 6.283); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28; x.lineTo(w / 2 + Math.cos(a) * r, h * 0.4 + Math.sin(a) * r); } x.closePath(); x.fill();
      x.font = '900 26px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(side === 'blue' ? 'BL' : 'RR', w / 2, h * 0.74);
    }));
  }
  vbanner(side) {
    return ((this.vbanners ||= {})[side] ||= canvasTex(64, 180, (x, w, h) => {
      const S = SIDE[side];
      x.fillStyle = S.css; x.fillRect(0, 0, w, h); x.fillStyle = S.cssDark; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
      x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 8 : 18; x.lineTo(w / 2 + Math.cos(a) * r, 40 + Math.sin(a) * r); } x.closePath(); x.fill();
      x.font = '900 20px Impact, sans-serif'; x.textAlign = 'center';
      S.name.split(' ').forEach((t, k) => x.fillText(t, w / 2, 100 + k * 30));
    }));
  }
  flagAt(scene, side, x, z, h, yaw = null, size = 1) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, h, 5), new THREE.MeshLambertMaterial({ color: 0x9aa0a4 }));
    pole.position.set(x, h / 2, z); scene.add(pole);
    const geo = new THREE.PlaneGeometry(0.7 * size, 0.44 * size, 8, 1).translate(0.35 * size, 0, 0);
    const flag = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: (this.flagTexs ||= {})[side] ||= flagTex(side), side: THREE.DoubleSide }));
    flag.position.set(x, h - 0.24 * size, z); flag.rotation.y = yaw ?? rand(-0.6, 0.6) + (side === 'blue' ? 0 : Math.PI);
    scene.add(flag);
    this.flags.push({ geo, base: geo.attributes.position.array.slice(), ph: rand(0, 6) });
  }

  // ---------- crews ----------
  spawn(scene, GS) {
    const geos = bodyGeos(), N = 22;
    const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n); m.castShadow = true; m.frustumCulled = false; for (let i = 0; i < n; i++) m.setMatrixAt(i, ZERO); scene.add(m); return m; };
    this.I = { torso: mk(geos.torso, N), head: mk(geos.head, N), cap: mk(geos.cap, N), wrap: mk(geos.wrap, N), scarf: mk(geos.scarf, N), hood: mk(geos.hood, N), leg: mk(geos.leg, N * 2), arm: mk(geos.arm, N * 2) };
    const wmat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.W = Object.fromEntries(WEAPONS.map((k) => { const m = new THREE.InstancedMesh(weaponGeo(k), wmat, N); m.castShadow = true; m.frustumCulled = false; for (let i = 0; i < N; i++) m.setMatrixAt(i, ZERO); scene.add(m); return [k, m]; }));
    let i = 0;
    for (const side of ['blue', 'red']) {
      const S = SIDE[side], spots = this.hangouts[side];
      const sizes = [4, 4, 3];
      spots.slice(0, 3).forEach((post, gi) => {
        const grp = { side, post, members: [], mode: 'hang', t: rand(20, 50), route: null };
        for (let k = 0; k < sizes[gi]; k++, i++) {
          const a = (k / sizes[gi]) * 6.283 + rand(-0.3, 0.3), r = rand(0.45, 0.8);
          const p = this.clampTo(side, post.x + Math.cos(a) * r, post.z + Math.sin(a) * r);
          // varied outfits: faction colour somewhere on everyone, never the same combo twice in a row
          const top = Math.random() < 0.6 ? pick([S.col, S.dark, S.col]) : pick(NEUTRAL);
          const factionTop = top === S.col || top === S.dark;
          const headwear = pick(factionTop ? ['none', 'cap', 'wrap', 'capblack'] : ['cap', 'wrap', 'wrap', 'cap']);
          const m = {
            i, side, grp, x: p.x, z: p.z, h: Math.atan2(post.x - p.x, post.z - p.z), tx: p.x, tz: p.z, run: 0, crouch: 0, aim: 0, state: 'idle',
            weapon: pick(k === 0 ? ['ak', 'ar', 'shotgun'] : WEAPONS), hood: Math.random() < 0.4, scarf: !factionTop || Math.random() < 0.35, headwear,
            fireT: rand(0, 2), burst: 0, peek: false, phaseT: rand(1, 3), hp: 1, idleA: rand(0, 6),
          };
          this.I.torso.setColorAt(i, new THREE.Color(top));
          this.I.head.setColorAt(i, new THREE.Color(pick(SKIN)));
          this.I.cap.setColorAt(i, new THREE.Color(headwear === 'capblack' ? 0x151515 : S.col));
          this.I.wrap.setColorAt(i, new THREE.Color(S.col));
          this.I.scarf.setColorAt(i, new THREE.Color(S.col));
          this.I.hood.setColorAt(i, new THREE.Color(top));
          const pants = new THREE.Color(Math.random() < 0.25 ? S.dark : pick(PANTS));
          this.I.leg.setColorAt(i * 2, pants); this.I.leg.setColorAt(i * 2 + 1, pants);
          const sleeve = new THREE.Color(m.hood || Math.random() < 0.4 ? top : pick(SKIN));
          this.I.arm.setColorAt(i * 2, sleeve); this.I.arm.setColorAt(i * 2 + 1, sleeve);
          grp.members.push(m); this.members.push(m);
        }
        this.groups.push(grp);
      });
    }
    for (const m of Object.values(this.I)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  // ---------- the director: calm, then a border firefight, then calm ----------
  startFight(side0 = null, nearX = null) {
    if (this.fight) return;
    const fx = nearX ?? rand(this.border.x0 + 4, this.border.x1 - 4);
    this.fight = { t: rand(16, 30), x: fx, reported: false, down: {} };
    // most groups on both sides answer, closest to the flashpoint first
    for (const side of ['blue', 'red']) {
      const gs = this.groups.filter((g) => g.side === side).sort((a, b) => Math.abs(a.post.x - fx) - Math.abs(b.post.x - fx));
      gs.forEach((g, k) => { if (k < 2 || Math.random() < 0.5 || g.side === side0) this.engage(g); });
    }
  }
  engage(g) {
    if (g.mode === 'fight') return;
    g.mode = 'fight';
    const covers = this.cover[g.side];
    for (const m of g.members) {
      if (m.state === 'down') continue;
      const free = covers.filter((c) => !c.used).sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z));
      const c = free[Math.floor(Math.random() * Math.min(3, free.length))];
      if (c) { c.used = m; m.cover = c; m.route = [{ x: m.x, z: this.sidewalkZ[g.side] }, { x: c.x, z: c.z }]; }
      else m.route = [{ x: m.x, z: this.sidewalkZ[g.side] - this.toward(g.side) * 0.9 }];
      m.state = 'toCover'; m.peek = false; m.phaseT = rand(0.5, 1.5);
    }
  }
  endFight() {
    this.fight = null; this.calm = rand(14, 30);
    for (const c of [...this.cover.blue, ...this.cover.red]) c.used = null;
    for (const g of this.groups) {
      g.mode = 'hang'; g.t = rand(20, 50);
      for (const m of g.members) {
        if (m.state === 'down') { m.recover = rand(6, 12); continue; }
        this.sendHome(m);
      }
    }
    if (this.inc && G.emergency) { const inc = this.inc; setTimeout(() => G.emergency.release(inc), 40000); this.inc = null; }
  }
  sendHome(m) {
    const post = m.grp.post, a = rand(0, 6.28), r = rand(0.45, 0.85);
    const dst = this.clampTo(m.side, post.x + Math.cos(a) * r, post.z + Math.sin(a) * r);
    m.cover = null; m.state = 'walk'; m.route = [{ x: m.x, z: this.sidewalkZ[m.side] }, { x: post.exit.x, z: post.exit.z }, dst];
  }

  update(dt) {
    const T = G.camTarget, cx = (this.border.x0 + this.border.x1) / 2;
    const near = Math.hypot(T.x - cx, T.z - this.border.z) < 70;
    this.shotBudget = Math.min(12, this.shotBudget + dt * 14);   // cap gunshot sounds per second
    if (this.fight) { if ((this.fight.t -= dt) <= 0) this.endFight(); }
    else if ((this.calm -= dt) <= 0) this.startFight();
    // groups on patrol walk their own sidewalks, then come back
    for (const g of this.groups) {
      if (g.mode !== 'hang' || this.fight) continue;
      if ((g.t -= dt) <= 0) {
        g.t = rand(35, 70);
        const Z = this.zones[g.side], d = this.toward(g.side), sz = this.sidewalkZ[g.side];
        const far = rand(Z.x0 + 1, Z.x1 - 1), sideX = Math.random() < 0.5 ? Z.x0 + 0.65 : Z.x1 - 0.65, deep = sz - d * rand(6, 12);
        const path = [{ x: g.post.exit.x, z: g.post.exit.z }, { x: far, z: sz }, { x: sideX, z: sz }, { x: sideX, z: deep }, { x: sideX, z: sz }, { x: g.post.exit.x, z: g.post.exit.z }];
        g.members.forEach((m, k) => { if (m.state === 'down') return; m.state = 'walk'; m.route = [{ x: m.x, z: sz }, ...path.map((p) => ({ x: p.x + (k % 2) * 0.35, z: p.z - d * Math.floor(k / 2) * 0.35 }))]; m.after = 'home'; });
      }
    }
    const I = this.I;
    for (const m of this.members) this.think(m, dt, near);
    // write instances
    for (const m of this.members) this.pose(m);
    for (const k of Object.keys(I)) I[k].instanceMatrix.needsUpdate = true;
    for (const k of WEAPONS) this.W[k].instanceMatrix.needsUpdate = true;
    // flags ripple, lights glow at night
    const n = G.night || 0;
    this.lampMesh.material.color.setScalar(0.7 + n * 2.6);
    if (near) for (const f of this.flags) {
      const a = f.geo.attributes.position, b = f.base;
      for (let v = 0; v < a.count; v++) { const x = b[v * 3]; a.array[v * 3 + 2] = b[v * 3 + 2] + Math.sin(G.time * 5 + f.ph + x * 9) * 0.05 * x; }
      a.needsUpdate = true;
    }
  }

  think(m, dt, near) {
    if (m.state === 'down') {
      if (m.recover != null && (m.recover -= dt) <= 0) { m.recover = null; m.hp = 1; this.sendHome(m); }
      return;
    }
    // follow a route (every waypoint clamped to our own zone: territory is strict)
    if (m.route && m.route.length) {
      const w = this.clampTo(m.side, m.route[0].x, m.route[0].z), dx = w.x - m.x, dz = w.z - m.z, d = Math.hypot(dx, dz);
      const sp = m.state === 'toCover' ? 2.5 : 1.0;
      if (d < 0.08) m.route.shift();
      else { const s = Math.min(d, sp * dt); m.x += dx / d * s; m.z += dz / d * s; m.h = Math.atan2(dx, dz); m.run += dt * (m.state === 'toCover' ? 17 : 9); }
      m.moving = d >= 0.08;
      if (!m.route.length) {
        if (m.state === 'toCover') { m.state = 'cover'; m.phaseT = rand(0.3, 1.2); }
        else if (m.state === 'walk' && m.after === 'home') { m.after = null; this.sendHome(m); }
        else if (m.state === 'walk') m.state = 'idle';
      }
      if (m.state !== 'cover') { m.crouch = Math.max(0, m.crouch - dt * 4); m.aim = m.state === 'toCover' ? 1 : Math.max(0, m.aim - dt * 3); return; }
    }
    m.moving = false;
    if (m.state === 'idle') {
      // hang out: face the group, weapon low, the odd gesture; if a fight is on nearby, face the border
      const post = m.grp.post;
      m.h = this.fight ? (this.toward(m.side) > 0 ? 0 : Math.PI) : Math.atan2(post.x - m.x, post.z - m.z);
      m.aim = Math.max(0, m.aim - dt * 3); m.crouch = 0;
      return;
    }
    if (m.state === 'cover') {
      // alternate: duck behind cover, pop up and fire a burst at someone across the street, sometimes shift cover
      m.phaseT -= dt;
      const enemies = this.members.filter((o) => o.side !== m.side && (o.state === 'cover' || o.state === 'toCover'));
      if (m.target && (m.target.state === 'down' || !enemies.includes(m.target))) m.target = null;
      if (!m.target && enemies.length) m.target = enemies.sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x))[Math.floor(Math.random() * Math.min(3, enemies.length))];
      const tx = m.target ? m.target.x : m.x + rand(-3, 3), tz = m.target ? m.target.z : this.border.z + this.toward(m.side) * 3;
      if (m.peek) {
        m.crouch = Math.max(0, m.crouch - dt * 6); m.aim = Math.min(1, m.aim + dt * 6);
        m.h = Math.atan2(tx - m.x, tz - m.z);
        const F = FIRE[m.weapon];
        if ((m.fireT -= dt) <= 0 && m.burst > 0 && m.aim > 0.8) { m.fireT = F.gap * rand(0.8, 1.3); m.burst--; this.shoot(m, tx, tz, near); }
        if (m.phaseT <= 0 || (m.burst <= 0 && m.fireT < -0.3)) { m.peek = false; m.phaseT = rand(1.0, 2.6); }
      } else {
        m.crouch = Math.min(1, m.crouch + dt * 5); m.aim = Math.max(0.3, m.aim - dt * 2);
        m.h = this.toward(m.side) > 0 ? 0 : Math.PI;
        if (m.phaseT <= 0) {
          // sometimes reposition to another free cover spot nearby first
          if (Math.random() < 0.25) {
            const free = this.cover[m.side].filter((c) => !c.used && Math.abs(c.x - m.x) < 6);
            if (free.length) { const c = pick(free); if (m.cover) m.cover.used = null; c.used = m; m.cover = c; m.state = 'toCover'; m.route = [{ x: c.x, z: c.z }]; return; }
          }
          m.peek = true; m.phaseT = rand(0.9, 1.8); m.burst = Math.round(rand(...FIRE[m.weapon].burst)); m.fireT = rand(0.15, 0.35);
        }
      }
    }
  }

  shoot(m, tx, tz, near) {
    // muzzle position from the posed weapon
    this.muzzle(m, _v);
    const dx = tx - _v.x, dz = tz - _v.z, d = Math.hypot(dx, dz) || 1;
    if (near) {
      G.fx.fire.emit(_v.x, _v.y, _v.z, dx / d * 2, 0.2, dz / d * 2, 0.28, 0.05);
      G.fx.spark.emit(_v.x, _v.y, _v.z, dx / d * 45 + rand(-2, 2), rand(-1, 1.5), dz / d * 45 + rand(-2, 2), 0.1, 0.18, 4, 3, 1.4, 1);
      if (this.shotBudget >= 1) { this.shotBudget--; sfx.gunshot(_v.x, _v.z, 1); }
      if (Math.random() < 0.35) G.fx.dust(tx + rand(-0.6, 0.6), 0.25, tz + rand(-0.3, 0.3), 0.25);
    }
    const t = m.target;
    const f = this.fight;
    if (t && f && t.state !== 'down' && (f.down[t.side] || 0) < MAX_DOWN && Math.random() < FIRE[m.weapon].hit * (t.peek ? 1 : 0.25)) { f.down[t.side] = (f.down[t.side] || 0) + 1; this.hit(t); }
  }
  hit(t) {
    t.state = 'down'; t.route = null; t.peek = false; t.recover = null; t.downH = t.h + rand(-0.6, 0.6);
    if (t.cover) { t.cover.used = null; t.cover = null; }
    // the rest of the group closes ranks; nearby groups on that side come to help
    for (const g of this.groups) if (g.side === t.side && Math.abs(g.post.x - t.x) < 18) this.engage(g);
    if (this.fight) {
      this.fight.t = Math.max(this.fight.t, 8);
      if (!this.fight.reported && G.emergency) { this.fight.reported = true; G.emergency.report(t.x, this.border.z, 1.4); this.inc = G.emergency.incidents[G.emergency.incidents.length - 1]; }
    }
  }

  // the player's weapons: people caught in it go down; a blast in the zone sets off a fight
  onBlast(x, y, z, r, power, kind) {
    const Zb = this.zones.blue, Zr = this.zones.red;
    const inArea = x > Zb.x0 - 8 && x < Zb.x1 + 8 && z > Zb.z0 - 8 && z < Zr.z1 + 8;
    if (!inArea || kind === 'collapse') return;
    const kill = kind === 'wind' ? r * 0.55 : r * 0.3;
    for (const m of this.members) if (m.state !== 'down' && Math.hypot(m.x - x, m.z - z) < kill && power > 1.5) this.hit(m);
    if (!this.fight && power > 0.5) this.startFight(null, x);
  }

  // ---------- posing into the instanced meshes ----------
  base(m) {
    const down = m.state === 'down';
    const y = down ? 0.05 : -m.crouch * 0.1 + (m.moving ? Math.abs(Math.sin(m.run)) * 0.02 : 0);
    _e.set(down ? Math.PI / 2 : 0, down ? m.downH : m.h, 0, 'YXZ');
    return _b.compose(_v.set(m.x, y, m.z), _q.setFromEuler(_e), _s.setScalar(SCALE));
  }
  limb(mesh, idx, px, py, rx, rz = 0) {
    _l.makeRotationFromEuler(_e.set(rx, 0, rz)); _l.setPosition(px, py, 0);
    mesh.setMatrixAt(idx, _m.multiplyMatrices(_b, _l));
    return _m;
  }
  armAngles(m) {
    const rifle = m.weapon !== 'pistol', a = m.aim;
    const idleR = m.moving ? -Math.sin(m.run) * 0.5 : (rifle ? -0.45 : -0.1), idleL = m.moving ? Math.sin(m.run) * 0.5 : (rifle ? -0.75 : Math.sin(G.time * 2 + m.idleA) * 0.1);
    return { r: idleR + (-1.52 - idleR) * a, l: idleL + ((rifle ? -1.35 : -0.2) - idleL) * a, lz: rifle ? 0.45 * Math.max(a, 0.6) : 0 };
  }
  pose(m) {
    const I = this.I, i = m.i;
    this.base(m);
    for (const k of ['torso', 'head']) I[k].setMatrixAt(i, _b);
    I.cap.setMatrixAt(i, m.headwear === 'cap' || m.headwear === 'capblack' ? _b : ZERO);
    I.wrap.setMatrixAt(i, m.headwear === 'wrap' ? _b : ZERO);
    I.scarf.setMatrixAt(i, m.scarf ? _b : ZERO);
    I.hood.setMatrixAt(i, m.hood && m.headwear !== 'wrap' ? _b : ZERO);
    const r = m.moving ? Math.sin(m.run) : 0, kneel = m.state === 'down' ? 0 : m.crouch;
    this.limb(I.leg, i * 2, -0.035, 0.31, r * 0.8 - kneel * 1.1);
    this.limb(I.leg, i * 2 + 1, 0.035, 0.31, -r * 0.8 - kneel * 0.3);
    const A = this.armAngles(m);
    this.limb(I.arm, i * 2, -0.088, 0.55, A.l, -A.lz);
    const hand = this.limb(I.arm, i * 2 + 1, 0.088, 0.55, A.r, 0);
    // the weapon sits in the right hand, pointing down the arm
    for (const k of WEAPONS) {
      if (k !== m.weapon || m.state === 'down') { this.W[k].setMatrixAt(i, ZERO); continue; }
      _r.makeRotationX(Math.PI / 2); _r.setPosition(0, -0.24, 0.01);
      this.W[k].setMatrixAt(i, _l.multiplyMatrices(hand, _r));
    }
  }
  muzzle(m, out) {
    this.base(m);
    const A = this.armAngles(m);
    _l.makeRotationFromEuler(_e.set(A.r, 0, 0)); _l.setPosition(0.088, 0.55, 0);
    _m.multiplyMatrices(_b, _l);
    _r.makeRotationX(Math.PI / 2); _r.setPosition(0, -0.24, 0.01);
    _m.multiply(_r);
    return out.set(0, 0.03, m.weapon === 'pistol' ? 0.08 : 0.28).applyMatrix4(_m);
  }
}

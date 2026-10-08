// Police headquarters dressing: the POLICE sign and badge over the doors, flags out front, the gate booth with a
// barrier arm, concrete barriers and bollards along the street, floodlights. The building is an ordinary
// destructible building (maps.js); the officers guarding it are in responders.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './core.js';

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
function star(x, cx, cy, r, n = 5, inner = 0.45) {
  x.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * inner : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fill();
}

// each city's station, in its own language, flying its own flag
const LOCALE = {
  downtown: { name: 'SAN DIEGO POLICE', sub: 'STATION', flag: 'us' },
  suburbs: { name: 'CHICAGO POLICE', sub: 'STATION', flag: 'us' },
  tropical: { name: 'POLICÍA · LA PLAYA', sub: 'ESTACIÓN DE POLICÍA', flag: 'mx' },
  vegas: { name: 'LAS VEGAS METRO POLICE', sub: 'STATION', flag: 'us' },
  london: { name: 'METROPOLITAN POLICE', sub: 'POLICE STATION', flag: 'uk' },
};

export class Station {
  constructor(scene, hq, mapName = 'downtown') {
    this.hq = hq;
    const L = LOCALE[mapName] || LOCALE.downtown;
    const P = [], { bx, bz, bd, bw, front, lot, block: b } = hq;
    // sign band + badge over the doors
    const sign = canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = '#16244a'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#d9b44a'; x.fillRect(0, h - 8, w, 8);
      x.fillStyle = '#d9b44a'; star(x, h * 0.55, h * 0.48, h * 0.34, 7, 0.55);
      // city name, shrunk to fit the band
      const room = w - h * 1.25 - 12;
      let size = h * 0.46;
      x.font = `800 ${size}px Inter, Arial, sans-serif`;
      while (x.measureText(L.name).width > room && size > 12) { size -= 1; x.font = `800 ${size}px Inter, Arial, sans-serif`; }
      x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'left';
      x.fillText(L.name, h * 1.1, h * 0.44);
      x.font = `600 ${h * 0.18}px Inter, Arial, sans-serif`; x.fillStyle = '#c9d4ea'; x.fillText(L.sub, h * 1.12, h * 0.8);
    });
    const sm = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.6 });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(7, bw * 0.55), 1.3), sm); s.position.set(bx, 2.35, front + 0.02); scene.add(s);
    this.signMat = sm;
    // door canopy and steps
    P.push(box(4.4, 0.12, 1.4, bx, 1.55, front + 0.7, 0xd8dbe0), box(0.12, 1.55, 0.12, bx - 2.1, 0.78, front + 1.35, 0x2f3338), box(0.12, 1.55, 0.12, bx + 2.1, 0.78, front + 1.35, 0x2f3338));
    P.push(box(3.2, 0.08, 0.5, bx, 0.04, front + 0.25, 0xbab6ae), box(3.2, 0.04, 0.4, bx, 0.1, front + 0.2, 0xc6c2ba));
    // flags: stars & stripes and a blue police flag
    const national = L.flag === 'mx' ? this.mexico() : L.flag === 'uk' ? canvasTex(96, 54, (x, w, h) => {
      x.fillStyle = '#012169'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke();
      x.strokeStyle = '#c8102e'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke();
      x.fillStyle = '#fff'; x.fillRect(w / 2 - 9, 0, 18, h); x.fillRect(0, h / 2 - 9, w, 18);
      x.fillStyle = '#c8102e'; x.fillRect(w / 2 - 5.5, 0, 11, h); x.fillRect(0, h / 2 - 5.5, w, 11);
    }) : canvasTex(96, 54, (x, w, h) => {
      for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#fff' : '#b22234'; x.fillRect(0, i * h / 13, w, h / 13 + 1); }
      x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, w * 0.4, h * 0.54); x.fillStyle = '#fff';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) x.fillRect(3 + c * 7, 3 + r * 7, 2, 2);
    });
    const pd = canvasTex(96, 54, (x, w, h) => { x.fillStyle = '#16244a'; x.fillRect(0, 0, w, h); x.fillStyle = '#d9b44a'; star(x, w / 2, h / 2, h * 0.34, 7, 0.55); x.fillStyle = '#fff'; x.fillRect(0, h * 0.44, w * 0.3, h * 0.12); x.fillRect(w * 0.7, h * 0.44, w * 0.3, h * 0.12); });
    this.flags = [];
    [[bx - 3.4, national], [bx + 3.4, pd]].forEach(([fx, tex]) => {
      P.push(tint(new THREE.CylinderGeometry(0.03, 0.04, 4.2, 6).translate(fx, 2.1, front + 1.9), 0xc0c4c8));
      const geo = new THREE.PlaneGeometry(1.1, 0.62, 8, 1).translate(0.55, 0, 0);
      const f = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      f.position.set(fx, 3.8, front + 1.9); scene.add(f);
      this.flags.push({ geo, base: geo.attributes.position.array.slice(), ph: fx });
    });
    // gate booth + barrier arm on the drive, concrete barriers and bollards along the street edge
    const gz = b.lz1 - 0.3;
    P.push(box(0.9, 1.1, 0.9, bx + 1.8, 0.55, gz - 0.2, 0xd8dbe0), box(1, 0.08, 1, bx + 1.8, 1.14, gz - 0.2, 0x16244a), box(0.8, 0.4, 0.02, bx + 1.8, 0.75, gz + 0.26, 0x2a4260));
    P.push(box(2.6, 0.06, 0.06, bx - 0.1, 0.62, gz + 0.1, 0xe8e8e0), box(0.12, 0.62, 0.12, bx + 1.2, 0.31, gz + 0.1, 0x2f3338));
    for (let x = b.lx0 + 0.6; x < b.lx1 - 0.4; x += 1.7) if (Math.abs(x - bx) > 2.2) P.push(box(1.3, 0.42, 0.34, x, 0.21, b.lz1 + 0.25, 0xb8b4ac), box(1.3, 0.1, 0.44, x, 0.05, b.lz1 + 0.25, 0xa8a49c));
    for (let z = b.lz0 + 0.8; z < b.lz1; z += 1.2) for (const x of [b.lx0 - 0.2, b.lx1 + 0.2]) P.push(tint(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 6).translate(x, 0.21, z), 0x2f3338));
    // floodlights on the corners of the lot
    this.lamps = [];
    for (const [x, z] of [[lot.x0, lot.z0 - 0.3], [lot.x1, lot.z0 - 0.3]]) { P.push(box(0.08, 4, 0.08, x, 2, z, 0x2f3338), box(0.7, 0.2, 0.3, x, 4, z + 0.1, 0x2b2e33)); this.lamps.push([x, 3.88, z + 0.26]); }
    const m = new THREE.Mesh(mergeGeometries(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    m.castShadow = m.receiveShadow = true; scene.add(m);
    this.lampFace = new THREE.Mesh(mergeGeometries(this.lamps.map(([x, y, z]) => new THREE.PlaneGeometry(0.6, 0.18).rotateX(-0.6).translate(x, y, z))), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    scene.add(this.lampFace);
  }
  // the Mexican flag from assets (drawn in as soon as it loads; plain tricolour until then)
  mexico() {
    const t = canvasTex(96, 54, (x, w, h) => { for (const [i, c] of [[0, '#006847'], [1, '#ffffff'], [2, '#ce1126']]) { x.fillStyle = c; x.fillRect(i * w / 3, 0, w / 3 + 1, h); } });
    const img = new Image();
    img.onload = () => { const c = t.image, x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); t.needsUpdate = true; };
    img.src = 'assets/flag-mexico.png';
    return t;
  }
  update() {
    const n = G.night || 0;
    this.signMat.emissiveIntensity = 0.2 + n * 1.2;
    this.lampFace.material.color.setScalar(0.6 + n * 3);
    const near = Math.hypot(this.hq.x - G.camTarget.x, this.hq.z - G.camTarget.z) < 70;
    if (near) for (const f of this.flags) {
      const a = f.geo.attributes.position, b = f.base;
      for (let v = 0; v < a.count; v++) { const x = b[v * 3]; a.array[v * 3 + 2] = b[v * 3 + 2] + Math.sin(G.time * 5 + f.ph + x * 8) * 0.05 * x; }
      a.needsUpdate = true;
    }
  }
}

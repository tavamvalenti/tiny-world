// City identity: storefront signs, rooftop billboards, bus shelters, directional and landmark signs.
// Everything is drawn into canvas atlases and rendered with a few instanced meshes; signs glow at night.
import * as THREE from 'three';
import { G, rand, pick } from './core.js';

const NAMES = {
  downtown: [
    ['HARBOR BANK', '#0f3b5c', '#f2e6c8'], ['GASLAMP GRILL', '#2b1a12', '#f7b24a'], ['QUIKMART', '#c8102e', '#ffffff'], ['BLUE LINE CAFE', '#1d4e89', '#f4f1e8'],
    ['MORENO DRUGS', '#ffffff', '#c8102e'], ['CORNER DELI', '#1f5130', '#f5e7b8'], ['PIER 9 TAVERN', '#141414', '#e8c170'], ['UNION HOTEL', '#3a1f2b', '#f0d9a0'],
    ['CITY SHOES', '#f2c230', '#1a1a1a'], ['LUCKY NOODLE', '#b3120f', '#ffd24a'], ['5TH AVE PIZZA', '#0e6b3a', '#ffffff'], ['METRO BOOKS', '#f1ede4', '#20304a'],
    ['FIRST PACIFIC', '#10243f', '#9fd0ff'], ['STARLIGHT', '#1a1030', '#ff5ab4'], ['EL FAROLITO', '#e25b1c', '#fff4d6'], ['COPPER KETTLE', '#6b3a1f', '#f4d29c'],
  ],
  tropical: [
    ['LA PLAYA HOTEL', '#f4f1e8', '#0e7c86'], ['SURF SHACK', '#0e9fb0', '#fff7d6'], ['TACOS EL MAR', '#e8b320', '#7a1e10'], ['COCO BEACH BAR', '#1f6b52', '#ffe7a8'],
    ['SUNSET RENTALS', '#f07a3a', '#ffffff'], ['MARISCOS LUNA', '#1a3a6b', '#ffd98a'], ['PALM MOTEL', '#f7d9e3', '#d03a6a'], ['HELADOS', '#ff9fc3', '#6b1f3a'],
    ['BAIT & TACKLE', '#2b2b2b', '#f5c400'], ['CASA AZUL', '#1f63b8', '#ffffff'], ['SEA BREEZE INN', '#dff3f1', '#0c6c74'], ['OCEAN MART', '#c8102e', '#ffffff'],
    ['FARMACIA', '#0d7a3a', '#ffffff'], ['PESCADERIA', '#0b4a6f', '#e8f4ff'], ['LA CANTINA', '#6b1a10', '#ffcf6a'], ['DIVE SHOP', '#f5c400', '#0b2d4a'],
  ],
  vegas: [
    ['SLOTS', '#1a0f2e', '#ffd34a'], ['24 HR WEDDING CHAPEL', '#ffffff', '#d81b60'], ['BUFFET', '#b3120f', '#ffe08a'], ['PAWN', '#101010', '#ffcc00'],
    ['ABC STORE', '#0e4c92', '#ffffff'], ['CASINO', '#2a0a3a', '#ff4fc8'], ['SHOW TICKETS', '#111111', '#3ad0ff'], ['STEAKHOUSE', '#2b1a12', '#f2c879'],
    ['LIQUOR', '#0e5a2a', '#ffffff'], ['NIGHT CLUB', '#05050a', '#c86bff'], ['GIFT SHOP', '#ffe9f2', '#c2185b'], ['MOTEL', '#ff3b3b', '#ffffff'],
    ['TATTOO', '#141414', '#ff5252'], ['SPORTSBOOK', '#0d2b52', '#7cf0ff'], ['ICE CREAM', '#ffd1e3', '#6b1f3a'], ['GENTLEMEN\'S CLUB', '#0a0a10', '#ff3fa4'],
  ],
  london: [
    ['THE RED LION', '#5a1414', '#f2d27a'], ['TESCO EXPRESS', '#ffffff', '#00539f'], ['PRET', '#7a0019', '#ffffff'], ['BOOTS', '#05509e', '#ffffff'],
    ['THE CROWN', '#0f2a1d', '#e8c060'], ['FISH & CHIPS', '#0e3d6b', '#ffffff'], ['NEWSAGENT', '#1d1d1d', '#f2e6c8'], ['CAFFE NERO', '#0e2b4a', '#ffffff'],
    ['THE GEORGE', '#1a1a2a', '#e8d38a'], ['BARCLAYS', '#00aeef', '#ffffff'], ['GREGGS', '#00488d', '#fbb800'], ['THE KINGS ARMS', '#3a1f10', '#f0c674'],
    ['WH SMITH', '#003b5c', '#ffffff'], ['BOOKSHOP', '#20304a', '#f1ede4'], ['KEBAB', '#b3120f', '#ffe08a'], ['OFF LICENCE', '#123a1e', '#f5e7b8'],
  ],
  suburbs: [
    ['SOUTH SIDE SAVINGS', '#12324f', '#e9dcb8'], ['QUIKMART', '#c8102e', '#ffffff'], ['FUELCO', '#f5c400', '#b3120f'], ['MAPLE DENTAL', '#ffffff', '#2c6b4f'],
    ['PIZZA PALACE', '#b3120f', '#fff1c1'], ['HAIR BY ANNA', '#f7e6ee', '#8a2455'], ['PRESTO CLEANERS', '#1d4e89', '#ffffff'], ['PET WORLD', '#f28c28', '#ffffff'],
    ['DAYSTOP MARKET', '#1f6b3a', '#ffffff'], ['WINDY CITY HARDWARE', '#8a1c1c', '#f2e2b0'], ['SUNNY DINER', '#f2c230', '#1d3a6b'], ['BOOK NOOK', '#3b2a1a', '#f2d9a0'],
    ['FLOWER BOX', '#f5f0e6', '#c43b6a'], ['TAE KWON DO', '#101010', '#ff3b30'], ['YOGURT BAR', '#b6e3f5', '#1b4f72'], ['POST OFFICE', '#223a70', '#ffffff'],
  ],
};
// rooftop and bus-shelter ads: the shared set, and each city's own
const ADS_BY_MAP = {
  vegas: [['LOOSEST SLOTS', 'On the Strip', '#1a0030', '#ff3bd4'], ['MAGIC OF MARCO', 'Nightly 7 & 9:30', '#120a2a', '#ffd34a'], ['CALL BIG TONY', 'Hurt? 702-555-0142', '#0d1b3d', '#ffd200'], ['BUFFET OF THE GODS', 'All you can eat', '#fffbe6', '#7a2a00'],
    ['GOLDEN OAK', 'Kentucky whiskey', '#0a0a0a', '#e8c46a'], ['CIRQUE AURORA', 'An aerial spectacle', '#03121f', '#9fe8ff'], ['ELVIS WEDDINGS', '24/7 drive-thru', '#fbe9f2', '#c2185b'], ['WE BUY GOLD', 'Cash on the spot', '#0b2a14', '#ffd84a']],
  london: [['THE TIMES', 'Read all about it', '#f4f4f0', '#111111'], ['OYSTER CARD', 'Touch in, touch out', '#0019a8', '#ffffff'], ['WEST END TONIGHT', 'Theatre tickets', '#2a0a3a', '#ffe680'], ['EARL GREY TEA', 'Proper tea.', '#123a1e', '#f5e7b8'],
    ['LONDON EYE', 'Book your flight', '#0e2b4a', '#ffffff'], ['FISH & CHIPS', 'Fresh every day', '#0e3d6b', '#ffd34a'], ['PREMIER FOOTBALL', 'Saturday 3pm', '#3a0a5a', '#7cf0ff'], ['BLACK CAB', 'Hail one anytime', '#101012', '#f2d27a']],
};
let ADS = [];
const ADS_DEFAULT = [
  ['SUNNY COLA', 'Taste the sun.', '#d7261e', '#ffffff'], ['VOLTA MOTORS', 'The electric city car.', '#101820', '#5ce1e6'],
  ['FLY PACIFICA', 'Daily flights to paradise', '#0b62a4', '#ffffff'], ['SOUTH SIDE SAVINGS', 'Your neighborhood bank', '#12324f', '#f2d27a'],
  ['KOAST 98.1 FM', 'Surf rock all day', '#f28c28', '#1a1a1a'], ['NOVA PHONE X', 'See more.', '#f4f4f4', '#111111'],
  ['MIDNIGHT BURGER', 'Open late', '#1c1c1c', '#ffcc00'], ['PADRES BASEBALL', 'Tonight 7:10 · Petco Park', '#2f241d', '#ffc425'],
];

const STRIP3_DEFAULT = '←  HARBOR DR        CITY CENTER  ↑        I-5 NORTH  →';
let STRIP3 = STRIP3_DEFAULT;
function signAtlas(list) {
  const W = 1024, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  list.forEach(([name, bg, fg], i) => {
    const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 64;
    x.fillStyle = bg; x.fillRect(cx, cy, 256, 64);
    x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 3; x.strokeRect(cx + 5, cy + 5, 246, 54); x.globalAlpha = 1;
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 34; x.font = `800 ${size}px Inter, Helvetica, Arial, sans-serif`;
    while (x.measureText(name).width > 226 && size > 12) { size -= 2; x.font = `800 ${size}px Inter, Helvetica, Arial, sans-serif`; }
    x.fillText(name, cx + 128, cy + 34);
  });
  // row 4+: ads, 512x128 each
  ADS.forEach(([t1, t2, bg, fg], i) => {
    const cx = (i % 2) * 512, cy = 256 + Math.floor(i / 2) * 128;
    const g = x.createLinearGradient(cx, cy, cx + 512, cy + 128);
    g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -30));
    x.fillStyle = g; x.fillRect(cx, cy, 512, 128);
    x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.font = '900 52px Inter, Helvetica, Arial, sans-serif'; x.fillText(t1, cx + 26, cy + 70);
    x.font = '500 24px Inter, Helvetica, Arial, sans-serif'; x.globalAlpha = 0.85; x.fillText(t2, cx + 28, cy + 104); x.globalAlpha = 1;
    x.beginPath(); x.arc(cx + 452, cy + 64, 36, 0, 6.283); x.fillStyle = shade(fg, 0); x.globalAlpha = 0.25; x.fill(); x.globalAlpha = 1;
  });
  // landmark + directional sign strips (row at y=768, 1024x64 each)
  const strips = [['GASLAMP DISTRICT', '#0e2a1c', '#f2d27a'], ['WELCOME TO LA PLAYA', '#0e6f7c', '#fff4d6'], ['CHICAGO  ·  EST. 1837', '#3b2a1a', '#f2e2b0'], [STRIP3, '#0f5a2e', '#ffffff']];
  strips.forEach(([t, bg, fg], i) => {
    const cy = 768 + i * 64;
    x.fillStyle = bg; x.fillRect(0, cy, 1024, 64);
    x.strokeStyle = fg; x.lineWidth = 4; x.strokeRect(6, cy + 6, 1012, 52);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 40px Inter, Helvetica, Arial, sans-serif'; x.fillText(t, 512, cy + 34);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt)), b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// Instanced quads that each show a different rectangle of the atlas (per-instance UV transform).
function atlasMesh(tex, count, emissive = true) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const uvT = new Float32Array(count * 4);
  geo.setAttribute('aUvT', new THREE.InstancedBufferAttribute(uvT, 4));
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: emissive ? tex : null, emissive: emissive ? 0xffffff : 0x000000, emissiveIntensity: 0.1, roughness: 0.55, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aUvT;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aUvT.xy + uv * aUvT.zw;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv = aUvT.xy + uv * aUvT.zw;\n#endif');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
  mesh.count = 0;
  mesh.castShadow = true;
  return { mesh, uvT };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class Signs {
  constructor(scene, mapName, B, city) {
    this.city = city;
    const list = NAMES[mapName];
    ADS = ADS_BY_MAP[mapName] || ADS_DEFAULT;
    STRIP3 = { vegas: '←  FLAMINGO RD        THE STRIP  ↑        I-15  →', london: '←  WESTMINSTER        THE CITY  ↑        A4  →' }[mapName] || STRIP3_DEFAULT;
    const tex = signAtlas(list);
    const shop = atlasMesh(tex, 700), post = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.6, metalness: 0.5 }), 900);
    post.count = 0; post.castShadow = true;
    this.shop = shop; this.post = post; this.tex = tex;
    const add = (obj, x, y, z, rot, w, h, uv) => {
      const i = obj.mesh.count++;
      _q.setFromAxisAngle(UP, rot);
      _m.compose(_p.set(x, y, z), _q, _s.set(w, h, 1));
      obj.mesh.setMatrixAt(i, _m);
      obj.uvT.set(uv, i * 4);
      return { mesh: obj.mesh, idx: i, x, y, z };
    };
    const box = (x, y, z, w, h, d, rot = 0, cell = null) => {
      const i = post.count++;
      _q.setFromAxisAngle(UP, rot);
      _m.compose(_p.set(x, y, z), _q, _s.set(w, h, d));
      post.setMatrixAt(i, _m);
      const pr = { mesh: post, idx: i, x, y, z };
      if (cell) (cell.props ||= []).push(pr);
      return pr;
    };
    // uv rect helpers (canvas y grows down, texture v grows up)
    const nameUV = (k) => [(k % 4) / 4, 1 - (Math.floor(k / 4) + 1) * 64 / 1024, 1 / 4, 64 / 1024];
    const adUV = (k) => [(k % 2) / 2, 1 - (256 + (Math.floor(k / 2) + 1) * 128) / 1024, 1 / 2, 128 / 1024];
    const stripUV = (k) => [0, 1 - (768 + (k + 1) * 64) / 1024, 1, 64 / 1024];

    // nearest street for a point: used to pick the facade that faces the road
    const roadDist = (x, z) => Math.min(...city.xs.map((v) => Math.abs(x - v)), ...city.zs.map((v) => Math.abs(z - v)));

    // ---- storefront signs ----
    let k = 0;
    for (const b of B.list) {
      if (b.style === 'house' || b.gable || !b.grid[0] || b.noSigns) continue;
      if (Math.max(b.w, b.d) < 2.6 || b.nx * b.nz > 120) continue;
      if (Math.random() > (mapName === 'suburbs' ? 0.9 : 0.75)) continue;
      const sides = [
        { nx: 0, nz: 1, x: b.x, z: b.z + b.d / 2, len: b.w, rot: 0 }, { nx: 0, nz: -1, x: b.x, z: b.z - b.d / 2, len: b.w, rot: Math.PI },
        { nx: 1, nz: 0, x: b.x + b.w / 2, z: b.z, len: b.d, rot: Math.PI / 2 }, { nx: -1, nz: 0, x: b.x - b.w / 2, z: b.z, len: b.d, rot: -Math.PI / 2 },
      ].sort((a, c) => roadDist(a.x + a.nx * 2, a.z + a.nz * 2) - roadDist(c.x + c.nx * 2, c.z + c.nz * 2));
      const sd = sides[0];
      const g = b.grid[0], gh = g[0][0] ? g[0][0].hy * 2 : 1.3;
      const cell = sd.nz ? g[Math.floor(b.nx / 2)][sd.nz > 0 ? b.nz - 1 : 0] : g[sd.nx > 0 ? b.nx - 1 : 0][Math.floor(b.nz / 2)];
      if (!cell) continue;
      const w = Math.min(sd.len * 0.85, 3.4), h = w / 4;
      const pr = add(shop, sd.x + sd.nx * 0.04, gh * 0.83, sd.z + sd.nz * 0.04, sd.rot, w, Math.min(h, 0.5), nameUV(k++ % list.length));
      (cell.props ||= []).push(pr);
      // occasional projecting blade sign on taller brick buildings (old downtown look)
      if (mapName === 'downtown' && b.floors > 4 && Math.random() < 0.35) {
        const up = cell.b.grid[Math.min(2, b.floors - 1)];
        const bx = sd.x + sd.nx * 0.45 + (sd.nz ? rand(-sd.len / 3, sd.len / 3) : 0), bz = sd.z + sd.nz * 0.45 + (sd.nx ? rand(-sd.len / 3, sd.len / 3) : 0);
        const pr2 = add(shop, bx, gh + 1.6, bz, sd.rot + Math.PI / 2, 0.8, 2.4, nameUV(k++ % list.length));
        (cell.props ||= []).push(pr2);
      }
    }

    // ---- rooftop billboards ----
    const ads = atlasMesh(tex, 80);
    this.ads = ads;
    let n = 0;
    for (const b of B.list) {
      if (b.gable || b.style === 'house' || b.noSigns || n >= 40) continue;
      if (b.floors < (mapName === 'suburbs' ? 1 : 3) || b.floors > 14 || b.w < 3.5) continue;
      if (Math.random() > (mapName === 'downtown' ? 0.22 : 0.12)) continue;
      const top = b.cells.filter((c) => c.topExposed && c.f === b.floors - 1);
      if (!top.length) continue;
      const c = top[Math.floor(top.length / 2)];
      const y0 = c.y + c.hy;
      // face the viewer's side of the block and the nearest street
      const rot = pick([0, 0, Math.PI / 2, -Math.PI / 2]);
      const W = Math.min(4.2, Math.max(b.w, b.d) * 0.9), H = W / 4;
      add(ads, c.x, y0 + 0.9 + H / 2, c.z, rot, W, H, adUV(n % ADS.length));
      c.props ||= [];
      c.props.push({ mesh: ads.mesh, idx: ads.mesh.count - 1, x: c.x, y: y0 + 1, z: c.z });
      for (const s of [-1, 1]) box(c.x + Math.cos(rot) * s * W * 0.35, y0 + 0.55, c.z - Math.sin(rot) * s * W * 0.35, 0.07, 1.1, 0.07, rot, c);
      box(c.x, y0 + 0.9, c.z, W, 0.06, 0.1, rot, c);
      n++;
    }

    // ---- bus shelters + transit signs (with people waiting) ----
    const shelters = mapName === 'suburbs' ? 3 : 10;
    const blocks = city.blocks.filter((b) => !b.closed).sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(shelters, blocks.length); i++) {
      const bl = blocks[i];
      const onZ = Math.random() < 0.5;
      const x = onZ ? rand(bl.x0 + 4, bl.x1 - 4) : bl.x1 - 0.55, z = onZ ? bl.z1 - 0.55 : rand(bl.z0 + 4, bl.z1 - 4);
      const rot = onZ ? 0 : Math.PI / 2;
      box(x, 0.95, z, 1.8, 0.05, 0.7, rot);                                  // roof
      box(x - (onZ ? 0 : 0.3), 0.5, z - (onZ ? 0.3 : 0), onZ ? 1.8 : 0.03, 0.9, onZ ? 0.03 : 1.8, 0); // back panel
      add(shop, x + (onZ ? 0.95 : 0), 0.55, z + (onZ ? 0 : 0.95), rot + Math.PI / 2, 0.6, 0.8, adUV(i % ADS.length));
      box(x + (onZ ? -1.3 : 0), 0.7, z + (onZ ? 0 : -1.3), 0.04, 1.4, 0.04);
      (city.crowdsLate ||= []).push({ x: x - (onZ ? 0 : 0.2), z: z - (onZ ? 0.2 : 0), r: 0.6, n: Math.round(rand(2, 5)) });
    }

    // ---- landmark sign + a directional gantry ----
    const B0 = city.blocks.find((b) => b.i === 2 && b.j === 2) || city.blocks[0];
    if (mapName === 'downtown') {
      // arch over the street, the district's postcard shot
      const x = (B0.x0 + B0.x1) / 2, z = B0.z1 + city.roadW / 2, span = city.roadW + 1.2;
      box(x - span / 2, 1.6, z, 0.18, 3.2, 0.18); box(x + span / 2, 1.6, z, 0.18, 3.2, 0.18);
      box(x, 3.25, z, span + 0.3, 0.12, 0.14);
      const s1 = add(shop, x, 3.65, z, Math.PI / 2 - Math.PI / 2, span, span / 16 * 1.4, stripUV(0));
      this.landmark = s1;
      // lamps along the arch
      for (let t = -0.4; t <= 0.4; t += 0.2) box(x + t * span, 3.18, z, 0.08, 0.08, 0.08);
    } else if (mapName === 'tropical') {
      const x = 0, z = -13 + city.roadW / 2 + 0.3, span = 7;
      box(x - span / 2, 1.8, z, 0.3, 3.6, 0.3); box(x + span / 2, 1.8, z, 0.3, 3.6, 0.3);
      add(shop, x, 3.4, z, 0, span, span / 16 * 1.5, stripUV(1));
    } else if (mapName === 'suburbs') {
      const x = B0.x0 + 2.5, z = B0.z1 - 1.2;
      box(x, 0.3, z, 3.6, 0.6, 0.5);
      add(shop, x, 0.95, z + 0.01, 0, 3.4, 0.45, stripUV(2));
    }
    // ---- skyline landmark: crown, spire and aircraft beacon on the supertall ----
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.glow = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMat, 64); this.glow.count = 0; this.glowKinds = [];
    const glowBox = (x, y, z, w, h, d, kind, cell) => {
      const i = this.glow.count++;
      _m.compose(_p.set(x, y, z), _q.identity(), _s.set(w, h, d));
      this.glow.setMatrixAt(i, _m);
      this.glowKinds.push(kind);
      if (cell) (cell.props ||= []).push({ mesh: this.glow, idx: i, x, y, z });
    };
    for (const t of city.towers || []) {
      const top = t.cells.filter((c) => c.f === t.floors - 1);
      if (!top.length) continue;
      let ax = 1e9, bx = -1e9, az = 1e9, bz = -1e9;
      for (const c of top) { ax = Math.min(ax, c.x - c.hx); bx = Math.max(bx, c.x + c.hx); az = Math.min(az, c.z - c.hz); bz = Math.max(bz, c.z + c.hz); }
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, y0 = top[0].y + top[0].hy;
      const mid = top.reduce((a, c) => (Math.hypot(c.x - cx, c.z - cz) < Math.hypot(a.x - cx, a.z - cz) ? c : a));
      if (t.landmark) {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(Math.max(bx - ax, bz - az) * 0.72, 7, 4, 1).rotateY(Math.PI / 4).translate(0, 3.5, 0),
          new THREE.MeshStandardMaterial({ color: 0x9fb4c4, metalness: 0.8, roughness: 0.25, envMapIntensity: 1.3 }));
        crown.scale.set((bx - ax) / Math.max(bx - ax, bz - az), 1, (bz - az) / Math.max(bx - ax, bz - az));
        crown.position.set(cx, y0, cz); crown.castShadow = true;
        scene.add(crown);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 6, 6).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.9, roughness: 0.3 }));
        spire.position.set(cx, y0 + 7, cz); scene.add(spire);
        // the crown and spire come down with the top floor
        const hide = { mesh: null, idx: 0, x: cx, y: y0 + 3, z: cz, obj: [crown, spire] };
        (mid.props ||= []).push(hide);
        glowBox(cx, y0 + 13.1, cz, 0.22, 0.22, 0.22, 'beacon', mid);
        // floodlit crown edges at night
        for (const [ex, ez] of [[ax, az], [bx, az], [ax, bz], [bx, bz]]) glowBox(ex, y0 + 0.15, ez, 0.25, 0.25, 0.25, 'flood', mid);
      } else {
        for (const [ex, ez] of [[ax + 0.3, cz], [bx - 0.3, cz]]) glowBox(ex, y0 + 0.2, ez, 0.2, 0.2, 0.2, 'beacon', mid);
      }
    }
    this.glow.instanceMatrix.needsUpdate = true;
    this.glow.frustumCulled = false;
    scene.add(this.glow);

    // overhead directional sign on an entry road
    {
      const x = city.xs[Math.floor(city.xs.length / 2)], z = city.zs[city.zs.length - 1] - city.roadW / 2 - 4;
      const w = city.roadW + 1.6;
      box(x - w / 2, 1.9, z, 0.12, 3.8, 0.12); box(x + w / 2, 1.9, z, 0.12, 3.8, 0.12); box(x, 3.7, z, w, 0.1, 0.1);
      add(shop, x, 3.2, z + 0.06, 0, w * 0.95, 0.8, stripUV(3));
    }

    for (const o of [shop, ads]) {
      o.mesh.geometry.attributes.aUvT.needsUpdate = true;
      o.mesh.instanceMatrix.needsUpdate = true;
      scene.add(o.mesh);
    }
    post.instanceMatrix.needsUpdate = true;
    scene.add(post);
  }

  update() {
    const n = G.night || 0;
    if (this.glow) {
      const blink = Math.sin(G.time * 3.2) > 0.6;
      const c = new THREE.Color();
      this.glowKinds.forEach((k, i) => {
        if (k === 'beacon') c.setRGB(blink ? 6 : 0.3, 0.05, 0.03);
        else if (k === 'flood') c.setRGB(0.4 + n * 5, 0.4 + n * 4.6, 0.4 + n * 4);
        else c.setRGB(0.6 + n * 6, 0.6 + n * 6, 0.6 + n * 5.4);
        this.glow.setColorAt(i, c);
      });
      if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
    }
    // neon/backlit signage wakes up after dark
    this.shop.mesh.material.emissiveIntensity = 0.12 + n * 1.5;
    this.ads.mesh.material.emissiveIntensity = 0.1 + n * 1.2;
  }
}

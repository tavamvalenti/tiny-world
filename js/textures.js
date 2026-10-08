import * as THREE from 'three';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const noiseCache = {};
// Tileable grain pattern used to break up flat colors everywhere.
export function noisePattern(ctx, size = 128, strength = 28, key = 'n') {
  const k = key + size + strength;
  if (!noiseCache[k]) {
    const c = canvas(size, size), x = c.getContext('2d');
    const img = x.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 128 + (Math.random() - 0.5) * strength * 2;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    noiseCache[k] = c;
  }
  return ctx.createPattern(noiseCache[k], 'repeat');
}

export function grain(ctx, x, y, w, h, alpha = 0.12, size = 128, strength = 40) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = noisePattern(ctx, size, strength);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- Facade atlases ----------
// Each atlas is 256x512: top half = typical upper floor bay, bottom half = ground floor bay.
// A parallel mask canvas marks glass (white) so the shader can keep glass untinted and break it on damage.
const S = 256;

function glass(ctx, x, y, w, h, shade = 0) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, `rgb(${120 + shade},${140 + shade},${158 + shade})`);
  g.addColorStop(0.45, `rgb(${52 + shade},${64 + shade},${78 + shade})`);
  g.addColorStop(1, `rgb(${30 + shade},${36 + shade},${46 + shade})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // interior hints: blinds / lit rooms
  if (Math.random() < 0.5) {
    ctx.fillStyle = `rgba(230,220,200,${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(x, y, w, h * (0.15 + Math.random() * 0.5));
  }
}

function mk(draw) {
  const c = canvas(S, S * 2), m = canvas(S, S * 2);
  const ctx = c.getContext('2d'), mc = m.getContext('2d');
  mc.fillStyle = '#000'; mc.fillRect(0, 0, S, S * 2);
  const win = (x, y, w, h, shade) => { glass(ctx, x, y, w, h, shade); mc.fillStyle = '#fff'; mc.fillRect(x, y, w, h); };
  draw(ctx, win, mc);
  grain(ctx, 0, 0, S, S * 2, 0.18);
  return { map: tex(c), mask: tex(m, false) };
}

export function makeFacades() {
  const F = {};

  F.brick = mk((c, win) => {
    // warm brick; tinted per-building so keep near-neutral mid tones
    c.fillStyle = '#b9aca2'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += 8) {
      const off = (y / 8) % 2 ? 0 : 10;
      for (let x = -20; x < S; x += 20) {
        const v = 170 + Math.random() * 40;
        c.fillStyle = `rgb(${v},${v * 0.93},${v * 0.88})`;
        c.fillRect(x + off + 1, y + 1, 18, 6);
      }
    }
    // upper floor: two tall windows with stone lintels and sills
    for (const x of [34, 146]) {
      c.fillStyle = '#e8e2d6'; c.fillRect(x - 6, 30, 88, 12); c.fillRect(x - 4, 212, 84, 9);
      win(x, 42, 76, 170, 0);
      c.fillStyle = '#ddd5c8'; c.fillRect(x + 36, 42, 5, 170); c.fillRect(x, 120, 76, 5);
    }
    c.fillStyle = 'rgba(40,30,25,.35)'; c.fillRect(0, 248, S, 8); // cornice line
    // ground floor: storefront
    c.fillStyle = '#2d2b2a'; c.fillRect(0, S + 18, S, 40); // sign band
    c.fillStyle = `hsl(${Math.random() * 360},45%,55%)`; c.fillRect(30, S + 28, 120, 20);
    win(16, S + 70, 224, 170, 20);
    c.fillStyle = '#3a3634'; for (const x of [16, 90, 164, 236]) c.fillRect(x, S + 70, 5, 170);
    c.fillStyle = '#6d6259'; c.fillRect(0, S * 2 - 16, S, 16);
  });

  F.office = mk((c, win) => {
    c.fillStyle = '#cfd3d6'; c.fillRect(0, 0, S, S * 2);
    // ribbon glazing with mullions
    win(0, 60, S, 160, 10);
    c.fillStyle = '#9aa2a8'; for (let x = 0; x <= S; x += 64) c.fillRect(x - 3, 60, 6, 160);
    c.fillStyle = '#e3e6e8'; c.fillRect(0, 0, S, 60); c.fillRect(0, 220, S, 36);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 56, S, 4);
    // ground: tall lobby glass
    c.fillStyle = '#e3e6e8'; c.fillRect(0, S, S, S);
    win(0, S + 30, S, 210, 25);
    c.fillStyle = '#5b6168'; for (let x = 0; x <= S; x += 85) c.fillRect(x - 4, S + 30, 8, 210);
  });

  F.concrete = mk((c, win) => {
    c.fillStyle = '#c4c0b8'; c.fillRect(0, 0, S, S * 2);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2;
    c.strokeRect(1, 1, S - 2, S - 2);
    for (const x of [30, 140]) { win(x, 60, 86, 120, 0); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, 180, 86, 6); }
    c.fillStyle = '#8f8a82'; c.fillRect(0, S, S, S);
    win(20, S + 50, 216, 180, 15);
    c.fillStyle = '#4a4744'; c.fillRect(0, S + 20, S, 26);
  });

  F.stucco = mk((c, win) => {
    c.fillStyle = '#f2ede4'; c.fillRect(0, 0, S, S * 2);
    // balcony with railing + shutters
    for (const x of [40, 150]) {
      c.fillStyle = `hsl(${170 + Math.random() * 40},35%,45%)`;
      c.fillRect(x - 16, 50, 14, 150); c.fillRect(x + 68, 50, 14, 150);
      win(x, 50, 66, 150, 15);
    }
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(0, 196, S, 10);
    c.strokeStyle = 'rgba(60,60,60,.7)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 170); c.lineTo(S, 170); c.stroke();
    for (let x = 6; x < S; x += 14) { c.beginPath(); c.moveTo(x, 170); c.lineTo(x, 196); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 206, S, 6);
    // ground: café with awning
    win(18, S + 90, 220, 150, 25);
    c.fillStyle = `hsl(${Math.random() * 360},55%,50%)`;
    for (let x = 0; x < S; x += 32) { c.fillRect(x, S + 40, 16, 44); }
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let x = 16; x < S; x += 32) { c.fillRect(x, S + 40, 16, 44); }
  });

  F.house = mk((c, win) => {
    c.fillStyle = '#ece8df'; c.fillRect(0, 0, S, S * 2);
    c.fillStyle = 'rgba(0,0,0,.13)';
    for (let y = 0; y < S * 2; y += 12) c.fillRect(0, y, S, 2); // lap siding
    c.fillStyle = '#fafafa'; c.fillRect(66, 56, 124, 132);
    win(74, 64, 108, 116, 20);
    c.fillStyle = '#fafafa'; c.fillRect(126, 64, 4, 116); c.fillRect(74, 120, 108, 4);
    // ground: door + window
    c.fillStyle = '#fafafa'; c.fillRect(28, S + 80, 84, 176); c.fillRect(150, S + 80, 84, 100);
    c.fillStyle = `hsl(${Math.random() * 360},40%,35%)`; c.fillRect(36, S + 88, 68, 168);
    win(158, S + 88, 68, 84, 20);
  });

  // ---- Chicago: brick two/three-flats ----
  const commonBrick = (c) => {
    c.fillStyle = '#a89c90'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += 8) {
      const off = (y / 8) % 2 ? 0 : 10;
      for (let x = -20; x < S; x += 20) {
        const v = 150 + Math.random() * 55;
        c.fillStyle = `rgb(${v},${v * 0.9},${v * 0.82})`;
        c.fillRect(x + off + 1, y + 1, 18, 6);
      }
    }
    // grime: rain streaks and soot darkening toward the top of each floor
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * S, w = 3 + Math.random() * 10, y = Math.random() * S * 2;
      c.fillStyle = `rgba(40,32,26,${0.08 + Math.random() * 0.12})`; c.fillRect(x, y, w, 40 + Math.random() * 120);
    }
  };
  const flatWindows = (c, boarded, win) => {
    // upper floor: one tall double-hung window with limestone lintel + sill
    c.fillStyle = '#cfc6b4'; c.fillRect(70, 28, 116, 14); c.fillRect(72, 212, 112, 10);
    if (boarded) plywood(c, 82, 42, 92, 170);
    else {
      win(82, 42, 92, 170, -5);
      c.fillStyle = '#e2ddd2'; c.fillRect(82, 124, 92, 7); c.fillRect(82, 42, 92, 5); c.fillRect(82, 42, 5, 170); c.fillRect(169, 42, 5, 170);
      if (Math.random() < 0.5) { c.fillStyle = 'rgba(235,228,210,.75)'; c.fillRect(87, 47, 82, 20 + Math.random() * 50); } // blinds
    }
    c.fillStyle = 'rgba(30,24,20,.45)'; c.fillRect(0, 0, S, 6);
    // ground (garden unit): window above a limestone base with a small basement window
    c.fillStyle = '#b3aa98'; c.fillRect(0, S * 2 - 70, S, 70);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, S * 2 - 70, S, 5);
    c.fillStyle = '#cfc6b4'; c.fillRect(70, S + 34, 116, 14); c.fillRect(72, S + 196, 112, 10);
    if (boarded) { plywood(c, 82, S + 48, 92, 148); plywood(c, 96, S * 2 - 52, 64, 34); }
    else {
      win(82, S + 48, 92, 148, -8);
      c.fillStyle = '#e2ddd2'; c.fillRect(82, S + 118, 92, 6);
      c.fillStyle = '#1c1a18'; c.fillRect(96, S * 2 - 52, 64, 34);
      c.fillStyle = '#3a3633'; for (let x = 100; x < 160; x += 9) c.fillRect(x, S * 2 - 52, 3, 34); // security bars
    }
  };
  function plywood(c, x, y, w, h) {
    c.fillStyle = '#a8845a'; c.fillRect(x, y, w, h);
    for (let i = x; i < x + w; i += 4) { c.fillStyle = `rgba(90,62,34,${Math.random() * 0.25})`; c.fillRect(i, y, 2, h); }
    c.fillStyle = 'rgba(60,40,22,.55)'; c.fillRect(x + w / 2 - 1, y, 2, h); c.fillRect(x, y + h * 0.6, w, 2);
    c.fillStyle = 'rgba(40,30,20,.35)'; c.fillRect(x, y, w, 4); c.fillRect(x, y + h - 4, w, 4);
    if (Math.random() < 0.6) { // spray tag
      c.strokeStyle = pickTag(); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath();
      let px = x + 10, py = y + h * 0.4;
      c.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += w / 8; py += (Math.random() - 0.5) * h * 0.3; c.lineTo(px, py); }
      c.stroke();
    }
  }
  const pickTag = () => ['#2d63c8', '#d23a8a', '#e8e8e8', '#1b1b1b', '#3aa655'][Math.floor(Math.random() * 5)];

  F.flat = mk((c, win) => { commonBrick(c); flatWindows(c, false, win); });
  F.boarded = mk((c, win) => {
    commonBrick(c); flatWindows(c, true, win);
    c.fillStyle = 'rgba(20,16,14,.25)'; c.fillRect(0, 0, S, S * 2); // neglect
    c.strokeStyle = pickTag(); c.lineWidth = 7; c.beginPath(); c.moveTo(20, S * 2 - 110);
    for (let x = 20; x < 236; x += 18) c.lineTo(x, S * 2 - 110 + (Math.random() - 0.5) * 40);
    c.stroke();
  });
  // construction: bare concrete frame, empty dark openings (no glass, so nothing lights at night), rebar stubs
  F.site = mk((c) => {
    c.fillStyle = '#9d9a94'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += S) {
      c.fillStyle = '#b9b5ad'; c.fillRect(0, y, S, 26);                       // slab edge
      c.fillStyle = '#2a2826'; c.fillRect(18, y + 40, S - 36, S - 70);         // open bay
      c.fillStyle = '#8f8b84'; c.fillRect(S / 2 - 9, y + 40, 18, S - 70);      // column
      c.fillStyle = 'rgba(120,70,40,.7)'; for (let x = 10; x < S; x += 22) c.fillRect(x, y + 18, 3, 10);  // rebar
    }
    for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(60,55,50,${0.1 + Math.random() * 0.15})`; c.fillRect(Math.random() * S, Math.random() * S * 2, 4 + Math.random() * 14, 30 + Math.random() * 90); }
  });
  F.garage = mk((c) => {
    commonBrick(c);
    // roll-up garage door with horizontal panels, rust and a tag
    c.fillStyle = '#cfcac0'; c.fillRect(22, S + 60, 212, 196);
    for (let y = S + 60; y < S * 2; y += 28) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(22, y, 212, 3); }
    for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(120,70,30,${0.15 + Math.random() * 0.2})`; c.fillRect(22 + Math.random() * 200, S + 60 + Math.random() * 100, 4 + Math.random() * 10, 40 + Math.random() * 60); }
    c.fillStyle = '#6d6356'; c.fillRect(14, S + 48, 228, 12);
    if (Math.random() < 0.7) { c.strokeStyle = pickTag(); c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(50, S + 150); c.bezierCurveTo(90, S + 100, 130, S + 200, 200, S + 130); c.stroke(); }
  });

  // Gothic Revival stone (the Palace of Westminster, the Abbey, Tower Bridge): buttress ribs, panel tracery, two tall
  // pointed lancets per bay; pointed arches on the ground storey
  F.gothic = mk((c, win) => {
    c.fillStyle = '#e6dcc6'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += 14) { c.fillStyle = 'rgba(0,0,0,.05)'; c.fillRect(0, y, S, 2); }
    const lancet = (x, y, w, h) => {
      c.fillStyle = '#2a2622'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w * 0.6); c.quadraticCurveTo(x, y, x + w / 2, y - w * 0.15); c.quadraticCurveTo(x + w, y, x + w, y + w * 0.6); c.lineTo(x + w, y + h); c.closePath(); c.fill();
      win(x + 4, y + w * 0.5, w - 8, h - w * 0.5 - 4, 0); c.fillStyle = '#d8ccb2'; c.fillRect(x + w / 2 - 2, y + w * 0.4, 4, h - w * 0.4); c.fillRect(x, y + h * 0.55, w, 4);
    };
    for (const x of [26, 140]) lancet(x, 34, 90, 196);
    c.fillStyle = '#f0e8d6'; for (const x of [0, 120, 252]) c.fillRect(x - 6, 0, 12, S);           // buttress ribs
    c.fillStyle = 'rgba(60,50,40,.35)'; for (const x of [6, 126, 246]) c.fillRect(x, 0, 2, S);
    c.fillStyle = '#d8ccb2'; c.fillRect(0, 236, S, 12); for (let x = 8; x < S; x += 32) { c.fillStyle = '#c8baa0'; c.beginPath(); c.arc(x + 8, 242, 5, 0, 6.28); c.fill(); }
    // ground storey: an arcade of pointed arches
    c.fillStyle = '#e0d4bc'; c.fillRect(0, S, S, S);
    for (const x of [18, 136]) { lancet(x, S + 50, 102, 200); }
    c.fillStyle = '#f0e8d6'; for (const x of [0, 128, 256]) c.fillRect(x - 7, S, 14, S);
  });
  // Greenland: painted timber houses, horizontal boards, white corner boards and chunky white window frames (the
  // frames sit in the mask so they stay white whatever colour the house is painted)
  F.nordic = mk((c, win, mc) => {
    c.fillStyle = '#e6e2da'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += 14) { c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(0, y, S, 2); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, y + 2, S, 2); }
    const frame = (x, y, w, h, bars) => {
      c.fillStyle = '#f6f6f2'; c.fillRect(x - 9, y - 9, w + 18, h + 18); mc.fillStyle = '#00ff00'; mc.fillRect(x - 9, y - 9, w + 18, h + 18);
      win(x, y, w, h, 10); c.fillStyle = '#f6f6f2'; c.fillRect(x + w / 2 - 3, y, 6, h); if (bars > 1) c.fillRect(x, y + h / 2 - 3, w, 6);
    };
    frame(48, 62, 64, 120, 2); frame(146, 62, 64, 120, 2);
    c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 8, S * 2); c.fillRect(S - 8, 0, 8, S * 2); mc.fillStyle = '#00ff00'; mc.fillRect(0, 0, 8, S * 2); mc.fillRect(S - 8, 0, 8, S * 2);
    // ground storey: a door with its small window, and a window
    frame(150, S + 64, 64, 112, 2);
    c.fillStyle = '#f6f6f2'; c.fillRect(30, S + 52, 84, 204); c.fillStyle = '#5a3a2a'; c.fillRect(40, S + 62, 64, 194); mc.fillStyle = '#00ff00'; mc.fillRect(30, S + 52, 84, 204);
    win(54, S + 80, 36, 50, 10);
  });
  // ---- Cairo ----
  // plastered concrete apartment blocks: worn render, irregular shuttered windows, little balconies, AC boxes, stains
  F.cairo = mk((c, win, mc) => {
    c.fillStyle = '#ddd2bf'; c.fillRect(0, 0, S, S * 2);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '90,70,50' : '255,250,240'},${0.03 + Math.random() * 0.06})`; c.fillRect(Math.random() * S, Math.random() * S * 2, 4 + Math.random() * 30, 3 + Math.random() * 40); }
    for (let k = 0; k < 6; k++) { const x = Math.random() * S; c.fillStyle = 'rgba(80,60,40,.08)'; c.fillRect(x, 0, 3 + Math.random() * 6, S * 2); }       // streaks down from the roof
    const shutter = (x, y, w, h) => { c.fillStyle = Math.random() < 0.5 ? '#6b5a3a' : '#4a5a5a'; c.fillRect(x - 5, y, 5, h); c.fillRect(x + w, y, 5, h); };
    const wins = [[30, 60, 70, 110], [150, 60, 70, 110]];
    for (const [x, y, w, h] of wins) {
      win(x, y, w, h, 25); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + h, w, 5);
      if (Math.random() < 0.6) shutter(x, y, w, h);
      if (Math.random() < 0.55) { c.fillStyle = '#b8ad99'; c.fillRect(x - 10, y + h - 6, w + 20, 10); c.fillStyle = '#3a3632'; for (let k = 0; k < 9; k++) c.fillRect(x - 8 + k * (w + 16) / 8, y + h - 34, 3, 30); c.fillRect(x - 10, y + h - 36, w + 20, 3); }
    }
    if (Math.random() < 0.7) { c.fillStyle = '#e8e6e2'; c.fillRect(110, 40, 30, 20); c.fillStyle = '#9a9a96'; c.fillRect(112, 44, 26, 2); }       // an AC unit
    // street level: a shop with its roller shutter half up, or a plain door
    c.fillStyle = '#c4b8a2'; c.fillRect(0, S, S, S);
    win(16, S + 92, 224, 150, 30); c.fillStyle = '#5a5a5c'; c.fillRect(16, S + 70, 224, 30); for (let y = S + 70; y < S + 100; y += 5) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(16, y, 224, 1); }
  });
  // unfinished red-brick infill between grey concrete columns and slabs (the informal city)
  F.cairobrick = mk((c, win, mc) => {
    c.fillStyle = '#9a5a3c'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += 8) for (let x = (y / 8) % 2 ? -10 : 0; x < S; x += 20) { const v = 120 + Math.random() * 50; c.fillStyle = `rgb(${v + 30},${v * 0.6},${v * 0.42})`; c.fillRect(x + 1, y + 1, 18, 6); }
    c.fillStyle = '#9c9890'; c.fillRect(0, 0, 14, S * 2); c.fillRect(S - 14, 0, 14, S * 2); c.fillRect(0, S - 18, S, 18); c.fillRect(0, S * 2 - 18, S, 18);
    for (const x of [40, 150]) { win(x, 70, 66, 100, 30); if (Math.random() < 0.5) { c.fillStyle = '#d8d2c4'; c.fillRect(x - 4, 66, 74, 4); } }
    c.fillStyle = '#8a8680'; c.fillRect(0, S + 30, S, 200);
    win(30, S + 90, 196, 140, 30); c.fillStyle = '#4a4a4c'; c.fillRect(30, S + 60, 196, 30);
  });
  // Mamluk stone: alternating pale and dark courses (ablaq), tall recessed pointed windows, muqarnas band
  F.islamic = mk((c, win, mc) => {
    for (let y = 0; y < S * 2; y += 24) { c.fillStyle = (y / 24) % 2 ? '#d8c4a0' : '#e8dcc4'; c.fillRect(0, y, S, 24); }
    for (let y = 0; y < S * 2; y += 6) { c.fillStyle = 'rgba(0,0,0,.04)'; c.fillRect(0, y, S, 1); }
    const arch = (x, y, w, h) => { c.fillStyle = '#5a4630'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w * 0.5); c.quadraticCurveTo(x, y, x + w / 2, y - w * 0.2); c.quadraticCurveTo(x + w, y, x + w, y + w * 0.5); c.lineTo(x + w, y + h); c.fill(); win(x + 8, y + w * 0.4, w - 16, h - w * 0.4 - 6, 20); };
    arch(40, 50, 60, 150); arch(156, 50, 60, 150);
    c.fillStyle = '#c4ac80'; for (let x = 0; x < S; x += 16) c.fillRect(x, 226, 10, 18);
    for (let y = S; y < S * 2; y += 24) { c.fillStyle = (y / 24) % 2 ? '#d0bc98' : '#e0d4bc'; c.fillRect(0, y, S, 24); }
    arch(70, S + 60, 116, 190);
  });
  // limestone blocks: the pyramids, the Sphinx, mastabas; coursed, weathered, no windows
  F.limestone = mk((c) => {
    c.fillStyle = '#d6bf8c'; c.fillRect(0, 0, S, S * 2);
    for (let y = 0; y < S * 2; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < S; x += 48) { const v = 180 + Math.random() * 40; c.fillStyle = `rgb(${v + 20},${v},${v * 0.72})`; c.fillRect(x + 2, y + 2, 44, 28); c.fillStyle = 'rgba(80,60,30,.25)'; c.fillRect(x + 2, y + 28, 44, 3); }
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(90,70,40,${Math.random() * 0.12})`; c.fillRect(Math.random() * S, Math.random() * S * 2, 3 + Math.random() * 20, 2 + Math.random() * 10); }
  });
  // the real stone (the pyramid reference photo) replaces the drawn blocks as soon as it has loaded
  { const img = new Image(); img.onload = () => { const cv = F.limestone.map.image, x = cv.getContext('2d'), h = S * img.height / img.width; for (let y = 0; y < S * 2; y += h) x.drawImage(img, 0, y, S, h); F.limestone.map.needsUpdate = true; }; img.src = 'assets/pyramid-stone.jpg'; }
  return F;
}

// Roofline/shingle texture for gable roofs.
export function makeShingles() {
  const c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 10) {
    const off = (y / 10) % 2 ? 0 : 8;
    for (let i = -16; i < 256; i += 16) {
      const v = 120 + Math.random() * 60;
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(i + off, y, 15, 9);
    }
  }
  grain(x, 0, 0, 256, 256, 0.2);
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Soft round sprite for particles.
export function makeSoftSprite() {
  const c = canvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Puffy smoke sprite: several soft blobs.
export function makeSmokeSprite() {
  const c = canvas(128, 128), x = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const px = 64 + (Math.random() - 0.5) * 50, py = 64 + (Math.random() - 0.5) * 50, r = 18 + Math.random() * 24;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  const g = x.createRadialGradient(64, 64, 20, 64, 64, 64);
  x.globalCompositeOperation = 'destination-in';
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

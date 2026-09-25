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
  draw(ctx, win);
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

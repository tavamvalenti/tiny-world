// Profile pictures: whatever image the player picks (a file, or from the photo library / camera on a phone) is
// turned into a small square JPEG (160 x 160, the middle of the picture), small enough to keep in the profile and
// show on the boards. Nothing leaves the device until it's saved to an account.
export const AVATAR_SIZE = 160;

export async function readAvatar(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('not an image');
  if (file.size > 25e6) throw new Error('too big');
  let src, close = () => {};
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); close = () => src.close && src.close(); }
  catch {
    // older browsers: through an <img>
    const url = URL.createObjectURL(file);
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('unreadable')); im.src = url; });
    close = () => URL.revokeObjectURL(url);
  }
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, s = Math.min(w, h);
  if (!s) { close(); throw new Error('unreadable'); }
  const c = document.createElement('canvas'); c.width = c.height = AVATAR_SIZE;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  close();
  let out = c.toDataURL('image/jpeg', 0.82);
  if (out.length > 44000) out = c.toDataURL('image/jpeg', 0.6);   // keep it small for the boards
  return out;
}

// the picture, or a coloured circle with the first letter
export function avatarHtml(src, name, size = 32, cls = '') {
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  const hue = [...String(name || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  return src && /^data:image\//.test(src)
    ? `<img class="avi ${cls}" src="${src}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex:none">`
    : `<span class="avi ${cls}" style="width:${size}px;height:${size}px;border-radius:50%;display:inline-grid;place-items:center;flex:none;font:700 ${Math.round(size * 0.45)}px -apple-system,Inter,sans-serif;color:#fff;background:linear-gradient(135deg,hsl(${hue},70%,55%),hsl(${(hue + 50) % 360},70%,42%))">${letter}</span>`;
}

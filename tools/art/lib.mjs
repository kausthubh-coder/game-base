// What every 2D art tool shares: the manifest, the style sheet and the contract as data, a sheet's frames as
// pixels, and the measures the checks and the pictures are made from. Nothing here draws or changes a file.
//   style     assets-src/art-style.json      how the set is drawn: outline, light, pixels a block, frame by kind
//   contract  assets-src/art-contract.json   who each character is: kind, concept sheet, stated height, sheets, poses
import fs from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

export const root = resolve(import.meta.dirname, '../..');
export const at = (path) => resolve(root, path);
export const readJSON = (path) => JSON.parse(fs.readFileSync(at(path), 'utf8'));
export const manifest = () => readJSON('public/assets/manifest.json');
export const style = () => readJSON('assets-src/art-style.json');
export const contract = () => readJSON('assets-src/art-contract.json');
export const DIRS = ['front', 'back', 'side'];

const sheets = new Map();
/** A PNG under public/assets as raw RGBA, read once. */
export async function pixels(path, base = 'public/assets/') {
  const key = base + path;
  if (!sheets.has(key)) {
    const { data, info } = await sharp(at(key)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    sheets.set(key, { data, w: info.width, h: info.height });
  }
  return sheets.get(key);
}
export const forget = (path, base = 'public/assets/') => sheets.delete(base + path);

/** One cell of a sheet as its own pixels. */
export function cut(p, left, top, w, h) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) p.data.copy(data, y * w * 4, ((top + y) * p.w + left) * 4, ((top + y) * p.w + left + w) * 4);
  return { data, w, h };
}
export const toPng = (p) => sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } }).png().toBuffer();

/** Every frame a sprite's manifest entry names: its animation, direction, column, row and pixels. */
export async function frames(entry) {
  const p = await pixels(entry.sheet), [fw, fh] = entry.frame, list = [];
  for (const [anim, a] of Object.entries(entry.animations)) {
    for (const dir of DIRS) {
      const row = a.rows?.[dir];
      if (row === undefined) continue;
      for (let col = 0; col < a.frames; col++) list.push({ anim, dir, col, row, fps: a.fps, ...cut(p, col * fw, row * fh, fw, fh) });
    }
  }
  return list;
}

const SOLID = 128;
export const solid = (f, x, y) => x >= 0 && y >= 0 && x < f.w && y < f.h && f.data[(y * f.w + x) * 4 + 3] >= SOLID;
export const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hex = (r, g, b) => ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');

/** The 27 colour families a figure's identity is compared in: 12 hues by 2 lights, and 3 greys. Dark pixels
 *  (the outline and deep shade) are left out, since every figure shares them. */
function family(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
  if (l < 0.2) return -1;
  const d = max - min, s = d === 0 ? 0 : d / (255 - Math.abs(max + min - 255));
  if (s < 0.16) return 24 + (l < 0.5 ? 0 : l < 0.75 ? 1 : 2);
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h * 60) + 360) % 360;
  return Math.floor(h / 30) * 2 + (l < 0.55 ? 0 : 1);
}
export function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

/** What one frame measures. Empty frames give `{ empty: true }`. Rows are counted from the top of the frame.
 *  `band` limits the colour families to a share of the figure's height, [from, to] of 1 (the head is [0, 0.45]). */
export function measure(f, band = [0, 1]) {
  let left = f.w, top = f.h, right = -1, bottom = -1, area = 0, soft = 0;
  const widths = new Int32Array(f.h), lefts = new Int32Array(f.h).fill(-1), rights = new Int32Array(f.h).fill(-1);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const a = f.data[(y * f.w + x) * 4 + 3];
    if (a > 0 && a < 255) soft++;
    if (a < SOLID) continue;
    area++; widths[y]++;
    if (lefts[y] < 0) lefts[y] = x;
    rights[y] = x;
    if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
  }
  if (right < 0) return { empty: true };
  const height = bottom - top + 1, width = right - left + 1;
  const mid = (from, to) => {
    let sum = 0, n = 0;
    for (let y = top + Math.floor(height * from); y <= Math.min(bottom, top + Math.ceil(height * to)); y++) if (rights[y] >= 0) { sum += (lefts[y] + rights[y]) / 2; n++; }
    return n ? sum / n : (left + right) / 2;
  };
  const widest = (from, to) => { let w = 0; for (let y = top + Math.floor(height * from); y <= Math.min(bottom, top + Math.floor(height * to)); y++) w = Math.max(w, rights[y] - lefts[y] + 1); return w; };
  // The outline: solid pixels that touch a clear one.
  let rim = 0, pale = 0, black = 0, halo = 0, rimLuma = 0, leftLuma = 0, leftN = 0, rightLuma = 0, rightN = 0;
  const families = new Float64Array(27), colours = new Map();
  const y0 = top + Math.floor(height * band[0]), y1 = top + Math.ceil(height * band[1]);
  for (let y = top; y <= bottom; y++) for (let x = lefts[y]; x <= rights[y]; x++) {
    if (!solid(f, x, y)) continue;
    const o = (y * f.w + x) * 4, r = f.data[o], g = f.data[o + 1], b = f.data[o + 2], l = luma(r, g, b);
    const edge = !solid(f, x - 1, y) || !solid(f, x + 1, y) || !solid(f, x, y - 1) || !solid(f, x, y + 1);
    if (edge) {
      rim++; rimLuma += l;
      const lo = Math.min(r, g, b), hi = Math.max(r, g, b);
      if (lo > 200 && hi - lo < 40) pale++;
      if (hi < 24) black++;
      // A halo: a rim pixel much lighter than the pixel one step further in, on a light rim.
      const inward = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !solid(f, x - dx, y - dy) && solid(f, x + dx, y + dy));
      if (inward && l > 0.55) { const i = ((y + inward[1]) * f.w + x + inward[0]) * 4; if (l - luma(f.data[i], f.data[i + 1], f.data[i + 2]) > 0.3) halo++; }
    } else if (x < left + width / 3) { leftLuma += l; leftN++; } else if (x > right - width / 3) { rightLuma += l; rightN++; }
    if (y >= y0 && y <= y1) { const k = family(r, g, b); if (k >= 0) families[k]++; }
    const key = hex(r, g, b); colours.set(key, (colours.get(key) ?? 0) + 1);
  }
  // Outline weight: how many dark pixels in a row a figure starts with, from the left and from the right.
  const runs = [];
  for (let y = top; y <= bottom; y++) {
    if (lefts[y] < 0) continue;
    for (const [x0, step] of [[lefts[y], 1], [rights[y], -1]]) {
      let n = 0;
      for (let x = x0; n < 6 && solid(f, x, y); x += step, n++) { const o = (y * f.w + x) * 4; if (luma(f.data[o], f.data[o + 1], f.data[o + 2]) > 0.3) break; }
      runs.push(n);
    }
  }
  runs.sort((a, b) => a - b);
  return {
    empty: false, left, top, right, bottom, width, height, area, soft,
    centre: (left + right) / 2, feet: mid(0.92, 1), body: mid(0.45, 0.75), head: mid(0, 0.3),
    headWidth: widest(0, 0.42), bodyWidth: widest(0.5, 0.85),
    rim, pale: pale / rim, black: black / rim, halo: halo / rim, rimLuma: rimLuma / rim,
    outline: runs[runs.length >> 1] ?? 0, bare: runs.filter((n) => n === 0).length / Math.max(1, runs.length),
    lit: leftN && rightN ? leftLuma / leftN - rightLuma / rightN : 0,
    families, colours,
  };
}

/** The share of pixels that differ between two frames, of the pixels either one covers. */
export function differ(a, b) {
  let either = 0, changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const sa = a.data[i + 3] >= SOLID, sb = b.data[i + 3] >= SOLID;
    if (!sa && !sb) continue;
    either++;
    if (sa !== sb || a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) changed++;
  }
  return either ? changed / either : 0;
}

/** The character a sheet belongs to: the contract's entry that lists it, else the sheet is its own character. */
export function characterOf(name, c = contract()) {
  for (const [id, who] of Object.entries(c.characters)) if (id === name || who.sheets?.includes(name) || who.variants?.includes(name)) return { id, ...who };
  return { id: name, kind: null };
}

/** Rank against distinct characters, retaining each competitor's closest head.
 * Extra action/variant sheets must not count the same character again. The
 * portrait's own match always uses its base sheet, not a more flattering pose.
 */
export function portraitRank(family, heads, who, c) {
  const own = characterOf(who, c).id, like = cosine(family, heads[who]);
  const others = new Map();
  for (const [name, head] of Object.entries(heads)) {
    const id = characterOf(name, c).id;
    if (id === own) continue;
    const score = cosine(family, head);
    if (!others.has(id) || score > others.get(id)) others.set(id, score);
  }
  let rank = 1, nearest = own, closest = like;
  for (const [id, score] of others) {
    if (score > like) rank++;
    if (score > closest) { nearest = id; closest = score; }
  }
  return { rank, like, nearest, count: others.size + 1 };
}

export const label = (text, x, y, fill = '#fff1ce', size = 13) => ({
  input: Buffer.from(`<svg width="${Math.ceil(text.length * size * 0.62) + 8}" height="${size + 6}"><text x="2" y="${size}" font-family="monospace" font-size="${size}" fill="${fill}">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`),
  left: Math.round(x), top: Math.round(y),
});
export const block = (w, h, background) => ({ create: { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)), channels: 4, background } });
export async function scaled(p, k, kernel = Number.isInteger(k) ? 'nearest' : 'lanczos3') {
  return sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } }).resize(Math.max(1, Math.round(p.w * k)), Math.max(1, Math.round(p.h * k)), { kernel }).png().toBuffer();
}

import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// Re-exports resize files in place; avoid libvips retaining an old WebP header.
sharp.cache(false);

// Only crops, alpha cleanup, masks, resizing and encoding. All painted pixels come from src/.
export const art = resolve(import.meta.dirname, '..');
export const evidence = resolve(art, '../../../../.artifacts/opening/art-you');
export async function sourceCanvas(shot, source) {
  const center = await sharp(resolve(art, shot, 'src', source)).resize(1920, 1080, { fit: 'fill' }).removeAlpha().png().toBuffer();
  const marginSource = source === 'far.png' ? source : 'outpaint-v2.png';
  const margin = await sharp(resolve(art, shot, 'src', marginSource)).resize(2304, 1296, { fit: 'fill' }).removeAlpha().png().toBuffer();
  // Overscan adds pixels outside the original frame; it must never enlarge the frame.
  return sharp(margin).composite([{ input: center, left: 192, top: 108 }]).png().toBuffer();
}
export function framedPoints(points) {
  return points.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return `${192 + x / 1.2},${108 + y / 1.2}`; }).join(' ');
}
export async function reframePieces(shot, layers) {
  for (const l of layers) {
    l.x = Math.round((l.x + 192) / 1.2); l.y = Math.round((l.y + 108) / 1.2);
    l.w = Math.round(l.w / 1.2); l.h = Math.round(l.h / 1.2);
    for (const file of [l.file, ...(l.frames ?? [])]) {
      const path = resolve(art, shot, file);
      const resized = await sharp(path).resize(l.w, l.h, { fit: 'fill' }).webp({ quality: 85, alphaQuality: 100 }).toBuffer();
      await writeFile(path, resized);
    }
  }
}
export async function saveJson(shot, layers) {
  for (const l of layers) {
    if (l.z === 0 || l.frames?.length) continue;
    const path = resolve(art, shot, l.file);
    if (!(await sharp(path).metadata()).hasAlpha) continue;
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 1) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 < x0) throw new Error(`Empty alpha layer: ${shot}/${l.file}`);
    l.x += x0; l.y += y0; l.w = x1 - x0 + 1; l.h = y1 - y0 + 1;
    const output = await sharp(data, { raw: info }).extract({ left: x0, top: y0, width: l.w, height: l.h }).webp({ quality: 85, alphaQuality: 100 }).toBuffer();
    await writeFile(path, output);
  }
  await writeFile(resolve(art, shot, 'layers.json'), `${JSON.stringify({ shot, frame: [1920, 1080], layers }, null, 2)}\n`);
}
export function layer(id, file, box, z, depth, note, frames = []) {
  return { id, file, x: box[0], y: box[1], w: box[2], h: box[3], z, depth, pivot: [0.5, 1], ...(frames.length ? { frames } : {}), note };
}
export async function encode(shot, file, input, w, h) {
  await sharp(input).resize(w, h, { fit: 'fill' }).webp({ quality: 82, alphaQuality: 100 }).toFile(resolve(art, shot, file));
}
export async function frames(shot, source, count, prefix, w, h, vertical = false, clean = false, cuts) {
  const { data, info } = await sharp(resolve(art, shot, 'src', source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // Generator sometimes leaves low-opacity backdrop haze. Remove only that alpha range.
  if (clean) for (let i = 3; i < data.length; i += 4) data[i] = Math.max(0, Math.min(255, Math.round((data[i] - 235) * 255 / 15)));
  const sheet = await sharp(data, { raw: info }).png().toBuffer();
  const cells = [];
  for (let i = 0; i < count; i++) {
    const left = vertical ? 0 : Math.floor(info.width * i / count);
    const top = vertical ? (cuts?.[i] ?? Math.floor(info.height * i / count)) : 0;
    const width = vertical ? info.width : Math.floor(info.width * (i + 1) / count) - left;
    const height = vertical ? (cuts?.[i + 1] ?? Math.floor(info.height * (i + 1) / count)) - top : info.height;
    const cut = await sharp(sheet).extract({ left, top, width, height }).png().toBuffer();
    const cell = await sharp(cut).trim({ threshold: 30 }).png().toBuffer();
    cells.push(cell);
  }
  // All variants use a shared box and bottom baseline, with identical scale.
  const sizes = await Promise.all(cells.map((cell) => sharp(cell).metadata()));
  const scale = Math.min((w - 8) / Math.max(...sizes.map((s) => s.width)), (h - 8) / Math.max(...sizes.map((s) => s.height)));
  for (let i = 0; i < count; i++) {
    const cw = Math.round(sizes[i].width * scale), ch = Math.round(sizes[i].height * scale);
    const input = await sharp(cells[i]).resize(cw, ch).png().toBuffer();
    await sharp({ create: { width: w, height: h, channels: 4, background: '#00000000' } }).composite([{ input, left: Math.floor((w - cw) / 2), top: h - 4 - ch }]).webp({ quality: 85, alphaQuality: 100 }).toFile(resolve(art, shot, `${prefix}-${i + 1}.webp`));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}.webp`);
}
export async function masked(shot, source, file, points, box) {
  const input = await sourceCanvas(shot, source);
  const mask = Buffer.from(`<svg width="2304" height="1296"><polygon points="${points}" fill="white"/></svg>`);
  const result = await sharp(input).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  await sharp(result).extract({ left: box[0] + 192, top: box[1] + 108, width: box[2], height: box[3] }).webp({ quality: 83, alphaQuality: 100 }).toFile(resolve(art, shot, file));
}
export async function glow(shot, file, w, h, color) {
  // Light-only utility mask, for screen/additive compositing by the renderer.
  const svg = `<svg width="${w}" height="${h}"><defs><radialGradient id="g"><stop stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="url(#g)"/></svg>`;
  await sharp(Buffer.from(svg)).webp({ lossless: true }).toFile(resolve(art, shot, file));
}
export async function rest(shot) {
  const { layers } = JSON.parse(await readFile(resolve(art, shot, 'layers.json'), 'utf8'));
  const ops = [];
  for (const l of layers.toSorted((a, b) => a.z - b.z)) {
    const left = Math.max(0, l.x), top = Math.max(0, l.y);
    const width = Math.min(1920, l.x + l.w) - left, height = Math.min(1080, l.y + l.h) - top;
    if (width <= 0 || height <= 0) continue;
    const input = await sharp(resolve(art, shot, l.file)).extract({ left: left - l.x, top: top - l.y, width, height }).png().toBuffer();
    ops.push({ input, left, top });
  }
  return sharp({ create: { width: 1920, height: 1080, channels: 4, background: '#101524' } }).composite(ops).png().toBuffer();
}
export async function proofs(shot, plate) {
  await mkdir(evidence, { recursive: true });
  const stack = await rest(shot);
  const original = await sharp(resolve(art, '../../art/plates', plate)).resize(960, 540).png().toBuffer();
  const result = await sharp(stack).resize(960, 540).png().toBuffer();
  await sharp({ create: { width: 1920, height: 540, channels: 3, background: '#303030' } }).composite([{ input: original, left: 0, top: 0 }, { input: result, left: 960, top: 0 }]).png().toFile(resolve(evidence, `${shot}-rest.png`));
}

if (process.argv[1] === import.meta.filename) {
  const shot = 'wall';
  // This room edit already widened the approved room. Preserve the reviewed framing.
  await encode(shot, 'room.webp', resolve(art, shot, 'src/room.png'), 2304, 1296);
  const mural = await sharp(resolve(art, shot, 'room.webp')).extract({ left: 440, top: 110, width: 1110, height: 760 }).png().toBuffer();
  await encode(shot, 'wall.webp', mural, 1110, 760);
  const child = await frames(shot, 'child.png', 3, 'child', 205, 390);
  const hobb = await frames(shot, 'hobb.png', 2, 'hobb', 260, 505, false, true);
  const flame = await frames(shot, 'flame.png', 3, 'flame', 16, 27);
  await frames(shot, 'bunks.png', 2, 'bunk', 570, 280);
  await glow(shot, 'doorway-glow.webp', 470, 720, '#ffc375');
  const layers = [
    layer('room', 'room.webp', [-192, -108, 2304, 1296], 0, 0.65, 'Opaque overscan. Empty dormitory, no left lantern or candle illumination.'),
    layer('wall', 'wall.webp', [248, 2, 1110, 760], 10, 0.65, 'Neutral fresco surface for code light. Same plane as room; do not slide independently. The legend renderer may replace this panel.'),
    layer('doorway-glow', 'doorway-glow.webp', [1320, 180, 470, 720], 20, 0.55, 'Optional light-only mask. Use screen blending or opacity modulation.'),
    layer('hobb', hobb[0], [1430, 400, 260, 505], 30, 0.52, 'Past fifty, waiting then head tilt. Same box and baseline.', hobb.slice(1)),
    layer('child', child[0], [924, 520, 205, 390], 40, 0.34, 'Rear view. Low, half-raised, raised candle. Flame is separate; translate it with the candle hand.', child.slice(1)),
    layer('flame', flame[0], [1108, 650, 16, 27], 50, 0.34, 'Low pose flame. Match hand position when changing child pose; code adds candle light.', flame.slice(1)),
    layer('bunk-left', 'bunk-1.webp', [-30, 810, 570, 280], 60, 0.03, 'Near left wood and blanket.'),
    layer('bunk-right', 'bunk-2.webp', [1390, 810, 570, 280], 61, 0.03, 'Near right wood and blanket.'),
  ];
  await saveJson(shot, layers);
  await proofs(shot, 'p1-wall.jpg');
  console.log('wall: exported layers and comparison');
}

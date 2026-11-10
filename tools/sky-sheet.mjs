// Puts screenshots side by side so several can be looked at in one image.
//   bun tools/sky-sheet.mjs <out.png> <a.png> <b.png> ...    names without a folder are read from .artifacts/sky/
import sharp from 'sharp';
import { basename, resolve } from 'node:path';

const [out, ...names] = process.argv.slice(2);
if (!out || names.length === 0) { console.error('usage: bun tools/sky-sheet.mjs <out.png> <a.png> <b.png> ...'); process.exit(2); }
const folder = resolve(import.meta.dirname, '../.artifacts/sky');
const at = (name) => (name.includes('/') ? resolve(name) : resolve(folder, name.endsWith('.png') ? name : name + '.png'));
const columns = names.length <= 4 ? 2 : 3;
const width = columns === 2 ? 800 : 640;
const height = Math.round((width * 9) / 16);
const rows = Math.ceil(names.length / columns);
const tiles = await Promise.all(names.map(async (name, i) => {
  const label = Buffer.from(`<svg width="${width}" height="22"><rect width="100%" height="100%" fill="#000" fill-opacity="0.6"/><text x="6" y="16" font-family="sans-serif" font-size="14" fill="#fff">${basename(name, '.png')}</text></svg>`);
  const input = await sharp(at(name)).resize(width, height, { fit: 'cover' }).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer();
  return { input, left: (i % columns) * width, top: Math.floor(i / columns) * height };
}));
await sharp({ create: { width: columns * width, height: rows * height, channels: 3, background: '#10141a' } }).composite(tiles).png().toFile(at(out));
console.log('wrote', at(out));

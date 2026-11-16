// A contact sheet: several pictures in a grid, each labelled with its file name, to look at many shots at once.
//   bun tools/contact.mjs <out.jpg> <columns> <width of one> <picture>...
import sharp from 'sharp';
import { basename } from 'node:path';

const [out, cols, width, ...files] = process.argv.slice(2);
const c = Number(cols), w = Number(width);
const tiles = await Promise.all(files.map(async (f) => {
  const img = sharp(f).resize({ width: w });
  const { height } = await img.clone().metadata().then(() => img.clone().toBuffer({ resolveWithObject: true })).then((r) => r.info);
  const label = Buffer.from(`<svg width="${w}" height="22"><rect width="100%" height="100%" fill="black" opacity="0.6"/><text x="6" y="16" font-size="14" font-family="sans-serif" fill="white">${basename(f)}</text></svg>`);
  return { buf: await img.composite([{ input: label, top: 0, left: 0 }]).toBuffer(), h: height };
}));
const h = Math.max(...tiles.map((t) => t.h));
const rows = Math.ceil(tiles.length / c);
await sharp({ create: { width: c * w, height: rows * h, channels: 3, background: '#222' } })
  .composite(tiles.map((t, i) => ({ input: t.buf, left: (i % c) * w, top: Math.floor(i / c) * h })))
  .jpeg({ quality: 82 }).toFile(out);
console.log(out);

// Finds a pale fringe round sprites: the rim that is left when a generated picture is cut out of a white
// background. For each sheet it looks at the pixels on the outline (solid, next to a clear one) and says what
// share of them are near white. A clean pixel-art sheet has a dark outline, so its share is close to 0.
//   bun tools/sprite-fringe.mjs [names...] [--limit 0.05]
// With no names it checks every sheet in public/assets/sprites. It exits 1 when a sheet is over the limit.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const at = args.indexOf('--limit');
const limit = at >= 0 ? Number(args[at + 1]) : 0.05;
const names = args.filter((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
const folder = resolve(import.meta.dirname, '../public/assets/sprites');
const sheets = names.length ? names.map((n) => `${n}.png`) : readdirSync(folder).filter((f) => f.endsWith('.png')).sort();

/** The share of a sheet's outline pixels that are near white, and how many outline pixels it has. */
export async function fringe(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] > 127;
  let rim = 0, pale = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid(x, y) || (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) continue;
      rim++;
      const o = (y * width + x) * 4, r = data[o], g = data[o + 1], b = data[o + 2];
      if (Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 40) pale++;
    }
  }
  return { rim, share: rim ? pale / rim : 0 };
}

if (import.meta.main) {
  let bad = 0;
  for (const sheet of sheets) {
    const { rim, share } = await fringe(resolve(folder, sheet));
    const over = share > limit;
    if (over) bad++;
    console.log(`${over ? 'FAIL' : 'ok  '} ${sheet.padEnd(24)} ${(share * 100).toFixed(1).padStart(5)}% of ${rim} outline pixels are near white`);
  }
  console.log(bad ? `FAIL: ${bad} of ${sheets.length} sheets have a pale fringe` : `PASS: ${sheets.length} sheets, no pale fringe`);
  process.exit(bad ? 1 : 0);
}

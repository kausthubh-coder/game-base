// Clears the pale grey halo some generated sprites carry outside their dark outline: an opaque pixel on
// the outer edge of a figure (next to a transparent one) that is light and grey becomes transparent. It
// peels up to three such rings. Rerun `bun tools/sprites/check-story.mjs` after it.
//   bun tools/sprites/defringe.mjs public/assets/sprites/juniper.png [--dry]
import sharp from 'sharp';

const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('usage: bun tools/sprites/defringe.mjs <sprite.png> [--dry]'); process.exit(1); }
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
// The row a sheet's feet stand on stays, so the frames keep the anchor the manifest gives them.
const manifest = JSON.parse((await import('node:fs')).readFileSync(new URL('../../public/assets/manifest.json', import.meta.url), 'utf8'));
const entry = Object.values(manifest.sprites).find((s) => file.endsWith(s.sheet));
const feet = (y) => entry !== undefined && y % entry.frame[1] === entry.anchor[1];
const at = (x, y) => (y * w + x) * 4;
const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || data[at(x, y) + 3] < 128;
const light = (o) => (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;

const grey = (o) => Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]) < 36;
let cleared = 0, firstEdges = 0;
for (let ring = 0; ring < 3; ring++) {
  const edges = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (clear(x, y) || feet(y)) continue;
    if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) edges.push(at(x, y));
  }
  if (ring === 0) firstEdges = edges.length;
  const pale = edges.filter((o) => light(o) > 0.45 && grey(o));
  for (const o of pale) data[o + 3] = 0;
  cleared += pale.length;
  if (pale.length === 0) break;
}
console.log(`${file}: ${firstEdges} edge pixels, ${cleared} pale grey pixels cleared (${((cleared / firstEdges) * 100).toFixed(1)}%)`);
if (!rest.includes('--dry')) {
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file + '.tmp');
  (await import('node:fs')).renameSync(file + '.tmp', file);
}

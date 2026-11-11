// Clears the pale grey halo some generated sprites carry outside their dark outline: an opaque pixel on
// the outer edge of a figure (next to a transparent one) that is light and grey becomes transparent. It
// peels such rings until none is left, then sets every frame back on its anchor: feet on the anchor's row,
// middle on its column, as the build does. Rerun `bun tools/sprites/check-story.mjs` and
// `bun tools/sprite-fringe.mjs` after it.
//   bun tools/sprites/defringe.mjs public/assets/sprites/juniper.png [--dry]
import sharp from 'sharp';

const [file, ...rest] = process.argv.slice(2);
if (!file) { console.error('usage: bun tools/sprites/defringe.mjs <sprite.png> [--dry]'); process.exit(1); }
const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const manifest = JSON.parse((await import('node:fs')).readFileSync(new URL('../../public/assets/manifest.json', import.meta.url), 'utf8'));
const entry = Object.values(manifest.sprites).find((s) => file.endsWith(s.sheet));
const at = (x, y) => (y * w + x) * 4;
const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || data[at(x, y) + 3] < 128;
const light = (o) => (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;

const grey = (o) => Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]) < 36;
let cleared = 0, firstEdges = 0;
for (let ring = 0; ring < 8; ring++) {
  const edges = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (clear(x, y)) continue;
    if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) edges.push(at(x, y));
  }
  if (ring === 0) firstEdges = edges.length;
  const pale = edges.filter((o) => light(o) > 0.45 && grey(o));
  for (const o of pale) data[o + 3] = 0;
  cleared += pale.length;
  if (pale.length === 0) break;
}
// Peeling the halo off moved each figure's edges, so each frame is set on its anchor again.
let moved = 0;
if (entry !== undefined && cleared > 0) {
  const [fw, fh] = entry.frame, [ax, ay] = entry.anchor, cell = new Uint8Array(fw * fh * 4);
  for (let top = 0; top + fh <= h; top += fh) {
    for (let left = 0; left + fw <= w; left += fw) {
      let x0 = fw, x1 = -1, y1 = -1;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (!clear(left + x, top + y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (x1 < 0) continue;
      const dx = ax - Math.floor((x1 - x0 + 1) / 2) - x0, dy = ay - y1;
      if (dx === 0 && dy === 0) continue;
      for (let y = 0; y < fh; y++) cell.set(data.subarray(at(left, top + y), at(left, top + y) + fw * 4), y * fw * 4);
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const sx = x - dx, sy = y - dy, o = at(left + x, top + y);
          if (sx < 0 || sy < 0 || sx >= fw || sy >= fh) data.fill(0, o, o + 4);
          else data.set(cell.subarray((sy * fw + sx) * 4, (sy * fw + sx) * 4 + 4), o);
        }
      }
      moved++;
    }
  }
}
if (moved) console.log(`${file}: ${moved} frames set back on their anchor`);
console.log(`${file}: ${firstEdges} edge pixels, ${cleared} pale grey pixels cleared (${((cleared / firstEdges) * 100).toFixed(1)}%)`);
if (!rest.includes('--dry')) {
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file + '.tmp');
  (await import('node:fs')).renameSync(file + '.tmp', file);
}

// Puts structure back into block tiles. The second generation run cured banding by squeezing every
// material into three near-equal colors, which also erased cobbles, bricks, roof courses and leaves.
// This step takes the shapes from the first run's atlas and repaints them on a five-step ramp of the
// right color, so a tile keeps its drawing and loses its wrong hue. It runs at the end of build-blocks.mjs.
import sharp from 'sharp';
import { root, readJSON, writeJSON, pixels, cell, png, snap } from './lib.mjs';

const first = await pixels('assets-src/raw/atlas-before-2.png'); // 8 by 4 cells, from the first run
const atlas = await pixels('public/assets/blocks/atlas.png');
const manifest = await readJSON('public/assets/manifest.json');
const pal = await readJSON('assets-src/palette.json');
const rows = atlas.h / 32;

const GREY = [137, 135, 128], TEAL = [65, 128, 126], LEAF = [96, 121, 58];
const STRONG = [-36, -20, -6, 8, 20], MID = [-28, -15, -4, 7, 16], SOFT = [-16, -9, 0, 6, 11];
// tile, variant, where its shape comes from, and the ramp it is repainted on (none keeps its colors).
const jobs = [
  { tile: 'cobble', from: [first, 1, 2], base: GREY, steps: MID },
  { tile: 'stone_brick', from: [first, 2, 2], base: GREY, steps: STRONG },
  { tile: 'mossy_stone', from: [first, 0, 2], base: GREY, steps: SOFT, keepGreen: true },
  { tile: 'stone', variant: 0, from: [first, 5, 1], base: GREY, steps: SOFT },
  { tile: 'stone', variant: 1, from: [first, 6, 1], base: GREY, steps: SOFT },
  { tile: 'stone', variant: 2, from: [first, 7, 1], base: GREY, steps: SOFT },
  { tile: 'shingle', from: [first, 1, 3], base: TEAL, steps: STRONG },
  { tile: 'oak_leaves', variant: 0, from: [first, 4, 3], base: LEAF, steps: STRONG },
  { tile: 'oak_leaves', variant: 1, from: [first, 5, 3], base: LEAF, steps: STRONG },
  { tile: 'oak_leaves', variant: 2, from: [first, 6, 3], base: LEAF, steps: STRONG },
  { tile: 'grass_side', from: [first, 3, 0] },
  { tile: 'tilled_top', from: [first, 7, 0] },
  { tile: 'birch_log_top', from: [atlas, ...manifest.blocks.tiles.oak_log_top[0]], base: [203, 182, 138], steps: SOFT },
  { tile: 'pine_log_top', from: [atlas, ...manifest.blocks.tiles.oak_log_top[0]], base: [167, 123, 74], steps: SOFT },
];

const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
const layers = [];
for (const job of jobs) {
  const [src, col, row] = job.from;
  const p = await cell(src, col, row, 8, src === first ? 4 : rows);
  if (job.base) {
    const ramp = job.steps.map((s) => job.base.map((c) => Math.max(0, Math.min(255, c + s))));
    for (const c of ramp) if (!pal.colors.includes(hex(c))) pal.colors.push(hex(c));
    const lum = [];
    for (let i = 0; i < p.data.length; i += 4) lum.push(0.3 * p.data[i] + 0.59 * p.data[i + 1] + 0.11 * p.data[i + 2]);
    const sorted = [...lum].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.04)], hi = sorted[Math.floor(sorted.length * 0.96)];
    for (let i = 0, k = 0; i < p.data.length; i += 4, k++) {
      const [r, g, b] = [p.data[i], p.data[i + 1], p.data[i + 2]];
      if (job.keepGreen && g > r + 8 && g > b + 8) continue;
      const t = Math.max(0, Math.min(1, (lum[k] - lo) / Math.max(1, hi - lo)));
      p.data.set(ramp[Math.round(t * (ramp.length - 1))], i);
    }
  }
  snap(p, pal.colors);
  const [x, y] = manifest.blocks.tiles[job.tile][job.variant ?? 0];
  layers.push({ input: await png(p.data, 32, 32), left: x * 32, top: y * 32 });
}

await writeJSON('assets-src/palette.json', pal);
const pw = 256, ph = Math.ceil(pal.colors.length / 16) * 16, sw = Buffer.alloc(pw * ph * 4);
for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
  const color = pal.colors[Math.floor(y / 16) * 16 + Math.floor(x / 16)];
  if (color) { sw.set([1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)), (y * pw + x) * 4); sw[(y * pw + x) * 4 + 3] = 255; }
}
await sharp(await png(sw, pw, ph)).toFile(root + 'assets-src/palette.png');
const out = await sharp(root + 'public/assets/blocks/atlas.png').composite(layers).png().toBuffer();
await sharp(out).toFile(root + 'public/assets/blocks/atlas.png');
console.log(`Composed ${jobs.length} structured tiles back into the atlas.`);

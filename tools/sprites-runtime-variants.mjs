// Draws the demo's color variants side by side, without a browser, so the color maps can be judged:
//   bun tools/sprites-runtime-variants.mjs        writes .artifacts/sprites-runtime/variants.png
// Each row is one sprite: the art as generated, then its variants. Front, side and back idle frames, three times size.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAssets } from '../src/features/assets/index.ts';
import { ASSETS_FOLDER, diskIO } from '../src/features/assets/test-io.ts';
import { buildCast } from '../demos/sprites/cast.ts';

const out = resolve(import.meta.dirname, '../.artifacts/sprites-runtime');
mkdirSync(out, { recursive: true });
const assets = await loadAssets({ baseUrl: ASSETS_FOLDER, io: diskIO });
buildCast(assets);
const names = assets.spriteNames();
const bases = names.filter((n) => assets.sprite(n).base === n);
const CELL = 128, SCALE = 3, VIEWS = ['front', 'side', 'back'];
const columns = Math.max(...bases.map((b) => names.filter((n) => assets.sprite(n).base === b).length)) * VIEWS.length;
const width = columns * CELL, height = bases.length * CELL;
const canvas = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) canvas.set([0x65, 0x7b, 0x45, 255], i * 4);
bases.forEach((base, row) => {
  names.filter((n) => assets.sprite(n).base === base).forEach((name, v) => {
    const sprite = assets.sprite(name);
    const [fw, fh] = sprite.frame;
    VIEWS.forEach((view, c) => {
      // A sprite with no idle, or one drawn from the front only, shows what it has.
      const standing = sprite.animations.idle ?? Object.values(sprite.animations)[0];
      const sheetRow = standing.rows[view] ?? standing.rows.front;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        const from = ((sheetRow * fh + y) * sprite.pixels.width + x) * 4;
        if (sprite.pixels.data[from + 3] === 0) continue;
        const to = ((row * CELL + (CELL - fh) + y) * width + (v * VIEWS.length + c) * CELL + ((CELL - fw) >> 1) + x) * 4;
        canvas.set(sprite.pixels.data.subarray(from, from + 4), to);
      }
    });
  });
});
const file = resolve(out, 'variants.png');
await sharp(canvas, { raw: { width, height, channels: 4 } }).resize(width * SCALE, height * SCALE, { kernel: 'nearest' }).png().toFile(file);
const atlas = assets.spriteAtlas();
console.log(`${names.length} sprites (${names.join(', ')}) in an atlas of ${atlas.width} by ${atlas.height}, ${atlas.pages} page(s). Wrote ${file}`);

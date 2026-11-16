// Slice generated art only. No character pixels are drawn by this script.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { bounds, cell, clean, fitted, snap } from '../../../../../tools/sprites/lib.mjs';
const folder = new URL('../', import.meta.url).pathname;
const palette = JSON.parse(await fs.readFile(new URL('../../../../../assets-src/palette.json', import.meta.url))).colors;
const configs = {
  'button-child': { cols: 4, rows: 4, height: 108, worldHeight: 1, actions: { idle: [0, 2, 3, true], raise: [1, 4, 7, false], hold: [2, 2, 3, true], turn: [3, 2, 5, false] } },
  hobb: { cols: 4, rows: 2, height: 108, worldHeight: 1.6, actions: { idle: [0, 4, 4, true], bed: [1, 3, 5, false] } },
  'grey-coat': { cols: 6, rows: 2, height: 108, worldHeight: 1.75, actions: { walk: [0, 6, 8, true], idle: [1, 1, 1, true] } },
  basket: { cols: 2, rows: 1, height: 64, worldHeight: 0.45, actions: { breathe: [0, 2, 2, true] } },
};
const manifest = { version: 1, sprites: {} };
for (const [name, c] of Object.entries(configs)) {
  const { data, info } = await sharp(`${folder}src/${name}-raw.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = { data, w: info.width, h: info.height };
  const cells = [];
  for (let row = 0; row < c.rows; row++) for (let col = 0; col < c.cols; col++) {
    const p = clean(await cell(source, col, row, c.cols, c.rows));
    cells.push({ p, b: bounds(p) });
  }
  const scale = Math.min(c.height / Math.max(...cells.map(v => v.b.height)), 112 / Math.max(...cells.map(v => v.b.width)));
  const layers = [];
  const animations = {};
  const actions = {};
  for (const [action, [row, frames, fps, loop]] of Object.entries(c.actions)) {
    animations[action] = { frames, fps, rows: { [name === 'button-child' || name === 'grey-coat' ? 'back' : 'front']: row } };
    actions[action] = { frames: Array.from({ length: frames }, (_, col) => [col, row]), fps, loop };
    for (let col = 0; col < frames; col++) {
      const { p, b } = cells[row * c.cols + col];
      const fit = await fitted(p, b, scale);
      const d = await sharp(fit.input).ensureAlpha().raw().toBuffer();
      snap({ data: d, w: fit.w, h: fit.h }, palette);
      const input = await sharp(d, { raw: { width: fit.w, height: fit.h, channels: 4 } }).png().toBuffer();
      layers.push({ input, left: col * 128 + Math.round(64 - (fit.w - 1) / 2), top: row * 128 + 121 - fit.h });
    }
  }
  await sharp({ create: { width: c.cols * 128, height: c.rows * 128, channels: 4, background: '#00000000' } }).composite(layers).png().toFile(`${folder}${name}.png`);
  const idleRow = c.actions.idle?.[0] ?? 0;
  const drawnHeight = Math.round(cells[idleRow * c.cols].b.height * scale);
  manifest.sprites[name] = { heightMetres: c.worldHeight, referenceDrawnHeight: drawnHeight, sheet: `${name}.png`, frame: [128, 128], anchor: [64, 120], worldHeight: c.worldHeight * 128 / drawnHeight, animations, actions };
  console.log(`BUILT ${name}: ${c.cols * 128}x${c.rows * 128}, common scale ${scale.toFixed(4)}`);
}
await fs.writeFile(`${folder}sprites.json`, `${JSON.stringify(manifest, null, 2)}\n`);

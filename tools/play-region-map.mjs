// Draws the region of the first part from above, so its layout can be checked without the game.
//   bun tools/play-region-map.mjs [--seed 1] [--scale 4] [--out .artifacts/play/region-map.png]
//
// It makes the region's chunks with the real terrain code and colors each column by its top block,
// one pixel per block. The picture is then enlarged by `--scale` whole pixels so the numbers on the
// named places can be read, and a key under it lists every place with its coordinates. The plain
// picture, one pixel per block with nothing drawn on it, is written beside it as `<name>-1x.png`.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { BLOCKS } from '../src/content/blocks.ts';
import { CHUNK, HEIGHT } from '../src/features/world/chunk.sim.ts';
import { World } from '../src/features/world/world.sim.ts';
import { REGION } from '../src/game/content/region.ts';
import { createKernel } from '../src/game/kernel.sim.ts';
import { install } from '../src/game/region/index.sim.ts';
import { BOUNDS } from '../src/game/region/land.sim.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const root = resolve(import.meta.dirname, '..');
const seed = Number(opt('seed', 1));
const scale = Math.max(1, Math.round(Number(opt('scale', 4))));
const out = resolve(root, opt('out', '.artifacts/play/region-map.png'));

// ---- the chunks
const MARGIN = 12;
const cx0 = (BOUNDS.x0 - MARGIN) >> 4, cx1 = (BOUNDS.x1 + MARGIN) >> 4;
const cz0 = (BOUNDS.z0 - MARGIN) >> 4, cz1 = (BOUNDS.z1 + MARGIN) >> 4;
const x0 = cx0 * CHUNK, z0 = cz0 * CHUNK;
const width = (cx1 - cx0 + 1) * CHUNK, height = (cz1 - cz0 + 1) * CHUNK;

const world = new World(seed);
const started = performance.now();
for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) world.load(cx, cz);
const chunks = (cx1 - cx0 + 1) * (cz1 - cz0 + 1);
const each = (performance.now() - started) / chunks;

const kernel = createKernel(world, seed);
install(kernel);
const region = kernel.game.systems.region;

// ---- one pixel per block
const pixels = Buffer.alloc(width * height * 3);
const leafy = new Set(['oak_leaves', 'pine_needles']);
for (let z = 0; z < height; z++) {
  for (let x = 0; x < width; x++) {
    let y = HEIGHT - 1;
    while (y > 0 && world.getBlock(x0 + x, y, z0 + z) === 0) y--;
    const block = BLOCKS[world.getBlock(x0 + x, y, z0 + z)];
    let r = (block.color >> 16) & 255, g = (block.color >> 8) & 255, b = block.color & 255;
    // Leaves are darkened so a tree shows on grass. Everything else is a little lighter the higher it is.
    const shade = leafy.has(block.key) ? 0.62 : block.liquid || block.glows ? 1 : Math.max(0.78, Math.min(1.12, 0.9 + (y - 20) * 0.025));
    const i = (z * width + x) * 3;
    pixels[i] = Math.min(255, r * shade); pixels[i + 1] = Math.min(255, g * shade); pixels[i + 2] = Math.min(255, b * shade);
  }
}
mkdirSync(dirname(out), { recursive: true });
const plain = out.replace(/\.png$/, '-1x.png');
await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(plain);

// ---- the marks and the key
const px = (x) => (x - x0) * scale, pz = (z) => (z - z0) * scale;
const places = region.places();
const W = width * scale, mapH = height * scale;
const columns = 3, rowH = 18, keyRows = Math.ceil((places.length + 2) / columns);
const keyH = keyRows * rowH + 34;
const text = (x, y, s, size = 12, fill = '#fff', anchor = 'start', weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s}</text>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${mapH + keyH}">`;
svg += `<rect x="0" y="${mapH}" width="${W}" height="${keyH}" fill="#1c1f26"/>`;
// The grant and the town's bounds.
const g = region.grant(), t = REGION.town;
svg += `<rect x="${px(g.x)}" y="${pz(g.z)}" width="${g.width * scale}" height="${g.depth * scale}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 4"/>`;
svg += `<rect x="${px(t.x0)}" y="${pz(t.z0)}" width="${(t.x1 - t.x0 + 1) * scale}" height="${(t.z1 - t.z0 + 1) * scale}" fill="none" stroke="#ffd890" stroke-width="1.5" stroke-dasharray="6 4"/>`;
// Berry bushes.
for (const bush of region.berryBushes()) svg += `<circle cx="${px(bush.x)}" cy="${pz(bush.z)}" r="${Math.max(2.5, scale * 0.9)}" fill="#d0306a" stroke="#fff" stroke-width="1"/>`;
// The spawn point.
const s = region.spawn();
svg += `<circle cx="${px(s.x)}" cy="${pz(s.z)}" r="${Math.max(3, scale)}" fill="#35c2ff" stroke="#000" stroke-width="1"/>`;
// Each place: a numbered dot. Numbers that would sit on top of each other are pushed apart with a short line.
const taken = [];
places.forEach((place, i) => {
  const mx = px(place.at.x), mz = pz(place.at.z);
  let lx = mx, lz = mz - 13;
  for (let tries = 0; tries < 12 && taken.some((q) => Math.abs(q.x - lx) < 17 && Math.abs(q.z - lz) < 15); tries++) {
    const a = (tries / 12) * Math.PI * 2 - Math.PI / 2 + 0.6;
    lx = mx + Math.cos(a) * 24; lz = mz + Math.sin(a) * 24;
  }
  taken.push({ x: lx, z: lz });
  svg += `<line x1="${mx}" y1="${mz}" x2="${lx}" y2="${lz}" stroke="#000" stroke-width="1"/>`;
  svg += `<circle cx="${mx}" cy="${mz}" r="2.5" fill="#fff" stroke="#000" stroke-width="1"/>`;
  svg += `<circle cx="${lx}" cy="${lz}" r="8" fill="#111" stroke="#fff" stroke-width="1"/>`;
  svg += text(lx, lz + 4, String(i + 1), 10, '#fff', 'middle', 700);
  const col = i % columns, row = Math.floor(i / columns);
  const at = place.at;
  svg += text(12 + col * (W / columns), mapH + 40 + row * rowH, `${i + 1}  ${esc(place.name)}  (${Math.floor(at.x)}, ${at.y}, ${Math.floor(at.z)})`, 12);
});
svg += text(12, mapH + 18, `Greenhollow, the first part. Seed ${seed}. North is up, one block is ${scale} px. `
  + `Dashed white: the grant. Dashed yellow: the town's bounds. Blue dot: spawn. Pink dots: berry bushes.`, 12, '#ffd890');
svg += '</svg>';

const big = await sharp(pixels, { raw: { width, height, channels: 3 } }).resize(W, mapH, { kernel: 'nearest' }).png().toBuffer();
await sharp({ create: { width: W, height: mapH + keyH, channels: 3, background: '#1c1f26' } })
  .composite([{ input: big, top: 0, left: 0 }, { input: Buffer.from(svg), top: 0, left: 0 }])
  .png().toFile(out);

console.log(`${chunks} chunks from x ${x0} to ${x0 + width - 1}, z ${z0} to ${z0 + height - 1}: ${each.toFixed(2)} ms each to make and light`);
for (const place of places) console.log(`${place.name.padEnd(13)} ${Math.floor(place.at.x)}, ${place.at.y}, ${Math.floor(place.at.z)}`);
console.log(`spawn         ${Math.floor(s.x)}, ${s.y}, ${Math.floor(s.z)}`);
console.log(plain);
console.log(out);

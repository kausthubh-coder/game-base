// Draws the shape of the land from above: heights as shaded relief, water, rock, woods, the path and the
// sites. It asks the terrain's own functions, so it shows land far outside the region too, and it makes no chunks.
//   bun tools/land-relief.mjs [--seed 1] [--box -470,-590,430,110] [--scale 1] [--out .artifacts/land/relief.png] [--plain]
// One pixel is one block before `--scale`. North is up. The default box is Greenhollow's whole map and a margin
// round it. Each kind of land is tinted (`--plain` leaves the tints out), the plan's paths are drawn, the High
// Road's deck is a pale band, and every landmark's footprint is a dark box (red when its model is not made yet).
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { WATER_LEVEL, forestAt, groundHeight, landHeight, surfaceAt, treesInArea } from '../src/features/world/terrain.sim.ts';
import { PROPS } from '../src/content/props.ts';
import { BIOMES } from '../src/game/content/greenhollow.ts';
import { REGION } from '../src/game/content/region.ts';
import { biomeAt } from '../src/game/region/greenhollow.sim.ts';
import { landmarkSites, mapWeight, onDeck, planPathReach, planStands, waterLevelAt } from '../src/game/region/greenhollow-land.sim.ts';
import { onPath } from '../src/game/region/land.sim.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const root = resolve(import.meta.dirname, '..');
const seed = Number(opt('seed', 1));
const [x0, z0, x1, z1] = opt('box', '-470,-590,430,110').split(',').map(Number);
const scale = Math.max(1, Math.round(Number(opt('scale', 1))));
const out = resolve(root, opt('out', '.artifacts/land/relief.png'));
const plain = args.includes('--plain');
/** A tint for each kind of land, multiplied into the ground's colour. */
const TINT = { meadow: [1, 1, 1], oldForest: [0.72, 0.86, 0.7], greyForest: [0.95, 0.9, 0.86], marsh: [0.92, 0.95, 0.8], caveHills: [1, 0.95, 0.92], terraces: [1.05, 0.98, 0.85], town: [1.1, 1.02, 0.9] };
const w = x1 - x0, h = z1 - z0;

const started = performance.now();
const height = new Float32Array((w + 2) * (h + 2));
let low = Infinity, high = -Infinity;
for (let j = 0; j < h + 2; j++) for (let i = 0; i < w + 2; i++) {
  const y = landHeight(seed, x0 + i - 1, z0 + j - 1);
  height[j * (w + 2) + i] = y; low = Math.min(low, y); high = Math.max(high, y);
}
const each = (performance.now() - started) / height.length * 1000;

const KIND = { grass: [136, 189, 80], rock: [184, 179, 166], sand: [226, 212, 162], path: [224, 200, 152] };
const rgb = Buffer.alloc(w * h * 3);
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
  const x = x0 + i, z = z0 + j, at = (j + 1) * (w + 2) + i + 1, y = height[at];
  const top = surfaceAt(seed, x, z);
  let c = top === 'grass' ? KIND.grass : top === 'sand' || top === 'clay' ? KIND.sand : KIND.rock;
  // Woods are a darker green.
  if (top === 'grass') { const f = forestAt(seed, x, z); c = [c[0] - 50 * f, c[1] - 45 * f, c[2] - 20 * f]; }
  if (!plain && top === 'grass' && mapWeight(x, z) >= 1) { const t = TINT[biomeAt(x, z)]; c = [c[0] * t[0], c[1] * t[1], c[2] * t[2]]; }
  if (onPath(x, z) || planPathReach(x, z) <= 0) c = KIND.path;
  if (onDeck(x, z)) c = [235, 225, 200];
  // Light from the north-west.
  const shade = Math.max(0.45, Math.min(1.35, 1 + ((height[at - 1] - height[at + 1]) + (height[at - (w + 2)] - height[at + (w + 2)])) * 0.16));
  // Higher land is a little lighter, and a line marks every five blocks of height.
  const lift = 0.86 + 0.28 * (y - low) / Math.max(1, high - low), line = Math.floor(y / 5) !== Math.floor(height[at + 1] / 5) || Math.floor(y / 5) !== Math.floor(height[at + w + 2] / 5) ? 0.8 : 1;
  let [r, g, b] = c.map((v) => v * shade * lift * line);
  const water = waterLevelAt(x, z);
  if (groundHeight(seed, x, z) < water && !onDeck(x, z) && !(planPathReach(x, z) <= 0)) { const deep = Math.min(1, (water - y) / 5); r = 70 - 30 * deep; g = 150 - 40 * deep; b = 200 - 30 * deep; }
  const o = (j * w + i) * 3;
  rgb[o] = Math.max(0, Math.min(255, r)); rgb[o + 1] = Math.max(0, Math.min(255, g)); rgb[o + 2] = Math.max(0, Math.min(255, b));
}
const dot = (x, z, r, g, b, size = 0) => {
  for (let dz = -size; dz <= size; dz++) for (let dx = -size; dx <= size; dx++) {
    const i = x - x0 + dx, j = z - z0 + dz;
    if (i < 0 || j < 0 || i >= w || j >= h) continue;
    const o = (j * w + i) * 3; rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
  }
};
const trees = treesInArea(seed, x0, z0, x1, z1);
for (const t of trees) dot(t.x, t.z, t.kind === 'pine' ? 20 : 30, t.kind === 'birch' ? 120 : 90, t.kind === 'pine' ? 60 : 40);
const frame = (r, red, green, blue) => {
  for (let x = r.x0; x <= r.x1; x++) { dot(x, r.z0, red, green, blue); dot(x, r.z1, red, green, blue); }
  for (let z = r.z0; z <= r.z1; z++) { dot(r.x0, z, red, green, blue); dot(r.x1, z, red, green, blue); }
};
frame({ x0: REGION.grant.x, z0: REGION.grant.z, x1: REGION.grant.x + REGION.grant.width - 1, z1: REGION.grant.z + REGION.grant.depth - 1 }, 255, 255, 255);
frame(REGION.town, 255, 220, 120);
for (const p of REGION.places) dot(p.x, p.z, 230, 40, 40, 1);
dot(REGION.spawn.x, REGION.spawn.z, 255, 255, 255, 1);
// The landmarks' footprints: dark when the model exists, red when it is still to be made.
const missing = new Set();
for (const s of landmarkSites()) {
  if (s.model === 'dawnDome') continue;
  const made = Object.hasOwn(PROPS, s.model);
  if (!made) missing.add(s.model);
  const c = Math.cos(s.rotation), sn = Math.sin(s.rotation);
  for (let u = -s.size.w / 2; u <= s.size.w / 2; u += 0.5) for (const v of [-s.size.d / 2, s.size.d / 2]) dot(Math.floor(s.x + u * c + v * sn), Math.floor(s.z - u * sn + v * c), made ? 40 : 200, 30, made ? 30 : 30);
  for (let v = -s.size.d / 2; v <= s.size.d / 2; v += 0.5) for (const u of [-s.size.w / 2, s.size.w / 2]) dot(Math.floor(s.x + u * c + v * sn), Math.floor(s.z - u * sn + v * c), made ? 40 : 200, 30, 30);
}
for (const p of planStands()) dot(p.x, p.z, 255, 240, 60, 1);
if (missing.size) console.log(`models not made yet: ${[...missing].join(', ')}`);

mkdirSync(dirname(out), { recursive: true });
await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).resize(w * scale, h * scale, { kernel: 'nearest' }).png().toFile(out);
console.log(`${out}: ${w} by ${h} blocks, heights ${low.toFixed(1)} to ${high.toFixed(1)}, ${trees.length} trees, ${each.toFixed(2)} microseconds a column`);

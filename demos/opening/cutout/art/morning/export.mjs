import sharp from 'sharp';
import { resolve } from 'node:path';
import { unlink } from 'node:fs/promises';
import { art, framedPoints, frames, layer, masked, proofs, reframePieces, saveJson } from '../wall/export.mjs';
import { street } from '../doorstep/export.mjs';

const shot = 'morning';
const layers = await street(shot);
const flags = await frames(shot, 'flags.png', 2, 'flags', 900, 175, true, false, [0, 465, 724]);
// Detach the foreground flower corner from the near plane without leaving a duplicate.
const flowerPoints = framedPoints('2100,965 2010,1035 1950,1075 1840,1150 1740,1240 1740,1500 2600,1500 2600,925');
await masked(shot, 'clean.png', 'flowers.webp', flowerPoints, [-192, -108, 2304, 1296]);
const hole = Buffer.from(`<svg width="2304" height="1296"><rect width="2304" height="1296" fill="white"/><polygon points="${flowerPoints}" fill="black"/></svg>`);
const mask = await sharp(hole).removeAlpha().toColourspace('b-w').raw().toBuffer();
const base = await sharp(resolve(art, shot, 'door-step-wisteria.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < mask.length; i++) base.data[i * 4 + 3] = Math.round(base.data[i * 4 + 3] * mask[i] / 255);
await sharp(base.data, { raw: base.info }).webp({ quality: 83, alphaQuality: 100 }).toFile(resolve(art, shot, 'door-step-wisteria.webp'));
layers.push(
  layer('flags-near', flags[0], [460, 250, 900, 175], 20, 0.72, 'One long painted line. Code may wave it; keep upper-left title area clear.'),
  layer('flags-far', flags[1], [345, 470, 500, 97], 21, 0.85, 'Distant line. Draw at native manifest dimensions, wave with smaller amplitude.'),
  layer('flowers', 'flowers.webp', [-192, -108, 2304, 1296], 40, 0.25, 'Detached flowers and ground corner. Same depth as step to keep ground edges registered during camera moves. Code may wave flowers without translating the ground.'),
);
// The second strip is encoded to its exact declared display box.
await sharp(resolve(art, shot, flags[1])).resize(500, 97).webp({ quality: 85, alphaQuality: 100 }).toFile(resolve(art, shot, 'flags-far.webp'));
layers.find((l) => l.id === 'flags-far').file = 'flags-far.webp';
await unlink(resolve(art, shot, flags[1]));
await reframePieces(shot, layers.filter((l) => l.id.startsWith('flags-')));
await saveJson(shot, layers);
await proofs(shot, 'p9-doorstep-day.jpg');
console.log('morning: exported layers and comparison');

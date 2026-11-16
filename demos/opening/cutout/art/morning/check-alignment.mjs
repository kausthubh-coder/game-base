import assert from 'node:assert/strict';
import sharp from 'sharp';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { art, evidence, sourceCanvas } from '../wall/export.mjs';

// Compare structure, rather than color, between two weather/lighting edits.
const images = [];
for (const shot of ['doorstep', 'morning']) {
  const full = await sourceCanvas(shot, 'clean.png');
  const data = await sharp(full).extract({ left: 192, top: 108, width: 1920, height: 1080 }).greyscale().raw().toBuffer();
  const gradient = new Float32Array(data.length);
  for (let y = 1; y < 1079; y++) for (let x = 1; x < 1919; x++) {
    const p = y * 1920 + x;
    gradient[p] = Math.hypot(data[p + 1] - data[p - 1], data[p + 1920] - data[p - 1920]);
  }
  images.push(gradient);
}
const results = [];
for (const [name, x, y, w, h] of [
  ['door frame', 1270, 210, 100, 530],
  ['step edges', 950, 825, 650, 150],
  ['street edge', 200, 620, 480, 270],
]) {
  let best = { correlation: -1, dx: 0, dy: 0 };
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    let ab = 0, aa = 0, bb = 0;
    for (let py = y; py < y + h; py += 2) for (let px = x; px < x + w; px += 2) {
      const a = images[0][py * 1920 + px], b = images[1][(py + dy) * 1920 + px + dx];
      ab += a * b; aa += a * a; bb += b * b;
    }
    const correlation = ab / Math.sqrt(aa * bb);
    if (correlation > best.correlation) best = { correlation, dx, dy };
  }
  assert(best.correlation > 0.5 && Math.abs(best.dx) <= 3 && Math.abs(best.dy) <= 3, `${name}: alignment exceeds three pixels`);
  results.push({ name, region: [x, y, w, h], ...best });
  console.log(`PASS ${name}: best structural alignment dx=${best.dx}, dy=${best.dy} pixels`);
}
await writeFile(resolve(evidence, 'alignment.json'), `${JSON.stringify(results, null, 2)}\n`);

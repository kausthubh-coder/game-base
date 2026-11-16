import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { art, evidence } from './export.mjs';

const samples = [
  { pan: -48, lift: -8, scale: 1 },
  { pan: 0, lift: 0, scale: 1.04 },
  { pan: 48, lift: 8, scale: 1.08 },
];
const summary = [];
for (const shot of ['wall', 'doorstep', 'morning']) {
  const { layers } = JSON.parse(await readFile(resolve(art, shot, 'layers.json'), 'utf8'));
  const strip = [];
  for (let i = 0; i < samples.length; i++) {
    const camera = samples[i];
    const ops = [];
    for (const l of layers.toSorted((a, b) => a.z - b.z)) {
      const x = Math.round(960 + (l.x - 960) * camera.scale - camera.pan * (1 - l.depth));
      const y = Math.round(540 + (l.y - 540) * camera.scale - camera.lift * (1 - l.depth));
      const w = Math.round(l.w * camera.scale), h = Math.round(l.h * camera.scale);
      const left = Math.max(0, x), top = Math.max(0, y);
      const width = Math.min(1920, x + w) - left, height = Math.min(1080, y + h) - top;
      if (width <= 0 || height <= 0) continue;
      const resized = await sharp(resolve(art, shot, l.file)).resize(w, h, { fit: 'fill' }).png().toBuffer();
      const input = await sharp(resized).extract({ left: left - x, top: top - y, width, height }).png().toBuffer();
      ops.push({ input, left, top });
    }
    const frame = await sharp({ create: { width: 1920, height: 1080, channels: 4, background: '#00000000' } }).composite(ops).png().toBuffer();
    const alpha = (await sharp(frame).stats()).channels[3];
    assert.equal(alpha.min, 255, `${shot} camera ${i}: exposed canvas edge or hole`);
    const view = await sharp(frame).resize(640, 360).png().toBuffer();
    const detail = await sharp(frame).extract({ left: 620, top: 250, width: 960, height: 540 }).resize(640, 360).png().toBuffer();
    const ground = await sharp(frame).extract({ left: 960, top: 540, width: 960, height: 540 }).resize(640, 360).png().toBuffer();
    strip.push({ input: view, left: i * 640, top: 28 }, { input: detail, left: i * 640, top: 416 }, { input: ground, left: i * 640, top: 804 });
    const label = Buffer.from(`<svg width="640" height="28"><text x="10" y="20" fill="white" font-size="16">${shot} | pan ${camera.pan}px | zoom ${camera.scale} | full / wall / ground</text></svg>`);
    strip.push({ input: label, left: i * 640, top: 0 });
  }
  await sharp({ create: { width: 1920, height: 1164, channels: 3, background: '#303030' } }).composite(strip).png().toFile(resolve(evidence, `${shot}-camera-strip.png`));
  summary.push({ shot, samples, opaqueFrames: samples.length });
  console.log(`PASS ${shot}: camera strip, ${samples.length} opaque frames; pan -48 to +48 pixels, push 1 to 1.08`);
}
await writeFile(resolve(evidence, 'camera-check.json'), `${JSON.stringify(summary, null, 2)}\n`);

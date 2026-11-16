import assert from 'node:assert/strict';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { art, evidence, rest } from './export.mjs';

const shots = process.argv.slice(2).filter((s) => s !== '--proofs');
const selected = shots.length ? shots : ['wall', 'doorstep', 'morning'];
await mkdir(evidence, { recursive: true });
for (const shot of selected) {
  const manifest = JSON.parse(await readFile(resolve(art, shot, 'layers.json'), 'utf8'));
  assert.equal(manifest.shot, shot);
  assert.deepEqual(manifest.frame, [1920, 1080]);
  const files = new Set(), ids = new Set();
  const edges = [];
  let bytes = 0;
  for (const l of manifest.layers) {
    assert(!ids.has(l.id), `Duplicate layer ${l.id}`); ids.add(l.id);
    assert(Number.isInteger(l.x) && Number.isInteger(l.y));
    assert(l.depth >= 0 && l.depth <= 1 && Number.isFinite(l.z));
    assert(l.pivot.every((n) => n >= 0 && n <= 1));
    for (const file of [l.file, ...(l.frames ?? [])]) {
      assert(!file.includes('/') && file.endsWith('.webp'));
      const path = resolve(art, shot, file);
      const m = await sharp(path).metadata();
      assert.deepEqual([m.width, m.height], [l.w, l.h], `${shot}/${file}: dimensions differ from manifest`);
      if (!files.has(file)) bytes += (await stat(path)).size;
      files.add(file);
      if (l.z === 0) {
        assert.deepEqual([l.x, l.y, l.w, l.h], [-192, -108, 2304, 1296]);
        assert(!m.hasAlpha || (await sharp(path).stats()).channels[3].min === 255, 'Background must be opaque');
      } else if (m.hasAlpha) edges.push({ path, file });
    }
  }
  assert(bytes < 3_000_000, `${shot}: ${bytes} bytes exceeds budget`);
  console.log(`PASS ${shot}: ${manifest.layers.length} layers, ${files.size} files, ${bytes} bytes; dimensions, files, overscan, opaque background, budget`);
  if (process.argv.includes('--proofs')) {
    const cw = 300, ch = 300, cols = 4;
    const rows = Math.ceil(edges.length / cols);
    const ops = [];
    for (let i = 0; i < edges.length; i++) {
      const input = await sharp(edges[i].path).resize(280, 260, { fit: 'inside' }).png().toBuffer();
      const meta = await sharp(input).metadata();
      for (let side = 0; side < 2; side++) {
        const left = (i % cols) * cw + side * cols * cw;
        const top = Math.floor(i / cols) * ch;
        ops.push({ input, left: left + Math.floor((cw - meta.width) / 2), top: top + 28 + Math.floor((260 - meta.height) / 2) });
        const text = Buffer.from(`<svg width="300" height="24"><text x="8" y="18" fill="white" font-size="13">${edges[i].file}</text></svg>`);
        ops.push({ input: text, left, top });
      }
    }
    const red = await sharp({ create: { width: cols * cw, height: rows * ch, channels: 3, background: '#ff0000' } }).png().toBuffer();
    await sharp({ create: { width: cols * cw * 2, height: rows * ch, channels: 3, background: '#303030' } }).composite([{ input: red, left: cols * cw, top: 0 }, ...ops]).png().toFile(resolve(evidence, `${shot}-edges.png`));
    for (const l of manifest.layers.filter((l) => l.frames?.length)) {
      const strip = [];
      const names = [l.file, ...l.frames];
      for (let i = 0; i < names.length; i++) {
        strip.push({ input: resolve(art, shot, names[i]), left: i * l.w, top: 0 });
      }
      await sharp({ create: { width: names.length * l.w, height: l.h + 4, channels: 3, background: '#303030' } }).composite(strip).png().toFile(resolve(evidence, `${shot}-${l.id}-strip.png`));
    }
  }
}
if (selected.includes('doorstep') && selected.includes('morning') && process.argv.includes('--proofs')) {
  const night = await rest('doorstep'), day = await rest('morning');
  const { data, info } = await sharp(day).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] / 2);
  const half = await sharp(data, { raw: info }).png().toBuffer();
  const overlay = await sharp(night).composite([{ input: half }]).png().toBuffer();
  await sharp(overlay).resize(1280, 720).png().toFile(resolve(evidence, 'doorstep-morning-overlay.png'));
}

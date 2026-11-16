// The same numerical rules as tools/sprites/check-story.mjs, for lab-local assets.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { bounds, cell } from '../../../../../tools/sprites/lib.mjs';
import { fringe } from '../../../../../tools/sprite-fringe.mjs';
const folder = new URL('../', import.meta.url).pathname;
const manifest = JSON.parse(await fs.readFile(`${folder}sprites.json`));
const palette = new Set(JSON.parse(await fs.readFile(new URL('../../../../../assets-src/palette.json', import.meta.url))).colors.map(c => c.slice(1)));
let count = 0;
for (const [name, s] of Object.entries(manifest.sprites)) {
  assert.deepEqual(s.frame, [128, 128]);
  assert.deepEqual(s.anchor, [64, 120]);
  const { data, info } = await sharp(`${folder}${s.sheet}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const p = { data, w: info.width, h: info.height };
  const cols = p.w / 128;
  const rows = p.h / 128;
  assert(Number.isInteger(cols) && Number.isInteger(rows));
  for (let i = 0; i < data.length; i += 4) {
    assert(data[i + 3] === 0 || data[i + 3] === 255, `${name} binary alpha`);
    if (data[i + 3]) assert(palette.has(data.subarray(i, i + 3).toString('hex')), `${name} palette`);
  }
  for (const [action, a] of Object.entries(s.animations)) {
    assert.equal(s.actions[action].frames.length, a.frames);
    assert.equal(s.actions[action].fps, a.fps);
    for (const row of Object.values(a.rows)) for (let col = 0; col < cols; col++) {
      const q = await cell(p, col, row, cols, rows);
      if (col >= a.frames) {
        assert(q.data.every((v, i) => i % 4 !== 3 || !v), `${name} unused cell`);
        continue;
      }
      const b = bounds(q);
      assert.equal(b.top + b.height - 1, 120, `${name} baseline`);
      assert(Math.abs(b.left + (b.width - 1) / 2 - 64) <= 1, `${name} horizontal anchor`);
      assert(b.left > 0 && b.top > 0 && b.left + b.width < 128 && b.top + b.height < 128, `${name} padding`);
      count++;
    }
  }
  const f = await fringe(`${folder}${s.sheet}`);
  assert(f.share <= 0.05, `${name} pale fringe`);
  console.log(`PASS ${name}: sizes, anchors, binary alpha, locked palette, padding, unused cells; fringe ${(f.share * 100).toFixed(1)}% of ${f.rim} rim pixels`);
}
console.log(`PASS opening sprites: ${count} frames`);

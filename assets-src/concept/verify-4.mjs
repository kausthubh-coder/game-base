import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import sharp from 'sharp';

const groups = {
  '7-ways-down': ['galleryMouth', 'caveMouth', 'vaultRoots', 'crystals', 'vista'],
  '8-set-pieces': ['rockArch', 'boulders', 'fallenGiant', 'stiltHut', 'boardwalk', 'vista'],
};

for (const [group, names] of Object.entries(groups)) {
  for (const name of names) {
    const path = `assets-src/concept/${group}/${name}.webp`;
    const bytes = (await stat(path)).size;
    const image = sharp(path);
    const meta = await image.metadata();
    assert.equal(meta.format, 'webp', path);
    assert.equal(meta.width, 1600, path);
    assert(bytes < 600_000, `${path}: ${bytes} bytes`);
    await image.raw().toBuffer();
    console.log(`PASS ${path}: ${meta.width} x ${meta.height}, ${bytes} bytes`);
  }
}
console.log('PASS: all eleven concept images decode, match width, and meet the size cap.');

// Colour regression for the fixed props-beside tent fixture (default camera,
// location and daylight .42). Pass its raw three-quarter PNG, not the composite.
// This sample is inside the left inner canvas, clear of the lamp, flaps and bed.
// A camera/fixture change needs a newly inspected sample, not looser thresholds.
import assert from 'node:assert/strict';
import sharp from 'sharp';

const paths = process.argv.slice(2);
assert(paths.length, 'Pass one or more props-beside three-quarter-tent-0.png files');
let failed = false;
for (const path of paths) {
  const meta = await sharp(path).metadata();
  assert(
    meta.width === 1440 && meta.height === 810,
    'Expected the unchanged 1440x810 prop fixture',
  );
  const pixels = await sharp(path)
    .extract({ left: 530, top: 450, width: 35, height: 20 })
    .removeAlpha()
    .raw()
    .toBuffer();
  const rgb = [0, 0, 0];
  for (let i = 0; i < pixels.length; i++) rgb[i % 3] += pixels[i];
  for (let i = 0; i < 3; i++) rgb[i] /= pixels.length / 3;
  // Warm ochre/brown has distinct red, green and blue channels. The rejected
  // slate panel was nearly neutral; brightness alone must not satisfy this.
  const warm = rgb[0] > rgb[1] * 1.15 && rgb[1] > rgb[2] * 1.2;
  console.log(JSON.stringify({ path, rgb, warm }));
  if (!warm) failed = true;
}
if (failed) {
  console.error('FAIL: tent inner canvas lost its warm cloth colour');
  process.exitCode = 1;
}

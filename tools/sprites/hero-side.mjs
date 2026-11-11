// Makes the hero's side view one drawing. The sheet's side walk began on a frame that was the old standing
// pose, in flatter colours and with other hair than the five frames after it, and the side idle row was that
// same old drawing. On screen the hero turned into someone else for a tenth of a second in every step, and
// again on stopping.
//
// The fix uses the side walk's own passing pose (frame 3: feet together, drawn like the strides):
//   - side walk frame 0 becomes that pose, so the cycle is pass, stride, stride, pass, stride, stride;
//   - the four side idle frames become that pose, breathing: the body above the belt sinks one pixel for two frames.
// It changes nothing when the sheet is already fixed.
//   bun tools/sprites/hero-side.mjs [--dry]
// hero.png is one of the frozen sheets, so this also records its new hash in the two baselines that hold it:
// assets-src/block-baseline-2.json and assets-src/story-baseline-3.json.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '../..');
const file = resolve(root, 'public/assets/sprites/hero.png');
const BASELINES = ['assets-src/block-baseline-2.json', 'assets-src/story-baseline-3.json'];
const manifest = JSON.parse(readFileSync(resolve(root, 'public/assets/manifest.json'), 'utf8'));
const hero = manifest.sprites.hero, [fw, fh] = hero.frame;
const IDLE = hero.animations.idle.rows.side, WALK = hero.animations.walk.rows.side, PASS = 3;
/** The row of pixels at the hero's belt, counted from the top of a frame. Everything above it breathes. */
const BELT = 90;

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const at = (row, frame, x, y) => ((row * fh + y) * info.width + frame * fw + x) * 4;
const read = (row, frame) => { const cell = new Uint8Array(fw * fh * 4); for (let y = 0; y < fh; y++) cell.set(data.subarray(at(row, frame, 0, y), at(row, frame, 0, y) + fw * 4), y * fw * 4); return cell; };
const write = (row, frame, cell) => { for (let y = 0; y < fh; y++) data.set(cell.subarray(y * fw * 4, (y + 1) * fw * 4), at(row, frame, 0, y)); };
const same = (a, b) => a.every((v, i) => v === b[i]);

const pose = read(WALK, PASS);
// The same pose a breath later: the rows above the belt move down one pixel, and the belt's own row is covered.
const breath = new Uint8Array(pose);
for (let y = BELT; y >= 1; y--) breath.set(pose.subarray((y - 1) * fw * 4, y * fw * 4), y * fw * 4);
breath.fill(0, 0, fw * 4);

/** Writes the sheet's hash into each baseline that holds another. The hash is replaced in the text, so nothing else in the file moves. */
function record() {
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  for (const name of BASELINES) {
    const text = readFileSync(resolve(root, name), 'utf8'), next = text.replace(/("sprites\/hero\.png":\s*")[0-9a-f]{64}(")/, `$1${hash}$2`);
    if (next === text) continue;
    writeFileSync(resolve(root, name), next);
    console.log(`${name}: recorded the new hash of sprites/hero.png`);
  }
}

if (same(read(WALK, 0), pose) && same(read(IDLE, 0), pose)) { console.log('hero.png: the side view is already one drawing; nothing changed'); record(); process.exit(0); }
write(WALK, 0, pose);
[pose, pose, breath, breath].forEach((cell, frame) => write(IDLE, frame, cell));
console.log(`hero.png: side walk frame 0 and the ${hero.animations.idle.frames} side idle frames now use the side walk's passing pose`);
if (process.argv.includes('--dry')) process.exit(0);
writeFileSync(file, await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer());
record();

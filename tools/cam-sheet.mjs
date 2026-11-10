// Contact sheets of the camera shots from tools/cam-shots.mjs: one <camera>.png per camera, its four places
// in a grid with a label on each. The tilt camera gets one sheet with both zoom steps side by side.
//   bun tools/cam-sheet.mjs [--dir .artifacts/camera]
import { resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const dir = resolve(import.meta.dirname, '..', opt('dir', '.artifacts/camera'));

const PLACES = [['spawn', 'Grant stone, with Tamsin'], ['meadow', 'Meadow'], ['rocks', 'Mossy rocks and pool'], ['town', 'Town square']];
const SHEETS = {
  today: [['today', '']],
  horizon: [['horizon', '']],
  tilt: [['tilt-near', 'nearest step'], ['tilt-mid', 'second step']],
  shoulder: [['shoulder', '']],
  crane: [['crane', '']],
};
const W = 720, H = 450, GAP = 6;

// Top left, where the game draws nothing.
const label = (text) => Buffer.from(`<svg width="380" height="34"><rect width="100%" height="100%" fill="#000" fill-opacity="0.55"/>`
  + `<text x="12" y="23" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#fff">${text}</text></svg>`);

for (const [sheet, columns] of Object.entries(SHEETS)) {
  // One column per zoom step when there are two; otherwise the four places in two by two.
  const tiles = columns.length > 1
    ? PLACES.flatMap(([place, name]) => columns.map(([shot, step]) => ({ file: `${shot}-${place}.png`, text: `${sheet}, ${step}: ${name}` })))
    : PLACES.map(([place, name]) => ({ file: `${columns[0][0]}-${place}.png`, text: `${sheet}: ${name}` }));
  const across = 2, down = Math.ceil(tiles.length / across);
  const parts = [];
  for (const [i, tile] of tiles.entries()) {
    const left = (i % across) * (W + GAP), top = Math.floor(i / across) * (H + GAP);
    parts.push({ input: await sharp(resolve(dir, tile.file)).resize(W, H).toBuffer(), left, top });
    parts.push({ input: label(tile.text), left, top });
  }
  await sharp({ create: { width: across * W + (across - 1) * GAP, height: down * H + (down - 1) * GAP, channels: 3, background: '#111' } })
    .composite(parts).png().toFile(resolve(dir, `${sheet}.png`));
  console.log(`wrote ${sheet}.png`);
}

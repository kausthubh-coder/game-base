// Contact sheets for the cut-out way, from pictures taken with tools/shot.mjs:
//   bun demos/opening/cutout/sheet.mjs five <folder>   every shot's five moments, one row a shot
//   bun demos/opening/cutout/sheet.mjs plates <folder>  each shot's middle moment beside the mockup's plate
import sharp from 'sharp';

const [mode, dir] = process.argv.slice(2);
const SHOTS = ['war', 'king', 'friends', 'roads', 'sickness', 'night', 'gods', 'mark', 'wall', 'doorstep', 'morning'];
const PLATES = ['m1-war', 'm2-king', 'm3-friends', 'm4-roads', 'm5-sickness', 'm6-ascent', 'm7-gods', 'm8-hand', 'p1-wall', 'p2-doorstep', 'p9-doorstep-day'];
const TIMES = ['0.05', '0.3', '0.5', '0.75', '0.97'];
const TW = 384, TH = 216, GAP = 6;

const tile = (path) => sharp(path).resize(TW, TH).png().toBuffer();
const comps = [];
let cols;
if (mode === 'five') {
  cols = TIMES.length;
  for (const [r, s] of SHOTS.entries()) for (const [c, p] of TIMES.entries()) comps.push({ input: await tile(`${dir}/${s}-${p}.png`), left: c * (TW + GAP), top: r * (TH + GAP) });
} else {
  cols = 4;
  for (const [i, s] of SHOTS.entries()) {
    const r = Math.floor(i / 2), c = (i % 2) * 2;
    comps.push({ input: await tile(`demos/opening/art/plates/${PLATES[i]}.jpg`), left: c * (TW + GAP), top: r * (TH + GAP) });
    comps.push({ input: await tile(`${dir}/${s}-0.5.png`), left: (c + 1) * (TW + GAP), top: r * (TH + GAP) });
  }
}
const rows = Math.ceil(comps.length / cols);
const out = `${dir}/sheet-${mode}.jpg`;
await sharp({ create: { width: cols * (TW + GAP), height: rows * (TH + GAP), channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
console.log(out);

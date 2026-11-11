// Side-by-side sheets of the town shots (tools/town-shots.mjs): for each view and time, today's town, A and B
// in a row with a label over each, and one sheet per layout with its views down and its times across.
//   bun tools/town-sheet.mjs --in .artifacts/shots --out <folder> [--towns now,a,b]
// It reads <in>/<town>/<town>-<view>-<time>.png and writes <out>/sheet-<view>-<time>.png and <out>/sheet-<town>.png.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const input = resolve(root, opt('in', '.artifacts/shots'));
const out = resolve(root, opt('out', '.artifacts/shots/sheets'));
const towns = opt('towns', 'now,a,b').split(',');
const VIEWS = ['far', 'approach', 'square'];
const TIMES = ['noon', 'dusk', 'night'];
const NAMES = { now: 'Today', a: 'A · The Queen\'s Granary', b: 'B · The Hollow Oak' };
const W = 720, H = 450, LABEL = 40;
mkdirSync(out, { recursive: true });

const label = (text) => Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#1c1a20"/><text x="14" y="27" font-family="Helvetica, Arial" font-size="20" fill="#f4ecd8">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const tile = (town, view, time) => sharp(resolve(input, town, `${town}-${view}-${time}.png`)).resize(W, H).toBuffer();

async function sheet(cells, cols, file) {
  const rows = Math.ceil(cells.length / cols);
  const parts = [];
  for (let i = 0; i < cells.length; i++) {
    const x = (i % cols) * W, y = Math.floor(i / cols) * (H + LABEL);
    parts.push({ input: label(cells[i].text), left: x, top: y }, { input: await cells[i].image, left: x, top: y + LABEL });
  }
  await sharp({ create: { width: cols * W, height: rows * (H + LABEL), channels: 3, background: '#1c1a20' } }).composite(parts).png().toFile(resolve(out, file));
  console.log(`wrote ${file}`);
}

for (const view of VIEWS) for (const time of TIMES) {
  await sheet(towns.map((town) => ({ text: `${NAMES[town] ?? town} · ${view} · ${time}`, image: tile(town, view, time) })), towns.length, `sheet-${view}-${time}.png`);
}
for (const town of towns) {
  await sheet(VIEWS.flatMap((view) => TIMES.map((time) => ({ text: `${NAMES[town] ?? town} · ${view} · ${time}`, image: tile(town, view, time) }))), TIMES.length, `sheet-${town}.png`);
}

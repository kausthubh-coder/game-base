// Repairs a sprite sheet without drawing a pixel: what a tool can put right, so an artist is asked only for
// what needs one.
//   bun tools/art/repair.mjs <sheet> --height     worldHeight in the manifest becomes what the concept sheet states
//                                                 (people, creatures with a stated size) or, for an action or
//                                                 variant sheet, what makes it stand as tall as its character
//   bun tools/art/repair.mjs <sheet> --anchor     every frame's feet go on the anchor's row, and in a loop the
//                                                 body stays in one column instead of the bounding box's middle
//   bun tools/art/repair.mjs <sheet> --defringe   clears specks cut off from the figure, half-transparent pixels and
//                                                 a pale rim, ring by ring
//   --dry prints what it would do. Several repairs may be given at once.
// Moving and clearing pixels is all it does: it never recolours or resizes one. After it, look:
//   bun tools/art/review.mjs <sheet> --before HEAD
// A sheet a build script owns is written back by the next build, so `--height` also says which line of
// tools/sprites/story-config.mjs to change when that file sets the height.
import fs from 'node:fs';
import sharp from 'sharp';
import { at, characterOf, contract, cut, luma, manifest, measure, pixels, solid, style } from './lib.mjs';
import { facts } from './rules.mjs';

const args = process.argv.slice(2), name = args[0], dry = args.includes('--dry');
const m = manifest(), c = contract(), s = style(), entry = m.sprites[name];
if (!entry || args.length < 2) { console.error('usage: bun tools/art/repair.mjs <sheet> [--height] [--anchor] [--defringe] [--dry]'); process.exit(2); }
const who = characterOf(name, c);
let manifestChanged = false, sheetChanged = false;

if (args.includes('--height')) {
  const cache = new Map(), get = async (n) => { if (!cache.has(n)) cache.set(n, await facts(n, m, c)); return cache.get(n); };
  const mine = await get(name), hero = await get('hero'), stated = c.characters[who.id]?.stated;
  let want = null, why = '';
  if (who.id !== name && m.sprites[who.id] && mine.stands) { const base = await get(who.id); want = entry.worldHeight * base.blocks / mine.blocks; why = `stands as tall as ${who.id} (${base.blocks.toFixed(2)} blocks)`; }
  else if (stated && !stated.of && !stated.exaggerated) { const heroes = (stated.metres ?? stated.blocks) / stated.hero; want = entry.worldHeight * (heroes * hero.blocks) / mine.blocks; why = `${heroes.toFixed(2)} heroes tall, as its concept sheet states`; }
  if (want === null) console.log(`${name}: no height to repair to (no stated whole height, and it is its character's first sheet)`);
  else {
    want = Math.round(want * 100) / 100;
    console.log(`${name}: worldHeight ${entry.worldHeight} -> ${want}: ${why}; ${(entry.frame[1] / want).toFixed(0)} pixels a block`);
    const config = fs.readFileSync(at('tools/sprites/story-config.mjs'), 'utf8');
    if (new RegExp(`['"\\[. ]${name}['"\\]]?[=:]`).test(config)) console.log(`  tools/sprites/story-config.mjs sets ${name}'s worldHeight: change it there too, or the next build writes ${entry.worldHeight} back`);
    entry.worldHeight = want; manifestChanged = true;
  }
}

if (args.includes('--anchor') || args.includes('--defringe')) {
  const p = await pixels(entry.sheet), [fw, fh] = entry.frame;
  const sheet = { data: Buffer.from(p.data), w: p.w, h: p.h };
  const put = (f, left, top) => { for (let y = 0; y < fh; y++) f.data.copy(sheet.data, ((top + y) * sheet.w + left) * 4, y * fw * 4, (y + 1) * fw * 4); };
  for (const [anim, a] of Object.entries(entry.animations)) for (const [dir, row] of Object.entries(a.rows)) {
    const cells = [];
    for (let col = 0; col < a.frames; col++) cells.push(cut(sheet, col * fw, row * fh, fw, fh));
    if (args.includes('--defringe')) for (const [col, f] of cells.entries()) {
      const cleared = defringe(f);
      if (!cleared) continue;
      console.log(`${name} ${anim} ${dir} frame ${col + 1}: ${cleared} pixels cleared`); sheetChanged = true;
      // Peeling a rim off the feet lifts them a row: they go back on the anchor's row.
      const x = measure(f);
      if (!x.empty && !who.flies && x.bottom !== entry.anchor[1]) cells[col] = shift(f, 0, entry.anchor[1] - x.bottom);
    }
    if (args.includes('--anchor')) {
      const ms = cells.map((f) => measure(f)), loop = c.poses.loops.includes(anim);
      const column = loop ? ms.find((x) => !x.empty)?.body : null;
      // The first frame keeps its place sideways; the others bring their body to its column.
      const first = ms.find((x) => !x.empty);
      for (const [col, f] of cells.entries()) {
        const x = ms[col]; if (x.empty) continue;
        const dy = who.flies ? 0 : entry.anchor[1] - x.bottom;
        let dx = loop && x !== first ? Math.round(column - x.body) : 0;
        if (Math.abs(dx) < 2) dx = 0; // a pixel of sway is the drawing breathing, not a slip
        dx = Math.max(1 - x.left, Math.min(fw - 2 - x.right, dx));
        if (!dx && !dy) continue;
        cells[col] = shift(f, dx, dy);
        console.log(`${name} ${anim} ${dir} frame ${col + 1}: moved ${dx} across, ${dy} down`); sheetChanged = true;
      }
    }
    for (const [col, f] of cells.entries()) put(f, col * fw, row * fh);
  }
  if (sheetChanged && !dry) await sharp(sheet.data, { raw: { width: sheet.w, height: sheet.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(at('public/assets/' + entry.sheet));
}
if (manifestChanged && !dry) fs.writeFileSync(at('public/assets/manifest.json'), JSON.stringify(m, null, 2) + '\n');
console.log(dry ? 'dry run: nothing written' : sheetChanged || manifestChanged ? `written. Now: bun tools/art/review.mjs ${name} --before HEAD, then bun tools/verify-assets.mjs` : 'nothing to repair');

function shift(f, dx, dy) {
  const data = Buffer.alloc(f.data.length);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const sx = x - dx, sy = y - dy;
    if (sx < 0 || sy < 0 || sx >= f.w || sy >= f.h) continue;
    f.data.copy(data, (y * f.w + x) * 4, (sy * f.w + sx) * 4, (sy * f.w + sx) * 4 + 4);
  }
  return { data, w: f.w, h: f.h };
}

/** Clears soft pixels, specks far smaller than the figure, and a pale rim. Returns how many pixels it cleared. */
function defringe(f) {
  let cleared = 0;
  const clear = (i) => { if (f.data[i * 4 + 3]) { f.data.fill(0, i * 4, i * 4 + 4); cleared++; } };
  for (let i = 0; i < f.w * f.h; i++) { const a = f.data[i * 4 + 3]; if (a > 0 && a < 128) clear(i); else if (a >= 128 && a < 255) f.data[i * 4 + 3] = 255; }
  // Specks: connected pieces under 1% of the largest piece, and under 12 pixels.
  const seen = new Uint8Array(f.w * f.h), pieces = [];
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || !f.data[i * 4 + 3]) continue;
    const queue = [i]; seen[i] = 1;
    for (let q = 0; q < queue.length; q++) {
      const k = queue[q], x = k % f.w, y = (k - x) / f.w;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]]) {
        const n = ny * f.w + nx;
        if (nx >= 0 && ny >= 0 && nx < f.w && ny < f.h && !seen[n] && f.data[n * 4 + 3]) { seen[n] = 1; queue.push(n); }
      }
    }
    pieces.push(queue);
  }
  const largest = Math.max(0, ...pieces.map((q) => q.length));
  for (const q of pieces) if (q.length < 12 && q.length < largest * 0.01) q.forEach(clear);
  // A pale rim: an edge pixel that is near white, or far lighter than the pixel behind it. Peeled ring by ring.
  for (let ring = 0; ring < 4; ring++) {
    const pale = [];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (!solid(f, x, y)) continue;
      const inward = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !solid(f, x - dx, y - dy) && solid(f, x + dx, y + dy));
      if (!inward) continue;
      const o = (y * f.w + x) * 4, i = ((y + inward[1]) * f.w + x + inward[0]) * 4;
      const l = luma(f.data[o], f.data[o + 1], f.data[o + 2]), lo = Math.min(f.data[o], f.data[o + 1], f.data[o + 2]), hi = Math.max(f.data[o], f.data[o + 1], f.data[o + 2]);
      if ((lo > 200 && hi - lo < 40) || (l > 0.55 && hi - lo < 48 && l - luma(f.data[i], f.data[i + 1], f.data[i + 2]) > 0.3)) pale.push(y * f.w + x);
    }
    if (!pale.length) break;
    pale.forEach(clear);
  }
  return cleared;
}

// One sprite sheet as a card: the figure to scale beside the hero on day and night ground, its concept sheet,
// every frame of every animation, and each animation's frames laid over each other (a loop that holds still
// shows one clean figure; a frame that jumps shows a ghost). `see.mjs` tiles these and `review.mjs` draws one.
import fs from 'node:fs';
import sharp from 'sharp';
import { at, block, characterOf, contract, cut, DIRS, frames, label, manifest, measure, pixels, scaled, style, toPng } from './lib.mjs';

const GAP = 6, INK = '#fff1ce';
/** Where the first strip of a card starts: under the facts line. */
const rowTopOf = () => 24;

/** The same window of every frame, wide enough for all of them, so a jump between frames stays visible. */
function windowOf(list, measures, size) {
  let left = size, right = 0, top = size, bottom = 0;
  for (const m of measures) if (!m.empty) { left = Math.min(left, m.left); right = Math.max(right, m.right); top = Math.min(top, m.top); bottom = Math.max(bottom, m.bottom); }
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  return { left, top, w: Math.min(size, right + 3) - left, h: Math.min(size, bottom + 3) - top };
}

/** Frames laid over each other, each a little see-through. */
async function onion(list, win, k) {
  const layers = [];
  for (const f of list) {
    const c = cut(f, win.left, win.top, win.w, win.h);
    for (let i = 3; i < c.data.length; i += 4) c.data[i] = Math.round(c.data[i] * (list.length > 1 ? 0.55 : 1));
    layers.push({ input: await scaled(c, k), left: 0, top: 0 });
  }
  return sharp(block(win.w * k, win.h * k, '#00000000')).composite(layers).png().toBuffer();
}

/** The concept sheet, or the contract's crop of it, at a height. Null when the character has none. */
export async function conceptOf(who, height) {
  if (!who.concept) return null;
  let img = sharp(at(who.concept));
  if (who.crop) { const [left, top, width, h] = who.crop; img = img.extract({ left, top, width, height: h }); }
  const { data, info } = await img.resize({ height }).png().toBuffer({ resolveWithObject: true });
  return { input: data, w: info.width, h: info.height };
}

/** The first frame of a direction, at the size the world gives it: `px` pixels a block. */
async function toScale(entry, list, dir, px) {
  const f = list.find((x) => x.dir === dir) ?? list[0];
  return { input: await scaled(f, (entry.worldHeight / entry.frame[1]) * px), size: Math.round(entry.worldHeight * px), feet: entry.anchor[1] / entry.frame[1] };
}

/**
 * Draws the card of `name`. Returns `{ input, w, h, facts }`: a PNG, its size, and the measures printed on it.
 * `sheetOverride` draws another file in place of the manifest's sheet (the `before` of a repair).
 */
export async function card(name, { m = manifest(), s = style(), c = contract(), width = 1400, entryOverride = null } = {}) {
  const entry = entryOverride ?? m.sprites[name], who = characterOf(name, c), hero = m.sprites.hero;
  const list = await frames(entry), measures = list.map((f) => measure(f)), size = entry.frame[0];
  const heroList = name === 'hero' ? list : await frames(hero);
  const layers = [];
  let y = 0;

  // The facts line.
  const stand = measures.filter((x, i) => !x.empty && list[i].anim === list[0].anim);
  const tall = Math.max(...stand.map((x) => x.height)), blocks = (tall * entry.worldHeight) / entry.frame[1];
  const heroTall = Math.max(...heroList.filter((f) => f.anim === 'idle').map((f) => measure(f).height)) * hero.worldHeight / hero.frame[1];
  const stated = c.characters[who.id]?.stated, want = stated ? (stated.metres ?? stated.blocks) / stated.hero : null;
  const solidOnes = measures.filter((x) => !x.empty), mean = (k) => solidOnes.reduce((sum, x) => sum + x[k], 0) / solidOnes.length;
  const facts = {
    kind: who.kind, character: who.id, blocks, heroes: blocks / heroTall, want, density: entry.frame[1] / entry.worldHeight,
    bare: mean('bare'), halo: mean('halo'), pale: mean('pale'),
  };
  const text = `${name}  ${who.kind ?? '?'}${who.id !== name ? ' of ' + who.id : ''}  ${blocks.toFixed(2)} blocks = ${facts.heroes.toFixed(2)} heroes${want ? ` (sheet says ${want.toFixed(2)})` : ''}  ${facts.density.toFixed(0)} px/block  no-outline ${(facts.bare * 100).toFixed(0)}%  halo ${(facts.halo * 100).toFixed(1)}%`;
  layers.push(label(text, 4, y + 2, INK, 14)); y += 24;

  // To scale: the hero, then front, back and side, on day ground at 128 pixels a block and under it on night
  // ground at 64. A giant is drawn smaller, so the tallest figure stays under 420 pixels; the hero shrinks with it.
  const day = Math.min(128, Math.floor(420 / Math.max(entry.worldHeight, hero.worldHeight)));
  let right = 0, conceptTop = y;
  for (const [ground, px] of [[s.grounds.day, day], [s.grounds.night, day / 2]]) {
    const figures = [await toScale(hero, heroList, 'front', px)];
    for (const dir of DIRS) if (list.some((f) => f.dir === dir)) figures.push(await toScale(entry, list, dir, px));
    const high = Math.max(...figures.map((f) => f.size)), w = figures.reduce((sum, f) => sum + f.size + 4, 8), floor = Math.max(...figures.map((f) => f.size * f.feet));
    layers.push({ input: block(w, high + 8, ground), left: 4, top: y });
    let fx = 8;
    for (const f of figures) { layers.push({ input: f.input, left: fx, top: y + 4 + floor - f.size * f.feet }); fx += f.size + 4; }
    if (ground === s.grounds.day) right = w + 4 + GAP; else right = Math.max(right > width - 120 ? 0 : right, 0);
    if (ground === s.grounds.day && right > width - 120) conceptTop = y + high + 8 + GAP;
    y += high + 8 + GAP;
  }
  // The concept sheet: right of the day strip when there is room, else right of the night strip.
  const beside = conceptTop === rowTopOf(layers) ? right : Math.round(day / 2 * entry.worldHeight) * 4 + 40;
  const concept = await conceptOf(who, Math.max(160, y - conceptTop - GAP));
  if (concept) {
    const room = width - beside - 4, k = Math.min(1, room / concept.w);
    layers.push({ input: k < 1 ? await sharp(concept.input).resize({ width: Math.floor(concept.w * k) }).png().toBuffer() : concept.input, left: beside, top: conceptTop });
    y = Math.max(y, conceptTop + Math.round(concept.h * k) + GAP);
  }

  // Every frame of every animation, one line a direction when the sheet is wide, with the loop at the end.
  const win = windowOf(list, measures, size), k = win.w * 12 > width && size > 128 ? 0.5 : 1;
  for (const anim of Object.keys(entry.animations)) {
    const mine = list.filter((f) => f.anim === anim);
    let fx = 4, lineH = Math.round(win.h * k);
    layers.push(label(`${anim} ${entry.animations[anim].frames}f @${entry.animations[anim].fps}`, 4, y, INK, 11)); y += 15;
    for (const dir of DIRS) {
      const frameList = mine.filter((f) => f.dir === dir);
      if (!frameList.length) continue;
      const need = (frameList.length + 1.2) * win.w * k + 10;
      if (fx > 4 && fx + need > width) { fx = 4; y += lineH + 2; }
      layers.push({ input: block(frameList.length * win.w * k, lineH, s.grounds.day), left: fx, top: y });
      for (const f of frameList) { layers.push({ input: await scaled(cut(f, win.left, win.top, win.w, win.h), k), left: Math.round(fx), top: y }); fx += win.w * k; }
      layers.push({ input: block(win.w * k, lineH, s.grounds.night), left: Math.round(fx + 2), top: y });
      layers.push({ input: await onion(frameList, win, k), left: Math.round(fx + 2), top: y });
      fx += win.w * k + 12;
    }
    y += lineH + 4;
  }
  const h = y + 4;
  const fitted = [];
  for (const l of layers) {
    l.left = Math.round(l.left); l.top = Math.round(l.top);
    // A layer that would hang over the card's edge is cut to fit, since sharp refuses it otherwise.
    const meta = l.input.create ?? await sharp(l.input).metadata();
    if (l.left >= width || l.top >= h) continue;
    if (l.left + meta.width <= width && l.top + meta.height <= h) { fitted.push(l); continue; }
    const cutTo = { left: 0, top: 0, width: Math.min(meta.width, width - l.left), height: Math.min(meta.height, h - l.top) };
    fitted.push({ ...l, input: await sharp(l.input.create ? { create: l.input.create } : l.input).extract(cutTo).png().toBuffer() });
  }
  const input = await sharp(block(width, h, '#3a3340')).composite(fitted).png().toBuffer();
  return { input, w: width, h, facts, name };
}

/** Stacks cards into pages no taller than `maxHeight`, written as <out>-<n>.png. Returns the paths. */
export async function pages(cards, out, { width = 1400, maxHeight = 2000 } = {}) {
  const paths = []; let batch = [], high = 0;
  // Pages left by an earlier, longer run would pass for this run's.
  const dir = at(out.slice(0, out.lastIndexOf('/'))), stem = out.slice(out.lastIndexOf('/') + 1);
  for (const f of fs.readdirSync(dir)) if (new RegExp(`^${stem}-\\d+\\.png$`).test(f)) fs.rmSync(`${dir}/${f}`);
  const flush = async () => {
    if (!batch.length) return;
    let top = 0; const layers = [];
    for (const c of batch) { layers.push({ input: c.input, left: 0, top }); top += c.h + 4; }
    const path = `${out}-${String(paths.length + 1).padStart(2, '0')}.png`;
    await sharp(block(width, top, '#15131a')).composite(layers).png().toFile(at(path));
    paths.push(path + (batch[0].name ? '  ' + batch.map((c) => c.name).join(' ') : '')); batch = []; high = 0;
  };
  for (const c of cards) { if (high + c.h > maxHeight) await flush(); batch.push(c); high += c.h + 4; }
  await flush();
  return paths;
}

export { toPng, pixels };

// Every 2D asset the game ships, the way a player meets it, as contact sheets to look at.
//   bun tools/art/see.mjs [--only sprites,portraits,icons,kit] [--names hero,fox]
//       No browser and no slot. Everything in under a minute; one character (`--names`) in a second.
//   bun tools/slot.mjs --look -- bun tools/art/see.mjs --only world,talk [--names ...] --url http://localhost:<port>
//       Through the debug door of a game somebody started (`bun run dev`, outside the queue). All of it is under a
//       minute each for world and talk, so it fits the look lane; run the two separately when the machine is loaded.
// Writes .artifacts/art/see/ and prints each path:
//   sprites-<n>.png    a card a sheet, grouped by character: to scale beside the hero on day and night ground, the
//                      concept sheet, every frame of every animation, each animation's frames laid over each other
//   loops/<name>.webp  each sheet's animations playing, for a person to watch
//   portraits-<n>.png  each person's faces at 128 and in the dialogue's round frame, beside the sprite and the sheet
//   icons-<n>.png      each icon at 64 and 32 pixels on the dark well and on parchment; crops too
//   kit-<n>.png        each painted interface piece on dark and on parchment
//   world-<n>.png      each character standing in the world at the game's camera beside the hero
//   talk-<n>.png       each portrait in the real dialogue box
// `bun tools/ui-shots.mjs` draws the HUD, the bag and the panels with their icons and kit pieces in place.
// Looking is the point: this command checks nothing. `bun tools/art/check.mjs` is the one that fails.
import fs from 'node:fs';
import sharp from 'sharp';
import { card, conceptOf, pages } from './card.mjs';
import { HEAD } from './rules.mjs';
import { at, block, characterOf, contract, cut, frames, label, manifest, measure, pixels, portraitRank, scaled, style } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const only = opt('only', 'sprites,portraits,icons,kit').split(',');
const names = opt('names', '').split(',').filter(Boolean);
const m = manifest(), s = style(), c = contract();
const out = '.artifacts/art/see';
fs.mkdirSync(at(out + '/loops'), { recursive: true });

/** Sheets in the contract's order, each character's own sheets together. */
export function order() {
  const list = [];
  for (const [id, who] of Object.entries(c.characters)) for (const n of [id, ...(who.sheets ?? []), ...(who.variants ?? [])]) if (m.sprites[n] && !list.includes(n)) list.push(n);
  for (const n of Object.keys(m.sprites)) if (!list.includes(n)) list.push(n);
  return names.length ? list.filter((n) => names.includes(n) || names.includes(characterOf(n, c).id)) : list;
}

if (only.includes('sprites')) {
  const cards = [];
  for (const name of order()) {
    cards.push(await card(name, { m, s, c }));
    // The loop, playing: every animation's front row (or its only row), twice the size, on day ground.
    const entry = m.sprites[name], list = await frames(entry), frameList = [], delays = [];
    for (const anim of Object.keys(entry.animations)) for (const f of list.filter((x) => x.anim === anim && x.dir === (list.some((y) => y.anim === anim && y.dir === 'side') ? 'side' : 'front'))) {
      frameList.push(await sharp(block(f.w * 2, f.h * 2, s.grounds.day)).composite([{ input: await scaled(f, 2) }]).png().toBuffer());
      delays.push(Math.round(1000 / f.fps));
    }
    await sharp(frameList, { join: { animated: true } }).webp({ loop: 0, delay: delays, lossless: true }).toFile(at(`${out}/loops/${name}.webp`));
  }
  for (const p of await pages(cards, out + '/sprites')) console.log(p);
  console.log(`${out}/loops/  (${cards.length} animated loops)`);
}

if (only.includes('portraits')) {
  const sheet = await pixels(m.portraits.sheet), tile = m.portraits.tile, rows = [];
  const people = [...new Set(Object.keys(m.portraits.names).map((n) => n.replace(/-(calm|glad|troubled)$/, '')))].filter((n) => !names.length || names.includes(n));
  // Every sprite's head colours, so a portrait can be ranked against all of them.
  const heads = {};
  for (const [n, e] of Object.entries(m.sprites)) { const f = (await frames(e)).find((x) => x.dir === 'front'); if (f) heads[n] = measure(f, HEAD).families; }
  const ring = Buffer.from('<svg width="112" height="112"><circle cx="56" cy="56" r="56" fill="#fff"/></svg>');
  for (const who of people) {
    const layers = [label(who, 4, 2, '#fff1ce', 14)]; let x = 4;
    const faces = ['', '-calm', '-glad', '-troubled'].filter((e) => m.portraits.names[who + e]);
    for (const e of faces) {
      const [col, row] = m.portraits.names[who + e], p = cut(sheet, col * tile, row * tile, tile, tile);
      layers.push({ input: block(tile, tile, s.grounds.parchment), left: x, top: 22 }, { input: await scaled(p, 1), left: x, top: 22 }, label(e || 'bare', x, 152, '#b2a8b0', 11));
      x += tile + 4;
      // In the dialogue's frame: 112 pixels, round, smoothed as the box draws it.
      const round = await sharp(await scaled(p, 112 / tile)).composite([{ input: ring, blend: 'dest-in' }]).png().toBuffer();
      layers.push({ input: block(120, tile, s.grounds.well), left: x, top: 22 }, { input: round, left: x + 4, top: 30 });
      x += 124;
    }
    const entry = m.sprites[who];
    let note = 'no sprite of this name';
    if (entry) {
      const f = (await frames(entry)).find((v) => v.dir === 'front');
      const k = Math.min(2, 256 / f.w);
      layers.push({ input: block(256, 166, s.grounds.day), left: x, top: 22 }, { input: await scaled(cut(f, 0, 0, f.w, Math.round(f.h * 0.65)), k), left: x, top: 22 });
      x += 260;
      const [col, row] = m.portraits.names[who + faces[0]], fam = measure(cut(sheet, col * tile, row * tile, tile, tile)).families;
      const { rank, like, nearest, count } = portraitRank(fam, heads, who, c);
      note = `colours match own sprite ${like.toFixed(2)}, rank ${rank} of ${count} characters (nearest: ${nearest})`;
    }
    const concept = await conceptOf(characterOf(who, c), 166);
    if (concept) layers.push({ input: concept.input, left: x, top: 22 });
    layers.push(label(note, 140, 4, '#b2a8b0', 11));
    rows.push({ name: who, input: await sharp(block(1500, 192, '#3a3340')).composite(layers.filter((l) => (l.left ?? 0) < 1500)).png().toBuffer(), w: 1500, h: 192 });
  }
  for (const p of await pages(rows, out + '/portraits', { width: 1500, maxHeight: 1800 })) console.log(p);
}

/** A grid of small cells, each drawn by `draw(item) -> layers at 0,0`, paged. */
async function grid(items, cellW, cellH, per, draw, name) {
  const cells = [];
  for (let i = 0; i < items.length; i += per) {
    const layers = [];
    for (const [j, item] of items.slice(i, i + per).entries()) for (const l of await draw(item)) layers.push({ ...l, left: (l.left ?? 0) + j * cellW, top: l.top ?? 0 });
    cells.push({ input: await sharp(block(cellW * per, cellH, '#3a3340')).composite(layers).png().toBuffer(), w: cellW * per, h: cellH });
  }
  for (const p of await pages(cells, `${out}/${name}`, { width: cellW * per, maxHeight: 1900 })) console.log(p);
}

if (only.includes('icons')) {
  const sets = [['main', m.icons], ...Object.entries(m.icons.sheets ?? {}), ['crops', { ...m.crops, names: Object.fromEntries(Object.entries(m.crops.names).flatMap(([n, cells]) => cells.map((xy, i) => [`${n} ${i + 1}`, xy]))) }]];
  const items = [];
  for (const [set, def] of sets) {
    const p = await pixels(def.sheet), seen = new Set();
    for (const [n, [col, row]] of Object.entries(def.names)) {
      if (seen.has(col + ',' + row)) continue; // an alias of a cell already shown
      seen.add(col + ',' + row);
      items.push({ set, n, p: cut(p, col * def.tile, row * def.tile, def.tile, def.tile), tile: def.tile });
    }
  }
  await grid(items, 216, 96, 7, async ({ set, n, p, tile }) => {
    const layers = [];
    for (const [j, bg] of [s.grounds.well, s.grounds.parchment].entries()) {
      layers.push({ input: block(104, 72, bg), left: 2 + j * 106, top: 2 });
      layers.push({ input: await scaled(p, 64 / tile), left: 6 + j * 106, top: 6 }, { input: await scaled(p, 32 / tile), left: 72 + j * 106, top: 22 });
    }
    layers.push(label(`${set}/${n}`.slice(0, 30), 2, 76, '#d3c8c6', 11));
    return layers;
  }, 'icons');
}

if (only.includes('kit')) {
  const items = [...Object.entries(m.uikit.images), ...Object.entries(m.ui).filter(([n]) => n !== 'title')];
  await grid(items, 380, 210, 4, async ([n, path]) => {
    const meta = await sharp(at('public/assets/' + path)).metadata(), k = Math.min(1, 180 / meta.width, 170 / meta.height);
    const img = await sharp(at('public/assets/' + path)).resize(Math.round(meta.width * k), Math.round(meta.height * k)).png().toBuffer();
    return [
      { input: block(186, 178, s.grounds.well), left: 2, top: 2 }, { input: img, left: 5, top: 5 },
      { input: block(186, 178, s.grounds.parchment), left: 190, top: 2 }, { input: img, left: 193, top: 5 },
      label(`${n} ${meta.width}x${meta.height}${k < 1 ? ` at ${(k * 100).toFixed(0)}%` : ''}`, 2, 186, '#d3c8c6', 12),
    ];
  }, 'kit');
}

if (only.some((o) => ['world', 'talk', 'ui'].includes(o))) {
  const { stage } = await import('./stage.mjs');
  for (const p of await stage({ only, names: order(), out, url: opt('url', process.env.PLAY_PORT ? `http://127.0.0.1:${process.env.PLAY_PORT}` : '') })) console.log(p);
}

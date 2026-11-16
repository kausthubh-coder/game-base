// The parts of `see.mjs` and `review.mjs` that need the running game: figures standing in the world at the
// game's own camera beside the hero, and portraits in the real dialogue box. Everything goes through the debug
// door (`window.__game`), on a game somebody else started: `bun run dev` on the doctor's port, then
// `bun tools/slot.mjs --look -- bun tools/art/see.mjs --only world --url http://localhost:<port>`.
import fs from 'node:fs';
import sharp from 'sharp';
import { launchChrome } from '../lib/chrome.mjs';
import { at, block, label, manifest } from './lib.mjs';

/** Open, flat meadow near the home plot, where nothing stands between the camera and a row of figures. */
const SPOT = [18, -334];
const W = 1440, H = 900;

async function open(browser, url, query) {
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.setDefaultTimeout(180000);
  await page.goto(`${url}/?${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game);
  return { page, errors };
}

/**
 * Stands `names` in a row beside the hero, front to the camera, and returns the screenshot. `space` is blocks
 * between figures. `time` is the hour as a share of the day (0.5 noon, 0.9 night).
 */
export async function lineUp(page, names, { space = 2, time = 0.5, anim = null } = {}) {
  // Each figure holds its idle, or the first animation of a sheet that has none.
  const sprites = manifest().sprites, anims = names.map((n) => (sprites[n].animations.idle ? 'idle' : Object.keys(sprites[n].animations)[0]));
  const missing = await page.evaluate(async ({ names, anims, space, time, anim, SPOT }) => {
    const g = window.__game, v = g.view;
    g.teleport(SPOT[0], SPOT[1]); g.setTime(time); await g.settle();
    v.root.style.visibility = 'hidden';
    for (const actor of v.game.actors.values()) actor.visible = actor.id === 'player';
    const beam = v.scene.getObjectByName('waypoint-beam'); if (beam) beam.visible = false;
    for (const f of window.artFigures ?? []) f.remove();
    window.artFigures = [];
    const p = v.playerPosition, yaw = v.camera.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw);
    // The hero stands first, at the left of the row; the camera keeps the hero in the middle, so the row is
    // laid out to both sides of it: half to its left, half to its right.
    names.forEach((name, i) => {
      const step = (i < names.length / 2 ? i - Math.ceil(names.length / 2) : i - Math.ceil(names.length / 2) + 1) * space;
      const x = p.x + rx * step, z = p.z + rz * step;
      window.artFigures.push(v.sprites.add(name, { x, y: v.groundAt(x, z), z, facing: Math.PI - yaw, animation: anim ?? anims[i] }));
    });
    await g.frames(12);
    return [...(v.sprites.missing ?? [])];
  }, { names, anims, space, time, anim, SPOT });
  if (missing.length) throw new Error('the game has no sprite ' + missing.join(', '));
  return page.screenshot();
}

/** Runs the parts asked for. Returns the paths written. */
export async function stage({ only, names, out, url }) {
  if (!url) throw new Error('no game to look at: pass --url http://localhost:<port> or set PLAY_PORT (the doctor prints it), with `bun run dev` running');
  const m = manifest(), paths = [];
  fs.mkdirSync(at(out), { recursive: true });
  const browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    if (only.includes('world')) {
      const { page, errors } = await open(browser, url, 'hold=1&seed=7');
      await page.evaluate(async () => { const g = window.__game; g.newGame(); g.manual(true);  await g.settle(); });
      // A row holds figures of one size: six people, six small creatures, or one giant.
      const rows = [];
      const small = names.filter((n) => m.sprites[n].worldHeight <= 2.6), big = names.filter((n) => m.sprites[n].worldHeight > 2.6);
      for (let i = 0; i < small.length; i += 6) rows.push({ names: small.slice(i, i + 6), space: 2.1 });
      for (const n of big) rows.push({ names: [n], space: m.sprites[n].worldHeight > 6 ? 7 : 4.5 });
      const strips = [];
      for (const row of rows) {
        const shot = await lineUp(page, row.names, row);
        const half = row.names.length / 2, order = [...row.names.slice(0, Math.ceil(half)), 'HERO', ...row.names.slice(Math.ceil(half))];
        // The band of the screen the figures stand in; a giant needs the whole height.
        const tall = m.sprites[row.names[0]].worldHeight > 2.6, top = tall ? 0 : 250, high = tall ? H : 330;
        const strip = await sharp(shot).extract({ left: 0, top, width: W, height: high }).png().toBuffer();
        strips.push({ input: await sharp(block(W, high + 20, '#15131a')).composite([{ input: strip, left: 0, top: 0 }, label('left to right: ' + order.join('  '), 4, high + 2, '#fff1ce', 13)]).png().toBuffer(), h: high + 20 });
      }
      if (errors.length) throw new Error(errors.join('\n'));
      let page_ = [], high = 0, n = 0;
      const flush = async () => {
        if (!page_.length) return;
        let top = 0; const layers = page_.map((s) => { const l = { input: s.input, left: 0, top }; top += s.h + 4; return l; });
        const path = `${out}/world-${String(++n).padStart(2, '0')}.png`;
        await sharp(block(W, top, '#15131a')).composite(layers).png().toFile(at(path));
        paths.push(path); page_ = []; high = 0;
      };
      for (const s of strips) { if (high + s.h > 1800) await flush(); page_.push(s); high += s.h + 4; }
      await flush();
      await page.close();
    }
    if (only.includes('talk')) {
      const { page } = await open(browser, url, 'show=talk');
      await page.waitForSelector('[data-show]');
      await page.waitForSelector('.gb-dialogue-portrait > *');
      // The strip the face, the name and the start of the line sit in: the portrait's box, with room round it.
      const box = await page.locator('.gb-dialogue-portrait').boundingBox();
      const clip = { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 28), width: 460, height: Math.min(H - Math.max(0, box.y - 28), box.height + 56) };
      const keys = Object.keys(m.portraits.names).filter((k) => !names.length || names.includes(k.replace(/-(calm|glad|troubled)$/, '')));
      const shots = [];
      for (const key of keys) {
        const drawn = await page.evaluate(({ key, cell, tile }) => {
          // The box draws a portrait as one cell of the sheet, sized and placed in percent; this moves the same
          // element to another cell.
          const face = document.querySelector('.gb-dialogue-portrait > *'), name = document.querySelector('.gb-dialogue-name');
          const [cols, rows] = face.style.backgroundSize.split(' ').map((v) => parseFloat(v) / 100);
          face.style.backgroundPosition = `${(cell[0] / Math.max(1, cols - 1)) * 100}% ${(cell[1] / Math.max(1, rows - 1)) * 100}%`;
          if (name) name.textContent = key;
          return { image: face.style.backgroundImage.slice(0, 80), cols, rows };
        }, { key, cell: m.portraits.names[key], tile: m.portraits.tile });
        if (!drawn.image.includes('portraits') || !(drawn.cols > 0)) throw new Error('the dialogue box does not draw its portrait as a cell of the portrait sheet any more: ' + drawn.image);
        shots.push({ key, input: await page.screenshot({ clip }) });
      }
      // Three boxes across, cut to the left 460 pixels, where the face and the name are.
      const cw = 460, ch = Math.round(clip.height), per = 3;
      for (let i = 0, n = 0; i < shots.length; i += per * 9) {
        const layers = [];
        for (const [j, s] of shots.slice(i, i + per * 9).entries()) {
          const meta = await sharp(s.input).metadata();
          layers.push({ input: await sharp(s.input).extract({ left: 0, top: 0, width: Math.min(cw, meta.width), height: Math.min(ch, meta.height) }).png().toBuffer(), left: (j % per) * (cw + 4), top: Math.floor(j / per) * (ch + 4) });
        }
        const path = `${out}/talk-${String(++n).padStart(2, '0')}.png`;
        await sharp(block(per * (cw + 4), Math.ceil(Math.min(per * 9, shots.length - i) / per) * (ch + 4), '#15131a')).composite(layers).png().toFile(at(path));
        paths.push(path);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return paths;
}

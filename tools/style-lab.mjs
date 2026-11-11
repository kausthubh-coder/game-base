// The style lab's one check: the same places, the same motion and the same reference, for one art style, so any
// two styles can be judged side by side. A style is `?style=<name>` in the address; `base` is the game as it is.
//
//   bun tools/style-lab.mjs --style <name> --url http://127.0.0.1:<port>/ [--out .artifacts/style-lab/<name>]
//     [--query chars=models] [--places spawn,garden,town,meadow] [--quality high] [--skip-places] [--fish [sprite]]
//
// It writes into the out folder:
//   places/<place>.png and places/<place>-low.png   the 2.5D camera, and the closest zoom low toward the horizon
//   motion/<clip>-<n>.png, motion/<clip>.png         frames of each clip, and the clip as one strip (read these)
//   motion/<clip>.gif                                the clip moving, for a person to watch
//   card.png                                         the whole style on one page: reference, places, every strip
//   counts.json                                      draw calls and triangles at every place
// The clips: the hero walking, running, swinging a tool, turning through eight directions; Tamsin talking; the
// nearest creature at the dead garden moving. `--fish` adds the hero casting a rod and holding it, for a style whose
// hero plays a `fish` animation; give the sprite sheet after it when the style draws fishing from its own sheet
// (`--fish hero-fish`). Motion runs on a fixed clock of 30 frames a second of game time; frames are 2 game frames
// apart (15 a second), the creature's 3, fishing's 4. Build and serve first: `bun x vite build --outDir dist-<name>` and `bun tools/serve.mjs`.
// It fails on a console error. This Mac draws WebGL in software: counts only, never frames a second.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const style = opt('style', 'base');
const url = opt('url', 'http://127.0.0.1:5430/');
const out = resolve(root, opt('out', `.artifacts/style-lab/${style}`));
const extra = opt('query', '');
const quality = opt('quality', 'high');
const places = opt('places', 'spawn,garden,town,meadow');
const query = [style === 'base' ? '' : `style=${style}`, extra].filter(Boolean).join('&');
mkdirSync(resolve(out, 'places'), { recursive: true });
mkdirSync(resolve(out, 'motion'), { recursive: true });

// 1. The places, through the same tool every look comparison uses.
if (!args.includes('--skip-places')) {
  const q = query ? query + '&' : '';
  execFileSync('bun', [resolve(root, 'tools/view-shots.mjs'), '--url', url, '--out', resolve(out, 'places'), '--places', places, '--quality', quality,
    '--variants', `tilt=${q}cam=tilt,low=${q}zoomstep=0`], { stdio: 'inherit' });
}

// 2. The motion. Frames are cropped around whoever moves, at a close zoom.
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
// Each motion frame is a 150 px square around the subject, scaled up to 300 so the figure is big enough to judge.
const VW = 1200, VH = 800, CROP = 150, C = 300;
const page = await (await browser.newContext({ viewport: { width: VW, height: VH } })).newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const game = (js, arg) => page.evaluate(js, arg);
// A fixed clock for motion: once `__labFixed(true)` runs, every drawn frame is exactly 1/30 s of game time, however
// slowly this Mac draws it, so strips sample the clips evenly. `__labPause(true)` holds every frame until it is
// lifted: the game would otherwise keep drawing while a frame is screenshot, so frames meant to be 2 apart were
// about 15 apart and a short clip played between two of them.
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  let virtual = null, paused = false, held = [];
  window.__labFixed = (on) => { virtual = on ? performance.now() : null; };
  window.__labPause = (on) => {
    paused = on;
    if (!on) { const resume = held; held = []; for (const cb of resume) window.requestAnimationFrame(cb); }
  };
  window.requestAnimationFrame = (cb) => raf((t) => {
    if (paused) { held.push(cb); return; }
    if (virtual === null) return cb(t);
    virtual += 1000 / 30;
    cb(virtual);
  });
});
console.log('motion: opening the game');
await page.goto(`${url}?hold=1&quality=${quality}${query ? '&' + query : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game !== undefined);
await game(async () => {
  const g = window.__game;
  g.newGame();
  g.view.game.systems.time?.setWeather('clear');
  g.setTime(0.45);
  g.advance(0.2);
  g.view.camera.zoomBy?.(-2);
  await g.settle();
  // Only the world is shot: everything on the page beside the canvas is hidden.
  const canvas = document.querySelector('canvas');
  for (const el of document.body.querySelectorAll('*')) {
    if (el !== canvas && !el.contains(canvas)) el.style.visibility = 'hidden';
  }
  window.__labFixed(true);
});
console.log('motion: game started');

async function crop(file, id = 'player') {
  const at = await game((id) => {
    const g = window.__game;
    const p = id === 'player' ? g.view.playerPosition : g.view.game.actors.get(id)?.pos;
    // People are aimed at their middle, creatures lower, since they stand about half a metre tall.
    return p ? g.view.project(p.x, p.y + (/^(pet|creature)/.test(id) ? 0.35 : 0.9), p.z) : null;
  }, id);
  if (!at) throw new Error(`nothing called ${id} to shoot`);
  const x = Math.max(0, Math.min(VW - CROP, Math.round(at.x - CROP / 2))), y = Math.max(0, Math.min(VH - CROP, Math.round(at.y - CROP / 2)));
  const shot = await page.screenshot({ clip: { x, y, width: CROP, height: CROP } });
  await sharp(shot).resize(C, C, { kernel: 'nearest' }).png().toFile(file);
}

const clips = {};
/** Shoots `count` frames of a clip, `gap` drawn frames apart, after `setup` has run in the page. */
async function clip(name, { count = 8, gap = 2, id = 'player', setup, setupArg, between }) {
  console.log(`motion/${name}: setting up`);
  if (setup) await game(setup, setupArg);
  const files = [];
  for (let i = 0; i < count; i++) {
    if (between) await game(between, i);
    // Hold the frame from the moment the count is reached until it is shot.
    await game(async (n) => { await window.__game.frames(n); window.__labPause(true); }, gap);
    const file = resolve(out, 'motion', `${name}-${i}.png`);
    await crop(file, id);
    await game(() => window.__labPause(false));
    files.push(file);
  }
  clips[name] = files;
  console.log(`motion/${name}: ${files.length} frames`);
}

const release = () => { const g = window.__game; for (const k of ['w', 'a', 's', 'd', 'shift']) g.key(k, false); };

await clip('walk', {
  setup: async () => {
    const g = window.__game;
    g.teleport('grant.stone');
    const p = g.view.game.player.pos;
    g.teleport(p.x + 6, p.z + 3);
    g.key('shift', true); g.key('d', true);
    await g.frames(20);
  },
  count: 10,
});
await clip('run', { setup: async () => { window.__game.key('shift', false); await window.__game.frames(15); } });
await game(release);
await clip('tool', {
  setup: async () => {
    const g = window.__game;
    await g.frames(10);
    g.manual(true);
    const hero = g.view.game.actors.get('player');
    hero.sprite = 'hero-swing'; hero.anim = 'tool';
  },
});
const fishAt = args.indexOf('--fish');
if (fishAt >= 0) {
  const sheet = args[fishAt + 1] && !args[fishAt + 1].startsWith('--') ? args[fishAt + 1] : 'hero';
  // A short idle first, then the cast from its first frame; 12 frames 0.13 s apart cover the cast and the hold.
  await clip('fish', {
    setup: async (sheet) => {
      const g = window.__game;
      const hero = g.view.game.actors.get('player');
      hero.sprite = 'hero'; hero.anim = 'idle';
      await g.frames(8);
      hero.sprite = sheet; hero.anim = 'fish';
    },
    setupArg: sheet,
    count: 12, gap: 4,
  });
}
// Turning: a short step each way, then a frame of the hero facing that way.
await clip('turn', {
  setup: () => { const g = window.__game; g.manual(false); const h = g.view.game.actors.get('player'); h.sprite = 'hero'; h.anim = 'idle'; },
  between: async (i) => {
    const g = window.__game;
    const ways = [['w'], ['w', 'd'], ['d'], ['s', 'd'], ['s'], ['s', 'a'], ['a'], ['w', 'a']][i];
    for (const k of ways) g.key(k, true);
    await g.frames(4);
    for (const k of ways) g.key(k, false);
    await g.frames(8);
  },
  gap: 1,
});
await clip('talk', {
  id: 'npc:tamsin',
  setup: async () => {
    const g = window.__game;
    const tamsin = g.view.game.actors.get('npc:tamsin');
    g.teleport(tamsin.pos.x + 1.6, tamsin.pos.z + 0.6);
    g.advance(0.3);
    g.interact();
    await g.frames(20);
  },
  count: 6,
});
await game(() => { const g = window.__game; g.talkThrough(); });
const critter = await game(async () => {
  const g = window.__game;
  g.teleport('dead.garden');
  g.advance(4);
  await g.frames(10);
  const me = g.view.playerPosition;
  let best = null, bestD = Infinity;
  for (const [id, a] of g.view.game.actors) {
    if (!/^(pet|creature)/.test(id) || !a.visible) continue;
    const d = Math.hypot(a.pos.x - me.x, a.pos.z - me.z);
    if (d < bestD) { best = id; bestD = d; }
  }
  return best;
});
if (critter) await clip('creature', { id: critter, count: 10, gap: 3 });
else console.log('motion/creature: no creature near the dead garden, skipped');
await browser.close();

// Each clip as a strip and as a moving picture.
for (const [name, files] of Object.entries(clips)) {
  await sharp({ create: { width: files.length * C, height: C, channels: 3, background: '#111' } })
    .composite(files.map((f, i) => ({ input: f, left: i * C, top: 0 }))).png().toFile(resolve(out, 'motion', `${name}.png`));
  await sharp(files, { join: { animated: true } }).gif({ delay: name === 'turn' ? 400 : name === 'creature' ? 100 : 67, loop: 0 }).toFile(resolve(out, 'motion', `${name}.gif`));
}

// 3. The card: the reference beside this style's places, then every strip.
const shots = existsSync(resolve(out, 'places/shots.json')) ? JSON.parse(readFileSync(resolve(out, 'places/shots.json'), 'utf8')) : {};
writeFileSync(resolve(out, 'counts.json'), JSON.stringify({ style, query, shots }, null, 2));
const W = 640, H = 400, GAP = 6;
const label = (text, w = W) => Buffer.from(`<svg width="${w}" height="30"><rect width="100%" height="100%" fill="#000" fill-opacity="0.6"/>`
  + `<text x="10" y="21" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const parts = [];
const cells = [{ file: resolve(root, 'docs/style-lab/reference/genshin-fields.png'), text: 'reference: Genshin, Mondstadt fields' }];
for (const name of Object.keys(shots).sort()) {
  const s = shots[name];
  cells.push({ file: resolve(out, 'places', name + '.png'), text: `${style}: ${name} · ${s.drawCalls} calls · ${Math.round(s.triangles / 1000)}k tris` });
}
const cols = 3;
cells.forEach((cell, i) => {
  if (!existsSync(cell.file)) return;
  const left = (i % cols) * (W + GAP), top = Math.floor(i / cols) * (H + GAP);
  parts.push({ file: cell.file, left, top, text: cell.text });
});
const placeRows = Math.ceil(cells.length / cols);
const S = 200, stripTop = placeRows * (H + GAP);
const names = Object.keys(clips);
const stripW = Math.max(...names.map((n) => clips[n].length)) * S;
const width = Math.max(cols * (W + GAP) - GAP, stripW + 120);
const composite = [];
for (const p of parts) {
  composite.push({ input: await sharp(p.file).resize(W, H, { fit: 'cover' }).toBuffer(), left: p.left, top: p.top });
  composite.push({ input: label(p.text), left: p.left, top: p.top });
}
for (const [r, name] of names.entries()) {
  const top = stripTop + r * (S + GAP);
  composite.push({ input: label(name, 120), left: 0, top });
  for (const [i, f] of clips[name].entries()) composite.push({ input: await sharp(f).resize(S, S).toBuffer(), left: 120 + i * S, top });
}
await sharp({ create: { width, height: stripTop + names.length * (S + GAP), channels: 3, background: '#111' } })
  .composite(composite).png().toFile(resolve(out, 'card.png'));
console.log(`wrote ${resolve(out, 'card.png')}`);
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

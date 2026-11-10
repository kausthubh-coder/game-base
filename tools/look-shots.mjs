// Close-ups for the look: soft and sharp shadows at the same spot, the water by day and at dusk, and the sky at
// day, dusk and night from a low camera. One screenshot per shot, with the renderer's counts, and sheet.png.
//   bun tools/look-shots.mjs --url http://127.0.0.1:5393/ [--out .artifacts/look/close] [--shots shadow-soft,water-dusk]
//     [--quality high] [--w 1440] [--h 900]
// Build and serve first, as for view-shots.mjs. It fails on a console error. This Mac draws WebGL in software:
// counts only, never frames a second.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const url = opt('url', 'http://127.0.0.1:5393/');
const out = resolve(root, opt('out', '.artifacts/look/close'));
const width = Number(opt('w', 1440)), height = Number(opt('h', 900));
const quality = opt('quality', 'high');
mkdirSync(out, { recursive: true });

// `query` picks the camera for the page. `zoom` is steps in from the opening zoom, `quarter` the camera's turn.
// Quarter 1 looks south-west, toward the setting sun. The shadow pair turns cloud shadows off, since they drift,
// and stands in the meadow, where the cliff steps, rocks and bushes cast. The tree models cast no shadow yet.
// `crop` is a part of the screen to enlarge, in screen pixels: [left, top, width, height].
const SHOTS = {
  'shadow-sharp': { query: 'camera=tilt', at: [46, -219], quarter: 0, zoom: 0, time: 16 / 24, graphics: { shadows: 'sharp', cloudShadows: false }, crop: [380, 240, 640, 400], name: 'Shadows: Sharp' },
  'shadow-soft': { query: 'camera=tilt', at: [46, -219], quarter: 0, zoom: 0, time: 16 / 24, graphics: { shadows: 'soft', cloudShadows: false }, crop: [380, 240, 640, 400], name: 'Shadows: Soft' },
  'water-noon': { query: 'camera=tilt', at: 'river.bank', quarter: 2, zoom: 2, time: 12 / 24, name: 'River at noon' },
  'water-dusk': { query: 'cam=shoulder', at: 'river.bank', quarter: 1, zoom: 0, time: 17.8 / 24, name: 'River at dusk, low camera' },
  'sky-day': { query: 'cam=shoulder', at: [46, -219], quarter: 0, zoom: 0, time: 11 / 24, name: 'Sky by day, low camera' },
  'sky-dusk': { query: 'cam=shoulder', at: [46, -219], quarter: 1, zoom: 0, time: 17.8 / 24, name: 'Sky at dusk, low camera' },
  'sky-night': { query: 'cam=shoulder', at: [46, -219], quarter: 0, zoom: 0, time: 22 / 24, name: 'Sky at night, low camera' },
};

const names = opt('shots', Object.keys(SHOTS).join(',')).split(',');
for (const n of names) if (!(n in SHOTS)) throw new Error(`no shot called ${n}`);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const results = {};
let failed = false;

// One page per camera, since the camera profile is read from the address.
const byQuery = new Map();
for (const n of names) {
  const q = SHOTS[n].query;
  if (!byQuery.has(q)) byQuery.set(q, []);
  byQuery.get(q).push(n);
}

try {
  for (const [query, list] of byQuery) {
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
    page.setDefaultTimeout(300000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${url}?hold=1&quality=${quality}&${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => {
      const g = window.__game;
      g.newGame();
      g.manual(true);
      g.view.game.systems.time?.setWeather('clear');
      g.advance(0.2);
    });
    for (const key of list) {
      const shot = SHOTS[key];
      const counts = await page.evaluate(async (shot) => {
        const g = window.__game;
        g.view.settings.setGraphics({ shadows: 'preset', cloudShadows: null, ...(shot.graphics ?? {}) });
        g.setTime(shot.time);
        const at = typeof shot.at === 'string' ? g.teleport(shot.at) : g.teleport(shot.at[0], shot.at[1]);
        g.advance(1);
        g.setTime(shot.time);
        g.teleport(at.x, at.z);
        const now = g.state().camera.quarter;
        const left = (shot.quarter - now + 4) % 4;
        if (left === 3) g.turn(1);
        else for (let i = 0; i < left; i++) g.turn(-1);
        const camera = g.view.camera, want = Math.max(0, 2 - shot.zoom);
        for (let i = 0; i < 8 && g.state().camera.zoom !== want; i++) camera.zoomBy(g.state().camera.zoom > want ? -1 : 1);
        g.advance(0.1);
        await g.frames(14);
        await g.settle();
        await g.frames(4);
        const look = g.view.ctx.camera.getWorldDirection(new g.view.ctx.camera.position.constructor());
        return { camera: g.state().camera, looks: [Math.round(look.x * 100) / 100, Math.round(look.z * 100) / 100], ...g.counters() };
      }, shot);
      const file = resolve(out, key + '.png');
      await page.screenshot({ path: file });
      if (shot.crop) {
        const [left, top, w, h] = shot.crop;
        await sharp(file).extract({ left, top, width: w, height: h }).resize(w * 2, h * 2, { kernel: 'nearest' }).toFile(resolve(out, key + '-crop.png'));
      }
      results[key] = { name: shot.name, quality, drawCalls: counts.drawCalls, triangles: counts.triangles, camera: counts.camera };
      console.log(`${key}.png  draw calls ${counts.drawCalls}  triangles ${counts.triangles}  camera ${JSON.stringify(counts.camera)}  looks x,z ${counts.looks}`);
    }
    // Leave the stored setting as it was found.
    await page.evaluate(() => window.__game.view.settings.setGraphics({ shadows: 'preset', cloudShadows: null }));
    if (errors.length) {
      failed = true;
      console.log(`FAIL ${query}: console errors\n  ${errors.join('\n  ')}`);
    }
    await page.context().close();
  }
} finally {
  writeFileSync(resolve(out, 'shots.json'), JSON.stringify(results, null, 2));
  await browser.close();
}

// The sheet: two columns, each shot labelled.
const W = 720, H = 450, GAP = 6;
const label = (text) => Buffer.from(`<svg width="${W}" height="34"><rect width="100%" height="100%" fill="#000" fill-opacity="0.55"/>`
  + `<text x="12" y="23" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const tiles = [];
for (const key of names) {
  if (!results[key]) continue;
  tiles.push({ file: key + '.png', text: `${results[key].name} · ${results[key].drawCalls} calls` });
  if (SHOTS[key].crop) tiles.push({ file: key + '-crop.png', text: `${results[key].name}, enlarged` });
}
const parts = [];
for (const [i, tile] of tiles.entries()) {
  const left = (i % 2) * (W + GAP), top = Math.floor(i / 2) * (H + GAP);
  parts.push({ input: await sharp(resolve(out, tile.file)).resize(W, H).toBuffer(), left, top });
  parts.push({ input: label(tile.text), left, top });
}
const rows = Math.ceil(tiles.length / 2);
await sharp({ create: { width: 2 * W + GAP, height: rows * H + (rows - 1) * GAP, channels: 3, background: '#111' } })
  .composite(parts).png().toFile(resolve(out, 'sheet.png'));
console.log(`wrote ${resolve(out, 'sheet.png')}`);
process.exit(failed ? 1 : 0);

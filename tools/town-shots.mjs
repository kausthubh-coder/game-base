// Screenshots of Hollowmere in one layout, to compare the layouts (src/game/content/town/). It opens an
// already served build with `?town=<name>`, starts a game through the debug door, and shoots two views at
// noon, dusk and night: the town from the meadow path at the default zoom, and the square two zoom steps in.
// It writes <name>-<view>-<time>.png and adds the renderer's counts to shots.json in the out folder.
//   bun tools/town-shots.mjs --town a [--url http://127.0.0.1:5391/] [--out .artifacts/town] [--views far,square]
//     [--times noon,dusk,night] [--w 1440] [--h 900] [--quality high]
// It fails on a console error. This Mac draws WebGL in software, so it reads draw calls and triangles, never frames a second.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const url = opt('url', 'http://127.0.0.1:5391/');
const town = opt('town', 'now');
const out = resolve(root, opt('out', '.artifacts/town'));
const width = Number(opt('w', 1440)), height = Number(opt('h', 900));
const quality = opt('quality', 'high');
mkdirSync(out, { recursive: true });

/** The views. `at` is a column or a place, `quarter` the camera's quarter turn (0 looks north-west), `zoom` the steps in from the default. */
const VIEWS = {
  // On the path where it leaves the meadow, looking south-east down the main street at the town.
  far: { at: [122, -186], quarter: 2, zoom: 0 },
  // The middle of the square, looking north-west at what stands behind it.
  square: { at: 'town.square', quarter: 0, zoom: 2 },
};
const TIMES = { noon: 0.5, dusk: 0.762, night: 0.9 };
const views = opt('views', Object.keys(VIEWS).join(',')).split(',');
const times = opt('times', Object.keys(TIMES).join(',')).split(',');
// `--at x,z,quarter` overrides a view's spot, to look for a better one.
const at = opt('at', null);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const jsonPath = resolve(out, 'shots.json');
let results = {};
try { results = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch { /* the first run */ }
const errors = [];

try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.setDefaultTimeout(600000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);
  await page.goto(`${url}?hold=1&quality=${quality}&town=${town}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await game(() => {
    const g = window.__game;
    g.newGame();
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear');
    g.setTime(0.5);
    g.advance(0.2);
  });

  const home = await game(() => window.__game.view.camera.zoom);
  for (const key of views) {
    const view = { ...VIEWS[key] };
    if (at) { const [x, z, q] = at.split(',').map(Number); view.at = [x, z]; view.quarter = q; }
    for (const time of times) {
      const counts = await game(async ({ view, t, home }) => {
        const g = window.__game;
        const cam = g.view.camera;
        const spot = typeof view.at === 'string' ? g.teleport(view.at) : g.teleport(view.at[0], view.at[1]);
        const now = g.state().camera.quarter;
        const left = (view.quarter - now + 4) % 4;
        if (left === 3) g.turn(1);
        else for (let i = 0; i < left; i++) g.turn(-1);
        // Back to the default zoom, then in by the view's steps.
        while (cam.zoom > home) cam.zoomBy(-1);
        while (cam.zoom < home) cam.zoomBy(1);
        for (let i = 0; i < view.zoom; i++) cam.zoomBy(-1);
        g.setTime(t);
        g.advance(0.1);
        await g.frames(14);
        await g.settle();
        await g.frames(4);
        return { spot, camera: g.state().camera, ...g.counters() };
      }, { view, t: TIMES[time], home });
      const name = `${town}-${key}-${time}`;
      await page.screenshot({ path: resolve(out, `${name}.png`) });
      results[name] = { town, view: key, time, drawCalls: counts.drawCalls, triangles: counts.triangles, chunks: counts.chunks, sprites: counts.sprites, quality: counts.quality, zoom: counts.camera.zoom, quarter: counts.camera.quarter };
      console.log(`${name}.png  draw calls ${counts.drawCalls}  triangles ${counts.triangles}  zoom ${counts.camera.zoom}  quarter ${counts.camera.quarter}`);
    }
  }
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
if (errors.length) {
  console.log(`FAIL: console errors\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('ok: no console errors');

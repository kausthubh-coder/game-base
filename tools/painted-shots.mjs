// Pictures of the painted world from fixed places, to judge the look after a change. It builds the game, serves
// it, starts a game through the debug door, hides the interface and shoots each view.
//   bun tools/painted-shots.mjs [--port 5470] [--dist dist-painted] [--no-build] [--out .artifacts/painted]
//     [--views spawn,meadow,grant,pond,road,hill,cliff,river,gate,square,green,street,town,farm,wide,knoll,south,west,vale,low,door,hall,court] [--query "look=blocks"] [--tag blocks] [--time 0.5]
//     [--frames 30] [--quality high] [--at 20,-236] [--weather clear] [--moments 0.5:clear,0.5:rain,0.9:clear]
// A view is a place, a camera and a zoom. `--tag` goes into the file names, so two looks can sit side by side.
// `--moments` shoots every view at several hours and weathers in one go: each is an hour of the day (0.5 is
// noon) and a weather of src/content/weather.ts, and both go into the file names.
// It fails on a console error. This Mac draws WebGL in software: the pictures say what is drawn, never how fast.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', '5470'));
const dist = opt('dist', 'dist-painted');
const out = resolve(root, opt('out', '.artifacts/painted'));
const tag = opt('tag', '');
const query = opt('query', '');
const time = Number(opt('time', '0.5'));
const settleFrames = Number(opt('frames', '30'));
const quality = opt('quality', 'high');
const weather = opt('weather', 'clear');
const moments = opt('moments', '') ? opt('moments', '').split(',').map((m) => { const [t, w] = m.split(':'); return { time: Number(t), weather: w ?? 'clear', name: `-${t}-${w ?? 'clear'}` }; }) : [{ time, weather, name: '' }];
mkdirSync(out, { recursive: true });

/**
 * The views. `at` is a place of the region or a column. `camera` is `tilt` (the 2.5D camera; `zoom` is steps
 * in from the default, `quarter` its quarter turn, 0 looks north-west) or `free` (`yaw` 0 looks north and 90
 * west, `pitch` is how far it looks down, `distance` is how far back it stands).
 */
const VIEWS = {
  spawn: { at: 'spawn', camera: 'tilt', zoom: 0, quarter: 0 },
  meadow: { at: 'spawn', camera: 'free', yaw: 300, pitch: 6, distance: 9 },
  grant: { at: 'grant.center', camera: 'tilt', zoom: 1, quarter: 0 },
  pond: { at: 'grant.rocks', camera: 'free', yaw: 40, pitch: 9, distance: 10 },
  road: { at: [60, -200], camera: 'free', yaw: 285, pitch: 5, distance: 9 },
  hill: { at: [46, -182], camera: 'free', yaw: 0, pitch: 4, distance: 11 },
  cliff: { at: [46, -168], camera: 'tilt', zoom: 0, quarter: 0 },
  river: { at: 'river.bank', camera: 'free', yaw: 30, pitch: 8, distance: 11 },
  gate: { at: [124, -176], camera: 'free', yaw: 275, pitch: 7, distance: 10 },
  square: { at: 'town.square', camera: 'tilt', zoom: 1, quarter: 0 },
  // Up at the sky, from the hero's own eyes.
  sky: { at: [20, -236], camera: 'first', yaw: 200, pitch: -14 },
  skyline: { at: [20, -236], camera: 'first', yaw: 20, pitch: -6 },
  // Water: a pond in the meadow, and the river's bank.
  lake: { at: [-119, -226], camera: 'free', yaw: 92, pitch: 13, distance: 15 },
  bank: { at: [60, -160], camera: 'free', yaw: 165, pitch: 9, distance: 13 },
  quay: { at: [150, -130], camera: 'free', yaw: 250, pitch: 15, distance: 9 },
  // The town.
  green: { at: [173, -142], camera: 'free', yaw: 0, pitch: 7, distance: 15 },
  street: { at: [143, -174], camera: 'free', yaw: 272, pitch: 6, distance: 10 },
  town: { at: [150, -139], camera: 'free', yaw: 318, pitch: 11, distance: 17 },
  farm: { at: 'gus.field', camera: 'free', yaw: 262, pitch: 22, distance: 11 },
  // Long views, to judge the air and the far land. `wide` stands back and high, as the painted meadow's first view does.
  wide: { at: [12, -214], camera: 'free', yaw: 338, pitch: 13, distance: 36 },
  knoll: { at: [38, -238], camera: 'free', yaw: 5, pitch: 6, distance: 15 },
  south: { at: 'spawn', camera: 'free', yaw: 170, pitch: 3, distance: 10 },
  west: { at: [30, -221], camera: 'free', yaw: 80, pitch: 4, distance: 10 },
  vale: { at: [100, -210], camera: 'free', yaw: 250, pitch: 5, distance: 12 },
  low: { at: 'spawn', camera: 'tilt', zoom: 2, quarter: 0 },
  // Ilara's Hall: the stone door from the plot, the court from the game's own camera, and from above.
  door: { at: 'shut.door', camera: 'free', yaw: 350, pitch: 12, distance: 11 },
  hall: { at: 'hall.heart', camera: 'tilt', zoom: 1, quarter: 0 },
  court: { at: 'hall.heart', camera: 'free', yaw: 325, pitch: 30, distance: 17 },
};
// Looking round from the hero's own eyes, six ways, to judge the sky and the far land: `--views pano` shoots them all.
// `--at x,z` says where to stand.
const stand = opt('at', '20,-236').split(',').map(Number);
for (let i = 0; i < 6; i++) VIEWS[`pano${i}`] = { at: stand, camera: 'first', yaw: i * 60, pitch: 0 };
const views = opt('views', Object.keys(VIEWS).filter((k) => !k.startsWith('pano')).join(',')).split(',').flatMap((k) => (k === 'pano' ? [0, 1, 2, 3, 4, 5].map((i) => `pano${i}`) : [k]));

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error(`FAIL: the build into ${dist}`); process.exit(1); }
}
// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => { text += chunk; const pid = /pid (\d+)/.exec(text); if (pid) done(Number(pid[1])); });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});

const errors = [], counts = {};
let browser;
try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
  page.setDefaultTimeout(900000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${quality}${query ? '&' + query : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate((t) => {
    const g = window.__game;
    g.newGame();
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear', true);
    g.setTime(t);
    g.advance(0.2);
    g.view.root.style.visibility = 'hidden';
    const beam = g.view.scene.getObjectByName('waypoint-beam');
    if (beam) beam.material.visible = false;
  }, time);
  const home = await page.evaluate(() => window.__game.view.camera.zoom);

  for (const moment of moments) for (const key of views) {
    const view = VIEWS[key];
    if (!view) throw new Error(`no view called ${key}`);
    counts[key + moment.name] = await page.evaluate(async ({ view, home, frames, t, weather }) => {
      const g = window.__game, cam = g.view.camera;
      g.view.game.systems.time?.setWeather(weather, true);
      if (typeof view.at === 'string') g.teleport(view.at);
      else g.teleport(view.at[0], view.at[1]);
      g.setCamera(view.camera);
      if (view.camera === 'tilt') {
        const left = ((view.quarter ?? 0) - g.state().camera.quarter + 4) % 4;
        if (left === 3) g.turn(1);
        else for (let i = 0; i < left; i++) g.turn(-1);
        while (cam.zoom > home) cam.zoomBy(-1);
        while (cam.zoom < home) cam.zoomBy(1);
        for (let i = 0; i < (view.zoom ?? 0); i++) cam.zoomBy(-1);
      } else {
        if (view.camera === 'first') g.look(view.yaw, view.pitch); else g.look(view.yaw, view.pitch, view.distance);
      }
      g.setTime(t);
      g.advance(0.1);
      await g.frames(frames);
      await g.settle();
      // The water's sheets are made two a frame, nearest first, after the land under them.
      await g.frames(50);
      const c = g.counters();
      return { drawCalls: c.drawCalls, triangles: c.triangles };
    }, { view, home, frames: settleFrames, t: moment.time, weather: moment.weather });
    const name = `${key}${moment.name}${tag ? '-' + tag : ''}.png`;
    await page.screenshot({ path: resolve(out, name) });
    console.log(`${name}  draw calls ${counts[key + moment.name].drawCalls}  triangles ${counts[key + moment.name].triangles}`);
  }
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}
writeFileSync(resolve(out, `counts${tag ? '-' + tag : ''}.json`), JSON.stringify(counts, null, 2));
if (errors.length) {
  console.log(`FAIL: console errors\n  ${[...new Set(errors)].slice(0, 6).join('\n  ')}`);
  process.exit(1);
}
console.log('ok: no console errors');

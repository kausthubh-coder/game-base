// Screenshots of the camera profiles (src/features/camera/profiles.ts) at the same places, to compare them.
// It opens an already served build once per camera, starts a game through the debug door, holds the clock at
// about 4 pm on a clear day, and for each place teleports, turns the camera, takes a step away from it and
// shoots. It writes <shot>.png per camera and place, and shots.json with the renderer's counts.
//   bun tools/cam-shots.mjs [--url http://127.0.0.1:5361/] [--out .artifacts/camera] [--shots today,horizon,...]
//     [--places spawn,meadow,rocks,town] [--w 1440] [--h 900] [--quality high] [--query '&stress=1.34']
// A shot is a camera name, or a camera name and a zoom step: `tilt@0`. It fails on a console error. This Mac
// draws WebGL in software, so it reads draw calls and triangles, never frames a second.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const url = opt('url', 'http://127.0.0.1:5361/');
const out = resolve(root, opt('out', '.artifacts/camera'));
const width = Number(opt('w', 1440)), height = Number(opt('h', 900));
mkdirSync(out, { recursive: true });

/**
 * The places, and the quarter turn of the camera at each. Quarter 0 looks north-west. Every camera gets the
 * same quarter at a place, so the shots line up.
 */
const PLACES = {
  // Beside Tamsin and as far from the camera as she is, facing the camera as a new game leaves the hero.
  spawn: { at: [-4, -219], quarter: 0, step: false, name: 'The grant stone, with Tamsin' },
  meadow: { at: [46, -219], quarter: 0, name: 'The meadow along the path' },
  rocks: { at: 'grant.rocks', quarter: 0, name: 'The mossy rocks and the pool' },
  town: { at: 'town.square', quarter: 3, name: 'The town square' },
};

/** A shot: the file name, the camera, and the zoom step, or null for the camera's own first step. */
const SHOTS = {
  today: { cam: 'today', zoom: null },
  horizon: { cam: 'horizon', zoom: null },
  'tilt-near': { cam: 'tilt', zoom: 0 },
  'tilt-mid': { cam: 'tilt', zoom: 1 },
  shoulder: { cam: 'shoulder', zoom: null },
  crane: { cam: 'crane', zoom: null },
};

// `--sweep` shoots every quarter turn at each place instead of the chosen one, to choose.
if (args.includes('--sweep')) {
  for (const key of Object.keys(PLACES)) for (let q = 0; q < 4; q++) PLACES[`${key}.q${q}`] = { ...PLACES[key], quarter: q };
}
const shots = opt('shots', 'today,horizon,tilt-near,tilt-mid,shoulder,crane').split(',');
const places = opt('places', Object.keys(PLACES).join(',')).split(',');
const quality = opt('quality', 'high');
/** More of the address, such as `&stress=1.34` to load land farther out. */
const query = opt('query', '');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const jsonPath = resolve(out, 'shots.json');
let results = {};
try { results = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch { /* the first run */ }
let failed = false;

try {
  for (const name of shots) {
    const shot = SHOTS[name];
    if (!shot) throw new Error(`no shot called ${name}`);
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
    page.setDefaultTimeout(300000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    const game = (js, arg) => page.evaluate(js, arg);

    await page.goto(`${url}?hold=1&quality=${quality}&cam=${shot.cam}${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await game(async (zoom) => {
      const g = window.__game;
      g.newGame();
      g.manual(true);
      g.view.game.systems.time?.setWeather('clear');
      g.setTime(16 / 24);
      g.advance(0.2);
      // One call moves one step, whatever the number.
      for (let i = 0; zoom !== null && i < 9; i++) g.view.camera.zoomBy(-1);
      for (let i = 0; zoom !== null && i < zoom; i++) g.view.camera.zoomBy(1);
    }, shot.zoom);

    for (const key of places) {
      const place = PLACES[key];
      const counts = await game(async (place) => {
        const g = window.__game;
        const at = typeof place.at === 'string' ? g.teleport(place.at) : g.teleport(place.at[0], place.at[1]);
        // Turn to the place's quarter the short way.
        const now = g.state().camera.quarter;
        const left = (place.quarter - now + 4) % 4;
        if (left === 3) g.turn(1);
        else for (let i = 0; i < left; i++) g.turn(-1);
        g.setTime(16 / 24);
        // A step away from the camera, so the hero faces where it looks, as a player walking would.
        if (place.step !== false) {
          g.key('w', true);
          g.advance(0.25);
          g.key('w', false);
        }
        g.advance(0.1);
        await g.frames(14);
        await g.settle();
        await g.frames(4);
        return { at, state: g.state().camera, ...g.counters() };
      }, place);
      const file = `${name}-${key}.png`;
      await page.screenshot({ path: resolve(out, file) });
      results[`${name}-${key}`] = { shot: name, place: key, drawCalls: counts.drawCalls, triangles: counts.triangles, chunks: counts.chunks, sprites: counts.sprites, quality: counts.quality };
      console.log(`${file}  draw calls ${counts.drawCalls}  triangles ${counts.triangles}  chunks ${counts.chunks}  sprites ${counts.sprites}  quarter ${counts.state.quarter} zoom ${counts.state.zoom}`);
    }
    if (errors.length) {
      failed = true;
      console.log(`FAIL ${name}: console errors\n  ${errors.join('\n  ')}`);
    } else {
      console.log(`ok   ${name}: no console errors`);
    }
    await page.context().close();
  }
} finally {
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  await browser.close();
}
process.exit(failed ? 1 : 0);

// Screenshots of the ground with and without `?ground=clean`, at the same places and zoom steps, to compare.
// It opens an already served build once per look, starts a game through the debug door, holds the clock at
// about 4 pm on a clear day, and for each place and zoom teleports, turns the camera and shoots. It writes
// <look>-<place>-<zoom>.png and shots.json with the renderer's counts, then a contact sheet per look pair.
//   bun tools/ground-shots.mjs [--url http://127.0.0.1:5365/] [--out .artifacts/ground] [--looks today,clean]
//     [--places spawn,meadow,rocks,town] [--zooms default,in2] [--quality high] [--low spawn]
// `default` is the zoom a new game opens on; `in2` is two steps closer. `--low <place>` adds one shot of each look
// at ?quality=low. It fails on a console error. This Mac draws WebGL in software: counts only, never frames a second.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const url = opt('url', 'http://127.0.0.1:5365/');
const out = resolve(root, opt('out', '.artifacts/ground'));
const width = Number(opt('w', 1440)), height = Number(opt('h', 900));
mkdirSync(out, { recursive: true });

// The same places as tools/cam-shots.mjs, so the sheets line up with the camera sheets.
const PLACES = {
  spawn: { at: [-4, -219], quarter: 0, step: false, name: 'Grant stone' },
  meadow: { at: [46, -219], quarter: 0, name: 'Meadow' },
  rocks: { at: 'grant.rocks', quarter: 0, name: 'Mossy rocks and pool' },
  town: { at: 'town.square', quarter: 3, name: 'Town square' },
};
const ZOOMS = { default: 0, in2: 2 };
const LOOKS = { today: '', clean: '&ground=clean' };

const looks = opt('looks', 'today,clean').split(',');
const places = opt('places', Object.keys(PLACES).join(',')).split(',');
const zooms = opt('zooms', 'default,in2').split(',');
const quality = opt('quality', 'high');
const low = opt('low', null);

const browser = await launchChrome({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const jsonPath = resolve(out, 'shots.json');
let results = {};
try { results = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch { /* the first run */ }
let failed = false;

async function run(look, level, list) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);

  await page.goto(`${url}?hold=1&quality=${level}${LOOKS[look]}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await game(() => {
    const g = window.__game;
    g.newGame();
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear');
    g.setTime(16 / 24);
    g.advance(0.2);
  });
  for (const [key, zoom, file] of list) {
    const place = PLACES[key];
    const counts = await game(async ({ place, zoom }) => {
      const g = window.__game;
      const at = typeof place.at === 'string' ? g.teleport(place.at) : g.teleport(place.at[0], place.at[1]);
      const now = g.state().camera.quarter;
      const left = (place.quarter - now + 4) % 4;
      if (left === 3) g.turn(1);
      else for (let i = 0; i < left; i++) g.turn(-1);
      // Back to the opening zoom, then in.
      const camera = g.view.camera;
      while (g.state().camera.zoom !== 2) camera.zoomBy(g.state().camera.zoom > 2 ? -1 : 1);
      for (let i = 0; i < zoom; i++) camera.zoomBy(-1);
      g.setTime(16 / 24);
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
    }, { place, zoom: ZOOMS[zoom] });
    await page.screenshot({ path: resolve(out, file + '.png') });
    results[file] = { look, place: key, zoom, quality: level, drawCalls: counts.drawCalls, triangles: counts.triangles, chunks: counts.chunks };
    console.log(`${file}.png  draw calls ${counts.drawCalls}  triangles ${counts.triangles}  quarter ${counts.state.quarter} zoom ${counts.state.zoom}`);
  }
  if (errors.length) {
    failed = true;
    console.log(`FAIL ${look} ${level}: console errors\n  ${errors.join('\n  ')}`);
  } else {
    console.log(`ok   ${look} ${level}: no console errors`);
  }
  await page.context().close();
}

try {
  for (const look of looks) {
    if (!(look in LOOKS)) throw new Error(`no look called ${look}`);
    await run(look, quality, places.flatMap((p) => zooms.map((z) => [p, z, `${look}-${p}-${z}`])));
    if (low) await run(look, 'low', [[low, 'default', `${look}-${low}-low`]]);
  }
} finally {
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  await browser.close();
}

// The contact sheet: today on the left, clean on the right, one row per shot.
if (looks.includes('today') && looks.includes('clean')) {
  const W = 720, H = 450, GAP = 6;
  const label = (text) => Buffer.from(`<svg width="420" height="34"><rect width="100%" height="100%" fill="#000" fill-opacity="0.55"/>`
    + `<text x="12" y="23" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#fff">${text}</text></svg>`);
  const rows = places.flatMap((p) => zooms.map((z) => [p, z]));
  if (low) rows.push([low, 'low']);
  const parts = [];
  for (const [r, [p, z]] of rows.entries()) {
    for (const [c, look] of ['today', 'clean'].entries()) {
      const left = c * (W + GAP), top = r * (H + GAP);
      const zoomName = z === 'default' ? 'default zoom' : z === 'in2' ? 'two steps in' : 'quality low';
      parts.push({ input: await sharp(resolve(out, `${look}-${p}-${z}.png`)).resize(W, H).toBuffer(), left, top });
      parts.push({ input: label(`${look}: ${PLACES[p].name}, ${zoomName}`), left, top });
    }
  }
  await sharp({ create: { width: 2 * W + GAP, height: rows.length * H + (rows.length - 1) * GAP, channels: 3, background: '#111' } })
    .composite(parts).png().toFile(resolve(out, 'clean.png'));
  console.log('wrote clean.png');
}
process.exit(failed ? 1 : 0);

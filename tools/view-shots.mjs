// The same views every time, to compare looks: one screenshot per place and variant, with the renderer's
// counts. A variant is extra text for the address, such as `chars=models` or `camera=free&cam=shoulder`.
// It opens an already served build once per variant, starts a game through the debug door, and for each
// place sets the clock and weather, teleports, turns the camera, lets the place come alive and shoots.
// It writes <variant>-<place>.png and shots.json, and sheet.png with one column per variant.
//   bun tools/view-shots.mjs --url http://127.0.0.1:5381/ [--out .artifacts/view-shots]
//     [--variants sprites=chars=sprites,models=chars=models] [--places spawn,rocks,garden,town,meadow,river]
//     [--quality high] [--w 1440] [--h 900]
// Build and serve first: `bun x vite build --outDir dist-<name>` and `bun tools/serve.mjs dist-<name> <port>`.
// It fails on a console error. This Mac draws WebGL in software: counts only, never frames a second.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const url = opt('url', 'http://127.0.0.1:5381/');
const out = resolve(root, opt('out', '.artifacts/view-shots'));
const width = Number(opt('w', 1440)), height = Number(opt('h', 900));
const quality = opt('quality', 'high');
mkdirSync(out, { recursive: true });

// The places every comparison shoots. `time` is the time of day, 0.5 noon. `wait` is game seconds to let
// people walk in and creatures appear before the shot. `zoom` is steps in from the opening zoom.
const PLACES = {
  spawn: { at: 'grant.stone', quarter: 0, zoom: 1, time: 10 / 24, wait: 1, name: 'Grant stone, Tamsin and the hero' },
  rocks: { at: 'grant.rocks', quarter: 0, zoom: 1, time: 15 / 24, wait: 8, name: 'Mossy rocks, mosslings' },
  garden: { at: 'dead.garden', quarter: 1, zoom: 1, time: 11 / 24, wait: 4, name: 'Dead garden, the leaftail' },
  town: { at: 'town.square', quarter: 3, zoom: 0, time: 10 / 24, wait: 4, name: 'Town square, people' },
  meadow: { at: [46, -219], quarter: 0, zoom: 0, time: 16 / 24, wait: 1, name: 'Meadow, grass and flowers' },
  river: { at: 'river.bank', quarter: 2, zoom: 1, time: 19.6 / 24, wait: 8, name: 'River bank at dusk, lanternflies' },
};

const variants = opt('variants', 'sprites=chars=sprites,models=chars=models').split(',').map((pair) => {
  const at = pair.indexOf('=');
  return at < 0 ? { name: pair, query: '' } : { name: pair.slice(0, at), query: pair.slice(at + 1) };
});
const places = opt('places', Object.keys(PLACES).join(',')).split(',');
for (const p of places) if (!(p in PLACES)) throw new Error(`no place called ${p}`);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const results = {};
let failed = false;

async function run(variant) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);

  await page.goto(`${url}?hold=1&quality=${quality}${variant.query ? '&' + variant.query : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await game(() => {
    const g = window.__game;
    g.newGame();
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear');
    g.advance(0.2);
  });
  for (const key of places) {
    const place = PLACES[key];
    const counts = await game(async (place) => {
      const g = window.__game;
      g.setTime(place.time);
      const at = typeof place.at === 'string' ? g.teleport(place.at) : g.teleport(place.at[0], place.at[1]);
      g.advance(place.wait);
      g.setTime(place.time);
      g.teleport(at.x, at.z);
      const now = g.state().camera.quarter;
      const left = (place.quarter - now + 4) % 4;
      if (left === 3) g.turn(1);
      else for (let i = 0; i < left; i++) g.turn(-1);
      // The opening zoom is step 2, and each step in is one less.
      const camera = g.view.camera, want = Math.max(0, 2 - place.zoom);
      for (let i = 0; i < 8 && g.state().camera.zoom !== want; i++) camera.zoomBy(g.state().camera.zoom > want ? -1 : 1);
      g.advance(0.1);
      await g.frames(14);
      await g.settle();
      await g.frames(4);
      const s = g.state();
      return { at, camera: s.camera, characters: s.characters, ...g.counters() };
    }, place);
    const file = `${variant.name}-${key}`;
    await page.screenshot({ path: resolve(out, file + '.png') });
    results[file] = { variant: variant.name, query: variant.query, place: key, quality, drawCalls: counts.drawCalls, triangles: counts.triangles, sprites: counts.sprites, camera: counts.camera, characters: counts.characters };
    console.log(`${file}.png  draw calls ${counts.drawCalls}  triangles ${counts.triangles}  camera ${JSON.stringify(counts.camera)}  characters ${counts.characters}`);
  }
  if (errors.length) {
    failed = true;
    console.log(`FAIL ${variant.name}: console errors\n  ${errors.join('\n  ')}`);
  } else {
    console.log(`ok   ${variant.name}: no console errors`);
  }
  await page.context().close();
}

try {
  for (const variant of variants) await run(variant);
} finally {
  writeFileSync(resolve(out, 'shots.json'), JSON.stringify(results, null, 2));
  await browser.close();
}

// The sheet: one column per variant, one row per place, each labelled with its counts.
const W = 720, H = 450, GAP = 6;
const label = (text) => Buffer.from(`<svg width="${W}" height="34"><rect width="100%" height="100%" fill="#000" fill-opacity="0.55"/>`
  + `<text x="12" y="23" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const parts = [];
for (const [r, p] of places.entries()) {
  for (const [c, variant] of variants.entries()) {
    const file = `${variant.name}-${p}`;
    const shot = results[file];
    if (!shot) continue;
    const left = c * (W + GAP), top = r * (H + GAP);
    parts.push({ input: await sharp(resolve(out, file + '.png')).resize(W, H).toBuffer(), left, top });
    parts.push({ input: label(`${variant.name}: ${PLACES[p].name} · ${shot.drawCalls} calls · ${Math.round(shot.triangles / 1000)}k tris`), left, top });
  }
}
await sharp({ create: { width: variants.length * W + (variants.length - 1) * GAP, height: places.length * H + (places.length - 1) * GAP, channels: 3, background: '#111' } })
  .composite(parts).png().toFile(resolve(out, 'sheet.png'));
console.log(`wrote ${resolve(out, 'sheet.png')}`);
process.exit(failed ? 1 : 0);

// Screenshots of the sprites demo, in one browser session, into .artifacts/sprites-runtime/.
//   bun tools/sprites-runtime-shots.mjs              every screenshot
//   bun tools/sprites-runtime-shots.mjs crowd hero   only the named ones (a name matches by its start)
//   bun tools/sprites-runtime-shots.mjs --query "filter=nearest" --suffix -nearest
//   bun tools/sprites-runtime-shots.mjs --strips     walk cycles: each sprite walking away, toward and across, frame by frame
// It needs the built demo served: bun tools/demo.mjs build sprites, then bun tools/serve.mjs dist/demos/sprites 5314.
// Exits 1 when the page logged an error. This Mac draws WebGL in software: use it to look, never to time.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const value = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const flags = new Set(['--url', '--query', '--suffix', '--w', '--h']);
const wanted = args.filter((a, i) => !a.startsWith('--') && !flags.has(args[i - 1]));
const url = value('url', 'http://127.0.0.1:5314/');
const suffix = value('suffix', '');
const out = resolve(import.meta.dirname, '../.artifacts/sprites-runtime');
mkdirSync(out, { recursive: true });

// name, the state to apply, and seconds to run before the picture.
const crowd = { solo: '', count: 200, time: 0.5, zoom: 3, panel: true };
const shots = [
  ['crowd-turn-0', { ...crowd, quarter: 0 }, 2],
  ['crowd-turn-1', { ...crowd, quarter: 1 }, 0],
  ['crowd-turn-2', { ...crowd, quarter: 2 }, 0],
  ['crowd-turn-3', { ...crowd, quarter: 3 }, 0],
  ['crowd-near', { ...crowd, quarter: 0, zoom: 2, panel: false }, 0],
  ['noon', { ...crowd, quarter: 0, time: 0.5, panel: false }, 1],
  ['night', { ...crowd, quarter: 0, time: 0.95, panel: false }, 0],
  ['sunset', { ...crowd, quarter: 0, time: 0.74, panel: false }, 0],
  ['night-lamp', { ...crowd, quarter: 0, time: 0.95, zoom: 1, panel: false }, 0],
  ['cave-noon', { ...crowd, quarter: 0, time: 0.5, zoom: 1, panel: false }, 0],
  ['hero-away', { solo: 'away', quarter: 0, time: 0.5, panel: false }, 1.0],
  ['hero-away-b', { solo: 'away', quarter: 0, time: 0.5, panel: false }, 0.3],
  ['hero-toward', { solo: 'toward', quarter: 0, time: 0.5, panel: false }, 1.0],
  ['hero-toward-b', { solo: 'toward', quarter: 0, time: 0.5, panel: false }, 0.3],
  ['hero-across', { solo: 'across', quarter: 0, time: 0.5, panel: false }, 1.0],
  ['hero-across-b', { solo: 'across', quarter: 0, time: 0.5, panel: false }, 0.3],
  ['hero-across-turn-2', { solo: 'across', quarter: 2, time: 0.5, panel: false }, 1.0],
  ['hero-tool', { solo: 'tool', quarter: 0, time: 0.5, panel: false }, 0.2],
  ['characters-500', { solo: '', count: 500, quarter: 0, time: 0.5, zoom: 4, panel: true }, 2],
  ['characters-1000', { solo: '', count: 1000, quarter: 0, time: 0.5, zoom: 5, panel: true }, 2],
  ['characters-1000-near', { solo: '', count: 1000, quarter: 1, time: 0.5, zoom: 3, panel: false }, 0],
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await (await browser.newContext({ viewport: { width: Number(value('w', 1440)), height: Number(value('h', 900)) }, colorScheme: 'dark' })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const query = value('query', '');
await page.goto(`${url}?shots=1&paused=1${query ? '&' + query : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sprites !== undefined, null, { timeout: 30000 });

const counts = {};
if (args.includes('--strips')) {
  // One row per direction, one column per tenth of a second: the six frames of a walk at 10 a second.
  const width = Number(value('w', 1440)), height = Number(value('h', 900));
  const BOX = { width: 230, height: 250 }, STEPS = 7, MODES = ['away', 'toward', 'across'];
  const names = await page.evaluate(() => window.__sprites.sprites());
  for (const zoom of [1, 3]) {
    // Every sprite close up. At the game's zoom, the first five are enough to judge the size.
    for (const who of zoom === 1 ? names : names.slice(0, 5)) {
      const tiles = [];
      for (const [row, solo] of MODES.entries()) {
        // Zoom 1 is a close view. Zoom 3 is the game's middle zoom, where a hero is about 63 pixels tall: it is shown three times size.
        await page.evaluate(([s]) => { window.__sprites.apply(s); window.__sprites.apply({ zoom: s.zoom }); window.__sprites.advance(1.5); }, [{ solo, who, zoom, quarter: 0, time: 0.5, panel: false }]);
        for (let step = 0; step < STEPS; step++) {
          await page.evaluate(() => window.__sprites.advance(0.1));
          const scale = zoom === 3 ? 3 : 1, w = BOX.width / scale, h = BOX.height / scale;
          const clip = { x: Math.round(width / 2 - w / 2), y: Math.round(height / 2 - h * 0.44), width: Math.round(w), height: Math.round(h) };
          const shot = await sharp(await page.screenshot({ clip })).resize(BOX.width, BOX.height, { kernel: 'nearest' }).toBuffer();
          tiles.push({ input: shot, left: step * (BOX.width + 4), top: row * (BOX.height + 4) });
        }
      }
      const file = `walk-${who.replace(/[^a-z0-9-]/gi, '_')}${zoom === 3 ? '-far' : ''}${suffix}.png`;
      await sharp({ create: { width: STEPS * (BOX.width + 4), height: MODES.length * (BOX.height + 4), channels: 3, background: '#000' } }).composite(tiles).png().toFile(resolve(out, file));
      console.log(`${file}  rows: ${MODES.join(', ')}. ${STEPS} columns, a tenth of a second apart`);
    }
  }
  await page.evaluate(() => window.__sprites.apply({ solo: '', who: 'hero' }));
} else {
  for (const [name, state, seconds] of shots) {
    if (wanted.length && !wanted.some((w) => name.startsWith(w))) continue;
    // The first frame after a state change settles the camera's zoom. Then the demo runs for the time asked.
    counts[name] = await page.evaluate(([s, t]) => {
      window.__sprites.apply(s);
      window.__sprites.advance(1.5);
      return window.__sprites.advance(t);
    }, [state, seconds]);
    await page.screenshot({ path: resolve(out, `${name}${suffix}.png`) });
    const c = counts[name];
    console.log(`${name}${suffix}.png  ${c.characters} characters, ${c.calls} draw calls (${c.spriteCalls} for sprites and shadows), ${c.triangles} triangles`);
  }
  writeFileSync(resolve(out, `shots${suffix}.json`), JSON.stringify(counts, null, 2));
}
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

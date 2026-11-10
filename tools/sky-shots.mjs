// Screenshots and counts for the sky demo, in one browser session.
//   bun tools/sky-shots.mjs                 every screenshot, into .artifacts/sky/
//   bun tools/sky-shots.mjs dawn rain       only the named ones (a name matches by its start)
//   bun tools/sky-shots.mjs --measure       draw calls and triangles with the features off and on
//   bun tools/sky-shots.mjs --soak 5        minutes of storm, with the live counts each minute
// It needs the built demo served: bun tools/demo.mjs build sky, then bun tools/serve.mjs dist/demos/sky 5313.
// Exits 1 when the page logged an error. This Mac draws WebGL in software: use it to look, never to time.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const value = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = value('url', 'http://127.0.0.1:5313/');
const out = resolve(import.meta.dirname, '../.artifacts/sky');
mkdirSync(out, { recursive: true });

const GLOWING = new Set(['trail', 'firefly', 'mote']);

// name, the state to apply, seconds to run before the picture, and whether lightning strikes just before it.
const shots = [
  ['dawn', { view: 'sun', time: 0.262, weather: 'clear' }, 2],
  ['dawn-game', { view: 'game', time: 0.262, weather: 'clear' }, 2],
  ['noon', { view: 'game', time: 0.5, weather: 'clear' }, 2],
  ['noon-horizon', { view: 'low', time: 0.5, weather: 'clear' }, 2],
  ['sunset', { view: 'sun', time: 0.75, weather: 'clear' }, 2],
  ['sunset-game', { view: 'game', time: 0.75, weather: 'clear' }, 2],
  ['night-moon', { view: 'sun', time: 0.86, weather: 'clear' }, 6],
  ['night-game', { view: 'game', time: 0.95, weather: 'clear' }, 8],
  ['overcast', { view: 'low', time: 0.5, weather: 'overcast' }, 2],
  ['overcast-game', { view: 'game', time: 0.5, weather: 'overcast' }, 2],
  ['rain', { view: 'game', time: 0.5, weather: 'rain' }, 4],
  ['rain-horizon', { view: 'low', time: 0.5, weather: 'rain' }, 4],
  ['storm', { view: 'low', time: 0.55, weather: 'storm' }, 4],
  ['storm-game', { view: 'game', time: 0.55, weather: 'storm' }, 4],
  ['storm-bolt', { view: 'low', time: 0.55, weather: 'storm' }, 4, true],
  ['storm-bolt-game', { view: 'game', time: 0.55, weather: 'storm' }, 4, true],
  ['fog', { view: 'game', time: 0.3, weather: 'fog' }, 2],
  ['fog-horizon', { view: 'low', time: 0.3, weather: 'fog' }, 2],
  ['motes-dusk', { view: 'low', time: 0.765, weather: 'motes' }, 14],
  ['motes-dusk-game', { view: 'game', time: 0.765, weather: 'motes' }, 14],
  ['rainbow', { view: 'low', time: 0.62, weather: 'clear', rainbow: 1 }, 2],
  ['rainbow-game', { view: 'game', time: 0.62, weather: 'clear', rainbow: 1 }, 2],
  ['breezy', { view: 'game', time: 0.45, weather: 'breezy' }, 8],
  ['pond', { view: 'pond', time: 0.5, weather: 'clear' }, 2],
  ['pond-rain', { view: 'pond', time: 0.5, weather: 'rain' }, 4],
  ['pond-night', { view: 'pond', time: 0.9, weather: 'clear' }, 2],
  'effects',
  ['quality-low', { view: 'game', time: 0.5, weather: 'clear', quality: 'low' }, 2],
  ['quality-medium', { view: 'game', time: 0.5, weather: 'clear', quality: 'medium' }, 2],
  ['quality-high', { view: 'game', time: 0.5, weather: 'clear', quality: 'high' }, 2],
];

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await (await browser.newContext({ viewport: { width: Number(value('w', 1280)), height: Number(value('h', 720)) }, colorScheme: 'dark' })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${url}?shots=1&panel=${flag('panel') ? 1 : 0}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__sky !== undefined);
await page.evaluate(() => window.__sky.apply({ paused: true }));

if (flag('measure')) {
  const result = await page.evaluate(() => window.__sky.measure());
  console.log('measure:', JSON.stringify(result, null, 2));
  writeFileSync(resolve(out, 'measure.json'), JSON.stringify(result, null, 2));
  // The last frame it counted: a storm at high quality with the particle pool full.
  await page.screenshot({ path: resolve(out, 'measure-everything-on.png') });
} else if (flag('soak')) {
  const minutes = Number(value('soak', 5));
  const samples = await page.evaluate((m) => window.__sky.soak(m), minutes);
  console.table(samples);
  writeFileSync(resolve(out, 'soak.json'), JSON.stringify(samples, null, 2));
} else {
  // One picture for each entry in content/effects.ts, in the place the list says 'effects'.
  const effectIds = await page.evaluate(() => window.__sky.effectIds);
  const effectShots = effectIds.map((id) => [`fx-${id}`, { view: 'fx', time: GLOWING.has(id) ? 0.82 : 0.5, weather: 'clear', fx: id }, null]);
  shots.splice(shots.indexOf('effects'), 1, ...effectShots);
  const wanted = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--url', '--w', '--h'].includes(args[i - 1])));
  for (const [name, state, seconds, strikes] of shots) {
    if (wanted.length && !wanted.some((w) => name.startsWith(w))) continue;
    const counters = await page.evaluate(({ state, seconds, strikes }) => {
      const sky = window.__sky;
      // Start each picture from the same place: the top quality, and clear air for long enough that every
      // particle from the picture before has gone.
      sky.apply({ quality: 'high', weather: 'clear', time: 0.5, fx: '' });
      sky.advance(15);
      // A rainbow can follow the rain of the picture before. Keep it out unless this picture asks for one.
      sky.apply({ rainbow: 0, ...state, fx: '' });
      sky.advance(seconds ?? 1.5);
      if (state.fx) {
        // An effect is caught a little way into its life.
        sky.apply({ fx: state.fx });
        sky.advance(1 / 30);
        sky.apply({ fx: '' });
        sky.advance(state.fx === 'leaf' || state.fx === 'mote' || state.fx === 'firefly' ? 1.6 : 0.16);
      }
      if (strikes) {
        sky.strike();
        sky.advance(1 / 30);
      }
      return sky.render();
    }, { state, seconds, strikes });
    await page.screenshot({ path: resolve(out, `${name}.png`) });
    console.log(`${name.padEnd(18)} ${counters.calls} draw calls, ${counters.triangles} triangles, ${counters.particles} particles`);
  }
}

await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

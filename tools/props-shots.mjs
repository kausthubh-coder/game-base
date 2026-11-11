// Screenshots and counts for the props demo, in one browser session.
//   bun tools/props-shots.mjs                    every screenshot, into .artifacts/props/
//   bun tools/props-shots.mjs village pond       only the named ones (a name matches by its start)
//   bun tools/props-shots.mjs --measure          draw calls and triangles: the demo scene, and a forest of 2,000 props
//   bun tools/props-shots.mjs --only signpost    one kind on the turntable by day and at night, and the contact sheet of its group
// It needs the built demo served: bun tools/demo.mjs build props, then bun tools/serve.mjs dist/demos/props 5315.
// (bun tools/props-preview.mjs <kind> builds, serves and runs --only in one go.)
// Exits 1 when the page logged an error. This Mac draws WebGL in software: use it to look, never to time.
import { launchChrome } from './lib/chrome.mjs';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const value = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = value('url', 'http://127.0.0.1:5315/');
const out = resolve(import.meta.dirname, '../.artifacts/props');
mkdirSync(out, { recursive: true });

const DAY = 0.42, NIGHT = 0.92;
// name, the address, the state to apply, and seconds to run before the picture.
const GROUPS = ['tree', 'plant', 'ground', 'town', 'clutter', 'station'];
const shots = [
  ['village-day', '', { view: 'village', time: DAY }, 2],
  ['village-night', '', { view: 'village', time: NIGHT }, 4],
  ['village-dusk', '', { view: 'village', time: 0.765 }, 4],
  ['village-turned', '', { view: 'village', time: DAY, turn: 1 }, 2],
  ['village-close', '', { view: 'village', time: DAY, distance: 46, focus: [34, 56] }, 2],
  ['village-close-night', '', { view: 'village', time: NIGHT, distance: 46, focus: [34, 56] }, 4],
  ['village-inside', '', { view: 'village', time: DAY, roofs: false, distance: 70 }, 2],
  ['forest-edge', '', { view: 'forest', time: DAY }, 2],
  ['forest-close', '', { view: 'forest', time: DAY, distance: 30, focus: [44, 30] }, 2],
  ['forest-wind', '', { view: 'forest', time: DAY, distance: 30, focus: [44, 30], wind: 1 }, 2.4],
  ['pond-rim', '', { view: 'pond', time: DAY }, 2],
  ['pond-close', '', { view: 'pond', time: DAY, distance: 24, focus: [63.5, 76] }, 2],
  ['meadow', '', { view: 'village', time: DAY, distance: 34, focus: [10, 44] }, 2],
  ['everything', '', { view: 'whole', time: DAY }, 2],
  ['quality-low', '', { view: 'village', time: DAY, quality: 'low' }, 2],
  ['turntable-oak', '?only=oak', { angle: 0.5, time: DAY }, 1],
  ['turntable-lamp-night', '?only=lampPost', { angle: 0.6, time: NIGHT }, 4],
  ['turntable-stall', '?only=stall', { angle: 0.4, time: DAY }, 1],
];

const browser = await launchChrome({
  headless: true,
  args: [],
});
const WIDE = Number(value('w', 1600)), TALL = Number(value('h', 900));
const page = await (await browser.newContext({ viewport: { width: WIDE, height: TALL }, colorScheme: 'dark' })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

let address = null;
/** Opens a page of the demo unless it is the one already open, and stops its own clock. */
async function open(search) {
  if (address === search) return;
  await page.setViewportSize({ width: WIDE, height: TALL });
  await page.goto(`${url}${search}${search ? '&' : '?'}shots=1&panel=${flag('panel') ? 1 : 0}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__props !== undefined || window.__propsError !== undefined, null, { timeout: 60000 });
  const failed = await page.evaluate(() => window.__propsError);
  if (failed) {
    console.error(`the page could not start: ${failed}`);
    await browser.close();
    process.exit(1);
  }
  await page.evaluate(() => window.__props.apply({ paused: true }));
  address = search;
}

async function shoot(name, search, state, seconds) {
  await open(search);
  const counters = await page.evaluate(({ state, seconds }) => {
    const demo = window.__props;
    // Start each picture from the same place.
    if (demo.mode === 'world') demo.apply({ quality: 'high', roofs: true, turn: 0, wind: 0.35, windDir: 0.6 });
    demo.apply(state);
    demo.advance(seconds);
    return demo.render();
  }, { state, seconds });
  await page.screenshot({ path: resolve(out, `${name}.png`) });
  console.log(`${name.padEnd(22)} ${String(counters.calls).padStart(3)} draw calls, ${String(counters.triangles).padStart(7)} triangles, ${counters.props.drawn} props drawn in ${counters.props.drawCalls} + ${counters.props.shadowCalls} calls, ${counters.lights} lights${counters.glow > 0 ? ' lit' : ''}`);
}

/** One group's contact sheet, in a picture as tall as its rows need. It returns the file. */
async function sheet(group) {
  await open(`?sheet=${group}`);
  const tall = await page.evaluate((w) => window.__props.sheetHeight(w), WIDE);
  await page.setViewportSize({ width: WIDE, height: Math.max(240, Math.min(2400, tall)) });
  // The page resizes its canvas on its own clock. Draw only after it has.
  await page.waitForTimeout(250);
  address = null;
  const counters = await page.evaluate(() => { const demo = window.__props; demo.apply({ time: 0.42, wind: 0.3 }); demo.advance(1); return demo.render(); });
  const file = resolve(out, `sheet-${group}.png`);
  await page.screenshot({ path: file });
  console.log(`sheet-${group}`.padEnd(22), `${counters.props.drawn} props, ${counters.props.triangles} triangles`);
  return file;
}

if (flag('measure')) {
  await open('');
  const result = await page.evaluate(() => window.__props.measure());
  console.log('measure:', JSON.stringify(result, null, 2));
  writeFileSync(resolve(out, 'measure.json'), JSON.stringify(result, null, 2));
} else if (flag('only')) {
  const kind = value('only');
  await shoot(`only-${kind}`, `?only=${kind}`, { angle: 0.5, time: DAY }, 1);
  await shoot(`only-${kind}-night`, `?only=${kind}`, { angle: 0.5, time: NIGHT }, 4);
  const group = await page.evaluate(() => window.__props.group);
  if (group) await sheet(group);
} else {
  const wanted = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--url', '--w', '--h'].includes(args[i - 1])));
  const want = (name) => !wanted.length || wanted.some((w) => name.startsWith(w));
  for (const [name, search, state, seconds] of shots) if (want(name)) await shoot(name, search, state, seconds);

  // The contact sheet: one page for each group, each as tall as its rows need, joined top to bottom.
  if (want('contact-sheet') || want('sheet')) {
    const parts = [];
    for (const group of GROUPS) parts.push(await sheet(group));
    const metas = await Promise.all(parts.map((file) => sharp(file).metadata()));
    const height = metas.reduce((sum, m) => sum + m.height, 0);
    let top = 0;
    const layers = parts.map((file, i) => { const layer = { input: file, left: 0, top }; top += metas[i].height; return layer; });
    await sharp({ create: { width: metas[0].width, height, channels: 3, background: '#10141a' } }).composite(layers).png().toFile(resolve(out, 'contact-sheet.png'));
    console.log('contact-sheet.png', `${metas[0].width} by ${height}`);
  }
}

await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

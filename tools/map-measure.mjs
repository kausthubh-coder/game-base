// Times the minimap in the map demo: how long one frame's draw takes, averaged over 600 frames
// while the player walks and the camera turns, so every frame really draws.
//   bun tools/demo.mjs build map && bun tools/serve.mjs dist/demos/map 5316
//   bun tools/map-measure.mjs [http://127.0.0.1:5316/] [--runs 5] [--frames 600]
// It reports the median of the runs and their range, at one and two device pixels per CSS pixel.
// Exits 1 when a median is 1 ms or more, a frame did not draw, or the page logged an error.
import { chromium } from 'playwright-core';
import { cpus, loadavg } from 'node:os';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : Number(args[i + 1]); };
const base = args[0] && !args[0].startsWith('--') ? args[0] : 'http://127.0.0.1:5316/';
const runs = opt('runs', 5), frames = opt('frames', 600);

console.log(`machine: ${cpus().length} cores, load average ${loadavg().map((n) => n.toFixed(1)).join(' ')}`);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
let failed = false;
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const ms = (n) => n.toFixed(3);

async function openPage(dpr, onCpu) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  // Every 2D canvas drawn on the processor, in the page's own thread, so its cost can be timed there.
  if (onCpu) {
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, options) { return get.call(this, kind, kind === '2d' ? { ...options, willReadFrequently: true } : options); };
    });
  }
  return page;
}

for (const dpr of [1, 2]) {
  const page = await openPage(dpr, false);
  const context = page.context();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?fresh=1&aa=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.demo && demo.frames > 2, null, { timeout: 60000 });
  const canvas = await page.evaluate(() => { const c = document.querySelector('.gb-minimap canvas'); return `${c.width} by ${c.height} pixels, shown at ${c.clientWidth} CSS pixels`; });
  // How fine the page's clock is: the smallest step it can report.
  const tick = await page.evaluate(() => { let least = Infinity, last = performance.now(); for (let i = 0; i < 200000; i++) { const now = performance.now(); if (now > last) { least = Math.min(least, now - last); last = now; } } return least; });
  console.log(`\n== ${dpr} device pixel${dpr > 1 ? 's' : ''} per CSS pixel: minimap canvas ${canvas}; the page clock steps by ${ms(tick)} ms ==`);

  const measure = (speed, flush, render) => page.evaluate(([n, s, f, r]) => demo.measure(n, s, f, r), [frames, speed, flush, render]);
  const sum = (name, results, key) => {
    const values = results.map((r) => r[key]);
    console.log(`${name}: median ${ms(median(values))} ms, range ${ms(Math.min(...values))} to ${ms(Math.max(...values))} over ${results.length} runs of ${frames} frames; worst single frame ${ms(Math.max(...results.map((r) => r.minimapMaxMs)))} ms`);
    return median(values);
  };
  const allDrew = (results) => results.every((r) => r.drawn === r.frames && r.frames === frames);

  // The number the brief asks for: the minimap's own draw, walking at 4.4 blocks a second.
  const walking = [];
  for (let i = 0; i < runs; i++) walking.push(await measure(4.4, false, false));
  const walk = sum('minimap draw, walking', walking, 'minimapAvgMs');
  sum('whole map feature (minimap, seen cells, beam, saving), walking', walking, 'mapUpdateAvgMs');
  console.log(`every frame drew: ${allDrew(walking)} (${walking.map((r) => `${r.drawn}/${r.frames}`).join(', ')}); the player ended at ${walking.at(-1).x.toFixed(0)}, ${walking.at(-1).z.toFixed(0)}`);
  if (!allDrew(walking) || !(walk < 1)) failed = true;

  // Harder: riding at 20 blocks a second, so new land is painted far more often.
  const riding = [];
  for (let i = 0; i < 3; i++) riding.push(await measure(20, false, false));
  sum('minimap draw, riding at 20 blocks a second', riding, 'minimapAvgMs');

  // What the page's script does not show: the browser fills the pixels later, on the graphics card.
  // Reading a pixel back every frame forces that inside the timed part. Here the graphics card is
  // software and the read-back itself is slow, so this is far above what a real one costs.
  const flushed = [];
  for (let i = 0; i < 3; i++) flushed.push(await measure(4.4, true, false));
  const total = flushed.map((r) => ({ ...r, withFlush: r.mapUpdateAvgMs + r.flushAvgMs }));
  sum('whole map feature plus a forced read-back, software graphics', total, 'withFlush');

  // Once with the 3D scene drawing as well, as in the game. This Mac draws 3D in software, so it takes a while.
  const started = Date.now();
  const withScene = [await measure(4.4, false, true)];
  sum(`minimap draw with the 3D scene on (${((Date.now() - started) / frames).toFixed(0)} ms a frame in all)`, withScene, 'minimapAvgMs');
  if (!allDrew(withScene)) failed = true;

  // Standing still: nothing changes, so nothing is drawn.
  const still = await page.evaluate(async (n) => { demo.map.stats.reset(); const from = demo.frames; while (demo.frames < from + n) await new Promise(requestAnimationFrame); const s = demo.map.stats; return { avg: s.totalMs / s.frames, drawn: s.drawn, frames: s.frames }; }, 120);
  console.log(`the player standing still while friends walk: ${ms(still.avg)} ms a frame, ${still.drawn} of ${still.frames} frames drew`);
  await context.close();

  // The fairest upper bound this Mac can give: script and pixels both on one processor thread.
  const cpu = await openPage(dpr, true);
  cpu.on('pageerror', (e) => errors.push(String(e)));
  await cpu.goto(`${base}?fresh=1&aa=0`, { waitUntil: 'load' });
  await cpu.waitForFunction(() => window.demo && demo.frames > 2, null, { timeout: 60000 });
  const onCpu = [];
  for (let i = 0; i < runs; i++) onCpu.push(await cpu.evaluate(([n]) => demo.measure(n, 4.4, true, false), [frames]));
  const cpuTotal = sum('whole map feature with its pixels filled on the processor, walking', onCpu.map((r) => ({ ...r, withFlush: r.mapUpdateAvgMs + r.flushAvgMs })), 'withFlush');
  if (!(cpuTotal < 1)) console.log('  (over 1 ms: on a machine with no graphics card for 2D canvas the minimap would not fit the budget)');
  await cpu.context().close();
}

await browser.close();
console.log(`\nmachine after: load average ${loadavg().map((n) => n.toFixed(1)).join(' ')}`);
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
console.log(failed ? 'FAILED: a median was 1 ms or more, or a frame did not draw' : 'PASS: the minimap draws in under 1 ms a frame on average');
process.exit(failed || errors.length ? 1 : 0);

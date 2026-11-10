// Measures the world demo against its budgets in headless Chrome.
//   bun tools/world-measure.mjs budget   draw calls and triangles at every quality, zoom and camera turn
//   bun tools/world-measure.mjs edits    main-thread chunk work per frame while placing 50 blocks in a row
//   bun tools/world-measure.mjs walk [seconds]   chunks and live geometries during a long scripted walk
// Options: --url http://127.0.0.1:5311/   --out .artifacts/world
// This Mac draws WebGL in software. Counts and script times are real. Frame rates are not, so none are reported.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const mode = args[0];
const url = opt('url', 'http://127.0.0.1:5311/');
const out = resolve(opt('out', '.artifacts/world'));
mkdirSync(out, { recursive: true });
if (!['budget', 'edits', 'walk'].includes(mode)) { console.error('usage: bun tools/world-measure.mjs budget | edits | walk [seconds]'); process.exit(2); }

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
async function open(query, width = 1920, height = 1080) {
  const page = await (await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url + query, { waitUntil: 'load' });
  await page.waitForFunction(() => 'demo' in window);
  await page.evaluate(() => demo.settle());
  return page;
}
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const round = (v, digits = 2) => Number(v.toFixed(digits));

if (mode === 'budget') {
  // The budget is 150 draw calls and 400,000 triangles at the default view distance, at 1080p.
  const rows = [];
  for (const quality of ['high', 'medium', 'low']) {
    const page = await open(`?auto=0&quality=${quality}`);
    for (const place of ['spawn', 'house', 'cave']) {
      await page.evaluate((p) => demo.goto(p), place);
      for (let zoom = 0; zoom < 3; zoom++) {
        await page.evaluate((z) => { demo.camera.zoomBy(-3); for (let i = 0; i < z; i++) demo.camera.zoomBy(1); }, zoom);
        for (let turn = 0; turn < 4; turn++) {
          await page.evaluate(() => demo.camera.turn(1));
          await page.waitForTimeout(1500);
          await page.evaluate(() => demo.settle());
          await page.evaluate(() => demo.frames(3));
          const n = await page.evaluate(() => demo.numbers());
          rows.push({ quality, radius: n.radius, place, zoom, turn: (turn + 1) % 4, drawCalls: n.drawCalls, triangles: n.triangles, chunks: n.chunks, meshes: n.meshes });
        }
      }
    }
    await page.context().close();
  }
  writeFileSync(resolve(out, 'budget.json'), JSON.stringify(rows, null, 1));
  const summary = ['high', 'medium', 'low'].map((quality) => {
    const mine = rows.filter((r) => r.quality === quality);
    const worst = (key) => mine.reduce((a, b) => (b[key] > a[key] ? b : a));
    const calls = worst('drawCalls'), tris = worst('triangles');
    return {
      quality, radius: mine[0].radius, views: mine.length,
      'draw calls, worst': calls.drawCalls, at: `${calls.place} zoom ${calls.zoom} turn ${calls.turn}`,
      'draw calls, median': median(mine.map((r) => r.drawCalls)),
      'triangles, worst': tris.triangles, 'triangles, median': median(mine.map((r) => r.triangles)),
      'start view': JSON.stringify((({ drawCalls, triangles }) => ({ drawCalls, triangles }))(mine.find((r) => r.place === 'spawn' && r.zoom === 1 && r.turn === 0))),
    };
  });
  console.table(summary);
  const over = rows.filter((r) => r.drawCalls > 150 || r.triangles > 400000);
  console.log(over.length ? `OVER BUDGET in ${over.length} of ${rows.length} views` : `within budget (150 draw calls, 400,000 triangles) in all ${rows.length} views`);
  if (over.length) console.table(over);
}

if (mode === 'edits') {
  // The budget is 4 ms of main-thread chunk work in any one frame.
  const page = await open('?auto=0&quality=high');
  const run = (kind, perFrame) => page.evaluate(async ([kind, perFrame]) => {
    const { world, hero } = demo;
    // Flat open meadow, far from the start site. The row runs along a chunk edge and crosses three
    // more, so every block touches at least two chunks.
    const z = -4 * 16 + 15, x0 = 6 * 16 + 2;
    demo.moveHero(x0 + 24.5, world.query.heightAt(x0 + 24, z + 4) + 0.01, z + 4.5);
    await demo.frames(3);
    await demo.settle();
    const id = kind === 'lamp' ? 23 : 7;
    const y = world.query.heightAt(x0, z);
    let flat = true;
    for (let i = 0; i < 50; i++) if (world.query.heightAt(x0 + i, z) !== y) flat = false;
    world.resetWorst();
    const perFrameMs = [];
    let worstSet = 0, totalSet = 0, placed = 0;
    for (let i = 0; i < 50;) {
      for (let k = 0; k < perFrame && i < 50; k++, i++) {
        const t = performance.now();
        if (world.setBlock(x0 + i, y, z, id)) placed++;
        const ms = performance.now() - t;
        worstSet = Math.max(worstSet, ms);
        totalSet += ms;
      }
      await demo.frames(1);
      perFrameMs.push(world.stats.meshMs);
    }
    // Keep counting until every mesh has caught up, so work pushed to later frames is not missed.
    let catchUp = 0;
    while (world.stats.queue > 0 && catchUp < 600) { await demo.frames(1); perFrameMs.push(world.stats.meshMs); catchUp++; }
    await demo.frames(2);
    let there = 0;
    for (let i = 0; i < 50; i++) if (world.sim.getBlock(x0 + i, y, z) === id) there++;
    const lit = world.sim.blockLightAt(x0 + 25, y + 1, z);
    const worst = world.stats.worstMeshMs;
    // Put the land back for the next run.
    for (let i = 0; i < 50; i++) world.setBlock(x0 + i, y, z, 0);
    await demo.frames(2);
    await demo.settle();
    return { flat, placed, there, lit, frames: perFrameMs.length, catchUp, worstFrameMs: worst, worstSampled: Math.max(...perFrameMs), meanFrameMs: perFrameMs.reduce((a, b) => a + b, 0) / perFrameMs.length, worstSetMs: worstSet, meanSetMs: totalSet / 50 };
  }, [kind, perFrame]);

  const rows = [];
  for (const [kind, perFrame] of [['stone', 1], ['lamp', 1], ['stone', 50], ['lamp', 50]]) {
    const runs = [];
    for (let i = 0; i < 5; i++) runs.push(await run(kind, perFrame));
    const worst = runs.map((r) => r.worstFrameMs);
    rows.push({
      'block': kind, 'placed per frame': perFrame, runs: runs.length,
      'all 50 placed and meshed': runs.every((r) => r.placed === 50 && r.there === 50 && r.flat),
      'worst frame, ms (median of runs)': round(median(worst)), 'range': `${round(Math.min(...worst))} to ${round(Math.max(...worst))}`,
      'mean frame, ms': round(median(runs.map((r) => r.meanFrameMs))),
      'frames to catch up': median(runs.map((r) => r.catchUp)),
      'setBlock worst, ms': round(Math.max(...runs.map((r) => r.worstSetMs)), 3), 'setBlock mean, ms': round(median(runs.map((r) => r.meanSetMs)), 3),
      'lamp light at the row': runs[0].lit,
    });
  }
  writeFileSync(resolve(out, 'edits.json'), JSON.stringify(rows, null, 1));
  console.table(rows);
  const worst = Math.max(...rows.map((r) => Number(r.range.split(' to ')[1])));
  console.log(worst <= 4 ? `within budget: the worst frame of all runs spent ${worst} ms of main-thread chunk work (budget 4 ms)` : `OVER BUDGET: ${worst} ms in one frame`);
}

if (mode === 'walk') {
  // Five minutes of walking in a straight line. Loaded chunks and live geometries must stay flat.
  const seconds = Number(args[1]) || 300;
  const page = await open('?auto=0&quality=high', 960, 540);
  const sample = () => page.evaluate(() => {
    const n = demo.numbers();
    return { chunks: n.chunks, meshes: n.meshes, drawn: n.drawn, queue: n.queue, geometries: n.geometries, textures: n.textures, heapMb: Math.round(n.heapMb), x: Math.round(n.hero.x), y: Math.round(n.hero.y), z: Math.round(n.hero.z) };
  });
  // Step into the house and back first, so the cutaway's own mesh has been drawn once before the first count.
  await page.evaluate(() => demo.goto('house'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => demo.goto('spawn'));
  await page.evaluate(() => demo.frames(5));
  const start = await sample();
  await page.evaluate(() => demo.walk(true));
  const began = Date.now();
  const samples = [];
  while (Date.now() - began < seconds * 1000) {
    await page.waitForTimeout(10000);
    samples.push({ t: Math.round((Date.now() - began) / 1000), ...(await sample()) });
  }
  const lifts = await page.evaluate(() => demo.walk(false));
  await page.evaluate(() => demo.settle());
  const end = await sample();
  const walked = Math.hypot(end.x - start.x, end.z - start.z);
  // Go back to where the walk began. With nothing left over from the walk, the counts match the start exactly.
  await page.evaluate(() => demo.goto('spawn'));
  await page.evaluate(() => demo.frames(5));
  await page.evaluate(() => demo.settle());
  const home = await sample();
  const half = samples.slice(Math.floor(samples.length / 2)), first = samples.slice(0, samples.length - half.length);
  const span = (list, key) => `${Math.min(...list.map((s) => s[key]))} to ${Math.max(...list.map((s) => s[key]))}`;
  writeFileSync(resolve(out, 'walk.json'), JSON.stringify({ seconds, start, end, home, lifts, walked, samples }, null, 1));
  console.table(samples.filter((_, i) => i % 3 === 2 || i === 0));
  console.table([
    { when: 'standing at the start', chunks: start.chunks, 'meshes in the scene': start.drawn, geometries: start.geometries, textures: start.textures, heapMb: start.heapMb },
    { when: 'first half of the walk', chunks: span(first, 'chunks'), 'meshes in the scene': span(first, 'drawn'), geometries: span(first, 'geometries'), textures: span(samples, 'textures'), heapMb: span(first, 'heapMb') },
    { when: 'second half of the walk', chunks: span(half, 'chunks'), 'meshes in the scene': span(half, 'drawn'), geometries: span(half, 'geometries'), textures: span(half, 'textures'), heapMb: span(half, 'heapMb') },
    { when: 'standing at the end', chunks: end.chunks, 'meshes in the scene': end.drawn, geometries: end.geometries, textures: end.textures, heapMb: end.heapMb },
    { when: 'back at the start', chunks: home.chunks, 'meshes in the scene': home.drawn, geometries: home.geometries, textures: home.textures, heapMb: home.heapMb },
  ]);
  // A geometry counts as live once it has been on screen, so that count may be lower than at the start, never higher.
  console.log(home.chunks === start.chunks && home.drawn === start.drawn && home.geometries <= start.geometries
    ? 'back at the start, chunks and meshes match the first count and no geometry is left over'
    : `LEFT OVER: start ${JSON.stringify(start)}, back at the start ${JSON.stringify(home)}`);
  // A live geometry is one the renderer has uploaded. It can never outnumber the meshes in the scene (plus the cutaway cap, the hero and the outline).
  const leak = samples.filter((s) => s.geometries > s.drawn + 3);
  console.log(leak.length ? `LEAK: ${leak.length} samples have more live geometries than meshes in the scene` : 'no sample has more live geometries than meshes in the scene');
  console.log(`walked ${Math.round(walked)} blocks (${Math.round(walked / 16)} chunks) in ${seconds} s, lifted over an obstacle ${lifts} times`);
}

await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

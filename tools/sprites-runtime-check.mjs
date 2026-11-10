// The numbers and the GPU checks for the sprites demo, in headless Chrome.
//   bun tools/sprites-runtime-check.mjs              every check
//   bun tools/sprites-runtime-check.mjs garbage calls   only the named ones
// It needs the built demo served: bun tools/demo.mjs build sprites, then bun tools/serve.mjs dist/demos/sprites 5314.
// What it checks, and exits 1 when any of it fails:
//   drawn      every frame of every animation of every sprite, from every side, drawn by the GPU at one screen
//              pixel per sprite pixel and compared with the sheet (frame for the time, row, mirror, anchor, alpha cut)
//   calls      draw calls for sprites and shadows with 500 characters: 3 or fewer
//   churn      1,000 characters added and removed ten times: the same count of geometries and textures after each round
//   garbage    bytes the per-frame work allocates, sampled by Chrome's heap profiler over 3,000 frames with the
//              camera turning: a few boxed numbers a frame, and no more with 1,000 characters than with 100
//   missing    a sprite the manifest lacks shows the placeholder and says so on screen
//   lost       a sheet that is listed but answers 404 stops the load with a message that names it
// The results go to .artifacts/sprites-runtime/check.json.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const value = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = value('url', 'http://127.0.0.1:5314/');
const named = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--url');
const want = (name) => named.length === 0 || named.includes(name);
const out = resolve(import.meta.dirname, '../.artifacts/sprites-runtime');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const failures = [];
const report = {};
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
  if (!ok) failures.push(name);
};

async function open(query, { wait = true } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return { page, errors, async go() {
    await page.goto(`${url}?shots=1&paused=1${query ? '&' + query : ''}`, { waitUntil: 'load' });
    if (wait) await page.waitForFunction(() => window.__sprites !== undefined, null, { timeout: 30000 });
  } };
}

// ---- the main page: drawn, calls, churn
{
  const { page, errors, go } = await open('');
  await go();

  // The same check three ways: the default atlas, one with no mipmaps, and one with pages so small the sheets need several.
  for (const [label, query] of want('drawn') ? [['smooth atlas', ''], ['nearest atlas', 'filter=nearest'], ['atlas of 1024 pixel pages', 'atlas=1024']] : []) {
    const tab = query === '' ? { page } : await open(query);
    if (query !== '') await tab.go();
    const drawn = await tab.page.evaluate(() => window.__sprites.selfTest());
    const atlas = await tab.page.evaluate(() => window.__sprites.atlas());
    report[`drawn: ${label}`] = { ...drawn, atlas };
    check(`drawn (${label})`, drawn.cases > 0 && drawn.failed.length === 0 && (query !== 'atlas=1024' || atlas.pages > 1),
      `${drawn.cases} frames drawn and compared with the sheets, ${drawn.failed.length} differ, largest color difference ${drawn.worstColor} of 255. `
      + `${atlas.sheets} sheets on ${atlas.pages} page${atlas.pages === 1 ? '' : 's'} of ${atlas.width} by ${atlas.height}`
      + (drawn.failed.length ? `. First: ${JSON.stringify(drawn.failed[0])}` : ''));
    if (query !== '') await tab.page.close();
  }

  const calls = {};
  for (const count of want('calls') ? [0, 200, 500, 1000] : []) {
    calls[count] = await page.evaluate((n) => { window.__sprites.apply({ count: n, zoom: 4, solo: '' }); return window.__sprites.advance(1); }, count);
  }
  report.calls = calls;
  const at500 = calls[500];
  if (want('calls')) check('calls', at500.characters === 500 && at500.spriteCalls <= 3 && at500.spriteCalls > 0 && at500.calls - calls[0].calls <= 3,
    `with 500 characters the sprites and their shadows take ${at500.spriteCalls} draw calls and ${at500.spriteTriangles} triangles. `
    + `The whole frame is ${at500.calls} draw calls (${calls[0].calls} with no characters, ${calls[200].calls} with 200, ${calls[1000].calls} with 1,000)`);
  if (want('calls')) await page.screenshot({ path: resolve(out, 'check-500.png') });

  await page.evaluate(() => { window.__sprites.apply({ count: 200 }); window.__sprites.advance(0.5); });
  const churn = want('churn') ? await page.evaluate(() => window.__sprites.churn(1000, 10)) : [{}];
  report.churn = churn;
  const after = churn.slice(1);
  const flat = after.every((r) => r.geometries === churn[0].geometries && r.textures === churn[0].textures) && after.every((r) => r.atPeak === 1200);
  if (want('churn')) check('churn', flat,
    `geometries ${churn.map((r) => r.geometries).join(' ')} and textures ${churn.map((r) => r.textures).join(' ')} `
    + `before and after each of 10 rounds of 1,000 added and removed (1,200 alive at each peak, room for ${churn.at(-1).capacity})`);

  // What a frame allocates. Chrome's heap profiler samples every allocation, also the ones a collection has already freed.
  // It cannot tell an object from a number: V8 makes a 12 byte heap number whenever a fraction is passed to, or
  // returned from, a function it did not inline. So the gate is on the sprite system's own work with the crowd
  // standing still, and the walking crowd is reported beside it.
  if (want('garbage')) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    const sample = async (characters, frames, wander) => {
      await page.evaluate(([n, w]) => { window.__sprites.apply({ count: n, solo: '' }); window.__sprites.steps(6000, 50, w); }, [characters, wander]);
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 64, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
      await page.evaluate(([n, w]) => window.__sprites.steps(n, 50, w), [frames, wander]);
      const { profile } = await cdp.send('HeapProfiler.stopSampling');
      const byFunction = new Map();
      let bytes = 0;
      (function walk(node) {
        if (node.selfSize > 0) {
          bytes += node.selfSize;
          const name = `${node.callFrame.functionName || '(anonymous)'} ${node.callFrame.url.split('/').pop()}:${node.callFrame.lineNumber + 1}:${node.callFrame.columnNumber + 1}`;
          byFunction.set(name, (byFunction.get(name) ?? 0) + node.selfSize);
        }
        node.children.forEach(walk);
      })(profile.head);
      const top = [...byFunction].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([name, size]) => ({ name, bytesPerFrame: Math.round(size / frames) }));
      return { characters, frames, bytes, perFrame: Math.round(bytes / frames), top };
    };
    const FRAMES = 3000;
    const still100 = await sample(100, FRAMES, false), still1000 = await sample(1000, FRAMES, false), walking = await sample(1000, FRAMES, true);
    report.garbage = { still100, still1000, walking };
    // One small object per character per frame would be 16,000 bytes a frame or more at 1,000 characters.
    check('garbage', still1000.perFrame < 512 && still1000.perFrame < still100.perFrame + 256,
      `the camera and the sprite system allocate ${still100.perFrame} bytes a frame with 100 characters and ${still1000.perFrame} with 1,000, `
      + `over ${FRAMES} frames with the camera turning every 50. With the 1,000 walking, the demo's crowd loop included: ${walking.perFrame} bytes a frame`
      + (walking.top.length ? ` (most from ${walking.top[0].name}: ${walking.top[0].bytesPerFrame})` : ''));
  }

  check('console', errors.length === 0, errors.length ? errors.join(' | ') : 'no console errors on the demo page');
  await page.close();
}

// ---- a sprite the manifest does not have
if (want('missing')) {
  const { page, errors, go } = await open('cast=hero,ghost,pet&count=60&zoom=2');
  await go();
  await page.evaluate(() => { window.__sprites.advance(1); });
  const notice = await page.locator('#notice').textContent();
  const missing = await page.evaluate(() => window.__sprites.missing());
  report.missing = { notice, missing };
  await page.screenshot({ path: resolve(out, 'missing-sprite.png') });
  check('missing', missing.join() === 'ghost' && /ghost/.test(notice) && /placeholder/.test(notice) && errors.length === 0, `on screen: "${notice}"`);
  await page.close();
}

// ---- a file the manifest lists but the server does not have
if (want('lost')) {
  const { page, go } = await open('', { wait: false });
  await page.route('**/assets/sprites/pet.png', (route) => route.fulfill({ status: 404, body: 'not found' }));
  await go();
  await page.waitForFunction(() => document.getElementById('notice').textContent !== '', null, { timeout: 30000 });
  const notice = await page.locator('#notice').textContent();
  report.lostFile = { notice };
  await page.screenshot({ path: resolve(out, 'missing-file.png') });
  check('lost file', /sprites\/pet\.png/.test(notice) && /sprite "pet"/.test(notice) && /404/.test(notice), `on screen: "${notice}"`);
  await page.close();
}

if (named.length === 0) writeFileSync(resolve(out, 'check.json'), JSON.stringify(report, null, 2));
else if (report.garbage) console.log(JSON.stringify(report.garbage, null, 1).slice(0, 5000));
await browser.close();
console.log(failures.length ? `FAILED: ${failures.join(', ')}` : 'all checks passed');
process.exit(failures.length ? 1 : 0);

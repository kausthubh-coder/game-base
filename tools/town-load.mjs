// How many bytes the game fetches to start, and how many more when the hero reaches Hollowmere, for one layout
// of the town (src/game/content/town/). It opens an already served build with `?town=<name>` in a fresh
// browser, starts a new game, waits for the land at the spawn to be drawn, and sums every response. Then it
// walks the hero into town by teleport and sums what comes after, until the town kit's models are drawn.
//   bun tools/town-load.mjs --town a [--url http://127.0.0.1:5391/]
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = opt('url', 'http://127.0.0.1:5391/');
const town = opt('town', 'now');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const phases = { start: new Map(), town: new Map() };
let phase = phases.start;
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  page.setDefaultTimeout(600000);
  page.on('response', async (response) => {
    const into = phase;
    try { into.set(response.url(), (await response.body()).length); } catch { /* a redirect or an aborted request has no body */ }
  });
  await page.goto(`${url}?hold=1&quality=low&town=${town}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(async () => { const g = window.__game; g.newGame(); await g.frames(4); await g.settle(); await g.frames(4); });
  await page.waitForTimeout(2000);
  phase = phases.town;
  await page.evaluate(async () => { const g = window.__game; g.teleport('town.square'); await g.frames(4); await g.settle(); });
  const drawn = await page.evaluate(async () => {
    const scene = window.__game.view.scene;
    for (let i = 0; i < 600; i++) {
      if (scene.getObjectByName('town models: body')) return true;
      await new Promise((done) => setTimeout(done, 250));
    }
    return Boolean(scene.getObjectByName('town models: body'));
  });
  await page.waitForTimeout(1000);
  const kb = (map) => [...map.values()].reduce((a, b) => a + b, 0) / 1024;
  const list = (map) => [...map].filter(([u]) => /models\/town|draco|DRACO|Draco/.test(u)).map(([u, b]) => `    ${u.replace(url, '')}  ${(b / 1024).toFixed(1)} KB`);
  console.log(`town ${town}`);
  console.log(`  first load: ${kb(phases.start).toFixed(1)} KB in ${phases.start.size} responses`);
  for (const line of list(phases.start)) console.log(line);
  console.log(`  on reaching the town: ${kb(phases.town).toFixed(1)} KB in ${phases.town.size} responses${drawn ? ', the kit drawn' : ''}`);
  console.log(`    of it the town kit and its decoder: ${(list(phases.town).length ? [...phases.town].filter(([u]) => /models\/town|draco/i.test(u)).reduce((a, [, b]) => a + b, 0) / 1024 : 0).toFixed(1)} KB in ${list(phases.town).length} files`);
} finally {
  await browser.close();
}

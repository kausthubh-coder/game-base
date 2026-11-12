// One picture of a film at each moment asked for, held with `?cut-at=`, and what each moment costs to draw.
//   bun tools/film-shots.mjs [--url http://localhost:$PORT] [--scene 9] [--at 3.5,7.5,11,16.5,20.5,23.5]
//                            [--quality high] [--out .artifacts/cutscene] [--w 1280] [--h 720]
// Every moment opens in a fresh browser context, so `?scene=` starts a new game with no save. It prints the
// renderer, then one line a moment: the draw calls and triangles of `window.__game.costs()` and the picture's
// path. Exits 1 when the page logged an error. Pictures only: never read a frame rate from it (AGENTS.md rule 7).
import { mkdirSync } from 'node:fs';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const base = opt('url', `http://localhost:${process.env.PORT ?? 5300}`).replace(/\/$/, '');
const scene = opt('scene', '9');
const moments = opt('at', '3.5,7.5,11,16.5,20.5,23.5').split(',').map(Number);
const quality = opt('quality', 'high');
const out = opt('out', '.artifacts/cutscene');
const width = Number(opt('w', 1280)), height = Number(opt('h', 720));
mkdirSync(out, { recursive: true });

const browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const [i, at] of moments.entries()) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?scene=${scene}&cut-at=${at}&quality=${quality}`, { waitUntil: 'load' });
  // The film is on once its flag is set; then the land in view is let load, and a few frames drawn.
  await page.waitForFunction(() => window.__game?.state?.().flags?.['cut.scene' + new URLSearchParams(location.search).get('scene')] === true, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.settle());
  await page.evaluate(() => window.__game.frames(30));
  const costs = await page.evaluate(() => window.__game.costs());
  const path = `${out}/shot-${i + 1}${quality === 'high' ? '' : `-${quality}`}.png`;
  await page.screenshot({ path });
  const top = costs.features.slice(0, 6).map((f) => `${f.feature} ${f.drawCalls}/${f.triangles}`).join(', ');
  console.log(`shot ${i + 1} at ${at}s, ${quality}: ${costs.total.drawCalls} draw calls, ${costs.total.triangles} triangles (${top}) -> ${path}`);
  await context.close();
}
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

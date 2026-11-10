// Checks that Settings > View > Characters swaps the whole cast at once, both ways, with no reload: after each
// switch every actor on screen is drawn in the new look and none in the old one. It switches back and forth twice.
// Models off screen are left out of the draw, so a model count is between the actors on screen and all of them.
//   bun tools/chars-swap.mjs --url http://127.0.0.1:5384/
// It exits 1 on a wrong count, a reload or a console error.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const url = opt('url', 'http://127.0.0.1:5384/');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 960, height: 600 } })).newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const game = (js, arg) => page.evaluate(js, arg);
// Starts in sprites, the default, with nothing stored.
await page.goto(`${url}?hold=1&quality=medium`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game !== undefined);
await game(async () => {
  const g = window.__game;
  g.newGame();
  g.teleport('town.square');
  g.advance(2);
  await g.settle();
  window.__notReloaded = true;
});

/** What is drawn now: actors, sprites and model instances by body. */
const count = () => game(async () => {
  const g = window.__game;
  await g.frames(3);
  const models = {};
  let modelTotal = 0;
  g.view.scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.name.startsWith('toon-') || o.name.startsWith('toon-outline') || o.name.startsWith('toon-shadow')) return;
    if (o.visible && o.count > 0) { models[o.name.slice(5)] = o.count; modelTotal += o.count; }
  });
  const visible = [...g.view.game.actors.values()].filter((a) => a.visible);
  const onScreen = visible.filter((a) => g.view.project(a.pos.x, a.pos.y + 1, a.pos.z) !== null).length;
  return { look: g.state().characters, actors: visible.length, onScreen, sprites: g.counters().sprites, modelTotal, models, notReloaded: window.__notReloaded === true };
});

let failed = false;
const report = (step, c, want) => {
  const ok = c.notReloaded && (want === 'models'
    ? c.modelTotal >= c.onScreen && c.modelTotal <= c.actors && c.onScreen > 0 && c.sprites === 0
    : c.modelTotal === 0 && c.sprites >= c.actors);
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${step}: ${c.look}, ${c.actors} actors (${c.onScreen} on screen), ${c.sprites} sprites, ${c.modelTotal} models ${JSON.stringify(c.models)}${c.notReloaded ? '' : ', the page reloaded'}`);
};

report('start', await count(), 'sprites');
for (let round = 1; round <= 2; round++) {
  await game(() => window.__game.setCharacters('models'));
  // The first switch loads the models; wait for them.
  await page.waitForFunction(() => { let n = 0; window.__game.view.scene.traverse((o) => { if (o.isInstancedMesh && o.name.startsWith('toon-') && o.count > 0) n++; }); return n > 0; });
  report(`round ${round}, to models`, await count(), 'models');
  await game(() => window.__game.setCharacters('sprites'));
  report(`round ${round}, to sprites`, await count(), 'sprites');
}
await browser.close();
if (errors.length) { failed = true; console.log('console errors:\n' + errors.join('\n')); } else console.log('no console errors');
process.exit(failed ? 1 : 0);

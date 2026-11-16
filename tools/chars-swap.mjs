// Compatibility command: characters are now always sprites. Prove old preferences and URLs cannot enable models.
// bun tools/chars-swap.mjs --url <built game> --out <new evidence directory>
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { cameraStill } from './play/wait.mjs';
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf('--' + name); return i < 0 ? undefined : args[i + 1]; };
const base = opt('url'), directory = opt('out');
if (!base || !directory) throw Error('Supply --url and a new --out directory. Coordinate resource admission before running.');
const out = resolve(directory);
if (existsSync(out)) throw Error('Evidence directory already exists.');
mkdirSync(out, { recursive: true });
const checks = [], errors = [], requests = [];
let browser;
try {
  browser = await launchChrome({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // A fresh private context tests legacy settings without touching the player's browser or save.
  await context.addInitScript(() => localStorage.setItem('greenhollow.settings', JSON.stringify({ characters: 'models' })));
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (/cast-[^/]+\.glb/.test(r.url())) requests.push(r.url()); });
  const url = new URL(base); url.searchParams.set('chars', 'models'); url.searchParams.set('hold', '1');
  await page.goto(url.href);
  await page.waitForFunction(() => !!window.__game);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = await page.locator('.gu-settings-view').innerText();
  checks.push({ name: 'Settings has no character renderer choice', pass: !/Characters|3D models/.test(settings), settings });
  await page.locator('.gu-settings-view').scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(out, 'settings.png') });
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const g = window.__game; g.newGame(); await g.settle();
    if (g.view.game.systems.talk.active) g.view.game.systems.talk.skip();
    g.setCamera('tilt'); g.manual(true);
  });
  for (const place of ['town.square', 'grant.rocks']) {
    await page.evaluate(async place => { const g = window.__game; g.teleport(place); g.advance(2); await g.settle(); }, place);
    await cameraStill(page);
    const result = await page.evaluate(() => {
      const g = window.__game, meshes = [];
      g.view.scene.traverse(o => { if (o.name.startsWith('toon-')) meshes.push(o.name); });
      const actors = [...g.view.game.actors.values()].filter(a => a.visible).map(a => ({ id: a.id, sprite: a.sprite }));
      return { characters: g.state().characters, actors, sprites: g.counters().sprites, meshes, hasSwitch: typeof g.setCharacters === 'function' };
    });
    checks.push({ name: place + ' uses only sprites despite legacy model preference', pass: result.characters === 'sprites' && !result.hasSwitch && result.meshes.length === 0 && result.sprites >= result.actors.length && result.actors.some(a => a.id === 'player'), result });
    await page.screenshot({ path: resolve(out, place.replace('.', '-') + '.png') });
  }
  checks.push({ name: 'no character model downloads', pass: requests.length === 0, requests });
  checks.push({ name: 'clean browser output', pass: errors.length === 0, errors });
  if (checks.some(c => !c.pass)) process.exitCode = 1;
} catch (error) {
  errors.push(String(error)); process.exitCode = 1;
} finally {
  writeFileSync(resolve(out, 'result.json'), JSON.stringify({ checks, errors, pass: checks.length === 5 && checks.every(c => c.pass) && errors.length === 0 }, null, 2));
  await browser?.close();
}
for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
if (errors.length) console.error(errors);

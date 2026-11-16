// Opens a deployed copy of the game the way a player does, starts a new game and takes two pictures.
//
//   bun tools/live-look.mjs <url> [out folder]
//
// It reads and never writes: a new game lives in this browser only. Exit 1 on a console error, a page
// that never finishes loading, or a game that does not start.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const url = process.argv[2];
if (!url) {
  console.error('usage: bun tools/live-look.mjs <url> [out folder]');
  process.exit(1);
}
const out = resolve(process.argv[3] ?? '.artifacts/live');
mkdirSync(out, { recursive: true });

const browser = await launchChrome();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(String(error)));

let failed = '';
try {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  console.log(`page ${response?.status()} ${url}`);
  await page.waitForFunction(() => !document.querySelector('#loading') && '__game' in window, null, { timeout: 120_000 });
  await page.screenshot({ path: resolve(out, 'title.png') });
  await page.locator('[data-key="title:new"]').click({ timeout: 30_000 });
  await page.waitForFunction(() => window.__game.started === true, null, { timeout: 60_000 });
  await page.locator('[data-key="opening:skip"]').waitFor();
  await page.screenshot({ path: resolve(out, 'opening.png') });
  await page.locator('[data-key="opening:skip"]').click();
  await page.waitForFunction(() => Boolean(window.__game.state().talk));
  for (let line = 0; line < 40 && await page.evaluate(() => Boolean(window.__game.state().talk)); line++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => !window.__game.state().talk && !window.__game.state().player.busy);
  const before = await page.evaluate(() => window.__game.state().player);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => window.__game.state().player);
  if (Math.hypot(after.x - before.x, after.z - before.z) < 0.2) throw Error('world controls did not move the hero after the opening');
  writeFileSync(resolve(out, 'controls.json'), JSON.stringify({ before, after }, null, 2));
  await page.screenshot({ path: resolve(out, 'playing.png') });
  const state = await page.evaluate(() => window.__game.state());
  const build = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((src) => /index-/.test(src)) ?? '');
  console.log(`started ${state.started}, day ${state.clock.day}, quality ${state.quality}, systems ${state.systems.length}, failed ${JSON.stringify(state.failed)}`);
  console.log(`script ${build}`);
  if (!state.started) failed = 'the game did not start';
} catch (error) {
  failed = String(error);
  await page.screenshot({ path: resolve(out, 'failed.png') }).catch(() => {});
}
await browser.close();

for (const error of errors) console.log(`console error: ${error}`);
if (failed) console.log(`FAIL: ${failed}`);
console.log(failed || errors.length > 0 ? `FAIL: pictures in ${out}` : `PASS: no console errors, pictures in ${out}`);
process.exit(failed || errors.length > 0 ? 1 : 0);

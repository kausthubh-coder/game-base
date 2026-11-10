// Takes the world demo's screenshots in one headless Chrome session and fails on a console error.
//   bun tools/world-shots.mjs [url] [outDir]
// It drives the page the way a player does (keys, wheel, mouse buttons) and prints the meter's
// numbers for every view. This Mac draws WebGL in software: the pictures are real, a frame rate is not.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:5311/';
const out = resolve(process.argv[3] ?? '.artifacts/world');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const rows = [];
async function shot(name, note = '') {
  await page.evaluate(() => demo.settle());
  await page.waitForTimeout(400);
  await page.evaluate(() => demo.frames(3));
  const n = await page.evaluate(() => demo.numbers());
  rows.push({ view: name, quality: n.quality, radius: n.radius, zoom: await page.evaluate(() => demo.camera.zoom), drawCalls: n.drawCalls, triangles: n.triangles, chunks: n.chunks, cutaway: n.cutaway.mode, note });
  await page.screenshot({ path: resolve(out, name + '.png') });
}
const click = async (x, y, z, button = 'left') => {
  const p = await page.evaluate(([a, b, c]) => demo.screenOf(a, b, c), [x, y, z]);
  await page.mouse.move(p.x, p.y);
  await page.evaluate(() => demo.frames(2));
  await page.mouse.click(p.x, p.y, { button });
  await page.evaluate(() => demo.frames(2));
};
const block = (x, y, z) => page.evaluate(([a, b, c]) => demo.world.sim.getBlock(a, b, c), [x, y, z]);

await page.goto(url + '?auto=0&quality=high', { waitUntil: 'load' });
await page.waitForFunction(() => 'demo' in window);
await shot('01-start');

// The four camera turns, with the E key.
for (let turn = 1; turn <= 3; turn++) {
  await page.keyboard.press('e');
  await page.waitForTimeout(600);
  await shot(`02-turn-${turn}`);
}
await page.keyboard.press('e');
await page.waitForTimeout(600);
await shot('02-turn-0');

// The three zoom steps, with the wheel.
await page.mouse.move(720, 450);
await page.mouse.wheel(0, 120);
await page.waitForTimeout(900);
await shot('03-zoom-far');
await page.mouse.wheel(0, -120);
await page.waitForTimeout(400);
await page.mouse.wheel(0, -120);
await page.waitForTimeout(900);
await shot('03-zoom-near');
await page.mouse.wheel(0, 120);
await page.waitForTimeout(900);

// Inside the house: the roof is cut away. A click lands on the floor under the hidden roof.
await page.evaluate(() => demo.goto('house'));
await page.waitForTimeout(1200);
await shot('04-house-inside');
const floorBefore = await block(-8, 20, -11);
await page.keyboard.press('6');
await click(-7.5, 20, -10.5, 'right');
const floorAfter = await block(-8, 20, -11);
await shot('04-house-inside-placed', `floor cell ${floorBefore} -> ${floorAfter}`);
await page.keyboard.press('q');
await page.waitForTimeout(600);
await shot('04-house-inside-turned');
await page.keyboard.press('e');
await page.waitForTimeout(600);

// The cave: everything above the hero's layer is cut in a circle.
await page.evaluate(() => demo.goto('cave'));
await page.waitForTimeout(1200);
await shot('05-cave');
await page.evaluate(() => demo.goto('caveMouth'));
await page.waitForTimeout(1200);
await shot('05-cave-mouth');

// Night, with the lamp by the door lit.
await page.evaluate(() => { demo.setTime(0); return demo.goto('spawn'); });
await page.waitForTimeout(1200);
await shot('06-night-lamp');
await page.evaluate(() => demo.goto('house'));
await page.waitForTimeout(1200);
await shot('06-night-house-inside');
await page.evaluate(() => { demo.setTime(0.5); return demo.goto('spawn'); });
await page.waitForTimeout(1200);

// Break and place with the mouse: two holes in the ground, a pillar of stone brick with a lamp on top.
// Then a window of the house.
const edits = { before: [await block(-9, 19, -6), await block(-10, 19, -6), await block(-8, 21, -8), await block(-9, 20, -4)] };
await click(-8.5, 20, -5.5, 'left');
await click(-9.5, 20, -5.5, 'left');
await click(-7.5, 21.5, -7, 'left');
await page.keyboard.press('5');
await click(-8.5, 20, -3.5, 'right');
await click(-8.5, 21, -3.5, 'right');
await page.keyboard.press('9');
await click(-8.5, 22, -3.5, 'right');
edits.after = [await block(-9, 19, -6), await block(-10, 19, -6), await block(-8, 21, -8), await block(-9, 20, -4), await block(-9, 21, -4), await block(-9, 22, -4)];
await shot('07-after-edits', `blocks ${JSON.stringify(edits)}`);
await page.evaluate(() => demo.setTime(0.02));
await shot('07-after-edits-night');
await page.evaluate(() => demo.setTime(0.5));

// Wet ground, and a save that loads back.
await page.evaluate(() => demo.setWet(1));
await shot('08-wet');
await page.evaluate(() => demo.setWet(0));
const saved = await page.evaluate(() => { const s = demo.saveGame(); demo.world.load({ version: 1, seed: 77, edits: [] }); return s.world.edits.reduce((n, e) => n + e[2].length / 2, 0); });
await page.evaluate(() => demo.settle());
const lost = await block(-9, 22, -4);
await page.evaluate(() => { demo.loadGame(); return demo.settle(); });
const back = await block(-9, 22, -4);
rows.push({ view: 'save and load', note: `${saved} changed blocks saved; lamp cell after new land ${lost}, after load ${back}` });
await shot('09-after-load');

await browser.close();
console.table(rows);
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

// Takes the map demo's screenshots and runs its two page checks: touch controls at least 44 pixels
// across, and HUD text at 4.5 to 1 against its panel.
//   bun tools/demo.mjs build map && bun tools/serve.mjs dist/demos/map 5316
//   bun tools/map-shots.mjs [http://127.0.0.1:5316/]
// Pictures go to .artifacts/map/. Exits 1 on a console error or a failed check.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const base = process.argv[2] ?? 'http://127.0.0.1:5316/';
const out = resolve(import.meta.dirname, '../.artifacts/map');
mkdirSync(out, { recursive: true });
const file = (name) => resolve(out, name);

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const failures = [];

async function open(options, query = '') {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // aa=0 keeps the software renderer quick. The demo is paused so every picture is of an exact frame.
  await page.goto(`${base}?fresh=1&aa=0&paused=1${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.demo, null, { timeout: 30000 });
  await page.evaluate(() => demo.step(3));
  return page;
}
const step = (page, frames = 1, dt = 1 / 60) => page.evaluate(([n, t]) => demo.step(n, t), [frames, dt]);
const shot = async (page, name) => { await page.screenshot({ path: file(name) }); console.log('shot', name); };

/** Every piece of text in a panel, with its contrast against the nearest solid background behind it. */
const contrastOf = (page, root) => page.evaluate((selector) => {
  // A computed color is 'rgb(r g b / a)' with 0 to 255, or 'color(srgb r g b / a)' with 0 to 1 when it came from color-mix.
  const parse = (css) => { const m = css.match(/-?[\d.]+(e-?\d+)?/g).map(Number); const k = css.startsWith('color(') ? 255 : 1; return { r: m[0] * k, g: m[1] * k, b: m[2] * k, a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rows = [];
  for (const el of document.querySelectorAll(`${selector}, ${selector} *`)) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!text || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    const style = getComputedStyle(el);
    let behind = null;
    for (let up = el; up && !behind; up = up.parentElement) {
      const bg = parse(getComputedStyle(up).backgroundColor);
      if (bg.a > 0.98) behind = bg;
    }
    if (!behind) { rows.push({ text, ratio: 0, note: 'no solid background behind it' }); continue; }
    const a = lum(parse(style.color)), b = lum(behind);
    rows.push({ text: text.slice(0, 40), ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100, px: Math.round(parseFloat(style.fontSize) * 10) / 10 });
  }
  return rows;
}, root);

function checkContrast(rows, where) {
  const worst = rows.reduce((w, r) => (r.ratio < w.ratio ? r : w), { ratio: 99 });
  const small = rows.reduce((w, r) => (r.px < w.px ? r : w), { px: 99 });
  console.log(`contrast ${where}: ${rows.length} pieces of text, lowest ${worst.ratio} ("${worst.text}"), smallest text ${small.px}px ("${small.text}")`);
  for (const r of rows) if (r.ratio < 4.5) failures.push(`contrast ${where}: "${r.text}" is ${r.ratio}${r.note ? ` (${r.note})` : ''}`);
}

/** No two touch controls or HUD panels may overlap. */
async function checkOverlaps(page, where) {
  const overlaps = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.gb-touch-stick, .gb-touch-button, .gb-hud-slots, .gb-hud-log li, .gb-hud-vitals, .gb-hud-right > *')]
      .filter((el) => el.getClientRects().length)
      .map((el) => ({ name: el.getAttribute('aria-label') ?? el.className, b: el.getBoundingClientRect() }));
    const hits = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b, b = boxes[j].b;
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits.push(`${boxes[i].name} / ${boxes[j].name}`);
    }
    return hits;
  });
  console.log(`overlapping controls at ${where}:`, overlaps.length ? overlaps.join('; ') : 'none');
  for (const o of overlaps) failures.push(`at ${where} these overlap: ${o}`);
}

// ---- A laptop: 1440 by 900 ----
{
  const page = await open({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.evaluate(() => { demo.hud.message('found the village waystone.', { from: 'Ana' }); demo.step(2); });
  await shot(page, 'hud-1440x900.png');
  checkContrast(await contrastOf(page, '.gb-hud'), 'HUD at 1440x900');

  // The HUD's size setting, at its smallest and largest.
  for (const scale of [0.8, 1.4]) {
    await page.evaluate((s) => { demo.hud.setScale(s); demo.step(2); }, scale);
    await shot(page, `hud-size-${scale}.png`);
    checkContrast(await contrastOf(page, '.gb-hud'), `HUD at size ${scale}`);
  }
  await page.evaluate(() => { demo.hud.setScale(1); demo.step(2); });

  // The minimap after each of four quarter turns of the camera, by the page's own button.
  const minimap = page.locator('.gb-minimap');
  const turns = [];
  for (let turn = 0; turn <= 4; turn++) {
    if (turn > 0) {
      await page.click('#turn');
      await step(page, 30);
    }
    const yaw = await page.evaluate(() => demo.map.yaw);
    console.log(`turn ${turn}: camera yaw ${(yaw * 180 / Math.PI).toFixed(1)} degrees`);
    turns.push(await minimap.screenshot());
    if (turn > 0) await shot(page, `turn-${turn}.png`);
  }
  // One strip: the start and the four turns side by side.
  const meta = await sharp(turns[0]).metadata();
  await sharp({ create: { width: meta.width * 5 + 40, height: meta.height + 16, channels: 4, background: '#10141a' } })
    .composite(turns.map((input, i) => ({ input, left: 8 + i * (meta.width + 6), top: 8 })))
    .png().toFile(file('minimap-turns.png'));
  console.log('shot minimap-turns.png (start, then turns 1 to 4)');

  // The beam in view, then the edge arrow for a waypoint out of view.
  await page.evaluate(() => {
    const near = demo.map.rules.marks.addWaypoint(demo.player.x - 7.5, demo.player.z - 9.5, { icon: 'star', color: 'flame' });
    demo.map.rules.marks.setActive(near.id);
    demo.step(4);
  });
  await shot(page, 'beam.png');
  await page.evaluate(() => {
    const far = demo.map.rules.marks.addWaypoint(demo.places.mill.x, demo.places.mill.z, { icon: 'leaf', color: 'bloom' });
    demo.map.rules.marks.setActive(far.id);
    demo.step(4);
  });
  await shot(page, 'edge-arrow.png');
  console.log('beacon:', await page.evaluate(() => ({ off: document.querySelector('.gb-beacon').classList.contains('is-off'), text: document.querySelector('.gb-beacon-chip').textContent, where: document.querySelector('.gb-beacon').style.transform })));

  // Walk a loop so there is land on the full map, then open it with the M key.
  await page.evaluate(() => {
    const p = demo.places;
    for (const [x, z] of [[p.mill.x, p.mill.z + 8], [300, 226], [256, 300], [200, 262], [256, 210], [p.spawn.x, p.spawn.z]]) { demo.teleport(x, z); demo.step(2); }
  });
  await page.keyboard.press('KeyM');
  await step(page, 40);
  // The third waypoint is dropped by a real click on the map, and set up in the picker.
  const view = await page.locator('.gb-map-view canvas').boundingBox();
  await page.mouse.click(view.x + view.width * 0.3, view.y + view.height * 0.66);
  await step(page, 2);
  await page.click('.gb-map-picker [data-icon="home"]');
  await page.click('.gb-map-picker [data-color="tide"]');
  await page.click('.gb-pick-share input');
  await step(page, 2);
  await shot(page, 'fullmap-picker.png');
  await page.click('.gb-map-picker [data-do="done"]');
  await step(page, 2);
  await shot(page, 'fullmap-3-waypoints.png');
  const waypoints = await page.evaluate(() => demo.map.rules.marks.waypoints.map((w) => `${w.icon}/${w.color}${w.shared ? '/shared' : ''}`));
  console.log('waypoints:', waypoints.join(', '), '· count text:', await page.textContent('.gb-map-count'));
  if (waypoints.length !== 3) failures.push(`expected 3 waypoints on the map, found ${waypoints.length}`);
  checkContrast(await contrastOf(page, '.gb-map'), 'full map');
  // Zoomed out to the whole world: unseen land stays blank parchment.
  await page.evaluate(() => { for (let i = 0; i < 6; i++) document.querySelector('.gb-map [data-do="out"]').click(); demo.step(30); });
  await shot(page, 'fullmap-whole-world.png');
  await page.keyboard.press('Escape');
  await step(page, 2);
  if (await page.evaluate(() => demo.map.isOpen)) failures.push('Esc did not close the full map');

  // The dialogue box: in the middle of a line, then at a choice. The talk starts with the real F key.
  await page.evaluate(() => { demo.teleport(demo.places.odo.x - 1.5, demo.places.odo.z + 1.5); demo.step(2); });
  await page.keyboard.press('KeyF');
  await step(page, 1);
  await step(page, 36);
  console.log('dialogue mid-line:', await page.evaluate(() => ({ typing: demo.dialogue.typing, shown: document.querySelector('.gb-dialogue-typed').textContent })));
  if (!(await page.evaluate(() => demo.dialogue.typing))) failures.push('the dialogue was not in the middle of a line');
  await shot(page, 'dialogue-mid-line.png');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await step(page, 400);
  console.log('dialogue choices:', await page.evaluate(() => [...document.querySelectorAll('.gb-dialogue-choices button')].map((b) => b.textContent)));
  if ((await page.locator('.gb-dialogue-choices button').count()) < 2) failures.push('the dialogue showed no choices');
  await shot(page, 'dialogue-choice.png');
  checkContrast(await contrastOf(page, '.gb-dialogue'), 'dialogue');
  // Pick the wood, finish the talk, and see the flag change reach the HUD.
  await page.keyboard.press('Digit1');
  await step(page, 400);
  await page.keyboard.press('Enter');
  await step(page, 3);
  console.log('after the talk:', await page.evaluate(() => ({ open: demo.dialogue.isOpen, flags: demo.flags, mode: demo.input.mode })));
  await shot(page, 'after-talk.png');
  await page.context().close();
}

// ---- Things that have no picture: saving, rebinding, redrawing a patch, the wheel, a pinch, the limit ----
{
  const page = await open({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const expect = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };

  // A key is rebound through the demo's panel with real clicks and a real key press.
  await page.click('#rebind');
  await page.click('#keys [data-action="jump"][data-slot="0"]');
  await page.keyboard.press('KeyJ');
  await page.click('#keys [data-do="close"]');
  await step(page, 1);
  expect(await page.evaluate(() => demo.input.bindings.jump[0]) === 'KeyJ', 'the keys panel rebinds jump to J');
  await page.keyboard.down('KeyJ');
  await step(page, 1);
  expect(await page.evaluate(() => demo.input.intents.jump && demo.input.intents.jumpPressed), 'J now jumps');
  await page.keyboard.up('KeyJ');
  await page.keyboard.down('Space');
  await step(page, 1);
  expect(await page.evaluate(() => !demo.input.intents.jump), 'Space no longer jumps');
  await page.keyboard.up('Space');

  // Keys walk the player, relative to the camera.
  const from = await page.evaluate(() => ({ x: demo.player.x, z: demo.player.z }));
  await page.keyboard.down('KeyW');
  await step(page, 30);
  await page.keyboard.up('KeyW');
  await step(page, 1);
  const to = await page.evaluate(() => ({ x: demo.player.x, z: demo.player.z }));
  // The camera starts at yaw 45 degrees, looking north-west: forward is -x and -z in equal parts.
  expect(Math.abs((to.x - from.x) - (to.z - from.z)) < 0.01 && to.x - from.x < -1.5, `W walks away from the camera (moved ${(to.x - from.x).toFixed(2)}, ${(to.z - from.z).toFixed(2)})`);

  // The wheel zooms the camera one step, and a pinch on the canvas zooms it back.
  const zoom0 = await page.evaluate(() => demo.camera.zoom);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 240);
  await step(page, 1);
  const zoom1 = await page.evaluate(() => demo.camera.zoom);
  expect(zoom1 === zoom0 + 1, `the wheel zooms out one step (${zoom0} to ${zoom1})`);
  await page.evaluate(() => {
    const el = document.querySelector('#view');
    const fire = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    fire('pointerdown', 21, 600, 400); fire('pointerdown', 22, 700, 400);
    fire('pointermove', 21, 570, 400); fire('pointermove', 22, 740, 400);
    fire('pointerup', 21, 570, 400); fire('pointerup', 22, 740, 400);
    demo.step(1);
  });
  const zoom2 = await page.evaluate(() => demo.camera.zoom);
  expect(zoom2 === zoom1 - 1, `spreading two fingers zooms in one step (${zoom1} to ${zoom2})`);
  expect(await page.evaluate(() => demo.input.touch), 'the first touch brings up the touch controls');
  await page.evaluate(() => { demo.input.setTouch(false); demo.step(1); });

  // A click on the game pings, and a right click drops a waypoint where the player stands.
  await page.mouse.click(640, 400);
  await step(page, 1);
  expect(await page.evaluate(() => demo.map.rules.marks.pings.length) === 1, 'a click pings');
  await page.mouse.click(640, 400, { button: 'right' });
  await step(page, 1);
  expect(await page.evaluate(() => demo.map.rules.marks.waypoints.length === 1 && demo.map.rules.marks.active !== null), 'a right click drops a waypoint and follows it');
  await step(page, 660);
  expect(await page.evaluate(() => demo.map.rules.marks.pings.length) === 0, 'the ping is gone after 10 seconds');

  // The world changes: only that patch of the minimap is redrawn.
  const grab = () => page.evaluate(() => { const c = document.querySelector('.gb-minimap canvas'); return [...c.getContext('2d').getImageData(0, 0, c.width, c.height).data]; });
  await step(page, 3);
  const beforeDig = await grab();
  await page.click('#dig');
  await step(page, 4);
  const afterDig = await grab();
  let changed = 0;
  for (let i = 0; i < beforeDig.length; i += 4) if (beforeDig[i] !== afterDig[i] || beforeDig[i + 1] !== afterDig[i + 1] || beforeDig[i + 2] !== afterDig[i + 2]) changed++;
  const share = changed / (beforeDig.length / 4);
  expect(share > 0.002 && share < 0.05, `invalidate redraws a patch of the minimap (${(share * 100).toFixed(2)}% of its pixels changed)`);

  // Land that has not loaded yet: the minimap leaves it blank, and fills it in by itself when it arrives.
  await page.evaluate(() => { demo.map.setMarkers([]); demo.step(30); });
  const whole = await grab();
  await page.evaluate(() => {
    const { x, z } = demo.player;
    demo.hideLand({ x: x + 20, z: z - 20, size: 24 });
    demo.teleport(x + 400, z); demo.step(2);
    demo.teleport(x, z); demo.step(2);
  });
  const blank = await grab();
  await page.evaluate(() => { demo.hideLand(null); demo.step(90); });
  const filled = await grab();
  const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n / (a.length / 4); };
  expect(differ(whole, blank) > 0.02, `land with no color yet is left blank on the minimap (${(differ(whole, blank) * 100).toFixed(1)}% of it)`);
  expect(differ(whole, filled) === 0, `and it fills in by itself once the land has a color (${(differ(whole, filled) * 100).toFixed(2)}% still different)`);

  // The 20 waypoint limit, through the full map.
  await page.evaluate(() => { for (let i = 0; i < 25; i++) demo.map.rules.marks.addWaypoint(200 + i * 4, 300); });
  expect(await page.evaluate(() => demo.map.rules.marks.waypoints.length) === 20, 'no more than 20 waypoints');
  await page.keyboard.press('KeyM');
  await step(page, 3);
  const box = await page.locator('.gb-map-view canvas').boundingBox();
  await page.mouse.click(box.x + 60, box.y + box.height - 60);
  await step(page, 2);
  expect((await page.textContent('.gb-map-note')).includes('20 waypoints') && await page.evaluate(() => demo.map.rules.marks.waypoints.length) === 20, 'the full map refuses a 21st and says why');
  await shot(page, 'fullmap-limit.png');
  await page.keyboard.press('KeyM');
  await step(page, 2);
  expect(!(await page.evaluate(() => demo.map.isOpen)), 'M closes the map it opened');

  // Everything is saved: after a reload the keys, the HUD size, the waypoints and the seen land are back.
  await page.evaluate(() => { demo.hud.setScale(1.2); demo.step(40); });
  const kept = await page.evaluate(() => ({ seen: demo.map.rules.seen.count, waypoints: demo.map.rules.marks.waypoints.length, active: demo.map.rules.marks.active?.id }));
  await page.goto(`${base}?aa=0&paused=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.demo, null, { timeout: 30000 });
  await page.evaluate(() => demo.step(1));
  const back = await page.evaluate(() => ({ jump: demo.input.bindings.jump[0], scale: demo.hud.scale, seen: demo.map.rules.seen.count, waypoints: demo.map.rules.marks.waypoints.length, active: demo.map.rules.marks.active?.id }));
  expect(back.jump === 'KeyJ', 'the rebound key is still there after a reload');
  expect(back.scale === 1.2, 'the HUD size is still there after a reload');
  expect(back.waypoints === kept.waypoints && back.active === kept.active, `the waypoints are still there after a reload (${back.waypoints}, following ${back.active})`);
  expect(back.seen >= kept.seen && kept.seen > 100, `the seen land is still there after a reload (${back.seen} cells)`);
  await page.context().close();
}

// ---- A phone held upright: 390 by 844, touch ----
{
  const page = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await page.evaluate(() => { demo.hud.message('found the village waystone.', { from: 'Ana' }); demo.step(3); });
  await shot(page, 'phone-390x844.png');
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.gb-touch-stick, .gb-touch-button, .gb-slot, .gb-minimap')].map((el) => {
    const b = el.getBoundingClientRect();
    return { name: el.getAttribute('aria-label') ?? el.className, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10, shown: b.width > 0 && getComputedStyle(el).visibility !== 'hidden' };
  }));
  for (const s of sizes) {
    console.log(`touch target: ${s.name} ${s.w} x ${s.h}`);
    if (!s.shown) failures.push(`touch target "${s.name}" is not showing`);
    else if (s.w < 44 || s.h < 44) failures.push(`touch target "${s.name}" is ${s.w} x ${s.h}, under 44`);
  }
  if (!sizes.some((s) => s.name === 'Move stick')) failures.push('the touch stick is missing');
  await checkOverlaps(page, '390x844');
  checkContrast(await contrastOf(page, '.gb-hud'), 'HUD at 390x844');

  // The stick moves the player: hold it up and to the right for half a second of frames.
  const stick = await page.locator('.gb-touch-stick').boundingBox();
  const before = await page.evaluate(() => ({ x: demo.player.x, z: demo.player.z }));
  await page.evaluate(([x, y]) => {
    const el = document.querySelector('.gb-touch-stick');
    const fire = (type, dx, dy) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x + dx, clientY: y + dy, bubbles: true, isPrimary: true }));
    fire('pointerdown', 0, 0);
    fire('pointermove', 30, -30);
    demo.step(30);
  }, [stick.x + stick.width / 2, stick.y + stick.height / 2]);
  const after = await page.evaluate(() => ({ x: demo.player.x, z: demo.player.z, right: demo.input.intents.right, forward: demo.input.intents.forward }));
  console.log(`touch stick: the player moved ${Math.hypot(after.x - before.x, after.z - before.z).toFixed(2)} blocks, intents right ${after.right.toFixed(2)} forward ${after.forward.toFixed(2)}`);
  if (Math.hypot(after.x - before.x, after.z - before.z) < 1) failures.push('the touch stick did not move the player');
  await shot(page, 'phone-stick-held.png');
  await page.evaluate(() => {
    document.querySelector('.gb-touch-stick').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true }));
    demo.teleport(demo.places.odo.x - 1.5, demo.places.odo.z + 1.5);
    demo.step(2);
  });

  // The Talk button starts the conversation, and a tap on the box moves it on.
  await page.tap('.gb-touch-interact');
  await step(page, 400);
  await page.waitForTimeout(260);
  await page.tap('.gb-dialogue-box');
  await step(page, 400);
  await shot(page, 'phone-dialogue.png');
  if ((await page.locator('.gb-dialogue-choices button').count()) < 2) failures.push('on the phone the dialogue showed no choices');
  await page.tap('.gb-dialogue-choices button >> nth=1');
  await step(page, 400);
  await page.tap('.gb-dialogue-box');
  await step(page, 3);
  // A tap on the minimap opens the full map.
  await page.tap('.gb-minimap');
  await step(page, 40);
  await shot(page, 'phone-map.png');
  if (!(await page.evaluate(() => demo.map.isOpen))) failures.push('a tap on the minimap did not open the full map');
  await page.context().close();
}

// ---- A phone on its side: 844 by 390 ----
{
  const page = await open({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await page.evaluate(() => { demo.hud.message('found the village waystone.', { from: 'Ana' }); demo.step(3); });
  await shot(page, 'phone-844x390.png');
  await checkOverlaps(page, '844x390');
  checkContrast(await contrastOf(page, '.gb-hud'), 'HUD at 844x390');
  const small = await page.evaluate(() => [...document.querySelectorAll('.gb-touch-stick, .gb-touch-button, .gb-slot')].map((el) => el.getBoundingClientRect()).filter((b) => b.width < 44 || b.height < 44).length);
  if (small) failures.push(`${small} touch targets are under 44 pixels at 844x390`);
  await page.context().close();
}

await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
console.log(failures.length ? 'FAILED:\n' + failures.join('\n') : 'all page checks pass');
process.exit(errors.length || failures.length ? 1 : 0);

// Presentation fixtures are imported byte-for-byte. This does not earn progression.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { createKeyboardSteering } from './lib/keyboard-steering.mjs';
const url = process.env.PRESENTATION_URL || 'http://127.0.0.1:5567';
const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
const input = resolve('.artifacts/echo-input/nov15-complete-route');
let activePage;
const browser = await launchChrome();
const results = [];
const errors = [];
async function labels(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.hp-tag,.fm-tag')].filter(
      (e) => e.getBoundingClientRect().width && getComputedStyle(e).display !== 'none',
    );
    const rect = (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, text: e.textContent };
    };
    const boxes = nodes.map(rect);
    const failures = [];
    const overlap = (a, b) =>
      a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
    const hud = [
      ...document.querySelectorAll(
        '.gu-note,.gu-hint,.ui-bookbtn,.gb-hud-quest,.ui-day,.ui-pips,.ui-heart,.gb-minimap,.gb-hud-slots,.gu-prompt,.gb-beacon-chip,.gb-beacon-arrow,.gu-toasts',
      ),
    ]
      .filter((e) => e.getBoundingClientRect().width)
      .map(rect);
    boxes.forEach((a, i) => {
      if (a.x < 7 || a.y < 7 || a.x + a.w > innerWidth - 7 || a.y + a.h > innerHeight - 7)
        failures.push('clipped ' + a.text);
      for (const b of boxes.slice(i + 1))
        if (overlap(a, b)) failures.push('labels overlap ' + a.text + ' / ' + b.text);
      for (const b of hud) if (overlap(a, b)) failures.push('HUD overlap ' + a.text);
    });
    return { boxes, hud, failures };
  });
}
async function capture(page, name) {
  const check = await labels(page);
  results.push({ name, ...check, state: await page.evaluate(() => window.__game.state()) });
  await page.screenshot({ path: resolve(out, name + '.png') });
  console.log(name, check.failures);
}
async function walk(page, to = { x: 17.5, y: 22, z: -230.5 }) {
  const route = await page.evaluate((to) => {
    const g = window.__game.view.game;
    return g.systems.nav.path(g.player.pos, to, 20000);
  }, to);
  if (!route?.length) throw Error('No home to bees route');
  const steer = createKeyboardSteering();
  let leg = 0;
  for (const goal of route) {
    if (++leg % 12 === 0) {
      const check = await labels(page);
      if (check.failures.length) errors.push(...check.failures.map((f) => 'walking: ' + f));
    }
    let arrived = false;
    for (let i = 0; i < 80; i++) {
      const { p, yaw } = await page.evaluate(() => ({
        p: window.__game.state().player,
        yaw: window.__game.view.camera.yaw,
      }));
      const dx = goal.x - p.x,
        dz = goal.z - p.z;
      if (Math.hypot(dx, dz) < 0.22) {
        arrived = true;
        break;
      }
      const d = steer(dx, dz, yaw);
      const keys = [
        ...(d.forward > 0 ? ['KeyW'] : d.forward < 0 ? ['KeyS'] : []),
        ...(d.right > 0 ? ['KeyD'] : d.right < 0 ? ['KeyA'] : []),
      ];
      try {
        for (const k of keys) await page.keyboard.down(k);
        await page.waitForTimeout(50);
      } finally {
        for (const k of keys) await page.keyboard.up(k);
      }
    }
    if (!arrived) throw Error('Walk stalled');
  }
}
try {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ])
    for (const quality of ['high', 'low']) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      activePage = page;
      await page.addInitScript(() => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        window.__vaultLabels = {};
        CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
          if (['The Seed Vault', 'The Lamp Gallery', 'The Pump House'].includes(text)) {
            const r = this.canvas.getBoundingClientRect();
            const w = this.measureText(text).width;
            window.__vaultLabels[text] = {
              x: r.x + x - w / 2,
              y: r.y + y,
              w,
              h: 18,
              canvas: { x: r.x, y: r.y, w: r.width, h: r.height },
            };
          }
          return original.call(this, text, x, y, ...rest);
        };
      });
      page.on('pageerror', (e) => errors.push(String(e)));
      for (const name of (process.env.PRESENTATION_MAP_ONLY ? ['middle-memory'] : ['earned-echo', 'middle-memory'])) {
        await page.goto(url + '/?quality=' + quality);
        await page.evaluate(
          (raw) => localStorage.setItem('greenhollow.save', raw),
          readFileSync(resolve(input, name + '.save.json'), 'utf8'),
        );
        await page.reload();
        await page.waitForFunction(() => !!window.__game);
        await page.getByRole('button', { name: 'Begin', exact: true }).click();
        await page.waitForFunction(
          () => window.__game.state().started && !window.__game.state().player.busy,
        );
        await page.waitForTimeout(1200);
        const prefix = viewport.width + '-' + quality;
        if (name === 'earned-echo') {
          await capture(page, prefix + '-home');
          if (!(await page.locator('.hp-tag').innerText()).includes('Hobb'))
            throw Error('Home needs missing');
          if (!process.env.PRESENTATION_BASELINE) {
            const door = await page.evaluate(
              () => window.__game.view.game.systems.settlement.homes()[0].door,
            );
            await walk(page, { x: door.x, y: door.y, z: door.z + 1 });
            await page.waitForFunction(
              () =>
                window.__game.state().prompt?.includes('home') ||
                window.__game.state().prompt === 'Talk to Gus',
            );
            await page.keyboard.press('KeyE', { delay: 100 });
            await page.locator('.hp-layer:not([hidden])').waitFor();
            const needs = await page.locator('.hp-rows').innerText();
            if (!['Bed', 'Meal', 'Lamp'].every((name) => needs.includes(name)))
              throw Error('Resident needs missing');
            await page.locator('.hp-jobs').waitFor();
            await page.screenshot({ path: resolve(out, prefix + '-resident-panel.png') });
            await page
              .locator('.hp-layer:not([hidden])')
              .getByRole('button', { name: 'Close', exact: true })
              .click();
            await walk(page);
            await page.waitForFunction(
              () => window.__game.state().prompt === 'Look at the bee boxes',
            );
            await capture(page, prefix + '-bees');
            for (const name of ['Bee boxes', 'Fox hedge', 'Bait field'])
              await page.locator('.fm-tag').filter({ hasText: name }).waitFor();
            await page.keyboard.press('KeyE', { delay: 100 });
            await page.locator('[data-panel="farm"]').waitFor({ timeout: 3000 });
            await page.getByRole('button', { name: 'Why?', exact: true }).click();
            await page.getByRole('button', { name: 'Hide the fix', exact: true }).waitFor();
            await page.getByRole('button', { name: 'Give', exact: true }).waitFor();
            await page.getByRole('button', { name: 'Take', exact: true }).waitFor();
            for (const name of ['Give', 'Take', 'Hide the fix']) {
              const b = await page.getByRole('button', { name, exact: true }).boundingBox();
              if (!b || b.width < 44 || b.height < 44 || b.x < 0 || b.x + b.width > viewport.width)
                errors.push('inaccessible farm target ' + name);
            }
            await page.screenshot({ path: resolve(out, prefix + '-farm-panel.png') });
            await page.keyboard.press('Escape');
            await capture(page, prefix + '-closed');
          }
        } else {
          await page.keyboard.press('KeyM');
          for (let i = 0; i < 3; i++)
            await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
          if (!process.env.PRESENTATION_BASELINE) {
            await page.getByRole('button', { name: 'Show marked places', exact: true }).click();
            await page.waitForFunction(() => Object.keys(window.__vaultLabels).length === 3);
            await page.waitForTimeout(100);
            const pins = await page.evaluate(() => window.__vaultLabels);
            for (const [name, p] of Object.entries(pins)) {
              if (
                p.x < p.canvas.x ||
                p.y < p.canvas.y ||
                p.x + p.w > p.canvas.x + p.canvas.w ||
                p.y + p.h > p.canvas.y + p.canvas.h
              )
                errors.push('clipped map label ' + name);
            }
            results.push({ name: prefix + '-map', pins, failures: [] });
          }
          await page.screenshot({ path: resolve(out, prefix + '-map.png') });
          await page.locator('.gb-map-chart canvas').focus();
          const beforePan = await page.evaluate(() => window.__vaultLabels['The Lamp Gallery'].x);
          await page.keyboard.press('ArrowLeft');
          await page.waitForFunction(x => Math.abs(window.__vaultLabels['The Lamp Gallery'].x - x) > 1, beforePan);
          await page.keyboard.press('ArrowRight');
          await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
          await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
          await page.getByRole('button', { name: 'Close the map', exact: true }).click();
        }
      }
      await context.close();
    }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: resolve(out, 'failure.png') });
    writeFileSync(
      resolve(out, 'failure-state.json'),
      JSON.stringify(await activePage.evaluate(() => window.__game.state()), null, 2),
    );
  }
  throw error;
} finally {
  await browser.close();
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ results, errors }, null, 2));
}
if (errors.length || results.some((r) => r.failures.length))
  throw Error('Presentation layout failed; see report.json');

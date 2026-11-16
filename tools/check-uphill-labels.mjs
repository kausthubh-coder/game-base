// Exact earned bytes through Continue; measurements never change game state.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { launchChrome } from './lib/chrome.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
const out = resolve(process.argv[2]);
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'tested-runner.mjs'), readFileSync(import.meta.filename));
const baseline = process.argv.includes('--baseline');
const home = process.argv.includes('--home');
const opt = (n,d) => { const i=process.argv.indexOf('--'+n); return i<0?d:process.argv[i+1]; };
const dist = opt('dist', baseline ? 'dist-uphill-input' : 'dist-uphill-labels');
const port = opt('port','5577');
const hashes = {};
function visit(dir, rel = '') {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) visit(resolve(dir, e.name), r);
    else
      hashes[r] = createHash('sha256')
        .update(readFileSync(resolve(dir, e.name)))
        .digest('hex');
  }
}
visit(resolve(dist));
if (baseline) {
  const expected = JSON.parse(readFileSync('.artifacts/uphill-input/build-provenance.json'));
  if (
    JSON.stringify(Object.entries(hashes).sort()) !==
    JSON.stringify(Object.entries(expected.build).sort())
  )
    throw Error('baseline hash mismatch');
}
writeFileSync(resolve(out, 'build-hashes.json'), JSON.stringify(hashes, null, 2));
writeFileSync(
  resolve(out, 'tested-head.txt'),
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout,
);
writeFileSync(
  resolve(out, 'tested-working.patch'),
  spawnSync('git', ['diff', 'HEAD'], { encoding: 'utf8' }).stdout,
);
const input = home
  ? '.artifacts/echo-input/nov15-complete-route/earned-echo.save.json'
  : '.artifacts/uphill-input/attempt-14/middle-pit.save.json';
const raw = readFileSync(input, 'utf8');
writeFileSync(
  resolve(out, 'input.json'),
  JSON.stringify({ input, sha256: createHash('sha256').update(raw).digest('hex') }, null, 2),
);
const resources = [];
async function probe(gate = false) {
  const s = await sample();
  resources.push(s);
  writeFileSync(resolve(out, 'resources.json'), JSON.stringify(resources, null, 2));
  if (gate && !canStartHeavy(s, 0)) throw Error('resource admission held');
}
let browser, server;
const errors = [],
  results = [];
let failure;
const monitor = setInterval(() => probe().catch((e) => errors.push(String(e))), 30000);
async function capture(page, name) {
  const result = await page.evaluate(() => {
    const rect = (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, text: e.textContent };
    };
    const visible = (e) => {
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.visibility !== 'hidden' && !!e.getBoundingClientRect().width;
    };
    const boxes = [...document.querySelectorAll('.fm-tag,.hp-tag')].filter(visible).map(rect);
    const hud = [
      ...document.querySelectorAll(
        '.gu-note,.gu-hint,.ui-bookbtn,.gb-hud-quest,.ui-day,.ui-pips,.ui-heart,.gb-minimap,.gb-hud-slots,.gu-prompt,.gb-beacon-chip,.gb-beacon-arrow,.gu-toasts',
      ),
    ]
      .filter(visible)
      .map(rect);
    const v = window.__game.view,
      p = v.playerPosition,
      feet = v.project(p.x, p.y, p.z),
      head = v.project(p.x, p.y + 2, p.z);
    const hero =
      feet && head
        ? {
            x: Math.min(feet.x, head.x) - 28,
            y: Math.min(feet.y, head.y) - 10,
            w: Math.abs(head.x - feet.x) + 56,
            h: Math.abs(feet.y - head.y) + 20,
          }
        : null;
    const overlaps = (a, b) =>
      a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
    const failures = [];
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      if (a.x < 7 || a.y < 7 || a.x + a.w > innerWidth - 7 || a.y + a.h > innerHeight - 7)
        failures.push('clipped ' + a.text);
      for (const b of [...boxes.slice(i + 1), ...hud, ...(hero ? [hero] : [])])
        if (overlaps(a, b)) failures.push('overlap ' + a.text + ' / ' + (b.text ?? 'hero'));
    }
    const active = window.__game.view.game.systems.interact.nearest()?.id;
    if (
      active?.startsWith('farm:') &&
      !boxes.some((b) =>
        b.text.includes(
          document.querySelector('[data-farm="' + active.slice(5) + '"] b')?.textContent ??
            'MISSING',
        ),
      )
    )
      failures.push('active farm tag missing ' + active);
    return {
      quality: v.ctx.quality,
      boxes,
      hud,
      hero,
      failures,
      prompt: window.__game.state().prompt,
      player: window.__game.state().player,
    };
  });
  results.push({ name, ...result });
  await page.screenshot({ path: resolve(out, name + '.png') });
  console.log(name, JSON.stringify(result.failures));
}
try {
  await probe(true);
  server = spawn('bun', ['tools/serve.mjs', dist, port], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok, no) => {
    server.stdout.on('data', (b) => {
      console.log(String(b).trim());
      if (/pid \d+/.test(String(b))) ok();
    });
    server.on('exit', (c) => no(Error('server ' + c)));
  });
  await probe(true);
  browser = await launchChrome();
  for (const width of [1366, 390])
    for (const quality of ['high', 'low']) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 768 },
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (['warning', 'error'].includes(m.type())) errors.push(m.text());
      });
      await page.goto('http://127.0.0.1:'+port+'/?quality=' + quality);
      await page.evaluate((raw) => localStorage.setItem('greenhollow.save', raw), raw);
      await page.reload();
      await page.waitForFunction(() => !!window.__game);
      await page.getByRole('button', { name: 'Begin', exact: true }).click();
      await page.waitForFunction(
        () => window.__game.state().started && !window.__game.state().player.busy,
      );
      await page.waitForTimeout(700);
      const actualQuality = await page.evaluate(() => window.__game.view.ctx.quality);
      if(actualQuality !== quality) throw Error('quality mismatch '+actualQuality+' / '+quality);
      const prefix = width + '-' + quality;
      await capture(page, prefix + '-continued');
      for (const key of ['KeyQ', 'KeyR', 'KeyR', 'KeyQ']) {
        await page.keyboard.press(key);
        await page.waitForTimeout(400);
        await capture(page, prefix + '-' + results.length + '-turn');
      }
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(150);
      await page.keyboard.up('KeyW');
      await page.waitForTimeout(300);
      await capture(page, prefix + '-move');
      if (home) {
        if (!(await page.locator('.hp-tag').innerText()).includes('Hobb'))
          throw Error('resident label missing');
        await context.close();
        continue;
      }
      await page.keyboard.press('KeyE');
      await page.locator('[data-panel="farm"]').waitFor({ timeout: 4000 });
      await page.getByRole('button', { name: 'Why?', exact: true }).click();
      await page.locator('.fm-panel').evaluate(async (e) => {
        await Promise.all(e.getAnimations({ subtree: true }).map((a) => a.finished));
      });
      for (const name of ['Give', 'Take', 'Hide the fix']) {
        const b = await page.getByRole('button', { name, exact: true }).boundingBox();
        if (!b || b.width < 44 || b.height < 44 || b.x < 0 || b.x + b.width > width)
          errors.push('target ' + prefix + ' ' + name + ' ' + JSON.stringify(b));
      }
      await page.screenshot({ path: resolve(out, prefix + '-panel.png') });
      await page.keyboard.press('Escape');
      await page.waitForFunction(
        () =>
          !document.querySelector('[data-panel="farm"]') &&
          [...document.querySelectorAll('.fm-tag')].some(
            (e) =>
              getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden',
          ),
      );
      await capture(page, prefix + '-closed');
      await context.close();
    }
} catch (e) {
  failure = String(e);
  console.error(e);
} finally {
  clearInterval(monitor);
  await browser?.close();
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((ok) => server.once('exit', ok));
    server.kill('SIGTERM');
    await exited;
  }
  writeFileSync(
    resolve(out, 'report.json'),
    JSON.stringify(
      {
        status:
          failure || errors.length || results.some((r) => r.failures.length) ? 'ISSUES' : 'PASS',
        failure,
        errors,
        results,
        combinedAcceptance: 'pending',
      },
      null,
      2,
    ),
  );
}
if (failure || errors.length || results.some((r) => r.failures.length)) process.exitCode = 1;

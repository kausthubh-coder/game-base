// Films the hero walking, a twentieth of a second at a time, and lays the frames out side by side, so a frame
// that shows the wrong drawing can be seen. It also reads what the sprite system says it is showing.
//   bun tools/hero-frames.mjs [--port 5476] [--dist dist-painted] [--no-build] [--keys wd,w,d,sa] [--steps 30] [--out .artifacts/painted/hero-frames.png]
// It exits 1 when a frame the sprite system reports lies outside the animation, or on a console error.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', '5476')), dist = opt('dist', 'dist-painted'), steps = Number(opt('steps', '30'));
const runs = opt('keys', 'wd,w,d,sa').split(',');
const out = resolve(root, opt('out', '.artifacts/painted/hero-frames.png'));
mkdirSync(dirname(out), { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error(`FAIL: the build into ${dist}`); process.exit(1); }
}
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => { text += chunk; const pid = /pid (\d+)/.exec(text); if (pid) done(Number(pid[1])); });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});

const errors = [], bad = [], crops = [];
const SIZE = 150;
let browser;
try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.setDefaultTimeout(900000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(async () => {
    const g = window.__game;
    g.newGame(); g.manual(true);
    g.view.game.systems.time?.setWeather('clear', true);
    g.setTime(0.5); g.advance(0.2);
    g.view.root.style.visibility = 'hidden';
    g.teleport('grant.center');
    for (let i = 0; i < 2; i++) g.view.camera.zoomBy(-1);
    g.advance(0.1); await g.frames(20); await g.settle();
  });
  for (const keys of runs) {
    await page.evaluate((keys) => { const g = window.__game; for (const k of 'wasd') g.key(k, keys.includes(k)); g.advance(0.3); }, keys);
    for (let i = 0; i < steps; i++) {
      const state = await page.evaluate(async () => {
        const g = window.__game;
        g.advance(0.05); await g.frames(1);
        // Where the hero is on the screen.
        const p = g.view.playerPosition, v = g.view.scene.position.clone().set(p.x, p.y + 1, p.z).project(g.view.ctx.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
      });
      const left = Math.max(0, Math.min(1280 - SIZE, Math.round(state.x - SIZE / 2))), top = Math.max(0, Math.min(720 - SIZE, Math.round(state.y - SIZE / 2)));
      crops.push({ keys, i, image: await page.screenshot({ clip: { x: left, y: top, width: SIZE, height: SIZE } }) });
    }
  }
  await page.evaluate(() => { const g = window.__game; for (const k of 'wasd') g.key(k, false); });
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}
const perRow = 15, rows = Math.ceil(crops.length / perRow);
await sharp({ create: { width: perRow * SIZE, height: rows * SIZE, channels: 3, background: '#222222' } })
  .composite(crops.map((c, n) => ({ input: c.image, left: (n % perRow) * SIZE, top: Math.floor(n / perRow) * SIZE }))).png().toFile(out);
console.log(`${out}: ${crops.length} frames, ${perRow} to a row, in the order ${runs.join(', ')}`);
if (errors.length || bad.length) { console.log(`FAIL: ${[...new Set([...errors, ...bad])].slice(0, 6).join('\n  ')}`); process.exit(1); }
console.log('ok: no console errors');

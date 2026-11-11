// Walks the hero over rolling ground and measures how far the drawn hero is from the drawn land under its feet.
// On smooth land a hero on the ground must stand on the land in every frame: a gap shows as hovering, hopping
// up a step that is not drawn, or lagging behind a slope.
//   bun tools/hero-ground.mjs [--port 5476] [--dist dist-painted] [--no-build] [--limit 0.06]
// It walks four ways from two places, one step of the rules at a time, and exits 1 when the gap is over the limit.
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', '5476')), dist = opt('dist', 'dist-painted'), limit = Number(opt('limit', '0.06'));

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

const errors = [];
let runs = [];
let browser;
try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  page.setDefaultTimeout(900000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  runs = await page.evaluate(async () => {
    const g = window.__game, out = [];
    g.newGame(); g.manual(true);
    g.view.game.systems.time?.setWeather('clear', true);
    g.setTime(0.5); g.advance(0.2);
    g.view.root.style.visibility = 'hidden';
    // The side of the lone oak's hill, and the bank beside the path: both slope a block every few steps.
    for (const [x, z] of [[52, -246], [20, -214]]) {
      for (const keys of ['w', 'd', 's', 'a']) {
        g.teleport(x, z);
        for (const k of 'wasd') g.key(k, false);
        g.advance(0.3); await g.frames(12); await g.settle();
        // The land under a new place is drawn a few frames after the hero is set down there.
        g.advance(0.3); await g.frames(3);
        for (const k of 'wasd') g.key(k, keys.includes(k));
        let worst = 0, sum = 0, n = 0, rises = 0, last = NaN, air = 0;
        const start = { ...g.view.playerPosition };
        // One step of the rules at a time: the debug door's `advance` rounds to whole steps of a twentieth of a second.
        for (let i = 0; i < 100; i++) {
          g.advance(0.05); await g.frames(1);
          const p = g.view.playerPosition, ground = g.view.groundAt(p.x, p.z), body = g.view.game.player;
          // Nobody jumps here, so the hero is off the ground only while stepping down a block, and is still drawn on the land.
          if (!(ground === ground)) continue;
          if (!body.onGround) air++;
          const gap = Math.abs(p.y - ground);
          worst = Math.max(worst, gap); sum += gap; n++;
          if (last === last && Math.abs(body.pos.y - last) > 0.5) rises++;
          last = body.pos.y;
        }
        const end = g.view.playerPosition;
        out.push({ from: [x, z], keys, frames: n, air, steps: rises, worst, mean: n ? sum / n : 0, walked: Math.hypot(end.x - start.x, end.z - start.z) });
      }
    }
    for (const k of 'wasd') g.key(k, false);
    return out;
  });
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}
let bad = 0;
for (const r of runs) {
  const over = r.worst > limit || r.frames < 60 || r.walked < 4;
  if (over) bad++;
  console.log(`${over ? 'FAIL' : 'ok  '} from ${r.from.join(', ')} walking ${r.keys}: walked ${r.walked.toFixed(1)} blocks, ${r.frames} frames, ${r.air} of them stepping down, ${r.steps} block steps, worst gap ${r.worst.toFixed(3)}, mean ${r.mean.toFixed(3)}`);
}
if (errors.length) console.log(`FAIL: console errors\n  ${[...new Set(errors)].slice(0, 4).join('\n  ')}`);
console.log(bad || errors.length ? `FAIL: the hero leaves the land in ${bad} of ${runs.length} walks (limit ${limit})` : `PASS: ${runs.length} walks, the hero stays on the land (limit ${limit})`);
process.exit(bad || errors.length ? 1 : 0);

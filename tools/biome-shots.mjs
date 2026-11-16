// Pictures of each kind of land of Greenhollow (docs/greenhollow-world.md), close up and from 80 blocks off, with
// the draw calls and triangles at each, to judge the kinds of land's look and its cost. It builds the game,
// serves it, starts a game through the debug door and stands the hero in each kind.
//   bun tools/biome-shots.mjs [--port 5570] [--dist dist-biomes] [--no-build] [--out .artifacts/world/biomes]
//     [--kinds meadow,oldForest,...] [--shots near,far] [--times 0.5,0.71] [--qualities high,low] [--query "grey=b"] [--tag b]
// Pictures are JPEG, to keep them small. It fails on a console error. This Mac draws WebGL with its graphics
// chip: the counts are exact, a frame rate would say nothing about a Chromebook.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', '5570'));
const dist = opt('dist', 'dist-biomes');
const out = resolve(root, opt('out', '.artifacts/world/biomes'));
const tag = opt('tag', '');
const query = opt('query', '');
mkdirSync(out, { recursive: true });

/**
 * Where each kind of land is on today's land, deep inside it and above water, and which way to look (`yaw` 0
 * looks north, 90 west). `near` stands the hero there with the camera just behind; `far` stands the hero `back`
 * blocks back from it, looking at it, so the kind is seen as one piece.
 */
const KINDS = {
  meadow: { at: [-14, -236], yaw: 300 },
  oldForest: { at: [-150, -250], yaw: 60 },
  greyForest: { at: [384, -440], yaw: 0, farYaw: 315 },
  marsh: { at: [214, -62], yaw: 160, farYaw: 255 },
  caveHills: { at: [238, -314], yaw: 30, farYaw: 165 },
  terraces: { at: [-26, -398], yaw: 0, farYaw: 75 },
  town: { at: [150, -139], yaw: 318 },
};
const SHOTS = { near: { pitch: 8, distance: 11, back: 0 }, far: { pitch: 12, distance: 16, back: 80 } };
const kinds = opt('kinds', Object.keys(KINDS).join(',')).split(',');
const shots = opt('shots', 'near,far').split(',');
const times = opt('times', '0.5,0.71').split(',').map(Number);
const qualities = opt('qualities', 'high,low').split(',');

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error(`FAIL: the build into ${dist}`); process.exit(1); }
}
// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => { text += chunk; const pid = /pid (\d+)/.exec(text); if (pid) done(Number(pid[1])); });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});

const errors = [], counts = {};
let browser;
try {
  browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const quality of qualities) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    page.setDefaultTimeout(900000);
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${quality}${query ? '&' + query : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => {
      const g = window.__game;
      g.newGame();
      g.manual(true);
      g.view.game.systems.time?.setWeather('clear', true);
      g.advance(0.2);
      g.view.root.style.visibility = 'hidden';
      const beam = g.view.scene.getObjectByName('waypoint-beam');
      if (beam) beam.material.visible = false;
    });
    for (const kind of kinds) for (const shot of shots) for (const t of times) {
      const where = KINDS[kind], camera = SHOTS[shot];
      if (!where || !camera) throw new Error(`no kind ${kind} or shot ${shot}`);
      const name = `${kind}-${shot}-${t}-${quality}${tag ? '-' + tag : ''}`;
      counts[name] = await page.evaluate(async ({ where, camera, t, top }) => {
        const g = window.__game;
        // From far off, the way that is open and high enough to see the kind as one piece.
        const look = camera.back > 0 ? (where.farYaw ?? where.yaw) : where.yaw, yaw = (look * Math.PI) / 180;
        g.teleport(Math.round(where.at[0] + Math.sin(yaw) * camera.back), Math.round(where.at[1] + Math.cos(yaw) * camera.back));
        g.setCamera('free');
        g.look(look, camera.pitch, camera.distance);
        g.setTime(t);
        g.advance(0.1);
        await g.frames(40);
        await g.settle();
        await g.frames(60);
        const c = g.costs();
        return { drawCalls: c.total.drawCalls, triangles: c.total.triangles, features: c.features.slice(0, top).map((f) => `${f.name ?? f.feature} ${f.drawCalls}/${f.triangles}`) };
      }, { where, camera, t, top: args.includes('--all') ? 40 : 8 });
      await page.screenshot({ path: resolve(out, `${name}.jpg`), type: 'jpeg', quality: 78 });
      console.log(`${name}  draw calls ${counts[name].drawCalls}  triangles ${counts[name].triangles}`);
      if (args.includes('--costs')) console.log(`    ${counts[name].features.join(', ')}`);
    }
    await page.close();
  }
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}
writeFileSync(resolve(out, `counts${tag ? '-' + tag : ''}.json`), JSON.stringify(counts, null, 2));
if (errors.length) {
  console.log(`FAIL: console errors\n  ${[...new Set(errors)].slice(0, 6).join('\n  ')}`);
  process.exit(1);
}
console.log('ok: no console errors');

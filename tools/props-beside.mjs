// One prop on the painted land, in the game's own light, beside its concept sheet: the picture the make-3d-asset
// skill judges a model by. It builds the game, serves it, starts a new game, stands the prop in an open meadow
// with the hero beside it, and shoots it twice: from a low three-quarter like the sheet's main view,
// and from the game's own camera at play distance.
//   bun tools/props-beside.mjs <kind> [--variant 0] [--sheet assets-src/concept/<group>/<kind>.webp]
//     [--at 100,-210] [--side right|left] [--turn 35] [--pitch 12] [--distance <m>] [--time 0.42]
//     [--quality high] [--port 5480] [--dist dist-beside] [--no-build] [--out .artifacts/props]
// `--turn` is how many degrees the three-quarter view turns from the front toward `--side`, where the hero stands.
// It writes, into the out folder:
//   beside-<kind>-<variant>.png   the three-quarter shot on the left, the sheet on the right, both 810 high
//   game-<kind>-<variant>.png     the game's own camera, zoomed out to its default
// Without --sheet it looks for assets-src/concept/*/<kind>.webp. It fails on a console error or an unknown kind.
// This Mac draws WebGL on its graphics chip: the pictures say what is drawn, never how fast.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import * as THREE from 'three';
import { launchChrome } from './lib/chrome.mjs';
import { PROPS } from '../src/content/props.ts';
import { buildProp } from '../src/features/props/build.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const kind = args[0];
if (!kind || kind.startsWith('--')) { console.error('usage: bun tools/props-beside.mjs <kind> [--variant 0] [--sheet <path>]'); process.exit(2); }
if (!PROPS[kind]) { console.error(`FAIL: ${kind} is not in src/content/props.ts`); process.exit(1); }
const root = resolve(import.meta.dirname, '..');
const variant = Number(opt('variant', '0'));
const PORT = Number(opt('port', process.env.PORT ?? '5480'));
const dist = opt('dist', 'dist-beside');
const out = resolve(root, opt('out', '.artifacts/props'));
const [atX, atZ] = opt('at', '100,-210').split(',').map(Number);
const side = opt('side', 'right') === 'left' ? -1 : 1;
const pitch = Number(opt('pitch', '12'));
const time = Number(opt('time', '0.42'));
const quality = opt('quality', 'high');
mkdirSync(out, { recursive: true });

let sheet = opt('sheet', '');
if (!sheet) {
  const base = resolve(root, 'assets-src/concept');
  const group = readdirSync(base, { withFileTypes: true }).find((d) => d.isDirectory() && existsSync(resolve(base, d.name, `${kind}.webp`)));
  if (group) sheet = `assets-src/concept/${group.name}/${kind}.webp`;
}
if (!sheet) console.log(`No concept sheet found for ${kind}: the beside picture will hold the game's shot only. Pass --sheet <path>.`);

// The prop's size, from its own geometry, decides where the hero stands and how far back the camera goes.
const geometry = buildProp(kind, variant);
geometry.computeBoundingBox();
const size = geometry.boundingBox.getSize(new THREE.Vector3());
const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
// 0 lets the page work the distance out from the lens, so the whole prop fits.
const distance = Number(opt('distance', '0'));
const turn = Number(opt('turn', '35'));
console.log(`${kind} variant ${variant}: ${size.x.toFixed(1)} x ${size.z.toFixed(1)} x ${size.y.toFixed(1)} blocks (w x d x h)`);

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

const errors = [];
const shot = resolve(out, `three-quarter-${kind}-${variant}.png`), game = resolve(out, `game-${kind}-${variant}.png`);
let browser;
try {
  browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  console.log(`renderer: ${browser.gameRenderer ?? 'unknown'}`);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
  page.setDefaultTimeout(600000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${quality}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  const placed = await page.evaluate(async ({ kind, variant, atX, atZ, size, centre, side, time }) => {
    const g = window.__game;
    g.newGame();
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear', true);
    g.setTime(time);
    g.advance(0.2);
    g.view.root.style.visibility = 'hidden';
    const beam = g.view.scene.getObjectByName('waypoint-beam');
    if (beam) beam.material.visible = false;
    // The hero first, beside the prop's flank at its middle depth, so he stands about as far from the lens as the
    // prop does. Standing him there loads the land, so the ground's height under the prop is known.
    g.teleport(atX + side * (size.x / 2 + 1.2), atZ);
    // The prop's footprint centre lands on the column.
    const at = g.stand(kind, variant, atX - centre.x, atZ - centre.z, 0);
    if (!at || !at.handle) return null;
    return { y: at.y };
  }, { kind, variant, atX, atZ, size, centre, side, time });
  if (!placed) throw new Error(`the game did not stand ${kind} variant ${variant}`);

  // The free camera stays within 12 m of the hero, too close for a landmark. So the game's own camera is moved
  // just before each draw: from the front, turned toward the hero's side, far enough back to hold the whole prop.
  await page.evaluate(async ({ atX, atZ, y, size, side, turn, pitch, distance }) => {
    const g = window.__game, renderer = g.view.ctx.renderer, D = Math.PI / 180;
    g.setCamera('free');
    g.aimAt(atX, y + size.y * 0.42, atZ);
    const draw = renderer.render.bind(renderer);
    window.__drawn = draw;
    renderer.render = (scene, camera) => {
      if (camera === g.view.ctx.camera) {
        const r = 0.5 * Math.hypot(size.x, size.y, size.z), fov = (camera.fov ?? 50) * D;
        const back = distance || r / Math.sin(fov / 2) * 1.08, gaze = y + size.y * 0.42;
        camera.position.set(atX + side * Math.sin(turn * D) * Math.cos(pitch * D) * back, gaze + Math.sin(pitch * D) * back, atZ + Math.cos(turn * D) * Math.cos(pitch * D) * back);
        camera.far = Math.max(camera.far, back * 4);
        camera.lookAt(atX, gaze, atZ);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
      }
      draw(scene, camera);
    };
    g.advance(0.1);
    await g.frames(30);
    await g.settle();
    await g.frames(50);
  }, { atX, atZ, y: placed.y, size, side, turn, pitch, distance });
  await page.screenshot({ path: shot });

  await page.evaluate(async () => {
    const g = window.__game;
    g.view.ctx.renderer.render = window.__drawn;
    g.setCamera('tilt');
    g.advance(0.1);
    await g.frames(30);
    await g.settle();
    await g.frames(30);
  });
  await page.screenshot({ path: game });
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}

const height = 810;
const layers = [{ input: shot, left: 0, top: 0 }];
let width = 1440;
if (sheet) {
  const right = await sharp(resolve(root, sheet)).resize({ height }).png().toBuffer({ resolveWithObject: true });
  layers.push({ input: right.data, left: 1440, top: 0 });
  width += right.info.width;
}
const beside = resolve(out, `beside-${kind}-${variant}.png`);
await sharp({ create: { width, height, channels: 3, background: '#f3e6cc' } }).composite(layers).png().toFile(beside);
console.log(`beside: ${beside}\ngame:   ${game}`);
if (errors.length) {
  console.log(`FAIL: console errors\n  ${[...new Set(errors)].slice(0, 6).join('\n  ')}`);
  process.exit(1);
}
console.log('ok: no console errors');

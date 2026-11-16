// Landmark props in the real game: each one stood on the painted land in the game's own light, shot from its
// concept sheet's three-quarter angle, and set beside the sheet. With `--costs` it also reads
// `window.__game.costs()` standing in the town and in the meadow, at high and at low.
//   PORT=5594 bun tools/props-quality.mjs [--tag after] [--kinds rockArch,boulders] [--costs] [--quality high]
//     [--out .artifacts/act1/props-quality] [--time 0.42]
// It starts the game's dev server on PORT (Vite, so the page can import the game's own `worldProps`), stops
// it by its pid at the end, and exits 1 on a console error. Pictures say what is drawn, never how fast.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', process.env.PORT ?? '5594'));
const out = resolve(root, opt('out', '.artifacts/act1/props-quality'));
const tag = opt('tag', 'after');
const quality = opt('quality', 'high');
const time = Number(opt('time', '0.42'));
mkdirSync(out, { recursive: true });

/**
 * Each shot: the free camera round the hero (`yaw` 0 looks north and 90 west, `pitch` down, `distance` at most
 * 12 m), and where the model stands: `ahead` meters on along the view and `side` meters to the right of it,
 * plus `dx`, `dz`. The models face +z, so a camera south of them sees the front.
 */
const SHOTS = {
  rockArch: { variant: 0, yaw: 335, pitch: -4, distance: 12, ahead: 19, side: 0, dx: 0, dz: 0, sheet: 'rockArch' },
  boulders: { variant: 2, yaw: 335, pitch: 10, distance: 10, ahead: 6, side: 1.5, dx: 0, dz: 0, sheet: 'boulders' },
  boulders1: { kind: 'boulders', variant: 1, yaw: 335, pitch: 10, distance: 10, ahead: 6, side: 1.5, dx: 0, dz: 0, sheet: 'boulders' },
  fallenGiant: { variant: 0, yaw: 312, pitch: 14, distance: 12, ahead: 3, side: 0, dx: 13, dz: 0, time: 0.62, sheet: 'fallenGiant' },
  stiltHut: { variant: 0, yaw: 35, pitch: 15, distance: 12, ahead: 6, side: 0, dx: 0, dz: 0, sheet: 'stiltHut' },
};
const kinds = opt('kinds', Object.keys(SHOTS).join(',')).split(',');
/** An open stretch of meadow west of the spawn. */
const MEADOW = [30, -221];

// Vite prints its address, not its pid: the pid is the child's own, and it is stopped by that pid.
const server = spawn('bun', ['x', 'vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => { text += chunk; if (/Local:/.test(text)) done(); });
  server.on('exit', (code) => fail(new Error(`vite stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`dev server pid ${server.pid} on ${PORT}`);

const errors = [];
let browser;
const report = {};
async function open(level) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 620 } })).newPage();
  page.setDefaultTimeout(600000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${level}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate((t) => {
    const g = window.__game;
    g.newGame();
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear', true);
    g.setTime(t);
    g.advance(0.2);
    g.view.root.style.visibility = 'hidden';
    const beam = g.view.scene.getObjectByName('waypoint-beam');
    if (beam) beam.material.visible = false;
  }, time);
  return page;
}

try {
  browser = await launchChrome({ headless: true });
  const page = await open(quality);
  for (const key of kinds) {
    const shot = SHOTS[key];
    if (!shot) throw new Error(`no shot called ${key}`);
    const kind = shot.kind ?? key;
    report[key] = await page.evaluate(async ({ kind, shot, at, time }) => {
      const g = window.__game;
      const { worldProps } = await import('/src/game/worldview/props.ts');
      const props = worldProps(g.view);
      g.teleport(at[0], at[1]);
      g.advance(0.1);
      await g.frames(10);
      await g.settle();
      const hero = g.state().player;
      const yaw = (shot.yaw * Math.PI) / 180;
      const x = hero.x - Math.sin(yaw) * shot.ahead + Math.cos(yaw) * shot.side + shot.dx;
      const z = hero.z - Math.cos(yaw) * shot.ahead - Math.sin(yaw) * shot.side + shot.dz;
      const ground = g.view.groundAt(x, z);
      const handle = props.place(kind, shot.variant, x, Number.isFinite(ground) ? ground - 0.05 : hero.y, z, 0, 1, true);
      g.setCamera('free');
      g.look(shot.yaw, shot.pitch, shot.distance);
      g.setTime(shot.time ?? time);
      g.advance(0.1);
      await g.frames(20);
      await g.settle();
      await g.frames(30);
      const c = g.costs();
      window.__lastHandle = handle;
      return { drawCalls: c.total.drawCalls, triangles: c.total.triangles, props: c.features.find((r) => r.feature === 'props') ?? null };
    }, { kind, shot, at: MEADOW, time });
    const picture = resolve(out, `${key}-${tag}.png`);
    await page.screenshot({ path: picture });
    await page.evaluate(async () => {
      const { worldProps } = await import('/src/game/worldview/props.ts');
      worldProps(window.__game.view).remove(window.__lastHandle);
    });
    const concept = await sharp(resolve(root, `assets-src/concept/8-set-pieces/${shot.sheet}.webp`)).resize(900, 620, { fit: 'contain', background: '#f5e4c7' }).toBuffer();
    await sharp({ create: { width: 1860, height: 620, channels: 3, background: '#f5e4c7' } })
      .composite([{ input: picture, left: 0, top: 0 }, { input: concept, left: 960, top: 0 }])
      .jpeg({ quality: 82 }).toFile(resolve(out, `${key}-${tag}-compare.jpg`));
    console.log(`${key}-${tag}: draw calls ${report[key].drawCalls}, triangles ${report[key].triangles}`);
  }
  await page.context().close();

  if (args.includes('--costs')) {
    const VIEWS = { town: { at: [150, -139], yaw: 318, pitch: 11, distance: 17 }, meadow: { at: 'spawn', yaw: 300, pitch: 6, distance: 9 } };
    for (const level of ['high', 'low']) {
      const costPage = await open(level);
      for (const [name, view] of Object.entries(VIEWS)) {
        report[`costs-${name}-${level}`] = await costPage.evaluate(async (view) => {
          const g = window.__game;
          if (typeof view.at === 'string') g.teleport(view.at); else g.teleport(view.at[0], view.at[1]);
          g.setCamera('free');
          g.look(view.yaw, view.pitch, view.distance);
          g.advance(0.1);
          await g.frames(30);
          await g.settle();
          await g.frames(50);
          const c = g.costs();
          const props = c.features.find((r) => r.feature === 'props');
          return { drawCalls: c.total.drawCalls, triangles: c.total.triangles, propsDrawCalls: props?.drawCalls ?? 0, propsTriangles: props?.triangles ?? 0 };
        }, view);
        await costPage.screenshot({ path: resolve(out, `costs-${name}-${level}-${tag}.png`), type: 'png' });
        console.log(`costs ${name} ${level} (${tag}): ${JSON.stringify(report[`costs-${name}-${level}`])}`);
      }
      await costPage.context().close();
    }
  }
} finally {
  await browser?.close();
  try { process.kill(server.pid); } catch { /* it stopped by itself */ }
}
writeFileSync(resolve(out, `report-${tag}.json`), JSON.stringify({ renderer: browser?.gameRenderer, report, errors }, null, 2));
if (errors.length) {
  console.log(`FAIL: console errors\n  ${[...new Set(errors)].slice(0, 6).join('\n  ')}`);
  process.exit(1);
}
console.log('ok: no console errors');

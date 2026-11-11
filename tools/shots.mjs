import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2), name = args[0] || 'all';
const scenes = JSON.parse(readFileSync(resolve(root, 'tools/shots/scenes.json')));
const selected = name === 'all' ? Object.keys(scenes) : [name];
for (const key of selected) if (!scenes[key]) throw new Error(`unknown scene ${key}`);
const out = resolve(root, '.artifacts/shots'), approved = resolve(root, 'docs/shots/approved');
mkdirSync(out, { recursive: true }); mkdirSync(approved, { recursive: true });
const port = Number(process.env.PLAY_PORT || 5526);
if (port < 5520 || port > 5529) throw new Error('use a port in 5520..5529');
async function build() {
  const child = spawn('bun', ['run', 'build', '--outDir', join(out, 'site'), '--emptyOutDir'], { cwd: root, stdio: 'inherit' });
  await new Promise((yes, no) => { child.on('error', no); child.on('exit', code => code === 0 ? yes() : no(new Error(`build exited ${code}`))); });
}
await build();
const scriptBytes = readdirSync(join(out, 'site/assets')).filter(n => n.endsWith('.js')).reduce((n, file) => n + statSync(join(out, 'site/assets', file)).size, 0);
console.log(`Built scripts: ${scriptBytes} bytes`);
const server = spawn('bun', ['tools/serve.mjs', join(out, 'site'), String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
let browser, failures = [], report = {};
try {
  await new Promise((yes, no) => { server.stdout.on('data', c => { if (/pid \d+/.test(String(c))) yes(); }); server.on('exit', code => no(new Error(`server exited ${code}`))); server.on('error', no); });
  browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const key of selected) {
    const scene = scenes[key], errors = [];
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    // Pin visual randomness too: rain and foliage use Math.random outside the seeded kernel.
    await page.addInitScript(seed => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => raf(time => { if (!window.__freezeShots) callback(time); });
      let x = seed >>> 0;
      Math.random = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    }, scene.seed);
    await page.goto(`http://127.0.0.1:${port}/?${new URLSearchParams({ ...scene.flags, hold:'1', seed: String(scene.seed) })}`);
    await page.waitForFunction(() => window.__game !== undefined);
    const counters = await page.evaluate(async s => {
      const g = window.__game;
      g.newGame(); g.manual(true);
      if (!g.teleport(s.at)) throw new Error(`unknown place ${s.at}`);
      g.view.game.systems.time.setWeather(s.weather, true);
      g.setTime(s.time); g.advance(0.2);
      g.setCamera(s.camera.mode);
      if (s.camera.mode !== 'tilt') g.look(s.camera.yaw, s.camera.pitch, s.camera.distance);
      g.view.root.style.visibility = 'hidden';
      const beam = g.view.scene.getObjectByName('waypoint-beam'); if (beam) beam.material.visible = false;
      await g.settle(); await g.frames(60);
      return g.counters();
    }, scene);
    // Freeze the draw loop at an exact visual time, independent of renderer speed.
    await page.evaluate(async () => {
      window.__freezeShots = true;
    });
    const image = await page.screenshot({ path: join(out, key + '.png') });
    if (!(Number(counters.drawCalls) > 0) || !(Number(counters.triangles) > 0) || counters.drawCalls > 150 || counters.triangles > 400000) failures.push(`${key}: budget exceeded or empty render`);
    const metadata = { renderer: browser.gameRenderer, scene, counters, scriptBytes };
    writeFileSync(join(out, key + '.json'), JSON.stringify(metadata, null, 2));
    const baseline = join(approved, key + '.png'), metaPath = join(approved, key + '.json');
    if (args.includes('--approve') && errors.length === 0 && Number(counters.drawCalls) > 0 && Number(counters.triangles) > 0 && counters.drawCalls <= 150 && counters.triangles <= 400000) { writeFileSync(baseline, image); writeFileSync(metaPath, JSON.stringify(metadata, null, 2)); }
    let difference = null;
    if (args.includes('--check')) {
      if (!existsSync(baseline) || !existsSync(metaPath)) failures.push(`${key}: no approved copy`);
      else {
        const old = JSON.parse(readFileSync(metaPath));
        if (old.renderer !== browser.gameRenderer) console.warn(`WARN ${key}: renderer differs; skipped pixel comparison (${old.renderer})`);
        else {
          const a = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const b = await sharp(baseline).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          if (a.info.width !== b.info.width || a.info.height !== b.info.height) failures.push(`${key}: dimensions differ`);
          else {
            let changed = 0;
            for (let i = 0; i < a.data.length; i += 3) if (Math.max(...[0,1,2].map(c => Math.abs(a.data[i+c]-b.data[i+c]))) > 24) changed++;
            difference = changed / (a.info.width * a.info.height);
            if (difference > 0.025) failures.push(`${key}: ${(difference * 100).toFixed(2)}% pixels differ, limit 2.5%`);
            if (JSON.stringify(old.scene) !== JSON.stringify(scene)) failures.push(`${key}: scene settings differ from approval`);
          }
        }
      }
    }
    if (errors.length) failures.push(`${key}: ${errors.join('; ')}`);
    report[key] = { ...metadata, difference };
    console.log(`${key}: ${counters.drawCalls} draw calls, ${counters.triangles} triangles${difference === null ? '' : `, ${(difference*100).toFixed(2)}% pixels differ`}`);
    await context.close();
  }
} finally { await browser?.close(); server.kill(); }
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(failures.length ? `FAIL: ${failures.length} scene checks` : `PASS: ${selected.length} scenes`);
process.exitCode = failures.length ? 1 : 0;

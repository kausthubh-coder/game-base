// What Greenhollow's land costs to draw: the fixed flight (`/?bench`) at a level, then `window.__game.costs()`
// standing at each of the ten places of docs/greenhollow-world.md, against the level's budget.
//   bun tools/land-costs.mjs [--port 5548] [--dist dist-painted] [--no-build] [--quality high] [--no-bench] [--no-places] [--out .artifacts/land]
// It builds the game (unless `--no-build`), serves it, and stops the server it started by its pid.
// Draw calls and triangles are exact on any machine. It reports no frame rate: this Mac says nothing about a Chromebook.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', '5548'));
const dist = opt('dist', 'dist-painted');
const quality = opt('quality', 'high');
const out = resolve(root, opt('out', '.artifacts/land'));
mkdirSync(out, { recursive: true });

/** The ten places, as the shots stand at them: a place of the plan or a column, and the free camera's view. */
const PLACES = [
  ['plot', 'grant.center', 8, 4, 16], ['oak shrine', 'shrine-oak', 112, 9, 14], ['bridge', 'bridge', 233, 7, 13],
  ['boar', 'boar', 20, 10, 15], ['old gate', [32, -352], 323, 5, 12], ['cave mouth', 'caves', 280, 6, 14],
  ['pump house', [272, -114], 251, 7, 12], ['marsh shrine', 'shrine-marsh', 180, 5, 12], ['seed vault', 'seedvault', 90, 8, 14],
  ['terrace shrine', 'shrine-terrace', 0, 2, 12],
];

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

const result = { quality, bench: null, places: [] };
let browser;
try {
  browser = await launchChrome({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  if (!args.includes('--no-bench')) {
    const page = await context.newPage();
    page.setDefaultTimeout(1800000);
    await page.goto(`http://127.0.0.1:${PORT}/?bench&quality=${quality}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game?.bench?.().state === 'done', null, { polling: 2000 });
    const report = await page.evaluate(() => window.__game.bench());
    result.bench = { budget: report.budget, most: report.most, stops: report.stops.map((s) => ({ name: s.name, drawCalls: s.drawCalls, triangles: s.triangles })) };
    console.log(`bench at ${quality}: most ${report.most.drawCalls} draw calls, ${report.most.triangles} triangles in a frame`);
    for (const s of report.stops) console.log(`  ${s.name.padEnd(12)} ${String(s.drawCalls).padStart(4)} calls ${String(s.triangles).padStart(8)} triangles`);
    await page.close();
  }
  const page = args.includes('--no-places') ? null : await context.newPage();
  if (page) page.setDefaultTimeout(900000);
  if (page) await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${quality}`, { waitUntil: 'load' });
  if (page) await page.waitForFunction(() => window.__game !== undefined);
  if (page) await page.evaluate(() => { const g = window.__game; g.newGame(); g.manual(true); g.setTime(0.5); g.advance(0.2); g.view.root.style.visibility = 'hidden'; });
  for (const [name, at, yaw, pitch, distance] of page ? PLACES : []) {
    const row = await page.evaluate(async ({ at, yaw, pitch, distance }) => {
      const g = window.__game;
      if (typeof at === 'string') g.teleport(at); else g.teleport(at[0], at[1]);
      g.setCamera('free');
      g.look(yaw, pitch, distance);
      g.advance(0.1);
      await g.frames(30);
      await g.settle();
      await g.frames(50);
      const c = g.costs();
      return { drawCalls: c.total.drawCalls, triangles: c.total.triangles, top: c.features.slice(0, 6).map((f) => `${f.feature} ${f.drawCalls}/${f.triangles}`) };
    }, { at, yaw, pitch, distance });
    result.places.push({ name, ...row });
    console.log(`${name.padEnd(15)} ${String(row.drawCalls).padStart(4)} calls ${String(row.triangles).padStart(8)} triangles   ${row.top.join(', ')}`);
  }
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}
writeFileSync(resolve(out, `costs-${quality}.json`), JSON.stringify(result, null, 2));

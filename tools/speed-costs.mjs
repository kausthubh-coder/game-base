// What act 1's places cost to draw at each level, with a picture of each: the ten places of Greenhollow, the four
// views of Hollowmere and Saltgate's yard, plus the fixed flight (`/?bench`). For judging a speed change: run it
// before and after with two tags, and compare the numbers and the pictures.
//   bun tools/speed-costs.mjs [--port 5548] [--dist dist-speed] [--no-build] [--levels low,high] [--no-bench]
//     [--places plot,city-wide,...] [--no-places] [--tag before] [--out .artifacts/speed]
// It writes `costs-<tag>.json` and `<place>-<level>-<tag>.png`, and stops the server it started by its pid.
// Draw calls and triangles are exact on any machine. It reports no frame rate: this Mac says nothing about a Chromebook.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', '5548'));
const dist = opt('dist', 'dist-speed');
const tag = opt('tag', 'now');
const levels = opt('levels', 'low,medium,high,ultra').split(',');
const out = resolve(root, opt('out', '.artifacts/speed'));
mkdirSync(out, { recursive: true });

/** The places: where the hero stands (a place of the plan or a column) and the free camera's yaw, pitch and distance. */
const PLACES = {
  // The ten of docs/greenhollow-world.md, as `tools/land-costs.mjs` and `painted-shots.mjs --views greenhollow` stand.
  plot: ['grant.center', 8, 4, 16], 'oak-shrine': ['shrine-oak', 112, 9, 14], bridge: ['bridge', 233, 7, 13],
  boar: ['boar', 20, 10, 15], 'old-gate': [[32, -352], 323, 5, 12], 'cave-mouth': ['caves', 280, 6, 14],
  'pump-house': [[272, -114], 251, 7, 12], 'marsh-shrine': ['shrine-marsh', 180, 5, 12], 'seed-vault': ['seedvault', 90, 8, 14],
  'terrace-shrine': ['shrine-terrace', 0, 2, 12],
  // Hollowmere, as `painted-shots.mjs --views city` stands (at noon here, so the levels compare).
  'city-wide': [[182, -90], 345, 17, 55], 'city-street': [[236, -175], 88, 7, 13], 'city-quay': [[234, -131], 78, 10, 16],
  'city-market': [[226, -172], 300, 24, 30],
  // From the rise north of the city, looking south over its roofs.
  'city-hill': [[236, -276], 178, 24, 30],
  // Saltgate's yard, where grant day's spar is: looking north over the yard to the hall.
  'saltgate-yard': ['saltgate.yard', 330, 14, 16],
};
const places = args.includes('--no-places') ? [] : opt('places', Object.keys(PLACES).join(',')).split(',');

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

const result = { tag, levels: {} };
const errors = [];
let browser;
try {
  browser = await launchChrome({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  for (const level of levels) {
    const row = (result.levels[level] = { bench: null, places: {} });
    if (!args.includes('--no-bench')) {
      const page = await context.newPage();
      page.setDefaultTimeout(1800000);
      await page.goto(`http://127.0.0.1:${PORT}/?bench&quality=${level}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__game?.bench?.().state === 'done', null, { polling: 2000 });
      const report = await page.evaluate(() => window.__game.bench());
      const cpu = report.seconds.map((s) => s.cpuMs);
      row.bench = { most: report.most, scriptMs: { mean: Math.round((cpu.reduce((a, b) => a + b, 0) / cpu.length) * 100) / 100, worst: Math.max(...cpu) },
        stops: report.stops.map((s) => ({ name: s.name, drawCalls: s.drawCalls, triangles: s.triangles, features: s.features.slice(0, 6) })) };
      console.log(`[${level}] bench: most ${report.most.drawCalls} calls, ${report.most.triangles} triangles in a frame; script ${row.bench.scriptMs.mean} ms a frame, worst second ${row.bench.scriptMs.worst}`);
      for (const s of report.stops) console.log(`[${level}]   ${s.name.padEnd(12)} ${String(s.drawCalls).padStart(4)} calls ${String(s.triangles).padStart(8)} tris   ${s.features.slice(0, 4).map((f) => `${f.feature} ${f.drawCalls}/${f.triangles}`).join(', ')}`);
      await page.close();
    }
    if (places.length === 0) continue;
    const page = await context.newPage();
    page.setDefaultTimeout(900000);
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${level}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${level}: ${e}`));
    await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${level}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game !== undefined);
    await page.evaluate(() => {
      const g = window.__game;
      g.newGame(); g.manual(true);
      g.view.game.systems.time?.setWeather('clear', true);
      g.setTime(0.5); g.advance(0.2);
      g.view.root.style.visibility = 'hidden';
      const beam = g.view.scene.getObjectByName('waypoint-beam');
      if (beam) beam.material.visible = false;
    });
    for (const name of places) {
      const [at, yaw, pitch, distance] = PLACES[name];
      const cost = await page.evaluate(async ({ at, yaw, pitch, distance }) => {
        const g = window.__game;
        if (typeof at === 'string') g.teleport(at); else g.teleport(at[0], at[1]);
        g.setCamera('free');
        g.look(yaw, pitch, distance);
        g.setTime(0.5);
        g.advance(0.1);
        await g.frames(30);
        await g.settle();
        await g.frames(50);
        // Script a frame: the meter's mean over its last 120 frames, the update and the draw's own JavaScript.
        await g.frames(120);
        // At low the shadow map is drawn every other frame: the heavier of two frames is the place's cost.
        const n = g.counters();
        let c = g.costs();
        await g.frames(1);
        const d = g.costs();
        if (d.total.drawCalls > c.total.drawCalls) c = d;
        return { drawCalls: c.total.drawCalls, triangles: c.total.triangles, scriptMs: Math.round(Number(n.scriptMs) * 100) / 100,
          features: c.features.slice(0, 8).map((f) => ({ feature: f.feature, drawCalls: f.drawCalls, triangles: f.triangles, shadowCalls: f.shadowCalls, shadowTriangles: f.shadowTriangles })) };
      }, { at, yaw, pitch, distance });
      row.places[name] = cost;
      await page.screenshot({ path: resolve(out, `${name}-${level}-${tag}.png`) });
      console.log(`[${level}] ${name.padEnd(15)} ${String(cost.drawCalls).padStart(4)} calls ${String(cost.triangles).padStart(8)} tris ${String(cost.scriptMs).padStart(5)} ms   ${cost.features.slice(0, 5).map((f) => `${f.feature} ${f.drawCalls}/${f.triangles}`).join(', ')}`);
    }
    await page.close();
  }
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}
writeFileSync(resolve(out, `costs-${tag}.json`), JSON.stringify(result, null, 2));
if (errors.length) console.log(`console errors:\n  ${[...new Set(errors)].slice(0, 8).join('\n  ')}`);

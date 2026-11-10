// Proves that a new view needs no edit to the shell: it drops two files into src/game/views/, builds,
// opens the game and reads the console. One view logs once from its install. The other throws, and the
// game must start anyway. Both files are removed again and the game is rebuilt without them.
//   bun tools/play-view-proof.mjs
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '..');
// PLAY_PORT moves it, so several worktrees can run their checks at once.
const PORT = Number(process.env.PLAY_PORT) || 5330;
const good = resolve(root, 'src/game/views/zz-proof.view.ts');
const bad = resolve(root, 'src/game/views/zz-proof-throws.view.ts');
const build = () => spawnSync('bun', ['run', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] }).status === 0;

let pass = false, server, browser;
try {
  writeFileSync(good, `import type { GameView } from '../shell/view.ts';
let frames = 0;
export function install(view: GameView): void {
  console.info('[proof] installed with ' + view.game.actors.size + ' actor');
  view.onFrame(() => { if (++frames === 3) console.info('[proof] third frame'); });
}
`);
  writeFileSync(bad, `export function install(): void {
  throw new Error('proof: this view always throws');
}
`);
  if (!build()) throw new Error('the build failed with the two proof views in place');

  server = spawn('bun', ['tools/serve.mjs', 'dist', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  const pid = await new Promise((done, fail) => {
    server.stdout.on('data', (chunk) => { const m = /pid (\d+)/.exec(String(chunk)); if (m) done(Number(m[1])); });
    server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}`)));
  });
  console.log(`serving dist on http://127.0.0.1:${PORT}/  pid ${pid}`);

  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  page.setDefaultTimeout(120000);
  const lines = [];
  page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => lines.push(`pageerror: ${e}`));
  await page.goto(`http://127.0.0.1:${PORT}/?quality=low`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game?.started === true);
  await page.evaluate(() => window.__game.frames(4));
  const state = await page.evaluate(() => { const s = window.__game.state(); return { started: s.started, sprites: s.sprites.count }; });

  const installed = lines.filter((line) => line.includes('[proof] installed'));
  const framed = lines.filter((line) => line.includes('[proof] third frame'));
  const skipped = lines.filter((line) => line.includes('zz-proof-throws.view.ts threw while installing'));
  const other = lines.filter((line) => (line.startsWith('error') || line.startsWith('pageerror')) && !line.includes('zz-proof-throws'));
  for (const line of lines.filter((l) => l.includes('proof'))) console.log('  console ' + line.slice(0, 160));
  console.log(`the new view's install ran ${installed.length} time(s), its frame listener ran: ${framed.length === 1}`);
  console.log(`the throwing view was logged and skipped: ${skipped.length === 1}, and the game started: ${state.started} with ${state.sprites} sprite`);
  console.log(`other console errors: ${other.length}${other.length ? '\n' + other.join('\n') : ''}`);
  pass = installed.length === 1 && framed.length === 1 && skipped.length === 1 && state.started && state.sprites >= 1 && other.length === 0;
} catch (error) {
  console.error(String(error));
} finally {
  await browser?.close();
  server?.kill();
  rmSync(good, { force: true });
  rmSync(bad, { force: true });
  const clean = build();
  const diff = spawnSync('git', ['status', '--short', 'src/game/shell', 'src/game/boot.ts', 'src/game/systems.ts', 'src/main.ts', 'index.html'], { cwd: root }).stdout.toString();
  console.log(`the proof views are removed and the game is rebuilt without them: ${clean}`);
  console.log(`the shell's files as git sees them (all untracked or modified by the shell's author, none by this script):\n${diff}`);
}
console.log(pass ? 'PASS: a view dropped into src/game/views/ runs with no edit to the shell' : 'FAIL');
process.exit(pass ? 0 : 1);

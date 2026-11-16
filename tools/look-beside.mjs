// Act 1's look gate: each moment of the act a player sees, shot from the game's own camera, beside the approved
// sheet it must match. The moments are tools/look/moments.mjs; their grades are docs/act1-look.md.
//   bun tools/look-beside.mjs <id ...|all> [--no-build] [--site <built folder>] [--port 5911] [--size 1280x720] [--out .artifacts/look]
//   bun tools/look-beside.mjs --list
// It builds the game once (unless --no-build finds a build), serves it, opens one headless Chrome and plays every
// moment in one tab: a fresh game, the quest skipped to, the setup, the hero stood, the time set, the camera turned,
// a scene started if the moment has one. `--site <folder>` shoots a game built elsewhere, such as another branch's,
// and builds nothing. It writes, into the out folder:
//   game/<id>.png   the game's picture, as the player sees it, interface and all
//   <id>.png        that picture on the left, the moment's sheets on the right, its id and title over both
//   contact.jpg     every pair, small, in the order asked
//   run.json        the renderer, each moment's seconds, draw calls, triangles and console errors
// It exits 1 when a moment cannot be reached or the page logs an error. The pictures say what is drawn, never how
// fast: this Mac's frame rate says nothing about a Chromebook.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';
import { MOMENTS, SETUPS } from './look/moments.mjs';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const valued = new Set(['--port', '--size', '--out', '--site']);
const asked = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));

if (args.includes('--list') || asked.length === 0) {
  for (const m of MOMENTS) console.log(`${m.id.padEnd(16)} ${m.title}`);
  if (asked.length === 0 && !args.includes('--list')) console.error('\nusage: bun tools/look-beside.mjs <id ...|all> [--no-build]');
  process.exit(asked.length === 0 && !args.includes('--list') ? 2 : 0);
}
const byId = new Map(MOMENTS.map((m) => [m.id, m]));
const unknown = asked.filter((id) => id !== 'all' && !byId.has(id));
if (unknown.length) { console.error(`FAIL: no moment called ${unknown.join(', ')}. --list names them.`); process.exit(2); }
const chosen = asked.includes('all') ? MOMENTS : asked.map((id) => byId.get(id));

const out = resolve(root, opt('out', '.artifacts/look'));
const site = resolve(root, opt('site', '.artifacts/look/site'));
const port = Number(opt('port', process.env.LOOK_PORT || (process.env.PLAY_PORT ? Number(process.env.PLAY_PORT) + 2 : 5527)));
const [width, height] = opt('size', '1280x720').split('x').map(Number);
const PLAYTHROUGH = join(homedir(), 'dev/sandbox/game-look-test/playthrough/assets');
mkdirSync(join(out, 'game'), { recursive: true });

const started = Date.now();
const seconds = (from) => Math.round((Date.now() - from) / 100) / 10;

if (!args.includes('--site') && (!args.includes('--no-build') || !existsSync(join(site, 'index.html')))) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', site, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('FAIL: the build'); process.exit(1); }
}
const buildSeconds = seconds(started);

const server = spawn('bun', ['tools/serve.mjs', site, String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((yes, no) => {
  server.stdout.on('data', (c) => { if (/pid \d+/.test(String(c))) yes(); });
  server.on('exit', (code) => no(new Error(`the server on port ${port} exited ${code}: is the port taken? Pass --port.`)));
});

const sheetPath = (ref) => ref.startsWith('playthrough:') ? join(PLAYTHROUGH, ref.slice('playthrough:'.length)) : resolve(root, ref);

/** Plays one moment in the page and leaves its picture on the screen. Returns the counters, or throws. */
async function reach(page, m) {
  const params = new URLSearchParams({ skipintro: '1', seed: '7', ...(m.url ?? {}) });
  await page.goto(`http://127.0.0.1:${port}/?${params}`, { waitUntil: 'load' });
  await page.waitForFunction(() => '__game' in window && !document.querySelector('#loading'), null, { timeout: 120_000 });
  await page.evaluate(() => window.__game.newGame());
  await page.waitForFunction(() => window.__game.started === true, null, { timeout: 60_000 });
  await page.evaluate((quest) => {
    const g = window.__game;
    g.manual(true);
    g.view.game.systems.time?.setWeather('clear', true);
    if (quest) g.skipTo(quest);
    g.advance(2);
  }, m.quest ?? null);
  if (m.setup) await page.evaluate(SETUPS[m.setup]);
  return page.evaluate(async ({ m }) => {
    const g = window.__game;
    const sys = g.view.game.systems;
    if (m.time !== undefined) g.setTime(m.time);
    // A place or a room is shot as the player walks up to it: a film the skip left playing is ended first.
    const quiet = () => { for (let i = 0; i < 6 && sys.talk?.active; i++) { sys.talk.skip(); g.advance(0.5); } };
    if (!m.scene) quiet();
    if (m.stand) {
      const at = m.stand === 'grant' ? sys.region.grant() : typeof m.stand === 'string' ? sys.region.place(m.stand).at : { x: m.stand[0], z: m.stand[1] };
      const [dx, dz] = m.off ?? [0, 0];
      if (!g.teleport(at.x + dx, undefined, at.z + dz, m.face ?? Math.PI)) throw new Error(`cannot stand at ${m.stand}`);
    } else if (m.off) {
      const p = g.view.game.player.pos;
      g.teleport(p.x + m.off[0], undefined, p.z + m.off[1], m.face ?? Math.PI);
    }
    g.advance(0.5);
    if (!m.scene) quiet();
    for (let i = 0; i < (m.quarter ?? 0); i++) g.turn(1);
    if (m.zoom) g.view.camera.zoomBy(-m.zoom);
    let scene = null;
    if (m.scene) {
      // The director starts a scene once the player has stood free a moment within reach of its place.
      for (let t = 0; t < 30 && !sys.talk?.active; t += 0.25) g.advance(0.25);
      if (!sys.talk?.active) throw new Error(`scene ${m.scene.n} did not start`);
      for (let i = 0; i < (m.scene.lines ?? 0); i++) sys.talk.advance();
      scene = sys.talk.current()?.text ?? null;
    }
    // A skip's gift card and the toasts it leaves are not part of the moment.
    document.querySelectorAll('.st-gift, .hp-banner').forEach((card) => card.remove());
    await g.settle();
    await g.frames(m.scene ? 90 : 40);
    const c = g.counters();
    return { drawCalls: c.drawCalls, triangles: c.triangles, quality: c.quality, scene, player: g.view.game.player.pos, talk: sys.talk?.active ? sys.talk.current()?.text : null };
  }, { m: { ...m, sheets: undefined } });
}

const TITLE = 44;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const label = (w, text, sub) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${TITLE}">
  <rect width="100%" height="100%" fill="#1d1a24"/>
  <text x="14" y="29" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#f3e3b8">${esc(text)}</text>
  <text x="${w - 14}" y="29" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#b9aed0">${esc(sub)}</text>
</svg>`);

/** The game's picture on the left, the sheets stacked on the right at the picture's height. */
async function beside(m, shot) {
  const sheets = m.sheets.map(sheetPath).filter((p) => existsSync(p));
  const missing = m.sheets.filter((ref) => !existsSync(sheetPath(ref)));
  // The first sheet takes the full height; the rest share a column after it.
  const main = sheets[0] ? await sharp(sheets[0]).resize({ height }).png().toBuffer({ resolveWithObject: true }) : null;
  const rest = sheets.slice(1, 3);
  const restH = rest.length ? Math.floor(height / rest.length) : 0;
  const small = await Promise.all(rest.map((p) => sharp(p).resize({ height: restH }).png().toBuffer({ resolveWithObject: true })));
  const restW = small.reduce((w, s) => Math.max(w, s.info.width), 0);
  const total = width + (main?.info.width ?? 0) + restW;
  const layers = [
    { input: label(total, `${m.id}: ${m.title}`, `game | ${m.sheets.map((s) => s.split('/').pop()).join(' + ')}`), top: 0, left: 0 },
    { input: shot, top: TITLE, left: 0 },
  ];
  if (main) layers.push({ input: main.data, top: TITLE, left: width });
  small.forEach((s, i) => layers.push({ input: s.data, top: TITLE + i * restH, left: width + main.info.width }));
  const file = join(out, `${m.id}.png`);
  await sharp({ create: { width: total, height: height + TITLE, channels: 3, background: '#1d1a24' } }).composite(layers).png().toFile(file);
  return { file, missing };
}

const browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width, height } });
let errors = [];
let page = null;
/** A fresh tab: the first, and again when one stops answering on a busy machine. */
async function freshPage() {
  if (page) await page.close().catch(() => {});
  page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
}
await freshPage();

const report = { renderer: browser.gameRenderer, size: `${width}x${height}`, buildSeconds, moments: {} };
const pairs = [];
let failed = 0;
try {
  for (const m of chosen) {
    const from = Date.now();
    let counters = null, problem = null, shot = null;
    // A tab that hangs (the machine is shared) gets one more try in a new tab.
    for (let attempt = 0; attempt < 2 && !shot; attempt++) {
      errors = [];
      problem = null;
      try {
        counters = await reach(page, m);
      } catch (error) {
        problem = String(error?.message ?? error).split('\n')[0];
      }
      try {
        shot = await page.screenshot({ path: join(out, 'game', `${m.id}.png`), timeout: 30_000 });
      } catch (error) {
        problem = `no picture: ${String(error?.message ?? error).split('\n')[0]}`;
        await freshPage();
      }
    }
    if (!shot) shot = await sharp({ create: { width, height, channels: 3, background: '#000' } }).png().toBuffer();
    const { file, missing } = await beside(m, shot);
    pairs.push({ m, file });
    const row = { seconds: seconds(from), counters, problem, errors: [...new Set(errors)], missingSheets: missing };
    report.moments[m.id] = row;
    if (problem || row.errors.length) failed++;
    const tail = problem ? `FAIL ${problem}` : `${counters.drawCalls} draws, ${Math.round(counters.triangles / 1000)}k tris${counters.scene ? `, line: ${counters.scene.slice(0, 50)}` : ''}`;
    console.log(`${m.id.padEnd(16)} ${String(row.seconds).padStart(5)} s  ${tail}${row.errors.length ? `  ${row.errors.length} console errors` : ''}${missing.length ? `  missing ${missing.join(', ')}` : ''}`);
  }
} finally {
  await browser.close();
  server.kill();
}

// The contact sheet: two pairs a row, each scaled to one width.
const TILE = 1200, COLS = 2;
const tiles = await Promise.all(pairs.map(({ file }) => sharp(file).resize({ width: TILE }).png().toBuffer({ resolveWithObject: true })));
const rowHeights = [];
for (let i = 0; i < tiles.length; i += COLS) rowHeights.push(Math.max(...tiles.slice(i, i + COLS).map((t) => t.info.height)));
const sheetH = rowHeights.reduce((a, b) => a + b + 8, 8);
const layers = [];
let y = 8;
rowHeights.forEach((h, r) => {
  for (let c = 0; c < COLS; c++) {
    const t = tiles[r * COLS + c];
    if (t) layers.push({ input: t.data, top: y, left: 8 + c * (TILE + 8) });
  }
  y += h + 8;
});
if (tiles.length) {
  await sharp({ create: { width: 8 + COLS * (TILE + 8), height: sheetH, channels: 3, background: '#0f0d14' } }).composite(layers).jpeg({ quality: 78 }).toFile(join(out, 'contact.jpg'));
}
report.seconds = seconds(started);
writeFileSync(join(out, 'run.json'), JSON.stringify(report, null, 2));
console.log(`\n${chosen.length} moments in ${report.seconds} s (build ${buildSeconds} s). ${join(out, 'contact.jpg')}`);
if (failed) console.log(`${failed} moments failed or logged errors: see ${join(out, 'run.json')}`);
process.exit(failed ? 1 : 0);

// The interface's picture set, the same states at two sizes, for comparing one look with another.
// Builds the game into dist-ui, serves it, and for each state opens a fresh page with `?show=` (src/game/views/ui-show.view.ts),
// sets the scene through the debug door and saves a screenshot.
//   bun tools/ui-shots.mjs <out-folder> [--port 5372] [--no-build] [--only hud,bag,...]
//
// The states: the title, the HUD while walking, a line from Tamsin, a choice, the bag in the middle of a drag, Make,
// the Almanac, the quest log, the full map, the tracker with a toast, pause, Settings and the end card, each at
// 1440 by 900 and 390 by 844. Files are named <state>-<width>.png, and sheet-<width>.png puts them all on one page.
// This Mac draws WebGL in software, so the pictures show what is drawn, never how fast.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, args[0] && !args[0].startsWith('--') ? args[0] : '.artifacts/ui-shots');
const PORT = Number(opt('port', 5372));
const only = opt('only', '').split(',').filter(Boolean);
mkdirSync(out, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', 'dist-ui', '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('FAIL: the build into dist-ui'); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', 'dist-ui', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});

/** Fills the Almanac with a few pages, some facts known, so the book is not blank. */
const fillBook = () => {
  const almanac = window.__game.view.game.systems.almanac;
  const pages = almanac.pages().slice(0, 5);
  for (const page of pages) {
    almanac.meet(page.id);
    page.facts.slice(0, 2).forEach((fact) => almanac.learn(page.id, fact.id));
  }
};

const STATES = {
  async title() { },
  async hud(t) {
    await t.game(() => { const g = window.__game; g.view.setPaused('show', false); });
    await t.page.keyboard.down('w');
    await t.game(() => window.__game.advance(0.8));
    await t.frames(3);
  },
  async bag(t) {
    await t.game(() => window.__game.view.game.systems.inventory.add('stone', 20));
    await t.frames(2);
    // A real drag, held in the middle: the pointer goes down on the oak logs and moves over an empty slot.
    const from = await t.page.locator('[data-key="slot:2"]').boundingBox();
    const to = await t.page.locator(`[data-key="slot:${t.width < 600 ? 13 : 12}"]`).boundingBox();
    if (from && to) {
      await t.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await t.page.mouse.down();
      await t.page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 10, { steps: 3 });
      await t.page.mouse.move(to.x + to.width / 2 + 6, to.y + to.height / 2 + 4, { steps: 6 });
    }
    await t.frames(2);
  },
  async make() { },
  async almanac(t) {
    await t.game(fillBook);
    await t.game(() => window.__game.view.game.events.emit('ui.open', { panel: 'almanac' }));
    await t.frames(2);
    // New facts ink in over 900 ms.
    await t.page.waitForTimeout(1100);
  },
  async toast(t) {
    await t.game(() => {
      const g = window.__game, events = g.view.game.events;
      g.view.game.flags.set('has.almanac', true);
      g.give('oak_log', 6);
      g.give('fiber', 3);
      events.emit('hint', { id: 'shots', text: 'Press Tab to open the Almanac.' });
    });
    await t.frames(3);
  },
  async talk(t) { await t.frames(30); },
  async choice() { },
  async quests() { },
  async map() { },
  async pause() { },
  async settings() { },
  async end() { },
};
/** The `?show=` state each picture starts from. The title has none: it is what a fresh visit opens on. */
const SHOW = { title: null, hud: 'hud', talk: 'talk', choice: 'choice', bag: 'bag', make: 'make', almanac: 'hud', quests: 'quests', map: 'map', toast: 'hud', pause: 'pause', settings: 'settings', end: 'end' };

const browser = await launchChrome({
  headless: true,
  args: [],
});
/** Every picture taken, for the sheets. */
const shots = [];
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const [name, arrange] of Object.entries(STATES)) {
      if (only.length && !only.includes(name)) continue;
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      page.setDefaultTimeout(180000);
      page.on('pageerror', (e) => console.log(`  page error ${width} ${name}: ${e}`));
      const show = SHOW[name];
      await page.goto(`http://127.0.0.1:${PORT}/?quality=high${show ? `&show=${show}` : ''}`, { waitUntil: 'load' });
      await page.waitForSelector(show ? '[data-show]' : '.gu-stage-title', { timeout: 180000 });
      const game = (js, arg) => page.evaluate(js, arg);
      const frames = (n = 2) => game((count) => window.__game.frames(count), n);
      if (show) await game(() => window.__game.settle());
      // The fonts and the painted kit load as CSS first asks for them.
      await game(() => document.fonts.ready.then(() => true));
      await page.waitForTimeout(400);
      if (show) await frames(2);
      await arrange({ page, game, frames, width });
      const file = resolve(out, `${name}-${width}.png`);
      await page.screenshot({ path: file });
      console.log(`wrote ${file}`);
      shots.push({ file, width, height });
      await context.close();
    }
  }
  // One page per width with every state on it, three across, to judge the set as one look.
  for (const width of [1440, 390]) {
    const set = shots.filter((shot) => shot.width === width);
    if (set.length === 0) continue;
    const cellW = width > 600 ? 720 : 260, cellH = Math.round(cellW * set[0].height / width), across = width > 600 ? 3 : 5;
    const tiles = await Promise.all(set.map((shot, i) => sharp(shot.file).resize(cellW, cellH).toBuffer().then((input) => ({ input, left: (i % across) * cellW, top: Math.floor(i / across) * cellH }))));
    const sheet = resolve(out, `sheet-${width}.png`);
    await sharp({ create: { width: cellW * Math.min(across, set.length), height: cellH * Math.ceil(set.length / across), channels: 3, background: '#000' } }).composite(tiles).png().toFile(sheet);
    console.log(`wrote ${sheet}`);
  }
} finally {
  await browser.close();
  process.kill(serverPid);
}

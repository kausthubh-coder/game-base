// Build mode in the browser: builds the game, serves it, opens the build lab (`?scene=build`) and works it with
// the real mouse and keys. It tills a field with one drag, plants it, waters it, runs two fences that cross,
// backs a chest onto a wall, shows a sprinkler's reach, picks a chest up again, takes a stroke back, and
// checks that a right click, a lost window and a release over the HUD each end a stroke the right way.
//   bun tools/play-build.mjs [--port 5461] [--dist dist-build] [--no-build] [--shots .artifacts/build]
// It writes a screenshot of each step into the shots folder. This Mac draws WebGL in software, so it checks
// what the game does and draws, never how fast, and never how a real hand feels.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', process.env.PLAY_PORT || '5461'));
const dist = opt('dist', 'dist-build');
const shots = resolve(root, opt('shots', '.artifacts/build'));
mkdirSync(shots, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error(`FAIL: the build into ${dist}`); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving ${dist} on http://127.0.0.1:${PORT}/  pid ${serverPid}`);

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass) });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const errors = [];
let browser;

try {
  browser = await launchChrome({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(240000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);
  const frames = (n = 2) => game((count) => window.__game.frames(count), n);
  const shot = async (name) => {
    await frames(2);
    await page.screenshot({ path: resolve(shots, name) });
    console.log(`     wrote ${resolve(shots, name)}`);
  };

  async function open(query) {
    await page.goto(`http://127.0.0.1:${PORT}/?scene=build&quality=medium${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game?.started && !document.querySelector('.lab-card')?.hidden);
    await game(() => window.__game.settle());
    await frames(3);
  }
  await open('');

  // ---- the scene
  /** The cell the hero stands on. Every cell below is counted from it: east and south are positive. */
  const home = await game(() => { const p = window.__game.state().player; return { x: Math.floor(p.x), y: Math.floor(p.y) - 1, z: Math.floor(p.z) }; });
  const bag = () => game(() => Object.fromEntries(window.__game.view.game.systems.inventory.slots.filter(Boolean).map((s) => [s.id, s.count])));
  const kit = await bag();
  check('the lab opens on the plot with its kit, past the title', kit.hoe === 1 && kit.wheat_seeds === 60 && kit.fence === 60 && kit.chest === 4 && kit.sprinkler === 3, JSON.stringify(kit));
  check('the lab keeps its own save', await game(() => localStorage.getItem('greenhollow.save') === null));
  await shot('01-scene.png');

  /** Where the top of a ground cell is on the page. It fails when the cell is off the picture or under the HUD or the card. */
  async function spot(dx, dz) {
    const at = await game(({ x, y, z }) => window.__game.view.project(x + 0.5, y + 1, z + 0.5), { x: home.x + dx, y: home.y, z: home.z + dz });
    if (!at || at.x < 340 || at.x > 1150 || at.y < 90 || at.y > 740) throw new Error(`cell ${dx}, ${dz} is not clear on the page: ${JSON.stringify(at)}`);
    return at;
  }
  const block = (dx, dy, dz) => game(({ x, y, z }) => window.__game.block(x, y, z).key, { x: home.x + dx, y: home.y + dy, z: home.z + dz });
  /** How many cells of a rectangle have this block. */
  const count = (key, x0, z0, x1, z1, dy = 0) => game(({ key, home, x0, z0, x1, z1, dy }) => {
    let n = 0;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (window.__game.block(home.x + x, home.y + dy, home.z + z).key === key) n++;
    return n;
  }, { key, home, x0, z0, x1, z1, dy });
  const build = () => game(() => {
    const b = window.__game.view.game.systems.build, p = b.plan();
    return { active: b.active, dragging: b.dragging, canUndo: b.canUndo, plan: p && { kind: p.tool.kind, ok: p.ok, short: p.short, refused: p.refused, skip: p.skip, turns: p.turns, cells: p.cells.length, lift: p.lift?.kind ?? null } };
  });
  const tip = () => game(() => { const t = document.querySelector('.bd-tip'); return t && !t.hidden ? t.textContent : ''; });
  const placed = () => game(() => window.__game.view.game.systems.placeables.all().map((p) => ({ kind: p.kind, x: p.x, z: p.z, turns: p.quarterTurns })));

  /** A real left-button drag from one cell to another. `mid` runs with the button still down. */
  async function drag(from, to, mid) {
    const a = await spot(...from), b = await spot(...to);
    await page.mouse.move(a.x, a.y);
    await frames(1);
    await page.mouse.down();
    for (let i = 1; i <= 4; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 4, a.y + ((b.y - a.y) * i) / 4);
    await frames(2);
    if (mid) await mid();
    await page.mouse.up();
    await frames(2);
  }
  const click = async (cell) => drag(cell, cell);
  const hover = async (dx, dz) => { const at = await spot(dx, dz); await page.mouse.move(at.x, at.y); await frames(2); };

  // ---- build mode
  await hover(1, 2);
  check('outside build mode a chip names the key', await game(() => !document.querySelector('.bd-chip').hidden && document.querySelector('.bd-bar').hidden));
  await page.keyboard.press('g');
  await frames(2);
  check('G turns build mode on', (await build()).active && await game(() => !document.querySelector('.bd-bar').hidden));
  await shot('02-build-mode-grid.png');

  // ---- the hoe: one drag tills a field
  let mid = null, words = '';
  await drag([0, 2], [3, 4], async () => { mid = await build(); words = await tip(); await shot('03-till-drag.png'); });
  check('a drag with the hoe plans the whole rectangle', mid.dragging && mid.plan.kind === 'till' && mid.plan.ok === 12, JSON.stringify(mid.plan));
  check('the line by the pointer counts it', words === 'Till 12', words);
  check('letting go tills all of it', await count('tilled_soil', 0, 2, 3, 4) === 12 && !(await build()).dragging);
  await game(() => window.__game.advance(1));
  await shot('04-tilled.png');

  // ---- seeds: a drag over more than the field
  await page.keyboard.press('2');
  await drag([0, 2], [4, 5], async () => { mid = await build(); words = await tip(); await shot('05-plant-drag.png'); });
  check('seeds plan the tilled cells and refuse the grass', mid.plan.kind === 'plant' && mid.plan.ok === 12 && mid.plan.refused === 8, JSON.stringify(mid.plan));
  check('the line counts the seeds', words === 'Plant 12', words);
  const crops = () => game(() => window.__game.view.game.systems.crops.all().length);
  check('letting go plants 12 and takes 12 seeds', await crops() === 12 && (await bag()).wheat_seeds === 48);

  // ---- too few seeds
  await game(() => window.__game.view.game.systems.inventory.remove('wheat_seeds', 46));
  await drag([-6, 2], [-4, 4], async () => { mid = await build(); words = await tip(); await shot('06-short-of-seeds.png'); });
  check('with 2 seeds for 9 cells the plan is 2 and 7 short, and says so', mid.plan.ok === 2 && mid.plan.short === 7 && words === 'Plant 9 · you have 2', `${JSON.stringify(mid.plan)} "${words}"`);
  check('it plants the 2 and no more', await crops() === 14 && (await bag()).wheat_seeds === undefined);

  // ---- the can
  await page.keyboard.press('3');
  await drag([0, 2], [3, 4], async () => { mid = await build(); await shot('07-water-drag.png'); });
  const wet = () => game(() => window.__game.view.game.systems.crops.all().filter((c) => c.state.wet > 0).length);
  check('the can wets the whole field in one drag', mid.plan.kind === 'water' && mid.plan.ok === 12 && await wet() === 12, `${JSON.stringify(mid.plan)} wet ${await wet()}`);

  // ---- fences: a line, and another across it
  await page.keyboard.press('4');
  await drag([-2, -3], [3, -3], async () => { mid = await build(); await shot('08-fence-drag.png'); });
  check('a fence drag is a straight line of 6', mid.plan.kind === 'place' && mid.plan.ok === 6, JSON.stringify(mid.plan));
  await drag([1, -5], [1, -1], async () => { mid = await build(); });
  check('a line across it skips the post that is there', mid.plan.ok === 4 && mid.plan.skip === 1, JSON.stringify(mid.plan));
  check('ten fences stand, and ten left the bag', (await placed()).filter((p) => p.kind === 'fence').length === 10 && (await bag()).fence === 50);
  await hover(4, 0);
  await shot('09-fences-joined.png');

  // ---- a chest by the wall
  await page.keyboard.press('5');
  // The lab's wall runs east to west five blocks north of the hero. The cell south of it backs onto it.
  check('the wall is there', await block(4, 1, -5) === 'oak_plank');
  await hover(4, -4);
  const byWall = await build();
  await shot('10-chest-by-wall.png');
  check('a chest by the wall turns its back to it', byWall.plan.kind === 'place' && byWall.plan.turns === 2 && byWall.plan.ok === 1, JSON.stringify(byWall.plan));
  await page.keyboard.press('r');
  await frames(2);
  check('R turns it a quarter', (await build()).plan.turns === 3);
  await page.keyboard.press('q');
  await frames(2);
  await click([4, -4]);
  check('a click sets it down as it was shown', (await placed()).some((p) => p.kind === 'chest' && p.x === home.x + 4 && p.z === home.z - 4 && p.turns === 2), JSON.stringify(await placed()));

  // ---- a sprinkler, beside the lab's own patch of soil, which nothing has watered
  const wetSoil = () => game(({ home }) => window.__game.view.game.systems.crops.soil().filter((s) => s.wet > 0 && s.x <= home.x - 4).map((s) => s.x - home.x).sort(), { home });
  await page.keyboard.press('6');
  await hover(-3, 3);
  check('the patch is dry before the sprinkler', (await wetSoil()).length === 0);
  await shot('11-sprinkler-reach.png');
  await click([-3, 3]);
  await game(() => window.__game.advance(1));
  // It reaches two blocks: the patch's two near columns, three cells each, and not the far one.
  const reached = await wetSoil();
  check('a sprinkler wets the soil in its reach and no further', (await placed()).some((p) => p.kind === 'sprinkler') && reached.length === 6 && reached.every((dx) => dx === -5 || dx === -4), JSON.stringify(reached));
  await frames(2);
  await shot('11b-sprinkler-placed.png');

  // ---- picking a placed thing up
  await page.keyboard.press('1');
  await hover(4, -4);
  const over = await build();
  words = await tip();
  await shot('12-pick-up.png');
  check('the pointer on a chest offers to pick it up', over.plan.lift === 'chest' && words === 'Click to pick up the chest', `${JSON.stringify(over.plan)} "${words}"`);
  await click([4, -4]);
  check('a click takes it into the hand', !(await placed()).some((p) => p.kind === 'chest') && await game(() => window.__game.view.game.systems.inventory.held()?.id === 'chest'));

  // ---- taking a stroke back
  await page.keyboard.press('1');
  await drag([-3, 0], [-2, 0]);
  check('two more cells are tilled', await count('tilled_soil', -3, 0, -2, 0) === 2 && (await build()).canUndo);
  await page.keyboard.press('z');
  await frames(2);
  check('Z puts them back', await count('grass', -3, 0, -2, 0) === 2 && !(await build()).canUndo);

  // ---- ways a stroke ends without changing anything
  const a = await spot(-3, 0), b = await spot(-1, 0);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await frames(2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await frames(2);
  const afterRight = await build();
  await page.mouse.up();
  await frames(2);
  check('a right click drops the stroke, and the left button coming up after it does nothing', !afterRight.dragging && await count('grass', -3, 0, -1, 0) === 3);

  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await frames(2);
  await game(() => window.dispatchEvent(new Event('blur')));
  await frames(2);
  const afterBlur = await build();
  await page.mouse.up();
  await frames(2);
  check('a window that loses the keys drops the stroke', !afterBlur.dragging && await count('grass', -3, 0, -1, 0) === 3);

  // The pause menu takes the keys in the middle of a stroke. No stroke is left under the pointer when it closes.
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await frames(2);
  await page.keyboard.press('Escape');
  await frames(2);
  const underPause = await build();
  await page.keyboard.press('Escape');
  await frames(3);
  const afterPause = await build();
  await page.mouse.up();
  await frames(2);
  check('the pause menu drops the stroke, and none is left when it closes', !underPause.dragging && !afterPause.dragging && !(await build()).dragging && await count('grass', -3, 0, -1, 0) === 3, `${underPause.dragging} ${afterPause.dragging}`);
  if (!(await build()).active) { await page.keyboard.press('g'); await frames(2); }

  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await frames(2);
  await page.keyboard.press('2');
  await game(() => window.__game.advance(0.1));
  check('picking another item drops the stroke by the next step', !(await build()).dragging);
  await page.mouse.up();
  await page.keyboard.press('1');
  await frames(2);
  check('and nothing was tilled', await count('grass', -3, 0, -1, 0) === 3);

  // The quick slots take clicks of their own. A stroke that ends over them still ends as a stroke.
  const slots = await game(() => { const box = document.querySelector('.gb-hud-slots')?.getBoundingClientRect(); return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null; });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y);
  await frames(2);
  if (slots) await page.mouse.move(slots.x, slots.y);
  await frames(2);
  const overHud = await build();
  await page.mouse.up();
  await frames(2);
  check('a drag that wanders over the quick slots keeps its stroke until the button comes up', slots !== null && overHud.dragging && !(await build()).dragging, JSON.stringify(overHud));
  check('and it tills what it covered when the pointer left the ground', await count('tilled_soil', -3, 0, -1, 0) === 3);

  // ---- the bag, in the middle of building
  await page.keyboard.press('i');
  await frames(3);
  const underBag = await build();
  await page.keyboard.press('i');
  await frames(4);
  check('the bag ends build mode while it is open, and build mode is back when it closes', !underBag.active && (await build()).active, JSON.stringify(underBag));

  // ---- leaving build mode
  await page.keyboard.press('g');
  await frames(2);
  check('G turns build mode off', !(await build()).active && await game(() => document.querySelector('.bd-bar').hidden));
  const before = await count('tilled_soil', -6, -6, 6, 6);
  await drag([2, 0], [3, 1]);
  check('outside build mode a drag paints nothing', await count('tilled_soil', -6, -6, 6, 6) === before);
  await shot('13-after.png');

  // ---- chests as flat sprites
  await game(({ home }) => {
    window.__game.view.game.systems.placeables.place('chest', home.x + 2, home.y + 1, home.z - 1, 2);
    window.__game.save();
  }, { home });
  await open('&chest=sprite');
  check('the lab comes back from its own save', (await placed()).some((p) => p.kind === 'chest') && await count('tilled_soil', 0, 2, 3, 4) === 12);
  await shot('14-chest-as-sprite.png');

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (error) {
  check('the run finished', false, String(error));
  if (errors.length) console.log('console errors:', errors.slice(0, 5).join(' | '));
} finally {
  await browser?.close();
  try { process.kill(serverPid); } catch { /* it stopped by itself */ }
}

const failed = checks.filter((c) => !c.pass);
writeFileSync(resolve(shots, 'build.json'), JSON.stringify({ checks, errors }, null, 2));
console.log(`\n${checks.length - failed.length} of ${checks.length} checks passed. Screenshots are in ${shots}.`);
process.exit(failed.length ? 1 : 0);

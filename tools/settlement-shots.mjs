// Pictures of the settlement in the real game: Hobb and Dax at home on a built-up plot with the tags over their
// door, a settler's card, the Heartstone's next step, the dinner table, and the plot at each step. It plays
// through the debug door: skipTo a quest, set the buildings down, bring the people, open each panel.
//   bun tools/settlement-shots.mjs [--port 5473] [--out .artifacts/settlement] [--only plot,card,heart,dinner,stages]
// Prints the renderer and every console error, and exits 1 on an error.
import { mkdirSync } from 'node:fs';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const port = opt('port', process.env.PLAY_PORT || '5473');
const out = opt('out', '.artifacts/settlement');
const only = opt('only', 'plot,card,heart,dinner,stages').split(',');
mkdirSync(out, { recursive: true });

const browser = await launchChrome({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

async function fresh(quest) {
  await page.goto(`http://localhost:${port}/?skipintro`, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#loading') && '__game' in window, null, { timeout: 120_000 });
  await page.evaluate(() => window.__game.newGame());
  await page.waitForFunction(() => window.__game.started === true, null, { timeout: 60_000 });
  await page.evaluate((q) => { window.__game.manual(true); window.__game.skipTo(q); window.__game.advance(2); }, quest);
}

/** Sets the plot down as the stage asks, in blocks from the grant's north-west corner. */
async function build(list) {
  return page.evaluate((list) => {
    const sys = window.__game.view.game.systems;
    const g = sys.region.grant(), y = sys.region.place('grant.center').at.y;
    const failed = [];
    for (const [kind, dx, dz, turns] of list) if (!sys.placeables.place(kind, g.x + dx, y, g.z + dz, turns ?? 0)) failed.push(kind);
    return failed;
  }, list);
}

async function shot(name, setup) {
  // The Almanac's gift card that a skip leaves up for its few seconds is not part of these pictures.
  await page.evaluate(() => document.querySelectorAll('.st-gift').forEach((card) => card.remove()));
  if (setup) await page.evaluate(setup);
  await page.evaluate(() => window.__game.advance(0.2));
  await page.evaluate(() => window.__game.settle());
  await page.evaluate(() => window.__game.frames(20));
  const file = `${out}/${name}.png`;
  await page.screenshot({ path: file });
  console.log(file);
}

const flags = (pairs) => page.evaluate((pairs) => { for (const [k, v] of pairs) window.__game.view.game.flags.set(k, v); window.__game.advance(1.5); }, pairs);
/** The hero a few blocks south of the plot's middle, the camera on the homes. */
const stand = (dx, dz) => page.evaluate(([dx, dz]) => {
  const g = window.__game.view.game.systems.region.grant();
  window.__game.teleport(g.x + dx, undefined, g.z + dz);
  window.__game.advance(0.5);
}, [dx, dz]);

// The homestead of the kitchen quest: the cottage, the oven and table, a lamp, a dinner table, the beds full.
const HOMESTEAD = [['cottage', 4, 4, 2], ['oven', 12, 5, 2], ['prep_table', 15, 6, 2], ['lantern', 10, 9], ['dinner_table', 11, 12], ['table_bench', 11, 15]];

if (only.includes('plot') || only.includes('card') || only.includes('heart')) {
  await fresh('greywood');
  console.log('failed to place:', await build(HOMESTEAD));
  await flags([['farm.moss.living', true], ['farm.field.living', true]]);
  await page.evaluate(() => window.__game.setTime(0.42));
  await stand(7, 14);
  // Hobb and Dax walk in from the gate to their door.
  await page.evaluate(() => window.__game.advance(25));
  if (only.includes('plot')) await shot('plot-homestead');
  if (only.includes('card')) await shot('card-hobb', () => window.__game.view.game.events.emit('settler.opened', { who: 'hobb' }));
  await page.keyboard.press('Escape');
  if (only.includes('heart')) await shot('heart-next', () => window.__game.view.game.events.emit('heartstone.opened', {}));
  await page.keyboard.press('Escape');
}

if (only.includes('dinner')) {
  await fresh('echo');
  console.log('failed to place:', await build(HOMESTEAD));
  await flags([['fight.5.won', true]]);
  await page.evaluate(() => { window.__game.setTime(0.7); window.__game.advance(2); });
  await stand(12, 17);
  await shot('dinner', () => {
    const sys = window.__game.view.game.systems;
    const placed = sys.placeables.all().find((p) => p.kind === 'dinner_table');
    window.__game.teleport(placed.x + 1, undefined, placed.z - 1);
    window.__game.advance(0.5);
    window.__game.interact();
  });
  await page.evaluate(() => [...document.querySelectorAll('.hp-ask .hp-btn')][0]?.click());
  await shot('dinner-granted');
}

if (only.includes('stages')) {
  // The same plot at camp, homestead and hamlet, from the same spot.
  await fresh('roofs');
  await page.evaluate(() => window.__game.setTime(0.45));
  await stand(14, 24);
  await shot('stage-1-camp');
  console.log('failed to place:', await build(HOMESTEAD));
  await page.evaluate(() => window.__game.advance(2));
  await shot('stage-2-homestead');
  console.log('failed to place:', await build([['cottage', 18, 2, 2], ['map_room', 20, 10, 2], ['lantern', 17, 8], ['lantern', 24, 17], ['smokehouse', 1, 12, 1], ['beast_yard', 2, 20, 2], ['watch_post', 22, 22]]));
  await flags([['fight.5.won', true]]);
  await page.evaluate(() => window.__game.advance(25));
  await shot('stage-3-hamlet');
  console.log('step:', await page.evaluate(() => window.__game.view.game.systems.settlement.step()), 'settlers:', await page.evaluate(() => window.__game.view.game.systems.settlement.settlers().join(' ')));
}

await browser.close();
console.log(errors.length ? 'console errors:\n' + [...new Set(errors)].join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

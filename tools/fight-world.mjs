// Plays one of act 1's fights in the real game, where it happens in the world, and takes its pictures.
//
//   bun tools/fight-world.mjs --port 5944 --fight 2              the rule-made player fights fight 2 at its place
//   bun tools/fight-world.mjs --port 5944 --fight 5 --keys       real keys and the mouse for the first seconds, then the rule-made player
//   bun tools/fight-world.mjs --port 5944 --fight 7 --level perfect
//
// It starts a new game, puts the hero at the fight's place, starts the fight there through the world's door
// (`window.__fights.begin`), and lets the rule-made player fight it, through the same step the hero's body takes.
// With `--keys` it first presses the keys a person would: walk, click to cut, Shift to dodge, and checks each
// did something. Pictures go to `.artifacts/fights/fight-<n>-*.png`. It exits 1 on a console error, a fight
// that does not end won (or denied, for fight 4), or a key that did nothing.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const flag = (name) => argv.includes('--' + name);
const port = opt('port', process.env.PLAY_PORT ?? '5525');
const n = Number(opt('fight', '2')), level = opt('level', 'middle'), keys = flag('keys'), limit = Number(opt('limit', 240));
const base = opt('url', `http://localhost:${port}/`);
const out = resolve(import.meta.dirname, '..', '.artifacts/fights');
mkdirSync(out, { recursive: true });

// Where each fight is: content/greenhollow.ts `FIGHTS`, through `toWorld`.
const WHERE = { 2: [-40, -222], 3: [4, -328], 4: [18, -334], 5: [80, -318], 6: [232, -254], 7: [302, -100], 8: [220, -302], 9: [248, -384], 10: [-270, -238], 11: [18, -334], 12: [50, -426] };
// A keeper and the Stag are fought in rooms the ruins build. Until then the door starts them in their test room
// where the hero stands: open meadow west of the plot.
const ROOM = [-70, -262];
const [x, z] = [7, 9, 10, 12].includes(n) ? ROOM : WHERE[n] ?? WHERE[2];

const browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [], failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const check = (what, ok) => { if (!ok) failed.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const shot = (what) => page.screenshot({ path: resolve(out, `fight-${n}-${what}.png`) });
const state = () => page.evaluate(() => window.__fights.state());
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(`${base}?hold=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game !== undefined, null, { timeout: 90000 });
await page.evaluate(() => window.__game.newGame());
await page.waitForFunction(() => window.__fights && window.__game?.started, null, { timeout: 90000 });
// The quests before the fight's own, skipped: the Heartstone has been seen, the companions have come.
const QUEST = { 2: 'kitchen', 3: 'greywood', 4: 'greywood', 5: 'count', 6: 'pump', 7: 'pump', 8: 'gallery', 9: 'gallery', 10: 'seeds', 11: 'roofs', 12: 'stag' };
await page.evaluate((quest) => window.__game.skipTo(quest), QUEST[n] ?? 'kitchen');
await page.evaluate(([x, z]) => window.__game.teleport(x, z), [x, z + 7]);
await page.evaluate(() => window.__game.settle?.());
if (n === 2) await page.evaluate(() => window.__game.setTime(0.82));
await sleep(1500);
// It may have begun by itself, its step open and the hero near.
check(`fight ${n} begins where the hero stands`, await page.evaluate((n) => window.__fights.begin(n) || window.__fights.state()?.n === n, n));
await sleep(800);
let s = await state();
check('the fight runs, with its beasts or its keeper', !!s && (s.beasts.length > 0 || !!s.keeper || n === 12));
console.log(`  line: ${s?.line}`);
console.log(`  companion: ${s?.companion}; hero ${Math.round(s?.hero.health)} of ${s?.hero.maxHealth}; beasts: ${s?.beasts.map((b) => `${b.kind} depth ${b.depth}`).join(', ')}`);
await shot('start');

if (keys) {
  // A person's keys: walk toward the beast, cut, and dodge. Each must change what the hero does.
  const before = await state();
  await page.keyboard.down('KeyW');
  await sleep(600);
  await page.keyboard.up('KeyW');
  const walked = await state();
  check('W walks the hero in the fight', Math.hypot(walked.hero.x - before.hero.x, walked.hero.z - before.hero.z) > 0.5);
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await sleep(60);
  await page.mouse.up();
  await sleep(120);
  const cut = await state();
  check('a click swings the weapon', cut.record.swings > before.record.swings);
  await sleep(500);
  await page.keyboard.press('ShiftLeft');
  await sleep(80);
  const dodged = await state();
  check('Shift dodges', dodged.record.dodges > before.record.dodges);
  await shot('keys');
}

await page.evaluate((level) => window.__fights.autoplay(level), level);
let shotMid = false, shotCalm = false;
const began = Date.now();
for (;;) {
  await sleep(250);
  s = await state();
  if (!s) break;
  if (!shotMid && s.clock > 3) { await shot('mid'); shotMid = true; }
  if (!shotCalm && s.over >= 0) { await sleep(500); await shot('end'); shotCalm = true; }
  if ((Date.now() - began) / 1000 > limit) break;
}
await sleep(4000);
const fights = await page.evaluate(() => window.__fights.fights());
console.log(`  ended: ${JSON.stringify(await page.evaluate(() => window.__fights.ended()))}`);
const mine = fights.find((f) => f.n === n);
check(n === 4 ? 'fight 4 ends denied' : `fight ${n} ends won`, n === 4 ? mine?.denied : mine?.won);
await sleep(1500);
await shot('after');
const after = await page.evaluate(() => ({ hero: window.__game.state().player, actors: window.__game.state().actors }));
console.log(`  after: hero at ${after.hero.x.toFixed(1)}, ${after.hero.z.toFixed(1)}`);
check('no console errors', errors.length === 0);
for (const e of errors.slice(0, 5)) console.log(`  error: ${e}`);
await browser.close();
console.log(`pictures: ${out}/fight-${n}-*.png`);
process.exit(failed.length ? 1 : 0);

// Plays the fight lab in headless Chrome and says what happened: one fight, start to finish, in the real page.
//
//   bun tools/fight-play.mjs --port 5529 --way hero --beast thistlehog            the rule-made player fights, through the lab's door
//   bun tools/fight-play.mjs --port 5529 --way world --beast boar --layout wall   the world way with no rigs, baiting charges into the wall
//   bun tools/fight-play.mjs --port 5529 --way pet --beast gearling --keys        real keys and mouse only, as a person would press them
//
// It picks the way and the beast with real clicks on the lab's card, plays the fight, answers "Again?", and
// prints the fight's record with the draw calls, triangles and script time it saw. Screenshots go to
// `.artifacts/fight/<name>-*.png`. It exits 1 on a console error, a fight that is not won, or a key that did
// nothing. This Mac's frame rate says nothing about a Chromebook, so none is printed.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const flag = (name) => argv.includes('--' + name);
const port = opt('port', process.env.PLAY_PORT ?? '5525');
const way = opt('way', 'hero'), beast = opt('beast', 'thistlehog'), layout = opt('layout', 'rigs'), quality = opt('quality', 'high');
const keys = flag('keys'), limit = Number(opt('limit', 200));
const base = opt('url', `http://localhost:${port}/`);
const name = opt('name', `${way}-${beast}${keys ? '-keys' : layout === 'wall' ? '-wall' : ''}`);
const out = resolve(import.meta.dirname, '..', '.artifacts/fight');
mkdirSync(out, { recursive: true });

const WAY_BUTTON = { hero: 'Hero', pet: 'Pet', world: 'World' };
const BEAST_BUTTON = { thistlehog: 'Thistlehog', gearling: 'Gearling', boar: 'Boar' };

const browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [], failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const state = () => page.evaluate(() => window.__fight.state());
const shot = (what) => page.screenshot({ path: resolve(out, `${name}-${what}.png`) });
const check = (what, ok) => { if (!ok) failed.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const sleep = (ms) => page.waitForTimeout(ms);
/** Where a point of the arena's ground is on the page. */
const screen = (x, z) => page.evaluate(([x, z]) => window.__fight.screen(x, z), [x, z]);

await page.goto(`${base}?scene=fight&quality=${quality}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fight && window.__game?.started, null, { timeout: 60000 });
await page.evaluate(() => window.__game.settle());
// The log starts empty, so the numbers printed are this fight's alone.
await page.evaluate(() => { localStorage.removeItem('lab.fight.log'); });

await page.click(`.fl-card button:text-is("${WAY_BUTTON[way]}")`);
await page.click(`.fl-card button:text-is("${BEAST_BUTTON[beast]}")`);
let s = await state();
check(`the card picked the way "${way}" and brought in the ${beast}`, s.way === way && s.beast?.kind === beast && s.beast.doing === 'asleep');
await sleep(600);
await shot('start');

/** The most draw calls, triangles and script milliseconds seen while the fight ran. */
const seen = { drawCalls: 0, triangles: 0, scriptMs: 0, simMs: 0, samples: 0, scriptSum: 0 };
async function sample() {
  const c = await page.evaluate(() => window.__game.counters());
  seen.drawCalls = Math.max(seen.drawCalls, c.drawCalls);
  seen.triangles = Math.max(seen.triangles, c.triangles);
  seen.scriptMs = Math.max(seen.scriptMs, c.scriptMs);
  seen.simMs = Math.max(seen.simMs, c.simMs);
  seen.scriptSum += c.scriptMs;
  seen.samples++;
}

/** Holds the walking keys that lead to a point until the hero is within `near` of it, or `ms` passed. */
async function walkTo(x, z, near = 0.6, ms = 9000) {
  const until = Date.now() + ms;
  let held = [];
  while (Date.now() < until) {
    const now = await state();
    if (Math.hypot(now.hero.x - x, now.hero.z - z) <= near) break;
    const want = await page.evaluate(([x, z]) => window.__fight.keysToward(x, z), [x, z]);
    for (const key of held) if (!want.includes(key)) await page.keyboard.up(key);
    for (const key of want) if (!held.includes(key)) await page.keyboard.down(key);
    held = want;
    await sleep(60);
  }
  for (const key of held) await page.keyboard.up(key);
}

async function clickGround(x, z, button = 'left') {
  const at = await screen(x, z);
  if (!at) { check(`the point ${x.toFixed(1)}, ${z.toFixed(1)} is on the page`, false); return; }
  await page.mouse.move(at.x, at.y);
  await page.mouse.down({ button });
  await sleep(40);
  await page.mouse.up({ button });
}

const shots = new Set();
async function shotOnce(what) {
  if (shots.has(what)) return;
  shots.add(what);
  await shot(what);
}

/** Watches a fight that something else plays, and takes a picture of each moment worth seeing. */
async function watch() {
  const from = Date.now();
  while (Date.now() - from < limit * 1000) {
    s = await state();
    await sample();
    if (s.shapes > 0) await shotOnce('tell');
    if (s.beast?.doing === 'dizzy') await shotOnce(s.beast.calm > 0.2 ? 'calming' : 'dizzy');
    if (s.beast?.doing === 'stun' || s.beast?.doing === 'held') await shotOnce('helpless');
    if (s.rigs.length > 0) await shotOnce('rigs');
    if (s.phase === 'won') break;
    await sleep(90);
  }
}

if (!keys) {
  // ---------------------------------------------------------------- the door: the rule-made player fights
  await page.evaluate((layout) => window.__fight.bot(true, layout), layout);
  await watch();
  await page.evaluate(() => window.__fight.bot(false));
} else {
  // ---------------------------------------------------------------- real keys and mouse
  const den = { x: s.beast.x, z: s.beast.z }, start = { x: s.hero.x, z: s.hero.z };
  if (way === 'hero') {
    await walkTo(den.x, den.z + 2.2, 0.5);
    s = await state();
    check('walking up woke the beast', s.beast.doing !== 'asleep');
    const before = s.record;
    await page.keyboard.press('ShiftLeft');
    await sleep(500);
    s = await state();
    check('Shift dodged', s.record.dodges === before.dodges + 1);
    await walkTo(s.beast.x, s.beast.z + 1.6, 0.5);
    // Hold the button for a charged spin: one cut at the press, the spin at the release.
    s = await state();
    const swings = s.record.swings;
    let at = await screen(s.beast.x, s.beast.z);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await sleep(900);
    await page.mouse.up();
    await sleep(300);
    s = await state();
    check('holding the button made a cut and a charged spin', s.record.swings === swings + 2);
    await page.keyboard.press('KeyC');
    await sleep(200);
    s = await state();
    check("C called the pet's pounce", s.record.skills === 1);
    // Then cut it down: walk back in whenever a hit pushed the hero off, and click.
    const from = Date.now();
    while (Date.now() - from < limit * 1000) {
      s = await state();
      await sample();
      if (s.shapes > 0) await shotOnce('tell');
      if (s.beast.doing === 'dizzy' || s.phase === 'won') break;
      if (Math.hypot(s.hero.x - s.beast.x, s.hero.z - s.beast.z) > 2.4) await walkTo(s.beast.x, s.beast.z, 2);
      at = await screen(s.beast.x, s.beast.z);
      if (at) { await page.mouse.move(at.x, at.y); await page.mouse.down(); await sleep(30); await page.mouse.up(); }
      await sleep(120);
    }
  } else if (way === 'pet') {
    // Stand where the lab starts and throw at the beast. The first click on it is also the order.
    let at = await screen(den.x, den.z);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await sleep(40);
    await page.mouse.up();
    await sleep(700);
    s = await state();
    check('a click on the beast sent the pet and threw light', s.record.orders === 1 && s.record.throws === 1 && s.pet.mode === 'engage');
    await page.mouse.down({ button: 'right' });
    await sleep(40);
    await page.mouse.up({ button: 'right' });
    await sleep(300);
    s = await state();
    check('a right click whistled the pet back', s.record.whistles === 1 && s.pet.mode !== 'engage');
    await page.keyboard.press('ShiftLeft');
    await sleep(500);
    s = await state();
    check('Shift dodged', s.record.dodges === 1);
    await clickGround(s.beast.x, s.beast.z);
    await sleep(500);
    await page.keyboard.press('KeyC');
    await sleep(300);
    await page.keyboard.press('KeyT');
    await sleep(300);
    s = await state();
    check('C and T called two skills', s.record.skills === 2);
    const from = Date.now();
    while (Date.now() - from < limit * 1000) {
      s = await state();
      await sample();
      if (s.shapes > 0) await shotOnce('tell');
      if (s.beast.doing === 'dizzy' || s.phase === 'won') break;
      // Keep the distance, and keep the light flying.
      if (Math.hypot(s.hero.x - s.beast.x, s.hero.z - s.beast.z) < 4.5) await walkTo(start.x, start.z + 4, 1.5, 1500);
      await clickGround(s.beast.x, s.beast.z);
      await sleep(350);
    }
  } else {
    // 1, 2 and 3 take a rig in hand and a click sets it down, in a row south of the den. Z takes one back.
    const cells = [[1, den.z + 3], [2, den.z + 5], [3, den.z + 7]];
    await walkTo(den.x, den.z + 7.5, 0.6);
    for (const [key, z] of cells) {
      await page.keyboard.press(`Digit${key}`);
      await sleep(120);
      if (key === 1) { await clickGround(den.x, z); await sleep(100); await shot('ghost'); await page.keyboard.press(`Digit${key}`); await sleep(100); }
      // Rig 1 is the lamp, which goes last in the row, nearest the hero.
      await clickGround(den.x, key === 1 ? den.z + 7 : key === 2 ? den.z + 3 : den.z + 5);
      await sleep(150);
    }
    s = await state();
    check('three rigs stand after 1, 2, 3 and three clicks', s.rigs.length === 3);
    await page.keyboard.press('KeyZ');
    await sleep(150);
    s = await state();
    check('Z took the last rig back', s.rigs.length === 2);
    await page.keyboard.press('Digit3');
    await sleep(120);
    await clickGround(den.x, den.z + 5);
    await sleep(150);
    s = await state();
    check('and it could be set down again', s.rigs.length === 3 && s.held === null);
    await shot('rigs');
    await walkTo(den.x, den.z + 9.5, 0.6);
    await page.keyboard.press('KeyE');
    await sleep(200);
    s = await state();
    check('E woke the beast', s.beast.doing !== 'asleep' && s.phase === 'fight');
    await page.keyboard.press('KeyC');
    await sleep(200);
    s = await state();
    check('C sent the pet out as a lure', s.record.skills === 1 && s.pet.mode === 'lure');
    const from = Date.now();
    while (Date.now() - from < limit * 1000) {
      s = await state();
      await sample();
      if (s.shapes > 0) await shotOnce('tell');
      if (s.beast.doing === 'held' || s.beast.doing === 'stun') await shotOnce('helpless');
      if (s.beast.doing === 'dizzy' || s.phase === 'won') break;
      // Step back south when it comes close, so it keeps walking down the row.
      if (Math.hypot(s.hero.x - s.beast.x, s.hero.z - s.beast.z) < 3.2) await walkTo(s.hero.x, s.hero.z + 3, 0.8, 900);
      await sleep(100);
    }
  }
  // Every way ends the same: walk up to the dizzy beast and hold F.
  s = await state();
  check('the guard was emptied with keys and mouse alone', s.beast.doing === 'dizzy' || s.phase === 'won');
  for (let tries = 0; tries < 6 && s.phase !== 'won'; tries++) {
    await shotOnce('dizzy');
    await walkTo(s.beast.x, s.beast.z, 2.6, 4000);
    await page.keyboard.down('KeyF');
    await sleep(600);
    await shotOnce('calming');
    await sleep(700);
    await page.keyboard.up('KeyF');
    s = await state();
    if (s.phase !== 'won' && s.beast.doing !== 'dizzy') {
      // It came round before the Mark was held long enough. Let the rules finish emptying it and try again.
      await page.evaluate((layout) => window.__fight.bot(true, layout), layout);
      const from = Date.now();
      while (Date.now() - from < 60000) { s = await state(); if (s.beast.doing === 'dizzy' || s.phase === 'won') break; await sleep(100); }
      await page.evaluate(() => window.__fight.bot(false));
      failed.push('the beast came round before it was calmed, and the bot had to empty it again');
    }
  }
}

s = await state();
check('the fight was won', s.phase === 'won' && s.record.result === 'calmed');
await sleep(700);
await shot('colors-return');
await page.waitForSelector('.fl-again:not([hidden])', { timeout: 8000 }).catch(() => undefined);
await sleep(300);
await shot('again');
const asked = await page.locator('.fl-again:not([hidden])').count();
check('the lab asked "Again?"', asked === 1);
if (asked) {
  await page.click('.fl-rate button:nth-child(4)');
  const log = await page.evaluate(() => window.__fight.log());
  check('the answer was kept with the fight', log.length === 1 && log[0].again === 4 && log[0].way === way && log[0].enemy === beast && log[0].length > 0);
  const lines = await page.locator('.fl-checks tr').allInnerTexts();
  console.log('\nchecks on the card:\n  ' + lines.map((line) => line.replace(/\s*\t\s*/g, ' | ')).join('\n  '));
}
const game = await page.evaluate(() => { const g = window.__game.state(); return { viewErrors: g.viewErrors, failed: g.failed, sprites: g.sprites, quality: g.quality }; });
check('no view or system of the game failed', game.viewErrors.length === 0 && Object.keys(game.failed).length === 0);
const standIns = await page.evaluate(() => window.__fight.standIns());
const r = s.record;
console.log('\nrecord:', JSON.stringify({ way: r.way, enemy: r.enemy, result: r.result, seconds: +r.length.toFixed(1), setup: +r.setup.toFixed(1), hitsTaken: r.hitsTaken, hitBy: r.hitBy, faints: r.faints, swings: r.swings, whiffs: r.whiffs, dodges: r.dodges, inputs: r.inputs, longestGap: +r.longestGap.toFixed(1), throws: r.throws, orders: `${r.ordersInTime}/${r.orders}`, whistles: r.whistles, petHits: r.petHits, petFaints: r.petFaints, rigs: `${r.rigsTriggered}/${r.rigsPlaced}`, crashes: r.crashes, layout: r.layout }));
console.log(`drawn at quality ${game.quality} on ${browser.gameRenderer}: at most ${seen.drawCalls} draw calls, ${seen.triangles} triangles, ${seen.scriptMs.toFixed(2)} ms of script a frame (mean ${(seen.scriptSum / Math.max(1, seen.samples)).toFixed(2)}), ${seen.simMs.toFixed(2)} ms of rules, over ${seen.samples} samples`);
console.log('stand-in art:', standIns.join(', ') || 'none');
console.log(`pictures: ${out}/${name}-*.png`);
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
process.exit(errors.length || failed.length ? 1 : 0);

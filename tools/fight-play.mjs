// Plays the fight lab in headless Chrome and says what happened: one fight, start to finish, in the real page.
//
//   bun tools/fight-play.mjs --port 5529 --way hero --beast thistlehog            the rule-made player fights, through the lab's door
//   bun tools/fight-play.mjs --port 5529 --way world --beast boar --layout wall   the world way with no rigs, baiting charges into the wall
//   bun tools/fight-play.mjs --port 5529 --way pet --beast gearling --keys        real keys and mouse only, as a person would press them
//   bun tools/fight-play.mjs --url http://127.0.0.1:5529/ --log                   a built copy, with the page sending its fights to fight-log
//   bun tools/fight-play.mjs --port 5529 --way pet --beast boar --pet pebblepup --keys   the second pet: its brace takes an attack for the hero
//
// `--quality low`, `medium` or `high` holds a quality level (high by default). `--log` adds `&log=1`, which
// only `tools/fight-serve.mjs` answers: it checks that the fight and its answer reached `.artifacts/fight/ratings.jsonl`.
//
// It picks the way and the beast with real clicks on the lab's card, plays the fight, answers "Again?", and
// prints the fight's record with the draw calls, triangles and script time it saw. Screenshots go to
// `.artifacts/fight/<name>-*.png`. It exits 1 on a console error, a fight that is not won, or a key that did
// nothing. This Mac's frame rate says nothing about a Chromebook, so none is printed.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const flag = (name) => argv.includes('--' + name);
const port = opt('port', process.env.PLAY_PORT ?? '5525');
const way = opt('way', 'hero'), beast = opt('beast', 'thistlehog'), layout = opt('layout', 'rigs'), quality = opt('quality', 'high');
const keys = flag('keys'), limit = Number(opt('limit', 200)), sends = flag('log'), pet = opt('pet', 'leaftail');
const base = opt('url', `http://localhost:${port}/`);
const name = opt('name', `${way}-${beast}${pet === 'leaftail' ? '' : `-${pet}`}${keys ? '-keys' : layout === 'wall' ? '-wall' : ''}`);
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
/** When the scene has settled enough to measure: set once the fight starts. */
let settledAt = Infinity;
const shot = (what) => page.screenshot({ path: resolve(out, `${name}-${what}.png`) });
const check = (what, ok) => { if (!ok) failed.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const sleep = (ms) => page.waitForTimeout(ms);
/** Where a point of the arena's ground is on the page. */
const screen = (x, z) => page.evaluate(([x, z]) => window.__fight.screen(x, z), [x, z]);

await page.goto(`${base}?scene=fight&quality=${quality}${sends ? '&log=1' : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fight && window.__game?.started, null, { timeout: 60000 });
await page.evaluate(() => window.__game.settle());
// The log starts empty, so the numbers printed are this fight's alone.
await page.evaluate(() => { localStorage.removeItem('lab.fight.log'); });

await page.click(`.fl-card button:text-is("${WAY_BUTTON[way]}")`);
await page.selectOption('.fl-card select:has(option[value="leaftail"])', pet);
await page.click(`.fl-card button:text-is("${BEAST_BUTTON[beast]}")`);
let s = await state();
check(`the card picked the way "${way}" and the ${pet}, and brought in the ${beast}`, s.way === way && s.pet.kind === pet && s.beast?.kind === beast && s.beast.doing === 'asleep');
await sleep(600);
await shot('start');
settledAt = Date.now() + 2500;

/**
 * The most draw calls, triangles and script milliseconds seen while the fight ran, once the scene has settled.
 * The game's meter gives script time as a mean over the last 2 seconds, so the first 2.5 seconds after the
 * fight starts are left out: they still hold the page loading. The peak is the worst of those 2-second means.
 */
const seen = { drawCalls: 0, triangles: 0, scriptMs: 0, simMs: 0, samples: 0, scriptSum: 0 };
/** The same, through the moment of calming that plays after the fight is won. */
const calming = { drawCalls: 0, triangles: 0, scriptMs: 0, simMs: 0, samples: 0, scriptSum: 0 };
async function sample(into = seen) {
  if (Date.now() < settledAt) return;
  const c = await page.evaluate(() => window.__game.counters());
  const seen = into;
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
    // Mid-dodge: the cool tint and the two afterimages.
    await sleep(120);
    await shot('dodge');
    await sleep(380);
    s = await state();
    check('Shift dodged', s.record.dodges === before.dodges + 1);
    await walkTo(s.beast.x, s.beast.z + 1.6, 0.5);
    // Hold the button for a charged spin: one cut at the press, the spin at the release. A hit on the hero drops
    // a charge, so it is held while the beast stands open after an attack, as a person would wait for it.
    s = await state();
    for (const until = Date.now() + 10000; Date.now() < until && !(s.beast.doing === 'recover' && s.hero.act === 'none'); s = await state()) await sleep(40);
    const swings = s.record.swings;
    let at = await screen(s.beast.x, s.beast.z);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await sleep(800);
    await shot('charged');
    await sleep(100);
    await page.mouse.up();
    // The spin as it lands: the pale ring on the ground and the shake.
    await sleep(60);
    await shot('spin');
    await sleep(240);
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
      // Walk back in whenever it is out of reach, and cut only when it is in reach: a person does not swing at air.
      const reach = 2.2 + (s.beast.kind === 'boar' ? 1.3 : 0.5);
      if (Math.hypot(s.hero.x - s.beast.x, s.hero.z - s.beast.z) > reach) { await walkTo(s.beast.x, s.beast.z, reach - 0.4, 3000); continue; }
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
    if (pet === 'pebblepup') {
      // The brace: stand where the beast's next attack will land, and press C as its shape shows. The pebblepup
      // plants itself between the hero and the beast and takes the attack on its back.
      const from = Date.now();
      while (Date.now() - from < 60000 && s.record.blocks === 0 && s.beast.doing !== 'dizzy') {
        s = await state();
        await sample();
        if (s.pet.mode === 'brace') await shotOnce('brace');
        const rested = await page.evaluate(() => (window.__fight.fight.skill(0)?.left ?? 1) <= 0);
        if (s.shapes > 0 && rested && s.pet.mode !== 'down') {
          await page.keyboard.press('KeyC');
          await sleep(150);
          await shotOnce('brace');
          await sleep(1200);
          continue;
        }
        const near = s.beast.kind === 'boar' ? 3 : 1.8;
        if (Math.hypot(s.hero.x - s.beast.x, s.hero.z - s.beast.z) > near + 0.6) await walkTo(s.beast.x, s.beast.z + near, 0.5, 1200);
        else await sleep(60);
      }
      s = await state();
      check('the pebblepup braced and took an attack on its back for the hero', s.record.blocks >= 1);
    }
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
    // Rig 1 is the lamp, which goes last in the row, nearest the hero. Then the snare nearest the den, then the plate.
    const cells = [[1, den.z + 7], [2, den.z + 3], [3, den.z + 5]];
    await walkTo(den.x, den.z + 7.5, 0.6);
    for (const [key, z] of cells) {
      await page.keyboard.press(`Digit${key}`);
      await sleep(120);
      if (key === 1) {
        // The rig in the hand, over a free cell and over one too near the beast, before it is set down.
        const free = await screen(den.x, den.z + 5), near = await screen(den.x, den.z + 1);
        await page.mouse.move(free.x, free.y);
        await sleep(150);
        await shot('ghost');
        await page.mouse.move(near.x, near.y);
        await sleep(150);
        await shot('ghost-refused');
      }
      await clickGround(den.x, z);
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
// The moment of calming: the grey running out, then the bow, the green and the gift. The meter's 2-second
// mean is sampled through it.
for (const until = Date.now() + 700; Date.now() < until;) { await sample(calming); await sleep(80); }
await shot('colors-return');
for (const until = Date.now() + 1300; Date.now() < until;) { await sample(calming); await sleep(80); }
await shot('bow');
for (const until = Date.now() + 1400; Date.now() < until;) { await sample(calming); await sleep(80); }
await page.waitForSelector('.fl-again:not([hidden])', { timeout: 8000 }).catch(() => undefined);
await sleep(300);
await shot('again');
const asked = await page.locator('.fl-again:not([hidden])').count();
check('the lab asked "Again?"', asked === 1);
if (asked) {
  await page.click('.fl-rate button:nth-child(4)');
  const log = await page.evaluate(() => window.__fight.log());
  check('the answer was kept with the fight', log.length === 1 && log[0].again === 4 && log[0].way === way && log[0].enemy === beast && log[0].length > 0);
  if (sends) {
    // The page posts the fight when it ends and again with its answer. The server appends each as a line.
    const ratings = resolve(out, 'ratings.jsonl');
    let line = null;
    for (let tries = 0; tries < 20 && !line; tries++) {
      await sleep(150);
      const kept = existsSync(ratings) ? readFileSync(ratings, 'utf8').trim().split('\n').filter(Boolean).map((text) => JSON.parse(text)) : [];
      line = kept.findLast((f) => f.at === log[0]?.at && f.again === 4) ?? null;
    }
    check('the fight and its answer reached .artifacts/fight/ratings.jsonl', line !== null && line.way === way && line.enemy === beast);
    if (line) console.log('ratings.jsonl:', JSON.stringify({ at: line.at, way: line.way, enemy: line.enemy, result: line.result, seconds: +line.length.toFixed(1), again: line.again }));
  }
  const lines = await page.locator('.fl-checks tr').allInnerTexts();
  console.log('\nchecks on the card:\n  ' + lines.map((line) => line.replace(/\s*\t\s*/g, ' | ')).join('\n  '));
}
const game = await page.evaluate(() => { const g = window.__game.state(); return { viewErrors: g.viewErrors, failed: g.failed, sprites: g.sprites, quality: g.quality }; });
check('no view or system of the game failed', game.viewErrors.length === 0 && Object.keys(game.failed).length === 0);
const standIns = await page.evaluate(() => window.__fight.standIns());
const r = s.record;
console.log('\nrecord:', JSON.stringify({ way: r.way, enemy: r.enemy, pet: r.pet, result: r.result, seconds: +r.length.toFixed(1), setup: +r.setup.toFixed(1), hitsTaken: r.hitsTaken, hitBy: r.hitBy, faints: r.faints, swings: r.swings, whiffs: r.whiffs, dodges: r.dodges, inputs: r.inputs, longestGap: +r.longestGap.toFixed(1), throws: r.throws, orders: `${r.ordersInTime}/${r.orders}`, whistles: r.whistles, blocks: r.blocks, petHits: r.petHits, petFaints: r.petFaints, rigs: `${r.rigsTriggered}/${r.rigsPlaced}`, crashes: r.crashes, layout: r.layout }));
console.log(`drawn at quality ${game.quality} on ${browser.gameRenderer}, once settled: at most ${seen.drawCalls} draw calls, ${seen.triangles} triangles, script ${(seen.scriptSum / Math.max(1, seen.samples)).toFixed(2)} ms a frame on average and ${seen.scriptMs.toFixed(2)} ms in the worst 2 seconds, ${seen.simMs.toFixed(2)} ms of rules, over ${seen.samples} samples`);
console.log(`through the calming: at most ${calming.drawCalls} draw calls, ${calming.triangles} triangles, script ${(calming.scriptSum / Math.max(1, calming.samples)).toFixed(2)} ms a frame on average and ${calming.scriptMs.toFixed(2)} ms in the worst 2 seconds, over ${calming.samples} samples`);
console.log('stand-in art:', standIns.join(', ') || 'none');
console.log(`pictures: ${out}/${name}-*.png`);
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
process.exit(errors.length || failed.length ? 1 : 0);

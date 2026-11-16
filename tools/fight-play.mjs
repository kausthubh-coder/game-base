// Plays the fight lab in headless Chrome and says what happened: one fight, start to finish, in the real page.
//
//   bun tools/fight-play.mjs --port 5531 --weapon bow --beast boar                     the rule-made player fights, through the lab's door
//   bun tools/fight-play.mjs --port 5531 --weapon staff --companion lanternfly --beast boar --also boar   two beasts at once
//   bun tools/fight-play.mjs --port 5531 --weapon sword --beast thistlehog --keys       real keys and mouse only, as a person would press them
//   bun tools/fight-play.mjs --port 5531 --traps --beast boar [--layout wall] [--keys]  the traps, as at milestone 3
//   bun tools/fight-play.mjs --port 5531 --card                                        the card itself, with real clicks and keys
//   bun tools/fight-play.mjs --url http://127.0.0.1:5533/ --weapon bow --beast gearling a built copy
//   bun tools/fight-play.mjs --port 5531 --scene stag [--keys]                          the Verdant Stag's hall (tools/fight-play-stag.mjs)
//
// `--quality low`, `medium` or `high` holds a quality level (high by default). `--level middle` or `clumsy` lets a
// rule-made player that is not perfect fight. `--log` adds `&log=1`, which only `tools/fight-serve.mjs` answers: it
// checks that the fight reached `.artifacts/fight/ratings.jsonl`. Never use it while a copy is out for Kausthubh.
//
// It picks the weapon, the companion and the beasts with real clicks on the lab's card, plays the fight, and
// reads the card after it. It prints the fight's record with the draw calls, triangles and script time it saw.
// Screenshots go to `.artifacts/fight/<name>-*.png`. It exits 1 on a console error, a fight that is not won, or a
// key that did nothing. This Mac's frame rate says nothing about a Chromebook, so none is printed.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

// `--scene stag` plays the Verdant Stag's hall instead: tools/fight-play-stag.mjs. It ends the process itself.
if (process.argv[process.argv.indexOf('--scene') + 1] === 'stag' && process.argv.includes('--scene')) await import('./fight-play-stag.mjs');

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const flag = (name) => argv.includes('--' + name);
const port = opt('port', process.env.PLAY_PORT ?? '5525');
const traps = flag('traps'), weapon = opt('weapon', 'sword'), companion = opt('companion', 'leaftail');
const beast = opt('beast', 'thistlehog'), also = opt('also', ''), layout = opt('layout', 'rigs'), quality = opt('quality', 'high'), level = opt('level', 'perfect');
const keys = flag('keys'), card = flag('card'), limit = Number(opt('limit', 400)), sends = flag('log');
const base = opt('url', `http://localhost:${port}/`);
const foes = also ? `${beast}+${also}` : beast;
const name = opt('name', card ? 'card' : traps ? `traps-${beast}${keys ? '-keys' : layout === 'wall' ? '-wall' : ''}` : `${weapon}-${companion}-${foes.replace('+', '-')}${keys ? '-keys' : level !== 'perfect' ? `-${level}` : ''}${quality !== 'high' ? `-${quality}` : ''}`);
const out = resolve(import.meta.dirname, '..', '.artifacts/fight');
mkdirSync(out, { recursive: true });

const NAMES = { sword: 'Sword', bow: 'Bow', staff: 'Staff', leaftail: 'Leaftail', pebblepup: 'Pebblepup', lanternfly: 'Lanternfly', mossling: 'Mossling', thistlehog: 'Thistlehog', gearling: 'Gearling', boar: 'Boar' };

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

const folded = () => page.evaluate(() => document.querySelector('.fl-card').classList.contains('is-small'));
/** A button on the card whose first line is this name. */
const cardButton = (text) => page.locator('.fl-card button').filter({ hasText: new RegExp(`^${text}`) }).first();
const pairSelect = '.fl-card select:has(option[value="boar"])';
if (card) await cardRun();

// ---------------------------------------------------------------- the card picks the fight, with real clicks
if (traps) {
  await cardButton('Traps').click();
} else {
  await cardButton(NAMES[weapon]).click();
  await cardButton(NAMES[companion]).click();
}
await page.selectOption(pairSelect, also || '').catch(() => undefined);
await cardButton(NAMES[beast]).click();
let s = await state();
check(traps
  ? `the card picked the traps and brought in the ${beast}`
  : `the card picked the ${weapon} and the ${companion}, and brought in ${foes}`,
traps ? s.way === 'world' && s.beast?.kind === beast : s.way === 'hero' && s.hero.weapon === weapon && s.companion.kind === companion && s.beasts.map((b) => b.kind).join('+') === foes && s.beasts.every((b) => b.doing === 'asleep'));
await sleep(600);
await shot('start');
settledAt = Date.now() + 2500;
/** The card folds itself when the beast wakes. A bot run opens it by hand and it stays open; a key run leaves it folded. */
let foldChecked = false;
async function checkFold() {
  if (foldChecked || s.phase !== 'fight') return;
  foldChecked = true;
  await sleep(100);
  check('the card folded itself when the beast woke', await folded());
  if (!keys) {
    await page.click('.fl-card h2 button');
    await sleep(1200);
    check('opened by hand during the fight, it stays open', !(await folded()));
  }
}

/**
 * The most draw calls, triangles and script milliseconds seen while the fight ran, once the scene has settled, and
 * their means. The game's meter gives script time as a mean over the last 2 seconds, so the first 2.5 seconds
 * after the fight starts are left out: they still hold the page loading. The worst is the worst of those 2-second means.
 */
const blank = () => ({ drawCalls: 0, triangles: 0, scriptMs: 0, simMs: 0, samples: 0, scriptSum: 0, drawSum: 0, triSum: 0 });
const seen = blank(), calming = blank();
async function sample(into = seen) {
  if (Date.now() < settledAt) return;
  const c = await page.evaluate(() => window.__game.counters());
  into.drawCalls = Math.max(into.drawCalls, c.drawCalls);
  into.triangles = Math.max(into.triangles, c.triangles);
  into.scriptMs = Math.max(into.scriptMs, c.scriptMs);
  into.simMs = Math.max(into.simMs, c.simMs);
  into.scriptSum += c.scriptMs;
  into.drawSum += c.drawCalls;
  into.triSum += c.triangles;
  into.samples++;
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

/** Pictures of the moments worth seeing, whoever plays: shapes, attacks by name, the companion's job, the weapon. */
async function moments() {
  if (s.shapes > 0) await shotOnce('tell');
  for (const b of s.beasts) {
    if (b.doing === 'windup' && b.attack) await shotOnce(`tell-${b.kind}-${b.attack}`);
    if (b.doing === 'dizzy') await shotOnce(b.calm > 0.2 ? 'calming' : 'dizzy');
    if (b.doing === 'stun' || b.doing === 'held') await shotOnce('helpless');
    if (b.enraged) await shotOnce(`enraged-${b.kind}`);
    if (b.slow > 0.5) await shotOnce('slowed');
  }
  if (s.rigs.length > 0) await shotOnce('rigs');
  if (s.shots > 0) await shotOnce('shot');
  if (s.hero.charge > 0.5) await shotOnce(`${s.hero.weapon}-held`);
  if (s.hero.act === 'burst') await shotOnce('staff-burst');
  if (s.companion.healing) await shotOnce('companion-healing');
  if (s.hero.strong) await shotOnce('companion-strong');
  if (s.hero.bloom > 0) await shotOnce('companion-bloom');
  if (s.companion.mode === 'brace') await shotOnce('companion-brace');
  if (s.companion.role === 'guard' && s.phase === 'fight' && s.companion.mode === 'heel') await shotOnce('companion-guard');
  if (s.companion.strikeT > 0) await shotOnce('companion-strike');
}

/** Watches a fight that something else plays. */
async function watch() {
  const from = Date.now();
  while (Date.now() - from < limit * 1000) {
    s = await state();
    await sample();
    await checkFold();
    await moments();
    if (s.phase === 'won') break;
    await sleep(90);
  }
}

/** The nearest beast that is not calmed, from the hero. */
const target = () => s.beasts.filter((b) => b.doing !== 'calmed').sort((a, b) => Math.hypot(a.x - s.hero.x, a.z - s.hero.z) - Math.hypot(b.x - s.hero.x, b.z - s.hero.z))[0];

/** One click on a point, held for `ms`. */
async function press(at, ms = 30) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
}

if (!keys) {
  // ---------------------------------------------------------------- the door: the rule-made player fights
  await page.evaluate(([layout, level]) => window.__fight.bot(true, layout, level), [layout, level]);
  await watch();
  await page.evaluate(() => window.__fight.bot(false));
} else if (traps) {
  // ---------------------------------------------------------------- the traps, by real keys and mouse
  const den = { x: s.beast.x, z: s.beast.z };
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
  check('C sent the companion out as a lure', s.record.skills === 1 && s.companion.mode === 'lure');
  const from = Date.now();
  while (Date.now() - from < limit * 1000) {
    s = await state();
    await sample();
    await moments();
    if (s.beast.doing === 'dizzy' || s.phase === 'won') break;
    // Step back south when it comes close, so it keeps walking down the row.
    if (Math.hypot(s.hero.x - s.beast.x, s.hero.z - s.beast.z) < 3.2) await walkTo(s.hero.x, s.hero.z + 3, 0.8, 900);
    await sleep(100);
  }
} else {
  // ---------------------------------------------------------------- the fight, by real keys and mouse
  const first = s.beasts[0];
  // Walk up until it wakes.
  await walkTo(first.x, first.z + 4.5, 0.6);
  s = await state();
  check('walking up woke the beast', s.beasts.every((b) => b.doing !== 'asleep'));
  const before = s.record;
  await page.keyboard.press('ShiftLeft');
  // Mid-dodge: the cool tint and the two afterimages.
  await sleep(120);
  await shot('dodge');
  await sleep(380);
  s = await state();
  check('Shift dodged', s.record.dodges === before.dodges + 1);

  // 1, 2 and 3 change the weapon in the middle of a fight, and back.
  const keyOf = { sword: 'Digit1', bow: 'Digit2', staff: 'Digit3' };
  const other = weapon === 'bow' ? 'staff' : 'bow';
  await page.keyboard.press(keyOf[other]);
  await sleep(120);
  s = await state();
  check(`${keyOf[other].slice(5)} took the ${other} in hand mid-fight, with a moment before it can attack`, s.hero.weapon === other && s.hero.swap > 0);
  await page.keyboard.press(keyOf[weapon]);
  await sleep(500);
  s = await state();
  check(`${keyOf[weapon].slice(5)} took the ${weapon} back`, s.hero.weapon === weapon);

  // The held move, once, at a beast standing open after an attack: hold the button, let go.
  const reach = weapon === 'sword' ? 1.8 : weapon === 'bow' ? 7 : 5.5;
  const close = async () => {
    s = await state();
    const b = target();
    if (!b) return;
    const d = Math.hypot(s.hero.x - b.x, s.hero.z - b.z) - (b.kind === 'boar' ? 1.3 : 0.5);
    if (weapon === 'sword' ? d > reach : d > reach + 2) await walkTo(b.x, b.z, reach + (b.kind === 'boar' ? 1.3 : 0.5) - 0.3, 2500);
    else if (weapon !== 'sword' && d < reach - 2.5) await walkTo(s.hero.x + (s.hero.x - b.x), s.hero.z + (s.hero.z - b.z), 1.2, 900);
  };
  await close();
  s = await state();
  for (const until = Date.now() + 15000; Date.now() < until && !(s.beasts.some((b) => b.doing === 'recover' || b.doing === 'stun') && s.hero.act === 'none'); s = await state()) await sleep(40);
  const swings = s.record.swings;
  let b = target(), at = await screen(b.x, b.z);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await sleep(weapon === 'sword' ? 800 : 950);
  s = await state();
  await shot(`${weapon}-held`);
  const charged = s.hero.charged;
  await page.mouse.up();
  await sleep(weapon === 'staff' ? 180 : 60);
  await shot(weapon === 'sword' ? 'spin' : weapon === 'bow' ? 'drawn' : 'staff-burst');
  await sleep(300);
  s = await state();
  check(`holding the button made a ${weapon === 'sword' ? 'cut and a charged spin' : weapon === 'bow' ? 'quick arrow and a drawn shot' : 'bolt and a burst'}`, charged && s.record.swings === swings + 2);

  // The companion's skill on C. The healer's needs the hero hurt first.
  const skills = s.record.skills;
  if (companion !== 'lanternfly') {
    await page.keyboard.press('KeyC');
    await sleep(250);
    s = await state();
    check(`C called the ${companion}'s skill`, s.record.skills === skills + 1);
  }
  let calledHeal = false;
  // Then fight it down: keep the weapon's distance, aim at the nearest beast, and click.
  const from = Date.now();
  while (Date.now() - from < limit * 1000) {
    s = await state();
    await sample();
    await moments();
    if (s.phase === 'won' || s.beasts.some((x) => x.doing === 'dizzy')) break;
    if (companion === 'lanternfly' && !calledHeal && s.hero.health < 90 && s.companion.rest <= 0) { await page.keyboard.press('KeyC'); calledHeal = true; await sleep(100); continue; }
    b = target();
    if (!b) break;
    const d = Math.hypot(s.hero.x - b.x, s.hero.z - b.z) - (b.kind === 'boar' ? 1.3 : 0.5);
    if ((weapon === 'sword' && d > reach + 0.4) || (weapon !== 'sword' && d > reach + 3)) { await close(); continue; }
    if (weapon !== 'sword' && d < 2.5) { await walkTo(s.hero.x + (s.hero.x - b.x) * 2, s.hero.z + (s.hero.z - b.z) * 2, 1, 700); continue; }
    at = await screen(b.x, b.z);
    if (at) await press(at);
    await sleep(weapon === 'sword' ? 120 : 220);
  }
  if (companion === 'lanternfly') {
    s = await state();
    check('C called the lanternfly\'s mend once the hero was hurt', calledHeal ? s.record.skills >= skills + 1 : s.record.hitsTaken === 0);
  }
}

if (keys) {
  // Every fight ends the same: walk up to each dizzy beast and hold F.
  s = await state();
  await checkFold();
  check('a guard was emptied with keys and mouse alone', s.beasts.some((b) => b.doing === 'dizzy') || s.phase === 'won');
  for (let tries = 0; tries < 10 && s.phase !== 'won'; tries++) {
    const dizzy = s.beasts.find((b) => b.doing === 'dizzy');
    if (dizzy) {
      await shotOnce('dizzy');
      await walkTo(dizzy.x, dizzy.z, 2.6, 4000);
      await page.keyboard.down('KeyF');
      await sleep(600);
      await shotOnce('calming');
      await sleep(700);
      await page.keyboard.up('KeyF');
      s = await state();
      if (s.phase === 'won') break;
      if (s.beasts.some((b) => b.id === dizzy.id && b.doing === 'calmed')) continue;
    }
    // Another beast still stands, or this one came round before the hold was done: the rules finish emptying it.
    if (!dizzy || s.beasts.some((b) => b.id === dizzy.id && b.doing !== 'dizzy' && b.doing !== 'calmed')) {
      if (dizzy) failed.push('a beast came round before it was calmed, and the bot had to empty it again');
      await page.evaluate((layout) => window.__fight.bot(true, layout), layout);
      const from = Date.now();
      while (Date.now() - from < 90000) { s = await state(); if (s.beasts.some((b) => b.doing === 'dizzy') || s.phase === 'won') break; await sleep(100); }
      await page.evaluate(() => window.__fight.bot(false));
    }
    s = await state();
  }
}

/**
 * The card, with real clicks and keys: the card after a fight belongs to one fight and offers it again, the card
 * folds for a fight and opens after it, the Log button counts a fight that was left, the weapon and companion
 * buttons and the pair select work, the traps have their own button, and Esc puts a rig back before it pauses.
 */
async function cardRun() {
  let s;
  const again = page.locator('.fl-again:not([hidden])');
  /** The rule-made player wins one fight; the card is read by hand. */
  async function win() {
    await page.evaluate(() => window.__fight.bot(true));
    await page.waitForSelector('.fl-again:not([hidden])', { timeout: 120000 });
    await page.evaluate(() => window.__fight.bot(false));
  }
  await cardButton('Sword').click();
  await cardButton('Leaftail').click();
  await cardButton('Thistlehog').click();
  await win();
  check('the card opened again when the fight ended', !(await folded()));
  const lines = await page.locator('.fl-again .fl-lines p').allInnerTexts();
  check(`the card after the fight says what happened in a few lines: "${lines.join(' / ')}"`, lines.length >= 3 && /^The thistlehog, calmed in \d/.test(lines[0] ?? '') && /hit you|Nothing hit you/.test(lines[1] ?? '') && /health/.test(lines[2] ?? ''));
  check('it asks for no rating', (await page.locator('.fl-again .fl-rate, .fl-again button:text-is("4")').count()) === 0);
  await cardButton('Boar').click();
  await sleep(100);
  check('the card after the fight closed when another beast was brought in', (await again.count()) === 0);

  // A weapon, a companion and two beasts at once, then "Fight it again".
  await cardButton('Staff').click();
  await cardButton('Lanternfly').click();
  await page.selectOption(pairSelect, 'gearling');
  await cardButton('Thistlehog').click();
  s = await state();
  check('the pair select brought in a thistlehog and a gearling at once', s.beasts.map((b) => b.kind).join('+') === 'thistlehog+gearling');
  check('the staff and the lanternfly are on the card and in the fight', s.hero.weapon === 'staff' && s.companion.kind === 'lanternfly' && (await cardButton('Staff').getAttribute('class'))?.includes('is-on') && (await cardButton('Lanternfly').getAttribute('class'))?.includes('is-on'));
  await win();
  await shot('again');
  const named = await page.evaluate(() => window.__fight.log().at(-1));
  await page.locator('.fl-again button').getByText('Fight it again', { exact: true }).click();
  s = await state();
  check(`"Fight it again" started the fight the card names again (${named.weapon}, ${named.companion}, ${named.enemy})`, s.hero.weapon === named.weapon && s.companion.kind === named.companion && s.beasts.map((b) => b.kind).join('+') === named.enemy && s.beasts.every((b) => b.doing === 'asleep'));
  check('the log keeps the weapon and the companion of every fight', (await page.evaluate(() => window.__fight.log())).every((f) => f.weapon && f.companion));

  const count = async () => Number((await page.locator('.fl-card button').filter({ hasText: /^Log/ }).innerText()).match(/\d+/)?.[0]);
  await cardButton('Wake it').click();
  await sleep(200);
  check('the card folded itself when the beast woke', await folded());
  await shot('folded');
  await page.click('.fl-card h2 button');
  // A new weapon mid-fight is taken in hand and the fight goes on.
  await cardButton('Bow').click();
  s = await state();
  check('a new weapon from the card mid-fight is taken in hand, and the fight goes on', s.hero.weapon === 'bow' && s.phase === 'fight');
  await cardButton('Take it away').click();
  await sleep(100);
  const logged = await page.evaluate(() => window.__fight.log());
  check('the Log button counts the fight that was left', (await count()) === logged.length && logged.at(-1)?.result === 'left');
  await page.locator('.fl-card button').filter({ hasText: /^Log/ }).click();
  await sleep(200);
  await shot('log');
  check('the log shows weapon and companion columns', (await page.locator('.fl-log th').allInnerTexts()).join(',').includes('Weapon,Companion'));
  await page.locator('.fl-log button').getByText('Close', { exact: true }).click();

  // The traps, behind their own button.
  await cardButton('Traps').click();
  await cardButton('Boar').click();
  s = await state();
  check('the Traps button opens the traps', s.way === 'world' && s.beast?.kind === 'boar');
  check('the pair select is hidden in the traps', !(await page.locator(pairSelect).isVisible()));
  await page.keyboard.press('Digit2');
  await sleep(100);
  const paused = () => page.evaluate(() => window.__game.state().paused ?? [...document.querySelectorAll('.gu-panel')].some((e) => e.offsetParent !== null && /Resume/.test(e.textContent)));
  await page.keyboard.press('Escape');
  await sleep(300);
  s = await state();
  check('Esc with a rig in the hand put it back and did not pause', s.held === null && !(await paused()));
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Esc with nothing in the hand paused', await paused());
  await shot('paused');
  await page.keyboard.press('Escape');
  await sleep(300);
  check('and Esc again closed the pause menu', !(await paused()));
  await cardButton('Sword').click();
  s = await state();
  check('a weapon button from the traps goes back to the fight', s.way === 'hero' && s.hero.weapon === 'sword');

  await browser.close();
  console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
  if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
  process.exit(errors.length || failed.length ? 1 : 0);
}

s = await state();
check('the fight was won', s.phase === 'won' && s.record.result === 'calmed');
// The moment of calming: the grey running out, then the bow, the green and the gift. The meter's 2-second
// mean is sampled through it.
for (const until = Date.now() + 700; Date.now() < until;) { await sample(calming); await sleep(80); }
await shot('colors-return');
for (const until = Date.now() + 1300; Date.now() < until;) { await sample(calming); await sleep(80); }
await shot('calm-bow');
for (const until = Date.now() + 1400; Date.now() < until;) { await sample(calming); await sleep(80); }
await page.waitForSelector('.fl-again:not([hidden])', { timeout: 8000 }).catch(() => undefined);
await sleep(300);
await shot('again');
const asked = await page.locator('.fl-again:not([hidden])').count();
check('the card after the fight showed', asked === 1);
if (keys) check('the card opened again when the fight ended', !(await folded()));
if (asked) {
  const lines = await page.locator('.fl-again .fl-lines p').allInnerTexts();
  console.log('\nthe card after the fight:\n  ' + lines.join('\n  '));
  const log = await page.evaluate(() => window.__fight.log());
  check('the fight is in the log with its weapon and companion', log.length === 1 && log[0].enemy === (traps ? beast : foes) && log[0].length > 0 && (traps ? log[0].way === 'world' : log[0].weapon === weapon && log[0].companion === companion));
  if (sends) {
    // The page posts the fight when it ends. The server appends it as a line.
    const ratings = resolve(out, 'ratings.jsonl');
    let line = null;
    for (let tries = 0; tries < 20 && !line; tries++) {
      await sleep(150);
      const kept = existsSync(ratings) ? readFileSync(ratings, 'utf8').trim().split('\n').filter(Boolean).map((text) => JSON.parse(text)) : [];
      line = kept.findLast((f) => f.at === log[0]?.at) ?? null;
    }
    check('the fight reached .artifacts/fight/ratings.jsonl', line !== null && line.enemy === log[0].enemy);
  }
  // "Fight it again" brings the same fight back.
  await page.locator('.fl-again button').getByText('Fight it again', { exact: true }).click();
  await sleep(200);
  const back = await state();
  check('"Fight it again" brought the same beasts back asleep', back.beasts.map((b) => b.kind).join('+') === (traps ? beast : foes) && back.beasts.every((b) => b.doing === 'asleep') && (traps || back.hero.weapon === weapon));
}
const game = await page.evaluate(() => { const g = window.__game.state(); return { viewErrors: g.viewErrors, failed: g.failed, sprites: g.sprites, quality: g.quality }; });
check('no view or system of the game failed', game.viewErrors.length === 0 && Object.keys(game.failed).length === 0);
const standIns = await page.evaluate(() => window.__fight.standIns());
const r = s.record;
console.log('\nrecord:', JSON.stringify({ way: r.way, enemy: r.enemy, weapon: r.weapon, weapons: r.weapons, companion: r.companion, result: r.result, seconds: +r.length.toFixed(1), hitsTaken: r.hitsTaken, hitBy: r.hitBy, healthLost: Math.round(r.healthLost), faints: r.faints, swings: r.swings, whiffs: r.whiffs, shots: r.shots, shotHits: r.shotHits, dodges: r.dodges, swaps: r.swaps, skills: r.skills, blocks: r.blocks, guarded: r.guarded, healed: Math.round(r.healed), strongHits: r.strongHits, rigs: `${r.rigsTriggered}/${r.rigsPlaced}`, crashes: r.crashes }));
const n = Math.max(1, seen.samples);
console.log(`drawn at quality ${game.quality} on ${browser.gameRenderer}, once settled: draw calls ${Math.round(seen.drawSum / n)} on average and at most ${seen.drawCalls}, triangles ${Math.round(seen.triSum / n)} on average and at most ${seen.triangles}, script ${(seen.scriptSum / n).toFixed(2)} ms a frame on average and ${seen.scriptMs.toFixed(2)} ms in the worst 2 seconds, ${seen.simMs.toFixed(2)} ms of rules, over ${seen.samples} samples`);
console.log(`through the calming: at most ${calming.drawCalls} draw calls, ${calming.triangles} triangles, script ${(calming.scriptSum / Math.max(1, calming.samples)).toFixed(2)} ms a frame on average and ${calming.scriptMs.toFixed(2)} ms in the worst 2 seconds, over ${calming.samples} samples`);
console.log('stand-in art:', standIns.join(', ') || 'none');
console.log(`pictures: ${out}/${name}-*.png`);
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
process.exit(errors.length || failed.length ? 1 : 0);

// Every pose of every fighter in the fight lab, at the game's own zoom, on one sheet per fighter. It holds the
// rules still through the lab's door (`__fight.hold`), sets each state by hand, and photographs the fighter.
//
//   bun tools/fight-poses.mjs --port 5531                  every fighter
//   bun tools/fight-poses.mjs --port 5531 --only hero      one: hero, leaftail, pebblepup, thistlehog, gearling, boar
//
// Pictures go to `.artifacts/fight/poses/<fighter>.png`: one row per state, one frame per column, each labelled.
// It exits 1 on a console error. `--quality` holds a quality level (high by default).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const port = opt('port', process.env.PLAY_PORT ?? '5525'), only = opt('only', ''), quality = opt('quality', 'high');
const base = opt('url', `http://localhost:${port}/`);
const out = resolve(import.meta.dirname, '..', '.artifacts/fight/poses');
mkdirSync(out, { recursive: true });

const browser = await launchChrome({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(`${base}?scene=fight&quality=${quality}&way=hero`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fight && window.__game?.started, null, { timeout: 60000 });
await page.evaluate(() => window.__game.settle());
// The card and the game's own panels stay out of the pictures.
await page.addStyleTag({ content: '.fl-card, .fl-bars, .fl-skills, .fl-beast { visibility: hidden !important }' });

/**
 * Sets the fight up for one picture: `who` is placed at the arena's middle, facing `view` (front, side, back or
 * left), and `set` changes its state in the page. The rules hold still, so the state stays as set.
 */
async function pose(who, set, arg = null) {
  await page.evaluate(([who, set, arg]) => {
    const door = window.__fight, f = door.fight, b = f.beasts[0], h = f.hero, p = f.pet;
    // Where the camera is, read off the page: the ground direction that runs down the screen faces the camera.
    const at = (x, z) => door.screen(x, z) ?? { x: 0, y: 0 };
    const facingFor = (x, z, view) => {
      let best = 0, score = -Infinity;
      const here = at(x, z);
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2, there = at(x + Math.sin(a), z - Math.cos(a));
        const s = view === 'front' ? there.y - here.y : view === 'back' ? here.y - there.y : view === 'side' ? there.x - here.x : here.x - there.x;
        if (s > score) { score = s; best = a; }
      }
      return best;
    };
    window.__poseFacing = facingFor;
    // eslint-disable-next-line no-new-func
    new Function('door', 'f', 'b', 'h', 'p', 'arg', 'facingFor', set)(door, f, b, h, p, arg, facingFor);
  }, [who, set, arg]);
}

/** A picture of the ground around (x, z), `w` by `h` pixels, standing on that point. */
async function clip(x, z, w, h) {
  const at = await page.evaluate(([x, z]) => window.__fight.screen(x, z), [x, z]);
  return page.screenshot({ clip: { x: Math.round(at.x - w / 2), y: Math.round(at.y - h * 0.8), width: w, height: h } });
}

const FACINGS = ['front', 'side', 'back'];

/** One fighter: a list of rows, each a list of [label, setup] at three facings or one. */
async function sheet(name, rows, where, size) {
  const cells = [];
  for (const row of rows) {
    const line = [];
    for (const [label, set, views = FACINGS] of row) {
      for (const view of views) {
        await pose(name, set, view);
        await sleep(260);
        const spot = await page.evaluate(where);
        const png = await clip(spot.x, spot.z, size[0], size[1]);
        line.push({ label: views.length > 1 ? `${label} · ${view}` : label, png: png.toString('base64') });
      }
    }
    cells.push(line);
  }
  const html = `<body style="margin:0;background:#20261f;font:12px system-ui;color:#eee"><table style="border-spacing:4px">${cells
    .map((line) => `<tr>${line.map((c) => `<td style="vertical-align:top"><div>${c.label}</div><img src="data:image/png;base64,${c.png}" style="display:block;width:${size[0] * 2}px;image-rendering:pixelated"></td>`).join('')}</tr>`)
    .join('')}</table></body>`;
  const view = await browser.newPage();
  await view.setContent(html);
  await view.waitForTimeout(100);
  const file = resolve(out, `${name}.png`);
  await view.screenshot({ path: file, fullPage: true });
  await view.close();
  console.log(`${name}: ${file}`);
}

/** The JS that turns a fighter to face `arg` (front, side, back) at its own spot. */
const turnHero = "h.facing = facingFor(h.x, h.z, arg);";
const turnBeast = "b.facing = facingFor(b.x, b.z, arg);";
const turnPet = "p.facing = facingFor(p.x, p.z, arg);";

/** Brings a beast in, holds the rules, and puts the hero, the pet and the beast where the pictures want them. */
async function setStage(kind, pet = 'leaftail') {
  await page.evaluate(([kind, pet]) => {
    const door = window.__fight, f = door.fight;
    door.hold(false);
    f.setPet(pet);
    f.bring(kind);
    door.hold(true);
  }, [kind, pet]);
  await sleep(300);
}

async function heroSheet() {
  await setStage('thistlehog');
  // The hero stands away from the den, so the beast is out of its pictures.
  await page.evaluate(() => {
    const f = window.__fight.fight, b = f.beasts[0];
    window.__game.teleport(b.x - 6, b.z + 4);
    f.hero.x = b.x - 6; f.hero.z = b.z + 4;
    f.pet.x = b.x - 9; f.pet.z = b.z + 8;
  });
  await sleep(400);
  const act = (a, t, more = '') => `h.act='${a}'; h.t=${t}; h.cuts=1; h.charge=0; h.safe=0; ${more} ${turnHero}`;
  await sheet('hero', [
    [['stand', act('none', 0)]],
    [['cut 1 t=.05', act('cut', 0.05)], ['cut 1 t=.10 (lands)', act('cut', 0.1)]],
    [['cut 1 t=.18', act('cut', 0.18)], ['cut 1 t=.35', act('cut', 0.35)]],
    [['cut 2 t=.05', act('cut', 0.05, 'h.cuts=2;')], ['cut 2 t=.10', act('cut', 0.1, 'h.cuts=2;')]],
    [['charging', act('none', 0, 'h.charge=0.7;')], ['spin t=.05', act('spin', 0.05)], ['spin t=.2', act('spin', 0.2)]],
    [['dodge', act('dodge', 0.1)], ['hurt', act('hurt', 0.1)], ['safe after a hit', act('none', 0, 'h.safe=0.4;')]],
    [['reach t=.1', act('calm', 0.1)], ['calm t=.5', act('calm', 0.5)]],
    [['throw t=.03', act('throw', 0.03)], ['throw t=.12', act('throw', 0.12)], ['whistle', act('whistle', 0.1)]],
    [['faint t=.1', act('faint', 0.1), ['front']], ['faint t=1', act('faint', 1), ['front', 'side']]],
  ], () => ({ x: window.__fight.fight.hero.x, z: window.__fight.fight.hero.z }), [100, 110]);
}

async function petSheet(kind) {
  await setStage('thistlehog', kind);
  await page.evaluate(() => {
    const f = window.__fight.fight, b = f.beasts[0];
    window.__game.teleport(b.x - 9, b.z + 7);
    f.pet.x = b.x - 5; f.pet.z = b.z + 4;
  });
  await sleep(400);
  const mode = (m, more = '') => `p.mode='${m}'; p.strikeT=0; p.hurtT=0; p.moving=false; ${more} ${turnPet}`;
  await sheet(kind, [
    [['heel', mode('heel')], ['run', mode('engage', 'p.moving=true;')]],
    [['strike t=.05', mode('engage', 'p.strikeT=0.05;')], ['strike t=.15', mode('engage', 'p.strikeT=0.15;')]],
    [['brace', mode('brace')], ['hurt', mode('engage', 'p.hurtT=0.1;')]],
    [['fainted', mode('down')], ['lure', mode('lure')]],
  ], () => ({ x: window.__fight.fight.pet.x, z: window.__fight.fight.pet.z }), [90, 80]);
}

async function beastSheet(kind) {
  await setStage(kind);
  await page.evaluate(() => {
    const f = window.__fight.fight, b = f.beasts[0];
    window.__game.teleport(b.x - 10, b.z + 8);
    f.pet.x = b.x - 12; f.pet.z = b.z + 9;
  });
  await sleep(400);
  const atk = (i) => `b.attack = b.def.attacks[${i}] ?? b.def.attacks[0];`;
  const doing = (d, t, until, more = '') => `b.doing='${d}'; b.t=${t}; b.until=${until}; b.attack=null; b.moving=false; b.calm=0; b.marks=0; ${more} ${turnBeast}`;
  const big = kind === 'boar';
  const attacks = await page.evaluate(() => window.__fight.fight.beasts[0].def.attacks.map((a) => a.id));
  await sheet(kind, [
    [['asleep', doing('asleep', 0, 0), ['front']], ['alert', doing('alert', 0.2, 0.8), ['front']], ['walk', doing('stalk', 0, 0, 'b.moving=true;'), ['front', 'side']]],
    ...attacks.map((id, i) => [[`tell ${id} k=.2`, doing('windup', 0.2, 1, atk(i)), ['front', 'side']], [`tell ${id} k=.9`, doing('windup', 0.9, 1, atk(i)), ['front', 'side']]]),
    [['charge', doing('charge', 0.1, 0, atk(0))], ['recover t=.1', doing('recover', 0.1, 1.4), ['front']], ['recover t=.8', doing('recover', 0.8, 1.4), ['front']]],
    [['dizzy', doing('dizzy', 0.5, 3)], ['stun', doing('stun', 0.5, 1.5), ['front']], ['held', doing('held', 0.5, 2.5), ['front']]],
    [['dizzy, hold half', doing('dizzy', 0.5, 3, 'b.calm=0.5;'), ['front']], ['dizzy, 3 marks', doing('dizzy', 0.5, 3, 'b.marks=3;'), ['front']], ['marks', doing('stalk', 0, 0, 'b.marks=2;'), ['front']]],
    [['flung', doing('flung', 0.2, 0.4), ['front']], ['calmed', doing('calmed', 0, 0)]],
  ], () => ({ x: window.__fight.fight.beasts[0].x, z: window.__fight.fight.beasts[0].z }), big ? [220, 170] : [110, 100]);
}

const want = (n) => !only || only === n;
if (want('hero')) await heroSheet();
for (const pet of ['leaftail', 'pebblepup']) if (want(pet)) await petSheet(pet);
for (const beast of ['thistlehog', 'gearling', 'boar']) if (want(beast)) await beastSheet(beast);
await page.evaluate(() => window.__fight.hold(false));
writeFileSync(resolve(out, 'console.txt'), errors.join('\n'));
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

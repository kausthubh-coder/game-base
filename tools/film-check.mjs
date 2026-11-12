// Plays a film in Chrome the way a player meets it, with real keys, and checks what the rules are left with.
//   bun tools/film-check.mjs [--url http://localhost:$PORT] [--scene 9] [--skips 3,15]
// 1. `?scene=` plays the film from start to end. Play resumes: the hero stands by the fire, the fox at the
//    edge of the light, and when the hero walks the fox follows.
// 2. A reload after the film does not play it again.
// 3. Esc at each second of `--skips` leaves the same world as watching to the end.
// Prints one line a check and exits 1 when one fails or the page logged an error.
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const base = opt('url', `http://localhost:${process.env.PORT ?? 5300}`).replace(/\/$/, '');
const scene = opt('scene', '9');
const skips = opt('skips', '3,15').split(',').map(Number);
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

const browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
let failed = 0;
const check = (ok, what) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };

async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?scene=${scene}`, { waitUntil: 'load' });
  return { context, page };
}

/** Waits for the film to be on screen, and returns the page's clock then. */
const filmOn = (page) => page.waitForFunction(() => {
  const film = document.querySelector('.sf-cinema');
  return film && !film.hidden ? performance.now() : false;
}).then((h) => h.jsonValue());
const filmOff = (page) => page.waitForFunction(() => document.querySelector('.sf-cinema')?.hidden === true && !window.__game.state().paused);

/** The world as the rules have it: the hero, the fox, the hour, the night's flags. */
const world = (page) => page.evaluate(() => {
  const s = window.__game.state(), fox = window.__game.view.game.systems.hall?.fox() ?? null;
  const place = (name) => window.__game.view.game.systems.region.place(name).at;
  return {
    hero: { x: s.player.x, z: s.player.z, facing: s.player.facing, busy: s.player.busy },
    fox: fox && { x: fox.x, z: fox.z },
    fireShown: document.querySelector('.sf-cinema')?.hidden,
    time: s.clock.timeOfDay, film: s.flags['cut.scene' + new URLSearchParams(location.search).get('scene')],
    step: s.flags['quest.night.step'], seat: place('camp.seat'), edge: place('camp.edge'),
  };
});
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---- 1. watched to the end
const { context, page } = await open();
const on = await filmOn(page);
await filmOff(page);
const seconds = (await page.evaluate(() => performance.now()) - on) / 1000;
await delay(600);
const watched = await world(page);
check(seconds > 23 && seconds < 30, `the film played from start to end in ${seconds.toFixed(1)} s of the page's clock`);
check(far(watched.hero, watched.seat) < 0.3, `play resumes with the hero by the fire, ${far(watched.hero, watched.seat).toFixed(2)} from camp.seat`);
check(watched.fox !== null && far(watched.fox, watched.edge) < 0.3, `the fox stands at the edge of the light, ${watched.fox ? far(watched.fox, watched.edge).toFixed(2) : 'no fox'} from camp.edge`);
check(!watched.hero.busy && watched.step === 'door', `the player has the keys and the night is on its step "${watched.step}"`);
// The hero walks north, toward the stone door, backing away from the fox; the fox follows.
await page.keyboard.down('KeyW');
await delay(1400);
await page.keyboard.up('KeyW');
await delay(2500);
const walked = await world(page);
check(far(walked.hero, watched.hero) > 1.5, `the hero walked ${far(walked.hero, watched.hero).toFixed(1)} blocks`);
check(walked.fox !== null && far(walked.fox, watched.fox) > 0.5, `the fox followed: it moved ${walked.fox ? far(walked.fox, watched.fox).toFixed(1) : '-'} blocks, now ${walked.fox ? far(walked.fox, walked.hero).toFixed(1) : '-'} from the hero`);

// ---- 2. a reload does not play it again
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__game?.state().started === true);
await delay(3000);
const again = await page.evaluate(() => ({ film: !document.querySelector('.sf-cinema')?.hidden, paused: window.__game.state().paused }));
check(!again.film && !again.paused, 'a reload after the film continues the save and does not play the film again');
await context.close();

// ---- 3. Esc at a moment leaves the same world
for (const at of skips) {
  const run = await open();
  const start = await filmOn(run.page);
  const now = await run.page.evaluate(() => performance.now());
  await delay(Math.max(0, at * 1000 - (now - start)));
  await run.page.keyboard.press('Escape');
  await filmOff(run.page);
  await delay(600);
  const skipped = await world(run.page);
  const same = far(skipped.hero, watched.hero) < 0.05 && Math.abs(skipped.hero.facing - watched.hero.facing) < 0.01
    && skipped.fox !== null && far(skipped.fox, watched.fox) < 0.05 && Math.abs(skipped.time - watched.time) < 0.002 && skipped.film === watched.film;
  check(same, `Esc at ${at} s leaves the same world as watching: hero ${skipped.hero.x.toFixed(2)},${skipped.hero.z.toFixed(2)} facing ${skipped.hero.facing.toFixed(2)} `
    + `(watched ${watched.hero.x.toFixed(2)},${watched.hero.z.toFixed(2)} facing ${watched.hero.facing.toFixed(2)}), fox ${skipped.fox ? `${skipped.fox.x.toFixed(2)},${skipped.fox.z.toFixed(2)}` : 'none'}, hour ${skipped.time.toFixed(4)} (watched ${watched.time.toFixed(4)})`);
  await run.context.close();
}

await browser.close();
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
process.exit(failed || errors.length ? 1 : 0);

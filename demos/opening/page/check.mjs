// Checks the lab page the way a script uses it: switching the cut while the film plays keeps the film's time
// and keeps it playing, and a way that fails to load is named on the stage while the rest of the film draws.
//   bun demos/opening/page/check.mjs <port>     (with `bun tools/demo.mjs dev opening <port>` running)
// Exits 1 when a check fails. Pictures go to .artifacts/opening/page/.
import { launchChrome } from '../../../tools/lib/chrome.mjs';

const port = process.argv[2];
if (!port) { console.error('usage: bun demos/opening/page/check.mjs <port>'); process.exit(2); }
const base = `http://127.0.0.1:${port}/`;
const out = new URL('../../../.artifacts/opening/page/', import.meta.url).pathname;
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++; };

const browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// 1. Switch while playing.
{
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?cut=plates&shot=friends&p=0.2`);
  await page.waitForFunction(() => window.__opening?.ready);
  const run = await page.evaluate(async () => {
    const o = window.__opening;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    o.play();
    await wait(1000);
    const before = o.time();
    const clock = performance.now();
    await o.setCut('cutout');
    const after = o.time();
    const took = (performance.now() - clock) / 1000;
    const cutAfter = o.cut;
    const playingAfter = o.playing;
    await wait(1000);
    const later = o.time();
    await o.setCut('plates');
    const back = o.time();
    o.pause();
    return { before, after, took, cutAfter, playingAfter, later, back, cutBack: o.cut, address: location.search };
  });
  console.log(`  played to ${run.before.toFixed(2)} s, setCut('cutout') took ${run.took.toFixed(3)} s and left the film at ${run.after.toFixed(2)} s, ${run.later.toFixed(2)} s a second later, ${run.back.toFixed(2)} s back on plates`);
  check(run.cutAfter === 'cutout' && run.cutBack === 'plates', 'setCut changes the cut on screen');
  check(run.after >= run.before && run.after - run.before <= run.took + 0.1, 'the film time carries on across the switch, not back to 0 or a shot start');
  check(run.playingAfter && run.later - run.after > 0.8, 'the film keeps playing through the switch');
  check(run.address.includes('cut=plates'), 'the address names the cut on screen');
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await page.close();
}

// 2. A way that fails to load. The drawn way's module is refused, so mix-drawn has no legend.
{
  const page = await context.newPage();
  await page.route('**/drawn/index.ts*', (route) => route.abort());
  await page.goto(`${base}?cut=mix-drawn&t=12`);
  await page.waitForFunction(() => window.__opening?.ready);
  const legend = await page.evaluate(() => ({ failures: window.__opening.failures(), notice: document.querySelector('.notice:not([hidden])')?.textContent ?? '' }));
  await page.screenshot({ path: `${out}failed-way.png` });
  check(legend.failures.some((f) => f.way === 'drawn'), 'failures() names the drawn way');
  check(legend.notice.includes('Drawn by code did not load'), `the stage says so by name: "${legend.notice.slice(0, 60)}"`);
  await page.evaluate(() => window.__opening.seek(62));
  const you = await page.evaluate(() => ({ notice: !!document.querySelector('.notice:not([hidden])'), way: document.querySelector('canvas[data-way="engine"]')?.style.opacity }));
  check(!you.notice && you.way === '1', 'the shots the other way draws still play');
  await page.evaluate(() => window.__opening.setCut('plates'));
  const other = await page.evaluate(() => ({ cut: window.__opening.cut, failures: window.__opening.failures().length, notice: !!document.querySelector('.notice:not([hidden])') }));
  check(other.cut === 'plates' && other.failures === 0 && !other.notice, 'another cut still plays');
  await page.close();
}

await browser.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);

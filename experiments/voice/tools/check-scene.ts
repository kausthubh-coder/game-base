// Plays the whole voiced scene in headless Chrome with auto-advance on and checks every line:
// its audio plays to the end, the words finish typing, and the next line follows.
//   bun experiments/voice/tools/check-scene.ts [url]       (the server must be running)
// Exits 1 on a console error or a line that did not play. Nobody hears it: this checks the timing only.
import { chromium } from 'playwright-core';
import { SCENES } from '../scene/lines.ts';

const url = process.argv[2] ?? 'http://localhost:5381/scene';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.click('#play');

type State = { scene: string; line: number; whole: boolean; playing: boolean; time: number; text: string };
const seen = new Map<string, { maxTime: number; whole: boolean; firstPlay: number | null; start: number }>();
const t0 = Date.now();
const total = SCENES.reduce((n, s) => n + s.lines.length, 0);
let last = '';
while (Date.now() - t0 < 6 * 60_000) {
  const s = (await page.evaluate('window.__scene.state()')) as State;
  const k = `${s.scene}-${s.line}`;
  if (k !== last) {
    seen.set(k, { maxTime: 0, whole: false, firstPlay: null, start: Date.now() });
    last = k;
  }
  const e = seen.get(k)!;
  e.maxTime = Math.max(e.maxTime, s.time);
  e.whole ||= s.whole;
  if (e.firstPlay === null && s.time > 0) e.firstPlay = Date.now() - e.start;
  if (s.scene === SCENES.at(-1)!.id && s.line === SCENES.at(-1)!.lines.length - 1 && s.whole) break;
  if (s.scene === 'stone' && s.line === 0 && Date.now() - t0 > 20_000) break; // stuck
  await page.waitForTimeout(100);
}
await page.screenshot({ path: '.artifacts/voice/scene-end.png' });
await browser.close();

const made = JSON.parse(await Bun.file(new URL('../audio/lines.json', import.meta.url)).text()).lines;
const problems: string[] = [];
for (const scene of SCENES) {
  scene.lines.forEach((line, i) => {
    const k = `${scene.id}-${i}`;
    const e = seen.get(k);
    if (!e) return void problems.push(`${k}: never shown`);
    if (line.by === 'narrator' || line.by === 'player') return;
    const want = made[k].seconds;
    const ok = e.maxTime >= want - 0.25 && e.whole;
    console.log(`${k.padEnd(10)} played ${e.maxTime.toFixed(2)} of ${want.toFixed(2)} s, sound after ${e.firstPlay ?? '-'} ms${ok ? '' : '  <-- PROBLEM'}`);
    if (!ok) problems.push(`${k}: played ${e.maxTime.toFixed(2)} of ${want.toFixed(2)} s, whole ${e.whole}`);
  });
}
console.log(`${seen.size} of ${total} lines shown in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const p of [...problems, ...errors]) console.log('FAIL', p);
process.exit(problems.length || errors.length ? 1 : 0);

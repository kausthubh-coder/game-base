// Opens a page in headless Chrome, takes a screenshot and reports console errors.
//   bun tools/shot.mjs <url> <out.png> [--w 1440] [--h 900] [--wait 1500] [--scheme dark] [--eval "js to run before the shot"]
// Exits 1 when the page logged an error. This Mac draws WebGL in software, so a frame can take a second:
// use it to check what is drawn, never to measure frame rate.
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const [url, out] = args;
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
if (!url || !out) { console.error('usage: bun tools/shot.mjs <url> <out.png> [--w n] [--h n] [--wait ms] [--scheme dark|light] [--eval js]'); process.exit(2); }

const browser = await launchChrome({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: Number(opt('w', 1440)), height: Number(opt('h', 900)) }, colorScheme: opt('scheme', 'dark') })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(opt('wait', 1500)));
const js = opt('eval', '');
if (js) console.log('eval:', JSON.stringify(await page.evaluate(js)));
await page.screenshot({ path: out });
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length ? 1 : 0);

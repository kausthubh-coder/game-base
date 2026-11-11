// A strip of screenshots through one calming in the fight lab, in order, on one sheet: the hold, the release,
// the grey running out, the bow, the land answering and the gift. The rule-made player fights the beast down;
// once the Mark is held out the picture is slowed (`__fight.slow`), so each frame lands where it is asked for.
//
//   bun tools/fight-strip.mjs --port 5531 --beast boar
//   bun tools/fight-strip.mjs --port 5531 --beast thistlehog --still      with the game's reduce motion on
//
// The sheet goes to `.artifacts/fight/strips/<beast>[-still].png`. It exits 1 on a console error or a fight
// that is not won. `--quality` holds a quality level (high by default).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const port = opt('port', process.env.PLAY_PORT ?? '5525'), beast = opt('beast', 'thistlehog'), quality = opt('quality', 'high');
const still = argv.includes('--still');
const base = opt('url', `http://localhost:${port}/`);
const out = resolve(import.meta.dirname, '..', '.artifacts/fight/strips');
mkdirSync(out, { recursive: true });
const BEAST_BUTTON = { thistlehog: 'Thistlehog', gearling: 'Gearling', boar: 'Boar' };
/** Seconds into the moment for each frame after the release. A machine's moment is shorter. */
const AT = beast === 'gearling' ? [0.1, 0.3, 0.5, 0.75, 1.05, 1.45, 1.9] : [0.3, 0.75, 1.2, 1.6, 2.05, 2.5, 2.95];
const SLOW = 0.15;

const browser = await launchChrome({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const sleep = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => window.__fight.state());

await page.goto(`${base}?scene=fight&quality=${quality}&way=hero`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fight && window.__game?.started, null, { timeout: 60000 });
await page.evaluate(() => window.__game.settle());
await page.evaluate((on) => window.__fight.reduceMotion(on), still);
await page.click(`.fl-card button:text-is("${BEAST_BUTTON[beast]}")`);
await page.addStyleTag({ content: '.fl-card, .fl-hud { visibility: hidden !important }' });
await page.evaluate(() => window.__fight.bot(true));

const frames = [];
/** A picture around the hero and the beast. */
async function take(label) {
  const s = await state();
  const mid = await page.evaluate(([x, z]) => window.__fight.screen(x, z), [(s.hero.x + s.beast.x) / 2, (s.hero.z + s.beast.z) / 2]);
  const w = beast === 'boar' ? 440 : 320, h = beast === 'boar' ? 300 : 220;
  const png = await page.screenshot({ clip: { x: Math.round(Math.min(1440 - w, Math.max(0, mid.x - w / 2))), y: Math.round(Math.min(900 - h, Math.max(0, mid.y - h * 0.62))), width: w, height: h } });
  frames.push({ label, png: png.toString('base64') });
  console.log(`  ${label}`);
}

// The hold: the bot holds F once the guard is empty.
let s = await state();
for (const until = Date.now() + 180000; Date.now() < until; s = await state()) {
  if (s.beast?.doing === 'dizzy' && s.beast.calm > 0.45 && s.hero.act === 'calm') break;
  if (s.phase === 'won') break;
  await sleep(30);
}
await page.evaluate((k) => window.__fight.slow(k), SLOW);
await take(`the hold, ${Math.round((s.beast?.calm ?? 0) * 100)}%`);
for (const until = Date.now() + 20000; Date.now() < until; s = await state()) {
  if (s.beast?.moment !== null && s.beast?.moment !== undefined) break;
  await sleep(20);
}
await take('the release');
for (const at of AT) {
  for (const until = Date.now() + 30000; Date.now() < until; s = await state()) {
    if ((s.beast?.moment ?? -9) >= at) break;
    await sleep(15);
  }
  await take(`${at.toFixed(2)} s`);
}
const won = s.phase === 'won';
await page.evaluate(() => { window.__fight.slow(1); window.__fight.bot(false); });

const html = `<body style="margin:0;background:#20261f;font:13px system-ui;color:#eee"><div style="padding:6px 8px">${beast}${still ? ', reduce motion' : ''}: the calming, in order</div><div style="display:grid;grid-template-columns:repeat(3,${beast === 'boar' ? 880 : 640}px);gap:6px;padding:0 6px 6px">${frames
  .map((f, i) => `<div><div>${i + 1}. ${f.label}</div><img src="data:image/png;base64,${f.png}" style="display:block;width:100%;image-rendering:pixelated"></div>`)
  .join('')}</div></body>`;
const view = await browser.newPage();
await view.setViewportSize({ width: beast === 'boar' ? 2670 : 1950, height: 600 });
await view.setContent(html);
await view.waitForTimeout(100);
const file = resolve(out, `${beast}${still ? '-still' : ''}.png`);
await view.screenshot({ path: file, fullPage: true });
await browser.close();
console.log(`strip: ${file}`);
if (!won) console.log('FAIL the fight was not won');
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
process.exit(errors.length || !won ? 1 : 0);

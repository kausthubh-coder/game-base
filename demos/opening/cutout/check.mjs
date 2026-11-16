// Checks the cut-out way in headless Chrome: the same `?t=` drawn on two fresh pages gives the same pixels,
// how many milliseconds one draw() takes, and that panel(id) gives a still of each legend shot. Needs the opening demo served:
//   bun tools/demo.mjs dev opening <port>, then bun demos/opening/cutout/check.mjs <port> [folder for the panels]
import { createHash } from 'node:crypto';
import { launchChrome } from '../../../tools/lib/chrome.mjs';

const port = process.argv[2] ?? '5448';
const times = [3, 12, 21.5, 33, 40.5, 47, 55, 64];
const browser = await launchChrome({ headless: true });

/** The way's own canvas, as the hash of its pixels, from a fresh page held at t. */
async function hashAt(t) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/?cut=cutout&t=${t}&panel=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__opening?.ready, null, { timeout: 30000 });
  const data = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#stage canvas')].find((x) => x.style.opacity !== '0');
    const x = c.getContext('2d');
    return Array.from(x.getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 7 === 0));
  });
  await page.context().close();
  if (errors.length) throw new Error(errors.join('\n'));
  return createHash('sha256').update(Uint8Array.from(data)).digest('hex').slice(0, 16);
}

let same = true;
for (const t of times) {
  const a = await hashAt(t), b = await hashAt(t);
  if (a !== b) same = false;
  console.log(`t=${t}: ${a} ${b} ${a === b ? 'same' : 'DIFFERENT'}`);
}

// One draw(): the way's own renderer, made fresh in the page from its module, timed across every shot.
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://127.0.0.1:${port}/?cut=plates&t=0&panel=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__opening?.ready, null, { timeout: 30000 });
const ms = await page.evaluate(async () => {
  const film = window.__opening.film;
  const { create } = await import('/cutout/index.ts');
  const r = create(film, { quality: 'high' });
  await r.load(film.shots);
  // To wait for a frame to be finished, the way's canvas is copied into a one-pixel canvas and that one is read:
  // the copy makes Chrome finish the frame on the graphics chip, and only the tiny canvas is ever read back
  // (a canvas read back often is moved to software drawing by Chrome, which would time something else).
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const pc = probe.getContext('2d', { willReadFrequently: true });
  const finish = () => { pc.drawImage(r.canvas, 0, 0, 1, 1); pc.getImageData(0, 0, 1, 1); };
  finish();
  const base = [];
  for (let i = 0; i < 24; i++) { const a = performance.now(); finish(); base.push(performance.now() - a); }
  base.sort((p, q) => p - q);
  const out = [`(finishing an unchanged frame alone: ${base[12].toFixed(1)} ms)`];
  for (const s of film.shots) {
    const cpu = [], all = [];
    for (let i = 0; i < 24; i++) {
      const t = s.at + (s.len * (i + 0.5)) / 24;
      let a = performance.now();
      r.draw(t);
      cpu.push(performance.now() - a);
      finish();
      a = performance.now();
      r.draw(t + 0.013);
      finish();
      all.push(performance.now() - a);
    }
    cpu.sort((p, q) => p - q);
    all.sort((p, q) => p - q);
    out.push(`${s.id}: ${cpu[12].toFixed(2)} ms of script per draw, ${all[12].toFixed(1)} ms with the frame finished (worst ${all[23].toFixed(1)})`);
  }
  // panel(id): each legend shot's still, for the mixes, sent back as PNG to look at.
  const panels = {};
  for (const s of film.shots.filter((x) => x.part === 0)) {
    const p = r.panel(s.id);
    panels[s.id] = p ? p.toDataURL('image/png') : null;
  }
  r.dispose();
  return { out, panels };
});
console.log(ms.out.join('\n'));
const dir = process.argv[3];
for (const [id, url] of Object.entries(ms.panels)) {
  if (!url) { same = false; console.log(`panel ${id}: none`); continue; }
  if (dir) await Bun.write(`${dir}/panel-${id}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`panel ${id}: ${url.length} bytes of PNG`);
}
await browser.close();
process.exit(same ? 0 : 1);

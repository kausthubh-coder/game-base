// Checks the wind in the built props demo: two frames 0.7 seconds apart of one tall oak on the turntable.
// In still air nothing may change. In full wind the leaves must move and the foot of the trunk must not.
//   bun tools/props-sway.mjs
// It needs the built demo served: bun tools/demo.mjs build props, then bun tools/serve.mjs dist/demos/props 5315.
import { launchChrome } from './lib/chrome.mjs';
import sharp from 'sharp';

const url = process.argv[2] ?? 'http://127.0.0.1:5315/';
const browser = await launchChrome({
  headless: true,
  args: [],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
await page.goto(`${url}?only=oak&variant=2&shots=1&panel=0`);
await page.waitForFunction(() => window.__props !== undefined);

async function frame(state, seconds) {
  await page.evaluate(({ state, seconds }) => {
    const demo = window.__props;
    demo.apply({ paused: true, angle: 0.5, time: 0.42, ...state });
    demo.advance(seconds);
    demo.render();
  }, { state, seconds });
  return sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
}

/** Pixels that differ between two frames, counted apart for the crown (the upper half of the picture) and the trunk's foot. */
function changed(a, b) {
  const { width, height, channels } = a.info;
  let crown = 0, foot = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) <= 12) continue;
      if (y < height * 0.5) crown++;
      // The trunk's foot: a band across the middle of the picture, clear of the label under it.
      else if (y > height * 0.56 && y < height * 0.66 && Math.abs(x - width / 2) < 30) foot++;
    }
  }
  return { crown, foot };
}

const still = changed(await frame({ wind: 0 }, 2), await frame({ wind: 0 }, 0.7));
const windy = changed(await frame({ wind: 1 }, 2), await frame({ wind: 1 }, 0.7));
await page.screenshot({ path: new URL('../.artifacts/props/sway-check.png', import.meta.url).pathname });
await browser.close();
console.log('still air: pixels changed', still);
console.log('full wind: pixels changed', windy);
const ok = still.crown === 0 && still.foot === 0 && windy.crown > 500 && windy.foot === 0;
console.log(ok ? 'sway: leaves move in wind, the trunk does not, and nothing moves in still air' : 'sway: FAILED');
process.exit(ok ? 0 : 1);

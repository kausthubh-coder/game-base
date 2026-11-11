// Pictures of one layout of Hollowmere that show how it is laid out: a plan seen from straight above with
// every building named, a bird's-eye view from the south, and six views from the ground: the gate, the
// centre, the market side and the quay at the game's own camera, and the granary and the main street from a
// lens set by hand.
// It opens an already served build with `?town=<name>`, as tools/town-shots.mjs does.
//   bun tools/town-layout.mjs --town a [--url http://127.0.0.1:5411/] [--out .artifacts/town-layout]
//     [--views plan,birdseye,gate,centre,granary,market,quay,street] [--frames 40] [--w 1600] [--h 1000]
// A lens view moves the game's lens after the game has placed it, so the land, the props and the shadows are
// drawn for where the lens really is. This Mac draws WebGL in software: the pictures say
// what is drawn, never how fast.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const url = opt('url', 'http://127.0.0.1:5411/');
const town = opt('town', 'now');
const out = resolve(root, opt('out', '.artifacts/town-layout'));
const width = Number(opt('w', 1600)), height = Number(opt('h', 1000));
const settleFrames = Number(opt('frames', 40));
mkdirSync(out, { recursive: true });

/** The middle of the town, where the plan and the bird's-eye view look. */
const MIDDLE = { x: 168, y: 20, z: -157 };

/** What every layout keeps: the names on the plan that are the same in all three. */
const SHARED = [
  ['Gate', 134, -174], ['Main street', 166, -174], ['Kennel yard', 198, -166], ['Gus\'s field', 198, -150],
  ['Lane to the river', 191, -139], ['Quay', 152, -130], ['Ferry', 197, -125], ['The Mere', 172, -122],
];
/** The names on each layout's plan, from src/game/content/town/<name>.ts. */
const LABELS = {
  now: [
    ['Cottage', 144, -181], ['Granary (barn)', 156, -182], ['Sawmill office', 168, -181], ['Cottage', 180, -181], ['Wren\'s house', 191, -181],
    ['Lodge', 162, -167], ['Bakery', 173, -167], ['Cottage', 184, -167], ['Carpenter', 150, -157], ['Cottage', 151, -146],
    ['Square and well', 173, -150],
  ],
  a: [
    ['Homes', 163, -181], ['Wren\'s house', 190, -181], ['Kennel keeper', 200, -178],
    ['Lodge', 156, -167], ['Queen\'s granary-hall', 172, -167], ['Bakery', 185, -167],
    ['Carpenter', 151, -155], ['House', 151, -145], ['Market row', 160, -150], ['Market row', 187, -150],
    ['Harvest Court', 173, -151], ['Stone way', 172, -143], ['Well', 172, -136], ['Rootworks gate', 159, -135],
    ['Ferry keeper', 198, -137], ['Gatehouse and walls', 136, -165], ['Warden statue', 131, -183],
  ],
  b: [
    ['House', 144, -181], ['Queen\'s granary-hall', 158, -183], ['Homes', 175, -181], ['Wren\'s house', 189, -181], ['Kennel keeper', 200, -178],
    ['Lodge', 161, -167], ['Bakery', 173, -167], ['Farmhouse', 184, -168],
    ['Carpenter', 151, -155], ['House', 151, -145], ['Well', 163, -156], ['Ruin pillars', 173, -158], ['The Hollow Oak', 173, -152],
    ['Warden statue', 174, -146], ['Lantern Green', 166, -144], ['Market', 187, -149], ['Lantern walk', 173, -137],
    ['Ferry keeper', 198, -137], ['Pillar gate and hedge', 136, -165],
  ],
};

/**
 * The views. `lens` moves the game's lens: it stands at `pos` and looks at `look`, both in blocks of the world
 * (x east, y up, z south). `north` puts north at the top of the page, for a view from above. `haze` keeps the
 * game's haze, for a view from the ground. A view without `lens` uses the game's camera: `at` is a place or a
 * column, `step` a move from it, `quarter` the camera's quarter turn (0 looks north-west, 2 south-east,
 * 3 north-east), `zoom` the steps in.
 *
 * The granary and the main street are lens views because the game's camera stands south-east of the hero,
 * and on a street that puts a row of houses between the two, which the game then fades out.
 */
const GRANARY = {
  // Today's barn and B's hall face the main street. A's hall faces the court.
  now: { pos: [148, 26, -171.5], look: [157, 22, -184], fov: 50, haze: true },
  a: { pos: [183, 26, -147], look: [172, 24, -167], fov: 42, haze: true },
  b: { pos: [147, 27, -171.5], look: [158, 24, -183], fov: 52, haze: true },
};
const VIEWS = {
  plan: { lens: { pos: [MIDDLE.x, MIDDLE.y + 232, MIDDLE.z + 0.01], look: [MIDDLE.x, MIDDLE.y, MIDDLE.z], fov: 23, north: true }, labels: true },
  birdseye: { lens: { pos: [MIDDLE.x, MIDDLE.y + 120, MIDDLE.z + 118], look: [MIDDLE.x, MIDDLE.y, MIDDLE.z], fov: 30, north: true } },
  gate: { at: [129, -176], quarter: 2, zoom: 1 },
  centre: { at: 'town.square', step: [5, 2], quarter: 0, zoom: 1 },
  granary: { lens: GRANARY[town] },
  market: { at: [180, -145], quarter: 3, zoom: 1 },
  quay: { at: 'river.bank', step: [2, 0], quarter: 0, zoom: 1 },
  // From over the gate end of the main street, looking east along it.
  street: { lens: { pos: [138, 31, -174], look: [188, 19, -174.5], fov: 38, haze: true } },
};
const views = opt('views', Object.keys(VIEWS).join(',')).split(',');

const browser = await launchChrome({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const errors = [];

try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  page.setDefaultTimeout(900000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);
  await page.goto(`${url}?hold=1&quality=high&town=${town}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await game(({ middle }) => {
    const g = window.__game, view = g.view;
    g.newGame();
    g.manual(true);
    view.game.systems.time?.setWeather('clear', true);
    g.setTime(0.5);
    g.advance(0.2);
    view.settings.setGraphics({ shadowDistance: 90, viewDistance: 1.5 });
    // The interface, the hints and the quest's beam of light are not part of the town.
    view.root.style.visibility = 'hidden';
    const beam = view.scene.getObjectByName('waypoint-beam');
    if (beam) beam.material.visible = false;

    // The lens the plan and the bird's-eye view ask for. It is set right after the game's camera has placed
    // the lens, so everything that is drawn afterwards (the land, the props, the shadows) is drawn for it.
    window.__lens = null;
    const camera = view.camera, lens = view.ctx.camera;
    const update = camera.update.bind(camera);
    const up = lens.up.clone();
    camera.update = (dt, ctx) => {
      update(dt, ctx);
      const want = window.__lens;
      // The game's camera sets the near and far planes itself every frame, for how far back it stands.
      if (!want) { lens.up.copy(up); return; }
      lens.position.set(want.pos[0], want.pos[1], want.pos[2]);
      if (want.north) lens.up.set(0, 0, -1);
      else lens.up.copy(up);
      lens.lookAt(want.look[0], want.look[1], want.look[2]);
      lens.fov = want.fov;
      lens.near = 0.5;
      lens.far = 700;
      lens.updateProjectionMatrix();
      lens.updateMatrixWorld(true);
    };
    // The game clears a tunnel from the hero toward the lens, so the hero is never hidden. With the lens moved,
    // that tunnel would cut through the town. A lens view closes it.
    const own = Object.getOwnPropertyDescriptor(camera, 'cutaway');
    Object.defineProperty(camera, 'cutaway', {
      configurable: true,
      get() {
        const state = own.get ? own.get.call(camera) : own.value;
        return window.__lens ? { ...state, radius: 0, sightRadius: 0.001, column: false } : state;
      },
    });
    // The game's haze ends long before a lens this high. It is pushed out after the sky has set it.
    view.onFrame(() => {
      const fog = view.scene.fog;
      if (!window.__lens || window.__lens.haze || !fog) return;
      if ('far' in fog) { fog.near = 600; fog.far = 900; }
      else fog.density = 0;
    });

    const box = document.createElement('div');
    box.id = 'town-labels';
    box.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 15px/1.2 ui-sans-serif,system-ui,sans-serif;';
    document.body.append(box);
  }, { middle: MIDDLE });

  const home = await game(() => window.__game.view.camera.zoom);
  for (const key of views) {
    const view = VIEWS[key];
    if (!view) throw new Error(`no view called ${key}`);
    await game(async ({ view, home, frames, middle }) => {
      const g = window.__game, cam = g.view.camera;
      document.getElementById('town-labels').replaceChildren();
      window.__lens = view.lens ?? null;
      // The blur toward the edges of the screen is the game's look on the ground. A plan is read sharp all over.
      g.view.post.set({ tiltShift: !view.lens, vignette: !view.lens });
      // From above, the hero stands in the open middle of town, so the land all round is loaded and drawn. For a
      // lens on the ground the hero stands under it, out of the picture.
      let spot = view.lens ? (view.lens.haze ? g.teleport(Math.floor(view.lens.pos[0]), Math.floor(view.lens.pos[2])) : g.teleport(middle.x + 5, middle.z + 14)) : typeof view.at === 'string' ? g.teleport(view.at) : g.teleport(view.at[0], view.at[1]);
      if (view.step) spot = g.teleport(Math.floor(spot.x) + view.step[0], Math.floor(spot.z) + view.step[1]);
      const left = ((view.quarter ?? 0) - g.state().camera.quarter + 4) % 4;
      if (left === 3) g.turn(1);
      else for (let i = 0; i < left; i++) g.turn(-1);
      while (cam.zoom > home) cam.zoomBy(-1);
      while (cam.zoom < home) cam.zoomBy(1);
      // From above the game's own camera stands far back, so it hides no roof near the hero.
      for (let i = 0; i < (view.lens ? 0 : view.zoom ?? 0); i++) cam.zoomBy(-1);
      if (view.lens) for (let i = 0; i < 4; i++) cam.zoomBy(1);
      g.setTime(0.5);
      g.advance(0.1);
      await g.frames(frames);
      await g.settle();
      await g.frames(4);
    }, { view, home, frames: settleFrames, middle: MIDDLE });

    if (view.labels) {
      await game(({ labels, y }) => {
        const g = window.__game, box = document.getElementById('town-labels');
        for (const [text, x, z] of labels) {
          const at = g.view.project(x + 0.5, y + 1, z + 0.5);
          if (!at) continue;
          const tag = document.createElement('div');
          tag.textContent = text;
          tag.style.cssText = `position:absolute;left:${at.x}px;top:${at.y}px;transform:translate(-50%,-50%);padding:3px 8px;white-space:nowrap;color:#fff;background:rgba(28,24,20,.78);border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.35);`;
          box.append(tag);
        }
        // A compass and a scale bar, so the plan can be read without the code.
        const a = g.view.project(140, y + 1, -121), b = g.view.project(150, y + 1, -121);
        if (a && b) {
          const bar = document.createElement('div');
          bar.style.cssText = `position:absolute;left:${a.x}px;top:${a.y}px;width:${b.x - a.x}px;border-top:3px solid #fff;padding-top:4px;color:#fff;text-shadow:0 1px 3px #000;text-align:center;`;
          bar.textContent = '10 blocks';
          box.append(bar);
        }
        const north = document.createElement('div');
        north.textContent = 'N ↑';
        north.style.cssText = 'position:absolute;left:24px;top:20px;padding:6px 12px;font-size:20px;color:#fff;background:rgba(28,24,20,.78);border-radius:8px;';
        box.append(north);
      }, { labels: [...SHARED, ...LABELS[town]], y: MIDDLE.y });
    }
    await page.screenshot({ path: resolve(out, `${town}-${key}.png`) });
    console.log(`${town}-${key}.png`);
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.log(`FAIL: console errors\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('ok: no console errors');

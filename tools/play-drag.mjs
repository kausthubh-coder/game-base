// The right-button drag in the browser: builds the game, serves it, starts a new game from the title and, with
// the real mouse, drags the 2.5D camera and the free camera around with the right button held, checks each turn
// placed nothing, and checks a right click (and one with a little jitter) still sets a plank down.
// The 2.5D camera glides to the nearest quarter when let go, and on Smooth stays where it was let go. Then the Mouse
// setting: Lock to turn takes the mouse on a click, as Genshin does, and Drag to turn gives it back. In first person
// a panel gives the mouse back and takes it again when closed by its key or its close button, not after Esc or Alt.
//   bun tools/play-drag.mjs [--port 5391] [--dist dist-drag] [--no-build] [--shots <folder>]
// With --shots it writes before, mid-drag and after frames at the spawn and the town square, the 2.5D view at a
// quarter turn and between two, and the Settings rows, at 1440 by 900. This Mac draws WebGL in software, so it
// checks what the game does and draws, never how fast, and never how a real mouse feels.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', process.env.PLAY_PORT || '5391'));
const dist = opt('dist', 'dist-drag');
const shots = opt('shots', null);
if (shots) mkdirSync(resolve(shots), { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error(`FAIL: the build into ${dist}`); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', dist, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving ${dist} on http://127.0.0.1:${PORT}/  pid ${serverPid}`);

/**
 * A right click as a hand makes it: the press and the release 60 ms apart by the events' own clocks. The game
 * counts a right press as a click only when it comes up soon (src/game/shell/drag.ts), and page.mouse waits for
 * each event to be handled, which takes a whole frame on this Mac's software WebGL. These are the same input
 * events page.mouse sends, with the time a hand would take written on them.
 */
async function handClick(page, x, y, jitter = 0) {
  const cdp = (page.__cdp ??= await page.context().newCDPSession(page));
  const t0 = Date.now() / 1000;
  const send = (type, px, py, at, buttons) => cdp.send('Input.dispatchMouseEvent', { type, x: px, y: py, button: type === 'mouseMoved' ? 'none' : 'right', buttons, clickCount: type === 'mouseMoved' ? 0 : 1, timestamp: t0 + at });
  await send('mouseMoved', x, y, 0, 0);
  await send('mousePressed', x, y, 0.01, 2);
  if (jitter) { await send('mouseMoved', x + jitter, y - 1, 0.03, 2); await send('mouseMoved', x - 1, y + jitter, 0.05, 2); }
  await send('mouseReleased', jitter ? x - 1 : x, jitter ? y + jitter : y, 0.07, 0);
}

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass) });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const errors = [];
let browser;
/** Radians per pixel, as LOOK_SPEED in src/game/shell/game.ts. */
const SPEED = 0.0024;
const DEG = 180 / Math.PI;
/** The difference of two yaws in degrees, brought into -180 to 180. */
const turned = (from, to) => ((((to - from + 180) % 360) + 360) % 360) - 180;

try {
  // Give camera easing time to settle between browser observations on Metal.
  browser = await launchChrome({
    slowMo: 250,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(180000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);
  const frames = (n = 2) => game((count) => window.__game.frames(count), n);
  const state = () => game(() => window.__game.state());
  const shot = async (name) => {
    if (!shots) return;
    await frames(2);
    await page.screenshot({ path: resolve(shots, name) });
    console.log(`     wrote ${resolve(shots, name)}`);
  };

  await page.goto(`http://127.0.0.1:${PORT}/?quality=medium`, { waitUntil: 'load' });
  await page.waitForSelector('[data-key="title:new"]');
  await page.click('[data-key="title:new"]');
  await page.waitForSelector('.st-cinema:not([hidden]) [data-key="opening:skip"]', { timeout: 30000 });
  await page.click('[data-key="opening:skip"]');
  await page.waitForFunction(() => window.__game.started && !window.__game.view.game.player.busy && !window.__game.view.paused);

  /** Stands the hero at a place at noon with planks in hand, the land drawn. */
  async function standAt(place) {
    await game((name) => {
      const g = window.__game;
      g.setTime(0.45);
      g.teleport(name);
      g.give('plank', 20);
      const inv = g.view.game.systems.inventory;
      const slot = inv.slots.findIndex((s) => s?.id === 'plank');
      if (slot >= 0 && slot < 9) inv.selected = slot;
    }, place);
    await game(() => window.__game.settle());
    await frames(3);
  }

  const planks = async () => (await state()).bag.find((s) => s.id === 'plank')?.count ?? 0;

  /** Where on the page the top of the ground two blocks beside the hero is, and that cell. Never under the HUD. */
  const groundSpot = () => game(() => {
    const g = window.__game, p = g.state().player;
    for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, -2], [3, 0], [0, 3], [-3, 0], [0, -3]]) {
      const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz, y = g.view.world.sim.heightAt(x, z) - 1;
      const at = g.view.project(x + 0.5, y + 1, z + 0.5);
      if (at && at.y > 120 && at.y < 740 && at.x > 100 && at.x < 1200) return { x, y, z, at };
    }
    return null;
  });

  /** A real right-button drag from `from` by dx, dy pixels in `steps` moves. `mid` runs with the button still down. */
  async function rightDrag(from, dx, dy, steps = 6, mid) {
    await page.mouse.move(from.x, from.y);
    await frames(1);
    await page.mouse.down({ button: 'right' });
    for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
    await frames(2);
    const during = await game(() => { const s = window.__game.state(); return { dragging: s.camera.dragging, cursor: window.__game.view.canvas.style.cursor, aim: s.aim, yaw: s.camera.yaw, pitch: s.camera.pitch }; });
    if (mid) await mid();
    await page.mouse.up({ button: 'right' });
    // Long enough for a 2.5D camera on Quarter turns to glide to its quarter, a frame being at most a tenth of a second.
    await frames(6);
    return during;
  }

  /** A real right click, with the hand wandering `jitter` pixels between the press and the release. */
  async function rightClick(at, jitter = 0) {
    await handClick(page, at.x, at.y, jitter);
    await frames(2);
  }

  /**
   * The drag and the click in the camera that is on now. `placing` is false where the rules refuse to build (the
   * town square), so only the drag is checked there.
   */
  async function dragAndClick(label, place, dx, dy, placing = true) {
    await standAt(place);
    const spot = placing ? await groundSpot() : { at: { x: 640, y: 420 } };
    check(`${label} at ${place}: the ground beside the hero is on screen`, spot, JSON.stringify(spot));
    if (!spot) return;
    const before = await state();
    const planksBefore = await planks();
    const slug = `${label.replace(/\W+/g, '-').toLowerCase()}-${place.replace(/\W+/g, '-')}`;
    await shot(`${slug}-1-before.png`);
    const during = await rightDrag(spot.at, dx, dy, 6, () => shot(`${slug}-2-mid-drag.png`));
    const after = await state();
    await shot(`${slug}-3-after.png`);
    const yaw = turned(before.camera.yaw, during.yaw);
    check(`${label} at ${place}: a right drag turns the camera with the hand`, Math.abs(yaw - -dx * SPEED * DEG) < 1.5, `yaw ${before.camera.yaw} to ${during.yaw} mid-drag, turned ${yaw.toFixed(2)} for ${(-dx * SPEED * DEG).toFixed(2)} asked`);
    if (dy) {
      check(`${label} at ${place}: dragging down looks further down`, during.pitch > before.camera.pitch + 3, `pitch ${before.camera.pitch} to ${during.pitch}`);
      check(`${label} at ${place}: the camera stays where the drag left it`, Math.abs(turned(during.yaw, after.camera.yaw)) < 0.01 && Math.abs(after.camera.pitch - during.pitch) < 0.01, `yaw ${during.yaw} to ${after.camera.yaw}`);
    } else {
      check(`${label} at ${place}: the 2.5D drag keeps the pitch and the zoom`, Math.abs(after.camera.pitch - before.camera.pitch) < 0.01 && after.camera.zoom === before.camera.zoom, `pitch ${before.camera.pitch} to ${after.camera.pitch}`);
      check(`${label} at ${place}: on Quarter turns, let go, the camera glides to the nearest quarter`, offQuarter(after.camera.yaw) < 0.5 && Math.abs(turned(during.yaw, after.camera.yaw)) <= 45.5, `yaw ${during.yaw} mid-drag to ${after.camera.yaw}`);
    }
    check(`${label} at ${place}: during the drag the cursor hides, the mouse is not locked and nothing is aimed at`, during.dragging && during.cursor === 'none' && during.aim === null && !after.camera.locked, JSON.stringify(during));
    const cursorAfter = await game(() => window.__game.view.canvas.style.cursor);
    check(`${label} at ${place}: the drag places nothing, and the cursor comes back`, (await planks()) === planksBefore && after.stats.blocks === before.stats.blocks && !after.camera.dragging && cursorAfter === '',
      `planks ${planksBefore} to ${await planks()}, blocks ${before.stats.blocks} to ${after.stats.blocks}, cursor "${cursorAfter}"`);

    // A plain click, then one with a little jitter, each set a plank down on the ground the pointer is on.
    for (const jitter of placing ? [0, 3] : []) {
      const target = await groundSpot();
      const cell = await game(([s]) => window.__game.block(s.x, s.y + 1, s.z).key, [target]);
      const had = await planks();
      await rightClick(target.at, jitter);
      await game(() => window.__game.advance(0.1));
      const now = await game(([s]) => window.__game.block(s.x, s.y + 1, s.z).key, [target]);
      check(`${label} at ${place}: a right click${jitter ? ` with ${jitter} pixels of jitter` : ''} still places`, (await planks()) === had - 1 && now === 'oak_plank', `cell ${cell} to ${now}, planks ${had} to ${await planks()}`);
      // Take it away again, so the next check has open ground.
      await game(([s]) => { const g = window.__game; g.view.world.sim.setBlock(s.x, s.y + 1, s.z, 0); }, [target]);
    }
  }

  /** Degrees from the nearest quarter turn, which stand at 45 + 90k. */
  const offQuarter = (yaw) => Math.abs(((((yaw - 45) % 90) + 135) % 90) - 45);

  // ---- the 2.5D camera
  check('the game opens on the 2.5D camera with the mouse pointing, on Quarter turns', (await state()).camera.mode === 'tilt' && (await state()).camera.mouse === 'point' && (await state()).camera.tiltTurn === 'quarter');
  await dragAndClick('2.5D', 'spawn', 300, 0);
  await dragAndClick('2.5D', 'town.square', -260, 0, false);

  // On Smooth the camera stays where a drag leaves it; Q and R from there come to rest on a quarter. The same view
  // half a quarter off and at a quarter, with the town's people in frame.
  await game(() => window.__game.view.settings.setTiltTurn('smooth'));
  // Half a quarter is 45 degrees, about 327 pixels.
  await rightDrag({ x: 1000, y: 300 }, -Math.round((Math.PI / 4) / SPEED), 0, 6);
  const between = await state();
  check('2.5D on Smooth: after a drag the camera rests where it was let go, half a quarter off', between.camera.tiltTurn === 'smooth' && Math.abs(offQuarter(between.camera.yaw) - 45) < 1, `yaw ${between.camera.yaw}`);
  await page.mouse.move(1100, 160);
  await shot('2-5d-between-quarters.png');
  await page.keyboard.press('q');
  await game(() => window.__game.advance(0.5));
  await frames(6);
  const onQuarter = await state();
  check('2.5D: Q from between two quarters comes to rest on a quarter', offQuarter(onQuarter.camera.yaw) < 0.5, `yaw ${between.camera.yaw} to ${onQuarter.camera.yaw}`);
  await shot('2-5d-on-a-quarter.png');
  await game(() => window.__game.view.settings.setTiltTurn('quarter'));
  const sprites = await state();
  check('2.5D: the sprites are all there after the turns', sprites.sprites.missing.length === 0 && sprites.sprites.count > 1, JSON.stringify(sprites.sprites));

  // ---- the free camera, Drag to turn
  await game(() => window.__game.setCamera('free'));
  await frames(2);
  const free = await state();
  check('Free: the mouse drags to turn by default, with no lock and no crosshair', free.camera.mouse === 'drag' && !free.camera.locked && (await game(() => document.querySelector('.core-crosshair')?.hidden ?? true)), JSON.stringify(free.camera));
  // A left click in the world acts at once: no click is spent taking the mouse.
  await game(() => window.__game.look(0, 24, 8));
  await dragAndClick('Free', 'spawn', 320, 50);
  // The free camera aims at the cursor, not the middle of the screen.
  const aimed = await groundSpot();
  check('Free: a block off the middle of the screen is in view', aimed && Math.hypot(aimed.at.x - 720, aimed.at.y - 450) > 40, JSON.stringify(aimed));
  if (aimed) {
    await page.mouse.move(aimed.at.x, aimed.at.y);
    await frames(2);
    const aim = (await state()).aim;
    check('Free: the cursor aims where it is', aim && aim.x === aimed.x && aim.z === aimed.z, `${JSON.stringify(aim)} for ${JSON.stringify(aimed)}`);
  }
  await game(() => window.__game.look(90, 22, 8));
  await dragAndClick('Free', 'town.square', -280, 40, false);

  // ---- the Mouse setting, in Settings
  await page.mouse.move(720, 300);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.gu-panel-pause');
  await page.locator('.gu-panel-pause button', { hasText: 'Settings' }).click();
  await page.waitForSelector('input[name="gu-mouse"]');
  const rows = await game(() => [...document.querySelectorAll('.gu-settings-view legend')].map((e) => e.textContent));
  check('Settings: the View section has Camera, Mouse, 2.5D turning and Characters', rows.join() === 'Camera,Mouse,2.5D turning,Characters', rows.join(', '));
  check('Settings: Drag to turn and Quarter turns are picked', await page.locator('input[name="gu-mouse"][value="drag"]').isChecked() && await page.locator('input[name="gu-tiltTurn"][value="quarter"]').isChecked());
  await page.locator('input[name="gu-tiltTurn"][value="smooth"]').check();
  check('Settings: 2.5D turning Smooth applies at once', (await game(() => window.__game.view.settings.tiltTurn)) === 'smooth');
  await page.locator('input[name="gu-tiltTurn"][value="quarter"]').check();
  const keyRows = await game(() => [...document.querySelectorAll('.gu-keylist dt')].map((e) => e.textContent));
  check('Settings: the keys list names the right-button drag', keyRows.includes('Turn the camera'), keyRows.join(', '));
  const view = page.locator('.gu-settings-view');
  await view.scrollIntoViewIfNeeded();
  if (shots) { await view.screenshot({ path: resolve(shots, 'settings-view-rows.png') }); console.log(`     wrote ${resolve(shots, 'settings-view-rows.png')}`); }
  if (shots) { await page.screenshot({ path: resolve(shots, 'settings.png') }); console.log(`     wrote ${resolve(shots, 'settings.png')}`); }
  await page.locator('input[name="gu-mouse"][value="lock"]').check();
  check('Settings: Lock to turn applies at once', (await state()).camera.mouse === 'lock' && (await game(() => window.__game.view.settings.mouse)) === 'lock');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__game.view.paused && !window.__game.view.game.player.busy);
  await frames(2);
  await page.mouse.click(720, 450);
  await frames(2);
  const locked = await state();
  check('Lock to turn: a click in the world takes the mouse and breaks nothing', locked.camera.locked && locked.breaking === null, JSON.stringify(locked.camera));
  check('Lock to turn: the crosshair shows', await game(() => !document.querySelector('.core-crosshair').hidden));
  await game(() => window.__game.view.settings.setMouse('drag'));
  await frames(2);
  check('Drag to turn: switching back gives the mouse back', !(await state()).camera.locked);

  // ---- first person keeps the lock
  await game(() => window.__game.setCamera('first'));
  await frames(2);
  check('First person locks the mouse whatever the setting', (await state()).camera.mouse === 'lock');

  // ---- a panel gives the mouse back, and closing it takes the mouse again
  const lockedNow = async () => { await frames(3); return (await state()).camera.locked; };
  await page.mouse.click(720, 450);
  check('First person: a click in the world takes the mouse', await lockedNow());
  await page.keyboard.press('KeyB');
  await page.waitForSelector('.gu-panel .gu-close');
  check('First person: the bag gives the mouse back', !(await lockedNow()));
  await page.keyboard.press('KeyB');
  await page.waitForFunction(() => !window.__game.view.game.player.busy);
  check('First person: closing the bag with its key takes the mouse again', await lockedNow());
  await page.keyboard.press('KeyB');
  await page.click('.gu-panel .gu-close');
  await page.waitForFunction(() => !window.__game.view.game.player.busy);
  check('First person: closing the bag with its close button takes the mouse again', await lockedNow());
  await page.keyboard.press('Alt');
  check('First person: Alt gives the mouse back', !(await lockedNow()));
  await page.keyboard.press('KeyB');
  await page.waitForSelector('.gu-panel .gu-close');
  await page.keyboard.press('KeyB');
  await page.waitForFunction(() => !window.__game.view.game.player.busy);
  check('First person: a panel opened after Alt leaves the mouse free when it closes', !(await lockedNow()));
  // Chrome never grants the lock just after Esc, so a panel closed with it leaves the next click to take the mouse.
  await page.mouse.click(720, 450);
  await page.keyboard.press('KeyB');
  await page.waitForSelector('.gu-panel .gu-close');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__game.view.game.player.busy);
  await frames(3);
  await page.mouse.click(720, 450);
  check('First person: after a panel closed with Esc, a click in the world takes the mouse', await lockedNow());

  await game(() => window.__game.setCamera('tilt'));
  await frames(2);
  check('Back on 2.5D the mouse points again', (await state()).camera.mouse === 'point' && !(await state()).camera.locked);
} catch (error) {
  console.error(error);
  check('the drag check ran to its end', false, String(error.message ?? error));
} finally {
  await browser?.close();
  process.kill(serverPid);
}

const real = errors.filter((e) => !/favicon/.test(e));
check('no console errors', real.length === 0, real.slice(0, 5).join(' | '));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length === 0 ? 'PASS' : 'FAIL'}: ${checks.length - failed.length} of ${checks.length} drag checks`);
process.exit(failed.length === 0 ? 0 : 1);

// Playing together, checked with two real browsers on one world: Ann and Bo open the same link on a world
// server of this script's own (`wrangler dev`), walk, build, farm, see and hear each other. Then Ann leaves,
// the server is stopped and started under Bo, and a third page with another build is turned away.
//   bun tools/play-together.mjs [--no-build] [--delay 100] [--port 5547] [--shots <folder>]
// Every socket is slowed by `--delay` milliseconds each way (100 by default), in the page, so the prediction
// is checked against a real round trip. The check fails on any console error but the one Chrome prints for
// each reconnect that finds the server down while it is being restarted.
//
// It waits for state, never for a count of frames (tools/play/frame-checks.md). It reports the numbers it
// measured: bytes received a second, the largest gap between the hero this browser drew and the server's.
// This Mac draws with its own graphics chip; no frame rate here says anything about a Chromebook.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { join as joinWorld, startServer, sleep } from '../server/test/local.ts';
import { blockId } from '../src/content/blocks.ts';
import { cellIndex } from '../src/features/world/chunk.sim.ts';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', process.env.TOGETHER_PORT || '5547'));
const DELAY = Number(opt('delay', '100'));
const shots = resolve(root, opt('shots', '.artifacts/together'));
const WORLD = `together-${Date.now().toString(36)}`;
mkdirSync(shots, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['run', 'build'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  if (build.status !== 0) { console.error('FAIL: the build into dist/'); process.exit(1); }
}

const checks = [];
const numbers = {};
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass) });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? `\n       ${detail}` : ''}`);
  return Boolean(pass);
}

/**
 * Runs in each page before the game: the page's WebSocket, slowed by `delay` milliseconds each way and with
 * the order kept, counting what comes in by the field of the snap it is in. `build` replaces the build the
 * hello says, as a browser that has not reloaded since an update would send.
 */
function slowSockets({ delay, build }) {
  const Native = window.WebSocket;
  const net = (window.__together = { delay, bytes: 0, messages: 0, fields: {}, downs: [], restartErrors: 0 });
  window.addEventListener('keydown', (e) => { if (!e.repeat) net.downs.push({ code: e.code, t: performance.now() / 1000 }); }, true);
  const later = (fn) => setTimeout(fn, net.delay);
  class SlowSocket {
    constructor(url) {
      this.ws = new Native(url);
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      this.ws.onopen = (event) => later(() => this.onopen?.(event));
      this.ws.onmessage = (event) => {
        const data = event.data;
        net.messages++;
        net.bytes += typeof data === 'string' ? data.length : 0;
        try {
          const message = JSON.parse(data);
          if (message.t === 'snap') for (const [key, value] of Object.entries(message)) net.fields[key] = (net.fields[key] ?? 0) + key.length + 4 + JSON.stringify(value).length;
        } catch { /* not JSON */ }
        later(() => this.onmessage?.({ data }));
      };
      this.ws.onclose = (event) => later(() => this.onclose?.({ code: event.code, reason: event.reason }));
      this.ws.onerror = (event) => later(() => this.onerror?.(event));
    }
    get readyState() { return this.ws.readyState; }
    addEventListener(type, fn) { this.ws.addEventListener(type, fn); }
    send(data) {
      const out = build && typeof data === 'string' && data.includes('"t":"hello"') ? data.replace(/"build":"[^"]*"/, `"build":"${build}"`) : data;
      // A line that went dead loses what was sent into it, as a real one does.
      later(() => { if (this.ws.readyState === 1) this.ws.send(out); });
    }
    close(code, reason) { try { this.ws.close(code, reason); } catch { /* closed */ } }
  }
  window.WebSocket = SlowSocket;
}

const pages = [];
let restarting = false;
async function open(browser, name, { build = null, url = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(slowSockets, { delay: DELAY, build });
  const page = await context.newPage();
  const entry = { name, page, context, errors: [], allowed: 0 };
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Chrome prints this for every reconnect that finds nobody listening. It is expected while the server is down.
    if (restarting && /WebSocket connection to .* failed/.test(text)) { entry.allowed++; return; }
    entry.errors.push(text);
  });
  page.on('pageerror', (e) => entry.errors.push(String(e)));
  pages.push(entry);
  await page.goto(url ?? `http://127.0.0.1:${PORT}/?world=${WORLD}&dev=${name.toLowerCase()}&quality=low`);
  return entry;
}

/** Waits until `fn(arg)` is true in the page, checking every 50 ms. */
async function until(entry, what, fn, arg, timeout = 20_000) {
  try {
    await entry.page.waitForFunction(fn, arg, { polling: 50, timeout });
    return true;
  } catch {
    throw new Error(`${entry.name}: waited ${timeout} ms for ${what}`);
  }
}

const debugOf = (entry, frames = false) => entry.page.evaluate((f) => window.__game.online.debug(f), frames);
const ready = (entry) => until(entry, 'the world to be ready', () => window.__game?.online?.debug().ready === true, undefined, 60_000);

/** Holds real keys down for `ms`, then lets go. */
async function hold(entry, keys, ms) {
  for (const key of keys) await entry.page.keyboard.down(key);
  await sleep(ms);
  for (const key of keys) await entry.page.keyboard.up(key);
}

let server = null, browser = null;
const t0 = Date.now();
try {
  server = await startServer({ port: PORT, name: 'together', fresh: true });
  console.log(`world server on ${server.http}, pid ${server.pid}, world ${WORLD}, sockets slowed ${DELAY} ms each way`);
  browser = await launchChrome();

  // ------------------------------------------------------------------ joining
  const ann = await open(browser, 'Ann');
  const bo = await open(browser, 'Bo');
  await Promise.all([ready(ann), ready(bo)]);
  await until(bo, 'Ann in Bo\'s world', () => window.__game.view.game.actors.has('player:dev_ann'));
  await until(ann, 'Bo in Ann\'s world', () => window.__game.view.game.actors.has('player:dev_bo'));
  check('two pages open one world by its link, with dev names and no account', true, `/?world=${WORLD}&dev=ann and &dev=bo`);

  // Bo counts the events his bus hears from here on.
  await bo.page.evaluate(() => {
    const heard = (window.__heard = {});
    window.__game.view.game.events.onAny((name) => { heard[name] = (heard[name] ?? 0) + 1; });
  });
  await ann.page.evaluate(() => {
    const heard = (window.__heard = {});
    window.__game.view.game.events.onAny((name) => { heard[name] = (heard[name] ?? 0) + 1; });
  });

  // ------------------------------------------------------------------ building and farming together
  const spot = await ann.page.evaluate(() => {
    const p = window.__game.view.game.player.pos, sim = window.__game.view.world.sim, region = window.__game.view.game.systems.region;
    // Open ground within reach that is not the town's, nearest first.
    const free = [];
    for (let r = 2; r <= 3 && free.length < 3; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz, y = sim.heightAt(x, z) - 1;
        if (region.isProtected(x, y + 1, z) || region.isProtected(x, y, z)) continue;
        if (free.some((c) => Math.abs(c.x - x) + Math.abs(c.z - z) < 2)) continue;
        free.push({ x, y, z });
      }
    }
    return { keep: free[0], gone: free[1], farm: free[2] };
  });
  for (const [item, count] of [['plank', 5], ['hoe', 1], ['wheat_seeds', 3]]) await server.dev(WORLD, { do: 'give', item, count });
  await until(ann, 'the planks, the hoe and the seeds in Ann\'s bag', () => ['plank', 'hoe', 'wheat_seeds'].every((id) => window.__game.view.game.systems.inventory.count(id) > 0));

  /** Takes an item in hand through the bag and uses it on a block, as a right click on its top would. */
  const useOn = (entry, item, at) => entry.page.evaluate(({ item, at }) => {
    const inv = window.__game.view.game.systems.inventory;
    inv.selected = inv.slots.findIndex((slot) => slot?.id === item);
    window.__game.click('secondary', at.x, at.y, at.z);
  }, { item, at });

  for (const at of [spot.keep, spot.gone]) {
    await useOn(ann, 'plank', at);
    await until(ann, `a plank at ${at.x}, ${at.y + 1}, ${at.z}`, (c) => window.__game.block(c.x, c.y + 1, c.z).key === 'oak_plank', at, 5000);
  }
  const placedKey = (at) => window.__game.block(at.x, at.y + 1, at.z).key;
  await until(bo, 'both blocks Ann placed in Bo\'s world', (s) => window.__game.block(s.keep.x, s.keep.y + 1, s.keep.z).key === 'oak_plank' && window.__game.block(s.gone.x, s.gone.y + 1, s.gone.z).key === 'oak_plank', spot);
  check('Ann places blocks; Bo\'s page has them', true, `oak planks at ${spot.keep.x}, ${spot.keep.y + 1}, ${spot.keep.z} and ${spot.gone.x}, ${spot.gone.y + 1}, ${spot.gone.z}; Bo reads ${await bo.page.evaluate(placedKey, spot.keep)}`);

  await useOn(ann, 'hoe', spot.farm);
  await until(ann, 'the soil tilled', (at) => window.__game.block(at.x, at.y, at.z).key.includes('soil') || window.__game.block(at.x, at.y, at.z).key.includes('farm'), spot.farm);
  await useOn(ann, 'wheat_seeds', spot.farm);
  await until(bo, 'Ann\'s wheat in Bo\'s crops', (at) => window.__game.view.game.systems.crops.at(at.x, at.y, at.z)?.crop === 'wheat', spot.farm);
  const boCrop = await bo.page.evaluate((at) => ({ crop: window.__game.view.game.systems.crops.at(at.x, at.y, at.z), soil: window.__game.block(at.x, at.y, at.z).key }), spot.farm);
  check('Ann tills and plants a cell; Bo\'s page has the soil and the crop', boCrop.crop?.crop === 'wheat', `Bo's block ${boCrop.soil}, crop ${JSON.stringify(boCrop.crop)}`);

  // Bo holds the button on one of the blocks until it breaks, a step at a time, as the shell does with the left button held.
  await bo.page.evaluate((at) => {
    const view = window.__game.view, sys = view.game.systems;
    const hit = { x: at.x, y: at.y + 1, z: at.z, nx: 0, ny: 1, nz: 0, id: 0, distance: 0 };
    const off = view.onSimStep((dt) => {
      if (window.__game.block(at.x, at.y + 1, at.z).key !== 'oak_plank') { off(); return; }
      sys.actions.hold({ hit, held: sys.inventory.held(), button: 'primary' }, dt);
    });
    window.__game.click('primary', hit.x, hit.y, hit.z);
  }, spot.gone);
  await until(ann, 'the block Bo broke gone from Ann\'s world', (at) => window.__game.block(at.x, at.y + 1, at.z).key !== 'oak_plank', spot.gone, 30_000);
  check('Bo breaks a block; it is gone for Ann', true, `Ann reads ${await ann.page.evaluate(placedKey, spot.gone) || 'air'} at ${spot.gone.x}, ${spot.gone.y + 1}, ${spot.gone.z}`);

  const heard = await bo.page.evaluate(() => window.__heard);
  const annHeard = await ann.page.evaluate(() => window.__heard);
  check('an event the rules emit near Ann reaches Bo\'s bus once, not twice', heard['block.placed'] === 2 && heard['crop.planted'] === 1 && annHeard['block.placed'] === 2,
    `Bo heard block.placed ${heard['block.placed']} times for Ann's two blocks, crop.planted ${heard['crop.planted']}, soil.tilled ${heard['soil.tilled']}, block.broken ${heard['block.broken']}; Ann heard block.placed ${annHeard['block.placed']}`);

  // A toast the rules give Ann alone: a plank on the town's ground is refused with words for whoever tried.
  const town = await ann.page.evaluate(() => {
    const p = window.__game.view.game.player.pos, sim = window.__game.view.world.sim, region = window.__game.view.game.systems.region;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz, y = sim.heightAt(x, z) - 1;
      if (Math.abs(dx) + Math.abs(dz) > 1 && region.isProtected(x, y + 1, z)) return { x, y, z };
    }
    return null;
  });
  const listen = (entry) => entry.page.evaluate(() => {
    window.__refused = 0;
    window.__game.view.game.events.on('toast', (e) => { if (/belongs to the town/.test(e.text)) window.__refused++; });
  });
  await Promise.all([listen(ann), listen(bo)]);
  if (town) {
    await useOn(ann, 'plank', town);
    await until(ann, 'the town\'s words to Ann', () => window.__refused > 0, undefined, 5000);
    await bo.page.evaluate(() => new Promise((done) => setTimeout(done, 500)));
  }
  const [annToast, boToast] = await Promise.all([ann, bo].map((e) => e.page.evaluate(() => window.__refused)));
  check('a toast the rules give Ann is hers alone: Bo does not hear it', town && annToast === 1 && boToast === 0,
    `Ann tried a plank on the town's ground at ${town ? `${town.x}, ${town.y + 1}, ${town.z}` : 'nowhere near'}; "This belongs to the town." reached Ann ${annToast} times and Bo ${boToast}`);

  // ------------------------------------------------------------------ the same day
  const [ca, cb] = await Promise.all([ann, bo].map((e) => e.page.evaluate(() => ({ ...window.__game.view.game.clock, step: window.__game.online.debug().step }))));
  const dayLength = await ann.page.evaluate(() => window.__game.view.game.systems.time.dayLength);
  const stepOfDay = 1 / (dayLength * 20);
  check('both pages show the same day and time of day, within a step', ca.day === cb.day && Math.abs(ca.timeOfDay - cb.timeOfDay) <= stepOfDay * 1.5,
    `Ann day ${ca.day} at ${ca.timeOfDay.toFixed(5)} (step ${ca.step}), Bo day ${cb.day} at ${cb.timeOfDay.toFixed(5)} (step ${cb.step}); one step is ${stepOfDay.toFixed(5)} of a day`);

  // ------------------------------------------------------------------ Ann walks with real keys
  // Toward the camera, so she walks into open ground in front of Bo and stays in his picture.
  const before = await debugOf(ann);
  await hold(ann, ['KeyS'], 900);
  const stopped = () => { const d = window.__game.online.debug(); return d.server && d.body.speed < 0.01 && Math.hypot(d.server.x - d.body.x, d.server.z - d.body.z) < 0.02; };
  await until(ann, 'Ann to stop and the server to agree', stopped);
  const after = await debugOf(ann);
  await until(bo, 'Bo to draw Ann where the server has her', ({ x, z }) => {
    const a = window.__game.view.game.actors.get('player:dev_ann');
    return a && Math.hypot(a.pos.x - x, a.pos.z - z) < 0.3;
  }, after.server);
  const annOnBo = await bo.page.evaluate(() => { const a = window.__game.view.game.actors.get('player:dev_ann'); return { x: a.pos.x, z: a.pos.z, visible: a.visible, sprite: a.sprite }; });
  const walked = Math.hypot(after.server.x - before.server.x, after.server.z - before.server.z);
  check('Ann walks with real keys; Bo\'s actor for her follows', walked > 2.5 && Math.hypot(annOnBo.x - after.server.x, annOnBo.z - after.server.z) < 0.3 && annOnBo.visible,
    `the server has Ann ${walked.toFixed(2)} blocks from where she began; Bo draws her at ${annOnBo.x.toFixed(2)}, ${annOnBo.z.toFixed(2)} as ${annOnBo.sprite}, the server at ${after.server.x.toFixed(2)}, ${after.server.z.toFixed(2)}`);

  const name = await bo.page.evaluate(() => [...document.querySelectorAll('.ol-name')].map((el) => ({ text: el.textContent, box: el.getBoundingClientRect().toJSON() })));
  await bo.page.screenshot({ path: resolve(shots, 'bo-sees-ann.png') });
  check('a screenshot from Bo\'s page shows Ann\'s name over her', name.some((n) => n.text === 'Ann' && n.box.x > 0 && n.box.y > 0 && n.box.x < 1280 && n.box.y < 800),
    `${resolve(shots, 'bo-sees-ann.png')}; labels ${JSON.stringify(name.map((n) => [n.text, Math.round(n.box.x), Math.round(n.box.y)]))}`);

  // The frame the hero first moved, against the frame after the key went down.
  const recorded = (await debugOf(ann, true)).frames;
  const down = (await ann.page.evaluate(() => window.__together.downs)).filter((d) => d.code === 'KeyS').at(-1);
  const firstAfter = recorded.findIndex((f) => f[0] > down.t);
  let movedAt = -1;
  for (let i = Math.max(1, firstAfter); i < recorded.length; i++) if (Math.abs(recorded[i][1] - recorded[firstAfter - 1][1]) > 1e-3) { movedAt = i; break; }
  const framesLate = movedAt - firstAfter;
  const msLate = movedAt >= 0 ? (recorded[movedAt][0] - down.t) * 1000 : NaN;
  // The first input that can carry the key is the one after the last sent before it. While the server's
  // answer names an older one, nothing the server said can have moved the hero.
  const firstWithKey = recorded[firstAfter - 1][4] + 1;
  const answer = recorded.find((f) => f[5] >= firstWithKey);
  const intervals = recorded.slice(1).map((f, i) => f[0] - recorded[i][0]).sort((p, q) => p - q);
  numbers.firstMoveFrames = framesLate;
  numbers.answerAfterMs = answer ? Math.round((answer[0] - down.t) * 1000) : null;
  numbers.medianFrameMs = Math.round(intervals[intervals.length >> 1] * 1000);
  check('Ann\'s own hero moves in the frame after the key goes down, not after the server answers', movedAt >= 0 && framesLate === 0 && recorded[movedAt][5] < firstWithKey,
    `the hero moved in the first frame drawn after the key went down (frame +${framesLate}, ${msLate.toFixed(0)} ms after it, frames are ${numbers.medianFrameMs} ms apart here); the server had used input ${recorded[movedAt]?.[5]} then, and the first that could carry the key is ${firstWithKey}; its answer came ${numbers.answerAfterMs} ms after the key`);

  // ------------------------------------------------------------------ a walk with turns and a jump
  const walkFrom = (await debugOf(ann, true)).frames.length;
  const gapBefore = (await debugOf(ann)).prediction;
  await hold(ann, ['KeyD'], 700);
  await ann.page.keyboard.down('KeyS');
  await sleep(500);
  await ann.page.keyboard.press('Space');
  await sleep(500);
  await ann.page.keyboard.up('KeyS');
  await hold(ann, ['KeyA', 'KeyW'], 700);
  await hold(ann, ['KeyW', 'Space'], 400);
  await hold(ann, ['KeyA'], 500);
  await until(ann, 'Ann to stand still and the server to agree', stopped);
  const walk = await debugOf(ann, true);
  const frames = walk.frames.slice(-Math.min(walk.frames.length, walk.frames.length - walkFrom + 30));
  let backwards = 0, biggest = 0;
  for (let i = 2; i < frames.length; i++) {
    const ax = frames[i - 1][1] - frames[i - 2][1], az = frames[i - 1][3] - frames[i - 2][3];
    const bx = frames[i][1] - frames[i - 1][1], bz = frames[i][3] - frames[i - 1][3];
    const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz), dt = frames[i][0] - frames[i - 1][0];
    if (lb > 0) biggest = Math.max(biggest, lb / Math.max(dt, 1 / 240));
    // Back against the way it was going: more than 120 degrees from the frame before.
    if (la > 0.004 && lb > 0.004 && (ax * bx + az * bz) / (la * lb) < -0.5) backwards++;
  }
  numbers.largestGap = Number(walk.prediction.maxGap.toFixed(4));
  numbers.fastestDrawn = Number(biggest.toFixed(2));
  check('through a walk with turns and a jump, the gap between Ann\'s hero and the server\'s stays small and never jumps back',
    walk.prediction.maxGap < 0.5 && walk.prediction.snapped === 0 && backwards === 0 && biggest < 8,
    `largest gap between where Ann's browser had her after an input and where the server had her after it: ${walk.prediction.maxGap.toFixed(4)} blocks over ${walk.prediction.answers} answers (${gapBefore.answers} before the walk); moved there at once: ${walk.prediction.snapped}; frames drawn going back: ${backwards} of ${frames.length}; fastest the drawn hero went: ${biggest.toFixed(2)} blocks a second (a walk is 4.4)`);

  // ------------------------------------------------------------------ bytes
  const measure = async (entry) => {
    const a = await entry.page.evaluate(() => ({ bytes: window.__together.bytes, t: performance.now() / 1000, fields: { ...window.__together.fields } }));
    return a;
  };
  const [a0, b0] = await Promise.all([measure(ann), measure(bo)]);
  const walking = hold(ann, ['KeyD'], 2500).then(() => hold(ann, ['KeyA'], 2500));
  await walking;
  const [a1, b1] = await Promise.all([measure(ann), measure(bo)]);
  const rate = (x, y) => Math.round((y.bytes - x.bytes) / (y.t - x.t));
  const fields = Object.entries(b1.fields).map(([k, v]) => [k, v - (b0.fields[k] ?? 0)]).sort((p, q) => q[1] - p[1]);
  numbers.annBytesPerSecond = rate(a0, a1);
  numbers.boBytesPerSecond = rate(b0, b1);
  numbers.boBiggestFields = fields.slice(0, 5).map(([k, v]) => `${k} ${Math.round(v / (b1.t - b0.t))} B/s`);
  console.log(`info bytes received a second while Ann walks: Ann ${numbers.annBytesPerSecond}, Bo ${numbers.boBytesPerSecond}; Bo's biggest fields: ${numbers.boBiggestFields.join(', ')}`);

  // ------------------------------------------------------------------ Ann leaves
  const closedAt = Date.now();
  await ann.page.close();
  await ann.context.close();
  await until(bo, 'Ann gone from Bo\'s world', () => !window.__game.view.game.actors.has('player:dev_ann'), undefined, 10_000);
  const goneIn = (Date.now() - closedAt) / 1000;
  numbers.goneSeconds = Number(goneIn.toFixed(2));
  check('Ann closes her page: she is gone from Bo\'s within five seconds', goneIn < 5, `gone after ${goneIn.toFixed(2)} s`);

  // ------------------------------------------------------------------ the server stops and starts under Bo
  // The block is kept once a save has come after it: the world saves five seconds after a player changes it.
  await (async () => {
    for (let i = 0; i < 200; i++) {
      const stats = await server.stats(WORLD);
      if (stats.lastSave && stats.saves > 0) return;
      await sleep(100);
    }
  })();
  await bo.page.evaluate(() => { window.__samePage = true; });
  restarting = true;
  const stoppedPid = server.pid;
  await server.stop();
  server = await startServer({ port: PORT, name: 'together', fresh: false });
  await until(bo, 'Bo to join again by himself', () => { const d = window.__game.online.debug(); return d.ready && d.welcomes >= 2; }, undefined, 60_000);
  restarting = false;
  const boAfter = await bo.page.evaluate((at) => ({ same: window.__samePage === true, block: window.__game.block(at.x, at.y + 1, at.z).key, debug: window.__game.online.debug() }), spot.keep);
  // A client of the server's own checks asks the restarted server what it has there.
  const cy = await joinWorld(server, WORLD, 'cy');
  let serverHas = null;
  const cell = cellIndex(spot.keep.x & 15, spot.keep.y + 1, spot.keep.z & 15);
  const off = cy.net.onSnap((snap) => {
    const chunk = snap.chunks?.find(([cx, cz]) => cx === spot.keep.x >> 4 && cz === spot.keep.z >> 4);
    const at = chunk ? chunk[2].findIndex((value, i) => i % 2 === 0 && value === cell) : -1;
    if (at >= 0) serverHas = chunk[2][at + 1];
  });
  await sleep(1000);
  off();
  await cy.leave();
  const boFrom = boAfter.debug.server;
  await hold(bo, ['KeyW'], 800);
  await until(bo, 'Bo to walk after the restart', (from) => { const d = window.__game.online.debug(); return d.server && Math.hypot(d.server.x - from.x, d.server.z - from.z) > 1; }, boFrom);
  check('the server is stopped and started: Bo carries on without a reload, and the block is still there', boAfter.same && boAfter.block === 'oak_plank' && serverHas === blockId('oak_plank'),
    `server pid ${stoppedPid} stopped, ${server.pid} started; Bo's page is the same page: ${boAfter.same}; Bo joined ${boAfter.debug.welcomes} times; Bo reads ${boAfter.block} at ${spot.keep.x}, ${spot.keep.y + 1}, ${spot.keep.z}, and the restarted server tells a new player block ${serverHas} there (oak planks are ${blockId('oak_plank')}); Bo walked after it; Chrome printed ${bo.allowed} failed reconnects while the server was down`);

  // ------------------------------------------------------------------ a page with another build
  const old = await open(browser, 'Old', { build: 'a-build-from-last-week' });
  await until(old, 'the refusal', () => window.__game?.online?.status === 'refused');
  const words = await old.page.evaluate(() => ({ refusal: window.__game.online.refusal, notice: document.querySelector('.ol-notice')?.textContent ?? '' }));
  await old.page.screenshot({ path: resolve(shots, 'old-build-refused.png') });
  check('a third page with a wrong build gets the reload words', words.refusal?.why === 'reload' && words.notice.includes('Reload the page'),
    `${resolve(shots, 'old-build-refused.png')}; the notice reads "${words.notice}"`);
  await old.page.getByRole('button', { name: 'Play solo' }).click();
  await until(old, 'the solo title', () => window.__game?.online === null && !location.search.includes('world=') && !!document.querySelector('[data-key="title:new"]'), undefined, 60_000);
  await old.page.locator('[data-key="title:new"]').click();
  await until(old, 'a solo game', () => window.__game.started === true, undefined, 30_000);
  const solo = await old.page.evaluate(() => ({ started: window.__game.started, online: window.__game.online, url: location.href }));
  check('it can still start a solo game', solo.started && solo.online === null, `Play solo opened ${solo.url}, and New game started a game with no world server`);

  // ------------------------------------------------------------------ a link opened by someone signed out
  const guest = await open(browser, 'Guest', { url: `http://127.0.0.1:${PORT}/?world=${WORLD}&quality=low` });
  await until(guest, 'the sign-in notice', () => window.__game?.online?.status === 'signin' && !!document.querySelector('.ol-notice:not([hidden])'));
  const asked = await guest.page.evaluate(() => ({ notice: document.querySelector('.ol-notice')?.textContent ?? '', started: window.__game.online.debug().ready }));
  await guest.page.screenshot({ path: resolve(shots, 'signed-out.png') });
  check('a world\'s link opened signed out asks the player to sign in first', asked.notice.startsWith('Sign in to join this world.') && !asked.started,
    `${resolve(shots, 'signed-out.png')}; the notice reads "${asked.notice}"`);

  for (const entry of pages) check(`no console errors on ${entry.name}'s page`, entry.errors.length === 0, entry.errors.slice(0, 3).join(' | '));
} catch (error) {
  check('the check ran to the end', false, error instanceof Error ? error.stack ?? error.message : String(error));
  for (const entry of pages) {
    if (entry.errors.length) console.log(`     ${entry.name}'s console: ${entry.errors.slice(0, 5).join(' | ')}`);
    const state = await entry.page.evaluate(() => { const d = window.__game?.online?.debug(); return d && { status: d.status, net: d.net, step: d.step, ack: d.ack, waiting: d.waiting, server: d.server, body: d.body, bag: window.__game.state().bag, held: window.__game.state().held }; }).catch(() => null);
    if (state) console.log(`     ${entry.name}: ${JSON.stringify(state)}`);
  }
  const stats = await server?.stats(WORLD).catch(() => null);
  if (stats) console.log(`     the world: ${JSON.stringify({ players: stats.players, steps: stats.steps, inputsDropped: stats.inputsDropped, messagesIn: stats.messagesIn })}`);
} finally {
  await browser?.close().catch(() => undefined);
  await server?.stop().catch(() => undefined);
}

const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${JSON.stringify(numbers)}`);
console.log(failed === 0 ? `PASS: ${checks.length} checks, ${((Date.now() - t0) / 1000).toFixed(0)} s` : `FAIL: ${failed} of ${checks.length} checks`);
process.exit(failed === 0 ? 0 : 1);

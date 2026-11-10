// The sound walk: plays a three-minute walk through the real game and records what a player would hear, with
// three pictures a second, then muxes the two into a video. After the walk it plays each footstep set
// and each recorded bed alone, for listening to one thing at a time.
//   bun tools/sound-walk.mjs --dist dist-sound --port 5390 --out <folder>
//
// This Mac draws WebGL in software, at a frame or two a second, which would starve the music's scheduler in real
// time. So the walk runs in lockstep: the page's AudioContext is swapped for an OfflineAudioContext before the
// game loads, the rules are stepped by hand, and the sound is rendered 50 ms at a time between steps. The engine,
// the views and the recordings are the game's own; only the clock is held. The server is stopped by its pid.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', 5390));
const DIST = opt('dist', 'dist-sound');
const OUT = resolve(opt('out', resolve(root, '.artifacts/sound/walk')));
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const RATE = 44100;
/** Seconds of game per picture, and the sound is rendered this many times a picture. */
const FRAME = 1 / 3, SUB = 6;
/** Room in the offline buffer: the walk, then the footstep sets and the beds alone. */
const BUFFER_SECONDS = 420;
const frames = resolve(OUT, 'frames');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

// Before any of the game's code runs: every AudioContext the page makes is an offline one, held by the tool.
const patch = `(() => {
  const Offline = window.OfflineAudioContext;
  window.__walk = { ctx: null, rendering: null, at: 0 };
  window.AudioContext = function () {
    const ctx = new Offline(2, ${BUFFER_SECONDS * RATE}, ${RATE});
    window.__walk.ctx = ctx;
    // The game resumes its context on a click or a key. Here only the tool moves the clock.
    const resume = ctx.resume.bind(ctx);
    ctx.resume = () => (window.__walk.allow ? resume() : Promise.resolve());
    ctx.suspend = ((suspend) => (t) => (t === undefined ? Promise.resolve() : suspend(t)))(ctx.suspend.bind(ctx));
    return ctx;
  };
})();`;

const server = spawn('bun', ['tools/serve.mjs', DIST, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => { text += chunk; const m = /pid (\d+)/.exec(text); if (m) done(Number(m[1])); });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving ${DIST} on ${PORT}, pid ${serverPid}`);

const errors = [];
const timeline = [];
let browser;
try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
  page.setDefaultTimeout(300000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(patch);
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=low`);
  await page.waitForFunction(() => window.__game !== undefined);
  console.log('the game is up');
  await page.evaluate(() => window.__game.newGame());
  await page.waitForTimeout(2500);
  // The opening scene's Skip button may still be moving in: click it where it is, and give up after 15 s.
  const skip = await page.$('[data-key="opening:skip"]');
  if (skip) await skip.click({ force: true, timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  // The first key starts the sound engine, on the offline context.
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => window.__game.view.audio !== null);
  console.log('the sound engine started on the offline context');
  // Every recording decoded before the walk starts, as after the first seconds of play.
  await page.waitForFunction(() => ['bed.town.murmur', 'bed.meadow.day', 'step.grass', 'step.cobble', 'hit.chop', 'hit.dig', 'spot.well', 'shot.treefall'].every((id) => window.__game.view.audio.hasSample(id)), null, { timeout: 120000 });

  console.log(`the recordings are decoded; the hero is ${(await page.evaluate(() => window.__game.view.game.player.busy)) ? 'busy' : 'free'}`);
  // Helpers in the page: render the sound up to a time, steer the hero along nav routes, read the state.
  await page.evaluate(() => {
    const g = window.__game, v = g.view, sys = v.game.systems, P = v.game.player, w = window.__walk;
    g.manual(true);
    // Each render stops on a 128-sample boundary. Steps count from a running target, never from where the last
    // one stopped, so rounding never adds up and the sound keeps time with the pictures.
    w.target = 0;
    w.step = (seconds) => { w.target += seconds; return w.renderTo(w.target); };
    w.renderTo = (t) => new Promise((done) => {
      // A suspension lands on a render quantum: ask for the one at or after t.
      const q = Math.ceil((t * w.ctx.sampleRate) / 128) * 128 / w.ctx.sampleRate;
      w.ctx.suspend(q).then(() => { w.at = q; w.allow = false; done(q); });
      w.allow = true;
      if (w.rendering) void w.ctx.resume();
      else w.rendering = w.ctx.startRendering();
    });
    w.release = () => { for (const k of ['w', 'a', 's', 'd', 'shift']) g.key(k, false); };
    w.steer = (tx, tz) => {
      const yaw = v.camera.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const dx = tx - P.pos.x, dz = tz - P.pos.z, len = Math.hypot(dx, dz) || 1;
      const forward = (dx * fx + dz * fz) / len, right = (dx * rx + dz * rz) / len;
      g.key('w', forward > 0.38); g.key('s', forward < -0.38);
      g.key('d', right > 0.38); g.key('a', right < -0.38);
    };
    w.route = null; w.leg = null; w.check = null; w.since = 0;
    /** One step of walking toward the goal along a nav route. Returns the distance left. */
    w.walkStep = (goal, soft) => {
      const d = Math.hypot(P.pos.x - goal.x, P.pos.z - goal.z);
      if (d < 0.9) { w.release(); w.route = null; return d; }
      if (!w.route || w.leg !== goal || w.at >= w.route.length) {
        w.route = sys.nav.toward(P.pos, { x: Math.floor(goal.x) + 0.5, y: P.pos.y, z: Math.floor(goal.z) + 0.5 }, 6000) ?? [goal];
        w.leg = goal; w.i = 0;
      }
      while (w.i < w.route.length - 1 && Math.hypot(P.pos.x - w.route[w.i].x, P.pos.z - w.route[w.i].z) < 0.6) w.i++;
      const t = w.route[w.i] ?? goal;
      g.key('shift', Boolean(soft));
      w.steer(t.x, t.z);
      w.since += 0.05;
      if (w.since >= 1) {
        if (w.check && Math.hypot(P.pos.x - w.check.x, P.pos.z - w.check.z) < 0.4) { g.key('space'); w.route = null; }
        w.check = { x: P.pos.x, z: P.pos.z };
        w.since = 0;
      }
      return d;
    };
    w.state = () => {
      const d = v.audio.debug();
      return { x: P.pos.x, y: P.pos.y, z: P.pos.z, t: w.at, lead: d.lead, bpm: d.bpm, key: d.key, chord: d.chord, town: d.weights.town ?? 0, voices: d.voices, refused: d.dropped, hour: v.game.ambient.timeOfDay * 24 };
    };
  });

  /** One picture: draws a frame (the views follow the hero and the engine schedules ahead), then 0.2 s of game. */
  let shots = 0, label = '';
  async function frame(drive) {
    await page.evaluate(() => window.__game.frames(1));
    await page.screenshot({ path: resolve(frames, `${String(shots++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 70 });
    const s = await page.evaluate(async ({ drive, FRAME, SUB }) => {
      const w = window.__walk, g = window.__game;
      let left = 0;
      for (let k = 0; k < SUB; k++) {
        if (drive?.goal) left = w.walkStep(drive.goal, drive.soft);
        g.advance(FRAME / SUB);
        // The views that listen to frames are not called between pictures, so the engine is called here.
        g.view.audio.update(FRAME / SUB);
        await w.step(FRAME / SUB);
      }
      return { ...w.state(), left };
    }, { drive, FRAME, SUB });
    timeline.push({ ...s, label });
    return s;
  }
  async function wait(seconds, name) {
    label = name;
    for (let t = 0; t < seconds; t += FRAME) await frame(null);
  }
  async function walk(goal, name, { soft = false, limit = 90 } = {}) {
    label = name;
    for (let t = 0; t < limit; t += FRAME) {
      const s = await frame({ goal, soft });
      if (s.left < 0.9) break;
    }
    await page.evaluate(() => window.__walk.release());
  }
  const log = (text) => { const s = timeline[timeline.length - 1]; console.log(`${s ? s.t.toFixed(1).padStart(6) : '     0'} s  ${text}`); };

  // A sunny morning, at the grant stone.
  await page.evaluate(() => { const g = window.__game; g.setTime(9.4 / 24); g.teleport(-12, -236); });
  await page.evaluate(() => window.__game.settle());
  await page.evaluate(() => window.__walk.step(0.06));

  // The thickest stand on the way is the row of oaks and birches north of the grant and the three oaks over the
  // mossy rocks (src/game/content/region.ts). Wild trees near the path stand too far apart to walk under.
  const through = [{ x: -24, z: -250.5 }, { x: -16, z: -251 }, { x: -8, z: -251 }, { x: -1, z: -249 }, { x: 4, z: -244 }, { x: 5, z: -237 }, { x: 10, z: -235.5 }];

  log('meadow'); await wait(6, 'meadow');
  await walk({ x: -20, z: -238 }, 'meadow');
  await walk({ x: -25, z: -244 }, 'meadow', { soft: true, limit: 6 });
  log('through the trees');
  for (const p of through) await walk(p, 'trees', { limit: 20 });
  await wait(3, 'trees');
  await walk({ x: 16, z: -224 }, 'trees');
  log('onto the path');
  await walk({ x: 70, z: -221 }, 'path');
  await walk({ x: 92, z: -221 }, 'path');
  await walk({ x: 118, z: -188 }, 'path');
  log('the gate');
  await walk({ x: 134, z: -174 }, 'gate');
  await walk({ x: 156.5, z: -174 }, 'street');
  log('into the square');
  await walk({ x: 156.5, z: -163 }, 'square');
  await walk({ x: 170, z: -152 }, 'square');
  await wait(8, 'square');
  await walk({ x: 176, z: -144 }, 'square');
  log('the bank');
  await walk({ x: 173, z: -133 }, 'bank');
  await wait(9, 'bank');
  await walk({ x: 196.5, z: -128 }, 'bank');
  await wait(4, 'bank');
  log('back out by the street and the gate');
  await walk({ x: 191, z: -160 }, 'street');
  await walk({ x: 191, z: -174 }, 'street');
  await walk({ x: 134, z: -174 }, 'gate');
  await walk({ x: 122, z: -181 }, 'path');

  // A chop and a dig, by the path outside town.
  label = 'chop';
  log('a chop');
  await page.evaluate(() => window.__game.give('axe'));
  const slot = await page.evaluate(() => window.__game.view.game.systems.inventory.slots.findIndex((s) => s && s.item === 'axe'));
  if (slot >= 0 && slot < 9) await page.keyboard.press(`Digit${slot + 1}`);
  const tree = await page.evaluate(() => {
    const sys = window.__game.view.game.systems, P = window.__game.view.game.player;
    const t = sys.trees.all().filter((t) => t.standing && !sys.region.isProtected(t.x, t.y, t.z) && t.x < 128)
      .sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0];
    if (!t) return null;
    const stand = sys.nav.near({ x: t.x + 0.5, y: t.y, z: t.z + 0.5 }, 1.5, (sx, sz) => sx === t.x && sz === t.z);
    return { x: t.x, y: t.y, z: t.z, stand };
  });
  if (tree?.stand) {
    await walk({ x: tree.stand.x, z: tree.stand.z }, 'chop', { limit: 25 });
    const at = await page.evaluate(({ x, y, z }) => window.__game.view.project(x + 0.5, y + 0.6, z + 0.5), tree);
    if (at) {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (let t = 0; t < 14; t += FRAME) {
        await frame(null);
        if (!(await page.evaluate(({ x, y, z }) => window.__game.view.game.systems.trees.all().some((t) => t.x === x && t.z === z && t.standing), tree))) break;
      }
      await page.mouse.up();
      await wait(2.5, 'chop');
    }
  }
  label = 'dig';
  log('a dig');
  const dug = await page.evaluate(() => {
    const g = window.__game, P = g.view.game.player;
    for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2]]) {
      const x = Math.floor(P.pos.x) + dx, z = Math.floor(P.pos.z) + dz, y = Math.floor(P.pos.y) - 1;
      const key = g.block(x, y, z).key;
      if (key === 'grass' || key === 'dirt' || key === 'path') return { x, y, z, key };
    }
    return null;
  });
  if (dug) {
    const at = await page.evaluate(({ x, y, z }) => window.__game.view.project(x + 0.5, y + 1, z + 0.5), dug);
    if (at) {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (let t = 0; t < 8; t += FRAME) {
        await frame(null);
        if ((await page.evaluate(({ x, y, z }) => window.__game.block(x, y, z).key, dug)) !== dug.key) break;
      }
      await page.mouse.up();
    }
  }
  await wait(1.5, 'dig');
  log('back out along the path');
  await walk({ x: 92, z: -221 }, 'out', { limit: 30 });
  await wait(2, 'out');
  const walkEnd = timeline[timeline.length - 1].t;
  log('walk done');

  // ---- each footstep set alone, then each bed alone, with the music and the rest of the air down.
  // The game's own frames stop first, so its sound view no longer sets the beds.
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(3000);
  const pieces = await page.evaluate(async ({ RATE }) => {
    const w = window.__walk, a = window.__game.view.audio;
    const out = [];
    a.setVolume('music', 0);
    a.setVolume('ambience', 0);
    // Let the music and the air fall away.
    for (let k = 0; k < 40; k++) { a.update(0.05); await w.step(0.05); }
    const at = { x: 0, y: 0, z: 0 };
    a.setListener(at, 0);
    a.setState({ indoors: 0, stone: 0, trees: 0, town: 0 });
    const steps = ['grass', 'dirt', 'path', 'cobble', 'stone', 'wood', 'floor', 'sand', 'water', 'leaves'];
    for (const material of steps) {
      const start = w.at;
      for (const [gait, rate, seconds] of [['walk', 1 / 5.5, 3], ['soft', 1 / 2.5, 2], ['run', 1 / 7.5, 1.6]]) {
        for (let t = 0; t < seconds; t += 0.05) {
          if (Math.floor((t + 0.05) / rate) > Math.floor(t / rate)) a.emit({ type: 'footstep', surface: 'grass', at, material, gait, cloth: 0.35 });
          a.update(0.05);
          await w.step(0.05);
        }
      }
      a.emit({ type: 'land', surface: 'grass', at, material });
      for (let k = 0; k < 16; k++) { a.update(0.05); await w.step(0.05); }
      out.push({ name: `steps-${material}`, start, end: w.at });
    }
    a.setVolume('effects', 0);
    a.setVolume('ambience', 0.7);
    const beds = ['bed.town.murmur', 'bed.town.square', 'bed.town.birds', 'bed.town.water', 'bed.town.workshop', 'bed.town.night', 'bed.town.lantern', 'bed.meadow.day', 'bed.forest.day', 'bed.meadow.night'];
    // The made wind and leaves stay quiet: no wind, no trees.
    a.followAmbient({ ...window.__game.view.game.ambient, wind: 0, rain: 0 });
    for (const bed of beds) {
      for (const other of beds) a.setBed(other, other === bed ? 1 : 0, null);
      for (let k = 0; k < 30; k++) { a.update(0.05); await w.step(0.05); }
      const start = w.at;
      for (let k = 0; k < 200; k++) { a.update(0.05); await w.step(0.05); }
      out.push({ name: bed.replace(/^bed\./, 'bed-').replace(/\./g, '-'), start, end: w.at });
    }
    return out;
  }, { RATE });

  // Render the rest of the buffer, and hand the samples over in pieces.
  const total = await page.evaluate(async () => {
    const w = window.__walk;
    w.allow = true;
    void w.ctx.resume();
    w.buffer = await w.rendering;
    return w.buffer.length;
  });
  console.log(`rendered ${(total / RATE).toFixed(1)} s`);
  const take = async (from, to) => {
    const parts = [];
    const step = RATE * 20;
    for (let s = Math.floor(from * RATE); s < Math.floor(to * RATE); s += step) {
      const b64 = await page.evaluate(({ s, n }) => {
        const buf = window.__walk.buffer, L = buf.getChannelData(0), R = buf.getChannelData(1);
        const out = new Int16Array(n * 2);
        for (let i = 0; i < n; i++) {
          out[i * 2] = Math.max(-32768, Math.min(32767, Math.round(L[s + i] * 32767)));
          out[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(R[s + i] * 32767)));
        }
        let text = '';
        const bytes = new Uint8Array(out.buffer);
        for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(text);
      }, { s, n: Math.min(step, Math.floor(to * RATE) - s) });
      parts.push(Buffer.from(b64, 'base64'));
    }
    return Buffer.concat(parts);
  };
  const wav = (pcm) => {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(RATE, 24);
    h.writeUInt32LE(RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
  };
  writeFileSync(resolve(OUT, 'walk.wav'), wav(await take(0, walkEnd)));
  for (const p of pieces) writeFileSync(resolve(OUT, `${p.name}.wav`), wav(await take(p.start, p.end)));
  writeFileSync(resolve(OUT, 'timeline.json'), JSON.stringify({ frame: FRAME, walkEnd, pieces, timeline }, null, 1));

  // The pictures at five a second, and the sound under them.
  // The pictures' rate from the sound's length, so the video ends with the sound whatever the rounding did.
  const mux = spawnSync(FFMPEG, ['-v', 'error', '-y', '-framerate', String(shots / walkEnd), '-i', resolve(frames, '%05d.jpg'), '-i', resolve(OUT, 'walk.wav'),
    '-c:v', 'libx264', '-crf', '26', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-shortest', resolve(OUT, 'walk.mp4')], { stdio: 'inherit' });
  if (mux.status !== 0) throw new Error('ffmpeg could not make the video');
  // The pictures are in the video now. The disk this runs on is shared and small.
  rmSync(frames, { recursive: true, force: true });
  console.log(`wrote ${OUT}/walk.mp4, walk.wav, ${pieces.length} pieces, timeline.json`);
  console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
} finally {
  await browser?.close();
  process.kill(serverPid);
}

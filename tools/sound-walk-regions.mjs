// The region walk: the hero runs across Greenhollow in the real game (the Old Forest, your plot, the High Road,
// the grey forest, the terraces, the caves, Hollowmere, Lantern Marsh, and south toward Saltgate) while the
// tool records what a player would hear and logs, four times a second, which region's music leads, the music's
// weights and tempo, and every recorded bed the game sets. It checks that each region is heard where the plan
// puts it and that every change of region is a crossfade, not a cut. tools/sound-walk.mjs is the town walk.
//   bunx vite build --outDir dist-sound && bun tools/sound-walk-regions.mjs --dist dist-sound --port <port>
//   bun tools/sound-walk-regions.mjs --from .artifacts/sound/region-walk/timeline.json   the checks on a saved walk
//
// Like the town walk it runs in lockstep: the page's AudioContext is an OfflineAudioContext held by the tool,
// and the sound is rendered between steps. The hero is carried along the route at a run (6 blocks a second),
// one frame drawn a step, so the land's sound view reads the same positions a player's would. The server is
// stopped by its pid. Exits 1 when a check fails.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toWorld } from '../src/game/content/greenhollow.ts';
import { placeAt } from '../src/game/region/greenhollow.sim.ts';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const PORT = Number(opt('port', process.env.PLAY_PORT ?? 5390));
const DIST = opt('dist', 'dist-sound');
const OUT = resolve(opt('out', resolve(root, '.artifacts/sound/region-walk')));
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const RATE = 44100;
/** Game seconds a step, and blocks a second: a run. */
const STEP = 0.25, SPEED = 6;
/** A picture every this many steps. */
const SHOT_EVERY = 16;

// The route, as [label, place id or map point]. Each region the brief names, in an order a person could run.
const ROUTE = [
  ['the Old Forest', 'seedvault'], ['the Old Forest', [262, 290]], ['the dead garden', 'garden'], ['your plot', 'plot'],
  ['the High Road', [404, 222]], ['the grey forest', 'boar'], ['the Old Gate', [455, 160]], ['the terraces', 'terraces'],
  ['the grey forest', [520, 190]], ['the caves', [720, 250]], ['the caves', 'caves'], ['the chapel', 'chapel'],
  ['Hollowmere', 'town'], ['the quay', [600, 400]], ['Lantern Marsh', [700, 440]], ['Lantern Marsh', 'shrine-marsh'],
  ['the south fields', [560, 560]], ['toward Saltgate', [404, 596]],
];
/**
 * Where each region must lead the music, by the label of the point the hero has just reached. The Old Gate and
 * the dead garden stand on a border, where either land may lead, so they have no line here.
 */
const EXPECT = {
  'the Old Forest': 'oldForest', 'your plot': 'meadow', 'the High Road': 'highRoad', 'the grey forest': 'greyForest',
  'the terraces': 'terraces', 'the caves': 'caves', Hollowmere: 'town', 'Lantern Marsh': 'marsh', 'toward Saltgate': 'mere',
};
/** The bed each region must be playing when the hero stands there. */
const EXPECT_BED = {
  'the Old Forest': 'bed.oldforest.day', 'the High Road': 'bed.highroad.wind', 'the grey forest': 'bed.greyforest',
  'the terraces': 'bed.greyforest', 'the caves': 'bed.caves', Hollowmere: 'bed.town.murmur', 'Lantern Marsh': 'bed.marsh', 'toward Saltgate': 'bed.saltgate',
};

const points = ROUTE.map(([label, at]) => ({ label, ...(typeof at === 'string' ? placeAt(at) : toWorld(at)) }));
let length = 0;
for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
// Four seconds at the start and two at each point, as the walk below stands; the sound buffer has room past it,
// since a step asked of an offline context past its end never comes back.
const seconds = length / SPEED + 4 + 2 * (points.length - 1);
const BUFFER_SECONDS = Math.ceil(seconds + 20);
console.log(`the route is ${Math.round(length)} blocks, ${seconds.toFixed(0)} s at a run with the stops`);

/** The steps of the opening stand: the hero is put at the start in one jump, which is not a walk. */
const OPENING = Math.round(4 / STEP) + 1;

let failures = 0;
const line = (pass, text) => { if (!pass) failures++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${text}`); };

/** The checks, on a walk's log and the steps where it reached each point. Returns every change of lead. */
function check(log, reached) {
  for (const r of reached) {
    const want = EXPECT[r.label];
    if (want) line(r.lead === want, `at ${r.label} (${r.x}, ${r.z}) the music is ${r.lead}${r.lead === want ? '' : `, not ${want}`}`);
    const bed = EXPECT_BED[r.label];
    if (bed) line((r.beds[bed] ?? 0) > 0.3, `at ${r.label} the bed ${bed} plays at ${r.beds[bed] ?? 0}`);
  }
  // A crossfade: no weight moves much faster than the engine's ease (0.6 a second; the sum is renormalised when
  // three lands share the air), and before each change of lead both lands are heard together a second or more.
  let worst = 0;
  const changes = [];
  for (let i = OPENING + 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i];
    for (const id of new Set([...Object.keys(a.weights), ...Object.keys(b.weights)])) worst = Math.max(worst, Math.abs((b.weights[id] ?? 0) - (a.weights[id] ?? 0)));
    if (a.lead !== b.lead) {
      let from = i;
      while (from > 0 && (log[from - 1].weights[b.lead] ?? 0) > 0.1) from--;
      changes.push({ t: b.t, from: a.lead, to: b.lead, together: b.t - log[from].t });
    }
  }
  line(worst <= 0.3, `largest change of a music weight in a ${STEP} s step: ${worst.toFixed(2)} (the engine eases at 0.6 a second, ${(0.6 * STEP).toFixed(2)} a step; 0.3 allowed)`);
  for (const c of changes) line(c.together >= 1, `${c.t.toFixed(1).padStart(6)} s  ${c.from} -> ${c.to}, the two heard together for ${c.together.toFixed(1)} s before`);
  // A bed never jumps either. The view sets the beds as often as it draws, which in this lockstep is about once
  // a second, so a bed is measured by how much it changes for each block walked since it last changed: the
  // steepest fade of the soundscape is 0.125 a block, and the engine glides each level over 0.9 s on top
  // (setRecorded in src/features/audio/ambience.ts).
  let bedRate = 0, bedAt = null;
  const last = {};
  for (let i = OPENING + 1; i < log.length; i++) {
    const now = log[i];
    for (const id of new Set([...Object.keys(log[i - 1].beds), ...Object.keys(now.beds)])) {
      const was = last[id] ?? { level: log[OPENING].beds[id] ?? 0, x: log[OPENING].x, z: log[OPENING].z };
      const level = now.beds[id] ?? 0;
      if (level === was.level) continue;
      const rate = Math.abs(level - was.level) / Math.max(1, Math.hypot(now.x - was.x, now.z - was.z));
      if (rate > bedRate) { bedRate = rate; bedAt = `${id} at ${now.t.toFixed(1)} s`; }
      last[id] = { level, x: now.x, z: now.z };
    }
  }
  line(bedRate <= 0.2, `steepest change of a bed's level: ${bedRate.toFixed(3)} a block walked (${bedAt}); 0.2 allowed`);
  return changes;
}

// `--from <timeline.json>` checks a saved walk again without walking it.
const FROM = opt('from', null);
if (FROM) {
  const saved = JSON.parse(readFileSync(resolve(FROM), 'utf8'));
  check(saved.log, saved.reached);
  process.exit(failures ? 1 : 0);
}

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
const log = [];
let browser;
try {
  browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  page.setDefaultTimeout(300000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(patch);
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=low`);
  await page.waitForFunction(() => window.__game !== undefined);
  await page.evaluate(() => window.__game.newGame());
  await page.waitForTimeout(2500);
  const skip = await page.$('[data-key="opening:skip"]');
  if (skip) await skip.click({ force: true, timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  // The first key starts the sound engine, on the offline context.
  await page.keyboard.press('KeyQ');
  await page.waitForFunction(() => window.__game.view.audio !== null);
  const beds = Object.values(EXPECT_BED);
  await page.waitForFunction((ids) => ids.every((id) => window.__game.view.audio.hasSample(id)), [...new Set(beds)], { timeout: 120000 });
  console.log('the sound engine is up and the region beds are decoded');

  await page.evaluate(() => {
    const g = window.__game, v = g.view, w = window.__walk, a = v.audio;
    g.manual(true);
    // A clear late morning, so the day's beds play.
    g.setTime(10 / 24);
    w.target = 0;
    w.step = (s) => { w.target += s; return w.renderTo(w.target); };
    w.renderTo = (t) => new Promise((done) => {
      const q = Math.ceil((t * w.ctx.sampleRate) / 128) * 128 / w.ctx.sampleRate;
      w.ctx.suspend(q).then(() => { w.at = q; w.allow = false; done(q); });
      w.allow = true;
      if (w.rendering) void w.ctx.resume();
      else w.rendering = w.ctx.startRendering();
    });
    // Every level the game's sound view gives a recorded bed, as it gives it.
    w.beds = {};
    const setBed = a.setBed.bind(a);
    a.setBed = (id, level, at) => { w.beds[id] = level; setBed(id, level, at); };
  });

  // Walks the route: each step moves the hero, draws one frame (the sound view looks), and renders the sound.
  let shots = 0, steps = 0, label = points[0].label;
  async function stepTo(x, z) {
    await page.evaluate(({ x, z }) => window.__game.teleport(x, z), { x, z });
    await page.evaluate(() => window.__game.frames(1));
    if (steps++ % SHOT_EVERY === 0) await page.screenshot({ path: resolve(frames, `${String(shots++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 70 });
    const s = await page.evaluate(async (STEP) => {
      const g = window.__game, w = window.__walk, a = g.view.audio;
      g.advance(STEP);
      a.update(STEP);
      await w.step(STEP);
      const d = a.debug();
      const beds = {};
      for (const id in w.beds) if (w.beds[id] > 0.02) beds[id] = Math.round(w.beds[id] * 100) / 100;
      const weights = {};
      for (const id in d.weights) if (d.weights[id] > 0.01) weights[id] = Math.round(d.weights[id] * 100) / 100;
      return { t: w.at, lead: d.lead, bpm: Math.round(d.bpm * 10) / 10, chord: d.chord, bar: d.bar, beat: d.beat, weights, beds, voices: d.voices, refused: d.dropped };
    }, STEP);
    log.push({ ...s, x: Math.round(x), z: Math.round(z), label });
    return s;
  }

  await stepTo(points[0].x, points[0].z);
  for (let k = 0; k < 4 / STEP; k++) await stepTo(points[0].x, points[0].z);
  const reached = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (SPEED * STEP)));
    for (let k = 1; k <= n; k++) await stepTo(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n);
    label = b.label;
    // Two seconds at each point, so the region there has the air to itself.
    for (let k = 0; k < 2 / STEP; k++) await stepTo(b.x, b.z);
    const s = log[log.length - 1];
    reached.push({ ...s, label: b.label });
    console.log(`${s.t.toFixed(1).padStart(6)} s  ${b.label.padEnd(16)} lead ${s.lead.padEnd(10)} ${s.bpm} bpm  music ${JSON.stringify(s.weights)}  beds ${JSON.stringify(s.beds)}`);
  }
  const walkEnd = log[log.length - 1].t;

  const changes = check(log, reached);

  // ---- the sound and the pictures
  const total = await page.evaluate(async () => {
    const w = window.__walk;
    w.allow = true;
    void w.ctx.resume();
    w.buffer = await w.rendering;
    return w.buffer.length;
  });
  console.log(`rendered ${(total / RATE).toFixed(1)} s`);
  const pcm = [];
  for (let s = 0; s < Math.floor(walkEnd * RATE); s += RATE * 20) {
    const n = Math.min(RATE * 20, Math.floor(walkEnd * RATE) - s);
    pcm.push(Buffer.from(await page.evaluate(({ s, n }) => {
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
    }, { s, n }), 'base64'));
  }
  const data = Buffer.concat(pcm);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(resolve(OUT, 'walk.wav'), Buffer.concat([h, data]));
  writeFileSync(resolve(OUT, 'timeline.json'), JSON.stringify({ step: STEP, speed: SPEED, walkEnd, reached, changes, log }, null, 1));
  const mux = spawnSync(FFMPEG, ['-v', 'error', '-y', '-framerate', String(shots / walkEnd), '-i', resolve(frames, '%04d.jpg'), '-i', resolve(OUT, 'walk.wav'),
    '-c:v', 'libx264', '-crf', '26', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-shortest', resolve(OUT, 'walk.mp4')], { stdio: 'inherit' });
  if (mux.status !== 0) throw new Error('ffmpeg could not make the video');
  rmSync(frames, { recursive: true, force: true });
  rmSync(resolve(OUT, 'walk.wav'));
  console.log(`wrote ${OUT}/walk.mp4 and timeline.json`);
  line(errors.length === 0, errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
} finally {
  await browser?.close();
  process.kill(serverPid);
}
process.exit(failures ? 1 : 0);

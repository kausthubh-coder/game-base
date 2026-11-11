// Plays the Verdant Stag's hall in headless Chrome and says what happened: `bun tools/fight-play.mjs --scene stag`
// hands over to this file.
//
//   bun tools/fight-play.mjs --scene stag --port 5529                 the hall's bot plays it, through the lab's door
//   bun tools/fight-play.mjs --scene stag --port 5529 --keys          real keys and mouse only, as a person would press them
//   bun tools/fight-play.mjs --scene stag --url http://127.0.0.1:5529/   a built copy
//
// `--quality low`, `medium` or `high` holds a quality level (high by default). It takes a picture at each of the
// camera's zoom steps once the Stag is awake, and one in each phase: the sweep coming, a pin broken, the pods
// in the dark, the lamps lit, the climb, a shake, the freeing, the colors coming back and "Again?". It prints
// the hall's record with the draw calls, triangles and script time it saw. Pictures go to
// `.artifacts/fight/stag-*.png`. It exits 1 on a console error, a hall not freed, or a key that did nothing.
// This Mac's frame rate says nothing about a Chromebook, so none is printed.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const flag = (name) => argv.includes('--' + name);
const port = opt('port', process.env.PLAY_PORT ?? '5525');
const quality = opt('quality', 'high'), keys = flag('keys'), limit = Number(opt('limit', 360));
const base = opt('url', `http://localhost:${port}/`);
const name = opt('name', `stag${keys ? '-keys' : ''}${quality !== 'high' ? '-' + quality : ''}`);
const out = resolve(import.meta.dirname, '..', '.artifacts/fight');
mkdirSync(out, { recursive: true });

const browser = await launchChrome({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [], failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const state = () => page.evaluate(() => window.__fight.state());
const shot = (what) => page.screenshot({ path: resolve(out, `${name}-${what}.png`) });
const check = (what, ok) => { if (!ok) failed.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const sleep = (ms) => page.waitForTimeout(ms);
const shots = new Set();
async function shotOnce(what) {
  if (shots.has(what)) return;
  shots.add(what);
  await shot(what);
}

await page.goto(`${base}?scene=stag&quality=${quality}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__fight?.hall && window.__game?.started, null, { timeout: 60000 });
await page.evaluate(() => window.__game.settle());
await page.evaluate(() => { localStorage.removeItem('lab.fight.log'); });
let s = await state();
check('the hall opened with the Stag asleep and the camera at its furthest step', s.hall?.stag === 'asleep' && (await page.evaluate(() => window.__game.state().camera.zoom)) === 4);
await sleep(600);
await shot('start');

// ---------------------------------------------------------------- the measure
let settledAt = Infinity;
const seen = { drawCalls: 0, triangles: 0, scriptMs: 0, simMs: 0, samples: 0, scriptSum: 0 };
async function sample() {
  if (Date.now() < settledAt) return;
  const c = await page.evaluate(() => window.__game.counters());
  seen.drawCalls = Math.max(seen.drawCalls, c.drawCalls);
  if (c.triangles > seen.triangles) seen.most = `${s.hall?.freed ? 'freed' : `phase ${(s.hall?.phase ?? 0) + 1}`}, the hero at ${s.hero.x.toFixed(0)}, ${s.hero.z.toFixed(0)}`;
  seen.own = Math.max(seen.own ?? 0, s.hall?.triangles ?? 0);
  seen.triangles = Math.max(seen.triangles, c.triangles);
  seen.scriptMs = Math.max(seen.scriptMs, c.scriptMs);
  seen.simMs = Math.max(seen.simMs, c.simMs);
  seen.scriptSum += c.scriptMs;
  seen.samples++;
}

/** The pictures of each phase, taken as the hall gets there. */
async function phaseShots() {
  const h = s.hall;
  if (!h) return;
  if (h.freed) {
    if (h.freedFor > 0) await shotOnce('freed');
    if (h.freedFor > 2.6) await shotOnce('colors-return');
    if (h.freedFor > 4.5) await shotOnce('head-lowered');
    return;
  }
  if (h.phase === 0 && h.attack === 'sweep' && s.shapes > 0) await shotOnce('chains-sweep');
  if (h.phase === 0 && h.attack === 'stamp' && s.shapes > 0) await shotOnce('chains-stamp');
  if (h.phase === 0 && h.pins >= 1) await shotOnce('chains-pin');
  if (h.phase === 1 && h.pods >= 2) await shotOnce('overgrowth-pods');
  if (h.phase === 1 && h.lamps >= 3) await shotOnce('overgrowth-lamps');
  if (h.phase === 2 && h.stag === 'rise') await shotOnce('collar-vines');
  if (h.phase === 2 && h.onRamp) await shotOnce('collar-climb');
  if (h.phase === 2 && h.attack === 'shake' && s.shapes > 0) await shotOnce('collar-shake');
  if (h.phase === 2 && h.collar.open) await shotOnce('collar-cut');
}

const byZoom = [];
/** Each of the camera's zoom steps, with the mouse wheel, nearest first, then back out to the furthest. */
async function zoomShots() {
  const at = await page.evaluate(() => window.__fight.screen(window.__fight.fight.hero.x, window.__fight.fight.hero.z));
  await page.mouse.move(at?.x ?? 720, at?.y ?? 450);
  const zoom = () => page.evaluate(() => window.__game.state().camera.zoom);
  const steps = [];
  for (let tries = 0; tries < 8; tries++) {
    const z = await zoom();
    if (!steps.includes(z)) {
      await sleep(700);
      await shot(`zoom-${z}`);
      steps.push(z);
      // What each step costs, apart from the fight's own measure: a low step looks out to the horizon and draws far more of the valley.
      const c = await page.evaluate(() => window.__game.counters());
      byZoom.push(`step ${z}: ${c.drawCalls} draw calls, ${c.triangles} triangles`);
    }
    if (z === 0) break;
    await page.mouse.wheel(0, -120);
    await sleep(250);
  }
  for (let tries = 0; tries < 8 && (await zoom()) < 4; tries++) { await page.mouse.wheel(0, 120); await sleep(250); }
  await sleep(1200);
  check(`a picture at each zoom step (${steps.join(', ')}), and the wheel took the camera back out`, steps.length === 5 && (await zoom()) === 4);
}

if (!keys) {
  // ---------------------------------------------------------------- the door: the hall's bot plays
  await page.evaluate(() => window.__fight.bot(true));
  await page.waitForFunction(() => window.__fight.state().hall.stag !== 'asleep', null, { timeout: 15000 });
  // The camera, at each step, with the Stag awake. The measure starts once it is back at its furthest step.
  await page.evaluate(() => window.__fight.bot(false));
  await zoomShots();
  settledAt = Date.now() + 1000;
  await page.evaluate(() => window.__fight.bot(true));
  const from = Date.now();
  while (Date.now() - from < limit * 1000) {
    s = await state();
    await sample();
    await phaseShots();
    if (s.hall.freed && s.hall.freedFor > 5) break;
    await sleep(80);
  }
  await page.evaluate(() => window.__fight.bot(false));
} else {
  // ---------------------------------------------------------------- real keys and mouse
  // The player: step out of what is about to land, walk to the next thing to break, and click it.
  let held = [];
  async function hold(want) {
    for (const key of held) if (!want.includes(key)) await page.keyboard.up(key);
    for (const key of want) if (!held.includes(key)) await page.keyboard.down(key);
    held = want;
  }
  const toward = (x, z) => page.evaluate(([x, z]) => window.__fight.keysToward(x, z), [x, z]);
  /** Where the hall's rules say a shape is about to land on the hero, and the way out of it: a point to walk to. */
  const danger = () => page.evaluate(() => {
    const { fight, hall } = window.__fight, h = fight.hero;
    for (const sh of fight.shapes) {
      if (!sh.live || sh.t >= sh.lead || sh.t < 0.3) continue;
      const dx = h.x - sh.x, dz = h.z - sh.z;
      if (sh.kind === 'circle') {
        const d = Math.hypot(dx, dz);
        if (d > sh.reach + 0.6) continue;
        return { x: sh.x + (dx / (d || 1)) * (sh.reach + 1.4), z: sh.z + (dz / (d || 1)) * (sh.reach + 1.4), left: sh.lead - sh.t };
      }
      const fx = Math.sin(sh.facing), fz = -Math.cos(sh.facing), along = dx * fx + dz * fz, across = dx * fz - dz * fx;
      if (along < -0.6 || along > sh.reach + 0.6 || Math.abs(across) > sh.width / 2 + 0.6) continue;
      // On the vines, down them. On the floor, out to the side it is on.
      if (hall.onRamp() && sh === hall.stag.shape) return { x: h.x, z: sh.z + 1.4, left: sh.lead - sh.t };
      const side = across >= 0 ? 1 : -1, need = sh.width / 2 + 1.2 - Math.abs(across);
      return { x: h.x + fz * side * need, z: h.z - fx * side * need, left: sh.lead - sh.t };
    }
    return null;
  });

  // Walk in: the Stag wakes.
  s = await state();
  await hold(await toward(s.hero.x, s.hero.z - 4));
  await page.waitForFunction(() => window.__fight.state().hall.stag !== 'asleep', null, { timeout: 8000 }).catch(() => undefined);
  await hold([]);
  s = await state();
  check('walking in woke the Stag', s.hall.stag !== 'asleep');
  await zoomShots();
  settledAt = Date.now() + 1000;
  const dodges = s.record.dodges;
  await page.keyboard.press('ShiftLeft');
  await sleep(450);
  s = await state();
  check('Shift dodged', s.record.dodges === dodges + 1);

  let clicks = 0, lastHits = 0;
  const from = Date.now();
  while (Date.now() - from < limit * 1000) {
    s = await state();
    await sample();
    await phaseShots();
    const h = s.hall;
    if (h.freed) { await hold([]); if (h.freedFor > 5) break; await sleep(100); continue; }
    if (s.hero.act === 'faint') { await hold([]); await sleep(150); continue; }
    const out = await danger();
    if (out) {
      await hold(await toward(out.x, out.z));
      if (out.left < 0.35) await page.keyboard.press('ShiftLeft');
      await sleep(70);
      continue;
    }
    // What to break next, and where to stand for it.
    const goal = await page.evaluate(() => {
      const { fight, hall } = window.__fight, h = fight.hero;
      const near = (list) => list.filter((t) => !t.broken && t.open).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z))[0];
      if (hall.phase === 0) { const t = near(hall.pins); return t && { x: t.x, z: t.z, r: t.radius, kind: 'pin' }; }
      if (hall.phase === 1) {
        const pod = near(hall.pods.map((p) => p.target).filter((t) => Math.hypot(t.x - h.x, t.z - h.z) < 4.5));
        const t = pod ?? near(hall.lamps) ?? near(hall.pods.map((p) => p.target));
        return t && { x: t.x, z: t.z, r: t.radius, kind: pod ? 'pod' : 'lamp' };
      }
      const cells = hall.stage, foot = { x: cells.center.x + 3.5, z: cells.center.z + 7.1 }, top = { x: cells.center.x + 4, z: cells.center.z - 3.1 };
      if (hall.collar.open) return { x: hall.collar.x, z: hall.collar.z, r: hall.collar.radius, kind: 'collar', stand: top, high: true };
      if (!hall.onRamp()) return { x: foot.x, z: foot.z, r: 0, kind: 'foot', walk: true };
      return { x: top.x, z: top.z, r: 0, kind: 'top', walk: true };
    });
    if (!goal) { await hold([]); await sleep(100); continue; }
    if (goal.walk) {
      // To the foot of the vines, then straight up them.
      if (goal.kind === 'foot' && Math.hypot(s.hero.x - goal.x, s.hero.z - goal.z) < 0.6) await hold(await toward(goal.x, goal.z - 3));
      else await hold(await toward(goal.x, goal.z));
      await sleep(70);
      continue;
    }
    const standAt = goal.stand ?? goal, d = Math.hypot(s.hero.x - goal.x, s.hero.z - goal.z) - goal.r;
    if (goal.stand && Math.hypot(s.hero.x - standAt.x, s.hero.z - standAt.z) > 0.7) { await hold(await toward(standAt.x, standAt.z)); await sleep(70); continue; }
    if (!goal.stand && d > 1.7) { await hold(await toward(goal.x, goal.z)); await sleep(70); continue; }
    await hold([]);
    const at = await page.evaluate(([x, z, high]) => window.__fight.screen(x, z, high ? window.__fight.state().hall.heroY : undefined), [goal.x, goal.z, !!goal.high]);
    if (at) {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await sleep(30);
      await page.mouse.up();
      clicks++;
    }
    await sleep(140);
    if (clicks === 6 && lastHits === 0) {
      const now = await state();
      lastHits = now.record.swings;
      check('clicks on a pin cut it', now.record.swings > 0 && (now.hall.pins > 0 || now.hall.record.boss.counts.pins > 0 || (await page.evaluate(() => window.__fight.hall.pins.some((p) => p.guard < p.full)))));
    }
  }
  await hold([]);
}

s = await state();
check('the Stag was freed', s.hall.freed && s.hall.record.result === 'calmed');
await page.waitForSelector('.fl-again:not([hidden])', { timeout: 12000 }).catch(() => undefined);
await sleep(300);
await shot('again');
const asked = await page.locator('.fl-again:not([hidden])').count();
check('the lab asked "Again?"', asked === 1);
if (asked) {
  await page.click('.fl-rate button:nth-child(4)');
  const log = await page.evaluate(() => window.__fight.log());
  check('the answer was kept with the hall, under the way "stag"', log.length === 1 && log[0].again === 4 && log[0].way === 'stag' && log[0].result === 'calmed' && log[0].boss?.phases.length === 3);
  const lines = await page.locator('.fl-checks tr').allInnerTexts();
  console.log('\nchecks on the card:\n  ' + lines.map((line) => line.replace(/\s*\t\s*/g, ' | ')).join('\n  '));
  // "Fight it again" puts the hall back.
  await page.click('.fl-again button:text-is("Fight it again")').catch(() => undefined);
  await sleep(500);
  const again = await state();
  check('"Fight it again" put every pin back and the Stag to sleep', again.hall.phase === 0 && again.hall.pins === 0 && again.hall.stag === 'asleep' && !again.hall.freed);
}
const game = await page.evaluate(() => { const g = window.__game.state(); return { viewErrors: g.viewErrors, failed: g.failed, quality: g.quality }; });
check('no view or system of the game failed', game.viewErrors.length === 0 && Object.keys(game.failed).length === 0);
const r = s.hall.record, b = r.boss;
console.log('\nrecord:', JSON.stringify({
  way: r.way, result: r.result, seconds: +r.length.toFixed(1), phases: b.phases.map((p) => +p.toFixed(1)), hitsTaken: r.hitsTaken, hitBy: r.hitBy, faints: r.faints,
  quiet: +b.quiet.toFixed(1), quietByPhase: b.quietByPhase.map((q) => +q.toFixed(1)), counts: b.counts, swings: r.swings, whiffs: r.whiffs, dodges: r.dodges, dodged: r.dodged,
}));
console.log(`drawn at quality ${game.quality} on ${browser.gameRenderer}, once settled: at most ${seen.drawCalls} draw calls, ${seen.triangles} triangles, script ${(seen.scriptSum / Math.max(1, seen.samples)).toFixed(2)} ms a frame on average and ${seen.scriptMs.toFixed(2)} ms in the worst 2 seconds, ${seen.simMs.toFixed(2)} ms of rules, over ${seen.samples} samples. The most triangles: ${seen.most}. Of them the hall's own meshes, with their shadows, draw at most ${seen.own}.`);
console.log(`at each zoom step, once: ${byZoom.join('; ')}`);
console.log(`pictures: ${out}/${name}-*.png`);
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'no console errors');
if (failed.length) console.log('failed:\n  ' + failed.join('\n  '));
process.exit(errors.length || failed.length ? 1 : 0);

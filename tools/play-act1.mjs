// The browser play of the first part: builds the game into dist-play, serves it on port 5340, opens it in
// headless Chrome and plays all five quests of docs/play/act1.md from the title to the end card.
//   bun tools/play-act1.mjs [--no-build] [--shots] [--quality low|medium|high] [--no-continue]
//
// It plays the way src/game/play/act1.test.ts plays the rules, but through the real page: a real click on
// New game, the hero's real body steered by held game keys along a nav route, real E presses, real
// Enter presses and clicks in the dialogue box, real clicks on the block under a real pointer (checked
// against the game's own aim), the real bag and Make panels. `window.__game.advance` passes time. No item
// is given and no quest is skipped. In the middle of quest 4 it reloads the page and plays on from Continue.
//
// One line per step with the game clock. A screenshot after each quest in .artifacts/play/act1/, and with
// --shots one after every step. It fails on a console error or a failed check, and writes act1.json there.
// This Mac draws WebGL in software, so it checks what the game does and draws, never how fast.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { REGION } from '../src/game/content/region.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/play/act1');
const PORT = 5340;
const BASE = `http://127.0.0.1:${PORT}/?quality=${opt('quality', 'medium')}`;
const SHOTS = args.includes('--shots');
const PATH = REGION.paths[0].points.map(([x, z]) => ({ x, z }));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['x', 'vite', 'build', '--outDir', 'dist-play', '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('FAIL: the build into dist-play'); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', 'dist-play', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving dist-play on ${BASE}  pid ${serverPid}`);

const errors = [];
const log = [];
const notes = [];
const started = Date.now();
let failed = null;
let page, browser;

// A page call still running after 20 seconds says what it is, so a hang names itself in the log.
const game = async (js, arg) => {
  const slow = setTimeout(() => console.log(`     slow: 20 s in ${String(js).replace(/\s+/g, ' ').slice(0, 100)} ${JSON.stringify(arg ?? null).slice(0, 100)}`), 20000);
  try { return await page.evaluate(js, arg); } finally { clearTimeout(slow); }
};
const frames = (n = 2) => game((count) => window.__game.frames(count), n);
const state = () => game(() => window.__game.state());
const note = (text) => { notes.push(text); console.log(`     note: ${text}`); };

function clockText(s) {
  const t = s.clock.timeOfDay * 24;
  return `day ${s.clock.day} ${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`;
}

async function shot(name) {
  await frames(2);
  await page.screenshot({ path: resolve(out, name) });
  console.log(`     wrote .artifacts/play/act1/${name}`);
}

let stepNumber = 0;
/** Runs one step of the play and prints it with the game clock. A throw stops the play and names the step. */
async function step(quest, name, run) {
  stepNumber++;
  const t0 = Date.now();
  try {
    const detail = await run();
    const s = await state();
    const line = `ok   ${String(stepNumber).padStart(2)} ${quest.padEnd(8)} ${name}  [${clockText(s)}, ${s.clock.seconds.toFixed(0)} s, ${((Date.now() - t0) / 1000).toFixed(1)} s real]${detail ? '  ' + detail : ''}`;
    console.log(line);
    log.push({ quest, name, ok: true, clock: s.clock, detail: detail ?? '' });
    if (SHOTS) await shot(`step-${String(stepNumber).padStart(2, '0')}.png`);
  } catch (error) {
    const s = await state().catch(() => null);
    const where = s ? `[${clockText(s)}; player ${s.player.x.toFixed(1)}, ${s.player.y.toFixed(1)}, ${s.player.z.toFixed(1)}; quest ${s.tracked}; prompt ${s.prompt}; talk ${s.talk?.text ?? 'none'}]` : '';
    console.log(`FAIL ${String(stepNumber).padStart(2)} ${quest.padEnd(8)} ${name}: ${error.message} ${where}`);
    log.push({ quest, name, ok: false, error: error.message, where });
    await page.screenshot({ path: resolve(out, 'failed.png') }).catch(() => {});
    throw error;
  }
}

const must = (ok, what) => { if (!ok) throw new Error(what); };

/** Helpers that run inside the page. They steer the real hero body with held game keys and read the rules. */
function installHelpers() {
  const g = window.__game;
  const sys = g.view.game.systems;
  const P = g.view.game.player;
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const KEYS = ['w', 'a', 's', 'd'];
  const release = () => { for (const k of KEYS) g.key(k, false); g.key('shift', false); };

  /** Holds the keys that point the body at (tx, tz), relative to the camera's yaw. */
  function steer(tx, tz) {
    const yaw = g.view.camera.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const dx = tx - P.pos.x, dz = tz - P.pos.z, len = Math.hypot(dx, dz) || 1;
    const forward = (dx * fx + dz * fz) / len, right = (dx * rx + dz * rz) / len;
    g.key('w', forward > 0.38); g.key('s', forward < -0.38);
    g.key('d', right > 0.38); g.key('a', right < -0.38);
  }

  /**
   * Walks the hero's body to `goal` along nav routes, through `via` first. `soft` holds Shift, or is a function
   * asked every tenth of a second. Returns { ok, seconds, jumps, replans }.
   */
  function walk(goal, options = {}) {
    const within = options.within ?? 0.6;
    const legs = [...(options.via ?? []).map((v) => ({ x: v.x + 0.5, y: P.pos.y, z: v.z + 0.5, via: true })), { ...goal, via: false }];
    let seconds = 0, jumps = 0, replans = 0;
    const limit = options.seconds ?? 300;
    try {
      for (const leg of legs) {
        const near = leg.via ? 3 : within;
        let route = null, at = 0, check = { x: P.pos.x, z: P.pos.z }, sinceCheck = 0;
        while (d2(P.pos, leg) > near) {
          if (seconds > limit) return { ok: false, seconds, jumps, replans, why: `timed out ${d2(P.pos, leg).toFixed(1)} blocks short` };
          if (!route || at >= route.length) {
            route = sys.nav.toward(P.pos, { x: Math.floor(leg.x) + 0.5, y: leg.y ?? P.pos.y, z: Math.floor(leg.z) + 0.5 }, 4000) ?? [];
            at = 0;
            replans++;
            if (replans > 400) return { ok: false, seconds, jumps, replans, why: `no route, ${d2(P.pos, leg).toFixed(1)} blocks short` };
            if (route.length === 0) route = [{ x: leg.x, y: leg.y, z: leg.z }];
          }
          // Skip route points already reached, and head for the goal itself on the last stretch.
          while (at < route.length - 1 && d2(P.pos, route[at]) < 0.45) at++;
          const target = at >= route.length - 1 && d2(route[route.length - 1], leg) < 1.5 ? leg : route[at];
          // The route ended short of the goal: head straight for it. Asking again here would loop with no time passing.
          if (at === route.length - 1 && d2(P.pos, route[at]) < 0.45 && d2(P.pos, leg) > near) route[at] = { x: leg.x, y: leg.y, z: leg.z };
          const soft = typeof options.soft === 'function' ? options.soft() : Boolean(options.soft);
          g.key('shift', soft);
          steer(target.x, target.z);
          g.advance(0.1);
          seconds += 0.1;
          sinceCheck += 0.1;
          if (sinceCheck >= 1) {
            if (Math.hypot(P.pos.x - check.x, P.pos.z - check.z) < (soft ? 0.25 : 0.5)) {
              // Stuck on a step or a corner: jump, and plan again.
              g.key('space');
              jumps++;
              route = null;
              if (jumps > 40) return { ok: false, seconds, jumps, replans, why: 'stuck' };
            }
            check = { x: P.pos.x, z: P.pos.z };
            sinceCheck = 0;
          }
        }
      }
    } finally {
      release();
      g.advance(0.15);
    }
    return { ok: true, seconds: Math.round(seconds * 10) / 10, jumps, replans };
  }

  const pet = () => sys.pets.all().find((one) => one.kind === 'leaftail');

  window.__p = {
    walk,
    /** Walks softly whenever the wild leaftail is near, as the hint tells the player. */
    walkCarefully(goal, within) {
      return walk(goal, { within, soft: () => { const p = pet(); return Boolean(p && !p.bonded && d2(p.pos, P.pos) < 9); } });
    },
    pet: () => { const p = pet(); return p ? { x: p.pos.x, y: p.pos.y, z: p.pos.z, trust: p.trust, bonded: p.bonded, startled: p.startled } : null; },
    npc: (id) => { const n = sys.people.get(id); return n ? { x: n.pos.x, y: n.pos.y, z: n.pos.z, place: n.place, name: n.name } : null; },
    place: (name) => { const at = sys.region.place(name).at; return { x: at.x, y: at.y, z: at.z }; },
    grant: () => sys.region.grant(),
    count: (id) => sys.inventory.count(id),
    slotOf: (id) => sys.inventory.slots.findIndex((s) => s?.id === id),
    crops: () => sys.crops.all().map((c) => ({ x: c.x ?? c.pos?.x, ripe: c.state.ripe, wet: c.state.wet })),
    crop: (x, y, z) => { const c = sys.crops.at(x, y, z); return c ? { ripe: c.ripe, wet: c.wet, stage: c.stage } : null; },
    placed: (x, y, z) => sys.placeables.at(x, y, z)?.kind ?? null,
    bushes: () => (sys.region.berryBushes?.() ?? []).map((b) => ({ x: b.x, y: b.y, z: b.z, ripe: b.ripe })).sort((a, b) => d2(a, P.pos) - d2(b, P.pos)),
    canSleep: () => sys.time.canSleep(),
    dayLength: () => sys.time.dayLength,
    /** Every tree within 40 blocks the player may cut, nearest first, away from the mossy rocks' shade. */
    trunks() {
      const sim = g.view.world.sim, rocks = sys.region.place('grant.rocks').at;
      const log = (x, y, z) => /_log$/.test(g.block(x, y, z).key);
      const found = [];
      for (let x = Math.floor(P.pos.x) - 40; x <= Math.floor(P.pos.x) + 40; x++) {
        for (let z = Math.floor(P.pos.z) - 40; z <= Math.floor(P.pos.z) + 40; z++) {
          for (let y = sim.heightAt(x, z) - 1; y > 1; y--) {
            if (!log(x, y, z) || log(x, y - 1, z)) continue;
            let logs = 0;
            while (log(x, y + logs, z)) logs++;
            const under = g.block(x, y - 1, z).key;
            if (logs >= 3 && !/leaves|needles|air/.test(under) && under !== '' && !sys.region.isProtected(x, y, z)) found.push({ x, y, z, logs });
            break;
          }
        }
      }
      return found.filter((t) => Math.hypot(t.x + 0.5 - rocks.x, t.z + 0.5 - rocks.z) > 12)
        .sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z));
    },
    standBeside(x, y, z) { return sys.nav.near({ x: x + 0.5, y, z: z + 0.5 }, 1.5, (sx, sz) => sx === x && sz === z); },
    /** The center of a block's face in CSS pixels, or null when it is off screen. */
    face(x, y, z, n, inset = 0.49) {
      const at = g.view.project(x + 0.5 + n[0] * inset, y + 0.5 + n[1] * inset, z + 0.5 + n[2] * inset);
      return at ? { x: at.x, y: at.y } : null;
    },
    aim: () => { const a = g.view.aim; return a ? { x: a.x, y: a.y, z: a.z } : null; },
    /** Advances until a block changes or `seconds` pass. The real left button is held meanwhile. */
    holdUntilChanged(x, y, z, seconds) {
      const before = g.block(x, y, z).id;
      for (let t = 0; t < seconds; t += 0.05) {
        g.advance(0.05);
        if (g.block(x, y, z).id !== before) return true;
      }
      return false;
    },
    until(code, seconds, every = 0.5) {
      const test = new Function('g', 'sys', `return (${code});`);
      for (let t = 0; t <= seconds; t += every) {
        if (test(g, sys)) return true;
        g.advance(every);
      }
      return Boolean(test(g, sys));
    },
    flag: (name) => g.state().flags[name],
    openStep() { const q = sys.quests.tracked(); return q ? `${q.id}.${String(g.state().flags[`quest.${q.id}.step`])}` : ''; },
  };
}

async function helpers() {
  await page.waitForFunction(() => window.__game !== undefined);
  await game(installHelpers);
}

const p = new Proxy({}, { get: (_, name) => (...a) => game(([n, list]) => window.__p[n](...list), [name, a]) });

// ------------------------------------------------------------------------------------- real input

/** Walks with the real body and fails the step when it does not arrive. */
async function walkTo(goal, options = {}) {
  const at = typeof goal === 'string' ? await p.place(goal) : goal;
  const result = await game(([to, o]) => window.__p.walk(to, o), [at, options]);
  must(result.ok, `the walk to ${typeof goal === 'string' ? goal : `${at.x.toFixed(1)}, ${at.z.toFixed(1)}`} failed: ${result.why} (${result.seconds} s, ${result.jumps} jumps)`);
  return result;
}

async function walkCarefully(goal, within) {
  const result = await game(([to, w]) => window.__p.walkCarefully(to, w), [goal, within]);
  must(result.ok, `the careful walk failed: ${result.why}`);
  return result;
}

async function walkToTown() {
  const gate = await p.place('town.gate');
  const s = await state();
  if (s.player.x >= gate.x) return;
  if (Math.hypot(s.player.x - gate.x, s.player.z - gate.z) < 60) return walkTo('town.gate', { within: 2, seconds: 300 });
  const stone = await p.place('grant.stone');
  if (s.player.x < stone.x + 6) await walkTo('grant.stone', { within: 3, seconds: 300 });
  const now = (await state()).player;
  return walkTo('town.gate', { via: PATH.filter((pt) => pt.x > now.x + 4), within: 2, seconds: 400 });
}

async function walkToGrant() {
  await walkTo('town.gate', { within: 2, seconds: 300 });
  return walkTo('grant.stone', { via: [...PATH].reverse(), within: 3, seconds: 400 });
}

const press = async (code) => { await page.keyboard.press(code); await frames(1); };

/** Puts an item in hand with the real number key, moving it into the quick row with real clicks in the bag first. */
async function hold(item) {
  let slot = await p.slotOf(item);
  must(slot >= 0, `there is no ${item} in the bag`);
  if (slot >= 9) {
    const bag = (await state()).bag;
    const free = await game(() => window.__game.view.game.systems.inventory.slots.findIndex((s, i) => i < 9 && s === null));
    const to = free >= 0 ? free : 8;
    await press('KeyB');
    await page.waitForSelector('.gu-stage-bag:not([hidden])');
    await page.click(`[data-key="slot:${slot}"]`);
    await page.click(`[data-key="slot:${to}"]`);
    await press('Escape');
    slot = await p.slotOf(item);
    must(slot === to, `the bag did not move ${item} into quick slot ${to + 1} (bag of ${bag.length})`);
  }
  await press(`Digit${slot + 1}`);
  const held = (await state()).held;
  must(held === item, `the number key ${slot + 1} took ${held} in hand, not ${item}`);
}

/** Points the real mouse at a block's face, and checks the game aims at that block. Turns the camera if it is hidden. */
async function point(x, y, z, n = [0, 1, 0]) {
  for (let tries = 0; tries < 8; tries++) {
    await frames(2);
    const insets = [0.49, 0.3, 0.45];
    for (const inset of insets) {
      const at = await p.face(x, y, z, n, inset);
      if (!at) continue;
      await page.mouse.move(at.x, at.y);
      await frames(1);
      const aim = await p.aim();
      if (aim && aim.x === x && aim.y === y && aim.z === z) return tries;
    }
    // Something stands in front of it, or it is out of reach of the pointer: turn the camera a quarter.
    await press('KeyQ');
    await frames(6);
  }
  const aim = await p.aim();
  throw new Error(`the pointer cannot aim at ${x}, ${y}, ${z} from any side (aims at ${JSON.stringify(aim)})`);
}

let turns = 0;
/** Holds the real left button on a block until it breaks or `seconds` pass. True when it broke. */
async function dig(x, y, z, n = [0, 1, 0], seconds = 6) {
  turns += await point(x, y, z, n);
  await page.mouse.down();
  const broke = await game(([bx, by, bz, s]) => window.__p.holdUntilChanged(bx, by, bz, s), [x, y, z, seconds]);
  await page.mouse.up();
  await game(() => window.__game.advance(0.1));
  return broke;
}

/** The real right button on a block's face. */
async function use(x, y, z, n = [0, 1, 0]) {
  turns += await point(x, y, z, n);
  await page.mouse.click(...Object.values(await p.face(x, y, z, n, 0.45)), { button: 'right' });
  await game(() => window.__game.advance(0.1));
}

/** The real left button, a quick press, on a block. */
async function tap(x, y, z, n = [0, 1, 0]) {
  turns += await point(x, y, z, n);
  await page.mouse.down();
  await game(() => window.__game.advance(0.1));
  await page.mouse.up();
  await game(() => window.__game.advance(0.1));
}

const dialogue = () => game(() => {
  const e = document.querySelector('.gb-dialogue');
  return {
    open: Boolean(e) && !e.hidden,
    line: window.__game.state().talk?.text ?? null,
    choices: [...document.querySelectorAll('.gb-dialogue-choices:not([hidden]) button')].map((b) => b.textContent),
  };
});

/** Presses Enter through the open conversation and clicks the first choice when one shows. Returns the lines. */
async function talkThrough() {
  const lines = [];
  for (let presses = 0; presses < 120; presses++) {
    const now = await dialogue();
    if (!now.open && now.line === null) return lines;
    if (now.line && lines.at(-1) !== now.line) lines.push(now.line);
    if (now.choices.length > 0) {
      await page.waitForTimeout(260);
      await page.click('.gb-dialogue-choices:not([hidden]) button');
    } else {
      await page.keyboard.press('Enter');
    }
    // The box follows the talk system once a frame, so a press waits for the frame that shows its line.
    await frames(1);
  }
  throw new Error(`the conversation did not end after 120 presses (at "${(await dialogue()).line}")`);
}

/** Walks up to someone until the prompt names them, presses the real E and talks it through. */
async function talkTo(id) {
  for (const within of [1.7, 1.2, 0.8, 0.4]) {
    const npc = await p.npc(id);
    must(npc, `nobody is called ${id}`);
    await walkTo(npc, { within, seconds: 240 });
    if ((await state()).prompt === `Talk to ${npc.name}`) break;
  }
  const npc = await p.npc(id);
  const prompt = (await state()).prompt;
  must(prompt === `Talk to ${npc.name}`, `beside ${id} the prompt is "${prompt}"`);
  await frames(1);
  const promptOnScreen = await game(() => document.querySelector('.gu-prompt')?.textContent ?? '');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => { const e = document.querySelector('.gb-dialogue'); return e && !e.hidden; }, null, { timeout: 30000 });
  const lines = await talkThrough();
  const after = await state();
  // The last talk of the act opens the end card, which holds the player until Keep playing.
  must((!after.player.busy || after.flags['act1.ended'] === true) && after.talk === null, `the conversation with ${id} left the player busy`);
  if (!promptOnScreen.includes(npc.name)) note(`the prompt on screen beside ${id} read "${promptOnScreen}"`);
  return lines;
}

const until = (code, seconds, every) => p.until(code, seconds, every);

// ------------------------------------------------------------------------------------- the play

/** The hut's bed block, a few blocks north-west of the grant stone, as in the rules test. */
async function hut() {
  const g = await p.grant(), c = await p.place('grant.center');
  return { x: g.x + g.width - 6, y: c.y, z: g.z + g.depth - 8 };
}

async function field() {
  const c = await p.place('grant.center');
  const x0 = Math.floor(c.x) - 4, z0 = Math.floor(c.z) - 2, y = c.y - 1;
  const cells = [];
  for (let x = x0; x < x0 + 4; x++) for (let z = z0; z < z0 + 3; z++) cells.push({ x, y, z });
  return { cells, stand: { x: x0 + 2.5, y: c.y, z: z0 + 4.5 }, water: [{ x: x0 + 1, z: z0 + 1 }, { x: x0 + 2, z: z0 + 1 }], y };
}

async function waterField() {
  const f = await field();
  await hold('watering_can');
  for (const at of f.water) await use(at.x, f.y, at.z);
}

async function plant() {
  const f = await field();
  let planted = 0;
  for (const cell of f.cells) {
    if ((await p.count('wheat_seeds')) === 0) break;
    if (await p.crop(cell.x, cell.y, cell.z)) continue;
    await hold('wheat_seeds');
    await use(cell.x, cell.y, cell.z);
    must(await p.crop(cell.x, cell.y, cell.z), `a seed did not go into the soil at ${cell.x}, ${cell.z}`);
    planted++;
  }
  return planted;
}

async function feed(byKey) {
  const before = (await p.pet()).trust;
  for (let tries = 0; tries < 8; tries++) {
    await walkTo(await p.pet(), { soft: true, within: 2.2, seconds: 120 });
    if (byKey) {
      const prompt = (await state()).prompt;
      must(prompt === 'Offer a berry', `beside the leaftail the prompt is "${prompt}"`);
      await page.keyboard.press('KeyE');
    } else {
      await hold('berry');
      const s = (await state()).player;
      await use(Math.floor(s.x), Math.floor(s.y) - 1, Math.floor(s.z));
    }
    if (await until(`sys.pets.all().find((x) => x.kind === 'leaftail').trust > ${before}`, 6, 0.25)) {
      await game(() => window.__game.advance(3.2));
      return tries + 1;
    }
  }
  throw new Error('the leaftail did not take a berry in eight tries');
}

async function expectStep(want) {
  await until(`(() => { const q = sys.quests.tracked(); return q && (q.id + '.' + g.state().flags['quest.' + q.id + '.step']) === ${JSON.stringify(want)}; })()`, 2, 0.25);
  const open = await p.openStep();
  must(open === want, `the open step should be ${want} and is ${open}`);
}

async function questDone(quest, picture) {
  await game(() => window.__game.advance(0.6));
  const s = await state();
  must(s.flags[`quest.${quest}.done`] === true, `quest.${quest}.done is not set`);
  must(s.quests.find((q) => q.id === quest)?.state === 'done', `${quest} is not done in the quest list`);
  await shot(picture);
}

async function openGame() {
  await page.goto(BASE, { waitUntil: 'load' });
  await helpers();
  await page.waitForSelector('#loading', { state: 'detached', timeout: 180000 });
  await page.waitForSelector('.gu-stage-title:not([hidden])');
}

const QUESTS = {
  async plot() {
    await step('plot', 'New game from the title, with a real click', async () => {
      await openGame();
      await shot('00-title.png');
      await page.click('[data-key="title:new"]');
      await page.waitForFunction(() => window.__game.started);
      // The opening scene plays before control. It is skipped with its real Skip button.
      await page.waitForSelector('.st-cinema:not([hidden]) [data-key="opening:skip"]', { timeout: 30000 });
      await shot('00-opening.png');
      await page.click('[data-key="opening:skip"]');
      await page.waitForSelector('.st-cinema', { state: 'hidden', timeout: 60000 });
      must(!(await game(() => window.__game.view.game.player.busy)), 'the player is still held after the opening was skipped');
      await game(() => window.__game.settle());
      await game(() => window.__game.advance(0.5));
      const s = await state();
      must(s.tracked === 'plot', `the tracked quest is ${s.tracked}`);
      must(Object.keys(s.failed).length === 0 && s.viewErrors.length === 0, `failed: ${JSON.stringify(s.failed)} ${s.viewErrors.join('; ')}`);
      return `prompt "${s.prompt}"`;
    });
    await step('plot', 'meet Tamsin at the grant stone with E', async () => {
      await expectStep('plot.meet');
      const lines = await talkTo('tamsin');
      must(lines[0] === 'Twelve people have asked me for this plot.', `her first line is "${lines[0]}"`);
      must((await p.flag('has.almanac')) === true && (await p.count('axe')) === 1, 'no Almanac and axe');
      must(await game(() => !document.querySelector('.ui-bookbtn').hidden), 'the Almanac button is not on the HUD after Tamsin gave the book');
      await expectStep('plot.watch');
      return `${lines.length} lines`;
    });
    await step('plot', 'watch a mossling at the mossy rocks', async () => {
      await walkTo('grant.rocks', { seconds: 60 });
      await shot('01-rocks.png');
      const done = await until(`sys.almanac.page('mossling')?.complete === true`, 150, 1);
      must(done, 'the mossling page did not fill in 150 seconds');
      await expectStep('plot.tell');
    });
    await step('plot', 'tell Tamsin', async () => {
      await talkTo('tamsin');
      must((await p.flag('plot.told')) === true, 'plot.told is not set');
    });
    await questDone('plot', '10-plot-done.png');
  },

  async roof() {
    await step('roof', 'cut 12 logs and pick 3 fiber with the axe and the real left button', async () => {
      await expectStep('roof.wood');
      await hold('axe');
      // A trunk the pointer cannot reach from where the hero stands (leaves hide it, or it stands up a slope) is
      // left for the next tree, as a player would walk on to another.
      const skipped = new Set();
      for (let trees = 0; trees < 20 && ((await p.count('oak_log')) < 12 || (await p.count('fiber')) < 3); trees++) {
        const tree = (await p.trunks()).find((t) => !skipped.has(`${t.x},${t.z}`));
        must(tree, 'no tree left to cut within 40 blocks');
        console.log(`     tree ${trees + 1} at ${tree.x}, ${tree.z}: ${await p.count('oak_log')} logs, ${await p.count('fiber')} fiber so far`);
        const spot = await p.standBeside(tree.x, tree.y, tree.z);
        must(spot, `nowhere to stand beside the tree at ${tree.x}, ${tree.z}`);
        await walkTo(spot, { within: 0.3, seconds: 120 });
        const s = (await state()).player;
        const n = Math.abs(s.x - (tree.x + 0.5)) > Math.abs(s.z - (tree.z + 0.5)) ? [Math.sign(s.x - tree.x - 0.5), 0, 0] : [0, 0, Math.sign(s.z - tree.z - 0.5)];
        // One hold on the lowest log fells the whole tree: its logs and some fiber come, and no log or leaf is left.
        const logsBefore = await p.count('oak_log'), fiberBefore = await p.count('fiber');
        const ok = await dig(tree.x, tree.y, tree.z, n).catch((e) => {
          if (!/cannot aim/.test(e.message)) throw e;
          note(`skipped the tree at ${tree.x}, ${tree.z}: ${e.message}`);
          skipped.add(`${tree.x},${tree.z}`);
          return null;
        });
        if (ok === null) continue;
        must(ok, `the tree at ${tree.x}, ${tree.y}, ${tree.z} did not come down`);
        must((await p.count('oak_log')) >= logsBefore + 3 && (await p.count('fiber')) > fiberBefore, `the felled tree gave ${(await p.count('oak_log')) - logsBefore} logs and ${(await p.count('fiber')) - fiberBefore} fiber`);
        const left = await game(([x, y, z]) => { let n = 0; for (let k = y; k < y + 12; k++) if (/_log$/.test(window.__game.block(x, k, z).key)) n++; return n; }, [tree.x, tree.y, tree.z]);
        must(left === 0, `${left} logs of the felled tree at ${tree.x}, ${tree.z} still stand`);
      }
      must((await p.count('oak_log')) >= 12, `only ${await p.count('oak_log')} logs`);
      must((await p.count('fiber')) >= 3, `only ${await p.count('fiber')} fiber`);
      await shot('11-chopping.png');
      await expectStep('roof.bench');
      return `${await p.count('oak_log')} logs, ${await p.count('fiber')} fiber, ${turns} camera turns to aim so far`;
    });
    await step('roof', 'make planks and a workbench in the bag by hand, and set it down', async () => {
      await press('KeyB');
      await page.waitForSelector('.gu-stage-bag:not([hidden])');
      await page.click('[data-key="tab:hand"]');
      for (let i = 0; i < 6; i++) await page.click('[data-key="make:plank"]');
      await page.click('[data-key="make:workbench"]');
      if (SHOTS) await shot('12-by-hand.png');
      await press('Escape');
      // Six logs saw into 24 planks and the bench takes 4. The bed takes 6 and the shelter 12.
      must((await p.count('workbench')) === 1 && (await p.count('plank')) >= 18, `after making: ${await p.count('plank')} planks, ${await p.count('workbench')} workbench`);
      const h = await hut();
      await walkTo({ x: h.x + 0.5, y: h.y, z: h.z + 2.5 }, { within: 0.3, seconds: 120 });
      await hold('workbench');
      await use(h.x - 3, h.y - 1, h.z + 1);
      must((await p.placed(h.x - 3, h.y, h.z + 1)) === 'workbench', 'no workbench stands where it was set down');
      await expectStep('roof.shelter');
    });
    await step('roof', 'make a bed at the workbench with E and the Make panel, and build a shelter', async () => {
      const h = await hut(), g = h.y;
      await walkTo({ x: h.x - 1.5, y: g, z: h.z + 2.5 }, { within: 0.4, seconds: 60 });
      const prompt = (await state()).prompt;
      must(/craft|workbench/i.test(String(prompt)), `beside the workbench the prompt is "${prompt}"`);
      await page.keyboard.press('KeyE');
      await page.waitForSelector('.gu-stage-make:not([hidden])', { timeout: 20000 });
      await shot('12-make-panel.png');
      await page.click('[data-key="make:bed"]');
      await press('Escape');
      must((await p.count('bed')) === 1, 'the Make panel did not make a bed');
      await walkTo({ x: h.x + 0.5, y: g, z: h.z + 2.5 }, { within: 0.3, seconds: 120 });
      await hold('plank');
      for (const [x, z, high] of [[h.x - 1, h.z, 3], [h.x - 1, h.z + 1, 3], [h.x, h.z - 1, 3], [h.x + 1, h.z, 2]]) {
        for (let i = 0; i < high; i++) {
          if (!(await p.slotOf('plank') >= 0 && (await state()).held === 'plank')) await hold('plank');
          await use(x, g - 1 + i, z);
          const key = await game(([a, b, c]) => window.__game.block(a, b, c).key, [x, g + i, z]);
          must(key === 'oak_plank', `a plank did not go down at ${x}, ${g + i}, ${z} (${key})`);
        }
      }
      // The bed is two blocks long and goes on the way the player faces: step back and come up facing north,
      // and set its foot down at h.z + 1 so its pillow is at h.z, under the roof to come.
      await walkTo({ x: h.x + 0.5, y: g, z: h.z + 3.5 }, { within: 0.3, seconds: 30 });
      await walkTo({ x: h.x + 0.5, y: g, z: h.z + 2.5 }, { within: 0.3, seconds: 30 });
      await hold('bed');
      await use(h.x, g - 1, h.z + 1);
      must((await p.placed(h.x, g, h.z)) === 'bed' && (await p.placed(h.x, g, h.z + 1)) === 'bed', 'no bed two blocks long stands where it was set down');
      await game(() => window.__game.advance(1));
      must((await p.openStep()) === 'roof.shelter', 'a bed under open sky passed the shelter step');
      await hold('plank');
      await use(h.x - 1, g + 2, h.z, [1, 0, 0]);
      await expectStep('roof.sleep');
    });
    await step('roof', 'wait for evening and sleep in the bed with E', async () => {
      const h = await hut();
      await walkTo({ x: h.x + 0.5, y: h.y, z: h.z + 2.5 }, { within: 0.25, seconds: 60 });
      const prompt = (await state()).prompt;
      must(prompt === 'Sleep', `beside the bed the prompt is "${prompt}"`);
      if ((await state()).clock.timeOfDay < 0.66) {
        await page.keyboard.press('KeyE');
        await game(() => window.__game.advance(0.2));
        must((await state()).clock.day === 1, 'the bed slept before evening');
        await until('g.state().clock.timeOfDay >= 0.66', 720, 2);
      }
      await shot('13-shelter-evening.png');
      must(await p.canSleep(), 'canSleep() is false in the evening beside the bed');
      const day = (await state()).clock.day;
      await page.keyboard.press('KeyE');
      await until(`g.state().clock.day === ${day + 1}`, 10, 0.25);
      must((await state()).clock.day === day + 1, 'E beside the bed in the evening did not sleep to the next morning');
      await game(() => window.__game.advance(2));
    });
    await questDone('roof', '14-morning.png');
  },

  async leaftail() {
    await step('leaftail', 'walk softly to the dead garden', async () => {
      await expectStep('leaftail.find');
      const garden = await p.place('dead.garden');
      const walked = await walkCarefully(garden, 9);
      await game(() => window.__game.advance(0.6));
      must((await p.openStep()) !== 'leaftail.find', 'ten blocks from the garden the find step is open');
      await shot('20-garden.png');
      return `${walked.seconds} s of walking`;
    });
    await step('leaftail', 'pick 3 berries with E', async () => {
      for (const bush of await p.bushes()) {
        if ((await p.count('berry')) >= 3) break;
        if (!bush.ripe) continue;
        await walkCarefully(bush, 1.2);
        const prompt = (await state()).prompt;
        must(prompt === 'Pick berries', `at a ripe bush the prompt is "${prompt}"`);
        await page.keyboard.press('KeyE');
        await game(() => window.__game.advance(0.2));
      }
      must((await p.count('berry')) >= 3, `only ${await p.count('berry')} berries`);
      await expectStep('leaftail.trust');
    });
    await step('leaftail', 'feed it twice with the real right button, standing still', async () => {
      let tries = 0;
      while ((await p.pet()).trust < 2) tries += await feed(false);
      await shot('21-feeding.png');
      return `${tries} offers`;
    });
    await step('leaftail', 'feed it a third time with E, and it bonds', async () => {
      if ((await p.count('berry')) < 1) {
        for (const bush of await p.bushes()) {
          if ((await p.count('berry')) >= 1) break;
          if (!bush.ripe) continue;
          await walkCarefully(bush, 1.2);
          await page.keyboard.press('KeyE');
        }
      }
      await feed(true);
      const pet = await p.pet();
      must(pet.bonded, 'three berries did not bond it');
      await expectStep('leaftail.show');
    });
    await step('leaftail', 'walk the path to Hollowmere with it and show it to Tamsin', async () => {
      const walked = await walkToTown();
      const s = (await state()).player, pet = await p.pet();
      must(Math.hypot(pet.x - s.x, pet.z - s.z) < 12, `the leaftail fell ${Math.hypot(pet.x - s.x, pet.z - s.z).toFixed(1)} blocks behind`);
      await shot('22-town-gate.png');
      await talkTo('tamsin');
      must((await p.flag('leaftail.shown')) === true, 'showing it to Tamsin did not count');
      return walked ? `${walked.seconds} s on the path, ${walked.jumps} jumps` : '';
    });
    await questDone('leaftail', '23-leaftail-done.png');
  },

  async bread() {
    await step('bread', 'meet Queen Maren in the granary', async () => {
      if ((await p.openStep()) === 'bread.town') await walkToTown();
      await expectStep('bread.queen');
      await talkTo('maren');
      must((await p.flag('bread.asked')) === true, 'Maren did not ask for the wheat');
      await expectStep('bread.seeds');
    });
    await step('bread', 'get the hoe, the can and 12 seeds from Gus', async () => {
      await talkTo('gus');
      must((await p.count('hoe')) === 1 && (await p.count('watering_can')) === 1 && (await p.count('wheat_seeds')) >= 12, 'Gus did not give the tools and seeds');
      await expectStep('bread.grow');
    });
    await step('bread', 'walk back, till, plant and water a field with real clicks', async () => {
      await walkToGrant();
      const f = await field();
      await walkTo(f.stand, { within: 0.3, seconds: 120 });
      await hold('hoe');
      for (const cell of f.cells) {
        await use(cell.x, cell.y, cell.z);
        const key = await game(([a, b, c]) => window.__game.block(a, b, c).key, [cell.x, cell.y, cell.z]);
        must(key === 'tilled_soil', `the hoe did not till ${cell.x}, ${cell.z} (${key})`);
      }
      must((await plant()) === 12, 'twelve seeds did not go in');
      await waterField();
      for (const cell of f.cells) must(((await p.crop(cell.x, cell.y, cell.z))?.wet ?? 0) > 0, `the crop at ${cell.x}, ${cell.z} is dry`);
      await shot('30-field.png');
    });
    if (!args.includes('--no-continue')) {
      await step('bread', 'reload the page mid-quest and Continue from the title', async () => {
        const before = await state();
        await game(() => window.__game.save());
        await openGame();
        await page.click('[data-key="title:continue"]');
        await page.waitForFunction(() => window.__game.started);
        await game(() => window.__game.settle());
        const after = await state();
        must(after.clock.day === before.clock.day && Math.abs(after.clock.seconds - before.clock.seconds) < 2, `the clock came back as ${after.clock.seconds}, not ${before.clock.seconds}`);
        must(JSON.stringify(after.bag) === JSON.stringify(before.bag), 'the bag did not come back');
        must(after.flags['pet.leaftail.bonded'] === true && after.tracked === 'bread', 'the quests or the pet did not come back');
        const f = await field();
        must((await p.crop(f.cells[0].x, f.cells[0].y, f.cells[0].z)) !== null, 'the crops did not come back');
        await shot('31-continued.png');
        return `${after.bag.length} stacks in the bag`;
      });
    }
    await step('bread', 'grow, harvest with the left button and replant until 20 wheat', async () => {
      const f = await field();
      let sawRain = false;
      for (let rounds = 0; rounds < 6 && (await p.count('wheat')) < 20; rounds++) {
        await walkTo(f.stand, { within: 0.3, seconds: 120 });
        if ((await p.crops()).length === 0) { must((await plant()) > 0, 'no seeds and no wheat'); await waterField(); }
        for (let waited = 0; waited < 600; waited += 5) {
          const crops = await p.crops();
          if (crops.every((c) => c.ripe)) break;
          if (crops.some((c) => !c.ripe && c.wet <= 0)) await waterField();
          await game(() => window.__game.advance(5));
          if (!sawRain && (await state()).ambient.rain > 0.3) { sawRain = true; await shot('32-rain.png'); }
        }
        must((await p.crops()).every((c) => c.ripe), 'the wheat was not ripe after ten minutes');
        if (rounds === 0) await shot('33-ripe.png');
        for (const cell of f.cells) {
          if (!(await p.crop(cell.x, cell.y, cell.z))?.ripe) continue;
          const before = await p.count('wheat');
          await tap(cell.x, cell.y, cell.z);
          must((await p.count('wheat')) === before + 2, `a ripe wheat gave ${(await p.count('wheat')) - before}`);
        }
        if ((await p.count('wheat')) < 20) { await plant(); await waterField(); }
      }
      must((await p.count('wheat')) >= 20, `only ${await p.count('wheat')} wheat`);
      if (!sawRain) note('no rain was seen on the field');
      await expectStep('bread.deliver');
      return `${await p.count('wheat')} wheat`;
    });
    await step('bread', 'bring 20 wheat to Maren', async () => {
      await walkToTown();
      const before = await p.count('wheat');
      const lines = await talkTo('maren');
      must((await p.flag('bread.delivered')) === true && (await p.count('wheat')) === before - 20, `Maren did not take the wheat: ${lines.join(' / ')}`);
    });
    await questDone('bread', '34-delivered.png');
  },

  async festival() {
    await step('festival', 'come to the square at dusk', async () => {
      await expectStep('festival.evening');
      must(await until(`g.state().flags['festival.started'] === true`, await p.dayLength(), 2), 'the festival did not start');
      await walkToTown();
      await walkTo('town.square', { within: 3, seconds: 240 });
      await expectStep('festival.lamp');
      await shot('40-festival-square.png');
    });
    await step('festival', 'get the river lamp from Odo', async () => {
      await talkTo('odo');
      must((await p.count('river_lamp')) === 1, 'Odo did not give the lamp');
    });
    await step('festival', 'float the lamp from the river bank with the right button', async () => {
      await walkTo('river.bank', { within: 2, seconds: 240 });
      await hold('river_lamp');
      const s = (await state()).player;
      await use(Math.floor(s.x), Math.floor(s.y) - 1, Math.floor(s.z) + 1);
      must((await p.flag('festival.lamp')) === true && (await p.count('river_lamp')) === 0, 'the lamp did not float');
      await game(() => window.__game.advance(3));
      await shot('41-lamps.png');
      await expectStep('festival.end');
    });
    await step('festival', 'talk to Tamsin on the bank, and the end card shows', async () => {
      const bank = await p.place('river.bank');
      await until(`(() => { const t = sys.people.get('tamsin'); return Math.hypot(t.pos.x - ${bank.x}, t.pos.z - ${bank.z}) < 6; })()`, 120, 1);
      const lines = await talkTo('tamsin');
      must(lines.at(-1) === 'Go on. Float your lamp.', `her last line is "${lines.at(-1)}"`);
      await page.waitForSelector('.gu-stage-end:not([hidden])', { timeout: 30000 });
      await shot('42-end-card.png');
      const card = await game(() => document.querySelector('.gu-stage-end')?.innerText ?? '');
      must(/End of the first part/i.test(card), `the end card reads "${card.slice(0, 80)}"`);
      await page.getByRole('button', { name: 'Keep playing' }).click();
      await frames(2);
      const s = await state();
      must(s.flags['act1.ended'] === true && !s.player.busy, 'the game did not go on after Keep playing');
      must(await game(() => !document.querySelector('.gu-stage-end:not([hidden])')), 'the end card is still open');
      return card.replace(/\s+/g, ' ').slice(0, 160);
    });
  },
};

try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const quest of ['plot', 'roof', 'leaftail', 'bread', 'festival']) await QUESTS[quest]();
  const end = await state();
  must(Object.keys(end.failed).length === 0 && end.viewErrors.length === 0, `failed: ${JSON.stringify(end.failed)} ${end.viewErrors.join('; ')}`);
  log.push({ end: { stats: end.stats, clock: end.clock, counters: await game(() => window.__game.counters()) } });
} catch (error) {
  failed = error;
} finally {
  await browser?.close();
  process.kill(serverPid);
}

writeFileSync(resolve(out, 'act1.json'), JSON.stringify({ log, notes, errors, turns, seconds: (Date.now() - started) / 1000 }, null, 2));
if (errors.length) console.log(`FAIL console errors:\n  ${errors.join('\n  ')}`);
if (failed && !log.some((l) => l.ok === false)) console.log(`FAIL ${failed.stack ?? failed}`);
const pass = !failed && errors.length === 0;
console.log(`\n${pass ? 'PASS' : 'FAIL'}: ${log.filter((l) => l.ok).length} steps, ${errors.length} console errors, ${turns} camera turns to aim, ${((Date.now() - started) / 60000).toFixed(1)} minutes`);
process.exit(pass ? 0 : 1);

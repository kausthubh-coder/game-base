import { requireBetaHash, chapterRuntime } from './lib/beta-chain.mjs';
// Pump from the exact earned Echo boundary. All actions use browser input.
// PLAY_PORT=5571 bun tools/play-pump.mjs --save <earned.save.json> --out <new-directory>
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
import { createKeyboardSteering } from './lib/keyboard-steering.mjs';
import { launchChrome } from './lib/chrome.mjs';
import { observePumpTransactions } from './pump-observation.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { createHash } from 'node:crypto';

// A running or interrupted attempt is always BLOCKED, even if cleanup flushes again.
export function createPumpJournal(out, describe) {
  let complete = false, interrupted = null;
  const flush = () => {
    const state = describe();
    const report = { ...state, interrupted, status: complete && !state.failure && !interrupted ? 'PASS' : 'BLOCKED' };
    const temporary = resolve(out, 'replay.json.tmp');
    writeFileSync(temporary, JSON.stringify(report, null, 2));
    renameSync(temporary, resolve(out, 'replay.json'));
    return report;
  };
  return {
    flush,
    interrupt(signal) { interrupted = signal; return flush(); },
    complete() { complete = true; return flush(); },
    get interrupted() { return interrupted; },
  };
}

// Vite's assetsDir is nested. Hash the emitted runtime files by their served paths.
export function pumpBuildHashes(directory) {
  const files = [];
  const visit = (relative = '') => {
    for (const entry of readdirSync(resolve(directory, relative), { withFileTypes: true })) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && /\.(js|css|html)$/.test(entry.name)) files.push(path);
    }
  };
  visit();
  if (!files.some((path) => path.endsWith('.js')) || !files.some((path) => path.endsWith('.css')))
    throw Error('build provenance requires nonempty emitted JS and CSS lists');
  return Object.fromEntries(files.sort().map((path) => [path,
    createHash('sha256').update(readFileSync(resolve(directory, path))).digest('hex'),
  ]));
}

export async function stopPumpChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((done, fail) => {
    let timeout;
    const finish = (error) => {
      clearTimeout(timeout);
      child.removeListener('exit', exited);
      child.removeListener('error', failed);
      error ? fail(error) : done();
    };
    const exited = () => finish(), failed = (error) => finish(error);
    child.once('exit', exited);
    child.once('error', failed);
    child.kill('SIGTERM');
    timeout = setTimeout(() => child.kill('SIGKILL'), 2000);
  });
}

// The combat pointer intersects the hero-foot plane, even on sloping terrain.
export function pumpAimPoint([x, z]) {
  const view = window.__game.view;
  return view.project(x, view.playerPosition.y, z);
}

if (import.meta.main) {
const root = resolve(import.meta.dirname, '..');
const outIndex = process.argv.indexOf('--out');
if (outIndex < 0 || !process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith('--')) {
  throw new Error('--out requires an evidence directory');
}
const out = resolve(root, process.argv[outIndex + 1]);
if (existsSync(out) && readdirSync(out).length)
  throw Error('Choose an empty --out directory to preserve prior evidence');

const port = Number(process.env.PLAY_PORT || 5571);
const activeIndex = process.argv.indexOf('--active-heavy-jobs');
const activeHeavyJobs = activeIndex < 0 ? NaN : Number(process.argv[activeIndex + 1]);
if (![0, 1].includes(activeHeavyJobs)) throw Error('--active-heavy-jobs requires the coordinator-confirmed machine-wide count, 0 or 1');
const dist = chapterRuntime(process.argv, 'dist-pump-input', { legacyPattern: /^dist-pump-[a-z0-9-]+$/ });
// Reuse only a completed output whose runtime source the coordinator has confirmed.
let pumpChoice = 'shown';
const saveIndex = process.argv.indexOf('--save');
mustSave();
function mustSave() {
  if (saveIndex < 0 || !process.argv[saveIndex + 1] || process.argv[saveIndex + 1].startsWith('--'))
    throw Error('--save requires an unedited earned stage save');
}
const rawInput = readFileSync(resolve(root, process.argv[saveIndex + 1]), 'utf8');
const inputHash = createHash('sha256').update(rawInput).digest('hex');
requireBetaHash(inputHash, '4e2c5132b90538983fdb9336efa16320ff4a736aa8643c44354a5f86f360930f', 'echo');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'boundary.save.json'), rawInput);
const qualityIndex = process.argv.indexOf('--quality');
const quality = qualityIndex < 0 ? 'high' : process.argv[qualityIndex + 1];

const runnerSha256 = createHash('sha256')
  .update(readFileSync(import.meta.filename))
  .digest('hex');
const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const sourceDiff = spawnSync('git', ['diff', '--binary', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).stdout;
writeFileSync(resolve(out, 'tested-working-tree.patch'), sourceDiff);
const sourceDiffSha256 = createHash('sha256').update(sourceDiff).digest('hex');
let browser,
  build,
  server,
  page,
  failure,
  current = 'build';
let routeComplete = false;
const resources = [];
const transactions = [];
let observationScope = null;
async function collectTransactions(checkpoint) {
  if (!observationScope) return;
  const observation = await page.evaluate(() => ({ rows: window.__pumpTransactions.rows, snapshot: window.__pumpTransactions.snapshot() }));
  observationScope.rows = observation.rows;
  if (checkpoint) observationScope.checkpoints.push({ name: checkpoint, index: observation.rows.length, snapshot: observation.snapshot });
  writeFileSync(resolve(out, "transactions.json"), JSON.stringify(transactions, null, 2));
}
async function startTransactions(raw, label) {
  observationScope = { id: transactions.length, label, inputHash: createHash("sha256").update(raw).digest("hex"), rows: [], checkpoints: [] };
  transactions.push(observationScope);
  await page.evaluate(observePumpTransactions);
}
async function gate() {
  const s = await sample();
  resources.push(s);
  writeFileSync(resolve(out, 'resources.json'), JSON.stringify(resources, null, 2));
  must(canStartHeavy(s, activeHeavyJobs), 'resource probe holds heavy launch with ' + activeHeavyJobs + ' active heavy jobs: ' + JSON.stringify(s));
  must(!journal.interrupted, 'interrupted during admission probe');
  record({ type: 'heavy-admission', activeHeavyJobs, sample: s });
}
const monitor = setInterval(
  () =>
    sample()
      .then((s) => {
        resources.push(s);
        writeFileSync(resolve(out, 'resources.json'), JSON.stringify(resources, null, 2));
        console.log('resource', JSON.stringify(s));
        journal.flush();
      })
      .catch(console.error),
  30000,
);
const inputs = [],
  captures = [],
  errors = [],
  scenes = [],
  framing = [],
  restoration = [],
  entries = [];
const journal = createPumpJournal(out, () => ({
  sha, sourceDiffSha256, runnerSha256, inputHash, dist, quality, current, failure, errors,
  scenes, inputs, captures, framing, restoration, entries,
}));
journal.flush();
let emergencyExit;
const interrupt = (signal) => {
  failure = `Interrupted by ${signal} during ${current}`;
  journal.interrupt(signal); // Persist before closing anything that can reject pending input.
  clearInterval(monitor);
  build?.kill('SIGTERM');
  server?.kill('SIGTERM');
  void browser?.close().catch((error) => console.error('browser cleanup', String(error)));
  // A child or browser transport may never settle. Retain the BLOCKED trace in that case too.
  emergencyExit = setTimeout(() => {
    journal.flush();
    build?.kill('SIGKILL');
    server?.kill('SIGKILL');
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }, 5000);
  emergencyExit.unref();
};
const onTerm = () => interrupt('SIGTERM'), onInt = () => interrupt('SIGINT');
process.once('SIGTERM', onTerm);
process.once('SIGINT', onInt);
async function observeScenes() {
  await page
    .exposeFunction('pumpScene', (data) => scenes.push(data))
    .catch((e) => {
      if (!String(e).includes('already')) throw e;
    });
  await page.evaluate(() =>
    window.__game.view.game.events.on('scene.played', (data) => window.pumpScene(data)),
  );
}
const must = (ok, why) => {
  if (!ok) throw new Error(why);
};
const record = (action) => {
  const entry = { step: current, time: Date.now(), ...action };
  inputs.push(entry);
  appendFileSync(resolve(out, 'inputs.ndjson'), JSON.stringify(entry) + '\n');
};
const read = () =>
  page.evaluate(() => {
    const g = window.__game,
      o = g.view.game.systems.opening;
    const state = g.state();
    if (state.talk) state.talk.scene = g.view.game.systems.talk.current()?.scene;
    return {
      ...state,
      gear: g.view.game.systems.bench.gear(),
      health: g.view.game.systems.fights.hero(),
      farms: g.view.game.systems.farms.all(),
      opening: { stage: o.stage(), hero: o.hero(), ask: o.asking(), bout: o.bout() },
    };
  });
async function shot(name) {
  await page.waitForTimeout(120);
  const s = await read();
  await page.screenshot({ path: resolve(out, name + '.png') });
  writeFileSync(resolve(out, name + '.json'), JSON.stringify(s, null, 2));
  captures.push({ name, state: s });
  journal.flush();
  console.log(`ok ${name} ${s.prompt ?? ''}`);
}
async function wait(test, why, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const s = await read();
    must(!s.viewErrors.length && !Object.keys(s.failed).length, JSON.stringify(s.viewErrors));
    if (await test(s)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${why}`);
}
async function press(key) {
  record({ type: 'press', key });
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
}
async function click(selector) {
  record({ type: 'click', selector });
  await page.locator(selector).click();
}
async function dialogue(name) {
  current = name;
  await wait((s) => !!s.talk, name + ' begins');
  await shot(name);
  const expected = name.startsWith('25-') ? 25 : name === '26-pails' ? 26 : undefined;
  const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
  entries.push({ name, frame: await firstnightFrame(page) });
  for (let i = 0; i < 160; i++) {
    const s = await read();
    if (!s.talk) {
      await page.waitForTimeout(1000);
      const back = await read();
      if (!back.talk) must(!back.player.busy, 'controls remain busy');
      const restored = await page.evaluate(() => window.__game.view.camera.yaw);
      must(Math.abs(restored - yaw) < 0.001, 'camera yaw not restored');
      restoration.push({ name, yaw, restored });
      return;
    }
    if (expected) must(s.talk.scene === expected, 'wrong scene ' + s.talk.scene);
    await settleDialogue(page);
    const frame = await firstnightFrame(page);
    const issues = firstnightIssues(frame);
    framing.push({ name, i, frame, issues });
    journal.flush();
    await page.screenshot({ path: resolve(out, name + '-line-' + i + '.png') });
    must(!issues.length, name + ' framing: ' + issues.join('; '));
    if (s.talk.choices?.length) {
      must(s.talk.scene === 25, 'unexpected choice');
      record({ type: 'choice', choice: pumpChoice });
      await press(pumpChoice === 'kept' ? 'Digit2' : 'Digit1');
    } else await press('KeyE');
    await page.waitForTimeout(150);
  }
  throw Error(name + ' never ended');
}
async function walk(x, z, near = 0.3) {
  for (let replans = 0; replans < 12; replans++) {
    try {
      return await straightWalk(x, z, near);
    } catch (error) {
      if (!/walking stuck|walking exhausted/.test(String(error))) throw error;
      const path = await page.evaluate(
        ([x, z]) => {
          const g = window.__game.view.game;
          const to = { x, y: g.world.heightAt(Math.floor(x), Math.floor(z)), z };
          return (
            g.systems.nav.path(g.player.pos, to, 20000) ??
            g.systems.nav.toward(g.player.pos, to, 20000)
          );
        },
        [x, z],
      );
      record({ type: 'read-only-nav-route', goal: { x, z }, path });
      must(path?.length, 'no walkable route');
      for (const p of path) {
        if ((await read()).talk) return;
        await straightWalk(p.x, p.z, 0.2);
      }
      // toward() may return a bounded partial route. Replan from its earned end.
    }
  }
  throw Error('walking exhausted after 12 navigation replans');
}

async function straightWalk(x, z, near = 0.3) {
  const goal = { x, z };
  record({ type: 'walk-goal', goal, near });
  let last,
    stuck = 0,
    best = Infinity,
    withoutProgress = 0;
  const held = new Set();
  const steer = createKeyboardSteering();
  try {
    for (let i = 0; i < 1000; i++) {
      const s = await read(),
        p = s.player;
      if (i % 100 === 0) console.log('walk', current, i, p.x, p.z, 'to', x, z);
      if (s.talk || Math.hypot(goal.x - p.x, goal.z - p.z) < near) return;
      must(!p.busy, 'walk blocked by busy state');
      const t = goal;
      const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
      const dx = t.x - p.x,
        dz = t.z - p.z,
        len = Math.hypot(dx, dz) || 1;
      const direction = steer(dx, dz, yaw);
      const want = new Set([
        ...(direction.forward > 0 ? ['KeyW'] : direction.forward < 0 ? ['KeyS'] : []),
        ...(direction.right > 0 ? ['KeyD'] : direction.right < 0 ? ['KeyA'] : []),
      ]);
      for (const key of held)
        if (!want.has(key)) {
          record({ type: 'up', key });
          await page.keyboard.up(key);
          held.delete(key);
        }
      for (const key of want)
        if (!held.has(key)) {
          record({ type: 'down', key });
          await page.keyboard.down(key);
          held.add(key);
        }
      await page.waitForTimeout(50);
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < 0.03) stuck++;
      else stuck = 0;
      const distance = Math.hypot(goal.x - p.x, goal.z - p.z);
      if (distance < best - 0.03) {
        best = distance;
        withoutProgress = 0;
      } else withoutProgress++;
      if (stuck > 25 || withoutProgress > 25)
        throw new Error(`walking stuck at ${p.x},${p.z}, goal ${goal.x},${goal.z}`);
      last = p;
    }
    throw new Error('walking exhausted');
  } finally {
    for (const key of held) {
      record({ type: 'up', key });
      await page.keyboard.up(key);
    }
  }
}
async function save(name) {
  // Public save entry point, explicitly recorded; no serialization edits or supplied fixture.
  record({ type: 'public-save', method: '__game.save' });
  must(await page.evaluate(() => window.__game.save()), 'save failed');
  const raw = await page.evaluate(() => localStorage.getItem('greenhollow.save'));
  must(raw, 'save missing');
  writeFileSync(resolve(out, name + '.save.json'), raw);
  await collectTransactions(name);
  record({ type: 'save-sha256', name, sha256: createHash('sha256').update(raw).digest('hex') });
  journal.flush();
  return JSON.parse(raw);
}
async function goPlace(id, dx = 0, dz = 0, near = 1) {
  const p = await page.evaluate((id) => window.__game.view.game.systems.region.place(id).at, id);
  await walk(p.x + dx, p.z + dz, near);
  return p;
}
async function continueSave(name, home = true) {
  await press('Escape');
  await wait((s) => s.paused, 'normal pause before checkpoint');
  const before = await save(name);
  await collectTransactions();
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await observeScenes();
  await startTransactions(readFileSync(resolve(out, name + ".save.json"), "utf8"), name + "-continued");
  record({
    type: 'public-save-observer',
    method: '__game.save',
    intent: 'capture exact restored bytes after the Continue click, before the next frame',
  });
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      () =>
        queueMicrotask(async () => {
          await window.__game.save();
          window.__pumpContinueRaw = localStorage.getItem('greenhollow.save');
        }),
      { once: true },
    );
  });
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForFunction(() => !!window.__pumpContinueRaw);
  const raw = await page.evaluate(() => window.__pumpContinueRaw);
  writeFileSync(resolve(out, name + '-continued.save.json'), raw);
  await collectTransactions(name + '-continued');
  const after = JSON.parse(raw);
  record({
    type: 'save-sha256',
    name: name + '-continued',
    sha256: createHash('sha256').update(raw).digest('hex'),
  });
  await wait((s) => s.started && !s.player.busy, 'Continue');
  for (const key of [
    'inventory',
    'bench',
    'placeables',
    'settlement',
    'quests',
    'goods',
    'crops',
    'ruins',
  ])
    must(
      JSON.stringify(before.game.systems[key]) === JSON.stringify(after.game.systems[key]),
      key + ' changed on Continue',
    );
  must(JSON.stringify(before.world) === JSON.stringify(after.world), 'world changed on Continue');
  for (const [key, value] of before.game.flags)
    if (/^(shrine\.|choice\.dinner|dinner\.|scene\.|memory\.|vaults\.|keystone\.|job\.)/.test(key))
      must(Object.fromEntries(after.game.flags)[key] === value, key + ' changed on Continue');
  const friendship = (v) => v.game.systems.people.people.map((p) => [p.id, p.friendship]);
  must(
    JSON.stringify(friendship(before)) === JSON.stringify(friendship(after)),
    'friendships changed on Continue',
  );
  if (home)
    await wait(
      (s) =>
        s.flags.heartstone === Object.fromEntries(before.game.flags).heartstone &&
        ['moss', 'quill', 'copper'].every((id) => s.flags['farm.' + id + '.living']),
      'settled home systems',
    );
  await page.waitForFunction(
    (level) =>
      document.querySelector('.ui-heart-name')?.textContent?.startsWith('Heartstone ' + level),
    Object.fromEntries(before.game.flags).heartstone,
  );
  await page.waitForFunction(
    () => !document.querySelector('.ui-heart')?.classList.contains('is-rising'),
  );
  await shot(name + '-continued');
}
async function importRaw(raw, label = "boundary") {
  await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
  await page.evaluate((raw) => localStorage.setItem('greenhollow.save', raw), raw);
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
  await observeScenes();
  await startTransactions(raw, label);
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await wait((s) => s.started && !s.player.busy, 'Continue');
}
async function branch(raw, name, run) {
  await collectTransactions();
  const main = page, mainScope = observationScope;
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  try {
    record({
      type: 'independent-raw-import',
      name,
      sha256: createHash('sha256').update(raw).digest('hex'),
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) errors.push(m.text());
    });
    await importRaw(raw, name);
    await run();
  } finally {
    await collectTransactions();
    await context.close();
    page = main; observationScope = mainScope;
  }
}

const fightRead = () =>
  page.evaluate(() => {
    const r = window.__game.view.game.systems.fights.running();
    if (!r) return null;
    const k = r.keeper;
    return {
      n: r.n,
      result: r.result,
      phase: r.fight.phase,
      hero: { ...r.fight.hero },
      aim: { x: r.fight.input.aimX, z: r.fight.input.aimZ },
      beasts: r.fight.beasts.map((b) => ({ x: b.x, z: b.z, doing: b.doing, guard: b.guard })),
      keeper: k
        ? {
            body: { ...k.body },
            heart: { ...k.heart },
            parts: k.parts.map((p) => ({ ...p })),
            floods: k.parts.map((_, i) => k.flooded(i)),
            record: { ...k.record },
          }
        : null,
      record: { ...r.fight.record },
    };
  });
async function stepTo(x, z, ms = 120) {
  const s = await read(),
    yaw = await page.evaluate(() => window.__game.view.camera.yaw),
    d = createKeyboardSteering()(x - s.player.x, z - s.player.z, yaw);
  const keys = [
    ...(d.forward > 0 ? ['KeyW'] : d.forward < 0 ? ['KeyS'] : []),
    ...(d.right > 0 ? ['KeyD'] : d.right < 0 ? ['KeyA'] : []),
  ];
  for (const key of keys) {
    record({ type: 'down', key });
    await page.keyboard.down(key);
  }
  await page.waitForTimeout(ms);
  for (const key of keys) {
    record({ type: 'up', key });
    await page.keyboard.up(key);
  }
}
async function attack(x, z, held = 50) {
  const at = await page.evaluate(pumpAimPoint, [x, z]);
  must(at, 'combat aim visible');
  record({ type: 'mouse-attack', x, z, at, held });
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(held);
  await page.mouse.up();
  await page.waitForTimeout(180);
}
async function combat(n) {
  current = 'fight-' + n;
  await wait(() => fightRead().then((s) => s?.n === n), 'fight ' + n);
  await shot(current + '-start');
  let shown = false;
  const began = Date.now();
  while (Date.now() - began < 300000) {
    const s = await fightRead();
    if (!s) break;
    if (Date.now() - (combat.lastLog ?? 0) > 10000) {
      combat.lastLog = Date.now();
      console.log('combat', JSON.stringify(s));
      writeFileSync(resolve(out, 'combat-live.json'), JSON.stringify(s, null, 2));
      await page.screenshot({ path: resolve(out, 'combat-live.png') });
    }
    must(s.n === n, 'wrong fight');
    must(!s.result || s.result === 'won', 'fight ended normally without a win: ' + s.result);
    if (s.phase === 'won') {
      await shot(current + '-won');
      break;
    }
    if (s.hero.act === 'faint') {
      await shot(current + '-normal-recovery');
      await page.waitForTimeout(1500);
      continue;
    }
    if (n === 6) {
      const b = s.beasts[0];
      if (b.doing === 'dizzy') {
        if (Math.hypot(b.x - s.hero.x, b.z - s.hero.z) > 4) {
          await stepTo(b.x, b.z, 250);
          continue;
        }
        record({ type: 'hold', key: 'KeyF', ms: 1100 });
        await page.keyboard.down('KeyF');
        await page.waitForTimeout(1100);
        await page.keyboard.up('KeyF');
        continue;
      }
      const d = Math.hypot(b.x - s.hero.x, b.z - s.hero.z);
      if (d > 4) await stepTo(b.x, b.z);
      else {
        if (b.doing === 'windup') await press('ShiftLeft');
        await attack(b.x, b.z, 850);
      }
    } else {
      const k = s.keeper,
        b = k.body,
        h = k.heart;
      if (h.open) {
        if (!shown) {
          await shot('keeper-flood-stall');
          shown = true;
        }
        const d = Math.hypot(h.x - s.hero.x, h.z - s.hero.z);
        if (d > 6) await stepTo(h.x, h.z);
        else await attack(h.x, h.z, 850);
      } else {
        const g = k.parts[1];
        if (k.floods[1] > 0) {
          await stepTo(g.x, g.z + 5.5);
        } else if (Math.hypot(g.x - s.hero.x, g.z - s.hero.z) > 5) await stepTo(g.x, g.z + 1);
        else await attack(g.x, g.z, 850);
      }
    }
  }
  await wait((s) => !!s.flags['fight.' + n + '.won'], 'fight won ' + n, 15000);
  await wait(() => fightRead().then((s) => !s), 'fight releases controls', 15000);
  await shot('fight-' + n + '-after');
  await save('fight-' + n + '-rewards');
}
async function roomSpot(room, spot) {
  // Leave the drained stair to the north before crossing its west wall.
  if (room === 'pump-upper' && spot === 'out') {
    await walk(-582, 2408.3, 0.25);
    await walk(-589, 2408.3, 0.25);
  }
  const offsets = { 'pump-upper': [-600, 2400], 'pump-lower': [-524, 2400] },
    spots = {
      'pump-upper': { lever: [9.5, 8.9], stair: [18, 9.4], out: [11, 14.6] },
      'pump-lower': { up: [23.5, 1.4], keystone: [11.5, 1.8], memory: [14.5, 1.8] },
    };
  const o = offsets[room],
    p = spots[room][spot];
  await walk(o[0] + p[0], o[1] + p[1], 0.35);
}
async function usePrompt(text) {
  await wait((s) => s.prompt === text, text);
  await press('KeyE');
}

try {
  if (!process.argv.includes('--no-build')) {
    await gate();
    build = spawn(
      'bun',
      ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'],
      { cwd: root, stdio: 'inherit' },
    );
    must((await new Promise((done, fail) => { build.once('error', fail); build.once('exit', done); })) === 0, 'build failed');
  }
  writeFileSync(resolve(out, 'build-hashes.json'), JSON.stringify(pumpBuildHashes(resolve(root, dist)), null, 2));
  must(!journal.interrupted, 'interrupted before server launch');
  server = spawn('bun', ['tools/serve.mjs', dist, String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((done, fail) => {
    server.stdout.on('data', (b) => {
      if (/pid \d+/.test(String(b))) done();
    });
    server.on('exit', (c) => fail(Error('server exited ' + c)));
  });
  await gate();
  must(!journal.interrupted, 'interrupted before browser launch');
  browser = await launchChrome();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) errors.push(m.text());
  });

  record({ type: 'import-stage-boundary', path: process.argv[saveIndex + 1], sha256: inputHash });
  await importRaw(rawInput);
  const initial = JSON.parse(rawInput);
  const restoredBoundary = await save('boundary-restored');
  for (const key of ['inventory', 'bench', 'quests', 'ruins', 'placeables'])
    must(JSON.stringify(initial.game.systems[key]) === JSON.stringify(restoredBoundary.game.systems[key]), 'restored boundary ' + key);
  const q = restoredBoundary.game.systems.quests.quests;
  must(
    q.echo.state === 'done' &&
      q.pump.step === 'gearling' &&
      q.gallery.step === 'rootsnare' &&
      q.seeds.step === 'brass',
    'boundary quests',
  );
  for (const n of [1, 2, 3])
    must(!Object.fromEntries(initial.game.flags)['keystone.' + n], 'no initial keystone');
  await shot('00-boundary');
  current = 'mill-traversal';
  await goPlace('ruin-mill', 0, 7, 0.5);
  await combat(6);
  await goPlace('ruin-mill', 0, 2, 0.4);
  await usePrompt('Take the old brass');
  await save('mill-brass');
  current = 'marsh-traversal';
  await goPlace('pumphouse', 0, 3, 0.5);
  await shot('01-pump-entrance');
  await usePrompt('Go into the Pump House');
  await shot('02-upper');
  await roomSpot('pump-upper', 'lever');
  await shot('03-lever-before');
  await usePrompt('Pull the lever');
  await shot('04-drained');
  await continueSave('middle-drained', false);
  await roomSpot('pump-upper', 'stair');
  await usePrompt('Go down the stair');
  await shot('05-lower-landing');
  await walk(-503.8, 2405, 0.25);
  await combat(7);
  await roomSpot('pump-lower', 'keystone');
  await shot('06-keystone-before');
  await wait((s) => /keystone/i.test(s.prompt ?? ''), 'keystone prompt');
  await press('KeyE');
  const keystone = await save('keystone-earned');
  must(Object.fromEntries(keystone.game.flags)['keystone.1'], 'keystone earned before memory');
  must(!Object.fromEntries(keystone.game.flags)['scene.26'], 'memory not played before pickup');
  await roomSpot('pump-lower', 'memory');
  await shot('07-memory-before');
  await wait((s) => /stone/i.test(s.prompt ?? ''), 'memory prompt');
  await press('KeyE');
  await dialogue('26-pails');
  await save('memory-earned');
  const repeatBefore = await save('repeat-before');
  await roomSpot('pump-lower', 'keystone');
  must((await read()).prompt !== 'Take the keystone', 'keystone unavailable after taking');
  await press('KeyE');
  await roomSpot('pump-lower', 'memory');
  await usePrompt('Touch the stone again');
  await page.waitForTimeout(800);
  if ((await read()).talk) await dialogue('memory-repeat');
  const repeatAfter = await save('repeat-after');
  must(
    JSON.stringify(repeatBefore.game.systems.inventory) ===
      JSON.stringify(repeatAfter.game.systems.inventory),
    'repeat rewards',
  );
  await roomSpot('pump-lower', 'up');
  await usePrompt('Go up the stair');
  await roomSpot('pump-upper', 'out');
  await press('Escape');
  await save('pre-calla');
  const raw = readFileSync(resolve(out, 'pre-calla.save.json'), 'utf8');
  await press('Escape');
  await branch(raw, 'kept', async () => {
    pumpChoice = 'kept';
    await usePrompt('Go out to the river');
    await dialogue('25-calla-kept');
    await save('calla-kept');
  });
  pumpChoice = 'shown';
  record({
    type: 'independent-raw-import',
    name: 'shown',
    sha256: createHash('sha256').update(raw).digest('hex'),
  });
  await collectTransactions();
  await importRaw(raw, "shown");
  await usePrompt('Go out to the river');
  await dialogue('25-calla-shown');
  const exitBefore = await save('calla-shown');
  await usePrompt("Calla's seal is on the door");
  const exitAfter = await save('repeat-exit');
  must(JSON.stringify(exitBefore.game.systems.inventory) === JSON.stringify(exitAfter.game.systems.inventory), 'sealed exit gives no duplicate rewards');
  must(Object.fromEntries(exitBefore.game.flags).hearts === Object.fromEntries(exitAfter.game.flags).hearts, 'sealed exit gives no duplicate hearts');
  current = 'return-home';
  await goPlace('grant.center');
  await continueSave('final-home');
  const final = await save('earned-pump');
  const flags = Object.fromEntries(final.game.flags);
  for (const key of [
    'quest.pump.done',
    'quest.uphill.started',
    'keystone.1',
    'memory.pumphouse',
    'vault.pumphouse.cleared',
    'vault.pumphouse.sealed',
    'scene.26',
    'scene.25',
  ])
    must(flags[key], 'earned ' + key);
  must(flags['choice.calla'] === 'shown', 'shown main branch');
  for (const n of [2, 3]) must(!flags['keystone.' + n], 'later keystones untouched');
  for (const id of ['gallery', 'seeds'])
    must(final.game.systems.quests.quests[id].state !== 'done', 'later quest untouched');
  for (const b of initial.game.systems.placeables.placed)
    must(
      final.game.systems.placeables.placed.some((p) => JSON.stringify(p) === JSON.stringify(b)),
      'preserved building ' + b.id,
    );
  for (const pet of initial.game.systems.pets.pets) {
    const now = final.game.systems.pets.pets.find((p) => p.id === pet.id);
    must(now && now.trust === pet.trust && now.bonded === pet.bonded, 'preserved companion');
  }
  await shot('08-earned-home');
  must(!errors.length, errors.join('\n'));
  must(framing.length && framing.every((line) => !line.issues.length), 'all dialogue framing clear');
  must(!journal.interrupted, 'interrupted before completion');
  routeComplete = true;
} catch (e) {
  failure ??= String(e.stack ?? e);
  journal.flush();
  console.error(current, failure);
  if (page) {
    await save('last-earned-checkpoint').catch(() => {});
    await shot('failed').catch(() => {});
  }
} finally {
  clearInterval(monitor);
  await stopPumpChild(build).catch((error) => { failure ??= 'build cleanup: ' + String(error); });
  try { await browser?.close(); } catch (error) { failure ??= 'browser cleanup: ' + String(error); }
  await stopPumpChild(server).catch((error) => { failure ??= 'server cleanup: ' + String(error); });
  journal.flush();
  clearTimeout(emergencyExit);
  process.removeListener('SIGTERM', onTerm);
  process.removeListener('SIGINT', onInt);
}
const verdict = (routeComplete && !failure ? journal.complete() : journal.flush()).status;
console.log(verdict === 'PASS' ? 'PASS Pump' : 'BLOCKED');
process.exitCode = journal.interrupted ? (journal.interrupted === 'SIGINT' ? 130 : 143) : verdict === 'PASS' ? 0 : 1;
}

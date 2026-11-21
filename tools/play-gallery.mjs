import { requireBetaHash, chapterRuntime } from './lib/beta-chain.mjs';
// Pump from the exact earned uphill boundary. All actions use browser input.
// PLAY_PORT=5582 bun tools/play-gallery.mjs --save <earned.save.json> --out <new-directory>
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
import { observeGalleryTransactions as observePumpTransactions } from './gallery-observation.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { installReplayDriver } from './workflow/replay.mjs';
import { HERO, weaponOf } from '../src/game/content/fight.ts';
import { createHash } from 'node:crypto';

// A running or interrupted attempt is always BLOCKED, even if cleanup flushes again.
export function createPumpJournal(out, describe) {
  let complete = false,
    interrupted = null;
  const flush = () => {
    const state = describe();
    const report = {
      ...state,
      interrupted,
      status: complete && !state.failure && !interrupted ? 'PASS' : 'BLOCKED',
    };
    const temporary = resolve(out, 'replay.json.tmp');
    writeFileSync(temporary, JSON.stringify(report, null, 2));
    renameSync(temporary, resolve(out, 'replay.json'));
    return report;
  };
  return {
    flush,
    interrupt(signal) {
      interrupted = signal;
      return flush();
    },
    complete() {
      complete = true;
      return flush();
    },
    get interrupted() {
      return interrupted;
    },
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
  return Object.fromEntries(
    files.sort().map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(resolve(directory, path)))
        .digest('hex'),
    ]),
  );
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
    const exited = () => finish(),
      failed = (error) => finish(error);
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

export function requireGalleryWin(end, n) {
  if (end?.fight !== n || end.result !== 'won')
    throw Error('fight ended without victory: ' + JSON.stringify(end));
}

export function galleryThreat(t, h) {
  const dx = h.x - t.x,
    dz = h.z - t.z,
    grow = 0.8;
  if (t.kind === 'circle') return Math.hypot(dx, dz) < t.reach + grow;
  const along = dx * Math.sin(t.facing) - dz * Math.cos(t.facing);
  const across = dx * Math.cos(t.facing) + dz * Math.sin(t.facing);
  if (t.kind === 'line')
    return along >= -grow && along < t.reach + grow && Math.abs(across) < t.width / 2 + grow;
  return Math.hypot(dx, dz) < t.reach + grow && Math.abs(Math.atan2(across, along)) < t.width + 0.2;
}

// Keep the authored floor on both legs, including passages under the High Road.
export async function walkGalleryRoute(points, walk) {
  for(const p of points) {
    if(![p.x,p.y,p.z].every(Number.isFinite))throw Error('Gallery route requires an authored height');
    await walk(p.x,p.z,.2,p.y,true);
  }
}

export async function playGallery({run = null, args = process.argv, startingSave = null} = {}) {
  const root = resolve(import.meta.dirname, '..');
  const outIndex = args.indexOf('--out');
  if (outIndex < 0 || !args[outIndex + 1] || args[outIndex + 1].startsWith('--')) {
    throw new Error('--out requires an evidence directory');
  }
  const out = resolve(root, args[outIndex + 1]);
  if (existsSync(out) && readdirSync(out).length)
    throw Error('Choose an empty --out directory to preserve prior evidence');

  const port = Number(process.env.PLAY_PORT || 5582);
  const activeIndex = args.indexOf('--active-heavy-jobs');
  const activeHeavyJobs = activeIndex < 0 ? NaN : Number(args[activeIndex + 1]);
  if (![0, 1].includes(activeHeavyJobs))
    throw Error(
      '--active-heavy-jobs requires the coordinator-confirmed machine-wide count, 0 or 1',
    );
  const dist = chapterRuntime(args, 'dist-gallery-input', { legacyPattern: /^dist-gallery-(input|resume(?:-[a-z0-9]+)?)$/ });
  // Reuse only a completed output whose runtime source the coordinator has confirmed.
  let pumpChoice = 'shown';
  const saveIndex = args.indexOf('--save');
  mustSave();
  function mustSave() {
    if (
      saveIndex < 0 ||
      !args[saveIndex + 1] ||
      args[saveIndex + 1].startsWith('--')
    )
      throw Error('--save requires an unedited earned stage save');
  }
  const resumeIndex = args.indexOf('--resume');
  const resumePath = resumeIndex < 0 ? null : args[resumeIndex + 1];
  const rawInput = readFileSync(resolve(root, args[saveIndex + 1]), 'utf8');
  const inputHash = createHash('sha256').update(rawInput).digest('hex');
  requireBetaHash(inputHash, '2e87196658d91e6cace033284b2b218414e242c4a4e1214d791ed999abdb771d', 'uphill');
  if (process.env.BETA_PREDECESSOR && resumePath) throw Error('beta requires the complete Gallery route');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'tested-runner.mjs'), readFileSync(import.meta.filename));
  writeFileSync(resolve(out, 'boundary.save.json'), rawInput);
  const qualityIndex = args.indexOf('--quality');
  const quality = qualityIndex < 0 ? 'high' : args[qualityIndex + 1];

  const runnerSha256 = createHash('sha256')
    .update(readFileSync(import.meta.filename))
    .digest('hex');
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim();
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
    const observation = await page.evaluate(() => ({
      rows: window.__pumpTransactions.rows,
      snapshot: window.__pumpTransactions.snapshot(),
    }));
    observationScope.rows = observation.rows;
    if (checkpoint)
      observationScope.checkpoints.push({
        name: checkpoint,
        index: observation.rows.length,
        snapshot: observation.snapshot,
      });
    writeFileSync(resolve(out, 'transactions.json'), JSON.stringify(transactions, null, 2));
  }
  async function startTransactions(raw, label) {
    observationScope = {
      id: transactions.length,
      label,
      inputHash: createHash('sha256').update(raw).digest('hex'),
      rows: [],
      checkpoints: [],
    };
    transactions.push(observationScope);
    await page.evaluate(observePumpTransactions);
  }
  async function gate() {
    const s = await sample();
    resources.push(s);
    writeFileSync(resolve(out, 'resources.json'), JSON.stringify(resources, null, 2));
    must(
      canStartHeavy(s, activeHeavyJobs),
      'resource probe holds heavy launch with ' +
        activeHeavyJobs +
        ' active heavy jobs: ' +
        JSON.stringify(s),
    );
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
    sha,
    sourceDiffSha256,
    runnerSha256,
    inputHash,
    dist,
    quality,
    diagnosticResume: !!resumePath,
    current,
    failure,
    errors,
    scenes,
    inputs,
    captures,
    framing,
    restoration,
    entries,
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
  const onTerm = () => interrupt('SIGTERM'),
    onInt = () => interrupt('SIGINT');
  process.once('SIGTERM', onTerm);
  process.once('SIGINT', onInt);
  async function observeScenes() {
    await page
      .exposeFunction('pumpScene', (data) => scenes.push(data))
      .catch((e) => {
        if (!String(e).includes('already')) throw e;
      });
    await page.evaluate(() => {
      window.__game.view.game.events.on('scene.played', (data) => window.pumpScene(data));
      window.__galleryFightEnds = [];
      window.__game.view.game.events.on('fight.ended', (e) => window.__galleryFightEnds.push(e));
    });
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
  async function milestone(name, action, verify) {
    const perform = async () => { await action(); return read(); };
    if (run) return run.step(name, perform, verify);
    const state=await perform();must(await verify(state),'milestone failed: '+name);return state;
  }
  async function graphics(level) {
    await press('Escape');
    record({ type: 'click-role', role: 'button', name: 'Settings' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await click('input[name="gu-quality"][value="' + level + '"]');
    await press('Escape');
    if ((await read()).paused) {
      record({ type: 'click-role', role: 'button', name: 'Resume' });
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
    }
    await wait((s) => !s.paused, 'graphics menu closes');
  }
  async function shot(name) {
    await page.waitForTimeout(120);
    const s = await read();
    await page.screenshot({ path: resolve(out, name + '.png') });
    writeFileSync(resolve(out, name + '.json'), JSON.stringify(s, null, 2));
    captures.push({ name, state: s });
    journal.flush();
    console.log(`ok ${name} ${s.prompt ?? ''}`);
    if (
      !s.talk &&
      !s.paused &&
      /^(01-entrance|02-gallery|eye-[1-6]|03-bars-open|fight-[89]-(start|won|after)|04-exit|05-home)$/.test(
        name,
      )
    ) {
      await graphics('low');
      await page.waitForTimeout(250);
      await page.screenshot({ path: resolve(out, name + '-low.png') });
      writeFileSync(resolve(out, name + '-low.json'), JSON.stringify(await read(), null, 2));
      await graphics('high');
    }
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
    const expected = name.startsWith('28-gallery') ? 28 : undefined;
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
        const cleanup = await page.evaluate(() => ({
          heroVisible: window.__game.view.game.actors.get('player')?.visible,
          stage: [...window.__game.view.game.actors.keys()].filter(id => id.startsWith('stage:')),
          busy: window.__game.view.game.player.busy,
        }));
        must(cleanup.heroVisible && !cleanup.stage.length && !cleanup.busy, 'scene actor/control cleanup: '+JSON.stringify(cleanup));
        restoration.push({ name, yaw, restored, cleanup });
        return;
      }
      if (expected) must(!expected || s.talk.scene === expected, 'wrong scene ' + s.talk.scene);
      await settleDialogue(page);
      await page.waitForFunction(
        () => !document.querySelector('.gb-dialogue-untyped')?.textContent,
        {},
        { timeout: 30000 },
      );
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
  const actionCallbacks = new Map();
  async function installDriver() {
    if (!await page.evaluate(() => typeof window.__replayInput === 'function')) {
      const boundPage = page;
      const held = new Set();
      await page.exposeFunction('__replayAction', (kind, target) => actionCallbacks.get(boundPage)[kind](target));
      await page.exposeFunction('__replayInput', async (key, down) => {
        const code = {w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',shift:'ShiftLeft',space:'Space'}[key];
        if (held.has(code) === down) return;
        record({type:down?'down':'up',key:code});
        await boundPage.keyboard[down?'down':'up'](code);
        down ? held.add(code) : held.delete(code);
      });
    }
    await page.evaluate(installReplayDriver, {mode:'realtime'});
  }
  async function targeted(target, reach, callbacks) {
    actionCallbacks.set(page, callbacks);
    try {
      await page.evaluate(async ({target,reach}) => window.__replay.act(target, {
        reach, aim:t=>window.__replayAction('aim',t), press:()=>window.__replayAction('press'), done:()=>window.__replayAction('done')
      }),{target,reach});
    } finally { actionCallbacks.delete(page); }
  }
  async function walk(x, z, near = .3, y, authored = false) {
    const goal = await page.evaluate(({x,z,y}) => ({x,z,y:y ?? window.__game.view.game.world.heightAt(Math.floor(x),Math.floor(z))}), {x,z,y});
    record({type:'walk-goal',goal,near});
    const result = await page.evaluate(async ({goal,near,authored}) => window.__replay.walk(goal,{within:near,authored}),{goal,near,authored});
    must(result.ok,'shared walking failed: '+JSON.stringify(result));
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
    await walk(p.x + dx, p.z + dz, near, p.y);
    return p;
  }
  async function continueSave(name, ...args) {
    return milestone('Continue-'+name,()=>continueSaveInput(name,...args),state=>state.started===true && !state.paused && !state.player.busy);
  }
  async function continueSaveInput(name, home = true) {
    await press('Escape');
    await wait((s) => s.paused, 'normal pause before checkpoint');
    const before = await save(name);
    await collectTransactions();
    await page.reload();
    await page.waitForFunction(() => !!window.__game);
    await observeScenes();
    await startTransactions(
      readFileSync(resolve(out, name + '.save.json'), 'utf8'),
      name + '-continued',
    );
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
    await installDriver();
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
      if (
        /^(shrine\.|choice\.dinner|dinner\.|scene\.|memory\.|vaults\.|keystone\.|job\.)/.test(key)
      )
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
    await installDriver();
    await shot(name + '-continued');
  }
  async function importRaw(raw, label = 'boundary') {
    await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
    await page.evaluate((raw) => localStorage.setItem('greenhollow.save', raw), raw);
    await page.reload();
    await page.waitForFunction(() => !!window.__game);
    await observeScenes();
    await startTransactions(raw, label);
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await wait((s) => s.started && !s.player.busy, 'Continue');
    await installDriver();
  }
  async function branch(raw, name, run) {
    await collectTransactions();
    const main = page,
      mainScope = observationScope;
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
      page = main;
      observationScope = mainScope;
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
        shapes: r.fight.shapes.filter((s) => s.live).map((s) => ({ ...s })),
        stage: { center: r.stage.center, radius: r.stage.radius },
        hero: { ...r.fight.hero },
        aim: { x: r.fight.input.aimX, z: r.fight.input.aimZ },
        companion: { ...r.fight.companion },
        targets: r.fight.targets.map((t) => ({ ...t })),
        beasts: r.fight.beasts.map((b) => ({
          x: b.x,
          z: b.z,
          doing: b.doing,
          guard: b.guard,
          facing: b.facing,
          radius: b.def.radius,
        })),
        keeper: k
          ? {
              body: { ...k.body },
              heart: { ...k.heart },
              parts: k.parts.map((p) => ({ ...p })),
              floods: k.parts.map((_, i) => k.flooded(i)),
              lamps: k.parts.map((_, i) => k.lit(i)),
              record: { ...k.record },
            }
          : null,
        record: { ...r.fight.record },
      };
    });
  async function stepTo(x, z, ms = 120, dodge = false, direct = false) {
    const path = await page.evaluate(
      ([x, z]) => {
        const g = window.__game.view.game;
        return g.systems.nav.path(
          g.player.pos,
          { x, y: g.world.heightAt(Math.floor(x), Math.floor(z)), z },
          3000,
        );
      },
      [x, z],
    );
    record({ type: 'combat-nav-observation', goal: { x, z }, path });
    if (!direct && path?.length > 1) {
      const at = await read();
      const next = path.find((p) => Math.hypot(p.x - at.player.x, p.z - at.player.z) > 0.4);
      if (next) {
        x = next.x;
        z = next.z;
        ms = Math.min(ms, 130);
      }
    }
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
    if (dodge) {
      record({ type: 'press', key: 'ShiftLeft' });
      await page.keyboard.press('ShiftLeft');
    }
    await page.waitForTimeout(ms);
    for (const key of keys) {
      record({ type: 'up', key });
      await page.keyboard.up(key);
    }
  }
  async function attack(x, z, held = 50) {
    const state = await fightRead();
    const move = weaponOf(state.hero.weapon)[held >= 800 ? 'held' : 'quick'];
    const y = await page.evaluate(() => window.__game.view.game.player.pos.y);
    let completed = false;
    await targeted({x,y,z}, move.range || move.reach, {
      aim: async () => { const at=await page.evaluate(pumpAimPoint,[x,z]); must(at,'combat aim visible'); await page.mouse.move(at.x,at.y); },
      press: async () => { await attackInput(x,z,held); completed=true; },
      done: async () => completed && (!(await fightRead()) || (await fightRead()).hero.act === 'none'),
    });
  }
  async function attackInput(x, z, held = 50) {
    const at = await page.evaluate(pumpAimPoint, [x, z]);
    must(at, 'combat aim visible');
    record({ type: 'mouse-attack', x, z, at, held });
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    if (held >= 800)
      await wait(
        () => fightRead().then((s) => !s || s.hero.charged),
        'charged attack via normal held mouse',
        6000,
      );
    else await page.waitForTimeout(held);
    await page.mouse.up();
    if (held >= 800)
      await wait(
        () => fightRead().then((s) => !s || (!s.hero.charged && s.hero.act === 'none')),
        'normal attack recovery',
        6000,
      );
    else await page.waitForTimeout(180);
  }
  async function combat(n) {
    return milestone('fight-'+n,()=>combatInput(n),state=>state.flags['fight.'+n+'.won']===true && !state.player.busy);
  }
  async function combatInput(n) {
    current = 'fight-' + n;
    await wait(() => fightRead().then((s) => s?.n === n), 'fight ' + n);
    await shot(current + '-start');
    let shown = false;
    const began = Date.now();
    while (Date.now() - began < 300000) {
      const s = await fightRead();
      if (!s) {
        const end = await page.evaluate(() => window.__galleryFightEnds?.at(-1));
        requireGalleryWin(end, n);
        break;
      }
      if (Date.now() - (combat.lastLog ?? 0) > 10000) {
        combat.lastLog = Date.now();
        console.log('combat', JSON.stringify(s));
        writeFileSync(resolve(out, 'combat-live.json'), JSON.stringify(s, null, 2));
        await page.screenshot({ path: resolve(out, 'combat-live.png') });
      }
      must(s.n === n, 'wrong fight');
      if (
        s.companion.mode !== 'held' &&
        s.hero.health < 110 &&
        Date.now() - (combat.lastHeal ?? 0) > 14500
      ) {
        combat.lastHeal = Date.now();
        await press('KeyC');
      }
      record({
        type: 'combat-observation',
        n,
        health: s.hero.health,
        beasts: s.beasts,
        companionMode: s.companion.mode,
        keeper: s.keeper,
        hero: s.hero,
        aim: s.aim,
        targets: s.targets,
        shapes: s.shapes,
        record: s.record,
      });
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
      if (n === 8) {
        const b = s.beasts[0];
        const threat = s.shapes.find((t) => !t.grab && t.t < t.lead && galleryThreat(t, s.hero));
        if (threat) {
          const goal = await page.evaluate(
            ({ t, h, center, radius }) => {
              const g = window.__game.view.game;
              let best = null,
                score = -Infinity;
              for (let a = 0; a < 16; a++) {
                const x = h.x + Math.cos((a * Math.PI) / 8) * 3,
                  z = h.z + Math.sin((a * Math.PI) / 8) * 3;
                const stage = g.systems.fights.running().stage;
                if (
                  Math.hypot(x - center.x, z - center.z) > radius - 1 ||
                  Array.from({ length: 16 }, (_, i) =>
                    stage.solid(h.x + ((x - h.x) * (i + 1)) / 16, h.z + ((z - h.z) * (i + 1)) / 16),
                  ).some(Boolean)
                )
                  continue;
                const d =
                  t.kind === 'circle'
                    ? Math.hypot(x - t.x, z - t.z) - t.reach
                    : Math.abs((x - t.x) * Math.cos(t.facing) + (z - t.z) * Math.sin(t.facing)) -
                      t.width / 2;
                if (d > score) {
                  score = d;
                  best = { x, z };
                }
              }
              return best;
            },
            { t: threat, h: s.hero, ...s.stage },
          );
          record({ type: 'read-only-tell-escape', threat, goal });
          if (goal) await stepTo(goal.x, goal.z, 120, false, true);
          continue;
        }
        if (b.doing === 'dizzy') {
          if (Math.hypot(b.x - s.hero.x, b.z - s.hero.z) > HERO.calm.reach - .3) {
            await stepTo(b.x, b.z, 120);
            continue;
          }
          const y=await page.evaluate(()=>window.__game.view.game.player.pos.y);
          await targeted({x:b.x,y,z:b.z},HERO.calm.reach,{
            aim:async()=>{const at=await page.evaluate(pumpAimPoint,[b.x,b.z]);must(at,'calm target visible');await page.mouse.move(at.x,at.y);},
            press:async()=>{record({type:'hold',key:'KeyF',ms:1100});await page.keyboard.down('KeyF');try{await page.waitForTimeout(1100);}finally{await page.keyboard.up('KeyF');}},
            done:async()=>{const now=await fightRead();return !now || now.phase==='won' || now.result==='won';},
          });
          continue;
        }
        if (s.companion.mode === 'held') {
          const v = s.targets.find((t) => t.name === 'vines' && !t.broken);
          if (v) {
            if (Math.hypot(v.x - s.hero.x, v.z - s.hero.z) > 8) await stepTo(v.x, v.z, 120);
            // Quick shots return control before the next rootsnare tell lands.
            else await attack(v.x, v.z, 50);
            continue;
          }
        }
        const d = Math.hypot(b.x - s.hero.x, b.z - s.hero.z);
        if (d > HERO.calm.reach - .5) await stepTo(b.x, b.z, 120);
        else {
          await attack(b.x, b.z, 50);
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
          let i = 0;
          for (let j = 1; j < k.parts.length; j++)
            if (
              Math.hypot(k.parts[j].x - s.hero.x, k.parts[j].z - s.hero.z) <
              Math.hypot(k.parts[i].x - s.hero.x, k.parts[i].z - s.hero.z)
            )
              i = j;
          const g = k.parts[i];
          if (k.lamps[i] <= 1) {
            if (Math.hypot(g.x - s.hero.x, g.z - s.hero.z) > 4) await stepTo(g.x, g.z);
            else await attack(g.x, g.z, 850);
          } else {
            const dx = g.x - b.x,
              dz = g.z - b.z,
              d = Math.hypot(dx, dz);
            await stepTo(g.x + (dx / d) * 2.8, g.z + (dz / d) * 2.8);
          }
        }
      }
    }
    await wait((s) => !!s.flags['fight.' + n + '.won'], 'fight won ' + n, 15000);
    await wait(() => fightRead().then((s) => !s), 'fight releases controls', 15000);
    await shot('fight-' + n + '-after');
    await save('fight-' + n + '-rewards');
  }
  async function equip(id) {
    const slots = await page.evaluate(() => window.__game.view.game.systems.inventory.slots);
    let index = slots.findIndex((s) => s?.id === id);
    must(index >= 0, 'missing earned item ' + id);
    if (index >= 9) {
      await press('KeyI');
      await click(`[data-key="slot:${index}"]`);
      await click('[data-key="slot:8"]');
      await press('Escape');
      index = 8;
    }
    await press('Digit' + (index + 1));
  }
  async function make(id, count = 1, hand = false) {
    if (hand) {
      await press('KeyI');
      await click('[data-key="tab:hand"]');
      await click(`[data-key="recipe:${id}"]`);
    } else {
      const bench = await page.evaluate(() =>
        window.__game.view.game.systems.placeables.all().find((p) => p.kind === 'workbench'),
      );
      must(bench, 'earned workbench');
      await walk(bench.x + 0.5, bench.z + 1.5, 0.15);
      await wait((s) => s.prompt === 'Craft', 'workbench prompt');
      await press('KeyE');
    }
    for (let i = 0; i < count; i++) await click(`[data-key="make:${id}"]`);
    await press('Escape');
  }

  async function usePrompt(text) {
    await wait((s) => s.prompt === text, text);
    const observed=await page.evaluate(()=>{
      const g=window.__game, t=g.view.game.systems.interact.nearest();
      return t ? {id:t.id,target:t.pos(),reach:t.radius,prompt:t.prompt(),room:g.view.game.systems.ruins.view().room}:null;
    });
    must(observed?.prompt===text,'exact interaction target');
    await targeted(observed.target,observed.reach,{
      aim:async target=>{const at=await page.evaluate(t=>window.__game.view.project(t.x,t.y,t.z),target);if(at)await page.mouse.move(at.x,at.y);},
      press:async()=>press('KeyE'),
      done:async()=>{
        const after=await read();
        const room=await page.evaluate(()=>window.__game.view.game.systems.ruins.view().room);
        return !!after.talk || after.prompt!==text || room!==observed.room || (text.includes('seal') && after.prompt===text && !after.player.busy);
      },
    });
  }

  try {
    if (!args.includes('--no-build')) {
      await gate();
      build = spawn(
        'bun',
        ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'],
        { cwd: root, stdio: 'inherit' },
      );
      must(
        (await new Promise((done, fail) => {
          build.once('error', fail);
          build.once('exit', done);
        })) === 0,
        'build failed',
      );
    }
    writeFileSync(
      resolve(out, 'build-hashes.json'),
      JSON.stringify(pumpBuildHashes(resolve(root, dist)), null, 2),
    );
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

    record({ type: 'import-stage-boundary', path: args[saveIndex + 1], sha256: inputHash });
    const routeInput = startingSave ?? (resumePath ? readFileSync(resolve(root, resumePath), 'utf8') : rawInput);
    if (startingSave) writeFileSync(resolve(out, 'resume-boundary.save.json'), startingSave);
    if (resumePath)
      record({
        type: 'earned-checkpoint-import',
        path: resumePath,
        sha256: createHash('sha256').update(routeInput).digest('hex'),
        originalInputHash: inputHash,
      });
    await importRaw(routeInput);
    const initial = JSON.parse(rawInput);
    must(initial.game.systems.quests.quests.uphill.state === 'done', 'accepted uphill done');
    await shot('00-boundary');
    if (args.includes('--probe')) {
      const probe = await page.evaluate(() => {
        const g = window.__game.view.game,
          rows = [];
        for (let z = -390; z <= -290; z += 2) {
          const row = [];
          for (let x = 200; x <= 280; x += 2) row.push(g.world.heightAt(x, z));
          rows.push(row);
        }
        const at = g.systems.region.place('lampgallery').at;
        return {
          rows,
          at,
          hero: g.player.pos,
          path: g.systems.nav.path(g.player.pos, at, 100000),
          near: g.systems.nav.near(at, 10),
        };
      });
      writeFileSync(resolve(out, 'terrain-probe.json'), JSON.stringify(probe));
      throw Error('diagnostic read-only probe complete');
    }
    if (!resumePath) {
      current = 'lamp';
      await make('lamp');
      await save('lamp-crafted');
      current = 'rootsnare-approach';
      await goPlace('caves', 0, 4, 0.5);
      await continueSave('rootsnare-ready', false);
    }
    if (!(await read()).flags['fight.8.won']) await combat(8);
    if (!args.includes('--at-memory')) {
      current = 'gallery-approach';
      if (!args.includes('--at-gallery')) {
        const path = JSON.parse(
          readFileSync(resolve(root, 'tools/lib/gallery-caves-route.json'), 'utf8'),
        );
        record({
          type: 'read-only-route-reference',
          path: 'tools/lib/gallery-caves-route.json',
          source: '.artifacts/gallery-input/nav-diagnostic.json',
        });
        await walkGalleryRoute(path,walk);
      }
      await goPlace('lampgallery', 0, 0, 4);
      await shot('01-entrance');
      await milestone('enter-gallery',()=>usePrompt('Go into the Lamp Gallery'),async()=>page.evaluate(()=>window.__game.view.game.systems.ruins.view().room==='gallery'));
      await shot('02-gallery');
      const eyes = [29, 27, 25, 23, 21, 19];
      for (let i = 0; i < eyes.length; i++) {
        current = 'eye-' + (i + 1);
        await milestone('light-eye-'+(i+1),async()=>{
        await walk(-448 + (i % 2 === 0 ? 2.7 : 13.3), 2400 + eyes[i], 0.3);
        await wait(
          () =>
            page.evaluate((i) => window.__game.view.game.systems.ruins.view().eyes === i + 1, i),
          'eye ' + (i + 1),
        );
        await shot('eye-' + (i + 1));
        },async()=>page.evaluate(i=>window.__game.view.game.systems.ruins.view().eyes===i+1,i));
        if (i === 2) await continueSave('middle-eyes', false);
      }
      await walk(-440, 2418.5, 0.3);
      await save('pre-keeper');
      await shot('03-bars-open');
      await walk(-440, 2416, 0.3);
      await combat(9);
      await save('repeat-keeper-before');
      for (let i = eyes.length - 1; i >= 0; i--)
        await walk(-448 + (i % 2 === 0 ? 2.7 : 13.3), 2400 + eyes[i], 0.3);
      must(
        await page.evaluate(() => window.__game.view.game.systems.ruins.view().eyes === 6),
        'repeated eyes stay lit',
      );
      await walk(-440, 2416, 0.3);
      must(!(await fightRead()), 'keeper does not repeat');
      await save('repeat-keeper-after');
    }
    await walk(-441.5, 2401.6, 0.3);
    await milestone('earn-keystone-2',async()=>{if (!(await read()).flags['keystone.2']) await usePrompt('Take the keystone');},state=>state.flags['keystone.2']===true && !state.flags['scene.28']);
    const key = await save('keystone-earned');
    must(
      Object.fromEntries(key.game.flags)['keystone.2'] &&
        !Object.fromEntries(key.game.flags)['scene.28'],
      'keystone before memory',
    );
    await walk(-438.5, 2403.3, 0.1);
    await milestone('memory-28',async()=>{await usePrompt('Touch the stone');await dialogue('28-gallery');},state=>state.flags['scene.28']===true && !state.talk && !state.player.busy);
    await save('memory-earned');
    await branch(readFileSync(resolve(out, 'keystone-earned.save.json'), 'utf8'), 'memory-low', async () => {
      await graphics('low');
      await walk(-438.5, 2403.3, .1);
      await usePrompt('Touch the stone');
      await dialogue('28-gallery-low');
      await save('memory-low-earned');
    });
    const before = await save('repeat-before');
    await walk(-441.5, 2401.6, 0.3);
    must((await read()).prompt !== 'Take the keystone', 'no repeated key');
    await press('KeyE');
    await walk(-438.5, 2403.3, 0.1);
    await graphics('low');
    await usePrompt('Touch the stone again');
    await dialogue('memory-repeat');
    await graphics('high');
    const after = await save('repeat-after');
    must(
      JSON.stringify(before.game.systems.inventory) ===
        JSON.stringify(after.game.systems.inventory),
      'no duplicate inventory rewards',
    );
    await walk(-440, 2430.9, 0.3);
    await press('Escape');
    await save('pre-calla');
    await press('Escape');
    await usePrompt('Go out of the gallery');
    await shot('04-exit');
    must(!(await read()).talk, 'Calla already seen; no repeated scene 25');
    await save('exit-earned');
    await usePrompt("Calla's seal is on the arch");
    await save('repeat-exit');
    current = 'home';
    await milestone('return-home',async()=>{
    await walkGalleryRoute(JSON.parse(readFileSync(resolve(root, 'tools/lib/gallery-caves-route.json'),'utf8')).reverse(),walk);
    await goPlace('grant.center');
    },async state=>{const at=await page.evaluate(()=>window.__game.view.game.systems.region.place('grant.center').at);return Math.hypot(state.player.x-at.x,state.player.z-at.z)<1.1 && state.flags['quest.gallery.done']===true;});
    await continueSave('final-home');
    const final = await save('earned-gallery');
    await shot('05-home');
    const flags = Object.fromEntries(final.game.flags);
    must(flags['keystone.1'] && flags['keystone.2'] && !flags['keystone.3'], 'only first two keys');
    must(
      flags['quest.gallery.done'] && !flags['quest.seeds.done'] && !flags['quest.lights.done'],
      'bounded quest finish',
    );
    must(!errors.length, errors.join('\n'));
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
    await stopPumpChild(build).catch((error) => {
      failure ??= 'build cleanup: ' + String(error);
    });
    try {
      await browser?.close();
    } catch (error) {
      failure ??= 'browser cleanup: ' + String(error);
    }
    await stopPumpChild(server).catch((error) => {
      failure ??= 'server cleanup: ' + String(error);
    });
    journal.flush();
    clearTimeout(emergencyExit);
    process.removeListener('SIGTERM', onTerm);
    process.removeListener('SIGINT', onInt);
  }
  const verdict = (routeComplete && !failure ? journal.complete() : journal.flush()).status;
  console.log(verdict === 'PASS' ? 'PASS Gallery' : 'BLOCKED');
  if (run && verdict !== 'PASS') throw Error(failure ?? 'Gallery replay incomplete');
  if (run) return {out, final: JSON.parse(readFileSync(resolve(out, 'earned-gallery.save.json'), 'utf8'))};
  process.exitCode = journal.interrupted
    ? journal.interrupted === 'SIGINT'
      ? 130
      : 143
    : verdict === 'PASS'
      ? 0
      : 1;
}

if (import.meta.main) await playGallery();

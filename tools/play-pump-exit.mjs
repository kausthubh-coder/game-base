// Focused real raw-checkpoint replay. No scene/position/flag mutation.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { launchChrome } from './lib/chrome.mjs';
import { firstnightFrame, firstnightIssues, settleDialogue } from './lib/firstnight-framing.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';
import { pumpBuildHashes, stopPumpChild } from './play-pump.mjs';
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i < 0 ? d : process.argv[i + 1];
};
const out = resolve(arg('--out')),
  dist = arg('--dist', 'dist-pump-exit'),
  quality = arg('--quality', 'high');
if (existsSync(out)) throw Error('out must be new');
mkdirSync(out, { recursive: true });
const raw = readFileSync('.artifacts/pump-input/attempt-11/pre-calla.save.json', 'utf8');
const hash = createHash('sha256').update(raw).digest('hex');
if (hash !== 'b0605b4257ed43df95c13dad746d59d8be79a5382afb220d5d2fba902147b06d')
  throw Error('raw hash');
const report = {
  source: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
  runnerHash: createHash('sha256')
    .update(readFileSync(import.meta.filename))
    .digest('hex'),
  hash,
  dist,
  quality,
  errors: [],
  runs: [],
  resources: [],
  status: 'BLOCKED',
};
const flush = () => writeFileSync(resolve(out, 'replay.json'), JSON.stringify(report, null, 2));
let server, browser;
const timer = setInterval(async () => {
  report.resources.push(await sample());
  flush();
  console.log('resource sampled');
}, 30000);
try {
  report.buildHashes = pumpBuildHashes(resolve(dist));
  if (
    dist === 'dist-pump-audited-audio' &&
    JSON.stringify(report.buildHashes) !==
      JSON.stringify(JSON.parse(readFileSync('.artifacts/pump-input/attempt-11/build-hashes.json')))
  )
    throw Error('old build mismatch');
  const s = await sample();
  report.resources.push(s);
  if (!canStartHeavy(s, 0)) throw Error('resource gate');
  server = spawn('bun', ['tools/serve.mjs', dist, '5573'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((done, fail) => {
    server.stdout.on('data', (b) => {
      console.log(String(b));
      if (/pid \d+/.test(String(b))) done();
    });
    server.on('exit', fail);
  });
  browser = await launchChrome();
  for (const choice of ['kept', 'shown']) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } }),
      page = await context.newPage();
    page.on('console', (m) => {
      if (['warning', 'error'].includes(m.type())) report.errors.push(m.text());
    });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    const run = { choice, frames: [], issues: [] };
    report.runs.push(run);
    const read = () => page.evaluate(() => window.__game.state());
    const observe = () =>
      page.evaluate(() => {
        const g = window.__game.view.game;
        return [...g.actors.values()]
          .filter((a) => a.visible && (a.id === 'player' || a.id === 'stage:calla'))
          .map((a) => ({
            id: a.id,
            pos: { ...a.pos },
            height: g.world.heightAt(Math.floor(a.pos.x), Math.floor(a.pos.z)),
            drawnGround: window.__game.view.groundAt(a.pos.x, a.pos.z),
            drawnY:
              a.pos.y +
              (a.id === 'player' ? 0 : window.__game.view.liftOnLand(a.pos.x, a.pos.y, a.pos.z)),
            swimming: a.id === 'player' && window.__game.view.hero.body.swimming,
            surface: g.world.surfaceAt(Math.floor(a.pos.x), Math.floor(a.pos.z)),
          }));
      });
    const save = async (name) => {
      await page.evaluate(() => window.__game.save());
      const v = await page.evaluate(() => localStorage.getItem('greenhollow.save'));
      writeFileSync(resolve(out, choice + '-' + name + '.save.json'), v);
      return JSON.parse(v);
    };
    await page.goto('http://127.0.0.1:5573/?seed=41&quality=' + quality);
    await page.evaluate((raw) => localStorage.setItem('greenhollow.save', raw), raw);
    await page.reload();
    await page.waitForFunction(() => !!window.__game);
    await page.getByRole('button', { name: 'Begin', exact: true }).click();
    await page.waitForFunction(
      () => window.__game.state().started && !window.__game.state().player.busy,
    );
    run.before = await save('before');
    run.yaw = await page.evaluate(() => window.__game.view.camera.yaw);
    await page.waitForFunction(() => window.__game.state().prompt === 'Go out to the river');
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => !!window.__game.view.game.systems.talk.current());
    for (let i = 0; i < 25; i++) {
      if (!(await read()).talk) break;
      await settleDialogue(page);
      await page.waitForFunction(
        () => !document.querySelector('.gb-dialogue-untyped')?.textContent,
        {},
        { timeout: 30000 },
      );
      const frame = await firstnightFrame(page),
        terrain = await observe();
      const issues = firstnightIssues(frame);
      const health = await read();
      if (health.viewErrors.length || Object.keys(health.failed).length)
        issues.push(
          'view failure ' +
            JSON.stringify({ viewErrors: health.viewErrors, failed: health.failed }),
        );
      for (const a of terrain)
        if (
          a.surface === 'water' ||
          a.swimming ||
          !Number.isFinite(a.drawnGround) ||
          Math.abs(a.drawnY - a.drawnGround) > 0.12
        )
          issues.push(a.id + ': not grounded dry: ' + JSON.stringify(a));
      run.frames.push({ frame, terrain, issues });
      run.issues.push(...issues);
      flush();
      await page.screenshot({ path: resolve(out, choice + '-line-' + i + '.png') });
      const talk = (await read()).talk;
      await page.keyboard.press(
        talk.choices?.length ? (choice === 'kept' ? 'Digit2' : 'Digit1') : 'KeyE',
      );
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(1000);
    run.after = await save('after');
    run.state = await read();
    run.terrainAfter = await observe();
    run.yawAfter = await page.evaluate(() => window.__game.view.camera.yaw);
    await page.screenshot({ path: resolve(out, choice + '-after.png') });
    const before = JSON.parse(raw).game,
      after = run.after.game,
      bf = Object.fromEntries(before.flags),
      af = Object.fromEntries(after.flags);
    const same = (a, b, label) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) run.issues.push(label);
    };
    for (const key of ['inventory', 'bench', 'placeables', 'ruins']) {
      if (key !== 'ruins') same(before.systems[key], after.systems[key], 'preserved ' + key);
    }
    same(
      before.systems.pets.pets.map(({ id, trust, bonded, bed }) => ({ id, trust, bonded, bed })),
      after.systems.pets.pets.map(({ id, trust, bonded, bed }) => ({ id, trust, bonded, bed })),
      'pet identity/bond',
    );
    const allowed = new Set([
      'quest.pump.done',
      'quest.pump.step',
      'vault.pumphouse.cleared',
      'vault.pumphouse.sealed',
      'choice.calla',
      'scene.25',
      'story.seen.scene.25',
      'quest.uphill.started',
      'quest.uphill.done',
      'quest.uphill.step',
    ]);
    for (const key of new Set([...Object.keys(bf), ...Object.keys(af)]))
      if (!allowed.has(key)) same(bf[key], af[key], 'unexpected flag ' + key);
    if (
      af['choice.calla'] !== choice ||
      !af['scene.25'] ||
      !af['vault.pumphouse.sealed'] ||
      !af['quest.pump.done']
    )
      run.issues.push('authored effects missing');
    if (
      await page.evaluate(() =>
        [...window.__game.view.game.actors.keys()].some((id) => id.startsWith('stage:')),
      )
    )
      run.issues.push('temporary actors remain');
    for (const a of run.terrainAfter)
      if (
        a.surface === 'water' ||
        a.swimming ||
        !Number.isFinite(a.drawnGround) ||
        Math.abs(a.drawnY - a.drawnGround) > 0.12
      )
        run.issues.push('wet return');
    if (run.state.prompt !== "Calla's seal is on the door") run.issues.push('seal not reachable');
    else {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(150);
      const repeat = await save('repeat-seal');
      same(after.systems.inventory, repeat.game.systems.inventory, 'duplicate seal reward');
      same(af.hearts, Object.fromEntries(repeat.game.flags).hearts, 'duplicate hearts');
    }

    if (run.state.talk || run.state.player.busy) run.issues.push('controls busy');
    if (Math.abs(run.yaw - run.yawAfter) > 0.001) run.issues.push('yaw not restored');
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyS');
    run.walked = await read();
    run.walkTerrain = await observe();
    if (
      Math.hypot(
        run.walked.player.x - run.state.player.x,
        run.walked.player.z - run.state.player.z,
      ) < 0.5
    )
      run.issues.push('cannot walk away');
    for (const a of run.walkTerrain)
      if (
        a.surface === 'water' ||
        a.swimming ||
        !Number.isFinite(a.drawnGround) ||
        Math.abs(a.drawnY - a.drawnGround) > 0.12
      )
        run.issues.push('wet walk away');
    await page.screenshot({ path: resolve(out, choice + '-walk.png') });
    await context.close();
    flush();
  }
  if (report.errors.length || report.runs.some((r) => r.issues.length))
    throw Error('staging/console assertions failed');
  report.status = 'PASS';
} catch (e) {
  report.failure = String(e);
  process.exitCode = 1;
} finally {
  clearInterval(timer);
  await browser?.close();
  await stopPumpChild(server);
  flush();
  console.log(report.status, report.failure ?? '');
}

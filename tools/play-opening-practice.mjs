// Diagnostic rack starts, real selection and combat inputs. This is not an earned chapter replay.
// bun tools/play-opening-practice.mjs --dist <immutable-build> --runtime-manifest <json> --out <empty-dir> [--port 5837] [--views desktop,phone] [--weapons sword,bow,staff] [--quality high]
import { spawn, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { fileEvidence, runnerDependencies, verifyRuntime } from './lib/beta-chain.mjs';
import { firstnightFrame } from './lib/firstnight-framing.mjs';
import { openingFrame } from './lib/grantday-framing.mjs';
import { costIssues, storyCosts } from './lib/story-cost-probe.mjs';
import { canStartHeavy, sample } from './resource-status.mjs';
import { weaponOf } from '../src/game/content/fight.ts';
import { splitCues } from '../src/game/talk/cues.sim.ts';

const root = resolve(import.meta.dirname, '..');
const must = (ok, why) => { if (!ok) throw Error(why); };
const viewports = { desktop: { width: 1366, height: 768 }, phone: { width: 390, height: 844 } };

export function options(args) {
  const switches = ['--views', '--weapons', '--quality', '--dist', '--runtime-manifest', '--out', '--port', '--active-heavy'];
  for (let i = 0; i < args.length; i += 2) {
    must(switches.includes(args[i]), 'unknown option: ' + args[i]);
    must(args[i + 1] && !args[i + 1].startsWith('--'), args[i] + ' needs a value');
    must(args.indexOf(args[i]) === i, 'duplicate option: ' + args[i]);
  }
  const option = (name, fallback) => {
    const i = args.indexOf('--' + name);
    if (i < 0) return fallback;
    must(args[i + 1] && !args[i + 1].startsWith('--'), '--' + name + ' needs a value');
    return args[i + 1];
  };
  const views = option('views', 'desktop,phone').split(',');
  const weapons = option('weapons', 'sword,bow,staff').split(',');
  const quality = option('quality', 'high');
  must(views.length && views.every(v => v in viewports) && new Set(views).size === views.length, 'invalid --views');
  must(weapons.length && weapons.every(v => ['sword', 'bow', 'staff'].includes(v)) && new Set(weapons).size === weapons.length, 'invalid --weapons');
  must(['high', 'low'].includes(quality), 'invalid --quality');
  const dist = option('dist'), manifest = option('runtime-manifest'), out = option('out');
  must(dist && manifest && out, '--dist, --runtime-manifest and --out are required; this tool never builds');
  const port = Number(option('port', '5837')), active = Number(option('active-heavy', '0'));
  must(Number.isInteger(port) && port >= 5400 && port <= 5999 && port !== 5796, 'invalid or protected port');
  must([0, 1].includes(active), 'invalid --active-heavy');
  return { views, weapons, quality, port, active, dist: resolve(root, dist), manifest: resolve(root, manifest), out: resolve(root, out) };
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Diagnostic opening practice, no build or earned claim. Required: --dist DIR --runtime-manifest FILE --out EMPTYDIR. Optional: --views desktop,phone --weapons sword,bow,staff --quality high|low --port 5837 --active-heavy 0|1.');
    return;
  }
  const opt = options(args);
  must(!existsSync(opt.out) || !readdirSync(opt.out).length, 'choose an empty --out to preserve evidence');
  mkdirSync(opt.out, { recursive: true });
  writeFileSync(resolve(opt.out, 'tested-runner.mjs'), readFileSync(import.meta.filename));
  const runtime = verifyRuntime(opt.dist, opt.manifest, root);
  const report = {
    status: 'RUNNING', earned: false, scope: 'Diagnostic opening=rack starts; actual rack UI, combat inputs and Continue. Not an earned chain.',
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    runtime: fileEvidence(opt.manifest), runtimeSource: runtime.source, runner: fileEvidence(import.meta.filename), dependencies: runnerDependencies(import.meta.filename),
    options: opt, renderer: null, inputs: [], cases: [], failure: null, ownerPID: process.pid,
  };
  const write = (name, value) => writeFileSync(resolve(opt.out, name), JSON.stringify(value, null, 2));
  let browser, server, page, context, monitor, monitoring = Promise.resolve(), stage = 'admission', caseDir;
  let errors = [], events = [], steps = [];
  const input = event => report.inputs.push({ stage, at: new Date().toISOString(), ...event });
  const resource = async () => {
    const status = await sample();
    appendFileSync(resolve(opt.out, 'resources.jsonl'), JSON.stringify(status) + '\n');
    return status;
  };
  const read = () => page.evaluate(() => {
    const g = window.__game, v = g.view, o = v.game.systems.opening, p = o.practice(), f = p?.fight;
    return { ...g.state(), gear: { ...v.game.systems.bench.gear() }, opening: { bout: o.bout(), stage: o.stage() },
      fight: window.__fights?.state() ?? null,
      weaponState: f ? { act: f.hero.act, charge: f.hero.charge, charged: f.hero.charged, stamina: f.hero.stamina, record: { ...f.record } } : null,
      ordinaryHeroVisible: v.hero.actor.visible, useClaimed: v.claimed('use'),
      kit: f?.kitSlots() ?? null, talkLine: v.game.systems.talk.current(),
    };
  });
  const check = s => {
    must(!errors.length, errors.join('\n'));
    must(!s.viewErrors.length && !Object.keys(s.failed).length, JSON.stringify({ viewErrors: s.viewErrors, failed: s.failed }));
  };
  async function wait(predicate, why, timeout = 12000) {
    const until = Date.now() + timeout;
    let s;
    while (Date.now() < until) {
      s = await read(); check(s);
      if (predicate(s)) return s;
      await page.waitForTimeout(30);
    }
    writeFileSync(resolve(caseDir, 'wait-failed.json'), JSON.stringify({ why, state: s }, null, 2));
    throw Error('timed out: ' + why);
  }
  async function cameraSettled() {
    await page.evaluate(() => new Promise((done, fail) => {
      const deadline = performance.now() + 8000;
      let previous, stable = 0;
      function frame() {
        const c = window.__game.view.ctx.camera, next = [...c.matrixWorld.elements, ...c.projectionMatrix.elements];
        stable = previous && next.every((v, i) => Math.abs(v - previous[i]) < .00001) ? stable + 1 : 0;
        previous = next;
        if (stable >= 4) done();
        else if (performance.now() > deadline) fail(Error('camera did not settle before targeting'));
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }));
  }
  async function press(key) { input({ type: 'key', key }); await page.keyboard.press(key); }
  async function activate(locator, touch) {
    input({ type: touch ? 'touch-tap' : 'click', selector: locator.toString() });
    if (touch) await locator.tap(); else await locator.click();
  }
  async function attachEvents() {
    await page.exposeFunction('openingPracticeEvent', e => events.push(e)).catch(e => { if (!String(e).includes('already')) throw e; });
    await page.evaluate(() => {
      for (const name of ['scene.played', 'fight.ended', 'item.gained']) window.__game.view.game.events.on(name, data => window.openingPracticeEvent({ name, data }));
    });
  }
  async function reveal() {
    const current = (await read()).talkLine;
    if (!current) return;
    const text = splitCues(current.text).shown;
    if (!await page.evaluate(text => [...document.querySelectorAll('.gb-dialogue-typed')].some(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.textContent === text), text)) await press('KeyE');
    await page.waitForFunction(text => [...document.querySelectorAll('.gb-dialogue-typed')].some(el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.textContent === text), text, { timeout: 12000 });
  }
  async function endDialogue() {
    for (let i = 0; i < 12; i++) {
      const s = await read();
      if (!s.talkLine) return;
      must(!s.talkLine.choices.length, 'unexpected choice after rack');
      await reveal();
      const text = (await read()).talkLine.text;
      await press('KeyE');
      await wait(s => !s.talkLine || s.talkLine.text !== text, 'dialogue input advances');
    }
    throw Error('dialogue did not finish');
  }
  async function capture(name, { bodies = true, dax = true, costs = true } = {}) {
    const before = await read(); check(before);
    await page.screenshot({ path: resolve(caseDir, name + '.png') });
    const frame = { opening: await openingFrame(page), bodies: await firstnightFrame(page) };
    const problems = [];
    if (bodies) {
      const hero = frame.bodies.actors.find(a => a.id === 'player');
      if (!hero?.inFrame) problems.push('hero body cropped');
      if (dax && !frame.opening.actors.some(a => ['saltgate:dax', 'stage:dax'].includes(a.id) && a.inFrame)) problems.push('Dax body cropped');
    }
    const budget = costs ? await storyCosts(page) : null;
    const after = await read(); check(after);
    if (budget && costIssues(budget, opt.quality).length) problems.push('draw budget exceeded');
    const record = { name, before, after, frame, costs: budget, problems, scope: { bodies, dax, costs },
      costWindowCrossedState: before.opening.bout.guard !== after.opening.bout.guard || before.talkLine?.text !== after.talkLine?.text };
    writeFileSync(resolve(caseDir, name + '.json'), JSON.stringify(record, null, 2));
    steps.push({ name, image: fileEvidence(resolve(caseDir, name + '.png')), raw: fileEvidence(resolve(caseDir, name + '.json')) });
    must(!problems.length, name + ': ' + problems.join('; '));
    console.log('captured', stage, name);
  }
  async function walk(goal, near = .65) {
    input({ type: 'diagnostic-keyboard-walk', goal, near });
    const path = await page.evaluate(goal => {
      const v = window.__game.view, p = v.game.player.pos;
      return v.game.systems.nav.path(p, { ...goal, y: v.game.world.heightAt(Math.floor(goal.x), Math.floor(goal.z)) }, 6000);
    }, goal);
    must(path?.length, 'no normal walk route to ' + JSON.stringify(goal));
    const held = new Set();
    let at = 0, last, stuck = 0;
    const until = Date.now() + 30000;
    try {
      while (Date.now() < until) {
        const s = await read(); check(s);
        must(!s.player.busy && !s.talkLine, 'walk blocked by dialogue/panel');
        const p = s.player;
        if (Math.hypot(p.x - goal.x, p.z - goal.z) < near) return;
        while (at < path.length - 1 && Math.hypot(p.x - path[at].x, p.z - path[at].z) < .65) at++;
        const t = at === path.length - 1 ? goal : path[at];
        const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
        const dx = t.x - p.x, dz = t.z - p.z, len = Math.hypot(dx, dz) || 1;
        const forward = (-dx * Math.sin(yaw) - dz * Math.cos(yaw)) / len, right = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len;
        const wanted = new Set([...(forward > .35 ? ['KeyW'] : forward < -.35 ? ['KeyS'] : []), ...(right > .35 ? ['KeyD'] : right < -.35 ? ['KeyA'] : [])]);
        for (const key of held) if (!wanted.has(key)) { await page.keyboard.up(key); held.delete(key); }
        for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
        if (last && Math.hypot(p.x - last.x, p.z - last.z) < .02) stuck++; else stuck = 0;
        must(stuck < 25, 'walking stuck at ' + JSON.stringify(p));
        last = p;
        await page.waitForTimeout(60);
      }
      throw Error('walk deadline exceeded');
    } finally { for (const key of held) await page.keyboard.up(key); }
  }
  async function aim(touch, cdp, away = false) {
    const point = await page.evaluate(away => {
      const v = window.__game.view, t = v.game.systems.opening.practice()?.fight.targets[0];
      if (!t) return null;
      const p = v.game.player.pos, d = Math.hypot(t.x - p.x, t.z - p.z) || 1, length = Math.min(2, d) * (away ? -1 : 1);
      const world = { x: p.x + (t.x - p.x) / d * length, y: p.y, z: p.z + (t.z - p.z) / d * length };
      const screen = v.project(world.x, world.y, world.z);
      return screen ? { screen, world, target: { x: t.x, z: t.z }, distance: d, hit: document.elementFromPoint(screen.x, screen.y)?.tagName } : null;
    }, away);
    must(point?.hit === 'CANVAS', 'aim is outside the canvas or behind UI: ' + JSON.stringify(point));
    input({ type: touch ? 'touch-aim' : 'pointer-aim', ...point, away });
    if (touch) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.screen.x, y: point.screen.y, id: 0 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await page.mouse.move(point.screen.x, point.screen.y);
    await page.waitForFunction(world => {
      const f = window.__game.view.game.systems.opening.practice()?.fight;
      return f && Math.hypot(f.input.aimX - world.x, f.input.aimZ - world.z) < .15;
    }, point.world, { timeout: 2500 });
  }
  async function attack(touch, cdp, away = false, hold = false) {
    await cameraSettled();
    await aim(touch, cdp, away);
    if (touch) {
      const rect = await page.locator('[data-touch="use"]').boundingBox();
      must(rect, 'touch Use missing');
      input({ type: 'touch-start-use', hold });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, id: 1 }] });
    } else { input({ type: 'mouse-down', hold }); await page.mouse.down(); }
    if (!hold) {
      await page.waitForTimeout(60);
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
      input({ type: touch ? 'touch-end-use' : 'mouse-up' });
    }
  }
  async function save(name) {
    input({ type: 'public-save', method: '__game.save', earned: false });
    must(await page.evaluate(() => window.__game.save()), 'public save failed');
    const raw = await page.evaluate(() => localStorage.getItem('greenhollow.save'));
    must(raw, 'raw save missing');
    writeFileSync(resolve(caseDir, name + '.save.json'), raw);
    return fileEvidence(resolve(caseDir, name + '.save.json'));
  }
  async function continueGame(touch) {
    input({ type: 'reload' });
    await page.reload();
    await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
    await attachEvents();
    await page.getByText('Carries on from your save.', { exact: true }).waitFor();
    await activate(page.getByRole('button', { name: 'Begin', exact: true }), touch);
  }
  async function bag(touch, weapon, suffix) {
    if (touch) await activate(page.locator('[data-touch="bag"]'), true); else await press('KeyI');
    const row = page.locator('[data-key="equipped-weapon"]');
    await row.waitFor({ state: 'visible' });
    must((await row.innerText()).includes('Guild ' + weapon), 'Bag equipped weapon is wrong');
    const rect = await row.boundingBox(), viewport = page.viewportSize();
    must(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, 'Bag equipment row cropped');
    await capture('bag-' + suffix, { bodies: false, costs: false });
    if (touch) await activate(page.getByRole('button', { name: 'Close', exact: true }), true); else await press('Escape');
    await wait(s => !s.player.busy && s.fight?.practice, 'Bag closes back to practice');
  }

  const interrupted = signal => {
    report.interrupted = signal;
    void browser?.close().catch(() => {});
    if (server?.exitCode === null) server.kill('SIGTERM');
  };
  const onInterrupt = () => interrupted('SIGINT'), onTerminate = () => interrupted('SIGTERM');
  process.once('SIGINT', onInterrupt); process.once('SIGTERM', onTerminate);
  try {
    const admission = await resource();
    must(!report.interrupted, 'interrupted before browser launch');
    must(canStartHeavy(admission, opt.active), 'fresh resource admission denied');
    server = spawn('bun', ['tools/serve.mjs', opt.dist, String(opt.port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    report.serverPID = await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(Error('server did not answer within 12s')), 12000);
      let text = '';
      server.stdout.on('data', chunk => { text += chunk; const match = /pid (\d+)/.exec(text); if (match) { clearTimeout(timer); done(Number(match[1])); } });
      server.on('exit', code => { clearTimeout(timer); fail(Error('owned server exited ' + code)); });
    });
    browser = await launchChrome();
    report.renderer = browser.gameRenderer;
    monitor = setInterval(() => { monitoring = monitoring.then(resource).catch(e => { report.resourceError = String(e); }); }, 30000);
    for (const view of opt.views) for (const weapon of opt.weapons) {
      stage = view + '-' + weapon;
      caseDir = resolve(opt.out, stage); mkdirSync(caseDir);
      errors = []; events = []; steps = [];
      const touch = view === 'phone';
      context = await browser.newContext({ viewport: viewports[view], hasTouch: touch, isMobile: touch });
      page = await context.newPage();
      const cdp = touch ? await context.newCDPSession(page) : null;
      page.on('pageerror', e => errors.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      input({ type: 'diagnostic-start', url: `/?opening=rack&seed=41&quality=${opt.quality}`, viewport: viewports[view], hasTouch: touch });
      await page.goto(`http://127.0.0.1:${opt.port}/?opening=rack&seed=41&quality=${opt.quality}`);
      await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
      must(await page.evaluate(() => localStorage.getItem('greenhollow.save') === null), 'fresh diagnostic context had a save');
      await attachEvents();
      await activate(page.getByRole('button', { name: 'Begin', exact: true }), touch);
      await wait(s => s.started && (s.prompt === 'Take a weapon from the rack' || s.talkLine?.choices.length), 'rack prompt');
      if (!(await read()).talkLine) await press('KeyE');
      // The choice button's accessible name also includes its key hint.
      await activate(page.getByRole('button', { name: new RegExp('Take the ' + weapon + '$') }), touch);
      await endDialogue();
      await wait(s => s.fight?.practice && s.fight.hero.weapon === weapon && !s.player.busy, 'chosen practice weapon');
      if (touch) {
        must(!await page.locator('[data-touch="skill"]').isVisible() && !await page.locator('[data-touch="calm"]').isVisible(), 'practice exposes Skill or Calm');
        must(await page.locator('[data-touch="dodge"]').isVisible() && await page.locator('[data-touch="use"]').isVisible(), 'phone combat controls absent');
      }
      await bag(touch, weapon, 'chosen');
      const target = (await read()).fight.targets[0], near = { x: target.x, z: target.z + 1.6 };
      await walk(near);
      await cameraSettled();
      await capture('practice-entry');
      await attack(touch, cdp, true);
      await page.waitForTimeout(900);
      must((await read()).opening.bout.guard === 3, 'wrong aim took guard');
      await capture('wrong-aim');
      // A fixed 22-block walk leaves this 18-block arena. Find a clear, reachable
      // firing line beyond this weapon's quick range, using read-only world queries.
      const quick = weaponOf(weapon).quick, outsideDistance = Math.max(quick.range, quick.reach) + 2;
      const outside = await page.evaluate(({ target, distance }) => {
        const v = window.__game.view, run = v.game.systems.opening.practice(), p = v.game.player.pos;
        const candidates = [];
        for (let i = 0; i < 32; i++) {
          const angle = i * Math.PI / 16, x = target.x + Math.sin(angle) * distance, z = target.z + Math.cos(angle) * distance;
          if (!run.stage.inside(x, z) || run.stage.solid(x, z)) continue;
          let clear = true;
          for (let step = 1; step <= Math.ceil(distance * 4); step++) {
            const t = step / Math.ceil(distance * 4);
            if (run.stage.solid(target.x + (x - target.x) * t, target.z + (z - target.z) * t)) { clear = false; break; }
          }
          if (!clear) continue;
          const goal = { x, y: v.game.world.heightAt(Math.floor(x), Math.floor(z)), z };
          const path = v.game.systems.nav.path(p, goal, 6000);
          if (path?.length) candidates.push({ goal, length: path.length });
        }
        candidates.sort((a, b) => a.length - b.length);
        return candidates[0]?.goal;
      }, { target, distance: outsideDistance });
      must(outside, 'no clear reachable out-of-range position');
      await walk(outside, .3);
      const outsideState = await read();
      must(Math.hypot(outsideState.player.x - target.x, outsideState.player.z - target.z) > Math.max(quick.range, quick.reach) + 1, 'outside-range walk ended in weapon range');
      await attack(touch, cdp);
      await page.waitForTimeout(1100);
      must((await read()).opening.bout.guard === 3, 'out-of-range attack took guard');
      await capture('outside-range', { dax: false });
      await walk(near);
      await attack(touch, cdp);
      await wait(s => s.opening.bout.guard === 2, 'real quick hit');
      await capture('quick-hit');
      const before = await read(), checkpoint = await save('mid-practice');
      await continueGame(touch);
      const continued = await wait(s => s.started && s.fight?.practice && !s.player.busy, 'Continue practice');
      must(continued.opening.bout.guard === 2 && continued.gear.weapon === weapon && !continued.flags['scene.4'], 'Continue lost weapon/guard or completed scene early');
      must(JSON.stringify(before.bag) === JSON.stringify(continued.bag), 'Continue changed bag items');
      await bag(touch, weapon, 'continued');
      await cameraSettled();
      await capture('continued');
      const dodges = (await read()).weaponState.record.dodges;
      if (touch) await activate(page.locator('[data-touch="dodge"]'), true); else await press('ShiftLeft');
      await wait(s => s.weaponState?.record.dodges === dodges + 1, 'normal dodge input');
      await capture('dodge', { costs: false });
      await walk(near);
      await attack(touch, cdp, false, true);
      await wait(s => s.weaponState?.charged, 'held weapon charges');
      await capture('charged');
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
      input({ type: touch ? 'touch-end-use' : 'mouse-up', intent: 'release charged move' });
      await wait(s => !s.opening.bout.on && s.opening.bout.guard === 0 && !s.fight && !!s.talkLine, 'actual target break releases view then dialogue');
      await reveal();
      await capture('closing-dialogue');
      await endDialogue();
      const end = await wait(s => s.flags['scene.4'] === true && !s.player.busy && !s.talkLine, 'closing dialogue earns scene4');
      must(!end.fight && end.ordinaryHeroVisible && !end.useClaimed, 'combat view did not restore normal hero/input');
      must(JSON.stringify(end.bag) === JSON.stringify(before.bag), 'practice granted or spent bag items');
      must(!end.flags['fight.1.won'] && !events.some(e => e.name === 'fight.ended') && !events.some(e => e.name === 'item.gained'), 'practice granted combat progress or items');
      must(events.filter(e => e.name === 'scene.played' && e.data.scene === 4).length === 1, 'scene4 did not finish exactly once');
      await cameraSettled();
      await capture('restored');
      const result = { status: 'PASS', earned: false, view, weapon, quality: opt.quality, checkpoint, end, events, errors, steps };
      writeFileSync(resolve(caseDir, 'result.json'), JSON.stringify(result, null, 2));
      report.cases.push({ view, weapon, result: fileEvidence(resolve(caseDir, 'result.json')), status: 'PASS' });
      write('report.json', report);
      await context.close(); context = null; page = null;
    }
    report.status = 'PASS';
  } catch (e) {
    report.status = 'FAIL'; report.failure = String(e.stack ?? e); report.failedStage = stage;
    if (page && caseDir) {
      await page.screenshot({ path: resolve(caseDir, 'failed.png') }).catch(() => {});
      await read().then(state => writeFileSync(resolve(caseDir, 'failed.json'), JSON.stringify({ state, errors, events, steps }, null, 2))).catch(() => {});
    }
    console.error(stage, report.failure);
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onTerminate);
    clearInterval(monitor); await monitoring;
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise(done => {
        const timer = setTimeout(() => { server.kill('SIGKILL'); }, 3000);
        server.once('exit', () => { clearTimeout(timer); done(); });
      });
    }
    report.finishedAt = new Date().toISOString(); report.drained = true;
    write('report.json', report);
  }
  console.log(report.status + ' diagnostic opening practice; earned=false');
}

if (import.meta.main) await main();

// Current opening, from an empty browser context. All progression uses browser input.
// PLAY_PORT=5559 bun tools/play-grantday.mjs [--no-build] [--out .artifacts/grantday-review]
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';
import { openingFrame, framingIssues } from './lib/grantday-framing.mjs';
const root = resolve(import.meta.dirname, '..');
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0 && (!process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith('--'))) {
  throw new Error('--out requires an evidence directory');
}
const out = resolve(root, outIndex >= 0 ? process.argv[outIndex + 1] : '.artifacts/grantday-input');
mkdirSync(out, { recursive: true });
for (const name of ['earned-landing.save.json', 'mid-spar.save.json']) rmSync(resolve(out, name), { force: true });
const port = Number(process.env.PLAY_PORT || 5559);
const dist = 'dist-grantday';
const qualityIndex = process.argv.indexOf('--quality');
const quality = qualityIndex < 0 ? 'high' : process.argv[qualityIndex + 1];
const framing = [];
const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
let browser, server, page, failure, current = 'build';
const inputs = [], captures = [], errors = [], scenes = [];
async function observeScenes() {
  await page.exposeFunction('grantdayScene', data => scenes.push(data)).catch(e => { if (!String(e).includes('already')) throw e; });
  await page.evaluate(() => window.__game.view.game.events.on('scene.played', data => window.grantdayScene(data)));
}
const must = (ok, why) => { if (!ok) throw new Error(why); };
const record = (action) => { inputs.push({ step: current, at: Date.now(), ...action }); };
const read = () => page.evaluate(() => {
  const g = window.__game, o = g.view.game.systems.opening;
  return { ...g.state(), opening: { stage: o.stage(), hero: o.hero(), ask: o.asking(), bout: o.bout() } };
});
async function shot(name) {
  await page.waitForTimeout(120);
  const s = await read();
  await page.screenshot({ path: resolve(out, name + '.png') });
  writeFileSync(resolve(out, name + '.json'), JSON.stringify(s, null, 2));
  captures.push({ name, state: s });
  console.log(`ok ${name} ${s.prompt ?? ''}`);
}
async function wait(test, why, timeout = 15000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const s = await read();
    must(!s.viewErrors.length && !Object.keys(s.failed).length, JSON.stringify(s.viewErrors));
    if (test(s)) return s;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out: ${why}`);
}
async function press(key) { record({ type: 'press', key }); await page.keyboard.press(key); await page.waitForTimeout(120); }
async function click(selector) { record({ type: 'click', selector }); await page.locator(selector).click(); }
async function frameShot(name) {
  const seen = await openingFrame(page);
  framing.push({ name, ...seen });
  await page.screenshot({ path: resolve(out, name + '.png') });
  writeFileSync(resolve(out, 'framing.json'), JSON.stringify(framing, null, 2));
}
async function dialogue(name) {
  current = name;
  await wait(s => !!s.talk, name + ' begins');
  const framed = ['15-grant', '17-quay'].includes(name);
  if (framed) await frameShot(name + '-entry');
  await page.waitForTimeout(350);
  await shot(name);
  if (framed) { await frameShot(name + '-approach'); await page.waitForTimeout(800); await frameShot(name + '-settled'); }
  for (let i = 0; i < 120; i++) {
    const s = await read();
    if (!s.talk) { await page.waitForTimeout(250); if (!(await read()).talk) return; }
    if (framed && s.talk) await frameShot(name + '-line-' + i);
    if (s.talk?.choices?.length) {
      const choice = page.getByRole('button', { name: /Take the staff/ });
      record({ type: 'click', text: 'Take the staff' });
      await choice.click();
    } else await press('KeyE');
  }
  throw new Error(name + ' never ended');
}
async function walk(x, z, near = 0.3) {
  const goal = { x: 800 + x, z: 1600 + z };
  record({ type: 'walk-goal', goal, near });
  let last, stuck = 0;
  const held = new Set();
  try {
    for (let i = 0; i < 1000; i++) {
      const s = await read(), p = s.player;
      if (s.talk || Math.hypot(goal.x - p.x, goal.z - p.z) < near) return;
      must(!p.busy, 'walk blocked by busy state');
      const t = goal;
      const yaw = await page.evaluate(() => window.__game.view.camera.yaw);
      const dx = t.x - p.x, dz = t.z - p.z, len = Math.hypot(dx, dz) || 1;
      const f = (-dx * Math.sin(yaw) - dz * Math.cos(yaw)) / len;
      const r = (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / len;
      const want = new Set([...(f > .38 ? ['KeyW'] : f < -.38 ? ['KeyS'] : []), ...(r > .38 ? ['KeyD'] : r < -.38 ? ['KeyA'] : [])]);
      for (const key of held) if (!want.has(key)) { record({ type: 'up', key }); await page.keyboard.up(key); held.delete(key); }
      for (const key of want) if (!held.has(key)) { record({ type: 'down', key }); await page.keyboard.down(key); held.add(key); }
      await page.waitForTimeout(50);
      if (last && Math.hypot(p.x - last.x, p.z - last.z) < .03) stuck++; else stuck = 0;
      if (stuck > 25) throw new Error(`walking stuck at ${p.x},${p.z}, goal ${goal.x},${goal.z}`);
      last = p;
    }
    throw new Error('walking exhausted');
  } finally { for (const key of held) { record({ type: 'up', key }); await page.keyboard.up(key); } }
}
async function restoredCamera(name) {
  await page.waitForTimeout(900);
  const state = await read(), c = state.camera, p = state.player;
  const expected = Math.cos(c.pitch * Math.PI / 180) * c.distance;
  const actual = Math.hypot(c.at.x - p.x, c.at.z - p.z);
  writeFileSync(resolve(out, name + '-restore.json'), JSON.stringify({ expected, actual, state }, null, 2));
  must(Math.abs(expected - actual) < .2, name + ': camera did not restore its normal distance');
  must(!p.busy, name + ': controls still held');
}
async function save(name) {
  // Public save entry point, explicitly recorded; no serialization edits or supplied fixture.
  record({ type: 'public-save', method: '__game.save' });
  must(await page.evaluate(() => window.__game.save()), 'save failed');
  const raw = await page.evaluate(() => localStorage.getItem('greenhollow.save'));
  must(raw, 'save missing'); writeFileSync(resolve(out, name + '.save.json'), raw);
  return JSON.parse(raw);
}
try {
  if (!process.argv.includes('--no-build')) {
    const build = spawn('bun', ['x', 'vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
    must(await new Promise(r => build.on('exit', r)) === 0, 'build failed');
  }
  current = 'title';
  server = spawn('bun', ['tools/serve.mjs', dist, String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((done, fail) => { server.stdout.on('data', b => { if (/pid \d+/.test(String(b))) done(); }); server.on('exit', c => fail(new Error('server exited ' + c))); });
  browser = await launchChrome();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?seed=41&quality=${quality}`);
  await page.waitForFunction(() => !!window.__game);
  must(await page.evaluate(() => localStorage.getItem('greenhollow.save') === null), 'fresh context had a save');
  await observeScenes();
  await shot('00-title');
  record({ type: 'click', text: 'Begin' }); await page.getByRole('button', { name: 'Begin', exact: true }).click();
  current = 'film-skip';
  await page.locator('.st-film:not([hidden])').waitFor();
  await page.mouse.move(1300, 720); await shot('01-film');
  await click('[data-key="opening:skip"]');
  await dialogue('02-hobb-wake');
  current = 'mirror'; await walk(32, 8);
  await wait(s => s.prompt === 'Look in the mirror', 'mirror prompt'); await shot('03-mirror-prompt'); await press('KeyE');
  await click('[data-key="mirror:d"]'); await shot('04-mirror-choice'); await click('[data-key="mirror:done"]');
  await wait(s => s.opening.hero.look === 'd' && !s.player.busy, 'look selected');
  await page.locator('.gd-shade').waitFor({ state: 'hidden' });
  current = 'breakfast'; await walk(28, 9.5); await walk(28, 14); await walk(21, 14); await walk(21, 10); await walk(18, 10.8, 1.7);
  await wait(s => s.prompt === "Eat Hobb's porridge", 'porridge prompt'); await shot('05-breakfast-prompt'); await press('KeyE'); await dialogue('06-breakfast');
  current = 'locks'; await walk(21, 14); await walk(28, 14); await walk(37.5, 14.5); await dialogue('07-lock');
  current = 'map'; await walk(37.5, 7); await dialogue('08-map');
  current = 'rack'; await walk(36.5, 10); await walk(36.5, 14); await walk(30.5, 14.5); await walk(30.5, 19); await walk(16, 23);
  await wait(s => s.prompt === 'Take a weapon from the rack' || !!s.talk?.choices?.length, 'rack choice or prompt');
  await shot('09-rack');
  if (!(await read()).talk) await press('KeyE');
  await dialogue('10-rack-and-dax');
  await wait(s => s.opening.bout.on, 'spar starts');
  current = 'spar-first-hit'; await walk(29, 24.5, .8); await press('KeyF');
  await wait(s => s.opening.bout.guard === 2, 'first hit'); await shot('11-spar-checkpoint');
  const before = await read(); await save('mid-spar');
  current = 'save-continue';
  record({ type: 'reload' }); await page.reload(); await page.waitForFunction(() => !!window.__game);
  await observeScenes();
  await shot('12-continue-title'); await page.getByText('Carries on from your save.', { exact: true }).waitFor();
  record({ type: 'click', text: 'Begin', intent: 'Continue saved game' }); await page.getByRole('button', { name: 'Begin', exact: true }).click();
  const after = await wait(s => s.started && s.opening.bout.on && !s.player.busy, 'Continue restores spar');
  must(after.opening.bout.guard === 2, 'guard lost on Continue');
  must(JSON.stringify(before.flags) === JSON.stringify(after.flags), 'flags changed across Continue');
  must(JSON.stringify(before.bag) === JSON.stringify(after.bag), 'bag changed across Continue');
  await shot('13-spar-restored');
  current = 'spar-remaining-hits'; await press('KeyF'); await wait(s => s.opening.bout.guard === 1, 'second hit');
  await page.waitForTimeout(500);
  record({ type: 'mouse-click', x: 680, y: 350 }); await page.mouse.click(680, 350);
  await wait(s => !s.opening.bout.on && s.opening.bout.guard === 0, 'third hit'); await dialogue('14-spar-after');
  current = 'deed'; await walk(37, 22); await dialogue('15-grant');
  await page.locator('[data-key="deed:name"]').waitFor(); await page.waitForTimeout(900);
  record({ type: 'type', text: 'Rowan' }); await page.keyboard.type('Rowan'); await shot('16-deed'); await press('Enter');
  await wait(s => s.opening.hero.name === 'Rowan' && !s.player.busy, 'deed signed');
  await restoredCamera('deed');
  current = 'quay'; await walk(28, 27); await walk(28, 34); await walk(51, 35); await walk(51, 50); await walk(52, 63);
  await dialogue('17-quay');
  current = 'ferry'; await wait(s => s.opening.stage === 'ferry', 'ferry started'); await shot('18-ferry');
  // Let the presentation finish on real animation frames. No advance, skip or ferryDone call.
  const ferryUntil = Date.now() + 180000, riverLines = new Set();
  while ((await read()).opening.stage === 'ferry') {
    must(Date.now() < ferryUntil, 'normal ferry arrival timed out');
    const visible = await page.evaluate(() => {
      const el = document.querySelector('.st-cinema');
      return el && !el.hidden && Number(el.style.getPropertyValue('--st-black')) < .05 && Number(el.style.getPropertyValue('--st-words')) > .7 ? el.querySelector('.st-line').textContent : null;
    });
    if (visible && !riverLines.has(visible)) { riverLines.add(visible); await shot(`18-river-${riverLines.size}`); }
    await page.waitForTimeout(100);
  }
  must(riverLines.size > 1, 'normal ferry presentation was not observed');
  await dialogue('19-landing');
  current = 'earned-landing';
  const end = await wait(s => !s.talk && !s.player.busy && s.tracked === 'ground', 'landing controls and quest');
  for (let n = 1; n <= 7; n++) must(end.flags[`scene.${n}`] === true, `scene ${n} missing`);
  must(end.flags['quest.grantday.done'] === true, 'grantday incomplete');
  must(end.opening.hero.look === 'd' && end.opening.hero.name === 'Rowan' && end.flags['choice.weapon'] === 'staff', 'choices lost');
  for (const id of ['axe', 'spade']) must(end.bag.filter(s => s.id === id).reduce((n,s) => n+s.count, 0) === 1, id + ' gift count');
  must(end.flags['meal.day'] === end.clock.day, 'breakfast lost');
  for (let n = 1; n <= 7; n++) must(scenes.filter(s => s.scene === n).length === 1, `scene ${n} did not play exactly once`);
  const landing = await page.evaluate(() => window.__game.view.game.systems.region.place('landing').at);
  must(Math.hypot(end.player.x - landing.x, end.player.z - landing.z) < 3, 'not at landing');
  await restoredCamera('landing');
  const pos = end.player; await press('KeyW');
  record({ type: 'hold', key: 'KeyW', ms: 300 }); await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
  const moved = await read(); must(Math.hypot(pos.x-moved.player.x,pos.z-moved.player.z) > .1, 'landing controls did not move hero');
  await save('earned-landing'); await shot('20-earned-landing');
  const problems = framing.flatMap(f => framingIssues(f).map(p => f.name + ': ' + p));
  must(!problems.length, problems.join('\n'));
  must(!errors.length, errors.join('\n'));
} catch (e) { failure = String(e.stack ?? e); console.error(current, failure); if (page) await shot('failed').catch(() => {}); }
finally {
  await browser?.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise(r => server.once('exit', r)); }
  writeFileSync(resolve(out, 'replay.json'), JSON.stringify({ status: failure ? 'BLOCKED' : 'PASS', sha, renderer: browser?.gameRenderer, current, failure, errors, scenes, inputs, captures }, null, 2));
}
console.log(failure ? 'BLOCKED' : 'PASS Grant day input replay');
process.exitCode = failure ? 1 : 0;

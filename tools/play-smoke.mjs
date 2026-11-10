// The game's smoke test: builds it, serves dist on port 5330, opens it in headless Chrome and plays a
// little through the debug door (window.__game). It fails on any console error or failed check.
//   bun tools/play-smoke.mjs [--no-build] [--quality low|medium|high] [--w 1280] [--h 800]
// Screenshots go to .artifacts/play/: the start, after a camera turn, night. This Mac draws WebGL in
// software, so it checks what is drawn and what the rules do, never how fast.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/play');
const PORT = 5330;
mkdirSync(out, { recursive: true });

if (!args.includes('--no-build')) {
  const build = spawnSync('bun', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('FAIL: bun run build'); process.exit(1); }
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', 'dist', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving dist on http://127.0.0.1:${PORT}/  pid ${serverPid}`);

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const errors = [];
let browser;

try {
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: Number(opt('w', 1280)), height: Number(opt('h', 800)) } })).newPage();
  page.setDefaultTimeout(180000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const game = (js, arg) => page.evaluate(js, arg);
  const shot = async (name) => {
    await page.screenshot({ path: resolve(out, name) });
    console.log(`     wrote .artifacts/play/${name}`);
  };

  // `hold` keeps the game from starting by itself, so the test starts it through the door.
  await page.goto(`http://127.0.0.1:${PORT}/?hold=1&quality=${opt('quality', 'high')}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  check('the debug door is open before a game starts', await game(() => window.__game.started === false));

  await game(() => window.__game.newGame());
  await game(() => window.__game.settle());
  await game(() => window.__game.frames(3));
  const start = await game(() => window.__game.state());
  check('a new game started', start.started === true, `systems: ${start.systems.join(', ')}`);
  check('no system failed', Object.keys(start.failed).length === 0, JSON.stringify(start.failed));
  check('no view listener failed', start.viewErrors.length === 0, start.viewErrors.join('; '));
  check('the player is an actor with the hero sprite', start.actors.player === 1 && start.sprites.count >= 1 && start.sprites.missing.length === 0, JSON.stringify(start.sprites));
  await shot('01-start.png');

  // The frames step the rules by themselves. After this the test holds the clock and steps it by hand.
  await game(() => window.__game.frames(6));
  const ticking = await game(() => { window.__game.manual(true); return window.__game.state(); });
  check('the frames step the clock', ticking.clock.seconds > start.clock.seconds, `${start.clock.seconds.toFixed(2)} to ${ticking.clock.seconds.toFixed(2)} seconds`);

  // The clock moves.
  await game(() => window.__game.advance(5));
  const later = await game(() => window.__game.state());
  check('advance(5) moves the clock 5 seconds', Math.abs(later.clock.seconds - ticking.clock.seconds - 5) < 0.001, `${ticking.clock.seconds.toFixed(2)} to ${later.clock.seconds.toFixed(2)}`);
  check('the time of day moved', later.clock.timeOfDay > ticking.clock.timeOfDay, `${ticking.clock.timeOfDay.toFixed(4)} to ${later.clock.timeOfDay.toFixed(4)}`);

  // Walking: hold W for a second and a half. Then softly with Shift. The body's events are counted on the way.
  await game(() => {
    const heard = (window.__heard = { footstep: 0, jump: 0, land: 0 });
    for (const name of Object.keys(heard)) window.__game.view.game.events.on(name, () => { heard[name]++; });
  });
  await game(() => { window.__game.key('w', true); window.__game.advance(1.5); window.__game.key('w', false); });
  const walked = await game(() => window.__game.state());
  const far = Math.hypot(walked.player.x - later.player.x, walked.player.z - later.player.z);
  check('W walks the player', far > 3, `${far.toFixed(2)} blocks in 1.5 seconds`);
  await game(() => { window.__game.advance(0.5); window.__game.key('shift', true); window.__game.key('s', true); window.__game.advance(2); window.__game.key('s', false); window.__game.key('shift', false); });
  const soft = await game(() => window.__game.state());
  const softFar = Math.hypot(soft.player.x - walked.player.x, soft.player.z - walked.player.z);
  check('Shift walks softly at 2 blocks a second', softFar > 3 && softFar < 4.4, `${softFar.toFixed(2)} blocks in 2 seconds`);
  await game(() => { window.__game.key('space'); window.__game.advance(0.2); });
  const jumped = await game(() => window.__game.state());
  check('Space jumps', jumped.player.onGround === false && jumped.player.y > soft.player.y + 0.3, `y ${soft.player.y.toFixed(2)} to ${jumped.player.y.toFixed(2)}`);
  await game(() => window.__game.advance(1));
  const heard = await game(() => window.__heard);
  check('footstep, jump and land reach game.events', heard.footstep >= 8 && heard.jump === 1 && heard.land === 1, JSON.stringify(heard));

  // Teleport lands where it says.
  const to = await game(() => window.__game.teleport('spawn'));
  const landed = await game(() => { window.__game.advance(0.5); return window.__game.state(); });
  check('teleport lands the player', Math.hypot(landed.player.x - to.x, landed.player.z - to.z) < 0.01 && Math.abs(landed.player.y - to.y) < 0.6 && landed.player.onGround,
    `asked ${to.x}, ${to.y}, ${to.z}  got ${landed.player.x.toFixed(2)}, ${landed.player.y.toFixed(2)}, ${landed.player.z.toFixed(2)}`);

  // Break the ground two blocks east of the player, then put a block back in the hole.
  const dig = await game(() => {
    const g = window.__game, p = g.state().player;
    const x = Math.floor(p.x) + 2, z = Math.floor(p.z), y = g.view.world.sim.heightAt(x, z) - 1;
    const before = g.block(x, y, z);
    const broke = g.click('primary', x, y, z);
    const hole = g.block(x, y, z);
    const bag = g.state().bag;
    // Hold whatever the break dropped and place it on the top of the block under the hole.
    const slots = g.view.game.systems.inventory.slots;
    const held = slots.findIndex((slot) => slot && g.view.game.systems.items.get(slot.id).block !== undefined);
    if (held >= 0 && held < 9) g.key(String(held + 1));
    const placed = g.click('secondary', x, y - 1, z);
    g.advance(0.1);
    return { x, y, z, before, broke, hole, bag, held, placed, after: g.block(x, y, z), stats: g.state().stats };
  });
  check('holding the left button breaks a block', dig.broke.broke && dig.hole.id === 0, `${dig.before.key} at ${dig.x}, ${dig.y}, ${dig.z}`);
  check('the break put something in the bag', dig.bag.length > 0, JSON.stringify(dig.bag));
  check('the right button places it back', dig.placed.used && dig.after.id !== 0, `now ${dig.after.key}`);
  check('the end card counts the placed block', dig.stats.blocks === 1, JSON.stringify(dig.stats));

  await game(() => window.__game.frames(1));
  check('breaking and placing throw particles', await game(() => window.__game.view.effects.live > 0), `${await game(() => window.__game.view.effects.live)} alive`);

  // Somebody else: an actor with a mark gets a sprite and a badge over its head, and loses both when it goes.
  // The town's people and creatures are actors too, so count against what was there before.
  const crowdBefore = await game(() => ({ count: window.__game.state().sprites.count, quest: document.querySelectorAll('.mark.mark-quest').length, marks: document.querySelectorAll('.mark').length }));
  await game(() => {
    const g = window.__game, p = g.state().player;
    g.view.game.actors.set('npc:smoke', { id: 'npc:smoke', sprite: 'tamsin', pos: { x: p.x + 2, y: p.y, z: p.z + 1 }, facing: Math.PI, anim: 'idle', visible: true, mark: 'quest' });
  });
  await game(() => window.__game.frames(2));
  const crowd = await game(() => ({ sprites: window.__game.state().sprites, badges: document.querySelectorAll('.mark.mark-quest').length }));
  check('an actor gets a sprite and its mark', crowd.sprites.count === crowdBefore.count + 1 && crowd.sprites.missing.length === 0 && crowd.badges === crowdBefore.quest + 1, `${JSON.stringify(crowd)}, before ${JSON.stringify(crowdBefore)}`);

  // A real key press: Q turns the camera, and the first key starts the sound.
  await page.keyboard.press('KeyQ');
  await game(() => window.__game.frames(12));
  const turned = await game(() => window.__game.state());
  check('Q turns the camera a quarter turn', turned.camera.quarter !== start.camera.quarter, `quarter ${start.camera.quarter} to ${turned.camera.quarter}`);
  check('the first key starts the sound', turned.sound === true);
  await game(() => window.__game.settle());
  await game(() => window.__game.frames(3));
  await shot('02-turned.png');

  await game(() => { window.__game.view.game.actors.delete('npc:smoke'); });
  await game(() => window.__game.frames(2));
  const alone = await game(() => ({ count: window.__game.state().sprites.count, badges: document.querySelectorAll('.mark').length }));
  check('a removed actor loses its sprite and its mark', alone.count === crowdBefore.count && alone.badges === crowdBefore.marks, `${JSON.stringify(alone)}, before ${JSON.stringify(crowdBefore)}`);

  // Night.
  await game(() => { window.__game.setTime(0.93); window.__game.advance(2); });
  await game(() => window.__game.frames(4));
  const night = await game(() => window.__game.state());
  check('the clock can be set to night', night.clock.timeOfDay > 0.9, night.clock.timeOfDay.toFixed(3));
  await shot('03-night.png');

  // The real mouse: point at the ground two blocks from the player, hold the left button, and the block breaks.
  // The frames step the rules here, as they do for a player. At the spawn, on open ground, with the camera
  // turned back from Q: the forest stands where the old test site was, a block tree hides the ground beside the
  // hero from the turned camera, and the dig above must stay in the loaded chunks for the Continue check.
  await game((back) => { const g = window.__game; g.setTime(0.4); g.teleport('spawn'); if (back) g.turn(back); g.advance(0.5); },
    turned.camera.quarter === (start.camera.quarter + 1) % 4 ? -1 : 1);
  await game(() => window.__game.settle());
  await game(() => window.__game.frames(3));
  // The first block near the player that may be broken (the road is the town's) and whose spot on the page is
  // bare canvas (the prompt under the hero is HTML).
  const target = await game(() => {
    const g = window.__game, p = g.state().player;
    for (const [ox, oz] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [3, 0], [-3, 0]]) {
      const x = Math.floor(p.x) + ox, z = Math.floor(p.z) + oz, y = g.view.world.sim.heightAt(x, z) - 1;
      const at = g.view.project(x + 0.5, y + 1, z + 0.5);
      if (g.view.game.systems.region?.isProtected(x, y, z)) continue;
      if (at && document.elementFromPoint(at.x, at.y)?.tagName === 'CANVAS') return { x, y, z, key: g.block(x, y, z).key, at };
    }
    return null;
  });
  if (!target) throw new Error('no block near the spawn shows on bare canvas');
  await page.mouse.move(target.at.x, target.at.y);
  await game(() => window.__game.frames(2));
  const aim = await game(() => { const a = window.__game.view.aim; return a ? { x: a.x, y: a.y, z: a.z } : null; });
  check('the pointer aims at the block under it', aim && aim.x === target.x && aim.y === target.y && aim.z === target.z, `wanted ${target.x}, ${target.y}, ${target.z} (${target.key})  got ${JSON.stringify(aim)}`);
  await game(() => window.__game.manual(false));
  await page.mouse.down();
  let gone = false;
  for (let i = 0; i < 30 && !gone; i++) {
    await game(() => window.__game.frames(1));
    gone = await game((t) => window.__game.block(t.x, t.y, t.z).id === 0, target);
  }
  await page.mouse.up();
  check('holding the real left button breaks it', gone);

  // The real keyboard: hold W for a few frames.
  const beforeKeys = await game(() => window.__game.state().player);
  await page.keyboard.down('KeyW');
  await game(() => window.__game.frames(4));
  await page.keyboard.up('KeyW');
  const afterKeys = await game(() => { window.__game.manual(true); return window.__game.state().player; });
  const keyFar = Math.hypot(afterKeys.x - beforeKeys.x, afterKeys.z - beforeKeys.z);
  check('holding the real W key walks', keyFar > 0.5, `${keyFar.toFixed(2)} blocks`);

  // Saving, and the numbers the meter reads.
  check('the game saves', await game(() => window.__game.save() && window.__game.hasSave()));
  const counters = await game(() => window.__game.counters());
  check('the counters read the picture', counters.drawCalls > 0 && counters.triangles > 0, `${counters.drawCalls} draw calls, ${counters.triangles} triangles, quality ${counters.quality}`);
  const end = await game(() => window.__game.state());
  check('still no system or view failed', Object.keys(end.failed).length === 0 && end.viewErrors.length === 0, JSON.stringify(end.failed) + end.viewErrors.join('; '));

  // Continue: a fresh page loads the save and is where the last one was.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  check('a fresh page finds the save', await game(() => window.__game.hasSave() && !window.__game.started));
  const loaded = await game((d) => {
    const g = window.__game;
    const ok = g.continueGame();
    g.manual(true);
    return { ok, state: g.state(), placed: g.block(d.x, d.y, d.z) };
  }, dig);
  const sameBag = JSON.stringify(loaded.state.bag) === JSON.stringify(end.bag);
  const samePlace = Math.hypot(loaded.state.player.x - end.player.x, loaded.state.player.y - end.player.y, loaded.state.player.z - end.player.z) < 0.01;
  check('Continue restores the player, the clock and the bag', loaded.ok && loaded.state.started && samePlace && sameBag && Math.abs(loaded.state.clock.seconds - end.clock.seconds) < 0.001 && loaded.state.clock.day === end.clock.day,
    `player ${samePlace}, bag ${sameBag}, clock ${end.clock.seconds.toFixed(2)} to ${loaded.state.clock.seconds.toFixed(2)}`);
  check('Continue restores the world and the end card numbers', loaded.placed.id === dig.after.id && loaded.state.stats.blocks === end.stats.blocks, `${loaded.placed.key}, ${JSON.stringify(loaded.state.stats)}`);
  await game(() => window.__game.settle());
  await game(() => window.__game.frames(2));
  await shot('04-continued.png');

  // New game from a game in progress: the page reloads itself and starts at day 1 with an empty bag.
  await Promise.all([page.waitForEvent('load'), game(() => { window.__game.newGame(); })]);
  await page.waitForFunction(() => window.__game !== undefined && window.__game.started);
  const fresh = await game(() => { window.__game.manual(true); return window.__game.state(); });
  check('New game during a game starts over on a fresh page', fresh.started && fresh.bag.length === 0 && fresh.clock.day === 1 && fresh.clock.seconds < 30 && fresh.stats.blocks === 0, `bag ${fresh.bag.length}, ${fresh.clock.seconds.toFixed(2)} seconds in`);

  writeFileSync(resolve(out, 'smoke.json'), JSON.stringify({ checks, errors, start, end, counters, dig }, null, 2));
} catch (error) {
  check('the script ran to its end', false, String(error));
} finally {
  await browser?.close();
  process.kill(serverPid);
}

check('no console errors', errors.length === 0, errors.join('\n'));
const failed = checks.filter((c) => !c.pass);
console.log(failed.length ? `\nFAIL: ${failed.length} of ${checks.length} checks` : `\nPASS: ${checks.length} checks, no console errors`);
process.exit(failed.length ? 1 : 0);

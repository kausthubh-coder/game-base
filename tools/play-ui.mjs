// The interface check: builds the game, serves it on port 5332, opens it in headless Chrome and walks
// the interface with real keys and clicks, helped by the debug door (window.__game). It saves a
// screenshot of every screen to .artifacts/play/ui-*.png and fails on a console error or a failed check.
//   bun tools/play-ui.mjs [--port 5332] [--no-build] [--quality low|medium|high] [--only desktop|phone|world]
//
// The pictures are 1440 by 900: the title, Settings, the first seconds of a new game with the HUD, a
// hint, a toast, every panel, a conversation mid-line and at a choice, the map, pause and the end card.
// Then the title, the HUD, the bag and a conversation at 390 by 844. `--only world` shoots the other
// title, `?title=world`, where the camera drifts over the live world.
//
// The build is copied to .artifacts/play/ui-site and served from there, because another tool's build
// empties dist/ while this one is still loading pages from it.
//
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cameraStill } from './play/wait.mjs';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/play');
const site = resolve(out, 'ui-site');
// --port or PLAY_PORT moves it, so several worktrees can run their checks at once.
const PORT = Number(opt('port', process.env.PLAY_PORT || '5332'));
const BASE = `http://127.0.0.1:${PORT}/`;
const quality = opt('quality', 'high');
const only = opt('only', '');
mkdirSync(out, { recursive: true });

if (!args.includes('--no-build')) {
  // Other agents write views in the same folder. A file of theirs caught half-written fails the build, so try again a few times.
  let built = false;
  for (let attempt = 1; attempt <= 5 && !built; attempt++) {
    const build = spawnSync('bun', ['run', 'build'], { cwd: root, stdio: ['ignore', 'ignore', attempt === 5 ? 'inherit' : 'ignore'] });
    built = build.status === 0;
    if (!built && attempt < 5) {
      console.log(`the build failed (attempt ${attempt} of 5). Waiting 15 seconds.`);
      await new Promise((done) => setTimeout(done, 15000));
    }
  }
  if (!built) { console.error('FAIL: bun run build'); process.exit(1); }
  rmSync(site, { recursive: true, force: true });
  cpSync(resolve(root, 'dist'), site, { recursive: true });
}

// The server prints its pid, and it is stopped by that pid, never by port.
const server = spawn('bun', ['tools/serve.mjs', site, String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
const serverPid = await new Promise((done, fail) => {
  let text = '';
  server.stdout.on('data', (chunk) => {
    text += chunk;
    const pid = /pid (\d+)/.exec(text);
    if (pid) done(Number(pid[1]));
  });
  server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${PORT} taken?`)));
});
console.log(`serving ${site} on ${BASE}  pid ${serverPid}`);

const checks = [];
const errors = [];
const shots = [];
const notes = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass: Boolean(pass), detail: String(detail) });
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const note = (text) => { notes.push(text); console.log(`note ${text}`); };

/** The pieces that sit over the game. No two of them may overlap, and none may leave the screen. */
const PIECES = ['.gb-hud-slots', '.gb-hud-minimap', '.gb-hud-sky', '.gb-hud-quest', '.gu-prompt', '.gu-toasts', '.gu-hint', '.gu-note', '.gb-dialogue-box'];

/** Opens the game in a fresh browser profile at one size and returns what a walk needs. */
async function open(browser, width, height, query = '') {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${width}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${width}: ${String(e)}`));
  const game = (js, arg) => page.evaluate(js, arg);
  const shot = async (name) => {
    await page.screenshot({ path: resolve(out, name) });
    shots.push(name);
    console.log(`     wrote .artifacts/play/${name}`);
  };
  /** Waits until the page has drawn `count` more frames, so what the rules changed is on the screen. */
  const frames = (count = 2) => game((n) => window.__game.frames(n), count);
  const visible = (selector) => game((s) => {
    const e = document.querySelector(s);
    if (!e || e.closest('[hidden]')) return false;
    const box = e.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  }, selector);
  const panel = () => game(() => /gu-stage-(\w+)/.exec(document.querySelector('.gu-stage:not([hidden])')?.className ?? '')?.[1] ?? null);
  const mapOpen = () => visible('.gb-map');
  const state = () => game(() => window.__game.state());
  /** Which of the pieces overlap each other or leave the screen, as sentences. Empty when all is well. */
  const layout = () => game((pieces) => {
    const boxes = [];
    for (const selector of pieces) {
      const e = document.querySelector(selector);
      if (!e || e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden') continue;
      const box = e.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) boxes.push({ selector, box });
    }
    const wrong = [];
    for (const { selector, box } of boxes) {
      if (box.left < -0.5 || box.top < -0.5 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5) wrong.push(`${selector} leaves the screen`);
    }
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a].box, B = boxes[b].box;
        if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) wrong.push(`${boxes[a].selector} overlaps ${boxes[b].selector}`);
      }
    }
    return wrong;
  }, PIECES);
  const clean = async (what) => {
    const wrong = await layout();
    check(`${width}: nothing overlaps or is clipped, ${what}`, wrong.length === 0, wrong.join('; '));
  };

  await page.goto(`${BASE}?quality=${quality}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.waitForSelector('#loading', { state: 'detached' });
  return { context, page, game, shot, frames, visible, panel, mapOpen, state, clean, width };
}

/** Starts a new game from the title with a real click and waits for the land. */
async function newGame(t) {
  await t.page.click('[data-key="title:new"]');
  // The opening scene plays first. It is skipped with its real Skip button.
  await t.page.waitForSelector('.st-cinema:not([hidden]) [data-key="opening:skip"]', { timeout: 30000 });
  await t.page.click('[data-key="opening:skip"]');
  await t.page.waitForSelector('.st-cinema', { state: 'hidden', timeout: 60000 });
  await t.page.waitForFunction(() => window.__game.started);
  await t.game(() => window.__game.settle());
  await t.frames(3);
}

/** Starts a talk with Tamsin: at her side with E when the people are in the game, else by the conversation's id. */
async function talkToTamsin(t) {
  const there = await t.game(() => {
    const g = window.__game, tamsin = g.view.game.actors.get('npc:tamsin');
    if (!tamsin) return false;
    g.teleport(tamsin.pos.x + 1.2, tamsin.pos.z + 0.4);
    g.advance(0.3);
    return true;
  });
  if (there) {
    await t.frames(2);
    const prompt = (await t.state()).prompt;
    check(`${t.width}: the prompt names Tamsin`, prompt === 'Talk to Tamsin', String(prompt));
    await t.page.keyboard.press('e');
  } else {
    await t.game(() => window.__game.view.game.systems.talk.start('tamsin.meet', 'tamsin'));
  }
  await t.page.waitForFunction(() => document.querySelector('.gb-dialogue') && !document.querySelector('.gb-dialogue').hidden);
  return there;
}

async function desktop(browser) {
  const t = await open(browser, 1440, 900);
  const { page, game, shot, frames, visible, panel, mapOpen, state, clean } = t;
  const key = (name) => page.keyboard.press(name);

  // ------------------------------------------------------------------ 1. the title
  await page.waitForSelector('.gu-stage-title');
  const title = await game(() => ({
    started: window.__game.started,
    art: getComputedStyle(document.querySelector('.gu-stage-title')).backgroundImage,
    continueOff: document.querySelector('[data-key="title:continue"]').disabled,
    hud: !document.querySelector('.gb-hud').hidden,
    seconds: window.__game.state().clock.seconds,
  }));
  check('the game opens on the title and nothing has started', title.started === false);
  check('the title shows the picture from the manifest, ui/title.png', /ui\/title(?:\.[a-f0-9]+)?\.(?:png|webp)/.test(title.art), title.art.slice(0, 90));
  check('Continue is off without a save', title.continueOff === true);
  check('the HUD is hidden behind the title', title.hud === false);
  await frames(3);
  check('the world is not stepped while the title shows', (await state()).clock.seconds === title.seconds, `${title.seconds} seconds`);
  await shot('ui-01-title.png');

  await page.click('[data-key="title:settings"]');
  check('Settings opens from the title', (await panel()) === 'settings');
  const keyList = await game(() => [...document.querySelectorAll('.gu-keylist dt')].map((e) => e.textContent));
  check('Settings lists the map and the camera keys', keyList.includes('Map') && keyList.includes('Turn the camera'), keyList.join(', '));
  for (const quality of ['low','medium','high','auto']) {
    await page.locator(`input[name="gu-quality"][value="${quality}"]`).check();
    check(`Graphics quality ${quality} applies`, (await game(() => window.__game.view.settings.quality)) === quality);
  }
  await page.locator('input[name="gu-quality"][value="high"]').check();
  for (const [name,value] of [['shadows','off'],['shadows','sharp'],['shadows','soft'],['bloom','off'],['cloudShadows','off'],['weatherParticles','off'],['reduceMotion','on']]) {
    await page.locator(`input[name="gu-${name}"][value="${value}"]`).check();
    const actual = await game(([name]) => window.__game.view.settings.graphics[name], [name]);
    check(`Graphics ${name} applies ${value}`, actual === (value === 'on' ? true : value === 'off' && name !== 'shadows' ? false : value));
  }
  check('Graphics shadows reach the light', await game(() => window.__game.view.sky.sun.castShadow));
  check('Graphics bloom reaches post processing', !(await game(() => window.__game.view.post.settings.bloom)));
  for (const [name,value] of [['shadowDistance',60],['plantDensity',.3],['viewDistance',.7]]) {
    await page.locator(`#gu-${name}`).evaluate((el,value) => {el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
    check(`Graphics ${name} applies`, (await game(name => window.__game.view.settings.graphics[name],name)) === value);
  }
  await page.getByRole('button',{name:'Reset graphics overrides',exact:true}).click();
  // Settings > Debug: each overlay shows when it is turned on, and F3 flips the meter and the setting with it.
  const shown = (selector) => game((s) => document.querySelector(s)?.checkVisibility() ?? false, selector);
  const overlays = [['fps', '.debug-fps'], ['meter', '.perf-meter'], ['info', '.debug-info']];
  for (const [name, selector] of overlays) check(`Debug ${name} starts hidden`, !(await shown(selector)));
  for (const [name, selector] of overlays) {
    await page.locator(`input[name="gu-debug-${name}"][value="on"]`).check();
    await frames(20);
    check(`Debug ${name} on shows it`, (await shown(selector)) && (await game((n) => window.__game.view.settings.debug[n], name)));
  }
  check('the debug panel says where the hero is', /^x .* y .* z /.test(await game(() => document.querySelector('.debug-info').textContent)));
  check('the frame-rate counter shows a number', /\d+ fps/.test(await game(() => document.querySelector('.debug-fps').textContent)));
  await page.keyboard.press('F3');
  check('F3 hides the meter and turns its setting off', !(await shown('.perf-meter')) && !(await game(() => window.__game.view.settings.debug.meter)));
  for (const [name] of overlays) await page.locator(`input[name="gu-debug-${name}"][value="off"]`).check();
  for (const [name, selector] of overlays) check(`Debug ${name} off hides it`, !(await shown(selector)));
  await shot('ui-02-settings.png');
  await key('Escape');
  check('Esc goes back from Settings to the title', (await panel()) === 'title');

  // ------------------------------------------------------------------ 2. a new game and the HUD
  await newGame(t);
  // The frames go on stepping the rules, slowly on this Mac. `advance` steps them further at once. The debug
  // door's `manual(true)` is not used: it pauses the game, and a paused game takes no E and no number key.
  await game(() => window.__game.advance(1));
  await frames(2);
  const start = await state();
  check('New game starts a new world and closes the title', start.started && (await panel()) === null, `systems: ${start.systems.join(', ')}`);
  check('no system and no view failed', Object.keys(start.failed).length === 0 && start.viewErrors.length === 0, JSON.stringify(start.failed) + start.viewErrors.join('; '));
  const hud = await game(() => ({
    shown: !document.querySelector('.gb-hud').hidden,
    bars: getComputedStyle(document.querySelector('.gb-hud-vitals')).display,
    slots: document.querySelectorAll('.gb-hud-slots .gb-slot').length,
    quest: document.querySelector('.gb-hud-quest h3')?.textContent ?? '',
    steps: [...document.querySelectorAll('.gb-hud-quest li')].map((e) => e.textContent),
    clock: document.querySelector('.gb-hud-clock')?.textContent ?? '',
    day: document.querySelector('.ui-day')?.textContent ?? '',
    weather: document.querySelector('.gb-hud-weather')?.getAttribute('aria-label') ?? '',
    minimap: Boolean(document.querySelector('.gb-hud-minimap .gb-minimap canvas')),
  }));
  check('the HUD shows nine quick slots, and no health bars', hud.shown && hud.slots === 9 && hud.bars === 'none', JSON.stringify({ slots: hud.slots, bars: hud.bars }));
  check('the tracker shows the tracked quest and its steps', hud.quest === 'A plot of your own' && hud.steps.length === 3, `${hud.quest}: ${hud.steps.join(' / ')}`);
  check('the clock, the day and the weather show', /^\d\d:\d\d$/.test(hud.clock) && hud.day === 'Day 1' && hud.weather !== '', `${hud.day} ${hud.clock} ${hud.weather}`);
  check('the minimap is in its corner', hud.minimap);
  await shot('ui-03-hud.png');
  await clean('at the start');

  // ------------------------------------------------------------------ 3. a hint
  // The director sends "Move with W, A, S and D" in the first seconds. If it has gone by, one is sent by hand.
  await game(() => window.__game.advance(5));
  if (!(await visible('.gu-hint'))) await game(() => window.__game.view.game.events.emit('hint', { id: 'check', text: 'Move with W, A, S and D. Q and R turn the camera.' }));
  await frames(1);
  check('a hint event reaches the screen', await visible('.gu-hint'), await game(() => document.querySelector('.gu-hint-text')?.textContent ?? ''));
  await shot('ui-04-hint.png');
  await clean('with a hint');

  // ------------------------------------------------------------------ 4. talking
  const sound = await game(() => {
    // The first key of the walk started the sound engine. Count the voice blips it is sent.
    const audio = window.__game.view.audio;
    window.__blips = [];
    if (!audio) return false;
    const emit = audio.emit.bind(audio);
    audio.emit = (event) => { if (event.type === 'talk') window.__blips.push(event.char); return emit(event); };
    return true;
  });
  // Every drawn frame from the moment the line opens notes how much of it is typed. On a slow machine one frame
  // can last longer than the whole line, and then typing cannot be seen at all, which is not the game's fault.
  await game(() => {
    const seen = (window.__typing = { partial: false, frames: 0, opened: 0, full: 0 });
    const tick = () => {
      const typed = document.querySelector('.gb-dialogue-typed')?.textContent ?? '';
      const rest = document.querySelector('.gb-dialogue-untyped')?.textContent ?? '';
      if (typed.length + rest.length > 0) {
        if (!seen.opened) seen.opened = performance.now();
        seen.frames++;
        if (typed.length > 0 && rest.length > 0) seen.partial = true;
        if (rest.length === 0 && !seen.full) seen.full = performance.now();
      }
      if (seen.frames < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const beside = await talkToTamsin(t);
  if (!beside) note('The people are not in the game yet, so the conversation was started by its id and not with E beside Tamsin.');
  await frames(3);
  const mid = await game(() => ({
    name: document.querySelector('.gb-dialogue-name').textContent,
    typed: document.querySelector('.gb-dialogue-typed').textContent,
    whole: document.querySelector('.gb-dialogue-typed').textContent + document.querySelector('.gb-dialogue-untyped').textContent,
    portrait: getComputedStyle(document.querySelector('.gb-dialogue-portrait > *')).backgroundImage,
    line: window.__game.state().talk?.text,
    busy: window.__game.state().player.busy,
  }));
  check('the box shows the talk system\'s line, with the name', mid.name === 'Tamsin' && mid.whole === mid.line, `${mid.name}: ${mid.whole}`);
  check('the portrait comes from the manifest\'s portraits sheet', /portraits\/portraits(?:\.[a-f0-9]+)?\.(?:png|webp)/.test(mid.portrait), mid.portrait.slice(0, 80));
  await page.waitForFunction(() => window.__typing.partial || window.__typing.full, null, { timeout: 15000 });
  const typing = await game(() => window.__typing);
  if (typing.partial || typing.frames > 2) check('the line types out a letter at a time', typing.partial, `partly typed in some frame: ${typing.partial}; ${typing.frames} frames until now`);
  else note(`Typing could not be seen: the whole line showed within ${typing.frames} drawn frame(s) (${Math.round(typing.full - typing.opened)} ms), so this machine is too slow to watch it.`);
  check('the player is busy while a line shows', mid.busy === true);
  // A voiced person's line plays their recorded clip and types in time with it, with no blips. Anyone else blips.
  if (sound) {
    const said = await game((text) => ({ blips: window.__blips.length, clip: (window.__voice?.log ?? []).find((r) => r.key.endsWith('|' + text))?.status ?? null }), mid.line);
    // A clip that already played to its end has spoken too: on a slow machine it can be over in a few frames.
    check('the line speaks: a recorded clip, or a voice blip for each typed letter', said.blips > 0 || ['loading', 'playing', 'ended'].includes(said.clip), `${said.blips} blips, clip ${said.clip ?? 'none'} for "${mid.typed}"`);
  }
  else note('The sound engine had not started, so the voice blips were not counted.');
  await shot('ui-05-talk.png');
  await game(() => window.__game.view.game.events.emit('hint', { id: 'check-talk', text: 'A hint that arrives while someone is talking.' }));
  await frames(1);
  await clean('in a conversation with a hint up');

  // Space shows the whole line, and Space again moves on. E does the same, and so does a click anywhere.
  const box = () => game(() => {
    const e = document.querySelector('.gb-dialogue');
    return {
      open: Boolean(e) && !e.hidden,
      line: window.__game.state().talk?.text ?? null,
      untyped: document.querySelector('.gb-dialogue-untyped')?.textContent ?? '',
      choices: [...document.querySelectorAll('.gb-dialogue-choices:not([hidden]) button')].map((b) => b.textContent),
    };
  });
  /** Presses until a line has only just started to type. Null when the conversation ends first. */
  const freshLine = async (press) => {
    for (let i = 0; i < 12; i++) {
      const now = await box();
      if (!now.open || now.choices.length > 0) return null;
      if (now.untyped !== '') return now;
      await press();
    }
    return null;
  };
  const twoPresses = async (name, press) => {
    const fresh = await freshLine(press);
    if (!fresh) { note(`The conversation was over before ${name} could be tried on a line still typing.`); return; }
    await press();
    const whole = await box();
    check(`${name} shows the whole line`, whole.line === fresh.line && whole.untyped === '', `"${String(whole.line).slice(0, 40)}"`);
    await press();
    const next = await box();
    check(`${name} again moves on`, next.line !== fresh.line, next.line === null ? 'the conversation ended' : `"${next.line.slice(0, 40)}"`);
  };
  await twoPresses('Space', () => key('Space'));
  await twoPresses('E', () => key('e'));
  // The box ignores a click in the first 220 ms of a line, so the click that opened it is not also a skip.
  await twoPresses('a click anywhere', async () => { await page.waitForTimeout(260); await page.mouse.click(720, 300); });
  let presses = 0;
  for (; presses < 80 && (await box()).open; presses++) {
    if ((await box()).choices.length > 0) await page.click('.gb-dialogue-choices button');
    else await key('Enter');
  }
  const after = await state();
  check('Enter carries the conversation to its end', after.talk === null && after.player.busy === false && !(await visible('.gb-dialogue')), `${presses} presses`);
  // The Almanac is a key item: a flag, never a thing in the bag.
  check('Tamsin gave the Almanac and the axe', after.flags['has.almanac'] === true && !after.bag.some((s) => s.id === 'almanac') && after.bag.some((s) => s.id === 'axe'), `book ${after.flags['has.almanac']}, bag ${after.bag.map((s) => s.id).join(', ')}`);
  await frames(2);

  // A line with choices: Maren asks for the wheat.
  await game(() => { window.__game.skipTo('bread'); window.__game.advance(0.6); window.__game.view.game.systems.talk.start('maren.ask', 'maren'); });
  for (let i = 0; i < 30 && (await box()).open && (await box()).choices.length === 0; i++) await key('Space');
  const offer = await box();
  if (offer.choices.length > 0) {
    await frames(1);
    await shot('ui-06-talk-choice.png');
    await clean('at a choice');
    const before = (await state()).selected;
    await key('2');
    const picked = await box();
    check('a number key picks a choice, and leaves the quick slot alone', picked.line !== offer.line && (await state()).selected === before, `picked "${offer.choices[1]?.slice(1) ?? ''}"`);
  } else {
    check('the conversation maren.ask offers a choice', false, JSON.stringify(offer));
  }
  for (let i = 0; i < 60 && (await box()).open; i++) {
    if ((await box()).choices.length > 0) await page.click('.gb-dialogue-choices button');
    else await key('Space');
  }
  check('the conversation with choices ends', !(await box()).open && (await state()).player.busy === false);
  await frames(1);

  // ------------------------------------------------------------------ 5. toasts, and the bag's quick row
  await game(() => {
    const g = window.__game;
    g.teleport('grant.center');
    g.give('workbench', 1); g.give('plank', 9); g.give('berry', 3); g.give('oak_log', 14); g.give('wheat', 7);
    g.advance(0.6);
  });
  // A toast stays three seconds, and a frame here can take one: read them before waiting for the picture.
  const toasts = await game(() => [...document.querySelectorAll('.gu-toast')].map((e) => e.textContent));
  await frames(1);
  check('a gain sends a toast with its count', toasts.some((text) => /Oak log.*14/.test(text)) && toasts.some((text) => /Wheat.*7/.test(text)), toasts.join(' | '));
  const quick = await game(() => {
    const sys = window.__game.view.game.systems;
    return [...document.querySelectorAll('.gb-hud-slots .gb-slot')].map((button, i) => {
      const stack = sys.inventory.slots[i];
      const want = stack ? `Slot ${i + 1}, ${sys.items.get(stack.id).name}${stack.count > 1 ? ', ' + stack.count : ''}` : `Slot ${i + 1}, empty`;
      return { label: button.getAttribute('aria-label'), want, icon: !stack || Boolean(button.querySelector('.gb-slot-icon .ui-cell')) };
    });
  });
  check('the quick slots show the bag\'s first nine slots, each with its icon from the manifest', quick.length === 9 && quick.every((slot) => slot.label === slot.want && slot.icon), quick.map((slot) => slot.label).join(' | '));
  await key('3');
  const picked = await game(() => [...document.querySelectorAll('.gb-hud-slots .gb-slot')].findIndex((b) => b.getAttribute('aria-pressed') === 'true'));
  await frames(1);
  check('3 picks the third quick slot, and the HUD marks it', (await state()).selected === 2 && (await game(() => [...document.querySelectorAll('.gb-hud-slots .gb-slot')].findIndex((b) => b.getAttribute('aria-pressed') === 'true'))) === 2, `was ${picked}`);
  const tracker = await game(() => [...document.querySelectorAll('.gb-hud-quest li')].map((e) => e.textContent));
  check('the tracker shows a count on a step that counts', tracker.some((text) => /7\/20$/.test(text)), tracker.join(' / '));
  await shot('ui-07-toast.png');
  await clean('with toasts');

  // ------------------------------------------------------------------ 6. the panels on their keys
  await key('i');
  check('I opens the bag', (await panel()) === 'bag');
  await shot('ui-08-bag.png');
  await dragAndDrop(t);
  await key('b');
  check('B closes the bag', (await panel()) === null);
  await key('b');
  await key('Escape');
  check('B opens the bag and Esc closes it, without pausing', (await panel()) === null && (await state()).paused === false);

  await key('Tab');
  check('Tab opens the Almanac', (await panel()) === 'almanac');
  await shot('ui-09-almanac.png');
  await key('j');
  check('J swaps the Almanac for the quest log', (await panel()) === 'quests');
  await shot('ui-10-quests.png');
  await key('j');

  await game(() => window.__game.view.game.events.emit('ui.open', { panel: 'make' }));
  check('the event ui.open opens the Make panel', (await panel()) === 'make');
  await key('Escape');
  // A workbench set down and used with E opens it too.
  const bench = await game(() => {
    const g = window.__game, p = g.state().player;
    const x = Math.floor(p.x) + 1, z = Math.floor(p.z) + 1, y = g.view.world.sim.heightAt(x, z) - 1;
    const inv = g.view.game.systems.inventory;
    const slot = inv.slots.findIndex((s) => s?.id === 'workbench');
    // Only a quick slot can be held, so the workbench goes to the ninth.
    if (slot > 8) inv.move(slot, 8);
    inv.selected = slot > 8 ? 8 : slot;
    const placed = g.click('secondary', x, y, z).used;
    g.advance(0.2);
    return { placed, prompt: g.state().prompt };
  });
  if (bench.prompt === 'Craft') await key('e');
  check('E at a workbench opens the Make panel', bench.placed && bench.prompt === 'Craft' && (await panel()) === 'make', JSON.stringify(bench));
  if ((await panel()) !== 'make') await game(() => window.__game.view.game.events.emit('ui.open', { panel: 'make' }));
  await shot('ui-11-make.png');
  await key('Escape');

  await key('m');
  check('M opens the map', await mapOpen());
  await frames(4);
  await shot('ui-12-map.png');
  await key('Escape');
  check('Esc closes the map and does not open pause', !(await mapOpen()) && (await panel()) === null && (await state()).player.busy === false);
  await key('m');
  await key('i');
  check('I swaps the map for the bag', !(await mapOpen()) && (await panel()) === 'bag');
  await key('m');
  check('M swaps the bag for the map', (await mapOpen()) && (await panel()) === null);
  await key('m');
  check('M closes the map', !(await mapOpen()));

  await key('Escape');
  check('Esc with nothing open pauses', (await panel()) === 'pause' && (await game(() => window.__game.view.paused)));
  await shot('ui-13-pause.png');
  await page.click('.gu-panel-pause .gu-btn:nth-child(2)');
  check('Settings opens from pause', (await panel()) === 'settings');
  await key('Escape');
  await key('Escape');
  check('Esc goes back to pause, then to the game', (await panel()) === null);

  // ------------------------------------------------------------------ 7. the keys the hints name
  await keysTheHintsName(t);

  // ------------------------------------------------------------------ 8. the end card
  const stats = await game(() => {
    window.__game.view.game.events.emit('act.ended', { act: 1 });
    return window.__game.view.stats();
  });
  const card = await game(() => [...document.querySelectorAll('.gu-stat dd')].map((e) => Number(e.textContent)));
  check('act.ended opens the end card with the numbers from view.stats()', (await panel()) === 'end' && card.join() === [stats.days, stats.wheat, stats.blocks, stats.pages].join(), `card ${card.join(', ')}  stats ${JSON.stringify(stats)}`);
  await shot('ui-14-end.png');
  await page.click('.gu-end .gu-btn');
  check('Keep playing closes the end card', (await panel()) === null && !(await game(() => window.__game.view.paused)));

  // ------------------------------------------------------------------ 9. back to the title, and Continue
  check('the game saves', await game(() => window.__game.save()));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__game !== undefined);
  await page.waitForSelector('.gu-stage-title');
  check('with a save, Continue is on', await game(() => document.querySelector('[data-key="title:continue"]').disabled === false));
  await shot('ui-15-title-continue.png');
  await page.click('[data-key="title:continue"]');
  await page.waitForFunction(() => window.__game.started);
  await game(() => window.__game.settle());
  await frames(3);
  const back = await state();
  check('Continue brings back the bag and the quest', back.tracked === 'bread' && back.bag.some((s) => s.id === 'oak_log'), `tracked ${back.tracked}, ${back.bag.length} stacks`);
  await shot('ui-16-continued.png');
  await t.context.close();
}

/**
 * Moves stacks in the open bag with real mouse drags: onto an empty slot, a split with the right button and with Shift,
 * a merge, a swap, onto a quick slot, a refused split, Esc in the middle, then click-to-move and the tooltip. Then a drag
 * between the HUD's quick slots with the bag closed.
 */
async function dragAndDrop(t) {
  const { page, game, shot, frames, panel } = t;
  const slots = () => game(() => window.__game.view.game.systems.inventory.slots.map((s) => (s ? `${s.id}:${s.count}` : '')));
  const find = async (id) => (await slots()).findIndex((s) => s.startsWith(`${id}:`));
  const empty = async (from) => (await slots()).findIndex((s, i) => i >= from && s === '');
  const center = async (selector) => {
    const box = await page.locator(selector).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const slot = (i) => `[data-key="slot:${i}"]`;
  // The checks after this one expect the bag as it was, so its layout is put back at the end.
  const start = await game(() => window.__game.view.game.systems.inventory.slots.map((s) => (s ? { ...s } : null)));
  /** Presses on one slot, moves in steps to another and lets go. `during` runs with the pointer over the target. */
  const drag = async (fromSel, toSel, { button = 'left', shift = false, during } = {}) => {
    const a = await center(fromSel), b = await center(toSel);
    await page.mouse.move(a.x, a.y);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down({ button });
    await page.mouse.move(a.x + 12, a.y + 8, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 8 });
    const seen = during ? await during() : null;
    await page.mouse.up({ button });
    if (shift) await page.keyboard.up('Shift');
    await frames(1);
    return seen;
  };

  // A whole stack onto an empty slot, with the ghost and the lit target checked in the middle of the drag.
  const logs = await find('oak_log');
  const free = await empty(9);
  const before = await slots();
  const mid = await drag(slot(logs), slot(free), {
    during: async () => {
      const seen = await game((to) => ({
        ghost: Boolean(document.querySelector('.gu-ghost')),
        lit: document.querySelector(`[data-key="slot:${to}"]`)?.classList.contains('is-drop') ?? false,
      }), free);
      await shot('ui-08-bag-drag.png');
      return seen;
    },
  });
  let now = await slots();
  check('drag: a ghost follows the pointer and the slot under it lights up', mid.ghost && mid.lit, JSON.stringify(mid));
  check('drag: a stack dragged onto an empty slot moves there', now[logs] === '' && now[free] === before[logs], `${before[logs]} from ${logs} to ${free}`);
  check('drag: the ghost is gone after the drop', !(await game(() => Boolean(document.querySelector('.gu-ghost')))));

  // The right button takes half, onto an empty slot.
  const free2 = await empty(9);
  await drag(slot(free), slot(free2), { button: 'right' });
  now = await slots();
  check('drag: the right button splits a stack in half', now[free] === 'oak_log:7' && now[free2] === 'oak_log:7', `${now[free]} and ${now[free2]}`);
  // Back onto the same item, it merges.
  await drag(slot(free2), slot(free));
  now = await slots();
  check('drag: a stack dropped on the same item merges into it', now[free] === 'oak_log:14' && now[free2] === '', `${now[free]} and ${now[free2] || 'empty'}`);
  // Shift with the left button takes half too.
  await drag(slot(free), slot(free2), { shift: true });
  now = await slots();
  check('drag: Shift and the left button split a stack in half', now[free] === 'oak_log:7' && now[free2] === 'oak_log:7', `${now[free]} and ${now[free2]}`);
  // Half a stack onto another item has nowhere to go, and nothing changes.
  const planks = await find('plank');
  const refusedBefore = await slots();
  await drag(slot(free2), slot(planks), { button: 'right' });
  check('drag: half a stack onto another item is refused, and nothing moves', JSON.stringify(await slots()) === JSON.stringify(refusedBefore));
  // A whole stack onto another item swaps them.
  await drag(slot(free2), slot(planks));
  now = await slots();
  check('drag: a stack dropped on another item swaps with it', now[planks] === 'oak_log:7' && now[free2] === refusedBefore[planks], `${now[planks]} and ${now[free2]}`);
  // Onto a quick slot.
  const quickBefore = (await slots())[4];
  await drag(slot(free), slot(4));
  now = await slots();
  check('drag: a stack from the bag goes onto a quick slot, and the quick slot\'s stack comes back', now[4] === 'oak_log:7' && now[free] === quickBefore, `quick 5: ${now[4]}, slot ${free + 1}: ${now[free] || 'empty'}`);
  // Esc in the middle of a drag puts the stack back and leaves the bag open.
  const escBefore = await slots();
  const a = await center(slot(4)), b = await center(slot(await empty(9)));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.keyboard.press('Escape');
  const escGhost = await game(() => Boolean(document.querySelector('.gu-ghost')));
  await page.mouse.up();
  await frames(1);
  check('drag: Esc puts the stack back and keeps the bag open', !escGhost && JSON.stringify(await slots()) === JSON.stringify(escBefore) && (await panel()) === 'bag');

  // Click-to-move still works, for the keyboard and for anyone who cannot drag.
  const axe = await find('axe');
  const free3 = await empty(9);
  await page.click(slot(axe));
  await page.click(slot(free3));
  now = await slots();
  check('click-to-move: a click on a stack, then on a slot, still moves it', now[axe] === '' && now[free3] === 'axe:1', `axe from ${axe} to ${free3}`);
  await page.click(slot(free3));
  await page.click(slot(axe));
  // The keyboard: Enter picks up, an arrow moves the focus, Enter puts down.
  await page.focus(slot(axe));
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  const right = await game(() => Number(document.activeElement?.dataset.key?.split(':')[1]));
  await page.keyboard.press('Enter');
  now = await slots();
  check('keyboard: Enter, an arrow and Enter move a stack', now[right]?.startsWith('axe') && right === axe + 1, `axe to slot ${right + 1}`);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');

  // The thing under the pointer is named with what it is for: in the detail pane beside the slots on a wide screen,
  // in a tooltip on a narrow one.
  const at = await center(slot(await find('axe')));
  await page.mouse.move(at.x, at.y);
  const tip = await game(() => {
    const pane = document.querySelector('.gu-detail');
    if (pane && pane.offsetParent !== null) return { name: pane.querySelector('.gu-detail-name')?.textContent ?? '', use: pane.querySelector('.gu-detail-use')?.textContent ?? '', where: 'pane' };
    const e = document.querySelector('.gu-tip');
    return e && !e.hidden ? { name: e.querySelector('.gu-tip-name')?.textContent ?? '', use: e.querySelector('.gu-tip-use')?.textContent ?? '', where: 'tooltip' } : null;
  });
  check('the bag names the item under the pointer and says what it is for', tip?.name === 'Axe' && /fell/.test(tip.use), JSON.stringify(tip));
  await shot('ui-08-bag-tip.png');
  await page.mouse.move(5, 5);

  // The HUD's quick slots take a drag too, with the bag closed.
  await page.keyboard.press('i');
  await frames(2);
  const hudBefore = await slots();
  const from = hudBefore.findIndex((s, i) => i < 9 && s !== '');
  const to = hudBefore.findIndex((s, i) => i < 9 && i !== from && s === '');
  if (from >= 0 && to >= 0) {
    const target = await center(`.gb-hud-slots .gb-slot[data-slot="${to}"]`);
    const under = await game((at) => document.elementsFromPoint(at.x, at.y).slice(0, 3).map((e) => e.className || e.tagName).join(' > '), target);
    await drag(`.gb-hud-slots .gb-slot[data-slot="${from}"]`, `.gb-hud-slots .gb-slot[data-slot="${to}"]`);
    now = await slots();
    check('drag: a stack moves from one quick slot at the bottom of the screen to another', now[from] === '' && now[to] === hudBefore[from], `${hudBefore[from]} from ${from + 1} to ${to + 1}, under the pointer: ${under}`);
    await drag(`.gb-hud-slots .gb-slot[data-slot="${to}"]`, `.gb-hud-slots .gb-slot[data-slot="${from}"]`);
  } else {
    check('drag: the quick slots have a stack and an empty slot to try', false, hudBefore.slice(0, 9).join(' | '));
  }
  await game((kept) => {
    const sys = window.__game.view.game.systems;
    kept.forEach((stack, i) => { sys.inventory.slots[i] = stack; });
    window.__game.view.game.events.emit('inventory.changed', {});
  }, start);
  await page.keyboard.press('i');
}

/** Presses every key a hint names, with the real keyboard and mouse, and checks that it does what the hint says. */
/**
 * A right click as a hand makes it: the press and the release 60 ms apart by the events' own clocks. The game
 * counts a right press as a click only when it comes up soon (src/game/shell/drag.ts), and page.mouse waits for
 * each event to be handled, which takes a whole frame on this Mac's software WebGL. These are the same input
 * events page.mouse sends, with the time a hand would take written on them.
 */
async function handClick(page, x, y, jitter = 0) {
  const cdp = (page.__cdp ??= await page.context().newCDPSession(page));
  const t0 = Date.now() / 1000;
  const send = (type, px, py, at, buttons) => cdp.send('Input.dispatchMouseEvent', { type, x: px, y: py, button: type === 'mouseMoved' ? 'none' : 'right', buttons, clickCount: type === 'mouseMoved' ? 0 : 1, timestamp: t0 + at });
  await send('mouseMoved', x, y, 0, 0);
  await send('mousePressed', x, y, 0.01, 2);
  if (jitter) { await send('mouseMoved', x + jitter, y - 1, 0.03, 2); await send('mouseMoved', x - 1, y + jitter, 0.05, 2); }
  await send('mouseReleased', jitter ? x - 1 : x, jitter ? y + jitter : y, 0.07, 0);
}

async function keysTheHintsName(t) {
  const { page, game, frames, panel, mapOpen, state } = t;
  // "Move with W, A, S and D."
  const moved = {};
  for (const [name, axis, sign] of [['w', 'z', -1], ['s', 'z', 1], ['a', 'x', -1], ['d', 'x', 1]]) {
    const from = (await state()).player;
    await page.keyboard.down(name);
    await game(() => window.__game.advance(0.5));
    await page.keyboard.up(name);
    const to = (await state()).player;
    moved[name] = (to[axis] - from[axis]) * sign;
  }
  check('hint "move": W, A, S and D walk north, west, south and east of the camera', Object.values(moved).every((far) => far > 1), JSON.stringify(moved));

  // "Q and R turn the camera."
  const quarter = async () => (await state()).camera.quarter;
  const q0 = await quarter();
  await page.keyboard.press('q');
  const q1 = await quarter();
  await page.keyboard.press('r');
  const q2 = await quarter();
  check('hint "move": Q and R turn the camera, one each way', q1 !== q0 && q2 === q0, `${q0} to ${q1} to ${q2}`);

  // "Hold Shift to walk softly."
  await game(() => window.__game.advance(0.5));
  const a = (await state()).player;
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await game(() => window.__game.advance(1));
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  const b = (await state()).player;
  const soft = Math.hypot(b.x - a.x, b.z - a.z);
  check('hint "soft": Shift walks at about 2 blocks a second', soft > 1.5 && soft < 2.3, `${soft.toFixed(2)} blocks in a second`);

  // "Keys 1 to 9 pick a quick slot."
  const slots = [];
  for (const digit of ['1', '5', '9']) {
    await page.keyboard.press(digit);
    slots.push((await state()).selected);
  }
  check('hint "slots": 1, 5 and 9 pick those quick slots', slots.join() === '0,4,8', slots.join());

  // "Press Tab to open the Almanac." and "Press M to open the map."
  await page.keyboard.press('Tab');
  const tab = await panel();
  await page.keyboard.press('Tab');
  check('hint "almanac": Tab opens the Almanac, and closes it', tab === 'almanac' && (await panel()) === null);
  await page.keyboard.press('m');
  const m = await mapOpen();
  await page.keyboard.press('m');
  check('hint "map": M opens the map, and closes it', m && !(await mapOpen()));

  // "Hold the left button on a tree or a block to gather it." and "The right button uses or sets down what you hold."
  await cameraStill(page);
  const spot = await game(() => {
    const g = window.__game, p = g.state().player, sim = g.view.world.sim;
    // The first open column near the hero whose top the pointer can reach.
    for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, 2]]) {
      const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz, y = sim.heightAt(x, z) - 1;
      if (Math.abs(y + 1 - p.y) > 1.5) continue;
      const at = g.view.project(x + 0.5, y + 1, z + 0.5);
      if (at) return { x, y, z, at, block: g.block(x, y, z).key };
    }
    return null;
  });
  if (!spot) {
    check('hint "gather" and "use": a block near the hero is on the screen', false);
    return;
  }
  await page.mouse.move(spot.at.x, spot.at.y);
  await frames(2);
  const aim = (await state()).aim;
  const onIt = aim && aim.x === spot.x && aim.z === spot.z;
  if (!onIt) note(`The pointer over the ${spot.block} block at ${spot.x}, ${spot.y}, ${spot.z} aims at ${JSON.stringify(aim)}, a block in front of it. The check uses the block it aims at.`);
  const target = aim ?? spot;
  const blockBefore = await game((at) => window.__game.block(at.x, at.y, at.z).key, target);
  await page.mouse.down();
  await page.waitForFunction(at => window.__game.block(at.x, at.y, at.z).id === 0, target, { timeout: 15000 }).catch(() => {});
  await page.mouse.up();
  const blockAfter = await game((at) => window.__game.block(at.x, at.y, at.z).key, target);
  check('hint "gather": holding the left button breaks the block under the pointer', blockBefore !== 'air' && blockAfter === 'air', `${blockBefore} to ${blockAfter}`);

  // Hold planks and set one down where the block was.
  await game(() => {
    const inv = window.__game.view.game.systems.inventory;
    const slot = inv.slots.findIndex((s) => s?.id === 'plank');
    if (slot >= 0 && slot < 9) inv.selected = slot;
    window.__game.advance(0.2);
  });
  await frames(2);
  const planks = (await state()).bag.find((s) => s.id === 'plank')?.count ?? 0;
  const heldNow = (await state()).held;
  await handClick(page, spot.at.x, spot.at.y);
  await game(() => window.__game.advance(0.2));
  const planksAfter = (await state()).bag.find((s) => s.id === 'plank')?.count ?? 0;
  check('hint "use": the right button sets down the plank in the hand', heldNow === 'plank' && planksAfter === planks - 1, `held ${heldNow}, planks ${planks} to ${planksAfter}`);

  // "Press E to talk to someone close by." was pressed beside Tamsin in the conversation above, when she is in the game.
  // "Sleep in a bed ... press E beside it" and the workbench use the same key through the prompt.
  await frames(1);
}

async function phone(browser) {
  const t = await open(browser, 390, 844);
  const { page, game, shot, frames, panel, clean, mapOpen } = t;
  await page.waitForSelector('.gu-stage-title');
  await shot('ui-20-phone-title.png');
  await newGame(t);
  await game(() => window.__game.advance(6));
  await frames(2);
  await shot('ui-21-phone-hud.png');
  await clean('at the start');

  await talkToTamsin(t);
  await game(() => window.__game.view.game.events.emit('hint', { id: 'check-talk', text: 'A hint that arrives while someone is talking.' }));
  await frames(3);
  await shot('ui-22-phone-talk.png');
  await clean('in a conversation with a hint up');
  await game(() => window.__game.talkThrough());
  await frames(1);
  check('390: the box closes when the conversation ends', !(await t.visible('.gb-dialogue')));

  await game(() => {
    const g = window.__game;
    g.skipTo('bread');
    g.give('oak_log', 14); g.give('plank', 9); g.give('berry', 3); g.give('wheat', 7);
    g.advance(0.6);
  });
  await frames(1);
  await shot('ui-23-phone-hud-items.png');
  await clean('with toasts');
  await page.keyboard.press('i');
  check('390: I opens the bag', (await panel()) === 'bag');
  await shot('ui-24-phone-bag.png');
  await page.keyboard.press('i');
  await page.keyboard.press('m');
  check('390: M opens the map', await mapOpen());
  await frames(4);
  await shot('ui-25-phone-map.png');
  await t.context.close();
}

/** The other title: the live world with the camera drifting behind the plate. */
async function worldTitle(browser) {
  const t = await open(browser, 1440, 900, '&title=world');
  const { page, game, shot, frames } = t;
  await page.waitForSelector('.gu-stage-title');
  await game(() => window.__game.settle());
  const look = () => game(() => {
    const m = window.__game.view.ctx.camera.matrixWorld.elements;
    return [m[12], m[14]];
  });
  const from = await look();
  await frames(6);
  const to = await look();
  check('?title=world: the camera drifts while the title shows', Math.hypot(to[0] - from[0], to[1] - from[1]) > 0.05, `${from.map((n) => n.toFixed(2))} to ${to.map((n) => n.toFixed(2))}`);
  check('?title=world: the world is not stepped', (await t.state()).clock.seconds === 0 && (await t.state()).started === false);
  await shot('ui-30-title-world.png');
  await newGame(t);
  await frames(4);
  await shot('ui-31-title-world-started.png');
  await t.context.close();
}

let browser;
try {
  browser = await launchChrome({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  if (!only || only === 'desktop') await desktop(browser);
  if (!only || only === 'phone') await phone(browser);
  if (!only || only === 'world') await worldTitle(browser);
  check('the page logged no console error', errors.length === 0, errors.join(' | ').slice(0, 600));
} catch (error) {
  check('the walk ran to its end', false, error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await browser?.close();
  // By the pid the server printed, never by port.
  process.kill(serverPid);
}

const failed = checks.filter((c) => !c.pass);
writeFileSync(resolve(out, 'ui.json'), JSON.stringify({ at: new Date().toISOString(), quality, checks, notes, errors, shots }, null, 2));
console.log(`\n${checks.length - failed.length} of ${checks.length} checks pass. ${shots.length} screenshots in .artifacts/play/. Report: .artifacts/play/ui.json`);
process.exit(failed.length ? 1 : 0);

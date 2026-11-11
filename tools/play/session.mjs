// The play session: one Chrome and one server for this worktree, behind a unix socket. tools/play.mjs is
// its command line; tools/play/README.md lists the commands.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChrome } from '../lib/chrome.mjs';
import { changes, now } from './diff.mjs';
import { capture, differences, jumps, sheet } from './film.mjs';
import { play, parseInputs } from './inputs.mjs';
import { append, NOTE_KINDS } from './journal.mjs';
import { findWrong, order, readScreen } from './screen.mjs';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'look';

/** --size 1366x768 */
function parseSize(text) {
  const m = /^(\d+)x(\d+)$/.exec(text ?? '960x540');
  if (!m) throw new Error('--size is WIDTHxHEIGHT, for example 1366x768');
  return { width: Number(m[1]), height: Number(m[2]) };
}

export async function serveSession({ root, out, socket, pidFile, opt, flag, request }) {
  if (existsSync(socket)) {
    try { await request('ping'); throw new Error('a play session is already running'); }
    catch (e) { if (!['ECONNREFUSED', 'ENOENT'].includes(e.code)) throw e; unlinkSync(socket); }
  }
  const viewport = parseSize(opt('size'));
  const blind = flag('blind'), touch = flag('touch');
  // --page plays a local page instead of the game: the tool's own checks use it.
  const pageFile = opt('page') ? resolve(opt('page')) : null;
  let server = null, port = null;
  if (!pageFile) {
    const child = spawn('bun', ['run', 'build', '--outDir', resolve(out, 'site'), '--emptyOutDir'], { cwd: root, stdio: 'inherit' });
    await new Promise((yes, no) => { child.on('error', no); child.on('exit', (code) => (code === 0 ? yes() : no(new Error(`build exited ${code}`)))); });
    port = Number(opt('port', process.env.PLAY_PORT || 5525));
    server = spawn('bun', ['tools/serve.mjs', resolve(out, 'site'), String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  }
  const session = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const journal = resolve(out, 'journal', session);
  mkdirSync(journal, { recursive: true });

  let browser, context, page, cdp, entries = [], mode = opt('mode', 'door'), seed = 7, named = null;
  /** Console errors not yet reported: `do`, `shot` and `replay` fail on them once, then they are gone. */
  let errors = [];
  /** Errors, warnings and failed requests since the last look. */
  let problems = [];
  let step = 0, lastState = null, lastPicture = null, lastStep = null;
  const recording = resolve(out, 'recordings', `${Date.now()}-${process.pid}.json`);
  const save = () => writeFileSync(recording, JSON.stringify({ version: 1, mode, seed, inputs: entries }, null, 2));
  const state = () => page.evaluate(() => window.__game?.state() ?? null);
  const clean = () => { if (errors.length) throw new Error(errors.splice(0).join('\n')); };

  async function fresh(nextMode, nextSeed = 7) {
    if (!['door', 'human'].includes(nextMode)) throw new Error('mode must be door or human');
    mode = nextMode; seed = nextSeed;
    if (existsSync(pidFile)) {
      const info = JSON.parse(readFileSync(pidFile, 'utf8'));
      if (info.pid === process.pid) writeFileSync(pidFile, JSON.stringify({ ...info, mode, seed }, null, 2));
    }
    await context?.close(); errors = []; problems = []; lastState = null;
    context = await browser.newContext({ viewport, hasTouch: touch });
    await context.addInitScript(`window.__playScreen = ${readScreen.toString()};`);
    page = await context.newPage(); page.setDefaultTimeout(60000);
    cdp = await context.newCDPSession(page);
    page.on('console', (msg) => {
      if (msg.type() === 'error') { errors.push(msg.text()); problems.push(`console error: ${msg.text()}`); }
      else if (msg.type() === 'warning') problems.push(`console warning: ${msg.text()}`);
    });
    page.on('pageerror', (error) => { errors.push(String(error)); problems.push(`page error: ${String(error)}`); });
    page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`));
    page.on('response', (res) => { if (res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`); });
    if (pageFile) await page.goto(pathToFileURL(pageFile).href);
    else {
      await page.goto(`http://127.0.0.1:${port}/?hold=1&quality=high&seed=${seed}`);
      await page.waitForFunction(() => window.__game !== undefined);
    }
  }

  const options = (replaying = false) => ({ mode, blind, touch, replaying, cdp });
  async function input(s, { strict = true, replaying = false } = {}) {
    entries.push(s); save();
    await play(page, s, options(replaying));
    if (strict) clean();
  }

  /** Plays inputs in order and stops at the first that fails. Returns which failed, as words. */
  async function playAll(inputs) {
    for (let i = 0; i < inputs.length; i++) {
      try { await input(inputs[i], { strict: false }); }
      catch (error) {
        const left = inputs.length - i - 1;
        return `${i + 1} of ${inputs.length} ${JSON.stringify(inputs[i])}: ${String(error.message ?? error).split('\n')[0]}${left ? `; ${left} not played` : ''}`;
      }
    }
    return null;
  }

  /** Waits for two drawn frames, so a picture shows what the last input did. At most half a second. */
  const drawn = () => Promise.race([page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))), delay(500)]);

  /** Everything but the picture: the screen, what looks wrong, what changed, what the HUD says, the problems. */
  async function observe() {
    const [screen, current] = await Promise.all([page.evaluate(() => window.__playScreen()), state()]);
    const items = order(screen.items);
    const wrong = findWrong(items, screen.viewport);
    const changed = changes(lastState, current);
    lastState = current;
    return {
      screen: items.map(({ text, kind, press, disabled, box, blockedBy }) => ({ text, kind, press, disabled, box, ...(blockedBy ? { blockedBy } : {}) })),
      wrong,
      ...(blind ? {} : { changed, now: now(current) }),
      problems: problems.splice(0),
    };
  }

  function record(kind, name, look, extra = {}) {
    lastPicture = look.picture; lastStep = look.step;
    errors = [];
    append(journal, { kind, step: look.step, name, picture: look.picture, input: extra.input, failed: look.failed, screen: look.screen.length, wrong: look.wrong, changed: look.changed, now: look.now, problems: look.problems, ...extra.film });
  }

  async function look(kind, name, extra = {}) {
    step++;
    const n = String(step).padStart(3, '0');
    const picture = resolve(journal, `${n}-${slug(name || kind)}.png`);
    await drawn();
    await page.screenshot({ path: picture });
    const result = { title: `${kind} ${n}${name ? ` ${name}` : ''}`, step, picture, ...(extra.failed ? { failed: extra.failed } : {}), ...(await observe()) };
    record(kind, name, result, extra);
    return result;
  }

  async function film(inputs, name, fps) {
    step++;
    const n = String(step).padStart(3, '0');
    const base = `${n}-${slug(name || 'film')}`;
    let failed = null;
    const shot = await capture(page, async () => { failed = await playAll(inputs); }, { fps });
    const { diffs, flickers } = await differences(shot.frames);
    const found = jumps(diffs);
    const at = (i) => Math.round(shot.frames[i].t * 1000) / 1000;
    const folder = resolve(journal, base), picture = resolve(journal, `${base}.png`);
    await sheet(shot.frames, { folder, sheetPath: picture, fps, found: found.jumps, runs: flickers, size: shot.size });
    const seconds = shot.frames.length > 1 ? Math.round((shot.frames.at(-1).t - shot.frames[0].t) * 100) / 100 : 0;
    const info = {
      frames: shot.frames.length, seconds, how: shot.how, failed: shot.failed, folder, median: found.median, limit: found.limit,
      jumps: found.jumps.map((j) => ({ ...j, t: at(j.frame) })),
      flickers: flickers.map((f) => ({ ...f, t: at(f.from), frames: f.to - f.from + 1 })),
    };
    const result = { title: `film ${n}${name ? ` ${name}` : ''}`, step, picture, film: info, ...(failed ? { failed } : {}), ...(await observe()) };
    record('film', name, result, { input: inputs, film: { frames: info.frames, how: info.how, median: info.median, limit: info.limit, jumps: info.jumps, flickers: info.flickers, folder } });
    return result;
  }

  let closing = false;
  const cleanup = async () => {
    if (closing) return; closing = true; save();
    if (named) writeFileSync(named, readFileSync(recording));
    await browser?.close();
    if (server) {
      // Wait for the server to be gone, so the next tool to bind this port finds it free.
      const gone = server.exitCode !== null || server.signalCode !== null ? Promise.resolve() : new Promise((done) => server.once('exit', done));
      server.kill();
      await Promise.race([gone, delay(5000)]);
    }
    if (existsSync(socket)) unlinkSync(socket);
    if (existsSync(pidFile)) unlinkSync(pidFile);
  };
  process.on('SIGTERM', () => cleanup().finally(() => process.exit()));
  process.on('SIGINT', () => cleanup().finally(() => process.exit()));

  const commands = {
    ping: async () => ({ alive: true }),
    state: async () => { if (blind) throw new Error('a blind session cannot read the state: use look'); clean(); return state(); },
    shot: async (args) => {
      clean();
      const path = resolve(args[0] || out + '/shot.png'); mkdirSync(resolve(path, '..'), { recursive: true });
      await page.screenshot({ path }); return { path };
    },
    do: async (args) => {
      await input(JSON.parse(args.join(' ')));
      return blind ? { done: true } : state();
    },
    look: async (args) => look('look', args[0]),
    act: async (args) => {
      const inputs = parseInputs(args[0]);
      const failed = await playAll(inputs);
      return look('act', args[1], { input: inputs.length === 1 ? inputs[0] : inputs, failed });
    },
    film: async (args) => {
      const fpsAt = args.indexOf('--fps');
      const fps = fpsAt < 0 ? 10 : Number(args[fpsAt + 1]);
      const rest = fpsAt < 0 ? args : args.filter((_, i) => i !== fpsAt && i !== fpsAt + 1);
      return film(parseInputs(rest[0]), rest[1], fps);
    },
    note: async (args) => {
      const [kind, ...words] = args;
      if (!NOTE_KINDS.includes(kind)) throw new Error(`a note is ${NOTE_KINDS.join(', ')}`);
      if (!words.join(' ').trim()) throw new Error('a note needs words');
      append(journal, { kind: 'note', note: kind, words: words.join(' '), picture: lastPicture, step: lastStep });
      return { note: kind, picture: lastPicture, journal };
    },
    record: async (args) => {
      if (args[0] === 'stop') { if (!named) throw new Error('no named recording'); writeFileSync(named, readFileSync(recording)); const path = named; named = null; return { path }; }
      named = resolve(out, 'recordings', `${args[0] || 'scenario'}.json`); entries = []; save(); return { path: named };
    },
    replay: async (args) => {
      const scenario = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
      await fresh(scenario.mode, scenario.seed); entries = []; save();
      for (const s of scenario.inputs) await input(s, { replaying: true });
      clean();
      return { pass: true, inputs: entries.length, ...(blind ? {} : { state: await state() }) };
    },
    stop: async () => ({ stopped: true, recording: named || recording, journal }),
  };

  try {
    if (server) {
      await new Promise((yes, no) => {
        server.stdout.on('data', (chunk) => { process.stdout.write(chunk); if (/pid \d+/.test(String(chunk))) yes(); });
        server.on('exit', (code) => no(new Error(`server exited ${code}`))); server.on('error', no);
      });
    }
    browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
    await fresh(mode); save();
    let queue = Promise.resolve();
    const ipc = createServer({ allowHalfOpen: true }, (client) => {
      client.on('error', () => {});
      let data = ''; client.on('data', (chunk) => { data += chunk; });
      client.on('end', () => { queue = queue.then(async () => {
        try {
          const { command, args } = JSON.parse(data);
          if (!commands[command]) throw new Error(`unknown command ${command}`);
          const result = await commands[command](args);
          client.end(JSON.stringify(result));
          if (command === 'stop') { ipc.close(); await cleanup(); }
        } catch (error) { client.end(JSON.stringify({ error: String(error) })); }
      }); });
    });
    ipc.on('error', (error) => { console.error(error); cleanup().finally(() => process.exit(1)); });
    ipc.listen(socket, () => writeFileSync(pidFile, JSON.stringify({
      pid: process.pid, serverPid: server?.pid ?? null, socket, port, renderer: browser.gameRenderer, mode, recording,
      journal, blind, touch, size: `${viewport.width}x${viewport.height}`, ...(pageFile ? { page: pageFile } : {}),
    }, null, 2)));
  } catch (error) { await cleanup(); throw error; }
}

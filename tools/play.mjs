// Persistent browser session. See tools/play/README.md for the command protocol.
import { spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { launchChrome } from './lib/chrome.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/play');
mkdirSync(resolve(out, 'recordings'), { recursive: true });
const socket = `/tmp/game-play-${createHash('sha256').update(root).digest('hex').slice(0, 16)}.sock`;
const pidFile = resolve(out, 'session.json');
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const delay = ms => new Promise(r => setTimeout(r, ms));
function request(command, args = []) {
  return new Promise((yes, no) => {
    const client = createConnection(socket); let data = '';
    client.setTimeout(120000, () => client.destroy(new Error('play command timed out')));
    client.on('connect', () => client.end(JSON.stringify({ command, args })));
    client.on('data', chunk => data += chunk);
    client.on('error', no);
    client.on('end', () => { try { const result = JSON.parse(data); result.error ? no(new Error(result.error)) : yes(result); } catch (error) { no(error); } });
  });
}
async function build() {
  const child = spawn('bun', ['run', 'build', '--outDir', resolve(out, 'site'), '--emptyOutDir'], { cwd: root, stdio: 'inherit' });
  await new Promise((yes, no) => { child.on('error', no); child.on('exit', code => code === 0 ? yes() : no(new Error(`build exited ${code}`))); });
}

async function serveSession() {
  if (existsSync(socket)) {
    try { await request('state'); throw new Error('a play session is already running'); }
    catch (e) { if (!['ECONNREFUSED', 'ENOENT'].includes(e.code)) throw e; unlinkSync(socket); }
  }
  await build();
  const port = Number(opt('port', process.env.PLAY_PORT || 5525));
  if (port < 5520 || port > 5529) throw new Error('use a port in 5520..5529');
  const server = spawn('bun', ['tools/serve.mjs', resolve(out, 'site'), String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  let browser, context, page, errors = [], entries = [], mode = opt('mode', 'door'), seed = 7, named = null;
  const recording = resolve(out, 'recordings', `${Date.now()}-${process.pid}.json`);
  const save = () => writeFileSync(recording, JSON.stringify({ version: 1, mode, seed, inputs: entries }, null, 2));
  const state = () => page.evaluate(() => window.__game.state());
  const clean = () => { if (errors.length) throw new Error(errors.join('\n')); };
  async function fresh(nextMode, nextSeed = 7) {
    if (!['door', 'human'].includes(nextMode)) throw new Error('mode must be door or human');
    mode = nextMode; seed = nextSeed;
    await context?.close(); errors = [];
    context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${port}/?hold=1&quality=high&seed=${seed}`);
    await page.waitForFunction(() => window.__game !== undefined);
  }
  async function input(step) {
    entries.push(step); save();
    if (step.type === 'door') {
      if (mode !== 'door') throw new Error('human mode forbids door writes');
      const allowed = ['newGame','teleport','give','skipTo','advance','setTime','setCamera','look','interact','talkThrough','manual','turn'];
      if (!allowed.includes(step.method)) throw new Error('unknown door command');
      await page.evaluate(async s => { await window.__game[s.method](...(s.args || [])); }, step);
    } else if (step.type === 'press') await page.keyboard.press(step.key);
    else if (step.type === 'hold') {
      await page.keyboard.down(step.key);
      try { if (step.until) await page.waitForFunction(checkState, step.until, { timeout: step.timeout || 15000 }); else await delay(step.ms ?? 250); }
      finally { await page.keyboard.up(step.key); }
    } else if (step.type === 'click') {
      if (step.text) await page.getByRole('button', { name: step.text, exact: true }).click();
      else await page.mouse.click(step.x, step.y, { button: step.button || 'left' });
    } else if (step.type === 'mouseDown') await page.mouse.down({ button: step.button || 'left' });
    else if (step.type === 'mouseUp') await page.mouse.up({ button: step.button || 'left' });
    else if (step.type === 'wheel') await page.mouse.wheel(step.x || 0, step.y || 0);
    else if (step.type === 'move') await page.mouse.move(step.x, step.y);
    else if (step.type === 'wait') await delay(step.ms ?? 250);
    else if (step.type === 'check') await page.waitForFunction(checkState, step, { timeout: step.timeout || 10000 });
    else throw new Error(`unknown input type ${step.type}`);
    clean(); return state();
  }
  // A serializable state predicate. Human mode only reads the debug door.
  function checkState(s) {
    const value = s.path.split('.').reduce((v, k) => v?.[k], window.__game.state());
    if ('equals' in s) return JSON.stringify(value) === JSON.stringify(s.equals);
    if ('min' in s) return value >= s.min;
    if ('max' in s) return value <= s.max;
    return Boolean(value);
  }
  let closing = false;
  const cleanup = async () => {
    if (closing) return; closing = true; save();
    await browser?.close(); server.kill();
    if (existsSync(socket)) unlinkSync(socket);
    if (existsSync(pidFile)) unlinkSync(pidFile);
  };
  process.on('SIGTERM', () => cleanup().finally(() => process.exit()));
  process.on('SIGINT', () => cleanup().finally(() => process.exit()));
  try {
    await new Promise((yes, no) => { server.stdout.on('data', chunk => { process.stdout.write(chunk); if (/pid \d+/.test(String(chunk))) yes(); }); server.on('exit', code => no(new Error(`server exited ${code}`))); server.on('error', no); });
    browser = await launchChrome({ args: ['--autoplay-policy=no-user-gesture-required'] });
    await fresh(mode); save();
    let queue = Promise.resolve();
    const ipc = createServer({ allowHalfOpen: true }, client => {
      client.on('error', () => {});
      let data = ''; client.on('data', chunk => data += chunk);
      client.on('end', () => { queue = queue.then(async () => {
        try {
          const { command, args } = JSON.parse(data); let result;
          if (command === 'ping') result = { alive: true };
          else if (command === 'state') { clean(); result = await state(); }
          else if (command === 'shot') { clean(); const path = resolve(args[0] || out + '/shot.png'); mkdirSync(resolve(path, '..'), { recursive: true }); await page.screenshot({ path }); result = { path }; }
          else if (command === 'do') result = await input(JSON.parse(args.join(' ')));
          else if (command === 'record') {
            if (args[0] === 'stop') { if (!named) throw new Error('no named recording'); writeFileSync(named, readFileSync(recording)); result = { path: named }; named = null; }
            else { named = resolve(out, 'recordings', `${args[0] || 'scenario'}.json`); entries = []; save(); result = { path: named }; }
          } else if (command === 'replay') {
            const scenario = JSON.parse(readFileSync(resolve(args[0]), 'utf8'));
            await fresh(scenario.mode, scenario.seed); entries = []; save();
            for (const step of scenario.inputs) await input(step);
            clean(); result = { pass: true, inputs: entries.length, state: await state() };
          } else if (command === 'stop') { result = { stopped: true }; }
          else throw new Error(`unknown command ${command}`);
          client.end(JSON.stringify(result));
          if (command === 'stop') { ipc.close(); await cleanup(); }
        } catch (error) { client.end(JSON.stringify({ error: String(error) })); }
      }); });
    });
    ipc.on('error', error => { console.error(error); cleanup().finally(() => process.exit(1)); });
    ipc.listen(socket, () => writeFileSync(pidFile, JSON.stringify({ pid: process.pid, serverPid: server.pid, socket, port, renderer: browser.gameRenderer, mode, recording }, null, 2)));
  } catch (error) { await cleanup(); throw error; }
}

if (argv[0] === '--daemon') {
  const lock = resolve(out, 'session.lock');
  if (existsSync(lock)) {
    const owner = Number(readFileSync(lock, 'utf8'));
    let alive = true;
    try { process.kill(owner, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    if (alive) throw new Error(`play session ${owner} already owns this worktree`);
    unlinkSync(lock);
  }
  const fd = openSync(lock, 'wx'); writeFileSync(fd, String(process.pid)); closeSync(fd);
  process.on('exit', () => {
    if (existsSync(lock) && readFileSync(lock, 'utf8') === String(process.pid)) unlinkSync(lock);
  });
  await serveSession();
}
else if (argv[0] === 'start') {
  try { console.log(JSON.stringify(await request('state'))); }
  catch (e) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(e.code)) throw e;
    const log = openSync(resolve(out, 'session.log'), 'a');
    const child = spawn('bun', [import.meta.filename, '--daemon', ...argv.slice(1)], { cwd: root, detached: true, stdio: ['ignore', log, log] }); child.unref(); closeSync(log);
    for (let i = 0; ; i++) {
      try { const value = await request('state'); console.log(JSON.stringify({ ...JSON.parse(readFileSync(pidFile)), state: value })); break; }
      catch (error) { try { process.kill(child.pid, 0); } catch { throw new Error(`session exited. Read ${out}/session.log`); }
        if (i >= 600) throw new Error(`session did not start: ${error}. Read ${out}/session.log`); await delay(100); }
    }
  }
} else if (argv[0] === 'replay') {
  try { await request('ping'); } catch (error) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
    const child = spawn('bun', [import.meta.filename, 'start'], { cwd: root, stdio: 'inherit' });
    await new Promise((yes, no) => { child.on('error', no); child.on('exit', code => code === 0 ? yes() : no(new Error('start failed'))); });
  }
  console.log(JSON.stringify(await request('replay', argv.slice(1)), null, 2));
} else if (argv[0]) console.log(JSON.stringify(await request(argv[0], argv.slice(1)), null, 2));
else console.log('usage: bun tools/play.mjs start [--mode human|door] [--port 5525] | state | shot <png> | do <JSON> | record <name|stop> | replay <json> | stop');

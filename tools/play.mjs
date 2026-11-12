// Persistent browser session. See tools/play/README.md for the commands and inputs.
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { formatLook } from './play/format.mjs';
import { exportNotes, latest, render } from './play/journal.mjs';
import { serveSession } from './play/session.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/play');
mkdirSync(resolve(out, 'recordings'), { recursive: true });
const socket = `/tmp/game-play-${createHash('sha256').update(root).digest('hex').slice(0, 16)}.sock`;
const pidFile = resolve(out, 'session.json');
const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1]; };
const flag = (name) => argv.includes('--' + name);
const delay = ms => new Promise(r => setTimeout(r, ms));
function request(command, args = []) {
  return new Promise((yes, no) => {
    const client = createConnection(socket); let data = '';
    client.setTimeout(300000, () => client.destroy(new Error('play command timed out')));
    client.on('connect', () => client.end(JSON.stringify({ command, args })));
    client.on('data', chunk => data += chunk);
    client.on('error', no);
    client.on('end', () => { try { const result = JSON.parse(data); result?.error ? no(new Error(result.error)) : yes(result); } catch (error) { no(error); } });
  });
}
const session = () => (existsSync(pidFile) ? JSON.parse(readFileSync(pidFile, 'utf8')) : null);
async function ensureSession() {
  try { await request('ping'); } catch (error) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(error.code)) throw error;
    const child = spawn('bun', [import.meta.filename, 'start'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
    await new Promise((yes, no) => { child.on('error', no); child.on('exit', code => code === 0 ? yes() : no(new Error('start failed'))); });
  }
}

const command = argv[0];
if (command === '--daemon') {
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
  await serveSession({ root, out, socket, pidFile, opt, flag, request });
}
else if (command === 'start') {
  const print = async () => {
    const info = session();
    console.log(JSON.stringify(info?.blind || info?.page ? info : { ...info, state: await request('state') }));
  };
  try { await request('ping'); await print(); }
  catch (e) {
    if (!['ENOENT', 'ECONNREFUSED'].includes(e.code)) throw e;
    const log = openSync(resolve(out, 'session.log'), 'a');
    const child = spawn('bun', [import.meta.filename, '--daemon', ...argv.slice(1)], { cwd: root, detached: true, stdio: ['ignore', log, log] }); child.unref(); closeSync(log);
    for (let i = 0; ; i++) {
      try { await request('ping'); if (!session()) throw new Error('no session file yet'); await print(); break; }
      catch (error) { try { process.kill(child.pid, 0); } catch { throw new Error(`session exited. Read ${out}/session.log`); }
        if (i >= 600) throw new Error(`session did not start: ${error}. Read ${out}/session.log`); await delay(100); }
    }
  }
} else if (command === 'replay' && argv[1] === 'all') {
  await ensureSession();
  const folder = resolve(root, 'tools/play/scenarios');
  let failed = 0;
  for (const name of readdirSync(folder).filter((f) => f.endsWith('.json')).sort()) {
    const started = Date.now();
    try {
      const result = await request('replay', [resolve(folder, name)]);
      console.log(`pass ${name}  ${result.inputs} inputs, ${((Date.now() - started) / 1000).toFixed(1)} s`);
    } catch (error) { failed++; console.log(`FAIL ${name}  ${String(error.message).split('\n')[0].slice(0, 300)}`); }
  }
  console.log(failed ? `replay all: ${failed} failed` : 'replay all: every recording passed');
  process.exitCode = failed ? 1 : 0;
} else if (command === 'replay') {
  await ensureSession();
  console.log(JSON.stringify(await request('replay', argv.slice(1)), null, 2));
} else if (command === 'stop') {
  console.log(JSON.stringify(await request('stop'), null, 2));
  // The session answers first and cleans up after; stop returns once it has, with its server and port released
  // and its process gone, so a start right after does not find the worktree still owned.
  const lock = resolve(out, 'session.lock');
  for (let i = 0; i < 150 && (existsSync(pidFile) || existsSync(lock)); i++) await delay(100);
} else if (['look', 'act', 'film'].includes(command)) {
  const json = flag('json');
  const result = await request(command, argv.slice(1).filter((a) => a !== '--json'));
  console.log(json ? JSON.stringify(result, null, 2) : formatLook(result));
  if (result.failed) process.exitCode = 1;
} else if (command === 'note') {
  const result = await request('note', argv.slice(1));
  console.log(`${result.note} noted on ${result.picture ?? 'no picture yet'}`);
} else if (command === 'journal') {
  const to = opt('to');
  const given = argv.slice(1).find((a, i, all) => !a.startsWith('--') && !['--to', '--with'].includes(all[i - 1]));
  const folder = given ? resolve(given) : session()?.journal ?? latest(resolve(out, 'journal'));
  if (!folder) throw new Error('no journal yet: look, act or film first');
  const paths = await render(folder);
  console.log(`${paths.html}\n${paths.notes}`);
  if (to) {
    const copied = await exportNotes(folder, resolve(to), String(opt('with', '')).split(',').filter(Boolean).map(Number));
    console.log(`${copied.notes}\n${copied.pictures.length} pictures in ${resolve(to)}`);
  }
} else if (command) console.log(JSON.stringify(await request(command, argv.slice(1)), null, 2));
else console.log('usage: bun tools/play.mjs start [--mode human|door] [--blind] [--live] [--size 1366x768] [--touch] [--port 5525] | look [name] | act <input> [name] | film <input> [name] [--fps 10] | note <bug|polish|question> <words> | journal [--to <folder> [--with 1,4]] | state | shot <png> | do <JSON> | record <name|stop> | replay <json|all> | stop');
